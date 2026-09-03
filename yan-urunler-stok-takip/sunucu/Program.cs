using System.Globalization;
using System.Text.Json.Nodes;
using YanUrunler.Sunucu;

// İÇERİK KÖKÜ UYGULAMA KLASÖRÜNE SABİTLENİR.
// Varsayılan davranış "çalışma dizini"dir; bu, sunucuyu başka bir klasörden
// başlatınca wwwroot'u bulamaz ve uygulama 404 döner. Windows servisi olarak
// çalışırken çalışma dizini C:\Windows\System32'dir — orada da bulunamaz.
// Test edildi: sabitlenmeden önce "/" isteği 404 veriyordu.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});

// IIS altında çalışırken hiçbir şey yapmaz; yalnız Windows servisi olarak
// kaydedilirse ömür yönetimini devralır. Tek publish çıktısı iki kurulum
// yolunu da taşısın diye burada duruyor. (Microsoft Learn · AddWindowsService)
builder.Services.AddWindowsService();

var ayar = builder.Configuration.GetSection("YanUrunler");

// VERİTABANI SUNUCUNUN YEREL DİSKİNDE DURUR. Ağ paylaşımına konmaz:
// WAL paylaşımlı bellek ister, ağ dosya sisteminde çalışmaz ve kilitleme
// hataları veri bozulmasına yol açar. (SQLITE-MIMARI-KARARI.md §2)
var veriDosyasi = ayar["VeriDosyasi"];
if (string.IsNullOrWhiteSpace(veriDosyasi))
    veriDosyasi = Path.Combine(builder.Environment.ContentRootPath, "veri", "yanurunler.db");

var yedekKlasoru = ayar["YedekKlasoru"];
if (string.IsNullOrWhiteSpace(yedekKlasoru))
    yedekKlasoru = Path.Combine(builder.Environment.ContentRootPath, "yedek");

// Tıklamasız günlük JSON yedek klasörü (js/07-yedekci.js) — GunlukJsonYedek
// notu. SQLite yedeğinden (yukarıdaki yedekKlasoru) AYRI bir şeydir.
var gunlukJsonKlasoru = GunlukJsonYedek.KlasoruBul(builder.Configuration, builder.Environment.ContentRootPath);

builder.Services.AddSingleton(sp => new PaketDeposu(
    veriDosyasi, sp.GetRequiredService<ILogger<PaketDeposu>>()));

// GECELİK YEDEK MUTLAK YOLLA KURULUR (BUG-013, 30.08.2026). Servis eskiden
// yolu kendi IConfiguration'ından okuyordu ve ayar boşsa "yedek" göreli yoluna
// düşüyordu; çalışma dizini sabitlenmediği için Windows servisi olarak
// C:\Windows\System32\yedek'e yazıyordu. Elle yedek ucu (POST /api/yedek)
// yukarıdaki mutlak yolu kullandığı için iki mekanizma iki ayrı klasöre
// yazıyor, budama da yanlış klasörü buduyordu. Yol artık elden veriliyor.
var gunlukYedekSaati = TimeSpan.TryParse(ayar["GunlukYedekSaati"], CultureInfo.InvariantCulture, out var yedekSaati)
    ? yedekSaati
    : new TimeSpan(22, 0, 0);

builder.Services.AddHostedService(sp => new GunlukYedek(
    sp.GetRequiredService<PaketDeposu>(),
    yedekKlasoru,
    gunlukYedekSaati,
    sp.GetRequiredService<ILogger<GunlukYedek>>()));

// Posta gönderimi (kullanıcı kararı, 28.08.2026). Ayarlar boşsa nesne yine
// kurulur ama Hazir=false döner; ekran o zaman eski mailto yoluna düşer.
builder.Services.AddSingleton<Postaci>();

// Kullanıcının kendi posta hesabı (ekrandan giriş) — MailHesabi notu.
builder.Services.AddSingleton<MailHesabi>();

var app = builder.Build();

app.Services.GetRequiredService<PaketDeposu>().Kur();

// QuestPDF Community lisansı: yıllık cirosu 1 M USD altındaki kuruluşlar
// için ücretsizdir ve kodda açıkça bildirilmesi gerekir.
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

// Dosya adları içerik hash'i taşımadığı için tarayıcı her kullanımda
// sunucuya yeniden doğrular. ETag/304 kullanılmaya devam eder.
var statikAyar = new StaticFileOptions
{
    OnPrepareResponse = k =>
        k.Context.Response.Headers.CacheControl = "no-cache, must-revalidate"
};

// SÜRÜM DAMGASI (kullanıcı isteği, 31.08.2026): index.html'deki js/css
// bağlantılarına dosya değişiklik zamanı "?s=" olarak eklenir. Yeni sürüm
// yayınlandığında adresler değişir ve tarayıcılar eski kopyayı atmak zorunda
// kalır. Statik ara katmandan ÖNCE durmalı — IndexDamgaci notu.
IndexDamgaci.Bagla(app);

app.UseDefaultFiles();
app.UseStaticFiles(statikAyar);

// ---------------------------------------------------------------------------
// Uçlar. Sözleşme: DENEMELIK-SUNUCU-PLANI.md §3.2
// ---------------------------------------------------------------------------

/// Ucuz yoklama: istemci bunu birkaç saniyede bir sorar, değişmişse tazeler.
app.MapGet("/api/surum", (PaketDeposu depo) =>
    Results.Ok(new { surum = depo.SurumOku() }));

app.MapGet("/api/paket", (PaketDeposu depo) =>
{
    var s = depo.Oku();
    // Veritabanı boşken paket null döner; istemci kendi tohumunu üretip
    // surum 0 ile gönderir. Tohum kodu sunucuya KOPYALANMAZ.
    return Results.Ok(new { surum = s.Surum, paket = s.Paket });
});

app.MapPost("/api/paket", async (HttpRequest istek, PaketDeposu depo, ILogger<Program> gunluk) =>
{
    JsonObject? govde;
    try
    {
        govde = await istek.ReadFromJsonAsync<JsonObject>();
    }
    catch (Exception e)
    {
        gunluk.LogWarning(e, "Gövde okunamadı");
        return Results.BadRequest(new { hata = "İstek gövdesi okunamadı: " + e.Message });
    }

    if (govde is null)
        return Results.BadRequest(new { hata = "İstek gövdesi boş." });

    if (govde["surum"] is not JsonValue sv || !sv.TryGetValue<long>(out var beklenenSurum))
        return Results.BadRequest(new { hata = "'surum' alanı yok ya da sayı değil." });

    if (govde["paket"] is not JsonObject paket)
        return Results.BadRequest(new { hata = "'paket' alanı yok ya da nesne değil." });

    var sonuc = depo.Yaz(beklenenSurum, paket);

    if (sonuc.Basarili)
        return Results.Ok(new { surum = sonuc.Surum });

    if (sonuc.Cakisma)
    {
        // 409 TAZE PAKETİ DE DÖNER — istemci ikinci tur atmasın, hemen
        // yeniden hesaplayıp tekrar denesin. (Plan §2, C yolu)
        var taze = depo.Oku();
        return Results.Json(new { surum = taze.Surum, paket = taze.Paket }, statusCode: 409);
    }

    // Kural değil VERİ hatası (tekillik/FK ihlali ya da bozuk paket).
    // Yeniden denemek düzeltmez; istemci sebebi görsün.
    return Results.UnprocessableEntity(new { hata = sonuc.Mesaj, surum = sonuc.Surum });
});

/// Sunucu saati. Fabrika ağı internete kapalı olabilir; iş kayıtlarında
/// yetkili zaman kaynağı sunucudur, dış saat API'si değil.
app.MapGet("/api/saat", () => Results.Ok(new
{
    utc = DateTimeOffset.UtcNow.ToString("o", CultureInfo.InvariantCulture)
}));

/* ---------------------------------------------------------------------------
   GÜNLÜK JSON YEDEK — js/07-yedekci.js karşılığı (kullanıcı kararı,
   28.08.2026: .NET sunucusu 8155'e alınırken yan-urunler-sunucu.py'nin
   verdiği sözleşme birebir korunur — mustafafil-9a oturumunun notu).
   --------------------------------------------------------------------------- */

app.MapGet("/api/gunluk-yedek/saglik", () => GunlukJsonYedek.Saglik(gunlukJsonKlasoru));

app.MapGet("/api/gunluk-yedek/dosya", (string ad) => GunlukJsonYedek.Dosya(gunlukJsonKlasoru, ad));

app.MapPost("/api/gunluk-yedek", async (HttpRequest istek) =>
{
    GunlukYedekIstegi? g;
    try { g = await istek.ReadFromJsonAsync<GunlukYedekIstegi>(); }
    catch (Exception e) { return Results.BadRequest(new { hata = "Beklenen biçim: {dosyalar:[{ad,metin}]} — " + e.Message }); }
    if (g?.Dosyalar is null) return Results.BadRequest(new { hata = "Beklenen biçim: {dosyalar:[{ad,metin}]}" });
    return GunlukJsonYedek.Yaz(gunlukJsonKlasoru, g.Dosyalar);
});

/// Bilgi işlem kontrolü.
app.MapGet("/api/saglik", (PaketDeposu depo) =>
{
    var d = depo.Denetle();
    return Results.Ok(new
    {
        durum = d.Butunluk == "ok" && d.YabanciAnahtarKusuru == 0 ? "iyi" : "dikkat",
        butunluk = d.Butunluk,
        yabanciAnahtarKusuru = d.YabanciAnahtarKusuru,
        satirSayisi = d.SatirSayisi,
        surum = depo.SurumOku(),
        veritabani = Path.GetFullPath(depo.Dosya)
    });
});

/// Elle yedek. Bilgi işlem dış zamanlayıcı kullanmak isterse bu uç yeter.
app.MapPost("/api/yedek", (PaketDeposu depo) =>
{
    var hedef = depo.Yedekle(yedekKlasoru!, DateTimeOffset.Now);
    var d = depo.Denetle();
    return Results.Ok(new { dosya = hedef, butunluk = d.Butunluk });
});

/// Posta ayarı var mı? Ekran, "Gönder" düğmesinin hangi yolu izleyeceğini
/// buradan öğrenir: hazır değilse eski mailto akışı sürer.
app.MapGet("/api/mail/durum", (HttpContext baglam, Postaci postaci, MailHesabi hesaplar) =>
{
    // "kullanici" sorgu değeri: hangi ekran kullanıcısının hesabı sorulduğu.
    var kim = baglam.Request.Query["kullanici"].ToString();
    var hesap = hesaplar.Getir(kim);
    return Results.Ok(new
    {
        // Kendi hesabıyla giriş yapılmışsa kurumsal ayara bakılmaz.
        hazir = hesap is not null || postaci.Hazir,
        hesap,
        yazdirmaMotoru = HtmlPdf.TarayiciYolu() is not null,
        // Taslak penceresi iki koşul birden ister: istek SUNUCUNUN KENDİ
        // makinesinden gelecek ve o makinede EK TAŞIYABİLEN bir posta
        // istemcisi olacak (EmlTaslak.Kullanilabilir — klasik Outlook
        // profili). İkisinden biri yoksa ekran PDF-indirme yoluna geçer.
        pencere = baglam.Connection.RemoteIpAddress is { } ip &&
                  System.Net.IPAddress.IsLoopback(ip) &&
                  EmlTaslak.Kullanilabilir()
    });
});

/* ---------------------------------------------------------------------------
   MAIL HESABI — ekrandan giriş (kullanıcı direktifi, 28.08.2026).
   --------------------------------------------------------------------------- */

/// Adres yazılınca sunucu/port tahmini ve desteklenmeyen sağlayıcı uyarısı.
app.MapGet("/api/mail/hesap/tahmin", (string adres) =>
{
    var (sunucu, port) = MailHesabi.SunucuTahmini(adres ?? string.Empty);
    return Results.Ok(new { sunucu, port, uyari = MailHesabi.DesteklenmeyenMi(adres ?? string.Empty) });
});

/// Giriş: bağlantı SINANIR, ancak başarılıysa kaydedilir. Yanlış parola
/// diske yazılmaz — kullanıcı "kaydettim ama göndermiyor" durumuna düşmez.
app.MapPost("/api/mail/hesap", async (HttpRequest istek, MailHesabi hesaplar,
                                      ILogger<Program> gunluk) =>
{
    HesapIstegi? g;
    try { g = await istek.ReadFromJsonAsync<HesapIstegi>(); }
    catch (Exception e) { return Results.BadRequest(new { hata = e.Message }); }

    if (g is null || string.IsNullOrWhiteSpace(g.Adres) || string.IsNullOrWhiteSpace(g.Parola))
        return Results.BadRequest(new { hata = "Adres ve uygulama parolası gerekli." });

    var engel = MailHesabi.DesteklenmeyenMi(g.Adres!);
    if (engel is not null) return Results.BadRequest(new { hata = engel });

    var (vSunucu, vPort) = MailHesabi.SunucuTahmini(g.Adres!);
    var sunucu = string.IsNullOrWhiteSpace(g.Sunucu) ? vSunucu : g.Sunucu!;
    var port = g.Port is > 0 ? g.Port.Value : vPort;
    var ssl = g.Ssl ?? true;

    var hata = Postaci.Sina(sunucu, port, ssl, g.Adres!, g.Parola!);
    if (hata is not null) return Results.Json(new { hata }, statusCode: 400);

    try { hesaplar.Kaydet(g.Kullanici ?? string.Empty, g.Adres!, sunucu, port, ssl, g.Parola!); }
    catch (Exception e)
    {
        gunluk.LogError(e, "Hesap kaydedilemedi");
        return Results.Json(new { hata = e.Message }, statusCode: 500);
    }

    return Results.Ok(new { hesap = hesaplar.Getir(g.Kullanici ?? string.Empty) });
});

/// Çıkış: kayıtlı hesabı siler.
app.MapDelete("/api/mail/hesap", (HttpContext baglam, MailHesabi hesaplar) =>
    Results.Ok(new { silindi = hesaplar.Sil(baglam.Request.Query["kullanici"].ToString()) }));

/// CANLI SINAMA (kullanıcı direktifi, 28.08.2026 — Yönetim Paneli › Mail
/// Hesabı: "çalışıyor mu canlı mı"). KAYITLI parolayla gerçek bir test
/// postası gönderir; şifre yeniden istenmez. Bilerek pahalı bir çağrı —
/// yalnız yönetim ekranındaki "Bağlantıyı Sına" düğmesi çağırır.
app.MapPost("/api/mail/hesap/sina", (HttpContext baglam, MailHesabi hesaplar) =>
{
    var kim = hesaplar.Kimlik(baglam.Request.Query["kullanici"].ToString());
    if (kim is null)
        return Results.Json(new { calisiyor = false, hata = "Mail hesabı tanımlı değil." }, statusCode: 400);

    var hata = Postaci.Sina(kim.Value.Sunucu, kim.Value.Port, kim.Value.Ssl, kim.Value.Adres, kim.Value.Parola);
    return Results.Ok(new { calisiyor = hata is null, hata });
});

/// Raporu PDF olarak üretip postaya EK yapar ve gönderir.
/// Gövde: { alicilar[], konu, mesaj, baslik, altBaslik, dosyaAdi,
///          bolumler:[{ ad, sutunlar[], satirlar[[]], sagaYasli[] }] }
/// Sunucu hesap yapmaz: hücrelerin metni ekrandan gelir (RaporPdf notu).
app.MapPost("/api/mail", async (HttpRequest istek, Postaci postaci,
                                MailHesabi hesaplar, ILogger<Program> gunluk) =>
{
    var kim = istek.Query["kullanici"].ToString();
    var kimlik = hesaplar.Kimlik(kim);
    if (kimlik is null && !postaci.Hazir)
        return Results.Json(new { hata = "Posta hesabı yok: önce mail ile giriş yapın." }, statusCode: 503);

    MailIstegi? g;
    try { g = await istek.ReadFromJsonAsync<MailIstegi>(); }
    catch (Exception e)
    {
        gunluk.LogWarning(e, "Mail gövdesi okunamadı");
        return Results.BadRequest(new { hata = "İstek gövdesi okunamadı: " + e.Message });
    }

    if (g is null || g.Alicilar is null || g.Alicilar.Length == 0)
        return Results.BadRequest(new { hata = "Alıcı yok." });

    try
    {
        byte[]? pdf = null;
        var ekAdi = string.IsNullOrWhiteSpace(g.DosyaAdi) ? "rapor.pdf" : g.DosyaAdi!;

        // 1. YOL — EKRANIN YAZDIRDIĞI HTML (kullanıcı isteği, 28.08.2026:
        // "yazdırdaki raporun birebir aynısı"). Tarayıcının yazdırma motoru
        // aynı belgeyi basar: yazı tipi, ölçü, hiza, @media print kuralları
        // birebir tutar.
        if (!string.IsNullOrWhiteSpace(g.Html))
            pdf = HtmlPdf.Uret(g.Html!, gunluk);

        // 2. YOL — yazdırma motoru yoksa sunucu tabloyu kendi dizer. Görünüm
        // birebir değildir ama posta yine ekli gider (sessizce boş kalmasın).
        if (pdf is null && g.Bolumler is { Length: > 0 })
        {
            var bolumler = g.Bolumler.Select(b => new RaporPdf.Bolum(
                b.Ad ?? string.Empty,
                b.Sutunlar ?? Array.Empty<string>(),
                b.Satirlar ?? Array.Empty<string[]>(),
                b.SagaYasli)).ToList();
            pdf = RaporPdf.Uret(g.Baslik ?? "Rapor", g.AltBaslik ?? string.Empty, bolumler);
            gunluk.LogInformation("PDF sunucu dizgisiyle üretildi (yazdırma motoru yok).");
        }

        /* ALICI BAŞINA SONUÇ (kullanıcı isteği, 28.08.2026): ekran gönderim
           sonrası pencerede kimin aldığını, kimin neden almadığını yazar.
           Hepsi başarısızsa 502 döner — ekran o zaman hata dili kullanır. */
        var sonuclar = postaci.GonderTekTek(g.Alicilar, g.Konu ?? "Rapor",
                                            g.Mesaj ?? string.Empty, pdf, ekAdi, kimlik);
        var basarili = sonuclar.Count(s => s.Tamam);
        var govde = new
        {
            gonderildi = basarili,
            basarisiz = sonuclar.Count - basarili,
            sonuclar = sonuclar.Select(s => new { adres = s.Adres, tamam = s.Tamam, hata = s.Hata }),
            ekBoyu = pdf?.Length ?? 0,
            gonderen = kimlik?.Adres
        };
        return basarili > 0 ? Results.Ok(govde) : Results.Json(govde, statusCode: 502);
    }
    catch (Exception e)
    {
        // Sebep kullanıcıya OLDUĞU GİBİ döner: "parola yanlış", "sunucuya
        // ulaşılamadı" gibi hataları ekranda görmeden düzeltmek imkânsız.
        gunluk.LogError(e, "Posta gönderilemedi");
        return Results.Json(new { hata = e.Message }, statusCode: 502);
    }
});

/// OUTLOOK TASLAĞI (kullanıcı direktifi, 03.09.2026): tarayıcının kurduğu
/// .eml diske yazılır ve yeni Outlook'a verilir (EmlTaslak). Pencere
/// sunucunun makinesinde açıldığı için uç yalnız loopback kabul eder; uzak
/// istekler 403 alır ve istemci dosyayı kendisi indirir. Önceki hâli (PDF
/// ekli MAPI/.eml penceresi, 28.08.2026) kaldırıldı.
var taslakAdi = new System.Text.RegularExpressions.Regex(@"^[A-Za-z0-9._-]{1,120}\.eml$");
app.MapPost("/api/mail/taslak", async (HttpContext baglam, HttpRequest istek, ILogger<Program> gunluk) =>
{
    if (baglam.Connection.RemoteIpAddress is not { } ip || !System.Net.IPAddress.IsLoopback(ip))
        return Results.Json(new { hata = "Taslak yalnız sunucu makinesinde açılabilir." }, statusCode: 403);

    TaslakIstegi? g;
    try { g = await istek.ReadFromJsonAsync<TaslakIstegi>(); }
    catch (Exception e) { return Results.BadRequest(new { hata = e.Message }); }
    if (g is null || string.IsNullOrWhiteSpace(g.Eml))
        return Results.BadRequest(new { hata = "Taslak içeriği yok." });
    var ad = string.IsNullOrWhiteSpace(g.DosyaAdi) ? "rapor.eml" : g.DosyaAdi!;
    if (!taslakAdi.IsMatch(ad))
        return Results.BadRequest(new { hata = "Dosya adı geçersiz." });

    var hata = EmlTaslak.Ac(ad, g.Eml!, gunluk);
    return hata is null
        ? Results.Ok(new { acildi = true })
        : Results.Json(new { hata }, statusCode: 502);
});

/// RAPORU PDF OLARAK İNDİR (posta göndermeden).
/// Posta ayarları henüz yapılmadığında ekran bu ucu kullanır: PDF hazır
/// dosya olarak iner, kullanıcı Outlook'a sürükleyip bırakır. Ctrl+P →
/// "PDF olarak kaydet" adımları ortadan kalkar.
app.MapPost("/api/rapor/pdf", async (HttpRequest istek, ILogger<Program> gunluk) =>
{
    MailIstegi? g;
    try { g = await istek.ReadFromJsonAsync<MailIstegi>(); }
    catch (Exception e) { return Results.BadRequest(new { hata = e.Message }); }
    if (g is null) return Results.BadRequest(new { hata = "İstek gövdesi boş." });

    byte[]? pdf = null;
    if (!string.IsNullOrWhiteSpace(g.Html)) pdf = HtmlPdf.Uret(g.Html!, gunluk);
    if (pdf is null && g.Bolumler is { Length: > 0 })
    {
        var bolumler = g.Bolumler.Select(b => new RaporPdf.Bolum(
            b.Ad ?? string.Empty,
            b.Sutunlar ?? Array.Empty<string>(),
            b.Satirlar ?? Array.Empty<string[]>(),
            b.SagaYasli)).ToList();
        pdf = RaporPdf.Uret(g.Baslik ?? "Rapor", g.AltBaslik ?? string.Empty, bolumler);
    }
    if (pdf is null) return Results.Json(new { hata = "PDF üretilemedi." }, statusCode: 502);

    return Results.File(pdf, "application/pdf",
        string.IsNullOrWhiteSpace(g.DosyaAdi) ? "rapor.pdf" : g.DosyaAdi);
});

app.Run();

/// Mail isteğinin gövdesi. Ayrı tip: JsonObject ile elle ayıklamak bu kadar
/// alanda okunmaz oluyordu.
internal sealed record MailIstegi(
    string[]? Alicilar, string? Konu, string? Mesaj,
    string? Baslik, string? AltBaslik, string? DosyaAdi,
    string? Html, MailBolum[]? Bolumler);

/// Outlook taslağı isteği (03.09.2026): tarayıcının kurduğu .eml metni.
internal sealed record TaslakIstegi(string? DosyaAdi, string? Eml);

/// Mail hesabı giriş isteği.
internal sealed record HesapIstegi(
    string? Kullanici, string? Adres, string? Parola,
    string? Sunucu, int? Port, bool? Ssl);

internal sealed record MailBolum(
    string? Ad, string[]? Sutunlar, string[][]? Satirlar, bool[]? SagaYasli);

// ---------------------------------------------------------------------------

/// <summary>
/// Gecelik yedek. VACUUM INTO ile tutarlı tek dosya üretir, eskileri budar.
///
/// IIS altında çalışırken uygulama havuzu boştayken durdurulursa bu görev de
/// durur. KURULUM-NOTU.md, havuzun AlwaysRunning yapılmasını ve boşta kalma
/// zaman aşımının kapatılmasını söylüyor. Emin olmak isteyen bilgi işlem,
/// POST /api/yedek ucunu Görev Zamanlayıcı'dan çağırabilir.
/// </summary>
public sealed class GunlukYedek : BackgroundService
{
    private const int TutulacakKopya = 7;

    private readonly PaketDeposu _depo;
    private readonly ILogger<GunlukYedek> _gunluk;
    private readonly string _klasor;
    private readonly TimeSpan _saat;

    /// <summary>
    /// Klasör ve saat Program.cs'ten MUTLAK olarak verilir (BUG-013). Yapılandırma
    /// buradan okunmaz: göreli yol, Windows servisi kipinde çalışma dizini
    /// C:\Windows\System32 olduğu için yanlış klasöre yazıyordu.
    /// </summary>
    public GunlukYedek(PaketDeposu depo, string klasor, TimeSpan saat, ILogger<GunlukYedek> gunluk)
    {
        _depo = depo;
        _gunluk = gunluk;
        _klasor = klasor;
        _saat = saat;
    }

    protected override async Task ExecuteAsync(CancellationToken dur)
    {
        while (!dur.IsCancellationRequested)
        {
            var simdi = DateTimeOffset.Now;
            var hedef = simdi.Date.Add(_saat);
            if (hedef <= simdi.DateTime) hedef = hedef.AddDays(1);

            try
            {
                await Task.Delay(hedef - simdi.DateTime, dur);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            try
            {
                var uretilen = _depo.Yedekle(_klasor, DateTimeOffset.Now);

                // DENETİM ÜRETİLEN YEDEK DOSYASINDA KOŞAR (BUG-013/014,
                // 30.08.2026). Eskiden Yedekle'nin döndürdüğü yol atılıyor ve
                // Denetle() canlı veritabanını açıyordu — yedeğin kendisi hiç
                // sınanmıyordu. Bozuk bir yedek "sağlam" görünüp rotasyonda
                // sağlam kopyaları düşürebiliyordu.
                var d = _depo.Denetle(uretilen);
                // Bozuk yedek eskisini düşürmez: sonuç 'ok' değilse budama
                // yapılmaz ve önceki yedekler korunur.
                if (d.Butunluk != "ok")
                {
                    _gunluk.LogError("Yedek dosyası bozuk ({Dosya}): {Sonuc} — eski yedekler korunuyor",
                        uretilen, d.Butunluk);
                    continue;
                }

                Buda();
            }
            catch (Exception e)
            {
                _gunluk.LogError(e, "Gecelik yedek alınamadı");
            }
        }
    }

    private void Buda()
    {
        if (!Directory.Exists(_klasor)) return;

        var eskiler = new DirectoryInfo(_klasor)
            .GetFiles("yu-*.db")
            .OrderByDescending(f => f.Name)
            .Skip(TutulacakKopya)
            .ToArray();

        foreach (var f in eskiler)
        {
            try { f.Delete(); }
            catch (Exception e) { _gunluk.LogWarning(e, "Eski yedek silinemedi: {Ad}", f.Name); }
        }
    }
}

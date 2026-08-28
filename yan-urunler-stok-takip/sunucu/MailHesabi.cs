using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace YanUrunler.Sunucu;

/*  MailHesabi — kullanıcının kendi posta hesabıyla giriş yapması.

    NEDEN (kullanıcı direktifi, 28.08.2026: "hiç açılmasın Outlook falan
    filan, direkt programdan mail ile giriş yap kısmı olsun"): posta,
    kullanıcının KENDİ adresinden çıkacak ve hiçbir posta uygulaması
    açılmayacak. Bunun tek yolu, sunucunun o kullanıcının posta kutusuna
    SMTP ile bağlanmasıdır — yani kullanıcının bir kere giriş yapması.

    PAROLA DEĞİL "UYGULAMA PAROLASI" istenir. Asıl parola hiçbir yerde
    tutulmaz; uygulama parolası yalnız posta göndermeye yarar ve kullanıcı
    dilediğinde sağlayıcının panelinden tek başına iptal eder.

    NEREDE DURUR: sekiz tablo sözleşmesine (Şartname §6) dokunulmaz —
    alıcı listesinde olduğu gibi AYRI bir dosyada durur. Parola diske düz
    yazılmaz: Windows DPAPI ile makineye bağlı şifrelenir; dosya başka
    bilgisayara kopyalansa çözülemez.

    KULLANICI BAŞINA: anahtar, uygulamanın kendi kullanıcı Id'sidir. Üç
    kişi aynı programı kullanıyor ve her biri kendi adresinden gönderir.  */
public sealed class MailHesabi
{
    public sealed record Kayit(string Adres, string Sunucu, int Port, bool Ssl, string ParolaSifreli);

    /// <summary>Ekrana dönen güvenli özet — parola asla dönmez.</summary>
    public sealed record Ozet(string Adres, string Sunucu, int Port, bool Ssl);

    private readonly string _dosya;
    private readonly ILogger<MailHesabi> _gunluk;
    private readonly object _kilit = new();

    public MailHesabi(IConfiguration yapilandirma, ILogger<MailHesabi> gunluk)
    {
        _gunluk = gunluk;
        var veri = yapilandirma.GetSection("YanUrunler")["VeriDosyasi"];
        var klasor = string.IsNullOrWhiteSpace(veri)
            ? AppContext.BaseDirectory
            : (Path.GetDirectoryName(Path.GetFullPath(veri)) ?? AppContext.BaseDirectory);
        Directory.CreateDirectory(klasor);
        _dosya = Path.Combine(klasor, "mail-hesaplari.json");
    }

    /* ---------- sağlayıcıya göre sunucu tahmini ---------- */

    /*  Kullanıcı sunucu adını ezberlemek zorunda kalmasın: adresin alan
        adından bilinen sağlayıcı tanınır. Tanınmayan alan adında "smtp."
        öneki denenir — kurumsal sunucuların çoğu böyledir; yanlışsa
        kullanıcı ekranda düzeltir. */
    private static readonly Dictionary<string, (string Sunucu, int Port)> Bilinen = new(StringComparer.OrdinalIgnoreCase)
    {
        ["gmail.com"] = ("smtp.gmail.com", 587),
        ["googlemail.com"] = ("smtp.gmail.com", 587),
        ["yandex.com"] = ("smtp.yandex.com", 587),
        ["yandex.com.tr"] = ("smtp.yandex.com", 587),
        ["yaani.com"] = ("smtp.yaani.com", 587),
        ["yahoo.com"] = ("smtp.mail.yahoo.com", 587)
    };

    /*  SMTP'yi PAROLAYLA kabul etmeyen sağlayıcılar. Kullanıcı burada
        boşuna uğraşmasın diye giriş denenmeden söylenir — ölçüldü ve
        doğrulandı (28.08.2026): Microsoft, Outlook.com kişisel hesaplarında
        SMTP için parola ve uygulama parolasını kaldırdı, yalnız OAuth
        kabul ediyor. */
    private static readonly HashSet<string> Desteklenmeyen = new(StringComparer.OrdinalIgnoreCase)
    {
        "outlook.com", "hotmail.com", "hotmail.com.tr", "live.com", "msn.com", "outlook.com.tr"
    };

    public static string? DesteklenmeyenMi(string adres)
    {
        var alan = AlanAdi(adres);
        if (alan is null) return null;
        return Desteklenmeyen.Contains(alan)
            ? alan + " adresleri programdan gönderim için parola kabul etmiyor (Microsoft yalnız OAuth'a izin veriyor). " +
              "Gmail, kurumsal adresiniz ya da başka bir sağlayıcı kullanın."
            : null;
    }

    public static (string Sunucu, int Port) SunucuTahmini(string adres)
    {
        var alan = AlanAdi(adres);
        if (alan is null) return ("", 587);
        return Bilinen.TryGetValue(alan, out var b) ? b : ("smtp." + alan, 587);
    }

    private static string? AlanAdi(string? adres)
    {
        var a = adres ?? string.Empty;
        var i = a.LastIndexOf('@');
        return i > 0 && i < a.Length - 1 ? a[(i + 1)..].Trim() : null;
    }

    /* ---------- saklama ---------- */

    private Dictionary<string, Kayit> Oku()
    {
        lock (_kilit)
        {
            if (!File.Exists(_dosya)) return new Dictionary<string, Kayit>();
            try
            {
                var ham = File.ReadAllText(_dosya, Encoding.UTF8);
                return JsonSerializer.Deserialize<Dictionary<string, Kayit>>(ham)
                       ?? new Dictionary<string, Kayit>();
            }
            catch (Exception e)
            {
                _gunluk.LogWarning(e, "Mail hesapları okunamadı; boş kabul edildi.");
                return new Dictionary<string, Kayit>();
            }
        }
    }

    private void Yaz(Dictionary<string, Kayit> hepsi)
    {
        lock (_kilit)
        {
            File.WriteAllText(_dosya,
                JsonSerializer.Serialize(hepsi, new JsonSerializerOptions { WriteIndented = true }),
                Encoding.UTF8);
        }
    }

    public Ozet? Getir(string kullanici)
    {
        var k = Oku().GetValueOrDefault(Anahtar(kullanici));
        return k is null ? null : new Ozet(k.Adres, k.Sunucu, k.Port, k.Ssl);
    }

    public void Kaydet(string kullanici, string adres, string sunucu, int port, bool ssl, string parola)
    {
        var hepsi = Oku();
        hepsi[Anahtar(kullanici)] = new Kayit(adres, sunucu, port, ssl, Sifrele(parola));
        Yaz(hepsi);
        _gunluk.LogInformation("Mail hesabı kaydedildi: {Adres}", adres);
    }

    public bool Sil(string kullanici)
    {
        var hepsi = Oku();
        if (!hepsi.Remove(Anahtar(kullanici))) return false;
        Yaz(hepsi);
        return true;
    }

    /// <summary>Gönderim için gereken tam bilgi (parola çözülmüş).</summary>
    public (string Adres, string Sunucu, int Port, bool Ssl, string Parola)? Kimlik(string kullanici)
    {
        var k = Oku().GetValueOrDefault(Anahtar(kullanici));
        if (k is null) return null;
        var p = Coz(k.ParolaSifreli);
        return p is null ? null : (k.Adres, k.Sunucu, k.Port, k.Ssl, p);
    }

    private static string Anahtar(string kullanici)
        => string.IsNullOrWhiteSpace(kullanici) ? "_ortak" : kullanici.Trim().ToLowerInvariant();

    /* ---------- şifreleme ---------- */

    /*  DPAPI (CurrentUser kapsamı): şifreli metin YALNIZ bu Windows
        kullanıcısında ve bu makinede çözülür. Dosya çalınsa da parola
        okunamaz. Windows dışı bir ortamda çalıştırılırsa şifreleme
        yapılamaz — o durumda hesap kaydı reddedilir, düz parola yazılmaz. */
    private static string Sifrele(string metin)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("Parola şifrelemesi yalnız Windows'ta desteklenir.");
        var korunan = ProtectedData.Protect(
            Encoding.UTF8.GetBytes(metin), null, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(korunan);
    }

    private string? Coz(string sifreli)
    {
        try
        {
            if (!OperatingSystem.IsWindows()) return null;
            var acik = ProtectedData.Unprotect(
                Convert.FromBase64String(sifreli), null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(acik);
        }
        catch (Exception e)
        {
            // Dosya başka makineden geldiyse buraya düşer: hesap yeniden
            // girilmelidir, sessizce yanlış parolayla denenmez.
            _gunluk.LogWarning(e, "Kayıtlı parola çözülemedi; hesap yeniden girilmeli.");
            return null;
        }
    }
}

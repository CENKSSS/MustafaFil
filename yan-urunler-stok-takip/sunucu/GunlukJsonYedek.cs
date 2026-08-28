using System.Text.RegularExpressions;

namespace YanUrunler.Sunucu;

/*  GunlukJsonYedek — tarayıcının tıklamasız günlük yedek özelliğinin
    (js/07-yedekci.js) sunucu tarafı. .NET sunucusu 8155'e alınırken
    (kullanıcı kararı, 28.08.2026) buradaki üç uç, o ana kadar
    yan-urunler-sunucu.py'nin sağladığı sözleşmeyi BİREBİR karşılar —
    istemci hiç değişmeden çalışmaya devam eder (mustafafil-9a oturumunun
    verdiği sözleşme, aynı gün).

    Referans: yan-urunler-sunucu.py (proje kökünde). Bu sınıf onun
    birebir .NET karşılığıdır: aynı dosya adı deseni, aynı klasör, aynı
    atomik yazma (geçici dosya + taşıma — yarım dosya kalmaz).  */
public static class GunlukJsonYedek
{
    // 27.08.2026.json / _tam-paket.json / _tanimlar.json
    private static readonly Regex AdDeseni =
        new(@"^(\d{2}\.\d{2}\.\d{4}|_tam-paket|_tanimlar)\.json$", RegexOptions.Compiled);

    private const long EnBuyukGovde = 50 * 1024 * 1024; // 50 MB — tam paket ~1 MB, bol pay

    private static readonly object Kilit = new();

    /// <summary>Klasörü bulur: appsettings'te açıkça verilmişse onu kullanır;
    /// verilmemişse proje köküne (yan-urunler-stok-takip'in yanına)
    /// "gunluk-veriler" olarak yerleştirir — Python betiğiyle aynı yer.</summary>
    public static string KlasoruBul(IConfiguration yapilandirma, string icerikKoku)
    {
        var acik = yapilandirma.GetSection("YanUrunler")["GunlukYedekKlasoru"];
        if (!string.IsNullOrWhiteSpace(acik)) return acik;

        var d = new DirectoryInfo(icerikKoku);
        while (d is not null && !string.Equals(d.Name, "yan-urunler-stok-takip", StringComparison.OrdinalIgnoreCase))
            d = d.Parent;
        var kok = d?.Parent?.FullName ?? icerikKoku;
        return Path.Combine(kok, "gunluk-veriler");
    }

    public static IResult Saglik(string klasor)
    {
        var adet = Directory.Exists(klasor)
            ? Directory.EnumerateFiles(klasor).Count(f => AdDeseni.IsMatch(Path.GetFileName(f)))
            : 0;
        return Results.Ok(new { durum = "ok", klasor, adet });
    }

    public static IResult Dosya(string klasor, string ad)
    {
        if (string.IsNullOrEmpty(ad) || !AdDeseni.IsMatch(ad))
            return Results.Json(new { hata = "Geçersiz dosya adı." }, statusCode: 400);
        var tam = Path.Combine(klasor, ad);
        if (!File.Exists(tam))
            return Results.Json(new { hata = ad + " yok." }, statusCode: 404);
        return Results.File(tam, "application/json; charset=utf-8");
    }

    public static IResult Yaz(string klasor, IEnumerable<GunlukYedekDosya> dosyalar)
    {
        var yazilan = new List<string>();
        var hatali = new List<string>();

        lock (Kilit)
        {
            Directory.CreateDirectory(klasor);
            foreach (var d in dosyalar)
            {
                var ad = d.Ad ?? string.Empty;
                if (!AdDeseni.IsMatch(ad) || d.Metin is null)
                {
                    hatali.Add(string.IsNullOrEmpty(ad) ? "(adsız)" : ad);
                    continue;
                }
                var tam = Path.Combine(klasor, ad);
                var gecici = tam + ".tmp";
                try
                {
                    // newline "\n" sabit: Python'un "w", newline="\n" açılışıyla
                    // aynı bayt dizisini üretir — dosya karşılaştırması sapmaz.
                    File.WriteAllText(gecici, d.Metin, new System.Text.UTF8Encoding(false));
                    File.Move(gecici, tam, overwrite: true); // atomik: yarım dosya kalmaz
                    yazilan.Add(ad);
                }
                catch (Exception e)
                {
                    hatali.Add(ad + " (" + e.Message + ")");
                    try { if (File.Exists(gecici)) File.Delete(gecici); } catch { /* yoksay */ }
                }
            }
        }

        var kod = hatali.Count == 0 ? 200 : 500;
        return Results.Json(new { yazilan, hatali }, statusCode: kod);
    }
}

public sealed record GunlukYedekDosya(string? Ad, string? Metin);
public sealed record GunlukYedekIstegi(GunlukYedekDosya[]? Dosyalar);

using System.Text;
using System.Text.RegularExpressions;

namespace YanUrunler.Sunucu;

/// <summary>
/// index.html'i SÜRÜM DAMGALI servis eder (kullanıcı isteği, 31.08.2026).
///
/// KUSUR: uygulama güncellenip sunucuya yeni dosyalar konduğunda tarayıcılar
/// ESKİ .js/.css kopyasını çalıştırmaya devam ediyordu — "düzelttim ama
/// ekranda aynı". Cache-Control başlıkları yalnız YENİ yanıtlar için çalışır;
/// tarayıcıda hâlihazırda duran kopyayı atmaz. Kalıcı çözüm ADRESİN KENDİSİNİ
/// değiştirmektir.
///
/// ÇÖZÜM: index.html okunur, her js/css bağlantısına o dosyanın değişiklik
/// zamanı "?s=" olarak eklenir. Dosya değişince adres değişir, tarayıcı
/// mecburen yeniden indirir. Dosya değişmezse adres aynı kalır ve önbellek
/// çalışmaya devam eder — gereksiz indirme olmaz.
///
/// Diskteki index.html'e DOKUNULMAZ; damga yalnız yanıtta vardır. Elle sürüm
/// numarası artırmak gerekmez, yayın adımı eklenmez.
///
/// Geliştirme sunucusundaki (yan-urunler-sunucu.py · _index_gonder) aynı
/// davranışın .NET karşılığıdır; ikisi aynı "?s=" biçimini üretir.
/// </summary>
public static class IndexDamgaci
{
    private static readonly Regex Baglanti =
        new(@"(?<onek>(?:src|href)="")(?<yol>(?:js|css)/[^""?]+)",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly object Kilit = new();
    private static string? _onbellek;
    private static long _onbellekAnahtari = -1;

    /// <summary>
    /// "/" ve "/index.html" isteklerini karşılar. UseDefaultFiles/UseStaticFiles
    /// çağrılarından ÖNCE bağlanmalıdır: statik ara katman önce çalışırsa
    /// index.html damgasız gider. Bu yüzden uç (MapGet) değil ARA KATMANDIR —
    /// uçlar boru hattının sonunda çalışır, statik dosyalardan sonra.
    /// </summary>
    public static void Bagla(WebApplication app)
    {
        app.Use(async (baglam, sonraki) =>
        {
            var istenen = baglam.Request.Path.Value ?? string.Empty;
            // HEAD de karşılanır: aksi hâlde HEAD damgasız dosyayı, GET damgalı
            // metni döner ve Content-Length'ler tutmaz. Gövdeyi Kestrel eler.
            var bizimki = (HttpMethods.IsGet(baglam.Request.Method) ||
                           HttpMethods.IsHead(baglam.Request.Method)) &&
                (istenen == "/" || istenen.Equals("/index.html", StringComparison.OrdinalIgnoreCase));

            if (!bizimki) { await sonraki(); return; }

            var ortam = baglam.RequestServices.GetRequiredService<IWebHostEnvironment>();
            var metin = Uret(ortam);
            if (metin is null) { await sonraki(); return; }   // dosya yoksa normal akış

            // index.html'in kendisi hiç önbelleğe alınmaz: damgaları o taşıyor,
            // eskirse bütün mekanizma çalışmaz.
            baglam.Response.Headers.CacheControl = "no-store, must-revalidate";
            baglam.Response.ContentType = "text/html; charset=utf-8";
            await baglam.Response.WriteAsync(metin, Encoding.UTF8);
        });
    }

    private static string? Uret(IWebHostEnvironment ortam)
    {
        var kok = ortam.WebRootPath;
        if (string.IsNullOrEmpty(kok)) kok = Path.Combine(ortam.ContentRootPath, "wwwroot");

        var indexYolu = Path.Combine(kok, "index.html");
        if (!File.Exists(indexYolu)) return null;

        // Önbellek anahtarı: index.html + js/ + css/ içindeki en yeni değişiklik
        // zamanı. Herhangi bir dosya değişince anahtar değişir ve metin yeniden
        // kurulur. Değişmedikçe her istekte klasör taranmaz.
        var anahtar = EnYeniDamga(kok, indexYolu);

        lock (Kilit)
        {
            if (_onbellek is null || _onbellekAnahtari != anahtar)
            {
                _onbellek = Damgala(File.ReadAllText(indexYolu, Encoding.UTF8), kok);
                _onbellekAnahtari = anahtar;
            }
            return _onbellek;
        }
    }

    private static string Damgala(string metin, string kok)
    {
        return Baglanti.Replace(metin, esles =>
        {
            var yol = esles.Groups["yol"].Value;
            var tam = Path.Combine(kok, yol.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(tam)) return esles.Value;   // dosya yoksa dokunma
            var damga = new DateTimeOffset(File.GetLastWriteTimeUtc(tam)).ToUnixTimeSeconds();
            return esles.Groups["onek"].Value + yol + "?s=" + damga.ToString();
        });
    }

    private static long EnYeniDamga(string kok, string indexYolu)
    {
        var enYeni = new DateTimeOffset(File.GetLastWriteTimeUtc(indexYolu)).ToUnixTimeSeconds();
        foreach (var klasor in new[] { "js", "css" })
        {
            var yol = Path.Combine(kok, klasor);
            if (!Directory.Exists(yol)) continue;
            foreach (var dosya in Directory.EnumerateFiles(yol, "*", SearchOption.AllDirectories))
            {
                var d = new DateTimeOffset(File.GetLastWriteTimeUtc(dosya)).ToUnixTimeSeconds();
                if (d > enYeni) enYeni = d;
            }
        }
        return enYeni;
    }
}

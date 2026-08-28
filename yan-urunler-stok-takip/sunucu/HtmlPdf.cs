using System.Diagnostics;

namespace YanUrunler.Sunucu;

/*  HtmlPdf — rapor HTML'ini TARAYICININ KENDİ yazdırma motoruyla PDF'e çevirir.

    NEDEN BÖYLE (kullanıcı isteği, 28.08.2026: "yazdırdaki raporun birebir
    aynısını göndermek istiyorum — yazı boyutu, fontu, hizaları"):
    Sunucuda tabloyu yeniden dizmek (RaporPdf) BENZER çıktı verir, aynısını
    vermez; yazı ölçüsü, kolon genişliği ve hizalar kaçınılmaz olarak ayrışır.
    Tek "birebir" yol, kullanıcının Ctrl+P ile bastığı HTML'i AYNI motorla
    bastırmaktır. Ekran hangi HTML'i açıyorsa (35-mail-gonder · raporHtml)
    sunucuya o gelir; burada Edge/Chrome "--headless --print-to-pdf" ile aynı
    belgeyi basar. CSS, @media print kuralları, font — hepsi aynı.

    KURULUM YÜKÜ YOK: Windows 11 ve Windows Server'da Edge kuruludur; ayrıca
    bir şey indirilmez (PuppeteerSharp ~150 MB Chromium indirirdi).
    Tarayıcı bulunamazsa çağıran taraf RaporPdf'e düşer — posta yine gider.  */
public static class HtmlPdf
{
    private static readonly string[] AdaylarWindows =
    {
        @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        @"C:\Program Files\Google\Chrome\Application\chrome.exe",
        @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    };

    /// <summary>Yazdırma motoru bulundu mu? Bulunamazsa Uret() null döner.</summary>
    public static string? TarayiciYolu()
    {
        foreach (var y in AdaylarWindows)
            if (File.Exists(y)) return y;
        return null;
    }

    /// <summary>HTML'i PDF'e çevirir. Motor yoksa ya da iş bitmezse null.</summary>
    public static byte[]? Uret(string html, ILogger gunluk, int zamanAsimiSn = 45)
    {
        var tarayici = TarayiciYolu();
        if (tarayici is null)
        {
            gunluk.LogWarning("Yazdırma motoru (Edge/Chrome) bulunamadı; sunucu dizgisine düşülüyor.");
            return null;
        }

        // Her iş kendi geçici klasöründe çalışır: aynı anda iki kullanıcı
        // gönderirse dosyalar birbirine karışmaz.
        var klasor = Path.Combine(Path.GetTempPath(), "yanurunler-pdf-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(klasor);
        var htmlYolu = Path.Combine(klasor, "rapor.html");
        var pdfYolu = Path.Combine(klasor, "rapor.pdf");

        try
        {
            File.WriteAllText(htmlYolu, html, new System.Text.UTF8Encoding(true));

            var bilgi = new ProcessStartInfo
            {
                FileName = tarayici,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardError = true,
                RedirectStandardOutput = true
            };
            // --user-data-dir: sunucu hesabının profili olmayabilir; kendi
            // geçici profilini kullanır. --no-pdf-header-footer: tarayıcının
            // kendi üstbilgisi (tarih/URL) kâğıda basılmaz — kullanıcı
            // 28.08.2026'da ekrandaki o satırın kalkmasını istemişti.
            bilgi.ArgumentList.Add("--headless=new");
            bilgi.ArgumentList.Add("--disable-gpu");
            bilgi.ArgumentList.Add("--no-sandbox");
            bilgi.ArgumentList.Add("--user-data-dir=" + Path.Combine(klasor, "profil"));
            bilgi.ArgumentList.Add("--no-pdf-header-footer");
            bilgi.ArgumentList.Add("--print-to-pdf=" + pdfYolu);
            bilgi.ArgumentList.Add(new Uri(htmlYolu).AbsoluteUri);

            using var surec = Process.Start(bilgi);
            if (surec is null) return null;
            if (!surec.WaitForExit(zamanAsimiSn * 1000))
            {
                try { surec.Kill(true); } catch { /* zaten bitmiş olabilir */ }
                gunluk.LogWarning("Yazdırma motoru {Sn} sn içinde bitmedi.", zamanAsimiSn);
                return null;
            }

            if (!File.Exists(pdfYolu))
            {
                gunluk.LogWarning("Yazdırma motoru PDF üretmedi: {Hata}", surec.StandardError.ReadToEnd());
                return null;
            }

            var baytlar = File.ReadAllBytes(pdfYolu);
            return baytlar.Length > 4 ? baytlar : null;
        }
        catch (Exception e)
        {
            gunluk.LogWarning(e, "HTML'den PDF üretilemedi.");
            return null;
        }
        finally
        {
            try { Directory.Delete(klasor, true); } catch { /* geçici klasör, kalırsa da zarar yok */ }
        }
    }
}

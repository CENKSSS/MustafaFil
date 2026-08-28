using System.Diagnostics;
using System.Net.Mail;
using System.Net.Mime;

namespace YanUrunler.Sunucu;

/*  EmlTaslak — Outlook'u RAPOR PDF'İ EKLİ bir taslakla açar.

    NEDEN MAPI DEĞİL (kullanıcı bildirimi, 28.08.2026 — ekranda
    "Microsoft Outlook profili oluşturmanız gerekiyor" penceresi çıktı):
    Simple MAPI çağrısı, MAPI istemcisi olarak kayıtlı KLASİK Outlook'a
    (msmapi32.dll) gider. Bu makinede ölçüldü:
      · klasik Outlook kurulu ama MAPI PROFİLİ YOK
        (HKCU\...\Office\16.0\Outlook\Profiles altı boş),
      · kullanıcı YENİ Outlook'u (Microsoft.OutlookForWindows) kullanıyor,
      · yeni Outlook Simple MAPI'yi hiç desteklemiyor.
    Yani MAPI bu makinede prensip olarak çalışamaz.

    BU YOL: RFC 822 biçiminde bir .eml dosyası yazılır ve Windows'un
    varsayılan uygulamasıyla açılır. Başlıklara "X-Unsent: 1" konur —
    Outlook bu başlığı gören iletiyi OKUMA penceresinde değil, GÖNDERİLEBİLİR
    TASLAK penceresinde açar. Alıcı, konu, mesaj ve PDF eki hazır gelir;
    kullanıcı yalnız Gönder'e basar. Profil gerektirmez.

    .eml'i SmtpClient'ın "pickup directory" kipi yazar: MIME kodlaması
    (Türkçe harfler, base64 ek) .NET'in kendi kodundan çıkar, elle MIME
    kurmayız.  */
public static class EmlTaslak
{
    /*  KULLANILABİLİR Mİ? — ölçülen koşul: .eml dosyasını Windows KLASİK
        Outlook'a veriyor (HKLM\...\Outlook.File.eml.15 → OUTLOOK.EXE /eml)
        ve klasik Outlook POSTA PROFİLİ olmadan açılmıyor. Profil yoksa
        kullanıcı "Outlook profili oluşturmanız gerekiyor" penceresiyle
        karşılaşıyor, ileti de eksiz açılıyor (kullanıcı bildirimi,
        28.08.2026). Bu yüzden yol yalnız PROFİL VARSA açık sayılır.

        Kendini onarır: kullanıcı Denetim Masası → Posta'dan bir profil
        kurduğunda koşul kendiliğinden sağlanır, ekran taslak yoluna geçer.
        Yeni Outlook (olk.exe) Simple MAPI ve .eml ekini desteklemediği için
        burada ölçüt klasik Outlook profilidir.  */
    public static bool Kullanilabilir()
    {
        if (!OperatingSystem.IsWindows()) return false;
        string[] yollar =
        {
            @"Software\Microsoft\Office\16.0\Outlook\Profiles",
            @"Software\Microsoft\Windows NT\CurrentVersion\Windows Messaging Subsystem\Profiles"
        };
        foreach (var y in yollar)
        {
            try
            {
                using var k = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(y);
                if (k is not null && k.GetSubKeyNames().Length > 0) return true;
            }
            catch { /* erişilemiyorsa yok say */ }
        }
        return false;
    }

    /// <summary>Taslağı açar. Sorun olursa sebebi döner, olmazsa null.</summary>
    public static string? Ac(IEnumerable<string> alicilar, string konu, string govde,
                             string ekYolu, ILogger gunluk)
    {
        var adresler = alicilar.Where(a => !string.IsNullOrWhiteSpace(a))
                               .Select(a => a.Trim()).ToArray();
        if (adresler.Length == 0) return "Alıcı yok.";
        if (!File.Exists(ekYolu)) return "Rapor dosyası bulunamadı.";
        if (!Kullanilabilir())
            return "Bu bilgisayarda Outlook posta profili yok; taslak eki taşıyamıyor.";

        var klasor = Path.Combine(Path.GetTempPath(), "YanUrunlerRapor");
        Directory.CreateDirectory(klasor);

        try
        {
            EskiTaslaklariSil(klasor);

            using var ileti = new MailMessage
            {
                // From yalnız MIME'ın geçerli olması için gerekir; Outlook
                // taslağı kendi hesabıyla açar ve bu satırı kullanmaz.
                From = new MailAddress("rapor@yanurunler.local", "Yan Ürünler Stok Takip"),
                Subject = konu,
                Body = govde,
                IsBodyHtml = false,
                SubjectEncoding = System.Text.Encoding.UTF8,
                BodyEncoding = System.Text.Encoding.UTF8
            };
            foreach (var a in adresler) ileti.To.Add(new MailAddress(a));

            // Taslak (gönderilmemiş) işareti — Outlook'un düzenlenebilir
            // pencerede açmasını sağlayan tek şey budur.
            ileti.Headers.Add("X-Unsent", "1");

            using var akis = new FileStream(ekYolu, FileMode.Open, FileAccess.Read);
            var ek = new Attachment(akis, Path.GetFileName(ekYolu), MediaTypeNames.Application.Pdf);
            ileti.Attachments.Add(ek);

            using (var yazici = new SmtpClient
            {
                DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory,
                PickupDirectoryLocation = klasor
            })
            {
                yazici.Send(ileti);
            }

            // Pickup kipi dosyayı rastgele bir GUID adıyla bırakır; en yeni
            // .eml bizimkidir. Okunur bir ada çevrilir: Outlook pencere
            // başlığında dosya adı görünebiliyor.
            var uretilen = new DirectoryInfo(klasor).GetFiles("*.eml")
                             .OrderByDescending(f => f.LastWriteTimeUtc).FirstOrDefault();
            if (uretilen is null) return "Taslak dosyası oluşturulamadı.";

            var hedef = Path.Combine(klasor,
                Path.GetFileNameWithoutExtension(ekYolu) + ".eml");
            if (File.Exists(hedef)) File.Delete(hedef);
            File.Move(uretilen.FullName, hedef);

            Process.Start(new ProcessStartInfo(hedef) { UseShellExecute = true });
            gunluk.LogInformation("Taslak açıldı: {Dosya}", hedef);
            return null;
        }
        catch (Exception e)
        {
            gunluk.LogWarning(e, "Taslak penceresi açılamadı.");
            return e.Message;
        }
    }

    /*  Klasör şişmesin: bir saatten eski taslaklar silinir. Outlook açık
        dosyayı kilitlemiş olabilir — silinemeyen atlanır, hata sayılmaz. */
    private static void EskiTaslaklariSil(string klasor)
    {
        var sinir = DateTime.UtcNow.AddHours(-1);
        foreach (var f in new DirectoryInfo(klasor).GetFiles("*.eml"))
        {
            if (f.LastWriteTimeUtc >= sinir) continue;
            try { f.Delete(); } catch { /* kilitliyse dursun */ }
        }
    }
}

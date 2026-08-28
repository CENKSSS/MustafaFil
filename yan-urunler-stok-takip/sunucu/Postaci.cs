using System.Net;
using System.Net.Mail;

namespace YanUrunler.Sunucu;

/*  Postaci — SMTP ile posta gönderir.

    NEDEN SUNUCUDAN: tarayıcı elinde yalnız mailto: vardır ve mailto DOSYA
    EKLEYEMEZ (35-mail-gonder.js başındaki not). Kullanıcı kararı 28.08.2026:
    "mailde raporun PDF hali, başlık ve benim yazım olmalı" — bu ancak
    postayı sunucunun göndermesiyle olur.

    EK BAĞIMLILIK YOK: System.Net.Mail .NET'in içindedir. SmtpClient "eski"
    diye işaretlidir ama basit SMTP gönderimi için desteklenmeye devam eder;
    OAuth2 gereken bir posta sunucusu çıkarsa MailKit'e geçilir.

    AYARLAR appsettings.json · "Mail" bölümünde durur. Parola KODA YAZILMAZ.  */
public sealed class Postaci
{
    public sealed record Ayar(
        string Sunucu, int Port, bool Ssl,
        string Kullanici, string Parola,
        string Gonderen, string GonderenAd);

    private readonly Ayar _ayar;
    private readonly ILogger<Postaci> _gunluk;

    public Postaci(IConfiguration yapilandirma, ILogger<Postaci> gunluk)
    {
        _gunluk = gunluk;
        var b = yapilandirma.GetSection("Mail");
        _ayar = new Ayar(
            b["Sunucu"] ?? string.Empty,
            int.TryParse(b["Port"], out var p) ? p : 587,
            !string.Equals(b["Ssl"], "false", StringComparison.OrdinalIgnoreCase),
            b["Kullanici"] ?? string.Empty,
            b["Parola"] ?? string.Empty,
            b["Gonderen"] ?? b["Kullanici"] ?? string.Empty,
            b["GonderenAd"] ?? "Yan Ürünler Stok Takip");
    }

    /// <summary>appsettings'te kurumsal hesap tanımlı mı? Kullanıcı kendi
    /// hesabıyla giriş yaptıysa buna bakılmaz.</summary>
    public bool Hazir => !string.IsNullOrWhiteSpace(_ayar.Sunucu)
                      && !string.IsNullOrWhiteSpace(_ayar.Gonderen);

    /*  HESABI SINAR: bağlanır, kimlik doğrular. Sonuç null ise hesap
        çalışıyordur; değilse dönen cümle kullanıcıya OLDUĞU GİBİ gösterilir.

        Sınama kullanıcının KENDİNE bir ileti gönderir — System.Net.Mail'de
        "yalnız kimlik doğrula" diye bir çağrı yok. Konusu bunu açıkça
        söyler ki gelen kutusunda anlamsız bir posta gibi durmasın. */
    public static string? Sina(string sunucu, int port, bool ssl, string kullanici, string parola)
    {
        try
        {
            using var istemci = new SmtpClient(sunucu, port) { EnableSsl = ssl, Timeout = 25000 };
            istemci.Credentials = new NetworkCredential(kullanici, parola);
            using var deneme = new MailMessage
            {
                From = new MailAddress(kullanici),
                Subject = "Yan Ürünler Stok Takip — bağlantı sınaması",
                Body = "Bu ileti, programa mail ile giriş yapılırken otomatik gönderildi. " +
                       "Hesabın çalıştığını doğrular; başka bir anlamı yoktur."
            };
            deneme.To.Add(new MailAddress(kullanici));
            istemci.Send(deneme);
            return null;
        }
        catch (SmtpException e)
        {
            return SmtpHatasi(e);
        }
        catch (Exception e)
        {
            return "Bağlanılamadı: " + e.Message;
        }
    }

    /*  SMTP hatasını okunur cümleye çevirir.

        DİKKAT — 530 KODU İKİ ANLAMLIDIR (ölçüldü, 28.08.2026): Gmail hem
        "STARTTLS gerekli" hem "kimlik doğrulaması gerekli" için 530 döner.
        Yalnız koda bakan bir ayrım, yanlış parolayı "SSL kutusunu işaretle"
        diye raporluyordu. Bu yüzden önce MESAJIN İÇİNE bakılır. */
    private static string SmtpHatasi(SmtpException e)
    {
        /* Tüm zinciri gezer — .NET'in "Failure sending mail." dış mesajı
           genelde bir şey söylemez, asıl sebep InnerException'da durur
           (ölçüldü, 28.08.2026: yanlış sunucuya bağlanınca dış mesaj hep
           bu genel cümleydi, gerçek sebep SocketException'daydı). */
        var m = e.Message;
        for (var ic = e.InnerException; ic is not null; ic = ic.InnerException)
            m += " " + ic.Message;
        bool Icerir(string s) => m.Contains(s, StringComparison.OrdinalIgnoreCase);

        if (Icerir("No such host") || Icerir("does not exist"))
            return "Sunucu adresi bulunamadı — SMTP Sunucusu kutusunu kontrol edin.";

        if (Icerir("actively refused") || Icerir("connect"))
            return "Sunucuya bağlanılamadı — sunucu adresi ya da port yanlış olabilir.";

        if (Icerir("timed out") || Icerir("timeout"))
            return "Sunucu yanıt vermedi (zaman aşımı) — adres, port ya da ağ bağlantısını kontrol edin.";

        if (Icerir("STARTTLS"))
            return "Sunucu şifreli bağlantı istiyor; port 587 (TLS) ya da 465 deneyin.";

        if (Icerir("5.7.8") || Icerir("535") || Icerir("Username and Password not accepted") ||
            Icerir("authentication") || Icerir("Authentication Required") ||
            e.StatusCode == SmtpStatusCode.ClientNotPermitted)
            return "Adres ya da uygulama parolası kabul edilmedi. " +
                   "Asıl parolanı değil, sağlayıcının ürettiği uygulama parolasını yaz " +
                   "(Gmail'de iki adımlı doğrulama açık olmalı). " +
                   "SMTP Sunucusu kutusunun adresle eşleştiğini de kontrol edin.";

        if (Icerir("5.7.0") || e.StatusCode == SmtpStatusCode.MustIssueStartTlsFirst)
            return "Sunucu girişi reddetti (5.7.0). Uygulama parolası doğru mu, " +
                   "hesapta SMTP izni açık mı kontrol edin.";

        return "Sunucu hatası: " + m.Trim();
    }

    /// Tek alıcının sonucu: gitti mi, gitmediyse neden.
    public sealed record Sonuc(string Adres, bool Tamam, string? Hata);

    /*  ALICI BAŞINA GÖNDERİM (kullanıcı isteği, 28.08.2026: "başarılı olanlar
        başarısız olanlar nedeni yazsın").

        Eski Gonder() tüm alıcıları TEK iletinin To satırına koyuyordu: tek
        alıcı reddedilse bütün gönderim düşüyor, kimin neden düştüğü de
        bilinmiyordu. Burada her alıcıya AYRI ileti gider, sonuç tek tek
        toplanır. Bağlantı bir kez kurulur (aynı SmtpClient), yani maliyet
        neredeyse aynıdır.

        YAN ETKİ — BİLEREK: alıcılar artık birbirini To satırında GÖRMEZ.
        Kullanıcıya bildirildi.

        SINIR: SMTP "aldım" dedikten sonrasını bilemeyiz; kutusu olmayan
        adresin teslimsizliği dakikalar sonra ayrı postayla gelir
        (AlanKontrol notu).  */
    public List<Sonuc> GonderTekTek(IEnumerable<string> alicilar, string konu, string govde,
                                    byte[]? ek, string ekAdi,
                                    (string Adres, string Sunucu, int Port, bool Ssl, string Parola)? hesap = null)
    {
        var sunucu = hesap?.Sunucu ?? _ayar.Sunucu;
        var port = hesap?.Port ?? _ayar.Port;
        var ssl = hesap?.Ssl ?? _ayar.Ssl;
        var kullanici = hesap?.Adres ?? _ayar.Kullanici;
        var parola = hesap?.Parola ?? _ayar.Parola;
        var gonderen = hesap?.Adres ?? _ayar.Gonderen;
        var gonderenAd = hesap is null ? _ayar.GonderenAd : hesap.Value.Adres;

        if (string.IsNullOrWhiteSpace(sunucu) || string.IsNullOrWhiteSpace(gonderen))
            throw new InvalidOperationException(
                "Posta hesabı yok: ekrandan mail ile giriş yapın ya da appsettings.json'daki \"Mail\" bölümünü doldurun.");

        var sonuclar = new List<Sonuc>();
        using var istemci = new SmtpClient(sunucu, port) { EnableSsl = ssl, Timeout = 30000 };
        istemci.Credentials = string.IsNullOrWhiteSpace(kullanici)
            ? CredentialCache.DefaultNetworkCredentials
            : new NetworkCredential(kullanici, parola);

        foreach (var ham in alicilar)
        {
            var adres = (ham ?? string.Empty).Trim();
            if (adres.Length == 0) continue;

            MailAddress hedef;
            try { hedef = new MailAddress(adres); }
            catch { sonuclar.Add(new Sonuc(adres, false, "Adres biçimi geçersiz")); continue; }

            // Alan adı DNS'te posta almıyorsa gönderilmez — sebebi ŞİMDİ bilinir.
            var alanSorunu = AlanKontrol.Sorun(adres);
            if (alanSorunu is not null) { sonuclar.Add(new Sonuc(adres, false, alanSorunu)); continue; }

            MemoryStream? akis = null;
            try
            {
                using var ileti = new MailMessage
                {
                    From = new MailAddress(gonderen, gonderenAd),
                    Subject = konu,
                    Body = govde,
                    IsBodyHtml = false
                };
                ileti.To.Add(hedef);
                if (ek is { Length: > 0 })
                {
                    akis = new MemoryStream(ek);
                    ileti.Attachments.Add(new Attachment(akis, ekAdi, "application/pdf"));
                }
                istemci.Send(ileti);
                sonuclar.Add(new Sonuc(adres, true, null));
            }
            catch (SmtpFailedRecipientException e)
            {
                sonuclar.Add(new Sonuc(adres, false, "Alıcı reddedildi: " + e.Message));
            }
            catch (SmtpException e)
            {
                sonuclar.Add(new Sonuc(adres, false, SmtpHatasi(e)));
            }
            catch (Exception e)
            {
                sonuclar.Add(new Sonuc(adres, false, e.Message));
            }
            finally { akis?.Dispose(); }
        }

        if (sonuclar.Count == 0) throw new ArgumentException("Alıcı yok.");
        _gunluk.LogInformation("Posta: {Tamam}/{Toplam} alıcıya gitti, ek {Boy} bayt.",
            sonuclar.Count(s => s.Tamam), sonuclar.Count, ek?.Length ?? 0);
        return sonuclar;
    }

    /*  TOPLU GÖNDERİM — artık /api/mail bunu ÇAĞIRMIYOR (28.08.2026,
        GonderTekTek notu). Tüm alıcıları tek iletinin To satırına koyar;
        alıcıların birbirini görmesi gereken bir gönderim çıkarsa diye durur.

        KULLANICININ KENDİ HESABI ÖNCELİKLİDİR (kullanıcı direktifi,
        28.08.2026: "mailimi gireyim, oradan gitsin"). Ekrandan giriş
        yapılmışsa posta o adresten çıkar; yapılmamışsa appsettings'teki
        kurumsal hesap kullanılır. İkisi de yoksa gönderim denenmez. */
    public void Gonder(IEnumerable<string> alicilar, string konu, string govde,
                       byte[]? ek, string ekAdi,
                       (string Adres, string Sunucu, int Port, bool Ssl, string Parola)? hesap = null)
    {
        var sunucu = hesap?.Sunucu ?? _ayar.Sunucu;
        var port = hesap?.Port ?? _ayar.Port;
        var ssl = hesap?.Ssl ?? _ayar.Ssl;
        var kullanici = hesap?.Adres ?? _ayar.Kullanici;
        var parola = hesap?.Parola ?? _ayar.Parola;
        var gonderen = hesap?.Adres ?? _ayar.Gonderen;
        var gonderenAd = hesap is null ? _ayar.GonderenAd : hesap.Value.Adres;

        if (string.IsNullOrWhiteSpace(sunucu) || string.IsNullOrWhiteSpace(gonderen))
            throw new InvalidOperationException(
                "Posta hesabı yok: ekrandan mail ile giriş yapın ya da appsettings.json'daki \"Mail\" bölümünü doldurun.");

        using var ileti = new MailMessage
        {
            From = new MailAddress(gonderen, gonderenAd),
            Subject = konu,
            Body = govde,
            IsBodyHtml = false
        };

        var kac = 0;
        foreach (var a in alicilar)
        {
            var temiz = (a ?? string.Empty).Trim();
            if (temiz.Length == 0) continue;
            ileti.To.Add(new MailAddress(temiz));
            kac++;
        }
        if (kac == 0) throw new ArgumentException("Alıcı yok.");

        // Ek, bellekteki akıştan iliştirilir; diske geçici dosya yazılmaz.
        MemoryStream? akis = null;
        if (ek is { Length: > 0 })
        {
            akis = new MemoryStream(ek);
            ileti.Attachments.Add(new Attachment(akis, ekAdi, "application/pdf"));
        }

        try
        {
            using var istemci = new SmtpClient(sunucu, port) { EnableSsl = ssl };
            // Kullanıcı adı boşsa kimliksiz (anonim) iç posta sunucusu demektir.
            istemci.Credentials = string.IsNullOrWhiteSpace(kullanici)
                ? CredentialCache.DefaultNetworkCredentials
                : new NetworkCredential(kullanici, parola);
            istemci.Send(ileti);
            _gunluk.LogInformation("Posta gönderildi: {Gonderen} -> {Kac} alıcı, ek {Boy} bayt.",
                gonderen, kac, ek?.Length ?? 0);
        }
        finally
        {
            akis?.Dispose();
        }
    }
}

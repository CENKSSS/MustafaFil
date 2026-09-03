using System.Diagnostics;

namespace YanUrunler.Sunucu;

/*  EmlTaslak — tarayıcının kurduğu .eml taslağını yeni Outlook'ta açar
    (kullanıcı direktifi, 03.09.2026: posta programdan değil, bilgisayardaki
    posta uygulamasından gönderilecek; rapor PDF değil HTML).

    ESKİ HÂL (28.08.2026): sunucu PDF üretiyor, .eml'i kendisi kuruyor ve
    dosyayı Windows'un dosya ilişkisiyle açıyordu. Bu makinede .eml KLASİK
    Outlook'a bağlı (OUTLOOK.EXE /eml) ve klasik Outlook'ta posta profili
    yok — "profil oluşturun" penceresi çıkıyordu. Yol bu yüzden kapalıydı.

    YENİ HÂL: .eml'i tarayıcı kurar (js/35-mail-gonder.js — X-Unsent: 1,
    Message-ID, HTML gövde, dosya tamamen ASCII). Sunucu yalnız diske yazar
    ve doğrudan YENİ Outlook'a (olk.exe) verir; dosya ilişkisine güvenmez.
    Ölçüldü (03.09.2026, Outlook 1.2026.818): taslak alıcı, konu ve HTML
    tablolarla düzenlenebilir açılıyor.

    Pencere SUNUCUNUN masaüstünde açılır — uç yalnız yerel istekte çalışır
    (Program.cs); uzak istemci 403 alır ve dosyayı kendisi indirir. IIS
    altında (oturum 0) pencere görünmez; oradaki kullanıcı da indirme
    yoluna düşer.  */
public static class EmlTaslak
{
    /// Yeni Outlook'un komut satırı takma adı; kurulu değilse null.
    public static string? OlkYolu()
    {
        if (!OperatingSystem.IsWindows()) return null;
        var kok = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (string.IsNullOrEmpty(kok)) return null;
        var yol = Path.Combine(kok, "Microsoft", "WindowsApps", "olk.exe");
        return File.Exists(yol) ? yol : null;
    }

    /// Bu makinede taslak açılabilir mi? (api/mail/durum · pencere)
    public static bool Kullanilabilir() => OlkYolu() is not null;

    /// Taslağı yazar ve açar. Sorun olursa sebebi döner, olmazsa null.
    public static string? Ac(string dosyaAdi, string eml, ILogger gunluk)
    {
        var klasor = Path.Combine(Path.GetTempPath(), "YanUrunlerRapor");
        try
        {
            Directory.CreateDirectory(klasor);
            EskiTaslaklariSil(klasor);
            var hedef = Path.Combine(klasor, dosyaAdi);
            File.WriteAllText(hedef, eml, new System.Text.UTF8Encoding(false));

            var olk = OlkYolu();
            if (olk is not null)
                Process.Start(new ProcessStartInfo(olk, $"\"{hedef}\"") { UseShellExecute = false });
            else
                Process.Start(new ProcessStartInfo(hedef) { UseShellExecute = true });   // dosya ilişkisi — son çare

            gunluk.LogInformation("Taslak açıldı: {Dosya}", hedef);
            return null;
        }
        catch (Exception e)
        {
            gunluk.LogWarning(e, "Taslak açılamadı.");
            return "Taslak açılamadı: " + e.Message;
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

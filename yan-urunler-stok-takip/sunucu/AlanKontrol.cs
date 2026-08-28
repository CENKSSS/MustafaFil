using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace YanUrunler.Sunucu;

/*  AlanKontrol — alıcı adresinin ALAN ADI posta alabiliyor mu, göndermeden
    önce DNS'e sorar.

    NEDEN GEREKLİ (kullanıcı bildirimi, 28.08.2026): "sasaas@sa.com" adresine
    gönderilen posta SMTP tarafından KABUL EDİLDİ, hata dönmedi; teslimsizlik
    dakikalar sonra "Adres bulunamadı — sa.com alanı bulunamadı" diye AYRI BİR
    POSTAYLA geldi. SMTP'nin doğası bu: sunucu iletiyi alır, teslimi sonra
    dener. Yani "gönderildi" ekranı tek başına teslim garantisi değildir.

    ÖLÇÜLDÜ (28.08.2026, dns.google): sa.com  -> MX = "." (RFC 7505 boş MX,
    "bu alan posta kabul etmez"), A kaydı yok.
                                     gmail.com -> üç MX kaydı.
    Yani bu vaka gönderMEDEN yakalanabiliyor.

    SINIR: bu kontrol yalnız ALAN ADINI doğrular. Alan doğru ama KUTU yoksa
    (yanlış yazılmış kullanıcı adı) yine ancak teslimsizlik postası söyler —
    onu hiçbir gönderim öncesi kontrol bilemez.

    KURAL: emin değilsek ENGELLEMEYİZ. DNS'e ulaşılamazsa, zaman aşarsa ya da
    yanıt anlaşılmazsa null döner ve posta normal gönderilir. Yanlış pozitif,
    gönderilmeyen posta demektir; bu kontrol onu göze almaz.  */
public static class AlanKontrol
{
    private const int MX = 15, A = 1;

    /// Alan başına sonuç bellekte tutulur — aynı listeye arka arkaya gönderim
    /// DNS'i tekrar tekrar yormasın.
    private static readonly Dictionary<string, (DateTime Zaman, string? Sonuc)> _bellek =
        new(StringComparer.OrdinalIgnoreCase);
    private static readonly object _kilit = new();
    private static readonly TimeSpan Omur = TimeSpan.FromMinutes(10);

    /// <summary>Adres gönderilebilir görünüyorsa null; alan kesin posta
    /// almıyorsa sebebi Türkçe cümleyle döner.</summary>
    public static string? Sorun(string adres)
    {
        var at = (adres ?? string.Empty).LastIndexOf('@');
        if (at <= 0 || at == adres!.Length - 1) return null;   // biçim hatasını çağıran yakalar
        var alan = adres[(at + 1)..].Trim().TrimEnd('.');
        if (alan.Length == 0 || alan.IndexOf('.') < 0) return null;

        lock (_kilit)
        {
            if (_bellek.TryGetValue(alan, out var k) && DateTime.UtcNow - k.Zaman < Omur)
                return k.Sonuc;
        }

        var sonuc = Olc(alan);

        lock (_kilit) { _bellek[alan] = (DateTime.UtcNow, sonuc); }
        return sonuc;
    }

    private static string? Olc(string alan)
    {
        var sunucu = DnsSunucusu();
        if (sunucu is null) return null;                       // DNS bilinmiyor -> karışma

        var mx = Sor(sunucu, alan, MX);
        if (mx is null) return null;                           // ulaşılamadı -> karışma

        if (mx.Value.Rcode == 3)                               // NXDOMAIN
            return "Alan bulunamadı: " + alan;

        if (mx.Value.Rcode != 0) return null;

        if (mx.Value.Kayitlar.Count > 0)
        {
            // RFC 7505: tek kayıt ve hedefi kök ("") ise alan posta kabul etmiyor.
            if (mx.Value.Kayitlar.Count == 1 && mx.Value.Kayitlar[0].Length == 0)
                return alan + " alanı posta kabul etmiyor";
            return null;
        }

        // MX yok: RFC'ye göre A kaydı posta sunucusu sayılır.
        var a = Sor(sunucu, alan, A);
        if (a is null) return null;
        if (a.Value.Rcode == 3) return "Alan bulunamadı: " + alan;
        if (a.Value.Rcode == 0 && a.Value.Kayitlar.Count == 0)
            return alan + " alanının posta sunucusu tanımlı değil";
        return null;
    }

    private static IPAddress? DnsSunucusu()
    {
        try
        {
            foreach (var ag in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ag.OperationalStatus != OperationalStatus.Up) continue;
                foreach (var ip in ag.GetIPProperties().DnsAddresses)
                    if (ip.AddressFamily == AddressFamily.InterNetwork) return ip;
            }
        }
        catch { /* ağ bilgisi okunamadı — karışma */ }
        return null;
    }

    /*  Tek bir UDP DNS sorusu. Ek kütüphane YOK: System.Net.Dns yalnız A/AAAA
        çözer, MX soramaz; paket elle kurulur. Yanıt anlaşılmazsa null döner
        (yukarıdaki KURAL). */
    private static (int Rcode, List<string> Kayitlar)? Sor(IPAddress dns, string alan, int tur)
    {
        try
        {
            var istek = new List<byte>
            {
                0x7A, 0x59,              // sabit kimlik — tek soru, tek yanıt
                0x01, 0x00,              // RD (özyineleme istenir)
                0x00, 0x01,              // QDCOUNT
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            };
            foreach (var parca in alan.Split('.'))
            {
                var b = System.Text.Encoding.ASCII.GetBytes(parca);
                if (b.Length == 0 || b.Length > 63) return null;
                istek.Add((byte)b.Length);
                istek.AddRange(b);
            }
            istek.Add(0x00);
            istek.Add((byte)(tur >> 8)); istek.Add((byte)tur);
            istek.Add(0x00); istek.Add(0x01);   // IN

            using var soket = new UdpClient();
            soket.Client.ReceiveTimeout = 2500;
            soket.Client.SendTimeout = 2500;
            soket.Connect(new IPEndPoint(dns, 53));
            soket.Send(istek.ToArray(), istek.Count);

            IPEndPoint? kimden = null;
            var yanit = soket.Receive(ref kimden!);
            if (yanit.Length < 12) return null;

            var rcode = yanit[3] & 0x0F;
            int qd = (yanit[4] << 8) | yanit[5], an = (yanit[6] << 8) | yanit[7];
            var p = 12;
            for (var i = 0; i < qd; i++) { p = AdiAtla(yanit, p); p += 4; }

            var kayitlar = new List<string>();
            for (var i = 0; i < an && p < yanit.Length; i++)
            {
                p = AdiAtla(yanit, p);
                if (p + 10 > yanit.Length) break;
                int t = (yanit[p] << 8) | yanit[p + 1];
                int uzunluk = (yanit[p + 8] << 8) | yanit[p + 9];
                p += 10;
                if (p + uzunluk > yanit.Length) break;
                if (t == MX && uzunluk >= 3) kayitlar.Add(AdiOku(yanit, p + 2).Ad);
                else if (t == A && uzunluk == 4) kayitlar.Add("A");
                p += uzunluk;
            }
            return (rcode, kayitlar);
        }
        catch { return null; }
    }

    private static int AdiAtla(byte[] p, int i)
    {
        while (i < p.Length)
        {
            var u = p[i];
            if (u == 0) return i + 1;
            if ((u & 0xC0) == 0xC0) return i + 2;   // sıkıştırma işaretçisi
            i += u + 1;
        }
        return i;
    }

    private static (string Ad, int Son) AdiOku(byte[] p, int i)
    {
        var parcalar = new List<string>();
        var atlandi = false;
        var son = i;
        var koruma = 0;
        while (i < p.Length && koruma++ < 128)
        {
            var u = p[i];
            if (u == 0) { if (!atlandi) son = i + 1; break; }
            if ((u & 0xC0) == 0xC0)
            {
                if (!atlandi) { son = i + 2; atlandi = true; }
                i = ((u & 0x3F) << 8) | p[i + 1];
                continue;
            }
            if (i + 1 + u > p.Length) break;
            parcalar.Add(System.Text.Encoding.ASCII.GetString(p, i + 1, u));
            i += u + 1;
        }
        return (string.Join('.', parcalar), son);
    }
}

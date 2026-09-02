using System.Text;

namespace YanUrunler.Sunucu;

/// <summary>Bir kolonun veritabanındaki karşılığı.</summary>
public enum KolonTipi
{
    /// <summary>Tam sayı — Id, adet, sıra, RowVersion.</summary>
    Tamsayi,

    /// <summary>Miktar. JSON'da kg, veritabanında GRAM (kg × 1000) tam sayı.
    /// Gerekçe: SQLite'ta DECIMAL yalnız "yakınlık"tır, saklanan tip REAL olur
    /// ve şartname satır 314 "asla float" maddesi ihlal edilir.
    /// SQLITE-MIMARI-KARARI.md §4.</summary>
    Gram,

    /// <summary>Metin — tarih (ISO), ad, tip.</summary>
    Metin,

    /// <summary>Evet/hayır — 0 veya 1.</summary>
    Mantik,

    /// <summary>İç içe JSON (nesne ya da dizi) — metin olarak saklanır.
    /// Yalnız arşiv/log tablolarında geçer.</summary>
    Json
}

public sealed record Kolon(string Ad, KolonTipi Tip, bool Zorunlu = false, string? Referans = null);

/// <summary>Bir tablonun JSON adı, SQL adı, kolonları ve tekillik kısıtları.</summary>
public sealed record TabloTanimi(
    string JsonAd,
    string SqlAd,
    Kolon[] Kolonlar,
    string[][] Tekil,
    string? EkIndeks = null);

/// <summary>
/// Şema tanımı — TEK KAYNAK. DDL buradan üretilir, elle yazılmaz; böylece
/// kolon listesi ile tablo yapısı birbirinden ayrışamaz.
///
/// Alan adları TAHMİN DEĞİL: mevcut istemci kodu Node üzerinde çalıştırılıp
/// üretilen gerçek paket ölçüldü (27.08.2026). Kaynak: js/01-cekirdek.js
/// temelVeriUret + js/05-tohum.js + js/04-servis.js yazma servisleri.
/// </summary>
public static class Sema
{
    /// <summary>Her satırın özgün JSON'u. Okuma bu kolondan yapılır.
    ///
    /// NEDEN: istemcinin paketinde bir alan kimi satırda YOK, kimi satırda
    /// null. (Ölçüm: Malzemeler.GuncellemeTarihi 8 satırın 2'sinde var;
    /// DevirStok.GuncelleyenKullaniciId 16 satırın hepsinde var, 13'ü null.)
    /// Kolonlardan geri kurmak "yok" ile "null"u ayıramaz ve paketin şeklini
    /// sessizce değiştirir. Ham kolonu bunu imkânsız kılar.
    ///
    /// Kolonlar boşuna değil: tekillik kısıtlarını MOTOR zorlar (şartname
    /// satır 156 Demirbaş) ve bilgi işlem tabloları gerçek SQL ile sorgular.</summary>
    public const string HamKolon = "Ham";

    /// <summary>Meta tablosu: paket sürümü ve Id sayaçları.</summary>
    public const string MetaTablo = "Meta";

    public static readonly TabloTanimi[] Tablolar =
    {
        // ---------- Şartname §6 · sekiz sözleşme tablosu ----------

        new("kullanicilar", "Kullanicilar", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("KullaniciAdi", KolonTipi.Metin, true),
            new("ParolaHash", KolonTipi.Metin),
            new("AdSoyad", KolonTipi.Metin),
            new("Rol", KolonTipi.Metin),
            new("Aktif", KolonTipi.Mantik),
            new("OlusturmaTarihi", KolonTipi.Metin)
        }, new[] { new[] { "KullaniciAdi" } }),

        new("malzemeler", "Malzemeler", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Ad", KolonTipi.Metin, true),
            new("Birim", KolonTipi.Metin),
            new("Sira", KolonTipi.Tamsayi),
            new("OzelTip", KolonTipi.Metin),
            new("Aktif", KolonTipi.Mantik),
            // Ölçümde 8 satırın 2'sinde var (tohum yazıyor); malzemeKaydet
            // yazmıyor. GuncelleyenKullaniciId hiç geçmiyor — kolonu da yok.
            new("GuncellemeTarihi", KolonTipi.Metin)
        }, new[] { new[] { "Ad" } },
        // Şartname satır 180: her özel tipten EN FAZLA BİR malzeme. İkincisi
        // olursa "stok = silolar toplamı" iki malzemeye uygulanır ve stok ikiye
        // katlanır. Filtreli tekil indeks — NULL'lar kısıtın dışında kalır.
        EkIndeks: "CREATE UNIQUE INDEX IF NOT EXISTS ix_Malzemeler_OzelTip " +
                  "ON Malzemeler(OzelTip) WHERE OzelTip IS NOT NULL;"),

        new("silolar", "Silolar", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Ad", KolonTipi.Metin, true),
            new("Sira", KolonTipi.Tamsayi),
            new("Kapasite", KolonTipi.Gram),
            // siloKaydet yalnız Ad/Sira/Kapasite/Aktif yazar (04-servis.js
            // doğrulandı) — güncelleme izi DegisiklikLog'da tutulur.
            new("Aktif", KolonTipi.Mantik)
        }, new[] { new[] { "Ad" } }),

        new("devirStok", "DevirStok", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("MalzemeId", KolonTipi.Tamsayi, true, "Malzemeler"),
            new("DevirTarihi", KolonTipi.Metin, true),
            new("Miktar", KolonTipi.Gram),
            new("OlusturanKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("OlusturmaTarihi", KolonTipi.Metin),
            new("GuncelleyenKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("GuncellemeTarihi", KolonTipi.Metin)
            // Şartname satır 161: (MalzemeId, DevirTarihi) tekil — v2 "en son devir" formülü
        }, new[] { new[] { "MalzemeId", "DevirTarihi" } }),

        new("siloDevirStok", "SiloDevirStok", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("SiloId", KolonTipi.Tamsayi, true, "Silolar"),
            new("DevirTarihi", KolonTipi.Metin, true),
            new("Miktar", KolonTipi.Gram),
            new("OlusturanKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("OlusturmaTarihi", KolonTipi.Metin),
            new("GuncelleyenKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("GuncellemeTarihi", KolonTipi.Metin)
        }, new[] { new[] { "SiloId", "DevirTarihi" } }),

        new("gunlukHareket", "GunlukHareket", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Tarih", KolonTipi.Metin, true),
            new("MalzemeId", KolonTipi.Tamsayi, true, "Malzemeler"),
            new("Uretim", KolonTipi.Gram),
            new("Satis", KolonTipi.Gram),
            new("Iade", KolonTipi.Gram),
            new("RowVersion", KolonTipi.Tamsayi),
            new("OlusturanKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("OlusturmaTarihi", KolonTipi.Metin),
            new("GuncelleyenKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("GuncellemeTarihi", KolonTipi.Metin)
            // ŞARTNAME SATIR 163 · KRİTİK: (Tarih, MalzemeId) benzersiz.
            // Aynı gün aynı malzemeye ikinci satır açılırsa stok ÇİFT SAYILIR.
        }, new[] { new[] { "Tarih", "MalzemeId" } }),

        new("kuruKuspeGunluk", "KuruKuspeGunluk", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Tarih", KolonTipi.Metin, true),
            new("UretilenDokme", KolonTipi.Gram),
            // ADET — kg değil. 1 çuval = 50 kg (şartname satır 103). Gram'a çevrilmez.
            new("CuvalAdet", KolonTipi.Tamsayi),
            new("CuvalKg", KolonTipi.Gram),
            new("SatilanDokme", KolonTipi.Gram),
            new("RowVersion", KolonTipi.Tamsayi),
            new("OlusturanKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("OlusturmaTarihi", KolonTipi.Metin),
            new("GuncelleyenKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("GuncellemeTarihi", KolonTipi.Metin)
        }, new[] { new[] { "Tarih" } }),   // şartname satır 164

        new("siloHareket", "SiloHareket", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Tarih", KolonTipi.Metin, true),
            new("SiloId", KolonTipi.Tamsayi, true, "Silolar"),
            // DokmeUretim | Cuvallama | DokmeSatis | Manuel — şartname satır 169-174
            new("HareketTipi", KolonTipi.Metin),
            new("GirenKg", KolonTipi.Gram),
            new("CikanKg", KolonTipi.Gram),
            // Kaynak kuru küspe kaydına bağ — şartname satır 191: düzeltmede
            // hangi satırların silineceği buradan bulunur. FK YOK: Manuel
            // hareketlerde bu alan bir kayda işaret etmeyebilir (M16/M18).
            new("KaynakKayitId", KolonTipi.Tamsayi),
            new("OlusturanKullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("OlusturmaTarihi", KolonTipi.Metin),
            new("GuncellemeTarihi", KolonTipi.Metin)
        }, Array.Empty<string[]>()),   // şartname satır 165: tekillik kısıtı yok

        // ---------- Şartname §6 · v2 denetim izi ----------

        new("degisiklikLog", "DegisiklikLog", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Tablo", KolonTipi.Metin),
            // Değişen kaydın Id'si. FK YOK: hedef tablo satır satır değişir.
            new("KayitId", KolonTipi.Tamsayi),
            new("Alan", KolonTipi.Metin),
            // Biçimlenmiş metin ("3.530") — sayı değil. Şartname satır 195.
            new("EskiDeger", KolonTipi.Metin),
            new("YeniDeger", KolonTipi.Metin),
            new("KullaniciId", KolonTipi.Tamsayi, false, "Kullanicilar"),
            new("Tarih", KolonTipi.Metin),
            new("Islem", KolonTipi.Metin)
        }, Array.Empty<string[]>()),

        // ---------- SÖZLEŞME §1 DIŞI · arşiv ve log ----------
        // Bu dördü sekiz tablo sözleşmesine dokunmaz (01-cekirdek.js:836-858
        // kendi yorumunda böyle işaretli). FK konmaz: silinmiş kayda işaret
        // edebilirler, bu onların işidir.

        new("olayGunlugu", "OlayGunlugu", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Servis", KolonTipi.Metin),
            new("Girdi", KolonTipi.Json),
            new("Ek", KolonTipi.Metin),
            new("KullaniciId", KolonTipi.Tamsayi),
            new("Ok", KolonTipi.Mantik),
            new("HataKodlari", KolonTipi.Json),
            new("Tarih", KolonTipi.Metin)
        }, Array.Empty<string[]>()),

        new("silinenKayitlar", "SilinenKayitlar", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Tablo", KolonTipi.Metin),
            new("Kayit", KolonTipi.Json),
            new("Baglam", KolonTipi.Metin),
            new("KullaniciId", KolonTipi.Tamsayi),
            new("SilmeTarihi", KolonTipi.Metin)
        }, Array.Empty<string[]>()),

        new("stokFotograflari", "StokFotograflari", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Tarih", KolonTipi.Metin),
            new("Damga", KolonTipi.Metin),
            new("Malzemeler", KolonTipi.Json),
            new("Silolar", KolonTipi.Json),
            new("DokmeToplam", KolonTipi.Gram),
            new("ToplamStok", KolonTipi.Gram)
        }, Array.Empty<string[]>()),

        new("kampanyaKilitleri", "KampanyaKilitleri", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("Kampanya", KolonTipi.Metin, true),
            new("KullaniciId", KolonTipi.Tamsayi),
            new("Tarih", KolonTipi.Metin)
        }, new[] { new[] { "Kampanya" } }),

        // Kampanya başlıkları (kullanıcı kararı, 31.08.2026): kampanyanın adı
        // tarihten türetilmez, kullanıcı yazar. DevirTarihi = kampanya başı.
        new("kampanyaBasliklari", "KampanyaBasliklari", new Kolon[]
        {
            new("Id", KolonTipi.Tamsayi, true),
            new("DevirTarihi", KolonTipi.Metin, true),
            new("Baslik", KolonTipi.Metin, true),
            new("KullaniciId", KolonTipi.Tamsayi),
            new("Tarih", KolonTipi.Metin)
        }, new[] { new[] { "DevirTarihi" } })
    };

    /// <summary>Yazma sırası — üst tablolar önce. defer_foreign_keys açık
    /// olduğu için zorunlu değil, ama okunabilirlik ve SQL Server'a geçiş için
    /// doğru sıra korunur.</summary>
    public static IEnumerable<TabloTanimi> YazmaSirasi => Tablolar;

    /// <summary>Silme sırası — yazmanın tersi.</summary>
    public static IEnumerable<TabloTanimi> SilmeSirasi => Tablolar.Reverse();

    private static string SqlTip(KolonTipi t) => t switch
    {
        KolonTipi.Tamsayi => "INTEGER",
        KolonTipi.Gram => "INTEGER",   // kg × 1000
        KolonTipi.Mantik => "INTEGER",  // 0/1
        _ => "TEXT"
    };

    /// <summary>Tüm şemayı üretir. İkinci kez çalıştırılınca hata vermez
    /// (şartname satır 362 · Demirbaş: "ikinci kez çalıştırılınca hata vermez").</summary>
    public static string Ddl()
    {
        var s = new StringBuilder();

        s.AppendLine("-- Yan Ürünler Stok Takip — denemelik SQLite şeması.");
        s.AppendLine("-- ÜRETİLMİŞTİR: Sema.cs tek kaynaktır, bu metin elle düzenlenmez.");
        s.AppendLine("-- Miktar kolonları GRAM tutar (kg × 1000). Bkz. SQLITE-MIMARI-KARARI.md §4.");
        s.AppendLine();

        s.AppendLine($"CREATE TABLE IF NOT EXISTS {MetaTablo} (");
        s.AppendLine("  Anahtar TEXT PRIMARY KEY,");
        s.AppendLine("  Deger   TEXT");
        s.AppendLine(") WITHOUT ROWID;");
        s.AppendLine();

        foreach (var t in Tablolar)
        {
            s.AppendLine($"CREATE TABLE IF NOT EXISTS {t.SqlAd} (");

            var satirlar = new List<string>();
            foreach (var k in t.Kolonlar)
            {
                var satir = k.Ad == "Id"
                    ? "  Id INTEGER PRIMARY KEY"
                    : $"  {k.Ad} {SqlTip(k.Tip)}{(k.Zorunlu ? " NOT NULL" : "")}";

                if (k.Referans is not null && k.Ad != "Id")
                    satir += $" REFERENCES {k.Referans}(Id)";

                satirlar.Add(satir);
            }

            // Ham: istemciye birebir geri dönüş garantisi.
            satirlar.Add($"  {HamKolon} TEXT NOT NULL");

            foreach (var tekil in t.Tekil)
                satirlar.Add($"  UNIQUE({string.Join(", ", tekil)})");

            s.AppendLine(string.Join(",\n", satirlar));
            s.AppendLine(");");

            if (t.EkIndeks is not null)
                s.AppendLine(t.EkIndeks);

            s.AppendLine();
        }

        // Sık sorgulanan alanlar — stok hesabı tarih aralığıyla çalışır (§5).
        s.AppendLine("CREATE INDEX IF NOT EXISTS ix_GunlukHareket_Tarih ON GunlukHareket(Tarih);");
        s.AppendLine("CREATE INDEX IF NOT EXISTS ix_SiloHareket_Tarih   ON SiloHareket(Tarih);");
        s.AppendLine("CREATE INDEX IF NOT EXISTS ix_SiloHareket_Silo    ON SiloHareket(SiloId, Tarih);");
        s.AppendLine("CREATE INDEX IF NOT EXISTS ix_DegisiklikLog_Tarih ON DegisiklikLog(Tarih);");
        s.AppendLine("CREATE INDEX IF NOT EXISTS ix_OlayGunlugu_Tarih   ON OlayGunlugu(Tarih);");

        return s.ToString();
    }
}

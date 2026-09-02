using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;

namespace YanUrunler.Sunucu;

/// <summary>Yazma sonucu. <see cref="Cakisma"/> ise hiçbir şey yazılmamıştır.</summary>
public sealed record YazmaSonucu(bool Basarili, bool Cakisma, long Surum, string? Mesaj);

/// <summary>Okuma sonucu. Veritabanı boşsa <see cref="Paket"/> null'dur.</summary>
public sealed record OkumaSonucu(long Surum, JsonObject? Paket);

/// <summary>
/// Paketin SQLite karşılığı. 13 tabloyu okur/yazar.
///
/// EŞZAMANLILIK: yazma, paket düzeyinde iyimser kilitle korunur
/// (Meta.YazmaSurumu). Gelen sürüm eskiyse hiçbir şey yazılmaz ve çağıran
/// 409 alır — istemci tazeleyip yeniden dener. Böylece kabul edilen her
/// yazma, O ANKİ gerçek veri üzerinde hesaplanmış olur; sessiz bozulma
/// imkânsızdır. Gerekçe: DENEMELIK-SUNUCU-PLANI.md §2.
/// </summary>
public sealed class PaketDeposu
{
    /// <summary>Yazma sayacı — her başarılı yazmada +1.</summary>
    private const string AnahtarYazmaSurumu = "YazmaSurumu";

    /// <summary>İstemcinin şema sürümü (bugün 11). Değişirse yazma reddedilir.</summary>
    private const string AnahtarSemaSurumu = "SemaSurumu";

    /// <summary>İstemcinin Id sayaçları — silinen Id yeniden dağıtılmasın (M1).</summary>
    private const string AnahtarSayaclar = "Sayaclar";

    private readonly string _dosya;
    private readonly ILogger<PaketDeposu> _gunluk;

    public PaketDeposu(string dosya, ILogger<PaketDeposu> gunluk)
    {
        _dosya = dosya;
        _gunluk = gunluk;
    }

    public string Dosya => _dosya;

    private string BaglantiDizesi => new SqliteConnectionStringBuilder
    {
        DataSource = _dosya,
        Mode = SqliteOpenMode.ReadWriteCreate,
        // Cache=Shared YAZILMAZ — WAL ile birlikte kullanımı önerilmiyor.
        Pooling = true
    }.ToString();

    /// <summary>
    /// Başka bir SQLite dosyasını SALT OKUNUR açar — yedek dosyasının bütünlük
    /// denetimi için (BUG-014). ReadOnly seçilir ki denetim dosyaya yazmasın ve
    /// yanına -wal/-shm düşmesin; Pooling kapalıdır ki bağlantı hemen bırakılsın
    /// ve dosya budama sırasında kilitli kalmasın.
    /// </summary>
    private static string SaltOkunurDizesi(string dosya) => new SqliteConnectionStringBuilder
    {
        DataSource = dosya,
        Mode = SqliteOpenMode.ReadOnly,
        Pooling = false
    }.ToString();

    /// <summary>Her istekte YENİ bağlantı. Singleton tutulmaz: SqliteConnection
    /// thread-safe değildir. PRAGMA'lar bağlantı başınadır (journal_mode hariç,
    /// o dosyada kalıcıdır). Ölçümler: SQLITE-MIMARI-KARARI.md §3.</summary>
    private SqliteConnection Ac()
    {
        var b = new SqliteConnection(BaglantiDizesi);
        b.Open();
        using var k = b.CreateCommand();
        k.CommandText = """
            PRAGMA busy_timeout = 5000;
            PRAGMA foreign_keys = ON;
            PRAGMA synchronous = FULL;
            """;
        k.ExecuteNonQuery();
        return b;
    }

    /// <summary>Yedek dosyasını salt okunur açar (BUG-014). foreign_keys açılır:
    /// foreign_key_check onsuz da çalışır ama denetim canlı veritabanıyla aynı
    /// koşullarda koşsun.</summary>
    private static SqliteConnection AcSaltOkunur(string dosya)
    {
        var b = new SqliteConnection(SaltOkunurDizesi(dosya));
        b.Open();
        using var k = b.CreateCommand();
        k.CommandText = """
            PRAGMA busy_timeout = 5000;
            PRAGMA foreign_keys = ON;
            """;
        k.ExecuteNonQuery();
        return b;
    }

    /// <summary>Şemayı kurar. İkinci kez çalıştırılınca hata vermez
    /// (şartname satır 362 · Demirbaş).</summary>
    public void Kur()
    {
        var klasor = Path.GetDirectoryName(Path.GetFullPath(_dosya));
        if (!string.IsNullOrEmpty(klasor)) Directory.CreateDirectory(klasor);

        using var b = Ac();

        // WAL dosyada kalıcıdır, bir kez yeter. Yazar okuyucuyu engellemez:
        // Ahmet kaydederken Hatice raporu açabilir.
        using (var w = b.CreateCommand())
        {
            w.CommandText = "PRAGMA journal_mode = WAL;";
            var mod = w.ExecuteScalar() as string;
            _gunluk.LogInformation("SQLite journal_mode = {Mod}", mod);
        }

        using var k = b.CreateCommand();
        k.CommandText = Sema.Ddl();
        k.ExecuteNonQuery();

        _gunluk.LogInformation("Şema hazır: {Dosya}", Path.GetFullPath(_dosya));
    }

    private static string? MetaOku(SqliteConnection b, SqliteTransaction? islem, string anahtar)
    {
        using var k = b.CreateCommand();
        k.Transaction = islem;
        k.CommandText = $"SELECT Deger FROM {Sema.MetaTablo} WHERE Anahtar = $a;";
        k.Parameters.AddWithValue("$a", anahtar);
        return k.ExecuteScalar() as string;
    }

    private static void MetaYaz(SqliteConnection b, SqliteTransaction islem, string anahtar, string deger)
    {
        using var k = b.CreateCommand();
        k.Transaction = islem;
        k.CommandText = $"""
            INSERT INTO {Sema.MetaTablo} (Anahtar, Deger) VALUES ($a, $d)
            ON CONFLICT(Anahtar) DO UPDATE SET Deger = excluded.Deger;
            """;
        k.Parameters.AddWithValue("$a", anahtar);
        k.Parameters.AddWithValue("$d", deger);
        k.ExecuteNonQuery();
    }

    /// <summary>Yalnız yazma sürümü — ucuz yoklama ucu için.</summary>
    public long SurumOku()
    {
        using var b = Ac();
        var v = MetaOku(b, null, AnahtarYazmaSurumu);
        return v is null ? 0 : long.Parse(v, CultureInfo.InvariantCulture);
    }

    /// <summary>Tüm paketi kurar. Veritabanı boşsa Paket = null döner;
    /// istemci o zaman kendi tohumunu üretip surum 0 ile gönderir.</summary>
    public OkumaSonucu Oku()
    {
        using var b = Ac();

        var surumMetni = MetaOku(b, null, AnahtarYazmaSurumu);
        var surum = surumMetni is null ? 0 : long.Parse(surumMetni, CultureInfo.InvariantCulture);
        if (surum == 0) return new OkumaSonucu(0, null);

        var paket = new JsonObject();

        var semaSurumu = MetaOku(b, null, AnahtarSemaSurumu);
        paket["surum"] = semaSurumu is null
            ? null
            : JsonNode.Parse(semaSurumu);

        var sayaclar = MetaOku(b, null, AnahtarSayaclar);
        paket["sayaclar"] = string.IsNullOrEmpty(sayaclar)
            ? new JsonObject()
            : JsonNode.Parse(sayaclar);

        foreach (var t in Sema.Tablolar)
        {
            var dizi = new JsonArray();
            using var k = b.CreateCommand();
            // Ham kolonundan okunur: "alan yok" ile "alan null" ayrımı korunur.
            // Gerekçe: Sema.HamKolon yorumu.
            k.CommandText = $"SELECT {Sema.HamKolon} FROM {t.SqlAd} ORDER BY Id;";
            using var oku = k.ExecuteReader();
            while (oku.Read())
            {
                var ham = oku.GetString(0);
                dizi.Add(JsonNode.Parse(ham));
            }
            paket[t.JsonAd] = dizi;
        }

        return new OkumaSonucu(surum, paket);
    }

    /// <summary>
    /// Paketi yazar. Tek BEGIN IMMEDIATE içinde: sürüm kontrolü → tabloları
    /// boşalt → yeniden yaz → sürüm +1. Ortada hata olursa hiçbiri yazılmaz
    /// (şartname satır 121 · Demirbaş).
    /// </summary>
    public YazmaSonucu Yaz(long beklenenSurum, JsonObject paket)
    {
        var kusur = Dogrula(paket);
        if (kusur is not null) return new YazmaSonucu(false, false, 0, kusur);

        using var b = Ac();

        // BeginTransaction() varsayılan olarak BEGIN IMMEDIATE açar; yazma
        // kilidi baştan alınır ve "önce oku sonra yaz" akışı SQLITE_BUSY
        // almaz. deferred:true ASLA geçilmez.
        using var islem = b.BeginTransaction();

        var mevcutMetni = MetaOku(b, islem, AnahtarYazmaSurumu);
        var mevcut = mevcutMetni is null ? 0 : long.Parse(mevcutMetni, CultureInfo.InvariantCulture);

        if (mevcut != beklenenSurum)
        {
            islem.Rollback();
            _gunluk.LogInformation(
                "Çakışma: beklenen sürüm {Beklenen}, sunucudaki {Mevcut}", beklenenSurum, mevcut);
            return new YazmaSonucu(false, true, mevcut, null);
        }

        // Şema sürümü değiştiyse yazma DURDURULUR. Sessizce kabul etmek,
        // eski ve yeni şekilli satırları aynı tabloya karıştırmak demektir.
        var gelenSema = paket["surum"]?.ToJsonString();
        if (mevcut > 0)
        {
            var kayitliSema = MetaOku(b, islem, AnahtarSemaSurumu);
            if (kayitliSema is not null && gelenSema is not null && kayitliSema != gelenSema)
            {
                islem.Rollback();
                return new YazmaSonucu(false, false, mevcut,
                    $"Şema sürümü değişti (veritabanı {kayitliSema}, gelen {gelenSema}). " +
                    "Veritabanı taşınmalı ya da sıfırlanmalı — kendiliğinden yazılmaz.");
            }
        }

        // FK denetimi COMMIT'e ertelenir: tabloları boşaltıp yeniden yazarken
        // satır sırası önemsiz olur, bütünlük yine de sonunda kontrol edilir.
        using (var d = b.CreateCommand())
        {
            d.Transaction = islem;
            d.CommandText = "PRAGMA defer_foreign_keys = ON;";
            d.ExecuteNonQuery();
        }

        try
        {
            foreach (var t in Sema.SilmeSirasi)
            {
                using var sil = b.CreateCommand();
                sil.Transaction = islem;
                sil.CommandText = $"DELETE FROM {t.SqlAd};";
                sil.ExecuteNonQuery();
            }

            var toplam = 0;
            foreach (var t in Sema.YazmaSirasi)
                toplam += TabloYaz(b, islem, t, paket[t.JsonAd]!.AsArray());

            MetaYaz(b, islem, AnahtarYazmaSurumu, (mevcut + 1).ToString(CultureInfo.InvariantCulture));
            if (gelenSema is not null) MetaYaz(b, islem, AnahtarSemaSurumu, gelenSema);
            MetaYaz(b, islem, AnahtarSayaclar,
                paket["sayaclar"]?.ToJsonString() ?? "{}");

            islem.Commit();
            _gunluk.LogInformation("Yazıldı: sürüm {Surum}, {Satir} satır", mevcut + 1, toplam);
            return new YazmaSonucu(true, false, mevcut + 1, null);
        }
        catch (SqliteException e)
        {
            islem.Rollback();
            // Tekillik/FK ihlali buraya düşer. Sessizce yutulmaz: istemci
            // gerçek sebebi görsün, çünkü bu bir VERİ hatasıdır.
            _gunluk.LogError(e, "Yazma reddedildi (SQLite {Kod})", e.SqliteErrorCode);
            return new YazmaSonucu(false, false, mevcut,
                "Veritabanı kaydı reddetti: " + e.Message);
        }
    }

    /// <summary>Paketin şekli beklenen mi? İstemcinin paketGecerliMi()
    /// kontrolünün sunucu tarafı karşılığı.</summary>
    private static string? Dogrula(JsonObject paket)
    {
        if (paket["surum"] is null)
            return "Paket geçersiz: 'surum' alanı yok.";

        foreach (var t in Sema.Tablolar)
        {
            if (paket[t.JsonAd] is not JsonArray)
                return $"Paket geçersiz: '{t.JsonAd}' bir dizi değil.";
        }

        return null;
    }

    private static int TabloYaz(SqliteConnection b, SqliteTransaction islem, TabloTanimi t, JsonArray satirlar)
    {
        if (satirlar.Count == 0) return 0;

        var kolonAdlari = t.Kolonlar.Select(k => k.Ad).Append(Sema.HamKolon).ToArray();
        var yerTutucular = kolonAdlari.Select(a => "$" + a).ToArray();

        using var k = b.CreateCommand();
        k.Transaction = islem;
        k.CommandText =
            $"INSERT INTO {t.SqlAd} ({string.Join(", ", kolonAdlari)}) " +
            $"VALUES ({string.Join(", ", yerTutucular)});";

        // Parametreler bir kez kurulur, satır satır değeri değişir.
        // TİP KOLONA GÖRE verilir: hepsi Text bildirilirse sayılar metin olarak
        // saklanır ve SUM/karşılaştırma sessizce yanlış çalışır.
        foreach (var kolon in t.Kolonlar)
            k.Parameters.Add("$" + kolon.Ad, SqlParametreTipi(kolon.Tip));
        k.Parameters.Add("$" + Sema.HamKolon, SqliteType.Text);
        k.Prepare();

        var sayi = 0;
        foreach (var satirNode in satirlar)
        {
            if (satirNode is not JsonObject satir)
                throw new SqliteException($"{t.JsonAd}: satır nesne değil.", 0);

            foreach (var kolon in t.Kolonlar)
                k.Parameters["$" + kolon.Ad].Value = Deger(satir, kolon);

            k.Parameters["$" + Sema.HamKolon].Value = satir.ToJsonString();
            k.ExecuteNonQuery();
            sayi++;
        }

        return sayi;
    }

    private static SqliteType SqlParametreTipi(KolonTipi t) => t switch
    {
        KolonTipi.Tamsayi => SqliteType.Integer,
        KolonTipi.Gram => SqliteType.Integer,
        KolonTipi.Mantik => SqliteType.Integer,
        _ => SqliteType.Text
    };

    /// <summary>JSON alanını kolon tipine çevirir. Alan yoksa ya da null'sa
    /// DBNull döner — Ham kolonu ikisinin farkını zaten koruyor.</summary>
    private static object Deger(JsonObject satir, Kolon kolon)
    {
        if (!satir.TryGetPropertyValue(kolon.Ad, out var d) || d is null)
            return DBNull.Value;

        try
        {
            switch (kolon.Tip)
            {
                case KolonTipi.Json:
                    return d.ToJsonString();

                case KolonTipi.Metin:
                    return d.GetValueKind() == JsonValueKind.String
                        ? d.GetValue<string>()
                        : d.ToJsonString();

                case KolonTipi.Mantik:
                    return d.GetValueKind() switch
                    {
                        JsonValueKind.True => 1L,
                        JsonValueKind.False => 0L,
                        JsonValueKind.Number => d.GetValue<double>() != 0 ? 1L : 0L,
                        _ => DBNull.Value
                    };

                case KolonTipi.Tamsayi:
                    if (d.GetValueKind() != JsonValueKind.Number) return DBNull.Value;
                    return (long)Math.Round(d.GetValue<double>(), MidpointRounding.AwayFromZero);

                case KolonTipi.Gram:
                    if (d.GetValueKind() != JsonValueKind.Number) return DBNull.Value;
                    // kg → gram. decimal(18,3)'ün taşıdığı her değer tam sayıdır,
                    // kayıp yoktur. SQL Server'a geçişte: CAST(x AS decimal(18,3))/1000
                    return (long)Math.Round(d.GetValue<double>() * 1000.0, MidpointRounding.AwayFromZero);

                default:
                    return DBNull.Value;
            }
        }
        catch (Exception)
        {
            // Beklenmedik tip — kolon boş kalır, Ham yine de tam veriyi taşır.
            return DBNull.Value;
        }
    }

    /// <summary>
    /// Bütünlük kontrolü. <paramref name="dosya"/> verilmezse CANLI veritabanı
    /// denetlenir (sağlık ucu bunu kullanır); verilirse o dosya salt okunur
    /// açılır ve denetlenir.
    ///
    /// Yedek sonrası denetim, ÜRETİLEN DOSYA üzerinde yapılmalıdır (BUG-014,
    /// 30.08.2026): eskiden Yedekle'nin döndürdüğü yol atılıyor ve Denetle()
    /// canlı veritabanını açıyordu — bozuk bir yedek "sağlam" görünüyor,
    /// 7 kopyalık rotasyonda sağlam yedekleri yaşlandırıp düşürüyordu.
    /// SQLITE-MIMARI-KARARI.md §6 planı zaten "yedek dosyası üzerinde
    /// integrity_check" diyordu. VACUUM INTO çıktısı normal bir SQLite
    /// dosyasıdır ve ayrı bağlantıyla doğrulanır.
    /// </summary>
    public (string Butunluk, int YabanciAnahtarKusuru, long SatirSayisi) Denetle(string? dosya = null)
    {
        using var b = dosya is null ? Ac() : AcSaltOkunur(dosya);

        string butunluk;
        using (var k = b.CreateCommand())
        {
            k.CommandText = "PRAGMA integrity_check;";
            butunluk = k.ExecuteScalar() as string ?? "bilinmiyor";
        }

        int kusur;
        using (var k = b.CreateCommand())
        {
            k.CommandText = "PRAGMA foreign_key_check;";
            using var oku = k.ExecuteReader();
            kusur = 0;
            while (oku.Read()) kusur++;
        }

        long satir = 0;
        foreach (var t in Sema.Tablolar)
        {
            using var k = b.CreateCommand();
            k.CommandText = $"SELECT COUNT(*) FROM {t.SqlAd};";
            satir += Convert.ToInt64(k.ExecuteScalar(), CultureInfo.InvariantCulture);
        }

        return (butunluk, kusur, satir);
    }

    /// <summary>
    /// Yedek. VACUUM INTO kullanılır — çalışan uygulamayı durdurmaz ve tek
    /// parça tutarlı dosya üretir.
    ///
    /// .db dosyasını KOPYALAMAK GÜVENLİ DEĞİLDİR: WAL modunda yanındaki -wal
    /// dosyası veritabanının kalıcı durumunun parçasıdır, tek başına kopyalanan
    /// .db commit edilmiş işlemleri kaybettirir. SQLITE-MIMARI-KARARI.md §6.
    /// </summary>
    public string Yedekle(string hedefKlasor, DateTimeOffset simdi)
    {
        Directory.CreateDirectory(hedefKlasor);
        var ad = $"yu-{simdi:yyyy-MM-dd-HHmm}.db";
        var hedef = Path.Combine(hedefKlasor, ad);
        if (File.Exists(hedef)) File.Delete(hedef);

        using var b = Ac();
        using var k = b.CreateCommand();
        k.CommandText = "VACUUM INTO $h;";
        k.Parameters.AddWithValue("$h", hedef);
        k.ExecuteNonQuery();

        _gunluk.LogInformation("Yedek alındı: {Hedef}", hedef);
        return hedef;
    }
}

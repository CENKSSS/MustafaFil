<!-- 26.08.2026. 5 konuda 137 bulgu arastirildi; 22 kritik iddia adversarial
     dogrulamadan gecirildi, 3'u duzeltildi. -->

> **BAGIMSIZ DOGRULAMA (26.08.2026)** — bu dokumandaki olcumler ayrica elle teyit edildi:
>
> | Iddia | Dokuman | Bagimsiz olcum | Durum |
> |---|---|---|---|
> | Tum JSON paketi | 861.808 bayt | **862.032 bayt (842 KB)** | tutuyor |
> | Bir gunun yazmasi | 3.469 bayt | **3.141 bayt** | ayni buyukluk |
> | Yazma buyutme orani | 248 kat | **274 kat** | tutuyor |
> | Is kurali satir sayisi | 3.007 (2010+933+64) | **3.007** | birebir |
> | SQLite surumu | 3.45.1 | **3.45.1** (Python 3.11.9) | birebir |
> | Miktarlar tamsayi grama sigar mi | evet | **5.859 degerin 5.859'u sigdi, 0 istisna** | dogrulandi |
>
> IIS ve PowerShell komutlari **calistirilmadi** — bu makinede IIS kurulu degil.

---

# SQLite Mimarisi — Karar Dokümanı

**Tarih:** 26.08.2026 · **Durum:** karar önerisi, uygulanmadı
**Ölçümler:** bu makinede Python 3.11.9 / SQLite **3.45.1** ile çalıştırıldı. IIS komutları **çalıştırılmadı** (aşağıda ayrıca işaretli).

---

## 0. Önce bir uyarı

Kullanıcı kararı "veriler SQLite'ta tutulacak". Şartname (`sartname-duz.txt` satır 311) **Demirbaş** başlığı altında şunu yazıyor:

> Değişmeyen teknik temeller **Demirbaş** — Veritabanı SQL Server (mevcut sunucuda duruyor).

Bu doküman "SQLite seçilirse doğru mimari nedir" sorusunu yanıtlar. Şartname çelişkisi **§8'de** ayrıca ele alınıyor ve KURAL 6 gereği teslim edilecek üründe **uygulanmaz**.

---

## 1. ŞEMA KARARI — Tek JSON paketi mi, 8 normal tablo mu?

### Karşılaştırma

| Ölçüt | Tek JSON paketi (1 satır) | 8 normal tablo |
|---|---|---|
| **İstemci kod değişikliği** | Küçük: `depo.oku`/`depo.kaydet` (01-cekirdek.js) + 26 çağrı yeri + 59 servis çağrısının async'e dönmesi | Büyük: 3.007 satır iş kuralı (04-servis 2010 + 03-dogrulama 933 + 02-hesap 64) sunucuya taşınır |
| **Eşzamanlılık** | Tek satır = tek sürüm. Ahmet ve Hatice **farklı günleri** kaydetse bile biri 409 alır | Farklı satır = çakışma yok. Yalnız aynı satıra dokunanlar çakışır |
| **Veri hacmi / kayıt** | Ölçüldü: **861.808 bayt** (842 KB) ham JSON, 158 günlük tek kampanya. Her kayıtta bu boyut gider | Ölçüldü: bir günün yazması **3.469 bayt** (GunlukHareket 1.846 + SiloHareket 1.363 + KuruKuspeGunluk 260). Oran **248 kat** |
| **SQL Server'a geçiş** | Sıfır taşınabilirlik. SQL Server'da da tek NVARCHAR(MAX) satırı olur; şema yeniden yazılır | Doğrudan. Tablolar, kısıtlar, `decimal(18,3)`, `rowversion` birebir karşılık bulur |
| **Denetim izi** | DegisiklikLog paketin içinde. "Kim neyi değiştirdi" sorgulanamaz, tüm paket okunup ayrıştırılır | DegisiklikLog tablo. Tarih/kullanıcı/tablo indeksli sorgulanır |
| **decimal** | JSON sayısı = IEEE-754 çift duyarlık = **float**. Demirbaş "asla float" kuralı doğrudan ihlal | Kolon başına tip seçilir (bkz. §4) |
| **Tekillik kısıtı** | Yok. `(Tarih, MalzemeId)`, `Tarih`, `KullaniciAdi`, `Ad` hiçbiri veritabanınca zorlanamaz | `UNIQUE` kısıtı motor tarafından zorlanır |
| **D16 / RowVersion** | Paket başına **tek** sürüm. Şartname kayıt başına istiyor | Satır başına `Surum` kolonu |

### KARAR: 8 normal tablo (+ DegisiklikLog + 4 arşiv tablosu = 13 tablo)

**Neden — tercih değil, zorunluluk:**

1. **Şartname satır 156, Demirbaş:** *"Sekiz tablo yeterli **Demirbaş**. Alan adlarını değiştirebilirsin ama **ilişkileri ve tekillik kısıtlarını koru** — kuralların çoğu oralarda saklı."* Tek JSON paketinde ilişki de kısıt da yoktur. KURAL 6 gereği bu yol **kapalıdır**.
2. **Şartname satır 163, Kritik kural:** `(Tarih, MalzemeId)` benzersiz olmalı. JSON paketi bunu zorlayamaz; çift sayım yasağı (Test 6) veritabanı tarafında hiçbir şeyle korunmaz.
3. **D16 çalışmaz.** Şartname D16 kayıt bazlı RowVersion istiyor (satır 181-182: `KuruKuspeGunluk.RowVersion`, `GunlukHareket.RowVersion`). Tek paketle her ikinci kayıt çakışır — §5'teki senaryo bunu gösteriyor.
4. **decimal ihlali.** JSON sayısı floattır. Demirbaş madde: "Miktar alanları decimal, asla float."

Mevcut kodun 13 tablosu zaten hazır (`01-cekirdek.js:836-858`): sekiz sözleşme tablosu + `DegisiklikLog` + `OlayGunlugu`, `SilinenKayitlar`, `StokFotograflari`, `KampanyaKilitleri`. Son dördü kodun kendi yorumunda "SÖZLEŞME §1 dışıdır" diye işaretli — şemaya girer, sekiz tablo sözleşmesini bozmaz.

### ARA YOL — önerilen geçiş biçimi

Şema 8 tablo olur, **ama istemci bir gecede değişmez**:

| Aşama | Sunucu | İstemci |
|---|---|---|
| 1 | 13 normal tablo. `GET /api/paket` tabloları okuyup **bugünkü JSON paketini birebir üretir** | `depo.oku()` yalnız bu ucu çağırır. 15 ekran dosyasının **hiçbiri değişmez** |
| 2 | 14 yazma ucu (her `YU.servis.*` fonksiyonuna bir uç), iş kuralı sunucuda | `depo.kaydet()` yerine ilgili uç çağrılır |
| 3 | Okuma uçları bölünür (stok, rapor, hareket) | `GET /api/paket` emekliye ayrılır |

Bu, şemayı doğru yapar ve istemci göçünü parçalar. Paket **yazmada asla** kullanılmaz — yalnız okumada, geçici olarak.

---

## 2. SUNUCU KARARI

| Ölçüt | ASP.NET Core (.NET 8) | Python + waitress | Node + better-sqlite3 |
|---|---|---|---|
| **Şartname uyumu** | Demirbaş: .NET 8 · Blazor · MudBlazor · Dapper (satır 303-307) | Şartname dışı | Şartname dışı |
| **Sunucu ön koşulu** | **1 kurulum**: .NET 8 Hosting Bundle (runtime + ASP.NET Core Module birlikte) | 3 parça: Python + HttpPlatformHandler MSI + waitress wheel | 3 parça: Node 22+ + HttpPlatformHandler MSI + önceden hazırlanmış `node_modules` |
| **IIS entegrasyonu** | Yerleşik, in-process, varsayılan | HttpPlatformHandler (ayrı MSI, son sürüm v1.2) | HttpPlatformHandler (aynı) |
| **İnternete kapalı kurulum** | Tek offline `.exe` taşınır | MSI + wheel'ler elle taşınır | `node_modules` derleme makinesinde hazırlanıp kopyalanır; sunucuda `npm install` çalıştırılamaz |
| **Transaction varsayılanı** | `BeginTransaction()` → **BEGIN IMMEDIATE** (efcore kaynak kodundan doğrulandı) | Varsayılan **DEFERRED** — "oku sonra yaz" akışında SQLITE_BUSY üretir, elle düzeltilmeli | `better-sqlite3`'te elle yönetilir |
| **BUSY yeniden deneme** | Kütüphane kendiliğinden dener, komut zaman aşımı 30 sn | Elle yazılır | Elle yazılır |
| **decimal** | `decimal` yerel tip, `System.Decimal` | `decimal.Decimal` stdlib | **Yerel decimal yok** — `Number` float |
| **İş kuralının portu** | 3.007 satır ES5 → C# | 3.007 satır ES5 → Python | 3.007 satır ES5 → JS (**en ucuz port**) |
| **Ömür** | .NET 8 desteği 10.11.2026'da bitiyor (şartname bunu bilerek kabul etti, satır 316-317) | Python 3.13: 2029 | Node 24: 2028 |

### KARAR: ASP.NET Core (.NET 8)

**Neden:**
1. Şartname zaten bunu söylüyor. Sunucu yığınını değiştirmek ikinci bir Demirbaş ihlali olur.
2. En az parça: tek Hosting Bundle hem çalışma zamanını hem IIS modülünü kurar. İnternete kapalı fabrika sunucusunda bu belirleyici.
3. `decimal` yerel tip. Node'da yok — "asla float" kuralını dilin kendisi zorlaştırır.
4. `BeginTransaction()` zaten IMMEDIATE açıyor; §5'teki en tehlikeli hata sınıfı varsayılan davranışla kapanıyor.

**Not:** Şartname arayüz için **Blazor Web App (Interactive Server)** diyor, minimal API demiyor. Minimal API yalnız §1'deki **ara yolda**, mevcut tarayıcı istemcisinin veri katmanı olarak meşrudur. Teslim edilecek arayüz Blazor'dur.

### IIS kurulumu — adım adım

> **DOĞRULANMADI:** Aşağıdaki komutlar bu makinede çalıştırılmadı. Kaynak: Microsoft Learn (ASP.NET Core Module / IIS barındırma). Sunucuda uygulanmadan önce satır satır teyit edilmeli.

```powershell
# 1) Ön kontrol (şartname satır 330 bunu zaten şart koşuyor)
dotnet --list-runtimes
Get-Service W3SVC

# 2) IIS kurulu değilse ÖNCE IIS
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -All

# 3) SONRA Hosting Bundle (sıra önemli: bundle önce kurulduysa /repair şart)
.\dotnet-hosting-8.0.x-win.exe /install /quiet /norestart
net stop was /y ; net start w3svc

# 4) Klasörler
New-Item -ItemType Directory -Force C:\YanUrunler\app
New-Item -ItemType Directory -Force C:\YanUrunler\veri
New-Item -ItemType Directory -Force C:\YanUrunler\yedek
New-Item -ItemType Directory -Force C:\YanUrunler\log

# 5) Uygulama havuzu — havuz PAYLAŞILMAZ, .NET CLR yok
Import-Module WebAdministration
New-WebAppPool -Name "YanUrunler"
Set-ItemProperty IIS:\AppPools\YanUrunler -Name managedRuntimeVersion -Value ""
Set-ItemProperty IIS:\AppPools\YanUrunler -Name startMode -Value AlwaysRunning

# 6) Örtüşen geri dönüşümü kapat — iki w3wp aynı .db'ye bağlanmasın
Set-ItemProperty IIS:\AppPools\YanUrunler -Name recycling.disallowOverlappingRotation -Value $true

# 7) Site
New-Website -Name "YanUrunler" -Port 8080 -PhysicalPath "C:\YanUrunler\app" -ApplicationPool "YanUrunler"

# 8) İZİNLER — .db DEĞİL, KLASÖR yazılabilir olmalı (-wal ve -shm burada oluşur)
icacls "C:\YanUrunler\veri"  /grant "IIS AppPool\YanUrunler:(OI)(CI)M"
icacls "C:\YanUrunler\yedek" /grant "IIS AppPool\YanUrunler:(OI)(CI)M"
icacls "C:\YanUrunler\log"   /grant "IIS AppPool\YanUrunler:(OI)(CI)M"

# 9) Yayın
dotnet publish -c Release -o C:\YanUrunler\app

# 10) Güncelleme (resmi yol)
New-Item C:\YanUrunler\app\app_offline.htm -ItemType File
# ... dosyaları değiştir ...
Remove-Item C:\YanUrunler\app\app_offline.htm
```

**Değişmez kural:** `.db` dosyası **C:\YanUrunler\veri\** içinde, sunucunun yerel diskinde durur. Ağ paylaşımına (`\\sunucu\pay\...`) **asla** konmaz. WAL paylaşımlı bellek gerektirir, ağ dosya sisteminde çalışmaz; WAL kapatılsa bile ağ üzerinde kilitleme hataları veri bozulmasına yol açar. Yedek kopyaları ağa **taşınabilir**; çalışan dosya taşınamaz.

---

## 3. SQLITE AYARLARI

| PRAGMA | Değer | Kalıcı mı? | Neden |
|---|---|---|---|
| `journal_mode` | `WAL` | **Evet** — dosyada saklanır, bir kez | Yazar okuyucuyu engellemez. **Ölçüldü:** A yazarken D okuma yaptı, engellenmedi; eski değeri gördü, commit sonrası yenisini. Varsayılan rollback modda tüm dosya EXCLUSIVE kilitlenir ve rapor "database is locked" alır |
| `synchronous` | `FULL` (=2) — UPS teyit edilirse `NORMAL` (=1) | **Hayır** — her bağlantıda | Bkz. §6. **Ölçüldü:** yeni bağlantıda değer 2'ye döndü |
| `busy_timeout` | `5000` (ms) | **Hayır** — her bağlantıda | **Ölçüldü:** ikinci yazar, `busy_timeout=0` iken **6,0 ms**'de `database is locked` hatası aldı. `timeout=3000` iken **325,5 ms** bekledi ve **yazdı** — iki satır da kaydedildi |
| `foreign_keys` | `ON` | **Hayır** — her bağlantıda | **Ölçüldü:** varsayılan **0 (KAPALI)**. Yeni bağlantıda yine 0. Açılmazsa MalzemeId/SiloId referansları hiç kontrol edilmez |

**Kaynaklar:** sqlite.org/wal.html, sqlite.org/pragma.html, sqlite.org/rescode.html — hepsi araştırma aşamasında birebir alıntıyla doğrulandı.

### Bağlantı açılış sırası (her istekte)

```sql
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = FULL;
-- journal_mode=WAL yalnız kurulum betiğinde, bir kez
```

### Ek zorunlu kurallar

- **Her yazma işlemi `BEGIN IMMEDIATE` ile açılır.** `Microsoft.Data.Sqlite`'ta `conn.BeginTransaction()` bunu zaten yapıyor (efcore kaynak kodundan doğrulandı: `IsolationLevel.Unspecified` → `deferred:false` → `"BEGIN IMMEDIATE;"`). **`deferred: true` asla geçilmez.** Sebep: DEFERRED'de "önce oku, hesapla, sonra yaz" akışı yükseltme sırasında `SQLITE_BUSY` / `SQLITE_BUSY_SNAPSHOT` alır ve bunu beklemek çözmez — işlem baştan çalıştırılmalıdır.
- **Bağlantı dizesine `Cache=Shared` yazılmaz.** WAL ile birlikte kullanımı önerilmiyor.
- **Her istekte yeni `SqliteConnection`.** .NET nesneleri thread-safe değil; singleton bağlantı tutulmaz.
- **Uzun rapor sorguları açık transaction içinde tutulmaz.** WAL'de sürekli üst üste binen okuyucular checkpoint'in tamamlanmasını engeller, WAL dosyası büyür.

> **DOĞRULANMADI:** SQLite'ın kendi `busy_timeout` varsayılanının 0 olduğunu bu oturumda kanıtlayamadım — ölçtüğüm 5000 değeri Python'un `connect(timeout=5.0)` ayarından geliyor. .NET tarafında `Microsoft.Data.Sqlite` busy/locked hatalarını komut zaman aşımına (varsayılan 30 sn) kadar kendiliğinden yeniden deniyor.

---

## 4. DECIMAL SORUNU

Demirbaş kural: *"Miktar alanları decimal, asla float"* (satır 314). Şartname hassasiyeti de veriyor: **`decimal(18,3)`** (satır 178).

### Neden diğer yollar yetmiyor — ölçümle

**a) `DECIMAL(18,3)` diye kolon tanımlamak yetmez.** SQLite'ta tip yalnız *yakınlıktır (affinity)*, zorlama değil.

```
CREATE TABLE d(a DECIMAL(18,3), b NUMERIC);
INSERT INTO d VALUES(240000.123, 240000.123);
SELECT typeof(a), typeof(b);  →  ('real', 'real')
```

Kolon adı DECIMAL olsa da **saklanan tip REAL, yani float**. Demirbaş kural yazıldığı anda ihlal edilmiş olur.

**b) REAL doğrudan yanlış toplar.**

```
SELECT 0.1 + 0.2;        →  0.30000000000000004
SELECT 0.1+0.2 = 0.3;    →  0
```

D3/D5/D13 kuralları ±0,01 toleransıyla çalışıyor. Yüzlerce satırın toplamında float hatası bu toleransa doğru yürür; "dağıtım toplamı tutmuyor" hatası **rastgele** tetiklenmeye başlar.

**c) TEXT yetmez.** `typeof` 'text' kalır, ama `SUM()` çağırdığın anda SQLite REAL'e çevirir — (b)'ye geri düşersin. Karşılaştırma da sözlük sırasına göre yapılır: `'9' > '10'`.

### KARAR: Miktarlar INTEGER olarak **gram** cinsinden saklanır

`decimal(18,3)` = kg cinsinden üç ondalık = **gram**. Yani `kg × 1000`, tam sayı.

```sql
UretilenDokme  INTEGER NOT NULL,  -- gram (kg × 1000)
Kapasite       INTEGER NOT NULL,  -- gram
```

**Neden bu doğru:**

| Kontrol | Sonuç |
|---|---|
| Kayıp var mı? | Yok. `decimal(18,3)`'ün taşıdığı her değer tam sayıdır |
| Aritmetik tam mı? | **Ölçüldü:** `240000123 + 1 = 240000124`. Tam |
| Aralık yeter mi? | int64 / 1000 = **9.223.372.036.854.775 kg**. Silo kapasitesi 3.000.000 kg. Fazlasıyla yeter |
| SQL Server'a geçiş? | `CAST(kg_gram AS decimal(18,3)) / 1000` — tek satır, kayıpsız |
| C# tarafı? | Dapper `long` okur, `deger / 1000m` ile `decimal`e çevrilir. **Float dile hiç girmez** |

**Sınır:** Dönüşüm tek yerde yapılır (`MiktarDonusturucu` gibi tek sınıf). Ekran ve hesap katmanı yalnız `decimal` görür; `long` sadece veri katmanında yaşar. `double`/`float` kod tabanında hiç geçmez — bu bir derleme kuralı olarak tutulmalı.

---

## 5. EŞZAMANLILIK — 3 kullanıcı aynı anda kaydederse

### Senaryo A: Ahmet 24.08'i, Hatice 25.08'i **aynı anda** kaydediyor

**8 normal tabloyla:**

| An | Ahmet (24.08) | Hatice (25.08) |
|---|---|---|
| 0 ms | `BEGIN IMMEDIATE` — yazma kilidini aldı | `BEGIN IMMEDIATE` — kilit dolu, **bekliyor** |
| 0–320 ms | Eski silo hareketlerini sil → KuruKuspeGunluk yaz → SiloHareket yaz → GunlukHareket upsert | bekliyor |
| ~320 ms | `COMMIT` — kilit serbest | Kilidi aldı, kendi işlemini yapıyor |
| ~650 ms | — | `COMMIT` |

**İkisi de başarılı.** Kimse hata görmez. Kimse bir şey kaybetmez.

Bu tahmin değil, **ölçüm**: WAL modunda tutulan yazma kilidi karşısında ikinci yazar `busy_timeout=3000` ile **325,5 ms bekledi ve yazdı**; sonrasında tabloda iki satır vardı. Aynı deney `busy_timeout=0` ile **6,0 ms'de `database is locked`** hatası verdi — `busy_timeout` ayarlanmadan üretime çıkılmaz.

Bu arada Mehmet Stok Durumu raporunu açarsa: **engellenmez**. WAL'de okuyucu yazarı beklemez. Ölçüldü: A yazarken D okuma yaptı, eski tutarlı görüntüyü gördü, commit sonrası yenisini.

**Tek JSON paketiyle aynı senaryo:** İkisi de aynı satırı yazar. Biri **409** alır ve **tüm gününü** yeniden girmek zorunda kalır — hâlbuki farklı günlere dokunuyorlardı. Şemanın neden 8 tablo olması gerektiğinin en somut kanıtı budur.

### Senaryo B: İkisi de **25.08'i** kaydediyor — gerçek çakışma

Burada D16 devreye girer. SQLite'ta SQL Server'ın `rowversion`'ı **yoktur**; sürüm uygulama tarafından yönetilir.

Her kritik tabloya `Surum INTEGER NOT NULL DEFAULT 1` kolonu eklenir.

```sql
UPDATE KuruKuspeGunluk
   SET UretilenDokme = @yeni, Surum = Surum + 1,
       GuncelleyenKullaniciId = @kid, GuncellemeTarihi = @simdi
 WHERE Id = @id AND Surum = @okunanSurum;
```

**Ölçüldü:**
- Doğru sürümle → `rowcount = 1` → COMMIT
- Eski sürümle → `rowcount = 0` → ROLLBACK

`rowcount = 0` ise D16 tetiklenir: işlem reddedilir, hiçbir şey yazılmaz.

**Kullanıcı ne görür:**

> **Kaydedilemedi.** 25.08.2026 kaydını siz açtıktan sonra Hatice Yılmaz değiştirdi (14:32). Sayfayı yenileyin, güncel rakamlara bakıp tekrar kaydedin.

Bu cümle KURAL 11'e uygundur: bir engeli anlatıyor ve kullanıcı bir karar veriyor. Sayaç veya teselli cümlesi değil.

### İki mekanizma, iki ayrı iş

| Mekanizma | Neyi çözer | Süre ölçeği |
|---|---|---|
| `BEGIN IMMEDIATE` + `busy_timeout` | İki bağlantının **aynı milisaniyede** yazmaya çalışması | ms |
| `Surum` kolonu (D16) | Kullanıcının ekranı **dakikalar önce** okumuş olması | dk |

Biri diğerinin yerine geçmez. İkisi birlikte kurulur.

### Mevcut kodun karşılığı

Bugün `01-cekirdek.js:1079-1086` **tam olarak bu deseni** yapıyor: `depo.kaydet()` önce `yazmaSayaciOku()` ile sayacı okuyor, beklenenden farklıysa **yazmıyor** ve `kancayiCagir("cakisma")` çağırıyor. Fark tek: bugün **tüm paket için tek sayaç** var, yarın **her satır için ayrı sürüm** olacak. Yani yanlış çakışma sayısı düşecek.

---

## 6. YEDEK VE DAYANIKLILIK

### Elektrik kesintisi — ne kaybedilir

| Ayar | Uygulama çökerse | Elektrik giderse / sistem çökerse | Bozulma riski |
|---|---|---|---|
| `synchronous=FULL` (varsayılan, =2) | Hiçbir şey | Hiçbir şey | Yok |
| `synchronous=NORMAL` (=1) | Hiçbir şey | **Son commit edilmiş işlem geri alınabilir** | Yok — WAL'de NORMAL bozulmaya karşı güvenli |

Kaynak: sqlite.org/pragma.html — *"WAL mode is safe from corruption with synchronous=NORMAL... A transaction committed in WAL mode with synchronous=NORMAL might roll back following a power loss."*

**KARAR: `synchronous=FULL`'de kalınır.**

Neden: Fabrikada günde birkaç yüz yazma var. FULL'ün maliyeti bu hacimde önemsiz. Kayıp senaryosu ise ciddi: operatör 25.08 girişini yapar, "kaydedildi" görür, elektrik gider, kayıt yoktur — ertesi gün stok tutmaz ve **kimse neden tutmadığını bilmez**.

`NORMAL`'e ancak şu koşulda geçilir: sunucuda çalışan bir UPS **teyit edilmişse** ve yazma hızı ölçülüp yetersiz bulunmuşsa. Bu bir karar noktasıdır, kullanıcıya sorulur.

> **DOĞRULANMADI:** Fabrika sunucusunda UPS olup olmadığı bilinmiyor.

### Yedek — dosya kopyalamak GÜVENLİ DEĞİL

WAL modunda `.db` yanında `-wal` ve `-shm` dosyaları oluşur (**ölçüldü**). `-wal` dosyası veritabanının kalıcı durumunun parçasıdır; `.db`'yi tek başına kopyalamak commit edilmiş işlemleri kaybettirir veya kopyayı bozar. `-shm` kopyalanmasa da olur; kritik olan `-wal`'dir.

**Doğru komut — `VACUUM INTO`:**

```sql
VACUUM INTO 'C:\YanUrunler\yedek\yu-2026-08-26-2200.db';
```

**Ölçüldü:** SQLite 3.45.1 ile çalıştı, tutarlı ve tek parça bir dosya üretti. Çalışan uygulamayı durdurmaz. Çıktı sıkıştırılmış (VACUUM'lanmış) tek dosyadır; ağ paylaşımına kopyalanabilir — çünkü artık canlı veritabanı değil, durağan bir dosyadır.

### Sıklık ve kopya sayısı

| Ne zaman | Nereye | Kaç kopya tutulur |
|---|---|---|
| Her gece 22:00 | `C:\YanUrunler\yedek\gunluk\` | **7** (bir hafta) |
| Her pazar 22:30 | `C:\YanUrunler\yedek\haftalik\` | **4** (bir ay) |
| Kampanya kilitlendiğinde | `C:\YanUrunler\yedek\kampanya\` | **süresiz** |
| Haftada bir | Ağ paylaşımı / harici disk | **4** |

Aynı diskte duran yedek, disk arızasına karşı yedek değildir. En az bir kopya sunucu dışında olmalı.

### Bozulma kontrolü

Her yedekten **sonra**, yedek dosyası üzerinde:

```sql
PRAGMA integrity_check;   -- beklenen: ok
PRAGMA foreign_key_check; -- beklenen: boş sonuç
```

**Ölçüldü:** ikisi de sırasıyla `ok` ve boş döndü. Sonuç `ok` değilse yedek silinmez, bir önceki yedek korunur ve olay günlüğüne yazılır.

### Zamanlanmış görev

> **DOĞRULANMADI:** Aşağıdaki komut çalıştırılmadı.

```powershell
schtasks /Create /TN "YanUrunler-Yedek" ^
  /TR "C:\YanUrunler\app\YanUrunler.Yedek.exe" ^
  /SC DAILY /ST 22:00 /RU "SYSTEM" /RL HIGHEST
```

Yedek işini ayrı bir küçük konsol uygulaması yapar; `sqlite3.exe` sunucuya kurulmaz (Microsoft.Data.Sqlite yerel motoru zaten paketle geliyor).

---

## 7. YAPILACAKLAR

1. `sartname-duz.txt` §10'daki SQL Server çelişkisi kullanıcıya sorulur — cevap gelmeden kod yazılmaz (bkz. §8).
2. Kurulum betiği yazılır: 13 tablo, tekillik kısıtları, `Surum` kolonları, `PRAGMA journal_mode=WAL`, başlangıç verisi; ikinci çalıştırmada hata vermez.
3. Tüm miktar kolonları `INTEGER` (gram) tanımlanır; `REAL` hiçbir miktar kolonunda kullanılmaz.
4. `MiktarDonusturucu` sınıfı yazılır: `long` ↔ `decimal` dönüşümünün **tek** yeri.
5. `VeritabaniFabrikasi` yazılır: her istekte yeni bağlantı + `busy_timeout=5000` + `foreign_keys=ON` + `synchronous=FULL`.
6. `02-hesap.js` (64 satır) → `KuruKuspeHesaplayici` saf sınıfına portlanır, önce testi yazılır.
7. `03-dogrulama.js` (933 satır, D1–D18) → `DogrulamaKurallari` sınıfına portlanır; her kural için tek test.
8. `04-servis.js`'teki 14 `YU.servis.*` yazma fonksiyonu (satır 1932-1998) sunucuda birer `BEGIN IMMEDIATE` transaction'ına dönüşür.
9. Her yazma işlemine `UPDATE ... WHERE Id=? AND Surum=?` + `rowcount=0 → ROLLBACK + D16` deseni eklenir.
10. `GET /api/paket` ucu yazılır: 13 tabloyu okuyup `01-cekirdek.js`'in `paketKur()` çıktısıyla **birebir aynı** JSON'u üretir (ara yol, §1).
11. `01-cekirdek.js` `oku()` (satır ~1035) `GET /api/paket` çağıracak biçimde değiştirilir; `paketGecerliMi()` doğrulaması **aynen korunur**.
12. `01-cekirdek.js` `depo.kaydet()` (satır 1079) kaldırılır; yerine her `YU.servis.*` çağrısı kendi ucunu çağırır — 26 çağrı yeri gözden geçirilir.
13. `04-servis.js`'teki 14 servis + bunları çağıran 59 ekran satırı `async`/`await`'e çevrilir; "kaydedildi" bildirimi **sunucu yanıtından sonra** gösterilir.
14. Sunucu **409/D16** dönerse istemci mevcut `YU.depoUyari('cakisma')` kancasını çağırır — `10-kabuk.js:1291-1305` zaten kırmızı şeridi ve `yazmaDurdu` bayrağını kuruyor, **yeniden yazılmaz**.
15. `10-kabuk.js:1310-1314` `storage` olayı dinleyicisi kaldırılır; yerine 15 saniyede bir `GET /api/surum` yoklaması konur, sürüm değişmişse aynı `cakisma` şeridi çıkar.
16. `10-kabuk.js:1258` `yazmaDurdu` bayrağı ve `3159`'daki "başarı bildirimi bastırma" davranışı **korunur** — "kaydedildi" yalanına karşı tek koruma budur.
17. `40-kabul-testleri.js`'teki testler xUnit'e taşınır; şartname satır 349 gereği **gerçek veritabanına karşı** koşulur, in-memory sağlayıcıyla değil.
18. Yedek konsol uygulaması yazılır: `VACUUM INTO` + `integrity_check` + `foreign_key_check` + rotasyon.
19. IIS kurulumu §2'deki adımlarla yapılır; `.db` dosyası `C:\YanUrunler\veri\` içinde, **ağ paylaşımında değil**.
20. Kurulum notu yazılır: nasıl derlenir, nasıl çalıştırılır, ilk giriş, yedek nereden alınır (şartname §12 Demirbaş).

### Mevcut yazma sayacı ve `cakisma` kancası nasıl kullanılacak

Kanca **atılmaz, yeniden kullanılır**. Bugünkü akış:

```
depo.kaydet()  →  sayaç değişmiş  →  kancayiCagir("cakisma")
                                  →  YU.depoUyari('cakisma')
                                  →  10-kabuk.js: yazmaDurdu = true + kırmızı şerit
```

Yarınki akış:

```
POST /api/gun    →  sunucu rowcount=0 gördü  →  409 döner
                 →  istemci YU.depoUyari('cakisma')
                 →  AYNI kırmızı şerit, AYNI yazmaDurdu bayrağı
```

Değişen tek şey, çakışmanın **nereden haber verildiği**. Kullanıcının gördüğü ekran davranışı aynı kalır. `yu.veri.sayac` anahtarı (`01-cekirdek.js:829`) ve `yazmaSayaciOku()` fonksiyonu emekliye ayrılır; işlevi `Surum` kolonuna geçer.

---

## 8. ŞARTNAME UYARISI

### Çelişki nettir

`sartname-duz.txt` satır 311, **"Değişmeyen teknik temeller — Demirbaş"** başlığı altında:

> Veritabanı **SQL Server** (mevcut sunucuda duruyor).

Satır 307, teknoloji yığını tablosunda:

> Veritabanı · v1: SQL Server · v2: SQL Server · Gerekçe: **Sunucuda zaten duruyor**

Satır 33:

> Demirbaş işaretli her madde v1'den birebir gelir ve **tartışmaya kapalıdır**.

**SQLite kararı bu Demirbaş maddeyle doğrudan çelişiyor.**

CLAUDE.md KURAL 6 bu durumda ne yapılacağını yazıyor: *"Kullanıcı yanlış talimat verirse düzeltilir ve talimat UYGULANMAZ... kullanıcı ısrar etse bile."*

### Ek olarak: SQLite'ı seçmenin olağan gerekçesi burada yok

SQLite genelde "sunucuya bir şey kurmak istemiyoruz" diye seçilir. Şartname bu gerekçeyi baştan çürütüyor: SQL Server **zaten sunucuda duruyor**. Yani SQLite bir kurulum yükünden kurtarmıyor — yalnız Demirbaş maddeyi ihlal ediyor.

Şartname ayrıca SQL Server'a özgü iki şeyi kural olarak yazmış:
- **satır 181-182:** `KuruKuspeGunluk.RowVersion`, `GunlukHareket.RowVersion` — tip: `rowversion`. SQLite'ta bu tip **yoktur**; elle `Surum` kolonu yazılır (§5).
- **satır 178:** `decimal(18,3)`. SQLite'ta bu tip **yoktur**; gram/INTEGER hilesi gerekir (§4).

Yani SQLite iki Demirbaş maddeyi de "taklit ederek" karşılıyor. Taklit çalışır, ama şartnamenin yazdığı şey değildir.

> **DOĞRULANMADI:** SQL Server'ın fabrika sunucusunda gerçekten kurulu olduğunu doğrulayamadım. Şartname satır 330 yalnız Hosting Bundle'ın teyit edilmesini istiyor. `sqlcmd -L` veya `Get-Service MSSQL*` ile sunucuda kontrol edilmeli.

### Nerede kabul edilebilir, nerede edilemez

| Durum | Karar | Gerekçe |
|---|---|---|
| **Geliştirme makinesinde geçici köprü** — SQL Server kurulu değilken şema ve iş kuralı geliştirmek | **Kabul edilebilir** — koşullu | Şema **SQL Server'a göre** yazılır, SQLite ona ayna tutar. Tüm miktarlar gram/INTEGER, tüm sürümler `Surum` kolonu. Kod hiçbir SQLite'a özgü sözdizimi kullanmaz |
| **Mevcut tarayıcı prototipini ağa taşımak** (ara yol §1, teslim öncesi ara sürüm) | **Kabul edilebilir** — koşullu | Kullanıcıya "bu geçici, teslim SQL Server olacak" diye **yazılı** bildirilmesi şartıyla |
| **Kabul testlerinin koşulduğu veritabanı** | **Kabul EDİLEMEZ** | Şartname satır 349 açık: *"Testleri in-memory sağlayıcıyla yazma. Unique kısıt, rowversion, decimal hassasiyeti ve transaction davranışı taklit edilmez... LocalDB veya Docker'da **gerçek SQL Server** kullan."* SQLite bu üçünü de taklit ediyor |
| **Teslim edilecek ürünün veritabanı** | **Kabul EDİLEMEZ** | Demirbaş madde. KURAL 6: talimat uygulanmaz |

### Yapılması gereken

Kod yazılmadan önce kullanıcıya tek soru sorulur:

> Şartname `Veritabanı SQL Server` maddesini **Demirbaş** işaretlemiş (satır 311) ve gerekçesini "sunucuda zaten duruyor" diye yazmış. SQLite kararı bu maddeyle çelişiyor. İki seçenek var:
> **(a)** SQLite yalnız geliştirme köprüsü olur, teslim SQL Server'dır — bu dokümandaki her şey aynen geçerli, `Surum`/gram çözümleri SQL Server'da `rowversion`/`decimal(18,3)`'e döner.
> **(b)** Teslim de SQLite olacaksa **şartnamenin kendisi güncellenmelidir** — Demirbaş bir madde ancak şartname değişirse değişir.

Cevap gelmeden §7'nin 2. maddesinden ötesine geçilmez.

---

**İlgili dosyalar:**
`C:\Users\cenk_\Desktop\MustafaFil\sartname-duz.txt`
`C:\Users\cenk_\Desktop\MustafaFil\yan-urunler-stok-takip\js\01-cekirdek.js`
`C:\Users\cenk_\Desktop\MustafaFil\yan-urunler-stok-takip\js\04-servis.js`
`C:\Users\cenk_\Desktop\MustafaFil\yan-urunler-stok-takip\js\10-kabuk.js`
`C:\Users\cenk_\Desktop\MustafaFil\yan-urunler-stok-takip\js\03-dogrulama.js`
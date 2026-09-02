# Denemelik Sunucu — Araştırma ve Uygulama Planı

**Tarih:** 27.08.2026 · **Durum:** plan, uygulanmadı
**Karar veren:** kullanıcı (27.08.2026) — SQLite köprü + mevcut ekranlar
**Hedef:** 3 kişi, fabrika yerel ağı, ortak veri. Halka açık değil.

---

## 0. Bir cümlede

Bugünkü ekranlar aynen kalır. Tarayıcının `localStorage`'ı yerine **fabrika
sunucusundaki bir SQLite veritabanı** geçer. Ekranların veri yazma biçimi
değişmez, yazdığı **yer** değişir.

Teslim edilecek ürün bu değildir. Şartname satır 311 **Demirbaş**: veritabanı
SQL Server. Bu sürüm, SQLITE-MIMARI-KARARI.md §8'deki **(a) şıkkıdır** —
geçici köprü, yazılı bildirimle.

---

## 1. Bu oturumda DOĞRULANANLAR

Tahmin değil, ölçüm/kaynak (KURAL 4.4).

| Ne | Nasıl doğrulandı | Sonuç |
|---|---|---|
| Bu PC'de IIS var mı | `HKLM:\SOFTWARE\Microsoft\InetStp` yok, `W3SVC`/`WAS` servisi yok | **Kurulu değil** |
| 8155 portunu kim dinliyor | `Get-CimInstance Win32_Process` | `python -m http.server` — IIS değil |
| Şu anki yayın neyi açıyor | `curl http://localhost:8155/…` | `web.config` → **200**, `.md` → **200**. Kaynak klasör açıkta |
| .NET sürümü | `dotnet --list-sdks` / `--list-runtimes` | SDK **8.0.421** + **10.0.300**, ASP.NET Core **8.0.27** |
| `Microsoft.Data.Sqlite` 8.0.11 net8.0'da derleniyor mu | Deneme projesi kuruldu, `dotnet build -c Release` | **0 uyarı, 0 hata** |
| Tek publish çıktısı hem IIS hem servis olur mu | Microsoft Learn · `AddWindowsService` | **Evet.** Belge: "When the app is running as a Windows Service" — servis değilse hiçbir şey yapmaz |
| Düz HTTP'de parola çalışır mı | MDN + kod (`01-cekirdek.js:505`) | **Hayır.** `crypto.subtle` yalnız güvenli bağlamda (HTTPS ya da localhost) |
| Parola yokken ne olur | `01-cekirdek.js:558` + `10-kabuk.js:1931` | Tohum kullanıcılarının hash'i sahte (`"(prototip — …"`). `varMi()` false → **parolasız girilir**, hata verilmez |
| Ekranlar servisi kaç yerden çağırıyor | `grep -rn "YU\.servis\."` | **26 çağrı** — 6'sı kabul testlerinde (sunucusuz), gerçek çağrı **20** |
| Yazma servisi deseni | `04-servis.js:132-145`, 14 servis | Hepsi aynı: fotoğraf al → değiştir → hata olursa geri sar → `depo.kaydet()` |

**DOĞRULANMADI:** Fabrika sunucusunda IIS, Hosting Bundle veya SQL Server
kurulu mu — o makineye erişimim yok. Bilgi işlem teyit edecek.

---

## 2. Neden bu mimari — üç yol karşılaştırıldı

Sorun tek: **iş kuralları (3.007 satır) istemcide.** Sunucu onları bilmiyor.

| Yol | Nasıl | Sonuç |
|---|---|---|
| **A · Satır satır yazma, kurallar istemcide** | Ekran kaydedince yalnız değişen satırlar sunucuya gider | **REDDEDİLDİ.** Kural, bayat kopya üzerinde çalışır. Ahmet'in D7 kontrolü Hatice'nin çekişini görmez → **silo sessizce eksiye düşer.** D7/D14 tam bunu önlemek için var |
| **B · Tüm paket + sürüm kontrolü** | Kaydederken tüm paket + sürüm gider; sürüm eskiyse 409 | Güvenli ama **sık çakışır.** İstemci sayfa açılışından beri bayat; aradaki her kayıt 409 üretir |
| **C · B + tazeleme + otomatik yeniden deneme** | 409 gelince istemci taze paketi çeker, **aynı girdiyle servisi yeniden koşar**, tekrar gönderir | **SEÇİLEN.** Hem güvenli hem görünmez |

### C neden doğru

Her kabul edilen yazma, **o anki gerçek veri üzerinde** hesaplanmış olur.
Sessiz bozulma imkânsız. Çakışma olursa:

* Kurallar taze veride de geçiyorsa → kayıt olur, **kullanıcı hiçbir şey görmez.**
* Kurallar artık geçmiyorsa → **doğru hata** çıkar: "Silo 1 · 15.07.2026 · −150.000".

Servis fonksiyonları `(depo, girdi, kullanıcı)` dışında bir şeye bakmıyor
(`04-servis.js` deseni doğrulandı), bu yüzden taze depoda yeniden koşmak
güvenli. Yeniden denemeden önce paket sunucudan **baştan** alınır — önceki
denemenin izi kalmaz, `depo.yeniId()` sayaçları da tazelenir.

---

## 3. Sunucu

### 3.1 Şema — 13 gerçek tablo, tek JSON satırı DEĞİL

Şartname satır 156 **Demirbaş**: *"Sekiz tablo yeterli. Alan adlarını
değiştirebilirsin ama **ilişkileri ve tekillik kısıtlarını koru**."*
Paketi tek satıra yazmak bunu ihlal eder. Bu yüzden 13 tablo (8 sözleşme +
`DegisiklikLog` + 4 arşiv) kurulur ve **tekillik kısıtları motora yaptırılır**:

```
UNIQUE(Tarih, MalzemeId)         GunlukHareket    -- şartname satır 163, kritik
UNIQUE(Tarih)                    KuruKuspeGunluk  -- şartname satır 164
UNIQUE(MalzemeId, DevirTarihi)   DevirStok
UNIQUE(SiloId, DevirTarihi)      SiloDevirStok
UNIQUE(KullaniciAdi)             Kullanicilar
UNIQUE(Ad)                       Malzemeler / Silolar
```

İstemcide bir hata olsa bile veritabanı çift kaydı **reddeder**. Bu, paketi
tek satırda tutan tasarımın veremeyeceği güvenlik.

**Miktarlar:** `INTEGER`, gram (kg × 1000) — SQLITE-MIMARI-KARARI §4.
SQLite'ta `DECIMAL` yalnız yakınlıktır, gerçekte REAL/float olur ve
"asla float" Demirbaş maddesi yazıldığı anda ihlal edilir.

### 3.2 Uçlar

```
GET  /api/paket   → { surum, paket }        paket boşsa: { surum: 0, paket: null }
GET  /api/surum   → { surum }               ucuz yoklama (tek tamsayı)
POST /api/paket   ← { surum, paket }        200 { surum }  |  409 { surum, paket }
GET  /api/saat    → { utc }                 sunucu saati (dış API'ye çıkış yok)
GET  /api/saglik  → { durum, kayit }        IT kontrolü
```

409, **taze paketi de** döner — istemci ikinci tur atmaz.

### 3.3 Yazma işlemi

Tek `BEGIN IMMEDIATE` içinde:

1. `Meta.Surum` oku; gelen sürümden farklıysa → **409**, hiçbir şey yazma.
2. Paketin şeklini doğrula (13 tablo dizi mi, `surum` alanı doğru mu).
3. 13 tabloyu boşalt, gelen satırları yaz (FK sırasına göre).
4. `Meta.Surum = Surum + 1`.
5. `COMMIT`.

Tabloların tümünü yeniden yazmak bu ölçekte ucuz: ölçülen paket **842 KB**,
günde 40-50 yazma. Kısıt ihlali olursa transaction geri döner ve istemci
hatayı görür.

### 3.4 SQLite ayarları

Kaynak: SQLITE-MIMARI-KARARI.md §3 (ölçümlü).

```sql
PRAGMA journal_mode = WAL;      -- kurulumda bir kez, dosyada kalıcı
PRAGMA busy_timeout = 5000;     -- her bağlantıda
PRAGMA foreign_keys = ON;       -- her bağlantıda; varsayılan KAPALI
PRAGMA synchronous = FULL;      -- her bağlantıda
```

* Her istekte yeni bağlantı. Singleton tutulmaz.
* Yazma her zaman `BEGIN IMMEDIATE` (`SqliteConnection.BeginTransaction()` bunu zaten yapar).
* `.db` **sunucunun yerel diskinde**: `C:\YanUrunler\veri\`. **Ağ paylaşımına asla konmaz** — WAL paylaşımlı bellek ister, ağ dosya sisteminde bozulma üretir.

### 3.5 Yedek

`VACUUM INTO` ile gece 22:00, 7 kopya. `.db` dosyasını kopyalamak **güvenli
değil** (yanındaki `-wal` olmadan eksik kalır). Ayrıntı: SQLITE-MIMARI-KARARI §6.

---

## 4. İstemci — ne değişir

Yeni dosya **`js/06-uzak.js`**. Ekran dosyalarına dokunmaz.

```
YU.uzak.yukle()                     paketi sunucudan al, depoya doldur
YU.uzak.calistir(ad, args)          servisi koş → gönder → 409'da tazele + yeniden dene
YU.uzak.yokla()                     N saniyede bir GET /api/surum
```

`YU.uzak.calistir` döngüsü:

```
1. YU.servis[ad].apply(null, args)      → s
2. s.ok değilse → s döndür               (kural hatası, sunucuya gitmez)
3. POST /api/paket { surum, paket }
4. 200 → yerel sürümü güncelle, s döndür
5. 409 → paketi tazele, depoyu doldur, 1'e dön (en çok 3 tur)
6. 3 tur da 409 → mevcut kırmızı şeridi göster (YU.depoUyari('cakisma'))
```

**Değişecek mevcut dosyalar (B fazı, sen bitirince):**

| Dosya | Değişiklik | Boyut |
|---|---|---|
| `index.html` | `06-uzak.js` script satırı | 1 satır |
| `js/99-baslat.js` | depo `bellek` kurulur + `YU.uzak.yukle()` beklenir | ~12 satır |
| `js/10-kabuk.js` | `storage` dinleyicisi → `YU.uzak.yoklamayaBasla()`; Yedek Yükle ucu | ~15 satır |
| 8 ekran dosyası | 20 çağrı: `YU.servis.X(...)` → `YU.uzak.calistir('X', [...])` + `.then` | çağrı başına 2-3 satır |

**`01-cekirdek.js` DEĞİŞMEYECEK** (27.08.2026, uygulama sırasında doğrulandı).
Önce "sunucu kaynağı" eklenecek sanılmıştı; gerek yok. `YU.Depo({kaynak:
'bellek', tohumla:false})` zaten localStorage'a hiç dokunmuyor ve `kaydet()`
sessizce `true` dönüyor (`01-cekirdek.js:1046`). Köprü paketi doğrudan
tablo dizilerine yerleştiriyor. Tarayıcıda denendi: 159 gün yüklendi, kayıt
yazıldı, `localStorage` kirlenmedi.

**Değişmeyecekler:** `01-cekirdek.js`, `02-hesap.js`, `03-dogrulama.js`,
`04-servis.js`, `05-tohum.js`, `40-kabul-testleri.js`, `css/tema.css`,
tüm ekran tasarımı.

### D16 ile ilişki — iki katman, iki iş

Test sırasında ortaya çıktı ve **doğru davranış**:

| Durum | Ne olur |
|---|---|
| İki kişi **farklı satıra** yazıyor | 409 gelir, köprü tazeler, yeniden hesaplar, yazar. Kullanıcı hiçbir şey görmez |
| İki kişi **aynı satıra** yazıyor | Köprü tazeler, ama ekranın taşıdığı `rowVersion` artık eski → **D16 reddeder** ve yenilemeyi söyler |

İkincisi şartname **Test 12**'nin ta kendisidir. Paket sürümü milisaniye
yarışını, D16 ise "ekranı dakikalar önce açmış olma" durumunu yakalar.
Biri diğerinin yerine geçmez.

Kabul testleri `YU.Depo({kaynak:'bellek'})` kullanıyor — sunucuya hiç
dokunmaz, aynen çalışmaya devam eder.

### İlk açılış

DB boşken sunucu `{ surum: 0, paket: null }` döner. İlk istemci mevcut
`depo.sifirla()` ile tohumlar ve `surum: 0` ile gönderir. Sunucu yalnız
sürüm hâlâ 0 ise kabul eder — ikinci istemci 409 alır ve birincinin verisini
yükler. Tohum kodu kopyalanmaz, olduğu yerde kalır.

---

## 5. Parola ve HTTPS — açık konuşulması gereken yer

**Doğrulanan:** `crypto.subtle` yalnız HTTPS'te ya da `localhost`'ta var.
`http://sunucu:8080/` ile açılınca **yok**.

Bugünkü davranış zinciri (`10-kabuk.js:1931-1949`):

* Kullanıcının gerçek parolası **yoksa** → `kurulabilirMi()` false → **doğrudan girilir.**
* Kullanıcının gerçek parolası **varsa** → "Bu adres güvenli değil" hatası, **girilemez.**

Tohum kullanıcılarının üçünün de hash'i sahte. Yani **düz HTTP ile deneme
sürümü çalışır** — ama parolasız.

| Seçenek | Ne gerekir | Ne kazandırır |
|---|---|---|
| **1 · Parolasız deneme** (varsayılan) | Hiçbir şey | Hemen çalışır. Ağdaki herkes girebilir |
| **2 · HTTPS + sertifika** | IT, 3 makineye kurum sertifikası dağıtır | Bugünkü parola akışı aynen çalışır |
| **3 · Parola sunucuya taşınır** | `10-kabuk.js` giriş akışı + sunucuda BCrypt | Şartname §3 ve §10'un istediği yer. HTTPS zorunluluğu kalkar |

**Denemede 1, canlıda 3.** Seçenek 3 zaten teslim edilecek ürünün işidir
(şartname satır 308: Cookie authentication + BCrypt). Denemede yapmak
`10-kabuk.js` giriş ekranına dokunmak demek — sen ekranları bitirince
konuşulur.

**Bu bir sınırdır, kusur değil:** deneme sürümünde sunucu tarafı kimlik
doğrulama YOKTUR. Adrese ulaşan herkes okur ve yazar. 3 kişilik kapalı
fabrika ağı için kabul edilebilir; internete açılırsa değildir.

---

## 6. Yayın

Tek `dotnet publish` çıktısı, iki kurulum yolu. Kod aynı.

```
YanUrunler-yayin\
├── YanUrunler.Sunucu.exe
├── YanUrunler.Sunucu.dll
├── appsettings.json          ← .db yolu, port
├── web.config                ← publish ÜRETİR, elle yazılmaz
└── wwwroot\                  ← index.html, css\, js\, logolar
```

**IIS yolu (muhtemel):** Hosting Bundle kurulur → klasör siteye konur →
App Pool "No Managed Code" → `C:\YanUrunler\veri` klasörüne App Pool
identity yazma izni (`.db` dosyasına değil, **klasöre** — `-wal`/`-shm`
orada oluşur).

**Servis yolu (yedek):** IIS hiç kurulmaz. `sc create` ile .exe servis
yapılır. `AddWindowsService()` çağrısı IIS altında hiçbir şey yapmadığı için
tek kod iki yolu da taşır.

**Mevcut `web.config` yayına girmez.** O statik prototip içindi; publish
kendi dosyasını üretir. Repodaki dosyaya dokunulmuyor.

---

## 7. Sınırlar — IT'ye söylenecekler

| Sınır | İleride ne olur | Nasıl düzeltilir |
|---|---|---|
| Sunucu iş kurallarını bilmiyor | API'ye elle istek atan biri kuralsız veri yazabilir | Kurallar sunucuya taşınır — teslim sürümünün asıl işi |
| Kimlik doğrulama yok | Ağdaki herkes girer ve yazar | Şartname satır 308: Cookie auth + BCrypt |
| Her kayıt tüm tabloları yeniden yazar | Veri büyürse yazma yavaşlar (bugün 842 KB, sorun değil) | Satır bazlı uçlar — ARA YOL 2. aşama |
| SQLite, SQL Server değil | Şartname satır 311 Demirbaş ihlali | Teslimde SQL Server. Şema zaten ona göre kuruluyor |
| `decimal` yok, gram/INTEGER taklidi | SQL Server'a geçerken dönüşüm gerekir | `CAST(x AS decimal(18,3))/1000` — kayıpsız |
| Düz HTTP | Ağ trafiği şifresiz | HTTPS (bölüm 5, seçenek 2) |

---

## 8. Uygulama sırası

### A fazı — şimdi (mevcut hiçbir dosyaya dokunulmaz)

1. `sunucu/` klasörü: .NET 8 minimal API projesi
2. `sema.sql`: 13 tablo + tekillik kısıtları + `Meta` tablosu; ikinci koşuda hata vermez
3. Paket ↔ tablo dönüştürücü (okuma: tablolar → JSON paket; yazma: paket → tablolar)
4. 5 uç + statik dosya sunumu
5. `js/06-uzak.js` — **yeni dosya**, hiçbir yerden çağrılmıyor, zararsız bekler
6. Yedek konsolu: `VACUUM INTO` + `integrity_check`
7. `KURULUM-NOTU.md` — IT için

### B fazı — sen ekranları bitirince

8. `index.html` script satırı
9. `01-cekirdek.js` sunucu kaynağı
10. `99-baslat.js` açılış
11. `10-kabuk.js` yoklama + Yedek Yükle
12. 20 çağrı yerinin async'e çevrilmesi
13. Üç makineyle gerçek çakışma testi

### Kabul kapısı

* [ ] Kabul testleri (12) tarayıcıda yeşil — bellek deposu bozulmadı
* [ ] İki tarayıcı aynı günü kaydeder: biri yazar, öbürü tazeler ve yazar; ikisi de kaybolmaz
* [ ] Ahmet 24.08, Hatice 25.08 aynı anda: **ikisi de başarılı**
* [ ] Silo negatife düşüren çakışma: **reddedilir**, hangi silo/tarih söylenir
* [ ] Sunucu yeniden başlar, veri durur
* [ ] `VACUUM INTO` yedeği `integrity_check` → `ok`

---

**İlgili:** `SQLITE-MIMARI-KARARI.md` (şema, PRAGMA, yedek — ölçümlü) ·
`IIS-VE-ORTAK-KULLANIM.md` (IIS adımları) · `sartname-duz.txt` (bağlayıcı)

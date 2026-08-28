# Yan Ürünler Stok Takip — Kurulum Notu (bilgi işlem için)

**Sürüm:** denemelik · 27.08.2026
**Bu bir DENEME sürümüdür.** Sınırları §6'da yazılı; okumadan canlıya alınmaz.

---

## 1. Ne kuruyorsunuz

Üç kişinin fabrika ağından aynı veriyi kullandığı bir web uygulaması.

* Arayüz tarayıcıda çalışır (HTML/JavaScript).
* Veri sunucudaki tek bir **SQLite** dosyasındadır.
* Arka uç **ASP.NET Core 8**'dir.

Kullanıcılar hiçbir şey kurmaz; tarayıcıdan adrese girerler.

---

## 2. Ön koşul — tek kalem

Sunucuda **ASP.NET Core 8 Hosting Bundle** kurulu olmalı.

```powershell
dotnet --list-runtimes
```

Çıktıda `Microsoft.AspNetCore.App 8.x` görünmüyorsa Hosting Bundle kurulur
(Microsoft'un resmi .NET indirme sayfasından). IIS kullanılacaksa **önce IIS,
sonra Hosting Bundle** kurulur; sıra ters olduysa Bundle onarılır:

```powershell
net stop was /y
net start w3svc
```

.NET **SDK gerekmez** — yalnız çalışma zamanı.

---

## 3. Klasörler

```powershell
New-Item -ItemType Directory -Force C:\YanUrunler\app    # yayin klasoru buraya
New-Item -ItemType Directory -Force C:\YanUrunler\veri   # .db burada olusur
New-Item -ItemType Directory -Force C:\YanUrunler\yedek
```

Yayın klasörünün içeriği `C:\YanUrunler\app` altına kopyalanır.

`appsettings.json` içindeki yollar bunlarla eşleşmeli:

```json
{
  "YanUrunler": {
    "VeriDosyasi": "C:\\YanUrunler\\veri\\yanurunler.db",
    "YedekKlasoru": "C:\\YanUrunler\\yedek",
    "GunlukYedekSaati": "22:00"
  }
}
```

> **Veritabanı ağ paylaşımına konmaz.** `\\sunucu\pay\...` yazılmaz.
> SQLite WAL modu paylaşımlı bellek ister; ağ dosya sisteminde çalışmaz ve
> kilitleme hataları **veri bozulmasına** yol açar. Yedek kopyaları ağa
> taşınabilir — çalışan dosya taşınamaz.

---

## 4. Kurulum — iki yoldan biri

Aynı klasör iki şekilde de çalışır. Kod aynıdır.

### 4.1 IIS ile (önerilen)

```powershell
Import-Module WebAdministration

New-WebAppPool -Name 'YanUrunler'
Set-ItemProperty IIS:\AppPools\YanUrunler -Name managedRuntimeVersion -Value ''      # No Managed Code
Set-ItemProperty IIS:\AppPools\YanUrunler -Name startMode -Value AlwaysRunning
Set-ItemProperty IIS:\AppPools\YanUrunler -Name processModel.idleTimeout -Value '00:00:00'
Set-ItemProperty IIS:\AppPools\YanUrunler -Name processModel.maxProcesses -Value 1
Set-ItemProperty IIS:\AppPools\YanUrunler -Name recycling.disallowOverlappingRotation -Value $true

New-Website -Name 'YanUrunler' -Port 8080 `
  -PhysicalPath 'C:\YanUrunler\app' -ApplicationPool 'YanUrunler'
```

**İzinler — dosyaya değil, KLASÖRE:**

```powershell
icacls 'C:\YanUrunler\veri'  /grant 'IIS AppPool\YanUrunler:(OI)(CI)M'
icacls 'C:\YanUrunler\yedek' /grant 'IIS AppPool\YanUrunler:(OI)(CI)M'
```

WAL modunda `.db` yanında `-wal` ve `-shm` dosyaları oluşur; bunlar klasörde
yaratılır. Yalnız `.db` dosyasına izin vermek yetmez.

**Neden bu ayarlar:**

| Ayar | Sebep |
|---|---|
| `maxProcesses = 1` | İki işlem aynı `.db`'ye yazmasın (web garden kullanılmaz) |
| `disallowOverlappingRotation` | Geri dönüşümde iki işlem üst üste binmesin |
| `idleTimeout = 0` + `AlwaysRunning` | Gecelik yedek görevi uyuyan havuzda çalışmaz |

`web.config` yayın klasöründe **hazır gelir**, publish üretir. Elle
düzenlenmez. (Kaynak depodaki `web.config` başka bir şeydir, yayına girmez.)

### 4.2 Windows servisi olarak (IIS istenmiyorsa)

```powershell
sc.exe create YanUrunler binPath= "C:\YanUrunler\app\YanUrunler.Sunucu.exe" start= auto
sc.exe description YanUrunler "Yan Urunler Stok Takip"
sc.exe start YanUrunler
```

Dinlenecek adres `ASPNETCORE_URLS` ortam değişkeniyle verilir, örn.
`http://+:8080`. Servis hesabının `veri` ve `yedek` klasörlerine yazma izni
olmalıdır.

---

## 5. Kurulum doğrulaması

```powershell
curl.exe -s http://localhost:8080/api/saglik
```

Beklenen:

```json
{"durum":"iyi","butunluk":"ok","yabanciAnahtarKusuru":0,...}
```

Kontrol listesi:

| İstek | Beklenen |
|---|---|
| `/` | 200, uygulama açılır |
| `/js/01-cekirdek.js` | 200, `text/javascript` |
| `/api/saglik` | `durum: iyi` |
| `/appsettings.json` | **404** |
| `/web.config` | **404** |
| `/OKUBENI.md` | **404** |

Üç kullanıcı bilgisayarından adres açılır; biri kayıt girer, **diğerlerinde
birkaç saniye içinde görünmelidir.**

---

## 6. SINIRLAR — canlıya almadan önce okuyun

Bu bir deneme sürümüdür. Aşağıdakiler bilinen ve kabul edilmiş sınırlardır.

| Sınır | Sonucu |
|---|---|
| **Kimlik doğrulama sunucuda YOK** | Adrese ulaşan herkes veriyi okur ve yazar. Uygulamanın giriş ekranı tarayıcı tarafındadır, sunucuyu korumaz |
| **İş kuralları tarayıcıda çalışır** | API'ye elle istek atan biri kural dışı veri yazabilir |
| **Düz HTTP** | Ağ trafiği şifresiz. HTTPS kurulursa uygulama parola doğrulamayı da açar (bkz. aşağıda) |
| **SQLite, SQL Server değil** | Şartname SQL Server istiyor. Teslim sürümü SQL Server + Blazor olacak |

**Parola davranışı:** uygulamanın parola doğrulaması tarayıcının Web Crypto
arayüzünü kullanır; bu arayüz yalnız **HTTPS'te** ya da `localhost`'ta
vardır. Düz HTTP ile ağdan açılınca parola sorulmaz, kullanıcılar
doğrudan girer. Parola istenirse siteye güvenilir bir sertifikayla HTTPS
kurulmalıdır.

Bu sürüm **kapalı fabrika ağı** içindir. İnternete açılmaz.

---

## 7. Yedek

Uygulama her gece `GunlukYedekSaati` saatinde `VACUUM INTO` ile yedek alır ve
son **7** kopyayı tutar. Elle yedek:

```powershell
curl.exe -s -X POST http://localhost:8080/api/yedek
```

> **`.db` dosyasını kopyalamayın.** WAL modunda yanındaki `-wal` dosyası
> veritabanının parçasıdır; tek başına kopyalanan `.db` eksik ya da bozuktur.
> Yedek almanın doğru yolu yukarıdaki uçtur.

En az bir yedek kopyası **sunucu dışında** tutulmalıdır. Aynı diskteki yedek,
disk arızasına karşı yedek değildir.

Geri yükleme: uygulama durdurulur, `yedek` klasöründeki dosya
`C:\YanUrunler\veri\yanurunler.db` olarak kopyalanır (yanındaki `-wal`/`-shm`
varsa silinir), uygulama başlatılır.

---

## 8. Günlük ve sorun giderme

Uygulama günlüğü IIS altında **stdout** kapalıdır (`stdoutLogEnabled="false"`).
Başlatma sorunu varsa `web.config` içinde geçici olarak `true` yapılır,
`C:\YanUrunler\app\logs` klasörüne App Pool kimliğine yazma izni verilir,
sorun çözülünce **tekrar kapatılır** ve geçici günlükler silinir.

| Belirti | Bakılacak yer |
|---|---|
| Sayfa açılmıyor, 500.19 | `web.config` bozulmuş ya da Hosting Bundle yok |
| Sayfa açılıyor, veri gelmiyor | `/api/saglik` — `veri` klasörü izinleri |
| "database is locked" | İki işlem aynı `.db`'ye yazıyor: `maxProcesses` 1 mi, ikinci bir site aynı dosyayı mı gösteriyor |
| Kayıt yazılmıyor, "çakışma" | Normal davranış değil; `/api/saglik` ve günlüğe bakın |

---

## 9. Yükseltme

1. Uygulama havuzu durdurulur (ya da `app_offline.htm` konur).
2. Yedek alınır (`/api/yedek`).
3. `C:\YanUrunler\app` içeriği yeni yayınla değiştirilir — **`veri` ve `yedek`
   klasörlerine dokunulmaz.**
4. Havuz başlatılır, `/api/saglik` kontrol edilir.

---

**Teknik ayrıntı ve mimari gerekçe:** `DENEMELIK-SUNUCU-PLANI.md`
**Şema, PRAGMA ve yedek ölçümleri:** `SQLITE-MIMARI-KARARI.md`


---

## Posta ayarları (rapor mailini sunucu gönderir)

`appsettings.json` içindeki **`Mail`** bölümü doldurulmadan "Mail ile Gönder"
sunucudan göndermez; ekran eski akışa (Outlook'u açıp PDF'i elle iliştirme)
düşer. Ayarlar doluysa rapor **PDF olarak eke konur** ve posta sunucudan
çıkar; kullanıcının bilgisayarında Outlook açılmaz.

```json
"Mail": {
  "Sunucu": "posta.fabrika.local",
  "Port": "587",
  "Ssl": "true",
  "Kullanici": "raporlar@fabrika.com",
  "Parola": "••••••",
  "Gonderen": "raporlar@fabrika.com",
  "GonderenAd": "Yan Ürünler Stok Takip"
}
```

* **Kullanici boş bırakılırsa** kimliksiz (anonim) iç posta sunucusu varsayılır.
* **Parola dosyada durur.** IIS altında `appsettings.json` yalnız uygulama
  havuzunun okuyabileceği şekilde yetkilendirilmelidir.
* Ayarın çalışıp çalışmadığı: `GET /api/mail/durum` → `{"hazir":true}`.
* Gönderim hatası (yanlış parola, sunucuya ulaşılamadı) kullanıcıya **olduğu
  gibi** yazılır; günlükte de `Postaci` etiketiyle durur.

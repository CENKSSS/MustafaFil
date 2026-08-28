# Yan Ürünler Stok Takip - IIS, ortak kullanım ve üretim mimarisi

Son doğrulama: 27.08.2026  
Proje: `C:\Users\cenk_\Desktop\MustafaFil\yan-urunler-stok-takip`

Bu belge iki farklı çalışma durumunu kesin olarak ayırır:

1. **Mevcut statik prototip:** `index.html`, CSS ve klasik JavaScript dosyaları IIS'ten sunulur. Her bilgisayar kendi `localStorage` verisini kullanır.
2. **Hedef üretim uygulaması:** Blazor/ASP.NET Core, merkezi SQL Server ve sunucu tarafı kimlik doğrulama kullanır.

Bu iki sürümün `web.config`, kurulum ve güvenlik gereksinimleri aynı değildir. Birine ait ayarlar diğerine kopyalanmaz.

## 1. Mevcut koddan doğrulanan durum

Serena ile kod üzerinde yapılan incelemenin sonucu:

- Projede `.csproj`, C#, Razor, ASP.NET Core host veya SQL Server bağlantısı yoktur.
- `js/99-baslat.js`, uygulamayı `YU.Depo({ kaynak: 'local', tohumla: true })` ile başlatır.
- Ana veri paketi tarayıcıda `yu.veri.v1` anahtarı altında tutulur.
- Uygulama 13 koleksiyon kullanır: kullanıcılar, malzemeler, silolar, devir stokları, hareketler ve arşiv/log koleksiyonları.
- `js/04-servis.js` istemci tarafı iş kurallarını çalıştırır; buradaki geri alma işlemleri SQL transaction değildir.
- Kullanıcı rolleri, parola hash'i ve salt bilgisi istemciye gelir ve yerel veri paketinde saklanır.
- `index.html` içinde inline tema script'i vardır. Arayüz kodu çok sayıda dinamik inline stil üretir. Mevcut CSP'deki `unsafe-inline` değerleri kod ayrıştırılmadan kaldırılamaz.
- Hash tabanlı rota kullanıldığı için mevcut statik sürüm URL Rewrite gerektirmez.

### Kesin sonuç

IIS'e statik dosyaları koymak yalnız uygulamayı ağdan açılabilir hale getirir. Ortak veri oluşturmaz. Üç bilgisayar aynı URL'yi açsa bile üç ayrı `localStorage` veri kümesi kullanır.

Mevcut statik yayın yalnız demo, geçiş veya kullanıcı arayüzü doğrulaması için kullanılmalıdır. Çok kullanıcılı üretim çözümü değildir.

## 2. Mevcut statik prototipi IIS'te yayınlama

Bu bölüm yalnız bugünkü HTML/JavaScript sürümü içindir.

### 2.1 Gerekli IIS bileşenleri

Windows Server üzerinde mevcut durumu kontrol edin:

```powershell
Get-WindowsFeature Web-Server, Web-Static-Content, Web-Default-Doc, Web-Filtering, Web-Stat-Compression |
  Format-Table Name, InstallState
```

Eksik roller:

```powershell
Install-WindowsFeature -Name Web-Server, Web-Static-Content, Web-Default-Doc, Web-Filtering, Web-Stat-Compression -IncludeManagementTools
```

Bu statik aşamada ASP.NET Core Hosting Bundle veya WebSockets zorunlu değildir.

### 2.2 Yayın beyaz listesi

Yalnız aşağıdakiler yayınlanır:

```text
index.html
web.config
css\tema.css
js\*.js
ICON.png
LOGO.png
LOGO-koyu.png
```

Yayınlanmayacaklar:

- `*.md`
- `*.ps1`, `*.vbs`
- `ICON.ico` (uygulama tarafından referans edilmiyor)
- `yan-panel-ornekleri.html`
- proje kökündeki diğer tasarım, örnek ve geliştirme dosyaları

Örnek kopyalama:

```powershell
$kaynak = 'C:\Users\cenk_\Desktop\MustafaFil\yan-urunler-stok-takip'
$hedef = 'C:\inetpub\YanUrunler'

New-Item -ItemType Directory -Force -Path $hedef | Out-Null
robocopy $kaynak $hedef index.html web.config ICON.png LOGO.png LOGO-koyu.png
robocopy "$kaynak\css" "$hedef\css" /E
robocopy "$kaynak\js" "$hedef\js" /E
```

`robocopy` dönüş kodları `0-7` arasında başarı/uyarı anlamına gelebilir; yalnız sıfır beklenmemelidir.

### 2.3 Site ve Application Pool

```powershell
Import-Module WebAdministration

if (-not (Test-Path 'IIS:\AppPools\YanUrunlerPool')) {
  New-WebAppPool -Name 'YanUrunlerPool'
}

Set-ItemProperty 'IIS:\AppPools\YanUrunlerPool' -Name managedRuntimeVersion -Value ''
Set-ItemProperty 'IIS:\AppPools\YanUrunlerPool' -Name processModel.identityType -Value ApplicationPoolIdentity
```

`managedRuntimeVersion = ''`, IIS Manager'daki **No Managed Code** karşılığıdır. Statik sürümde zorunlu değildir fakat gelecekteki ASP.NET Core yayınıyla da uyumludur.

Site ilk kez oluşturuluyorsa geçici HTTP binding ile kurulabilir; sertifika doğrulandıktan sonra HTTP binding kaldırılmalı veya HTTPS'e yönlendirilmelidir:

```powershell
if (-not (Test-Path 'IIS:\Sites\YanUrunler')) {
  New-Website -Name 'YanUrunler' -PhysicalPath 'C:\inetpub\YanUrunler' `
    -ApplicationPool 'YanUrunlerPool' -Port 8155
}
```

Fiziksel yol doğrudan `C:\inetpub\YanUrunler` olmalıdır. Kaynak repo kökü IIS sitesi yapılmaz.

### 2.4 Mevcut web.config kararı

Repodaki `web.config` yalnız statik sürüm içindir ve aşağıdaki davranışı korur:

- `/` isteğini `index.html` ile açar.
- Sürümsüz JS/CSS dosyalarını ETag ile yeniden doğrulatır.
- Dizin listelemeyi kapatır.
- Kaynak doküman uzantılarını engeller.
- Güvenlik başlıklarını tek değer olarak üretir.
- Mevcut kodla uyumlu CSP uygular.

Bu dosyaya şunlar elle eklenmez:

- `AspNetCoreModuleV2`
- `processPath="dotnet"`
- uygulama DLL adı
- `hostingModel="inprocess"`

Bunlar henüz mevcut olmayan ASP.NET Core uygulamasını başlatmaya çalışır ve statik siteyi bozabilir.

### 2.5 Statik yayın doğrulaması

```powershell
curl.exe -I https://yanurunler/
curl.exe -I https://yanurunler/js/01-cekirdek.js
curl.exe -i https://yanurunler/web.config
curl.exe -i https://yanurunler/OKUBENI.md
```

Beklenen:

| İstek | Sonuç |
|---|---|
| `/` | `200` ve HTML |
| `/js/01-cekirdek.js` | `200` ve JavaScript MIME tipi |
| `/web.config` | `404` |
| `/OKUBENI.md` | `404` |
| Normal yanıtlar | CSP, `nosniff`, frame ve referrer başlıkları birer kez |

İstemci tarayıcısında:

```javascript
isSecureContext
typeof crypto.subtle
```

Beklenen değerler sırasıyla `true` ve `"object"` olmalıdır.

## 3. HTTPS ve sertifika

### 3.1 Sertifika kararı

Üretimde tercih sırası:

1. Kurum içi Active Directory Certificate Services/kurumsal CA tarafından verilen ve istemcilerin otomatik güvendiği sertifika.
2. Kurum politikası izin veriyorsa genel güvenilir CA sertifikası.
3. Yalnız laboratuvar veya kısa süreli geçiş için kendi imzalı sertifika.

Kendi imzalı sertifika kullanılırsa tüm istemcilerin güvenilen kök deposuna kontrollü olarak dağıtılmadan üretim yayını yapılmaz. Sertifika uyarısını tarayıcıdan geçmek kabul testi değildir.

Sertifikadaki SAN adı kullanıcıların açacağı DNS adıyla aynı olmalıdır. IP adresi yerine DNS adı kullanılmalıdır.

### 3.2 HTTPS binding ve SNI

Tek IP/443 üzerinde birden fazla HTTPS sitesi veya host adına bağlı sertifika varsa SNI kullanılmalıdır:

```powershell
New-WebBinding -Name 'YanUrunler' -Protocol https -Port 443 `
  -HostHeader 'yanurunler.fabrika.local' -SslFlags 1

$sertifika = Get-ChildItem Cert:\LocalMachine\My |
  Where-Object { $_.DnsNameList.Unicode -contains 'yanurunler.fabrika.local' } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if (-not $sertifika) { throw 'Uygun HTTPS sertifikası bulunamadı.' }

Get-WebBinding -Name 'YanUrunler' -Protocol https |
  Where-Object { $_.bindingInformation -like '*:443:yanurunler.fabrika.local' } |
  ForEach-Object { $_.AddSslCertificate($sertifika.Thumbprint, 'My') }
```

Tek site ve özel IP/port kullanılıyorsa `SslFlags 0` mümkündür. Binding modeli sunucudaki diğer siteler görülmeden varsayılmaz.

### 3.3 HSTS

Önce şu koşullar sağlanır:

- Sertifika zinciri tüm istemcilerde güvenilir.
- DNS adı doğru çözülüyor.
- HTTPS binding doğrulandı.
- Sertifika yenileme sorumlusu ve takvimi belli.

Sonra HSTS kısa süreyle açılır. IIS 10 sürüm 1709+ üzerinde site düzeyindeki HSTS özelliği veya ASP.NET Core sürümünde `UseHsts` kullanılabilir. İkisi aynı anda yönetilmez. İlk denemede örneğin 300 saniye kullanılır; doğrulamadan sonra süre artırılır.

## 4. Hedef üretim mimarisi

Kalıcı mimari:

```text
Kullanıcı bilgisayarları
        |
        | HTTPS 443
        v
IIS + ASP.NET Core Module
        |
        v
Blazor Web App / ASP.NET Core (.NET 8)
        |
        | Microsoft.Data.SqlClient + Dapper
        v
SQL Server
```

Kurallar:

- İstemciler SQL Server'a doğrudan bağlanmaz.
- SQL portu yalnız web uygulaması sunucusu ile veritabanı sunucusu arasında açılır.
- İş kuralları ve yetkilendirme sunucuda çalışır.
- Parola hash/salt değerleri hiçbir Razor modeline, API DTO'suna, loga veya tarayıcı depolamasına gönderilmez.
- Sunucu zamanı iş kayıtlarında yetkili zaman kaynağıdır; dış saat API'leri üretim mimarisinden çıkarılır.
- Merkezi veritabanı ortak verinin tek doğru kaynağıdır.

### 4.1 .NET sürümü yaşam döngüsü

Şartname .NET 8 istiyorsa proje `net8.0` hedefleyebilir. Ancak .NET 8 desteği **10 Kasım 2026** tarihinde biter. Yeni üretim sisteminin bu tarihten sonra çalışması bekleniyorsa .NET 10 yükseltmesi aynı proje planına zorunlu iş olarak eklenmelidir.

## 5. Hedef IIS sunucu hazırlığı

Blazor Interactive Server/Server tarafı çalıştırma için statik rollere ek olarak:

- IIS WebSockets etkinleştirilir.
- Güncel ve hedef runtime ile uyumlu ASP.NET Core Hosting Bundle kurulur.
- Hosting Bundle IIS'ten önce kurulduysa IIS kurulumundan sonra onarılır/yeniden kurulur.
- Kurulumdan sonra gerekirse WAS/W3SVC yeniden başlatılır.
- Uygulamaya özel Application Pool oluşturulur.
- Application Pool `No Managed Code` kullanır.
- In-process uygulamalar aynı App Pool'u paylaşmaz.
- Web garden kullanılmaz; `maximumWorkerProcesses` değeri `1` tutulur.

Windows Server örneği:

```powershell
Install-WindowsFeature -Name Web-Server, Web-WebSockets -IncludeManagementTools

Import-Module WebAdministration
Set-ItemProperty 'IIS:\AppPools\YanUrunlerPool' -Name managedRuntimeVersion -Value ''
Set-ItemProperty 'IIS:\AppPools\YanUrunlerPool' -Name processModel.identityType -Value ApplicationPoolIdentity
Set-ItemProperty 'IIS:\AppPools\YanUrunlerPool' -Name processModel.loadUserProfile -Value $true
Set-ItemProperty 'IIS:\AppPools\YanUrunlerPool' -Name processModel.maxProcesses -Value 1
```

Hosting Bundle kurulumu indirme kaynağı Microsoft'un resmi .NET indirme sayfası olmalı; sabit/eski kurulum bağlantısı dokümana gömülmez.

## 6. ASP.NET Core publish ve web.config

Yayın kaynak klasörden dosya kopyalayarak yapılmaz:

```powershell
dotnet restore .\YanUrunler.sln
dotnet test .\YanUrunler.sln -c Release --no-restore
dotnet publish .\src\YanUrunler.Web\YanUrunler.Web.csproj `
  -c Release -f net8.0 -o C:\deploy\YanUrunler
```

IIS fiziksel yoluna yalnız `C:\deploy\YanUrunler` içeriği dağıtılır.

`Microsoft.NET.Sdk.Web`, publish sırasında `web.config` üretir veya kaynak dosyayı dönüştürür. Framework-dependent yayın örneğinde üretilen dosya şunları içerir:

- `location inheritInChildApplications="false"`
- `AspNetCoreModuleV2` handler
- `processPath="dotnet"`
- yayımlanan DLL'i gösteren `arguments`
- `hostingModel="inprocess"`

DLL adı elle yazılmaz. Publish çıktısındaki değer doğrulanır.

Normal üretimde:

- `stdoutLogEnabled="false"` tutulur.
- Başlatma sorunu varsa kısa süreli açılır.
- Log klasörüne App Pool identity yazma izni verilir.
- Sorun çözüldüğünde tekrar kapatılır ve geçici loglar temizlenir.

## 7. SQL Server ve ortak veri

Mevcut 13 istemci koleksiyonu SQL şemasına tek tek eşlenmeden geliştirmeye başlanmaz. Her tablo için şu kararlar yazılı olmalıdır:

- Primary key ve foreign key'ler
- Unique ve check constraint'ler
- Para/miktar alanlarının kesin decimal ölçeği
- Silme/arşiv davranışı
- Audit alanları
- `rowversion` eşzamanlılık kolonu

Güncelleme deseni:

```sql
UPDATE dbo.Ornek
SET Deger = @Deger
WHERE Id = @Id AND RowVersion = @BeklenenRowVersion;
```

Etkilenen satır sayısı sıfırsa kayıt başka kullanıcı tarafından değiştirilmiştir. İşlem sessizce üzerine yazmaz; kullanıcıya çakışma cevabı döner.

Bir iş akışındaki ilgili repository yazmaları aynı SQL transaction içinde yapılmalıdır. Dapper bağlantısı global/singleton olarak açık tutulmaz; işlem kapsamına göre açılıp kapatılır.

## 8. Kimlik doğrulama ve veri sızıntısı önleme

- Parola üretme ve doğrulama yalnız sunucuda yapılır.
- Yeni parola sistemi ASP.NET Core `PasswordHasher<TUser>` veya ASP.NET Core Identity kullanır.
- Mevcut tarayıcı PBKDF2 kaydı doğrudan kalıcı kimlik verisi olarak taşınmaz; kullanıcılar için kontrollü parola sıfırlama yapılır.
- Authentication cookie `Secure`, `HttpOnly` ve uygun `SameSite` ayarlarıyla oluşturulur.
- Yetkilendirme her servis/endpoint üzerinde sunucuda uygulanır; menü gizlemek yetkilendirme sayılmaz.
- DTO'larda kullanıcı hash/salt alanı bulunmaz.
- Loglama, exception cevabı ve veri dışa aktarma işlemleri hash, connection string veya kişisel bilgileri açığa çıkarmaz.

Cookie ve antiforgery verilerinin IIS/application restart sonrasında geçerli kalması için Data Protection anahtarları kalıcı ve erişimi sınırlı bir depoda tutulmalıdır. App Pool identity yalnız gerekli anahtar deposuna erişmelidir.

## 9. Blazor ve statik dosyalar

- Kamuya açık dosyalar yalnız `wwwroot` altında bulunur.
- Markdown, SQL migration, source map, yedek ve secret dosyaları publish çıktısına alınmaz.
- Blazor Server bağlantısı IIS üzerinde WebSocket ile doğrulanır.
- Birden fazla uygulama sunucusu kullanılacaksa session affinity ve ortak Data Protection key ring tasarlanır.
- CSP yeni Blazor çıktısı üzerinde yeniden test edilir; mevcut statik prototip CSP'si körlemesine taşınmaz.
- Uygulama ve IIS aynı güvenlik başlığını iki ayrı yerden üretmez.

## 10. Dağıtım sırası

1. Veritabanı yedeği alınır ve geri dönüş adımı doğrulanır.
2. Release testleri geçmeden publish yapılmaz.
3. Uygulama trafiği durdurulur veya `app_offline.htm` ile bakım durumuna alınır.
4. SQL migration kontrollü olarak uygulanır.
5. Publish çıktısı yeni sürüm klasörüne kopyalanır.
6. IIS fiziksel yolu atomik biçimde yeni sürüme geçirilir veya kontrollü dosya değişimi yapılır.
7. Uygulama havuzu başlatılır.
8. Health endpoint, login, yetki, SQL yazma ve Blazor WebSocket testi yapılır.
9. Güvenlik başlıkları ve HTTPS yönlendirmesi doğrulanır.
10. Hata varsa önceki uygulama sürümü ve uyumlu veritabanı yedeğiyle geri dönülür.

## 11. Kabul kontrol listesi

### Mevcut statik yayın

- [ ] Üç istemcide HTTPS sertifikası güvenilir.
- [ ] `isSecureContext === true`.
- [ ] `crypto.subtle` kullanılabilir.
- [ ] `web.config` ve `.md` dosyaları dışarıdan alınamıyor.
- [ ] CSV, JSON yedek, mail/yazdırma ve tema akışları CSP altında çalışıyor.
- [ ] Bunun ortak veri sağlamadığı kullanıcıya açıkça bildirildi.

### Hedef Blazor/SQL Server yayını

- [ ] IIS üzerinde Hosting Bundle ve ASP.NET Core Module mevcut.
- [ ] Publish tarafından üretilen `web.config` dağıtıldı.
- [ ] App Pool `No Managed Code`, tek worker ve ayrı pool kullanıyor.
- [ ] WebSocket bağlantısı çalışıyor.
- [ ] Data Protection key ring kalıcı.
- [ ] SQL Server'a yalnız uygulama sunucusu erişiyor.
- [ ] Eşzamanlı güncelleme çakışması sessiz veri ezmiyor.
- [ ] Parola hash/salt hiçbir istemci cevabında bulunmuyor.
- [ ] Connection string kaynak kodda veya publish edilen `web.config` içinde açık değil.
- [ ] Yedek ve rollback denemesi yapıldı.
- [ ] .NET 8 kullanılıyorsa 10 Kasım 2026 öncesi .NET 10 yükseltmesi takvimlendi.

## 12. Microsoft resmi kaynakları

- ASP.NET Core'u IIS'te barındırma: <https://learn.microsoft.com/aspnet/core/host-and-deploy/iis/?view=aspnetcore-8.0>
- IIS'e publish: <https://learn.microsoft.com/aspnet/core/tutorials/publish-to-iis?view=aspnetcore-8.0>
- Hosting Bundle: <https://learn.microsoft.com/aspnet/core/host-and-deploy/iis/hosting-bundle?view=aspnetcore-8.0>
- ASP.NET Core `web.config`: <https://learn.microsoft.com/aspnet/core/host-and-deploy/iis/web-config?view=aspnetcore-8.0>
- Gelişmiş IIS ve Data Protection: <https://learn.microsoft.com/aspnet/core/host-and-deploy/iis/advanced?view=aspnetcore-8.0>
- Blazor Server IIS dağıtımı: <https://learn.microsoft.com/aspnet/core/blazor/host-and-deploy/server/?view=aspnetcore-8.0>
- HTTPS ve HSTS: <https://learn.microsoft.com/aspnet/core/security/enforcing-ssl?view=aspnetcore-8.0>
- IIS binding ve SNI: <https://learn.microsoft.com/iis/configuration/system.applicationhost/sites/site/bindings/binding>
- IIS request filtering: <https://learn.microsoft.com/iis/configuration/system.webserver/security/requestfiltering/>
- ASP.NET Core parola hashing: <https://learn.microsoft.com/aspnet/core/security/data-protection/consumer-apis/password-hashing?view=aspnetcore-8.0>
- SQL optimistic concurrency: <https://learn.microsoft.com/sql/connect/ado-net/optimistic-concurrency?view=sql-server-ver17>
- .NET sürüm desteği: <https://learn.microsoft.com/dotnet/core/releases-and-support>

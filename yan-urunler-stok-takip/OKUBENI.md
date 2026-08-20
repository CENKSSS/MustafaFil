# Yan Ürünler Stok Takip — yerel prototip

Şeker fabrikasının yan ürünlerinin (yaş küspe, kuru küspe, kuyruk, toprak)
günlük üretim, satış ve stok takibi. Bu klasör **çalışan bir prototiptir**:
kurulum, derleme veya sunucu gerektirmez.

---

## Nasıl açılır

`index.html` dosyasına çift tıkla. Hepsi bu.

```bash
start "" "index.html"
```

Sunucu, npm, .NET, veritabanı **gerekmez**. Uygulama `file://` üzerinde çalışır;
veriyi tarayıcının `localStorage` alanında tutar.

---

## Giriş

Prototipte parola doğrulaması **yoktur** (istek üzerine atlandı). Açılışta iki
düğme gelir:

| Düğme | Kim | Ne görür |
|---|---|---|
| **Yönetici Girişi** | Cenk Sefer ÇOĞALMIŞ | Bütün ekranlar + devir stok, malzeme ve kullanıcı yönetimi, değişiklik geçmişi, kabul testleri |
| **Operatör Girişi** | Ahmet Yılmaz | Günlük giriş, stok, silo, rapor, geçmiş girişler |

Gerçek uygulamada giriş kullanıcı adı + **BCrypt** hash'li parola ile yapılır
(Şartname §3). Yetki kontrolü prototipte de gerçektir: operatörle giriş yapıp
adres çubuğuna `#/devir-stok` yazarsan ekran **açılmaz** (Şartname Test 7).

---

## Ne nereden geliyor

| Kaynak | Rol |
|---|---|
| `../docs/yan-urunler-sartname-v2.html` | **İş kuralları.** Formüller, D1–D16, 12 kabul testi. "Demirbaş" işaretli maddeler birebir uygulandı. |
| `../design-reference/accounting-dashboard/` | **Görsel doğruluk kaynağı.** Yerleşim, tipografi, renk, ikon, tablo ve kart dili artboard `2a` (açık) ve `1b` (koyu) üzerinden alındı. |
| `SOZLESME.md` | Bu prototipin iç arayüz sözleşmesi: global adlar, tablo alanları, CSS sınıfları, tasarım değerleri. |

---

## Dosya düzeni

```
yan-urunler-stok-takip/
├── index.html              kabuk + tasarım referansından alınan 20 inline SVG ikon
├── SOZLESME.md             bağlayıcı arayüz sözleşmesi
├── OKUBENI.md              bu dosya
├── css/
│   └── tema.css            tüm tasarım sistemi (açık + koyu tema)
└── js/
    ├── 01-cekirdek.js      biçimlendirme, tarih, deterministik PRNG, depo
    ├── 02-hesap.js         saf hesap — Şartname §4 netleme formülleri
    ├── 03-dogrulama.js     D1–D16
    ├── 04-servis.js        stok sorguları + kayıt servisleri (transaction karşılığı)
    ├── 05-tohum.js         referans kampanya verisi (deterministik)
    ├── 10-kabuk.js         yönlendirici, kenar çubuğu, üst şerit, tema, UI kütüphanesi
    ├── 20…30-*.js          11 ekran
    ├── 40-kabul-testleri.js  12 kabul testinin tarayıcı içi koşucusu
    └── 99-baslat.js        açılış
```

Şartname §10'un istediği üç parçalı ayrım korundu: **hesap** (`02`),
**doğrulama** (`03`), **kayıt servisi** (`04`). Hesap ekranın içine yazılmadı.

---

## Ekranlar

| Ekran | Yetki |
|---|---|
| Ana Sayfa | Herkes |
| Kuru Küspe Günlük Giriş | Herkes |
| Malzeme Girişi | Herkes |
| Stok Durumu | Herkes |
| Silo Durumu | Herkes |
| Günlük Rapor | Herkes |
| Geçmiş Girişler | Herkes |
| Devir Stok | Yönetici |
| Malzeme Yönetimi | Yönetici |
| Kullanıcı Yönetimi | Yönetici |
| Değişiklik Geçmişi | Yönetici |
| Kabul Testleri | Yönetici |

---

## Kabul testleri

**Yönetici** olarak gir → *Kabul Testleri*. Şartname §9'daki **12 senaryo**
tarayıcıda çalışır; her test temiz bir bellek deposuyla başlar ve senin verine
dokunmaz. Beklenen rakamlar şartnamedekilerle birebir aynıdır.

---

## Veri

İlk açılışta iki kampanyalık **deterministik** örnek veri üretilir:

* **Kampanya 2024/2025** — devir 16.09.2024, ilk 10 gün. Amacı: §5'teki
  "en son devir" kuralının iki devir satırıyla gerçekten sınanması.
* **Kampanya 2025/2026** — devir 15.09.2025, 15.09.2025 – 20.01.2026 arası tam veri.

Veri her yenilemede aynıdır (`Math.random()` kullanılmaz). Sıfırlamak için
tarayıcı konsolunda:

```js
localStorage.removeItem('yu.veri.v1'); location.reload();
```

---

## Prototip ile gerçek uygulama arasındaki fark

Bu prototip **arayüzü ve iş kurallarını** doğrular. Gerçek uygulama Şartname
§10'daki yığınla yazılacak: **.NET 8 · Blazor Web App (Interactive Server) ·
MudBlazor · Dapper · SQL Server**.

| Konu | Prototip | Gerçek uygulama |
|---|---|---|
| Veri | `localStorage` | SQL Server |
| Transaction | derin kopya + geri sarma | tek DB transaction |
| `RowVersion` | tamsayı sayaç | SQL `rowversion` |
| Parola | yok | BCrypt hash + çerez oturumu |
| Testler | tarayıcı içi koşucu | xUnit + LocalDB |
| Excel çıktısı | yok | ClosedXML (EPPlus **değil** — ticari lisans gerektiriyor) |

---

## Hâlâ açık olan sorular (Şartname §13)

Bunlar **karar bekliyor**; prototip varsayımla ilerledi ve varsayımı ekranda
işaretledi.

| Soru | Prototipin varsayımı |
|---|---|
| **5a** 3.000 ton silo başına mı, üçünün toplamı mı? | Silo başına (her silo 3.000.000 kg). Silo Durumu ekranında not var. |
| **2** Gelecek kampanyada devir stok ne olacak? | Yeni sezon yeni devir satırı açar; eski sezon durur ("en son devir" formülü). |
| **3** Basit malzeme stoğu negatife düşerse? | Uyarı verilir, engellenmez. |
| **4** Silolar arası transfer var mı? | Prototipte transfer ekranı yok; `Manuel` hareket tipi duruyor. |
| **6** Dökme satış aynı gün birden fazla silodan yapılabilir mi? | Evet varsayıldı — giriş ekranı silo başına ayrı satır kabul ediyor. |

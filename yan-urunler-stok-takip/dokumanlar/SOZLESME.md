# SÖZLEŞME — Yan Ürünler Stok Takip (yerel HTML prototipi)

> Bu dosya, uygulamayı yazan herkesin **bağlayıcı arayüz sözleşmesidir**.
> Burada tanımlanan global adlar, alan adları, CSS sınıfları ve tasarım
> değerleri **aynen** kullanılır. Uyuşmazlık olursa bu dosya kazanır.
>
> Kaynaklar:
> * İş kuralları → `../docs/yan-urunler-sartname-v2.html` (Şartname v2)
> * Görsel dil → `../design-reference/accounting-dashboard/` (artboard `1a` / `2a` açık, `1b` koyu)

---

## 0. Teknik zemin — değiştirilemez

| Konu | Karar |
|---|---|
| Çalışma biçimi | `index.html` çift tıklanınca **`file://`** üzerinden çalışır. Sunucu, derleme, npm **yok**. |
| Script tipi | **Klasik `<script src>`** — `type="module"` **YASAK** (`file://` üzerinde CORS'a takılır). |
| Bağımlılık | **Sıfır.** CDN yok, harici font yok, grafik kütüphanesi yok. Grafikler inline SVG. |
| Global ad alanı | Her şey **`window.YU`** altında. Başka global değişken tanımlanmaz. |
| Kalıcılık | `localStorage`, anahtar `yu.veri.v1`. Tema anahtarı `yu.tema`. Tohum verisi değişince `SEMA_SURUM` yükseltilir; eski kayıt geçersizleşir ve depo yeniden tohumlanır — yoksa tarayıcıdaki eski örnek veri ekranda kalır. |
| Dil | Arayüzün tamamı Türkçe. Kod içindeki değişken/fonksiyon adları da Türkçe. |
| Sayı biçimi | Binlik nokta, ondalık virgül: `240.000`, `1.234,56`, `%23,8` |
| Tarih biçimi | Ekranda `GG.AA.YYYY`. Veride **ISO string** `"2026-07-03"` (saat bileşeni YOK — Şartname §6). |
| Miktar | `decimal(18,3)` karşılığı: JS `number`, `YU.yuvarla()` ile 3 ondalığa sabitlenir. |

### Dosya sırası (index.html içinde bu sırayla yüklenir)

```
css/tema.css
js/01-cekirdek.js     util + depo + tohum verisi
js/02-hesap.js        saf hesap (KuruKuspeHesaplayici)
js/03-dogrulama.js    D1–D16 (DogrulamaKurallari)
js/04-servis.js       stok sorguları + kayıt servisleri (KayitServisleri)
js/05-tohum.js        referans kampanya tohum verisi (servis katmanı üzerinden)
js/10-kabuk.js        yönlendirici, kenar çubuğu, üst şerit, tema, UI yardımcıları
js/20-anasayfa.js
js/21-kuru-kuspe-giris.js
js/22-malzeme-girisi.js
js/23-stok-durumu.js
js/24-silo-durumu.js
js/25-gunluk-rapor.js
js/26-gecmis-girisler.js
js/27-devir-stok.js
js/28-malzeme-yonetimi.js
js/29-kullanici-yonetimi.js
js/30-degisiklik-gecmisi.js
js/31-analizler.js
js/33-analiz-veri.js    analiz veri katmanı (YU.analiz)
js/40-kabul-testleri.js
js/99-baslat.js       YU.baslat()
```

Her dosya `(function(){ 'use strict'; ... })();` içine sarılır. Sayfa dosyaları
yüklenirken **hiçbir şey çizmez**, yalnızca `YU.sayfaTanimla(...)` çağırır.

---

## 1. Veri modeli — alan adları birebir (Şartname §6)

Depodaki her tablo düz bir **dizidir**. `Id` tamsayı, 1'den başlar.

```js
Kullanicilar    {Id, KullaniciAdi, ParolaHash, AdSoyad, Rol, Aktif,
                 OlusturmaTarihi}                       // Rol: 'Yonetici' | 'Operator'
Malzemeler      {Id, Ad, Birim, Sira, OzelTip, Aktif}   // Birim:'Kg'
                                                        // OzelTip: null|'DokmeKuruKuspe'|'CuvalKuruKuspe'
Silolar         {Id, Ad, Sira, Kapasite, Aktif}         // Kapasite kg
DevirStok       {Id, MalzemeId, DevirTarihi, Miktar,
                 OlusturanKullaniciId, OlusturmaTarihi,
                 GuncelleyenKullaniciId, GuncellemeTarihi}
SiloDevirStok   {Id, SiloId, DevirTarihi, Miktar,
                 OlusturanKullaniciId, OlusturmaTarihi,
                 GuncelleyenKullaniciId, GuncellemeTarihi}
GunlukHareket   {Id, Tarih, MalzemeId, Uretim, Satis, RowVersion,
                 OlusturanKullaniciId, OlusturmaTarihi,
                 GuncelleyenKullaniciId, GuncellemeTarihi}
KuruKuspeGunluk {Id, Tarih, UretilenDokme, CuvalAdet, CuvalKg, SatilanDokme,
                 RowVersion, OlusturanKullaniciId, OlusturmaTarihi,
                 GuncelleyenKullaniciId, GuncellemeTarihi}
SiloHareket     {Id, Tarih, SiloId, HareketTipi, GirenKg, CikanKg,
                 KaynakKayitId, OlusturanKullaniciId, OlusturmaTarihi}
                 // HareketTipi: 'DokmeUretim'|'Cuvallama'|'DokmeSatis'|'Manuel'
DegisiklikLog   {Id, Tablo, KayitId, Alan, EskiDeger, YeniDeger,
                 KullaniciId, Tarih, Islem}             // Islem:'Ekle'|'Guncelle'|'Sil'
```

**Tekillik kısıtları (servis katmanı zorlar):**
`Kullanicilar.KullaniciAdi` · `Malzemeler.Ad` · `Silolar.Ad` ·
`(DevirStok.MalzemeId, DevirTarihi)` · `(SiloDevirStok.SiloId, DevirTarihi)` ·
`(GunlukHareket.Tarih, MalzemeId)` · `KuruKuspeGunluk.Tarih` ·
`Malzemeler.OzelTip` — null olmayanlar arasında tekil (filtreli tekil indeks).

`RowVersion`: tamsayı, her yazmada +1. D16 bunu karşılaştırır.

### Başlangıç malzemeleri (özel tipler Şartname §2 ile birebir; sıra ve 8. malzeme kullanıcı kararı, 24.08.2026)

| Sıra | Ad | Birim | ÖzelTip |
|---|---|---|---|
| 1 | Dökme Yaş Küspe | Kg | — |
| 2 | Yaş Küspe (Tonluk) | Kg | — |
| 3 | Yaş Küspe (25'lik) | Kg | — |
| 4 | Dökme Kuru Küspe | Kg | `DokmeKuruKuspe` |
| 5 | Kuru Küspe (50 Kg) | Kg | `CuvalKuruKuspe` |
| 6 | Atık Kuru Küspe | Kg | — |
| 7 | Kuyruk | Kg | — |
| 8 | Toprak | Kg | — |

> Doğru sayı 8'dir — "Dökme Yaş Küspe" 24.08.2026'da eklendi (basit malzeme,
> silo akışına girmez); sözleşmedeki 7'li liste unutulmuştu (kullanıcı onayı,
> 24.08.2026). Şartname §2'nin yedi malzemesi çekirdek küme olarak korunur;
> şartname metni kullanıcı onayı olmadan değiştirilmez.

### Başlangıç siloları
`Silo 1`, `Silo 2`, `Silo 3` — her biri `Kapasite = 3000000` kg.
> Şartname §13 Soru 5a KAPATILDI (kullanıcı kararı, 21.08.2026): 3.000 ton
> SİLO BAŞINA kapasitedir — üç siloda toplam 9.000.000 kg. Artık varsayım
> değil karardır; arayüzde ayrıca not gösterilmez.

### Başlangıç kullanıcıları
| KullaniciAdi | AdSoyad | Rol |
|---|---|---|
| `yonetici` | Cenk Sefer ÇOĞALMIŞ | `Yonetici` |
| `operator` | Ahmet Yılmaz | `Operator` |
| `operator2` | Hatice Demir | `Operator` |

`ParolaHash` alanı prototipte `"(prototip — gerçek uygulamada BCrypt)"` metnini tutar.
Prototipte parola doğrulaması **yoktur**; giriş ekranı rol seçimidir.

---

## 2. `js/01-cekirdek.js` — util + depo

```js
YU.yuvarla(n)                 // 3 ondalık: Math.round(n*1000)/1000
YU.fmt.sayi(n, ond=0)         // "240.000" / "1.234,56"
YU.fmt.kg(n)                  // "240.000"          (birimsiz, 0 ondalık; ondalık varsa 3 hane)
YU.fmt.kgU(n)                 // "240.000 kg"
YU.fmt.ton(n)                 // kg -> "240 t" / "2.999,5 t"
YU.fmt.yuzde(n, ond=1)        // "%23,8"
YU.fmt.tarih(iso)             // "03.07.2026"
YU.fmt.tarihUzun(iso)         // "3 Temmuz 2026"
YU.fmt.gunAdi(iso)            // "Cuma"
YU.fmt.saat(isoDT)            // "14:30"
YU.fmt.tarihSaat(isoDT)       // "03.07.2026 14:30"
YU.parse.sayi(metin)          // "1.234,56"->1234.56 | "1234.56"->1234.56 | ""->0 | geçersiz->NaN
YU.tarih.bugun()              // "2026-08-20"  (gerçek sistem tarihi)
YU.tarih.ekle(iso, gun)       // iso
YU.tarih.fark(a, b)           // gün farkı (b - a)
YU.tarih.ayBasi(iso) / aySonu(iso)
YU.rastgele(tohum)            // mulberry32 PRNG üreticisi -> function():number
YU.kopya(nesne)               // derin kopya
```

> **PRNG kuralı:** tohum verisi **deterministik** üretilir. Her yenilemede aynı
> rakamlar çıkmalıdır. `Math.random()` uygulamanın hiçbir yerinde kullanılmaz.

```js
YU.Depo(secenek)              // secenek: {kaynak:'local'|'bellek', tohumla:true}
  // döndürdüğü nesne:
  depo.kullanicilar, .malzemeler, .silolar, .devirStok, .siloDevirStok,
      .gunlukHareket, .kuruKuspeGunluk, .siloHareket, .degisiklikLog   // Array
  depo.yeniId(tabloAdi)       // 'GunlukHareket' vb. -> int
  depo.kaydet()               // localStorage'a yaz ('bellek' ise no-op)
  depo.sifirla()              // tohum verisiyle yeniden kur
  depo.bosla()                // tüm tabloları boşalt (testler için) — malzeme/silo/kullanıcı kalır
  depo.kaynak                 // 'local' | 'bellek'

YU.db                          // uygulamanın aktif deposu ('local')
YU.tohumla(depo)               // referans kampanya verisini üretir (aşağıda)
```

### Tohum verisi (deterministik)

* **Kampanya 2025/2026** — geçen yılın tamamlanmış sezonu: devir `2025-09-15`,
  122 gün tam veri (kullanıcı kararı, 24.08.2026: geçmiş yıl verisi de dursun).
* **Kampanya 2026/2027** — devir tarihi `2026-07-22`; devirden **bugüne**
  kadar her gün günlük veri (gün sayısı açılışta hesaplanır, son kayıt hep
  bugüne denk gelir; kampanya bitiş sınırı yok).
* **Her gün her siloya** en az bir hareket düşer; **her gün her malzemenin**
  günlük satırı oluşur.
* İçinde **en az 2 gün Durum B** (çuvallama > üretim) bulunmalı.
* En az 1 gün `SatilanDokme = 0`, çoğu günde dökme satış olmalı.
* Silolar hiçbir gün negatife düşmemeli, kapasiteyi aşmamalı (D15 tetiklenmemeli).
* Tohumlama **servis katmanı üzerinden** yapılır (`YU.servis.kuruKuspeKaydet` vb.),
  satırlar elle yazılmaz — böylece tohum verisi tüm kuralları sağlar.
  Servise `{tohumlama:true}` geçilirse D14 (ileri doğrulama) atlanır.
* Tohumlamanın sonunda denetim izi üretilir: son iki haftaya dağılmış
  düzeltme/ekleme/silme adımları DegisiklikLog, SilinenKayitlar ve arşiv
  tablolarını doldurur.

---

## 3. `js/02-hesap.js` — saf hesap (Şartname §4, DEMİRBAŞ)

Bu dosya **depoya dokunmaz**. Girdi sayı, çıktı sayı.

```js
YU.hesap.CUVAL_KG = 50
YU.hesap.TOLERANS = 0.01
YU.hesap.esit(a, b)                       // |a-b| <= 0.01
YU.hesap.kuruKuspe(uretilenDokme, cuvalAdet, satilanDokme)
// ->
{
  cuvalKg:           cuvalAdet * 50,
  netDokmeUretim:    Math.max(0, uretilenDokme - cuvalKg),
  silodanCekilecek:  Math.max(0, cuvalKg - uretilenDokme),
  satilanDokme:      satilanDokme,
  siloNetDegisim:    netDokmeUretim - silodanCekilecek - satilanDokme,
  durum:             'A' | 'B'            // A: üretim >= çuvallama, B: çuvallama > üretim
}
```

---

## 4. `js/03-dogrulama.js` — D1–D16 (Şartname §8)

```js
YU.dogrula.KURALLAR = [
  {kod:'D1',  tur:'Hata',    metin:'Üretilen dökme küspe negatif olamaz.'},
  ... D16'ya kadar hepsi ...
]
// tur: 'Hata' | 'Uyari' | 'Upsert' | 'Engelle' | 'Tasarim'

YU.dogrula.kuruKuspeKaydi(depo, girdi) -> {hatalar:[...], uyarilar:[...]}
YU.dogrula.gunSilme(depo, tarih)       -> {hatalar:[...]}
YU.dogrula.malzemeHareketi(depo, girdi)-> {hatalar, uyarilar}
YU.dogrula.kullanici(depo, kullanici)  -> {hatalar}
YU.dogrula.malzeme(depo, malzeme)      -> {hatalar}
YU.dogrula.silo(depo, silo)            -> {hatalar}
YU.dogrula.devir(depo, devir, tip)     -> {hatalar}   // tip:'Malzeme'|'Silo'
YU.dogrula.ileriBakiye(depo, baslangicTarih, taslak) -> [{siloId, siloAd, tarih, bakiye}]
```

Her hata/uyarı: `{kod:'D3', mesaj:'Silolara yerleştirilen toplam 200.000 kg, net dökme üretim 240.000 kg ile eşleşmiyor.'}`

**`girdi` sözleşmesi (kuru küspe günlük kaydı):**
```js
{
  tarih: '2026-07-03',
  uretilenDokme: 250000,
  cuvalAdet: 200,
  satilanDokme: 0,
  yerlestirmeler:  [{siloId:1, miktar:240000}],  // DokmeUretim  (giren)
  cekisler:        [{siloId:1, miktar:0}],       // Cuvallama    (çıkan)
  satisCekisleri:  [{siloId:1, miktar:0}],       // DokmeSatis   (çıkan)
  rowVersion: null        // yeni kayıt: null; güncelleme: okunan RowVersion
}
```
Miktarı 0 olan satırlar yok sayılır, hareket yazılmaz.

**Kural karşılıkları — birebir uygulanacak:**

| Kod | Kontrol |
|---|---|
| D1 | `uretilenDokme < 0` → hata |
| D2 | `cuvalAdet < 0` → hata (tam sayı olmalı) |
| D3 | `Σ yerlestirmeler ≟ netDokmeUretim` (±0,01) → hata |
| D4 | `netDokmeUretim === 0 && Σ yerlestirmeler > 0` → hata |
| D5 | `Σ cekisler ≟ silodanCekilecek` (±0,01) → hata |
| D6 | `silodanCekilecek === 0 && Σ cekisler > 0` → hata |
| D7 | Her silo için `(cekisler+satisCekisleri) toplamı ≤ o günün başındaki mevcut` → hata. **Kontrol silo başına ve iki kalemin TOPLAMI üzerinden.** |
| D8 | `(Tarih, MalzemeId)` / `KuruKuspeGunluk.Tarih` varsa güncelle (upsert), ikinci satır açma |
| D9 | Kullanıcı kendi hesabını pasifleştiremez |
| D10 | Son aktif yönetici pasifleştirilemez / operatöre düşürülemez |
| D11 | Aynı `KullaniciAdi` iki kez eklenemez |
| D12 | Kullanıcı ve malzeme **silinmez**, pasifleştirilir |
| D13 | `Σ satisCekisleri ≟ satilanDokme` (±0,01) → hata. `satilanDokme > 0` iken karşılık yoksa hata |
| D14 | Kayıt/silme sonrası, işlem tarihinden **son kayıtlı güne** kadar her silonun bakiyesi ileri hesaplanır; herhangi bir gün negatifse işlem reddedilir, **hangi silo hangi tarihte** patladığı söylenir |
| D15 | Gün sonu bakiyesi `Silolar.Kapasite`'yi aşarsa **HATA — kayıt engellenir** (kullanıcı kararı, 21.08.2026; şartname v2'de uyarıydı). Silo başına, bakiye üzerinden; silo devri de kapasiteyi aşamaz |
| D16 | Güncellemede `RowVersion` okunandan farklıysa reddet |

---

## 5. `js/04-servis.js` — stok sorguları + kayıt servisleri (Şartname §5, §10)

### Stok sorguları (saf okuma)

```js
YU.stok.enSonDevir(depo, 'Malzeme'|'Silo', id, tarih)  // -> {DevirTarihi, Miktar} | null
YU.stok.malzemeStok(depo, malzemeId, tarih)  // tarih yoksa bugün
   // -> {devir, devirTarihi, uretim, satis, mevcut}
   // ÖzelTip==='DokmeKuruKuspe' ise: mevcut = tüm siloların toplamı (Şartname §5 KRİTİK)
YU.stok.siloStok(depo, siloId, tarih)
   // -> {devir, devirTarihi, giren, cikan, mevcut, kapasite, doluluk}  doluluk: 0..1
YU.stok.siloGunBasi(depo, siloId, tarih)     // Tarih < tarih  -> number
YU.stok.dokmeToplam(depo, tarih)             // tüm siloların toplamı
YU.stok.tumMalzemeler(depo, tarih)           // -> [{malzeme, devir, uretim, satis, mevcut}]
YU.stok.tumSilolar(depo, tarih)              // -> [{silo, devir, giren, cikan, mevcut, kapasite, doluluk}]
YU.stok.negatifGunler(depo)                  // -> [{siloId, siloAd, tarih, bakiye}]
YU.stok.gunOzeti(depo, tarih)                // -> {kuruKuspe, hesap, malzemeSatirlari, siloHareketleri}
YU.stok.kayitliGunler(depo, bas, bit)        // -> [{tarih, kuruKuspeVar, malzemeSayisi, sonGuncelleme, kullanici}]
```

### Kayıt servisleri (yazma — hepsi "ya hep ya hiç")

```js
YU.servis.kuruKuspeKaydet(depo, girdi, kullanici, secenek)
   // secenek: {tohumlama:false}
   // -> {ok:bool, hatalar:[], uyarilar:[], kayit}
   // Sıra (Şartname §4 "Yeniden kaydetme"):
   //   1. doğrula (D1–D7, D13, D15, D16)
   //   2. taslak hareketlerle D14 ileri doğrulama
   //   3. o güne ait eski SiloHareket satırlarını SİL (KaynakKayitId ile)
   //   4. KuruKuspeGunluk upsert (RowVersion+1)
   //   5. yeni SiloHareket satırlarını yaz
   //   6. GunlukHareket upsert: DokmeKuruKuspe (Uretim=netDokmeUretim, Satis=satilanDokme)
   //                            CuvalKuruKuspe (Uretim=cuvalKg, mevcut Satis korunur)
   //   7. DegisiklikLog
   // Hata varsa depo HİÇ değişmez (önce kopya üzerinde çalış, sonra yaz).

YU.servis.gunSil(depo, tarih, kullanici)         // -> {ok, hatalar}
YU.servis.malzemeHareketKaydet(depo, girdi, kullanici)
   // girdi: {tarih, malzemeId, uretim, satis, rowVersion}
YU.servis.devirKaydet(depo, {malzemeId, devirTarihi, miktar}, kullanici)
YU.servis.siloDevirKaydet(depo, {siloId, devirTarihi, miktar}, kullanici)
YU.servis.devirSil(depo, id, tip, kullanici)
YU.servis.malzemeKaydet(depo, malzeme, kullanici)
YU.servis.kullaniciKaydet(depo, kullanici, kullanici2)   // kullanici2 = işlemi yapan
YU.servis.siloKaydet(depo, silo, kullanici)
YU.log.yaz(depo, {tablo, kayitId, alan, eski, yeni, kullaniciId, islem})
```

Her yazma sonrası `depo.kaydet()` çağrılır (bellek deposunda no-op).

---

## 6. `js/10-kabuk.js` — kabuk, yönlendirici, UI yardımcıları

```js
YU.oturum = {kullanici: <Kullanicilar satırı> | null}
YU.rol()                      // 'Yonetici' | 'Operator' | null
YU.yonetici()                 // bool

YU.sayfaTanimla({
  kod: 'stok-durumu',
  baslik: 'Stok Durumu',
  altBaslik: '...' | function(param){...},
  ikon: '#ic-chart',
  grup: 'Giriş' | 'Takip' | 'Yönetim' | null,   // null => menüde görünmez
  rol: 'Hepsi' | 'Yonetici',
  ciz: function(kap, param) { ... }             // kap: HTMLElement (içerik alanı)
})

YU.git(kod, param)            // hash yönlendirme:  #/stok-durumu?tarih=2026-01-20
YU.yenile()                   // aktif sayfayı yeniden çiz
YU.param()                    // aktif URL parametreleri {anahtar:deger}
```

**Yetki (Test 7 — DEMİRBAŞ):** `YU.git()` ve `hashchange` işleyicisi, sayfanın
`rol` alanı `'Yonetici'` iken `YU.rol() !== 'Yonetici'` ise sayfayı **çizmez**;
"Bu ekrana erişim yetkiniz yok." yetkisiz ekranı gösterir. Menüde gizlemek tek
başına yeterli değildir.

### UI yardımcıları

```js
YU.h(etiket, ozellikler, ...cocuklar)   // Element üretici. ozellikler:
   // {sinif, metin, html, deger, tip, onClick, onInput, onChange, stil:{}, veri:{}, ...attr}
   // cocuk: Element | string | null | dizi
YU.svg(ikonId, boyut)                   // <svg><use href="#ic-..."></use></svg>
YU.bos(kap)                             // kap.replaceChildren()

YU.ui.dugme({metin, ikon, tur:'birincil'|'ikincil'|'tehlike'|'sade', kucuk, onClick, pasif})
YU.ui.kpi({etiket, deger, alt, ikon, renk:'vurgu'|'olumlu'|'olumsuz'|'bekleyen'})
YU.ui.panel({baslik, ikon, sag, govde, dolgusuz})       // govde: Element|Element[]
YU.ui.tablo({sutunlar, satirlar, bos, kompakt})
   // sutunlar: [{baslik, genislik, hiza:'sol'|'sag'|'orta', mono:bool}]
   // satirlar: [[hucre, ...]]  hucre: string | Element
YU.ui.rozet(metin, tur)                 // tur:'olumlu'|'olumsuz'|'bekleyen'|'notr'|'vurgu'
YU.ui.acilirCip({etiket, metin, ikon, baslik, genislik, hiza, dolgu, enGenis,
                 govde: Element | function(kapat) -> Element})
   // Tıklanınca altında kutu açan filtre çipi (referanstaki "Durum: Tümü" dili).
   // Ekranın filtre satırını tek satıra indirmek için: seçim kutuları kutunun
   // içine girer, çipte yalnız SEÇİLİ DEĞER yazar. Ok aşağı bakar, kutu açıkken
   // yukarı döner. Dışarı tıklama ve Esc kapatır.
YU.ui.secimGrubu({secenekler:[{deger, metin}], deger, onDegis})   // segment düğmesi
YU.ui.acilirSatir({metin, sag, secili, onClick})                  // açılır kutu liste satırı
YU.ui.cubuk(oran, tur)                  // 0..1 ilerleme çubuğu
YU.ui.bosDurum({ikon, baslik, metin, eylemler:[Element]})
YU.ui.serit({tur:'hata'|'uyari'|'bilgi'|'basari', baslik, metin, eylem})
YU.ui.alan({etiket, tip:'sayi'|'metin'|'tarih'|'secim'|'parola', deger, secenekler,
            yardim, sag, pasif, onInput, genislik})     // -> {kok, girdi, hataGoster(m)}
YU.ui.sekmeler({sekmeler:[{kod,metin}], aktif, onDegis}) // -> Element
YU.ui.bildir(mesaj, tur)                // sağ altta toast, 4 sn
YU.ui.onay({baslik, metin, onayMetni, tehlike}) -> Promise<bool>
YU.ui.modal({baslik, govde, genislik, dugmeler:[{metin,tur,onClick}]}) -> {kapat}
YU.ui.sutunGrafik({veri:[{etiket, deger1, deger2}], yukseklik, renk1, renk2, efsane})
YU.ui.cizgiGrafik({veri:[{etiket, deger}], yukseklik})
YU.ui.halkaGrafik({dilimler:[{etiket, deger, renk}], boyut})
YU.ui.karsilastirmaGrafik({noktalar:[{etiket, baslik}], yukseklik, bicim, eksenBicim,
   seriler:[{ad, renk, secili, degerler:[...], altlar:[...]}],   // N SERİ
   onSeriTikla: function(indeks, seri, yeniDurum)})              // verilirse efsane SEÇİCİ olur
   // Bütün seriler aynı x eksenini paylaşır (i. nokta = (i+1). kampanya günü).
   // secili:false olan seri ÇİZİLMEZ ama efsanede durur; tıklanınca geri gelir.
   // Eksen tavanı yalnız çizilen serilere göre hesaplanır. İpucundaki "Fark"
   // satırı yalnız TAM İKİ seri seçiliyken çıkar — üç seride fark belirsizdir.
   // null değer çizgiyi koparır.
   // Eski kullanım da geçerlidir: {noktalar:[{deger1, deger2, alt1, alt2}], seri1, seri2}
YU.ui.hataListesi(hatalar)              // D-kodlu hata/uyarı listesi elemanı
```

Grafiklerin tamamı **inline SVG**; kütüphane yok (tasarım referansı kuralı).

---

## 7. Sayfalar (Şartname §7)

| kod | Başlık | Grup | Rol | Dosya |
|---|---|---|---|---|
| `anasayfa` | Ana Sayfa | — (üstte tek başına) | Hepsi | `20-anasayfa.js` |
| `kuru-kuspe` | Kuru Küspe Günlük Giriş | Giriş | Hepsi | `21-kuru-kuspe-giris.js` |
| `malzeme-girisi` | Malzeme Girişi | Giriş | Hepsi | `22-malzeme-girisi.js` |
| `stok-durumu` | Günlük Stok Durumu | Takip | Hepsi | `23-stok-durumu.js` — ad "Stok Durumu" idi; gün bazlı görünüm olduğu için "Günlük" öneki eklendi (kullanıcı kararı, 25.08.2026) |
| `silo-durumu` | Günlük Silo Durumu | Takip | Hepsi | `24-silo-durumu.js` — ad "Silo Durumu" idi; aynı karar |
| `gunluk-rapor` | Günlük Rapor | Takip | Hepsi | `25-gunluk-rapor.js` |
| `gecmis-girisler` | Geçmiş Girişler | Takip | Hepsi | `26-gecmis-girisler.js` |
| `devir-stok` | Devir Stok | Yönetim | Yonetici | `27-devir-stok.js` |
| `malzeme-yonetimi` | Malzeme Yönetimi | Yönetim | Yonetici | `28-malzeme-yonetimi.js` |
| `kullanici-yonetimi` | Kullanıcı Yönetimi | Yönetim | Yonetici | `29-kullanici-yonetimi.js` |
| `degisiklik-gecmisi` | Değişiklik Geçmişi | Yönetim | Yonetici | `30-degisiklik-gecmisi.js` |
| `analizler` | Analizler | Yönetim | Yonetici | `31-analizler.js` — kampanyaları GÜN SIRASINA göre karşılaştırır (devir günü = 1. gün; bugün N. günse geçmiş kampanyanın N. günü karşısına konur). Kampanyalar grafiğin üstündeki EFSANEDEN onay kutusuyla işaretlenir; işaretli olanlar çizilir ve tabloda birer sütun alır. GÖSTERİM SIRASI eskiden yeniye (soldan sağa artan); RENK ise yenilik sırasına göre sabittir (en yeni mavi, bir önceki kırmızı) — listedeki yeri değişse de kampanyanın rengi değişmez. Analiz penceresi VARSAYILAN OLARAK KAMPANYANIN TAMAMIDIR, üstteki tarih aralığıyla daraltılabilir. URL: `?kampanyalar=a,b&gosterge=&mod=gunluk|birikimli&basGun=&bitGun=` (`bu`/`karsi` de kabul edilir) |
| `kabul-testleri` | Kabul Testleri | Yönetim | Yonetici | `40-kabul-testleri.js` |

### İkon eşlemesi (tasarım referansındaki 20 ikon dışına ÇIKILMAZ)

`anasayfa→#ic-home` · `kuru-kuspe→#ic-plus` · `malzeme-girisi→#ic-pencil` ·
`stok-durumu→#ic-chart` · `silo-durumu→#ic-building` · `gunluk-rapor→#ic-doc` ·
`gecmis-girisler→#ic-calendar` · `devir-stok→#ic-wallet` ·
`malzeme-yonetimi→#ic-gear` · `kullanici-yonetimi→#ic-users` ·
`degisiklik-gecmisi→#ic-dots` · `analizler→#ic-bars-up` · `kabul-testleri→#ic-percent`

---

## 8. Giriş ekranı (rol seçimi)

Gerçek kimlik doğrulama **yok** (kullanıcı isteği). `index.html` açıldığında tam
ekran bir seçim perdesi gelir:

* Marka bloğu (tasarım referansındaki 28px kare + ad).
* Başlık: **Yan Ürünler Stok Takip**, alt satır: *Şeker Fabrikası · Kampanya 2025/2026*
* İki büyük kart düğme yan yana:
  * **Yönetici Girişi** — `#ic-users` · "Cenk Sefer ÇOĞALMIŞ · tüm ekranlar, devir stok, kullanıcı ve malzeme yönetimi"
  * **Operatör Girişi** — `#ic-pencil` · "Ahmet Yılmaz · günlük giriş, stok ve rapor görüntüleme"
* Altta küçük not: *"Prototip — parola doğrulaması yoktur. Gerçek uygulamada
  kullanıcı adı + BCrypt hash'li parola ile giriş yapılır (Şartname §3)."*
* Sağ üstte tema düğmesi.

Seçim `YU.oturum.kullanici`'yı doldurur, `localStorage['yu.oturum']`'a yazılır ve
`YU.git('anasayfa')` çağrılır. Üst şeritteki kullanıcı kartına tıklanınca
"Oturumu kapat" çıkar ve seçim perdesine dönülür.

---

## 9. CSS — `css/tema.css`

### Değişkenler (tasarım referansından birebir okunmuştur)

Açık tema `:root` üzerinde tanımlanır. `html[data-tema="koyu"]` koyu değerleri
ezer. Sistem tercihi `@media (prefers-color-scheme: dark)` altında
`html:not([data-tema="acik"])` ile uygulanır.

```
AÇIK                                  KOYU
--zemin:        #fdfdfe               #0b0d10
--yan-zemin:    #fbfbfc               #08090b
--ust-zemin:    #ffffff               #0d0f13
--yuzey:        #ffffff               #0d0f13
--yuzey-2:      #fafbfc               rgba(255,255,255,.03)
--yuzey-3:      #f4f5f7               rgba(255,255,255,.05)
--yuzey-4:      #f1f3f6               rgba(255,255,255,.06)
--kenar:        #e8eaee               rgba(255,255,255,.06)
--kenar-2:      #e3e6eb               rgba(255,255,255,.09)
--kenar-3:      #dfe3ea               rgba(255,255,255,.12)
--ayrac:        #eef0f3               rgba(255,255,255,.06)
--ayrac-2:      #f3f4f7               rgba(255,255,255,.05)
--metin:        #171a1f               #e6e9ec
--metin-2:      #3d434d               #c3c8d2
--metin-3:      #5c636e               #aeb6bf
--metin-4:      #8b93a1               #8b949e
--metin-5:      #98a0ad               #69737d
--vurgu:        oklch(0.55 0.14 250)  oklch(0.66 0.13 250)
--vurgu-koyu:   oklch(0.48 0.14 250)  oklch(0.74 0.12 250)
--vurgu-zemin:  #eef2fb               rgba(90,140,230,.16)
--vurgu-uzeri:  #ffffff               #08090b
--olumlu:       #0f7b4f               #6ee7a0
--olumlu-zemin: #e7f4ed               rgba(110,231,160,.12)
--olumsuz:      #d94a4a               #f87171
--olumsuz-zemin:#fdecec               rgba(248,113,113,.12)
--bekleyen:     #8a5a00               #e9b872
--bekleyen-zemin:#fdf3e0              rgba(233,184,114,.12)
--notr-zemin:   #eef0f3               rgba(255,255,255,.06)
--golge:        0 1px 3px rgba(20,24,32,.06)     none
--golge-2:      0 2px 8px rgba(20,24,32,.05)     none
--r-s: 6px  --r: 8px  --r-l: 10px
--font: 'Helvetica Neue', Helvetica, Arial, sans-serif
--mono: ui-monospace, SFMono-Regular, Menlo, monospace
```

> **KOYU TEMA KURALI (CLAUDE.md KURAL 1):** koyu temada derinlik **gölgeyle değil**,
> `rgba(255,255,255,.03 … .16)` katman tonlarıyla kurulur. Koyu temada
> `box-shadow` kullanılmaz.

### Ölçüler (tasarım referansı `2a`)

| Öğe | Değer |
|---|---|
| Izgara | `grid-template-columns: 236px 1fr` |
| Kenar çubuğu | dolgu `22px 16px`, `gap 24px`, sağ kenarlık `1px solid var(--kenar)` |
| Marka karesi | `28px`, `border-radius:7px`, zemin `var(--vurgu)`, harf `600 13px` |
| Seçici kutu | dolgu `9px 10px`, `1px solid var(--kenar-2)`, `radius 8px` |
| Menü ögesi | dolgu `9px 10px`, `radius 8px`, `font 400 13px`, hover `var(--yuzey-4)` |
| Menü aktif | zemin `var(--vurgu-zemin)`, metin `var(--vurgu)`, `font-weight 500` |
| Üst şerit | yükseklik `64px`, alt kenarlık `1px solid var(--kenar)`, zemin `var(--ust-zemin)`, yatay dolgu `28px`, `gap 16px` |
| Arama kutusu | `max-width:330px`, dolgu `8px 11px`, zemin `var(--yuzey-3)`, `radius 8px`, `font 12.5px` |
| İçerik | dolgu `26px 28px`, `display:flex; flex-direction:column; gap:20px` |
| Sayfa başlığı | `600 20px/1.2`, `letter-spacing:-.015em` |
| Sayfa alt başlığı | `400 12.5px/1.4`, `var(--metin-4)`, `margin-top:4px` |
| Düğme | dolgu `9px 13px`, `radius 8px`, `font 500 12.5px`, `gap 7px` |
| Düğme (küçük) | dolgu `6px 10px`, `radius 7px`, `font 400 11.5px` |
| KPI kartı | dolgu `16px 17px`, `1px solid var(--kenar)`, `radius 10px`, `gap 11px` |
| KPI ikon çipi | `26px`, `radius 7px`, zemin `var(--vurgu-zemin)`, renk `var(--vurgu)` |
| KPI etiket | `400 12px`, `var(--metin-4)` |
| KPI değer | `500 24px/1 var(--mono)`, `letter-spacing:-.02em`, `font-variant-numeric: tabular-nums` |
| KPI alt | `400 11.5px`, `var(--metin-4)` |
| Panel | dolgu `18px 20px`, `1px solid var(--kenar)`, `radius 10px`, zemin `var(--yuzey)` |
| Panel başlığı | `500 13.5px`, alt boşluk `16px` |
| Tablo başlığı | dolgu `9px 18px`, zemin `var(--yuzey-2)`, `font 500 10.5px`, `letter-spacing:.06em`, `text-transform:uppercase`, `var(--metin-5)` |
| Tablo satırı | dolgu `12px 18px`, alt kenarlık `1px solid var(--ayrac-2)`, hover `var(--yuzey-2)` |
| Sayısal hücre | `var(--mono)`, `500 12.5px`, `text-align:right`, `tabular-nums` |
| Rozet | dolgu `4px 9px`, `radius 5px`, `font 500 11px` |
| İlerleme çubuğu | yükseklik `5px`, `radius 3px`, zemin `var(--ayrac)` |
| Boş durum | ikon dairesi `52px`, başlık `500 14.5px`, metin `400 12.5px/1.6` `max-width:320px` |

### Sınıf adları (bunların dışına çıkılmaz)

```
.yu-kabuk .yu-yan .yu-marka .yu-marka-kare .yu-marka-ad .yu-secici
.yu-menu .yu-menu-grup .yu-menu-grup-bas .yu-menu-oge .yu-menu-oge.aktif
.yu-yan-kart .yu-yan-kart-bas .yu-yan-kart-metin
.yu-ana .yu-ust .yu-ara .yu-cip .yu-cip.acilir .yu-cip.acik .yu-cip-ok .yu-cip-etiket .yu-cip-deger
.yu-arac .yu-arac-sag .yu-arac-ayrac .yu-secim-grubu .yu-secim-oge .yu-secim-oge.aktif
.yu-efsane-oge .yu-efsane-oge.secili .yu-efsane-kutu
.yu-zil .yu-kullanici .yu-avatar .yu-kullanici-ad .yu-kullanici-rol
.yu-icerik .yu-sayfa-bas .yu-sayfa-baslik .yu-sayfa-alt .yu-eylemler
.yu-dugme .yu-dugme.birincil .yu-dugme.ikincil .yu-dugme.tehlike .yu-dugme.sade .yu-dugme.kucuk
.yu-izgara .yu-iz-2 .yu-iz-3 .yu-iz-4 .yu-iz-yan .yu-iz-yan-ters
.yu-kpi .yu-kpi-bas .yu-kpi-ikon .yu-kpi-etiket .yu-kpi-deger .yu-kpi-alt
.yu-panel .yu-panel-bas .yu-panel-baslik .yu-panel-sag .yu-panel-govde
.yu-tablo .yu-tablo-sar .yu-sag .yu-orta .yu-mono .yu-zayif .yu-guclu
.yu-rozet .yu-rozet.olumlu .yu-rozet.olumsuz .yu-rozet.bekleyen .yu-rozet.notr .yu-rozet.vurgu
.yu-alan .yu-etiket .yu-girdi .yu-girdi.hatali .yu-girdi-sar .yu-girdi-sag .yu-yardim .yu-alan-hata
.yu-cubuk .yu-cubuk-dolu
.yu-bos .yu-bos-ikon .yu-bos-baslik .yu-bos-metin .yu-bos-eylem
.yu-serit .yu-serit.hata .yu-serit.uyari .yu-serit.bilgi .yu-serit.basari
.yu-serit-ikon .yu-serit-govde .yu-serit-baslik
.yu-bildirimler .yu-bildirim
.yu-perde .yu-modal .yu-modal-bas .yu-modal-govde .yu-modal-alt
.yu-sekmeler .yu-sekme .yu-sekme.aktif
.yu-giris .yu-giris-kart .yu-giris-roller .yu-giris-rol .yu-giris-not
.yu-hesap .yu-hesap-oge .yu-hesap-etiket .yu-hesap-deger .yu-hesap-ok
.yu-satir-eylem .yu-satir-eylem.tehlike
.yu-ayrac .yu-yatay .yu-dikey
.yu-tema-dugme
```

---

## 10. Soru-cevap motoru — KALDIRILDI (kullanıcı isteği, 24.08.2026)

Analizler ekranındaki soru kutusu ve motoru (`32-analiz-dil.js`,
`34-analiz-soru.js`, `41-soru-testleri.js`) silindi — gereksiz yük.
`33-analiz-veri.js` (YU.analiz) DURUYOR: grafik ve tablo onu kullanır.

---

## 11. Kabul testleri (Şartname §9) — `js/40-kabul-testleri.js`

12 test, tarayıcı içinde çalışır. Her test **temiz bellek deposuyla** başlar
(`YU.Depo({kaynak:'bellek', tohumla:false})` + malzeme/silo/kullanıcı başlangıç kayıtları).
Ekran her test için: numara, ad, DEMİRBAŞ/v2 rozeti, senaryo, beklenen, gerçekleşen,
GEÇTİ/KALDI rozeti. Üstte "Tümünü Çalıştır" düğmesi ve geçen/kalan sayacı.

Beklenen rakamlar **DEMİRBAŞ**, birebir uygulanır (Şartname §9). Özet:

1. 250.000 dökme + 200 çuval → net 240.000, Silo 1 = 240.000, çuvallı stok 10.000
2. Ertesi gün 5.000 dökme + 200 çuval → çekiş 5.000, Silo 1 = 235.000
3. Test 1'in günü 300.000'e çıkar → Silo 1 = 290.000, o güne ait silo hareketi **1** adet
4. Silo 1'de 1.000 varken 5.000 çekiş → reddedilir (D7)
5. Net 240.000 iken 200.000 dağıtım → reddedilir (D3)
6. Test 1 sonrası dökme + çuvallı = 250.000 (260.000 ise çift sayım)
7. Operatörle `#/devir-stok` → erişim engellenir
8. Tek yönetici kendi rolünü düşüremez (D10)
9. Test 1+2 sonrası 03.07'yi 8.000'e düşürme → reddedilir (D14), Silo 1 = 235.000
10. Test 1+2 sonrası 03.07 silinemez (D14); önce 04.07 silinirse silinebilir, sonuç 0
11. Ertesi gün 0/0/40.000 satış Silo 1'den → Silo 1 = 200.000, tip `DokmeSatis`, karşılıksızsa red (D13)
12. İki oturum aynı günü açar, ikincisi reddedilir (D16), birincinin değerleri korunur

> Testlerdeki tarihler şartnamedeki gibi `2026-07-03` / `2026-07-04` kullanılır.

---

## 12. Yasaklar

* `Math.random()` — deterministik PRNG dışında kullanılmaz.
* `type="module"`, `import`, `fetch`, `await import` — `file://` üzerinde çalışmaz.
* Harici CSS/JS/font/CDN.
* Tasarım referansındaki 20 ikon dışında yeni ikon.
* Koyu temada `box-shadow`.
* İngilizce arayüz metni.
* Şartnamede DEMİRBAŞ işaretli formül, kural veya beklenen rakamın değiştirilmesi.
* Soru motorunda **tahminle cevap üretmek**: rakam her zaman `YU.analiz`ten
  gelir, veri yoksa "veri yok" denir (§10.3 cevap verilmeme kuralı).
* Cevabın yanında **ne anlaşıldığını göstermemek** (§10.3 görünürlük kuralı).

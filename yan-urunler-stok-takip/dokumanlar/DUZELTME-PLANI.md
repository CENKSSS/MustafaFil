# DÜZELTME PLANI — 24.08.2026

> Kaynak: bu oturumdaki kod denetimi (üç bağımsız inceleme + satır satır doğrulama).
> Her madde: **Sorun → Kök sebep (dosya:satır) → Çözüm → Doğrulama**.
> Hiçbir madde Demirbaş formülü, D1–D16'nın anlamını, kabul testi rakamlarını
> veya §4 üzerine yazma davranışını değiştirmez. Kapsam dışına çıkılmaz (KURAL 5.1).
>
> Durum işaretleri: ☑ uygulandı (SONUÇ bölümlerinde doğrulama kayıtları) · ☒ iptal/geri alındı

---

## M1 — Silinen Id yeniden dağıtılıyor ☑

**Sorun.** `DegisiklikLog`/arşiv, kayda `Tablo + KayitId` ile bağlanıyor. Silinen bir
kaydın Id'si sonraki eklemede yeniden dağıtılınca eski log satırı **yeni** kayda
bağlanıyor (ölçüldü: silinen SiloHareket #899 "giren 11.356", canlı #899 "11.256").
Detay penceresi yanlış kaydı açıyor; iki kaydın geçmişi tek çizelgede karışıyor.

**Kök sebep.** `01-cekirdek.js:478-486` — `yeniId = tablodaki max Id + 1`.
Tablonun sonundaki satırlar silinince max düşüyor, aynı Id yeniden veriliyor.

**Çözüm.**
- Depoya kalıcı sayaç nesnesi: `depo.sayaclar = { tabloAdi: sonVerilenId }`.
- `yeniId(tablo)`: `taban = max(sayac, tablodaki en büyük Id)`; `yeni = taban + 1`;
  sayaca geri yazılır. Sayaç **asla geri gitmez**.
- `kaydet()` paketi `sayaclar` anahtarıyla yazar; `oku()` geri yükler (yoksa `{}` —
  eski paketlerde tablo taraması taban olur).
- `sifirla()` sayaçları temizler (tohum her koşuda aynı Id'leri üretir — determinizm).
- `bosla()` yalnız boşalttığı hareket tablolarının sayaçlarını temizler (test
  yardımcısı bugünkü Id davranışını korur; kabul testleri etkilenmez).
- `SEMA_SURUM 9 → 10` (tohum çıktısı değişir; SOZLESME §0 kuralı gereği zorunlu).

**Etki.** Silinen kayıtların log satırları artık canlı kayda çözülmez —
Değişiklik Geçmişi bunları zaten "kayıt bulunamadı/silinmiş" olarak gösterebiliyor
(`30:292-295` `kayitCoz.bulundu:false` yolu mevcut). `05-tohum.js:637` `kayitDamgalari`
Id eşleşmesiyle çalışır; silinen satıra damga vurmaz — doğru davranış.

**Doğrulama.** Node koşumu: gün sil → yeni kayıt ekle → eski Id geri gelmemeli;
"Sil" log satırı `logKayitBul` ile canlıya çözülmemeli. Kabul testleri 12/12.

---

## M2 — localStorage kota hatası yutuluyor ☑

**Sorun.** Yazma patlarsa kullanıcı "kaydedildi" görür; yenileyince veri yok.

**Kök sebep.** `01-cekirdek.js:497-499` — `kaydet()` catch bloğu boş, dönüş yok.

**Çözüm.**
- `kaydet()` başarıda `true`, başarısızlıkta `false` döner.
- 01'e katman-temiz kanca: başarısızlıkta `YU.depoUyari('kota')` çağrılır
  (tanımlıysa). Kancayı `10-kabuk.js` bağlar: kalıcı hata şeridi + `bildir`.
  01, UI'ya doğrudan bağımlanmaz (yükleme sırası bozulmaz).
- Servis imzaları DEĞİŞMEZ (KURAL 5.1) — veri bellekte günceldir, kullanıcı
  uyarıyı görür ve yedek indirebilir (M5).

**Doğrulama.** Node'da localStorage.setItem'ı patlatan sahte depo ile `kaydet()`
false dönmeli, kanca çağrılmalı.

---

## M3 — Çok sekmede sessiz ezme ☑

**Sorun.** Depo açılışta bir kez okunur; ikinci sekme kaydettiğinde birincinin
yazdıkları tüm paketle ezilir. D16 yakalamaz (kendi belleğine bakar).

**Kök sebep.** `01-cekirdek.js:491-500` — koşulsuz tüm paket yazımı; `storage`
olayı hiçbir yerde dinlenmiyor.

**Çözüm (minimal, onaylanan kapsam).**
- Küçük ayrı anahtar `yu.veri.sayac` (tamsayı yazma sayacı). Açılışta okunur;
  `kaydet()` önce depodaki sayacı kontrol eder: **farklıysa yazmaz**, `false`
  döner, `YU.depoUyari('cakisma')` tetiklenir (diğer sekmenin verisi korunur).
  Aynıysa paket + sayaç+1 yazılır. Sayaç okunamıyorsa kontrol atlanır
  (localStorage kapalı ortamda bugünkü davranış).
- `10-kabuk.js`: `window 'storage'` dinleyicisi (`yu.veri.v1`/`yu.veri.sayac`) —
  içerik alanının üstüne kalıcı şerit: *"Veriler başka bir sekmede değişti —
  bu sekmedeki görünüm eski. Yenileyin."* + Yenile düğmesi (`location.reload`).
  Şerit `dom.icerik` içine, `sayfaBas`'ın üstüne eklenir; sayfa çizimi yalnız
  `dom.kap`'ı boşalttığı için (`10:1369`) şerit sayfa geçişlerinde durur.
- Tam birleştirme (merge) bilinçli olarak kapsam DIŞI — ayrı karar ister.

**Doğrulama.** Tarayıcıda iki sekme: birinde kayıt → diğerinde şerit; ikinci
sekme kaydetmeye çalışınca yazmaz + uyarır; yenileyince birincinin verisi durur.

---

## M4 — Bozuk/eski veri uyarısız siliniyor ☑

**Sorun.** JSON bozuksa veya şema sürümü değiştiyse depo sessizce yeniden
tohumlanıyor; kullanıcının gerçek verisi yedeksiz gidiyor.

**Kök sebep.** `01-cekirdek.js:459-474` — `oku()` null döner; `:514-516` null'da
`sifirla()`.

**Çözüm.**
- `oku()` null döndürmeden önce ham metni `yu.veri.yedek` anahtarına kopyalar
  (tek yedek; bir öncekinin üzerine yazar) ve sebep notu bırakır
  (`bozuk` | `surum`). Not, modül içinde `YU.depoKurtarmaNotu`'ya yazılır.
- `10-kabuk.js` kabuk kurulunca notu görürse bilgi şeridi: *"Önceki veri
  okunamadı / şema güncellendi; eski içerik `yu.veri.yedek` anahtarına
  yedeklendi, örnek veri yüklendi."*

**Doğrulama.** localStorage'a elle bozuk JSON koy → açılışta yedek anahtarı
dolu + şerit; sürüm uyumsuzluğunda aynı akış.

---

## M5 — Yedek İndir / Yedek Yükle yok ☑

**Sorun.** Tek kopya localStorage'da; tarayıcı verisi temizlenince her şey gider.

**Çözüm.**
- `01-cekirdek.js` depo API'sine iki uç: `disaAktar()` → güncel paketin JSON
  metni (surum + tüm tablolar + sayaclar); `iceAktar(metin)` → `{ok, hata}` —
  `oku()`'daki aynı doğrulamadan geçirir (sürüm eşleşmeli, tablolar dizi olmalı),
  başarıda tabloları doldurup kaydeder. Doğrulama 01'de kalır; 10 yalnız çağırır.
- `10-kabuk.js` `testDugmeleri()` satırına iki küçük düğme:
  **Yedek İndir** (`#ic-download`) — Blob + `a[download]`,
  ad: `yan-urunler-yedek-<bugün>.json`. **Yedek Yükle** (`#ic-up`) —
  `input[type=file]` + FileReader; üzerine yazma ONAY penceresi (tehlike);
  başarıda `location.reload()`.
- Kısıt yok (fetch/module yasakları ihlal edilmez; Blob/FileReader serbest).

**Varsayım (işaretli).** `a[download]`'ın `file://` altında çalıştığı
Chrome/Edge'de doğrudur; kullanıcının ortamı localhost:8137 olduğundan ek risk yok.

**Doğrulama.** Tarayıcıda indir → dosya iner; boş depoya geri yükle → veri döner.

---

## M6 — Günlük Rapor'da ham girdi görünmüyor (Demirbaş §4) ☑

**Sorun.** Durum B'de operatör 5.000 girer, ekranda dökme üretim "—/0" görünür.
Şartname §4 Demirbaş: ham rakam **raporda ayrı görünmeli** (Test 2 beklentisi).

**Kök sebep.** `25-gunluk-rapor.js:814-819` — ham girdiyi gösteren paneller
24.08.2026'da kaldırıldı; `malzemePaneli` yalnız net üretimi basıyor (`:282`).

**Çözüm (onaylanan biçim: tek satır alt not).** `malzemePaneli`'nde Dökme Kuru
Küspe satırının Üretim hücresi iki satırlı olur: üstte net (mevcut davranış),
altta zayıf küçük yazıyla `Ham: 26.720` (yalnız `ozet.kuruKuspe` varsa;
değer `ozet.hesap.hamUretilenDokme` — `04-servis.js:442`). `title` ipucu
Şartname §4'ü söyler. Durum B'de üst satır "—", alt satır `Ham: 5.000` —
"ben 5.000 girmiştim, nerede?" sorusu ekranda cevaplanır.
Başka ekrana dokunulmaz.

**Doğrulama.** Tarayıcıda Durum B günü (09.08 veya 15.08) açılır; ham satır
görülür; ekran görüntüsü alınır.

---

## M7 — D16 yeni-gün yarışını yakalamıyor ☑

**Sorun.** İki oturum aynı **kayıtsız** günü açarsa ikisinde de rowVersion=null;
ikincisi birincinin kaydını sessizce ezer. (Sözleşme girdi kontratı: "yeni
kayıt: null; güncelleme: okunan RowVersion" — null "yeni kayıt iddiasıdır".)

**Kök sebep.** `03-dogrulama.js:374` ve `:486` — D16 yalnız
`rowVersion !== null` iken bakılıyor; null + mevcut kayıt = kontrolsüz üzerine yazma.

**Çözüm.**
- `kuruKuspeKaydi`: `rowVersion` null/undefined İKEN o güne kayıt VARSA →
  D16 hatası: *"… siz ekranı açtıktan sonra başkası tarafından girilmiş
  (sürüm N). Sayfayı yenileyip mevcut kaydın üzerinden düzeltin."*
- `malzemeHareketi`: aynı ekleme (satır bazında).
- **Etkileşim düzeltmesi:** `05-tohum.js:540-543` çuvallı satışı, kuru küspe
  kaydının az önce oluşturduğu satırın üstüne `rowVersion:null` ile yazıyor —
  kontrata aykırıydı; `hareketBul` ile gerçek RowVersion geçirilir.
- Kabul testleri 3/9/12 rowVersion'ı zaten okunandan geçiriyor
  (`40:315,412,482-487`) — değişiklik gerekmez. 22 ekranı satır başına gerçek
  RowVersion geçiriyor (`22-malzeme-girisi` satır verisi) — değişiklik gerekmez.
- Şartname D16 metnine dokunulmaz; bu, D17 gibi işaretli prototip eklentisidir
  (yorumda belirtilir).

**Doğrulama.** Node: kayıtsız güne iki kez `rowVersion:null` ile kayıt →
ikincisi D16 ile reddedilmeli. Tohum + 12 kabul testi yeşil kalmalı.

---

## M8 — Tohum geçmişi takvim gününe göre değişiyor ☑

**Sorun.** Süren kampanyanın gün sayısı bugüne bağlı (`05:887-889`) ve satış
hedef rampası `g / (gunSayisi-1)`'e bölündüğü için (`05:431`) yeniden tohumlama
farklı bir günde yapılırsa **geçmiş günlerin rakamları da değişiyor**
(ölçüldü: 33 ortak günün 28'i farklı).

**Çözüm.** Kampanya tanımına sabit rampa ufku: `rampaUfku: 122` (tam sezon
uzunluğu; geçmiş kampanyayla aynı ölçek). Formül:
`ufuk = plan.rampaUfku || plan.gunSayisi; oran = min(1, g/(ufuk-1))`.
Geçmiş kampanyada (`gunSayisi:122`) sonuç bire bir aynı kalır; süren kampanyada
her günün hedefi yalnız gün sırasına bağlanır — tohumlama hangi gün koşarsa
koşsun ortak günler aynı çıkar. Denetim izi tanımı gereği "son güne" görelidir
ve öyle kalır (sözleşmedeki "son kayıt bugüne denk gelir" kuralı).
`SEMA_SURUM` artışı M1 ile ortak (10).

**Doğrulama.** Node: bugün=24.08 ve bugün=30.08 ile iki tohumlama → ortak
günlerin KuruKuspeGunluk + GunlukHareket satırları bire bir eşit.

---

## M9 — Silo kapasitesi denetimsiz ☑

**Sorun.** Kapasite 0 yazılırsa D15 o silo için tamamen kapanır (tüm kontroller
`kapasite > 0` şartlı); mevcut stokun altına düşürülünce geçmiş günler geriye
dönük kapasite aşımına düşer, kimse uyarılmaz.

**Kök sebep.** `03-dogrulama.js:688-692` — silo doğrulaması yalnız ad tekilliği
ve `NaN/negatif` bakıyor. `04-servis.js:1226-1227` NaN'i 0'a çeviriyor.

**Çözüm (onaylanan: 0'ı reddet, mevcut altını uyar).**
- `03 siloDogrula`: `kapasite` NaN → hata; `<= 0` → hata (*"Kapasite 0 olamaz —
  D15 kapasite kontrolü devre dışı kalır"*). Yeni silo eklerken de geçerli.
- `04 siloKaydet`: doğrulama geçtiyse ve `kapasite <` silonun bugünkü
  `YU.stok.siloStok(...).mevcut` değeri ise sonuç `uyarilar`'ına satır eklenir
  (uyarı 04'te üretilir çünkü stok sorguları o katmanda; 03'e katman bağımlılığı
  sokulmaz). Kayıt engellenmez.
- `28` silo kaydet akışı: `sonuc.ok && sonuc.uyarilar.length` → `bildir(uyari)`.

**Doğrulama.** Node: kapasite 0 → hata; 3.000.000→100.000 (mevcut ~450.000) →
ok + uyarı. Tohum siloları 3.000.000 — etkilenmez.

---

## M10 — Arşiv/log tabloları sınırsız büyüyor ☑

**Sorun.** `OlayGunlugu` 2000 ile sınırlı ama `DegisiklikLog`,
`SilinenKayitlar`, `StokFotograflari` sınırsız — uzun kullanımda kota dolar ve
M2'deki kayıp senaryosunu tetikler.

**Kök sebep.** `04-servis.js:1256` yalnız `OLAY_SINIRI` var.

**Çözüm.** Aynı kalıpla üst sınırlar (taşınca en eski düşer):
`DEGISIKLIK_SINIRI = 5000` (logYaz sonunda), `SILINEN_SINIRI = 2000`
(copKutusunaAt sonunda), `FOTOGRAF_SINIRI = 400` (fotoCek sonunda; tarih başına
tek kayıt olduğundan ~3 sezon demektir). Denetim izinin en eskisinin düşmesi
bilinçli ödünleşimdir: localStorage ~5 MB; kalıcı arşiv isteyen kullanıcı için
M5 yedek indirme var. Kod yorumu ve SOZLESME notu bunu açıkça söyler.

**Doğrulama.** Node: sınırın 1 üstüne satır yaz → en eski düşmeli, sayı sabit.

---

## M11 — Tüm Hareketler: sayfasız ve operatöre açık ☑

**Sorun.** İki kampanyanın tamamı tek seferde DOM'a basılıyor (`32:211-213`,
binlerce satır); ekran `rol:'Hepsi'` — silinen kayıtları ve "kim sildi"
bilgisini operatöre gösteriyor (Değişiklik Geçmişi yöneticiye kapalıyken).

**Çözüm.**
- `rol: 'Yonetici'` (`32:229`) — kullanıcı onayı bu turda alındı ("hepsini uygula").
  Yetki kapısı `10:1389` hazır; menüde zaten görünmüyor.
- Gün bazlı sayfalama: `GUN_SAYFA = 10` gün/sayfa; 26-gecmis-girisler'in
  sayfalama dili (Önceki/numara penceresi/Sonraki — `26:283-350`) yerel olarak
  uyarlanır. Sayfa `?sayfa=` parametresiyle taşınır (`YU.git`), geri tuşu çalışır.
  Alt başlıktaki toplam sayaç kalır.

**Doğrulama.** Tarayıcı: yöneticiyle sayfalama gezinir; operatörle
`#/tum-hareketler` → erişim engeli ekranı.

---

## M12 — Değişiklik Geçmişi: iki gösterim hatası ☑

**Sorun 1.** Her sayfanın ilk satırında detay penceresi grubu kaybediyor —
"2 alan"lık işlem "1 kalem" açılıyor.
**Kök sebep.** `30:984` — dilim başı yeniden kurulurken `grup` alanı düşüyor.
**Çözüm.** Yeniden kurarken `grup: dilim[0].grup` korunur (tek satır).

**Sorun 2.** KPI sayaçları silo süzgecini yok sayıyor — silo seçiliyken
kartlar listeyle tutmuyor.
**Kök sebep.** `30:907-908` — `islemsiz` kopyasına `silo` alanı alınmamış.
**Çözüm.** `silo: durum.silo` eklenir (tek satır).

**Doğrulama.** Tarayıcı: sayfa başı çok-alanlı satır detayı "N alan" göstermeli;
silo süzgeçliyken kart toplamı = liste toplamı.

---

## M13 — SOZLESME.md kodun gerisinde — GERİ ALINDI

> Kullanıcı direktifi (24.08.2026, ikinci parti): "4. kısmı es geç; yaptıysan
> da geri al." SOZLESME.md oturum başındaki hâline geri yazıldı; bu oturumda
> yapılan tüm belge ekleri kaldırıldı. Kod değişiklikleri (M1–M12) DURUYOR —
> geri alınan yalnız belgedir. Aşağıdaki M13 metni tarihçe olarak bırakıldı. ☒

**Sorun.** "Uyuşmazlıkta bu dosya kazanır" diyen sözleşme; 32-tum-hareketler,
`Iade` alanı, 8 malzeme, kampanya kilidi, ikon istisnaları, `fmt.ton` çıktısı
ve `gunluk-rapor` başlık/menü değişikliğini bilmiyor.

**Çözüm.** SOZLESME.md şu gerçeklerle güncellenir (tamamı kodda bugün var —
yeni karar üretilmez): dosya sırasına `32-tum-hareketler.js`; §1'e `Iade`
alanı + arşiv tabloları + 8'li malzeme listesi + Id sayaç kuralı; §2'ye depo
API ekleri (`kaydet` dönüşü, `disaAktar/iceAktar`, `sayaclar`, `yu.veri.sayac`,
`yu.veri.yedek`) + rampa ufku notu; §4'e D17 ve D16 yeni-gün ayağı + kapasite
kuralları + log sınırları; §7 tablosuna `tum-hareketler` satırı ve
`gunluk-rapor` başlık notu; ikon bölümüne index.html'deki onaylı istisna
listesi; `fmt.ton` örneği "240 ton". Bu plan dosyası da depoda kalır.

**Doğrulama.** Belge ile kod bire bir okunarak karşılaştırılır (bu oturumda yapıldı).

---

## Uygulama sırası ve test kapısı

1. M1+M2+M3+M4+M5 (çekirdek: 01) → 2. M7+M8 (03+05) → 3. M9+M10 (03+04+28)
→ 4. M6 (25) → 5. M12 (30) → 6. M11 (32) → 7. M13 (SOZLESME).

Her adımdan sonra Node veri-katmanı koşumu; sonunda tarayıcıda **12 kabul
testi** + ekran doğrulamaları. Kabul testlerinden biri bile kırmızıysa değişiklik
geri alınır, rapor edilir.

---

## SONUÇ (24.08.2026 — uygulama tamamlandı)

* **Node veri katmanı koşumu: 32/32 GEÇTİ** (determinizm aynı gün + farklı gün,
  Id sayaçları, D16 yeni-gün, kapasite, sınırlar, kota, çakışma, yedek turu,
  bozuk-veri yedeği, stok tutarlılığı).
* **Tarayıcıda 12 kabul testi: 12/12 GEÇTİ** (4,4 ms).
* Ekranda doğrulananlar: Günlük Rapor'da Durum B gününde `Ham: 1.090` alt
  satırı; Tüm Hareketler 16 sayfa, `?sayfa=` çalışıyor; iki sekme denemesinde
  ikinci sekme kaydedince birincide şerit çıktı ve birinci sekme diske yazamadı;
  üst şeritte Yedek İndir / Yedek Yükle düğmeleri; Değişiklik Geçmişi #156
  detayı iki alanı da gösteriyor.
* Kod düzeyinde doğrulanan (ekran kurgusu zahmetli olduğu için): M12 sayfa-başı
  `grup` koruması ve KPI `silo` süzgeci — tek satırlık alan eklemeleri.
* Tarayıcıda kullanıcıya kalan tek el testi: "Yedek İndir" tıklamasının dosyayı
  indirmesi (Node'da disaAktar/iceAktar turu doğrulandı; indirme tıklaması
  oturumun tarayıcı penceresinde denenmedi).
* `SEMA_SURUM 9 → 10`: mevcut tarayıcı verisi ilk açılışta yedeklenip
  (`yu.veri.yedek` + bilgi şeridi) yeniden tohumlanır — beklenen davranış.

---
---

# İKİNCİ PARTİ — 24.08.2026 (kullanıcı isteği: 3/4/5. bölümlerin kalanı)

> Kapsam notları:
> * "Devir Stok'ta URL ile gelecek tarih" maddesi UYGULANMAZ — geri çekildi:
>   `03-dogrulama.js:37` gerekçeli bilinçli karar ("gelecek kampanyanın devri
>   önceden tanımlanabilir"); D17 devri bilerek kapsamıyor.
> * Bölüm 4 (belge açığı) birinci partide M13 ile kapandı; bölüm 5'in
>   yedekleme ve log-sınırı maddeleri M5/M10 ile kapandı.

## M14 — Devir öncesi tarihe "hayalet" kayıt ☑

**Sorun.** En eski devirden önceki güne üretim/satış yazılabiliyor; o hareketler
stok hesabına girmiyor (devir bakiyeyi sıfırlar) — görünmez veri.

**Kök sebep.** Ekranlar yalnız GELECEK tarihi kırpar; `03-dogrulama.js`
kuruKuspe/malzeme yollarında alt sınır yok.

**Çözüm.** Prototip kuralı **D18** (D17 kalıbında, şartname dışı işaretli):
depoda EN AZ BİR devir (malzeme veya silo) varsa, en eski devir tarihinden
önceki tarihe kuru küspe/malzeme kaydı reddedilir. Devir hiç yoksa kural pasif
(kabul testleri 1–3, 5–12 devirsiz koşar — Test 4'ün devri 01.07, kayıtları
03.07: etkilenmez). Tohum: her kampanyanın günleri kendi devir gününde başlar,
en eski devir 15.09.2025 — etkilenmez. Ekranlar (21/22) tarih alanına
`min = enEskiDevir` koyar (yalnız o iki ekran; ortak `ui.alan`'a dokunulmaz —
devir ekranının tarih alanı serbest kalmalı). `YU.dogrula.enEskiDevir` dışa açılır.

**Doğrulama.** Node: devirli depoda devir−1 güne kayıt → D18; devirsiz depoda
aynı kayıt → geçer. 12 kabul testi yeşil.

## M15 — Yönetici servislerinde rol denetimi ☑

**Sorun.** Şartname §8: "tek savunma hattı ekran olmamalı." Rol yalnız
yönlendirici + ekranda; konsoldan `YU.servis.kullaniciKaydet(...)` operatör
nesnesiyle bile çağrılabilir.

**Çözüm.** §7 rol tablosunda Yönetici olan ekranların servisleri çağıranın
rolünü denetler: `devirKaydet, siloDevirKaydet, devirSil, malzemeKaydet,
siloKaydet, kullaniciKaydet, kampanyaKilitle, kampanyaKilidiAc,
yeniKampanyaOlustur` → `kullanici.Rol !== 'Yonetici'` ise `Yetki` kodlu hata.
Günlük veri servisleri (kuruKuspe/malzemeHareket/gunSil) Hepsi'ye açık —
mevcut yetki modeli DEĞİŞTİRİLMEZ (KURAL 5.1). Tohum ve kabul testleri bu
servisleri zaten yönetici nesnesiyle çağırıyor (40:330, 40:388 doğrulandı).

**Doğrulama.** Node: operatörle `malzemeKaydet` → Yetki hatası; yöneticiyle → geçer.

## M16 — KaynakKayitId tuzağına emniyet kemeri ☑

**Sorun.** Kuru küspe yeniden kaydı eski hareketleri yalnız `KaynakKayitId`
ile siler (`04-servis.js`); D14 önizlemesi de aynı süzgeci kullanır
(`03-dogrulama.js:174`). Manuel hareket geldiğinde Id çakışması alakasız
hareket sildirebilirdi.

**Çözüm.** İki savunma: (1) M18'in Manuel servisi `KaynakKayitId = null`
yazar — null hiçbir kuru küspe Id'siyle çakışamaz; (2) yine de silme
döngüsüne ve D14 süzgecine `HareketTipi === 'Manuel'` istisnası eklenir
(gün silme HARİÇ — `gunSil` günün tamamını siler, Manuel dahil; o doğru).

**Doğrulama.** Node: aynı güne Manuel hareket + kuru küspe yeniden kaydı →
Manuel satır yerinde kalır; Test 3 ("o güne ait hareket 1 adet") kuru küspe
tipleriyle sayıldığından yeşil kalır — test tanımı değişmez.

## M17 — CSV dışa aktarma ☑

**Sorun.** Muhasebe tarafı raporu Excel'e alamıyor; CSV bile yok.

**Çözüm.** `10-kabuk.js`'e ortak `YU.csvIndir(dosyaAdi, satirlar)` yardımcısı
(yeni fonksiyon; mevcut bileşenlere dokunulmaz): Türkçe Excel uyumu için
`;` ayraç, UTF-8 **BOM**, CRLF, `"` kaçışlı. Dört rapor ekranına "CSV İndir"
düğmesi (`#ic-download`, Yazdır'ın yanına):
* **Stok Durumu (23):** malzeme başına devir/üretim/iade/satış/mevcut — ekran verisiyle aynı kaynak (`YU.stok.tumMalzemeler` + gün içi iade toplamı).
* **Program Hareketleri (25):** Malzeme Günlük Değişimi + Silo satırları (tek dosya, iki bölüm başlığı).
* **Değişiklik Geçmişi (30):** süzülmüş listenin ham alanları (tarih-saat, kullanıcı, işlem, tablo, kayıt, alan, eski, yeni).
* **Tüm Hareketler (32):** gün gün silo+malzeme hareketleri, silinenler "Silindi" işaretli.
Dosya adı: `<ekran>-<tarih>.csv`.

**Doğrulama.** Tarayıcıda her düğme dosya üretir; içerik sayısal örneklemle
ekrandaki değerlerle karşılaştırılır (en az Stok Durumu için).

## M18 — Manuel silo hareketi: Sayım Düzeltmesi ☑

**Sorun.** `Manuel` tipi şartname §6'da tanımlı, §11 "sayım/düzeltme kaydı"nı
öngörür; hiçbir ekrandan yazılamıyor — ölü tip. (§11: ana işlev + testler
tamamlandıktan sonra eklenebilir; 12/12 yeşil — önkoşul sağlandı.)

**Çözüm.**
* `04-servis.js` yeni servis `manuelHareketKaydet(depo, girdi, kullanici)`:
  girdi `{tarih, siloId, yon:'giren'|'cikan', miktar, aciklama}`. Kurallar:
  Yönetici şartı (M15 ile aynı gerekçe — sayım düzeltmesi yönetici işi,
  şartname §11 bağlamı), D17 (gelecek yasak), D18 (M14), kampanya kilidi,
  miktar > 0, silo aktif; **D14** ileri bakiye (taslak `yeniHareketler` ile,
  mevcut `ileriBakiye` altyapısı) ve **D15** gün sonu kapasite (Manuel dahil
  gün sonu bakiye). `SiloHareket`'e `HareketTipi:'Manuel'`,
  `KaynakKayitId:null`, `Aciklama` alanıyla yazılır; DegisiklikLog'a düşer.
  "Açıklama/belge no" ihtiyacının bu partideki kapsamı BUDUR: sayım
  hareketine zorunlu açıklama. Günlük giriş formlarına belge no eklemek ayrı
  bir veri-modeli kararıdır; istenirse ayrıca ele alınır (işaretli kapsam sınırı).
* `03-dogrulama.js`: kuru küspe D7/D15 hesabındaki gün başı, o günün Manuel
  netini de içerir (Manuel yeniden kayıtta silinmediği için önceki boşluk
  gerçek olurdu); `manuelHareket(depo, girdi)` doğrulaması eklenir.
* `24-silo-durumu.js`: sayfa eylemlerine Yönetici'ye görünen "Sayım
  Düzeltmesi" düğmesi → modal (silo, tarih, yön, miktar, açıklama; gün sonu
  önizleme). Hareket tablosu Manuel'i zaten çiziyor (`TIP_ADI.Manuel` her
  ekranda tanımlı — 21/24/25/30/32 hazır).

**Doğrulama.** Node: Manuel giren→bakiye artar; ertesi gün D14'ü bozan Manuel
çıkan → reddedilir; kapasite aşan Manuel giren → D15; operatörle → Yetki.
Tarayıcı: modal ile kayıt + Silo Hareketleri panelinde "Manuel" rozeti.

## M19 — Açılışta veri bütünlük kontrolü ☑

**Sorun.** `negatifGunler()` yalnız Silo Durumu'nda; yetim referans / mükerrer
tekil anahtar hiç taranmıyor. Bozulmuş veri sessizce yaşıyor.

**Çözüm.** `04-servis.js`'e `YU.stok.butunlukRaporu(depo)`: (1) silo negatif
günleri (mevcut fonksiyon), (2) yetim `MalzemeId/SiloId/KullaniciId`
referansları, (3) mükerrer `(Tarih, MalzemeId)` / `KuruKuspeGunluk.Tarih` /
tekil ad çakışmaları, (4) kapasite aşan gün sonu. Üst şeritteki mevcut
**Uyarılar paneli** (`YU.uyarilar`, 10-kabuk:465) zaten negatif gün +
kapasite gösteriyor; rapora yalnız (2) ve (3) maddeleri eklenir ve açılışta
(kabuk kurulunca) sorun varsa bir kez `bildir` + Uyarılar rozetine düşer.
Yeni ekran YOK — mevcut panele besleme.

**Doğrulama.** Node: elle bozulmuş depoda (yetim MalzemeId, mükerrer tarih)
rapor doğru sayar; temiz tohumda boş döner.

## M20 — Aylık Özet ekranı ☑

**Sorun.** Şartname §11 "Aylık özet — ay bazında toplam üretim/satış, gün gün
grafik" öngörür; Analizler kampanya-günü bazlı, ay bazlı ekran yok.

**Çözüm.** Yeni dosya `js/34-aylik-ozet.js` (+ index.html'e script, SOZLESME'ye
kayıt): kod `aylik-ozet`, başlık "Aylık Özet", grup RAPORLAR/Takip, rol Hepsi,
ikon `#ic-calendar-dots` (mevcut onaylı setten — YENİ ikon çizilmez).
İçerik: ay seçici (kayıtlı aylardan, varsayılan son ay; `?ay=YYYY-AA`),
üç KPI (toplam üretim+iade / toplam satış / kayıtlı gün), malzeme × (üretim,
iade, satış, net) toplam tablosu + toplam satırı, gün gün Üretim–Satış çift
serili `sutunGrafik` (mevcut bileşen). Veri doğrudan `GunlukHareket`
toplamı — dökme satırı zaten NET üretimdir, çift sayım olmaz (Şartname §4).
CSV İndir düğmesi (M17 yardımcıyla) buraya da konur.

**Doğrulama.** Tarayıcı: Ağustos 2026 toplamları, aynı ayın Stok Durumu
üretim farklarıyla örneklem karşılaştırması; boş ay → boş durum.

## M21 — SOZLESME güncellemesi (ikinci parti) — İPTAL

Kullanıcı direktifi (24.08.2026, ikinci parti sırasında): "Belge açığı şu
anki gibi kalsın, kodda bir şeyi değiştirme." SOZLESME.md birinci partideki
hâliyle bırakıldı; ikinci partinin eklerini belgeleme işi yapılmadı. Bu plan
dosyası ikinci partinin tek kaydıdır.

## M22 — Kuru Küspe: kaydedilmemiş girdi onayı ☑ (üçüncü parti, 24.08.2026)

**Sorun.** 21'de Önceki/Sonraki Gün, Bugün, tarih kutusu ve ekran-terk
düğmeleri yazılmış rakamları sorulmadan siler (22'de onay var, 21'de yok).
**Çözüm.** Form kurulumu bitince `girdiTopla()` imzası (JSON) saklanır;
gezinme öncesi güncel imzayla karşılaştırılır. Farklıysa 22 ile aynı dilde
onay penceresi: "Kaydetmeden çık / Sayfada kal". Kaydet başarısı zaten
`YU.git`→yenile ile baseline'ı tazeler. Kapsam: yalnız 21.
**Doğrulama.** Tarayıcı: alan değiştir → Önceki Gün → onay; "Sayfada kal" →
değerler durur; değişiklik yokken onay ÇIKMAZ.

## M23 — Kampanya kilidi + silo kapasitesi loglanır ☑ (üçüncü parti)

**Sorun.** Kilitle/aç yalnız OlayGunlugu'na düşer; kapasite değişimi hiç iz
bırakmaz — "kim, ne zaman" Değişiklik Geçmişi'nde cevapsız.
**Çözüm.** `LOGLANAN_TABLOLAR`'a `Silolar` + `KampanyaKilitleri`;
`kampanyaKilitle/kampanyaKilidiAc` birer log satırı yazar;
`siloKaydet` yalnız **Kapasite değiştiğinde** alan bazlı log yazar
(Silolar'ın öteki alanları eskisi gibi log dışı). Etiket çözümü
(`logKayitEtiketi`) ve 30'un `TABLO_ADI` haritası iki tabloyu tanır;
tablo süzgeci `YU.log.TABLOLAR`'dan otomatik beslenir. Tohum bu servisleri
çağırmaz → tohum çıktısı değişmez, `SEMA_SURUM` 10 kalır.
**Doğrulama.** Node: kapasite değişimi → log satırı (aynı değer → log yok);
kilitle → Ekle logu; aç → Sil logu. Tarayıcı: satırlar Değişiklik
Geçmişi'nde görünür ve süzülür.

### SONUÇ — ÜÇÜNCÜ PARTİ (24.08.2026)

* **Node: 58/58 GEÇTİ** (önceki 52 + T14'ün 6 kilit/kapasite testi).
* **Kabul testleri: 12/12**, konsol temiz.
* M22 canlı doğrulama: temiz ekranda Önceki Gün onay SORMADI; alan
  kirletilince "Kaydedilmemiş Değişiklik Var — 20.08.2026 günü için girilen
  değerler henüz kaydedilmedi…" penceresi çıktı; "Sayfada kal" değeri
  (99.999) korudu, "Kaydetmeden çık" günü değiştirdi.
* M23 canlı doğrulama: kapasite 3.000.000→2.800.000 değişimi
  `Silolar/Kapasite` satırı olarak; kilitle/aç `Kampanya Kilidi` Ekle/Sil
  satırları olarak Değişiklik Geçmişi listesinde göründü; tablo süzgecinde
  "Kampanya Kilidi" ve "Silolar" seçenekleri otomatik belirdi
  (süzgeç `YU.log.TABLOLAR`'dan beslenir). Test değerleri geri alındı.
* Tohum bu servisleri çağırmadığı için tohum çıktısı değişmedi —
  `SEMA_SURUM` 10 kaldı, T1/T2 determinizm testleri bunu doğruladı.

## Uygulama sırası (ikinci parti)

1. M14+M15+M16 (03+04) → 2. M18 (04+03+24) → 3. M17 (10+23+25+30+32) →
4. M19 (04+10) → 5. M20 (34+index) → 6. ~~M21~~ iptal → Node + tarayıcı
12 kabul testi + ekran kontrolleri.

---

## SONUÇ — İKİNCİ PARTİ (24.08.2026, uygulama tamamlandı)

Durum: M14 ☑✔ · M15 ☑✔ · M16 ☑✔ · M17 ☑✔ · M18 ☑✔ · M19 ☑✔ · M20 ☑✔ ·
M21 iptal (kullanıcı direktifi; M13 de aynı direktifle GERİ alındı — yalnız
malzeme listesinin 8'e çıkarılması, kullanıcının ayrı ve açık isteğiyle
SOZLESME'ye işlendi).

* **Node veri katmanı: 52/52 GEÇTİ** (ilk 32 + D18 çifti, rol denetimi 4'lü,
  Manuel 8'li, içe aktarma 4'lü, bütünlük 2'li).
* **Tarayıcıda 12 kabul testi: 12/12 GEÇTİ** (son kodla, taze sekmede).
* Uçtan uca ekran doğrulamaları: Sayım Düzeltmesi modalı gerçek kayıt yazdı
  (önizleme 388.690 → 389.940; bildirim; hareket listesinde "Elle girilmiş"
  satırı; DegisiklikLog'da iz). Aylık Özet menüde, KPI = tablo toplamı
  (1.706.630 + 100 iade). Stok Durumu CSV'si 6 kolon; her satırda
  devir+üretim+iade−satış = mevcut özdeşliği ölçülerek doğrulandı (İade
  kolonu bu ölçüm sırasında yakalanan tutarsızlık üzerine eklendi).
  Kuru Küspe tarih alanı min=15.09.2025 (D18 ekran ayağı).
* İçe aktarma artık iki aşamalı: kuru deneme (doğrulama + bütünlük + özet) →
  "içeride N gün, pakette M gün" onayı → yazım. v9 paketi 10'a dönüştürülür.
* StokFotograflari: içerik değişmeyen kayıt yeniden yazılmaz (sadeleştirme).
  DegisiklikLog metin kısaltması YAPILMADI: hangi metinlerin kısalacağı
  örnekle netleşmeden dokunulmadı — örnek verilirse uygulanır.
* Not: `py -m http.server` script'leri agresif önbellekliyor; kod
  değişikliklerinden sonra tarayıcıda Ctrl+F5 (tam yenileme) gerekebilir.
  Kullanıcının kendi sunucusu (8137) farklı davranabilir.
* Bu oturum boyunca başka bir Claude oturumu aynı klasörde 25/32 dosyalarını
  yeniden düzenledi; değişiklikler çakışmadı (grep ile doğrulandı) ama iki
  oturumla aynı dosyalarda çalışmak riskli.


---
---

# DÖRDÜNCÜ PARTİ — 25.08.2026 (rapor denetimi · kullanıcı kararları)

> Kaynak: 25.08.2026 rapor denetimi. Bulgular Node'da gerçek çekirdek kod
> koşturularak doğrulandı (01–05 dosyaları, DOM'suz). Kullanıcı bulguların
> her biri için karar verdi; bu bölüm o kararların koda nasıl işleneceğidir.
>
> Hiçbir madde Demirbaş formülü, D1–D16'nın anlamını, kabul testi rakamlarını
> veya §4 üzerine yazma davranışını değiştirmez.
>
> **Kullanıcı kararı — kapsam dışı:** "Verileri Sıfırla" ve "Örnek Veri Yükle"
> düğmeleri prototip olduğu için **kalıyor**. Gerçek uygulamaya geçişte
> kaldırılmak üzere not düşüldü; bu partide dokunulmaz.

---

## M24 — Dökme kuru küspe sezonu yalıtılmıyor ☑

**Kullanıcı kararı.** "Her sezon kendi içinde hesaplanmalı, sezonlar üst üste
toplanmamalı; kuru küspe sadece x kampanyasınınki toplansın, önceki
sezonlarla bağlantısı olmamalı."

**Sorun.** Dökme Kuru Küspe satırının Devir / Toplam Üretim / Toplam Satış
değerleri kampanya sınırı tanımıyor; bütün sezonlar üst üste birikiyor.

**Ölçüm (Node, boş sistem, iki kampanya kuruldu).**

| Kolon | Ekranda görünen | Doğrusu |
|---|---|---|
| Devir | 0 | 600.000 (silo devirlerinin toplamı) |
| Toplam Üretim | 350.000 (iki sezon) | 150.000 (bu sezon) |
| Mevcut | 750.000 ✔ | 750.000 (silo toplamı — Demirbaş, zaten doğru) |

**Kök sebep.** `04-servis.js:315` `malzemeHesapla()` devir penceresini
`enSonDevir(depo,"Malzeme",...)` ile `DevirStok` tablosundan alıyor. Dökme
için bu tabloda satır HİÇ oluşmuyor:

* `27-devir-stok.js:200` — malzeme devri sekmesi dökmeyi listeden çıkarıyor
  (doğru: dökmenin devri silolardadır).
* `04-servis.js:1617` — `yeniKampanyaOlustur()` dökmeyi atlıyor (aynı gerekçe).

Satır olmayınca `bas = null` kalıyor ve `if (bas && h.Tarih < bas) continue;`
filtresi hiç çalışmıyor — bütün kampanyaların GunlukHareket satırları
toplanıyor. Diğer malzemelerde sorun yok.

> Tohum verisi hatayı gizliyor: `05-tohum.js:401` dökmeye özel DevirStok
> satırı yazıyor; gerçek kullanımda o satır oluşamaz. Üstelik tohumdaki satır
> bayat: `05-tohum.js:789` Silo 3 devrini 260.000 → 262.000 düzeltiyor,
> malzeme devri 1.060.000'de kalıyor.

**Çözüm.** `04-servis.js` YU.stok bölümüne saf yardımcı:

    dokmeDeviri(depo, tarih)
      -> her silo icin enSonDevir(depo,"Silo",siloId,tarih)
      -> Miktar      = bulunanlarin toplami
      -> DevirTarihi = bulunanlarin EN GEC tarihi
      -> hic devir yoksa null

`malzemeHesapla()` başında tek dallanma: malzeme DokmeKuruKuspe ise devir bu
yardımcıdan, değilse bugünkü yoldan. Gövdenin kalanı (bas filtresi,
üretim/satış/iade toplamı) aynen kalır. `mevcut` hesabı DEĞİŞMEZ — dökmede
yine silo toplamı (Şartname §5 Demirbaş).

**Neden "en geç tarih".** `yeniKampanyaOlustur` bir kampanyanın bütün silo
devirlerini tek tarihe yazar; farklı olabildiği tek hâl silonun sonradan
eklenmesidir, orada da en geç tarih doğru sınırdır. `23-stok-durumu.js:135`
çift sayım kontrolü aynı kuralı zaten kullanıyor.

**Bilinçli sınır (KURAL 4.4).** Dökmede `devir + üretim − satış = mevcut`
özdeşliği KURULMAZ ve amaç da bu değildir: çuvallama çekişi (Durum B) ve
Manuel hareketler silo tarafında yaşar, GunlukHareket'te yoktur. Amaç yalnız
kolonların SEZONA sınırlanması.

**Kabul testi riski: yok.** Test 6 temiz depoda silo devirsiz koşar →
dokmeDeviri null → bugünkü davranış. Test 4 silo devri yazar ama dökme
malzeme stoğunu okumaz.

**Doğrulama.** Node: iki kampanyalı senaryo → Devir 600.000, Üretim 150.000,
Mevcut 750.000. Kabul testleri 12/12.

---

## M25 — İade denetim izinde ve hareket listelerinde görünmüyor ☑

**Kullanıcı kararı.** "İade denetimi eğer öyleyse düzeltelim." — öyle, ölçüldü.

**Ölçüm (Node).** Basit malzemeye 1.500 kg iade girildi:
GunlukHareket `{Uretim:0, Satis:0, Iade:1500}` (stok +1.500 ✔) ama
DegisiklikLog özeti: "20.08.2026 · üretim 0 kg · satış 0 kg" — iade YOK.

**Kök sebep 1 — log özeti.** `04-servis.js:648` yeni satırın "Ekle" özetine
yalnız üretim ve satışı yazıyor. (Güncelleme yolu doğru: `:626`
`logDegisenler(...,["Uretim","Satis","Iade"],...)`, `ALAN_ADI`'da İade var.)

**Kök sebep 2 — hareket paneli.** `32-tum-hareketler.js`:

* `:101` `malzemeHareketRozeti(uretim, satis)` iadeyi bilmiyor → yalnız
  iadeli satır "Sıfırlandı" rozeti alıyor.
* `:163-176` canlı satırda Giren=Üretim, Çıkan=Satış; iade hiçbir hücreye
  düşmüyor.
* `:196-203` silinen satır dalında aynı boşluk; yalnız iadeli silinmiş satır
  "Satış" etiketi alıyor.

Panel `YU.gunHareketPaneli` ile Program Hareketleri'nde de kullanılıyor
(`25-gunluk-rapor.js:930`) — aynı sayfada üstteki tablo iadeyi gösterirken
alttaki göstermiyor.

**Çözüm.**

1. `04-servis.js:648` — Ekle özetine, yalnız `Iade > 0` iken `· iade X kg`
   eklenir (sıfır iadeli günlerde özet bugünkü gibi kalır).
2. `32` — rozet `malzemeHareketRozeti(uretim, satis, iade)`: olan kalemler
   `+` ile birleştirilir (Üretim / İade / Satış kombinasyonları); hiçbiri
   yoksa yine Sıfırlandı.
3. Giren hücresi iadeyi taşır (iade stoğu artırır): üretim ve iade birlikteyse
   hücre iki satır olur — üstte üretim, altta küçük "İade 1.500" satırı
   (dosyadaki `miktarVeEskisi` iki-satır dili).
4. Güncellenen satırda iadenin eski değeri de üstü çizili okunur
   (`ilkEskiDeger(depo, h.Id, 'İade')`).
5. Silinen satır dalı aynı rozet fonksiyonunu ve Giren kuralını kullanır.

**Kapsam dışı.** `25-gunluk-rapor.js` "Malzeme Günlük Değişimi" tablosu iadeyi
zaten gösteriyor; dokunulmaz.

**Doğrulama.** Node: sıfırdan iade → log özetinde "iade 1.500 kg". Tarayıcı:
Program Hareketleri'nde satır İade rozeti + Giren 1.500 ile görünür.

---

## M26 — Ana Sayfa malzeme tablosunda İade kolonu yok ☑

**Kullanıcı kararı.** "Ana sayfadaki malzeme tablosuna iade kolonu ekleyelim."

**Ölçüm (tohum, bugün).** Dökme Yaş Küspe: 9.500 + 431.940 − 363.420 =
78.020; ekranda Mevcut 78.120 → 100 kg açık (iade). Stok Durumu tutuyor
çünkü İade kolonu var.

**Kök sebep.** `20-anasayfa.js:791` sütun listesinde ve `:777` hücre
listesinde İade yok.

**Çözüm.** "Toplam Üretim" ile "Toplam Satış" arasına `Toplam İade (Kg)`
kolonu; hücre `YU.fmt.kg(s.iade)`. Dil Stok Durumu'ndakiyle aynı
(`23-stok-durumu.js:379`). Altı kolona çıkarken sabit genişlikler bir kademe
kısılır; dar pencerede kap yatay kaydırır. Dökmede iade yasak → 0 görünür.

**Doğrulama.** Tarayıcı: her satırda devir + üretim + iade − satış = mevcut
(dökme hariç — silo toplamı); Dökme Yaş Küspe satırı 100 iade ile tutar.

---

## M27 — Pasif silo raporda düşüyor; servis katmanı uyarmıyor ☑

**Kullanıcı kararı.** "Bakiyesi 0 olmayan siloyu pasifleştirmek uyarı olsun."

**Düzeltme notu.** Önceki raporda "uyarısız pasifleştiriliyor" denmişti —
ekranda onay penceresi VAR ve mevcudu yazıyor (`28-malzeme-yonetimi.js:385`).
Gerçek eksikler:

**A — rapor tutarsızlığı (asıl zarar).** `25-gunluk-rapor.js:387` pasif
silonun o gün hareketi yoksa satırı düşürüyor; dökme gün başı/sonu bu
listenin toplamından geliyor (`:271`). Ölçüm (Node): 240.000 kg'lık silo
pasife alındı → ertesi gün Program Hareketleri dökme gün sonu 0, Stok Durumu
240.000. 240 ton fark, iki ekran arası.

**B — savunma yalnız ekranda.** `04-servis.js:1312` `siloKaydet()` stoklu
siloyu pasife almada sessiz (yalnız kapasite<mevcut uyarısı var, `:1331`).
Şartname §8: "tek savunma hattı ekran olmamalı." Ayrıca
`28-malzeme-yonetimi.js:87` `sonucuBildir()` uyarıları yutuyor.

**Çözüm.**

1. `25-gunluk-rapor.js:387` — atlama şartına bakiye eklenir: pasif silo ancak
   o gün hareketi YOKSA ve gün sonu bakiyesi SIFIRSA düşer; stoklu pasif silo
   "Pasif" rozetiyle listede kalır.
2. `04-servis.js siloKaydet()` — aktiften pasife geçişte güncel mevcut ≠ 0
   ise `uyarilar`'a satır (kayıt engellenmez; D15 dili: uyarı, engel değil).
3. `28 siloDurumDegistir()` — servis uyarısı da bildirilir (modal kaydetme
   yolundaki `:361` kalıbının aynısı).

**Doğrulama.** Node: stoklu silo pasife → `uyarilar` dolu. Tarayıcı: stoklu
pasif silo raporda kalır; dökme gün sonu = Stok Durumu.

---

## M28 — Ciddi işlemler sessiz geçiyor ☑

**Kullanıcı kararı.** "Gerçekten ciddi aktifleştirme, pasifleştirme,
değiştirme, silme, ekleme gibi şeylere uyarı olmalı."

**Tarama.** Onayı OLANLAR: malzeme/silo/kullanıcı pasif-aktif, devir silme,
gün silme, kampanya kilidi, kaydedilmemiş değişiklik, yedek yükleme, veri
sıfırlama. Onayı OLMAYANLAR (tek Kaydet tıkıyla geçenler):

| Nerede | İşlem | Neden ciddi |
|---|---|---|
| `29-kullanici-yonetimi.js:217` | Rol değiştirme | Yetki yükseltme; D10 yalnız SON yöneticiyi korur |
| `28:348` | Silo tanımı (ad, kapasite) | Kapasite D15 eşiği; ad geçmişte geriye dönük değişir |
| `28:238` | Malzeme tanımı (ad, birim) | Ad geçmişte geriye dönük değişir |
| üçü de | Yeni malzeme / silo / kullanıcı ekleme | Yeni malzeme giriş ekranlarına, yeni silo dökme toplamına girer |

**Çözüm — tek dil.** `10-kabuk.js:2454` `YU.ui.onay()`'a isteğe bağlı
`ayrinti` alanı (DOM düğümü; metnin altına eklenir; verilmezse pencere
bugünkü gibi). Dört akışa onay penceresi eklenir; `ayrinti` içinde neyin
neye döndüğü satır satır yazılır (Ad: "Silo 1" → "Silo A").

* Değiştirme: yalnız gerçekten değişen alanlar listelenir; hiçbiri
  değişmediyse pencere açılmaz, doğrudan kaydedilir.
* Ekleme: eklenecek kaydın künyesi (ad, birim / kapasite / rol).
* Rol değişimi: ek cümle — "Yönetici olursa devir stok, malzeme ve kullanıcı
  yönetimine erişir."

**Kapsam sınırı (KURAL 5.1).** Yalnız Malzeme Yönetimi ve Kullanıcı Yönetimi.
Günlük giriş ekranlarına ikinci onay eklenmez (kayıt onayı + kaydedilmemiş
değişiklik koruması zaten var). Sıra okları (yukarı/aşağı taşıma) onaysız
kalır — kozmetik. SOZLESME güncellenmez (M13/M21 kararı).

**Doğrulama.** Tarayıcı: rol değiştir → eski/yeni görünür, vazgeç → kayıt yok;
alan değişmeden Kaydet → pencere açılmaz.

---

## M29 — İşlem Geçmişi: süzgeç yok, log budaması sessiz ☑

**Kullanıcı kararı.** "İşlem Geçmişi paneline tarih aralığı + kullanıcı +
tablo süzgeci; sınıra yaklaşınca ekranda uyarı — önerini beğendim, uygula."

**Sorun.** Panel (`25-gunluk-rapor.js gunIslemGecmisi`) tek gün gösterir;
"geçen ay bu rakamı kim değiştirdi" sorusu ancak günü bilerek cevaplanır.
`04-servis.js:175` DEGISIKLIK_SINIRI=5000: sınırda en eski satır SESSİZCE
düşer.

**Çözüm.**

1. Panele süzgeç şeridi: tarih aralığı (varsayılan: raporun günü → günü;
   KURAL 7'nin "gün bazlı, varsayılan bugün" kuralı korunur, süzgeç yalnız
   GENİŞLETİR), kullanıcı (Tümü + kullanıcılar), tablo (Tümü +
   `YU.log.TABLOLAR`). Süzgeç değişince yalnız panel gövdesi yeniden çizilir
   (34'teki `dokumYenile` kalıbı). Gün çözümü bugünkü `logGunu` kuralının
   aralığa genellenmişidir: `bas <= gün <= bit`.
2. `04-servis.js` — `YU.log.SINIR = DEGISIKLIK_SINIRI` dışa verilir (sihirli
   sayı ekrana yazılmaz).
3. Uyarı iki yerde, aynı eşik: satır sayısı ≥ %90 → panelin üstünde bilgi
   şeridi ("denetim izi sınıra yaklaşıyor — Yedek İndir ile arşivleyin");
   ≥ sınır → şerit kırmızılaşır ("en eski kayıtlar düşmeye başladı") ve
   `YU.uyarilar()` ziline aynı satır eklenir.

**Doğrulama.** Node: 5001 log satırı → en eski düşer, sayı sabit (M10
korunur). Tarayıcı: aralık genişletilince komşu günün işlemi listeye girer;
kullanıcı/tablo süzgeci daraltır; sahte 4.600 satırla şerit görünür.

---

## M30 — Analizler iadeyi bilmiyor ☑

**Kullanıcı kararı.** Öneri kabul: iade göstergesi YA DA "iade hariç" notu.

**Seçim (varsayım, KURAL 4.4).** NOT konur, gösterge eklenmez: malzeme başına
ikinci bir gösterge listeyi şişirir; iade nadir bir alan ve Analizler'in
üretim serisi GunlukHareket.Uretim anlamını korumalı. Kullanıcı gösterge
isterse ayrıca eklenir.

**Sorun.** `33-analiz-veri.js:38` gösterge tanımları Uretim/Satis okur; iade
hiçbir seride yok. Aylık Özet grafiği ise "üretime iade dahil" çizer — iki
ekran arasında sessiz fark.

**Çözüm.** `31-analizler.js` Gösterge panelinin altına tek yardım satırı:
"Üretim göstergeleri iadeyi içermez; iade Stok Durumu ve Aylık Özet'te ayrı
kolondur."

**Doğrulama.** Tarayıcı: not Gösterge panelinde görünür; sayılar değişmez.

---

## M31 — "Bugünün Girişi Yok" kampanya dışında da düşüyor ☑

**Kullanıcı kararı.** "Kampanya aralığı dışındaysa bu uyarıyı hiç üretme —
uygula."

**Sorun.** `10-kabuk.js:475` uyarı yalnız "bugün kayıtlı mı"ya bakar.
Sezonlar arasında (ör. Mayıs–Ağustos) her gün kırmızı uyarı + yanında
"Kampanya Aralığının Dışındasınız" — uyarılar önemsizleşir.

**İnce nokta.** Kampanyanın "biti" son KAYITLI gündür; sezon içinde 2 günlük
giriş boşluğunda da `bugun > bit` olur. Kaba bir "aralık dışıysa sustur"
kuralı, uyarının EN GEREKLİ olduğu sezon-içi boşlukta da susturur.

**Çözüm (eşik varsayımı, KURAL 4.4: 7 gün — kullanıcı değiştirebilir).**
`uykuda = bugun > bit + 7 gün` tanımlanır; iki uyarı birbirini dışlar:

* Bugünün Girişi Yok → yalnız `!uykuda && bugun >= donem.bas` iken üretilir
  (sezon içi ve 7 güne kadar boşlukta kalır; sezon bitince kaybolur).
* Kampanya Aralığının Dışındasınız → yalnız `uykuda || bugun < donem.bas`
  iken üretilir (bugünkü "1 gün boşlukta bile görünme" tuhaflığı da düzelir).

**Doğrulama.** Node/tarayıcı: bit=dün → yalnız "Bugünün Girişi Yok";
bit=10 gün önce → yalnız "Kampanya Aralığının Dışındasınız".

---

## Uygulama sırası ve test kapısı (dördüncü parti)

1. **M24** — çekirdek hesap, en büyük etki
2. **M27** — rapor tutarsızlığı + servis uyarısı
3. **M25** — iade denetim izi
4. **M26** — Ana Sayfa İade kolonu
5. **M28** — ciddi işlem onayları
6. **M29** — İşlem Geçmişi süzgeci + log sınır uyarısı
7. **M30** — Analizler iade notu
8. **M31** — kampanya dışı uyarı susturma

Her maddeden sonra Node çekirdek koşumu; parti sonunda tarayıcıda 12 kabul
testi. 12/12 geçmeden parti kapanmaz.


---
---

# BEŞİNCİ PARTİ — 25.08.2026 (kullanıcı kararları · ikinci denetim turu)

> Kaynak: 25.08.2026 ikinci rapor denetimi. Bulgular Node'da gerçek çekirdek
> kod koşturularak ölçüldü. Kullanıcı dört karar verdi; bu bölüm onların
> koda nasıl işleneceğidir. Demirbaş formüllere, D1–D14/D16 anlamına, kabul
> testi rakamlarına ve §4 üzerine yazma davranışına dokunulmaz.

---

## M32 — D15 sert engel: operatör kilitleniyor, çıkış yolu yok ☑

**Kullanıcı kararı.** *"Engeli koru ama çıkış yolu ver: kapasite aşımını
gerekçeyle kabul et; gerekçe denetim izine düşsün, yöneticiye uyarı gitsin —
ama sert uyarı olsun."*

**Ölçüm (Node).** Kapasiteyi aşan kayıt reddediliyor; kaçış yolu yok:

    25.000 ton tek siloya  -> ok=false, hatalar: D15
    5.000 ton Manuel giris -> ok=false, hatalar: D15

**Kök sebep.** `03-dogrulama.js:28` D15 `tur: "Hata"` olarak tanımlı
(21.08.2026 kullanıcı kararı; şartname §8 bunu **uyarı** sayar ve gerekçesini
de yazar: *"sert engel operatörü kilitler"*). İki yerde `hatalar`'a düşüyor:

* `03-dogrulama.js:403-407` — `kuruKuspeKaydi`, gün sonu bakiyesi kapasiteyi
  aşarsa. Operatörün her gün kullandığı ekran.
* `03-dogrulama.js` — `manuelHareket` (Sayım Düzeltmesi) aynı kontrolü yapar.

Kapasiteyi yalnız yönetici değiştirebilir (`28-malzeme-yonetimi.js` silo
modalı), yani operatörün elinde hiçbir seçenek kalmıyor.

**Çözüm — "gerekçeli kabul" kapısı.**

1. `03-dogrulama.js` — girdi sözleşmesine `kapasiteGerekcesi` eklenir.
   Boş/yoksa D15 bugünkü gibi **hata**. Dolu ise (en az 10 karakter) D15
   `uyarilar`'a düşer, kayıt geçer. Kural metni ve `KURALLAR` tablosu bu iki
   yüzü açıkça yazar.
2. `04-servis.js` — `kuruKuspeKaydet` / `manuelHareketKaydet` gerekçe
   kullanıldığında `DegisiklikLog`'a satır yazar:
   `Tablo: SiloHareket · Alan: "Kapasite Aşımı" · YeniDeger: "<silo> <bakiye>/<kapasite> — <gerekçe>"`.
   Böylece denetim izinde kim, ne zaman, hangi gerekçeyle aştığı okunur.
3. `21-kuru-kuspe-giris.js` — kayıt yalnız D15 yüzünden reddedildiyse
   **sert uyarı penceresi** açılır (`yu-cetin` kırmızı dil, mevcut sınıf):
   hangi silo, oluşan bakiye, kapasite, aşım miktarı; altında **zorunlu**
   gerekçe alanı ve "Kapasite Aşımını Kabul Et ve Kaydet" düğmesi. Gerekçe
   10 karakterden kısaysa düğme çalışmaz. Başka hata da varsa pencere
   açılmaz — önce gerçek hatalar düzeltilir.
4. `24-silo-durumu.js` — Sayım Düzeltmesi modalında aynı kapı.
5. Yönetici bildirimi: `YU.uyarilar()` zilinde kapasite aşımı satırı **zaten
   var** (`10-kabuk.js` "Kapasite Aşıldı"); ek kanal açılmaz, tekrar olur.

**Kapsam dışı (bilinçli).** Devir stok girişindeki D15 ayağı
(`03-dogrulama.js:824`) sert engel kalır: devir yöneticinin işi, yılda bir
girilir ve kapasiteyi de o değiştirebilir — kilitlenme riski yok.

**Doğrulama.** Node: gerekçesiz → D15 hata; gerekçeli → kayıt geçer, `uyarilar`
D15 taşır, `DegisiklikLog`'da "Kapasite Aşımı" satırı. Kabul testleri 12/12
(testler gerekçe göndermez, davranış aynı kalır).

---

## M33 — Kampanya son kayıtta bitiyor; yeni kampanyaya kadar sürmeli ☑

**Kullanıcı kararı.** *"Yeni kampanya oluşturulana kadar eski kampanya devam
etsin."*

**Sorun.** `10-kabuk.js:398-409` bir kampanyanın `bit` değerini o kampanyanın
**son kayıtlı günü** yapıyor. Kampanya, kayıt girilmeyi bıraktığı gün bitmiş
sayılıyor — oysa sezon, yeni kampanya açılana kadar sürer.

**Ölçüm (Node).** Tohum verisinde:

    devir tarihleri            : 2025-09-15, 2026-07-22
    kampanyalarin son kayit gunu: 2025/2026 -> 2026-01-14 · 2026/2027 -> 2026-08-25
    -> 2025/2026 kampanyasi 14.01.2026'da "bitmis" sayiliyor,
       oysa yeni kampanya 22.07.2026'da acildi. Aradaki 6 ay sahipsiz.

**Yan bulgu (aynı kökten).** Geçmiş Girişler'de 2025/2026 seçilince **188
"eksik gün"** listeleniyor — `26-gecmis-girisler.js:61-63` eksik günleri
kampanya başından **BUGÜNE** sayıyor, kampanya sonuna değil. (Ölçüldü.)

**Çözüm — `bit` ile `sonKayit` ayrılır.**

`donemListesi()` her kampanyaya iki ayrı alan verir:

| Alan | Anlam | Değer |
|---|---|---|
| `bas` | kampanya başlangıcı | değişmez (en eski devir tarihi) |
| `bit` | **kampanya dönemi sonu** | bir sonraki kampanyanın başından bir gün önce; sonraki yoksa **bugün** (kampanya sürüyor) |
| `sonKayit` | son kayıtlı gün | bugünkü `bit` değeri (kayıt yoksa `bas`) |
| `kayitliGun` | kayıtlı gün sayısı | değişmez |

**Hangi tüketici hangisini alır** (tarama sonucu, tamamı):

| Yer | Bugün | Sonra | Neden |
|---|---|---|---|
| `10:450` `gorunumSonu()` | `bit` | **`sonKayit`** | rapor varsayılan tarihi VERİ olan güne düşmeli |
| `10:506` uyarı bağlantısı | `bit` | **`sonKayit`** | aynı gerekçe |
| `10:629` `eksikGunler()` | `bit` | **`sonKayit`** | dönem sonuna kadar saymak yüzlerce sahte eksik üretir |
| `33-analiz-veri.js:113` `sonGun` | `bit` | **`sonKayit`** | kampanya gün sırası veriye dayanır |
| `10:865, 1043` kampanya etiketi | `bit` | `bit` | **kullanıcının istediği**: aralık gerçek dönemi göstersin |
| `26:197` kampanya süzgeci | `bit` | `bit` | dönem sınırı doğrusu |
| `26:264` süzgeç etiketi | `bit` | `bit` | aynı |
| `20:952` `kayitliGunler(bas,bit)` | `bit` | `bit` | üst küme; boş günde kayıt yok, sonuç değişmez |

Ayrıca `26-gecmis-girisler.js` `eksikGunler()` üst sınırı `bugün` yerine
`min(bugün, donem.sonKayit)` olur — geçmiş kampanyada 188 sahte eksik düşer.

Sürmekte olan kampanyanın etiketi "22.07.2026 – devam ediyor" yazar
(bitiş bugüne eşitken tarih yerine bu ibare basılır).

**Doğrulama.** Node: 2025/2026 `bit` = 21.07.2026, `sonKayit` = 14.01.2026;
2026/2027 `bit` = bugün. Geçmiş Girişler'de eksik gün sayısı 188 → 0.
Analizler'de kampanya gün sayısı değişmemeli. Kabul testleri 12/12.

---

## M34 — Geçmiş kampanyaya bakarken uyarı yok ☑

**Kullanıcı kararı.** *"Eski kampanyalara bakılırsa yukarıda bir uyarı kısmı
olsun — 'Bu Gün Daha Önce Kaydedilmiş' kutusu gibi ama kırmızı ve hover'lı."*

**Sorun.** Üst şeritteki kampanya çipi geçmiş sezonu gösterirken ekranlardaki
rakamlar sessizce o sezonun rakamları oluyor. Çipe bakmayan kullanıcı bugünün
verisine baktığını sanabilir.

**Çözüm.** `10-kabuk.js`'teki mevcut kalıcı şerit mekanizması kullanılır
(dördüncü partide eklenen `kilitUyariTazele`, `ustSeritleriTazele` olarak
genişletilir; her sayfa çiziminde tazelenir, `dom.icerik`'in en üstünde
durur ve sayfa geçişlerinde kalır).

Seçili kampanya en yeni kampanya değilse şerit çizilir:

* `tur: 'hata'` + **`yu-cetin`** sınıfı — kırmızı, kalın kenar çizgili, iri
  başlıklı sert dil (sınıf `css/tema.css:1419`'da zaten var; ekran görüntüsündeki
  kutu düzeninin kırmızı hâli).
* Başlık: **"Geçmiş Kampanyaya Bakıyorsunuz"**
* Metin: *"2025/2026 · 15.09.2025 – 21.07.2026. Ekrandaki bütün rakamlar bu
  sezona aittir, bugünün değil. Güncel sezona dönmek için üstteki kampanya
  çipinden 2026/2027'yi seçin."*
* Eylem düğmesi: **"Güncel Kampanyaya Dön"** — en yeni kampanyayı seçer.
* **Hover:** şeride `css/tema.css`'e yeni kural — üstüne gelince zemin bir
  ton koyulaşır ve kenar çizgisi kalınlaşır (`.yu-serit.yu-cetin.yu-tiklanir:hover`);
  `title` niteliği de aynı cümleyi taşır. Yalnız bu sınıfı taşıyan şeride
  etki eder, diğer şeritler değişmez.

Dördüncü partideki "kilitsiz geçmiş kampanya" şeridi aynı kapta durmaya
devam eder; ikisi birlikte görünebilir (biri bakış, öbürü kilit hakkında).

**Doğrulama.** Tarayıcı: 2025/2026 seçilince kırmızı şerit her sayfada;
"Güncel Kampanyaya Dön" 2026/2027'ye geçirir ve şerit kalkar; hover'da
zemin koyulaşır.

---

## M35 — Aylık Özet'te dökme satırının Değişim'i açıklanmıyor ☑

**Kullanıcı kararı.** *"Dökme satırına küçük dipnot: 'Değişim çuvallama
çekişini de içerir.' Rakam doğru, eksik olan açıklama."*

**Ölçüm (Node).** Ağustos 2026, Dökme Kuru Küspe: Değişim 50.670 kg,
Üretim − Satış 53.160 kg → **2.490 kg fark**. Diğer yedi malzeme birebir
tutuyor.

**Sebep (gerçek, hata değil).** Dökme stoğu siloların toplamıdır (Şartname
§5 Demirbaş). Çuvallama için silodan çekilen miktar silo tarafında yaşar,
`GunlukHareket`'in dökme satırında yoktur — o satır NET üretimi taşır.
Dolayısıyla dökmede Değişim ≠ Üretim − Satış olması beklenen davranıştır.

**Çözüm.** `34-aylik-ozet.js` — Malzeme Özeti panelinin altına tek satır
dipnot: *"Dökme Kuru Küspe'de Değişim, üretim ve satışın yanında çuvallama
için silodan çekilen miktarı da içerir; stoğu siloların toplamıdır
(Şartname §5)."* Dipnot yalnız o ayın tablosunda dökme satırı varsa çizilir.
Rakamlara dokunulmaz.

**Doğrulama.** Tarayıcı: dipnot Malzeme Özeti panelinin altında; sayılar
değişmemiş.

---

## Uygulama sırası ve test kapısı (beşinci parti)

1. **M33** — kampanya dönemi (`bit`/`sonKayit`); diğer maddeler bunun
   üstüne oturuyor
2. **M32** — D15 gerekçeli kabul kapısı
3. **M34** — geçmiş kampanya kırmızı şeridi
4. **M35** — Aylık Özet dipnotu

Her maddeden sonra Node çekirdek koşumu; parti sonunda tarayıcıda 12 kabul
testi. 12/12 geçmeden parti kapanmaz.

## SONUÇ — BEŞİNCİ PARTİ (25.08.2026, uygulama tamamlandı)

* **M33** — `donemListesi()` artık `bit` (dönem sonu) ile `sonKayit` (son
  kayıtlı gün) ayrımını tutuyor; `suruyor` bayrağı eklendi. Ölçüm:
  2025/2026 → bas 15.09.2025 · **bit 21.07.2026** · sonKayit 14.01.2026;
  2026/2027 → bit bugün, **"devam ediyor"**. Etiketler `bit`'i, veri okuyan
  yerler (`gorunumSonu`, `eksikGunler`, analiz gün sırası, uyarı bağlantısı)
  `sonKayit`'i alıyor. Yan bulgu düzeldi: Geçmiş Girişler'de 2025/2026
  seçilince görünen **188 sahte "eksik gün" → 0**. Analiz gün sayısı 122'de
  kaldı (`bit` kullanılsaydı 310 olacaktı).
* **M32** — D15 gerekçeli kabul kapısı. Doğrulama katmanına
  `kapasiteGerekcesi` girdisi (en az 10 karakter, `YU.dogrula.GEREKCE_ENAZ`);
  gerekçesiz D15 hata, gerekçeli D15 uyarı. Kuru Küspe ve Sayım Düzeltmesi
  yollarının ikisinde de kapı var; devir yolu bilerek sert engel kaldı.
  Kaydet düğmesi TEK engel kapasiteyse açık kalır ("Kapasite aşılıyor —
  basınca gerekçe istenir"), basınca `yu-cetin` kırmızı sert uyarı penceresi
  açılır. Uçtan uca tarayıcı ölçümü: boş gerekçe → "en az 10 karakter, şu an
  0"; "kisa" → "şu an 4"; geçerli gerekçe → kayıt geçti (Silo 1 = 5.379.342
  kg), denetim izinde *"…Aşım: 2.379.342 kg (25.08.2026). Gerekçe: Silo
  fiilen taştı…"*, yönetici zilinde "Silo 1 · Kapasite Aşıldı".
  **Uygulama sırasında yakalanan hata:** gerekçe ilk denemede servise
  ulaşmıyordu — `kaydet()` asenkron "üzerine yazıyorsun" onayını açıp
  döndüğü için değişken gerçek yazmadan önce sıfırlanıyordu. Gerekçe artık
  `kaydetUygula()` içinde tüketilip siliniyor (tek kayıt denemesi için
  geçerli; sonraki kayıtlar sessizce aynı gerekçeyle aşamaz).
* **M34** — Geçmiş kampanyaya bakarken içerik alanının en üstünde
  `yu-serit hata yu-cetin yu-tiklanir` şeridi: "Geçmiş Kampanyaya
  Bakıyorsunuz" + dönem aralığı + "Güncel Kampanyaya Dön" düğmesi + `title`
  ipucu. `css/tema.css`'e hover kuralı eklendi (vurgu çizgisi 4px→6px,
  başlık altı çizili). Tarayıcı: 2025/2026 seçilince şerit çıktı, düğme
  2026/2027'ye geçirdi ve şerit kalktı. Çip etiketi de dönemi gösteriyor:
  "2025/2026 Kampanyası · 15.09.2025 – 21.07.2026".
* **M35** — Aylık Özet Malzeme Özeti panelinin altına dökme dipnotu
  (tarayıcıda görüldü); rakamlara dokunulmadı. Panelde paralel oturumun
  eklediği devir yıldızı dipnotu korundu, yenisi onun yanına eklendi.
* **Tarayıcıda 12 kabul testi: 12/12 GEÇTİ** (tüm değişiklikler yüklüyken,
  taze tohumla).
* Node sözdizimi denetimi: 03, 04, 10, 21, 24, 26, 33, 34 → temiz.
* SEMA_SURUM değişmedi. Test sonrası önizleme deposu sıfırlandı.
* Kapsam dışı bırakılanlar (bu partide dokunulmadı, denetimde bulundu):
  Aylık Özet'in devir ayındaki "Değişim" rakamı, basit malzemede üst sınır
  uyarısı, kampanyalar arası boşluğa kayıt (hayalet ay), Silo Durumu'nda
  CSV/Yazdır eksikliği, Aylık Özet + Tüm Hareketler'in kampanya seçicisini
  tanımaması, kilitli sezonda tanım değişikliğinin geriye dönük etkisi.

## M36 — Program Hareketleri'ne geri bağlantısı ☑ (25.08.2026)

**Kullanıcı isteği.** *"gunluk-rapor'a girince geri butonu olması lazım —
gecmis-girisler'e atacak. Estetik olsun, sol üstte olsun."*

**Sorun.** Program Hareketleri sol menüde yok (24.08.2026 kararı); ekrana
Geçmiş Girişler satırından, Silo Durumu uyarılarından ve giriş ekranlarından
geliniyor. Geri dönmenin görünür tek yolu üst sağdaki eylem düğmeleri
arasına karışmış "Geçmiş Girişler" düğmesiydi.

**Çözüm — kabukta yeni yuva, tek ekranda kullanım.**

* `10-kabuk.js` — `yu-sayfa-bas` içindeki sol sütuna, başlığın ÜSTÜNE
  `dom.geri` yuvası eklendi. `geriYaz(tanim, param)` her sayfa çiziminde
  çalışır; sayfa tanımı `geri` vermezse yuva boş kalır ve `:empty` kuralıyla
  gizlenir — **diğer ekranların düzeni değişmez** (KURAL 5.1).
* Sözleşme: `sayfaTanimla({ geri: {metin, kod, param} })` ya da param alan
  bir fonksiyon.
* `25-gunluk-rapor.js` — `geri: { metin: 'Geçmiş Girişler', kod: 'gecmis-girisler' }`.
  KURAL 7 ile uyumlu: gün ayrıntısının üst listesi gün listesidir.
* `css/tema.css` — `.yu-sayfa-geri` + `.yu-geri-bag`: 13,5px soluk metin,
  solda ok; hover/odakta vurgu rengine döner, hafif zemin ve kenar alır, ok
  2px sola kayar. Ok **mevcut** `#ic-chevron`'un 180° döndürülmüşüdür; ikon
  seti büyütülmedi (KURAL 1). Yuva `yu-baski-yok` — çıktıya girmez.

**Doğrulama (tarayıcı).** Bağlantı başlığın üstünde; metin başlıkla aynı sol
hizada (260px / 260px). Tıklayınca `#/gecmis-girisler`'e gitti ve başlık
"Geçmiş Girişler" oldu. Geçmiş Girişler'de yuva `display:none`. Kabul
testleri **12/12 GEÇTİ**.

**Açık kalan (kullanıcıya soruldu).** Üst sağdaki eylem şeridinde duran
"Geçmiş Girişler" düğmesi artık geri bağlantısıyla aynı işi yapıyor;
kaldırılıp kaldırılmayacağı kullanıcının kararı — sorulmadan dokunulmadı.

### REVİZE — M36 (25.08.2026, kullanıcı geri bildirimi)

* **Mükerrer düğme kaldırıldı.** `25-gunluk-rapor.js` sayfa eylemlerindeki
  "Geçmiş Girişler" düğmesi silindi; artık işi sol üstteki geri bağlantısı
  yapıyor. Şeritte kalanlar: Kuru Küspe Girişi · Malzeme Girişi · CSV İndir ·
  Yazdır.
* **Geri bağlantısı büyütüldü** ("çok küçük gözüküyor, 2-3 kat büyült"):
  yazı 13,5px → **17px/600**, ikon 14px → **22px**, dolgu iki katına çıktı ve
  kenar artık BAŞTAN görünüyor — bağlantı değil düğme gibi okunuyor.
  Ölçüm: kutu 130×26 → **194×46 px** (alan ≈ 2,6 kat). Ok hâlâ başlıkla aynı
  hizada (261 / 260 px).
* **Panel sayaçları kaldırıldı** ("1 satır, 2 hareket falan yazmasın — ekstra
  karmaşa"): Program Hareketleri'nde "N satır" (Malzeme Günlük Değişimi) ve
  "N hareket" (gün paneli) rozetleri gizlendi. Gün paneli iki ekranda ortak
  olduğu için sayaç `sayacGizle` bayrağıyla YALNIZ tek gün görünümünde
  kapatıldı; **Tüm Hareketler ekranında rozet duruyor** — orada sayfa sayfa
  çok gün listeleniyor ve rozet hangi günün ne kadar dolu olduğunu söylüyor
  (KURAL 5.1: istenmeyen ekrana dokunulmadı).

**Doğrulama (tarayıcı).** Program Hareketleri: paneller "Kayıt Bilgisi ·
Malzeme Günlük Değişimi · 25.08.2026 · Salı" — hiçbirinde sayaç yok, üst
şeritte 4 düğme kaldı. Tüm Hareketler: "N hareket" rozeti duruyor. Kabul
testleri **12/12 GEÇTİ**.

### REVİZE 2 — M36 renk (25.08.2026)

**Kullanıcı seçimi.** "Yumuşak Mavi Dolgu" — duruşta açık mavi zemin + mavi
kenar; üstüne gelince dolu maviye döner. Ek istek: *"koyu moddayken yazısını
beyaz yap."*

**Uygulama.**
* Duruş: `background-color: var(--vurgu-zemin)` · `border: 1px solid var(--vurgu)`.
* Açık tema yazı: `var(--vurgu)` · **koyu tema yazı: `#ffffff`**
  (iki koyu seçici de yazıldı: `@media (prefers-color-scheme: dark)
  html:not([data-tema="acik"])` ve `html[data-tema="koyu"]` — dosyanın kalıbı).
* Hover: zemin dolu `var(--vurgu)`, yazı `var(--vurgu-uzeri)`.
* Semantik renkler (olumlu/olumsuz/bekleyen) kullanılmadı — onlar
  gecikmiş/ödendi/bekliyor için ayrıldı (KURAL 1).

**Yol boyunca bulunan ve düzeltilen hata.** Buton tema değiştirince renkleri
ESKİ temada donuyordu; sayfa yenilenmeden düzelmiyordu. Sebep ölçülerek
bulundu: değeri `var()` ile temadan gelen bir özellik `transition` listesine
girince Chrome, custom property değiştiğinde yeni değere geçmiyor ve eski
hesaplanmış rengi tutuyor. Kanıt: aynı anda, kardeş bir `<div>`e
`background: var(--vurgu-zemin)` verildiğinde doğru koyu değeri
(`rgba(90,140,230,.16)`) hesaplanırken buton `rgb(238,242,251)` (açık tema)
gösteriyordu; geçiş listesindeki **her** özellik (color, background,
border-color) donmuştu, listede olmayanlar (font, padding) doğruydu.
**Çözüm:** renk özellikleri `transition` listesinden çıkarıldı. Hover geri
bildirimi anında renk değişimi + okun kayma animasyonuyla veriliyor; okun
`transform`'u temadan beslenmediği için orada geçiş güvenle duruyor.

**Doğrulama (tarayıcı, iki temada da taze sayfa yüklemesiyle).**
Koyu: yazı `rgb(255,255,255)` · zemin `rgba(90,140,230,.16)` · kenar
`oklch(0.66 …)` · sayfa zemini `rgb(14,22,39)`.
Açık: yazı ve kenar `oklch(0.55 …)` · zemin `rgb(238,242,251)` · sayfa zemini
`rgb(253,253,254)`. Kutu 194×46 px. Kabul testleri **12/12 GEÇTİ**.

### REVİZE 3 — M36 etiket (25.08.2026)

Düğme yazısı **"Geçmiş Girişler" → "Geri"** (kullanıcı isteği). Kutu 194×46 →
**102×46 px**; ölçü, dolgu ve renkler değişmedi.

Yan düzeltme: ipucu metni düğmenin YAZISINDAN üretiliyordu, etiket kısalınca
"Geri ekranına dön" gibi anlamsız bir cümle çıkıyordu. Artık HEDEF EKRANIN
sayfa kaydındaki başlığından üretiliyor — yazı "Geri", ipucu **"Geçmiş
Girişler ekranına dön"**. Kayıtsız bir hedefte sade "Geri dön" yazar.

**Doğrulama (tarayıcı).** Yazı "Geri" · ipucu "Geçmiş Girişler ekranına dön" ·
hedef `#/gecmis-girisler`; tıklayınca Geçmiş Girişler açıldı.

### REVİZE 4 — M36 hizalama (25.08.2026)

Düğme sol kenara yapışık duruyordu (kullanıcı geri bildirimi). Sebep:
`margin-left: -15px` — METNİ başlıkla hizalamak için kutuyu sola çekiyordu.
Çerçevesiz sade bağlantıda doğru olan bu ayar, çerçeveli düğmede kutunun
kendisini başlığın soluna taşırıyordu. Negatif kenar boşluğu kaldırıldı.

**Doğrulama (tarayıcı).** Geri düğmesinin sol kenarı **260 px**, sayfa
başlığı **260 px**, paneller **260 px** — üçü aynı hizada (fark 0).

## M37 — Geçmiş Girişler: çift başlık birleştirildi ☑ (25.08.2026)

**Kullanıcı isteği.** *"Geçmiş Girişler yazısını Kayıtlı Günler yerine koy,
geçmiş girişler yazısını kaldır, paneli üste taşı."*

**Sorun.** Ekranda iki başlık üst üste duruyordu: sayfa başlığı "Geçmiş
Girişler" ve hemen altında panel başlığı "Kayıtlı Günler". Aynı şeyi iki kez
söyleyip dikey yer harcıyordu.

**Çözüm.**
* `26-gecmis-girisler.js:631` — panel başlığı **"Kayıtlı Günler" → "Geçmiş
  Girişler"**.
* Sayfa tanımına `baslikGizle: true`. `baslik` alanı DURUYOR: sol menüdeki ad
  ve tarayıcı sekmesi başlığı ondan okunuyor, ikisi de bozulmadı.
* `10-kabuk.js` — `basligiYaz(baslik, alt, sekmeAdi)` üçüncü parametre aldı;
  `baslikGizle` işaretli sayfada başlık ve alt başlık çizilmez, sekme adı
  yine gerçek başlıktan gelir. Başlık, alt başlık, geri bağlantısı ve
  eylemlerin DÖRDÜ de boşsa `.yu-sayfa-bas` şeridi `display:none` olur —
  `.yu-icerik`'in 12px satır boşluğu da düşer, panel yukarı oturur.
* `YU.ui.sayfaEylemleri` şeridi gerektiğinde geri açar: ekranlar bu işlevi
  `ciz()` içinde, yani `basligiYaz`'dan SONRA çağırıyor; başlığı gizli bir
  sayfaya sonradan eylem eklenirse düğmeler gizli kapta kalırdı.

**Doğrulama (tarayıcı).**
* Geçmiş Girişler: `.yu-sayfa-bas` → `display:none`, tek panel başlığı
  "Geçmiş Girişler", sekme başlığı ve menü adı "Geçmiş Girişler" olarak
  duruyor. Panel, üstündeki kampanya şeridinin hemen ardında (12px standart
  boşluk) — arada başlık bandı yok.
* Diğer dokuz ekran taranarak denetlendi (Ana Sayfa, Stok Durumu, Silo
  Durumu, Aylık Özet, Program Hareketleri, Malzeme Girişi, Kuru Küspe, Devir
  Stok, Malzeme Yönetimi): hepsinde başlık `display:block`, şerit `flex` —
  **hiçbiri etkilenmedi** (KURAL 5.1). Eylem düğmeleri olan ekranlarda
  (Silo Durumu 4, Program Hareketleri 4, Aylık Özet 1) düğmeler yerinde.
* Kabul testleri **12/12 GEÇTİ**.

## M38 — Stok Durumu'na "Stok Hareketleri" paneli ☑ (25.08.2026)

**Kullanıcı isteği.** *"Stok Durumu'na da Silo Durumu'ndaki gibi bir stok
hareketleri kısmı ekle, alt kısmına — ama yazdırmada gözükmeyecek."*

**Çözüm.** `23-stok-durumu.js`'e, `24-silo-durumu.js`'teki "Silo Hareketleri"
panelinin malzeme karşılığı eklendi; dil, süzgeç ve sayfalama birebir aynı.

* **Kaynak:** `GunlukHareket` satırları + `DevirStok` satırları (devir, Silo
  Hareketleri'ndeki gibi listede bir satırdır — bakiyenin başlangıcını
  görünür kılar, "Devir" rozetiyle).
* **Kolonlar:** Tarih · Malzeme · Üretim · İade · Satış · Stok · Kaynak.
* **Stok kolonu `YU.stok.malzemeStok`'tan okunur**, satır içi toplamla
  değil: dökme kuru küspede stok siloların TOPLAMIDIR (Şartname §5 Demirbaş)
  ve devir+üretim−satış ile hesaplanamaz. `GunlukHareket` (Tarih, MalzemeId)
  tekil olduğu için gün başına tek satır düşer, o günün gün sonu stoğu o
  satırın doğru bakiyesidir. Okuma malzeme+tarih başına önbelleklenir.
* **Süzgeç:** başlangıç/bitiş takvimi + Önceki Gün / Bugün / Sonraki Gün;
  bugünle açılır (bas = bit = bugün). Gezinme referansı BİTİŞ tarihidir —
  Silo Hareketleri'ndeki davranışın aynısı.
* **Sayfalama GÜN bazlı** (sayfa başına 7 gün): bir günün satırları hiç
  bölünmez.
* **Satır tıklaması** `YU.gunPenceresi(tarih)` — sekmeden ayrılmadan günün
  verisi açılır.
* **Yazdırmaya girmez:** panel `yu-baski-yok` sınıfı taşır
  (`css/tema.css` `@media print` → `display:none !important`). Kâğıttaki stok
  raporu Şartname §7'deki içerikle kalır.

**Doğrulama (tarayıcı).**
* Panel sayfanın EN ALTINDA (Malzeme Bazında Stok · Çift Sayım Kontrolü ·
  **Stok Hareketleri**), sınıfı `yu-panel yu-baski-yok`.
* Bugünle açılıyor: 8 satır (8 malzeme). İlk satır Dökme Yaş Küspe
  `+14.410 / +100 iade / −13.560 / stok 78.120` — Stok kolonu
  `YU.stok.malzemeStok` ile birebir aynı (78.120 = 78.120).
* "Sonraki Gün" bugünde pasif; "Önceki Gün" 24.08'e indi (8 satır).
* Aralık 18.08–24.08 → 56 satır (7 gün × 8 malzeme).
* Tüm kampanya (22.07'den) → 280 satır, 5 sayfa; 5. sayfa 22.07–27.07 ve
  kampanya devri satırları "Devir" rozetiyle görünüyor.
* Satır tıklaması gün penceresini açıyor.
* Kabul testleri **12/12 GEÇTİ**.

### REVİZE — M38 + gün penceresi (25.08.2026)

**1. Stok Hareketleri: satır tıklaması yerine Detay düğmesi.**
Satırın tamamı tıklanabilirken pencere kazara açılabiliyordu. Artık satır
tıklaması YOK; en sağda `{ baslik: '', genislik: 96 }` kolonunda **Detay**
düğmesi var (Silo Hareketleri'ndeki dilin aynısı). Devir satırlarında bu
hücre boş kalır. `tiklamaIpucu` kaldırıldı.

**2. Gün penceresinden iki bölüm kaldırıldı.**
`10-kabuk.js` `YU.gunPenceresi` — "Malzeme hareketleri" ve "Silo hareketleri"
tabloları silindi (kullanıcı isteği). Pencerede yalnız günün **Kuru küspe**
özeti kalır; satır satır döküm zaten Program Hareketleri'nde ve listenin
kendisinde duruyordu, pencerede üçüncü kez tekrar ediyordu. Tam döküm için
penceredeki "Tam raporu aç" düğmesi duruyor. Yalnız o bölümlerde kullanılan
`HAREKET_ADI` / `HAREKET_RENGI` sabitleri de temizlendi.

**Paylaşılan bileşen notu (KURAL 5.1).** Pencere Stok Durumu VE Silo
Durumu'ndan açılıyor; iki bölümün kaldırılması ikisini de etkiler. Kullanıcı
isteği pencerenin kendisine yönelik olduğu için uygulandı ve Silo Durumu'nda
da doğrulandı.

**Doğrulama (tarayıcı).**
* Stok Hareketleri: 8 kolon / 8 hücre, Detay düğmesi var, satır imleci
  `auto`. Satıra tıklama pencere AÇMIYOR; Detay'a tıklama açıyor.
* Pencere içeriği (her iki ekrandan da): yalnız Kuru küspe özeti —
  "Malzeme hareketleri" ve "Silo hareketleri" başlıkları yok.
* Kabul testleri **12/12 GEÇTİ**.

**Not:** Bu düzenleme sırasında `23-stok-durumu.js`'in hareket tablosunda
İade ve Üretim kolonlarının paralel bir oturumda yer değiştirdiği görüldü
(kolon başlıkları ve hücreler birlikte değişmiş, gösterim tutarlı).
Dokunulmadı.

## M39 — Silo Durumu: hareketler + grafik yan yana, grafik 7 günlük pencere ☑ (25.08.2026)

**Kullanıcı istekleri (sırayla).** Grafikle Silo Hareketleri yan yana → sonra:
yükseklikler eşit olsun · grafik en çok 7 gün göstersin, fareyle sürüklenebilsin ·
hareketler solda, grafik sağda.

**Uygulama.**
* `24-silo-durumu.js` — iki panel `yu-izgara yu-iz-yan yu-esit` ızgarasına
  alındı: **hareketler solda (1.55fr), grafik sağda (1fr)**. `alignItems`
  verilmedi; ızgaranın varsayılan `stretch` davranışı + `yu-esit` ile iki panel
  aynı yükseklikte duruyor. Dar ekranda `tema.css` `.yu-iz-yan` medya kuralı
  zaten tek sütuna düşürüyor.
* Silo Hareketleri tablosunda `yapiskan: false` — panel artık yarım genişlikte;
  yapışkan başlık kabı `overflow:visible` yaptığı için tablo panelden taşardı.
  Kapalıyken kap gerektiğinde yatay kaydırıyor.
* `20-anasayfa.js` `grafikPaneli` — **alana kaç gün sığıyorsa o kadar +
  sürükleme** (kullanıcı revizesi: önce 7 gün sabitlenmişti, "pencere boyutuna
  göre değişkenlik göstersin" denildi). Sütunlar DOĞAL genişliğinde çizilir:
  SVG'ye `viewBox`tan okunan piksel genişliği verilir (972 px / 14 gün), grafik
  `overflow-x:auto` bir kaba alınır. Yüzde verilseydi sütunlar esner ve gün
  sayısı sabitlenirdi. `mousedown/mousemove/mouseup` ile
  sürükle-kaydır; imleç `grab`/`grabbing`, sürüklerken metin seçimi kapalı.
  Açılışta sağ uca (en yeni günlere) kaydırılıyor. Panel başlığına
  "· sürükleyerek gezin" notu eklendi.

**Doğrulama (tarayıcı, 1920×1000).**
* Izgara `yu-izgara yu-iz-yan yu-esit`; hareketler sol (260 px, 979 en),
  grafik sağ (1249 px, 632 en); **yükseklikler eşit: 428 = 428**.
* Grafik doğal genişlikte (SVG 972 px / 14 gün ≈ 69 px/gün); görünen gün
  sayısı pencereyle değişiyor — **2400 px → 11,3 gün · 1920 px → 8,6 gün ·
  1440 px → 5,9 gün**. Açılışta sağ uca (en yeni günlere) kaydırılıyor.
  Not satırı yalnız gerçekten taşma varsa yazılıyor.
* Sürükleme iki yönde de sınandı: sağa 140 px → `scrollLeft` 140, geri sola
  → 0; fare bırakılınca hareket duruyor. İmleç `grab`/`grabbing`.
* Ana Sayfa hatasız açılıyor; kabul testleri **12/12 GEÇTİ**.

## M40 — "Kim eklemiş" kolonu + grafik gezinme okları ☑ (25.08.2026)

**Kullanıcı istekleri.** Hareket tablolarında "kim eklemiş" görünsün (hem Stok
hem Silo) · grafiğin iki yanında ok olsun, basılı tutunca kaysın · grafik
ipucu büyüsün · grafiğin altındaki kaydırma çubuğu gitsin.

**Kaydeden kolonu.** Dört kayıt türünde de `OlusturanKullaniciId` +
`OlusturmaTarihi` var; `GunlukHareket` ayrıca `GuncelleyenKullaniciId` +
`GuncellemeTarihi` taşıyor. Hücre **son dokunanı** gösterir (güncellenmişse
güncelleyen, değilse oluşturan) + saat. Satırın günü Tarih kolonunda yazdığı
için normalde yalnız saat yazılır; dokunuş BAŞKA bir günde olduysa (geriye
dönük düzeltme) tarih de eklenir — yoksa "16:05" hangi güne ait belli olmazdı.
* `23-stok-durumu.js` — Kaynak ile Detay arasına `Kaydeden` (200 px). Devir
  satırlarında devri giren kişi yazar.
* `24-silo-durumu.js` — Hareket'ten sonra `Kaydeden` (190 px). **Not:** bu
  panel paralel bir oturumda silo başına GÜNLÜK ÖZET'e dönüştürülmüş; satır
  birden çok hareketi topluyor, tek bir "kaydeden" yok. Bu yüzden son dokunan
  kişi + saat yazılıyor, birden çok kişi dokunduysa yanına "+N kişi" ekleniyor
  ve ipucunda hepsi listeleniyor. TOPLAM satırında hücre boş.

**Grafik okları.** Grafiğin iki yanına ok düğmesi (`#ic-chevron`; sol ok aynı
ikonun 180° dönmüşü — ikon seti büyütülmedi, KURAL 1). Tek tık 60 px kaydırır,
**basılı tutunca** 300 ms sonra 40 ms aralıkla sürekli kaydırır; fare
bırakılınca ya da imleç düğmeden çıkınca durur. Uçlarda ok pasifleşip
soluklaşır. Grafik taşmıyorsa oklar hiç görünmez.
* **Uçlar adımın hemen ardından DOĞRUDAN tazeleniyor**: programatik
  kaydırmada `scroll` olayı gecikmeli geliyor ve okun pasif durumu bir adım
  geride kalıyordu (ölçülerek görüldü). Olay dinleyicisi sürükleme/tekerlek
  için duruyor; `resize` de dinleniyor çünkü pencere boyutu değişince görünen
  gün sayısı ve uçlar değişir.

**İpucu büyütüldü.** Kutu dolgusu 9/11 → 13/16, üst genişlik 360 → 420;
başlık 14 → 16 px, satır etiketi ve sayısı 13,5 → 15 px, renk kutusu 8 → 10 px,
satır arası 6 → 8 px. Etiket rengi `--metin-4` → `--metin-3` (bir tık koyu).

**Kaydırma çubuğu gizlendi.** `css/tema.css` `.yu-grafik-kaydir`
(`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`). Gezinme oklar
ve sürüklemeyle yapıldığı için çubuk grafiğin altında fazladan çizgi
bırakıyordu; kaydırma davranışı aynen duruyor.

**Doğrulama (tarayıcı, 1920×1000).**
* Stok Hareketleri kolonları: Tarih · Malzeme · İade · Üretim · Satış · Stok ·
  Kaynak · **Kaydeden** · (Detay). İlk satır "…78.120 · Elle girildi ·
  **Ahmet Yılmaz · 13:05** · Detay".
* Silo Hareketleri kolonları: … Hareket · **Kaydeden**; ilk satır
  "**Hatice Demir · 15:20**".
* Oklar: başlangıçta sağ uçta → sağ ok pasif; sol tık → x 442→382, iki ok da
  aktif; sağ tık → 442, sağ ok pasif; sol uca kadar → x 0, sol ok pasif.
* Kaydırma çubuğu yüksekliği **0 px** (gizli).
* Grafik tarih aralığı seçili kampanyayı izliyor: 2026/2027 seçiliyken
  "12.08.2026 – 25.08.2026".
* Kabul testleri **12/12 GEÇTİ**.

## M41 — Menü sadeleştirme + "Geçmiş İşlemler" adı ☑ (25.08.2026)

**Kullanıcı istekleri.** "Geçmiş Girişler" → "Geçmiş İşlemler" · Raporlar
başlığına tıklayınca açılan pencereyi **direkt sil** · sol menüdeki kategori
başlıklarını (Veri Girişi / Raporlar / Yönetim Paneli) büyüt.

**1. Rapor merkezi SİLİNDİ.** `10-kabuk.js`'ten `RAPOR_MERKEZI` listesi ve
`raporMerkeziAc()` penceresi (68 satır) tamamen kaldırıldı; "Raporlar" grup
başlığındaki `role="button"`, `tabindex`, `title`, `onClick` ve `onKeyDown`
da düştü — başlık artık düz metin. Üç rapor ekranı zaten başlığın hemen
altında menüde duruyor, pencere fazladan bir adımdı. Yedeğe alınmadı,
kullanıcı "direkt sil" dedi.

**2. Kategori başlıkları büyütüldü.** `css/tema.css` `.yu-menu-grup-bas`:
**12,5 → 15 px**, harf aralığı .06 → .07em, dolgu 12/8 → 16/10. Menü
ögelerinden net ayrışıyorlar.

**3. "Geçmiş Girişler" → "Geçmiş İşlemler".** Yalnız KULLANICIYA GÖRÜNEN
metinler değişti (5 yer): menü adı + sekme başlığı (`26:650 baslik`), panel
başlığı (`26:634`), Kuru Küspe Giriş'teki düğme (`21:451`), Program
Hareketleri'ndeki düğme (`25:969`), zil panelindeki not (`10:629`).
**Sayfa kodu `gecmis-girisler` DEĞİŞMEDİ** — uygulamadaki bütün bağlantılar
ve geri düğmesi ona gidiyor, adres bozulmadı. Dosya adı ve kod yorumları da
olduğu gibi bırakıldı.

**Doğrulama (tarayıcı).**
* Kategori başlıkları: "Veri Girişi" · "Raporlar" · "Yönetim Paneli" — üçü de
  **15 px**, `role=button` yok, imleç `auto` (tıklanmıyor).
* Menüde ve panel başlığında "Geçmiş İşlemler"; tarayıcı sekmesi de öyle.
* Program Hareketleri'ndeki GERİ düğmesinin ipucu otomatik güncellendi:
  **"Geçmiş İşlemler ekranına dön"** (hedef ekranın başlığından üretiliyor).
* Kabul testleri **12/12 GEÇTİ**.

## M42 — "yeni" işareti kaldırıldı ☑ (25.08.2026)

**Kullanıcı isteği.** Aylık Özet'te "100 / yeni" görünüyordu; "yeni olarak
yazma gerek yok · hiçbir yerde yeni yazmasın".

**Neydi.** Ürün grubu tablosunda bir hücrenin altına, önceki dönemde kayıt
YOKSA "yeni" ibaresi yazılıyordu (yüzde değişim hesaplanamadığı için oran
yerine konan işaret). `34-aylik-ozet.js`'te iki yerde üretiliyordu:
`degisimRozeti()` (`:213`) ve ürün grubu hücresi (`:461`).

**Çözüm.** İkisi de kaldırıldı. Artık önceki dönem yoksa: rozet yolunda "—",
hücre yolunda hiçbir işaret yazılmıyor — yalnız rakam kalıyor. **Bilgi
kaybolmadı**: hücrenin ipucu zaten "<önceki ay>: kayıt yok" diyor. Uydurma
oran yazılmaması kuralı da korundu.

**Doğrulama (tarayıcı).** 13 ekran tarandı (Ana Sayfa, Stok/Silo Durumu,
Aylık Özet, Geçmiş İşlemler, Program Hareketleri, Malzeme Girişi, Kuru Küspe,
Devir Stok, Malzeme/Kullanıcı Yönetimi, Analizler, Tüm Hareketler): tek başına
"yeni / Yeni / YENİ" yazan **hiçbir öge kalmadı**. Aylık Özet'te örnek satır
artık "Yaş Küspe · 879.950 ▲+%509,1 · 766.100 ▲+%538,6 · **100** · +113.950
devir ayı". Kabul testleri **12/12 GEÇTİ**.

**Dokunulmayanlar (kullanıcıya soruldu).** "Yeni" ile BAŞLAYAN dört EYLEM
düğmesi duruyor: Malzeme Yönetimi "Yeni Malzeme", Kullanıcı Yönetimi "Yeni
Kullanıcı", Devir Stok "Yeni Kampanya Oluştur" ve "Yeni Kampanya Devri Ekle".
Bunlar işaret değil, "ekle" eylemlerinin adı; kelime çıkarılırsa düğme ne
yaptığını söylemez hâle gelir. Kullanıcı isterse ayrıca değiştirilir.

## M43 — Aylık Özet grafiği kaydırmalı; grafik davranışı ortaklaştırıldı ☑ (25.08.2026)

**Kullanıcı isteği.** Aylık Özet "Gün Gün Üretim ve Satış" grafiği en fazla 25
gün göstersin, en güncel günler hep sağda dursun, eskiler sola kaysın, oklarla
gidilsin — "kısacası Silo Durumu'ndaki grafiğin özellikleri".

**Ortaklaştırma.** Aynı davranışı ikinci kez kopyalamak yerine `10-kabuk.js`'e
**`YU.ui.kaydirmaliGrafik(s)`** eklendi: `sutunGrafik`'i yatay kaydırılan bir
kaba alır, sütunları doğal genişlikte çizer, sürükleme + iki yanda ok +
uç durumu + gizli kaydırma çubuğu + açılışta sağ uca konumlanma işlerini
yapar. `{ govde, notEl }` döner (`notEl` panel başlığına konur, taşma yoksa
temizlenir). Yeni ayar: **`enFazlaGun`** — görünür pencerenin üst sınırı.

`20-anasayfa.js` bu bileşene geçirildi: oradaki 131 satırlık kopya ve yerel
`okDugmesi` yardımcısı (20 satır) silindi. Silo Durumu grafiği davranış olarak
aynen duruyor, artık kodu ortak.

**Aylık Özet.** `34-aylik-ozet.js` grafiği `kaydirmaliGrafik`'e alındı,
`enFazlaGun: 25`. Ayın **tüm günleri veride durur, hiçbiri atılmaz** — 25
yalnız aynı anda görünen pencerenin sınırıdır; kalanına oklar ve sürüklemeyle
gidilir.

**Doğrulama (tarayıcı, 1920×1000).**
* **Ağustos 2026 (25 gün):** sınır devreye girmiyor (25 > 25 değil), grafik
  1753 px, kap 1587 px, açılışta sağ uçta (scrollLeft 166 = maxScroll), sağ ok
  pasif, sol ok aktif, kaydırma çubuğu 0 px.
* **Ekim 2025 (31 gün):** SVG 2179 px, kap `max-width: 1757px` = tam **25 gün**
  (2179 ÷ 31 × 25) — daha geniş ekranda bile 26. gün ekrana gelmiyor. Açılış
  sağ uçta (592 = maxScroll).
* **Oklar:** 592 → sol tık 532 (sağ ok aktifleşti) → sola basılı 0 (sol ok
  pasif) → sağ tık 60 (sol ok yeniden aktif).
* **Silo Durumu grafiği refactor sonrası sağlam:** 2 ok, açılış sağ uçta
  (374 = maxScroll), sağ ok pasif, çubuk 0 px.
* Ana Sayfa hatasız. Kabul testleri **12/12 GEÇTİ**.

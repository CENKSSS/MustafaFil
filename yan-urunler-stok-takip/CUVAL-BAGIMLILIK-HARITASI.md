# Çuvallanan Alanının Bağımlılık Haritası

**Amaç:** "Çuvallanan"ı adet yerine kg olarak almak istendi (kullanıcı isteği,
26.08.2026). Bu döküman, dokunulacak her yeri **okunarak** çıkarılmıştır —
tahmin yoktur, her satır dosya:satır olarak verilmiştir.

**Sonuç, en başta:** Saklanan veriyi adetten kg'ye çevirmek **şartnameye
aykırıdır** (§4 hesap formülü, D2, §9 kabul testleri, §6 tablo tanımı — hepsi
Demirbaş). Ayrıntı §5'te. Şartnameye uygun bir eşdeğer §6'da öneriliyor.

---

## 1. Bugünkü model

Operatör **adet** girer. Sistem kg'yi hesaplar. Tabloda **ikisi de** durur.

```
girdi:   UretilenDokme (kg) · CuvalAdet (adet) · SatilanDokme (kg)
hesap:   CuvalKg = CuvalAdet × 50
         NetDokmeUretim   = max(0, UretilenDokme − CuvalKg)
         SilodanCekilecek = max(0, CuvalKg − UretilenDokme)
saklama: KuruKuspeGunluk( UretilenDokme, CuvalAdet, CuvalKg, SatilanDokme )
```

`CuvalKg` zaten kolon olarak yazılıyor — kg değeri veritabanında hâlihazırda var.

---

## 2. Kod bağımlılıkları

### 2.1 Hesap çekirdeği — `js/02-hesap.js`

| Satır | Ne |
|---|---|
| 32 | `CUVAL_KG: 50` — tek sabit kaynağı |
| 43 | `hesap.kuruKuspe(uretilenDokme, **cuvalAdet**, satilanDokme)` imzası |
| 45 | `var adet = sayiya(cuvalAdet)` |
| 48 | `cuvalKg = YU.yuvarla(adet * hesap.CUVAL_KG)` |
| 49–50 | `netDokmeUretim` / `silodanCekilecek` bu kg'den doğar |
| 59 | `durum: uretim >= cuvalKg ? "A" : "B"` |

Bu dosya **saf fonksiyondur**; §4'ün formülünü birebir taşır.

### 2.2 Doğrulama — `js/03-dogrulama.js`

| Satır | Ne |
|---|---|
| 293 | `var cuvalAdet = oku(girdi.cuvalAdet)` |
| 312–313 | **D2** — "Çuval adedi sayı olmalı" |
| 314–315 | **D2** — "çuval adedi negatif olamaz" |
| 316–317 | **D2** — "Çuval adedi **tam sayı** olmalı" |
| 330 | `YU.hesap.kuruKuspe(uretilen, cuvalAdet, satilan)` |
| 350 | D3/D4 hata metni — "Çuvallanan (…kg), üretilen dökmeden…" |
| 364 | D5/D6 hata metni — "…çuvallanan …kg… ama silolardan …çekiş girilmiş" |
| 605 | Malzeme Girişi kilidi metni — "… `CUVAL_KG` kg" |

### 2.3 Yazma servisi — `js/04-servis.js`

| Satır | Ne |
|---|---|
| 26 | Alan adı sözlüğü: `CuvalAdet: "Çuval Adedi"`, `CuvalKg: "Çuval Kg"` |
| 492 | Gün özeti okuması — `say(kk.CuvalAdet)` |
| 808–810 | `girdi.cuvalAdet` → `YU.hesap.kuruKuspe(...)` |
| 877–885 | `KuruKuspeGunluk` upsert — `mevcut.CuvalAdet`, `mevcut.CuvalKg` |
| 892–893 | **Değişiklik logu alanları:** `["UretilenDokme", "CuvalAdet", "CuvalKg", "SatilanDokme"]` |
| 897–901 | Yeni kayıt — `CuvalAdet`, `CuvalKg` |
| 914 | Log metni — "… `X` çuval …" |
| 934 | **`GunlukHareket` upsert:** çuvallı kuru küspe üretimi = `hesap.cuvalKg` |
| 991 | Silme logu metni — "… `X` çuval …" |

`934` kritik: çuvallı malzemenin stok üretimi buradan yazılır. Bir hata burada
çift sayıma yol açar (§4 "çift sayım yasağı", Demirbaş).

### 2.4 Ekranlar

| Dosya:satır | Ne |
|---|---|
| `21-kuru-kuspe-giris.js:494` | Alanın açılış değeri — `Number(kayit.CuvalAdet)` |
| `21-…:849` | `girdiTopla()` → `cuvalAdet: cuvalAlan.deger()` |
| `21-…:1006` | Boş form denetimi |
| `21-…:1062–1073` | Canlı satır — "200 çuval = 10.000 kg" ve Durum B uyarısı |
| `21-…:1187–1190` | Kayıt onayı özeti — "+200 çuval (10.000 kg)" |
| `21-…:1208, 1269–1270` | Üzerine yazma karşılaştırma blokları |
| `21-…:1327, 1336` | Kayıt sonrası özet — "Çuvallı kuru küspe üretimi … (X çuval)" |
| `34-aylik-ozet.js:130` | Toplam gözü — `cuvalAdet: 0, cuvalKg: 0` |
| `34-…:137, 139–140` | Aylık toplama — `t.cuvalAdet += …`, `t.cuvalKg += h.cuvalKg` |
| `34-…:558` | Kolon ipucu metni |
| `30-degisiklik-gecmisi.js:238` | Alan etiketleri — `['CuvalAdet','Çuvallanan adet','adet']`, `['CuvalKg','Çuval karşılığı','kg']` |
| `23-stok-durumu.js:41` | `OzelTip === 'CuvalKuruKuspe'` → birim `CUVAL_KG` |
| `22-malzeme-girisi.js:725` | Çuvallı kuru küspe üretim kolonu **kilitli** (otomatik) |
| `25-gunluk-rapor.js:66` | "Üretim otomatik · satış elle" etiketi |
| `20-anasayfa.js:580` | Kısayol açıklaması — "Üretilen dökme, çuval adedi, …" |

### 2.5 Örnek veri — `js/05-tohum.js`

| Satır | Ne |
|---|---|
| 428–429 | `cuvalAdet = rnd.tamsayi(20, 60)` · `cuvalKg = cuvalAdet * CUVAL_KG` |
| 432 | Çuvallı satış üretiminin %10–55'i |
| 435 | `YU.hesap.kuruKuspe(uretilen, cuvalAdet, 0)` |
| 509 | Kayda `cuvalAdet` yazılır |
| 548–550 | Çuvallı satış **50'nin katına** yuvarlanır |
| 846–847, 864 | "Değiştirilmiş gün" senaryosu — `CuvalAdet + 2` |

### 2.6 Kabul testleri — `js/40-kabul-testleri.js`

| Satır | Ne |
|---|---|
| 149 | `cuvalAdet: o.cuval || 0` |
| 174 | **Test 1** — 250.000 kg dökme + **200 çuval** |
| 182 | **Test 2** — 5.000 kg dökme + **200 çuval** |
| 271, 277 | Beklenen: `CuvalKg = 10.000 kg` |
| 309, 328, 345, 406 | Test 3, 4, 6, 9 — hepsi adet üzerinden |

---

## 3. Şartname bağımlılıkları

Kaynak: `sartname-duz.txt` (`docs/yan-urunler-sartname-v2.html` düz metni).

| Satır | Madde | Demirbaş mı |
|---|---|---|
| 103 | "Çuvallanan **adet** — kaç çuval doldurulduğu. 1 çuval = 50 Kg sabittir." | §4 girdi tanımı |
| 106 | `CuvalKg = CuvalAdet × 50` | **EVET** — hesap formülü |
| 107–108 | `NetDokmeUretim` / `SilodanCekilecek` | **EVET** — hesap formülü |
| 113 | "Çuvallanan (200 çuval): 10.000 Kg" — Durum A ve B örnekleri | **EVET** |
| 164 | `KuruKuspeGunluk` = "üretilen dökme, **çuval adedi**, çuval kg, satılan dökme" | **EVET** — sekiz tablo |
| 201 | §7 ekran: "Tarih + üretilen dökme + **çuval adedi** + satılan dökme" | Hayır (ekran tablosu) |
| D2 | "Çuval adedi negatif olamaz" | **EVET** — D1–D16 |
| 247, 255 | §9 Test 1 ve 2 — "çuvallanan **200 adet**" | **EVET** — kabul testleri ve rakamları |
| 334–335 | `(uretilenDokme, **cuvalAdet**, satilanDokme) → (cuvalKg, …)` | §10 kod düzeni |

---

## 4. Dokunma sayısı

| Katman | Dosya | Satır |
|---|---|---|
| Hesap | 1 | 6 |
| Doğrulama | 1 | 9 |
| Servis | 1 | 12 |
| Ekran | 8 | 20 |
| Örnek veri | 1 | 8 |
| Kabul testi | 1 | 9 |
| **Toplam** | **13 dosya** | **~64 satır** |

Buna veritabanı kolonu, değişiklik logu geçmişi ve mevcut kayıtların göçü
dâhil değildir.

---

## 5. Neden doğrudan çevrilemez

CLAUDE.md **KURAL 6**, şartnamenin Demirbaş maddelerinin hiçbir istekle
esnetilemeyeceğini söyler ve Demirbaş sayılanları sayar: *hesap formülleri,
D1–D16, kabul testleri ve beklenen rakamları, çift sayım yasağı, sekiz tablo.*

`CuvalAdet`'i kg'ye çevirmek bunların **dördüne** birden dokunur:

1. `CuvalKg = CuvalAdet × 50` formülü anlamsızlaşır (kg'yi 50 ile çarpamayız).
2. **D2** "çuval adedi negatif olamaz / tam sayı olmalı" dayanağını yitirir.
3. §9 Test 1–2 "çuvallanan 200 adet → 10.000 kg" beklentisi tutmaz.
4. `KuruKuspeGunluk` tablosunun tanımlı kolonu değişir.

Bu yüzden **saklanan veri adet olarak kalmalıdır.**

---

## 6. Şartnameye uygun eşdeğer

İstenen şey aslında **operatörün ne yazdığıdır**, veritabanının ne tuttuğu
değil. İkisi ayrılabilir:

```
EKRAN   :  operatör kg yazar        →  "Çuvallanan   10.000 kg"
DÖNÜŞÜM :  CuvalAdet = kg / 50      →  200
SAKLAMA :  CuvalAdet = 200 (değişmez)  ·  CuvalKg = 10.000 (değişmez)
```

Böylece §4 formülü, D2, §9 testleri ve tablo tanımı **olduğu gibi kalır**;
yalnız §7'deki ekran girdisi değişir — o madde Demirbaş değildir.

### Çözülmesi gereken tek nokta

50'nin katı olmayan kg. Örnek: 2.325 kg = 46,5 çuval. Yarım çuval veri
modelinde yoktur (D2 tam sayı ister). Üç seçenek:

| Seçenek | Davranış | Yan etki |
|---|---|---|
| **A** | 50'nin katı olmayan değer reddedilir, uyarı verilir | Operatör düzeltir; veri kesin |
| **B** | En yakın çuvala yuvarlanır, ekranda "2.325 → 2.300 kg (46 çuval)" yazar | Girilen ile kaydedilen farklı olur |
| **C** | Alan çift gösterim olur: kg yazılır, altında "= 46 çuval" canlı görünür; kayıt adetten gider | Bugünkü davranışın tersi; en az sürpriz |

Karar kullanıcınındır. Karar verilmeden kod yazılmaz (KURAL 4.2).

---

*Bu döküman 26.08.2026'da, sayılan dosyalar okunarak üretildi. Şartname alıntıları
`sartname-duz.txt` satır numaralarıyla verilmiştir.*

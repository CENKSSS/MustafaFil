# Yavru Satır (Nested / Child Row) — Teknik Döküman

> Kaynak: kullanıcı çizimi (26.08.2026) + sektör araştırması.
> Bu döküman önce **tekniği** tanımlar, sonra **bu projeye nasıl uygulanacağını**
> yazar. Uygulama bu dökümana göre yapılır; döküman değişmeden kod değişmez.

---

## 1. Ne yapmaya çalışıyoruz

Bir tablo satırının, bir üstündeki satıra **bağlı** olduğunu göstermek.

Somut olay: *Malzeme Bazında Stok* tablosunda **Dökme Kuru Küspe** satırının
altında **Dökmeden Çuvallıya Çevrilen** satırı var. İkincisi bağımsız bir
malzeme değil; birincinin üretiminden düşülen bir kalem. Ekranda da öyle
durmalı — sıradan bir satır gibi değil.

---

## 2. Bu işlemin adı

| Alan | Terim |
|---|---|
| Arayüz | **nested row**, **child row**, **indented sub-row** |
| Açılır-kapanır hâli | **tree table**, **treegrid**, **master–detail row** |
| Muhasebe | **contra line**, **deduction line** — TR: mahsup / düzeltme satırı |

Bizimki **açılır-kapanır değil**: hep görünür, ebeveyniyle birlikte gelir.
Yani *static nested row*.

---

## 3. Sektör ne yapıyor (araştırma özeti)

| Kaynak | Yöntem |
|---|---|
| **AWS Cloudscape** | Yavru satır **yalnız girintiyle** işaretlenir. Çizgi yok. |
| **Handsontable** | Yavru satır başlığı **daha çok girintili**; ebeveynde +/− düğmesi. |
| **AG Grid (master/detail)** | Detay satırı **kendi zemini + büyük sol dolgu** ile ayrılır: `.ag-details-row { background: …; padding: 5px 5px 5px 40px; }` |
| **ishadeed — treeview indent** | Girinti ya *spacer sütunu* ile ya da ilk hücreye *padding* ile verilir. Satırın tamamını kaydırmak önerilmez. |
| **iamkate — CSS tree views** | Bağ çizgileri `border-left` + `::before` ile çizilir (dosya ağacı görünümü). |

**Çıkarım:** en yaygın ve en sağlam yöntem AG Grid'inki — *girinti + kendi
zemini*. Bağ çizgisi (elbow/diagonal) dosya ağaçlarına özgüdür, veri
tablolarında standart değildir ve kullanıcı da kaldırılmasını istedi.

---

## 4. Neden satırı "gerçekten" kaydıramıyoruz

`<tr>` tablo ızgarasının bir parçasıdır. Ona `margin-left` veya `transform`
uygulanırsa **kolon hizası bozulur** — sayılar üstteki başlıkların altından
kayar. Bu yüzden:

* satır yerinde kalır,
* girinti **görsel katman** olarak çizilir,
* hücre içeriği o katmanın üstünde durur.

---

## 5. Hedef görünüm (spec)

Yavru satırın kutusu **dikdörtgen değildir**: sol kenarı, babanın sol
hizasından başlayıp aşağı inerken içeri kayar — bir **yamuk** (trapezoid).
Böylece kutu "babadan ayrılıp içeri giren" bir parça gibi okunur; ayrı bir
bağ çizgisine gerek kalmaz (kullanıcı kararı, 26.08.2026).

```
├──────────────────────────────────────────────────────────────────┤
│ Dökme Kuru Küspe  [Silolar Toplamı]  1.062.000 kg … 1.130.520 kg │  ← BABA satır, tam genişlik
│                                                                  │     ALT ÇİZGİSİ YOK
│╲                                                                 │
│ ╲  Dökmeden Çuvallıya Çevrilen [Üretimden Düşülür]  …  2.490 kg  │  ← YAVRU: sol kenar EĞİK
│  ╲_______________________________________________________________│     üst 0px → alt 32px
├──────────────────────────────────────────────────────────────────┤
│ Kuru Küspe (50 Kg) [Çuvallı]  6.000 kg … 22.200 kg               │  ← tam genişlik
```

### Yamuğun köşeleri

| Köşe | Konum |
|---|---|
| Sol üst | `0` — babanın sol hizası |
| Sağ üst | `100%` |
| Sağ alt | `100%` |
| Sol alt | `32px` — içeri kaymış |

Sol kenar bu iki nokta arasında **eğik** iner. Sağ kenar yoktur; kutu
tabloyla birlikte biter.

### Ölçüler

| Değer | Ne |
|---|---|
| `32px` | Yamuğun ALT köşesinin girintisi (üst köşe 0) |
| `--yuzey-2` | Kutunun dolgusu |
| `1px --kenar-3` | Dış hat — eğik sol kenar dâhil |
| `44px` | Yavru metninin sol başlangıcı (satır ortasında kenar ~16px'te, metin rahatça içeride kalır) |
| `42px` | Satır yüksekliği — sıradan satırla aynı |
| baba `border-bottom: 0` | İkisi tek blok okunsun |

### Yazı

| Öğe | Ölçü |
|---|---|
| Yavru adı | `400 13.5px`, renk `--metin-2` (ana satır 14.5px / `--metin`) |
| Rozet | `400 12px`, **çerçeveli** (dolgusuz), renk `--metin-3` |

## 6. Bu projede uygulama

### 6.1 — Satıra sınıf verebilmek

`YU.ui.tablo` satır nesnesi `sinif` alanını kabul eder:

```js
satirlar.push({ sinif: 'yu-satir-yavru', hucreler: [...] });
```

### 6.2 — İki sınıf

| Sınıf | Kime |
|---|---|
| `yu-satir-yavrulu` | **Ebeveyn** satıra — altında yavru varsa |
| `yu-satir-yavru` | **Yavru** satıra |

### 6.3 — CSS

Yamuk `clip-path: polygon(...)` ile kesilir. Dış hat ve dolgu **iki ayrı
katmandır**: `::before` dış hattı (kenar rengiyle dolu yamuk), `::after` onun
1px içinden dolguyu boyar. `::after` sonra boyandığı için dolgu dış hattın
üstünde kalır ve geriye 1px'lik bir çerçeve görünür.

```css
/* Baba: alt çizgi kalkar, ikisi tek blok olur */
.yu-tablo tbody tr.yu-satir-yavrulu td { border-bottom: 0; }

.yu-tablo tbody tr.yu-satir-yavru { position: relative; }
.yu-tablo tbody tr.yu-satir-yavru td {
  border-top: 0; border-bottom: 0; background: none;
  position: relative; z-index: 1;
}

/* 1. katman — DIŞ HAT: sol kenarı eğik yamuk */
.yu-tablo tbody tr.yu-satir-yavru::before {
  content: ''; position: absolute; inset: 0;
  background: var(--kenar-3);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 32px 100%);
  z-index: 0; pointer-events: none;
}

/* 2. katman — DOLGU: 1px içeriden aynı yamuk */
.yu-tablo tbody tr.yu-satir-yavru::after {
  content: ''; position: absolute; top: 1px; bottom: 1px; left: 0; right: 0;
  background: var(--yuzey-2);
  clip-path: polygon(2px 0, 100% 0, 100% 100%, 34px 100%);
  z-index: 0; pointer-events: none;
}
```

Neden `clip-path`: eğik bir kenarı `border` ile çizmek mümkün değil.
`transform: skew` satırın içeriğini de eğerdi. `clip-path` yalnız katmanın
biçimini keser, hücrelere dokunmaz — kolon hizası bozulmaz (§4).

Sağ kenar yoktur: dolgu katmanı `right: 0`'a kadar gittiği için dış hattın
sağ ucunu örter.

### 6.4 — Baskı

Kâğıtta zemin basılmayabilir; ayrımı **kenar çizgisi** taşır. Baskı bloğunda
yavru kutusunun kenarı gri tonuna sertleştirilir, zemini beyaz kalır.

---

## 7. Bilerek yapılmayanlar

| Yapılmadı | Neden |
|---|---|
| Ayrı bağ çizgisi | Gerek yok: eğim artık kutunun KENDİ sol kenarı (§5) |
| Açılır-kapanır ok | Satır her zaman görünür, gizlenecek bir şey yok |
| Satırın tamamını kaydırma | Kolon hizasını bozar (§4) |
| Girintiyi boşluk karakteriyle verme | Ölçü tutmaz, baskıda kayar |

---

## 8. Kaynaklar

* AWS Cloudscape — Table with nested resources
* Handsontable — Row parent-child
* AG Grid — Theming: Master / Detail Styling
* ishadeed — Handling the Indentation of a Treeview Component
* iamkate — Tree views in CSS

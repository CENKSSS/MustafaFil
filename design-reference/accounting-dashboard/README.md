# Muhasebe Dashboard — Onaylı Birincil UI Referansı

> **Durum:** ONAYLI · Bu klasör, muhasebe uygulamasının **görsel doğruluk kaynağıdır**.
> **Değiştirme:** Bu klasördeki tasarım dosyaları, açıkça "tasarım referansını güncelle"
> talimatı verilmedikçe **değiştirilmez, sadeleştirilmez, yeniden yazılmaz**.

---

## 1. Bu nedir?

Claude Design üzerinde hazırlanmış, Türkçe muhasebe/finans paneli tasarımının
**birebir içe aktarılmış hali**. Uygulamanın dashboard ve ona bağlı ekranları
bu tasarıma göre kodlanacaktır.

Burada **uygulama kodu yoktur** — yalnızca onaylanmış tasarım kaynağı bulunur.

---

## 2. Kaynak

| Alan | Değer |
|---|---|
| Claude Design projesi | `UI mockups for invoicing dashboard` |
| Proje ID | `b20d2a3f-6299-4c1e-86dc-e8c52abbf622` |
| Proje URL | https://claude.ai/design/p/b20d2a3f-6299-4c1e-86dc-e8c52abbf622 |
| Seçilen dosya | `Muhasebe Dashboard.dc.html` |
| İçe aktarma tarihi | 19 Ağustos 2026 |
| İçe aktarma yöntemi | `DesignSync` MCP → `get_file` (API yanıtı baytı baytına diske yazıldı) |

İçerik yeniden yazılmadı; Claude Design API'sinin döndürdüğü ham dosya içeriği
doğrudan diske aktarıldı.

---

## 3. Dosya envanteri

| Dosya | Boyut | Satır | Rol |
|---|---|---|---|
| `Muhasebe Dashboard.dc.html` | 124.649 bayt | 838 | Tasarım kaynağı — tüm artboard'lar, stiller, ikonlar, şablonlar |
| `support.js` | 69.150 bayt | 1.912 | Claude Design çalışma zamanı (`dc-runtime`). `.dc.html` içindeki `<x-dc>` şablonlarını ve `{{ ... }}` bağlarını çözer. **Zorunlu.** |

### Bütünlük kontrolü (SHA-256)

```
4af9e255e53ef2f9bb00299ca8c78b75b94d517ce3dc64005108fb3185bdd36f  Muhasebe Dashboard.dc.html
8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe  support.js
```

Bu değerler değişmişse referans dosyaları elle düzenlenmiş demektir.

### Bilinçli olarak alınmayan dosya

* `.thumbnail` — claude.ai proje listesindeki önizleme görseli. UI varlığı değildir,
  tasarımın render edilmesi için gerekmez.

### Bağımlılıklar

* **Yerel:** yalnızca `./support.js` (aynı klasörde, göreli yol korunmuştur).
* **Harici:** Google Fonts — `Spectral` (400/500/600). Yalnızca `1c` konseptinin
  serif başlıkları için kullanılır.
* Başka CDN, resim, `fetch` veya `url()` bağımlılığı **yoktur**. İkonların tamamı
  dosya içinde inline SVG `<defs>` olarak tanımlıdır (20 ikon: `#ic-home`,
  `#ic-doc`, `#ic-wallet`, `#ic-users`, `#ic-chart`, `#ic-percent`, `#ic-calendar`,
  `#ic-bell`, `#ic-search`, `#ic-filter`, `#ic-download`, `#ic-plus`, `#ic-pencil`,
  `#ic-trash`, `#ic-building`, `#ic-chevron`, `#ic-up`, …).

---

## 4. Artboard envanteri

Dosya iki "tur" ve toplam **5 artboard** içerir. Açık ve koyu tema çoğu konsept
için yan yana verilmiştir (toplam 9 önizleme kartı).

### Tur 1 — “Muhasebe paneli — üç konsept, açık ve koyu tema”

| ID | Konsept | Temalar |
|---|---|---|
| `1a` | **Sade & kurumsal** — geniş boşluk, mavi vurgu | Açık + Koyu |
| `1b` | **Analitik** — ikon rayı, yoğun veri, koyu-öncelikli | Koyu + Açık |
| `1c` | **Premium** — kağıt tonu, serif başlıklar, kehribar vurgu | Açık + Koyu |

### Tur 2 — “`1a` temelli tıklanabilir prototip · Raporlar ekranı · boş durumlar”

| ID | İçerik |
|---|---|
| `2a` | **Tıklanabilir prototip** — sol menüden *Genel Bakış* ↔ *Raporlar* geçişi çalışır |
| `2b` | **Boş durumlar** — çöp kutusu, ilk kullanım (onboarding), boş fatura listesi |

> **Not:** `2a`, `1a` konseptinden türetilmiş çalışan prototiptir; yani `1a → 2a`
> hattı tasarımın en olgun kolu. Tek bir konseptin kilitlenmesi isteniyorsa bunu
> ayrıca belirtin — aksi hâlde beş artboard'ın tamamı referans kabul edilir.

---

## 5. Tasarım dili özeti

Aşağıdakiler dosyadan okunan gerçek değerlerdir; uygulama kodlanırken korunmalıdır.

### Yerleşim
* Sol **sabit kenar çubuğu** + üst şerit + içerik alanı.
  * `1a` / `2a`: etiketli tam genişlik menü (marka “Defter”, şirket seçici
    “Yıldız Tekstil A.Ş.”, kullanıcı kartı “Selin Kaya · Mali Müşavir”).
  * `1b`: dar **ikon rayı** (yoğun analitik düzen).
  * `1c`: etiketli menü + “Hızlı İşlem” bloğu.
* Üst şeritte: arama (“Fatura, cari veya işlem ara…”), dönem seçici
  (“1–31 Ağustos 2026”), bildirim, avatar.
* KDV beyan uyarı şeridi: “KDV beyan dönemi — 26 Ağustos'a 7 gün kaldı.”

### Tipografi
* Gövde/arayüz: `'Helvetica Neue', Helvetica, Arial, sans-serif`
* Sayısal ve rozet metinleri: `ui-monospace, SFMono-Regular, Menlo, monospace`
* `1c` başlıkları: `Spectral, Georgia, serif`

### Renk
Palet ağırlıklı olarak **nötr gri/kağıt tonlarıdır**; renk yalnızca anlam taşıdığı
yerde kullanılır (gecikmiş = kırmızı, ödendi = yeşil, bekliyor = kehribar).

| Konsept | Zemin / yüzey | Metin kademeleri | Vurgu |
|---|---|---|---|
| `1a` / `2a` | `#fafbfc` `#f4f5f7` `#eef0f3`, kenarlık `#e8eaee` | `#171a1f` `#3d434d` `#5c636e` `#8b93a1` `#98a0ad` | mavi `rgba(99,140,235,.16)`, kırmızı `#d94a4a` / `#f87171`, yeşil `#0f7b4f`, kehribar `#8a5a00` |
| `1b` (koyu) | `#0d0f13` `#1b1f24`, üst katmanlar `rgba(255,255,255,.03–.16)` | `#e5e8ec` `#aeb6bf` `#8b949e` `#69737d` | kırmızı `#c0392b` / `#f87171` |
| `1c` (kağıt) | `#fffdf8` `#efe9e0` `#d6cec3` | `#1a1714` `#3a342e` `#6b625a` `#7d746a` `#9a9188` | kehribar/kiremit `#96382e` `#e58a7f`, yeşil `#2f6b47` `#6ee7a0` |

Koyu temada derinlik **gölge ile değil**, `rgba(255,255,255,.03….16)` katman
tonlarıyla kurulur. Bu yaklaşım korunmalıdır.

### Bileşenler
* **KPI kartları** — etiket + büyük değer + alt açıklama (`k.label` / `k.value` / `k.sub`),
  `1b`'de ayrıca delta rozeti (`k.delta`).
* **Tablolar** — Faturalar tablosu: `Fatura No · Cari · Tarih · Tutar · Durum · İşlem`
  (`1b`'de ek `KDV` sütunu). Durum rozetleri, satır içi işlem ikonları, sayfalama
  (“148 kayıttan 6'sı gösteriliyor”), `Durum: Tümü` filtresi, `Dışa Aktar`.
* **Grafikler** — inline SVG: Gelir–Gider sütun grafiği, Nakit Akışı çizgi/alan
  grafiği (`polyline`), Gider Kategorileri dağılımı (`circle` / yüzde çubukları).
  Harici grafik kütüphanesi yoktur.
* **Listeler** — “Son Hareketler” (`a.text` / `a.time`), “Gider Kategorileri”,
  “Cari Yaşlandırma”, “KDV / Vergi Özeti”, “Rapor Şablonları”.
* **Raporlar ekranı** (`2a`) — Gelir Tablosu (P&L), Bilanço Özeti, KDV Beyan Özeti,
  Nakit Akış Raporu (Giriş / Çıkış / Net akış), Cari Yaşlandırma, Gider Kategori Raporu.
* **Boş durumlar** (`2b`) — “Çöp kutusu boş”, “Henüz fatura yok” + 3 adımlı ilk
  kullanım rehberi (Şirket bilgileri → Cari ekle → Fatura kes).
* **Çöp kutusu davranışı** — silinen kayıtlar 30 gün bekletilir; bu kural
  arayüz metinlerine işlenmiştir.

### Dil
Arayüzün tamamı **Türkçe**; para birimi `₺`, binlik ayracı nokta, ondalık virgül
(`₺1.284.500`, `%23,8`), tarihler `GG.AA.YYYY`.

---

## 6. Nasıl görüntülenir?

`Muhasebe Dashboard.dc.html` dosyasını bir tarayıcıda açın. `support.js` aynı
klasörde olduğu sürece tüm artboard'lar render olur.

```bash
start "" "design-reference/accounting-dashboard/Muhasebe Dashboard.dc.html"
```

Artboard'lar arasında `#1a`, `#1b`, `#1c`, `#2a`, `#2b` çapalarıyla gezinilebilir.

---

## 7. Kullanım kuralları

1. Dashboard ile ilgili herhangi bir UI kodlanmadan **önce** bu klasör incelenir.
2. Yerleşim, kenar çubuğu yapısı, tipografi, boşluk ritmi, renk, ikon seti,
   tablo düzeni, kart ve grafik dili, açık/koyu tema davranışı **korunur**.
3. Bu tasarım genel/jenerik bir dashboard şablonuyla **değiştirilmez**.
4. Yeni sayfalar aynı tasarım diline uyar.
5. Bu klasördeki dosyalar, açık talimat olmadan **düzenlenmez**. Tasarım
   güncellenecekse Claude Design projesinden yeniden içe aktarılır ve
   yukarıdaki SHA-256 değerleri tazelenir.

Proje geneli kural için kök dizindeki [`CLAUDE.md`](../../CLAUDE.md) dosyasına bakın.

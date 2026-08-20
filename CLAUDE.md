# MustafaFil — Muhasebe / Finans Uygulaması

Türkçe muhasebe ve finans yazılımı. Bu dosya, projede çalışan herkes ve her
ajan için kalıcı kuralları içerir.

---

## KURAL 1 — Onaylı dashboard tasarım referansı

**Konum:** `design-reference/accounting-dashboard/`

Bu klasördeki Claude Design dosyaları, uygulamanın **görsel doğruluk kaynağıdır
(visual source of truth)**.

| Dosya | Rol |
|---|---|
| `Muhasebe Dashboard.dc.html` | Onaylı tasarım kaynağı — 5 artboard (`1a`, `1b`, `1c`, `2a`, `2b`), açık + koyu tema |
| `support.js` | Claude Design çalışma zamanı — `.dc.html`'in render olması için zorunlu |
| `README.md` | Tasarım dili dökümü, artboard envanteri, bütünlük kontrolü |

### Uyulması zorunlu maddeler

1. **Önce referansı incele.** Dashboard ile ilgili herhangi bir arayüz
   kodlanmadan veya değiştirilmeden önce `design-reference/accounting-dashboard/`
   klasörü açılıp incelenir. İstisnasız.

2. **Bu tasarım görsel doğruluk kaynağıdır.** Uyuşmazlık durumunda referans
   kazanır; tahmin, alışkanlık veya "daha modern olur" gerekçesi geçersizdir.

3. **Şunlar korunur:**
   * genel yerleşim ve ızgara
   * sol kenar çubuğu yapısı (menü grupları, marka bloğu, şirket seçici, kullanıcı kartı)
   * tipografi (`Helvetica Neue` gövde · `ui-monospace` sayısal · `Spectral` serif başlık)
   * boşluk ritmi ve yoğunluk
   * renk paleti ve semantik renk kullanımı (gecikmiş / ödendi / bekliyor)
   * inline SVG ikon seti (`#ic-*`, 20 ikon)
   * tablo düzeni ve sütun yapısı
   * kart ve KPI bileşenleri
   * grafik dili (inline SVG; harici grafik kütüphanesi yok)
   * **açık tema ve koyu tema** davranışı — koyu temada derinlik gölgeyle değil,
     `rgba(255,255,255,.03….16)` katman tonlarıyla kurulur
   * genel görsel dil

4. **Jenerik dashboard yasak.** Bu tasarım, hazır/şablon bir yönetim paneli
   görünümüyle değiştirilmez.

5. **Yeni sayfalar aynı dile uyar.** Aksi açıkça istenmedikçe, ileride eklenecek
   tüm ekranlar bu tasarım dilini sürdürür.

6. **Referans dosyaları dokunulmazdır.** `design-reference/accounting-dashboard/`
   içindeki tasarım dosyaları, kullanıcı açıkça *"dashboard tasarım referansını
   güncelle"* demedikçe **değiştirilmez, sadeleştirilmez, yeniden yazılmaz,
   biçimlendirilmez**. Güncelleme gerekiyorsa Claude Design projesinden yeniden
   içe aktarılır ve README'deki SHA-256 değerleri tazelenir.

---

## KURAL 2 — Projenin mevcut durumu

Proje **tasarım referansı aşamasındadır**. Kullanıcı açıkça istemeden:

* uygulama kodlanmaz,
* backend / veritabanı kurulmaz,
* tasarım yeniden yorumlanmaz.

---

## KURAL 3 — Dil ve biçim

* Arayüzün tamamı **Türkçe**.
* Para birimi `₺`; binlik ayracı nokta, ondalık virgül — `₺1.284.500` · `%23,8`.
* Tarih biçimi `GG.AA.YYYY`.
* Muhasebe terminolojisi Türkiye mevzuatına göre: cari hesap, mizan, yevmiye,
  KDV beyanı, tahakkuk, e-Fatura, muhtasar.

---

## KURAL 4 — Tahmin yasağı

Bu kural diğer üçünün üstündedir ve her görevde geçerlidir.

### 4.1 — Tahminle kural, akış veya gidişat üretme

Bir kuralı, formülü, alan adını, dosya yolunu, sürüm numarasını, API imzasını
veya davranışı **hatırladığını sanarak yazma**. Doğrulanmamış bilgi, bilgi
değildir.

* Kaynağı okumadan "muhtemelen şöyledir" diye ilerleme.
* Var olduğunu varsaydığın dosyayı, fonksiyonu veya ayarı önce **kontrol et**.
* Bir kütüphanenin sürüm uyumunu, bir aracın davranışını veya bir mevzuat
  kuralını hafızadan aktarma — bak, sonra yaz.

### 4.2 — Emin değilsen sor

Aşağıdaki durumlarda **dur ve sor**, kendi kararını verip devam etme:

* İki farklı okuma iki farklı işe yol açıyorsa,
* Bir gereksinim eksik ya da kendi içinde çelişkiliyse,
* Geri alınması zor bir işlem söz konusuysa (silme, üzerine yazma, dışa gönderme),
* Kullanıcının daha önce verdiği bir karara aykırı bir şey yapman gerekiyorsa.

Soruyu **doğru anda** sor: cevaba bağlı olmayan işleri önce bitir, sonra tek ve
net bir soru sor.

### 4.3 — "Araştır" dendiğinde gerçekten araştır

Kullanıcı *araştır*, *incele*, *bak*, *kontrol et* dediyse tahmin üretmek
yasaktır. Sırasıyla:

1. **Kaynağı aç ve oku** — dosyayı, dokümanı, kodu, şartnameyi.
2. **Doğrula** — çalıştır, ara, karşılaştır, sürümü teyit et.
3. **Sonra uygula** ve neye baktığını söyle.

Okunmadan verilen cevap araştırma değildir. Kaynağa erişilemiyorsa bunu
açıkça söyle; boşluğu tahminle doldurma.

### 4.4 — Neyin doğrulandığını ayrı yaz

Cevapta doğrulanmış bilgi ile varsayım **birbirine karışmaz**. Varsayım
kaldıysa "şunu varsaydım" diye açıkça yaz. Test/komut çalıştıysa sonucunu
olduğu gibi bildir; çalışmadıysa "çalıştıramadım" de.

---

## Klasör düzeni

```
MustafaFil/
├── CLAUDE.md                                  ← bu dosya
├── design-reference/
│   └── accounting-dashboard/                  ← ONAYLI TASARIM REFERANSI (salt okunur)
│       ├── Muhasebe Dashboard.dc.html
│       ├── support.js
│       └── README.md
├── docs/
│   └── yan-urunler-sartname-v2.html           ← ayrı proje (Yan Ürünler Stok Takip) şartnamesi
├── ornek-1-defter-onmuhasebe/                 ← eski taslak, REFERANS DEĞİL
├── ornek-2-bilanco-terminal/                  ← boş, REFERANS DEĞİL
└── ornek-3-beyan-vergi-merkezi/               ← boş, REFERANS DEĞİL
```

> `ornek-*` klasörleri, tasarım referansı içe aktarılmadan önce yapılmış
> denemelerdir. **Tasarım kaynağı değildirler** ve hiçbir UI kararında
> referans alınmazlar. Silinip silinmeyeceği kullanıcının kararıdır.

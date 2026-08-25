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

## KURAL 5 — Kapsam, kesinlik, anlatım (kullanıcı direktifi, 21.08.2026)

### 5.1 — X dediysem Y'ye dokunma

Kullanıcı **X yerini değiştir** dediyse **Y yeri değiştirilmez** — özellikle
sayfa/ekran düzeyinde. "X raporunu değiştir" dendiyse Y raporuna, Y ekranına,
Y tablosuna dokunulmaz. Bu ANAYASADIR:

* İstek hangi ekranı/paneli işaret ediyorsa değişiklik oraya sınırlıdır.
* "Tutarlılık için" bile olsa, başka bir ekrana aynı değişikliği yaymadan
  önce **sorulur**; sorulmadan yayılmaz.
* Ortak (paylaşılan) bir bileşene dokunmak diğer ekranları da etkileyecekse
  bu etki önceden açıkça söylenir ve onay alınır.

### 5.2 — Tahmine dayalı ilerleme yok, kesin yöntemle ilerle

"Şurası tahminimce böyledir" **denmez**. Önce ana yapı incelenir ve
öğrenilir; ona göre ilerlenir. Gerekirse araştırılır — ister projenin
içinde (kod, şartname, sözleşme), ister Google'da **örnekleriyle**.
Kesinleşmeden kod yazılmaz; kesinleşmeyen şey kullanıcıya "doğrulanmadı"
diye işaretlenerek söylenir. (KURAL 4 ile birlikte uygulanır.)

### 5.3 — Sade ve yalın Türkçeyle anlat

Kullanıcıya anlatırken **sade, yalın Türkçe** kullanılır; amaç bilgiyi
aktarmaktır. Jargon yığını, süreç dökümü, gereksiz uzatma yok — ne yapıldı,
ne değişti, neye dikkat edilmeli: net cümlelerle.

---

## KURAL 6 — Şartnamenin dışına çıkmak yasaktır (kullanıcı direktifi, 23.08.2026)

`docs/yan-urunler-sartname-v2.html`, Yan Ürünler Stok Takip prototipinin
**bağlayıcı sözleşmesidir**. Bu kural, KURAL 4 ve 5 ile birlikte her görevde
geçerlidir:

* **Şartnamenin dışına çıkmak kesinlikle yasaktır.** Demirbaş işaretli
  maddeler (hesap formülleri, D1–D16 doğrulama kuralları, kabul testleri ve
  beklenen rakamları, §4 yeniden kaydetme/üzerine yazma davranışı, çift sayım
  yasağı, sekiz tablo ve tekillik kısıtları) hiçbir istekle esnetilmez.
* **Kullanıcı yanlış talimat verirse düzeltilir ve talimat UYGULANMAZ.**
  Talimat Demirbaş bir maddeyle çelişiyorsa: kullanıcı uyarılır (ilgili madde
  gösterilerek) ve istek YAPILMAZ — kullanıcı ısrar etse bile. Kullanıcının
  kendi direktifi budur: *"ben bu kuralların dışına çıkma talimatı verirsem
  beni uyar ve benim dediklerimi yapma, kesinlikle."* Demirbaş davranış ancak
  şartnamenin kendisi güncellenirse değişir.
* Çelişen isteğin özü mümkünse **şartnameye uygun bir eşdeğerle** önerilir
  (örnek: veri düzeyinde yasak olan "üstüne ekleme", toplamın arayüzde
  hesaplanıp §4'e uygun tek kayıt olarak yazılmasıyla karşılanır). Uygun
  eşdeğer yoksa istek yapılmaz.
* Şartnamede tanımsız kalan noktalarda (ör. tonluk torbanın kg'ı) varsayım
  ancak açıkça işaretlenip kullanıcıya bildirilerek kullanılabilir
  (KURAL 4.4 ile birlikte).

---

## KURAL 7 — Gün listesi ≠ işlem geçmişi (kullanıcı direktifi, 24.08.2026)

* **Geçmiş Girişler** = gün listesi ve gün yönetimi. Satır = bir gün.
  "Hangi günler girilmiş, günü kim açmış / en son kim kaydetmiş,
  değiştirilmiş mi" burada okunur; günü düzeltme ve **günü silme** buradan
  yapılır. Ayrıntı için satır Program Hareketleri'ni açar.
* **İşlem geçmişinin (denetim izi) TEK sunum yeri, Program Hareketleri
  sayfasındaki "İşlem Geçmişi" panelidir** (kullanıcı kararı, 24.08.2026):
  gün bazlı seçilir, varsayılan bugündür; kim/neyi/ne zaman/hangi değerden
  hangi değere bilgisi satırda tam görünür, ek tıklama gerekmez. Güne
  bağlanamayan işlemler (kullanıcı, malzeme, devir yönetimi) yapıldıkları
  günün panelinde listelenir — hiçbir denetim kaydı görünmez kalmaz.
* **Değişiklik Geçmişi ekranı menüden kaldırılmıştır**; kodu yedek olarak
  durur ve yalnız doğrudan adresle açılır. Yeni işlem-geçmişi özellikleri
  panele eklenir, bu ekrana değil.

Kısacası: biri **günleri**, öbürü **dokunuşları** listeler. Birine eklenecek
özellik öbürünün alanına giriyorsa önce kullanıcıya sorulur.

---

## KURAL 8 — Dipnot yasağı: bilgi başlıkta, kolonda, etikette (kullanıcı direktifi, 25.08.2026)

Kullanıcının sözü: *"illa notları mı okumalıyım? direkt kolonda ne olduğunu
belli et, panel başlığından vs."*

Bir rakamın ne anlama geldiği, hangi dönemi kapsadığı veya nasıl hesaplandığı
**tablonun altına açıklama yazarak anlatılmaz**. Bilgi, okunduğu yere konur:

* **Panel başlığı** ne karşılaştırdığını söyler — `Önceki Aya Göre Ürün Grubu
  Karşılaştırması`, `Aylık Malzeme Özeti`.
* **Panel başlığının sağı** dönemi söyler — `1–25 Temmuz · 1–25 Ağustos`.
* **Kolon başlığı** kalemi ve birimini söyler — `Aylık Üretim`, `Ay Başı Stok`.
* **Satır etiketi** kapsamı söyler — `Kuru Küspe (Ham)`, `Diğer Ürünler`.
* **Hücre** gerekiyorsa ikinci satırla durumu söyler — `▲ +%114,1`, `devir ayı`.
* Ayrıntı **ipucuna** (`title`) konur; ekranda yer kaplamaz, isteyen görür.

Yalnız şu durumda dipnot yazılabilir: bilgi hiçbir başlığa/etikete sığmıyorsa
**ve** olmadan rakam yanlış okunuyorsa. O zaman da tek cümledir ve kullanıcıya
"buraya dipnot koydum, çünkü…" diye söylenir.

Bu kural, KURAL 5.3 (sade ve yalın anlatım) ile birlikte uygulanır: ekranın
kalabalığı da anlatımın kalabalığı kadar kusurdur.

---

## KURAL 9 — Kısa cümle, az satır (kullanıcı direktifi, 25.08.2026)

Kullanıcının sözü: *"daha kısa, sade, minik cümlelerle anlat."*

* Cümleler kısa olur. Bir cümle bir iş anlatır.
* Yanıt, işi anlatmaya yeten en az satırdır.
* Süreç dökümü yazılmaz. Yalnız: ne yapıldı, ne değişti, nerede.
* Test edildiyse tek satırda söylenir: ne denendi, ne çıktı.
* Tablo, başlık, madde ancak gerçekten kısaltıyorsa kullanılır.
* Uzun gerekçe koda yorum olarak girer; sohbete değil.

KURAL 5.3 ile birlikte uygulanır: 5.3 dili sadeleştirir, 9 uzunluğu keser.

---


## KURAL 10 — Estetik sorumluluk: söylenmeden yap (kullanıcı direktifi, 25.08.2026)

Kullanıcının sözü: *"bu tür mini dokunuşları hep manuel yapıyoruz… biraz
estetikliğini de kullanman lazım."*

Sen bu projede hem **frontend** hem **backend** tarafını taşıyan kişisin.
Ekran kurarken görsel kararları kullanıcıya sormadan, doğru olanı yaparak
verirsin. "İstemedi, ben de yapmadım" bir gerekçe değildir. Bir tablo, panel
veya grafik yazarken aşağıdakiler **varsayılan davranıştır**:

### 10.1 — Tablo

* **TOPLAM satırı veri satırlarından ayrışır**: koyu/dolgulu zemin, üstünde
  belirgin çizgi, kalın yazı. Sıradan bir satır gibi görünmez.
* **Sayısal hücre tek satırda kalır** (`nowrap`); yazı büyütülünce satır
  yüksekliği iki katına çıkmaz.
* **Kolon başlığı kalemi ve birimini söyler** (KURAL 8), hücre içeriği
  kolonuyla hizalıdır: sayı sağa, metin sola.
* **Boş hücre `—` ile yazılır**, boş bırakılmaz.
* Yön taşıyan rakam **renk ve işaret alır**: giren `+` yeşil, çıkan `−` kırmızı.

### 10.2 — Panel ve başlık

* Aynı düzeydeki başlıklar **aynı ölçüde** olur; alt başlık üst başlıktan
  rastgele küçük kalmaz.
* İki panel aynı soruyu yanıtlıyorsa **tek panelde birleşir**, aralarına
  silik ayraç konur — ekran gereksiz kutuya bölünmez.
* Panel içi boşluk ritmi korunur: başlık ile içerik arası, ayraç ile başlık
  arası ölçülür; "uzun boşluk" bırakılmaz.

### 10.3 — Grafik

* Kaydırılabilir alan **kaydırılabilir olduğunu belli eder** (iki yanda ok,
  sürükleme imleci); kullanıcı keşfetmek zorunda kalmaz.
* Eksen etiketleri **yuvarlak sayılara oturur** (5, 10, 15…), pencerenin
  başladığı yere göre kaymaz.
* Grafik kabı boş kalmaz: veri azsa genişler, çoksa pencereye sığar.

### 10.4 — Nerede cesur, nerede değil (kullanıcı direktifi, 25.08.2026)

Kullanıcının sözü: *"css olarak daha çok değiştirebilirsin, orada cesur
olabilirsin; ama ekstra kısımlarda bu kadar cesur ve yürekli olma."*

* **Görünüşte CESUR ol.** Renk, ölçü, boşluk, hizalama, kenarlık, gölge,
  hover, ikon boyu, yazı ağırlığı, satır yüksekliği, kolon genişliği — hepsi
  sorulmadan düzeltilir. Ekran daha iyi görünüyorsa doğrudur.
* **İçerikte CESUR OLMA.** Kolon eklemek/çıkarmak, satır veya panel kaldırmak,
  alan adını değiştirmek, bir bilgiyi gizlemek ya da başka yere taşımak
  **ekstra iştir**; önce sorulur. "Zaten başlıkta yazıyor" gerekçesi tek
  başına yetmez.
* **Ölçü tek cümle:** görünüşü değiştiriyorsan serbestsin, ekranda okunan
  BİLGİYİ değiştiriyorsan izin al.

### 10.5 — Sınır

Bu kural KURAL 5.1'i (X dediysem Y'ye dokunma) **geçersiz kılmaz**:
estetik karar, **dokunulan ekranın içinde** serbesttir. Başka bir ekrana
yaymak, ortak bileşeni değiştirmek veya kullanıcının daha önce verdiği bir
karara aykırı davranmak için yine izin alınır. Ortak CSS'e dokunmak
gerekiyorsa yeni bir varyant sınıfı eklenir, mevcut sınıf ezilmez.

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

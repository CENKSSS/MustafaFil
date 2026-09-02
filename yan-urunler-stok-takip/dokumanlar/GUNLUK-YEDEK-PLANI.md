# Günlük JSON Yedek Klasörü — Araştırma ve Uygulama Planı

**Tarih:** 27.08.2026 · **Durum:** UYGULANDI (REVİZE ile — aşağı bak)
**İstek:** kullanıcı (27.08.2026) — "klasörde güne göre günün json verileri
olsun; db'ye bir şey olursa buradan alınabilsin."

---

## 1. Bu oturumda DOĞRULANANLAR (KURAL 4.4)

| Ne | Nasıl doğrulandı | Sonuç |
|---|---|---|
| Veri bugün nerede | `01-cekirdek.js` · `index.html` script listesi | Yalnız `localStorage` (`yu.veri.v1`). `06-uzak.js` köprüsü YAZILMIŞ ama index.html'e BAĞLI DEĞİL |
| Mevcut sunucu yazma alır mı | `.claude/launch.json` → `py -m http.server` | HAYIR — salt statik servis, POST ucu yok |
| Tek yazma noktası | `grep depo.kaydet` | `01-cekirdek.js:1045` — tüm servisler buradan geçer |
| Paket boyu | DENEMELIK-SUNUCU-PLANI §3.3 (ölçülmüş) | ~842 KB, günde 40–50 yazma |
| Tarayıcı klasöre yazabilir mi | MDN File System Access API | Chrome/Edge: `showDirectoryPicker` + kalıcı izin. Firefox/Safari: YOK |
| Gün sınırı hangi saate göre | `YU.zaman` (26.08.2026) | İstanbul saati, kaynak internet — makine saatine güvenilmiyor |
| Buçuklu veri riski | 27.08.2026 taraması | Kalmadı — tüm miktarlar tam sayı |

## 2. Mimari seçim — üç yol

| Yol | Nasıl | Karar |
|---|---|---|
| **A · İndirme (download)** | Her kayıtta dosya indirtilir | RED — her seferinde Downloads'a düşer, klasör düzeni kullanıcıya kalır, sessiz çalışmaz |
| **B · Sunucu yazar** | .NET köprüsü canlıyken her POST'ta gün dosyası üretir | DOĞRU ama ERKEN — köprü henüz bağlı değil. Köprüye geçilince bu üretici sunucuya TAŞINIR (§8) |
| **C · Tarayıcı klasöre yazar (File System Access API)** | Bir kez klasör seçilir, izin kalıcı; her `depo.kaydet`te değişen gün dosyaları yazılır | **SEÇİLEN** — bugünkü localStorage mimarisiyle bugün çalışır |

## 3. Klasör düzeni

```
gunluk-veriler/            ← kullanıcının seçtiği klasör
  _tam-paket.json          ← HER kayıtta güncellenen TAM yedek (asıl kurtarma kaynağı)
  _tanimlar.json           ← kullanıcılar, malzemeler, silolar, devirler, kilitler, sayaçlar
  2026-08-27.json          ← o güne ait TÜM hareketler (aşağıda)
  2026-08-26.json
  ...
```

Gün dosyası içeriği:
```json
{ "surum": 1, "tarih": "2026-08-27", "yazilma": "2026-08-27T18:40:12",
  "kuruKuspe":   { ...o günün KuruKuspeGunluk satırı },
  "siloHareket":  [ ...o günün tüm silo hareketleri ],
  "gunlukHareket":[ ...o günün tüm malzeme satırları ],
  "degisiklikLog":[ ...o günün tüm denetim izi ] }
```

* `_tam-paket.json` tek başına TAM kurtarma sağlar (842 KB — mevcut "Yedek
  İndir" ile aynı biçim). Gün dosyaları ayrıntılı tarih arşividir; tek bir
  günü inceleme/karşılaştırma ve kısmi kurtarma içindir.
* Dosya adı **ISO (YYYY-AA-GG)**: klasörde ada göre sıralama = tarihe göre
  sıralama. GG.AA.YYYY istenirse yazılır ama sıralama bozulur (karar §9).

## 4. Yazma akışı

```
depo.kaydet() → localStorage yazılır (bugünkü davranış, DOKUNULMAZ)
             → yedekci.tetikle()          (kuyruğa atar, kaydet'i BEKLETMEZ)
                 1. gün dilimlerini grupla (tek geçiş, ~6 bin satır)
                 2. her dilimin özeti (hash) manifest ile karşılaştır
                 3. yalnız DEĞİŞEN dosyaları yaz + _tam-paket.json
                 4. manifest güncelle (localStorage · yu.yedek.ozet)
```

* Yazma `createWritable()` iledir: API dosyayı önce geçici kopyaya yazar,
  `close()`ta tek hamlede yerine koyar — **yarım dosya kalamaz**.
* Yazım eşzamansızdır; kullanıcı kaydetme hızında hiçbir fark görmez.

## 5. Öngörülen hatalar ve önlemleri

| # | Hata | Önlem |
|---|---|---|
| 1 | Yarım/bozuk dosya (elektrik, çökme) | `createWritable` atomik commit; geri yüklemede JSON.parse + şema denetimi, bozuk dosya atlanır ve adı söylenir |
| 2 | Klasör izni kaybı (taşındı, silindi, izin geri alındı) | Kabukta kalıcı sarı rozet "Yedek klasörü bağlı değil"; tıklayınca yeniden seçtirir. Yazılamayan günler manifestte KİRLİ kalır, bağlanınca kendiliğinden yazılır |
| 3 | İki sekme aynı anda | İçerik depodan türetilir (deterministik) — son yazan kazanır, veri aynıdır |
| 4 | Geçmiş güne düzeltme | Manifest karşılaştırması HANGİ günün değiştiğini kendisi bulur; o günün dosyası yeniden yazılır |
| 5 | Gün silme | Gün dosyası boş-gün içerikle YENİDEN yazılır (silinmez — "bu gün silindi" izi kalır) |
| 6 | Tanım değişikliği (malzeme adı, kullanıcı) | Tanımlar gün dosyalarında DEĞİL, `_tanimlar.json`da — tek dosya yenilenir, 400 gün dosyası ellenmez |
| 7 | Manifest kaybı (localStorage temizlendi) | Tüm dosyalar bir kez baştan yazılır (kendini onarır) |
| 8 | Disk dolu / yazma hatası | Kırmızı şerit + hangi dosya olduğu; localStorage kaydı ETKİLENMEZ (asıl kayıt önce) |
| 9 | Firefox/Safari | API yok — düğme gizlenir, mevcut "Yedek İndir" yolu duruyor |
| 10 | Saat kayması | Gün sınırı `YU.zaman` (İstanbul, internet) — makine saati kullanılmaz |
| 11 | Yanlış yedeği geri yükleme | Geri yükleme ÖNCE mevcut durumu otomatik indirtir, sonra onay ister (tarih + kayıt sayısı gösterilir) |

## 6. Geri yükleme

Sistem menüsüne "Günlük Yedekten Geri Yükle":
1. Klasör seçtirilir, `_tam-paket.json` okunur → tarih ve kayıt sayısı gösterilir → onayla → mevcut "Yedek Yükle" yoluyla (aynı doğrulamalar) depo değiştirilir.
2. `_tam-paket.json` yok/bozuksa: `_tanimlar.json` + tüm gün dosyaları birleştirilir; sayaçlar en büyük Id'den yeniden kurulur; bozuk dosyalar adlarıyla raporlanır.

## 7. Dokunulacak dosyalar

| Dosya | İş |
|---|---|
| `js/07-yedekci.js` (YENİ) | Klasör tutamacı (IndexedDB), dilimleme, manifest, yazma kuyruğu |
| `js/01-cekirdek.js` | `depo.kaydet` sonuna tek satır: `YU.yedekci && YU.yedekci.tetikle()` |
| `js/10-kabuk.js` | Sistem menüsüne "Yedek Klasörü Bağla" + rozet + geri yükleme penceresi |
| `index.html` | script satırı |
| Kabul testleri | Etkilenmez (bellek deposunda `kaydet` no-op) — 12/12 koşulacak |

## 8. Sunucuya geçiş notu

SQLite köprüsü bağlandığında (DENEMELIK-SUNUCU-PLANI) bu üretici sunucu
tarafına taşınır: her `POST /api/paket` sonrası aynı gün dosyalarını sunucu
diski `C:\YanUrunler\yedek\gunluk-veriler\` içine yazar. Dosya biçimi AYNI
kalır — istemcideki yazıcı kapatılır, okuyucu (geri yükleme) değişmez.

## 9. Kullanıcıya sorulan kararlar

1. Dosya adı: **ISO (2026-08-27.json, önerilen)** mi, GG.AA.YYYY mi?
2. Onay: uygulamaya başlansın mı?

---

## 10. REVİZE (kullanıcı direktifi, 27.08.2026 — uygulanan bu)

Kullanıcının sözü: *"otomatik olmalı, manuel tıklama olmayacak, bir klasör
aç."* §2'deki C şıkkı (tarayıcı + File System Access) klasör SEÇTİRİYORDU;
tarayıcı el hareketi olmadan diske yazamaz. Bu yüzden B şıkkına geçildi ama
.NET beklenmedi: `py -m http.server`in yerine **yan-urunler-sunucu.py**
kondu (salt Python standart kütüphanesi):

* Statik servis aynen sürer; ek olarak `POST /api/gunluk-yedek` gelen
  dosyaları `MustafaFil\gunluk-veriler\` içine ATOMİK yazar (tmp + replace),
  dosya adı beyaz listesi yol kaçağını keser.
* `07-yedekci.js` klasör seçtirmez; açılışta `GET /api/gunluk-yedek/saglik`
  ile sunucuyu tanır, her `depo.kaydet`te değişen dosyaları gönderir.
  Sunucu ucu yoksa (eski statik sunucu) katman sessizce kapanır.
* Klasör boşaltılmışsa (sağlık cevabında adet 0) manifest sıfırlanır ve
  her şey baştan yazılır.
* Yazma hatasında sarı yazı yanar, 30 sn'de bir kendiliğinden yeniden dener.
* Geri yükleme düğmesi: "Günlük Yedekten Geri Yükle" — önce mevcut durumu
  indirir, sonra onayla `_tam-paket.json`u yükler.
* `Yan-Urunler-Baslat.vbs` ve `.claude/launch.json` yeni sunucuyu çalıştırır.

§5'teki hata önlemleri geçerliliğini korur; 2 (izin kaybı) ve 9 (tarayıcı
desteği) maddeleri sunucu modunda kendiliğinden düştü — izin ve tarayıcı
API'si artık kullanılmıyor.

## 11. Sıklık kararı (kullanıcı, 28.08.2026)

Yedekleme ANLIK kalır — her kayıtta, değişen dosyalar. "4 saatte bir /
günde bir / dün mühürleme" seçenekleri konuşuldu; kullanıcı gün-kapanışı
(mühürlü kopya) katmanına GEREK YOK dedi. Ortak sunucuya geçişte de aynı
kural: yedeği sunucu yazar, sıklık anlık.

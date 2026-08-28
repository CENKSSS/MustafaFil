# İade Stoğa Girsin — Bağımlılık Envanteri ve Uygulama Planı

> ## ⛔ KAPANDI — UYGULANMADI
>
> **Kullanıcı kararı, 26.08.2026:** *"iade stoğa alınmasın."*
>
> Bu plan hayata geçirilmedi. Şartname §5 formülleri **olduğu gibi duruyor**,
> kodda hiçbir değişiklik yapılmadı. Aşağıdaki envanter ve risk analizi,
> ileride aynı konu tekrar açılırsa diye kayıt olarak bırakılmıştır —
> **yapılacaklar listesi değildir.**
>
> Yürürlükteki davranış: iade kaydedilir ve ayrı kolonda raporlanır,
> stok rakamına girmez.


**Karar (kullanıcı, 26.08.2026):** İade artık stoğa girer. Yeni formüller:

```
Basit malzeme + çuvallı :  Stok = Devir + Toplam Üretim − Toplam Satış + Toplam İade
Dökme kuru küspe        :  Stok = tüm siloların mevcut toplamı + Toplam İade
```

İade **üretim sayılmaz**, ayrı kolon olarak kalır. İade **siloya girmez**.

Bu döküman, dosyalar okunarak çıkarıldı. Her satır dosya:satır olarak verilmiştir.

---

## 1. En önemli bulgu: kabul testleri değişmiyor

`js/40-kabul-testleri.js` içinde **"iade" kelimesi hiç geçmiyor.** On iki senaryonun
hiçbirinde iade girilmiyor, yani hepsinde `İade = 0`.

```
Yeni formül   :  silo toplamı + 0  =  silo toplamı
Eski formül   :  silo toplamı
```

Sonuç: **§9'daki Demirbaş rakamların hiçbiri değişmez.**

| Test | Beklenen | Yeni formülle |
|---|---|---|
| Test 1 · [:281](js/40-kabul-testleri.js#L281) | Dökme stok 240.000 kg | 240.000 kg — aynı |
| Test 1 · [:282](js/40-kabul-testleri.js#L282) | Çuvallı stok 10.000 kg | 10.000 kg — aynı |
| Test 9 · [:458](js/40-kabul-testleri.js#L458) | Dökme stok 200.000 kg | 200.000 kg — aynı |

Bu, değişikliği güvenli kılan tek en büyük etken: Demirbaş kabul rakamlarına
dokunmadan §5 güncellenebiliyor.

---

## 2. Kod: hesap TEK YERDE

Bütün ekranlar `YU.stok.malzemeStok()` üzerinden geçiyor. Formül tek noktada:

| Dosya:satır | Bugün | Olacak |
|---|---|---|
| [04-servis.js:373](js/04-servis.js#L373) | `mevcut = dokme ? dokmeToplami : devir + uretim - satis` | her iki dala `+ iade` |

`iade` değişkeni zaten aynı fonksiyonda, aynı devir penceresinde toplanıyor
([04-servis.js:361](js/04-servis.js#L361)) — pencere tutarlı, ek hesap gerekmiyor.

**Kod değişikliği bir satır.** Zor olan kod değil, sonuçları.

---

## 3. Kırılacak tek yer: çift sayım kontrolü

[23-stok-durumu.js:108](js/23-stok-durumu.js#L108) `ciftSayim()`

```
gerçek   = dökme stok + çuvallı stok
beklenen = devir (silolar + çuvallı) + Σ ham dökme üretim − Σ dökme satış − Σ çuvallı satış
```

`gerçek` tarafı `+ iade` kadar büyüyecek, `beklenen` tarafı büyümeyecek.
Panel **her zaman** "tutmuyor" diyecek, sapma tam olarak toplam iade kadar olacak.
Üst şeritte de kalıcı "Çift Sayım Tutmuyor" uyarısı düşecek
([10-kabuk.js:591](js/10-kabuk.js#L591)).

**Yapılacak:** `beklenen`e dökme iadesi + çuvallı iadesi eklenir.
Not: 26.08.2026'da iade beklenenden ÇIKARILMIŞTI ([23-stok-durumu.js:135](js/23-stok-durumu.js#L135));
o karar bu değişiklikle geri alınmalı, yoksa panel yanlış alarm verir.

---

## 4. Silo toplamı ile dökme stok artık AYRILIYOR

Bugüne kadar bu iki sayı hep eşitti. Yeni kuralla aralarındaki fark = toplam iade.
İkisini birlikte gösteren yerler:

| Nerede | Ne gösteriyor | Etki |
|---|---|---|
| [20-anasayfa.js:133](js/20-anasayfa.js#L133) | Silo kartları — `dokmeToplam` | Silo toplamı; **doğru kalır** |
| [21-kuru-kuspe-giris.js:1349](js/21-kuru-kuspe-giris.js#L1349) | "Yeni silo toplamı …" mesajı | Silo toplamı; **doğru kalır** |
| [23-stok-durumu.js](js/23-stok-durumu.js) | Stok kolonu + "Silolar Toplamı" rozeti | **Rozet yanıltıcı olur** — stok artık silo toplamı değil |
| [23-stok-durumu.js:345](js/23-stok-durumu.js#L345) | Stok hücresi ipucu | Formüle `+ İade` satırı eklenmeli |
| [27-devir-stok.js:767](js/27-devir-stok.js#L767) | Devir öncesi/sonrası dökme | Silo toplamı; **doğru kalır** |
| [04-servis.js:1753](js/04-servis.js#L1753) | Yedek/rapor `DokmeToplam` | Silo toplamı; adı zaten "toplam" |

**Yapılacak:** Stok Durumu'ndaki `Silolar Toplamı` rozeti güncellenir
(örn. `Silolar + İade`) ve ipucunda fark açıklanır. Öbür yerler dokunulmaz —
onlar zaten silo toplamı diyor ve öyle kalıyor.

---

## 5. Kendiliğinden doğru çalışacak yerler

Bunlar `malzemeStok().mevcut` okuduğu için otomatik uyar:

| Dosya | Ne |
|---|---|
| [22-malzeme-girisi.js:76](js/22-malzeme-girisi.js#L76) | Gün Sonu Stok kolonu |
| [34-aylik-ozet.js:199](js/34-aylik-ozet.js#L199) | Ay başı / ay sonu stok |
| [34-aylik-ozet.js:402](js/34-aylik-ozet.js#L402) | Aylık kapanış |
| [35-mail-gonder.js](js/35-mail-gonder.js) | Mail raporu (iade zaten ayrı kolon) |
| [23-stok-durumu.js:239](js/23-stok-durumu.js#L239) | CSV dışa aktarım |

---

## 6. Çözülmesi gereken İŞ KURALI — kod değil

Bu, değişikliğin asıl riski. Kod yazmadan önce cevaplanmalı.

### 6.1 — İade edilen dökme küspe SATILAMAZ

Şartname §5 v2: her dökme satışın silo karşılığı olmak zorunda (**D13**), ve bir
silodan çekilen o günkü mevcudu aşamaz (**D7**). İade siloya girmediği için:

* stok rakamı artar,
* ama o miktar hiçbir silodan çekilemez,
* dolayısıyla **sistem üzerinden satılamaz**.

Kampanya boyunca iade birikirse, stokta görünen ama satılamayan bir bakiye oluşur.

### 6.2 — Çift sayım tehlikesi

İade edilen küspe fiziksel olarak sonradan bir siloya konursa (Manuel / sayım
düzeltmesi), **iki kez sayılır**: bir kez iade olarak, bir kez silo bakiyesinde.
Şartname §4'ün "çift sayım yasağı" Demirbaş maddesi tam olarak bunu yasaklıyor.

**Şartname bunu açıkça yazmalı.** İki seçenekten biri seçilmeli:

| | Kural | Sonuç |
|---|---|---|
| **A** | İade edilen dökme ASLA siloya konmaz; ayrı sahada durur | Çift sayım olmaz. Ama o mal satılamaz — elden çıkarılması ayrı bir işlem olur |
| **B** | İade siloya konabilir, ama konduğu anda iade kaydı silinir | Çift sayım olmaz, mal satılabilir. Ancak iki adımlı bir iş akışı gerekir |

Bu seçim yapılmadan §5 yazılamaz; yazılırsa kural yarım kalır.

### 6.3 — Negatif stok kuralıyla ilişkisi

KURAL 12 (stok eksiye düşemez) etkilenmez — iade yalnız artırır. Ama bir malzemenin
**satılabilir** stoğu eksiye düşmüşken iade sayesinde toplam pozitif görünebilir.
Kural yine de doğru çalışır; sadece bilinsin.

---

## 7. Uygulama sırası

KURAL 6 gereği önce sözleşme, sonra kod:

| # | Adım | Dosya |
|---|---|---|
| 1 | **§6.2'deki A/B kararı alınır** | — (kullanıcı) |
| 2 | §5 "Stok formülleri" güncellenir: her iki formüle `+ Toplam İade`, ayrıca iadenin siloya girmediği ve §6.2 kuralı yazılır | `docs/yan-urunler-sartname-v2.html` |
| 3 | Düz metin karşılığı tazelenir | `sartname-duz.txt` |
| 4 | Karar kalıcı kurala yazılır | `CLAUDE.md` (KURAL 13) |
| 5 | Formül değişir (tek satır) | [04-servis.js:373](js/04-servis.js#L373) |
| 6 | Çift sayım beklenen tarafı hizalanır | [23-stok-durumu.js:108](js/23-stok-durumu.js#L108) |
| 7 | "Silolar Toplamı" rozeti ve stok ipucu güncellenir | [23-stok-durumu.js](js/23-stok-durumu.js) |
| 8 | 12 kabul testi koşulur — **hepsi geçmeli, rakamlar değişmemeli** | `#/kabul-testleri` |
| 9 | İade girilmiş bir günle elle sınanır: stok tam iade kadar artmalı, silo bakiyeleri değişmemeli | — |

---

## 8. Dokunulacak dosya sayısı

| Katman | Dosya | Satır |
|---|---|---|
| Şartname | 2 | ~6 |
| Kural dökümanı | 1 | ~20 |
| Hesap | 1 | **1** |
| Çift sayım kontrolü | 1 | ~6 |
| Ekran metinleri | 1 | ~4 |
| **Toplam** | **6 dosya** | **~37 satır** |

Kabul testleri: **0 satır**. Veritabanı şeması: **0 değişiklik** — `Iade` kolonu
`GunlukHareket` içinde zaten var ([04-servis.js:668](js/04-servis.js#L668)).

---

## 9. Risk özeti

| Risk | Şiddet | Karşılık |
|---|---|---|
| İade edilen dökme satılamaz (§6.1) | **Yüksek** | §6.2'de A/B kararı |
| Sonradan siloya konursa çift sayım (§6.2) | **Yüksek** | Şartnameye açık kural |
| Çift sayım paneli sürekli alarm verir (§3) | Orta | Beklenen tarafı hizalanır |
| "Silolar Toplamı" rozeti yanıltır (§4) | Düşük | Rozet metni güncellenir |
| Kabul testleri kırılır | **Yok** | İade testlerde 0 |

---

*26.08.2026 · sayılan dosyalar okunarak üretildi. Şartname alıntıları
`sartname-duz.txt` satır numaralarıyla doğrulandı.*

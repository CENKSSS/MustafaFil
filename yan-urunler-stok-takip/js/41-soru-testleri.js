/* js/41-soru-testleri.js — Soru motorunun ölçüm külliyatı ve koşucusu.

   Amaç: "doğru anlıyor" iddiasını ÖLÇMEK. Külliyat her soruyu üç eksende
   zorlar:
     * Yazım      — aynı soru Türkçe harfli ve harfsiz ("geçen"/"gecen")
     * Kuruluş    — aynı soru farklı cümlelerle ("nasıl gidiyor" /
                    "ne durumdayız" / "kıyasla ne durumda")
     * Hata       — harf düşmesi, devrik harf, birleşik yazım
   Beklenen alanlar:
     niyet   — kabul edilebilir niyet(ler)
     m       — çıkarılması gereken malzeme kimlikleri
     o       — çıkarılması gereken ölçüt
     gun     — çıkarılması gereken gün sırası
     kapsam  — 'ilk' | 'son' ve kapsamSayi

   Ekran: Yönetim Paneli > Soru Testleri (yalnızca Yönetici).
   Testler depoya DOKUNMAZ; yalnızca çözümleme yapılır. */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});
  var test = YU.soruTest = {};

  /* Malzeme kimlikleri tohum verisindeki sırayla:
     1 Yaş Küspe (Tonluk) · 2 Yaş Küspe (25'lik) · 3 Dökme Kuru Küspe
     4 Kuru Küspe (50 Kg) · 5 Atık Kuru Küspe · 6 Kuyruk · 7 Toprak
     Külliyat kimliğe değil ADA göre eşleşir (aşağıdaki `mAd`), böylece
     malzeme sırası değişse de test bozulmaz. */

  var KARS = ['karsilastirma', 'genel-durum'];

  test.SORULAR = [
    /* ---------- 1. Genel karşılaştırma: aynı soru, farklı kuruluş ---------- */
    { s: 'Geçen seneye göre nasıl ilerliyoruz?', niyet: KARS },
    { s: 'gecen seneye gore nasil ilerliyoruz', niyet: KARS },
    { s: 'GEÇEN SENEYE GÖRE NASIL İLERLİYORUZ', niyet: KARS },
    { s: 'geçen yıla göre nasıl gidiyoruz', niyet: KARS },
    { s: 'gecen yila gore ne durumdayiz', niyet: KARS },
    { s: 'geçen kampanyaya kıyasla ne durumdayız', niyet: KARS },
    { s: 'önceki sezona göre durumumuz ne', niyet: KARS },
    { s: 'onceki kampanyaya gore nasiliz', niyet: KARS },
    { s: 'geçen seneyle karşılaştır', niyet: KARS },
    { s: 'gecen yilla kiyasla', niyet: KARS },
    { s: 'bir önceki kampanyaya göre nasılız', niyet: KARS },
    { s: 'geçen sezona nazaran ne durumda', niyet: KARS },
    { s: 'gecen seneye gore farkimiz ne', niyet: KARS },
    { s: 'geçmiş kampanyaya göre performansımız', niyet: KARS },
    { s: 'gecen seneye gore iyi mi gidiyor', niyet: KARS },
    { s: 'geçen yıla göre artmış mıyız', niyet: KARS },
    { s: 'gecen kampanyaya gore dusmus muyuz', niyet: KARS },
    { s: 'gecen seneye gore genel durum', niyet: KARS },
    { s: 'gecn seneye gore nasil gidiyoruz', niyet: KARS },          /* harf düşmesi */
    { s: 'geçen seneye göre nasil ilerliyrouz', niyet: KARS },       /* devrik harf */

    /* ---------- 2. Genel durum (dönem söylenmeden) ---------- */
    { s: 'nasıl gidiyoruz', niyet: KARS },
    { s: 'nasil gidiyoruz', niyet: KARS },
    { s: 'ne durumdayız', niyet: KARS },
    { s: 'ne durumdayiz', niyet: KARS },
    { s: 'genel durum ne', niyet: KARS },
    { s: 'gidişat nasıl', niyet: KARS },
    { s: 'gidisat nasil', niyet: KARS },
    { s: 'performansımız nasıl', niyet: KARS },
    { s: 'özetle', niyet: KARS },
    { s: 'genel bakış', niyet: KARS },

    /* ---------- 3. Tek kalem karşılaştırma ---------- */
    { s: 'Toprak satışı geçen seneye göre nasıl?', niyet: KARS, mAd: 'Toprak', o: 'satis' },
    { s: 'toprak satisi gecen seneye gore nasil', niyet: KARS, mAd: 'Toprak', o: 'satis' },
    { s: 'toprakta gecen yila kiyasla ne durumdayiz', niyet: KARS, mAd: 'Toprak' },
    { s: 'geçen seneye göre toprak üretimi', niyet: KARS, mAd: 'Toprak', o: 'uretim' },
    { s: 'kuyruk üretimi geçen kampanyaya göre nasıl', niyet: KARS, mAd: 'Kuyruk', o: 'uretim' },
    { s: 'kuyruk satisi gecen seneye gore artmis mi', niyet: KARS, mAd: 'Kuyruk', o: 'satis' },
    { s: 'dökme küspe üretimi geçen seneye göre nasıl', niyet: KARS, mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'dokme kuspe uretimi gecen yila gore', niyet: KARS, mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'dökme satış geçen seneye göre düşmüş mü', niyet: KARS, mAd: 'Dökme Kuru Küspe', o: 'satis' },
    { s: 'çuvallama geçen seneye göre artmış mı', niyet: KARS, o: 'cuvallama' },
    { s: 'cuvallama gecen yila gore nasil', niyet: KARS, o: 'cuvallama' },
    { s: 'atık küspe geçen seneye göre ne durumda', niyet: KARS, mAd: 'Atık Kuru Küspe' },
    { s: 'atik kuspe uretimi gecen seneye gore', niyet: KARS, mAd: 'Atık Kuru Küspe', o: 'uretim' },
    { s: 'tonluk yaş küspe geçen yıla göre nasıl', niyet: KARS, mAd: 'Yaş Küspe (Tonluk)' },
    { s: '25lik yas kuspe gecen seneye gore', niyet: KARS, mAd: "Yaş Küspe (25'lik)" },
    { s: 'çuvallı küspe satışı geçen seneye göre', niyet: KARS, mAd: 'Kuru Küspe (50 Kg)', o: 'satis' },
    { s: 'toprakta gecen seneye gore geride miyiz', niyet: KARS, mAd: 'Toprak' },
    { s: 'toprk satisi gecen seneye gore nasil', niyet: KARS, mAd: 'Toprak', o: 'satis' },  /* hatalı yazım */
    { s: 'gecen seneye gore kuyrukta ne durumdayiz', niyet: KARS, mAd: 'Kuyruk' },
    { s: 'dokme uretimi gecen kampanyaya kiyasla', niyet: KARS, mAd: 'Dökme Kuru Küspe', o: 'uretim' },

    /* ---------- 4. Değer sorgusu ---------- */
    { s: 'Bu sene ne kadar dökme küspe ürettik?', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'bu sene ne kadar dokme kuspe urettik', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'ne kadar toprak sattık', niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: 'ne kadar toprak sattik', niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: 'toplam kaç kg kuyruk ürettik', niyet: 'deger', mAd: 'Kuyruk', o: 'uretim' },
    { s: 'toplam cuvallama ne kadar', niyet: 'deger', o: 'cuvallama' },
    { s: 'bu kampanyada ne kadar dökme küspe sattık', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'satis' },
    { s: 'toprak üretimi ne kadar', niyet: 'deger', mAd: 'Toprak', o: 'uretim' },
    { s: 'atık küspe üretimi toplam ne kadar', niyet: 'deger', mAd: 'Atık Kuru Küspe', o: 'uretim' },
    { s: 'kac adet cuval yaptik', niyet: 'deger', o: 'cuvallama' },
    { s: 'tonluk yaş küspe ne kadar üretilmiş', niyet: 'deger', mAd: 'Yaş Küspe (Tonluk)', o: 'uretim' },
    { s: 'simdiye kadar ne kadar dokme urettik', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'toprak', niyet: 'deger', mAd: 'Toprak' },
    { s: 'kuyruk', niyet: 'deger', mAd: 'Kuyruk' },
    { s: 'dökme küspe', niyet: 'deger', mAd: 'Dökme Kuru Küspe' },
    { s: 'ne kadar urettik', niyet: 'deger', o: 'uretim' },
    { s: 'ne kadar sattik', niyet: 'deger', o: 'satis' },
    { s: 'bugune kadar toplam satis', niyet: 'deger', o: 'satis' },
    { s: '25lik kuspe ne kadar satilmis', niyet: 'deger', mAd: "Yaş Küspe (25'lik)", o: 'satis' },
    { s: 'geçen sene ne kadar toprak sattık', niyet: 'deger', mAd: 'Toprak', o: 'satis' },

    /* ---------- 5. Sıralama ---------- */
    { s: 'En çok artan kalem hangisi?', niyet: 'siralama' },
    { s: 'en cok artan ne', niyet: 'siralama' },
    { s: 'en çok artan hangisi', niyet: 'siralama' },
    { s: 'en fazla artan kalem', niyet: 'siralama' },
    { s: 'En çok düşen ne?', niyet: 'siralama' },
    { s: 'en cok dusen kalem hangisi', niyet: 'siralama' },
    { s: 'en fazla dusen urun', niyet: 'siralama' },
    { s: 'hangi kalem artmış', niyet: 'siralama' },
    { s: 'hangisi dusmus', niyet: 'siralama' },
    { s: 'neler artmış', niyet: 'siralama' },
    { s: 'neler dusmus', niyet: 'siralama' },
    { s: 'nerede iyiyiz', niyet: 'siralama' },
    { s: 'nerede geriyiz', niyet: 'siralama' },
    { s: 'en iyi giden kalem', niyet: 'siralama' },
    { s: 'en kötü giden ne', niyet: 'siralama' },
    { s: 'sorunlu kalemler neler', niyet: 'siralama' },
    { s: 'en cok gerileyen hangisi', niyet: 'siralama' },
    { s: 'artislar neler', niyet: 'siralama' },

    /* ---------- 6. Zirve / dip ---------- */
    { s: 'En yüksek üretim hangi gün oldu?', niyet: 'zirve', o: 'uretim' },
    { s: 'en yuksek uretim hangi gun', niyet: 'zirve', o: 'uretim' },
    { s: 'en cok hangi gun urettik', niyet: 'zirve', o: 'uretim' },
    { s: 'en fazla satis hangi gunde', niyet: 'zirve', o: 'satis' },
    { s: 'rekor üretim günü', niyet: 'zirve', o: 'uretim' },
    { s: 'en düşük üretim hangi gün', niyet: 'zirve', o: 'uretim' },
    { s: 'en az sattigimiz gun', niyet: 'zirve', o: 'satis' },
    { s: 'zirve gun hangisi', niyet: 'zirve' },
    { s: 'en yüksek toprak satışı hangi gün', niyet: 'zirve', mAd: 'Toprak', o: 'satis' },
    { s: 'en yuksek dokme uretimi hangi gunde oldu', niyet: 'zirve', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'en cok cuvallama hangi gun', niyet: 'zirve', o: 'cuvallama' },
    { s: 'en dusuk kuyruk uretimi hangi gun', niyet: 'zirve', mAd: 'Kuyruk', o: 'uretim' },
    { s: 'maksimum uretim gunu', niyet: 'zirve', o: 'uretim' },
    { s: 'en yogun gun hangisi', niyet: 'zirve' },

    /* ---------- 7. Belirli gün ---------- */
    { s: '15. günde ne kadar üretmişiz?', niyet: 'gun-degeri', gun: 15, o: 'uretim' },
    { s: '15. gunde ne kadar uretmisiz', niyet: 'gun-degeri', gun: 15, o: 'uretim' },
    { s: 'on beşinci günde ne kadar ürettik', niyet: 'gun-degeri', gun: 15, o: 'uretim' },
    { s: '20. günde durum neydi', niyet: 'gun-degeri', gun: 20 },
    { s: '3. gunde ne kadar toprak sattik', niyet: 'gun-degeri', gun: 3, mAd: 'Toprak', o: 'satis' },
    { s: 'birinci günde ne oldu', niyet: 'gun-degeri', gun: 1 },
    { s: '10. gunde cuvallama ne kadardi', niyet: 'gun-degeri', gun: 10, o: 'cuvallama' },
    { s: '25. günde dökme üretimi', niyet: 'gun-degeri', gun: 25, mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: '5. gunde gecen seneye gore ne durumdaydik', niyet: ['gun-degeri', 'karsilastirma'], gun: 5 },
    { s: '12. gündeki üretim', niyet: 'gun-degeri', gun: 12, o: 'uretim' },
    { s: 'onuncu gun ne kadar sattik', niyet: 'gun-degeri', gun: 10, o: 'satis' },
    { s: '7. gunde kuyruk uretimi neydi', niyet: 'gun-degeri', gun: 7, mAd: 'Kuyruk', o: 'uretim' },

    /* ---------- 8. Pencere (ilk N / son N) ---------- */
    { s: 'Son 7 günde üretim nasıl?', niyet: 'pencere', kapsam: 'son', n: 7, o: 'uretim' },
    { s: 'son 7 gunde uretim nasil', niyet: 'pencere', kapsam: 'son', n: 7, o: 'uretim' },
    { s: 'son 10 günde ne kadar sattık', niyet: 'pencere', kapsam: 'son', n: 10, o: 'satis' },
    { s: 'ilk 10 günde ne kadar ürettik', niyet: 'pencere', kapsam: 'ilk', n: 10, o: 'uretim' },
    { s: 'ilk 5 gun toplam satis', niyet: 'pencere', kapsam: 'ilk', n: 5, o: 'satis' },
    { s: 'son 15 gunde toprak satisi', niyet: 'pencere', kapsam: 'son', n: 15, mAd: 'Toprak', o: 'satis' },
    { s: 'son 3 günde çuvallama', niyet: 'pencere', kapsam: 'son', n: 3, o: 'cuvallama' },
    { s: 'ilk 20 gunde dokme uretimi', niyet: 'pencere', kapsam: 'ilk', n: 20, mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'son 5 gun nasil gecti', niyet: 'pencere', kapsam: 'son', n: 5 },
    { s: 'son yedi günde üretim', niyet: 'pencere', kapsam: 'son', n: 7, o: 'uretim' },
    { s: 'ilk on gunde kuyruk uretimi', niyet: 'pencere', kapsam: 'ilk', n: 10, mAd: 'Kuyruk', o: 'uretim' },
    { s: 'son 30 gunde atik kuspe', niyet: 'pencere', kapsam: 'son', n: 30, mAd: 'Atık Kuru Küspe' },

    /* ---------- 9. Ortalama ---------- */
    { s: 'Günlük ortalama dökme üretimi ne kadar?', niyet: 'ortalama', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'gunluk ortalama dokme uretimi ne kadar', niyet: 'ortalama', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'ortalama günde ne kadar üretiyoruz', niyet: 'ortalama', o: 'uretim' },
    { s: 'ortalama satis ne kadar', niyet: 'ortalama', o: 'satis' },
    { s: 'toprak satışı ortalaması', niyet: 'ortalama', mAd: 'Toprak', o: 'satis' },
    { s: 'gun basina cuvallama ortalamasi', niyet: 'ortalama', o: 'cuvallama' },
    { s: 'ortalama kuyruk uretimi', niyet: 'ortalama', mAd: 'Kuyruk', o: 'uretim' },
    { s: 'gunluk ortalama ne kadar sattik', niyet: 'ortalama', o: 'satis' },
    { s: 'vasati uretim', niyet: 'ortalama', o: 'uretim' },
    { s: 'ortalama dokme satis', niyet: 'ortalama', mAd: 'Dökme Kuru Küspe', o: 'satis' },

    /* ---------- 10. Stok ---------- */
    { s: 'Elimizde ne kadar toprak var?', niyet: 'stok', mAd: 'Toprak' },
    { s: 'elimizde ne kadar toprak var', niyet: 'stok', mAd: 'Toprak' },
    { s: 'stok durumu ne', niyet: 'stok' },
    { s: 'stok durumu nasil', niyet: 'stok' },
    { s: 'ne kadar stok var', niyet: 'stok' },
    { s: 'kuyruk stoğu ne kadar', niyet: 'stok', mAd: 'Kuyruk' },
    { s: 'kuyruk stogu ne kadar', niyet: 'stok', mAd: 'Kuyruk' },
    { s: 'depoda ne kadar atık küspe var', niyet: 'stok', mAd: 'Atık Kuru Küspe' },
    { s: 'elimizde ne kaldi', niyet: 'stok' },
    { s: 'mevcut stok', niyet: 'stok' },
    { s: 'çuvallı küspe stoğu', niyet: 'stok', mAd: 'Kuru Küspe (50 Kg)' },
    { s: 'stoklar ne durumda', niyet: 'stok' },
    { s: 'toprak stogumuz', niyet: 'stok', mAd: 'Toprak' },
    { s: 'elde kalan dokme kuspe', niyet: 'stok', mAd: 'Dökme Kuru Küspe' },

    /* ---------- 11. Silo ---------- */
    { s: 'Silolar ne durumda?', niyet: 'silo' },
    { s: 'silolar ne durumda', niyet: 'silo' },
    { s: 'silo durumu', niyet: 'silo' },
    { s: 'silolarda ne kadar var', niyet: 'silo' },
    { s: 'doluluk oranı ne', niyet: 'silo' },
    { s: 'doluluk orani nedir', niyet: 'silo' },
    { s: 'silolar ne kadar dolu', niyet: 'silo' },
    { s: 'silo doluluğu', niyet: 'silo' },
    { s: 'siloların durumu nasıl', niyet: 'silo' },
    { s: 'silolarda kapasite ne kadar', niyet: 'silo' },
    { s: 'silo 2 ne durumda', niyet: 'silo' },
    { s: 'silolarimiz dolu mu', niyet: 'silo' },

    /* ---------- 12. Kampanya günü ---------- */
    { s: 'Kaçıncı gündeyiz?', niyet: 'kampanya-gunu' },
    { s: 'kacinci gundeyiz', niyet: 'kampanya-gunu' },
    { s: 'kampanyanın kaçıncı günü', niyet: 'kampanya-gunu' },
    { s: 'hangi gundeyiz', niyet: 'kampanya-gunu' },
    { s: 'kampanya günü kaç', niyet: 'kampanya-gunu' },
    { s: 'bugün kaçıncı gün', niyet: 'kampanya-gunu' },
    { s: 'bugun kacinci gun', niyet: 'kampanya-gunu' },
    { s: 'kacinci gunundeyiz', niyet: 'kampanya-gunu' },
    { s: 'gun sayisi', niyet: 'kampanya-gunu' },

    /* ---------- 13. Kayıt ---------- */
    { s: 'Kaç gün veri girilmiş?', niyet: 'kayit' },
    { s: 'kac gun veri girilmis', niyet: 'kayit' },
    { s: 'kaç günlük veri var', niyet: 'kayit' },
    { s: 'kayitli gun sayisi', niyet: 'kayit' },
    { s: 'kaç gün kayıt var', niyet: 'kayit' },
    { s: 'veri girisi kac gun', niyet: 'kayit' },

    /* ---------- 14. Yardım ---------- */
    { s: 'ne sorabilirim', niyet: 'yardim' },
    { s: 'neler sorabilirim', niyet: 'yardim' },
    { s: 'yardım', niyet: 'yardim' },
    { s: 'yardim', niyet: 'yardim' },
    { s: 'ne yapabilirsin', niyet: 'yardim' },
    { s: 'örnek sorular', niyet: 'yardim' },
    { s: 'nasil kullanilir', niyet: 'yardim' },

    /* ---------- 15. Türkçe harf çiftleri: aynı anlam, iki yazım ---------- */
    { s: 'çuvallama ne kadar', niyet: 'deger', o: 'cuvallama' },
    { s: 'cuvallama ne kadar', niyet: 'deger', o: 'cuvallama' },
    { s: 'atık küspe stoğu', niyet: 'stok', mAd: 'Atık Kuru Küspe' },
    { s: 'atik kuspe stogu', niyet: 'stok', mAd: 'Atık Kuru Küspe' },
    { s: 'yaş küspe üretimi ne kadar', niyet: 'deger', o: 'uretim' },
    { s: 'yas kuspe uretimi ne kadar', niyet: 'deger', o: 'uretim' },
    { s: 'dökme küspe satışı', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'satis' },
    { s: 'dokme kuspe satisi', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'satis' },
    { s: 'geçen yıl toprak üretimi', niyet: ['deger', 'karsilastirma'], mAd: 'Toprak', o: 'uretim' },
    { s: 'gecen yil toprak uretimi', niyet: ['deger', 'karsilastirma'], mAd: 'Toprak', o: 'uretim' },

    /* ---------- 16. Yazım hataları ---------- */
    { s: 'gecen sneye gore nasil gidiyoruz', niyet: KARS },
    { s: 'toprk satisi ne kadar', niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: 'kuyrk uretimi ne kadar', niyet: 'deger', mAd: 'Kuyruk', o: 'uretim' },
    { s: 'dokme kusep uretimi', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'en cok artna kalem', niyet: 'siralama' },
    { s: 'silolar ne durmda', niyet: 'silo' },
    { s: 'kacinci gndeyiz', niyet: 'kampanya-gunu' },
    { s: 'gunluk ortlama uretim', niyet: 'ortalama', o: 'uretim' },
    { s: 'stok durmu', niyet: 'stok' },
    { s: 'son 7 gnde uretim', niyet: 'pencere', kapsam: 'son', n: 7, o: 'uretim' },

    /* ---------- 17. Karışık / uzun cümleler ---------- */
    { s: 'geçen seneye göre toprak satışında ne durumdayız acaba', niyet: KARS, mAd: 'Toprak', o: 'satis' },
    { s: 'bana geçen kampanyaya göre dökme küspe üretimini karşılaştır', niyet: KARS, mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'söyler misin geçen seneye göre nasıl ilerliyoruz', niyet: KARS },
    { s: 'merak ettim en çok hangi kalem artmış', niyet: 'siralama' },
    { s: 'acaba silolar ne durumda', niyet: 'silo' },
    { s: 'bu kampanyada toplam kac kg toprak urettik', niyet: 'deger', mAd: 'Toprak', o: 'uretim' },
    { s: 'lutfen son 7 gunun uretimini goster', niyet: 'pencere', kapsam: 'son', n: 7, o: 'uretim' },
    { s: 'kampanyanin 15 inci gununde ne kadar urettik', niyet: 'gun-degeri', gun: 15, o: 'uretim' },
    { s: 'geçen yılın aynı gününde ne kadardı', niyet: KARS },
    { s: 'bugüne kadar toplam ne kadar dökme küspe sattık', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'satis' }
  ];


  /* ==================================================================
     Karşı külliyat — motor bunlara göre YAZILMADI
     Yanlış eşleşme tuzakları, ağır çekim ekleri, konuşma dili, alan dışı
     sorular. `anlasilmamali: true` olanlar CEVAPLANMAMALIDIR; motor bunlara
     "anlayamadım" demezse test kalır. Bu grup, doğruluğun ezberden değil
     gerçekten geldiğini gösterir.
     ================================================================== */

  test.ZORLU = [
    /* --- yanlış eşleşme tuzakları --- */
    { s: 'satın aldık mı', anlasilmamali: true },
    { s: 'satın alma yaptık mı', anlasilmamali: true },
    { s: 'üretici firma kim', anlasilmamali: true },
    { s: 'kuru temizleme nerede', anlasilmamali: true },
    { s: 'silahlar nerede', anlasilmamali: true },
    { s: 'stoper kim', anlasilmamali: true },
    { s: 'gunes nasil', anlasilmamali: true },
    { s: 'artik ne yapacagiz', anlasilmamali: true },
    { s: 'hava nasıl olacak', anlasilmamali: true },
    { s: 'merhaba', anlasilmamali: true },
    { s: 'asdkjfh qwerty', anlasilmamali: true },
    { s: 'bugün maç var mı', anlasilmamali: true },
    { s: 'teşekkürler', anlasilmamali: true },
    { s: '12345', anlasilmamali: true },
    { s: 'IŞIK NE DURUMDA', anlasilmamali: true },

    /* --- ağır yazım hatası --- */
    { s: 'gcen seneye gore nasil gidiyoruz', niyet: KARS },
    { s: 'geçen seneye göre nasil ilrliyoruz', niyet: KARS },
    { s: 'toprk satsi ne kadar', niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: 'dokme kupse uretimi', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'kuyruk uretmi ne kadar', niyet: 'deger', mAd: 'Kuyruk', o: 'uretim' },
    { s: 'en cok arttan kalem', niyet: 'siralama' },
    { s: 'silolar ne dururmda', niyet: 'silo' },
    { s: 'gunlk ortalama uretim', niyet: 'ortalama', o: 'uretim' },
    { s: 'kacnci gundeyiz', niyet: 'kampanya-gunu' },
    { s: 'cuvalama ne kadar', niyet: 'deger', o: 'cuvallama' },

    /* --- çok kısa --- */
    { s: 'stok', niyet: 'stok' },
    { s: 'silo', niyet: 'silo' },
    { s: 'silolar', niyet: 'silo' },
    { s: 'toprak?', niyet: 'deger', mAd: 'Toprak' },
    { s: 'kuyruk satışı', niyet: 'deger', mAd: 'Kuyruk', o: 'satis' },
    { s: 'çuvallama', niyet: 'deger', o: 'cuvallama' },
    { s: 'doluluk', niyet: 'silo' },
    { s: 'en çok artan', niyet: 'siralama' },
    { s: 'en çok düşen', niyet: 'siralama' },
    { s: 'ortalama üretim', niyet: 'ortalama', o: 'uretim' },

    /* --- konuşma dili --- */
    { s: 'kaç ton toprak gitti', niyet: 'deger', mAd: 'Toprak' },
    { s: 'ne kadar mal çıktı', niyet: 'deger', o: 'uretim' },
    { s: 'toprakta durum ne', niyet: ['deger', 'karsilastirma', 'genel-durum'], mAd: 'Toprak' },
    { s: 'geçen seneye kıyasla iyi miyiz', niyet: KARS },
    { s: 'geçen yıla göre kötü müyüz', niyet: KARS },
    { s: 'bu sene daha mı iyiyiz', niyet: ['karsilastirma', 'genel-durum', 'deger'] },
    { s: 'silolar dolmuş mu', niyet: 'silo' },
    { s: 'depoda ne var ne yok', niyet: 'stok' },
    { s: 'işler nasıl', niyet: KARS },
    { s: 'ne alemdeyiz', niyet: KARS },

    /* --- ters sözcük sırası --- */
    { s: 'nasıl gidiyoruz geçen seneye göre', niyet: KARS },
    { s: 'ne kadar sattık toprak', niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: 'hangi gün en yüksek üretim oldu', niyet: 'zirve', o: 'uretim' },
    { s: 'üretim en yüksek hangi gün', niyet: 'zirve', o: 'uretim' },
    { s: 'gunde ortalama ne kadar uretim var', niyet: 'ortalama', o: 'uretim' },
    { s: 'satışta geçen seneye göre neredeyiz', niyet: KARS, o: 'satis' },

    /* --- karışık yazım --- */
    { s: 'gecen seneye göre toprak satisi nasıl', niyet: KARS, mAd: 'Toprak', o: 'satis' },
    { s: 'Dökme kuspe uretimi ne kadar', niyet: 'deger', mAd: 'Dökme Kuru Küspe', o: 'uretim' },
    { s: 'atik küspe stogu', niyet: 'stok', mAd: 'Atık Kuru Küspe' },
    { s: 'çuvalli kuspe satışı', niyet: 'deger', mAd: 'Kuru Küspe (50 Kg)', o: 'satis' },

    /* --- noktalama / büyük harf (Türkçe I/İ tuzağı) --- */
    { s: 'GEÇEN SENEYE GÖRE NASIL İLERLİYORUZ??', niyet: KARS },
    { s: 'silolar... ne durumda?!', niyet: 'silo' },
    { s: '  toprak   satışı   ne  kadar  ', niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: '15.gunde ne kadar urettik', niyet: 'gun-degeri', gun: 15, o: 'uretim' },
    { s: '15 . gun uretim', niyet: 'gun-degeri', gun: 15, o: 'uretim' },
    { s: 'ÜRETİM NE KADAR', niyet: 'deger', o: 'uretim' },
    { s: 'ÇUVALLAMA NE KADAR', niyet: 'deger', o: 'cuvallama' },
    { s: 'ATIK KÜSPE STOĞU', niyet: 'stok', mAd: 'Atık Kuru Küspe' },
    { s: 'atik kuspe stogu', niyet: 'stok', mAd: 'Atık Kuru Küspe' },
    { s: 'İLERLİYOR MUYUZ', niyet: KARS },

    /* --- kesme işareti --- */
    { s: "Toprak'tan ne kadar sattık", niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: "Silo 1'de ne kadar var", niyet: 'silo' },
    { s: "25'lik küspe stoğu", niyet: 'stok', mAd: "Yaş Küspe (25'lik)" },
    { s: "Silo 3'te ne kadar var?", niyet: 'silo' },

    /* --- bitişik yazım --- */
    { s: 'gecenseneye gore nasil', niyet: KARS },

    /* --- sayı tuzakları --- */
    { s: '50 kg çuval kaç adet yapıldı', niyet: ['deger', 'gun-degeri'], o: 'cuvallama' },
    { s: 'son 3 gunde toprak', niyet: 'pencere', kapsam: 'son', n: 3, mAd: 'Toprak' },
    { s: 'ilk 1 gunde ne oldu', niyet: 'pencere', kapsam: 'ilk', n: 1 },
    { s: '100. günde ne kadar üretmişiz', niyet: 'gun-degeri', gun: 100 },
    { s: 'yirmi besinci gun uretim', niyet: 'gun-degeri', gun: 25, o: 'uretim' },
    { s: '25lik kuspe ne kadar', niyet: 'deger', mAd: "Yaş Küspe (25'lik)" },
    { s: '1. günde ne kadar ürettik', niyet: 'gun-degeri', gun: 1 },
    { s: '30. günde ne kadar ürettik', niyet: 'gun-degeri', gun: 30 },
    { s: '007. gunde uretim', niyet: 'gun-degeri', gun: 7 },

    /* --- göreli zaman --- */
    { s: 'dün ne kadar ürettik', niyet: 'gun-degeri', o: 'uretim' },
    { s: 'bugün ne kadar ürettik', niyet: 'gun-degeri', o: 'uretim' },
    { s: '3 gün önce ne oldu', niyet: 'gun-degeri' },
    { s: 'bu hafta nasıl', niyet: 'pencere', kapsam: 'son', n: 7 },
    { s: 'ilk gün ne oldu', niyet: 'gun-degeri', gun: 1 },
    { s: 'son gün ne oldu', niyet: 'gun-degeri' },

    /* --- eş anlamlılar --- */
    { s: 'sevkiyat ne kadar', niyet: 'deger', o: 'satis' },
    { s: 'imalat ne kadar', niyet: 'deger', o: 'uretim' },
    { s: 'toprak sevkiyati gecen seneye gore', niyet: KARS, mAd: 'Toprak', o: 'satis' },
    { s: 'paketleme ne kadar', niyet: 'deger', o: 'cuvallama' },
    { s: 'torbalama gecen yila gore', niyet: KARS, o: 'cuvallama' },
    { s: 'fire ne kadar', niyet: 'deger', mAd: 'Atık Kuru Küspe' },
    { s: 'pancar kuyrugu uretimi', niyet: 'deger', mAd: 'Kuyruk', o: 'uretim' },

    /* --- dönem adı doğrudan --- */
    { s: '2025/2026 kampanyasında ne kadar ürettik', niyet: ['deger', 'karsilastirma'], o: 'uretim' },
    { s: '2025/2026 ile 2026/2027 karşılaştır', niyet: KARS },
    { s: '2025 2026 kampanyasi nasildi', niyet: ['karsilastirma', 'genel-durum', 'deger'] },

    /* --- ölçüt + dönem çaprazı --- */
    { s: 'geçen sene silolar ne durumdaydı', niyet: 'silo' },
    { s: 'gecen kampanyada en yuksek uretim hangi gun', niyet: 'zirve', o: 'uretim' },
    { s: 'gecen sene gunluk ortalama uretim', niyet: 'ortalama', o: 'uretim' },
    { s: 'gecen sene ilk 5 gunde ne kadar urettik', niyet: 'pencere', kapsam: 'ilk', n: 5, o: 'uretim' },
    { s: 'gecen kampanyanin 3. gunu', niyet: 'gun-degeri', gun: 3 },

    /* --- ağır çekim ekleri --- */
    { s: 'topraktakiler ne kadar', mAd: 'Toprak' },
    { s: 'kuyruğumuzdaki miktar', mAd: 'Kuyruk' },
    { s: 'küspenin durumu', niyet: ['karsilastirma', 'genel-durum', 'deger'] },
    { s: 'silonun doluluğu', niyet: 'silo' },
    { s: 'silolarımızdaki küspe', niyet: 'silo' },
    { s: 'satışlarımızda ne durumdayız', niyet: KARS, o: 'satis' },
    { s: 'üretimlerimiz nasıl gidiyor', niyet: KARS, o: 'uretim' },
    { s: 'çuvallamalarımız ne kadar', o: 'cuvallama' },
    { s: 'toprağımızdan ne kadar sattık', mAd: 'Toprak', o: 'satis' },
    { s: 'atığın üretimi', mAd: 'Atık Kuru Küspe', o: 'uretim' },
    { s: 'toprağın satışı ne kadar', niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: 'kuyruğun üretimi nasıl', niyet: ['deger', 'karsilastirma', 'genel-durum'], mAd: 'Kuyruk', o: 'uretim' },
    { s: 'topraktan ne kadar sattık', niyet: 'deger', mAd: 'Toprak', o: 'satis' },
    { s: 'küspeden ne kadar var', niyet: ['stok', 'deger'] },
    { s: 'silolardaki miktar', niyet: 'silo' },
    { s: 'satışlarımız nasıl', niyet: ['karsilastirma', 'genel-durum'], o: 'satis' },
    { s: 'üretimimiz ne durumda', niyet: ['karsilastirma', 'genel-durum'], o: 'uretim' },

    /* --- çok bileşenli --- */
    { s: 'geçen seneye göre toprak ve kuyruk nasıl', niyet: KARS },
    { s: 'en çok artan kalemi geçen seneye göre göster', niyet: ['siralama', 'karsilastirma'] },
    { s: '15. günde geçen seneye göre üretim nasıldı', niyet: ['gun-degeri', 'karsilastirma'], gun: 15 },
    { s: 'son 10 günde geçen seneye göre nasıl', niyet: ['pencere', 'karsilastirma'] },
    { s: 'ortalama üretim geçen seneye göre nasıl', niyet: ['ortalama', 'karsilastirma'] },
    { s: 'en yüksek üretim gününde ne kadar sattık', niyet: ['zirve', 'deger', 'gun-degeri'] },
    { s: 'toprak ve kuyruk nasıl', niyet: ['karsilastirma', 'genel-durum', 'deger'] },
    { s: 'yaş küspe nasıl gidiyor', niyet: ['karsilastirma', 'genel-durum'] },
    { s: 'kuru küspe ne durumda', niyet: ['karsilastirma', 'genel-durum', 'deger'] },
    { s: 'tüm malzemeler nasıl', niyet: ['karsilastirma', 'genel-durum'] },

    /* --- olumsuzluk ve soru ekleri --- */
    { s: 'hiç toprak satmadık mı', mAd: 'Toprak' },
    { s: 'üretim yapılmadı mı', o: 'uretim' },
    { s: 'silolar boş mu', niyet: 'silo' },
    { s: 'stok kalmadı mı', niyet: 'stok' },
    { s: 'üretim arttı mı', niyet: KARS, o: 'uretim' },
    { s: 'satış düştü mü', niyet: KARS, o: 'satis' },
    { s: 'toprak satışı artmış mı', niyet: KARS, mAd: 'Toprak', o: 'satis' },
    { s: 'cuvallama azalmis mi', niyet: KARS, o: 'cuvallama' },
    { s: 'daha çok mu ürettik', niyet: ['karsilastirma', 'genel-durum', 'deger'], o: 'uretim' },

    /* --- yalın malzeme + ölçüt çaprazları --- */
    { s: 'tonluk satis', mAd: 'Yaş Küspe (Tonluk)', o: 'satis' },
    { s: 'tonluk uretim', mAd: 'Yaş Küspe (Tonluk)', o: 'uretim' },
    { s: '25lik satis', mAd: "Yaş Küspe (25'lik)", o: 'satis' },
    { s: 'cuvalli satis', mAd: 'Kuru Küspe (50 Kg)', o: 'satis' },
    { s: 'dokme satis', mAd: 'Dökme Kuru Küspe', o: 'satis' },
    { s: 'atik uretim', mAd: 'Atık Kuru Küspe', o: 'uretim' },
    { s: 'kuyruk satis', mAd: 'Kuyruk', o: 'satis' },
    { s: 'toprak uretim', mAd: 'Toprak', o: 'uretim' },
    { s: 'uzun cümle olsun diye lütfen geçen seneye göre toprak satışını göster', niyet: KARS, mAd: 'Toprak', o: 'satis' }
  ];

  test.tumSorular = function () { return test.SORULAR.concat(test.ZORLU); };

  /* ==================================================================
     Koşucu
     ================================================================== */

  function adIle(depo, ad) {
    for (var i = 0; i < depo.malzemeler.length; i++) {
      if (depo.malzemeler[i].Ad === ad) return depo.malzemeler[i].Id;
    }
    return null;
  }

  function dizi(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  /* Tek soruyu çözer ve beklenenle karşılaştırır. */
  test.dene = function (depo, kayit) {
    var c = (YU.dil && YU.soru) ? YU.soru.cozTam(depo, kayit.s).cozum : null;
    var hatalar = [];
    if (!c) return { kayit: kayit, gecti: false, hatalar: ['motor yüklenmedi'], cozum: null };

    /* Tuzak sorusu: motor bunu CEVAPLAMAMALI. */
    if (kayit.anlasilmamali) {
      if (c.anlasildi) hatalar.push('cevaplanmamalıydı — niyet: ' + c.niyet + ' (puan ' + c.niyetPuani + ')');
      return { kayit: kayit, gecti: !hatalar.length, hatalar: hatalar, cozum: c };
    }

    if (!c.anlasildi) {
      hatalar.push('anlaşılmadı (niyet ' + (c.niyet || '—') + ', puan ' + c.niyetPuani + ')');
    }
    if (kayit.niyet) {
      var beklenen = dizi(kayit.niyet) ? kayit.niyet : [kayit.niyet];
      if (beklenen.indexOf(c.niyet) < 0) {
        hatalar.push('niyet: ' + (c.niyet || '—') + ' (beklenen ' + beklenen.join(' | ') + ')');
      }
    }
    if (kayit.mAd) {
      var id = adIle(depo, kayit.mAd);
      if (id === null) hatalar.push('malzeme tanımlı değil: ' + kayit.mAd);
      else if (c.malzemeIdleri.indexOf(id) < 0) {
        hatalar.push('malzeme: [' + c.malzemeIdleri.join(',') + '] (beklenen ' + kayit.mAd + '=' + id + ')');
      }
    }
    if (kayit.o && c.olcut !== kayit.o) hatalar.push('ölçüt: ' + (c.olcut || '—') + ' (beklenen ' + kayit.o + ')');
    if (kayit.gun !== undefined && c.siraGun !== kayit.gun) {
      hatalar.push('gün: ' + (c.siraGun === null ? '—' : c.siraGun) + ' (beklenen ' + kayit.gun + ')');
    }
    if (kayit.kapsam && c.kapsam !== kayit.kapsam) hatalar.push('kapsam: ' + (c.kapsam || '—') + ' (beklenen ' + kayit.kapsam + ')');
    if (kayit.n !== undefined && c.kapsamSayi !== kayit.n) {
      hatalar.push('kapsam sayısı: ' + (c.kapsamSayi === null ? '—' : c.kapsamSayi) + ' (beklenen ' + kayit.n + ')');
    }

    return { kayit: kayit, gecti: !hatalar.length, hatalar: hatalar, cozum: c };
  };

  /* Bütün külliyat. Ayrıca her soru CEVAPLANIR: cevap üretirken hata
     fırlatan bir soru testi kaldırır — çözümleme doğru olsa bile. */
  test.calistir = function (depo) {
    var sorular = test.tumSorular();
    var sonuclar = [], gecen = 0, tuzak = 0, i;
    for (i = 0; i < sorular.length; i++) {
      var s = test.dene(depo, sorular[i]);
      if (sorular[i].anlasilmamali) tuzak++;
      /* Çözümleme doğru olsa bile cevap üretirken hata çıkarsa test kalır. */
      try {
        var cevap = YU.soru.cevapla(depo, sorular[i].s);
        s.cevap = cevap;
        if (!cevap || !cevap.baslik) {
          s.gecti = false;
          s.hatalar = s.hatalar.concat(['cevap üretilemedi']);
        }
      } catch (e) {
        s.gecti = false;
        s.hatalar = s.hatalar.concat(['cevap hatası: ' + (e && e.message ? e.message : String(e))]);
      }
      if (s.gecti) gecen++;
      sonuclar.push(s);
    }
    return {
      sonuclar: sonuclar,
      toplam: sorular.length,
      gecen: gecen,
      kalan: sorular.length - gecen,
      tuzak: tuzak,
      sozlukTerimi: YU.soru.sozluk(depo).terimSayisi,
      oran: sorular.length ? gecen / sorular.length : 0
    };
  };


  /* ==================================================================
     Ekran — Yönetim Paneli > Soru Testleri
     Doğruluk iddiası ekranda ÖLÇÜLÜR. Kalan testler ayrıntısıyla listelenir;
     böylece bir düzenleme motoru bozarsa hemen görünür.
     ================================================================== */

  function ozetKartlari(r) {
    var oran = r.toplam ? (r.gecen / r.toplam) * 100 : 0;
    return YU.h('div', { sinif: 'yu-izgara yu-iz-4' },
      YU.ui.kpi({
        etiket: 'Doğruluk', ikon: '#ic-percent',
        renk: r.kalan === 0 ? 'olumlu' : (oran >= 95 ? 'bekleyen' : 'olumsuz'),
        deger: YU.fmt.yuzde(oran), alt: YU.fmt.sayi(r.gecen) + ' / ' + YU.fmt.sayi(r.toplam) + ' soru'
      }),
      YU.ui.kpi({ etiket: 'Geçen', ikon: '#ic-up', renk: 'olumlu', deger: YU.fmt.sayi(r.gecen), alt: 'beklenen sonucu verdi' }),
      YU.ui.kpi({
        etiket: 'Kalan', ikon: '#ic-alert', renk: r.kalan ? 'olumsuz' : 'notr',
        deger: YU.fmt.sayi(r.kalan), alt: r.kalan ? 'aşağıda listelendi' : 'kalan yok'
      }),
      YU.ui.kpi({
        etiket: 'Tuzak Soruları', ikon: '#ic-checklist', renk: 'vurgu',
        deger: YU.fmt.sayi(r.tuzak), alt: 'cevaplanmaması gereken sorular'
      })
    );
  }

  function sonucTablosu(sonuclar, yalnizKalan) {
    var satirlar = [], i;
    for (i = 0; i < sonuclar.length; i++) {
      var s = sonuclar[i];
      if (yalnizKalan && s.gecti) continue;
      var c = s.cozum;
      satirlar.push({
        vurgu: s.gecti ? null : 'olumsuz',
        hucreler: [
          YU.h('span', { metin: s.kayit.s }),
          s.kayit.anlasilmamali ? YU.ui.rozet('cevaplanmamalı', 'notr')
            : YU.h('span', { sinif: 'yu-zayif', metin: beklenenMetni(s.kayit) }),
          YU.h('span', { sinif: 'yu-zayif', metin: c ? ((c.niyet || '—') + (c.anlasildi ? '' : ' (anlaşılmadı)')) : '—' }),
          s.gecti ? YU.ui.rozet('GEÇTİ', 'olumlu') : YU.ui.rozet('KALDI', 'olumsuz'),
          YU.h('span', { sinif: 'yu-zayif', metin: s.hatalar.join(' · ') })
        ]
      });
    }
    return YU.ui.tablo({
      sutunlar: [
        { baslik: 'Soru', genislik: 330 },
        { baslik: 'Beklenen', genislik: 190 },
        { baslik: 'Çıkan', genislik: 150 },
        { baslik: 'Sonuç', genislik: 90 },
        { baslik: 'Ayrıntı' }
      ],
      satirlar: satirlar,
      bos: yalnizKalan ? 'Kalan test yok — külliyatın tamamı geçti.' : 'Test yok.',
      yapiskan: true
    });
  }

  function beklenenMetni(kayit) {
    var p = [];
    if (kayit.niyet) p.push(dizi(kayit.niyet) ? kayit.niyet.join('|') : kayit.niyet);
    if (kayit.mAd) p.push(kayit.mAd);
    if (kayit.o) p.push(kayit.o);
    if (kayit.gun !== undefined) p.push(kayit.gun + '. gün');
    if (kayit.kapsam) p.push(kayit.kapsam + ' ' + (kayit.n === undefined ? '' : kayit.n));
    return p.join(' · ') || '—';
  }

  function ciz(kap) {
    var depo = YU.db;
    if (!depo) return;

    var kutu = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '20px' } });
    var yalnizKalan = true;

    function calistirVeCiz() {
      YU.bos(kutu);
      var r = test.calistir(depo);

      kutu.appendChild(ozetKartlari(r));

      var sekme = YU.ui.sekmeler({
        sekmeler: [{ kod: 'kalan', metin: 'Kalanlar' }, { kod: 'hepsi', metin: 'Tüm Sorular' }],
        aktif: yalnizKalan ? 'kalan' : 'hepsi',
        onDegis: function (kod) { yalnizKalan = kod === 'kalan'; calistirVeCiz(); }
      });

      kutu.appendChild(YU.ui.panel({
        baslik: yalnizKalan ? 'Kalan Testler' : 'Tüm Sorular',
        ikon: '#ic-checklist',
        sag: YU.fmt.sayi(r.toplam) + ' soru · ' + YU.fmt.sayi(r.sozlukTerimi) + ' sözlük terimi',
        dolgusuz: true,
        govde: [
          YU.h('div', { stil: { padding: '12px 18px 0' } }, sekme),
          sonucTablosu(r.sonuclar, yalnizKalan)
        ]
      }));
    }

    YU.ui.sayfaEylemleri(YU.ui.dugme({
      metin: 'Yeniden Çalıştır', ikon: '#ic-checklist', tur: 'birincil',
      onClick: calistirVeCiz
    }));

    calistirVeCiz();
    kap.appendChild(kutu);
  }

  YU.sayfaTanimla({
    kod: 'soru-testleri',
    baslik: 'Soru Testleri',
    ikon: '#ic-checklist',
    grup: 'Yönetim',
    rol: 'Yonetici',
    altBaslik: function () {
      return YU.fmt.sayi(test.tumSorular().length) +
        ' soruluk külliyat · niyet, malzeme, ölçüt, gün ve kapsam ayrı ayrı denetlenir · depoya dokunulmaz';
    },
    ciz: ciz
  });
})();

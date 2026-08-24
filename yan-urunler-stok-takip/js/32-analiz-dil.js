/* js/32-analiz-dil.js — Türkçe dil araçları (YU.dil).

   Analizler ekranındaki soru kutusunun anlama katmanı. Kütüphane yok
   (SOZLESME §0 "sıfır bağımlılık"), tarayıcıda çalışır, rastgelelik yok
   (§11) — aynı soru her zaman aynı sonucu verir.

   ------------------------------------------------------------------
   Tasarım kararı 1 — Türkçe harf kullanılmaması hata değildir
   ------------------------------------------------------------------
   (kullanıcı isteği, 23.08.2026) "gecen sene" ile "geçen sene", "dokme
   kuspe" ile "dökme küspe", "atik" ile "atık" AYNI kelimedir. Bunu tek
   tek eşleme listesiyle değil METNİ KATLAYARAK yaparız: bütün metin ASCII
   karşılığına indirgenir, karşılaştırma orada olur. Kullanıcı hangi
   klavyeyle yazarsa yazsın aynı yere düşer. 'I' ve 'İ' de aynı yere
   düşer — "IŞIK", "ışık", "isik" üçü de "isik" olur.

   ------------------------------------------------------------------
   Tasarım kararı 2 — eşleştirme KÖK üzerinden değil, GÖVDE üzerinden
   ------------------------------------------------------------------
   İlk deneme kelimeyi köke indirip kökleri karşılaştırıyordu; iki yerde
   kırıldı (23.08.2026 ölçümü):
     * Ek atma kendi içinde tutarsızdı: "kampanya" -> "kampa" ama
       "kampanyada" -> "kampan". Aynı kelimenin iki farklı kökü olamaz.
     * Yazım hatası kök üzerinde ölçülünce kayboluyordu: "urtim" ile
       "uretim" arasındaki tek harflik fark, kök "uret"e inince 2 harfe
       çıkıyor ve eşik aşılıyordu.
   Türkçe eklemeli bir dildir: ekler SONA gelir. O yüzden asıl ölçüt ÖN EK
   İLİŞKİSİDİR — "satis" terimi "satislarimiz" kelimesinin başındadır.
   Ünsüz yumuşaması (toprak -> toprağı, kuyruk -> kuyruğu) bu ilişkiyi
   bozar; terimin son ünsüzü yumuşatılarak ikinci bir deneme yapılır.
   Ek atma yalnızca son çare olarak, sabit noktaya kadar (kendi içinde
   tutarlı) uygulanır.

   Katman sırası:
     katla     — İ/I/ı/ğ/ş/ç/ö/ü/â → ASCII, küçük harf
     kelimeler — belirteç dizisi (sayı ve sıra sayısı işaretlenir)
     yumusat   — son ünsüz yumuşaması (k→g, p→b, t→d)
     kok       — temkinli ek atma, sabit noktaya kadar
     uzaklik   — Damerau-Levenshtein (harf devriği dahil: "satsi" ~ "satis")
     puan      — iki gövdenin benzerliği, 0..1
     Sozluk    — çok kelimeli terimleri tanıyan eşleştirici; en uzun ve en
                 yüksek puanlı eşleşme kazanır, eşleşen kelimeler tüketilir. */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});
  var dil = YU.dil = {};

  /* ==================================================================
     1. Katlama — bütün Türkçe harfler ASCII karşılığına iner
     ================================================================== */

  /* NFD ayrıştırması ğ/ş/ç/ö/ü/â harflerini "taban harf + işaret" hâline
     getirir; işaretler silinince taban harf kalır. 'ı' ayrı bir harftir,
     ayrışmaz — elle çevrilir. 'İ' küçüldüğünde 'i' + birleşen nokta olur,
     o nokta da işaret temizliğinde düşer. */
  var ISARET = /[\u0300-\u036f]/g;

  dil.katla = function (metin) {
    if (metin === null || metin === undefined) return '';
    var s = String(metin).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(ISARET, '');
    else s = s.replace(/[ğĞ]/g, 'g').replace(/[şŞ]/g, 's')
              .replace(/[çÇ]/g, 'c').replace(/[öÖ]/g, 'o')
              .replace(/[üÜ]/g, 'u').replace(/[âÂ]/g, 'a')
              .replace(/[îÎ]/g, 'i').replace(/[ûÛ]/g, 'u');
    return s.replace(/ı/g, 'i').replace(/İ/g, 'i');
  };

  /* ==================================================================
     2. Belirteçleme
     ================================================================== */

  /* Kesme işaretinin her türü ("Silo'ya", "25'lik") kelimeyi bölmez;
     ek doğrudan gövdeye yapışır ve ön ek ilişkisine devredilir. */
  var KESME = /[\x27`´‘’]/g;

  /* Binlik nokta önce temizlenir: "1.284.500" tek sayıdır. Ondalık virgül
     nokta yapılır. Kalan "15." biçimi sıra sayısı işaretidir. */
  function sayilariDuzelt(s) {
    s = s.replace(/(\d)[.](?=\d{3}(\D|$))/g, '$1');
    s = s.replace(/(\d),(\d)/g, '$1.$2');
    return s;
  }

  var SIRA_EKI = /^(inci|nci|uncu|ncu|ici|ci|cu|inc|nc)$/;

  /* Yazıyla sayılar. Bileşik sayı ("on bes" = 15) kelimeler() içinde toplanır. */
  var SAYI_ADI = {
    sifir: 0, bir: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7, sekiz: 8, dokuz: 9,
    on: 10, yirmi: 20, otuz: 30, kirk: 40, elli: 50, altmis: 60, yetmis: 70, seksen: 80, doksan: 90,
    yuz: 100, bin: 1000
  };

  var SIRA_ADI = {
    birinci: 1, ikinci: 2, ucuncu: 3, dorduncu: 4, besinci: 5, altinci: 6, yedinci: 7,
    sekizinci: 8, dokuzuncu: 9, onuncu: 10, onbirinci: 11, onikinci: 12, onucuncu: 13,
    ondorduncu: 14, onbesinci: 15, yirminci: 20, otuzuncu: 30, kirkinci: 40,
    ellinci: 50, altmisinci: 60, yetmisinci: 70, sekseninci: 80, doksaninci: 90, yuzuncu: 100
  };

  /* Belirteç: {ham, kat, kok, sayi, sira}
       sayi — sayısal değer (yazıyla ya da rakamla), yoksa null
       sira — sıra sayısı mı ("15.", "besinci")
     Not: "ilk" sayı sayılmaz; "ilk 10 gün" ile "10. gün" farklı şeylerdir,
     ayrımı sözlükteki `kapsam` kavramı yapar. */
  dil.kelimeler = function (metin) {
    var kat = dil.katla(metin).replace(KESME, '');
    kat = sayilariDuzelt(kat);
    /* Harf, rakam ve yüzde dışındaki her şey ayraçtır; sıra noktası ayrı
       belirteç olarak korunur ki "15" ile "15." ayrışsın. */
    var ham = kat.replace(/(\d)\s*\.(?!\d)/g, '$1 . ').replace(/[^a-z0-9%.]+/g, ' ');
    var parcalar = ham.split(/\s+/);
    var liste = [], i, p;

    for (i = 0; i < parcalar.length; i++) {
      p = parcalar[i];
      if (!p || p === '.') {
        if (p === '.' && liste.length && liste[liste.length - 1].sayi !== null) {
          liste[liste.length - 1].sira = true;      /* önceki sayıyı sıra sayısına çevirir */
        }
        continue;
      }
      if (p === '%') { liste.push(belirtec('%', '%', null, false)); continue; }

      var m = /^(\d+(?:\.\d+)?)(.*)$/.exec(p);
      if (m) {
        var deger = parseFloat(m[1]);
        var kalan = m[2] || '';
        var siraMi = SIRA_EKI.test(kalan);
        liste.push(belirtec(p, m[1], isFinite(deger) ? deger : null, siraMi));
        /* "50kg" gibi bitişik yazımda birim ayrı belirteç olur. */
        if (kalan && !siraMi) liste.push(belirtec(kalan, kalan, null, false));
        continue;
      }
      if (p === 'yuzde') { liste.push(belirtec(p, '%', null, false)); continue; }
      liste.push(belirtec(p, p, null, false));
    }

    yaziylaSayilar(liste);
    return liste;
  };

  function belirtec(ham, kat, sayi, sira) {
    return { ham: ham, kat: kat, kok: dil.kok(kat), sayi: sayi === undefined ? null : sayi, sira: !!sira };
  }

  function kendinin(nesne, anahtar) {
    return Object.prototype.hasOwnProperty.call(nesne, anahtar);
  }

  /* Yazıyla sayılar sayısal değere çevrilir; "on bes" gibi bileşikler
     birleştirilip tek belirtece indirilir. */
  function yaziylaSayilar(liste) {
    var i, k;
    for (i = 0; i < liste.length; i++) {
      k = liste[i];
      if (k.sayi !== null) continue;
      if (kendinin(SIRA_ADI, k.kat)) { k.sayi = SIRA_ADI[k.kat]; k.sira = true; continue; }
      if (kendinin(SAYI_ADI, k.kat)) k.sayi = SAYI_ADI[k.kat];
    }
    /* "on bes" / "yirmi besinci" — onlar basamağı + birler basamağı */
    for (i = 0; i < liste.length - 1; i++) {
      var a = liste[i], b = liste[i + 1];
      if (a.sayi === null || b.sayi === null) continue;
      if (a.sira || a.sayi < 10 || a.sayi % 10 !== 0 || a.sayi > 90) continue;
      if (b.sayi < 1 || b.sayi > 9) continue;
      a.sayi = a.sayi + b.sayi;
      a.sira = a.sira || b.sira;
      a.ham = a.ham + ' ' + b.ham;
      a.kat = String(a.sayi);
      a.kok = a.kat;
      liste.splice(i + 1, 1);
    }
  }

  /* ==================================================================
     3. Ünsüz yumuşaması
     Türkçede sert ünsüzle biten sözcük ünlüyle başlayan ek alınca yumuşar:
       toprak -> toprağı   kuyruk -> kuyruğu   kitap -> kitabı
     Katlamadan sonra ğ zaten g'dir; terimin son ünsüzünü yumuşatınca ön ek
     ilişkisi yeniden kurulur ("toprag" + "i" = "topragi").
     ================================================================== */

  var YUMUSAK = { k: 'g', p: 'b', t: 'd' };

  dil.yumusat = function (s) {
    if (!s || s.length < 3) return s;
    var son = s.charAt(s.length - 1);
    return kendinin(YUMUSAK, son) ? s.slice(0, s.length - 1) + YUMUSAK[son] : s;
  };

  /* ==================================================================
     4. Ek atma — son çare, sabit noktaya kadar
     Kendi içinde TUTARLI olmak zorundadır: "kampanya" ile "kampanyada"
     aynı gövdeye inmelidir. Bunu sağlamak için döngü, artık ek atılamayana
     kadar sürer (sabit nokta) — sabit sayıda tur değil.
     Tek harflik ek atılmaz: en çok zararı onlar veriyordu.
     ================================================================== */

  var EKLER = [
    'lerinden', 'larindan', 'lerimizi', 'larimizi', 'lerinize', 'larinize',
    'lerinde', 'larinda', 'lerimiz', 'larimiz', 'leriniz', 'lariniz',
    'lerini', 'larini', 'lerine', 'larina', 'lerden', 'lardan',
    'iyoruz', 'uyoruz', 'iyorum', 'uyorum', 'iyorlar', 'uyorlar',
    'ecegiz', 'acagiz', 'ecekler', 'acaklar', 'mistir', 'mustur',
    'siniz', 'sunuz', 'lerin', 'larin', 'lerde', 'larda',
    'imiz', 'umuz', 'iniz', 'unuz', 'iyor', 'uyor', 'ecek', 'acak',
    'erek', 'arak', 'ince', 'unca', 'iken', 'meli', 'mali',
    'mesi', 'masi', 'meye', 'maya', 'nden', 'ndan', 'leri', 'lari', 'lere', 'lara',
    'ler', 'lar', 'nin', 'nun', 'den', 'dan', 'ten', 'tan', 'mis', 'mus',
    'dik', 'duk', 'tik', 'tuk', 'dim', 'dum', 'tim', 'tum', 'mek', 'mak',
    'lik', 'luk', 'siz', 'suz', 'tir', 'tur', 'dir', 'dur',
    'de', 'da', 'te', 'ta', 'in', 'un', 'im', 'um', 'iz', 'uz',
    'ni', 'nu', 'na', 'ne', 'yi', 'yu', 'ya', 'ye', 'di', 'du', 'ti', 'tu',
    'li', 'lu', 'ci', 'cu', 'me', 'ma', 'ir', 'ur', 'er', 'ar'
  ];

  var EN_KISA_GOVDE = 4;

  dil.kok = function (kat) {
    if (!kat) return '';
    var s = String(kat);
    if (/[0-9%]/.test(s)) return s;
    var guvenlik = 0;
    while (s.length > EN_KISA_GOVDE && guvenlik++ < 8) {
      var kesildi = false;
      for (var i = 0; i < EKLER.length; i++) {
        var ek = EKLER[i];
        if (s.length - ek.length < EN_KISA_GOVDE) continue;
        if (s.slice(s.length - ek.length) !== ek) continue;
        s = s.slice(0, s.length - ek.length);
        kesildi = true;
        break;
      }
      if (!kesildi) break;
    }
    return s;
  };

  /* ==================================================================
     5. Yazım hatası toleransı — Damerau-Levenshtein
     Harf devriği tek işlem sayılır: "satsi" ~ "satis", "kusep" ~ "kuspe".
     ================================================================== */

  dil.uzaklik = function (a, b, tavan) {
    a = String(a); b = String(b);
    if (a === b) return 0;
    var n = a.length, m = b.length;
    if (tavan === undefined || tavan === null) tavan = Math.max(n, m);
    if (Math.abs(n - m) > tavan) return tavan + 1;
    if (!n) return m;
    if (!m) return n;

    var onceki = [], simdi = [], oncekinin = [], i, j;
    for (j = 0; j <= m; j++) onceki[j] = j;

    for (i = 1; i <= n; i++) {
      simdi = [i];
      var satirEnAz = i;
      for (j = 1; j <= m; j++) {
        var bedel = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        var d = Math.min(simdi[j - 1] + 1, onceki[j] + 1, onceki[j - 1] + bedel);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
          d = Math.min(d, oncekinin[j - 2] + 1);
        }
        simdi[j] = d;
        if (d < satirEnAz) satirEnAz = d;
      }
      if (satirEnAz > tavan) return tavan + 1;
      oncekinin = onceki;
      onceki = simdi;
    }
    return onceki[m];
  };

  /* Kelime uzadıkça tolerans artar; kısa kelimede hata payı yok — "ay" ile
     "az", "gun" ile "gum" karışmasın.
     Eşik KISA kelimeye göre hesaplanır: uzun tarafa göre hesaplanınca kısa
     kelimeler alakasız uzun terimlere yapışıyordu ("silahlar" -> "silolar",
     23.08.2026 ölçümü). */
  dil.esik = function (uzunluk) {
    if (uzunluk <= 3) return 0;
    if (uzunluk <= 7) return 1;
    if (uzunluk <= 11) return 2;
    return 3;
  };

  /* Son harfte YER DEĞİŞTİRME, Türkçede yazım hatasından çok BAŞKA KELİME
     demektir: "satın"/"satış", "kuru"/"kuru". Silme, ekleme ve harf devriği
     gerçek yazım hatası kalıplarıdır; onlar serbest bırakılır.
     ("satın aldık" satış sayılıyordu — 23.08.2026 ölçümü.) */
  function sonHarfDegisimi(a, b) {
    if (a.length !== b.length || !a.length) return false;
    var farkli = -1;
    for (var i = 0; i < a.length; i++) {
      if (a.charAt(i) === b.charAt(i)) continue;
      if (farkli >= 0) return false;
      farkli = i;
    }
    return farkli === a.length - 1;
  }

  /* ------------------------------------------------------------------
     Katı kelimeler — yalnızca BİREBİR eşleşir, yazım hatası toleransı yok.
     Türkçede sık geçen ama bu uygulamanın sözlüğüne bir harf uzaklıkta olan
     kelimeler. Bunlar olmadan "satın" satışa, "artık" artışa, "üretici"
     üretime, "ışık" bir şeye yapışıyordu (23.08.2026 ölçümü).
     Liste, alan dışı kelimeleri kapsar; sözlükteki terimlerin kendisi burada
     yer almaz. Birebir geçen çok kelimeli terimler bu listeden etkilenmez.
     ------------------------------------------------------------------ */
  var KATI = ('artik artan+ satin satim satici alim aldik alalim uretici ureten uretici+ ' +
    'isik isigi silah silahlar solo stop stoper stopaj sopa ' +
    'kim kime kimin kimi nerede nereye nereden neden niye nicin nasilsin ' +
    'merhaba selam tesekkur tesekkurler sagol gunaydin iyi gunler ' +
    'firma sirket temizleme temiz hava yagmur ruzgar gunes mac maci takim ' +
    'yapildi yapilan yaptik yapmak yapan yapacagiz olacak oldu olur olmaz ' +
    'sene yil ay hafta saat dakika kisi adam bey hanim ' +
    'kuru bos dolu acik kapali buyuk kucuk uzun kisa yeni eski').split(/\s+/);

  var KATI_KUME = {};
  for (var ki = 0; ki < KATI.length; ki++) {
    if (KATI[ki] && KATI[ki].indexOf('+') < 0) KATI_KUME[KATI[ki]] = true;
  }

  dil.katiMi = function (kelime) {
    return Object.prototype.hasOwnProperty.call(KATI_KUME, kelime);
  };

  /* ------------------------------------------------------------------
     puan(kelime, terim) — 0 alakasız, 1 birebir.
     Sıra: birebir > ön ek > yumuşamalı ön ek > ters ön ek > yazım hatası
           > kök eşitliği (son çare).
     ------------------------------------------------------------------ */

  var EN_UZUN_ARTIK = 8;     /* "satis" + "larimiz" gibi ek yığını bu kadar olabilir */

  function onEkPuani(kelime, terim) {
    if (terim.length < 3) return 0;                     /* "bu", "en", "ne" birebir olmalı */
    if (kelime.length <= terim.length) return 0;
    if (kelime.indexOf(terim) !== 0) return 0;
    var artik = kelime.length - terim.length;
    if (artik > EN_UZUN_ARTIK) return 0;
    if (artik > 4 && terim.length < 5) return 0;        /* kısa terime uzun kuyruk takılmaz */
    return 0.99 - artik * 0.01;
  }

  /* Yazım hatası denemesi. Katı kelimelerde ve son harf değişiminde kapalı. */
  function hataPuani(kelime, terim, taban) {
    var tol = dil.esik(Math.min(kelime.length, terim.length));
    if (!tol) return 0;
    var d = dil.uzaklik(kelime, terim, tol);
    if (d > tol) return 0;
    if (d === 1 && sonHarfDegisimi(kelime, terim)) return 0;
    return taban - (d - 1) * 0.07;
  }

  dil.puan = function (kelime, terim) {
    if (!kelime || !terim) return 0;
    if (kelime === terim) return 1;
    if (/[0-9%]/.test(kelime) || /[0-9%]/.test(terim)) return 0;

    /* Ön ek ilişkisi: Türkçe eklemeli bir dildir, ekler sona gelir.
       Bu yol yazım hatası değil dilbilgisidir; katı kelimeler için de açıktır
       ancak katı kelimeler zaten terimin başına oturmuyorsa eşleşmez. */
    var p = onEkPuani(kelime, terim);
    if (p) return p;

    var yumusak = dil.yumusat(terim);
    if (yumusak !== terim) {
      p = onEkPuani(kelime, yumusak);
      if (p) return p - 0.01;
    }

    /* Alan dışı sık kelimeler buradan sonrasına geçmez. */
    if (dil.katiMi(kelime)) return 0;

    p = hataPuani(kelime, terim, 0.87);
    if (p) return p;
    if (yumusak !== terim) {
      p = hataPuani(kelime, yumusak, 0.86);
      if (p) return p;
    }

    /* Son çare: ek yığını + yazım hatası birlikteyse gövdeler karşılaştırılır. */
    var kK = dil.kok(kelime), kT = dil.kok(terim);
    if (kK === kT && kK.length >= EN_KISA_GOVDE) return 0.84;
    if (kK.length >= 5 && kT.length >= 5) {
      p = hataPuani(kK, kT, 0.82);
      if (p) return p;
    }
    return 0;
  };

  /* ==================================================================
     6. Sözlük — çok kelimeli terimleri tanıyan eşleştirici
     Girdi:  [{kavram, deger, terimler:['gecen sene', ...], agirlik, tam}]
     Çıktı:  metindeki eşleşmeler. En uzun ve en yüksek puanlı olan kazanır;
             eşleşen kelimeler tüketilir, üst üste binme olmaz.
     `tam: true` — yazım hatası toleransı kapalı (kısa ya da kritik terim).
     ================================================================== */

  var EN_UZUN_TERIM = 5;      /* kaç kelimeye kadar tek terim aranır */
  var EN_AZ_PUAN = 0.80;      /* bunun altındaki benzerlik eşleşme sayılmaz */
  var UZUNLUK_ODULU = 0.5;    /* çok kelimeli terim tek kelimeliyi yenmeli */

  dil.Sozluk = function (girdiler) {
    var terimler = [], i, j, p;

    for (i = 0; i < (girdiler || []).length; i++) {
      var g = girdiler[i];
      if (!g || !g.terimler) continue;
      for (j = 0; j < g.terimler.length; j++) {
        var parcalar = dil.katla(g.terimler[j]).replace(KESME, '').split(/[^a-z0-9%]+/);
        var govde = [];
        for (p = 0; p < parcalar.length; p++) if (parcalar[p]) govde.push(parcalar[p]);
        if (!govde.length) continue;
        terimler.push({
          kavram: g.kavram,
          deger: g.deger,
          ek: g.ek === undefined ? null : g.ek,
          agirlik: g.agirlik === undefined ? 1 : g.agirlik,
          tam: g.tam === true,
          kelimeler: govde,
          uzunluk: govde.length
        });
      }
    }
    terimler.sort(function (a, b) { return b.uzunluk - a.uzunluk; });

    /* Bir terimin belirli konumdaki eşleşme puanı; tutmazsa 0. */
    function terimPuani(terim, kelimeler, bas) {
      if (bas + terim.uzunluk > kelimeler.length) return 0;
      var toplam = 0;
      for (var t = 0; t < terim.uzunluk; t++) {
        var kelime = kelimeler[bas + t];
        var hedef = terim.kelimeler[t];
        var puan;
        if (kelime.kat === hedef) puan = 1;
        else if (terim.tam) return 0;
        else puan = dil.puan(kelime.kat, hedef);
        if (puan < EN_AZ_PUAN) return 0;
        toplam += puan;
      }
      return (toplam / terim.uzunluk) + (terim.uzunluk - 1) * UZUNLUK_ODULU;
    }

    /* Bitişik yazım: "gecenseneye" tek kelime gelir ama iki kelimelik bir
       terimdir. Eşleşmeyen uzun kelime her yerinden ikiye bölünüp iki
       kelimelik terimlerle denenir. Ceza uygulanır: bölerek bulunan eşleşme,
       düzgün yazılmış eşleşmeyi yenmemeli. */
    var BOLME_CEZASI = 0.25;

    function bolerekAra(kelime) {
      var k = kelime.kat;
      if (!k || k.length < 7 || /[0-9%]/.test(k)) return null;
      var enIyi = null, enIyiPuan = 0, kes, t;
      for (kes = 3; kes <= k.length - 3; kes++) {
        var iki = [{ kat: k.slice(0, kes) }, { kat: k.slice(kes) }];
        for (t = 0; t < terimler.length; t++) {
          if (terimler[t].uzunluk !== 2) continue;
          var p = terimPuani(terimler[t], iki, 0);
          if (p > enIyiPuan) { enIyiPuan = p; enIyi = terimler[t]; }
        }
      }
      return enIyi ? { terim: enIyi, puan: enIyiPuan - BOLME_CEZASI } : null;
    }

    return {
      terimSayisi: terimler.length,
      bul: function (kelimeler) {
        var tuketildi = [], sonuc = [], b, t, c, k;
        for (b = 0; b < kelimeler.length; b++) tuketildi.push(false);

        for (b = 0; b < kelimeler.length; b++) {
          if (tuketildi[b]) continue;
          var enIyi = null, enIyiPuan = 0;
          for (t = 0; t < terimler.length; t++) {
            var terim = terimler[t];
            if (terim.uzunluk > EN_UZUN_TERIM) continue;
            var cakisti = false;
            for (c = 0; c < terim.uzunluk && b + c < kelimeler.length; c++) {
              if (tuketildi[b + c]) { cakisti = true; break; }
            }
            if (cakisti) continue;
            var puan = terimPuani(terim, kelimeler, b);
            if (puan > enIyiPuan) { enIyiPuan = puan; enIyi = terim; }
          }

          var bolundu = false;
          if (!enIyi) {
            var aday = bolerekAra(kelimeler[b]);
            if (aday && aday.puan > 0) { enIyi = aday.terim; enIyiPuan = aday.puan; bolundu = true; }
          }
          if (!enIyi) continue;

          var uzunluk = bolundu ? 1 : enIyi.uzunluk;
          for (k = 0; k < uzunluk; k++) tuketildi[b + k] = true;
          sonuc.push({
            kavram: enIyi.kavram,
            deger: enIyi.deger,
            ek: enIyi.ek,
            agirlik: enIyi.agirlik,
            bas: b,
            bit: b + uzunluk - 1,
            puan: enIyiPuan,
            bolundu: bolundu,
            metin: enIyi.kelimeler.join(' ')
          });
        }
        return sonuc;
      }
    };
  };

  /* ==================================================================
     7. Eşleşme yardımcıları
     ================================================================== */

  /* Kavrama göre gruplar: {olcut:[...], donem:[...]} */
  dil.grupla = function (eslesmeler) {
    var g = {}, i;
    for (i = 0; i < (eslesmeler || []).length; i++) {
      var e = eslesmeler[i];
      (g[e.kavram] || (g[e.kavram] = [])).push(e);
    }
    return g;
  };

  dil.ilk = function (grup, kavram) {
    var l = grup && grup[kavram];
    return l && l.length ? l[0] : null;
  };

  dil.deger = function (grup, kavram, varsayilan) {
    var e = dil.ilk(grup, kavram);
    return e ? e.deger : (varsayilan === undefined ? null : varsayilan);
  };

  dil.icerir = function (grup, kavram, deger) {
    var l = grup && grup[kavram];
    if (!l) return false;
    if (deger === undefined) return true;
    for (var i = 0; i < l.length; i++) if (l[i].deger === deger) return true;
    return false;
  };

  /* Eşleşmenin metindeki konumu — hangi kavram önce geçti sorusuna cevap. */
  dil.sirala = function (eslesmeler) {
    return (eslesmeler || []).slice().sort(function (a, b) { return a.bas - b.bas; });
  };
})();

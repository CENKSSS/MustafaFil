/* js/34-analiz-soru.js — Soru çözümleme ve cevap üretimi (YU.soru).

   Analizler ekranındaki soru kutusunun beyni. Üç aşama:

     1. SÖZLÜK   Sorudaki kelimeler kavramlara çevrilir (YU.dil.Sozluk).
                 Sözlük depodan beslenir: malzeme adları veritabanından
                 gelir, yeni malzeme eklenince soru kutusu onu da tanır.
     2. ÇÖZÜMLEME Kavram kümesinden NİYET puanlanarak seçilir. Kalıp
                 eşleştirme YOKTUR — "geçen seneye göre toprak satışı
                 nasıl" ile "toprakta gecen yila kiyasla ne durumdayiz"
                 aynı kavram kümesini üretir, aynı niyete düşer.
     3. CEVAP    Rakamlar YU.analiz'den alınır (ekranın kullandığı aynı
                 hesap), cümle şablona dökülür, yanına grafik tanımı
                 üretilir. Bu katman SAYI ÜRETMEZ, yalnızca biçimler.

   Kural (KURAL 4): cevapta geçen her rakam depodan hesaplanır. Veri yoksa
   "veri yok" denir; boşluk tahminle doldurulmaz. */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});
  var soru = YU.soru = {};

  var RENK_BU = 'var(--vurgu)';
  var RENK_GECMIS = 'var(--olumsuz)';

  /* ==================================================================
     1. Biçimleme yardımcıları
     ================================================================== */

  function miktar(v, birim) {
    if (v === null || v === undefined || !isFinite(Number(v))) return 'veri yok';
    return birim === 'adet' ? YU.fmt.sayi(v) + ' adet' : YU.fmt.kgU(v);
  }

  function isaretli(v, birim) {
    var isaret = v > 0 ? '+' : (v < 0 ? '-' : '');
    return isaret + miktar(Math.abs(v), birim);
  }

  /* Ortalama bölme sonucudur; "22.971,429 kg" gibi üç ondalık okunmaz.
     Veri katmanı değeri tam tutar, ekranda tam sayıya yuvarlanır. */
  function ortalamaMetni(v, birim) {
    if (v === null || v === undefined || !isFinite(Number(v))) return 'veri yok';
    return miktar(Math.round(Number(v)), birim);
  }

  function yuzdeMetni(p) {
    if (p === null || !isFinite(p)) return null;
    return (p > 0 ? '+' : (p < 0 ? '-' : '')) + YU.fmt.yuzde(Math.abs(p));
  }

  function gunMetni(n) { return YU.fmt.sayi(n) + '. gün'; }

  function farkTuru(d) {
    if (d === null || !isFinite(d) || d === 0) return 'notr';
    return d > 0 ? 'olumlu' : 'olumsuz';
  }

  /* "%6,5 geride" / "%27,8 önde" / "başa baş" */
  function konumMetni(fark, yuzde) {
    if (fark === null) return null;
    if (fark === 0) return 'başa baş';
    var y = yuzdeMetni(yuzde);
    var yon = fark > 0 ? 'önde' : 'geride';
    return y ? (YU.fmt.yuzde(Math.abs(yuzde)) + ' ' + yon) : yon;
  }

  /* ==================================================================
     2. Sözlük — kavram tanımları
     Terimler ASCII yazılır; YU.dil.katla zaten her iki yazımı da buraya
     düşürüyor ("geçen"/"gecen", "üretim"/"uretim").
     ================================================================== */

  var SABIT_KAVRAMLAR = [
    /* --- ölçüt: neyin sayısı sorulusuyor --- */
    { kavram: 'olcut', deger: 'uretim', terimler: [
      'uretim', 'uretimi', 'urettik', 'uretmisiz', 'uretiyoruz', 'uretilen', 'uretildi', 'uretti',
      'uretim miktari', 'imalat', 'imal', 'cikardik', 'cikan', 'urettigimiz', 'uretmis',
      'cikti', 'cikisi', 'mal cikti', 'mal cikisi', 'cikan miktar',
      'uretimimiz', 'uretiminde', 'uretimde', 'uretmek', 'ureten' ] },
    { kavram: 'olcut', deger: 'satis', terimler: [
      'satis', 'satisi', 'sattik', 'satmisiz', 'satiyoruz', 'satilan', 'satildi', 'satti',
      'satis miktari', 'sevkiyat', 'sevk', 'sevkettik', 'sevk ettik', 'sattigimiz', 'satmis',
      'satisimiz', 'satista', 'satiste', 'satmak', 'satan', 'sevkiyati' ] },
    { kavram: 'olcut', deger: 'cuvallama', terimler: [
      'cuvallama', 'cuvalladik', 'cuvallanan', 'cuvallamisiz', 'cuvalladigimiz', 'cuvallamis',
      'paketleme', 'paketledik', 'torbalama', 'torbaladik', 'cuval adedi', 'cuval sayisi',
      'cuval yaptik', 'cuval doldurduk', 'cuval cikardik', 'adet cuval', 'cuval' ] },
    { kavram: 'olcut', deger: 'stok', terimler: [
      'stok', 'stogu', 'stogumuz', 'stokta', 'stoklar', 'elimizde', 'elimizdeki', 'mevcut',
      'kalan', 'kaldi', 'depoda', 'deposunda', 'ambar', 'ambarda', 'stok durumu', 'ne kaldi',
      'elde', 'elde kalan', 'mevcudu', 'ne kadar var', 'ne kadar kaldi', 'ne var ne yok',
      'ne kadar mal var', 'stok miktari' ] },
    { kavram: 'olcut', deger: 'doluluk', terimler: [
      'doluluk', 'doluluk orani', 'ne kadar dolu', 'dolulugu', 'doluyuz', 'dolu mu', 'bos yer',
      'kapasite', 'kapasitesi', 'bosluk' ] },

    /* --- dönem --- */
    { kavram: 'donem', deger: 'gecmis', terimler: [
      'gecen sene', 'gecen yil', 'gecen kampanya', 'gecen sezon', 'gecen donem',
      'gecen seneki', 'gecen yilki', 'gecen seneye', 'gecen yila', 'gecen kampanyaya',
      'onceki sene', 'onceki yil', 'onceki kampanya', 'onceki sezon', 'onceki donem',
      'gecen seneyle', 'gecen yilla', 'gecen senenin', 'gecen yilin', 'evvelki sene',
      'bir onceki kampanya', 'bir onceki sene', 'bir onceki yil', 'gecmis kampanya',
      'gecmis sene', 'gecmis yil', 'gecen ki', 'eski kampanya', 'eski sezon' ] },
    { kavram: 'donem', deger: 'bu', terimler: [
      'bu sene', 'bu yil', 'bu kampanya', 'bu sezon', 'bu donem', 'bu seneki', 'bu yilki',
      'bu seneye', 'bu yila', 'bu senenin', 'bu yilin', 'suanki kampanya', 'simdiki kampanya',
      'icinde bulundugumuz kampanya', 'mevcut kampanya', 'yeni kampanya', 'aktif kampanya' ] },

    /* --- karşılaştırma işareti --- */
    { kavram: 'karsilastir', deger: 'evet', terimler: [
      'gore', 'kiyasla', 'kiyaslama', 'karsilastir', 'karsilastirma', 'karsilastirinca',
      'oranla', 'nazaran', 'karsisinda', 'fark', 'farki', 'farkimiz', 'ne fark',
      'karsilastirmali', 'kiyasladigimizda', 'gore ne durumda' ] },

    /* --- "nasıl gidiyoruz" — genel durum --- */
    { kavram: 'durum', deger: 'evet', terimler: [
      'nasil gidiyor', 'nasil gidiyoruz', 'nasil ilerliyoruz', 'nasil ilerliyor',
      'ne durumdayiz', 'ne durumda', 'ne alemde', 'ne alemdeyiz', 'durumumuz ne', 'durum ne',
      'iyi mi gidiyor', 'iyi gidiyor mu', 'nasiliz', 'ne gidiyor', 'gidisat',
      'gidisat nasil', 'seyir nasil', 'trend nasil', 'performans', 'performansimiz',
      'ne durumdayim', 'nasil bir tablo', 'genel durum', 'ozet', 'ozetle', 'genel bakis',
      /* "işler nasıl" gibi özneyi söylemeyen sorular ve iyi/kötü kıyasları */
      'isler nasil', 'isler ne durumda', 'is nasil', 'isler nasil gidiyor', 'isler iyi mi',
      'daha iyi miyiz', 'daha kotu muyuz', 'daha mi iyiyiz', 'daha mi kotuyuz',
      'iyi miyiz', 'kotu muyuz', 'iyiyiz', 'kotuyuz', 'daha iyi mi', 'daha kotu mu',
      'neredeyiz', 'ne durumdayiz acaba', 'durumumuz nasil', 'durum', 'durumu', 'durumda',
      'ilerliyor muyuz', 'ilerliyor mu', 'ilerleme var mi', 'ilerleme nasil',
      'yolunda mi', 'yolunda gidiyor mu' ] },

    /* --- sıralama --- */
    { kavram: 'siralama', deger: 'artan', terimler: [
      'en cok artan', 'en fazla artan', 'en cok yukselen', 'en cok buyuyen', 'en iyi giden',
      'en cok iyilesen', 'hangisi artmis', 'hangisi artti', 'neler artmis', 'artislar',
      'en iyi kalem', 'en basarili', 'en cok gelisen', 'nerede iyiyiz' ] },
    { kavram: 'siralama', deger: 'azalan', terimler: [
      'en cok azalan', 'en cok dusen', 'en fazla dusen', 'en fazla azalan', 'en cok gerileyen',
      'en kotu giden', 'hangisi dusmus', 'hangisi dustu', 'neler dusmus', 'dususler',
      'en kotu kalem', 'en basarisiz', 'nerede kotuyuz', 'nerede geriyiz', 'sorunlu kalemler' ] },
    { kavram: 'siralama', deger: 'yuksek', terimler: [
      'en yuksek', 'en fazla', 'en cok', 'en buyuk', 'zirve', 'rekor', 'tepe', 'maksimum',
      'en verimli', 'en iyi', 'en yogun' ] },
    { kavram: 'siralama', deger: 'dusuk', terimler: [
      'en dusuk', 'en az', 'en kucuk', 'en kotu', 'dip', 'minimum', 'en zayif', 'en durgun' ] },

    /* --- yön (artmış mı / düşmüş mü) --- */
    { kavram: 'yon', deger: 'artis', terimler: [
      'artmis', 'artti', 'arttik', 'artis', 'yukselmis', 'yukseldi', 'buyudu', 'buyumus',
      'iyilesti', 'iyilesmis', 'yukselis', 'artmis mi', 'yukseldi mi', 'ileride', 'onde' ] },
    { kavram: 'yon', deger: 'azalis', terimler: [
      'dusmus', 'dustu', 'azalmis', 'azaldi', 'gerilemis', 'geriledi', 'dusus', 'azalis',
      'kotulesti', 'kotulesmis', 'dusmus mu', 'azaldi mi', 'geride', 'gerilerde' ] },

    /* --- özet biçimi (neyin hesaplanacağı) --- */
    { kavram: 'ozet', deger: 'ortalama', terimler: [
      'ortalama', 'ortalamasi', 'ortalamada', 'gunluk ortalama', 'ortalama gunluk',
      'vasati', 'gun basina', 'gunde ortalama' ] },
    { kavram: 'ozet', deger: 'toplam', terimler: [
      'toplam', 'toplamda', 'toplami', 'genel toplam', 'simdiye kadar', 'bugune kadar',
      'baslangictan beri', 'basindan beri', 'toplu', 'yekun' ] },

    /* --- mod (grafiğin nasıl çizileceği) --- */
    { kavram: 'mod', deger: 'birikimli', terimler: [
      'birikimli', 'kumulatif', 'birikmis', 'birike birike', 'ustuste toplanarak' ] },
    { kavram: 'mod', deger: 'gunluk', terimler: [
      'gunluk', 'gun gun', 'her gun', 'gunlere gore', 'gunluk olarak', 'gunluk bazda' ] },

    /* --- kapsam (ilk N / son N) --- */
    { kavram: 'kapsam', deger: 'ilk', terimler: ['ilk', 'basta', 'basindaki', 'ilk olarak'] },
    { kavram: 'kapsam', deger: 'son', terimler: ['son', 'sondaki', 'geride kalan', 'son olarak'] },

    /* --- zaman ---
       Göreli gün ifadeleri kampanya gününe çevrilir; çeviri kampanya
       bağlamını gerektirdiği için `cevapla` içinde yapılır. */
    { kavram: 'zaman', deger: 'bugun', terimler: ['bugun', 'bu gun', 'bugunku', 'bugune'] },
    { kavram: 'zaman', deger: 'dun', terimler: ['dun', 'dunku', 'dune', 'dun ki'] },
    { kavram: 'zaman', deger: 'onceGun', terimler: [
      'gun once', 'gun onceki', 'gun evvel', 'gun oncesinde', 'gun geriye' ] },
    { kavram: 'zaman', deger: 'ilkGun', terimler: ['ilk gun', 'ilk gunu', 'ilk gunde', 'acilis gunu'] },
    { kavram: 'zaman', deger: 'sonGun', terimler: [
      'son gun', 'son gunu', 'son gunde', 'en son gun', 'son kayit', 'son kayitli gun' ] },
    { kavram: 'zaman', deger: 'buHafta', terimler: [
      'bu hafta', 'son hafta', 'haftalik', 'son bir hafta', 'bu haftaki' ] },
    { kavram: 'zaman', deger: 'gecenHafta', terimler: [
      'gecen hafta', 'onceki hafta', 'gecen haftaki', 'bir onceki hafta' ] },

    { kavram: 'birimZaman', deger: 'gun', terimler: [
      'gun', 'gunde', 'gunu', 'gune', 'gunun', 'gunler', 'gunlerde', 'gundeyiz', 'gundeydik' ] },
    { kavram: 'birimZaman', deger: 'hafta', terimler: ['hafta', 'haftada', 'haftalik', 'haftalar'] },

    /* --- hedef varlık --- */
    { kavram: 'hedef', deger: 'silo', terimler: [
      'silo', 'silolar', 'silolarda', 'silolarin', 'siloda', 'silolarimiz', 'silo durumu' ] },
    { kavram: 'hedef', deger: 'kampanyaGunu', terimler: [
      'kacinci gun', 'kacinci gundeyiz', 'hangi gundeyiz', 'kampanya gunu', 'gun sayisi',
      'kacinci gunde', 'kacinci gundeydik', 'kacinci gunundeyiz', 'kampanyanin kacinci gunu' ] },
    { kavram: 'hedef', deger: 'kayit', terimler: [
      'kac gun veri', 'kayitli gun', 'kac gun kayit', 'veri girisi', 'kac gunluk veri',
      'kayit sayisi', 'kac gun girilmis', 'veri var' ] },
    { kavram: 'hedef', deger: 'kalem', terimler: [
      'malzeme', 'malzemeler', 'urun', 'urunler', 'kalem', 'kalemler', 'hangi urun',
      'hangi malzeme', 'hangi kalem', 'neler', 'ne var' ] },
    { kavram: 'hedef', deger: 'gun', terimler: [
      'hangi gun', 'hangi gunde', 'hangi gunu', 'ne zaman', 'hangi tarih', 'hangi tarihte' ] },

    /* --- soru kelimeleri --- */
    { kavram: 'soruKelimesi', deger: 'neKadar', terimler: [
      'ne kadar', 'ne kadari', 'ne miktar', 'ne miktarda', 'miktar', 'miktari',
      'kac kg', 'kac kilo', 'kac ton', 'kac adet', 'kac cuval', 'ne kadardi', 'ne kadardir' ] },
    { kavram: 'soruKelimesi', deger: 'kac', terimler: ['kac', 'kaci', 'kacinci', 'kacincisi', 'kacti'] },
    { kavram: 'soruKelimesi', deger: 'nasil', terimler: ['nasil', 'nasildir', 'nice'] },
    { kavram: 'soruKelimesi', deger: 'hangi', terimler: ['hangi', 'hangisi', 'hangileri'] },
    { kavram: 'soruKelimesi', deger: 'varMi', terimler: [
      'var mi', 'olmus mu', 'yapmis miyiz', 'yaptik mi', 'oldu mu' ] },

    /* --- yardım --- */
    { kavram: 'yardim', deger: 'evet', terimler: [
      'yardim', 'ne sorabilirim', 'neler sorabilirim', 'ne sorabilirsin', 'ne sorabiliriz',
      'ornek soru', 'ornek sorular', 'nasil kullanilir', 'nasil kullaniyorum', 'yapabildiklerin',
      'neler yapabilirsin', 'ne yapabilirsin', 'komutlar', 'ne bilirsin', 'kullanim' ] },

    /* --- birim --- */
    { kavram: 'birim', deger: 'kg', terimler: ['kg', 'kilo', 'kilogram'] },
    { kavram: 'birim', deger: 'ton', terimler: ['ton', 'tonluk cinsinden'] },
    { kavram: 'birim', deger: 'adet', terimler: ['adet', 'tane'] }
  ];

  /* --- malzeme takma adları ------------------------------------------
     Depodaki ada bakarak eklenir; yeni malzemede ad kendiliğinden terim
     olur, takma ad varsa buradan gelir. */
  var TAKMA_ADLAR = [
    { ozelTip: 'DokmeKuruKuspe', terimler: [
      'dokme', 'dokme kuspe', 'dokme kuru kuspe', 'dokme mal', 'dokme urun',
      'silodaki kuspe', 'silo kuspesi', 'dokme kuspesi' ] },
    { ozelTip: 'CuvalKuruKuspe', terimler: [
      'cuvalli', 'cuvalli kuspe', 'cuvalli kuru kuspe', 'cuval kuspe', 'cuvalli mal',
      'torbali kuspe', 'paketli kuspe', '50lik', '50 lik', '50 kg kuspe', '50lik kuspe',
      '50 kglik kuspe', 'elli kilo kuspe' ] },
    { adGecer: 'tonluk', terimler: [
      'tonluk', 'tonluk kuspe', 'tonluk yas kuspe', 'ton kuspe', 'tonluk pancar kuspesi' ] },
    { adGecer: '25', terimler: [
      '25lik', '25 lik', '25lik kuspe', '25 kg kuspe', '25lik yas kuspe', 'yirmi beslik',
      'yirmi bes kilo', '25 kilo kuspe', '25 kgli' ] },
    { adGecer: 'atik', terimler: [
      'atik', 'atik kuspe', 'atik kuru kuspe', 'atik mal', 'fire', 'iskarta', 'bozuk kuspe' ] },
    { adGecer: 'kuyruk', terimler: [
      'kuyruk', 'kuyruklar', 'pancar kuyrugu', 'kuyruk atigi' ] },
    { adGecer: 'toprak', terimler: [
      'toprak', 'topraklar', 'pancar topragi', 'toprak atigi', 'topraklama' ] }
  ];

  /* Birden fazla malzemeye denk gelen ad, tek malzemeye bağlanamaz; grup
     olur ("yaş küspe" -> tonluk + 25'lik). `icerir` adın içinde aranan
     parçadır; null ise bütün malzemeler kapsanır. */
  var GRUP_TERIMLERI = [
    { deger: 'yas', icerir: 'yas', terimler: ['yas kuspe', 'yas', 'yas pancar kuspesi', 'yas mal', 'yas kuspeler'] },
    { deger: 'kuru', icerir: 'kuru', terimler: ['kuru mal', 'kuru kuspeler', 'kurular'] },
    { deger: 'kuspe', icerir: 'kuspe', terimler: ['kuspe', 'kuspeler', 'pancar kuspesi', 'kuspemiz'] },
    { deger: 'hepsi', icerir: null, terimler: [
      'tum malzemeler', 'butun malzemeler', 'her sey', 'hepsi', 'genel', 'tum kalemler',
      'butun kalemler', 'tumu', 'butunu', 'tum urunler', 'butun urunler' ] }
  ];

  function grupTanimi(deger) {
    for (var i = 0; i < GRUP_TERIMLERI.length; i++) if (GRUP_TERIMLERI[i].deger === deger) return GRUP_TERIMLERI[i];
    return null;
  }

  /* ------------------------------------------------------------------
     Sözlüğü depodan kur. Malzeme listesi değişince yeniden kurulur.
     ------------------------------------------------------------------ */

  /* Cümlede anlam taşımayan kelimeler. Bunlar sözlükte karşılığı olmasa da
     "anlamadığım kelime" sayılmaz — soruyu kuran bağ sözcükleridir. */
  var GECISKEN = {};
  (function () {
    var l = ('ne oldu olur olsun olmus mi mu bir birer acaba lutfen rica bana bize benim bizim ' +
      'soyler soylermisin misin misiniz ki de da icin ile ve veya ama fakat ancak yalniz ' +
      'cok az daha en su bu o sey biraz hic peki yani iste sadece tam gibi kadar ' +
      'goster gosterir gosterebilir sorun merak ettim bakalim bakar bakayim bakabilir ' +
      'var yok idi ise diye demek nedir neydi neymis nasildi neyse kac kaci simdi hemen tekrar yine ' +
      'nasil neyi neye nerede acik net kisaca ozet ozetle biz siz onlar').split(/\s+/);
    for (var i = 0; i < l.length; i++) if (l[i]) GECISKEN[l[i]] = true;
  })();

  var onbellek = null;

  function malzemeAnahtari(depo) {
    var p = [], i;
    for (i = 0; i < depo.malzemeler.length; i++) {
      p.push(depo.malzemeler[i].Id + ':' + depo.malzemeler[i].Ad + ':' + depo.malzemeler[i].Aktif);
    }
    for (i = 0; i < depo.silolar.length; i++) p.push('s' + depo.silolar[i].Id + ':' + depo.silolar[i].Ad);
    return p.join('|');
  }

  function adParcalari(ad) {
    var liste = [], disi, ici;
    liste.push(ad);
    disi = String(ad).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    ici = (/\(([^)]*)\)/.exec(ad) || [])[1];
    if (disi && disi !== ad) liste.push(disi);
    if (ici) {
      ici = String(ici).trim();
      liste.push(ici);
      if (disi) { liste.push(disi + ' ' + ici); liste.push(ici + ' ' + disi); }
    }
    return liste;
  }

  soru.sozlukKur = function (depo) {
    var girdiler = SABIT_KAVRAMLAR.slice(), i, j, t;
    var malzemeler = YU.analiz.malzemeler(depo);

    /* Adın hangi malzemelere denk geldiğini say: çakışan ad gruba gider. */
    var sayac = {};
    for (i = 0; i < malzemeler.length; i++) {
      var parcalar = adParcalari(malzemeler[i].Ad);
      for (j = 0; j < parcalar.length; j++) {
        t = YU.dil.katla(parcalar[j]).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t) continue;
        (sayac[t] || (sayac[t] = [])).push(malzemeler[i].Id);
      }
    }

    for (i = 0; i < malzemeler.length; i++) {
      var m = malzemeler[i];
      var terimler = [], p;
      var adlar = adParcalari(m.Ad);
      for (j = 0; j < adlar.length; j++) {
        t = YU.dil.katla(adlar[j]).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t) continue;
        if (sayac[t] && sayac[t].length > 1) continue;      /* çakışan ad: gruba bırakılır */
        terimler.push(t);
      }
      var katAd = YU.dil.katla(m.Ad);
      for (j = 0; j < TAKMA_ADLAR.length; j++) {
        var takma = TAKMA_ADLAR[j];
        var uyar = takma.ozelTip ? (m.OzelTip === takma.ozelTip)
                                 : (katAd.indexOf(YU.dil.katla(takma.adGecer)) >= 0);
        if (!uyar) continue;
        for (p = 0; p < takma.terimler.length; p++) terimler.push(takma.terimler[p]);
      }
      if (terimler.length) girdiler.push({ kavram: 'malzeme', deger: m.Id, terimler: terimler });
    }

    for (i = 0; i < GRUP_TERIMLERI.length; i++) {
      girdiler.push({ kavram: 'grup', deger: GRUP_TERIMLERI[i].deger, terimler: GRUP_TERIMLERI[i].terimler });
    }

    /* Silo adları ("Silo 2", "2. silo") */
    var silolar = YU.analiz.silolar(depo);
    for (i = 0; i < silolar.length; i++) {
      girdiler.push({ kavram: 'silo', deger: silolar[i].Id, terimler: [silolar[i].Ad] });
    }

    /* Kampanya adları ("2025/2026") — sayı olarak da yakalanır. */
    var donemler = YU.donem.liste();
    for (i = 0; i < donemler.length; i++) {
      var ad = donemler[i].ad;
      girdiler.push({
        kavram: 'kampanyaAdi', deger: ad,
        terimler: [ad, ad.replace('/', ' '), ad.replace('/', '-'), 'kampanya ' + ad]
      });
    }

    return { sozluk: YU.dil.Sozluk(girdiler), girdiSayisi: girdiler.length };
  };

  soru.sozluk = function (depo) {
    var anahtar = malzemeAnahtari(depo);
    if (!onbellek || onbellek.anahtar !== anahtar) {
      onbellek = soru.sozlukKur(depo);
      onbellek.anahtar = anahtar;
    }
    return onbellek.sozluk;
  };

  soru.onbellegiBosalt = function () { onbellek = null; };

  /* ==================================================================
     3. Çözümleme — kavramlardan niyet
     ================================================================== */

  /* Niyet puanlaması. Kalıp yok: her niyet, ortamda hangi kavramların
     bulunduğuna bakıp puan toplar. En yüksek puanlı niyet kazanır; puan
     farkı güven (0..1) olarak dışarı verilir. */
  var NIYETLER = [
    { kod: 'yardim', puanla: function (c) { return c.yardim ? 12 : 0; } },

    { kod: 'kampanya-gunu', puanla: function (c) {
      var p = 0;
      if (c.hedefKampanyaGunu) p += 11;
      if (c.soruKac && c.birimGun && !c.olcut && !c.malzemeVar) p += 6;
      if (c.zamanBugun && c.birimGun && !c.olcut && !c.malzemeVar) p += 3;
      return p;
    } },

    { kod: 'kayit', puanla: function (c) { return c.hedefKayit ? 10 : 0; } },

    { kod: 'silo', puanla: function (c) {
      var p = 0;
      if (c.hedefSilo || c.siloVar) p += 11;
      if (c.olcut === 'doluluk') p += 6;
      if (c.olcut === 'stok' && (c.hedefSilo || c.siloVar)) p += 2;
      return p;
    } },

    { kod: 'stok', puanla: function (c) {
      var p = 0;
      if (c.olcut === 'stok') p += 10;
      if (c.olcut === 'stok' && c.malzemeVar) p += 2;
      if (c.hedefSilo || c.siloVar) p -= 4;
      return p;
    } },

    { kod: 'siralama', puanla: function (c) {
      var p = 0;
      if (c.siralama === 'artan' || c.siralama === 'azalan') p += 11;
      if (c.yon && !c.malzemeVar && !c.olcut && c.hedefKalem) p += 6;
      if (c.hedefKalem && (c.siralama === 'yuksek' || c.siralama === 'dusuk')) p += 5;
      return p;
    } },

    { kod: 'zirve', puanla: function (c) {
      var p = 0;
      if (c.siralama === 'yuksek' || c.siralama === 'dusuk') {
        p += 7;
        if (c.hedefGun || c.birimGun) p += 4;
        if (c.olcut || c.malzemeVar) p += 2;
        if (c.hedefKalem) p -= 6;
      }
      return p;
    } },

    { kod: 'ortalama', puanla: function (c) {
      var p = 0;
      if (c.ozet === 'ortalama') p += 11;
      if (c.ozet === 'ortalama' && (c.olcut || c.malzemeVar)) p += 2;
      return p;
    } },

    { kod: 'gun-degeri', puanla: function (c) {
      var p = 0;
      if (c.siraGun !== null) p += 9;
      if (c.siraGun !== null && (c.olcut || c.malzemeVar)) p += 3;
      if (c.siraGun !== null && c.donemGecmis) p += 1;
      if (c.hedefKampanyaGunu) p -= 8;
      return p;
    } },

    { kod: 'pencere', puanla: function (c) {
      var p = 0;
      if (c.kapsam && c.kapsamSayi !== null) p += 9;
      if (c.kapsam && c.kapsamSayi !== null && (c.olcut || c.malzemeVar)) p += 3;
      return p;
    } },

    { kod: 'karsilastirma', puanla: function (c) {
      var p = 0;
      if (c.donemGecmis) p += 8;
      if (c.karsilastirIsareti) p += 4;
      if (c.yon) p += 3;
      if (c.durum && c.donemGecmis) p += 3;
      if (c.donemGecmis && (c.olcut || c.malzemeVar)) p += 2;
      if (c.kampanyaAdiSayisi >= 1) p += 4;
      if (c.kampanyaAdiSayisi >= 2) p += 4;
      /* "geçen sene ne kadar toprak sattık" karşılaştırma değil, geçmiş
         kampanyanın DEĞERİdir: karşılaştırma işareti ("göre", "kıyasla")
         yoksa ve soru miktar soruyorsa değer sorgusu öne geçer. */
      if (c.soruNeKadar && !c.karsilastirIsareti && !c.durum && !c.yon) p -= 5;
      return p;
    } },

    { kod: 'deger', puanla: function (c) {
      var p = 0;
      if (c.soruNeKadar && (c.olcut || c.malzemeVar)) p += 8;
      if (c.ozet === 'toplam' && (c.olcut || c.malzemeVar)) p += 6;
      if ((c.olcut === 'uretim' || c.olcut === 'satis' || c.olcut === 'cuvallama') && !c.donemGecmis && !c.durum) p += 3;
      if (c.malzemeVar && !c.donemGecmis && !c.durum && !c.olcut) p += 3;
      if (c.soruNeKadar && c.donemGecmis && !c.karsilastirIsareti && !c.durum) p += 3;
      return p;
    } },

    { kod: 'genel-durum', puanla: function (c) {
      var p = 0;
      if (c.durum) p += 8;
      if (c.durum && !c.malzemeVar && !c.olcut) p += 3;
      if (c.durum && c.donemGecmis) p += 1;
      /* "satışlarımız nasıl" / "tüm malzemeler nasıl": "nasıl" miktar değil
         DURUM sorar. Miktar, pencere ya da gün soruluyorsa bu geçerli değil. */
      if (c.soruNasil && !c.soruNeKadar && !c.kapsam && c.siraGun === null && !c.siralama) p += 5;
      /* "silolar ne durumda" genel durum sorusu değil, SİLO sorusudur:
         cümlede belirli bir varlık geçiyorsa genel özet geri çekilir. */
      if (c.hedefSilo || c.siloVar || c.olcut === 'stok' || c.olcut === 'doluluk') p -= 9;
      /* "20. günde durum neydi" belirli bir GÜNÜ sorar; genel özet değildir. */
      if (c.siraGun !== null && !c.gunIfadesi) p -= 6;
      return p;
    } }
  ];

  /* Ham eşleşmelerden çözümleme nesnesi. */
  soru.coz = function (depo, metin) {
    var kelimeler = YU.dil.kelimeler(metin);
    var eslesmeler = soru.sozluk(depo).bul(kelimeler);
    var grup = YU.dil.grupla(eslesmeler);

    /* Sözlükte karşılığı bulunmayan ANLAMLI kelimeler sayılır. "bugün maç
       var mı" sorusunda "maç" böyle bir kelimedir; cümlede alan dışı bir
       özne varken zayıf kanıtla cevap vermek yanlış cevap üretiyordu
       (23.08.2026 ölçümü). Sayılar ve bağ sözcükleri sayılmaz. */
    var kapsandi = [], ei, ej;
    for (ei = 0; ei < kelimeler.length; ei++) kapsandi.push(false);
    for (ei = 0; ei < eslesmeler.length; ei++) {
      for (ej = eslesmeler[ei].bas; ej <= eslesmeler[ei].bit && ej < kapsandi.length; ej++) kapsandi[ej] = true;
    }
    var kapsanmamisIcerik = 0;
    for (ei = 0; ei < kelimeler.length; ei++) {
      var kk = kelimeler[ei];
      if (kapsandi[ei] || kk.sayi !== null) continue;
      if (kk.kat.length < 3 || GECISKEN[kk.kat]) continue;
      kapsanmamisIcerik++;
    }

    var malzemeIdleri = [], i;
    if (grup.malzeme) for (i = 0; i < grup.malzeme.length; i++) malzemeIdleri.push(grup.malzeme[i].deger);

    /* Grup terimi ("yaş küspe") adı içeren malzemelere açılır. */
    var grupDegeri = YU.dil.deger(grup, 'grup', null);
    if (grupDegeri) {
      var tanim = grupTanimi(grupDegeri);
      var malzemeler = YU.analiz.malzemeler(depo);
      var parca = tanim && tanim.icerir ? YU.dil.katla(tanim.icerir) : null;
      for (i = 0; i < malzemeler.length; i++) {
        var katAd = YU.dil.katla(malzemeler[i].Ad);
        if (parca && katAd.indexOf(parca) < 0) continue;
        if (malzemeIdleri.indexOf(malzemeler[i].Id) < 0) malzemeIdleri.push(malzemeler[i].Id);
      }
    }

    /* Sayılar: sıra sayısı gün, düz sayı kapsam büyüklüğü olur. */
    var siraGun = null, duzSayi = null;
    for (i = 0; i < kelimeler.length; i++) {
      var k = kelimeler[i];
      if (k.sayi === null) continue;
      if (k.sira && siraGun === null) siraGun = Math.round(k.sayi);
      else if (!k.sira && duzSayi === null) duzSayi = Math.round(k.sayi);
    }
    /* "son 7 gün" — kapsam varsa düz sayı ona aittir. "15 gün" tek başına
       da gün sayısıdır; "15. gün" ise belirli bir gündür. */
    var kapsam = YU.dil.deger(grup, 'kapsam', null);
    var kapsamSayi = kapsam !== null ? duzSayi : null;
    if (kapsam === null && siraGun === null && duzSayi !== null && YU.dil.icerir(grup, 'birimZaman', 'gun')) {
      /* "15 günde ne kadar ürettik" — belirli gün gibi davranır. */
      siraGun = duzSayi;
    }

    var c = {
      metin: metin,
      kelimeler: kelimeler,
      eslesmeler: eslesmeler,
      grup: grup,

      olcut: YU.dil.deger(grup, 'olcut', null),
      olcutSayisi: grup.olcut ? grup.olcut.length : 0,
      malzemeIdleri: malzemeIdleri,
      malzemeVar: malzemeIdleri.length > 0,
      grupDegeri: grupDegeri,
      siloIdleri: grup.silo ? grup.silo.map(function (e) { return e.deger; }) : [],
      siloVar: !!(grup.silo && grup.silo.length),

      donemGecmis: YU.dil.icerir(grup, 'donem', 'gecmis'),
      donemBu: YU.dil.icerir(grup, 'donem', 'bu'),
      kampanyaAdlari: grup.kampanyaAdi ? grup.kampanyaAdi.map(function (e) { return e.deger; }) : [],
      kampanyaAdiSayisi: grup.kampanyaAdi ? grup.kampanyaAdi.length : 0,

      karsilastirIsareti: YU.dil.icerir(grup, 'karsilastir'),
      durum: YU.dil.icerir(grup, 'durum'),
      siralama: YU.dil.deger(grup, 'siralama', null),
      yon: YU.dil.deger(grup, 'yon', null),
      ozet: YU.dil.deger(grup, 'ozet', null),
      mod: YU.dil.deger(grup, 'mod', null),
      kapsam: kapsam,
      kapsamSayi: kapsamSayi,
      siraGun: siraGun,
      duzSayi: duzSayi,

      zamanBugun: YU.dil.icerir(grup, 'zaman', 'bugun'),
      zamanDun: YU.dil.icerir(grup, 'zaman', 'dun'),
      birimGun: YU.dil.icerir(grup, 'birimZaman', 'gun'),
      birimHafta: YU.dil.icerir(grup, 'birimZaman', 'hafta'),

      hedefSilo: YU.dil.icerir(grup, 'hedef', 'silo'),
      hedefKampanyaGunu: YU.dil.icerir(grup, 'hedef', 'kampanyaGunu'),
      hedefKayit: YU.dil.icerir(grup, 'hedef', 'kayit'),
      hedefKalem: YU.dil.icerir(grup, 'hedef', 'kalem'),
      hedefGun: YU.dil.icerir(grup, 'hedef', 'gun'),

      soruNeKadar: YU.dil.icerir(grup, 'soruKelimesi', 'neKadar'),
      soruKac: YU.dil.icerir(grup, 'soruKelimesi', 'kac'),
      soruNasil: YU.dil.icerir(grup, 'soruKelimesi', 'nasil'),
      soruHangi: YU.dil.icerir(grup, 'soruKelimesi', 'hangi'),
      yardim: YU.dil.icerir(grup, 'yardim'),
      birim: YU.dil.deger(grup, 'birim', null),
      kapsanmamisIcerik: kapsanmamisIcerik
    };

    /* Göreli zaman ifadesi. Kampanya gününe çevrilmesi kampanya bağlamını
       gerektirir; burada yalnızca NİYETİ kaydedilir, `cevapla` çözer.
       "3 gün önce" ile "3. gün" karıştırılmamalı: birincisi bugünden geriye
       sayar, ikincisi kampanyanın 3. günüdür (23.08.2026 ölçümü). */
    var zamanDegeri = YU.dil.deger(grup, 'zaman', null);
    c.gunIfadesi = null;
    if (zamanDegeri === 'onceGun' && duzSayi !== null) {
      c.gunIfadesi = { tur: 'once', n: duzSayi };
      c.siraGun = null;                      /* "3 gün önce"deki 3 gün sırası değil */
      c.duzSayi = duzSayi;
    } else if (zamanDegeri === 'bugun' && c.siraGun === null) c.gunIfadesi = { tur: 'bugun' };
    else if (zamanDegeri === 'dun' && c.siraGun === null) c.gunIfadesi = { tur: 'dun' };
    else if (zamanDegeri === 'ilkGun') { c.gunIfadesi = { tur: 'ilk' }; c.kapsam = null; c.kapsamSayi = null; }
    else if (zamanDegeri === 'sonGun') { c.gunIfadesi = { tur: 'son' }; c.kapsam = null; c.kapsamSayi = null; }
    else if (zamanDegeri === 'buHafta') { c.kapsam = 'son'; c.kapsamSayi = 7 * (duzSayi || 1); }
    else if (zamanDegeri === 'gecenHafta') { c.kapsam = 'son'; c.kapsamSayi = 7; c.haftaKaydir = 7; }
    /* "2 hafta" gibi ifadeler gün sayısına çevrilir. */
    else if (c.birimHafta && duzSayi !== null && c.kapsam) c.kapsamSayi = duzSayi * 7;
    c.zaman = zamanDegeri;

    soru.niyetiBelirle(c);
    return c;
  };

  /* Niyet seçimi ayrı durur: `cevapla` göreli gün ifadesini çözdükten sonra
     yeniden çağırır — gün belli olunca niyet değişebilir. */
  soru.niyetiBelirle = function (c) {
    var puanlar = [], enIyi = null, ikinci = 0, i;
    for (i = 0; i < NIYETLER.length; i++) {
      var p = NIYETLER[i].puanla(c) || 0;
      puanlar.push({ kod: NIYETLER[i].kod, puan: p });
      if (!enIyi || p > enIyi.puan) { ikinci = enIyi ? enIyi.puan : 0; enIyi = { kod: NIYETLER[i].kod, puan: p }; }
      else if (p > ikinci) ikinci = p;
    }
    c.puanlar = puanlar;
    c.niyet = enIyi && enIyi.puan > 0 ? enIyi.kod : null;
    c.niyetPuani = enIyi ? enIyi.puan : 0;
    /* Güven: mutlak puan ile en yakın rakibe fark birlikte değerlendirilir. */
    c.guven = c.niyet ? Math.max(0, Math.min(1, (enIyi.puan / 12) * 0.7 + ((enIyi.puan - ikinci) / 8) * 0.3)) : 0;

    /* Soru ancak bu alana ait EN AZ BİR kavram taşıyorsa anlaşılmış sayılır.
       Yalnız puana bakmak yetmiyordu: "hava nasıl olacak" sorusundaki
       "nasıl" tek başına puan üretip alakasız bir cevaba yol açıyordu
       (23.08.2026 ölçümü). Soru kelimesi tek başına alan kavramı değildir. */
    c.alanKavrami = !!(c.olcut || c.malzemeVar || c.grupDegeri || c.siloVar ||
      c.donemGecmis || c.donemBu || c.kampanyaAdiSayisi ||
      c.hedefSilo || c.hedefKampanyaGunu || c.hedefKayit || c.hedefKalem || c.hedefGun ||
      c.durum || c.siralama || c.yon || c.ozet || c.kapsam || c.mod || c.gunIfadesi ||
      c.siraGun !== null || c.yardim);

    /* Güçlü kanıt = sorunun NEYİ sorduğunu söyleyen kavram. "nasıl gidiyor"
       gibi kalıplar tek başına güçlü sayılmaz: özneyi söylemezler. Zayıf
       kanıtla gelen soruda cümlede anlaşılmayan bir sözcük varsa
       ("IŞIK ne durumda", "bugün maç var mı") cevap verilmez. */
    c.gucluKanit = !!(c.olcut || c.malzemeVar || c.grupDegeri || c.siloVar ||
      c.hedefSilo || c.hedefKampanyaGunu || c.hedefKayit || c.hedefKalem ||
      c.siralama || c.yon || c.ozet || c.kapsam || c.mod ||
      c.donemGecmis || c.donemBu || c.kampanyaAdiSayisi || c.yardim ||
      /* Açıkça yazılmış gün sırası ("20. gün") özneyi belirler; göreli
         ifadeden ("bugün", "dün") gelen gün belirlemez. */
      (c.siraGun !== null && !c.gunIfadesi));

    c.anlasildi = !!c.niyet && enIyi.puan >= 3 && c.alanKavrami &&
      (c.gucluKanit || !c.kapsanmamisIcerik);
    return c;
  };

  /* ==================================================================
     4. Çözümlemeden göstergelere
     ================================================================== */

  /* Sorudaki malzeme + ölçüt ikilisinden gösterge listesi üretir.
     Malzeme var ölçüt yoksa o malzemenin bütün göstergeleri gelir. */
  function gostergeleriSec(depo, c, ozet) {
    var hepsi = ozet.gostergeler, secilen = [], i, g;

    function ekle(gos) {
      if (gos && secilen.indexOf(gos) < 0) secilen.push(gos);
    }

    if (c.malzemeVar) {
      for (i = 0; i < c.malzemeIdleri.length; i++) {
        var m = YU.analiz.malzemeIle(depo, c.malzemeIdleri[i]);
        if (!m) continue;
        if (c.olcut === 'uretim' || c.olcut === 'satis' || c.olcut === 'cuvallama') {
          var tur = c.olcut === 'cuvallama' ? 'uretim' : c.olcut;
          ekle(YU.analiz.gostergeSec(hepsi, m.Id, tur, m.OzelTip));
        } else {
          ekle(YU.analiz.gostergeSec(hepsi, m.Id, 'uretim', m.OzelTip));
          ekle(YU.analiz.gostergeSec(hepsi, m.Id, 'satis', m.OzelTip));
        }
      }
      if (secilen.length) return secilen;
    }

    if (c.olcut === 'cuvallama') { ekle(YU.analiz.gostergeBul(hepsi, 'cuvallama')); return secilen; }

    if (c.olcut === 'uretim' || c.olcut === 'satis') {
      for (i = 0; i < hepsi.length; i++) {
        g = hepsi[i];
        if (g.tur === c.olcut) secilen.push(g);
      }
      return secilen;
    }
    return [];
  }

  /* Karşılaştırma için kullanılacak dönemler. */
  function donemleriSec(c, ozet) {
    var buAd = null, gecmisAd = null;
    if (c.kampanyaAdlari.length === 1) {
      /* Tek kampanya adı geçtiyse: "geçen" gibi bir işaret varsa o kampanya
         karşılaştırılan taraftır, yoksa incelenen taraftır. */
      if (c.donemGecmis || c.karsilastirIsareti) gecmisAd = c.kampanyaAdlari[0];
      else buAd = c.kampanyaAdlari[0];
    } else if (c.kampanyaAdlari.length >= 2) {
      var sirali = c.kampanyaAdlari.slice().sort();
      gecmisAd = sirali[0];
      buAd = sirali[sirali.length - 1];
    }
    return { buAd: buAd, gecmisAd: gecmisAd };
  }

  /* ==================================================================
     5. Cevap üreticileri
     Her biri {baslik, satirlar, grafik, bag} döndürür.
     ================================================================== */

  function satir(etiket, deger, tur) {
    return { etiket: etiket, deger: deger, tur: tur || null };
  }

  function analizBagi(param) { return { kod: 'analizler', param: param || {} }; }

  /* --- karşılaştırma grafiği tanımı --- */
  function karsilastirmaGrafigi(ozet, gosterge, N, birikimli, baslik) {
    var buSeri = YU.analiz.seri(ozet.bu, gosterge, N);
    var gecmisSeri = ozet.gecmis ? YU.analiz.seri(ozet.gecmis, gosterge, N) : null;
    var buDizi = birikimli ? buSeri.birikimli : buSeri.gunluk;
    var gecmisDizi = gecmisSeri ? (birikimli ? gecmisSeri.birikimli : gecmisSeri.gunluk) : null;
    var noktalar = [], i;
    for (i = 0; i < N; i++) {
      noktalar.push({
        etiket: String(i + 1),
        baslik: gunMetni(i + 1),
        deger1: buDizi[i],
        deger2: gecmisDizi ? gecmisDizi[i] : null,
        alt1: YU.fmt.tarih(YU.analiz.gunTarihi(ozet.bu, i + 1)),
        alt2: ozet.gecmis ? YU.fmt.tarih(YU.analiz.gunTarihi(ozet.gecmis, i + 1)) : null
      });
    }
    return {
      tur: 'karsilastirma',
      baslik: baslik || ((birikimli ? 'Birikimli · ' : 'Günlük · ') + gosterge.ad),
      birim: gosterge.birim,
      noktalar: noktalar,
      seri1: { ad: 'Kampanya ' + ozet.bu.donem.ad, renk: RENK_BU },
      seri2: ozet.gecmis ? { ad: 'Kampanya ' + ozet.gecmis.donem.ad, renk: RENK_GECMIS } : null
    };
  }

  /* --- tek seri grafiği (karşılaştırmasız) --- */
  function seriGrafigi(veri, gosterge, basGun, bitGun, baslik) {
    var p = YU.analiz.pencere(veri, gosterge, basGun, bitGun), noktalar = [], i;
    for (i = 0; i < p.gunler.length; i++) {
      noktalar.push({
        etiket: String(p.gunler[i].gun),
        baslik: gunMetni(p.gunler[i].gun),
        deger1: p.gunler[i].deger,
        deger2: null,
        alt1: YU.fmt.tarih(p.gunler[i].tarih)
      });
    }
    return {
      tur: 'karsilastirma',
      baslik: baslik || gosterge.ad,
      birim: gosterge.birim,
      noktalar: noktalar,
      seri1: { ad: 'Kampanya ' + veri.donem.ad, renk: RENK_BU },
      seri2: null
    };
  }

  /* --- sıralama grafiği (yüzde çubukları) --- */
  function siraGrafigi(karsilastirmalar, baslik, sinir) {
    var ogeler = [], i, enBuyuk = 0;
    for (i = 0; i < karsilastirmalar.length && ogeler.length < (sinir || 8); i++) {
      var k = karsilastirmalar[i];
      if (k.yuzde === null) continue;
      ogeler.push({
        ad: k.gosterge.ad,
        kod: k.gosterge.kod,
        yuzde: k.yuzde,
        deger: k.fark,
        birim: k.gosterge.birim,
        tur: farkTuru(k.fark)
      });
      enBuyuk = Math.max(enBuyuk, Math.abs(k.yuzde));
    }
    return { tur: 'sira', baslik: baslik, ogeler: ogeler, enBuyuk: enBuyuk || 1 };
  }

  /* ------------------------------------------------------------------
     5.1 Genel durum / karşılaştırma
     ------------------------------------------------------------------ */

  function cevapKarsilastirma(depo, c, ozet, genelMi) {
    var K = ozet.karsilastirmaGunu;
    var gostergeler = gostergeleriSec(depo, c, ozet);
    var satirlar = [], grafik = null, baslik;

    if (!ozet.gecmis) {
      return {
        baslik: 'Bu kampanyanın ' + gunMetni(ozet.bugun.gun) + 'ündeyiz; karşılaştırılacak ikinci kampanya yok.',
        satirlar: [satir('Kampanya', 'Kampanya ' + ozet.bu.donem.ad + ' · 1. gün ' + YU.fmt.tarih(ozet.bu.donem.bas))],
        grafik: gostergeler.length ? seriGrafigi(ozet.bu, gostergeler[0], 1, ozet.bugun.gun, null) : null,
        bag: analizBagi({ bu: ozet.bu.donem.ad })
      };
    }

    var birikimliMi = c.mod === 'birikimli' || (c.ozet === 'toplam' && c.mod !== 'gunluk');
    var i, g, k;

    /* Tek gösterge sorulduysa doğrudan onun cümlesi kurulur. */
    if (!genelMi && gostergeler.length === 1) {
      g = gostergeler[0];
      k = YU.analiz.karsilastir(ozet, g, K);
      baslik = 'Bu kampanyanın ' + gunMetni(ozet.bugun.gun) + 'ündeyiz. ' + cumleBaslik(g, k, ozet, K);
      satirlar.push(satir('Kampanya ' + ozet.bu.donem.ad, miktar(k.bu, g.birim), 'vurgu'));
      satirlar.push(satir('Kampanya ' + ozet.gecmis.donem.ad, miktar(k.gecmis, g.birim), 'olumsuz'));
      satirlar.push(satir('Fark', isaretli(k.fark, g.birim) +
        (yuzdeMetni(k.yuzde) ? ' · ' + yuzdeMetni(k.yuzde) : ''), farkTuru(k.fark)));
      satirlar.push(satir(gunMetni(K) + ' tek gün',
        miktar(k.buGun, g.birim) + ' — geçen kampanya ' + miktar(k.gecmisGun, g.birim)));
      return {
        baslik: baslik, satirlar: satirlar,
        grafik: karsilastirmaGrafigi(ozet, g, ozet.bugun.gun, birikimliMi, null),
        bag: analizBagi({
          bu: ozet.bu.donem.ad, karsi: ozet.gecmis.donem.ad, gosterge: g.kod,
          mod: birikimliMi ? 'birikimli' : 'gunluk'
        })
      };
    }

    /* Belirli birkaç kalem soruldu ("toprak nasıl" -> üretim + satış):
       özet sayısı yerine kalemlerin kendisi tek tek yazılır. */
    if (!genelMi && gostergeler.length >= 2 && gostergeler.length <= 4) {
      var cumleler = [];
      for (i = 0; i < gostergeler.length; i++) {
        g = gostergeler[i];
        k = YU.analiz.karsilastir(ozet, g, K);
        var konum = konumMetni(k.fark, k.yuzde);
        cumleler.push(g.kisaAd + ' ' + miktar(k.bu, g.birim) +
          (k.gecmis !== null ? ' (geçen kampanya ' + miktar(k.gecmis, g.birim) + (konum ? ', ' + konum : '') + ')' : ''));
        satirlar.push(satir(g.ad, miktar(k.bu, g.birim) + ' ↔ ' + miktar(k.gecmis, g.birim) +
          (konum ? ' · ' + konum : ''), farkTuru(k.fark)));
      }
      baslik = 'Bu kampanyanın ' + gunMetni(ozet.bugun.gun) + 'ündeyiz. İlk ' + YU.fmt.sayi(K) +
        ' günde ' + cumleler.join('; ') + '.';
      return {
        baslik: baslik, satirlar: satirlar,
        grafik: karsilastirmaGrafigi(ozet, gostergeler[0], ozet.bugun.gun, birikimliMi, null),
        ikinciGrafik: gostergeler[1]
          ? karsilastirmaGrafigi(ozet, gostergeler[1], ozet.bugun.gun, birikimliMi, null) : null,
        bag: analizBagi({
          bu: ozet.bu.donem.ad, karsi: ozet.gecmis.donem.ad, gosterge: gostergeler[0].kod,
          mod: birikimliMi ? 'birikimli' : 'gunluk'
        })
      };
    }

    /* Genel soru: bütün kalemlerin özeti + öne çıkanlar. */
    var hepsi = [];
    if (gostergeler.length) {
      for (i = 0; i < gostergeler.length; i++) hepsi.push(YU.analiz.karsilastir(ozet, gostergeler[i], K));
    } else {
      hepsi = YU.analiz.tumKarsilastirma(ozet, K);
    }
    var onde = 0, geride = 0, esit = 0;
    for (i = 0; i < hepsi.length; i++) {
      if (hepsi[i].fark === null) continue;
      if (hepsi[i].fark > 0) onde++; else if (hepsi[i].fark < 0) geride++; else esit++;
    }
    var artan = YU.analiz.siralaFark(hepsi, 'artan');
    var azalan = YU.analiz.siralaFark(hepsi, 'azalan');

    baslik = 'Bu kampanyanın ' + gunMetni(ozet.bugun.gun) + 'ündeyiz. Kampanya ' +
      ozet.gecmis.donem.ad + ' ile ilk ' + YU.fmt.sayi(K) + ' gün karşılaştırıldığında ' +
      YU.fmt.sayi(onde) + ' kalemde öndeyiz, ' + YU.fmt.sayi(geride) + ' kalemde gerideyiz' +
      (esit ? ', ' + YU.fmt.sayi(esit) + ' kalemde başa başız' : '') + '.';

    if (artan.length && artan[0].yuzde !== null && artan[0].fark > 0) {
      satirlar.push(satir('En çok artan', artan[0].gosterge.ad + ' · ' + yuzdeMetni(artan[0].yuzde) +
        ' (' + miktar(artan[0].gecmis, artan[0].gosterge.birim) + ' → ' + miktar(artan[0].bu, artan[0].gosterge.birim) + ')', 'olumlu'));
    }
    if (azalan.length && azalan[0].yuzde !== null && azalan[0].fark < 0) {
      satirlar.push(satir('En çok düşen', azalan[0].gosterge.ad + ' · ' + yuzdeMetni(azalan[0].yuzde) +
        ' (' + miktar(azalan[0].gecmis, azalan[0].gosterge.birim) + ' → ' + miktar(azalan[0].bu, azalan[0].gosterge.birim) + ')', 'olumsuz'));
    }
    satirlar.push(satir('Karşılaştırma günü', gunMetni(K) + ' · ' +
      YU.fmt.tarih(YU.analiz.gunTarihi(ozet.bu, K)) + ' ↔ ' + YU.fmt.tarih(YU.analiz.gunTarihi(ozet.gecmis, K))));
    if (K < ozet.bugun.gun) {
      satirlar.push(satir('Not', 'Geçmiş kampanyada ' + YU.fmt.sayi(ozet.gecmis.sonGun) +
        ' gün kayıt var; karşılaştırma ilk ' + YU.fmt.sayi(K) + ' gün üzerinden yapıldı.'));
    }

    /* Grafiğe konan kalem: soru bir kalemi işaret ediyorsa o, yoksa
       kampanyanın ana kalemi (dökme üretim). */
    var odak = gostergeler.length ? gostergeler[0]
      : (YU.analiz.gostergeBul(ozet.gostergeler, 'dokme-uretim') || (hepsi.length ? hepsi[0].gosterge : null));

    /* Sıralama grafiği MUTLAK değişime göre: en çok artan da en çok düşen
       de üstte görünsün, tablo tek yöne kaymasın. */
    var mutlak = hepsi.slice().sort(function (a, b) {
      var ya = a.yuzde === null ? -1 : Math.abs(a.yuzde);
      var yb = b.yuzde === null ? -1 : Math.abs(b.yuzde);
      return yb - ya;
    });

    return {
      baslik: baslik, satirlar: satirlar,
      grafik: siraGrafigi(mutlak, 'İlk ' + YU.fmt.sayi(K) + ' günde en çok değişen kalemler', 8),
      ikinciGrafik: odak ? karsilastirmaGrafigi(ozet, odak, ozet.bugun.gun, false, 'Günlük · ' + odak.ad) : null,
      bag: analizBagi({ bu: ozet.bu.donem.ad, karsi: ozet.gecmis.donem.ad, gosterge: odak ? odak.kod : null })
    };
  }

  /* "Dökme küspe üretiminde 131.610 kg'dayız; geçen kampanya aynı günlerde
      140.810 kg'daydı — %6,5 geride." */
  function cumleBaslik(g, k, ozet, K) {
    if (k.gecmis === null) {
      return g.ad + ' ilk ' + YU.fmt.sayi(K) + ' günde ' + miktar(k.bu, g.birim) + '.';
    }
    var konum = konumMetni(k.fark, k.yuzde);
    return g.ad + ' ilk ' + YU.fmt.sayi(K) + ' günde ' + miktar(k.bu, g.birim) +
      '; Kampanya ' + ozet.gecmis.donem.ad + ' aynı gün sırasında ' + miktar(k.gecmis, g.birim) +
      (konum ? ' — ' + konum + '.' : '.');
  }

  /* ------------------------------------------------------------------
     5.2 Sıralama — en çok artan / düşen
     ------------------------------------------------------------------ */

  function cevapSiralama(depo, c, ozet) {
    if (!ozet.gecmis) {
      return { baslik: 'Sıralama için iki kampanya gerekir; şu an tek kampanya var.', satirlar: [], grafik: null };
    }
    var K = ozet.karsilastirmaGunu;
    var hepsi = YU.analiz.tumKarsilastirma(ozet, K);
    var azalanMi = c.siralama === 'azalan' || c.yon === 'azalis';
    var sirali = YU.analiz.siralaFark(hepsi, azalanMi ? 'azalan' : 'artan');
    var gecerli = [], i;
    for (i = 0; i < sirali.length; i++) if (sirali[i].yuzde !== null) gecerli.push(sirali[i]);

    if (!gecerli.length) {
      return { baslik: 'Yüzde karşılaştırması yapılabilecek kalem yok — geçmiş kampanyada karşılığı olan veri bulunamadı.', satirlar: [], grafik: null };
    }

    var bas = gecerli[0];
    var baslik = (azalanMi ? 'En çok düşen: ' : 'En çok artan: ') + bas.gosterge.ad + ' · ' +
      yuzdeMetni(bas.yuzde) + ' (' + miktar(bas.gecmis, bas.gosterge.birim) + ' → ' +
      miktar(bas.bu, bas.gosterge.birim) + '). İlk ' + YU.fmt.sayi(K) + ' günün toplamı.';

    var satirlar = [];
    for (i = 1; i < Math.min(gecerli.length, 5); i++) {
      satirlar.push(satir(String(i + 1) + '.', gecerli[i].gosterge.ad + ' · ' + yuzdeMetni(gecerli[i].yuzde) +
        ' · ' + isaretli(gecerli[i].fark, gecerli[i].gosterge.birim), farkTuru(gecerli[i].fark)));
    }

    return {
      baslik: baslik,
      satirlar: satirlar,
      grafik: siraGrafigi(gecerli, (azalanMi ? 'En çok düşen' : 'En çok artan') + ' kalemler · ilk ' + YU.fmt.sayi(K) + ' gün', 8),
      ikinciGrafik: karsilastirmaGrafigi(ozet, bas.gosterge, ozet.bugun.gun, true, 'Birikimli · ' + bas.gosterge.ad),
      bag: analizBagi({ bu: ozet.bu.donem.ad, karsi: ozet.gecmis.donem.ad, gosterge: bas.gosterge.kod, mod: 'birikimli' })
    };
  }

  /* ------------------------------------------------------------------
     5.3 Zirve / dip — en yüksek ya da en düşük gün
     ------------------------------------------------------------------ */

  function cevapZirve(depo, c, ozet) {
    var gostergeler = gostergeleriSec(depo, c, ozet);
    var g = gostergeler.length ? gostergeler[0] : YU.analiz.gostergeBul(ozet.gostergeler, 'dokme-uretim');
    if (!g) return { baslik: 'Hangi kalemi kastettiğinizi çıkaramadım.', satirlar: [], grafik: null };

    var enBuyukMu = c.siralama !== 'dusuk';
    var veri = c.donemGecmis && ozet.gecmis ? ozet.gecmis : ozet.bu;
    var sonGun = c.donemGecmis && ozet.gecmis ? ozet.gecmis.sonGun : ozet.bugun.gun;
    var uc = YU.analiz.ucNokta(veri, g, 1, sonGun, enBuyukMu);

    if (!uc) return { baslik: g.ad + ' için kayıtlı gün yok.', satirlar: [], grafik: null };

    var baslik = (enBuyukMu ? 'En yüksek ' : 'En düşük ') + g.kisaAd + ' ' + gunMetni(uc.gun) +
      ' (' + YU.fmt.tarih(uc.tarih) + '): ' + miktar(uc.deger, g.birim) + '.';

    var pencere = YU.analiz.pencere(veri, g, 1, sonGun);
    var satirlar = [
      satir('Kampanya', 'Kampanya ' + veri.donem.ad + ' · ' + YU.fmt.sayi(pencere.kayitliGun) + ' gün kayıt'),
      satir('Dönem toplamı', miktar(pencere.toplam, g.birim)),
      satir('Günlük ortalama', ortalamaMetni(pencere.ortalama, g.birim))
    ];
    var ters = YU.analiz.ucNokta(veri, g, 1, sonGun, !enBuyukMu);
    if (ters) {
      satirlar.push(satir(enBuyukMu ? 'En düşük gün' : 'En yüksek gün',
        gunMetni(ters.gun) + ' · ' + YU.fmt.tarih(ters.tarih) + ' · ' + miktar(ters.deger, g.birim)));
    }

    return {
      baslik: baslik, satirlar: satirlar,
      grafik: seriGrafigi(veri, g, 1, sonGun, 'Günlük · ' + g.ad + ' · Kampanya ' + veri.donem.ad),
      bag: analizBagi({ bu: veri.donem.ad, gosterge: g.kod })
    };
  }

  /* ------------------------------------------------------------------
     5.4 Belirli gün
     ------------------------------------------------------------------ */

  function cevapGunDegeri(depo, c, ozet) {
    var N = c.siraGun;
    var gostergeler = gostergeleriSec(depo, c, ozet);
    if (!gostergeler.length) gostergeler = [YU.analiz.gostergeBul(ozet.gostergeler, 'dokme-uretim')];
    var g = gostergeler[0];
    if (!g) return { baslik: 'Hangi kalemi kastettiğinizi çıkaramadım.', satirlar: [], grafik: null };

    var buDeger = N <= ozet.bu.sonGun ? YU.analiz.gunDegeri(ozet.bu, g, YU.analiz.gunTarihi(ozet.bu, N)) : null;
    var gecmisDeger = (ozet.gecmis && N <= ozet.gecmis.sonGun)
      ? YU.analiz.gunDegeri(ozet.gecmis, g, YU.analiz.gunTarihi(ozet.gecmis, N)) : null;

    var baslik, satirlar = [];
    if (buDeger === null && gecmisDeger === null) {
      baslik = gunMetni(N) + ' için kayıt yok. Bu kampanyada ' + YU.fmt.sayi(ozet.bu.sonGun) + ' gün kayıtlı.';
    } else {
      var fark = (buDeger !== null && gecmisDeger !== null) ? YU.yuvarla(buDeger - gecmisDeger) : null;
      var yuzde = YU.analiz.yuzdeFark(buDeger, gecmisDeger);
      baslik = gunMetni(N) + ' (' + YU.fmt.tarih(YU.analiz.gunTarihi(ozet.bu, N)) + ') ' + g.kisaAd + ': ' +
        miktar(buDeger, g.birim) +
        (gecmisDeger !== null
          ? '. Kampanya ' + ozet.gecmis.donem.ad + ' aynı günde ' + miktar(gecmisDeger, g.birim) +
            (konumMetni(fark, yuzde) ? ' — ' + konumMetni(fark, yuzde) + '.' : '.')
          : '.');
      satirlar.push(satir('Kampanya ' + ozet.bu.donem.ad,
        miktar(buDeger, g.birim) + ' · ' + YU.fmt.tarih(YU.analiz.gunTarihi(ozet.bu, N)), 'vurgu'));
      if (ozet.gecmis) {
        satirlar.push(satir('Kampanya ' + ozet.gecmis.donem.ad,
          miktar(gecmisDeger, g.birim) + ' · ' + YU.fmt.tarih(YU.analiz.gunTarihi(ozet.gecmis, N)), 'olumsuz'));
      }
      var birikim = YU.analiz.pencere(ozet.bu, g, 1, N);
      satirlar.push(satir('1–' + gunMetni(N) + ' toplamı', miktar(birikim.toplam, g.birim)));
    }
    for (var i = 1; i < gostergeler.length; i++) {
      var g2 = gostergeler[i];
      if (!g2) continue;
      var d2 = N <= ozet.bu.sonGun ? YU.analiz.gunDegeri(ozet.bu, g2, YU.analiz.gunTarihi(ozet.bu, N)) : null;
      satirlar.push(satir(g2.ad, miktar(d2, g2.birim)));
    }

    return {
      baslik: baslik, satirlar: satirlar,
      grafik: karsilastirmaGrafigi(ozet, g, Math.max(N, ozet.bugun.gun), false, 'Günlük · ' + g.ad),
      bag: analizBagi({ bu: ozet.bu.donem.ad, karsi: ozet.gecmis ? ozet.gecmis.donem.ad : null, gosterge: g.kod })
    };
  }

  /* ------------------------------------------------------------------
     5.5 Pencere — ilk N gün / son N gün
     ------------------------------------------------------------------ */

  function cevapPencere(depo, c, ozet) {
    var n = Math.max(1, c.kapsamSayi || 7);
    var gostergeler = gostergeleriSec(depo, c, ozet);
    if (!gostergeler.length) gostergeler = [YU.analiz.gostergeBul(ozet.gostergeler, 'dokme-uretim')];
    var g = gostergeler[0];
    if (!g) return { baslik: 'Hangi kalemi kastettiğinizi çıkaramadım.', satirlar: [], grafik: null };

    var veri = c.donemGecmis && ozet.gecmis ? ozet.gecmis : ozet.bu;
    var sonGun = veri === ozet.bu ? ozet.bugun.gun : veri.sonGun;
    var bas, bit;
    /* "geçen hafta" son haftanın bir öncesidir: pencere geriye kaydırılır. */
    var kaydirma = Math.max(0, Number(c.haftaKaydir) || 0);
    if (c.kapsam === 'son') { bit = Math.max(1, sonGun - kaydirma); bas = Math.max(1, bit - n + 1); }
    else { bas = 1; bit = Math.min(n, sonGun); }

    var p = YU.analiz.pencere(veri, g, bas, bit);
    var onEk = kaydirma ? 'Geçen haftanın son ' : (c.kapsam === 'son' ? 'Son ' : 'İlk ');
    var baslik = onEk + YU.fmt.sayi(bit - bas + 1) + ' günde (' +
      gunMetni(bas) + ' – ' + gunMetni(bit) + ') ' + g.kisaAd + ' toplamı ' + miktar(p.toplam, g.birim) +
      '; günlük ortalama ' + ortalamaMetni(p.ortalama, g.birim) + '.';

    var satirlar = [
      satir('Tarih aralığı', YU.fmt.tarih(YU.analiz.gunTarihi(veri, bas)) + ' – ' + YU.fmt.tarih(YU.analiz.gunTarihi(veri, bit))),
      satir('Kayıtlı gün', YU.fmt.sayi(p.kayitliGun) + ' gün')
    ];
    var zirve = YU.analiz.zirve(veri, g, bas, bit);
    var dip = YU.analiz.dip(veri, g, bas, bit);
    if (zirve) satirlar.push(satir('En yüksek gün', gunMetni(zirve.gun) + ' · ' + miktar(zirve.deger, g.birim), 'olumlu'));
    if (dip) satirlar.push(satir('En düşük gün', gunMetni(dip.gun) + ' · ' + miktar(dip.deger, g.birim), 'olumsuz'));

    if (ozet.gecmis && veri === ozet.bu && bit <= ozet.gecmis.sonGun) {
      var gp = YU.analiz.pencere(ozet.gecmis, g, bas, bit);
      var fark = YU.yuvarla(p.toplam - gp.toplam);
      var yuzde = YU.analiz.yuzdeFark(p.toplam, gp.toplam);
      satirlar.push(satir('Kampanya ' + ozet.gecmis.donem.ad + ' aynı günler',
        miktar(gp.toplam, g.birim) + (konumMetni(fark, yuzde) ? ' · ' + konumMetni(fark, yuzde) : ''), farkTuru(fark)));
    }

    return {
      baslik: baslik, satirlar: satirlar,
      grafik: seriGrafigi(veri, g, bas, bit, 'Günlük · ' + g.ad + ' · ' + gunMetni(bas) + '–' + gunMetni(bit)),
      bag: analizBagi({ bu: veri.donem.ad, gosterge: g.kod })
    };
  }

  /* ------------------------------------------------------------------
     5.6 Ortalama
     ------------------------------------------------------------------ */

  function cevapOrtalama(depo, c, ozet) {
    var gostergeler = gostergeleriSec(depo, c, ozet);
    if (!gostergeler.length) gostergeler = [YU.analiz.gostergeBul(ozet.gostergeler, 'dokme-uretim')];
    var g = gostergeler[0];
    if (!g) return { baslik: 'Hangi kalemi kastettiğinizi çıkaramadım.', satirlar: [], grafik: null };

    var veri = c.donemGecmis && ozet.gecmis ? ozet.gecmis : ozet.bu;
    var sonGun = veri === ozet.bu ? ozet.bugun.gun : veri.sonGun;
    var p = YU.analiz.pencere(veri, g, 1, sonGun);

    var baslik = 'Kampanya ' + veri.donem.ad + ' · ' + g.kisaAd + ' günlük ortalaması ' +
      ortalamaMetni(p.ortalama, g.birim) + ' (' + YU.fmt.sayi(p.kayitliGun) + ' kayıtlı gün, toplam ' +
      miktar(p.toplam, g.birim) + ').';

    var satirlar = [];
    if (ozet.gecmis && veri === ozet.bu) {
      var K = ozet.karsilastirmaGunu;
      var buK = YU.analiz.pencere(ozet.bu, g, 1, K);
      var gecmisK = YU.analiz.pencere(ozet.gecmis, g, 1, K);
      var fark = (buK.ortalama !== null && gecmisK.ortalama !== null) ? YU.yuvarla(buK.ortalama - gecmisK.ortalama) : null;
      var yuzde = YU.analiz.yuzdeFark(buK.ortalama, gecmisK.ortalama);
      satirlar.push(satir('Kampanya ' + ozet.gecmis.donem.ad + ' ortalaması',
        ortalamaMetni(gecmisK.ortalama, g.birim) + ' (ilk ' + YU.fmt.sayi(K) + ' gün)', 'olumsuz'));
      satirlar.push(satir('Aynı günlerde bizim ortalama', ortalamaMetni(buK.ortalama, g.birim), 'vurgu'));
      if (fark !== null) satirlar.push(satir('Fark', isaretli(fark, g.birim) + (yuzdeMetni(yuzde) ? ' · ' + yuzdeMetni(yuzde) : ''), farkTuru(fark)));
    }
    var zirve = YU.analiz.zirve(veri, g, 1, sonGun);
    if (zirve) satirlar.push(satir('En yüksek gün', gunMetni(zirve.gun) + ' · ' + miktar(zirve.deger, g.birim)));

    return {
      baslik: baslik, satirlar: satirlar,
      grafik: seriGrafigi(veri, g, 1, sonGun, 'Günlük · ' + g.ad),
      bag: analizBagi({ bu: veri.donem.ad, gosterge: g.kod })
    };
  }

  /* ------------------------------------------------------------------
     5.7 Değer sorgusu — "ne kadar X"
     ------------------------------------------------------------------ */

  function cevapDeger(depo, c, ozet) {
    var gostergeler = gostergeleriSec(depo, c, ozet);
    if (!gostergeler.length) return cevapKarsilastirma(depo, c, ozet, true);

    var veri = c.donemGecmis && ozet.gecmis ? ozet.gecmis : ozet.bu;
    var sonGun = veri === ozet.bu ? ozet.bugun.gun : veri.sonGun;
    var g = gostergeler[0];
    var p = YU.analiz.pencere(veri, g, 1, sonGun);

    var baslik = 'Kampanya ' + veri.donem.ad + ' · ' + g.kisaAd + ' 1–' + gunMetni(sonGun) +
      ' toplamı ' + miktar(p.toplam, g.birim) + '.';

    var satirlar = [
      satir('Günlük ortalama', ortalamaMetni(p.ortalama, g.birim)),
      satir('Kayıtlı gün', YU.fmt.sayi(p.kayitliGun) + ' gün · ' +
        YU.fmt.tarih(veri.donem.bas) + ' – ' + YU.fmt.tarih(YU.analiz.gunTarihi(veri, sonGun)))
    ];
    var i;
    for (i = 1; i < gostergeler.length; i++) {
      var g2 = gostergeler[i];
      var p2 = YU.analiz.pencere(veri, g2, 1, sonGun);
      satirlar.push(satir(g2.ad, miktar(p2.toplam, g2.birim)));
    }
    if (ozet.gecmis && veri === ozet.bu) {
      var K = ozet.karsilastirmaGunu;
      var k = YU.analiz.karsilastir(ozet, g, K);
      satirlar.push(satir('Kampanya ' + ozet.gecmis.donem.ad + ' (ilk ' + YU.fmt.sayi(K) + ' gün)',
        miktar(k.gecmis, g.birim) + (konumMetni(k.fark, k.yuzde) ? ' · ' + konumMetni(k.fark, k.yuzde) : ''), farkTuru(k.fark)));
    }

    return {
      baslik: baslik, satirlar: satirlar,
      grafik: veri === ozet.bu && ozet.gecmis
        ? karsilastirmaGrafigi(ozet, g, sonGun, true, 'Birikimli · ' + g.ad)
        : seriGrafigi(veri, g, 1, sonGun, 'Günlük · ' + g.ad),
      bag: analizBagi({ bu: veri.donem.ad, karsi: ozet.gecmis ? ozet.gecmis.donem.ad : null, gosterge: g.kod, mod: 'birikimli' })
    };
  }

  /* ------------------------------------------------------------------
     5.8 Kampanya günü / kayıt sayısı
     ------------------------------------------------------------------ */

  function cevapKampanyaGunu(depo, c, ozet) {
    var b = ozet.bugun;
    var baslik = 'Kampanya ' + ozet.bu.donem.ad + ' · bugün ' + gunMetni(b.ham) + '.' +
      (b.ham > b.gun ? ' Son kayıtlı gün ' + gunMetni(b.gun) + ' (' + YU.fmt.tarih(ozet.bu.donem.bit) + ').' : '');
    var satirlar = [
      satir('1. gün (devir)', YU.fmt.tarih(ozet.bu.donem.bas)),
      satir('Bugün', YU.fmt.tarih(YU.tarih.bugun())),
      satir('Kayıtlı gün', YU.fmt.sayi(ozet.bu.kayitliGun) + ' gün')
    ];
    if (ozet.gecmis) {
      satirlar.push(satir('Kampanya ' + ozet.gecmis.donem.ad + ' aynı gün',
        YU.fmt.tarih(YU.analiz.gunTarihi(ozet.gecmis, b.gun)) + ' · ' +
        YU.fmt.sayi(ozet.gecmis.sonGun) + ' gün kayıt'));
    }
    var g = YU.analiz.gostergeBul(ozet.gostergeler, 'dokme-uretim');
    return {
      baslik: baslik, satirlar: satirlar,
      grafik: g ? karsilastirmaGrafigi(ozet, g, b.gun, false, 'Günlük · ' + g.ad) : null,
      bag: analizBagi({ bu: ozet.bu.donem.ad, karsi: ozet.gecmis ? ozet.gecmis.donem.ad : null })
    };
  }

  function cevapKayit(depo, c, ozet) {
    var gunler = YU.stok.kayitliGunler(depo, ozet.bu.donem.bas, ozet.bu.donem.bit);
    var baslik = 'Kampanya ' + ozet.bu.donem.ad + ' için ' + YU.fmt.sayi(gunler.length) +
      ' gün veri girilmiş (' + YU.fmt.tarih(ozet.bu.donem.bas) + ' – ' + YU.fmt.tarih(ozet.bu.donem.bit) + ').';
    var satirlar = [];
    if (gunler.length) {
      satirlar.push(satir('Son kayıt', YU.fmt.tarih(gunler[0].tarih) +
        (gunler[0].kullanici ? ' · ' + gunler[0].kullanici : '')));
      satirlar.push(satir('İlk kayıt', YU.fmt.tarih(gunler[gunler.length - 1].tarih)));
    }
    var beklenen = ozet.bugun.ham;
    if (beklenen > gunler.length) {
      satirlar.push(satir('Eksik gün', YU.fmt.sayi(Math.max(0, beklenen - gunler.length)) +
        ' gün için kayıt yok (kampanya başlangıcından bugüne ' + YU.fmt.sayi(beklenen) + ' gün geçti).', 'bekleyen'));
    }
    for (var i = 0; i < ozet.donemler.length; i++) {
      var d = ozet.donemler[i];
      if (d.ad === ozet.bu.donem.ad) continue;
      satirlar.push(satir('Kampanya ' + d.ad, YU.fmt.sayi(d.kayitliGun) + ' gün · ' +
        YU.fmt.tarih(d.bas) + ' – ' + YU.fmt.tarih(d.bit)));
    }
    return { baslik: baslik, satirlar: satirlar, grafik: null, bag: analizBagi({ bu: ozet.bu.donem.ad }) };
  }

  /* ------------------------------------------------------------------
     5.9 Stok ve silo
     ------------------------------------------------------------------ */

  function cevapStok(depo, c) {
    var tarih = YU.tarih.bugun();
    var satirlar = [], baslik, i;

    if (c.malzemeVar) {
      var toplamMetin = [];
      for (i = 0; i < c.malzemeIdleri.length; i++) {
        var m = YU.analiz.malzemeIle(depo, c.malzemeIdleri[i]);
        if (!m) continue;
        var s = YU.analiz.malzemeStok(depo, m.Id, tarih);
        toplamMetin.push(m.Ad + ' ' + YU.fmt.kgU(s.mevcut));
        satirlar.push(satir(m.Ad, YU.fmt.kgU(s.mevcut) + ' · devir ' + YU.fmt.kgU(s.devir) +
          ' + üretim ' + YU.fmt.kgU(s.uretim) + ' − satış ' + YU.fmt.kgU(s.satis),
          s.mevcut < 0 ? 'olumsuz' : 'vurgu'));
      }
      baslik = YU.fmt.tarih(tarih) + ' itibarıyla stok: ' + toplamMetin.join(', ') + '.';
    } else {
      var hepsi = YU.analiz.tumStok(depo, tarih);
      var enBuyuk = null;
      for (i = 0; i < hepsi.length; i++) {
        var r = hepsi[i];
        satirlar.push(satir(r.malzeme.Ad, YU.fmt.kgU(r.mevcut), r.mevcut < 0 ? 'olumsuz' : null));
        if (!enBuyuk || r.mevcut > enBuyuk.mevcut) enBuyuk = r;
      }
      baslik = YU.fmt.tarih(tarih) + ' itibarıyla stok dökümü' +
        (enBuyuk ? '; en büyük kalem ' + enBuyuk.malzeme.Ad + ' ' + YU.fmt.kgU(enBuyuk.mevcut) + '.' : '.');
    }

    var stokListesi = YU.analiz.tumStok(depo, tarih);
    var ogeler = [], enB = 0;
    for (i = 0; i < stokListesi.length; i++) {
      enB = Math.max(enB, Math.abs(Number(stokListesi[i].mevcut) || 0));
    }
    for (i = 0; i < stokListesi.length; i++) {
      ogeler.push({
        ad: stokListesi[i].malzeme.Ad,
        deger: stokListesi[i].mevcut,
        birim: 'kg',
        oran: enB > 0 ? Math.abs(Number(stokListesi[i].mevcut) || 0) / enB : 0,
        tur: (Number(stokListesi[i].mevcut) || 0) < 0 ? 'olumsuz' : 'vurgu'
      });
    }

    return {
      baslik: baslik, satirlar: satirlar,
      grafik: { tur: 'deger', baslik: 'Stok dökümü · ' + YU.fmt.tarih(tarih), ogeler: ogeler },
      bag: { kod: 'stok-durumu', param: { tarih: tarih } }
    };
  }

  function cevapSilo(depo, c) {
    var tarih = YU.tarih.bugun();
    var t = YU.analiz.siloToplami(depo, tarih);
    var satirlar = [], i;
    for (i = 0; i < t.satirlar.length; i++) {
      var r = t.satirlar[i];
      var oran = r.kapasite > 0 ? r.mevcut / r.kapasite : 0;
      satirlar.push(satir(r.silo.Ad, YU.fmt.kgU(r.mevcut) + ' · ' + YU.fmt.yuzde(oran * 100) + ' dolu' +
        ' · kalan ' + YU.fmt.kgU(Math.max(0, r.kapasite - r.mevcut)),
        oran > 1 ? 'olumsuz' : (oran > 0.9 ? 'bekleyen' : 'vurgu')));
    }
    var baslik = YU.fmt.tarih(tarih) + ' itibarıyla silolarda toplam ' + YU.fmt.kgU(t.mevcut) +
      ' dökme kuru küspe var; doluluk ' + YU.fmt.yuzde(t.doluluk * 100) +
      ' (kapasite ' + YU.fmt.kgU(t.kapasite) + ').';

    var ogeler = [];
    for (i = 0; i < t.satirlar.length; i++) {
      var s = t.satirlar[i];
      var o = s.kapasite > 0 ? s.mevcut / s.kapasite : 0;
      ogeler.push({
        ad: s.silo.Ad, deger: s.mevcut, birim: 'kg', oran: Math.min(1, Math.max(0, o)),
        ek: YU.fmt.yuzde(o * 100), tur: o > 1 ? 'olumsuz' : (o > 0.9 ? 'bekleyen' : 'vurgu')
      });
    }

    return {
      baslik: baslik, satirlar: satirlar,
      grafik: { tur: 'deger', baslik: 'Silo doluluğu · ' + YU.fmt.tarih(tarih), ogeler: ogeler },
      bag: { kod: 'silo-durumu', param: { tarih: tarih } }
    };
  }

  /* ------------------------------------------------------------------
     5.10 Yardım
     ------------------------------------------------------------------ */

  soru.ornekler = function () {
    return [
      'Geçen seneye göre nasıl ilerliyoruz?',
      'Toprak satışı geçen seneye göre nasıl?',
      'Bu sene ne kadar dökme küspe ürettik?',
      'En çok artan kalem hangisi?',
      'En çok düşen ne?',
      '15. günde ne kadar üretmişiz?',
      'Son 7 günde üretim nasıl?',
      'Günlük ortalama dökme üretimi ne kadar?',
      'En yüksek üretim hangi gün oldu?',
      'Elimizde ne kadar toprak var?',
      'Silolar ne durumda?',
      'Kaçıncı gündeyiz?',
      'Kaç gün veri girilmiş?',
      'Çuvallama geçen seneye göre artmış mı?'
    ];
  };

  function cevapYardim() {
    return {
      baslik: 'Kampanya verisiyle ilgili soruları yanıtlıyorum: karşılaştırma, toplam, ortalama, en yüksek/düşük gün, sıralama, stok ve silo durumu.',
      satirlar: [
        satir('Karşılaştırma', 'Takvim tarihine göre değil kampanya gününe göre: bugün 30. günse geçen kampanyanın 30. günü karşısına konur.'),
        satir('Yazım', 'Türkçe harf kullanmak zorunlu değil — "gecen sene dokme kuspe" ile "geçen sene dökme küspe" aynı.'),
        satir('Kapsam', 'Yalnızca girilmiş veriyi kullanırım; yorum ve tahmin yapmam.')
      ],
      grafik: null,
      oneriler: soru.ornekler()
    };
  }

  /* ==================================================================
     6. "Anladığım" — çözümlemenin insan diline dökümü

     Cevabın yanında ne anlaşıldığı MUTLAKA gösterilir. Yanlış okuma sessiz
     kalmamalı: kullanıcı rozetlere bakıp sorusunu düzeltebilmeli. Motor bir
     kelimeyi yanlış eşleştirdiğinde bu satır onu ele verir.
     ================================================================== */

  var NIYET_ADI = {
    'karsilastirma': 'Kampanya karşılaştırması',
    'genel-durum': 'Genel durum',
    'deger': 'Toplam değer',
    'siralama': 'Kalem sıralaması',
    'zirve': 'En yüksek / en düşük gün',
    'gun-degeri': 'Belirli gün',
    'pencere': 'Gün aralığı',
    'ortalama': 'Günlük ortalama',
    'stok': 'Stok durumu',
    'silo': 'Silo durumu',
    'kampanya-gunu': 'Kampanya günü',
    'kayit': 'Kayıt dökümü',
    'yardim': 'Yardım'
  };

  soru.anlamOzeti = function (depo, c, ozet) {
    var cipler = [], i;
    cipler.push(NIYET_ADI[c.niyet] || 'Genel durum');

    if (c.malzemeVar) {
      var adlar = [];
      for (i = 0; i < c.malzemeIdleri.length && adlar.length < 3; i++) {
        var m = YU.analiz.malzemeIle(depo, c.malzemeIdleri[i]);
        if (m) adlar.push(m.Ad);
      }
      if (c.malzemeIdleri.length > adlar.length) adlar.push('+' + (c.malzemeIdleri.length - adlar.length));
      if (adlar.length) cipler.push(adlar.join(', '));
    }
    if (c.olcut === 'uretim') cipler.push('Üretim');
    else if (c.olcut === 'satis') cipler.push('Satış');
    else if (c.olcut === 'cuvallama') cipler.push('Çuvallama');
    else if (c.olcut === 'stok') cipler.push('Stok');
    else if (c.olcut === 'doluluk') cipler.push('Doluluk');

    if (c.siraGun !== null) {
      cipler.push(gunMetni(c.siraGun) +
        (ozet ? ' · ' + YU.fmt.tarih(YU.analiz.gunTarihi(ozet.bu, c.siraGun)) : ''));
    } else if (c.kapsam) {
      cipler.push((c.kapsam === 'son' ? 'Son ' : 'İlk ') + YU.fmt.sayi(c.kapsamSayi || 7) + ' gün');
    }

    if (ozet) {
      if (c.niyet === 'karsilastirma' || c.niyet === 'genel-durum' || c.niyet === 'siralama') {
        cipler.push(ozet.gecmis
          ? 'Kampanya ' + ozet.bu.donem.ad + ' ↔ ' + ozet.gecmis.donem.ad
          : 'Kampanya ' + ozet.bu.donem.ad);
      } else if (c.donemGecmis && ozet.gecmis) {
        cipler.push('Kampanya ' + ozet.gecmis.donem.ad);
      } else if (c.niyet !== 'stok' && c.niyet !== 'silo') {
        cipler.push('Kampanya ' + ozet.bu.donem.ad);
      }
    }
    if (c.mod === 'birikimli') cipler.push('Birikimli');
    return cipler;
  };

  /* Sorudaki hangi kelimenin neye çevrildiği — düşük güvende gösterilir. */
  soru.kelimeEslesmeleri = function (c) {
    var l = [], i;
    for (i = 0; i < c.eslesmeler.length; i++) {
      var e = c.eslesmeler[i];
      var ham = [];
      for (var j = e.bas; j <= e.bit && j < c.kelimeler.length; j++) ham.push(c.kelimeler[j].ham);
      l.push({
        yazilan: ham.join(' '),
        anlasilan: e.metin,
        kavram: e.kavram,
        birebir: e.puan >= 1 && !e.bolundu,
        bolundu: !!e.bolundu
      });
    }
    return l;
  };

  /* ==================================================================
     7. Dış kapı
     ================================================================== */

  /* Tam çözümleme: sözlük + kampanya bağlamı + göreli gün ifadesi.
     `coz` tek başına kampanya bağlamını bilmez ("dün" hangi gün?); bu kapı
     ikisini birleştirir ve hem cevap motoru hem testler bunu kullanır. */
  soru.cozTam = function (depo, metin) {
    var c = soru.coz(depo, metin);
    var donemSecim = donemleriSec(c, null);
    var ozet = YU.analiz.ozet(depo, donemSecim.buAd, donemSecim.gecmisAd);

    /* Göreli gün ifadesi ancak kampanya bağlamı belliyken çözülebilir:
       "dün" = bugünkü kampanya günü − 1, "3 gün önce" = bugün − 3. */
    if (ozet && c.gunIfadesi) {
      var b = ozet.bugun.gun;
      var n = c.gunIfadesi.n || 0;
      if (c.gunIfadesi.tur === 'bugun') c.siraGun = b;
      else if (c.gunIfadesi.tur === 'dun') c.siraGun = Math.max(1, b - 1);
      else if (c.gunIfadesi.tur === 'once') c.siraGun = Math.max(1, b - n);
      else if (c.gunIfadesi.tur === 'ilk') c.siraGun = 1;
      else if (c.gunIfadesi.tur === 'son') c.siraGun = b;
      soru.niyetiBelirle(c);
    }
    return { cozum: c, ozet: ozet };
  };

  soru.cevapla = function (depo, metin) {
    if (!metin || !String(metin).trim()) {
      return { basarili: false, baslik: 'Bir soru yazın.', satirlar: [], oneriler: soru.ornekler() };
    }
    var tam = soru.cozTam(depo, metin);
    var c = tam.cozum, ozet = tam.ozet;

    if (c.niyet === 'yardim') {
      var y = cevapYardim();
      y.basarili = true; y.cozum = c;
      y.anlam = ['Yardım'];
      return y;
    }

    if (!ozet) {
      return {
        basarili: false, cozum: c,
        baslik: 'Kampanya dönemi tanımlı olmadığı için soruyu yanıtlayamıyorum.',
        satirlar: [satir('Neden', 'Karşılaştırma devir tarihine göre kurulur; devir stok girilince kampanya dönemi oluşur.')],
        oneriler: []
      };
    }

    if (!c.anlasildi) {
      return {
        basarili: false, cozum: c,
        baslik: 'Bu soruyu anlayamadım.',
        satirlar: [satir('İpucu', 'Kalemi ("toprak satışı"), dönemi ("geçen sene") ya da günü ("15. gün") yazarsanız yanıtlayabilirim.')],
        oneriler: soru.ornekler()
      };
    }

    var sonuc;
    switch (c.niyet) {
      case 'kampanya-gunu': sonuc = cevapKampanyaGunu(depo, c, ozet); break;
      case 'kayit': sonuc = cevapKayit(depo, c, ozet); break;
      case 'silo': sonuc = cevapSilo(depo, c); break;
      case 'stok': sonuc = cevapStok(depo, c); break;
      case 'siralama': sonuc = cevapSiralama(depo, c, ozet); break;
      case 'zirve': sonuc = cevapZirve(depo, c, ozet); break;
      case 'ortalama': sonuc = cevapOrtalama(depo, c, ozet); break;
      case 'gun-degeri': sonuc = cevapGunDegeri(depo, c, ozet); break;
      case 'pencere': sonuc = cevapPencere(depo, c, ozet); break;
      case 'karsilastirma': sonuc = cevapKarsilastirma(depo, c, ozet, !c.malzemeVar && !c.olcut); break;
      case 'deger': sonuc = cevapDeger(depo, c, ozet); break;
      /* "toprak nasıl gidiyor" genel durum niyetiyle gelir ama TEK KALEMİ
         sorar: kalem belliyse genel özet değil o kalemin cümlesi kurulur. */
      case 'genel-durum': sonuc = cevapKarsilastirma(depo, c, ozet, !c.malzemeVar && !c.olcut); break;
      default: sonuc = cevapKarsilastirma(depo, c, ozet, !c.malzemeVar && !c.olcut); break;
    }

    sonuc.basarili = true;
    sonuc.cozum = c;
    sonuc.niyet = c.niyet;
    sonuc.guven = c.guven;
    sonuc.anlam = soru.anlamOzeti(depo, c, ozet);
    sonuc.eslesmeler = soru.kelimeEslesmeleri(c);
    if (!sonuc.satirlar) sonuc.satirlar = [];
    return sonuc;
  };
})();

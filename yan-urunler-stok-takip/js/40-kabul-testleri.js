/* 40-kabul-testleri.js — Şartname §9'daki 12 kabul testini tarayıcı içinde
   çalıştıran ekran (SOZLESME.md §10).

   Testler YU.Depo({kaynak:'bellek'}) üzerinde çalışır: kullanıcının
   localStorage'daki gerçek verisi hiçbir testte okunmaz da yazılmaz da.
   Tek istisna Test 7'dir — yetki kapısı ancak gerçek yönlendirici üzerinde
   sınanabilir; o test DOM'a dokunur ve sonunda oturumu, adresi, sayfa
   başlığını ve menü işaretini eski hâline geri koyar (ayrıntı: test7()). */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});

  /* Şartname §9 tarihleri — DEMİRBAŞ, değiştirilmez. */
  var GUN1 = '2026-07-03';
  var GUN2 = '2026-07-04';
  var DEVIR_GUNU = '2026-07-01';   /* yalnızca Test 4'ün başlangıç stoğu için */

  /* Test 7 adresi önce #/devir-stok yapar, sonra geri alır. Tarayıcı iki
     hashchange'i de sıraya koyar ve ikisi de biz geri döndükten SONRA çalışır;
     yani bu sayfa en çok iki kez gecikmeli olarak yeniden çizilir. O çizimlerde
     testler yeniden koşarsa Test 7 tekrar gezinir ve sayfa sonsuz döngüye
     girer — bu yüzden sayaç + zaman penceresi ile saklanan sonuç basılır. */
  var BEKLENEN_GERI_CIZIM = 2;
  var GERI_DONUS_MS = 2000;

  var sonKosu = null;      /* son koşunun sonuçları — geri dönüşte yeniden basılır */
  var sonGezinme = 0;      /* Test 7'nin adres değişikliğini yaptığı an */
  var bekleyenCizim = 0;   /* o gezinmeden doğması beklenen yeniden çizim sayısı */
  var sonKap = null;       /* kabuğun bize verdiği içerik kabı — Test 7 okur */

  /* ==================================================================
     1. Küçük yardımcılar
     ================================================================== */

  function kg(n) { return YU.fmt.kgU(n); }

  /* İstanbul saati, kaynağı internet (YU.zaman · 26.08.2026). */
  function saatMetni() { return YU.zaman.saat(); }

  var zamanAl = (window.performance && window.performance.now)
    ? function () { return window.performance.now(); }
    : function () { return Date.now(); };

  function sureMetni(ms) {
    return YU.fmt.sayi(ms, ms < 10 ? 1 : 0) + ' ms';
  }

  function evetHayir(v) { return v ? 'evet' : 'hayır'; }

  function kuralMetni(kod) {
    var liste = (YU.dogrula && YU.dogrula.KURALLAR) || [], i;
    for (i = 0; i < liste.length; i++) if (liste[i].kod === kod) return liste[i].metin;
    return null;
  }

  function kodlar(hatalar) {
    var a = [], i;
    for (i = 0; i < (hatalar || []).length; i++) a.push(hatalar[i].kod);
    return a.length ? a.join(', ') : 'yok';
  }

  function kodVar(hatalar, kod) {
    var i;
    for (i = 0; i < (hatalar || []).length; i++) if (hatalar[i].kod === kod) return true;
    return false;
  }

  function kodMesaji(hatalar, kod) {
    var i;
    for (i = 0; i < (hatalar || []).length; i++) if (hatalar[i].kod === kod) return hatalar[i].mesaj || '';
    return '';
  }

  function hataOzeti(hatalar) {
    var a = [], i;
    for (i = 0; i < (hatalar || []).length; i++) {
      a.push((hatalar[i].kod || '—') + ': ' + (hatalar[i].mesaj || ''));
    }
    return a.join(' · ');
  }

  /* ==================================================================
     2. Test verisi — her test kendi temiz bellek deposuyla başlar
     ================================================================== */

  /* TEST KULLANICILARI (31.08.2026). Kodda tanımlı örnek hesaplar kaldırıldı
     (01-cekirdek · KULLANICI_TANIMI boş): artık depo hiç kullanıcı olmadan
     kuruluyor ve yönetici gerektiren her test rol denetimine takılırdı.
     Testler kendi aktörlerini burada kurar — bellek deposuna yazılır,
     localStorage'a ve gerçek kullanıcı listesine dokunmaz. */
  var TEST_KULLANICILARI = [
    { KullaniciAdi: 'test.yonetici@fabrika.com', AdSoyad: 'Test Yöneticisi', Rol: 'Yonetici' },
    { KullaniciAdi: 'test.operator@fabrika.com', AdSoyad: 'Test Operatörü', Rol: 'Operator' }
  ];

  function temizDepo() {
    /* tohumla:false => yalnızca malzeme/silo başlangıç kayıtları gelir;
       kaynak:'bellek' => depo.kaydet() no-op, localStorage'a hiç dokunulmaz. */
    var depo = YU.Depo({ kaynak: 'bellek', tohumla: false });
    for (var i = 0; i < TEST_KULLANICILARI.length; i++) {
      depo.kullanicilar.push({
        Id: depo.yeniId('Kullanicilar'),
        KullaniciAdi: TEST_KULLANICILARI[i].KullaniciAdi,
        ParolaHash: null,
        AdSoyad: TEST_KULLANICILARI[i].AdSoyad,
        Rol: TEST_KULLANICILARI[i].Rol,
        Aktif: true,
        OlusturmaTarihi: '2024-09-16T08:00:00'
      });
    }
    return depo;
  }

  function yoneticiAl(depo) {
    var i;
    for (i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].Rol === 'Yonetici' && depo.kullanicilar[i].Aktif) return depo.kullanicilar[i];
    }
    throw new Error('Temel veride aktif yönetici bulunamadı.');
  }

  function siloIdAl(depo, ad) {
    var i;
    for (i = 0; i < depo.silolar.length; i++) if (depo.silolar[i].Ad === ad) return depo.silolar[i].Id;
    throw new Error('"' + ad + '" bulunamadı.');
  }

  function malzemeAl(depo, ozelTip) {
    var i;
    for (i = 0; i < depo.malzemeler.length; i++) if (depo.malzemeler[i].OzelTip === ozelTip) return depo.malzemeler[i];
    throw new Error('"' + ozelTip + '" özel tipli malzeme bulunamadı.');
  }

  function gunuBul(depo, tarih) {
    var i;
    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      if (depo.kuruKuspeGunluk[i].Tarih === tarih) return depo.kuruKuspeGunluk[i];
    }
    return null;
  }

  function gununSiloHareketleri(depo, tarih) {
    var liste = [], i;
    for (i = 0; i < depo.siloHareket.length; i++) {
      if (depo.siloHareket[i].Tarih === tarih) liste.push(depo.siloHareket[i]);
    }
    return liste;
  }

  function siloMevcut(depo, siloId, tarih) { return YU.stok.siloStok(depo, siloId, tarih).mevcut; }

  function malzemeMevcut(depo, ozelTip, tarih) {
    return YU.stok.malzemeStok(depo, malzemeAl(depo, ozelTip).Id, tarih).mevcut;
  }

  function aktifYoneticiSayisi(depo) {
    var n = 0, i;
    for (i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].Rol === 'Yonetici' && depo.kullanicilar[i].Aktif) n++;
    }
    return n;
  }

  /* Servis girdisi tek yerden kurulur: alan adı unutulursa doğrulama sessizce
     0 sayar ve test yanlış nedenle geçer (SOZLESME §4 girdi sözleşmesi). */
  function girdiKur(o) {
    return {
      tarih: o.tarih,
      uretilenDokme: o.uretilen || 0,
      /* Çuvallanan KG (kullanıcı kararı, 02.09.2026): eskiden adet gönderiliyor
         ve kg = adet × 50 ile bulunuyordu. Kat kuralı kalkınca ara birim de
         kalktı; testler doğrudan kg yazar. */
      cuvalKg: o.cuvalKg || 0,
      satilanDokme: o.satilan || 0,
      yerlestirmeler: o.yerlestirmeler || [],
      cekisler: o.cekisler || [],
      satisCekisleri: o.satisCekisleri || [],
      rowVersion: o.rowVersion === undefined ? null : o.rowVersion
    };
  }

  function kaydet(depo, kullanici, o) {
    return YU.servis.kuruKuspeKaydet(depo, girdiKur(o), kullanici);
  }

  /* Kurulum adımı beklenmedik şekilde patlarsa test "KALDI" değil "hatalı"
     görünmeli; nedeni mesajda taşınır. */
  function hazirla(sonuc, ne) {
    if (!sonuc || !sonuc.ok) {
      throw new Error(ne + ' kurulamadı — ' + hataOzeti(sonuc && sonuc.hatalar));
    }
    return sonuc;
  }

  /* Şartname §9 Test 1 günü: 250.000 kg dökme + 10.000 kg çuvallanan, tamamı Silo 1'e. */
  function test1Gunu(depo, yon, s1) {
    return kaydet(depo, yon, {
      tarih: GUN1, uretilen: 250000, cuvalKg: 10000,
      yerlestirmeler: [{ siloId: s1, miktar: 240000 }]
    });
  }

  /* Şartname §9 Test 2 günü: 5.000 kg dökme + 10.000 kg çuvallanan, çekiş Silo 1'den. */
  function test2Gunu(depo, yon, s1) {
    return kaydet(depo, yon, {
      tarih: GUN2, uretilen: 5000, cuvalKg: 10000,
      cekisler: [{ siloId: s1, miktar: 5000 }]
    });
  }

  /* ==================================================================
     3. Test koşucusu
     ================================================================== */

  var TESTLER = [];

  /* test(ad, rozet, senaryo, fn)
     fn -> {gecti, beklenen:[{etiket,deger}], gerceklesen:[{etiket,deger}], not}
     Sınanan kural kodları döndürülen tanıma sonradan iliştirilir:
       test(...).kurallar = ['D3']; */
  function test(ad, rozet, senaryo, fn) {
    var t = {
      no: TESTLER.length + 1,
      ad: ad,
      rozet: rozet,
      senaryo: senaryo,
      calistir: fn,
      kurallar: []
    };
    TESTLER.push(t);
    return t;
  }

  /* satirlar: [[etiket, beklenen, gerceklesen], ...] — hepsi metin.
     Karşılaştırma metin üzerinden yapılır: ekranda görünen değerle
     sınanan değer aynı olsun, "geçti ama farklı gösteriyor" hâli olmasın. */
  function karsilastir(satirlar, not) {
    var beklenen = [], gerceklesen = [], gecti = true, i, s;
    for (i = 0; i < satirlar.length; i++) {
      s = satirlar[i];
      beklenen.push({ etiket: s[0], deger: String(s[1]) });
      gerceklesen.push({ etiket: s[0], deger: String(s[2]) });
      if (String(s[1]) !== String(s[2])) gecti = false;
    }
    return { gecti: gecti, beklenen: beklenen, gerceklesen: gerceklesen, not: not || '' };
  }

  /* Bir test throw ederse koşu durmaz: o test KALDI sayılır, hata metni basılır. */
  function tekKostur(t) {
    var bas = zamanAl(), s;
    try {
      s = t.calistir();
      if (!s || typeof s !== 'object') {
        s = { gecti: false, beklenen: [], gerceklesen: [], not: '', hata: 'Test bir sonuç nesnesi döndürmedi.' };
      }
    } catch (e) {
      s = {
        gecti: false, beklenen: [], gerceklesen: [], not: '',
        hata: (e && e.message) ? e.message : String(e)
      };
    }
    s.sure = zamanAl() - bas;
    return s;
  }

  function ozetle(satirlar) {
    var gecen = 0, sure = 0, i;
    for (i = 0; i < satirlar.length; i++) {
      if (satirlar[i].sonuc.gecti) gecen++;
      sure += satirlar[i].sonuc.sure || 0;
    }
    return {
      satirlar: satirlar,
      toplam: satirlar.length,
      gecen: gecen,
      kalan: satirlar.length - gecen,
      sure: sure,
      saat: saatMetni()
    };
  }

  function tumunuKostur() {
    var satirlar = [], i;
    for (i = 0; i < TESTLER.length; i++) {
      satirlar.push({ test: TESTLER[i], sonuc: tekKostur(TESTLER[i]) });
    }
    return ozetle(satirlar);
  }

  /* ==================================================================
     4. On iki test — Şartname §9, beklenen rakamlar DEMİRBAŞ
     ================================================================== */

  test('Üretim çuvallamadan fazla', 'Demirbaş',
    'Silolar boş (devir 0). 03.07.2026 için üretilen dökme 250.000 kg, çuvallanan 10.000 kg. Tamamı Silo 1\'e.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(test1Gunu(depo, yon, s1), '03.07 günü');
      var h = YU.hesap.kuruKuspe(250000, 10000, 0);
      return karsilastir([
        ['CuvalKg', kg(10000), kg(h.cuvalKg)],
        ['NetDokmeUretim', kg(240000), kg(h.netDokmeUretim)],
        ['SilodanCekilecek', kg(0), kg(h.silodanCekilecek)],
        ['Silo 1 mevcut', kg(240000), kg(siloMevcut(depo, s1, GUN1))],
        ['Dökme Kuru Küspe stok (silo toplamı)', kg(240000), kg(malzemeMevcut(depo, 'DokmeKuruKuspe', GUN1))],
        ['Kuru Küspe (50 Kg Çuvallı) stok', kg(10000), kg(malzemeMevcut(depo, 'CuvalKuruKuspe', GUN1))]
      ], 'Durum A: üretim çuvallamadan fazla. 250.000 kg\'ın 10.000\'i çuvala, 240.000\'i siloya gider.');
    }).kurallar = ['D3'];

  test('Çuvallama üretimden fazla', 'Demirbaş',
    'Test 1\'in ertesi günü (04.07.2026): üretilen dökme 5.000 kg, çuvallanan 10.000 kg. Çekiş Silo 1\'den.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(test1Gunu(depo, yon, s1), '03.07 günü');
      var r = hazirla(test2Gunu(depo, yon, s1), '04.07 günü');
      var h = YU.hesap.kuruKuspe(5000, 10000, 0);
      return karsilastir([
        ['Durum', 'B', h.durum],
        ['NetDokmeUretim', kg(0), kg(h.netDokmeUretim)],
        ['SilodanCekilecek', kg(5000), kg(h.silodanCekilecek)],
        ['Silo 1 mevcut', kg(235000), kg(siloMevcut(depo, s1, GUN2))],
        ['Ham girdi ayrı satırda (UretilenDokme)', kg(5000), kg(r.kayit.UretilenDokme)]
      ], 'Ham girdi 5.000 kg kayıtta durur; silo hareketi ise 5.000 kg çekiştir. 240.000 − 5.000 = 235.000.');
    }).kurallar = ['D5'];

  test('Aynı günü düzeltme', 'Demirbaş',
    'Test 1\'deki gün açılır, üretilen dökme 250.000\'den 300.000\'e çıkarılıp kaydedilir. Net üretim 290.000 kg Silo 1\'e.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(test1Gunu(depo, yon, s1), '03.07 günü');
      var okunan = gunuBul(depo, GUN1);
      hazirla(kaydet(depo, yon, {
        tarih: GUN1, uretilen: 300000, cuvalKg: 10000,
        yerlestirmeler: [{ siloId: s1, miktar: 290000 }],
        rowVersion: okunan.RowVersion
      }), '03.07 düzeltmesi');
      var son = gunuBul(depo, GUN1);
      return karsilastir([
        ['Silo 1 mevcut', kg(290000), kg(siloMevcut(depo, s1, GUN1))],
        ['O güne ait silo hareketi sayısı', '1', String(gununSiloHareketleri(depo, GUN1).length)],
        ['KuruKuspeGunluk satır sayısı', '1', String(depo.kuruKuspeGunluk.length)],
        ['RowVersion', '2', String(son.RowVersion)]
      ], 'Yeniden kaydetmede eski silo hareketleri KaynakKayitId üzerinden silinir; 240.000 da 530.000 da yanlış olurdu.');
    }).kurallar = ['D8', '§4 yeniden kaydetme'];

  test('Silo yetersiz', 'Demirbaş',
    'Silo 1\'de 1.000 kg varken (01.07 devri) 03.07 için çuvallama karşılığı 5.000 kg çekilmeye çalışılır.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(YU.servis.siloDevirKaydet(depo, { siloId: s1, devirTarihi: DEVIR_GUNU, miktar: 1000 }, yon), 'Silo 1 devri');
      var r = kaydet(depo, yon, {
        tarih: GUN1, uretilen: 0, cuvalKg: 5000,
        cekisler: [{ siloId: s1, miktar: 5000 }]
      });
      var mesaj = kodMesaji(r.hatalar, 'D7');
      return karsilastir([
        ['Kayıt', 'reddedildi', r.ok ? 'kabul edildi' : 'reddedildi'],
        ['D7 hatası', 'var', kodVar(r.hatalar, 'D7') ? 'var' : 'yok'],
        ['Hata yetersiz silonun adını söylüyor', 'evet', evetHayir(mesaj.indexOf('Silo 1') >= 0)],
        ['Silo 1 mevcut (değişmedi)', kg(1000), kg(siloMevcut(depo, s1, GUN1))]
      ], 'Dönen hata kodları: ' + kodlar(r.hatalar) + '. Gün başı mevcudu aşan çekiş sonraki günü de bozacağı için D14 de tetiklenir.');
    }).kurallar = ['D7'];

  test('Dağıtım toplamı tutmuyor', 'Demirbaş',
    '03.07 için üretilen dökme 250.000 kg, çuvallanan 10.000 kg — net dökme 240.000 kg iken silolara toplam 200.000 kg dağıtılır.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      var r = kaydet(depo, yon, {
        tarih: GUN1, uretilen: 250000, cuvalKg: 10000,
        yerlestirmeler: [{ siloId: s1, miktar: 200000 }]
      });
      var mesaj = kodMesaji(r.hatalar, 'D3');
      return karsilastir([
        ['Kayıt', 'reddedildi', r.ok ? 'kabul edildi' : 'reddedildi'],
        ['D3 hatası', 'var', kodVar(r.hatalar, 'D3') ? 'var' : 'yok'],
        ['Hata beklenen toplamı gösteriyor', 'evet', evetHayir(mesaj.indexOf('240.000') >= 0)],
        ['Hata girilen toplamı gösteriyor', 'evet', evetHayir(mesaj.indexOf('200.000') >= 0)],
        ['KuruKuspeGunluk satır sayısı', '0', String(depo.kuruKuspeGunluk.length)]
      ], 'Hata varken depo hiç değişmez: servis önce doğrular, sonra yazar.');
    }).kurallar = ['D3'];

  test('Çift sayım yok', 'Demirbaş',
    'Test 1\'den sonra Stok Durumu okunur: dökme kuru küspe ile çuvallı kuru küspe toplamı 250.000 kg olmalı.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(test1Gunu(depo, yon, s1), '03.07 günü');
      var dokme = malzemeMevcut(depo, 'DokmeKuruKuspe', GUN1);
      var cuvalli = malzemeMevcut(depo, 'CuvalKuruKuspe', GUN1);
      var toplam = YU.yuvarla(dokme + cuvalli);
      return karsilastir([
        ['Dökme Kuru Küspe stok', kg(240000), kg(dokme)],
        ['Kuru Küspe (50 Kg Çuvallı) stok', kg(10000), kg(cuvalli)],
        ['Dökme + Çuvallı toplam', kg(250000), kg(toplam)],
        ['Çift sayım (260.000 kg)', 'yok', toplam === 260000 ? 'var' : 'yok']
      ], 'Çuvallama yeni üretim değil, biçim değişikliğidir; çuvallanan miktar dökme üretimden düşülür.');
    }).kurallar = ['§5 çift sayım'];

  test('Yetki', 'Demirbaş',
    'Oturum geçici olarak operatöre çevrilir ve #/devir-stok adresi elle açılır. Erişim engellenmeli; menüde gizlemek tek başına yeterli değildir.',
    function () { return test7(); }
  ).kurallar = ['§3 roller'];

  test('Son yönetici koruması', 'Demirbaş',
    'Sistemdeki tek yönetici kendi hesabını açıp rolünü operatöre düşürmeye çalışır.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo);
      var oncekiSayi = aktifYoneticiSayisi(depo);
      var r = YU.servis.kullaniciKaydet(depo, {
        Id: yon.Id, KullaniciAdi: yon.KullaniciAdi, AdSoyad: yon.AdSoyad,
        Rol: 'Operator', Aktif: true
      }, yon);
      return karsilastir([
        ['Aktif yönetici sayısı', '1', String(oncekiSayi)],
        ['İşlem', 'reddedildi', r.ok ? 'kabul edildi' : 'reddedildi'],
        ['D10 hatası', 'var', kodVar(r.hatalar, 'D10') ? 'var' : 'yok'],
        ['Yöneticinin rolü (değişmedi)', 'Yonetici', String(yon.Rol)],
        ['Aktif yönetici sayısı (sonra)', '1', String(aktifYoneticiSayisi(depo))]
      ], 'Aksi hâlde sisteme kimse yönetici olarak giremezdi.');
    }).kurallar = ['D10'];

  test('Geriye dönük düzeltme sonraki günü bozuyor', 'v2',
    'Test 1 ve Test 2 girildikten sonra (Silo 1 = 235.000 kg) 03.07 açılır ve üretilen dökme 250.000\'den 8.000\'e düşürülmeye çalışılır.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(test1Gunu(depo, yon, s1), '03.07 günü');
      hazirla(test2Gunu(depo, yon, s1), '04.07 günü');
      var okunan = gunuBul(depo, GUN1);
      /* 8.000 kg üretim + 10.000 kg çuvallanan => net 0, silodan çekilecek 2.000 kg. */
      var r = kaydet(depo, yon, {
        tarih: GUN1, uretilen: 8000, cuvalKg: 10000,
        cekisler: [{ siloId: s1, miktar: 2000 }],
        rowVersion: okunan.RowVersion
      });
      var mesaj = kodMesaji(r.hatalar, 'D14');
      var tarihliMi = /\d{2}\.\d{2}\.\d{4}/.test(mesaj);
      return karsilastir([
        ['Kayıt', 'reddedildi', r.ok ? 'kabul edildi' : 'reddedildi'],
        ['D14 hatası', 'var', kodVar(r.hatalar, 'D14') ? 'var' : 'yok'],
        ['Hata hangi siloyu söylüyor', 'evet', evetHayir(mesaj.indexOf('Silo 1') >= 0)],
        ['Hata hangi tarihi söylüyor', 'evet', evetHayir(tarihliMi)],
        ['Silo 1 mevcut (değişmedi)', kg(235000), kg(siloMevcut(depo, s1, GUN2))],
        ['03.07 üretilen dökme (değişmedi)', kg(250000), kg(gunuBul(depo, GUN1).UretilenDokme)]
      ], 'Dönen hata kodları: ' + kodlar(r.hatalar) + '. D7 yalnız o günün başına bakar; sonraki günü ancak D14 korur.');
    }).kurallar = ['D14'];

  test('Gün silme', 'v2',
    'Test 1 ve Test 2 girildikten sonra 03.07 tamamen silinmeye çalışılır; ardından önce 04.07, sonra 03.07 silinir.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(test1Gunu(depo, yon, s1), '03.07 günü');
      hazirla(test2Gunu(depo, yon, s1), '04.07 günü');
      var ilk = YU.servis.gunSil(depo, GUN1, yon);
      var ikinci = YU.servis.gunSil(depo, GUN2, yon);
      var ucuncu = YU.servis.gunSil(depo, GUN1, yon);
      return karsilastir([
        ['03.07 doğrudan silme', 'reddedildi', ilk.ok ? 'silindi' : 'reddedildi'],
        ['Ret kodu D14', 'var', kodVar(ilk.hatalar, 'D14') ? 'var' : 'yok'],
        ['04.07 silme', 'silindi', ikinci.ok ? 'silindi' : 'reddedildi'],
        ['ardından 03.07 silme', 'silindi', ucuncu.ok ? 'silindi' : 'reddedildi'],
        ['Silo 1 mevcut', kg(0), kg(siloMevcut(depo, s1, GUN2))],
        ['KuruKuspeGunluk satır sayısı', '0', String(depo.kuruKuspeGunluk.length)],
        ['SiloHareket satır sayısı', '0', String(depo.siloHareket.length)]
      ], '03.07 silinseydi 04.07\'deki 5.000 kg\'lık çekiş karşılıksız kalır, Silo 1 negatife düşerdi.');
    }).kurallar = ['D14'];

  test('Dökme Satış', 'v2',
    'Test 1\'in ertesi günü: üretilen dökme 0, çuvallanan 0, satılan dökme 40.000 kg — Silo 1\'den. Önce silo karşılığı girilmeden denenir.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(test1Gunu(depo, yon, s1), '03.07 günü');
      /* Önce karşılıksız satış: reddedilmeli, depo değişmemeli. */
      var karsiliksiz = kaydet(depo, yon, { tarih: GUN2, uretilen: 0, cuvalKg: 0, satilan: 40000 });
      hazirla(kaydet(depo, yon, {
        tarih: GUN2, uretilen: 0, cuvalKg: 0, satilan: 40000,
        satisCekisleri: [{ siloId: s1, miktar: 40000 }]
      }), '04.07 dökme satışı');
      var hareketler = gununSiloHareketleri(depo, GUN2);
      return karsilastir([
        ['Karşılıksız satış kaydı', 'reddedildi', karsiliksiz.ok ? 'kabul edildi' : 'reddedildi'],
        ['Ret kodu D13', 'var', kodVar(karsiliksiz.hatalar, 'D13') ? 'var' : 'yok'],
        ['Silo 1 mevcut', kg(200000), kg(siloMevcut(depo, s1, GUN2))],
        ['Dökme Kuru Küspe stok (silo toplamı takip eder)', kg(200000), kg(malzemeMevcut(depo, 'DokmeKuruKuspe', GUN2))],
        ['O güne yazılan silo hareketi sayısı', '1', String(hareketler.length)],
        ['SiloHareket tipi', 'DokmeSatis', hareketler.length ? String(hareketler[0].HareketTipi) : 'yok']
      ], 'Dökme küspe yalnızca silolarda durur; karşılığı olmayan satış stoğu hiç azaltmazdı.');
    }).kurallar = ['D13'];

  test('Eşzamanlı düzenleme', 'v2',
    'İki oturum 03.07 kaydını aynı anda açar (aynı RowVersion okunur). Birincisi kaydeder, ikincisi eski RowVersion ile kaydetmeye çalışır.',
    function () {
      var depo = temizDepo(), yon = yoneticiAl(depo), s1 = siloIdAl(depo, 'Silo 1');
      hazirla(test1Gunu(depo, yon, s1), '03.07 günü');

      /* İki oturum da ekranı açtığı anda aynı sürümü okur. */
      var okunan = gunuBul(depo, GUN1);
      var surumA = okunan.RowVersion;
      var surumB = okunan.RowVersion;

      var a = kaydet(depo, yon, {
        tarih: GUN1, uretilen: 300000, cuvalKg: 10000,
        yerlestirmeler: [{ siloId: s1, miktar: 290000 }],
        rowVersion: surumA
      });
      var b = kaydet(depo, yon, {
        tarih: GUN1, uretilen: 100000, cuvalKg: 10000,
        yerlestirmeler: [{ siloId: s1, miktar: 90000 }],
        rowVersion: surumB
      });
      var son = gunuBul(depo, GUN1);
      return karsilastir([
        ['İki oturumun okuduğu RowVersion', String(surumA), String(surumB)],
        ['Oturum A kaydı', 'kabul edildi', a.ok ? 'kabul edildi' : 'reddedildi'],
        ['Oturum B kaydı', 'reddedildi', b.ok ? 'kabul edildi' : 'reddedildi'],
        ['Ret kodu D16', 'var', kodVar(b.hatalar, 'D16') ? 'var' : 'yok'],
        ['Kayıttaki üretilen dökme (A\'nın değeri)', kg(300000), kg(son.UretilenDokme)],
        ['Silo 1 mevcut (A\'nın değeri)', kg(290000), kg(siloMevcut(depo, s1, GUN1))],
        ['RowVersion', '2', String(son.RowVersion)]
      ], b.ok ? '' : 'B\'ye verilen mesaj: ' + kodMesaji(b.hatalar, 'D16'));
    }).kurallar = ['D16'];

  /* ==================================================================
     5. Test 7 — yetki kapısı gerçek DOM üzerinde sınanır
     ==================================================================
     Diğer on bir test saf bellek üzerinde çalışır; yetki kapısı ise
     YU.git / hashchange içinde yaşadığı için ancak gerçek yönlendirici
     çalıştırılarak sınanabilir. Bu yüzden bu test:
       · YU.oturum.kullanici'yı geçici olarak operatör yapar (localStorage'a
         yazan YU.oturumAc/oturumKapat KULLANILMAZ — gerçek oturum bozulmaz),
       · adres çubuğunu #/devir-stok yapıp yönlendiriciyi çalıştırır,
       · devir-stok sayfasının ciz() fonksiyonunun HİÇ çağrılmadığını ve
         yerine yetkisiz ekranının geldiğini doğrular,
       · sonra oturumu, adresi, sayfa başlığını ve menü işaretini geri koyar.
     Yönlendirici içerik kabını boşalttığı için sayfa bu koşudan sonra
     yeniden çizilir; geri dönüşte gelen gecikmeli hashchange ise saklanan
     sonucu basar (sonGezinme / GERI_DONUS_MS). */

  function operatorBul() {
    var liste = (YU.db && YU.db.kullanicilar) || [], i;
    for (i = 0; i < liste.length; i++) {
      if (liste[i].Rol === 'Operator' && liste[i].Aktif) return liste[i];
    }
    /* Kullanıcı tüm operatörleri pasifleştirmişse test yine de koşabilsin. */
    return { Id: null, KullaniciAdi: 'operator', AdSoyad: 'Test Operatörü', Rol: 'Operator', Aktif: true };
  }

  function baslikGeriKoy() {
    var baslik = document.querySelector('.yu-sayfa-baslik');
    var alt = document.querySelector('.yu-sayfa-alt');
    var tanim = YU.sayfalar['kabul-testleri'];
    if (baslik) baslik.textContent = tanim ? tanim.baslik : 'Kabul Testleri';
    if (alt && tanim) {
      alt.textContent = typeof tanim.altBaslik === 'function' ? tanim.altBaslik({}) : (tanim.altBaslik || '');
      alt.style.display = alt.textContent ? '' : 'none';
    }
    var ogeler = document.querySelectorAll('.yu-menu-oge'), i;
    for (i = 0; i < ogeler.length; i++) {
      ogeler[i].className = ogeler[i].getAttribute('data-kod') === 'kabul-testleri'
        ? 'yu-menu-oge aktif' : 'yu-menu-oge';
    }
  }

  function test7() {
    var tanim = YU.sayfalar['devir-stok'];
    if (!tanim) {
      return karsilastir([
        ['devir-stok ekranı kayıtlı', 'evet', 'hayır']
      ], 'YU.sayfalar["devir-stok"] tanımlı değil; yetki kapısı sınanamadı.');
    }

    var oncekiKullanici = YU.oturum.kullanici;
    var oncekiHash = location.hash || '#/kabul-testleri';
    var orjinalCiz = tanim.ciz;
    var cizildi = false;
    var ekranMetni = '', sayfaBasligi = '', patlama = null;

    tanim.ciz = function (kap, param) {
      cizildi = true;                       /* kapı sızdırırsa burası çalışır */
      return orjinalCiz.call(this, kap, param);
    };

    try {
      YU.oturum.kullanici = operatorBul();
      YU.git('devir-stok');                 /* adres çubuğuna elle yazmanın karşılığı */
      YU.yenile();                          /* hashchange gecikmeli gelir; kapıyı şimdi çalıştır */
      ekranMetni = sonKap ? String(sonKap.textContent || '') : '';
      var b = document.querySelector('.yu-sayfa-baslik');
      sayfaBasligi = b ? String(b.textContent || '') : '';
    } catch (e) {
      patlama = e;
    } finally {
      tanim.ciz = orjinalCiz;
      YU.oturum.kullanici = oncekiKullanici;
      /* Geri dönüş çizimleri testleri tekrar koşturmasın — yoksa Test 7 yeniden
         gezinir ve sayfa kendi kendini sonsuz döngüye sokar. */
      sonGezinme = Date.now();
      bekleyenCizim = BEKLENEN_GERI_CIZIM;
      if (location.hash !== oncekiHash) location.hash = oncekiHash;
      baslikGeriKoy();
    }
    if (patlama) throw patlama;

    return karsilastir([
      ['devir-stok sayfası çizildi mi', 'hayır', evetHayir(cizildi)],
      ['Sayfa başlığı', 'Erişim engellendi', sayfaBasligi],
      ['"Bu ekrana erişim yetkiniz yok." uyarısı', 'var', ekranMetni.indexOf('Bu ekrana erişim yetkiniz yok.') >= 0 ? 'var' : 'yok'],
      ['Oturum eski hâline döndü', 'evet', evetHayir(YU.oturum.kullanici === oncekiKullanici)],
      ['Rol', 'Yonetici', String(YU.rol())]
    ], 'Bu test gerçek DOM\'a dokunur: oturum geçici olarak operatör yapılır, adres #/devir-stok\'a çevrilir, ardından oturum, adres, sayfa başlığı ve menü işareti geri alınır. localStorage\'daki oturum kaydına dokunulmaz.');
  }

  /* ==================================================================
     6. Çizim
     ================================================================== */

  /* Türkçe iyelik eki sayıya göre değişir; test sayısı 12 ile sınırlı
     olduğu için tablo yeterli ve tahmine yer bırakmaz. */
  var EKLI = ['0\'ı', '1\'i', '2\'si', '3\'ü', '4\'ü', '5\'i', '6\'sı', '7\'si',
              '8\'i', '9\'u', '10\'u', '11\'i', '12\'si'];

  function ozetCumlesi(kosu) {
    if (kosu.gecen === 0) return kosu.toplam + ' testin hiçbiri geçmedi';
    var ek = EKLI[kosu.gecen] || String(kosu.gecen);
    return kosu.toplam + ' testten ' + ek + ' geçti';
  }

  function kucukMetin(metin, renk) {
    return YU.h('div', {
      metin: metin,
      stil: { font: '400 14.5px/1.6 var(--font)', color: renk || 'var(--metin-3)' }
    });
  }

  /* Panel başlığındaki rozet dar; kural etiketinin yalnızca kodu görünür
     ("§4 yeniden kaydetme" -> "§4"), tam metni gövdedeki listede durur. */
  function kisaKod(kural) {
    var i = String(kural).indexOf(' ');
    return i < 0 ? String(kural) : String(kural).slice(0, i);
  }

  function kuralRozetleri(kurallar) {
    var liste = [], i;
    for (i = 0; i < kurallar.length; i++) liste.push(YU.ui.rozet(kisaKod(kurallar[i]), 'vurgu'));
    return liste;
  }

  function kuralListesi(kurallar) {
    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '5px' } });
    var i, kod, metin;
    for (i = 0; i < kurallar.length; i++) {
      kod = kurallar[i];
      metin = kuralMetni(kod);
      kap.appendChild(YU.h('div', { stil: { display: 'flex', gap: '9px', alignItems: 'baseline' } },
        YU.h('span', {
          metin: kod,
          stil: { font: '500 13px/1.5 var(--mono)', color: 'var(--vurgu)', flex: 'none' }
        }),
        YU.h('span', {
          metin: metin || 'Şartname maddesi',
          stil: { font: '400 13.5px/1.5 var(--font)', color: 'var(--metin-4)' }
        })
      ));
    }
    return kap;
  }

  function isaret(esitMi) {
    return YU.h('span', {
      metin: esitMi ? '✓' : '✗',
      stil: {
        font: '500 15px/1 var(--mono)',
        color: esitMi ? 'var(--olumlu)' : 'var(--olumsuz)'
      }
    });
  }

  function karsilastirmaTablosu(sonuc) {
    var satirlar = [], n = Math.max(sonuc.beklenen.length, sonuc.gerceklesen.length), i, b, g, esitMi;
    for (i = 0; i < n; i++) {
      b = sonuc.beklenen[i] || { etiket: '—', deger: '—' };
      g = sonuc.gerceklesen[i] || { etiket: b.etiket, deger: '—' };
      esitMi = String(b.deger) === String(g.deger);
      satirlar.push([
        b.etiket,
        b.deger,
        /* Fark kırmızı vurgulanır — koyu temada gölge yok, yalnızca renk. */
        esitMi ? g.deger : YU.h('span', {
          metin: g.deger,
          stil: { color: 'var(--olumsuz)', fontWeight: '500' }
        }),
        isaret(esitMi)
      ]);
    }
    return YU.ui.tablo({
      kompakt: true,
      sutunlar: [
        { baslik: 'Kontrol' },
        { baslik: 'Beklenen', hiza: 'sag', mono: true, genislik: 180 },
        { baslik: 'Gerçekleşen', hiza: 'sag', mono: true, genislik: 180 },
        { baslik: '', hiza: 'orta', genislik: 48 }
      ],
      satirlar: satirlar,
      bos: 'Bu test değer karşılaştırması üretmedi.'
    });
  }

  function testPaneli(satir, tekCalistir) {
    var t = satir.test, s = satir.sonuc;
    var govde = [];

    govde.push(kucukMetin(t.senaryo));
    if (t.kurallar && t.kurallar.length) govde.push(kuralListesi(t.kurallar));

    if (s.hata) {
      govde.push(YU.ui.serit({
        tur: 'hata',
        baslik: 'Test Çalışırken Hata Oluştu',
        metin: s.hata
      }));
    }
    govde.push(karsilastirmaTablosu(s));
    if (s.not) govde.push(YU.h('div', { sinif: 'yu-yardim', metin: s.not }));

    return YU.ui.panel({
      baslik: 'Test ' + t.no + ' · ' + t.ad,
      ikon: s.gecti ? '#ic-up' : '#ic-down',
      sag: [
        kuralRozetleri(t.kurallar || []),
        YU.ui.rozet(t.rozet === 'Demirbaş' ? 'DEMİRBAŞ' : 'v2', 'notr'),
        YU.h('span', { sinif: 'yu-zayif', stil: { font: '600 13px/1 var(--sayi)' }, metin: sureMetni(s.sure || 0) }),
        YU.ui.rozet(s.gecti ? 'GEÇTİ' : 'KALDI', s.gecti ? 'olumlu' : 'olumsuz'),
        YU.ui.dugme({
          ikon: '#ic-chevron', tur: 'sade', kucuk: true,
          baslik: 'Yalnızca Bu Testi Çalıştır',
          onClick: function () { tekCalistir(t); }
        })
      ],
      govde: govde
    });
  }

  function ozetBolumu(kosu) {
    var hepsiGecti = kosu.kalan === 0;
    var parcalar = [];

    parcalar.push(YU.ui.serit({
      tur: hepsiGecti ? 'basari' : 'hata',
      ikon: hepsiGecti ? '#ic-up' : '#ic-down',
      baslik: ozetCumlesi(kosu),
      metin: hepsiGecti
        ? 'Şartname §9\'daki on iki senaryonun tamamı bu tarayıcıda geçti. Son koşu ' + kosu.saat + ' · ' + sureMetni(kosu.sure) + '.'
        : 'Hepsi geçmiyorsa iş bitmemiştir. (Şartname §9) — ' + kosu.kalan + ' test kaldı. Son koşu ' + kosu.saat + ' · ' + sureMetni(kosu.sure) + '.'
    }));

    parcalar.push(YU.h('div', { sinif: 'yu-izgara yu-iz-4' },
      YU.ui.kpi({ etiket: 'Toplam Test', deger: YU.fmt.sayi(kosu.toplam), alt: 'Şartname §9', ikon: '#ic-doc' }),
      YU.ui.kpi({ etiket: 'Geçen', deger: YU.fmt.sayi(kosu.gecen), alt: 'beklenen değerler tuttu', ikon: '#ic-up', renk: 'olumlu' }),
      YU.ui.kpi({ etiket: 'Kalan', deger: YU.fmt.sayi(kosu.kalan), alt: kosu.kalan ? 'düzeltilmesi gerekiyor' : 'kalan yok', ikon: '#ic-down', renk: kosu.kalan ? 'olumsuz' : 'notr' }),
      YU.ui.kpi({ etiket: 'Süre', deger: sureMetni(kosu.sure), alt: 'tarayıcı içi koşu · ' + kosu.saat, ikon: '#ic-chart' })
    ));

    return parcalar;
  }

  function altNot() {
    return YU.h('div', {
      sinif: 'yu-yardim',
      stil: { paddingTop: '14px', borderTop: '1px solid var(--ayrac)' },
      metin: 'Bu ekran prototipin kendi kendini sınamasıdır. Gerçek uygulamada aynı 12 senaryo ' +
             'xUnit ile gerçek SQL Server\'a karşı çalışacak (Şartname §10).'
    });
  }

  function bas(kap, kosu) {
    if (!kap) return;
    var i;
    YU.bos(kap);

    /* Sayfa eylem alanı kabuğa ait; elle koşumdan sonra ikinci kez dolmasın. */
    var eylemler = YU.ui.sayfaEylemleri();
    if (eylemler) YU.bos(eylemler);
    YU.ui.sayfaEylemleri(YU.ui.dugme({
      metin: 'Tümünü Çalıştır', ikon: '#ic-chevron', tur: 'birincil',
      onClick: function () { sonKosu = tumunuKostur(); bas(sonKap, sonKosu); }
    }));

    function tekCalistir(t) {
      var j;
      for (j = 0; j < sonKosu.satirlar.length; j++) {
        if (sonKosu.satirlar[j].test === t) sonKosu.satirlar[j].sonuc = tekKostur(t);
      }
      sonKosu = ozetle(sonKosu.satirlar);
      bas(sonKap, sonKosu);
    }

    var parcalar = ozetBolumu(kosu);
    for (i = 0; i < parcalar.length; i++) kap.appendChild(parcalar[i]);
    for (i = 0; i < kosu.satirlar.length; i++) kap.appendChild(testPaneli(kosu.satirlar[i], tekCalistir));
    kap.appendChild(altNot());
  }

  function sayfaCiz(kap) {
    sonKap = kap;
    /* Sayaç tarayıcı olayları birleştirirse zaman penceresiyle, pencere
       uzarsa sayaçla kapanır; ikisi birden dolmadıkça testler yeniden koşar. */
    var geriDonus = sonKosu && bekleyenCizim > 0 && (Date.now() - sonGezinme) < GERI_DONUS_MS;
    if (geriDonus) {
      bekleyenCizim--;
    } else {
      bekleyenCizim = 0;
      sonKosu = tumunuKostur();       /* sayfa açılınca testler kendiliğinden koşar */
    }
    bas(kap, sonKosu);
  }

  YU.sayfaTanimla({
    kod: 'kabul-testleri',
    baslik: 'Kabul Testleri',
    altBaslik: 'Şartname §9 · 12 senaryo tarayıcı içinde koşar · her test temiz bellek deposuyla başlar, kayıtlı verilere dokunulmaz',
    ikon: '#ic-checklist',
    /* Menüden kaldırıldı (kullanıcı kararı, 25.08.2026 — sadeleştirme).
       Testler yalnız doğrudan adresle (#/kabul-testleri) koşturulur; Şartname §9
       kapsamı aynen durur, yalnız sol menüde görünmüyor. */
    grup: null,
    rol: 'Yonetici',
    ciz: function (kap) { sayfaCiz(kap); }
  });
})();

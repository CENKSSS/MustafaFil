/* js/20-anasayfa.js — Ana Sayfa (Şartname §7: "malzeme ve silo stoklarının kart
   görünümü, sık kullanılan işlemlere kısayol").

   Görsel dil: design-reference/accounting-dashboard artboard 2a — KPI ızgarası,
   1.55fr/1fr blok (sütun grafiği + son hareketler), altta tablo. Boş durum 2b.
   SOZLESME §6 (UI yardımcıları), §7 (sayfa kaydı ve ikon eşlemesi).

   Ekrandaki her rakam YU.stok / YU.donem üzerinden hesaplanır; sabit sayı yok. */
(function () {
  'use strict';

  var YU = window.YU;

  var PENCERE_GUN = 30;      /* KPI karşılaştırma penceresi (§7 "son 30 gün") */
  var GRAFIK_GUN = 14;
  var HAREKET_SATIR = 6;
  var LOG_SATIR = 4;         /* son hareketlerin en fazla bu kadarı denetim izinden */

  /* Şartname §2: "Yaş küspe … Tonluk büyük torbada veya 25 kg'lık poşette satılır."
     Poşetin kg'ı şartnamede yazılıdır, tonluk büyük torbanınki YAZMIYOR — bu yüzden
     adet yalnızca 25'lik satırı için türetilir, tonluk için gösterilmez. */
  var POSET_KG = YU.hesap.POSET_KG;   /* 25 kg — Şartname §2, sabit YU.hesap içinde durur */
  var POSET_DESEN = /25/;    /* "Yaş Küspe (25'lik)" satırı adından ayırt edilir (SOZLESME §1). */
  var TONLUK_NOTU = 'Tonluk büyük torbanın kaç kg olduğu şartnamede belirtilmemiş; ' +
    'bu yüzden tonluk için adet gösterilmiyor.';
  /* DİKKAT — ŞARTNAME DIŞI VARSAYIM (kullanıcı isteği, 21.08.2026): günlük
     üretim/satış kartında tonluk değerler torba adedi olarak yazılır ve
     1 torba = 1.000 kg kabul edilir. Bu kg değeri şartnamede YOKTUR; ürün
     adındaki "1 Tonluk"tan türetildi. Şartname netleşirse burası güncellenir. */
  var TONLUK_KG = 1000;

  var TABLO_ADI = {
    KuruKuspeGunluk: 'Kuru küspe günlük kaydı',
    GunlukHareket: 'Malzeme hareketi',
    SiloHareket: 'Silo hareketi',
    DevirStok: 'Malzeme devir stoğu',
    SiloDevirStok: 'Silo devir stoğu',
    Kullanicilar: 'Kullanıcı',
    Malzemeler: 'Malzeme'
  };

  var TABLO_IKON = {
    KuruKuspeGunluk: '#ic-plus', GunlukHareket: '#ic-pencil', SiloHareket: '#ic-building',
    DevirStok: '#ic-wallet', SiloDevirStok: '#ic-wallet',
    Kullanicilar: '#ic-users', Malzemeler: '#ic-gear'
  };

  var ISLEM_ADI = { Ekle: 'eklendi', Guncelle: 'güncellendi', Sil: 'silindi' };

  /* ==================================================================
     Yardımcılar
     ================================================================== */

  /* Denetim damgaları saatli, iş tarihleri saatsiz; ikisi de ilk 10 karakterden
     okunur ki göreli zaman iki kaynakta da aynı şekilde çalışsın. */
  function goreli(iso) {
    var gun = String(iso || '').slice(0, 10);
    var f = YU.tarih.fark(gun, YU.tarih.bugun());
    if (!isFinite(f)) return '—';
    if (f < 0) return YU.fmt.tarih(gun);
    if (f === 0) return 'bugün';
    if (f === 1) return 'dün';
    if (f < 7) return f + ' gün önce';
    if (f < 30) return Math.max(1, Math.round(f / 7)) + ' hafta önce';
    if (f < 365) return Math.max(1, Math.round(f / 30)) + ' ay önce';
    return Math.max(1, Math.floor(f / 365)) + ' yıl önce';
  }

  /* Karşılaştırma tabanı 0 ise yüzde tanımsızdır; uydurma oran yazmak yerine
     null döner ve çağıran alt satırı başka bir bağlamla doldurur. */
  function degisim(yeni, eski) {
    if (!isFinite(yeni) || !isFinite(eski) || eski === 0) return null;
    var oran = ((yeni - eski) / Math.abs(eski)) * 100;
    if (Math.abs(oran) < 0.05) return 'değişim yok';
    return (oran > 0 ? '+' : '−') + YU.fmt.yuzde(Math.abs(oran), 1);
  }

  function kisaAd(ad) {
    var m = /\(([^)]+)\)/.exec(String(ad || ''));
    return m ? m[1] : String(ad || '');
  }

  function kullaniciAdi(depo, id) {
    if (id === null || id === undefined) return null;
    for (var i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].Id === id) return depo.kullanicilar[i].AdSoyad;
    }
    return null;
  }


  function ozelTipSatiri(satirlar, tip) {
    for (var i = 0; i < satirlar.length; i++) {
      if (satirlar[i].malzeme && satirlar[i].malzeme.OzelTip === tip) return satirlar[i];
    }
    return null;
  }

  /* Dökme kuru küspenin net üretimi ve satışı GunlukHareket'e yazılır
     (04-servis kuruKuspeKaydet 6. adım); pencere toplamları oradan okunur. */
  function dokmePencere(depo, dokmeId, bas, bit) {
    var uretim = 0, satis = 0, i, h;
    if (dokmeId === null || !bas || !bit) return { uretim: 0, satis: 0 };
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.MalzemeId !== dokmeId || h.Tarih < bas || h.Tarih > bit) continue;
      uretim += Number(h.Uretim) || 0;
      satis += Number(h.Satis) || 0;
    }
    return { uretim: YU.yuvarla(uretim), satis: YU.yuvarla(satis) };
  }

  /* Tek günün üretim/satış toplamı — günlük kartlar son kayıtlı günü gösterir.
     Birden çok malzeme (yaş küspe kırılımı) tek toplamda birleşir. */
  function gunToplami(depo, malzemeIdleri, tarih) {
    var uretim = 0, satis = 0, i, h;
    if (!malzemeIdleri.length || !tarih) return { uretim: 0, satis: 0 };
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.Tarih !== tarih || malzemeIdleri.indexOf(h.MalzemeId) === -1) continue;
      uretim += Number(h.Uretim) || 0;
      satis += Number(h.Satis) || 0;
    }
    return { uretim: YU.yuvarla(uretim), satis: YU.yuvarla(satis) };
  }

  /* ==================================================================
     Özet — ekrandaki bütün rakamlar tek geçişte burada toplanır
     ================================================================== */

  function ozet(depo) {
    var bugun = YU.tarih.bugun();
    var donem = YU.donem.aktif();
    var tumGunler = YU.stok.kayitliGunler(depo);
    var sonGun = tumGunler.length ? tumGunler[0].tarih : null;

    var silolar = YU.stok.tumSilolar(depo, bugun);
    var malzemeler = YU.stok.tumMalzemeler(depo, bugun);
    var dokmeSatir = ozelTipSatiri(malzemeler, 'DokmeKuruKuspe');
    var cuvalSatir = ozelTipSatiri(malzemeler, 'CuvalKuruKuspe');
    var dokmeId = dokmeSatir ? dokmeSatir.malzeme.Id : null;

    var kapasite = 0, i, yasSatirlar = [], yasToplam = 0, yasIdler = [], posetIdler = [];
    var yasTonlukToplam = 0, yasPosetToplam = 0;
    for (i = 0; i < silolar.length; i++) kapasite += Number(silolar[i].kapasite) || 0;
    for (i = 0; i < malzemeler.length; i++) {
      if (!malzemeler[i].malzeme || malzemeler[i].malzeme.Aktif === false) continue;
      if (/^Yaş Küspe/.test(String(malzemeler[i].malzeme.Ad))) {
        yasSatirlar.push(malzemeler[i]);
        yasIdler.push(malzemeler[i].malzeme.Id);
        if (POSET_DESEN.test(kisaAd(malzemeler[i].malzeme.Ad))) {
          posetIdler.push(malzemeler[i].malzeme.Id);
          yasPosetToplam += Number(malzemeler[i].mevcut) || 0;
        } else {
          yasTonlukToplam += Number(malzemeler[i].mevcut) || 0;
        }
        yasToplam += Number(malzemeler[i].mevcut) || 0;
      }
    }

    var dokmeToplam = YU.stok.dokmeToplam(depo, bugun);

    var p1bas = sonGun ? YU.tarih.ekle(sonGun, -(PENCERE_GUN - 1)) : null;
    var p0bit = sonGun ? YU.tarih.ekle(sonGun, -PENCERE_GUN) : null;
    var p0bas = sonGun ? YU.tarih.ekle(sonGun, -(PENCERE_GUN * 2 - 1)) : null;
    var pencere = dokmePencere(depo, dokmeId, p1bas, sonGun);
    var oncekiPencere = dokmePencere(depo, dokmeId, p0bas, p0bit);

    return {
      bugun: bugun,
      donem: donem,
      sonGun: sonGun,
      tumGunler: tumGunler,
      silolar: silolar,
      malzemeler: malzemeler,
      dokmeId: dokmeId,
      dokmeToplam: dokmeToplam,
      cuvalMevcut: cuvalSatir ? Number(cuvalSatir.mevcut) || 0 : 0,
      yasSatirlar: yasSatirlar,
      yasToplam: YU.yuvarla(yasToplam),
      yasTonluk: YU.yuvarla(yasTonlukToplam),
      yasPoset: YU.yuvarla(yasPosetToplam),
      kapasite: kapasite,
      pencereBas: p1bas,
      pencere: pencere,
      oncekiPencere: oncekiPencere,
      gunluk: {
        dokme: gunToplami(depo, dokmeId === null ? [] : [dokmeId], sonGun),
        cuval: gunToplami(depo, cuvalSatir ? [cuvalSatir.malzeme.Id] : [], sonGun),
        /* Türler ayrı sayılır, birleşik toplam yok (kullanıcı isteği,
           21.08.2026): tonluk yalnız tonluk satırlarından gelir. */
        tonluk: gunToplami(depo, yasIdler.filter(function (id) { return posetIdler.indexOf(id) < 0; }), sonGun),
        poset: gunToplami(depo, posetIdler, sonGun)
      },
      bos: !depo.kuruKuspeGunluk.length && !depo.gunlukHareket.length &&
           !depo.devirStok.length && !depo.siloDevirStok.length
    };
  }

  /* ==================================================================
     Sayfa başlığı eylemleri
     ================================================================== */

  /* "Günlük Giriş" ve "Günlük Rapor" başlık düğmeleri kaldırıldı
     (kullanıcı isteği, 21.08.2026); aynı ekranlara menüden gidilir. */

  /* Durum şeritleri kaldırıldı: aynı koşullar artık üst şeritteki ünlem
     (Uyarılar) düğmesinin listesinde yaşıyor — YU.uyarilar, 10-kabuk
     (kullanıcı isteği, 21.08.2026). */

  /* ==================================================================
     KPI kartları
     ================================================================== */

  /* Değer satırında sayı ile birim ayrı elemanlara bölünüyor: sayı .yu-kpi-deger'in
     mono + tabular ölçüsünü sürdürür, birim kelimesi bir tık küçük ve soluk kalır ki
     rakam öne çıksın. Ölçüler tema.css'teki KPI/menü değerleriyle aynı ailedendir. */
  function birimEki(metin) {
    return YU.h('span', {
      metin: metin,
      stil: { font: '400 15px/1 var(--font)', letterSpacing: 'normal', color: 'var(--metin-4)' }
    });
  }

  /* Kart dar kaldığında satır sarar; parçalar taban çizgisinde hizalı kalır. */
  function degerSatiri(cocuklar) {
    return YU.h('div', {
      sinif: 'yu-kpi-deger',
      stil: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '6px', rowGap: '3px' }
    }, cocuklar);
  }

  function detaySayi(metin) {
    return YU.h('span', {
      metin: metin,
      stil: { fontFamily: 'var(--sayi)', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: 'var(--metin-2)' }
    });
  }

  /* YU.ui.kpi değer ve alt satırı yalnızca düz metin alır; çuvallı ve yaş küspe
     kartlarında bu satırlar parçalı olduğu için kart burada kuruluyor. Sınıflar
     sözleşmedeki KPI sınıflarının aynısı (SOZLESME §9). */
  function kpiKarti(s) {
    return YU.h('div', { sinif: 'yu-kpi', title: s.ipucu || null },
      YU.h('div', { sinif: 'yu-kpi-bas' },
        YU.h('div', { sinif: 'yu-kpi-ikon' }, s.ikon ? YU.svg(s.ikon, 15) : null),
        YU.h('div', { sinif: 'yu-kpi-etiket', metin: s.etiket || '' })
      ),
      s.deger,
      s.alt || null
    );
  }

  /* yasDetayi kaldırıldı: tonluk ve 25'lik artık ayrı kartlarda, birleşik
     kırılım satırı yok (kullanıcı isteği, 21.08.2026). */

  function pencereFarki(o, alan) {
    var fark = degisim(o.pencere[alan], o.oncekiPencere[alan]);
    return fark ? 'önceki 30 güne göre ' + fark : 'karşılaştırılacak önceki dönem yok';
  }

  function pencereAraligi(o) {
    return YU.fmt.tarih(o.pencereBas) + ' – ' + YU.fmt.tarih(o.sonGun);
  }

  /* ------------------------------------------------------------------
     Kart üreticileri — her biri katalogdaki tek bir kartı çizer.
     ------------------------------------------------------------------ */

  /* Alt açıklama satırı kaldırıldı (kullanıcı isteği, 21.08.2026). */
  function kartDokme(o) {
    return YU.ui.kpi({
      etiket: '3 Toplam Dökme Kuru Küspe', ikon: '#ic-silos',
      deger: YU.fmt.kgU(o.dokmeToplam)
    });
  }

  /* Çuval adedi sabit değil, kg / YU.hesap.CUVAL_KG ile türetilir. */
  function kartCuval(o) {
    var cuvalAdet = Math.round(o.cuvalMevcut / YU.hesap.CUVAL_KG);
    return kpiKarti({
      etiket: '50 KG Çuvallı Kuru Küspe', ikon: '#ic-sack',
      /* Sade gösterim (kullanıcı isteği, 21.08.2026): "adet" kelimesi ve
         çuval kilosu alt satırı yok. */
      deger: degerSatiri([
        YU.h('span', { metin: YU.fmt.kg(o.cuvalMevcut) }), birimEki('kg'),
        birimEki('/'),
        YU.h('span', { metin: YU.fmt.sayi(cuvalAdet) }), birimEki('çuval')
      ])
    });
  }

  /* Kampanya toplamı: üretilen çuvallı kg + adet; mevcut stok kartından
     farkı budur (kullanıcı isteği, 21.08.2026). */
  /* "Toplam Çuvallı" kartı KALDIRILDI (Şartname §4, Demirbaş): çuvallama
     üretim değil biçim değiştirmedir; kümülatif "çuval üretimi" kartı çift
     sayım algısı doğuruyordu. Kuru küspe yalnız iki biçimde sunulur:
     silolarda dökme, 50 kg çuvallarda çuvallı (§2). */

  /* Türler AYRI kartlarda, birleşik toplam gösterilmez (kullanıcı isteği,
     21.08.2026): bu kart yalnız tonluk, 25'lik kendi kartında. */
  function kartYas(o) {
    return kpiKarti({
      etiket: '1 Tonluk Yaş Küspe', ikon: '#ic-beet',
      ipucu: TONLUK_NOTU,
      deger: degerSatiri([YU.h('span', { metin: YU.fmt.kg(o.yasTonluk) }), birimEki('kg')])
    });
  }

  function kartYasPoset(o) {
    var adet = Math.round(o.yasPoset / POSET_KG);
    return kpiKarti({
      etiket: '25 KG Yaş Küspe', ikon: '#ic-bag',
      deger: degerSatiri([
        YU.h('span', { metin: YU.fmt.kg(o.yasPoset) }), birimEki('kg'),
        birimEki('/'),
        YU.h('span', { metin: YU.fmt.sayi(adet) }), birimEki('poşet')
      ])
    });
  }

  function kartUretim30(o) {
    return YU.ui.kpi({
      etiket: 'Son 30 Günün Dökme Üretimi', ikon: '#ic-bars-up',
      deger: YU.fmt.kgU(o.pencere.uretim),
      alt: o.sonGun ? (pencereAraligi(o) + ' · ' + pencereFarki(o, 'uretim')) : 'Kayıtlı gün yok.'
    });
  }

  function kartSatis30(o) {
    var satisOrani = o.pencere.uretim > 0 ? (o.pencere.satis / o.pencere.uretim) * 100 : null;
    return YU.ui.kpi({
      etiket: 'Son 30 Günün Dökme Satışı', ikon: '#ic-basket',
      deger: YU.fmt.kgU(o.pencere.satis),
      alt: !o.sonGun ? 'Kayıtlı gün yok.'
        : ((satisOrani === null ? '' : 'Üretime oranı ' + YU.fmt.yuzde(satisOrani, 1) + ' · ') +
           pencereFarki(o, 'satis'))
    });
  }

  /* Pasif malzeme yeni hareket almaz ama stoğu duruyorsa toplamdan düşmez —
     Stok Durumu ekranındaki "Toplam Stok" kartıyla aynı kural. */
  /* Toplam Stok, Doluluk Oranı ve Kayıtlı Gün kartları katalogdan
     kaldırıldı (kullanıcı isteği, 21.08.2026). */

  /* Günlük kartlar: son kayıtlı günün üretim ve satışı tek kartta, çuval
     kartındaki "değer / değer" diliyle. Bugüne kayıt yoksa son gün gösterilir;
     alt satır hangi güne bakıldığını her zaman söyler. */
  /* birimKg verilirse değerler kg değil ADET olarak yazılır (kg/birimKg):
     çuval, poşet, torba — kullanıcı isteği, 21.08.2026. Dökmenin adet
     kavramı olmadığı için o kartta kg kalır. */
  function gunlukKarti(s) {
    var g = s.veri;
    var birim = s.birimAd || 'kg';
    function deger(kg) {
      return s.birimKg ? YU.fmt.sayi(Math.round(kg / s.birimKg)) : YU.fmt.kg(kg);
    }
    return kpiKarti({
      etiket: s.etiket, ikon: s.ikon,
      deger: degerSatiri([
        YU.h('span', { metin: deger(g.uretim) }), birimEki(birim + ' üretim'),
        birimEki('·'),
        YU.h('span', { metin: deger(g.satis) }), birimEki(birim + ' satış')
      ]),
      alt: YU.h('div', {
        sinif: 'yu-kpi-alt',
        metin: !s.sonGun ? 'Kayıtlı gün yok.'
          : YU.fmt.tarih(s.sonGun) + ' · ' + YU.fmt.gunAdi(s.sonGun)
      })
    });
  }

  function kartGunlukDokme(o) {
    return gunlukKarti({
      etiket: 'Dökme Kuru Küspe Üretim/Satış', ikon: '#ic-swap',
      veri: o.gunluk.dokme, sonGun: o.sonGun
    });
  }

  function kartGunlukCuval(o) {
    return gunlukKarti({
      etiket: '50 KG Çuvallı Üretim/Satış', ikon: '#ic-sack-flow',
      veri: o.gunluk.cuval, sonGun: o.sonGun,
      birimAd: 'çuval', birimKg: YU.hesap.CUVAL_KG
    });
  }

  /* Türler ayrı sayılır: bu kart yalnız TONLUK yaş küspeyi gösterir;
     25'lik, Günlük Poşetli kartında (kullanıcı isteği, 21.08.2026).
     Torba adedi TONLUK_KG varsayımıyla türetilir — üstteki DİKKAT notuna bak. */
  function kartGunlukYas(o) {
    return gunlukKarti({
      etiket: '1 Tonluk Yaş Küspe Üretim/Satış', ikon: '#ic-beet-flow',
      veri: o.gunluk.tonluk, sonGun: o.sonGun,
      birimAd: 'torba', birimKg: TONLUK_KG
    });
  }

  function kartGunlukPoset(o) {
    return gunlukKarti({
      etiket: '25 KG Yaş Küspe Üretim/Satış', ikon: '#ic-bag',
      veri: o.gunluk.poset, sonGun: o.sonGun,
      birimAd: 'poşet', birimKg: POSET_KG
    });
  }

  /* ==================================================================
     Özet kartları — hangisi, hangi sırada: kullanıcı seçer
     ==================================================================
     Katalogdaki kartlardan istenenler seçilir, sırası elle değiştirilir.
     Seçim tarayıcıda saklanır; prototipte sunucu yok, bu yüzden kullanıcı
     başına değil tarayıcı başınadır. */

  var KART_ANAHTAR = 'yu.anasayfa.kartlari.v1';

  /* Aile: tek katalog kaydı birden çok kart üretir (ciz dizi döndürür) ve
     seçiciden tek kalemde eklenip kaldırılır. Demirbaş aile seçime tabi
     değildir, her zaman en başta çizilir (kullanıcı isteği, 21.08.2026). */
  var KART_KATALOG = [
    {
      kod: 'stok-ailesi', ad: 'Stok Kartları', demirbas: true, aile: true,
      aciklama: 'Dökme, 50 KG çuvallı, 1 tonluk ve 25 KG yaş küspe stokları — her zaman görünür.',
      ciz: function (o) { return [kartDokme(o), kartCuval(o), kartYas(o), kartYasPoset(o)]; }
    },
    {
      kod: 'uretim-satis', ad: 'Üretim/Satış Kartları', aile: true,
      aciklama: 'Aynı dört ürünün günlük üretim ve satışı; dördü birlikte eklenir.',
      ciz: function (o) { return [kartGunlukDokme(o), kartGunlukCuval(o), kartGunlukYas(o), kartGunlukPoset(o)]; }
    },
    { kod: 'uretim30', ad: 'Son 30 Günün Dökme Üretimi', aciklama: 'Pencere toplamı ve önceki döneme göre fark.', ciz: kartUretim30 },
    { kod: 'satis30', ad: 'Son 30 Günün Dökme Satışı', aciklama: 'Pencere toplamı ve üretime oranı.', ciz: kartSatis30 }
  ];

  var VARSAYILAN_KARTLAR = ['uretim-satis', 'uretim30', 'satis30'];

  function kartBul(kod) {
    for (var i = 0; i < KART_KATALOG.length; i++) if (KART_KATALOG[i].kod === kod) return KART_KATALOG[i];
    return null;
  }

  /* Kayıt yoksa varsayılan liste döner. Boş dizi geçerli bir seçimdir
     (kullanıcı tüm kartları kaldırabilir), bu yüzden "kayıt yok" ile
     "boş kayıt" ayrı ele alınır. */
  function kartlariOku() {
    var ham = null;
    try { ham = localStorage.getItem(KART_ANAHTAR); } catch (e) { ham = null; }
    if (ham === null || ham === undefined) return VARSAYILAN_KARTLAR.slice();
    var cozulen;
    try { cozulen = JSON.parse(ham); } catch (e) { return VARSAYILAN_KARTLAR.slice(); }
    if (Object.prototype.toString.call(cozulen) !== '[object Array]') return VARSAYILAN_KARTLAR.slice();
    var liste = [], i, tanim;
    for (i = 0; i < cozulen.length; i++) {
      tanim = kartBul(cozulen[i]);
      /* Demirbaş seçime yazılmaz; katalogdan kalkan eski kodlar da elenir. */
      if (tanim && !tanim.demirbas && liste.indexOf(cozulen[i]) < 0) liste.push(cozulen[i]);
    }
    return liste;
  }

  function kartlariYaz(liste) {
    try { localStorage.setItem(KART_ANAHTAR, JSON.stringify(liste)); } catch (e) { /* özel mod */ }
  }

  /* Kart yönetimi tek düğmeye indi (kullanıcı isteği, 21.08.2026):
     "Kartları Seç" kaldırıldı; Üretim/Satış ailesi bu düğmeyle açılıp
     kapanır. Aile açıkken düğmenin üstü çizilir — tıklamak kapatır. */
  function kartCubugu(secim) {
    var acik = secim.indexOf('uretim-satis') >= 0;
    var dugme = YU.ui.dugme({
      metin: 'Üretim/Satış Kartlarını Göster', ikon: '#ic-swap', tur: 'ikincil', kucuk: true,
      baslik: acik ? 'Açık — kapatmak için tıklayın' : 'Dört üretim/satış kartını açar',
      onClick: function () {
        var yeni = secim.slice();
        var k = yeni.indexOf('uretim-satis');
        if (k >= 0) yeni.splice(k, 1); else yeni.unshift('uretim-satis');
        kartlariYaz(yeni);
        YU.yenile();
      }
    });
    if (acik) dugme.style.textDecoration = 'line-through';
    return YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
      YU.h('span', { sinif: 'yu-etiket', metin: 'Özet Kartları' }),
      YU.h('span', { stil: { flex: '1' } }),
      dugme
    );
  }

  /* Tek üçlü ızgara: kaç kart seçilirse seçilsin her kart aynı genişlikte ve
     aynı yükseklikte kalır. Son sıra eksik kalırsa kalan kartlar genişlemez,
     sağda boş göz bırakır (kullanıcı isteği). */
  function kpiIzgarasi(o) {
    var secim = kartlariOku();
    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    kap.appendChild(kartCubugu(secim));

    var kartlar = [], i, tanim;
    function ekle(tanim) {
      var uretilen = tanim.ciz(o);
      if (Object.prototype.toString.call(uretilen) === '[object Array]') {
        for (var j = 0; j < uretilen.length; j++) kartlar.push(uretilen[j]);
      } else {
        kartlar.push(uretilen);
      }
    }
    /* Demirbaş aileler seçimden bağımsız her zaman en başta. */
    for (i = 0; i < KART_KATALOG.length; i++) {
      if (KART_KATALOG[i].demirbas) ekle(KART_KATALOG[i]);
    }
    for (i = 0; i < secim.length; i++) {
      tanim = kartBul(secim[i]);
      if (tanim && !tanim.demirbas) ekle(tanim);
    }

    /* Demirbaş aile her zaman kart ürettiği için boş durum oluşmaz. */

    /* Kartlar satır başına 4'lü dizilir (kullanıcı isteği, 21.08.2026);
       dar ekran kırılımları yu-iz-4'ten gelir (≤1100 2'li, ≤700 tekli). */
    kap.appendChild(YU.h('div', { sinif: 'yu-izgara yu-iz-4 yu-esit' }, kartlar));
    return kap;
  }

  /* ==================================================================
     Sütun grafiği — son 14 kayıtlı gün
     ================================================================== */

  function grafikPaneli(depo, o) {
    var son = o.tumGunler.slice(0, GRAFIK_GUN).reverse();
    var harita = {}, i, h;
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.MalzemeId === o.dokmeId) harita[h.Tarih] = h;
    }

    var veri = [];
    for (i = 0; i < son.length; i++) {
      h = harita[son[i].tarih];
      veri.push({
        etiket: YU.fmt.tarih(son[i].tarih).slice(0, 5),
        /* İpucu başlığı tam tarihi göstersin diye ISO tarih de geçiliyor;
           sütun altındaki etiket dar olduğu için kısa kalıyor. */
        tarih: son[i].tarih,
        deger1: h ? Number(h.Uretim) || 0 : 0,
        deger2: h ? Number(h.Satis) || 0 : 0
      });
    }

    var govde = veri.length
      ? YU.ui.sutunGrafik({
          veri: veri, yukseklik: 210, renk2: 'var(--grafik-ikincil)',
          efsane: ['Dökme Üretim', 'Dökme Satış']
        })
      : YU.h('div', { sinif: 'yu-bos-metin', metin: 'Grafik için kayıtlı gün yok.' });

    return YU.ui.panel({
      baslik: 'Dökme Üretim – Dökme Satış',
      ikon: '#ic-chart',
      sag: son.length ? (YU.fmt.tarih(son[0].tarih) + ' – ' + YU.fmt.tarih(son[son.length - 1].tarih)) : null,
      govde: govde
    });
  }

  /* ==================================================================
     Son hareketler — önce denetim izi, yetmezse kayıtlı günler
     ================================================================== */

  /* Log satırı tek başına 'Aktif: Evet → Hayır' diyordu — hangi kaydın
     pasifleştiği belli değildi. Künye kaydın kendisinden çözülüyor. */
  /* Cümle içindeki GG.AA.YYYY parçaları ayıklanır: tarih artık ögenin
     BAŞLIĞI olarak ayrı gösterilir (kullanıcı isteği, 21.08.2026). */
  function tarihsizCumle(metin) {
    var m = String(metin).replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)\s*/g, ' ');
    var parcalar = m.split(' · '), tut = [], i;
    for (i = 0; i < parcalar.length; i++) {
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(parcalar[i].trim())) continue;
      tut.push(parcalar[i]);
    }
    return tut.join(' · ').replace(/\s{2,}/g, ' ').trim();
  }

  /* Ögenin başlık tarihi: kaydın İŞ tarihi (künyeden/özetten), yoksa
     denetim satırının kendi günü. */
  function logTarihi(kunye, ayrinti, l) {
    /* Önce özet metni: silme özetindeki "(20.08.2026)" işlemin asıl günüdür;
       künyedeki tarih yanlış kayda işaret edebilir (bilinen denetim izi notu). */
    var m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(ayrinti || ''));
    if (!m) m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(kunye || ''));
    if (m) return m[0];
    return YU.fmt.tarih(String(l.Tarih || '').slice(0, 10));
  }

  function logMetni(depo, l) {
    var ad = TABLO_ADI[l.Tablo] || l.Tablo;
    var kunye = YU.log.kayitEtiketi(depo, l.Tablo, l.KayitId);
    var bas = ad + (kunye ? ' · ' + kunye : '');
    function deger(v) { return (v === null || v === undefined || v === '') ? '—' : String(v); }

    var metin, ayrinti = null;
    if (l.Alan) {
      var cumle = YU.log.alanCumlesi(l.Alan, l.EskiDeger, l.YeniDeger);
      metin = cumle
        ? bas + ' · ' + cumle
        : bas + ' · ' + l.Alan + ': ' + deger(l.EskiDeger) + ' → ' + deger(l.YeniDeger);
    } else {
      ayrinti = l.Islem === 'Sil' ? l.EskiDeger : l.YeniDeger;
      var islem = ISLEM_ADI[l.Islem] || 'güncellendi';
      /* Künye zaten özet metnin içindeyse tekrar yazdırılmıyor. */
      var tekrar = kunye && ayrinti && String(ayrinti).indexOf(kunye) > -1;
      metin = bas + ' · ' + islem + (ayrinti && !tekrar ? ' · ' + ayrinti : '');
    }
    return { metin: tarihsizCumle(metin), tarih: logTarihi(kunye, ayrinti, l) };
  }

  /* minLogId verilirse bildirim modu: yalnız o kayıttan SONRAKİ denetim
     satırları listelenir, kayıtlı gün tamamlaması yapılmaz. Zilin "Tümünü
     Temizle" davranışı buna dayanır (kullanıcı isteği, 21.08.2026). */
  /* gun (isteğe bağlı, 'YYYY-AA-GG'): verilirse yalnız O GÜNE ait denetim izi
     satırları listelenir — zil paneli bunu bugünle çağırır (kullanıcı isteği,
     24.08.2026). Verilmezse eski davranış: gün ayrımı yapılmaz. */
  function hareketListesi(depo, o, logSinir, toplamSinir, minLogId, gun) {
    var logUst = logSinir || LOG_SATIR;
    var toplamUst = toplamSinir || HAREKET_SATIR;
    var liste = [], i, l, ad;
    var log = depo.degisiklikLog.slice();
    log.sort(function (a, b) {
      var x = String(a.Tarih || ''), y = String(b.Tarih || '');
      if (x !== y) return x < y ? 1 : -1;
      return (Number(b.Id) || 0) - (Number(a.Id) || 0);
    });

    /* Denetim izi tek bir günü onlarca satırla doldurabilir; listenin son
       kayıtlı günlere de yer bırakması için üst sınır konuyor. */
    for (i = 0; i < log.length && liste.length < logUst; i++) {
      l = log[i];
      if (minLogId && (Number(l.Id) || 0) <= minLogId) continue;
      /* Damga "2026-08-24T10:06:00" biçiminde; ilk on hane gün demek. */
      if (gun && String(l.Tarih || '').slice(0, 10) !== gun) continue;
      ad = kullaniciAdi(depo, l.KullaniciId);
      var lm = logMetni(depo, l);
      liste.push({
        ikon: TABLO_IKON[l.Tablo] || '#ic-dots',
        tarih: lm.tarih,
        metin: lm.metin,
        zaman: goreli(l.Tarih) + (ad ? ' · ' + ad : ''),
        logId: Number(l.Id) || 0   /* zil paneli okunmamışları bununla işaretler */
      });
    }

    /* Tohum verisi denetim izi bırakmaz (04-servis: tohumlamada log kapalı);
       liste boş kalmasın diye kayıtlı günlerden tamamlanır. Bildirim modunda
       tamamlanmaz: temizlenen liste yeniden dolmasın. */
    if (minLogId) return liste;
    for (i = 0; i < o.tumGunler.length && liste.length < toplamUst; i++) {
      /* Gün süzgeci tamamlama satırlarını da bağlar: "Bugünkü Hareketler"
         başlığı altında eski günler görünmemeli (24.08.2026). */
      if (gun && o.tumGunler[i].tarih !== gun) continue;
      (function (g) {
        liste.push({
          ikon: g.kuruKuspeVar ? '#ic-plus' : '#ic-pencil',
          tarih: YU.fmt.tarih(g.tarih),
          metin: (g.kuruKuspeVar ? 'Kuru küspe girişi' : 'Malzeme girişi') +
            (g.malzemeSayisi ? ' · ' + YU.fmt.sayi(g.malzemeSayisi) + ' Malzeme Satırı' : ''),
          zaman: goreli(g.sonGuncelleme || g.tarih) + (g.kullanici ? ' · ' + g.kullanici : ''),
          onClick: function () { YU.git('gunluk-rapor', { tarih: g.tarih }); }
        });
      })(o.tumGunler[i]);
    }

    return liste;
  }

  /* ==================================================================
     Silo kartları
     ================================================================== */

  function cubukTuru(oran) {
    if (oran > 1) return 'olumsuz';
    if (oran > 0.9) return 'bekleyen';
    return 'vurgu';
  }

  /* ------------------------------------------------------------------
     Silo doluluk pictogramı (kullanıcı isteği, 21.08.2026): çizim ortak
     kütüphanede — YU.ui.siloSekli (10-kabuk). Beğenilmezse SILO_GORSELI'yi
     false yapmak yeter: kart eski düz görünümüne döner, yüzde rozeti
     başlığa geri gelir, başka hiçbir yere dokunulmaz.
     ------------------------------------------------------------------ */
  var SILO_GORSELI = true;

  /* Silo Durumu kartındaki "Kalan kapasite" notunun aynısı (24-silo-durumu). */
  function kalanKapasiteNotu(mevcut, kapasite, oran) {
    if (kapasite <= 0) return 'Kapasite tanımlı değil';
    if (oran > 1) return 'Kapasite ' + YU.fmt.kgU(YU.yuvarla(mevcut - kapasite)) + ' aşıldı';
    var kalan = YU.fmt.kgU(YU.yuvarla(kapasite - mevcut));
    return oran > 0.9 ? 'Kalan kapasite ' + kalan + ' · D15 eşiğine yaklaşıldı' : 'Kalan kapasite ' + kalan;
  }

  /* Bir silonun en son giriş (ya da çıkış) gördüğü gün ve o günün toplamı.
     Aynı gün birden çok kayıt olabilir (çuvallama çekişi + satış çekişi);
     gün toplamı alınır. Hiç yoksa null. */
  function sonSiloHareketi(depo, siloId, alan) {
    var sonTarih = null, toplam = 0, i, h, m;
    for (i = 0; i < depo.siloHareket.length; i++) {
      h = depo.siloHareket[i];
      if (h.SiloId !== siloId) continue;
      m = Number(h[alan]) || 0;
      if (m <= 0) continue;
      if (sonTarih === null || h.Tarih > sonTarih) { sonTarih = h.Tarih; toplam = m; }
      else if (h.Tarih === sonTarih) toplam += m;
    }
    return sonTarih === null ? null : { tarih: sonTarih, miktar: YU.yuvarla(toplam) };
  }

  function siloSatiri(etiket, deger) {
    return YU.h('div', { stil: { display: 'flex', alignItems: 'baseline', gap: '10px' } },
      YU.h('span', { sinif: 'yu-etiket', metin: etiket, stil: { flex: '1', minWidth: '0' } }),
      YU.h('span', { sinif: 'yu-mono', metin: deger })
    );
  }

  function siloKarti(s) {
    var oran = Number(s.doluluk) || 0;
    var sonGiren = sonSiloHareketi(YU.db, s.silo.Id, 'GirenKg');
    var sonCikan = sonSiloHareketi(YU.db, s.silo.Id, 'CikanKg');
    var tur = cubukTuru(oran);

    /* Silo Durumu ekranındaki kart düzeni (kullanıcı isteği, 21.08.2026) —
       oradan farkı: "mevcut · … ton" ve "Kapasite … kg · … ton" satırları YOK;
       kapasiteyi yalnız "Kalan kapasite" satırı anlatır. Devir tarihi de
       oradaki gibi en son devirden okunur. */
    var devir = SILO_GORSELI
      ? YU.stok.enSonDevir(YU.db, 'Silo', s.silo.Id, YU.tarih.bugun()) : null;

    /* Eski düz görünüm (SILO_GORSELI=false): değer + çubuk + kapasite satırı. */
    var govde = SILO_GORSELI
      ? YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '14px' } },
          YU.ui.siloSekli(oran, tur),
          YU.h('div', {
            stil: { display: 'flex', flexDirection: 'column', gap: '10px', flex: '1', minWidth: '0' }
          },
            YU.h('div', null,
              /* Mevcut / kapasite göstergesi (kullanıcı isteği — kaldırılmayacak). */
              degerSatiri([
                YU.h('span', { metin: YU.fmt.kg(s.mevcut) }),
                birimEki('/ ' + YU.fmt.kg(s.kapasite) + ' kg')
              ]),
              /* Yatay doluluk çubuğu (kullanıcı isteği — kaldırılmayacak). */
              YU.h('div', { stil: { margin: '8px 0 6px' } }, YU.ui.cubuk(oran, tur)),
              YU.h('div', { sinif: 'yu-kpi-alt', metin: kalanKapasiteNotu(s.mevcut, s.kapasite, oran) })
            ),
            YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }),
            YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              siloSatiri(devir ? 'Devir · ' + YU.fmt.tarih(devir.DevirTarihi) : 'Devir', YU.fmt.kgU(s.devir)),
              /* Kampanya toplamı değil, EN SON hareket: o silonun en son giriş
                 aldığı günün toplam girişi ve en son çıkış yaptığı günün toplam
                 çıkışı, tarihiyle (kullanıcı isteği, 23.08.2026). */
              siloSatiri(sonGiren ? 'En Son Giren · ' + YU.fmt.tarih(sonGiren.tarih) : 'En Son Giren', sonGiren ? YU.fmt.kgU(sonGiren.miktar) : '—'),
              siloSatiri(sonCikan ? 'En Son Çıkan · ' + YU.fmt.tarih(sonCikan.tarih) : 'En Son Çıkan', sonCikan ? YU.fmt.kgU(sonCikan.miktar) : '—')
            )
          )
        )
      : [
          YU.h('div', { sinif: 'yu-kpi-deger', metin: YU.fmt.kgU(s.mevcut) }),
          YU.ui.cubuk(oran, tur),
          YU.h('div', {
            sinif: 'yu-kpi-alt',
            metin: 'Kapasite ' + YU.fmt.ton(s.kapasite) + ' · devir ' + YU.fmt.kgU(s.devir)
          })
        ];

    /* Silo kartı TIKLANMAZ (kullanıcı isteği, 24.08.2026): üstüne basınca
       Silo Durumu ekranının açılması istenmiyor. Kart yalnız göstergedir;
       Silo Durumu'na sol menüden gidilir. */
    var kart = YU.h('div', { sinif: 'yu-kpi' },
      YU.h('div', { sinif: 'yu-kpi-bas' },
        YU.h('div', { sinif: 'yu-kpi-ikon' }, YU.svg('#ic-building', 15)),
        YU.h('div', { sinif: 'yu-kpi-etiket', metin: s.silo.Ad }),
        /* Oran silonun ortasına taşındı; rozet yalnız eski görünümde kalır. */
        SILO_GORSELI ? null : YU.ui.rozet(YU.fmt.yuzde(oran * 100, 1), tur === 'vurgu' ? 'notr' : tur)
      ),
      govde
    );
    return kart;
  }

  function siloIzgarasi(o) {
    var iz = YU.h('div', { sinif: 'yu-izgara yu-iz-3' }), i;
    for (i = 0; i < o.silolar.length; i++) iz.appendChild(siloKarti(o.silolar[i]));
    return iz;
  }

  /* ==================================================================
     Malzeme stok tablosu
     ================================================================== */

  function malzemeAdi(malzeme) {
    if (malzeme.OzelTip !== 'DokmeKuruKuspe') return malzeme.Ad;
    /* Şartname §5 KRİTİK: bu satırın mevcudu formülle değil silo toplamıyla
       hesaplanır — rozet bunu ekranda görünür kılar. Sayı aktif silo
       sayısından gelir ("3 Silonun Toplamı"); silo eklenirse kendiliğinden
       güncellenir (kullanıcı isteği, 24.08.2026). */
    var siloSayisi = 0;
    for (var si = 0; si < YU.db.silolar.length; si++) {
      if (YU.db.silolar[si].Aktif !== false) siloSayisi++;
    }
    return YU.h('span', {
      stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }
    }, YU.h('span', { metin: malzeme.Ad }),
      YU.ui.rozet(YU.fmt.sayi(siloSayisi) + ' Silonun Toplamı', 'vurgu'));
  }

  function malzemePaneli(o) {
    var satirlar = [], i, s;
    for (i = 0; i < o.malzemeler.length; i++) {
      s = o.malzemeler[i];
      if (!s.malzeme || s.malzeme.Aktif === false) continue;
      satirlar.push({
        hucreler: [
          malzemeAdi(s.malzeme),
          YU.fmt.kg(s.devir),
          YU.fmt.kg(s.uretim),
          YU.fmt.kg(s.satis),
          YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(s.mevcut) })
        ],
        onClick: (function (id) {
          return function () { YU.git('stok-durumu', { malzeme: id }); };
        })(s.malzeme.Id)
      });
    }

    var tablo = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Malzeme' },
        /* Üretim ve satış, kampanya başı devirden bugüne BİRİKİMLİ toplamdır
           (YU.stok.tumMalzemeler, Şartname §5); başlık bunu açıkça söyler
           (kullanıcı isteği, 23.08.2026). */
        { baslik: 'Devir (Kg)', hiza: 'sag', mono: true, genislik: 132 },
        { baslik: 'Toplam Üretim (Kg)', hiza: 'sag', mono: true, genislik: 160 },
        { baslik: 'Toplam Satış (Kg)', hiza: 'sag', mono: true, genislik: 150 },
        { baslik: 'Mevcut (Kg)', hiza: 'sag', mono: true, genislik: 170 }
      ],
      satirlar: satirlar,
      bos: 'Aktif malzeme bulunamadı.',
      yapiskan: true
    });

    /* Sayı kolonları panelin sağ kenarına yapışıyordu; son kolonun sağ dolgusu
       açılarak blok hafifçe sola çekildi (kullanıcı isteği, 23.08.2026). */
    var sonHucreler = tablo.querySelectorAll('tr > th:last-child, tr > td:last-child');
    for (i = 0; i < sonHucreler.length; i++) sonHucreler[i].style.paddingRight = '40px';

    return YU.ui.panel({
      baslik: 'Malzeme Stokları',
      ikon: '#ic-chart',
      dolgusuz: true,
      sag: YU.ui.dugme({
        metin: 'Tümünü Gör', ikon: '#ic-chevron', tur: 'ikincil', kucuk: true,
        onClick: function () { YU.git('stok-durumu'); }
      }),
      govde: tablo
    });
  }

  /* ==================================================================
     Boş durum — artboard 2b dili
     ================================================================== */

  function adimKarti(a) {
    var acik = !a.yoneticiGerek || YU.yonetici();
    var kart = YU.h('div', {
      stil: {
        padding: '12px 13px', border: '1px solid var(--ayrac)', borderRadius: 'var(--r)',
        background: 'var(--yuzey)', cursor: acik ? 'pointer' : 'default', opacity: acik ? '1' : '.7'
      },
      title: acik ? null : 'Devir stok yalnızca Yönetici rolüyle girilir (Şartname §3).'
    },
      YU.h('div', {
        metin: a.no + ' · ' + a.baslik,
        stil: { font: '500 14px/1.3 var(--font)', color: 'var(--metin)', marginBottom: '5px' }
      }),
      YU.h('div', {
        metin: acik ? a.alt : a.alt + ' Yönetici yetkisi gerekir.',
        stil: { font: '400 13px/1.4 var(--font)', color: 'var(--metin-5)' }
      })
    );

    if (acik) {
      var ac = function () { YU.git(a.kod); };
      kart.setAttribute('role', 'button');
      kart.setAttribute('tabindex', '0');
      kart.addEventListener('click', ac);
      kart.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); }
      });
      kart.addEventListener('mouseenter', function () {
        kart.style.borderColor = 'var(--kenar-3)';
        kart.style.background = 'var(--yuzey-2)';
      });
      kart.addEventListener('mouseleave', function () {
        kart.style.borderColor = 'var(--ayrac)';
        kart.style.background = 'var(--yuzey)';
      });
    }
    return kart;
  }

  function ilkKullanimPaneli() {
    var yonetici = YU.yonetici();
    var eylemler = [];

    if (yonetici) {
      eylemler.push(YU.ui.dugme({
        metin: 'Devir Stok Tanımla', ikon: '#ic-wallet', tur: 'birincil',
        onClick: function () { YU.git('devir-stok'); }
      }));
      eylemler.push(YU.ui.dugme({
        metin: 'Günlük Giriş', ikon: '#ic-plus', tur: 'ikincil',
        onClick: function () { YU.git('kuru-kuspe'); }
      }));
    } else {
      eylemler.push(YU.ui.dugme({
        metin: 'Günlük Giriş', ikon: '#ic-plus', tur: 'birincil',
        onClick: function () { YU.git('kuru-kuspe'); }
      }));
    }

    var bos = YU.ui.bosDurum({
      ikon: '#ic-calendar',
      baslik: 'Henüz Kayıt Yok',
      metin: 'Devir stok, günlük kuru küspe kaydı ve malzeme hareketi girilmedi. ' +
        'Kampanya başı açılış stoğunu tanımlayarak başlayın.',
      eylemler: eylemler
    });

    var adimlar = [
      { no: '1', baslik: 'Devir Stok Tanımla', kod: 'devir-stok', yoneticiGerek: true,
        alt: 'Kampanya başı açılış stoğu — malzeme ve silo bazında.' },
      { no: '2', baslik: 'Kuru Küspe Gününü Gir', kod: 'kuru-kuspe',
        alt: 'Üretilen dökme, çuval adedi, satılan dökme ve silo dağıtımı.' },
      { no: '3', baslik: 'Malzeme Girişini Tamamla', kod: 'malzeme-girisi',
        alt: 'Yaş küspe, kuyruk, toprak ve çuvallı satış.' }
    ];

    var izgara = YU.h('div', {
      stil: {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%',
        marginTop: '22px', paddingTop: '22px', borderTop: '1px solid var(--ayrac-2)', textAlign: 'left'
      }
    });
    for (var i = 0; i < adimlar.length; i++) izgara.appendChild(adimKarti(adimlar[i]));
    bos.appendChild(izgara);

    return YU.ui.panel({ baslik: 'İlk Kullanım', ikon: '#ic-home', dolgusuz: true, govde: bos });
  }

  /* ==================================================================
     Çizim
     ================================================================== */

  function ciz(kap) {
    var depo = YU.db;
    if (!depo) {
      kap.appendChild(YU.ui.serit({
        tur: 'hata', baslik: 'Veri Deposu Yüklenmedi',
        metin: 'YU.db oluşmamış. Sayfayı yenileyin; sorun sürerse tarayıcı konsoluna bakın.'
      }));
      return;
    }

    var o = ozet(depo);

    if (o.bos) {
      kap.appendChild(ilkKullanimPaneli());
      return;
    }

    kap.appendChild(kpiIzgarasi(o));
    /* Son Hareketler kendi sayfasına, dökme üretim–satış grafiği Silo
       Durumu'na taşındı (kullanıcı istekleri, 21.08.2026). */
    kap.appendChild(siloIzgarasi(o));
    kap.appendChild(malzemePaneli(o));
  }

  YU.sayfaTanimla({
    kod: 'anasayfa',
    baslik: 'Ana Sayfa',
    altBaslik: function () {
      var depo = YU.db;
      if (!depo) return '';
      var donem = YU.donem.aktif();
      var gunler = donem ? YU.stok.kayitliGunler(depo, donem.bas, donem.bit) : YU.stok.kayitliGunler(depo);
      var parcalar = [donem ? ('Kampanya ' + donem.ad) : 'Kampanya dönemi tanımlı değil'];
      if (gunler.length) parcalar.push('son kayıt ' + YU.fmt.tarih(gunler[0].tarih));
      parcalar.push(YU.fmt.sayi(gunler.length) + ' gün veri girilmiş');
      return parcalar.join(' · ');
    },
    ikon: '#ic-home',
    grup: null,
    rol: 'Hepsi',
    ciz: ciz
  });

  /* Dökme üretim–satış grafiği artık Silo Durumu sayfasında çizilir; panel
     üreticisi oradan bu köprüyle çağrılır (kullanıcı isteği, 21.08.2026). */
  YU.dokmeGrafikPaneli = function () {
    var depo = YU.db;
    if (!depo) return null;
    return grafikPaneli(depo, ozet(depo));
  };

  /* Kabuktaki zil açılır paneli aynı listeyi kullanır (10-kabuk zilPaneliAc).
     Kabuk bu dosyadan önce yüklendiği için fonksiyon YU üzerinden verilir. */
  YU.sonHareketListesi = function (logSinir, toplamSinir, minLogId, gun) {
    var depo = YU.db;
    if (!depo) return [];
    return hareketListesi(depo, ozet(depo), logSinir, toplamSinir, minLogId, gun);
  };

  /* Son Hareketler sayfası kaldırıldı (kullanıcı isteği, 24.08.2026):
     liste yalnız üst şeritteki zil panelinde yaşar (YU.sonHareketListesi). */
})();

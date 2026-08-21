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
  var TREND_GUN = 7;         /* silo toplamı trendi */
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
    for (i = 0; i < silolar.length; i++) kapasite += Number(silolar[i].kapasite) || 0;
    for (i = 0; i < malzemeler.length; i++) {
      if (!malzemeler[i].malzeme || malzemeler[i].malzeme.Aktif === false) continue;
      if (/^Yaş Küspe/.test(String(malzemeler[i].malzeme.Ad))) {
        yasSatirlar.push(malzemeler[i]);
        yasIdler.push(malzemeler[i].malzeme.Id);
        if (POSET_DESEN.test(kisaAd(malzemeler[i].malzeme.Ad))) posetIdler.push(malzemeler[i].malzeme.Id);
        yasToplam += Number(malzemeler[i].mevcut) || 0;
      }
    }

    var dokmeToplam = YU.stok.dokmeToplam(depo, bugun);
    var oncekiDokme = sonGun ? YU.stok.dokmeToplam(depo, YU.tarih.ekle(sonGun, -TREND_GUN)) : null;

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
      oncekiDokme: oncekiDokme,
      cuvalMevcut: cuvalSatir ? Number(cuvalSatir.mevcut) || 0 : 0,
      yasSatirlar: yasSatirlar,
      yasToplam: YU.yuvarla(yasToplam),
      kapasite: kapasite,
      doluluk: kapasite > 0 ? dokmeToplam / kapasite : 0,
      pencereBas: p1bas,
      pencere: pencere,
      oncekiPencere: oncekiPencere,
      gunluk: {
        dokme: gunToplami(depo, dokmeId === null ? [] : [dokmeId], sonGun),
        cuval: gunToplami(depo, cuvalSatir ? [cuvalSatir.malzeme.Id] : [], sonGun),
        yas: gunToplami(depo, yasIdler, sonGun),
        poset: gunToplami(depo, posetIdler, sonGun)
      },
      /* Kampanya boyunca üretilen/satılan çuvallı toplamı (dokmePencere
         malzeme kimliğiyle çalışır, adı tarihseldir). */
      kampanyaCuval: dokmePencere(depo, cuvalSatir ? cuvalSatir.malzeme.Id : null,
        donem ? donem.bas : null, donem ? donem.bit : null),
      bos: !depo.kuruKuspeGunluk.length && !depo.gunlukHareket.length &&
           !depo.devirStok.length && !depo.siloDevirStok.length
    };
  }

  /* ==================================================================
     Sayfa başlığı eylemleri
     ================================================================== */

  function sayfaEylemleri(o) {
    var raporParam = o.sonGun ? { tarih: o.sonGun } : null;
    YU.ui.sayfaEylemleri(
      YU.ui.dugme({
        metin: 'Günlük Giriş', ikon: '#ic-plus', tur: 'birincil',
        onClick: function () { YU.git('kuru-kuspe', { tarih: o.sonGun || o.bugun }); }
      }),
      YU.ui.dugme({
        metin: 'Günlük Rapor', ikon: '#ic-doc', tur: 'ikincil',
        onClick: function () { YU.git('gunluk-rapor', raporParam); }
      })
    );
  }

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

  /* Yaş küspe kırılımı: her satır kg olarak yazılır; adet yalnızca 25'lik poşet
     için türetilir (bkz. POSET_KG yorumu — tonluk torbanın kg'ı bilinmiyor). */
  function yasDetayi(o) {
    if (!o.yasSatirlar.length) {
      return YU.h('div', { sinif: 'yu-kpi-alt', metin: 'Tanımlı yaş küspe malzemesi yok.' });
    }

    var parcalar = [], i, ad, kg;
    for (i = 0; i < o.yasSatirlar.length; i++) {
      ad = kisaAd(o.yasSatirlar[i].malzeme.Ad);
      kg = Number(o.yasSatirlar[i].mevcut) || 0;
      if (i) parcalar.push(' · ');
      parcalar.push(ad + ' ', detaySayi(YU.fmt.kg(kg)), ' kg');
      if (POSET_DESEN.test(ad)) {
        parcalar.push(' / ', detaySayi(YU.fmt.sayi(Math.round(kg / POSET_KG))), ' adet poşet');
      }
    }

    return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '4px' } },
      YU.h('div', { stil: { font: '400 14.5px/1.5 var(--font)', color: 'var(--metin-4)' } }, parcalar),
      YU.h('div', { sinif: 'yu-kpi-alt', metin: '1 poşet ' + YU.fmt.sayi(POSET_KG) + ' kg küspe' })
    );
  }

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

  function kartDokme(o) {
    var trend = o.oncekiDokme === null ? null : degisim(o.dokmeToplam, o.oncekiDokme);
    return YU.ui.kpi({
      etiket: 'Toplam Dökme Kuru Küspe', ikon: '#ic-silos',
      deger: YU.fmt.kgU(o.dokmeToplam),
      alt: YU.fmt.sayi(o.silolar.length) + ' silo · ' + YU.fmt.yuzde(o.doluluk * 100, 1) + ' dolu' +
        (trend ? ' · ' + TREND_GUN + ' günde ' + trend : '')
    });
  }

  /* Çuval adedi sabit değil, kg / YU.hesap.CUVAL_KG ile türetilir. */
  function kartCuval(o) {
    var cuvalAdet = Math.round(o.cuvalMevcut / YU.hesap.CUVAL_KG);
    return kpiKarti({
      etiket: 'Çuvallı Kuru Küspe', ikon: '#ic-sack',
      deger: degerSatiri([
        YU.h('span', { metin: YU.fmt.kg(o.cuvalMevcut) }), birimEki('kg'),
        birimEki('/'),
        YU.h('span', { metin: YU.fmt.sayi(cuvalAdet) }), birimEki('adet çuval')
      ]),
      alt: YU.h('div', {
        sinif: 'yu-kpi-alt',
        metin: '1 çuval ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg küspe'
      })
    });
  }

  /* Kampanya toplamı: üretilen çuvallı kg + adet; mevcut stok kartından
     farkı budur (kullanıcı isteği, 21.08.2026). */
  function kartToplamCuval(o) {
    var adet = Math.round(o.kampanyaCuval.uretim / YU.hesap.CUVAL_KG);
    return kpiKarti({
      etiket: 'Toplam Çuvallı Kuru Küspe', ikon: '#ic-sack',
      deger: degerSatiri([
        YU.h('span', { metin: YU.fmt.kg(o.kampanyaCuval.uretim) }), birimEki('kg üretim'),
        birimEki('/'),
        YU.h('span', { metin: YU.fmt.sayi(adet) }), birimEki('adet çuval')
      ]),
      alt: YU.h('div', {
        sinif: 'yu-kpi-alt',
        metin: o.donem
          ? 'Kampanya ' + o.donem.ad + ' toplamı · satış ' + YU.fmt.kgU(o.kampanyaCuval.satis)
          : 'Kampanya dönemi tanımlı değil.'
      })
    });
  }

  function kartYas(o) {
    return kpiKarti({
      etiket: 'Yaş Küspe Stoğu', ikon: '#ic-beet',
      ipucu: TONLUK_NOTU,
      deger: degerSatiri([YU.h('span', { metin: YU.fmt.kg(o.yasToplam) }), birimEki('kg')]),
      alt: yasDetayi(o)
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
  function kartToplamStok(o) {
    var toplam = 0, sayilan = 0, i, r;
    for (i = 0; i < o.malzemeler.length; i++) {
      r = o.malzemeler[i];
      if (!r.malzeme) continue;
      if (r.malzeme.Aktif !== false || r.mevcut !== 0) { toplam += Number(r.mevcut) || 0; sayilan++; }
    }
    return YU.ui.kpi({
      etiket: 'Toplam Stok', ikon: '#ic-shelf',
      deger: YU.fmt.kgU(YU.yuvarla(toplam)),
      alt: YU.fmt.sayi(sayilan) + ' malzeme · ' + YU.fmt.tarih(o.bugun) + ' itibarıyla'
    });
  }

  function kartDoluluk(o) {
    return YU.ui.kpi({
      etiket: 'Toplam Siloların Doluluk Oranı', ikon: '#ic-percent-ring',
      deger: o.kapasite > 0 ? YU.fmt.yuzde(o.doluluk * 100, 1) : '—',
      renk: o.doluluk >= 0.9 ? 'bekleyen' : 'vurgu',
      alt: o.kapasite > 0
        ? YU.fmt.kgU(o.dokmeToplam) + ' / ' + YU.fmt.ton(o.kapasite) + ' kapasite'
        : 'Silo kapasitesi tanımlı değil.'
    });
  }

  function kartKayitliGun(o) {
    return YU.ui.kpi({
      etiket: 'Kayıtlı Gün Sayısı', ikon: '#ic-calendar-dots',
      deger: YU.fmt.sayi(o.tumGunler.length),
      alt: o.sonGun ? ('Son kayıt ' + YU.fmt.tarih(o.sonGun)) : 'Kayıtlı gün yok.'
    });
  }

  /* Günlük kartlar: son kayıtlı günün üretim ve satışı tek kartta, çuval
     kartındaki "değer / değer" diliyle. Bugüne kayıt yoksa son gün gösterilir;
     alt satır hangi güne bakıldığını her zaman söyler. */
  function gunlukKarti(s) {
    var g = s.veri;
    return kpiKarti({
      etiket: s.etiket, ikon: s.ikon,
      deger: degerSatiri([
        YU.h('span', { metin: YU.fmt.kg(g.uretim) }), birimEki('kg üretim'),
        birimEki('·'),
        YU.h('span', { metin: YU.fmt.kg(g.satis) }), birimEki('kg satış')
      ]),
      alt: YU.h('div', {
        sinif: 'yu-kpi-alt',
        metin: !s.sonGun ? 'Kayıtlı gün yok.'
          : YU.fmt.tarih(s.sonGun) + ' · ' + YU.fmt.gunAdi(s.sonGun) + (s.notu ? ' · ' + s.notu : '')
      })
    });
  }

  function kartGunlukDokme(o) {
    return gunlukKarti({
      etiket: 'Günlük Dökme Üretim ve Satış', ikon: '#ic-swap',
      veri: o.gunluk.dokme, sonGun: o.sonGun
    });
  }

  function kartGunlukCuval(o) {
    var adet = Math.round(o.gunluk.cuval.uretim / YU.hesap.CUVAL_KG);
    return gunlukKarti({
      etiket: 'Günlük Çuvallı Kuru Küspe Üretim ve Satış', ikon: '#ic-sack-flow',
      veri: o.gunluk.cuval, sonGun: o.sonGun,
      notu: o.sonGun ? 'Üretim ' + YU.fmt.sayi(adet) + ' çuval karşılığı' : null
    });
  }

  function kartGunlukYas(o) {
    return gunlukKarti({
      etiket: 'Günlük Yaş Küspe Üretim ve Satış', ikon: '#ic-beet-flow',
      veri: o.gunluk.yas, sonGun: o.sonGun,
      notu: o.sonGun ? 'Tonluk ve 25\'lik toplamı' : null
    });
  }

  function kartGunlukPoset(o) {
    var adet = Math.round(o.gunluk.poset.uretim / POSET_KG);
    return gunlukKarti({
      etiket: 'Günlük Poşetli Yaş Küspe Üretim ve Satış', ikon: '#ic-bag',
      veri: o.gunluk.poset, sonGun: o.sonGun,
      notu: o.sonGun ? 'Üretim ' + YU.fmt.sayi(adet) + ' poşet karşılığı · 1 poşet ' +
        YU.fmt.sayi(POSET_KG) + ' kg' : null
    });
  }

  /* ==================================================================
     Özet kartları — hangisi, hangi sırada: kullanıcı seçer
     ==================================================================
     Katalogdaki kartlardan istenenler seçilir, sırası elle değiştirilir.
     Seçim tarayıcıda saklanır; prototipte sunucu yok, bu yüzden kullanıcı
     başına değil tarayıcı başınadır. */

  var KART_ANAHTAR = 'yu.anasayfa.kartlari.v1';

  var KART_KATALOG = [
    { kod: 'dokme', ad: 'Toplam Dökme Kuru Küspe', aciklama: 'Siloların toplamı, doluluk ve 7 günlük değişim.', ciz: kartDokme },
    { kod: 'cuval', ad: 'Çuvallı Kuru Küspe', aciklama: 'kg karşılığı ve çuval adedi.', ciz: kartCuval },
    { kod: 'toplam-cuval', ad: 'Toplam Çuvallı Kuru Küspe', aciklama: 'Kampanya boyunca üretilen çuvallı toplamı ve satışı.', ciz: kartToplamCuval },
    { kod: 'yas', ad: 'Yaş Küspe Stoğu', aciklama: 'Tonluk ve 25\'lik kırılımı.', ciz: kartYas },
    { kod: 'gunluk-dokme', ad: 'Günlük Dökme Üretim ve Satış', aciklama: 'Son kayıtlı günün dökme kuru küspe üretimi ve satışı.', ciz: kartGunlukDokme },
    { kod: 'gunluk-cuval', ad: 'Günlük Çuvallı Kuru Küspe Üretim ve Satış', aciklama: 'Son kayıtlı günün çuvallı kuru küspe üretimi ve satışı.', ciz: kartGunlukCuval },
    { kod: 'gunluk-yas', ad: 'Günlük Yaş Küspe Üretim ve Satış', aciklama: 'Son kayıtlı günün yaş küspe üretimi ve satışı.', ciz: kartGunlukYas },
    { kod: 'gunluk-poset', ad: 'Günlük Poşetli Yaş Küspe Üretim ve Satış', aciklama: 'Son kayıtlı günün 25\'lik poşet yaş küspe üretimi ve satışı.', ciz: kartGunlukPoset },
    { kod: 'uretim30', ad: 'Son 30 Günün Dökme Üretimi', aciklama: 'Pencere toplamı ve önceki döneme göre fark.', ciz: kartUretim30 },
    { kod: 'satis30', ad: 'Son 30 Günün Dökme Satışı', aciklama: 'Pencere toplamı ve üretime oranı.', ciz: kartSatis30 },
    { kod: 'toplam', ad: 'Toplam Stok', aciklama: 'Tüm malzemelerin bugünkü toplamı.', ciz: kartToplamStok },
    { kod: 'doluluk', ad: 'Toplam Siloların Doluluk Oranı', aciklama: 'Dökme stoğun kapasiteye oranı.', ciz: kartDoluluk },
    { kod: 'gun', ad: 'Kayıtlı Gün Sayısı', aciklama: 'Kampanyada veri girilmiş gün sayısı.', ciz: kartKayitliGun }
  ];

  var VARSAYILAN_KARTLAR = ['dokme', 'cuval', 'toplam-cuval', 'yas', 'gunluk-dokme', 'gunluk-cuval', 'gunluk-yas', 'gunluk-poset', 'uretim30', 'satis30'];

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
    var liste = [], i;
    for (i = 0; i < cozulen.length; i++) {
      if (kartBul(cozulen[i]) && liste.indexOf(cozulen[i]) < 0) liste.push(cozulen[i]);
    }
    return liste;
  }

  function kartlariYaz(liste) {
    try { localStorage.setItem(KART_ANAHTAR, JSON.stringify(liste)); } catch (e) { /* özel mod */ }
  }

  function kartlariSifirla() {
    try { localStorage.removeItem(KART_ANAHTAR); } catch (e) { /* özel mod */ }
  }

  function kucukEylem(ikon, baslik, pasif, onClick) {
    return YU.ui.dugme({ ikon: ikon, baslik: baslik, tur: 'sade', kucuk: true, pasif: pasif, onClick: onClick });
  }

  function kartSeciciAc() {
    var secim = kartlariOku();
    var liste = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '7px' } });

    function baslikSatiri(metin) {
      return YU.h('div', { sinif: 'yu-etiket', stil: { marginTop: '2px' }, metin: metin });
    }

    function kartSatiri(tanim, sira) {
      var secili = sira !== null;
      var sol = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1', minWidth: '0' } },
        YU.h('div', { sinif: 'yu-guclu', metin: tanim.ad }),
        YU.h('div', { sinif: 'yu-yardim', metin: tanim.aciklama })
      );
      var sag = YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '2px', flex: 'none' } });
      if (secili) {
        sag.appendChild(kucukEylem('#ic-up', 'Yukarı Taşı', sira === 0, function () { tasi(sira, -1); }));
        sag.appendChild(kucukEylem('#ic-down', 'Aşağı Taşı', sira === secim.length - 1, function () { tasi(sira, 1); }));
        sag.appendChild(YU.ui.dugme({
          metin: 'Kaldır', tur: 'sade', kucuk: true,
          onClick: function () { secim.splice(sira, 1); ciz(); }
        }));
      } else {
        sag.appendChild(YU.ui.dugme({
          metin: 'Ekle', ikon: '#ic-plus', tur: 'ikincil', kucuk: true,
          onClick: function () { secim.push(tanim.kod); ciz(); }
        }));
      }
      return YU.h('div', {
        stil: {
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '9px 11px', border: '1px solid var(--kenar)', borderRadius: 'var(--r)',
          background: secili ? 'var(--yuzey-2)' : 'transparent'
        }
      }, secili ? YU.ui.rozet(String(sira + 1), 'vurgu') : YU.h('span', { stil: { width: '22px' } }), sol, sag);
    }

    function tasi(sira, yon) {
      var hedef = sira + yon;
      if (hedef < 0 || hedef >= secim.length) return;
      var tut = secim[sira];
      secim[sira] = secim[hedef];
      secim[hedef] = tut;
      ciz();
    }

    function ciz() {
      YU.bos(liste);
      liste.appendChild(baslikSatiri('Gösterilen Kartlar'));
      if (!secim.length) liste.appendChild(YU.h('div', { sinif: 'yu-yardim', metin: 'Hiç kart seçilmedi — ana sayfada özet kartı görünmez.' }));
      var i;
      for (i = 0; i < secim.length; i++) liste.appendChild(kartSatiri(kartBul(secim[i]), i));

      liste.appendChild(baslikSatiri('Eklenebilir Kartlar'));
      var kalan = 0;
      for (i = 0; i < KART_KATALOG.length; i++) {
        if (secim.indexOf(KART_KATALOG[i].kod) >= 0) continue;
        kalan++;
        liste.appendChild(kartSatiri(KART_KATALOG[i], null));
      }
      if (!kalan) liste.appendChild(YU.h('div', { sinif: 'yu-yardim', metin: 'Katalogdaki tüm kartlar ekli.' }));
    }

    ciz();

    var m = YU.ui.modal({
      baslik: 'Ana Sayfa Kartları',
      genislik: 560,
      govde: [
        YU.h('div', { sinif: 'yu-yardim', stil: { marginBottom: '10px' },
          metin: 'Görmek istediğiniz kartları seçin, sırayı yukarı/aşağı düğmeleriyle değiştirin. Seçim bu tarayıcıda saklanır.' }),
        liste
      ],
      dugmeler: [
        { metin: 'Varsayılana Dön', onClick: function () { kartlariSifirla(); m.kapat(); YU.yenile(); } },
        { metin: 'Vazgeç', onClick: function () { m.kapat(); } },
        { metin: 'Kaydet', tur: 'birincil', onClick: function () { kartlariYaz(secim); m.kapat(); YU.yenile(); } }
      ]
    });
  }

  function kartCubugu(secim) {
    return YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
      YU.h('span', { sinif: 'yu-etiket', metin: 'Özet Kartları' }),
      YU.h('span', { sinif: 'yu-yardim', metin: YU.fmt.sayi(secim.length) + ' / ' + YU.fmt.sayi(KART_KATALOG.length) + ' kart' }),
      YU.h('span', { stil: { flex: '1' } }),
      YU.ui.dugme({ metin: 'Kartları Seç', ikon: '#ic-plus', tur: 'ikincil', kucuk: true, onClick: kartSeciciAc })
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
    for (i = 0; i < secim.length; i++) {
      tanim = kartBul(secim[i]);
      if (tanim) kartlar.push(tanim.ciz(o));
    }

    if (!kartlar.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-chart',
        baslik: 'Özet Kartı Seçilmedi',
        metin: 'Ana sayfada görmek istediğiniz kartları "Kartları Seç" ile ekleyebilirsiniz.',
        eylemler: [YU.ui.dugme({ metin: 'Kartları Seç', ikon: '#ic-plus', tur: 'birincil', onClick: kartSeciciAc })]
      }));
      return kap;
    }

    kap.appendChild(YU.h('div', { sinif: 'yu-izgara yu-iz-3 yu-esit' }, kartlar));
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
  function logMetni(depo, l) {
    var ad = TABLO_ADI[l.Tablo] || l.Tablo;
    var kunye = YU.log.kayitEtiketi(depo, l.Tablo, l.KayitId);
    var bas = ad + (kunye ? ' · ' + kunye : '');
    function deger(v) { return (v === null || v === undefined || v === '') ? '—' : String(v); }

    if (l.Alan) {
      var cumle = YU.log.alanCumlesi(l.Alan, l.EskiDeger, l.YeniDeger);
      if (cumle) return bas + ' · ' + cumle;
      return bas + ' · ' + l.Alan + ': ' + deger(l.EskiDeger) + ' → ' + deger(l.YeniDeger);
    }

    var ayrinti = l.Islem === 'Sil' ? l.EskiDeger : l.YeniDeger;
    var islem = ISLEM_ADI[l.Islem] || 'güncellendi';
    /* Künye zaten özet metnin içindeyse tekrar yazdırılmıyor. */
    var tekrar = kunye && ayrinti && String(ayrinti).indexOf(kunye) > -1;
    return bas + ' · ' + islem + (ayrinti && !tekrar ? ' · ' + ayrinti : '');
  }

  /* minLogId verilirse bildirim modu: yalnız o kayıttan SONRAKİ denetim
     satırları listelenir, kayıtlı gün tamamlaması yapılmaz. Zilin "Tümünü
     Temizle" davranışı buna dayanır (kullanıcı isteği, 21.08.2026). */
  function hareketListesi(depo, o, logSinir, toplamSinir, minLogId) {
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
      ad = kullaniciAdi(depo, l.KullaniciId);
      liste.push({
        ikon: TABLO_IKON[l.Tablo] || '#ic-dots',
        metin: logMetni(depo, l),
        zaman: goreli(l.Tarih) + (ad ? ' · ' + ad : '')
      });
    }

    /* Tohum verisi denetim izi bırakmaz (04-servis: tohumlamada log kapalı);
       liste boş kalmasın diye kayıtlı günlerden tamamlanır. Bildirim modunda
       tamamlanmaz: temizlenen liste yeniden dolmasın. */
    if (minLogId) return liste;
    for (i = 0; i < o.tumGunler.length && liste.length < toplamUst; i++) {
      (function (g) {
        liste.push({
          ikon: g.kuruKuspeVar ? '#ic-plus' : '#ic-pencil',
          metin: YU.fmt.tarih(g.tarih) + ' · ' + (g.kuruKuspeVar ? 'kuru küspe girişi' : 'malzeme girişi') +
            (g.malzemeSayisi ? ' · ' + YU.fmt.sayi(g.malzemeSayisi) + ' Malzeme Satırı' : ''),
          zaman: goreli(g.sonGuncelleme || g.tarih) + (g.kullanici ? ' · ' + g.kullanici : ''),
          onClick: function () { YU.git('gunluk-rapor', { tarih: g.tarih }); }
        });
      })(o.tumGunler[i]);
    }

    return liste;
  }

  function hareketSatiri(oge) {
    var ikonKap = YU.h('div', {
      stil: {
        width: '24px', height: '24px', borderRadius: '12px', flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--yuzey-4)', color: 'var(--metin-3)'
      }
    }, YU.svg(oge.ikon, 13));

    var govde = YU.h('div', { stil: { flex: '1', minWidth: '0' } },
      YU.h('div', { metin: oge.metin, stil: { font: '400 14px/1.4 var(--font)', color: 'var(--metin-2)' } }),
      YU.h('div', { metin: oge.zaman, stil: { font: '400 13px/1.4 var(--font)', color: 'var(--metin-4)', marginTop: '2px' } })
    );

    var satir = YU.h('div', {
      stil: { display: 'flex', gap: '11px', alignItems: 'flex-start', padding: '6px 8px', borderRadius: 'var(--r)' }
    }, ikonKap, govde);

    if (oge.onClick) {
      satir.setAttribute('role', 'button');
      satir.setAttribute('tabindex', '0');
      satir.style.cursor = 'pointer';
      satir.addEventListener('click', oge.onClick);
      satir.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oge.onClick(); }
      });
      satir.addEventListener('mouseenter', function () { satir.style.background = 'var(--yuzey-2)'; });
      satir.addEventListener('mouseleave', function () { satir.style.background = 'transparent'; });
    }
    return satir;
  }

  function hareketPaneli(depo, o, logSinir, toplamSinir) {
    var ogeler = hareketListesi(depo, o, logSinir, toplamSinir), i;
    var govde;

    if (!ogeler.length) {
      govde = YU.h('div', { sinif: 'yu-bos-metin', metin: 'Henüz hareket yok.' });
    } else {
      /* Satırların dolgusu panel kenarına taşsın ki hover alanı geniş olsun,
         metin hizası artboard 2a'daki liste ile aynı kalsın. */
      govde = YU.h('div', {
        stil: { display: 'flex', flexDirection: 'column', gap: '4px', margin: '-6px -8px' }
      });
      for (i = 0; i < ogeler.length; i++) govde.appendChild(hareketSatiri(ogeler[i]));
    }

    return YU.ui.panel({ baslik: 'Son Hareketler', ikon: '#ic-dots', govde: govde });
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

  function siloSatiri(etiket, deger) {
    return YU.h('div', { stil: { display: 'flex', alignItems: 'baseline', gap: '10px' } },
      YU.h('span', { sinif: 'yu-etiket', metin: etiket, stil: { flex: '1', minWidth: '0' } }),
      YU.h('span', { sinif: 'yu-mono', metin: deger })
    );
  }

  function siloKarti(s) {
    var oran = Number(s.doluluk) || 0;
    var tur = cubukTuru(oran);
    var ac = function () { YU.git('silo-durumu', { silo: s.silo.Id }); };

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
              siloSatiri('Giren', YU.fmt.kgU(s.giren)),
              siloSatiri('Çıkan', YU.fmt.kgU(s.cikan))
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

    var kart = YU.h('div', {
      sinif: 'yu-kpi', role: 'button', tabindex: '0',
      title: s.silo.Ad + ' · Silo Durumu ekranını aç',
      stil: { cursor: 'pointer' },
      onClick: ac,
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } }
    },
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
       hesaplanır — rozet bunu ekranda görünür kılar. */
    return YU.h('span', {
      stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }
    }, YU.h('span', { metin: malzeme.Ad }), YU.ui.rozet('Silo Toplamı', 'vurgu'));
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
        { baslik: 'Devir (Kg)', hiza: 'sag', mono: true, genislik: 132 },
        { baslik: 'Üretim (Kg)', hiza: 'sag', mono: true, genislik: 132 },
        { baslik: 'Satış (Kg)', hiza: 'sag', mono: true, genislik: 132 },
        { baslik: 'Mevcut (Kg)', hiza: 'sag', mono: true, genislik: 142 }
      ],
      satirlar: satirlar,
      bos: 'Aktif malzeme bulunamadı.',
      yapiskan: true
    });

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
    sayfaEylemleri(o);

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
  YU.sonHareketListesi = function (logSinir, toplamSinir, minLogId) {
    var depo = YU.db;
    if (!depo) return [];
    return hareketListesi(depo, ozet(depo), logSinir, toplamSinir, minLogId);
  };

  /* Son Hareketler ayrı sayfa: ana sayfadan kaldırıldı, üst şeritteki zil
     düğmesi buraya açılır (kullanıcı isteği, 21.08.2026). Aynı liste
     üreticileri kullanılır; yalnız satır sınırları geniş tutulur. */
  YU.sayfaTanimla({
    kod: 'son-hareketler',
    baslik: 'Son Hareketler',
    altBaslik: function () {
      var d = YU.db;
      return d ? YU.fmt.sayi(d.degisiklikLog.length) + ' denetim kaydından son hareketler' : '';
    },
    ikon: '#ic-bell',
    grup: 'Yönetim',
    rol: 'Hepsi',
    ciz: function (kap) {
      var depo = YU.db;
      if (!depo) return;
      kap.appendChild(hareketPaneli(depo, ozet(depo), 30, 40));
    }
  });
})();

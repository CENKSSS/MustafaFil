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
  var POSET_KG = 25;
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

  function gunKayitliMi(depo, tarih) {
    var i;
    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      if (depo.kuruKuspeGunluk[i].Tarih === tarih) return true;
    }
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      if (depo.gunlukHareket[i].Tarih === tarih) return true;
    }
    return false;
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

    var kapasite = 0, i, yasSatirlar = [], yasToplam = 0;
    for (i = 0; i < silolar.length; i++) kapasite += Number(silolar[i].kapasite) || 0;
    for (i = 0; i < malzemeler.length; i++) {
      if (!malzemeler[i].malzeme || malzemeler[i].malzeme.Aktif === false) continue;
      if (/^Yaş Küspe/.test(String(malzemeler[i].malzeme.Ad))) {
        yasSatirlar.push(malzemeler[i]);
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

  /* ==================================================================
     Durum şeritleri — üçü de bağımsız koşul, üst üste görünebilirler.
     ================================================================== */

  function seritler(depo, o) {
    var liste = [], negatif = YU.stok.negatifGunler(depo);

    if (negatif.length) {
      var n = negatif[0];
      liste.push(YU.ui.serit({
        tur: 'hata',
        baslik: 'Silo Bakiyesi Negatife Düşüyor',
        metin: n.siloAd + ' · ' + YU.fmt.tarih(n.tarih) + ' · ' + YU.fmt.kgU(n.bakiye) +
          (negatif.length > 1 ? ' · toplam ' + YU.fmt.sayi(negatif.length) + ' gün etkileniyor' : ''),
        eylem: {
          metin: 'Silo Durumu', ikon: '#ic-building',
          onClick: function () { YU.git('silo-durumu'); }
        }
      }));
    }

    if (!gunKayitliMi(depo, o.bugun)) {
      liste.push(YU.ui.serit({
        tur: 'uyari',
        baslik: 'Bugünün Girişi Yok',
        metin: 'Bugün (' + YU.fmt.tarih(o.bugun) + ') için henüz kayıt girilmemiş.',
        eylem: {
          metin: 'Şimdi Gir', ikon: '#ic-plus',
          onClick: function () { YU.git('kuru-kuspe', { tarih: o.bugun }); }
        }
      }));
    }

    /* donem.bas devir tarihinden, donem.bit son kayıtlı günden gelir (10-kabuk);
       bugün bu aralığın dışındaysa kampanya kayıtları başka bir döneme aittir. */
    if (o.donem && (o.bugun < o.donem.bas || o.bugun > o.donem.bit)) {
      liste.push(YU.ui.serit({
        tur: 'bilgi',
        baslik: 'Kampanya Aralığının Dışındasınız',
        metin: 'Kampanya ' + o.donem.ad + ' kayıtları ' + YU.fmt.tarih(o.donem.bas) + ' – ' +
          YU.fmt.tarih(o.donem.bit) + ' aralığında · son kayıt ' + goreli(o.donem.bit) + '.',
        eylem: {
          metin: 'Son Güne Git', ikon: '#ic-doc',
          onClick: function () { YU.git('gunluk-rapor', { tarih: o.donem.bit }); }
        }
      }));
    }

    return liste;
  }

  /* ==================================================================
     KPI kartları
     ================================================================== */

  /* Değer satırında sayı ile birim ayrı elemanlara bölünüyor: sayı .yu-kpi-deger'in
     mono + tabular ölçüsünü sürdürür, birim kelimesi bir tık küçük ve soluk kalır ki
     rakam öne çıksın. Ölçüler tema.css'teki KPI/menü değerleriyle aynı ailedendir. */
  function birimEki(metin) {
    return YU.h('span', {
      metin: metin,
      stil: { font: '400 13px/1 var(--font)', letterSpacing: 'normal', color: 'var(--metin-4)' }
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
      stil: { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--metin-2)' }
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
      YU.h('div', { stil: { font: '400 12.5px/1.5 var(--font)', color: 'var(--metin-4)' } }, parcalar),
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

  function kpiIzgarasi(o) {
    var trend = o.oncekiDokme === null ? null : degisim(o.dokmeToplam, o.oncekiDokme);
    var satisOrani = o.pencere.uretim > 0 ? (o.pencere.satis / o.pencere.uretim) * 100 : null;
    var cuvalAdet = Math.round(o.cuvalMevcut / YU.hesap.CUVAL_KG);

    var stokIz = YU.h('div', { sinif: 'yu-izgara yu-iz-3' });
    var donemIz = YU.h('div', { sinif: 'yu-izgara yu-iz-2' });

    stokIz.appendChild(YU.ui.kpi({
      etiket: 'Toplam Dökme Kuru Küspe', ikon: '#ic-building',
      deger: YU.fmt.kgU(o.dokmeToplam),
      alt: YU.fmt.sayi(o.silolar.length) + ' silo · ' + YU.fmt.yuzde(o.doluluk * 100, 1) + ' dolu' +
        (trend ? ' · ' + TREND_GUN + ' günde ' + trend : '')
    }));

    /* Çuval adedi sabit değil, kg / YU.hesap.CUVAL_KG ile türetilir. */
    stokIz.appendChild(kpiKarti({
      etiket: 'Çuvallı Kuru Küspe', ikon: '#ic-wallet',
      deger: degerSatiri([
        YU.h('span', { metin: YU.fmt.kg(o.cuvalMevcut) }), birimEki('kg'),
        birimEki('/'),
        YU.h('span', { metin: YU.fmt.sayi(cuvalAdet) }), birimEki('adet çuval')
      ]),
      alt: YU.h('div', {
        sinif: 'yu-kpi-alt',
        metin: '1 çuval ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg küspe'
      })
    }));

    stokIz.appendChild(kpiKarti({
      etiket: 'Yaş Küspe Stoğu', ikon: '#ic-chart',
      ipucu: TONLUK_NOTU,
      deger: degerSatiri([YU.h('span', { metin: YU.fmt.kg(o.yasToplam) }), birimEki('kg')]),
      alt: yasDetayi(o)
    }));

    donemIz.appendChild(YU.ui.kpi({
      etiket: 'Son 30 Günün Dökme Üretimi', ikon: '#ic-up',
      deger: YU.fmt.kgU(o.pencere.uretim),
      alt: o.sonGun ? (pencereAraligi(o) + ' · ' + pencereFarki(o, 'uretim')) : 'Kayıtlı gün yok.'
    }));

    donemIz.appendChild(YU.ui.kpi({
      etiket: 'Son 30 Günün Dökme Satışı', ikon: '#ic-down',
      deger: YU.fmt.kgU(o.pencere.satis),
      alt: !o.sonGun ? 'Kayıtlı gün yok.'
        : ((satisOrani === null ? '' : 'Üretime oranı ' + YU.fmt.yuzde(satisOrani, 1) + ' · ') +
           pencereFarki(o, 'satis'))
    }));

    /* "Kayıtlı Gün Sayısı" kartı kaldırıldı (kullanıcı isteği); bilgi sayfa alt
       başlığında ve kenar çubuğu kampanya kartında duruyor. Kalan 5 kart 3 + 2
       olarak yerleşiyor — üçlü ızgarada boş göz kalmıyor, dönem kartları da
       uzun alt metinlerine yetecek genişliği buluyor. Dış boşluk .yu-izgara'nın
       kendi boşluğuyla aynı ki iki sıra tek blok gibi okunsun. */
    return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      stokIz, donemIz);
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

  function logMetni(l) {
    var ad = TABLO_ADI[l.Tablo] || l.Tablo;
    function deger(v) { return (v === null || v === undefined || v === '') ? '—' : String(v); }
    if (l.Alan) return ad + ' · ' + l.Alan + ': ' + deger(l.EskiDeger) + ' → ' + deger(l.YeniDeger);
    var ayrinti = l.Islem === 'Sil' ? l.EskiDeger : l.YeniDeger;
    return ad + ' ' + (ISLEM_ADI[l.Islem] || 'güncellendi') + (ayrinti ? ' · ' + ayrinti : '');
  }

  function hareketListesi(depo, o) {
    var liste = [], i, l, ad;
    var log = depo.degisiklikLog.slice();
    log.sort(function (a, b) {
      var x = String(a.Tarih || ''), y = String(b.Tarih || '');
      if (x !== y) return x < y ? 1 : -1;
      return (Number(b.Id) || 0) - (Number(a.Id) || 0);
    });

    /* Denetim izi tek bir günü onlarca satırla doldurabilir; listenin son
       kayıtlı günlere de yer bırakması için üst sınır konuyor. */
    for (i = 0; i < log.length && liste.length < LOG_SATIR; i++) {
      l = log[i];
      ad = kullaniciAdi(depo, l.KullaniciId);
      liste.push({
        ikon: TABLO_IKON[l.Tablo] || '#ic-dots',
        metin: logMetni(l),
        zaman: goreli(l.Tarih) + (ad ? ' · ' + ad : '')
      });
    }

    /* Tohum verisi denetim izi bırakmaz (04-servis: tohumlamada log kapalı);
       liste boş kalmasın diye kayıtlı günlerden tamamlanır. */
    for (i = 0; i < o.tumGunler.length && liste.length < HAREKET_SATIR; i++) {
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
      YU.h('div', { metin: oge.metin, stil: { font: '400 12px/1.4 var(--font)', color: 'var(--metin-2)' } }),
      YU.h('div', { metin: oge.zaman, stil: { font: '400 11px/1.4 var(--font)', color: 'var(--metin-4)', marginTop: '2px' } })
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

  function hareketPaneli(depo, o) {
    var ogeler = hareketListesi(depo, o), i;
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

  function siloKarti(s) {
    var oran = Number(s.doluluk) || 0;
    var tur = cubukTuru(oran);
    var ac = function () { YU.git('silo-durumu', { silo: s.silo.Id }); };

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
        YU.ui.rozet(YU.fmt.yuzde(oran * 100, 1), tur === 'vurgu' ? 'notr' : tur)
      ),
      YU.h('div', { sinif: 'yu-kpi-deger', metin: YU.fmt.kgU(s.mevcut) }),
      YU.ui.cubuk(oran, tur),
      YU.h('div', {
        sinif: 'yu-kpi-alt',
        metin: 'Kapasite ' + YU.fmt.ton(s.kapasite) + ' · devir ' + YU.fmt.kgU(s.devir)
      })
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
      bos: 'Aktif malzeme bulunamadı.'
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
        stil: { font: '500 12px/1.3 var(--font)', color: 'var(--metin)', marginBottom: '5px' }
      }),
      YU.h('div', {
        metin: acik ? a.alt : a.alt + ' Yönetici yetkisi gerekir.',
        stil: { font: '400 11px/1.4 var(--font)', color: 'var(--metin-5)' }
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

    var s = seritler(depo, o), i;
    for (i = 0; i < s.length; i++) kap.appendChild(s[i]);

    kap.appendChild(kpiIzgarasi(o));
    kap.appendChild(YU.h('div', { sinif: 'yu-izgara yu-iz-yan' },
      grafikPaneli(depo, o), hareketPaneli(depo, o)));
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
})();

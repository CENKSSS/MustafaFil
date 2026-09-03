/* js/20-anasayfa.js — Ana Sayfa (Şartname §7: "malzeme ve silo stoklarının kart
   görünümü, sık kullanılan işlemlere kısayol").

   Görsel dil: design-reference/accounting-dashboard artboard 2a — KPI ızgarası,
   1.55fr/1fr blok (sütun grafiği + son hareketler), altta tablo. Boş durum 2b.
   SOZLESME §6 (UI yardımcıları), §7 (sayfa kaydı ve ikon eşlemesi).

   Ekrandaki her rakam YU.stok / YU.donem üzerinden hesaplanır; sabit sayı yok. */
(function () {
  'use strict';

  var YU = window.YU;

  var HAREKET_SATIR = 6;
  var LOG_SATIR = 4;         /* son hareketlerin en fazla bu kadarı denetim izinden */

  /* POSET_KG / TONLUK_NOTU / TONLUK_KG kaldırıldı (25.08.2026): torba ve poşet
     adedi yalnız özet kartlarında yazılıyordu, kartlar kalkınca kullanan kalmadı.
     POSET_DESEN duruyor — Malzeme Stokları tablosu 25'lik satırını hâlâ adından
     ayırt ediyor (SOZLESME §1). */
  var POSET_DESEN = /25/;

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
    /* Kampanya bakışı (kullanıcı isteği, 24.08.2026): geçmiş kampanya
       seçiliyken kartlar o kampanyanın SONUNU gösterir, kayıtlı günler
       o kampanyayla sınırlanır. Aktif kampanyada davranış aynıdır
       (görünüm sonu = bugün). */
    var bugun = YU.donem.gorunumSonu();
    var donem = YU.donem.aktif();
    var tumGunler = YU.stok.kayitliGunler(depo, donem ? donem.bas : null, bugun);
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
     Kart yardımcıları — silo kartları bu ikisini kullanır
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

  /* ÖZET KARTLARI kaldırıldı (kullanıcı kararı, 25.08.2026 — sadeleştirme).
     Aynı rakamlar Malzeme Stokları tablosunda satır satır okunuyordu; sekiz
     kartlık şerit ekranın üst yarısını kapatıyordu. Kart kataloğu, kart seçme
     çubuğu ve localStorage tercihi (yu.anasayfa.kartlari.v1) birlikte gitti.
     SİLO KARTLARI YERİNDE DURUYOR (kullanıcı isteği, 25.08.2026). */

  /* ==================================================================
     Sütun grafiği — son 14 kayıtlı gün
     ================================================================== */

  function grafikPaneli(depo, o) {
    /* Gün sınırı YOK (kullanıcı isteği, 25.08.2026): grafik panelin yarısında
       kalıyordu. Kampanyanın bütün günleri çizilir; aynı anda kaç sütun
       göründüğünü pencere genişliği belirler (sütun genişliği sabit), kalanına
       oklarla/sürükleyerek gidilir. */
    var son = o.tumGunler.slice().reverse();
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

    /* Grafik penceresi: aynı anda EN ÇOK 7 gün görünür, kalan günlere fareyle
       sürükleyerek gidilir (kullanıcı isteği, 25.08.2026). SVG'nin genişliği
       YÜZDE olarak verilir — 7 gün tam kaba sığar, gün sayısı arttıkça SVG
       taşar ve kap yatay kaydırır. Yüzde olduğu için panel dar da olsa geniş
       de olsa pencere hep 7 gün kalır. */
    /* Kaydırma, sürükleme ve oklar ortak bileşende (10-kabuk
       YU.ui.kaydirmaliGrafik) — Aylık Özet'in gün gün grafiği de aynısını
       kullanıyor, davranış tek yerde tanımlı (25.08.2026). */
    var g = YU.ui.kaydirmaliGrafik({
      veri: veri, yukseklik: 210, renk2: 'var(--grafik-ikincil)',
      efsane: ['Dökme Üretim', 'Dökme Satış'],
      /* Tekerlekle sağa-sola kayma KAPALI (kullanıcı isteği, 25.08.2026):
         grafiğin üstünde tekerlek çevrilince sayfa kaysın. Oklar ve fareyle
         sürükleme çalışmaya devam eder. Aylık Özet'in grafiği etkilenmez. */
      tekerleksiz: true
    });
    var grafikGovde = g.govde, notEl = g.notEl;

    var grafikPanel = YU.ui.panel({
      baslik: 'Dökme Üretim – Dökme Satış',
      ikon: '#ic-chart',
      sag: son.length
        ? YU.h('span', null,
            YU.h('span', { metin: YU.fmt.tarih(son[0].tarih) + ' – ' + YU.fmt.tarih(son[son.length - 1].tarih) }),
            notEl)
        : null,
      govde: grafikGovde
    });
    /* yu-grafik-kucult: panel %8 küçülür (kullanıcı isteği, 01.09.2026).
       Ölçü css/tema.css içindeki aynı adlı blokta. */
    grafikPanel.className += ' yu-grafik-kucult';
    return grafikPanel;
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

    /* Denetim izi olmayan günler için liste kayıtlı günlerden tamamlanır
       (eski veride ya da izin tavana takılıp düştüğü günlerde boş kalmasın).
       Bildirim modunda tamamlanmaz: temizlenen liste yeniden dolmasın. */
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

  /* Bir silonun en son giriş (ya da çıkış) gördüğü gün ve o günün toplamı.
     Aynı gün birden çok kayıt olabilir (çuvallama çekişi + satış çekişi);
     gün toplamı alınır. Hiç yoksa null. */
  function sonSiloHareketi(depo, siloId, alan) {
    var sonTarih = null, toplam = 0, i, h, m;
    /* Kampanya bakışı: seçili kampanyanın görünüm sonundan sonraki
       hareketler sayılmaz. */
    var bakisSonu = YU.donem.gorunumSonu();
    for (i = 0; i < depo.siloHareket.length; i++) {
      h = depo.siloHareket[i];
      if (h.SiloId !== siloId) continue;
      if (h.Tarih > bakisSonu) continue;
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
       kapasiteyi yalnız "Kalan kapasite" satırı anlatır.
       Devir tarihi sorgusu (enSonDevir) 28.08.2026'da KALDIRILDI: kartta
       tarih satırı kalmadığı için sonucu kullanılmıyordu; her silo kartı
       için boşuna devir taraması yapıyordu. Tarih, Silo Bazında Stok
       tablosunun kendi kolonundan gelir. */

    /* Eski düz görünüm (SILO_GORSELI=false): değer + çubuk + kapasite satırı. */
    var govde = SILO_GORSELI
      ? YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '11px' } },
          /* Huni (konik alt) kaldırıldı (kullanıcı isteği, 25.08.2026):
             düz tabanlı silindir biçimine dönüldü — Silo Durumu ile aynı.
             Geri istenirse üçüncü argüman yine true yapılır. */
          YU.ui.siloSekli(oran, tur),
          YU.h('div', {
            stil: { display: 'flex', flexDirection: 'column', gap: '8px', flex: '1', minWidth: '0' }
          },
            YU.h('div', null,
              /* Mevcut / kapasite göstergesi (kullanıcı isteği — kaldırılmayacak). */
              degerSatiri([
                YU.h('span', { metin: YU.fmt.kg(s.mevcut) }),
                birimEki('/ ' + YU.fmt.kg(s.kapasite) + ' kg')
              ]),
              /* Yatay doluluk çubuğu (kullanıcı isteği — kaldırılmayacak). */
              /* "Kalan kapasite …" satiri KALDIRILDI (kullanici istegi,
                 01.09.2026). Ayni bilgi bir ust satirdaki "mevcut / kapasite"
                 gostergesinde ve doluluk cubugunda zaten okunuyor. Silo Durumu
                 ekranindaki ayni satira DOKUNULMADI (24-silo-durumu). */
              YU.h('div', { stil: { margin: '6px 0 0' } }, YU.ui.cubuk(oran, tur))
            ),
            YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }),
            /* Satır arası 8 -> 5 px (kullanıcı isteği, 01.09.2026: "En Son
               Çıkan yazısını biraz yukarıya al, En Son Giren'in altına daha
               da yaklaştır"). Yazı ölçüleri ve satır yükseklikleri aynı;
               kısalan yalnız aralarındaki boşluk. */
            YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '5px' } },
              /* Kartta yalnız DEVİR RAKAMI (kullanıcı isteği, 28.08.2026):
                 tarih satırı "fazlalık" olduğu için kaldırıldı. Devir tarihi
                 aynı sayfadaki Silo Bazında Stok tablosunda kendi kolonunda
                 duruyor — bilgi kaybolmadı, tekrarı kalktı. */
              siloSatiri('Devir', YU.fmt.kgU(s.devir)),
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
    /* yu-silo-kart: kartin CERCEVESI daraltilir (kullanici istegi,
       01.09.2026: "sinirlari kucultulsun, az ama"). Yazi, ikon ve sayi
       olculeri AYNEN kalir; kisalan yalniz dolgu ve bosluk. Olculer
       css/tema.css icindeki ayni adli blokta. */
    var kart = YU.h('div', { sinif: 'yu-kpi yu-silo-kart' },
      YU.h('div', { sinif: 'yu-kpi-bas' },
        YU.h('div', { sinif: 'yu-kpi-ikon' }, YU.svg('#ic-building', 15)),
        YU.h('div', { sinif: 'yu-kpi-etiket', metin: s.silo.Ad }),
        /* Oran silonun ortasına taşındı; rozet yalnız eski görünümde kalır. */
        SILO_GORSELI ? null : YU.ui.rozet(YU.fmt.doluluk(oran), tur === 'vurgu' ? 'notr' : tur)
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

  /* ANA SAYFANIN KENDİ "Malzeme Stokları" TABLOSU KALDIRILDI (kullanıcı
     isteği, 25.08.2026). Yerine Günlük Stok Durumu'ndaki "Malzeme Bazında
     Stok" panelinin aynısı geliyor (YU.malzemeStokPaneli — 23-stok-durumu),
     altına da Günlük Silo Durumu'ndaki "Silo Bazında Stok" paneli
     (YU.siloStokPaneli — 24-silo-durumu). İki panelde de tarih HEP bugündür
     ve tarih girişi yoktur. malzemeAdi yardımcısı yalnız eski tabloya
     hizmet ettiği için birlikte kaldırıldı. */

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

    /* "Günlük Giriş" düğmesi KALDIRILDI (kullanıcı isteği, 03.09.2026).
       Panelde yalnız devir düğmesi kalır; adım kartları eskisi gibi durur. */
    if (yonetici) {
      eylemler.push(YU.ui.dugme({
        metin: 'Devir Stok Tanımla', ikon: '#ic-wallet', tur: 'birincil',
        onClick: function () { YU.git('devir-stok'); }
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
        alt: 'Üretilen dökme, çuvallanan, satılan dökme ve silo dağıtımı.' },
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

    /* SIRA (kullanıcı isteği, 25.08.2026): silo kartları → dökme üretim–satış
       grafiği → Silo Bazında Stok → Malzeme Bazında Stok. Grafik, Günlük Silo
       Durumu'ndaki panelin BİREBİR AYNISIDIR — kaydırmalı ve sürüklenebilir.
       Stok/Silo panelleri de kendi ekranlarındaki panellerin aynısıdır; dosya
       yükleme sırası nedeniyle varlık kontrolü yapılır.
       Son Hareketler kendi sayfasına taşındı (kullanıcı isteği, 21.08.2026).

       YAZDIRMAYA GİRMEZLER (kullanıcı isteği, 26.08.2026): kâğıda yalnız iki
       stok tablosu basılır. Silo kartları ve kampanya grafiği ekranda kalır;
       kâğıtta bir sayfa yer kaplayıp raporu ikiye bölüyorlardı. Sınıf YALNIZ
       bu iki öğeye burada takılır — Günlük Silo Durumu'ndaki aynı grafik
       (YU.dokmeGrafikPaneli) etkilenmez, orada basılmaya devam eder. */
    var siloKartlari = siloIzgarasi(o);
    siloKartlari.className += ' yu-baski-yok';
    kap.appendChild(siloKartlari);

    var grafik = grafikPaneli(depo, o);
    grafik.className += ' yu-baski-yok';
    kap.appendChild(grafik);

    /* Paneller şeritten ÖNCE kurulur, ekranda yine altta durur: Excel düğmesi
       tıklanınca panelin gösterdiği günü (data-tarih) okuyacak. */
    var siloPanel = typeof YU.siloStokPaneli === 'function'
      /* devirTarihiAyri (27.08.2026) + hizaOrta (28.08.2026): rakam kolon
         başlığının ortasında durur, hane sayısı artsa da ortalı kalır. */
      /* birimli (28.08.2026): rakamın yanında "kg" yazar, Malzeme Bazında
         Stok tablosundaki dille aynı olur. */
      /* Bayraksız: Ana Sayfa düzeni 28.08.2026'dan beri VARSAYILAN. */
      ? YU.siloStokPaneli()
      : null;
    var malzemePanel = typeof YU.malzemeStokPaneli === 'function'
      ? YU.malzemeStokPaneli()   /* bayraksız — varsayılan zaten bu düzen */
      : null;

    /* EYLEM ŞERİDİ — sayfa başlığının sağından ALINDI, grafik ile Silo Bazında
       Stok arasındaki ara koridora konuldu, sağa yaslı (kullanıcı isteği,
       26.08.2026). Düğmeler bastıkları raporun hemen üstünde durur; sayfa
       başlığı yalnız başlık kalır.
       Yazdırmaya girmez: kâğıda yalnız iki stok tablosu basılır. */
    var eylemSeridi = YU.h('div', {
      sinif: 'yu-baski-yok',
      stil: { display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }
    },
      /* Raporu Mail ile Gönder (kullanıcı isteği, 26.08.2026). Şartname dışı
         ektir; ayrıntı ve gerekçe 35-mail-gonder.js başında yazılı. Modül
         yüklenmemişse düğme hiç çizilmez — sayfa yine açılır.
         BİRİNCİL görünüm: Yazdır'la aynı mavi zemin · koyu yazı. */
      typeof YU.mailPaneli === 'function' ? YU.ui.dugme({
        metin: 'Mail ile Gönder', ikon: '#ic-doc', tur: 'birincil', kucuk: true,
        baslik: 'Günlük Stok Durumu raporunu seçtiğiniz adreslere postalayın',
        onClick: function () { YU.mailPaneli(); }
      }) : null,
      /* Excel İndir — Şartname §11'in birinci opsiyonel genişletmesi; ayrıntı
         ve gerekçe 36-excel-indir.js başında yazılı. Kullanıcı isteği
         (26.08.2026) sıranın Mail · Excel · Yazdır olmasıdır. Ekranda hangi gün
         açıksa onu indirir: gün panelin data-tarih değerinden okunur. */
      typeof YU.excelIndir === 'function' ? YU.ui.dugme({
        metin: 'Excel İndir', ikon: '#ic-download', tur: 'birincil', kucuk: true,
        baslik: 'Ekrandaki iki stok tablosunu Excel ile açılan dosyaya indirir',
        onClick: function () {
          YU.excelIndir(malzemePanel && malzemePanel.getAttribute('data-tarih'));
        }
      }) : null,
      YU.ui.dugme({
        metin: 'Yazdır', ikon: '#ic-download', tur: 'birincil', kucuk: true,
        baslik: 'Bu sayfayı yazdır',
        onClick: function () { window.print(); }
      })
    );
    kap.appendChild(eylemSeridi);

    if (siloPanel) kap.appendChild(siloPanel);
    if (malzemePanel) kap.appendChild(malzemePanel);
  }

  YU.sayfaTanimla({
    kod: 'anasayfa',
    baslik: 'Ana Sayfa',
    /* İçerik üst kenara yaklaşır (kullanıcı isteği, 26.08.2026):
       .yu-icerik üst dolgusu bu sayfada 20 -> 8px. Ortak dolgu değişmedi,
       yalnız bu sayfa yu-ust-dar varyantını alır (tema.css · KURAL 10.5). */
    ustDar: true,
    /* Kâğıda basılan rapor adı — ekran adı "Ana Sayfa" raporda anlamsız
       kalıyordu (kullanıcı isteği, 26.08.2026). */
    baskiBasligi: 'Yan Ürünler Stok Durum Raporu',
    altBaslik: function () {
      var depo = YU.db;
      if (!depo) return '';
      var donem = YU.donem.aktif();
      var gunler = donem ? YU.stok.kayitliGunler(depo, donem.bas, donem.bit) : YU.stok.kayitliGunler(depo);
      var parcalar = [donem ? ('Kampanya ' + donem.ad) : 'Kampanya dönemi tanımlı değil'];
      if (gunler.length) parcalar.push('son kayıt ' + YU.fmt.tarih(gunler[0].tarih));
      /* "35 gün veri girilmiş" sayacı kaldırıldı (kullanıcı isteği,
         26.08.2026 · KURAL 11): kararı değiştiren bir bilgi değildi. */
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

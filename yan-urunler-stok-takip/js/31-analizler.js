/* js/31-analizler.js — Analizler ekranı (Yönetim Paneli, yalnızca Yönetici).

   Seçilen geçmiş kampanya ile bu kampanya, TAKVİM TARİHİNE GÖRE DEĞİL
   KAMPANYA GÜNÜNE GÖRE karşılaştırılır (kullanıcı isteği, 23.08.2026):
     * Devir günü kampanyanın 1. günüdür (Şartname §2: devir stok kampanya
       başında girilir; YU.donem.liste() -> bas).
     * Bugün bu kampanyanın kaçıncı günüyse (N), geçmiş kampanyanın da
       N. günü karşısına konur. 22.07'de başlayan kampanyada 20.08 = 30. gün;
       10.06'da başlayan kampanyada 30. gün = 09.07.
     * Bugün son kayıtlı günden ilerideyse N son kayıtlı güne çekilir;
       karşılaştırma iki tarafta da veri olan ilk K gün üzerinden yapılır.
   Grafikte mavi = bu kampanya, kırmızı = geçmiş kampanya.

   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu).
   SÖZLEŞME §6 (UI imzaları), §9 (sınıf adları).
   Dosya yüklenirken hiçbir şey çizmez; yalnızca YU.sayfaTanimla çağırır. */
(function () {
  'use strict';

  var YU = window.YU;

  var SAYFA = 'analizler';
  var RENK_BU = 'var(--vurgu)';        /* mavi — bu kampanya */
  var RENK_GECMIS = 'var(--olumsuz)';  /* kırmızı — geçmiş kampanya */
  var GRAFIK_YUKSEKLIK = 240;

  /* ------------------------------------------------------------------
     Küçük yardımcılar
     ------------------------------------------------------------------ */

  function miktar(v, birim) {
    if (v === null || v === undefined || !isFinite(Number(v))) return '—';
    return birim === 'adet' ? YU.fmt.sayi(v) + ' adet' : YU.fmt.kgU(v);
  }

  /* KPI değeri: sayı büyük, birim küçük (YU.ui.olcu). */
  function olcu(v, birim) {
    if (v === null || v === undefined || !isFinite(Number(v))) return '—';
    return YU.ui.olcu([{ sayi: birim === 'adet' ? YU.fmt.sayi(v) : YU.fmt.kg(v), birim: birim }], 'sol');
  }

  function eksenMetni(birim) {
    return birim === 'adet'
      ? function (v) { return YU.fmt.sayi(v); }
      : function (v) { return YU.fmt.ton(v); };
  }

  function gunMetni(n) { return YU.fmt.sayi(n) + '. gün'; }

  function isaretli(v) {
    return (v > 0 ? '+' : (v < 0 ? '-' : '')) + YU.fmt.kg(Math.abs(v));
  }

  function yuzdeFark(bu, gecmis) {
    if (gecmis === null || bu === null || !(Math.abs(gecmis) > 0)) return null;
    return ((bu - gecmis) / Math.abs(gecmis)) * 100;
  }

  function yuzdeMetni(p) {
    if (p === null || !isFinite(p)) return '—';
    return (p > 0 ? '+' : (p < 0 ? '-' : '')) + YU.fmt.yuzde(Math.abs(p));
  }

  function farkTuru(d) {
    if (d === null || !isFinite(d) || d === 0) return 'notr';
    return d > 0 ? 'olumlu' : 'olumsuz';
  }

  /* ------------------------------------------------------------------
     Göstergeler — neyin karşılaştırılacağı
     Kuru küspe kalemleri KuruKuspeGunluk'tan (kk), diğer malzemeler
     GunlukHareket'ten (gh) okunur. Dökme malzemenin GunlukHareket satırı
     çuvallama düşülmüş NET üretimdir; burada brüt üretim (UretilenDokme)
     karşılaştırılır, çuvallama ayrı gösterge olarak verilir.
     ------------------------------------------------------------------ */

  function gostergeler(depo) {
    var liste = [
      { kod: 'dokme-uretim', ad: 'Dökme Küspe Üretimi (Brüt)', birim: 'kg', kaynak: 'kk', alan: 'UretilenDokme' },
      { kod: 'dokme-satis', ad: 'Dökme Küspe Satışı', birim: 'kg', kaynak: 'kk', alan: 'SatilanDokme' },
      { kod: 'cuvallama', ad: 'Çuvallama', birim: 'adet', kaynak: 'kk', alan: 'CuvalAdet' }
    ];

    var veriliMalzeme = {}, i;
    for (i = 0; i < depo.gunlukHareket.length; i++) veriliMalzeme[depo.gunlukHareket[i].MalzemeId] = true;

    var malzemeler = depo.malzemeler.slice().sort(function (a, b) {
      return (Number(a.Sira) || 0) - (Number(b.Sira) || 0) || (Number(a.Id) || 0) - (Number(b.Id) || 0);
    });
    for (i = 0; i < malzemeler.length; i++) {
      var m = malzemeler[i];
      if (m.OzelTip === 'DokmeKuruKuspe') continue;                 /* yukarıda: brüt üretim + satış */
      if (m.Aktif === false && !veriliMalzeme[m.Id]) continue;     /* pasif ve hiç verisi yok */
      if (m.OzelTip !== 'CuvalKuruKuspe') {                         /* çuvallının üretimi = çuvallama */
        liste.push({ kod: 'm' + m.Id + '-uretim', ad: m.Ad + ' · Üretim', birim: 'kg', kaynak: 'gh', alan: 'Uretim', malzemeId: m.Id });
      }
      liste.push({ kod: 'm' + m.Id + '-satis', ad: m.Ad + ' · Satış', birim: 'kg', kaynak: 'gh', alan: 'Satis', malzemeId: m.Id });
    }
    return liste;
  }

  function gostergeBul(liste, kod) {
    for (var i = 0; i < liste.length; i++) if (liste[i].kod === kod) return liste[i];
    return liste[0] || null;
  }

  /* ------------------------------------------------------------------
     Kampanya verisi — gün sırasına göre okuma
     ------------------------------------------------------------------ */

  /* Dönem: YU.donem.liste() ögesi {ad, bas, bit, kayitliGun}. */
  function kampanyaVerisi(depo, donem) {
    var kayitli = {}, kk = {}, gh = {}, i, h;
    var gunler = YU.stok.kayitliGunler(depo, donem.bas, donem.bit);
    for (i = 0; i < gunler.length; i++) kayitli[gunler[i].tarih] = true;
    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      h = depo.kuruKuspeGunluk[i];
      if (h.Tarih >= donem.bas && h.Tarih <= donem.bit) kk[h.Tarih] = h;
    }
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.Tarih >= donem.bas && h.Tarih <= donem.bit) gh[h.Tarih + '|' + h.MalzemeId] = h;
    }
    var sonGun = YU.tarih.fark(donem.bas, donem.bit) + 1;    /* son kayıtlı günün sırası */
    if (!isFinite(sonGun) || sonGun < 1) sonGun = 1;
    return { donem: donem, kayitli: kayitli, kk: kk, gh: gh, sonGun: sonGun, kayitliGun: gunler.length };
  }

  /* Gün kayıtlıysa değer (satır yoksa 0), gün hiç girilmemişse null. */
  function gunDegeri(veri, gosterge, tarih) {
    if (!veri.kayitli[tarih]) return null;
    var satir = gosterge.kaynak === 'kk' ? veri.kk[tarih] : veri.gh[tarih + '|' + gosterge.malzemeId];
    return satir ? (Number(satir[gosterge.alan]) || 0) : 0;
  }

  /* n günlük dizi: gunluk[i] = (i+1). günün değeri; birikimli[i] = o güne
     kadarki toplam. Son kayıtlı günden sonrası null (çizgi orada biter). */
  function seri(veri, gosterge, n) {
    var gunluk = [], birikimli = [], toplam = 0, i;
    for (i = 0; i < n; i++) {
      var icerde = i < veri.sonGun;
      var v = icerde ? gunDegeri(veri, gosterge, YU.tarih.ekle(veri.donem.bas, i)) : null;
      gunluk.push(v);
      if (v !== null) toplam = YU.yuvarla(toplam + v);
      birikimli.push(icerde ? toplam : null);
    }
    return { gunluk: gunluk, birikimli: birikimli, toplam: toplam };
  }

  /* Bugün bu kampanyanın kaçıncı günü: 1. gün = devir günü. Bugün son
     kayıtlı günün ilerisindeyse son kayıtlı güne çekilir; kampanya henüz
     başlamamışsa da son kayıtlı gün kullanılır. */
  function bugunkuGun(veri) {
    var ham = YU.tarih.fark(veri.donem.bas, YU.tarih.bugun()) + 1;
    if (!isFinite(ham) || ham < 1) ham = veri.sonGun;
    return { ham: ham, gun: Math.max(1, Math.min(ham, veri.sonGun)) };
  }

  /* ------------------------------------------------------------------
     Ekran parçaları
     ------------------------------------------------------------------ */

  function ayarPaneli(d) {
    var buSecenek = [], karsiSecenek = [], gostergeSecenek = [], i;
    for (i = d.donemler.length - 1; i >= 0; i--) {
      buSecenek.push({ deger: d.donemler[i].ad, metin: 'Kampanya ' + d.donemler[i].ad });
      if (d.donemler[i].ad !== d.bu.donem.ad) {
        karsiSecenek.push({ deger: d.donemler[i].ad, metin: 'Kampanya ' + d.donemler[i].ad });
      }
    }
    if (!karsiSecenek.length) karsiSecenek.push({ deger: '', metin: 'Karşılaştırılacak kampanya yok' });
    for (i = 0; i < d.gostergeler.length; i++) gostergeSecenek.push({ deger: d.gostergeler[i].kod, metin: d.gostergeler[i].ad });

    var buAlani, karsiAlani, gostergeAlani, modAlani;

    function git() {
      YU.git(SAYFA, {
        bu: buAlani.deger(),
        karsi: karsiAlani.deger(),
        gosterge: gostergeAlani.deger(),
        mod: modAlani.deger()
      });
    }

    buAlani = YU.ui.alan({ etiket: 'Bu Kampanya', tip: 'secim', secenekler: buSecenek, deger: d.bu.donem.ad, onChange: git });
    karsiAlani = YU.ui.alan({
      etiket: 'Geçmiş Kampanya', tip: 'secim', secenekler: karsiSecenek,
      deger: d.gecmis ? d.gecmis.donem.ad : '', pasif: !d.gecmis, onChange: git
    });
    gostergeAlani = YU.ui.alan({ etiket: 'Gösterge', tip: 'secim', secenekler: gostergeSecenek, deger: d.gosterge.kod, onChange: git });
    modAlani = YU.ui.alan({
      etiket: 'Görünüm', tip: 'secim',
      secenekler: [{ deger: 'gunluk', metin: 'Günlük' }, { deger: 'birikimli', metin: 'Birikimli (O Güne Kadar Toplam)' }],
      deger: d.mod, onChange: git
    });

    return YU.ui.panel({
      govde: YU.h('div', { sinif: 'yu-izgara yu-iz-4' }, buAlani.kok, karsiAlani.kok, gostergeAlani.kok, modAlani.kok)
    });
  }

  function kpiIzgarasi(d) {
    var g = d.gosterge, K = d.karsilastirmaGunu;
    var buSeri = seri(d.bu, g, K);
    var gecmisSeri = d.gecmis ? seri(d.gecmis, g, K) : null;
    var buSon = buSeri.gunluk[K - 1];
    var gecmisSon = gecmisSeri ? gecmisSeri.gunluk[K - 1] : null;

    var gunKarti = YU.ui.kpi({
      etiket: 'Kampanya Günü', ikon: '#ic-calendar',
      deger: gunMetni(d.bugun.gun),
      alt: '1. gün ' + YU.fmt.tarih(d.bu.donem.bas) +
        (d.bugun.ham > d.bugun.gun
          ? ' · bugün ' + gunMetni(d.bugun.ham) + ', son kayıt ' + YU.fmt.tarih(d.bu.donem.bit)
          : ' · bugün ' + YU.fmt.tarih(YU.tarih.bugun()))
    });

    var buKarti = YU.ui.kpi({
      etiket: 'Bu Kampanya ' + d.bu.donem.ad, ikon: '#ic-up', renk: 'vurgu',
      deger: olcu(buSeri.toplam, g.birim),
      alt: '1–' + gunMetni(K) + ' toplamı · ' + gunMetni(K) + ': ' + miktar(buSon, g.birim)
    });

    var gecmisKarti = YU.ui.kpi({
      etiket: d.gecmis ? 'Geçmiş Kampanya ' + d.gecmis.donem.ad : 'Geçmiş Kampanya', ikon: '#ic-calendar-dots', renk: 'olumsuz',
      deger: gecmisSeri ? olcu(gecmisSeri.toplam, g.birim) : '—',
      alt: gecmisSeri
        ? '1–' + gunMetni(K) + ' toplamı · ' + gunMetni(K) + ': ' + miktar(gecmisSon, g.birim)
        : 'Karşılaştırılacak ikinci kampanya yok'
    });

    var fark = gecmisSeri ? YU.yuvarla(buSeri.toplam - gecmisSeri.toplam) : null;
    var yuzde = gecmisSeri ? yuzdeFark(buSeri.toplam, gecmisSeri.toplam) : null;
    var farkKarti = YU.ui.kpi({
      etiket: 'Fark (İlk ' + YU.fmt.sayi(K) + ' Gün)', ikon: '#ic-percent', renk: farkTuru(fark),
      deger: fark === null ? '—' : (yuzde === null ? isaretli(fark) : yuzdeMetni(yuzde)),
      alt: fark === null
        ? 'Fark için iki kampanya gerekir'
        : (fark === 0
          ? 'İki kampanya başa baş'
          : isaretli(fark) + ' ' + g.birim + ' · bu kampanya ' + (fark > 0 ? 'önde' : 'geride'))
    });

    return YU.h('div', { sinif: 'yu-izgara yu-iz-4' }, gunKarti, buKarti, gecmisKarti, farkKarti);
  }

  function grafikPaneli(d) {
    var g = d.gosterge, N = d.bugun.gun, birikimli = d.mod === 'birikimli';
    var buSeri = seri(d.bu, g, N);
    var gecmisSeri = d.gecmis ? seri(d.gecmis, g, N) : null;
    var buDizi = birikimli ? buSeri.birikimli : buSeri.gunluk;
    var gecmisDizi = gecmisSeri ? (birikimli ? gecmisSeri.birikimli : gecmisSeri.gunluk) : null;

    var noktalar = [], i;
    for (i = 0; i < N; i++) {
      noktalar.push({
        etiket: String(i + 1),
        baslik: gunMetni(i + 1),
        deger1: buDizi[i],
        deger2: gecmisDizi ? gecmisDizi[i] : null,
        alt1: YU.fmt.tarih(YU.tarih.ekle(d.bu.donem.bas, i)),
        alt2: d.gecmis ? YU.fmt.tarih(YU.tarih.ekle(d.gecmis.donem.bas, i)) : null
      });
    }

    var grafik = YU.ui.karsilastirmaGrafik({
      noktalar: noktalar,
      seri1: { ad: 'Kampanya ' + d.bu.donem.ad, renk: RENK_BU },
      seri2: d.gecmis ? { ad: 'Kampanya ' + d.gecmis.donem.ad, renk: RENK_GECMIS } : null,
      yukseklik: GRAFIK_YUKSEKLIK,
      bicim: function (v) { return miktar(v, g.birim); },
      eksenBicim: eksenMetni(g.birim)
    });

    var K = d.karsilastirmaGunu;
    var cumleler = ['Yatay eksen kampanya günüdür; devir günü 1. gün sayılır.'];
    if (d.gecmis) {
      cumleler.push('Aynı gün sırası karşılaştırılır: bu kampanyanın ' + gunMetni(K) + ' (' +
        YU.fmt.tarih(YU.tarih.ekle(d.bu.donem.bas, K - 1)) + ') karşısında geçmiş kampanyanın ' + gunMetni(K) + ' (' +
        YU.fmt.tarih(YU.tarih.ekle(d.gecmis.donem.bas, K - 1)) + ') durur.');
      if (K < N) {
        cumleler.push('Geçmiş kampanyanın kaydı ' + gunMetni(d.gecmis.sonGun) + ' bitiyor; kırmızı çizgi orada kesilir.');
      }
    } else {
      cumleler.push('Karşılaştırma için ikinci bir kampanya gerekir.');
    }
    var aciklama = YU.h('div', { sinif: 'yu-yardim', metin: cumleler.join(' ') });

    return YU.ui.panel({
      baslik: (birikimli ? 'Birikimli Karşılaştırma · ' : 'Günlük Karşılaştırma · ') + g.ad,
      ikon: '#ic-chart',
      sag: '1–' + gunMetni(N),
      govde: [grafik, aciklama]
    });
  }

  function tabloPaneli(d) {
    var K = d.karsilastirmaGunu, satirlar = [], i;
    for (i = 0; i < d.gostergeler.length; i++) {
      (function (g) {
        var bu = seri(d.bu, g, K).toplam;
        var gecmis = d.gecmis ? seri(d.gecmis, g, K).toplam : null;
        var fark = gecmis === null ? null : YU.yuvarla(bu - gecmis);
        var yuzde = gecmis === null ? null : yuzdeFark(bu, gecmis);
        var aktif = g.kod === d.gosterge.kod;

        satirlar.push({
          vurgu: aktif ? 'vurgu' : null,
          ipucu: aktif ? 'Grafikte gösteriliyor' : 'Grafikte göstermek için tıklayın',
          onClick: function () {
            YU.git(SAYFA, { bu: d.bu.donem.ad, karsi: d.gecmis ? d.gecmis.donem.ad : '', gosterge: g.kod, mod: d.mod });
          },
          hucreler: [
            YU.h('span', { sinif: aktif ? 'yu-guclu' : '', metin: g.ad }),
            miktar(bu, g.birim),
            gecmis === null ? '—' : miktar(gecmis, g.birim),
            fark === null ? '—' : YU.h('span', {
              metin: isaretli(fark) + ' ' + g.birim,
              stil: { color: fark > 0 ? 'var(--olumlu)' : (fark < 0 ? 'var(--olumsuz)' : 'var(--metin-4)') }
            }),
            yuzde === null ? '—' : YU.ui.rozet(yuzdeMetni(yuzde), farkTuru(fark))
          ]
        });
      })(d.gostergeler[i]);
    }

    var tablo = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Gösterge' },
        { baslik: 'Kampanya ' + d.bu.donem.ad, hiza: 'sag', mono: true, genislik: 190 },
        { baslik: d.gecmis ? 'Kampanya ' + d.gecmis.donem.ad : 'Geçmiş Kampanya', hiza: 'sag', mono: true, genislik: 190 },
        { baslik: 'Fark', hiza: 'sag', mono: true, genislik: 170 },
        { baslik: 'Fark %', hiza: 'sag', genislik: 110 }
      ],
      satirlar: satirlar,
      bos: 'Karşılaştırılacak gösterge yok.'
    });

    var notlar = ['Her iki kampanyanın 1–' + gunMetni(K) + ' toplamları.'];
    if (d.gecmis && K < d.bugun.gun) {
      notlar.push('Geçmiş kampanyada ' + YU.fmt.sayi(d.gecmis.sonGun) + ' gün kayıt olduğu için karşılaştırma ilk ' +
        YU.fmt.sayi(K) + ' gün üzerinden yapıldı; bu kampanya ' + gunMetni(d.bugun.gun) + ' içinde.');
    }
    notlar.push('Satıra tıklayınca o gösterge grafikte açılır.');

    return YU.ui.panel({
      baslik: 'İlk ' + YU.fmt.sayi(K) + ' Günün Toplamları',
      ikon: '#ic-doc',
      sag: d.gostergeler.length + ' gösterge',
      dolgusuz: true,
      govde: [tablo, YU.h('div', { sinif: 'yu-yardim', metin: notlar.join(' '), stil: { padding: '10px 18px 12px' } })]
    });
  }

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  function donemBul(liste, ad) {
    for (var i = 0; i < liste.length; i++) if (liste[i].ad === ad) return liste[i];
    return null;
  }

  /* URL parametrelerinden ekran durumu; eksik ya da hatalı parametre
     varsayılana düşer. Varsayılan geçmiş kampanya: bu kampanyadan bir önceki. */
  function durum(depo, param) {
    var donemler = YU.donem.liste();
    if (!donemler.length) return null;
    param = param || {};

    var buDonem = donemBul(donemler, param.bu) || YU.donem.aktif() || donemler[donemler.length - 1];
    var gecmisDonem = null;
    if (param.karsi && param.karsi !== buDonem.ad) gecmisDonem = donemBul(donemler, param.karsi);
    if (!gecmisDonem) {
      /* Liste devir tarihine göre sıralı: bir önceki dönem, yoksa bir sonraki. */
      var sira = donemler.indexOf(buDonem);
      gecmisDonem = donemler[sira - 1] || donemler[sira + 1] || null;
    }

    var liste = gostergeler(depo);
    var bu = kampanyaVerisi(depo, buDonem);
    var gecmis = gecmisDonem ? kampanyaVerisi(depo, gecmisDonem) : null;
    var bugun = bugunkuGun(bu);

    return {
      donemler: donemler,
      bu: bu,
      gecmis: gecmis,
      bugun: bugun,
      /* İki tarafta da veri olan ilk K gün: geçmiş kampanya daha kısaysa orada biter. */
      karsilastirmaGunu: gecmis ? Math.max(1, Math.min(bugun.gun, gecmis.sonGun)) : bugun.gun,
      gostergeler: liste,
      gosterge: gostergeBul(liste, param.gosterge),
      mod: param.mod === 'birikimli' ? 'birikimli' : 'gunluk'
    };
  }

  function ciz(kap, param) {
    var depo = YU.db;
    if (!depo) return;
    var d = durum(depo, param);

    if (!d) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-chart',
        baslik: 'Kampanya Dönemi Yok',
        metin: 'Karşılaştırma devir tarihine göre kurulur. Devir stok girilince kampanya dönemi oluşur ve bu ekran dolar.',
        eylemler: [YU.ui.dugme({ metin: 'Devir Stok', ikon: '#ic-wallet', tur: 'birincil', onClick: function () { YU.git('devir-stok'); } })]
      }));
      return;
    }
    if (!d.gosterge) {
      kap.appendChild(YU.ui.bosDurum({ ikon: '#ic-chart', baslik: 'Gösterge Yok', metin: 'Karşılaştırılacak malzeme tanımı bulunamadı.' }));
      return;
    }

    kap.appendChild(ayarPaneli(d));

    if (!d.gecmis) {
      kap.appendChild(YU.ui.serit({
        tur: 'bilgi', baslik: 'Tek kampanya var',
        metin: 'Karşılaştırma için en az iki kampanya dönemi gerekir. Yeni kampanya açılınca (yeni devir tarihi) bu ekran iki dönemi gün gün karşılaştırır.'
      }));
    }

    kap.appendChild(kpiIzgarasi(d));
    kap.appendChild(grafikPaneli(d));
    kap.appendChild(tabloPaneli(d));
  }

  YU.sayfaTanimla({
    kod: SAYFA,
    baslik: 'Analizler',
    ikon: '#ic-bars-up',
    grup: 'Yönetim',
    rol: 'Yonetici',
    altBaslik: function (param) {
      var depo = YU.db;
      if (!depo) return '';
      var d = durum(depo, param);
      if (!d) return 'Kampanya dönemi tanımlı değil';
      var parcalar = ['Kampanya ' + d.bu.donem.ad + ' · ' + gunMetni(d.bugun.gun)];
      parcalar.push(d.gecmis ? 'Kampanya ' + d.gecmis.donem.ad + ' ile gün gün karşılaştırma' : 'karşılaştırılacak ikinci kampanya yok');
      return parcalar.join(' · ');
    },
    ciz: ciz
  });
})();

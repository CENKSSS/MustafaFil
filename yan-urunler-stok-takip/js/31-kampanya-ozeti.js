/* js/31-kampanya-ozeti.js — Kampanya Özeti
   Kullanıcı isteği (23.08.2026): Stok Durumu tarih bazlı bir "şu an" resmi
   veriyor; kampanya seçip o kampanyanın TOPLAMLARINI (şu ana kadar üretilen,
   çuvallanan, satılan; malzeme ve silo bazında devir / toplam / kalan) gören
   bir yer yoktu. Bu sayfa onu verir; RAPORLAR grubunda ve Raporlar
   penceresinde ayrı kart olarak durur.

   Kampanya listesi YU.donem'den gelir (devir tarihlerinden türeyen dönemler:
   ad, bas, bit, kayitliGun). Toplamlar kampanya aralığındaki ([bas, bit])
   kayıtlardan doğrudan toplanır; devir ve kampanya sonu mevcut, Şartname §5
   formülüyle YU.stok'tan okunur (dökme kuru küspe = siloların toplamı).
   Yeni iş kuralı yoktur. */
(function () {
  'use strict';

  var YU = window.YU;
  var KOD = 'kampanya-ozeti';

  /* ---------- yardımcılar ---------- */

  function kampanyaBul(ad) {
    var liste = YU.donem.liste(), i;
    for (i = 0; i < liste.length; i++) if (liste[i].ad === ad) return liste[i];
    return null;
  }

  function aralikta(tarih, k) {
    return tarih >= k.bas && tarih <= k.bit;
  }

  function suruyorMu(k) {
    var liste = YU.donem.liste();
    return liste.length && liste[liste.length - 1].ad === k.ad && YU.tarih.bugun() >= k.bas;
  }

  function mono(metin) {
    return YU.h('span', { sinif: 'yu-mono', metin: metin });
  }

  function kalin(metin) {
    return YU.h('span', { sinif: 'yu-mono', metin: metin, stil: { fontWeight: '600' } });
  }

  /* ---------- toplamlar (saf toplama; kural yok) ---------- */

  function kuruKuspeToplami(db, k) {
    var t = { ham: 0, cuvalAdet: 0, cuvalKg: 0, net: 0, cekis: 0, satilan: 0, gun: 0 }, i, r, h;
    for (i = 0; i < db.kuruKuspeGunluk.length; i++) {
      r = db.kuruKuspeGunluk[i];
      if (!aralikta(r.Tarih, k)) continue;
      h = YU.hesap.kuruKuspe(Number(r.UretilenDokme) || 0, Number(r.CuvalAdet) || 0, Number(r.SatilanDokme) || 0);
      t.ham += Number(r.UretilenDokme) || 0;
      t.cuvalAdet += Number(r.CuvalAdet) || 0;
      t.cuvalKg += h.cuvalKg;
      t.net += h.netDokmeUretim;
      t.cekis += h.silodanCekilecek;
      t.satilan += h.satilanDokme;
      t.gun++;
    }
    for (var a in t) if (Object.prototype.hasOwnProperty.call(t, a)) t[a] = YU.yuvarla(t[a]);
    return t;
  }

  function malzemeToplamlari(db, k) {
    var sonu = YU.stok.tumMalzemeler(db, k.bit);     /* devir + kampanya sonu mevcut (§5) */
    var uretim = {}, satis = {}, i, h, id;
    for (i = 0; i < db.gunlukHareket.length; i++) {
      h = db.gunlukHareket[i];
      if (!aralikta(h.Tarih, k)) continue;
      id = h.MalzemeId;
      uretim[id] = (uretim[id] || 0) + (Number(h.Uretim) || 0);
      satis[id] = (satis[id] || 0) + (Number(h.Satis) || 0);
    }
    var liste = [];
    for (i = 0; i < sonu.length; i++) {
      id = sonu[i].malzeme.Id;
      var u = YU.yuvarla(uretim[id] || 0), s = YU.yuvarla(satis[id] || 0);
      /* Pasif ve bu kampanyada hiç hareket görmemiş, stoğu da sıfır olan
         malzeme tabloyu şişirmesin. */
      if (sonu[i].malzeme.Aktif === false && !u && !s && !sonu[i].mevcut) continue;
      liste.push({ malzeme: sonu[i].malzeme, devir: sonu[i].devir, devirTarihi: sonu[i].devirTarihi, uretim: u, satis: s, mevcut: sonu[i].mevcut });
    }
    return liste;
  }

  function siloToplamlari(db, k) {
    var sonu = YU.stok.tumSilolar(db, k.bit);
    var giren = {}, cikan = {}, i, h, id;
    for (i = 0; i < db.siloHareket.length; i++) {
      h = db.siloHareket[i];
      if (!aralikta(h.Tarih, k)) continue;
      id = h.SiloId;
      giren[id] = (giren[id] || 0) + (Number(h.GirenKg) || 0);
      cikan[id] = (cikan[id] || 0) + (Number(h.CikanKg) || 0);
    }
    var liste = [];
    for (i = 0; i < sonu.length; i++) {
      id = sonu[i].silo.Id;
      liste.push({ silo: sonu[i].silo, devir: sonu[i].devir, giren: YU.yuvarla(giren[id] || 0), cikan: YU.yuvarla(cikan[id] || 0), mevcut: sonu[i].mevcut, kapasite: sonu[i].kapasite });
    }
    return liste;
  }

  /* ---------- parçalar ---------- */

  function kampanyaSeridi(k) {
    var liste = YU.donem.liste(), secenekler = [], i;
    for (i = liste.length - 1; i >= 0; i--) {
      secenekler.push({ deger: liste[i].ad, metin: 'Kampanya ' + liste[i].ad + ' · ' + YU.fmt.tarih(liste[i].bas) + ' – ' + YU.fmt.tarih(liste[i].bit) });
    }
    var secim = YU.ui.alan({
      tip: 'secim', secenekler: secenekler, deger: k.ad, genislik: '360px',
      onChange: function () { YU.git(KOD, { kampanya: secim.girdi.value }); }
    });
    var suruyor = suruyorMu(k);
    return YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
        padding: '8px 14px', background: 'var(--yuzey)',
        border: '1px solid var(--kenar)', borderRadius: 'var(--r)'
      }
    },
      YU.h('span', { metin: 'Kampanya', stil: { font: '600 13.5px/1 var(--font)', color: 'var(--metin-2)' } }),
      secim.kok,
      YU.h('span', {
        sinif: 'yu-yardim',
        metin: YU.fmt.sayi(k.kayitliGun) + ' kayıtlı gün' + (suruyor ? ' · son kayıt ' + YU.fmt.tarih(k.bit) : '')
      }),
      YU.h('span', { stil: { flex: '1' } }),
      YU.ui.rozet(suruyor ? 'Sürüyor' : 'Kapandı', suruyor ? 'olumlu' : 'notr')
    );
  }

  function kpiSatiri(db, k, t) {
    var suruyor = suruyorMu(k);
    var iz = YU.h('div', { sinif: 'yu-izgara yu-iz-4' });
    iz.appendChild(YU.ui.kpi({
      etiket: 'Üretilen Dökme Kuru Küspe', ikon: '#ic-silos',
      deger: YU.fmt.kgU(t.ham),
      alt: 'ham rakam · ' + YU.fmt.sayi(t.gun) + ' günün toplamı'
    }));
    iz.appendChild(YU.ui.kpi({
      etiket: 'Çuvallanan', ikon: '#ic-sack',
      deger: YU.fmt.sayi(t.cuvalAdet) + ' çuval',
      alt: YU.fmt.kgU(t.cuvalKg) + ' çuvallı kuru küspe üretimi'
    }));
    iz.appendChild(YU.ui.kpi({
      etiket: 'Satılan Dökme Kuru Küspe', ikon: '#ic-swap',
      deger: YU.fmt.kgU(t.satilan),
      alt: 'silolardan doğrudan satış'
    }));
    iz.appendChild(YU.ui.kpi({
      etiket: suruyor ? 'Silolarda Şu An' : 'Kampanya Sonu Silolarda', ikon: '#ic-building',
      deger: YU.fmt.kgU(YU.stok.dokmeToplam(db, k.bit)),
      alt: 'dökme kuru küspe · ' + YU.fmt.tarih(k.bit) + ' itibarıyla'
    }));
    return iz;
  }

  function toplamSatiri(tablo, hucreler) {
    var tabloEl = tablo.querySelector('table');
    if (!tabloEl) return;
    var tr = YU.h('tr', null);
    for (var i = 0; i < hucreler.length; i++) {
      var h = hucreler[i];
      tr.appendChild(YU.h('td', { colspan: h.colspan || null, sinif: h.sag ? 'yu-sag' : null, metin: h.metin }));
    }
    tabloEl.appendChild(YU.h('tfoot', null, tr));
  }

  function malzemePaneli(db, k) {
    var liste = malzemeToplamlari(db, k), satirlar = [], i, r;
    var tU = 0, tS = 0, tM = 0;
    var suruyor = suruyorMu(k);
    for (i = 0; i < liste.length; i++) {
      r = liste[i];
      tU += r.uretim; tS += r.satis; tM += r.mevcut;
      satirlar.push([
        YU.h('span', { metin: r.malzeme.Ad + (r.malzeme.Aktif === false ? ' (pasif)' : ''), stil: { fontWeight: '500' } }),
        mono(r.devirTarihi && r.devirTarihi >= k.bas ? YU.fmt.kg(r.devir) : '—'),
        mono(YU.fmt.kg(r.uretim)),
        mono(YU.fmt.kg(r.satis)),
        kalin(YU.fmt.kg(r.mevcut))
      ]);
    }
    var tablo = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Malzeme' },
        { baslik: 'Kampanya Başı Devir', genislik: 170, hiza: 'sag', mono: true },
        { baslik: 'Toplam Üretim', genislik: 162, hiza: 'sag', mono: true },
        { baslik: 'Toplam Satış', genislik: 162, hiza: 'sag', mono: true },
        { baslik: suruyor ? 'Şu Anki Stok' : 'Kampanya Sonu Stok', genislik: 170, hiza: 'sag', mono: true }
      ],
      satirlar: satirlar,
      bos: 'Bu kampanyada malzeme hareketi yok.',
      yapiskan: true
    });
    if (satirlar.length) {
      toplamSatiri(tablo, [
        { metin: 'Toplam', colspan: 2 },
        { metin: YU.fmt.kg(YU.yuvarla(tU)), sag: true },
        { metin: YU.fmt.kg(YU.yuvarla(tS)), sag: true },
        { metin: YU.fmt.kg(YU.yuvarla(tM)), sag: true }
      ]);
    }
    return YU.ui.panel({
      baslik: 'Malzeme Bazında Kampanya Toplamı',
      ikon: '#ic-chart',
      dolgusuz: true,
      sag: YU.h('span', { metin: 'kg · ' + YU.fmt.tarih(k.bas) + ' – ' + YU.fmt.tarih(k.bit) }),
      govde: tablo
    });
  }

  function siloPaneli(db, k) {
    var liste = siloToplamlari(db, k), satirlar = [], i, r;
    var tG = 0, tC = 0, tM = 0;
    var suruyor = suruyorMu(k);
    for (i = 0; i < liste.length; i++) {
      r = liste[i];
      tG += r.giren; tC += r.cikan; tM += r.mevcut;
      satirlar.push([
        YU.h('span', { metin: r.silo.Ad, stil: { fontWeight: '500' } }),
        mono(YU.fmt.kg(r.devir)),
        mono(YU.fmt.kg(r.giren)),
        mono(YU.fmt.kg(r.cikan)),
        kalin(YU.fmt.kg(r.mevcut)),
        YU.h('span', { sinif: 'yu-zayif', metin: r.kapasite > 0 ? YU.fmt.yuzde((r.mevcut / r.kapasite) * 100) : '—' })
      ]);
    }
    var tablo = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Silo' },
        { baslik: 'Kampanya Başı Devir', genislik: 170, hiza: 'sag', mono: true },
        { baslik: 'Toplam Giren', genislik: 150, hiza: 'sag', mono: true },
        { baslik: 'Toplam Çıkan', genislik: 150, hiza: 'sag', mono: true },
        { baslik: suruyor ? 'Şu Anki Mevcut' : 'Kampanya Sonu', genislik: 160, hiza: 'sag', mono: true },
        { baslik: 'Doluluk', genislik: 90, hiza: 'sag' }
      ],
      satirlar: satirlar,
      bos: 'Tanımlı silo yok.',
      yapiskan: true
    });
    if (satirlar.length) {
      toplamSatiri(tablo, [
        { metin: 'Toplam', colspan: 2 },
        { metin: YU.fmt.kg(YU.yuvarla(tG)), sag: true },
        { metin: YU.fmt.kg(YU.yuvarla(tC)), sag: true },
        { metin: YU.fmt.kg(YU.yuvarla(tM)), sag: true },
        { metin: '' }
      ]);
    }
    return YU.ui.panel({
      baslik: 'Silo Bazında Kampanya Toplamı',
      ikon: '#ic-building',
      dolgusuz: true,
      sag: YU.h('span', { metin: 'kg · dökme kuru küspe' }),
      govde: tablo
    });
  }

  /* ---------- sayfa ---------- */

  function ciz(kap, param) {
    var db = YU.db;
    var liste = YU.donem.liste();

    if (!liste.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-calendar',
        baslik: 'Tanımlı Kampanya Yok',
        metin: 'Kampanyalar devir tarihlerinden oluşur. Önce Devir Stok ekranından kampanya başı devrini girin.',
        eylemler: [YU.ui.dugme({ metin: 'Devir Stok', ikon: '#ic-wallet', tur: 'birincil', onClick: function () { YU.git('devir-stok'); } })]
      }));
      return;
    }

    var k = (param && param.kampanya && kampanyaBul(param.kampanya)) || YU.donem.aktif() || liste[liste.length - 1];
    var t = kuruKuspeToplami(db, k);

    YU.ui.sayfaEylemleri(
      YU.ui.dugme({
        metin: 'Stok Durumu', ikon: '#ic-chart', tur: 'ikincil',
        onClick: function () { YU.git('stok-durumu', { tarih: k.bit }); }
      }),
      YU.ui.dugme({
        metin: 'Silo Durumu', ikon: '#ic-building', tur: 'ikincil',
        onClick: function () { YU.git('silo-durumu'); }
      })
    );

    var govde = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    govde.appendChild(kampanyaSeridi(k));
    govde.appendChild(kpiSatiri(db, k, t));
    govde.appendChild(malzemePaneli(db, k));
    govde.appendChild(siloPaneli(db, k));
    kap.appendChild(govde);
  }

  YU.sayfaTanimla({
    kod: KOD,
    baslik: 'Kampanya Özeti',
    altBaslik: function (param) {
      var k = (param && param.kampanya && kampanyaBul(param.kampanya)) || YU.donem.aktif();
      if (!k) return 'Kampanya bazında toplam üretim, satış ve kalan stok';
      return 'Kampanya ' + k.ad + ' · ' + YU.fmt.tarih(k.bas) + ' – ' + YU.fmt.tarih(k.bit) +
        (suruyorMu(k) ? ' · sürüyor' : ' · kapandı');
    },
    ikon: '#ic-calendar-dots',
    grup: 'Takip',
    rol: 'Hepsi',
    ciz: ciz
  });
})();

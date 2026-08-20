/* js/23-stok-durumu.js — Stok Durumu ekranı (Şartname §7 · SOZLESME §7).

   Şartname §5 DEMİRBAŞ: ekran bugün itibarıyla çalışır ama seçilen bir tarihe
   kadarki stok da hesaplanabilir (Tarih <= seçilen). Dökme kuru küspenin
   mevcudu basit formülle değil, siloların toplamıyla gelir; bu yüzden o satır
   "Silo Toplamı" rozetiyle işaretlenir ve silo kırılımı açılabilir. */
(function () {
  'use strict';

  var YU = window.YU;
  var KOD = 'stok-durumu';
  var EN_COK_DILIM = 6;

  /* ==================================================================
     1. Küçük yardımcılar
     ================================================================== */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  /* tema.css yatay/dikey dizilim için sınıf tanımlamıyor; burada yalnızca
     yerleşim kuruluyor, renk ve ölçü kararı değişkenlerden geliyor. */
  function satirKap(hizala, bosluk) {
    return YU.h('div', {
      stil: {
        display: 'flex', flexWrap: 'wrap', minWidth: '0',
        alignItems: hizala || 'center', gap: (bosluk || 12) + 'px'
      }
    });
  }

  function sutunKap(bosluk) {
    return YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', minWidth: '0', gap: (bosluk || 6) + 'px' }
    });
  }

  function mono(metin, soluk) {
    return YU.h('span', { sinif: 'yu-mono' + (soluk ? ' yu-zayif' : ''), metin: metin });
  }

  function ozelMalzeme(tip) {
    var m = YU.db.malzemeler, i;
    for (i = 0; i < m.length; i++) if (m[i].OzelTip === tip) return m[i];
    return null;
  }

  function sonKayitliGun() {
    var l = YU.stok.kayitliGunler(YU.db);
    return l.length ? l[0].tarih : null;      /* liste yeniden eskiye sıralı */
  }

  function kampanyaSonu() {
    var don = YU.donem.aktif();
    return don ? don.bit : null;
  }

  function veriVarMi() {
    var db = YU.db;
    return !!(db.devirStok.length || db.siloDevirStok.length ||
              db.gunlukHareket.length || db.kuruKuspeGunluk.length);
  }

  /* ==================================================================
     2. Hesaplar
     ================================================================== */

  /* Yaş küspenin özel tipi yok; iki satırı ayıran tek işaret adı (Şartname §2). */
  function yasKuspeMi(malzeme) {
    return String(malzeme.Ad || '').toLocaleLowerCase('tr').indexOf('yaş küspe') === 0;
  }

  /* Çift sayım kontrolü — Şartname Test 6'nın ekrandaki karşılığı.
     Dökme + çuvallı toplamı, aynı pencerede ham dökme üretimden beklenen
     toplamla karşılaştırılır:
       beklenen = devir (silolar + çuvallı) + Σ ham dökme üretim
                  − Σ dökme satış − Σ çuvallı satış
     Çuvallama üretim değil biçim değiştirmedir; çuvallanan kg iki kez sayılırsa
     gerçek toplam beklenenden büyük çıkar. */
  function ciftSayim(tarih) {
    var dokme = ozelMalzeme('DokmeKuruKuspe'), cuval = ozelMalzeme('CuvalKuruKuspe');
    if (!dokme || !cuval) return null;

    var dokmeSt = YU.stok.malzemeStok(YU.db, dokme.Id, tarih);
    var cuvalSt = YU.stok.malzemeStok(YU.db, cuval.Id, tarih);
    var silolar = YU.db.silolar, tarihler = [], siloDevir = 0, bas = null, i, devir;

    for (i = 0; i < silolar.length; i++) {
      devir = YU.stok.enSonDevir(YU.db, 'Silo', silolar[i].Id, tarih);
      siloDevir += devir ? devir.Miktar : 0;
      tarihler.push(devir ? devir.DevirTarihi : null);
    }
    tarihler.push(cuvalSt.devirTarihi || null);

    var devirAyni = true;
    for (i = 1; i < tarihler.length; i++) if (tarihler[i] !== tarihler[0]) devirAyni = false;
    for (i = 0; i < tarihler.length; i++) if (tarihler[i] && (!bas || tarihler[i] > bas)) bas = tarihler[i];

    var g = YU.db.kuruKuspeGunluk, ham = 0, dokmeSatis = 0;
    for (i = 0; i < g.length; i++) {
      if (g[i].Tarih > tarih) continue;
      if (bas && g[i].Tarih < bas) continue;
      ham += Number(g[i].UretilenDokme) || 0;
      dokmeSatis += Number(g[i].SatilanDokme) || 0;
    }

    var devirToplam = YU.yuvarla(siloDevir + cuvalSt.devir);
    var beklenen = YU.yuvarla(devirToplam + ham - dokmeSatis - cuvalSt.satis);
    var gercek = YU.yuvarla(dokmeSt.mevcut + cuvalSt.mevcut);

    return {
      dokmeAd: dokme.Ad, cuvalAd: cuval.Ad,
      dokme: dokmeSt.mevcut, cuval: cuvalSt.mevcut,
      gercek: gercek, beklenen: beklenen,
      fark: YU.yuvarla(gercek - beklenen),
      tutuyor: YU.hesap.esit(gercek, beklenen),
      devirToplam: devirToplam, ham: YU.yuvarla(ham),
      dokmeSatis: YU.yuvarla(dokmeSatis), cuvalSatis: cuvalSt.satis,
      bas: bas, devirAyni: devirAyni
    };
  }

  /* ==================================================================
     3. Üst blok — tarih seçici ve hızlı seçimler
     ================================================================== */

  function ustPanel(d) {
    var bugun = YU.tarih.bugun();

    var tarihAlan = YU.ui.alan({
      etiket: 'Stok Tarihi',
      tip: 'tarih',
      deger: d.tarih,
      genislik: 178,
      yardim: YU.fmt.gunAdi(d.tarih) + ' · Tarih ≤ seçilen gün',
      onChange: function () { git(d, { tarih: tarihAlan.girdi.value }); }
    });

    var son = sonKayitliGun();
    var kampanya = kampanyaSonu();

    var hizli = satirKap('center', 6);
    hizli.appendChild(YU.ui.dugme({
      metin: 'Bugün', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
      pasif: d.tarih === bugun,
      onClick: function () { git(d, { tarih: bugun }); }
    }));
    hizli.appendChild(YU.ui.dugme({
      metin: 'Son Kayıtlı Gün', kucuk: true, tur: 'sade',
      baslik: son ? YU.fmt.tarih(son) : 'Kayıtlı gün yok',
      pasif: !son || d.tarih === son,
      onClick: function () { git(d, { tarih: son }); }
    }));
    hizli.appendChild(YU.ui.dugme({
      metin: 'Kampanya Sonu', kucuk: true, tur: 'sade',
      baslik: kampanya ? YU.fmt.tarih(kampanya) : 'Kampanya Tanımlı Değil',
      pasif: !kampanya || d.tarih === kampanya,
      onClick: function () { git(d, { tarih: kampanya }); }
    }));

    var sol = satirKap('flex-end', 14);
    sol.appendChild(tarihAlan.kok);
    sol.appendChild(YU.h('div', { stil: { paddingBottom: '4px' } }, hizli));

    var sag = sutunKap(5);
    sag.appendChild(YU.h('div', {
      stil: { font: '500 13.5px/1.3 var(--font)', color: 'var(--metin)' },
      metin: YU.fmt.tarihUzun(d.tarih) + ' tarihi itibarıyla'
    }));
    sag.appendChild(YU.h('div', {
      sinif: 'yu-yardim',
      metin: 'Seçilen güne kadarki tüm hareketler ve en son devir stok hesaba katılır (Şartname §5).'
    }));

    var satir = satirKap('flex-end', 18);
    satir.style.justifyContent = 'space-between';
    satir.appendChild(sol);
    satir.appendChild(sag);

    return YU.ui.panel({ govde: satir });
  }

  /* ==================================================================
     4. KPI satırı
     ================================================================== */

  function kpiSatiri(d) {
    var toplam = 0, sayilan = 0, yasKuspe = 0, yasSayi = 0, dokme = null, cuval = null, i, r;

    for (i = 0; i < d.tumSatirlar.length; i++) {
      r = d.tumSatirlar[i];
      /* Pasif malzeme yeni hareket almaz ama stoğu duruyorsa toplamdan
         düşmez — aksi hâlde ekrandaki toplam gerçeği eksik gösterir. */
      if (r.malzeme.Aktif !== false || r.mevcut !== 0) { toplam += r.mevcut; sayilan++; }
      if (r.malzeme.OzelTip === 'DokmeKuruKuspe') dokme = r;
      if (r.malzeme.OzelTip === 'CuvalKuruKuspe') cuval = r;
      if (yasKuspeMi(r.malzeme)) { yasKuspe += r.mevcut; yasSayi++; }
    }

    var siloDolu = 0, siloKapasite = 0;
    for (i = 0; i < d.silolar.length; i++) {
      siloDolu += d.silolar[i].mevcut;
      siloKapasite += d.silolar[i].kapasite;
    }

    var cuvalAdet = cuval && YU.hesap.CUVAL_KG > 0 ? cuval.mevcut / YU.hesap.CUVAL_KG : 0;

    var izgara = YU.h('div', { sinif: 'yu-izgara yu-iz-4' });
    izgara.appendChild(YU.ui.kpi({
      etiket: 'Toplam Stok', ikon: '#ic-chart',
      deger: YU.fmt.kg(YU.yuvarla(toplam)),
      alt: YU.fmt.sayi(sayilan) + ' malzeme · ' + YU.fmt.tarih(d.tarih) + ' itibarıyla'
    }));
    izgara.appendChild(YU.ui.kpi({
      etiket: 'Dökme Kuru Küspe', ikon: '#ic-building',
      deger: YU.fmt.kg(dokme ? dokme.mevcut : 0),
      alt: YU.fmt.sayi(d.silolar.length) + ' silo toplamı · doluluk ' +
        YU.fmt.yuzde(siloKapasite > 0 ? (siloDolu / siloKapasite) * 100 : 0)
    }));
    izgara.appendChild(YU.ui.kpi({
      etiket: 'Çuvallı Kuru Küspe', ikon: '#ic-wallet',
      deger: YU.fmt.kg(cuval ? cuval.mevcut : 0),
      alt: YU.fmt.sayi(Math.round(cuvalAdet)) + ' çuval karşılığı (1 çuval = ' +
        YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg)'
    }));
    izgara.appendChild(YU.ui.kpi({
      etiket: 'Yaş Küspe', ikon: '#ic-doc',
      deger: YU.fmt.kg(YU.yuvarla(yasKuspe)),
      alt: YU.fmt.sayi(yasSayi) + ' kalem · tonluk ve 25’lik toplamı'
    }));
    return izgara;
  }

  /* ==================================================================
     5. Ana tablo — malzeme bazında devir / üretim / satış / mevcut
     ================================================================== */

  function siloKirilimi(d) {
    var sutunlar = [
      { baslik: 'Silo' },
      { baslik: 'Devir', genislik: 130, hiza: 'sag', mono: true },
      { baslik: 'Giren', genislik: 130, hiza: 'sag', mono: true },
      { baslik: 'Çıkan', genislik: 130, hiza: 'sag', mono: true },
      { baslik: 'Mevcut', genislik: 140, hiza: 'sag', mono: true },
      { baslik: 'Doluluk', genislik: 150 }
    ];
    var satirlar = [], i, s, devir = 0, giren = 0, cikan = 0, mevcut = 0, doluluk;

    for (i = 0; i < d.silolar.length; i++) {
      s = d.silolar[i];
      devir += s.devir; giren += s.giren; cikan += s.cikan; mevcut += s.mevcut;
      doluluk = sutunKap(5);
      doluluk.appendChild(YU.h('div', {
        sinif: 'yu-yardim',
        metin: YU.fmt.yuzde((s.doluluk || 0) * 100) + ' · kapasite ' + YU.fmt.ton(s.kapasite)
      }));
      doluluk.appendChild(YU.ui.cubuk(s.doluluk, s.mevcut > s.kapasite ? 'olumsuz'
        : ((s.doluluk || 0) >= 0.9 ? 'bekleyen' : 'vurgu')));
      satirlar.push([
        YU.h('span', { metin: s.silo.Ad }),
        YU.fmt.kg(s.devir), YU.fmt.kg(s.giren), YU.fmt.kg(s.cikan), YU.fmt.kg(s.mevcut),
        doluluk
      ]);
    }

    if (satirlar.length) {
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: 'Toplam' }),
        YU.fmt.kg(YU.yuvarla(devir)), YU.fmt.kg(YU.yuvarla(giren)),
        YU.fmt.kg(YU.yuvarla(cikan)), YU.fmt.kg(YU.yuvarla(mevcut)),
        YU.h('span', { sinif: 'yu-yardim', metin: 'Dökme kuru küspe stoğu' })
      ]);
    }

    var kutu = sutunKap(11);
    kutu.appendChild(YU.h('div', {
      sinif: 'yu-yardim',
      metin: 'Dökme kuru küspe fiziksel olarak silolarda durur; stoğu basit formülle değil ' +
        'siloların toplamıyla hesaplanır (Şartname §5, kritik kural).'
    }));
    kutu.appendChild(YU.ui.tablo({
      sutunlar: sutunlar, satirlar: satirlar, kompakt: true,
      bos: 'Tanımlı silo yok.'
    }));
    kutu.appendChild(YU.h('div', null, YU.ui.dugme({
      metin: 'Silo Durumu', ikon: '#ic-building', kucuk: true, tur: 'ikincil',
      onClick: function () { YU.git('silo-durumu', { tarih: d.tarih }); }
    })));
    return kutu;
  }

  function malzemeHucresi(d, r, acKapa) {
    var ust = satirKap('center', 8);
    ust.appendChild(YU.h('span', { sinif: 'yu-guclu', metin: r.malzeme.Ad }));
    if (r.malzeme.OzelTip === 'DokmeKuruKuspe') ust.appendChild(YU.ui.rozet('Silo Toplamı', 'vurgu'));
    if (r.malzeme.OzelTip === 'CuvalKuruKuspe') ust.appendChild(YU.ui.rozet('Çuvallı', 'notr'));
    if (r.malzeme.Aktif === false) ust.appendChild(YU.ui.rozet('Pasif', 'bekleyen'));
    if (acKapa) ust.appendChild(acKapa);
    return ust;
  }

  function tabloPaneli(d) {
    var sutunlar = [
      { baslik: 'Malzeme' },
      { baslik: 'Devir', genislik: 140, hiza: 'sag', mono: true },
      { baslik: 'Devir Tarihi', genislik: 118 },
      { baslik: 'Toplam Üretim', genislik: 150, hiza: 'sag', mono: true },
      { baslik: 'Toplam Satış', genislik: 150, hiza: 'sag', mono: true },
      { baslik: 'Mevcut', genislik: 160, hiza: 'sag', mono: true }
    ];

    var satirlar = [], dokmeSira = -1, i, r, acKapa = null, ok = null;

    for (i = 0; i < d.satirlar.length; i++) {
      r = d.satirlar[i];

      if (r.malzeme.OzelTip === 'DokmeKuruKuspe') {
        dokmeSira = i;
        ok = YU.svg('#ic-chevron', 14);
        acKapa = YU.h('span', {
          sinif: 'yu-satir-eylem', role: 'button', tabindex: '0',
          title: 'Silo kırılımını aç/kapat',
          onClick: function (e) { e.stopPropagation(); kirilimAcKapa(d); },
          onKeyDown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kirilimAcKapa(d); }
          }
        }, ok);
        d.kirilimOk = ok;
      }

      satirlar.push({
        vurgu: d.vurguId && r.malzeme.Id === d.vurguId ? 'vurgu' : null,
        hucreler: [
          malzemeHucresi(d, r, r.malzeme.OzelTip === 'DokmeKuruKuspe' ? acKapa : null),
          YU.fmt.kg(r.devir),
          r.devirTarihi ? mono(YU.fmt.tarih(r.devirTarihi), true) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
          YU.fmt.kg(r.uretim),
          YU.fmt.kg(r.satis),
          YU.fmt.kg(r.mevcut)
        ]
      });
    }

    var sar = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      bos: d.pasifGoster
        ? 'Tanımlı malzeme yok.'
        : 'Aktif malzeme yok. Pasif malzemeleri görmek için filtreyi açın.'
    });

    /* Açılır alt satır YU.ui.tablo'nun sözleşmesinde yok; tablo kurulduktan
       sonra dökme satırının hemen altına eklenir. */
    var tbody = sar.querySelector('tbody');
    var trler = tbody ? tbody.querySelectorAll('tr') : [];
    if (dokmeSira >= 0 && trler.length > dokmeSira) {
      var hucre = YU.h('td', { colspan: String(sutunlar.length), stil: { background: 'var(--yuzey-2)' } },
        siloKirilimi(d));
      d.kirilimSatiri = YU.h('tr', null, hucre);
      d.kirilimSatiri.style.display = 'none';
      tbody.insertBefore(d.kirilimSatiri, trler[dokmeSira].nextSibling);
    }

    var filtre = YU.ui.dugme({
      metin: d.pasifGoster ? 'Pasif malzemeler: görünür' : 'Pasif malzemeler: gizli',
      ikon: '#ic-filter', kucuk: true, tur: 'ikincil',
      onClick: function () { git(d, { pasif: d.pasifGoster ? null : '1' }); }
    });

    return YU.ui.panel({
      baslik: 'Malzeme Bazında Stok',
      ikon: '#ic-chart',
      dolgusuz: true,
      sag: filtre,
      govde: sar
    });
  }

  function kirilimAcKapa(d) {
    if (!d.kirilimSatiri) return;
    var acik = d.kirilimSatiri.style.display === 'none';
    d.kirilimSatiri.style.display = acik ? '' : 'none';
    if (d.kirilimOk) d.kirilimOk.style.transform = acik ? 'rotate(90deg)' : '';
  }

  /* ==================================================================
     6. Sağ panel — stok dağılımı halkası
     ================================================================== */

  function dagilimPaneli(d) {
    var ham = [], i, r, toplam = 0;
    for (i = 0; i < d.satirlar.length; i++) {
      r = d.satirlar[i];
      if (r.mevcut <= 0) continue;
      ham.push({ etiket: r.malzeme.Ad, deger: r.mevcut });
      toplam += r.mevcut;
    }
    ham.sort(function (a, b) { return b.deger - a.deger; });

    /* Renk seti altı seri taşıyor; fazlası tek dilimde toplanır ki iki malzeme
       aynı rengi almasın. */
    var dilimler = ham;
    if (ham.length > EN_COK_DILIM) {
      dilimler = ham.slice(0, EN_COK_DILIM - 1);
      var kalan = 0;
      for (i = EN_COK_DILIM - 1; i < ham.length; i++) kalan += ham[i].deger;
      dilimler.push({ etiket: 'Diğer (' + YU.fmt.sayi(ham.length - (EN_COK_DILIM - 1)) + ' malzeme)', deger: kalan });
    }
    for (i = 0; i < dilimler.length; i++) dilimler[i].renk = YU.ui.seriRenk(i);

    var govde = [];

    if (!dilimler.length) {
      govde.push(YU.h('div', {
        sinif: 'yu-bos-metin',
        stil: { padding: '28px 0', textAlign: 'center' },
        metin: YU.fmt.tarih(d.tarih) + ' itibarıyla stokta malzeme görünmüyor.'
      }));
    } else {
      var halkaKap = YU.h('div', { stil: { display: 'flex', justifyContent: 'center', padding: '4px 0 6px' } });
      halkaKap.appendChild(YU.ui.halkaGrafik({ dilimler: dilimler, boyut: 148 }));
      govde.push(halkaKap);

      var liste = sutunKap(10);
      for (i = 0; i < dilimler.length; i++) {
        var satir = satirKap('center', 9);
        satir.appendChild(YU.h('span', {
          stil: {
            width: '8px', height: '8px', borderRadius: '2px', flex: 'none',
            background: dilimler[i].renk
          }
        }));
        satir.appendChild(YU.h('span', {
          metin: dilimler[i].etiket,
          stil: {
            flex: '1', minWidth: '0', font: '400 12px/1.35 var(--font)', color: 'var(--metin-3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }
        }));
        satir.appendChild(mono(YU.fmt.kg(dilimler[i].deger)));
        satir.appendChild(YU.h('span', {
          metin: YU.fmt.yuzde(toplam > 0 ? (dilimler[i].deger / toplam) * 100 : 0),
          stil: { font: '400 11px/1 var(--font)', color: 'var(--metin-4)', width: '48px', textAlign: 'right', flex: 'none' }
        }));
        liste.appendChild(satir);
      }
      govde.push(liste);
      govde.push(YU.h('div', { sinif: 'yu-ayrac yu-yatay' }));
      govde.push(YU.h('div', {
        sinif: 'yu-yardim',
        metin: 'Toplam ' + YU.fmt.kgU(YU.yuvarla(toplam)) + ' · yalnızca mevcudu sıfırdan büyük malzemeler.'
      }));
    }

    return YU.ui.panel({
      baslik: 'Stok Dağılımı',
      ikon: '#ic-percent',
      sag: YU.h('span', { metin: YU.fmt.tarih(d.tarih) }),
      govde: govde
    });
  }

  /* ==================================================================
     7. Alt panel — çift sayım kontrolü (Şartname Test 6)
     ================================================================== */

  function hesapOgesi(etiket, deger, tur) {
    return YU.h('div', { sinif: 'yu-hesap-oge' + (tur ? ' ' + tur : '') },
      YU.h('div', { sinif: 'yu-hesap-etiket', metin: etiket }),
      YU.h('div', { sinif: 'yu-hesap-deger', metin: deger })
    );
  }

  function hesapOk(isaret) {
    return YU.h('div', { sinif: 'yu-hesap-ok' },
      isaret ? YU.h('span', { metin: isaret }) : YU.svg('#ic-chevron', 14));
  }

  function ciftSayimPaneli(d) {
    var c = ciftSayim(d.tarih);
    if (!c) return null;

    var serit = YU.h('div', { sinif: 'yu-hesap' },
      hesapOgesi(c.dokmeAd, YU.fmt.kg(c.dokme)),
      hesapOk('+'),
      hesapOgesi(c.cuvalAd, YU.fmt.kg(c.cuval)),
      hesapOk('='),
      hesapOgesi('Ekrandaki toplam', YU.fmt.kg(c.gercek), 'vurgu'),
      hesapOk(),
      hesapOgesi('Ham üretimden beklenen', YU.fmt.kg(c.beklenen)),
      hesapOk('='),
      hesapOgesi('Fark', YU.fmt.kg(c.fark), c.tutuyor ? 'olumlu' : 'olumsuz')
    );

    var acik = YU.h('div', {
      sinif: 'yu-yardim',
      metin: 'Beklenen = devir ' + YU.fmt.kgU(c.devirToplam) +
        ' + ham dökme üretim ' + YU.fmt.kgU(c.ham) +
        ' − dökme satış ' + YU.fmt.kgU(c.dokmeSatis) +
        ' − çuvallı satış ' + YU.fmt.kgU(c.cuvalSatis) +
        (c.bas ? ' · ' + YU.fmt.tarih(c.bas) + ' – ' + YU.fmt.tarih(d.tarih) + ' penceresi'
               : ' · tüm kayıtlar'),
      title: 'Şartname Test 6'
    });

    var not = YU.h('div', {
      sinif: 'yu-yardim',
      metin: c.tutuyor
        ? 'Çuvallanan küspe iki kez sayılmıyor: çuvallama yeni üretim değil, biçim değiştirmedir (Şartname §4).'
        : 'Fark varsa çuvallanan küspe iki kez sayılıyor ya da bir gün eksik/fazla kaydedilmiş olabilir.'
    });

    var rozetler = satirKap('center', 6);
    if (!c.devirAyni) rozetler.appendChild(YU.ui.rozet('Devir Tarihleri Farklı', 'bekleyen'));
    rozetler.appendChild(c.tutuyor ? YU.ui.rozet('Tutuyor', 'olumlu') : YU.ui.rozet('Fark Var', 'olumsuz'));

    var govde = [serit, acik, not];
    if (!c.devirAyni) {
      govde.push(YU.h('div', {
        sinif: 'yu-yardim',
        metin: 'Silolar ve çuvallı kuru küspe farklı devir tarihleri taşıyor; ' +
          'karşılaştırma en son devir tarihinden başlatıldığı için yaklaşıktır.'
      }));
    }

    return YU.ui.panel({
      baslik: 'Çift Sayım Kontrolü',
      ikon: '#ic-percent',
      sag: rozetler,
      govde: govde
    });
  }

  /* ==================================================================
     8. Sayfa
     ================================================================== */

  /* Tarih ve filtre adreste taşınır: bağlantı paylaşılabilir kalsın ve
     YU.yenile() aynı görünümü yeniden kursun. */
  function git(d, degisiklik) {
    var p = { tarih: d.tarih, pasif: d.pasifGoster ? '1' : null, malzeme: d.vurguId || null }, k;
    for (k in degisiklik) {
      if (Object.prototype.hasOwnProperty.call(degisiklik, k)) p[k] = degisiklik[k];
    }
    YU.git(KOD, p);
  }

  function bosDurumPaneli(d) {
    var eylemler = [YU.ui.dugme({
      metin: 'Kuru Küspe Girişi', ikon: '#ic-plus', tur: 'birincil',
      onClick: function () { YU.git('kuru-kuspe', { tarih: d.tarih }); }
    })];
    if (YU.yonetici()) {
      eylemler.push(YU.ui.dugme({
        metin: 'Devir Stok', ikon: '#ic-wallet', tur: 'ikincil',
        onClick: function () { YU.git('devir-stok'); }
      }));
    }
    return YU.ui.panel({
      baslik: 'Malzeme Bazında Stok',
      ikon: '#ic-chart',
      dolgusuz: true,
      govde: YU.ui.bosDurum({
        ikon: '#ic-chart',
        baslik: 'Henüz Stok Kaydı Yok',
        metin: 'Kampanya başı devir stok girilip günlük üretim ve satış kaydedildikçe ' +
          'malzeme bazında devir, üretim, satış ve mevcut burada listelenir.',
        eylemler: eylemler
      })
    });
  }

  function ciz(kap, param) {
    param = param || {};
    var d = {
      tarih: gecerliTarih(param.tarih) ? param.tarih : YU.tarih.bugun(),
      pasifGoster: String(param.pasif || '') === '1',
      vurguId: Number(param.malzeme) || null,
      satirlar: []
    };
    var i, r;

    YU.ui.sayfaEylemleri(
      YU.ui.dugme({
        metin: 'Silo Durumu', ikon: '#ic-building', tur: 'ikincil',
        onClick: function () { YU.git('silo-durumu', { tarih: d.tarih }); }
      }),
      YU.ui.dugme({
        metin: 'Günlük Rapor', ikon: '#ic-doc', tur: 'sade',
        onClick: function () { YU.git('gunluk-rapor', { tarih: d.tarih }); }
      })
    );

    kap.appendChild(ustPanel(d));

    if (!veriVarMi()) {
      kap.appendChild(bosDurumPaneli(d));
      return;
    }

    d.tumSatirlar = YU.stok.tumMalzemeler(YU.db, d.tarih);
    d.silolar = YU.stok.tumSilolar(YU.db, d.tarih);

    for (i = 0; i < d.tumSatirlar.length; i++) {
      r = d.tumSatirlar[i];
      if (r.malzeme.Aktif === false && !d.pasifGoster) continue;
      d.satirlar.push(r);
    }

    kap.appendChild(kpiSatiri(d));

    var izgara = YU.h('div', { sinif: 'yu-izgara yu-iz-yan' });
    izgara.appendChild(tabloPaneli(d));
    izgara.appendChild(dagilimPaneli(d));
    kap.appendChild(izgara);

    var kontrol = ciftSayimPaneli(d);
    if (kontrol) kap.appendChild(kontrol);
  }

  YU.sayfaTanimla({
    kod: KOD,
    baslik: 'Stok Durumu',
    altBaslik: function (param) {
      var t = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
      var don = YU.donem.aktif();
      return YU.fmt.tarih(t) + ' tarihi itibarıyla' + (don ? ' · Kampanya ' + don.ad : '');
    },
    ikon: '#ic-chart',
    grup: 'Takip',
    rol: 'Hepsi',
    ciz: ciz
  });
})();

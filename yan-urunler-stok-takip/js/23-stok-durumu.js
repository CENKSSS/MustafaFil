/* js/23-stok-durumu.js — Stok Durumu ekranı (Şartname §7 · SOZLESME §7).

   Şartname §5 DEMİRBAŞ: ekran bugün itibarıyla çalışır ama seçilen bir tarihe
   kadarki stok da hesaplanabilir (Tarih <= seçilen). Dökme kuru küspenin
   mevcudu basit formülle değil, siloların toplamıyla gelir; bu yüzden o satır
   "Silo Toplamı" rozetiyle işaretlenir ve silo kırılımı açılabilir. */
(function () {
  'use strict';

  var YU = window.YU;
  var KOD = 'stok-durumu';

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

  /* Bir malzemenin paket büyüklüğü — adet karşılığı ancak bu biliniyorsa
     yazılır. Çuval 50 kg ve poşet 25 kg şartnamede tanımlı; tonluk torbanın
     kg'ı tanımlı değil, o yüzden tonluk satırında adet gösterilmez. */
  function paketKg(malzeme) {
    if (!malzeme) return 0;
    if (malzeme.OzelTip === 'CuvalKuruKuspe') return YU.hesap.CUVAL_KG;
    if (yasKuspeMi(malzeme) && /25/.test(String(malzeme.Ad || ''))) return YU.hesap.POSET_KG;
    return 0;
  }

  /* kg değerini "kg / adet" parçalarına ayırır; adet yalnızca paket
     büyüklüğü bilinen malzemede eklenir. Ton karşılığı bu ekranda hiç
     gösterilmez — her şey kg (kullanıcı isteği, 21.08.2026). */
  function olculer(kg, malzeme) {
    var v = Number(kg) || 0;
    var parcalar = [
      { sayi: YU.fmt.kg(v), birim: 'kg' }
    ];
    var paket = paketKg(malzeme);
    if (paket > 0) parcalar.push({ sayi: YU.fmt.sayi(Math.round(v / paket)), birim: 'adet' });
    return parcalar;
  }

  function olcu(kg, malzeme) {
    var parcalar = olculer(kg, malzeme);
    if (parcalar.length < 2) return YU.ui.olcu(parcalar);
    /* kg ve adet ALT ALTA (kullanıcı isteği, 24.08.2026): tek satırda
       "2.500 kg / 100 adet" dar kolonda sıkışıyordu. Adet satırı küçük ve
       soluk — kg birincil değer olarak kalır. */
    return YU.h('span', {
      stil: { display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }
    },
      YU.ui.olcu([parcalar[0]]),
      YU.h('span', {
        metin: parcalar[1].sayi + ' ' + parcalar[1].birim,
        stil: { font: '400 .8em/1.2 var(--font)', color: 'var(--metin-4)', whiteSpace: 'nowrap' }
      })
    );
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

  /* "Kampanya Sonu" kısayolu kaldırıldı (kullanıcı isteği, 23.08.2026):
     şartnamede böyle bir düğme talebi yok, §5 yalnız tarih seçimini ister. */

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
    /* İADE beklenene eklenir (kullanıcı direktifi, 24.08.2026): iade stoğu
       artırır ama satışı değiştirmez; formülde sayılmazsa kontrol gerçek
       bir hata yokken "Fark Var" derdi. Dökme iadesi siloya Manuel "giren"
       olarak düştüğü için gerçek tarafta silo toplamını artırır — beklenen
       de aynı miktarı sayar. Çuvallamanın çift sayım yasağı değişmedi.
       İade 0 iken formül Test 6'nın Demirbaş rakamlarıyla birebir aynıdır. */
    var beklenen = YU.yuvarla(devirToplam + ham - dokmeSatis - cuvalSt.satis + cuvalSt.iade + dokmeSt.iade);
    var gercek = YU.yuvarla(dokmeSt.mevcut + cuvalSt.mevcut);

    return {
      dokmeAd: dokme.Ad, cuvalAd: cuval.Ad,
      dokme: dokmeSt.mevcut, cuval: cuvalSt.mevcut,
      gercek: gercek, beklenen: beklenen,
      fark: YU.yuvarla(gercek - beklenen),
      tutuyor: YU.hesap.esit(gercek, beklenen),
      devirToplam: devirToplam, ham: YU.yuvarla(ham),
      dokmeSatis: YU.yuvarla(dokmeSatis), cuvalSatis: cuvalSt.satis,
      cuvalIade: cuvalSt.iade,
      dokmeIade: dokmeSt.iade,
      bas: bas, devirAyni: devirAyni
    };
  }

  /* ==================================================================
     3. Tarih şeridi — Kuru Küspe / Malzeme Girişi ekranlarıyla aynı dil
     (kullanıcı isteği, 23.08.2026: giriş ve takip ekranları aynı aileden)
     ================================================================== */

  function tarihSeridi(d) {
    var bugun = YU.tarih.bugun();

    /* Seçili tarih İRİ yazılır (kullanıcı isteği, 24.08.2026 — "tarih gözle
       seçilmesi zor"). Tarih kutusu ve gün gezinme düğmeleri panel başlığına
       taşındı (kullanıcı isteği, 24.08.2026): burada yalnız iri tarih ve
       sayfa eylemleri kalır. */
    var buyukTarih = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '0' } },
      YU.h('div', {
        metin: YU.fmt.tarih(d.tarih) + ' · ' + YU.fmt.gunAdi(d.tarih),
        stil: {
          font: '650 20px/1.1 var(--sayi)', letterSpacing: '-.01em',
          fontVariantNumeric: 'tabular-nums', color: 'var(--metin)', whiteSpace: 'nowrap'
        }
      }),
      YU.h('div', {
        sinif: 'yu-yardim',
        metin: d.tarih === bugun ? 'Bugün itibarıyla' : 'Bu tarih itibarıyla',
        title: 'Seçilen güne kadarki tüm hareketler ve en son devir stok hesaba katılır (Şartname §5).'
      })
    );

    return YU.h('div', {
      /* Şerit yazdırmaya girmez (kullanıcı isteği, 24.08.2026): kâğıtta tarih
         kutusu ve düğmeler bozuk basılıyordu; tarih zaten sayfa başlığında. */
      sinif: 'yu-baski-yok',
      stil: {
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        padding: '10px 16px', background: 'var(--yuzey-2)',
        border: '1px solid var(--kenar)', borderRadius: 'var(--r)'
      }
    },
      buyukTarih,
      YU.h('span', { stil: { flex: '1' } }),
      /* Silo Durumu ve Günlük Rapor düğmeleri kaldırıldı; yerlerine Malzeme
         Girişi (aynı tarihe düzenleme) ve Yazdır kondu (kullanıcı istekleri,
         24.08.2026). */
      YU.ui.dugme({
        metin: 'Malzeme Girişi', ikon: '#ic-pencil', tur: 'ikincil', kucuk: true,
        baslik: YU.fmt.tarih(d.tarih) + ' gününü Malzeme Girişi\'nde düzenle',
        onClick: function () { YU.git('malzeme-girisi', { tarih: d.tarih }); }
      }),
      YU.ui.dugme({
        metin: 'Yazdır', ikon: '#ic-download', tur: 'birincil', kucuk: true,
        onClick: function () { window.print(); }
      })
    );
  }

  /* Tarih kutusu + gün gezinme, tablo panelinin başlığında (kullanıcı isteği,
     24.08.2026 — "tarih kısmını aşağıya koy"). */
  function tarihKontrolleri(d) {
    var bugun = YU.tarih.bugun();

    var tarihAlan = YU.ui.alan({
      tip: 'tarih', deger: d.tarih, genislik: '148px',
      onChange: function () { git(d, { tarih: tarihAlan.girdi.value }); }
    });

    var kap = satirKap('center', 6);
    kap.className = 'yu-baski-yok';   /* kâğıtta kutu ve düğmeler basılmaz */
    /* Sıra kullanıcı isteğiyle (24.08.2026): önce tarih kutusu, sonra günün
       adı, sonra gezinme üçlüsü. */
    kap.appendChild(tarihAlan.kok);
    kap.appendChild(YU.h('span', {
      metin: YU.fmt.gunAdi(d.tarih),
      stil: { font: '600 13.5px/1 var(--font)', color: 'var(--metin-2)', whiteSpace: 'nowrap', margin: '0 2px' }
    }));
    kap.appendChild(YU.ui.dugme({
      metin: 'Önceki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { git(d, { tarih: YU.tarih.ekle(d.tarih, -1) }); }
    }));
    kap.appendChild(YU.ui.dugme({
      /* Bugün HEP tıklanabilir — bugündeyken de (kullanıcı isteği, 23.08.2026). */
      metin: 'Bugün', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
      onClick: function () { git(d, { tarih: bugun }); }
    }));
    kap.appendChild(YU.ui.dugme({
      metin: 'Sonraki Gün', kucuk: true, tur: 'ikincil',
      pasif: d.tarih >= bugun,
      baslik: d.tarih >= bugun ? 'Bugünden ileri gidilemez' : '',
      onClick: function () { git(d, { tarih: YU.tarih.ekle(d.tarih, 1) }); }
    }));
    /* Son Kayıtlı Gün düğmesi kaldırıldı (kullanıcı isteği, 24.08.2026). */
    return kap;
  }

  /* 4. KPI kartları kaldırıldı — kullanıcı isteği, 23.08.2026 ("kartları
     kaldır"). Aynı rakamlar Ana Sayfa kartlarında ve alttaki tabloda var. */

  /* ==================================================================
     5. Ana tablo — malzeme bazında devir / üretim / satış / mevcut
     ================================================================== */

  function siloKirilimi(d) {
    var sutunlar = [
      { baslik: 'Silo' },
      { baslik: 'Devir', genislik: 158, hiza: 'sag', mono: true },
      { baslik: 'Giren', genislik: 158, hiza: 'sag', mono: true },
      { baslik: 'Çıkan', genislik: 158, hiza: 'sag', mono: true },
      { baslik: 'Mevcut', genislik: 158, hiza: 'sag', mono: true },
      { baslik: 'Doluluk', genislik: 140 }
    ];
    var satirlar = [], i, s, devir = 0, giren = 0, cikan = 0, mevcut = 0, doluluk;

    for (i = 0; i < d.silolar.length; i++) {
      s = d.silolar[i];
      devir += s.devir; giren += s.giren; cikan += s.cikan; mevcut += s.mevcut;
      doluluk = sutunKap(5);
      doluluk.appendChild(YU.h('div', {
        sinif: 'yu-yardim',
        metin: YU.fmt.yuzde((s.doluluk || 0) * 100) + ' · kapasite ' + YU.fmt.kgU(s.kapasite)
      }));
      doluluk.appendChild(YU.ui.cubuk(s.doluluk, s.mevcut > s.kapasite ? 'olumsuz'
        : ((s.doluluk || 0) >= 0.9 ? 'bekleyen' : 'vurgu')));
      satirlar.push([
        YU.h('span', { metin: s.silo.Ad }),
        olcu(s.devir, null), olcu(s.giren, null), olcu(s.cikan, null), olcu(s.mevcut, null),
        doluluk
      ]);
    }

    if (satirlar.length) {
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: 'Toplam' }),
        olcu(YU.yuvarla(devir), null), olcu(YU.yuvarla(giren), null),
        olcu(YU.yuvarla(cikan), null), olcu(YU.yuvarla(mevcut), null),
        YU.h('span', { sinif: 'yu-yardim', metin: 'Dökme kuru küspe stoğu' })
      ]);
    }

    var kutu = sutunKap(11);
    /* Açıklama yazısı ve Silo Durumu düğmesi kaldırıldı (kullanıcı isteği,
       24.08.2026); kırılım yalnız tabloyu gösterir. */
    kutu.appendChild(YU.ui.tablo({
      sutunlar: sutunlar, satirlar: satirlar, kompakt: true,
      bos: 'Tanımlı silo yok.'
    }));
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
    /* Sütun araları açık (kullanıcı isteği, 23.08.2026 — "sıkışık kalmışlar"):
       sayı sütunları sağa yaslı olduğu için fazladan genişlik, komşu sütunla
       arasında boşluk olarak okunur. Devir Tarihi de aynı nedenle sağa yaslandı;
       yoksa soldaki Devir rakamına yapışık duruyordu. */
    /* İade kolonu ve "Stok" başlığı kullanıcı isteği (24.08.2026); iade,
       Malzeme Girişi'ndeki sırayla üretimin solunda durur. Günlük Üretim ve
       Günlük Satış seçili günün rakamlarıdır (kullanıcı isteği, 24.08.2026). */
    var sutunlar = [
      { baslik: 'Malzeme' },
      { baslik: 'Devir', genislik: 130, hiza: 'sag', mono: true },
      { baslik: 'Devir Tarihi', genislik: 115, hiza: 'sag' },
      /* Gün Başı = seçili günün hareketleri işlenmeden önceki stok; en
         sağdaki Stok gün sonunu söyler (kullanıcı isteği, 24.08.2026). */
      { baslik: 'Gün Başı', genislik: 140, hiza: 'sag', mono: true },
      { baslik: 'Toplam İade', genislik: 130, hiza: 'sag', mono: true },
      { baslik: 'Günlük Üretim', genislik: 140, hiza: 'sag', mono: true },
      { baslik: 'Günlük Satış', genislik: 140, hiza: 'sag', mono: true },
      { baslik: 'Toplam Üretim', genislik: 150, hiza: 'sag', mono: true },
      { baslik: 'Toplam Satış', genislik: 150, hiza: 'sag', mono: true },
      { baslik: 'Stok', genislik: 150, hiza: 'sag', mono: true }
    ];

    var satirlar = [], dokmeSira = -1, i, r, acKapa = null, ok = null;

    /* Seçili günün hareketi tek geçişte haritalanır (satır başına tarama yok). */
    var gunluk = {}, gh = YU.db.gunlukHareket, j;
    for (j = 0; j < gh.length; j++) {
      if (gh[j].Tarih === d.tarih) gunluk[gh[j].MalzemeId] = gh[j];
    }

    function gunlukHucre(malzeme, alan) {
      var h = gunluk[malzeme.Id];
      if (!h) return YU.h('span', { sinif: 'yu-zayif', metin: '—', title: 'Bu güne giriş yok.' });
      return olcu(Number(h[alan]) || 0, malzeme);
    }

    /* Gün başı stok: dökme için siloların gün başı toplamı (Tarih < seçilen,
       Şartname §5); basit malzemede gün sonu stoktan o günün net değişimi
       geri alınır. gunBasi + üretim + iade − satış = Stok. */
    function gunBasi(r) {
      if (r.malzeme.OzelTip === 'DokmeKuruKuspe') {
        var t = 0, silolar = YU.db.silolar, k;
        for (k = 0; k < silolar.length; k++) t += YU.stok.siloGunBasi(YU.db, silolar[k].Id, d.tarih);
        return YU.yuvarla(t);
      }
      var h = gunluk[r.malzeme.Id];
      if (!h) return r.mevcut;
      return YU.yuvarla(r.mevcut - (Number(h.Uretim) || 0) - (Number(h.Iade) || 0) + (Number(h.Satis) || 0));
    }

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
          olcu(r.devir, r.malzeme),
          r.devirTarihi ? mono(YU.fmt.tarih(r.devirTarihi), true) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
          olcu(gunBasi(r), r.malzeme),
          /* İade her malzemede izlenir (kullanıcı direktifi, 24.08.2026);
             dökme iadesi ayrıca seçilen siloya Manuel "giren" olarak düşer. */
          olcu(r.iade, r.malzeme),
          gunlukHucre(r.malzeme, 'Uretim'),
          gunlukHucre(r.malzeme, 'Satis'),
          olcu(r.uretim, r.malzeme),
          olcu(r.satis, r.malzeme),
          olcu(r.mevcut, r.malzeme)
        ]
      });
    }

    var sar = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      bos: d.pasifGoster
        ? 'Tanımlı malzeme yok.'
        : 'Aktif malzeme yok. Pasif malzemeleri görmek için filtreyi açın.',
      yapiskan: true
    });
    /* Yazdırmada 9 kolon A4'e sığmıyordu (kullanıcı isteği, 24.08.2026):
       bu sınıf, baskıda kolon genişliklerini serbest bırakıp yazıyı küçültür
       (tema.css @media print .yu-baski-sig). Ekran görünümü değişmez. */
    sar.className += ' yu-baski-sig';

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

    /* Tarih kutusu ve gün düğmeleri panel başlığında (kullanıcı isteği,
       24.08.2026 — "tarih kısmını aşağıya koy"). Baskıda kontroller gizlenir;
       kâğıtta günü yalnız-baskı tarih etiketi söyler. */
    var tarihEtiketi = YU.h('span', {
      sinif: 'yu-yalniz-baski',
      metin: YU.fmt.tarih(d.tarih) + ' · ' + YU.fmt.gunAdi(d.tarih),
      stil: {
        font: '600 14px/1 var(--sayi)', fontVariantNumeric: 'tabular-nums',
        color: 'var(--metin-2)', whiteSpace: 'nowrap'
      }
    });

    var panel = YU.ui.panel({
      baslik: 'Malzeme Bazında Stok',
      ikon: '#ic-chart',
      dolgusuz: true,
      sag: YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
        tarihEtiketi, filtre),
      govde: sar
    });

    /* Tarih kontrolleri başlığın HEMEN SAĞINDA (kullanıcı isteği, 24.08.2026
       — "tarih kısmını en sola, başlığın sağına al"); filtre sağ uçta kalır. */
    var basEl = panel.querySelector('.yu-panel-bas');
    var baslikEl = basEl ? basEl.querySelector('.yu-panel-baslik') : null;
    if (basEl && baslikEl) {
      baslikEl.style.flex = '0 0 auto';
      basEl.insertBefore(tarihKontrolleri(d), baslikEl.nextSibling);
      var sagEl = basEl.querySelector('.yu-panel-sag');
      if (sagEl) sagEl.style.marginLeft = 'auto';
    }
    return panel;
  }

  function kirilimAcKapa(d) {
    if (!d.kirilimSatiri) return;
    var acik = d.kirilimSatiri.style.display === 'none';
    d.kirilimSatiri.style.display = acik ? '' : 'none';
    if (d.kirilimOk) d.kirilimOk.style.transform = acik ? 'rotate(90deg)' : '';
  }

  /* 6. Sağ panel (Stok Dağılımı halkası) kaldırıldı — kullanıcı isteği, 23.08.2026. */

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

    /* .yu-hesap dikey fiş düzenidir; formül öğeleri yatay .yu-hesap-satir
       kabında yan yana dizilir. */
    var serit = YU.h('div', { sinif: 'yu-hesap' },
      YU.h('div', { sinif: 'yu-hesap-satir' },
        hesapOgesi(c.dokmeAd, YU.fmt.kg(c.dokme)),
        hesapOk('+'),
        hesapOgesi(c.cuvalAd, YU.fmt.kg(c.cuval)),
        hesapOk('='),
        hesapOgesi('Ekrandaki toplam', YU.fmt.kg(c.gercek), 'vurgu'),
        hesapOk(),
        hesapOgesi('Ham üretimden beklenen', YU.fmt.kg(c.beklenen)),
        hesapOk('='),
        hesapOgesi('Fark', YU.fmt.kg(c.fark), c.tutuyor ? 'olumlu' : 'olumsuz')
      )
    );

    var acik = YU.h('div', {
      sinif: 'yu-yardim',
      metin: 'Beklenen = devir ' + YU.fmt.kgU(c.devirToplam) +
        ' + ham dökme üretim ' + YU.fmt.kgU(c.ham) +
        ' − dökme satış ' + YU.fmt.kgU(c.dokmeSatis) +
        ' − çuvallı satış ' + YU.fmt.kgU(c.cuvalSatis) +
        (c.cuvalIade ? ' + çuvallı iade ' + YU.fmt.kgU(c.cuvalIade) : '') +
        (c.dokmeIade ? ' + dökme iade ' + YU.fmt.kgU(c.dokmeIade) : '') +
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

    /* Fark varsa panelin üstünde İRİ kırmızı uyarı (kullanıcı isteği,
       24.08.2026); aynı koşul üst şerit uyarılarına da düşer (10-kabuk,
       YU.ciftSayimKontrol üzerinden). */
    if (!c.tutuyor) {
      var buyukSerit = YU.ui.serit({
        tur: 'hata',
        baslik: 'Çift Sayım Tutmuyor',
        metin: 'Ekrandaki kuru küspe toplamı, ham üretimden beklenen toplamla uyuşmuyor. ' +
          'Çuvallanan küspe iki kez sayılmış ya da bir kayıt bozulmuş olabilir (Şartname Test 6).'
      });
      var seritGovde = buyukSerit.querySelector('.yu-serit-govde');
      if (seritGovde) {
        seritGovde.appendChild(YU.h('div', {
          stil: { display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }
        },
          YU.h('span', { metin: 'Fark', stil: { font: '500 14px/1.2 var(--font)', color: 'var(--metin-2)' } }),
          YU.h('span', {
            metin: (c.fark > 0 ? '+' : '') + YU.fmt.kgU(c.fark),
            stil: {
              font: '650 26px/1.1 var(--sayi)', letterSpacing: '-.02em',
              fontVariantNumeric: 'tabular-nums', color: 'var(--olumsuz)'
            }
          })
        ));
      }
      govde.unshift(buyukSerit);
    }

    return YU.ui.panel({
      baslik: 'Çift Sayım Kontrolü',
      ikon: '#ic-percent',
      sag: rozetler,
      govde: govde
    });
  }

  /* Üst şerit uyarıları için köprü (10-kabuk YU.uyarilar): fark varsa
     ünlem paneline "Çift Sayım Tutmuyor" uyarısı düşer. */
  YU.ciftSayimKontrol = function (tarih) {
    return ciftSayim(tarih || YU.tarih.bugun());
  };

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

    /* Silo Durumu / Günlük Rapor sayfa başlığından tarih şeridine taşındı —
       Kuru Küspe ve Malzeme Girişi'ndeki düzenin aynısı. */
    YU.ui.sayfaEylemleri();

    /* Panel tam genişlik: sağda boşluk kalıyordu (kullanıcı isteği,
       24.08.2026 — 1478px sınırı kaldırıldı). */
    var govde = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }
    });
    kap.appendChild(govde);

    govde.appendChild(tarihSeridi(d));

    if (!veriVarMi()) {
      govde.appendChild(bosDurumPaneli(d));
      return;
    }

    d.tumSatirlar = YU.stok.tumMalzemeler(YU.db, d.tarih);
    d.silolar = YU.stok.tumSilolar(YU.db, d.tarih);

    for (i = 0; i < d.tumSatirlar.length; i++) {
      r = d.tumSatirlar[i];
      if (r.malzeme.Aktif === false && !d.pasifGoster) continue;
      d.satirlar.push(r);
    }

    /* KPI kartları kalktı (kullanıcı isteği, 23.08.2026); tablo en üstte. */
    govde.appendChild(tabloPaneli(d));

    var kontrol = ciftSayimPaneli(d);
    if (kontrol) govde.appendChild(kontrol);
  }

  YU.sayfaTanimla({
    kod: KOD,
    zemin: 'gri-duz',   /* giriş ekranlarıyla aynı: gri zemin, mavi panel */
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

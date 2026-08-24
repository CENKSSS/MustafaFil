/* js/25-gunluk-rapor.js — Günlük Rapor ekranı.
   Şartname §7: "Seçilen günün kuru küspe detayı (ham girdi + net üretim AYRI),
   tüm malzeme ve silo hareketleri." · §7 v2: "Dökme satış ayrı satır."
   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu).
   SÖZLEŞME §6 (UI imzaları), §9 (sınıf adları).

   Dosya yüklenirken hiçbir şey çizmez; yalnızca YU.sayfaTanimla çağırır. */
(function () {
  'use strict';

  var YU = window.YU;

  var TIP = {
    DokmeUretim: { metin: 'Dökme Üretim', tur: 'olumlu' },
    Cuvallama: { metin: 'Çuvallama', tur: 'notr' },
    DokmeSatis: { metin: 'Dökme Satış', tur: 'vurgu' },
    Manuel: { metin: 'Manuel', tur: 'bekleyen' }
  };

  /* Günün İşlem Geçmişi'nde künye boş kalırsa kaydın geldiği ekranın adı
     yazılır; kullanıcı "bu satır nereden geldi" sorusuna cevap bulsun. */
  var KAYIT_KAYNAGI = {
    KuruKuspeGunluk: 'Kuru Küspe Günlük Giriş',
    GunlukHareket: 'Malzeme Girişi',
    SiloHareket: 'Silo Hareketi',
    DevirStok: 'Devir Stok',
    SiloDevirStok: 'Silo Devir Stok',
    Kullanicilar: 'Kullanıcı',
    Malzemeler: 'Malzeme'
  };

  /* ------------------------------------------------------------------
     Yardımcılar
     ------------------------------------------------------------------ */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  /* Gelecek gün seçilemez (kullanıcı direktifi, 24.08.2026): adresle gelen
     ileri tarih bugüne çekilir. */
  function tarihSec(param) {
    var t = param && gecerliTarih(param.tarih) ? param.tarih : YU.tarih.bugun();
    var bugun = YU.tarih.bugun();
    return t > bugun ? bugun : t;
  }

  function kullaniciAdi(depo, id) {
    if (id === null || id === undefined) return null;
    for (var i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].Id === id) {
        return depo.kullanicilar[i].AdSoyad;
      }
    }
    return 'Kullanıcı #' + id;
  }

  function say(v) {
    var n = typeof v === 'number' ? v : Number(v);
    return isFinite(n) ? YU.yuvarla(n) : 0;
  }

  function tipRozeti(tip) {
    var t = TIP[tip];
    return t ? YU.ui.rozet(t.metin, t.tur) : YU.ui.rozet(String(tip || '—'), 'notr');
  }

  function bilgiSatiri(etiket, deger) {
    return YU.h('div', { stil: { display: 'flex', alignItems: 'baseline', gap: '12px' } },
      YU.h('span', { sinif: 'yu-etiket', metin: etiket, stil: { flex: 'none', width: '150px' } }),
      YU.h('span', { sinif: 'yu-guclu', metin: deger })
    );
  }

  /* ------------------------------------------------------------------
     Kuru küspe detayı (Şartname §4, DEMİRBAŞ)
     ------------------------------------------------------------------ */

  /* Şartname §4 "Raporlamada dikkat" — DEMİRBAŞ:
     Durum B'de net dökme üretim 0 görünür, ama operatörün girdiği HAM RAKAM
     kaybolmamalı; raporda AYRI durmalı. İlk akış satırındaki "Üretilen Dökme
     (Ham)" ögesi o kuralın karşılığıdır ve net üretimle asla birleştirilmez.

     Sadeleştirme (kullanıcı isteği, 21.08.2026): satır başına düşen rozet ve
     formül açıklamaları kaldırıldı; rakamlar giriş ekranındaki hesap şeridi
     diliyle (yu-hesap-*) iri ve kalın yazılır, formüller tek dipnota indi. */

  function hesapOge(etiket, deger, tur, ipucu) {
    return YU.h('div', { sinif: 'yu-hesap-oge' + (tur ? ' ' + tur : ''), title: ipucu || null },
      YU.h('div', { sinif: 'yu-hesap-etiket', metin: etiket }),
      YU.h('div', { sinif: 'yu-hesap-deger', metin: deger })
    );
  }

  function hesapIsareti(m) {
    return YU.h('div', { sinif: 'yu-hesap-ok', metin: m, 'aria-hidden': 'true' });
  }

  function akisSatiri(ogeler, sutunAraligi) {
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'flex-end', columnGap: (sutunAraligi || 18) + 'px', rowGap: '12px', flexWrap: 'wrap' }
    }, ogeler);
  }

  /* GÜNÜN ÖZETİ — sayfanın ilk paneli (kullanıcı seçimi, 21.08.2026):
     günün üç sonuç rakamı iri ve renkli; tarih ve ±1 gün okları burada.
     Ayrıntının matematiği aşağıdaki Kuru Küspe Detayı'nda durur. */
  function gununOzeti(hesap, tarih) {
    function tarihOku(geri) {
      var hedef = YU.tarih.ekle(tarih, geri ? -1 : 1);
      var ipucu = (geri ? '−1 Gün · ' : '+1 Gün · ') + YU.fmt.tarih(hedef);
      var NS = 'http://www.w3.org/2000/svg';
      var sv = document.createElementNS(NS, 'svg');
      sv.setAttribute('width', '26'); sv.setAttribute('height', '26');
      sv.setAttribute('viewBox', '0 0 24 24'); sv.setAttribute('aria-hidden', 'true');
      var yolEl = document.createElementNS(NS, 'path');
      yolEl.setAttribute('d', 'M9 6l6 6-6 6');
      yolEl.setAttribute('fill', 'none');
      yolEl.setAttribute('stroke', 'currentColor');
      yolEl.setAttribute('stroke-width', '2.6');
      yolEl.setAttribute('stroke-linecap', 'round');
      yolEl.setAttribute('stroke-linejoin', 'round');
      sv.appendChild(yolEl);
      if (geri) sv.style.transform = 'rotate(180deg)';
      var d = YU.h('button', {
        tip: 'button', sinif: 'yu-satir-eylem',
        title: ipucu, 'aria-label': ipucu,
        stil: { color: 'var(--metin-2)', padding: '4px' },
        onClick: function () { YU.git('gunluk-rapor', { tarih: hedef }); }
      }, sv);
      /* Bugünden ileri gidilemez (gelecek gün seçilemez). */
      if (!geri && hedef > YU.tarih.bugun()) {
        d.disabled = true;
        d.title = 'Bugünden sonrası için rapor olmaz';
        d.setAttribute('aria-label', 'Bugünden sonrası için rapor olmaz');
        d.style.opacity = '.35';
        d.style.cursor = 'default';
      }
      d.addEventListener('mouseenter', function () { d.style.color = 'var(--vurgu)'; });
      d.addEventListener('mouseleave', function () { d.style.color = 'var(--metin-2)'; });
      return d;
    }

    var tarihBlok = YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' } },
      tarihOku(true),
      YU.h('div', { stil: { textAlign: 'center' } },
        YU.h('div', {
          stil: { font: '650 26px/1.1 var(--sayi)', letterSpacing: '-.02em',
                  fontVariantNumeric: 'tabular-nums', color: 'var(--metin)' },
          metin: YU.fmt.tarih(tarih)
        }),
        YU.h('div', {
          stil: { font: '500 15px/1.5 var(--font)', color: 'var(--metin-4)' },
          metin: YU.fmt.gunAdi(tarih)
        })
      ),
      tarihOku(false)
    );

    var fark = hesap.siloNetDegisim;
    /* Rakamlar biraz küçüldü, panel biraz sıkılaştı (kullanıcı isteği,
       24.08.2026): 30px -> 26px, etiket-değer arası 7px -> 5px. */
    function iriOge(etiket, deger, renk) {
      return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '0' } },
        YU.h('div', { sinif: 'yu-hesap-etiket', metin: etiket }),
        YU.h('div', {
          stil: { font: '650 26px/1 var(--sayi)', letterSpacing: '-.02em',
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  color: renk || 'var(--metin)' },
          metin: deger
        })
      );
    }

    var panel = YU.ui.panel({
      baslik: 'Günün Özeti',
      ikon: '#ic-chart',
      sag: tarihBlok,
      govde: YU.h('div', {
        stil: { display: 'flex', alignItems: 'flex-end', columnGap: '36px', rowGap: '10px', flexWrap: 'wrap' }
      },
        iriOge('Net Dökme Üretim', YU.fmt.kgU(hesap.netDokmeUretim), 'var(--vurgu)'),
        iriOge('Dökme Satış', YU.fmt.kgU(hesap.satilanDokme)),
        iriOge('Silo Net Değişimi',
          (fark > 0 ? '+' : fark < 0 ? '−' : '') + YU.fmt.kgU(Math.abs(fark)),
          fark > 0 ? 'var(--olumlu)' : (fark < 0 ? 'var(--olumsuz)' : null))
      )
    });
    /* Yalnız bu panel örneği sıkılaştı — shared .yu-panel/.yu-panel-bas
       diğer tüm ekranlarda kullanıldığı için sınıf değil, örnek düzeyinde
       inline geçersiz kılma (KURAL 5.1: başka ekrana yayılmaz). */
    panel.style.padding = '11px 16px';
    var bas = panel.querySelector('.yu-panel-bas');
    if (bas) bas.style.marginBottom = '8px';
    return panel;
  }

  function kuruKuspePaneli(kk, hesap) {
    var ham = hesap.hamUretilenDokme;
    var adet = say(kk.CuvalAdet);
    var fark = hesap.siloNetDegisim;
    var durumB = hesap.durum === 'B';

    /* 1. satır — operatörün girdiği ham değerler. Satılan dökme burada
       TEKRARLANMAZ; hesap satırında tek kez görünür (vurgu düzeltmesi).
       Üç kalem sıkışık duruyordu; aralık büyütüldü (kullanıcı isteği,
       24.08.2026) — yalnız bu satır, "hesaplanan" satırı 18px'te kaldı. */
    var girilen = akisSatiri([
      hesapOge('Üretilen Dökme · Ham', YU.fmt.kgU(ham), null,
        'İşletme raporundan gelen ham rakam — net üretim 0 olsa bile burada durur (Şartname §4).'),
      hesapOge('Çuvallanan', YU.fmt.sayi(adet) + ' adet', null,
        '1 çuval = ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg (sabit).'),
      hesapOge('Çuval Karşılığı', YU.fmt.kgU(hesap.cuvalKg), null,
        YU.fmt.sayi(adet) + ' × ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg')
    ], 40);

    /* 2. satır — sistemin hesabı; önemli sonuçlar renkle vurgulanır */
    var hesaplanan = akisSatiri([
      hesapOge('Net Dökme Üretim', YU.fmt.kgU(hesap.netDokmeUretim), 'vurgu',
        'max(0; ham − çuval karşılığı) → silolara yerleşir'),
      hesapIsareti('−'),
      hesapOge('Silodan Çekilen', YU.fmt.kgU(hesap.silodanCekilecek),
        hesap.silodanCekilecek > 0 ? 'bekleyen' : null,
        'max(0; çuval karşılığı − ham) → çuvallama için silodan çıkar'),
      hesapIsareti('−'),
      hesapOge('Satılan Dökme', YU.fmt.kgU(hesap.satilanDokme), null,
        'Silo çekişleriyle birebir karşılanır (D13).'),
      hesapIsareti('='),
      hesapOge('Silo Net Değişimi',
        (fark > 0 ? '+' : fark < 0 ? '−' : '') + YU.fmt.kgU(Math.abs(fark)),
        fark > 0 ? 'olumlu' : (fark < 0 ? 'olumsuz' : null),
        'Gün sonunda siloların toplamına net etki.')
    ]);

    return YU.ui.panel({
      baslik: 'Kuru Küspe Detayı',
      ikon: '#ic-doc',
      sag: YU.ui.rozet(
        durumB ? 'Durum B · Çuvallama > Üretim' : 'Durum A · Üretim ≥ Çuvallama',
        durumB ? 'bekleyen' : 'olumlu'
      ),
      govde: [
        durumB ? YU.ui.serit({
          tur: 'uyari',
          baslik: 'Durum B — Net Dökme Üretim 0 Görünür',
          metin: 'O gün çuvallanan (' + YU.fmt.kgU(hesap.cuvalKg) + '), üretilenden (' +
            YU.fmt.kgU(hesap.hamUretilenDokme) + ') fazla. Eksik ' +
            YU.fmt.kgU(hesap.silodanCekilecek) + ' silolardan çekilir. ' +
            'Operatörün girdiği ham rakam ilk satırda ayrıca durur (Şartname §4).'
        }) : null,
        YU.h('div', { sinif: 'yu-etiket', metin: 'Girilen' }),
        girilen,
        YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }),
        /* Formüller görünür satır olmaktan çıktı; etiketin ipucunda durur. */
        YU.h('div', {
          sinif: 'yu-etiket', metin: 'Hesaplanan',
          title: 'Çuval karşılığı = adet × ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) +
            ' kg · net üretim = max(0; ham − çuval karşılığı) · silodan çekilen = ' +
            'max(0; çuval karşılığı − ham) — Şartname §4'
        }),
        hesaplanan
      ]
    });
  }

  /* Kaynak bilgisi ikincildir: rozet yerine soluk metin (sadelik, 21.08.2026). */
  function malzemeKaynagi(malzeme) {
    if (!malzeme) return YU.ui.rozet('Malzeme Bulunamadı', 'olumsuz');
    var metin = malzeme.OzelTip === 'DokmeKuruKuspe' ? 'Otomatik · kuru küspe girişi'
      : malzeme.OzelTip === 'CuvalKuruKuspe' ? 'Üretim otomatik · satış elle'
      : 'Elle girildi';
    return YU.h('span', { sinif: 'yu-zayif', metin: metin });
  }

  /* Kim, saat kaçta — son dokunan (güncelleyen yoksa oluşturan); gün
     yazılmaz, ekran zaten tek güne ait (kullanıcı isteği, 21.08.2026). */
  function kaydedenMetni(depo, h) {
    if (!h) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    var id = h.GuncelleyenKullaniciId !== null && h.GuncelleyenKullaniciId !== undefined
      ? h.GuncelleyenKullaniciId : h.OlusturanKullaniciId;
    var an = h.GuncellemeTarihi || h.OlusturmaTarihi;
    var ad = kullaniciAdi(depo, id);
    var saat = an ? YU.fmt.saat(an) : '—';
    if (!ad && saat === '—') return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    return YU.h('span', { sinif: 'yu-zayif', metin: (ad || '—') + (saat !== '—' ? ' · ' + saat : '') });
  }

  /* Malzeme satırları da günlük değişim diliyle okunur (kullanıcı isteği,
     24.08.2026): gün başı stok, +üretim, −satış, gün sonu stok.
     Gün sonu = güne KADAR mevcut (Tarih <= gün, Şartname §5); gün başı ondan
     o günün üretim/satışı geri alınarak bulunur. Dökme kuru küspe İSTİSNA:
     mevcudu silo toplamı olduğu için başı/sonu silo özetinden gelir —
     Durum B'de çuvallama çekişi basit formülü yanıltırdı. */
  function malzemePaneli(depo, ozet, tarih, siloOzet) {
    var satirlar = [], i, s;
    for (i = 0; i < ozet.malzemeSatirlari.length; i++) {
      s = ozet.malzemeSatirlari[i];

      /* İade stoğu üretim gibi artırır ama ayrı sayılır (kullanıcı direktifi,
         24.08.2026) — gün başı köprüsünde o da geri alınır. */
      var iade = Number(s.hareket && s.hareket.Iade) || 0;

      var basi = null, sonu = null;
      if (s.malzeme && s.malzeme.OzelTip === 'DokmeKuruKuspe') {
        basi = siloOzet.toplam.basi;
        sonu = siloOzet.toplam.sonu;
      } else if (s.malzeme) {
        sonu = Number(YU.stok.malzemeStok(depo, s.malzeme.Id, tarih).mevcut) || 0;
        basi = YU.yuvarla(sonu - (Number(s.uretim) || 0) - iade + (Number(s.satis) || 0));
      }

      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: s.malzeme ? s.malzeme.Ad : ('Malzeme #' + s.hareket.MalzemeId) }),
        basi === null ? YU.h('span', { sinif: 'yu-zayif', metin: '—' }) : YU.fmt.kg(basi),
        s.uretim > 0 ? '+' + YU.fmt.kg(s.uretim) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
        iade > 0 ? '+' + YU.fmt.kg(iade) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
        s.satis > 0 ? '−' + YU.fmt.kg(s.satis) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
        sonu === null
          ? YU.h('span', { sinif: 'yu-zayif', metin: '—' })
          : YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(sonu) }),
        malzemeKaynagi(s.malzeme),
        kaydedenMetni(depo, s.hareket)
      ]);
    }

    var tablo = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Malzeme' },
        { baslik: 'Gün Başı', hiza: 'sag', mono: true, genislik: 122 },
        { baslik: 'Üretim', hiza: 'sag', mono: true, genislik: 108 },
        { baslik: 'İade', hiza: 'sag', mono: true, genislik: 100 },
        { baslik: 'Satış', hiza: 'sag', mono: true, genislik: 108 },
        { baslik: 'Gün Sonu', hiza: 'sag', mono: true, genislik: 122 },
        { baslik: 'Kaynak', genislik: 180 },
        { baslik: 'Kaydeden', genislik: 165 }
      ],
      satirlar: satirlar,
      bos: 'Bu gün için malzeme hareketi yazılmamış.',
      yapiskan: true
    });
    /* Kaydeden sütunu YAZDIRMADA görünmez (kullanıcı isteği, 24.08.2026);
       ekranda durur. Sınıf tema.css'teki @media print kuralı içindir. */
    tablo.className += ' yu-yazdirmada-kaydedensiz';

    return YU.ui.panel({
      baslik: 'Malzeme Günlük Değişimi',
      ikon: '#ic-pencil',
      sag: YU.h('span', { metin: YU.fmt.sayi(ozet.malzemeSatirlari.length) + ' satır' }),
      govde: tablo
    });
  }

  /* ------------------------------------------------------------------
     Silo günlük değişimi + hareket dökümü

     Rapor "günlük değişim" diliyle kurulur (kullanıcı isteği, 24.08.2026):
     her silo için gün başı kaçtı, o gün kaç eklendi, kaç çıktı, gün sonu
     kaç oldu — tek bakışta. Hareket dökümü ALTINDA durmaya devam eder;
     Şartname §7 "tüm silo hareketleri" DEMİRBAŞ, kaldırılamaz.
     ------------------------------------------------------------------ */

  /* Silo başına günün toplamı. TÜM aktif silolar listelenir: hareketi
     olmayan silo da "değişmedi" bilgisiyle görünür — stok raporu, yalnız
     hareket listesi değil. Pasif silo ancak o gün hareketi varsa girer. */
  function siloGunlukOzet(depo, ozet, tarih) {
    var toplamlar = {}, i, h, o;
    for (i = 0; i < ozet.siloHareketleri.length; i++) {
      h = ozet.siloHareketleri[i].hareket;
      o = toplamlar[h.SiloId] || (toplamlar[h.SiloId] = { giren: 0, cikan: 0 });
      o.giren = YU.yuvarla(o.giren + say(h.GirenKg));
      o.cikan = YU.yuvarla(o.cikan + say(h.CikanKg));
    }

    var silolar = (depo.silolar || []).slice();
    silolar.sort(function (a, b) {
      var x = Number(a.Sira) || 0, y = Number(b.Sira) || 0;
      return x !== y ? x - y : (a.Id || 0) - (b.Id || 0);
    });

    var liste = [], toplam = { basi: 0, giren: 0, cikan: 0, sonu: 0 };
    for (i = 0; i < silolar.length; i++) {
      var s = silolar[i];
      o = toplamlar[s.Id] || { giren: 0, cikan: 0 };
      if (s.Aktif === false && !o.giren && !o.cikan) continue;
      var basi = YU.stok.siloGunBasi(depo, s.Id, tarih);
      var sonu = YU.yuvarla(basi + o.giren - o.cikan);
      liste.push({ silo: s, basi: basi, giren: o.giren, cikan: o.cikan, sonu: sonu });
      toplam.basi = YU.yuvarla(toplam.basi + basi);
      toplam.giren = YU.yuvarla(toplam.giren + o.giren);
      toplam.cikan = YU.yuvarla(toplam.cikan + o.cikan);
      toplam.sonu = YU.yuvarla(toplam.sonu + sonu);
    }
    return { liste: liste, toplam: toplam };
  }

  /* Net değişim hücresi: +X yeşil, −X kırmızı, 0 soluk "değişmedi". */
  function netHucre(net) {
    if (net > 0) return YU.h('span', { stil: { color: 'var(--olumlu)' }, metin: '+' + YU.fmt.kg(net) });
    if (net < 0) return YU.h('span', { stil: { color: 'var(--olumsuz)' }, metin: '−' + YU.fmt.kg(Math.abs(net)) });
    return YU.h('span', { sinif: 'yu-zayif', metin: 'değişmedi' });
  }

  function siloDegisimPaneli(siloOzet) {
    var satirlar = [], i, s;
    for (i = 0; i < siloOzet.liste.length; i++) {
      s = siloOzet.liste[i];
      satirlar.push({
        vurgu: s.sonu < 0 ? 'olumsuz' : null,
        hucreler: [
          YU.h('span', { sinif: 'yu-guclu', metin: s.silo.Ad }),
          YU.fmt.kg(s.basi),
          s.giren > 0 ? '+' + YU.fmt.kg(s.giren) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
          s.cikan > 0 ? '−' + YU.fmt.kg(s.cikan) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
          netHucre(YU.yuvarla(s.giren - s.cikan)),
          s.sonu < 0
            ? YU.ui.rozet(YU.fmt.kg(s.sonu), 'olumsuz')
            : YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(s.sonu) })
        ]
      });
    }
    if (satirlar.length > 1) {
      var t = siloOzet.toplam;
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: 'Toplam' }),
        YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(t.basi) }),
        t.giren > 0 ? YU.h('span', { sinif: 'yu-guclu', metin: '+' + YU.fmt.kg(t.giren) }) : '—',
        t.cikan > 0 ? YU.h('span', { sinif: 'yu-guclu', metin: '−' + YU.fmt.kg(t.cikan) }) : '—',
        netHucre(YU.yuvarla(t.giren - t.cikan)),
        YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(t.sonu) })
      ]);
    }

    return YU.ui.panel({
      baslik: 'Silo Günlük Değişimi',
      ikon: '#ic-building',
      sag: YU.h('span', { metin: YU.fmt.sayi(siloOzet.liste.length) + ' silo' }),
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Silo', genislik: 140 },
          { baslik: 'Gün Başı', hiza: 'sag', mono: true, genislik: 150 },
          { baslik: 'Eklenen', hiza: 'sag', mono: true, genislik: 140 },
          { baslik: 'Çıkan', hiza: 'sag', mono: true, genislik: 140 },
          { baslik: 'Net Değişim', hiza: 'sag', mono: true, genislik: 150 },
          { baslik: 'Gün Sonu', hiza: 'sag', mono: true, genislik: 150 }
        ],
        satirlar: satirlar,
        bos: 'Tanımlı silo yok.'
      })
    });
  }

  function siloPaneli(depo, ozet, tarih) {
    var gunBasi = {}, gunSonu = {}, i, h, id;

    /* Gün başı mevcut: Tarih < tarih (o gün henüz sayılmaz — Şartname §5).
       Gün sonu, o günün hareketleri işlendikten sonraki bakiyedir. */
    for (i = 0; i < ozet.siloHareketleri.length; i++) {
      h = ozet.siloHareketleri[i].hareket;
      id = h.SiloId;
      if (!Object.prototype.hasOwnProperty.call(gunBasi, id)) {
        gunBasi[id] = YU.stok.siloGunBasi(depo, id, tarih);
        gunSonu[id] = gunBasi[id];
      }
      gunSonu[id] = YU.yuvarla(gunSonu[id] + say(h.GirenKg) - say(h.CikanKg));
    }

    var satirlar = [];
    for (i = 0; i < ozet.siloHareketleri.length; i++) {
      h = ozet.siloHareketleri[i].hareket;
      id = h.SiloId;
      satirlar.push({
        vurgu: gunSonu[id] < 0 ? 'olumsuz' : null,
        hucreler: [
          YU.h('span', { sinif: 'yu-guclu', metin: ozet.siloHareketleri[i].silo ? ozet.siloHareketleri[i].silo.Ad : ('Silo #' + id) }),
          tipRozeti(h.HareketTipi),
          say(h.GirenKg) > 0 ? YU.fmt.kg(h.GirenKg) : '—',
          say(h.CikanKg) > 0 ? YU.fmt.kg(h.CikanKg) : '—',
          YU.fmt.kg(gunBasi[id]),
          gunSonu[id] < 0
            ? YU.ui.rozet(YU.fmt.kg(gunSonu[id]), 'olumsuz')
            : YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(gunSonu[id]) })
        ]
      });
    }

    return YU.ui.panel({
      baslik: 'Silo Hareketleri',
      ikon: '#ic-building',
      /* "Silo Durumu" düğmesi kaldırıldı (kullanıcı isteği, 24.08.2026);
         ekrana sol menüden gidilir. */
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Silo', genislik: 120 },
          { baslik: 'Tip', genislik: 140 },
          { baslik: 'Giren', hiza: 'sag', mono: true, genislik: 110 },
          { baslik: 'Çıkan', hiza: 'sag', mono: true, genislik: 110 },
          { baslik: 'Gün Başı', hiza: 'sag', mono: true, genislik: 125 },
          { baslik: 'Gün Sonu', hiza: 'sag', mono: true, genislik: 125 }
        ],
        satirlar: satirlar,
        bos: 'Bu gün için silo hareketi yazılmamış.',
        yapiskan: true
      })
    });
  }

  /* ------------------------------------------------------------------
     Kayıt bilgisi (Şartname §6 — denetim izi)
     ------------------------------------------------------------------ */

  function kunyeCifti(etiket, deger, kalin) {
    return YU.h('span', { stil: { display: 'inline-flex', alignItems: 'baseline', gap: '7px', whiteSpace: 'nowrap' } },
      YU.h('span', { sinif: 'yu-etiket', metin: etiket }),
      YU.h('span', { sinif: kalin === false ? '' : 'yu-guclu', metin: deger })
    );
  }

  /* Beş uzun bilgi satırı yerine tek satırlık künye çubuğu (sadelik,
     21.08.2026): kim ne zaman — kalın; teknik ayrıntı sonda soluk. */
  function kayitPaneli(depo, ozet) {
    var adaylar = [], i;
    if (ozet.kuruKuspe) adaylar.push(ozet.kuruKuspe);
    for (i = 0; i < ozet.malzemeSatirlari.length; i++) adaylar.push(ozet.malzemeSatirlari[i].hareket);

    /* "Son İşlem" ekleme DAHİL son dokunuşu gösterir (kullanıcı isteği,
       21.08.2026): 18:36'da yeni satır ekleyen de sayılır, yalnız güncelleme
       değil. */
    var olusturan = null, sonAn = null, sonKisi = null;
    for (i = 0; i < adaylar.length; i++) {
      var k = adaylar[i];
      if (k.OlusturmaTarihi && (!olusturan || k.OlusturmaTarihi < olusturan.OlusturmaTarihi)) olusturan = k;
      var an = k.GuncellemeTarihi || k.OlusturmaTarihi;
      if (an && (!sonAn || an > sonAn)) {
        sonAn = an;
        sonKisi = k.GuncellemeTarihi ? k.GuncelleyenKullaniciId : k.OlusturanKullaniciId;
      }
    }

    var ogeler = [
      kunyeCifti('Oluşturan', olusturan
        ? (kullaniciAdi(depo, olusturan.OlusturanKullaniciId) || '—') + ' · ' + YU.fmt.tarihSaat(olusturan.OlusturmaTarihi)
        : '—'),
      kunyeCifti('Son İşlem', sonAn
        ? (kullaniciAdi(depo, sonKisi) || '—') + ' · ' + YU.fmt.tarihSaat(sonAn)
        : '—')
    ];
    ogeler.push(kunyeCifti('Kayıt',
      (ozet.kuruKuspe ? '1 kuru küspe · ' : '') +
      YU.fmt.sayi(ozet.malzemeSatirlari.length) + ' malzeme · ' +
      YU.fmt.sayi(ozet.siloHareketleri.length) + ' silo hareketi', false));

    return YU.ui.panel({
      baslik: 'Kayıt Bilgisi',
      ikon: '#ic-users',
      govde: YU.h('div', {
        stil: { display: 'flex', alignItems: 'baseline', columnGap: '26px', rowGap: '10px', flexWrap: 'wrap' }
      }, ogeler)
    });
  }

  /* ------------------------------------------------------------------
     Günün İşlem Geçmişi — adım adım denetim izi (kullanıcı isteği,
     21.08.2026): bu günün verisine dokunan HER işlem kronolojik sırayla,
     kim / saat kaçta / neyi hangi değerden hangi değere çevirdi.
     Kaynak: DegisiklikLog (Şartname §6 v2). Örnek verinin çoğu gününde
     boştur — tohumlama denetim izi bırakmaz; gerçek kullanımda dolar.
     ------------------------------------------------------------------ */

  function metindenIso(t) {
    var m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(t || ''));
    return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
  }

  /* Log satırının hangi GÜNÜN verisini değiştirdiğini çözer. Silmelerde
     kayıt artık depoda olmadığı için önce özet metindeki tarihe bakılır. */
  function logGunu(depo, l) {
    function bul(dizi) {
      for (var j = 0; j < dizi.length; j++) if (dizi[j].Id === l.KayitId) return dizi[j];
      return null;
    }
    var tablolar = { KuruKuspeGunluk: depo.kuruKuspeGunluk, GunlukHareket: depo.gunlukHareket, SiloHareket: depo.siloHareket };
    if (!tablolar[l.Tablo]) return null;   /* devir/tanım değişiklikleri gün raporuna girmez */
    if (l.Islem === 'Sil') {
      return metindenIso(l.EskiDeger) || metindenIso(l.YeniDeger);
    }
    var r = bul(tablolar[l.Tablo]);
    if (r && r.Tarih) return String(r.Tarih).slice(0, 10);
    return metindenIso(l.YeniDeger) || metindenIso(l.EskiDeger);
  }

  var ISLEM_RENGI = { Ekle: 'olumlu', Guncelle: 'bekleyen', Sil: 'olumsuz' };
  var ISLEM_ADI = { Ekle: 'Ekle', Guncelle: 'Güncelle', Sil: 'Sil' };

  /* Gün içinde tekrar eden tarih parçalarını ayıklar (rapor zaten tek güne ait). */
  function gunTarihsiz(metin, tarih) {
    return String(metin || '')
      .split(' · ').filter(function (p) { return !/^\d{2}\.\d{2}\.\d{4}$/.test(p.trim()); }).join(' · ')
      .replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  /* Değerler tablolardaki gibi kalın/mono vurgulanır (kullanıcı isteği,
     21.08.2026): eski değer KIRMIZI, yeni değer YEŞİL; Ekle özetindeki
     sayılar yeşil, Sil özetindekiler kırmızı. */
  function bosDeger(v) { return v === null || v === undefined || v === ''; }

  function vurguluDeger(v, renk) {
    return YU.h('span', {
      metin: bosDeger(v) ? '—' : String(v),
      stil: {
        fontFamily: 'var(--sayi)', fontWeight: '700',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        color: renk
      }
    });
  }

  /* Serbest özet metnindeki sayı parçalarını (birimiyle) vurgular. */
  function sayiVurgula(metin, renk) {
    var kalan = String(metin), parcalar = [], m;
    var desen = /[+−-]?\d[\d.,]*(?:\s*(?:kg|adet))?/;
    while (kalan.length) {
      m = desen.exec(kalan);
      if (!m) { parcalar.push(kalan); break; }
      if (m.index > 0) parcalar.push(kalan.slice(0, m.index));
      parcalar.push(vurguluDeger(m[0], renk));
      kalan = kalan.slice(m.index + m[0].length);
    }
    return parcalar;
  }

  /* Değişiklik Geçmişi ekranındaki okuma dili buraya taşındı (kullanıcı
     isteği, 24.08.2026): tek "Ne Yapıldı" cümlesi yerine Kayıt · Ne Değişti ·
     Eski Değer · Yeni Değer kolonları. Artık geçerli olmayan değerin üstü
     çizilidir; sonradan silinen ya da üzerine yazılan adımın künyesinde
     kırmızı ✕ ve rozet durur. */
  function cizili(icerik) {
    return YU.h('span', {
      stil: { textDecoration: 'line-through', textDecorationColor: 'var(--metin-4)' }
    }, icerik);
  }

  function bosHucre() {
    return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
  }

  /* İşlem, raporun gününden BAŞKA bir günde yapılmış olabilir: geçmişe dönük
     düzeltmeler böyledir. Liste işlem zamanına göre sıralandığı için önceki
     akşam yapılmış bir kayıt en üstte durur; yalnız saat yazınca "22:57 neden
     08:28'in üstünde" görünüyordu (kullanıcı geri bildirimi, 24.08.2026).
     Farklı gündeyse saatin altına tarih de yazılır. */
  function zamanHucresi(damga, tarih) {
    var gun = String(damga || '').slice(0, 10);
    var saatH = YU.h('div', { sinif: 'yu-mono', metin: YU.fmt.saat(damga), stil: { whiteSpace: 'nowrap' } });
    if (!gun || gun === tarih) return saatH;
    return YU.h('div', {
      stil: { minWidth: '0' },
      title: 'Bu işlem ' + YU.fmt.tarih(gun) + ' günü yapıldı; etkilediği gün ' + YU.fmt.tarih(tarih) + '.'
    },
      saatH,
      YU.h('div', { sinif: 'yu-yardim', metin: YU.fmt.tarih(gun), stil: { whiteSpace: 'nowrap' } })
    );
  }

  /* Kayıt künyesi: boş kalırsa kaydın geldiği ekranın adı yazılır — kuru
     küspe günlük kaydının künyesi yalnız tarihten oluştuğu için rapor
     içinde boşalıyordu. */
  function kayitHucresi(depo, l, tarih, gecersizlik) {
    var kunye = YU.log.kayitEtiketi(depo, l.Tablo, l.KayitId);
    var metin = kunye ? gunTarihsiz(kunye, tarih) : '';
    if (!metin) metin = KAYIT_KAYNAGI[l.Tablo] || '—';

    var kap = YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' }
    });
    if (gecersizlik) {
      kap.appendChild(YU.h('span', {
        stil: { display: 'flex', flex: 'none', color: 'var(--olumsuz)' },
        title: gecersizlik === 'Silindi'
          ? 'Bu kayıt sonradan silindi — artık yok.'
          : 'Bu adımın üstüne sonradan yazıldı — değerler artık geçerli değil.'
      }, YU.svg('#ic-x', 18)));
    }
    kap.appendChild(YU.h('span', { sinif: 'yu-guclu', metin: metin, stil: { minWidth: '0' } }));
    if (gecersizlik) {
      kap.appendChild(YU.ui.rozet(gecersizlik, gecersizlik === 'Silindi' ? 'olumsuz' : 'bekleyen'));
    }
    return kap;
  }

  function gunIslemGecmisi(depo, tarih) {
    var liste = [], i, l;
    for (i = 0; i < depo.degisiklikLog.length; i++) {
      l = depo.degisiklikLog[i];
      if (logGunu(depo, l) === tarih) liste.push(l);
    }
    /* Adım adım okunur: en eski işlem en üstte, aynı andakiler yazılma sırasında. */
    liste.sort(function (a, b) {
      var x = String(a.Tarih || ''), y = String(b.Tarih || '');
      if (x !== y) return x < y ? -1 : 1;
      return (Number(a.Id) || 0) - (Number(b.Id) || 0);
    });

    /* Sonradan geçersizleşen adımlar işaretlenir (kullanıcı isteği,
       21.08.2026): aynı kaydın üstüne daha sonra yazılmışsa eski adımın
       ayrıntısı ÜSTÜ ÇİZİLİ ama okunur kalır, sağında "Değiştirildi" /
       "Silindi" rozeti durur. Kurallar:
       - sonra aynı kayıt silindiyse                        -> Silindi
       - Ekle'nin kaydına sonra herhangi bir dokunuş        -> Değiştirildi
       - aynı ALANIN daha yeni bir güncellemesi varsa       -> Değiştirildi */
    var gecersiz = [], j, sonra;
    for (i = 0; i < liste.length; i++) {
      l = liste[i];
      if (l.Islem === 'Sil') continue;   /* silme eylemi sonradan geçersizleşmez */
      for (j = i + 1; j < liste.length; j++) {
        sonra = liste[j];
        if (sonra.Tablo !== l.Tablo || sonra.KayitId !== l.KayitId) continue;
        if (sonra.Islem === 'Sil') { gecersiz[i] = 'Silindi'; break; }
        if (l.Islem === 'Ekle') { gecersiz[i] = gecersiz[i] || 'Değiştirildi'; }
        else if (l.Islem === 'Guncelle' && l.Alan && sonra.Alan === l.Alan) { gecersiz[i] = 'Değiştirildi'; }
      }
    }

    var satirlar = [], eskiH, yeniH;
    for (i = 0; i < liste.length; i++) {
      l = liste[i];

      /* Alanlı satırda eski ve yeni değer ayrı kolonlara düşer. Alansız
         satırlarda (kayıt açılışı / silme) özet tek kolona yazılır: silmenin
         özeti eskiye, eklemenin özeti yeniye. */
      if (l.Alan) {
        eskiH = vurguluDeger(l.EskiDeger, 'var(--olumsuz)');
        yeniH = vurguluDeger(l.YeniDeger, 'var(--olumlu)');
      } else if (l.Islem === 'Sil') {
        eskiH = YU.h('span', null, sayiVurgula(gunTarihsiz(l.EskiDeger, tarih), 'var(--olumsuz)'));
        yeniH = bosHucre();
      } else {
        eskiH = bosHucre();
        yeniH = YU.h('span', null, sayiVurgula(gunTarihsiz(l.YeniDeger, tarih), 'var(--olumlu)'));
      }

      /* Eski değer tanımı gereği geçmiş değerdir; sonradan aşılan adımda
         yeni değer de geçerliliğini yitirir. */
      if (!bosDeger(l.EskiDeger)) eskiH = cizili(eskiH);
      if (gecersiz[i] && !bosDeger(l.YeniDeger)) yeniH = cizili(yeniH);

      satirlar.push([
        zamanHucresi(l.Tarih, tarih),
        YU.h('span', { metin: kullaniciAdi(depo, l.KullaniciId) || '—' }),
        YU.ui.rozet(ISLEM_ADI[l.Islem] || l.Islem, ISLEM_RENGI[l.Islem] || 'notr'),
        kayitHucresi(depo, l, tarih, gecersiz[i]),
        l.Alan ? YU.h('span', { metin: l.Alan }) : bosHucre(),
        eskiH,
        yeniH
      ]);
    }

    /* Bu panel BASKIYA GİRMEZ (kullanıcı isteği, 24.08.2026): yazdırılan
       günlük rapor Şartname §7'de tanımlanan içerikle kalsın — o günün kuru
       küspe detayı, malzeme ve silo hareketleri. Denetim izi ekranda kalır.
       Başlıktaki not, kullanıcının çıktıda bu bölümü aramasını önler. */
    var panel = YU.ui.panel({
      baslik: 'Günün İşlem Geçmişi',
      ikon: '#ic-dots',
      sag: YU.h('span', { metin: satirlar.length ? YU.fmt.sayi(satirlar.length) + ' işlem' : null }),
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Saat', genislik: 96 },
          { baslik: 'Kullanıcı', genislik: 160 },
          { baslik: 'İşlem', genislik: 92, hiza: 'orta' },
          { baslik: 'Kayıt', genislik: 260 },
          { baslik: 'Ne Değişti', genislik: 150 },
          { baslik: 'Eski Değer', hiza: 'sag' },
          { baslik: 'Yeni Değer', hiza: 'sag' }
        ],
        satirlar: satirlar,
        bos: 'Bu günün verisine dokunan işlem kaydı yok. (Örnek veri denetim izi bırakmaz; ' +
          'elle yapılan her giriş, düzeltme ve silme burada adım adım listelenir.)'
      })
    });

    panel.className += ' yu-baski-yok';
    var baslikEl = panel.querySelector('.yu-panel-baslik');
    if (baslikEl) {
      baslikEl.appendChild(YU.h('span', {
        metin: '(Yazdırmada Gözükmez)',
        stil: { font: '400 12.5px/1 var(--font)', color: 'var(--metin-4)', marginLeft: '9px' }
      }));
    }
    return panel;
  }

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  function okDugmesi(geri, tarih) {
    var hedef = YU.tarih.ekle(tarih, geri ? -1 : 1);
    /* Bugünden ileri gidilemez (gelecek gün seçilemez). */
    var ileri = !geri && hedef > YU.tarih.bugun();
    var d = YU.ui.dugme({
      ikon: '#ic-chevron', tur: 'ikincil', pasif: ileri,
      baslik: ileri ? 'Bugünden sonrası için rapor olmaz'
        : (geri ? 'Önceki Gün' : 'Sonraki Gün') + ' · ' + YU.fmt.tarih(hedef),
      onClick: function () { YU.git('gunluk-rapor', { tarih: hedef }); }
    });
    if (geri) {
      var s = d.querySelector('svg');
      if (s) s.style.transform = 'rotate(180deg)';   /* ikon seti tek yönlü; ikinci ikon eklenmez */
    }
    return d;
  }

  function ciz(kap, param) {
    var depo = YU.db;
    var tarih = tarihSec(param);
    var ozet = YU.stok.gunOzeti(depo, tarih);

    var tarihAlani = YU.ui.alan({
      tip: 'tarih', deger: tarih, genislik: 158,
      onChange: function () {
        var yeni = tarihAlani.deger();
        if (gecerliTarih(yeni)) YU.git('gunluk-rapor', { tarih: yeni });
      }
    });

    YU.ui.sayfaEylemleri(
      okDugmesi(true, tarih),
      tarihAlani.kok,
      okDugmesi(false, tarih),
      YU.ui.dugme({
        metin: 'Bugün', ikon: '#ic-calendar', tur: 'ikincil',
        onClick: function () { YU.git('gunluk-rapor', { tarih: YU.tarih.bugun() }); }
      }),
      YU.ui.dugme({
        metin: 'Bu Günü Düzenle', ikon: '#ic-pencil', tur: 'ikincil',
        onClick: function () { YU.git('kuru-kuspe', { tarih: tarih }); }
      }),
      YU.ui.dugme({
        metin: 'Yazdır', ikon: '#ic-download', tur: 'birincil',
        onClick: function () { window.print(); }
      })
    );

    var bosGun = !ozet.kuruKuspe && !ozet.malzemeSatirlari.length && !ozet.siloHareketleri.length;
    if (bosGun) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-calendar',
        baslik: YU.fmt.tarih(tarih) + ' için kayıt yok',
        metin: 'Bu güne ait kuru küspe girişi, malzeme hareketi veya silo hareketi bulunamadı.',
        eylemler: [
          YU.ui.dugme({
            metin: 'Bu Günü Gir', ikon: '#ic-plus', tur: 'birincil',
            onClick: function () { YU.git('kuru-kuspe', { tarih: tarih }); }
          }),
          YU.ui.dugme({
            metin: 'Geçmiş Girişler', ikon: '#ic-calendar', tur: 'ikincil',
            onClick: function () { YU.git('gecmis-girisler'); }
          })
        ]
      }));
      return;
    }

    if (ozet.kuruKuspe) {
      /* Günün Özeti kurgusu (kullanıcı seçimi, 21.08.2026): sonuç en üstte. */
      kap.appendChild(gununOzeti(ozet.hesap, tarih));
      kap.appendChild(kuruKuspePaneli(ozet.kuruKuspe, ozet.hesap));
    } else {
      kap.appendChild(YU.ui.serit({
        tur: 'bilgi',
        baslik: 'Bu Gün İçin Kuru Küspe Girişi Yapılmamış',
        metin: 'Aşağıdaki satırlar yalnızca Malzeme Girişi ekranından gelen hareketlerdir.',
        eylem: {
          metin: 'Kuru Küspe Gir', ikon: '#ic-plus',
          onClick: function () { YU.git('kuru-kuspe', { tarih: tarih }); }
        }
      }));
    }

    /* Günlük değişim özeti üstte, hareket dökümleri altında (24.08.2026). */
    var siloOzet = siloGunlukOzet(depo, ozet, tarih);
    kap.appendChild(siloDegisimPaneli(siloOzet));
    kap.appendChild(malzemePaneli(depo, ozet, tarih, siloOzet));
    kap.appendChild(siloPaneli(depo, ozet, tarih));
    /* Denetim izi: günün verisine dokunan her adım — güvenlik kaydı.
       Şartname §7 Değişiklik Geçmişi'ni YÖNETİCİYE ayırır; gün düzeyindeki
       bu alt küme de aynı kurala tabidir (kullanıcı kararı, 21.08.2026). */
    if (YU.yonetici()) kap.appendChild(gunIslemGecmisi(depo, tarih));
    /* Künye tek satır hâlinde EN ALTTA — asıl veriyi aşağı itmesin. */
    kap.appendChild(kayitPaneli(depo, ozet));
  }

  YU.sayfaTanimla({
    kod: 'gunluk-rapor',
    baslik: 'Günlük Rapor',
    ikon: '#ic-doc',
    grup: 'Takip',
    rol: 'Hepsi',
    altBaslik: function (param) {
      var t = tarihSec(param);
      return YU.fmt.tarihUzun(t) + ' · ' + YU.fmt.gunAdi(t) +
        (t === YU.tarih.bugun() ? ' · bugün' : '');
    },
    ciz: ciz
  });
})();

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

  /* ------------------------------------------------------------------
     Yardımcılar
     ------------------------------------------------------------------ */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  function tarihSec(param) {
    return param && gecerliTarih(param.tarih) ? param.tarih : YU.tarih.bugun();
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

  function akisSatiri(ogeler) {
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'flex-end', columnGap: '18px', rowGap: '12px', flexWrap: 'wrap' }
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
    function iriOge(etiket, deger, renk) {
      return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '7px', minWidth: '0' } },
        YU.h('div', { sinif: 'yu-hesap-etiket', metin: etiket }),
        YU.h('div', {
          stil: { font: '650 30px/1 var(--sayi)', letterSpacing: '-.02em',
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  color: renk || 'var(--metin)' },
          metin: deger
        })
      );
    }

    return YU.ui.panel({
      baslik: 'Günün Özeti',
      ikon: '#ic-chart',
      sag: tarihBlok,
      govde: YU.h('div', {
        stil: { display: 'flex', alignItems: 'flex-end', columnGap: '48px', rowGap: '14px', flexWrap: 'wrap' }
      },
        iriOge('Net Dökme Üretim', YU.fmt.kgU(hesap.netDokmeUretim), 'var(--vurgu)'),
        iriOge('Dökme Satış', YU.fmt.kgU(hesap.satilanDokme)),
        iriOge('Silo Net Değişimi',
          (fark > 0 ? '+' : fark < 0 ? '−' : '') + YU.fmt.kgU(Math.abs(fark)),
          fark > 0 ? 'var(--olumlu)' : (fark < 0 ? 'var(--olumsuz)' : null))
      )
    });
  }

  function kuruKuspePaneli(kk, hesap) {
    var ham = hesap.hamUretilenDokme;
    var adet = say(kk.CuvalAdet);
    var fark = hesap.siloNetDegisim;
    var durumB = hesap.durum === 'B';

    /* 1. satır — operatörün girdiği ham değerler. Satılan dökme burada
       TEKRARLANMAZ; hesap satırında tek kez görünür (vurgu düzeltmesi). */
    var girilen = akisSatiri([
      hesapOge('Üretilen Dökme · Ham', YU.fmt.kgU(ham), null,
        'İşletme raporundan gelen ham rakam — net üretim 0 olsa bile burada durur (Şartname §4).'),
      hesapOge('Çuvallanan', YU.fmt.sayi(adet) + ' adet', null,
        '1 çuval = ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg (sabit).'),
      hesapOge('Çuval Karşılığı', YU.fmt.kgU(hesap.cuvalKg), null,
        YU.fmt.sayi(adet) + ' × ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg')
    ]);

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

  function malzemePaneli(depo, ozet) {
    var satirlar = [], i, s;
    for (i = 0; i < ozet.malzemeSatirlari.length; i++) {
      s = ozet.malzemeSatirlari[i];
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: s.malzeme ? s.malzeme.Ad : ('Malzeme #' + s.hareket.MalzemeId) }),
        s.uretim > 0 ? YU.fmt.kg(s.uretim) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
        s.satis > 0 ? YU.fmt.kg(s.satis) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
        malzemeKaynagi(s.malzeme),
        kaydedenMetni(depo, s.hareket)
      ]);
    }

    return YU.ui.panel({
      baslik: 'Malzeme Hareketleri',
      ikon: '#ic-pencil',
      sag: YU.h('span', { metin: YU.fmt.sayi(ozet.malzemeSatirlari.length) + ' satır' }),
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Malzeme' },
          { baslik: 'Üretim', hiza: 'sag', mono: true, genislik: 150 },
          { baslik: 'Satış', hiza: 'sag', mono: true, genislik: 150 },
          { baslik: 'Kaynak', genislik: 220 },
          { baslik: 'Kaydeden', genislik: 190 }
        ],
        satirlar: satirlar,
        bos: 'Bu gün için malzeme hareketi yazılmamış.',
        yapiskan: true
      })
    });
  }

  /* ------------------------------------------------------------------
     Silo hareketleri
     ------------------------------------------------------------------ */

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
      sag: YU.ui.dugme({
        metin: 'Silo Durumu', ikon: '#ic-chart', tur: 'sade', kucuk: true,
        onClick: function () { YU.git('silo-durumu', { tarih: tarih }); }
      }),
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
    if (ozet.kuruKuspe) {
      ogeler.push(kunyeCifti('Sürüm', 'RowVersion ' + YU.fmt.sayi(Number(ozet.kuruKuspe.RowVersion) || 0), false));
    }
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

  function islemAyrintisi(depo, l, tarih) {
    var kunye = YU.log.kayitEtiketi(depo, l.Tablo, l.KayitId);
    var parcalar = [];
    if (kunye) parcalar.push(YU.h('span', { sinif: 'yu-guclu', metin: gunTarihsiz(kunye, tarih) }));
    if (l.Alan) {
      if (parcalar.length) parcalar.push(' — ');
      parcalar.push(l.Alan + ': ');
      parcalar.push(vurguluDeger(l.EskiDeger, 'var(--olumsuz)'));
      parcalar.push(YU.h('span', { sinif: 'yu-zayif', metin: ' → ' }));
      parcalar.push(vurguluDeger(l.YeniDeger, 'var(--olumlu)'));
    } else {
      var ozet = l.Islem === 'Sil' ? l.EskiDeger : l.YeniDeger;
      if (ozet) {
        if (parcalar.length) parcalar.push(' — ');
        parcalar = parcalar.concat(sayiVurgula(gunTarihsiz(ozet, tarih),
          l.Islem === 'Sil' ? 'var(--olumsuz)' : 'var(--olumlu)'));
      }
    }
    if (!parcalar.length) parcalar.push(YU.h('span', { sinif: 'yu-zayif', metin: '—' }));
    return YU.h('span', null, parcalar);
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

    var satirlar = [];
    for (i = 0; i < liste.length; i++) {
      l = liste[i];
      var ayrinti = islemAyrintisi(depo, l, tarih);
      if (gecersiz[i]) {
        ayrinti.style.textDecoration = 'line-through';
        ayrinti.style.textDecorationColor = 'var(--metin-4)';
        ayrinti.style.color = 'var(--metin-4)';
        ayrinti = YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '9px', minWidth: '0' } },
          ayrinti,
          YU.ui.rozet(gecersiz[i], gecersiz[i] === 'Silindi' ? 'olumsuz' : 'bekleyen')
        );
      }
      satirlar.push([
        YU.h('span', { sinif: 'yu-mono', metin: YU.fmt.saat(l.Tarih), stil: { whiteSpace: 'nowrap' } }),
        YU.h('span', { metin: kullaniciAdi(depo, l.KullaniciId) || '—' }),
        YU.ui.rozet(ISLEM_ADI[l.Islem] || l.Islem, ISLEM_RENGI[l.Islem] || 'notr'),
        ayrinti
      ]);
    }

    return YU.ui.panel({
      baslik: 'Günün İşlem Geçmişi',
      ikon: '#ic-dots',
      sag: YU.h('span', { metin: satirlar.length ? YU.fmt.sayi(satirlar.length) + ' işlem' : null }),
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Saat', genislik: 76 },
          { baslik: 'Kullanıcı', genislik: 170 },
          { baslik: 'İşlem', genislik: 96, hiza: 'orta' },
          { baslik: 'Ne Yapıldı' }
        ],
        satirlar: satirlar,
        bos: 'Bu günün verisine dokunan işlem kaydı yok. (Örnek veri denetim izi bırakmaz; ' +
          'elle yapılan her giriş, düzeltme ve silme burada adım adım listelenir.)'
      })
    });
  }

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  function okDugmesi(geri, tarih) {
    var hedef = YU.tarih.ekle(tarih, geri ? -1 : 1);
    var d = YU.ui.dugme({
      ikon: '#ic-chevron', tur: 'ikincil',
      baslik: (geri ? 'Önceki Gün' : 'Sonraki Gün') + ' · ' + YU.fmt.tarih(hedef),
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

    kap.appendChild(malzemePaneli(depo, ozet));
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

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

  function kuruKuspePaneli(kk, hesap, tarih) {
    var ham = hesap.hamUretilenDokme;
    var adet = say(kk.CuvalAdet);
    var fark = hesap.siloNetDegisim;
    var durumB = hesap.durum === 'B';

    /* Günün tarihi panel BAŞLIĞININ ortasında BÜYÜK yazar — eskizdeki
       konumda: iri tarih, altında gün adı (kullanıcı isteği, 21.08.2026). */
    var tarihBlok = YU.h('div', { stil: { margin: '0 auto', textAlign: 'center', flex: 'none' } },
      YU.h('div', {
        stil: { font: '650 26px/1.1 var(--sayi)', letterSpacing: '-.02em',
                fontVariantNumeric: 'tabular-nums', color: 'var(--metin)' },
        metin: YU.fmt.tarih(tarih)
      }),
      YU.h('div', {
        stil: { font: '500 15px/1.5 var(--font)', color: 'var(--metin-4)' },
        metin: YU.fmt.gunAdi(tarih)
      })
    );

    /* 1. satır — operatörün girdiği ham değerler (Girildi) */
    var girilen = akisSatiri([
      hesapOge('Üretilen Dökme · Ham', YU.fmt.kgU(ham), null,
        'İşletme raporundan gelen ham rakam — net üretim 0 olsa bile burada durur (Şartname §4).'),
      hesapOge('Çuvallanan', YU.fmt.sayi(adet) + ' adet', null,
        '1 çuval = ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg (sabit).'),
      hesapOge('Çuval Karşılığı', YU.fmt.kgU(hesap.cuvalKg), null,
        YU.fmt.sayi(adet) + ' × ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg'),
      hesapOge('Satılan Dökme', YU.fmt.kgU(hesap.satilanDokme), null,
        'Doğrudan silodan dökme satış — ayrı kalem (Şartname §7 v2).')
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

    var panel = YU.ui.panel({
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
        YU.h('div', { sinif: 'yu-etiket', metin: 'Hesaplanan' }),
        hesaplanan,
        YU.h('div', {
          sinif: 'yu-yardim',
          metin: 'Çuval karşılığı = adet × ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg' +
            ' · net üretim = max(0; ham − çuval karşılığı) · silodan çekilen = max(0; çuval karşılığı − ham) — Şartname §4. ' +
            'Ayrıntı için değerlerin üzerine gelin.'
        })
      ]
    });

    /* Başlık satırı: [ikon][başlık] … TARİH … [rozet] — başlığın esnemesi
       kapatılır, tarih iki yandan otomatik boşlukla ortalanır. */
    var basEl = panel.querySelector('.yu-panel-bas');
    basEl.querySelector('.yu-panel-baslik').style.flex = 'none';
    basEl.insertBefore(tarihBlok, basEl.querySelector('.yu-panel-sag'));

    return panel;
  }

  /* ------------------------------------------------------------------
     Malzeme hareketleri
     ------------------------------------------------------------------ */

  /* Kilitli kolonlar Şartname §4 ve §7'den gelir: dökme kuru küspenin iki
     kolonu da, çuvallının üretim kolonu da kuru küspe girişinden yazılır. */
  /* Kaynak bilgisi ikincildir: rozet yerine soluk metin (sadelik, 21.08.2026). */
  function malzemeKaynagi(malzeme) {
    if (!malzeme) return YU.ui.rozet('Malzeme Bulunamadı', 'olumsuz');
    var metin = malzeme.OzelTip === 'DokmeKuruKuspe' ? 'Otomatik · kuru küspe girişi'
      : malzeme.OzelTip === 'CuvalKuruKuspe' ? 'Üretim otomatik · satış elle'
      : 'Elle girildi';
    return YU.h('span', { sinif: 'yu-zayif', metin: metin });
  }

  function malzemePaneli(ozet) {
    var satirlar = [], i, s;
    for (i = 0; i < ozet.malzemeSatirlari.length; i++) {
      s = ozet.malzemeSatirlari[i];
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: s.malzeme ? s.malzeme.Ad : ('Malzeme #' + s.hareket.MalzemeId) }),
        s.uretim > 0 ? YU.fmt.kg(s.uretim) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
        s.satis > 0 ? YU.fmt.kg(s.satis) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
        malzemeKaynagi(s.malzeme)
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
          { baslik: 'Kaynak', genislik: 250 }
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

    var olusturan = null, guncelleyen = null;
    for (i = 0; i < adaylar.length; i++) {
      var k = adaylar[i];
      if (k.OlusturmaTarihi && (!olusturan || k.OlusturmaTarihi < olusturan.OlusturmaTarihi)) olusturan = k;
      if (k.GuncellemeTarihi && (!guncelleyen || k.GuncellemeTarihi > guncelleyen.GuncellemeTarihi)) guncelleyen = k;
    }

    var ogeler = [
      kunyeCifti('Oluşturan', olusturan
        ? (kullaniciAdi(depo, olusturan.OlusturanKullaniciId) || '—') + ' · ' + YU.fmt.tarihSaat(olusturan.OlusturmaTarihi)
        : '—'),
      /* "Son güncelleyen": o güne ait herhangi bir satır güncellendiğinde
         dolar — gün düzeyinde bakılır. */
      kunyeCifti('Son Güncelleme', guncelleyen
        ? (kullaniciAdi(depo, guncelleyen.GuncelleyenKullaniciId) || '—') + ' · ' + YU.fmt.tarihSaat(guncelleyen.GuncellemeTarihi)
        : 'Güncellenmemiş')
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

    /* Künye en tepede (kullanıcı isteği, 21.08.2026): kim girdi, kim
       güncelledi — güne bakan ilk onu görür. */
    kap.appendChild(kayitPaneli(depo, ozet));

    if (ozet.kuruKuspe) {
      kap.appendChild(kuruKuspePaneli(ozet.kuruKuspe, ozet.hesap, tarih));
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

    kap.appendChild(malzemePaneli(ozet));
    kap.appendChild(siloPaneli(depo, ozet, tarih));
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

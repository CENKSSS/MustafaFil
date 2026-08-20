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
        return depo.kullanicilar[i].AdSoyad + ' (' + depo.kullanicilar[i].KullaniciAdi + ')';
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
     kaybolmamalı; raporda AYRI BİR SATIR olarak durmalı. Aşağıdaki ilk satır
     (hamUretilenDokme) o kuralın karşılığıdır ve net üretim satırıyla asla
     birleştirilmez. */
  function kuruKuspeSatirlari(kk, hesap) {
    var ham = hesap.hamUretilenDokme;
    var adet = say(kk.CuvalAdet);

    return [
      {
        kalem: 'Üretilen dökme (ham girdi)',
        aciklama: 'İşletme raporundan gelen ham rakam — net üretim 0 olsa bile burada durur.',
        rozet: 'Girildi',
        deger: YU.fmt.kg(ham)
      },
      {
        kalem: 'Çuvallanan Adet',
        aciklama: '1 çuval = ' + YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg (sabit).',
        rozet: 'Girildi',
        deger: YU.fmt.sayi(adet) + ' adet'
      },
      {
        kalem: 'Çuval karşılığı',
        aciklama: YU.fmt.sayi(adet) + ' × ' + YU.fmt.sayi(YU.hesap.CUVAL_KG),
        rozet: 'Hesaplandı',
        deger: YU.fmt.kg(hesap.cuvalKg)
      },
      {
        kalem: 'Net dökme üretim',
        aciklama: 'max(0; ' + YU.fmt.kg(ham) + ' − ' + YU.fmt.kg(hesap.cuvalKg) + ') → silolara yerleşir',
        rozet: 'Hesaplandı',
        deger: YU.fmt.kg(hesap.netDokmeUretim)
      },
      {
        kalem: 'Silodan çekilen (çuvallama)',
        aciklama: 'max(0; ' + YU.fmt.kg(hesap.cuvalKg) + ' − ' + YU.fmt.kg(ham) + ') → silolardan çıkar',
        rozet: 'Hesaplandı',
        deger: YU.fmt.kg(hesap.silodanCekilecek)
      },
      {
        kalem: 'Satılan Dökme',
        aciklama: 'Doğrudan silodan dökme satış — ayrı satır (Şartname §7 v2).',
        rozet: 'Girildi',
        deger: YU.fmt.kg(hesap.satilanDokme)
      },
      {
        kalem: 'Silo net değişimi',
        aciklama: YU.fmt.kg(hesap.netDokmeUretim) + ' − ' + YU.fmt.kg(hesap.silodanCekilecek) +
          ' − ' + YU.fmt.kg(hesap.satilanDokme),
        rozet: 'Hesaplandı',
        deger: YU.fmt.kg(hesap.siloNetDegisim)
      }
    ];
  }

  function kuruKuspePaneli(kk, hesap) {
    var tanimlar = kuruKuspeSatirlari(kk, hesap);
    var satirlar = [], i, t;

    for (i = 0; i < tanimlar.length; i++) {
      t = tanimlar[i];
      satirlar.push([
        YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' } },
          YU.h('span', { sinif: 'yu-guclu', metin: t.kalem }),
          t.rozet === 'Hesaplandı'
            ? YU.ui.rozet('Hesaplandı', 'vurgu')
            : YU.ui.rozet('Girildi', 'notr')
        ),
        YU.h('span', { sinif: 'yu-zayif', metin: t.aciklama }),
        t.deger
      ]);
    }

    var durumB = hesap.durum === 'B';
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
            'Operatörün girdiği ham rakam yukarıdaki ilk satırda ayrıca durur (Şartname §4).'
        }) : null,
        YU.ui.tablo({
          sutunlar: [
            { baslik: 'Kalem', genislik: 280 },
            { baslik: 'Nasıl Bulundu' },
            { baslik: 'Miktar', hiza: 'sag', mono: true, genislik: 160 }
          ],
          satirlar: satirlar
        })
      ]
    });
  }

  /* ------------------------------------------------------------------
     Malzeme hareketleri
     ------------------------------------------------------------------ */

  /* Kilitli kolonlar Şartname §4 ve §7'den gelir: dökme kuru küspenin iki
     kolonu da, çuvallının üretim kolonu da kuru küspe girişinden yazılır. */
  function malzemeKaynagi(malzeme) {
    if (!malzeme) return YU.ui.rozet('Malzeme Bulunamadı', 'olumsuz');
    if (malzeme.OzelTip === 'DokmeKuruKuspe') return YU.ui.rozet('Otomatik · Kuru Küspe Girişi', 'vurgu');
    if (malzeme.OzelTip === 'CuvalKuruKuspe') return YU.ui.rozet('Üretim Otomatik · Satış Elle', 'bekleyen');
    return YU.ui.rozet('Elle Girildi', 'notr');
  }

  function malzemePaneli(ozet) {
    var satirlar = [], i, s;
    for (i = 0; i < ozet.malzemeSatirlari.length; i++) {
      s = ozet.malzemeSatirlari[i];
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: s.malzeme ? s.malzeme.Ad : ('Malzeme #' + s.hareket.MalzemeId) }),
        s.uretim > 0 ? YU.fmt.kg(s.uretim) : '—',
        s.satis > 0 ? YU.fmt.kg(s.satis) : '—',
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
        bos: 'Bu gün için malzeme hareketi yazılmamış.'
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
          gunSonu[id] < 0 ? YU.ui.rozet(YU.fmt.kg(gunSonu[id]), 'olumsuz') : YU.fmt.kg(gunSonu[id])
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
        bos: 'Bu gün için silo hareketi yazılmamış.'
      })
    });
  }

  /* ------------------------------------------------------------------
     Kayıt bilgisi (Şartname §6 — denetim izi)
     ------------------------------------------------------------------ */

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

    var govde = [
      bilgiSatiri('Oluşturan', olusturan ? (kullaniciAdi(depo, olusturan.OlusturanKullaniciId) || '—') : '—'),
      bilgiSatiri('Oluşturma zamanı', olusturan ? YU.fmt.tarihSaat(olusturan.OlusturmaTarihi) : '—'),
      /* "Son güncelleyen": o güne ait herhangi bir satır (kuru küspe ya da
         malzeme hareketi) güncellendiğinde dolar — gün düzeyinde bakılır. */
      bilgiSatiri('Son güncelleyen', guncelleyen ? (kullaniciAdi(depo, guncelleyen.GuncelleyenKullaniciId) || '—') : 'Güncellenmemiş'),
      bilgiSatiri('Son Güncelleme', guncelleyen ? YU.fmt.tarihSaat(guncelleyen.GuncellemeTarihi) : '—')
    ];
    if (ozet.kuruKuspe) {
      govde.push(bilgiSatiri('Kuru küspe sürümü', 'RowVersion ' + YU.fmt.sayi(Number(ozet.kuruKuspe.RowVersion) || 0)));
    }
    govde.push(bilgiSatiri('Kayıt Sayısı',
      (ozet.kuruKuspe ? '1 kuru küspe kaydı · ' : '') +
      YU.fmt.sayi(ozet.malzemeSatirlari.length) + ' malzeme satırı · ' +
      YU.fmt.sayi(ozet.siloHareketleri.length) + ' silo hareketi'));

    return YU.ui.panel({ baslik: 'Kayıt Bilgisi', ikon: '#ic-users', govde: govde });
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

    kap.appendChild(malzemePaneli(ozet));
    kap.appendChild(siloPaneli(depo, ozet, tarih));
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

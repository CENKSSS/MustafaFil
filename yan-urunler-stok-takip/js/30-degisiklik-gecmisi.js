/* js/30-degisiklik-gecmisi.js — Değişiklik Geçmişi (Şartname §7 v2 · SÖZLEŞME §7).
   Kayıt bazında kim, ne zaman, hangi alanı, hangi değerden hangi değere değiştirdi.

   Bu ekran DegisiklikLog tablosunu yalnızca OKUR; hiçbir yazma yapmaz. */
(function () {
  'use strict';

  var YU = window.YU;

  var SAYFA_BOYU = 50;

  var TABLO_ADI = {
    KuruKuspeGunluk: 'Kuru Küspe Günlük',
    GunlukHareket: 'Günlük Hareket',
    SiloHareket: 'Silo Hareketi',
    DevirStok: 'Devir Stok',
    SiloDevirStok: 'Silo Devir Stok',
    Kullanicilar: 'Kullanıcılar',
    Malzemeler: 'Malzemeler'
  };

  var ISLEM_ADI = { Ekle: 'Ekle', Guncelle: 'Güncelle', Sil: 'Sil' };
  var ISLEM_RENGI = { Ekle: 'olumlu', Guncelle: 'bekleyen', Sil: 'olumsuz' };

  /* ==================================================================
     Ortak yardımcılar
     ================================================================== */

  function db() { return YU.db; }

  function tabloAdi(kod) { return TABLO_ADI[kod] || String(kod || '—'); }
  function islemAdi(kod) { return ISLEM_ADI[kod] || String(kod || '—'); }

  function kullaniciAdi(id) {
    if (id === null || id === undefined) return 'Sistem';
    var liste = db().kullanicilar, i;
    for (i = 0; i < liste.length; i++) if (liste[i].Id === id) return liste[i].AdSoyad;
    return 'Silinmiş kullanıcı #' + id;
  }

  function bosDeger(v) { return v === null || v === undefined || v === ''; }

  /* Log değerleri yazılırken TR biçimine çevrilir ("240.000"); sayısal olup
     olmadığı geri okunarak anlaşılır — fark ve yön ancak öyle hesaplanabilir. */
  function sayiOku(v) {
    if (bosDeger(v)) return NaN;
    if (!/^-?[0-9.,]+$/.test(String(v))) return NaN;
    var n = YU.parse.sayi(String(v));
    return isFinite(n) ? n : NaN;
  }

  function sayisalMi(v) { return !isNaN(sayiOku(v)); }

  /* ==================================================================
     Hücre üreticileri
     ================================================================== */

  function degerHucresi(v, alan) {
    if (bosDeger(v)) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    /* Ham log değeri yerine alanın anlamı: durum alanında 'Evet' değil 'Aktif'. */
    var okunur = alan ? YU.log.degerCumlesi(alan, v) : null;
    if (okunur) return YU.h('span', { metin: okunur });
    if (sayisalMi(v)) return YU.h('span', { sinif: 'yu-mono', metin: String(v) });
    return YU.h('span', { metin: String(v) });
  }

  /* Sayısal alanlarda değişimin yönü ok ile, büyüklüğü renkli farkla gösterilir. */
  function farkCipi(eski, yeni) {
    var a = sayiOku(eski), b = sayiOku(yeni);
    if (isNaN(a) || isNaN(b)) return null;
    var fark = YU.yuvarla(b - a);
    if (fark === 0) return null;
    var artis = fark > 0;
    return YU.h('span', {
      stil: {
        display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px',
        color: artis ? 'var(--olumlu)' : 'var(--olumsuz)',
        font: '600 13px/1 var(--sayi)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'
      },
      title: (artis ? 'Artış' : 'Azalış') + ': ' + YU.fmt.kg(Math.abs(fark))
    }, YU.svg(artis ? '#ic-up' : '#ic-down', 11),
      YU.h('span', { metin: (artis ? '+' : '−') + YU.fmt.kg(Math.abs(fark)) }));
  }

  function yeniDegerHucresi(satir) {
    var cip = farkCipi(satir.EskiDeger, satir.YeniDeger);
    if (!cip) return degerHucresi(satir.YeniDeger, satir.Alan);
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }
    }, degerHucresi(satir.YeniDeger), cip);
  }

  /* ==================================================================
     Süzme, sıralama, gruplama
     ================================================================== */

  /* Arama metni satırın EKRANDA görünen her şeyini kapsar (kullanıcı isteği,
     21.08.2026): tablo, işlem, kullanıcı, alan, değerler, kayıt no ve künye
     ("Kuru Küspe (50 Kg)", "Silo 3 · Dökme satış" gibi). */
  function aramaMetni(s) {
    var coz = kayitCoz(s.Tablo, s.KayitId);
    var parcalar = [tabloAdi(s.Tablo), islemAdi(s.Islem), s.Islem,
                    kullaniciAdi(s.KullaniciId), s.Alan, s.EskiDeger, s.YeniDeger,
                    kayitEtiketi(s.Tablo, coz.satir)];
    var metin = '', i;
    for (i = 0; i < parcalar.length; i++) {
      if (!bosDeger(parcalar[i])) metin += String(parcalar[i]) + ' ';
    }
    if (s.KayitId !== null && s.KayitId !== undefined) {
      metin += '#' + s.KayitId + ' ' + s.KayitId + ' ';
    }
    metin += YU.fmt.tarihSaat(s.Tarih) + ' ' + String(s.Tarih || '');
    return metin.toLocaleLowerCase('tr');
  }

  /* Binlik ayracına duyarsız karşılaştırma: "1.700" da "1700" de aynı satırı
     bulur. Sayı içindeki nokta/virgül ayraçları atılır, metin bozulmaz. */
  function sayiDuz(t) {
    return String(t).replace(/(\d)[.,](?=\d)/g, '$1');
  }

  /* Boşlukla ayrılan her parça ayrı aranır; hepsi eşleşmeli (VE araması).
     Tek başına sayı olan parça bir önceki kelimeye yapıştırılır: "silo 1"
     tek parça olarak aranır, yoksa "1" her satırdaki rakama takılıyordu ve
     Silo 2–3 satırları da geliyordu (kullanıcı geri bildirimi, 21.08.2026). */
  function aramaParcalari(sorgu) {
    var ham = sorgu.split(/\s+/), parcalar = [], i, p;
    for (i = 0; i < ham.length; i++) {
      p = ham[i];
      if (!p) continue;
      if (/^[0-9]+$/.test(p) && parcalar.length && !/[0-9.,]$/.test(parcalar[parcalar.length - 1])) {
        parcalar[parcalar.length - 1] += ' ' + p;
      } else {
        parcalar.push(p);
      }
    }
    return parcalar;
  }

  function aramaUyar(metin, sorgu) {
    var parcalar = aramaParcalari(sorgu), duz = sayiDuz(metin), i, p;
    for (i = 0; i < parcalar.length; i++) {
      p = parcalar[i];
      if (metin.indexOf(p) < 0 && duz.indexOf(sayiDuz(p)) < 0) return false;
    }
    return true;
  }

  function suzulmus(durum) {
    var liste = db().degisiklikLog, sonuc = [], i, s, gun;
    var q = String(durum.arama || '').trim().toLocaleLowerCase('tr');

    /* Silo süzgeci: seçilen silonun adı satırın künyesinde ya da değer
       metninde geçmeli — "Silo 1" seçiliyken Silo 2–3 satırları elenir
       (kullanıcı isteği, 21.08.2026). */
    var siloAd = '';
    if (durum.silo) {
      var siloListe = db().silolar, j;
      for (j = 0; j < siloListe.length; j++) {
        if (String(siloListe[j].Id) === durum.silo) { siloAd = String(siloListe[j].Ad).toLocaleLowerCase('tr'); break; }
      }
    }

    for (i = 0; i < liste.length; i++) {
      s = liste[i];
      if (durum.tablo && s.Tablo !== durum.tablo) continue;
      if (durum.kullanici && String(s.KullaniciId) !== durum.kullanici) continue;
      if (durum.islem && s.Islem !== durum.islem) continue;
      gun = String(s.Tarih || '').slice(0, 10);
      if (durum.bas && gun < durum.bas) continue;
      if (durum.bit && gun > durum.bit) continue;
      if (siloAd && aramaMetni(s).indexOf(siloAd) < 0) continue;
      if (q && !aramaUyar(aramaMetni(s), q)) continue;
      sonuc.push(s);
    }

    /* En yeni üstte; aynı saniyede yazılanlar Id sırasına göre bitişik kalsın. */
    sonuc.sort(function (a, b) {
      if (a.Tarih !== b.Tarih) return a.Tarih < b.Tarih ? 1 : -1;
      return (b.Id || 0) - (a.Id || 0);
    });
    return sonuc;
  }

  /* Aynı kayıt + aynı saniye = tek işlem. Bitişik satırlar tek gruba toplanır,
     grup kendi içinde yazılma sırasına (Id artan) döndürülür. */
  function gruplandir(liste) {
    var duz = [], grup = null, i, j, s, anahtar;
    var gruplar = [];

    for (i = 0; i < liste.length; i++) {
      s = liste[i];
      anahtar = s.Tablo + '|' + s.KayitId + '|' + s.Tarih;
      if (grup && grup.anahtar === anahtar) grup.satirlar.push(s);
      else { grup = { anahtar: anahtar, satirlar: [s] }; gruplar.push(grup); }
    }

    for (i = 0; i < gruplar.length; i++) {
      gruplar[i].satirlar.sort(function (a, b) { return (a.Id || 0) - (b.Id || 0); });
      for (j = 0; j < gruplar[i].satirlar.length; j++) {
        duz.push({
          satir: gruplar[i].satirlar[j],
          ilk: j === 0,
          boyut: gruplar[i].satirlar.length,
          /* Detay penceresi işlemin tamamını gösterir, tek satırı değil. */
          grup: gruplar[i].satirlar
        });
      }
    }
    return duz;
  }

  /* ==================================================================
     Tablo satırı
     ================================================================== */

  /* ==================================================================
     Kayıt çözümleme — log satırı hangi kaydı işaret ediyor?
     DegisiklikLog yalnız (Tablo, KayitId) tutuyor; "hangi malzeme, hangi gün"
     bilgisi kaydın kendisinde. Detay penceresi için buradan okunuyor.
     ================================================================== */

  var HAREKET_TIPI = {
    DokmeUretim: 'Dökme üretim', Cuvallama: 'Çuvallama',
    DokmeSatis: 'Dökme satış', Manuel: 'Manuel'
  };

  var OZEL_TIP_ADI = {
    DokmeKuruKuspe: 'Dökme kuru küspe', CuvalKuruKuspe: 'Çuvallı kuru küspe'
  };

  /* [alan, ekran adı, biçim] */
  var KAYIT_ALANLARI = {
    KuruKuspeGunluk: [
      ['Tarih', 'Tarih', 'tarih'], ['UretilenDokme', 'Üretilen dökme', 'kg'],
      ['CuvalAdet', 'Çuvallanan adet', 'adet'], ['CuvalKg', 'Çuval karşılığı', 'kg'],
      ['SatilanDokme', 'Satılan dökme', 'kg'], ['RowVersion', 'Sürüm', 'sayi']
    ],
    GunlukHareket: [
      ['Tarih', 'Tarih', 'tarih'], ['MalzemeId', 'Malzeme', 'malzeme'],
      ['Uretim', 'Üretim', 'kg'], ['Satis', 'Satış', 'kg'], ['RowVersion', 'Sürüm', 'sayi']
    ],
    SiloHareket: [
      ['Tarih', 'Tarih', 'tarih'], ['SiloId', 'Silo', 'silo'],
      ['HareketTipi', 'Hareket tipi', 'hareket'], ['GirenKg', 'Giren', 'kg'],
      ['CikanKg', 'Çıkan', 'kg'], ['KaynakKayitId', 'Kaynak kayıt', 'kayit']
    ],
    DevirStok: [
      ['MalzemeId', 'Malzeme', 'malzeme'], ['DevirTarihi', 'Devir tarihi', 'tarih'], ['Miktar', 'Miktar', 'kg']
    ],
    SiloDevirStok: [
      ['SiloId', 'Silo', 'silo'], ['DevirTarihi', 'Devir tarihi', 'tarih'], ['Miktar', 'Miktar', 'kg']
    ],
    Kullanicilar: [
      ['KullaniciAdi', 'Kullanıcı adı', 'metin'], ['AdSoyad', 'Ad soyad', 'metin'],
      ['Rol', 'Rol', 'rol'], ['Aktif', 'Durum', 'aktif']
    ],
    Malzemeler: [
      ['Ad', 'Ad', 'metin'], ['Birim', 'Birim', 'metin'], ['Sira', 'Sıra', 'sayi'],
      ['OzelTip', 'Özel tip', 'ozeltip'], ['Aktif', 'Durum', 'aktif']
    ]
  };

  function malzemeAdi(id) {
    var l = db().malzemeler, i;
    for (i = 0; i < l.length; i++) if (l[i].Id === id) return l[i].Ad;
    return id === null || id === undefined ? '—' : 'Malzeme #' + id;
  }

  function siloAdi(id) {
    var l = db().silolar, i;
    for (i = 0; i < l.length; i++) if (l[i].Id === id) return l[i].Ad;
    return id === null || id === undefined ? '—' : 'Silo #' + id;
  }

  function alanBicimle(tip, v) {
    if (v === null || v === undefined || v === '') return '—';
    if (tip === 'tarih') return YU.fmt.tarih(v);
    if (tip === 'kg') return YU.fmt.kgU(Number(v) || 0);
    if (tip === 'adet') return YU.fmt.sayi(Number(v) || 0) + ' adet';
    if (tip === 'sayi') return YU.fmt.sayi(Number(v) || 0);
    if (tip === 'malzeme') return malzemeAdi(v);
    if (tip === 'silo') return siloAdi(v);
    if (tip === 'hareket') return HAREKET_TIPI[v] || String(v);
    if (tip === 'ozeltip') return OZEL_TIP_ADI[v] || String(v);
    if (tip === 'rol') return v === 'Yonetici' ? 'Yönetici' : 'Operatör';
    if (tip === 'aktif') return v === false ? 'Pasif' : 'Aktif';
    if (tip === 'kayit') return '#' + v;
    return String(v);
  }

  function kayitCoz(tablo, kayitId) {
    var satir = YU.log.kayitBul(db(), tablo, kayitId);
    return { satir: satir, bulundu: !!satir };
  }

  /* Künye ortak çözümleyiciden gelir (04-servis · YU.log.kayitEtiketi). */
  function kayitEtiketi(tablo, satir) {
    return satir ? YU.log.kayitEtiketi(db(), tablo, satir.Id) : null;
  }

  /* O kaydın TÜM log geçmişi — detay penceresindeki zaman çizelgesi. */
  function kayitGecmisi(tablo, kayitId) {
    var l = db().degisiklikLog, sonuc = [], i;
    for (i = 0; i < l.length; i++) {
      if (l[i].Tablo === tablo && l[i].KayitId === kayitId) sonuc.push(l[i]);
    }
    sonuc.sort(function (a, b) { return (b.Id || 0) - (a.Id || 0); });
    return sonuc;
  }

  /* ==================================================================
     Detay penceresi
     ================================================================== */

  function bolumBasligi(metin, sag) {
    return YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: '10px', font: '600 14px/1.2 var(--font)', color: 'var(--metin-3)',
        letterSpacing: '.04em', textTransform: 'uppercase',
        paddingBottom: '8px', borderBottom: '1px solid var(--ayrac)'
      }
    }, YU.h('span', { metin: metin }), sag ? YU.h('span', {
      sinif: 'yu-yardim', metin: sag, stil: { textTransform: 'none', letterSpacing: '0' }
    }) : null);
  }

  function kunyeSatiri(etiket, deger) {
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '14px', padding: '7px 0' }
    },
      YU.h('span', { metin: etiket, stil: { font: '400 14px/1.3 var(--font)', color: 'var(--metin-4)', flex: 'none' } }),
      typeof deger === 'string'
        ? YU.h('span', { metin: deger, stil: { font: '500 14.5px/1.3 var(--font)', textAlign: 'right' } })
        : deger
    );
  }

  function detayAc(oge) {
    var s = oge.satir;
    var grup = oge.grup || [s];
    var coz = kayitCoz(s.Tablo, s.KayitId);
    var etiket = kayitEtiketi(s.Tablo, coz.satir);
    var alanTanimlari = KAYIT_ALANLARI[s.Tablo] || [];
    var gecmis = kayitGecmisi(s.Tablo, s.KayitId);
    var bolumler = [];

    /* 1. Künye */
    var kunye = YU.h('div', { stil: { display: 'flex', flexDirection: 'column' } },
      kunyeSatiri('İşlem', YU.ui.rozet(islemAdi(s.Islem), ISLEM_RENGI[s.Islem] || 'notr')),
      kunyeSatiri('Tablo', tabloAdi(s.Tablo)),
      kunyeSatiri('Kayıt', YU.h('span', {
        sinif: 'yu-mono',
        metin: (s.KayitId === null || s.KayitId === undefined ? '—' : '#' + s.KayitId) +
          (etiket ? '  ·  ' + etiket : '')
      })),
      kunyeSatiri('Kullanıcı', kullaniciAdi(s.KullaniciId)),
      kunyeSatiri('Zaman', YU.fmt.tarihSaat(s.Tarih))
    );
    bolumler.push(YU.h('div', {}, bolumBasligi('Künye'), kunye));

    /* 2. Bu işlemde ne değişti */
    var degisimSatirlari = [], g, gs;
    for (g = 0; g < grup.length; g++) {
      gs = grup[g];
      degisimSatirlari.push([
        YU.h('span', { metin: gs.Alan || (gs.Islem === 'Ekle' ? 'Kayıt açıldı' : (gs.Islem === 'Sil' ? 'Kayıt silindi' : '—')),
          sinif: gs.Alan ? '' : 'yu-zayif' }),
        degerHucresi(gs.EskiDeger, gs.Alan),
        yeniDegerHucresi(gs)
      ]);
    }
    bolumler.push(YU.h('div', {},
      bolumBasligi('Bu işlemde', grup.length + (grup.length > 1 ? ' alan' : ' kalem')),
      YU.ui.tablo({
        sutunlar: [
          { baslik: 'Ne Değişti', genislik: 160 },
          { baslik: 'Eski değer', hiza: 'sag' },
          { baslik: 'Yeni değer', hiza: 'sag' }
        ],
        satirlar: degisimSatirlari, kompakt: true
      })
    ));

    /* 3. Kaydın şu anki hâli */
    var mevcutIcerik;
    if (!coz.bulundu) {
      mevcutIcerik = YU.h('div', {
        sinif: 'yu-yardim',
        metin: s.Islem === 'Sil'
          ? 'Bu kayıt silindi; güncel hâli yok. Yukarıdaki değerler silinmeden önceki son durumdur.'
          : 'Bu kayıt artık veritabanında bulunamıyor (silinmiş olabilir).',
        stil: { padding: '12px 0' }
      });
    } else {
      var mevcutSatirlar = [], a, tanim, deger;
      for (a = 0; a < alanTanimlari.length; a++) {
        tanim = alanTanimlari[a];
        deger = coz.satir[tanim[0]];
        mevcutSatirlar.push([
          YU.h('span', { metin: tanim[1], stil: { color: 'var(--metin-4)' } }),
          YU.h('span', { sinif: /kg|adet|sayi|tarih|kayit/.test(tanim[2]) ? 'yu-mono' : '', metin: alanBicimle(tanim[2], deger) })
        ]);
      }
      mevcutSatirlar.push([
        YU.h('span', { metin: 'Oluşturan', stil: { color: 'var(--metin-4)' } }),
        YU.h('span', { metin: kullaniciAdi(coz.satir.OlusturanKullaniciId) +
          (coz.satir.OlusturmaTarihi ? ' · ' + YU.fmt.tarihSaat(coz.satir.OlusturmaTarihi) : '') })
      ]);
      if (coz.satir.GuncelleyenKullaniciId !== undefined && coz.satir.GuncelleyenKullaniciId !== null) {
        mevcutSatirlar.push([
          YU.h('span', { metin: 'Güncelleyen', stil: { color: 'var(--metin-4)' } }),
          YU.h('span', { metin: kullaniciAdi(coz.satir.GuncelleyenKullaniciId) +
            (coz.satir.GuncellemeTarihi ? ' · ' + YU.fmt.tarihSaat(coz.satir.GuncellemeTarihi) : '') })
        ]);
      }
      mevcutIcerik = YU.ui.tablo({
        /* Bu tablo değişiklik değil, kaydın mevcut alanlarını listeliyor. */
        sutunlar: [{ baslik: 'Bilgi', genislik: 170 }, { baslik: 'Değer', hiza: 'sag' }],
        satirlar: mevcutSatirlar, kompakt: true
      });
    }
    bolumler.push(YU.h('div', {},
      bolumBasligi('Kaydın şu anki hâli', coz.bulundu ? null : 'kayıt yok'),
      mevcutIcerik
    ));

    /* 4. Bu kaydın tüm geçmişi */
    if (gecmis.length > 1) {
      var gecmisSatirlari = [], t;
      for (t = 0; t < gecmis.length; t++) {
        gecmisSatirlari.push([
          YU.h('span', { sinif: 'yu-mono', metin: YU.fmt.tarihSaat(gecmis[t].Tarih), stil: { whiteSpace: 'nowrap' } }),
          YU.ui.rozet(islemAdi(gecmis[t].Islem), ISLEM_RENGI[gecmis[t].Islem] || 'notr'),
          YU.h('span', { metin: kullaniciAdi(gecmis[t].KullaniciId) }),
          YU.h('span', { metin: gecmis[t].Alan || '—', sinif: gecmis[t].Alan ? '' : 'yu-zayif' }),
          degerHucresi(gecmis[t].EskiDeger, gecmis[t].Alan),
          yeniDegerHucresi(gecmis[t])
        ]);
      }
      bolumler.push(YU.h('div', {},
        bolumBasligi('Bu kaydın tüm geçmişi', gecmis.length + ' kayıt'),
        YU.ui.tablo({
          sutunlar: [
            { baslik: 'Zaman', genislik: 140 }, { baslik: 'İşlem', genislik: 88, hiza: 'orta' },
            { baslik: 'Kullanıcı', genislik: 130 }, { baslik: 'Ne Değişti', genislik: 130 },
            { baslik: 'Eski', hiza: 'sag' }, { baslik: 'Yeni', hiza: 'sag' }
          ],
          satirlar: gecmisSatirlari, kompakt: true
        })
      ));
    }

    var govde = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '22px' } });
    for (var b = 0; b < bolumler.length; b++) govde.appendChild(bolumler[b]);

    YU.ui.modal({
      baslik: tabloAdi(s.Tablo) + (etiket ? ' · ' + etiket : ''),
      govde: govde,
      genislik: 720,
      dugmeler: [{ metin: 'Kapat', tur: 'ikincil' }]
    });
  }

  /* Ham alan değişiminin altına okunur karşılığı: "Aktif: Evet → Hayır"
     yerine ne olduğu tek bakışta anlaşılsın. */
  /* Alt cümle kaldırıldı: eski ve yeni değer artık 'Aktif → Pasif' diye
     okunur yazıldığı için tekrar oluyordu. */
  function alanHucresi(s) {
    return YU.h('span', { metin: s.Alan || '—', sinif: s.Alan ? '' : 'yu-zayif' });
  }

  /* Ana listede tarih tekrarını temizler (kullanıcı isteği, 21.08.2026):
     satırın kendi Tarih·Saat sütunu varken künye ve değer metinlerindeki
     GG.AA.YYYY parçaları gösterilmez. Detay penceresi tam metni tarihiyle
     göstermeye devam eder; künyenin tamamı hücre ipucunda durur. */
  function tarihsiz(metin) {
    var m = String(metin).replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)\s*/g, ' ');
    var parcalar = m.split(' · '), tut = [], i;
    for (i = 0; i < parcalar.length; i++) {
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(parcalar[i].trim())) continue;
      tut.push(parcalar[i]);
    }
    return tut.join(' · ').replace(/\s{2,}/g, ' ').trim();
  }

  /* Alanlı satırların değerleri sayıdır, dokunulmaz; alansız özet metinlerde
     tarih parçası ayıklanır. */
  function listeDegerleri(sx) {
    if (sx.Alan) return sx;
    return {
      Alan: sx.Alan,
      EskiDeger: bosDeger(sx.EskiDeger) ? sx.EskiDeger : tarihsiz(sx.EskiDeger),
      YeniDeger: bosDeger(sx.YeniDeger) ? sx.YeniDeger : tarihsiz(sx.YeniDeger)
    };
  }

  /* Liste hücresini tek satıra kilitler: taşan metin üç noktayla kısalır,
     tamamı ipucunda durur — bütün satırlar aynı yükseklikte kalır. */
  function tekSatir(icerik, ipucu) {
    return YU.h('div', {
      stil: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '0' },
      title: ipucu || null
    }, icerik);
  }

  function tabloSatiri(oge) {
    var s = oge.satir;
    var ld = listeDegerleri(s);
    var eskiHucre = tekSatir(degerHucresi(ld.EskiDeger, s.Alan),
      bosDeger(s.EskiDeger) ? null : String(s.EskiDeger));
    var yeniHucre = tekSatir(yeniDegerHucresi(ld),
      bosDeger(s.YeniDeger) ? null : String(s.YeniDeger));

    if (!oge.ilk) {
      /* Devam satırı: tekrar eden künye boş bırakılır, bağ ↳ ile kurulur. */
      return {
        onClick: function () { detayAc(oge); },
        hucreler: [
          YU.h('span', { sinif: 'yu-zayif', metin: '↳', title: 'Aynı işlemin devamı' }),
          '', '', '', '',
          alanHucresi(s),
          eskiHucre,
          yeniHucre
        ]
      };
    }

    /* Künye kayıttan çözülüyor: "#968" tek başına hangi malzemenin hangi
       günü olduğunu söylemiyordu. */
    var cozum = kayitCoz(s.Tablo, s.KayitId);
    var kunye = kayitEtiketi(s.Tablo, cozum.satir);
    var kayitHucresi = YU.h('div', {
      stil: { display: 'flex', alignItems: 'baseline', gap: '7px', minWidth: '0' },
      title: kunye || null
    },
      YU.h('span', {
        sinif: s.KayitId === null || s.KayitId === undefined ? 'yu-zayif' : 'yu-mono',
        stil: { flex: 'none' },
        metin: s.KayitId === null || s.KayitId === undefined ? '—' : '#' + s.KayitId
      }),
      kunye ? YU.h('span', {
        sinif: 'yu-yardim',
        stil: { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        metin: tarihsiz(kunye)
      }) : null,
      oge.boyut > 1
        ? YU.h('span', { sinif: 'yu-yardim', stil: { flex: 'none' }, metin: YU.fmt.sayi(oge.boyut) + ' alan' })
        : null
    );

    return {
      onClick: function () { detayAc(oge); },
      hucreler: [
        YU.h('span', { sinif: 'yu-mono', metin: YU.fmt.tarihSaat(s.Tarih), stil: { whiteSpace: 'nowrap' } }),
        YU.h('span', {
          metin: kullaniciAdi(s.KullaniciId), title: kullaniciAdi(s.KullaniciId),
          stil: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
        }),
        YU.ui.rozet(islemAdi(s.Islem), ISLEM_RENGI[s.Islem] || 'notr'),
        YU.h('span', { metin: tabloAdi(s.Tablo), stil: { whiteSpace: 'nowrap' } }),
        kayitHucresi,
        alanHucresi(s),
        eskiHucre,
        yeniHucre
      ]
    };
  }

  /* ==================================================================
     Sayfa
     ================================================================== */

  YU.sayfaTanimla({
    kod: 'degisiklik-gecmisi',
    baslik: 'Değişiklik Geçmişi',
    altBaslik: function () {
      var d = YU.db;
      if (!d) return '';
      return YU.fmt.sayi(d.degisiklikLog.length) + ' değişiklik kaydı · alan bazında eski ve yeni değer';
    },
    ikon: '#ic-log-clock',
    grup: 'Yönetim',
    rol: 'Yonetici',

    ciz: function (kap) {
      YU.bos(kap);

      /* Yönlendirici zaten yetki kapısı işletiyor; ekran kendi kontrolünü de yapar. */
      if (!YU.yonetici()) {
        kap.appendChild(YU.ui.bosDurum({
          ikon: '#ic-percent',
          baslik: 'Bu ekrana erişim yetkiniz yok.',
          metin: 'Değişiklik Geçmişi yalnızca Yönetici rolüne açıktır.'
        }));
        return;
      }

      if (!db().degisiklikLog.length) {
        kap.appendChild(YU.ui.bosDurum({
          ikon: '#ic-dots',
          baslik: 'Henüz değişiklik kaydı yok.',
          metin: 'Bir günlük giriş kaydedildiğinde, düzeltildiğinde veya bir tanım değiştirildiğinde ' +
            'buraya kim, ne zaman, hangi alanı hangi değerden hangi değere çevirdi bilgisi düşer.',
          eylemler: [
            YU.ui.dugme({
              metin: 'Kuru Küspe Günlük Giriş', ikon: '#ic-plus', tur: 'birincil',
              onClick: function () { YU.git('kuru-kuspe'); }
            })
          ]
        }));
        return;
      }

      var durum = { tablo: '', kullanici: '', islem: '', silo: '', bas: '', bit: '', arama: '', sayfa: 0 };
      var sonucKap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '20px' } });

      kap.appendChild(filtrePaneli(durum, function () { sonuclariCiz(sonucKap, durum); }));
      kap.appendChild(sonucKap);
      sonuclariCiz(sonucKap, durum);
    }
  });

  /* ==================================================================
     Filtre paneli — bir kez kurulur, sonuç alanı yeniden çizilir
     ================================================================== */

  function filtrePaneli(durum, tazele) {
    function degisti() { durum.sayfa = 0; tazele(); }

    var tabloSecenek = [{ deger: '', metin: 'Tümü' }];
    var logTablolari = (YU.log && YU.log.TABLOLAR) || [];
    var i;
    for (i = 0; i < logTablolari.length; i++) {
      tabloSecenek.push({ deger: logTablolari[i], metin: tabloAdi(logTablolari[i]) });
    }

    var kullaniciSecenek = [{ deger: '', metin: 'Tümü' }];
    var kullanicilar = db().kullanicilar;
    for (i = 0; i < kullanicilar.length; i++) {
      kullaniciSecenek.push({
        deger: String(kullanicilar[i].Id),
        metin: kullanicilar[i].AdSoyad + (kullanicilar[i].Aktif === false ? ' (pasif)' : '')
      });
    }

    var tabloAlan = YU.ui.alan({
      etiket: 'Tablo', tip: 'secim', secenekler: tabloSecenek, deger: '',
      onChange: function () { durum.tablo = tabloAlan.deger(); degisti(); }
    });
    var kullaniciAlan = YU.ui.alan({
      etiket: 'Kullanıcı', tip: 'secim', secenekler: kullaniciSecenek, deger: '',
      onChange: function () { durum.kullanici = kullaniciAlan.deger(); degisti(); }
    });
    var siloSecenek = [{ deger: '', metin: 'Tümü' }], silolarListe = db().silolar;
    for (i = 0; i < silolarListe.length; i++) {
      siloSecenek.push({ deger: String(silolarListe[i].Id), metin: silolarListe[i].Ad });
    }
    var siloAlan = YU.ui.alan({
      etiket: 'Silo', tip: 'secim', secenekler: siloSecenek, deger: '',
      onChange: function () { durum.silo = siloAlan.deger(); degisti(); }
    });

    var islemAlan = YU.ui.alan({
      etiket: 'İşlem', tip: 'secim', deger: '',
      secenekler: [
        { deger: '', metin: 'Tümü' },
        { deger: 'Ekle', metin: 'Ekle' },
        { deger: 'Guncelle', metin: 'Güncelle' },
        { deger: 'Sil', metin: 'Sil' }
      ],
      onChange: function () { durum.islem = islemAlan.deger(); degisti(); }
    });
    /* İşlem kartları (KPI satırı) süzgeç gibi davranır; seçim kutusuyla aynı
       durumu paylaştıkları için kart tıklandığında kutu da eşitlenir. */
    durum.islemEsitle = function (v) { islemAlan.ayarla(v); };
    var basAlan = YU.ui.alan({
      etiket: 'Başlangıç', tip: 'tarih', deger: '',
      onChange: function () { durum.bas = basAlan.deger(); degisti(); }
    });
    var bitAlan = YU.ui.alan({
      etiket: 'Bitiş', tip: 'tarih', deger: '',
      onChange: function () { durum.bit = bitAlan.deger(); degisti(); }
    });
    var aramaAlan = YU.ui.alan({
      etiket: 'Ara', tip: 'metin', deger: '',
      yerTutucu: 'Değer, kayıt, künye, kullanıcı, tablo, işlem… (1.700 = 1700)',
      onInput: function () {
        durum.arama = aramaAlan.deger();
        /* Arama geneldir: yazmaya başlanınca işlem kartı seçimi kalkar
           (kullanıcı isteği, 21.08.2026). */
        if (durum.islem) { durum.islem = ''; islemAlan.ayarla(''); }
        degisti();
      }
    });

    var temizle = YU.ui.dugme({
      metin: 'Filtreleri Temizle', ikon: '#ic-filter', tur: 'sade', kucuk: true,
      onClick: function () {
        durum.tablo = ''; durum.kullanici = ''; durum.islem = ''; durum.silo = '';
        durum.bas = ''; durum.bit = ''; durum.arama = '';
        tabloAlan.ayarla(''); kullaniciAlan.ayarla(''); islemAlan.ayarla(''); siloAlan.ayarla('');
        basAlan.ayarla(''); bitAlan.ayarla(''); aramaAlan.ayarla('');
        degisti();
      }
    });

    return YU.ui.panel({
      baslik: 'Filtreler',
      ikon: '#ic-filter',
      sag: temizle,
      govde: [
        YU.h('div', { sinif: 'yu-izgara yu-iz-4' }, tabloAlan.kok, kullaniciAlan.kok, islemAlan.kok, siloAlan.kok),
        /* Tarih çifti yan yana tek gözde durur — arada boşluk kalmaz;
           Ara alanı kalan iki gözü kaplar (kullanıcı isteği, 21.08.2026). */
        YU.h('div', { sinif: 'yu-izgara yu-iz-3' },
          YU.h('div', { stil: { display: 'flex', gap: '10px', minWidth: '0' } },
            (basAlan.kok.style.flex = '1', basAlan.kok),
            (bitAlan.kok.style.flex = '1', bitAlan.kok)
          ),
          (aramaAlan.kok.style.gridColumn = 'span 2', aramaAlan.kok)
        )
      ]
    });
  }

  /* ==================================================================
     Sonuç alanı — KPI + tablo + sayfalama
     ================================================================== */

  function sonuclariCiz(kap, durum) {
    YU.bos(kap);

    var liste = suzulmus(durum);

    /* Sayaçlar işlem süzgecinden BAĞIMSIZ hesaplanır: "Sil" seçiliyken Ekle
       kartı 0'a düşmesin — kartlar süzgeç çipi gibi davranır (kullanıcı
       isteği, 21.08.2026). Diğer filtreler (tablo, kullanıcı, tarih, arama)
       sayaçlara işlemeye devam eder. */
    var islemsiz = { tablo: durum.tablo, kullanici: durum.kullanici, islem: '',
                     bas: durum.bas, bit: durum.bit, arama: durum.arama, sayfa: 0 };
    var taban = suzulmus(islemsiz);
    var sayaclar = { Ekle: 0, Guncelle: 0, Sil: 0 }, i;
    for (i = 0; i < taban.length; i++) {
      if (sayaclar[taban[i].Islem] !== undefined) sayaclar[taban[i].Islem]++;
    }

    /* Kart = tekli işlem süzgeci: tıklanınca yalnız o işlem listelenir,
       ikinci tıklama varsayılana (Tümü) döner; aynı anda tek kart aktif. */
    function islemKarti(ayar) {
      var aktif = durum.islem === ayar.islem;
      var k = YU.ui.kpi({
        etiket: ayar.etiket, ikon: ayar.ikon, deger: YU.fmt.sayi(sayaclar[ayar.islem]),
        renk: ayar.renk, alt: aktif ? 'Süzgeç açık — kaldırmak için tekrar tıklayın.' : ayar.alt
      });
      k.setAttribute('role', 'button');
      k.setAttribute('tabindex', '0');
      k.setAttribute('aria-pressed', aktif ? 'true' : 'false');
      k.title = aktif ? 'Süzgeci Kaldır' : 'Yalnız ' + ayar.etiket + ' Kayıtlarını Göster';
      k.style.cursor = 'pointer';
      if (aktif) k.style.boxShadow = 'inset 0 0 0 1.5px var(--vurgu)';
      function uygula() {
        durum.islem = aktif ? '' : ayar.islem;
        durum.sayfa = 0;
        if (durum.islemEsitle) durum.islemEsitle(durum.islem);
        sonuclariCiz(kap, durum);
      }
      k.addEventListener('click', uygula);
      k.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uygula(); }
      });
      return k;
    }

    /* Başlık da süzgece göre değişir: süzgeç yokken "Tüm Kayıtlar", varken
       "Sil'in Kayıtları" gibi; işlemin adı kendi anlam rengiyle ve kalın
       yazılır ki değiştiği belli olsun (kullanıcı isteği, 21.08.2026). */
    var ozetKart = YU.ui.kpi({
        etiket: durum.islem ? '' : 'Tüm Kayıtlar',
        ikon: '#ic-dots', deger: YU.fmt.sayi(liste.length),
        /* Alt satır aktif işlem süzgecine göre değişir (kullanıcı isteği,
           21.08.2026): süzgeç yokken toplam, varken işlemin adıyla yazar. */
        alt: durum.islem
          ? ({ Ekle: 'Ekle', Guncelle: 'Güncelle', Sil: 'Sil' }[durum.islem] || durum.islem) +
            ' işleminden ' + YU.fmt.sayi(liste.length) + ' adet değişiklik'
          : 'Toplam ' + YU.fmt.sayi(liste.length) + ' adet değişiklik'
      });
    if (durum.islem) {
      var ISLEM_AD = { Ekle: 'Ekle', Guncelle: 'Güncelle', Sil: 'Sil' };
      var ISLEM_EK = { Ekle: "'nin Kayıtları", Guncelle: "'nin Kayıtları", Sil: "'in Kayıtları" };
      var ISLEM_RENK = { Ekle: 'var(--olumlu)', Guncelle: 'var(--bekleyen)', Sil: 'var(--olumsuz)' };
      var etiketEl = ozetKart.querySelector('.yu-kpi-etiket');
      etiketEl.appendChild(YU.h('span', {
        metin: ISLEM_AD[durum.islem] || durum.islem,
        stil: { color: ISLEM_RENK[durum.islem] || 'var(--vurgu)', fontWeight: '700' }
      }));
      etiketEl.appendChild(document.createTextNode(ISLEM_EK[durum.islem] || ' Kayıtları'));
    }

    kap.appendChild(YU.h('div', { sinif: 'yu-izgara yu-iz-4' },
      ozetKart,
      islemKarti({ etiket: 'Ekle', ikon: '#ic-plus', islem: 'Ekle', renk: 'olumlu', alt: 'Yeni kayıt açılışı.' }),
      islemKarti({ etiket: 'Güncelle', ikon: '#ic-pencil', islem: 'Guncelle', renk: 'bekleyen', alt: 'Alan bazında düzeltme.' }),
      islemKarti({ etiket: 'Sil', ikon: '#ic-trash', islem: 'Sil', renk: 'olumsuz', alt: 'Kayıt veya hareket silme.' })
    ));

    var duz = gruplandir(liste);
    var toplamSayfa = Math.max(1, Math.ceil(duz.length / SAYFA_BOYU));
    if (durum.sayfa > toplamSayfa - 1) durum.sayfa = toplamSayfa - 1;
    if (durum.sayfa < 0) durum.sayfa = 0;

    var bas = durum.sayfa * SAYFA_BOYU;
    var dilim = duz.slice(bas, bas + SAYFA_BOYU);
    /* Sayfa bir grubun ortasından başlıyorsa künye yeniden yazılır. */
    if (dilim.length) dilim[0] = { satir: dilim[0].satir, ilk: true, boyut: dilim[0].boyut };

    var satirlar = [];
    for (i = 0; i < dilim.length; i++) satirlar.push(tabloSatiri(dilim[i]));

    kap.appendChild(YU.ui.panel({
      baslik: 'Değişiklikler',
      ikon: '#ic-doc',
      dolgusuz: true,
      sag: YU.h('span', {
        metin: duz.length
          ? YU.fmt.sayi(bas + 1) + '–' + YU.fmt.sayi(bas + dilim.length) + ' / ' + YU.fmt.sayi(duz.length) + ' satır'
          : 'sonuç yok'
      }),
      govde: [
        YU.ui.tablo({
          sutunlar: [
            { baslik: 'Tarih · Saat', genislik: 152 },
            { baslik: 'Kullanıcı', genislik: 130 },
            { baslik: 'İşlem', genislik: 96, hiza: 'orta' },
            { baslik: 'Tablo', genislik: 140 },
            { baslik: 'Kayıt', genislik: 210 },
            { baslik: 'Ne Değişti', genislik: 150 },
            { baslik: 'Eski Değer', hiza: 'sag' },
            { baslik: 'Yeni Değer', hiza: 'sag' }
          ],
          satirlar: satirlar,
          bos: 'Bu filtreyle eşleşen değişiklik kaydı yok. Filtreleri temizleyip yeniden deneyin.',
          kompakt: true,
          yapiskan: true
        }),
        toplamSayfa > 1 ? sayfalama(durum, toplamSayfa, function () { sonuclariCiz(kap, durum); }) : null
      ]
    }));
  }

  function sayfalama(durum, toplamSayfa, tazele) {
    return YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end',
        padding: '12px 18px', borderTop: '1px solid var(--ayrac)'
      }
    },
      YU.h('span', {
        sinif: 'yu-yardim',
        metin: 'Sayfa ' + YU.fmt.sayi(durum.sayfa + 1) + ' / ' + YU.fmt.sayi(toplamSayfa) +
          ' · sayfa başına ' + YU.fmt.sayi(SAYFA_BOYU) + ' satır'
      }),
      YU.ui.dugme({
        metin: 'Önceki', tur: 'ikincil', kucuk: true, pasif: durum.sayfa === 0,
        onClick: function () { durum.sayfa--; tazele(); }
      }),
      YU.ui.dugme({
        metin: 'Sonraki', tur: 'ikincil', kucuk: true, pasif: durum.sayfa >= toplamSayfa - 1,
        onClick: function () { durum.sayfa++; tazele(); }
      })
    );
  }
})();

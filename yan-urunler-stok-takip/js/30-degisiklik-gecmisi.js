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

  function degerHucresi(v) {
    if (bosDeger(v)) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
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
        font: '500 11px/1 var(--mono)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'
      },
      title: (artis ? 'Artış' : 'Azalış') + ': ' + YU.fmt.kg(Math.abs(fark))
    }, YU.svg(artis ? '#ic-up' : '#ic-down', 11),
      YU.h('span', { metin: (artis ? '+' : '−') + YU.fmt.kg(Math.abs(fark)) }));
  }

  function yeniDegerHucresi(satir) {
    var cip = farkCipi(satir.EskiDeger, satir.YeniDeger);
    if (!cip) return degerHucresi(satir.YeniDeger);
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }
    }, degerHucresi(satir.YeniDeger), cip);
  }

  /* ==================================================================
     Süzme, sıralama, gruplama
     ================================================================== */

  function aramaMetni(s) {
    var parcalar = [tabloAdi(s.Tablo), islemAdi(s.Islem), kullaniciAdi(s.KullaniciId),
                    s.Alan, s.EskiDeger, s.YeniDeger];
    var metin = '', i;
    for (i = 0; i < parcalar.length; i++) {
      if (!bosDeger(parcalar[i])) metin += String(parcalar[i]) + ' ';
    }
    if (s.KayitId !== null && s.KayitId !== undefined) metin += '#' + s.KayitId + ' ';
    metin += YU.fmt.tarihSaat(s.Tarih);
    return metin.toLocaleLowerCase('tr');
  }

  function suzulmus(durum) {
    var liste = db().degisiklikLog, sonuc = [], i, s, gun;
    var q = String(durum.arama || '').trim().toLocaleLowerCase('tr');

    for (i = 0; i < liste.length; i++) {
      s = liste[i];
      if (durum.tablo && s.Tablo !== durum.tablo) continue;
      if (durum.kullanici && String(s.KullaniciId) !== durum.kullanici) continue;
      if (durum.islem && s.Islem !== durum.islem) continue;
      gun = String(s.Tarih || '').slice(0, 10);
      if (durum.bas && gun < durum.bas) continue;
      if (durum.bit && gun > durum.bit) continue;
      if (q && aramaMetni(s).indexOf(q) < 0) continue;
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
          boyut: gruplar[i].satirlar.length
        });
      }
    }
    return duz;
  }

  /* ==================================================================
     Tablo satırı
     ================================================================== */

  function tabloSatiri(oge) {
    var s = oge.satir;

    if (!oge.ilk) {
      /* Devam satırı: tekrar eden künye boş bırakılır, bağ ↳ ile kurulur. */
      return {
        hucreler: [
          YU.h('span', { sinif: 'yu-zayif', metin: '↳', title: 'Aynı işlemin devamı' }),
          '', '', '', '',
          YU.h('span', { metin: s.Alan || '—' }),
          degerHucresi(s.EskiDeger),
          yeniDegerHucresi(s)
        ]
      };
    }

    var kayitHucresi = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '2px' } },
      YU.h('span', {
        sinif: s.KayitId === null || s.KayitId === undefined ? 'yu-zayif' : 'yu-mono',
        metin: s.KayitId === null || s.KayitId === undefined ? '—' : '#' + s.KayitId
      }),
      oge.boyut > 1
        ? YU.h('span', { sinif: 'yu-yardim', metin: YU.fmt.sayi(oge.boyut) + ' alan' })
        : null
    );

    return {
      hucreler: [
        YU.h('span', { sinif: 'yu-mono', metin: YU.fmt.tarihSaat(s.Tarih), stil: { whiteSpace: 'nowrap' } }),
        YU.h('span', { metin: kullaniciAdi(s.KullaniciId) }),
        YU.ui.rozet(islemAdi(s.Islem), ISLEM_RENGI[s.Islem] || 'notr'),
        YU.h('span', { metin: tabloAdi(s.Tablo) }),
        kayitHucresi,
        YU.h('span', { metin: s.Alan || '—', sinif: s.Alan ? '' : 'yu-zayif' }),
        degerHucresi(s.EskiDeger),
        yeniDegerHucresi(s)
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
    ikon: '#ic-dots',
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

      kap.appendChild(YU.ui.serit({
        tur: 'bilgi',
        baslik: 'Bu İz Neden Tutuluyor?',
        metin: 'Düzeltme bu uygulamada rutin bir işlem. Yalnızca “kim oluşturdu” tutulsaydı ' +
          '“silo geçen hafta 240.000’di, şimdi neden 290.000?” sorusunun cevabı olmazdı (Şartname §6 v2). ' +
          'DegisiklikLog her değişikliği alan bazında eski ve yeni değeriyle saklar. ' +
          'Loglanan tablolar: ' + logTablolariMetni() + '. Silo tanımları bilinçli olarak dışarıdadır — ' +
          'her tabloyu loglamak veritabanını gereksiz şişirir.'
      }));

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

      var durum = { tablo: '', kullanici: '', islem: '', bas: '', bit: '', arama: '', sayfa: 0 };
      var sonucKap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '20px' } });

      kap.appendChild(filtrePaneli(durum, function () { sonuclariCiz(sonucKap, durum); }));
      kap.appendChild(sonucKap);
      sonuclariCiz(sonucKap, durum);
    }
  });

  function logTablolariMetni() {
    var liste = (YU.log && YU.log.TABLOLAR) || [], adlar = [], i;
    for (i = 0; i < liste.length; i++) adlar.push(tabloAdi(liste[i]));
    return adlar.join(', ');
  }

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
      yerTutucu: 'Alan, değer, kayıt no…',
      onInput: function () { durum.arama = aramaAlan.deger(); degisti(); }
    });

    var temizle = YU.ui.dugme({
      metin: 'Filtreleri Temizle', ikon: '#ic-filter', tur: 'sade', kucuk: true,
      onClick: function () {
        durum.tablo = ''; durum.kullanici = ''; durum.islem = '';
        durum.bas = ''; durum.bit = ''; durum.arama = '';
        tabloAlan.ayarla(''); kullaniciAlan.ayarla(''); islemAlan.ayarla('');
        basAlan.ayarla(''); bitAlan.ayarla(''); aramaAlan.ayarla('');
        degisti();
      }
    });

    return YU.ui.panel({
      baslik: 'Filtreler',
      ikon: '#ic-filter',
      sag: temizle,
      govde: [
        YU.h('div', { sinif: 'yu-izgara yu-iz-3' }, tabloAlan.kok, kullaniciAlan.kok, islemAlan.kok),
        YU.h('div', { sinif: 'yu-izgara yu-iz-3' }, basAlan.kok, bitAlan.kok, aramaAlan.kok)
      ]
    });
  }

  /* ==================================================================
     Sonuç alanı — KPI + tablo + sayfalama
     ================================================================== */

  function sonuclariCiz(kap, durum) {
    YU.bos(kap);

    var liste = suzulmus(durum);
    var sayaclar = { Ekle: 0, Guncelle: 0, Sil: 0 }, i;
    for (i = 0; i < liste.length; i++) {
      if (sayaclar[liste[i].Islem] !== undefined) sayaclar[liste[i].Islem]++;
    }

    kap.appendChild(YU.h('div', { sinif: 'yu-izgara yu-iz-4' },
      YU.ui.kpi({
        etiket: 'Seçili Kayıt', ikon: '#ic-dots', deger: YU.fmt.sayi(liste.length),
        alt: 'Toplam ' + YU.fmt.sayi(db().degisiklikLog.length) + ' değişiklik kaydından süzüldü.'
      }),
      YU.ui.kpi({ etiket: 'Ekle', ikon: '#ic-plus', deger: YU.fmt.sayi(sayaclar.Ekle), renk: 'olumlu', alt: 'Yeni kayıt açılışı.' }),
      YU.ui.kpi({ etiket: 'Güncelle', ikon: '#ic-pencil', deger: YU.fmt.sayi(sayaclar.Guncelle), renk: 'bekleyen', alt: 'Alan bazında düzeltme.' }),
      YU.ui.kpi({ etiket: 'Sil', ikon: '#ic-trash', deger: YU.fmt.sayi(sayaclar.Sil), renk: 'olumsuz', alt: 'Kayıt veya hareket silme.' })
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
            { baslik: 'Kayıt', genislik: 92 },
            { baslik: 'Alan', genislik: 130 },
            { baslik: 'Eski Değer', hiza: 'sag' },
            { baslik: 'Yeni Değer', hiza: 'sag' }
          ],
          satirlar: satirlar,
          bos: 'Bu filtreyle eşleşen değişiklik kaydı yok. Filtreleri temizleyip yeniden deneyin.',
          kompakt: true
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

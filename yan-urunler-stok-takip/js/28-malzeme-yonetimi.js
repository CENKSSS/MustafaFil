/* js/28-malzeme-yonetimi.js — Malzeme Yönetimi (Şartname §7 · SÖZLEŞME §7).
   İki sekme: malzeme tanımları ve silo tanımları.
   Burada SİLME yoktur (D12): geçmiş günlük hareketler malzemeye bağlıdır,
   bağ koparsa eski kayıtlar sahipsiz kalır ve raporlar anlamsızlaşır. */
(function () {
  'use strict';

  var YU = window.YU;

  var OZEL_TIP_ADI = {
    DokmeKuruKuspe: 'Dökme Kuru Küspe',
    CuvalKuruKuspe: 'Çuvallı Kuru Küspe'
  };
  var OZEL_TIPLER = ['DokmeKuruKuspe', 'CuvalKuruKuspe'];

  var SEKME_TANIMI = [
    { kod: 'malzemeler', metin: 'Malzemeler' },
    { kod: 'silolar', metin: 'Silolar' }
  ];

  /* ==================================================================
     Ortak yardımcılar
     ================================================================== */

  function db() { return YU.db; }
  function oturumKullanicisi() { return YU.oturum.kullanici; }

  function siraliKopya(liste) {
    return liste.slice().sort(function (a, b) {
      var x = Number(a.Sira) || 0, y = Number(b.Sira) || 0;
      if (x !== y) return x - y;
      return (a.Id || 0) - (b.Id || 0);
    });
  }

  /* Pasifleştirme uyarısının dayanağı: malzemeye bağlı geçmiş satır sayısı. */
  function malzemeKayitSayisi(id) {
    var d = db(), n = 0, i;
    for (i = 0; i < d.gunlukHareket.length; i++) if (d.gunlukHareket[i].MalzemeId === id) n++;
    for (i = 0; i < d.devirStok.length; i++) if (d.devirStok[i].MalzemeId === id) n++;
    return n;
  }

  function ozelTipSahibi(tip, hariciId) {
    var liste = db().malzemeler, i;
    for (i = 0; i < liste.length; i++) {
      if (liste[i].OzelTip === tip && liste[i].Id !== hariciId) return liste[i];
    }
    return null;
  }

  function ozelTipMetni(tip) {
    return tip && OZEL_TIP_ADI[tip] ? OZEL_TIP_ADI[tip] : '—';
  }

  function durumRozeti(aktif) {
    return aktif === false ? YU.ui.rozet('Pasif', 'notr') : YU.ui.rozet('Aktif', 'olumlu');
  }

  function eylemKabi() {
    return YU.h('div', {
      stil: { display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }
    });
  }

  /* Satır içi ikon düğmesi. Pasif hâlde tıklama bağlanmaz; nedeni title'da durur. */
  function satirEylem(s) {
    var el = YU.h('span', {
      sinif: 'yu-satir-eylem' + (s.tehlike ? ' tehlike' : ''),
      role: 'button',
      tabindex: s.pasif ? '-1' : '0',
      title: s.baslik,
      'aria-label': s.baslik
    }, YU.svg(s.ikon, 15));
    if (s.pasif) {
      el.style.opacity = '.3';
      el.style.cursor = 'not-allowed';
      return el;
    }
    el.addEventListener('click', s.onClick);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.onClick(); }
    });
    return el;
  }

  function sonucuBildir(sonuc, basariMetni) {
    if (!sonuc.ok) {
      YU.ui.bildir(sonuc.hatalar.length ? sonuc.hatalar[0].mesaj : 'İşlem tamamlanamadı.', 'hata');
      return false;
    }
    YU.ui.bildir(basariMetni, 'basari');
    return true;
  }

  /* ==================================================================
     Sıra taşıma — #ic-up / #ic-down
     ================================================================== */

  function yeniSiralar(liste, indeks, yon) {
    var a = liste[indeks], b = liste[indeks + yon];
    if (!a || !b) return null;
    var siraA = Number(a.Sira) || 0, siraB = Number(b.Sira) || 0;
    /* Sıra değerleri bozuksa (eşit) takas anlamsız kalır; konuma göre tazelenir. */
    if (siraA === siraB) return { a: a, b: b, yeniA: indeks + yon + 1, yeniB: indeks + 1 };
    return { a: a, b: b, yeniA: siraB, yeniB: siraA };
  }

  function malzemeTasi(liste, indeks, yon) {
    var t = yeniSiralar(liste, indeks, yon);
    if (!t) return;
    var eskiA = Number(t.a.Sira) || 0;
    var birinci = malzemeSirasiKaydet(t.a, t.yeniA);
    if (!birinci.ok) { sonucuBildir(birinci, ''); return; }
    var ikinci = malzemeSirasiKaydet(t.b, t.yeniB);
    if (!ikinci.ok) {
      /* Takasın ilk yarısı yazıldı, ikincisi reddedildi: yarım kalan sıra geri alınır. */
      malzemeSirasiKaydet(t.a, eskiA);
      sonucuBildir(ikinci, '');
      return;
    }
    YU.ui.bildir('“' + t.a.Ad + '” sırası ' + YU.fmt.sayi(t.yeniA) + ' oldu.', 'basari');
    YU.yenile();
  }

  function malzemeSirasiKaydet(m, sira) {
    return YU.servis.malzemeKaydet(db(), {
      Id: m.Id, Ad: m.Ad, Birim: m.Birim, Sira: sira, OzelTip: m.OzelTip, Aktif: m.Aktif
    }, oturumKullanicisi());
  }

  function siloTasi(liste, indeks, yon) {
    var t = yeniSiralar(liste, indeks, yon);
    if (!t) return;
    var eskiA = Number(t.a.Sira) || 0;
    var birinci = siloSirasiKaydet(t.a, t.yeniA);
    if (!birinci.ok) { sonucuBildir(birinci, ''); return; }
    var ikinci = siloSirasiKaydet(t.b, t.yeniB);
    if (!ikinci.ok) {
      siloSirasiKaydet(t.a, eskiA);
      sonucuBildir(ikinci, '');
      return;
    }
    YU.ui.bildir('“' + t.a.Ad + '” sırası ' + YU.fmt.sayi(t.yeniA) + ' oldu.', 'basari');
    YU.yenile();
  }

  function siloSirasiKaydet(s, sira) {
    return YU.servis.siloKaydet(db(), {
      Id: s.Id, Ad: s.Ad, Sira: sira, Kapasite: s.Kapasite, Aktif: s.Aktif
    }, oturumKullanicisi());
  }

  /* ==================================================================
     Malzeme modali
     ================================================================== */

  /* Filtreli tekillik ekranda da görünsün: kullanılmış özel tip seçilemez ve
     nedeni seçeneğin kendi metninde yazar (sunucu karşılığı YU.dogrula.malzeme). */
  function ozelTipAlani(malzeme) {
    var mevcutTip = malzeme && malzeme.OzelTip ? malzeme.OzelTip : '';
    var secenekler = [{ deger: '', metin: '— yok —' }];
    var kilitli = {}, i, tip, sahip, metin;

    for (i = 0; i < OZEL_TIPLER.length; i++) {
      tip = OZEL_TIPLER[i];
      sahip = ozelTipSahibi(tip, malzeme ? malzeme.Id : null);
      metin = OZEL_TIP_ADI[tip];
      if (sahip) {
        metin += ' · ' + sahip.Ad + ' malzemesinde kullanılıyor';
        kilitli[tip] = sahip.Ad;
      }
      secenekler.push({ deger: tip, metin: metin });
    }

    var alan = YU.ui.alan({
      etiket: 'Özel Tip',
      tip: 'secim',
      secenekler: secenekler,
      deger: mevcutTip,
      yardim: 'Her özel tipten en fazla bir malzeme olabilir (filtreli tekil indeks — Şartname §6). ' +
        "Kullanılan tipler listede pasif görünür. Bir malzemeye özel tip atandıktan sonra kaldırılamaz — Şartname §5, dökme stoğun silolar toplamı olduğunu söylüyor ve kolon kilitleri buna bağlı."
    });

    var opsiyonlar = alan.girdi.options;
    for (i = 0; i < opsiyonlar.length; i++) {
      var deger = opsiyonlar[i].value;
      if (kilitli[deger]) {
        opsiyonlar[i].disabled = true;
        opsiyonlar[i].title = kilitli[deger] + ' malzemesinde kullanılıyor.';
      }
      /* Bu malzemenin hâlihazırda bir özel tipi varsa "— yok —" dahil hiçbir başka
         seçenek açılmaz; sunucu karşılığı YU.dogrula.malzeme içinde de reddediliyor. */
      if (mevcutTip && deger !== mevcutTip) {
        opsiyonlar[i].disabled = true;
        if (!opsiyonlar[i].title) {
          opsiyonlar[i].title = 'Bu malzemenin özel tipi kaldırılamaz veya değiştirilemez ' +
            '(Şartname §5 kritik kural).';
        }
      }
    }
    return alan;
  }

  function malzemeModali(malzeme) {
    var duzenle = !!malzeme;
    var hataKap = YU.h('div');

    var adAlan = YU.ui.alan({
      etiket: 'Malzeme Adı', tip: 'metin',
      deger: duzenle ? malzeme.Ad : '',
      yardim: 'Malzeme adı tekil olmalıdır.'
    });
    var birimAlan = YU.ui.alan({
      etiket: 'Birim', tip: 'metin',
      deger: duzenle ? malzeme.Birim : 'Kg',
      yardim: 'Miktarlar kg cinsinden tutulur (Şartname §6).'
    });
    var tipAlan = ozelTipAlani(duzenle ? malzeme : null);

    var m = YU.ui.modal({
      baslik: duzenle ? 'Malzemeyi düzenle' : 'Yeni Malzeme',
      genislik: 520,
      govde: [hataKap, adAlan.kok, birimAlan.kok, tipAlan.kok],
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m.kapat(); } },
        { metin: duzenle ? 'Kaydet' : 'Ekle', tur: 'birincil', onClick: kaydet }
      ]
    });

    function kaydet() {
      var aday = {
        Id: duzenle ? malzeme.Id : null,
        Ad: adAlan.deger(),
        Birim: birimAlan.deger(),
        OzelTip: tipAlan.deger()
      };
      if (duzenle) { aday.Sira = malzeme.Sira; aday.Aktif = malzeme.Aktif; }

      var sonuc = YU.servis.malzemeKaydet(db(), aday, oturumKullanicisi());
      if (!sonuc.ok) {
        YU.bos(hataKap).appendChild(YU.ui.hataListesi(sonuc.hatalar, 'hata'));
        return;
      }
      m.kapat();
      YU.ui.bildir('“' + sonuc.kayit.Ad + '” ' + (duzenle ? 'güncellendi.' : 'eklendi.'), 'basari');
      YU.yenile();
    }

    adAlan.odakla();
    return m;
  }

  /* ==================================================================
     Malzeme durum değişikliği (D12 — silme yok, pasifleştirme var)
     ================================================================== */

  function malzemeDurumDegistir(malzeme) {
    var pasifeAl = malzeme.Aktif !== false;
    var sayi = malzemeKayitSayisi(malzeme.Id);

    var metin = pasifeAl
      ? '“' + malzeme.Ad + '” pasifleştirilecek. Yeni girişlerde seçilemez, geçmiş kayıtlarda görünmeye devam eder.'
      : '“' + malzeme.Ad + '” yeniden aktifleştirilecek ve girişlerde seçilebilir olacak.';

    /* Geçmiş kaydı olan malzemede uyar ama engelleme (görev tanımı). */
    if (pasifeAl && sayi > 0) {
      metin += ' Bu malzemenin ' + YU.fmt.sayi(sayi) +
        ' geçmiş kaydı var; hiçbiri silinmez, raporlarda kalır.';
    } else if (pasifeAl) {
      metin += ' Malzemenin geçmiş kaydı yok.';
    }

    YU.ui.onay({
      baslik: pasifeAl ? 'Malzemeyi pasifleştir' : 'Malzemeyi aktifleştir',
      metin: metin,
      onayMetni: pasifeAl ? 'Pasifleştir' : 'Aktifleştir',
      tehlike: pasifeAl
    }).then(function (evet) {
      if (!evet) return;
      var sonuc = YU.servis.malzemeKaydet(db(), {
        Id: malzeme.Id, Ad: malzeme.Ad, Birim: malzeme.Birim,
        Sira: malzeme.Sira, OzelTip: malzeme.OzelTip, Aktif: !pasifeAl
      }, oturumKullanicisi());
      if (sonucuBildir(sonuc, '“' + malzeme.Ad + '” ' + (pasifeAl ? 'pasifleştirildi.' : 'aktifleştirildi.'))) {
        YU.yenile();
      }
    });
  }

  /* ==================================================================
     Silo modali
     ================================================================== */

  function siloModali(silo) {
    var hataKap = YU.h('div');

    var adAlan = YU.ui.alan({
      etiket: 'Silo Adı', tip: 'metin', deger: silo.Ad,
      yardim: 'Silo adı tekil olmalıdır.'
    });
    var siraAlan = YU.ui.alan({
      etiket: 'Sıra', tip: 'sayi', deger: Number(silo.Sira) || 0,
      yardim: 'Listelerde ve silo dağıtım satırlarında bu sıra kullanılır.'
    });
    var kapasiteAlan = YU.ui.alan({
      etiket: 'Kapasite', tip: 'sayi', deger: Number(silo.Kapasite) || 0, sag: 'kg',
      yardim: 'Ton karşılığı hesaplanıyor…',
      onInput: function () { tonTazele(); }
    });
    var tonEl = kapasiteAlan.kok.querySelector('.yu-yardim');

    function tonTazele() {
      var v = kapasiteAlan.deger();
      tonEl.textContent = isNaN(v)
        ? 'Kapasite sayı olmalı (örn. 3.000.000).'
        : 'Veride kg saklanır: ' + YU.fmt.kgU(v) + ' · ekranda ' + YU.fmt.ton(v) + '.';
    }
    tonTazele();

    var m = YU.ui.modal({
      baslik: 'Siloyu Düzenle',
      genislik: 520,
      govde: [
        hataKap, adAlan.kok, siraAlan.kok, kapasiteAlan.kok,
        YU.h('div', {
          sinif: 'yu-yardim',
          metin: 'Kapasite yalnızca kg olarak saklanır; ton gösterimi ekranda hesaplanır. ' +
            'İki ayrı birim saklamak dönüşüm hatası üretir (Şartname §6).'
        })
      ],
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m.kapat(); } },
        { metin: 'Kaydet', tur: 'birincil', onClick: kaydet }
      ]
    });

    function kaydet() {
      var sira = siraAlan.deger();
      var kapasite = kapasiteAlan.deger();

      /* Servis katmanı sayı olmayan girdiyi 0'a çeviriyor; sessiz sıfırlanma
         olmasın diye geçersiz sayı ekranda durdurulur. */
      siraAlan.hataGoster(isNaN(sira) ? 'Sıra sayı olmalı.' : '');
      kapasiteAlan.hataGoster(isNaN(kapasite) ? 'Kapasite sayı olmalı (örn. 3.000.000).' : '');
      if (isNaN(sira) || isNaN(kapasite)) return;

      var sonuc = YU.servis.siloKaydet(db(), {
        Id: silo.Id,
        Ad: adAlan.deger(),
        Sira: sira,
        Kapasite: kapasite,
        Aktif: silo.Aktif
      }, oturumKullanicisi());
      if (!sonuc.ok) {
        YU.bos(hataKap).appendChild(YU.ui.hataListesi(sonuc.hatalar, 'hata'));
        return;
      }
      m.kapat();
      YU.ui.bildir('“' + sonuc.kayit.Ad + '” güncellendi.', 'basari');
      YU.yenile();
    }

    adAlan.odakla();
    return m;
  }

  /* ==================================================================
     Silo durum değişikliği — malzemedeki gibi silme yok, pasifleştirme var
     ================================================================== */

  /* Pasif silo js/21 (Kuru Küspe Günlük Giriş) dağıtım satırlarında artık
     seçilemez, ama stoğu YU.stok.tumSilolar üzerinden dökme toplamına dahil
     olmaya devam eder. Stok kaybolmadığı için engellemiyoruz; karar
     kullanıcının, o yüzden güncel mevcut onay metninde yazıyor. */
  function siloDurumDegistir(silo) {
    var pasifeAl = silo.Aktif !== false;
    var metin;

    if (pasifeAl) {
      var mevcut = YU.stok.siloStok(db(), silo.Id).mevcut;
      metin = '“' + silo.Ad + '” pasifleştirilecek. Silonun güncel mevcudu ' + YU.fmt.kgU(mevcut) +
        '. Bu silo yeni girişlerde seçilemez; stoğu dökme toplamında sayılmaya devam eder. ' +
        'Yani stok kaybolmaz, yalnızca bu siloya giriş/çıkış yapılamaz hâle gelir.';
    } else {
      metin = '“' + silo.Ad + '” yeniden aktifleştirilecek ve girişlerde seçilebilir olacak.';
    }

    YU.ui.onay({
      baslik: pasifeAl ? 'Siloyu pasifleştir' : 'Siloyu aktifleştir',
      metin: metin,
      onayMetni: pasifeAl ? 'Pasifleştir' : 'Aktifleştir',
      tehlike: pasifeAl
    }).then(function (evet) {
      if (!evet) return;
      var sonuc = YU.servis.siloKaydet(db(), {
        Id: silo.Id, Ad: silo.Ad, Sira: silo.Sira, Kapasite: silo.Kapasite, Aktif: !pasifeAl
      }, oturumKullanicisi());
      if (sonucuBildir(sonuc, '“' + silo.Ad + '” ' + (pasifeAl ? 'pasifleştirildi.' : 'aktifleştirildi.'))) {
        YU.yenile();
      }
    });
  }

  /* ==================================================================
     Sekme gövdeleri
     ================================================================== */

  function malzemeSekmesi(kap) {
    var liste = siraliKopya(db().malzemeler);
    var satirlar = [], i;

    for (i = 0; i < liste.length; i++) {
      satirlar.push(malzemeSatiri(liste, i));
    }

    kap.appendChild(YU.ui.panel({
      baslik: 'Malzemeler',
      ikon: '#ic-gear',
      dolgusuz: true,
      sag: YU.ui.dugme({
        metin: 'Yeni Malzeme', ikon: '#ic-plus', tur: 'birincil', kucuk: true,
        onClick: function () { malzemeModali(null); }
      }),
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Sıra', genislik: 62, hiza: 'sag', mono: true },
          { baslik: 'Ad' },
          { baslik: 'Birim', genislik: 76 },
          { baslik: 'Özel Tip', genislik: 170 },
          { baslik: 'Durum', genislik: 92, hiza: 'orta' },
          { baslik: 'Kayıt Sayısı', genislik: 108, hiza: 'sag', mono: true },
          { baslik: 'İşlem', genislik: 176, hiza: 'sag' }
        ],
        satirlar: satirlar,
        bos: 'Tanımlı malzeme yok.'
      })
    }));
  }

  function malzemeSatiri(liste, indeks) {
    var m = liste[indeks];
    var pasif = m.Aktif === false;
    var eylemler = eylemKabi();

    eylemler.appendChild(satirEylem({
      ikon: '#ic-up', baslik: 'Yukarı Taşı', pasif: indeks === 0,
      onClick: function () { malzemeTasi(liste, indeks, -1); }
    }));
    eylemler.appendChild(satirEylem({
      ikon: '#ic-down', baslik: 'Aşağı Taşı', pasif: indeks === liste.length - 1,
      onClick: function () { malzemeTasi(liste, indeks, 1); }
    }));
    eylemler.appendChild(satirEylem({
      ikon: '#ic-pencil', baslik: 'Düzenle',
      onClick: function () { malzemeModali(m); }
    }));
    eylemler.appendChild(YU.ui.dugme({
      metin: pasif ? 'Aktifleştir' : 'Pasifleştir',
      tur: pasif ? 'ikincil' : 'sade',
      kucuk: true,
      baslik: pasif
        ? 'Malzemeyi yeniden girişlere aç.'
        : 'Malzeme silinmez; yalnızca pasifleştirilir (D12).',
      onClick: function () { malzemeDurumDegistir(m); }
    }));

    return {
      hucreler: [
        YU.fmt.sayi(m.Sira),
        YU.h('span', { sinif: pasif ? 'yu-zayif' : 'yu-guclu', metin: m.Ad }),
        m.Birim,
        m.OzelTip
          ? YU.ui.rozet(ozelTipMetni(m.OzelTip), 'vurgu')
          : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
        durumRozeti(m.Aktif),
        YU.fmt.sayi(malzemeKayitSayisi(m.Id)),
        eylemler
      ]
    };
  }

  function siloSekmesi(kap) {
    var liste = siraliKopya(db().silolar);
    var satirlar = [], toplam = 0, i;

    for (i = 0; i < liste.length; i++) {
      toplam += Number(liste[i].Kapasite) || 0;
      satirlar.push(siloSatiri(liste, i));
    }

    kap.appendChild(YU.ui.panel({
      baslik: 'Silolar',
      ikon: '#ic-building',
      dolgusuz: true,
      sag: YU.h('span', { metin: 'Toplam kapasite ' + YU.fmt.ton(toplam) }),
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Sıra', genislik: 62, hiza: 'sag', mono: true },
          { baslik: 'Ad' },
          { baslik: 'Kapasite (Kg)', genislik: 150, hiza: 'sag', mono: true },
          { baslik: 'Kapasite (Ton)', genislik: 130, hiza: 'sag', mono: true },
          { baslik: 'Durum', genislik: 92, hiza: 'orta' },
          { baslik: 'İşlem', genislik: 176, hiza: 'sag' }
        ],
        satirlar: satirlar,
        bos: 'Tanımlı silo yok.'
      })
    }));

    kap.appendChild(YU.h('div', {
      sinif: 'yu-yardim',
      metin: 'Silo tanımları denetim izine yazılmaz: yalnız kritik tablolar loglanır (Şartname §6). ' +
        'Silo hareketleri ve silo devirleri ise Değişiklik Geçmişi ekranında görünür.'
    }));
  }

  function siloSatiri(liste, indeks) {
    var s = liste[indeks];
    var pasif = s.Aktif === false;
    var eylemler = eylemKabi();

    eylemler.appendChild(satirEylem({
      ikon: '#ic-up', baslik: 'Yukarı Taşı', pasif: indeks === 0,
      onClick: function () { siloTasi(liste, indeks, -1); }
    }));
    eylemler.appendChild(satirEylem({
      ikon: '#ic-down', baslik: 'Aşağı Taşı', pasif: indeks === liste.length - 1,
      onClick: function () { siloTasi(liste, indeks, 1); }
    }));
    eylemler.appendChild(satirEylem({
      ikon: '#ic-pencil', baslik: 'Düzenle',
      onClick: function () { siloModali(s); }
    }));
    eylemler.appendChild(YU.ui.dugme({
      metin: pasif ? 'Aktifleştir' : 'Pasifleştir',
      tur: pasif ? 'ikincil' : 'sade',
      kucuk: true,
      baslik: pasif
        ? 'Siloyu yeniden girişlere aç.'
        : 'Silo yeni girişlerde seçilemez olur; stoğu dökme toplamında sayılmaya devam eder.',
      onClick: function () { siloDurumDegistir(s); }
    }));

    return {
      hucreler: [
        YU.fmt.sayi(s.Sira),
        YU.h('span', { sinif: 'yu-guclu', metin: s.Ad }),
        YU.fmt.kg(s.Kapasite),
        YU.fmt.ton(s.Kapasite),
        durumRozeti(s.Aktif),
        eylemler
      ]
    };
  }

  /* ==================================================================
     Sayfa
     ================================================================== */

  function sekmeKodu(param) {
    var k = param && param.sekme;
    return k === 'silolar' ? 'silolar' : 'malzemeler';
  }

  YU.sayfaTanimla({
    kod: 'malzeme-yonetimi',
    baslik: 'Malzeme Yönetimi',
    altBaslik: function (param) {
      var d = YU.db;
      if (!d) return '';
      var aktif = 0, i;
      for (i = 0; i < d.malzemeler.length; i++) if (d.malzemeler[i].Aktif !== false) aktif++;
      return YU.fmt.sayi(d.malzemeler.length) + ' malzeme · ' + YU.fmt.sayi(aktif) + ' aktif · ' +
        YU.fmt.sayi(d.silolar.length) + ' silo · ' +
        (sekmeKodu(param) === 'silolar' ? 'Silolar sekmesi' : 'Malzemeler sekmesi');
    },
    ikon: '#ic-cube',
    grup: 'Yönetim',
    rol: 'Yonetici',

    ciz: function (kap, param) {
      YU.bos(kap);

      /* Kabuk zaten yetki kapısı işletiyor; ekran kendi kontrolünü de yapar —
         tek savunma hattı yönlendirici olmamalı (Şartname §8). */
      if (!YU.yonetici()) {
        kap.appendChild(YU.ui.bosDurum({
          ikon: '#ic-percent',
          baslik: 'Bu ekrana erişim yetkiniz yok.',
          metin: 'Malzeme Yönetimi yalnızca Yönetici rolüne açıktır.'
        }));
        return;
      }

      var aktifSekme = sekmeKodu(param);

      kap.appendChild(YU.ui.sekmeler({
        sekmeler: SEKME_TANIMI,
        aktif: aktifSekme,
        onDegis: function (kod) { YU.git('malzeme-yonetimi', { sekme: kod }); }
      }));

      if (aktifSekme === 'silolar') siloSekmesi(kap);
      else malzemeSekmesi(kap);
    }
  });
})();

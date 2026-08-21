/* js/22-malzeme-girisi.js — Malzeme Girişi ekranı (Şartname §7 · SOZLESME §7).

   Kilitli kolonlar DEMİRBAŞ: dökme kuru küspenin üretim ve satış kolonları,
   çuvallı kuru küspenin üretim kolonu Kuru Küspe Günlük Giriş ekranından gelir
   ve bu ekrandan değiştirilemez. Kilit yalnız görsel değil: kilitli kolon
   servise hiç gönderilmez, böylece 03-dogrulama'daki kural tek yerde kalır. */
(function () {
  'use strict';

  var YU = window.YU;
  var KOD = 'malzeme-girisi';

  /* ==================================================================
     1. Küçük yardımcılar
     ================================================================== */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  function sayi(v) {
    var n = Number(v);
    return isFinite(n) ? YU.yuvarla(n) : 0;
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
      stil: { display: 'flex', flexDirection: 'column', minWidth: '0', gap: (bosluk || 4) + 'px' }
    });
  }

  function hareketBul(tarih, malzemeId) {
    var t = YU.db.gunlukHareket, i;
    for (i = 0; i < t.length; i++) {
      if (t[i].Tarih === tarih && t[i].MalzemeId === malzemeId) return t[i];
    }
    return null;
  }

  function gunKaydi(tarih) {
    var l = YU.stok.kayitliGunler(YU.db, tarih, tarih);
    return l.length ? l[0] : null;
  }

  /* ==================================================================
     2. Satır verisi — taban stok ve kayıt durumu
     ================================================================== */

  /* taban = seçilen güne kadarki stok, O GÜNÜN satırı hariç. Gün sonu stok
     yazdıkça taban + üretim − satış olarak anında hesaplanır. */
  function satirVerisiKur(satir, stok) {
    var kayit = hareketBul(satir.tarih, satir.malzeme.Id);
    satir.kayit = kayit;
    /* D16 karşılaştırması ekranın açıldığı andaki sürümle yapılır; canlı
       nesneden okunursa kural hiçbir zaman tetiklenmez. */
    satir.rowVersion = kayit ? Number(kayit.RowVersion) : null;
    satir.kayitUretim = kayit ? sayi(kayit.Uretim) : 0;
    satir.kayitSatis = kayit ? sayi(kayit.Satis) : 0;
    satir.baslangicUretim = satir.kayitUretim;
    satir.baslangicSatis = satir.kayitSatis;
    satir.taban = satir.sabitTaban
      ? stok.mevcut
      : YU.yuvarla(stok.mevcut - satir.kayitUretim + satir.kayitSatis);
  }

  function satirVerisiTazele(satir) {
    satirVerisiKur(satir, YU.stok.malzemeStok(YU.db, satir.malzeme.Id, satir.tarih));
    if (satir.uretimAlan) satir.uretimAlan.ayarla(satir.kayit ? satir.baslangicUretim : null).hataGoster('');
    if (satir.satisAlan) satir.satisAlan.ayarla(satir.kayit ? satir.baslangicSatis : null).hataGoster('');
  }

  function alanSayisi(alan) { return alan.deger(); }

  /* Geçersiz metin olduğu gibi servise gider: "sayı olmalı" mesajını doğrulama
     katmanı kullanıcının yazdığı metinle üretsin, kural iki yere kopyalanmasın. */
  function gonderilecek(alan) {
    var v = alan.deger();
    return isFinite(v) ? v : alan.girdi.value;
  }

  function satirDegisti(satir) {
    var v;
    if (!satir.kilitliUretim) {
      v = alanSayisi(satir.uretimAlan);
      if (!isFinite(v) || YU.yuvarla(v) !== satir.baslangicUretim) return true;
    }
    if (!satir.kilitliSatis) {
      v = alanSayisi(satir.satisAlan);
      if (!isFinite(v) || YU.yuvarla(v) !== satir.baslangicSatis) return true;
    }
    return false;
  }

  function degisenSatirlar(d) {
    var liste = [], i;
    for (i = 0; i < d.satirlar.length; i++) {
      if (satirDegisti(d.satirlar[i])) liste.push(d.satirlar[i]);
    }
    return liste;
  }

  /* ==================================================================
     3. Canlı hesap — gün sonu stok, durum rozeti, uyarılar
     ================================================================== */

  function satirTazele(satir) {
    var u = satir.kilitliUretim ? satir.kayitUretim : alanSayisi(satir.uretimAlan);
    var s = satir.kilitliSatis ? satir.kayitSatis : alanSayisi(satir.satisAlan);
    var gecerli = isFinite(u) && isFinite(s);
    var sonuc = satir.sabitTaban ? satir.taban : YU.yuvarla(satir.taban + u - s);

    satir.gecerli = gecerli;
    satir.sonuc = gecerli ? sonuc : NaN;
    satir.negatif = gecerli && sonuc < -YU.hesap.TOLERANS;
    satir.degisti = satirDegisti(satir);

    satir.sonucHucre.textContent = gecerli ? YU.fmt.kg(sonuc) : '—';
    satir.sonucHucre.style.color = satir.negatif ? 'var(--olumsuz)' : '';

    /* Satır işareti derinlik gölgesi değil, tasarım referansındaki
       "inset 3px vurgu çizgisi" dili — koyu temada da geçerli. */
    if (satir.tr) satir.tr.style.boxShadow = satir.negatif ? 'inset 3px 0 0 var(--olumsuz)' : '';

    durumHucresiTazele(satir);
  }

  function durumHucresiTazele(satir) {
    var kap = YU.bos(satir.durumHucre);
    if (satir.pasif) kap.appendChild(YU.ui.rozet('Pasif', 'bekleyen'));
    if (!satir.gecerli) kap.appendChild(YU.ui.rozet('Geçersiz', 'olumsuz'));
    else if (satir.degisti) kap.appendChild(YU.ui.rozet('Değişti', 'bekleyen'));
    else if (satir.kayit) kap.appendChild(YU.ui.rozet('Kayıtlı', 'olumlu'));
    else kap.appendChild(YU.ui.rozet('Giriş Yok', 'notr'));
    if (satir.negatif) kap.appendChild(YU.ui.rozet('Negatif Stok', 'olumsuz'));
  }

  function ozetTazele(d) {
    var degisen = 0, negatif = [], gecersiz = 0, i, satir;
    for (i = 0; i < d.satirlar.length; i++) {
      satir = d.satirlar[i];
      if (satir.degisti) degisen++;
      if (!satir.gecerli) gecersiz++;
      if (satir.negatif) negatif.push(satir);
    }

    d.kaydetDugmesi.disabled = degisen === 0;
    d.geriDugmesi.disabled = degisen === 0;
    d.ozetMetin.textContent = degisen === 0
      ? 'Kaydedilmemiş değişiklik yok.'
      : YU.fmt.sayi(degisen) + ' satır değiştirildi, henüz kaydedilmedi.' +
        (gecersiz ? ' ' + YU.fmt.sayi(gecersiz) + ' satırda sayı olmayan değer var.' : '');

    YU.bos(d.uyariKap);
    if (!negatif.length) return;

    /* Şartname §13 Soru 3: basit malzeme stoğu negatife düşerse uyarı verilir,
       kayıt engellenmez. */
    var liste = YU.h('ul');
    for (i = 0; i < negatif.length; i++) {
      liste.appendChild(YU.h('li', {
        metin: negatif[i].malzeme.Ad + ' · gün sonu ' + YU.fmt.kgU(negatif[i].sonuc)
      }));
    }
    var serit = YU.ui.serit({
      tur: 'uyari',
      baslik: negatif.length === 1
        ? 'Bir malzemenin stoğu negatife düşüyor'
        : YU.fmt.sayi(negatif.length) + ' malzemenin stoğu negatife düşüyor',
      metin: 'Kayıt engellenmez (Şartname §13 Soru 3). Giriş sırasını ve devir stoğu kontrol edin.'
    });
    serit.querySelector('.yu-serit-govde').appendChild(liste);
    d.uyariKap.appendChild(serit);
  }

  /* ==================================================================
     4. Kaydetme ve geri alma
     ================================================================== */

  function kaydet(d) {
    var degisen = degisenSatirlar(d), hatalar = [], uyarilar = [], basarili = 0, i, satir, girdi, s;
    YU.bos(d.hataKap);
    if (!degisen.length) {
      YU.ui.bildir('Kaydedilecek değişiklik yok.', 'bilgi');
      return;
    }

    for (i = 0; i < degisen.length; i++) {
      satir = degisen[i];
      girdi = { tarih: d.tarih, malzemeId: satir.malzeme.Id, rowVersion: satir.rowVersion };
      /* Kilitli kolon hiç gönderilmez: gönderilirse doğrulama katmanı kilidi
         hata olarak döndürür (03-dogrulama, Şartname §7). */
      if (!satir.kilitliUretim) girdi.uretim = gonderilecek(satir.uretimAlan);
      if (!satir.kilitliSatis) girdi.satis = gonderilecek(satir.satisAlan);

      s = YU.servis.malzemeHareketKaydet(YU.db, girdi, YU.oturum.kullanici);
      if (s.uyarilar && s.uyarilar.length) uyarilar = uyarilar.concat(s.uyarilar);

      if (s.ok) {
        basarili++;
        satirVerisiTazele(satir);
      } else {
        hatalar = hatalar.concat(s.hatalar);
        if (s.hatalar.length) {
          (satir.kilitliUretim ? satir.satisAlan : satir.uretimAlan).hataGoster(s.hatalar[0].mesaj);
        }
      }
    }

    for (i = 0; i < d.satirlar.length; i++) satirTazele(d.satirlar[i]);
    gunDurumuTazele(d);
    ozetTazele(d);
    YU.donem.tazele();          /* kenar çubuğundaki kayıtlı gün sayacı tazelensin */

    if (hatalar.length) d.hataKap.appendChild(YU.ui.hataListesi(hatalar, 'hata'));
    if (uyarilar.length) d.hataKap.appendChild(YU.ui.hataListesi(uyarilar, 'uyari'));

    if (!hatalar.length) {
      YU.ui.bildir(YU.fmt.sayi(basarili) + ' satır kaydedildi · ' + YU.fmt.tarih(d.tarih), 'basari');
    } else if (basarili) {
      YU.ui.bildir(YU.fmt.sayi(basarili) + ' satır kaydedildi, ' +
        YU.fmt.sayi(degisen.length - basarili) + ' satır reddedildi.', 'uyari');
    } else {
      YU.ui.bildir('Hiçbir satır kaydedilmedi.', 'hata');
    }
  }

  function geriAl(d) {
    var i, satir;
    for (i = 0; i < d.satirlar.length; i++) {
      satir = d.satirlar[i];
      if (satir.uretimAlan) satir.uretimAlan.ayarla(satir.kayit ? satir.baslangicUretim : null).hataGoster('');
      if (satir.satisAlan) satir.satisAlan.ayarla(satir.kayit ? satir.baslangicSatis : null).hataGoster('');
      satirTazele(satir);
    }
    YU.bos(d.hataKap);
    ozetTazele(d);
    YU.ui.bildir('Değişiklikler geri alındı.', 'bilgi');
  }

  /* ==================================================================
     5. Yönlendirme — kaydedilmemiş değişiklik varken onay sorulur
     ================================================================== */

  function ayrilmaOnayi(d) {
    var degisen = degisenSatirlar(d).length;
    return YU.ui.onay({
      baslik: 'Kaydedilmemiş Değişiklik Var',
      metin: YU.fmt.tarih(d.tarih) + ' günü için ' + YU.fmt.sayi(degisen) +
        ' satır değiştirildi ama kaydedilmedi. Devam ederseniz bu değişiklikler kaybolur.',
      onayMetni: 'Kaydetmeden çık',
      iptalMetni: 'Sayfada kal',
      tehlike: true
    });
  }

  function sayfayaGit(d, kod, param) {
    if (!degisenSatirlar(d).length) { YU.git(kod, param); return; }
    ayrilmaOnayi(d).then(function (ok) { if (ok) YU.git(kod, param); });
  }

  function tarihIste(d, yeni) {
    if (!gecerliTarih(yeni)) { d.tarihAlan.ayarla(d.tarih); return; }
    if (yeni === d.tarih) return;
    if (!degisenSatirlar(d).length) { YU.git(KOD, { tarih: yeni }); return; }
    ayrilmaOnayi(d).then(function (ok) {
      if (ok) YU.git(KOD, { tarih: yeni });
      else d.tarihAlan.ayarla(d.tarih);
    });
  }

  /* ==================================================================
     6. Üst blok — tarih seçici ve günün kayıt durumu
     ================================================================== */

  function gunDurumuTazele(d) {
    var kap = YU.bos(d.durumKap);
    var g = gunKaydi(d.tarih);

    var rozetler = satirKap('center', 8);
    if (!g) {
      rozetler.appendChild(YU.ui.rozet('Kayıt Yok', 'notr'));
    } else {
      rozetler.appendChild(YU.ui.rozet(YU.fmt.sayi(g.malzemeSayisi) + ' Malzeme Satırı', 'olumlu'));
      rozetler.appendChild(YU.ui.rozet(
        g.kuruKuspeVar ? 'Kuru Küspe Girildi' : 'Kuru Küspe Girilmedi',
        g.kuruKuspeVar ? 'vurgu' : 'bekleyen'
      ));
    }

    var alt = YU.h('div', {
      sinif: 'yu-yardim',
      metin: g && g.sonGuncelleme
        /* Şartname §7 arayüz iyileştirmesi: üzerine yazmadan önce o günü kimin
           ne zaman girdiği görünmeli. */
        ? 'Son giriş ' + YU.fmt.tarihSaat(g.sonGuncelleme) + (g.kullanici ? ' · ' + g.kullanici : '')
        : 'Bu gün için henüz malzeme girişi yapılmamış.'
    });

    var kutu = sutunKap(7);
    kutu.appendChild(rozetler);
    kutu.appendChild(alt);
    kap.appendChild(kutu);
  }

  /* Tarih seçici ve gün durumu ayrı bir panel değil, Günlük Üretim ve Satış
     panelinin üst bloğudur — iki ayrı panel kafa karıştırıyordu. */
  function ustBlok(d) {
    var bugun = YU.tarih.bugun();

    d.tarihAlan = YU.ui.alan({
      etiket: 'Giriş Tarihi',
      tip: 'tarih',
      deger: d.tarih,
      genislik: 178,
      yardim: YU.fmt.tarihUzun(d.tarih) + ' · ' + YU.fmt.gunAdi(d.tarih),
      onChange: function () { tarihIste(d, d.tarihAlan.girdi.value); }
    });

    var hizli = satirKap('center', 6);
    hizli.appendChild(YU.ui.dugme({
      metin: 'Önceki Gün', kucuk: true, tur: 'sade',
      onClick: function () { tarihIste(d, YU.tarih.ekle(d.tarih, -1)); }
    }));
    hizli.appendChild(YU.ui.dugme({
      metin: 'Sonraki Gün', kucuk: true, tur: 'sade',
      /* İleri yürüme geçmiş günleri düzeltmek içindir; bugünden öteye
         geçilemez — gelecek güne kayıt D17 ile zaten reddedilir. */
      pasif: d.tarih >= bugun,
      baslik: d.tarih >= bugun ? 'Bugünden sonrasına kayıt girilemez' : '',
      onClick: function () { tarihIste(d, YU.tarih.ekle(d.tarih, 1)); }
    }));
    hizli.appendChild(YU.ui.dugme({
      metin: 'Bugün', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
      pasif: d.tarih === bugun,
      onClick: function () { tarihIste(d, bugun); }
    }));

    d.durumKap = YU.h('div');
    gunDurumuTazele(d);

    var solBlok = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '0', alignItems: 'flex-start' }
    });
    solBlok.appendChild(d.tarihAlan.kok);
    solBlok.appendChild(hizli);

    var satir = satirKap('flex-start', 18);
    satir.style.justifyContent = 'space-between';
    satir.appendChild(solBlok);
    satir.appendChild(d.durumKap);

    return YU.h('div', {
      stil: { padding: '16px 18px', borderBottom: '1px solid var(--ayrac)' }
    }, satir);
  }

  /* Panel gövdesi: üstte tarih bloğu, altında tablo ya da boş durum. */
  function girisPaneli(d, icerik) {
    var govde = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', minWidth: '0' }
    });
    govde.appendChild(ustBlok(d));
    govde.appendChild(icerik);

    return YU.ui.panel({
      baslik: 'Günlük Üretim ve Satış',
      ikon: '#ic-pencil',
      dolgusuz: true,
      sag: YU.h('span', { metin: YU.fmt.sayi(d.satirlar.length) + ' malzeme · ' + YU.fmt.tarih(d.tarih) }),
      govde: govde
    });
  }

  /* ==================================================================
     7. Tablo
     ================================================================== */

  function kilitliHucre(deger, otomatik, soluk) {
    var kutu = satirKap('center', 8);
    kutu.style.justifyContent = 'flex-end';
    if (otomatik) kutu.appendChild(YU.ui.rozet('Otomatik', 'vurgu'));
    kutu.appendChild(YU.h('span', {
      sinif: 'yu-mono' + (soluk ? ' yu-zayif' : ''),
      metin: YU.fmt.kg(deger)
    }));
    return kutu;
  }

  function malzemeHucresi(d, satir) {
    var ustSatir = satirKap('center', 8);
    ustSatir.appendChild(YU.h('span', { sinif: 'yu-guclu', metin: satir.malzeme.Ad }));
    if (satir.pasif) ustSatir.appendChild(YU.ui.rozet('Pasif', 'bekleyen'));

    var kutu = sutunKap(4);
    kutu.appendChild(ustSatir);

    if (satir.yardim) {
      var yardim = YU.h('div', { sinif: 'yu-yardim' }, satir.yardim + ' ');
      if (satir.baglanti) {
        yardim.appendChild(YU.h('a', {
          href: '#/kuru-kuspe?tarih=' + encodeURIComponent(d.tarih),
          metin: 'ekranı aç',
          onClick: function (e) {
            e.preventDefault();
            sayfayaGit(d, 'kuru-kuspe', { tarih: d.tarih });
          }
        }));
      }
      kutu.appendChild(yardim);
    }
    return kutu;
  }

  function girdiHucresi(d, satir, alanAdi, baslangic) {
    /* Birim alanın içinde tekrar edilmiyor: kolon başlığı zaten "(Kg)" diyor ve
       içerideki ek, dar ekranda sayının üstüne biniyor. */
    var alan = YU.ui.alan({
      tip: 'sayi',
      deger: satir.kayit ? baslangic : null,
      onInput: function () {
        if (satir.uretimAlan) satir.uretimAlan.hataGoster('');
        if (satir.satisAlan) satir.satisAlan.hataGoster('');
        satirTazele(satir);
        ozetTazele(d);
      }
    });
    satir[alanAdi] = alan;
    return alan.kok;
  }

  function tabloPaneli(d) {
    var sutunlar = [
      { baslik: 'Malzeme' },
      { baslik: 'Üretim (Kg)', genislik: 190, hiza: 'sag' },
      { baslik: 'Satış (Kg)', genislik: 190, hiza: 'sag' },
      { baslik: 'Gün Sonu Stok', genislik: 150, hiza: 'sag', mono: true },
      { baslik: 'Durum', genislik: 168 }
    ];

    var satirlar = [], i, satir, uretimHucre, satisHucre;

    for (i = 0; i < d.satirlar.length; i++) {
      satir = d.satirlar[i];

      uretimHucre = satir.kilitliUretim
        ? kilitliHucre(satir.kayitUretim, !satir.pasif, satir.pasif)
        : girdiHucresi(d, satir, 'uretimAlan', satir.baslangicUretim);
      satisHucre = satir.kilitliSatis
        ? kilitliHucre(satir.kayitSatis, !satir.pasif, satir.pasif)
        : girdiHucresi(d, satir, 'satisAlan', satir.baslangicSatis);

      satir.sonucHucre = YU.h('span', { metin: '—' });
      satir.durumHucre = satirKap('center', 6);

      satirlar.push([
        malzemeHucresi(d, satir),
        uretimHucre,
        satisHucre,
        satir.sonucHucre,
        satir.durumHucre
      ]);
    }

    var sar = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      sik: false,        /* giriş alanlı düzenleme tablosu — sık stil daraltmaz */
      bos: 'Aktif malzeme bulunamadı.',
      yapiskan: true
    });

    /* Giriş hücreleri sıkışınca sayı okunmaz hâle geliyor: tablo daralmak
       yerine dar ekranda kendi kabında yatay kaysın (tema.css ≤900px'te
       yapışkan varyantı kaydırmaya geri düşürür). */
    var tablo = sar.querySelector('table');
    if (tablo) tablo.style.minWidth = '860px';

    var trler = sar.querySelectorAll('tbody tr');
    for (i = 0; i < d.satirlar.length && i < trler.length; i++) d.satirlar[i].tr = trler[i];

    return girisPaneli(d, sar);
  }

  /* ==================================================================
     8. Alt bar
     ================================================================== */

  function altBar(d) {
    d.ozetMetin = YU.h('div', { sinif: 'yu-yardim' });

    d.kaydetDugmesi = YU.ui.dugme({
      metin: 'Kaydet', ikon: '#ic-plus', tur: 'birincil',
      onClick: function () { kaydet(d); }
    });
    d.geriDugmesi = YU.ui.dugme({
      metin: 'Değişiklikleri Geri Al', ikon: '#ic-dots', tur: 'ikincil',
      onClick: function () { geriAl(d); }
    });

    var dugmeler = satirKap('center', 8);
    dugmeler.appendChild(d.geriDugmesi);
    dugmeler.appendChild(d.kaydetDugmesi);

    var sol = sutunKap(4);
    sol.appendChild(YU.h('div', {
      stil: { font: '500 14.5px/1.4 var(--font)', color: 'var(--metin)' },
      metin: YU.fmt.tarih(d.tarih) + ' günü için ' + YU.fmt.sayi(d.satirlar.length) + ' satır'
    }));
    sol.appendChild(d.ozetMetin);

    var satir = satirKap('center', 14);
    satir.style.justifyContent = 'space-between';
    satir.appendChild(sol);
    satir.appendChild(dugmeler);

    return YU.ui.panel({ govde: satir });
  }

  /* ==================================================================
     9. Sayfa
     ================================================================== */

  function satirlariKur(d) {
    var hepsi = YU.stok.tumMalzemeler(YU.db, d.tarih), i, m, ozel, kayit, satir;

    for (i = 0; i < hepsi.length; i++) {
      m = hepsi[i].malzeme;
      ozel = m.OzelTip || null;
      kayit = hareketBul(d.tarih, m.Id);
      /* Pasif malzeme yeni hareket almaz (D12) ama o güne kaydı varsa
         gizlenmez — gizlenirse gün sonu toplamı ekranda eksik görünür. */
      if (m.Aktif === false && !kayit) continue;

      satir = {
        tarih: d.tarih,
        malzeme: m,
        ozel: ozel,
        pasif: m.Aktif === false,
        sabitTaban: ozel === 'DokmeKuruKuspe',
        kilitliUretim: m.Aktif === false || ozel === 'DokmeKuruKuspe' || ozel === 'CuvalKuruKuspe',
        kilitliSatis: m.Aktif === false || ozel === 'DokmeKuruKuspe',
        yardim: null,
        baglanti: false
      };

      if (ozel === 'DokmeKuruKuspe') {
        satir.yardim = 'Üretim ve satış kilitli — Kuru Küspe Günlük Giriş ekranından gelir.';
        satir.baglanti = true;
      } else if (ozel === 'CuvalKuruKuspe') {
        satir.yardim = 'Üretim kilitli — çuvallanan adetten hesaplanır (1 çuval = ' +
          YU.fmt.sayi(YU.hesap.CUVAL_KG) + ' kg). Satış bu ekrandan girilir.';
        satir.baglanti = true;
      } else if (satir.pasif) {
        satir.yardim = 'Pasif malzeme — yeni hareket girilemez (D12).';
      }

      satirVerisiKur(satir, hepsi[i]);
      d.satirlar.push(satir);
    }
  }

  function ciz(kap, param) {
    var d = {
      tarih: gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun(),
      satirlar: [],
      /* display:contents — boşken kabın 20px'lik ızgara boşluğunu tüketmesin,
         doluyken şerit doğrudan sayfa akışına girsin. */
      hataKap: YU.h('div', { stil: { display: 'contents' } }),
      uyariKap: YU.h('div', { stil: { display: 'contents' } })
    };
    var i;

    satirlariKur(d);

    YU.ui.sayfaEylemleri(
      YU.ui.dugme({
        metin: 'Kuru Küspe Girişi', ikon: '#ic-plus', tur: 'ikincil',
        onClick: function () { sayfayaGit(d, 'kuru-kuspe', { tarih: d.tarih }); }
      }),
      YU.ui.dugme({
        metin: 'Günlük Rapor', ikon: '#ic-doc', tur: 'sade',
        onClick: function () { sayfayaGit(d, 'gunluk-rapor', { tarih: d.tarih }); }
      })
    );

    if (!d.satirlar.length) {
      kap.appendChild(girisPaneli(d, YU.ui.bosDurum({
        ikon: '#ic-pencil',
        baslik: 'Aktif Malzeme Yok',
        metin: 'Giriş yapılabilmesi için en az bir aktif malzeme gerekiyor. Malzemeler Malzeme Yönetimi ekranından açılır.',
        eylemler: YU.yonetici()
          ? [YU.ui.dugme({
              metin: 'Malzeme Yönetimi', ikon: '#ic-gear', tur: 'birincil',
              onClick: function () { YU.git('malzeme-yonetimi'); }
            })]
          : []
      })));
      return;
    }

    kap.appendChild(tabloPaneli(d));
    kap.appendChild(d.uyariKap);
    kap.appendChild(d.hataKap);
    kap.appendChild(altBar(d));

    for (i = 0; i < d.satirlar.length; i++) satirTazele(d.satirlar[i]);
    ozetTazele(d);
  }

  YU.sayfaTanimla({
    kod: KOD,
    baslik: 'Malzeme Girişi',
    altBaslik: function (param) {
      var t = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
      return YU.fmt.tarihUzun(t) + ' · ' + YU.fmt.gunAdi(t) +
        ' · kuru küspe kolonları otomatik doldurulur';
    },
    ikon: '#ic-list-plus',
    grup: 'Giriş',
    rol: 'Hepsi',
    ciz: ciz
  });
})();

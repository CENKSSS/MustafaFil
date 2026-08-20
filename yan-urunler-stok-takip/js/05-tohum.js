/* js/05-tohum.js — referans kampanya tohum verisi (SOZLESME.md §2).

   İki kampanya üretilir ve satırların HİÇBİRİ elle yazılmaz; hepsi
   YU.servis.* üzerinden geçer. Sebebi: tohum verisi de D1–D16'dan geçsin,
   ekranlardaki rakamlar kuralların ürettiği rakam olsun.

     2024/2025 · devir 16.09.2024 ·  10 gün — Şartname §5'teki "en son devir"
                                              kuralı ancak iki devir satırı
                                              varken gerçekten sınanır.
     2025/2026 · devir 15.09.2025 · 128 gün — ekranların dolu olduğu kampanya.

   Rakamların tamamı YU.rastgele(TOHUM) ile üretilir: aynı tohum aynı veri
   (SOZLESME §2 "PRNG kuralı"). Math.random() hiçbir yerde yok. */
(function () {
  "use strict";

  var YU = window.YU;

  var TOHUM = 20250915;        // veri akışı
  var DAMGA_TOHUMU = 20250922; // denetim damgaları — veri akışını kaydırmasın diye ayrı

  var DOKME_AD = "Dökme Kuru Küspe";
  var CUVAL_AD = "Kuru Küspe (50 Kg)";

  /* Basit malzemelerin günlük aralıkları (kg). Sıra SOZLESME §1'deki
     malzeme sırasını izler; dökme ve çuvallı burada yok — üretimleri
     Kuru Küspe Günlük Giriş'ten otomatik gelir (Şartname §4). */
  var MALZEME_PLANI = [
    { ad: "Yaş Küspe (Tonluk)", uretim: [180000, 260000], adim: 10, satisOrani: [0.75, 1.00] },
    { ad: "Yaş Küspe (25'lik)", uretim: [8000, 15000], adim: 10, satisOrani: [0.75, 1.00] },
    { ad: "Atık Kuru Küspe", uretim: [500, 2500], adim: 10, satisSeyrek: 0.34, satisAralik: [2000, 6000] },
    { ad: "Kuyruk", uretim: [20000, 45000], adim: 10, satisAralik: [15000, 40000] },
    { ad: "Toprak", uretim: [60000, 120000], adim: 10, satisAralik: [0, 30000] }
  ];

  /* Şartname §4: hiç dökme satış yapılmazsa silolar 12–37 günde dolar. O yüzden
     satış her gün üretimi takip eder. Eğri, toplam doluluğun kampanya boyunca
     izleyeceği yol (gün oranı -> doluluk oranı); satış miktarı bu hedefi
     tutturmak için hesaplanır. Bant %25–%75 içinde, kenarlara pay bırakılarak. */
  var HEDEF_2025 = [
    [0.00, 0.325], [0.15, 0.420], [0.30, 0.520], [0.45, 0.470],
    [0.60, 0.550], [0.75, 0.480], [0.90, 0.580], [1.00, 0.550]
  ];
  var HEDEF_2024 = [[0.00, 0.283], [1.00, 0.315]];

  var GUNLUK_SEVKIYAT_TAVANI = 450000; // kg — bir günde silolardan çıkabilecek makul üst sınır

  var KAMPANYALAR = [
    {
      ad: "2024/2025",
      devirTarihi: "2024-09-16",
      gunSayisi: 10,
      siloDevir: [1150000, 780000, 620000],
      malzemeDevir: {
        "Yaş Küspe (Tonluk)": 145000,
        "Yaş Küspe (25'lik)": 22000,
        "Kuru Küspe (50 Kg)": 68500,
        "Atık Kuru Küspe": 9400,
        "Kuyruk": 31000,
        "Toprak": 74000
      },
      hedefEgrisi: HEDEF_2024,
      durumBGunleri: [],
      satisSifirGunleri: []
    },
    {
      ad: "2025/2026",
      devirTarihi: "2025-09-15",
      gunSayisi: 128,
      siloDevir: [980000, 1240000, 705000],
      malzemeDevir: {
        "Yaş Küspe (Tonluk)": 168000,
        "Yaş Küspe (25'lik)": 26500,
        "Kuru Küspe (50 Kg)": 84000,
        "Atık Kuru Küspe": 12600,
        "Kuyruk": 38500,
        "Toprak": 91000
      },
      hedefEgrisi: HEDEF_2025,
      /* Kurutma tesisi arızası: 05–06.01.2026 ardışık, 11.01 ve 16.01 ayrı.
         O günlerde çuvallanan üretileni aşar -> Durum B (Şartname §4). */
      durumBGunleri: [112, 113, 118, 123],
      /* 01.01.2026 — kampanya kesintisiz sürer ama yılbaşında sevkiyat yok. */
      satisSifirGunleri: [108]
    }
  ];

  /* ---------------------------------------------------------------
     Küçük yardımcılar
     --------------------------------------------------------------- */

  function iki(n) { return (n < 10 ? "0" : "") + n; }

  function adimla(deger, adim) {
    if (!adim || adim <= 1) return Math.round(deger);
    return Math.round(deger / adim) * adim;
  }

  function toplamDizi(dizi) {
    var t = 0, i;
    for (i = 0; i < dizi.length; i++) t += dizi[i];
    return t;
  }

  function egri(noktalar, oran) {
    var i, x0, y0, x1, y1, t;
    if (oran <= noktalar[0][0]) return noktalar[0][1];
    for (i = 1; i < noktalar.length; i++) {
      if (oran <= noktalar[i][0]) {
        x0 = noktalar[i - 1][0]; y0 = noktalar[i - 1][1];
        x1 = noktalar[i][0]; y1 = noktalar[i][1];
        t = x1 === x0 ? 0 : (oran - x0) / (x1 - x0);
        return y0 + (y1 - y0) * t;
      }
    }
    return noktalar[noktalar.length - 1][1];
  }

  /* Toplamı ağırlıklara göre böler, her siloyu kendi tavanında tutar ve
     toplamı BİREBİR korur. Birebir olmak zorunda: D3/D5/D13 ±0,01 ile
     karşılaştırır, yuvarlama artığı bırakan bir dağıtım kaydı reddettirir. */
  function dagit(toplam, agirliklar, tavanlar) {
    var n = agirliklar.length, pay = [], i, agirlikToplami = 0, verilen = 0, kalan, enIyi, enBos, bos, ver;

    for (i = 0; i < n; i++) agirlikToplami += agirliklar[i] > 0 ? agirliklar[i] : 0;

    for (i = 0; i < n; i++) {
      var v = agirlikToplami > 0 && agirliklar[i] > 0
        ? Math.floor(toplam * agirliklar[i] / agirlikToplami) : 0;
      if (v > tavanlar[i]) v = tavanlar[i];
      if (v < 0) v = 0;
      pay.push(v);
      verilen += v;
    }

    /* Artan (yuvarlamadan veya tavana takılmadan kalan) miktar, en çok yeri
       olan siloya sırayla eklenir. */
    kalan = toplam - verilen;
    while (kalan > 0) {
      enIyi = -1; enBos = 0;
      for (i = 0; i < n; i++) {
        bos = tavanlar[i] - pay[i];
        if (bos > enBos) { enBos = bos; enIyi = i; }
      }
      if (enIyi < 0) break;
      ver = kalan < enBos ? kalan : enBos;
      pay[enIyi] += ver;
      kalan -= ver;
    }

    return { pay: pay, kalan: kalan };
  }

  /* Değişken oranlı ağırlık: bazı günlerde bir silo hiç kullanılmaz.
     "Hep eşit böl" davranışı tasarım referansındaki tabloyu ölü gösterir. */
  function agirlikUret(taban, rnd, sifirOlasilik) {
    var w = [], i, doluVar = false;
    for (i = 0; i < taban.length; i++) {
      if (taban[i] <= 0 || rnd() < sifirOlasilik) { w.push(0); continue; }
      w.push(taban[i] * (0.35 + 1.3 * rnd()));
      doluVar = true;
    }
    if (!doluVar) {
      for (i = 0; i < taban.length; i++) if (taban[i] > 0) { w[i] = 1; break; }
    }
    return w;
  }

  /* Çuvallama çekişi tek silodan yapılır; hangisi olduğu bakiyeye orantılı seçilir. */
  function siloSec(bakiye, rnd) {
    var t = toplamDizi(bakiye), esik, i;
    if (t <= 0) return 0;
    esik = rnd() * t;
    for (i = 0; i < bakiye.length; i++) {
      esik -= bakiye[i];
      if (esik <= 0) return i;
    }
    return bakiye.length - 1;
  }

  function satirlarUret(siloIdler, paylar) {
    var liste = [], i;
    for (i = 0; i < paylar.length; i++) {
      if (paylar[i] > 0) liste.push({ siloId: siloIdler[i], miktar: paylar[i] });
    }
    return liste;
  }

  function kullaniciBul(depo, kullaniciAdi) {
    var i;
    for (i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].KullaniciAdi === kullaniciAdi) return depo.kullanicilar[i];
    }
    return null;
  }

  function malzemeHaritasi(depo) {
    var h = {}, i;
    for (i = 0; i < depo.malzemeler.length; i++) h[depo.malzemeler[i].Ad] = depo.malzemeler[i];
    return h;
  }

  function siraliSilolar(depo) {
    return depo.silolar.slice().sort(function (a, b) {
      return (Number(a.Sira) || 0) - (Number(b.Sira) || 0) || (a.Id - b.Id);
    });
  }

  /* ---------------------------------------------------------------
     Denetim damgaları
     Servis katmanı OlusturmaTarihi'ni gerçek saatle yazar; 138 günlük tohum
     verisinde bu, bütün kayıtların "bugün aynı saniyede girilmiş" görünmesi
     demek. Şartname §7'nin "bu gün 14:30'da Ahmet tarafından girilmiş"
     uyarısı ve Geçmiş Girişler'in "son güncelleme" sütunu o hâlde anlamsız
     olur. Damgalar iş gününe çekilir; hiçbir kural bu alanlarla hesap yapmaz.
     --------------------------------------------------------------- */

  function damgalariDuzelt(depo) {
    var rnd = YU.rastgele(DAMGA_TOHUMU);
    var saatler = {};
    var i, s;

    function gunDamgasi(iso) {
      if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
      if (!saatler[iso]) {
        saatler[iso] = iso + "T" + iki(rnd.tamsayi(14, 19)) + ":" +
          iki(rnd.tamsayi(0, 59)) + ":" + iki(rnd.tamsayi(0, 59));
      }
      return saatler[iso];
    }

    function isle(satirlar) {
      var j, r, d;
      for (j = 0; j < satirlar.length; j++) {
        r = satirlar[j];
        d = gunDamgasi(r.Tarih);
        if (!d) continue;
        r.OlusturmaTarihi = d;
        if (r.GuncellemeTarihi) r.GuncellemeTarihi = d;
      }
    }

    isle(depo.kuruKuspeGunluk);
    isle(depo.gunlukHareket);
    isle(depo.siloHareket);

    /* Devir satırları kampanya başında, hareketlerden önce girilir. */
    for (i = 0; i < depo.siloDevirStok.length; i++) {
      s = depo.siloDevirStok[i];
      s.OlusturmaTarihi = s.DevirTarihi + "T08:15:00";
    }
    for (i = 0; i < depo.devirStok.length; i++) {
      s = depo.devirStok[i];
      s.OlusturmaTarihi = s.DevirTarihi + "T08:20:00";
    }
  }

  /* ---------------------------------------------------------------
     Servis çağrısı sarmalayıcı — sessiz geçme yok
     --------------------------------------------------------------- */

  function calistir(durum, etiket, tarih, cikti) {
    if (cikti && cikti.ok) return cikti;
    durum.hata += 1;
    if (window.console && window.console.warn) {
      window.console.warn("[tohum] " + YU.fmt.tarih(tarih) + " · " + etiket + " yazılamadı:",
        (cikti && cikti.hatalar) || cikti);
    }
    return cikti;
  }

  /* ---------------------------------------------------------------
     Bir malzemenin günlük üretim/satışı
     --------------------------------------------------------------- */

  function malzemeGunu(plan, rnd, stok) {
    var uretim = adimla(rnd.tamsayi(plan.uretim[0], plan.uretim[1]), plan.adim);
    var satis = 0, tavan;

    if (plan.satisOrani) {
      satis = adimla(uretim * rnd.arasi(plan.satisOrani[0], plan.satisOrani[1]), plan.adim);
    } else if (plan.satisSeyrek !== undefined) {
      /* Atık küspe her gün satılmaz; birikip arada bir topluca çıkar. */
      satis = rnd() < plan.satisSeyrek ? adimla(rnd.tamsayi(plan.satisAralik[0], plan.satisAralik[1]), plan.adim) : 0;
    } else {
      satis = adimla(rnd.tamsayi(plan.satisAralik[0], plan.satisAralik[1]), plan.adim);
    }

    /* Eldekinden fazlası satılamaz: stok negatife düşerse ekran haklı olarak
       uyarı basar ve tohum verisi "tutarlı" olmaktan çıkar. */
    tavan = stok + uretim;
    if (satis > tavan) {
      var a = plan.adim > 1 ? plan.adim : 1;
      satis = Math.floor(tavan / a) * a;
    }
    if (satis < 0) satis = 0;

    return { uretim: uretim, satis: satis };
  }

  /* ---------------------------------------------------------------
     Bir kampanya
     --------------------------------------------------------------- */

  function kampanyaUret(depo, plan, rnd, durum) {
    var silolar = siraliSilolar(depo);
    var malzemeler = malzemeHaritasi(depo);
    var yonetici = kullaniciBul(depo, "yonetici");
    var operatorler = [kullaniciBul(depo, "operator"), kullaniciBul(depo, "operator2")];
    var siloIdler = [], kapasiteler = [], bakiye = [], toplamKapasite = 0;
    var malzemeStok = {}, i, g, ad;

    for (i = 0; i < silolar.length; i++) {
      siloIdler.push(silolar[i].Id);
      kapasiteler.push(Number(silolar[i].Kapasite) || 0);
      toplamKapasite += kapasiteler[i];
    }

    /* 1 — silo devirleri */
    for (i = 0; i < silolar.length; i++) {
      calistir(durum, "silo devri · " + silolar[i].Ad, plan.devirTarihi,
        YU.servis.siloDevirKaydet(depo, {
          siloId: silolar[i].Id,
          devirTarihi: plan.devirTarihi,
          miktar: plan.siloDevir[i] || 0
        }, yonetici));
    }

    /* 2 — malzeme devirleri. Dökme kuru küspenin devri silo devirlerinin
       toplamıdır: stoğu zaten silolardan okunuyor (Şartname §5 KRİTİK),
       devir satırı onunla çelişmemeli. */
    for (i = 0; i < depo.malzemeler.length; i++) {
      ad = depo.malzemeler[i].Ad;
      var miktar = ad === DOKME_AD ? toplamDizi(plan.siloDevir) : plan.malzemeDevir[ad];
      if (miktar === undefined) continue;
      calistir(durum, "malzeme devri · " + ad, plan.devirTarihi,
        YU.servis.devirKaydet(depo, {
          malzemeId: depo.malzemeler[i].Id,
          devirTarihi: plan.devirTarihi,
          miktar: miktar
        }, yonetici));
      if (ad !== DOKME_AD) malzemeStok[ad] = miktar;
    }

    /* Bakiye depodan okunur, plandan değil: devir yazılamamışsa yanlış
       zemin üzerine gün üretmeyelim. */
    for (i = 0; i < silolar.length; i++) {
      bakiye.push(YU.stok.siloGunBasi(depo, silolar[i].Id, plan.devirTarihi));
    }

    /* 3 — günler */
    for (g = 0; g < plan.gunSayisi; g++) {
      var tarih = YU.tarih.ekle(plan.devirTarihi, g);
      var kullanici = operatorler[g % operatorler.length] || yonetici;
      var logBasi = depo.degisiklikLog.length;   // gün sonunda buraya geri sarılır

      var cuvalAdet = rnd.tamsayi(150, 400);
      var cuvalKg = cuvalAdet * YU.hesap.CUVAL_KG;
      var durumB = plan.durumBGunleri.indexOf(g) >= 0;
      var uretilen = durumB
        ? adimla(rnd.tamsayi(Math.round(cuvalKg * 0.10), Math.round(cuvalKg * 0.55)), 10)
        : adimla(rnd.tamsayi(200000, 300000), 10);

      var hesap = YU.hesap.kuruKuspe(uretilen, cuvalAdet, 0);
      var net = hesap.netDokmeUretim;
      var cekilecek = hesap.silodanCekilecek;
      var toplamBakiye = toplamDizi(bakiye);

      /* Satılan dökme: hedef doluluğu tutturacak miktar + günlük dalgalanma. */
      var oran = plan.gunSayisi > 1 ? g / (plan.gunSayisi - 1) : 0;
      var hedef = egri(plan.hedefEgrisi, oran) * toplamKapasite;
      var satisTavan = toplamBakiye - cekilecek;
      if (satisTavan < 0) satisTavan = 0;
      if (satisTavan > GUNLUK_SEVKIYAT_TAVANI) satisTavan = GUNLUK_SEVKIYAT_TAVANI;

      var satis = net - cekilecek - (hedef - toplamBakiye) + rnd.arasi(-18000, 18000);
      if (satis < 0) satis = 0;
      if (satis > satisTavan) satis = satisTavan;
      satis = adimla(satis, 10);
      if (satis > satisTavan) satis = Math.floor(satisTavan);
      if (plan.satisSifirGunleri.indexOf(g) >= 0) satis = 0;

      /* Çıkışlar önce: yerleştirme tavanı ancak çıkışlar bilinince hesaplanır. */
      var tavan = bakiye.slice();
      var cekisPay = [], satisPay = [], yerPay = [], bolum;
      for (i = 0; i < silolar.length; i++) { cekisPay.push(0); satisPay.push(0); yerPay.push(0); }

      if (cekilecek > 0) {
        var secilen = siloSec(tavan, rnd);
        var wc = [];
        for (i = 0; i < silolar.length; i++) wc.push(i === secilen ? 1 : 0);
        bolum = dagit(cekilecek, wc, tavan);
        cekisPay = bolum.pay;
        if (bolum.kalan > 0) calistir(durum, "çuvallama çekişi dağıtılamadı", tarih, null);
        for (i = 0; i < silolar.length; i++) tavan[i] -= cekisPay[i];
      }

      if (satis > 0) {
        bolum = dagit(satis, agirlikUret(tavan, rnd, 0.35), tavan);
        satisPay = bolum.pay;
        if (bolum.kalan > 0) calistir(durum, "dökme satış dağıtılamadı", tarih, null);
        for (i = 0; i < silolar.length; i++) tavan[i] -= satisPay[i];
      }

      if (net > 0) {
        /* D15 gün sonu bakiyesini ölçer: bugünkü çıkışlar yeri boşaltır. */
        var bosluk = [];
        for (i = 0; i < silolar.length; i++) {
          bosluk.push(kapasiteler[i] - (bakiye[i] - cekisPay[i] - satisPay[i]));
        }
        bolum = dagit(net, agirlikUret(bosluk, rnd, 0.25), bosluk);
        yerPay = bolum.pay;
        if (bolum.kalan > 0) calistir(durum, "net dökme üretim dağıtılamadı", tarih, null);
      }

      var sonuc = YU.servis.kuruKuspeKaydet(depo, {
        tarih: tarih,
        uretilenDokme: uretilen,
        cuvalAdet: cuvalAdet,
        satilanDokme: satis,
        yerlestirmeler: satirlarUret(siloIdler, yerPay),
        cekisler: satirlarUret(siloIdler, cekisPay),
        satisCekisleri: satirlarUret(siloIdler, satisPay),
        rowVersion: null
      }, kullanici, { tohumlama: true });

      calistir(durum, "kuru küspe günlük", tarih, sonuc);

      if (sonuc && sonuc.ok) {
        for (i = 0; i < silolar.length; i++) {
          bakiye[i] = bakiye[i] + yerPay[i] - cekisPay[i] - satisPay[i];
        }
        durum.gun += 1;
      }

      /* Basit malzemeler */
      for (i = 0; i < MALZEME_PLANI.length; i++) {
        var mp = MALZEME_PLANI[i];
        var malzeme = malzemeler[mp.ad];
        if (!malzeme) continue;
        var stok = malzemeStok[mp.ad] || 0;
        var gun = malzemeGunu(mp, rnd, stok);
        var mr = YU.servis.malzemeHareketKaydet(depo, {
          tarih: tarih, malzemeId: malzeme.Id,
          uretim: gun.uretim, satis: gun.satis, rowVersion: null
        }, kullanici);
        calistir(durum, mp.ad, tarih, mr);
        if (mr && mr.ok) malzemeStok[mp.ad] = stok + gun.uretim - gun.satis;
      }

      /* Çuvallı kuru küspe: üretim kolonu kilitli (yukarıdaki kayıttan geldi),
         bu ekrandan yalnızca satış girilir (Şartname §4). */
      var cuvalMalzeme = malzemeler[CUVAL_AD];
      if (cuvalMalzeme) {
        var cuvalStok = (malzemeStok[CUVAL_AD] || 0) + (sonuc && sonuc.ok ? cuvalKg : 0);
        var cuvalSatis = rnd.tamsayi(100, 240) * YU.hesap.CUVAL_KG;
        if (cuvalSatis > cuvalStok) cuvalSatis = Math.floor(cuvalStok / YU.hesap.CUVAL_KG) * YU.hesap.CUVAL_KG;
        if (cuvalSatis < 0) cuvalSatis = 0;
        var cr = YU.servis.malzemeHareketKaydet(depo, {
          tarih: tarih, malzemeId: cuvalMalzeme.Id,
          uretim: null, satis: cuvalSatis, rowVersion: null
        }, kullanici);
        calistir(durum, CUVAL_AD, tarih, cr);
        malzemeStok[CUVAL_AD] = cuvalStok - (cr && cr.ok ? cuvalSatis : 0);
      }

      /* kuruKuspeKaydet {tohumlama:true} ile log yazmıyor; malzemeHareketKaydet'in
         böyle bir anahtarı yok ve her çağrıda DegisiklikLog'a satır atıyor. O
         satırlar burada geri alınır. İki sebep: (1) 04-servis.js'in gerekçesi —
         tohum verisi kullanıcı değişikliği değildir, loglanırsa gerçek
         düzeltmeleri gömer; (2) yarısı loglanmış bir denetim izi, aynı günün
         kuru küspe girişini "kayıtsız yapılmış" gösterir. Yan fayda: servis
         katmanının geri-sarma anlık görüntüsü bu tabloyu her çağrıda derin
         kopyalıyor; log boş kalınca tohumlama ölçülebilir biçimde hızlanıyor. */
      depo.degisiklikLog.length = logBasi;
    }
  }

  /* ---------------------------------------------------------------
     Giriş noktası
     --------------------------------------------------------------- */

  YU.tohumla = function (depo) {
    var rnd = YU.rastgele(TOHUM);
    var durum = { gun: 0, hata: 0 };
    var gercekKaydet = depo.kaydet;
    var logKok = depo.degisiklikLog.length;
    var i;

    /* Her servis çağrısı depo.kaydet() çağırıyor. Tohumlama ~1.000 çağrı yapar;
       her birinde büyüyen veriyi baştan JSON'a çevirip localStorage'a yazmak
       O(n²)'dir — ölçümde ilk açılışı birkaç katına çıkarıyordu. Yazma sona
       ertelenir; depo.sifirla() tohumlamadan sonra zaten kaydeder. */
    depo.kaydet = function () {};
    try {
      for (i = 0; i < KAMPANYALAR.length; i++) {
        kampanyaUret(depo, KAMPANYALAR[i], rnd, durum);
      }
      depo.degisiklikLog.length = logKok;   // devir kayıtlarının log satırları da tohum verisidir
      damgalariDuzelt(depo);
    } finally {
      depo.kaydet = gercekKaydet;
    }

    if (window.console && window.console.info) {
      window.console.info("[tohum] " + durum.gun + " gün üretildi · " + durum.hata + " hata.");
    }

    return durum;
  };
})();

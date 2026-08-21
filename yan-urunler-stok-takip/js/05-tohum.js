/* js/05-tohum.js — referans kampanya tohum verisi (SOZLESME.md §2).

   İki kampanya üretilir ve satırların HİÇBİRİ elle yazılmaz; hepsi
   YU.servis.* üzerinden geçer. Sebebi: tohum verisi de D1–D16'dan geçsin,
   ekranlardaki rakamlar kuralların ürettiği rakam olsun.

     2025/2026 · devir 10.06.2026 ·  5 gün — Şartname §5'teki "en son devir"
                                             kuralı ancak iki devir satırı
                                             varken gerçekten sınanır.
     2026/2027 · devir 22.07.2026 · 30 gün — ekranların dolu olduğu kampanya;
                                             son günü bugüne denk gelir.

   Tohumlamanın sonunda ayrıca küçük bir denetim izi üretilir (denetimIzi):
   birkaç düzeltme, bir ekleme ve bir silme DegisiklikLog'a yazılır ki
   Değişiklik Geçmişi ekranı boş kalmasın.

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
    { ad: "Yaş Küspe (Tonluk)", uretim: [18000, 26000], adim: 10, satisOrani: [0.75, 1.00] },
    { ad: "Yaş Küspe (25'lik)", uretim: [800, 1500], adim: 10, satisOrani: [0.75, 1.00] },
    { ad: "Atık Kuru Küspe", uretim: [50, 250], adim: 10, satisSeyrek: 0.34, satisAralik: [200, 600] },
    { ad: "Kuyruk", uretim: [2000, 4500], adim: 10, satisAralik: [1500, 4000] },
    { ad: "Toprak", uretim: [6000, 12000], adim: 10, satisAralik: [0, 3000] }
  ];

  /* Şartname §4: hiç dökme satış yapılmazsa silolar 12–37 günde dolar. O yüzden
     satış her gün üretimi takip eder. Eğri, toplam doluluğun kampanya boyunca
     izleyeceği yol (gün oranı -> doluluk oranı); satış miktarı bu hedefi
     tutturmak için hesaplanır. Bant %25–%75 içinde, kenarlara pay bırakılarak. */
  var HEDEF_ANA = [
    [0.00, 0.118], [0.30, 0.126], [0.55, 0.137], [0.80, 0.144], [1.00, 0.150]
  ];
  var HEDEF_ONCEKI = [[0.00, 0.072], [1.00, 0.078]];

  var GUNLUK_SEVKIYAT_TAVANI = 45000; // kg — bir günde silolardan çıkabilecek makul üst sınır

  var KAMPANYALAR = [
    {
      ad: "2025/2026",
      devirTarihi: "2026-06-10",
      gunSayisi: 5,
      siloDevir: [260000, 210000, 180000],
      malzemeDevir: {
        "Yaş Küspe (Tonluk)": 12000,
        "Yaş Küspe (25'lik)": 1800,
        "Kuru Küspe (50 Kg)": 4200,
        "Atık Kuru Küspe": 600,
        "Kuyruk": 2400,
        "Toprak": 5200
      },
      hedefEgrisi: HEDEF_ONCEKI,
      durumBGunleri: [],
      satisSifirGunleri: [],
      eksikSonGun: []
    },
    {
      ad: "2026/2027",
      devirTarihi: "2026-07-22",
      gunSayisi: 30,
      siloDevir: [420000, 380000, 260000],
      malzemeDevir: {
        "Yaş Küspe (Tonluk)": 18000,
        "Yaş Küspe (25'lik)": 2500,
        "Kuru Küspe (50 Kg)": 6000,
        "Atık Kuru Küspe": 900,
        "Kuyruk": 3200,
        "Toprak": 7500
      },
      hedefEgrisi: HEDEF_ANA,
      /* Kurutma tesisi arızası: 09.08 ve 15.08. O günlerde çuvallanan
         üretileni aşar -> Durum B (Şartname §4). */
      durumBGunleri: [18, 24],
      /* 29.07.2026 — üretim sürer ama o gün sevkiyat yapılmaz. */
      satisSifirGunleri: [7],
      /* Son gün atık küspe satırı unutulmuş; denetim izinde sonradan girilir. */
      eksikSonGun: ["Atık Kuru Küspe"]
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

      var cuvalAdet = rnd.tamsayi(20, 60);
      var cuvalKg = cuvalAdet * YU.hesap.CUVAL_KG;
      var durumB = plan.durumBGunleri.indexOf(g) >= 0;
      var uretilen = durumB
        ? adimla(rnd.tamsayi(Math.round(cuvalKg * 0.10), Math.round(cuvalKg * 0.55)), 10)
        : adimla(rnd.tamsayi(20000, 34000), 10);

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

      var satis = net - cekilecek - (hedef - toplamBakiye) + rnd.arasi(-2200, 2200);
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
      var sonGunMu = g === plan.gunSayisi - 1;
      for (i = 0; i < MALZEME_PLANI.length; i++) {
        var mp = MALZEME_PLANI[i];
        var malzeme = malzemeler[mp.ad];
        if (!malzeme) continue;
        /* Son günde bilerek atlanan malzeme: denetim izi onu sonradan ekler. */
        if (sonGunMu && (plan.eksikSonGun || []).indexOf(mp.ad) >= 0) continue;
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
        var cuvalSatis = rnd.tamsayi(10, 45) * YU.hesap.CUVAL_KG;
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
     Denetim izi — DegisiklikLog satırları
     ---------------------------------------------------------------
     Tohumlamanın kendisi log yazmaz (yukarıdaki gerekçe). Ama Değişiklik
     Geçmişi ekranının boş kalmaması için kampanyanın son iki haftasında
     yapılmış birkaç gerçek düzeltme buradan geçirilir: hepsi YU.servis.*
     çağrısıdır, yani D1–D16 denetiminden geçer. Damgalar elle veriliyor;
     aksi hâlde hepsi "şu an" görünür ve iz gerçekçi olmaz. */

  var LOG_TABLO_ALANI = {
    KuruKuspeGunluk: "kuruKuspeGunluk",
    GunlukHareket: "gunlukHareket",
    SiloHareket: "siloHareket",
    DevirStok: "devirStok",
    SiloDevirStok: "siloDevirStok",
    Kullanicilar: "kullanicilar",
    Malzemeler: "malzemeler"
  };

  function hareketBul(depo, tarih, malzemeId) {
    var i, h;
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.Tarih === tarih && h.MalzemeId === malzemeId) return h;
    }
    return null;
  }

  function devirBul(depo, malzemeId, tarih) {
    var i, d;
    for (i = 0; i < depo.devirStok.length; i++) {
      d = depo.devirStok[i];
      if (d.MalzemeId === malzemeId && d.DevirTarihi === tarih) return d;
    }
    return null;
  }

  function siloDevirBul(depo, siloId, tarih) {
    var i, d;
    for (i = 0; i < depo.siloDevirStok.length; i++) {
      d = depo.siloDevirStok[i];
      if (d.SiloId === siloId && d.DevirTarihi === tarih) return d;
    }
    return null;
  }

  function kuruKuspeBul(depo, tarih) {
    var i;
    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      if (depo.kuruKuspeGunluk[i].Tarih === tarih) return depo.kuruKuspeGunluk[i];
    }
    return null;
  }

  /* O günün silo hareketlerini kaydetme girdisine geri çevirir: gün yeniden
     kaydedilirken eski dağılım korunsun, yalnızca değişen kalem oynasın. */
  function gunSiloSatirlari(depo, tarih) {
    var yer = [], cek = [], sat = [], i, h;
    for (i = 0; i < depo.siloHareket.length; i++) {
      h = depo.siloHareket[i];
      if (h.Tarih !== tarih) continue;
      if (h.HareketTipi === "DokmeUretim") yer.push({ siloId: h.SiloId, miktar: Number(h.GirenKg) || 0 });
      else if (h.HareketTipi === "Cuvallama") cek.push({ siloId: h.SiloId, miktar: Number(h.CikanKg) || 0 });
      else if (h.HareketTipi === "DokmeSatis") sat.push({ siloId: h.SiloId, miktar: Number(h.CikanKg) || 0 });
    }
    return { yerlestirmeler: yer, cekisler: cek, satisCekisleri: sat };
  }

  /* Bir eylemin ürettiği log satırlarını verilen damgayla imzalar. */
  function izle(depo, damga, fn) {
    var bas = depo.degisiklikLog.length, i;
    var sonuc = fn();
    for (i = bas; i < depo.degisiklikLog.length; i++) depo.degisiklikLog[i].Tarih = damga;
    return sonuc;
  }

  /* Log satırının damgası, dokunduğu kaydın güncelleme damgası olur. */
  function kayitDamgalari(depo, logBasi) {
    var i, satir, alan, tablo, j;
    for (i = logBasi; i < depo.degisiklikLog.length; i++) {
      satir = depo.degisiklikLog[i];
      alan = LOG_TABLO_ALANI[satir.Tablo];
      if (!alan || satir.KayitId === null || satir.KayitId === undefined) continue;
      tablo = depo[alan] || [];
      for (j = 0; j < tablo.length; j++) {
        if (tablo[j].Id !== satir.KayitId) continue;
        if (satir.Islem === "Ekle") tablo[j].OlusturmaTarihi = satir.Tarih;
        tablo[j].GuncellemeTarihi = satir.Tarih;
        break;
      }
    }
  }

  function denetimIzi(depo, durum) {
    var plan = KAMPANYALAR[KAMPANYALAR.length - 1];
    var sonGun = YU.tarih.ekle(plan.devirTarihi, plan.gunSayisi - 1);
    var yonetici = kullaniciBul(depo, "yonetici");
    var operator = kullaniciBul(depo, "operator");
    var operator2 = kullaniciBul(depo, "operator2") || operator;
    var malzemeler = malzemeHaritasi(depo);
    var logBasi = depo.degisiklikLog.length;
    var kayit, girdi, m, d, sd, yeniAdet, fark, enBuyuk, i;

    function gun(fark) { return YU.tarih.ekle(sonGun, fark); }

    /* 1 — üç malzeme hareketi düzeltmesi (operatör tartı fişini sonradan görmüş) */
    var duzeltmeler = [
      { ad: "Kuyruk", gunFarki: -15, alan: "satis", ekle: 340, damga: "T09:12:00", kullanici: operator },
      { ad: "Yaş Küspe (Tonluk)", gunFarki: -9, alan: "uretim", ekle: 1250, damga: "T16:40:00", kullanici: operator2 },
      { ad: "Toprak", gunFarki: -6, alan: "satis", ekle: 480, damga: "T08:55:00", kullanici: operator }
    ];
    for (i = 0; i < duzeltmeler.length; i++) {
      (function (d2) {
        m = malzemeler[d2.ad];
        if (!m) return;
        var t = gun(d2.gunFarki);
        var h = hareketBul(depo, t, m.Id);
        if (!h) return;
        var uretim = Number(h.Uretim) || 0;
        var satis = Number(h.Satis) || 0;
        if (d2.alan === "satis") satis += d2.ekle; else uretim += d2.ekle;
        calistir(durum, "düzeltme · " + d2.ad, t, izle(depo, gun(d2.gunFarki + 2) + d2.damga, function () {
          return YU.servis.malzemeHareketKaydet(depo, {
            tarih: t, malzemeId: m.Id, uretim: uretim, satis: satis, rowVersion: h.RowVersion
          }, d2.kullanici);
        }));
      })(duzeltmeler[i]);
    }

    /* 2 — son günde unutulan atık küspe satırı sonradan girildi (Ekle) */
    m = malzemeler["Atık Kuru Küspe"];
    if (m && !hareketBul(depo, sonGun, m.Id)) {
      calistir(durum, "eksik satır · Atık Kuru Küspe", sonGun,
        izle(depo, sonGun + "T09:05:00", function () {
          return YU.servis.malzemeHareketKaydet(depo, {
            tarih: sonGun, malzemeId: m.Id, uretim: 180, satis: 0, rowVersion: null
          }, operator);
        }));
    }

    /* 3 — malzeme devri düzeltmesi: kampanya başı sayımı sonradan revize edildi */
    m = malzemeler["Kuyruk"];
    d = m ? devirBul(depo, m.Id, plan.devirTarihi) : null;
    if (d) {
      calistir(durum, "devir düzeltmesi · Kuyruk", plan.devirTarihi,
        izle(depo, gun(-3) + "T11:20:00", function () {
          return YU.servis.devirKaydet(depo, {
            malzemeId: m.Id, devirTarihi: plan.devirTarihi, miktar: (Number(d.Miktar) || 0) + 260
          }, yonetici);
        }));
    }

    /* 4 — silo açılış düzeltmesi: sayım farkı silo devrine işlendi */
    if (depo.silolar.length) {
      var silo = depo.silolar[depo.silolar.length - 1];
      sd = siloDevirBul(depo, silo.Id, plan.devirTarihi);
      if (sd) {
        calistir(durum, "silo devri düzeltmesi · " + silo.Ad, plan.devirTarihi,
          izle(depo, gun(-3) + "T11:34:00", function () {
            return YU.servis.siloDevirKaydet(depo, {
              siloId: silo.Id, devirTarihi: plan.devirTarihi, miktar: (Number(sd.Miktar) || 0) + 2000
            }, yonetici);
          }));
      }
    }

    /* 5 — yanlış tarihe açılan devir satırı: önce eklendi, sonra silindi.
       Ekle + Sil izi bırakır, veri ise başladığı yere döner. */
    m = malzemeler["Atık Kuru Küspe"];
    if (m) {
      var yanlisTarih = YU.tarih.ekle(plan.devirTarihi, 1);
      calistir(durum, "yanlış devir satırı", yanlisTarih,
        izle(depo, gun(-2) + "T14:05:00", function () {
          return YU.servis.devirKaydet(depo, {
            malzemeId: m.Id, devirTarihi: yanlisTarih, miktar: 640
          }, yonetici);
        }));
      var yanlis = devirBul(depo, m.Id, yanlisTarih);
      if (yanlis) {
        calistir(durum, "yanlış devir satırı silindi", yanlisTarih,
          izle(depo, gun(-2) + "T14:11:00", function () {
            return YU.servis.devirSil(depo, yanlis.Id, "Malzeme", yonetici);
          }));
      }
    }

    /* 6 — malzeme sırası değişti: listede kuyruk toprağın üstüne alındı */
    var kuyruk = malzemeler["Kuyruk"], toprak = malzemeler["Toprak"];
    if (kuyruk && toprak && kuyruk.Sira !== toprak.Sira) {
      var kSira = kuyruk.Sira, tSira = toprak.Sira;
      calistir(durum, "sıra · Toprak", sonGun,
        izle(depo, gun(-1) + "T17:45:00", function () {
          return YU.servis.malzemeKaydet(depo, { Id: toprak.Id, Ad: toprak.Ad, Sira: kSira }, yonetici);
        }));
      calistir(durum, "sıra · Kuyruk", sonGun,
        izle(depo, gun(-1) + "T17:46:00", function () {
          return YU.servis.malzemeKaydet(depo, { Id: kuyruk.Id, Ad: kuyruk.Ad, Sira: tSira }, yonetici);
        }));
    }

    /* 7 — kuru küspe günü düzeltmesi: çuval sayımı iki çuval eksik girilmiş.
       Çuval kg arttığı için net dökme üretim düşer; aradaki fark en büyük
       yerleştirmeden indirilir, yoksa D3 (±0,01) tutmaz. */
    kayit = kuruKuspeBul(depo, sonGun);
    if (kayit) {
      yeniAdet = (Number(kayit.CuvalAdet) || 0) + 2;
      var eskiHesap = YU.hesap.kuruKuspe(kayit.UretilenDokme, kayit.CuvalAdet, kayit.SatilanDokme);
      var yeniHesap = YU.hesap.kuruKuspe(kayit.UretilenDokme, yeniAdet, kayit.SatilanDokme);
      fark = YU.yuvarla(eskiHesap.netDokmeUretim - yeniHesap.netDokmeUretim);
      girdi = gunSiloSatirlari(depo, sonGun);
      enBuyuk = -1;
      for (i = 0; i < girdi.yerlestirmeler.length; i++) {
        if (enBuyuk < 0 || girdi.yerlestirmeler[i].miktar > girdi.yerlestirmeler[enBuyuk].miktar) enBuyuk = i;
      }
      var uygulanabilir = eskiHesap.silodanCekilecek === 0 && yeniHesap.silodanCekilecek === 0 &&
        enBuyuk >= 0 && girdi.yerlestirmeler[enBuyuk].miktar >= fark;
      if (uygulanabilir) {
        girdi.yerlestirmeler[enBuyuk].miktar = YU.yuvarla(girdi.yerlestirmeler[enBuyuk].miktar - fark);
        calistir(durum, "kuru küspe düzeltmesi", sonGun,
          izle(depo, sonGun + "T15:20:00", function () {
            return YU.servis.kuruKuspeKaydet(depo, {
              tarih: sonGun,
              uretilenDokme: kayit.UretilenDokme,
              cuvalAdet: yeniAdet,
              satilanDokme: kayit.SatilanDokme,
              yerlestirmeler: girdi.yerlestirmeler,
              cekisler: girdi.cekisler,
              satisCekisleri: girdi.satisCekisleri,
              rowVersion: kayit.RowVersion
            }, operator2);
          }));
      }
    }

    kayitDamgalari(depo, logBasi);
    return depo.degisiklikLog.length - logBasi;
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
      durum.log = denetimIzi(depo, durum);
    } finally {
      depo.kaydet = gercekKaydet;
    }

    if (window.console && window.console.info) {
      window.console.info("[tohum] " + durum.gun + " gün üretildi · " +
        (durum.log || 0) + " değişiklik kaydı · " + durum.hata + " hata.");
    }

    return durum;
  };
})();

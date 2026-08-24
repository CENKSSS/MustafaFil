/* js/04-servis.js — YU.stok (okuma) + YU.servis (yazma) + YU.log
   Şartname §5 (stok formülleri, DEMİRBAŞ), §4 (yeniden kaydetme), §6 (denetim izi)
   SÖZLEŞME §5

   Tarih alanları: iş tarihleri (Tarih, DevirTarihi) saatsiz ISO metindir.
   Denetim damgaları (OlusturmaTarihi, GuncellemeTarihi, DegisiklikLog.Tarih)
   saatli ISO metindir — §7'deki "bu gün 14:30'da Ahmet tarafından girilmiş"
   uyarısı ve Değişiklik Geçmişi ekranı saati gerektiriyor. */
(function () {
  "use strict";

  var YU = window.YU;

  /* Şartname §6 + görev tanımı: yalnız kritik tablolar loglanır.
     Silolar bilinçli olarak dışarıda — hareket üretmez, sayısı sabittir. */
  var LOGLANAN_TABLOLAR = [
    "KuruKuspeGunluk", "GunlukHareket", "SiloHareket",
    "DevirStok", "SiloDevirStok", "Kullanicilar", "Malzemeler"
  ];

  var ALAN_ADI = {
    UretilenDokme: "Üretilen Dökme", CuvalAdet: "Çuval Adedi", CuvalKg: "Çuval Kg",
    SatilanDokme: "Satılan Dökme", Uretim: "Üretim", Satis: "Satış", Iade: "İade",
    Miktar: "Miktar", DevirTarihi: "Devir Tarihi", Tarih: "Tarih",
    Ad: "Ad", Birim: "Birim", Sira: "Sıra", OzelTip: "Özel Tip", Aktif: "Durum",
    Rol: "Rol", AdSoyad: "Ad Soyad", KullaniciAdi: "Kullanıcı Adı",
    ParolaHash: "Parola", Kapasite: "Kapasite"
  };

  /* ---------- ortak yardımcılar ---------- */

  function bugun() { return YU.tarih.bugun(); }

  /* Denetim damgası: yerel saatli ISO metin. new Date(metin) bunu yerel saat
     olarak okur; 'Z' eklenirse saat kayar. */
  function simdi() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" +
      p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  function satirBul(tablo, id) {
    var i;
    for (i = 0; i < tablo.length; i++) if (tablo[i].Id === id) return tablo[i];
    return null;
  }

  function kimlik(v) {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function say(v) {
    var n = typeof v === "number" ? v : Number(v);
    return isFinite(n) ? YU.yuvarla(n) : 0;
  }

  function oku(v) {
    if (v === null || v === undefined || v === "") return 0;
    var n = typeof v === "number" ? v : YU.parse.sayi(String(v));
    return isFinite(n) ? YU.yuvarla(n) : 0;
  }

  function siraliKopya(dizi) {
    return dizi.slice().sort(function (a, b) {
      var x = Number(a.Sira) || 0, y = Number(b.Sira) || 0;
      if (x !== y) return x - y;
      return (a.Id || 0) - (b.Id || 0);
    });
  }

  function grupla(dizi, alan) {
    var g = {}, i, k;
    for (i = 0; i < dizi.length; i++) {
      k = dizi[i][alan];
      (g[k] || (g[k] = [])).push(dizi[i]);
    }
    return g;
  }

  function kuruKuspeGunuBul(depo, tarih) {
    var i;
    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      if (depo.kuruKuspeGunluk[i].Tarih === tarih) return depo.kuruKuspeGunluk[i];
    }
    return null;
  }

  function gunlukHareketBul(depo, tarih, malzemeId) {
    var i, h;
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.Tarih === tarih && h.MalzemeId === malzemeId) return h;
    }
    return null;
  }

  function ozelTipliMalzeme(depo, tip) {
    var i;
    for (i = 0; i < depo.malzemeler.length; i++) {
      if (depo.malzemeler[i].OzelTip === tip) return depo.malzemeler[i];
    }
    return null;
  }

  function kullaniciAdiBul(depo, id) {
    var k = id === null || id === undefined ? null : satirBul(depo.kullanicilar, id);
    return k ? k.AdSoyad : null;
  }

  function sonuc(ok, hatalar, uyarilar, kayit) {
    return { ok: ok, hatalar: hatalar || [], uyarilar: uyarilar || [], kayit: kayit || null };
  }

  function hataSatiri(kod, mesaj) { return { kod: kod, mesaj: mesaj }; }

  /* ---------- "ya hep ya hiç" ----------
     Prototipte veritabanı transaction'ı yok. Şartname §4'ün "ortada hata olursa
     hiçbiri yazılmamalı" şartının karşılığı: yazmadan önce ilgili tabloların derin
     kopyası alınır, yazma bloğunda beklenmedik bir hata olursa depo geri sarılır. */
  function anlikGoruntu(depo, adlar) {
    var g = {}, i;
    for (i = 0; i < adlar.length; i++) g[adlar[i]] = YU.kopya(depo[adlar[i]]);
    return g;
  }

  function geriSar(depo, goruntu) {
    var ad;
    for (ad in goruntu) {
      if (!Object.prototype.hasOwnProperty.call(goruntu, ad)) continue;
      depo[ad].length = 0;
      Array.prototype.push.apply(depo[ad], goruntu[ad]);
    }
  }

  function beklenmedikHata(e) {
    return hataSatiri("Sistem", "İşlem sırasında beklenmedik bir hata oluştu, hiçbir değişiklik yazılmadı: " +
      (e && e.message ? e.message : String(e)));
  }

  /* ---------- YU.log ---------- */

  function metinDeger(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "boolean") return v ? "Evet" : "Hayır";
    if (typeof v === "number") return YU.fmt.sayi(v, v === Math.round(v) ? 0 : 3);
    return String(v);
  }

  function alanAdi(a) { return a === null || a === undefined ? null : (ALAN_ADI[a] || a); }

  function logYaz(depo, k) {
    if (LOGLANAN_TABLOLAR.indexOf(k.tablo) < 0) return null;
    var satir = {
      Id: depo.yeniId("DegisiklikLog"),
      Tablo: k.tablo,
      KayitId: k.kayitId === undefined ? null : k.kayitId,
      Alan: alanAdi(k.alan),
      EskiDeger: metinDeger(k.eski),
      YeniDeger: metinDeger(k.yeni),
      KullaniciId: k.kullaniciId === undefined ? null : k.kullaniciId,
      Tarih: simdi(),
      Islem: k.islem || "Guncelle"
    };
    depo.degisiklikLog.push(satir);
    return satir;
  }

  /* Güncellemede DEĞİŞEN her alan için ayrı satır (Şartname §6 denetim izi). */
  function logDegisenler(depo, tablo, kayitId, eski, yeni, alanlar, kullaniciId) {
    var i, a, e, y;
    for (i = 0; i < alanlar.length; i++) {
      a = alanlar[i];
      e = eski ? eski[a] : null;
      y = yeni[a];
      if (metinDeger(e) === metinDeger(y)) continue;
      logYaz(depo, { tablo: tablo, kayitId: kayitId, alan: a, eski: e, yeni: y, kullaniciId: kullaniciId, islem: "Guncelle" });
    }
  }

  /* ---------- Log kaydı çözümleme ----------
     DegisiklikLog yalnız (Tablo, KayitId) tutuyor. "Aktif: Evet → Hayır"
     satırı tek başına hangi malzemenin pasifleştiğini söylemiyordu; künye
     kaydın kendisinden okunuyor. Ekranlar bunu ortak kullanıyor. */

  var LOG_HAREKET_ADI = {
    DokmeUretim: "Dökme üretim", Cuvallama: "Çuvallama",
    DokmeSatis: "Dökme satış", Manuel: "Manuel"
  };

  function logTablosu(depo, kod) {
    if (kod === "KuruKuspeGunluk") return depo.kuruKuspeGunluk;
    if (kod === "GunlukHareket") return depo.gunlukHareket;
    if (kod === "SiloHareket") return depo.siloHareket;
    if (kod === "DevirStok") return depo.devirStok;
    if (kod === "SiloDevirStok") return depo.siloDevirStok;
    if (kod === "Kullanicilar") return depo.kullanicilar;
    if (kod === "Malzemeler") return depo.malzemeler;
    if (kod === "Silolar") return depo.silolar;
    return null;
  }

  function logKayitBul(depo, tablo, kayitId) {
    var liste = logTablosu(depo, tablo), i;
    if (!liste || kayitId === null || kayitId === undefined) return null;
    for (i = 0; i < liste.length; i++) if (liste[i].Id === kayitId) return liste[i];
    return null;
  }

  function malzemeAdiKisa(depo, id) {
    var m = satirBul(depo.malzemeler, id);
    return m ? m.Ad : (id === null || id === undefined ? "—" : "Malzeme #" + id);
  }

  function siloAdiKisa(depo, id) {
    var s = satirBul(depo.silolar, id);
    return s ? s.Ad : (id === null || id === undefined ? "—" : "Silo #" + id);
  }

  /* Kaydın insan okur künyesi. Kayıt silinmişse null döner. */
  function logKayitEtiketi(depo, tablo, kayitId) {
    var k = logKayitBul(depo, tablo, kayitId);
    if (!k) return null;
    if (tablo === "KuruKuspeGunluk") return YU.fmt.tarih(k.Tarih);
    if (tablo === "GunlukHareket") return malzemeAdiKisa(depo, k.MalzemeId) + " · " + YU.fmt.tarih(k.Tarih);
    if (tablo === "SiloHareket") {
      return siloAdiKisa(depo, k.SiloId) + " · " + YU.fmt.tarih(k.Tarih) +
        " · " + (LOG_HAREKET_ADI[k.HareketTipi] || k.HareketTipi);
    }
    if (tablo === "DevirStok") return malzemeAdiKisa(depo, k.MalzemeId) + " · " + YU.fmt.tarih(k.DevirTarihi);
    if (tablo === "SiloDevirStok") return siloAdiKisa(depo, k.SiloId) + " · " + YU.fmt.tarih(k.DevirTarihi);
    if (tablo === "Kullanicilar") return k.AdSoyad;
    if (tablo === "Malzemeler") return k.Ad;
    if (tablo === "Silolar") return k.Ad;
    return null;
  }

  /* Log değerleri metin olarak saklanıyor (boolean -> "Evet"/"Hayır"). Ekranda
     alanın anlamına göre karşılığı yazılır: durum alanında "Evet" değil "Aktif". */
  function logDegerCumlesi(alan, deger) {
    if (deger === null || deger === undefined || deger === "") return null;
    var d = String(deger);
    if (alan === "Durum" || alan === "Aktif") {
      if (d === "Evet") return "Aktif";
      if (d === "Hayır") return "Pasif";
    }
    if (alan === "Rol") {
      if (d === "Yonetici") return "Yönetici";
      if (d === "Operator") return "Operatör";
    }
    if (alan === "Özel Tip" || alan === "OzelTip") {
      if (d === "DokmeKuruKuspe") return "Dökme kuru küspe";
      if (d === "CuvalKuruKuspe") return "Çuvallı kuru küspe";
    }
    if (alan === "Hareket Tipi" || alan === "HareketTipi") {
      if (LOG_HAREKET_ADI[d]) return LOG_HAREKET_ADI[d];
    }
    return null;
  }

  /* "Aktif: Evet → Hayır" gibi ham alan değişimlerinin okunur karşılığı.
     Karşılığı yoksa null döner, çağıran genel biçime düşer. */
  function logAlanCumlesi(alan, eski, yeni) {
    if (alan === "Durum" || alan === "Aktif") {
      if (yeni === "Hayır" || yeni === "Pasif") return "pasifleştirildi";
      if (yeni === "Evet" || yeni === "Aktif") return "yeniden aktifleştirildi";
    }
    if (alan === "Rol") return "rolü " + (yeni === "Yonetici" ? "Yönetici" : "Operatör") + " oldu";
    if (alan === "ParolaHash") return "parolası sıfırlandı";
    return null;
  }

  /* ---------- YU.stok — saf okuma ---------- */

  function enSonDevir(depo, tip, id, tarih) {
    var siloMu = tip === "Silo";
    var tablo = siloMu ? depo.siloDevirStok : depo.devirStok;
    var alan = siloMu ? "SiloId" : "MalzemeId";
    var en = null, i, d;
    for (i = 0; i < tablo.length; i++) {
      d = tablo[i];
      if (d[alan] !== id) continue;
      if (tarih && d.DevirTarihi > tarih) continue;
      if (!en || d.DevirTarihi > en.DevirTarihi) en = d;
    }
    return en ? { Id: en.Id, DevirTarihi: en.DevirTarihi, Miktar: say(en.Miktar) } : null;
  }

  /* Şartname §5: Stok = EnSonDevir(DevirTarihi <= sorgu) + Toplam(Uretim) − Toplam(Satis),
     hareketler yalnızca o devir tarihinden sonrakiler (>=). */
  function malzemeHesapla(depo, malzeme, tarih, hareketler, dokmeToplami) {
    var devir = enSonDevir(depo, "Malzeme", malzeme.Id, tarih);
    var bas = devir ? devir.DevirTarihi : null;
    var uretim = 0, satis = 0, iade = 0, i, h;
    for (i = 0; i < hareketler.length; i++) {
      h = hareketler[i];
      if (h.Tarih > tarih) continue;
      if (bas && h.Tarih < bas) continue;
      uretim += Number(h.Uretim) || 0;
      satis += Number(h.Satis) || 0;
      /* İade stokta üretim gibi davranır ama ayrı toplanır (kullanıcı
         direktifi, 24.08.2026): ekranlar ayrı kolon gösterir. Iade alanı
         boş/0 olan eski veri için sonuç birebir aynıdır. */
      iade += Number(h.Iade) || 0;
    }
    uretim = YU.yuvarla(uretim);
    satis = YU.yuvarla(satis);
    iade = YU.yuvarla(iade);
    var devirMiktar = devir ? devir.Miktar : 0;
    /* KRİTİK (Şartname §5): dökme kuru küspe fiziksel olarak silolarda durur;
       stoğu basit formülle değil, siloların toplamıyla hesaplanır. */
    var mevcut = malzeme.OzelTip === "DokmeKuruKuspe"
      ? YU.yuvarla(dokmeToplami)
      : YU.yuvarla(devirMiktar + uretim + iade - satis);
    return {
      devir: devirMiktar,
      devirTarihi: devir ? devir.DevirTarihi : null,
      uretim: uretim,
      satis: satis,
      iade: iade,
      mevcut: mevcut
    };
  }

  function siloHesapla(depo, silo, tarih, hareketler, gunBasiMi) {
    var devir = enSonDevir(depo, "Silo", silo.Id, tarih);
    var bas = devir ? devir.DevirTarihi : null;
    var giren = 0, cikan = 0, i, h;
    for (i = 0; i < hareketler.length; i++) {
      h = hareketler[i];
      if (gunBasiMi ? !(h.Tarih < tarih) : h.Tarih > tarih) continue;
      if (bas && h.Tarih < bas) continue;
      giren += Number(h.GirenKg) || 0;
      cikan += Number(h.CikanKg) || 0;
    }
    giren = YU.yuvarla(giren);
    cikan = YU.yuvarla(cikan);
    var devirMiktar = devir ? devir.Miktar : 0;
    var kapasite = say(silo.Kapasite);
    var mevcut = YU.yuvarla(devirMiktar + giren - cikan);
    return {
      devir: devirMiktar,
      devirTarihi: devir ? devir.DevirTarihi : null,
      giren: giren,
      cikan: cikan,
      mevcut: mevcut,
      kapasite: kapasite,
      doluluk: kapasite > 0 ? mevcut / kapasite : 0
    };
  }

  function siloHareketleri(depo, siloId) {
    var liste = [], i;
    for (i = 0; i < depo.siloHareket.length; i++) {
      if (depo.siloHareket[i].SiloId === siloId) liste.push(depo.siloHareket[i]);
    }
    return liste;
  }

  function siloStok(depo, siloId, tarih) {
    tarih = tarih || bugun();
    siloId = kimlik(siloId);
    var silo = satirBul(depo.silolar, siloId);
    if (!silo) return { devir: 0, devirTarihi: null, giren: 0, cikan: 0, mevcut: 0, kapasite: 0, doluluk: 0 };
    return siloHesapla(depo, silo, tarih, siloHareketleri(depo, siloId), false);
  }

  /* Gün başı mevcut: Tarih < tarih (o gün henüz kaydedilmemiştir — Şartname §5). */
  function siloGunBasi(depo, siloId, tarih) {
    siloId = kimlik(siloId);
    var silo = satirBul(depo.silolar, siloId);
    if (!silo) return 0;
    return siloHesapla(depo, silo, tarih, siloHareketleri(depo, siloId), true).mevcut;
  }

  function tumSilolar(depo, tarih) {
    tarih = tarih || bugun();
    var grup = grupla(depo.siloHareket, "SiloId");   // tek geçiş; silo başına yeniden tarama yok
    var liste = siraliKopya(depo.silolar), sonuclar = [], i, silo, h;
    for (i = 0; i < liste.length; i++) {
      silo = liste[i];
      h = siloHesapla(depo, silo, tarih, grup[silo.Id] || [], false);
      sonuclar.push({
        silo: silo, devir: h.devir, giren: h.giren, cikan: h.cikan,
        mevcut: h.mevcut, kapasite: h.kapasite, doluluk: h.doluluk
      });
    }
    return sonuclar;
  }

  function dokmeToplam(depo, tarih) {
    var satirlar = tumSilolar(depo, tarih), t = 0, i;
    for (i = 0; i < satirlar.length; i++) t += satirlar[i].mevcut;
    return YU.yuvarla(t);
  }

  function malzemeStok(depo, malzemeId, tarih) {
    tarih = tarih || bugun();
    malzemeId = kimlik(malzemeId);
    var malzeme = satirBul(depo.malzemeler, malzemeId);
    if (!malzeme) return { devir: 0, devirTarihi: null, uretim: 0, satis: 0, iade: 0, mevcut: 0 };
    var hareketler = [], i;
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      if (depo.gunlukHareket[i].MalzemeId === malzemeId) hareketler.push(depo.gunlukHareket[i]);
    }
    var dokme = malzeme.OzelTip === "DokmeKuruKuspe" ? dokmeToplam(depo, tarih) : 0;
    return malzemeHesapla(depo, malzeme, tarih, hareketler, dokme);
  }

  function tumMalzemeler(depo, tarih) {
    tarih = tarih || bugun();
    var grup = grupla(depo.gunlukHareket, "MalzemeId");   // tek geçiş
    var liste = siraliKopya(depo.malzemeler), sonuclar = [], dokme = null, i, malzeme, h;
    for (i = 0; i < liste.length; i++) {
      malzeme = liste[i];
      if (malzeme.OzelTip === "DokmeKuruKuspe" && dokme === null) dokme = dokmeToplam(depo, tarih);
      h = malzemeHesapla(depo, malzeme, tarih, grup[malzeme.Id] || [], dokme || 0);
      sonuclar.push({
        malzeme: malzeme, devir: h.devir, devirTarihi: h.devirTarihi,
        uretim: h.uretim, satis: h.satis, iade: h.iade, mevcut: h.mevcut
      });
    }
    return sonuclar;
  }

  /* Silo Durumu ekranındaki "geçmişte negatife düşen gün" uyarısı (Şartname §7 v2). */
  function negatifGunler(depo) {
    return YU.dogrula.ileriBakiye(depo, null, null);
  }

  function gunOzeti(depo, tarih) {
    var kk = kuruKuspeGunuBul(depo, tarih);
    var hesap = YU.hesap.kuruKuspe(
      kk ? say(kk.UretilenDokme) : 0,
      kk ? say(kk.CuvalAdet) : 0,
      kk ? say(kk.SatilanDokme) : 0
    );
    /* Şartname §4 "Raporlamada dikkat": Durum B'de net üretim 0 görünür ama
       operatörün girdiği ham rakam kaybolmamalı — ayrı alan olarak taşınır. */
    hesap.hamUretilenDokme = kk ? say(kk.UretilenDokme) : 0;

    var malzemeSatirlari = [], siloSatirlari = [], i, h, malzeme, silo;

    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.Tarih !== tarih) continue;
      malzeme = satirBul(depo.malzemeler, h.MalzemeId);
      malzemeSatirlari.push({
        malzeme: malzeme,
        uretim: say(h.Uretim),
        satis: say(h.Satis),
        hareket: h
      });
    }
    malzemeSatirlari.sort(function (a, b) {
      var x = a.malzeme ? Number(a.malzeme.Sira) || 0 : 999;
      var y = b.malzeme ? Number(b.malzeme.Sira) || 0 : 999;
      return x - y;
    });

    for (i = 0; i < depo.siloHareket.length; i++) {
      h = depo.siloHareket[i];
      if (h.Tarih !== tarih) continue;
      silo = satirBul(depo.silolar, h.SiloId);
      siloSatirlari.push({ hareket: h, silo: silo });
    }
    siloSatirlari.sort(function (a, b) {
      var x = a.silo ? Number(a.silo.Sira) || 0 : 999;
      var y = b.silo ? Number(b.silo.Sira) || 0 : 999;
      if (x !== y) return x - y;
      return (a.hareket.Id || 0) - (b.hareket.Id || 0);
    });

    return {
      kuruKuspe: kk,
      hesap: hesap,
      malzemeSatirlari: malzemeSatirlari,
      siloHareketleri: siloSatirlari
    };
  }

  function kayitliGunler(depo, bas, bit) {
    var gunler = {}, i, h, g, an;

    function gunAl(tarih) {
      if (bas && tarih < bas) return null;
      if (bit && tarih > bit) return null;
      return gunler[tarih] || (gunler[tarih] = {
        tarih: tarih, kuruKuspeVar: false, malzemeSayisi: 0,
        sonGuncelleme: null, kullanici: null, kullaniciId: null
      });
    }

    function damgala(g2, damga, kullaniciId) {
      if (!damga) return;
      if (!g2.sonGuncelleme || damga > g2.sonGuncelleme) {
        g2.sonGuncelleme = damga;
        g2.kullaniciId = kullaniciId === undefined ? null : kullaniciId;
      }
    }

    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      h = depo.kuruKuspeGunluk[i];
      g = gunAl(h.Tarih);
      if (!g) continue;
      g.kuruKuspeVar = true;
      an = h.GuncellemeTarihi || h.OlusturmaTarihi;
      damgala(g, an, h.GuncellemeTarihi ? h.GuncelleyenKullaniciId : h.OlusturanKullaniciId);
    }

    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      g = gunAl(h.Tarih);
      if (!g) continue;
      g.malzemeSayisi++;
      an = h.GuncellemeTarihi || h.OlusturmaTarihi;
      damgala(g, an, h.GuncellemeTarihi ? h.GuncelleyenKullaniciId : h.OlusturanKullaniciId);
    }

    var liste = [], k;
    for (k in gunler) {
      if (!Object.prototype.hasOwnProperty.call(gunler, k)) continue;
      g = gunler[k];
      g.kullanici = kullaniciAdiBul(depo, g.kullaniciId);
      liste.push(g);
    }
    liste.sort(function (a, b) { return a.tarih < b.tarih ? 1 : (a.tarih > b.tarih ? -1 : 0); });
    return liste;
  }

  /* ---------- YU.servis — yazma ---------- */

  function taslakHareketler(girdi) {
    var liste = [];
    function ekle(satirlar, giren) {
      var i, m, id;
      if (!satirlar) return;
      for (i = 0; i < satirlar.length; i++) {
        id = kimlik(satirlar[i].siloId);
        m = oku(satirlar[i].miktar);
        if (id === null || m <= 0) continue;          // miktarı 0 olan satır yok sayılır
        liste.push({ siloId: id, GirenKg: giren ? m : 0, CikanKg: giren ? 0 : m });
      }
    }
    ekle(girdi.yerlestirmeler, true);
    ekle(girdi.cekisler, false);
    ekle(girdi.satisCekisleri, false);
    return liste;
  }

  function siloHareketYaz(depo, tarih, siloId, tip, giren, cikan, kaynakId, kullaniciId, logla) {
    var satir = {
      Id: depo.yeniId("SiloHareket"),
      Tarih: tarih,
      SiloId: siloId,
      HareketTipi: tip,
      GirenKg: YU.yuvarla(giren),
      CikanKg: YU.yuvarla(cikan),
      KaynakKayitId: kaynakId,
      OlusturanKullaniciId: kullaniciId,
      OlusturmaTarihi: simdi()
    };
    depo.siloHareket.push(satir);
    if (logla) {
      logYaz(depo, {
        tablo: "SiloHareket", kayitId: satir.Id, alan: null, eski: null,
        yeni: tip + " · " + YU.fmt.tarih(tarih) + " · " +
          (giren > 0 ? "+" + YU.fmt.kgU(giren) : "−" + YU.fmt.kgU(cikan)),
        kullaniciId: kullaniciId, islem: "Ekle"
      });
    }
    return satir;
  }

  /* GunlukHareket upsert (D8). degerler içinde verilmeyen kolona DOKUNULMAZ —
     çuvallı kuru küspenin Satis kolonu Malzeme Girişi'nden gelir (Şartname §4). */
  function gunlukHareketYaz(depo, tarih, malzemeId, degerler, kullaniciId, logla) {
    var mevcut = gunlukHareketBul(depo, tarih, malzemeId);
    var an = simdi(), eski;

    /* Satır YOKKEN sıfır yazmak kayıt ve log çöpü üretir (kullanıcı isteği,
       23.08.2026): etkilenmeyen malzeme iz bırakmaz. Şartname §5 toplamları
       sıfır satırdan etkilenmez, D8 tekillik boş satırı zorunlu kılmaz.
       Mevcut satır varsa sıfıra çekilmesi GERÇEK değişikliktir ve aşağıdaki
       güncelleme yolunda normal loglanır. */
    if (!mevcut &&
        YU.yuvarla(degerler.Uretim === undefined ? 0 : degerler.Uretim) === 0 &&
        YU.yuvarla(degerler.Satis === undefined ? 0 : degerler.Satis) === 0 &&
        YU.yuvarla(degerler.Iade === undefined ? 0 : degerler.Iade) === 0) {
      return null;
    }

    if (mevcut) {
      eski = { Uretim: say(mevcut.Uretim), Satis: say(mevcut.Satis), Iade: say(mevcut.Iade) };
      if (degerler.Uretim !== undefined) mevcut.Uretim = YU.yuvarla(degerler.Uretim);
      if (degerler.Satis !== undefined) mevcut.Satis = YU.yuvarla(degerler.Satis);
      if (degerler.Iade !== undefined) mevcut.Iade = YU.yuvarla(degerler.Iade);
      mevcut.RowVersion = (Number(mevcut.RowVersion) || 0) + 1;
      mevcut.GuncelleyenKullaniciId = kullaniciId;
      mevcut.GuncellemeTarihi = an;
      if (logla) logDegisenler(depo, "GunlukHareket", mevcut.Id, eski, mevcut, ["Uretim", "Satis", "Iade"], kullaniciId);
      return mevcut;
    }

    var yeni = {
      Id: depo.yeniId("GunlukHareket"),
      Tarih: tarih,
      MalzemeId: malzemeId,
      Uretim: YU.yuvarla(degerler.Uretim === undefined ? 0 : degerler.Uretim),
      Satis: YU.yuvarla(degerler.Satis === undefined ? 0 : degerler.Satis),
      Iade: YU.yuvarla(degerler.Iade === undefined ? 0 : degerler.Iade),
      RowVersion: 1,
      OlusturanKullaniciId: kullaniciId,
      OlusturmaTarihi: an,
      GuncelleyenKullaniciId: null,
      GuncellemeTarihi: null
    };
    depo.gunlukHareket.push(yeni);
    if (logla) {
      logYaz(depo, {
        tablo: "GunlukHareket", kayitId: yeni.Id, alan: null, eski: null,
        yeni: YU.fmt.tarih(tarih) + " · üretim " + YU.fmt.kgU(yeni.Uretim) + " · satış " + YU.fmt.kgU(yeni.Satis),
        kullaniciId: kullaniciId, islem: "Ekle"
      });
    }
    return yeni;
  }

  /* ---------- kuru küspe günlük kaydı ---------- */

  /* ---------- kampanya kilidi (kullanıcı isteği, 24.08.2026) ----------
     Kilitli kampanyada veri değişikliği yasaktır; yönetici kilidi Devir
     Stok & Kampanya Yönetimi ekranından açmadan giriş/düzeltme/silme ve
     devir değişikliği yapılamaz. Şartnamede kilit yoktur — D17 gibi
     prototip eklentisidir; Demirbaş davranışlara dokunmaz (kilit açılınca
     her şey aynen işler). Kabul testleri temiz bellek deposuyla koşar;
     orada kilit kaydı olmadığından testlere etkisi yoktur. */

  function kampanyaAdiHesapla(iso) {
    /* 10-kabuk'taki adlandırmanın aynısı (kampanya eylülde başlar, §2);
       servis kabuğa bağımlı olamaz — testler kabuk yokken ayrı depoyla
       çağırır, YU.donem ise her zaman YU.db okur. */
    var y = parseInt(String(iso).slice(0, 4), 10);
    var a = parseInt(String(iso).slice(5, 7), 10);
    if (!y) return "Kampanya";
    return a >= 7 ? (y + "/" + (y + 1)) : ((y - 1) + "/" + y);
  }

  function kampanyaBaslari(depo) {
    var t = {}, i, l = [];
    for (i = 0; i < depo.devirStok.length; i++) t[depo.devirStok[i].DevirTarihi] = 1;
    for (i = 0; i < depo.siloDevirStok.length; i++) t[depo.siloDevirStok[i].DevirTarihi] = 1;
    for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) l.push(k);
    l.sort();
    var gruplar = [];
    for (i = 0; i < l.length; i++) {
      var ad = kampanyaAdiHesapla(l[i]);
      if (!gruplar.length || gruplar[gruplar.length - 1].ad !== ad) gruplar.push({ ad: ad, bas: l[i] });
    }
    for (i = 0; i < gruplar.length; i++) gruplar[i].sinir = i + 1 < gruplar.length ? gruplar[i + 1].bas : null;
    return gruplar;
  }

  function kilitKaydi(depo, ad) {
    var l = depo.kampanyaKilitleri || [], i;
    for (i = 0; i < l.length; i++) if (l[i].Kampanya === ad) return l[i];
    return null;
  }

  /* Bir tarih hangi kampanya DÖNEMİNE düşer: kampanyanın başından bir
     sonraki kampanyanın başına kadar; son kampanya açık uçludur. */
  function tarihinKampanyasi(depo, tarih) {
    var g = kampanyaBaslari(depo), i;
    for (i = g.length - 1; i >= 0; i--) {
      if (tarih >= g[i].bas && (!g[i].sinir || tarih < g[i].sinir)) return g[i];
    }
    return null;
  }

  function kilitEngeli(depo, tarih) {
    var kmp = tarihinKampanyasi(depo, tarih);
    if (!kmp || !kilitKaydi(depo, kmp.ad)) return null;
    return hataSatiri("KILIT", "\"" + kmp.ad + "\" kampanyası kilitli — " + YU.fmt.tarih(tarih) +
      " bu kampanyaya düşer ve değiştirilemez. Önce Devir Stok & Kampanya Yönetimi ekranından kilidi açın.");
  }

  function kuruKuspeKaydet(depo, girdi, kullanici, secenek) {
    secenek = secenek || {};
    var kullaniciId = kullanici && kullanici.Id !== undefined ? kullanici.Id : null;
    var tohumlama = secenek.tohumlama === true;
    /* Tohum verisi kullanıcı değişikliği değildir: loglanırsa gerçek düzeltmeleri
       gömer ve depoyu gereksiz şişirir (Şartname §6). */
    var logla = !tohumlama;
    var tarih = girdi.tarih;

    /* Kampanya kilidi her yazma yolunu keser (tohum verisi hariç — tohum
       kullanıcı işlemi değildir ve kilitler kurulmadan önce yazılır). */
    var kilitH = logla ? kilitEngeli(depo, tarih) : null;
    if (kilitH) return sonuc(false, [kilitH], [], null);

    var d = YU.dogrula.kuruKuspeKaydi(depo, girdi);
    var hatalar = d.hatalar.slice();
    var uyarilar = d.uyarilar.slice();
    var mevcut = kuruKuspeGunuBul(depo, tarih);
    var i;

    /* D14 — ileri bakiye. Başka hata varken de çalıştırılır: geriye dönük bir
       düzeltme hem D7'yi hem D14'ü bozabiliyor, kullanıcı ikisini birden görmeli.
       Tohumlamada atlanır: tohum verisi yalnızca ileriye doğru eklenir, geriye
       dönük bozma riski yoktur. */
    if (!tohumlama) {
      var negatifler = YU.dogrula.ileriBakiye(depo, tarih, {
        tarih: tarih,
        silinecekKaynakId: mevcut ? mevcut.Id : null,
        yeniHareketler: taslakHareketler(girdi)
      });
      for (i = 0; i < negatifler.length; i++) {
        hatalar.push(hataSatiri("D14", YU.dogrula.d14Mesaji(negatifler[i])));
      }
    }

    /* Tüm doğrulamalar bitmeden depoya dokunulmaz. */
    if (hatalar.length) return sonuc(false, hatalar, uyarilar, null);

    var uretilen = oku(girdi.uretilenDokme);
    var cuvalAdet = oku(girdi.cuvalAdet);
    var satilan = oku(girdi.satilanDokme);
    var hesap = YU.hesap.kuruKuspe(uretilen, cuvalAdet, satilan);
    var dokmeMalzeme = ozelTipliMalzeme(depo, "DokmeKuruKuspe");
    var cuvalMalzeme = ozelTipliMalzeme(depo, "CuvalKuruKuspe");

    /* Özel tipli malzeme bulunamazsa eskiden ilgili GunlukHareket satırı sessizce
       atlanıyordu: silo hareketleri yazılır, malzeme satırı yazılmaz ve stok ayrışırdı.
       Kayıt artık açıkça reddediliyor (denetim bulgusu — Şartname §5 kritik kural). */
    if (!dokmeMalzeme || !cuvalMalzeme) {
      return sonuc(false, [hataSatiri("Sistem",
        "Kuru küspe kaydı yazılamaz: " +
        (!dokmeMalzeme ? "\"DokmeKuruKuspe\"" : "") +
        (!dokmeMalzeme && !cuvalMalzeme ? " ve " : "") +
        (!cuvalMalzeme ? "\"CuvalKuruKuspe\"" : "") +
        " özel tipli malzeme tanımlı değil. Malzeme Yönetimi ekranından özel tipi geri " +
        "atayın (Şartname §6 filtreli tekil indeks).")], uyarilar, null);
    }
    var yedek = anlikGoruntu(depo, ["kuruKuspeGunluk", "siloHareket", "gunlukHareket", "degisiklikLog"]);
    var kayit, an, eski, silinen;

    function hareketleriYaz(satirlar, tip, giren) {
      var j, id, m;
      if (!satirlar) return;
      for (j = 0; j < satirlar.length; j++) {
        id = kimlik(satirlar[j].siloId);
        m = oku(satirlar[j].miktar);
        if (id === null || m <= 0) continue;        // miktarı 0 olan satır yok sayılır
        siloHareketYaz(depo, tarih, id, tip, giren ? m : 0, giren ? 0 : m, kayit.Id, kullaniciId, logla);
      }
    }

    try {
      an = simdi();

      /* 1 — o güne ait eski silo hareketlerini sil (KaynakKayitId ile).
         Üstüne eklenirse silo stoğu şişer (Şartname §4). */
      silinen = 0;
      if (mevcut) {
        /* Her silinen hareket AYRI ve değerleriyle loglanır (kullanıcı isteği,
           23.08.2026): Değişiklik Geçmişi "hangi değer silindi" sorusuna
           cevap verir. §4 davranışı aynıdır; yalnız iz ayrıntılandı. */
        var TIP_AD = { DokmeUretim: "Dökme Üretim", Cuvallama: "Çuvallama", DokmeSatis: "Dökme Satış" };
        var eskiHareket, eskiSilo, miktarMetni;
        for (i = depo.siloHareket.length - 1; i >= 0; i--) {
          if (depo.siloHareket[i].KaynakKayitId !== mevcut.Id) continue;
          eskiHareket = depo.siloHareket[i];
          depo.siloHareket.splice(i, 1);
          silinen++;
          if (logla) {
            eskiSilo = satirBul(depo.silolar, eskiHareket.SiloId);
            miktarMetni = (Number(eskiHareket.GirenKg) || 0) > 0
              ? "giren " + YU.fmt.kgU(eskiHareket.GirenKg)
              : "çıkan " + YU.fmt.kgU(eskiHareket.CikanKg);
            logYaz(depo, {
              tablo: "SiloHareket", kayitId: eskiHareket.Id, alan: null,
              eski: YU.fmt.tarih(tarih) + " · " + (eskiSilo ? eskiSilo.Ad : "Silo #" + eskiHareket.SiloId) +
                " · " + (TIP_AD[eskiHareket.HareketTipi] || eskiHareket.HareketTipi) + " · " + miktarMetni +
                " — düzeltmede silindi",
              yeni: null, kullaniciId: kullaniciId, islem: "Sil"
            });
          }
        }
      }

      /* 2 — KuruKuspeGunluk upsert (D8), RowVersion +1 */
      if (mevcut) {
        eski = {
          UretilenDokme: say(mevcut.UretilenDokme), CuvalAdet: say(mevcut.CuvalAdet),
          CuvalKg: say(mevcut.CuvalKg), SatilanDokme: say(mevcut.SatilanDokme)
        };
        mevcut.UretilenDokme = uretilen;
        mevcut.CuvalAdet = cuvalAdet;
        mevcut.CuvalKg = hesap.cuvalKg;
        mevcut.SatilanDokme = satilan;
        mevcut.RowVersion = (Number(mevcut.RowVersion) || 0) + 1;
        mevcut.GuncelleyenKullaniciId = kullaniciId;
        mevcut.GuncellemeTarihi = an;
        kayit = mevcut;
        if (logla) {
          logDegisenler(depo, "KuruKuspeGunluk", kayit.Id, eski, kayit,
            ["UretilenDokme", "CuvalAdet", "CuvalKg", "SatilanDokme"], kullaniciId);
        }
      } else {
        kayit = {
          Id: depo.yeniId("KuruKuspeGunluk"),
          Tarih: tarih,
          UretilenDokme: uretilen,
          CuvalAdet: cuvalAdet,
          CuvalKg: hesap.cuvalKg,
          SatilanDokme: satilan,
          RowVersion: 1,
          OlusturanKullaniciId: kullaniciId,
          OlusturmaTarihi: an,
          GuncelleyenKullaniciId: null,
          GuncellemeTarihi: null
        };
        depo.kuruKuspeGunluk.push(kayit);
        if (logla) {
          logYaz(depo, {
            tablo: "KuruKuspeGunluk", kayitId: kayit.Id, alan: null, eski: null,
            yeni: YU.fmt.tarih(tarih) + " · üretilen dökme " + YU.fmt.kgU(uretilen) +
              " · " + YU.fmt.sayi(cuvalAdet) + " çuval · satılan dökme " + YU.fmt.kgU(satilan),
            kullaniciId: kullaniciId, islem: "Ekle"
          });
        }
      }

      /* 3 — yeni silo hareketleri */
      hareketleriYaz(girdi.yerlestirmeler, "DokmeUretim", true);
      hareketleriYaz(girdi.cekisler, "Cuvallama", false);
      hareketleriYaz(girdi.satisCekisleri, "DokmeSatis", false);

      /* 4 — GunlukHareket upsert.
         Çuvallı satırın Satis kolonuna DOKUNULMAZ: o kolon Malzeme Girişi
         ekranından gelir ve varsa korunmalıdır (Şartname §4). */
      if (dokmeMalzeme) {
        gunlukHareketYaz(depo, tarih, dokmeMalzeme.Id,
          { Uretim: hesap.netDokmeUretim, Satis: satilan }, kullaniciId, logla);
      }
      if (cuvalMalzeme) {
        gunlukHareketYaz(depo, tarih, cuvalMalzeme.Id,
          { Uretim: hesap.cuvalKg }, kullaniciId, logla);
      }
    } catch (e) {
      geriSar(depo, yedek);
      return sonuc(false, [beklenmedikHata(e)], uyarilar, null);
    }

    depo.kaydet();
    return sonuc(true, [], uyarilar, kayit);
  }

  /* ---------- gün silme ---------- */

  function gunSil(depo, tarih, kullanici) {
    var kullaniciId = kullanici && kullanici.Id !== undefined ? kullanici.Id : null;
    var kilitH = kilitEngeli(depo, tarih);
    if (kilitH) return sonuc(false, [kilitH], [], null);
    var d = YU.dogrula.gunSilme(depo, tarih);
    if (d.hatalar.length) return sonuc(false, d.hatalar, [], null);

    var yedek = anlikGoruntu(depo, ["kuruKuspeGunluk", "siloHareket", "gunlukHareket", "degisiklikLog"]);
    var i, silinenSilo = 0, silinenHareket = 0, kk = null;

    try {
      for (i = depo.kuruKuspeGunluk.length - 1; i >= 0; i--) {
        if (depo.kuruKuspeGunluk[i].Tarih === tarih) {
          kk = depo.kuruKuspeGunluk[i];
          depo.kuruKuspeGunluk.splice(i, 1);
        }
      }
      for (i = depo.siloHareket.length - 1; i >= 0; i--) {
        if (depo.siloHareket[i].Tarih === tarih) { depo.siloHareket.splice(i, 1); silinenSilo++; }
      }
      for (i = depo.gunlukHareket.length - 1; i >= 0; i--) {
        if (depo.gunlukHareket[i].Tarih === tarih) { depo.gunlukHareket.splice(i, 1); silinenHareket++; }
      }

      if (kk) {
        logYaz(depo, {
          tablo: "KuruKuspeGunluk", kayitId: kk.Id, alan: null,
          eski: YU.fmt.tarih(tarih) + " · üretilen dökme " + YU.fmt.kgU(kk.UretilenDokme) +
            " · " + YU.fmt.sayi(kk.CuvalAdet) + " çuval · satılan dökme " + YU.fmt.kgU(kk.SatilanDokme),
          yeni: null, kullaniciId: kullaniciId, islem: "Sil"
        });
      }
      if (silinenSilo) {
        logYaz(depo, {
          tablo: "SiloHareket", kayitId: null, alan: null,
          eski: YU.fmt.tarih(tarih) + " · " + YU.fmt.sayi(silinenSilo) + " silo hareketi",
          yeni: null, kullaniciId: kullaniciId, islem: "Sil"
        });
      }
      if (silinenHareket) {
        logYaz(depo, {
          tablo: "GunlukHareket", kayitId: null, alan: null,
          eski: YU.fmt.tarih(tarih) + " · " + YU.fmt.sayi(silinenHareket) + " malzeme satırı",
          yeni: null, kullaniciId: kullaniciId, islem: "Sil"
        });
      }
    } catch (e) {
      geriSar(depo, yedek);
      return sonuc(false, [beklenmedikHata(e)], [], null);
    }

    depo.kaydet();
    return sonuc(true, [], [], null);
  }

  /* ---------- malzeme hareketi (Malzeme Girişi) ---------- */

  function malzemeHareketKaydet(depo, girdi, kullanici) {
    var kullaniciId = kullanici && kullanici.Id !== undefined ? kullanici.Id : null;
    var kilitH = kilitEngeli(depo, girdi.tarih);
    if (kilitH) return sonuc(false, [kilitH], [], null);
    var d = YU.dogrula.malzemeHareketi(depo, girdi);
    if (d.hatalar.length) return sonuc(false, d.hatalar, d.uyarilar, null);

    var malzemeId = kimlik(girdi.malzemeId);
    var malzeme = satirBul(depo.malzemeler, malzemeId);
    var degerler = {};
    if (malzeme.OzelTip !== "CuvalKuruKuspe" && girdi.uretim !== undefined && girdi.uretim !== null) {
      degerler.Uretim = oku(girdi.uretim);
    }
    if (girdi.satis !== undefined && girdi.satis !== null) degerler.Satis = oku(girdi.satis);
    /* İade her malzemeye yazılır (kullanıcı direktifi, 24.08.2026).
       DÖKME iadesi ayrıca SİLOYA GİRER: dökme stok silo toplamıdır
       (Şartname §5), iade rakamı ancak seçilen siloya Manuel "giren"
       hareketiyle stoğa işler. Silo seçimi 03-dogrulama'da zorunlu tutulur. */
    if (girdi.iade !== undefined && girdi.iade !== null) {
      degerler.Iade = oku(girdi.iade);
    }

    var yedek = anlikGoruntu(depo, ["gunlukHareket", "siloHareket", "degisiklikLog"]);
    var kayit;
    try {
      kayit = gunlukHareketYaz(depo, girdi.tarih, malzemeId, degerler, kullaniciId, true);

      /* İade siloya YAZILMAZ (revize, 24.08.2026): iade yalnız stok
         kolonudur; dökme kuru küspeye iade doğrulamada reddedilir. */
    } catch (e) {
      geriSar(depo, yedek);
      return sonuc(false, [beklenmedikHata(e)], d.uyarilar, null);
    }

    depo.kaydet();
    return sonuc(true, [], d.uyarilar, kayit);
  }

  /* ---------- devir stok ---------- */

  function devirUpsert(depo, tip, sahipId, devirTarihi, miktar, kullanici) {
    var siloMu = tip === "Silo";
    var tablo = siloMu ? depo.siloDevirStok : depo.devirStok;
    var tabloAdi = siloMu ? "SiloDevirStok" : "DevirStok";
    var alan = siloMu ? "SiloId" : "MalzemeId";
    var kullaniciId = kullanici && kullanici.Id !== undefined ? kullanici.Id : null;
    var i, mevcut = null;

    /* Kilitli kampanyanın devri değiştirilemez. Ad üzerinden bakılır:
       yeni sezonun ilk devri farklı sezon adı ürettiği için serbesttir. */
    var kilitliKmp = kilitKaydi(depo, kampanyaAdiHesapla(devirTarihi));
    if (kilitliKmp) {
      return sonuc(false, [hataSatiri("KILIT", "\"" + kilitliKmp.Kampanya +
        "\" kampanyası kilitli — devir satırı değiştirilemez. Önce Devir Stok & Kampanya Yönetimi ekranından kilidi açın.")], [], null);
    }

    for (i = 0; i < tablo.length; i++) {
      if (tablo[i][alan] === sahipId && tablo[i].DevirTarihi === devirTarihi) { mevcut = tablo[i]; break; }
    }

    var aday = { Id: mevcut ? mevcut.Id : null, DevirTarihi: devirTarihi, Miktar: miktar };
    aday[alan] = sahipId;
    var d = YU.dogrula.devir(depo, aday, tip);
    if (d.hatalar.length) return sonuc(false, d.hatalar, [], null);

    var yedek = anlikGoruntu(depo, [siloMu ? "siloDevirStok" : "devirStok", "degisiklikLog"]);
    var kayit, eski;
    try {
      if (mevcut) {
        eski = { Miktar: say(mevcut.Miktar) };
        mevcut.Miktar = YU.yuvarla(miktar);
        kayit = mevcut;
        logDegisenler(depo, tabloAdi, kayit.Id, eski, kayit, ["Miktar"], kullaniciId);
      } else {
        kayit = {
          Id: depo.yeniId(tabloAdi),
          DevirTarihi: devirTarihi,
          Miktar: YU.yuvarla(miktar),
          OlusturanKullaniciId: kullaniciId,
          OlusturmaTarihi: simdi()
        };
        kayit[alan] = sahipId;
        tablo.push(kayit);
        logYaz(depo, {
          tablo: tabloAdi, kayitId: kayit.Id, alan: null, eski: null,
          yeni: YU.fmt.tarih(devirTarihi) + " · " + YU.fmt.kgU(kayit.Miktar),
          kullaniciId: kullaniciId, islem: "Ekle"
        });
      }
    } catch (e) {
      geriSar(depo, yedek);
      return sonuc(false, [beklenmedikHata(e)], [], null);
    }

    depo.kaydet();
    return sonuc(true, [], devirUyarilari(depo, siloMu ? sahipId : null), kayit);
  }

  /* Devir değişmesi sonraki günleri negatife düşürebilir. D14 kaydı engellemez
     (devir bir düzeltme kalemidir), ama sonuç kullanıcıya söylenir. */
  function devirUyarilari(depo, siloId) {
    var uyarilar = [], negatifler = YU.dogrula.ileriBakiye(depo, null, null), i, n;
    for (i = 0; i < negatifler.length; i++) {
      n = negatifler[i];
      if (siloId !== null && n.siloId !== siloId) continue;
      uyarilar.push(hataSatiri("D14", n.siloAd + " bakiyesi " + YU.fmt.tarih(n.tarih) + " günü " +
        YU.fmt.kgU(n.bakiye) + " oluyor. Devir miktarını veya o günün girişlerini kontrol edin."));
    }
    return uyarilar;
  }

  function devirKaydet(depo, girdi, kullanici) {
    return devirUpsert(depo, "Malzeme", kimlik(girdi.malzemeId), girdi.devirTarihi, oku(girdi.miktar), kullanici);
  }

  function siloDevirKaydet(depo, girdi, kullanici) {
    return devirUpsert(depo, "Silo", kimlik(girdi.siloId), girdi.devirTarihi, oku(girdi.miktar), kullanici);
  }

  function devirSil(depo, id, tip, kullanici) {
    var siloMu = tip === "Silo";
    var tablo = siloMu ? depo.siloDevirStok : depo.devirStok;
    var tabloAdi = siloMu ? "SiloDevirStok" : "DevirStok";
    var kullaniciId = kullanici && kullanici.Id !== undefined ? kullanici.Id : null;
    var kayit = satirBul(tablo, id);

    if (!kayit) {
      return sonuc(false, [hataSatiri("Alan", "Silinecek devir kaydı bulunamadı (Id: " + String(id) + ").")], [], null);
    }
    var kilitliKmpSil = kilitKaydi(depo, kampanyaAdiHesapla(kayit.DevirTarihi));
    if (kilitliKmpSil) {
      return sonuc(false, [hataSatiri("KILIT", "\"" + kilitliKmpSil.Kampanya +
        "\" kampanyası kilitli — devir satırı silinemez. Önce Devir Stok & Kampanya Yönetimi ekranından kilidi açın.")], [], null);
    }

    var yedek = anlikGoruntu(depo, [siloMu ? "siloDevirStok" : "devirStok", "degisiklikLog"]);
    try {
      tablo.splice(tablo.indexOf(kayit), 1);
      logYaz(depo, {
        tablo: tabloAdi, kayitId: kayit.Id, alan: null,
        eski: YU.fmt.tarih(kayit.DevirTarihi) + " · " + YU.fmt.kgU(kayit.Miktar),
        yeni: null, kullaniciId: kullaniciId, islem: "Sil"
      });
    } catch (e) {
      geriSar(depo, yedek);
      return sonuc(false, [beklenmedikHata(e)], [], null);
    }

    depo.kaydet();
    return sonuc(true, [], devirUyarilari(depo, siloMu ? kayit.SiloId : null), kayit);
  }

  /* ---------- malzeme / kullanıcı / silo ----------
     D12: bu üçünde SİLME servisi yoktur; pasifleştirme (Aktif=false) kullanılır. */

  function sonrakiSira(tablo) {
    var en = 0, i, s;
    for (i = 0; i < tablo.length; i++) {
      s = Number(tablo[i].Sira) || 0;
      if (s > en) en = s;
    }
    return en + 1;
  }

  function malzemeKaydet(depo, malzeme, kullanici) {
    var kullaniciId = kullanici && kullanici.Id !== undefined ? kullanici.Id : null;
    var mevcut = malzeme.Id ? satirBul(depo.malzemeler, malzeme.Id) : null;
    var aday = {
      Id: mevcut ? mevcut.Id : null,
      Ad: String(malzeme.Ad === undefined || malzeme.Ad === null ? "" : malzeme.Ad).trim(),
      Birim: malzeme.Birim === undefined || malzeme.Birim === null || malzeme.Birim === ""
        ? (mevcut ? mevcut.Birim : "Kg") : String(malzeme.Birim),
      Sira: malzeme.Sira === undefined || malzeme.Sira === null || malzeme.Sira === ""
        ? (mevcut ? mevcut.Sira : sonrakiSira(depo.malzemeler)) : say(malzeme.Sira),
      /* undefined = "alan gönderilmedi, koru"; "" veya null = "özel tipi kaldır". */
      OzelTip: malzeme.OzelTip === undefined ? (mevcut ? mevcut.OzelTip : null)
        : (malzeme.OzelTip === "" ? null : malzeme.OzelTip),
      Aktif: malzeme.Aktif === undefined ? (mevcut ? mevcut.Aktif : true) : malzeme.Aktif !== false
    };

    var d = YU.dogrula.malzeme(depo, aday);
    if (d.hatalar.length) return sonuc(false, d.hatalar, [], null);

    var yedek = anlikGoruntu(depo, ["malzemeler", "degisiklikLog"]);
    var kayit, eski, alanlar = ["Ad", "Birim", "Sira", "OzelTip", "Aktif"];
    try {
      if (mevcut) {
        eski = YU.kopya(mevcut);
        mevcut.Ad = aday.Ad;
        mevcut.Birim = aday.Birim;
        mevcut.Sira = aday.Sira;
        mevcut.OzelTip = aday.OzelTip;
        mevcut.Aktif = aday.Aktif;
        kayit = mevcut;
        logDegisenler(depo, "Malzemeler", kayit.Id, eski, kayit, alanlar, kullaniciId);
      } else {
        kayit = {
          Id: depo.yeniId("Malzemeler"), Ad: aday.Ad, Birim: aday.Birim,
          Sira: aday.Sira, OzelTip: aday.OzelTip, Aktif: aday.Aktif
        };
        depo.malzemeler.push(kayit);
        logYaz(depo, {
          tablo: "Malzemeler", kayitId: kayit.Id, alan: null, eski: null,
          yeni: kayit.Ad + " (" + kayit.Birim + ")", kullaniciId: kullaniciId, islem: "Ekle"
        });
      }
    } catch (e) {
      geriSar(depo, yedek);
      return sonuc(false, [beklenmedikHata(e)], [], null);
    }

    depo.kaydet();
    return sonuc(true, [], [], kayit);
  }

  function kullaniciKaydet(depo, kullanici, islemiYapan) {
    var kullaniciId = islemiYapan && islemiYapan.Id !== undefined ? islemiYapan.Id : null;
    var mevcut = kullanici.Id ? satirBul(depo.kullanicilar, kullanici.Id) : null;
    var aday = {
      Id: mevcut ? mevcut.Id : null,
      KullaniciAdi: String(kullanici.KullaniciAdi === undefined || kullanici.KullaniciAdi === null ? "" : kullanici.KullaniciAdi).trim(),
      AdSoyad: String(kullanici.AdSoyad === undefined || kullanici.AdSoyad === null ? "" : kullanici.AdSoyad).trim(),
      Rol: kullanici.Rol,
      Aktif: kullanici.Aktif === undefined ? (mevcut ? mevcut.Aktif : true) : kullanici.Aktif !== false
    };

    var d = YU.dogrula.kullanici(depo, aday, islemiYapan);
    if (d.hatalar.length) return sonuc(false, d.hatalar, [], null);

    var yedek = anlikGoruntu(depo, ["kullanicilar", "degisiklikLog"]);
    var kayit, eski;
    try {
      if (mevcut) {
        eski = YU.kopya(mevcut);
        mevcut.KullaniciAdi = aday.KullaniciAdi;
        mevcut.AdSoyad = aday.AdSoyad;
        mevcut.Rol = aday.Rol;
        mevcut.Aktif = aday.Aktif;
        kayit = mevcut;
        logDegisenler(depo, "Kullanicilar", kayit.Id, eski, kayit,
          ["KullaniciAdi", "AdSoyad", "Rol", "Aktif"], kullaniciId);
        /* Parola sıfırlama (§7). Hash değeri loglanmaz — denetim izi sızıntı yeri olmamalı. */
        if (kullanici.ParolaHash && kullanici.ParolaHash !== mevcut.ParolaHash) {
          mevcut.ParolaHash = kullanici.ParolaHash;
          logYaz(depo, {
            tablo: "Kullanicilar", kayitId: kayit.Id, alan: "ParolaHash",
            eski: null, yeni: "(sıfırlandı)", kullaniciId: kullaniciId, islem: "Guncelle"
          });
        }
      } else {
        kayit = {
          Id: depo.yeniId("Kullanicilar"),
          KullaniciAdi: aday.KullaniciAdi,
          /* Prototipte parola doğrulaması yok; alan gerçek uygulamada BCrypt hash'i tutar. */
          ParolaHash: kullanici.ParolaHash || "(prototip — gerçek uygulamada BCrypt)",
          AdSoyad: aday.AdSoyad,
          Rol: aday.Rol,
          Aktif: aday.Aktif,
          OlusturmaTarihi: simdi()
        };
        depo.kullanicilar.push(kayit);
        logYaz(depo, {
          tablo: "Kullanicilar", kayitId: kayit.Id, alan: null, eski: null,
          yeni: kayit.AdSoyad + " (" + kayit.KullaniciAdi + " · " + kayit.Rol + ")",
          kullaniciId: kullaniciId, islem: "Ekle"
        });
      }
    } catch (e) {
      geriSar(depo, yedek);
      return sonuc(false, [beklenmedikHata(e)], [], null);
    }

    depo.kaydet();
    return sonuc(true, [], [], kayit);
  }

  function siloKaydet(depo, silo, kullanici) {
    var mevcut = silo.Id ? satirBul(depo.silolar, silo.Id) : null;
    var aday = {
      Id: mevcut ? mevcut.Id : null,
      Ad: String(silo.Ad === undefined || silo.Ad === null ? "" : silo.Ad).trim(),
      Sira: silo.Sira === undefined || silo.Sira === null || silo.Sira === ""
        ? (mevcut ? mevcut.Sira : sonrakiSira(depo.silolar)) : say(silo.Sira),
      Kapasite: silo.Kapasite === undefined || silo.Kapasite === null || silo.Kapasite === ""
        ? (mevcut ? say(mevcut.Kapasite) : 0) : oku(silo.Kapasite),
      Aktif: silo.Aktif === undefined ? (mevcut ? mevcut.Aktif : true) : silo.Aktif !== false
    };

    var d = YU.dogrula.silo(depo, aday);
    if (d.hatalar.length) return sonuc(false, d.hatalar, [], null);

    var yedek = anlikGoruntu(depo, ["silolar"]);
    var kayit;
    try {
      if (mevcut) {
        mevcut.Ad = aday.Ad;
        mevcut.Sira = aday.Sira;
        mevcut.Kapasite = aday.Kapasite;
        mevcut.Aktif = aday.Aktif;
        kayit = mevcut;
      } else {
        kayit = { Id: depo.yeniId("Silolar"), Ad: aday.Ad, Sira: aday.Sira, Kapasite: aday.Kapasite, Aktif: aday.Aktif };
        depo.silolar.push(kayit);
      }
    } catch (e) {
      geriSar(depo, yedek);
      return sonuc(false, [beklenmedikHata(e)], [], null);
    }

    depo.kaydet();
    return sonuc(true, [], [], kayit);
  }

  YU.stok = {
    enSonDevir: enSonDevir,
    malzemeStok: malzemeStok,
    siloStok: siloStok,
    siloGunBasi: siloGunBasi,
    dokmeToplam: dokmeToplam,
    tumMalzemeler: tumMalzemeler,
    tumSilolar: tumSilolar,
    negatifGunler: negatifGunler,
    gunOzeti: gunOzeti,
    kayitliGunler: kayitliGunler
  };

  /* ---------- Arka plan arşivi ----------
     Ekranı olmayan üç tablo (kullanıcı isteği, 21.08.2026):
       OlayGunlugu      — her servis çağrısının ham girdisi ve sonucu
       SilinenKayitlar  — silinen kayıtların tam gövdesi (çöp kutusu hammaddesi)
       StokFotograflari — kayıt anında o günün hesaplanmış stok özeti
     İleride eklenecek modüller (rapor, geri getirme, tarihsel grafik) boş
     başlamasın diye veri şimdiden birikir. Arşiv, servis fonksiyonlarını
     DIŞARIDAN sarar: iş mantığına dokunmaz, sonucu değiştirmez ve arşiv
     yazımında çıkan hata hiçbir zaman iş akışını bozmaz. */

  var OLAY_SINIRI = 2000;   /* localStorage kotası emniyeti — taşınca en eski olay düşer */

  function kullaniciKimligi(k) {
    return k && typeof k === "object" && k.Id !== undefined ? k.Id : null;
  }

  function olayYaz(depo, servisAdi, girdi, ek, kullanici, s) {
    if (!depo.olayGunlugu) return;
    depo.olayGunlugu.push({
      Id: depo.yeniId("OlayGunlugu"),
      Servis: servisAdi,
      Girdi: girdi === undefined ? null : YU.kopya(girdi),
      Ek: ek === undefined ? null : YU.kopya(ek),
      KullaniciId: kullaniciKimligi(kullanici),
      Ok: !!(s && s.ok),
      HataKodlari: s && s.hatalar ? s.hatalar.map(function (h) { return h.kod; }) : [],
      Tarih: simdi()
    });
    while (depo.olayGunlugu.length > OLAY_SINIRI) depo.olayGunlugu.shift();
  }

  function copKutusunaAt(depo, gruplar, kullanici) {
    if (!depo.silinenKayitlar || !gruplar) return;
    var an = simdi(), i, j, g;
    for (i = 0; i < gruplar.length; i++) {
      g = gruplar[i];
      for (j = 0; j < g.kayitlar.length; j++) {
        depo.silinenKayitlar.push({
          Id: depo.yeniId("SilinenKayitlar"),
          Tablo: g.tablo,
          Kayit: YU.kopya(g.kayitlar[j]),
          Baglam: g.baglam || null,
          KullaniciId: kullaniciKimligi(kullanici),
          SilmeTarihi: an
        });
      }
    }
  }

  /* Fotoğraf, kayıt ANINDAKİ hesabın çıktısıdır; sonraki bir düzeltme geçmiş
     günün fotoğrafını güncellemez (o düzeltmenin kendi fotoğrafı çekilir). */
  function fotoCek(depo, tarih) {
    if (!depo.stokFotograflari || !tarih) return;
    var malzemeler = tumMalzemeler(depo, tarih);
    var silolar = tumSilolar(depo, tarih);
    var m = [], s = [], toplam = 0, i, kayit = null;

    for (i = 0; i < malzemeler.length; i++) {
      if (!malzemeler[i].malzeme) continue;
      m.push({ MalzemeId: malzemeler[i].malzeme.Id, Mevcut: say(malzemeler[i].mevcut) });
      toplam += Number(malzemeler[i].mevcut) || 0;
    }
    for (i = 0; i < silolar.length; i++) {
      s.push({ SiloId: silolar[i].silo.Id, Mevcut: say(silolar[i].mevcut) });
    }

    for (i = 0; i < depo.stokFotograflari.length; i++) {
      if (depo.stokFotograflari[i].Tarih === tarih) { kayit = depo.stokFotograflari[i]; break; }
    }
    if (!kayit) {
      kayit = { Id: depo.yeniId("StokFotograflari"), Tarih: tarih };
      depo.stokFotograflari.push(kayit);
    }
    kayit.Damga = simdi();
    kayit.Malzemeler = m;
    kayit.Silolar = s;
    kayit.DokmeToplam = say(dokmeToplam(depo, tarih));
    kayit.ToplamStok = YU.yuvarla(toplam);
  }

  /* ayar.girdi / ayar.ek / ayar.kullanici: ilgili argümanın sırası.
     ayar.tarih: fotoğrafı çekilecek iş tarihi (çağrıdan ÖNCE okunur — silme
     servislerinde kayıt çağrıdan sonra artık yoktur).
     ayar.silinecekler: silinecek kayıtların çağrı öncesi tam kopyaları. */
  /* ---------- kampanya yönetimi (kullanıcı isteği, 24.08.2026) ---------- */

  function kampanyaKilitle(depo, girdi, kullanici) {
    var ad = girdi && girdi.kampanya;
    var g = kampanyaBaslari(depo), i, var2 = false;
    for (i = 0; i < g.length; i++) if (g[i].ad === ad) { var2 = true; break; }
    if (!var2) return sonuc(false, [hataSatiri("Alan", "Kampanya bulunamadı: \"" + String(ad) + "\".")], [], null);
    if (kilitKaydi(depo, ad)) return sonuc(false, [hataSatiri("Alan", "\"" + ad + "\" zaten kilitli.")], [], null);
    if (!depo.kampanyaKilitleri) depo.kampanyaKilitleri = [];
    var kayit = {
      Id: depo.yeniId("KampanyaKilitleri"),
      Kampanya: ad,
      KullaniciId: kullaniciKimligi(kullanici),
      Tarih: simdi()
    };
    depo.kampanyaKilitleri.push(kayit);
    depo.kaydet();
    return sonuc(true, [], [], kayit);
  }

  function kampanyaKilidiAc(depo, girdi, kullanici) {
    var ad = girdi && girdi.kampanya;
    var kayit = kilitKaydi(depo, ad);
    if (!kayit) return sonuc(false, [hataSatiri("Alan", "\"" + String(ad) + "\" zaten kilitli değil.")], [], null);
    var l = depo.kampanyaKilitleri, i;
    for (i = l.length - 1; i >= 0; i--) if (l[i].Kampanya === ad) l.splice(i, 1);
    depo.kaydet();
    return sonuc(true, [], [], YU.kopya(kayit));
  }

  /* Yeni kampanya = yeni devir tarihi. Dökme kuru küspeye MALZEME devri
     yazılmaz: stoğu siloların toplamıdır (§5), silo devirleri onu kurar.
     Satırlar tek tek devirUpsert ile yazılır; biri hata verirse süreç
     durur ve o ana kadar yazılanlar kalır — hata mesajı bunu söyler. */
  function yeniKampanyaOlustur(depo, girdi, kullanici) {
    var tarih = girdi && girdi.tarih;
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(tarih || ""))) {
      return sonuc(false, [hataSatiri("Alan", "Kampanya başlangıç tarihi geçersiz.")], [], null);
    }
    if (tarih > YU.tarih.bugun()) {
      return sonuc(false, [hataSatiri("D17", "Gelecek tarihe kampanya açılamaz: " + YU.fmt.tarih(tarih) +
        " bugünden sonra. Kampanya, başladığı gün oluşturulur.")], [], null);
    }
    var g = kampanyaBaslari(depo), i;
    var yeniAd = kampanyaAdiHesapla(tarih);
    for (i = 0; i < g.length; i++) {
      if (g[i].ad === yeniAd) {
        return sonuc(false, [hataSatiri("Alan", "\"" + yeniAd + "\" sezonu zaten açık (başlangıcı " +
          YU.fmt.tarih(g[i].bas) + "). Aynı sezona ikinci kampanya açılamaz.")], [], null);
      }
    }
    var onceki = g.length ? g[g.length - 1] : null;
    if (onceki && tarih <= onceki.bas) {
      return sonuc(false, [hataSatiri("Alan", "Başlangıç, son kampanyanın başından (" +
        YU.fmt.tarih(onceki.bas) + ") sonra olmalı.")], [], null);
    }

    var devret = !girdi || girdi.devret !== false;
    var kapanis = YU.tarih.ekle(tarih, -1);
    var hatalar = [], yazilan = 0, m, s2, miktar;

    for (i = 0; i < depo.malzemeler.length; i++) {
      m = depo.malzemeler[i];
      if (m.Aktif === false || m.OzelTip === "DokmeKuruKuspe") continue;
      miktar = devret ? (Number(YU.stok.malzemeStok(depo, m.Id, kapanis).mevcut) || 0) : 0;
      s2 = devirUpsert(depo, "Malzeme", m.Id, tarih, YU.yuvarla(Math.max(0, miktar)), kullanici);
      if (s2.ok) yazilan++;
      else { hatalar.push(hataSatiri("Alan", m.Ad + ": " + (s2.hatalar[0] ? s2.hatalar[0].mesaj : "devir yazılamadı"))); break; }
    }
    if (!hatalar.length) {
      var siloSatirlari = YU.stok.tumSilolar(depo, kapanis);
      for (i = 0; i < siloSatirlari.length; i++) {
        if (siloSatirlari[i].silo.Aktif === false) continue;
        miktar = devret ? (Number(siloSatirlari[i].mevcut) || 0) : 0;
        s2 = devirUpsert(depo, "Silo", siloSatirlari[i].silo.Id, tarih, YU.yuvarla(Math.max(0, miktar)), kullanici);
        if (s2.ok) yazilan++;
        else { hatalar.push(hataSatiri("Alan", siloSatirlari[i].silo.Ad + ": " + (s2.hatalar[0] ? s2.hatalar[0].mesaj : "devir yazılamadı"))); break; }
      }
    }
    if (hatalar.length) {
      hatalar.push(hataSatiri("Alan", "Kampanya oluşturma yarıda kaldı: " + YU.fmt.sayi(yazilan) +
        " devir satırı yazıldı. Devir Stok tablolarından denetleyin."));
      return sonuc(false, hatalar, [], null);
    }

    if (girdi && girdi.oncekiKilitle && onceki && !kilitKaydi(depo, onceki.ad)) {
      kampanyaKilitle(depo, { kampanya: onceki.ad }, kullanici);
    }
    depo.kaydet();
    return sonuc(true, [], [], { ad: yeniAd, bas: tarih, yazilan: yazilan });
  }

  function arsivli(servisAdi, fn, ayar) {
    ayar = ayar || {};
    var girdiIdx = ayar.girdi === undefined ? 1 : ayar.girdi;
    var kullaniciIdx = ayar.kullanici === undefined ? 2 : ayar.kullanici;

    return function (depo) {
      var args = arguments, fotoTarihi = null, silinecekler = null;
      try {
        if (ayar.tarih) fotoTarihi = ayar.tarih.apply(null, args);
        if (ayar.silinecekler) silinecekler = ayar.silinecekler.apply(null, args);
      } catch (e) { fotoTarihi = null; silinecekler = null; }

      var s = fn.apply(null, args);

      try {
        olayYaz(depo, servisAdi, args[girdiIdx],
          ayar.ek === undefined ? undefined : args[ayar.ek], args[kullaniciIdx], s);
        if (s && s.ok) {
          if (silinecekler) copKutusunaAt(depo, silinecekler, args[kullaniciIdx]);
          if (fotoTarihi) fotoCek(depo, fotoTarihi);
        }
        depo.kaydet();
      } catch (e) { /* arşiv hatası iş sonucunu etkilemez */ }

      return s;
    };
  }

  function gunKayitlariKopyala(depo, tarih) {
    function esle(tablo) {
      var l = [], i;
      for (i = 0; i < tablo.length; i++) if (tablo[i].Tarih === tarih) l.push(tablo[i]);
      return l;
    }
    var baglam = "Gün silme · " + tarih;
    return [
      { tablo: "KuruKuspeGunluk", kayitlar: esle(depo.kuruKuspeGunluk), baglam: baglam },
      { tablo: "GunlukHareket", kayitlar: esle(depo.gunlukHareket), baglam: baglam },
      { tablo: "SiloHareket", kayitlar: esle(depo.siloHareket), baglam: baglam }
    ];
  }

  YU.servis = {
    kuruKuspeKaydet: arsivli("kuruKuspeKaydet", kuruKuspeKaydet, {
      tarih: function (depo, girdi) { return girdi ? girdi.tarih : null; },
      /* Üzerine yazmada silinecek eski silo hareketlerinin tam kopyası
         (kullanıcı isteği, 23.08.2026); yalnız çağrı BAŞARILIYSA arşivlenir.
         Günün Silo Hareketleri paneli bunları çizili gösterir. */
      silinecekler: function (depo, girdi) {
        if (!girdi || !girdi.tarih) return [];
        var mevcut = null, i, l = [];
        for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
          if (depo.kuruKuspeGunluk[i].Tarih === girdi.tarih) { mevcut = depo.kuruKuspeGunluk[i]; break; }
        }
        if (!mevcut) return [];
        for (i = 0; i < depo.siloHareket.length; i++) {
          if (depo.siloHareket[i].KaynakKayitId === mevcut.Id) l.push(depo.siloHareket[i]);
        }
        return l.length ? [{ tablo: "SiloHareket", kayitlar: l, baglam: "Üzerine yazma · " + girdi.tarih }] : [];
      }
    }),
    gunSil: arsivli("gunSil", gunSil, {
      tarih: function (depo, tarih) { return tarih; },
      silinecekler: gunKayitlariKopyala
    }),
    malzemeHareketKaydet: arsivli("malzemeHareketKaydet", malzemeHareketKaydet, {
      tarih: function (depo, girdi) { return girdi ? girdi.tarih : null; }
    }),
    devirKaydet: arsivli("devirKaydet", devirKaydet, {
      tarih: function (depo, girdi) { return girdi ? girdi.devirTarihi : null; }
    }),
    siloDevirKaydet: arsivli("siloDevirKaydet", siloDevirKaydet, {
      tarih: function (depo, girdi) { return girdi ? girdi.devirTarihi : null; }
    }),
    devirSil: arsivli("devirSil", devirSil, {
      ek: 2, kullanici: 3,
      tarih: function (depo, id, tip) {
        var k = satirBul(tip === "Silo" ? depo.siloDevirStok : depo.devirStok, id);
        return k ? k.DevirTarihi : null;
      },
      silinecekler: function (depo, id, tip) {
        var siloMu = tip === "Silo";
        var k = satirBul(siloMu ? depo.siloDevirStok : depo.devirStok, id);
        return k
          ? [{ tablo: siloMu ? "SiloDevirStok" : "DevirStok", kayitlar: [k], baglam: "Devir silme" }]
          : [];
      }
    }),
    kampanyaKilitle: arsivli("kampanyaKilitle", kampanyaKilitle),
    kampanyaKilidiAc: arsivli("kampanyaKilidiAc", kampanyaKilidiAc),
    yeniKampanyaOlustur: arsivli("yeniKampanyaOlustur", yeniKampanyaOlustur),
    /* Salt okuma: ekranlar kilit durumunu buradan sorar. */
    kampanyaKilitDurumu: function (depo, ad) { return kilitKaydi(depo, ad); },
    malzemeKaydet: arsivli("malzemeKaydet", malzemeKaydet),
    kullaniciKaydet: arsivli("kullaniciKaydet", kullaniciKaydet),
    siloKaydet: arsivli("siloKaydet", siloKaydet)
  };

  YU.log = {
    TABLOLAR: LOGLANAN_TABLOLAR,
    alanAdi: alanAdi,   /* ham alan anahtarı -> logdaki etiket (30-degisiklik-gecmisi rozeti kullanır) */
    yaz: logYaz,
    kayitBul: logKayitBul,
    kayitEtiketi: logKayitEtiketi,
    alanCumlesi: logAlanCumlesi,
    degerCumlesi: logDegerCumlesi
  };
})();

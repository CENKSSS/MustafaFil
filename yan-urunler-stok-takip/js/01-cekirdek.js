/* 01-cekirdek.js — biçimlendirme, tarih, PRNG ve depo (SOZLESME.md §1 ve §2).
   Klasik script: file:// üzerinde çalışır, tek global window.YU. */
(function () {
  "use strict";

  var YU = (window.YU = window.YU || {});

  /* ---------------------------------------------------------------
     Sayı
     --------------------------------------------------------------- */

  // Miktarlar veritabanında decimal(18,3); JS tarafında da 3 ondalıkta
  // sabitlenmezse ±0,01 toleransı kayan nokta artığına takılır (Şartname §6).
  YU.yuvarla = function (n) {
    var s = Number(n);
    if (!isFinite(s)) return s; // NaN korunur ki doğrulama yakalasın
    return Math.round(s * 1000) / 1000;
  };

  // Intl kullanılmaz: tarayıcıda tr-TR yerelinin bulunduğu varsayılamaz.
  function binlikAyir(tam) {
    var sonuc = "", sayac = 0, i;
    for (i = tam.length - 1; i >= 0; i--) {
      sonuc = tam.charAt(i) + sonuc;
      sayac += 1;
      if (sayac % 3 === 0 && i > 0) sonuc = "." + sonuc;
    }
    return sonuc;
  }

  function iki(n) {
    return (n < 10 ? "0" : "") + n;
  }

  YU.fmt = {};

  YU.fmt.sayi = function (n, ond) {
    var d = ond === undefined || ond === null ? 0 : Math.floor(Number(ond));
    if (!isFinite(d) || d < 0) d = 0;
    if (d > 6) d = 6;
    var s = Number(n);
    if (!isFinite(s)) return "—";
    var carpan = Math.pow(10, d);
    var v = Math.round(Math.abs(s) * carpan) / carpan;
    var p = v.toFixed(d).split(".");
    var govde = binlikAyir(p[0]) + (p.length > 1 ? "," + p[1] : "");
    return (s < 0 && v !== 0 ? "-" : "") + govde;
  };

  YU.fmt.kg = function (n) {
    var v = YU.yuvarla(n);
    if (!isFinite(v)) return "—";
    return YU.fmt.sayi(v, v % 1 === 0 ? 0 : 3);
  };

  YU.fmt.kgU = function (n) {
    var m = YU.fmt.kg(n);
    return m === "—" ? m : m + " kg";
  };

  /* Yalnızca sayı — birimi çağıran koyar (tablo hücresinde birim ayrı
     biçimlendiği için ikisi ayrı durur). */
  YU.fmt.tonSayi = function (n) {
    var s = Number(n);
    if (!isFinite(s)) return "—";
    var m = YU.fmt.sayi(YU.yuvarla(s / 1000), 3);
    if (m.indexOf(",") >= 0) {
      m = m.replace(/0+$/, "");
      m = m.replace(/,$/, "");
    }
    return m;
  };

  YU.fmt.ton = function (n) {
    var m = YU.fmt.tonSayi(n);
    return m === "—" ? m : m + " ton";
  };

  // n doğrudan yüzde değeridir: yuzde(23.8) -> "%23,8".
  // Oran (0..1) elde varsa çağıran 100 ile çarpar.
  YU.fmt.yuzde = function (n, ond) {
    var s = Number(n);
    if (!isFinite(s)) return "—";
    return "%" + YU.fmt.sayi(s, ond === undefined || ond === null ? 1 : ond);
  };

  /* ---------------------------------------------------------------
     Tarih — veride ISO metin "YYYY-MM-DD", ekranda GG.AA.YYYY
     --------------------------------------------------------------- */

  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
               "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

  function zamanDilimliMi(metin) {
    return /[T ]\d{2}:\d{2}/.test(metin) && /(Z|[+-]\d{2}:?\d{2})$/.test(metin);
  }

  // Tarih parçaları metinden okunur; Date kurulacaksa UTC ile kurulur —
  // yerel saat dilimi "2026-07-03"ü bir gün geriye kaydırmasın diye.
  function tarihAl(metin) {
    if (typeof metin !== "string") return null;
    if (zamanDilimliMi(metin)) {
      var d = new Date(metin);
      if (isNaN(d.getTime())) return null;
      return { y: d.getFullYear(), a: d.getMonth() + 1, g: d.getDate() };
    }
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(metin);
    if (!m) return null;
    return { y: +m[1], a: +m[2], g: +m[3] };
  }

  function saatAl(metin) {
    if (typeof metin !== "string") return null;
    if (zamanDilimliMi(metin)) {
      var d = new Date(metin);
      if (isNaN(d.getTime())) return null;
      return { s: d.getHours(), dk: d.getMinutes() };
    }
    var m = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/.exec(metin);
    if (!m) return null;
    return { s: +m[1], dk: +m[2] };
  }

  function utcGun(p) {
    return Date.UTC(p.y, p.a - 1, p.g);
  }

  function isoYaz(y, a, g) {
    return y + "-" + iki(a) + "-" + iki(g);
  }

  function isoDenUtc(iso) {
    var p = tarihAl(iso);
    return p ? utcGun(p) : NaN;
  }

  function utcDenIso(ms) {
    var d = new Date(ms);
    return isoYaz(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  YU.fmt.tarih = function (iso) {
    var p = tarihAl(iso);
    return p ? iki(p.g) + "." + iki(p.a) + "." + p.y : "—";
  };

  YU.fmt.tarihUzun = function (iso) {
    var p = tarihAl(iso);
    return p ? p.g + " " + AYLAR[p.a - 1] + " " + p.y : "—";
  };

  YU.fmt.gunAdi = function (iso) {
    var p = tarihAl(iso);
    if (!p) return "—";
    return GUNLER[new Date(utcGun(p)).getUTCDay()];
  };

  YU.fmt.saat = function (isoDT) {
    var s = saatAl(isoDT);
    return s ? iki(s.s) + ":" + iki(s.dk) : "—";
  };

  YU.fmt.tarihSaat = function (isoDT) {
    var t = YU.fmt.tarih(isoDT), s = YU.fmt.saat(isoDT);
    if (t === "—") return "—";
    return s === "—" ? t : t + " " + s;
  };

  YU.tarih = {};

  YU.tarih.bugun = function () {
    var d = new Date(); // gerçek sistem tarihi, yerel gün
    return isoYaz(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };

  YU.tarih.ekle = function (iso, gun) {
    var p = tarihAl(iso);
    if (!p) return null;
    return utcDenIso(Date.UTC(p.y, p.a - 1, p.g + Math.round(Number(gun) || 0)));
  };

  YU.tarih.fark = function (a, b) {
    var x = isoDenUtc(a), y = isoDenUtc(b);
    if (!isFinite(x) || !isFinite(y)) return NaN;
    return Math.round((y - x) / 86400000);
  };

  YU.tarih.ayBasi = function (iso) {
    var p = tarihAl(iso);
    return p ? isoYaz(p.y, p.a, 1) : null;
  };

  YU.tarih.aySonu = function (iso) {
    var p = tarihAl(iso);
    if (!p) return null;
    var son = new Date(Date.UTC(p.y, p.a, 0)).getUTCDate();
    return isoYaz(p.y, p.a, son);
  };

  /* ---------------------------------------------------------------
     Metin -> sayı
     --------------------------------------------------------------- */

  function binlikGecerli(parcalar) {
    if (parcalar.length === 1) return true;
    if (parcalar[0].length < 1 || parcalar[0].length > 3) return false;
    for (var i = 1; i < parcalar.length; i++) {
      if (parcalar[i].length !== 3) return false;
    }
    return true;
  }

  YU.parse = {};

  // "1.234,56" -> 1234.56 · "1234.56" -> 1234.56 · "" -> 0 · geçersiz -> NaN.
  // Virgül yokken tek nokta hem ondalık hem binlik olabilir: "5.000" fabrikada
  // 5000 kg demektir, bu yüzden 3 haneli kesir + kısa tam kısım binlik sayılır.
  YU.parse.sayi = function (metin) {
    if (typeof metin === "number") return isFinite(metin) ? metin : NaN;
    if (metin === null || metin === undefined) return 0;
    var s = String(metin).replace(/\s/g, "");
    if (s === "") return 0;
    if (!/^-?[0-9.,]+$/.test(s)) return NaN;

    var eksi = s.charAt(0) === "-";
    if (eksi) s = s.slice(1);
    if (s === "") return NaN;

    var virgul = s.split(","), tam, kesir = "";
    if (virgul.length > 2) return NaN;

    if (virgul.length === 2) {
      if (virgul[1].indexOf(".") >= 0) return NaN;
      var g = virgul[0].split(".");
      if (!binlikGecerli(g)) return NaN;
      tam = g.join("");
      kesir = virgul[1];
    } else {
      var n = s.split(".");
      if (n.length === 1) {
        tam = n[0];
      } else if (n.length === 2 && !(n[1].length === 3 && n[0].length >= 1 && n[0].length <= 3)) {
        tam = n[0];
        kesir = n[1];
      } else {
        if (!binlikGecerli(n)) return NaN;
        tam = n.join("");
      }
    }

    if (!/^[0-9]*$/.test(tam) || !/^[0-9]*$/.test(kesir)) return NaN;
    if (tam === "" && kesir === "") return NaN;

    var deger = Number((tam === "" ? "0" : tam) + (kesir === "" ? "" : "." + kesir));
    if (!isFinite(deger)) return NaN;
    return eksi ? -deger : deger;
  };

  /* ---------------------------------------------------------------
     Yardımcılar
     --------------------------------------------------------------- */

  YU.kopya = function (nesne) {
    if (nesne === null || typeof nesne !== "object") return nesne;
    var i, k, cikti;
    if (Object.prototype.toString.call(nesne) === "[object Array]") {
      cikti = [];
      for (i = 0; i < nesne.length; i++) cikti.push(YU.kopya(nesne[i]));
      return cikti;
    }
    cikti = {};
    for (k in nesne) {
      if (Object.prototype.hasOwnProperty.call(nesne, k)) cikti[k] = YU.kopya(nesne[k]);
    }
    return cikti;
  };

  // mulberry32 — deterministik PRNG; tohum verisi her yenilemede aynı rakamları
  // vermeli, bu yüzden dilin yerleşik rastgeleliği kullanılmaz (SOZLESME §11).
  YU.rastgele = function (tohum) {
    var a = (Number(tohum) || 0) >>> 0;
    var uretici = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    uretici.arasi = function (min, max) {
      return min + (max - min) * uretici();
    };
    uretici.tamsayi = function (min, max) {
      var d = Math.floor(min + (max - min + 1) * uretici());
      return d > max ? max : d;
    };
    uretici.sec = function (dizi) {
      if (!dizi || !dizi.length) return null;
      return dizi[uretici.tamsayi(0, dizi.length - 1)];
    };
    return uretici;
  };

  /* ---------------------------------------------------------------
     Depo — SOZLESME.md §1 tabloları
     --------------------------------------------------------------- */

  var DEPO_ANAHTAR = "yu.veri.v1";
  // Tohum verisi değişince (kampanya aralığı, miktarlar, denetim izi) eski
  // localStorage kaydı geçersizleşir; sürüm artırılır ve depo yeniden kurulur.
  // 4 (23.08.2026): geçmiş kampanya 5 günlük parçadan tam sezona (122 gün)
  //   çıkarıldı; sürüm yükseltilmezse tarayıcıdaki eski veri ekranda kalır.
  var SEMA_SURUM = 4;
  var PAROLA_NOTU = "(prototip — gerçek uygulamada BCrypt)";
  // Başlangıç kayıtlarının tarihi sabit: değişse localStorage içeriği her
  // açılışta farklılaşır ve "deterministik veri" kuralı bozulur.
  var TEMEL_TARIH = "2024-09-16T08:00:00";

  var TABLOLAR = [
    ["Kullanicilar", "kullanicilar"],
    ["Malzemeler", "malzemeler"],
    ["Silolar", "silolar"],
    ["DevirStok", "devirStok"],
    ["SiloDevirStok", "siloDevirStok"],
    ["GunlukHareket", "gunlukHareket"],
    ["KuruKuspeGunluk", "kuruKuspeGunluk"],
    ["SiloHareket", "siloHareket"],
    ["DegisiklikLog", "degisiklikLog"],
    // Arka plan arşivi — SOZLESME §1 dışıdır. Tek görünürlük istisnası
    // (kullanıcı isteği, 23.08.2026): silinen SiloHareket kopyaları, Kuru
    // Küspe Günlük Giriş > Günün Silo Hareketleri panelinde çizili listelenir.
    // İleride eklenecek modüller (rapor, çöp kutusu, tarihsel grafik) boş
    // başlamasın diye veri şimdiden birikir (kullanıcı isteği, 21.08.2026).
    ["OlayGunlugu", "olayGunlugu"],
    ["SilinenKayitlar", "silinenKayitlar"],
    ["StokFotograflari", "stokFotograflari"]
  ];

  // Sonradan eklenen arşiv tabloları: eski localStorage kaydında bulunmazlar.
  // oku() bunları eksikse boş dizi sayar ki mevcut veri sıfırlanmasın.
  var ARSIV_TABLOLARI = ["olayGunlugu", "silinenKayitlar", "stokFotograflari"];

  var HAREKET_TABLOLARI = ["devirStok", "siloDevirStok", "gunlukHareket",
                           "kuruKuspeGunluk", "siloHareket", "degisiklikLog",
                           "olayGunlugu", "silinenKayitlar", "stokFotograflari"];

  var MALZEME_TANIMI = [
    ["Yaş Küspe (Tonluk)", null],
    ["Yaş Küspe (25'lik)", null],
    ["Dökme Kuru Küspe", "DokmeKuruKuspe"],
    ["Kuru Küspe (50 Kg)", "CuvalKuruKuspe"],
    ["Atık Kuru Küspe", null],
    ["Kuyruk", null],
    ["Toprak", null]
  ];

  var KULLANICI_TANIMI = [
    ["yonetici", "Cenk Sefer ÇOĞALMIŞ", "Yonetici"],
    ["operator", "Ahmet Yılmaz", "Operator"],
    ["operator2", "Hatice Demir", "Operator"]
  ];

  var SILO_TANIMI = ["Silo 1", "Silo 2", "Silo 3"];
  var SILO_KAPASITE = 3000000; // kg — SİLO BAŞINA; Soru 5a kullanıcı kararıyla kapatıldı (21.08.2026)

  function temelVeriUret() {
    var kullanicilar = [], malzemeler = [], silolar = [], i;

    for (i = 0; i < KULLANICI_TANIMI.length; i++) {
      kullanicilar.push({
        Id: i + 1,
        KullaniciAdi: KULLANICI_TANIMI[i][0],
        ParolaHash: PAROLA_NOTU,
        AdSoyad: KULLANICI_TANIMI[i][1],
        Rol: KULLANICI_TANIMI[i][2],
        Aktif: true,
        OlusturmaTarihi: TEMEL_TARIH
      });
    }

    for (i = 0; i < MALZEME_TANIMI.length; i++) {
      malzemeler.push({
        Id: i + 1,
        Ad: MALZEME_TANIMI[i][0],
        Birim: "Kg",
        Sira: i + 1,
        OzelTip: MALZEME_TANIMI[i][1],
        Aktif: true
      });
    }

    for (i = 0; i < SILO_TANIMI.length; i++) {
      silolar.push({
        Id: i + 1,
        Ad: SILO_TANIMI[i],
        Sira: i + 1,
        Kapasite: SILO_KAPASITE,
        Aktif: true
      });
    }

    return { kullanicilar: kullanicilar, malzemeler: malzemeler, silolar: silolar };
  }

  YU.Depo = function (secenek) {
    secenek = secenek || {};
    var kaynak = secenek.kaynak === "bellek" ? "bellek" : "local";
    var tohumIstenir = secenek.tohumla !== false;
    var depo = { kaynak: kaynak }, i;

    for (i = 0; i < TABLOLAR.length; i++) depo[TABLOLAR[i][1]] = [];

    function tablo(ad) {
      for (var j = 0; j < TABLOLAR.length; j++) {
        if (TABLOLAR[j][0] === ad || TABLOLAR[j][1] === ad) return depo[TABLOLAR[j][1]];
      }
      return null;
    }

    // Diziler yerinde değiştirilir: servis katmanı depo.malzemeler gibi
    // referansları elinde tutabilsin diye yeni dizi atanmaz.
    function tablolariDoldur(veri) {
      for (var j = 0; j < TABLOLAR.length; j++) {
        var ad = TABLOLAR[j][1], hedef = depo[ad], gelen = veri && veri[ad];
        hedef.length = 0;
        if (gelen) {
          for (var q = 0; q < gelen.length; q++) hedef.push(gelen[q]);
        }
      }
    }

    function oku() {
      if (kaynak !== "local") return null;
      var ham, veri;
      try {
        ham = window.localStorage.getItem(DEPO_ANAHTAR);
      } catch (e) {
        return null;
      }
      if (!ham) return null;
      try {
        veri = JSON.parse(ham);
      } catch (e) {
        return null; // bozuk içerik: sessizce sıfırlanır
      }
      if (!veri || typeof veri !== "object" || veri.surum !== SEMA_SURUM) return null;
      for (var j = 0; j < TABLOLAR.length; j++) {
        var ad = TABLOLAR[j][1];
        if (Object.prototype.toString.call(veri[ad]) !== "[object Array]") {
          // Arşiv tabloları sonradan eklendi; eski kayıtta yoklarsa veri
          // geçersiz sayılmaz, boş dizi ile tamamlanır.
          if (ARSIV_TABLOLARI.indexOf(ad) >= 0) { veri[ad] = []; continue; }
          return null;
        }
      }
      return veri;
    }

    depo.yeniId = function (tabloAdi) {
      var t = tablo(tabloAdi), enBuyuk = 0, id;
      if (!t) return 1;
      for (var j = 0; j < t.length; j++) {
        id = Number(t[j] && t[j].Id);
        if (isFinite(id) && id > enBuyuk) enBuyuk = id;
      }
      return enBuyuk + 1;
    };

    // Saf üretici: SOZLESME §1 başlangıç satırlarını döndürür, depoyu değiştirmez.
    depo.temelVeri = temelVeriUret;

    depo.kaydet = function () {
      if (kaynak !== "local") return; // bellek deposu localStorage'a hiç dokunmaz
      try {
        var paket = { surum: SEMA_SURUM };
        for (var j = 0; j < TABLOLAR.length; j++) paket[TABLOLAR[j][1]] = depo[TABLOLAR[j][1]];
        window.localStorage.setItem(DEPO_ANAHTAR, JSON.stringify(paket));
      } catch (e) {
        /* kota dolu ya da depolama kapalı: prototip yazamasa da çalışmaya devam eder */
      }
    };

    depo.bosla = function () {
      for (var j = 0; j < HAREKET_TABLOLARI.length; j++) depo[HAREKET_TABLOLARI[j]].length = 0;
      depo.kaydet();
    };

    depo.sifirla = function () {
      tablolariDoldur(temelVeriUret());
      // 05-tohum.js yüklenmemişse (tek dosya testi) sessizce atlanır.
      if (tohumIstenir && typeof YU.tohumla === "function") YU.tohumla(depo);
      depo.kaydet();
    };

    var kayitli = oku();
    if (kayitli) tablolariDoldur(kayitli);
    else depo.sifirla();

    return depo;
  };
})();

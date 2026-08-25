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
  // 5 (24.08.2026): tohum TEK kampanyaya indi (2026/2027, devirden bugüne her
  //   gün, her siloya günlük hareket garantisi); eski iki kampanyalı veri
  //   geçersiz.
  // 6 (24.08.2026): geçen yılın tam sezonu (2025/2026, 122 gün) geri eklendi —
  //   veri artık iki kampanya; süren kampanyada gün sınırı yok.
  // 7 (24.08.2026): bugünün denetim izi inceltildi (ikinci kuru küspe
  //   düzeltmesi tohumdan çıktı) — işlem geçmişi ~36'dan ~22 satıra indi.
  // 8 (24.08.2026): "Dökme Yaş Küspe" basit malzemesi eklendi (devir + günlük
  //   plan dahil).
  // 9 (24.08.2026): GunlukHareket'e bilgi alanı Iade eklendi (stokta üretim
  //   gibi davranır, yalnız basit malzemede girilir); yaş küspe sırası
  //   değişti; bugüne iade örneği kondu.
  // 10 (24.08.2026): Id sayaçları eklendi — silinen Id yeniden dağıtılmaz,
  //   DegisiklikLog/arşiv yanlış kayda bağlanmaz (DUZELTME-PLANI M1). Tohum
  //   satış rampası sabit ufka bağlandı (M8); iki değişiklik de tohum
  //   çıktısını değiştirdiği için sürüm yükseltildi.
  var SEMA_SURUM = 10;
  var YAZMA_SAYAC_ANAHTAR = "yu.veri.sayac"; // sekmeler arası ezme bekçisi (M3)
  var YEDEK_ANAHTAR = "yu.veri.yedek";       // okunamayan eski paketin kopyası (M4)
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
    ["StokFotograflari", "stokFotograflari"],
    // Kampanya kilitleri (kullanıcı isteği, 24.08.2026): satır varlığı =
    // kampanya kilitli; kilitliyken o kampanyaya veri yazılamaz. SOZLESME
    // §1 dışıdır — sekiz tablo sözleşmesine dokunmaz.
    ["KampanyaKilitleri", "kampanyaKilitleri"]
  ];

  // Sonradan eklenen arşiv tabloları: eski localStorage kaydında bulunmazlar.
  // oku() bunları eksikse boş dizi sayar ki mevcut veri sıfırlanmasın.
  var ARSIV_TABLOLARI = ["olayGunlugu", "silinenKayitlar", "stokFotograflari", "kampanyaKilitleri"];

  var HAREKET_TABLOLARI = ["devirStok", "siloDevirStok", "gunlukHareket",
                           "kuruKuspeGunluk", "siloHareket", "degisiklikLog",
                           "olayGunlugu", "silinenKayitlar", "stokFotograflari",
                           "kampanyaKilitleri"];

  var MALZEME_TANIMI = [
    // Sıra kullanıcı isteğiyle (24.08.2026): Dökme Yaş, Tonluk, 25'lik.
    ["Dökme Yaş Küspe", null],     // basit malzeme; silo akışına girmez
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

    /* Okunamayan paket SİLİNMEDEN önce tek yedek anahtarına kopyalanır ve
       sebep not düşülür; kabuk açılışta bu notu kullanıcıya söyler (M4).
       Eskiden bozuk içerik sessizce yeniden tohumlanıyordu. */
    function yedekleVeNotDus(ham, sebep) {
      try {
        window.localStorage.setItem(YEDEK_ANAHTAR, ham);
      } catch (e) { /* yedek yazılamadıysa en azından not kalsın */ }
      YU.depoKurtarmaNotu = { sebep: sebep, anahtar: YEDEK_ANAHTAR };
    }

    /* Paket doğrulaması oku() ve iceAktar()'ın ortak kapısı: sürüm eşleşmeli,
       her çekirdek tablo dizi olmalı (arşiv tabloları eksikse tamamlanır). */
    function paketGecerliMi(veri) {
      if (!veri || typeof veri !== "object") return "bozuk";
      if (veri.surum !== SEMA_SURUM) return "surum";
      for (var j = 0; j < TABLOLAR.length; j++) {
        var ad = TABLOLAR[j][1];
        if (Object.prototype.toString.call(veri[ad]) !== "[object Array]") {
          if (ARSIV_TABLOLARI.indexOf(ad) >= 0) { veri[ad] = []; continue; }
          return "bozuk";
        }
      }
      return null;
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
        yedekleVeNotDus(ham, "bozuk");
        return null;
      }
      var kusur = paketGecerliMi(veri);
      if (kusur) {
        yedekleVeNotDus(ham, kusur);
        return null;
      }
      return veri;
    }

    /* Yazma sayacı: paketin yanında duran küçük tamsayı. Başka sekme kaydettiyse
       sayaç bu sekmenin bildiğinden ileridedir; kaydet() o zaman yazmaz (M3).
       Okunamıyorsa null döner ve kontrol tümden atlanır (localStorage kapalı
       ortamda eski davranış korunur). */
    function yazmaSayaciOku() {
      try {
        var v = window.localStorage.getItem(YAZMA_SAYAC_ANAHTAR);
        if (v === null || v === "") return 0;
        var n = parseInt(v, 10);
        return isFinite(n) ? n : 0;
      } catch (e) {
        return null;
      }
    }

    function kancayiCagir(tip) {
      if (typeof YU.depoUyari === "function") {
        try { YU.depoUyari(tip); } catch (e) { /* kanca hatası yazmayı etkilemez */ }
      }
    }

    /* Tablonun kanonik (küçük harfli) alan adı — sayaç anahtarı olarak kullanılır. */
    function tabloAnahtari(ad) {
      for (var j = 0; j < TABLOLAR.length; j++) {
        if (TABLOLAR[j][0] === ad || TABLOLAR[j][1] === ad) return TABLOLAR[j][1];
      }
      return null;
    }

    /* Id sayacı ASLA geri gitmez (M1): silinen kaydın Id'si yeniden verilirse
       DegisiklikLog ve arşiv o Id üzerinden YENİ kayda bağlanır, denetim izi
       yanlış kaydı gösterir. Taban = max(sayaç, tablodaki en büyük Id) — eski
       paketlerde sayaç yoksa tablo taraması devralır. */
    depo.sayaclar = {};

    depo.yeniId = function (tabloAdi) {
      var anahtar = tabloAnahtari(tabloAdi);
      var t = anahtar ? depo[anahtar] : null;
      var enBuyuk = 0, id;
      if (!t) return 1;
      for (var j = 0; j < t.length; j++) {
        id = Number(t[j] && t[j].Id);
        if (isFinite(id) && id > enBuyuk) enBuyuk = id;
      }
      var sayac = Number(depo.sayaclar[anahtar]);
      if (isFinite(sayac) && sayac > enBuyuk) enBuyuk = sayac;
      depo.sayaclar[anahtar] = enBuyuk + 1;
      return enBuyuk + 1;
    };

    // Saf üretici: SOZLESME §1 başlangıç satırlarını döndürür, depoyu değiştirmez.
    depo.temelVeri = temelVeriUret;

    function paketKur() {
      var paket = { surum: SEMA_SURUM, sayaclar: depo.sayaclar };
      for (var j = 0; j < TABLOLAR.length; j++) paket[TABLOLAR[j][1]] = depo[TABLOLAR[j][1]];
      return paket;
    }

    /* Açılışta storage'dan devralınır; her başarılı yazmada +1. */
    var beklenenSayac = kaynak === "local" ? yazmaSayaciOku() : null;

    /* Dönüş: yazma diske ulaştıysa true. false iki durumda gelir ve ikisinde de
       YU.depoUyari kancası (kabuk bağlar) tetiklenir:
       'cakisma' — başka sekme daha yeni yazmış; onun verisi EZİLMEZ, bu
                   sekmenin yenilenmesi gerekir (M3),
       'kota'    — localStorage yazmayı reddetti; kullanıcı "kaydedildi"
                   sanmasın (M2). Bellekteki veri her iki durumda da günceldir. */
    depo.kaydet = function () {
      if (kaynak !== "local") return true; // bellek deposu localStorage'a hiç dokunmaz
      if (beklenenSayac !== null) {
        var simdiki = yazmaSayaciOku();
        if (simdiki !== null && simdiki !== beklenenSayac) {
          kancayiCagir("cakisma");
          return false;
        }
      }
      try {
        window.localStorage.setItem(DEPO_ANAHTAR, JSON.stringify(paketKur()));
        if (beklenenSayac !== null) {
          beklenenSayac += 1;
          window.localStorage.setItem(YAZMA_SAYAC_ANAHTAR, String(beklenenSayac));
        }
        return true;
      } catch (e) {
        kancayiCagir("kota");
        return false;
      }
    };

    depo.bosla = function () {
      for (var j = 0; j < HAREKET_TABLOLARI.length; j++) {
        depo[HAREKET_TABLOLARI[j]].length = 0;
        /* Test yardımcısı: boşalan tabloların sayacı da sıfırlanır ki kabul
           testleri bugünkü Id davranışıyla (1'den) başlasın. Canlı akışta
           Id benzersizliğini sifirla()/kaydet() döngüsü değil, tablo boşken
           zaten anlamsız kalan geçmiş korur. */
        delete depo.sayaclar[HAREKET_TABLOLARI[j]];
      }
      depo.kaydet();
    };

    depo.sifirla = function () {
      depo.sayaclar = {}; // tohum her koşuda aynı Id'leri üretsin (determinizm)
      tablolariDoldur(temelVeriUret());
      // 05-tohum.js yüklenmemişse (tek dosya testi) sessizce atlanır.
      if (tohumIstenir && typeof YU.tohumla === "function") YU.tohumla(depo);
      depo.kaydet();
    };

    /* Yedekleme uçları (M5). Doğrulama oku() ile aynı kapıdan geçer; kabuk
       yalnız çağırır, biçim bilgisi bu dosyada kalır. */
    depo.disaAktar = function () {
      return JSON.stringify(paketKur());
    };

    /* İçe aktarma körlemesine yazmaz (kullanıcı direktifi, 24.08.2026):
       1) sürüm — birebir eşleşir ya da bilinen eski sürümden DÖNÜŞTÜRÜLÜR
          (9→10: yalnız Id sayaçları eklendi, tablolar aynı; sayaclar boş
          başlar ve tablo taramasından devralınır),
       2) yapı — çekirdek tablolar dizi olmalı (paketGecerliMi),
       3) bağ — Id referansları ve tekil anahtarlar taranır (04-servis
          yüklüyse YU.stok.butunlukRaporu aday paket üzerinde koşar),
       4) yazım ancak bu üçü geçtikten sonra; kabuk onay penceresinde
          buradan dönen ÖZETİ gösterir.
       kuruDeneme:true yalnız inceler, depoya DOKUNMAZ. */
    function paketiDonustur(veri) {
      if (veri && typeof veri === "object" && veri.surum === 9) {
        veri.surum = 10;
        veri.sayaclar = {};
        return "9 → 10 (Id sayaçları eklendi)";
      }
      return null;
    }

    function paketOzeti(veri) {
      var gunler = [], i, t;
      for (i = 0; i < (veri.kuruKuspeGunluk || []).length; i++) {
        t = veri.kuruKuspeGunluk[i].Tarih;
        if (t) gunler.push(t);
      }
      gunler.sort();
      return {
        gunSayisi: gunler.length,
        ilkGun: gunler.length ? gunler[0] : null,
        sonGun: gunler.length ? gunler[gunler.length - 1] : null,
        hareketSayisi: (veri.gunlukHareket || []).length + (veri.siloHareket || []).length
      };
    }

    depo.iceAktar = function (metin, secenek) {
      var kuru = !!(secenek && secenek.kuruDeneme);
      var veri, donusum = null;
      try {
        veri = JSON.parse(String(metin));
      } catch (e) {
        return { ok: false, hata: "Dosya JSON olarak okunamadı." };
      }
      var kusur = paketGecerliMi(veri);
      if (kusur === "surum") {
        donusum = paketiDonustur(veri);
        if (donusum) kusur = paketGecerliMi(veri);
      }
      if (kusur === "surum") {
        return { ok: false, hata: "Yedek desteklenmeyen bir şema sürümünden (" +
          (veri && veri.surum) + "); beklenen " + SEMA_SURUM + " (9'dan dönüştürme yapılabilir)." };
      }
      if (kusur) return { ok: false, hata: "Yedek paketi eksik ya da bozuk — mevcut veriye dokunulmadı." };

      /* Bağ/tekillik taraması aday paket üzerinde — bozuk paket reddedilir. */
      if (YU.stok && typeof YU.stok.butunlukRaporu === "function") {
        var sorunlar;
        try { sorunlar = YU.stok.butunlukRaporu(veri); } catch (e) { sorunlar = []; }
        if (sorunlar && sorunlar.length) {
          return { ok: false, hata: "Yedek paketinde " + sorunlar.length +
            " bütünlük sorunu var (ilki: " + sorunlar[0] + ") — mevcut veriye dokunulmadı." };
        }
      }

      var ozet = paketOzeti(veri);
      ozet.donusum = donusum;
      ozet.mevcutGunSayisi = depo.kuruKuspeGunluk.length;
      if (kuru) return { ok: true, hata: null, ozet: ozet };

      tablolariDoldur(veri);
      depo.sayaclar = veri.sayaclar && typeof veri.sayaclar === "object" ? veri.sayaclar : {};
      if (!depo.kaydet()) return { ok: false, hata: "Veri geri yüklendi ama diske yazılamadı." };
      return { ok: true, hata: null, ozet: ozet };
    };

    var kayitli = oku();
    if (kayitli) {
      tablolariDoldur(kayitli);
      depo.sayaclar = kayitli.sayaclar && typeof kayitli.sayaclar === "object" ? kayitli.sayaclar : {};
    } else {
      depo.sifirla();
    }

    return depo;
  };
})();

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

  /* ---------------------------------------------------------------
     Zaman — İstanbul saati, kaynağı internet (kullanıcı isteği, 26.08.2026)

     Uygulamanın "şimdi"si bilgisayarın saatinden değil, İNTERNETTEN alınan
     zamandan türer: yanlış kurulmuş bir makine saati kayıt damgalarını,
     rapor tarihlerini ve gün dönümünü kaydırmasın.

       kayma  — güvenilen UTC ile Date.now() arasındaki fark (ms)
       kaynak — 'internet' (eşitleme tuttu) · 'bilgisayar' (tutmadı)

     Gün ve saat HER ZAMAN Europe/Istanbul'a çevrilerek okunur; makinenin saat
     dilimi ne olursa olsun fabrikanın günü değişmez.

     Erişim yoksa (Şartname §9 karar kaydı: "uygulama fabrika ağında çalışıyor
     ve internete açık değil") kayma 0 kalır ve an makineden okunur — yalnız
     kaynağı değişir, uygulama çalışmayı sürdürür. Hiçbir ekran eşitlemeyi
     BEKLEMEZ; eşitleme arka planda döner, tutunca gün değiştiyse dinleyiciler
     uyanır.

     Kaynaklar 26.08.2026'da tarayıcıdan denendi: timeapi.io (108–360 ms) ve
     Cloudflare cdn-cgi/trace (229 ms) CORS'a açık ve yanıt veriyor;
     worldtimeapi.org ile worldclockapi.com yanıt vermedi, listeye alınmadı.
     --------------------------------------------------------------- */

  var ZAMAN_KAYNAKLARI = [
    {
      ad: "timeapi.io",
      url: "https://timeapi.io/api/Time/current/zone?timeZone=UTC",
      oku: function (metin) {
        var j = JSON.parse(metin);
        return Date.UTC(j.year, j.month - 1, j.day, j.hour, j.minute, j.seconds, j.milliSeconds || 0);
      }
    },
    {
      ad: "cloudflare",
      url: "https://www.cloudflare.com/cdn-cgi/trace",
      oku: function (metin) {
        var m = /(?:^|\n)ts=([0-9.]+)/.exec(metin);
        return m ? Math.round(parseFloat(m[1]) * 1000) : NaN;
      }
    }
  ];

  var ZAMAN_ARALIK = 30 * 60 * 1000;   /* düzenli tazeleme */
  var ZAMAN_ZAMANASIMI = 5000;         /* tek istek için üst sınır */
  var ZAMAN_GUN_YOKLAMA = 20000;       /* gün dönümü yoklama sıklığı */

  var zKayma = 0;
  var zKaynak = "bilgisayar";
  var zSunucu = null;
  var zSonEsitleme = null;             /* ms — Date.now() ölçeğinde */
  var zIstek = null;                   /* süren eşitleme sözü */
  var zDinleyiciler = [];
  var zSonGun = null;
  var zBicimci;                        /* undefined: denenmedi · false: yok */

  /* Europe/Istanbul çevrimi Intl'in saat dilimi tablosundan okunur. Sayı
     biçimlendirmede Intl'e güvenilmiyor (tr-TR yereli olmayabilir) ama saat
     dilimi tablosu yerelden bağımsızdır. Bulunmazsa yedek yol var: Türkiye
     8 Eylül 2016'dan beri kalıcı UTC+03, yaz saati uygulamıyor. */
  function zamanBicimci() {
    if (zBicimci !== undefined) return zBicimci;
    zBicimci = false;
    try {
      if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
        var f = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Istanbul", hour12: false,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
        if (typeof f.formatToParts === "function") zBicimci = f;
      }
    } catch (e) { zBicimci = false; }
    return zBicimci;
  }

  function istanbulParcalari(ms) {
    var f = zamanBicimci(), p, o, i, s;
    if (f) {
      try {
        p = f.formatToParts(new Date(ms));
        o = {};
        for (i = 0; i < p.length; i++) if (p[i].type !== "literal") o[p[i].type] = p[i].value;
        s = Number(o.hour);
        if (s === 24) s = 0;           /* bazı sürümler gece yarısını 24 yazar */
        return {
          y: Number(o.year), a: Number(o.month), g: Number(o.day),
          s: s, dk: Number(o.minute), sn: Number(o.second)
        };
      } catch (e) { zBicimci = false; }
    }
    var d = new Date(ms + 3 * 3600000);
    return {
      y: d.getUTCFullYear(), a: d.getUTCMonth() + 1, g: d.getUTCDate(),
      s: d.getUTCHours(), dk: d.getUTCMinutes(), sn: d.getUTCSeconds()
    };
  }

  function zamanMs(ms) { return ms === undefined || ms === null ? Date.now() + zKayma : ms; }

  /* Tek kaynağı dener; gidiş-dönüş süresinin yarısı düşülerek kayma bulunur
     (sunucunun yazdığı an, isteğin ortasına denk gelir). */
  function zamanKaynaginiOku(kaynak) {
    return new Promise(function (coz, red) {
      if (typeof fetch !== "function") { red(new Error("fetch yok")); return; }
      var kes = null, saat = null;
      try { kes = new AbortController(); } catch (e) { kes = null; }
      if (kes) saat = setTimeout(function () { try { kes.abort(); } catch (e2) { /* yoksay */ } }, ZAMAN_ZAMANASIMI);
      var t0 = Date.now();
      fetch(kaynak.url, { cache: "no-store", signal: kes ? kes.signal : undefined })
        .then(function (yanit) {
          if (!yanit.ok) throw new Error("HTTP " + yanit.status);
          return yanit.text();
        })
        .then(function (metin) {
          if (saat) clearTimeout(saat);
          var sunucuMs = kaynak.oku(metin);
          if (!isFinite(sunucuMs)) throw new Error("zaman okunamadı");
          var t1 = Date.now();
          coz({ ad: kaynak.ad, kayma: sunucuMs - (t0 + t1) / 2 });
        })
        .catch(function (e) { if (saat) clearTimeout(saat); red(e); });
    });
  }

  function zamanEsitle() {
    if (zIstek) return zIstek;
    var i = 0;
    function dene() {
      if (i >= ZAMAN_KAYNAKLARI.length) return Promise.resolve(false);
      return zamanKaynaginiOku(ZAMAN_KAYNAKLARI[i++]).then(function (s) {
        zKayma = Math.round(s.kayma);
        zKaynak = "internet";
        zSunucu = s.ad;
        zSonEsitleme = Date.now();
        return true;
      }, function () { return dene(); });
    }
    zIstek = dene().then(function (tuttu) {
      zIstek = null;
      zamanGunKontrol();
      return tuttu;
    }, function () { zIstek = null; return false; });
    return zIstek;
  }

  function zamanGunKontrol() {
    var g = YU.zaman.isoGun(), eski = zSonGun, i;
    if (eski === null) { zSonGun = g; return; }
    if (g === eski) return;
    zSonGun = g;
    for (i = 0; i < zDinleyiciler.length; i++) {
      try { zDinleyiciler[i](g, eski); }
      catch (e) { if (window.console) console.error("[zaman] gün dinleyicisi", e); }
    }
  }

  YU.zaman = {
    /* Güvenilen "şimdi" — Date.now() ile aynı ölçekte ms. */
    ms: function () { return Date.now() + zKayma; },

    /* İstanbul saat parçaları: { y, a, g, s, dk, sn }. */
    parcalar: function (ms) { return istanbulParcalari(zamanMs(ms)); },

    /* 'YYYY-MM-DD' — İstanbul günü. */
    isoGun: function (ms) {
      var p = istanbulParcalari(zamanMs(ms));
      return isoYaz(p.y, p.a, p.g);
    },

    /* 'YYYY-MM-DDTHH:MM:SS' — denetim damgası. Sonda 'Z' YOK: new Date(metin)
       bunu yerel saat olarak okusun, saat kaymasın. */
    damga: function (ms) {
      var p = istanbulParcalari(zamanMs(ms));
      return isoYaz(p.y, p.a, p.g) + "T" + iki(p.s) + ":" + iki(p.dk) + ":" + iki(p.sn);
    },

    /* 'YYYY-MM-DD HH:MM:SS' — kullanıcı yönetimi damgası. */
    damgaBosluklu: function (ms) { return YU.zaman.damga(ms).replace("T", " "); },

    /* 'HH:MM:SS' */
    saat: function (ms) {
      var p = istanbulParcalari(zamanMs(ms));
      return iki(p.s) + ":" + iki(p.dk) + ":" + iki(p.sn);
    },

    esitle: zamanEsitle,

    /* "Saat nereden geliyor" sorusunun tek yanıt yeri. */
    durum: function () {
      return {
        kaynak: zKaynak,
        sunucu: zSunucu,
        kayma: zKayma,
        sonEsitleme: zSonEsitleme === null ? null : YU.zaman.damga(zSonEsitleme + zKayma)
      };
    },

    /* Gece yarısı (İstanbul) geçilince çağrılır: fn(yeniGun, eskiGun). */
    gunDegisince: function (fn) { if (typeof fn === "function") zDinleyiciler.push(fn); }
  };

  /* ---------------------------------------------------------------
     E-posta — giriş kimliği (kullanıcı kararı, 26.08.2026)

     Giriş adı artık ROL değil KİŞİ gösterir ve e-posta adresidir. Veri modeli
     DEĞİŞMEDİ: alan hâlâ Kullanicilar.KullaniciAdi, tekillik kısıtı ve D11
     aynen duruyor (Şartname §6: "Alan adlarını değiştirebilirsin ama
     ilişkileri ve tekillik kısıtlarını koru"). Değişen, alanın İÇERİĞİ ve
     ekrandaki etiketi.

     Alan adı 'fabrika.com': projede zaten örnek adres olarak geçiyordu
     (35-mail-gonder.js "ad@fabrika.com"). GERÇEK alan adı bilinmiyor —
     tohum ve dönüştürme bu yer tutucuyu kullanır, kullanıcı kendi adresini
     Kullanıcı Yönetimi'nden yazar.
     --------------------------------------------------------------- */

  var EPOSTA_KALIP = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var EPOSTA_ALAN = "fabrika.com";

  var TR_HARF = { "ç": "c", "ğ": "g", "ı": "i", "İ": "i", "ö": "o", "ş": "s", "ü": "u",
                  "Ç": "c", "Ğ": "g", "I": "i", "Ö": "o", "Ş": "s", "Ü": "u" };

  function sadeHarf(metin) {
    var s = String(metin === null || metin === undefined ? "" : metin), c = "", i, h;
    for (i = 0; i < s.length; i++) {
      h = s.charAt(i);
      c += Object.prototype.hasOwnProperty.call(TR_HARF, h) ? TR_HARF[h] : h;
    }
    /* toLowerCase (toLocaleLowerCase DEĞİL): adres ASCII'dir, Türkçe kuralı
       "I" harfini noktasız "ı" yapıp adresi bozardı. */
    return c.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  YU.ePosta = {
    alanAdi: EPOSTA_ALAN,

    gecerliMi: function (adres) {
      return EPOSTA_KALIP.test(String(adres === null || adres === undefined ? "" : adres).trim());
    },

    /* Saklama biçimi: boşluksuz ve küçük harf — "Ahmet@..." ile "ahmet@..."
       iki ayrı hesap sayılmasın. */
    duzelt: function (adres) {
      return String(adres === null || adres === undefined ? "" : adres).trim().toLowerCase();
    },

    /* "Cenk Sefer ÇOĞALMIŞ" -> "cenk.cogalmis@fabrika.com".
       İlk ve SON kelime alınır; ortadaki adlar adresi uzatmasın. */
    adres: function (adSoyad, alan) {
      var parcalar = String(adSoyad === null || adSoyad === undefined ? "" : adSoyad).trim().split(/\s+/);
      var temiz = [], i, p;
      for (i = 0; i < parcalar.length; i++) {
        p = sadeHarf(parcalar[i]);
        if (p) temiz.push(p);
      }
      if (!temiz.length) return "";
      var yerel = temiz.length === 1 ? temiz[0] : temiz[0] + "." + temiz[temiz.length - 1];
      return yerel + "@" + (alan || EPOSTA_ALAN);
    }
  };

  /* Eski veride giriş adı e-posta değil ("yonetici", "operator"): AD SOYAD'dan
     adres türetilir. Şema sürümü BİLEREK artırılmadı — sürüm artınca yerel veri
     atılıp tohum yeniden kuruluyor (bkz. oku() "surum" kusuru) ve kullanıcının
     kampanya verisi silinirdi. Alan, tekillik kısıtı ve D11 aynı; değişen
     yalnız içerik. Aynı ada iki kişi düşerse ikincisine sayı eklenir. */
  function ePostaOnarimi(depo) {
    var liste = (depo && depo.kullanicilar) || [];
    var degisti = false, kullanilan = {}, i, k, temel, yerel, alan, aday, sayac;

    for (i = 0; i < liste.length; i++) {
      if (YU.ePosta.gecerliMi(liste[i].KullaniciAdi)) {
        kullanilan[YU.ePosta.duzelt(liste[i].KullaniciAdi)] = 1;
      }
    }

    for (i = 0; i < liste.length; i++) {
      k = liste[i];
      if (YU.ePosta.gecerliMi(k.KullaniciAdi)) continue;
      temel = YU.ePosta.adres(k.AdSoyad) || ("kullanici" + k.Id + "@" + YU.ePosta.alanAdi);
      yerel = temel.split("@")[0];
      alan = temel.split("@")[1];
      aday = temel;
      sayac = 2;
      while (kullanilan[aday]) { aday = yerel + sayac + "@" + alan; sayac++; }
      kullanilan[aday] = 1;
      k.KullaniciAdi = aday;
      degisti = true;
    }
    return degisti;
  }

  /* ---------------------------------------------------------------
     Parola — kurma ve doğrulama (kullanıcı isteği, 26.08.2026)

     Şartname §3 (Demirbaş): "Uygulamaya giriş kullanıcı adı ve parola ile
     yapılır. Parolalar veritabanında düz metin tutulmaz, hash'lenir (BCrypt
     gibi bir algoritma kullan)."  §10: "Varsayılan parola ilk girişte
     değiştirilmeli."  Bu modül ikisinin tarayıcı karşılığıdır.

     ALGORİTMA · PBKDF2-HMAC-SHA256, 600.000 tur, 16 baytlık rastgele tuz,
     32 baytlık çıktı. 600.000 sayısı OWASP Password Storage Cheat Sheet'ten
     alındı ve 26.08.2026'da okundu; aynı gün bu tarayıcıda ölçüldü: 89 ms —
     girişte hissedilmez, deneme-yanılmada pahalıdır. BCrypt tarayıcıda yok;
     sunucuya geçilirken ParolaHash yeniden üretilir (kullanıcı parolasını
     bir kez daha kurar), alanın tipi değişmez.

     SAKLANAN BİÇİM tek satır metindir, sekiz tablo şeması değişmez:
        pbkdf2$sha256$<tur>$<tuz-b64>$<hash-b64>

     KURAL DENETİMİ · OWASP Authentication Cheat Sheet (26.08.2026): bileşim
     zorunluluğu (büyük harf + rakam + simge) YOKTUR — kullanıcıyı tahmin
     edilebilir kalıplara iter. Uzunluk ve bilinen-kötü listesi vardır.

     crypto.subtle yalnız GÜVENLİ BAĞLAMDA bulunur (https ya da localhost);
     uygulama file:// ile açılırsa yoktur. O durumda parola KURULMAZ ve bu
     açıkça söylenir — zayıf bir yedek hash uydurmak, güvenlik yokken var
     sanmaktan kötüdür.
     --------------------------------------------------------------- */

  var PAROLA_ONEK = "pbkdf2$sha256$";
  var PAROLA_TUR = 600000;
  var PAROLA_TUZ_BAYT = 16;
  var PAROLA_BIT = 256;
  /* TEK ÖLÇÜT UZUNLUK (kullanıcı kararı, 26.08.2026: "en az 6 olsun, zayıflık
     falan bir kriter olmasın"). Önceki sürümde 12 karakter, yaygın-parola
     kara listesi ve "parola e-postanla aynı olamaz" denetimi vardı; üçü de
     kaldırıldı. Şartname §3 yalnız "hash'lenir" der, uzunluk ya da güç kuralı
     koymaz — bu yüzden Demirbaş bir maddeyle çelişmez. Hash'leme aynen duruyor
     (PBKDF2-SHA256); düz metin hiçbir yere yazılmaz. */
  var PAROLA_ENAZ = 6;
  var PAROLA_ENCOK = 128;

  function parolaAltYapi() {
    return !!(window.crypto && window.crypto.subtle &&
              typeof window.TextEncoder === "function" &&
              typeof window.btoa === "function" &&
              typeof window.Promise === "function");
  }

  function b64Yaz(bayt) {
    var s = "", i;
    for (i = 0; i < bayt.length; i++) s += String.fromCharCode(bayt[i]);
    return btoa(s);
  }

  function b64Oku(metin) {
    var s = atob(String(metin)), b = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  function parolaTuret(metin, tuz, tur) {
    var ham = new TextEncoder().encode(String(metin));
    return crypto.subtle.importKey("raw", ham, "PBKDF2", false, ["deriveBits"])
      .then(function (anahtar) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: tuz, iterations: tur, hash: "SHA-256" },
          anahtar, PAROLA_BIT);
      })
      .then(function (bit) { return new Uint8Array(bit); });
  }

  /* Sabit süreli karşılaştırma: erken çıkış, doğru baytların sayısını
     zamanlamayla sızdırır. */
  function baytEsit(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var fark = 0, i;
    for (i = 0; i < a.length; i++) fark |= a[i] ^ b[i];
    return fark === 0;
  }

  YU.parola = {
    /* Bu tarayıcıda/bağlamda parola kurulabilir mi? */
    kurulabilirMi: parolaAltYapi,

    enAz: PAROLA_ENAZ,
    enCok: PAROLA_ENCOK,

    /* Metin gerçek bir hash mi — prototip notu ya da boş değer değil mi? */
    gecerliHashMi: function (metin) {
      return typeof metin === "string" && metin.indexOf(PAROLA_ONEK) === 0 &&
             metin.split("$").length === 5;
    },

    /* Kullanıcının kurulmuş bir parolası var mı? Eski prototip notları
       ("(prototip — …") ve boş değer "yok" demektir. */
    varMi: function (kullanici) {
      return YU.parola.gecerliHashMi(kullanici && kullanici.ParolaHash);
    },

    /* Kural denetimi. Dönen: { ok, hata, tekrarHata }.
       hata -> birinci alanın altına, tekrarHata -> ikinci alanın altına.
       kullaniciAdi parametresi çağrılarda duruyor ama artık kullanılmıyor. */
    denetle: function (metin, tekrar) {
      var p = metin === undefined || metin === null ? "" : String(metin);
      var t = tekrar === undefined || tekrar === null ? "" : String(tekrar);
      var hata = null, tekrarHata = null;

      if (p === "") {
        hata = "Parola boş olamaz.";
      } else if (p.length < PAROLA_ENAZ) {
        hata = "Parola en az " + PAROLA_ENAZ + " karakter olmalı.";
      } else if (p.length > PAROLA_ENCOK) {
        hata = "Parola en çok " + PAROLA_ENCOK + " karakter olabilir.";
      }

      if (!hata) {
        if (t === "") tekrarHata = "Parolayı bir kez daha yazın.";
        else if (t !== p) tekrarHata = "İki parola aynı değil.";
      }

      return { ok: !hata && !tekrarHata, hata: hata, tekrarHata: tekrarHata };
    },

    /* Parolayı hash'ler. Söz, saklanacak tek satır metinle çözülür. */
    olustur: function (metin) {
      if (!parolaAltYapi()) {
        return Promise.reject(new Error("Bu tarayıcıda parola kurulamıyor (güvenli bağlam yok)."));
      }
      var tuz = crypto.getRandomValues(new Uint8Array(PAROLA_TUZ_BAYT));
      return parolaTuret(metin, tuz, PAROLA_TUR).then(function (hash) {
        return PAROLA_ONEK + PAROLA_TUR + "$" + b64Yaz(tuz) + "$" + b64Yaz(hash);
      });
    },

    /* Girilen parola saklanan hash'e uyuyor mu? Tur sayısı SAKLANAN değerden
       okunur: ileride tur artırılsa bile eski parolalar doğrulanmaya devam
       eder. */
    dogrula: function (metin, saklanan) {
      if (!parolaAltYapi() || !YU.parola.gecerliHashMi(saklanan)) return Promise.resolve(false);
      var p = String(saklanan).split("$");
      var tur = Number(p[2]);
      if (!isFinite(tur) || tur < 1) return Promise.resolve(false);
      var tuz, beklenen;
      try { tuz = b64Oku(p[3]); beklenen = b64Oku(p[4]); }
      catch (e) { return Promise.resolve(false); }
      return parolaTuret(metin, tuz, tur)
        .then(function (hash) { return baytEsit(hash, beklenen); })
        .catch(function () { return false; });
    }
  };

  YU.tarih = {};

  YU.tarih.bugun = function () { return YU.zaman.isoGun(); };

  zSonGun = YU.zaman.isoGun();

  /* Eşitleme arka planda: açılışta bir kez, sonra düzenli; ağ geri gelince ve
     sekme öne çıkınca da denenir. Gün dönümü YOKLAMAYLA bulunur — tek bir
     "gece yarısına kadar bekle" zamanlayıcısı, makine uykuya dalıp uyandığında
     kayar; 20 saniyelik yoklama kaymaz. */
  if (typeof setTimeout === "function") {
    setTimeout(zamanEsitle, 0);
    setInterval(zamanEsitle, ZAMAN_ARALIK);
    setInterval(zamanGunKontrol, ZAMAN_GUN_YOKLAMA);
  }
  if (window.addEventListener) {
    window.addEventListener("online", function () { zamanEsitle(); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      zamanGunKontrol();
      if (zSonEsitleme === null || Date.now() - zSonEsitleme > 5 * 60 * 1000) zamanEsitle();
    });
  }

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
  // 11 (25.08.2026): dökme kuru küspenin MALZEME devri artık silo
  //   devirlerinin toplamına kenetli (Şartname §5 KRİTİK). Eski veride bu
  //   iki rakam 2.000 kg ayrışmıştı: denetim izi silo devrini düzeltiyor,
  //   malzeme satırı eski değerinde kalıyordu. Aynı tazeleme, devir
  //   satırlarındaki eksik GuncelleyenKullaniciId alanını da doldurur —
  //   eski kayıtlarda "düzeltildi" yazıp kimin yaptığı görünmüyordu.
  var SEMA_SURUM = 11;
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

  /* Giriş kimliği e-posta (kullanıcı kararı, 26.08.2026): eski adlar rolü
     söylüyordu ("operator", "operator2"), kişiyi değil. Alan adı yer tutucudur
     — bkz. YU.ePosta. */
  var KULLANICI_TANIMI = [
    ["cenk.cogalmis@fabrika.com", "Cenk Sefer ÇOĞALMIŞ", "Yonetici"],
    ["ahmet.yilmaz@fabrika.com", "Ahmet Yılmaz", "Operator"],
    ["hatice.demir@fabrika.com", "Hatice Demir", "Operator"]
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
    /* Surum tazelemesinde kurtarilacak kampanya kilitleri (26.08.2026). */
    var tasinanKilitler = null;

    for (i = 0; i < TABLOLAR.length; i++) depo[TABLOLAR[i][1]] = [];

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
      var kusur = paketGecerliMi(veri);
      if (kusur) {
        /* Yalniz SURUM eskiyse veri atilir ama kullanicinin kilit karari
           saklanir; sifirla() bittikten sonra geri konur. Bozuk paketten
           hicbir sey tasinmaz. */
        if (kusur === "surum" && veri && Object.prototype.toString.call(veri.kampanyaKilitleri) === "[object Array]") {
          tasinanKilitler = veri.kampanyaKilitleri;
        }
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
        /* Günlük yedek klasörü (GUNLUK-YEDEK-PLANI, 27.08.2026): asıl kayıt
           bitti, yedekçi eşzamansız yazar — kaydet'i bekletmez, hatası
           kaydet'i etkilemez. */
        if (YU.yedekci) YU.yedekci.tetikle();
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
    /* Eski yedeği bugünkü şemaya taşır. Basamaklar ZİNCİRLENİR: 9'dan gelen
       paket önce 10 olur, sonra 11 basamağından da geçer. */
    function paketiDonustur(veri) {
      if (!veri || typeof veri !== "object") return null;
      var adimlar = [];
      if (veri.surum === 9) {
        veri.surum = 10;
        veri.sayaclar = {};
        adimlar.push("9 → 10 (Id sayaçları eklendi)");
      }
      /* 10 → 11 (25.08.2026): iki onarım birden.
         a) Dökme kuru küspenin MALZEME devri silo devirlerinin toplamına
            eşitlenir — eski pakette ikisi 2.000 kg ayrışmıştı (Şartname §5).
         b) Devir satırlarındaki eksik GuncelleyenKullaniciId denetim izinden
            geri doldurulur — "düzeltildi" yazıp kimin yaptığı görünmeyen
            satır kalmasın. */
      if (veri.surum === 10) {
        onarim11(veri);
        veri.surum = 11;
        adimlar.push("10 → 11 (dökme devri silo toplamına eşitlendi, eksik güncelleyen dolduruldu)");
      }
      return adimlar.length ? adimlar.join(" · ") : null;
    }

    /* 11. sürümün onarımı. Ham paket üzerinde çalışır: servis katmanı
       burada henüz yok, o yüzden hesap elle yapılır. */
    function onarim11(veri) {
      var i, j, r;
      var malzemeler = veri.malzemeler || [], devir = veri.devirStok || [];
      var siloDevir = veri.siloDevirStok || [], log = veri.degisiklikLog || [];

      /* a) dökme devri = aynı tarihli silo devirlerinin toplamı */
      var dokme = null;
      for (i = 0; i < malzemeler.length; i++) {
        if (malzemeler[i].OzelTip === "DokmeKuruKuspe") { dokme = malzemeler[i]; break; }
      }
      if (dokme) {
        var toplamlar = {};
        for (i = 0; i < siloDevir.length; i++) {
          r = siloDevir[i];
          toplamlar[r.DevirTarihi] = (toplamlar[r.DevirTarihi] || 0) + (Number(r.Miktar) || 0);
        }
        for (i = devir.length - 1; i >= 0; i--) {
          r = devir[i];
          if (r.MalzemeId !== dokme.Id) continue;
          if (toplamlar[r.DevirTarihi] === undefined) { devir.splice(i, 1); continue; }
          r.Miktar = YU.yuvarla(toplamlar[r.DevirTarihi]);
        }
      }

      /* b) eksik güncelleyen kullanıcıyı denetim izinden geri doldur */
      var tablolar = [["DevirStok", devir], ["SiloDevirStok", siloDevir]];
      for (i = 0; i < tablolar.length; i++) {
        var ad = tablolar[i][0], satirlar = tablolar[i][1];
        for (j = 0; j < satirlar.length; j++) {
          r = satirlar[j];
          if (!r.GuncellemeTarihi) continue;
          if (r.GuncelleyenKullaniciId !== undefined && r.GuncelleyenKullaniciId !== null) continue;
          var kim = null, k;
          for (k = log.length - 1; k >= 0; k--) {
            if (log[k].Tablo === ad && log[k].KayitId === r.Id && log[k].Islem === "Guncelle") {
              kim = log[k].KullaniciId; break;
            }
          }
          r.GuncelleyenKullaniciId = kim === undefined ? null : kim;
        }
      }
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
          (veri && veri.surum) + "); beklenen " + SEMA_SURUM + " (9 ve 10'dan dönüştürme yapılabilir)." };
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
      ePostaOnarimi(depo);   /* eski yedekteki rol adları e-postaya çevrilir */
      if (!depo.kaydet()) return { ok: false, hata: "Veri geri yüklendi ama diske yazılamadı." };
      return { ok: true, hata: null, ozet: ozet };
    };

    var kayitli = oku();
    if (kayitli) {
      tablolariDoldur(kayitli);
      depo.sayaclar = kayitli.sayaclar && typeof kayitli.sayaclar === "object" ? kayitli.sayaclar : {};
      if (ePostaOnarimi(depo)) depo.kaydet();
    } else {
      /* Sema surumu degisince tohum verisi tazelenir; ama KAMPANYA KILITLERI
         kullanicinin kendi karari, tohum verisi degil (kullanici bildirimi,
         26.08.2026: "en son birakildigi gibi olmali"). Tazelemeden sonra
         geri konur, boylece kilitledigi sezon acilmis gorunmez. */
      depo.sifirla();
      if (tasinanKilitler && tasinanKilitler.length) {
        depo.kampanyaKilitleri.length = 0;
        for (i = 0; i < tasinanKilitler.length; i++) depo.kampanyaKilitleri.push(tasinanKilitler[i]);
        tasinanKilitler = null;
        depo.kaydet();
      }
    }

    return depo;
  };
})();

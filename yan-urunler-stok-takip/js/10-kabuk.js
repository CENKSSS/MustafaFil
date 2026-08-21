/* Yan Ürünler Stok Takip — kabuk, yönlendirici, tema ve UI yardımcıları.
   SOZLESME.md §6 (imzalar), §7 (sayfa listesi), §8 (giriş ekranı).
   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu). */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});

  var SVGNS = 'http://www.w3.org/2000/svg';
  var XLINKNS = 'http://www.w3.org/1999/xlink';
  var GRUP_SIRA = ['Giriş', 'Takip', 'Yönetim'];
  /* Menüde görünen grup başlıkları (kullanıcı isteği, 21.08.2026). Sayfaların
     'grup' anahtarları (SOZLESME §6) değişmedi; yalnız görünen ad farklı. */
  var GRUP_BASLIK = { 'Giriş': 'Veri Girişi', 'Takip': 'Raporlar', 'Yönetim': 'Yönetim Paneli' };
  var MENU_USTU = 'anasayfa';           /* §7: ana sayfa gruplardan önce tek başına durur */
  var TEMA_ANAHTAR = 'yu.tema';
  var OTURUM_ANAHTAR = 'yu.oturum';
  var DONEM_ANAHTAR = 'yu.donem';

  /* Servis katmanı bir sorguda patlarsa kabuğun tamamı çökmesin; eksik veriyi
     sessizce yutmak yerine konsola yazıp güvenli varsayılana düşüyoruz. */
  function guvenli(fn, varsayilan) {
    try {
      var s = fn();
      return (s === undefined || s === null) ? varsayilan : s;
    } catch (e) {
      if (window.console) console.warn('[kabuk] hesaplanamadı:', e);
      return varsayilan;
    }
  }

  function dizi(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  /* ==================================================================
     1. Eleman üreticileri — YU.h / YU.svg / YU.bos
     ================================================================== */

  function cocukEkle(kok, c) {
    if (c === null || c === undefined || c === false || c === true) return;
    if (dizi(c)) { for (var i = 0; i < c.length; i++) cocukEkle(kok, c[i]); return; }
    if (c.nodeType) { kok.appendChild(c); return; }
    kok.appendChild(document.createTextNode(String(c)));
  }

  YU.h = function (etiket, ozellikler) {
    var el = document.createElement(etiket);
    var o = ozellikler || {}, k, v;
    /* tip önce yazılır: <input> için type, value'dan sonra atanırsa değer sıfırlanır. */
    if (o.tip !== undefined && o.tip !== null) el.setAttribute('type', o.tip);
    for (k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k) || k === 'tip') continue;
      v = o[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'sinif') el.className = v;
      else if (k === 'metin') el.textContent = String(v);
      else if (k === 'html') el.innerHTML = v;           /* yalnızca kabuk içi sabit işaretleme */
      else if (k === 'deger') el.value = v;
      else if (k === 'stil') { for (var s in v) if (Object.prototype.hasOwnProperty.call(v, s)) el.style[s] = v[s]; }
      else if (k === 'veri') { for (var d in v) if (Object.prototype.hasOwnProperty.call(v, d)) el.setAttribute('data-' + d, String(v[d])); }
      else if (/^on[A-Z]/.test(k) && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
    for (var i = 2; i < arguments.length; i++) cocukEkle(el, arguments[i]);
    return el;
  };

  YU.svg = function (ikonId, boyut) {
    var b = boyut || 15;
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('width', b);
    s.setAttribute('height', b);
    s.setAttribute('aria-hidden', 'true');
    s.style.flex = 'none';
    var id = String(ikonId || '');
    if (id.charAt(0) !== '#') id = '#' + id;
    var u = document.createElementNS(SVGNS, 'use');
    u.setAttribute('href', id);
    u.setAttributeNS(XLINKNS, 'xlink:href', id);
    s.appendChild(u);
    return s;
  };

  YU.bos = function (kap) {
    if (!kap) return kap;
    if (kap.replaceChildren) kap.replaceChildren();
    else while (kap.firstChild) kap.removeChild(kap.firstChild);
    return kap;
  };

  function svgOge(ad, ozellikler) {
    var el = document.createElementNS(SVGNS, ad);
    for (var k in ozellikler) {
      if (!Object.prototype.hasOwnProperty.call(ozellikler, k)) continue;
      var v = ozellikler[k];
      if (v === null || v === undefined) continue;
      el.setAttribute(k, String(v));
    }
    return el;
  }

  /* ==================================================================
     2. Tema
     ================================================================== */

  function yaz(anahtar, deger) { try { localStorage.setItem(anahtar, deger); } catch (e) { /* özel mod */ } }
  function oku(anahtar) { try { return localStorage.getItem(anahtar); } catch (e) { return null; } }
  function sil(anahtar) { try { localStorage.removeItem(anahtar); } catch (e) { /* yoksay */ } }

  YU.tema = {
    al: function () {
      var t = oku(TEMA_ANAHTAR);
      return (t === 'acik' || t === 'koyu') ? t : 'sistem';
    },
    /* Seçim 'sistem' ise işletim sistemi tercihine düşer. */
    etkin: function () {
      var t = YU.tema.al();
      if (t !== 'sistem') return t;
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'koyu' : 'acik';
    },
    ayarla: function (mod) {
      var kok = document.documentElement;
      if (mod === 'acik' || mod === 'koyu') { kok.setAttribute('data-tema', mod); yaz(TEMA_ANAHTAR, mod); }
      else { kok.removeAttribute('data-tema'); sil(TEMA_ANAHTAR); }
      temaDugmesiTazele();
      return YU.tema.al();
    },
    cevir: function () { return YU.tema.ayarla(YU.tema.etkin() === 'koyu' ? 'acik' : 'koyu'); }
  };

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var mqDinle = function () { if (YU.tema.al() === 'sistem') temaDugmesiTazele(); };
    if (mq.addEventListener) mq.addEventListener('change', mqDinle);
    else if (mq.addListener) mq.addListener(mqDinle);
  }

  /* Tema gözcüsü.
     Bazı koyu tema tarayıcı eklentileri ve tarayıcının kendi otomatik
     koyulaştırması, sayfa yüklendikten birkaç saniye sonra devreye girip
     data-tema özniteliğini düşürüyor. Öznitelik düşünce CSS
     html:not([data-tema="acik"]) dalına kayıyor ve ekran koyuya dönüyor;
     düğme etiketi ise temaDugmesiTazele() çağrılmadığı için "Açık" kalıyor.
     Öznitelik dışarıdan değişirse kullanıcının seçimini geri koyuyoruz.
     Geri koyma yeni bir mutasyon üretir ama koşul artık sağlanmadığı için
     döngü ikinci turda durur. */
  if (window.MutationObserver) {
    var temaGozcu = new MutationObserver(function () {
      var secim = YU.tema.al();
      if (secim === "sistem") return;
      if (document.documentElement.getAttribute("data-tema") !== secim) {
        document.documentElement.setAttribute("data-tema", secim);
        temaDugmesiTazele();
      }
    });
    temaGozcu.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
  }

  /* Ekran temayla uyuşmuyorsa sebebi ayırt eder. Konsoldan YU.temaTeshis().
     Amaç tahmin etmeden karar vermek: sorun uygulamada mı, dışarıda mı? */
  YU.temaTeshis = function () {
    var kok = document.documentElement;
    var g = getComputedStyle(kok), gb = getComputedStyle(document.body);
    var secim = YU.tema.al(), etkin = YU.tema.etkin();
    var beklenenZemin = etkin === "koyu" ? "#0b0d10" : "#fdfdfe";
    var olanZemin = g.getPropertyValue("--zemin").trim();
    var yabanci = [], i, ss;
    for (i = 0; i < document.styleSheets.length; i++) {
      ss = document.styleSheets[i];
      if (ss.href && ss.href.indexOf(location.origin) !== 0) yabanci.push(ss.href);
      else if (!ss.href && !(ss.ownerNode && ss.ownerNode.tagName === "STYLE" && ss.ownerNode.textContent.indexOf("yu-") > -1)) {
        yabanci.push("sayfaya sonradan eklenmiş <style>");
      }
    }
    var karar;
    if (kok.getAttribute("data-tema") !== (secim === "sistem" ? null : secim)) {
      karar = "data-tema ozniteligi disaridan degistirilmis.";
    } else if (olanZemin !== beklenenZemin) {
      karar = "CSS degiskenleri disaridan ezilmis — sayfa disi bir stil kaynagi var (koyu tema eklentisi).";
    } else if (g.filter !== "none" || gb.filter !== "none") {
      karar = "Sayfaya filtre uygulanmis (eklenti ya da tarayicinin otomatik koyulastirmasi).";
    } else if (yabanci.length) {
      karar = "Uygulama degerleri dogru ama sayfada yabanci stil kaynagi var; ekran yine de koyu ise sebep odur.";
    } else {
      karar = "Uygulama tarafinda sorun yok: secim, oznitelik, degiskenler ve zemin tutarli.";
    }
    var rapor = {
      karar: karar,
      secim: secim,
      etkinTema: etkin,
      oznitelik: kok.getAttribute("data-tema"),
      beklenenZemin: beklenenZemin,
      olanZemin: olanZemin,
      govdeZemini: gb.backgroundColor,
      colorScheme: g.colorScheme,
      htmlFiltre: g.filter,
      govdeFiltre: gb.filter,
      stilSayfasiSayisi: document.styleSheets.length,
      yabanciStiller: yabanci,
      isletimSistemiKoyu: !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
    };
    if (window.console && console.table) { console.log(karar); console.table(rapor); }
    return rapor;
  };

  function temaAdi() {
    var t = YU.tema.al();
    return t === 'acik' ? 'Açık' : (t === 'koyu' ? 'Koyu' : 'Sistem');
  }

  /* ==================================================================
     3. Oturum ve rol
     ================================================================== */

  YU.oturum = { kullanici: null };

  YU.rol = function () { return YU.oturum.kullanici ? YU.oturum.kullanici.Rol : null; };
  YU.yonetici = function () { return YU.rol() === 'Yonetici'; };

  function kullaniciBul(kullaniciAdi) {
    var liste = (YU.db && YU.db.kullanicilar) || [];
    for (var i = 0; i < liste.length; i++) if (liste[i].KullaniciAdi === kullaniciAdi) return liste[i];
    return null;
  }

  function rolIle(rol) {
    var liste = (YU.db && YU.db.kullanicilar) || [];
    for (var i = 0; i < liste.length; i++) if (liste[i].Rol === rol && liste[i].Aktif !== false) return liste[i];
    return null;
  }

  /* Oturumda satırın tamamı değil kullanıcı adı saklanır: rol depoda değişirse
     bir sonraki açılışta güncel rol okunur, eskimiş kopya yetki vermez. */
  YU.oturumAc = function (kullanici) {
    if (!kullanici) return;
    YU.oturum.kullanici = kullanici;
    yaz(OTURUM_ANAHTAR, JSON.stringify({ KullaniciAdi: kullanici.KullaniciAdi }));
  };

  /* Parola olmadığı için "oturumu kapat" ve "rol değiştir" aynı yere çıkar:
     kayıtlı oturum silinir, seçim perdesine dönülür (SOZLESME §8). */
  YU.oturumKapat = function () {
    YU.oturum.kullanici = null;
    sil(OTURUM_ANAHTAR);
    YU.girisGoster();
  };

  YU.oturumYukle = function () {
    var ham = oku(OTURUM_ANAHTAR);
    if (!ham) return null;
    var k = null;
    try { k = JSON.parse(ham); } catch (e) { k = null; }
    var satir = k && k.KullaniciAdi ? kullaniciBul(k.KullaniciAdi) : null;
    if (satir && satir.Aktif !== false) { YU.oturum.kullanici = satir; return satir; }
    sil(OTURUM_ANAHTAR);
    return null;
  };

  function rolMetni(rol) { return rol === 'Yonetici' ? 'Yönetici' : (rol === 'Operator' ? 'Operatör' : '—'); }

  function basHarfler(ad) {
    var p = String(ad || '').trim().split(/\s+/);
    var h = (p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '');
    return h.toLocaleUpperCase('tr');
  }

  /* ==================================================================
     4. Sayfa kaydı
     ================================================================== */

  YU.sayfalar = {};
  var sayfaSirasi = [];

  YU.sayfaTanimla = function (tanim) {
    if (!tanim || !tanim.kod) throw new Error('YU.sayfaTanimla: kod zorunlu.');
    if (!YU.sayfalar[tanim.kod]) sayfaSirasi.push(tanim.kod);
    YU.sayfalar[tanim.kod] = tanim;
    return tanim;
  };

  function sayfaListesi() {
    var l = [];
    for (var i = 0; i < sayfaSirasi.length; i++) l.push(YU.sayfalar[sayfaSirasi[i]]);
    return l;
  }

  function gorunur(tanim) {
    return !!tanim && (tanim.rol !== 'Yonetici' || YU.yonetici());
  }

  /* ==================================================================
     5. Yönlendirme  #/kod?anahtar=deger
     ================================================================== */

  var aktif = { kod: null, param: {} };

  function hashCoz() {
    var h = location.hash || '';
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.charAt(0) === '/') h = h.slice(1);
    var i = h.indexOf('?');
    var kod = i < 0 ? h : h.slice(0, i);
    var qs = i < 0 ? '' : h.slice(i + 1);
    var param = {};
    if (qs) {
      var parcalar = qs.split('&');
      for (var j = 0; j < parcalar.length; j++) {
        if (!parcalar[j]) continue;
        var e = parcalar[j].indexOf('=');
        var a = e < 0 ? parcalar[j] : parcalar[j].slice(0, e);
        var d = e < 0 ? '' : parcalar[j].slice(e + 1);
        try { param[decodeURIComponent(a)] = decodeURIComponent(d.replace(/\+/g, ' ')); }
        catch (x) { param[a] = d; }
      }
    }
    return { kod: decodeURIComponent(kod || ''), param: param };
  }

  function hashKur(kod, param) {
    var h = '#/' + encodeURIComponent(kod || MENU_USTU);
    var p = [];
    if (param) for (var k in param) {
      if (!Object.prototype.hasOwnProperty.call(param, k)) continue;
      var v = param[k];
      if (v === null || v === undefined || v === '') continue;
      p.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    }
    return p.length ? h + '?' + p.join('&') : h;
  }

  YU.git = function (kod, param) {
    var yeni = hashKur(kod, param);
    popupKapat();
    if (location.hash === yeni) YU.yenile();
    else location.hash = yeni;
  };

  YU.param = function () { return aktif.param || {}; };

  YU.yenile = function () { ciz(); };

  window.addEventListener('hashchange', function () { ciz(); });

  /* ==================================================================
     6. Dönem / kampanya
     Kampanya eylülde başlar (Şartname §2). Devir tarihinin ayı 7 ve sonrası ise
     kampanya o yıl açılmıştır; öncesindeyse bir önceki yılın kampanyasıdır.
     ================================================================== */

  function kampanyaAdi(iso) {
    var y = parseInt(String(iso).slice(0, 4), 10);
    var a = parseInt(String(iso).slice(5, 7), 10);
    if (!y) return 'Kampanya';
    return a >= 7 ? (y + '/' + (y + 1)) : ((y - 1) + '/' + y);
  }

  /* Kayıt bulunan günler — iş kuralı değil, düz tarih toplama. */
  function kayitTarihleri() {
    var db = YU.db, s = {}, i;
    if (!db) return [];
    var a = db.kuruKuspeGunluk || [];
    for (i = 0; i < a.length; i++) if (a[i] && a[i].Tarih) s[a[i].Tarih] = 1;
    var b = db.gunlukHareket || [];
    for (i = 0; i < b.length; i++) if (b[i] && b[i].Tarih) s[b[i].Tarih] = 1;
    var l = [];
    for (var t in s) if (Object.prototype.hasOwnProperty.call(s, t)) l.push(t);
    l.sort();
    return l;
  }

  function donemListesi() {
    var db = YU.db;
    if (!db) return [];
    var tarihler = {}, i;
    var d1 = db.devirStok || [];
    for (i = 0; i < d1.length; i++) if (d1[i] && d1[i].DevirTarihi) tarihler[d1[i].DevirTarihi] = 1;
    var d2 = db.siloDevirStok || [];
    for (i = 0; i < d2.length; i++) if (d2[i] && d2[i].DevirTarihi) tarihler[d2[i].DevirTarihi] = 1;
    var liste = [];
    for (var t in tarihler) if (Object.prototype.hasOwnProperty.call(tarihler, t)) liste.push(t);
    liste.sort();
    if (!liste.length) return [];

    var gruplar = [];
    for (i = 0; i < liste.length; i++) {
      var ad = kampanyaAdi(liste[i]);
      var son = gruplar.length ? gruplar[gruplar.length - 1] : null;
      if (son && son.ad === ad) { if (liste[i] < son.bas) son.bas = liste[i]; }
      else gruplar.push({ ad: ad, bas: liste[i] });
    }

    var kayitlar = kayitTarihleri();
    for (i = 0; i < gruplar.length; i++) {
      var sinir = (i + 1 < gruplar.length) ? gruplar[i + 1].bas : null;
      var bit = gruplar[i].bas, sayac = 0;
      for (var j = 0; j < kayitlar.length; j++) {
        if (kayitlar[j] < gruplar[i].bas) continue;
        if (sinir && kayitlar[j] >= sinir) break;
        bit = kayitlar[j];
        sayac++;
      }
      gruplar[i].bit = bit;
      gruplar[i].kayitliGun = sayac;
    }
    return gruplar;
  }

  var donemOnbellek = null;

  function donemler() {
    if (!donemOnbellek) donemOnbellek = donemListesi();
    return donemOnbellek;
  }

  function donemAktif() {
    var l = donemler();
    if (!l.length) return null;
    var secili = oku(DONEM_ANAHTAR);
    for (var i = 0; i < l.length; i++) if (l[i].ad === secili) return l[i];
    return l[l.length - 1];
  }

  YU.donem = {
    liste: function () { return donemler(); },
    aktif: function () { return donemAktif(); },
    ayarla: function (ad) {
      var l = donemler();
      for (var i = 0; i < l.length; i++) if (l[i].ad === ad) { yaz(DONEM_ANAHTAR, ad); break; }
      donemBaslikTazele();
      YU.yenile();
      return donemAktif();
    },
    tazele: function () { donemOnbellek = null; donemBaslikTazele(); }
  };

  /* ==================================================================
     7. Uyarılar (bildirim zili)
     ================================================================== */

  YU.uyarilar = function () {
    var db = YU.db;
    if (!db) return [];
    var u = [], i;
    var bugun = YU.tarih.bugun();

    /* Ana sayfadaki durum şeritleri buraya taşındı (kullanıcı isteği,
       21.08.2026): uyarı, koşul düzelmeden listeden düşmez. */
    var bugunKayitli = false, kayitlar = kayitTarihleri();
    for (i = 0; i < kayitlar.length; i++) if (kayitlar[i] === bugun) { bugunKayitli = true; break; }
    if (!bugunKayitli) {
      u.push({
        tur: 'bekleyen', ikon: '#ic-plus',
        baslik: 'Bugünün Girişi Yok',
        metin: 'Bugün (' + YU.fmt.tarih(bugun) + ') için henüz kayıt girilmemiş.',
        git: function () { YU.git('kuru-kuspe', { tarih: bugun }); }
      });
    }

    var donem = donemAktif();
    if (donem && (bugun < donem.bas || bugun > donem.bit)) {
      u.push({
        tur: 'notr', ikon: '#ic-doc',
        baslik: 'Kampanya Aralığının Dışındasınız',
        metin: 'Kampanya ' + donem.ad + ' kayıtları ' + YU.fmt.tarih(donem.bas) + ' – ' +
          YU.fmt.tarih(donem.bit) + ' aralığında.',
        git: function () { YU.git('gunluk-rapor', { tarih: donem.bit }); }
      });
    }

    var negatifler = guvenli(function () { return YU.stok.negatifGunler(db); }, []);
    for (i = 0; i < negatifler.length && i < 8; i++) {
      var n = negatifler[i];
      u.push({
        tur: 'olumsuz',
        ikon: '#ic-building',
        baslik: (n.siloAd || ('Silo ' + n.siloId)) + ' · ' + YU.fmt.tarih(n.tarih),
        metin: 'Bakiye negatife düşüyor: ' + YU.fmt.kgU(n.bakiye),
        git: function () { YU.git('silo-durumu'); }
      });
    }

    var silolar = guvenli(function () { return YU.stok.tumSilolar(db); }, []);
    for (i = 0; i < silolar.length; i++) {
      var s = silolar[i];
      if (!s || !s.silo || !s.kapasite) continue;
      if (s.mevcut > s.kapasite) {
        u.push({
          tur: 'olumsuz', ikon: '#ic-building',
          baslik: s.silo.Ad + ' · Kapasite Aşıldı',
          metin: YU.fmt.kgU(s.mevcut) + ' / ' + YU.fmt.kgU(s.kapasite) + ' · ' + YU.fmt.yuzde((s.doluluk || 0) * 100),
          git: function () { YU.git('silo-durumu'); }
        });
      } else if ((s.doluluk || 0) >= 0.9) {
        u.push({
          tur: 'bekleyen', ikon: '#ic-building',
          baslik: s.silo.Ad + ' · doluluk ' + YU.fmt.yuzde((s.doluluk || 0) * 100),
          metin: 'Kapasiteye yaklaşıldı (D15).',
          git: function () { YU.git('silo-durumu'); }
        });
      }
    }

    var eksikler = eksikGunler();
    for (i = 0; i < eksikler.length && i < 5; i++) {
      (function (t) {
        u.push({
          tur: 'bekleyen', ikon: '#ic-calendar',
          baslik: YU.fmt.tarih(t) + ' · Kayıt Yok',
          metin: 'Kampanya aralığında girişi yapılmamış gün.',
          git: function () { YU.git('kuru-kuspe', { tarih: t }); }
        });
      })(eksikler[i]);
    }
    if (eksikler.length > 5) {
      u.push({
        tur: 'notr', ikon: '#ic-calendar',
        baslik: (eksikler.length - 5) + ' Gün Daha Kayıtsız',
        metin: 'Tümü Geçmiş Girişler ekranında listelenir.',
        git: function () { YU.git('gecmis-girisler'); }
      });
    }
    return u;
  };

  /* Aktif kampanya aralığında hiç kaydı olmayan günler. */
  function eksikGunler() {
    var d = donemAktif();
    if (!d) return [];
    var var_ = {}, kayitlar = kayitTarihleri(), i;
    for (i = 0; i < kayitlar.length; i++) var_[kayitlar[i]] = 1;
    var eksik = [], t = d.bas, guvenlik = 0;
    while (t <= d.bit && guvenlik < 500) {
      if (!var_[t]) eksik.push(t);
      t = YU.tarih.ekle(t, 1);
      guvenlik++;
    }
    return eksik;
  }

  /* ==================================================================
     8. Açılır paneller (arama / zil / kullanıcı / dönem)
     ================================================================== */

  var acikPopup = null;

  function popupKapat() {
    if (!acikPopup) return;
    if (acikPopup.kok.parentNode) acikPopup.kok.parentNode.removeChild(acikPopup.kok);
    acikPopup = null;
  }

  /* Kenar çubuğu kendi içinde kaydığı için (overflow) tetiğe göreli açılan
     kutu orada kırpılıyordu. sabit=true ile kutu gövdeye taşınır ve tetiğin
     ekrandaki yerine göre konumlanır; görünür alanın dışına taşmaz. */
  function popupAc(tetik, kok, sabit) {
    popupKapat();
    if (sabit) {
      document.body.appendChild(kok);
      kok.style.position = 'fixed';
      kok.style.zIndex = '80';
      kok.style.right = 'auto';
      var r = tetik.getBoundingClientRect();
      var pay = 10;
      var ekranG = document.documentElement.clientWidth;
      var ekranY = document.documentElement.clientHeight;
      var sol = r.left;
      if (sol + kok.offsetWidth > ekranG - pay) sol = ekranG - pay - kok.offsetWidth;
      if (sol < pay) sol = pay;
      var ust = r.bottom + 8;
      if (ust + kok.offsetHeight > ekranY - pay) ust = Math.max(pay, r.top - 8 - kok.offsetHeight);
      kok.style.left = Math.round(sol) + 'px';
      kok.style.top = Math.round(ust) + 'px';
    } else {
      tetik.style.position = 'relative';
      tetik.appendChild(kok);
    }
    acikPopup = { kok: kok, tetik: tetik, sabit: !!sabit };
  }

  document.addEventListener('mousedown', function (e) {
    if (!acikPopup) return;
    if (acikPopup.kok.contains(e.target) || acikPopup.tetik.contains(e.target)) return;
    popupKapat();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (acikPopup) popupKapat();
    ipucuGizle();
  });

  function popupKutu(genislik, hiza) {
    var el = YU.h('div', {
      sinif: 'yu-panel',
      stil: {
        position: 'absolute', top: 'calc(100% + 8px)', zIndex: '60',
        width: (genislik || 300) + 'px', maxHeight: '380px', overflowY: 'auto',
        padding: '6px', background: 'var(--yuzey)', borderColor: 'var(--kenar-3)',
        boxShadow: 'var(--golge-2)'
      }
    });
    if (hiza === 'sag') el.style.right = '0'; else el.style.left = '0';
    return el;
  }

  function popupBaslik(metin) {
    return YU.h('div', {
      metin: metin,
      stil: {
        font: '500 12.5px/1 var(--font)', letterSpacing: '.06em', textTransform: 'uppercase',
        color: 'var(--metin-5)', padding: '9px 10px 6px'
      }
    });
  }

  function popupSatir(ikon, baslik, altMetin, onClick, renk) {
    var ikonKap = YU.h('div', {
      stil: {
        width: '24px', height: '24px', borderRadius: '7px', flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: renk ? 'var(--' + renk + '-zemin)' : 'var(--yuzey-3)',
        color: renk ? 'var(--' + renk + ')' : 'var(--metin-3)'
      }
    }, YU.svg(ikon || '#ic-dots', 13));
    var govde = YU.h('div', { stil: { flex: '1', minWidth: '0' } },
      YU.h('div', { metin: baslik, stil: { font: '400 14.5px/1.35 var(--font)', color: 'var(--metin-2)' } }),
      altMetin ? YU.h('div', { metin: altMetin, stil: { font: '400 13px/1.4 var(--font)', color: 'var(--metin-4)', marginTop: '2px' } }) : null
    );
    var satir = YU.h('div', {
      role: 'button', tabindex: '0',
      stil: { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer' },
      onClick: function () { popupKapat(); if (onClick) onClick(); },
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); popupKapat(); if (onClick) onClick(); } },
      onMouseEnter: function () { satir.style.background = 'var(--yuzey-3)'; },
      onMouseLeave: function () { satir.style.background = 'transparent'; }
    }, ikonKap, govde);
    return satir;
  }

  function popupBos(metin) {
    return YU.h('div', {
      metin: metin,
      stil: { padding: '16px 12px', font: '400 14px/1.5 var(--font)', color: 'var(--metin-4)', textAlign: 'center' }
    });
  }

  /* ==================================================================
     9. Kabuk — kenar çubuğu ve üst şerit
     ================================================================== */

  var kabukKurulu = false;
  var dom = {};

  function kok() { return document.getElementById('yu-kok'); }

  /* Kenar çubuğundaki marka bloğu ana sayfa bağlantısıdır; giriş perdesinde
     oturum da gidilecek sayfa da olmadığı için orada tıklanabilir değildir. */
  /* logolu: kenar çubuğu varyantı — üstte dikey kurum logosu, altında ad.
     Giriş perdesi eski harf karesini kullanmaya devam eder. */
  function markaBlogu(tiklanabilir, logolu) {
    /* Koyu temada logodaki "DOĞUŞ AFYON" yazısı koyu olduğu için zemine
       karışıyordu. İkinci dosyada yalnız o yazı beyaza çevrildi; hangisinin
       görüneceğine CSS karar veriyor, JS tema dinlemiyor. */
    var isaret = logolu
      ? [
          YU.h('img', {
            sinif: 'yu-marka-logo acik', src: 'LOGO.png', alt: 'Doğuş Afyon',
            width: '1024', height: '1536', draggable: 'false'
          }),
          YU.h('img', {
            sinif: 'yu-marka-logo koyu', src: 'LOGO-koyu.png', alt: '',
            'aria-hidden': 'true', width: '1024', height: '1536', draggable: 'false'
          })
        ]
      : YU.h('div', { sinif: 'yu-marka-kare', metin: 'Y' });
    var kokEl = YU.h('div', { sinif: logolu ? 'yu-marka logolu' : 'yu-marka' },
      isaret,
      YU.h('div', { sinif: 'yu-marka-ad', metin: 'Yan Ürünler Takip' })
    );
    if (!tiklanabilir) return kokEl;

    kokEl.setAttribute('role', 'button');
    kokEl.setAttribute('tabindex', '0');
    kokEl.setAttribute('title', 'Ana Sayfa');
    kokEl.style.cursor = 'pointer';
    /* Logolu varyant kenara sıfır oturuyor; satır içi yarıçap CSS'i ezip
       köşeleri yuvarlatırdı. */
    if (!logolu) kokEl.style.borderRadius = 'var(--r)';
    kokEl.style.transition = 'background .15s ease';

    function anaSayfa() { YU.git(MENU_USTU); }
    function zeminAc() { kokEl.style.background = 'var(--yuzey-4)'; }
    function zeminKapa() { kokEl.style.background = 'transparent'; }

    kokEl.addEventListener('click', anaSayfa);
    /* Orta tuş (tekerlek tıklaması) tarayıcı geleneğine uyar: Ana Sayfa
       YENİ sekmede açılır. mousedown'daki preventDefault otomatik kaydırma
       imlecini engeller. */
    kokEl.addEventListener('auxclick', function (e) {
      if (e.button === 1) {
        e.preventDefault();
        window.open(location.href.split('#')[0] + '#/' + MENU_USTU, '_blank');
      }
    });
    kokEl.addEventListener('mousedown', function (e) {
      if (e.button === 1) e.preventDefault();
    });
    kokEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); anaSayfa(); }
    });
    kokEl.addEventListener('mouseenter', zeminAc);
    kokEl.addEventListener('mouseleave', zeminKapa);
    kokEl.addEventListener('focus', zeminAc);
    kokEl.addEventListener('blur', zeminKapa);
    return kokEl;
  }

  function seciciKutusu() {
    var ad = YU.h('div', { stil: { font: '400 14.5px/1 var(--font)', color: 'var(--metin-2)', flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } });
    var kutu = YU.h('div', {
      sinif: 'yu-secici', role: 'button', tabindex: '0',
      title: 'Kampanya dönemi seç',
      onClick: function () { donemPaneliAc(kutu); },
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); donemPaneliAc(kutu); } }
    },
      YU.svg('#ic-building', 15),
      ad,
      YU.h('span', { sinif: 'yu-secici-ok' }, YU.svg('#ic-chevron', 13))
    );
    dom.seciciAd = ad;
    return kutu;
  }

  function donemPaneliAc(tetik) {
    if (acikPopup && acikPopup.tetik === tetik) { popupKapat(); return; }
    var kutu = popupKutu(268);
    kutu.appendChild(popupBaslik('Kampanya dönemi'));
    var l = donemler();
    if (!l.length) {
      kutu.appendChild(popupBos('Devir stok girilmediği için kampanya dönemi oluşmadı.'));
      if (YU.yonetici()) kutu.appendChild(popupSatir('#ic-wallet', 'Devir Stok Ekranını Aç', 'Kampanya başı açılış stoğu girilir.', function () { YU.git('devir-stok'); }, 'vurgu'));
    } else {
      var s = donemAktif();
      for (var i = l.length - 1; i >= 0; i--) {
        (function (d) {
          kutu.appendChild(popupSatir(
            '#ic-calendar',
            'Kampanya ' + d.ad + (s && s.ad === d.ad ? '  ✓' : ''),
            YU.fmt.tarih(d.bas) + ' – ' + YU.fmt.tarih(d.bit) + ' · ' + YU.fmt.sayi(d.kayitliGun) + ' gün kayıtlı',
            function () { YU.donem.ayarla(d.ad); },
            s && s.ad === d.ad ? 'vurgu' : null
          ));
        })(l[i]);
      }
    }
    popupAc(tetik, kutu, true);
  }

  function menuOgesi(tanim) {
    var a = YU.h('a', {
      sinif: 'yu-menu-oge',
      href: hashKur(tanim.kod),
      title: tanim.baslik,
      stil: { textDecoration: 'none' },
      veri: { kod: tanim.kod }
    }, YU.svg(tanim.ikon || '#ic-dots', 17), YU.h('span', { metin: tanim.baslik }));
    return a;
  }

  /* Rapor merkezi — menüdeki "Raporlar" başlığına tıklayınca ortada açılan
     pencere: üç büyük kart (Stok Durumu, Silo Durumu, Günlük Rapor). Kartta
     üstte ad, altında büyük ikon; üzerine gelince vurgu zemin. Tam ekran
     denendi, pencereye dönüldü — bir tık büyüğü (kullanıcı isteği, 21.08.2026). */
  var RAPOR_MERKEZI = [
    { kod: 'stok-durumu', ad: 'Stok Durumu Raporu', ikon: '#ic-chart' },
    { kod: 'silo-durumu', ad: 'Silo Durumu Raporu', ikon: '#ic-building' },
    { kod: 'gunluk-rapor', ad: 'Günlük Rapor', ikon: '#ic-doc' }
  ];

  function raporMerkeziAc() {
    var m;
    var izgara = YU.h('div', {
      stil: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }
    });

    for (var i = 0; i < RAPOR_MERKEZI.length; i++) {
      (function (r) {
        var ikonKap;
        function git() { m.kapat(); YU.git(r.kod); }
        var kart = YU.h('div', {
          role: 'button', tabindex: '0', title: r.ad,
          stil: {
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '28px', padding: '51px 18px 44px',
            border: '1px solid var(--kenar-2)', borderRadius: 'var(--r-l)',
            background: 'var(--yuzey)', cursor: 'pointer', textAlign: 'center',
            transition: 'background-color .12s, border-color .12s'
          },
          onClick: git,
          onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); git(); } },
          onMouseEnter: function () {
            kart.style.background = 'var(--vurgu-zemin)';
            kart.style.borderColor = 'var(--vurgu)';
            ikonKap.style.color = 'var(--vurgu)';
          },
          onMouseLeave: function () {
            kart.style.background = 'var(--yuzey)';
            kart.style.borderColor = 'var(--kenar-2)';
            ikonKap.style.color = 'var(--metin-2)';
          }
        });
        kart.appendChild(YU.h('div', {
          metin: r.ad,
          stil: { font: '600 19px/1.2 var(--font)', letterSpacing: '-.01em', color: 'var(--metin)' }
        }));
        ikonKap = YU.h('div', {
          stil: { color: 'var(--metin-2)', display: 'flex', transition: 'color .12s' }
        }, YU.svg(r.ikon, 71));
        kart.appendChild(ikonKap);
        izgara.appendChild(kart);
      })(RAPOR_MERKEZI[i]);
    }

    /* Başlık sol şerit yerine gövdenin üstünde ORTALANIR (kullanıcı isteği,
       21.08.2026); modalın kendi başlık şeridi bu yüzden kullanılmıyor. */
    m = YU.ui.modal({
      genislik: 828,   /* 720'nin %15 büyüğü (kullanıcı isteği, 21.08.2026) */
      govde: [
        YU.h('div', {
          metin: 'Raporlar',
          stil: {
            font: '600 20px/1.2 var(--font)', letterSpacing: '-.012em',
            color: 'var(--metin)', textAlign: 'center', padding: '8px 0 2px'
          }
        }),
        izgara
      ],
      dugmeler: [{ metin: 'Kapat', tur: 'sade', onClick: function () { m.kapat(); } }]
    });
  }

  function menuKur() {
    var menu = YU.h('div', { sinif: 'yu-menu' });
    var ust = YU.sayfalar[MENU_USTU];
    if (ust && gorunur(ust)) menu.appendChild(menuOgesi(ust));

    var liste = sayfaListesi();
    for (var g = 0; g < GRUP_SIRA.length; g++) {
      var grupAdi = GRUP_SIRA[g];
      var ogeler = [];
      for (var i = 0; i < liste.length; i++) {
        var t = liste[i];
        if (!t || t.kod === MENU_USTU || t.grup !== grupAdi) continue;
        if (!gorunur(t)) continue;          /* Yönetici sayfaları operatöre gösterilmez */
        ogeler.push(menuOgesi(t));
      }
      if (!ogeler.length) continue;
      var grupBas;
      if (grupAdi === 'Takip') {
        /* "Raporlar" başlığı tıklanır: rapor merkezi açılır. */
        grupBas = YU.h('div', {
          sinif: 'yu-menu-grup-bas', metin: GRUP_BASLIK[grupAdi] || grupAdi,
          role: 'button', tabindex: '0', title: 'Rapor Merkezini Aç',
          stil: { cursor: 'pointer' },
          onClick: raporMerkeziAc,
          onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); raporMerkeziAc(); } }
        });
      } else {
        grupBas = YU.h('div', { sinif: 'yu-menu-grup-bas', metin: GRUP_BASLIK[grupAdi] || grupAdi });
      }
      menu.appendChild(YU.h('div', { sinif: 'yu-menu-grup' }, grupBas, ogeler));
    }
    return menu;
  }

  /* ------------------------------------------------------------------
     Kenar çubuğunu daraltma
     ------------------------------------------------------------------
     Daraltılmış hâl 900px altındaki ikon rayının aynısıdır (artboard 1b
     dili): etiketler gizlenir, ikonlar kalır. Tercih tarayıcıda saklanır,
     ekran değişince kaybolmaz. */

  var DARALT_ANAHTAR = 'yu.yan.daralt';

  function yanDaralikMi() { return oku(DARALT_ANAHTAR) === '1'; }

  function yanDaraltUygula(daralt) {
    var kabuk = dom.kabuk;
    if (!kabuk) return;
    kabuk.className = daralt ? 'yu-kabuk daralt' : 'yu-kabuk';
    if (dom.daraltDugmesi) {
      var ad = daralt ? 'Paneli Genişlet' : 'Paneli Daralt';
      dom.daraltDugmesi.setAttribute('title', ad);
      dom.daraltDugmesi.setAttribute('aria-label', ad);
      dom.daraltDugmesi.setAttribute('aria-expanded', daralt ? 'false' : 'true');
    }
  }

  function daraltDugmesi() {
    var d = YU.h('button', {
      tip: 'button', sinif: 'yu-yan-daralt',
      onClick: function () {
        var yeni = !yanDaralikMi();
        if (yeni) yaz(DARALT_ANAHTAR, '1'); else sil(DARALT_ANAHTAR);
        yanDaraltUygula(yeni);
      }
    }, YU.svg('#ic-chevron', 14));
    dom.daraltDugmesi = d;
    return YU.h('div', { sinif: 'yu-yan-daralt-satir' }, d);
  }

  function donemBaslikTazele() {
    var d = donemAktif();
    if (dom.seciciAd) dom.seciciAd.textContent = d ? ('Kampanya ' + d.ad) : 'Kampanya yok';
    if (dom.cipMetin) dom.cipMetin.textContent = d ? (YU.fmt.tarih(d.bas) + ' – ' + YU.fmt.tarih(d.bit)) : YU.fmt.tarih(YU.tarih.bugun());
  }

  /* --- arama --- */

  function aramaKutusu() {
    var girdi = YU.h('input', {
      tip: 'text', placeholder: 'Malzeme, silo veya tarih ara…', autocomplete: 'off',
      stil: { flex: '1', minWidth: '0', border: 'none', outline: 'none', background: 'transparent', color: 'var(--metin)', font: '400 14.5px/1 var(--font)' },
      onInput: function () { aramaPaneliAc(kutu, girdi.value); },
      onFocus: function () { if (girdi.value) aramaPaneliAc(kutu, girdi.value); },
      onKeyDown: function (e) {
        if (e.key === 'Escape') { girdi.value = ''; popupKapat(); girdi.blur(); }
        else if (e.key === 'Enter') {
          var s = aramaSonuclari(girdi.value);
          if (s.length) { popupKapat(); girdi.value = ''; s[0].git(); }
        }
      }
    });
    var kutu = YU.h('div', { sinif: 'yu-ara' }, YU.svg('#ic-search', 15), girdi);
    dom.aramaGirdi = girdi;
    return kutu;
  }

  function tarihCoz(q) {
    var m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(q);
    if (m) {
      var g = ('0' + m[1]).slice(-2), a = ('0' + m[2]).slice(-2);
      if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return m[3] + '-' + a + '-' + g;
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    return null;
  }

  function aramaSonuclari(ham) {
    var q = String(ham || '').trim();
    if (q.length < 2) return [];
    var db = YU.db;
    if (!db) return [];
    var kucuk = q.toLocaleLowerCase('tr');
    var sonuc = [], i;

    /* Tam tarih yazıldıysa doğrudan o günün raporu önerilir. */
    var iso = tarihCoz(q);
    if (iso) {
      sonuc.push({
        ikon: '#ic-doc', baslik: YU.fmt.tarih(iso) + ' · Günlük Rapor',
        alt: YU.fmt.tarihUzun(iso) + ' · ' + YU.fmt.gunAdi(iso),
        git: function () { YU.git('gunluk-rapor', { tarih: iso }); }
      });
      sonuc.push({
        ikon: '#ic-plus', baslik: YU.fmt.tarih(iso) + ' · Kuru Küspe Günlük Giriş',
        alt: 'Bu günün girişini aç', git: function () { YU.git('kuru-kuspe', { tarih: iso }); }
      });
    } else if (/\d/.test(q)) {
      var kayitlar = kayitTarihleri(), bulunan = 0;
      for (i = 0; i < kayitlar.length && bulunan < 4; i++) {
        var t = kayitlar[i];
        if (YU.fmt.tarih(t).indexOf(q) === 0 || t.indexOf(q) === 0) {
          bulunan++;
          (function (tar) {
            sonuc.push({
              ikon: '#ic-calendar', baslik: YU.fmt.tarih(tar), alt: 'Kayıtlı gün · Günlük Rapor',
              git: function () { YU.git('gunluk-rapor', { tarih: tar }); }
            });
          })(t);
        }
      }
    }

    var malzemeler = db.malzemeler || [];
    for (i = 0; i < malzemeler.length; i++) {
      var m = malzemeler[i];
      if (!m || String(m.Ad).toLocaleLowerCase('tr').indexOf(kucuk) < 0) continue;
      (function (mz) {
        sonuc.push({
          ikon: '#ic-chart', baslik: mz.Ad,
          alt: 'Malzeme · Stok Durumu' + (mz.Aktif === false ? ' (pasif)' : ''),
          git: function () { YU.git('stok-durumu', { malzeme: mz.Id }); }
        });
      })(m);
    }

    var silolar = db.silolar || [];
    for (i = 0; i < silolar.length; i++) {
      var s = silolar[i];
      if (!s || String(s.Ad).toLocaleLowerCase('tr').indexOf(kucuk) < 0) continue;
      (function (si) {
        sonuc.push({
          ikon: '#ic-building', baslik: si.Ad,
          alt: 'Silo · Silo Durumu · kapasite ' + YU.fmt.ton(si.Kapasite),
          git: function () { YU.git('silo-durumu', { silo: si.Id }); }
        });
      })(s);
    }

    var sayfalar = sayfaListesi();
    for (i = 0; i < sayfalar.length; i++) {
      var p = sayfalar[i];
      if (!p || !gorunur(p)) continue;
      if (String(p.baslik).toLocaleLowerCase('tr').indexOf(kucuk) < 0) continue;
      (function (sy) {
        sonuc.push({
          ikon: sy.ikon || '#ic-doc', baslik: sy.baslik, alt: 'Ekran' + (sy.grup ? ' · ' + sy.grup : ''),
          git: function () { YU.git(sy.kod); }
        });
      })(p);
    }

    return sonuc.slice(0, 8);
  }

  function aramaPaneliAc(tetik, ham) {
    var q = String(ham || '').trim();
    if (q.length < 2) { popupKapat(); return; }
    var sonuc = aramaSonuclari(q);
    var kutu = popupKutu(360);
    if (!sonuc.length) {
      kutu.appendChild(popupBos('“' + q + '” için sonuç yok. Malzeme adı, silo adı veya GG.AA.YYYY tarihi yazın.'));
    } else {
      kutu.appendChild(popupBaslik(sonuc.length + ' sonuç'));
      for (var i = 0; i < sonuc.length; i++) {
        (function (r) {
          kutu.appendChild(popupSatir(r.ikon, r.baslik, r.alt, function () {
            if (dom.aramaGirdi) dom.aramaGirdi.value = '';
            r.git();
          }));
        })(sonuc[i]);
      }
    }
    popupAc(tetik, kutu);
  }

  /* --- dönem çipi, tema düğmesi, zil, kullanıcı kartı --- */

  function cipKutusu() {
    var metin = YU.h('span', { stil: { whiteSpace: 'nowrap' } });
    dom.cipMetin = metin;
    var cip = YU.h('div', {
      sinif: 'yu-cip', role: 'button', tabindex: '0', title: 'Kampanya dönemi',
      onClick: function () { donemPaneliAc(cip); },
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); donemPaneliAc(cip); } }
    }, YU.svg('#ic-calendar', 14), metin);
    return cip;
  }

  function temaDugmesi() {
    var etiket = YU.h('span', { metin: temaAdi() });
    dom.temaEtiket = etiket;
    var d = YU.h('button', {
      tip: 'button', sinif: 'yu-tema-dugme', title: 'Temayı değiştir (açık / koyu)',
      onClick: function () { YU.tema.cevir(); }
    }, YU.svg('#ic-gear', 14), etiket);
    return d;
  }

  function temaDugmesiTazele() {
    if (dom.temaEtiket) dom.temaEtiket.textContent = temaAdi();
  }

  /* --- üst şerit uyarı (ünlem) ve son hareket (zil) düğmeleri ---
     Ünlem: YU.uyarilar listesini açar; rozeti uyarı sayısıdır ve koşul
     düzelmeden sönmez. Zil: Son Hareketler önizlemesini açar; rozeti son
     bakıştan beri eklenen denetim kaydı sayısıdır, panel açılınca sıfırlanır
     (kullanıcı isteği, 21.08.2026). */

  var GORULEN_LOG_ANAHTAR = 'yu.sonHareket.gorulenId';
  /* Temizlenen sınırı ayrıdır: rozet panel açılınca söner, liste ise ancak
     "Tümünü Temizle" ile boşalır ve yeni hareket gelene dek boş kalır. */
  var TEMIZLENEN_LOG_ANAHTAR = 'yu.sonHareket.temizlenenId';

  function temizlenenLogId() {
    try { return Number(window.localStorage.getItem(TEMIZLENEN_LOG_ANAHTAR)) || 0; } catch (e) { return 0; }
  }

  function sayacRozeti() {
    return YU.h('span', {
      stil: {
        /* Düğmenin 7px dolgusu var; rozet ikonun köşesine yapışsın diye
           kutunun içine, ikonla bindirilerek konumlanır. */
        position: 'absolute', top: '-1px', right: '-1px',
        minWidth: '16px', height: '16px', padding: '0 4px',
        borderRadius: '8px', background: 'var(--olumsuz)', color: 'var(--vurgu-uzeri)',
        font: '600 10.5px/16px var(--sayi)', textAlign: 'center',
        border: '1.5px solid var(--ust-zemin)', display: 'none'
      }
    });
  }

  function sayacGoster(rozet, sayi) {
    if (!rozet) return;
    rozet.textContent = sayi > 99 ? '99+' : String(sayi);
    rozet.style.display = sayi ? 'block' : 'none';
  }

  function sonLogId() {
    var db = YU.db, en = 0, i, id;
    if (!db) return 0;
    for (i = 0; i < db.degisiklikLog.length; i++) {
      id = Number(db.degisiklikLog[i].Id) || 0;
      if (id > en) en = id;
    }
    return en;
  }

  function gorulenLogId() {
    try { return Number(window.localStorage.getItem(GORULEN_LOG_ANAHTAR)) || 0; } catch (e) { return 0; }
  }

  function yeniHareketSayisi() {
    var db = YU.db, g = gorulenLogId(), s = 0, i;
    if (!db) return 0;
    for (i = 0; i < db.degisiklikLog.length; i++) {
      if ((Number(db.degisiklikLog[i].Id) || 0) > g) s++;
    }
    return s;
  }

  function ustSayaclariTazele() {
    sayacGoster(dom.uyariSayac, guvenli(function () { return YU.uyarilar().length; }, 0));
    sayacGoster(dom.zilSayac, yeniHareketSayisi());
  }

  function unlemDugmesi() {
    var rozet = sayacRozeti();
    dom.uyariSayac = rozet;
    var dugme = YU.h('div', {
      sinif: 'yu-zil', role: 'button', tabindex: '0', title: 'Uyarılar',
      onClick: function () { unlemPaneliAc(dugme); },
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlemPaneliAc(dugme); } }
    }, YU.svg('#ic-alert', 19), rozet);
    return dugme;
  }

  function unlemPaneliAc(tetik) {
    if (acikPopup && acikPopup.tetik === tetik) { popupKapat(); return; }
    var uyarilar = YU.uyarilar();
    var kutu = popupKutu(340, 'sag');
    kutu.addEventListener('click', function (e) { e.stopPropagation(); });
    kutu.appendChild(popupBaslik(uyarilar.length ? uyarilar.length + ' uyarı' : 'Uyarı yok'));
    if (!uyarilar.length) {
      kutu.appendChild(popupBos('Bekleyen uyarı yok.'));
    } else {
      for (var i = 0; i < uyarilar.length; i++) {
        var u = uyarilar[i];
        kutu.appendChild(popupSatir(u.ikon, u.baslik, u.metin, u.git, u.tur === 'notr' ? null : u.tur));
      }
    }
    popupAc(tetik, kutu);
  }

  function zilDugmesi() {
    var rozet = sayacRozeti();
    dom.zilSayac = rozet;
    var zil = YU.h('div', {
      sinif: 'yu-zil', role: 'button', tabindex: '0', title: 'Son Hareketler',
      onClick: function () { zilPaneliAc(zil); },
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zilPaneliAc(zil); } }
    }, YU.svg('#ic-bell', 19), rozet);
    return zil;
  }

  function zilPaneliAc(tetik) {
    if (acikPopup && acikPopup.tetik === tetik) { popupKapat(); return; }

    /* Panel açıldı: yeni hareketler görüldü sayılır, zil sayacı söner. */
    try { window.localStorage.setItem(GORULEN_LOG_ANAHTAR, String(sonLogId())); } catch (e) {}
    sayacGoster(dom.zilSayac, 0);

    var ogeler = typeof YU.sonHareketListesi === 'function'
      ? YU.sonHareketListesi(6, 6, temizlenenLogId())
      : [];
    var kutu = popupKutu(340, 'sag');
    /* Kutu, zilin çocuğu: satır tıklaması zile köpürürse panel kapanıp
       hemen yeniden açılıyor. Köpürme kutuda kesilir. */
    kutu.addEventListener('click', function (e) { e.stopPropagation(); });
    kutu.appendChild(popupBaslik('Son Hareketler'));
    if (!ogeler.length) {
      kutu.appendChild(popupBos('Yeni hareket yok.'));
    } else {
      for (var i = 0; i < ogeler.length; i++) {
        var o = ogeler[i];
        kutu.appendChild(popupSatir(o.ikon, o.metin, o.zaman,
          o.onClick || function () { YU.git('son-hareketler'); }));
      }
    }
    kutu.appendChild(YU.h('div', { stil: { borderTop: '1px solid var(--ayrac)', margin: '4px 0' } }));
    if (ogeler.length) {
      kutu.appendChild(popupSatir('#ic-trash', 'Tümünü Temizle', null, function () {
        try { window.localStorage.setItem(TEMIZLENEN_LOG_ANAHTAR, String(sonLogId())); } catch (e) {}
        sayacGoster(dom.zilSayac, 0);
      }));
    }
    kutu.appendChild(popupSatir('#ic-bell', 'Tümünü Gör', null,
      function () { YU.git('son-hareketler'); }, 'vurgu'));
    popupAc(tetik, kutu);
  }

  function kullaniciKarti() {
    var avatar = YU.h('div', { sinif: 'yu-avatar' });
    var ad = YU.h('div', { sinif: 'yu-kullanici-ad' });
    var rol = YU.h('div', { sinif: 'yu-kullanici-rol' });
    dom.kullaniciAvatar = avatar; dom.kullaniciAd = ad; dom.kullaniciRol = rol;
    var kart = YU.h('div', {
      sinif: 'yu-kullanici', role: 'button', tabindex: '0', title: 'Oturum',
      onClick: function () { kullaniciPaneliAc(kart); },
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kullaniciPaneliAc(kart); } }
    }, avatar, YU.h('div', null, ad, rol));
    return kart;
  }

  function kullaniciTazele() {
    var k = YU.oturum.kullanici;
    if (!dom.kullaniciAd || !k) return;
    dom.kullaniciAvatar.textContent = basHarfler(k.AdSoyad);
    dom.kullaniciAd.textContent = k.AdSoyad;
    dom.kullaniciRol.textContent = rolMetni(k.Rol);
  }

  function kullaniciPaneliAc(tetik) {
    if (acikPopup && acikPopup.tetik === tetik) { popupKapat(); return; }
    var kutu = popupKutu(258, 'sag');
    var k = YU.oturum.kullanici;
    kutu.appendChild(popupBaslik(k ? k.KullaniciAdi + ' · ' + rolMetni(k.Rol) : 'Oturum'));
    kutu.appendChild(popupSatir('#ic-users', 'Rol Değiştir', 'Giriş perdesine dön, başka rolle devam et.', function () { YU.oturumKapat(); }));
    kutu.appendChild(popupSatir('#ic-percent', 'Oturumu Kapat', 'Kayıtlı oturum silinir.', function () { YU.oturumKapat(); }, 'olumsuz'));

    /* Tema seçimi üst şeritteki düğmede duruyor; kullanıcı menüsünde
       ikinci kez gösterilmiyor (kullanıcı isteği). */
    popupAc(tetik, kutu);
  }

  /* --- test veri düğmeleri (kullanıcı isteği, 21.08.2026) ---
     Prototipe özel: örnek veriyi silip boş sistemle denemek ve sistem boşken
     aynı deterministik veriyi geri yüklemek için. Gerçek uygulamaya girmez. */
  function testDugmeleri() {
    function veriVar() {
      var db = YU.db;
      return !!(db.kuruKuspeGunluk.length || db.gunlukHareket.length ||
                db.siloHareket.length || db.devirStok.length || db.siloDevirStok.length);
    }
    var sifirla = YU.ui.dugme({
      metin: 'Verileri Sıfırla', ikon: '#ic-trash', tur: 'tehlike', kucuk: true,
      baslik: 'Test — tüm kayıtları siler; malzeme, silo ve kullanıcı tanımları kalır',
      onClick: function () {
        if (!veriVar()) { YU.ui.bildir('Silinecek kayıt yok — veri zaten boş.', 'bilgi'); return; }
        YU.ui.onay({
          baslik: 'Verileri Sıfırla',
          metin: 'Tüm günlük kayıtlar, silo hareketleri, devirler ve değişiklik geçmişi silinecek. ' +
            'Malzeme, silo ve kullanıcı tanımları kalır. Örnek veri "Örnek Veri Yükle" ile geri gelir.',
          onayMetni: 'Sıfırla', tehlike: true
        }).then(function (evet) {
          if (!evet) return;
          YU.db.bosla();
          YU.ui.bildir('Tüm kayıtlar silindi — sistem boş.', 'basari');
          YU.yenile();
        });
      }
    });
    var yukle = YU.ui.dugme({
      metin: 'Örnek Veri Yükle', ikon: '#ic-download', tur: 'ikincil', kucuk: true,
      baslik: 'Test — sistem boşken deterministik örnek kampanya verisini geri yükler',
      onClick: function () {
        if (veriVar()) {
          YU.ui.bildir('Kayıtlı veri varken örnek veri yüklenmez — önce "Verileri Sıfırla".', 'uyari');
          return;
        }
        YU.tohumla(YU.db);
        YU.db.kaydet();
        YU.ui.bildir('Örnek kampanya verisi yüklendi.', 'basari');
        YU.yenile();
      }
    });
    return YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '8px', flex: 'none' } },
      sifirla, yukle);
  }

  /* --- kabuk kurulumu --- */

  function kabukKur() {
    var k = kok();
    if (!k) throw new Error('#yu-kok bulunamadı — index.html bozulmuş olabilir.');
    YU.bos(k);
    dom = {};

    var yan = YU.h('div', { sinif: 'yu-yan' }, markaBlogu(true, true), seciciKutusu(), menuKur());

    /* Arama kutusu kendi otomatik kenar boşluklarıyla ortalanıyor; araya
       esneyen bir boşluk konursa tüm boşluğu o yutar ve kutu sola yapışır. */
    var ust = YU.h('div', { sinif: 'yu-ust' },
      aramaKutusu(),
      testDugmeleri(),
      cipKutusu(),
      temaDugmesi(),
      unlemDugmesi(),
      zilDugmesi(),
      kullaniciKarti()
    );

    var baslik = YU.h('div', { sinif: 'yu-sayfa-baslik' });
    var alt = YU.h('div', { sinif: 'yu-sayfa-alt' });
    var eylemler = YU.h('div', { sinif: 'yu-eylemler' });
    var sayfaBas = YU.h('div', { sinif: 'yu-sayfa-bas' },
      YU.h('div', { stil: { flex: '1', minWidth: '0' } }, baslik, alt),
      eylemler
    );
    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    var icerik = YU.h('div', { sinif: 'yu-icerik' }, sayfaBas, kap);

    dom.yan = yan; dom.menu = yan.querySelector('.yu-menu');
    dom.baslik = baslik; dom.alt = alt; dom.eylemler = eylemler;
    dom.kap = kap; dom.icerik = icerik;

    /* Daralt düğmesi kenar çubuğunun dış kenarına oturur; bu yüzden kabuk
       düzeyinde durur, kenar çubuğunun kırpma alanının dışında. */
    var kabuk = YU.h('div', { sinif: 'yu-kabuk' }, yan, YU.h('div', { sinif: 'yu-ana' }, ust, icerik), daraltDugmesi());
    dom.kabuk = kabuk;
    k.appendChild(kabuk);
    yanDaraltUygula(yanDaralikMi());

    kabukKurulu = true;
    kullaniciTazele();
    donemBaslikTazele();
  }

  function menuIsaretle(kod) {
    if (!dom.menu) return;
    var ogeler = dom.menu.querySelectorAll('.yu-menu-oge');
    for (var i = 0; i < ogeler.length; i++) {
      var secili = ogeler[i].getAttribute('data-kod') === kod;
      ogeler[i].className = secili ? 'yu-menu-oge aktif' : 'yu-menu-oge';
    }
  }

  YU.kabukGoster = function () {
    if (!kabukKurulu) kabukKur();
  };

  /* Menü, kullanıcının rolüne göre kurulduğu için rol değişince yeniden kurulur. */
  YU.kabukTazele = function () {
    kabukKurulu = false;
    ciz();
  };

  /* ==================================================================
     10. Çizim ve yetki kontrolü (Şartname Test 7 — DEMİRBAŞ)
     ================================================================== */

  function ciz() {
    ipucuKaldir();          /* grafik ipucu belgeye ekleniyor: sayfa değişince kalmasın */
    if (!YU.oturum.kullanici) { YU.girisGoster(); return; }
    YU.kabukGoster();

    var yol = hashCoz();
    var kod = yol.kod || MENU_USTU;
    aktif = { kod: kod, param: yol.param };

    donemOnbellek = null;
    donemBaslikTazele();
    ustSayaclariTazele();
    menuIsaretle(kod);
    YU.bos(dom.eylemler);
    var kap = YU.bos(dom.kap);

    var tanim = YU.sayfalar[kod];

    if (!tanim) {
      basligiYaz('Sayfa Bulunamadı', '#/' + kod + ' adresine karşılık gelen bir ekran yok.');
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-search', baslik: 'Sayfa Bulunamadı',
        metin: 'Adres çubuğundaki bağlantı hatalı olabilir. Soldaki menüden bir ekran seçin.',
        eylemler: [YU.ui.dugme({ metin: 'Ana Sayfa', ikon: '#ic-home', tur: 'birincil', onClick: function () { YU.git(MENU_USTU); } })]
      }));
      return;
    }

    /* Yetki kapısı adres çubuğundan gelen isteği de keser — menüde gizlemek yetmez. */
    if (tanim.rol === 'Yonetici' && !YU.yonetici()) {
      basligiYaz('Erişim engellendi', 'Bu ekran yalnızca Yönetici rolüne açıktır.');
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-percent',
        baslik: 'Bu ekrana erişim yetkiniz yok.',
        metin: '“' + tanim.baslik + '” ekranı Yönetici rolü gerektirir. Oturumunuz ' + rolMetni(YU.rol()) + ' olarak açık.',
        eylemler: [
          YU.ui.dugme({ metin: 'Ana Sayfa', ikon: '#ic-home', tur: 'birincil', onClick: function () { YU.git(MENU_USTU); } }),
          YU.ui.dugme({ metin: 'Rol Değiştir', ikon: '#ic-users', tur: 'ikincil', onClick: function () { YU.oturumKapat(); } })
        ]
      }));
      return;
    }

    var altMetin = typeof tanim.altBaslik === 'function'
      ? guvenli(function () { return tanim.altBaslik(yol.param); }, '')
      : (tanim.altBaslik || '');
    basligiYaz(tanim.baslik, altMetin);

    try {
      tanim.ciz(kap, yol.param);
    } catch (e) {
      if (window.console) console.error('[kabuk] sayfa çizilemedi:', kod, e);
      kap.appendChild(YU.ui.serit({
        tur: 'hata', baslik: 'Ekran Çizilirken Hata Oluştu',
        metin: (e && e.message ? e.message : String(e)) + ' — ayrıntı tarayıcı konsolunda.'
      }));
    }
    if (dom.icerik) dom.icerik.scrollTop = 0;
  }

  function basligiYaz(baslik, alt) {
    dom.baslik.textContent = baslik || '';
    dom.alt.textContent = alt || '';
    dom.alt.style.display = alt ? '' : 'none';
  }

  /* ==================================================================
     11. Giriş ekranı (SOZLESME.md §8) — parola yok, rol seçimi
     ================================================================== */

  function rolKarti(tanim) {
    var kart = YU.h('button', {
      tip: 'button', sinif: 'yu-giris-rol',
      onClick: tanim.onClick
    },
      YU.h('div', {
        stil: {
          width: '38px', height: '38px', borderRadius: '10px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--vurgu-zemin)', color: 'var(--vurgu)'
        }
      }, YU.svg(tanim.ikon, 19)),
      YU.h('div', { metin: tanim.baslik, stil: { font: '600 16.5px/1.2 var(--font)', color: 'var(--metin)' } }),
      YU.h('div', { metin: tanim.metin, stil: { font: '400 14px/1.5 var(--font)', color: 'var(--metin-4)' } })
    );
    return kart;
  }

  YU.girisGoster = function () {
    var k = kok();
    if (!k) return;
    popupKapat();
    ipucuKaldir();
    YU.bos(k);
    dom = {};
    kabukKurulu = false;
    donemOnbellek = null;

    var d = donemAktif();
    var yoneticiSatir = rolIle('Yonetici');
    var operatorSatir = rolIle('Operator');

    var temaKap = YU.h('div', { stil: { position: 'absolute', top: '20px', right: '22px' } }, temaDugmesi());

    var roller = YU.h('div', { sinif: 'yu-giris-roller' },
      rolKarti({
        ikon: '#ic-users', baslik: 'Yönetici Girişi',
        metin: (yoneticiSatir ? yoneticiSatir.AdSoyad : 'Cenk Sefer ÇOĞALMIŞ') + ' · tüm ekranlar, devir stok, kullanıcı ve malzeme yönetimi',
        onClick: function () { girisYap(yoneticiSatir); }
      }),
      rolKarti({
        ikon: '#ic-pencil', baslik: 'Operatör Girişi',
        metin: (operatorSatir ? operatorSatir.AdSoyad : 'Ahmet Yılmaz') + ' · günlük giriş, stok ve rapor görüntüleme',
        onClick: function () { girisYap(operatorSatir); }
      })
    );

    var kart = YU.h('div', { sinif: 'yu-giris-kart' },
      markaBlogu(false, false),
      YU.h('div', { stil: { marginTop: '18px' } },
        YU.h('div', { metin: 'Yan Ürünler Stok Takip', stil: { font: '600 24px/1.2 var(--font)', letterSpacing: '-.015em' } }),
        YU.h('div', {
          metin: 'Şeker Fabrikası · Kampanya ' + (d ? d.ad : '2025/2026'),
          stil: { font: '400 14.5px/1.4 var(--font)', color: 'var(--metin-4)', marginTop: '6px' }
        })
      ),
      roller,
      YU.h('div', {
        sinif: 'yu-giris-not',
        metin: 'Prototip — parola doğrulaması yoktur. Gerçek uygulamada kullanıcı adı + BCrypt hash’li parola ile giriş yapılır (Şartname §3).'
      })
    );

    k.appendChild(YU.h('div', { sinif: 'yu-giris', stil: { position: 'relative' } }, temaKap, kart));
  };

  function girisYap(kullanici) {
    if (!kullanici) {
      YU.ui.bildir('Bu role ait aktif kullanıcı bulunamadı.', 'hata');
      return;
    }
    YU.oturumAc(kullanici);
    kabukKurulu = false;      /* menü role göre kurulduğu için sıfırdan çizilir */
    YU.git(MENU_USTU);
  }

  /* ==================================================================
     12. UI yardımcıları — SOZLESME.md §6
     ================================================================== */

  YU.ui = YU.ui || {};

  YU.ui.dugme = function (s) {
    s = s || {};
    var d = YU.h('button', {
      tip: 'button',
      sinif: 'yu-dugme ' + (s.tur || 'ikincil') + (s.kucuk ? ' kucuk' : ''),
      title: s.baslik || null,
      onClick: s.onClick || null
    }, s.ikon ? YU.svg(s.ikon, s.kucuk ? 13 : 15) : null, s.metin ? YU.h('span', { metin: s.metin }) : null);
    if (s.pasif) d.disabled = true;
    return d;
  };

  /* Anlam renkleri sınıf değil değişkenle veriliyor: sözleşmedeki sınıf listesi
     .yu-kpi-ikon için renk çeşitlemesi tanımlamıyor. */
  var RENK_ZEMIN = { olumlu: 'var(--olumlu-zemin)', olumsuz: 'var(--olumsuz-zemin)', bekleyen: 'var(--bekleyen-zemin)', vurgu: 'var(--vurgu-zemin)', notr: 'var(--notr-zemin)' };
  var RENK_METIN = { olumlu: 'var(--olumlu)', olumsuz: 'var(--olumsuz)', bekleyen: 'var(--bekleyen)', vurgu: 'var(--vurgu)', notr: 'var(--metin-3)' };

  YU.ui.kpi = function (s) {
    s = s || {};
    var ikonKap = YU.h('div', { sinif: 'yu-kpi-ikon' }, s.ikon ? YU.svg(s.ikon, 15) : null);
    if (s.renk && s.renk !== 'vurgu') {
      ikonKap.style.background = RENK_ZEMIN[s.renk] || 'var(--yuzey-3)';
      ikonKap.style.color = RENK_METIN[s.renk] || 'var(--metin-3)';
    }
    /* Değer düz metin olabildiği gibi ölçü satırı (YU.ui.olcu) gibi bir
       düğüm de olabilir; ikisi de aynı .yu-kpi-deger kutusunda durur. */
    var degerEl = YU.h('div', { sinif: 'yu-kpi-deger' });
    if (s.deger && s.deger.nodeType) degerEl.appendChild(s.deger);
    else degerEl.textContent = s.deger === null || s.deger === undefined ? '—' : String(s.deger);

    return YU.h('div', { sinif: 'yu-kpi' },
      YU.h('div', { sinif: 'yu-kpi-bas' }, ikonKap, YU.h('div', { sinif: 'yu-kpi-etiket', metin: s.etiket || '' })),
      degerEl,
      s.alt ? YU.h('div', { sinif: 'yu-kpi-alt', metin: s.alt }) : null
    );
  };

  YU.ui.panel = function (s) {
    s = s || {};
    var govde = YU.h('div', { sinif: 'yu-panel-govde' });
    cocukEkle(govde, s.govde);
    var bas = null;
    if (s.baslik || s.sag || s.ikon) {
      bas = YU.h('div', { sinif: 'yu-panel-bas' },
        s.ikon ? YU.h('span', { stil: { display: 'flex', color: 'var(--vurgu)' } }, YU.svg(s.ikon, 18)) : null,   /* 15 -> 18 (kullanıcı isteği) */
        YU.h('div', { sinif: 'yu-panel-baslik', metin: s.baslik || '', stil: { flex: '1' } }),
        s.sag ? YU.h('div', { sinif: 'yu-panel-sag' }, s.sag) : null
      );
    }
    var panel = YU.h('div', { sinif: 'yu-panel' }, bas, govde);
    if (s.dolgusuz) {
      panel.style.padding = '0';
      /* clip: hidden kaydırma kabı oluşturup içindeki yapışkan tablo
         başlığını panele hapsediyordu (tema.css .yu-panel.dolgusuz). */
      panel.style.overflow = 'clip';
      govde.style.padding = '0';
      if (bas) { bas.style.padding = '15px 18px'; bas.style.marginBottom = '0'; bas.style.borderBottom = '1px solid var(--ayrac)'; }
    }
    return panel;
  };

  YU.ui.rozet = function (metin, tur) {
    return YU.h('span', { sinif: 'yu-rozet ' + (tur || 'notr'), metin: metin === null || metin === undefined ? '' : String(metin) });
  };

  /* Ölçü satırı: "168.000 kg / 168 ton / 6.720 adet".
     Sayı bulunduğu yerin yazı tipini sürdürür, birim küçük ve soluk yazılır;
     böylece kg / ton / adet ayrımı tek bakışta okunur. Parçalar dar kolonda
     satır sarar, hizalama çağıranın hizasını izler. */
  YU.ui.olcu = function (parcalar, hiza) {
    var kap = YU.h('span', {
      stil: {
        display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline',
        justifyContent: hiza === 'sol' ? 'flex-start' : 'flex-end',
        columnGap: '4px', rowGap: '2px'
      }
    });
    var kucuk = { font: '400 .78em/1.2 var(--font)', letterSpacing: 'normal', color: 'var(--metin-4)' };
    var ayrac = { font: '400 .78em/1.2 var(--font)', letterSpacing: 'normal', color: 'var(--metin-5)' };
    for (var i = 0; i < (parcalar || []).length; i++) {
      var p = parcalar[i];
      if (!p) continue;
      /* Sayı ile birimi tek bir sarmalamaz parçada tutar: dar kolonda satır
         "206,3" ile "ton" arasından değil, ölçüler arasından kırılır. */
      var oge = YU.h('span', {
        stil: { display: 'inline-flex', alignItems: 'baseline', gap: '3px', whiteSpace: 'nowrap' }
      });
      if (i) oge.appendChild(YU.h('span', { metin: '/', stil: ayrac }));
      oge.appendChild(YU.h('span', { metin: String(p.sayi) }));
      if (p.birim) oge.appendChild(YU.h('span', { metin: p.birim, stil: kucuk }));
      kap.appendChild(oge);
    }
    return kap;
  };

  YU.ui.cubuk = function (oran, tur) {
    var o = Math.max(0, Math.min(1, Number(oran) || 0));
    var dolu = YU.h('div', { sinif: 'yu-cubuk-dolu', stil: { width: (o * 100).toFixed(2) + '%' } });
    if (tur && RENK_METIN[tur]) dolu.style.background = RENK_METIN[tur];
    return YU.h('div', { sinif: 'yu-cubuk' }, dolu);
  };

  /* Silo doluluk pictogramı — alttan dolan silindir, ortasında oran yazısı.
     Ana Sayfa'da doğdu (21.08.2026), beğenilince ortak kütüphaneye taşındı;
     Ana Sayfa ve Silo Durumu kartları birlikte kullanır. İkon setine sembol
     EKLENMEZ (CLAUDE.md KURAL 1): grafikler gibi yerinde çizilen inline SVG'dir,
     renkleri tema değişkenlerinden alır (çubukla aynı eşikler). */
  var siloKirpSayac = 0;

  YU.ui.siloSekli = function (oran, tur) {
    var G = 104, Y = 151;               /* viewBox */
    var rx = 36, ry = 13;               /* gövde yarı genişliği, kapak basıklığı */
    var cx = G / 2;
    var ust = ry + 2.5, alt = Y - ry - 2.5;
    var tepe = ust - ry, taban = alt + ry;   /* şeklin gerçek uç noktaları */
    var renk = RENK_METIN[tur] || 'var(--vurgu)';

    var o = Math.max(0, Math.min(1, Number(oran) || 0));
    var kirpId = 'yu-silo-kirp-' + (++siloKirpSayac);

    var siluet = 'M ' + (cx - rx) + ' ' + ust +
      ' A ' + rx + ' ' + ry + ' 0 0 1 ' + (cx + rx) + ' ' + ust +
      ' L ' + (cx + rx) + ' ' + alt +
      ' A ' + rx + ' ' + ry + ' 0 0 1 ' + (cx - rx) + ' ' + alt + ' Z';

    var svg = svgOge('svg', {
      width: G, height: Y, viewBox: '0 0 ' + G + ' ' + Y, 'aria-hidden': 'true'
    });
    svg.style.display = 'block';
    svg.style.flex = 'none';

    var kirp = svgOge('clipPath', { id: kirpId });
    kirp.appendChild(svgOge('path', { d: siluet }));
    var defs = svgOge('defs');
    defs.appendChild(kirp);
    svg.appendChild(defs);

    /* Boş gövde */
    svg.appendChild(svgOge('path', { d: siluet, fill: 'var(--silo-govde)' }));

    /* Dolu kısım — alttan oran kadar. Seviye gövde eksenine (ust..alt)
       kenetlenir: dolum alt kapağın dışına sarkmaz, üst kapağa taşmaz. */
    if (o > 0) {
      var seviye = taban - o * (taban - tepe);
      seviye = Math.max(ust, Math.min(alt, seviye));
      var dolu = svgOge('rect', {
        x: cx - rx, y: seviye, width: rx * 2, height: Y - seviye,
        fill: renk, 'clip-path': 'url(#' + kirpId + ')'
      });
      dolu.style.opacity = '.85';
      svg.appendChild(dolu);
      /* Sıvı yüzeyi: DOLU elips — çizgi değil; çizgi elipsin alt yayıyla
         tabana ikinci bir kavis düşürüyordu. */
      if (o < 1) {
        svg.appendChild(svgOge('ellipse', {
          cx: cx, cy: seviye, rx: rx, ry: ry,
          fill: renk, 'clip-path': 'url(#' + kirpId + ')'
        }));
      }
    }

    /* Üst kapak yüzeyi ve dış çizgi en üste. */
    svg.appendChild(svgOge('ellipse', {
      cx: cx, cy: ust, rx: rx, ry: ry,
      fill: 'var(--silo-kapak)', stroke: 'var(--silo-cizgi)', 'stroke-width': 1.7
    }));
    svg.appendChild(svgOge('path', {
      d: siluet, fill: 'none', stroke: 'var(--silo-cizgi)', 'stroke-width': 1.7
    }));

    /* Doluluk oranı silonun ortasında — açık temada siyah, koyu temada beyaz
       (--metin). Kart başlığında ayrıca yüzde rozeti gösterilmez. */
    var yazi = svgOge('text', {
      x: cx, y: (ust + alt) / 2, 'text-anchor': 'middle',
      'dominant-baseline': 'central', fill: 'var(--silo-yazi)'
    });
    yazi.style.font = '700 19px var(--sayi)';
    yazi.style.fontVariantNumeric = 'tabular-nums';
    yazi.textContent = YU.fmt.yuzde((Number(oran) || 0) * 100, 1);
    svg.appendChild(yazi);

    return svg;
  };

  YU.ui.bosDurum = function (s) {
    s = s || {};
    return YU.h('div', { sinif: 'yu-bos' },
      s.ikon ? YU.h('div', { sinif: 'yu-bos-ikon' }, YU.svg(s.ikon, 22)) : null,
      YU.h('div', { sinif: 'yu-bos-baslik', metin: s.baslik || '' }),
      s.metin ? YU.h('div', { sinif: 'yu-bos-metin', metin: s.metin }) : null,
      s.eylemler && s.eylemler.length ? YU.h('div', { sinif: 'yu-bos-eylem' }, s.eylemler) : null
    );
  };

  var SERIT_IKON = { hata: '#ic-percent', uyari: '#ic-bell', bilgi: '#ic-doc', basari: '#ic-up' };

  YU.ui.serit = function (s) {
    s = s || {};
    var tur = s.tur || 'bilgi';
    var eylem = s.eylem;
    if (eylem && !eylem.nodeType) eylem = YU.ui.dugme({ metin: eylem.metin, ikon: eylem.ikon, tur: 'sade', kucuk: true, onClick: eylem.onClick });
    return YU.h('div', { sinif: 'yu-serit ' + tur },
      YU.h('div', { sinif: 'yu-serit-ikon' }, YU.svg(s.ikon || SERIT_IKON[tur] || '#ic-doc', 16)),
      YU.h('div', { sinif: 'yu-serit-govde' },
        s.baslik ? YU.h('div', { sinif: 'yu-serit-baslik', metin: s.baslik }) : null,
        s.metin ? YU.h('div', { metin: s.metin }) : null
      ),
      eylem || null
    );
  };

  YU.ui.tablo = function (s) {
    s = s || {};
    var sutunlar = s.sutunlar || [];
    var satirlar = s.satirlar || [];
    /* 'sik' = Değişiklik Geçmişi listesinin beğenilen stili (kullanıcı isteği,
       21.08.2026): kompakt dolgu + tek tip 42px satır yüksekliği. VARSAYILAN
       AÇIK; içinde giriş alanı olan düzenleme tabloları sik:false geçer. */
    var sikMi = s.sik !== false;
    /* yapiskan: kolon başlıkları sayfa kaydıkça üst şeridin altına yapışır.
       Sticky, kaydırma kabının içinde hapsolduğu için bu varyantta sarıcı
       yatay kaydırma kabı olmaktan çıkar (tema.css .yu-yapiskan). */
    var sar = YU.h('div', {
      sinif: 'yu-tablo-sar' + (s.yapiskan ? ' yu-yapiskan' : ''),
      stil: { overflowX: s.yapiskan ? 'visible' : 'auto' }
    });

    if (!satirlar.length) {
      sar.appendChild(YU.h('div', { sinif: 'yu-bos' },
        YU.h('div', { sinif: 'yu-bos-metin', metin: s.bos || 'Gösterilecek kayıt yok.' })
      ));
      return sar;
    }

    var tablo = YU.h('table', { sinif: 'yu-tablo' });
    var colgroup = YU.h('colgroup');
    var thead = YU.h('thead');
    var trBas = YU.h('tr');
    for (var i = 0; i < sutunlar.length; i++) {
      var su = sutunlar[i] || {};
      var col = YU.h('col');
      if (su.genislik) col.style.width = typeof su.genislik === 'number' ? su.genislik + 'px' : su.genislik;
      colgroup.appendChild(col);
      var sinif = su.hiza === 'sag' ? 'yu-sag' : (su.hiza === 'orta' ? 'yu-orta' : '');
      var th = YU.h('th', { sinif: sinif, metin: su.baslik || '' });
      if (s.kompakt || sikMi) th.style.padding = '8px 14px';
      trBas.appendChild(th);
    }
    thead.appendChild(trBas);

    var tbody = YU.h('tbody');
    for (var r = 0; r < satirlar.length; r++) {
      var ham = satirlar[r];
      var hucreler = dizi(ham) ? ham : (ham && ham.hucreler ? ham.hucreler : []);
      var tr = YU.h('tr');
      if (!dizi(ham) && ham) {
        if (ham.onClick) {
          /* Tıklanabilirlik hem sınıfla (zemin + sol şerit) hem de imleç
             altındaki mini ipucuyla duyuruluyor; tek başına imleç değişimi
             kullanıcıya satırın açılabilir olduğunu söylemiyordu. */
          tr.className = tr.className ? tr.className + ' yu-tiklanir' : 'yu-tiklanir';
          tr.setAttribute('tabindex', '0');
          tr.setAttribute('role', 'button');
          tr.addEventListener('click', ham.onClick);
          tr.addEventListener('keydown', (function (fn) {
            return function (e) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
            };
          })(ham.onClick));
          var ipucuMetni = ham.ipucu === undefined ? (s.tiklamaIpucu || 'Detay için tıklayın') : ham.ipucu;
          if (ipucuMetni) metinIpucuBagla(tr, ipucuMetni);
        }
        if (ham.vurgu) tr.style.boxShadow = 'inset 3px 0 0 ' + (RENK_METIN[ham.vurgu] || 'var(--vurgu)');
      }
      for (var c = 0; c < hucreler.length; c++) {
        var sut = sutunlar[c] || {};
        var siniflar = [];
        if (sut.hiza === 'sag') siniflar.push('yu-sag');
        else if (sut.hiza === 'orta') siniflar.push('yu-orta');
        if (sut.mono) siniflar.push('yu-mono');
        var td = YU.h('td', { sinif: siniflar.join(' ') });
        if (s.kompakt || sikMi) td.style.padding = '8px 14px';
        cocukEkle(td, hucreler[c]);
        tr.appendChild(td);
      }
      if (sikMi) tr.style.height = '42px';   /* min yükseklik gibi davranır; taşan içerik satırı büyütür */
      tbody.appendChild(tr);
    }

    tablo.appendChild(colgroup);
    tablo.appendChild(thead);
    tablo.appendChild(tbody);
    sar.appendChild(tablo);
    return sar;
  };

  YU.ui.alan = function (s) {
    s = s || {};
    var tip = s.tip || 'metin';
    var girdi, sonSayi = null;

    /* Miktar biçimi tek yerden gelsin diye YU.fmt.kg: decimal(18,3) kuralı orada tanımlı. */
    function sayiBicimle(n) {
      if (n === null || n === undefined || isNaN(n)) return '';
      return YU.fmt.kg(n);
    }
    function sayiHam(n) {
      if (n === null || n === undefined || isNaN(n)) return '';
      return String(n).replace('.', ',');
    }

    if (tip === 'secim') {
      girdi = YU.h('select', { sinif: 'yu-girdi' });
      var secenekler = s.secenekler || [];
      for (var i = 0; i < secenekler.length; i++) {
        var o = secenekler[i], deger, metin;
        if (o === null || o === undefined) continue;
        if (typeof o === 'object') {
          if ('deger' in o) { deger = o.deger; metin = o.metin; }
          else { deger = o.Id; metin = o.Ad; }
        } else { deger = o; metin = o; }
        girdi.appendChild(YU.h('option', { value: String(deger), metin: String(metin === undefined ? deger : metin) }));
      }
    } else if (tip === 'tarih') {
      girdi = YU.h('input', { sinif: 'yu-girdi', tip: 'date' });
    } else if (tip === 'parola') {
      girdi = YU.h('input', { sinif: 'yu-girdi', tip: 'password' });
    } else if (tip === 'sayi') {
      /* Türkçe ondalık kabul edilsin diye type="text": type="number" virgülü reddeder. */
      girdi = YU.h('input', { sinif: 'yu-girdi', tip: 'text', inputmode: 'decimal', autocomplete: 'off' });
      girdi.style.textAlign = 'right';
      girdi.style.fontFamily = 'var(--sayi)';
      girdi.addEventListener('focus', function () {
        if (sonSayi !== null) girdi.value = sayiHam(sonSayi);
        girdi.select();
      });
      girdi.addEventListener('blur', function () {
        var v = YU.parse.sayi(girdi.value);
        if (girdi.value === '' ) { sonSayi = null; negatifDenetle(); return; }
        if (isNaN(v)) return;                 /* geçersizse kullanıcının yazdığı kalsın, hata çağıran gösterir */
        sonSayi = v;
        girdi.value = sayiBicimle(v);
        negatifDenetle();
      });
      /* Fiziksel bir miktar negatif olamaz — kilo da, çuval adedi de, sıra da.
         Kaydete basmayı beklemeden yazarken söylenir. */
      girdi.addEventListener('input', negatifDenetle);
    } else {
      girdi = YU.h('input', { sinif: 'yu-girdi', tip: 'text', autocomplete: 'off' });
    }

    if (s.pasif) girdi.disabled = true;
    if (s.yerTutucu) girdi.setAttribute('placeholder', s.yerTutucu);
    if (s.onInput) girdi.addEventListener('input', s.onInput);
    if (s.onChange) girdi.addEventListener('change', s.onChange);

    var sar = YU.h('div', { sinif: 'yu-girdi-sar' }, girdi,
      s.sag ? YU.h('span', { sinif: 'yu-girdi-sag' }, s.sag) : null);

    var hataEl = YU.h('div', { sinif: 'yu-alan-hata', stil: { display: 'none' } });

    var NEGATIF_MESAJ = 'Negatif değer girilemez — miktar en az 0 olmalı.';

    function boya(mesaj) {
      /* Aynı sınıfı tekrar atamak border-color geçişini baştan başlatıyor. */
      var yeniSinif = mesaj ? 'yu-girdi hatali' : 'yu-girdi';
      if (girdi.className !== yeniSinif) girdi.className = yeniSinif;
      hataEl.textContent = mesaj || '';
      hataEl.style.display = mesaj ? '' : 'none';
    }

    function negatifMi() {
      if (tip !== 'sayi' || s.negatifeIzin) return false;
      var v = YU.parse.sayi(girdi.value);
      return isFinite(v) && v < 0;
    }

    function negatifDenetle() {
      if (negatifMi()) boya(NEGATIF_MESAJ);
      else if (hataEl.textContent === NEGATIF_MESAJ) boya('');
    }
    var kokEl = YU.h('div', { sinif: 'yu-alan' },
      s.etiket ? YU.h('label', { sinif: 'yu-etiket', metin: s.etiket }) : null,
      sar,
      s.yardim ? YU.h('div', { sinif: 'yu-yardim', metin: s.yardim }) : null,
      hataEl
    );
    if (s.genislik) kokEl.style.width = typeof s.genislik === 'number' ? s.genislik + 'px' : s.genislik;

    var api = {
      kok: kokEl,
      girdi: girdi,
      deger: function () {
        if (tip !== 'sayi') return girdi.value;
        /* Biçimli metni yeniden ayrıştırmak veri kaybettirir: YU.parse.sayi
           sözleşme gereği "250.000" değerini 250 okur (nokta = ondalık ayracı).
           Kullanıcı dokunmadıysa saklanan sayı doğrudan döner. */
        if (sonSayi !== null && girdi.value === sayiBicimle(sonSayi)) return sonSayi;
        return YU.parse.sayi(girdi.value);
      },
      ayarla: function (v) {
        if (tip === 'sayi') {
          var n = (v === null || v === undefined || v === '') ? null : Number(v);
          sonSayi = (n === null || isNaN(n)) ? null : n;
          girdi.value = sonSayi === null ? '' : sayiBicimle(sonSayi);
        } else {
          girdi.value = (v === null || v === undefined) ? '' : String(v);
        }
        return api;
      },
      hataGoster: function (mesaj) {
        /* Sayfa hataları temizlese bile negatif uyarısı ayakta kalır;
           yoksa canlı denetim bir sonraki çizimde siliniyordu. */
        if (!mesaj && negatifMi()) mesaj = NEGATIF_MESAJ;
        boya(mesaj);
        return api;
      },
      /* Sayfalar kendi boyama döngülerinde bu durumu ezmemek için sorar. */
      negatifMi: negatifMi,
      temizle: function () { api.ayarla(''); api.hataGoster(''); return api; },
      odakla: function () { girdi.focus(); return api; }
    };

    if (s.deger !== undefined && s.deger !== null) api.ayarla(s.deger);
    return api;
  };

  YU.ui.sekmeler = function (s) {
    s = s || {};
    var sekmeler = s.sekmeler || [];
    var aktifKod = s.aktif || (sekmeler[0] && sekmeler[0].kod);
    var kap = YU.h('div', { sinif: 'yu-sekmeler' });
    var dugmeler = [];
    for (var i = 0; i < sekmeler.length; i++) {
      (function (sek) {
        var d = YU.h('button', {
          tip: 'button', sinif: 'yu-sekme', metin: sek.metin,
          onClick: function () {
            aktifKod = sek.kod;
            isaretle();
            if (s.onDegis) s.onDegis(sek.kod);
          }
        });
        d.setAttribute('data-kod', sek.kod);
        dugmeler.push(d);
        kap.appendChild(d);
      })(sekmeler[i]);
    }
    function isaretle() {
      for (var j = 0; j < dugmeler.length; j++) {
        dugmeler[j].className = dugmeler[j].getAttribute('data-kod') === aktifKod ? 'yu-sekme aktif' : 'yu-sekme';
      }
    }
    isaretle();
    return kap;
  };

  YU.ui.bildir = function (mesaj, tur) {
    var kap = document.getElementById('yu-bildirimler');
    if (!kap) {
      kap = YU.h('div', { sinif: 'yu-bildirimler', id: 'yu-bildirimler' });
      document.body.appendChild(kap);
    }
    var BILDIRIM_RENK = { hata: 'olumsuz', uyari: 'bekleyen', basari: 'olumlu', bilgi: 'vurgu' };
    var b = YU.h('div', { sinif: 'yu-bildirim', metin: String(mesaj) });
    b.style.borderLeft = '3px solid ' + RENK_METIN[BILDIRIM_RENK[tur] || 'vurgu'];
    kap.appendChild(b);
    window.setTimeout(function () {
      b.style.transition = 'opacity .2s, transform .2s';
      b.style.opacity = '0';
      b.style.transform = 'translateY(6px)';
      window.setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 220);
    }, 4000);
    return b;
  };

  YU.ui.modal = function (s) {
    s = s || {};
    var oncekiOdak = document.activeElement;

    var govde = YU.h('div', { sinif: 'yu-modal-govde' });
    cocukEkle(govde, s.govde);

    var alt = null;
    if (s.dugmeler && s.dugmeler.length) {
      alt = YU.h('div', { sinif: 'yu-modal-alt' });
      for (var i = 0; i < s.dugmeler.length; i++) {
        (function (d) {
          alt.appendChild(YU.ui.dugme({
            metin: d.metin, ikon: d.ikon, tur: d.tur || 'ikincil',
            /* Eylemi olmayan düğme ("Kapat" gibi) pencereyi kapatır; aksi
               hâlde tıklanır ama hiçbir şey olmaz. */
            onClick: function () { if (d.onClick) d.onClick(); else kapat(); }
          }));
        })(s.dugmeler[i]);
      }
    }

    /* Başlık şeridi: solda ad ve alt satır, sağda geri düğmesi.
       Kapatma alt bardaki düğmede. */
    var bas = null;
    if (s.baslik || s.baslikAlt || s.geriDugmesi) {
      var basSol = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '3px', flex: '1', minWidth: '0' } },
        s.baslik ? YU.h('div', { metin: s.baslik }) : null,
        s.baslikAlt ? YU.h('div', { sinif: 'yu-yardim', metin: s.baslikAlt }) : null
      );
      var basSag = YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '6px', flex: 'none' } });
      if (s.geriDugmesi) {
        basSag.appendChild(YU.ui.dugme({
          metin: '← Geri', kucuk: true, tur: 'ikincil',
          baslik: 'Listeye dön', onClick: function () { kapat(); }
        }));
      }
      bas = YU.h('div', { sinif: 'yu-modal-bas' }, basSol, basSag);
    }

    var modal = YU.h('div', { sinif: 'yu-modal', role: 'dialog', 'aria-modal': 'true' },
      bas, govde, alt
    );
    if (s.genislik) modal.style.width = typeof s.genislik === 'number' ? s.genislik + 'px' : s.genislik;

    var perde = YU.h('div', {
      sinif: 'yu-perde',
      onMouseDown: function (e) { if (e.target === perde) kapat(); }
    }, modal);

    function odaklanabilirler() {
      return modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    }

    function tusIsle(e) {
      if (e.key === 'Escape') { e.preventDefault(); kapat(); return; }
      if (e.key !== 'Tab') return;
      var o = odaklanabilirler();
      if (!o.length) return;
      var ilk = o[0], son = o[o.length - 1];
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    }

    function kapat() {
      document.removeEventListener('keydown', tusIsle, true);
      if (perde.parentNode) perde.parentNode.removeChild(perde);
      if (oncekiOdak && oncekiOdak.focus) oncekiOdak.focus();
      if (s.onKapat) s.onKapat();
    }

    document.addEventListener('keydown', tusIsle, true);
    document.body.appendChild(perde);
    var ilkOdak = odaklanabilirler();
    if (ilkOdak.length) ilkOdak[0].focus();

    return { kapat: kapat, kok: perde, modal: modal };
  };

  YU.ui.onay = function (s) {
    s = s || {};
    return new Promise(function (coz) {
      var bitti = false;
      function sonuc(deger) {
        if (bitti) return;
        bitti = true;
        m.kapat();
        coz(deger);
      }
      var m = YU.ui.modal({
        baslik: s.baslik || 'Onay',
        genislik: s.genislik || 440,
        govde: YU.h('div', { metin: s.metin || '', stil: { font: '400 15px/1.6 var(--font)', color: 'var(--metin-3)' } }),
        dugmeler: [
          { metin: s.iptalMetni || 'Vazgeç', tur: 'sade', onClick: function () { sonuc(false); } },
          { metin: s.onayMetni || 'Onayla', tur: s.tehlike ? 'tehlike' : 'birincil', onClick: function () { sonuc(true); } }
        ],
        onKapat: function () { if (!bitti) { bitti = true; coz(false); } }
      });
    });
  };

  YU.ui.hataListesi = function (hatalar, tur) {
    if (!hatalar) return YU.h('div');
    if (!dizi(hatalar)) {
      var kapsayici = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '10px' } });
      if (hatalar.hatalar && hatalar.hatalar.length) kapsayici.appendChild(YU.ui.hataListesi(hatalar.hatalar, 'hata'));
      if (hatalar.uyarilar && hatalar.uyarilar.length) kapsayici.appendChild(YU.ui.hataListesi(hatalar.uyarilar, 'uyari'));
      return kapsayici;
    }
    if (!hatalar.length) return YU.h('div');
    var t = tur || 'hata';
    var liste = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' } });
    for (var i = 0; i < hatalar.length; i++) {
      var h = hatalar[i] || {};
      liste.appendChild(YU.h('div', { stil: { display: 'flex', gap: '9px', alignItems: 'baseline' } },
        YU.h('span', {
          metin: h.kod || '—',
          stil: { font: '500 13px/1.4 var(--mono)', color: RENK_METIN[t === 'hata' ? 'olumsuz' : 'bekleyen'], flex: 'none' }
        }),
        YU.h('span', { metin: h.mesaj || String(h), stil: { font: '400 14.5px/1.5 var(--font)', color: 'var(--metin-2)' } })
      ));
    }
    var baslik = t === 'hata'
      ? (hatalar.length === 1 ? 'Kayıt reddedildi' : hatalar.length + ' hata nedeniyle kayıt reddedildi')
      : (hatalar.length === 1 ? 'Uyarı' : hatalar.length + ' uyarı');
    var serit = YU.ui.serit({ tur: t, baslik: baslik });
    serit.querySelector('.yu-serit-govde').appendChild(liste);
    return serit;
  };

  /* Sayfa başlığının sağındaki eylem alanına düğme ekler (kabuk çizer, sayfa doldurur). */
  YU.ui.sayfaEylemleri = function () {
    if (!dom.eylemler) return null;
    for (var i = 0; i < arguments.length; i++) cocukEkle(dom.eylemler, arguments[i]);
    return dom.eylemler;
  };

  /* ==================================================================
     13. Grafikler — inline SVG, renkler CSS değişkeninden (tema uyumu)
     ================================================================== */

  /* Kategorik seri renkleri: her dilim ayrı hue taşır — tek mavi tonlaması
     dilimleri okunmaz kılıyordu. Sıra sabittir, dilim sayısı değişince
     hayatta kalan dilimlerin rengi kaymaz. */
  var SERI_RENK = ['var(--kat-1)', 'var(--kat-2)', 'var(--kat-3)', 'var(--kat-4)', 'var(--kat-5)', 'var(--kat-6)'];

  /* ------------------------------------------------------------------
     13.1 Grafik ipucu — belge gövdesine eklenen tek kutu.
     Derinlik koyu temada gölgeyle kurulamaz (CLAUDE.md KURAL 1); kenarlık
     taşır, --golge-2 zaten koyu temada "none" olduğu için güvenli.
     Kutu sayfa çizilirken kaldırılır: ekran değişince ortada kalmaz.
     ------------------------------------------------------------------ */

  var ipucu = null;

  function ipucuKutusu() {
    if (ipucu) return ipucu;
    ipucu = YU.h('div', {
      role: 'tooltip',
      stil: {
        position: 'fixed', left: '0', top: '0', zIndex: '90',
        pointerEvents: 'none', maxWidth: '280px',
        padding: '9px 11px', borderRadius: 'var(--r)',
        background: 'var(--yuzey)', border: '1px solid var(--kenar-3)',
        boxShadow: 'var(--golge-2)', display: 'none'
      }
    });
    document.body.appendChild(ipucu);
    return ipucu;
  }

  function ipucuKaldir() {
    if (ipucu && ipucu.parentNode) ipucu.parentNode.removeChild(ipucu);
    ipucu = null;
  }

  function ipucuGizle() { if (ipucu) ipucu.style.display = 'none'; }

  /* Kenara yakınsa ters tarafa açılır; kutu görünür alanın dışına taşmaz. */
  function ipucuKonumla(x, y) {
    if (!ipucu || ipucu.style.display === 'none') return;
    var bosluk = 14, pay = 8;
    var g = ipucu.offsetWidth, h = ipucu.offsetHeight;
    var ekranG = document.documentElement.clientWidth;
    var ekranY = document.documentElement.clientHeight;

    var sol = x + bosluk;
    if (sol + g > ekranG - pay) sol = x - bosluk - g;
    if (sol < pay) sol = pay;

    var ust = y + bosluk;
    if (ust + h > ekranY - pay) ust = y - bosluk - h;
    if (ust < pay) ust = pay;

    ipucu.style.left = Math.round(sol) + 'px';
    ipucu.style.top = Math.round(ust) + 'px';
  }

  function ipucuAc(icerik, x, y) {
    var kutu = ipucuKutusu();
    YU.bos(kutu);
    cocukEkle(kutu, icerik);
    kutu.style.display = 'block';
    ipucuKonumla(x, y);
  }

  function ipucuIcerik(baslik, satirlar, ek) {
    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    kap.appendChild(YU.h('div', {
      metin: baslik,
      stil: { font: '500 14px/1.2 var(--font)', color: 'var(--metin)', whiteSpace: 'nowrap' }
    }));
    for (var i = 0; i < satirlar.length; i++) {
      var r = satirlar[i];
      kap.appendChild(YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '9px', whiteSpace: 'nowrap' } },
        YU.h('span', { stil: { width: '8px', height: '8px', borderRadius: '2px', flex: 'none', background: r.renk } }),
        YU.h('span', { metin: r.ad, stil: { flex: '1', font: '400 13.5px/1.3 var(--font)', color: 'var(--metin-4)' } }),
        YU.h('span', {
          metin: r.deger,
          stil: { font: '600 13.5px/1.3 var(--sayi)', color: 'var(--metin)', fontVariantNumeric: 'tabular-nums' }
        })
      ));
    }
    if (ek) {
      kap.appendChild(YU.h('div', {
        metin: ek.metin,
        stil: {
          font: '600 13.5px/1.3 var(--sayi)', color: ek.renk || 'var(--metin-4)',
          borderTop: '1px solid var(--ayrac)', paddingTop: '6px',
          whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'
        }
      }));
    }
    return kap;
  }

  /* Veri öğesinde ISO tarih varsa GG.AA.YYYY yazılır; yoksa etikete düşülür.
     `tarih` alanı opsiyoneldir — eski çağıranlar olduğu gibi çalışır. */
  function ipucuBasligi(oge) {
    var t = (oge && oge.tarih) ? YU.fmt.tarih(oge.tarih) : null;
    if (t && t !== '—') return t;
    return String(oge && oge.etiket !== undefined && oge.etiket !== null ? oge.etiket : '');
  }

  function farkSatiri(a, b) {
    var d = YU.yuvarla((Number(a) || 0) - (Number(b) || 0));
    var isaret = d > 0 ? '+' : (d < 0 ? '-' : '');
    return {
      metin: 'Fark ' + isaret + YU.fmt.kgU(Math.abs(d)),
      renk: d > 0 ? 'var(--olumlu)' : (d < 0 ? 'var(--olumsuz)' : 'var(--metin-4)')
    };
  }

  /* Fare ve klavye aynı bilgiyi gösterir: odakta da ipucu açılır, vurgu kalkar. */
  function ipucuBagla(oge, vurgula, baslik, satirlar, ek, ariaMetin) {
    oge.setAttribute('aria-label', ariaMetin);
    oge.style.outline = 'none';

    function ac(x, y) {
      vurgula(true);
      ipucuAc(ipucuIcerik(baslik, satirlar, ek), x, y);
    }
    function kapa() {
      vurgula(false);
      ipucuGizle();
    }

    oge.addEventListener('mouseenter', function (e) { ac(e.clientX, e.clientY); });
    oge.addEventListener('mousemove', function (e) { ipucuKonumla(e.clientX, e.clientY); });
    oge.addEventListener('mouseleave', kapa);
    oge.addEventListener('focus', function () {
      var r = oge.getBoundingClientRect();
      ac(r.left + r.width / 2, r.top);
    });
    oge.addEventListener('blur', kapa);
  }

  /* Düz metinli mini ipucu: grafiklerdeki kutunun aynısını kullanır, içine
     tek satır metin koyar. Tablo satırı gibi tıklanabilir ama düğmeye
     benzemeyen ögelerde "ne olacağını" söylemek için. */
  var IPUCU_GECIKME = 100;   /* 0,1 sn — ipucu bekletmeden gelsin (kullanıcı isteği, 21.08.2026) */

  function metinIpucuBagla(oge, metin) {
    var zaman = null, sonX = 0, sonY = 0;

    function icerik() {
      return YU.h('div', {
        stil: { font: '400 14px/1.4 var(--font)', color: 'var(--metin-2)', whiteSpace: 'nowrap' },
        metin: metin
      });
    }
    function bekle(x, y) {
      sonX = x; sonY = y;
      if (zaman) return;
      zaman = setTimeout(function () {
        zaman = null;
        ipucuAc(icerik(), sonX, sonY);
      }, IPUCU_GECIKME);
    }
    function kapat() {
      if (zaman) { clearTimeout(zaman); zaman = null; }
      ipucuGizle();
    }

    oge.addEventListener('mouseenter', function (e) { bekle(e.clientX, e.clientY); });
    oge.addEventListener('mousemove', function (e) {
      sonX = e.clientX; sonY = e.clientY;
      ipucuKonumla(e.clientX, e.clientY);
    });
    oge.addEventListener('mouseleave', kapat);
    oge.addEventListener('click', kapat);
    oge.addEventListener('focus', function () {
      var r = oge.getBoundingClientRect();
      bekle(r.left + Math.min(r.width / 2, 160), r.top);
    });
    oge.addEventListener('blur', kapat);
  }

  /* Şerit vurgusu: sütun/çizgi grafiklerinde arkadaki bandı açıp kapatır. */
  function bantVurgu(bant) {
    return function (acik) { bant.setAttribute('opacity', acik ? '1' : '0'); };
  }

  /* Halka diliminde vurgu şerit değil kalınlıktır (r=38 + 15/2 halka içinde kalır). */
  function yayVurgu(yay) {
    return function (acik) { yay.setAttribute('stroke-width', acik ? 15 : 13); };
  }

  /* Sayfa kaydırılınca imleç altındaki kutu yerinde kalmasın. */
  window.addEventListener('scroll', ipucuGizle, true);

  /* Referanstaki border-radius:3px 3px 0 0 karşılığı — rect rx'i alt köşeleri de yuvarlar. */
  function ustYuvarlakYol(x, y, g, y2, r) {
    var yc = Math.min(r, g / 2, y2);
    if (y2 <= 0.2) return 'M' + x + ' ' + (y + y2) + ' L' + (x + g) + ' ' + (y + y2);
    return 'M' + x + ' ' + (y + y2) +
      ' L' + x + ' ' + (y + yc) +
      ' Q' + x + ' ' + y + ' ' + (x + yc) + ' ' + y +
      ' L' + (x + g - yc) + ' ' + y +
      ' Q' + (x + g) + ' ' + y + ' ' + (x + g) + ' ' + (y + yc) +
      ' L' + (x + g) + ' ' + (y + y2) + ' Z';
  }

  function efsaneSatiri(ogeler) {
    var kap = YU.h('div', {
      stil: { display: 'flex', gap: '14px', justifyContent: 'flex-end', font: '400 13.5px/1 var(--font)', color: 'var(--metin-4)' }
    });
    for (var i = 0; i < ogeler.length; i++) {
      kap.appendChild(YU.h('span', { stil: { display: 'flex', alignItems: 'center', gap: '6px' } },
        YU.h('span', { stil: { width: '8px', height: '8px', borderRadius: '2px', background: ogeler[i].renk, flex: 'none' } }),
        YU.h('span', { metin: ogeler[i].etiket })
      ));
    }
    return kap;
  }

  YU.ui.sutunGrafik = function (s) {
    s = s || {};
    var veri = s.veri || [];
    var H = s.yukseklik || 200;
    var cizimH = Math.max(40, H - 26);
    var renk1 = s.renk1 || 'var(--vurgu)';
    var renk2 = s.renk2 || 'var(--kenar-3)';
    var ikili = false, i;
    for (i = 0; i < veri.length; i++) if (veri[i] && veri[i].deger2 !== undefined && veri[i].deger2 !== null) { ikili = true; break; }

    var barG = 22, ikiliAra = 5, grupAra = 22;
    var grupG = ikili ? (barG * 2 + ikiliAra) : barG;
    var n = Math.max(1, veri.length);
    var W = n * grupG + (n - 1) * grupAra;

    /* Sütun grupları odaklanabilir olduğu için kök role="img" olamaz:
       role="img" alt ögeleri erişilebilirlik ağacından gizler. */
    var svg = svgOge('svg', {
      width: '100%', height: H, viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'group'
    });
    svg.style.display = 'block';

    /* Efsane metinleri seri adıdır; ipucu ve aria-label aynı adı kullanır. */
    var seriAd1 = 'Seri 1', seriAd2 = 'Seri 2';
    if (dizi(s.efsane) && s.efsane.length) {
      if (typeof s.efsane[0] === 'string') seriAd1 = s.efsane[0];
      else if (s.efsane[0] && s.efsane[0].etiket) seriAd1 = s.efsane[0].etiket;
      if (typeof s.efsane[1] === 'string') seriAd2 = s.efsane[1];
      else if (s.efsane[1] && s.efsane[1].etiket) seriAd2 = s.efsane[1].etiket;
    }

    var enBuyuk = 0;
    for (i = 0; i < veri.length; i++) {
      enBuyuk = Math.max(enBuyuk, Number(veri[i].deger1) || 0, Number(veri[i].deger2) || 0);
    }
    if (enBuyuk <= 0) enBuyuk = 1;

    for (i = 0; i < veri.length; i++) {
      var oge = veri[i] || {};
      var x = i * (grupG + grupAra);
      var d1 = Math.max(0, Number(oge.deger1) || 0);
      var h1 = (d1 / enBuyuk) * cizimH;

      var grup = svgOge('g', { tabindex: '0', role: 'img' });

      /* Grubun arkasındaki şerit: hangi güne bakıldığı belli olsun. */
      var bantSol = Math.max(0, x - grupAra / 2);
      var bantG = Math.min(W - bantSol, grupG + grupAra);
      var bant = svgOge('rect', {
        x: bantSol, y: 0, width: bantG, height: H, rx: 4,
        fill: 'var(--yuzey-3)', opacity: '0'
      });
      grup.appendChild(bant);

      grup.appendChild(svgOge('path', { d: ustYuvarlakYol(x, cizimH - h1, barG, h1, 3), fill: renk1 }));

      var d2 = 0;
      if (ikili) {
        d2 = Math.max(0, Number(oge.deger2) || 0);
        var h2 = (d2 / enBuyuk) * cizimH;
        grup.appendChild(svgOge('path', { d: ustYuvarlakYol(x + barG + ikiliAra, cizimH - h2, barG, h2, 3), fill: renk2 }));
      }

      var etiket = svgOge('text', {
        x: x + grupG / 2, y: cizimH + 16, 'text-anchor': 'middle',
        'font-size': '13', fill: 'var(--metin-5)'
      });
      etiket.textContent = oge.etiket === undefined ? '' : String(oge.etiket);
      grup.appendChild(etiket);

      /* En üstteki saydam dikdörtgen: sütunlar arasındaki boşlukta da grup bulunur. */
      grup.appendChild(svgOge('rect', { x: bantSol, y: 0, width: bantG, height: H, fill: 'transparent' }));

      var baslik = ipucuBasligi(oge);
      var satirlar = [{ renk: renk1, ad: seriAd1, deger: YU.fmt.kgU(d1) }];
      if (ikili) satirlar.push({ renk: renk2, ad: seriAd2, deger: YU.fmt.kgU(d2) });
      var aria = baslik + ' · ' + seriAd1 + ' ' + YU.fmt.kgU(d1) +
        (ikili ? ' · ' + seriAd2 + ' ' + YU.fmt.kgU(d2) : '');

      ipucuBagla(grup, bantVurgu(bant), baslik, satirlar, ikili ? farkSatiri(d1, d2) : null, aria);
      svg.appendChild(grup);
    }
    /* Taban çizgisi grupların üstünde durur; imleci çalmasın diye olay almaz. */
    svg.appendChild(svgOge('line', {
      x1: 0, y1: cizimH, x2: W, y2: cizimH,
      stroke: 'var(--ayrac)', 'stroke-width': 1, 'pointer-events': 'none'
    }));

    if (!s.efsane) return svg;
    var ogeler = dizi(s.efsane)
      ? (typeof s.efsane[0] === 'string'
        ? [{ etiket: s.efsane[0], renk: renk1 }].concat(s.efsane[1] ? [{ etiket: s.efsane[1], renk: renk2 }] : [])
        : s.efsane)
      : [{ etiket: 'Seri 1', renk: renk1 }].concat(ikili ? [{ etiket: 'Seri 2', renk: renk2 }] : []);
    return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px' } }, efsaneSatiri(ogeler), svg);
  };

  YU.ui.cizgiGrafik = function (s) {
    s = s || {};
    var veri = s.veri || [];
    var H = s.yukseklik || 150;
    var W = 400, i;

    var svg = svgOge('svg', {
      width: '100%', height: H, viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'none', role: 'group'
    });
    svg.style.display = 'block';

    if (veri.length < 2) {
      var kapBos = YU.h('div', {
        metin: 'Grafik için en az iki gün gerekiyor.',
        stil: { font: '400 14px/1.5 var(--font)', color: 'var(--metin-4)', padding: '24px 0', textAlign: 'center' }
      });
      return kapBos;
    }

    var enB = -Infinity, enK = Infinity;
    for (i = 0; i < veri.length; i++) {
      var d = Number(veri[i].deger) || 0;
      if (d > enB) enB = d;
      if (d < enK) enK = d;
    }
    var taban = Math.min(0, enK), tavan = enB;
    if (tavan === taban) tavan = taban + 1;

    var ustBosluk = 8, altBosluk = 6;
    var noktalar = [];
    for (i = 0; i < veri.length; i++) {
      var x = (i / (veri.length - 1)) * W;
      var oran = ((Number(veri[i].deger) || 0) - taban) / (tavan - taban);
      var y = H - altBosluk - oran * (H - ustBosluk - altBosluk);
      noktalar.push([x, y]);
    }

    var alanYol = 'M' + noktalar[0][0] + ' ' + noktalar[0][1];
    var cizgi = noktalar[0][0] + ',' + noktalar[0][1];
    for (i = 1; i < noktalar.length; i++) {
      alanYol += ' L' + noktalar[i][0] + ' ' + noktalar[i][1];
      cizgi += ' ' + noktalar[i][0] + ',' + noktalar[i][1];
    }
    alanYol += ' L' + W + ' ' + H + ' L0 ' + H + ' Z';

    /* Vurgu şeritleri alanın altında, yakalama dikdörtgenleri en üstte kalır. */
    var bantKat = svgOge('g', {});
    svg.appendChild(bantKat);

    svg.appendChild(svgOge('path', { d: alanYol, fill: 'var(--vurgu-zemin)', 'pointer-events': 'none' }));
    svg.appendChild(svgOge('polyline', {
      points: cizgi, fill: 'none', stroke: 'var(--vurgu)', 'stroke-width': 2.2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke',
      'pointer-events': 'none'
    }));

    var seriAd = s.seriAd || 'Değer';
    var yakalaKat = svgOge('g', {});
    svg.appendChild(yakalaKat);

    for (i = 0; i < veri.length; i++) {
      var ogeC = veri[i] || {};
      var xi = noktalar[i][0];
      var solC = i === 0 ? 0 : (noktalar[i - 1][0] + xi) / 2;
      var sagC = i === veri.length - 1 ? W : (noktalar[i + 1][0] + xi) / 2;
      var genC = Math.max(0.5, sagC - solC);

      var bantC = svgOge('rect', { x: solC, y: 0, width: genC, height: H, fill: 'var(--yuzey-3)', opacity: '0' });
      bantKat.appendChild(bantC);

      var yakalaC = svgOge('rect', { x: solC, y: 0, width: genC, height: H, fill: 'transparent', tabindex: '0', role: 'img' });
      yakalaKat.appendChild(yakalaC);

      var baslikC = ipucuBasligi(ogeC);
      var degerC = Number(ogeC.deger) || 0;
      ipucuBagla(
        yakalaC, bantVurgu(bantC), baslikC,
        [{ renk: 'var(--vurgu)', ad: seriAd, deger: YU.fmt.kgU(degerC) }],
        null,
        baslikC + ' · ' + seriAd + ' ' + YU.fmt.kgU(degerC)
      );
    }

    /* Etiketler SVG dışında: preserveAspectRatio="none" metni de yamultur. */
    var etiketler = YU.h('div', {
      stil: { display: 'flex', justifyContent: 'space-between', font: '400 13px/1 var(--font)', color: 'var(--metin-5)', marginTop: '8px' }
    });
    var adim = Math.max(1, Math.ceil(veri.length / 7));
    for (i = 0; i < veri.length; i += adim) {
      etiketler.appendChild(YU.h('span', { metin: String(veri[i].etiket === undefined ? '' : veri[i].etiket) }));
    }
    if ((veri.length - 1) % adim !== 0) {
      etiketler.appendChild(YU.h('span', { metin: String(veri[veri.length - 1].etiket === undefined ? '' : veri[veri.length - 1].etiket) }));
    }

    return YU.h('div', null, svg, etiketler);
  };

  YU.ui.halkaGrafik = function (s) {
    s = s || {};
    var dilimler = s.dilimler || [];
    var boyut = s.boyut || 118;
    var svg = svgOge('svg', { width: boyut, height: boyut, viewBox: '0 0 100 100', role: 'group' });
    svg.style.flex = 'none';
    svg.style.transform = 'rotate(-90deg)';

    svg.appendChild(svgOge('circle', {
      cx: 50, cy: 50, r: 38, fill: 'none', stroke: 'var(--ayrac)',
      'stroke-width': 13, 'pointer-events': 'none'
    }));

    var toplam = 0, i;
    for (i = 0; i < dilimler.length; i++) toplam += Math.max(0, Number(dilimler[i].deger) || 0);
    if (toplam <= 0) return svg;

    var kaydirma = 0;
    for (i = 0; i < dilimler.length; i++) {
      var dilim = dilimler[i] || {};
      var deger = Math.max(0, Number(dilim.deger) || 0);
      var pay = (deger / toplam) * 100;
      if (pay <= 0) continue;
      var renk = dilim.renk || SERI_RENK[i % SERI_RENK.length];
      var yay = svgOge('circle', {
        cx: 50, cy: 50, r: 38, fill: 'none', stroke: renk,
        'stroke-width': 13, pathLength: 100,
        'stroke-dasharray': pay.toFixed(3) + ' ' + (100 - pay).toFixed(3),
        'stroke-dashoffset': (-kaydirma).toFixed(3),
        tabindex: '0', role: 'img'
      });
      var dilimAd = String(dilim.etiket === undefined || dilim.etiket === null ? '' : dilim.etiket);
      ipucuBagla(
        yay, yayVurgu(yay), dilimAd,
        [{ renk: renk, ad: 'Miktar', deger: YU.fmt.kgU(deger) }],
        { metin: 'Pay ' + YU.fmt.yuzde(pay) },
        dilimAd + ' · ' + YU.fmt.kgU(deger) + ' · ' + YU.fmt.yuzde(pay)
      );
      svg.appendChild(yay);
      kaydirma += pay;
    }
    return svg;
  };

  YU.ui.seriRenk = function (i) { return SERI_RENK[i % SERI_RENK.length]; };

  /* ==================================================================
     14. Gün penceresi
     Bir günün verisine listeden tıklanınca tam sayfaya gitmek yerine küçük
     pencere açılıyor: kullanıcı bulunduğu listeden kopmuyor.
     ================================================================== */

  var HAREKET_ADI = {
    DokmeUretim: 'Dökme üretim', Cuvallama: 'Çuvallama',
    DokmeSatis: 'Dökme satış', Manuel: 'Manuel'
  };
  var HAREKET_RENGI = {
    DokmeUretim: 'olumlu', Cuvallama: 'notr', DokmeSatis: 'vurgu', Manuel: 'bekleyen'
  };

  function gunBolumu(baslik, sag, icerik) {
    return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '9px' } },
      YU.h('div', {
        stil: {
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px',
          font: '600 13.5px/1.2 var(--font)', color: 'var(--metin-3)',
          letterSpacing: '.05em', textTransform: 'uppercase',
          paddingBottom: '7px', borderBottom: '1px solid var(--ayrac)'
        }
      },
        YU.h('span', { metin: baslik }),
        sag ? YU.h('span', { sinif: 'yu-yardim', stil: { textTransform: 'none', letterSpacing: '0' }, metin: sag }) : null
      ),
      icerik
    );
  }

  function gunKalemi(etiket, deger, tur) {
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '14px', padding: '6px 0' }
    },
      YU.h('span', { metin: etiket, stil: { font: '400 14px/1.3 var(--font)', color: 'var(--metin-4)' } }),
      YU.h('span', {
        sinif: 'yu-mono',
        metin: deger,
        stil: { font: '500 14.5px/1 var(--sayi)', color: tur ? 'var(--' + tur + ')' : '' }
      })
    );
  }

  YU.gunPenceresi = function (tarih) {
    var ozet = YU.stok.gunOzeti(YU.db, tarih);
    var h = ozet.hesap;
    var kayitVar = !!ozet.kuruKuspe;
    var bolumler = [];

    /* Kuru küspe — Şartname §4: ham girdi net üretim 0 olsa bile ayrı durur. */
    if (kayitVar) {
      bolumler.push(gunBolumu('Kuru küspe', h.durum === 'B' ? 'Durum B' : 'Durum A',
        YU.h('div', { stil: { display: 'flex', flexDirection: 'column' } },
          gunKalemi('Üretilen dökme (ham girdi)', YU.fmt.kgU(h.hamUretilenDokme)),
          gunKalemi('Çuvallanan adet', YU.fmt.sayi(ozet.kuruKuspe.CuvalAdet) + ' adet'),
          gunKalemi('Çuval karşılığı', YU.fmt.kgU(h.cuvalKg)),
          gunKalemi('Net dökme üretim', YU.fmt.kgU(h.netDokmeUretim), h.netDokmeUretim > 0 ? 'olumlu' : null),
          gunKalemi('Silodan çekilen (çuvallama)', YU.fmt.kgU(h.silodanCekilecek), h.silodanCekilecek > 0 ? 'bekleyen' : null),
          gunKalemi('Satılan dökme', YU.fmt.kgU(h.satilanDokme), h.satilanDokme > 0 ? 'bekleyen' : null),
          gunKalemi('Silo net değişimi',
            (h.siloNetDegisim > 0 ? '+' : '') + YU.fmt.kgU(h.siloNetDegisim),
            h.siloNetDegisim > 0 ? 'olumlu' : (h.siloNetDegisim < 0 ? 'olumsuz' : null))
        )
      ));
    }

    /* Malzeme hareketleri */
    if (ozet.malzemeSatirlari.length) {
      var mSatirlar = ozet.malzemeSatirlari.map(function (s) {
        return [
          YU.h('span', { metin: s.malzeme ? s.malzeme.Ad : '—' }),
          YU.h('span', { sinif: 'yu-mono', metin: YU.fmt.kg(s.uretim) }),
          YU.h('span', { sinif: 'yu-mono', metin: YU.fmt.kg(s.satis) })
        ];
      });
      bolumler.push(gunBolumu('Malzeme hareketleri', ozet.malzemeSatirlari.length + ' satır',
        YU.ui.tablo({
          sutunlar: [{ baslik: 'Malzeme' }, { baslik: 'Üretim', hiza: 'sag', genislik: 120 }, { baslik: 'Satış', hiza: 'sag', genislik: 120 }],
          satirlar: mSatirlar, kompakt: true, sik: false
        })
      ));
    }

    /* Silo hareketleri */
    if (ozet.siloHareketleri.length) {
      var sSatirlar = ozet.siloHareketleri.map(function (s) {
        var hr = s.hareket;
        return [
          YU.h('span', { metin: s.silo ? s.silo.Ad : '—' }),
          YU.ui.rozet(HAREKET_ADI[hr.HareketTipi] || hr.HareketTipi, HAREKET_RENGI[hr.HareketTipi] || 'notr'),
          YU.h('span', { sinif: 'yu-mono', metin: Number(hr.GirenKg) > 0 ? YU.fmt.kg(hr.GirenKg) : '—' }),
          YU.h('span', { sinif: 'yu-mono', metin: Number(hr.CikanKg) > 0 ? YU.fmt.kg(hr.CikanKg) : '—' })
        ];
      });
      bolumler.push(gunBolumu('Silo hareketleri', ozet.siloHareketleri.length + ' hareket',
        YU.ui.tablo({
          sutunlar: [
            { baslik: 'Silo', genislik: 110 }, { baslik: 'Hareket', genislik: 140 },
            { baslik: 'Giren', hiza: 'sag', genislik: 110 }, { baslik: 'Çıkan', hiza: 'sag', genislik: 110 }
          ],
          satirlar: sSatirlar, kompakt: true, sik: false
        })
      ));
    }

    if (!bolumler.length) {
      bolumler.push(YU.h('div', {
        sinif: 'yu-bos-metin',
        metin: 'Bu gün için kayıt yok.',
        stil: { padding: '18px 0' }
      }));
    }

    var govde = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '20px' } });
    for (var i = 0; i < bolumler.length; i++) govde.appendChild(bolumler[i]);

    var pencere = YU.ui.modal({
      baslik: 'Günün Verisi',
      baslikAlt: YU.fmt.tarih(tarih) + ' · ' + YU.fmt.gunAdi(tarih),
      geriDugmesi: true,
      govde: govde,
      genislik: 640,
      dugmeler: [
        { metin: 'Tam raporu aç', ikon: '#ic-doc', tur: 'sade',
          onClick: function () { pencere.kapat(); YU.git('gunluk-rapor', { tarih: tarih }); } },
        { metin: 'Kapat', tur: 'ikincil', onClick: function () { pencere.kapat(); } }
      ]
    });
    return pencere;
  };

})();

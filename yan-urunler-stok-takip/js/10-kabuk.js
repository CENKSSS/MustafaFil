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
  /* 'Takip' grubunun adı 31.08.2026'da "Raporlar" -> "Özet ve Geçmiş" oldu
     (kullanıcı isteği: "raporlar adı güzel değil"). İçindeki iki sayfa
     Aylık Özet ve Geçmiş İşlemler; ad ikisini de söylüyor. Sayfaların
     'grup' anahtarı ('Takip') DEĞİŞMEDİ, yalnız görünen ad farklı. */
  var GRUP_BASLIK = { 'Giriş': 'Günlük İşlemler', 'Takip': 'Özet ve Geçmiş', 'Yönetim': 'Yönetim Paneli' };
  var MENU_USTU = 'anasayfa';           /* §7: ana sayfa gruplardan önce tek başına durur */

  /* Açılır-kapanır menü grupları (kullanıcı isteği, 31.08.2026). Anahtarlar
     sayfaların 'grup' değerleridir.

     'Giriş' (Veri Girişi) LİSTEDE YOKTUR: aynı gün önce eklendi, sonra
     kullanıcı "veri girişi hep açık kalacak" dedi. Başlığı düz metindir,
     + / − işareti almaz, sayfaları her zaman görünür. */
  var KATLANIR = { 'Takip': true, 'Yönetim': true };
  var MENU_ACIK_ANAHTAR = 'yu.menu.acik';

  /* GİRİŞ KENDİ ADRESİNDE (kullanıcı kararı, 26.08.2026). Eskiden giriş
     ekranı, o an hangi rota açıksa onun ÜSTÜNE perde gibi çiziliyordu; adres
     çubuğunda "#/anasayfa" yazarken ekranda giriş formu duruyordu. Artık
     oturum yokken her yol '#/giris'e düşer, giriş yapılınca gidilmek istenen
     sayfaya dönülür.

     NOT — bu bir GÜVENLİK sınırı değildir: program arka uçsuzdur, yetkiyi
     YU.oturum ve rol denetimi taşır (Şartname Test 7) ve o değişmedi. Buradaki
     kazanç adresin dürüst olması ve geri/ileri tuşlarının doğru çalışmasıdır.
     Hesap açma yine yalnız yöneticidedir (Şartname §3 Demirbaş); '#/giris'
     yalnız giriş ve ilk parola kurma ekranıdır, kayıt sayfası değildir. */
  var GIRIS_KODU = 'giris';
  var girisSonrasiHedef = null;         /* giriş öncesi gidilmek istenen yol */
  var UYGULAMA_ADI = 'Yan Ürünler Stok Takip';   /* sekme başlığının yedeği (giriş ekranı) */
  /* Rapor künyesinin en üst satırı (kullanıcı isteği, 26.08.2026). Kurum adı
     değişirse tek yerden değişir. */
  var KURUM_ADI = 'Doğuş Afyon Şeker Fabrikası';
  var TEMA_ANAHTAR = 'yu.tema';
  var OTURUM_ANAHTAR = 'yu.oturum';
  /* "Beni Hatırla" kutusunun SON DURUMU (31.08.2026) — oturumun kendisi değil,
     yalnız kutunun bir sonraki açılışta işaretli gelip gelmeyeceği. Varsayılan
     KAPALI: fabrikada makine paylaşılıyor, hatırlamayı kişi kendisi seçer. */
  var HATIRLA_ANAHTAR = 'yu.hatirla';
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

  /* SEKME ÖMÜRLÜ DEPO — "Beni Hatırla" işaretlenmediğinde oturumun yazıldığı
     yer (kullanıcı isteği, 31.08.2026). sessionStorage sekme kapanınca kendisi
     silinir; localStorage silinmez. Tema ve dönem tercihleri bu ayrımın
     dışındadır, onlar her zaman localStorage'da kalır. */
  function seansYaz(anahtar, deger) { try { sessionStorage.setItem(anahtar, deger); } catch (e) { /* özel mod */ } }
  function seansOku(anahtar) { try { return sessionStorage.getItem(anahtar); } catch (e) { return null; } }
  function seansSil(anahtar) { try { sessionStorage.removeItem(anahtar); } catch (e) { /* yoksay */ } }

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

  /* Arama BÜYÜK/KÜÇÜK HARF AYIRMAZ (26.08.2026): giriş kimliği e-posta;
     kullanıcı "Ahmet@..." yazınca da hesabını bulsun. */
  function kullaniciBul(kullaniciAdi) {
    var liste = (YU.db && YU.db.kullanicilar) || [];
    var ara = YU.ePosta.duzelt(kullaniciAdi);
    if (!ara) return null;
    for (var i = 0; i < liste.length; i++) {
      if (YU.ePosta.duzelt(liste[i].KullaniciAdi) === ara) return liste[i];
    }
    return null;
  }

  function kullaniciIdBul(id) {
    var liste = (YU.db && YU.db.kullanicilar) || [];
    for (var i = 0; i < liste.length; i++) if (liste[i].Id === id) return liste[i];
    return null;
  }

  /* Oturumda satırın tamamı değil KİMLİĞİ saklanır: rol depoda değişirse bir
     sonraki açılışta güncel rol okunur, eskimiş kopya yetki vermez.

     Id de yazılır (26.08.2026): eskiden yalnız KullaniciAdi vardı ve kişi
     kendi kullanıcı adını değiştirince bir sonraki açılışta satır bulunamayıp
     dışarı atılıyordu. Ad okunabilirlik ve eski oturumlarla uyum için durur. */
  /* BENİ HATIRLA (kullanıcı isteği, 31.08.2026: "bu buton aktif olursa her
     açılışta loginleşmiş olsun").

     İşaretliyse oturum localStorage'a yazılır — tarayıcı kapanıp açılsa da
     kişi içeride başlar. İşaretli değilse sessionStorage'a yazılır: sekme
     kapanınca oturum kendiliğinden düşer. İki depo aynı anda dolu kalmasın
     diye her yazma öbürünü siler; yoksa "hatırlama" kapatıldıktan sonra eski
     localStorage kaydı geri giriş yaptırırdı. */
  YU.oturumAc = function (kullanici, hatirla) {
    if (!kullanici) return;
    YU.oturum.kullanici = kullanici;
    var paket = JSON.stringify({ Id: kullanici.Id, KullaniciAdi: kullanici.KullaniciAdi });
    if (hatirla) { seansSil(OTURUM_ANAHTAR); yaz(OTURUM_ANAHTAR, paket); }
    else { sil(OTURUM_ANAHTAR); seansYaz(OTURUM_ANAHTAR, paket); }
  };

  /* Kayıtlı oturum silinir, giriş perdesine dönülür (SOZLESME §8). Giriş
     26.08.2026'dan beri kullanıcı adı + parola istediği için "başka hesapla
     devam et" de buradan geçer. */
  YU.oturumKapat = function () {
    /* Oturum kapatmak da bir ÇIKIŞTIR (kullanıcı bildirimi, 26.08.2026):
       menü bağlantıları çıkış kilidine takılıyordu ama "Çıkış Yap" ve
       "Hesap Değiştir" doğrudan buraya geldiği için kilit hiç görülmüyordu;
       kaydedilmemiş satırlar sessizce kayboluyordu. */
    cikistaOnay(function () {
      YU.oturum.kullanici = null;
      sil(OTURUM_ANAHTAR);
      seansSil(OTURUM_ANAHTAR);
      girisSonrasiHedef = null;
      /* Adres de giriş sayfasına döner; ciz() zaten oturumsuzluğu görüp
         giriş ekranını çizer. Aynı adresteysek doğrudan çizilir. */
      YU.git(GIRIS_KODU);
    });
  };

  YU.oturumYukle = function () {
    /* Önce kalıcı depo ("Beni Hatırla" işaretliydi), sonra sekme ömürlü depo.
       Tazeleme, oturumun BULUNDUĞU depoya geri yazılır; yoksa hatırlanmayan
       bir oturum sessizce kalıcıya terfi ederdi. */
    var hatirlanan = true;
    var ham = oku(OTURUM_ANAHTAR);
    if (!ham) { ham = seansOku(OTURUM_ANAHTAR); hatirlanan = false; }
    if (!ham) return null;
    var k = null;
    try { k = JSON.parse(ham); } catch (e) { k = null; }
    /* Önce Id; bulunamazsa kullanıcı adı — eski biçimde yazılmış oturumlar
       da açılabilsin. */
    var satir = null;
    if (k && k.Id !== undefined && k.Id !== null) satir = kullaniciIdBul(k.Id);
    if (!satir && k && k.KullaniciAdi) satir = kullaniciBul(k.KullaniciAdi);
    if (satir && satir.Aktif !== false) {
      YU.oturum.kullanici = satir;
      /* Ad değişmişse kayıtlı oturum tazelenir. */
      if (!k || k.Id !== satir.Id || k.KullaniciAdi !== satir.KullaniciAdi) {
        var paket = JSON.stringify({ Id: satir.Id, KullaniciAdi: satir.KullaniciAdi });
        if (hatirlanan) yaz(OTURUM_ANAHTAR, paket); else seansYaz(OTURUM_ANAHTAR, paket);
      }
      return satir;
    }
    sil(OTURUM_ANAHTAR);
    seansSil(OTURUM_ANAHTAR);
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

  /* Bağlantıların gerçek href alabilmesi için (kullanıcı isteği, 24.08.2026):
     href="#" verilen bağlantılar orta tuşla yeni sekmede anasayfayı açıyordu.
     YU.adres(kod, param) o sayfanın adresini üretir. */
  YU.adres = function (kod, param) { return hashKur(kod, param); };

  YU.param = function () { return aktif.param || {}; };

  YU.yenile = function () { ciz(); };

  /* Gece yarısı (İstanbul) geçilince ekran kendiliğinden tazelenir (kullanıcı
     isteği, 26.08.2026): program açık bırakılınca "bugün" dünde kalmasın —
     Geçmiş İşlemler yeni günü, raporlar yeni tarihi göstersin.

     Form doldurulurken ya da bir pencere açıkken ÇİZİLMEZ: yazılan kaybolmasın.
     Gün yoklaması 20 saniyede bir sürdüğü için ilk uygun anda tazelenir; o ana
     kadar da yalnız bir kez haber verilir. */
  var gunTazelemeBekliyor = false;

  function gunTazelemeGuvenli() {
    if (document.querySelector('.yu-perde, .yu-modal')) return false;
    var e = document.activeElement;
    if (!e) return true;
    var ad = (e.tagName || '').toLowerCase();
    return !(ad === 'input' || ad === 'textarea' || ad === 'select' || e.isContentEditable);
  }

  function gunTazele(yeniGun) {
    if (!gunTazelemeGuvenli()) { gunTazelemeBekliyor = true; return; }
    gunTazelemeBekliyor = false;
    donemOnbellek = null;
    ciz();
    if (yeniGun && YU.ui && YU.ui.bildir) {
      YU.ui.bildir('Yeni gün başladı: ' + YU.fmt.tarih(yeniGun) + '. Ekran tazelendi.', 'bilgi');
    }
  }

  YU.zaman.gunDegisince(function (yeniGun) {
    if (!YU.oturum || !YU.oturum.kullanici) { gunTazelemeBekliyor = true; return; }
    gunTazele(yeniGun);
  });

  /* Bekleyen tazeleme, kullanıcı formdan çıkınca kendiliğinden yapılır. */
  setInterval(function () {
    if (!gunTazelemeBekliyor) return;
    if (!YU.oturum || !YU.oturum.kullanici) return;
    gunTazele(YU.tarih.bugun());
  }, 20000);

  /* SERT çıkış kilidi (Devir Stok, kullanıcı isteği 27.08.2026): adres
     değişimi — geri/ileri tuşu, marka bloğu, YU.git — sayfa çizilmeden ÖNCE
     sorulur; vazgeçilirse adres geri alınır ve ekran hiç bozulmaz. Yalnız
     kilidi 'sert' kuran ekran etkilenir; bağlantı tıklamaları zaten
     cikisBagDenetimi'nden geçer, sekme kapatmayı beforeunload karşılar. */
  var hashGeriAliniyor = false;
  var korunanHash = location.hash;
  window.addEventListener('hashchange', function () {
    if (hashGeriAliniyor) { hashGeriAliniyor = false; return; }
    if (cikisKilidiAcik && cikisKilidiSert && location.hash !== korunanHash) {
      var hedef = location.hash;
      hashGeriAliniyor = true;
      location.hash = korunanHash;
      cikistaOnay(function () { location.hash = hedef; });
      return;
    }
    korunanHash = location.hash;
    ciz();
  });

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

    /* Gruplama ve AD servisten okunur (04-servis · kampanyaGruplari): kampanya
       adı artık tarihten değil, kullanıcının yazdığı başlıktan gelir
       (31.08.2026) ve kural tek yerde durur. Servis yoksa (tek dosya testi)
       eski sezon adlandırması devreye girer. */
    var gruplar = [];
    var kaynak = (YU.servis && YU.servis.kampanyaGruplari) ? YU.servis.kampanyaGruplari(db) : null;
    if (kaynak) {
      for (i = 0; i < kaynak.length; i++) gruplar.push({ ad: kaynak[i].ad, bas: kaynak[i].bas });
    } else {
      for (i = 0; i < liste.length; i++) {
        var ad = kampanyaAdi(liste[i]);
        var son = gruplar.length ? gruplar[gruplar.length - 1] : null;
        if (son && son.ad === ad) { if (liste[i] < son.bas) son.bas = liste[i]; }
        else gruplar.push({ ad: ad, bas: liste[i] });
      }
    }
    if (!gruplar.length) return [];

    /* Kampanya, kayıt girilmeyi bıraktığı gün BİTMEZ — yeni kampanya
       açılana kadar sürer (kullanıcı kararı, 25.08.2026 — M33). Bu yüzden
       iki ayrı alan tutulur:
         bit       = DÖNEM sonu — sonraki kampanyanın başından bir gün önce;
                     sonraki yoksa bugün (kampanya sürüyor).
         sonKayit  = son KAYITLI gün — rapor varsayılan tarihi, kampanya gün
                     sırası ve "eksik gün" taraması buna dayanır; boş dönemde
                     dönem başına düşer.
       Etiketlerde bit, veri okumalarında sonKayit kullanılır. */
    var kayitlar = kayitTarihleri();
    var bugunIso = YU.tarih.bugun();
    for (i = 0; i < gruplar.length; i++) {
      var sinir = (i + 1 < gruplar.length) ? gruplar[i + 1].bas : null;
      var sonKayit = gruplar[i].bas, sayac = 0;
      for (var j = 0; j < kayitlar.length; j++) {
        if (kayitlar[j] < gruplar[i].bas) continue;
        if (sinir && kayitlar[j] >= sinir) break;
        sonKayit = kayitlar[j];
        sayac++;
      }
      gruplar[i].sonKayit = sonKayit;
      gruplar[i].bit = sinir ? YU.tarih.ekle(sinir, -1) : (bugunIso > gruplar[i].bas ? bugunIso : gruplar[i].bas);
      gruplar[i].suruyor = !sinir;   /* en yeni kampanya: "devam ediyor" */
      gruplar[i].kayitliGun = sayac;
    }
    return gruplar;
  }

  var donemOnbellek = null;

  function donemler() {
    if (!donemOnbellek) donemOnbellek = donemListesi();
    return donemOnbellek;
  }

  /* KAMPANYA SEÇİMİ KALDIRILDI (kullanıcı kararı, 01.09.2026):
     "kampanyalar seçilemesin ve seçili kampanyaların verileri anasayfada vs
     görme olayını kaldır — zaten eski kayıtlara erişebiliyoruz anasayfadan."

     Bakış artık HER ZAMAN en yeni kampanyadır. Bunun üç sonucu var ve üçü de
     kendiliğinden gelir, çağıran dosyalarda tek satır değişmez:
       · gorunumSonu() hep bugüne döner — ekranlar bugünün verisini gösterir,
       · gecmisMi() hep false — "geçmiş kampanyaya bakıyorsunuz" şeridi çizilmez,
       · kaydedilmiş seçim (yu.donem) okunmaz; eski kurulumda kalmışsa yok sayılır.
     Geçmiş veriye erişim kaybolmaz: her ekran kendi TARİH kutusuyla istenen
     güne gider.

     GERİ ALMAK İÇİN: aşağıdaki iki satırın yorumunu kaldır, sabit dönüşü sil. */
  function donemAktif() {
    var l = donemler();
    if (!l.length) return null;
    /* var secili = oku(DONEM_ANAHTAR);
       for (var i = 0; i < l.length; i++) if (l[i].ad === secili) return l[i]; */
    return l[l.length - 1];
  }

  YU.donem = {
    liste: function () { return donemler(); },
    aktif: function () { return donemAktif(); },
    /* Seçim kalktığı için bu işlev artık hiçbir şey seçmez; yalnız ekranı
       tazeler. Çağıranlar kırılmasın diye duruyor (01.09.2026). */
    ayarla: function () {
      donemBaslikTazele();
      YU.yenile();
      return donemAktif();
    },
    tazele: function () { donemOnbellek = null; donemBaslikTazele(); },

    /* Seçili kampanyanın "görünüm sonu" (kullanıcı isteği, 24.08.2026):
       aktif (en yeni) kampanyada bugün, geçmiş kampanyada kampanyanın son
       kayıtlı günü. Rapor ekranlarının varsayılan tarihi ve ileri gezinme
       kelepçesi buradan okunur — kampanya seçilince veriler o kampanyanın
       bakışıyla gelir. */
    gorunumSonu: function () {
      var l = donemler();
      var d = donemAktif();
      if (!d || !l.length) return YU.tarih.bugun();
      /* M33: geçmiş kampanyada VERİ olan son güne düşülür (dönem sonuna
         değil — dönem sonu artık boş bir gün olabilir). */
      return l[l.length - 1].ad === d.ad ? YU.tarih.bugun() : d.sonKayit;
    },

    /* Seçili kampanya geçmiş bir kampanya mı (en yeni değil mi)? */
    gecmisMi: function () {
      var l = donemler();
      var d = donemAktif();
      return !!(d && l.length && l[l.length - 1].ad !== d.ad);
    }
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
    /* "BUGÜNÜN GİRİŞİ YOK" uyarısı KALDIRILDI (kullanıcı kararı, 26.08.2026):
       gün bitmeden girilmemiş olması normal, uyarı her sabah kendiliğinden
       çıkıp gereksiz yer kaplıyordu. Kampanya kilidi ve dönem sınırı
       denetimleri aşağıda duruyor.
       "Kampanya Aralığının Dışındasınız" uyarısı, seçili dönem kilitliyken
       (ya da bugün dönem başlamadan önceyken) görünmeye devam eder. */
    function kilitliMi(d2) {
      return !!(d2 && YU.servis && YU.servis.kampanyaKilitDurumu &&
                YU.servis.kampanyaKilitDurumu(db, d2.ad));
    }
    var donem = donemAktif();

    /* Saat kaynağı internet (YU.zaman · 26.08.2026). Eşitleme tuttuysa
       makinenin saati de ölçülmüş olur: iki dakikadan fazla sapıyorsa haber
       verilir. Kayıtlar zaten internet saatiyle damgalanır — uyarı, ekrandaki
       Windows saatine bakan kullanıcıyı yanıltmamak içindir. Eşitleme
       tutmadıysa (fabrika ağı internete kapalı) sessiz kalınır. */
    var zd = YU.zaman.durum();
    if (zd.kaynak === 'internet' && Math.abs(zd.kayma) > 120000) {
      u.push({
        tur: 'notr', ikon: '#ic-alert',
        baslik: 'Bilgisayar Saati Kaymış',
        metin: 'Bu bilgisayarın saati internet saatinden ' +
          YU.fmt.sayi(Math.round(Math.abs(zd.kayma) / 60000)) + ' dakika ' +
          (zd.kayma > 0 ? 'geride' : 'ileride') + '. Kayıtlar internet saatiyle (' +
          YU.zaman.saat() + ') damgalanıyor; Windows saatini düzeltmek yerinde olur.'
      });
    }

    if (donem && (bugun < donem.bas || (kilitliMi(donem) && bugun > donem.bit))) {
      u.push({
        tur: 'notr', ikon: '#ic-doc',
        baslik: 'Kampanya Aralığının Dışındasınız',
        metin: 'Kampanya ' + donem.ad + ' kayıtları ' + YU.fmt.tarih(donem.bas) + ' – ' +
          YU.fmt.tarih(donem.bit) + ' aralığında.' +
          (kilitliMi(donem) ? ' Kampanya kilitli — yeni kayıt için önce kilidi açın.' : ''),
        git: function () { YU.git('gunluk-rapor', { tarih: donem.sonKayit }); }   /* M33: veri olan gün */
      });
    }

    /* Çift sayım kontrolü (kullanıcı isteği, 24.08.2026): fark varsa üst
       şerit uyarısı da düşer. Hesap 23-stok-durumu'nun YU.ciftSayimKontrol
       köprüsünden gelir; o dosya yüklenmemişse sessizce atlanır. */
    var cift = typeof YU.ciftSayimKontrol === 'function'
      ? guvenli(function () { return YU.ciftSayimKontrol(bugun); }, null)
      : null;
    if (cift && !cift.tutuyor) {
      u.push({
        tur: 'olumsuz', ikon: '#ic-percent',
        baslik: 'Çift Sayım Tutmuyor',
        metin: 'Kuru küspe toplamı beklenenden ' + YU.fmt.kgU(Math.abs(cift.fark)) +
          (cift.fark > 0 ? ' fazla' : ' eksik') + '. Stok Durumu\'ndaki kontrol paneline bakın.',
        git: function () { YU.git('stok-durumu'); }
      });
    }

    /* Denetim izi sınırı (M29): logYaz sınırda en eskiyi düşürür (M10);
       budama sessiz kalmasın diye zile de düşer. */
    var logSinir = (YU.log && YU.log.SINIR) || 5000;
    if (db.degisiklikLog.length >= logSinir) {
      u.push({
        tur: 'olumsuz', ikon: '#ic-doc',
        baslik: 'Denetim İzi Sınırında',
        metin: 'Değişiklik kaydı ' + YU.fmt.sayi(db.degisiklikLog.length) +
          ' satır — en eski kayıtlar düşüyor. Yedek İndir ile arşivleyin.',
        git: function () { YU.git('gunluk-rapor'); }
      });
    } else if (db.degisiklikLog.length >= logSinir * 0.9) {
      u.push({
        tur: 'bekleyen', ikon: '#ic-doc',
        baslik: 'Denetim İzi Sınıra Yaklaşıyor',
        metin: 'Değişiklik kaydı ' + YU.fmt.sayi(db.degisiklikLog.length) + ' / ' +
          YU.fmt.sayi(logSinir) + ' satır. Yedek İndir ile arşivleyin.',
        git: function () { YU.git('gunluk-rapor'); }
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

    /* Basit malzeme stoğu negatife düşen günler (kullanıcı kararı,
       26.08.2026). Kayıt ENGELLENMEZ — Şartname §13 Soru 3 "öneri: uyarı",
       sert engel giriş sırası bozukken operatörü kilitler. Ama uyarı
       kaydettikten sonra kaybolmasın diye zile de düşer: koşul düzelene
       kadar listede durur. Silolar bu listeye girmez, onlar yukarıdaki
       D14 bloğunda. */
    var malzNegatif = guvenli(function () { return YU.dogrula.malzemeNegatifGunleri(db); }, []);
    for (i = 0; i < malzNegatif.length && i < 8; i++) {
      (function (mn) {
        u.push({
          tur: 'olumsuz',
          ikon: '#ic-cube',
          baslik: mn.malzemeAd + ' · ' + YU.fmt.tarih(mn.tarih),
          metin: 'Stok negatife düşüyor: ' + YU.fmt.kgU(mn.bakiye) + ' · giriş sırasını kontrol edin.',
          git: function () { YU.git('malzeme-girisi', { tarih: mn.tarih }); }
        });
      })(malzNegatif[i]);
    }

    var silolar = guvenli(function () { return YU.stok.tumSilolar(db); }, []);
    for (i = 0; i < silolar.length; i++) {
      var s = silolar[i];
      if (!s || !s.silo || !s.kapasite) continue;
      if (s.mevcut > s.kapasite) {
        u.push({
          tur: 'olumsuz', ikon: '#ic-building',
          baslik: s.silo.Ad + ' · Kapasite Aşıldı',
          metin: YU.fmt.kgU(s.mevcut) + ' / ' + YU.fmt.kgU(s.kapasite) + ' · ' + YU.fmt.doluluk(s.doluluk),
          git: function () { YU.git('silo-durumu'); }
        });
      } else if ((s.doluluk || 0) >= 0.9) {
        u.push({
          tur: 'bekleyen', ikon: '#ic-building',
          baslik: s.silo.Ad + ' · doluluk ' + YU.fmt.doluluk(s.doluluk),
          metin: 'Kapasiteye yaklaşıldı (D15).',
          git: function () { YU.git('silo-durumu'); }
        });
      }
    }

    /* Veri bütünlük taraması (M19): yetim referans + mükerrer tekil anahtar.
       Negatif gün ve kapasite aşımı yukarıda zaten listeleniyor. */
    var butunluk = guvenli(function () { return YU.stok.butunlukRaporu(db); }, []);
    for (i = 0; i < butunluk.length && i < 6; i++) {
      u.push({
        tur: 'olumsuz', ikon: '#ic-alert',
        baslik: 'Veri Bütünlüğü',
        metin: butunluk[i],
        git: function () { YU.git('kabul-testleri'); }
      });
    }
    if (butunluk.length > 6) {
      u.push({
        tur: 'olumsuz', ikon: '#ic-alert',
        baslik: (butunluk.length - 6) + ' Bütünlük Sorunu Daha',
        metin: 'Tam liste tarayıcı konsolunda (YU.stok.butunlukRaporu).',
        git: function () { YU.git('kabul-testleri'); }
      });
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
        metin: 'Tümü Geçmiş İşlemler ekranında listelenir.',
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
    /* M33: dönem sonuna kadar saymak, kayıt bittikten sonraki her günü
       "eksik" gösterirdi (geçmiş kampanyada yüzlerce sahte satır).
       BUGÜN LİSTEYE GİRMEZ (kullanıcı kararı, 26.08.2026): gün bitmeden
       girilmemiş olması eksiklik değil; "bugünün girişi yok" uyarısı her
       sabah kendiliğinden çıkıp gereksiz yer kaplıyordu. Geçmiş günlerdeki
       gerçek boşluklar listelenmeye devam eder. */
    var bugunIso = YU.tarih.bugun();
    var eksik = [], t = d.bas, guvenlik = 0;
    while (t <= d.sonKayit && guvenlik < 500) {
      if (!var_[t] && t !== bugunIso) eksik.push(t);
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

  /* vurgulu: satır kalıcı vurgu zeminiyle çizilir (okunmamış bildirim). */
  function popupSatir(ikon, baslik, altMetin, onClick, renk, vurgulu) {
    var ikonKap = YU.h('div', {
      stil: {
        width: '24px', height: '24px', borderRadius: '7px', flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: renk ? 'var(--' + renk + '-zemin)' : 'var(--yuzey-3)',
        color: renk ? 'var(--' + renk + ')' : 'var(--metin-3)'
      }
    }, YU.svg(ikon || '#ic-dots', 13));
    var govde = YU.h('div', { stil: { flex: '1', minWidth: '0' } },
      /* baslik bir Element ise olduğu gibi kullanılır (zil: tarih başlıklı öge). */
      typeof baslik === 'string'
        ? YU.h('div', { metin: baslik, stil: { font: '400 14.5px/1.35 var(--font)', color: 'var(--metin-2)' } })
        : baslik,
      /* altMetin de baslik gibi Element olabilir (dönem listesi: kırmızı "Kilitli"). */
      altMetin
        ? (typeof altMetin === 'string'
          ? YU.h('div', { metin: altMetin, stil: { font: '400 13px/1.4 var(--font)', color: 'var(--metin-4)', marginTop: '2px' } })
          : YU.h('div', { stil: { font: '400 13px/1.4 var(--font)', color: 'var(--metin-4)', marginTop: '2px' } }, altMetin))
        : null
    );
    var taban = vurgulu ? 'var(--vurgu-zemin)' : 'transparent';
    var satir = YU.h('div', {
      role: 'button', tabindex: '0',
      stil: {
        display: 'flex', gap: '10px', alignItems: 'flex-start',
        padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
        background: taban
      },
      onClick: function () { popupKapat(); if (onClick) onClick(); },
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); popupKapat(); if (onClick) onClick(); } },
      onMouseEnter: function () { satir.style.background = 'var(--yuzey-3)'; },
      onMouseLeave: function () { satir.style.background = taban; }
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
            sinif: 'yu-marka-logo acik', src: 'LOGO.png?s=2', alt: 'Doğuş Afyon',
            width: '1666', height: '944', draggable: 'false'
          }),
          YU.h('img', {
            sinif: 'yu-marka-logo koyu', src: 'LOGO-koyu.png?s=2', alt: '',
            'aria-hidden': 'true', width: '1666', height: '944', draggable: 'false'
          }),
          /* 58px ikon rayında tam logo 33px'e iner ve "DOĞUŞ AFYON" yazısı
             okunmaz olur. Rayda yalnız amblem gösterilir; yazısı olmadığı
             için tek dosya iki temada da doğru görünür. Hangisinin görüneceğine
             CSS karar verir (kullanıcı isteği, 31.08.2026). */
          YU.h('img', {
            sinif: 'yu-marka-amblem', src: 'LOGO-amblem.png?s=2', alt: '',
            'aria-hidden': 'true', width: '240', height: '189', draggable: 'false'
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

  /* MENÜDE KISA AD (kullanıcı isteği, 31.08.2026).

     ÖLÇÜLDÜ: menünün metin sütunu 203px; 9 sayfanın 3'ü iki satıra sarıyordu
     ("Kuru Küspe Günlük Giriş ve Çıkış" 32 harf, "Devir Stok ve Kampanya
     Yönetimi" 31, "Malzeme ve Silo Yönetimi" 24). Satır yükseklikleri
     34-52-34-34-34-52-52-34-34 gidiyor, ritim kırılıyordu.

     Sayfa tanımına menuAd verilirse menüde O yazılır; verilmezse baslik
     kullanılır. SAYFANIN KENDİ BAŞLIĞI (üstteki büyük yazı) HER ZAMAN
     baslik'tir — kısaltma yalnız menüdedir. Tam ad ipucunda durur. */
  function menuOgesi(tanim) {
    var a = YU.h('a', {
      sinif: 'yu-menu-oge',
      href: hashKur(tanim.kod),
      title: tanim.baslik,
      stil: { textDecoration: 'none' },
      veri: { kod: tanim.kod }
    }, YU.svg(tanim.ikon || '#ic-dots', 17), YU.h('span', { metin: tanim.menuAd || tanim.baslik }));
    return a;
  }

  /* Rapor merkezi — menüdeki "Raporlar" başlığına tıklayınca ortada açılan
     pencere: üç büyük kart (Stok Durumu, Silo Durumu, Günlük Rapor). Kartta
     üstte ad, altında büyük ikon; üzerine gelince vurgu zemin. Tam ekran
     denendi, pencereye dönüldü — bir tık büyüğü (kullanıcı isteği, 21.08.2026). */
  /* RAPOR MERKEZİ (RAPOR_MERKEZI listesi + raporMerkeziAc penceresi)
     TAMAMEN SİLİNDİ — kullanıcı kararı, 25.08.2026: "direkt sil".
     Üç rapor ekranı sol menüde Raporlar başlığı altında zaten duruyor. */

  /* Hangi grup açık: {'Takip': true, ...}. Kayıt yoksa BOŞ döner, yani
     hepsi kapalı başlar (kullanıcı isteği, 31.08.2026). */
  function acikGruplar() {
    try {
      var d = JSON.parse(oku(MENU_ACIK_ANAHTAR) || '{}');
      return (d && typeof d === 'object') ? d : {};
    } catch (e) { return {}; }
  }

  function menuKur() {
    var menu = YU.h('div', { sinif: 'yu-menu' });
    /* ANA SAYFA ARTIK "VERİ GİRİŞİ" GRUBUNUN ALTINDA (kullanıcı isteği,
       31.08.2026). Eskiden gruplardan önce en üstte tek başına duruyordu.
       Aşağıdaki döngü 'Giriş' grubunu yazdıktan hemen sonra ekler; grup
       hiç çizilmezse (görünür sayfası yoksa) menünün sonuna düşer, böylece
       ana sayfa bağlantısı hiçbir durumda kaybolmaz. */
    var ust = YU.sayfalar[MENU_USTU];
    var ustOge = (ust && gorunur(ust)) ? menuOgesi(ust) : null;

    var liste = sayfaListesi();
    for (var g = 0; g < GRUP_SIRA.length; g++) {
      var grupAdi = GRUP_SIRA[g];
      var grupTanimlari = [];
      for (var i = 0; i < liste.length; i++) {
        var t = liste[i];
        if (!t || t.kod === MENU_USTU || t.grup !== grupAdi) continue;
        if (!gorunur(t)) continue;          /* Yönetici sayfaları operatöre gösterilmez */
        grupTanimlari.push(t);
      }
      if (!grupTanimlari.length) continue;
      /* MENÜ SIRASI (31.08.2026): varsayılan sıra, sayfaların index.html'de
         yüklenme sırasıdır. Bir sayfa tanımına menuSira verilirse grup içinde
         öne çekilir. Değeri olmayanlar 100 sayılır ve kendi aralarında
         yüklenme sırasını korur (Array.sort kararlıdır). */
      grupTanimlari.sort(function (a, b) {
        return (a.menuSira === undefined ? 100 : a.menuSira) -
               (b.menuSira === undefined ? 100 : b.menuSira);
      });
      var ogeler = [];
      for (i = 0; i < grupTanimlari.length; i++) ogeler.push(menuOgesi(grupTanimlari[i]));
      /* ANA SAYFA "GÜNLÜK İŞLEMLER" GRUBUNUN İLK SIRASINDA (kullanıcı isteği,
         31.08.2026). Önce menünün en üstünde tek başınaydı, sonra grubun
         altına alındı, en son grubun içine girdi. Grup adı da bu yüzden
         "Veri Girişi" değil: içinde bir giriş ekranı olmayan sayfa var. */
      if (ustOge && grupAdi === 'Giriş') { ogeler.unshift(ustOge); ustOge = null; }
      /* Grup başlıkları düz metindir. "Raporlar" başlığına bağlı RAPOR
         MERKEZİ penceresi KALDIRILDI (kullanıcı kararı, 25.08.2026): üç
         rapor zaten başlığın hemen altında menüde duruyordu, pencere
         fazladan bir adımdı. */
      var grupAd = GRUP_BASLIK[grupAdi] || grupAdi;

      /* AÇILIR-KAPANIR GRUPLAR (kullanıcı isteği, 31.08.2026): "Raporlar" ve
         "Yönetim Paneli" başlıklarına tıklanınca altındaki sayfalar açılıp
         kapanır. VARSAYILAN KAPALIDIR — kullanıcı kendisi açar. Tercih
         tarayıcıda saklanır, sayfa yenilenince kaybolmaz.

         "Veri Girişi" DIŞARIDADIR: kullanıcı yalnız bu iki grubu istedi,
         günlük giriş ekranları her zaman görünür kalır. */
      if (!KATLANIR[grupAdi]) {
        var duzBas = YU.h('div', { sinif: 'yu-menu-grup-bas', metin: grupAd });
        menu.appendChild(YU.h('div', { sinif: 'yu-menu-grup' }, duzBas, ogeler));
        continue;
      }

      var acik = acikGruplar()[grupAdi] === true;
      var grup = YU.h('div', { sinif: acik ? 'yu-menu-grup' : 'yu-menu-grup kapali' });
      /* Açık/kapalı işareti + ve − (kullanıcı isteği, 31.08.2026). İşaretin
         kendisi CSS'ten gelir (.yu-menu-grup-ok::before), böylece durum
         değişince JS metin güncellemek zorunda kalmaz. */
      var ok = YU.h('span', { sinif: 'yu-menu-grup-ok', 'aria-hidden': 'true' });
      var grupBas = YU.h('button', {
        tip: 'button',
        sinif: 'yu-menu-grup-bas yu-menu-grup-dugme',
        'aria-expanded': acik ? 'true' : 'false',
        title: grupAd + ' — aç / kapat'
      }, YU.h('span', { metin: grupAd }), ok);

      (function (grupEl, dugme, anahtar) {
        dugme.addEventListener('click', function () {
          var kapaliMi = grupEl.classList.toggle('kapali');
          dugme.setAttribute('aria-expanded', kapaliMi ? 'false' : 'true');
          var d = acikGruplar();
          d[anahtar] = !kapaliMi;
          yaz(MENU_ACIK_ANAHTAR, JSON.stringify(d));
        });
      })(grup, grupBas, grupAdi);

      grup.appendChild(grupBas);
      for (var o = 0; o < ogeler.length; o++) grup.appendChild(ogeler[o]);
      menu.appendChild(grup);
    }
    if (ustOge) menu.appendChild(ustOge);     /* 'Giriş' grubu çizilmediyse */
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

  /* Kampanya dönem etiketi (M33): süren kampanyada bitiş tarihi yerine
     "devam ediyor" yazılır — kampanya, yeni kampanya açılana kadar sürer. */
  function donemAraligi(d) {
    if (!d) return '';
    return YU.fmt.tarih(d.bas) + ' – ' + (d.suruyor ? 'devam ediyor' : YU.fmt.tarih(d.bit));
  }

  function donemBaslikTazele() {
    var d = donemAktif();
    if (dom.seciciAd) dom.seciciAd.textContent = d ? ('Kampanya ' + d.ad) : 'Kampanya yok';
  }

  /* --- dönem çipi, tema düğmesi, zil, kullanıcı kartı --- */

  /* Düğme ikonu o anki temayı anlatır: açıkta güneş (#ic-gear), koyuda hilal
     (#ic-moon) — kullanıcı isteği, 23.08.2026. Sistem seçiliyken etkin tema esas. */
  function temaIkonu() {
    return YU.svg(YU.tema.etkin() === 'koyu' ? '#ic-moon' : '#ic-gear', 14);
  }

  function temaDugmesi() {
    var etiket = YU.h('span', { metin: temaAdi() });
    var ikonKap = YU.h('span', { stil: { display: 'flex' } }, temaIkonu());
    dom.temaEtiket = etiket;
    dom.temaIkon = ikonKap;
    var d = YU.h('button', {
      tip: 'button', sinif: 'yu-tema-dugme', title: 'Temayı değiştir (açık / koyu)',
      onClick: function () { YU.tema.cevir(); }
    }, ikonKap, etiket);
    return d;
  }

  function temaDugmesiTazele() {
    if (dom.temaEtiket) dom.temaEtiket.textContent = temaAdi();
    if (dom.temaIkon) YU.bos(dom.temaIkon).appendChild(temaIkonu());
  }

  /* --- üst şerit uyarı (ünlem) ve son hareket (zil) düğmeleri ---
     Ünlem: YU.uyarilar listesini açar; rozeti uyarı sayısıdır ve koşul
     düzelmeden sönmez. Zil: Son Hareketler önizlemesini açar; rozeti son
     bakıştan beri eklenen denetim kaydı sayısıdır, panel açılınca sıfırlanır
     (kullanıcı isteği, 21.08.2026). */

  var GORULEN_LOG_ANAHTAR = 'yu.sonHareket.gorulenId';
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

  function gorulenLogId() {
    try { return Number(window.localStorage.getItem(GORULEN_LOG_ANAHTAR)) || 0; } catch (e) { return 0; }
  }

  /* Sayaç panelle aynı kümeyi sayar: yalnız BUGÜNÜN okunmamış hareketleri
     (kullanıcı isteği, 24.08.2026). Aksi hâlde "17" yazan zile basınca boş
     panel açılırdı. */
  function yeniHareketSayisi() {
    var db = YU.db, g = gorulenLogId(), bugun = YU.tarih.bugun(), s = 0, i, l;
    if (!db) return 0;
    for (i = 0; i < db.degisiklikLog.length; i++) {
      l = db.degisiklikLog[i];
      if ((Number(l.Id) || 0) <= g) continue;
      if (String(l.Tarih || '').slice(0, 10) !== bugun) continue;
      s++;
    }
    return s;
  }

  function ustSayaclariTazele() {
    sayacGoster(dom.uyariSayac, guvenli(function () { return YU.uyarilar().length; }, 0));
    sayacGoster(dom.zilSayac, yeniHareketSayisi());
  }

  /* Sayfalar kayıt sonrası zil rozetini tazeleyebilsin diye dışarı açılır
     (26.08.2026): Malzeme Girişi kaydettikten sonra ekranı YENİDEN ÇİZMİYOR
     (form yerinde tazeleniyor), o yüzden sayaç eskide kalıyordu. */
  YU.ustSayaclariTazele = function () {
    try { ustSayaclariTazele(); } catch (e) { /* kabuk kurulmadıysa önemsiz */ }
  };

  function unlemDugmesi() {
    var rozet = sayacRozeti();
    dom.uyariSayac = rozet;
    var dugme = YU.h('div', {
      sinif: 'yu-zil', role: 'button', tabindex: '0', title: 'Uyarılar',
      onClick: function () { unlemPaneliAc(dugme); },
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlemPaneliAc(dugme); } }
    }, YU.svg('#ic-alert', 24), rozet);   /* 19 -> 24: biraz büyük (kullanıcı isteği, 24.08.2026) */
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
    /* Kullanıcı adı (e-posta) uzayınca "· Yönetici" ikinci satıra sarkıp
       hizayı bozuyordu (kullanıcı isteği, 27.08.2026): ad ve rol artık iki
       ayrı satırda aynı sol hizada durur; sığmayan ad üç noktayla kısalır. */
    if (k) {
      var bas = popupBaslik(k.KullaniciAdi);
      bas.style.padding = '9px 10px 2px';
      bas.style.overflow = 'hidden';
      bas.style.textOverflow = 'ellipsis';
      bas.style.whiteSpace = 'nowrap';
      bas.title = k.KullaniciAdi;
      var rolSatiri = popupBaslik(rolMetni(k.Rol));
      rolSatiri.style.padding = '0 10px 6px';
      kutu.appendChild(bas);
      kutu.appendChild(rolSatiri);
    } else {
      kutu.appendChild(popupBaslik('Oturum'));
    }
    /* "Hesap Değiştir" KALDIRILDI (kullanıcı isteği, 03.09.2026: "zaten
       çıkış yapmak hesap değiştir anlamına da geliyor"). İki satır da aynı
       işi (YU.oturumKapat) yapıyordu; menüde tek satır kaldı.
       TARİHÇE: satır 26.08.2026'da "Rol Değiştir"den adlandırılmıştı.
       Erişim engellendi ekranındaki aynı adlı düğmeye DOKUNULMADI — istek
       üst şerit içindi (KURAL 5.1). */
    /* "Oturumu Kapat · Kayıtlı oturum silinir" veri siliniyor sanılıyordu;
       sadece "Çıkış Yap" yazar (kullanıcı isteği, 24.08.2026). */
    kutu.appendChild(popupSatir('#ic-percent', 'Çıkış Yap', null, function () { YU.oturumKapat(); }, 'olumsuz'));

    /* Tema seçimi üst şeritteki düğmede duruyor; kullanıcı menüsünde
       ikinci kez gösterilmiyor (kullanıcı isteği). */
    popupAc(tetik, kutu);
  }

  /* --- kaydedilmemiş değişiklik varken çıkış kilidi (kullanıcı isteği,
     25.08.2026; Devir Stok'ta kurulup Kuru Küspe ve Malzeme Girişi'ne
     yayıldı) ---
     İki kapı kapatılır:
       · beforeunload  — sekme/pencere kapatma, yenileme, dış adres;
                         tarayıcı kendi "ayrılsın mı?" penceresini gösterir.
       · menü tıklaması — uygulama içi geçişte bağlantı durdurulur ve
                         uygulamanın kendi onayı sorulur.
     Kilit her sayfa çiziminde SIFIRLANIR (yonlendir): ekranı terk eden
     sayfanın kilidi asılı kalmaz; yeni ekran gerekiyorsa kendisi kurar. */
  var cikisKilidiAcik = false;
  var cikisKilidiSert = false;   /* sert: adres (hash) değişimi de sorulur */
  var cikisKilidiMesaji = 'Kaydedilmemiş değişiklik var.';

  function cikisUyarisi(e) {
    if (!cikisKilidiAcik) return;
    e.preventDefault();
    e.returnValue = cikisKilidiMesaji;
    return e.returnValue;
  }

  /* Kaydedilmemiş değişiklik varken sayfadan ayrılan HER yol buradan geçer;
     soru metni tek yerde durur. Kilit kapalıysa hiç sormadan devam eder. */
  function cikistaOnay(devam) {
    if (!cikisKilidiAcik) { devam(); return; }
    YU.ui.onay({
      baslik: 'Kaydedilmemiş Değişiklik Var',
      metin: cikisKilidiMesaji + ' Şimdi çıkarsanız kaybolur. Çıkılsın mı?',
      onayMetni: 'Kaydetmeden Çık',
      iptalMetni: 'Sayfada Kal',
      tehlike: true
    }).then(function (evet) {
      if (!evet) return;
      YU.cikisKilidi(false);
      devam();
    });
  }

  function cikisBagDenetimi(e) {
    if (!cikisKilidiAcik) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var hedef = a.getAttribute('href');
    if (!hedef || hedef.charAt(0) !== '#' || hedef === location.hash) return;
    e.preventDefault();
    e.stopPropagation();
    cikistaOnay(function () { location.hash = hedef; });
  }

  /* YU.cikisKilidi(true, 'mesaj') — kilidi kurar; (false) — kaldırır.
     Üçüncü parametre sert=true: adres değişimi (geri tuşu, marka, YU.git)
     de sorulur — yalnız isteyen ekran kurar (Devir Stok, 27.08.2026). */
  YU.cikisKilidi = function (acik, mesaj, sert) {
    if (mesaj) cikisKilidiMesaji = mesaj;
    /* SERT ARTIK VARSAYILAN (kullanıcı isteği, 27.08.2026: "bu çıkış yasağını
       ortak yap, hepsinde aynı işi yapıyor"). Üçüncü parametre verilmezse
       kilit serttir; her ekran aynı davranır. */
    cikisKilidiSert = !!acik && (sert === undefined ? true : !!sert);
    if (cikisKilidiAcik === !!acik) return;
    cikisKilidiAcik = !!acik;
    if (cikisKilidiAcik) {
      window.addEventListener('beforeunload', cikisUyarisi);
      document.addEventListener('click', cikisBagDenetimi, true);
    } else {
      window.removeEventListener('beforeunload', cikisUyarisi);
      document.removeEventListener('click', cikisBagDenetimi, true);
    }
  };

  /* --- depo uyarıları (DUZELTME-PLANI M2/M3/M4) ---
     01-cekirdek katman gereği UI bilmez; kancayı kabuk bağlar. Şerit içerik
     alanının EN ÜSTÜNE oturur ve sayfa geçişlerinde durur (yönlendirici yalnız
     dom.kap'ı boşaltır); aynı tip şerit bir kez gösterilir. */

  var gosterilenSeritler = {};

  /* Diske yazma durdu mu (çakışma ya da kota). Açıkken "kaydedildi" gibi
     başarı bildirimleri gösterilmez; yerine yazmanın diske ulaşmadığı
     söylenir (kullanıcı isteği, 25.08.2026 — "hata istemiyorum burada").
     Servis katmanı depo.kaydet() dönüşünü okumadığı için tek doğru nokta
     bildirim çıkışıdır. */
  var yazmaDurdu = false;
  var cakismaAcik = false;         /* sekme çakışması penceresi ekranda mı */
  var cakismaKok = null;           /* o pencerenin perdesi — DOM'dan düştü mü diye bakılır */

  function kabukSeridi(tip, ayar) {
    if (!kabukKurulu || !dom.icerik) {
      YU.ui.bildir(ayar.baslik + ' — ' + ayar.metin, ayar.tur === 'hata' ? 'hata' : 'uyari');
      return;
    }
    if (gosterilenSeritler[tip]) return;
    gosterilenSeritler[tip] = true;
    dom.icerik.insertBefore(YU.ui.serit(ayar), dom.icerik.firstChild);
  }

  YU.depoUyari = function (tip) {
    if (tip === 'kota') {
      yazmaDurdu = true;
      kabukSeridi('kota', {
        tur: 'hata',
        baslik: 'Veriler Diske Yazılamadı',
        metin: 'Tarayıcı depolaması dolu ya da kapalı. Son değişiklikler yalnız bu sekmenin ' +
          'belleğinde; sayfayı yenilerseniz kaybolur. Üst şeritten "Yedek İndir" ile veriyi alın.'
      });
      return;
    }
    if (tip === 'cakisma') {
      /* ŞERİT DEĞİL MİNİ PENCERE (kullanıcı isteği, 31.08.2026): uyarı
         sayfanın üstünde bir şeritti, kaydırılan ekranda gözden kaçıyordu.
         Artık ekranın ortasına kapatılamaz bir pencere olarak gelir ve tek
         çıkışı Yenile düğmesidir — bu sekmeden artık HİÇBİR kayıt diske
         yazılmıyor. yazmaDurdu bayrağı, "kaydedildi" bildirimlerinin yalan
         söylemesini engeller (aşağıda YU.ui.bildir). */
      yazmaDurdu = true;
      cakismaPenceresi();
    }
  };

  /* Sekme çakışması penceresi — HER SAYFADA (kullanıcı isteği, 31.08.2026).
     Pencere document.body'ye asılır, kabuğun içeriğine değil; bu yüzden sayfa
     değişse de yerinde kalır. Açıkken yenisi açılmaz, ama ekrandan herhangi
     bir sebeple düşerse (kabuk yeniden kurulur, başka bir pencere temizler)
     bir sonraki çizimde geri gelir: yazma durmuşken kullanıcı uyarısız
     kalmamalı. Kontrol ciz() içinde. */
  function cakismaPenceresi() {
    if (!yazmaDurdu || cakismaAcik) return;
    if (!YU.ui || !YU.ui.modal) {
      YU.ui.bildir('Veriler başka bir sekmede değişti — sayfayı yenileyin.', 'hata');
      return;
    }
    cakismaAcik = true;
    cakismaKok = YU.ui.modal({
      /* Kaynak artık sunucu: değişiklik başka bilgisayardan da gelebilir,
         başlık 'sekme'ye bağlanmaz (31.08.2026). */
      baslik: 'Veriler Değişti',
      genislik: 440,
      kapatilamaz: true,
      govde: YU.h('div', { stil: { display: 'flex', gap: '12px', alignItems: 'flex-start' } },
        YU.h('span', { stil: { display: 'flex', color: 'var(--olumsuz)', flex: 'none', marginTop: '2px' } },
          YU.svg('#ic-alert', 20)),
        YU.h('div', {
          stil: { font: '400 15px/1.6 var(--font)', color: 'var(--metin-3)' },
          /* Tek cümle (kullanıcı isteği, 31.08.2026): iki gerçek kalır —
             görünüm eski, yazma durdu. "Sayfayı yenileyin" düşürüldü;
             düğme zaten Yenile diyor (KURAL 11). */
          metin: 'Bu ekran eski veriyi gösteriyor; kaydınız sunucuya yazılamadı.'
        })),
      dugmeler: [
        { metin: 'Yenile', ikon: '#ic-swap', tur: 'birincil', onClick: function () { location.reload(); } }
      ],
      onKapat: function () { cakismaAcik = false; }
    }).kok;
  }

  /* Pencere hâlâ ekranda mı? Değilse yeniden açılır. */
  function cakismaTazele() {
    if (!yazmaDurdu) return;
    if (cakismaAcik && cakismaKok && cakismaKok.parentNode) return;
    cakismaAcik = false;
    cakismaPenceresi();
  }

  /* 'storage' DİNLEYİCİSİ KALDIRILDI (31.08.2026): veri artık tarayıcıda
     değil SUNUCUDA durur (06-uzak köprüsü), localStorage'a veri anahtarı
     yazılmıyor ki olay tetiklensin. Başka bilgisayar/sekme kaydedince haber
     sunucu sürüm yoklamasından gelir — kurulum 99-baslat'ta. Kaydedilmemiş
     alan varken ekran sessizce tazelenmesin diye kilit durumu dışarı açılır. */
  YU.cikisKilidiAcikMi = function () { return cikisKilidiAcik; };

  /* --- geçmiş kampanya kilitsiz uyarısı (kullanıcı isteği, 25.08.2026) ---
     Sezonun bittiğini kullanıcı KİLİTLEyerek belirtir (M31 revize); bunun
     ters yüzü: geçmiş bir sezonun kilidi AÇIKSA verisi hâlâ değişikliğe
     açıktır. Şerit içerik alanının EN ÜSTÜNDE her sayfada durur; her sayfa
     çiziminde tazelenir — kilit kapanınca kendiliğinden kalkar. "Geçmiş"
     ölçüsü bugünün sezonudur: dönem listesinin sonuncusu bugünün kampanyası,
     ondan öncekilerin hepsi geçmiştir. */
  var kilitUyariKap = null;

  /* Geçmiş kampanyaya bakıldığında SERT kırmızı şerit (kullanıcı isteği,
     25.08.2026 — M34): çipe bakmayan kullanıcı bugünün verisine baktığını
     sanabiliyordu. yu-cetin sınıfı iri başlık + kalın kırmızı kenar çizgisi
     verir; yu-tiklanir hover'ı açar. */
  function gecmisKampanyaSeridi() {
    var l = donemler(), d = donemAktif();
    if (!d || l.length < 2 || l[l.length - 1].ad === d.ad) return null;
    var guncel = l[l.length - 1];
    /* Metin CÜMLEYLE başlar, tarihle değil (kullanıcı isteği, 25.08.2026):
       "2025/2026 · 15.09.2025 – 21.07.2026." diye açılan şeritte ilk sözcükler
       tarih yığınıydı, okunmuyordu. Kampanya aralığı en sona alındı.
       Kilit cümlesi YALNIZ kampanya gerçekten kilitliyken yazılır: kilidi açık
       geçmiş kampanyaya "yalnız okunur" demek yanlış olurdu — o durumu ayrı
       "Kilidi Açık" şeridi anlatır. */
    var kilitli = !!(YU.db && YU.servis && YU.servis.kampanyaKilitDurumu &&
                     YU.servis.kampanyaKilitDurumu(YU.db, d.ad));
    var serit = YU.ui.serit({
      tur: 'hata', ikon: '#ic-alert',
      baslik: 'Geçmiş Kampanyaya Bakıyorsunuz',
      metin: 'Ekrandaki bütün rakamlar ' + d.ad + ' kampanyasına aittir, bugünün değil. ' +
        (kilitli
          ? 'Kampanya kilitli — veriler yalnız okunabilir; değişiklik yapmak için kilidi bir yöneticinin açması gerekir. '
          : '') +
        'Güncel sezona dönmek için üstteki kampanya çipinden ' + guncel.ad + ' seçin. ' +
        'Kampanya aralığı: ' + donemAraligi(d) + '.',
      eylem: {
        metin: 'Güncel Kampanyaya Dön', ikon: '#ic-calendar',
        onClick: function () { YU.donem.ayarla(guncel.ad); }
      }
    });
    serit.className += ' yu-cetin yu-tiklanir';
    serit.title = d.ad + ' kampanyasına bakılıyor' + (kilitli ? ' (kilitli — yalnız okunur)' : '') +
      ' — güncel sezon ' + guncel.ad + '.';
    return serit;
  }

  /* BOŞ KAP 12px YER YİYORDU (kullanıcı bildirimi, 26.08.2026 — "en üstte
     boşluk var"): .yu-icerik bir flex sütunu ve gap'i 12px; içi boş olsa da
     bir flex öğesi kendinden sonra gap üretir. Uyarı yokken kap artık
     display:none olur ve o boşluk kapanır. Doldurma işi ayrı fonksiyona
     alındı — içindeki erken return'ler aynen çalışsın, görünürlük her
     durumda en sonda tek yerden ayarlansın. */
  function kilitUyariTazele() {
    if (!kabukKurulu || !dom.icerik) return;
    if (!kilitUyariKap || kilitUyariKap.parentNode !== dom.icerik) {
      kilitUyariKap = YU.h('div');
      dom.icerik.insertBefore(kilitUyariKap, dom.icerik.firstChild);
    }
    YU.bos(kilitUyariKap);
    kilitUyariDoldur();
    kilitUyariKap.style.display = kilitUyariKap.firstChild ? '' : 'none';
  }

  function kilitUyariDoldur() {
    var db = YU.db;
    if (!db || !YU.servis || !YU.servis.kampanyaKilitDurumu) return;
    /* Bakış uyarısı önce: hangi sezona bakıldığı, kilit durumundan önce gelir. */
    var bakis = gecmisKampanyaSeridi();
    if (bakis) kilitUyariKap.appendChild(bakis);
    var l = donemler(), acik = [], i;
    for (i = 0; i < l.length - 1; i++) {
      if (!YU.servis.kampanyaKilitDurumu(db, l[i].ad)) acik.push(l[i].ad);
    }
    if (!acik.length) return;
    /* BİRDEN FAZLA kilit açıksa uyarı KIRMIZI, tek cümle ve yalnız yöneticiye
       görünür (kullanıcı isteği, 25.08.2026): kilidi yalnız yönetici
       kapatabildiği için operatöre gösterilen uyarı iş yaratmıyordu; birden
       çok açık sezon da tekil durumdan daha ciddidir. Tek kilit açıkken eski
       sarı bilgi şeridi olduğu gibi kalır (KURAL 5.1). */
    if (acik.length > 1) {
      if (!YU.yonetici()) return;
      var sert = YU.ui.serit({
        tur: 'hata', ikon: '#ic-kilit-acik',
        baslik: YU.fmt.sayi(acik.length) + ' Geçmiş Kampanyanın Kilidi Açık',
        metin: acik.join(', ') + ' kampanyalarının verisi değişikliğe açık; Kampanya Yönetimi ekranından kilitleyin.',
        eylem: { metin: 'Kampanya Yönetimi', onClick: function () { YU.git('devir-stok'); } }
      });
      /* yu-cetin: kalın kırmızı kenar çizgisi + iri başlık — geçmiş kampanya
         şeridiyle aynı sert kırmızı dil (kullanıcı isteği, 25.08.2026). */
      sert.className += ' yu-cetin';
      kilitUyariKap.appendChild(sert);
      return;
    }
    /* Tek kilit uyarısı da KIRMIZI (kullanıcı isteği, 25.08.2026): sarı şerit
       "bilgi" gibi okunuyordu, oysa geçmiş sezon verisi açık demek. */
    var ayar = {
      tur: 'hata', ikon: '#ic-kilit-acik',
      baslik: acik[0] + ' Kampanyasının Kilidi Açık',
      metin: 'Geçmiş sezon verileri değişikliğe açık — yanlışlıkla düzeltme olmasın diye işiniz bitince Kampanya Yönetimi ekranından kilitleyin.'
    };
    if (YU.yonetici()) {
      ayar.eylem = { metin: 'Kampanya Yönetimi', onClick: function () { YU.git('devir-stok'); } };
    }
    kilitUyariKap.appendChild(YU.ui.serit(ayar));
  }

  /* --- TEK PANEL yazdırma (kullanıcı isteği, 25.08.2026) ---
     "Yazdır": yalnız verilen paneli bastırır — sayfanın geri kalanı baskıda
     gizlenir (tema.css .yu-baski-tek). "Veriyi Aç" KALDIRILDI (kullanıcı
     kararı, 26.08.2026): düğmeleri gitti, kimse çağırmıyordu. */

  YU.yazdirPanel = function (panelEl) {
    if (!panelEl) { window.print(); return; }
    var kok = document.documentElement;
    panelEl.classList.add('yu-baski-hedef');
    kok.classList.add('yu-baski-tek');
    function temizle() {
      panelEl.classList.remove('yu-baski-hedef');
      kok.classList.remove('yu-baski-tek');
      window.removeEventListener('afterprint', temizle);
    }
    window.addEventListener('afterprint', temizle);
    /* afterprint bazı tarayıcılarda gecikiyor; yedek temizlik. */
    window.setTimeout(temizle, 4000);
    window.print();
  };

  /* --- CSV dışa aktarma (DUZELTME-PLANI M17) ---
     Türkçe Excel uyumu: ';' ayraç, UTF-8 BOM, CRLF, '"' kaçışı. Sayılar
     YU.csvSayi ile yazılır: binlik ayraçsız, ondalık VİRGÜL — Excel (TR)
     hücreyi doğrudan sayı okur; "1.234,56" biçimi metin kalırdı. */
  YU.csvSayi = function (n) {
    var v = YU.yuvarla(Number(n) || 0);
    return String(v).replace('.', ',');
  };

  YU.csvIndir = function (dosyaAdi, satirlar) {
    var i, j, h, cikti = [];
    for (i = 0; i < satirlar.length; i++) {
      var hucreler = [];
      for (j = 0; j < satirlar[i].length; j++) {
        h = satirlar[i][j];
        h = h === null || h === undefined ? '' : String(h);
        if (/[";\n\r]/.test(h)) h = '"' + h.replace(/"/g, '""') + '"';
        hucreler.push(h);
      }
      cikti.push(hucreler.join(';'));
    }
    var url = URL.createObjectURL(new Blob(['﻿' + cikti.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    var a = YU.h('a', { href: url, download: dosyaAdi, stil: { display: 'none' } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    YU.ui.bildir('CSV indirildi: ' + dosyaAdi, 'basari');
  };

  /* --- test veri düğmeleri (kullanıcı isteği, 21.08.2026) ---
     Prototipe özel: örnek veriyi silip boş sistemle denemek ve sistem boşken
     aynı deterministik veriyi geri yüklemek için. Gerçek uygulamaya girmez. */
  /* ÜST ŞERİT DÜĞMELERİ KALDIRILDI (kullanıcı isteği, 31.08.2026):
     "Verileri Sıfırla", "Örnek Veri Yükle" ve "Veri Yükle" artık çizilmiyor
     ve işlevleri de kaldırıldı. İlk ikisi prototip test düğmesiydi (21.08.2026);
     canlı kullanımda tek tıkla bütün veriyi silebilmek risktir. "Veri Yükle"
     de aynı şeritten gitti.

     KAYBOLMAYAN YETENEKLER — yalnız ekrandaki giriş kapısı kapandı:
       · Günlük JSON yedeği (07-yedekci) tıklamasız yazmaya devam eder.
       · Geri yükleme servisleri duruyor: YU.servis.gunYedektenYukle ve
         YU.db.iceAktar. Gerekirse bir yönetim ekranına düğme konur.
       · Depo boşaltma: YU.db.bosla().

     "Günlük yedek yazılamıyor" ROZETİ KALIR: yalnız sunucuya yazma
     başarısızken görünür ve o an gerçekten bilinmesi gereken tek şeydir. */
  function testDugmeleri() {
    var rozet = YU.h('span', {
      sinif: 'yu-yardim',
      metin: 'Günlük yedek yazılamıyor',
      stil: { margin: '0', color: 'var(--bekleyen)', whiteSpace: 'nowrap', display: 'none' }
    });
    if (YU.yedekci) {
      YU.yedekci.dinle(function (durum, hata) {
        rozet.style.display = durum === 'hata' ? '' : 'none';
        rozet.title = hata ? 'Yazma hatası: ' + hata + ' — kendiliğinden yeniden denenecek' : '';
      });
    }
    return YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '8px', flex: 'none' } }, rozet);
  }


  /* --- kabuk kurulumu --- */

  function kabukKur() {
    var k = kok();
    if (!k) throw new Error('#yu-kok bulunamadı — index.html bozulmuş olabilir.');
    YU.bos(k);
    dom = {};

    /* Kenar çubuğundaki kampanya seçicisi kaldırıldı (kullanıcı isteği,
       24.08.2026): kampanya artık yalnız üst şeritteki iri çipten seçilir. */
    var yan = YU.h('div', { sinif: 'yu-yan' }, markaBlogu(true, true), menuKur());

    /* Arama kutusu, Son Hareketler zili ve KAMPANYA ÇİPİ kaldırıldı (kullanıcı
       istekleri, 24.08.2026 · çip 25.08.2026); denetimler sağa yaslanır.
       Kampanya, sol kenar çubuğundaki seçiciden ve Devir Stok ekranındaki
       Kampanya Yönetimi listesinden değiştirilir. */
    var ust = YU.h('div', { sinif: 'yu-ust' },
      YU.h('div', {
        stil: { flex: '1 1 0', minWidth: '0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }
      },
        testDugmeleri(),
        temaDugmesi(),
        /* Ünlem (uyarı) düğmesi kaldırıldı (kullanıcı isteği, 28.08.2026).
           unlemDugmesi/unlemPaneliAc kodu duruyor; uyarılar YU.uyarilar()
           üzerinden hâlâ üretiliyor, yalnız üst şeritte gösterilmiyor. */
        kullaniciKarti()
      )
    );

    var baslik = YU.h('div', { sinif: 'yu-sayfa-baslik' });
    var alt = YU.h('div', { sinif: 'yu-sayfa-alt' });
    var eylemler = YU.h('div', { sinif: 'yu-eylemler' });
    /* Geri bağlantısı başlığın ÜSTÜNDE, sol üstte durur (kullanıcı isteği,
       25.08.2026): ayrıntı ekranından geldiği listeye dönüş. Sayfa tanımı
       "geri" vermezse yuva boş kalır ve gizlenir — diğer ekranlar değişmez. */
    var geri = YU.h('div', { sinif: 'yu-sayfa-geri yu-baski-yok' });
    var sayfaBas = YU.h('div', { sinif: 'yu-sayfa-bas yu-baski-yok' },
      YU.h('div', { stil: { flex: '1', minWidth: '0' } }, geri, baslik, alt),
      eylemler
    );

    /* RAPOR BAŞLIĞI — yalnız kâğıtta görünür (kullanıcı isteği, 26.08.2026:
       "patrona 'Ana Sayfa' diye rapor gönderilmez"). Ekranın kendi başlık
       şeridi (Ana Sayfa · Kampanya … · 35 gün veri girilmiş) baskıya girmez;
       yerine kurumsal bir rapor künyesi basılır: rapor adı, tarih, kampanya
       ve raporu alan kişi. */
    var baskiAd   = YU.h('div', { sinif: 'yu-baski-ad' });
    var baskiTarih= YU.h('div', { sinif: 'yu-baski-tarih' });
    var baskiAlt  = YU.h('div', { sinif: 'yu-baski-alt' });
    /* "Hazırlayan" satırı KALDIRILDI (kullanıcı isteği, 26.08.2026). */
    var baskiBas  = YU.h('div', { sinif: 'yu-baski-bas yu-yalniz-baski' },
      YU.h('div', { sinif: 'yu-baski-kurum', metin: KURUM_ADI }),
      YU.h('div', { sinif: 'yu-baski-satir' }, baskiAd, baskiTarih),
      baskiAlt
    );
    dom.baskiAd = baskiAd; dom.baskiTarih = baskiTarih; dom.baskiAlt = baskiAlt;

    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    var icerik = YU.h('div', { sinif: 'yu-icerik' }, baskiBas, sayfaBas, kap);

    dom.yan = yan; dom.menu = yan.querySelector('.yu-menu');
    dom.baslik = baslik; dom.alt = alt; dom.eylemler = eylemler; dom.geri = geri;
    dom.sayfaBas = sayfaBas;
    dom.kap = kap; dom.icerik = icerik;

    /* Daralt düğmesi kenar çubuğunun dış kenarına oturur; bu yüzden kabuk
       düzeyinde durur, kenar çubuğunun kırpma alanının dışında. */
    var kabuk = YU.h('div', { sinif: 'yu-kabuk' }, yan, YU.h('div', { sinif: 'yu-ana' }, ust, icerik), daraltDugmesi());
    dom.kabuk = kabuk;
    k.appendChild(kabuk);
    yanDaraltUygula(yanDaralikMi());

    kabukKurulu = true;
    gosterilenSeritler = {};   /* yeni DOM — depo uyarı şeritleri baştan */
    kullaniciTazele();
    donemBaslikTazele();

    /* Açılışta eski paket okunamadıysa 01-cekirdek not bırakır (M4): veri
       silinmedi, yu.veri.yedek anahtarına kopyalandı — kullanıcı bilsin. */
    if (YU.depoKurtarmaNotu) {
      kabukSeridi('kurtarma', {
        tur: 'bilgi',
        baslik: YU.depoKurtarmaNotu.sebep === 'surum'
          ? 'Veri Şeması Güncellendi'
          : 'Önceki Veri Okunamadı',
        metin: (YU.depoKurtarmaNotu.sebep === 'surum'
          ? 'Eski sürümdeki veriniz olduğu gibi "' + YU.depoKurtarmaNotu.anahtar + '" anahtarına yedeklendi; '
          : 'Bozuk görünen eski içerik "' + YU.depoKurtarmaNotu.anahtar + '" anahtarına yedeklendi; ') +
          'uygulama örnek veriyle açıldı. Yedeğe tarayıcı geliştirici araçlarından ulaşabilirsiniz.'
      });
      YU.depoKurtarmaNotu = null;
    }
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

  /* ==================================================================
     10. Çizim ve yetki kontrolü (Şartname Test 7 — DEMİRBAŞ)
     ================================================================== */

  function ciz() {
    ipucuKaldir();          /* grafik ipucu belgeye ekleniyor: sayfa değişince kalmasın */

    var yol = hashCoz();
    var kod = yol.kod || MENU_USTU;

    if (!YU.oturum.kullanici) {
      /* Oturum yok: adres '#/giris' değilse oraya çevrilir. replace kullanılır
         — hash yığına eklenseydi geri tuşu giriş ile eski yol arasında
         zıplardı. Gidilmek istenen yol saklanır, girişten sonra oraya dönülür. */
      if (kod !== GIRIS_KODU) {
        girisSonrasiHedef = { kod: kod, param: yol.param };
        location.replace(location.pathname + location.search + hashKur(GIRIS_KODU));
        return;
      }
      YU.girisGoster();
      return;
    }

    /* Oturum varken '#/giris' anlamsızdır: ana sayfaya alınır. */
    if (kod === GIRIS_KODU) { YU.git(MENU_USTU); return; }

    YU.kabukGoster();
    aktif = { kod: kod, param: yol.param };

    donemOnbellek = null;
    donemBaslikTazele();
    ustSayaclariTazele();
    kilitUyariTazele();     /* geçmiş sezon kilitsizse üstte kalıcı şerit */
    cakismaTazele();        /* yazma durduysa uyarı penceresi her sayfada durur */
    menuIsaretle(kod);
    YU.bos(dom.eylemler);
    var kap = YU.bos(dom.kap);

    var tanim = YU.sayfalar[kod];
    geriYaz(tanim, aktif.param);   /* sol üstteki geri bağlantısı (varsa) */

    /* İçerik zemini: varsayılan 'gri' (gri zemin + beyaz panel, tema.css
       .yu-zemin-gri — kullanıcı isteği, 23.08.2026). Sayfa tanımı zemin: 'duz'
       derse sınıf kuralsız kalır ve ortak mavi panel düzeni görünür. */
    dom.icerik.className = 'yu-icerik yu-zemin-' + ((tanim && tanim.zemin) || 'gri') +
      /* ustDar: true diyen sayfa üst kenara yaklaşır (26.08.2026). Ortak
         dolgu değişmez, yalnız o sayfaya varyant sınıfı eklenir. */
      (tanim && tanim.ustDar ? ' yu-ust-dar' : '');

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
          YU.ui.dugme({ metin: 'Hesap Değiştir', ikon: '#ic-users', tur: 'ikincil', onClick: function () { YU.oturumKapat(); } })
        ]
      }));
      return;
    }

    var altMetin = typeof tanim.altBaslik === 'function'
      ? guvenli(function () { return tanim.altBaslik(yol.param); }, '')
      : (tanim.altBaslik || '');
    /* baslikGizle: sayfa kendi panelinde zaten aynı başlığı taşıyorsa üstteki
       sayfa başlığı çizilmez ve şerit tümden kapanır — içerik yukarı kayar
       (kullanıcı isteği, 25.08.2026). Sekme başlığı ve menü adı etkilenmez;
       tanım "baslik" alanını korur. */
    basligiYaz(tanim.baslikGizle ? '' : tanim.baslik, tanim.baslikGizle ? '' : altMetin, tanim.baslik);
    raporKunyesi(tanim);

    /* Yeni ekran çiziliyor: bir önceki ekranın çıkış kilidi burada düşer. */
    YU.cikisKilidi(false);
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

  /* Sayfa tanımındaki "geri" — {metin, kod, param} ya da param alan bir
     fonksiyon. Ok, mevcut #ic-chevron ikonunun 180° döndürülmüşüdür; yeni
     ikon çizilmez (CLAUDE.md KURAL 1). */
  function geriYaz(tanim, param) {
    if (!dom.geri) return;
    YU.bos(dom.geri);
    var g = tanim && typeof tanim.geri === 'function' ? tanim.geri(param) : (tanim ? tanim.geri : null);
    if (!g || !g.kod) return;
    /* İpucu, düğmenin YAZISINDAN değil HEDEF EKRANIN adından üretilir:
       yazı "Geri" olduğunda "Geri ekranına dön" anlamsız kalıyordu
       (kullanıcı isteği, 25.08.2026). Hedefin başlığı sayfa kaydından
       okunur; kayıt yoksa sade "Geri dön". */
    var hedef = YU.sayfalar[g.kod];
    dom.geri.appendChild(YU.h('a', {
      sinif: 'yu-geri-bag',
      href: '#/' + g.kod,
      title: hedef && hedef.baslik ? hedef.baslik + ' ekranına dön' : 'Geri dön',
      onClick: function (e) { e.preventDefault(); YU.git(g.kod, g.param || null); }
    },
      YU.h('span', { sinif: 'yu-geri-ok', 'aria-hidden': 'true' }, YU.svg('#ic-chevron', 22)),
      YU.h('span', { metin: g.metin })
    ));
  }

  function basligiYaz(baslik, alt, sekmeAdi) {
    dom.baslik.textContent = baslik || '';
    dom.baslik.style.display = baslik ? '' : 'none';
    dom.alt.textContent = alt || '';
    dom.alt.style.display = alt ? '' : 'none';
    /* Başlık, alt başlık ve geri bağlantısının üçü de boşsa şerit hiç yer
       kaplamasın: .yu-icerik satırları arasındaki 12px boşluk da düşsün. */
    if (dom.sayfaBas) {
      var bosMu = !baslik && !alt && !(dom.geri && dom.geri.firstChild);
      dom.sayfaBas.style.display = bosMu && !dom.eylemler.firstChild ? 'none' : '';
    }
    sekmeBasligi(sekmeAdi || baslik);
  }

  /* Kâğıda basılan rapor künyesi. Rapor adı sayfa tanımının baskiBasligi
     alanından gelir; yoksa ekran adı kullanılır — ama "Ana Sayfa" gibi
     ekran adları raporda anlamsız kaldığı için ana ekranlara kendi rapor
     adları verilmiştir (kullanıcı isteği, 26.08.2026). */
  var sonRaporAdi = UYGULAMA_ADI;

  function raporKunyesi(tanim) {
    if (!dom.baskiAd) return;
    var ad = (tanim && tanim.baskiBasligi) || (tanim && tanim.baslik) || UYGULAMA_ADI;
    sonRaporAdi = ad;
    dom.baskiAd.textContent = ad;
    dom.baskiTarih.textContent = YU.fmt.tarih(YU.tarih.bugun());

    var donem = guvenli(function () { return YU.donem.aktif(); }, null);
    dom.baskiAlt.textContent = donem ? 'Kampanya ' + donem.ad : '';
  }

  /* Tarayıcı sekmesi açık ekranın adını gösterir (kullanıcı isteği, 24.08.2026):
     birden çok pencere açıkken hepsi aynı başlıkla görünmesin.
     YAZDIRIRKEN sekme adı geçici olarak RAPOR ADINA döner: Chrome kâğıdın
     üstüne belge başlığını basıyor ve orada "Ana Sayfa" yazıyordu
     (kullanıcı isteği, 26.08.2026). Baskı bitince eski ada dönülür.
     Rapor adının yanına TARİH KONMAZ: künyede zaten var, Chrome'un kendi
     üstbilgisinde de var — kâğıdın başında üç tarih birikiyordu. */
  var ekranBasligi = UYGULAMA_ADI;

  function sekmeBasligi(baslik) {
    ekranBasligi = baslik ? String(baslik) : UYGULAMA_ADI;
    document.title = ekranBasligi;
  }

  window.addEventListener('beforeprint', function () {
    document.title = sonRaporAdi;
  });
  window.addEventListener('afterprint', function () {
    document.title = ekranBasligi;
  });

  /* ==================================================================
     11. Giriş ekranı (SOZLESME.md §8) — parola yok, rol seçimi
     ================================================================== */

  YU.girisGoster = function () {
    var k = kok();
    if (!k) return;
    popupKapat();
    ipucuKaldir();
    YU.bos(k);
    dom = {};
    kabukKurulu = false;
    donemOnbellek = null;
    sekmeBasligi('');

    var temaKap = YU.h('div', { stil: { position: 'absolute', top: '20px', right: '22px' } }, temaDugmesi());

    /* Rol kartları KALDIRILDI (kullanıcı kararı, 26.08.2026): giriş artık
       Şartname §3'ün (Demirbaş) istediği gibi kullanıcı adı + parola ile
       yapılır. Parolası olmayan hesap ilk girişte parolasını kurar (§10). */
    var adAlani = YU.ui.alan({ etiket: 'E-posta' });
    adAlani.girdi.type = 'email';
    adAlani.girdi.spellcheck = false;
    var parolaAlani = YU.ui.alan({ etiket: 'Parola', tip: 'parola' });
    adAlani.girdi.autocomplete = 'username';
    parolaAlani.girdi.autocomplete = 'current-password';

    var girisDugmesi = YU.ui.dugme({
      metin: 'Giriş Yap', ikon: '#ic-up', tur: 'birincil',
      onClick: function () { girisDene(); }
    });
    girisDugmesi.style.width = '100%';

    /* BENİ HATIRLA (kullanıcı isteği, 31.08.2026). İşaretliyse oturum
       localStorage'a yazılır ve tarayıcı kapanıp açılınca kişi içeride başlar;
       işaretsizse sessionStorage'a yazılır ve sekme kapanınca düşer.
       Uygulama yeri: YU.oturumAc / YU.oturumYukle. */
    var hatirlaKutusu = YU.h('input', { tip: 'checkbox' });
    hatirlaKutusu.checked = oku(HATIRLA_ANAHTAR) === '1';
    var hatirlaSatiri = YU.h('label', { sinif: 'yu-onay-cip yu-giris-hatirla' },
      hatirlaKutusu, YU.h('span', { metin: 'Beni Hatırla' }));
    hatirlaSatiri.title = 'Bu tarayıcı açılışında oturumunuz açık gelsin.';

    var kayitDugmesi = YU.ui.dugme({
      metin: 'Kayıt Ol', ikon: '#ic-plus', tur: 'ikincil',
      baslik: 'Kendi hesabınızı açın',
      onClick: function () {
        kayitPenceresi(function (yeniKullanici) { iceriAl(yeniKullanici, hatirlaKutusu.checked); });
      }
    });
    kayitDugmesi.style.width = '100%';

    function hataYaz(mesaj) {
      adAlani.hataGoster('');
      parolaAlani.hataGoster(mesaj || '');
    }

    function girisDene() {
      var ad = String(adAlani.deger() || '').trim();
      var p = parolaAlani.deger();

      if (!ad) { adAlani.hataGoster('E-posta adresinizi yazın.'); adAlani.odakla(); return; }

      var kul = kullaniciBul(ad);
      /* Hesap yoksa da pasifse de AYNI mesaj: hangi adresin kayıtlı olduğu
         deneme yanılmayla öğrenilmesin. */
      if (!kul || kul.Aktif === false) {
        hataYaz('E-posta veya parola hatalı.');
        parolaAlani.odakla();
        return;
      }

      /* Parolası olmayan hesap önce parolasını kurar (Şartname §10).
         Güvenli bağlam yoksa (file://) kurulamaz; eski davranış sürer. */
      if (!YU.parola.varMi(kul)) {
        if (!YU.parola.kurulabilirMi()) { iceriAl(kul, hatirlaKutusu.checked); return; }
        parolaKurmaPenceresi(kul, function () { iceriAl(kul, hatirlaKutusu.checked); });
        return;
      }

      /* GÜVENSİZ ADRESTE SESSİZ KİLİT YOK (26.08.2026). crypto.subtle yalnız
         güvenli bağlamda vardır (https ya da http://localhost); IIS düz http
         ile sunucu adından sunarsa yoktur ve YU.parola.dogrula her zaman
         false döner. Eskiden bu "E-posta veya parola hatalı" olarak
         görünüyordu: parolasını kurmuş kullanıcı sebebini anlamadan
         kilitleniyordu. Artık sebep yazılıyor. */
      if (!YU.parola.kurulabilirMi()) {
        hataYaz('Bu adres güvenli değil (HTTPS yok), parola doğrulanamıyor. ' +
          'Sunucuya HTTPS kurulmalı; geçici olarak uygulamayı sunucunun kendi ' +
          'üzerinden http://localhost adresiyle açabilirsiniz.');
        parolaAlani.odakla();
        return;
      }

      if (!p) { parolaAlani.hataGoster('Parolayı yazın.'); parolaAlani.odakla(); return; }

      girisDugmesi.disabled = true;
      hataYaz('');
      /* Doğrulama PBKDF2 olduğu için ~90 ms sürer; hızlı deneme yanılmanın
         maliyeti buradan gelir, ayrıca bir kilit mekanizması yoktur. */
      YU.parola.dogrula(p, kul.ParolaHash).then(function (uyuyor) {
        girisDugmesi.disabled = false;
        if (!uyuyor) {
          hataYaz('E-posta veya parola hatalı.');
          parolaAlani.ayarla('').odakla();
          return;
        }
        iceriAl(kul, hatirlaKutusu.checked);
      }, function () {
        girisDugmesi.disabled = false;
        hataYaz('Giriş denenemedi; sayfayı yenileyip tekrar deneyin.');
      });
    }

    function tusIsle(e) { if (e.key === 'Enter') { e.preventDefault(); girisDene(); } }
    adAlani.girdi.addEventListener('keydown', tusIsle);
    parolaAlani.girdi.addEventListener('keydown', tusIsle);

    /* PROTOTİP ADRES LİSTESİ KALDIRILDI (31.08.2026). "Kayıtlı adresler: …"
       satırı, kodda tanımlı üç örnek hesabın adreslerini kimse bilmediği için
       vardı. Artık kodda hesap yok; herkes kendi hesabını "Kayıt Ol" ile açıyor
       ve kendi adresini biliyor. Satırın tek işlevi, parola sıfırlandığı anda
       o hesabın adresini ekrana yazmak kalmıştı — yardım değil sızıntı. */

    var form = YU.h('div', { sinif: 'yu-giris-form' },
      adAlani.kok,
      parolaAlani.kok,
      hatirlaSatiri,
      girisDugmesi,
      kayitDugmesi
    );

    /* MARKA BLOĞU KALDIRILDI (kullanıcı isteği, 26.08.2026): "Y" karesi ve
       "Yan Ürünler Takip" satırı, hemen altındaki başlığın yumuşak bir
       tekrarıydı. Yerine asıl başlık geçti; kart artık başlıkla açılıyor.
       Marka bloğu uygulamanın içinde (sol menü) olduğu gibi duruyor. */
    var kart = YU.h('div', { sinif: 'yu-giris-kart' },
      YU.h('div', null,
        YU.h('div', { metin: 'Yan Ürünler Stok Takip', stil: { font: '600 24px/1.2 var(--font)', letterSpacing: '-.015em' } }),
        /* Alt satır KAMPANYA değil KURUM adıdır (kullanıcı isteği, 26.08.2026).
           Metin baskı künyesiyle aynı yerden gelir (KURUM_ADI) — iki yerde ayrı
           yazılıp birbirinden ayrı düşmesin. Büyük harf CSS ile yazılır ki
           sabitin kendisi okunur kalsın. */
        YU.h('div', {
          metin: KURUM_ADI,
          stil: {
            font: '600 13px/1.4 var(--font)', color: 'var(--metin-4)', marginTop: '6px',
            textTransform: 'uppercase', letterSpacing: '.08em'
          }
        })
      ),
      form,
      /* "Parolanız yoksa ilk girişte kurarsınız… hash'lenerek saklanır" satırı
         KALDIRILDI (kullanıcı isteği, 26.08.2026 · KURAL 11): kullanıcının
         sormadığı ve bir karara dönüşmeyen açıklamaydı. Aşağıdaki iki satır
         kalır — ikisi de bir ENGELİ ya da durumu bildirir.
         Marj düzeltmesi kalkan satıra göre verilmişti, o da kalktı. */
      /* Güvensiz adres uyarısı perdenin kendisinde durur: kullanıcı parolasını
         yazmadan önce görsün (26.08.2026). */
      YU.parola.kurulabilirMi() ? null : YU.h('div', {
        sinif: 'yu-giris-not',
        stil: { color: 'var(--olumsuz)' },
        metin: 'Bu adres güvenli değil (HTTPS yok). Parola doğrulaması çalışmaz; ' +
          'parolası kurulu hesaplar giriş yapamaz.'
      }),
      null
    );

    k.appendChild(YU.h('div', { sinif: 'yu-giris', stil: { position: 'relative' } },
      girisDeseni(), temaKap, kart));
    adAlani.odakla();
  };

  /* GİRİŞ DESENİ — İKİ BÜYÜK LOGO, biri solda biri sağda (kullanıcı isteği,
     26.08.2026: "2 adet yapsak, bir sağda bir solda, büyükçe... baya büyük
     olsun ama").

     Önce dört satırlık kaydırmalı ızgaraydı; dördü birden sığsın diye logo
     küçülmek zorunda kalıyordu. İki logoyla o kısıt kalktı: boy ekran
     yüksekliğinin %78'i kadar.

     TEK SINIR KARTIN GENİŞLİĞİ: logolar formun altına girmesin diye en, ekranın
     ortasında karta ayrılan paydan artan yerin yarısıyla sınırlanır. Dar
     ekranda logo kendiliğinden küçülür, oran (2:3) hiç esnemez. Kenardan bir
     tık İÇERİDE dururlar (kullanıcı isteği, 26.08.2026: "birazcık daha
     içeriye kaydır, az ama") — önce dışarı taşıyorlardı. */
  var desenIzleyici = null;

  function girisDeseni() {
    var BOY_ORANI = 0.78;   /* ekran yüksekliğine göre logo boyu */
    var KART_PAYI = 470;    /* ortada karta bırakılan genişlik (kart 420 + nefes) */
    var ICERI = 0.09;       /* logonun kenardan içeri çekildiği pay */
    var kap = YU.h('div', { sinif: 'yu-giris-desen', 'aria-hidden': 'true' });

    /* Giriş perdesinin deseni kendi dosyasını kullanır: LOGO-giris.png
       (1024x1536, eski kurum görseli). Kenar çubuğu 31.08.2026'da yatay
       görsele geçti; kullanıcı bu ekranın eski hâlinde kalmasını istedi. */
    function logo(sol, ust, en, boy) {
      var im = YU.h('img', { src: 'LOGO-giris.png', alt: '' });
      im.style.left = Math.round(sol) + 'px';
      im.style.top = Math.round(ust) + 'px';
      im.style.width = Math.round(en) + 'px';
      im.style.height = Math.round(boy) + 'px';
      kap.appendChild(im);
    }

    function doldur() {
      var genislik = window.innerWidth;
      var yukseklik = Math.max(window.innerHeight, document.documentElement.scrollHeight);

      var enSiniri = Math.max(120, (genislik - KART_PAYI) / 2);
      var boy = Math.min(yukseklik * BOY_ORANI, enSiniri * 1.5);   /* 2:3 -> boy = en × 1.5 */
      var en = boy * 2 / 3;
      var ust = (yukseklik - boy) / 2;
      var iceri = en * ICERI;

      YU.bos(kap);
      logo(iceri, ust, en, boy);                        /* sol */
      logo(genislik - en - iceri, ust, en, boy);        /* sağ */
    }

    doldur();
    /* Pencere ölçüsü değişince yeniden dizilir. Önceki izleyici sökülür ki
       her giriş çiziminde bir tane daha birikmesin. */
    if (desenIzleyici) window.removeEventListener('resize', desenIzleyici);
    desenIzleyici = function () {
      if (!document.body.contains(kap)) {
        window.removeEventListener('resize', desenIzleyici);
        desenIzleyici = null;
        return;
      }
      doldur();
    };
    window.addEventListener('resize', desenIzleyici);
    return kap;
  }

  function iceriAl(kullanici, hatirla) {
    YU.oturumAc(kullanici, hatirla);
    /* Kutunun durumu bir SONRAKİ açılış için saklanır; oturumun kendisi değil. */
    yaz(HATIRLA_ANAHTAR, hatirla ? '1' : '0');
    kabukKurulu = false;      /* menü role göre kurulduğu için sıfırdan çizilir */
    var hedef = girisSonrasiHedef;
    girisSonrasiHedef = null;
    /* Giriş öncesi istenen sayfaya dönülür; yoksa ana sayfa. Yetkisi yetmeyen
       bir sayfaysa ciz() zaten kendi yetki denetimine takar (Test 7). */
    if (hedef && hedef.kod && hedef.kod !== GIRIS_KODU) YU.git(hedef.kod, hedef.param);
    else YU.git(MENU_USTU);
  }

  /* ------------------------------------------------------------------
     KAYIT OL — kendi hesabını açma (kullanıcı direktifi, 31.08.2026)

     Kullanıcının sözü: "login kısmına bir adet register butonu koy… burada
     mail girilsin isim soy isim girilsin ve rol girilsin yonetici mi operator
     mu diye birde şifre ve şifre tekrarı."

     ŞARTNAMEDEN AYRILMA (KURAL 6): §3 (Demirbaş) hesap açmayı yalnız
     yöneticiye veriyordu. Kullanıcı açık kaydı istedi; kullanıcının kararı
     geçerlidir. Pratikte zorunlu da oldu — kodda tanımlı hesap kalmadığı için
     (01-cekirdek · KULLANICI_TANIMI boş) ilk hesabı açacak bir yönetici yok.

     Rolü kişi KENDİSİ seçer, kayıt sırasında onay yoktur. Yani bu ekran bir
     yetki kapısı değildir; yetkiyi rol taşır ve rolü kullanıcı belirler.
     Sonradan rol değiştirme yine yalnız yöneticidedir (Kullanıcı Yönetimi).

     Parola PBKDF2-SHA256 ile hash'lenir (YU.parola.olustur); düz metin hiçbir
     yere yazılmaz. Güvenli bağlam (https ya da localhost) yoksa hash
     üretilemez ve kayıt açılmaz — sebebi yazılır.
     ------------------------------------------------------------------ */
  function kayitPenceresi(bittiginde) {
    var m = null;

    var epostaAlan = YU.ui.alan({ etiket: 'E-posta', tip: 'metin' });
    epostaAlan.girdi.type = 'email';
    epostaAlan.girdi.spellcheck = false;
    epostaAlan.girdi.autocomplete = 'username';

    var adSoyadAlan = YU.ui.alan({ etiket: 'Ad Soyad', tip: 'metin' });
    adSoyadAlan.girdi.autocomplete = 'name';

    var rolAlan = YU.ui.alan({
      etiket: 'Rol', tip: 'secim',
      secenekler: [{ deger: 'Operator', metin: 'Operatör' }, { deger: 'Yonetici', metin: 'Yönetici' }],
      deger: 'Operator'
    });

    var parolaAlan = gozEkle(YU.ui.alan({
      etiket: 'Parola', tip: 'parola',
      yardim: 'En az ' + YU.parola.enAz + ' karakter.'
    }));
    var tekrarAlan = gozEkle(YU.ui.alan({ etiket: 'Parola (Tekrar)', tip: 'parola' }));
    parolaAlan.girdi.autocomplete = 'new-password';
    tekrarAlan.girdi.autocomplete = 'new-password';

    var hataKap = YU.h('div');

    /* AD SOYAD'DAN ADRES ÖNERİSİ: kişi adını yazınca e-posta alanı boşsa
       doldurulur (YU.ePosta.adres). Kişi kendi adresini yazdıysa dokunulmaz —
       öneri bir kez çalışır, üstüne yazmaz. */
    var epostaElleYazildi = false;
    epostaAlan.girdi.addEventListener('input', function () { epostaElleYazildi = true; });
    adSoyadAlan.girdi.addEventListener('input', function () {
      if (epostaElleYazildi) return;
      epostaAlan.ayarla(YU.ePosta.adres(adSoyadAlan.deger()));
    });

    function dugmeyiKilitle(kilit) {
      var d = m && m.modal ? m.modal.querySelector('.yu-modal-alt .yu-dugme.birincil') : null;
      if (d) d.disabled = !!kilit;
    }

    function kaydet() {
      var eposta = String(epostaAlan.deger() || '').trim();
      var adSoyad = String(adSoyadAlan.deger() || '').trim();
      var p = parolaAlan.deger(), t = tekrarAlan.deger();

      epostaAlan.hataGoster('');
      adSoyadAlan.hataGoster('');
      YU.bos(hataKap);

      if (!eposta) { epostaAlan.hataGoster('E-posta adresinizi yazın.'); epostaAlan.odakla(); return; }
      if (!YU.ePosta.gecerliMi(eposta)) {
        epostaAlan.hataGoster('Geçerli bir e-posta adresi yazın — ad.soyad@' + YU.ePosta.alanAdi + ' gibi.');
        epostaAlan.odakla();
        return;
      }
      if (!adSoyad) { adSoyadAlan.hataGoster('Ad soyad boş olamaz.'); adSoyadAlan.odakla(); return; }

      var d = YU.parola.denetle(p, t);
      parolaAlan.hataGoster(d.hata || '');
      tekrarAlan.hataGoster(d.tekrarHata || '');
      if (!d.ok) { (d.hata ? parolaAlan : tekrarAlan).odakla(); return; }

      /* Hash üretilemeyen bağlamda hesap AÇILMAZ: parolasız bir hesap yazıp
         "kaydoldunuz" demek, güvenlik yokken var sanmaktan kötüdür. */
      if (!YU.parola.kurulabilirMi()) {
        hataKap.appendChild(YU.ui.hataListesi([{ kod: 'Parola', mesaj:
          'Bu adres güvenli değil (HTTPS yok), parola şifrelenemiyor; hesap açılmadı. ' +
          'Sunucuya HTTPS kurulmalı ya da uygulama http://localhost adresiyle açılmalı.' }], 'hata'));
        return;
      }

      dugmeyiKilitle(true);
      YU.parola.olustur(p).then(function (hash) {
        var sonuc = YU.servis.kullaniciKayitOl(YU.db, {
          KullaniciAdi: eposta, AdSoyad: adSoyad, Rol: rolAlan.deger(), ParolaHash: hash
        });
        if (!sonuc.ok) {
          dugmeyiKilitle(false);
          YU.bos(hataKap).appendChild(YU.ui.hataListesi(sonuc.hatalar, 'hata'));
          return;
        }
        m.kapat();
        YU.ui.bildir(sonuc.kayit.AdSoyad + ' hesabı açıldı.', 'basari');
        bittiginde(sonuc.kayit);
      }, function (e) {
        dugmeyiKilitle(false);
        YU.bos(hataKap).appendChild(YU.ui.hataListesi(
          [{ kod: 'Parola', mesaj: (e && e.message) || 'Parola şifrelenemedi; hesap açılmadı.' }], 'hata'));
      });
    }

    function tusIsle(e) { if (e.key === 'Enter') { e.preventDefault(); kaydet(); } }
    epostaAlan.girdi.addEventListener('keydown', tusIsle);
    adSoyadAlan.girdi.addEventListener('keydown', tusIsle);
    parolaAlan.girdi.addEventListener('keydown', tusIsle);
    tekrarAlan.girdi.addEventListener('keydown', tusIsle);

    m = YU.ui.modal({
      baslik: 'Kayıt Ol',
      genislik: 470,
      /* KİRLİ PENCERE KİLİDİ YOK (kullanıcı isteği, 31.08.2026: "böyle bildirim
         gelmesin"). Pencerenin dışına tıklayınca "Kaydedilmemiş Değişiklik Var"
         sorusu çıkıyordu. Burada kaybolan bir VERİ yok — henüz açılmamış bir
         hesabın formu; kişi Kayıt Ol'a basıp yeniden doldurur. Soru, gerçek
         kayıp riski olan pencerelerde (malzeme girişi, kullanıcı düzenleme)
         duruyor; oralara dokunulmadı. */
      govde: [hataKap, epostaAlan.kok, adSoyadAlan.kok, rolAlan.kok, parolaAlan.kok, tekrarAlan.kok],
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m.kapat(); } },
        { metin: 'Hesabı Aç', tur: 'birincil', onClick: kaydet }
      ]
    });

    epostaAlan.odakla();
    return m;
  }

  /* ------------------------------------------------------------------
     Parola kurma penceresi (kullanıcı isteği, 26.08.2026)

     Klasik parola oluşturma: parola İKİ KEZ yazılır, ikisi eşleşmeden
     kaydedilmez. Kurallar YU.parola.denetle'de — OWASP Authentication Cheat
     Sheet'e göre bileşim zorunluluğu (büyük harf + rakam + simge) YOKTUR;
     uzunluk ve yaygın-parola listesi vardır. Hash'leme PBKDF2-SHA256 ile
     YU.parola.olustur'da; düz metin hiçbir yere yazılmaz.
     ------------------------------------------------------------------ */
  /* Göster/Gizle her satırın KENDİ sağında (kullanıcı isteği, 26.08.2026).
     Eskiden iki alanın altında tek ortak düğme vardı; hangi satırı açtığı
     belli olmuyordu. Artık her alan kendi başına açılıp kapanır.
     Modül kapsamına alındı (31.08.2026): Kayıt Ol penceresi de kullanıyor. */
  function gozDugmesi(alan) {
    var d = YU.h('button', { sinif: 'yu-girdi-goz', tip: 'button', metin: 'Göster' });
    d.title = 'Yazdığınız parolayı görün';
    d.addEventListener('click', function () {
      var acik = alan.girdi.type === 'text';
      alan.girdi.type = acik ? 'password' : 'text';
      d.textContent = acik ? 'Göster' : 'Gizle';
      alan.girdi.focus();
    });
    return d;
  }

  /* Parola alanının sağına Göster/Gizle düğmesini yerleştirir. */
  function gozEkle(alan) {
    alan.kok.querySelector('.yu-girdi-sar').appendChild(
      YU.h('span', { sinif: 'yu-girdi-sag yu-girdi-sag-eylem' }, gozDugmesi(alan)));
    return alan;
  }

  function parolaKurmaPenceresi(kullanici, bittiginde) {
    var m = null;

    var yeni = YU.ui.alan({
      etiket: 'Yeni Parola', tip: 'parola',
      yardim: 'En az ' + YU.parola.enAz + ' karakter.'
    });
    var tekrar = YU.ui.alan({ etiket: 'Yeni Parola (Tekrar)', tip: 'parola' });
    gozEkle(yeni);
    gozEkle(tekrar);

    /* Tarayıcı kayıtlı bir parolayı buraya doldurmasın. */
    yeni.girdi.autocomplete = 'new-password';
    tekrar.girdi.autocomplete = 'new-password';

    /* Parola gücü satırı KALDIRILDI (kullanıcı isteği, 26.08.2026: "parola
       gücü yazılmasın, önemli değil"). Zaten bir KAPI değildi — zayıf parola
       da kaydediliyordu. Asıl denetim (uzunluk + yaygın parola listesi)
       YU.parola.denetle'de duruyor ve değişmedi. */


    function kaydet() {
      var p = yeni.deger(), t = tekrar.deger();
      var d = YU.parola.denetle(p, t, kullanici.KullaniciAdi);
      yeni.hataGoster(d.hata || '');
      tekrar.hataGoster(d.tekrarHata || '');
      if (!d.ok) { (d.hata ? yeni : tekrar).odakla(); return; }

      var dugme = m && m.modal ? m.modal.querySelector('.yu-modal-alt .yu-dugme.birincil') : null;
      if (dugme) dugme.disabled = true;

      YU.parola.olustur(p).then(function (hash) {
        var sonuc = YU.servis.parolaKur(YU.db, kullanici.Id, hash, kullanici);
        if (!sonuc.ok) {
          if (dugme) dugme.disabled = false;
          yeni.hataGoster(sonuc.hatalar.length ? sonuc.hatalar[0].mesaj : 'Parola kaydedilemedi.');
          return;
        }
        m.kapat();
        YU.ui.bildir('Parolanız oluşturuldu.', 'basari');
        bittiginde();
      }, function (e) {
        if (dugme) dugme.disabled = false;
        yeni.hataGoster(e && e.message ? e.message : 'Parola kurulamadı.');
      });
    }

    function tusIsle(e) {
      if (e.key === 'Enter') { e.preventDefault(); kaydet(); }
    }
    yeni.girdi.addEventListener('keydown', tusIsle);
    tekrar.girdi.addEventListener('keydown', tusIsle);

    m = YU.ui.modal({
      baslik: 'Parola Oluşturun',
      baslikAlt: kullanici.AdSoyad + ' · ' + kullanici.KullaniciAdi,
      genislik: 470,
      govde: [
        /* Cümlenin "parola şifrelenerek saklanır…" kısmı KALDIRILDI (kullanıcı
           isteği, 26.08.2026 · KURAL 11): kararı değiştirmeyen açıklamaydı. */
        YU.h('div', { metin: 'Bu hesabın parolası yok. Devam etmeden bir parola belirleyin.' }),
        yeni.kok,
        tekrar.kok
      ],
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m.kapat(); } },
        { metin: 'Parolayı Kaydet', tur: 'birincil', onClick: kaydet }
      ]
    });

    yeni.odakla();
    return m;
  }

  /* ==================================================================
     12. UI yardımcıları — SOZLESME.md §6
     ================================================================== */

  YU.ui = YU.ui || {};

  YU.ui.dugme = function (s) {
    s = s || {};
    var d = YU.h('button', {
      tip: 'button',
      /* s.sinif: tek bir düğmeye ek varyant sınıfı (örn. yu-dugme-vurgulu). */
      sinif: 'yu-dugme ' + (s.tur || 'ikincil') + (s.kucuk ? ' kucuk' : '') +
        (s.sinif ? ' ' + s.sinif : ''),
      title: s.baslik || null,
      onClick: s.onClick || null
    }, s.ikon ? YU.svg(s.ikon, s.kucuk ? 13 : 15) : null, s.metin ? YU.h('span', { metin: s.metin }) : null);
    if (s.pasif) d.disabled = true;
    return d;
  };

  /* Düğme kılıklı tarih etiketi: "Bugün · 25.08.2026" (kullanıcı isteği,
     25.08.2026). Tarih kutusu olmayan panellerde hangi güne bakıldığını söyler.

     secenek.onSec verilirse rozet TIKLANABİLİR olur ve üstüne takvim açılır
     (kullanıcı isteği, 25.08.2026 — "buna tıklayınca da açılsın"); seçilen gün
     onSec(iso) ile bildirilir. secenek.enFazla tıklanabilir son gündür
     (varsayılan bugün). onSec yoksa rozet olay almayan düz etiket kalır. */
  YU.ui.tarihRozeti = function (tarih, etiket, secenek) {
    var iso = tarih || YU.tarih.bugun();
    var ad = etiket || 'Bugün';
    secenek = secenek || {};
    var icerik = [YU.svg('#ic-calendar', 13),
      YU.h('span', { metin: ad }),
      YU.h('b', { metin: YU.fmt.tarih(iso) })];

    if (typeof secenek.onSec !== 'function') {
      return YU.h('span', {
        sinif: 'yu-tarih-rozeti',
        title: ad + ' — bu panel ' + YU.fmt.tarih(iso) + ' gününü gösterir, tarih değiştirilemez.'
      }, icerik);
    }

    var enFazla = secenek.enFazla || YU.tarih.bugun();
    var rozet = YU.h('button', {
      tip: 'button',
      sinif: 'yu-tarih-rozeti acilir',
      title: ad + ' — ' + YU.fmt.tarih(iso) + ' · gün seçmek için tıklayın',
      onClick: function () {
        if (acikPopup && acikPopup.tetik === rozet) { popupKapat(); isaretle(); return; }
        var kutu = popupKutu(264);
        kutu.style.maxHeight = 'none';
        kutu.appendChild(takvimGovdesi(iso, enFazla, function (secilen) {
          popupKapat();
          isaretle();
          secenek.onSec(secilen);
        }));
        popupAc(rozet, kutu, true);
        isaretle();
      }
    }, icerik);

    function isaretle() {
      var acik = !!(acikPopup && acikPopup.tetik === rozet);
      rozet.className = 'yu-tarih-rozeti acilir' + (acik ? ' acik' : '');
    }
    return rozet;
  };

  /* ------------------------------------------------------------------
     TAKVİM — tarih rozetine tıklayınca açılan ay ızgarası
     (kullanıcı isteği, 25.08.2026). Tarayıcının yerleşik seçicisi yerine
     projenin kendi dili: ay gezinme okları, Pazartesi başlayan hafta,
     bugünün halkası, seçili günün dolu zemini ve altta "Bugün" düğmesi.
     Görünüm sonundan (bugün / kampanya sonu) ileri günler tıklanamaz —
     gelecek güne kayıt olmaz, D17 zaten reddeder.
     ------------------------------------------------------------------ */

  var TAKVIM_AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var TAKVIM_GUNLER = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

  function ikiHane(n) { return (n < 10 ? '0' : '') + n; }
  function isoKur(y, a, g) { return y + '-' + ikiHane(a) + '-' + ikiHane(g); }

  function takvimGovdesi(secili, enFazla, onSec) {
    var kok = YU.h('div', { sinif: 'yu-takvim' });
    var gosterilen = YU.tarih.ayBasi(secili) || YU.tarih.ayBasi(YU.tarih.bugun());
    var bugun = YU.tarih.bugun();

    function ay(fark) {
      var p = gosterilen.split('-');
      var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1 + fark, 1));
      return isoKur(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }

    function ciz() {
      YU.bos(kok);
      var p = gosterilen.split('-');
      var yil = Number(p[0]), ayNo = Number(p[1]);

      var geri = YU.h('button', {
        tip: 'button', sinif: 'yu-takvim-ok', title: 'Önceki ay', metin: '‹',
        onClick: function () { gosterilen = ay(-1); ciz(); }
      });
      var ileri = YU.h('button', {
        tip: 'button', sinif: 'yu-takvim-ok', title: 'Sonraki ay', metin: '›',
        onClick: function () { gosterilen = ay(1); ciz(); }
      });
      /* Tamamı ileride kalan aya geçilmez: boş ızgara açmanın anlamı yok. */
      if (isoKur(yil, ayNo, 1) >= YU.tarih.ayBasi(enFazla)) ileri.disabled = true;

      kok.appendChild(YU.h('div', { sinif: 'yu-takvim-bas' },
        geri,
        YU.h('span', { sinif: 'yu-takvim-ad', metin: TAKVIM_AYLAR[ayNo - 1] + ' ' + yil }),
        ileri));

      var hafta = YU.h('div', { sinif: 'yu-takvim-hafta' });
      for (var h = 0; h < 7; h++) hafta.appendChild(YU.h('span', { metin: TAKVIM_GUNLER[h] }));
      kok.appendChild(hafta);

      /* Pazartesi başlangıç: getUTCDay 0=Pazar, (gun + 6) % 7 ile kaydırılır. */
      var ilk = new Date(Date.UTC(yil, ayNo - 1, 1));
      var bosluk = (ilk.getUTCDay() + 6) % 7;
      var izgara = YU.h('div', { sinif: 'yu-takvim-izgara' });

      for (var i = 0; i < 42; i++) {
        var d = new Date(Date.UTC(yil, ayNo - 1, 1 - bosluk + i));
        var iso = isoKur(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        var disari = d.getUTCMonth() + 1 !== ayNo;
        var kapali = iso > enFazla;
        var sinif = 'yu-takvim-gun'
          + (disari ? ' disari' : '')
          + (iso === bugun ? ' bugun' : '')
          + (iso === secili ? ' secili' : '');
        izgara.appendChild(YU.h('button', {
          tip: 'button', sinif: sinif, metin: String(d.getUTCDate()),
          title: YU.fmt.tarih(iso) + (kapali ? ' — ileri gün seçilemez' : ''),
          onClick: (function (t, engel) {
            return function () { if (!engel) onSec(t); };
          })(iso, kapali)
        }));
        if (kapali) izgara.lastChild.disabled = true;
        /* Son satır tamamen sonraki aya düşüyorsa çizilmez (5 satırlık aylar). */
        if (i === 34 && d.getUTCMonth() + 1 !== ayNo && bosluk === 0) break;
      }
      kok.appendChild(izgara);

      kok.appendChild(YU.h('div', { sinif: 'yu-takvim-alt' },
        YU.ui.dugme({
          metin: enFazla === bugun ? 'Bugün' : 'Son Gün', ikon: '#ic-calendar',
          kucuk: true, tur: 'ikincil',
          onClick: function () { onSec(enFazla); }
        })));
    }

    ciz();
    return kok;
  }

  /* Gün gezinme üçlüsü: Önceki Gün · Bugün · Sonraki Gün (kullanıcı isteği,
     25.08.2026). Sayfa YÖNLENDİRMESİ yapmaz — her tıklamada onChange(iso)
     çağırır, çağıran paneli kendi yerinde yeniden çizer. Böylece aynı üçlü
     Ana Sayfa'daki panellerde de çalışır. Bugün düğmesi kampanya bakışına
     uyar: geçmiş kampanyada adı "Kampanya Sonu" olur ve oraya götürür.
     İleri gidiş görünüm sonunda durur (gelecek güne kayıt olmaz). */
  YU.ui.gunGezinme = function (tarih, onChange) {
    var son = YU.donem.gorunumSonu();
    var gecmis = YU.donem.gecmisMi();
    var ileriKapali = tarih >= son;
    return YU.h('div', { sinif: 'yu-gun-gezinme yu-baski-yok' },
      YU.ui.dugme({
        metin: 'Önceki Gün', kucuk: true, tur: 'ikincil',
        onClick: function () { onChange(YU.tarih.ekle(tarih, -1)); }
      }),
      YU.ui.dugme({
        metin: gecmis ? 'Kampanya Sonu' : 'Bugün', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
        onClick: function () { onChange(son); }
      }),
      YU.ui.dugme({
        metin: 'Sonraki Gün', kucuk: true, tur: 'ikincil',
        pasif: ileriKapali,
        baslik: ileriKapali
          ? (gecmis ? 'Kampanya sonundan ileri gidilemez' : 'Bugünden ileri gidilemez')
          : '',
        onClick: function () { onChange(YU.tarih.ekle(tarih, 1)); }
      }));
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
        /* baslik metin YA DA düğüm olabilir (25.08.2026): bazı panellerde
           başlığın yanına silik bir ek konuyor (örn. karşılaştırılan aylar). */
        (s.baslik && s.baslik.nodeType)
          ? YU.h('div', { sinif: 'yu-panel-baslik', stil: { flex: '1' } }, s.baslik)
          : YU.h('div', { sinif: 'yu-panel-baslik', metin: s.baslik || '', stil: { flex: '1' } }),
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

  /* Kampanya kilidi uyarısı (kullanıcı isteği, 24.08.2026): kilitli
     kampanyada değişiklik denenince küçük pencere açılır ve kilit
     yönetimine bağlantı verir. s.hatalar içinde KILIT kodu varsa pencere
     açılır ve true döner — çağıran ekran normal hata akışını atlar. */
  YU.ui.kilitYakala = function (s) {
    var h = s && s.hatalar, i, bulunan = null;
    if (h) for (i = 0; i < h.length; i++) if (h[i] && h[i].kod === 'KILIT') { bulunan = h[i]; break; }
    if (!bulunan) return false;
    var m = YU.ui.modal({
      baslik: 'Kampanya Kilitli',
      genislik: 480,
      govde: [YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        YU.h('div', { metin: bulunan.mesaj, stil: { font: '400 14px/1.6 var(--font)', color: 'var(--metin)' } }),
        YU.h('div', {
          metin: 'Kilidi yalnız yönetici, Devir Stok ve Kampanya Yönetimi ekranından açabilir.',
          stil: { font: '400 13px/1.55 var(--font)', color: 'var(--metin-3)' }
        })
      )],
      dugmeler: [
        { metin: 'Vazgeç' },
        {
          metin: 'Kampanya Yönetimine Git', ikon: '#ic-wallet', tur: 'birincil',
          onClick: function () { m.kapat(); YU.git('devir-stok'); }
        }
      ]
    });
    return true;
  };

  YU.ui.rozet = function (metin, tur) {
    return YU.h('span', { sinif: 'yu-rozet ' + (tur || 'notr'), metin: metin === null || metin === undefined ? '' : String(metin) });
  };

  /* ------------------------------------------------------------------
     Açılır çip — tıklanınca altında kutu açan filtre düğmesi.
     Tasarım referansındaki "Durum: Tümü" / dönem seçici çipinin dili.
     Ekranın filtre satırını üç banttan tek satıra indirmek için var:
     seçim kutuları kutunun içine girer, çipte yalnız SEÇİLİ DEĞER yazar.

       {etiket, metin, ikon, baslik, genislik, hiza, dolgu,
        govde: Element | function(kapat) -> Element}

     `govde` işlev verilirse her açılışta yeniden kurulur (taze durum) ve
     kutuyu kapatan işlevi parametre olarak alır. */
  YU.ui.acilirCip = function (s) {
    s = s || {};
    var tamMetin = s.metin === null || s.metin === undefined ? '' : String(s.metin);
    /* Uzun değer çipi şişirip araç şeridini alt satıra kırıyordu; değer
       kırpılır, tamamı title'da kalır (kullanıcı düzeltmesi, 23.08.2026). */
    var degerEl = YU.h('span', { sinif: 'yu-cip-deger', metin: tamMetin });
    if (s.enGenis) {
      degerEl.style.maxWidth = s.enGenis + 'px';
      degerEl.style.overflow = 'hidden';
      degerEl.style.textOverflow = 'ellipsis';
      degerEl.style.whiteSpace = 'nowrap';
    }
    var cip = YU.h('button', {
      tip: 'button',
      sinif: 'yu-cip acilir',
      title: (s.baslik ? s.baslik + ': ' : '') + tamMetin,
      onClick: function () {
        if (acikPopup && acikPopup.tetik === cip) { popupKapat(); isaretle(); return; }
        var kutu = popupKutu(s.genislik || 320, s.hiza);
        if (s.dolgu) kutu.style.padding = s.dolgu;
        if (s.baslik) kutu.appendChild(popupBaslik(s.baslik));
        cocukEkle(kutu, typeof s.govde === 'function' ? s.govde(function () { popupKapat(); isaretle(); }) : s.govde);
        popupAc(cip, kutu, true);
        isaretle();
      }
    },
      s.ikon ? YU.svg(s.ikon, 14) : null,
      s.etiket ? YU.h('span', { sinif: 'yu-cip-etiket', metin: s.etiket }) : null,
      degerEl,
      YU.h('span', { sinif: 'yu-cip-ok' }, YU.svg('#ic-chevron', 12))
    );

    /* Kutu açıkken çip vurgulu durur: hangi filtrenin açık olduğu belli olsun. */
    function isaretle() {
      var acik = !!(acikPopup && acikPopup.tetik === cip);
      cip.className = 'yu-cip acilir' + (acik ? ' acik' : '');
    }
    return cip;
  };

  /* Segment düğmesi — iki üç seçenekli tercihler. Açılır liste açmaya
     değmeyecek kadar az seçenek varsa hepsi görünür durur.
  /* Açılır kutu içinde kullanılacak seçim listesi satırı. */
  YU.ui.acilirSatir = function (s) {
    s = s || {};
    var satir = YU.h('button', {
      tip: 'button',
      stil: {
        display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
        padding: '9px 10px', border: '0', borderRadius: 'var(--r-s)',
        background: s.secili ? 'var(--vurgu-zemin)' : 'transparent',
        color: s.secili ? 'var(--vurgu)' : 'var(--metin-2)',
        font: (s.secili ? '500' : '400') + ' 14.5px/1.3 var(--font)',
        textAlign: 'left', cursor: 'pointer'
      },
      onClick: s.onClick || null
    },
      YU.h('span', { metin: s.metin, stil: { flex: '1', minWidth: '0' } }),
      s.sag ? YU.h('span', { metin: s.sag, stil: { font: '400 13px/1 var(--sayi)', color: 'var(--metin-4)', flex: 'none' } }) : null,
      s.secili ? YU.svg('#ic-up', 13) : null
    );
    satir.addEventListener('mouseenter', function () {
      if (!s.secili) satir.style.background = 'var(--yuzey-3)';
    });
    satir.addEventListener('mouseleave', function () {
      if (!s.secili) satir.style.background = 'transparent';
    });
    return satir;
  };

  /* Ölçü satırı: "168.000 kg / 168 ton / 6.720 adet".
     Sayı bulunduğu yerin yazı tipini sürdürür, birim küçük ve soluk yazılır;
     böylece kg / ton / adet ayrımı tek bakışta okunur. Parçalar dar kolonda
     satır sarar, hizalama çağıranın hizasını izler. */
  YU.ui.olcu = function (parcalar, hiza) {
    /* yu-olcu + data-parca (28.08.2026): Excel dışa aktarımı sayı hücresini
       yu-mono sınıfından tanıyordu; ölçülü hücreler (sayı + birim) bu sınıfı
       taşımadığı için "1.000 kg" METİN olarak gidiyor, Excel'de toplanamıyordu.
       Kök kendini tanıtır: tek ölçülü hücre sayıya çözülür, çift ölçülü
       ("1.000 kg / 40 adet") metin kalır — iki değerden biri seçilemez. */
    var kap = YU.h('span', {
      sinif: 'yu-olcu',
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
    kap.setAttribute('data-parca', String(kap.children.length));
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

  /* hunili (isteğe bağlı): küspe silosu görünümü — silindir gövde altta konik
     huniyle kısa bir boşaltma ağzına iner (kullanıcı isteği, 24.08.2026).
     Verilmezse eski düz tabanlı silindir çizilir; Silo Durumu öyle kalır. */
  YU.ui.siloSekli = function (oran, tur, hunili) {
    var G = 104, Y = 151;               /* viewBox */
    var rx = 36, ry = 13;               /* gövde yarı genişliği, kapak basıklığı */
    var cx = G / 2;
    var ust = ry + 2.5, alt = Y - ry - 2.5;
    var tepe = ust - ry, taban = alt + ry;   /* şeklin gerçek uç noktaları */
    var renk = RENK_METIN[tur] || 'var(--vurgu)';

    var o = Math.max(0, Math.min(1, Number(oran) || 0));
    var kirpId = 'yu-silo-kirp-' + (++siloKirpSayac);

    var govdeAlt = null, siluet;
    if (hunili) {
      govdeAlt = 103;                   /* silindirin bittiği, huninin başladığı yer */
      var agz = 9, huniAlt = 136;       /* ağız yarı genişliği, huninin ağza indiği yer */
      alt = govdeAlt;                   /* dolum seviyesi de bu eksene kenetlenir */
      taban = Y - 4;
      siluet = 'M ' + (cx - rx) + ' ' + ust +
        ' A ' + rx + ' ' + ry + ' 0 0 1 ' + (cx + rx) + ' ' + ust +
        ' L ' + (cx + rx) + ' ' + govdeAlt +
        ' L ' + (cx + agz) + ' ' + huniAlt +
        ' L ' + (cx + agz) + ' ' + taban +
        ' L ' + (cx - agz) + ' ' + taban +
        ' L ' + (cx - agz) + ' ' + huniAlt +
        ' L ' + (cx - rx) + ' ' + govdeAlt + ' Z';
    } else {
      siluet = 'M ' + (cx - rx) + ' ' + ust +
        ' A ' + rx + ' ' + ry + ' 0 0 1 ' + (cx + rx) + ' ' + ust +
        ' L ' + (cx + rx) + ' ' + alt +
        ' A ' + rx + ' ' + ry + ' 0 0 1 ' + (cx - rx) + ' ' + alt + ' Z';
    }

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
       kenetlenir: dolum alt kapağın dışına sarkmaz, üst kapağa taşmaz.
       Hunili biçimde alt kapak yok; dolum huninin ucuna kadar inebilir. */
    if (o > 0) {
      var seviye = taban - o * (taban - tepe);
      seviye = Math.max(ust, Math.min(hunili ? taban : alt, seviye));
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

    /* Hunili biçimde gövde–huni birleşimine ön yay: kuşak izlenimi. */
    if (hunili) {
      var kusak = svgOge('path', {
        d: 'M ' + (cx - rx) + ' ' + govdeAlt +
           ' A ' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ' ' + govdeAlt,
        fill: 'none', stroke: 'var(--silo-cizgi)', 'stroke-width': 1.2
      });
      kusak.style.opacity = '.6';
      svg.appendChild(kusak);
    }

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

  /* HATA ŞERİDİNİN İKONU % DEĞİL, UYARI ÜÇGENİ (kullanıcı isteği,
     27.08.2026: "% kaydete uygun değil"). "%" yüzde demek; kaydın
     reddedildiğini anlatmıyordu — tasarım referansındaki ikon setinde
     bu anlamın karşılığı #ic-alert'tir (üçgen + ünlem), engellenen işlemin
     yerleşik gösterimi. Kuru Küspe ekranındaki "Kaydedilemez:" satırı da
     zaten aynı ikonu kullanıyor; iki ekran artık aynı dili konuşuyor.
     Yeni ikon ÇİZİLMEDİ, onaylı setten seçildi (KURAL 1). */
  var SERIT_IKON = { hata: '#ic-alert', uyari: '#ic-bell', bilgi: '#ic-doc', basari: '#ic-checklist' };

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

  /* ------------------------------------------------------------------
     Kaydırmalı sütun grafiği (kullanıcı isteği, 25.08.2026)
     sutunGrafik'i yatay kaydırılan bir kaba alır: sütunlar DOĞAL
     genişliğinde çizilir, panele kaç gün sığıyorsa o kadarı görünür.
     En yeni günler sağdadır; eskiye fareyle sürükleyerek ya da iki yandaki
     oklarla gidilir (oka basılı tutulursa sürekli kayar).
     Ayarlar: sutunGrafik'in tüm alanları + enFazlaGun (görünür pencere üst
     sınırı; verilmezse sınır yok).
     Döner: { govde, notEl } — notEl panel başlığına konur, gerçekten taşma
     yoksa içeriği temizlenir.
     Hem Silo Durumu'ndaki dökme grafiği hem Aylık Özet'in gün gün grafiği
     bunu kullanır; davranış tek yerde tanımlı kalsın diye ortaklaştırıldı.
     ------------------------------------------------------------------ */

  /* HATA DÜZELTMESİ (25.08.2026): bu fonksiyonun adı aşağıdaki dört
     parametreli 'grafikOku' ile ÇAKIŞIYORDU. Aynı kapsamdaki ikinci tanım
     birinciyi ezdiği için kaydırmalı grafiğin okları 'kaydirKap' almadan
     çalışıyor ve tıklamada "Cannot read properties of undefined (reading
     'scrollLeft')" hatası veriyordu. Ad ayrıldı; kaydırma mantığı zaten
     çağıranda (okBagla). Ölçü de küçültüldü (kullanıcı isteği). */
  function grafikOkuSade(yon) {
    return YU.h('button', {
      tip: 'button',
      'aria-label': yon === 'sol' ? 'Grafiği sola kaydır' : 'Grafiği sağa kaydır',
      title: (yon === 'sol' ? 'Sola' : 'Sağa') + ' kaydır · basılı tutarsan sürekli kayar',
      stil: {
        flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '24px', height: '44px', padding: '0',
        border: '1px solid var(--kenar)', borderRadius: 'var(--r-s)',
        background: 'var(--yuzey-2)', color: 'var(--metin-3)', cursor: 'pointer'
      }
    }, YU.h('span', {
      stil: { display: 'flex', transform: yon === 'sol' ? 'rotate(180deg)' : 'none' }
    }, YU.svg('#ic-chevron', 14)));
  }

  YU.ui.kaydirmaliGrafik = function (s) {
    s = s || {};
    var veri = s.veri || [];
    var notEl = YU.h('span', { metin: ' · sürükleyerek gezin' });
    var govde = veri.length
      ? YU.ui.sutunGrafik(s)
      : YU.h('div', { sinif: 'yu-bos-metin', metin: s.bos || 'Grafik için kayıtlı gün yok.' });

    var svgEl = veri.length && govde.querySelector ? govde.querySelector('svg') : null;
    if (!svgEl) { notEl.textContent = ''; return { govde: govde, notEl: notEl }; }

    /* Doğal genişlik sutunGrafik'in viewBox'ından okunur; yüzde verilseydi
       sütunlar esner ve gün sayısı panele göre sabitlenirdi. */
    var kutu = String(svgEl.getAttribute('viewBox') || '').split(/\s+/);
    var dogalEn = Number(kutu[2]) || 0;
    if (!dogalEn) { notEl.textContent = ''; return { govde: govde, notEl: notEl }; }
    svgEl.style.width = dogalEn + 'px';
    svgEl.style.minWidth = dogalEn + 'px';
    svgEl.style.maxWidth = 'none';

    var kaydirKap = YU.h('div', {
      sinif: 'yu-grafik-kaydir',            /* kaydırma çubuğu gizli (tema.css) */
      stil: {
        overflowX: 'auto', overflowY: 'hidden', cursor: 'grab',
        userSelect: 'none', WebkitUserSelect: 'none'   /* sürüklerken metin seçilmesin */
      }
    });
    /* Görünür pencere üst sınırı: panel çok genişse bile en fazla bu kadar
       gün gösterilir, kalanı kaydırmada kalır. */
    if (s.enFazlaGun > 0 && veri.length > s.enFazlaGun) {
      kaydirKap.style.maxWidth = Math.round(dogalEn / veri.length * s.enFazlaGun) + 'px';
    }
    svgEl.parentNode.insertBefore(kaydirKap, svgEl);
    kaydirKap.appendChild(svgEl);

    var solOk = grafikOkuSade('sol'), sagOk = grafikOkuSade('sag');
    govde.appendChild(YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', gap: '4px', minWidth: '0' }
    }, solOk, YU.h('div', { stil: { flex: '0 1 auto', minWidth: '0' } }, kaydirKap), sagOk));

    function uclariTazele() {
      var solda = kaydirKap.scrollLeft <= 1;
      var sagda = kaydirKap.scrollLeft >= kaydirKap.scrollWidth - kaydirKap.clientWidth - 1;
      solOk.disabled = solda;
      sagOk.disabled = sagda;
      solOk.style.opacity = solda ? '.3' : '';
      sagOk.style.opacity = sagda ? '.3' : '';
    }
    kaydirKap.addEventListener('scroll', uclariTazele);
    /* Pencere boyutu değişince görünen gün sayısı ve uçlar değişir. */
    window.addEventListener('resize', uclariTazele);

    /* Fareyle sürükle-kaydır; dokunmatikte tarayıcının kendi kaydırması var.
       Tarayıcının SVG'yi "görsel" olarak sürüklemesi kapatılır: aksi hâlde
       basılı tutup çekince kaydırma yerine sürükleme hayaleti başlıyor ve
       kullanıcı "kaymıyor" diye görüyor. */
    kaydirKap.addEventListener('dragstart', function (e) { e.preventDefault(); });
    if (svgEl.setAttribute) svgEl.setAttribute('draggable', 'false');
    svgEl.style.webkitUserDrag = 'none';

    /* Tekerlekle de yatay gezinme: grafiğin üstünde tekerlek çevrilince
       sayfa kaymak yerine grafik sağa-sola gider (taşma varsa).
       s.tekerleksiz ile kapatılır (kullanıcı isteği, 25.08.2026 — Dökme
       Üretim–Dökme Satış grafiğinde tekerlek sayfayı kaydırsın, grafiği
       değil). Oklar ve sürükleme aynen çalışmaya devam eder. */
    if (!s.tekerleksiz) {
      kaydirKap.addEventListener('wheel', function (e) {
        if (kaydirKap.scrollWidth <= kaydirKap.clientWidth + 1) return;
        var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (!d) return;
        kaydirKap.scrollLeft += d;
        uclariTazele();
        e.preventDefault();
      }, { passive: false });
    }

    var suruklaAktif = false, baslangicX = 0, baslangicKaydir = 0;
    kaydirKap.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;                 /* yalnız sol tuş */
      suruklaAktif = true;
      baslangicX = e.pageX;
      baslangicKaydir = kaydirKap.scrollLeft;
      kaydirKap.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!suruklaAktif) return;
      kaydirKap.scrollLeft = baslangicKaydir - (e.pageX - baslangicX);
      uclariTazele();
    });
    window.addEventListener('mouseup', function () {
      if (!suruklaAktif) return;
      suruklaAktif = false;
      kaydirKap.style.cursor = 'grab';
    });

    /* Oka basılı tutunca sürekli kaydırma. Uçlar adımın hemen ardından
       DOĞRUDAN tazelenir: programatik kaydırmada 'scroll' olayı gecikmeli
       gelebiliyor ve okun pasif durumu bir adım geride kalıyordu. */
    function okBagla(dugme, yon) {
      var zamanlayici = null, gecikme = null;
      function adim() { kaydirKap.scrollLeft += yon * 60; uclariTazele(); }
      function basla(e) {
        e.preventDefault();
        if (dugme.disabled) return;
        adim();
        gecikme = setTimeout(function () {
          zamanlayici = setInterval(function () {
            if (dugme.disabled) { dur(); return; }
            adim();
          }, 40);
        }, 300);
      }
      function dur() {
        if (gecikme) { clearTimeout(gecikme); gecikme = null; }
        if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
      }
      dugme.addEventListener('mousedown', basla);
      dugme.addEventListener('mouseup', dur);
      dugme.addEventListener('mouseleave', dur);
      window.addEventListener('mouseup', dur);
    }
    okBagla(solOk, -1);
    okBagla(sagOk, 1);

    /* En yeni günler sağda: açılışta sağ uca kaydırılır. Oklar ve not
       yalnız GERÇEKTEN taşma varsa görünür. */
    setTimeout(function () {
      kaydirKap.scrollLeft = kaydirKap.scrollWidth;
      if (kaydirKap.scrollWidth <= kaydirKap.clientWidth + 1) {
        kaydirKap.style.cursor = 'default';
        solOk.style.display = 'none';
        sagOk.style.display = 'none';
        notEl.textContent = '';
      }
      uclariTazele();
    }, 0);

    return { govde: govde, notEl: notEl };
  };

  /* Ebeveyn + yavru satır çiftini TEK SATIR gibi hoverlar (kullanıcı isteği,
     26.08.2026: "aynı hovera al"): fare hangisinin üstündeyse ikisine de
     .yu-satir-es-hover takılır. CSS'te önceki-kardeş seçici olmadığı için
     eşleme burada kurulur. */
  function ciftHoverBagla(ust, alt) {
    function ac() { ust.classList.add('yu-satir-es-hover'); alt.classList.add('yu-satir-es-hover'); }
    function kapa() { ust.classList.remove('yu-satir-es-hover'); alt.classList.remove('yu-satir-es-hover'); }
    ust.addEventListener('mouseenter', ac);
    ust.addEventListener('mouseleave', kapa);
    alt.addEventListener('mouseenter', ac);
    alt.addEventListener('mouseleave', kapa);
  }

  YU.ui.tablo = function (s) {
    s = s || {};
    var sutunlar = s.sutunlar || [];
    var satirlar = s.satirlar || [];
    /* 'sik' = Değişiklik Geçmişi listesinin beğenilen stili (kullanıcı isteği,
       21.08.2026): kompakt dolgu + tek tip 42px satır yüksekliği. VARSAYILAN
       AÇIK; içinde giriş alanı olan düzenleme tabloları sik:false geçer. */
    var sikMi = s.sik !== false;
    /* s.yapiskan ARTIK YOK SAYILIR (kullanıcı kararı, 26.08.2026): yapışkan
       kolon başlığı, sarıcıyı yatay kaydırma kabı olmaktan çıkardığı için
       geniş tabloyu dar ekranda kırpıyordu. Gerekçe ve ölçüm tema.css'te.
       Seçenek çağrılarda duruyor ama hiçbir şey yapmıyor; sarıcı her ölçüde
       yatay kayar (.yu-tablo-sar overflow-x: auto). */
    /* s.sinif: sarıcıya ek sınıf (örn. yu-tablo-iri) — tek bir tablonun
       ölçüsünü diğerlerine dokunmadan değiştirmek için. */
    /* ŞERİT (kullanıcı isteği, 26.08.2026): tüm tablolarda satırlar bir
       zeminli bir zeminsiz okunur. VARSAYILAN AÇIK; bir tablo istemezse
       serit:false geçer. Sarıcıdaki sınıf hover tonunu da koyulaştırır
       (tema.css · .yu-tablo-serit). */
    var seritli = s.serit !== false;
    var sar = YU.h('div', {
      sinif: 'yu-tablo-sar' + (seritli ? ' yu-tablo-serit' : '') + (s.sinif ? ' ' + s.sinif : '')
    });

    if (!satirlar.length) {
      sar.appendChild(YU.h('div', { sinif: 'yu-bos' },
        YU.h('div', { sinif: 'yu-bos-metin', metin: s.bos || 'Gösterilecek kayıt yok.' })
      ));
      return sar;
    }

    /* dolgu: yalnız çağıran isterse hücre dolgusunu değiştirir (kullanıcı
       isteği, 25.08.2026 — Analizler'de kolonlar birbirine yapışıktı).
       Geçilmezse eski davranış birebir korunur. */
    var hucreDolgu = s.dolgu || ((s.kompakt || sikMi) ? '8px 14px' : null);
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
      /* su.sinif: kolonun BAŞLIĞINA ve HÜCRELERİNE eklenen sınıf (örn. sol
         ayraç çizgisi). Ortak tablo görünümü değişmez; yalnız isteyen kolon
         alır (KURAL 10.5). */
      if (su.sinif) sinif = (sinif ? sinif + ' ' : '') + su.sinif;
      var th = YU.h('th', { sinif: sinif, metin: su.baslik || '' });
      if (hucreDolgu) th.style.padding = hucreDolgu;
      trBas.appendChild(th);
    }
    thead.appendChild(trBas);

    var tbody = YU.h('tbody');
    /* Şerit sayacı: yalnız SIRADAN satırlar sayılır. Kendi zemini olan TOPLAM
       ve `zemin` bayraklı satırlar ne şerit alır ne de ritmi kaydırır.
       YAVRU satır ise ebeveyninin şeridini SÜRDÜRÜR: ikisi tek satır gibi
       okunur (kullanıcı isteği, 26.08.2026 — "aynı satır olarak al").
       seritAcik = bir önceki sıradan satır şeritli miydi. */
    var seritSayac = 0, seritAcik = false, oncekiTr = null;
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
        /* zemin: satıra kalıcı dolgu zemini (fare üstündeymiş görünümü) —
           anlamca zıt satırları ayırmak için seçimli; tıklanır satırın
           hover/odak vurgusu CSS'te bu sınıfı ezer. */
        if (ham.zemin) tr.className = tr.className ? tr.className + ' yu-satir-zemin' : 'yu-satir-zemin';
        /* toplam: TOPLAM satırı için koyu zemin + üst çizgi (kullanıcı
           isteği, 25.08.2026) — veri satırlarından açıkça ayrılsın. */
        if (ham.toplam) tr.className = tr.className ? tr.className + ' yu-satir-toplam' : 'yu-satir-toplam';
        /* sinif: satıra serbest sınıf — bir satırı diğerine BAĞLI göstermek
           gibi tek tabloya özel düzenler için (26.08.2026). */
        if (ham.sinif) tr.className = tr.className ? tr.className + ' ' + ham.sinif : ham.sinif;
      }
      /* classList.contains TAM SINIF ADI arar: 'yu-satir-yavrulu' (ebeveyn)
         ile 'yu-satir-yavru' (alt satır) birbirine karışmaz. */
      var yavruMu = tr.classList.contains('yu-satir-yavru');
      if (seritli) {
        if (ham && (ham.toplam || ham.zemin)) seritAcik = false;
        else if (!yavruMu) seritAcik = (seritSayac++ % 2 === 1);
        /* yavruMu ise seritAcik olduğu gibi kalır = ebeveynin durumu */
        if (seritAcik) {
          tr.className = tr.className ? tr.className + ' yu-satir-serit' : 'yu-satir-serit';
        }
      }
      for (var c = 0; c < hucreler.length; c++) {
        var sut = sutunlar[c] || {};
        var siniflar = [];
        if (sut.hiza === 'sag') siniflar.push('yu-sag');
        else if (sut.hiza === 'orta') siniflar.push('yu-orta');
        if (sut.mono) siniflar.push('yu-mono');
        if (sut.sinif) siniflar.push(sut.sinif);
        var td = YU.h('td', { sinif: siniflar.join(' ') });
        if (hucreDolgu) td.style.padding = hucreDolgu;
        cocukEkle(td, hucreler[c]);
        tr.appendChild(td);
      }
      if (sikMi) tr.style.height = '42px';   /* min yükseklik gibi davranır; taşan içerik satırı büyütür */
      tbody.appendChild(tr);
      /* Eşleme tbody'ye eklendikten SONRA kurulur; önce kurulsa
         previousSibling daha null olurdu. */
      if (yavruMu && oncekiTr) ciftHoverBagla(oncekiTr, tr);
      oncekiTr = tr;
    }

    tablo.appendChild(colgroup);
    tablo.appendChild(thead);
    tablo.appendChild(tbody);
    sar.appendChild(tablo);
    return sar;
  };

  /* KİLİTLİ KAMPANYA GÜNÜ — SALT OKUNUR (kullanıcı kararı, 01.09.2026:
     "kilitli kampanyanın tarihine girilirse burası kilitli gibi uyarı gelsin,
     değiştirilmesin, sadece okuma olayı geçerli olsun").

     Yazma tarafı zaten kapalıydı: 04-servis · yazmaEngeli kilitli kampanyanın
     gününe yazmayı reddediyor. Eksik olan, operatörün bunu KAYDETMEYİ
     DENEMEDEN görmesiydi — kutular doluyor, düğmeye basılıyor, sonra hata
     alınıyordu. Bu iki yardımcı giriş ekranlarında o boşluğu kapatır. */
  YU.ui.kilitliGunSeridi = function (kilit, tarih) {
    return YU.ui.serit({
      tur: 'hata', ikon: '#ic-kilit',
      baslik: 'Bu Gün Kilitli — Yalnız Okunur',
      metin: '"' + kilit.Kampanya + '" kampanyası kilitli. ' + YU.fmt.tarih(tarih) +
        ' günü görüntülenebilir ama değiştirilemez; kayıt için kilidi bir ' +
        'yöneticinin açması gerekir.'
    });
  };

  /* Verilen kapların içindeki bütün girdi ve düğmeleri kapatır. Tarih
     şeridi bilerek DIŞARIDA bırakılır (çağıran onu listeye koymaz):
     kilitli günden başka bir güne geçebilmek gerekir. */
  YU.ui.girisleriKapat = function (kaplar) {
    var i, j, ogeler;
    for (i = 0; i < kaplar.length; i++) {
      if (!kaplar[i]) continue;
      ogeler = kaplar[i].querySelectorAll('input, button, select, textarea');
      for (j = 0; j < ogeler.length; j++) ogeler[j].disabled = true;
    }
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
      /* Gelecek bir gün SEÇİLEMEZ (kullanıcı direktifi, 24.08.2026): tüm
         tarih alanları bugünle sınırlıdır — takvimden ileri gün işaretlenemez.
         Şartname geleceğe kayıt tanımlamaz; D17 servis katmanında zaten
         engeller, bu satır seçimi baştan kapatır. */
      girdi.max = YU.tarih.bugun();
    } else if (tip === 'parola') {
      girdi = YU.h('input', { sinif: 'yu-girdi', tip: 'password' });
    } else if (tip === 'sayi') {
      /* Türkçe ondalık kabul edilsin diye type="text": type="number" virgülü reddeder. */
      girdi = YU.h('input', { sinif: 'yu-girdi', tip: 'text', inputmode: 'decimal', autocomplete: 'off' });
      girdi.style.textAlign = 'right';
      girdi.style.fontFamily = 'var(--sayi)';

      /* CANLI BİNLİK AYRACI (kullanıcı isteği, 26.08.2026 — "10000 yazınca
         hemen 10.000 olsun, alandan çıkmayı bekletme"). Eskiden alana girince
         ham sayı, çıkınca biçimli görünüyordu; artık her tuş vuruşunda biçimli.

         İki incelik var:
         1) İMLEÇ — ayraç eklenince metin uzar; imleç sona atlamasın diye
            imlecin SOLUNDAKİ RAKAM sayısı korunur, yeni metinde aynı rakam
            sayısından sonrasına konur.
         2) AYRIŞTIRMA — buradan çıkan biçim (1.234,56) YU.parse.sayi'nin
            okuduğu biçimdir: nokta yalnız üçlü gruplarda üretilir, ondalık
            hep virgüldür. Yani "0.123" gibi çift anlamlı metin artık hiç
            oluşmaz. decimal(18,3) gereği ondalık üç haneyle sınırlanır. */
      function bicimliMetin(ham) {
        if (ham === '') return '';
        var eksi = ham.charAt(0) === '-';
        var t = ham.replace(/[^0-9,]/g, '');       /* nokta ve diğer karakterler atılır */
        var p = t.split(',');
        var tam = p[0].replace(/^0+(?=\d)/, '');   /* baştaki gereksiz sıfırlar */
        var kesir = p.length > 1 ? p.slice(1).join('').slice(0, 3) : null;
        var sonuc = tam.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        if (kesir !== null) sonuc += ',' + kesir;
        return (eksi ? '-' : '') + sonuc;
      }
      function rakamSay(metin, sinir) {
        var n = 0;
        for (var i = 0; i < sinir; i++) if (metin.charAt(i) >= '0' && metin.charAt(i) <= '9') n++;
        return n;
      }
      function canliBicimle() {
        var ham = girdi.value;
        var yeni = bicimliMetin(ham);
        if (yeni === ham) return;
        var solRakam = rakamSay(ham, girdi.selectionStart === null ? ham.length : girdi.selectionStart);
        girdi.value = yeni;
        var k = 0, sayilan = 0;
        while (k < yeni.length && sayilan < solRakam) {
          if (yeni.charAt(k) >= '0' && yeni.charAt(k) <= '9') sayilan++;
          k++;
        }
        try { girdi.setSelectionRange(k, k); } catch (e) { /* alan gizliyse önemsiz */ }
      }
      /* Odakta artık ham sayıya dönmüyor: biçim yazarken de korunuyor. */
      girdi.addEventListener('focus', function () { girdi.select(); });
      girdi.addEventListener('blur', function () {
        var v = YU.parse.sayi(girdi.value);
        if (girdi.value === '' ) { sonSayi = null; negatifDenetle(); return; }
        if (isNaN(v)) return;                 /* geçersizse kullanıcının yazdığı kalsın, hata çağıran gösterir */
        sonSayi = v;
        girdi.value = sayiBicimle(v);
        negatifDenetle();
      });
      /* KLAVYEDEN HARF GİRİLEMEZ (kullanıcı isteği, 27.08.2026: "yazı
         yazılması yasak olsun, direkt işlenmesin"). Eskiden harf yazılıyor,
         input olayında biçimleyici tarafından siliniyordu — tuşa basınca harf
         bir an görünüyor, imleç zıplıyordu. Artık tuş vuruşu KAYNAKTA iptal
         edilir. Silme, geri alma, ok tuşları etkilenmez (e.data boş gelir).
         Yapıştırma ayrı ele alınır: metin tümden reddedilmez, süzülüp
         yazılır — "1.234,56 kg" yapıştıran kullanıcı rakamını kaybetmesin. */
      /* BUÇUKLU DEĞER YASAĞI (kullanıcı kararı, 27.08.2026): virgül ve
         nokta tuşu da işlenmez — tüm miktarlar tam sayıdır, binlik noktayı
         biçimleyici kendisi koyar. Doğrulama katmanında da aynı kural var
         (03-dogrulama · tamSayiDenetle); burası yalnız yazarken engeller. */
      girdi.addEventListener('beforeinput', function (e) {
        if (!e.data) return;
        if (e.inputType === 'insertFromPaste') return;   /* paste'i aşağıdaki dinleyici temizler */
        if (!/^[0-9-]+$/.test(e.data)) e.preventDefault();
      });
      girdi.addEventListener('paste', function (e) {
        var pano = e.clipboardData || window.clipboardData;
        if (!pano) return;
        /* Yapıştırılan metin SAYI olarak okunur, buçuğu atılır: "1.234,56 kg"
           -> 1234. Karakter ayıklamak yanlış değer üretirdi ("1,5" -> 15). */
        var temiz = String(pano.getData('text') || '').replace(/[^0-9.,-]/g, '');
        var okunmus = temiz === '' ? NaN : YU.parse.sayi(temiz);
        temiz = isNaN(okunmus) ? '' : String(Math.trunc(okunmus));
        e.preventDefault();
        var bas = girdi.selectionStart, son = girdi.selectionEnd;
        if (bas === null || bas === undefined) { bas = girdi.value.length; son = bas; }
        girdi.value = girdi.value.slice(0, bas) + temiz + girdi.value.slice(son);
        var konum = bas + temiz.length;
        try { girdi.setSelectionRange(konum, konum); } catch (x) { /* alan gizliyse önemsiz */ }
        girdi.dispatchEvent(new Event('input', { bubbles: true }));
      });
      /* Sıra önemli: biçimleyici, sayfanın kendi onInput'undan ÖNCE kayıtlı
         olsun ki sayfa her zaman biçimlenmiş değeri okusun. */
      girdi.addEventListener('input', canliBicimle);
      /* Fiziksel bir miktar negatif olamaz — kilo da, çuval adedi de, sıra da.
         Kaydete basmayı beklemeden yazarken söylenir. */
      girdi.addEventListener('input', negatifDenetle);
    } else {
      girdi = YU.h('input', { sinif: 'yu-girdi', tip: 'text', autocomplete: 'off' });
    }

    if (s.pasif) girdi.disabled = true;
    if (s.yerTutucu) girdi.setAttribute('placeholder', s.yerTutucu);
    if (s.onInput) girdi.addEventListener('input', s.onInput);

    if (s.onChange && tip === 'tarih') {
      /* TARİH ALANI — yazarken erken tetikleme sorunu (kullanıcı bildirimi,
         24.08.2026): input[type=date] tüm bölümleri doluyken TEK bölüm
         değişince de 'change' yayar. Gün hanesine "23" yazmak isteyen
         kullanıcı "2"ye bastığı anda tarih 02 olup geçerli kaldığı için
         change ateşleniyor, ekran yeniden çiziliyor ve "3" yazılamıyor.
         Çözüm: change GECİKTİRİLİR; kullanıcı yazmaya devam ederse bekleyen
         iş iptal olur. Alandan çıkınca ya da Enter'a basınca hemen uygulanır,
         böylece takvimden seçim ve klavyeyle yazım ikisi de doğru çalışır. */
      var TARIH_BEKLEME = 700;   /* ms — iki tuş vuruşu arasına rahat sığar */
      var tarihZamanlayici = null;

      var tarihIptal = function () {
        if (tarihZamanlayici) { clearTimeout(tarihZamanlayici); tarihZamanlayici = null; }
      };
      var tarihUygula = function () {
        tarihIptal();
        s.onChange();
      };

      girdi.addEventListener('change', function () {
        tarihIptal();
        tarihZamanlayici = setTimeout(tarihUygula, TARIH_BEKLEME);
      });
      /* Alandan çıkıldıysa yazım bitmiştir: bekleyen varsa hemen uygulanır. */
      girdi.addEventListener('blur', function () {
        if (tarihZamanlayici) tarihUygula();
      });
      girdi.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && tarihZamanlayici) { e.preventDefault(); tarihUygula(); }
      });
    } else if (s.onChange) {
      girdi.addEventListener('change', s.onChange);
    }

    /* s.sag  — alanın sağ ucunda duran ETİKET (birim gibi), tıklanmaz.
       s.sagEylem — aynı yerde duran TIKLANIR öğe (parola göster/gizle gibi);
       ayrı sınıf çünkü .yu-girdi-sag pointer-events: none taşır (26.08.2026). */
    var sar = YU.h('div', { sinif: 'yu-girdi-sar' }, girdi,
      s.sag ? YU.h('span', { sinif: 'yu-girdi-sag' }, s.sag) : null,
      s.sagEylem ? YU.h('span', { sinif: 'yu-girdi-sag yu-girdi-sag-eylem' }, s.sagEylem) : null);

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

  /* Kaydet denemesi başarısızsa hatalı alanları BİR KEZ parlatır (kullanıcı
     isteği, 27.08.2026). Sınıf animasyon bitince kendini siler; böylece
     sonraki denemede yeniden tetiklenebilir. Kalıcı kırmızı kenar .hatali
     sınıfındadır ve buraya dokunulmaz — alan düzeltilene kadar durur. */
  YU.ui.hataliAlanlariParlat = function (kap) {
    if (!kap || !kap.querySelectorAll) return;
    var alanlar = kap.querySelectorAll('.yu-girdi.hatali');
    for (var i = 0; i < alanlar.length; i++) {
      (function (el) {
        el.classList.remove('yu-parla');
        /* Sınıf aynı karede geri eklenirse tarayıcı animasyonu yeniden
           başlatmıyor; bir tazeleme çerçevesi beklenir. */
        void el.offsetWidth;
        el.classList.add('yu-parla');
        el.addEventListener('animationend', function bitti() {
          el.classList.remove('yu-parla');
          el.removeEventListener('animationend', bitti);
        });
      })(alanlar[i]);
    }
  };

  /* DOLULUK YÜZDESİ — kullanıcı isteği, 27.08.2026. 3.000.000 kg'lık siloda
     1.000 kg gerçekten %0,033'tür ve tek ondalıkla "%0,0" yazılıyordu; silo
     BOŞ sanılıyordu. Sıfırdan büyük ama %0,1'e ulaşmayan doluluk artık
     "<%0,1" diye okunur. Sıfır gerçekten sıfırsa "%0,0" kalır — "boş" ile
     "çok az" bu şekilde ayrışır. Ortak YU.fmt.yuzde'ye DOKUNULMADI: o oran,
     değişim ve pay yüzdelerinde de kullanılıyor. */
  YU.fmt.doluluk = function (oran) {
    var y = (Number(oran) || 0) * 100;
    if (y > 0 && y < 0.1) return '<' + YU.fmt.yuzde(0.1);
    return YU.fmt.yuzde(y);
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
    /* Yazma durduysa "kaydedildi" demek yanlış olur: değişiklik yalnız bu
       sekmenin belleğinde kaldı (kullanıcı isteği, 25.08.2026). */
    if (yazmaDurdu && tur === 'basari') {
      mesaj = 'Diske YAZILAMADI — değişiklik yalnız bu sekmenin belleğinde. Sayfayı yenileyin. (' + String(mesaj) + ')';
      tur = 'hata';
    }
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

    /* KİRLİ PENCERE KİLİDİ — ortak mekanizma (kullanıcı isteği, 27.08.2026).
       s.kirliMi verilirse: pencere kirli olduğu sürece kabuğun çıkış kilidi
       kurulur (sekme/pencere kapatmayı TARAYICI, sayfa geçişini UYGULAMA
       sorar) ve pencereyi kapatmak da onay ister. Kaydettikten sonra kapatan
       kod kapat(true) çağırır; orada soru sorulmaz. s.kirliMi verilmeyen
       pencereler eskisi gibi davranır. */
    var soruAcik = false;

    function kilidiTazele() {
      if (!s.kirliMi || !YU.cikisKilidi) return;
      YU.cikisKilidi(!!s.kirliMi(), kilitMesaji());
    }
    function kilitMesaji() {
      return s.kilitMesaji || 'Bu pencerede kaydedilmemiş değişiklik var.';
    }

    /* KAPATILAMAZ PENCERE (kullanıcı isteği, 31.08.2026): perdeye tıklama ve
       Esc iş görmez; çıkış yalnız penceredeki düğmededir. Sekmeler arası
       çakışma uyarısı böyle açılır — kapatılabilseydi yazma durmuşken uyarı
       ekrandan silinir, kullanıcı boşuna çalışırdı. Bayrak verilmezse
       pencereler eskisi gibi davranır. */
    var perde = YU.h('div', {
      sinif: 'yu-perde',
      onMouseDown: function (e) { if (e.target === perde && !s.kapatilamaz) kapat(); }
    }, modal);
    if (s.kirliMi) {
      modal.addEventListener('input', kilidiTazele);
      modal.addEventListener('change', kilidiTazele);
    }

    function odaklanabilirler() {
      return modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    }

    function tusIsle(e) {
      /* Onay penceresi açıkken Esc onu kapatır; alttaki pencere karışmasın. */
      if (soruAcik) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!s.kapatilamaz) kapat(); return; }
      if (e.key !== 'Tab') return;
      var o = odaklanabilirler();
      if (!o.length) return;
      var ilk = o[0], son = o[o.length - 1];
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    }

    function kapat(zorla) {
      if (!zorla && !soruAcik && s.kirliMi && s.kirliMi()) {
        soruAcik = true;
        YU.ui.onay({
          baslik: 'Kaydedilmemiş Değişiklik Var',
          metin: kilitMesaji() + ' Şimdi çıkarsanız kaybolur. Çıkılsın mı?',
          onayMetni: 'Kaydetmeden Çık',
          iptalMetni: 'Pencerede Kal',
          tehlike: true
        }).then(function (evet) {
          soruAcik = false;
          if (evet) kapat(true);
        });
        return;
      }
      document.removeEventListener('keydown', tusIsle, true);
      if (perde.parentNode) perde.parentNode.removeChild(perde);
      if (oncekiOdak && oncekiOdak.focus) oncekiOdak.focus();
      if (s.kirliMi && YU.cikisKilidi) YU.cikisKilidi(false);
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
        /* ayrinti (M28): ciddi işlem onaylarında metnin altına "neyin neye
           döndüğü" listesi eklenir; verilmezse pencere eskisi gibidir. */
        govde: YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          YU.h('div', { metin: s.metin || '', stil: { font: '400 15px/1.6 var(--font)', color: 'var(--metin-3)' } }),
          s.ayrinti || null),
        dugmeler: [
          { metin: s.iptalMetni || 'Vazgeç', tur: 'sade', onClick: function () { sonuc(false); } },
          { metin: s.onayMetni || 'Onayla', tur: s.tehlike ? 'tehlike' : 'birincil', onClick: function () { sonuc(true); } }
        ],
        onKapat: function () { if (!bitti) { bitti = true; coz(false); } }
      });
    });
  };

  /* Ciddi işlem onaylarının ayrıntı listesi (M28): satır = {etiket, eski,
     yeni} (değişiklik — eski çizili kırmızı, yeni yeşil; İşlem Geçmişi
     panelinin renk dili) ya da {etiket, deger} (yeni kaydın künyesi). */
  YU.ui.farkListesi = function (maddeler) {
    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '7px' } });
    for (var i = 0; i < maddeler.length; i++) {
      var md = maddeler[i];
      var satir = YU.h('div', { stil: { display: 'flex', alignItems: 'baseline', gap: '9px', flexWrap: 'wrap' } },
        YU.h('span', { sinif: 'yu-etiket', metin: md.etiket, stil: { flex: 'none', minWidth: '96px' } }));
      if (md.deger !== undefined) {
        satir.appendChild(YU.h('span', { sinif: 'yu-guclu', metin: String(md.deger) }));
      } else {
        satir.appendChild(YU.h('span', {
          metin: String(md.eski),
          stil: { fontFamily: 'var(--sayi)', textDecoration: 'line-through',
                  textDecorationColor: 'var(--metin-4)', color: 'var(--olumsuz)' }
        }));
        satir.appendChild(YU.h('span', { sinif: 'yu-zayif', metin: '→', 'aria-hidden': 'true' }));
        satir.appendChild(YU.h('span', {
          metin: String(md.yeni),
          stil: { fontFamily: 'var(--sayi)', fontWeight: '700', color: 'var(--olumlu)' }
        }));
      }
      kap.appendChild(satir);
    }
    return kap;
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
      /* "Alan" kodu YAZILMAZ (kullanıcı isteği, 27.08.2026): D3, D15 gibi
         kodlar şartnamedeki kurala işaret ediyor, aranıp bulunabiliyor;
         "Alan" ise kuralsız kalanların torbası — okuyana hiçbir şey
         söylemeden satırın başında yer kaplıyordu. Öbür kodlar durur. */
      var kodlu = h.kod && h.kod !== 'Alan';
      liste.appendChild(YU.h('div', { stil: { display: 'flex', gap: '9px', alignItems: 'baseline' } },
        kodlu ? YU.h('span', {
          metin: h.kod,
          stil: { font: '500 13px/1.4 var(--mono)', color: RENK_METIN[t === 'hata' ? 'olumsuz' : 'bekleyen'], flex: 'none' }
        }) : null,
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
    /* Ekranlar bunu ciz() içinde, yani basligiYaz'dan SONRA çağırır. Başlığı
       gizli bir sayfaya eylem eklendiyse şerit geri açılmalı — yoksa düğmeler
       gizli kapta kalırdı. */
    if (dom.sayfaBas && dom.eylemler.firstChild) dom.sayfaBas.style.display = '';
    return dom.eylemler;
  };

  /* ==================================================================
     13. Grafikler — inline SVG, renkler CSS değişkeninden (tema uyumu)
     ================================================================== */

  /* Kategorik seri renkleri: her dilim ayrı hue taşır — tek mavi tonlaması
     dilimleri okunmaz kılıyordu. Sıra sabittir, dilim sayısı değişince
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
        /* Kutu, kampanya adı + tarih + miktar taşıyan satırlara göre
           genişletildi (280px'te satırlar kutunun dışına taşıyordu —
           kullanıcı bildirimi, 23.08.2026). Üst sınır yine var ki uzun
           metin ekranı boydan boya kaplamasın; sığmayan etiket sarar. */
        /* Ölçüler büyütüldü (kullanıcı isteği, 25.08.2026 — "çok küçük
           gözüküyor"): dolgu 9/11 -> 13/16, üst genişlik 360 -> 420. */
        pointerEvents: 'none', maxWidth: '420px',
        padding: '13px 16px', borderRadius: 'var(--r)',
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
    /* Yazı ölçüleri bir kademe büyütüldü (kullanıcı isteği, 25.08.2026):
       başlık 14 -> 16px, satır etiketi ve sayısı 13,5 -> 15px, renk kutusu
       8 -> 10px, satır arası 6 -> 8px. */
    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    kap.appendChild(YU.h('div', {
      metin: baslik,
      stil: { font: '600 16px/1.25 var(--font)', color: 'var(--metin)', whiteSpace: 'nowrap' }
    }));
    /* Satırda ETİKET sarar, MİKTAR sarmaz. Önce satırın tamamı `nowrap`
       idi: uzun kampanya adı + tarih + miktar kutunun genişliğini aşıyor,
       sayı kutunun dışında kalıyordu. Şimdi etiket daralıp gerekirse alt
       satıra iner; sayı hep bütün hâlde ve sağda durur. */
    for (var i = 0; i < satirlar.length; i++) {
      var r = satirlar[i];
      kap.appendChild(YU.h('div', {
        stil: { display: 'flex', alignItems: 'flex-start', gap: '9px' }
      },
        YU.h('span', {
          stil: {
            width: '10px', height: '10px', borderRadius: '3px', flex: 'none',
            background: r.renk, marginTop: '5px'
          }
        }),
        YU.h('span', {
          metin: r.ad,
          stil: {
            flex: '1 1 auto', minWidth: '0', font: '400 15px/1.35 var(--font)',
            color: 'var(--metin-3)', overflowWrap: 'anywhere'
          }
        }),
        YU.h('span', {
          metin: r.deger,
          stil: {
            flex: 'none', whiteSpace: 'nowrap', marginLeft: 'auto',
            font: '700 15px/1.35 var(--sayi)', color: 'var(--metin)',
            fontVariantNumeric: 'tabular-nums'
          }
        })
      ));
    }
    if (ek) {
      kap.appendChild(YU.h('div', {
        metin: ek.metin,
        stil: {
          font: '700 15px/1.35 var(--sayi)', color: ek.renk || 'var(--metin-3)',
          borderTop: '1px solid var(--ayrac)', paddingTop: '8px',
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
      /* Çok satırlı metin (satır sonu içeren) hesap dökümü gibi okunur:
         satırlar korunur, yazı bir tık büyür (kullanıcı isteği, 28.08.2026 —
         "hesaplama panelini biraz daha büyüt"). Tek satırlık mevcut
         kullanım değişmez. */
      var cokSatir = String(metin).indexOf(String.fromCharCode(10)) >= 0;
      return YU.h('div', {
        stil: cokSatir
          ? { font: '400 15px/1.7 var(--font)', color: 'var(--metin-2)', whiteSpace: 'pre-line', fontVariantNumeric: 'tabular-nums' }
          : { font: '400 14px/1.4 var(--font)', color: 'var(--metin-2)', whiteSpace: 'nowrap' },
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
  /* Dışa açık ad: ekranlar yerleşik title yerine bu kutuyu bağlayabilsin
     (ilk kullanıcı: Stok Durumu'ndaki stok hesap dökümü, 28.08.2026). */
  YU.ui.metinIpucu = metinIpucuBagla;

  /* Şerit vurgusu: sütun/çizgi grafiklerinde arkadaki bandı açıp kapatır. */
  function bantVurgu(bant) {
    return function (acik) { bant.setAttribute('opacity', acik ? '1' : '0'); };
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

  /* İki kampanyayı GÜN SIRASINA göre üst üste çizen çizgi grafiği (Analizler
     ekranı, kullanıcı isteği 23.08.2026). Seriler aynı x eksenini paylaşır:
     i. nokta = (i+1). kampanya günü. Eksik gün (null) çizgiyi koparır, sıfır
     değer koparmaz. Referanstaki Nakit Akışı grafiğinin dili korunur
     (polyline + yatay kılavuz çizgileri); iki seri üst üste okunmadığı için
     alan dolgusu çizilmez. Noktalar sıfır uzunluklu yol + yuvarlak uç ile
     çizilir: non-scaling-stroke sayesinde yamuk viewBox'ta da daire kalır.

       noktalar: [{etiket:'12', baslik:'12. Gün', deger1, deger2, alt1, alt2}]
       seri1/seri2: {ad, renk}      seri2 yoksa tek çizgi çizilir
       bicim(n) -> ipucu metni      eksenBicim(n) -> sol eksen etiketi */
  /* Efsane — grafiğin üstündeki seri listesi.
     `onTikla` verilirse her öge düğme olur: işaretli seriler çizilir,
     işaret kalkınca çizgi grafikten çıkar. Böylece efsane aynı zamanda
     SERİ SEÇİCİDİR (kullanıcı isteği, 23.08.2026) — kampanyaları tek tek
  /* Kaydırmalı grafiğin yanındaki ok düğmesi (kullanıcı isteği, 25.08.2026).
     Tıklama bir adım kaydırır; BASILI TUTMAK sürekli kaydırır (mousedown ile
     başlar, mouseup/mouseleave/blur ile durur). Klavye için de çalışır:
  /* Kampanya karşılaştırma grafiği — N SERİ.

     İki kullanım vardır:
       eski  {noktalar:[{deger1, deger2}], seri1:{ad,renk}, seri2:{ad,renk}}
       yeni  {noktalar:[{etiket, baslik}], seriler:[{ad, renk, secili,
              degerler:[...], altlar:[...]}], onSeriTikla(indeks, seri, yeniDurum)}

     `secili:false` olan seri ÇİZİLMEZ ama efsanede durur; tıklanınca geri
     gelir. Eksen tavanı yalnız çizilen serilere göre hesaplanır.
     Fark satırı yalnız TAM İKİ seri seçiliyken gösterilir — üç seride
  /* ==================================================================
     14. Gün penceresi
     Bir günün verisine listeden tıklanınca tam sayfaya gitmek yerine küçük
     pencere açılıyor: kullanıcı bulunduğu listeden kopmuyor.
     ================================================================== */

  /* HAREKET_ADI / HAREKET_RENGI kaldırıldı: yalnız pencerenin silo hareket
     tablosunda kullanılıyordu, o bölüm de kalktı (25.08.2026). Aynı eşleme
     32-tum-hareketler ve 25-gunluk-rapor içinde kendi kopyalarıyla duruyor. */

})();

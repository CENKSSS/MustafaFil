/* js/21-kuru-kuspe-giris.js — Kuru Küspe Günlük Giriş
   Şartname §4 (hesap + silo dağıtımı, DEMİRBAŞ), §7 (kullanılabilirlik ve v2
   arayüz maddeleri), §8 (D1–D7, D13–D16) · SÖZLEŞME §6, §7.

   Bu dosya yalnızca sunum yapar: hesap YU.hesap'ta, kurallar YU.dogrula'da,
   yazma YU.servis'te durur (Şartname §10 "Kod düzeni"). Ekranda yeniden
   hesaplanan tek şey, kullanıcıya anında geri bildirim için gereken ara
   toplamlardır — kural kopyalanmaz, servis çağrılır.

   DÜZEN (kullanıcı isteği, 23.08.2026 — eski düzen git etiketi `kuru-kuspe-eski`
   altında ve 2. Versiyon sayfasında duruyor): sayfa malın akışını anlatır,
   numaralı üç adımdan oluşur; 1 ve 2'de solda rakamlar, sağda dağıtım.
     1. SİLOYA GİREN  — üretilen dökme + çuvallanan → siloya girecek net miktar
                        ve hangi siloya.
     2. SİLODAN ÇIKAN — satılan dökme (+ üretimden fazla çuvallandıysa çuvallama
                        çekişi) → silodan çıkacak miktar ve hangi silodan.
     3. GÜN SONU VE KAYIT — silo bakiyeleri, net etki, durum ve Kaydet.
   Ekranda kural kodu, sürüm numarası ya da şartname atfı yoktur; metinler
   bilgisayar bilmeyen operatör için yazıldı.
   Şartname §4 korunur: operatör yalnız ham rakamları girer, sistem neti hesaplar,
   dağıtımda son söz kullanıcıdadır; §7 anlık hesap; D1–D16 YU.dogrula'dan. */
(function () {
  "use strict";

  var YU = window.YU;
  var KOD = "kuru-kuspe";

  /* Kaydetme ve silme sonrası sayfa baştan çizilir (RowVersion ve gün başı
     mevcutları tazelensin diye); sonuç mesajı o çizime bu değişkenle taşınır. */
  var bekleyenSonuc = null;

  /* ---------------------------------------------------------------
     Yerel yardımcılar — YU'da karşılığı olmayanlar
     --------------------------------------------------------------- */

  function gecerliTarih(iso) {
    return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  function kuruKuspeBul(db, tarih) {
    var i;
    for (i = 0; i < db.kuruKuspeGunluk.length; i++) {
      if (db.kuruKuspeGunluk[i].Tarih === tarih) return db.kuruKuspeGunluk[i];
    }
    return null;
  }

  /* Günü Sıfırla'nın silebileceği bir şey var mı? Ölçü DARALDI (kullanıcı
     kararı, 31.08.2026): bu ekran artık yalnız kendi yazdığı alanları
     siliyor — dökmenin üretim+satışı, çuvallının üretimi ve günün silo
     hareketleri. Malzeme Girişi'ne yazılmış yaş küspe/kuyruk satırı düğmeyi
     ARTIK AÇMAZ; onlar bu ekranın verisi değil. */
  function buEkraninVerisiVarMi(db, tarih) {
    var i, h;
    for (i = 0; i < db.siloHareket.length; i++) {
      if (db.siloHareket[i].Tarih === tarih) return true;
    }
    var dokme = null, cuval = null;
    for (i = 0; i < db.malzemeler.length; i++) {
      if (db.malzemeler[i].OzelTip === "DokmeKuruKuspe") dokme = db.malzemeler[i];
      if (db.malzemeler[i].OzelTip === "CuvalKuruKuspe") cuval = db.malzemeler[i];
    }
    for (i = 0; i < db.gunlukHareket.length; i++) {
      h = db.gunlukHareket[i];
      if (h.Tarih !== tarih) continue;
      if (dokme && h.MalzemeId === dokme.Id &&
          ((Number(h.Uretim) || 0) !== 0 || (Number(h.Satis) || 0) !== 0)) return true;
      if (cuval && h.MalzemeId === cuval.Id && (Number(h.Uretim) || 0) !== 0) return true;
    }
    return false;
  }

  function kullaniciAdi(db, id) {
    var i;
    if (id === null || id === undefined) return null;
    for (i = 0; i < db.kullanicilar.length; i++) {
      if (db.kullanicilar[i].Id === id) return db.kullanicilar[i].AdSoyad;
    }
    return null;
  }

  function aktifSilolar(db) {
    var l = [], i;
    for (i = 0; i < db.silolar.length; i++) if (db.silolar[i].Aktif !== false) l.push(db.silolar[i]);
    l.sort(function (a, b) {
      var x = Number(a.Sira) || 0, y = Number(b.Sira) || 0;
      return x !== y ? x - y : (a.Id || 0) - (b.Id || 0);
    });
    return l;
  }

  /* KuruKuspeGunluk.Tarih tekil olduğu için o günün DokmeUretim/Cuvallama/
     DokmeSatis satırları tek kayda aittir; KaynakKayitId aranmadan okunabilir. */
  function gunHareketleri(db, tarih, tip) {
    var m = {}, i, h;
    for (i = 0; i < db.siloHareket.length; i++) {
      h = db.siloHareket[i];
      if (h.Tarih !== tarih || h.HareketTipi !== tip) continue;
      m[h.SiloId] = YU.yuvarla((m[h.SiloId] || 0) + (Number(h.GirenKg) || 0) + (Number(h.CikanKg) || 0));
    }
    return m;
  }

  /* YU.servis içindeki taslak üretimiyle aynı kural: miktarı 0 olan satır
     hareket doğurmaz. D14 önizlemesi bunu birebir taklit etmek zorunda. */
  function taslakHareketler(girdi) {
    var liste = [];
    function ekle(satirlar, giren) {
      var i, m;
      if (!satirlar) return;
      for (i = 0; i < satirlar.length; i++) {
        m = YU.yuvarla(satirlar[i].miktar);
        if (!isFinite(m) || m <= 0) continue;
        liste.push({ siloId: satirlar[i].siloId, GirenKg: giren ? m : 0, CikanKg: giren ? 0 : m });
      }
    }
    ekle(girdi.yerlestirmeler, true);
    ekle(girdi.cekisler, false);
    ekle(girdi.satisCekisleri, false);
    return liste;
  }

  function siloBazinda(satirlar) {
    var m = {}, i, n;
    if (!satirlar) return m;
    for (i = 0; i < satirlar.length; i++) {
      n = YU.yuvarla(satirlar[i].miktar);
      if (!isFinite(n)) n = 0;
      m[satirlar[i].siloId] = YU.yuvarla((m[satirlar[i].siloId] || 0) + n);
    }
    return m;
  }

  function kodVar(kayitlar, kod) {
    var i;
    for (i = 0; i < kayitlar.length; i++) if (kayitlar[i].kod === kod) return true;
    return false;
  }

  /* Kaydet'i kapatan engelin kendi cümlesi (28.08.2026): düğmenin ipucu
     hangi kural engelliyorsa onu söyler, üç durum için tek genel metin
     yazmaz. Sıra önemsiz — aynı anda birden çok sert engel varsa ilki
     yazar, kalanı sağdaki "Kaydedilemez:" listesinde durur. */
  function engelMetni(hatalar) {
    var i;
    for (i = 0; i < hatalar.length; i++) {
      if (hatalar[i].kod === "D2" || hatalar[i].kod === "D7" ||
          hatalar[i].kod === "D14" || hatalar[i].kod === "D15") {
        return hatalar[i].mesaj;
      }
    }
    return "Kaydedilemez.";
  }

  function satir(stil) {
    var el = YU.h("div", { stil: stil });
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }

  function yatay(gap, sar) {
    return { display: "flex", alignItems: "center", gap: gap || "10px", flexWrap: sar === false ? "nowrap" : "wrap" };
  }

  function seritSatirlari(serit, satirlar) {
    var govde = serit.querySelector(".yu-serit-govde"), i;
    if (!govde || !satirlar) return serit;
    for (i = 0; i < satirlar.length; i++) {
      if (!satirlar[i]) continue;
      govde.appendChild(YU.h("div", { metin: satirlar[i], stil: { marginTop: "4px" } }));
    }
    return serit;
  }

  /* HUD (kullanıcı isteği, 23.08.2026 — "hiyerarşi kötü"): sayfa NUMARALI
     ÜÇ ADIMDIR ve her adımın içinde iki sütun vardır: solda kullanıcının
     yazdığı rakamlar (birincil, beyaz zemin, büyük kutu), sağda silolara
     dağıtım (ikincil, gri zeminli kutu). Okuma sırası soldan sağa, yukarıdan
     aşağı: rakamı yaz → siloya dağıt → sonraki adım. Yeşil = siloya giren,
     kırmızı = silodan çıkan; renk yalnız anlam taşıdığı yerde. */

  var ADIM_RENK = {
    giren: { zemin: "var(--olumlu-zemin)", renk: "var(--olumlu)" },
    cikan: { zemin: "var(--olumsuz-zemin)", renk: "var(--olumsuz)" },
    notr: { zemin: "var(--vurgu-zemin)", renk: "var(--vurgu)" }
  };

  /* Sert başlık çizgisi (kullanıcı isteği, 27.08.2026): YALNIZ dört başlığın
     altında durur — Siloya Giren, Silolara Dağıt, Silodan Çıkan, Silolardan
     Çek. Gün Sonu ve Kayıt başlığı ince ayracını korur. */
  var SERT_CIZGI = "2px solid var(--metin-5)";

  function adimBasligi(no, yon, baslik, sag, sert) {
    var r = ADIM_RENK[yon] || ADIM_RENK.notr;
    /* Alt dolgu 9 -> 5 (kullanıcı isteği, 31.08.2026: paneller dikeyde
       incelsin). Rozet 28px ve başlık 20px AYNEN kalır; kısalan yalnız
       başlığın altındaki boşluk. Sağdaki dağıtım kutusunun başlık bloğu da
       aynı ölçüde kısaldı — iki panelin içeriği hizasını korur. */
    return YU.h("div", { stil: { display: "flex", alignItems: "center", gap: "12px", paddingBottom: "5px", borderBottom: sert ? SERT_CIZGI : "1px solid var(--ayrac)" } },
      YU.h("span", {
        metin: String(no),
        stil: {
          display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
          width: "28px", height: "28px", borderRadius: "50%",
          background: r.zemin, color: r.renk, font: "700 14px/1 var(--sayi)"
        }
      }),
      YU.h("div", { metin: baslik, stil: { font: "700 20px/1.2 var(--font)", letterSpacing: "-.014em", color: "var(--metin)", flex: "1", minWidth: "0" } }),
      sag || null
    );
  }

  /* Küçük büyük-harfli alt başlık: sütunun ne olduğunu söyler, başlıkla yarışmaz. */
  function altEtiket(metin) {
    return YU.h("div", { metin: metin, stil: { font: "600 13px/1 var(--font)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--metin-3)" } });
  }

  /* Adım gövdesi: sol sütun rakamlar (1 pay), sağ sütun dağıtım (2 pay, gri kutu). */
  /* DÖRT PANEL, İKİ SATIR (kullanıcı isteği, 27.08.2026): eskiden iki panel
     vardı ve her birinin içi dikey bir çizgiyle ikiye bölünüyordu. Artık o
     çizginin SOLU ve SAĞI ayrı panellerdir:

       üst satır : [1 Siloya Giren]   [Silolara Dağıt]
       alt satır : [2 Silodan Çıkan]  [Silolardan Çek]

     Sağdaki kutular kendi ince çerçevelerini korur; üstlerine ikinci bir
     panel sarılmaz. Dikey ayraç kalktı — iki panel arasındaki boşluk sınırı
     zaten çiziyor. */
  /* Dikişteki yön okunu sol yarıya asar; panel position: relative olduğu
     için ok tam sınırın üstüne oturur ve genişlik değişse de kaymaz. */
  function ciftOkuKoy(panel) {
    /* Ok artık "→" KARAKTERİ DEĞİL, SVG (kullanıcı isteği, 27.08.2026:
       "ok tam yuvarlağın ortasında değil"). Yazı tipinde → glifi taban
       çizgisinin üstünde durur; kutu ortalanınca mürekkep ortalanmıyordu.
       #ic-ok-sag viewBox'ında hem yatay hem dikey olarak 12,12'ye
       oturtulmuştur — flex ortalaması artık gerçekten ortalar. */
    panel.appendChild(YU.h("div", { sinif: "yu-cift-ok", "aria-hidden": "true" },
      YU.svg("#ic-ok-sag", 15)));
    return panel;
  }

  function dagitimKutusu(baslik, icerik, ekSinif) {
    var ic = YU.h("div", {
      stil: { display: "flex", flexDirection: "column", gap: "8px", minWidth: "0" }
    }, icerik);
    /* KENDİ PANELİ (kullanıcı isteği, 27.08.2026: "silolara dağıt ve
       silolardan çek'e panel yap ayrı olarak"). Elle çizilen çerçeve yerine
       ortak .yu-panel: soldaki adım panelleriyle aynı kenar, köşe, zemin ve
       dolgu — dört kutu tek dilde okunur. */
    /* BAŞLIK SOLDAKİYLE AYNI YÜKSEKLİKTE (kullanıcı isteği, 27.08.2026):
       adimBasligi 28px rozet + 9px dolgu + 1px ayraç = 38px yer kaplıyordu;
       buradaki minik etiket 12px'ti ve sağdaki kutular soldaki rakam
       kutularından 31px yukarıda başlıyordu (ölçüldü). Aynı ölçüde bir
       başlık bloğu kurulunca satırdan TEK yatay çizgi geçer, iki panelin
       içeriği aynı hizada başlar. */
    var bas = YU.h("div", {
      stil: {
        /* 34px = soldaki adimBasligi'nin toplam yüksekliği (28px rozet +
           5px dolgu + 1px ayraç). box-sizing: border-box olduğu için
           min-height dolguyu ve kenarlığı da kapsar; 28 yazınca sağdaki
           başlık 10px alçak kalıyordu (ölçüldü). Dolgu 31.08.2026'da 9'dan
           5'e indi — soldaki başlıkla birlikte, hiza bozulmasın. */
        display: "flex", alignItems: "center", minHeight: "34px",
        paddingBottom: "5px", borderBottom: SERT_CIZGI
      }
    }, altEtiket(baslik));
    var p = YU.ui.panel({ govde: [bas, ic] });
    /* Boşluk ve dolgu SOLDAKİ adım paneliyle birebir aynı (31.08.2026):
       ikisi tek kartın iki yarısıdır; dolgu ayrışırsa başlıklar birbirinden
       kayar (ölçüldü: sağdaki 4px alçak kalıyordu). */
    p.querySelector(".yu-panel-govde").style.gap = "8px";
    p.style.paddingTop = "10px";
    p.style.paddingBottom = "10px";
    /* Şerit YALNIZ sol adım panellerinde (kullanıcı kararı, 27.08.2026):
       önce iki panele de konmuştu, kullanıcı geri aldı. Buraya gelen ek
       sınıf şerit değil, çift panelin SAĞ YARISI biçimidir. */
    if (ekSinif) p.className += " " + ekSinif;
    return p;
  }

  /* "Hepsini Ekle" kutunun İÇİNDE durur (kullanıcı isteği, 23.08.2026):
     tek çerçevede sayı → kg eki → ayırıcı çizgi → düğme. Düğme kutunun
     sarmalayıcısına (position: relative) mutlak konumlanır; kg eki sola
     kaydırılır, kutunun sağ dolgusu ikisini de kapsayacak kadar açılır. */
  var HEPSI_GENISLIK = 92;   /* px — düğme sütunu */
  function kutuyaDugmeKoy(alan, dugme) {
    var sar = alan.kok.querySelector(".yu-girdi-sar");
    var ek = sar.querySelector(".yu-girdi-sag");
    var ekGenislik = 22;     /* "kg" yazısı */
    dugme.style.position = "absolute";
    dugme.style.top = "1px";
    dugme.style.bottom = "1px";
    dugme.style.right = "1px";
    dugme.style.width = HEPSI_GENISLIK + "px";
    dugme.style.padding = "0 4px";
    dugme.style.border = "0";
    dugme.style.borderLeft = "1px solid var(--kenar-2)";
    dugme.style.borderRadius = "0 var(--r) var(--r) 0";
    dugme.style.font = "500 13px/1 var(--font)";
    sar.appendChild(dugme);
    if (ek) ek.style.right = (HEPSI_GENISLIK + 1 + 10) + "px";
    alan.girdi.style.paddingRight = (HEPSI_GENISLIK + 1 + 10 + ekGenislik + 8) + "px";
    return alan;
  }

  /* Ham girdi alanları operatörün tek işi: büyük yazı, rahat kutu.
     Sağ dolgu tek tek yazılır: "padding" kısayolu, son ek ("kg") için CSS'in
     ayırdığı sağ boşluğu siliyor ve sayı ekin altına giriyordu (23.08.2026).
     Uzun ek (çuval) için sağ boşluk ayrıca verilir. */
  function buyukAlan(alan, sagBosluk) {
    /* Kutu sağ kenardan içeri çekildi (kullanıcı isteği, 27.08.2026):
       dikişteki yeşil/kırmızı yuvarlak kutunun "kg" ekine değecek kadar
       yakındı, ikisi de sıkışık duruyordu. Yalnız GİRDİ SATIRI daralır;
       etiket, yardım satırı ve "Siloya girecek" satırı yerinde kalır.
       Ölçü SABİT GENİŞLİK DEĞİL sağ boşluktur: panel pencereyle birlikte
       büyüyüp küçülüyor, sabit px kutuyu dar ekranda taşırırdı. 14px, 1600px
       pencerede kutuyu 187px'e getirir (kullanıcı isteği, 27.08.2026). */
    alan.kok.style.marginRight = "14px";
    alan.girdi.style.font = "500 19px/1.3 var(--sayi)";
    alan.girdi.style.paddingTop = "9px";
    alan.girdi.style.paddingBottom = "9px";
    alan.girdi.style.paddingLeft = "12px";
    if (sagBosluk) alan.girdi.style.paddingRight = sagBosluk;
    alan.girdi.style.fontVariantNumeric = "tabular-nums";
    /* Birincil alan: etiketi gövde metniyle aynı ağırlıkta, silo kutularının
       etiketlerinden bir kademe güçlü. */
    var etiket = alan.kok.querySelector("label");
    if (etiket) { etiket.style.font = "600 14.5px/1.3 var(--font)"; etiket.style.color = "var(--metin-2)"; }
    return alan;
  }

  /* ---------------------------------------------------------------
     Sayfa
     --------------------------------------------------------------- */

  YU.sayfaTanimla({
    kod: KOD,
    zemin: "gri-duz",   /* zemin gri, paneller mavi/turuncu adım düzeninde (kullanıcı isteği, 23.08.2026) */
    /* Ad "& Çıkış" ile genişledi (kullanıcı isteği, 27.08.2026): ekran yalnız
       giriş değil, dökme satış ve çuvallama çekişini de buradan alıyor. */
    baslik: "Kuru Küspe Günlük Giriş ve Çıkış",
    menuAd: "Kuru Küspe Girişi",   /* menüde kısa ad (31.08.2026) */
    ikon: "#ic-plus",
    grup: "Giriş",
    rol: "Hepsi",
    altBaslik: function (param) {
      var tarih = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
      if (tarih > YU.tarih.bugun()) tarih = YU.tarih.bugun();   /* gelecek gün seçilemez */
      var kayit = YU.db ? kuruKuspeBul(YU.db, tarih) : null;
      return YU.fmt.tarihUzun(tarih) + " · " + YU.fmt.gunAdi(tarih) + " · " +
        (kayit ? "kayıtlı gün — düzeltiyorsun" : "yeni kayıt");
    },
    ciz: ciz
  });

  function ciz(kap, param) {
    var db = YU.db;
    var tol = YU.hesap.TOLERANS;
    var tarih = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
    /* Adresle gelen ileri tarih bugüne çekilir (gelecek gün seçilemez,
       kullanıcı direktifi 24.08.2026) — D17 hata sayfası yerine bugün açılır. */
    if (tarih > YU.tarih.bugun()) tarih = YU.tarih.bugun();
    var kayit = kuruKuspeBul(db, tarih);
    var okunanRowVersion = kayit ? Number(kayit.RowVersion) : null;
    var silinebilir = !!kayit || buEkraninVerisiVarMi(db, tarih);
    var silolar = aktifSilolar(db);
    var gunBasi = {};
    var i;

    /* Günlük Rapor / Geçmiş Girişler sayfa başlığından tarih şeridine taşındı
       (kullanıcı isteği, 23.08.2026). */
    YU.ui.sayfaEylemleri();

    if (!silolar.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: "#ic-building",
        baslik: "Tanımlı Silo Yok",
        metin: "Dökme kuru küspe yalnızca silolarda durur. En az bir aktif silo tanımlanmadan bu ekran kullanılamaz.",
        eylemler: [YU.ui.dugme({ metin: "Silo Durumu", ikon: "#ic-building", tur: "birincil", onClick: function () { YU.git("silo-durumu"); } })]
      }));
      return;
    }

    for (i = 0; i < silolar.length; i++) gunBasi[silolar[i].Id] = YU.stok.siloGunBasi(db, silolar[i].Id, tarih);

    /* Sayfa içeriği kabuğun kalıcı kabına değil, her çizimde yeniden kurulan
       bu sarmalayıcıya konur: Ctrl+Enter dinleyicisi de onunla birlikte ölür,
       ekranlar arasında gezinirken birikmez. */
    /* Sol yığın (adım 1-2) artık boşta kalan genişliğin tamamını alır
       (kullanıcı isteği, 26.08.2026). 23.08.2026'daki 1120px sınırı kalktı:
       panellerin sağ sınırı "Gün Sonu ve Kayıt" panelidir. */
    var govde = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "18px", minWidth: "0" } });
    /* TEK SÜTUN (kullanıcı isteği, 02.09.2026: "3-kayıt panelini en alta
       alsana"). 23.08.2026'dan beri sağda yapışkan bir Kayıt sütunu vardı;
       panel artık sayfanın en altında, tam genişlikte duruyor ve sütun
       gereksiz kaldı. Sıra: 1 Siloya Giren → 2 Silodan Çıkan → kayıt alanı.
       KENAR BOŞLUĞU (aynı istek: "sağ ve sol kenarlardan biraz uzak olsun"):
       tarih şeridi ve panel yığını iki yandan 22px içeri alınır. Boşluk bu
       ekrana özeldir; ortak kabuk dolgusuna dokunulmaz (KURAL 10.5). */
    var YAN_BOSLUK = "22px";
    var yerlesim = YU.h("div", {
      stil: {
        display: "flex", flexDirection: "column", gap: "18px", minWidth: "0",
        paddingLeft: YAN_BOSLUK, paddingRight: YAN_BOSLUK, boxSizing: "border-box"
      }
    }, govde);

    /* ---------- 1. Kayıtlı gün uyarısı (Şartname §7, v2 — kullanıcı isteği,
       23.08.2026): şerit yerine sayfa açılınca küçük pencere. Kaydet/silme
       sonrası yeniden çizimde tekrar açılmaz (sonuç şeridi zaten anlatır);
       rozet ve alt başlık "kayıtlı gün" demeye devam eder. */

    if (kayit) {
      var damga = kayit.GuncellemeTarihi || kayit.OlusturmaTarihi;
      var kimId = kayit.GuncellemeTarihi ? kayit.GuncelleyenKullaniciId : kayit.OlusturanKullaniciId;
      var kim = kullaniciAdi(db, kimId) || "bilinmeyen kullanıcı";
      /* ÜST ŞERİT KALDIRILDI (kullanıcı isteği, 27.08.2026): uyarı sayfanın
         tepesinde, kararın verildiği yerden uzakta duruyordu. Aynı uyarı
         artık "3 Gün Sonu ve Kayıt" panelinde, durum kutusunun ÜSTÜNDE —
         Kaydet'in hemen yanında okunur (kayitliKutu). Kim/ne zaman girmiş
         bilgisi ve Program Hareketleri düğmesi şeritle birlikte düştü; ikisi
         de sayfa açılışındaki "Kayıtlı Gün" penceresinde duruyor. */
    }

    /* KİLİTLİ GÜNDE BU PENCERE AÇILMAZ (01.09.2026): "istersen
       düzenleyebilirsin" cümlesi kilitli günde yanlış olurdu — o gün
       değiştirilemiyor. Yerine ekranın tepesindeki kilit şeridi çıkar. */
    var acilistaKilit = (YU.servis && YU.servis.tarihKilitDurumu)
      ? YU.servis.tarihKilitDurumu(db, tarih) : null;

    if (kayit && !acilistaKilit && !(bekleyenSonuc && bekleyenSonuc.tarih === tarih)) {
      YU.ui.modal({
        baslik: "Kayıtlı Gün",
        genislik: 440,
        govde: [
          YU.h("div", {
            metin: (tarih === YU.tarih.bugun() ? "Bugüne" : YU.fmt.tarih(tarih) + " gününe") +
              " ait veriler girilmiştir. İstersen düzenleyebilirsin; ama kaydedersen eski kayıt silinir, bu yeni kayıt olur.",
            stil: { font: "400 14.5px/1.6 var(--font)", color: "var(--metin)" }
          }),
          YU.h("div", {
            sinif: "yu-yardim",
            metin: kim + " · " + YU.fmt.tarih(tarih) + " " + YU.fmt.saat(damga) + " girmiş."
          })
        ],
        dugmeler: [{ metin: "Tamam", tur: "birincil" }]
      });
    }

    /* Sonuç kabı yalnız içi doluyken gövdeye takılır: boş dururken gövde
       boşluğu (gap) yüzünden tarih şeridini 18px aşağı itiyordu. */
    var sonucKap = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "12px" } });
    function sonucGoster() {
      if (!sonucKap.parentNode) govde.insertBefore(sonucKap, govde.firstChild);
    }

    /* basariDurumu: bu çizim BAŞARILI BİR KAYDIN hemen ardından yapıldı.
       Kayıt sonucu artık üstte yeşil şerit AÇMAZ (kullanıcı isteği,
       27.08.2026); haberi sağdaki Gün Sonu ve Kayıt paneli verir ve Kaydet
       düğmesi değişiklik yapılana kadar pasif kalır. Şerit yolu duruyor:
       gün SİLME sonucu hâlâ onu kullanır. */
    var basariMetni = null;
    if (bekleyenSonuc && bekleyenSonuc.tarih === tarih) {
      if (bekleyenSonuc.basariMetni) {
        basariMetni = bekleyenSonuc.basariMetni;
      } else {
        var onceki = YU.ui.serit({ tur: bekleyenSonuc.tur, baslik: bekleyenSonuc.baslik, metin: bekleyenSonuc.metin });
        seritSatirlari(onceki, bekleyenSonuc.satirlar);
        sonucGoster();
        sonucKap.appendChild(onceki);
      }
      /* Kayıt sonrası uyarı listesi de ÜSTTE GÖSTERİLMEZ (27.08.2026):
         sonuç sağdaki Gün Sonu ve Kayıt panelinde okunuyor. Uyarı varsa
         kaydetme anında bildirim olarak da geçiyor. */
    }
    bekleyenSonuc = null;

    /* ---------- 2. Tarih satırı ---------- */

    /* Tarih küçük bir kontrol: koca panel değil, tek satırlık ince şerit.
       Gün adı ve kayıt durumu sayfa alt başlığında zaten yazıyor. */
    var tarihAlan = YU.ui.alan({
      tip: "tarih", deger: tarih, genislik: "158px",
      onChange: function () {
        var v = tarihAlan.girdi.value;
        if (!gecerliTarih(v)) { tarihAlan.ayarla(tarih); return; }
        /* Gelecek gün seçilemez (kullanıcı direktifi, 24.08.2026): elle
           yazılan ileri tarih reddedilir, alan eski güne döner. */
        if (v > YU.tarih.bugun()) {
          YU.ui.bildir("Gelecek tarihe kayıt girilemez: " + YU.fmt.tarih(v) + " bugünden sonra (D17).", "hata");
          tarihAlan.ayarla(tarih);
          return;
        }
        /* M22: kaydedilmemiş değişiklik varsa sorulur; vazgeçilirse alan geri döner. */
        onaylaVeGit(
          function () { YU.git(KOD, { tarih: v }); },
          function () { tarihAlan.ayarla(tarih); }
        );
      }
    });
    /* D18'in ekran ayağı (M14): takvimden kampanya başlangıcından (en eski
       devirden) önceki gün seçilemez. Devir yoksa alt sınır konmaz; servis
       kuralı her durumda ayrıca denetler. */
    var enEskiDevirK = YU.dogrula.enEskiDevir(db);
    if (enEskiDevirK) tarihAlan.girdi.min = enEskiDevirK;

    function gunGit(fark) {
      /* M22: kaydedilmemiş değişiklik varsa önce sorulur. */
      onaylaVeGit(function () {
        YU.git(KOD, { tarih: fark === 0 ? YU.tarih.bugun() : YU.tarih.ekle(tarih, fark) });
      });
    }

    var tarihSatiri = YU.h("div", {
      stil: {
        display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
        padding: "8px 14px", background: "var(--yuzey-2)",
        border: "1px solid var(--kenar)", borderRadius: "var(--r)"
      }
    },
      YU.h("span", { metin: "Tarih", stil: { font: "600 13.5px/1 var(--font)", color: "var(--metin-2)" } }),
      tarihAlan.kok,
      satir(yatay("6px"),
        YU.ui.dugme({ metin: "Önceki Gün", kucuk: true, tur: "ikincil", onClick: function () { gunGit(-1); } }),
        YU.ui.dugme({
          metin: "Bugün", ikon: "#ic-calendar", kucuk: true, tur: "ikincil",
          pasif: tarih === YU.tarih.bugun(),
          onClick: function () { gunGit(0); }
        }),
        YU.ui.dugme({
          metin: "Sonraki Gün", kucuk: true, tur: "ikincil",
          /* İleri yürüme geçmiş günleri düzeltmek içindir; bugünden öteye
             geçilemez — gelecek güne kayıt D17 ile zaten reddedilir. */
          pasif: tarih >= YU.tarih.bugun(),
          baslik: tarih >= YU.tarih.bugun() ? "Bugünden sonrasına kayıt girilemez" : "",
          onClick: function () { gunGit(1); }
        })
      )
    );
    /* Tarih şeridi, altındaki iki sütunla aynı genişlikte durur. Sütunlar
       artık kabı doldurduğu için sabit 1478px sınırı kalktı (26.08.2026). */
    /* Tarih şeridi panellerle AYNI hizada başlar; yoksa şerit kenara yapışık,
       paneller içeride kalırdı (02.09.2026). */
    tarihSatiri.style.marginLeft = YAN_BOSLUK;
    tarihSatiri.style.marginRight = YAN_BOSLUK;
    kap.appendChild(tarihSatiri);
    kap.appendChild(yerlesim);

    /* ---------- 3. Ham girdiler (Şartname §4: operatör yalnız ham rakam girer) ---------- */

    var uretilenAlan = buyukAlan(YU.ui.alan({
      etiket: "Bugün Üretilen Dökme Kuru Küspe", tip: "sayi", sag: "kg",
      deger: kayit ? Number(kayit.UretilenDokme) : null,
      onInput: guncelle
    }));

    /* Statik "1 çuval = 50 kg…" açıklaması kaldırıldı (kullanıcı isteği,
       25.08.2026). Alan boş dururken hiçbir şey yazmaz; çuval girilince
       yerine hesabı yazan CANLI satır gelir (aşağıda guncelle). Yardım
       düğümü, sonradan yazılabilsin diye tek boşlukla kurulur. */
    /* ÇUVALLANAN SERBEST KG (kullanıcı kararı, 02.09.2026: "50 ve katları
       kuralını kaldır, 238 kg de yazılabilsin; hiçbir yerde adet yazmasın").
       28.08.2026'da alan kg'a çevrilmişti ama değer 50'nin katı olmak
       zorundaydı ve adet ara birim olarak yaşıyordu. İkisi de kalktı.
       Eski kayıt açılırken CuvalKg okunur; o boşsa (02.09.2026 öncesi kayıt)
       eski CuvalAdet × 50 ile çevrilir — YU.hesap.kayitCuvalKg. */
    var CUVAL_YARDIM = "";
    var cuvalAlan = buyukAlan(YU.ui.alan({
      etiket: "Çuvallanan", tip: "sayi", sag: "kg",
      deger: kayit ? YU.yuvarla(YU.hesap.kayitCuvalKg(kayit)) : null,
      yardim: " ",
      onInput: guncelle
    }));   /* sağ boşluk ÜRETİLEN ile AYNI (kullanıcı isteği, 28.08.2026):
              64px, eki "çuval" iken konmuştu; ek "kg" olunca rakam ile kg
              arası üstteki kutudan 18px fazla kalıyordu (ölçüldü 46 / 64). */
    var cuvalYardim = cuvalAlan.kok.querySelector(".yu-yardim");

    var satilanAlan = buyukAlan(YU.ui.alan({
      etiket: "Bugün Satılan Dökme Kuru Küspe", tip: "sayi", sag: "kg",
      deger: kayit ? Number(kayit.SatilanDokme) : null,
      onInput: guncelle
    }));

    /* ---------- 4. Kalem (silo dağıtımı) bileşeni ----------
       Her kalem (üretim yerleştirme / satış çekişi / çuvallama çekişi) aynı
       bileşendir: başlıkta gereken miktar büyük yazılır, altında silo başına bir
       kutu ve sağında "Hepsini Ekle", en altta Temizle düğmesi durur.
       Üretim ve satış kalemleri HER ZAMAN görünür
       (kullanıcı isteği, 23.08.2026): gerekmiyorsa 0 kg yazar, kutular ve
       düğmeler pasifleşir, tek cümle sebebini söyler. Çuvallama çekişi
       istisna olduğu için yalnız gerektiğinde belirir (Şartname §4: dağıtım
       otomatik yapılmaz, son söz kullanıcıda). */

    function kalemKur(d) {
      var giren = d.yon === "giren";
      var renk = giren ? "var(--olumlu)" : "var(--olumsuz)";
      var alanlar = [], dugmeler = [], r;
      var gereken = 0, etkin = false;

      var buyuk = YU.h("span", {
        metin: "—",
        stil: { font: "600 24px/1 var(--sayi)", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", color: renk, whiteSpace: "nowrap" }
      });
      /* Başlık satırı: kalem adı + gereken miktar. "Dağıtılan X / Y kg" sayacı
         ve Tamam/Eksik/Fazla rozeti kaldırıldı (kullanıcı isteği, 26.08.2026):
         aynı bilgi tek satırda üç kez yazıyordu. Eksik ya da fazla dağıtım,
         "Gün Sonu ve Kayıt" panelindeki durum satırında D3/D5 olarak zaten
         söyleniyor. */
      var basSatir = YU.h("div", { stil: { display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" } },
        /* Etiket ölçüsü ALAN ETİKETİYLE AYNI (kullanıcı isteği, 28.08.2026:
           "satırlardaki yazıların boyutu, hizası eşdeğer olsun"). Kutu
           etiketleri 600 14.5px/1.3; bu satır 15px'ti ve yarım punto fark
           göze çarpıyordu. Rakam (buyuk) 24px kalır — o bir sonuç, etiket
           değil. */
        YU.h("span", { metin: d.baslik, stil: { font: "600 14.5px/1.3 var(--font)", color: "var(--metin)" } }),
        buyuk
      );
      /* 13,5 -> 15px (kullanıcı isteği, 27.08.2026): "Bugün üretilenden fazla
         çuvallanmış…" gibi durum cümleleri kutunun içinde küçük kalıyordu. */
      var aciklama = YU.h("div", { stil: { display: "none", font: "400 14.5px/1.5 var(--font)", color: "var(--metin-3)" } });

      /* Silo kutuları ve Temizle düğmesi biraz aşağıda başlar (kullanıcı
         isteği, 25.08.2026): başlık ile kutular arasındaki 9px akış boşluğuna
         24px eklenir. Blok tek parça indiği için Temizle de birlikte iner. */
      /* Panel boyu kısaldı (kullanıcı isteği, 27.08.2026): başlık ile silo
         kutuları arası 24px -> 12px. Yazı ölçüleri değişmedi, yalnız dikey
         boşluk kısaldı (23.08'deki "sıkılaştırma" kararının devamı). */
      var kutuIzgara = YU.h("div", { stil: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginTop: "12px" } });
      for (r = 0; r < silolar.length; r++) {
        (function (silo) {
          var a = YU.ui.alan({ tip: "sayi", sag: "kg", onInput: guncelle });
          /* Dağıtım kutusundaki rakam büyütüldü (kullanıcı isteği,
             27.08.2026): ortak 14,5px bu kutuda küçük kalıyordu. Yalnız bu
             ekranın silo kutuları etkilenir; ortak .yu-girdi ölçüsüne
             dokunulmaz (KURAL 10.5). */
          a.girdi.style.font = "600 17px/1.4 var(--sayi)";
          /* Giriş satırı sağ kenardan biraz içeri alınır (kullanıcı isteği,
             27.08.2026: "çok az daralt"). Yalnız KUTU daralır; üstündeki
             "Silo N · gün başı X kg" satırı hücrenin iki ucunda kalır, üç
             sütunun başlık hizası bozulmaz. Sol paneldeki büyük alanlarla
             aynı yöntem: sabit genişlik değil sağ boşluk. */
          a.kok.style.marginRight = "10px";
          a.girdi.setAttribute("aria-label", d.ariaAd + " · " + silo.Ad);
          alanlar.push(a);
          /* Kutunun içinde "Hepsini Ekle": gereken miktarın TAMAMI bu siloya
             yazılır, bu kalemin öbür silo kutuları boşalır (kullanıcı isteği). */
          var hepsi = YU.ui.dugme({
            metin: "Hepsini Ekle", kucuk: true, tur: "sade",
            baslik: "Gereken miktarın tamamını " + silo.Ad + " silosuna yaz",
            onClick: eylem(function () { var g = {}; g[silo.Id] = gereken; yaz(g); })
          });
          kutuyaDugmeKoy(a, hepsi);
          dugmeler.push(hepsi);
          /* "gün başı X kg" satırı KALDIRILDI (kullanıcı isteği, 28.08.2026)
             — yalnız BU ekranın dağıt/çek kutularından. Aynı rakam sağdaki
             Gün Sonu kartlarında duruyor; kutunun üstünde her silo için
             tekrarlanması satırı kalabalıklaştırıyordu. Silo adı ipucunda
             gün başını taşımaya devam eder — isteyen görür (KURAL 8). */
          var adEl = YU.h("span", {
            metin: silo.Ad,
            stil: { font: "600 13.5px/1.2 var(--font)", color: "var(--metin-2)" }
          });
          adEl.title = "Gün başı " + YU.fmt.kgU(gunBasi[silo.Id]);
          kutuIzgara.appendChild(YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" } },
            YU.h("div", { stil: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" } },
              adEl
            ),
            a.kok
          ));
        })(silolar[r]);
      }

      function degerler() {
        var l = [];
        for (var k = 0; k < alanlar.length; k++) l.push({ siloId: silolar[k].Id, miktar: alanlar[k].deger() });
        return l;
      }

      function temizle() { for (var k = 0; k < alanlar.length; k++) alanlar[k].ayarla(""); }

      function yaz(dagilim) {
        for (var k = 0; k < alanlar.length; k++) {
          var m = YU.yuvarla(dagilim[silolar[k].Id] || 0);
          alanlar[k].ayarla(m > 0 ? m : "");
        }
      }


      function eylem(fn) {
        return function () { if (!etkin) return; fn(); guncelle(); };
      }

      /* "Hepsi Silo 1'e" düğmesi kalktı: kutu içindeki "Hepsini Ekle" aynı işi
         her silo için yapıyor; iki düğme aynı işi yapınca hiyerarşi bozuluyordu. */
      /* Eşit Böl kaldırıldı (kullanıcı isteği, 23.08.2026); yalnız Temizle. */
      var dugmeTemizle = YU.ui.dugme({ metin: "Temizle", kucuk: true, tur: "sade", onClick: eylem(temizle) });
      /* Kenarlık (kullanıcı isteği, 27.08.2026: "kenarları belli olsun").
         .yu-dugme zaten 1px saydam kenar taşıyor; yalnız rengi verilir, ölçü
         ve yerleşim oynamaz. Ortak .sade sınıfı ezilmez (KURAL 10.5) — renk
         bu düğmeye yazılır. */
      dugmeTemizle.style.borderColor = "var(--metin-5)";
      dugmeler.push(dugmeTemizle);
      /* Temizle, silo kutularından biraz daha ayrık durur (kullanıcı isteği,
         26.08.2026): akış boşluğu 9px, üstüne 12px eklenir. */
      var dugmeSatiri = satir({ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "12px" }, dugmeTemizle);

      /* PERDE (kullanıcı isteği, 26.08.2026): kalem pasifken ve söylenecek bir
         sebep varken, dağıtım alanının ÜSTÜNE bir ekran iner. Kullanılamayan
         silo kutuları ve Temizle görünmez olur; ekranda yalnız sebep yazar.
         Amaç kafa karışıklığını kesmek: "girilemeyen kutu" diye bir şey kalmaz.
         Perde kutuların yerini kaplar, akıştan çıkarmaz — panel boyu oynamaz. */
      var perdeMetin = YU.h("div", {
        stil: { font: "500 16px/1.6 var(--font)", color: "var(--metin-2)", maxWidth: "440px" }
      });
      var perde = YU.h("div", {
        stil: {
          position: "absolute", left: "0", right: "0", top: "0", bottom: "0",
          display: "none", alignItems: "center", justifyContent: "center",
          padding: "12px 16px", textAlign: "center",
          background: "var(--yuzey)", borderRadius: "var(--r)"
        }
      }, perdeMetin);
      var dagitimKap = YU.h("div", {
        stil: {
          position: "relative", display: "flex", flexDirection: "column", gap: "9px", minWidth: "0",
          /* Silo kutuları sol kenardan içeri alınır (kullanıcı isteği,
             27.08.2026: "Silolara Dağıt'taki silo 1 2 3'ü birazcık sağa
             yaklaştır"). Temizle de aynı blokta olduğu için Silo 1 ile
             hizalı kalır. Kalem bazlı seçenek: yalnız istenen bloğa uygulanır. */
          marginLeft: d.solBosluk || "0"
        }
      }, kutuIzgara, dugmeSatiri, perde);

      /* display değerleri açıkça yazılır ("" değil): inline display kuruluyor,
         "" yazmak onu siler ve blok düz akışa düşer. */
      var kok = YU.h("div", { stil: { display: d.hepGoster ? "flex" : "none", flexDirection: "column", gap: "9px" } },
        basSatir, aciklama, dagitimKap);

      function tazele(yeniGereken, bosMetin, aciklamaMetni) {
        var sayisal = isFinite(yeniGereken), k;
        gereken = sayisal ? YU.yuvarla(yeniGereken) : 0;
        etkin = sayisal && gereken > tol;

        /* Gerek kalmadığında alanlar boşaltılır: dolu kalırsa D4/D6/D13 kesin
           hata verir, kullanıcı sebebini aramak zorunda kalır. */
        if (sayisal && !etkin) temizle();

        /* Blok hep yerinde durur; gerekmiyorsa kutular ve düğmeler pasif. */
        for (k = 0; k < alanlar.length; k++) alanlar[k].girdi.disabled = !etkin;
        for (k = 0; k < dugmeler.length; k++) dugmeler[k].disabled = !etkin;
        kok.style.display = (etkin || d.hepGoster) ? "flex" : "none";

        buyuk.textContent = YU.fmt.kgU(gereken);
        buyuk.style.color = etkin ? renk : "var(--metin-4)";
        /* Açıklama düz yazı ya da { metin, uyari:true } olabilir. Uyarı olan
           satır silik kırmızıyla yazılır (kullanıcı isteği, 25.08.2026):
           --olumsuz korkutucu geldiği için --olumsuz-silik kullanılır, yazı
           ağırlığı da normalde bırakılır. */
        var ham = etkin ? aciklamaMetni : bosMetin;
        var uyariMi = !!(ham && ham.uyari);
        var metin = (ham && typeof ham === "object") ? ham.metin : ham;
        /* Kalem pasif VE sebebi varsa: perde iner, sebep perdenin ortasında
           yazar; kutuların altındaki satır boş kalır. Öbür durumlarda perde
           kalkar, cümle eskisi gibi kutuların üstünde tek satır durur. */
        var perdeliMi = !etkin && !!metin;
        perde.style.display = perdeliMi ? "flex" : "none";
        perdeMetin.textContent = perdeliMi ? metin : "";
        perdeMetin.style.color = uyariMi ? "var(--olumsuz-silik)" : "var(--metin-2)";
        aciklama.textContent = perdeliMi ? "" : (metin || "");
        aciklama.style.display = (!perdeliMi && metin) ? "block" : "none";
        aciklama.style.color = uyariMi ? "var(--olumsuz-silik)" : "var(--metin-3)";
      }

      return {
        kod: d.kod, kok: kok, alanlar: alanlar, basSatir: basSatir,
        degerler: degerler, yaz: yaz, tazele: tazele,
        etkinMi: function () { return etkin; }
      };
    }

    var kalemUretim = kalemKur({
      kod: "uretim", yon: "giren", baslik: "Siloya girecek", hepGoster: true,
      ariaAd: "Üretimden girecek", solBosluk: "14px"
    });
    var kalemSatis = kalemKur({
      kod: "satis", yon: "cikan", baslik: "Satış için çıkacak", hepGoster: true,
      ariaAd: "Satış için çıkacak", solBosluk: "14px"
    });
    var kalemCuvallama = kalemKur({
      kod: "cuvallama", yon: "cikan", baslik: "Çuvallama için çıkacak", hepGoster: false,
      ariaAd: "Çuvallama için çıkacak", solBosluk: "14px"
    });

    /* "Satış için çıkacak" ile "Çuvallama için çıkacak" arasındaki ayraç
       (kullanıcı isteği, 27.08.2026): KALIN, keskin ve panelin kendi anlam
       rengini (çıkan = kırmızı) taşır. YALNIZ çuvallama bloğu açıkken
       görünür — o blok Durum B dışında hiç çizilmiyor, çizgi tek başına
       kalınca altında bir şey yokmuş gibi duruyordu. Durumu guncelle()
       her tazelemede kalemin etkinliğine göre ayarlar. */
    var cuvallamaAyraci = YU.h("div", {
      stil: {
        display: "none", height: "0", borderTop: "3px solid var(--olumsuz)",
        borderRadius: "0", opacity: ".7"
      }
    });
    var kalemler = [kalemUretim, kalemSatis, kalemCuvallama];

    function kalemBul(kod) {
      for (var k = 0; k < kalemler.length; k++) if (kalemler[k].kod === kod) return kalemler[k];
      return null;
    }

    /* ---------- 5. Adım 1 ve 2: Siloya Giren / Silodan Çıkan ---------- */

    /* Adım paneli: ortak panel (mavi zemin tema.css .yu-panel kuralından gelir);
       içindeki kutular beyaz kalır, panel sınırı böyle okunur. Hover yok. */
    function adimPaneli(govdeListesi, ekSinif) {
      var p = YU.ui.panel({ govde: govdeListesi });
      /* Dikey sıkılaştırma (kullanıcı isteği, 23.08.2026 · 31.08.2026'da bir
         adım daha): yazı, girdi ve düğme ölçüleri AYNEN kalır — kısalan
         yalnız panelin kendi dolgusu ve içindeki boşluklar. Dolgu ortak
         .yu-panel kuralında 14px; burada bu ekrana özel 10px'e iner, başka
         hiçbir panel etkilenmez (KURAL 10.5). */
      p.querySelector(".yu-panel-govde").style.gap = "8px";
      p.style.paddingTop = "10px";
      p.style.paddingBottom = "10px";
      if (ekSinif) p.className += " " + ekSinif;
      return p;
    }

    function rakamYigini() {
      var kap = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "8px" } });
      for (var a = 0; a < arguments.length; a++) kap.appendChild(arguments[a].kok);
      return kap;
    }

    /* 2×2 ızgara: solda adım panelleri, sağda dağıtım kutuları. */
    var adimIzgarasi = YU.h("div", {
      stil: {
        display: "grid",
        /* Sağ kolonun alt sınırı 0 DEĞİL 360px: dar pencerede minmax(0,…)
           kolonu 30px'e kadar eziyordu (ölçüldü: 981px kapta dağıtım kutusu
           30px kaldı). Alt sınırla kutu ezilmez, gerekirse içerik kaydırılır. */
        gridTemplateColumns: "minmax(240px, 0.85fr) minmax(360px, 2.15fr)",
        /* Satır arası sütun arasından GENİŞ (kullanıcı isteği, 27.08.2026:
           "arası boşluk olsun alt taraftan ve üst taraftan"): üstteki ikili
           ile alttaki ikili birbirinden ayrışsın. */
        /* ÇİFT PANEL (kullanıcı isteği, 27.08.2026): satırın iki paneli tek
           kartın yarıları. Sütun boşluğu 0 — dikişi kesik çizgi çiziyor.
           alignItems "start" değil "stretch": yarılar farklı boyda kalırsa
           kart basamaklanır, "tek parça" izlenimi bozulurdu. */
        columnGap: "0", rowGap: "18px", alignItems: "stretch"
      }
    });

    /* SOL ÜST — 1. adımın rakamları. "Siloya girecek · 200 kg" satırı sağdaki
       dağıtım bloğundan ALINIP Çuvallanan'ın altına konur (27.08.2026):
       kullanıcının yazdığı iki rakamın SONUCU, yazıldıkları yerin altında
       okunur (KURAL 8). appendChild düğümü taşır; kalem kendi tazelemesini
       aynı düğüm üzerinden sürdürdüğü için rakam canlı kalır. */
    var solUst = rakamYigini(uretilenAlan, cuvalAlan);
    kalemUretim.basSatir.style.paddingTop = "2px";
    solUst.appendChild(kalemUretim.basSatir);
    adimIzgarasi.appendChild(ciftOkuKoy(adimPaneli([
      adimBasligi(1, "giren", "Siloya Giren", null, true),
      solUst
    ], "yu-adim-serit yu-serit-giren yu-cift-sol")));

    /* SAĞ ÜST — dağıtım kutusu, kendi çerçevesiyle. */
    var dagitPanel = dagitimKutusu("Silolara Dağıt", kalemUretim.kok, "yu-cift-sag");
    adimIzgarasi.appendChild(dagitPanel);

    /* SOL ALT — 2. adımın rakamı. "Çuvallama için çıkacak" SAĞDA kalır:
       o blok yalnız Durum B'de beliriyor, solda görünüp kaybolan bir satır
       kafa karıştırırdı. */
    var solAlt = rakamYigini(satilanAlan);
    kalemSatis.basSatir.style.paddingTop = "2px";
    solAlt.appendChild(kalemSatis.basSatir);
    adimIzgarasi.appendChild(ciftOkuKoy(adimPaneli([
      adimBasligi(2, "cikan", "Silodan Çıkan", null, true),
      solAlt
    ], "yu-adim-serit yu-serit-cikan yu-cift-sol")));   /* sol kenarda kırmızı şerit (tema.css) */

    /* SAĞ ALT — iki çekiş kalemi ve aralarındaki ayraç (KURAL 10.2). */
    var cekPanel = dagitimKutusu("Silolardan Çek",
      YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "12px" } },
        kalemSatis.kok,
        cuvallamaAyraci,
        kalemCuvallama.kok), "yu-cift-sag");
    adimIzgarasi.appendChild(cekPanel);

    /* ------------------------------------------------------------------
       SAĞ PANELLER SOL PANELLER DOLMADAN KAPALI (kullanıcı isteği,
       28.08.2026): "Silolara Dağıt / Silolardan Çek panelleri pasif olsun,
       Siloya Giren ve Silodan Çıkan komple doldurulduktan sonra aktif olsun;
       çuvallanan yoksa 0 yazılsın."

       Sebep: sağdaki dağıtım/çekiş HEDEFİ üç rakamdan hesaplanır (üretilen −
       çuval kg, satılan). Rakamlar eksikken hedef bilinmiyor; operatör
       silolara yazıp sonra üstteki rakamı değiştirince dağıtım tutmaz oluyor
       ve D3/D5/D13 hatası alıyordu. Kapı, sırayı dayatır.

       ÖLÇÜ: alan BOŞ olmasın — 0 geçerli bir cevaptır ("bugün çuvallama yok").
       Bu yüzden ayrıştırılmış sayıya değil, kutunun ham metnine bakılır.

       YALNIZ GÖRÜNÜM: doğrulama, kayıt, raporlama ve yedek HİÇ etkilenmez;
       pasifken de alanların değeri okunur (girdiTopla disabled kutuyu da
       okur). Kayıtlı gün açılırken üç alan dolu geldiği için paneller
       kendiliğinden açık başlar. */
    function solTamamMi() {
      var a = uretilenAlan.girdi.value.trim();
      var b = cuvalAlan.girdi.value.trim();
      var c = satilanAlan.girdi.value.trim();
      return a !== "" && b !== "" && c !== "";
    }

    function panelKilidi(panel, kapali) {
      var i, el;
      var girdiler = panel.querySelectorAll("input, button");
      for (i = 0; i < girdiler.length; i++) {
        el = girdiler[i];
        /* Kilit AÇILIRKEN yalnız bu kapının kapattıklarını geri açar:
           başka bir kural (ör. "Hepsini Ekle" hedefi yokken pasif) kendi
           düğmesini kapattıysa ona dokunulmaz. */
        if (kapali) {
          /* Zaten kapalı olanı işaretlemeyiz — açılışta onu açmak bize düşmez;
             ama HER TURDA yeniden kapatırız, araya giren kural açmış olabilir. */
          if (!el.disabled) el.setAttribute("data-kilit", "sol");
          el.disabled = true;
        } else if (el.getAttribute("data-kilit") === "sol") {
          el.disabled = false;
          el.removeAttribute("data-kilit");
        }
      }
      /* Soldurma SINIFLA (tema.css .yu-panel.yu-sonuk): kenarlık, başlık,
         kutular ve düğmeler tek opacity ile birlikte solar; pasif kutular
         ayrıca gri zemine düşer. */
      if (kapali) panel.classList.add("yu-sonuk");
      else panel.classList.remove("yu-sonuk");
    }

    /* Kapalıyken sebebi panelin kendi başlığının yanında yazar — kullanıcı
       neden yazamadığını aramasın (KURAL 8: bilgi okunduğu yerde). */
    function kilitNotu(panel, kapali) {
      var etiket = panel.querySelector(".yu-panel-govde > div");
      if (!etiket) return;
      var not = etiket.querySelector(".yu-kilit-notu");
      if (!kapali) { if (not) not.parentNode.removeChild(not); return; }
      if (not) return;
      etiket.appendChild(YU.h("span", {
        sinif: "yu-kilit-notu",
        metin: "— önce soldaki rakamları gir",
        stil: {
          marginLeft: "8px", textTransform: "none", letterSpacing: "normal",
          font: "400 12px/1 var(--font)", color: "var(--metin-5)"
        }
      }));
    }

    /* İLK GİRDİ SATIRLARI AYNI ENLEMDE (kullanıcı isteği, 28.08.2026:
       "Bugün Üretilen'in giriş satırıyla Silolara Dağıt'taki Silo 1 2 3'ün
       satırlarını aynı enlemde yapar mısın").

       Kayma etiket yüksekliklerinden doğuyordu: solda tek satırlık alan
       etiketi, sağda "Silo 1" + "gün başı X kg" satırı — ölçüldü, sağdaki
       kutu 10px yukarıda başlıyordu. Fark SABİT YAZILMAZ; yazı boyu, dil ve
       pencere genişliği değiştikçe kayar. Her çizimde ölçülür ve sağ kutunun
       üstüne dolgu olarak konur. Yalnız İLK satır hizalanır: solda iki, sağda
       üç kutu var, hepsini hizalamak matematiksel olarak mümkün değil. */
    function ilkSatirHizala() {
      var ciftler = [[uretilenAlan, dagitPanel], [satilanAlan, cekPanel]];
      for (var i = 0; i < ciftler.length; i++) {
        var solGirdi = ciftler[i][0].girdi;
        var govdeEl = ciftler[i][1].querySelector(".yu-panel-govde");
        if (!solGirdi || !govdeEl) continue;
        var ic = govdeEl.children[1];            /* [0] başlık bloğu, [1] içerik */
        var sagGirdi = ciftler[i][1].querySelector(".yu-girdi");
        if (!ic || !sagGirdi) continue;
        ic.style.paddingTop = "";                /* önce sıfırla, sonra ölç */
        /* ONDALIK KORUNUR: tam sayıya yuvarlamak 1px kayma bırakıyordu
           (ölçüldü: 578 / 579). Tarayıcı alt piksel dolguyu kendisi çözer. */
        var fark = solGirdi.getBoundingClientRect().top -
                   sagGirdi.getBoundingClientRect().top;
        /* Emniyet: 0-60px dışındaki fark yerleşim bozulmuş demektir, dokunma. */
        if (fark > 0 && fark <= 60) ic.style.paddingTop = fark.toFixed(2) + "px";
      }
    }

    function sagPanelleriTazele() {
      var kapali = !solTamamMi();
      panelKilidi(dagitPanel, kapali);
      panelKilidi(cekPanel, kapali);
      kilitNotu(dagitPanel, kapali);
      kilitNotu(cekPanel, kapali);
      ilkSatirHizala();
    }

    /* İlk çizimde yerleşim henüz oturmamış olabilir; bir kare sonra ölçülür.
       Pencere ölçüsü değişince etiket satır sayısı değişebilir — yeniden. */
    if (window.requestAnimationFrame) window.requestAnimationFrame(ilkSatirHizala);
    else setTimeout(ilkSatirHizala, 0);
    window.addEventListener("resize", ilkSatirHizala);

    /* Hover kuralının kapsamı (tema.css .yu-kk-ekran): yazı girilen kutular
       yalnız bu ekranda gri hover alır, ortak .yu-girdi ezilmez. */
    govde.classList.add("yu-kk-ekran");

    govde.appendChild(adimIzgarasi);


    /* Kayıtlı günü aç: silo hareketleri alanlara geri yazılır. */
    if (kayit) {
      kalemUretim.yaz(gunHareketleri(db, tarih, "DokmeUretim"));
      kalemCuvallama.yaz(gunHareketleri(db, tarih, "Cuvallama"));
      kalemSatis.yaz(gunHareketleri(db, tarih, "DokmeSatis"));
    }

    /* Kaydedilmemiş girdi bekçisi (DUZELTME-PLANI M22): form kurulduğu andaki
       imza saklanır; gün gezinmesi ve ekran-terk düğmeleri fark varsa önce
       sorar (22-malzeme-girisi'ndeki ayrilmaOnayi ile aynı dil). Kaydet
       başarısı YU.git -> yenile ile ekranı yeniden kurar, imza tazelenir. */
    var baslangicImza = JSON.stringify(girdiTopla());

    function kaydedilmemisVarMi() {
      try {
        return JSON.stringify(girdiTopla()) !== baslangicImza;
      } catch (e) {
        return true; /* imza alınamıyorsa güvenli taraf: sor */
      }
    }

    function onaylaVeGit(devamEt, vazgecilince) {
      if (!kaydedilmemisVarMi()) { devamEt(); return; }
      YU.ui.onay({
        baslik: "Kaydedilmemiş Değişiklik Var",
        metin: YU.fmt.tarih(tarih) + " günü için girilen değerler henüz kaydedilmedi. " +
          "Devam ederseniz bu değişiklikler kaybolur.",
        onayMetni: "Kaydetmeden çık",
        iptalMetni: "Sayfada kal",
        tehlike: true
      }).then(function (evet) {
        if (evet) devamEt();
        else if (vazgecilince) vazgecilince();
      });
    }

    /* ---------- 6. Adım 3: Gün sonu silo durumu + kayıt (tek panel) ---------- */

    /* SİLO KARTLARI SAĞ PANELDEN ÇIKTI (kullanıcı isteği, 02.09.2026):
       "Gün Sonu ve Kayıt panelini kaldır, bu en son kaydettikten sonra ortaya
       panel olarak gelsin". Kartlar artık sol yığının altında, kayıt yazıldıktan
       sonra açılan kendi panelinde durur. Sağ panelde yalnız kayıtlı gün uyarısı,
       durum kutusu, Kaydet ve Günü Sıfırla kalır.
       Izgara dikeyden yatağa döndü: orta alan geniş, kartlar yan yana sığar. */
    var siloOzetleri = [];
    var siloIzgara = YU.h("div", {
      stil: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "10px" }
    });

    for (i = 0; i < silolar.length; i++) {
      (function (silo) {
        var kapasite = Number(silo.Kapasite) || 0;
        /* ÖLÇÜLER KÜÇÜLDÜ (kullanıcı isteği, 31.08.2026 akşamı: "panelindeki
           yazılar büyük", ardından "1,5 px kadar daha küçült").
             gün sonu        22 -> 19 -> 17,5 px
             gün başı, fark  18 -> 15,5 -> 14 px
           Sıralama korundu: gün sonu en büyük, gün başı ve fark onun altında.
           Silo adı 14,5 px'te kaldı. */
        var sonu = YU.h("span", { metin: "—", stil: { font: "600 17.5px/1 var(--sayi)", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" } });
        /* Bugünün farkı: +X yeşil / −X kırmızı; 0 iken gizli (kullanıcı isteği, 23.08.2026). */
        /* FARK SATIRI (kullanıcı isteği, 31.08.2026): rakam renkli, yanındaki
           söz düz metin renginde — "+93.000 kg Artar". Giren/çıkan dökümü
           KALDIRILDI; kartta tek satır kalır. Ayrıntı ipucunda durur. */
        /* 16 -> 18 px (kullanıcı isteği, 31.08.2026). Gün sonu rakamı 22 px;
           fark onun bir kademe altında kalır, sıralama bozulmaz. */
        var farkSayi = YU.h("span", { stil: { font: "600 14px/1 var(--sayi)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" } });
        /* Söz, soldaki rakamla AYNI ölçüde (kullanıcı isteği, 31.08.2026):
           ikisi birlikte 18 px / 600. Yazı tipi gövde fontu kalır — sayı
           fontu rakam için. */
        var farkSoz = YU.h("span", { stil: { font: "600 14px/1 var(--font)", color: "var(--metin)", whiteSpace: "nowrap" } });
        var fark = YU.h("span", { stil: { display: "none", alignItems: "baseline", gap: "6px" } }, farkSayi, farkSoz);
        /* Gün başı ve ok ayrı düğüm: değişiklik yoksa ikisi de gizlenir,
           kartta yalnız gün sonu rakamı kalır (kullanıcı isteği, 26.08.2026).
           Başlangıç "none"; sayfa kurulurken çağrılan guncelle() doğrusunu yazar. */
        /* Gün başı rakamı ÜSTÜ ÇİZİLİ yazılır (kullanıcı isteği, 27.08.2026):
           "1.000 kg -> 8.000 kg" satırında hangisinin eski değer olduğu
           okumadan anlaşılsın. Çizgi rakamın kendisinden silik: --metin-5. */
        /* 31.08.2026 akşamı bir ara kaldırılmıştı; kullanıcı aynı gün
           "eski hâline al" dedi, geri getirildi. */
        var basi = YU.h("span", {
          sinif: "yu-mono", metin: YU.fmt.kgU(gunBasi[silo.Id]),
          stil: {
            display: "none", fontSize: "14px", color: "var(--metin-3)",
            textDecoration: "line-through", textDecorationColor: "var(--metin-5)",
            textDecorationThickness: "1.5px"
          }
        });
        var ok = YU.h("span", { metin: "→", stil: { display: "none", color: "var(--metin-5)" } });
        /* SATIRDA YALNIZ GÜNCEL STOK (kullanıcı isteği, 02.09.2026: "sadece
           anlık olarak siloların stoklarını göstersin, yani eklendi çıkarıldı
           vs yazmasın"). basi / ok / fark düğümleri KURULUR ve gunSonuTazele
           onlara yazmayı sürdürür — yalnız karta eklenmezler, bu yüzden
           ekranda görünmezler. Geri istenirse tek satırlık değişiklik. */
        var sayiSatiri = YU.h("div", { stil: { display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" } }, sonu);
        var cubukKap = YU.h("div");
        var kart = YU.h("div", {
          stil: {
            display: "flex", flexDirection: "column", gap: "8px", minWidth: "0",
            padding: "12px 14px", border: "1px solid var(--kenar)", borderRadius: "var(--r)", background: "var(--yuzey)"
          }
        },
          /* Yüzde kalktığı için başlık satırı tek öğe: silo adı (26.08.2026). */
          YU.h("span", { metin: silo.Ad, stil: { font: "600 14.5px/1.2 var(--font)", color: "var(--metin)" } }),
          /* Dipnot satırı kaldırıldı (kullanıcı isteği, 26.08.2026): aynı
             cümle her kartta tekrarlıyordu. Bilgi ipuçlarına taşındı
             (KURAL 8): gün başı/gün sonu bu satırın ipucunda, kapasite
             doluluk çubuğunun ipucunda. */
          sayiSatiri,
          cubukKap
        );
        siloIzgara.appendChild(kart);
        siloOzetleri.push({ silo: silo, kapasite: kapasite, sonu: sonu, fark: fark,
                            farkSayi: farkSayi, farkSoz: farkSoz,
                            cubukKap: cubukKap, basi: basi, ok: ok, sayiSatiri: sayiSatiri });
      })(silolar[i]);
    }

    /* ---------- 7. Durum satırı + eylemler (Adım 3'ün altı) ---------- */

    var durumIkon = YU.h("span", { stil: { display: "flex", flex: "none", alignSelf: "flex-start", marginTop: "1px" } });
    /* "Bu Gün Daha Önce Kaydedilmiş" kutusuyla AYNI ÖLÇÜ (kullanıcı isteği,
       31.08.2026 akşamı): 15,5 -> 14 px. Alttaki madde listesi de 14'ten
       13'e iner ki başlık ile liste arasındaki punto farkı korunsun. */
    /* 600 -> 550 ağırlık ve hafif harf aralığı (02.09.2026): kalın renkli
       başlık bağırıyordu; kurumsal ekranlarda durum satırı sakin okunur. */
    var durumBaslik = YU.h("div", { stil: { font: "550 13.5px/1.4 var(--font)", letterSpacing: ".01em", color: "var(--metin)" } });
    /* HATA LİSTESİ HİZALI (kullanıcı isteği, 27.08.2026): madde imi ve
       serbest cümle yerine iki sütunlu ızgara. Sol sütun "Silo 1:" gibi
       önekleri taşır ve max-content olduğu için bütün satırlarda AYNI
       genişlikte durur; sağ sütunda cümle başlar. Öneksiz bir madde
       (uyarılar) iki sütunu birden kaplar. */
    var durumListe = YU.h("div", {
      stil: {
        display: "none", gridTemplateColumns: "max-content 1fr",
        columnGap: "8px", rowGap: "4px", margin: "5px 0 0",
        font: "400 13px/1.5 var(--font)", color: "var(--metin-2)"
      }
    });

    /* İkon "+" değil onay işareti (02.09.2026): kaydetmek ekleme değil,
       tamamlamadır. Artı işareti "yeni satır ekle" düğmelerinin dili. */
    var dugmeKaydet = YU.ui.dugme({
      metin: "Kaydet", ikon: "#ic-checklist", tur: "birincil",
      baslik: "Ctrl + Enter",
      onClick: kaydet
    });
    dugmeKaydet.className += " yu-kk-kaydet";
    dugmeKaydet.style.padding = "11px 20px";
    dugmeKaydet.style.fontSize = "14.5px";

    var dugmeSil = silinebilir ? YU.ui.dugme({
      /* "Günü Sil" -> "Günü Sıfırla" (kullanıcı isteği, 28.08.2026): gün
         takvimden kalkmıyor, o güne girilen rakamlar sıfırlanıyor. Yaptığı
         iş aynı, adı yaptığı işi söylüyor. */
      metin: "Günü Sıfırla", ikon: "#ic-trash", tur: "tehlike", onClick: gunuSil
    }) : null;
    if (dugmeSil) {
      dugmeSil.className += " yu-kk-sifirla";
      dugmeSil.style.padding = "11px 20px";
      dugmeSil.style.fontSize = "14.5px";
    }

    /* Tam genişlik kalktı (yan yana dizilim): ikisi de aynı ölçüde durur,
       böylece satır dengeli okunur. */
    dugmeKaydet.style.minWidth = "148px";
    if (dugmeSil) dugmeSil.style.minWidth = "148px";
    /* DURUM KUTUSU (kullanıcı isteği, 27.08.2026): uyarı panelin dibinde,
       düğmenin hemen üstünde duruyordu; silo kartlarıyla arasında koca bir
       boşluk kalıyordu. Artık kendi kartı var ve O BOŞLUĞUN ORTASINA oturur:
       ne Silo 3'e yapışır ne düğmeye. Kart, durumun rengini alır — kırmızı
       engel, sarı uyarı, yeşil hazır. Boşluk yoksa (kısa panelde) kart
       kendiliğinden içeriği kadar kalır. */
    /* RESMİ GÖRÜNÜM (kullanıcı isteği, 02.09.2026: "çok çocuk gibi duruyor,
       resmi bir programa aitmiş gibi değil"). Dolgulu pastel zemin ve renkli
       çerçeve kalktı; kutu nötr yüzeyde durur, durumun rengini SOL KENARDAKİ
       ince şerit taşır. Renk hâlâ okunur (ikon ve başlık), ama ekranı
       boyamaz. Köşe 10 -> 6 px: yumuşak balon yerine dosya kartı hissi. */
    var durumKutu = YU.h("div", {
      stil: {
        display: "flex", gap: "10px", alignItems: "flex-start", width: "100%",
        boxSizing: "border-box", padding: "11px 14px", borderRadius: "6px",
        border: "1px solid var(--kenar)", borderLeft: "3px solid var(--kenar)",
        background: "var(--yuzey-2)"
      }
    },
      durumIkon,
      YU.h("div", { stil: { minWidth: "0" } }, durumBaslik, durumListe)
    );

    /* KAYITLI GÜN UYARISI (kullanıcı isteği, 27.08.2026): sayfanın üstündeki
       şeritten buraya taşındı, durum kutusunun hemen ÜSTÜNE. Başlık ve ikon
       şeritteki gibi kaldı (uyari = #ic-bell); alt metin yalnız sonucu
       söyler, "kim ne zaman girmiş" cümlesi düştü. Yalnız kayıtlı günde
       kurulur; yeni günde hiç çizilmez. */
    var kayitliKutu = kayit ? YU.h("div", {
      /* Durum kutusuyla AYNI dil (02.09.2026): nötr zemin, sol kenarda uyarı
         rengi şerit. Sarı dolgulu kutu resmi bir ekrana ait durmuyordu. */
      stil: {
        display: "flex", gap: "10px", alignItems: "flex-start", width: "100%",
        boxSizing: "border-box", padding: "11px 14px", borderRadius: "6px",
        border: "1px solid var(--kenar)", borderLeft: "3px solid var(--bekleyen)",
        background: "var(--yuzey-2)"
      }
    },
      YU.h("span", {
        stil: { display: "flex", flex: "none", alignSelf: "flex-start", marginTop: "1px", color: "var(--bekleyen)" }
      }, YU.svg("#ic-bell", 16)),
      YU.h("div", { stil: { minWidth: "0" } },
        /* KUTU KÜÇÜLDÜ (kullanıcı isteği, 31.08.2026 akşamı): başlık
           15,5 -> 14 px, altındaki cümle 14 -> 13 px, zil ikonu 18 -> 16.
           Başlık ile cümle arasındaki punto farkı korundu; kutu bir bütün
           olarak küçüldü, silo kartlarının önüne geçmiyor. */
        YU.h("div", {
          metin: "Bu Gün Daha Önce Kaydedilmiş",
          stil: { font: "600 14px/1.35 var(--font)", color: "var(--bekleyen)" }
        }),
        YU.h("div", {
          metin: "Kaydet'e basınca eski veriler silinir, yerine girdiklerin yazılır.",
          stil: { margin: "4px 0 0", font: "400 13px/1.5 var(--font)", color: "var(--metin-2)" }
        })
      )
    ) : null;

    /* Serbest yüksekliği bu alan yutar. 27.08.2026'da kutular ALTA yaslıydı
       çünkü üstlerinde silo kartları duruyordu. Kartlar gidince (02.09.2026)
       hiza ÜSTE alındı: uyarı ve durum panelin başında okunur, boşluk onlarla
       Kaydet'in arasında kalır, düğmeler dipte durur. */
    var durumAlani = YU.h("div", {
      stil: {
        flex: "1 1 auto", minHeight: "0", display: "flex",
        alignItems: "flex-start", paddingTop: "4px"
      }
    }, YU.h("div", {
      stil: { display: "flex", flexDirection: "column", gap: "10px", width: "100%", minWidth: "0" }
    }, kayitliKutu, durumKutu));

    /* Düğmeler sağ blokta alt alta durur; panel tam genişliğe çıktığı için
       blok sabit 240px kalır, yoksa Kaydet sayfa boyunca uzardı. */
    /* DÜĞMELER YAN YANA, TEK SATIRDA (kullanıcı isteği, 02.09.2026).
       SABİT KONUM da korunur (aynı gün, önceki istek: "kaydedilemez satırı
       gelince butonların yeri aşağıya kayıyor"): blok hep tepeden başlar,
       soldaki hata listesi uzasa da düğmeler yerinde durur. */
    var durumSatiri = YU.h("div", {
      stil: {
        display: "flex", flexDirection: "row", gap: "10px",
        flex: "none", alignItems: "flex-start"
      }
    },
      dugmeKaydet,
      dugmeSil
    );

    /* ---------- 6. Kayıt alanı (panelsiz) ----------
       KUTU KALKTI (kullanıcı isteği, 02.09.2026: "kayıt için ayrı panel gibi
       olmasın, biraz daha sade olsun"). Önce sağ sütunda "Gün Sonu ve Kayıt"
       paneliydi, sonra "3 Kayıt" adıyla en alta indi; şimdi çerçevesi ve adım
       başlığı da yok. Geriye işin kendisi kalıyor: solda durum kutuları,
       sağda Kaydet ile Günü Sıfırla. Kutular durumu zaten söylediği için
       üstlerinde ayrı bir başlığa gerek kalmadı (KURAL 11).

       SİLO STOKLARI PANELİ KALDIRILDI (aynı istek): siloIzgara ve kartlar
       KURULMAYA devam eder ve gunSonuTazele onlara yazar — yalnız hiçbir
       yere eklenmezler, ekranda görünmezler. Geri istenirse tek satır. */
    var kayitAlani = YU.h("div", {
      stil: { display: "flex", gap: "18px", alignItems: "stretch", flexWrap: "wrap" }
    }, durumAlani, durumSatiri);
    govde.appendChild(kayitAlani);

    /* "Günün Silo Hareketleri" paneli kaldırıldı (kullanıcı isteği, 25.08.2026);
       aynı bilgi Program Hareketleri ekranında duruyor. Yerleşim artık tek
       satır: solda adım 1-2, sağda yapışkan adım 3. */
    /* ---------- Canlı hesap ---------- */

    function girdiTopla() {
      return {
        tarih: tarih,
        uretilenDokme: uretilenAlan.deger(),
        /* cuvalKg — operatörün YAZDIĞI değer, tek dil (02.09.2026).
           Adet gönderilmez; depoda türetilmiş alan olarak kalır. */
        cuvalKg: cuvalAlan.deger(),
        satilanDokme: satilanAlan.deger(),
        yerlestirmeler: kalemUretim.degerler(),
        cekisler: kalemCuvallama.degerler(),
        satisCekisleri: kalemSatis.degerler(),
        rowVersion: okunanRowVersion
      };
    }

    function boya(alan, hataliMi) {
      /* Negatif değer sayfa hatalarından bağımsız: temize çekilmez. */
      if (!hataliMi && alan.negatifMi && alan.negatifMi()) hataliMi = true;
      var yeniSinif = hataliMi ? "yu-girdi hatali" : "yu-girdi";
      if (alan.girdi.className !== yeniSinif) alan.girdi.className = yeniSinif;
    }

    function boyalariSil() {
      uretilenAlan.hataGoster("");
      cuvalAlan.hataGoster("");
      satilanAlan.hataGoster("");
      for (var k = 0; k < kalemler.length; k++) kalemBoya(kalemler[k].kod, false);
    }

    function kalemBoya(kod, hataliMi) {
      var kalem = kalemBul(kod);
      if (!kalem) return;
      for (var k = 0; k < kalem.alanlar.length; k++) boya(kalem.alanlar[k], hataliMi);
    }

    /* Dağıtım tutmuyorken HANGİ kutu kırmızı yanar (kullanıcı isteği,
       27.08.2026): yanlış rakam YAZILMIŞ kutular. Üçünü birden yakmak,
       "100 yazdım, 50 olmalı" durumunda dokunulmamış iki siloyu da suçluyordu.
       Hiçbirine yazılmamışsa (ör. satış girilip hiç çekiş yapılmamışsa)
       gösterilecek tek bir kutu yoktur; o zaman üçü de yanar ve "buraya bir
       şey yaz" demiş olur. */
    function kalemBoyaEksik(kod) {
      var kalem = kalemBul(kod);
      if (!kalem) return;
      var k, yazili, dolu = 0;
      for (k = 0; k < kalem.alanlar.length; k++) {
        if (String(kalem.alanlar[k].girdi.value).trim() !== "") dolu++;
      }
      for (k = 0; k < kalem.alanlar.length; k++) {
        yazili = String(kalem.alanlar[k].girdi.value).trim() !== "";
        boya(kalem.alanlar[k], dolu === 0 || yazili);
      }
    }

    /* D7 alan boyaması için aşan silolar burada da hesaplanır; mesaj metni
       yine servisten gelir, kural kopyalanmaz — yalnızca hangi kutunun
       kırmızıya döneceği bulunur. */
    function asanSilolar(girdi) {
      var cek = siloBazinda(girdi.cekisler), sat = siloBazinda(girdi.satisCekisleri);
      var asan = {}, s, id, cikan;
      for (s = 0; s < silolar.length; s++) {
        id = silolar[s].Id;
        cikan = YU.yuvarla((cek[id] || 0) + (sat[id] || 0));
        if (cikan > tol && cikan - gunBasi[id] > tol) asan[id] = true;
      }
      return asan;
    }

    function alanlariBoya(hatalar) {
      var girdi = girdiTopla(), i2, h;
      for (i2 = 0; i2 < hatalar.length; i2++) {
        h = hatalar[i2];
        if (h.kod === "D1") uretilenAlan.hataGoster(h.mesaj);
        /* D2'nin uzun cümlesi kutunun ALTINA yazılmaz (kullanıcı isteği,
           28.08.2026: "çuvallama satırında olmasın"): orada guncelle'nin
           yazdığı kısa canlı ipucu durur. Kutu yine kırmızıya döner, tam
           cümle sağdaki "Kaydedilemez:" panelinde okunur. */
        else if (h.kod === "D2") boya(cuvalAlan, true);
        else if (h.kod === "D13") { satilanAlan.hataGoster(h.mesaj); kalemBoyaEksik("satis"); }
        else if (h.kod === "D3" || h.kod === "D4") kalemBoyaEksik("uretim");
        else if (h.kod === "D5" || h.kod === "D6") kalemBoyaEksik("cuvallama");
        else if (h.kod === "D7") {
          /* D7 çuvallama ve satış çıkışlarının TOPLAMI üzerinden ihlal edilir;
             aşan silonun iki çıkış kutusu da kırmızıya döner. */
          var asan = asanSilolar(girdi), s2;
          for (s2 = 0; s2 < silolar.length; s2++) {
            if (!asan[silolar[s2].Id]) continue;
            boya(kalemCuvallama.alanlar[s2], true);
            boya(kalemSatis.alanlar[s2], true);
          }
        }
      }
    }

    /* Gün sonu bakiyesi giren ve çıkanların hepsinden doğar. */
    /* Doluluk çubuğu iki parçalı (kullanıcı isteği, 23.08.2026): mavi = gün
       başından kalan, YEŞİL = bugün giren, KIRMIZI = bugün çıkan. Küçük
       değişimler (3.000 tonda 500 kg) görünsün diye değişim parçasının en az
       6px genişliği var. Kapasite aşımı/eksi bakiyede taban da kırmızıdır. */
    function dolulukCubugu(basKg, sonuKg, kapasite, sorun) {
      var bar = YU.h("div", { sinif: "yu-cubuk", stil: { display: "flex" } });
      if (!(kapasite > 0)) return bar;
      var fark = sonuKg - basKg;
      var taban = Math.max(0, Math.min(basKg, sonuKg)) / kapasite;
      bar.appendChild(YU.h("div", {
        sinif: "yu-cubuk-dolu" + (sorun ? " olumsuz" : ""),
        stil: { width: (Math.min(1, taban) * 100).toFixed(3) + "%", flex: "none", borderRadius: "0" }
      }));
      if (Math.abs(fark) > tol) {
        bar.appendChild(YU.h("div", {
          sinif: "yu-cubuk-dolu " + (fark > 0 ? "olumlu" : "olumsuz"),
          stil: { width: (Math.min(1, Math.abs(fark) / kapasite) * 100).toFixed(3) + "%", minWidth: "6px", flex: "none", borderRadius: "0" }
        }));
      }
      return bar;
    }

    /* CANLI KIRMIZI KUTU (kullanıcı isteği, 27.08.2026): eksik dağıtım artık
       yalnız listedeki cümleyle değil, KUTUNUN KENDİSİYLE söylenir — zorunlu
       bir alan boş bırakılmış gibi kırmızı yanar, kaydete basmayı beklemez.
       Yalnız boyar, kutunun altına metin YAZMAZ: cümle zaten Gün Sonu ve
       Kayıt panelinde duruyor (KURAL 8 · bilgi tek yerde).
       Kayıt denemesi sonrası boyama alanlariBoya'da kalır; o ayrıca büyük
       alanın altına hata metnini de yazar. */
    function canliBoya(hatalar) {
      /* YAZARKEN BOYAMA YOK (kullanıcı isteği, 27.08.2026: "ilk sayı
         girdiğimde olmasın, Kaydet'e basıp hata alırsam olsun"). İlk rakamı
         yazan kullanıcı daha formu doldururken kırmızı kutu görmemeli.
         Kaydet denendikten SONRA boyama açılır ve alan düzeltilene kadar
         sürer — o yüzden burada tümden kapatmak yerine bayrağa bağlandı. */
      if (!kaydetDenendi) return;
      var g = girdiTopla(), i2, h, asan, s2;
      for (i2 = 0; i2 < hatalar.length; i2++) {
        h = hatalar[i2];
        if (h.kod === "D3" || h.kod === "D4") kalemBoyaEksik("uretim");
        else if (h.kod === "D5" || h.kod === "D6") kalemBoyaEksik("cuvallama");
        else if (h.kod === "D13") kalemBoyaEksik("satis");
        else if (h.kod === "D7") {
          asan = asanSilolar(g);
          for (s2 = 0; s2 < silolar.length; s2++) {
            if (!asan[silolar[s2].Id]) continue;
            boya(kalemCuvallama.alanlar[s2], true);
            boya(kalemSatis.alanlar[s2], true);
          }
        }
      }
    }

    function gunSonuTazele(girdi) {
      var yer = siloBazinda(girdi.yerlestirmeler);
      var cek = siloBazinda(girdi.cekisler);
      var sat = siloBazinda(girdi.satisCekisleri);
      var r, so, id, sonu, oran, sorun;

      for (r = 0; r < siloOzetleri.length; r++) {
        so = siloOzetleri[r];
        id = so.silo.Id;
        sonu = YU.yuvarla(gunBasi[id] + (yer[id] || 0) - (cek[id] || 0) - (sat[id] || 0));
        sorun = sonu < -tol || (so.kapasite > 0 && sonu - so.kapasite > tol);   /* eksi ya da kapasite aşımı: D14/D15 */
        so.sonu.textContent = YU.fmt.kgU(sonu);
        so.sonu.style.color = sorun ? "var(--olumsuz)" : "";
        oran = so.kapasite > 0 ? sonu / so.kapasite : 0;
        YU.bos(so.cubukKap).appendChild(dolulukCubugu(gunBasi[id], sonu, so.kapasite, sorun));
        /* Yüzde yazısı ekrandan kalktı (kullanıcı isteği, 26.08.2026);
           doluluk çubuğu duruyor, oran ve kapasite çubuğun ipucunda (KURAL 8).
           Kapasite aşımı / eksi bakiye uyarısı sayı ve çubuk renginde kalır. */
        so.cubukKap.title = so.kapasite > 0
          ? "Kapasite " + YU.fmt.ton(so.kapasite) + " · " + YU.fmt.yuzde(oran * 100) + " dolu"
          : "Kapasite tanımsız";

        var f = YU.yuvarla(sonu - gunBasi[id]);
        var degisti = Math.abs(f) > tol;
        var giren = YU.yuvarla(yer[id] || 0);
        var cuval = YU.yuvarla(cek[id] || 0);
        var satis = YU.yuvarla(sat[id] || 0);
        var cikan = YU.yuvarla(cuval + satis);

        if (degisti) {
          so.farkSayi.textContent = (f > 0 ? "+" : "−") + YU.fmt.kgU(Math.abs(f));
          so.farkSayi.style.color = f > 0 ? "var(--olumlu)" : "var(--olumsuz)";
          /* "Eklenir / Çıkarılır" -> "Artar / Azalır" (kullanıcı isteği,
             01.09.2026: "yoksa yanlış anlaşılır"). Yanındaki rakam NET
             değişimdir (gün sonu − gün başı). Aynı gün hem giren hem çıkan
             varsa "Eklenir" o rakamı "siloya bu kadar girdi" diye
             okutuyordu: 150.000 girip 25.000 çıkan bir günde satır
             "+125.000 Eklenir" yazıyor, oysa siloya giren 150.000.
             "Artar" bakiyenin ne kadar değiştiğini söyler, ne kadar
             girdiğini değil — döküm Silo Bazında Stok tablosunda. */
          so.farkSoz.textContent = f > 0 ? "Artar" : "Azalır";
          so.fark.style.display = "inline-flex";
        } else {
          so.fark.style.display = "none";
        }
        /* O gün silo hiç değişmediyse "386.235 kg → 386.235 kg" yazmak kafa
           karıştırıyordu (kullanıcı isteği, 26.08.2026): gün başı ve ok
           gizlenir, tek rakam kalır. */
        so.basi.style.display = degisti ? "inline" : "none";
        so.ok.style.display = degisti ? "inline" : "none";
        so.sayiSatiri.title = degisti ? "gün başı → gün sonu" : "gün boyunca değişmedi";

        /* Giren/çıkan dökümü ekrandan KALDIRILDI (kullanıcı isteği,
           31.08.2026): kartta tek satır kalsın. Rakamlar ipucuna taşındı
           (KURAL 8) — isteyen fareyle bakar, ekran kalabalıklaşmaz. */
        so.fark.title = (giren > tol ? "Siloya giren " + YU.fmt.kgU(giren) : "") +
          (giren > tol && cikan > tol ? " · " : "") +
          (cuval > tol ? "çuvallama için çekilen " + YU.fmt.kgU(cuval) : "") +
          (cuval > tol && satis > tol ? " · " : "") +
          (satis > tol ? "satış için çekilen " + YU.fmt.kgU(satis) : "");
      }
    }

    function canliDenetim(girdi) {
      var d = YU.dogrula.kuruKuspeKaydi(db, girdi);
      var hatalar = d.hatalar.slice();
      var negatifler = YU.dogrula.ileriBakiye(db, tarih, {
        tarih: tarih,
        kuruKuspeSilTarihi: tarih,
        yeniHareketler: taslakHareketler(girdi)
      });
      /* AYNI OLAY İKİ KEZ YAZILMAZ (kullanıcı bildirimi, 28.08.2026: "çok
         fazla detay var, ana sorun anlaşılması çok güç").

         Bir silodan mevcudundan fazlası çekilince D7 ile D14 aynı anda
         konuşuyordu: "Silo 1: 2.000 kg çekiliyor, siloda 1.500 kg var" ve
         "Silo 1: 28.08.2026 günü stok -500 kg oluyor". İkisi aynı olayın iki
         yüzü; D7 ne yapılacağını söylediği için o kalır, GİRİLEN GÜNÜN D14
         satırı düşer. İLERİKİ günlerin D14 satırları KALIR — onlar bu güne
         bakarak görülemeyecek yeni bir bilgi taşır. */
      var d7Silolar = asanSilolar(girdi);
      for (var i2 = 0; i2 < negatifler.length; i2++) {
        if (negatifler[i2].tarih === tarih && d7Silolar[negatifler[i2].siloId]) continue;
        hatalar.push({ kod: "D14", mesaj: YU.dogrula.d14Mesaji(negatifler[i2]) });
      }

      /* SERVİSİN İLERİ GÜN ENGELLERİ BURADA DA SORULUR (denetim bulgusu
         BUG-002, 30.08.2026). Bu iki kural — ileri günlerin kapasite aşımı ve
         çuvallı küspenin ileri negatifi — yalnız 04-servis'te koşuyordu:
         ekran "Kaydedilebilir" diyor, Kaydet açık kalıyor, servis reddediyor ve
         sebep hiçbir yerde yazmıyordu (ölçüldü: 01.08'i yükseltmek 02.08'i
         3.100.000 kg'a çıkarıyor, kapasite 3.000.000).

         Kural kopyalanmadı; ikisi de aynı fonksiyonu çağırır. Hata kodları D15
         ve D14 olduğu için ozetTazele'deki sertEngel bunları zaten tanır ve
         Kaydet kendiliğinden kapanır. */
      hatalar = hatalar.concat(
        YU.dogrula.kuruKuspeIleriEngeller(db, girdi, taslakHareketler(girdi)));

      return { hatalar: hatalar, uyarilar: d.uyarilar };
    }

    /* Son çizimdeki engel kümesinin imzası — parlama bir kez tetiklensin. */
    var sonHataImzasi = "";
    /* Kaydet bir kez denendi mi? Kırmızı boyama ve parlama buna bağlı:
       denemeden önce ekran sessiz, denemeden sonra hatalı alanlar işaretli
       kalır (kullanıcı isteği, 27.08.2026). Engel kalmayınca sıfırlanır. */
    var kaydetDenendi = false;

    /* Kutu zemini HER DURUMDA nötr kalır; değişen yalnız sol şeridin rengi
       (02.09.2026 · resmi görünüm). Eski pastel zeminler kaldırıldı. */
    var DURUM_SERIDI = {
      "var(--olumsuz)":  "var(--olumsuz)",
      "var(--olumlu)":   "var(--olumlu)",
      "var(--bekleyen)": "var(--bekleyen)",
      notr:              "var(--kenar)"
    };

    /* Söylenecek bir şey yoksa kutu ekranda yer kaplamaz (02.09.2026). */
    function durumGizle() {
      durumKutu.style.display = "none";
    }

    function durumYaz(ikon, renk, baslik, maddeler) {
      durumKutu.style.display = "flex";
      YU.bos(durumIkon).appendChild(YU.svg(ikon, 16));
      durumIkon.style.color = renk;
      durumBaslik.textContent = baslik;
      durumBaslik.style.color = renk;
      /* Durumun rengini SOL ŞERİT taşır; zemin ve çerçeve nötr kalır
         (02.09.2026). Bilinmeyen renkte şerit de nötrleşir — "henüz giriş
         yok" gibi hâllerde kutu tümüyle sessiz durur. */
      durumKutu.style.borderLeftColor = DURUM_SERIDI[renk] || DURUM_SERIDI.notr;
      YU.bos(durumListe);
      /* MADDE İMİ HER SATIRDA (kullanıcı isteği, 28.08.2026: "bir nokta
         koydum demiştin fakat yok bir nokta"). Önce yalnız iki ve üzeri
         hatada konuyordu; tek hata da satır sarınca iki satıra bölünüyor ve
         nereden başladığı belirsiz kalıyor. İm her zaman durur. */
      var cok = (maddeler || []).length > 0;
      durumListe.style.gridTemplateColumns = cok
        ? "max-content max-content 1fr"
        : "max-content 1fr";
      for (var k = 0; k < (maddeler || []).length; k++) {
        var ham = String(maddeler[k].mesaj || "");
        var kes = ham.indexOf(": ");
        if (cok) {
          durumListe.appendChild(YU.h("span", {
            metin: "•", "aria-hidden": "true",
            stil: { color: "var(--metin-4)", fontWeight: "700", lineHeight: "1.5" }
          }));
        }
        if (kes > 0 && kes <= 24) {
          durumListe.appendChild(YU.h("span", {
            metin: ham.slice(0, kes + 1),
            stil: { fontWeight: "600", whiteSpace: "nowrap", color: "var(--metin)" }
          }));
          durumListe.appendChild(YU.h("span", { metin: ham.slice(kes + 2) }));
        } else {
          durumListe.appendChild(YU.h("span", {
            metin: ham,
            stil: { gridColumn: cok ? "2 / -1" : "1 / -1" }
          }));
        }
      }
      durumListe.style.display = maddeler && maddeler.length ? "grid" : "none";
    }

    /* BRÜT giriş kontrolü (kullanıcı isteği, 23.08.2026): herhangi bir alana
       sıfırdan büyük değer yazılmış mı? +500 giren ve 500 çıkan bir gün NET 0
       olsa da değişmiş sayılır — net değil brüt bakılır. */
    function girisVarMi(girdi) {
      function poz(n) { return isFinite(n) && n > 0; }
      if (poz(girdi.uretilenDokme) || poz(girdi.cuvalKg) || poz(girdi.satilanDokme)) return true;
      var listeler = [girdi.yerlestirmeler, girdi.cekisler, girdi.satisCekisleri], k, j;
      for (k = 0; k < listeler.length; k++) {
        for (j = 0; j < (listeler[k] || []).length; j++) if (poz(listeler[k][j].miktar)) return true;
      }
      return false;
    }

    function ozetTazele(girdi) {
      var d = canliDenetim(girdi);
      var h = d.hatalar.length, u = d.uyarilar.length;
      var girisVar = girisVarMi(girdi);

      /* Eksik dağıtım kutuları anında kırmızıya döner (27.08.2026). */
      canliBoya(d.hatalar);

      /* PARLAMA — engelleyen kural kümesi DEĞİŞTİĞİ an bir kez (kullanıcı
         isteği, 27.08.2026). Kaydet hatalıyken zaten kapalı olduğu için
         "basınca" anı hiç gelmiyor; geri bildirim sorunun DOĞDUĞU anda
         verilir. Her tuşta değil: aynı hata sürerken imza değişmez, alan
         yanıp sönmez — yalnız yeni bir engel eklendiğinde parlar. */
      var hataImzasi = d.hatalar.map(function (x) { return x.kod; }).sort().join(",");
      if (kaydetDenendi && hataImzasi && hataImzasi !== sonHataImzasi &&
          YU.ui.hataliAlanlariParlat) {
        YU.ui.hataliAlanlariParlat(govde);
      }
      sonHataImzasi = hataImzasi;
      /* Engel kalmadıysa işaret düşer: bir sonraki yazımda ekran yine sessiz. */
      if (!d.hatalar.length) { kaydetDenendi = false; boyalariSil(); }

      /* KAYDETTİKTEN SONRA DEĞİŞİKLİK YOKSA KAYDET PASİF (kullanıcı isteği,
         27.08.2026): aynı veriyi ikinci kez yazmanın anlamı yok. Kullanıcı
         bir rakama dokunur dokunmaz düğme yeniden açılır. Ölçü, formun
         kurulduğu andaki imzadır (kaydedilmemisVarMi). */
      var degismedi = !kaydedilmemisVarMi();
      var kaydedildi = !!basariMetni && degismedi;

      /* KAYITLI GÜN AÇIKKEN DE DEĞİŞİKLİK YOKSA KAYDET PASİF (kullanıcı
         isteği, 28.08.2026: "yine aynı değerler girilirse kaydet butonu yine
         pasif kalsın"). Eskiden bu yalnız KAYDETTİKTEN SONRAKİ çizimde
         geçerliydi; ekran yeniden açıldığında düğme yine basılabiliyordu ve
         aynı veri kaydı siler-yeniden yazar, RowVersion'ı boşuna artırırdı.
         Ölçü yine formun kurulduğu andaki imza: bir rakama dokunulunca düğme
         açılır, eski değere dönülünce kendiliğinden pasifleşir. */
      var yazacakYok = !!kayit && degismedi;

      /* Engelleyen kural varken Kaydet BASILAMAZ (kullanıcı kararı,
         21.08.2026); hiç giriş yokken de yeni gün için basılamaz.
         İSTİSNA (M32): tek engel kapasite aşımıysa düğme AÇIK kalır —
         basınca gerekçe penceresi açılır, gerekçesiz yine kaydedilmez.
         Şartname §8'in "sert engel operatörü kilitler" uyarısının karşılığı. */
      /* KAYDET ARTIK BASILABİLİR (kullanıcı isteği, 27.08.2026): hatalı
         alanların işaretlenmesi "Kaydet'e basıp hata almaya" bağlandı; düğme
         kapalı olsaydı o an hiç gelmezdi. Basınca doğrulama yine reddeder,
         hiçbir şey yazılmaz — yalnız ilgili alanlar kırmızıya döner.
         İSTİSNA: D14 (stok negatife düşer) ve D15 (kapasite aşılır) sert
         engellerinde düğme KAPALI kalır — 27.08.2026 direktifi: "negatif
         kayıt kesinlikle engellenmeli, kaydet yasak olmalı". */
      /* D2 ARTIK SERT ENGEL DEĞİL (kullanıcı kararı, 02.09.2026): 50'nin katı
         kuralı kaldırıldı, çuvallanan serbest kg oldu. Geriye kalan D2
         denetimleri (sayı, negatif değil, tam sayı) öbür alanlarla aynı
         davranır — düğme açık kalır, basınca doğrulama reddeder ve hatalı
         alan kırmızıya döner. */
      /* D7 DE SERT ENGEL: aynı olayın D14 satırı yukarıda bilerek
         susturuldu (canliDenetim); D7 listede kalmasaydı düğme, eskiden
         D14'ün kapattığı durumda açık kalırdı. Silodan mevcudundan fazlası
         çekmek stoğu eksiye düşürür — KURAL 12 gereği kaydedilemez. */
      var sertEngel = kodVar(d.hatalar, "D14") || kodVar(d.hatalar, "D15") ||
                      kodVar(d.hatalar, "D7");
      dugmeKaydet.disabled = sertEngel || (!girisVar && !kayit) || kaydedildi || yazacakYok;
      dugmeKaydet.title = sertEngel
        /* Engel hangisiyse onun kendi cümlesi yazılır — eskiden üç durum için
           tek metin vardı ve D2'de yanlış sebebi söylüyordu. */
        ? engelMetni(d.hatalar)
        : (h > 0 ? "Eksikler var; basınca ilgili alanlar işaretlenir."
          : (!girisVar && !kayit ? "Önce bir rakam gir."
            : (kaydedildi ? "Kaydedildi — değişiklik yapılmadı."
              : (yazacakYok ? "Değişiklik yok — kaydedilecek bir şey yok." : "Ctrl + Enter"))));

      if (kaydedildi && !h) {
        /* Sonuç, üstte şerit açmak yerine burada söylenir (27.08.2026). */
        durumYaz("#ic-checklist", "var(--olumlu)", basariMetni, null);
      } else if (h) {
        /* "Kapasite aşılıyor, gerekçe yazabilirsin" dalı KALDIRILDI
           (27.08.2026): kapasite aşımı artık hiçbir gerekçeyle geçmiyor,
           dolayısıyla D15 de öbür engellerle aynı listede okunur. */
        /* Başlık TEK KELİMEYE indi (kullanıcı isteği, 27.08.2026: "bu da çok
           uzun, gereksiz"). Sayaç da düştü: kaç madde olduğu listenin
           kendisinden görünüyor (KURAL 11). Suçlayıcı değil, durumu söyler —
           kaydın yapılamayacağını; ne yapılacağını maddeler anlatır.
           25.08.2026'daki "düzeltilmesi gereken" itirazı da karşılanmış olur. */
        durumYaz("#ic-alert", "var(--olumsuz)", "Kaydedilemez:", d.hatalar);
      } else if (u) {
        durumYaz("#ic-bell", "var(--bekleyen)", "Kaydedilebilir; yine de şuna dikkat:", d.uyarilar);
      } else if (!girisVar) {
        /* Boş günde "her şey tamam" DENMEZ (kullanıcı isteği, 23.08.2026). */
        if (kayit) durumYaz("#ic-alert", "var(--bekleyen)", "Tüm değerler 0 — kaydedersen bu günün kayıtlı hareketleri silinir.", null);
        else durumYaz("#ic-doc", "var(--metin-4)", "Henüz giriş yok — rakam yazınca durum burada görünür.", null);
      } else {
        /* SORUNSUZ DURUMDA KUTU HİÇ ÇİZİLMEZ (kullanıcı isteği, 02.09.2026:
           "kaydedilebilir olunca zaten kaydet butonu aktif oluyor, eğer aktif
           değilse de hata veriyor zaten"). 27.08.2026'da burada
           "Kaydedilebilir." yazıyordu; aynı bilgiyi düğmenin kendisi
           söylüyor (KURAL 11: karara dönüşmeyen satır yazılmaz).
           Hata, uyarı ve kayıt sonucu dalları olduğu gibi duruyor. */
        durumGizle();
      }
    }

    function guncelle() {
      boyalariSil();
      /* Kaydedilmemiş değeri olan ekrandan çıkış kilitlenir (kullanıcı isteği,
         25.08.2026): sekme/pencere kapatmada tarayıcı, menüden geçişte
         uygulama sorar. Kilit kabukta ortak (YU.cikisKilidi) ve her sayfa
         çiziminde kendiliğinden düşer. */
      if (YU.cikisKilidi) {
        YU.cikisKilidi(kaydedilmemisVarMi(),
          YU.fmt.tarih(tarih) + ' günü için girilen değerler henüz kaydedilmedi.');
      }
      var ilk = girdiTopla();
      var h = YU.hesap.kuruKuspe(ilk.uretilenDokme, ilk.cuvalKg, ilk.satilanDokme);
      var uretim = ilk.uretilenDokme;

      /* YARDIM SATIRI BOŞ (02.09.2026). 31.08.2026'da tanıtım cümlesi
         kaldırılmış, geriye yalnız "50'nin katı olmalı" engeli kalmıştı;
         o kural da kaldırıldığı için satırın söyleyeceği bir şey yok.
         Düğüm yerinde durur — ileride bir engel doğarsa buraya yazılır. */
      cuvalYardim.textContent = CUVAL_YARDIM;

      /* Siloya giren: blok pasifken yönlendirme cümlesi YOK (kullanıcı isteği,
         23.08.2026); yalnız gerçekten bilgi taşıyan iki durum yazılır. */
      var girenBos = null;
      if (!(h.netDokmeUretim > tol) && (uretim > 0 || h.cuvalKg > 0)) {
        if (h.cuvalKg > uretim + tol) girenBos = { uyari: true, metin: "Bugün üretilenden fazla çuvallanmış; siloya giriş yok. Aradaki fark aşağıda silodan çıkar." };
        else girenBos = "Üretimin tamamı çuvallanmış; siloya giriş yok.";
      }
      kalemUretim.tazele(h.netDokmeUretim, girenBos, null);

      /* Silodan çıkan: satış her gün olabilir; çuvallama çekişi yalnız
         üretimden fazla çuvallanan günde (Şartname §4 Durum B) belirir. */
      kalemSatis.tazele(h.satilanDokme, null, null);
      cuvallamaAyraci.style.display = h.silodanCekilecek > tol ? "block" : "none";
      /* AÇIKLAMA CÜMLESİ KALDIRILDI (kullanıcı isteği, 31.08.2026):
         "Fazlası önceki günlerin silo stoğundan çıkar." satırı bloğu
         "Satış için çıkacak" bloğundan 22 px yükseltiyordu; kullanıcı iki
         bloğun eş boyda durmasını istedi. Aynı bilgi zaten yukarıda
         "Siloya Giren" panelinde yazıyor: "Bugün üretilenden fazla
         çuvallanmış; siloya giriş yok. Aradaki fark aşağıda silodan çıkar."
         (KURAL 8 · KURAL 11: bilgi bir kez, okunduğu yerde.) */
      kalemCuvallama.tazele(h.silodanCekilecek, null, null);

      /* Kalemler gereksiz alanları boşaltmış olabilir; özet güncel değerle kurulur. */
      var girdi = girdiTopla();
      gunSonuTazele(girdi);
      ozetTazele(girdi);
      /* Sol-panel kapısı EN SONDA (28.08.2026): kalemler yukarıda kendi
         kurallarıyla kutu açıp kapatıyor; kapı başta çalışsaydı onun kilidi
         eziliyor ve panel "pasif" görünürken kutular açık kalıyordu
         (ölçüldü: 0/6 kutu kilitli). Son söz kapının. */
      sagPanelleriTazele();
    }

    /* ---------- Kaydetme ve silme ---------- */

    /* Kaydet HER ZAMAN onay penceresi açar (kullanıcı isteği, 23.08.2026):
       ne kaydedileceğinin özeti + "emin misin". Gün KAYITLIYSA pencere, o
       günün mevcut verilerini gösterir ve Şartname §4 gereği bunların
       silinip yerine girilenlerin yazılacağını açıkça söyler (KURAL 6:
       §4 yeniden kaydetme Demirbaş — davranış değiştirilemez, yalnız
       anlatılır). Tarih bugünden eskiyse ek geçmiş uyarısı ve tehlike
       renkli düğme. Günü görüntüleme bağlantıları pencerede durur. */
    /* --- Kapasite aşımı: gerekçeli kabul (M32) ---
       Şartname §8 D15'i uyarı sayar ve gerekçesini de yazar: "sert engel
       operatörü kilitler". Engel korunur ama kapı açılır: aşım gerçekse
       operatör gerekçe yazıp kaydeder; gerekçe denetim izine düşer ve
       yöneticinin zilindeki kapasite uyarısı zaten durumu bildirir. */
    var kapasiteGerekcesi = null;

    /* GEREKÇELİ KABUL KALDIRILDI (kullanıcı direktifi, 27.08.2026):
       kapasite aşımı artık hiçbir gerekçeyle geçmiyor, dolayısıyla "tek engel
       kapasite" diye bir ayrıcalık da yok. false dönüyor: Kaydet kapalı kalır
       ve durum satırı öbür engellerle aynı dili konuşur. Aşağıdaki
       kapasiteOnayiAc penceresi artık hiç açılmaz; kod kaldırılmadı ki karar
       geri alınırsa tek satırla geri gelsin. */
    function yalnizD15() {
      return false;
    }

    function kapasiteOnayiAc(hatalar) {
      var enAz = (YU.dogrula && YU.dogrula.GEREKCE_ENAZ) || 10;
      var hataKap = YU.h("div");
      var serit = YU.ui.serit({
        tur: "hata", ikon: "#ic-alert",
        baslik: "Silo Kapasitesi Aşılıyor",
        metin: "Bu kayıt siloyu kapasitesinin üstüne çıkarıyor. Rakam yanlışsa ekrana dönüp " +
          "düzeltin. Aşım gerçekse (fiili taşma, konik tepe, ölçüm sapması) gerekçesini yazın — " +
          "kayıt geçer, gerekçe denetim izine yazılır ve yönetici uyarılır."
      });
      serit.className += " yu-cetin";
      var liste = YU.ui.hataListesi(hatalar, "uyari");
      var gerekceAlan = YU.ui.alan({
        etiket: "Aşımın Gerekçesi (Zorunlu)", tip: "metin",
        yardim: "En az " + enAz + " karakter. Denetim izinde bu cümle görünecek."
      });
      var m = YU.ui.modal({
        baslik: "Kapasite Aşımını Kabul Et",
        genislik: 620,
        govde: [serit, liste, gerekceAlan.kok, hataKap],
        dugmeler: [
          { metin: "Vazgeç · Rakamı Düzelt", tur: "sade", onClick: function () { m.kapat(); } },
          {
            metin: "Aşımı Kabul Et ve Kaydet", ikon: "#ic-alert", tur: "tehlike",
            onClick: function () {
              var g = String(gerekceAlan.deger() || "").trim();
              if (g.length < enAz) {
                gerekceAlan.hataGoster("Gerekçe en az " + enAz + " karakter olmalı. Şu an " + g.length + ".");
                return;
              }
              m.kapat();
              /* Gerekçe kaydetme akışı BİTENE kadar durur: kaydet() önce
                 asenkron "üzerine yazıyorsun" onayını açar, gerçek yazma o
                 pencerenin geri çağrısında olur. Burada sıfırlansaydı gerekçe
                 servise hiç ulaşmazdı. kaydetUygula() tükettikten sonra siler. */
              kapasiteGerekcesi = g;
              kaydet();
            }
          }
        ]
      });
      gerekceAlan.odakla();
    }

    function kaydet() {
      /* Ctrl+Enter da buradan geçer: düğme pasifken (hata ya da boş gün) kayıt yok. */
      if (dugmeKaydet.disabled) return;

      var bugun = YU.tarih.bugun();
      var gecmis = tarih < bugun;
      var g = girdiTopla();
      var hesap = YU.hesap.kuruKuspe(g.uretilenDokme, g.cuvalKg, g.satilanDokme);
      var f = YU.tarih.fark(tarih, bugun);
      var gunEtiketi = YU.fmt.tarih(tarih) + " " + YU.fmt.gunAdi(tarih) +
        (gecmis ? (f === 1 ? " (dün)" : " (" + YU.fmt.sayi(f) + " gün önce)") : " (bugün)");

      /* Özet maddeli listedir (kullanıcı isteği, 23.08.2026): üretimler
         + YEŞİL, satış − KIRMIZI, sıfırlar nötr. Silo bilgisi verilmez. */
      function ozetSatiri(etiket, degerMetni, isaret) {
        var renk = isaret === "arti" ? "var(--olumlu)" : (isaret === "eksi" ? "var(--olumsuz)" : "var(--metin-3)");
        return YU.h("div", { stil: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" } },
          YU.h("span", { metin: etiket, stil: { font: "400 14px/1.5 var(--font)", color: "var(--metin-2)" } }),
          YU.h("span", { metin: degerMetni, stil: { font: "600 14.5px/1.5 var(--sayi)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: renk } })
        );
      }

      function ozetListesi(uretilen, cuvallanan, satilan) {
        var u = isFinite(uretilen) ? uretilen : 0;
        var cuvalKg = isFinite(cuvallanan) ? YU.yuvarla(cuvallanan) : 0;
        var sa = isFinite(satilan) ? satilan : 0;
        return YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "6px" } },
          ozetSatiri("Üretilen dökme", (u > 0 ? "+" : "") + YU.fmt.kgU(u), u > 0 ? "arti" : null),
          /* Adet karşılığı kaldırıldı (kullanıcı kararı, 02.09.2026): tek
             büyüklük kg'dır, parantez içi çuval sayısı artık yazılmaz. */
          ozetSatiri("Çuvallanan", (cuvalKg > 0 ? "+" : "") + YU.fmt.kgU(cuvalKg), cuvalKg > 0 ? "arti" : null),
          ozetSatiri("Satılan dökme", (sa > 0 ? "\u2212" : "") + YU.fmt.kgU(sa), sa > 0 ? "eksi" : null)
        );
      }

      /* Yeni gün: maddeli özet + emin misin (kullanıcı isteği, 23.08.2026). */
      if (!kayit) {
        var mYeni;
        mYeni = YU.ui.modal({
          baslik: gecmis ? "Geçmiş Bir Güne Kayıt Ekliyorsun" : "Kaydı Onayla",
          genislik: 440,
          govde: [YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "10px" } },
            YU.h("div", { metin: gunEtiketi + " gününe kayıt yapıyorsun.", stil: { font: "600 14.5px/1.5 var(--font)", color: "var(--metin)" } }),
            gecmis ? YU.h("div", {
              metin: "DİKKAT: bu tarih bugün değil, GEÇMİŞ ÜZERİNDE işlem yapıyorsun. Sonraki günlerin silo bakiyeleri yeniden hesaplanır.",
              stil: { font: "600 13.5px/1.5 var(--font)", color: "var(--olumsuz)" }
            }) : null,
            YU.h("div", { stil: { padding: "10px 12px", border: "1px solid var(--kenar)", borderRadius: "var(--r)", background: "var(--yuzey-2)" } },
              ozetListesi(g.uretilenDokme, g.cuvalKg, g.satilanDokme)),
            YU.h("div", { metin: "Yeni kayıt eklenecek. Emin misin?", stil: { font: "400 14px/1.55 var(--font)", color: "var(--metin-2)" } })
          )],
          dugmeler: [
            { metin: "Vazgeç" },
            {
              metin: gecmis ? "Evet, Geçmişe Kaydet" : "Evet, Kaydet",
              tur: gecmis ? "tehlike" : "birincil",
              onClick: function () { mYeni.kapat(); kaydetUygula(); }
            }
          ]
        });
        return;
      }

      /* Kayıtlı gün: mevcut veriler gösterilir, silinip yerine yazılacağı söylenir. */
      var damga = kayit.GuncellemeTarihi || kayit.OlusturmaTarihi;
      var kimId = kayit.GuncellemeTarihi ? kayit.GuncelleyenKullaniciId : kayit.OlusturanKullaniciId;
      var kim = kullaniciAdi(db, kimId) || "bilinmeyen kullanıcı";

      function veriBlogu(baslikMetni, icerik, renk) {
        return YU.h("div", {
          stil: { padding: "10px 12px", border: "1px solid var(--kenar)", borderRadius: "var(--r)", background: "var(--yuzey-2)" }
        },
          YU.h("div", { metin: baslikMetni, stil: { font: "600 13px/1.4 var(--font)", color: renk || "var(--metin-3)", marginBottom: "6px" } }),
          icerik
        );
      }

      /* Gerçek adres verilir (kullanıcı isteği, 24.08.2026): orta tuş ya da
         Ctrl+tık bu sayfayı YENİ SEKMEDE açar; sol tık pencereyi kapatıp aynı
         sekmede gider. Önceden href="#" olduğu için yeni sekmede anasayfa
         açılıyordu. */
      function baglanti(metin, kod, param) {
        return YU.h("a", {
          href: YU.adres(kod, param), metin: metin,
          stil: { color: "var(--vurgu)", textDecoration: "underline", font: "500 13.5px/1.4 var(--font)" },
          onClick: function (e) {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) return;
            e.preventDefault(); m.kapat(); YU.git(kod, param);
          }
        });
      }

      var m;
      var baglantilar = YU.h("div", { stil: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
        YU.h("span", { sinif: "yu-yardim", metin: "Bu günü görüntüle:" }),
        baglanti("Program Hareketleri", "gunluk-rapor", { tarih: tarih }));
      /* Son değişiklikler ekranı yönetici yetkisindedir; operatöre gösterilmez. */
      /* Değişiklik Geçmişi bağlantısı kaldırıldı (kullanıcı kararı,
         24.08.2026): işlem geçmişi artık Program Hareketleri panelinde. */

      var gvd = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "10px" } },
        YU.h("div", {
          metin: gunEtiketi + " gününe ait KAYIT ZATEN VAR (" + kim + " · " + YU.fmt.saat(damga) + ").",
          stil: { font: "600 14.5px/1.5 var(--font)", color: "var(--metin)" }
        }),
        gecmis ? YU.h("div", {
          metin: "DİKKAT: bu tarih bugün değil, GEÇMİŞ ÜZERİNDE işlem yapıyorsun. Sonraki günlerin silo bakiyeleri yeniden hesaplanır.",
          stil: { font: "600 13.5px/1.5 var(--font)", color: "var(--olumsuz)" }
        }) : null,
        veriBlogu("Kayıtlı veriler — SİLİNECEK", ozetListesi(Number(kayit.UretilenDokme) || 0, YU.hesap.kayitCuvalKg(kayit), Number(kayit.SatilanDokme) || 0), "var(--olumsuz)"),
        veriBlogu("Senin girdiklerin — YERİNE YAZILACAK", ozetListesi(g.uretilenDokme, g.cuvalKg, g.satilanDokme), "var(--olumlu)"),
        YU.h("div", {
          metin: "O güne ait eski silo hareketleri de silinip yenileri yazılacak. Kabul ediyor musun, emin misin?",
          stil: { font: "400 14px/1.55 var(--font)", color: "var(--metin-2)" }
        }),
        baglantilar
      );

      m = YU.ui.modal({
        baslik: gecmis ? "Geçmiş Bir Günün Kaydını Değiştiriyorsun" : "Bu Günün Kaydını Değiştiriyorsun",
        genislik: 560,
        govde: [gvd],
        dugmeler: [
          { metin: "Vazgeç" },
          {
            metin: "Evet, Kabul Ediyorum", tur: "tehlike",
            onClick: function () { m.kapat(); kaydetUygula(); }
          }
        ]
      });
    }

    function kaydetUygula() {
      YU.bos(sonucKap);
      if (sonucKap.parentNode) sonucKap.parentNode.removeChild(sonucKap);
      boyalariSil();

      var girdi = girdiTopla();
      /* Gerekçe TEK kayıt denemesinde geçerlidir: okunur okunmaz silinir ki
         sonraki kayıtlar sessizce aynı gerekçeyle kapasite aşmasın. */
      if (kapasiteGerekcesi) girdi.kapasiteGerekcesi = kapasiteGerekcesi;
      kapasiteGerekcesi = null;
      var s = YU.servis.kuruKuspeKaydet(db, girdi, YU.oturum.kullanici);

      if (!s.ok) {
        if (YU.ui.kilitYakala(s)) return;   /* kilitli kampanya: pencere + bağlantı */
        /* Kayıt YALNIZ kapasite aşımı yüzünden reddedildiyse operatöre çıkış
           yolu verilir (M32): sert uyarı penceresi + zorunlu gerekçe. Başka
           hata da varsa pencere açılmaz — önce gerçek hatalar düzeltilir. */
        if (yalnizD15(s.hatalar)) { kapasiteOnayiAc(s.hatalar); return; }
        /* ÜST ŞERİDE HATA/UYARI LİSTESİ BASILMAZ (kullanıcı isteği,
           27.08.2026: "burada uyarı bilgisi veya kaydedildi bilgisi olmasın,
           sadece kayıt var bilgisi olsun"). Aynı maddeler sağdaki
           "Kaydedilemez:" listesinde ve ilgili alanların kırmızısında zaten
           duruyor; üstte üçüncü kez yazılıyordu. D16 aşağıda AYRI ele alınır:
           o bir bilgi değil, "sayfayı yenile" eylemidir. */
        kaydetDenendi = true;
        alanlariBoya(s.hatalar);
        /* Kaydet denemesinden SONRA bir kez parlar (kullanıcı isteği,
           27.08.2026); canlı yazarken parlamaz. Kalıcı kırmızı kenar
           alanlariBoya/canliBoya'nın koyduğu .hatali sınıfında. */
        if (YU.ui.hataliAlanlariParlat) YU.ui.hataliAlanlariParlat(govde);
        if (kodVar(s.hatalar, "D16")) {
          sonucGoster();
          sonucKap.appendChild(YU.ui.serit({
            tur: "hata",
            baslik: "Kayıt Değişti — Ekranı Yenilemen Gerekiyor",
            metin: "Sen bu ekranı açtıktan sonra bu gün başka bir oturumda değiştirilmiş. Yazdıkların kaydedilmedi; ekranı yenileyip güncel değerlerin üzerine çalış.",
            eylem: { metin: "Yenile", onClick: function () { YU.git(KOD, { tarih: tarih }); } }
          }));
        }
        YU.ui.bildir(s.hatalar.length + " hata nedeniyle kayıt yapılmadı.", "hata");
        if (sonucKap.scrollIntoView) sonucKap.scrollIntoView({ block: "nearest" });
        return;
      }

      /* Kayıt sonrası DÖKÜM kaldırıldı (kullanıcı isteği, 27.08.2026):
         hangi siloya ne girdiği, çuvallı üretim ve yeni silo toplamı zaten
         ekranın kendisinde yazıyordu; şerit aynı rakamları bir kez daha
         sayıyordu (KURAL 11). Geriye tek başarı satırı kalır. Uyarılar
         KORUNUR — onlar bir engeli ya da kabulü anlatır (ör. gerekçeli D15). */
      bekleyenSonuc = {
        tarih: tarih,
        basariMetni: "Başarıyla kaydedildi.",
        uyarilar: s.uyarilar
      };
      YU.ui.bildir("Başarıyla kaydedildi.", "basari");

      /* ÇIKIŞ KİLİDİ ÖNCE DÜŞER (kullanıcı bildirimi, 28.08.2026: "kaydet'e
         basar basmaz 'Kaydedilmemiş Değişiklik Var' çıkıyor, ama kaydediliyor
         da").

         SEBEP: kilit 27.08.2026'da SERT'e çevrildi — artık adres değişimini de
         durduruyor. Aşağıdaki YU.git yeni bir hash yazıyor (?tarih=...), kabuk
         onu hashchange'de yakalıyor ve "kirli" sayılan ekrandan çıkışı
         soruyordu. Kayıt zaten yazılmış olduğu için soru anlamsızdı; üstelik
         "Sayfada Kal" denince ekran yenilenmiyor, eski rowVersion elde kalıyor
         ve ikinci Kaydet "Kayıt Değişti" çakışmasına düşüyordu.

         Kayıt başarılıysa ekranda kaydedilmemiş bir şey KALMAZ: kilit burada
         düşer, imza da tazelenir. Ekran yeniden kurulunca (YU.git -> yenile)
         Kaydet düğmesi "Kaydedildi — değişiklik yapılmadı." diye pasif gelir;
         aynı değerler tekrar yazılırsa imza yine tutar ve düğme pasif kalır. */
      baslangicImza = JSON.stringify(girdiTopla());
      if (YU.cikisKilidi) YU.cikisKilidi(false);

      YU.git(KOD, { tarih: tarih });
    }

    function gunuSil() {
      YU.ui.onay({
        baslik: "Günü Sıfırla",
        tehlike: true,
        onayMetni: "Günü Sıfırla",
        /* Metin, servisin GERÇEKTE yaptığı işi söyler (kullanıcı kararı,
           31.08.2026): Malzeme Girişi'nin öbür satırları artık silinmiyor,
           onay penceresi de öyle demiyor.
           KISALTILDI (kullanıcı isteği, 02.09.2026: "x tarihli, bu sayfadaki
           veriler sıfırlanır malzeme girişi sıfırlanamaz gibi yaz"). Kalem
           kalem döküm kalktı — "bu sayfadaki veriler" hepsini kapsıyor.
           İki uyarı korundu: geri alınamazlık ve negatif stok engeli. */
        /* İKİ PARAGRAF (kullanıcı isteği, 02.09.2026: "alt alta olsun
           paragrafı"). Ne olacağı üstte, uyarılar altta. İkinci paragraf
           onay penceresinin hazır "ayrıntı" yuvasına konur — ortak bileşene
           dokunmadan satır ayrımı böyle kurulur; aradaki boşluğu pencerenin
           kendi 12px'i verir. Yazı ölçüsü ilk paragrafla aynı tutuldu. */
        metin: YU.fmt.tarih(tarih) + " tarihli, bu sayfadaki veriler sıfırlanır. " +
          "Malzeme Girişi sıfırlanmaz.",
        ayrinti: YU.h("div", {
          metin: "Geri alınamaz; sonraki bir günün silosu eksiye düşerse yapılmaz.",
          stil: { font: "400 15px/1.6 var(--font)", color: "var(--metin-3)" }
        })
      }).then(function (evet) {
        if (!evet) return;
        var s = YU.servis.gunSil(db, tarih, YU.oturum.kullanici);
        if (!s.ok) {
          if (YU.ui.kilitYakala(s)) return;
          /* Silme reddi de üst şeride liste basmaz (27.08.2026); sebep
             bildirimde ve sağdaki panelde okunur. */
          YU.bos(sonucKap);
          YU.ui.bildir(s.hatalar.length ? s.hatalar[0].mesaj : "Gün silinemedi.", "hata");
          if (sonucKap.scrollIntoView) sonucKap.scrollIntoView({ block: "nearest" });
          return;
        }
        /* Silme dökümü de kaldırıldı (kullanıcı isteği, 27.08.2026): neyin
           silindiği onay penceresinde zaten yazıyordu, yeni silo toplamı da
           sağdaki Gün Sonu kartlarında duruyor. Geriye tek satır kalır. */
        bekleyenSonuc = {
          tarih: tarih,
          basariMetni: "Başarıyla silindi."
        };
        YU.ui.bildir("Başarıyla silindi.", "basari");
        /* Kaydet'teki aynı sebep: gün silindiyse ekranda korunacak bir şey
           kalmadı, kilit yeniden çizimden önce düşer. */
        if (YU.cikisKilidi) YU.cikisKilidi(false);
        YU.git(KOD, { tarih: tarih });
      });
    }

    /* Klavye: alanlar arasında Tab akışı DOM sırasıyla gider (tarih → üretim →
       çuval → giren silolar → satış → çıkan silolar → eylemler), Ctrl+Enter kaydeder. */
    govde.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        kaydet();
      }
    });

    /* KİLİTLİ KAMPANYA GÜNÜ (kullanıcı kararı, 01.09.2026): ekran salt
       okunur olur. Şerit tarih satırının hemen altına girer, kutular ve
       Kaydet / Günü Sıfırla kapanır; tarih şeridi açık kalır ki başka bir
       güne geçilebilsin. guncelle()'den SONRA çalışır — o çağrı Kaydet'i
       kendi kuralına göre açıp kapatıyor, kilit son sözü söyler. */
    var gunKilidi = (YU.servis && YU.servis.tarihKilitDurumu)
      ? YU.servis.tarihKilitDurumu(db, tarih) : null;

    guncelle();
    if (gunKilidi) {
      kap.insertBefore(YU.ui.kilitliGunSeridi(gunKilidi, tarih), yerlesim);
      YU.ui.girisleriKapat([yerlesim]);
    } else if (!kayit) uretilenAlan.odakla();
  }
})();

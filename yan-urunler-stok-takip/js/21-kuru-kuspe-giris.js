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

  function malzemeSatiriVarMi(db, tarih) {
    var i;
    for (i = 0; i < db.gunlukHareket.length; i++) {
      if (db.gunlukHareket[i].Tarih === tarih) return true;
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

  /* "Silo 1 silosuna" kalıbı bilerek seçildi: ad ne olursa olsun ek doğru
     kalır, sayı sonuna gelen -e/-a eki tahmin edilmek zorunda kalmaz. */
  function siloIfadesi(db, satirlar, tekilEk, cogulEk) {
    var parcalar = [], i, silo, m;
    for (i = 0; i < satirlar.length; i++) {
      m = YU.yuvarla(satirlar[i].miktar);
      if (!isFinite(m) || m <= 0) continue;
      silo = null;
      for (var j = 0; j < db.silolar.length; j++) if (db.silolar[j].Id === satirlar[i].siloId) silo = db.silolar[j];
      parcalar.push({ ad: silo ? silo.Ad : "Silo #" + satirlar[i].siloId, miktar: m });
    }
    if (!parcalar.length) return null;
    if (parcalar.length === 1) return parcalar[0].ad + " " + tekilEk;
    var metin = [];
    for (i = 0; i < parcalar.length; i++) metin.push(parcalar[i].ad + " (" + YU.fmt.kgU(parcalar[i].miktar) + ")");
    return metin.join(", ") + " " + cogulEk;
  }

  var TIP_ADI = {
    DokmeUretim: "Dökme Üretim",
    Cuvallama: "Çuvallama",
    DokmeSatis: "Dökme Satış",
    Manuel: "Manuel"
  };

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

  function adimBasligi(no, yon, baslik, sag) {
    var r = ADIM_RENK[yon] || ADIM_RENK.notr;
    return YU.h("div", { stil: { display: "flex", alignItems: "center", gap: "12px", paddingBottom: "12px", borderBottom: "1px solid var(--ayrac)" } },
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
    return YU.h("div", { metin: metin, stil: { font: "600 12px/1 var(--font)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--metin-4)" } });
  }

  /* Adım gövdesi: sol sütun rakamlar (1 pay), sağ sütun dağıtım (2 pay, gri kutu). */
  function ikiSutun(solBaslik, sol, sagBaslik, sag) {
    var solKol = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "14px", minWidth: "0", paddingRight: "22px" } }, altEtiket(solBaslik), sol);
    var sagKol = YU.h("div", {
      stil: {
        display: "flex", flexDirection: "column", gap: "12px", minWidth: "0",
        padding: "14px 18px 16px", background: "var(--yuzey)",
        border: "1px solid var(--kenar)", borderRadius: "var(--r)"
      }
    }, altEtiket(sagBaslik), sag);
    return YU.h("div", { stil: { display: "grid", gridTemplateColumns: "minmax(250px, 1fr) minmax(0, 2fr)", alignItems: "start" } }, solKol, sagKol);
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
    alan.girdi.style.font = "500 19px/1.3 var(--sayi)";
    alan.girdi.style.paddingTop = "11px";
    alan.girdi.style.paddingBottom = "11px";
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
    baslik: "Kuru Küspe Günlük Giriş",
    ikon: "#ic-plus",
    grup: "Giriş",
    rol: "Hepsi",
    altBaslik: function (param) {
      var tarih = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
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
    var kayit = kuruKuspeBul(db, tarih);
    var okunanRowVersion = kayit ? Number(kayit.RowVersion) : null;
    var silinebilir = !!kayit || malzemeSatiriVarMi(db, tarih);
    var silolar = aktifSilolar(db);
    var gunBasi = {};
    var i;

    YU.ui.sayfaEylemleri(
      YU.ui.dugme({
        metin: "Günlük Rapor", ikon: "#ic-doc", tur: "ikincil",
        onClick: function () { YU.git("gunluk-rapor", { tarih: tarih }); }
      }),
      YU.ui.dugme({
        metin: "Geçmiş Girişler", ikon: "#ic-calendar", tur: "ikincil",
        onClick: function () { YU.git("gecmis-girisler"); }
      })
    );

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
    /* Geniş ekranda paneller gereksiz büyüyordu; sayfa genişliği sınırlanır
       (kullanıcı isteği, 23.08.2026). Sol hizalı: başlıkla aynı akış. */
    var govde = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "18px", maxWidth: "1120px" } });
    /* İki sütun: solda adımlar, sağda kaydırırken yerinde duran Gün Fişi
       (kullanıcı isteği, 23.08.2026). Dar ekranda fiş alta iner. */
    var fis = fisKur();
    var fisKolon = YU.h("div", { stil: { position: "sticky", top: "78px", minWidth: "0" } }, fis.kok);
    kap.appendChild(YU.h("div", {
      stil: { display: "grid", gridTemplateColumns: "minmax(0, 1120px) minmax(272px, 320px)", gap: "18px", alignItems: "start" }
    }, govde, fisKolon));

    /* ---------- 1. Üzerine yazma uyarısı (Şartname §7, v2) ---------- */

    if (kayit) {
      var damga = kayit.GuncellemeTarihi || kayit.OlusturmaTarihi;
      var kimId = kayit.GuncellemeTarihi ? kayit.GuncelleyenKullaniciId : kayit.OlusturanKullaniciId;
      var kim = kullaniciAdi(db, kimId) || "bilinmeyen kullanıcı";
      govde.appendChild(YU.ui.serit({
        tur: "uyari",
        baslik: "Bu Gün Daha Önce Kaydedilmiş",
        metin: kim + ", " + YU.fmt.tarih(tarih) + " " + YU.fmt.saat(damga) +
          "'da girmiş. Kaydedersen eski değerler bu yenileriyle değişir; o güne ait eski silo hareketleri de yenilenir.",
        eylem: {
          metin: "Günlük Rapor", ikon: "#ic-doc",
          onClick: function () { YU.git("gunluk-rapor", { tarih: tarih }); }
        }
      }));
    }

    var sonucKap = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "12px" } });
    govde.appendChild(sonucKap);

    if (bekleyenSonuc && bekleyenSonuc.tarih === tarih) {
      var onceki = YU.ui.serit({ tur: bekleyenSonuc.tur, baslik: bekleyenSonuc.baslik, metin: bekleyenSonuc.metin });
      seritSatirlari(onceki, bekleyenSonuc.satirlar);
      sonucKap.appendChild(onceki);
      if (bekleyenSonuc.uyarilar && bekleyenSonuc.uyarilar.length) {
        sonucKap.appendChild(YU.ui.hataListesi(bekleyenSonuc.uyarilar, "uyari"));
      }
    }
    bekleyenSonuc = null;

    /* ---------- 2. Tarih satırı ---------- */

    /* Tarih küçük bir kontrol: koca panel değil, tek satırlık ince şerit.
       Gün adı ve kayıt durumu sayfa alt başlığında zaten yazıyor. */
    var tarihAlan = YU.ui.alan({
      tip: "tarih", deger: tarih, genislik: "158px",
      onChange: function () {
        var v = tarihAlan.girdi.value;
        if (gecerliTarih(v)) YU.git(KOD, { tarih: v });
        else tarihAlan.ayarla(tarih);
      }
    });

    function gunGit(fark) {
      YU.git(KOD, { tarih: fark === 0 ? YU.tarih.bugun() : YU.tarih.ekle(tarih, fark) });
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
      ),
      YU.h("span", { stil: { flex: "1" } }),
      YU.ui.rozet(kayit ? "Kayıtlı Gün" : "Kayıt Yok", kayit ? "bekleyen" : "notr")
    );
    govde.appendChild(tarihSatiri);

    /* ---------- 3. Ham girdiler (Şartname §4: operatör yalnız ham rakam girer) ---------- */

    var uretilenAlan = buyukAlan(YU.ui.alan({
      etiket: "Bugün Üretilen Dökme Kuru Küspe", tip: "sayi", sag: "kg",
      deger: kayit ? Number(kayit.UretilenDokme) : null,
      yardim: "İşletme raporundaki rakam, olduğu gibi yazılır.",
      onInput: guncelle
    }));

    var CUVAL_YARDIM = "1 çuval = " + YU.fmt.kg(YU.hesap.CUVAL_KG) + " kg. Çuvallanan kısım siloya girmez, çuvallı stoğa yazılır.";
    var cuvalAlan = buyukAlan(YU.ui.alan({
      etiket: "Çuvallanan", tip: "sayi", sag: "çuval",
      deger: kayit ? Number(kayit.CuvalAdet) : null,
      yardim: CUVAL_YARDIM,
      onInput: guncelle
    }), "64px");
    var cuvalYardim = cuvalAlan.kok.querySelector(".yu-yardim");

    var satilanAlan = buyukAlan(YU.ui.alan({
      etiket: "Bugün Satılan Dökme Kuru Küspe", tip: "sayi", sag: "kg",
      deger: kayit ? Number(kayit.SatilanDokme) : null,
      yardim: "Silodan doğrudan yapılan dökme satış.",
      onInput: guncelle
    }));

    /* ---------- 4. Kalem (silo dağıtımı) bileşeni ----------
       Her kalem (üretim yerleştirme / satış çekişi / çuvallama çekişi) aynı
       bileşendir: başlıkta gereken miktar büyük yazılır, altında silo başına bir
       kutu ve sağında "Hepsini Ekle", en altta kolaylık düğmeleri ve
       "dağıtılan / gereken" sayacı. Üretim ve satış kalemleri HER ZAMAN görünür
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
      var sayac = YU.h("span", { sinif: "yu-mono", stil: { fontSize: "13.5px", whiteSpace: "nowrap", color: "var(--metin-3)" } });
      var rozetKap = YU.h("span", { stil: { display: "inline-flex" } });
      /* Başlık satırı: solda kalem adı + gereken miktar, sağda dağıtılan sayacı + durum. */
      var basSatir = YU.h("div", { stil: { display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" } },
        YU.h("span", { metin: d.baslik, stil: { font: "600 15px/1.2 var(--font)", color: "var(--metin)" } }),
        buyuk,
        YU.h("span", { stil: { flex: "1" } }),
        sayac, rozetKap
      );
      var aciklama = YU.h("div", { stil: { display: "none", font: "400 13.5px/1.5 var(--font)", color: "var(--metin-3)" } });

      var kutuIzgara = YU.h("div", { stil: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" } });
      for (r = 0; r < silolar.length; r++) {
        (function (silo) {
          var a = YU.ui.alan({ tip: "sayi", sag: "kg", onInput: guncelle });
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
          kutuIzgara.appendChild(YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" } },
            YU.h("div", { stil: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" } },
              YU.h("span", { metin: silo.Ad, stil: { font: "600 13.5px/1.2 var(--font)", color: "var(--metin-2)" } }),
              YU.h("span", { sinif: "yu-yardim", metin: "gün başı " + YU.fmt.kgU(gunBasi[silo.Id]), stil: { whiteSpace: "nowrap" } })
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

      function toplam() {
        var t = 0, m;
        for (var k = 0; k < alanlar.length; k++) { m = alanlar[k].deger(); if (isFinite(m)) t += m; }
        return YU.yuvarla(t);
      }

      function temizle() { for (var k = 0; k < alanlar.length; k++) alanlar[k].ayarla(""); }

      function yaz(dagilim) {
        for (var k = 0; k < alanlar.length; k++) {
          var m = YU.yuvarla(dagilim[silolar[k].Id] || 0);
          alanlar[k].ayarla(m > 0 ? m : "");
        }
      }

      /* Tam kilograma bölünür, artık son siloya bırakılır: fabrikada siloya
         küsuratlı kilo yazılmaz, toplam yine birebir tutar (D3/D5/D13). */
      function esitDagit() {
        var n = silolar.length, kalan = gereken, g = {}, k, pay, m;
        pay = Math.floor(gereken / n);
        for (k = 0; k < n; k++) {
          m = k === n - 1 ? YU.yuvarla(kalan) : pay;
          g[silolar[k].Id] = m;
          kalan = YU.yuvarla(kalan - m);
        }
        yaz(g);
      }

      function eylem(fn) {
        return function () { if (!etkin) return; fn(); guncelle(); };
      }

      /* "Hepsi Silo 1'e" düğmesi kalktı: kutu içindeki "Hepsini Ekle" aynı işi
         her silo için yapıyor; iki düğme aynı işi yapınca hiyerarşi bozuluyordu. */
      var dugmeEsit = YU.ui.dugme({ metin: "Eşit Böl", kucuk: true, tur: "ikincil", onClick: eylem(esitDagit) });
      var dugmeTemizle = YU.ui.dugme({ metin: "Temizle", kucuk: true, tur: "sade", onClick: eylem(temizle) });
      dugmeler.push(dugmeEsit, dugmeTemizle);
      var dugmeSatiri = satir({ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }, dugmeEsit, dugmeTemizle);

      /* display değerleri açıkça yazılır ("" değil): inline display kuruluyor,
         "" yazmak onu siler ve blok düz akışa düşer. */
      var kok = YU.h("div", { stil: { display: d.hepGoster ? "flex" : "none", flexDirection: "column", gap: "12px" } },
        basSatir, aciklama, kutuIzgara, dugmeSatiri);

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
        var metin = etkin ? aciklamaMetni : bosMetin;
        aciklama.textContent = metin || "";
        aciklama.style.display = metin ? "block" : "none";

        if (!etkin) {
          sayac.textContent = "";
          YU.bos(rozetKap);
          return;
        }

        var girilen = toplam();
        var fark = YU.yuvarla(gereken - girilen);
        var tutuyor = Math.abs(fark) <= tol;
        sayac.textContent = "Dağıtılan " + YU.fmt.kg(girilen) + " / " + YU.fmt.kg(gereken) + " kg";
        sayac.style.color = tutuyor ? "var(--olumlu)" : "var(--metin-2)";
        YU.bos(rozetKap).appendChild(YU.ui.rozet(
          tutuyor ? "Tamam" : (fark > 0 ? "Eksik " + YU.fmt.kgU(fark) : "Fazla " + YU.fmt.kgU(-fark)),
          tutuyor ? "olumlu" : "olumsuz"
        ));
      }

      return {
        kod: d.kod, kok: kok, alanlar: alanlar,
        degerler: degerler, yaz: yaz, tazele: tazele,
        etkinMi: function () { return etkin; }
      };
    }

    var kalemUretim = kalemKur({
      kod: "uretim", yon: "giren", baslik: "Siloya girecek", hepGoster: true,
      ariaAd: "Üretimden girecek"
    });
    var kalemSatis = kalemKur({
      kod: "satis", yon: "cikan", baslik: "Satış için çıkacak", hepGoster: true,
      ariaAd: "Satış için çıkacak"
    });
    var kalemCuvallama = kalemKur({
      kod: "cuvallama", yon: "cikan", baslik: "Çuvallama için çıkacak", hepGoster: false,
      ariaAd: "Çuvallama için çıkacak"
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
      if (ekSinif) p.className += " " + ekSinif;
      return p;
    }

    function rakamYigini() {
      var kap = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "14px" } });
      for (var a = 0; a < arguments.length; a++) kap.appendChild(arguments[a].kok);
      return kap;
    }

    govde.appendChild(adimPaneli([
        adimBasligi(1, "giren", "Siloya Giren"),
        ikiSutun("Bugünün Rakamları", rakamYigini(uretilenAlan, cuvalAlan), "Silolara Dağıt", kalemUretim.kok)
    ]));

    govde.appendChild(adimPaneli([
        adimBasligi(2, "cikan", "Silodan Çıkan"),
        ikiSutun("Bugünün Rakamları", rakamYigini(satilanAlan), "Silolardan Çek",
          YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "18px" } }, kalemSatis.kok, kalemCuvallama.kok))
    ], "yu-turuncu"));   /* hafif turuncu zemin (tema.css) */

    /* Kayıtlı günü aç: silo hareketleri alanlara geri yazılır. */
    if (kayit) {
      kalemUretim.yaz(gunHareketleri(db, tarih, "DokmeUretim"));
      kalemCuvallama.yaz(gunHareketleri(db, tarih, "Cuvallama"));
      kalemSatis.yaz(gunHareketleri(db, tarih, "DokmeSatis"));
    }

    /* ---------- 6. Adım 3: Gün sonu silo durumu + kayıt (tek panel) ---------- */

    var netEtki = YU.h("span", { metin: "—", stil: { font: "600 20px/1 var(--sayi)", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", color: "var(--metin)" } });
    var siloOzetleri = [];
    var siloIzgara = YU.h("div", { stil: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" } });

    for (i = 0; i < silolar.length; i++) {
      (function (silo) {
        var kapasite = Number(silo.Kapasite) || 0;
        var yuzde = YU.h("span", { sinif: "yu-yardim", metin: "—", stil: { whiteSpace: "nowrap" } });
        var sonu = YU.h("span", { metin: "—", stil: { font: "600 20px/1 var(--sayi)", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" } });
        var cubukKap = YU.h("div");
        var kart = YU.h("div", {
          stil: {
            display: "flex", flexDirection: "column", gap: "8px", minWidth: "0",
            padding: "12px 14px", border: "1px solid var(--kenar)", borderRadius: "var(--r)", background: "var(--yuzey)"
          }
        },
          YU.h("div", { stil: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" } },
            YU.h("span", { metin: silo.Ad, stil: { font: "600 14.5px/1.2 var(--font)", color: "var(--metin)" } }),
            yuzde
          ),
          YU.h("div", { stil: { display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" } },
            YU.h("span", { sinif: "yu-mono", metin: YU.fmt.kgU(gunBasi[silo.Id]), stil: { fontSize: "14px", color: "var(--metin-3)" } }),
            YU.h("span", { metin: "→", stil: { color: "var(--metin-5)" } }),
            sonu
          ),
          cubukKap,
          YU.h("div", { sinif: "yu-yardim", metin: kapasite > 0 ? "gün başı → gün sonu · kapasite " + YU.fmt.ton(kapasite) : "gün başı → gün sonu · kapasite tanımsız" })
        );
        siloIzgara.appendChild(kart);
        siloOzetleri.push({ silo: silo, kapasite: kapasite, sonu: sonu, yuzde: yuzde, cubukKap: cubukKap });
      })(silolar[i]);
    }

    /* Net etki, silo kartlarıyla aynı sırada dördüncü kart: "bugün silolar
       toplamda ne kadar değişti" sorusunun cevabı, silolarla yan yana okunur. */
    siloIzgara.appendChild(YU.h("div", {
      stil: {
        display: "flex", flexDirection: "column", gap: "8px", minWidth: "0", justifyContent: "center",
        padding: "12px 14px", border: "1px dashed var(--kenar-3)", borderRadius: "var(--r)", background: "var(--yuzey)"
      }
    },
      YU.h("span", { metin: "Bugün silolara net etki", stil: { font: "600 13.5px/1.2 var(--font)", color: "var(--metin-2)" } }),
      netEtki,
      YU.h("div", { sinif: "yu-yardim", metin: "giren − çıkan" })
    ));

    /* ---------- 7. Durum satırı + eylemler (Adım 3'ün altı) ---------- */

    var durumIkon = YU.h("span", { stil: { display: "flex", flex: "none", alignSelf: "flex-start", marginTop: "1px" } });
    var durumBaslik = YU.h("div", { stil: { font: "600 15.5px/1.35 var(--font)", color: "var(--metin)" } });
    var durumListe = YU.h("ul", { stil: { display: "none", margin: "5px 0 0", paddingLeft: "18px", font: "400 14px/1.5 var(--font)", color: "var(--metin-2)" } });

    var dugmeKaydet = YU.ui.dugme({
      metin: "Kaydet", ikon: "#ic-plus", tur: "birincil",
      baslik: "Ctrl + Enter",
      onClick: kaydet
    });
    dugmeKaydet.style.padding = "10px 20px";
    dugmeKaydet.style.fontSize = "15px";

    var dugmeSil = silinebilir ? YU.ui.dugme({
      metin: "Günü Sil", ikon: "#ic-trash", tur: "tehlike", onClick: gunuSil
    }) : null;

    var durumSatiri = YU.h("div", { stil: yatay("14px") },
      satir({ display: "flex", gap: "10px", flex: "1", minWidth: "260px", alignItems: "flex-start" },
        durumIkon,
        YU.h("div", { stil: { minWidth: "0" } }, durumBaslik, durumListe)
      ),
      dugmeSil,
      dugmeKaydet
    );

    govde.appendChild(adimPaneli([
        adimBasligi(3, "notr", "Gün Sonu ve Kayıt"),
        siloIzgara,
        YU.h("div", { sinif: "yu-ayrac yu-yatay" }),
        durumSatiri
    ]));

    /* ---------- 8. Bu günün kayıtlı hareketleri (yalnız varsa) ---------- */

    var kayitliPanel = panelGunHareketleri();
    if (kayitliPanel) govde.appendChild(kayitliPanel);

    /* ---------- Canlı hesap ---------- */

    function girdiTopla() {
      return {
        tarih: tarih,
        uretilenDokme: uretilenAlan.deger(),
        cuvalAdet: cuvalAlan.deger(),
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
        else if (h.kod === "D2") cuvalAlan.hataGoster(h.mesaj);
        else if (h.kod === "D13") { satilanAlan.hataGoster(h.mesaj); kalemBoya("satis", true); }
        else if (h.kod === "D3" || h.kod === "D4") kalemBoya("uretim", true);
        else if (h.kod === "D5" || h.kod === "D6") kalemBoya("cuvallama", true);
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
    function gunSonuTazele(girdi, h) {
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
        YU.bos(so.cubukKap).appendChild(YU.ui.cubuk(oran, sorun ? "olumsuz" : (oran >= 0.9 ? "bekleyen" : "vurgu")));
        so.yuzde.textContent = so.kapasite > 0 ? YU.fmt.yuzde(oran * 100) + " dolu" : "kapasite yok";
        so.yuzde.style.color = sorun ? "var(--olumsuz)" : "";
      }

      var d = h.siloNetDegisim;
      netEtki.textContent = (isFinite(d) && d > 0 ? "+" : "") + YU.fmt.kg(d) + " kg";
      netEtki.style.color = !isFinite(d) || d === 0 ? "var(--metin)" : (d > 0 ? "var(--olumlu)" : "var(--olumsuz)");
    }

    function canliDenetim(girdi) {
      var d = YU.dogrula.kuruKuspeKaydi(db, girdi);
      var hatalar = d.hatalar.slice();
      var negatifler = YU.dogrula.ileriBakiye(db, tarih, {
        tarih: tarih,
        silinecekKaynakId: kayit ? kayit.Id : null,
        yeniHareketler: taslakHareketler(girdi)
      });
      for (var i2 = 0; i2 < negatifler.length; i2++) {
        hatalar.push({ kod: "D14", mesaj: YU.dogrula.d14Mesaji(negatifler[i2]) });
      }
      return { hatalar: hatalar, uyarilar: d.uyarilar };
    }

    function durumYaz(ikon, renk, baslik, maddeler) {
      YU.bos(durumIkon).appendChild(YU.svg(ikon, 18));
      durumIkon.style.color = renk;
      durumBaslik.textContent = baslik;
      durumBaslik.style.color = renk;
      YU.bos(durumListe);
      for (var k = 0; k < (maddeler || []).length; k++) durumListe.appendChild(YU.h("li", { metin: maddeler[k].mesaj }));
      durumListe.style.display = maddeler && maddeler.length ? "block" : "none";
    }

    /* ---------- Gün Fişi — yazarken güncellenen makbuz ----------
       Hesap YU.hesap'tan gelir; burada yalnız yazılır. Satırlar: ham girdi,
       net dökme üretim ve silo kırılımı, çekişler, net etki, gün sonu. */

    function fisKur() {
      var satirStil = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", font: "400 13.5px/1.5 var(--font)", color: "var(--metin-2)" };
      var degerStil = { font: "500 13.5px/1.5 var(--sayi)", fontVariantNumeric: "tabular-nums", color: "var(--metin)", whiteSpace: "nowrap" };
      var altStil = { font: "400 12.5px/1.4 var(--font)", color: "var(--metin-4)", paddingLeft: "14px" };

      function cizgi() { return YU.h("div", { stil: { borderTop: "1px dashed var(--kenar-3)", margin: "4px 0" } }); }
      function satir(etiket, kalin) {
        var deger = YU.h("span", { metin: "—", stil: degerStil });
        var kok = YU.h("div", { stil: satirStil }, YU.h("span", { metin: etiket }), deger);
        if (kalin) { kok.style.color = "var(--metin)"; kok.style.fontWeight = "600"; deger.style.fontWeight = "700"; }
        return { kok: kok, deger: deger };
      }

      var ham = satir("Üretilen dökme (ham)");
      var cuval = satir("Çuvallanan");
      var net = satir("Siloya giren (net)", true);
      var netKirilim = YU.h("div", { stil: altStil });
      var cekis = satir("Çuvallama için çekilen");
      var cekisKirilim = YU.h("div", { stil: altStil });
      var satis = satir("Dökme satış");
      var satisKirilim = YU.h("div", { stil: altStil });
      var etki = satir("Silolara net etki", true);
      var gunSonu = satir("Silolarda gün sonu");
      var cuvalli = satir("Çuvallı kuru küspe üretimi");
      var durum = YU.h("div", { stil: { font: "600 13.5px/1.4 var(--font)", marginTop: "2px" } });

      var govde = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "3px" } },
        ham.kok, cuval.kok, cizgi(),
        net.kok, netKirilim, cekis.kok, cekisKirilim, satis.kok, satisKirilim, cizgi(),
        etki.kok, gunSonu.kok, cizgi(),
        cuvalli.kok, durum
      );

      var kok = YU.ui.panel({
        baslik: "Gün Fişi", ikon: "#ic-doc",
        sag: YU.h("span", { metin: YU.fmt.tarih(tarih) }),
        govde: [govde]
      });

      function kirilimYaz(el, satirlar, ok) {
        YU.bos(el);
        var var_ = false, k, m, ad;
        for (k = 0; k < satirlar.length; k++) {
          m = YU.yuvarla(satirlar[k].miktar);
          if (!isFinite(m) || m <= 0) continue;
          ad = null;
          for (var j = 0; j < silolar.length; j++) if (silolar[j].Id === satirlar[k].siloId) ad = silolar[j].Ad;
          el.appendChild(YU.h("div", { stil: { display: "flex", justifyContent: "space-between", gap: "8px" } },
            YU.h("span", { metin: ok + " " + (ad || "Silo") }),
            YU.h("span", { metin: YU.fmt.kgU(m), stil: { fontFamily: "var(--sayi)", fontVariantNumeric: "tabular-nums" } })));
          var_ = true;
        }
        el.style.display = var_ ? "" : "none";
      }

      function tazele(h, girdi) {
        var u = girdi.uretilenDokme, a = girdi.cuvalAdet;
        ham.deger.textContent = isFinite(u) ? YU.fmt.kgU(u) : "—";
        cuval.deger.textContent = isFinite(a) ? YU.fmt.sayi(a) + " çuval · " + YU.fmt.kgU(h.cuvalKg) : "—";
        net.deger.textContent = YU.fmt.kgU(h.netDokmeUretim);
        kirilimYaz(netKirilim, girdi.yerlestirmeler, "→");
        cekis.kok.style.display = h.silodanCekilecek > tol ? "flex" : "none";
        cekis.deger.textContent = YU.fmt.kgU(h.silodanCekilecek);
        kirilimYaz(cekisKirilim, h.silodanCekilecek > tol ? girdi.cekisler : [], "←");
        satis.deger.textContent = YU.fmt.kgU(h.satilanDokme);
        kirilimYaz(satisKirilim, girdi.satisCekisleri, "←");
        var d = h.siloNetDegisim;
        etki.deger.textContent = (isFinite(d) && d > 0 ? "+" : "") + YU.fmt.kgU(isFinite(d) ? d : 0);
        etki.deger.style.color = !isFinite(d) || d === 0 ? "var(--metin)" : (d > 0 ? "var(--olumlu)" : "var(--olumsuz)");
        /* Gün sonu toplamı gunSonuTazele ile aynı formül: gün başı + giren − çekiş − satış. */
        var yer = siloBazinda(girdi.yerlestirmeler), cek = siloBazinda(girdi.cekisler), sat = siloBazinda(girdi.satisCekisleri);
        var toplamSonu = 0, r, id;
        for (r = 0; r < silolar.length; r++) { id = silolar[r].Id; toplamSonu += gunBasi[id] + (yer[id] || 0) - (cek[id] || 0) - (sat[id] || 0); }
        gunSonu.deger.textContent = YU.fmt.kgU(YU.yuvarla(toplamSonu));
        cuvalli.deger.textContent = YU.fmt.kgU(h.cuvalKg);
      }

      function durumYaz(hataSayisi, uyariSayisi) {
        if (hataSayisi) { durum.textContent = "✗ " + (hataSayisi === 1 ? "1 nokta düzeltilecek" : hataSayisi + " nokta düzeltilecek"); durum.style.color = "var(--olumsuz)"; }
        else if (uyariSayisi) { durum.textContent = "! Kaydedilebilir, uyarı var"; durum.style.color = "var(--bekleyen)"; }
        else { durum.textContent = "✓ Kayda hazır"; durum.style.color = "var(--olumlu)"; }
      }

      return { kok: kok, tazele: tazele, durumYaz: durumYaz };
    }

    function ozetTazele(girdi) {
      var d = canliDenetim(girdi);
      var h = d.hatalar.length, u = d.uyarilar.length;

      /* Engelleyen kural varken Kaydet BASILAMAZ (kullanıcı kararı,
         21.08.2026): önce düzeltme, sonra kayıt. */
      dugmeKaydet.disabled = h > 0;
      dugmeKaydet.title = h > 0 ? "Önce yukarıdaki noktaları düzelt." : "Ctrl + Enter";

      fis.durumYaz(h, u);
      if (h) {
        durumYaz("#ic-alert", "var(--olumsuz)",
          "Kaydetmeden önce düzeltilmesi gereken " + (h === 1 ? "bir nokta" : h + " nokta") + " var:", d.hatalar);
      } else if (u) {
        durumYaz("#ic-bell", "var(--bekleyen)", "Kaydedilebilir; yine de şuna dikkat:", d.uyarilar);
      } else {
        durumYaz("#ic-checklist", "var(--olumlu)", "Her şey tamam — kaydedebilirsin.", null);
      }
    }

    function guncelle() {
      boyalariSil();
      var ilk = girdiTopla();
      var h = YU.hesap.kuruKuspe(ilk.uretilenDokme, ilk.cuvalAdet, ilk.satilanDokme);
      var uretim = ilk.uretilenDokme, adet = ilk.cuvalAdet;

      cuvalYardim.textContent = (isFinite(adet) && adet > 0)
        ? YU.fmt.sayi(adet) + " çuval = " + YU.fmt.kgU(h.cuvalKg) + " · çuvallı stoğa yazılır, siloya girmez."
        : CUVAL_YARDIM;

      /* Siloya giren: net üretim yoksa blok pasif kalır, sebebi tek cümle. */
      var girenBos = null;
      if (!(h.netDokmeUretim > tol)) {
        if (!(uretim > 0) && !(h.cuvalKg > 0)) girenBos = "Üretilen dökme yazılınca bu kutular açılır.";
        else if (h.cuvalKg > uretim + tol) girenBos = "Bugün üretilenden fazla çuvallanmış; siloya giriş yok. Aradaki fark aşağıda silodan çıkar.";
        else girenBos = "Üretimin tamamı çuvallanmış; siloya giriş yok.";
      }
      kalemUretim.tazele(h.netDokmeUretim, girenBos, null);

      /* Silodan çıkan: satış her gün olabilir; çuvallama çekişi yalnız
         üretimden fazla çuvallanan günde (Şartname §4 Durum B) belirir. */
      kalemSatis.tazele(h.satilanDokme,
        !(h.satilanDokme > tol) ? "Satılan dökme yazılınca bu kutular açılır." : null, null);
      kalemCuvallama.tazele(h.silodanCekilecek, null,
        h.silodanCekilecek > tol
          ? "Bugün " + YU.fmt.kgU(uretim) + " üretilmiş ama " + YU.fmt.kgU(h.cuvalKg) + " (" + YU.fmt.sayi(adet) +
            " çuval) çuvallanmış. Aradaki " + YU.fmt.kgU(h.silodanCekilecek) +
            " önceki günlerden kalan silo stoğundan çıkar. Girdiğin üretim rakamı raporda ayrıca görünür."
          : null);

      /* Kalemler gereksiz alanları boşaltmış olabilir; özet güncel değerle kurulur. */
      var girdi = girdiTopla();
      gunSonuTazele(girdi, h);
      fis.tazele(h, girdi);
      ozetTazele(girdi);
    }

    /* ---------- Kaydetme ve silme ---------- */

    function kaydet() {
      YU.bos(sonucKap);
      boyalariSil();

      var girdi = girdiTopla();
      var s = YU.servis.kuruKuspeKaydet(db, girdi, YU.oturum.kullanici);

      if (!s.ok) {
        sonucKap.appendChild(YU.ui.hataListesi(s.hatalar, "hata"));
        if (s.uyarilar.length) sonucKap.appendChild(YU.ui.hataListesi(s.uyarilar, "uyari"));
        alanlariBoya(s.hatalar);
        if (kodVar(s.hatalar, "D16")) {
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

      var h = YU.hesap.kuruKuspe(girdi.uretilenDokme, girdi.cuvalAdet, girdi.satilanDokme);
      var satirlar = [];
      var yerlesme = siloIfadesi(db, girdi.yerlestirmeler, "silosuna yerleşti", "silolarına yerleşti");
      var cekilme = siloIfadesi(db, girdi.cekisler, "silosundan çekildi", "silolarından çekildi");
      var satilma = siloIfadesi(db, girdi.satisCekisleri, "silosundan çıktı", "silolarından çıktı");

      if (h.netDokmeUretim > 0 && yerlesme) satirlar.push("Siloya giren " + YU.fmt.kgU(h.netDokmeUretim) + ", " + yerlesme + ".");
      if (h.silodanCekilecek > 0 && cekilme) satirlar.push("Çuvallama için " + YU.fmt.kgU(h.silodanCekilecek) + ", " + cekilme + ".");
      if (h.satilanDokme > 0 && satilma) satirlar.push("Dökme satış " + YU.fmt.kgU(h.satilanDokme) + ", " + satilma + ".");
      satirlar.push("Çuvallı kuru küspe üretimi " + YU.fmt.kgU(h.cuvalKg) + " (" + YU.fmt.sayi(girdi.cuvalAdet) + " çuval).");
      if (!yerlesme && !cekilme && !satilma) satirlar.push("Bu gün için silo hareketi oluşmadı.");

      var siloMetni = [], s2, mevcut;
      for (s2 = 0; s2 < silolar.length; s2++) {
        mevcut = YU.stok.siloStok(db, silolar[s2].Id, tarih).mevcut;
        siloMetni.push(silolar[s2].Ad + " " + YU.fmt.kg(mevcut));
      }
      satirlar.push("Yeni silo toplamı " + YU.fmt.kgU(YU.stok.dokmeToplam(db, tarih)) + " · " + siloMetni.join(" · ") + ".");

      bekleyenSonuc = {
        tarih: tarih,
        tur: "basari",
        baslik: YU.fmt.tarih(tarih) + " kaydedildi.",
        metin: satirlar[0],
        satirlar: satirlar.slice(1),
        uyarilar: s.uyarilar
      };
      YU.ui.bildir(YU.fmt.tarih(tarih) + " kaydedildi.", "basari");
      YU.git(KOD, { tarih: tarih });
    }

    function gunuSil() {
      YU.ui.onay({
        baslik: "Günü Sil",
        tehlike: true,
        onayMetni: "Günü Sil",
        metin: YU.fmt.tarih(tarih) + " gününe ait her şey silinir: kuru küspe kaydı, silo hareketleri ve malzeme hareketleri. " +
          "Geri alınamaz. Sonraki günlerden birinin silo stoğu eksiye düşecekse silme yapılmaz."
      }).then(function (evet) {
        if (!evet) return;
        var s = YU.servis.gunSil(db, tarih, YU.oturum.kullanici);
        if (!s.ok) {
          YU.bos(sonucKap);
          sonucKap.appendChild(YU.ui.hataListesi(s.hatalar, "hata"));
          YU.ui.bildir("Gün silinemedi.", "hata");
          if (sonucKap.scrollIntoView) sonucKap.scrollIntoView({ block: "nearest" });
          return;
        }
        bekleyenSonuc = {
          tarih: tarih,
          tur: "basari",
          baslik: YU.fmt.tarih(tarih) + " silindi.",
          metin: "Bu güne ait kuru küspe kaydı, silo hareketleri ve malzeme hareketleri kaldırıldı.",
          satirlar: ["Yeni silo toplamı " + YU.fmt.kgU(YU.stok.dokmeToplam(db, tarih)) + "."]
        };
        YU.ui.bildir(YU.fmt.tarih(tarih) + " silindi.", "basari");
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

    /* ---------- Kayıtlı hareketler paneli ----------
       Boş tabloyla yer kaplamaz: yalnız o güne ait kayıtlı hareket varsa çizilir. */

    function panelGunHareketleri() {
      var ozet = YU.stok.gunOzeti(db, tarih);
      var satirlar = [], i2, h, giren, cikan;
      if (!ozet.siloHareketleri.length) return null;

      /* Kim, saat kaçta kaydetti — gün yazılmaz, panel zaten tek güne ait. */
      function kaydeden(hareket) {
        var ad = null, i3;
        for (i3 = 0; i3 < db.kullanicilar.length; i3++) {
          if (db.kullanicilar[i3].Id === hareket.OlusturanKullaniciId) { ad = db.kullanicilar[i3].AdSoyad; break; }
        }
        var saat = hareket.OlusturmaTarihi ? YU.fmt.saat(hareket.OlusturmaTarihi) : null;
        if (!ad && !saat) return YU.h("span", { sinif: "yu-zayif", metin: "—" });
        return YU.h("span", { sinif: "yu-zayif", metin: (ad || "—") + (saat && saat !== "—" ? " · " + saat : "") });
      }

      for (i2 = 0; i2 < ozet.siloHareketleri.length; i2++) {
        h = ozet.siloHareketleri[i2].hareket;
        giren = Number(h.GirenKg) || 0;
        cikan = Number(h.CikanKg) || 0;
        satirlar.push([
          ozet.siloHareketleri[i2].silo ? ozet.siloHareketleri[i2].silo.Ad : "Silo #" + h.SiloId,
          YU.ui.rozet(TIP_ADI[h.HareketTipi] || h.HareketTipi, h.HareketTipi === "DokmeUretim" ? "olumlu" : "bekleyen"),
          giren > 0 ? YU.fmt.kg(giren) : "—",
          cikan > 0 ? YU.fmt.kg(cikan) : "—",
          kaydeden(h)
        ]);
      }

      return YU.ui.panel({
        baslik: "Bu Günün Kayıtlı Silo Hareketleri",
        ikon: "#ic-building",
        sag: YU.ui.rozet(YU.fmt.tarih(tarih), "notr"),
        govde: [
          YU.ui.tablo({
            sutunlar: [
              { baslik: "Silo" },
              { baslik: "Hareket" },
              { baslik: "Giren", hiza: "sag", mono: true, genislik: 96 },
              { baslik: "Çıkan", hiza: "sag", mono: true, genislik: 96 },
              { baslik: "Kaydeden", hiza: "sag" }
            ],
            satirlar: satirlar,
            kompakt: true
          })
        ]
      });
    }

    guncelle();
    if (!kayit) uretilenAlan.odakla();
  }
})();

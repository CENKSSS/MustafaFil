/* js/21b-kuru-kuspe-giris-v2.js — Kuru Küspe Günlük Giriş 2. Versiyon
   KARŞILAŞTIRMA KOPYASI (kullanıcı isteği, 23.08.2026): 21-kuru-kuspe-giris.js
   dosyasının yeniden düzenlenmeden önceki hâli (git etiketi kuru-kuspe-eski),
   ayrı bir sayfa koduyla yan yana denensin diye. Yalnız sayfa kodu ve başlığı
   farklıdır; hesap, doğrulama ve kayıt aynı YU katmanlarından geçer. Karar
   verilince biri silinir.

   Şartname §4 (hesap + silo dağıtımı, DEMİRBAŞ), §7 (kullanılabilirlik ve v2
   arayüz maddeleri), §8 (D1–D7, D13–D16) · SÖZLEŞME §6, §7.

   Bu dosya yalnızca sunum yapar: hesap YU.hesap'ta, kurallar YU.dogrula'da,
   yazma YU.servis'te durur (Şartname §10 "Kod düzeni"). Ekranda yeniden
   hesaplanan tek şey, kullanıcıya anında geri bildirim için gereken ara
   toplamlardır — kural kopyalanmaz, servis çağrılır. */
(function () {
  "use strict";

  var YU = window.YU;
  var KOD = "kuru-kuspe-2";

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

  function kodListesi(kayitlar) {
    var gorulen = {}, liste = [], i, k;
    for (i = 0; i < kayitlar.length; i++) {
      k = kayitlar[i].kod || "—";
      if (gorulen[k]) continue;
      gorulen[k] = true;
      liste.push(k);
    }
    return liste;
  }

  function kodVar(kayitlar, kod) {
    var i;
    for (i = 0; i < kayitlar.length; i++) if (kayitlar[i].kod === kod) return true;
    return false;
  }

  function satir(stil) {
    var el = YU.h("div", { stil: stil });
    for (var i = 1; i < arguments.length; i++) el.appendChild(arguments[i]);
    return el;
  }

  function yatay(gap, sar) {
    return { display: "flex", alignItems: "center", gap: gap || "10px", flexWrap: sar === false ? "nowrap" : "wrap" };
  }

  function notMetni(metin) {
    return YU.h("div", { metin: metin, stil: { font: "400 14px/1.6 var(--font)", color: "var(--metin-3)" } });
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

  /* ---------------------------------------------------------------
     Sayfa
     --------------------------------------------------------------- */

  YU.sayfaTanimla({
    kod: KOD,
    baslik: "Kuru Küspe Günlük Giriş 2. Versiyon",
    ikon: "#ic-plus",
    grup: "Giriş",
    rol: "Hepsi",
    altBaslik: function (param) {
      var tarih = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
      var kayit = YU.db ? kuruKuspeBul(YU.db, tarih) : null;
      return YU.fmt.tarihUzun(tarih) + " · " + YU.fmt.gunAdi(tarih) + " · " +
        (kayit ? "kayıtlı gün — düzeltme yapılıyor" : "yeni kayıt");
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
    var govde = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "20px" } });
    kap.appendChild(govde);

    /* ---------- 1. Üzerine yazma uyarısı (Şartname §7, v2) ---------- */

    if (kayit) {
      var damga = kayit.GuncellemeTarihi || kayit.OlusturmaTarihi;
      var kimId = kayit.GuncellemeTarihi ? kayit.GuncelleyenKullaniciId : kayit.OlusturanKullaniciId;
      var kim = kullaniciAdi(db, kimId) || "bilinmeyen kullanıcı";
      govde.appendChild(YU.ui.serit({
        tur: "uyari",
        baslik: "Bu Gün Zaten Kayıtlı",
        metin: "Bu gün " + YU.fmt.tarih(tarih) + " " + YU.fmt.saat(damga) + "'da " + kim +
          " tarafından girilmiş, üzerine yazıyorsun. Kaydettiğinde o güne ait eski silo hareketleri silinip yenileri yazılır (Şartname §4 — Yeniden kaydetme). Sürüm " +
          YU.fmt.sayi(okunanRowVersion) + ".",
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

    /* ---------- 2. Tarih ve ham girdiler ---------- */

    var tarihAlan = YU.ui.alan({
      etiket: "Tarih", tip: "tarih", deger: tarih, genislik: "180px",
      yardim: YU.fmt.gunAdi(tarih) + (tarih === YU.tarih.bugun() ? " · bugün" : ""),
      onChange: function () {
        var v = tarihAlan.girdi.value;
        if (gecerliTarih(v)) YU.git(KOD, { tarih: v });
        else tarihAlan.ayarla(tarih);
      }
    });

    function gunGit(fark) {
      YU.git(KOD, { tarih: fark === 0 ? YU.tarih.bugun() : YU.tarih.ekle(tarih, fark) });
    }

    var tarihSatiri = satir(yatay("10px"),
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
      YU.ui.rozet(kayit ? "Kayıtlı Gün" : "Kayıt Yok", kayit ? "bekleyen" : "notr")
    );

    var uretilenAlan = YU.ui.alan({
      etiket: "Üretilen Dökme Kuru Küspe", tip: "sayi", sag: "kg",
      deger: kayit ? Number(kayit.UretilenDokme) : null,
      yardim: "İşletme raporundan gelen ham rakam. Net üretim sorulmaz, sistem hesaplar.",
      onInput: guncelle
    });

    var cuvalAlan = YU.ui.alan({
      etiket: "Çuvallanan Adet", tip: "sayi", sag: "adet",
      deger: kayit ? Number(kayit.CuvalAdet) : null,
      yardim: "1 çuval = 50 kg sabittir. Çuvallama yeni üretim değil, biçim değişikliğidir.",
      onInput: guncelle
    });

    var satilanAlan = YU.ui.alan({
      etiket: "Satılan Dökme Kuru Küspe", tip: "sayi", sag: "kg",
      deger: kayit ? Number(kayit.SatilanDokme) : null,
      yardim: "Silolardan doğrudan yapılan dökme satış. Karşılığı aşağıda silo çekişi olarak girilir (D13).",
      onInput: guncelle
    });

    var girdiIzgara = YU.h("div", { sinif: "yu-izgara yu-iz-3" }, uretilenAlan.kok, cuvalAlan.kok, satilanAlan.kok);

    govde.appendChild(YU.ui.panel({
      baslik: "Gün ve Ham Girdiler",
      ikon: "#ic-pencil",
      govde: [tarihSatiri, YU.h("div", { sinif: "yu-ayrac yu-yatay" }), girdiIzgara]
    }));

    /* ---------- 3. Hesap şeridi (yazarken anlık — Şartname §7 DEMİRBAŞ) ---------- */

    function hesapOgesi(etiket) {
      var deger = YU.h("div", { sinif: "yu-hesap-deger", metin: "—" });
      var kok = YU.h("div", { sinif: "yu-hesap-oge", stil: { flex: "1 1 132px" } },
        YU.h("div", { sinif: "yu-hesap-etiket", metin: etiket }), deger);
      return {
        deger: deger,
        kok: kok,
        yaz: function (metin, renk) {
          deger.textContent = metin;
          kok.className = "yu-hesap-oge" + (renk ? " " + renk : "");
        }
      };
    }

    function hesapOku(metin) {
      return YU.h("span", { sinif: "yu-hesap-ok", metin: metin });
    }

    /* Çuval karşılığı bir çıkarma kalemi değil, girdiden türetilen bilgi —
       o yüzden denklemin içinde değil, üstünde cümle olarak duruyor. */
    var cuvalNotu = YU.h("div", { sinif: "yu-hesap-ust" });

    var oNetUretim = hesapOgesi("Net dökme üretim");
    var oCekilecek = hesapOgesi("Silodan çekilecek");
    var oSatilan = hesapOgesi("Satılan dökme");

    var toplamDeger = YU.h("span", { sinif: "yu-hesap-toplam-deger", metin: "—" });

    /* Ayraçlar Şartname §4'ün formülünü okutur:
       Silo net değişimi = NetDokmeUretim − SilodanCekilecek − SatilanDokme */
    govde.appendChild(YU.h("div", { sinif: "yu-hesap" },
      cuvalNotu,
      YU.h("div", { sinif: "yu-hesap-satir" },
        oNetUretim.kok, hesapOku("−"),
        oCekilecek.kok, hesapOku("−"),
        oSatilan.kok
      ),
      YU.h("div", { sinif: "yu-hesap-toplam" },
        YU.h("span", { sinif: "yu-hesap-toplam-etiket", metin: "Silolara net etki" }),
        toplamDeger
      )
    ));

    var durumKap = YU.h("div");
    govde.appendChild(durumKap);

    /* ---------- 4. Silo dağıtımı — tek tablo ----------
       Eskiden üç ayrı panel vardı (yerleştirme / çuvallama çekişi / dökme satış
       çekişi) ve üçü de aynı silo tablosunu tekrarlıyordu. Şartname §4 gereği
       net dökme üretim ile silodan çekiş aynı gün ikisi birden dolu olamaz;
       yani ekranda hiçbir zaman üç giriş kolonu birden gerekmiyor. Tek tabloda
       silo başına tek satır tutuluyor, gerekmeyen kolon tamamen gizleniyor ve
       gün sonu bakiyesi doğru yerde — girenle çıkanın aynı satırında — duruyor. */

    var DAGITIM = [
      {
        kod: "uretim", yon: "giren", ust: "GİREN", ad: "Üretim", hepGoster: true,
        ariaAd: "Üretimden girecek",
        dugmeHepsi: "Tümü İlk Siloya", dugmeUygun: "En Boş Siloya",
        pasif: "Net dökme üretim 0 kg; bu gün siloya yerleştirme yapılamaz (D4)."
      },
      {
        kod: "cuvallama", yon: "cikan", ust: "ÇIKAN", ad: "Çuvallama", hepGoster: false,
        ariaAd: "Çuvallama için çıkacak",
        dugmeHepsi: "Tümü İlk Silodan", dugmeUygun: "En Dolu Silodan",
        pasif: "Çuvallama için silodan çıkış gerekmiyor (D6)."
      },
      {
        kod: "satis", yon: "cikan", ust: "ÇIKAN", ad: "Satış", hepGoster: true,
        ariaAd: "Satış için çıkacak",
        dugmeHepsi: "Tümü İlk Silodan", dugmeUygun: "En Dolu Silodan",
        pasif: "Satılan dökme 0 kg; silodan satış çıkışı gerekmiyor (D13)."
      }
    ];

    function dagitimKur() {
      var i, k;
      var satirlar = [], kartlar = [];

      /* Silo başına dikey kart: silonun gün başı, giren/çıkan alanları, gün sonu
         ve doluluğu tek blokta durur. Yatay tabloda bunlar satır boyunca dağılıp
         okunmuyordu; kart düzeninde bir silonun tüm hikâyesi tek yerde. */
      for (i = 0; i < silolar.length; i++) {
        (function (silo) {
          var alanlar = {}, kolonSatirlari = {};
          var yuzdeRozet = YU.h("span", { sinif: "yu-yardim" });
          var gunBasiDeger = YU.h("span", { sinif: "yu-silo-deger", metin: YU.fmt.kgU(gunBasi[silo.Id]) });

          var bas = YU.h("div", { sinif: "yu-silo-kart-bas" },
            YU.h("span", { sinif: "yu-silo-kart-ad", metin: silo.Ad }),
            yuzdeRozet
          );
          var gunBasiSatiri = YU.h("div", { sinif: "yu-silo-satir" },
            YU.h("span", { sinif: "yu-silo-etiket", metin: "Gün Başı" }),
            gunBasiDeger
          );

          var girisKap = YU.h("div", { sinif: "yu-silo-giris" });
          for (k = 0; k < DAGITIM.length; k++) {
            (function (d) {
              var a = YU.ui.alan({ tip: "sayi", sag: "kg", onInput: guncelle });
              a.girdi.setAttribute("aria-label", d.ariaAd + " · " + silo.Ad);
              /* "Hepsini Ekle" kutunun içine kolonKur'da yerleşir. */
              a.kok.style.flex = "1";
              a.kok.style.minWidth = "0";
              alanlar[d.kod] = a;
              var etiket = YU.h("span", { sinif: "yu-silo-etiket", stil: { flex: "none" } },
                YU.h("span", {
                  metin: d.yon === "giren" ? "↓ " : "↑ ",
                  stil: { color: d.yon === "giren" ? "var(--olumlu)" : "var(--olumsuz)", fontWeight: "600" }
                }),
                document.createTextNode(d.ad)
              );
              var satirEl = YU.h("div", { sinif: "yu-silo-satir yu-silo-alan" }, etiket, a.kok);
              kolonSatirlari[d.kod] = satirEl;
              girisKap.appendChild(satirEl);
            })(DAGITIM[k]);
          }

          var ayrac = YU.h("div", { sinif: "yu-ayrac yu-yatay" });
          var gunSonu = YU.h("span", { sinif: "yu-silo-sonu", metin: "—" });
          var sonuSatiri = YU.h("div", { sinif: "yu-silo-satir" },
            YU.h("span", { sinif: "yu-silo-etiket", metin: "Gün Sonu" }),
            gunSonu
          );
          var cubukKap = YU.h("div");
          var cubukAlt = YU.h("div", { sinif: "yu-yardim", metin: "—" });
          var dolulukKap = YU.h("div", { stil: { display: "flex", flexDirection: "column", gap: "5px" } }, cubukKap, cubukAlt);

          var kart = YU.h("div", { sinif: "yu-silo-kart" }, bas, gunBasiSatiri, girisKap, ayrac, sonuSatiri, dolulukKap);
          kartlar.push(kart);
          satirlar.push({
            silo: silo, alanlar: alanlar, kolonSatirlari: kolonSatirlari,
            gunSonu: gunSonu, cubukKap: cubukKap, cubukAlt: cubukAlt,
            yuzdeRozet: yuzdeRozet, ayrac: ayrac, girisKap: girisKap
          });
        })(silolar[i]);
      }

      /* Aralık sıfır: silolar arasındaki boşluk kartların kendi dolgusundan
         gelir, ayırıcı çizgi de tam ortada oturur. */
      var kartIzgara = YU.h("div", { sinif: "yu-izgara yu-iz-3", stil: { gap: "0", padding: "6px 0 10px" } });
      for (i = 0; i < kartlar.length; i++) kartIzgara.appendChild(kartlar[i]);

      /* Kartların altında ayrı durunca panele ait değilmiş gibi görünüyordu;
         kartların üstünde, zeminli ve kenarlıklı bir şerit olarak bağlandı. */
      /* Kalemler yan yana: girecek solda, çıkacak sağda; her bloğun düğmeleri
         kendi altında. Dar ekranda bloklar alt alta sarar. */
      var ozetKap = YU.h("div", {
        stil: {
          display: "flex", flexWrap: "wrap", alignItems: "stretch",
          background: "var(--yuzey-2)",
          borderBottom: "1px solid var(--ayrac)"
        }
      });
      var kolonlar = [];

      function kolonKur(d) {
        var gereken = 0, etkin = false;

        function alan(r) { return satirlar[r].alanlar[d.kod]; }

        function degerler() {
          var l = [], r;
          for (r = 0; r < satirlar.length; r++) l.push({ siloId: satirlar[r].silo.Id, miktar: alan(r).deger() });
          return l;
        }

        function toplam() {
          var t = 0, r, m;
          for (r = 0; r < satirlar.length; r++) { m = alan(r).deger(); if (isFinite(m)) t += m; }
          return YU.yuvarla(t);
        }

        function temizle() { for (var r = 0; r < satirlar.length; r++) alan(r).ayarla(""); }

        function yaz(dagilim) {
          for (var r = 0; r < satirlar.length; r++) {
            var m = YU.yuvarla(dagilim[satirlar[r].silo.Id] || 0);
            alan(r).ayarla(m > 0 ? m : "");
          }
        }

        function ilkSiloya() { var g = {}; g[satirlar[0].silo.Id] = gereken; yaz(g); }

        /* Tam kilograma bölünür, artık son siloya bırakılır: fabrikada siloya
           küsuratlı kilo yazılmaz, toplam yine birebir tutar (D3/D5/D13). */
        function esitDagit() {
          var n = satirlar.length, kalan = gereken, g = {}, r, pay, m;
          pay = Math.floor(gereken / n);
          for (r = 0; r < n; r++) {
            m = r === n - 1 ? YU.yuvarla(kalan) : pay;
            g[satirlar[r].silo.Id] = m;
            kalan = YU.yuvarla(kalan - m);
          }
          yaz(g);
        }

        /* Girişte en boş silo hedeflenir; çıkışta en dolu silodan başlanıp
           yetmedikçe sıradakine geçilir — tek silo D7'yi tetikliyorsa öneri
           baştan kullanılamaz olurdu. */
        function uygunSiloya() {
          var sirali = satirlar.slice().sort(function (a, b) {
            var fark = gunBasi[a.silo.Id] - gunBasi[b.silo.Id];
            return d.yon === "giren" ? fark : -fark;
          });
          var g = {}, kalan = gereken, r, m;
          if (d.yon === "giren") {
            g[sirali[0].silo.Id] = gereken;
          } else {
            for (r = 0; r < sirali.length && kalan > 0; r++) {
              m = Math.min(kalan, Math.max(0, gunBasi[sirali[r].silo.Id]));
              if (r === sirali.length - 1) m = kalan;   /* karşılıksız kalan görünsün diye son siloya yazılır */
              m = YU.yuvarla(m);
              if (m <= 0) continue;
              g[sirali[r].silo.Id] = m;
              kalan = YU.yuvarla(kalan - m);
            }
          }
          yaz(g);
        }

        function eylem(fn) {
          return function () { if (!etkin) return; fn(); guncelle(); };
        }

        var dugmeler = [
          YU.ui.dugme({ metin: d.dugmeHepsi, baslik: satirlar[0].silo.Ad, kucuk: true, tur: "ikincil", onClick: eylem(ilkSiloya) }),
          YU.ui.dugme({ metin: "Eşit Dağıt", kucuk: true, tur: "ikincil", onClick: eylem(esitDagit) }),
          YU.ui.dugme({ metin: d.dugmeUygun, kucuk: true, tur: "ikincil", onClick: eylem(uygunSiloya) }),
          YU.ui.dugme({ metin: "Temizle", kucuk: true, tur: "sade", onClick: eylem(temizle) })
        ];
        var dugmeKap = satir(yatay("6px"), dugmeler[0], dugmeler[1], dugmeler[2], dugmeler[3]);

        /* Her silo kutusunun içinde "Hepsini Ekle": gereken miktarın TAMAMI o
           siloya yazılır, bu kalemin öbür silo kutuları boşalır (kullanıcı
           isteği, 23.08.2026). */
        var satirDugmeleri = [];
        for (var r0 = 0; r0 < satirlar.length; r0++) {
          (function (sr) {
            var b = YU.ui.dugme({
              metin: "Hepsini Ekle", kucuk: true, tur: "sade",
              baslik: "Gereken miktarın tamamını " + sr.silo.Ad + " silosuna yaz",
              onClick: eylem(function () { var g = {}; g[sr.silo.Id] = gereken; yaz(g); })
            });
            kutuyaDugmeKoy(sr.alanlar[d.kod], b);
            satirDugmeleri.push(b);
          })(satirlar[r0]);
        }

        var yonNoktasi = YU.h("span", {
          stil: {
            width: "8px", height: "8px", borderRadius: "2px", flex: "none",
            background: d.yon === "giren" ? "var(--olumlu)" : "var(--olumsuz)"
          }
        });
        /* İki katmanlı etiket: üstte yön, altında kalem adı. */
        var etiketEl = YU.h("span", { stil: { display: "flex", flexDirection: "column", gap: "3px", minWidth: "96px", flex: "none" } },
          YU.h("span", { metin: d.yon === "giren" ? "Girecek" : "Çıkacak", stil: { font: "500 14.5px/1.15 var(--font)", color: "var(--metin)" } }),
          YU.h("span", { metin: d.ad, sinif: "yu-yardim" })
        );
        var toplamMetin = YU.h("span", { sinif: "yu-mono", stil: { fontSize: "15px", whiteSpace: "nowrap" } });
        var rozetKap = YU.h("span", { stil: { display: "inline-flex", flex: "none" } });
        /* Tutar ve rozet tek küme: satır sarsa bile birbirinden kopmazlar. */
        var degerKap = satir({ display: "flex", alignItems: "center", gap: "9px", flexWrap: "nowrap" }, toplamMetin, rozetKap);
        var basSatir = satir(yatay("12px"), yonNoktasi, etiketEl, degerKap);
        /* Blok = başlık satırı + altında düğmeler; bloklar ozetKap'ta yan yana. */
        var blok = YU.h("div", {
          stil: {
            display: "flex", flexDirection: "column", gap: "11px",
            flex: "1 1 320px", minWidth: "0", padding: "13px 18px"
          }
        }, basSatir, dugmeKap);
        ozetKap.appendChild(blok);

        /* Üretim ve satış kalemleri HER ZAMAN görünür (kullanıcı isteği,
           23.08.2026): gerekmiyorsa kutular ve düğmeler pasifleşir, tutar "—"
           olur. Çuvallama çekişi istisnadır, yalnız gerektiğinde belirir. */
        function kolonEtkin(acik) {
          var r;
          for (r = 0; r < satirlar.length; r++) {
            satirlar[r].alanlar[d.kod].girdi.disabled = !acik;
            /* "" değil "flex": satırın yerleşimi sınıfla kurulu ama gizleme
               inline yazıldığı için geri alınırken de inline "flex" yazılır. */
            satirlar[r].kolonSatirlari[d.kod].style.display = (acik || d.hepGoster) ? "flex" : "none";
          }
          for (r = 0; r < satirDugmeleri.length; r++) satirDugmeleri[r].disabled = !acik;
          for (r = 0; r < dugmeler.length; r++) dugmeler[r].disabled = !acik;
          blok.style.display = (acik || d.hepGoster) ? "flex" : "none";
        }

        function tazele(yeniGereken) {
          var sayisal = isFinite(yeniGereken);
          gereken = sayisal ? YU.yuvarla(yeniGereken) : 0;
          etkin = sayisal && gereken > tol;

          /* Gerek kalmadığında alanlar boşaltılır: dolu kalırsa D4/D6/D13 kesin
             hata verir, kullanıcı sebebini aramak zorunda kalır. */
          if (sayisal && !etkin) temizle();
          kolonEtkin(etkin);
          if (!etkin) {
            toplamMetin.textContent = "—";
            toplamMetin.style.color = "var(--metin-4)";
            YU.bos(rozetKap);
            return;
          }

          var girilen = toplam();
          var fark = YU.yuvarla(gereken - girilen);
          var tutuyor = Math.abs(fark) <= tol;
          toplamMetin.textContent = YU.fmt.kg(girilen) + " / " + YU.fmt.kg(gereken) + " kg";
          toplamMetin.style.color = tutuyor ? "var(--olumlu)" : "var(--olumsuz)";
          YU.bos(rozetKap).appendChild(YU.ui.rozet(
            tutuyor ? "Tutuyor" : (fark > 0 ? "Eksik " + YU.fmt.kgU(fark) : "Fazla " + YU.fmt.kgU(-fark)),
            tutuyor ? "olumlu" : "olumsuz"
          ));
        }

        return {
          kod: d.kod, degerler: degerler, yaz: yaz, tazele: tazele, blok: blok,
          etkinMi: function () { return etkin; }
        };
      }

      for (k = 0; k < DAGITIM.length; k++) kolonlar.push(kolonKur(DAGITIM[k]));

      /* Eski "Dağıtım" yer tutucu şeridi kalktı: üretim ve satış blokları artık
         hep görünür, gerekmiyorsa pasif (kullanıcı isteği, 23.08.2026). */

      var basRozet = YU.ui.rozet("—", "notr");

      var panel = YU.ui.panel({
        baslik: "Silo Dağıtımı",
        ikon: "#ic-building",
        sag: [basRozet],
        dolgusuz: true,
        govde: [ozetKap, kartIzgara]
      });

      function bul(kod) {
        for (var r = 0; r < kolonlar.length; r++) if (kolonlar[r].kod === kod) return kolonlar[r];
        return null;
      }

      function tazele(h) {
        var gerekenler = { uretim: h.netDokmeUretim, cuvallama: h.silodanCekilecek, satis: h.satilanDokme };
        var etkinSayi = 0, r, kol, deger;

        for (r = 0; r < kolonlar.length; r++) {
          kol = kolonlar[r];
          deger = gerekenler[kol.kod];
          kol.tazele(deger);
          if (kol.etkinMi()) etkinSayi++;
        }

        /* Yan yana bloklar arasında dikey ayraç: yalnız görünür olanların
           ilki çizgisiz kalır. */
        var ilkGorunur = true;
        for (r = 0; r < kolonlar.length; r++) {
          if (kolonlar[r].blok.style.display === "none") continue;
          kolonlar[r].blok.style.borderLeft = ilkGorunur ? "none" : "1px solid var(--ayrac)";
          ilkGorunur = false;
        }

        if (etkinSayi) {
          basRozet.className = "yu-rozet vurgu";
          basRozet.textContent = etkinSayi + " kalem";
        } else {
          basRozet.className = "yu-rozet notr";
          basRozet.textContent = "Gerek Yok";
        }
      }

      return {
        panel: panel,
        satirlar: satirlar,
        kolonlar: kolonlar,
        tazele: tazele,
        degerler: function (kod) { return bul(kod).degerler(); },
        yaz: function (kod, dagilim) { bul(kod).yaz(dagilim); }
      };
    }

    var dagitim = dagitimKur();
    govde.appendChild(dagitim.panel);

    /* Kayıtlı günü aç: silo hareketleri alanlara geri yazılır. */
    if (kayit) {
      dagitim.yaz("uretim", gunHareketleri(db, tarih, "DokmeUretim"));
      dagitim.yaz("cuvallama", gunHareketleri(db, tarih, "Cuvallama"));
      dagitim.yaz("satis", gunHareketleri(db, tarih, "DokmeSatis"));
    }

    /* ---------- 5. Alt bar — canlı doğrulama özeti + eylemler ---------- */

    var ozetBaslik = YU.h("div", { sinif: "yu-guclu", metin: "—" });
    var ozetAlt = YU.h("div", { sinif: "yu-yardim", metin: "" });

    var dugmeKaydet = YU.ui.dugme({
      metin: "Kaydet", ikon: "#ic-plus", tur: "birincil",
      baslik: "Ctrl + Enter",
      onClick: kaydet
    });

    var dugmeSil = silinebilir ? YU.ui.dugme({
      metin: "Günü Sil", ikon: "#ic-trash", tur: "tehlike", onClick: gunuSil
    }) : null;

    var altBar = YU.h("div", { sinif: "yu-panel", stil: yatay("14px") },
      YU.h("div", { stil: { flex: "1", minWidth: "240px" } }, ozetBaslik, ozetAlt),
      dugmeSil,
      dugmeKaydet
    );
    govde.appendChild(altBar);

    /* ---------- 6. Yardımcı paneller ---------- */

    /* "Bu Ekran Ne Yapar" paneli kaldırıldı (kullanıcı isteği); kalan iki
       panel ikili ızgarada tam genişliğe yayılıyor. */
    govde.appendChild(panelGunHareketleri());

    /* ---------- Canlı hesap ---------- */

    function girdiTopla() {
      return {
        tarih: tarih,
        uretilenDokme: uretilenAlan.deger(),
        cuvalAdet: cuvalAlan.deger(),
        satilanDokme: satilanAlan.deger(),
        yerlestirmeler: dagitim.degerler("uretim"),
        cekisler: dagitim.degerler("cuvallama"),
        satisCekisleri: dagitim.degerler("satis"),
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
      var r, k;
      for (r = 0; r < dagitim.satirlar.length; r++) {
        for (k = 0; k < DAGITIM.length; k++) boya(dagitim.satirlar[r].alanlar[DAGITIM[k].kod], false);
      }
    }

    function kolonBoya(kod, hataliMi) {
      for (var r = 0; r < dagitim.satirlar.length; r++) boya(dagitim.satirlar[r].alanlar[kod], hataliMi);
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
        else if (h.kod === "D13") { satilanAlan.hataGoster(h.mesaj); kolonBoya("satis", true); }
        else if (h.kod === "D3" || h.kod === "D4") kolonBoya("uretim", true);
        else if (h.kod === "D5" || h.kod === "D6") kolonBoya("cuvallama", true);
        else if (h.kod === "D7") {
          /* D7 çuvallama ve satış çıkışlarının TOPLAMI üzerinden ihlal edilir;
             aşan silonun iki çıkış hücresi de kırmızıya döner. */
          var asan = asanSilolar(girdi), r2, sr;
          for (r2 = 0; r2 < dagitim.satirlar.length; r2++) {
            sr = dagitim.satirlar[r2];
            if (!asan[sr.silo.Id]) continue;
            boya(sr.alanlar.cuvallama, true);
            boya(sr.alanlar.satis, true);
          }
        }
      }
    }

    /* Kap boşken gizlenir: görünür kalsaydı üstündeki hesap şeridi ile altındaki
       panel arasında ikinci bir 20px boşluk doğardı. */
    function durumGoster(serit) {
      durumKap.style.display = "";
      durumKap.appendChild(serit);
    }

    function durumTazele(h, girdi) {
      YU.bos(durumKap);
      durumKap.style.display = "none";
      var uretim = girdi.uretilenDokme, adet = girdi.cuvalAdet, satis = girdi.satilanDokme;

      if (!isFinite(uretim) || !isFinite(adet) || !isFinite(satis)) {
        durumGoster(YU.ui.serit({
          tur: "hata", baslik: "Sayısal Olmayan Bir Değer Var",
          metin: "Alanlara yalnızca sayı yazılır. Türkçe biçim kabul edilir: 1.234,56."
        }));
        return;
      }
      /* Henüz rakam girilmemiş gün için durum şeridi gösterilmez. */
      if (uretim === 0 && adet === 0 && satis === 0) return;

      /* Durum A normal akış: hesap şeridi ile silo dağıtımı tablosu zaten aynı
         bilgiyi rakamla veriyor, ayrıca bir bilgi şeridi göstermek gürültü olur.
         Durum B ise istisna — orada §4'ün "ham girdi kaybolmaz" kuralı anlatılıyor. */
      if (h.durum === "A") return;

      var seritB = YU.ui.serit({
        tur: "uyari",
        baslik: "Durum B — çuvallama üretimden fazla; fark silolardan çekilecek",
        metin: "Çuvallanan " + YU.fmt.kgU(h.cuvalKg) + " (" + YU.fmt.sayi(adet) + " çuval), üretilen dökmeden " +
          YU.fmt.kgU(uretim) + " fazla. Net dökme üretim 0; aradaki " + YU.fmt.kgU(h.silodanCekilecek) +
          " önceki günlerin silo stoğundan çekilir."
      });
      seritSatirlari(seritB, [
        "Ham girdi kaybolmaz: rapor net dökme üretimi 0 gösterir ama girdiğiniz " + YU.fmt.kgU(uretim) +
        " Günlük Rapor'da ayrı satır olarak durur (Şartname §4 — Raporlamada dikkat)."
      ]);
      durumGoster(seritB);
    }

    function hesapTazele(h, girdi) {
      var adet = girdi ? girdi.cuvalAdet : 0;
      cuvalNotu.textContent = (isFinite(adet) && adet > 0)
        ? "Çuvallanan " + YU.fmt.sayi(adet) + " adet = " + YU.fmt.kgU(h.cuvalKg) +
          " · bu miktar çuvallı kuru küspe üretimi sayılır, dökmeden düşülür"
        : "Çuvallama yok. 1 çuval = 50 kg sabittir.";

      oNetUretim.yaz(YU.fmt.kg(h.netDokmeUretim), h.netDokmeUretim > 0 ? "olumlu" : null);
      oCekilecek.yaz(YU.fmt.kg(h.silodanCekilecek), h.silodanCekilecek > 0 ? "bekleyen" : null);
      oSatilan.yaz(YU.fmt.kg(h.satilanDokme), h.satilanDokme > 0 ? "bekleyen" : null);

      var d = h.siloNetDegisim;
      toplamDeger.textContent = (isFinite(d) && d > 0 ? "+" : "") + YU.fmt.kg(d) + " kg";
      toplamDeger.className = "yu-hesap-toplam-deger" +
        (!isFinite(d) ? "" : (d > 0 ? " olumlu" : (d < 0 ? " olumsuz" : "")));
    }

    /* Gün sonu bakiyesi giren ve çıkanların hepsinden doğar; tek tabloda tek
       satır olduğu için artık aynı silo için tek bir yerde gösteriliyor. */
    function gunSonuTazele(girdi) {
      var yer = siloBazinda(girdi.yerlestirmeler);
      var cek = siloBazinda(girdi.cekisler);
      var sat = siloBazinda(girdi.satisCekisleri);
      var r, sr, id, sonu, kapasite, oran;

      for (r = 0; r < dagitim.satirlar.length; r++) {
        sr = dagitim.satirlar[r];
        id = sr.silo.Id;
        sonu = YU.yuvarla(gunBasi[id] + (yer[id] || 0) - (cek[id] || 0) - (sat[id] || 0));
        kapasite = Number(sr.silo.Kapasite) || 0;
        sr.gunSonu.textContent = YU.fmt.kgU(sonu);
        sr.gunSonu.style.color = sonu < -tol || (kapasite > 0 && sonu - kapasite > tol)
          ? "var(--olumsuz)"      /* aşım artık hata: D15 sert engel */
          : "";

        oran = kapasite > 0 ? sonu / kapasite : 0;
        YU.bos(sr.cubukKap).appendChild(YU.ui.cubuk(oran,
          sonu < -tol || (kapasite > 0 && sonu > kapasite) ? "olumsuz" : (oran >= 0.9 ? "bekleyen" : "vurgu")));
        /* Yüzde kart başlığında duruyor; altta yalnız kapasite kalıyor ki
           aynı bilgi iki kez yazılmasın. */
        sr.yuzdeRozet.textContent = kapasite > 0 ? YU.fmt.yuzde(oran * 100) : "kapasite yok";
        sr.yuzdeRozet.style.color = sonu < -tol || (kapasite > 0 && sonu - kapasite > tol)
          ? "var(--olumsuz)"
          : "";
        sr.cubukAlt.textContent = kapasite > 0 ? "kapasite " + YU.fmt.ton(kapasite) : "kapasite tanımsız";
      }
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

    function ozetTazele(girdi) {
      var d = canliDenetim(girdi);
      var h = d.hatalar.length, u = d.uyarilar.length;

      /* Engelleyen kural varken Kaydet BASILAMAZ (kullanıcı kararı,
         21.08.2026): önce düzeltme, sonra kayıt. */
      dugmeKaydet.disabled = h > 0;
      dugmeKaydet.title = h > 0 ? "Önce hataları düzeltin — kayıt engellendi." : "Ctrl + Enter";

      if (!h && !u) {
        ozetBaslik.textContent = "Kayda hazır — engelleyen kural yok.";
        ozetBaslik.style.color = "var(--olumlu)";
        ozetAlt.textContent = "Ctrl + Enter ile de kaydedebilirsiniz.";
        return;
      }

      var parcalar = [];
      if (h) parcalar.push(h === 1 ? "1 hata" : h + " hata");
      if (u) parcalar.push(u === 1 ? "1 uyarı" : u + " uyarı");
      var kodlar = kodListesi(h ? d.hatalar : d.uyarilar);
      ozetBaslik.textContent = parcalar.join(" · ") + " — " + kodlar.join(", ");
      ozetBaslik.style.color = h ? "var(--olumsuz)" : "var(--bekleyen)";
      ozetAlt.textContent = (h ? d.hatalar[0] : d.uyarilar[0]).mesaj;
    }

    function guncelle() {
      boyalariSil();
      var ilk = girdiTopla();
      var h = YU.hesap.kuruKuspe(ilk.uretilenDokme, ilk.cuvalAdet, ilk.satilanDokme);

      dagitim.tazele(h);

      /* Gruplar gereksiz alanları boşaltmış olabilir; özet güncel değerle kurulur. */
      var girdi = girdiTopla();
      hesapTazele(h, girdi);
      durumTazele(h, girdi);
      gunSonuTazele(girdi);
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
            baslik: "Kayıt Değişti — Yenilemeniz Gerekiyor",
            metin: "Siz bu ekranı açtıktan sonra bu gün başka bir oturumda güncellendi. Yazdıklarınız kaydedilmedi; ekranı yenileyip güncel değerlerin üzerine çalışın (D16).",
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

      if (h.netDokmeUretim > 0 && yerlesme) satirlar.push("Net dökme üretim " + YU.fmt.kgU(h.netDokmeUretim) + ", " + yerlesme + ".");
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
        metin: YU.fmt.tarih(tarih) + " gününe ait TÜM girişler silinir: kuru küspe günlük kaydı, o güne ait silo hareketleri ve malzeme hareketleri. " +
          "İşlem geri alınamaz. D14 gereği silme sonrası sonraki günlerden biri negatife düşüyorsa istek reddedilir."
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

    /* Klavye: alanlar arasında Tab akışı DOM sırasıyla gider (tarih → ham
       girdiler → yerleştirme → çekiş → satış → eylemler), Ctrl+Enter kaydeder. */
    govde.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        kaydet();
      }
    });

    /* ---------- Yardımcı paneller ---------- */

    function panelGunHareketleri() {
      var ozet = YU.stok.gunOzeti(db, tarih);
      var satirlar = [], i2, h, giren, cikan;

      /* Kim, saat kaçta kaydetti — gün yazılmaz, panel zaten tek güne ait
         (kullanıcı isteği, 21.08.2026). */
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

      var govde = [
        YU.ui.tablo({
          sutunlar: [
            { baslik: "Silo" },
            { baslik: "Hareket" },
            { baslik: "Giren", hiza: "sag", mono: true, genislik: 96 },
            { baslik: "Çıkan", hiza: "sag", mono: true, genislik: 96 },
            { baslik: "Kaydeden", hiza: "sag" }
          ],
          satirlar: satirlar,
          kompakt: true,
          bos: "Bu güne ait silo hareketi yok. Kaydettiğinizde burada listelenir."
        })
      ];

      if (ozet.kuruKuspe) {
        govde.push(notMetni(
          "Ham girdi: üretilen dökme " + YU.fmt.kgU(ozet.hesap.hamUretilenDokme) + " · " +
          YU.fmt.sayi(ozet.kuruKuspe.CuvalAdet) + " çuval (" + YU.fmt.kgU(ozet.kuruKuspe.CuvalKg) + ") · satılan dökme " +
          YU.fmt.kgU(ozet.kuruKuspe.SatilanDokme) + "."
        ));
      }

      return YU.ui.panel({
        baslik: "Günün Silo Hareketleri",
        ikon: "#ic-building",
        sag: YU.ui.rozet(YU.fmt.tarih(tarih), "notr"),
        govde: govde
      });
    }

    guncelle();
    if (!kayit) uretilenAlan.odakla();
  }
})();

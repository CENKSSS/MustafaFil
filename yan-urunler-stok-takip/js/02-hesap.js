/* 02-hesap.js — kuru küspe saf hesabı (Şartname §4, DEMİRBAŞ · SOZLESME.md §3).
   Depoya, DOM'a ve tarihe dokunmaz: girdi sayı, çıktı sayı.

   Şartname §4 örnekleri:

   Durum A — üretim çuvallamadan fazla   (250.000 kg dökme · 200 çuval)
     CuvalKg          = 200 × 50 = 10.000
     NetDokmeUretim   = max(0, 250.000 − 10.000) = 240.000   -> silolara yerleşir
     SilodanCekilecek = max(0, 10.000 − 250.000) = 0
     durum            = 'A'

   Durum B — çuvallama üretimden fazla   (5.000 kg dökme · 200 çuval)
     CuvalKg          = 200 × 50 = 10.000
     NetDokmeUretim   = max(0, 5.000 − 10.000) = 0
     SilodanCekilecek = max(0, 10.000 − 5.000) = 5.000       -> silolardan çekilir
     durum            = 'B'                                   (ham 5.000 raporda kalır) */
(function () {
  "use strict";

  var YU = (window.YU = window.YU || {});

  // Boş alan 0 demektir (YU.parse.sayi ile aynı davranış); anlamsız girdi ise
  // NaN olarak korunur — 0'a çevrilirse D1/D3/D13 hatayı göremez.
  function sayiya(deger) {
    if (typeof deger === "number") return deger;
    if (deger === null || deger === undefined || deger === "") return 0;
    if (typeof deger === "string" && YU.parse && YU.parse.sayi) return YU.parse.sayi(deger);
    return Number(deger);
  }

  var hesap = {
    CUVAL_KG: 50,
    /* Silo kapasitesi SABİTTİR (kullanıcı kararı, 28.08.2026: "sabit her
       seferinde 3 bin ton kapasitesi var siloların"). Ekran ve servis bu
       sabiti okur; kapasite alanı artık değiştirilemez. */
    SILO_KAPASITE_KG: 3000000,
    /* Şartname §2: yaş küspe tonluk büyük torbada veya 25 kg'lık poşette
       satılır. BİLGİ OLARAK DURUR — 02.09.2026'dan beri hiçbir doğrulama
       veya ekran bu sabiti okumaz; 25'in katı olma kuralı kaldırıldı. */
    POSET_KG: 25,
    TOLERANS: 0.01
  };

  hesap.esit = function (a, b) {
    return Math.abs(Number(a) - Number(b)) <= hesap.TOLERANS;
  };

  /* ÇUVALLANAN ARTIK DOĞRUDAN KG (kullanıcı kararı, 02.09.2026: "50 ve
     katları kuralını kaldır, 238 kg de yazılabilsin; hiçbir yerde adet
     yazmasın"). İkinci parametre eskiden çuval ADEDİ idi ve kg = adet × 50
     ile bulunuyordu; artık kg'ın kendisidir. Adet ara birim olmaktan çıktı. */
  hesap.kuruKuspe = function (uretilenDokme, cuvallananKg, satilanDokme) {
    var uretim = sayiya(uretilenDokme);
    var satis = sayiya(satilanDokme);

    var cuvalKg = YU.yuvarla(sayiya(cuvallananKg));
    var netDokmeUretim = YU.yuvarla(Math.max(0, uretim - cuvalKg));
    var silodanCekilecek = YU.yuvarla(Math.max(0, cuvalKg - uretim));
    var satilan = YU.yuvarla(satis);

    return {
      cuvalKg: cuvalKg,
      netDokmeUretim: netDokmeUretim,
      silodanCekilecek: silodanCekilecek,
      satilanDokme: satilan,
      siloNetDegisim: YU.yuvarla(netDokmeUretim - silodanCekilecek - satilan),
      durum: uretim >= cuvalKg ? "A" : "B"
    };
  };

  /* Bir KuruKuspeGunluk kaydının çuvallanan kg'ı. 02.09.2026 öncesi kayıtlarda
     CuvalKg boş olabilir; o zaman eski alan CuvalAdet × 50 ile okunur. Yeni
     kayıtlarda CuvalKg operatörün yazdığı rakamdır, CuvalAdet ondan türer. */
  hesap.kayitCuvalKg = function (kayit) {
    if (!kayit) return 0;
    var kg = kayit.CuvalKg;
    if (kg !== null && kg !== undefined && kg !== "" && !isNaN(Number(kg))) return Number(kg);
    return YU.yuvarla((Number(kayit.CuvalAdet) || 0) * hesap.CUVAL_KG);
  };

  /* Bir girdideki çuvallanan miktarı KG olarak okur. Yeni çağrılar cuvalKg
     gönderir; cuvalAdet gönderen eski çağrılar (tohum verisi) 50 ile çarpılır.
     Tek okuma yeri olsun diye burada durur — doğrulama, servis ve ekran
     aynı dili konuşur (02.09.2026). */
  hesap.girdiCuvalKg = function (girdi) {
    if (!girdi) return 0;
    var kg = girdi.cuvalKg;
    if (kg !== undefined && kg !== null && kg !== "") return sayiya(kg);
    var adet = girdi.cuvalAdet;
    if (adet === undefined || adet === null || adet === "") return 0;
    var a = sayiya(adet);
    return isNaN(a) ? a : YU.yuvarla(a * hesap.CUVAL_KG);
  };

  YU.hesap = hesap;
})();

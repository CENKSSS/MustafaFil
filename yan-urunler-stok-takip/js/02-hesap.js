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
    TOLERANS: 0.01
  };

  hesap.esit = function (a, b) {
    return Math.abs(Number(a) - Number(b)) <= hesap.TOLERANS;
  };

  hesap.kuruKuspe = function (uretilenDokme, cuvalAdet, satilanDokme) {
    var uretim = sayiya(uretilenDokme);
    var adet = sayiya(cuvalAdet);
    var satis = sayiya(satilanDokme);

    var cuvalKg = YU.yuvarla(adet * hesap.CUVAL_KG);
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

  YU.hesap = hesap;
})();

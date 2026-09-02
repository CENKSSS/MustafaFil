/* js/03-dogrulama.js — DogrulamaKurallari
   Şartname §8 (D1–D16, DEMİRBAŞ) · SÖZLEŞME §4
   Bu dosya depoyu YAZMAZ; yalnızca okur ve {hatalar, uyarilar} döndürür. */
(function () {
  "use strict";

  var YU = window.YU;

  /* Şartnamede kural numarası olmayan alan denetimleri (boş ad, geçersiz tarih,
     bilinmeyen kayıt) bu kodla döner; D-kuralları kendi kodunu taşır. */
  var ALAN = "Alan";

  var KURALLAR = [
    { kod: "D1", tur: "Hata", metin: "Üretilen dökme küspe negatif olamaz." },
    { kod: "D2", tur: "Hata", metin: "Çuval adedi negatif olamaz." },
    { kod: "D3", tur: "Hata", metin: "Silolara yerleştirilen toplam, net dökme üretime eşit olmalı (±0,01 kg tolerans)." },
    { kod: "D4", tur: "Hata", metin: "Net dökme üretim 0 iken siloya yerleştirme yapılamaz." },
    { kod: "D5", tur: "Hata", metin: "Silolardan çekilen toplam, hesaplanan çekiş miktarına eşit olmalı (±0,01 kg)." },
    { kod: "D6", tur: "Hata", metin: "Çekiş gerekmiyorken silodan çekiş girilemez." },
    { kod: "D7", tur: "Hata", metin: "Bir silodan, o gün başındaki mevcudundan fazlası çekilemez. Çekiş kavramı iki kalemi birden kapsar: çuvallama çekişi + satış çekişi." },
    { kod: "D8", tur: "Upsert", metin: "Aynı gün + aynı malzeme için ikinci kayıt açılamaz (güncelleme yapılır)." },
    { kod: "D9", tur: "Engelle", metin: "Kullanıcı kendi hesabını pasifleştiremez." },
    { kod: "D10", tur: "Engelle", metin: "Sistemdeki son aktif yönetici pasifleştirilemez veya operatöre düşürülemez." },
    { kod: "D11", tur: "Hata", metin: "Aynı kullanıcı adı iki kez eklenemez." },
    { kod: "D12", tur: "Tasarim", metin: "Kullanıcı ve malzeme silinmez, yalnızca pasifleştirilir." },
    { kod: "D13", tur: "Hata", metin: "Dökme satış için silolardan çekilen toplam, girilen SatilanDokme değerine eşit olmalı (±0,01 kg)." },
    { kod: "D14", tur: "Hata", metin: "Kayıt veya silme sonrası, işlem tarihinden son kayıtlı güne kadar her silonun bakiyesi ileri doğru hesaplanır. Herhangi bir gün negatife düşüyorsa işlem reddedilir ve hangi silonun hangi tarihte patladığı söylenir." },
    { kod: "D15", tur: "Hata", metin: "Bir silonun gün sonu bakiyesi o silonun kapasitesini aşamaz — kayıt engellenir. Aşım gerçekse operatör GEREKÇE yazarak kaydı geçirebilir; gerekçe denetim izine düşer ve uyarıya dönüşür. (Kullanıcı kararı, 21.08.2026; gerekçeli kabul kapısı 25.08.2026 — şartname v2'de yumuşak uyarıydı.)" },
    { kod: "D16", tur: "Hata", metin: "Kayıt güncellenirken RowVersion değeri okunduğu andakinden farklıysa işlem reddedilir; kullanıcıya kaydın değiştiği söylenir ve yenilemesi istenir." },
    { kod: "D17", tur: "Hata", metin: "Gelecek bir tarihe üretim veya satış kaydı girilemez. Henüz gerçekleşmemiş bir günün rakamı olamaz. (Şartnamede yok — prototipte eklendi.)" },
    { kod: "D18", tur: "Hata", metin: "Kampanya başlangıcından (en eski devir tarihinden) önceki bir güne kayıt girilemez: o hareketler stok hesabına girmez, görünmez veri olur. (Şartnamede yok — prototipte eklendi; devir hiç tanımlı değilse kural uygulanmaz.)" }
  ];

  /* ---------- küçük yardımcılar ---------- */

  /* D17 — şartnamede yok, prototipte eklendi. Gelecek bir güne üretim/satış
     kaydı fiilen imkânsız; "Sonraki gün" düğmesine üst üste basıp farkında
     olmadan yarına kayıt açmayı engelliyor. Devir stok bu kuralın dışında:
     gelecek kampanyanın devri önceden tanımlanabilir. */
  function gelecekTarihMi(tarih) {
    return gecerliTarih(tarih) && tarih > YU.tarih.bugun();
  }

  function d17(tarih) {
    return kayit("D17", "Gelecek tarihe kayıt girilemez: " + YU.fmt.tarih(tarih) +
      " bugünden (" + YU.fmt.tarih(YU.tarih.bugun()) + ") sonra. Henüz gerçekleşmemiş bir günün üretimi veya satışı kaydedilemez.");
  }

  /* D18 — şartnamede yok, prototipte eklendi (DUZELTME-PLANI M14). En eski
     devirden önceki güne yazılan hareket stok hesabına girmez ("en son devir"
     formülü bakiyeyi devirde sıfırlar, Şartname §5) — görünmez "hayalet" veri
     olurdu. Devir hiç yoksa kural uygulanmaz: kabul testleri devirsiz temiz
     depoyla koşar (Şartname §9), o akış aynen korunur. */
  function enEskiDevir(depo) {
    var en = null, i, t;
    for (i = 0; i < depo.devirStok.length; i++) {
      t = depo.devirStok[i].DevirTarihi;
      if (t && (en === null || t < en)) en = t;
    }
    for (i = 0; i < depo.siloDevirStok.length; i++) {
      t = depo.siloDevirStok[i].DevirTarihi;
      if (t && (en === null || t < en)) en = t;
    }
    return en;
  }

  function d18Kontrol(depo, tarih, hatalar) {
    var en = enEskiDevir(depo);
    if (en !== null && gecerliTarih(tarih) && tarih < en) {
      hatalar.push(kayit("D18", tr(tarih) + " gününe kayıt girilemez: kampanya başlangıcı (en eski devir) " +
        tr(en) + ". Bu tarihten önceki hareketler stok hesabına girmez."));
      return true;
    }
    return false;
  }

  function kayit(kod, mesaj) { return { kod: kod, mesaj: mesaj }; }
  function kg(n) { return YU.fmt.kgU(n); }

  function gecerliTarih(iso) {
    return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  /* Geçersiz tarihte de mesaj basılabilsin diye biçimlendirme korumalı. */
  function tr(iso) {
    return gecerliTarih(iso) ? YU.fmt.tarih(iso) : String(iso === null || iso === undefined ? "—" : iso);
  }

  function oku(v) {
    if (v === null || v === undefined || v === "") return 0;
    var n = typeof v === "number" ? v : YU.parse.sayi(String(v));
    return isFinite(n) ? YU.yuvarla(n) : NaN;
  }

  function kimlik(v) {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function esit(a, b) { return YU.hesap.esit(a, b); }
  function tolerans() { return YU.hesap.TOLERANS; }

  function bosMu(v) { return v === null || v === undefined || String(v).trim() === ""; }

  /* Türkçe 'I/ı' ayrımı yüzünden tekillik karşılaştırması tr yerelinde yapılır. */
  function anahtarla(metin) {
    return String(metin === null || metin === undefined ? "" : metin).trim().toLocaleLowerCase("tr");
  }

  function satirBul(tablo, id) {
    var i;
    for (i = 0; i < tablo.length; i++) if (tablo[i].Id === id) return tablo[i];
    return null;
  }

  function kuruKuspeGunuBul(depo, tarih) {
    var i;
    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      if (depo.kuruKuspeGunluk[i].Tarih === tarih) return depo.kuruKuspeGunluk[i];
    }
    return null;
  }

  function gunlukHareketBul(depo, tarih, malzemeId) {
    var i, h;
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.Tarih === tarih && h.MalzemeId === malzemeId) return h;
    }
    return null;
  }

  function toplamMiktar(satirlar) {
    var t = 0, i, n;
    if (!satirlar) return 0;
    for (i = 0; i < satirlar.length; i++) {
      n = oku(satirlar[i].miktar);
      if (!isNaN(n)) t += n;
    }
    return YU.yuvarla(t);
  }

  /* siloId -> miktar toplamı. Aynı silo için birden çok satır girilebilir. */
  function siloBazinda(satirlar, hedef) {
    var i, id, n;
    if (!satirlar) return hedef;
    for (i = 0; i < satirlar.length; i++) {
      id = kimlik(satirlar[i].siloId);
      if (id === null) continue;
      n = oku(satirlar[i].miktar);
      if (isNaN(n)) n = 0;
      hedef[id] = YU.yuvarla((hedef[id] || 0) + n);
    }
    return hedef;
  }

  function anahtarBirlesimi() {
    var kume = {}, sonuc = [], i, k, o;
    for (i = 0; i < arguments.length; i++) {
      o = arguments[i];
      for (k in o) {
        if (Object.prototype.hasOwnProperty.call(o, k) && !kume[k]) {
          kume[k] = true;
          sonuc.push(Number(k));
        }
      }
    }
    sonuc.sort(function (a, b) { return a - b; });
    return sonuc;
  }

  function negatifSatirlar(satirlar, kod, etiket, hatalar) {
    var i, n;
    if (!satirlar) return;
    for (i = 0; i < satirlar.length; i++) {
      n = oku(satirlar[i].miktar);
      if (!isNaN(n) && n < 0) {
        hatalar.push(kayit(kod, etiket + " miktarı negatif olamaz. Girilen: " + kg(n) + "."));
        return;
      }
    }
  }

  /* Silo satırlarının buçuk denetimi — tamSayiDenetle'nin liste hâli. */
  function tamSayiSatirlar(satirlar, etiket, hatalar) {
    var i, n;
    if (!satirlar) return;
    for (i = 0; i < satirlar.length; i++) {
      n = oku(satirlar[i].miktar);
      if (!isNaN(n) && n !== Math.round(n)) {
        /* Aynı harman (28.08.2026): kısa cümle + girilen rakam. */
        hatalar.push(kayit(ALAN, etiket + " tam sayı olmalı. Girilen " + sayiKisa(n) + "."));
        return;
      }
    }
  }

  /* ---------- D14 motoru: ileri bakiye ---------- */

  /* taslak = {tarih, kuruKuspeSilTarihi, yeniHareketler:[{siloId,GirenKg,CikanKg}], silTarih}
     taslak null ise depo bugünkü hâliyle taranır (Silo Durumu uyarı satırı).
     Her silo için gün gün tek geçiş yapılır; negatife düşen İLK gün döner.
     kuruKuspeSilTarihi: kuru küspe yeniden kaydı artık o günün Manuel DIŞI
     tüm silo hareketlerini siler (kullanıcı kararı, 27.08.2026 — eski
     KaynakKayitId süzgeci yetim satırı yaşatıyordu); önizleme aynısını yapar. */
  function ileriYurut(depo, baslangicTarih, taslak, sinama) {
    var netler = {};   // siloId -> {tarih: netDegisim}
    var i, h, siloId, tarih, y;
    var kkSilTarih = taslak && taslak.kuruKuspeSilTarihi ? taslak.kuruKuspeSilTarihi : null;
    var silTarih = taslak && taslak.silTarih ? taslak.silTarih : null;

    function ekle(id, gun, deger) {
      var g = netler[id] || (netler[id] = {});
      g[gun] = YU.yuvarla((g[gun] || 0) + deger);
    }

    for (i = 0; i < depo.siloHareket.length; i++) {
      h = depo.siloHareket[i];
      /* Manuel satır yeniden kayıtta silinmez (M16) — önizleme de silmesin;
         gün silme (silTarih) ise günü komple kaldırır, Manuel dahil. */
      if (kkSilTarih !== null && h.Tarih === kkSilTarih &&
          h.HareketTipi !== "Manuel") continue;
      if (silTarih !== null && h.Tarih === silTarih) continue;
      ekle(h.SiloId, h.Tarih, YU.yuvarla((Number(h.GirenKg) || 0) - (Number(h.CikanKg) || 0)));
    }

    if (taslak && taslak.yeniHareketler) {
      for (i = 0; i < taslak.yeniHareketler.length; i++) {
        y = taslak.yeniHareketler[i];
        siloId = kimlik(y.siloId);
        if (siloId === null) continue;
        ekle(siloId, taslak.tarih, YU.yuvarla((Number(y.GirenKg) || 0) - (Number(y.CikanKg) || 0)));
      }
    }

    /* Devirler bakiyeyi o günün başında SIFIRLAR (Şartname §5 "en son devir"). */
    var devirler = {};
    for (i = 0; i < depo.siloDevirStok.length; i++) {
      h = depo.siloDevirStok[i];
      (devirler[h.SiloId] || (devirler[h.SiloId] = {}))[h.DevirTarihi] = Number(h.Miktar) || 0;
    }

    var sonuc = [];
    var anahtar;

    for (anahtar in netler) {
      if (!Object.prototype.hasOwnProperty.call(netler, anahtar)) continue;
      siloId = Number(anahtar);
      var gunler = netler[anahtar];
      var devir = devirler[anahtar] || {};
      var takvim = [], g;
      for (g in gunler) if (Object.prototype.hasOwnProperty.call(gunler, g)) takvim.push(g);
      for (g in devir) {
        if (Object.prototype.hasOwnProperty.call(devir, g) &&
            !Object.prototype.hasOwnProperty.call(gunler, g)) takvim.push(g);
      }
      takvim.sort();                      // ISO metin sırası = kronolojik sıra

      var bakiye = 0;
      for (i = 0; i < takvim.length; i++) {
        tarih = takvim[i];
        if (Object.prototype.hasOwnProperty.call(devir, tarih)) bakiye = devir[tarih];
        bakiye = YU.yuvarla(bakiye + (gunler[tarih] || 0));
        if (!baslangicTarih || tarih >= baslangicTarih) {
          var bulgu = sinama(siloId, tarih, bakiye);
          if (bulgu) { sonuc.push(bulgu); break; }   // silo başına ilk patlama yeter
        }
      }
    }

    sonuc.sort(function (a, b) {
      if (a.tarih !== b.tarih) return a.tarih < b.tarih ? -1 : 1;
      return a.siloId - b.siloId;
    });
    return sonuc;
  }

  /* Negatife düşen ilk günü döndürür — D14'ün eski davranışı, birebir. */
  function ileriBakiye(depo, baslangicTarih, taslak) {
    var tol = tolerans();
    return ileriYurut(depo, baslangicTarih, taslak, function (siloId, tarih, bakiye) {
      if (bakiye >= -tol) return null;
      var silo = satirBul(depo.silolar, siloId);
      return {
        siloId: siloId,
        siloAd: silo ? silo.Ad : "Silo #" + siloId,
        tarih: tarih,
        bakiye: bakiye
      };
    });
  }

  /* KAPASİTEYİ AŞAN ilk günü döndürür (kullanıcı direktifi, 28.08.2026:
     "düzeltmeden sonraki ileriye dönük veriler hesaplanıp negatif ya da
     kapasite aşımı varsa kayıt onaylanmamalı — tüm sayfalarda").

     Eskiden D15 YALNIZ düzenlenen günün sonunu ölçüyordu; ölçüldü:
     geçmiş bir güne 50.000 kg eklemek ileri bir günü 3.049.000 kg'a
     çıkarıyor ve kayıt KABUL ediliyordu (kapasite 3.000.000). Negatif
     tarafında bu boşluk yoktu — D14 zaten gün gün ileri yürüyordu.
     Artık ikisi aynı takvimi yürür (ileriYurut). */
  function ileriKapasite(depo, baslangicTarih, taslak) {
    var tol = tolerans();
    return ileriYurut(depo, baslangicTarih, taslak, function (siloId, tarih, bakiye) {
      var silo = satirBul(depo.silolar, siloId);
      var kap = silo ? (Number(silo.Kapasite) || 0) : 0;
      if (!(kap > 0) || bakiye - kap <= tol) return null;
      return {
        siloId: siloId,
        siloAd: silo ? silo.Ad : "Silo #" + siloId,
        tarih: tarih,
        bakiye: bakiye,
        kapasite: kap
      };
    });
  }

  /* D15'in ileri günler için mesajı — D14'ün d14Mesaji kalıbıyla aynı. */
  function d15IleriMesaji(n) {
    return n.siloAd + ": " + tr(n.tarih) + " günü stok " + kg(n.bakiye) +
      " olur; kapasite " + kg(n.kapasite) + ".";
  }

  /* Kapasite aşımı gerekçesi (M32). En az 10 karakter: "ok", "olsun" gibi
     boş geçiştirmeler denetim izinde işe yaramaz. */
  var GEREKCE_ENAZ = 10;

  function kapasiteGerekcesi(girdi) {
    return String(girdi && girdi.kapasiteGerekcesi !== undefined && girdi.kapasiteGerekcesi !== null
      ? girdi.kapasiteGerekcesi : "").trim();
  }

  /* GEREKÇE KAPISI KAPATILDI (kullanıcı direktifi, 27.08.2026: "kapasite
     aşımı da olamaz, bu yasak olmalı"). M32 (25.08.2026) kapasite aşımını
     gerekçeyle geçirilebilir yapmıştı — o karar geri alındı: D15 artık her
     durumda HATA, hiçbir gerekçe kaydı geçirmez. Fonksiyon tek çıkış
     noktasıdır; false döndüğü sürece 03 ve 04'teki bütün D15 yolları sert
     engel uygular. Girdi sözleşmesindeki kapasiteGerekcesi alanı okunmaya
     devam eder ama sonucu değiştirmez. */
  function kapasiteGerekcesiGecerli() {
    return false;
  }

  function d14Mesaji(n) {
    /* Kısaltıldı (kullanıcı isteği, 26.08.2026): "Sonraki günler negatife
       düştüğü için işlem reddedildi" cümlesi kuralı anlatıyordu, olayı değil.
       Panel başlığı kaydın geçmediğini zaten söylüyor, Kaydet de pasif.
       Kalan bilgi: hangi silo, hangi gün, hangi bakiye.
       SADELEŞTİRİLDİ (kullanıcı isteği, 27.08.2026): "·" ve "—" ayraçları ile
       "'a düşüyor" kalıbı kalktı. Kalıp artık her hatada aynı: "Silo N:"
       önekiyle başlar, ekranda o önek hizalı bir sütun olarak çizilir. */
    return n.siloAd + ": " + tr(n.tarih) + " günü stok " + kg(n.bakiye) + " oluyor.";
  }

  /* PAKET KATI KURALI KALDIRILDI (kullanıcı kararı, 02.09.2026:
     "25 ve 50 kiloluk değer girilsin veya çıkılsın kuralını da kaldır").
     27.08.2026'da çuvallı kuru küspenin 50'nin, Yaş Küspe (25'lik)'in 25'in
     katı olması zorunluydu; artık her miktar serbesttir. Tam sayı kuralı
     (tamSayiDenetle) yerinde durur — kaldırılan yalnız KAT kuralıdır. */

  /* BUÇUKLU DEĞER YASAĞI (kullanıcı kararı, 27.08.2026): tüm miktarlar tam
     sayıdır — terazi kg altını ölçmez, çuval 50/25 kg'dır. Tam sayı girdide
     kayan nokta kiri de oluşmaz; 0,01 toleransı yalnız türetilmiş hesaplara
     kalır (−0,01'lik sınır deliği böyle kapandı). null/NaN'a karışmaz —
     onları kendi kuralları (D1, D2, "sayı olmalı") yakalar. */
  /* Buçuklu rakamı gereksiz sıfırla yazmaz: 1,500 -> 1,5 (28.08.2026).
     Binlik ayracı nokta olduğu için kırpma YALNIZ virgülden sonra yapılır. */
  function sayiKisa(n) {
    var s = YU.fmt.sayi(n, 3);
    if (s.indexOf(",") < 0) return s;
    return s.replace(/0+$/, "").replace(/,$/, "");
  }

  function tamSayiDenetle(hatalar, etiket, deger) {
    if (deger === null || deger === undefined || isNaN(deger)) return;
    if (deger === Math.round(deger)) return;
    /* "Girilen …" GERİ GELDİ (kullanıcı isteği, 28.08.2026: "girilen değeri
       yazması güzel oluyordu, kalsın"). Kuyruğun uzun yarısı ("buçuklu değer
       girilemez") gitti, rakam kaldı — hangi satırın suçlu olduğu da böyle
       görünür. */
    hatalar.push(kayit(ALAN, etiket + " tam sayı olmalı. Girilen " + sayiKisa(deger) + "."));
  }

  /* ---------- Kuru küspe günlük kaydı: D1–D7, D13, D15, D16 ---------- */

  function kuruKuspeKaydi(depo, girdi) {
    var hatalar = [], uyarilar = [];
    var tarih = girdi.tarih;
    var uretilen = oku(girdi.uretilenDokme);
    var satilan = oku(girdi.satilanDokme);

    if (!gecerliTarih(tarih)) {
      hatalar.push(kayit(ALAN, "Tarih geçersiz. Beklenen biçim: GG.AA.YYYY. Girilen: \"" + String(tarih) + "\"."));
    } else if (gelecekTarihMi(tarih)) {
      hatalar.push(d17(tarih));
    } else {
      d18Kontrol(depo, tarih, hatalar);
    }

    /* D1 */
    /* Tarih öneki ve "Girilen: …" kuyruğu düştü (kullanıcı bildirimi,
       28.08.2026): gün sayfanın başlığında, girilen rakam kutunun içinde
       yazılı. Kalan cümle kuralı söyler. */
    if (isNaN(uretilen)) {
      hatalar.push(kayit("D1", "Üretilen dökme sayı olmalı."));
    } else if (uretilen < 0) {
      hatalar.push(kayit("D1", "Üretilen dökme negatif olamaz. Girilen " + kg(uretilen) + "."));
    }

    /* D2 — ÇUVALLANAN YALNIZ KG (kullanıcı kararı, 02.09.2026: "50 ve katları
       kuralını kaldır, 238 kg de yazılabilsin; hiçbir yerde adet yazmasın").

       28.08.2026'da ekran kg'a geçmişti ama değerin 50'nin katı olması
       şartı duruyordu ve adet ara birim olarak yaşıyordu. İkisi de kalktı:
       çuvallanan serbest kg'dır, adet hiçbir katmanda okunmaz.
       Kalan denetimler öbür miktar alanlarıyla aynı — sayı, negatif değil,
       tam sayı. */
    var cuvalKg = YU.hesap.girdiCuvalKg(girdi);

    if (isNaN(cuvalKg)) {
      hatalar.push(kayit("D2", "Çuvallanan sayı olmalı."));
    } else if (cuvalKg < 0) {
      hatalar.push(kayit("D2", "Çuvallanan negatif olamaz. Girilen " + kg(cuvalKg) + "."));
    } else {
      tamSayiDenetle(hatalar, "Çuvallanan", cuvalKg);
    }

    tamSayiDenetle(hatalar, "Üretilen dökme küspe", uretilen);
    tamSayiDenetle(hatalar, "Satılan dökme küspe", satilan);

    /* D13 — satılan dökme sayısal denetimi */
    if (isNaN(satilan)) {
      hatalar.push(kayit("D13", "Satılan dökme sayı olmalı."));
    } else if (satilan < 0) {
      hatalar.push(kayit("D13", "Satılan dökme negatif olamaz. Girilen " + kg(satilan) + "."));
    }

    /* Ham girdi bozuksa türetilmiş kontroller anlamsız sayı üretir; burada durulur. */
    if (hatalar.length) return { hatalar: hatalar, uyarilar: uyarilar };

    var h = YU.hesap.kuruKuspe(uretilen, cuvalKg, satilan);
    var topYerlestirme = toplamMiktar(girdi.yerlestirmeler);
    var topCekis = toplamMiktar(girdi.cekisler);
    var topSatisCekis = toplamMiktar(girdi.satisCekisleri);
    var tol = tolerans();

    negatifSatirlar(girdi.yerlestirmeler, "D3", "Siloya yerleştirme", hatalar);
    negatifSatirlar(girdi.cekisler, "D5", "Silodan çekiş", hatalar);
    negatifSatirlar(girdi.satisCekisleri, "D13", "Dökme satış çekişi", hatalar);
    tamSayiSatirlar(girdi.yerlestirmeler, "Siloya yerleştirme", hatalar);
    tamSayiSatirlar(girdi.cekisler, "Silodan çekiş", hatalar);
    tamSayiSatirlar(girdi.satisCekisleri, "Dökme satış çekişi", hatalar);

    /* D3 — D4 ZATEN KONUŞACAKSA SUSAR (kullanıcı bildirimi, 28.08.2026:
       "çok fazla detay var"). Net üretim 0 iken ikisi birden yazıyordu:
       "Silolara 300 kg dağıtıldı; 0 kg olmalı" + "Siloya giriş yok; 300 kg
       kaldırılmalı". İkincisi ne yapılacağını söylediği için o kalır. */
    if (!esit(topYerlestirme, h.netDokmeUretim) &&
        !(h.netDokmeUretim === 0 && topYerlestirme > tol)) {
      /* "Silolara 0 kg dağıtıldı; 10 kg olmalı" KALIBI DEĞİŞTİ (kullanıcı
         isteği, 28.08.2026): hangi rakamın nereden geldiği okunmuyordu.
         Yeni kalıp iki miktarı da EKRANDAKİ ADIYLA yazar — "Siloya girecek"
         solda duran büyük yeşil rakamın etiketidir (KURAL 8). Beklenen
         miktar üretilen değil NET üretimdir (üretilen − çuvallanan); o
         yüzden etiket "Bugün Üretilen…" değil, "Siloya girecek". */
      hatalar.push(kayit("D3", "Siloya girecek " + kg(h.netDokmeUretim) +
        ", silolara dağıtılan " + kg(topYerlestirme) + "."));
    }

    /* D4 */
    if (h.netDokmeUretim === 0 && topYerlestirme > tol) {
      /* SADELEŞTİRİLDİ (28.08.2026): gerekçe (çuvallanan üretilenden fazla)
         iki rakamla anlatılıyordu; ikisi de ekranın solunda yazılı. Kalan
         cümle ne yapılacağını söyler. */
      /* D3 ile AYNI KALIP (kullanıcı isteği, 28.08.2026: "hepsini böyle
         yap"): beklenen 0 olduğu için cümle kendiliğinden "buraya yazma"
         demiş olur. */
      hatalar.push(kayit("D4", "Siloya girecek " + kg(0) +
        ", silolara dağıtılan " + kg(topYerlestirme) + "."));
    }

    /* D5 — D6 konuşacaksa susar (D3/D4 ile aynı gerekçe, 28.08.2026). */
    if (!esit(topCekis, h.silodanCekilecek) &&
        !(h.silodanCekilecek === 0 && topCekis > tol)) {
      /* D3 ile aynı kalıp (28.08.2026). */
      hatalar.push(kayit("D5", "Çuvallama için çıkacak " + kg(h.silodanCekilecek) +
        ", silolardan çekilen " + kg(topCekis) + "."));
    }

    /* D6 */
    if (h.silodanCekilecek === 0 && topCekis > tol) {
      /* Aynı sadeleştirme (28.08.2026): gerekçedeki iki rakam ekranda yazılı. */
      hatalar.push(kayit("D6", "Çuvallama için çıkacak " + kg(0) +
        ", silolardan çekilen " + kg(topCekis) + "."));
    }

    /* D13 — mesaj KISA ve hedef odaklı (kullanıcı isteği, 27.08.2026): eski
       metin kuralın GEREKÇESİNİ anlatıyordu ("dökme yalnız silolarda durur…");
       operatörün ihtiyacı olan tek şey ne yapacağı. Hangi kutunun eksik
       olduğunu ayrıca kutunun kendisi söyler — kırmızıya döner
       (21-kuru-kuspe-giris · canliBoya).
       D3'ün beklenen + girilen toplamı Şartname §9 Test 5 gereği KALIR. */
    /* Tek cümle yeter (28.08.2026): hiç çekiş yapılmamış hâli de "çekilen
       0 kg" olarak okunur, ayrı bir dal gerekmiyor. Kalıp D3/D5 ile aynı. */
    if (!esit(topSatisCekis, satilan)) {
      hatalar.push(kayit("D13", "Satış için çıkacak " + kg(satilan) +
        ", silolardan çekilen " + kg(topSatisCekis) + "."));
    }

    /* D7 / D15 — silo başına. Çekiş TOPLAM üzerinden ölçülür: çuvallama ve satış
       ayrı ayrı sığsa bile toplamı gün başı mevcudunu aşabilir (Şartname §8). */
    var yerlestirmeSilo = siloBazinda(girdi.yerlestirmeler, {});
    var cekisSilo = siloBazinda(girdi.cekisler, {});
    var satisSilo = siloBazinda(girdi.satisCekisleri, {});
    var idler = anahtarBirlesimi(yerlestirmeSilo, cekisSilo, satisSilo);
    var i, siloId, silo, cek, sat, cikan, giren, gunBasi, gunSonu, kapasite;

    for (i = 0; i < idler.length; i++) {
      siloId = idler[i];
      silo = satirBul(depo.silolar, siloId);
      if (!silo) {
        hatalar.push(kayit(ALAN, "Bilinmeyen silo (Id: " + siloId + "). Yerleştirme veya çekiş yapılamaz."));
        continue;
      }
      giren = yerlestirmeSilo[siloId] || 0;
      cek = cekisSilo[siloId] || 0;
      sat = satisSilo[siloId] || 0;
      cikan = YU.yuvarla(cek + sat);

      /* Gün başı mevcut = Tarih < tarih olan hareketler + en son silo devri.
         Aynı güne ait eski hareketler bu hesaba zaten girmez; düzeltmede
         silinecekleri için doğru davranış budur (Şartname §5, §8 D7).
         İSTİSNA (M18): aynı günün MANUEL hareketleri yeniden kayıtta
         silinmez, o yüzden zemine katılır — katılmasa D7/D15 eksik bakiyeyle
         ölçer, D14 reddederdi ama mesajı yanlış kuraldan gelirdi. */
      gunBasi = YU.yuvarla(YU.stok.siloGunBasi(depo, siloId, tarih) + gunIciManuelNet(depo, siloId, tarih));

      /* D7'nin ZEMİNİ: gün başı + O GÜN SİLOYA GİREN (kullanıcı kararı,
         28.08.2026). Şartname §229 "o gün başındaki mevcudundan fazlası
         çekilemez" diyordu; harfi harfine uygulanınca normal bir üretim
         günü bloke oluyordu: sabah 500 kg olan siloya gün içinde 50.000 kg
         üretim giriyor, öğleden sonra 10.000 kg sevk ediliyor — siloda
         50.500 kg olmasına rağmen kayıt reddediliyordu (ölçüldü).
         Aynı anda D14 o siloyu HİÇ şikâyet etmiyordu (günün tamamını
         hesaplayıp +40.500 buluyordu) — iki kural aynı silo için zıt karar
         veriyordu. Zemin düzeltildi; güvenlik kaybı yok, çünkü stoğun
         eksiye düşmesini D14 kesin engelliyor ve gün sonu bakiyesini D15
         ayrıca ölçüyor. */
      var kullanilabilir = YU.yuvarla(gunBasi + giren);

      if (cikan > tol && cikan - kullanilabilir > tol) {
        /* Kısaltıldı (kullanıcı isteği, 26.08.2026): cümle çok uzundu.
           Kalem dökümü (çuvallama + dökme satış) yalnız İKİSİ DE doluyken
           yazılır — biri sıfırken bir şey anlatmıyor, satırı uzatıyordu.
           Kural değişmedi: kalan bilgi hangi silo, hangi gün, ne kadar. */
        /* KALEM DÖKÜMÜ VE ZEMİN HESABI KALKTI (kullanıcı bildirimi,
           28.08.2026: "çok fazla detay var, ana sorun anlaşılması çok güç").
           Cümle üç bilgi taşıyordu — hangi kalemden ne çekildiği, mevcudun
           gün başı + bugün giren dökümü, ve asıl olay. İlk ikisi ekranda
           zaten yazıyor: hangi kutuya ne yazıldığı silo kutularında, gün başı
           her silonun üstünde, bugün giren "Siloya girecek" satırında.
           Geriye tek cümlede asıl olay kalır: ne çekiliyor, ne var. */
        var dokum = "";
        /* Tarih düştü (27.08.2026): ekran zaten o günü gösteriyor. Fark da
           düştü — iki rakamdan çıkıyor. Kalan: hangi silo, ne çekiliyor,
           ne var. SADELEŞTİRİLDİ (27.08.2026): "—" ayracı ve "çekilen X,
           mevcut Y" devrik kalıbı düz cümleye döndü; kalem dökümü ayrı
           cümleye çıktı, parantez kalktı. Önek "Silo N:" — D14 ile aynı
           kalıp, ekranda hizalı sütun olur. */
        /* Gün içinde siloya giriş varsa rakamın nereden çıktığı yazılır —
           operatör "siloda 50.500 var" cümlesini gün başındaki 500 ile
           bağdaştıramazdı (KURAL 8: bilgi okunduğu yerde). */
        /* Sıra değişti: önce SORUN (fazla çekiliyor), sonra sınır. */
        hatalar.push(kayit("D7", silo.Ad + ": " + kg(cikan) + " çekiliyor, siloda " +
          kg(kullanilabilir) + " var." + dokum));
      }

      /* D15 — yerleştirilen miktar değil, oluşan gün sonu bakiyesi ölçülür.
         SERT ENGEL (kullanıcı kararı, 21.08.2026): şartname v2 bunu yumuşak
         uyarı tanımlar; fabrika kararıyla kapasite aşan kayıt reddedilir. */
      gunSonu = YU.yuvarla(gunBasi + giren - cikan);
      kapasite = Number(silo.Kapasite) || 0;
      if (kapasite > 0 && gunSonu - kapasite > tol) {
        /* Gerekçeli kabul kapısı (kullanıcı kararı, 25.08.2026): şartname §8
           D15'i uyarı sayar ve gerekçesini de yazar — "sert engel operatörü
           kilitler". Fiili taşma/ölçüm sapması gerçek olduğu için operatör
           GEREKÇE yazarak kaydı geçirebilir; o zaman D15 hataya değil
           uyarıya düşer ve gerekçe denetim izine yazılır (04-servis). */
        /* SADELEŞTİRİLDİ (kullanıcı isteği, 27.08.2026: "bunu okumak bile
           insanı yoruyor"). Üç cümle ve dört rakam vardı; ikisi türetilebilir
           (aşım = gün sonu − kapasite) ve tarih zaten ekranın seçili günü.
           Kalan: hangi silo, ne kadar olurdu, sınırı ne. D3/D5/D13'teki
           "şu oldu; şu olmalı" kalıbının aynısı. */
        var d15Metin = silo.Ad + " gün sonu " + kg(gunSonu) + " olur; kapasite " + kg(kapasite) + ".";
        if (kapasiteGerekcesiGecerli(girdi)) {
          uyarilar.push(kayit("D15", d15Metin + " Kapasite aşımı gerekçeyle kabul edildi: \"" +
            kapasiteGerekcesi(girdi) + "\"."));
        } else {
          hatalar.push(kayit("D15", d15Metin));
        }
      }
    }

    /* D16. Sözleşme girdi kontratı: rowVersion null = "yeni kayıt açıyorum".
       Yeni-gün ayağı (prototip eklentisi, DUZELTME-PLANI M7): iki oturum aynı
       KAYITSIZ günü açarsa ikisi de null taşır; ikincinin kaydı, birincinin
       yazdığını sessizce ezerdi — null + mevcut kayıt da çakışmadır. */
    /* Sürüm numaraları cümleden çıktı (kullanıcı bildirimi, 28.08.2026):
       operatöre "sürüm 2 → 3" bir şey söylemiyordu. Kalan iki bilgi karar
       için yeter: ne olmuş, ne yapılacak. Tarih öneki de düştü — ekranın
       gösterdiği gün zaten o. */
    var mevcutD16 = kuruKuspeGunuBul(depo, tarih);
    if (girdi.rowVersion === null || girdi.rowVersion === undefined) {
      if (mevcutD16) {
        hatalar.push(kayit("D16", "Bu güne siz ekranı açtıktan sonra başkası kayıt girmiş. Sayfayı yenileyin."));
      }
    } else {
      if (!mevcutD16) {
        hatalar.push(kayit("D16", "Bu günün kaydı siz ekranı açtıktan sonra silinmiş. Sayfayı yenileyin."));
      } else if (Number(mevcutD16.RowVersion) !== Number(girdi.rowVersion)) {
        hatalar.push(kayit("D16", "Bu gün siz ekranı açtıktan sonra başkası tarafından değiştirilmiş. Sayfayı yenileyin."));
      }
    }

    return { hatalar: hatalar, uyarilar: uyarilar };
  }

  /* ---------- Gün silme: D14 ---------- */

  /* Özel tipli malzemeyi bulur (dökme / çuvallı kuru küspe). Şartname §6
     filtreli tekil indeks gereği bu tipten en çok bir satır olur. */
  function ozelTipli(depo, tip) {
    var i;
    for (i = 0; i < depo.malzemeler.length; i++) {
      if (depo.malzemeler[i].OzelTip === tip) return depo.malzemeler[i];
    }
    return null;
  }

  function gunSilme(depo, tarih) {
    var hatalar = [], i, n, negatifler;

    if (!gecerliTarih(tarih)) {
      return { hatalar: [kayit(ALAN, "Tarih geçersiz: \"" + String(tarih) + "\".")] };
    }

    /* "Silinecek kayıt var mı" ölçüsü DARALDI (kullanıcı kararı, 31.08.2026):
       Günü Sıfırla artık yalnız bu ekranın verisini siliyor, o günün her
       malzeme satırını değil. Bu yüzden yalnız yaş küspe/kuyruk gibi başka
       malzemelere satır girilmiş bir günde düğme "silinecek bir şey var"
       demez — çünkü gerçekten yok. */
    var dokmeMz = ozelTipli(depo, 'DokmeKuruKuspe');
    var cuvalMz = ozelTipli(depo, 'CuvalKuruKuspe');
    var varMi = kuruKuspeGunuBul(depo, tarih) !== null;
    if (!varMi) {
      for (i = 0; i < depo.siloHareket.length; i++) {
        if (depo.siloHareket[i].Tarih === tarih) { varMi = true; break; }
      }
    }
    if (!varMi) {
      for (i = 0; i < depo.gunlukHareket.length; i++) {
        var kh = depo.gunlukHareket[i];
        if (kh.Tarih !== tarih) continue;
        if (dokmeMz && kh.MalzemeId === dokmeMz.Id &&
            ((Number(kh.Uretim) || 0) !== 0 || (Number(kh.Satis) || 0) !== 0)) { varMi = true; break; }
        if (cuvalMz && kh.MalzemeId === cuvalMz.Id && (Number(kh.Uretim) || 0) !== 0) { varMi = true; break; }
      }
    }
    if (!varMi) {
      hatalar.push(kayit(ALAN, tr(tarih) + " tarihinde silinecek kayıt yok."));
      return { hatalar: hatalar };
    }

    negatifler = ileriBakiye(depo, tarih, { tarih: tarih, silTarih: tarih, yeniHareketler: [] });
    for (i = 0; i < negatifler.length; i++) {
      n = negatifler[i];
      /* Aynı sadeleştirme (27.08.2026): önek "Silo N:", ayraç ve "'a düşer"
         kalıbı yok. */
      hatalar.push(kayit("D14", n.siloAd + ": " + tr(tarih) + " silinirse " + tr(n.tarih) +
        " günü stok " + kg(n.bakiye) + " oluyor. Önce o günü düzeltin veya silin."));
    }

    /* İLERİ KAPASİTE (kullanıcı direktifi, 28.08.2026): silinen günün ÇEKİŞİ
       sonraki günlerin bakiyesini yükseltir — silme 20.08'i 3.096.000 kg'a
       çıkarırken kabul ediliyordu (ölçüldü; kapasite 3.000.000). */
    var asimlar = ileriKapasite(depo, tarih, { tarih: tarih, silTarih: tarih, yeniHareketler: [] });
    for (i = 0; i < asimlar.length; i++) {
      hatalar.push(kayit("D15", asimlar[i].siloAd + ": " + tr(tarih) + " silinirse " +
        tr(asimlar[i].tarih) + " günü stok " + kg(asimlar[i].bakiye) + " oluyor; kapasite " +
        kg(asimlar[i].kapasite) + ". Önce o günü düzeltin."));
    }

    /* MALZEME İLERİ NEGATİF (kullanıcı direktifi, 28.08.2026): silinen günün
       üretimi sonraki günün satışını besliyor olabilir — stoğu −5.000'e
       düşüren silme kabul ediliyordu (ölçüldü). Dökme kuru küspe dışarıda:
       stoğu siloların toplamı, üstteki silo yürüyüşü onu zaten kapsıyor.
       Çuvallı DAHİL: stoğu kendi hareketlerinden hesaplanır. */
    /* Yalnız ÇUVALLI taranır (31.08.2026): silme başka malzemenin satırına
       artık dokunmuyor, onların bakiyesi değişmiyor. Dökme dışarıda —
       stoğu siloların toplamı, üstteki silo yürüyüşü onu kapsıyor.
       Taslak: çuvallının Üretim'i sıfırlanır, Satış'ı OLDUĞU GİBİ kalır. */
    if (cuvalMz) {
      for (i = 0; i < depo.gunlukHareket.length; i++) {
        var satir = depo.gunlukHareket[i];
        if (satir.Tarih !== tarih || satir.MalzemeId !== cuvalMz.Id) continue;
        if ((Number(satir.Uretim) || 0) === 0) continue;      /* zaten sıfır: bakiye değişmez */
        var negatif = malzemeIlkNegatifGun(depo, cuvalMz, tarih, 0, Number(satir.Satis) || 0);
        if (negatif) {
          hatalar.push(kayit(ALAN, "\"" + cuvalMz.Ad + "\" stoğu " + tr(tarih) + " silinirse " +
            tr(negatif.tarih) + " günü " + kg(negatif.bakiye) + "'a düşerdi. Stok hiçbir gün " +
            "eksiye inemez; gün silinemez. Önce sonraki günleri düzeltin."));
        }
      }
    }
    return { hatalar: hatalar };
  }

  /* O günün Manuel (sayım düzeltmesi) hareketlerinin net etkisi. Kuru küspe
     yeniden kaydı Manuel'i silmez (M16); D7/D15 zemini bu neti içermeli. */
  function gunIciManuelNet(depo, siloId, tarih) {
    var net = 0, i, h;
    for (i = 0; i < depo.siloHareket.length; i++) {
      h = depo.siloHareket[i];
      if (h.SiloId !== siloId || h.Tarih !== tarih || h.HareketTipi !== "Manuel") continue;
      net = YU.yuvarla(net + (Number(h.GirenKg) || 0) - (Number(h.CikanKg) || 0));
    }
    return net;
  }

  /* ---------- Manuel silo hareketi — sayım düzeltmesi (M18, Şartname §11) ---------- */

  function manuelHareket(depo, girdi) {
    var hatalar = [];
    var tarih = girdi.tarih;
    var siloId = kimlik(girdi.siloId);
    var silo = siloId === null ? null : satirBul(depo.silolar, siloId);
    var miktar = oku(girdi.miktar);
    var yon = girdi.yon;
    var aciklama = String(girdi.aciklama === null || girdi.aciklama === undefined ? "" : girdi.aciklama).trim();

    if (!gecerliTarih(tarih)) {
      hatalar.push(kayit(ALAN, "Tarih geçersiz: \"" + String(tarih) + "\"."));
    } else if (gelecekTarihMi(tarih)) {
      hatalar.push(d17(tarih));
    } else {
      d18Kontrol(depo, tarih, hatalar);
    }
    if (!silo) {
      hatalar.push(kayit(ALAN, "Silo bulunamadı (Id: " + String(girdi.siloId) + ")."));
    } else if (silo.Aktif === false) {
      hatalar.push(kayit(ALAN, "\"" + silo.Ad + "\" pasif durumda; sayım düzeltmesi girilemez."));
    }
    if (yon !== "giren" && yon !== "cikan") {
      hatalar.push(kayit(ALAN, "Yön \"giren\" (sayım fazlası) veya \"cikan\" (sayım eksiği) olmalı."));
    }
    if (isNaN(miktar)) {
      hatalar.push(kayit(ALAN, "Miktar sayı olmalı. Girilen: \"" + String(girdi.miktar) + "\"."));
    } else if (miktar <= 0) {
      hatalar.push(kayit(ALAN, "Miktar 0'dan büyük olmalı. Girilen: " + kg(miktar) + "."));
    }
    tamSayiDenetle(hatalar, "Sayım düzeltmesi miktarı", miktar);
    /* Sayım düzeltmesi gerekçesiz olmaz: denetim izinin "neden" ayağı. */
    if (!aciklama) {
      hatalar.push(kayit(ALAN, "Açıklama zorunlu: sayım farkının gerekçesi yazılmalı (örn. \"fiili sayım farkı\", \"fire\")."));
    }

    return { hatalar: hatalar };
  }

  /* ---------- Malzeme hareketi (Malzeme Girişi ekranı) ---------- */

  function malzemeHareketi(depo, girdi) {
    var hatalar = [], uyarilar = [];
    var malzemeId = kimlik(girdi.malzemeId);
    var malzeme = malzemeId === null ? null : satirBul(depo.malzemeler, malzemeId);
    var tarih = girdi.tarih;
    var uretim = girdi.uretim === null || girdi.uretim === undefined ? null : oku(girdi.uretim);
    var satis = girdi.satis === null || girdi.satis === undefined ? null : oku(girdi.satis);

    if (!gecerliTarih(tarih)) {
      hatalar.push(kayit(ALAN, "Tarih geçersiz: \"" + String(tarih) + "\"."));
    } else if (gelecekTarihMi(tarih)) {
      hatalar.push(d17(tarih));
    } else {
      d18Kontrol(depo, tarih, hatalar);
    }
    if (!malzeme) {
      hatalar.push(kayit(ALAN, "Malzeme bulunamadı (Id: " + String(girdi.malzemeId) + ")."));
      return { hatalar: hatalar, uyarilar: uyarilar };
    }
    /* MALZEME GİRİŞİ MESAJLARI SADELEŞTİ (kullanıcı isteği, 28.08.2026:
       "malzeme girişi sayfasındaki hataları da böyle yap"). Kuru Küspe
       ekranındaki kalıbın aynısı:
         · malzeme adı ÖNEK olarak başta ve tırnaksız — "Toprak: …"
           (hata şeridi öneki kalın yazar, satırlar hizalı okunur),
         · "Girilen: …" kuyruğu düştü; yazılan rakam kutunun içinde duruyor,
         · kuralın gerekçesi değil, ne olduğu yazılır. */
    var ad = malzeme.Ad + ": ";

    if (!malzeme.Aktif) {
      hatalar.push(kayit(ALAN, ad + "pasif malzemeye hareket girilemez."));
    }

    if (uretim !== null && isNaN(uretim)) {
      hatalar.push(kayit(ALAN, ad + "üretim sayı olmalı."));
    } else if (uretim !== null && uretim < 0) {
      hatalar.push(kayit(ALAN, ad + "üretim negatif olamaz. Girilen " + kg(uretim) + "."));
    }
    if (satis !== null && isNaN(satis)) {
      hatalar.push(kayit(ALAN, ad + "satış sayı olmalı."));
    } else if (satis !== null && satis < 0) {
      hatalar.push(kayit(ALAN, ad + "satış negatif olamaz. Girilen " + kg(satis) + "."));
    }

    /* İade (kullanıcı direktifi, 24.08.2026): ayrı alanda saklanır, satış
       rakamına dokunmaz. REVİZE (26.08.2026): iade artık HİÇBİR malzemede
       stoğa girmez — yalnız raporlanır (04-servis.js "mevcut" hesabı).
       Bu yüzden dökme kuru küspenin iade yasağı da KALKTI (kullanıcı
       bildirimi, 26.08.2026): yasak "iade stokta görünür ama dökmede
       görünemez" gerekçesine dayanıyordu, o gerekçe kalmadı. Dökme iade
       kaydedilir ve raporlanır; siloya ve dökme mevcuduna dokunmaz, yani
       "dökme stok siloların toplamıdır" kuralı (Şartname §5) bozulmaz. */
    var iade = girdi.iade === null || girdi.iade === undefined ? null : oku(girdi.iade);
    if (iade !== null && isNaN(iade)) {
      hatalar.push(kayit(ALAN, ad + "iade sayı olmalı."));
    } else if (iade !== null && iade < 0) {
      hatalar.push(kayit(ALAN, ad + "iade negatif olamaz. Girilen " + kg(iade) + "."));
    }

    tamSayiDenetle(hatalar, malzeme.Ad + ": üretim", uretim);
    tamSayiDenetle(hatalar, malzeme.Ad + ": satış", satis);
    tamSayiDenetle(hatalar, malzeme.Ad + ": iade", iade);

    if (hatalar.length) return { hatalar: hatalar, uyarilar: uyarilar };

    var mevcut = gunlukHareketBul(depo, tarih, malzeme.Id);

    /* Kilitli kolonlar (Şartname §4, §7): dökme kuru küspenin ÜRETİM ve SATIŞ
       kolonları, çuvallı kuru küspenin üretim kolonu Kuru Küspe Günlük
       Giriş'ten gelir. Kilit ALAN bazlıdır: İADE kolonu kilitli değildir —
       iade üretim/satış değildir, stoğa da girmez (26.08.2026). */
    var uretimVerildi = !(girdi.uretim === null || girdi.uretim === undefined || girdi.uretim === "");
    var satisVerildi = !(girdi.satis === null || girdi.satis === undefined || girdi.satis === "");
    if (malzeme.OzelTip === "DokmeKuruKuspe" && (uretimVerildi || satisVerildi)) {
      hatalar.push(kayit(ALAN, ad + "üretim ve satış Kuru Küspe Günlük Giriş'ten gelir, buradan girilemez."));
    } else if (malzeme.OzelTip === "CuvalKuruKuspe" && uretimVerildi &&
               !esit(uretim, mevcut ? Number(mevcut.Uretim) || 0 : 0)) {
      hatalar.push(kayit(ALAN, ad + "üretim Kuru Küspe Günlük Giriş'ten gelir, buradan girilemez. Buradan yalnız satış girilir."));
    }

    /* D16. Yeni-gün ayağı kuru küspedekiyle aynı (DUZELTME-PLANI M7):
       rowVersion null iken satır zaten varsa çakışmadır — ekran satırı
       "yok" bilgisiyle açılmış, biri arada oluşturmuştur. */
    if (girdi.rowVersion === null || girdi.rowVersion === undefined) {
      if (mevcut) {
        hatalar.push(kayit("D16", ad + "bu satır siz ekranı açtıktan sonra başkası tarafından girilmiş. Sayfayı yenileyin."));
      }
    } else {
      if (!mevcut) {
        hatalar.push(kayit("D16", ad + "bu satır siz ekranı açtıktan sonra silinmiş. Sayfayı yenileyin."));
      } else if (Number(mevcut.RowVersion) !== Number(girdi.rowVersion)) {
        hatalar.push(kayit("D16", ad + "bu satır siz ekranı açtıktan sonra başkası tarafından değiştirilmiş. Sayfayı yenileyin."));
      }
    }

    if (hatalar.length) return { hatalar: hatalar, uyarilar: uyarilar };

    /* MALZEME STOĞU NEGATİFE DÜŞEMEZ — SERT ENGEL (kullanıcı kararı,
       26.08.2026: "önceki güne veri girildiğinde o günden sonraki günler tek
       tek sayılsın, herhangi bir günde stok 0'ın altına düşmesi kesinlikle
       yasak"). Şartname §13 Soru 3 AÇIK BİR SORUDUR ve önerisi "uyarı"ydı;
       kullanıcı cevabı ENGELLE olarak verdi — CLAUDE.md KURAL 12'ye yazıldı.
       Demirbas bir maddeyle çelişmez.

       Tarama ileriye doğrudur: malzemeIlkNegatifGun devir tarihinden başlayıp
       hareketi olan her günü sırayla yürütür ve negatife düşen İLK günü
       döner — düzeltilen günün TASLAK değerleriyle. Yani geçmiş bir günü
       düşürüp sonraki günleri patlatmak artık kaydedilemez (silolardaki
       D14 kuralının malzeme karşılığı).

       Dökme kuru küspe DIŞARIDA: onun stoğu siloların toplamıdır (Şartname §5)
       ve D7 + D14 zaten sert engel uyguluyor. Çuvallı küspe ve basit
       malzemeler bu kuralın kapsamındadır. */
    if (malzeme.OzelTip !== "DokmeKuruKuspe") {
      var negatif = malzemeIlkNegatifGun(depo, malzeme, tarih,
        uretim === null ? (mevcut ? Number(mevcut.Uretim) || 0 : 0) : uretim,
        satis === null ? (mevcut ? Number(mevcut.Satis) || 0 : 0) : satis);
      if (negatif) {
        /* Kuru Küspe ekranındaki D14 kalıbının aynısı (28.08.2026): hangi
           malzeme, hangi gün, ne oluyor. Kuralın kendisi ("stok eksiye
           inemez") zaten sonucun kendisinden anlaşılıyor. */
        hatalar.push(kayit(ALAN, ad + tr(negatif.tarih) + " günü stok " +
          kg(negatif.bakiye) + " oluyor."));
      }
    }

    return { hatalar: hatalar, uyarilar: uyarilar };
  }

  /* Malzeme bakiyesini gün gün tek geçişte tarar; negatife düşen ilk günü döner. */
  function malzemeIlkNegatifGun(depo, malzeme, tarih, yeniUretim, yeniSatis) {
    var gunler = {}, devirler = {}, i, h, g, takvim = [], tol = tolerans();

    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.MalzemeId !== malzeme.Id) continue;
      if (h.Tarih === tarih) continue;                    // o günün satırı taslakla değişiyor
      gunler[h.Tarih] = YU.yuvarla((gunler[h.Tarih] || 0) + (Number(h.Uretim) || 0) - (Number(h.Satis) || 0));
    }
    /* tarih null ise TASLAK YOK demektir: kayıtlı veri olduğu gibi taranır
       (üst şerit uyarısı bu yolu kullanır, 26.08.2026). */
    if (tarih) gunler[tarih] = YU.yuvarla((gunler[tarih] || 0) + yeniUretim - yeniSatis);

    for (i = 0; i < depo.devirStok.length; i++) {
      h = depo.devirStok[i];
      if (h.MalzemeId !== malzeme.Id) continue;
      devirler[h.DevirTarihi] = Number(h.Miktar) || 0;
    }

    for (g in gunler) if (Object.prototype.hasOwnProperty.call(gunler, g)) takvim.push(g);
    for (g in devirler) {
      if (Object.prototype.hasOwnProperty.call(devirler, g) &&
          !Object.prototype.hasOwnProperty.call(gunler, g)) takvim.push(g);
    }
    takvim.sort();

    var bakiye = 0;
    for (i = 0; i < takvim.length; i++) {
      g = takvim[i];
      if (Object.prototype.hasOwnProperty.call(devirler, g)) bakiye = devirler[g];
      bakiye = YU.yuvarla(bakiye + (gunler[g] || 0));
      if (bakiye < -tol) return { tarih: g, bakiye: bakiye };
    }
    return null;
  }

  /* Kayıtlı veriye göre negatife düşen BASİT malzemeleri listeler
     (kullanıcı kararı, 26.08.2026): kayıt engellenmez — Şartname §13 Soru 3
     "öneri: uyarı" — ama uyarı üst şerit zilinden düşmez, koşul düzelene
     kadar orada durur. Özel tipler (dökme/çuvallı kuru küspe) dışarıdadır:
     onların stoğu siloların toplamıdır ve D14 zaten sert engeldir. */
  function malzemeNegatifGunleri(depo) {
    var liste = [], i, m, n;
    if (!depo || !depo.malzemeler) return liste;
    for (i = 0; i < depo.malzemeler.length; i++) {
      m = depo.malzemeler[i];
      /* Dökme dışında her malzeme taranır (26.08.2026): çuvallı küspenin
         stoğu da formülle hesaplanır, o da eksiye düşebilir. */
      if (!m || m.OzelTip === 'DokmeKuruKuspe' || m.Aktif === false) continue;
      n = malzemeIlkNegatifGun(depo, m, null, 0, 0);
      if (n) liste.push({ malzemeId: m.Id, malzemeAd: m.Ad, tarih: n.tarih, bakiye: n.bakiye });
    }
    liste.sort(function (a, b) { return a.tarih < b.tarih ? -1 : (a.tarih > b.tarih ? 1 : 0); });
    return liste;
  }

  /* ---------- Kuru küspe kaydının İLERİ GÜN engelleri ----------

     Kayıt anında servisin koştuğu iki ek kontrol. Buraya TAŞINDI (denetim
     bulgusu BUG-002, 30.08.2026): kural yalnız 04-servis'te durduğu için
     ekranın canlı denetimi bunları göremiyordu — Kaydet açık kalıyor, servis
     reddediyor ve hata metni hiçbir yerde görünmüyordu (ölçüldü: ekran
     "Kaydedilebilir" derken servis D15 ile reddetti).

     Artık 04-servis ve 21-kuru-kuspe-giris AYNI fonksiyonu çağırır; kural
     kopyalanmaz. D14 (ileriBakiye) BİLEREK dışarıdadır: ekran onu aynı-gün D7
     susturmasıyla birlikte kendisi işler (21 · canliDenetim).

     yeniHareketler: [{siloId, GirenKg, CikanKg}] — çağıranın taslak listesi. */
  function kuruKuspeIleriEngeller(depo, girdi, yeniHareketler) {
    var hatalar = [], tarih = girdi.tarih, i;
    if (!gecerliTarih(tarih)) return hatalar;

    var taslak = {
      tarih: tarih,
      kuruKuspeSilTarihi: tarih,
      yeniHareketler: yeniHareketler || []
    };

    /* D15 — ileri günler. Düzenlenen gün ELENİR: onu kuruKuspeKaydi kendi
       ayrıntılı mesajıyla zaten söylüyor, iki kez yazılmasın. */
    var ileriKap = ileriKapasite(depo, tarih, taslak);
    for (i = 0; i < ileriKap.length; i++) {
      if (ileriKap[i].tarih === tarih) continue;
      hatalar.push(kayit("D15", d15IleriMesaji(ileriKap[i])));
    }

    /* Çuvallı kuru küspe — ileri negatif. Bu kayıt çuvallı ÜRETİMİ yeniden
       yazar; geçmiş günün miktarını düşürmek ileri günün çuvallı satışını
       açıkta bırakabilir. Satış bu yoldan DEĞİŞMEZ (Malzeme Girişi'nin
       kolonu) — mevcut satır neyse o simüle edilir. Dökme dışarıda: stoğu
       siloların toplamı, D14 silo yürüyüşü onu zaten kapsıyor.
       02.09.2026: üretim artık doğrudan kg, adet × 50 çarpımı kalktı. */
    var cuvalMlz = null;
    for (i = 0; i < depo.malzemeler.length; i++) {
      if (depo.malzemeler[i].OzelTip === "CuvalKuruKuspe") { cuvalMlz = depo.malzemeler[i]; break; }
    }
    var cuvallananKg = YU.hesap.girdiCuvalKg(girdi);
    if (cuvalMlz && !isNaN(cuvallananKg)) {
      var cuvalSatiri = gunlukHareketBul(depo, tarih, cuvalMlz.Id);
      var cuvalNegatif = malzemeIlkNegatifGun(depo, cuvalMlz, tarih,
        YU.yuvarla(cuvallananKg),
        cuvalSatiri ? Number(cuvalSatiri.Satis) || 0 : 0);
      if (cuvalNegatif) {
        hatalar.push(kayit("D14", "\"" + cuvalMlz.Ad + "\" stoğu " +
          tr(cuvalNegatif.tarih) + " günü " + kg(cuvalNegatif.bakiye) + " oluyor."));
      }
    }

    return hatalar;
  }

  /* ---------- Kullanıcı: D9, D10, D11, D12 ---------- */

  /* islemiYapan üçüncü parametredir: D9 "kendi hesabı" karşılaştırması için
     işlemi yapan kullanıcı bilinmek zorunda. Verilmezse D9 atlanır. */
  function kullaniciDogrula(depo, kullanici, islemiYapan) {
    var hatalar = [], i, k;
    var mevcut = kullanici.Id ? satirBul(depo.kullanicilar, kullanici.Id) : null;
    var aktif = kullanici.Aktif !== false;
    var rol = kullanici.Rol;

    /* Giriş kimliği E-POSTA (kullanıcı kararı, 26.08.2026). Alan ve D11
       tekilliği değişmedi; yalnız içeriğin biçimi denetleniyor. */
    if (bosMu(kullanici.KullaniciAdi)) {
      hatalar.push(kayit(ALAN, "E-posta adresi boş olamaz."));
    } else if (!YU.ePosta.gecerliMi(kullanici.KullaniciAdi)) {
      hatalar.push(kayit(ALAN, "Geçerli bir e-posta adresi yazın — ad.soyad@" + YU.ePosta.alanAdi + " gibi."));
    }
    if (bosMu(kullanici.AdSoyad)) hatalar.push(kayit(ALAN, "Ad soyad boş olamaz."));
    if (rol !== "Yonetici" && rol !== "Operator") {
      hatalar.push(kayit(ALAN, "Rol \"Yonetici\" veya \"Operator\" olmalı. Girilen: \"" + String(rol) + "\"."));
    }

    /* D11 */
    var ad = anahtarla(kullanici.KullaniciAdi);
    if (ad) {
      for (i = 0; i < depo.kullanicilar.length; i++) {
        k = depo.kullanicilar[i];
        if (k.Id !== kullanici.Id && anahtarla(k.KullaniciAdi) === ad) {
          hatalar.push(kayit("D11", "\"" + kullanici.KullaniciAdi + "\" adresi zaten kullanılıyor (" +
            k.AdSoyad + "). Aynı e-posta iki hesaba verilemez."));
          break;
        }
      }
    }

    /* D9 */
    if (mevcut && islemiYapan && islemiYapan.Id === mevcut.Id && !aktif) {
      hatalar.push(kayit("D9", "Kendi hesabınızı (" + mevcut.AdSoyad + ") pasifleştiremezsiniz."));
    }

    /* D10 — son aktif yönetici korunur */
    if (mevcut && mevcut.Rol === "Yonetici" && mevcut.Aktif && (!aktif || rol !== "Yonetici")) {
      var digerAktifYonetici = 0;
      for (i = 0; i < depo.kullanicilar.length; i++) {
        k = depo.kullanicilar[i];
        if (k.Id !== mevcut.Id && k.Aktif && k.Rol === "Yonetici") digerAktifYonetici++;
      }
      if (digerAktifYonetici === 0) {
        hatalar.push(kayit("D10", mevcut.AdSoyad + " sistemdeki son aktif yönetici. " +
          (!aktif ? "Pasifleştirilemez" : "Operatöre düşürülemez") +
          " — aksi hâlde sisteme kimse yönetici olarak giremez."));
      }
    }

    return { hatalar: hatalar };
  }

  /* ---------- Malzeme ---------- */

  var OZEL_TIPLER = [null, "DokmeKuruKuspe", "CuvalKuruKuspe"];

  function malzemeDogrula(depo, malzeme) {
    var hatalar = [], i, m, mevcut = null;
    var ad = anahtarla(malzeme.Ad);
    var ozelTip = malzeme.OzelTip === undefined || malzeme.OzelTip === "" ? null : malzeme.OzelTip;

    if (!ad) hatalar.push(kayit(ALAN, "Malzeme adı boş olamaz."));
    if (bosMu(malzeme.Birim)) hatalar.push(kayit(ALAN, "Birim boş olamaz (örn. \"Kg\")."));
    /* Sıra bir sayaç; negatif olamaz. Daha önce hiç denetlenmiyordu. */
    if (malzeme.Sira !== null && malzeme.Sira !== undefined && malzeme.Sira !== "") {
      var sira = oku(malzeme.Sira);
      if (isNaN(sira)) hatalar.push(kayit(ALAN, "Sıra sayı olmalı. Girilen: \"" + String(malzeme.Sira) + "\"."));
      else if (sira < 0) hatalar.push(kayit(ALAN, "Sıra negatif olamaz. Girilen: " + YU.fmt.sayi(sira) + "."));
    }
    if (OZEL_TIPLER.indexOf(ozelTip) < 0) {
      hatalar.push(kayit(ALAN, "Özel tip yalnızca boş, \"DokmeKuruKuspe\" veya \"CuvalKuruKuspe\" olabilir. Girilen: \"" + String(malzeme.OzelTip) + "\"."));
    }

    /* Var olan bir özel tip KALDIRILAMAZ / DEĞİŞTİRİLEMEZ.
       Şartname §5'in "dökme stok = silolar toplamı" kuralı, Malzeme Girişi'ndeki
       kilitli kolonlar ve kuru küspe günlük kaydının hangi malzemeye yazılacağı
       bu alana bağlı. Boşaltılırsa hiçbir hata çıkmadan stok çift sayılmaya başlar. */
    for (i = 0; i < depo.malzemeler.length; i++) {
      if (depo.malzemeler[i].Id === malzeme.Id) { mevcut = depo.malzemeler[i]; break; }
    }
    if (mevcut && mevcut.OzelTip && ozelTip !== mevcut.OzelTip) {
      hatalar.push(kayit(ALAN, "\"" + mevcut.Ad + "\" malzemesinin \"" + mevcut.OzelTip +
        "\" özel tipi kaldırılamaz veya başka tiple değiştirilemez. Şartname §5'in " +
        "\"dökme stok = silolar toplamı\" kuralı, Malzeme Girişi'ndeki kilitli kolonlar " +
        "ve kuru küspe günlük kaydı bu alana bağlıdır; boşaltılırsa stok sessizce çift sayılır."));
    }

    for (i = 0; i < depo.malzemeler.length; i++) {
      m = depo.malzemeler[i];
      if (m.Id === malzeme.Id) continue;
      if (ad && anahtarla(m.Ad) === ad) {
        hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" adında bir malzeme zaten var (sıra " +
          YU.fmt.sayi(m.Sira) + "). Malzeme adı tekil olmalı."));
      }
      /* Filtreli tekil indeks (Şartname §6): ikinci bir DokmeKuruKuspe malzemesi
         "stok = silolar toplamı" kuralını iki malzemeye uygular ve stoğu ikiye katlar. */
      if (ozelTip && m.OzelTip === ozelTip) {
        hatalar.push(kayit(ALAN, "\"" + ozelTip + "\" özel tipi zaten \"" + m.Ad +
          "\" malzemesinde tanımlı. Her özel tipten en fazla bir malzeme olabilir."));
      }
    }

    return { hatalar: hatalar };
  }

  /* ---------- Silo ---------- */

  function siloDogrula(depo, silo) {
    var hatalar = [], i, s;
    var ad = anahtarla(silo.Ad);
    var kapasite = oku(silo.Kapasite);

    if (!ad) hatalar.push(kayit(ALAN, "Silo adı boş olamaz."));
    if (silo.Sira !== null && silo.Sira !== undefined && silo.Sira !== "") {
      var siloSira = oku(silo.Sira);
      if (isNaN(siloSira)) hatalar.push(kayit(ALAN, "Sıra sayı olmalı. Girilen: \"" + String(silo.Sira) + "\"."));
      else if (siloSira < 0) hatalar.push(kayit(ALAN, "Sıra negatif olamaz. Girilen: " + YU.fmt.sayi(siloSira) + "."));
    }
    if (isNaN(kapasite)) {
      hatalar.push(kayit(ALAN, "Kapasite sayı olmalı. Girilen: \"" + String(silo.Kapasite) + "\"."));
    } else if (kapasite <= 0) {
      /* 0 kapasite D15'i o silo için tamamen kapatır: tüm kapasite kontrolleri
         "kapasite > 0" şartlıdır. Sessiz kapanmasın (DUZELTME-PLANI M9,
         kullanıcı kararı 24.08.2026: 0 reddedilir). */
      hatalar.push(kayit(ALAN, kapasite < 0
        ? "Kapasite negatif olamaz. Girilen: " + kg(kapasite) + "."
        : "Kapasite 0 olamaz — 0 kapasite, D15 kapasite kontrolünü bu silo için devre dışı bırakır."));
    }

    for (i = 0; i < depo.silolar.length; i++) {
      s = depo.silolar[i];
      if (s.Id !== silo.Id && ad && anahtarla(s.Ad) === ad) {
        hatalar.push(kayit(ALAN, "\"" + silo.Ad + "\" adında bir silo zaten var. Silo adı tekil olmalı."));
        break;
      }
    }

    return { hatalar: hatalar };
  }

  /* ---------- Devir stok ---------- */

  function alan(nesne, buyuk, kucuk) {
    return nesne[buyuk] !== undefined && nesne[buyuk] !== null ? nesne[buyuk] : nesne[kucuk];
  }

  /* devir hem tablo satırı (MalzemeId/DevirTarihi/Miktar) hem servis girdisi
     (malzemeId/devirTarihi/miktar) biçiminde gelebilir. */
  function devirDogrula(depo, devir, tip) {
    var hatalar = [], i, d;
    var siloMu = tip === "Silo";
    var tablo = siloMu ? depo.siloDevirStok : depo.devirStok;
    var sahipTablo = siloMu ? depo.silolar : depo.malzemeler;
    var sahipId = kimlik(siloMu ? alan(devir, "SiloId", "siloId") : alan(devir, "MalzemeId", "malzemeId"));
    var tarih = alan(devir, "DevirTarihi", "devirTarihi");
    var miktar = oku(alan(devir, "Miktar", "miktar"));
    var sahip = sahipId === null ? null : satirBul(sahipTablo, sahipId);
    var etiket = siloMu ? "Silo" : "Malzeme";

    if (tip !== "Silo" && tip !== "Malzeme") {
      hatalar.push(kayit(ALAN, "Devir tipi \"Malzeme\" veya \"Silo\" olmalı. Girilen: \"" + String(tip) + "\"."));
      return { hatalar: hatalar };
    }
    if (!sahip) hatalar.push(kayit(ALAN, etiket + " bulunamadı (Id: " + String(sahipId) + ")."));

    /* Dökme kuru küspenin devri ELLE GİRİLEMEZ (Şartname §5 KRİTİK kural):
       stoğu siloların toplamı olduğu için açılışı da silo devirlerinin
       toplamıdır. Satır servis katmanında silo devirlerine kenetli tutulur
       (04-servis · dokmeDevriniEsitle); elle yazılabilseydi iki kaynak
       birbirinden kayar ve aynı gün aynı ürün için iki rakam oluşurdu. */
    if (!siloMu && sahip && sahip.OzelTip === "DokmeKuruKuspe") {
      hatalar.push(kayit(ALAN, "\"" + sahip.Ad + "\" devri elle girilemez: stoğu siloların toplamı " +
        "olduğu için devri de silo devirlerinin toplamıdır (Şartname §5). Silo devirlerini " +
        "değiştirin, bu satır kendiliğinden güncellenir."));
    }
    if (!gecerliTarih(tarih)) hatalar.push(kayit(ALAN, "Devir tarihi geçersiz: \"" + String(tarih) + "\"."));
    if (isNaN(miktar)) {
      hatalar.push(kayit(ALAN, "Devir miktarı sayı olmalı. Girilen: \"" + String(alan(devir, "Miktar", "miktar")) + "\"."));
    } else if (miktar < 0) {
      hatalar.push(kayit(ALAN, "Devir miktarı negatif olamaz. Girilen: " + kg(miktar) + "."));
    } else if (miktar !== Math.round(miktar)) {
      tamSayiDenetle(hatalar, "Devir miktarı", miktar);
    } else if (siloMu && sahip && Number(sahip.Kapasite) > 0 && miktar - Number(sahip.Kapasite) > 0.01) {
      /* D15'in devir ayağı (kullanıcı kararı, 21.08.2026): açılış stoğu da
         silo kapasitesini aşamaz. */
      hatalar.push(kayit("D15", sahip.Ad + " devri " + kg(miktar) + " girilemez; kapasitesi " +
        kg(Number(sahip.Kapasite)) + ". Kapasite aşılamaz — kayıt engellendi."));
    }

    if (sahip && gecerliTarih(tarih)) {
      for (i = 0; i < tablo.length; i++) {
        d = tablo[i];
        if (d.Id === devir.Id) continue;
        if ((siloMu ? d.SiloId : d.MalzemeId) === sahip.Id && d.DevirTarihi === tarih) {
          hatalar.push(kayit(ALAN, "\"" + sahip.Ad + "\" için " + tr(tarih) +
            " tarihli devir kaydı zaten var (" + kg(d.Miktar) + "). Aynı tarihte ikinci devir açılamaz."));
          break;
        }
      }
    }

    return { hatalar: hatalar };
  }

  YU.dogrula = {
    KURALLAR: KURALLAR,
    kuruKuspeKaydi: kuruKuspeKaydi,
    kuruKuspeIleriEngeller: kuruKuspeIleriEngeller,
    gunSilme: gunSilme,
    malzemeHareketi: malzemeHareketi,
    manuelHareket: manuelHareket,
    GEREKCE_ENAZ: GEREKCE_ENAZ,                        /* M32 — ekranlar eşiği buradan okur */
    kapasiteGerekcesiGecerli: kapasiteGerekcesiGecerli,
    kullanici: kullaniciDogrula,
    malzeme: malzemeDogrula,
    silo: siloDogrula,
    devir: devirDogrula,
    ileriBakiye: ileriBakiye,
    malzemeIlkNegatifGun: malzemeIlkNegatifGun,
    ileriKapasite: ileriKapasite,
    d15IleriMesaji: d15IleriMesaji,
    d14Mesaji: d14Mesaji,
    malzemeNegatifGunleri: malzemeNegatifGunleri,
    enEskiDevir: enEskiDevir
  };
})();

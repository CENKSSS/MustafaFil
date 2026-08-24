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
    { kod: "D15", tur: "Hata", metin: "Bir silonun gün sonu bakiyesi o silonun kapasitesini aşamaz — kayıt engellenir. (Kullanıcı kararı, 21.08.2026; şartname v2'de yumuşak uyarıydı.)" },
    { kod: "D16", tur: "Hata", metin: "Kayıt güncellenirken RowVersion değeri okunduğu andakinden farklıysa işlem reddedilir; kullanıcıya kaydın değiştiği söylenir ve yenilemesi istenir." },
    { kod: "D17", tur: "Hata", metin: "Gelecek bir tarihe üretim veya satış kaydı girilemez. Henüz gerçekleşmemiş bir günün rakamı olamaz. (Şartnamede yok — prototipte eklendi.)" }
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

  /* ---------- D14 motoru: ileri bakiye ---------- */

  /* taslak = {tarih, silinecekKaynakId, yeniHareketler:[{siloId,GirenKg,CikanKg}], silTarih}
     taslak null ise depo bugünkü hâliyle taranır (Silo Durumu uyarı satırı).
     Her silo için gün gün tek geçiş yapılır; negatife düşen İLK gün döner. */
  function ileriBakiye(depo, baslangicTarih, taslak) {
    var netler = {};   // siloId -> {tarih: netDegisim}
    var i, h, siloId, tarih, y;
    var silinecekKaynak = taslak && taslak.silinecekKaynakId !== null && taslak.silinecekKaynakId !== undefined
      ? taslak.silinecekKaynakId : null;
    var silTarih = taslak && taslak.silTarih ? taslak.silTarih : null;

    function ekle(id, gun, deger) {
      var g = netler[id] || (netler[id] = {});
      g[gun] = YU.yuvarla((g[gun] || 0) + deger);
    }

    for (i = 0; i < depo.siloHareket.length; i++) {
      h = depo.siloHareket[i];
      if (silinecekKaynak !== null && h.KaynakKayitId === silinecekKaynak) continue;
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

    var tol = tolerans();
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
        if (bakiye < -tol && (!baslangicTarih || tarih >= baslangicTarih)) {
          var silo = satirBul(depo.silolar, siloId);
          sonuc.push({
            siloId: siloId,
            siloAd: silo ? silo.Ad : "Silo #" + siloId,
            tarih: tarih,
            bakiye: bakiye
          });
          break;                          // silo başına ilk patlama yeter
        }
      }
    }

    sonuc.sort(function (a, b) {
      if (a.tarih !== b.tarih) return a.tarih < b.tarih ? -1 : 1;
      return a.siloId - b.siloId;
    });
    return sonuc;
  }

  function d14Mesaji(n) {
    return n.siloAd + " bakiyesi " + tr(n.tarih) + " günü " + kg(n.bakiye) +
      "'a düşüyor. Sonraki günler negatife düştüğü için işlem reddedildi.";
  }

  /* ---------- Kuru küspe günlük kaydı: D1–D7, D13, D15, D16 ---------- */

  function kuruKuspeKaydi(depo, girdi) {
    var hatalar = [], uyarilar = [];
    var tarih = girdi.tarih;
    var uretilen = oku(girdi.uretilenDokme);
    var cuvalAdet = oku(girdi.cuvalAdet);
    var satilan = oku(girdi.satilanDokme);

    if (!gecerliTarih(tarih)) {
      hatalar.push(kayit(ALAN, "Tarih geçersiz. Beklenen biçim: GG.AA.YYYY. Girilen: \"" + String(tarih) + "\"."));
    } else if (gelecekTarihMi(tarih)) {
      hatalar.push(d17(tarih));
    }

    /* D1 */
    if (isNaN(uretilen)) {
      hatalar.push(kayit("D1", "Üretilen dökme küspe sayı olmalı. Girilen: \"" + String(girdi.uretilenDokme) + "\"."));
    } else if (uretilen < 0) {
      hatalar.push(kayit("D1", tr(tarih) + " — üretilen dökme küspe negatif olamaz. Girilen: " + kg(uretilen) + "."));
    }

    /* D2 */
    if (isNaN(cuvalAdet)) {
      hatalar.push(kayit("D2", "Çuval adedi sayı olmalı. Girilen: \"" + String(girdi.cuvalAdet) + "\"."));
    } else if (cuvalAdet < 0) {
      hatalar.push(kayit("D2", tr(tarih) + " — çuval adedi negatif olamaz. Girilen: " + YU.fmt.sayi(cuvalAdet) + " adet."));
    } else if (cuvalAdet !== Math.round(cuvalAdet)) {
      hatalar.push(kayit("D2", "Çuval adedi tam sayı olmalı. Girilen: " + YU.fmt.sayi(cuvalAdet, 3) + " adet."));
    }

    /* D13 — satılan dökme sayısal denetimi */
    if (isNaN(satilan)) {
      hatalar.push(kayit("D13", "Satılan dökme küspe sayı olmalı. Girilen: \"" + String(girdi.satilanDokme) + "\"."));
    } else if (satilan < 0) {
      hatalar.push(kayit("D13", tr(tarih) + " — satılan dökme küspe negatif olamaz. Girilen: " + kg(satilan) + "."));
    }

    /* Ham girdi bozuksa türetilmiş kontroller anlamsız sayı üretir; burada durulur. */
    if (hatalar.length) return { hatalar: hatalar, uyarilar: uyarilar };

    var h = YU.hesap.kuruKuspe(uretilen, cuvalAdet, satilan);
    var topYerlestirme = toplamMiktar(girdi.yerlestirmeler);
    var topCekis = toplamMiktar(girdi.cekisler);
    var topSatisCekis = toplamMiktar(girdi.satisCekisleri);
    var tol = tolerans();

    negatifSatirlar(girdi.yerlestirmeler, "D3", "Siloya yerleştirme", hatalar);
    negatifSatirlar(girdi.cekisler, "D5", "Silodan çekiş", hatalar);
    negatifSatirlar(girdi.satisCekisleri, "D13", "Dökme satış çekişi", hatalar);

    /* D3 */
    if (!esit(topYerlestirme, h.netDokmeUretim)) {
      hatalar.push(kayit("D3", "Silolara yerleştirilen toplam " + kg(topYerlestirme) +
        ", net dökme üretim " + kg(h.netDokmeUretim) + " ile eşleşmiyor. Fark: " +
        kg(YU.yuvarla(Math.abs(h.netDokmeUretim - topYerlestirme))) + "."));
    }

    /* D4 */
    if (h.netDokmeUretim === 0 && topYerlestirme > tol) {
      hatalar.push(kayit("D4", "Net dökme üretim 0 kg olduğu hâlde silolara " + kg(topYerlestirme) +
        " yerleştirilmiş. Çuvallanan (" + kg(h.cuvalKg) + "), üretilen dökmeden (" + kg(uretilen) +
        ") fazla olduğu için o gün siloya giriş yapılamaz."));
    }

    /* D5 */
    if (!esit(topCekis, h.silodanCekilecek)) {
      hatalar.push(kayit("D5", "Silolardan çekilen toplam " + kg(topCekis) +
        ", hesaplanan çekiş " + kg(h.silodanCekilecek) + " ile eşleşmiyor. Fark: " +
        kg(YU.yuvarla(Math.abs(h.silodanCekilecek - topCekis))) + "."));
    }

    /* D6 */
    if (h.silodanCekilecek === 0 && topCekis > tol) {
      hatalar.push(kayit("D6", "Çuvallama için silodan çekiş gerekmiyor (üretilen dökme " + kg(uretilen) +
        ", çuvallanan " + kg(h.cuvalKg) + ") ama silolardan " + kg(topCekis) + " çekiş girilmiş."));
    }

    /* D13 */
    if (satilan > tol && topSatisCekis <= tol) {
      hatalar.push(kayit("D13", tr(tarih) + " — " + kg(satilan) +
        " dökme satış girilmiş ama hiçbir silodan çekiş yapılmamış. Dökme küspe yalnızca silolarda durduğu için satışın silo karşılığı olmak zorundadır."));
    } else if (!esit(topSatisCekis, satilan)) {
      hatalar.push(kayit("D13", "Dökme satış için silolardan çekilen toplam " + kg(topSatisCekis) +
        ", girilen satılan dökme " + kg(satilan) + " ile eşleşmiyor. Fark: " +
        kg(YU.yuvarla(Math.abs(satilan - topSatisCekis))) + "."));
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
         silinecekleri için doğru davranış budur (Şartname §5, §8 D7). */
      gunBasi = YU.stok.siloGunBasi(depo, siloId, tarih);

      if (cikan > tol && cikan - gunBasi > tol) {
        hatalar.push(kayit("D7", silo.Ad + " silosundan " + tr(tarih) + " günü toplam " + kg(cikan) +
          " çekilmek isteniyor (çuvallama " + kg(cek) + " + dökme satış " + kg(sat) +
          ") ama gün başı mevcudu " + kg(gunBasi) + ". Aşım: " + kg(YU.yuvarla(cikan - gunBasi)) + "."));
      }

      /* D15 — yerleştirilen miktar değil, oluşan gün sonu bakiyesi ölçülür.
         SERT ENGEL (kullanıcı kararı, 21.08.2026): şartname v2 bunu yumuşak
         uyarı tanımlar; fabrika kararıyla kapasite aşan kayıt reddedilir. */
      gunSonu = YU.yuvarla(gunBasi + giren - cikan);
      kapasite = Number(silo.Kapasite) || 0;
      if (kapasite > 0 && gunSonu - kapasite > tol) {
        hatalar.push(kayit("D15", silo.Ad + " gün sonu bakiyesi " + kg(gunSonu) + " olur; kapasitesi " +
          kg(kapasite) + ". Aşım: " + kg(YU.yuvarla(gunSonu - kapasite)) + " (" + tr(tarih) +
          "). Kapasite aşılamaz — kayıt engellendi."));
      }
    }

    /* D16 */
    if (girdi.rowVersion !== null && girdi.rowVersion !== undefined) {
      var mevcut = kuruKuspeGunuBul(depo, tarih);
      if (!mevcut) {
        hatalar.push(kayit("D16", tr(tarih) + " gününe ait kayıt artık yok — siz ekranı açtıktan sonra silinmiş. Sayfayı yenileyip yeniden deneyin."));
      } else if (Number(mevcut.RowVersion) !== Number(girdi.rowVersion)) {
        hatalar.push(kayit("D16", tr(tarih) + " günü siz ekranı açtıktan sonra başkası tarafından güncellenmiş (sürüm " +
          YU.fmt.sayi(Number(girdi.rowVersion)) + " → " + YU.fmt.sayi(Number(mevcut.RowVersion)) +
          "). Kaydınız yazılmadı; sayfayı yenileyip yeniden deneyin."));
      }
    }

    return { hatalar: hatalar, uyarilar: uyarilar };
  }

  /* ---------- Gün silme: D14 ---------- */

  function gunSilme(depo, tarih) {
    var hatalar = [], i, n, negatifler;

    if (!gecerliTarih(tarih)) {
      return { hatalar: [kayit(ALAN, "Tarih geçersiz: \"" + String(tarih) + "\".")] };
    }

    var varMi = kuruKuspeGunuBul(depo, tarih) !== null;
    if (!varMi) {
      for (i = 0; i < depo.gunlukHareket.length; i++) {
        if (depo.gunlukHareket[i].Tarih === tarih) { varMi = true; break; }
      }
    }
    if (!varMi) {
      hatalar.push(kayit(ALAN, tr(tarih) + " tarihinde silinecek kayıt yok."));
      return { hatalar: hatalar };
    }

    negatifler = ileriBakiye(depo, tarih, { tarih: tarih, silTarih: tarih, yeniHareketler: [] });
    for (i = 0; i < negatifler.length; i++) {
      n = negatifler[i];
      hatalar.push(kayit("D14", tr(tarih) + " silinirse " + n.siloAd + " bakiyesi " + tr(n.tarih) +
        " günü " + kg(n.bakiye) + "'a düşer. Önce o günü düzeltin veya silin."));
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
    }
    if (!malzeme) {
      hatalar.push(kayit(ALAN, "Malzeme bulunamadı (Id: " + String(girdi.malzemeId) + ")."));
      return { hatalar: hatalar, uyarilar: uyarilar };
    }
    if (!malzeme.Aktif) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" pasif durumda; yeni hareket girilemez. (D12 — malzeme silinmez, pasifleştirilir.)"));
    }

    if (uretim !== null && isNaN(uretim)) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" üretim miktarı sayı olmalı. Girilen: \"" + String(girdi.uretim) + "\"."));
    } else if (uretim !== null && uretim < 0) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" üretim miktarı negatif olamaz. Girilen: " + kg(uretim) + "."));
    }
    if (satis !== null && isNaN(satis)) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" satış miktarı sayı olmalı. Girilen: \"" + String(girdi.satis) + "\"."));
    } else if (satis !== null && satis < 0) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" satış miktarı negatif olamaz. Girilen: " + kg(satis) + "."));
    }

    /* İade (kullanıcı direktifi, 24.08.2026): stokta üretim gibi davranır,
       ayrı alanda saklanır; satış rakamına dokunmaz. REVİZE (24.08.2026):
       iade yalnız STOKTA görünür, siloya GİRMEZ. Bu yüzden dökme kuru
       küspeye iade girilemez: dökme stok siloların toplamıdır (Şartname §5
       Demirbaş) — siloya girmeyen iade dökme stoğunda görünemezdi. Çuvallı
       ve basit malzemelerde iade stoğa işler. */
    var iade = girdi.iade === null || girdi.iade === undefined ? null : oku(girdi.iade);
    if (iade !== null && isNaN(iade)) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" iade miktarı sayı olmalı. Girilen: \"" + String(girdi.iade) + "\"."));
    } else if (iade !== null && iade < 0) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" iade miktarı negatif olamaz. Girilen: " + kg(iade) + "."));
    } else if (iade !== null && iade > 0 && malzeme.OzelTip === "DokmeKuruKuspe") {
      hatalar.push(kayit(ALAN, "Dökme kuru küspeye iade girilemez: dökme stok siloların toplamıdır " +
        "(Şartname §5) ve iade siloya girmediği için stokta gösterilemez."));
    }

    if (hatalar.length) return { hatalar: hatalar, uyarilar: uyarilar };

    var mevcut = gunlukHareketBul(depo, tarih, malzeme.Id);

    /* Kilitli kolonlar (Şartname §4, §7): dökme kuru küspenin iki kolonu da,
       çuvallı kuru küspenin üretim kolonu da Kuru Küspe Günlük Giriş'ten gelir.
       Kilit ALAN bazlıdır (24.08.2026): dökmeye İADE girilebilir — iade
       üretim/satış kolonu değildir, silo seçimiyle ayrıca denetlenir. */
    var uretimVerildi = !(girdi.uretim === null || girdi.uretim === undefined || girdi.uretim === "");
    var satisVerildi = !(girdi.satis === null || girdi.satis === undefined || girdi.satis === "");
    if (malzeme.OzelTip === "DokmeKuruKuspe" && (uretimVerildi || satisVerildi)) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" üretim ve satış kolonları kilitlidir; her ikisi de Kuru Küspe Günlük Giriş ekranından gelir."));
    } else if (malzeme.OzelTip === "CuvalKuruKuspe" && uretimVerildi &&
               !esit(uretim, mevcut ? Number(mevcut.Uretim) || 0 : 0)) {
      hatalar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" üretim kolonu kilitlidir; çuvallanan adetten otomatik hesaplanır (1 çuval = " +
        YU.fmt.sayi(YU.hesap.CUVAL_KG) + " kg). Bu ekrandan yalnızca satış girilir."));
    }

    /* D16 */
    if (girdi.rowVersion !== null && girdi.rowVersion !== undefined) {
      if (!mevcut) {
        hatalar.push(kayit("D16", tr(tarih) + " / \"" + malzeme.Ad + "\" kaydı artık yok — siz ekranı açtıktan sonra silinmiş. Sayfayı yenileyin."));
      } else if (Number(mevcut.RowVersion) !== Number(girdi.rowVersion)) {
        hatalar.push(kayit("D16", tr(tarih) + " / \"" + malzeme.Ad + "\" kaydı siz ekranı açtıktan sonra güncellenmiş (sürüm " +
          YU.fmt.sayi(Number(girdi.rowVersion)) + " → " + YU.fmt.sayi(Number(mevcut.RowVersion)) + "). Sayfayı yenileyip yeniden deneyin."));
      }
    }

    if (hatalar.length) return { hatalar: hatalar, uyarilar: uyarilar };

    /* Şartname §13 Soru 3 önerisi: basit malzeme stoğu negatife düşerse UYARI,
       engelleme yok — sert engel, giriş sırası bozuk olduğunda operatörü kilitler. */
    if (!malzeme.OzelTip) {
      var negatif = malzemeIlkNegatifGun(depo, malzeme, tarih,
        uretim === null ? (mevcut ? Number(mevcut.Uretim) || 0 : 0) : uretim,
        satis === null ? (mevcut ? Number(mevcut.Satis) || 0 : 0) : satis);
      if (negatif) {
        uyarilar.push(kayit(ALAN, "\"" + malzeme.Ad + "\" stoğu " + tr(negatif.tarih) + " günü " +
          kg(negatif.bakiye) + "'a düşüyor. Kayıt engellenmedi; giriş sırasını kontrol edin."));
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
    gunler[tarih] = YU.yuvarla((gunler[tarih] || 0) + yeniUretim - yeniSatis);

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

  /* ---------- Kullanıcı: D9, D10, D11, D12 ---------- */

  /* islemiYapan üçüncü parametredir: D9 "kendi hesabı" karşılaştırması için
     işlemi yapan kullanıcı bilinmek zorunda. Verilmezse D9 atlanır. */
  function kullaniciDogrula(depo, kullanici, islemiYapan) {
    var hatalar = [], i, k;
    var mevcut = kullanici.Id ? satirBul(depo.kullanicilar, kullanici.Id) : null;
    var aktif = kullanici.Aktif !== false;
    var rol = kullanici.Rol;

    if (bosMu(kullanici.KullaniciAdi)) hatalar.push(kayit(ALAN, "Kullanıcı adı boş olamaz."));
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
          hatalar.push(kayit("D11", "\"" + kullanici.KullaniciAdi + "\" kullanıcı adı zaten kullanılıyor (" +
            k.AdSoyad + "). Aynı kullanıcı adı iki kez eklenemez."));
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
    } else if (kapasite < 0) {
      hatalar.push(kayit(ALAN, "Kapasite negatif olamaz. Girilen: " + kg(kapasite) + "."));
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
    if (!gecerliTarih(tarih)) hatalar.push(kayit(ALAN, "Devir tarihi geçersiz: \"" + String(tarih) + "\"."));
    if (isNaN(miktar)) {
      hatalar.push(kayit(ALAN, "Devir miktarı sayı olmalı. Girilen: \"" + String(alan(devir, "Miktar", "miktar")) + "\"."));
    } else if (miktar < 0) {
      hatalar.push(kayit(ALAN, "Devir miktarı negatif olamaz. Girilen: " + kg(miktar) + "."));
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
    gunSilme: gunSilme,
    malzemeHareketi: malzemeHareketi,
    kullanici: kullaniciDogrula,
    malzeme: malzemeDogrula,
    silo: siloDogrula,
    devir: devirDogrula,
    ileriBakiye: ileriBakiye,
    d14Mesaji: d14Mesaji
  };
})();

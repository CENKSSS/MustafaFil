/* js/33-analiz-veri.js — Analiz veri katmanı (YU.analiz).

   Analizler ekranı ile soru-cevap motorunun ORTAK hesap katmanı. İkisi de
   rakamı buradan alır; böylece ekranda yazan sayı ile cevapta geçen sayı
   aynı koddan gelir, ayrışamaz.

   Temel kural (kullanıcı isteği, 23.08.2026): karşılaştırma takvim
   tarihine göre değil KAMPANYA GÜNÜNE göre yapılır. Devir günü 1. gündür;
   bu kampanyanın N. günü, geçmiş kampanyanın N. günüyle karşılaştırılır.
   22.07'de başlayan kampanyada 20.08 = 30. gün; 10.06'da başlayan
   kampanyada 30. gün = 09.07.

   Bu dosya depoya YAZMAZ. Yalnızca okur ve hesaplar. */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});
  var analiz = YU.analiz = {};

  function kendinin(nesne, anahtar) {
    return Object.prototype.hasOwnProperty.call(nesne, anahtar);
  }

  function sayi(v) {
    return (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
  }

  /* ==================================================================
     1. Göstergeler — neyin karşılaştırılabileceği
     Kuru küspe kalemleri KuruKuspeGunluk'tan (kk), diğer malzemeler
     GunlukHareket'ten (gh) okunur. Dökme malzemenin GunlukHareket satırı
     çuvallama düşülmüş NET üretimdir; burada BRÜT üretim (UretilenDokme)
     karşılaştırılır, çuvallama ayrı gösterge olarak durur.
     ================================================================== */

  analiz.gostergeler = function (depo) {
    var liste = [
      { kod: 'dokme-uretim', ad: 'Dökme Küspe Üretimi (Brüt)', kisaAd: 'dökme küspe üretimi',
        birim: 'kg', tur: 'uretim', kaynak: 'kk', alan: 'UretilenDokme', malzemeAd: 'Dökme Kuru Küspe' },
      { kod: 'dokme-satis', ad: 'Dökme Küspe Satışı', kisaAd: 'dökme küspe satışı',
        birim: 'kg', tur: 'satis', kaynak: 'kk', alan: 'SatilanDokme', malzemeAd: 'Dökme Kuru Küspe' },
      { kod: 'cuvallama', ad: 'Çuvallama', kisaAd: 'çuvallama',
        birim: 'adet', tur: 'cuvallama', kaynak: 'kk', alan: 'CuvalAdet', malzemeAd: 'Kuru Küspe (50 Kg)' }
    ];

    var veriliMalzeme = {}, i;
    for (i = 0; i < depo.gunlukHareket.length; i++) veriliMalzeme[depo.gunlukHareket[i].MalzemeId] = true;

    var malzemeler = depo.malzemeler.slice().sort(function (a, b) {
      return (Number(a.Sira) || 0) - (Number(b.Sira) || 0) || (Number(a.Id) || 0) - (Number(b.Id) || 0);
    });
    for (i = 0; i < malzemeler.length; i++) {
      var m = malzemeler[i];
      if (m.OzelTip === 'DokmeKuruKuspe') continue;                 /* yukarıda: brüt üretim + satış */
      if (m.Aktif === false && !veriliMalzeme[m.Id]) continue;      /* pasif ve hiç verisi yok */
      if (m.OzelTip !== 'CuvalKuruKuspe') {                         /* çuvallının üretimi = çuvallama */
        liste.push({
          kod: 'm' + m.Id + '-uretim', ad: m.Ad + ' · Üretim', kisaAd: m.Ad + ' üretimi',
          birim: 'kg', tur: 'uretim', kaynak: 'gh', alan: 'Uretim', malzemeId: m.Id, malzemeAd: m.Ad
        });
      }
      liste.push({
        kod: 'm' + m.Id + '-satis', ad: m.Ad + ' · Satış', kisaAd: m.Ad + ' satışı',
        birim: 'kg', tur: 'satis', kaynak: 'gh', alan: 'Satis', malzemeId: m.Id, malzemeAd: m.Ad
      });
    }
    return liste;
  };

  analiz.gostergeBul = function (liste, kod) {
    for (var i = 0; i < liste.length; i++) if (liste[i].kod === kod) return liste[i];
    return null;
  };

  /* Malzeme + tür ikilisinden gösterge bulur: (Toprak, satis) -> m7-satis.
     Dökme kuru küspe ve çuvallı küspe özel yollardan geçer. */
  analiz.gostergeSec = function (liste, malzemeId, tur, ozelTip) {
    var i, g;
    if (ozelTip === 'DokmeKuruKuspe') {
      for (i = 0; i < liste.length; i++) {
        g = liste[i];
        if (g.kod === 'dokme-uretim' && tur === 'uretim') return g;
        if (g.kod === 'dokme-satis' && tur === 'satis') return g;
      }
    }
    if (ozelTip === 'CuvalKuruKuspe' && tur === 'uretim') {
      return analiz.gostergeBul(liste, 'cuvallama');
    }
    for (i = 0; i < liste.length; i++) {
      g = liste[i];
      if (g.malzemeId === malzemeId && g.tur === tur) return g;
    }
    return null;
  };

  /* ==================================================================
     2. Kampanya verisi — gün sırasına göre okuma
     ================================================================== */

  /* Dönem: YU.donem.liste() ögesi {ad, bas, bit, kayitliGun}. */
  analiz.kampanyaVerisi = function (depo, donem) {
    var kayitli = {}, kk = {}, gh = {}, i, h;
    var gunler = YU.stok.kayitliGunler(depo, donem.bas, donem.bit);
    for (i = 0; i < gunler.length; i++) kayitli[gunler[i].tarih] = true;
    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      h = depo.kuruKuspeGunluk[i];
      if (h.Tarih >= donem.bas && h.Tarih <= donem.bit) kk[h.Tarih] = h;
    }
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (h.Tarih >= donem.bas && h.Tarih <= donem.bit) gh[h.Tarih + '|' + h.MalzemeId] = h;
    }
    var sonGun = YU.tarih.fark(donem.bas, donem.bit) + 1;    /* son kayıtlı günün sırası */
    if (!isFinite(sonGun) || sonGun < 1) sonGun = 1;
    return { donem: donem, kayitli: kayitli, kk: kk, gh: gh, sonGun: sonGun, kayitliGun: gunler.length };
  };

  /* Kampanyanın n. gününün takvim tarihi (1 tabanlı). */
  analiz.gunTarihi = function (veri, gun) {
    return YU.tarih.ekle(veri.donem.bas, Math.max(0, (Number(gun) || 1) - 1));
  };

  /* Gün kayıtlıysa değer (satır yoksa 0), gün hiç girilmemişse null. */
  analiz.gunDegeri = function (veri, gosterge, tarih) {
    if (!veri.kayitli[tarih]) return null;
    var satir = gosterge.kaynak === 'kk' ? veri.kk[tarih] : veri.gh[tarih + '|' + gosterge.malzemeId];
    return satir ? (Number(satir[gosterge.alan]) || 0) : 0;
  };

  /* n günlük dizi: gunluk[i] = (i+1). günün değeri; birikimli[i] = o güne
     kadarki toplam. Son kayıtlı günden sonrası null (çizgi orada biter). */
  analiz.seri = function (veri, gosterge, n) {
    var gunluk = [], birikimli = [], toplam = 0, kayitliGun = 0, i;
    for (i = 0; i < n; i++) {
      var icerde = i < veri.sonGun;
      var v = icerde ? analiz.gunDegeri(veri, gosterge, analiz.gunTarihi(veri, i + 1)) : null;
      gunluk.push(v);
      if (v !== null) { toplam = YU.yuvarla(toplam + v); kayitliGun++; }
      birikimli.push(icerde ? toplam : null);
    }
    return { gunluk: gunluk, birikimli: birikimli, toplam: toplam, kayitliGun: kayitliGun };
  };

  /* Bugün bu kampanyanın kaçıncı günü: 1. gün = devir günü. Bugün son
     kayıtlı günün ilerisindeyse son kayıtlı güne çekilir. */
  analiz.bugunkuGun = function (veri) {
    var ham = YU.tarih.fark(veri.donem.bas, YU.tarih.bugun()) + 1;
    if (!isFinite(ham) || ham < 1) ham = veri.sonGun;
    return { ham: ham, gun: Math.max(1, Math.min(ham, veri.sonGun)) };
  };

  /* ==================================================================
     3. Özet — iki kampanya + karşılaştırma günü
     ================================================================== */

  analiz.donemBul = function (ad) {
    var l = YU.donem.liste();
    for (var i = 0; i < l.length; i++) if (l[i].ad === ad) return l[i];
    return null;
  };

  /* Verilen dönemden bir öncekini döndürür (devir tarihine göre sıralı liste). */
  analiz.oncekiDonem = function (donem) {
    var l = YU.donem.liste(), i = l.indexOf(donem);
    if (i < 0) for (i = 0; i < l.length; i++) if (l[i].ad === donem.ad) break;
    return l[i - 1] || null;
  };

  /* Kampanyanın n. gününü takvim tarihinden bulur (1 tabanlı, aralık dışı
     tarih uçlara kırpılır). Ekrandaki tarih seçici bunu kullanır. */
  analiz.tarihGunu = function (veri, iso) {
    var g = YU.tarih.fark(veri.donem.bas, iso) + 1;
    if (!isFinite(g)) return null;
    return Math.max(1, g);
  };

  /* Ekranın ve cevap motorunun ortak durum nesnesi.
       buAd / gecmisAd — null ise varsayılan seçilir.
       aralik         — {basGun, bitGun} kampanya günü aralığı; verilmezse
                        kampanyanın TAMAMI (1. gün … bugün) kullanılır. */
  analiz.ozet = function (depo, buAd, gecmisAd, aralik) {
    var donemler = YU.donem.liste();
    if (!donemler.length) return null;

    var buDonem = (buAd && analiz.donemBul(buAd)) || YU.donem.aktif() || donemler[donemler.length - 1];
    var gecmisDonem = null;
    if (gecmisAd && gecmisAd !== buDonem.ad) gecmisDonem = analiz.donemBul(gecmisAd);
    if (!gecmisDonem) {
      var sira = donemler.indexOf(buDonem);
      gecmisDonem = donemler[sira - 1] || donemler[sira + 1] || null;
    }

    var bu = analiz.kampanyaVerisi(depo, buDonem);
    var gecmis = gecmisDonem ? analiz.kampanyaVerisi(depo, gecmisDonem) : null;
    var bugun = analiz.bugunkuGun(bu);

    /* ANALİZ PENCERESİ varsayılan olarak kampanyanın TAMAMIDIR
       (1. gün … bugün). Kullanıcı üstteki tarih aralığından daraltabilir.
       Geçmiş kampanyanın kaydı erken bitiyorsa bu, pencereyi kısaltmaz —
       yalnızca FARKIN hesaplanabildiği son günü (ortakBit) kısıtlar.
       (Kullanıcı düzeltmesi, 23.08.2026: önceki sürüm bütün ekranı ortak
       gün sayısına sıkıştırıyordu; kampanyanın hiçbir günü diğerinden
       önemli değildir.) */
    var sonGun = bugun.gun;
    var basGun = 1, bitGun = sonGun;
    if (aralik) {
      if (isFinite(aralik.basGun) && aralik.basGun > 0) {
        basGun = Math.min(Math.max(1, Math.round(aralik.basGun)), sonGun);
      }
      if (isFinite(aralik.bitGun) && aralik.bitGun > 0) {
        bitGun = Math.min(Math.max(basGun, Math.round(aralik.bitGun)), sonGun);
      }
      if (bitGun < basGun) bitGun = basGun;
    }
    var ortakBit = gecmis ? Math.min(bitGun, gecmis.sonGun) : bitGun;
    if (ortakBit < basGun) ortakBit = basGun;

    return {
      donemler: donemler,
      bu: bu,
      gecmis: gecmis,
      bugun: bugun,
      sonGun: sonGun,
      basGun: basGun,
      bitGun: bitGun,
      gunSayisi: bitGun - basGun + 1,
      tamAralikMi: basGun === 1 && bitGun === sonGun,
      ortakBit: ortakBit,
      ortakGun: ortakBit - basGun + 1,
      /* Geçmiş kampanyanın seçilen aralıkta hiç kaydı yoksa karşılaştırma
         yapılamaz; kısıt bundan farklıdır (kısıt = kısmen karşılaştırılabilir). */
      gecmisKapsiyorMu: !gecmis || gecmis.sonGun >= basGun,
      kisitliMi: !!gecmis && ortakBit < bitGun,
      analizGunu: bitGun,
      gostergeler: analiz.gostergeler(depo)
    };
  };

  /* ==================================================================
     4. Karşılaştırma hesapları
     ================================================================== */

  analiz.yuzdeFark = function (bu, gecmis) {
    if (bu === null || gecmis === null || !isFinite(bu) || !isFinite(gecmis)) return null;
    if (!(Math.abs(gecmis) > 0)) return null;      /* sıfırdan artış yüzdesi tanımsızdır */
    return ((bu - gecmis) / Math.abs(gecmis)) * 100;
  };

  /* Tek göstergenin karşılaştırması.

     İKİ AYRI PENCERE vardır ve karıştırılmamalıdır:
       analiz penceresi (1 … gun)  — her iki kampanyanın KENDİ toplamı.
                                     Bu kampanyanın bütün günleri buradadır.
       ortak pencere    (1 … ortak) — farkın hesaplanabildiği günler.
     Fark ve yüzde ORTAK pencere üzerinden hesaplanır: 30 günlük toplamı
     5 günlük toplamla karşılaştırmak anlamsız olurdu. Ortak pencere,
     seçilmiş bir ayar değil, geçmiş kampanyanın kaydının nerede bittiğidir. */
  analiz.karsilastir = function (ozet, gosterge, aralik) {
    var bas = Math.max(1, Math.round((aralik && aralik.basGun) || ozet.basGun || 1));
    var bit = Math.max(bas, Math.round((aralik && aralik.bitGun) || ozet.bitGun || bas));
    var ortakBit = ozet.gecmis ? Math.max(bas, Math.min(bit, ozet.gecmis.sonGun)) : bit;

    var buP = analiz.pencere(ozet.bu, gosterge, bas, bit);
    var gecmisP = ozet.gecmis ? analiz.pencere(ozet.gecmis, gosterge, bas, bit) : null;

    var buOrtakP = ortakBit === bit ? buP : analiz.pencere(ozet.bu, gosterge, bas, ortakBit);
    var gecmisOrtakP = !ozet.gecmis ? null
      : (ortakBit === bit ? gecmisP : analiz.pencere(ozet.gecmis, gosterge, bas, ortakBit));

    var gecmisOrtak = gecmisOrtakP ? (gecmisOrtakP.kayitliGun ? gecmisOrtakP.toplam : null) : null;
    var fark = gecmisOrtak === null ? null : YU.yuvarla(buOrtakP.toplam - gecmisOrtak);

    return {
      gosterge: gosterge,
      basGun: bas,
      gun: bit,                                  /* pencerenin son günü */
      gunSayisi: bit - bas + 1,
      bu: buP.toplam,
      gecmis: gecmisP ? (gecmisP.kayitliGun ? gecmisP.toplam : null) : null,
      buGun: buP.gunler.length ? buP.gunler[buP.gunler.length - 1].deger : null,
      gecmisGun: gecmisP && gecmisP.gunler.length ? gecmisP.gunler[gecmisP.gunler.length - 1].deger : null,
      buPencere: buP,
      gecmisPencere: gecmisP,
      /* ortak pencere — farkın hesaplanabildiği son güne kadar */
      ortakBit: ortakBit,
      ortakGun: ortakBit - bas + 1,
      kisitliMi: ortakBit < bit,
      buOrtak: buOrtakP.toplam,
      gecmisOrtak: gecmisOrtak,
      fark: fark,
      yuzde: gecmisOrtak === null ? null : analiz.yuzdeFark(buOrtakP.toplam, gecmisOrtak)
    };
  };

  /* Bütün göstergeler için karşılaştırma; sıralama için hazır. */
  analiz.tumKarsilastirma = function (ozet, aralik) {
    var sonuc = [], i;
    for (i = 0; i < ozet.gostergeler.length; i++) {
      sonuc.push(analiz.karsilastir(ozet, ozet.gostergeler[i], aralik));
    }
    return sonuc;
  };

  /* Yüzdeye göre sıralar. yon: 'artan' en çok artanı başa, 'azalan' tersi.
     Yüzdesi tanımsız (geçmişi sıfır) olanlar sona atılır — sıralamayı
     bozmasınlar ama kaybolmasınlar da. */
  analiz.siralaFark = function (karsilastirmalar, yon) {
    var l = karsilastirmalar.slice();
    l.sort(function (a, b) {
      var ya = a.yuzde, yb = b.yuzde;
      if (ya === null && yb === null) return 0;
      if (ya === null) return 1;
      if (yb === null) return -1;
      return yon === 'azalan' ? ya - yb : yb - ya;
    });
    return l;
  };

  /* ==================================================================
     5. Gün penceresi, zirve, dip, ortalama
     ================================================================== */

  /* [basGun, bitGun] aralığındaki günler (1 tabanlı, iki uç dahil). */
  analiz.pencere = function (veri, gosterge, basGun, bitGun) {
    basGun = Math.max(1, Math.round(basGun || 1));
    bitGun = Math.max(basGun, Math.round(bitGun || basGun));
    var gunler = [], toplam = 0, kayitli = 0, g, v;
    for (g = basGun; g <= bitGun; g++) {
      v = g <= veri.sonGun ? analiz.gunDegeri(veri, gosterge, analiz.gunTarihi(veri, g)) : null;
      gunler.push({ gun: g, tarih: analiz.gunTarihi(veri, g), deger: v });
      if (v !== null) { toplam = YU.yuvarla(toplam + v); kayitli++; }
    }
    return {
      basGun: basGun, bitGun: bitGun, gunler: gunler, toplam: toplam,
      kayitliGun: kayitli, ortalama: kayitli ? YU.yuvarla(toplam / kayitli) : null
    };
  };

  /* En yüksek / en düşük gün. Kayıtsız günler yok sayılır. */
  analiz.ucNokta = function (veri, gosterge, basGun, bitGun, enBuyukMu) {
    var p = analiz.pencere(veri, gosterge, basGun, bitGun);
    var enIyi = null, i;
    for (i = 0; i < p.gunler.length; i++) {
      var o = p.gunler[i];
      if (o.deger === null) continue;
      if (!enIyi) { enIyi = o; continue; }
      if (enBuyukMu ? o.deger > enIyi.deger : o.deger < enIyi.deger) enIyi = o;
    }
    return enIyi;
  };

  analiz.zirve = function (veri, gosterge, basGun, bitGun) {
    return analiz.ucNokta(veri, gosterge, basGun, bitGun, true);
  };

  analiz.dip = function (veri, gosterge, basGun, bitGun) {
    return analiz.ucNokta(veri, gosterge, basGun, bitGun, false);
  };

  /* ==================================================================
     6. Stok ve silo — anlık durum (Şartname §5)
     ================================================================== */

  analiz.malzemeStok = function (depo, malzemeId, tarih) {
    return YU.stok.malzemeStok(depo, malzemeId, tarih || YU.tarih.bugun());
  };

  analiz.tumStok = function (depo, tarih) {
    return YU.stok.tumMalzemeler(depo, tarih || YU.tarih.bugun());
  };

  analiz.tumSilo = function (depo, tarih) {
    return YU.stok.tumSilolar(depo, tarih || YU.tarih.bugun());
  };

  analiz.siloToplami = function (depo, tarih) {
    var l = analiz.tumSilo(depo, tarih), mevcut = 0, kapasite = 0, i;
    for (i = 0; i < l.length; i++) {
      mevcut = YU.yuvarla(mevcut + (Number(l[i].mevcut) || 0));
      kapasite += Number(l[i].kapasite) || 0;
    }
    return {
      satirlar: l, mevcut: mevcut, kapasite: kapasite,
      doluluk: kapasite > 0 ? mevcut / kapasite : 0
    };
  };

  /* ==================================================================
     7. Malzeme arama — soru motorunun sözlüğü buradan beslenir
     ================================================================== */

  analiz.malzemeler = function (depo) {
    return depo.malzemeler.slice().sort(function (a, b) {
      return (Number(a.Sira) || 0) - (Number(b.Sira) || 0);
    });
  };

  analiz.malzemeIle = function (depo, id) {
    for (var i = 0; i < depo.malzemeler.length; i++) if (depo.malzemeler[i].Id === id) return depo.malzemeler[i];
    return null;
  };

  analiz.silolar = function (depo) {
    return depo.silolar.slice().sort(function (a, b) {
      return (Number(a.Sira) || 0) - (Number(b.Sira) || 0);
    });
  };

  /* Yardımcı: sayıyı güvenli okuma — dışarıya da açık. */
  analiz.sayi = sayi;
  analiz.kendinin = kendinin;
})();

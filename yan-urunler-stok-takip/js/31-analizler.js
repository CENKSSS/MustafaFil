/* js/31-analizler.js — Analizler ekranı (Yönetim Paneli, yalnızca Yönetici).

   Seçilen geçmiş kampanya ile bu kampanya, TAKVİM TARİHİNE GÖRE DEĞİL
   KAMPANYA GÜNÜNE GÖRE karşılaştırılır (kullanıcı isteği, 23.08.2026):
     * Devir günü kampanyanın 1. günüdür (Şartname §2: devir stok kampanya
       başında girilir; YU.donem.liste() -> bas).
     * Bugün bu kampanyanın kaçıncı günüyse (N), geçmiş kampanyanın da
       N. günü karşısına konur. 22.07'de başlayan kampanyada 20.08 = 30. gün;
       10.06'da başlayan kampanyada 30. gün = 09.07.
     * Bugün son kayıtlı günden ilerideyse N son kayıtlı güne çekilir.
   ANALİZ PENCERESİ varsayılan olarak kampanyanın TAMAMIDIR (devir gününden
   bugüne). Üstteki tarih aralığı seçicisiyle daraltılabilir; seçim gün
   sırasına çevrilir, geçmiş kampanya aynı gün sıralarıyla karşılaştırılır.
   Geçmiş kampanyanın kaydı erken bitiyorsa bu, pencereyi kısaltmaz —
   yalnızca farkın hesaplanabildiği son günü kısıtlar ve ekranda düz
   Türkçeyle söylenir (kullanıcı düzeltmesi, 23.08.2026).
   KAMPANYA SEÇİMİ grafiğin üstündeki efsanededir (kullanıcı isteği,
   23.08.2026): bütün kampanyalar orada listelenir, tıklanınca işaret açılıp
   kapanır ve çizgi anında grafikten çıkar/geri gelir. İşaretli her kampanya
   tabloda da birer sütun alır. Renk sırası sabittir: en yeni kampanya mavi,
   bir önceki kırmızı, sonrakiler kategorik paletten — işaret açılıp
   kapandıkça bir kampanyanın rengi değişmez.

   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu).
   SÖZLEŞME §6 (UI imzaları), §9 (sınıf adları).
   Dosya yüklenirken hiçbir şey çizmez; yalnızca YU.sayfaTanimla çağırır. */
(function () {
  'use strict';

  var YU = window.YU;

  var SAYFA = 'analizler';
  /* Kampanya çizgi renkleri YU.analiz.kampanyaRengi() ile verilir:
     en yeni kampanya mavi, bir önceki kırmızı, sonrakiler kategorik palet. */
  var GRAFIK_YUKSEKLIK = 240;
  /* ------------------------------------------------------------------
     Küçük yardımcılar
     ------------------------------------------------------------------ */

  function miktar(v, birim) {
    if (v === null || v === undefined || !isFinite(Number(v))) return '—';
    return birim === 'adet' ? YU.fmt.sayi(v) + ' adet' : YU.fmt.kgU(v);
  }

  /* Eksen birimi grafiğin TAVANINA göre seçilir: küçük ölçekte '0,75 ton'
     okunmuyor, büyük ölçekte '1.000.000 kg' eksene sığmıyor. */
  var TON_ESIGI = 10000;
  function eksenMetni(birim) {
    if (birim === 'adet') return function (v) { return YU.fmt.sayi(v); };
    return function (v, tavan) {
      return (Number(tavan) || 0) >= TON_ESIGI ? YU.fmt.ton(v) : YU.fmt.kg(v) + ' kg';
    };
  }

  function gunMetni(n) { return YU.fmt.sayi(n) + '. gün'; }

  function isaretli(v) {
    return (v > 0 ? '+' : (v < 0 ? '-' : '')) + YU.fmt.kg(Math.abs(v));
  }

  function yuzdeMetni(p) {
    if (p === null || !isFinite(p)) return '—';
    return (p > 0 ? '+' : (p < 0 ? '-' : '')) + YU.fmt.yuzde(Math.abs(p));
  }

  function farkTuru(d) {
    if (d === null || !isFinite(d) || d === 0) return 'notr';
    return d > 0 ? 'olumlu' : 'olumsuz';
  }

  var RENK_METIN = {
    olumlu: 'var(--olumlu)', olumsuz: 'var(--olumsuz)',
    bekleyen: 'var(--bekleyen)', vurgu: 'var(--vurgu)', notr: 'var(--metin-4)'
  };

  /* ------------------------------------------------------------------
     Ekran durumu — URL parametrelerinden
     Veri ve hesap YU.analiz'den gelir (js/33-analiz-veri.js).
     ------------------------------------------------------------------ */

  /* Seçili kampanyalar adres satırında virgülle tutulur:
       #/analizler?kampanyalar=2026/2027,2025/2026
     Eski `bu` / `karsi` parametreleri de kabul edilir (cevap kartındaki
     bağlantılar onları kullanıyor). */
  function adlariCoz(metin) {
    var l = String(metin || '').split(','), sonuc = [], i;
    for (i = 0; i < l.length; i++) {
      var ad = l[i].replace(/^\s+|\s+$/g, '');
      if (ad && sonuc.indexOf(ad) < 0) sonuc.push(ad);
    }
    return sonuc;
  }

  function durum(depo, param) {
    param = param || {};
    var b = parseInt(param.basGun, 10), t = parseInt(param.bitGun, 10);
    var aralik = (isFinite(b) || isFinite(t))
      ? { basGun: isFinite(b) ? b : null, bitGun: isFinite(t) ? t : null } : null;

    var adlar = adlariCoz(param.kampanyalar);
    if (!adlar.length && param.bu) {
      adlar = [param.bu];
      if (param.karsi && param.karsi !== param.bu) adlar.push(param.karsi);
    }

    var ozet = YU.analiz.ozet(depo, adlar.length ? adlar : null, null, aralik);
    if (!ozet) return null;
    ozet.gosterge = YU.analiz.gostergeBul(ozet.gostergeler, param.gosterge) || ozet.gostergeler[0] || null;
    ozet.mod = param.mod === 'birikimli' ? 'birikimli' : 'gunluk';
    return ozet;
  }

  function bagKur(d, ek) {
    var p = {
      kampanyalar: d.seciliAdlar.join(','),
      gosterge: d.gosterge ? d.gosterge.kod : null,
      mod: d.mod,
      basGun: d.tamAralikMi ? null : d.basGun,
      bitGun: d.tamAralikMi ? null : d.bitGun
    };
    if (ek) for (var k in ek) if (Object.prototype.hasOwnProperty.call(ek, k)) p[k] = ek[k];
    return p;
  }

  /* Bütün kampanyalar, ESKİDEN YENİYE — soldan sağa doğru artan sıra
     (kullanıcı isteği, 23.08.2026): en solda en eski sezon, en sağda içinde
     bulunduğumuz sezon. Zaman çizgisi gibi okunur.
     RENK ise tersinden, YENİLİK sırasına göre verilir: en yeni kampanya
     mavi, bir önceki kırmızı. Böylece listedeki yeri değişse de bir
     kampanyanın rengi sabit kalır. */
  function tumKampanyalar(d) {
    var yenidenEskiye = d.donemler.slice().sort(function (a, b) {
      return a.bas < b.bas ? 1 : (a.bas > b.bas ? -1 : 0);
    });
    var renkler = {}, i;
    for (i = 0; i < yenidenEskiye.length; i++) renkler[yenidenEskiye[i].ad] = YU.analiz.kampanyaRengi(i);

    var eskidenYeniye = d.donemler.slice().sort(function (a, b) {
      return a.bas < b.bas ? -1 : (a.bas > b.bas ? 1 : 0);
    });
    var sonuc = [];
    for (i = 0; i < eskidenYeniye.length; i++) {
      sonuc.push({
        donem: eskidenYeniye[i],
        renk: renkler[eskidenYeniye[i].ad],
        secili: d.seciliAdlar.indexOf(eskidenYeniye[i].ad) >= 0
      });
    }
    return sonuc;
  }

  /* Seçili kampanyalar, ekranda gösterim sırasıyla (eskiden yeniye).
     `d.veriler` yeniden eskiye durur — hesap katmanı bu = veriler[0]
     kabulüyle çalışıyor; yalnız GÖSTERİM ters çevrilir. */
  function gosterimSirasi(d) {
    return d.veriler.slice().reverse();
  }

  /* Bir kampanyanın "bu sezon / geçen sezon" etiketi, listedeki yerine
     değil KENDİ YENİLİĞİNE bağlıdır. */
  function sezonEtiketi(d, veri) {
    if (d.veriler[0] && d.veriler[0].donem.ad === veri.donem.ad) return 'Bu Sezon · ';
    if (d.veriler[1] && d.veriler[1].donem.ad === veri.donem.ad) return 'Geçen Sezon · ';
    return '';
  }

  /* Bir kampanyanın işaretini açıp kapatır. En az bir kampanya seçili
     kalmalı: hepsi kapanırsa grafik boşalır. */
  function kampanyaDegistir(d, ad) {
    var yeni = d.seciliAdlar.slice();
    var yer = yeni.indexOf(ad);
    if (yer >= 0) {
      if (yeni.length === 1) return;
      yeni.splice(yer, 1);
    } else {
      yeni.push(ad);
    }
    YU.git(SAYFA, bagKur(d, { kampanyalar: yeni.join(',') }));
  }

  /* Seçili aralığın gün etiketi: "1–30. gün". */
  function aralikMetni(d) {
    return YU.fmt.sayi(d.basGun) + '–' + gunMetni(d.bitGun);
  }

  /* İki tarih aynı yıldaysa yıl bir kez yazılır: "14.08 – 20.08.2026".
     Çipte yer dar; yılı iki kez yazmak satırı kırıyordu. */
  function kisaAralik(basISO, bitISO) {
    var bas = YU.fmt.tarih(basISO), bit = YU.fmt.tarih(bitISO);
    if (String(basISO).slice(0, 4) === String(bitISO).slice(0, 4)) bas = bas.slice(0, 5);
    return bas + ' – ' + bit;
  }

  /* "N. Gün Farkı" hücresi: kampanya başından bugüne iki kampanyanın
     toplamları ve aradaki fark. Yüzde ile birlikte miktarı da yazar ki
     "%0,6 geride" ne kadar ediyor tek bakışta görünsün. */
  function gunlukFarkHucresi(k) {
    if (k.fark === null || k.gecmisOrtak === null) {
      return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    }
    var tur = farkTuru(k.fark);
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }
    },
      YU.h('span', {
        metin: isaretli(k.fark) + ' ' + k.gosterge.birim,
        stil: { font: '400 12.5px/1 var(--sayi)', color: 'var(--metin-4)', fontVariantNumeric: 'tabular-nums' }
      }),
      YU.ui.rozet(yuzdeMetni(k.yuzde), tur)
    );
  }

  /* Aynı gün sıralarının geçmiş kampanyada denk geldiği takvim aralığı. */
  function gecmisAralikMetni(d) {
    if (!d.gecmis) return null;
    return YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, d.basGun)) + ' – ' +
      YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, Math.min(d.bitGun, d.gecmis.sonGun)));
  }

  /* ==================================================================
     1. Araç şeridi — ekranın filtre satırı

     Önceki sürümde üç bant üst üste duruyordu: dört tam genişlik seçim
     kutusu, altında tarih satırı, altında açıklama. Ekran veriye
     başlamadan üç bant harcıyordu (kullanıcı düzeltmesi, 23.08.2026).
     Şimdi TEK SATIR: seçim kutuları açılır çiplerin içine girdi, çipte
     yalnız seçili değer yazıyor. Tasarım referansındaki "Durum: Tümü" /
     dönem seçici çipinin dili korundu.
     ================================================================== */

  function ayarPaneli(d) {
    /* Kampanya seçimi buradan KALKTI: artık grafiğin üstündeki efsanede
       hepsi listeleniyor ve tıklanarak açılıp kapanıyor (kullanıcı isteği,
       23.08.2026). Şeritte yalnız gösterge, görünüm ve tarih aralığı kalır. */
    var serit = YU.h('div', { sinif: 'yu-arac' },
      gostergeCipi(d),
      YU.h('span', { sinif: 'yu-arac-ayrac' }),
      gorunumSecimi(d),
      YU.h('div', { sinif: 'yu-arac-sag' }, aralikCipi(d))
    );
    return YU.h('div', {
      stil: {
        padding: '12px 14px', border: '1px solid var(--kenar)',
        borderRadius: 'var(--r-l)', background: 'var(--yuzey)'
      }
    }, serit);
  }

  /* --- gösterge --- */

  function gostergeCipi(d) {
    return YU.ui.acilirCip({
      ikon: '#ic-chart', metin: d.gosterge.ad, enGenis: 200,
      baslik: 'Gösterge', genislik: 340,
      govde: function (kapat) {
        var kap = YU.h('div');
        for (var i = 0; i < d.gostergeler.length; i++) {
          (function (g) {
            kap.appendChild(YU.ui.acilirSatir({
              metin: g.ad,
              secili: g.kod === d.gosterge.kod,
              onClick: function () { kapat(); YU.git(SAYFA, bagKur(d, { gosterge: g.kod })); }
            }));
          })(d.gostergeler[i]);
        }
        return kap;
      }
    });
  }

  /* --- görünüm: iki seçenek, açılır listeye değmez --- */

  function gorunumSecimi(d) {
    return YU.ui.secimGrubu({
      deger: d.mod,
      secenekler: [{ deger: 'gunluk', metin: 'Günlük' }, { deger: 'birikimli', metin: 'Birikimli' }],
      onDegis: function (v) { YU.git(SAYFA, bagKur(d, { mod: v })); }
    });
  }

  /* --- tarih aralığı --- */

  function aralikCipi(d) {
    var metin = d.tamAralikMi
      ? 'Tüm kampanya · ' + YU.fmt.sayi(d.gunSayisi) + ' gün'
      : kisaAralik(YU.analiz.gunTarihi(d.bu, d.basGun), YU.analiz.gunTarihi(d.bu, d.bitGun)) +
        ' · ' + YU.fmt.sayi(d.gunSayisi) + ' gün';

    return YU.ui.acilirCip({
      ikon: '#ic-calendar', metin: metin, hiza: 'sag', enGenis: 230,
      baslik: 'Tarih aralığı', genislik: 340, dolgu: '6px 12px 12px',
      govde: function (kapat) { return aralikKutusu(d, kapat); }
    });
  }

  function aralikKutusu(d, kapat) {
    var enErken = YU.analiz.gunTarihi(d.bu, 1);
    var enGec = YU.analiz.gunTarihi(d.bu, d.sonGun);
    var basAlani, bitAlani;

    function git(basGun, bitGun) {
      kapat();
      YU.git(SAYFA, bagKur(d, { basGun: basGun, bitGun: bitGun }));
    }
    function tarihtenGit() {
      var b = YU.analiz.tarihGunu(d.bu, basAlani.deger());
      var t = YU.analiz.tarihGunu(d.bu, bitAlani.deger());
      git(b || 1, t || d.sonGun);
    }

    basAlani = YU.ui.alan({
      etiket: 'Başlangıç', tip: 'tarih',
      deger: YU.analiz.gunTarihi(d.bu, d.basGun), onChange: tarihtenGit
    });
    bitAlani = YU.ui.alan({
      etiket: 'Bitiş', tip: 'tarih',
      deger: YU.analiz.gunTarihi(d.bu, d.bitGun), onChange: tarihtenGit
    });
    basAlani.girdi.setAttribute('min', enErken);
    basAlani.girdi.setAttribute('max', enGec);
    bitAlani.girdi.setAttribute('min', enErken);
    bitAlani.girdi.setAttribute('max', enGec);

    /* Hazır aralıklar — seçili olan vurguyla işaretlenir. */
    var hazir = [{ metin: 'Kampanyanın tamamı', bas: 1, bit: d.sonGun }];
    if (d.sonGun > 7) hazir.push({ metin: 'Son 7 gün', bas: d.sonGun - 6, bit: d.sonGun });
    if (d.sonGun > 30) hazir.push({ metin: 'Son 30 gün', bas: d.sonGun - 29, bit: d.sonGun });
    if (d.sonGun >= 4) {
      var orta = Math.ceil(d.sonGun / 2);
      hazir.push({ metin: 'İlk yarı', bas: 1, bit: orta });
      hazir.push({ metin: 'İkinci yarı', bas: orta + 1, bit: d.sonGun });
    }

    var liste = YU.h('div');
    for (var i = 0; i < hazir.length; i++) {
      (function (h) {
        liste.appendChild(YU.ui.acilirSatir({
          metin: h.metin,
          sag: YU.fmt.sayi(h.bit - h.bas + 1) + ' gün',
          secili: d.basGun === h.bas && d.bitGun === h.bit,
          onClick: function () { git(h.bas, h.bit); }
        }));
      })(hazir[i]);
    }

    var bilgi = [aralikMetni(d)];
    if (d.gecmis) bilgi.push('Kampanya ' + d.gecmis.donem.ad + ' aynı günleri: ' + gecmisAralikMetni(d));

    return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      liste,
      YU.h('div', { sinif: 'yu-ayrac yu-yatay' }),
      YU.h('div', { stil: { display: 'flex', gap: '10px' } }, basAlani.kok, bitAlani.kok),
      YU.h('div', { sinif: 'yu-yardim', metin: bilgi.join(' · ') })
    );
  }

  /* ==================================================================
     2. Grafik paneli
     ================================================================== */

  function grafikPaneli(d) {
    var g = d.gosterge, birikimli = d.mod === 'birikimli';
    var bas = d.basGun, bit = d.bitGun, N = bit;
    var kampanyalar = tumKampanyalar(d);
    var i, j;

    /* Gün etiketleri seçili aralıktan gelir; her kampanya AYNI gün
       sıralarında karşılaştırılır (1. gün = kendi devir günü). */
    var noktalar = [];
    for (i = bas; i <= bit; i++) noktalar.push({ etiket: String(i), baslik: gunMetni(i) });

    /* Bütün kampanyalar için seri kurulur — işaretsizler de listede durur
       ki efsaneden geri açılabilsinler. Birikimli görünüm SEÇİLEN aralığın
       içinde toplar: aralık daraltıldıysa birikim de oradan başlar. */
    var seriler = [];
    for (i = 0; i < kampanyalar.length; i++) {
      var kmp = kampanyalar[i];
      var veri = YU.analiz.kampanyaVerisi(YU.db, kmp.donem);
      var pencere = YU.analiz.pencere(veri, g, bas, bit);
      var degerler = [], altlar = [], toplam = 0;
      for (j = 0; j < pencere.gunler.length; j++) {
        var v = pencere.gunler[j].deger;
        if (v !== null) toplam = YU.yuvarla(toplam + v);
        degerler.push(birikimli ? (v === null ? null : toplam) : v);
        altlar.push(YU.fmt.tarih(pencere.gunler[j].tarih));
      }
      seriler.push({
        ad: 'Kampanya ' + kmp.donem.ad,
        renk: kmp.renk,
        secili: kmp.secili,
        degerler: degerler,
        altlar: altlar
      });
    }

    var grafik = YU.ui.karsilastirmaGrafik({
      noktalar: noktalar,
      seriler: seriler,
      yukseklik: GRAFIK_YUKSEKLIK,
      bicim: function (v) { return miktar(v, g.birim); },
      eksenBicim: eksenMetni(g.birim),
      /* Efsane aynı zamanda seçicidir: işaret kalkınca çizgi grafikten
         çıkar, tıklanınca geri gelir (kullanıcı isteği, 23.08.2026). */
      onSeriTikla: function (indeks) {
        if (kampanyalar[indeks]) kampanyaDegistir(d, kampanyalar[indeks].donem.ad);
      }
    });

    return YU.ui.panel({
      baslik: (birikimli ? 'Birikimli Karşılaştırma · ' : 'Günlük Karşılaştırma · ') + g.ad,
      ikon: '#ic-chart',
      sag: aralikMetni(d),
      govde: grafik
    });
  }

  /* ==================================================================
     3. Karşılaştırma tablosu
     ================================================================== */

  function tabloPaneli(d) {
    var N = d.bitGun, ortakBit = d.ortakBit, satirlar = [], i;
    var hepsi = YU.analiz.tumKarsilastirma(d);

    /* BUGÜNE KADAR sütunu — seçili aralıktan BAĞIMSIZDIR (kullanıcı isteği,
       23.08.2026). Kampanyanın 1. gününden bugünkü N. güne kadar iki
       kampanyanın toplamını karşılaştırır: "19. gündeyiz, 19 günde geçen
       kampanyaya göre neredeyiz". Üstten aralık daraltılsa bile bu sütun
       hep aynı soruyu yanıtlar. */
    var bugunAralik = { basGun: 1, bitGun: d.sonGun };

    /* Fark, ORTAK günler üzerinden hesaplanır. Bu yüzden fark sütununun
       yanındaki iki sayı da ortak günlerin sayısı olmalıdır; yoksa "fark"
       ekranda görünen iki sayının farkına eşit çıkmaz. */
    for (i = 0; i < hepsi.length; i++) {
      (function (k) {
        var g = k.gosterge;
        var aktif = g.kod === d.gosterge.kod;
        var bugune = YU.analiz.karsilastir(d, g, bugunAralik);
        var hucreler = [YU.h('span', { sinif: aktif ? 'yu-guclu' : '', metin: g.ad })];
        /* Seçili her kampanya için bir sütun; fark sütunları en yeni iki
           kampanyayı karşılaştırır (grafikteki mavi ve kırmızı çizgi). */
        var sirali = gosterimSirasi(d);
        for (var v = 0; v < sirali.length; v++) {
          var pv = YU.analiz.pencere(sirali[v], g, d.basGun, Math.min(d.bitGun, sirali[v].sonGun));
          hucreler.push(pv.kayitliGun ? miktar(pv.toplam, g.birim) : '—');
        }
        /* Aralık daraltılmadıysa "aralık farkı" ile "N. gün farkı" AYNI
           şeydir; aynı sayıyı iki kez basmamak için yalnız sonuncusu yazılır. */
        if (!d.tamAralikMi) {
          hucreler.push(k.fark === null ? '—' : YU.h('span', {
            metin: isaretli(k.fark) + ' ' + g.birim,
            stil: { color: RENK_METIN[farkTuru(k.fark)] }
          }));
          hucreler.push(k.yuzde === null ? '—' : YU.ui.rozet(yuzdeMetni(k.yuzde), farkTuru(k.fark)));
        }
        hucreler.push(gunlukFarkHucresi(bugune));
        satirlar.push({
          vurgu: aktif ? 'vurgu' : null,
          ipucu: aktif ? 'Grafikte gösteriliyor' : 'Grafikte göstermek için tıklayın',
          onClick: function () { YU.git(SAYFA, bagKur(d, { gosterge: g.kod })); },
          hucreler: hucreler
        });
      })(hepsi[i]);
    }

    /* Sütun başlığında gün aralığı YAZMAZ: aralık zaten üstteki seçicide ve
       panel başlığında durur. Başlığa parametre gibi sayı basmak, seçilmiş
       bir pencere izlenimi veriyordu (kullanıcı düzeltmesi, 23.08.2026).
       Tek istisna son sütun: orada gün sayısı BİLGİNİN KENDİSİDİR. */
    /* Sütun başlığı önce İNSAN SÖZCÜĞÜNÜ söyler ("Bu Sezon"), kampanya adı
       arkasından gelir. Programı ilk kez açan biri "Kampanya 2025/2026"
       yazısından hangisinin geçen sezon olduğunu çıkaramıyordu
       (kullanıcı geri bildirimi, 23.08.2026). */
    var sutunlar = [{ baslik: 'Gösterge' }];
    var sutunSirasi = gosterimSirasi(d);
    for (i = 0; i < sutunSirasi.length; i++) {
      sutunlar.push({
        baslik: sezonEtiketi(d, sutunSirasi[i]) + sutunSirasi[i].donem.ad,
        hiza: 'sag', mono: true, genislik: 180
      });
    }
    if (!d.tamAralikMi) {
      sutunlar.push({ baslik: 'Seçili Aralık Farkı', hiza: 'sag', mono: true, genislik: 160 });
      sutunlar.push({ baslik: 'Aralık %', hiza: 'sag', genislik: 100 });
    }
    /* Başlıkta gün sayısı YOK (kullanıcı tercihi, 23.08.2026): '30. gün Farkı'
       tek bir günün farkı gibi okunuyordu. Kaçıncı günde olunduğu sayfa alt
       başlığında, aralık çipinde ve tablo üstü açıklamada zaten yazıyor. */
    sutunlar.push({ baslik: 'Sezon Başından Bugüne', hiza: 'sag', genislik: 210 });

    var tablo = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      bos: 'Karşılaştırılacak gösterge yok.'
    });

    /* Tablonun ÜSTÜNDE tek cümlelik açıklama: kampanya günü mantığı bu
       ekranın en anlaşılmaz yeri. Somut tarih vermek kavramı oturtuyor.
       Ayrıntılı notlar tablonun altında kalır. */
    var ustAciklama = null;
    if (d.gecmis) {
      ustAciklama = YU.h('div', {
        stil: {
          display: 'flex', alignItems: 'flex-start', gap: '9px',
          padding: '11px 18px', borderBottom: '1px solid var(--ayrac)',
          background: 'var(--yuzey-2)'
        }
      },
        YU.h('span', { stil: { display: 'flex', color: 'var(--vurgu)', flex: 'none', marginTop: '1px' } }, YU.svg('#ic-doc', 14)),
        YU.h('div', {
          sinif: 'yu-yardim',
          stil: { margin: '0' },
          metin: 'Karşılaştırma takvim tarihine göre değil KAMPANYA GÜNÜNE göre yapılır. ' +
            'Bu sezon ' + YU.fmt.sayi(d.sonGun) + ' gündür sürüyor (' +
            YU.fmt.tarih(d.bu.donem.bas) + '’dan ' + YU.fmt.tarih(YU.analiz.gunTarihi(d.bu, d.sonGun)) + '’a); ' +
            'geçen sezonun da başlangıcından itibaren aynı ' + YU.fmt.sayi(d.sonGun) + ' günü alındı (' +
            YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, 1)) + ' – ' +
            YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, Math.min(d.sonGun, d.gecmis.sonGun))) + ').'
        })
      );
    }

    return YU.ui.panel({
      baslik: d.tamAralikMi ? 'Kampanya Toplamları' : 'Seçili Aralık Toplamları',
      ikon: '#ic-doc',
      sag: YU.fmt.sayi(d.gostergeler.length) + ' gösterge · ' + aralikMetni(d),
      dolgusuz: true,
      govde: [ustAciklama, tablo]
    });
  }

  /* ==================================================================
     4. Sayfa
     ================================================================== */

  function ciz(kap, param) {
    var depo = YU.db;
    if (!depo) return;
    var d = durum(depo, param);

    if (!d) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-chart',
        baslik: 'Kampanya Dönemi Yok',
        metin: 'Karşılaştırma devir tarihine göre kurulur. Devir stok girilince kampanya dönemi oluşur ve bu ekran dolar.',
        eylemler: [YU.ui.dugme({ metin: 'Devir Stok', ikon: '#ic-wallet', tur: 'birincil', onClick: function () { YU.git('devir-stok'); } })]
      }));
      return;
    }
    if (!d.gosterge) {
      kap.appendChild(YU.ui.bosDurum({ ikon: '#ic-chart', baslik: 'Gösterge Yok', metin: 'Karşılaştırılacak malzeme tanımı bulunamadı.' }));
      return;
    }

    kap.appendChild(ayarPaneli(d));

    if (!d.gecmis) {
      kap.appendChild(YU.ui.serit({
        tur: 'bilgi', baslik: 'Tek kampanya var',
        metin: 'Karşılaştırma için en az iki kampanya dönemi gerekir. Yeni kampanya açılınca (yeni devir tarihi) bu ekran iki dönemi gün gün karşılaştırır.'
      }));
    }

    kap.appendChild(grafikPaneli(d));
    kap.appendChild(tabloPaneli(d));
  }

  YU.sayfaTanimla({
    kod: SAYFA,
    baslik: 'Analizler',
    ikon: '#ic-bars-up',
    grup: 'Yönetim',
    rol: 'Yonetici',
    altBaslik: function (param) {
      var depo = YU.db;
      if (!depo) return '';
      var d = durum(depo, param);
      if (!d) return 'Kampanya dönemi tanımlı değil';
      var parcalar = ['Kampanya ' + d.bu.donem.ad + ' · ' +
        (d.tamAralikMi ? gunMetni(d.sonGun) + ' (kampanyanın tamamı)' : aralikMetni(d) + ' seçili')];
      parcalar.push(d.gecmis ? 'Kampanya ' + d.gecmis.donem.ad + ' ile gün gün karşılaştırma' : 'karşılaştırılacak ikinci kampanya yok');
      return parcalar.join(' · ');
    },
    ciz: ciz
  });
})();

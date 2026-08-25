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
  var GRAFIK_YUKSEKLIK = 360;   /* 240 -> 360 (kullanıcı isteği, 25.08.2026: "boyunu uzat") */
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
    /* Zaman ölçeği (kullanıcı isteği, 25.08.2026): kampanya dokuz ay
       sürebiliyor; her günü tek tek çizmek okunmuyor. Hafta/ay seçilirse
       noktalar KAMPANYA GÜNÜ bloklarına toplanır (7 ya da 30 gün) —
       kampanyalar zaten gün sırasına göre karşılaştırıldığı için blok da
       gün sırası üzerinden kurulur, takvim ayına göre değil. */
    ozet.olcek = OLCEK_BLOK[param.olcek] ? param.olcek : 'gun';
    return ozet;
  }

  /* Ölçek kodu → blok uzunluğu (kampanya günü). */
  var OLCEK_BLOK = { gun: 1, hafta: 7, ay: 30 };
  var OLCEK_ADI = { gun: 'Gün', hafta: 'Hafta', ay: 'Ay' };

  function bagKur(d, ek) {
    var p = {
      kampanyalar: d.seciliAdlar.join(','),
      gosterge: d.gosterge ? d.gosterge.kod : null,
      mod: d.mod,
      olcek: d.olcek === 'gun' ? null : d.olcek,
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
    if (d.veriler[0] && d.veriler[0].donem.ad === veri.donem.ad) {
      /* Aralık daraltılmamışken kolon, sezon başından bugüne BİRİKMİŞ toplamı
         gösterir; adı da bunu söyler (kullanıcı isteği, 24.08.2026). Aralık
         seçiliyken toplam o aralığa aittir, ad "Bu Sezon" kalır. */
      return d.tamAralikMi ? 'Şimdiye Kadarki Toplam · ' : 'Bu Sezon · ';
    }
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
    /* HİZA (kullanıcı isteği, 25.08.2026): rakam ve yüzde rozeti akışkan
       dururken rozetin genişliği satırdan satıra değişiyor ve rakamlar
       kayıyordu ("-%3,7" ile "+%110,6" aynı genişlikte değil). İki parça da
       SABİT sütuna oturtuldu: rakam sağa yaslı esnek alanda, rozet sabit
       genişlikte bir kutuda — böylece bütün rakamlar aynı çizgide biter,
       bütün rozetler aynı çizgide başlar. */
    var rozet = YU.ui.rozet(yuzdeMetni(k.yuzde), tur);
    rozet.style.width = '100%';
    rozet.style.justifyContent = 'center';
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }
    },
      YU.h('span', {
        metin: isaretli(k.fark) + ' ' + k.gosterge.birim,
        stil: {
          flex: '1 1 auto', minWidth: '0', textAlign: 'right',
          font: '400 12.5px/1 var(--sayi)', color: 'var(--metin-4)', fontVariantNumeric: 'tabular-nums'
        }
      }),
      YU.h('span', { stil: { flex: '0 0 78px', display: 'flex', justifyContent: 'flex-end' } }, rozet)
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

  /* ayarPaneli KALDIRILDI (kullanıcı isteği, 25.08.2026): içinde yalnız
     tarih aralığı çipi kalmıştı ve sayfanın en üstünde ayrı bir kutu olarak
     duruyordu. Çip artık grafiğin üstündeki denetim satırında, Gün/Hafta/Ay
     seçiminin sağında — bir grafiği ilgilendiren bütün ayarlar tek satırda. */

  /* --- görünüm: iki seçenek, açılır listeye değmez --- */

  function gorunumSecimi(d) {
    return YU.ui.secimGrubu({
      deger: d.mod,
      secenekler: [{ deger: 'gunluk', metin: 'Günlük' }, { deger: 'birikimli', metin: 'Birikimli' }],
      onDegis: function (v) { YU.git(SAYFA, bagKur(d, { mod: v })); }
    });
  }

  /* Zaman ölçeği (kullanıcı isteği, 25.08.2026): dokuz aylık kampanyada her
     günü çizmek okunmuyor; hafta ya da ay seçilince noktalar 7'şer / 30'ar
     günlük bloklara toplanır ve eğri tek bakışta okunur. */
  function olcekSecimi(d) {
    return YU.ui.secimGrubu({
      deger: d.olcek,
      secenekler: [
        { deger: 'gun', metin: 'Gün' },
        { deger: 'hafta', metin: 'Hafta' },
        { deger: 'ay', metin: 'Ay' }
      ],
      onDegis: function (v) { YU.git(SAYFA, bagKur(d, { olcek: v })); }
    });
  }

  /* --- tarih aralığı --- */

  function aralikCipi(d) {
    var metin = d.tamAralikMi
      ? 'Tüm kampanya · ' + YU.fmt.sayi(d.gunSayisi) + ' gün'
      : kisaAralik(YU.analiz.gunTarihi(d.bu, d.basGun), YU.analiz.gunTarihi(d.bu, d.bitGun)) +
        ' · ' + YU.fmt.sayi(d.gunSayisi) + ' gün';

    return YU.ui.acilirCip({
      /* hiza: 'sag' idi — çip sayfanın sağ üstündeyken kutu sağa
         yaslanıyordu. Çip artık grafiğin denetim satırında, kutu SOLA
         hizalanır (25.08.2026). */
      ikon: '#ic-calendar', metin: metin, enGenis: 230,
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
     2a. Gösterge seçimi — İKİ BOYUT (yeniden tasarım, 25.08.2026)

     Önce üç aşamalı açılır ağaç denendi ve GERİ ALINDI: her seçim üç tık
     istiyordu ve seçenekler kapalı dalların içinde görünmez kalıyordu.

     Doğrusu: 16 gösterge tek boyutlu bir liste değil, İKİ BOYUTUN çarpımıdır
     — (hangi malzeme) × (üretim mi satış mı). İki boyut iki ayrı denetime
     ayrıldı; yaygın gösterge paneli yerleşimi budur:

       SOLDA  malzeme listesi — gruplu ama AÇILIR DEĞİL, hepsi görünür.
              Grup başlıkları (YAŞ KÜSPE / KURU KÜSPE / DİĞER) kenar
              çubuğundaki menü grubu diliyle yazılır, tıklanmaz.
       ÜSTTE  Üretim | Satış segment düğmesi — az sayıda, birbirini dışlayan
              seçenek için doğru bileşen; hepsi tek bakışta görünür.

     Sonuç: her gösterge en çok 2, çoğu zaman 1 tıkla seçilir. Malzeme
     değişince seçili kalem (üretim/satış) korunur; o malzemede yoksa ilk
     kaleme düşülür (çuvallı küspenin üretimi "Çuvallama"dır).

     Ağaç, YU.analiz.gostergeler()'in düz listesinden ADLARI ayrıştırarak
     kurulur; gösterge kodları ve veri katmanı değişmez. Malzeme adı
     "Ad (Çeşit)" veya "Ad · Üretim" kalıbındadır (33-analiz-veri.js).
     ================================================================== */

  /* "Yaş Küspe (Tonluk)" -> {grup:'Yaş Küspe', cesit:'Tonluk'}
     "Toprak"             -> {grup:'Toprak',    cesit:null}     */
  function malzemeParcala(ad) {
    var m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(ad);
    if (m) return { grup: m[1].trim(), cesit: m[2].trim() };
    /* "Dökme Yaş Küspe" / "Atık Kuru Küspe": baştaki sıfat çeşit sayılır. */
    var one = /^(Dökme|Atık)\s+(.*)$/.exec(ad);
    if (one) return { grup: one[2].trim(), cesit: one[1].trim() };
    return { grup: ad, cesit: null };
  }

  /* Kalem adı: segment düğmesinde yazan söz. Dökme kuru küspede üretim
     BRÜTTÜR (çuvallamadan önceki toplam); bu ayrım rakamı değiştirdiği için
     etikette görünür kalır. */
  function kalemAdi(g) {
    if (g.tur === 'cuvallama') return 'Çuvallama';
    if (g.tur === 'satis') return 'Satış';
    return g.kod === 'dokme-uretim' ? 'Üretim (Brüt)' : 'Üretim';
  }

  /* Menüde yazan kısa ad: çeşidi olan malzemede yalnız çeşit ("Tonluk"),
     olmayanda tam ad ("Toprak") — grubun adı zaten üstteki başlıkta yazar. */
  function menuEtiketi(malzemeAd) {
    var p = malzemeParcala(malzemeAd);
    return p.cesit ? p.cesit : p.grup;
  }

  /* Çeşidi olmayan malzemeler tek başlarına grup açmasın; "Diğer" altında
     toplanır. */
  function menuGrubu(malzemeAd) {
    var p = malzemeParcala(malzemeAd);
    return p.cesit ? p.grup : 'Diğer';
  }

  /* Grup sırası kullanıcı kararıdır (25.08.2026): Kuru Küspe en üstte, altında
     Yaş Küspe, en altta Diğer. Listede olmayan bir grup çıkarsa Diğer'in
     hemen üstüne düşer. Grup İÇİNDEKİ sıra Malzemeler.Sira'dan gelir. */
  var GRUP_SIRASI = ['Kuru Küspe', 'Yaş Küspe'];

  function grupSirasi(grup) {
    var i = GRUP_SIRASI.indexOf(grup);
    if (i >= 0) return i;
    return grup === 'Diğer' ? 99 : 50;
  }

  /* Göstergeleri malzemeye göre toplar: [{ad, sira, kalemler:[gosterge...]}].
     Sıra Malzemeler.Sira'dan gelir — menü, diğer ekranlardaki malzeme
     sırasıyla aynı okunsun. */
  function malzemeDugumleri(gostergeler) {
    var siraHarita = {}, i;
    for (i = 0; i < YU.db.malzemeler.length; i++) {
      siraHarita[YU.db.malzemeler[i].Ad] = Number(YU.db.malzemeler[i].Sira) || 99;
    }
    var harita = {}, liste = [];
    for (i = 0; i < gostergeler.length; i++) {
      var g = gostergeler[i];
      var ad = g.malzemeAd || g.ad;
      if (!harita[ad]) {
        harita[ad] = { ad: ad, sira: siraHarita[ad] || 99, kalemler: [] };
        liste.push(harita[ad]);
      }
      harita[ad].kalemler.push(g);
    }
    /* Önce grup sırası (Kuru Küspe → Yaş Küspe → Diğer), sonra grup içinde
       Malzemeler.Sira. */
    liste.sort(function (a, b) {
      return grupSirasi(menuGrubu(a.ad)) - grupSirasi(menuGrubu(b.ad)) || a.sira - b.sira;
    });
    return liste;
  }

  function seciliMalzeme(d) { return d.gosterge.malzemeAd || d.gosterge.ad; }

  /* Malzeme değişince aynı kalemde kalınır: Satış'tayken başka malzemeye
     geçilirse yine satış açılır; o malzemede o kalem yoksa ilkine düşülür
     (çuvallı küspenin üretimi "Çuvallama"dır). */
  function esKalem(dugum, tur) {
    var i;
    for (i = 0; i < dugum.kalemler.length; i++) if (dugum.kalemler[i].tur === tur) return dugum.kalemler[i];
    return dugum.kalemler[0];
  }

  function dugumBul(d) {
    var liste = malzemeDugumleri(d.gostergeler), secili = seciliMalzeme(d), i;
    for (i = 0; i < liste.length; i++) if (liste[i].ad === secili) return liste[i];
    return null;
  }

  /* SOL: malzeme listesi — gruplu, ama açılır kapanır DEĞİL; hepsi görünür.
     Grup başlıkları kenar çubuğundaki menü grubu diliyle yazılır. */
  function solMenuKur(d) {
    var kap = YU.h('div', {
      stil: {
        /* Liste büyütüldü (kullanıcı isteği, 25.08.2026): veri tipi adları
           küçük kalıyordu. Genişlik 178 -> 208, satır arası 1 -> 3 px. */
        display: 'flex', flexDirection: 'column', gap: '3px', flex: 'none',
        width: '208px', paddingRight: '14px', borderRight: '1px solid var(--ayrac)'
      }
    });

    var liste = malzemeDugumleri(d.gostergeler);
    var secili = seciliMalzeme(d), sonGrup = null, i;

    for (i = 0; i < liste.length; i++) {
      (function (dugum) {
        var grup = menuGrubu(dugum.ad);
        if (grup !== sonGrup) {
          kap.appendChild(YU.h('div', {
            sinif: 'yu-menu-grup-bas',
            metin: grup,
            stil: { marginTop: sonGrup === null ? '0' : '12px' }
          }));
          sonGrup = grup;
        }
        var aktif = dugum.ad === secili;
        /* Seçim işareti (kullanıcı isteği, 25.08.2026): satırın tıklanabilir
           olduğu tek başına hover'dan anlaşılmıyordu. Seçilide dolu daire
           içinde tik, diğerlerinde boş daire — Kampanya Toplamları tablosunda
           denenip beğenilen dilin aynısı. */
        var isaret = YU.h('span', {
          'aria-hidden': 'true',
          stil: {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '17px', height: '17px', borderRadius: '50%', flex: 'none',
            border: aktif ? 'none' : '1.5px solid var(--kenar-3)',
            /* Dolu dairenin içi tema başına ayrı (kullanıcı isteği, 25.08.2026):
               koyu temada beyaz daire + koyu tik, açık temada mavi daire +
               beyaz tik — seçili satır iki temada da göze çarpsın. */
            background: aktif ? 'var(--tik-zemin)' : 'transparent',
            color: 'var(--tik-uzeri)', font: '700 10px/1 var(--font)'
          }
        }, aktif ? YU.h('span', { metin: '✓' }) : null);

        kap.appendChild(YU.h('button', {
          tip: 'button',
          sinif: 'yu-menu-oge' + (aktif ? ' aktif' : ''),
          title: aktif ? dugum.ad + ' · grafikte gösteriliyor' : 'Grafikte göster: ' + dugum.ad,
          stil: {
            textAlign: 'left', border: 'none', width: '100%', cursor: 'pointer',
            background: aktif ? 'var(--vurgu-zemin)' : 'transparent',
            display: 'flex', alignItems: 'center', gap: '10px',
            /* Yazı bir kademe büyük ve seçili olan kalın (25.08.2026). */
            font: (aktif ? '600 ' : '500 ') + '15.5px/1.35 var(--font)',
            padding: '9px 10px'
          },
          onClick: function () {
            YU.git(SAYFA, bagKur(d, { gosterge: esKalem(dugum, d.gosterge.tur).kod }));
          }
        },
          isaret,
          YU.h('span', { metin: menuEtiketi(dugum.ad), stil: { flex: '1', minWidth: '0' } })
        ));
      })(liste[i]);
    }
    return kap;
  }

  /* ÜST: seçili malzemenin kalemleri — Üretim | Satış segment düğmesi.
     Tek kalemli malzemede segment çizilmez (seçecek bir şey yok). */
  function kalemSecimi(d) {
    var dugum = dugumBul(d), i;
    if (!dugum || dugum.kalemler.length < 2) return null;
    var secenekler = [];
    for (i = 0; i < dugum.kalemler.length; i++) {
      secenekler.push({ deger: dugum.kalemler[i].kod, metin: kalemAdi(dugum.kalemler[i]) });
    }
    return YU.ui.secimGrubu({
      secenekler: secenekler,
      deger: d.gosterge.kod,
      onDegis: function (kod) { YU.git(SAYFA, bagKur(d, { gosterge: kod })); }
    });
  }

  /* ==================================================================
     2. Grafik paneli
     ================================================================== */

  function grafikPaneli(d) {
    var g = d.gosterge, birikimli = d.mod === 'birikimli';
    var bas = d.basGun, bit = d.bitGun, N = bit;
    var kampanyalar = tumKampanyalar(d);
    var i, j;

    /* Zaman ölçeği: gün / hafta (7 gün) / ay (30 gün). Bloklar KAMPANYA GÜNÜ
       üzerinden kurulur; kampanyalar zaten gün sırasına göre karşılaştırıldığı
       için her kampanyanın aynı numaralı bloğu karşı karşıya gelir. */
    var blokGun = OLCEK_BLOK[d.olcek] || 1;
    var bloklar = [];
    for (i = bas; i <= bit; i += blokGun) {
      bloklar.push({ bas: i, bit: Math.min(i + blokGun - 1, bit) });
    }

    /* Etiket: günde gün numarası, hafta/ayda gün aralığı ("8–14"). */
    var noktalar = [];
    for (i = 0; i < bloklar.length; i++) {
      var bl = bloklar[i];
      noktalar.push({
        etiket: blokGun === 1 ? String(bl.bas) : (bl.bas + '–' + bl.bit),
        baslik: blokGun === 1
          ? gunMetni(bl.bas)
          : (OLCEK_ADI[d.olcek] + ' ' + YU.fmt.sayi(i + 1) + ' · ' + bl.bas + '–' + bl.bit + '. gün')
      });
    }

    /* Bütün kampanyalar için seri kurulur — işaretsizler de listede durur
       ki efsaneden geri açılabilsinler. Birikimli görünüm SEÇİLEN aralığın
       içinde toplar: aralık daraltıldıysa birikim de oradan başlar. */
    var seriler = [];
    for (i = 0; i < kampanyalar.length; i++) {
      var kmp = kampanyalar[i];
      var veri = YU.analiz.kampanyaVerisi(YU.db, kmp.donem);
      var pencere = YU.analiz.pencere(veri, g, bas, bit);
      var degerler = [], altlar = [], toplam = 0, b;

      for (b = 0; b < bloklar.length; b++) {
        /* Blok toplamı: içindeki günlerin toplamı. Bloğun HİÇBİR gününde
           kayıt yoksa değer null kalır (çizgi kopar); en az bir gün kayıtlıysa
           blok o kadarını taşır — yarım hafta sıfır gibi görünmesin. */
        var blokToplam = null, ilkTarih = null, sonTarih = null;
        for (j = bloklar[b].bas - bas; j <= bloklar[b].bit - bas; j++) {
          var gn = pencere.gunler[j];
          if (!gn) continue;
          if (gn.deger !== null) blokToplam = YU.yuvarla((blokToplam || 0) + gn.deger);
          if (gn.tarih) { if (!ilkTarih) ilkTarih = gn.tarih; sonTarih = gn.tarih; }
        }
        if (blokToplam !== null) toplam = YU.yuvarla(toplam + blokToplam);
        degerler.push(birikimli ? (blokToplam === null ? null : toplam) : blokToplam);
        altlar.push(!ilkTarih ? null
          : (blokGun === 1 || ilkTarih === sonTarih
              ? YU.fmt.tarih(ilkTarih)
              : YU.fmt.tarih(ilkTarih) + ' – ' + YU.fmt.tarih(sonTarih)));
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
      /* GÜNLÜK görünümde pencerede sabit sayıda nokta durur (kullanıcı isteği,
         25.08.2026): gün ölçeğinde 30 gün baştan sona görünür, öncesine ve
         sonrasına iki yandaki oklarla kaydırılarak gidilir. Hafta ve ay
         ölçeğinde nokta zaten azaldığı için pencere de kısalır — grafik
         seyrelmez.
         BİRİKİMLİ görünümde kaydırma YOKTUR (gorunenNokta verilmez): hangi
         ölçek seçilirse seçilsin kampanyanın 1. gününden son gününe kadar
         tamamı tek ekranda görünür. */
      gorunenNokta: birikimli ? 0 : (blokGun === 1 ? 30 : (blokGun === 7 ? 16 : 12)),
      bicim: function (v) { return miktar(v, g.birim); },
      eksenBicim: eksenMetni(g.birim),
      /* Efsane aynı zamanda seçicidir: işaret kalkınca çizgi grafikten
         çıkar, tıklanınca geri gelir (kullanıcı isteği, 23.08.2026). */
      onSeriTikla: function (indeks) {
        if (kampanyalar[indeks]) kampanyaDegistir(d, kampanyalar[indeks].donem.ad);
      }
    });

    /* Grafiğin üstündeki denetim satırı: solda Üretim/Satış, hemen sağında
       Günlük/Birikimli (kullanıcı isteği, 25.08.2026 — ikincisi eskiden
       sayfanın en üstünde ayrı bir paneldeydi). "Hangi malzeme" sol menüde,
       "hangi kalem" ve "nasıl çizilsin" bu satırda okunur. */
    var kalem = kalemSecimi(d);
    var sagSutun = YU.h('div', { stil: { flex: '1', minWidth: '0' } });
    sagSutun.appendChild(YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }
    },
      kalem,
      kalem ? YU.h('span', { sinif: 'yu-arac-ayrac' }) : null,
      gorunumSecimi(d),
      YU.h('span', { sinif: 'yu-arac-ayrac' }),
      olcekSecimi(d),
      /* Tarih aralığı çipi sayfanın sağ üstünden BURAYA taşındı
         (kullanıcı isteği, 25.08.2026): grafiğin ayarları tek satırda. */
      YU.h('span', { sinif: 'yu-arac-ayrac' }),
      aralikCipi(d)
    ));
    sagSutun.appendChild(grafik);

    return YU.ui.panel({
      baslik: (birikimli ? 'Birikimli Karşılaştırma · ' : 'Günlük Karşılaştırma · ') + g.ad,
      ikon: '#ic-chart',
      sag: aralikMetni(d),
      govde: YU.h('div', { stil: { display: 'flex', gap: '18px', alignItems: 'stretch' } },
        solMenuKur(d),
        sagSutun
      )
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
        /* Seçim işareti ve satır tıklaması KALDIRILDI (kullanıcı kararı,
           25.08.2026): gösterge seçimi artık grafiğin solundaki listeden
           yapılır; bu tablo yalnız rakamları gösterir. Seçili gösterge
           satırı vurgu şeridiyle işaretli kalır. */
        var hucreler = [YU.h('span', { sinif: aktif ? 'yu-guclu' : '', metin: g.ad, stil: { minWidth: '0' } })];
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
          /* Satış satırları kalıcı dolgu zeminiyle ayrışır (kullanıcı isteği,
             24.08.2026): üretim ile satış zıt kalemlerdir, art arda aynı
             görünmesin. Üretim ve Çuvallama satırları düz kalır. */
          zemin: /-satis$/.test(g.kod),
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
    /* Kolon adı "Gösterge" JARGONDU; "Ürünler" oldu (kullanıcı kararı,
       25.08.2026). */
    var sutunlar = [{ baslik: 'Ürünler' }];
    var sutunSirasi = gosterimSirasi(d);
    for (i = 0; i < sutunSirasi.length; i++) {
      sutunlar.push({
        baslik: sezonEtiketi(d, sutunSirasi[i]) + sutunSirasi[i].donem.ad,
        hiza: 'sag', mono: true, genislik: 205
      });
    }
    if (!d.tamAralikMi) {
      sutunlar.push({ baslik: 'Seçili Aralık Farkı', hiza: 'sag', mono: true, genislik: 160 });
      sutunlar.push({ baslik: 'Aralık %', hiza: 'sag', genislik: 100 });
    }
    /* Başlıkta gün sayısı YOK (kullanıcı tercihi, 23.08.2026): '30. gün Farkı'
       tek bir günün farkı gibi okunuyordu. Kaçıncı günde olunduğu sayfa alt
       başlığında, aralık çipinde ve tablo üstü açıklamada zaten yazıyor. */
    sutunlar.push({ baslik: 'Sezon Başından Bugüne Toplam', hiza: 'sag', genislik: 250 });

    var tablo = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      /* Kolonlar birbirine yapışık duruyordu (kullanıcı isteği, 25.08.2026):
         yalnız bu tabloda yatay hücre dolgusu 14px yerine 22px.
         yu-tablo-yazi-buyuk: satır yazıları bir kademe büyür (kullanıcı
         isteği, 25.08.2026 — "biraz ufak gibi geldi"). yu-tablo-iri
         kullanılmadı: o varyant satır dolgusunu da artırıp satırı 58px'ten
         104px'e çıkarıyordu, istenen yalnız yazı boyutuydu. */
      sinif: 'yu-tablo-yazi-buyuk',
      dolgu: '8px 22px',
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

    /* İade bu ekranda YOK (M30, kullanıcı kararı 25.08.2026): üretim
       serileri GunlukHareket.Uretim anlamını korur, iade seriye katılmaz.
       Aylık Özet grafiği iadeyi üretime kattığı için fark tek cümleyle
       burada söylenir — sessiz tutarsızlık kalmasın. */
    /* İade notu KALDIRILDI (kullanıcı isteği, 25.08.2026 · KURAL 8): davranış
       değişmedi — üretim serileri GunlukHareket.Uretim'i taşır, iade seriye
       katılmaz; yalnız tablo altındaki açıklama ekrandan alındı. */

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


    if (!d.gecmis) {
      kap.appendChild(YU.ui.serit({
        tur: 'bilgi', baslik: 'Tek kampanya var',
        metin: 'Karşılaştırma için en az iki kampanya dönemi gerekir. Yeni kampanya açılınca (yeni devir tarihi) bu ekran iki dönemi gün gün karşılaştırır.'
      }));
    }

    /* Grafik ve toplam tablosu TEK PANELDE (kullanıcı isteği, 25.08.2026):
       ikisi aynı seçimi anlatıyor, iki ayrı kutu gereksiz kesinti yapıyordu.
       Aralarına silik bir ayraç çizgisi konur; tablonun kendi başlığı ve sağ
       bilgisi ayracın altında panel içi bir alt başlık olarak durur. */
    var gPanel = grafikPaneli(d);
    var tPanel = tabloPaneli(d);
    /* Panelin İKİ başlığı da aynı ölçüde (kullanıcı isteği, 25.08.2026):
       grafik başlığı ile toplam tablosunun başlığı eşit ağırlıkta okunur.
       Ölçü burada veriliyor; ortak .yu-panel-baslik sınıfına dokunulmuyor
       ki diğer ekranların başlıkları değişmesin. */
    var gBaslikYazi = gPanel.querySelector('.yu-panel-baslik');
    if (gBaslikYazi) gBaslikYazi.style.font = '700 22px/1.25 var(--font)';
    var gIkon = gPanel.querySelector('.yu-panel-bas svg');
    if (gIkon) { gIkon.setAttribute('width', '24'); gIkon.setAttribute('height', '24'); }

    var gGovde = gPanel.querySelector('.yu-panel-govde');
    var tBas = tPanel.querySelector('.yu-panel-bas');
    var tGovde = tPanel.querySelector('.yu-panel-govde');

    if (gGovde && tGovde) {
      gGovde.appendChild(YU.h('div', {
        stil: {
          borderTop: '1px solid var(--ayrac)',
          /* Panel dolgusu 16px: ayraç tam kenardan kenara uzansın diye
             o kadar dışarı taşar (ölçüldü 25.08.2026). */
          margin: '4px -16px 0'    /* ayraç ile başlık arası daraltıldı
                                       (kullanıcı isteği, 25.08.2026) */
        }
      }));
      if (tBas) {
        tBas.style.margin = '6px 0 2px';
        /* Panel başlığı normalde 15px dikey dolgu taşır; birleşik panelde
           bu, ayraç ile tablo arasını gereksiz açıyordu (ölçüldü: başlık
           bloğu 59px). Yatay dolgu KALIR — başlık tablo hücreleriyle
           hizalı dursun (kullanıcı isteği, 25.08.2026). */
        tBas.style.padding = '4px 18px';
        /* Alt başlık, panel başlığıyla aynı ağırlıkta okunsun (kullanıcı
           isteği, 25.08.2026): yazı ve ikon bir boy büyütülür. */
        var tBaslikYazi = tBas.querySelector('.yu-panel-baslik');
        if (tBaslikYazi) tBaslikYazi.style.font = '700 22px/1.25 var(--font)';
        var tIkon = tBas.querySelector('svg');
        if (tIkon) { tIkon.setAttribute('width', '24'); tIkon.setAttribute('height', '24'); }
        gGovde.appendChild(tBas);
      }
      /* Tablo gövdesi de panel dolgusunun dışına taşar: satırlar panelin
         kenarına otursun (dolgusuz tablo görünümü korunur). */
      tGovde.style.margin = '0 -16px -16px';
      gGovde.appendChild(tGovde);
      kap.appendChild(gPanel);
    } else {
      kap.appendChild(gPanel);
      kap.appendChild(tPanel);
    }
  }

  YU.sayfaTanimla({
    kod: SAYFA,
    baslik: 'Genel Analiz',
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

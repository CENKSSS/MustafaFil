/* Yan Ürünler Stok Takip — günlük JSON yedekleri (tıklamasız).

   Plan: GUNLUK-YEDEK-PLANI.md · Sunucu: yan-urunler-sunucu.py

   REVİZE (kullanıcı direktifi, 27.08.2026): "otomatik olmalı, manuel tıklama
   olmayacak." İlk sürüm tarayıcıya klasör seçtiriyordu (File System Access);
   tarayıcı el hareketi olmadan diske yazamadığı için yazma SUNUCUYA taşındı.
   Sunucu, yanındaki gunluk-veriler\ klasörünü kendisi açar; bu katman her
   depo.kaydet sonrasında değişen dosyaları oraya POST eder:

     gunluk-veriler\
       27.08.2026.json    o güne ait TÜM hareketler — yalnız verisi olan gün
       _tam-paket.json    tam yedek (depo.disaAktar biçimi — geri yükleme okur)
       _tanimlar.json     kullanıcı/malzeme/silo/devir/kilit tanımları

   Yalnız DEĞİŞEN dosya gönderilir: her dosyanın özeti (hash) localStorage
   manifestinde durur. Gün güncellenirse yalnız o günün dosyası yenilenir;
   sunucudaki klasör boşaltılmışsa açılışta her şey baştan yazılır.

   Eski sunucuda (salt statik) uçlar yoktur — katman kendini sessizce kapatır,
   uygulama aynen çalışır; "Yedek İndir/Yükle" yolu her tarayıcıda durur. */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});

  var UC = '/api/gunluk-yedek';
  var OZET_ANAHTAR = 'yu.yedek.ozet';    /* manifest: { dosyaAdi: "hash" } */
  var BEKLEME_MS = 400;                  /* art arda kayıtlar tek gönderime birleşir */
  var TEKRAR_MS = 30000;                 /* yazma hatasında kendiliğinden yeniden dener */

  var durum = 'yok';       /* yok (sunucu desteklemiyor) | bagli | hata */
  var sonHata = '';
  var klasor = '';         /* sunucunun bildirdiği gerçek yol — ipucunda gösterilir */
  var zamanlayici = null;
  var tekrarSayaci = null;
  var calisiyor = false;
  var tekrarGerek = false;
  var dinleyenler = [];

  function bildir() {
    for (var i = 0; i < dinleyenler.length; i++) {
      try { dinleyenler[i](durum, sonHata, klasor); } catch (e) { /* dinleyici hatası yazımı durdurmaz */ }
    }
  }
  function durumKur(d, hata) { durum = d; sonHata = hata || ''; bildir(); }

  /* ---------- adlandırma, özet, manifest ---------- */

  /* Gün dosyası adı GG.AA.YYYY (kullanıcı kararı, 27.08.2026). */
  function dosyaAdi(iso) { return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) + '.json'; }

  /* djb2 — kriptografik değil; "içerik değişti mi" sorusuna yeter. */
  function ozet(metin) {
    var h = 5381, i;
    for (i = 0; i < metin.length; i++) h = ((h << 5) + h + metin.charCodeAt(i)) | 0;
    return String(h) + ':' + metin.length;
  }

  function manifestOku() {
    try { return JSON.parse(window.localStorage.getItem(OZET_ANAHTAR)) || {}; }
    catch (e) { return {}; }
  }
  function manifestYaz(m) {
    try { window.localStorage.setItem(OZET_ANAHTAR, JSON.stringify(m)); }
    catch (e) { /* kota — bir dahaki turda her şey yeniden gönderilir, veri kaybı yok */ }
  }

  /* ---------- içerik üretimi ---------- */

  /* Gün anahtarı: hareket satırlarında Tarih zaten ISO gün; DegisiklikLog'un
     Tarih'i saatli damgadır, günü baştaki 10 karakterdir. Verisi olmayan gün
     burada hiç doğmaz — kullanıcı isteği: boş güne dosya açılmaz. */
  function dilimle(depo) {
    var gunler = {};
    function grup(dizi, ad, gunAl) {
      for (var i = 0; i < dizi.length; i++) {
        var g = gunAl(dizi[i]);
        if (!g) continue;
        var kayit = gunler[g] || (gunler[g] = { kuruKuspe: null, siloHareket: [], gunlukHareket: [], degisiklikLog: [] });
        if (ad === 'kuruKuspe') kayit.kuruKuspe = dizi[i];
        else kayit[ad].push(dizi[i]);
      }
    }
    grup(depo.kuruKuspeGunluk, 'kuruKuspe', function (r) { return r.Tarih; });
    grup(depo.siloHareket, 'siloHareket', function (r) { return r.Tarih; });
    grup(depo.gunlukHareket, 'gunlukHareket', function (r) { return r.Tarih; });
    grup(depo.degisiklikLog, 'degisiklikLog', function (r) { return String(r.Tarih || '').slice(0, 10); });
    return gunler;
  }

  /* yazilma damgası HASH DIŞIDIR: içeriğe girseydi özet her turda değişir,
     hiçbir şey değişmese de 160+ dosya her kayıtta yeniden yazılırdı
     (ölçüldü, 27.08.2026). Özet govde'den çıkar; damga yalnız dosyaya girer. */
  function paketle(govde) {
    var ozMetni = JSON.stringify(govde);
    return {
      oz: ozet(ozMetni),
      metin: '{"yazilma":"' + YU.zaman.damga() + '",' + ozMetni.slice(1)
    };
  }

  function gunPaketi(iso, dilim) {
    return paketle({
      surum: 1,
      tarih: iso,
      kuruKuspe: dilim.kuruKuspe,
      siloHareket: dilim.siloHareket,
      gunlukHareket: dilim.gunlukHareket,
      degisiklikLog: dilim.degisiklikLog
    });
  }

  function tanimPaketi(depo) {
    return paketle({
      surum: 1,
      kullanicilar: depo.kullanicilar,
      malzemeler: depo.malzemeler,
      silolar: depo.silolar,
      devirStok: depo.devirStok,
      siloDevirStok: depo.siloDevirStok,
      kampanyaKilitleri: depo.kampanyaKilitleri,
      sayaclar: depo.sayaclar
    });
  }

  /* ---------- sunucuya gönderme ---------- */

  /* Değişen dosyaları tek istekte gönderir. Özet kıyası sayesinde: geçmiş
     güne düzeltme o günün dosyasını, tanım değişikliği yalnız _tanimlar'ı,
     manifest ya da klasör kaybı HER dosyayı gönderir. */
  function calis() {
    if (durum === 'yok' || !YU.db) return Promise.resolve();

    var manifest = manifestOku();
    var gidecek = [];
    function gerekliyse(ad, paket) {
      if (manifest[ad] === paket.oz) return;
      gidecek.push({ ad: ad, metin: paket.metin, oz: paket.oz });
    }

    var gunler = dilimle(YU.db);
    for (var iso in gunler) {
      if (!Object.prototype.hasOwnProperty.call(gunler, iso)) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;   /* bozuk tarihli satır dosya açtırmaz */
      gerekliyse(dosyaAdi(iso), gunPaketi(iso, gunler[iso]));
    }
    gerekliyse('_tanimlar.json', tanimPaketi(YU.db));
    var tam = YU.db.disaAktar();
    gerekliyse('_tam-paket.json', { oz: ozet(tam), metin: tam });

    if (!gidecek.length) { durumKur('bagli'); return Promise.resolve(); }

    return fetch(UC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ dosyalar: gidecek.map(function (d) { return { ad: d.ad, metin: d.metin }; }) })
    }).then(function (c) { return c.json().then(function (g) { return { kod: c.status, govde: g }; }); })
      .then(function (c) {
        var yazilan = (c.govde && c.govde.yazilan) || [];
        for (var i = 0; i < gidecek.length; i++) {
          if (yazilan.indexOf(gidecek[i].ad) >= 0) manifest[gidecek[i].ad] = gidecek[i].oz;
        }
        manifestYaz(manifest);
        if (c.kod === 200) { durumKur('bagli'); return; }
        throw new Error((c.govde && c.govde.hatali && c.govde.hatali.join(', ')) || ('HTTP ' + c.kod));
      })
      .catch(function (e) {
        /* Sunucu bir anlığına kapalı olabilir — rozet yanar, kendiliğinden
           yeniden denenir; asıl kayıt localStorage'da çoktan güvende. */
        durumKur('hata', e && e.message ? e.message : String(e));
        if (!tekrarSayaci) {
          tekrarSayaci = setTimeout(function () { tekrarSayaci = null; sirala(); }, TEKRAR_MS);
        }
      });
  }

  function sirala() {
    if (calisiyor) { tekrarGerek = true; return; }
    calisiyor = true;
    calis().then(function () {
      calisiyor = false;
      if (tekrarGerek) { tekrarGerek = false; sirala(); }
    });
  }

  /* ---------- dış yüz ---------- */

  YU.yedekci = {
    durum: function () { return { durum: durum, hata: sonHata, klasor: klasor }; },
    dinle: function (fn) { dinleyenler.push(fn); },

    /* depo.kaydet her başarılı yazmada çağırır. Kısa bekleme art arda
       kayıtları tek gönderime birleştirir; kaydetin kendisini hiç bekletmez. */
    tetikle: function () {
      if (durum === 'yok') return;
      if (zamanlayici) clearTimeout(zamanlayici);
      zamanlayici = setTimeout(function () { zamanlayici = null; sirala(); }, BEKLEME_MS);
    },

    /* Geri yükleme: klasördeki tam paketi metin olarak verir. */
    tamPaketOku: function () {
      return fetch(UC + '/dosya?ad=_tam-paket.json', { cache: 'no-store' }).then(function (c) {
        if (c.status !== 200) throw new Error('Klasörde _tam-paket.json yok ya da okunamadı (HTTP ' + c.status + ').');
        return c.text();
      });
    },

    /* Açılış: sunucu yedek ucunu tanıyor mu? Tanıyorsa hemen bir tur yazılır
       (kaçan günler tamamlanır). Klasör boşaltılmışsa manifest sıfırlanır ki
       her şey baştan yazılsın. Tanımıyorsa katman sessizce kapalı kalır. */
    baslat: function () {
      /* Test kapatması: geliştirme/önizleme tarayıcısı localStorage'ına
         yu.yedek.kapali=1 yazar ve ÖRNEK verisi gerçek yedek klasörüne
         karışmaz (27.08.2026'da yaşandı: önizleme + gerçek tarayıcı aynı
         klasöre yazıp birbirini ezdi). Kullanıcı tarafında bu anahtar yoktur,
         davranış tamamen otomatiktir. */
      try { if (window.localStorage.getItem('yu.yedek.kapali') === '1') { durumKur('yok'); return; } }
      catch (e) { /* storage kapalıysa normal akış */ }
      fetch(UC + '/saglik', { cache: 'no-store' }).then(function (c) {
        if (c.status !== 200) throw new Error('uc yok');
        return c.json();
      }).then(function (g) {
        klasor = (g && g.klasor) || '';
        if (g && g.adet === 0) manifestYaz({});
        durumKur('bagli');
        sirala();
      }).catch(function () { durumKur('yok'); });
    }
  };
})();

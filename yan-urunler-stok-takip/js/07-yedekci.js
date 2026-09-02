/* Yan Ürünler Stok Takip — günlük JSON yedekleri (tıklamasız).

   Plan: GUNLUK-YEDEK-PLANI.md · Sunucu: yan-urunler-sunucu.py

   REVİZE (kullanıcı direktifi, 27.08.2026): "otomatik olmalı, manuel tıklama
   olmayacak." İlk sürüm tarayıcıya klasör seçtiriyordu (File System Access);
   tarayıcı el hareketi olmadan diske yazamadığı için yazma SUNUCUYA taşındı.
   Sunucu, yanındaki gunluk-veriler\ klasörünü kendisi açar; bu katman her
   depo.kaydet sonrasında değişen dosyaları oraya POST eder:

     gunluk-veriler\
       27.08.2026.json    o güne ait TÜM hareketler — yalnız verisi olan gün
       (Toplu dosyalar KALDIRILDI — kullanıcı direktifi, 31.08.2026:
       "komple veri seti olmasın, tekil günler olsun". _tam-paket.json ve
       _tanimlar.json artık yazılmaz; klasörde yalnız gün dosyaları durur ve
       sunucu en yeni 14 günü tutup daha eskisini siler. Tam kurtarma görevi
       gecelik SQLite yedeğindedir — KURAL 13 revizesi.)

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
  var saglikSayaci = null;   /* sağlık isteğinin yeniden deneme zamanlayıcısı */
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
        var kayit = gunler[g] || (gunler[g] = { kuruKuspe: null, siloHareket: [], gunlukHareket: [],
                                                degisiklikLog: [], silinenKayitlar: [],
                                                olayGunlugu: [], stokFotograflari: [] });
        if (ad === 'kuruKuspe') kayit.kuruKuspe = dizi[i];
        else kayit[ad].push(dizi[i]);
      }
    }
    grup(depo.kuruKuspeGunluk, 'kuruKuspe', function (r) { return r.Tarih; });
    grup(depo.siloHareket, 'siloHareket', function (r) { return r.Tarih; });
    grup(depo.gunlukHareket, 'gunlukHareket', function (r) { return r.Tarih; });
    grup(depo.degisiklikLog, 'degisiklikLog', function (r) { return String(r.Tarih || '').slice(0, 10); });
    /* Silinen kayıt kopyaları da güne bağlıdır (kullanıcı direktifi,
       31.08.2026 — "nerede veri varsa hepsi jsonda gözükecek"): yönetici
       ekranlarında çizili "Silindi" satırı olarak görünürler ve dosyada
       olmazlarsa geri yüklemede kaybolurlar. Gün, SİLİNEN KAYDIN tarihi. */
    grup(depo.silinenKayitlar || [], 'silinenKayitlar', function (r) {
      return r.Kayit && r.Kayit.Tarih ? r.Kayit.Tarih : null;
    });
    /* Arşiv tabloları da güne bağlanır (tam denetim, 31.08.2026): olay
       günlüğü çağrı gününe, stok fotoğrafı iş gününe. Ekranda görünmezler
       ama veridirler; dosyada olmazlarsa geri yüklemede kaybolurlar. */
    grup(depo.olayGunlugu || [], 'olayGunlugu', function (r) { return String(r.Tarih || '').slice(0, 10); });
    grup(depo.stokFotograflari || [], 'stokFotograflari', function (r) { return r.Tarih; });
    return gunler;
  }

  /* yazilma damgası HASH DIŞIDIR: içeriğe girseydi özet her turda değişir,
     hiçbir şey değişmese de 160+ dosya her kayıtta yeniden yazılırdı
     (ölçüldü, 27.08.2026). Özet govde'den çıkar; damga yalnız dosyaya girer. */
  /* DİKEY (girintili) JSON — kullanıcı isteği, 30.08.2026. Gün dosyaları da
     okunmak için var; tek satırda hangi günde ne olduğu görünmüyordu.

     ÖZET SIKIŞIK METİNDEN ÇIKAR: damga hash'e girmemeli (yukarıdaki not),
     girinti de girmemeli — yoksa biçim değiştiği gün 160+ dosya boş yere
     yeniden yazılır. Bu yüzden oz sıkışık JSON'dan, metin girintili
     nesneden üretilir. Damga ilk alan olarak durur. */
  function paketle(govde) {
    var ozMetni = JSON.stringify(govde);
    var damgali = { yazilma: YU.zaman.damga() }, k;
    for (k in govde) {
      if (Object.prototype.hasOwnProperty.call(govde, k)) damgali[k] = govde[k];
    }
    return {
      oz: ozet(ozMetni),
      metin: JSON.stringify(damgali, null, 2)
    };
  }

  /* O GÜNÜN DEVRİ (kullanıcı direktifi, 31.08.2026 — "hata istemiyorum
     gerçek projede").

     Gün dosyası eskiden yalnız hareketleri tutuyordu; devir ile kampanya
     _tanimlar.json'daydı. Ölçüldü: veri sıfırlanınca _tanimlar.json ANINDA
     boş hâliyle üzerine yazılıyor, gün dosyaları ise duruyor. Yani tek günü
     geri yükleyen kullanıcı devirsiz kalıyor ve her stok devir kadar eksik
     görünüyordu — hata vermeden, sessizce.

     Çözüm: günün bağlı olduğu kampanyanın devir satırları ve kampanya
     başlığı dosyanın içine yazılır. Küçük bir tekrardır; karşılığında gün
     dosyası kendi başına yeterli olur. */
  function gununDevri(depo, iso) {
    var bos = { devirStok: [], siloDevirStok: [], kampanya: null };
    if (!depo) return bos;
    var gruplar = (YU.servis && YU.servis.kampanyaGruplari) ? YU.servis.kampanyaGruplari(depo) : null;
    var bas = null, i;
    if (gruplar) {
      for (i = gruplar.length - 1; i >= 0; i--) {
        if (iso >= gruplar[i].bas && (!gruplar[i].sinir || iso < gruplar[i].sinir)) { bas = gruplar[i].bas; break; }
      }
    } else {
      /* Servis yoksa (tek dosya testi): tarihten önceki EN SON devir günü. */
      var t = (depo.devirStok || []).concat(depo.siloDevirStok || []);
      for (i = 0; i < t.length; i++) {
        if (t[i].DevirTarihi <= iso && (!bas || t[i].DevirTarihi > bas)) bas = t[i].DevirTarihi;
      }
    }
    if (!bas) return bos;

    function suz(dizi) {
      var c = [], j;
      for (j = 0; j < (dizi || []).length; j++) if (dizi[j].DevirTarihi === bas) c.push(dizi[j]);
      return c;
    }
    var kmp = null, b = depo.kampanyaBasliklari || [];
    for (i = 0; i < b.length; i++) if (b[i].DevirTarihi === bas) kmp = b[i];
    /* Kampanyanın kilidi de dosyaya girer (31.08.2026): kilit adla tutulur,
       ad da gruplardan okunur. Kilitli bir gün geri yüklenince kilit de
       döner — yedeklenen durumun aynısı. */
    var kilit = null, ad = null;
    if (gruplar) { for (i = 0; i < gruplar.length; i++) if (gruplar[i].bas === bas) ad = gruplar[i].ad; }
    var kl = depo.kampanyaKilitleri || [];
    for (i = 0; i < kl.length; i++) if (ad && kl[i].Kampanya === ad) kilit = kl[i];
    return { devirStok: suz(depo.devirStok), siloDevirStok: suz(depo.siloDevirStok),
             kampanya: kmp, kampanyaKilidi: kilit };
  }

  /* surum 2: devir · surum 3: silinen kopyalar · surum 4: olay günlüğü,
     stok fotoğrafı, kampanya kilidi (31.08.2026). Eski dosyalar okunmaya
     devam eder — geri yükleme alanları varsa kullanır. */
  function gunPaketi(iso, dilim, devir) {
    return paketle({
      surum: 4,
      tarih: iso,
      kuruKuspe: dilim.kuruKuspe,
      siloHareket: dilim.siloHareket,
      gunlukHareket: dilim.gunlukHareket,
      degisiklikLog: dilim.degisiklikLog,
      silinenKayitlar: dilim.silinenKayitlar,
      olayGunlugu: dilim.olayGunlugu,
      stokFotograflari: dilim.stokFotograflari,
      devirStok: devir.devirStok,
      siloDevirStok: devir.siloDevirStok,
      kampanya: devir.kampanya,
      kampanyaKilidi: devir.kampanyaKilidi
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
      gerekliyse(dosyaAdi(iso), gunPaketi(iso, gunler[iso], gununDevri(YU.db, iso)));
    }

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
        /* Sunucu 14 gün penceresinin dışına düşen dosyaları siler ve adlarını
           bildirir; manifestten de düşülür ki defter klasörle aynı kalsın. */
        var silinen = (c.govde && c.govde.silinen) || [];
        for (i = 0; i < silinen.length; i++) delete manifest[silinen[i]];
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

  /* SUNUCU GEÇİCİ KAPALI İLE UÇ YOK AYRI ŞEYLERDİR (denetim bulgusu BUG-015,
     30.08.2026). Eskiden sağlık isteğinin HER hatası 'yok' sayılıyordu ve
     tetikle() 'yok' durumunda hemen döndüğü için, açılışta sunucu bir anlığına
     cevap vermezse günlük yedek O OTURUM BOYUNCA hiç çalışmıyordu — 30 saniyelik
     tekrar yalnız calis()'in hata dalında kuruluyordu, buraya hiç uğramıyordu.

       404       -> sunucu bu ucu tanımıyor (eski statik sunucu): kalıcı kapalı
       ağ / 5xx  -> geçici: 'hata' kurulur, sağlık isteği yeniden denenir

     sirala() değil SAĞLIK isteği tekrarlanır: "klasör boşaltılmış, manifesti
     sıfırla" bilgisi yalnız sağlık yanıtında var; calis() onu taşımıyor. */
  function saglikDene() {
    return fetch(UC + '/saglik', { cache: 'no-store' }).then(function (c) {
      if (c.status === 404) { var yok = new Error('uc yok'); yok.ucYok = true; throw yok; }
      if (c.status !== 200) throw new Error('HTTP ' + c.status);
      return c.json();
    }).then(function (g) {
      klasor = (g && g.klasor) || '';
      if (g && g.adet === 0) manifestYaz({});
      durumKur('bagli');
      sirala();
    }).catch(function (e) {
      if (e && e.ucYok) { durumKur('yok'); return; }
      durumKur('hata', e && e.message ? e.message : String(e));
      if (!saglikSayaci) {
        saglikSayaci = setTimeout(function () { saglikSayaci = null; saglikDene(); }, TEKRAR_MS);
      }
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

    /* Açılış: sunucu yedek ucunu tanıyor mu? Tanıyorsa hemen bir tur yazılır
       (kaçan günler tamamlanır). Klasör boşaltılmışsa manifest sıfırlanır ki
       her şey baştan yazılsın. Tanımıyorsa katman sessizce kapalı kalır. */
    baslat: function () {
      /* Test kapatma anahtarı (yu.yedek.kapali) KALDIRILDI (kullanıcı
         direktifi, 31.08.2026). Örnek veri üreticisi silindiği için önizleme
         tarayıcısının gerçek yedek klasörüne karıştıracağı test verisi de
         kalmadı; anahtar ölü kaldı. */
      saglikDene();
    }
  };
})();

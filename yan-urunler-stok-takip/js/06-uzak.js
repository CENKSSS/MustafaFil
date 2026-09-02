/* Yan Ürünler Stok Takip — sunucu köprüsü (denemelik ortak veri).

   Plan: DENEMELIK-SUNUCU-PLANI.md · Sunucu: sunucu/Program.cs

   NE YAPAR
   Depo, tarayıcının localStorage'ı yerine fabrika sunucusundaki SQLite
   veritabanını kullanır. Üç kişi aynı veriyi görür.

   NEDEN TÜM PAKET GİDİYOR
   İş kuralları (D1–D18, 3.007 satır) istemcide duruyor; sunucu onları bilmez.
   Satır satır yazmak, kuralın BAYAT kopya üzerinde çalışması demekti:
   Ahmet'in D7 denetimi Hatice'nin aynı anda yaptığı silo çekişini görmez ve
   silo sessizce eksiye düşerdi. Tüm paketi sürüm kontrolüyle göndermek bunu
   imkânsız kılar — kabul edilen her yazma, O ANKİ gerçek veri üzerinde
   hesaplanmıştır.

   ÇAKIŞMA GÖRÜNMEZ
   Sunucu 409 dönerse taze paketi de yollar. Köprü paketi yerleştirir ve AYNI
   girdiyle servisi yeniden koşar. Kurallar taze veride de geçiyorsa kayıt
   olur, kullanıcı hiçbir şey görmez. Geçmiyorsa doğru hata çıkar
   ("Silo 1 · 15.07.2026 · −150.000") — sessiz bozulma yerine gerçek sebep.

   BU DOSYA KENDİ BAŞINA HİÇBİR ŞEY YAPMAZ. Bağlanması 99-baslat.js'in işidir;
   yüklenmesi tek başına davranışı değiştirmez. */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});

  /* Paketin tablo olmayan üst düzey alanları. */
  var TABLO_DISI = { surum: true, sayaclar: true };

  var ayar = {
    kok: '',              /* aynı köken; farklı sunucu için "http://sunucu:8080" */
    yoklamaSaniye: 5,     /* GET /api/surum sıklığı — tek tamsayı döner, ucuz */
    enCokDeneme: 3,       /* çakışmada kaç kez yeniden hesaplanır */
    zamanAsimiMs: 20000
  };

  var depo = null;        /* bağlı depo (YU.db) */
  var surum = 0;          /* sunucudaki yazma sayacı — son bilinen değer */
  var yoklamaSayaci = null;
  var yoklamaCalisiyor = false;
  var tazelemeKancasi = null;

  /* ---------------------------------------------------------------
     HTTP
     --------------------------------------------------------------- */

  function istek(yol, secenek) {
    secenek = secenek || {};
    var kes = typeof AbortController === 'function' ? new AbortController() : null;
    var sayac = kes ? setTimeout(function () { kes.abort(); }, ayar.zamanAsimiMs) : null;

    return fetch(ayar.kok + yol, {
      method: secenek.method || 'GET',
      headers: secenek.govde ? { 'Content-Type': 'application/json' } : undefined,
      body: secenek.govde ? JSON.stringify(secenek.govde) : undefined,
      cache: 'no-store',
      signal: kes ? kes.signal : undefined
    }).then(function (c) {
      if (sayac) clearTimeout(sayac);
      return c.text().then(function (metin) {
        var govde = null;
        if (metin) { try { govde = JSON.parse(metin); } catch (e) { govde = null; } }
        return { kod: c.status, govde: govde, ham: metin };
      });
    }, function (e) {
      if (sayac) clearTimeout(sayac);
      throw e;
    });
  }

  /* ---------------------------------------------------------------
     Paketi depoya yerleştirme

     Diziler YERİNDE değiştirilir. Servis ve ekran katmanı depo.malzemeler
     gibi referansları elinde tutuyor (01-cekirdek.js aynı gerekçeyle böyle
     yapıyor); yeni dizi atanırsa o referanslar eski veriyi göstermeye devam
     eder ve ekran sessizce yanlış rakam yazar.
     --------------------------------------------------------------- */

  function paketiYerlestir(paket, yeniSurum) {
    if (!depo) throw new Error('YU.uzak.baglan(depo) çağrılmadı.');
    var ad, gelen, hedef, i;

    for (ad in paket) {
      if (!Object.prototype.hasOwnProperty.call(paket, ad)) continue;
      if (TABLO_DISI[ad]) continue;
      gelen = paket[ad];
      if (Object.prototype.toString.call(gelen) !== '[object Array]') continue;
      hedef = depo[ad];
      if (!hedef) { depo[ad] = gelen.slice(); continue; }
      hedef.length = 0;
      for (i = 0; i < gelen.length; i++) hedef.push(gelen[i]);
    }

    /* Id sayaçları da gelir: silinen Id yeniden dağıtılmasın (M1). */
    depo.sayaclar = paket.sayaclar && typeof paket.sayaclar === 'object'
      ? paket.sayaclar : {};

    surum = yeniSurum;
  }

  function paketiTopla() {
    return JSON.parse(depo.disaAktar());
  }

  /* ---------------------------------------------------------------
     Gönderme
     --------------------------------------------------------------- */

  /* Dönüş: { durum: 'ok' | 'cakisma' | 'veriHatasi', ... } */
  function gonder() {
    return istek('/api/paket', { method: 'POST', govde: { surum: surum, paket: paketiTopla() } })
      .then(function (c) {
        if (c.kod === 200 && c.govde) {
          surum = c.govde.surum;
          return { durum: 'ok', surum: surum };
        }
        if (c.kod === 409 && c.govde) {
          return { durum: 'cakisma', surum: c.govde.surum, paket: c.govde.paket };
        }
        return {
          durum: 'veriHatasi',
          mesaj: (c.govde && c.govde.hata) || ('Sunucu ' + c.kod + ' döndü.')
        };
      });
  }

  function hataSonucu(kod, mesaj) {
    return { ok: false, hatalar: [{ kod: kod, mesaj: mesaj }], uyarilar: [], kayit: null };
  }

  /* ---------------------------------------------------------------
     Dışa açılan yüzey
     --------------------------------------------------------------- */

  YU.uzak = {
    ayar: ayar,

    /* Hangi depoyu taşıdığımızı söyler. */
    baglan: function (d) { depo = d; return YU.uzak; },

    bagliMi: function () { return !!depo; },

    surum: function () { return surum; },

    /* Sunucudaki paketi alıp depoya yerleştirir.
       Veritabanı boşsa (paket null) tohumlanması gerektiğini bildirir —
       tohum kodu sunucuya kopyalanmadı, olduğu yerde duruyor. */
    yukle: function () {
      return istek('/api/paket').then(function (c) {
        if (c.kod !== 200 || !c.govde) {
          throw new Error('Paket alınamadı (sunucu ' + c.kod + ').');
        }
        if (c.govde.paket === null || c.govde.paket === undefined) {
          surum = c.govde.surum || 0;
          return { bos: true, surum: surum };
        }
        paketiYerlestir(c.govde.paket, c.govde.surum);
        return { bos: false, surum: surum };
      });
    },

    /* Depodaki mevcut paketi olduğu gibi gönderir.
       İlk açılış paketi ve "Yedek Yükle" bu yolu kullanır. */
    gonder: function () {
      return gonder().then(function (c) {
        if (c.durum === 'ok') return { ok: true, surum: c.surum };
        if (c.durum === 'cakisma') {
          paketiYerlestir(c.paket, c.surum);
          return { ok: false, sebep: 'cakisma', surum: c.surum };
        }
        return { ok: false, sebep: 'veriHatasi', mesaj: c.mesaj };
      });
    },

    /* ASIL GİRİŞ NOKTASI.
       Ekranlar YU.servis.X(depo, ...) yerine bunu çağırır:
         YU.uzak.calistir('kuruKuspeKaydet', [YU.db, girdi, kullanici])
       Dönüş, servisin kendi sonucudur — { ok, hatalar, uyarilar, kayit }. */
    calistir: function (servisAdi, args) {
      var fn = YU.servis && YU.servis[servisAdi];
      if (typeof fn !== 'function') {
        return Promise.resolve(hataSonucu('Sistem', 'Bilinmeyen servis: ' + String(servisAdi)));
      }
      if (!depo) {
        return Promise.resolve(hataSonucu('Sistem', 'Sunucu bağlantısı kurulmadı.'));
      }

      var deneme = 0;

      function tur() {
        var s = fn.apply(null, args);

        /* Kural hatası: sunucuya HİÇ gitmez. Depo zaten geri sarıldı
           (04-servis.js geriSar deseni). */
        if (!s || !s.ok) return Promise.resolve(s);

        return gonder().then(function (c) {
          if (c.durum === 'ok') return s;

          if (c.durum === 'cakisma') {
            deneme++;
            if (deneme >= ayar.enCokDeneme) {
              /* Üç turda da yetişemedik. Mevcut kırmızı şerit gösterilir;
                 "kaydedildi" YALANI söylenmez. */
              paketiYerlestir(c.paket, c.surum);
              if (typeof YU.depoUyari === 'function') YU.depoUyari('cakisma');
              return hataSonucu('Cakisma',
                'Kayıt yazılamadı: veriler siz çalışırken birkaç kez değişti. ' +
                'Sayfayı yenileyip tekrar deneyin.');
            }
            /* Taze veriyi yerleştir ve AYNI girdiyle baştan hesapla. */
            paketiYerlestir(c.paket, c.surum);
            return tur();
          }

          /* Veri hatası (tekillik/FK ihlali). Yeniden denemek düzeltmez.
             Depoyu sunucudaki gerçekle eşitle ki ekran yalan göstermesin. */
          return YU.uzak.yukle().then(function () {
            return hataSonucu('Sunucu', c.mesaj);
          }, function () {
            return hataSonucu('Sunucu', c.mesaj);
          });
        }, function (e) {
          /* Ağ koptu. Bellekteki değişiklik sunucuya ULAŞMADI; depoyu
             sunucudaki hâle döndürmek, kullanıcıya olmayan bir kaydı
             göstermekten iyidir. */
          return YU.uzak.yukle().then(function () {
            return hataSonucu('Ağ', 'Sunucuya ulaşılamadı: ' +
              (e && e.message ? e.message : 'bağlantı yok') + '. Kayıt yazılmadı.');
          }, function () {
            return hataSonucu('Ağ', 'Sunucuya ulaşılamadı. Kayıt yazılmadı.');
          });
        });
      }

      return tur();
    },

    /* Başkası yazdığında bu sekme haberdar olsun.
       localStorage'ın 'storage' olayının sunucu karşılığı: orada tarayıcı
       haber veriyordu, burada sürümü biz soruyoruz. Yanıt tek tamsayıdır. */
    yoklamayaBasla: function (tazele) {
      tazelemeKancasi = typeof tazele === 'function' ? tazele : null;
      if (yoklamaSayaci) return;
      yoklamaSayaci = setInterval(function () {
        if (yoklamaCalisiyor || !depo) return;
        yoklamaCalisiyor = true;
        istek('/api/surum').then(function (c) {
          yoklamaCalisiyor = false;
          if (c.kod !== 200 || !c.govde) return;
          if (c.govde.surum === surum) return;
          if (tazelemeKancasi) tazelemeKancasi(c.govde.surum);
        }, function () {
          yoklamaCalisiyor = false;   /* ağ hıçkırığı sessiz geçer */
        });
      }, ayar.yoklamaSaniye * 1000);
    },

    yoklamayiDurdur: function () {
      if (!yoklamaSayaci) return;
      clearInterval(yoklamaSayaci);
      yoklamaSayaci = null;
    },

    /* Sunucu saati — fabrika ağı internete kapalı olabilir. */
    saat: function () {
      return istek('/api/saat').then(function (c) {
        return c.kod === 200 && c.govde ? c.govde.utc : null;
      });
    }
  };
})();

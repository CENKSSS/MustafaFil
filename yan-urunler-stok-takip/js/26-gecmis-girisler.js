/* js/26-gecmis-girisler.js — Geçmiş Girişler ekranı.
   Şartname §7: "Tarih aralığına göre girilmiş günlerin listesi; düzeltme ve o
   günün tüm girişlerini silme."  SÖZLEŞME §7 · kod 'gecmis-girisler'.

   Silme D14'e takıldığında hangi silonun hangi gün negatife düştüğü yapısal
   olarak (yalnız hata metninden değil) gösterilir — Şartname Test 10 senaryosu
   "önce 04.07 silinirse 03.07 silinebilir" yönlendirmesini istiyor. */
(function () {
  'use strict';

  var YU = window.YU;

  var SAYFA_BOYU = 25;
  var SAYFA_PENCERE = 7;        /* sayfalama çubuğunda görünen numara sayısı */

  /* Filtreler 24.08.2026'da "sade olsun" kararıyla kaldırılmıştı; 25.08.2026'da
     kullanıcı geri istedi (Şartname §7 "tarih aralığına göre liste" ile uyumlu).
     Süzgeçler açılır çiplerle verilir: tarih aralığı, kampanya, kaydeden kişi.
     ("Durum" süzgeci 25.08.2026'da kullanıcı isteğiyle kaldırıldı.) */
  var durum = {
    sayfa: 1,
    bas: null, bit: null,      /* tarih aralığı (ISO) */
    kampanya: null,            /* kampanya adı ('2026/2027') */
    kisi: null                 /* kullanıcı Id — ilk ya da son giren */
  };
  var dom = { liste: null };

  /* ------------------------------------------------------------------
     Sayı eki — "148 kayıttan 25'i gösteriliyor" (tasarım referansı sayfalama
     dili). Ek, sayının okunuşundaki son ünlüye bağlı olduğu için basamak
     eşlemesiyle çözülür.
     ------------------------------------------------------------------ */

  var BIRLER = { 1: "'i", 2: "'si", 3: "'ü", 4: "'ü", 5: "'i", 6: "'sı", 7: "'si", 8: "'i", 9: "'u" };
  var ONLAR = { 10: "'u", 20: "'si", 30: "'u", 40: "'ı", 50: "'si", 60: "'ı", 70: "'i", 80: "'i", 90: "'ı" };

  function sayiEki(n) {
    var s = Math.abs(Math.round(Number(n) || 0));
    if (s === 0) return "'ı";
    var yuz = s % 100;
    if (yuz % 10 !== 0) return BIRLER[yuz % 10];
    if (yuz !== 0) return ONLAR[yuz];
    if (s % 1000 !== 0) return "'ü";           /* yüz */
    if (s % 1000000 !== 0) return "'i";        /* bin */
    if (s % 1000000000 !== 0) return "'u";     /* milyon */
    return "'ı";                               /* milyar */
  }

  function sayiEkli(n) { return YU.fmt.sayi(n) + sayiEki(n); }

  /* ------------------------------------------------------------------
     Veri
     ------------------------------------------------------------------ */

  /* Bugün, kaydı olmasa bile listede durur (kullanıcı isteği, 26.08.2026).
     Sebep: gün listesi yalnız KAYITLI günleri gösteriyordu; gece yarısı
     geçtiğinde yeni gün, biri veri girene kadar hiç görünmüyor ve
     tıklanamıyordu — "en son 25.08 var" görüntüsü buradan geliyordu.

     Satır yalnız SÜREN kampanyada eklenir: geçmiş bir kampanyaya bakarken ya
     da kampanya kilitliyken (sezon bitti demektir — kullanıcı kararı,
     25.08.2026) bugünün orada işi yoktur. Hiç kampanya yoksa da eklenmez;
     boş sistemde "ilk günü girin" boş durumu daha yol göstericidir. */
  function bugunuEkle(gunler) {
    if (YU.donem.gecmisMi()) return gunler;

    var liste = YU.donem.liste();
    var sonDonem = liste.length ? liste[liste.length - 1] : null;
    if (!sonDonem) return gunler;

    var bugun = YU.tarih.bugun();
    if (bugun < sonDonem.bas) return gunler;
    if (YU.servis && YU.servis.kampanyaKilitDurumu &&
        YU.servis.kampanyaKilitDurumu(YU.db, sonDonem.ad)) return gunler;

    var i;
    for (i = 0; i < gunler.length; i++) if (gunler[i].tarih === bugun) return gunler;

    /* Liste tarihe göre AZALAN sıralı; bugün en büyük tarih, başa geçer. */
    return [{
      tarih: bugun, kuruKuspeVar: false, malzemeSayisi: 0,
      sonGuncelleme: null, kullanici: null, kullaniciId: null,
      kayitsiz: true
    }].concat(gunler);
  }

  /* Günde düzeltme var mı — DENETİM İZİNDEN okunur: o günün kaydına dokunan
     Guncelle/Sil log satırı ya da o günden arşive düşmüş silinmiş kayıt varsa
     gün "düzeltilmiş" sayılır. GuncellemeTarihi alanına bakılmaz: normal
     günlük giriş akışı bile (çuvallı üretim + satış iki adımda yazılır) o
     alanı doldurur ve her gün yanlışlıkla "Evet" görünürdü. */
  /* ------------------------------------------------------------------
     Satır içi eylemler
     ------------------------------------------------------------------ */

  /* eylemDugmesi kaldırıldı (24.08.2026): eylemler artık metinli
     Detay/Sil düğmeleri. */

  function gunSilmeyiBaslat(tarih, malzemeSayisi, kayitsiz) {
    /* Bugün henüz kayıtsızsa Sil düğmesi diğer satırlardaki gibi durur ama
       silinecek bir şey yoktur (kullanıcı isteği, 26.08.2026): onay penceresi
       açılmaz, D14 reddi de gösterilmez — tek satır bildirim yeter. */
    if (kayitsiz) {
      YU.ui.bildir(YU.fmt.tarih(tarih) + ' tarihinde silinecek kayıt yok.', 'bilgi');
      return;
    }

    YU.ui.onay({
      baslik: YU.fmt.tarih(tarih) + ' gününü sil',
      metin: YU.fmt.tarihUzun(tarih) + ' ' + YU.fmt.gunAdi(tarih) + ' gününe ait kuru küspe kaydı, ' +
        YU.fmt.sayi(malzemeSayisi) + ' malzeme satırı ve o günün tüm silo hareketleri silinir. ' +
        'İşlem geri alınamaz.',
      onayMetni: 'Günü Sil',
      tehlike: true
    }).then(function (onaylandi) {
      if (!onaylandi) return;
      var s = YU.servis.gunSil(YU.db, tarih, YU.oturum.kullanici);
      if (s.ok) {
        YU.ui.bildir(YU.fmt.tarih(tarih) + ' günü silindi.', 'basari');
        YU.yenile();
        return;
      }
      if (YU.ui.kilitYakala(s)) return;   /* kilitli kampanya: pencere + bağlantı */
      silmeReddiModali(tarih, s.hatalar);
    });
  }

  /* D14 reddi: hata metnine ek olarak hangi silonun hangi gün patladığı tablo
     hâlinde verilir ve engelleyen gün için doğrudan silme düğmesi sunulur. */
  function silmeReddiModali(tarih, hatalar) {
    var negatifler = YU.dogrula.ileriBakiye(YU.db, tarih, { tarih: tarih, silTarih: tarih, yeniHareketler: [] });
    var govde = [];
    var m;

    govde.push(YU.h('div', {
      metin: YU.fmt.tarih(tarih) + ' günü silinemedi. Sonraki günlerin silo bakiyesi bu güne dayanıyor; ' +
        'silinirse aşağıdaki silolar negatife düşerdi (D14).'
    }));

    if (negatifler.length) {
      var satirlar = [], i, n;
      for (i = 0; i < negatifler.length; i++) {
        n = negatifler[i];
        satirlar.push([
          n.siloAd,
          YU.fmt.tarih(n.tarih),
          YU.h('span', { stil: { color: 'var(--olumsuz)' }, metin: YU.fmt.kgU(n.bakiye) })
        ]);
      }
      govde.push(YU.ui.tablo({
        kompakt: true,
        sutunlar: [
          { baslik: 'Silo' },
          { baslik: 'Negatife Düştüğü Gün', genislik: 170 },
          { baslik: 'Bakiye', hiza: 'sag', mono: true, genislik: 140 }
        ],
        satirlar: satirlar
      }));
    }

    govde.push(YU.ui.hataListesi(hatalar));

    var dugmeler = [{ metin: 'Kapat', tur: 'sade', onClick: function () { m.kapat(); } }];
    if (negatifler.length) {
      var engelleyen = negatifler[0].tarih;   /* ileriBakiye tarihe göre sıralı döner */
      govde.push(YU.h('div', {
        metin: 'Sıra önemlidir: önce ' + YU.fmt.tarih(engelleyen) + ' günü silinir, ardından ' +
          YU.fmt.tarih(tarih) + ' silinebilir.'
      }));
      dugmeler.push({
        metin: 'Önce ' + YU.fmt.tarih(engelleyen) + ' gününü sil',
        ikon: '#ic-trash', tur: 'tehlike',
        onClick: function () {
          m.kapat();
          var g = gunBilgisi(engelleyen);
          gunSilmeyiBaslat(engelleyen, g ? g.malzemeSayisi : 0);
        }
      });
    }

    m = YU.ui.modal({ baslik: 'Gün Silinemedi (D14)', genislik: 560, govde: govde, dugmeler: dugmeler });
  }

  function gunBilgisi(tarih) {
    var l = YU.stok.kayitliGunler(YU.db, tarih, tarih);
    return l.length ? l[0] : null;
  }

  /* ------------------------------------------------------------------
     Filtre çubuğu — açılır çipler (kullanıcı isteği, 25.08.2026)
     ------------------------------------------------------------------ */

  function filtreVarMi() {
    return !!(durum.bas || durum.bit || durum.kampanya || durum.kisi !== null);
  }

  function filtreleriSifirla() {
    durum.bas = null; durum.bit = null; durum.kampanya = null;
    durum.kisi = null; durum.sayfa = 1;
    listeyiTazele();
  }

  function kampanyaBul(ad) {
    var l = YU.donem.liste(), i;
    for (i = 0; i < l.length; i++) if (l[i].ad === ad) return l[i];
    return null;
  }

  /* kunye yalnız kişi süzgeci açıkken hesaplanır (iki tablo taraması). */
  function gunFiltredenGecer(g, kunye) {
    if (durum.bas && g.tarih < durum.bas) return false;
    if (durum.bit && g.tarih > durum.bit) return false;
    if (durum.kampanya) {
      var k = kampanyaBul(durum.kampanya);
      if (!k || g.tarih < k.bas || g.tarih > k.bit) return false;
    }
    if (durum.kisi !== null) {
      if (!kunye) return false;
      var ilkKim = kunye.ilk ? kunye.ilk.kim : null;
      var sonKim = kunye.son ? kunye.son.kim : null;
      if (ilkKim !== durum.kisi && sonKim !== durum.kisi) return false;
    }
    return true;
  }

  function tarihCipi() {
    var metin;
    if (!durum.bas && !durum.bit) metin = 'Tümü';
    else if (durum.bas && durum.bit && durum.bas === durum.bit) metin = YU.fmt.tarih(durum.bas);
    else metin = (durum.bas ? YU.fmt.tarih(durum.bas) : '…') + ' – ' + (durum.bit ? YU.fmt.tarih(durum.bit) : '…');

    return YU.ui.acilirCip({
      etiket: 'Tarih', metin: metin, ikon: '#ic-calendar',
      baslik: 'Tarih Aralığı', genislik: 330, dolgu: '6px 12px 12px',
      govde: function (kapat) {
        var basA, bitA;
        function uygula(bas, bit) {
          durum.bas = bas; durum.bit = bit; durum.sayfa = 1;
          kapat(); listeyiTazele();
        }
        basA = YU.ui.alan({ etiket: 'Başlangıç', tip: 'tarih', deger: durum.bas || '' });
        bitA = YU.ui.alan({ etiket: 'Bitiş', tip: 'tarih', deger: durum.bit || '' });
        var bugun = YU.tarih.bugun();
        return YU.h('div', null,
          YU.h('div', { stil: { display: 'flex', gap: '10px' } }, basA.kok, bitA.kok),
          YU.h('div', { stil: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' } },
            YU.ui.dugme({ metin: 'Uygula', tur: 'birincil', kucuk: true,
              onClick: function () { uygula(basA.deger() || null, bitA.deger() || null); } }),
            YU.h('span', { stil: { flex: '1' } }),
            YU.ui.dugme({ metin: 'Bugün', tur: 'ikincil', kucuk: true,
              onClick: function () { uygula(bugun, bugun); } }),
            YU.ui.dugme({ metin: 'Son 7 Gün', tur: 'ikincil', kucuk: true,
              onClick: function () { uygula(YU.tarih.ekle(bugun, -6), bugun); } }),
            YU.ui.dugme({ metin: 'Son 30 Gün', tur: 'ikincil', kucuk: true,
              onClick: function () { uygula(YU.tarih.ekle(bugun, -29), bugun); } }),
            YU.ui.dugme({ metin: 'Tümü', tur: 'ikincil', kucuk: true,
              onClick: function () { uygula(null, null); } })
          )
        );
      }
    });
  }

  function kampanyaCipi() {
    return YU.ui.acilirCip({
      etiket: 'Kampanya', metin: durum.kampanya || 'Tümü', ikon: '#ic-wallet',
      baslik: 'Kampanya Dönemi', genislik: 300,
      govde: function (kapat) {
        var kap = YU.h('div');
        function sec(ad) { durum.kampanya = ad; durum.sayfa = 1; kapat(); listeyiTazele(); }
        kap.appendChild(YU.ui.acilirSatir({
          metin: 'Tümü', secili: !durum.kampanya,
          onClick: function () { sec(null); }
        }));
        var l = YU.donem.liste(), i;
        for (i = l.length - 1; i >= 0; i--) {
          (function (d) {
            kap.appendChild(YU.ui.acilirSatir({
              metin: 'Kampanya ' + d.ad,
              sag: YU.fmt.tarih(d.bas) + ' – ' + YU.fmt.tarih(d.bit),
              secili: durum.kampanya === d.ad,
              onClick: function () { sec(d.ad); }
            }));
          })(l[i]);
        }
        return kap;
      }
    });
  }

  function kisiCipi() {
    return YU.ui.acilirCip({
      etiket: 'Kaydeden', metin: durum.kisi !== null ? (kisiAdi(durum.kisi) || 'Tümü') : 'Tümü',
      ikon: '#ic-users', baslik: 'Kaydeden Kişi', genislik: 280,
      govde: function (kapat) {
        var kap = YU.h('div');
        function sec(id) { durum.kisi = id; durum.sayfa = 1; kapat(); listeyiTazele(); }
        kap.appendChild(YU.ui.acilirSatir({
          metin: 'Tümü', secili: durum.kisi === null,
          onClick: function () { sec(null); }
        }));
        var l = YU.db.kullanicilar, i;
        for (i = 0; i < l.length; i++) {
          (function (k) {
            kap.appendChild(YU.ui.acilirSatir({
              metin: k.AdSoyad,
              sag: k.Rol === 'Yonetici' ? 'Yönetici' : 'Operatör',
              secili: durum.kisi === k.Id,
              onClick: function () { sec(k.Id); }
            }));
          })(l[i]);
        }
        return kap;
      }
    });
  }

  /* 'Durum' (Kuru Küspe girilmiş/girilmemiş) süzgeci kaldırıldı — kullanıcı
     isteği, 25.08.2026. Çip, ad tablosu ve süzme koşulları birlikte silindi. */

  function filtreSeridi() {
    return YU.h('div', {
      sinif: 'yu-arac',
      stil: { padding: '12px 18px', borderBottom: '1px solid var(--ayrac)', flexWrap: 'wrap' }
    },
      tarihCipi(),
      kampanyaCipi(),
      kisiCipi(),
      YU.h('span', { stil: { flex: '1' } }),
      filtreVarMi() ? YU.ui.dugme({
        metin: 'Filtreleri Sıfırla', ikon: '#ic-x', tur: 'sade', kucuk: true,
        onClick: filtreleriSifirla
      }) : null
    );
  }

  /* Eksik gün şeridi ("Kayıtlar arasında N gün kayıtsız…") kaldırıldı
     (kullanıcı isteği, 27.08.2026) — liste yalnız kayıtlı günleri gösterir. */

  /* ------------------------------------------------------------------
     Tablo ve sayfalama
     ------------------------------------------------------------------ */

  function kisiAdi(id) {
    if (id === null || id === undefined) return null;
    var k = YU.db.kullanicilar, i;
    for (i = 0; i < k.length; i++) if (k[i].Id === id) return k[i].AdSoyad;
    return 'Kullanıcı #' + id;
  }

  /* Günün İLK ve SON veri girişi (kullanıcı isteği, 24.08.2026): o günün kuru
     küspe ve malzeme kayıtları taranır; ilk = en erken oluşturma, son = en geç
     dokunuş (güncelleme dahil), kişileriyle birlikte. */
  /* GEÇMİŞE DOKUNUŞ HARİTASI (kullanıcı direktifi, 28.08.2026: "bugün
     önceki güne değişiklik yaparsam hem bugünün satırında hem değiştirilen
     günde yazılsın"). Değiştirilen günün damgası zaten güncelleniyor
     (gunKunyesi); bu harita ise dokunuşun YAPILDIĞI günden DEĞİŞTİRİLEN
     güne bakar: yapildigiGun -> {hedefGun: 1}. Yalnız gün-bağlı üç tablo
     sayılır; devir/kullanıcı/malzeme yönetimi güne bağlanamaz (KURAL 7).
     Hedef gün önce yaşayan kayıttan okunur; kayıt silinmişse (gün silme,
     düzeltmede silinen hareket) log metnindeki GG.AA.YYYY yakalanır.
     Liste her çizimde bir kez kurulur — satır başına log taraması yok. */
  var dokunusHaritasi = {};
  var GUN_BAGLI_TABLO = { KuruKuspeGunluk: 1, SiloHareket: 1, GunlukHareket: 1 };

  function gecmiseDokunusHaritasi(db) {
    var h = {}, i, l, hedef, kayit, m;
    for (i = 0; i < db.degisiklikLog.length; i++) {
      l = db.degisiklikLog[i];
      if (!GUN_BAGLI_TABLO[l.Tablo]) continue;
      var yapildigi = String(l.Tarih || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(yapildigi)) continue;
      hedef = null;
      kayit = YU.log && YU.log.kayitBul ? YU.log.kayitBul(db, l.Tablo, l.KayitId) : null;
      if (kayit && kayit.Tarih) hedef = String(kayit.Tarih).slice(0, 10);
      if (!hedef) {
        m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(l.EskiDeger || '')) ||
            /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(l.YeniDeger || ''));
        if (m) hedef = m[3] + '-' + m[2] + '-' + m[1];
      }
      if (!hedef || hedef === yapildigi) continue;
      (h[yapildigi] || (h[yapildigi] = {}))[hedef] = 1;
    }
    return h;
  }

  function gunKunyesi(tarih) {
    var db = YU.db, ilk = null, son = null, i;

    function isle(k) {
      var o = k.OlusturmaTarihi, oid = k.OlusturanKullaniciId;
      if (o && (!ilk || o < ilk.an)) ilk = { an: o, kim: oid };
      var g = k.GuncellemeTarihi || o;
      var gid = k.GuncellemeTarihi ? k.GuncelleyenKullaniciId : oid;
      if (g && (!son || g > son.an)) son = { an: g, kim: gid };
    }

    for (i = 0; i < db.kuruKuspeGunluk.length; i++) {
      if (db.kuruKuspeGunluk[i].Tarih === tarih) isle(db.kuruKuspeGunluk[i]);
    }
    for (i = 0; i < db.gunlukHareket.length; i++) {
      if (db.gunlukHareket[i].Tarih === tarih) isle(db.gunlukHareket[i]);
    }

    /* DEVİR DOKUNUŞU DA VERİ GİRİŞİDİR (kullanıcı bildirimi, 27.08.2026):
       yalnız devir girilip düzeltilmiş günde iki kolon da "—" kalıyordu.
       Devir satırı, değişikliğin YAPILDIĞI güne düşer; kural Program
       Hareketleri paneliyle ortaktır (32-tum-hareketler · YU.gunDevirLoglari)
       — iki ekran aynı günü aynı saymalı. */
    var dl = typeof YU.gunDevirLoglari === 'function' ? YU.gunDevirLoglari(db, tarih) : [];
    for (i = 0; i < dl.length; i++) {
      isle({ OlusturmaTarihi: dl[i].Tarih, OlusturanKullaniciId: dl[i].KullaniciId });
    }
    return { ilk: ilk, son: son };
  }

  function kunyeHucresi(k) {
    if (!k || !k.an) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    return YU.h('div', null,
      YU.h('div', { metin: YU.fmt.tarihSaat(k.an) }),
      YU.h('div', { sinif: 'yu-yardim', metin: kisiAdi(k.kim) || 'kullanıcı bilinmiyor' })
    );
  }

  /* Satır sade (kullanıcı kararı, 24.08.2026): tarih, ilk/son kaydeden
     ve işlemler — "Değiştirildi Mi" kolonu kaldırıldı (24.08.2026). Rakam dökümü Detay'dadır (Program
     Hareketleri) — kolon kalabalığı bilerek yok. */
  function tabloSatiri(kayit) {
    var g = kayit.gun;

    /* Yalnız Detay + Sil (kullanıcı isteği, 24.08.2026): Düzelt ikonu
       kalktı; Sil de Detay gibi metinli düğme — kırmızı ve EN SAĞDA.
       Bugün kayıtsız olsa da satır aynı görünür: Detay + Sil (kullanıcı
       isteği, 26.08.2026). Kayıtsız günde Sil'e basılırsa tek satır bildirim
       çıkar — bkz. gunSilmeyiBaslat. */
    var eylemler = YU.h('div', { stil: { display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' } },
      YU.ui.dugme({
        metin: 'Detay', ikon: '#ic-doc', tur: 'ikincil',
        baslik: 'Program Hareketleri · ' + YU.fmt.tarih(g.tarih),
        onClick: function () { YU.git('gunluk-rapor', { tarih: g.tarih }); }
      }),
      YU.ui.dugme({
        metin: 'Sil', ikon: '#ic-trash', tur: 'tehlike',
        baslik: 'Bu günün tüm girişlerini sil',
        onClick: function () { gunSilmeyiBaslat(g.tarih, g.malzemeSayisi, g.kayitsiz); }
      })
    );

    /* "Bugün Giriş Yok" yalnız GERÇEKTEN dokunulmamış günde yazar: devir
       girilmiş bir güne "giriş yok" demek yanlıştı — Detay'a basınca devir
       satırları çıkıyordu (kullanıcı bildirimi, 27.08.2026). Sil düğmesi
       yine g.kayitsiz'e bakar: silme hareket kayıtlarını siler, devri değil. */
    var devirDokunusu = typeof YU.gunDevirLogSayisi === 'function'
      ? YU.gunDevirLogSayisi(YU.db, g.tarih) : 0;
    var girisYok = g.kayitsiz && !devirDokunusu;
    var kunye = girisYok ? { ilk: null, son: null } : gunKunyesi(g.tarih);
    var tarihHucresi = girisYok
      ? YU.h('div', null,
          YU.h('div', { sinif: 'yu-guclu', metin: YU.fmt.tarih(g.tarih) }),
          YU.h('div', { sinif: 'yu-yardim', metin: 'Bugün Giriş Yok' }))
      : YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.tarih(g.tarih) });

    /* O tarihte BAŞKA günlere dokunulduysa tarih hücresinin altına yazılır
       (kullanıcı direktifi, 28.08.2026). Tarihler bağlantıdır: sol tık aynı
       sekmede Program Hareketleri'ni açar (ayrıntının yeri — KURAL 7),
       Ctrl+tık yeni sekmede. */
    var hedefler = dokunusHaritasi[g.tarih]
      ? Object.keys(dokunusHaritasi[g.tarih]).sort().reverse() : [];
    if (hedefler.length) {
      var dokunusSatiri = YU.h('div', { sinif: 'yu-yardim', stil: { margin: '3px 0 0' } },
        YU.h('span', { metin: 'Geçmişe dokunuş: ' }));
      for (var hd = 0; hd < hedefler.length; hd++) {
        if (hd) dokunusSatiri.appendChild(YU.h('span', { metin: ' · ' }));
        (function (hedefTarih) {
          dokunusSatiri.appendChild(YU.h('a', {
            href: YU.adres('gunluk-rapor', { tarih: hedefTarih }),
            metin: YU.fmt.tarih(hedefTarih),
            baslik: 'Program Hareketleri · ' + YU.fmt.tarih(hedefTarih),
            stil: { color: 'var(--vurgu)', textDecoration: 'underline', textUnderlineOffset: '2px' },
            onClick: function (e) {
              if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) return;
              e.preventDefault();
              YU.git('gunluk-rapor', { tarih: hedefTarih });
            }
          }));
        })(hedefler[hd]);
      }
      tarihHucresi = YU.h('div', null, tarihHucresi, dokunusSatiri);
    }

    return [
      tarihHucresi,
      kunyeHucresi(kunye.ilk),
      kunyeHucresi(kunye.son),
      eylemler
    ];
  }

  /* Uzun listede tüm numaralar basılmaz: baş, son ve aktif sayfanın çevresi. */
  function sayfaNumaralari(aktif, toplam) {
    if (toplam <= SAYFA_PENCERE) {
      var hepsi = [];
      for (var i = 1; i <= toplam; i++) hepsi.push(i);
      return hepsi;
    }
    var kume = { 1: 1 }, j;
    kume[toplam] = 1;
    for (j = aktif - 1; j <= aktif + 1; j++) if (j >= 1 && j <= toplam) kume[j] = 1;
    var liste = [];
    for (var k in kume) if (Object.prototype.hasOwnProperty.call(kume, k)) liste.push(Number(k));
    liste.sort(function (a, b) { return a - b; });
    var cikti = [];
    for (j = 0; j < liste.length; j++) {
      if (j > 0 && liste[j] - liste[j - 1] > 1) cikti.push(null);   /* … */
      cikti.push(liste[j]);
    }
    return cikti;
  }

  /* Sayfalama Silo Durumu'ndaki dille (kullanıcı isteği, 24.08.2026):
     numaralar ORTADA ve bir boy büyük, iki yanda Önceki/Sonraki düğmeleri;
     bilgi metni solda kalır. */
  function sayfalamaSeridi(toplam, gosterilen, sayfaSayisi) {
    var numaraKap = YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }
    });

    numaraKap.appendChild(YU.ui.dugme({
      metin: 'Önceki', tur: 'ikincil', kucuk: true, pasif: durum.sayfa <= 1,
      onClick: function () { durum.sayfa--; listeyiTazele(); }
    }));

    var numaralar = sayfaNumaralari(durum.sayfa, sayfaSayisi), i;
    for (i = 0; i < numaralar.length; i++) {
      if (numaralar[i] === null) {
        numaraKap.appendChild(YU.h('span', { metin: '…', sinif: 'yu-yardim', stil: { padding: '4px 2px' } }));
        continue;
      }
      (function (no) {
        var aktifMi = no === durum.sayfa;
        var stil = {
          padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
          font: '400 14px/1.4 var(--font)', color: 'var(--metin-5)',
          border: '1px solid transparent'
        };
        if (aktifMi) {
          stil.border = '1px solid var(--kenar-2)';
          stil.color = 'var(--metin)';
        }
        numaraKap.appendChild(YU.h('span', {
          metin: YU.fmt.sayi(no), stil: stil, role: 'button', tabindex: '0',
          title: YU.fmt.sayi(no) + '. sayfa',
          onClick: function () { durum.sayfa = no; listeyiTazele(); },
          onKeyDown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); durum.sayfa = no; listeyiTazele(); }
          }
        }));
      })(numaralar[i]);
    }

    numaraKap.appendChild(YU.ui.dugme({
      metin: 'Sonraki', tur: 'ikincil', kucuk: true, pasif: durum.sayfa >= sayfaSayisi,
      onClick: function () { durum.sayfa++; listeyiTazele(); }
    }));

    /* Bilgi solda, numaralar tam ortada: iki yanına eşit esneyen boşluk. */
    return YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 18px', borderTop: '1px solid var(--ayrac)'
      }
    },
      YU.h('span', {
        sinif: 'yu-yardim',
        stil: { flex: '1', minWidth: '0' },
        metin: YU.fmt.sayi(toplam) + ' kayıttan ' + sayiEkli(gosterilen) + ' gösteriliyor'
      }),
      numaraKap,
      YU.h('span', { stil: { flex: '1', minWidth: '0' } })
    );
  }

  /* ------------------------------------------------------------------
     Liste
     ------------------------------------------------------------------ */

  function listeyiTazele() { if (dom.liste) listeyiCiz(dom.liste); }

  function listeyiCiz(kap) {
    YU.bos(kap);

    var gunler = YU.stok.kayitliGunler(YU.db, null, null);
    gunler = bugunuEkle(gunler);
    dokunusHaritasi = gecmiseDokunusHaritasi(YU.db);

    var liste = [], j, kunye;
    for (j = 0; j < gunler.length; j++) {
      /* Kişi süzgeci açıkken künye burada hesaplanır (iki tablo taraması);
         diğer süzgeçler gün satırındaki alanlardan bakar. */
      kunye = durum.kisi !== null ? gunKunyesi(gunler[j].tarih) : null;
      if (!gunFiltredenGecer(gunler[j], kunye)) continue;
      liste.push({ gun: gunler[j] });
    }

    if (!liste.length) {
      var filtreli = filtreVarMi();
      if (filtreli) kap.appendChild(filtreSeridi());
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-calendar',
        baslik: filtreli ? 'Filtrelere Uyan Gün Yok' : 'Kayıtlı gün yok',
        metin: filtreli
          ? 'Seçili süzgeçlerle eşleşen kayıtlı gün bulunamadı.'
          : 'Henüz hiçbir güne giriş yapılmamış. İlk günü Kuru Küspe Günlük Giriş ekranından girin.',
        eylemler: filtreli ? [
          YU.ui.dugme({
            metin: 'Filtreleri Sıfırla', ikon: '#ic-x', tur: 'ikincil',
            onClick: filtreleriSifirla
          })
        ] : []
      }));
      return;
    }

    var sayfaSayisi = Math.max(1, Math.ceil(liste.length / SAYFA_BOYU));
    if (durum.sayfa > sayfaSayisi) durum.sayfa = sayfaSayisi;
    if (durum.sayfa < 1) durum.sayfa = 1;
    var bas = (durum.sayfa - 1) * SAYFA_BOYU;
    var dilim = liste.slice(bas, bas + SAYFA_BOYU);

    var satirlar = [], i;
    for (i = 0; i < dilim.length; i++) satirlar.push(tabloSatiri(dilim[i]));

    /* Sade kolon seti (kullanıcı kararı, 24.08.2026): tarih + son kaydeden +
       düzeltilme durumu + işlemler. Rakamlar Detay'da. */
    var tablo = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Tarih', genislik: 120 },
        { baslik: 'İlk Veri Girişi', genislik: 190 },
        { baslik: 'Son Veri Girişi', genislik: 190 },
        { baslik: 'İşlem', hiza: 'sag' }
      ],
      satirlar: satirlar,
      bos: 'Kayıtlı gün yok.',
      yapiskan: true
    });

    /* Satıra tıklayınca Detay açılır (kullanıcı kararı, 24.08.2026);
       işlem düğmelerine basınca satır tıklaması devreye girmez. */
    var trler = tablo.querySelectorAll('tbody tr'), t2;
    for (j = 0; j < dilim.length && j < trler.length; j++) {
      (function (tarih, tr) {
        tr.style.cursor = 'pointer';
        tr.title = 'Detay · Program Hareketleri · ' + YU.fmt.tarih(tarih);
        tr.addEventListener('click', function (e) {
          if (e.target.closest && (e.target.closest('button') || e.target.closest('.yu-satir-eylem'))) return;
          YU.git('gunluk-rapor', { tarih: tarih });
        });
      })(dilim[j].gun.tarih, trler[j]);
    }

    /* Başlık satırı: ad + gün sayacı. Tek günlük tarih kutusu kaldırıldı
       (25.08.2026) — tek gün, filtre çubuğundaki Tarih çipiyle (bas=bit)
       seçilir; süzgeçler başlığın altındaki çubukta durur. */
    kap.appendChild(YU.h('div', {
      sinif: 'yu-panel-bas',
      stil: { padding: '15px 18px', marginBottom: '0', borderBottom: '1px solid var(--ayrac)', gap: '12px' }
    },
      YU.h('span', { stil: { display: 'flex', color: 'var(--vurgu)' } }, YU.svg('#ic-calendar', 18)),
      /* Panel başlığı "Kayıtlı Günler" -> "Geçmiş Girişler" (kullanıcı
         isteği, 25.08.2026): üstteki sayfa başlığıyla aynı şeyi iki kez
         yazıyordu; sayfa başlığı kalktı, ad panele taşındı. */
      YU.h('div', { sinif: 'yu-panel-baslik', metin: 'Geçmiş İşlemler', stil: { flex: '0 0 auto' } }),
      YU.h('span', { stil: { flex: '1' } }),
      YU.h('div', { sinif: 'yu-panel-sag' }, YU.h('span', { metin: YU.fmt.sayi(liste.length) + ' gün' }))
    ));
    kap.appendChild(filtreSeridi());
    kap.appendChild(tablo);
    kap.appendChild(sayfalamaSeridi(liste.length, dilim.length, sayfaSayisi));
  }

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  YU.sayfaTanimla({
    kod: 'gecmis-girisler',
    zemin: 'gri-duz',   /* Stok Durumu ile aynı panel rengi (kullanıcı isteği, 24.08.2026) */
    baslik: 'Geçmiş İşlemler',        /* menü adı ve sekme başlığı için durur */
    /* Alt başlık KALDIRILDI (kullanıcı isteği, 25.08.2026): süzgeçler ve
       satır tıklaması ekranda zaten görünüyor, cümle fazladan gürültüydü.
       baslikGizle: sayfa başlığı da çizilmez — ad artık panelin kendi
       başlığında; panel en üste oturur (kullanıcı isteği, 25.08.2026). */
    baslikGizle: true,
    ikon: '#ic-calendar',
    grup: 'Takip',
    rol: 'Hepsi',
    ciz: function (kap) {
      /* Kuru Küspe Girişi düğmesi kaldırıldı (kullanıcı isteği, 24.08.2026). */
      YU.ui.sayfaEylemleri();

      var listeKap = YU.h('div');
      dom.liste = listeKap;
      var panel = YU.ui.panel({ dolgusuz: true, govde: [listeKap] });
      panel.querySelector('.yu-panel-govde').style.gap = '0';
      kap.appendChild(panel);
      listeyiCiz(listeKap);
    }
  });
})();

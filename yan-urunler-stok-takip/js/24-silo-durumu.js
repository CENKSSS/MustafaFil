/* js/24-silo-durumu.js — Silo Durumu ekranı.
   Şartname §7: "Silo bazında devir / giren / çıkan / mevcut, kapasiteye göre
   doluluk [v2], negatife düşen gün uyarısı [v2]."
   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu).
   SÖZLEŞME §6 (UI imzaları), §9 (sınıf adları).

   Dosya yüklenirken hiçbir şey çizmez; yalnızca YU.sayfaTanimla çağırır. */
(function () {
  'use strict';

  var YU = window.YU;

  var SAYFA_GUN = 7;            /* sayfa başına kayıtlı gün sayısı (kullanıcı isteği, 24.08.2026: en fazla 7) */


  /* ------------------------------------------------------------------
     Küçük yardımcılar
     ------------------------------------------------------------------ */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  function tarihSec(param) {
    /* Varsayılan tarih HEP BUGÜN (kullanıcı isteği, 24.08.2026 — kampanya
       bakışı bu ekranda uygulanmaz); adresle gelen ?tarih= korunur. */
    return param && gecerliTarih(param.tarih) ? param.tarih : YU.tarih.bugun();
  }

  function kendinin(nesne, anahtar) {
    return Object.prototype.hasOwnProperty.call(nesne, anahtar);
  }

  function raporBagi(tarih) {
    return '#/gunluk-rapor?tarih=' + encodeURIComponent(tarih);
  }

  var SAYFA_PENCERE = 7;   /* çubukta doğrudan basılan en fazla numara */

  /* Uzun listede tüm numaralar basılmaz: baş, son ve aktif sayfanın çevresi;
     arada kalan boşluk null ile işaretlenir ve "…" olarak çizilir.
     (Geçmiş Girişler ekranındaki sayfalama diliyle birebir aynı.) */
  function sayfaNumaralari(aktif, toplam) {
    var i, j;
    if (toplam <= SAYFA_PENCERE) {
      var hepsi = [];
      for (i = 1; i <= toplam; i++) hepsi.push(i);
      return hepsi;
    }
    var kume = { 1: 1 };
    kume[toplam] = 1;
    for (j = aktif - 1; j <= aktif + 1; j++) if (j >= 1 && j <= toplam) kume[j] = 1;
    var liste = [], k;
    for (k in kume) if (Object.prototype.hasOwnProperty.call(kume, k)) liste.push(Number(k));
    liste.sort(function (a, b) { return a - b; });
    var cikti = [];
    for (j = 0; j < liste.length; j++) {
      if (j > 0 && liste[j] - liste[j - 1] > 1) cikti.push(null);
      cikti.push(liste[j]);
    }
    return cikti;
  }

  /* Tarih sütunu yakın günleri sözle yazar (kullanıcı isteği, 24.08.2026):
     bugün "Bugün", dün "Dün", öncesi normal tarih. İki günden eskisi için
     sözel ifade ("3 gün önce") kullanılmaz — orada gerçek tarih daha okunur. */
  function tarihMetni(iso) {
    var fark = YU.tarih.fark(String(iso || '').slice(0, 10), YU.tarih.bugun());
    if (fark === 0) return 'Bugün';
    if (fark === 1) return 'Dün';
    return YU.fmt.tarih(iso);
  }

  /* D15 eşikleri: kapasitenin üstü kırmızı, %90 üstü kehribar (Şartname §8 D15). */
  function dolulukTur(oran) {
    if (oran > 1) return 'olumsuz';
    if (oran > 0.9) return 'bekleyen';
    return 'vurgu';
  }

  /* Yüzde rozette zaten yazıyor; çubuğun altı kalan kapasiteyi söyler. */
  function dolulukNotu(mevcut, kapasite, oran) {
    if (kapasite <= 0) return 'Kapasite tanımlı değil';
    if (oran > 1) return 'Kapasite ' + YU.fmt.kgU(YU.yuvarla(mevcut - kapasite)) + ' aşıldı';
    var kalan = YU.fmt.kgU(YU.yuvarla(kapasite - mevcut));
    return oran > 0.9 ? 'Kalan kapasite ' + kalan + ' · D15 eşiğine yaklaşıldı' : 'Kalan kapasite ' + kalan;
  }

  function satir(etiket, deger) {
    return YU.h('div', { stil: { display: 'flex', alignItems: 'baseline', gap: '10px' } },
      YU.h('span', { sinif: 'yu-etiket', metin: etiket, stil: { flex: '1', minWidth: '0' } }),
      YU.h('span', { sinif: 'yu-mono', metin: deger })
    );
  }

  function hesapOge(etiket, deger, tur) {
    return YU.h('div', { sinif: 'yu-hesap-oge' + (tur ? ' ' + tur : '') },
      YU.h('div', { sinif: 'yu-hesap-etiket', metin: etiket }),
      YU.h('div', { sinif: 'yu-hesap-deger', metin: deger })
    );
  }

  /* ------------------------------------------------------------------
     Negatif gün uyarısı (Şartname §7 v2 · D14 motoru)
     ------------------------------------------------------------------ */

  function negatifSerit(negatifler) {
    var serit = YU.ui.serit({
      tur: 'hata',
      baslik: negatifler.length === 1
        ? 'Bir silo bakiyesi geçmişte negatife düşüyor'
        : negatifler.length + ' silo bakiyesi geçmişte negatife düşüyor',
      metin: 'Geriye dönük bir düzeltme sonraki günleri bozmuş olabilir. ' +
        'Satıra tıklayınca o günün Program Hareketleri ekranı açılır.'
    });
    var govde = serit.querySelector('.yu-serit-govde');
    var liste = YU.h('ul');
    var i, n;
    for (i = 0; i < negatifler.length; i++) {
      n = negatifler[i];
      liste.appendChild(YU.h('li', null,
        YU.h('a', {
          sinif: 'yu-mono',
          href: raporBagi(n.tarih),
          metin: (n.siloAd || ('Silo #' + n.siloId)) + ' · ' + YU.fmt.tarih(n.tarih) + ' · ' + YU.fmt.kg(n.bakiye)
        })
      ));
    }
    govde.appendChild(liste);
    return serit;
  }

  /* ------------------------------------------------------------------
     Silo kartları
     ------------------------------------------------------------------ */

  function siloKarti(depo, satirVeri, tarih) {
    var silo = satirVeri.silo;
    var kapasite = satirVeri.kapasite;
    var oran = kapasite > 0 ? satirVeri.mevcut / kapasite : 0;
    var tur = dolulukTur(oran);
    var devir = YU.stok.enSonDevir(depo, 'Silo', silo.Id, tarih);

    /* Yüzde artık silo görselinin ortasında yazıyor (YU.ui.siloSekli);
       başlıkta ayrıca rozet gösterilmez. */
    var bas = YU.h('div', { sinif: 'yu-panel-bas' },
      YU.h('div', { sinif: 'yu-kpi-ikon' }, YU.svg('#ic-building', 15)),
      YU.h('div', { sinif: 'yu-panel-baslik', metin: silo.Ad }),
      silo.Aktif === false ? YU.ui.rozet('Pasif', 'notr') : null
    );

    var bilgi = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px', flex: '1', minWidth: '0' } },
      /* Ton karşılığı satırı kaldırıldı; yalnız kg yazılır (kullanıcı
         isteği, 21.08.2026). */
      YU.h('div', null,
        YU.h('div', { sinif: 'yu-kpi-deger', metin: YU.fmt.kgU(satirVeri.mevcut) })
      ),
      YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '7px' } },
        YU.ui.cubuk(oran, tur),
        YU.h('div', { sinif: 'yu-kpi-alt', metin: dolulukNotu(satirVeri.mevcut, kapasite, oran) })
      ),
      /* "Kapasite … kg · … ton" satırı kaldırıldı (kullanıcı isteği,
         21.08.2026); kapasiteyi "Kalan kapasite" notu anlatmaya devam eder. */
      YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }),
      YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        satir(devir ? 'Devir · ' + YU.fmt.tarih(devir.DevirTarihi) : 'Devir', YU.fmt.kgU(satirVeri.devir)),
        satir('Giren', YU.fmt.kgU(satirVeri.giren)),
        satir('Çıkan', YU.fmt.kgU(satirVeri.cikan))
      )
    );

    /* Ana Sayfa kartıyla aynı düzen: solda doluluk görseli, sağda bilgiler. */
    var govde = YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '16px' } },
      YU.ui.siloSekli(oran, kapasite > 0 ? tur : 'notr'),
      bilgi
    );

    return YU.h('div', { sinif: 'yu-panel' }, bas, govde);
  }

  /* toplamSeridi ("Toplam mevcut · dökme / Toplam kapasite / Doluluk / Ton
     karşılığı") KALDIRILDI (kullanıcı isteği, 25.08.2026): aynı rakamlar
     Silo Bazında Stok tablosunun TOPLAM satırında duruyor. */

  /* Silo Hareketleri'ndeki Giren/Çıkan hücresi (kullanıcı isteği, 25.08.2026):
     giren YEŞİL "+500", çıkan KIRMIZI "−100" — yön göz ucuyla ayrılsın.
     Birim yazılmaz ("günlük rapor gibi", 25.08.2026): "kg" eklenince hücre
     iki satıra bölünüyordu; Günlük Rapor'daki silo tablosu da yalın rakam
     kullanır, iki ekran aynı dili konuşur. Miktar yoksa soluk tire. */
  function yonHucresi(miktar, girenMi) {
    var n = Number(miktar) || 0;
    if (n <= 0) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    return YU.h('span', {
      sinif: 'yu-guclu',
      stil: {
        color: girenMi ? 'var(--olumlu)' : 'var(--olumsuz)',
        whiteSpace: 'nowrap'
      },
      metin: (girenMi ? '+' : '−') + YU.fmt.kg(n)
    });
  }

  /* ------------------------------------------------------------------
     Hareket tablosu — bakiye kümülatif hesaplanır
     ------------------------------------------------------------------ */

  /* Şeridin altındaki çuvallı stok açıklama notu kaldırıldı (kullanıcı
     isteği, 24.08.2026); "· dökme" eki toplamın neyi saydığını söylemeye
     devam ediyor. */

  /* hareketleriHazirla KALDIRILDI (25.08.2026): satır satır kümülatif
     bakiye yürüten bu fonksiyon, her silo hareketini ayrı satır gösteren
     eski tabloya aitti. Panel artık silo bazında TEK satır kuruyor ve gün
     başı/gün sonu değerlerini YU.stok'tan okuyor. */

  function siloAdi(depo, id) {
    for (var i = 0; i < depo.silolar.length; i++) if (depo.silolar[i].Id === id) return depo.silolar[i].Ad;
    return 'Silo #' + id;
  }


  /* Silo Hareketleri paneli — SATIR = SİLO (kullanıcı isteği, 25.08.2026).

     Önce her silo hareketi ayrı satırdı; aynı silo bir günde üç dört satır
     açıyordu (DokmeUretim + Cuvallama + DokmeSatis). Artık Stok Hareketleri
     ekranındaki düzenin aynısı: gün seçilir, her silo TEK satırda görünür,
     o günün giren/çıkan toplamı aynı satırda okunur.

     Kolon karşılıkları — Stok Hareketleri:  malzeme · üretim · satış · stok
                          Silo Hareketleri:  silo    · giren  · çıkan · gün sonu

     Hareketi olmayan silo da listelenir ("—" ile): bu bir stok tablosudur,
     yalnız hareket listesi değil — gün sonu bakiyesi her silo için yazar. */

  var HAREKET_TIP_ADI = {
    DokmeUretim: 'Dökme Üretim',
    Cuvallama: 'Çuvallama',
    DokmeSatis: 'Dökme Satış',
    Manuel: 'Sayım Düzeltmesi'
  };

  /* "Kim eklemiş" hücresi (kullanıcı isteği, 25.08.2026). Satır bir silonun
     GÜNLÜK toplamı olduğu için tek bir kayıt yok: son dokunan kişi ve saati
     yazılır; o gün o siloya birden çok kişi dokunduysa yanına "+N kişi"
     eklenir ve ipucunda hepsi listelenir. */
  function siloKullaniciAdi(depo, id) {
    if (id === null || id === undefined) return null;
    for (var i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].Id === id) return depo.kullanicilar[i].AdSoyad;
    }
    return 'Kullanıcı #' + id;
  }

  function kaydedenHucresi(depo, g, gun) {
    if (!g || !g.adet || !g.sonAn) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    var ad = siloKullaniciAdi(depo, g.sonId) || '—';
    var metin = ad + ' · ' + YU.fmt.saat(g.sonAn);
    var digerSayisi = (g.kisiler || []).length - 1;
    if (digerSayisi > 0) metin += ' +' + YU.fmt.sayi(digerSayisi) + ' kişi';
    var hepsi = (g.kisiler || []).map(function (id) { return siloKullaniciAdi(depo, id) || '—'; });
    /* Dokunuş başka bir günde olduysa (geriye dönük düzeltme) tarih de yazılır. */
    var dokunusGunu = String(g.sonAn).slice(0, 10);
    if (dokunusGunu && gun && dokunusGunu !== gun) metin += ' · ' + YU.fmt.tarih(dokunusGunu);
    return YU.h('span', {
      sinif: 'yu-zayif',
      metin: metin,
      stil: { whiteSpace: 'nowrap' },
      title: 'Son dokunan: ' + ad + ' · ' + YU.fmt.tarihSaat(g.sonAn) +
        (hepsi.length > 1 ? '\nBu gün bu siloya dokunanlar: ' + hepsi.join(', ') : '')
    });
  }

  function hareketPaneli(depo, silolar, tarih) {
    var gunAlani;
    var sayacMetni = YU.h('span');
    var tabloKabi = YU.h('div');

    function seciliGun() { return gunAlani.deger() || YU.tarih.bugun(); }

    function tabloyuCiz() {
      var gun = seciliGun();

      /* Günün hareketleri silo başına toplanır; tipler de biriktirilir ki
         satır "bu silo o gün ne yaşadı" sorusunu tek bakışta yanıtlasın. */
      var toplam = {}, i, h, o;
      for (i = 0; i < depo.siloHareket.length; i++) {
        h = depo.siloHareket[i];
        if (h.Tarih !== gun) continue;
        o = toplam[h.SiloId] || (toplam[h.SiloId] = { giren: 0, cikan: 0, adet: 0, tipler: [], kisiler: [], sonAn: null, sonId: null });
        o.giren = YU.yuvarla(o.giren + (Number(h.GirenKg) || 0));
        o.cikan = YU.yuvarla(o.cikan + (Number(h.CikanKg) || 0));
        o.adet++;
        if (o.tipler.indexOf(h.HareketTipi) < 0) o.tipler.push(h.HareketTipi);
        /* "Kim eklemiş" (kullanıcı isteği, 25.08.2026): satır o silonun
           GÜNLÜK toplamı olduğu için tek bir kayıt yok — son dokunan kişi
           gösterilir, birden çok kişi dokunduysa ipucunda hepsi yazar. */
        var kAn = h.GuncellemeTarihi && h.GuncellemeTarihi !== h.OlusturmaTarihi
          ? h.GuncellemeTarihi : h.OlusturmaTarihi;
        var kId = h.OlusturanKullaniciId;
        if (kAn && (!o.sonAn || kAn > o.sonAn)) { o.sonAn = kAn; o.sonId = kId; }
        if (o.kisiler.indexOf(kId) < 0) o.kisiler.push(kId);
      }

      var satirlar = [], hareketliSilo = 0, hareketSayisi = 0;
      var t = { devir: 0, gunBasi: 0, giren: 0, cikan: 0, gunSonu: 0 };

      for (i = 0; i < silolar.length; i++) {
        var s = silolar[i];
        var g = toplam[s.Id] || { giren: 0, cikan: 0, adet: 0, tipler: [] };
        var gunBasi = YU.stok.siloGunBasi(depo, s.Id, gun);
        var gunSonu = YU.yuvarla(gunBasi + g.giren - g.cikan);
        var devir = YU.stok.enSonDevir(depo, 'Silo', s.Id, gun);

        /* Pasif silo yalnız hareketi ya da bakiyesi varsa listelenir. */
        if (s.Aktif === false && !g.adet && !gunBasi && !gunSonu) continue;

        if (g.adet) { hareketliSilo++; hareketSayisi += g.adet; }
        t.devir = YU.yuvarla(t.devir + (devir ? Number(devir.Miktar) || 0 : 0));
        t.gunBasi = YU.yuvarla(t.gunBasi + gunBasi);
        t.giren = YU.yuvarla(t.giren + g.giren);
        t.cikan = YU.yuvarla(t.cikan + g.cikan);
        t.gunSonu = YU.yuvarla(t.gunSonu + gunSonu);

        /* Hareket tipleri rozet olarak; hiç hareket yoksa "değişmedi". */
        var tipKutusu;
        if (!g.adet) {
          tipKutusu = YU.h('span', { sinif: 'yu-zayif', metin: 'Değişmedi' });
        } else {
          tipKutusu = YU.h('div', { stil: { display: 'flex', gap: '5px', flexWrap: 'wrap' } });
          for (var j = 0; j < g.tipler.length; j++) {
            tipKutusu.appendChild(YU.ui.rozet(
              HAREKET_TIP_ADI[g.tipler[j]] || g.tipler[j],
              g.tipler[j] === 'Manuel' ? 'bekleyen' : 'notr'
            ));
          }
        }

        satirlar.push({
          vurgu: gunSonu < 0 ? 'olumsuz' : null,
          onClick: (function (iso) { return function () { YU.gunPenceresi(iso); }; })(gun),
          hucreler: [
            YU.h('span', { sinif: 'yu-guclu', metin: s.silo ? s.silo.Ad : s.Ad }),
            devir ? mono(YU.fmt.kg(Number(devir.Miktar) || 0), true)
                  : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
            mono(YU.fmt.kg(gunBasi)),
            yonHucresi(g.giren, true),
            yonHucresi(g.cikan, false),
            gunSonu < 0
              ? YU.ui.rozet(YU.fmt.kg(gunSonu), 'olumsuz')
              : YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(gunSonu) }),
            tipKutusu,
            kaydedenHucresi(depo, g, gun)
          ]
        });
      }

      if (satirlar.length > 1) {
        /* KURAL 10.1: TOPLAM satırı veri satırlarından ayrışır. */
        satirlar.push({
          toplam: true,
          hucreler: [
            YU.h('span', { sinif: 'yu-guclu', metin: 'TOPLAM' }),
            YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.devir) }),
            YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.gunBasi) }),
            yonHucresi(t.giren, true),
            yonHucresi(t.cikan, false),
            YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.gunSonu) }),
            YU.h('span', { sinif: 'yu-zayif', metin: '' }),
            YU.h('span', { sinif: 'yu-zayif', metin: '' })
          ]
        });
      }

      sayacMetni.textContent = hareketSayisi
        ? YU.fmt.sayi(hareketSayisi) + ' hareket · ' + YU.fmt.sayi(hareketliSilo) + ' silo'
        : 'Bu gün hareket yok';

      YU.bos(tabloKabi).appendChild(YU.ui.tablo({
        sutunlar: [
          { baslik: 'Silo', genislik: 130 },
          { baslik: 'Devir', hiza: 'sag', mono: true, genislik: 120 },
          { baslik: 'Gün Başı', hiza: 'sag', mono: true, genislik: 130 },
          { baslik: 'Giren', hiza: 'sag', mono: true, genislik: 130 },
          { baslik: 'Çıkan', hiza: 'sag', mono: true, genislik: 130 },
          { baslik: 'Gün Sonu', hiza: 'sag', mono: true, genislik: 140 },
          { baslik: 'Hareket' },
          { baslik: 'Kaydeden', genislik: 190 }
        ],
        satirlar: satirlar,
        tiklamaIpucu: 'Günün raporunu açmak için tıklayın',
        bos: 'Tanımlı silo yok.',
        /* yapiskan KAPALI (25.08.2026): panel artık yarım genişlikte duruyor
           ve sekiz kolon sığmıyor. Yapışkan başlık kabı overflow:visible
           yapıyor, tablo panelden taşardı; kapalıyken kap yatay kaydırır. */
        yapiskan: false
      }));
    }

    gunAlani = YU.ui.alan({
      etiket: 'Tarih', tip: 'tarih', deger: tarih || YU.tarih.bugun(),
      onChange: function () { gunDugmeleriTazele(); tabloyuCiz(); }
    });

    function refGun() { return seciliGun(); }

    function tekGune(iso) {
      gunAlani.ayarla(iso);
      gunDugmeleriTazele();
      tabloyuCiz();
    }

    var oncekiDugme = YU.ui.dugme({
      metin: 'Önceki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.tarih.ekle(refGun(), -1)); }
    });
    var bugunDugme = YU.ui.dugme({
      metin: YU.donem.gecmisMi() ? 'Kampanya Sonu' : 'Bugün', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.donem.gorunumSonu()); }
    });
    var sonrakiDugme = YU.ui.dugme({
      metin: 'Sonraki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.tarih.ekle(refGun(), 1)); }
    });

    function gunDugmeleriTazele() {
      var ileri = refGun() >= YU.donem.gorunumSonu();
      sonrakiDugme.disabled = ileri;
      sonrakiDugme.title = ileri
        ? (YU.donem.gecmisMi() ? 'Kampanya sonundan ileri gidilemez' : 'Bugünden sonrası için hareket olmaz')
        : '';
    }
    gunDugmeleriTazele();

    var suzgecler = YU.h('div', {
      stil: { display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }
    },
      (gunAlani.kok.style.width = '158px', gunAlani.kok),
      YU.h('div', { stil: { display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '3px' } },
        oncekiDugme, bugunDugme, sonrakiDugme)
    );

    tabloyuCiz();

    return {
      panel: YU.ui.panel({
        baslik: 'Silo Hareketleri',
        ikon: '#ic-filter',
        sag: sayacMetni,
        govde: [suzgecler, tabloKabi]
      })
    };
  }

  /* ------------------------------------------------------------------
     Sayım Düzeltmesi penceresi (DUZELTME-PLANI M18, Şartname §11)
     ------------------------------------------------------------------ */

  /* Kapasite aşımının gerekçeli kabulü (M32) — 21-kuru-kuspe-giris'teki
     pencerenin Sayım Düzeltmesi karşılığı. Engel korunur, kapı açılır. */
  function kapasiteOnayiAc(hatalar, devam) {
    var enAz = (YU.dogrula && YU.dogrula.GEREKCE_ENAZ) || 10;
    var serit = YU.ui.serit({
      tur: 'hata', ikon: '#ic-alert',
      baslik: 'Silo Kapasitesi Aşılıyor',
      metin: 'Bu sayım düzeltmesi siloyu kapasitesinin üstüne çıkarıyor. Rakam yanlışsa ' +
        'düzeltin. Aşım gerçekse gerekçesini yazın — kayıt geçer, gerekçe denetim izine yazılır.'
    });
    serit.className += ' yu-cetin';
    var gerekceAlan = YU.ui.alan({
      etiket: 'Aşımın Gerekçesi (Zorunlu)', tip: 'metin',
      yardim: 'En az ' + enAz + ' karakter. Denetim izinde bu cümle görünecek.'
    });
    var mk = YU.ui.modal({
      baslik: 'Kapasite Aşımını Kabul Et',
      genislik: 600,
      govde: [serit, YU.ui.hataListesi(hatalar, 'uyari'), gerekceAlan.kok],
      dugmeler: [
        { metin: 'Vazgeç · Rakamı Düzelt', tur: 'sade', onClick: function () { mk.kapat(); } },
        {
          metin: 'Aşımı Kabul Et ve Kaydet', ikon: '#ic-alert', tur: 'tehlike',
          onClick: function () {
            var g = String(gerekceAlan.deger() || '').trim();
            if (g.length < enAz) {
              gerekceAlan.hataGoster('Gerekçe en az ' + enAz + ' karakter olmalı. Şu an ' + g.length + '.');
              return;
            }
            mk.kapat();
            devam(g);
          }
        }
      ]
    });
    gerekceAlan.odakla();
  }

  function sayimDuzeltmeAc(depo, silolar, varsayilanTarih) {
    var hataKap = YU.h('div');
    var secenekler = [], i;
    for (i = 0; i < silolar.length; i++) {
      if (silolar[i].Aktif === false) continue;
      secenekler.push({ deger: String(silolar[i].Id), metin: silolar[i].Ad });
    }

    var siloAlan = YU.ui.alan({ etiket: 'Silo', tip: 'secim', secenekler: secenekler,
      deger: secenekler.length ? secenekler[0].deger : '' });
    var tarihAlan = YU.ui.alan({ etiket: 'Tarih', tip: 'tarih', deger: varsayilanTarih });
    var yonAlan = YU.ui.alan({
      etiket: 'Yön', tip: 'secim',
      secenekler: [
        { deger: 'giren', metin: 'Giren — fiili sayım sistemden FAZLA' },
        { deger: 'cikan', metin: 'Çıkan — fiili sayım sistemden EKSİK' }
      ],
      deger: 'giren'
    });
    var miktarAlan = YU.ui.alan({ etiket: 'Miktar', tip: 'sayi', sag: 'kg',
      yardim: 'Sayım farkının mutlak değeri (örn. 1.250).' });
    var aciklamaAlan = YU.ui.alan({ etiket: 'Açıklama (zorunlu)', tip: 'metin',
      yardim: 'Farkın gerekçesi — denetim izinde görünür (örn. "fiili sayım farkı").' });

    var onizleme = YU.h('div', { sinif: 'yu-yardim' });

    function onizle() {
      var id = parseInt(siloAlan.deger(), 10);
      var t = tarihAlan.girdi.value;
      var m = miktarAlan.deger();
      if (!isFinite(id) || !/^\d{4}-\d{2}-\d{2}$/.test(t) || isNaN(m) || m <= 0) {
        onizleme.textContent = 'Gün sonu önizlemesi: silo, tarih ve miktar girilince hesaplanır.';
        return;
      }
      var mevcut = Number(YU.stok.siloStok(depo, id, t).mevcut) || 0;
      var yeni = YU.yuvarla(mevcut + (yonAlan.deger() === 'giren' ? m : -m));
      onizleme.textContent = 'Gün sonu önizlemesi: ' + YU.fmt.kgU(mevcut) + ' → ' + YU.fmt.kgU(yeni) +
        (yeni < 0 ? ' — NEGATİF: kayıt D14 ile reddedilir.' : '');
    }
    siloAlan.girdi.addEventListener('change', onizle);
    tarihAlan.girdi.addEventListener('change', onizle);
    yonAlan.girdi.addEventListener('change', onizle);
    miktarAlan.girdi.addEventListener('input', onizle);
    onizle();

    var m2 = YU.ui.modal({
      baslik: 'Sayım Düzeltmesi (Manuel Hareket)',
      genislik: 520,
      govde: [
        hataKap,
        YU.h('div', { sinif: 'yu-yardim', metin:
          'Fiili sayım ile sistem stoğu arasındaki fark Manuel tipli silo hareketi olarak yazılır ' +
          '(Şartname §6 tip tanımı, §11 sayım/düzeltme kaydı). D14 ileri doğrulama ve D15 kapasite ' +
          'kuralları aynen uygulanır; hareket kuru küspe düzeltmelerinde silinmez.' }),
        siloAlan.kok, tarihAlan.kok, yonAlan.kok, miktarAlan.kok, aciklamaAlan.kok, onizleme
      ],
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m2.kapat(); } },
        { metin: 'Kaydet', tur: 'birincil', onClick: kaydet }
      ]
    });

    function kaydet() {
      yaz(null);

      /* Kapasite aşımı gerekçeli kabul (M32): kayıt YALNIZ D15 yüzünden
         reddedildiyse sert uyarı + zorunlu gerekçe; başka hata varsa
         normal hata listesi gösterilir. */
      function yaz(gerekce) {
        var girdi = {
          tarih: tarihAlan.girdi.value,
          siloId: parseInt(siloAlan.deger(), 10),
          yon: yonAlan.deger(),
          miktar: miktarAlan.deger(),
          aciklama: aciklamaAlan.deger()
        };
        if (gerekce) girdi.kapasiteGerekcesi = gerekce;
        var s = YU.servis.manuelHareketKaydet(depo, girdi, YU.oturum.kullanici);
        if (!s.ok) {
          var yalnizKapasite = s.hatalar.length > 0;
          for (var i = 0; i < s.hatalar.length; i++) if (s.hatalar[i].kod !== 'D15') yalnizKapasite = false;
          if (yalnizKapasite) { kapasiteOnayiAc(s.hatalar, yaz); return; }
          YU.bos(hataKap).appendChild(YU.ui.hataListesi(s.hatalar, 'hata'));
          return;
        }
        m2.kapat();
        YU.ui.bildir('Sayım düzeltmesi kaydedildi: ' + YU.fmt.kgU(s.kayit.GirenKg || s.kayit.CikanKg) +
          (Number(s.kayit.GirenKg) > 0 ? ' giren' : ' çıkan') + '.', 'basari');
        if (s.uyarilar && s.uyarilar.length) YU.ui.bildir(s.uyarilar[0].mesaj, 'uyari');
        YU.yenile();
      }
    }
  }

  /* ------------------------------------------------------------------
     Silo Bazında Stok tablosu (kullanıcı isteği, 25.08.2026)

     Stok Durumu'ndaki "Malzeme Bazında Stok" tablosunun silo karşılığıdır;
     aynı kolon mantığı silo diliyle kurulur:
       malzeme → silo · üretim → giren · satış → çıkan · stok → mevcut
     Kartlar tek silonun durumunu gösterir; bu tablo üç siloyu yan yana
     okumaya ve toplamı görmeye yarar. Rakamlar YU.stok'tan gelir — formül
     burada yeniden yazılmaz (SÖZLEŞME §5).
     ------------------------------------------------------------------ */

  function mono(metin, zayif) {
    return YU.h('span', { sinif: 'yu-mono' + (zayif ? ' yu-zayif' : ''), metin: metin });
  }

  function kgHucre(n) {
    if (!n) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    return mono(YU.fmt.kg(n));
  }

  /* Doluluk hücresi: yüzde + çubuk. Kapasite metni ("kapasite 3.000.000 kg")
     hücreden çıkarıldı, ipucuna alındı — tabloyu 12px taşırıyordu ve kapasite
     zaten silo kartında yazıyor. */
  function dolulukHucresi(s) {
    var oran = s.doluluk || 0;
    var kutu = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '0' } },
      YU.h('div', { sinif: 'yu-yardim', stil: { margin: '0' }, metin: YU.fmt.yuzde(oran * 100) }),
      YU.ui.cubuk(oran, dolulukTur(oran))
    );
    kutu.title = 'Kapasite ' + YU.fmt.kgU(s.kapasite) +
      (s.mevcut > s.kapasite ? ' · aşıldı' : ' · kalan ' + YU.fmt.kgU(YU.yuvarla(s.kapasite - s.mevcut)));
    return kutu;
  }

  function stokTablosu(depo, satirlar, tarih) {
    /* Seçili günün silo hareketleri tek geçişte haritalanır (silo başına
       yeniden tarama yok) — Stok Durumu'ndaki gunluk haritasının aynısı. */
    var gunluk = {}, sh = depo.siloHareket, i, h, o;
    for (i = 0; i < sh.length; i++) {
      h = sh[i];
      if (h.Tarih !== tarih) continue;
      o = gunluk[h.SiloId] || (gunluk[h.SiloId] = { giren: 0, cikan: 0 });
      o.giren = YU.yuvarla(o.giren + (Number(h.GirenKg) || 0));
      o.cikan = YU.yuvarla(o.cikan + (Number(h.CikanKg) || 0));
    }

    var tablo = [], s, devir, gunBasi, g;
    var t = { devir: 0, gunBasi: 0, gunGiren: 0, gunCikan: 0, giren: 0, cikan: 0, mevcut: 0, kapasite: 0 };

    for (i = 0; i < satirlar.length; i++) {
      s = satirlar[i];
      devir = YU.stok.enSonDevir(depo, 'Silo', s.silo.Id, tarih);
      gunBasi = YU.stok.siloGunBasi(depo, s.silo.Id, tarih);
      g = gunluk[s.silo.Id] || { giren: 0, cikan: 0 };

      t.devir = YU.yuvarla(t.devir + s.devir);
      t.gunBasi = YU.yuvarla(t.gunBasi + gunBasi);
      t.gunGiren = YU.yuvarla(t.gunGiren + g.giren);
      t.gunCikan = YU.yuvarla(t.gunCikan + g.cikan);
      t.giren = YU.yuvarla(t.giren + s.giren);
      t.cikan = YU.yuvarla(t.cikan + s.cikan);
      t.mevcut = YU.yuvarla(t.mevcut + s.mevcut);
      t.kapasite = YU.yuvarla(t.kapasite + s.kapasite);

      tablo.push([
        YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
          YU.h('span', { sinif: 'yu-guclu', metin: s.silo.Ad }),
          s.silo.Aktif === false ? YU.ui.rozet('Pasif', 'notr') : null,
          s.mevcut > s.kapasite ? YU.ui.rozet('Kapasite Aşıldı', 'olumsuz') : null
        ),
        /* Devir tarihi ayrı kolon değil, devrin altında küçük satır:
           on kolon ekrana sığmıyordu (ölçüldü: 1109px tablo, 979px alan). */
        devir
          ? YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' } },
              mono(YU.fmt.kg(s.devir)),
              YU.h('span', { sinif: 'yu-yardim', stil: { margin: '0' },
                metin: YU.fmt.tarih(devir.DevirTarihi) })
            )
          : kgHucre(s.devir),
        kgHucre(gunBasi),
        kgHucre(g.giren),
        kgHucre(g.cikan),
        kgHucre(s.giren),
        kgHucre(s.cikan),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(s.mevcut) }),
        dolulukHucresi(s)
      ]);
    }

    if (tablo.length > 1) {
      var toplamOran = t.kapasite > 0 ? t.mevcut / t.kapasite : 0;
      /* toplam:true — koyu zeminli, üstü çizgili TOPLAM satırı
         (kullanıcı isteği, 25.08.2026): veri satırlarından ayrılsın. */
      tablo.push({ toplam: true, hucreler: [
        YU.h('span', { sinif: 'yu-guclu', metin: 'TOPLAM' }),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.devir) }),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.gunBasi) }),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.gunGiren) }),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.gunCikan) }),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.giren) }),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.cikan) }),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(t.mevcut) }),
        dolulukHucresi({ doluluk: toplamOran, kapasite: t.kapasite, mevcut: t.mevcut })
      ] });
    }

    var sar = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Silo' },
        { baslik: 'Devir', genislik: 112, hiza: 'sag', mono: true },
        { baslik: 'Gün Başı', genislik: 112, hiza: 'sag', mono: true },
        { baslik: 'Günlük Giren', genislik: 112, hiza: 'sag', mono: true },
        { baslik: 'Günlük Çıkan', genislik: 112, hiza: 'sag', mono: true },
        { baslik: 'Toplam Giren', genislik: 116, hiza: 'sag', mono: true },
        { baslik: 'Toplam Çıkan', genislik: 116, hiza: 'sag', mono: true },
        { baslik: 'Mevcut', genislik: 118, hiza: 'sag', mono: true },
        { baslik: 'Doluluk', genislik: 122 }
      ],
      satirlar: tablo,
      bos: 'Tanımlı silo yok.',
      yapiskan: true
    });
    /* Stok Durumu'ndaki gibi: on kolon A4'e sığmıyor, baskıda yazı küçülür. */
    sar.className += ' yu-baski-sig';

    return YU.ui.panel({
      baslik: 'Silo Bazında Stok',
      ikon: '#ic-chart',
      /* Panel sağındaki tarih yazısı kaldırıldı (kullanıcı isteği, 25.08.2026):
         hangi güne ait olduğu sayfa alt başlığında zaten yazıyor, tekrardı. */
      dolgusuz: true,
      govde: sar
    });
  }

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  function ciz(kap, param) {
    var depo = YU.db;
    var tarih = tarihSec(param);
    var silolar = [], i;
    var satirlar = YU.stok.tumSilolar(depo, tarih);

    for (i = 0; i < satirlar.length; i++) silolar.push(satirlar[i].silo);

    /* Tarih seçici sayfa başlığının sağında durur; değişince adres satırı da
       değişsin diye YU.git ile yeniden çizilir (bağlantı paylaşılabilir olur). */
    var tarihAlani = YU.ui.alan({
      tip: 'tarih', deger: tarih, genislik: 158,
      onChange: function () {
        var yeni = tarihAlani.deger();
        if (gecerliTarih(yeni)) YU.git('silo-durumu', { tarih: yeni });
      }
    });
    /* Gün gezinme üçlüsü diğer ekranlarla aynı (kullanıcı isteği, 24.08.2026):
       Önceki Gün · Bugün · Sonraki Gün; Sonraki bugünde pasiftir. */
    function guneGit(iso) {
      YU.git('silo-durumu', { tarih: iso });
    }
    var bugun = YU.tarih.bugun();
    YU.ui.sayfaEylemleri(
      /* Sayım Düzeltmesi (M18, Şartname §11): fiili sayım ile sistem stoğu
         arasındaki fark Manuel silo hareketi olarak girilir. Yönetici işlemi;
         servis rolü ayrıca denetler (M15). */
      YU.yonetici() ? YU.ui.dugme({
        metin: 'Sayım Düzeltmesi', ikon: '#ic-gear', tur: 'ikincil',
        baslik: 'Fiili sayım farkını Manuel silo hareketi olarak kaydeder (Şartname §11)',
        onClick: function () { sayimDuzeltmeAc(depo, silolar, tarih); }
      }) : null,
      tarihAlani.kok,
      YU.ui.dugme({
        metin: 'Önceki Gün', tur: 'ikincil',
        onClick: function () { guneGit(YU.tarih.ekle(tarih, -1)); }
      }),
      YU.ui.dugme({
        metin: 'Bugün', ikon: '#ic-calendar', tur: 'ikincil',
        onClick: function () { guneGit(bugun); }
      }),
      YU.ui.dugme({
        metin: 'Sonraki Gün', tur: 'ikincil',
        pasif: tarih >= bugun,
        baslik: tarih >= bugun ? 'Bugünden ileri gidilemez' : '',
        onClick: function () { guneGit(YU.tarih.ekle(tarih, 1)); }
      })
    );

    if (!satirlar.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-building',
        baslik: 'Tanımlı Silo Yok',
        metin: 'Dökme kuru küspe silolarda durur; silo tanımı olmadan dökme stok hesaplanamaz.'
      }));
      return;
    }

    var negatifler = YU.stok.negatifGunler(depo);
    if (negatifler.length) kap.appendChild(negatifSerit(negatifler));

    var kartlar = YU.h('div', { sinif: 'yu-izgara yu-iz-3' });
    for (i = 0; i < satirlar.length; i++) kartlar.appendChild(siloKarti(depo, satirlar[i], tarih));
    kap.appendChild(kartlar);

    /* Kartlar tek silonun durumunu gösterir; tablo üçünü yan yana okutur
       (kullanıcı isteği, 25.08.2026 — Stok Durumu'ndaki tablo mantığı).
       "Toplam mevcut · dökme / Toplam kapasite / Doluluk / Ton karşılığı"
       şeridi KALDIRILDI (kullanıcı isteği, 25.08.2026): aynı rakamlar
       tablonun TOPLAM satırında duruyor, iki yerde tekrar ediyordu. */
    kap.appendChild(stokTablosu(depo, satirlar, tarih));

    /* Dökme üretim–satış grafiği ile Silo Hareketleri YAN YANA durur
       (kullanıcı isteği, 25.08.2026). Izgara 1fr / 1.55fr: grafik dar,
       hareket tablosu geniş tarafta — tablonun sekiz kolonu var, eşit
       bölüşümde sıkışırdı. alignItems:start ile kısa grafik paneli uzun
       tablonun boyuna gerilmez. Dar ekranda tema.css zaten tek sütuna
       düşürür (.yu-iz-yan-ters medya kuralı).
       Silo süzgeci kalktığı için ?silo= parametresi kullanılmıyor
       (24.08.2026); hiçbir ekran bu parametreyle buraya yönlendirmiyor. */
    var hareketler = hareketPaneli(depo, silolar, tarih).panel;
    var grafik = typeof YU.dokmeGrafikPaneli === 'function' ? YU.dokmeGrafikPaneli() : null;

    if (grafik) {
      /* Hareketler SOLDA ve geniş (1.55fr), grafik SAĞDA ve dar (1fr) —
         kullanıcı isteği, 25.08.2026. alignItems verilmez: ızgara
         varsayılanı stretch, iki panel AYNI YÜKSEKLİKTE durur. Grafik
         panelinin gövdesi de gerilsin diye yu-esit eklenir. */
      kap.appendChild(YU.h('div', {
        sinif: 'yu-izgara yu-iz-yan yu-esit'
      }, hareketler, grafik));
    } else {
      kap.appendChild(hareketler);
    }
  }

  YU.sayfaTanimla({
    kod: 'silo-durumu',
    baslik: 'Günlük Silo Durumu',   /* "Silo Durumu" → gün bazlı görünüm adı (kullanıcı kararı, 25.08.2026) */
    ikon: '#ic-building',
    grup: 'Takip',
    rol: 'Hepsi',
    /* Alt başlıkta yalnız tarih kalır (kullanıcı isteği, 25.08.2026):
       "dökme kuru küspe toplamı …" rakamı tablonun TOPLAM satırında var. */
    altBaslik: function (param) {
      return YU.fmt.tarih(tarihSec(param)) + ' itibarıyla';
    },
    ciz: ciz
  });
})();

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
        'Satıra tıklayınca o günün Günlük Raporu açılır.'
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

  function toplamSeridi(satirlar) {
    var mevcut = 0, kapasite = 0, i;
    for (i = 0; i < satirlar.length; i++) {
      mevcut += satirlar[i].mevcut;
      kapasite += satirlar[i].kapasite;
    }
    mevcut = YU.yuvarla(mevcut);
    kapasite = YU.yuvarla(kapasite);
    var oran = kapasite > 0 ? mevcut / kapasite : 0;

    /* .yu-hesap dikey fiş düzenidir; özet öğeleri yan yana durmalı, bu yüzden
       yatay .yu-hesap-satir kabına alınır ve şerit boyunca eşit dağıtılır. */
    return YU.h('div', null,
      YU.h('div', { sinif: 'yu-hesap' },
        YU.h('div', { sinif: 'yu-hesap-satir', stil: { justifyContent: 'space-between' } },
          hesapOge('Toplam mevcut · dökme', YU.fmt.kgU(mevcut)),
          hesapOge('Toplam kapasite', YU.fmt.kgU(kapasite)),
          hesapOge('Doluluk', YU.fmt.yuzde(oran * 100), kapasite > 0 ? dolulukTur(oran) : null),
          hesapOge('Ton karşılığı', YU.fmt.ton(mevcut))
        )
      )
    );
  }

  /* ------------------------------------------------------------------
     Hareket tablosu — bakiye kümülatif hesaplanır
     ------------------------------------------------------------------ */

  /* Şeridin altındaki çuvallı stok açıklama notu kaldırıldı (kullanıcı
     isteği, 24.08.2026); "· dökme" eki toplamın neyi saydığını söylemeye
     devam ediyor. */

  /* Bakiye satır satır yürütülür: silo başına kronolojik sırada devir
     bakiyeyi sıfırlar (Şartname §5 "en son devir"), sonra giren/çıkan işlenir. */
  function hareketleriHazirla(depo) {
    var grup = {}, devirler = {}, i, h, d;

    for (i = 0; i < depo.siloHareket.length; i++) {
      h = depo.siloHareket[i];
      (grup[h.SiloId] || (grup[h.SiloId] = [])).push(h);
    }
    for (i = 0; i < depo.siloDevirStok.length; i++) {
      d = depo.siloDevirStok[i];
      (devirler[d.SiloId] || (devirler[d.SiloId] = [])).push(d);
    }

    function kronolojik(a, b) {
      if (a.Tarih !== b.Tarih) return a.Tarih < b.Tarih ? -1 : 1;
      return (a.Id || 0) - (b.Id || 0);
    }

    var sonuc = [], anahtar;
    for (anahtar in grup) {
      if (!kendinin(grup, anahtar)) continue;
      var liste = grup[anahtar].slice().sort(kronolojik);
      var dv = (devirler[anahtar] || []).slice().sort(function (a, b) {
        return a.DevirTarihi < b.DevirTarihi ? -1 : (a.DevirTarihi > b.DevirTarihi ? 1 : 0);
      });
      /* Devir de LİSTEDE bir satırdır (kullanıcı isteği, 24.08.2026): bakiye
         kolonunun başlangıcı görünür olur. Şartname §5 gereği devir bakiyeyi
         sıfırlayıp yerine geçer; satırı da bunu söyler. */
      function devirSatiri(devir) {
        var m = YU.yuvarla(Number(devir.Miktar) || 0);
        sonuc.push({
          devir: devir, tarih: devir.DevirTarihi, siloId: Number(anahtar),
          sira: -1, bakiye: m, devirMiktari: m
        });
      }
      /* aktifDevir: o satır işlenirken geçerli olan "en son devir" (§5) —
         Devir kolonu bunu gösterir (kullanıcı isteği, 24.08.2026). */
      var bakiye = 0, k = 0, aktifDevir = 0;
      for (i = 0; i < liste.length; i++) {
        while (k < dv.length && dv[k].DevirTarihi <= liste[i].Tarih) {
          aktifDevir = YU.yuvarla(Number(dv[k].Miktar) || 0);
          bakiye = aktifDevir;
          devirSatiri(dv[k]);
          k++;
        }
        bakiye = YU.yuvarla(bakiye + (Number(liste[i].GirenKg) || 0) - (Number(liste[i].CikanKg) || 0));
        sonuc.push({
          hareket: liste[i], tarih: liste[i].Tarih, siloId: liste[i].SiloId,
          sira: liste[i].Id || 0, bakiye: bakiye, devirMiktari: aktifDevir
        });
      }
      while (k < dv.length) { devirSatiri(dv[k]); k++; }   /* son hareketten sonraki devirler */
    }

    /* Ekranda yeni satır üstte; bakiye kolonu o satırdan SONRAKİ bakiyedir.
       Devir, aynı günün hareketlerinden önce geldiği için (sira: -1) ekranda
       o günün EN ALTINA düşer. */
    sonuc.sort(function (a, b) {
      if (a.tarih !== b.tarih) return a.tarih < b.tarih ? 1 : -1;
      if (a.siloId !== b.siloId) return a.siloId - b.siloId;
      return b.sira - a.sira;
    });
    return sonuc;
  }

  function siloAdi(depo, id) {
    for (var i = 0; i < depo.silolar.length; i++) if (depo.silolar[i].Id === id) return depo.silolar[i].Ad;
    return 'Silo #' + id;
  }


  function hareketPaneli(depo, silolar, tarih) {
    var tumu = hareketleriHazirla(depo);
    /* Tarih süzgeci BOŞ açılır (kullanıcı isteği, 24.08.2026): liste komple
       gelir, sayfalama baştan bütün günleri kapsar. Daraltma takvimlerden
       ve gün düğmelerinden yapılır. */

    var sayacMetni = YU.h('span');
    var tabloKabi = YU.h('div');

    /* Silo ve hareket tipi süzgeçleri kaldırıldı (kullanıcı isteği,
       24.08.2026): liste HER ZAMAN tüm siloları ve tüm tipleri gösterir,
       geriye yalnız tarih süzgeci kalır. */
    var i;
    var basAlani, bitAlani;

    function suzulmus() {
      var bas = basAlani.deger();
      var bit = bitAlani.deger();
      var liste = [], j, h;
      for (j = 0; j < tumu.length; j++) {
        h = tumu[j];
        if (bas && h.tarih < bas) continue;
        if (bit && h.tarih > bit) continue;
        liste.push(h);
      }
      return liste;
    }

    var sayfa = 0;

    /* Süzgeç değişince ilk sayfaya dönülür; sayfa düğmeleri sayfayı korur. */
    function suzgecDegisti() { sayfa = 0; tabloyuCiz(); }

    function tabloyuCiz() {
      var liste = suzulmus();

      /* Sayfalama satırla değil GÜNLE: her sayfa 14 kayıtlı günün hareketlerini
         gösterir (kullanıcı isteği, 21.08.2026). Liste yeniden eskiye sıralı
         olduğundan gün listesi de aynı sırada toplanır. */
      var gunListesi = [], gorulenGun = {}, j;
      for (j = 0; j < liste.length; j++) {
        if (!gorulenGun[liste[j].tarih]) {
          gorulenGun[liste[j].tarih] = 1;
          gunListesi.push(liste[j].tarih);
        }
      }
      var toplamSayfa = Math.max(1, Math.ceil(gunListesi.length / SAYFA_GUN));
      if (sayfa > toplamSayfa - 1) sayfa = toplamSayfa - 1;
      if (sayfa < 0) sayfa = 0;
      var dilim = gunListesi.slice(sayfa * SAYFA_GUN, sayfa * SAYFA_GUN + SAYFA_GUN);
      var sayfaGunleri = {};
      for (j = 0; j < dilim.length; j++) sayfaGunleri[dilim[j]] = 1;
      var gosterilen = [];
      for (j = 0; j < liste.length; j++) {
        if (sayfaGunleri[liste[j].tarih]) gosterilen.push(liste[j]);
      }
      var satirlar = [], k, h;

      for (j = 0; j < gosterilen.length; j++) {
        /* Devir satırı: giren/çıkan yok, bakiye devir miktarının kendisi.
           Gün penceresi açılmaz — devir bir günlük giriş değildir. */
        if (gosterilen[j].devir) {
          satirlar.push({
            hucreler: [
              tarihMetni(gosterilen[j].devir.DevirTarihi),
              siloAdi(depo, gosterilen[j].siloId),
              YU.fmt.kg(gosterilen[j].devirMiktari),
              YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
              YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
              YU.fmt.kg(gosterilen[j].bakiye),
              YU.ui.rozet('Devir', 'vurgu'),
              ''
            ]
          });
          continue;
        }
        h = gosterilen[j].hareket;
        k = gosterilen[j].bakiye;
        satirlar.push({
          vurgu: k < 0 ? 'olumsuz' : null,
          /* Tam sayfaya gitmek yerine küçük pencere: kullanıcı listeden kopmuyor. */
          onClick: (function (t) { return function () { YU.gunPenceresi(t); }; })(h.Tarih),
          hucreler: [
            tarihMetni(h.Tarih),
            siloAdi(depo, h.SiloId),
            /* Ekstra bilgi: satırın dayandığı devir — tekrar ettiği için soluk. */
            YU.h('span', { sinif: 'yu-zayif', metin: YU.fmt.kg(gosterilen[j].devirMiktari) }),
            /* Yön işareti (kullanıcı isteği, 24.08.2026): siloya giren +,
               silodan çıkan −. Sıfır satırlarda işaret yazılmaz. */
            h.GirenKg > 0 ? '+' + YU.fmt.kg(h.GirenKg) : '—',
            h.CikanKg > 0 ? '−' + YU.fmt.kg(h.CikanKg) : '—',
            k < 0 ? YU.ui.rozet(YU.fmt.kg(k), 'olumsuz') : YU.fmt.kg(k),
            h.KaynakKayitId === null || h.KaynakKayitId === undefined
              ? YU.h('span', { sinif: 'yu-zayif', metin: 'Elle girilmiş' })
              : YU.h('span', { sinif: 'yu-zayif', metin: 'Kuru küspe #' + YU.fmt.sayi(h.KaynakKayitId) }),
            /* Detay: günün KÜÇÜK PENCERESİNİ açar — sekmeden ayrılmaz, satır
               tıklamasıyla aynı davranış (kullanıcı isteği, 21.08.2026). */
            (function (t) {
              var d = YU.ui.dugme({
                metin: 'Detay', ikon: '#ic-doc', tur: 'ikincil', kucuk: true,
                baslik: 'Günün Verisi · ' + YU.fmt.tarih(t),
                onClick: function () { YU.gunPenceresi(t); }
              });
              /* Pencere iki kez açılmasın diye satır tıklaması bastırılır. */
              d.addEventListener('click', function (e) { e.stopPropagation(); });
              return d;
            })(h.Tarih)
          ]
        });
      }

      sayacMetni.textContent = dilim.length && toplamSayfa > 1
        ? YU.fmt.tarih(dilim[dilim.length - 1]) + ' – ' + YU.fmt.tarih(dilim[0]) + ' · ' +
          YU.fmt.sayi(gosterilen.length) + ' / ' + YU.fmt.sayi(liste.length) + ' satır'
        : YU.fmt.sayi(liste.length) + ' satır';

      YU.bos(tabloKabi).appendChild(YU.ui.tablo({
        /* Genişlikler toplamı dar ekranda da Kaynak sütununa yer bırakmalı;
           yoksa "Kuru küspe #138" satır satır sarar ve tablo şişer. */
        sutunlar: [
          { baslik: 'Tarih', genislik: 96 },
          { baslik: 'Silo', genislik: 88 },
          { baslik: 'Devir', hiza: 'sag', mono: true, genislik: 112 },
          { baslik: 'Giren', hiza: 'sag', mono: true, genislik: 112 },
          { baslik: 'Çıkan', hiza: 'sag', mono: true, genislik: 112 },
          { baslik: 'Bakiye', hiza: 'sag', mono: true, genislik: 124 },
          { baslik: 'Kaynak', genislik: 150 },
          { baslik: '', hiza: 'sag', genislik: 96 }
        ],
        satirlar: satirlar,
        tiklamaIpucu: 'Günün raporunu açmak için tıklayın',
        bos: 'Bu süzgeçle eşleşen silo hareketi yok.',
        yapiskan: true
      }));

      /* Sayfalama — Geçmiş Girişler'deki numaralı dilin aynısı; şerit ORTADA
         durur (kullanıcı isteği, 24.08.2026). Numaralar 1'den başlar, uzun
         listede baş ve son sabit kalıp aradaki boşluk "…" ile atlanır. */
      /* Sayfalama şeridi HER ZAMAN çizilir (kullanıcı isteği, 24.08.2026):
         tek sayfa varken de görünür, düğmeleri pasif durur. */
      {
        var numaraKap = YU.h('div', {
          stil: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }
        });

        numaraKap.appendChild(YU.ui.dugme({
          metin: 'Önceki', tur: 'ikincil', kucuk: true, pasif: sayfa === 0,
          onClick: function () { sayfa--; tabloyuCiz(); }
        }));

        var numaralar = sayfaNumaralari(sayfa + 1, toplamSayfa), n;
        for (n = 0; n < numaralar.length; n++) {
          if (numaralar[n] === null) {
            numaraKap.appendChild(YU.h('span', {
              metin: '…', sinif: 'yu-yardim', stil: { padding: '4px 2px' }
            }));
            continue;
          }
          (function (no) {
            var aktifMi = no === sayfa + 1;
            var stil = {
              padding: '5px 10px', borderRadius: '5px', cursor: 'pointer',
              font: '400 13px/1.4 var(--font)', color: 'var(--metin-5)',
              border: '1px solid transparent'
            };
            if (aktifMi) {
              stil.border = '1px solid var(--kenar-2)';
              stil.color = 'var(--metin)';
            }
            numaraKap.appendChild(YU.h('span', {
              metin: YU.fmt.sayi(no), stil: stil, role: 'button', tabindex: '0',
              title: YU.fmt.sayi(no) + '. sayfa',
              onClick: function () { sayfa = no - 1; tabloyuCiz(); },
              onKeyDown: function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sayfa = no - 1; tabloyuCiz(); }
              }
            }));
          })(numaralar[n]);
        }

        numaraKap.appendChild(YU.ui.dugme({
          metin: 'Sonraki', tur: 'ikincil', kucuk: true, pasif: sayfa >= toplamSayfa - 1,
          onClick: function () { sayfa++; tabloyuCiz(); }
        }));

        /* Bilgi solda, numaralar tam ortada: iki yanına eşit esneyen boşluk. */
        tabloKabi.appendChild(YU.h('div', {
          stil: {
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 18px', borderTop: '1px solid var(--ayrac)'
          }
        },
          YU.h('span', {
            sinif: 'yu-yardim',
            stil: { flex: '1', minWidth: '0' },
            metin: 'Sayfa başına ' + YU.fmt.sayi(SAYFA_GUN) + ' gün'
          }),
          numaraKap,
          YU.h('span', { stil: { flex: '1', minWidth: '0' } })
        ));
      }
    }

    basAlani = YU.ui.alan({
      etiket: 'Başlangıç', tip: 'tarih', deger: '',
      onChange: function () { gunDugmeleriTazele(); suzgecDegisti(); }
    });
    bitAlani = YU.ui.alan({
      etiket: 'Bitiş', tip: 'tarih', deger: '',
      onChange: function () { gunDugmeleriTazele(); suzgecDegisti(); }
    });

    /* Gün gezinme düğmeleri (kullanıcı isteği, 24.08.2026) — Değişiklik
       Geçmişi'ndeki davranışın aynısı: süzgeç bir ARALIK olduğu için
       düğmeler aralığı TEK GÜNE indirir (başlangıç = bitiş), böylece
       gün gün gezilebilir. */
    /* Gezinmenin referansı BİTİŞ tarihidir (kullanıcı hata bildirimi,
       24.08.2026): referans başlangıçtan okununca 09.08–24.08 aralığında
       "Sonraki Gün" aktif kalıyor ve 10.08'e atlıyordu. Aralığın ileri
       ucundan yürünür; bitiş boşsa başlangıç, o da boşsa bugün. */
    function refGun() { return bitAlani.deger() || basAlani.deger() || YU.tarih.bugun(); }

    function tekGune(iso) {
      basAlani.ayarla(iso);
      bitAlani.ayarla(iso);
      gunDugmeleriTazele();
      suzgecDegisti();
    }

    var oncekiDugme = YU.ui.dugme({
      metin: 'Önceki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.tarih.ekle(refGun(), -1)); }
    });
    var bugunDugme = YU.ui.dugme({
      /* Bugün hep tıklanabilir (diğer ekranlarla aynı). */
      metin: 'Bugün', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.tarih.bugun()); }
    });
    var sonrakiDugme = YU.ui.dugme({
      metin: 'Sonraki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.tarih.ekle(refGun(), 1)); }
    });

    function gunDugmeleriTazele() {
      var ileri = refGun() >= YU.tarih.bugun();
      sonrakiDugme.disabled = ileri;
      sonrakiDugme.title = ileri ? 'Bugünden sonrası için hareket olmaz' : '';
    }
    gunDugmeleriTazele();

    var gunDugmeleri = YU.h('div', {
      stil: { display: 'flex', gap: '6px', flexWrap: 'wrap' }
    }, oncekiDugme, bugunDugme, sonrakiDugme);

    /* Geriye yalnız tarih süzgeci kaldı: takvimler yan yana, gün düğmeleri
       altlarında. */
    var suzgecler = YU.h('div', {
      stil: { display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }
    },
      /* Gün düğmeleri tarihlerin SAĞINDA durur (kullanıcı isteği, 24.08.2026);
         alt hiza girdi kutusuyla eşitlenir. */
      YU.h('div', { stil: { display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', flex: 'none' } },
        (basAlani.kok.style.width = '158px', basAlani.kok),
        (bitAlani.kok.style.width = '158px', bitAlani.kok),
        YU.h('div', { stil: { display: 'flex', paddingBottom: '3px' } }, gunDugmeleri)
      )
    );

    /* 'Süzgeci Temizle' kaldırıldı (kullanıcı isteği, 24.08.2026):
       tarih aralığı takvimlerden ve gün düğmelerinden yönetilir. */

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
    kap.appendChild(toplamSeridi(satirlar));

    /* Dökme üretim–satış grafiği ana sayfadan taşındı: hareket dökümünün
       hemen üstünde durur (kullanıcı isteği, 21.08.2026). */
    if (typeof YU.dokmeGrafikPaneli === 'function') {
      var grafik = YU.dokmeGrafikPaneli();
      if (grafik) kap.appendChild(grafik);
    }

    /* Silo süzgeci kalktığı için ?silo= parametresi de kullanılmıyor
       (24.08.2026); hiçbir ekran bu parametreyle buraya yönlendirmiyor. */
    kap.appendChild(hareketPaneli(depo, silolar, tarih).panel);
  }

  YU.sayfaTanimla({
    kod: 'silo-durumu',
    baslik: 'Silo Durumu',
    ikon: '#ic-building',
    grup: 'Takip',
    rol: 'Hepsi',
    altBaslik: function (param) {
      var t = tarihSec(param);
      return YU.fmt.tarih(t) + ' itibarıyla · dökme kuru küspe toplamı ' +
        YU.fmt.kgU(YU.stok.dokmeToplam(YU.db, t));
    },
    ciz: ciz
  });
})();

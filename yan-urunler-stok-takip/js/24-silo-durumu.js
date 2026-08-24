/* js/24-silo-durumu.js — Silo Durumu ekranı.
   Şartname §7: "Silo bazında devir / giren / çıkan / mevcut, kapasiteye göre
   doluluk [v2], negatife düşen gün uyarısı [v2]."
   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu).
   SÖZLEŞME §6 (UI imzaları), §9 (sınıf adları).

   Dosya yüklenirken hiçbir şey çizmez; yalnızca YU.sayfaTanimla çağırır. */
(function () {
  'use strict';

  var YU = window.YU;

  var GRAFIK_GUN = 14;          /* hareket listesinin varsayılan penceresi: son 14 kayıtlı gün (kullanıcı isteği, 21.08.2026) */
  var SAYFA_GUN = 14;           /* sayfalama gün bazlıdır: her sayfa 14 kayıtlı günün hareketlerini gösterir */

  /* Şartname §6 hareket tipleri — ekran metni ve anlam rengi tek yerde. */
  var TIP = {
    DokmeUretim: { metin: 'Dökme Üretim', tur: 'olumlu' },
    Cuvallama: { metin: 'Çuvallama', tur: 'notr' },
    DokmeSatis: { metin: 'Dökme Satış', tur: 'vurgu' },
    Manuel: { metin: 'Manuel', tur: 'bekleyen' }
  };
  var TIP_SIRA = ['DokmeUretim', 'Cuvallama', 'DokmeSatis', 'Manuel'];

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
          hesapOge('Toplam mevcut', YU.fmt.kgU(mevcut)),
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
      var bakiye = 0, k = 0;
      for (i = 0; i < liste.length; i++) {
        while (k < dv.length && dv[k].DevirTarihi <= liste[i].Tarih) {
          bakiye = YU.yuvarla(Number(dv[k].Miktar) || 0);
          k++;
        }
        bakiye = YU.yuvarla(bakiye + (Number(liste[i].GirenKg) || 0) - (Number(liste[i].CikanKg) || 0));
        sonuc.push({ hareket: liste[i], bakiye: bakiye });
      }
    }

    /* Ekranda yeni hareket üstte; bakiye kolonu o hareketten SONRAKİ bakiyedir. */
    sonuc.sort(function (a, b) {
      if (a.hareket.Tarih !== b.hareket.Tarih) return a.hareket.Tarih < b.hareket.Tarih ? 1 : -1;
      if (a.hareket.SiloId !== b.hareket.SiloId) return a.hareket.SiloId - b.hareket.SiloId;
      return (b.hareket.Id || 0) - (a.hareket.Id || 0);
    });
    return sonuc;
  }

  function siloAdi(depo, id) {
    for (var i = 0; i < depo.silolar.length; i++) if (depo.silolar[i].Id === id) return depo.silolar[i].Ad;
    return 'Silo #' + id;
  }

  function tipRozeti(tip) {
    var t = TIP[tip];
    return t ? YU.ui.rozet(t.metin, t.tur) : YU.ui.rozet(String(tip || '—'), 'notr');
  }

  function hareketPaneli(depo, silolar, tarih) {
    var tumu = hareketleriHazirla(depo);
    var gunler = YU.stok.kayitliGunler(depo, null, tarih);
    var pencere = gunler.slice(0, GRAFIK_GUN);
    var varsayilanBas = pencere.length ? pencere[pencere.length - 1].tarih : '';

    var sayacMetni = YU.h('span');
    var tabloKabi = YU.h('div');

    var siloSecenek = [{ deger: '', metin: 'Tüm silolar' }];
    var i;
    for (i = 0; i < silolar.length; i++) siloSecenek.push({ deger: String(silolar[i].Id), metin: silolar[i].Ad });

    var tipSecenek = [{ deger: '', metin: 'Tüm hareket tipleri' }];
    for (i = 0; i < TIP_SIRA.length; i++) tipSecenek.push({ deger: TIP_SIRA[i], metin: TIP[TIP_SIRA[i]].metin });

    var siloAlani, tipAlani, basAlani, bitAlani;

    function suzulmus() {
      var siloId = siloAlani.deger();
      var tip = tipAlani.deger();
      var bas = basAlani.deger();
      var bit = bitAlani.deger();
      var liste = [], j, h;
      for (j = 0; j < tumu.length; j++) {
        h = tumu[j].hareket;
        if (siloId && String(h.SiloId) !== siloId) continue;
        if (tip && h.HareketTipi !== tip) continue;
        if (bas && h.Tarih < bas) continue;
        if (bit && h.Tarih > bit) continue;
        liste.push(tumu[j]);
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
        if (!gorulenGun[liste[j].hareket.Tarih]) {
          gorulenGun[liste[j].hareket.Tarih] = 1;
          gunListesi.push(liste[j].hareket.Tarih);
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
        if (sayfaGunleri[liste[j].hareket.Tarih]) gosterilen.push(liste[j]);
      }
      var satirlar = [], k, h;

      for (j = 0; j < gosterilen.length; j++) {
        h = gosterilen[j].hareket;
        k = gosterilen[j].bakiye;
        satirlar.push({
          vurgu: k < 0 ? 'olumsuz' : null,
          /* Tam sayfaya gitmek yerine küçük pencere: kullanıcı listeden kopmuyor. */
          onClick: (function (t) { return function () { YU.gunPenceresi(t); }; })(h.Tarih),
          hucreler: [
            YU.fmt.tarih(h.Tarih),
            siloAdi(depo, h.SiloId),
            tipRozeti(h.HareketTipi),
            h.GirenKg > 0 ? YU.fmt.kg(h.GirenKg) : '—',
            h.CikanKg > 0 ? YU.fmt.kg(h.CikanKg) : '—',
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
          YU.fmt.sayi(gosterilen.length) + ' / ' + YU.fmt.sayi(liste.length) + ' hareket'
        : YU.fmt.sayi(liste.length) + ' hareket';

      YU.bos(tabloKabi).appendChild(YU.ui.tablo({
        /* Genişlikler toplamı dar ekranda da Kaynak sütununa yer bırakmalı;
           yoksa "Kuru küspe #138" satır satır sarar ve tablo şişer. */
        sutunlar: [
          { baslik: 'Tarih', genislik: 92 },
          { baslik: 'Silo', genislik: 88 },
          { baslik: 'Hareket Tipi', genislik: 128 },
          { baslik: 'Giren', hiza: 'sag', mono: true, genislik: 104 },
          { baslik: 'Çıkan', hiza: 'sag', mono: true, genislik: 104 },
          { baslik: 'Bakiye', hiza: 'sag', mono: true, genislik: 116 },
          { baslik: 'Kaynak', genislik: 150 },
          { baslik: '', hiza: 'sag', genislik: 96 }
        ],
        satirlar: satirlar,
        tiklamaIpucu: 'Günün raporunu açmak için tıklayın',
        bos: 'Bu süzgeçle eşleşen silo hareketi yok.',
        yapiskan: true
      }));

      /* Sayfalama — Değişiklik Geçmişi'ndekiyle aynı dil. */
      if (toplamSayfa > 1) {
        tabloKabi.appendChild(YU.h('div', {
          stil: {
            display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end',
            padding: '12px 18px', borderTop: '1px solid var(--ayrac)'
          }
        },
          YU.h('span', {
            sinif: 'yu-yardim',
            metin: 'Sayfa ' + YU.fmt.sayi(sayfa + 1) + ' / ' + YU.fmt.sayi(toplamSayfa) +
              ' · sayfa başına ' + YU.fmt.sayi(SAYFA_GUN) + ' gün'
          }),
          YU.ui.dugme({
            metin: 'Önceki', tur: 'ikincil', kucuk: true, pasif: sayfa === 0,
            onClick: function () { sayfa--; tabloyuCiz(); }
          }),
          YU.ui.dugme({
            metin: 'Sonraki', tur: 'ikincil', kucuk: true, pasif: sayfa >= toplamSayfa - 1,
            onClick: function () { sayfa++; tabloyuCiz(); }
          })
        ));
      }
    }

    siloAlani = YU.ui.alan({
      etiket: 'Silo', tip: 'secim', secenekler: siloSecenek,
      deger: '', onChange: suzgecDegisti
    });
    tipAlani = YU.ui.alan({
      etiket: 'Hareket Tipi', tip: 'secim', secenekler: tipSecenek,
      deger: '', onChange: suzgecDegisti
    });
    basAlani = YU.ui.alan({
      etiket: 'Başlangıç', tip: 'tarih', deger: varsayilanBas,
      onChange: function () { gunDugmeleriTazele(); suzgecDegisti(); }
    });
    bitAlani = YU.ui.alan({
      etiket: 'Bitiş', tip: 'tarih', deger: tarih,
      onChange: function () { gunDugmeleriTazele(); suzgecDegisti(); }
    });

    /* Gün gezinme düğmeleri (kullanıcı isteği, 24.08.2026) — Değişiklik
       Geçmişi'ndeki davranışın aynısı: süzgeç bir ARALIK olduğu için
       düğmeler aralığı TEK GÜNE indirir (başlangıç = bitiş), böylece
       gün gün gezilebilir. */
    function refGun() { return basAlani.deger() || bitAlani.deger() || YU.tarih.bugun(); }

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

    /* Izgara yerine esnek satır: takvimler sabit genişlikte kalır, gün
       düğmeleri altlarında durur, seçim kutuları kalan yeri paylaşır. */
    var suzgecler = YU.h('div', {
      stil: { display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }
    },
      (siloAlani.kok.style.flex = '1 1 190px', siloAlani.kok.style.minWidth = '0', siloAlani.kok),
      (tipAlani.kok.style.flex = '1 1 190px', tipAlani.kok.style.minWidth = '0', tipAlani.kok),
      YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 'none' } },
        YU.h('div', { stil: { display: 'flex', gap: '10px' } },
          (basAlani.kok.style.width = '158px', basAlani.kok),
          (bitAlani.kok.style.width = '158px', bitAlani.kok)
        ),
        gunDugmeleri
      )
    );

    var temizle = YU.ui.dugme({
      metin: 'Süzgeci Temizle', ikon: '#ic-filter', tur: 'sade', kucuk: true,
      onClick: function () {
        siloAlani.ayarla('');
        tipAlani.ayarla('');
        basAlani.ayarla('');
        bitAlani.ayarla('');
        gunDugmeleriTazele();
        suzgecDegisti();
      }
    });

    tabloyuCiz();

    return {
      panel: YU.ui.panel({
        baslik: 'Silo Hareketleri',
        ikon: '#ic-filter',
        sag: [sayacMetni, temizle],
        govde: [suzgecler, tabloKabi]
      }),
      siloSec: function (id) { siloAlani.ayarla(String(id)); suzgecDegisti(); }
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
        if (gecerliTarih(yeni)) YU.git('silo-durumu', { tarih: yeni, silo: param && param.silo ? param.silo : null });
      }
    });
    YU.ui.sayfaEylemleri(
      tarihAlani.kok,
      YU.ui.dugme({
        metin: 'Bugün', ikon: '#ic-calendar', tur: 'ikincil',
        onClick: function () { YU.git('silo-durumu', { tarih: YU.tarih.bugun() }); }
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

    var hareket = hareketPaneli(depo, silolar, tarih);
    kap.appendChild(hareket.panel);

    /* Üst şerit aramasından "#/silo-durumu?silo=2" ile gelinebiliyor. */
    if (param && param.silo) hareket.siloSec(param.silo);
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

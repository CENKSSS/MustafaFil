/* js/23-stok-durumu.js — Stok Durumu ekranı (Şartname §7 · SOZLESME §7).

   Şartname §5 DEMİRBAŞ: ekran bugün itibarıyla çalışır ama seçilen bir tarihe
   kadarki stok da hesaplanabilir (Tarih <= seçilen). Dökme kuru küspenin
   mevcudu basit formülle değil, siloların toplamıyla gelir; bu yüzden o satır
   "Silo Toplamı" rozetiyle işaretlenir ve silo kırılımı açılabilir. */
(function () {
  'use strict';

  var YU = window.YU;
  var KOD = 'stok-durumu';

  /* ==================================================================
     1. Küçük yardımcılar
     ================================================================== */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  /* tema.css yatay/dikey dizilim için sınıf tanımlamıyor; burada yalnızca
     yerleşim kuruluyor, renk ve ölçü kararı değişkenlerden geliyor. */
  function satirKap(hizala, bosluk) {
    return YU.h('div', {
      stil: {
        display: 'flex', flexWrap: 'wrap', minWidth: '0',
        alignItems: hizala || 'center', gap: (bosluk || 12) + 'px'
      }
    });
  }

  function sutunKap(bosluk) {
    return YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', minWidth: '0', gap: (bosluk || 6) + 'px' }
    });
  }

  function mono(metin, soluk) {
    return YU.h('span', { sinif: 'yu-mono' + (soluk ? ' yu-zayif' : ''), metin: metin });
  }

  /* Bir malzemenin paket büyüklüğü — adet karşılığı ancak bu biliniyorsa
     yazılır. Çuval 50 kg ve poşet 25 kg şartnamede tanımlı; tonluk torbanın
     kg'ı tanımlı değil, o yüzden tonluk satırında adet gösterilmez. */
  function paketKg(malzeme) {
    if (!malzeme) return 0;
    if (malzeme.OzelTip === 'CuvalKuruKuspe') return YU.hesap.CUVAL_KG;
    if (yasKuspeMi(malzeme) && /25/.test(String(malzeme.Ad || ''))) return YU.hesap.POSET_KG;
    return 0;
  }

  /* kg değerini "kg / adet" parçalarına ayırır; adet yalnızca paket
     büyüklüğü bilinen malzemede eklenir. Ton karşılığı bu ekranda hiç
     gösterilmez — her şey kg (kullanıcı isteği, 21.08.2026). */
  function olculer(kg, malzeme) {
    var v = Number(kg) || 0;
    var parcalar = [
      { sayi: YU.fmt.kg(v), birim: 'kg' }
    ];
    var paket = paketKg(malzeme);
    if (paket > 0) parcalar.push({ sayi: YU.fmt.sayi(Math.round(v / paket)), birim: 'adet' });
    return parcalar;
  }

  function olcu(kg, malzeme) {
    var parcalar = olculer(kg, malzeme);
    if (parcalar.length < 2) return YU.ui.olcu(parcalar);
    /* kg ve adet ALT ALTA (kullanıcı isteği, 24.08.2026): tek satırda
       "2.500 kg / 100 adet" dar kolonda sıkışıyordu. Adet satırı küçük ve
       soluk — kg birincil değer olarak kalır. */
    return YU.h('span', {
      stil: { display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }
    },
      YU.ui.olcu([parcalar[0]]),
      YU.h('span', {
        metin: parcalar[1].sayi + ' ' + parcalar[1].birim,
        stil: { font: '400 .8em/1.2 var(--font)', color: 'var(--metin-4)', whiteSpace: 'nowrap' }
      })
    );
  }

  function ozelMalzeme(tip) {
    var m = YU.db.malzemeler, i;
    for (i = 0; i < m.length; i++) if (m[i].OzelTip === tip) return m[i];
    return null;
  }

  function sonKayitliGun() {
    var l = YU.stok.kayitliGunler(YU.db);
    return l.length ? l[0].tarih : null;      /* liste yeniden eskiye sıralı */
  }

  /* "Kampanya Sonu" kısayolu kaldırıldı (kullanıcı isteği, 23.08.2026):
     şartnamede böyle bir düğme talebi yok, §5 yalnız tarih seçimini ister. */

  function veriVarMi() {
    var db = YU.db;
    return !!(db.devirStok.length || db.siloDevirStok.length ||
              db.gunlukHareket.length || db.kuruKuspeGunluk.length);
  }

  /* ==================================================================
     2. Hesaplar
     ================================================================== */

  /* Yaş küspenin özel tipi yok; iki satırı ayıran tek işaret adı (Şartname §2). */
  function yasKuspeMi(malzeme) {
    return String(malzeme.Ad || '').toLocaleLowerCase('tr').indexOf('yaş küspe') === 0;
  }

  /* Çift sayım kontrolü — Şartname Test 6'nın ekrandaki karşılığı.
     Dökme + çuvallı toplamı, aynı pencerede ham dökme üretimden beklenen
     toplamla karşılaştırılır:
       beklenen = devir (silolar + çuvallı) + Σ ham dökme üretim
                  − Σ dökme satış − Σ çuvallı satış
     Çuvallama üretim değil biçim değiştirmedir; çuvallanan kg iki kez sayılırsa
     gerçek toplam beklenenden büyük çıkar. */
  function ciftSayim(tarih) {
    var dokme = ozelMalzeme('DokmeKuruKuspe'), cuval = ozelMalzeme('CuvalKuruKuspe');
    if (!dokme || !cuval) return null;

    var dokmeSt = YU.stok.malzemeStok(YU.db, dokme.Id, tarih);
    var cuvalSt = YU.stok.malzemeStok(YU.db, cuval.Id, tarih);
    var silolar = YU.db.silolar, tarihler = [], siloDevir = 0, bas = null, i, devir;

    for (i = 0; i < silolar.length; i++) {
      devir = YU.stok.enSonDevir(YU.db, 'Silo', silolar[i].Id, tarih);
      siloDevir += devir ? devir.Miktar : 0;
      tarihler.push(devir ? devir.DevirTarihi : null);
    }
    tarihler.push(cuvalSt.devirTarihi || null);

    var devirAyni = true;
    for (i = 1; i < tarihler.length; i++) if (tarihler[i] !== tarihler[0]) devirAyni = false;
    for (i = 0; i < tarihler.length; i++) if (tarihler[i] && (!bas || tarihler[i] > bas)) bas = tarihler[i];

    var g = YU.db.kuruKuspeGunluk, ham = 0, dokmeSatis = 0;
    for (i = 0; i < g.length; i++) {
      if (g[i].Tarih > tarih) continue;
      if (bas && g[i].Tarih < bas) continue;
      ham += Number(g[i].UretilenDokme) || 0;
      dokmeSatis += Number(g[i].SatilanDokme) || 0;
    }

    var devirToplam = YU.yuvarla(siloDevir + cuvalSt.devir);
    /* İADE beklenene eklenir (kullanıcı direktifi, 24.08.2026): iade stoğu
       artırır ama satışı değiştirmez; formülde sayılmazsa kontrol gerçek
       bir hata yokken "Fark Var" derdi. Çuvallamanın çift sayım yasağı
       değişmedi. İade ve Manuel 0 iken formül Test 6'nın Demirbaş
       rakamlarıyla birebir aynıdır. */
    /* MANUEL (sayım düzeltmesi, M18) de beklenene eklenir: Manuel giren/çıkan
       silo toplamını (gerçek tarafı) değiştirir ama ham üretim/satış değildir;
       formül tanımasa gerçek bir hata yokken tam Manuel neti kadar "Fark Var"
       derdi (24.08.2026'da canlı testte 1.250 kg ile doğrulandı). Pencere,
       formülün geri kalanıyla aynıdır: bas ≤ Tarih ≤ tarih. */
    var manuelNet = 0, sh = YU.db.siloHareket;
    for (i = 0; i < sh.length; i++) {
      if (sh[i].HareketTipi !== 'Manuel') continue;
      if (sh[i].Tarih > tarih) continue;
      if (bas && sh[i].Tarih < bas) continue;
      manuelNet += (Number(sh[i].GirenKg) || 0) - (Number(sh[i].CikanKg) || 0);
    }
    manuelNet = YU.yuvarla(manuelNet);
    var beklenen = YU.yuvarla(devirToplam + ham - dokmeSatis - cuvalSt.satis + cuvalSt.iade + dokmeSt.iade + manuelNet);
    var gercek = YU.yuvarla(dokmeSt.mevcut + cuvalSt.mevcut);

    return {
      dokmeAd: dokme.Ad, cuvalAd: cuval.Ad,
      dokme: dokmeSt.mevcut, cuval: cuvalSt.mevcut,
      gercek: gercek, beklenen: beklenen,
      fark: YU.yuvarla(gercek - beklenen),
      tutuyor: YU.hesap.esit(gercek, beklenen),
      devirToplam: devirToplam, ham: YU.yuvarla(ham),
      dokmeSatis: YU.yuvarla(dokmeSatis), cuvalSatis: cuvalSt.satis,
      cuvalIade: cuvalSt.iade,
      dokmeIade: dokmeSt.iade,
      bas: bas, devirAyni: devirAyni
    };
  }

  /* ==================================================================
     2b. STOK HAREKETLERİ paneli (kullanıcı isteği, 25.08.2026)
     Silo Durumu'ndaki "Silo Hareketleri" panelinin malzeme karşılığı:
     aynı tarih süzgeci, aynı gün düğmeleri, aynı sayfalama dili.
     YAZDIRMAYA GİRMEZ (kullanıcı isteği) — panel yu-baski-yok taşır.
     ================================================================== */

  /* Sayfalama sabitleri ve hareketSayfaNumaralari KALDIRILDI (25.08.2026):
     Stok Hareketleri tek gün gosterdigi icin sayfa cubugu gereksizdi. */

  function hareketMalzemesi(depo, id) {
    for (var i = 0; i < depo.malzemeler.length; i++) if (depo.malzemeler[i].Id === id) return depo.malzemeler[i];
    return null;
  }

  /* Kaynak künyesi — Program Hareketleri'ndeki dille aynı: dökme ve çuvallı
     satırlar Kuru Küspe Günlük Giriş'ten otomatik yazılır, kalanlar elle. */
  /* "Kim eklemiş" (kullanıcı isteği, 25.08.2026): son DOKUNAN kişi — kayıt
     güncellenmişse güncelleyen, değilse oluşturan. Satırın kendi günü Tarih
     kolonunda yazdığı için burada yalnız saat gösterilir; dokunuş BAŞKA bir
     günde olduysa (geriye dönük düzeltme) tarih de eklenir, yoksa "16:05"
     hangi güne ait belli olmazdı. */
  function kullaniciAdiBul(depo, id) {
    if (id === null || id === undefined) return null;
    for (var i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].Id === id) return depo.kullanicilar[i].AdSoyad;
    }
    return 'Kullanıcı #' + id;
  }

  function kaydedenHucresi(depo, kayit, satirTarihi) {
    if (!kayit) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    var guncelMi = !!kayit.GuncellemeTarihi &&
      kayit.GuncellemeTarihi !== kayit.OlusturmaTarihi;
    var id = guncelMi && kayit.GuncelleyenKullaniciId !== null && kayit.GuncelleyenKullaniciId !== undefined
      ? kayit.GuncelleyenKullaniciId : kayit.OlusturanKullaniciId;
    var an = guncelMi ? kayit.GuncellemeTarihi : kayit.OlusturmaTarihi;
    var ad = kullaniciAdiBul(depo, id);
    if (!ad && !an) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    var gun = String(an || '').slice(0, 10);
    var metin = (ad || '—') + (an ? ' · ' + YU.fmt.saat(an) : '');
    if (gun && satirTarihi && gun !== satirTarihi) metin += ' · ' + YU.fmt.tarih(gun);
    return YU.h('span', {
      sinif: 'yu-zayif',
      metin: metin,
      stil: { whiteSpace: 'nowrap' },
      title: (guncelMi ? 'Son değiştiren: ' : 'Ekleyen: ') + (ad || '—') +
        (an ? ' · ' + YU.fmt.tarihSaat(an) : '')
    });
  }

  function hareketKaynagi(malzeme) {
    if (!malzeme) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    var m = malzeme.OzelTip === 'DokmeKuruKuspe' ? 'Otomatik · kuru küspe girişi'
      : malzeme.OzelTip === 'CuvalKuruKuspe' ? 'Üretim otomatik · satış elle'
      : 'Elle girildi';
    return YU.h('span', { sinif: 'yu-zayif', metin: m });
  }

  /* Satır listesi: her GunlukHareket bir satır, her DevirStok da bir satır
     (Silo Hareketleri'ndeki dille aynı — devir, bakiyenin başlangıcını
     görünür kılar). Stok kolonu YU.stok.malzemeStok'tan okunur: dökme kuru
     küspede stok siloların TOPLAMIDIR (Şartname §5 Demirbaş) ve basit
     formülle hesaplanamaz; okuma malzeme+tarih başına önbelleklenir. */
  function hareketleriHazirla(depo) {
    var sonuc = [], i, h, d;
    var onbellek = {};
    function stokAl(malzemeId, tarih) {
      var anahtar = malzemeId + '|' + tarih;
      if (!Object.prototype.hasOwnProperty.call(onbellek, anahtar)) {
        onbellek[anahtar] = YU.yuvarla(Number(YU.stok.malzemeStok(depo, malzemeId, tarih).mevcut) || 0);
      }
      return onbellek[anahtar];
    }
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      sonuc.push({ hareket: h, tarih: h.Tarih, malzemeId: h.MalzemeId, sira: h.Id || 0 });
    }
    for (i = 0; i < depo.devirStok.length; i++) {
      d = depo.devirStok[i];
      sonuc.push({ devir: d, tarih: d.DevirTarihi, malzemeId: d.MalzemeId, sira: -1 });
    }
    /* En yeni gün üstte; aynı günde malzeme sırası, devir o günün en altında. */
    sonuc.sort(function (a, b) {
      if (a.tarih !== b.tarih) return a.tarih < b.tarih ? 1 : -1;
      if (a.malzemeId !== b.malzemeId) return a.malzemeId - b.malzemeId;
      return b.sira - a.sira;
    });
    return { liste: sonuc, stokAl: stokAl };
  }

  function hareketPaneli(depo) {
    var hazir = hareketleriHazirla(depo);
    var tumu = hazir.liste;
    var sayacMetni = YU.h('span');
    var tabloKabi = YU.h('div');
    var gunAlani, sayfa = 0;

    /* Süzgeç ARALIK değil TEK GÜN (kullanıcı isteği, 25.08.2026): iki takvim
       yerine bir takvim; panel seçilen günün hareketlerini gösterir. */
    function suzulmus() {
      var gun = gunAlani.deger(), liste = [], j, h;
      for (j = 0; j < tumu.length; j++) {
        h = tumu[j];
        if (gun && h.tarih !== gun) continue;
        liste.push(h);
      }
      return liste;
    }

    function suzgecDegisti() { sayfa = 0; tabloyuCiz(); }

    function tabloyuCiz() {
      /* SAYFALAMA KALDIRILDI (kullanıcı isteği, 25.08.2026): süzgeç tek gün
         olduğu için liste zaten bir günün satırlarıdır (sekiz malzeme);
         sayfa çubuğu tek sayfayı yönetiyordu. Ne varsa hepsi listelenir. */
      var gosterilen = suzulmus(), j;
      var satirlar = [], s, malzeme, hh, iade, stok;
      for (j = 0; j < gosterilen.length; j++) {
        s = gosterilen[j];
        malzeme = hareketMalzemesi(depo, s.malzemeId);
        if (s.devir) {
          satirlar.push({
            hucreler: [
              YU.fmt.tarih(s.tarih),
              YU.h('span', { sinif: 'yu-guclu', metin: malzeme ? malzeme.Ad : ('Malzeme #' + s.malzemeId) }),
              YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
              YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
              YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
              YU.fmt.kg(Number(s.devir.Miktar) || 0),
              YU.ui.rozet('Devir', 'vurgu'),
              kaydedenHucresi(depo, s.devir, s.tarih),
              ''
            ]
          });
          continue;
        }
        hh = s.hareket;
        iade = Number(hh.Iade) || 0;
        stok = hazir.stokAl(s.malzemeId, s.tarih);
        satirlar.push({
          /* Satır tıklaması KALDIRILDI (kullanıcı isteği, 25.08.2026):
             gün penceresi artık yalnız sağdaki Detay düğmesiyle açılır —
             Silo Hareketleri'ndeki dilin aynısı. */
          hucreler: [
            YU.fmt.tarih(s.tarih),
            YU.h('span', { sinif: 'yu-guclu', metin: malzeme ? malzeme.Ad : ('Malzeme #' + s.malzemeId) }),
            iade > 0 ? '+' + YU.fmt.kg(iade) : '—',
            Number(hh.Uretim) > 0 ? '+' + YU.fmt.kg(hh.Uretim) : '—',
            Number(hh.Satis) > 0 ? '−' + YU.fmt.kg(hh.Satis) : '—',
            YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(stok) }),
            hareketKaynagi(malzeme),
            kaydedenHucresi(depo, hh, s.tarih),
            (function (t) {
              /* Normal boy (kullanıcı isteği, 25.08.2026 — "çok ufak"):
                 kucuk:true kaldırıldı, düğme 13,5px/6px yerine 14,5px/9px
                 ölçüsüne çıktı. Kolon genişliği de buna göre açıldı. */
              return YU.ui.dugme({
                metin: 'Detay', ikon: '#ic-doc', tur: 'ikincil',
                baslik: 'Günün Verisi · ' + YU.fmt.tarih(t),
                onClick: function () { YU.gunPenceresi(t); }
              });
            })(s.tarih)
          ]
        });
      }

      sayacMetni.textContent = YU.fmt.sayi(gosterilen.length) + ' satır';

      YU.bos(tabloKabi).appendChild(YU.ui.tablo({
        /* Kolon sırası kullanıcı kararıdır (25.08.2026):
           İade → Üretim → Satış → Stok → Kaynak. */
        sutunlar: [
          { baslik: 'Tarih', genislik: 100 },
          { baslik: 'Malzeme' },
          { baslik: 'İade', hiza: 'sag', mono: true, genislik: 100 },
          { baslik: 'Üretim', hiza: 'sag', mono: true, genislik: 112 },
          { baslik: 'Satış', hiza: 'sag', mono: true, genislik: 112 },
          { baslik: 'Stok', hiza: 'sag', mono: true, genislik: 128 },
          { baslik: 'Kaynak', genislik: 180 },
          { baslik: 'Kaydeden', genislik: 200 },
          { baslik: '', hiza: 'sag', genislik: 118 }
        ],
        satirlar: satirlar,
        bos: 'Bu süzgeçle eşleşen malzeme hareketi yok.',
        yapiskan: true
      }));
    }

    gunAlani = YU.ui.alan({
      etiket: 'Tarih', tip: 'tarih', deger: YU.tarih.bugun(),
      onChange: function () { gunDugmeleriTazele(); suzgecDegisti(); }
    });

    function refGun() { return gunAlani.deger() || YU.tarih.bugun(); }
    function tekGune(iso) {
      gunAlani.ayarla(iso);
      gunDugmeleriTazele(); suzgecDegisti();
    }

    var oncekiDugme = YU.ui.dugme({
      metin: 'Önceki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.tarih.ekle(refGun(), -1)); }
    });
    var bugunDugme = YU.ui.dugme({
      metin: 'Bugün', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.tarih.bugun()); }
    });
    var sonrakiDugme = YU.ui.dugme({
      metin: 'Sonraki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { tekGune(YU.tarih.ekle(refGun(), 1)); }
    });

    function gunDugmeleriTazele() {
      sonrakiDugme.disabled = refGun() >= YU.tarih.bugun();
      sonrakiDugme.title = sonrakiDugme.disabled ? 'Bugünden ileri gidilemez' : '';
    }
    gunDugmeleriTazele();

    var gunDugmeleri = YU.h('div', { stil: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
      oncekiDugme, bugunDugme, sonrakiDugme);

    var suzgecler = YU.h('div', {
      stil: { display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }
    },
      YU.h('div', { stil: { display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', flex: 'none' } },
        (gunAlani.kok.style.width = '158px', gunAlani.kok),
        YU.h('div', { stil: { display: 'flex', paddingBottom: '3px' } }, gunDugmeleri)
      )
    );

    tabloyuCiz();

    var panel = YU.ui.panel({
      baslik: 'Stok Hareketleri',
      ikon: '#ic-filter',
      sag: sayacMetni,
      govde: [suzgecler, tabloKabi]
    });
    /* Yazdırmaya GİRMEZ (kullanıcı isteği, 25.08.2026): kâğıda basılan stok
       raporu Şartname §7'deki içerikle kalır — malzeme bazında devir /
       toplam üretim / toplam satış / mevcut. Hareket dökümü ekranda durur. */
    panel.className += ' yu-baski-yok';
    return panel;
  }

  /* ==================================================================
     3. Tarih şeridi — Kuru Küspe / Malzeme Girişi ekranlarıyla aynı dil
     (kullanıcı isteği, 23.08.2026: giriş ve takip ekranları aynı aileden)
     ================================================================== */

  function tarihSeridi(d) {
    /* Kampanya bakışı: "bugün" seçili kampanyanın görünüm sonudur —
       geçmiş kampanyada kampanyanın son kayıtlı günü. */
    var bugun = YU.donem.gorunumSonu();
    var gecmisKampanya = YU.donem.gecmisMi();

    /* Seçili tarih İRİ yazılır (kullanıcı isteği, 24.08.2026 — "tarih gözle
       seçilmesi zor"). Tarih kutusu ve gün gezinme düğmeleri panel başlığına
       taşındı (kullanıcı isteği, 24.08.2026): burada yalnız iri tarih ve
       sayfa eylemleri kalır. */
    /* Gün adları kaldırıldı (kullanıcı isteği, 24.08.2026): yalnız tarih. */
    var buyukTarih = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '0' } },
      YU.h('div', {
        metin: YU.fmt.tarih(d.tarih),
        stil: {
          font: '650 20px/1.1 var(--sayi)', letterSpacing: '-.01em',
          fontVariantNumeric: 'tabular-nums', color: 'var(--metin)', whiteSpace: 'nowrap'
        }
      }),
      YU.h('div', {
        sinif: 'yu-yardim',
        metin: d.tarih === bugun ? (gecmisKampanya ? 'Kampanya sonu itibarıyla' : 'Bugün itibarıyla') : 'Bu tarih itibarıyla',
        title: 'Seçilen güne kadarki tüm hareketler ve en son devir stok hesaba katılır (Şartname §5).'
      })
    );

    return YU.h('div', {
      /* Şerit yazdırmaya girmez (kullanıcı isteği, 24.08.2026): kâğıtta tarih
         kutusu ve düğmeler bozuk basılıyordu; tarih zaten sayfa başlığında. */
      sinif: 'yu-baski-yok',
      stil: {
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        padding: '10px 16px', background: 'var(--yuzey-2)',
        border: '1px solid var(--kenar)', borderRadius: 'var(--r)'
      }
    },
      buyukTarih,
      YU.h('span', { stil: { flex: '1' } }),
      /* Malzeme Girişi düğmesi de kaldırıldı (kullanıcı isteği, 24.08.2026);
         şeritte yalnız Yazdır kaldı. Girişe sol menüden gidilir. */
      YU.ui.dugme({
        metin: 'CSV İndir', ikon: '#ic-download', tur: 'ikincil', kucuk: true,
        baslik: 'Tablodaki stok özetini Excel uyumlu CSV olarak indirir (M17)',
        onClick: function () {
          var t = YU.param().tarih;
          if (!gecerliTarih(t)) t = YU.donem && YU.donem.gorunumSonu ? YU.donem.gorunumSonu() : YU.tarih.bugun();
          var liste = YU.stok.tumMalzemeler(YU.db, t);
          var satirlar = [['Malzeme', 'Devir (kg)', 'Toplam Üretim (kg)', 'Toplam İade (kg)', 'Toplam Satış (kg)', 'Mevcut (kg)']];
          for (var i = 0; i < liste.length; i++) {
            var s = liste[i];
            /* İade, bakiye özdeşliğinden türetilir (mevcut = devir + üretim +
               iade − satış) — devir penceresi otomatik doğru kalır. Dökme kuru
               küspede mevcut silo toplamıdır ve iade zaten yasaktır: boş kalır. */
            var dokmeMi = s.malzeme && s.malzeme.OzelTip === 'DokmeKuruKuspe';
            var iadeT = dokmeMi ? null
              : YU.yuvarla((Number(s.mevcut) || 0) - (Number(s.devir) || 0) - (Number(s.uretim) || 0) + (Number(s.satis) || 0));
            satirlar.push([
              s.malzeme ? s.malzeme.Ad : 'Malzeme #?',
              YU.csvSayi(s.devir), YU.csvSayi(s.uretim),
              iadeT === null ? '' : YU.csvSayi(iadeT),
              YU.csvSayi(s.satis), YU.csvSayi(s.mevcut)
            ]);
          }
          YU.csvIndir('stok-durumu-' + t + '.csv', satirlar);
        }
      }),
      YU.ui.dugme({
        metin: 'Yazdır', ikon: '#ic-download', tur: 'birincil', kucuk: true,
        onClick: function () { window.print(); }
      })
    );
  }

  /* Tarih kutusu + gün gezinme, tablo panelinin başlığında (kullanıcı isteği,
     24.08.2026 — "tarih kısmını aşağıya koy"). */
  function tarihKontrolleri(d) {
    /* Kampanya bakışı: "bugün" seçili kampanyanın görünüm sonudur —
       geçmiş kampanyada gezinme kampanya sonunda durur. */
    var bugun = YU.donem.gorunumSonu();
    var gecmisKampanya = YU.donem.gecmisMi();

    var tarihAlan = YU.ui.alan({
      tip: 'tarih', deger: d.tarih, genislik: '148px',
      onChange: function () { git(d, { tarih: tarihAlan.girdi.value }); }
    });

    /* Düzen kullanıcı isteğiyle (24.08.2026): ÜSTTE tarih kutusu, ALTINDA
       gezinme üçlüsü; gün adı yazılmaz. */
    var dugmeler = satirKap('center', 6);
    dugmeler.appendChild(YU.ui.dugme({
      metin: 'Önceki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { git(d, { tarih: YU.tarih.ekle(d.tarih, -1) }); }
    }));
    dugmeler.appendChild(YU.ui.dugme({
      /* Bugün HEP tıklanabilir — bugündeyken de (kullanıcı isteği, 23.08.2026).
         Geçmiş kampanyada düğme kampanyanın sonuna götürür ve adı bunu söyler. */
      metin: gecmisKampanya ? 'Kampanya Sonu' : 'Bugün', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
      onClick: function () { git(d, { tarih: bugun }); }
    }));
    dugmeler.appendChild(YU.ui.dugme({
      metin: 'Sonraki Gün', kucuk: true, tur: 'ikincil',
      pasif: d.tarih >= bugun,
      baslik: d.tarih >= bugun ? (gecmisKampanya ? 'Kampanya sonundan ileri gidilemez' : 'Bugünden ileri gidilemez') : '',
      onClick: function () { git(d, { tarih: YU.tarih.ekle(d.tarih, 1) }); }
    }));
    /* Son Kayıtlı Gün düğmesi kaldırıldı (kullanıcı isteği, 24.08.2026). */

    var kap = YU.h('div', {
      sinif: 'yu-baski-yok',   /* kâğıtta kutu ve düğmeler basılmaz */
      stil: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '7px', minWidth: '0' }
    }, tarihAlan.kok, dugmeler);
    return kap;
  }

  /* 4. KPI kartları kaldırıldı — kullanıcı isteği, 23.08.2026 ("kartları
     kaldır"). Aynı rakamlar Ana Sayfa kartlarında ve alttaki tabloda var. */

  /* ==================================================================
     5. Ana tablo — malzeme bazında devir / üretim / satış / mevcut
     ================================================================== */

  function siloKirilimi(d) {
    var sutunlar = [
      { baslik: 'Silo' },
      { baslik: 'Devir', genislik: 158, hiza: 'sag', mono: true },
      { baslik: 'Giren', genislik: 158, hiza: 'sag', mono: true },
      { baslik: 'Çıkan', genislik: 158, hiza: 'sag', mono: true },
      { baslik: 'Mevcut', genislik: 158, hiza: 'sag', mono: true },
      { baslik: 'Doluluk', genislik: 140 }
    ];
    var satirlar = [], i, s, devir = 0, giren = 0, cikan = 0, mevcut = 0, doluluk;

    for (i = 0; i < d.silolar.length; i++) {
      s = d.silolar[i];
      devir += s.devir; giren += s.giren; cikan += s.cikan; mevcut += s.mevcut;
      doluluk = sutunKap(5);
      doluluk.appendChild(YU.h('div', {
        sinif: 'yu-yardim',
        metin: YU.fmt.yuzde((s.doluluk || 0) * 100) + ' · kapasite ' + YU.fmt.kgU(s.kapasite)
      }));
      doluluk.appendChild(YU.ui.cubuk(s.doluluk, s.mevcut > s.kapasite ? 'olumsuz'
        : ((s.doluluk || 0) >= 0.9 ? 'bekleyen' : 'vurgu')));
      satirlar.push([
        YU.h('span', { metin: s.silo.Ad }),
        olcu(s.devir, null), olcu(s.giren, null), olcu(s.cikan, null), olcu(s.mevcut, null),
        doluluk
      ]);
    }

    if (satirlar.length) {
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: 'Toplam' }),
        olcu(YU.yuvarla(devir), null), olcu(YU.yuvarla(giren), null),
        olcu(YU.yuvarla(cikan), null), olcu(YU.yuvarla(mevcut), null),
        YU.h('span', { sinif: 'yu-yardim', metin: 'Dökme kuru küspe stoğu' })
      ]);
    }

    var kutu = sutunKap(11);
    /* Açıklama yazısı ve Silo Durumu düğmesi kaldırıldı (kullanıcı isteği,
       24.08.2026); kırılım yalnız tabloyu gösterir. */
    kutu.appendChild(YU.ui.tablo({
      sutunlar: sutunlar, satirlar: satirlar, kompakt: true,
      bos: 'Tanımlı silo yok.'
    }));
    return kutu;
  }

  function malzemeHucresi(d, r, acKapa) {
    var ust = satirKap('center', 8);
    ust.appendChild(YU.h('span', { sinif: 'yu-guclu', metin: r.malzeme.Ad }));
    if (r.malzeme.OzelTip === 'DokmeKuruKuspe') ust.appendChild(YU.ui.rozet('Silo Toplamı', 'vurgu'));
    if (r.malzeme.OzelTip === 'CuvalKuruKuspe') ust.appendChild(YU.ui.rozet('Çuvallı', 'notr'));
    if (r.malzeme.Aktif === false) ust.appendChild(YU.ui.rozet('Pasif', 'bekleyen'));
    if (acKapa) ust.appendChild(acKapa);
    return ust;
  }

  function tabloPaneli(d) {
    /* Sütun araları açık (kullanıcı isteği, 23.08.2026 — "sıkışık kalmışlar"):
       sayı sütunları sağa yaslı olduğu için fazladan genişlik, komşu sütunla
       arasında boşluk olarak okunur. Devir Tarihi de aynı nedenle sağa yaslandı;
       yoksa soldaki Devir rakamına yapışık duruyordu. */
    /* İade kolonu ve "Stok" başlığı kullanıcı isteği (24.08.2026); iade,
       Malzeme Girişi'ndeki sırayla üretimin solunda durur. Günlük Üretim ve
       Günlük Satış seçili günün rakamlarıdır (kullanıcı isteği, 24.08.2026). */
    var sutunlar = [
      { baslik: 'Malzeme' },
      { baslik: 'Devir', genislik: 130, hiza: 'sag', mono: true },
      { baslik: 'Devir Tarihi', genislik: 115, hiza: 'sag' },
      /* Gün Başı = seçili günün hareketleri işlenmeden önceki stok; en
         sağdaki Stok gün sonunu söyler (kullanıcı isteği, 24.08.2026). */
      { baslik: 'Gün Başı', genislik: 140, hiza: 'sag', mono: true },
      { baslik: 'Toplam İade', genislik: 130, hiza: 'sag', mono: true },
      { baslik: 'Günlük Üretim', genislik: 140, hiza: 'sag', mono: true },
      { baslik: 'Günlük Satış', genislik: 140, hiza: 'sag', mono: true },
      { baslik: 'Toplam Üretim', genislik: 150, hiza: 'sag', mono: true },
      { baslik: 'Toplam Satış', genislik: 150, hiza: 'sag', mono: true },
      { baslik: 'Stok', genislik: 150, hiza: 'sag', mono: true }
    ];

    var satirlar = [], dokmeSira = -1, i, r, acKapa = null, ok = null;

    /* Seçili günün hareketi tek geçişte haritalanır (satır başına tarama yok). */
    var gunluk = {}, gh = YU.db.gunlukHareket, j;
    for (j = 0; j < gh.length; j++) {
      if (gh[j].Tarih === d.tarih) gunluk[gh[j].MalzemeId] = gh[j];
    }

    function gunlukHucre(malzeme, alan) {
      var h = gunluk[malzeme.Id];
      if (!h) return YU.h('span', { sinif: 'yu-zayif', metin: '—', title: 'Bu güne giriş yok.' });
      return olcu(Number(h[alan]) || 0, malzeme);
    }

    /* Gün başı stok: dökme için siloların gün başı toplamı (Tarih < seçilen,
       Şartname §5); basit malzemede gün sonu stoktan o günün net değişimi
       geri alınır. gunBasi + üretim + iade − satış = Stok. */
    function gunBasi(r) {
      if (r.malzeme.OzelTip === 'DokmeKuruKuspe') {
        var t = 0, silolar = YU.db.silolar, k;
        for (k = 0; k < silolar.length; k++) t += YU.stok.siloGunBasi(YU.db, silolar[k].Id, d.tarih);
        return YU.yuvarla(t);
      }
      var h = gunluk[r.malzeme.Id];
      if (!h) return r.mevcut;
      return YU.yuvarla(r.mevcut - (Number(h.Uretim) || 0) - (Number(h.Iade) || 0) + (Number(h.Satis) || 0));
    }

    for (i = 0; i < d.satirlar.length; i++) {
      r = d.satirlar[i];

      if (r.malzeme.OzelTip === 'DokmeKuruKuspe') {
        dokmeSira = i;
        ok = YU.svg('#ic-chevron', 14);
        acKapa = YU.h('span', {
          sinif: 'yu-satir-eylem', role: 'button', tabindex: '0',
          title: 'Silo kırılımını aç/kapat',
          onClick: function (e) { e.stopPropagation(); kirilimAcKapa(d); },
          onKeyDown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kirilimAcKapa(d); }
          }
        }, ok);
        d.kirilimOk = ok;
      }

      satirlar.push({
        vurgu: d.vurguId && r.malzeme.Id === d.vurguId ? 'vurgu' : null,
        hucreler: [
          malzemeHucresi(d, r, r.malzeme.OzelTip === 'DokmeKuruKuspe' ? acKapa : null),
          olcu(r.devir, r.malzeme),
          r.devirTarihi ? mono(YU.fmt.tarih(r.devirTarihi), true) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
          olcu(gunBasi(r), r.malzeme),
          /* İade her malzemede izlenir (kullanıcı direktifi, 24.08.2026).
             REVİZE: dökme kuru küspeye iade girilemez (doğrulama reddeder);
             siloya Manuel yazma davranışı kaldırıldı — Manuel yalnız Sayım
             Düzeltmesi ekranından girilir (M18). */
          olcu(r.iade, r.malzeme),
          gunlukHucre(r.malzeme, 'Uretim'),
          gunlukHucre(r.malzeme, 'Satis'),
          olcu(r.uretim, r.malzeme),
          olcu(r.satis, r.malzeme),
          olcu(r.mevcut, r.malzeme)
        ]
      });
    }

    var sar = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      bos: d.pasifGoster
        ? 'Tanımlı malzeme yok.'
        : 'Aktif malzeme yok. Pasif malzemeleri görmek için filtreyi açın.',
      yapiskan: true
    });
    /* Yazdırmada 9 kolon A4'e sığmıyordu (kullanıcı isteği, 24.08.2026):
       bu sınıf, baskıda kolon genişliklerini serbest bırakıp yazıyı küçültür
       (tema.css @media print .yu-baski-sig). Ekran görünümü değişmez. */
    sar.className += ' yu-baski-sig';

    /* Açılır alt satır YU.ui.tablo'nun sözleşmesinde yok; tablo kurulduktan
       sonra dökme satırının hemen altına eklenir. */
    var tbody = sar.querySelector('tbody');
    var trler = tbody ? tbody.querySelectorAll('tr') : [];
    if (dokmeSira >= 0 && trler.length > dokmeSira) {
      var hucre = YU.h('td', { colspan: String(sutunlar.length), stil: { background: 'var(--yuzey-2)' } },
        siloKirilimi(d));
      d.kirilimSatiri = YU.h('tr', null, hucre);
      d.kirilimSatiri.style.display = 'none';
      tbody.insertBefore(d.kirilimSatiri, trler[dokmeSira].nextSibling);
    }

    var filtre = YU.ui.dugme({
      metin: d.pasifGoster ? 'Pasif malzemeler: görünür' : 'Pasif malzemeler: gizli',
      ikon: '#ic-filter', kucuk: true, tur: 'ikincil',
      onClick: function () { git(d, { pasif: d.pasifGoster ? null : '1' }); }
    });

    /* Tarih kutusu ve gün düğmeleri panel başlığında (kullanıcı isteği,
       24.08.2026 — "tarih kısmını aşağıya koy"). Baskıda kontroller gizlenir;
       kâğıtta günü yalnız-baskı tarih etiketi söyler. */
    var tarihEtiketi = YU.h('span', {
      sinif: 'yu-yalniz-baski',
      metin: YU.fmt.tarih(d.tarih) + ' · ' + YU.fmt.gunAdi(d.tarih),
      stil: {
        font: '600 14px/1 var(--sayi)', fontVariantNumeric: 'tabular-nums',
        color: 'var(--metin-2)', whiteSpace: 'nowrap'
      }
    });

    var panel = YU.ui.panel({
      baslik: 'Malzeme Bazında Stok',
      ikon: '#ic-chart',
      dolgusuz: true,
      sag: YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
        tarihEtiketi, filtre),
      govde: sar
    });

    /* Tarih kontrolleri başlığın HEMEN SAĞINDA (kullanıcı isteği, 24.08.2026
       — "tarih kısmını en sola, başlığın sağına al"); filtre sağ uçta kalır. */
    var basEl = panel.querySelector('.yu-panel-bas');
    var baslikEl = basEl ? basEl.querySelector('.yu-panel-baslik') : null;
    if (basEl && baslikEl) {
      baslikEl.style.flex = '0 0 auto';
      basEl.insertBefore(tarihKontrolleri(d), baslikEl.nextSibling);
      var sagEl = basEl.querySelector('.yu-panel-sag');
      if (sagEl) sagEl.style.marginLeft = 'auto';
    }
    return panel;
  }

  function kirilimAcKapa(d) {
    if (!d.kirilimSatiri) return;
    var acik = d.kirilimSatiri.style.display === 'none';
    d.kirilimSatiri.style.display = acik ? '' : 'none';
    if (d.kirilimOk) d.kirilimOk.style.transform = acik ? 'rotate(90deg)' : '';
  }

  /* 6. Sağ panel (Stok Dağılımı halkası) kaldırıldı — kullanıcı isteği, 23.08.2026. */

  /* ==================================================================
     7. Alt panel — çift sayım kontrolü (Şartname Test 6)
     ================================================================== */

  function hesapOgesi(etiket, deger, tur) {
    return YU.h('div', { sinif: 'yu-hesap-oge' + (tur ? ' ' + tur : '') },
      YU.h('div', { sinif: 'yu-hesap-etiket', metin: etiket }),
      YU.h('div', { sinif: 'yu-hesap-deger', metin: deger })
    );
  }

  function hesapOk(isaret) {
    return YU.h('div', { sinif: 'yu-hesap-ok' },
      isaret ? YU.h('span', { metin: isaret }) : YU.svg('#ic-chevron', 14));
  }

  function ciftSayimPaneli(d) {
    var c = ciftSayim(d.tarih);
    if (!c) return null;

    /* .yu-hesap dikey fiş düzenidir; formül öğeleri yatay .yu-hesap-satir
       kabında yan yana dizilir. */
    var serit = YU.h('div', { sinif: 'yu-hesap' },
      YU.h('div', { sinif: 'yu-hesap-satir' },
        hesapOgesi(c.dokmeAd, YU.fmt.kg(c.dokme)),
        hesapOk('+'),
        hesapOgesi(c.cuvalAd, YU.fmt.kg(c.cuval)),
        hesapOk('='),
        hesapOgesi('Ekrandaki toplam', YU.fmt.kg(c.gercek), 'vurgu'),
        hesapOk(),
        hesapOgesi('Ham üretimden beklenen', YU.fmt.kg(c.beklenen)),
        hesapOk('='),
        hesapOgesi('Fark', YU.fmt.kg(c.fark), c.tutuyor ? 'olumlu' : 'olumsuz')
      )
    );

    /* "Beklenen = devir … + ham dökme üretim … − dökme satış …" açıklama
       satırı KALDIRILDI (kullanıcı isteği, 25.08.2026): formülün kalemleri
       zaten üstteki hesap şeridinde tek tek duruyor, cümle onları ikinci kez
       yazıyordu. HESAP DEĞİŞMEDİ — yalnız bu metin çizilmiyor. */

    var not = YU.h('div', {
      sinif: 'yu-yardim',
      metin: c.tutuyor
        ? 'Çuvallanan küspe iki kez sayılmıyor: çuvallama yeni üretim değil, biçim değiştirmedir (Şartname §4).'
        : 'Fark varsa çuvallanan küspe iki kez sayılıyor ya da bir gün eksik/fazla kaydedilmiş olabilir.'
    });

    var rozetler = satirKap('center', 6);
    if (!c.devirAyni) rozetler.appendChild(YU.ui.rozet('Devir Tarihleri Farklı', 'bekleyen'));
    rozetler.appendChild(c.tutuyor ? YU.ui.rozet('Tutuyor', 'olumlu') : YU.ui.rozet('Fark Var', 'olumsuz'));

    var govde = [serit, not];
    if (!c.devirAyni) {
      govde.push(YU.h('div', {
        sinif: 'yu-yardim',
        metin: 'Silolar ve çuvallı kuru küspe farklı devir tarihleri taşıyor; ' +
          'karşılaştırma en son devir tarihinden başlatıldığı için yaklaşıktır.'
      }));
    }

    /* Fark varsa panelin üstünde İRİ kırmızı uyarı (kullanıcı isteği,
       24.08.2026); aynı koşul üst şerit uyarılarına da düşer (10-kabuk,
       YU.ciftSayimKontrol üzerinden). */
    if (!c.tutuyor) {
      var buyukSerit = YU.ui.serit({
        tur: 'hata',
        baslik: 'Çift Sayım Tutmuyor',
        metin: 'Ekrandaki kuru küspe toplamı, ham üretimden beklenen toplamla uyuşmuyor. ' +
          'Çuvallanan küspe iki kez sayılmış ya da bir kayıt bozulmuş olabilir (Şartname Test 6).'
      });
      var seritGovde = buyukSerit.querySelector('.yu-serit-govde');
      if (seritGovde) {
        seritGovde.appendChild(YU.h('div', {
          stil: { display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }
        },
          YU.h('span', { metin: 'Fark', stil: { font: '500 14px/1.2 var(--font)', color: 'var(--metin-2)' } }),
          YU.h('span', {
            metin: (c.fark > 0 ? '+' : '') + YU.fmt.kgU(c.fark),
            stil: {
              font: '650 26px/1.1 var(--sayi)', letterSpacing: '-.02em',
              fontVariantNumeric: 'tabular-nums', color: 'var(--olumsuz)'
            }
          })
        ));
      }
      govde.unshift(buyukSerit);
    }

    return YU.ui.panel({
      baslik: 'Çift Sayım Kontrolü',
      ikon: '#ic-percent',
      sag: rozetler,
      govde: govde
    });
  }

  /* Üst şerit uyarıları için köprü (10-kabuk YU.uyarilar): fark varsa
     ünlem paneline "Çift Sayım Tutmuyor" uyarısı düşer. */
  YU.ciftSayimKontrol = function (tarih) {
    return ciftSayim(tarih || YU.tarih.bugun());
  };

  /* ==================================================================
     8. Sayfa
     ================================================================== */

  /* Tarih ve filtre adreste taşınır: bağlantı paylaşılabilir kalsın ve
     YU.yenile() aynı görünümü yeniden kursun. */
  function git(d, degisiklik) {
    var p = { tarih: d.tarih, pasif: d.pasifGoster ? '1' : null, malzeme: d.vurguId || null }, k;
    for (k in degisiklik) {
      if (Object.prototype.hasOwnProperty.call(degisiklik, k)) p[k] = degisiklik[k];
    }
    YU.git(KOD, p);
  }

  function bosDurumPaneli(d) {
    var eylemler = [YU.ui.dugme({
      metin: 'Kuru Küspe Girişi', ikon: '#ic-plus', tur: 'birincil',
      onClick: function () { YU.git('kuru-kuspe', { tarih: d.tarih }); }
    })];
    if (YU.yonetici()) {
      eylemler.push(YU.ui.dugme({
        metin: 'Devir Stok', ikon: '#ic-wallet', tur: 'ikincil',
        onClick: function () { YU.git('devir-stok'); }
      }));
    }
    return YU.ui.panel({
      baslik: 'Malzeme Bazında Stok',
      ikon: '#ic-chart',
      dolgusuz: true,
      govde: YU.ui.bosDurum({
        ikon: '#ic-chart',
        baslik: 'Henüz Stok Kaydı Yok',
        metin: 'Kampanya başı devir stok girilip günlük üretim ve satış kaydedildikçe ' +
          'malzeme bazında devir, üretim, satış ve mevcut burada listelenir.',
        eylemler: eylemler
      })
    });
  }

  function ciz(kap, param) {
    param = param || {};
    var d = {
      tarih: gecerliTarih(param.tarih) ? param.tarih : YU.donem.gorunumSonu(),   /* kampanya bakışı */
      pasifGoster: String(param.pasif || '') === '1',
      vurguId: Number(param.malzeme) || null,
      satirlar: []
    };
    var i, r;

    /* Silo Durumu / Günlük Rapor sayfa başlığından tarih şeridine taşındı —
       Kuru Küspe ve Malzeme Girişi'ndeki düzenin aynısı. */
    YU.ui.sayfaEylemleri();

    /* Panel tam genişlik: sağda boşluk kalıyordu (kullanıcı isteği,
       24.08.2026 — 1478px sınırı kaldırıldı). */
    var govde = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }
    });
    kap.appendChild(govde);

    govde.appendChild(tarihSeridi(d));

    if (!veriVarMi()) {
      govde.appendChild(bosDurumPaneli(d));
      return;
    }

    d.tumSatirlar = YU.stok.tumMalzemeler(YU.db, d.tarih);
    d.silolar = YU.stok.tumSilolar(YU.db, d.tarih);

    for (i = 0; i < d.tumSatirlar.length; i++) {
      r = d.tumSatirlar[i];
      if (r.malzeme.Aktif === false && !d.pasifGoster) continue;
      d.satirlar.push(r);
    }

    /* KPI kartları kalktı (kullanıcı isteği, 23.08.2026); tablo en üstte. */
    govde.appendChild(tabloPaneli(d));

    /* Panel sırası (kullanıcı isteği, 25.08.2026): Stok Hareketleri çift
       sayım kontrolünün ÜSTÜNDE, Çift Sayım Kontrolü sayfanın EN ALTINDA.
       Hareket paneli yazdırmaya girmez; sınıfı panelin kendisinde. */
    govde.appendChild(hareketPaneli(YU.db));

    var kontrol = ciftSayimPaneli(d);
    if (kontrol) govde.appendChild(kontrol);
  }

  YU.sayfaTanimla({
    kod: KOD,
    zemin: 'gri-duz',   /* giriş ekranlarıyla aynı: gri zemin, mavi panel */
    baslik: 'Günlük Stok Durumu',   /* "Stok Durumu" → gün bazlı görünüm adı (kullanıcı kararı, 25.08.2026) */
    altBaslik: function (param) {
      var t = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
      var don = YU.donem.aktif();
      return YU.fmt.tarih(t) + ' tarihi itibarıyla' + (don ? ' · Kampanya ' + don.ad : '');
    },
    ikon: '#ic-chart',
    grup: 'Takip',
    rol: 'Hepsi',
    ciz: ciz
  });
})();

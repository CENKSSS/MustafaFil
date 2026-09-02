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

  function mono(metin, soluk) {
    return YU.h('span', { sinif: 'yu-mono' + (soluk ? ' yu-zayif' : ''), metin: metin });
  }

  /* ADET SATIRI KALDIRILDI (kullanıcı kararı, 02.09.2026: "hiçbir yerde adet
     yazmasın"). 24.08.2026'dan beri çuvallı küspe ve 25'lik yaş küspe
     satırlarında kg'ın altına küçük bir "N adet" yazılıyordu; paket boyutunu
     bulan paketKg da onun içindi. İkisi de gitti — her hücre tek büyüklük
     gösterir: kg. Bu panel Ana Sayfa'da da aynen görünür (YU.malzemeStokPaneli),
     değişiklik iki ekranı birden kapsar.
     Ton karşılığı bu ekranda zaten gösterilmez (kullanıcı isteği, 21.08.2026). */
  function olcu(kg) {
    return YU.ui.olcu([{ sayi: YU.fmt.kg(Number(kg) || 0), birim: 'kg' }]);
  }

  function ozelMalzeme(tip) {
    var m = YU.db.malzemeler, i;
    for (i = 0; i < m.length; i++) if (m[i].OzelTip === tip) return m[i];
    return null;
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
    /* İADE ARTIK BEKLENENE EKLENMEZ (kullanıcı kararı, 26.08.2026): iade
       stoğu artırmadığı için gerçek tarafta da yok; beklenene eklenirse
       kontrol, gerçek bir hata yokken tam iade kadar "eksik" derdi
       (kullanıcı bildirimi: "10 kg eksik"). 24.08.2026'daki ekleme, iadenin
       stoğu artırdığı döneme aitti ve o kural kalktı.
       Çuvallamanın çift sayım yasağı değişmedi. Manuel 0 iken formül
       Test 6'nın Demirbaş rakamlarıyla birebir aynıdır. */
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
    var beklenen = YU.yuvarla(devirToplam + ham - dokmeSatis - cuvalSt.satis + manuelNet);
    var gercek = YU.yuvarla(dokmeSt.mevcut + cuvalSt.mevcut);

    return {
      dokmeAd: dokme.Ad, cuvalAd: cuval.Ad,
      dokme: dokmeSt.mevcut, cuval: cuvalSt.mevcut,
      gercek: gercek, beklenen: beklenen,
      fark: YU.yuvarla(gercek - beklenen),
      tutuyor: YU.hesap.esit(gercek, beklenen),
      devirToplam: devirToplam, ham: YU.yuvarla(ham),
      dokmeSatis: YU.yuvarla(dokmeSatis), cuvalSatis: cuvalSt.satis,
      bas: bas, devirAyni: devirAyni
    };
  }

  /* STOK HAREKETLERİ paneli KALDIRILDI (kullanıcı kararı, 25.08.2026 —
     sadeleştirme). Şartname §7 bu ekrana "malzeme bazında devir / toplam
     üretim / toplam satış / mevcut" der; gün gün hareket dökümü Günlük
     Rapor ekranının işidir ("tüm malzeme ve silo hareketleri", §7).
     hareketMalzemesi / kullaniciAdiBul / kaydedenHucresi / kaynakHucresi /
     hareketleriHazirla yardımcıları da yalnız bu panele hizmet ettiği için
     birlikte kaldırıldı. */

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
          var satirlar = [['Malzeme', 'Devir (kg)', 'Kamp. Toplam Üretim (kg)',
            'Kamp. Toplam İade (kg)', 'Kamp. Toplam Satış (kg)', 'Mevcut (kg)']];
          for (var i = 0; i < liste.length; i++) {
            var s = liste[i];
            /* İade DOĞRUDAN okunur (26.08.2026): eskiden bakiye özdeşliğinden
               türetiliyordu (mevcut − devir − üretim + satış), ama iade artık
               stoğa girmediği için o hesap her zaman 0 verirdi. Dökme kuru
               küspe de dâhil her malzemede gerçek iade yazılır (26.08.2026:
               dökme iade kilidi kalktı). */
            satirlar.push([
              s.malzeme ? s.malzeme.Ad : 'Malzeme #?',
              YU.csvSayi(s.devir), YU.csvSayi(s.uretim),
              YU.csvSayi(YU.yuvarla(Number(s.iade) || 0)),
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

  function malzemeHucresi(d, r) {
    var ust = satirKap('center', 8);
    /* Ad ve rozetler TEK SATIRDA (kullanıcı isteği, 26.08.2026): ortak
       satirKap sarmaya açık, burada kapatılır — yalnız bu hücre etkilenir. */
    ust.style.flexWrap = 'nowrap';
    ust.appendChild(YU.h('span', { sinif: 'yu-guclu', metin: r.malzeme.Ad, stil: { whiteSpace: 'nowrap' } }));
    /* "Silolar Toplamı" rozeti KALDIRILDI (kullanıcı isteği, 27.08.2026).
       Kural kaybolmuyor: aynı cümle malzeme adının ipucunda duruyor. */
    if (r.malzeme.OzelTip === 'DokmeKuruKuspe') {
      ust.firstChild.title = 'Dökme kuru küspe fiziksel olarak silolarda durur; stoğu ' +
        'üç silonun mevcutlarının toplamıdır, üretim/satış formülüyle hesaplanmaz (Şartname §5).';
    }
    /* "Çuvallı" rozeti KALDIRILDI (kullanıcı isteği, 28.08.2026): malzemenin
       adı "Kuru Küspe (50 Kg Çuvallı)" oldu, rozet aynı kelimeyi ikinci kez
       söylüyordu (KURAL 11.1 — durum tekrarı). */
    if (r.malzeme.Aktif === false) ust.appendChild(YU.ui.rozet('Pasif', 'bekleyen'));
    return ust;
  }

  /* Çuvallamaya giden ÇEKİŞ: dökme küspenin çuvala dönüştürülen kısmı silodan
     çekilir ve siloya "Cuvallama" tipinde ÇIKIŞ yazılır. Satış değildir, bu
     yüzden Kamp. Toplam Satış kolonuna girmez — ama silo stoğundan düşer. Dökme
     satırının stoğu siloların toplamı olduğu için (Şartname §5), bu çekiş
     görünmezse satır kolonlarıyla toplanmıyor gibi okunuyordu (kullanıcı
     tespiti, 26.08.2026). Pencere devir tarihinden seçili güne kadardır. */
  /* Yavru satır aç/kapa durumu: göz düğmesi satırı gizler/gösterir, seçim
     tarayıcıda kalıcıdır. Kapalıyken satır baskıya da girmez (display:none);
     düğmenin kendisi yu-baski-yok ile hiçbir zaman basılmaz.
     (Kaldırılmıştı, yanlış anlama düzeltildi — kullanıcı, 28.08.2026:
     "veri varsa göz + satır görünür; veri yoksa ikisi de yok".) */
  function yavruAcikMi() {
    try { return localStorage.getItem('yuYavruSatirAcik') !== '0'; } catch (e) { return true; }
  }
  function yavruAcikYaz(acik) {
    try { localStorage.setItem('yuYavruSatirAcik', acik ? '1' : '0'); } catch (e) {}
  }

  function cuvallamaCekisi(basTarih, sonTarih, yalnizGun) {
    var t = 0, sh = YU.db.siloHareket, i, h;
    for (i = 0; i < sh.length; i++) {
      h = sh[i];
      if (h.HareketTipi !== 'Cuvallama') continue;
      if (yalnizGun) { if (h.Tarih !== sonTarih) continue; }
      else {
        if (h.Tarih > sonTarih) continue;
        if (basTarih && h.Tarih < basTarih) continue;
      }
      t += Number(h.CikanKg) || 0;
    }
    return YU.yuvarla(t);
  }

  /* Stok hücresinin İPUCU (kullanıcı isteği, 26.08.2026 — "buradan hesap
     nasıl stoktaki değeri yapar"): kolonun aritmetiği adım adım yazılır.
     Ekranda yer kaplamaz, isteyen fareyi üstüne getirir (KURAL 8).
     Dökme kuru küspede çuvallama çekişi de bir adımdır; öbür malzemelerde
     üç terim vardır. İade hiçbir malzemede stoğa girmez (26.08.2026), o
     yüzden formülün içinde yok. */
  function stokIpucu(r, cuvallama) {
    /* BİÇİM (kullanıcı isteği, 28.08.2026): işaret satır başında değil
       RAKAMDA taşınır (çıkan kalem "= −500"), en alta da bütün kalemleri
       toplayan tek TOPLAM satırı yazılır: "3.000 + 100 − 500 = 2.600 kg".
       Şartname cümlesi kaldırıldı — hiçbir malzemede yazılmaz.
       Dökmede çuvallıya çevrilen kalemi 0 olsa da görünür (28.08.2026):
       satır ekranda yokken hesap dökümünde "= 0" diye durur. */
    var k = YU.fmt.kg, EKSI = '−';
    var dokme = r.malzeme.OzelTip === 'DokmeKuruKuspe';
    var cikan = function (n) { return n > 0 ? EKSI + k(n) : k(0); };
    var sat = ['Devir = ' + k(r.devir)];
    sat.push('Kamp. Toplam Üretim = ' + k(r.uretim));
    if (dokme) sat.push('Dökmeden Çuvallıya Çevrilen = ' + cikan(cuvallama));
    sat.push('Kamp. Toplam Satış = ' + cikan(r.satis));
    sat.push('Toplam = ' + k(r.devir) + ' + ' + k(r.uretim) +
      (dokme ? ' ' + EKSI + ' ' + k(cuvallama) : '') +
      ' ' + EKSI + ' ' + k(r.satis) + ' = ' + k(r.mevcut) + ' kg');
    return sat.join(String.fromCharCode(10));
  }

  function bosHucre() {
    return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
  }

  /* Yavru satırın ilgisiz hücreleri GERÇEKTEN BOŞ kalır (kullanıcı isteği,
     26.08.2026): "—" işareti "değeri yok" demek için ana satırlarda doğru,
     ama bu açıklama satırında o kolonların zaten bir karşılığı yok —
     dokuz tane tire satırı gürültüye çeviriyordu. */
  function yavruBosHucre() {
    return YU.h('span', { metin: '' });
  }

  /* Çekiş hücresi: KIRMIZI DEĞİL, ama EKSİ İŞARETLİ.
     Kırmızı hata çağrıştırdığı için kaldırılmıştı (26.08.2026) ve eksi de
     onunla birlikte gitmişti. Ama işaretsiz kalınca bu sayı, aynı kolondaki
     Kamp. Toplam Üretim ile birebir aynı görünüyor — hangisinin eklenip
     hangisinin çıkarılacağı okunamıyordu (kullanıcı bildirimi, 26.08.2026:
     "buradan hesap nasıl stoktaki 1.130.520 yapar"). İşaret geri kondu,
     renk gelmedi: kolonun aritmetiği bakışta okunur, hata hissi oluşmaz.
       Devir + Kamp. Toplam Üretim − çuvallama − Kamp. Toplam Satış = Stok */
  function cikisHucresi(kg) {
    /* Parantezli eksi (kullanıcı seçimi, 28.08.2026 — 6 örnekten 5 numara,
       "muhasebe kontra satırı"): mali tablolarda (500) eksi demektir.
       Kolon aritmetiği değişmedi: Devir + (Üretim − çekiş) − Satış = Stok.
       Rakam, satırın italik/soluk tipografisine KATILMAZ — kalem adı italik,
       değer dik durur (mizan dili). */
    var kap = YU.ui.olcu([{ sayi: '(' + YU.fmt.kg(kg) + ')', birim: 'kg' }]);
    kap.style.fontStyle = 'normal';
    kap.style.color = 'var(--metin-2)';
    return kap;
  }

  /* Ad ve rozet ALT ALTA (26.08.2026): ikisi yan yanayken uzun ad Malzeme
     kolonuna sığmayıp kelime ortasından üç satıra bölünüyordu (ölçüldü:
     satır 78px, sıradan satır 42px). Ad tek satırda kalır, rozet altına
     iner — satır 65px'e döner, kolon genişliği değişmez. */
  function altSatirBasligi() {
    /* TEK CÜMLE (kullanıcı isteği, 26.08.2026): "Üretimden Düşülür" artık
       ayrı bir rozet değil, cümlenin devamı. Rozet iki ayrı bilgi varmış
       gibi okunuyordu; oysa söylenen tek şey: bu miktar üretimden düşülür.

       "↳" karakteri yok: girintiyi ilk hücrenin CSS yamuğu gösteriyor.
       Sol dolgu 30px — hücrenin KENDİ 14px dolgusu üstene binince metin
       44px'te başlar; yamuk 32px'te bittiği için yazı 12px içeriden gelir. */
    /* AĞAÇ BAĞI — köşe çizgisi └ (kullanıcı isteği, 28.08.2026; kaynak:
       yavru-satir-ornekleri.html örnek 2). Girintiyi artık düz boşluk
       değil, ebeveyn-yavru ilişkisini GÖSTEREN bir köşe çizgisi taşır.
       İtalik/soluk yazı ve td'nin kendi dolgusu (tema.css, "muhasebe
       kontra satırı") aynen kalır — yalnız girinti aracı değişti. */
    return YU.h('span', {
      stil: { display: 'inline-flex', alignItems: 'center', minWidth: '0', whiteSpace: 'nowrap' },
      title: 'Dökme küspenin çuvala dönüştürülen kısmı silodan çekilir. Satış değildir, ' +
        'bu yüzden satış kolonuna girmez; üretimden düşülür (Şartname §4). ' +
        'Devir + Kamp. Toplam Üretim (bu eksi satır dâhil) − Kamp. Toplam Satış = Stok.'
    },
      YU.h('span', { sinif: 'yu-satir-yavru-bag', 'aria-hidden': 'true' }),
      YU.h('span', { metin: 'Dökmeden Çuvallıya Çevrilen, Üretimden Düşülür' })
    );
  }

  /* Pasif malzeme süzgeci ONAY KUTUSU (kullanıcı isteği, 26.08.2026): eskiden
     metni değişen bir düğmeydi ("Pasif malzemeler: gizli" / "…: görünür"),
     durumu ancak okununca anlaşılıyordu. Tik, açık/kapalıyı bakışta söyler.
     Etiket de düğme dilinden onay kutusu diline geçti: durum bildiren cümle
     yerine ne yapacağını söyleyen tek etiket. */
  function pasifKutusu(isaretli, degistir) {
    var kutu = YU.h('input');
    kutu.type = 'checkbox';
    kutu.checked = !!isaretli;
    kutu.addEventListener('change', function () { degistir(kutu.checked); });
    return YU.h('label', {
      sinif: 'yu-onay-cip',
      title: 'İşaretliyken pasifleştirilmiş malzemeler de listede görünür'
    }, kutu, YU.h('span', { metin: 'Pasif Malzemeleri Göster' }));
  }

  function tabloPaneli(d) {
    /* Sütun araları açık (kullanıcı isteği, 23.08.2026 — "sıkışık kalmışlar"):
       sayı sütunları sağa yaslı olduğu için fazladan genişlik, komşu sütunla
       arasında boşluk olarak okunur. Devir Tarihi de aynı nedenle sağa yaslandı;
       yoksa soldaki Devir rakamına yapışık duruyordu. */
    /* İade kolonu ve "Stok" başlığı kullanıcı isteği (24.08.2026); iade,
       Malzeme Girişi'ndeki sırayla üretimin solunda durur. Günlük Üretim ve
       Günlük Satış seçili günün rakamlarıdır (kullanıcı isteği, 24.08.2026). */
    /* Orta hiza VARSAYILAN (ortak payda, 28.08.2026) — Ana Sayfa, Stok
       Durumu, Mail PDF'i ve Excel aynı görünür; kapatan hizaOrta:false geçer. */
    var hz = d.hizaOrta === false ? 'sag' : 'orta';
    var sutunlar = [
      /* Malzeme kolonuna SABİT GENİŞLİK VERİLMEZ (26.08.2026): hücre içeriği
         nowrap olduğu için kolon zaten gerektiği kadar genişler; sabit
         değer eklemek tabloyu boşuna şişirip yatay kaydırma çıkarıyordu. */
      { baslik: 'Malzeme' },
      /* d.hizaOrta: Ana Sayfa rakamı kolonun ORTASINA ister (28.08.2026);
         bu ekran sağa yaslı kalır (KURAL 5.1). hz tanımı sutunlar'ın üstünde. */
      { baslik: 'Devir', genislik: 130, hiza: hz, mono: true },
      { baslik: 'Devir Tarihi', genislik: 115, hiza: hz },
      /* Gün Başı = seçili günün hareketleri işlenmeden önceki stok; en
         sağdaki Stok gün sonunu söyler (kullanıcı isteği, 24.08.2026). */
      { baslik: 'Gün Başı', genislik: 140, hiza: hz, mono: true },
      /* 'Kamp. Toplam' -> 'Kampanya Toplam' (kullanıcı isteği, 28.08.2026):
         kısaltma dar kolona tek satırda sığsın diye vardı; artık başlık
         gerektiğinde ALT ALTA sarıyor (yu-baslik-sarar, tema.css), o yüzden
         kısaltmaya gerek kalmadı — mail'e giden PDF'te zaten böyle
         görünüyordu, ekran da aynı dile geçti. */
      { baslik: 'Kampanya Toplam İade', genislik: 130, hiza: hz, mono: true, sinif: 'yu-baslik-sarar' },
      { baslik: 'Günlük Üretim', genislik: 140, hiza: hz, mono: true },
      { baslik: 'Günlük Satış', genislik: 140, hiza: hz, mono: true },
      { baslik: 'Kampanya Toplam Üretim', genislik: 150, hiza: hz, mono: true, sinif: 'yu-baslik-sarar' },
      { baslik: 'Kampanya Toplam Satış', genislik: 150, hiza: hz, mono: true, sinif: 'yu-baslik-sarar' },
      { baslik: 'Stok', genislik: 150, hiza: hz, mono: true }
    ];

    var satirlar = [], i, r;

    /* Seçili günün hareketi tek geçişte haritalanır (satır başına tarama yok). */
    var gunluk = {}, gh = YU.db.gunlukHareket, j;
    for (j = 0; j < gh.length; j++) {
      if (gh[j].Tarih === d.tarih) gunluk[gh[j].MalzemeId] = gh[j];
    }

    function gunlukHucre(malzeme, alan) {
      var h = gunluk[malzeme.Id];
      if (!h) return YU.h('span', { sinif: 'yu-zayif', metin: '—', title: 'Bu güne giriş yok.' });
      return olcu(Number(h[alan]) || 0);
    }

    /* Gün başı stok: dökme için siloların gün başı toplamı (Tarih < seçilen,
       Şartname §5); basit malzemede gün sonu stoktan o günün net değişimi
       geri alınır. gunBasi + üretim − satış = Stok (iade stoğa girmez,
       26.08.2026). */
    function gunBasi(r) {
      if (r.malzeme.OzelTip === 'DokmeKuruKuspe') {
        var t = 0, silolar = YU.db.silolar, k;
        for (k = 0; k < silolar.length; k++) t += YU.stok.siloGunBasi(YU.db, silolar[k].Id, d.tarih);
        return YU.yuvarla(t);
      }
      var h = gunluk[r.malzeme.Id];
      if (!h) return r.mevcut;
      return YU.yuvarla(r.mevcut - (Number(h.Uretim) || 0) + (Number(h.Satis) || 0));
    }

    for (i = 0; i < d.satirlar.length; i++) {
      r = d.satirlar[i];
      /* Altına yavru satır gelecek mi? Gelecekse ebeveynin ALT ÇİZGİSİ kalkar
         ve ikisi tek blok gibi okunur (kullanıcı isteği, 26.08.2026:
         "yavru gibi dursun"). */
      /* Yavru satır YALNIZ VERİ VARKEN çizilir (kullanıcı kararı,
         28.08.2026; 27.08'deki "hep görünsün" kararının yerine geçer).
         Çekiş 0 iken kalem kaybolmaz: stok hücresinin hesap dökümünde
         "− Dökmeden Çuvallıya Çevrilen = 0" satırı her zaman yazar. */
      var yavruVar = r.malzeme.OzelTip === 'DokmeKuruKuspe' &&
        cuvallamaCekisi(r.devirTarihi, d.tarih, false) > 0;
      satirlar.push({
        sinif: yavruVar ? 'yu-satir-yavrulu' : null,
        vurgu: d.vurguId && r.malzeme.Id === d.vurguId ? 'vurgu' : null,
        hucreler: [
          malzemeHucresi(d, r),
          olcu(r.devir),
          r.devirTarihi ? mono(YU.fmt.tarih(r.devirTarihi), true) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
          olcu(gunBasi(r)),
          /* İade her malzemede izlenir (kullanıcı direktifi, 24.08.2026).
             REVİZE (26.08.2026): dökme kuru küspeye de iade girilebilir; iade
             hiçbir malzemede stoğa girmez, yalnız raporlanır. Siloya Manuel
             yazma davranışı kaldırıldı — Manuel yalnız Sayım Düzeltmesi
             ekranından girilir (M18). */
          olcu(r.iade),
          gunlukHucre(r.malzeme, 'Uretim'),
          gunlukHucre(r.malzeme, 'Satis'),
          olcu(r.uretim),
          olcu(r.satis),
          (function () {
            var h = olcu(r.mevcut);
            /* Yerleşik title yerine ortak ipucu kutusu (kullanıcı isteği,
               28.08.2026: "hesaplama panelini biraz daha büyüt"): tarayıcı
               title'ı küçük ve biçimsiz, kutu ise büyük yazılı ve çok
               satırlı. Metin aynı stokIpucu dökümü. */
            var metin = stokIpucu(r, r.malzeme.OzelTip === 'DokmeKuruKuspe'
              ? cuvallamaCekisi(r.devirTarihi, d.tarih, false) : 0);
            if (YU.ui.metinIpucu) YU.ui.metinIpucu(h, metin);
            else h.title = metin;
            h.style.cursor = 'help';
            return h;
          })()
        ]
      });

      /* Dökme satırının hemen altına ÇUVALLIYA ÇEVRİLEN alt satırı (kullanıcı
         isteği, 26.08.2026): stok kolonu siloların toplamı olduğu için bu
         çekiş görünmeden satır kendi içinde toplanmıyordu. Yalnız çekiş
         varken çizilir; olmadığı günlerde ekranda yer kaplamaz. */
      if (r.malzeme.OzelTip === 'DokmeKuruKuspe') {
        var cekisToplam = cuvallamaCekisi(r.devirTarihi, d.tarih, false);
        if (cekisToplam > 0) {
          var cekisGun = cuvallamaCekisi(r.devirTarihi, d.tarih, true);
          /* Çekiş SATIŞ kolonundan ÜRETİM kolonuna alındı (kullanıcı isteği,
             26.08.2026): satış değil, bu yüzden satış kolonunda durması
             yanıltıyordu.

             İŞARET EKSİ KALIR. Kullanıcı "+ olsun" dedi ama Şartname §5
             (Demirbaş) dökme küspenin stoğunu siloların toplamına bağlıyor;
             çekiş silodan ÇIKAN bir miktar. Artı yazılsaydı satırın aritmetiği
             bozulurdu — ölçüldü (26.08.2026): 1.062.000 + 827.880 − 753.710
             − 2.490 = 1.133.680 = Stok; artıyla 1.138.660 çıkar, 4.980 kg
             sapar. Eksi olarak üretim kolonunda formül aynen tutar:
             Devir + (Üretim − çekiş) − Satış = Stok. */
          satirlar.push({ sinif: 'yu-satir-yavru', hucreler: [
            altSatirBasligi(),
            yavruBosHucre(), yavruBosHucre(), yavruBosHucre(), yavruBosHucre(),
            cekisGun > 0 ? cikisHucresi(cekisGun) : yavruBosHucre(),   /* Günlük Üretim */
            yavruBosHucre(),
            cikisHucresi(cekisToplam),                                 /* Kamp. Toplam Üretim */
            yavruBosHucre(), yavruBosHucre()
          ] });
        }
      }
    }

    var sar = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      bos: d.pasifGoster
        ? 'Tanımlı malzeme yok.'
        : 'Aktif malzeme yok. Pasif malzemeleri görmek için "Pasif Malzemeleri Göster" kutucuğunu işaretleyin.',
      yapiskan: true
    });
    /* Yazdırmada 9 kolon A4'e sığmıyordu (kullanıcı isteği, 24.08.2026):
       bu sınıf, baskıda kolon genişliklerini serbest bırakıp yazıyı küçültür
       (tema.css @media print .yu-baski-sig). Ekran görünümü değişmez. */
    sar.className += ' yu-baski-sig';

    /* Açılır silo kırılımı KALDIRILDI (kullanıcı isteği, 26.08.2026): dökme
       satırındaki mini ok ve altındaki gizli tablo gitti. Aynı kırılım
       Günlük Silo Durumu ekranında tam tablo olarak duruyor. */

    var filtre = pasifKutusu(d.pasifGoster, function () {
      git(d, { pasif: d.pasifGoster ? null : '1' });
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

    /* d.kontrolsuz — Ana Sayfa çağrısı (kullanıcı isteği, 25.08.2026): tarih
       HEP bugündür, tarih kutusu / gün düğmeleri / pasif süzgeci çizilmez,
       sağda yalnız "Tümünü Gör" durur. Bu ekranın kendi görünümü değişmez. */
    var panel = YU.ui.panel({
      baslik: 'Malzeme Bazında Stok',
      ikon: '#ic-chart',
      dolgusuz: true,
      sag: d.kontrolsuz
        /* Panel başlığındaki "Yazdır" KALDIRILDI (kullanıcı isteği,
           26.08.2026): yazdırma artık grafiğin altındaki ortak eylem
           şeridinden yapılıyor, panel başlığında tekrarına gerek yok.
           "Veriyi Aç" da daha önce kalkmıştı. Geriye yalnız pasif malzeme
           süzgeci kalır. */
        ? (d.pasifDegis ? pasifKutusu(d.pasifGoster, d.pasifDegis) : null)
        : YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
            tarihEtiketi, filtre),
      govde: sar
    });

    /* Tarih kontrolleri başlığın HEMEN SAĞINDA (kullanıcı isteği, 24.08.2026
       — "tarih kısmını en sola, başlığın sağına al"); filtre sağ uçta kalır.
       Kontrolsüz çağrıda (Ana Sayfa) yerine tıklanmayan tarih rozeti durur:
       gün seçilemez ama hangi güne bakıldığı başlığın yanında yazar
       (kullanıcı isteği, 25.08.2026). */
    var basEl = panel.querySelector('.yu-panel-bas');
    var baslikEl = basEl ? basEl.querySelector('.yu-panel-baslik') : null;
    if (basEl && baslikEl) {
      baslikEl.style.flex = '0 0 auto';
      basEl.insertBefore(
        d.kontrolsuz ? anaSayfaKontrolleri(d) : tarihKontrolleri(d),
        baslikEl.nextSibling
      );
      var sagEl = basEl.querySelector('.yu-panel-sag');
      if (sagEl) sagEl.style.marginLeft = 'auto';
    }

    /* GÖZ DÜĞMESİ — "Dökme Kuru Küspe" adının hemen sağında. Yavru satır
       yalnız veri varken çizildiği için (yavruVar), göz de yalnız o zaman
       vardır: veri yoksa ne satır ne göz görünür (kullanıcı, 28.08.2026). */
    var yavruTr = panel.querySelector('tr.yu-satir-yavru');
    var ebeveynTr = panel.querySelector('tr.yu-satir-yavrulu');
    var adKabi = ebeveynTr ? ebeveynTr.cells[0].firstChild : null;
    if (yavruTr && adKabi) {
      var acik = yavruAcikMi();
      var goz = YU.h('button', {
        sinif: 'yu-baski-yok', type: 'button',
        stil: {
          flex: 'none', width: '22px', height: '22px', padding: '0',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--kenar-3)', borderRadius: '50%',
          background: 'var(--yuzey)', color: 'var(--metin-3)', cursor: 'pointer'
        },
        onClick: function () { acik = !acik; yavruAcikYaz(acik); uygula(); }
      });
      var uygula = function () {
        yavruTr.style.display = acik ? '' : 'none';
        YU.bos(goz).appendChild(YU.svg(acik ? '#ic-goz' : '#ic-goz-kapali', 13));
        goz.title = acik
          ? 'Çuvallıya Çevrilen satırını gizle — kapalıyken yazdırmaya da girmez'
          : 'Çuvallıya Çevrilen satırını göster';
        goz.setAttribute('aria-label', goz.title);
      };
      uygula();
      adKabi.appendChild(goz);
    }
    return panel;
  }

  /* Ana Sayfa başlığı: tarih ROZETİ + gün gezinme üçlüsü (kullanıcı istekleri,
     25.08.2026). Tarih KUTUSU yok — gün, rozetin sağındaki üç düğmeyle değişir;
     rozet hangi güne bakıldığını yazar ("Bugün · 25.08.2026", başka güne
     gidilirse "Seçili Gün · 24.08.2026"). Bu ekranın kendi tarih kutusu ve
     gün düğmeleri olduğu gibi durur. */
  function anaSayfaKontrolleri(d) {
    var son = YU.donem.gorunumSonu();
    var ad = d.tarih === son
      ? (YU.donem.gecmisMi() ? 'Kampanya Sonu' : 'Bugün')
      : 'Seçili Gün';
    return YU.h('div', {
      stil: { display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 'none' }
    }, YU.ui.tarihRozeti(d.tarih, ad, { onSec: degistir, enFazla: son }),
      YU.ui.gunGezinme(d.tarih, degistir));

    function degistir(iso) {
      if (typeof d.tarihDegisti === 'function') d.tarihDegisti(iso);
    }
  }

  /* Ana Sayfa'nın "Malzeme Stokları" paneli bu tablonun aynısıdır (kullanıcı
     isteği, 25.08.2026). Açılışta bugünü gösterir; gün gezinme düğmeleri sayfa
     değiştirmeden paneli kendi yerinde yeniden çizer (Ana Sayfa'dan Stok
     Durumu'na atlamasın diye). Pasif malzemeler gizli kalır. */
  /* baslangicTarih — panelin açılışta göstereceği gün (Mail ile Gönder paneli
     kendi seçtiği günü böyle geçirir, 26.08.2026). Verilmezse bugün. */
  /* panelSecenek.hizaOrta — Ana Sayfa rakamları kolon ortasına ister
     (28.08.2026); Mail ve Excel bu parametreyi geçmez, eski düzen. */
  YU.malzemeStokPaneli = function (baslangicTarih, panelSecenek) {
    if (!YU.db || !veriVarMi()) return null;
    var kap = YU.h('div', { stil: { minWidth: '0' } });

    var pasifGoster = false;

    function ciz(tarih) {
      var d = {
        tarih: tarih,
        pasifGoster: pasifGoster,
        pasifDegis: function () { pasifGoster = !pasifGoster; ciz(tarih); },
        vurguId: null,
        satirlar: [],
        kontrolsuz: true,
        hizaOrta: panelSecenek ? panelSecenek.hizaOrta : undefined,   /* ham geçiş — !! varsayılanı ezerdi */
        tarihDegisti: ciz
      };
      d.tumSatirlar = YU.stok.tumMalzemeler(YU.db, tarih);
      d.silolar = YU.stok.tumSilolar(YU.db, tarih);
      for (var i = 0; i < d.tumSatirlar.length; i++) {
        if (d.tumSatirlar[i].malzeme.Aktif === false && !d.pasifGoster) continue;
        d.satirlar.push(d.tumSatirlar[i]);
      }
      /* Panelin gösterdiği gün dışarıdan okunabilsin: Excel indirme düğmesi
         ekranda hangi gün açıksa onu dışa aktarır (26.08.2026). */
      kap.setAttribute('data-tarih', tarih);
      YU.bos(kap).appendChild(tabloPaneli(d));
    }

    ciz(baslangicTarih || YU.donem.gorunumSonu());
    return kap;
  };

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
      /* Rakamlar kolon başlığının ORTASINDA — Ana Sayfa'daki "Malzeme
         Bazında Stok" tablosunun birebir aynısı (kullanıcı isteği,
         28.08.2026: "anasayfadaki yapı gibi yap"). 28.08 sabahı bu hiza
         yalnız Ana Sayfa'ya verilmişti (KURAL 5.1); kullanıcı iki ekranın
         eşitlenmesini istedi. Kolon listesi ikisinde zaten aynı. */
      hizaOrta: true,
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

    /* Çift Sayım Kontrolü sayfanın EN ALTINDA kalır. */

    var kontrol = ciftSayimPaneli(d);
    if (kontrol) govde.appendChild(kontrol);
  }

  YU.sayfaTanimla({
    kod: KOD,
    zemin: 'gri-duz',   /* giriş ekranlarıyla aynı: gri zemin, mavi panel */
    baslik: 'Günlük Stok Durumu',
    baskiBasligi: 'Malzeme Bazında Stok Raporu',   /* "Stok Durumu" → gün bazlı görünüm adı (kullanıcı kararı, 25.08.2026) */
    altBaslik: function (param) {
      var t = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
      var don = YU.donem.aktif();
      return YU.fmt.tarih(t) + ' tarihi itibarıyla' + (don ? ' · Kampanya ' + don.ad : '');
    },
    ikon: '#ic-chart',
    /* Menüden kaldırıldı (kullanıcı kararı, 25.08.2026 — sadeleştirme):
       bu ekranın panelleri Ana Sayfa'da aynen duruyor. Sayfa yaşamaya
       devam eder; Ana Sayfa'daki "Tümünü Gör" düğmesi, zil uyarıları ve
       doğrudan adres (#/stok-durumu) buraya getirir. */
    grup: null,
    rol: 'Hepsi',
    ciz: ciz
  });
})();

/* js/27-devir-stok.js — Devir Stok ekranı (yalnız Yönetici).
   Şartname §7: "İki sekme: malzeme devirleri ve silo devirleri. Kampanya başında
   bir kez girilir."  §5 v2: tekillik (MalzemeId, DevirTarihi) — aynı malzeme için
   farklı tarihlerde birden çok devir satırı olur, stokta EN SON devir kullanılır.
   SÖZLEŞME §7 · kod 'devir-stok'.

   25.08.2026 (kullanıcı isteği) — ekran tek panele indi:
     · üstte SİLO devirleri, altında MALZEME devirleri, sağ altta TEK Kaydet;
     · yeni kampanya "Onayla ve Başlat" ile YAZILMAZ — satırlar ekrana kurulur,
       kayıt yalnız Kaydet'e basınca oluşur;
     · kaydedilmemiş değişiklik varken sayfadan/pencereden çıkış engellenir. */
(function () {
  'use strict';

  var YU = window.YU;

  var TABLO_ADLARI = ['kullanicilar', 'malzemeler', 'silolar', 'devirStok', 'siloDevirStok',
                      'gunlukHareket', 'kuruKuspeGunluk', 'siloHareket', 'degisiklikLog'];

  /* Bölüm sırası: silo üstte, malzeme altta (kullanıcı isteği, 25.08.2026). */
  var TIPLER = ['Silo', 'Malzeme'];

  /* Seçili devir tarihi TEK: iki bölüm aynı kampanya devrini gösterir.
       elle       — hiç devir yokken "Elle Gir" seçildiyse tablo açılır.
       onDoldur   — { Silo:{sahipId:miktar}, Malzeme:{...} }; bir sonraki çizimde
                    alanlara yazılır ve temizlenir.
       yeniKampanya — { onceki, devret, kilitle }: Kaydet'e kadar hiçbir şey
                    yazılmaz; Kaydet başarılıysa (istenmişse) önceki kampanya
                    kilitlenir.
       acikKal    — alanlar Kaydet'e kadar açık kalır (yeni kampanya kurulumu). */
  var durum = {
    tarih: null,
    elle: false,
    onDoldur: null,
    yeniKampanya: null,
    acikKal: false
  };
  var dom = { govde: null };

  function siloMu(tip) { return tip === 'Silo'; }
  function devirTablosu(tip) { return siloMu(tip) ? YU.db.siloDevirStok : YU.db.devirStok; }
  function sahipAlani(tip) { return siloMu(tip) ? 'SiloId' : 'MalzemeId'; }
  function sahipKaynagi(tip) { return siloMu(tip) ? YU.db.silolar : YU.db.malzemeler; }
  function bolumAdi(tip) { return siloMu(tip) ? 'Silo Devirleri' : 'Malzeme Devirleri'; }
  function seciliTarih() { return durum.tarih; }

  function siralaSira(a, b) {
    var x = Number(a.Sira) || 0, y = Number(b.Sira) || 0;
    if (x !== y) return x - y;
    return (a.Id || 0) - (b.Id || 0);
  }

  function kullaniciAdi(id) {
    if (id === null || id === undefined) return null;
    var l = YU.db.kullanicilar || [], i;
    for (i = 0; i < l.length; i++) if (l[i].Id === id) return l[i].AdSoyad;
    return null;
  }

  /* Kaydetmeden çıkış engeli kabuktan gelir (YU.cikisKilidi): aynı kilit
     Kuru Küspe Girişi ve Malzeme Girişi ekranlarında da kullanılır. */
  function cikisEngeli(acik) {
    if (YU.cikisKilidi) {
      /* SERT kilit (kullanıcı isteği, 27.08.2026): menü/marka/geri tuşu dahil
         her sayfa geçişini uygulama, sekme kapatma ve yenilemeyi tarayıcı sorar. */
      YU.cikisKilidi(acik, 'Devir satırlarında kaydedilmemiş değişiklik var.', true);
    }
  }

  /* ------------------------------------------------------------------
     Devir tarihleri — iki tablonun BİRLEŞİMİ (tek panel, tek tarih)
     ------------------------------------------------------------------ */

  function devirTarihleri() {
    var harita = {}, t, i, d, o;
    for (t = 0; t < TIPLER.length; t++) {
      var tablo = devirTablosu(TIPLER[t]);
      for (i = 0; i < tablo.length; i++) {
        d = tablo[i];
        o = harita[d.DevirTarihi] || (harita[d.DevirTarihi] = { tarih: d.DevirTarihi, adet: 0, toplam: 0 });
        o.adet++;
        o.toplam = YU.yuvarla(o.toplam + (Number(d.Miktar) || 0));
      }
    }
    var liste = [], k;
    for (k in harita) if (Object.prototype.hasOwnProperty.call(harita, k)) liste.push(harita[k]);
    liste.sort(function (a, b) { return a.tarih < b.tarih ? -1 : (a.tarih > b.tarih ? 1 : 0); });
    return liste;
  }

  function tarihiHazirla() {
    if (durum.tarih) return;
    var l = devirTarihleri();
    durum.tarih = l.length ? l[l.length - 1].tarih : YU.tarih.bugun();
  }

  /* ------------------------------------------------------------------
     Önizleme — gerçek depo kirletilmeden hesaplanır
     ------------------------------------------------------------------ */

  /* Stok formülleri tek yerde (YU.stok) kalsın diye önizleme, kopya bir bellek
     deposu üzerinde aynı sorgular çalıştırılarak üretilir; formül burada
     yeniden yazılmaz. */
  function geciciDepo() {
    var g = YU.Depo({ kaynak: 'bellek', tohumla: false }), i, j, ad, hedef, kaynak;
    for (i = 0; i < TABLO_ADLARI.length; i++) {
      ad = TABLO_ADLARI[i];
      hedef = g[ad];
      kaynak = YU.db[ad] || [];
      hedef.length = 0;
      for (j = 0; j < kaynak.length; j++) hedef.push(YU.kopya(kaynak[j]));
    }
    return g;
  }

  /* miktar null ise satır silinir. */
  function geciciDevirUygula(g, tip, sahipId, tarih, miktar) {
    var tablo = siloMu(tip) ? g.siloDevirStok : g.devirStok;
    var alan = sahipAlani(tip), i, yeni;
    for (i = 0; i < tablo.length; i++) {
      if (tablo[i][alan] !== sahipId || tablo[i].DevirTarihi !== tarih) continue;
      if (miktar === null) tablo.splice(i, 1);
      else tablo[i].Miktar = YU.yuvarla(miktar);
      return;
    }
    if (miktar === null) return;
    yeni = {
      Id: g.yeniId(siloMu(tip) ? 'SiloDevirStok' : 'DevirStok'),
      DevirTarihi: tarih,
      Miktar: YU.yuvarla(miktar),
      OlusturanKullaniciId: null,
      OlusturmaTarihi: null
    };
    yeni[alan] = sahipId;
    tablo.push(yeni);
  }

  function mevcutHaritasi(depo, tip) {
    var harita = {}, liste, i;
    if (siloMu(tip)) {
      liste = YU.stok.tumSilolar(depo);
      for (i = 0; i < liste.length; i++) harita[liste[i].silo.Id] = liste[i].mevcut;
    } else {
      liste = YU.stok.tumMalzemeler(depo);
      for (i = 0; i < liste.length; i++) harita[liste[i].malzeme.Id] = liste[i].mevcut;
    }
    return harita;
  }

  /* ------------------------------------------------------------------
     Önceki kampanyadan devret — Türk ERP'lerdeki devir işlemi kalıbı:
     açılış rakamları elle yazılmaz, önceki dönemin kapanışından üretilir,
     kullanıcı kontrol edip kaydeder (kullanıcı isteği, 21.08.2026).
     ------------------------------------------------------------------ */

  function oncekiKampanya(sinirTarih) {
    var l = YU.donem.liste(), sinir = sinirTarih || YU.tarih.bugun(), enSon = null, i;
    for (i = 0; i < l.length; i++) {
      if (l[i].bit < sinir && (!enSon || l[i].bit > enSon.bit)) enSon = l[i];
    }
    return enSon;
  }

  /* Kapanış stokları = kapanış günü itibarıyla hesaplanan mevcutlar.
     Malzeme tarafında dökme kuru küspe atlanır: onun açılışı SİLO devirlerinden
     gelir (Şartname §5). */
  function kapanisStoklari(tip, kapanisTarihi) {
    var harita = {}, liste, i;
    if (siloMu(tip)) {
      liste = YU.stok.tumSilolar(YU.db, kapanisTarihi);
      for (i = 0; i < liste.length; i++) harita[liste[i].silo.Id] = YU.yuvarla(liste[i].mevcut);
    } else {
      liste = YU.stok.tumMalzemeler(YU.db, kapanisTarihi);
      for (i = 0; i < liste.length; i++) {
        if (!liste[i].malzeme || liste[i].malzeme.OzelTip === 'DokmeKuruKuspe') continue;
        harita[liste[i].malzeme.Id] = YU.yuvarla(liste[i].mevcut);
      }
    }
    return harita;
  }

  function ikiTarafKapanis(kapanisTarihi) {
    return { Silo: kapanisStoklari('Silo', kapanisTarihi), Malzeme: kapanisStoklari('Malzeme', kapanisTarihi) };
  }

  function devret(onceki, tarihOner) {
    /* Düğme doğrudan çalışmaz; önce ne yapacağını anlatan onay çıkar (kullanıcı
       isteği, 25.08.2026). Doldurma yalnız ekranı değiştirir, depoya Kaydet'e
       basılana kadar hiçbir şey yazılmaz. */
    YU.ui.onay({
      baslik: 'Önceki Kampanyadan Devret',
      /* Metin kısaldı (kullanıcı isteği, 01.09.2026: "çok uzun yazmışsın,
         sade yalın net bilgi ver"). Üç bilgi kaldı: nereden geliyor, ne
         oluyor, kaydedilmiyor. "Satırları Doldur" düğmesi zaten ne
         yapılacağını söylüyor (KURAL 9, KURAL 11). */
      metin: onceki.ad + ' kapanışı (' + YU.fmt.tarih(onceki.bit) + ') satırlara ' +
        'yazılır, eski miktarların üzerine geçer. Kaydet\'e basmadan hiçbir şey saklanmaz.',
      onayMetni: 'Satırları Doldur'
    }).then(function (ok) {
      if (!ok) return;
      durum.onDoldur = ikiTarafKapanis(onceki.bit);
      durum.elle = true;
      durum.acikKal = true;
      if (tarihOner) durum.tarih = YU.tarih.ekle(onceki.bit, 1);
      govdeyiCiz();
      YU.ui.bildir('Kampanya ' + onceki.ad + ' kapanışı (' + YU.fmt.tarih(onceki.bit) +
        ') satırlara dolduruldu. Miktarları kontrol edip Kaydet\'e basın.', 'bilgi');
    });
  }

  /* ------------------------------------------------------------------
     Tarih bloğu — panelin üst şeridi: kampanya devri çipleri + eylemler
     ------------------------------------------------------------------ */

  function tarihBlogu() {
    var tarih = seciliTarih();

    /* Devir tarihi çipleri KALDIRILDI (kullanıcı kararı, 25.08.2026): aynı
       seçim hem burada hem Kampanya Yönetimi listesinde yapılıyordu; iki
       kapılı seçim ileride tutarsızlık üretir. Kampanya artık YALNIZ üstteki
       Kampanya Yönetimi listesinden seçilir. */
    var kilitliAd = kilitliKampanya(tarih);
    var onceki = oncekiKampanya(tarih);
    /* İkon KALDIRILDI ve yazı uzadı (kullanıcı isteği, 01.09.2026):
       "solundaki ikonu da kaldır", "Önceki Kampanyadan Devretmek için
       tıklayın yazısı olsun". Boş durum panelindeki aynı adlı düğme
       (bosDurumPaneli) DEĞİŞMEDİ — orası ayrı bir ekran hâli. */
    var devretDugme = onceki ? YU.ui.dugme({
      metin: 'Önceki Kampanyadan Devretmek İçin Tıklayın', tur: 'ikincil',
      baslik: kilitliAd
        ? kilitliAd + ' kampanyası kilitli — önce kilidi açın'
        : 'Kampanya ' + onceki.ad + ' kapanışını (' + YU.fmt.tarih(onceki.bit) + ') satırlara doldurur',
      pasif: !!kilitliAd,
      onClick: function () { devret(onceki, false); }
    }) : null;

    /* İKİ YÖNLENDİRME CÜMLESİ KALDIRILDI (kullanıcı isteği, 31.08.2026 ·
       KURAL 11): "Kampanya seçimi üstteki Kampanya Yönetimi listesinden
       yapılır." ve "… tarihinde devir kaydı yok; girilen satırlar yeni
       kampanya devri olarak açılır." Kampanya seçimi zaten üstteki listede
       görünüyor; yeni kampanya kurulurken de "Yeni Kampanya Kaydedilmeyi
       Bekliyor" şeridi aynı şeyi tam olarak söylüyor.
       Şerit yalnız devret düğmesi için durur; düğme yoksa hiç çizilmez. */
    if (!devretDugme) return null;

    /* Şerit daraldı: 35 px'lik düğme için 68 px yer kaplıyordu, dikey dolgu
       16 -> 7 px ile 50 px'e indi (kullanıcı isteği, 01.09.2026:
       "üst ve alt kenarlarını daralt, çok alan tanınmış").
       AYRI ŞERİT KALKTI (kullanıcı isteği, 01.09.2026 — son adım: "Silo
       Devirleri ile aynı satırda olsun"). Düğme kendi bandında duruyordu;
       çizgisi kaldırıldı, payları 16 px'ten sıfıra kadar kısıldı, sonunda
       band büsbütün gereksizleşti. Artık "Silo Devirleri" başlık satırının
       sağ ucunda oturuyor — arada boşluk kalmadı, panel de bir satır kısaldı.
       Bu işlev artık SARMALAYICI DEĞİL, düğmenin kendisini döndürür. */
    return devretDugme;
  }

  /* Kampanya adı kabuğun dönem listesinden okunur; adlandırma kuralı orada
     tanımlı, burada tekrarlanmaz. */
  function kampanyaAdi(iso) {
    var l = YU.donem.liste(), i;
    for (i = 0; i < l.length; i++) {
      if (l[i].bas <= iso && iso <= l[i].bit) return l[i].ad;
    }
    return null;
  }

  /* Bir devir tarihinin kampanyası kilitliyse adını döndürür. Servis zaten
     kilitli kampanyaya yazmayı reddediyor (04-servis devirUpsert, KILIT);
     ekran da düzenlemeyi baştan kapatır ki kullanıcı boşuna miktar yazmasın. */
  function kilitliKampanya(iso) {
    var ad = iso ? kampanyaAdi(iso) : null;
    if (!ad || !YU.servis || !YU.servis.kampanyaKilitDurumu) return null;
    return YU.servis.kampanyaKilitDurumu(YU.db, ad) ? ad : null;
  }

  function donemBul(ad) {
    var l = YU.donem.liste(), i;
    for (i = 0; i < l.length; i++) if (l[i].ad === ad) return l[i];
    return null;
  }

  /* Kampanyaya tıklanınca hangi devir tarihi açılacak: kampanya aralığına düşen
     EN ERKEN devir tarihi; yoksa kampanya başlangıcı. */
  function donemDevirTarihi(dn) {
    var en = null, t, i, tarih;
    for (t = 0; t < TIPLER.length; t++) {
      var tablo = devirTablosu(TIPLER[t]);
      for (i = 0; i < tablo.length; i++) {
        tarih = tablo[i].DevirTarihi;
        if (tarih < dn.bas || tarih > dn.bit) continue;
        if (!en || tarih < en) en = tarih;
      }
    }
    return en || dn.bas;
  }

  /* ------------------------------------------------------------------
     Düzenleme tablosu
     ------------------------------------------------------------------ */

  /* Bir kalemin EN GÜNCEL devir tarihi (kullanıcı kararı, 25.08.2026): stok
     hesabı "en son devir"i kullandığı için, geçmiş bir devir satırına
     bakarken daha yeni bir devrin varlığı satırda görünür. */
  function sonDevirTarihi(tip, sahipId) {
    var tablo = devirTablosu(tip), alan = sahipAlani(tip), en = null, i;
    for (i = 0; i < tablo.length; i++) {
      if (tablo[i][alan] !== sahipId) continue;
      if (!en || tablo[i].DevirTarihi > en) en = tablo[i].DevirTarihi;
    }
    return en;
  }

  function sahipSatirlari(tip, tarih) {
    var kaynak = sahipKaynagi(tip), tablo = devirTablosu(tip), alan = sahipAlani(tip);
    var kayitlar = {}, i, s;
    for (i = 0; i < tablo.length; i++) {
      if (tablo[i].DevirTarihi === tarih) kayitlar[tablo[i][alan]] = tablo[i];
    }
    var liste = [];
    for (i = 0; i < kaynak.length; i++) {
      s = kaynak[i];
      /* Pasif kayıt yalnız o tarihte devri varsa görünür: geçmiş kampanyanın
         satırı gizlenirse düzeltilemez, ama yeni devir de açılmamalı (D12). */
      if (s.Aktif === false && !kayitlar[s.Id]) continue;
      liste.push({ sahip: s, kayit: kayitlar[s.Id] || null });
    }
    liste.sort(function (a, b) { return siralaSira(a.sahip, b.sahip); });
    return liste;
  }

  /* Satır eylem düğmesi bu ekranda İRİ durur (kullanıcı isteği, 25.08.2026):
     14px ikon tabloda kayboluyordu. */
  function eylemDugmesi(ikon, baslik, onClick, tehlike) {
    return YU.h('span', {
      sinif: 'yu-satir-eylem yu-satir-eylem-buyuk' + (tehlike ? ' tehlike' : ''),
      role: 'button', tabindex: '0', title: baslik, 'aria-label': baslik,
      onClick: onClick,
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }
    }, YU.svg(ikon, 18));
  }

  /* Kilitli kampanyada panelin başındaki şerit. */
  function kilitSeridi(kilitliAd) {
    if (!kilitliAd) return null;
    var dn = donemBul(kilitliAd);
    var ayar = {
      tur: 'hata', ikon: '#ic-kilit',
      baslik: kilitliAd + ' Kampanyası Kilitli',
      metin: 'Bu kampanyanın devir satırları değiştirilemez. Değiştirmek için önce kilidi açın.'
    };
    if (dn) ayar.eylem = { metin: 'Kilidi Aç', ikon: '#ic-kilit-acik', onClick: function () { kilidiAcIste(dn); } };
    return YU.h('div', { stil: { padding: '14px 18px 0' } }, YU.ui.serit(ayar));
  }

  /* Bir bölümün (silo ya da malzeme) tablosunu kurar; alanları ortak listeye
     ekler — Kaydet iki bölümü birden yazar. */
  function bolumTablosu(tip, tarih, kilitliAd, alanlar, canliTazele) {
    var satirVerisi = sahipSatirlari(tip, tarih);
    var satirlar = [], i;
    var bolumAlanlari = [];

    for (i = 0; i < satirVerisi.length; i++) {
      (function (v) {
        var sahip = v.sahip, kayit = v.kayit;

        /* Dökme kuru küspenin devri TÜRETİLMİŞTİR: silo devirlerinin
           toplamıdır (Şartname §5 KRİTİK). Servis katmanı silo devri
           yazılırken bu satırı kendiliğinden eşitler; elle düzenleme
           doğrulamada reddedilir. Satır bu yüzden kalem yerine silo
           işareti gösterir ve nereden geldiğini hücrede söyler (KURAL 8). */
        var turetilmis = !siloMu(tip) && sahip.OzelTip === "DokmeKuruKuspe";

        var alan = YU.ui.alan({
          tip: 'sayi', sag: 'kg', genislik: 170,
          deger: kayit ? Number(kayit.Miktar) : '',
          yerTutucu: kayit ? '' : 'devir yok',
          onInput: function () { canliTazele(); }
        });
        /* Kutu hücrenin SAĞINA yaslanır (kullanıcı isteği, 27.08.2026): blok
           kutu solda kalıyor, dökme satırının "devir yok · silo devirlerinin
           toplamı" gösterimi sağda duruyordu — kolon ikiye yarık görünüyordu. */
        alan.kok.style.marginLeft = 'auto';
        var alanKaydi = { tip: tip, sahip: sahip, kayit: kayit, alan: alan, tr: null, ac: null };
        alanlar.push(alanKaydi);
        bolumAlanlari.push(alanKaydi);

        /* "Mevcut: … kg" satırı KALDIRILDI (kullanıcı isteği, 31.08.2026):
           "devir zaten başlangıç mevcudu demek". Hücrede yalnız ad kalır. */
        var adHucre = YU.h('div', null,
          YU.h('div', { sinif: 'yu-guclu', metin: sahip.Ad },
            sahip.Aktif === false ? YU.h('span', { stil: { marginLeft: '8px' } }, YU.ui.rozet('Pasif', 'notr')) : null)
        );

        /* SON DOKUNUŞ gösterilir (kullanıcı bildirimi, 25.08.2026): devir
           düzeltilince kolon güncelleyeni ve anını söyler; düzeltilmemişse
           oluşturanı. Kimin ne zaman ilk girdiği ipucunda durur — devir
           tarihi değişmez, değişen "kim en son dokundu" bilgisidir. */
        var kullaniciHucre;
        if (!kayit) {
          kullaniciHucre = YU.h('span', { sinif: 'yu-zayif', metin: '—' });
        } else {
          var duzeltildi = !!kayit.GuncellemeTarihi;
          var kim = duzeltildi ? kayit.GuncelleyenKullaniciId : kayit.OlusturanKullaniciId;
          var an = duzeltildi ? kayit.GuncellemeTarihi : kayit.OlusturmaTarihi;
          kullaniciHucre = YU.h('div', null,
            YU.h('div', { metin: kullaniciAdi(kim) || 'bilinmiyor' }),
            an ? YU.h('div', { sinif: 'yu-yardim', metin: YU.fmt.tarihSaat(an) }) : null,
            duzeltildi ? YU.h('div', {
              sinif: 'yu-yardim',
              stil: { color: 'var(--bekleyen)', marginTop: '2px' },
              metin: 'düzeltildi'
            }) : null
          );
          if (duzeltildi) {
            kullaniciHucre.title = 'İlk giren: ' + (kullaniciAdi(kayit.OlusturanKullaniciId) || 'bilinmiyor') +
              (kayit.OlusturmaTarihi ? ' · ' + YU.fmt.tarihSaat(kayit.OlusturmaTarihi) : '');
          }
        }

        /* Miktar YERİNDE düzenlenir: kayıtlı değerin yanındaki kalem, aynı
           hücrede giriş alanını açar. Alan hep kurulur, yalnız gizli durur. */
        /* Devir tarihi kolonu DURUR (kullanıcı kararı, 25.08.2026): devirler
           değiştirilebildiği için satırda hangi tarihin geçerli olduğu
           görünmelidir. */
        var satirTarihi = kayit ? kayit.DevirTarihi : tarih;
        var sonDevir = sonDevirTarihi(tip, sahip.Id);
        var sonDevirSatiri = (sonDevir && satirTarihi && sonDevir > satirTarihi)
          ? YU.h('div', {
              sinif: 'yu-yardim',
              stil: { whiteSpace: 'nowrap' },
              title: 'Stok hesabı en son devri kullanır: ' + YU.fmt.tarih(sonDevir),
              metin: 'son devir: ' + YU.fmt.tarih(sonDevir)
            })
          : null;
        var tarihHucre = kayit
          ? YU.h('div', null,
              YU.h('div', { stil: { whiteSpace: 'nowrap' }, metin: YU.fmt.tarih(kayit.DevirTarihi) }),
              sonDevirSatiri)
          /* "Kayıt yok — girilirse yeni satır açılır" cümlesi KALDIRILDI
             (kullanıcı isteği, 31.08.2026): hücrede yalnız tarih durur.
             Aynı bilgiyi bir sağdaki "KAYITLI DEVİR (KG)" sütunu zaten
             "devir yok" diye söylüyordu (KURAL 8 · KURAL 11). Cümle iki
             satıra sarıyor ve satırı 18 px uzatıyordu.
             "son devir: …" satırı DURUYOR — o bir tarih, yönlendirme değil. */
          : YU.h('div', null,
              YU.h('div', { stil: { whiteSpace: 'nowrap' }, metin: tarih ? YU.fmt.tarih(tarih) : '—' }),
              sonDevirSatiri
            );

        /* Sayısal hücre tek satırda kalır (KURAL 10.1). */
        var kayitliDeger = kayit
          ? YU.h('span', { sinif: 'yu-mono', stil: { whiteSpace: 'nowrap' }, metin: YU.fmt.kg(kayit.Miktar) + ' kg' })
          : YU.h('span', {
              sinif: 'yu-zayif', stil: { whiteSpace: 'nowrap' },
              title: 'Bu tarihte kayıt yok — miktar girilirse yeni devir satırı açılır',
              metin: 'devir yok'
            });
        /* Rakamın nereden geldiği tablonun altına dipnot olarak değil,
           hücrenin kendisine yazılır (KURAL 8). */
        var turetilmisNot = turetilmis
          ? YU.h('div', {
              sinif: 'yu-yardim',
              stil: { whiteSpace: 'nowrap', textAlign: 'right', marginTop: '2px' },
              metin: 'silo devirlerinin toplamı'
            })
          : null;
        var duzenlemeKap = YU.h('div', { stil: { display: 'none' } }, alan.kok);
        var gosterimKap, kayitliHucre;

        function gosterimiTazele() {
          var ham = String(alan.girdi.value).trim();
          var deger = alan.deger();
          var eski = kayit ? Number(kayit.Miktar) || 0 : null;
          var bekleyen = ham !== '' && isFinite(deger) && (eski === null || !YU.hesap.esit(deger, eski));
          if (bekleyen) {
            kayitliDeger.className = 'yu-mono';
            kayitliDeger.style.color = 'var(--bekleyen)';
            kayitliDeger.textContent = YU.fmt.kg(deger) + ' kg';
            kayitliDeger.title = 'Kaydedilmedi · kayıtlı değer: ' + (eski === null ? 'yok' : YU.fmt.kg(eski) + ' kg');
          } else {
            kayitliDeger.style.color = '';
            kayitliDeger.title = '';
            if (kayit) {
              kayitliDeger.className = 'yu-mono';
              kayitliDeger.textContent = YU.fmt.kg(kayit.Miktar) + ' kg';
            } else {
              kayitliDeger.className = 'yu-zayif';
              kayitliDeger.textContent = 'devir yok';
            }
          }
        }

        /* Boş alana tıklamak alanı kapatır; yazılan miktar SİLİNMEZ, bekler.
           Yeni kampanya kurulumunda (durum.acikKal) alan Kaydet'e kadar AÇIK
           kalır — kullanıcı isteği, 25.08.2026. */
        function disTiklama(e) {
          if (!document.body.contains(alan.girdi)) { duzenlemeyiKapat(false); return; }
          if (kayitliHucre && kayitliHucre.contains(e.target)) return;
          duzenlemeyiKapat(false);
        }

        function duzenlemeyiAc() {
          gosterimKap.style.display = 'none';
          duzenlemeKap.style.display = 'block';
          if (!durum.acikKal) document.addEventListener('mousedown', disTiklama, true);
        }
        function duzenlemeyiKapat(geriAl) {
          if (durum.acikKal) return;   /* kurulum bitene kadar kapanmaz */
          document.removeEventListener('mousedown', disTiklama, true);
          if (geriAl) {
            alan.ayarla(kayit ? Number(kayit.Miktar) : '');
            canliTazele();
          }
          duzenlemeKap.style.display = 'none';
          gosterimKap.style.display = 'flex';
          gosterimiTazele();
        }
        alan.girdi.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { e.preventDefault(); duzenlemeyiKapat(true); }
          else if (e.key === 'Enter') { e.preventDefault(); duzenlemeyiKapat(false); }
        });

        gosterimKap = YU.h('div', {
          stil: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }
        },
          kayitliDeger,
          turetilmis
            ? YU.h('span', {
                sinif: 'yu-satir-eylem yu-satir-eylem-buyuk',
                stil: { opacity: '.5', cursor: 'default' },
                title: 'Silo devirlerinin toplamı — elle değiştirilmez. Silo devrini düzeltirseniz bu satır kendiliğinden güncellenir (Şartname §5).'
              }, YU.svg('#ic-building', 18))
            : kilitliAd
            ? YU.h('span', {
                sinif: 'yu-satir-eylem yu-satir-eylem-buyuk',
                stil: { opacity: '.45', cursor: 'default' },
                title: kilitliAd + ' kampanyası kilitli — düzenlemek için kilidi açın'
              }, YU.svg('#ic-kilit', 18))
            : eylemDugmesi('#ic-pencil', kayit ? 'Miktarı Düzenle' : 'Miktar Gir', duzenlemeyiAc, false)
        );

        kayitliHucre = YU.h('div', null, gosterimKap, turetilmisNot, duzenlemeKap);
        /* Türetilmiş satır hiçbir akışta açılmaz: toplu doldurma da bu satıra
           dokunamaz, dolayısıyla "değişen satırlar" listesine hiç girmez. */
        if (!turetilmis) alanKaydi.ac = duzenlemeyiAc;

        satirlar.push([adHucre, tarihHucre, kayitliHucre, kullaniciHucre]);
      })(satirVerisi[i]);
    }

    var tablo = YU.ui.tablo({
      sik: false,
      /* Başlık şeridi vurgulu varyant (27.08.2026) — bkz. tema.css. */
      sinif: 'yu-tablo-baslik-guclu',
      /* Devir Tarihi ORTALI (kullanıcı isteği, 01.09.2026: "devir tarihi
         kısmına da aynısını yap") — Kampanya Yönetimi'ndeki Kayıtlı Gün /
         Durum kolonlarıyla ve Ana Sayfa tablosuyla aynı yapı.
         Son Dokunuş kolonuna yu-devir-son-kolon: sol dolgusu artar, böylece
         "Kayıtlı Devir (Kg)" ile arasındaki 32 px'lik dar aralık açılır
         (ölçüldü; ölçü css/tema.css içindeki aynı adlı kuralda). */
      sutunlar: [
        { baslik: siloMu(tip) ? 'Silo' : 'Malzeme' },
        { baslik: 'Devir Tarihi', genislik: 170, hiza: 'orta' },
        { baslik: 'Kayıtlı Devir (Kg)', hiza: 'sag', genislik: 280 },
        { baslik: 'Son Dokunuş', genislik: 240, sinif: 'yu-devir-son-kolon' }
      ],
      dolgu: '8px 16px',
      satirlar: satirlar,
      bos: 'Gösterilecek ' + (siloMu(tip) ? 'silo' : 'malzeme') + ' yok.'
    });

    var trler = tablo.querySelectorAll('tbody tr');
    for (i = 0; i < bolumAlanlari.length && i < trler.length; i++) bolumAlanlari[i].tr = trler[i];

    return tablo;
  }

  /* ayracli: baslik kendi ust cizgisini tasir — bir onceki bolumden ayrilir.
     ONCEDEN AYRI BIR ARA BLOK VARDI ve kullanici "garip bosluk, kotu
     gozukuyor" dedi (01.09.2026). Sebebi olculdu: silo tablosunun alti ile
     "Malzeme Devirleri" yazisi arasi 63 px'ti ve aradaki cizgi var(--ayrac)
     ile (%10 saydam) ciziliyordu — pratikte gorunmuyordu, geriye bos bir
     bant kaliyordu. Cizgi artik basligin kendi ust kenarligidir, rengi
     var(--kenar-3) ve ara 32 px. */
  /* sag: başlık satırının SAĞ ucuna oturan öge (kullanıcı isteği,
     01.09.2026: "Silo Devirleri ile aynı satırda olsun"). "Önceki
     Kampanyadan Devretmek İçin Tıklayın" düğmesi buraya gelir; eskiden
     başlığın üstünde ayrı bir band vardı.
     Dikey pay 16 -> 8 px: satır artık 35 px'lik düğmeyi taşıyor, eski payla
     birlikte şişerdi. Başlık yazısı ve ikon aynı ölçüde. */
  function bolumBasligi(tip, ayracli, sag) {
    return YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: (ayracli ? '18px' : '8px') + ' 18px 2px',
        borderTop: ayracli ? '1px solid var(--kenar-3)' : null,
        font: '600 16px/1.2 var(--font)', color: 'var(--metin)'
      }
    },
      YU.h('span', { stil: { display: 'flex', color: 'var(--vurgu)' } }, YU.svg(siloMu(tip) ? '#ic-building' : '#ic-chart', 17)),
      YU.h('span', { metin: bolumAdi(tip) }),
      /* Esneyen boşluk: sağdaki öge panelin sağ kenarına yaslanır. */
      sag ? YU.h('div', { stil: { flex: '1', minWidth: '8px' } }) : null,
      sag || null
    );
  }

  function duzenlemePaneli() {
    var tarih = seciliTarih();
    var kilitliAd = kilitliKampanya(tarih);
    var alanlar = [];

    var sayacMetin = YU.h('div', { stil: { font: '500 14px/1.3 var(--font)', color: 'var(--metin-2)' } });
    var kaydetDugmesi = YU.ui.dugme({
      metin: 'Kaydet', ikon: '#ic-wallet', tur: 'birincil',
      onClick: function () { kaydetmeyiBaslat(alanlar); }
    });
    var geriDugmesi = YU.ui.dugme({
      /* 'sade' iken görünmüyordu (kullanıcı isteği, 25.08.2026): çerçeveli
         ikincil düğme + alt şeridin iri ölçüsü. */
      metin: 'Değişiklikleri Geri Al', ikon: '#ic-swap', tur: 'ikincil',
      sinif: 'yu-dugme-vurgulu',
      onClick: function () {
        /* Yeni kampanya kurulumu atılıyorsa tarih de geri alınır: yoksa ekran
           hiç kaydı olmayan bir günde "devir yok" satırlarıyla kalıyordu. */
        if (durum.yeniKampanya) durum.tarih = null;
        durum.acikKal = false;
        durum.yeniKampanya = null;
        durum.onDoldur = null;
        govdeyiCiz();
      }
    });

    function canliTazele() {
      var degisen = 0, i, a, ham, deger, farkli;
      for (i = 0; i < alanlar.length; i++) {
        a = alanlar[i];
        ham = String(a.alan.girdi.value).trim();
        deger = a.alan.deger();
        if (a.kayit) {
          farkli = ham !== '' && (!isFinite(deger) || !YU.hesap.esit(deger, Number(a.kayit.Miktar) || 0));
        } else {
          farkli = ham !== '';
        }
        if (farkli) degisen++;
        if (a.tr) a.tr.style.boxShadow = farkli ? 'inset 3px 0 0 var(--bekleyen)' : '';
      }
      sayacMetin.textContent = kilitliAd
        ? kilitliAd + ' kampanyası kilitli — değişiklik kaydedilemez'
        : (degisen
            ? YU.fmt.sayi(degisen) + ' satır değişecek · henüz kaydedilmedi'
            : 'Kaydedilmemiş değişiklik yok');
      kaydetDugmesi.disabled = degisen === 0 || !!kilitliAd;
      geriDugmesi.disabled = degisen === 0 && !durum.yeniKampanya;
      /* Çıkış engeli: kaydedilmemiş satır ya da bekleyen yeni kampanya
         kurulumu varsa her çıkış yolu sorulur (kullanıcı isteği, 27.08.2026). */
      cikisEngeli(degisen > 0 || !!durum.yeniKampanya);
    }

    var siloTablo = bolumTablosu('Silo', tarih, kilitliAd, alanlar, canliTazele);
    var malzemeTablo = bolumTablosu('Malzeme', tarih, kilitliAd, alanlar, canliTazele);
    /* Başlık ile kolon adları arası kısıldı (kullanıcı isteği, 01.09.2026:
       "Silo Devirleri ile altındaki Silo / Devir Tarihi / Kayıtlı Devir (Kg)
       / Son Dokunuş yazısı arasındaki boşluğu azalt").
       ÖLÇÜLDÜ: 30,6 px. İkisi birden kısıldı — başlığın alt payı 10 -> 2 px
       (bolumBasligi) ve panel gövdesinin 13 px'lik kendi aralığı burada
       kısmen geri alındı. Sonuç 15,6 px. Tablo ölçüleri değişmez. */
    siloTablo.style.marginTop = '-7px';
    malzemeTablo.style.marginTop = '-7px';

    /* Devretten / yeni kampanyadan gelen doldurma: alanlar kurulduktan sonra
       bir kez yazılır ve alanlar AÇIK bırakılır. */
    if (durum.onDoldur) {
      for (var i2 = 0; i2 < alanlar.length; i2++) {
        var kaynak = durum.onDoldur[alanlar[i2].tip] || {};
        var doldur = kaynak[alanlar[i2].sahip.Id];
        if (doldur !== undefined && doldur > 0) alanlar[i2].alan.ayarla(doldur);
      }
      durum.onDoldur = null;
    }
    if (durum.acikKal && !kilitliAd) {
      for (var i3 = 0; i3 < alanlar.length; i3++) if (alanlar[i3].ac) alanlar[i3].ac();
    }

    var altSatir = YU.h('div', {
      sinif: 'yu-devir-alt',
      stil: {
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        padding: '16px 18px', borderTop: '1px solid var(--ayrac)'
      }
    },
      sayacMetin,
      YU.h('div', { stil: { flex: '1', minWidth: '12px' } }),
      geriDugmesi,
      kaydetDugmesi
    );

    canliTazele();

    /* Devret düğmesi "Silo Devirleri" başlık satırının sağına gider;
       kilit ve yeni kampanya şeritleri gövdede kendi satırlarında durur. */
    var devretDugmesi = tarihBlogu();
    var kilitSerit = kilitSeridi(kilitliAd);
    var yeniSerit = yeniKampanyaSeridi();

    return YU.ui.panel({
      baslik: 'Kampanya Devirleri',
      ikon: '#ic-wallet',
      dolgusuz: true,
      /* Panel sağındaki "22.07.2026 · kampanya 2026/2027 · 2 kampanya devri"
         cümlesi kaldırıldı (kullanıcı isteği, 26.08.2026 · KURAL 11):
         sayı tablodan, tarih ise hemen altındaki tarih bloğundan okunuyor. */
      govde: [
        kilitSerit,
        yeniSerit,
        bolumBasligi('Silo', false, devretDugmesi),
        siloTablo,
        /* Ayri ara blok KALDIRILDI (01.09.2026): cizgi artik "Malzeme
           Devirleri" basliginin ust kenarligi. Bkz. bolumBasligi. */
        bolumBasligi('Malzeme', true),
        malzemeTablo,
        altSatir
      ]
    });
  }

  /* Yeni kampanya kurulumu ekranda beklerken ne olduğunu söyleyen şerit. */
  function yeniKampanyaSeridi() {
    var y = durum.yeniKampanya;
    if (!y) return null;
    return YU.h('div', { stil: { padding: '14px 18px 0' } }, YU.ui.serit({
      tur: 'uyari', ikon: '#ic-plus',
      baslik: 'Yeni Kampanya Kaydedilmeyi Bekliyor',
      metin: YU.fmt.tarih(durum.tarih) + ' tarihli devir satırları ekranda hazır; ' +
        (y.devret ? 'miktarlar ' + y.onceki.ad + ' kapanışından dolduruldu. ' : 'miktarlar boş açıldı. ') +
        'Kampanya, Kaydet\'e basılana kadar OLUŞMAZ.' +
        (y.kilitle && y.onceki ? ' Kaydedince ' + y.onceki.ad + ' kampanyası kilitlenir.' : '')
    }));
  }

  /* ------------------------------------------------------------------
     Kaydetme — önce önizleme
     ------------------------------------------------------------------ */

  function degisiklikleriTopla(alanlar) {
    var liste = [], i, a, ham, deger;
    for (i = 0; i < alanlar.length; i++) {
      a = alanlar[i];
      a.alan.hataGoster('');
      ham = String(a.alan.girdi.value).trim();
      if (ham === '') continue;                       /* boş satır: kayıt açılmaz, silinmez */
      deger = a.alan.deger();
      if (isNaN(deger)) {
        a.alan.hataGoster('Miktar sayı olmalı (örn. 240.000 veya 1.234,56).');
        if (a.ac) a.ac();
        return { hata: true };
      }
      if (deger < 0) {
        a.alan.hataGoster('Devir miktarı negatif olamaz.');
        if (a.ac) a.ac();
        return { hata: true };
      }
      if (a.kayit && YU.hesap.esit(deger, Number(a.kayit.Miktar) || 0)) continue;
      liste.push({
        tip: a.tip, sahip: a.sahip, kayit: a.kayit,
        eski: a.kayit ? YU.yuvarla(Number(a.kayit.Miktar) || 0) : null,
        yeni: YU.yuvarla(deger)
      });
    }
    return { hata: false, liste: liste };
  }

  function okluDeger(eski, yeni) {
    return YU.h('span', { stil: { whiteSpace: 'nowrap' } },
      YU.h('span', { sinif: 'yu-zayif', metin: eski === null ? '—' : YU.fmt.kg(eski) }),
      YU.h('span', { stil: { color: 'var(--metin-5)', margin: '0 7px' }, metin: '→' }),
      YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(yeni) })
    );
  }

  function kaydetmeyiBaslat(alanlar) {
    var tarih = seciliTarih();
    if (!tarih) { YU.ui.bildir('Önce devir tarihi seçin.', 'hata'); return; }

    var sonuc = degisiklikleriTopla(alanlar);
    if (sonuc.hata) { YU.ui.bildir('Girilen miktarlarda hata var; alanları kontrol edin.', 'hata'); return; }
    if (!sonuc.liste.length) { YU.ui.bildir('Değişiklik yok.', 'bilgi'); return; }

    var degisiklikler = sonuc.liste;
    var oncekiMevcut = { Silo: mevcutHaritasi(YU.db, 'Silo'), Malzeme: mevcutHaritasi(YU.db, 'Malzeme') };
    var oncekiDokme = YU.stok.dokmeToplam(YU.db);

    var g = geciciDepo(), i, d;
    for (i = 0; i < degisiklikler.length; i++) {
      d = degisiklikler[i];
      geciciDevirUygula(g, d.tip, d.sahip.Id, tarih, d.yeni);
    }
    var sonrakiMevcut = { Silo: mevcutHaritasi(g, 'Silo'), Malzeme: mevcutHaritasi(g, 'Malzeme') };
    var sonrakiDokme = YU.stok.dokmeToplam(g);
    var negatifler = YU.dogrula.ileriBakiye(g, null, null);

    var satirlar = [];
    for (i = 0; i < degisiklikler.length; i++) {
      d = degisiklikler[i];
      satirlar.push([
        YU.h('span', null,
          YU.ui.rozet(siloMu(d.tip) ? 'Silo' : 'Malzeme', siloMu(d.tip) ? 'vurgu' : 'notr'),
          YU.h('span', { stil: { marginLeft: '8px' }, metin: d.sahip.Ad })),
        okluDeger(d.eski, d.yeni),
        okluDeger(oncekiMevcut[d.tip][d.sahip.Id] === undefined ? 0 : oncekiMevcut[d.tip][d.sahip.Id],
                  sonrakiMevcut[d.tip][d.sahip.Id] === undefined ? 0 : sonrakiMevcut[d.tip][d.sahip.Id])
      ]);
    }

    var govde = [];
    govde.push(YU.h('div', {
      metin: (durum.yeniKampanya
        ? 'Yeni kampanya ' + YU.fmt.tarih(tarih) + ' tarihinde başlatılacak; '
        : YU.fmt.tarih(tarih) + ' tarihli devirde ') +
        YU.fmt.sayi(degisiklikler.length) + ' satır yazılıyor. Devir değiştiği için bu tarihten ' +
        'sonraki tüm günlerin stoğu yeniden hesaplanır.'
    }));
    govde.push(YU.ui.tablo({
      kompakt: true,
      sutunlar: [
        { baslik: 'Kalem' },
        { baslik: 'Devir', hiza: 'sag', genislik: 190 },
        { baslik: 'Mevcut Stok', hiza: 'sag', genislik: 210 }
      ],
      satirlar: satirlar
    }));

    if (!YU.hesap.esit(oncekiDokme, sonrakiDokme)) {
      govde.push(YU.ui.serit({
        tur: 'bilgi', ikon: '#ic-chart',
        baslik: 'Dökme Kuru Küspe (Siloların Toplamı)',
        metin: YU.fmt.kgU(oncekiDokme) + ' → ' + YU.fmt.kgU(sonrakiDokme) +
          ' · dökme stok siloların toplamı olduğu için silo devri değişince birlikte değişir (Şartname §5).'
      }));
    }

    if (durum.yeniKampanya && durum.yeniKampanya.kilitle && durum.yeniKampanya.onceki) {
      govde.push(YU.ui.serit({
        tur: 'uyari', ikon: '#ic-kilit',
        baslik: durum.yeniKampanya.onceki.ad + ' Kampanyası Kilitlenecek',
        metin: 'Kaydetme başarılı olursa önceki kampanya kilitlenir; sonrasında o kampanyaya ' +
          'veri girişi, düzeltme ve silme kapanır.'
      }));
    }

    if (negatifler.length) {
      var uyariSatirlari = [], n;
      for (i = 0; i < negatifler.length; i++) {
        n = negatifler[i];
        uyariSatirlari.push([n.siloAd, YU.fmt.tarih(n.tarih),
          YU.h('span', { stil: { color: 'var(--olumsuz)' }, metin: YU.fmt.kgU(n.bakiye) })]);
      }
      var uyariSerit = YU.ui.serit({
        tur: 'uyari',
        baslik: 'Bu Değişiklikten Sonra Silo Bakiyesi Negatife Düşen Günler Var',
        metin: 'Devir bir düzeltme kalemi olduğu için kayıt engellenmez, ama sonraki günlerin ' +
          'girişleri gözden geçirilmelidir.'
      });
      uyariSerit.querySelector('.yu-serit-govde').appendChild(YU.ui.tablo({
        kompakt: true,
        sutunlar: [{ baslik: 'Silo' }, { baslik: 'Gün', genislik: 120 }, { baslik: 'Bakiye', hiza: 'sag', genislik: 140 }],
        satirlar: uyariSatirlari
      }));
      govde.push(uyariSerit);
    }

    /* Son adım açıkça SORU olur (kullanıcı isteği, 25.08.2026): önizlemenin
       altında "kaydedilecek, emin misiniz?" satırı durur; düğmeler Geri Al /
       Evet, Kaydet. */
    govde.push(YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 18px', borderRadius: 'var(--r-l)',
        background: 'var(--vurgu-zemin)', color: 'var(--metin)',
        font: '600 15.5px/1.4 var(--font)'
      }
    },
      YU.h('span', { stil: { display: 'flex', color: 'var(--vurgu)', flex: 'none' } }, YU.svg('#ic-alert', 17)),
      YU.h('span', {
        metin: YU.fmt.sayi(degisiklikler.length) + ' satır kaydedilecektir. Emin misiniz?'
      })
    ));

    var m = YU.ui.modal({
      baslik: durum.yeniKampanya ? 'Yeni Kampanya Önizlemesi' : 'Devir Değişikliği Önizlemesi',
      genislik: 680,
      govde: govde,
      dugmeler: [
        { metin: 'Geri Al', ikon: '#ic-swap', tur: 'ikincil', onClick: function () { m.kapat(); } },
        { metin: 'Evet, Kaydet', ikon: '#ic-wallet', tur: 'birincil', onClick: function () { m.kapat(); degisiklikleriYaz(tarih, degisiklikler); } }
      ]
    });
  }

  function degisiklikleriYaz(tarih, degisiklikler) {
    var hatalar = [], uyarilar = [], basarili = 0, i, d, s, kilitGoruldu = false;

    /* KAMPANYA BAŞLIĞI ÖNCE YAZILIR (kullanıcı isteği, 31.08.2026): başlık
       kaydı bu tarihi yeni kampanyanın başı yapar; önceki kampanya kilitli
       olsa bile ilk devir satırları kilide takılmaz. Başlık yazılamazsa
       devir satırlarına hiç girilmez. */
    var yk = durum.yeniKampanya;
    var baslikYazildi = false;
    if (yk && yk.baslik) {
      var b = YU.servis.kampanyaBasligiKaydet(YU.db, { tarih: tarih, baslik: yk.baslik }, YU.oturum.kullanici);
      if (!b.ok) {
        YU.ui.modal({
          baslik: 'Kampanya oluşturulamadı',
          genislik: 600,
          govde: [YU.ui.hataListesi({ hatalar: b.hatalar, uyarilar: b.uyarilar })],
          dugmeler: [{ metin: 'Kapat', tur: 'ikincil' }]
        });
        return;
      }
      baslikYazildi = true;
    }

    for (i = 0; i < degisiklikler.length; i++) {
      d = degisiklikler[i];
      s = siloMu(d.tip)
        ? YU.servis.siloDevirKaydet(YU.db, { siloId: d.sahip.Id, devirTarihi: tarih, miktar: d.yeni }, YU.oturum.kullanici)
        : YU.servis.devirKaydet(YU.db, { malzemeId: d.sahip.Id, devirTarihi: tarih, miktar: d.yeni }, YU.oturum.kullanici);
      if (s.ok) basarili++;
      else if (YU.ui.kilitYakala(s)) { kilitGoruldu = true; break; }
      else hatalar = hatalar.concat(etiketle(d.sahip.Ad, s.hatalar));
      uyarilar = uyarilar.concat(etiketle(d.sahip.Ad, s.uyarilar));
    }
    /* Tek satır bile yazılamadıysa başlık geri alınır: devirsiz bir kampanya
       listede durmaz. */
    if (baslikYazildi && !basarili) {
      YU.servis.kampanyaBasligiKaydet(YU.db, { tarih: tarih, baslik: '' }, YU.oturum.kullanici);
    }
    if (kilitGoruldu) { cikisEngeli(false); YU.donem.tazele(); YU.yenile(); return; }

    /* Önceki kampanyanın kilidi YALNIZ kayıt gerçekten yazıldıysa atılır. */
    var y = durum.yeniKampanya;
    if (basarili && y && y.kilitle && y.onceki) {
      var k = YU.servis.kampanyaKilitle(YU.db, { kampanya: y.onceki.ad }, YU.oturum.kullanici);
      if (k.ok) YU.ui.bildir('"' + y.onceki.ad + '" kampanyası kilitlendi.', 'basari');
      else hatalar = hatalar.concat(etiketle(y.onceki.ad, k.hatalar));
    }

    /* Sorunsuz kayıtta ekranın ORTASINDA mini onay penceresi açılır
       (kullanıcı isteği, 27.08.2026); sağ alttaki geçici bildirim yerine
       geçer — kullanıcı Tamam'a basana kadar durur. Hata ya da uyarı varsa
       aşağıdaki pencere zaten açılıyor: iki pencere üst üste binmesin diye
       o durumda eski bildirim korunur. */
    var basariPenceresi = false;
    if (basarili) {
      durum.yeniKampanya = null;
      durum.acikKal = false;
      cikisEngeli(false);
      if (!hatalar.length && !uyarilar.length) basariPenceresi = true;
      else YU.ui.bildir(YU.fmt.sayi(basarili) + ' devir satırı kaydedildi (' + YU.fmt.tarih(tarih) + ').', 'basari');
    }
    YU.donem.tazele();
    YU.yenile();

    if (basariPenceresi) {
      var mb = YU.ui.modal({
        baslik: 'Başarıyla Kaydedildi',
        genislik: 380,
        govde: [YU.h('div', {
          stil: {
            display: 'flex', alignItems: 'center', gap: '10px',
            font: '400 15px/1.5 var(--font)', color: 'var(--metin)'
          }
        },
          YU.h('span', { stil: { display: 'flex', color: 'var(--olumlu)', flex: 'none' } }, YU.svg('#ic-checklist', 20)),
          YU.h('span', { metin: YU.fmt.sayi(basarili) + ' devir satırı kaydedildi.' })
        )],
        dugmeler: [{ metin: 'Tamam', tur: 'birincil', onClick: function () { mb.kapat(); } }]
      });
    }

    if (hatalar.length || uyarilar.length) {
      var m = YU.ui.modal({
        baslik: hatalar.length ? 'Bazı satırlar kaydedilemedi' : 'Kaydedildi — dikkat edilecekler',
        genislik: 600,
        govde: [YU.ui.hataListesi({ hatalar: hatalar, uyarilar: uyarilar })],
        dugmeler: [{ metin: 'Kapat', tur: 'ikincil', onClick: function () { m.kapat(); } }]
      });
    }
  }

  function etiketle(ad, liste) {
    var cikti = [], i;
    if (!liste) return cikti;
    for (i = 0; i < liste.length; i++) {
      cikti.push({ kod: liste[i].kod, mesaj: ad + ' — ' + liste[i].mesaj });
    }
    return cikti;
  }

  /* ------------------------------------------------------------------
     Gövde ve sayfa
     ------------------------------------------------------------------ */

  /* Ortada bir kampanya var mı? Kampanya, devir tarihlerinden ve başlık
     kayıtlarından türer (04-servis · kampanyaBaslari). */
  function kampanyaVarMi() {
    return YU.donem.liste().length > 0;
  }

  /* Hiç devir yokken "0 kg" dolu tablo yerine yönlendiren boş durum.

     KAMPANYASIZ DEVİR GİRİŞİ KAPATILDI (kullanıcı isteği, 02.09.2026:
     "kampanya oluşturulmadan direkt elle oluşturma kısmı aktif, böyle
     olmaması lazım"). Eskiden "Elle Gir" düğmesi kampanya hiç yokken de
     devir tablosunu açıyordu; kaydedilen devrin kampanya BAŞLIĞI olmuyor,
     adı sonradan tarihten uyduruluyordu (2026/2027). Artık ilk adım
     kampanyayı adıyla kurmaktır — devir satırları o akışın içinde gelir.
     Kampanya zaten varsa "Elle Gir" eskisi gibi durur. */
  function bosDurumPaneli() {
    var onceki = oncekiKampanya(null);
    var kampanyaVar = kampanyaVarMi();
    var eylemler = [];
    if (onceki) {
      eylemler.push(YU.ui.dugme({
        metin: 'Önceki Kampanyadan Devret', ikon: '#ic-wallet', tur: 'birincil',
        baslik: 'Kampanya ' + onceki.ad + ' kapanışını (' + YU.fmt.tarih(onceki.bit) + ') satırlara doldurur',
        onClick: function () { devret(onceki, true); }
      }));
    }
    if (kampanyaVar) {
      eylemler.push(YU.ui.dugme({
        metin: 'Elle Gir', ikon: '#ic-pencil', tur: onceki ? 'ikincil' : 'birincil',
        onClick: function () { durum.elle = true; govdeyiCiz(); }
      }));
    } else {
      eylemler.push(YU.ui.dugme({
        metin: 'Yeni Kampanya Oluştur', ikon: '#ic-plus', tur: 'birincil',
        onClick: yeniKampanyaModali
      }));
    }

    return YU.ui.panel({
      baslik: 'Kampanya Devirleri',
      ikon: '#ic-wallet',
      dolgusuz: true,
      govde: YU.ui.bosDurum({
        ikon: '#ic-wallet',
        baslik: kampanyaVar ? 'İlk Kampanya Devrini Oluşturun' : 'Önce Kampanya Oluşturun',
        metin: kampanyaVar
          ? ('Henüz devir kaydı yok. Devir, kampanya başındaki açılış stoğudur. ' +
             (onceki
               ? 'Önceki kampanyanın (' + onceki.ad + ') kapanış stoklarını tek tuşla devredebilir ya da elle girebilirsiniz.'
               : 'Miktarları elle girebilirsiniz.'))
          : 'Devir, kampanya başındaki açılış stoğudur. Kampanyayı adı ve başlangıç tarihiyle kurun; devir satırları aynı adımda açılır.',
        eylemler: eylemler
      })
    });
  }

  /* ==================================================================
     Kampanya Yönetimi
     - kampanya listesi + kilitle / kilidi aç (yalnız yönetici bu sayfaya
       girebildiği için ayrıca rol kontrolü gerekmez)
     - yeni kampanya kurulumu: satırları hazırlar, KAYIT Kaydet'te olur
     ================================================================== */

  function kilitKullanicisi(kilit) {
    if (!kilit) return null;
    var l = YU.db.kullanicilar, i;
    for (i = 0; i < l.length; i++) if (l[i].Id === kilit.KullaniciId) return l[i].AdSoyad;
    return kilit.KullaniciId === null || kilit.KullaniciId === undefined ? 'Sistem' : 'Kullanıcı #' + kilit.KullaniciId;
  }

  function kilitleIste(donem) {
    YU.ui.onay({
      baslik: '"' + donem.ad + '" Kampanyasını Kilitle',
      metin: 'Kilitliyken bu kampanyaya düşen hiçbir gün için veri girişi, düzeltme, silme ve devir değişikliği yapılamaz. ' +
        'Kilidi yine bu ekrandan açabilirsin.',
      onayMetni: 'Kilitle'
    }).then(function (evet) {
      if (!evet) return;
      var s = YU.servis.kampanyaKilitle(YU.db, { kampanya: donem.ad }, YU.oturum.kullanici);
      if (s.ok) YU.ui.bildir('"' + donem.ad + '" kampanyası kilitlendi.', 'basari');
      else YU.ui.bildir(s.hatalar[0] ? s.hatalar[0].mesaj : 'Kilitleme başarısız.', 'hata');
      YU.yenile();
    });
  }

  function kilidiAcIste(donem) {
    YU.ui.onay({
      baslik: '"' + donem.ad + '" Kampanyasının Kilidini Aç',
      metin: 'Kilit açılınca bu kampanyanın günleri yeniden düzenlenebilir ve silinebilir. ' +
        'Geçmiş kampanyada yapılacak değişiklik sonraki günlerin stoklarını yeniden hesaplatır. Emin misin?',
      onayMetni: 'Kilidi Aç', tehlike: true
    }).then(function (evet) {
      if (!evet) return;
      var s = YU.servis.kampanyaKilidiAc(YU.db, { kampanya: donem.ad }, YU.oturum.kullanici);
      if (s.ok) YU.ui.bildir('"' + donem.ad + '" kampanyasının kilidi açıldı.', 'basari');
      else YU.ui.bildir(s.hatalar[0] ? s.hatalar[0].mesaj : 'Kilit açılamadı.', 'hata');
      YU.yenile();
    });
  }

  /* Evet / Hayır seçimi: seçili taraf DOLU zemin + kalın kenarlık + tik taşır.
     Erişilebilirlik W3C APG radio-group kalıbıdır. */
  function evetHayirSecim(varsayilan, onDegisim) {
    var deger = varsayilan !== false;
    var kap = YU.h('div', { sinif: 'yu-eh-grup', role: 'radiogroup' });
    var ogeler = [];

    function ayarla(v, odakla) {
      deger = v;
      for (var i = 0; i < ogeler.length; i++) {
        var secili = ogeler[i].deger === v;
        ogeler[i].el.setAttribute('aria-checked', secili ? 'true' : 'false');
        ogeler[i].el.tabIndex = secili ? 0 : -1;
        if (secili && odakla) ogeler[i].el.focus();
      }
      if (onDegisim) onDegisim(v);
    }

    function tusIsle(e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ayarla(deger, true); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); ayarla(!deger, true); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); ayarla(!deger, true); }
    }

    function oge(metin, v, sinif) {
      var el = YU.h('button', {
        tip: 'button', sinif: 'yu-eh-oge ' + sinif, role: 'radio',
        onClick: function () { ayarla(v, false); },
        onKeyDown: tusIsle
      },
        YU.h('span', { sinif: 'yu-eh-tik', metin: '✓' }),
        YU.h('span', { metin: metin })
      );
      ogeler.push({ el: el, deger: v });
      kap.appendChild(el);
      return el;
    }

    oge('Evet', true, 'evet');
    oge('Hayır', false, 'hayir');
    ayarla(deger, false);

    return { kok: kap, deger: function () { return deger; } };
  }

  /* Soru + gerekçe + Evet/Hayır. */
  function secimSatiri(soru, aciklamaEl, secim) {
    return YU.h('div', {
      stil: {
        display: 'flex', gap: '16px', alignItems: 'center',
        padding: '16px 18px', border: '1px solid var(--kenar)',
        borderRadius: 'var(--r-l)', background: 'var(--yuzey-2)'
      }
    },
      YU.h('div', { stil: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '5px' } },
        /* soru bir Element ise olduğu gibi kullanılır (yeni kampanya modalı:
           kilit sorusu seçilen tarihe göre canlı yazılır — 27.08.2026). */
        typeof soru === 'string'
          ? YU.h('div', { metin: soru, stil: { font: '500 15.5px/1.4 var(--font)', color: 'var(--metin)' } })
          : soru,
        aciklamaEl
      ),
      secim.kok
    );
  }

  function yeniKampanyaModali() {
    var liste = YU.donem.liste();
    var bugun = YU.tarih.bugun();
    var hazir = false;

    /* Başlangıç tarihi SEÇİLEBİLİR (kullanıcı isteği, 27.08.2026): geçmiş
       tarihli kampanya kurulabilir. Gelecek gün ortak tarih alanı kuralıyla
       zaten kapalı (YU.ui.alan max=bugün). Sezon çakışması, biten kampanya
       ve metinler seçilen tarihe göre canlı tazelenir. */
    var tarihAlan = YU.ui.alan({
      etiket: 'Kampanya Başlangıç Tarihi', tip: 'tarih', deger: bugun,
      genislik: 200, onInput: tazele
    });
    var tarihNotu = YU.h('span', { sinif: 'yu-yardim', stil: { margin: '0 0 9px' } });

    /* KAMPANYA BAŞLIĞI (kullanıcı isteği, 31.08.2026): kampanyanın adı artık
       tarihten türetilmiyor, buraya yazılıyor. Kullanıcı elle yazana kadar
       tarihten önerilen ad alanda durur ve tarih değişince tazelenir. */
    var baslikElle = false;
    var baslikAlan = YU.ui.alan({
      etiket: 'Kampanya Başlığı', tip: 'metin', genislik: 260,
      yerTutucu: 'Örn. 2026 Yaz Kampanyası',
      onInput: function () { baslikElle = true; baslikAlan.hataGoster(''); }
    });
    baslikAlan.girdi.maxLength = 40;

    var tarihSatiri = YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap',
        padding: '14px 18px', border: '1px solid var(--kenar)',
        borderRadius: 'var(--r-l)', background: 'var(--vurgu-zemin)'
      }
    },
      YU.h('span', { stil: { display: 'flex', color: 'var(--vurgu)', flex: 'none', margin: '0 0 9px' } }, YU.svg('#ic-calendar', 18)),
      tarihAlan.kok,
      tarihNotu,
      baslikAlan.kok
    );

    var girisMetni = YU.h('div', { stil: { font: '400 15px/1.6 var(--font)', color: 'var(--metin-2)' } });

    var devretAciklama = YU.h('div', { sinif: 'yu-yardim', stil: { margin: '0' } });
    var devretSecim = evetHayirSecim(true, tazele);

    var kilitSoru = YU.h('div', { stil: { font: '500 15.5px/1.4 var(--font)', color: 'var(--metin)' } });
    var kilitAciklama = YU.h('div', { sinif: 'yu-yardim', stil: { margin: '0' } });
    var kilitSecim = evetHayirSecim(true, tazele);
    var kilitSatir = secimSatiri(kilitSoru, kilitAciklama, kilitSecim);

    function secilenTarih() {
      var t = String(tarihAlan.deger() || '').trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
    }

    /* Yeni başlangıçtan önceki SON kampanya: dönemi seçilen tarihte biten
       kampanya budur (liste YU.donem.liste() ile artan sıralı). Araya ekleme
       de doğru çalışır: dönem sınırları devir tarihlerinden türediği için
       bölünen kampanya seçilen tarihin bir gün öncesinde biter. */
    function oncekiBul(tarih) {
      var o = null, i;
      for (i = 0; i < liste.length; i++) if (liste[i].bas < tarih) o = liste[i];
      return o;
    }

    /* AYNI SEZON ENGELİ KALDIRILDI (kullanıcı kararı, 31.08.2026): kampanyalar
       yılbaşında değil yazın açılıyor, aynı yıl içinde ikinci kampanya
       açılabilir. Ad çakışması artık sezonda değil BAŞLIKTA aranır. */
    function baslikVarMi(baslik) {
      var k = String(baslik || '').toLowerCase();
      for (var i = 0; i < liste.length; i++) if (String(liste[i].ad).toLowerCase() === k) return liste[i];
      return null;
    }

    /* O tarihte zaten bir kampanya başlıyorsa yenisi kurulmaz; devirler
       tablodaki kalem düğmesiyle düzeltilir. */
    function ayniGunKampanya(tarih) {
      for (var i = 0; i < liste.length; i++) if (liste[i].bas === tarih) return liste[i];
      return null;
    }

    /* Önerilen başlık: sezon adı; o ad alınmışsa sonuna sıra eklenir. */
    function onerilenBaslik(tarih) {
      var kok = (YU.servis.kampanyaAdi ? YU.servis.kampanyaAdi(tarih) : '') || 'Kampanya';
      if (!baslikVarMi(kok)) return kok;
      var n = 2;
      while (baslikVarMi(kok + ' (' + n + ')')) n++;
      return kok + ' (' + n + ')';
    }

    function tazele() {
      if (!hazir) return;
      var tarih = secilenTarih();
      var onceki = tarih ? oncekiBul(tarih) : null;
      var dun = tarih ? YU.tarih.ekle(tarih, -1) : null;

      tarihAlan.hataGoster('');
      tarihNotu.textContent = !tarih ? '' : (tarih === bugun ? 'bugün' : 'geçmiş tarih');
      if (!baslikElle) baslikAlan.ayarla(tarih ? onerilenBaslik(tarih) : '');

      /* METİNLER SADELEŞTİ (kullanıcı isteği, 01.09.2026: "bu kısmı da biraz
         sadeleştir, çok detaylı olmuş"). Kararı değiştiren bilgi kaldı,
         gerisi düştü: düğmenin adı ("Satırları Hazırla") ne olacağını zaten
         söylüyor (KURAL 9, KURAL 11). */
      girisMetni.textContent = 'Kampanya, Kaydet\'e basınca oluşur.' +
        (onceki ? ' ' + onceki.ad + ' ' + YU.fmt.tarih(dun) + ' günü biter.' : '');

      devretAciklama.textContent = devretSecim.deger()
        ? (onceki
            ? onceki.ad + ' kapanışı (' + (dun ? YU.fmt.tarih(dun) : '—') + ') satırlara yazılır.'
            : 'Önceki kampanya yok; satırlar boş gelir.')
        : 'Satırlar boş gelir, miktarları siz girersiniz.';

      kilitSatir.style.display = onceki ? '' : 'none';
      if (onceki) {
        kilitSoru.textContent = onceki.ad + ' kampanyası kilitlensin mi?';
        kilitAciklama.textContent = kilitSecim.deger()
          ? 'Kilitli kampanya değiştirilemez; kilidi yalnız yönetici açar.'
          : 'Açık kalır; sonra listeden kilitleyebilirsiniz.';
      }
    }

    var m = YU.ui.modal({
      baslik: 'Yeni Kampanya Oluştur',
      genislik: 660,
      govde: [YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        girisMetni,
        tarihSatiri,
        secimSatiri('Önceki kampanyanın kapanış stokları yazılsın mı?',
          devretAciklama, devretSecim),
        kilitSatir
      )],
      dugmeler: [
        { metin: 'Vazgeç' },
        {
          metin: 'Satırları Hazırla', ikon: '#ic-plus', tur: 'birincil',
          onClick: function () {
            var tarih = secilenTarih();
            if (!tarih) { tarihAlan.hataGoster('Geçerli bir tarih seçin.'); return; }
            if (tarih > bugun) { tarihAlan.hataGoster('Gelecek tarihe kampanya açılamaz.'); return; }
            var ayniGun = ayniGunKampanya(tarih);
            if (ayniGun) {
              tarihAlan.hataGoster(ayniGun.ad + ' kampanyası zaten bu tarihte başlıyor. Devirleri tablodaki kalem düğmesiyle düzeltin.');
              return;
            }
            var baslik = String(baslikAlan.deger() || '').replace(/\s+/g, ' ').trim();
            if (!baslik) { baslikAlan.hataGoster('Kampanya başlığı yazın.'); return; }
            if (baslikVarMi(baslik)) { baslikAlan.hataGoster('Bu başlıkta bir kampanya zaten var. Başka bir başlık yazın.'); return; }
            var onceki = oncekiBul(tarih);
            var dun = YU.tarih.ekle(tarih, -1);
            m.kapat();
            durum.tarih = tarih;
            durum.elle = true;
            durum.acikKal = true;
            durum.yeniKampanya = {
              baslik: baslik,
              onceki: onceki,
              devret: !!(devretSecim.deger() && onceki),
              kilitle: !!(onceki && kilitSecim.deger())
            };
            durum.onDoldur = (devretSecim.deger() && onceki) ? ikiTarafKapanis(dun) : null;
            govdeyiCiz();
            YU.ui.bildir('Devir satırları hazır (' + YU.fmt.tarih(tarih) + '). Miktarları kontrol edip ' +
              'Kaydet\'e basın — kampanya o zaman oluşur.', 'bilgi');
          }
        }
      ]
    });
    hazir = true;
    tazele();
  }

  /* ------------------------------------------------------------------
     KAMPANYA DÜZELTME (kullanıcı isteği, 01.09.2026: "Kampanya yönetimine
     bir adet de düzeltme kısmı koy, adını değiştirebilelim ve tarihini.
     silme olmasın ama").

     İki alan: başlık ve başlangıç tarihi. SİLME YOK — pencerede öyle bir
     düğme bulunmaz. Kaydet'e basınca önce ad (kampanyaBasligiKaydet), sonra
     tarih (kampanyaTarihiTasi) yazılır; ikisi de kendi kurallarını uygular
     ve hata verirse o adım yazılmaz.

     SIRA ÖNEMLİ: ad önce yazılır, çünkü tarih taşıma kilidi ADA bakarak
     arar; tarih önce taşınsaydı ad kaydı yeni tarihte aranırdı.
     ------------------------------------------------------------------ */
  function kampanyaDuzeltModali(dn) {
    var eskiTarih = dn.bas;
    var baslikAlan = YU.ui.alan({
      etiket: 'Kampanya Başlığı', tip: 'metin', genislik: '100%', deger: dn.ad
    });
    baslikAlan.girdi.maxLength = 40;
    /* SEÇİLEBİLİR ARALIK (kullanıcı isteği, 01.09.2026: "eski kampanyadan
       önceki kampanyaya gidemesin — 1 Ocak'ta 1. kampanya, 5 Ocak'ta 2.
       kampanya varsa, 2.'si 1 Ocak'tan SONRAKİ günler için değiştirilebilsin").

       En erken : önceki kampanyanın başlangıcının ERTESİ günü. Aynı güne ya
                  da öncesine taşımak kampanyaların sırasını bozardı.
       En geç   : sonraki kampanyanın başlangıcının BİR ÖNCEKİ günü; sonraki
                  kampanya yoksa bugün (gelecek gün her yerde kapalı).
       Aynı sınırlar servis katmanında da denetlenir (04-servis ·
       kampanyaTarihiTasi) — takvim seçimi tek savunma hattı değildir. */
    var liste = YU.donem.liste(), sira = -1, i2;
    for (i2 = 0; i2 < liste.length; i2++) if (liste[i2].bas === eskiTarih) sira = i2;
    var oncekiKmp = sira > 0 ? liste[sira - 1] : null;
    var sonrakiKmp = (sira >= 0 && sira + 1 < liste.length) ? liste[sira + 1] : null;
    var enErken = oncekiKmp ? YU.tarih.ekle(oncekiKmp.bas, 1) : null;
    var enGec = sonrakiKmp ? YU.tarih.ekle(sonrakiKmp.bas, -1) : YU.tarih.bugun();

    var tarihAlan = YU.ui.alan({
      etiket: 'Başlangıç Tarihi', tip: 'tarih', genislik: 200, deger: eskiTarih,
      yardim: oncekiKmp
        ? 'En erken ' + YU.fmt.tarih(enErken) + ' — önceki kampanya ' +
          YU.fmt.tarih(oncekiKmp.bas) + ' günü başlıyor.'
        : null
    });
    if (enErken) tarihAlan.girdi.min = enErken;
    tarihAlan.girdi.max = enGec;

    var m = YU.ui.modal({
      baslik: 'Kampanyayı Düzelt',
      genislik: 520,
      /* DÜZEN (kullanıcı isteği, 01.09.2026: "kampanya başlığı ve tarihi
         üstte, altında ise açıklama yazısı olsun"). Önce iş yapılan alanlar,
         sonra ne olacağını söyleyen cümle. İki alan yan yana ve ALT KENARDAN
         hizalı; başlık esner, tarih sabit kalır. Kutu kalktı: pencerenin
         kendi çerçevesi zaten var, içine ikinci çerçeve acemi duruyordu. */
      govde: [YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        /* ÜST kenardan hizalı: tarih alanının altında yardım satırı var,
           flex-end ile hizalanınca başlık alanı aşağı kayıyor ve iki kutu
           farklı yükseklikte duruyordu (01.09.2026 ekran denemesi). */
        YU.h('div', {
          stil: { display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }
        },
          YU.h('div', { stil: { flex: '1 1 220px', minWidth: '200px' } }, baslikAlan.kok),
          YU.h('div', { stil: { flex: '0 0 auto', maxWidth: '230px' } }, tarihAlan.kok)
        ),
        YU.h('hr', { sinif: 'yu-ayrac yu-yatay', stil: { margin: '0' } }),
        YU.h('div', {
          metin: 'Adı ve başlangıç tarihi değiştirilebilir. Devir satırları silinmez, ' +
            'tarihleri birlikte taşınır.',
          stil: { font: '400 14px/1.6 var(--font)', color: 'var(--metin-3)' }
        })
      )],
      dugmeler: [
        { metin: 'Vazgeç' },
        {
          metin: 'Kaydet', ikon: '#ic-wallet', tur: 'birincil',
          onClick: function () {
            var baslik = String(baslikAlan.deger() || '').replace(/\s+/g, ' ').trim();
            var yeniTarih = String(tarihAlan.deger() || '').trim();
            if (!baslik) { baslikAlan.hataGoster('Kampanya başlığı yazın.'); return; }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(yeniTarih)) { tarihAlan.hataGoster('Geçerli bir tarih seçin.'); return; }

            baslikAlan.hataGoster('');
            tarihAlan.hataGoster('');

            /* Servis sonucu 'ok' alanını taşır ('basarili' değil — ilk
               yazımda yanlış okunuyordu ve başarılı çağrıda bile boş hata
               dizisine gidip "Beklenmedik hata" veriyordu, 01.09.2026). */
            function hataMetni(s) {
              return (s && s.hatalar && s.hatalar.length && s.hatalar[0].mesaj) ||
                'İşlem yapılamadı.';
            }
            if (baslik !== dn.ad) {
              var s1 = YU.servis.kampanyaBasligiKaydet(YU.db, { tarih: eskiTarih, baslik: baslik }, YU.oturum.kullanici);
              if (!s1.ok) { baslikAlan.hataGoster(hataMetni(s1)); return; }
            }
            if (yeniTarih !== eskiTarih) {
              var s2 = YU.servis.kampanyaTarihiTasi(YU.db, { eskiTarih: eskiTarih, yeniTarih: yeniTarih }, YU.oturum.kullanici);
              if (!s2.ok) { tarihAlan.hataGoster(hataMetni(s2)); return; }
            }

            m.kapat();
            durum.tarih = yeniTarih;
            YU.donem.tazele();
            govdeyiCiz();
            YU.yenile();
            YU.ui.bildir('Kampanya güncellendi: ' + baslik + ' · ' + YU.fmt.tarih(yeniTarih) + '.', 'olumlu');
          }
        }
      ]
    });
  }

  function kampanyaPaneli() {
    var liste = YU.donem.liste();
    var aktifAd = liste.length ? liste[liste.length - 1].ad : null;
    var satirlar = [], i;
    for (i = liste.length - 1; i >= 0; i--) {
      (function (dn) {
        var kilit = YU.servis.kampanyaKilitDurumu(YU.db, dn.ad);
        var simdiki = dn.ad === aktifAd;
        satirlar.push({
          /* SATIR TIKLANMAZ (kullanıcı kararı, 01.09.2026): kampanya seçme
             kalktı. Liste artık yalnız hangi kampanyaların olduğunu ve kilit
             durumlarını gösterir; Kilitle / Kilidi Aç düğmeleri çalışmaya
             devam eder. Geçmiş veriye ekranların kendi tarih kutusundan
             gidilir. */
          hucreler: [
          YU.h('span', { sinif: 'yu-guclu', metin: dn.ad }),
          /* Süren kampanyada bitiş tarihi yerine "Günümüz" (kullanıcı isteği,
             01.09.2026). dn.suruyor: ardından yeni kampanya açılmamış demektir;
             kilitliyse kampanya kapanmış sayılır ve gerçek aralık yazılır. */
          YU.h('span', { sinif: 'yu-mono',
            metin: YU.fmt.tarih(dn.bas) + ' – ' +
              ((dn.suruyor && !kilit) ? 'Günümüz' : YU.fmt.tarih(dn.bit)) }),
          YU.fmt.sayi(dn.kayitliGun) + ' gün',
          /* Kolon ortalandı; rozetler de kolonun ortasına yaslanır. */
          YU.h('div', { stil: { display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' } },
            /* "Şu Anki" -> "Güncel" (kullanıcı isteği, 01.09.2026). */
            simdiki ? YU.ui.rozet('Güncel', 'vurgu') : YU.ui.rozet('Geçmiş', 'notr'),
            /* İkon RENKSİZ (kullanıcı isteği, 01.09.2026: "kilitlerin de
               rengini kaldır"). Eskiden kilitli kırmızı, açık yeşildi;
               kolondaki etiketler renksizleşince tek renkli öge o kalmıştı.
               Durumu yanındaki "Kilitli / Açık" yazısı ve ikonun biçimi
               (kapalı / açık asma kilit) söylüyor. */
            YU.h('span', {
              stil: { display: 'flex', color: 'var(--metin-3)', flex: 'none' },
              /* Kilitleyen kolonu kalktı; kim ve ne zaman bilgisi buraya
                 taşındı (01.09.2026) — bilgi kaybolmasın. */
              title: kilit
                ? 'Kampanya kilitli — ' + (kilitKullanicisi(kilit) || 'bilinmeyen kullanıcı') +
                  ' · ' + YU.fmt.tarihSaat(kilit.Tarih)
                : 'Kampanya açık'
            }, YU.svg(kilit ? '#ic-kilit' : '#ic-kilit-acik', 17)),
            kilit ? YU.ui.rozet('Kilitli', 'olumsuz') : YU.ui.rozet('Açık', 'olumlu')),
          /* Düzelt + kilit düğmesi yan yana. Düzelt KİLİTLİ kampanyada
             kapalıdır: kilitli kampanya değiştirilemez. */
          YU.h('div', { stil: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
            YU.ui.dugme({
              metin: 'Düzelt', ikon: '#ic-pencil', tur: 'ikincil', kucuk: true,
              pasif: !!kilit,
              baslik: kilit ? 'Kilitli kampanya değiştirilemez — önce kilidi açın'
                            : 'Kampanyanın adını ve başlangıç tarihini değiştir',
              onClick: function () { kampanyaDuzeltModali(dn); }
            }),
            kilit
              ? YU.ui.dugme({ metin: 'Kilidi Aç', ikon: '#ic-kilit-acik', tur: 'tehlike', kucuk: true, onClick: function () { kilidiAcIste(dn); } })
              : YU.ui.dugme({ metin: 'Kilitle', ikon: '#ic-kilit', tur: 'ikincil', kucuk: true, onClick: function () { kilitleIste(dn); } }))
          ]
        });
      })(liste[i]);
    }
    var pnl = YU.ui.panel({
      baslik: 'Kampanya Yönetimi',
      ikon: '#ic-calendar-dots',
      dolgusuz: true,
      sag: YU.ui.dugme({ metin: 'Yeni Kampanya Oluştur', ikon: '#ic-plus', tur: 'birincil', kucuk: true, onClick: yeniKampanyaModali }),
      govde: YU.ui.tablo({
        /* HEPSİNİ ortalamak denendi, kullanıcı beğenmedi ve geri alındı
           (01.09.2026). Ardından YALNIZ İKİ KOLON ortalandı — aynı gün:
           "Kayıtlı Gün ve Durum kolonlarının bilgileri kolonun en sağından
           giriyor, hizalama yok; aynı Ana Sayfa'daki gibi olsun."
           ÖLÇÜLDÜ (Ana Sayfa · Silo Bazında Stok): ilk kolon sola yaslı,
           kalan dokuz kolon ORTALI — başlık da değer de kolonun ortasında.
           Aynı yapı burada bu iki kolona uygulandı; ad ve metin kolonları
           ile eylem kolonu değişmedi.

           KİLİTLEYEN KOLONU KALDIRILDI (kullanıcı isteği, 01.09.2026:
           "kilitleyen kolonunu direkt kaldır"). Kimin ne zaman kilitlediği
           bilgisi kaybolmadı: Durum kolonundaki kilit ikonunun ipucunda ve
           işlem geçmişinde duruyor. kilitKullanicisi yardımcısı yedek kalır.

           Kampanya kolonu 120 -> 170: "deneme kampanyası" iki satıra sarıyor
           ve o satırı 62 px'e çıkarıyordu; iki satır farklı yükseklikteydi. */
        sutunlar: [
          { baslik: 'Kampanya', genislik: 170 },
          { baslik: 'Aralık', genislik: 190 },
          { baslik: 'Kayıtlı Gün', genislik: 110, hiza: 'orta', mono: true },
          { baslik: 'Durum', genislik: 170, hiza: 'orta' },
          { baslik: '', hiza: 'sag', genislik: 230 }
        ],
        satirlar: satirlar,
        dolgu: '9px 18px',
        bos: 'Henüz kampanya yok — ilk devir girildiğinde burada listelenir.'
      })
    });
    pnl.className += ' yu-kampanya-tablo';
    return pnl;
  }

  function govdeyiCiz() {
    if (!dom.govde) return;
    tarihiHazirla();
    YU.bos(dom.govde);
    /* Düzenleme paneli üç yoldan açılır: kayıtlı devir varsa, yeni kampanya
       akışı başlatıldıysa, ya da mevcut bir kampanyada "Elle Gir" seçildiyse.
       KAMPANYA YOKKEN "Elle Gir" ARTIK GEÇMEZ (kullanıcı isteği, 02.09.2026):
       düğme boş durumdan kaldırıldı, burada da kapı kapalı tutulur —
       eski bir durum.elle bayrağı takılı kalsa bile tablo açılmaz. */
    var duzenlemeAcik = devirTarihleri().length > 0 ||
                        !!durum.yeniKampanya ||
                        (durum.elle && kampanyaVarMi());
    if (!duzenlemeAcik) durum.elle = false;
    dom.govde.appendChild(duzenlemeAcik ? duzenlemePaneli() : bosDurumPaneli());
  }

  YU.sayfaTanimla({
    kod: 'devir-stok',
    baslik: 'Devir Stok ve Kampanya Yönetimi',
    menuAd: 'Devir ve Kampanya',    /* menüde kısa ad (31.08.2026) */
    ikon: '#ic-wallet',
    grup: 'Yönetim',
    rol: 'Yonetici',
    ciz: function (kap, param) {
      /* Savunma derinliği: yetki kapısı kabukta da var (Test 7), ama bu ekran
         devir yazdığı için kendi kontrolünü ayrıca yapar. */
      if (!YU.yonetici()) {
        kap.appendChild(YU.ui.bosDurum({
          ikon: '#ic-percent',
          baslik: 'Bu ekrana erişim yetkiniz yok.',
          metin: 'Devir Stok ekranı Yönetici rolü gerektirir. Kampanya açılış stoğu buradan girildiği için ' +
            'operatör hesabına kapalıdır.',
          eylemler: [
            YU.ui.dugme({ metin: 'Ana Sayfa', ikon: '#ic-home', tur: 'birincil', onClick: function () { YU.git('anasayfa'); } })
          ]
        }));
        return;
      }

      /* Sayfa her açıldığında çıkış engeli sıfırlanır: kaydedilmemiş satırlar
         yeniden çizimle zaten gitmiştir. */
      cikisEngeli(false);

      var p = param || {};
      if (p.tarih) durum.tarih = p.tarih;

      kap.appendChild(kampanyaPaneli());

      /* Satır yüksekliği kuralının kapsamı (tema.css .yu-devir-ekran): silo ve
         malzeme devir tablolarının satırları yalnız bu ekranda alçaltılır,
         ortak .yu-tablo ölçüsü ezilmez (KURAL 10.5). Bu sarmalayıcı her
         çizimde yeniden kurulduğu için sınıf başka ekrana taşınmaz. */
      dom.govde = YU.h('div', { sinif: 'yu-devir-ekran', stil: { minWidth: '0' } });
      kap.appendChild(dom.govde);

      govdeyiCiz();
    }
  });
})();

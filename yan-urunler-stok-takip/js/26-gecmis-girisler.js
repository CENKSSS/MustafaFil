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
  var EKSIK_LIMIT = 8;          /* şeritte adı geçen en fazla eksik gün */
  var SAYFA_PENCERE = 7;        /* sayfalama çubuğunda görünen numara sayısı */

  /* Filtre ve tarih seçimi KALDIRILDI (kullanıcı kararı, 24.08.2026 —
     "sade yalın olsun, tarih seçimi olmasın"): ekran doğrudan kayıtlı gün
     listesidir; ayrıntı Program Hareketleri'ne (Detay) gider. Geriye yalnız
     sayfa numarası durum olarak kalır. */
  var durum = { sayfa: 1, gun: null };   /* gun: başlıktaki tarih kutusu — tek güne süzer */
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

  function kisaTarih(iso) { return YU.fmt.tarih(iso).slice(0, 5); }

  /* ------------------------------------------------------------------
     Veri
     ------------------------------------------------------------------ */

  /* Kayıtsız günler, aktif kampanyanın BAŞLANGICINDAN BUGÜNE sayılır
     (kullanıcı isteği, 24.08.2026); dönem yoksa kayıt uçlarına düşülür. */
  function eksikGunler(gunler) {
    var donem = YU.donem.aktif();
    var bas = donem ? donem.bas : (gunler.length ? gunler[gunler.length - 1].tarih : null);
    var bit = YU.tarih.bugun();
    if (!bas || !bit || bas > bit) return [];
    var var_ = {}, i;
    for (i = 0; i < gunler.length; i++) var_[gunler[i].tarih] = 1;
    var eksik = [], t = bas, guvenlik = 0;
    while (t && t <= bit && guvenlik < 1200) {
      if (!var_[t]) eksik.push(t);
      t = YU.tarih.ekle(t, 1);
      guvenlik++;
    }
    return eksik;
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

  function gunSilmeyiBaslat(tarih, malzemeSayisi) {
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
     Filtre bloğu — Kayıtlı Günler panelinin İÇİNDE, başlığın üstünde
     (kullanıcı isteği, 24.08.2026)
     ------------------------------------------------------------------ */

  /* Filtre bloğu kaldırıldı (kullanıcı kararı, 24.08.2026): ekran doğrudan
     kayıtlı günler listesidir, tarih seçimi yok. */

  /* ------------------------------------------------------------------
     Eksik gün şeridi
     ------------------------------------------------------------------ */

  function eksikSeridi(eksik) {
    var gosterilecek = eksik.slice(0, EKSIK_LIMIT);
    var adlar = [], i;
    for (i = 0; i < gosterilecek.length; i++) adlar.push(kisaTarih(gosterilecek[i]));

    var serit = YU.ui.serit({
      tur: 'bilgi', ikon: '#ic-calendar',
      baslik: 'Kayıtlar arasında ' + YU.fmt.sayi(eksik.length) + ' gün kayıtsız: ' + adlar.join(', ') +
        (eksik.length > gosterilecek.length ? ' …' : ''),
      metin: 'Girişi yapılmamış günler. Bir tarihe tıklayınca o günün Kuru Küspe Günlük Giriş ekranı açılır.'
    });

    var kutu = YU.h('div', {
      stil: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', alignItems: 'center' }
    });
    for (i = 0; i < gosterilecek.length; i++) {
      (function (t) {
        kutu.appendChild(YU.ui.dugme({
          metin: kisaTarih(t), baslik: YU.fmt.tarihUzun(t) + ' · ' + YU.fmt.gunAdi(t),
          tur: 'ikincil', kucuk: true, ikon: '#ic-plus',
          onClick: function () { YU.git('kuru-kuspe', { tarih: t }); }
        }));
      })(gosterilecek[i]);
    }
    if (eksik.length > gosterilecek.length) {
      kutu.appendChild(YU.h('span', {
        sinif: 'yu-yardim',
        metin: '+' + YU.fmt.sayi(eksik.length - gosterilecek.length) + ' gün daha'
      }));
    }
    serit.querySelector('.yu-serit-govde').appendChild(kutu);
    return serit;
  }

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
       kalktı; Sil de Detay gibi metinli düğme — kırmızı ve EN SAĞDA. */
    var eylemler = YU.h('div', { stil: { display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' } },
      YU.ui.dugme({
        metin: 'Detay', ikon: '#ic-doc', tur: 'ikincil',
        baslik: 'Program Hareketleri · ' + YU.fmt.tarih(g.tarih),
        onClick: function () { YU.git('gunluk-rapor', { tarih: g.tarih }); }
      }),
      YU.ui.dugme({
        metin: 'Sil', ikon: '#ic-trash', tur: 'tehlike',
        baslik: 'Bu günün tüm girişlerini sil',
        onClick: function () { gunSilmeyiBaslat(g.tarih, g.malzemeSayisi); }
      })
    );

    var kunye = gunKunyesi(g.tarih);
    return [
      YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.tarih(g.tarih) }),
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

  /* Panel dolgusuz olduğu için şerit ve uyarılar kendi kenar boşluğunu ister. */
  function dolguKutu(icerik) {
    return YU.h('div', { stil: { padding: '16px 18px' } }, icerik);
  }

  function listeyiCiz(kap) {
    YU.bos(kap);

    var gunler = YU.stok.kayitliGunler(YU.db, null, null);
    var eksik = eksikGunler(gunler);
    if (eksik.length) kap.appendChild(dolguKutu(eksikSeridi(eksik)));

    var liste = [], j;
    for (j = 0; j < gunler.length; j++) {
      /* Başlıktaki tarih kutusu tek güne süzer (kullanıcı isteği, 24.08.2026). */
      if (durum.gun && gunler[j].tarih !== durum.gun) continue;
      liste.push({ gun: gunler[j] });
    }

    if (!liste.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-calendar',
        baslik: durum.gun ? YU.fmt.tarih(durum.gun) + ' için kayıt yok' : 'Kayıtlı gün yok',
        metin: durum.gun
          ? 'Seçilen tarihte girilmiş gün yok.'
          : 'Henüz hiçbir güne giriş yapılmamış. İlk günü Kuru Küspe Günlük Giriş ekranından girin.',
        eylemler: durum.gun ? [
          YU.ui.dugme({
            metin: 'Tümünü Göster', ikon: '#ic-calendar', tur: 'ikincil',
            onClick: function () { durum.gun = null; durum.sayfa = 1; listeyiTazele(); }
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

    /* Başlıkta tek günlük tarih seçimi (kullanıcı isteği, 24.08.2026):
       kutu doluysa liste o güne iner, boşaltınca tümü döner. */
    var gunAlan = YU.ui.alan({
      tip: 'tarih', deger: durum.gun || '', genislik: '148px',
      onChange: function () {
        durum.gun = gunAlan.girdi.value || null;
        durum.sayfa = 1;
        listeyiTazele();
      }
    });

    /* Tarih kutusu SOLDA, Tarih kolonunun üzerinde durur (kullanıcı isteği,
       24.08.2026); sağ uçta yalnız gün sayacı kalır. */
    kap.appendChild(YU.h('div', {
      sinif: 'yu-panel-bas',
      stil: { padding: '15px 18px', marginBottom: '0', borderBottom: '1px solid var(--ayrac)', gap: '12px' }
    },
      YU.h('span', { stil: { display: 'flex', color: 'var(--vurgu)' } }, YU.svg('#ic-calendar', 18)),
      YU.h('div', { sinif: 'yu-panel-baslik', metin: 'Kayıtlı Günler', stil: { flex: '0 0 auto' } }),
      gunAlan.kok,
      /* Tek tıkla sıfırlama (kullanıcı isteği, 24.08.2026): kutu doluyken
         görünür; tarih filtresini kaldırıp bütün günlere döner. */
      durum.gun ? YU.ui.dugme({
        metin: 'Tarihi Sıfırla', ikon: '#ic-calendar', tur: 'sade', kucuk: true,
        onClick: function () { durum.gun = null; durum.sayfa = 1; listeyiTazele(); }
      }) : null,
      YU.h('span', { stil: { flex: '1' } }),
      YU.h('div', { sinif: 'yu-panel-sag' }, YU.h('span', { metin: YU.fmt.sayi(liste.length) + ' gün' }))
    ));
    kap.appendChild(tablo);
    kap.appendChild(sayfalamaSeridi(liste.length, dilim.length, sayfaSayisi));
  }

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  YU.sayfaTanimla({
    kod: 'gecmis-girisler',
    zemin: 'gri-duz',   /* Stok Durumu ile aynı panel rengi (kullanıcı isteği, 24.08.2026) */
    baslik: 'Geçmiş Girişler',
    altBaslik: 'Kayıtlı günler · ilk ve son veri girişi, gün silme · ayrıntı için satıra tıklayın',
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

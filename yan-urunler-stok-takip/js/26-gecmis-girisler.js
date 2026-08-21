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

  var HAZIR_ARALIKLAR = [
    { kod: 'gun7', metin: 'Son 7 gün' },
    { kod: 'gun30', metin: 'Son 30 gün' },
    { kod: 'kampanya', metin: 'Bu kampanya' },
    { kod: 'tumu', metin: 'Tümü' }
  ];

  /* Filtre modül düzeyinde durur: silme/düzeltme sonrası sayfa yeniden çizilince
     kullanıcının seçtiği aralık ve arama kaybolmasın. */
  var durum = { bas: null, bit: null, ara: '', sayfa: 1, hazirAralik: null, kuruldu: false };
  var sonParamImzasi = null;
  var dom = { liste: null, basAlan: null, bitAlan: null, hazirDugmeler: [] };

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
     Aralık
     ------------------------------------------------------------------ */

  /* Hazır aralıklar sistem tarihine değil SON KAYITLI güne dayanır: prototip
     verisi geçmiş bir kampanyaya ait, "son 7 gün" bugüne göre ölçülürse hep boş
     çıkar ve düğme işlevsiz görünür. Kullanılan referans ekranda yazılır. */
  function referansGun() {
    var l = YU.stok.kayitliGunler(YU.db, null, null);
    return l.length ? l[0].tarih : YU.tarih.bugun();
  }

  function araligiKur(kod) {
    durum.hazirAralik = kod;
    durum.sayfa = 1;
    if (kod === 'tumu') { durum.bas = null; durum.bit = null; return; }
    if (kod === 'kampanya') {
      var d = YU.donem.aktif();
      durum.bas = d ? d.bas : null;
      durum.bit = d ? d.bit : null;
      return;
    }
    var r = referansGun();
    durum.bit = r;
    durum.bas = YU.tarih.ekle(r, kod === 'gun7' ? -6 : -29);
  }

  function baslat(param) {
    var p = param || {};
    if (!durum.kuruldu) {
      araligiKur(YU.donem.aktif() ? 'kampanya' : 'tumu');
      durum.kuruldu = true;
    }
    /* Adres çubuğundaki parametre her yeniden çizimde değil, yalnız DEĞİŞTİĞİNDE
       uygulanır — yoksa kullanıcının elle seçtiği aralık her tazelemede geri alınır. */
    var imza = (p.bas || '') + '|' + (p.bit || '') + '|' + (p.ara === undefined ? '' : p.ara);
    if (imza === sonParamImzasi) return;
    sonParamImzasi = imza;
    if (p.bas || p.bit) {
      durum.bas = p.bas || null;
      durum.bit = p.bit || null;
      durum.hazirAralik = null;
      durum.sayfa = 1;
    }
    if (p.ara !== undefined) { durum.ara = p.ara; durum.sayfa = 1; }
  }

  /* ------------------------------------------------------------------
     Veri
     ------------------------------------------------------------------ */

  function kuruKuspeHaritasi() {
    var h = {}, liste = YU.db.kuruKuspeGunluk || [], i;
    for (i = 0; i < liste.length; i++) h[liste[i].Tarih] = liste[i];
    return h;
  }

  function satirlariSuz(gunler, harita) {
    var q = String(durum.ara || '').trim().toLocaleLowerCase('tr');
    var liste = [], i, g, kk, metin;
    for (i = 0; i < gunler.length; i++) {
      g = gunler[i];
      kk = harita[g.tarih] || null;
      if (q) {
        metin = (YU.fmt.tarih(g.tarih) + ' ' + g.tarih + ' ' + (g.kullanici || '')).toLocaleLowerCase('tr');
        if (metin.indexOf(q) < 0) continue;
      }
      liste.push({
        gun: g,
        kk: kk,
        hesap: kk ? YU.hesap.kuruKuspe(kk.UretilenDokme, kk.CuvalAdet, kk.SatilanDokme) : null
      });
    }
    return liste;
  }

  /* Aralıkta hiç kaydı olmayan günler. Aralık ucu boşsa (Tümü) kayıtların ilk ve
     son günü sınır alınır — açık uçlu döngü olmaz. */
  function eksikGunler(gunler) {
    var bas = durum.bas || (gunler.length ? gunler[gunler.length - 1].tarih : null);
    var bit = durum.bit || (gunler.length ? gunler[0].tarih : null);
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

  /* ------------------------------------------------------------------
     Satır içi eylemler
     ------------------------------------------------------------------ */

  function eylemDugmesi(ikon, baslik, onClick, tehlike) {
    return YU.h('span', {
      sinif: 'yu-satir-eylem' + (tehlike ? ' tehlike' : ''),
      role: 'button', tabindex: '0', title: baslik, 'aria-label': baslik,
      onClick: onClick,
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }
    }, YU.svg(ikon, 14));
  }

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
     Filtre paneli
     ------------------------------------------------------------------ */

  function hazirDugmeleriIsaretle() {
    var i, d;
    for (i = 0; i < dom.hazirDugmeler.length; i++) {
      d = dom.hazirDugmeler[i];
      d.el.className = 'yu-dugme kucuk ' + (durum.hazirAralik === d.kod ? 'birincil' : 'ikincil');
    }
  }

  function filtrePaneli() {
    var basAlan = YU.ui.alan({
      etiket: 'Başlangıç', tip: 'tarih', deger: durum.bas || '', genislik: 168,
      onChange: function () {
        durum.bas = basAlan.girdi.value || null;
        durum.hazirAralik = null;
        durum.sayfa = 1;
        hazirDugmeleriIsaretle();
        listeyiTazele();
      }
    });
    var bitAlan = YU.ui.alan({
      etiket: 'Bitiş', tip: 'tarih', deger: durum.bit || '', genislik: 168,
      onChange: function () {
        durum.bit = bitAlan.girdi.value || null;
        durum.hazirAralik = null;
        durum.sayfa = 1;
        hazirDugmeleriIsaretle();
        listeyiTazele();
      }
    });
    var araAlan = YU.ui.alan({
      etiket: 'Ara', tip: 'metin', deger: durum.ara, genislik: 260,
      yerTutucu: 'Tarih (03.07.2026) veya kullanıcı adı',
      onInput: function () {
        durum.ara = araAlan.girdi.value;
        durum.sayfa = 1;
        listeyiTazele();
      }
    });
    dom.basAlan = basAlan;
    dom.bitAlan = bitAlan;

    var dugmeSatiri = YU.h('div', { stil: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    dom.hazirDugmeler = [];
    for (var i = 0; i < HAZIR_ARALIKLAR.length; i++) {
      (function (h) {
        var d = YU.ui.dugme({
          metin: h.metin, tur: 'ikincil', kucuk: true,
          onClick: function () {
            araligiKur(h.kod);
            basAlan.ayarla(durum.bas || '');
            bitAlan.ayarla(durum.bit || '');
            hazirDugmeleriIsaretle();
            listeyiTazele();
          }
        });
        dom.hazirDugmeler.push({ kod: h.kod, el: d });
        dugmeSatiri.appendChild(d);
      })(HAZIR_ARALIKLAR[i]);
    }
    hazirDugmeleriIsaretle();

    var hazirKutu = YU.h('div', { sinif: 'yu-alan' },
      YU.h('label', { sinif: 'yu-etiket', metin: 'Hazır Aralık' }),
      dugmeSatiri
    );

    var satir = YU.h('div', {
      stil: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }
    }, basAlan.kok, bitAlan.kok, araAlan.kok, YU.h('div', { stil: { flex: '1', minWidth: '12px' } }), hazirKutu);

    var yardim = YU.h('div', {
      sinif: 'yu-yardim',
      metin: 'Son 7 / Son 30 gün, son kayıtlı güne (' + YU.fmt.tarih(referansGun()) +
        ') göre hesaplanır. Tarih alanı boş bırakılırsa o uç sınırsızdır.'
    });

    return YU.ui.panel({ baslik: 'Filtre', ikon: '#ic-filter', govde: [satir, yardim] });
  }

  /* ------------------------------------------------------------------
     Eksik gün şeridi
     ------------------------------------------------------------------ */

  function eksikSeridi(eksik) {
    var gosterilecek = eksik.slice(0, EKSIK_LIMIT);
    var adlar = [], i;
    for (i = 0; i < gosterilecek.length; i++) adlar.push(kisaTarih(gosterilecek[i]));

    var serit = YU.ui.serit({
      tur: 'bilgi', ikon: '#ic-calendar',
      baslik: 'Aralıkta ' + YU.fmt.sayi(eksik.length) + ' gün kayıtsız: ' + adlar.join(', ') +
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

  function sonGuncellemeHucresi(g) {
    if (!g.sonGuncelleme) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    return YU.h('div', null,
      YU.h('div', { metin: YU.fmt.tarihSaat(g.sonGuncelleme) }),
      YU.h('div', { sinif: 'yu-yardim', metin: g.kullanici || 'kullanıcı bilinmiyor' })
    );
  }

  function tabloSatiri(kayit) {
    var g = kayit.gun, kk = kayit.kk, h = kayit.hesap;

    var netHucre;
    if (!h) {
      netHucre = YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    } else if (h.durum === 'B') {
      /* Durum B: çuvallama üretimi aştı, net üretim 0 — ham girdi kaybolmasın diye
         satırda işaretlenir (Şartname §4 "Raporlamada dikkat"). */
      netHucre = YU.h('span', {
        stil: { display: 'inline-flex', alignItems: 'center', gap: '7px', justifyContent: 'flex-end' }
      }, YU.h('span', { metin: YU.fmt.kg(h.netDokmeUretim) }), YU.ui.rozet('B', 'bekleyen'));
    } else {
      netHucre = YU.fmt.kg(h.netDokmeUretim);
    }

    var eylemler = YU.h('div', { stil: { display: 'flex', gap: '3px', justifyContent: 'flex-end' } },
      eylemDugmesi('#ic-pencil', 'Düzelt — Kuru Küspe Günlük Giriş', function () {
        YU.git('kuru-kuspe', { tarih: g.tarih });
      }),
      eylemDugmesi('#ic-doc', 'Günlük rapor', function () {
        YU.git('gunluk-rapor', { tarih: g.tarih });
      }),
      eylemDugmesi('#ic-trash', 'Bu günün tüm girişlerini sil', function () {
        gunSilmeyiBaslat(g.tarih, g.malzemeSayisi);
      }, true)
    );

    return [
      YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.tarih(g.tarih) }),
      YU.h('span', { sinif: 'yu-zayif', metin: YU.fmt.gunAdi(g.tarih) }),
      kk ? YU.fmt.kg(kk.UretilenDokme) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
      kk ? YU.fmt.sayi(kk.CuvalAdet) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
      netHucre,
      kk ? YU.fmt.kg(kk.SatilanDokme) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
      YU.fmt.sayi(g.malzemeSayisi),
      sonGuncellemeHucresi(g),
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

  function sayfalamaSeridi(toplam, gosterilen, sayfaSayisi) {
    var kap = YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px',
        borderTop: '1px solid var(--ayrac)', font: '400 13px/1.6 var(--font)', color: 'var(--metin-5)'
      }
    });
    kap.appendChild(YU.h('span', {
      metin: YU.fmt.sayi(toplam) + ' kayıttan ' + sayiEkli(gosterilen) + ' gösteriliyor'
    }));
    kap.appendChild(YU.h('div', { stil: { flex: '1' } }));

    var numaralar = sayfaNumaralari(durum.sayfa, sayfaSayisi), i;
    for (i = 0; i < numaralar.length; i++) {
      if (numaralar[i] === null) {
        kap.appendChild(YU.h('span', { metin: '…', stil: { padding: '4px 4px' } }));
        continue;
      }
      (function (no) {
        var aktifMi = no === durum.sayfa;
        var stil = { padding: '4px 8px', borderRadius: '5px', cursor: 'pointer' };
        if (aktifMi) {
          stil.border = '1px solid var(--kenar-2)';
          stil.color = 'var(--metin)';
        }
        kap.appendChild(YU.h('span', {
          metin: YU.fmt.sayi(no), stil: stil, role: 'button', tabindex: '0',
          title: YU.fmt.sayi(no) + '. sayfa',
          onClick: function () { durum.sayfa = no; listeyiTazele(); },
          onKeyDown: function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); durum.sayfa = no; listeyiTazele(); }
          }
        }));
      })(numaralar[i]);
    }
    return kap;
  }

  /* ------------------------------------------------------------------
     Liste
     ------------------------------------------------------------------ */

  function listeyiTazele() { if (dom.liste) listeyiCiz(dom.liste); }

  function aralikMetni() {
    if (durum.bas && durum.bit) return YU.fmt.tarih(durum.bas) + ' – ' + YU.fmt.tarih(durum.bit);
    if (durum.bas) return YU.fmt.tarih(durum.bas) + ' ve sonrası';
    if (durum.bit) return YU.fmt.tarih(durum.bit) + ' ve öncesi';
    return 'tüm kayıtlar';
  }

  function listeyiCiz(kap) {
    YU.bos(kap);

    if (durum.bas && durum.bit && durum.bas > durum.bit) {
      kap.appendChild(YU.ui.serit({
        tur: 'hata', baslik: 'Tarih Aralığı Geçersiz',
        metin: 'Bitiş tarihi (' + YU.fmt.tarih(durum.bit) + ') başlangıç tarihinden (' +
          YU.fmt.tarih(durum.bas) + ') önce olamaz.'
      }));
      return;
    }

    var gunler = YU.stok.kayitliGunler(YU.db, durum.bas, durum.bit);
    var eksik = eksikGunler(gunler);
    if (eksik.length) kap.appendChild(eksikSeridi(eksik));

    var liste = satirlariSuz(gunler, kuruKuspeHaritasi());

    if (!liste.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-calendar',
        baslik: durum.ara ? 'Aramaya uyan gün yok' : 'Bu aralıkta kayıt yok',
        metin: durum.ara
          ? '“' + durum.ara + '” için ' + aralikMetni() + ' aralığında kayıtlı gün bulunamadı. Aramayı temizleyin veya aralığı genişletin.'
          : aralikMetni() + ' aralığında girilmiş gün yok. Aralığı genişletin ya da yeni bir gün girin.',
        eylemler: [
          YU.ui.dugme({
            metin: 'Kuru Küspe Girişi', ikon: '#ic-plus', tur: 'birincil',
            onClick: function () { YU.git('kuru-kuspe'); }
          }),
          YU.ui.dugme({
            metin: 'Tüm Kayıtlar', ikon: '#ic-calendar', tur: 'ikincil',
            onClick: function () {
              araligiKur('tumu');
              durum.ara = '';
              if (dom.basAlan) dom.basAlan.ayarla('');
              if (dom.bitAlan) dom.bitAlan.ayarla('');
              hazirDugmeleriIsaretle();
              listeyiTazele();
            }
          })
        ]
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

    var tablo = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Tarih', genislik: 110 },
        { baslik: 'Gün', genislik: 96 },
        { baslik: 'Üretilen Dökme', hiza: 'sag', mono: true, genislik: 132 },
        { baslik: 'Çuval Adet', hiza: 'sag', mono: true, genislik: 104 },
        { baslik: 'Net Dökme', hiza: 'sag', mono: true, genislik: 140 },
        { baslik: 'Satılan Dökme', hiza: 'sag', mono: true, genislik: 128 },
        { baslik: 'Malzeme Satırı', hiza: 'sag', mono: true, genislik: 124 },
        { baslik: 'Son Güncelleme', genislik: 168 },
        { baslik: 'İşlem', hiza: 'sag', genislik: 112 }
      ],
      satirlar: satirlar,
      bos: 'Bu aralıkta kayıtlı gün yok.'
    });

    kap.appendChild(YU.ui.panel({
      baslik: 'Kayıtlı Günler',
      ikon: '#ic-calendar',
      dolgusuz: true,
      sag: YU.h('span', { metin: aralikMetni() }),
      govde: [tablo, sayfalamaSeridi(liste.length, dilim.length, sayfaSayisi)]
    }));
  }

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  YU.sayfaTanimla({
    kod: 'gecmis-girisler',
    baslik: 'Geçmiş Girişler',
    altBaslik: 'Tarih aralığına göre girilmiş günler · düzeltme, günlük rapor ve gün silme',
    ikon: '#ic-calendar',
    grup: 'Takip',
    rol: 'Hepsi',
    ciz: function (kap, param) {
      baslat(param);

      YU.ui.sayfaEylemleri(YU.ui.dugme({
        metin: 'Kuru Küspe Girişi', ikon: '#ic-plus', tur: 'birincil',
        onClick: function () { YU.git('kuru-kuspe'); }
      }));

      kap.appendChild(filtrePaneli());

      var listeKap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '20px' } });
      dom.liste = listeKap;
      kap.appendChild(listeKap);
      listeyiCiz(listeKap);
    }
  });
})();

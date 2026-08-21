/* js/29-kullanici-yonetimi.js — Kullanıcı Yönetimi (Şartname §7 · SÖZLEŞME §7).
   Ekleme, düzenleme, parola sıfırlama, aktif/pasif.

   D9 (kendi hesabını pasifleştirme) ve D10 (son aktif yönetici) burada iki kez
   savunulur: ekranda ilgili kontrol pasifleşir, kaydetme yolunda ise
   YU.servis.kullaniciKaydet → YU.dogrula.kullanici aynı kuralı yeniden uygular.
   Şartname §8: "tek savunma hattı ekran olmamalı".

   Parola prototipte saklanmaz; sıfırlama yalnızca "(sıfırlandı)" izi bırakır. */
(function () {
  'use strict';

  var YU = window.YU;

  var ROL_ADI = { Yonetici: 'Yönetici', Operator: 'Operatör' };

  /* Gerçek uygulamada bu alan BCrypt hash'i tutar (Şartname §3). Prototipte
     yalnızca "ne zaman sıfırlandı" notudur — parola metni hiçbir yere yazılmaz. */
  var PAROLA_NOTU_ONEK = '(prototip — parola saklanmaz · sıfırlama ';

  /* ==================================================================
     Ortak yardımcılar
     ================================================================== */

  function db() { return YU.db; }
  function oturumKullanicisi() { return YU.oturum.kullanici; }

  function damga() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function rolMetni(rol) { return ROL_ADI[rol] || '—'; }

  function aktifMi(k) { return k.Aktif !== false; }

  function aktifYoneticiSayisi() {
    var liste = db().kullanicilar, n = 0, i;
    for (i = 0; i < liste.length; i++) if (liste[i].Rol === 'Yonetici' && aktifMi(liste[i])) n++;
    return n;
  }

  function aktifOperatorSayisi() {
    var liste = db().kullanicilar, n = 0, i;
    for (i = 0; i < liste.length; i++) if (liste[i].Rol === 'Operator' && aktifMi(liste[i])) n++;
    return n;
  }

  function pasifSayisi() {
    var liste = db().kullanicilar, n = 0, i;
    for (i = 0; i < liste.length; i++) if (!aktifMi(liste[i])) n++;
    return n;
  }

  /* D10 karşılığı — 03-dogrulama.js ile aynı ölçü: başka aktif yönetici yoksa. */
  function sonAktifYoneticiMi(k) {
    return k.Rol === 'Yonetici' && aktifMi(k) && aktifYoneticiSayisi() === 1;
  }

  function kendiHesabiMi(k) {
    var o = oturumKullanicisi();
    return !!o && o.Id === k.Id;
  }

  /* Kullanıcının izini taşıyan satır sayısı — pasifleştirmenin neden silme
     olmadığını (D12) somutlaştırır. */
  function kullaniciKayitSayisi(id) {
    var d = db(), n = 0;
    var tablolar = [d.kuruKuspeGunluk, d.gunlukHareket, d.siloHareket, d.devirStok, d.siloDevirStok];
    var i, j, s;
    for (i = 0; i < tablolar.length; i++) {
      for (j = 0; j < tablolar[i].length; j++) {
        s = tablolar[i][j];
        if (s.OlusturanKullaniciId === id || s.GuncelleyenKullaniciId === id) n++;
      }
    }
    return n;
  }

  function durumRozeti(k) {
    return aktifMi(k) ? YU.ui.rozet('Aktif', 'olumlu') : YU.ui.rozet('Pasif', 'notr');
  }

  function rolRozeti(k) {
    return k.Rol === 'Yonetici' ? YU.ui.rozet('Yönetici', 'vurgu') : YU.ui.rozet('Operatör', 'notr');
  }

  function eylemKabi() {
    return YU.h('div', {
      stil: { display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }
    });
  }

  function satirEylem(s) {
    var el = YU.h('span', {
      sinif: 'yu-satir-eylem', role: 'button', tabindex: '0',
      title: s.baslik, 'aria-label': s.baslik
    }, YU.svg(s.ikon, 15));
    el.addEventListener('click', s.onClick);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.onClick(); }
    });
    return el;
  }

  /* Devre dışı düğme fare olaylarını yutabildiği için title sarmalayıcıya konur:
     "neden pasif" bilgisi üstüne gelince mutlaka görünmeli. */
  function ipucuIle(el, ipucu) {
    if (!ipucu) return el;
    return YU.h('span', { title: ipucu, stil: { display: 'inline-flex' } }, el);
  }

  /* Bir kullanıcı için "pasifleştirilemez" gerekçesi; yoksa null. */
  function pasiflestirmeEngeli(k) {
    if (!aktifMi(k)) return null;
    if (kendiHesabiMi(k)) return 'D9 — kendi hesabınızı pasifleştiremezsiniz.';
    if (sonAktifYoneticiMi(k)) {
      return 'D10 — ' + k.AdSoyad + ' sistemdeki son aktif yönetici. Pasifleştirilirse sisteme kimse ' +
        'yönetici olarak giremez.';
    }
    return null;
  }

  /* Rolü operatöre düşürme gerekçesi; yoksa null. */
  function rolDusurmeEngeli(k) {
    if (!sonAktifYoneticiMi(k)) return null;
    return 'D10 — ' + k.AdSoyad + ' sistemdeki son aktif yönetici. Operatöre düşürülemez.';
  }

  function sonucuBildir(sonuc, basariMetni) {
    if (!sonuc.ok) {
      YU.ui.bildir(sonuc.hatalar.length ? sonuc.hatalar[0].mesaj : 'İşlem tamamlanamadı.', 'hata');
      return false;
    }
    YU.ui.bildir(basariMetni, 'basari');
    return true;
  }

  /* ==================================================================
     Kullanıcı modali
     ================================================================== */

  function secenekPasiflestir(alan, deger, ipucu) {
    var o = alan.girdi.options, i;
    for (i = 0; i < o.length; i++) {
      if (o[i].value === deger) { o[i].disabled = true; o[i].title = ipucu; }
    }
  }

  function yardimYaz(alan, metin) {
    var el = alan.kok.querySelector('.yu-yardim');
    if (el) el.textContent = metin;
  }

  function kullaniciModali(kullanici) {
    var duzenle = !!kullanici;
    var hataKap = YU.h('div');

    var adiAlan = YU.ui.alan({
      etiket: 'Kullanıcı Adı', tip: 'metin',
      deger: duzenle ? kullanici.KullaniciAdi : '',
      yardim: 'Aynı kullanıcı adı iki kez eklenemez (D11).'
    });
    var adSoyadAlan = YU.ui.alan({
      etiket: 'Ad Soyad', tip: 'metin',
      deger: duzenle ? kullanici.AdSoyad : ''
    });
    var rolAlan = YU.ui.alan({
      etiket: 'Rol', tip: 'secim',
      secenekler: [{ deger: 'Yonetici', metin: 'Yönetici' }, { deger: 'Operator', metin: 'Operatör' }],
      deger: duzenle ? kullanici.Rol : 'Operator',
      yardim: 'Yönetici: tüm ekranlar. Operatör: günlük giriş, stok ve rapor görüntüleme.'
    });
    var durumAlan = YU.ui.alan({
      etiket: 'Durum', tip: 'secim',
      secenekler: [{ deger: 'aktif', metin: 'Aktif' }, { deger: 'Pasif', metin: 'Pasif' }],
      deger: duzenle && !aktifMi(kullanici) ? 'Pasif' : 'aktif',
      yardim: 'Kullanıcı silinmez, yalnızca pasifleştirilir (D12). Geçmiş kayıtlardaki adı korunur.'
    });

    if (duzenle) {
      var rolEngeli = rolDusurmeEngeli(kullanici);
      if (rolEngeli) {
        secenekPasiflestir(rolAlan, 'Operator', rolEngeli);
        yardimYaz(rolAlan, rolEngeli);
      }
      var durumEngeli = pasiflestirmeEngeli(kullanici);
      if (durumEngeli) {
        secenekPasiflestir(durumAlan, 'Pasif', durumEngeli);
        yardimYaz(durumAlan, durumEngeli);
      }
    }

    var notlar = duzenle ? null : YU.h('div', {
      sinif: 'yu-yardim',
      metin: 'Prototipte parola belirlenmez ve saklanmaz. Gerçek uygulamada kullanıcı adı + BCrypt hash’li ' +
        'parola ile giriş yapılır (Şartname §3).'
    });

    var m = YU.ui.modal({
      baslik: duzenle ? 'Kullanıcıyı düzenle' : 'Yeni Kullanıcı',
      genislik: 520,
      govde: [hataKap, adiAlan.kok, adSoyadAlan.kok, rolAlan.kok, durumAlan.kok, notlar],
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m.kapat(); } },
        { metin: duzenle ? 'Kaydet' : 'Ekle', tur: 'birincil', onClick: kaydet }
      ]
    });

    function kaydet() {
      var aday = {
        Id: duzenle ? kullanici.Id : null,
        KullaniciAdi: adiAlan.deger(),
        AdSoyad: adSoyadAlan.deger(),
        Rol: rolAlan.deger(),
        Aktif: durumAlan.deger() !== 'Pasif'
      };

      /* İkinci savunma hattı: ekran kilitlense de servis aynı kuralı uygular. */
      var sonuc = YU.servis.kullaniciKaydet(db(), aday, oturumKullanicisi());
      if (!sonuc.ok) {
        YU.bos(hataKap).appendChild(YU.ui.hataListesi(sonuc.hatalar, 'hata'));
        return;
      }
      m.kapat();
      YU.ui.bildir(sonuc.kayit.AdSoyad + ' ' + (duzenle ? 'güncellendi.' : 'eklendi.'), 'basari');
      YU.yenile();
    }

    adiAlan.odakla();
    return m;
  }

  /* ==================================================================
     Parola sıfırlama — parola metni hiçbir yerde tutulmaz
     ================================================================== */

  function parolaModali(kullanici) {
    var m = YU.ui.modal({
      baslik: 'Parola Sıfırla',
      genislik: 500,
      govde: [
        YU.h('div', {
          metin: kullanici.AdSoyad + ' (' + kullanici.KullaniciAdi + ') hesabının parolası sıfırlanacak.'
        })
      ],
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m.kapat(); } },
        { metin: 'Parolayı sıfırla', tur: 'birincil', onClick: sifirla }
      ]
    });

    function sifirla() {
      var sonuc = YU.servis.kullaniciKaydet(db(), {
        Id: kullanici.Id,
        KullaniciAdi: kullanici.KullaniciAdi,
        AdSoyad: kullanici.AdSoyad,
        Rol: kullanici.Rol,
        Aktif: kullanici.Aktif,
        ParolaHash: PAROLA_NOTU_ONEK + damga() + ')'
      }, oturumKullanicisi());
      m.kapat();
      if (sonucuBildir(sonuc, kullanici.AdSoyad + ' parolası sıfırlandı.')) YU.yenile();
    }

    return m;
  }

  /* ==================================================================
     Aktif / pasif
     ================================================================== */

  function durumDegistir(kullanici) {
    var pasifeAl = aktifMi(kullanici);
    var engel = pasiflestirmeEngeli(kullanici);
    if (pasifeAl && engel) { YU.ui.bildir(engel, 'hata'); return; }

    var sayi = kullaniciKayitSayisi(kullanici.Id);
    var metin = pasifeAl
      ? kullanici.AdSoyad + ' pasifleştirilecek. Hesap silinmez (D12): giriş yapamaz ama ' +
        (sayi ? YU.fmt.sayi(sayi) + ' geçmiş kaydında adı görünmeye devam eder.' : 'geçmiş kayıtlardaki bağları korunur.')
      : kullanici.AdSoyad + ' yeniden aktifleştirilecek ve giriş yapabilecek.';

    YU.ui.onay({
      baslik: pasifeAl ? 'Kullanıcıyı pasifleştir' : 'Kullanıcıyı aktifleştir',
      metin: metin,
      onayMetni: pasifeAl ? 'Pasifleştir' : 'Aktifleştir',
      tehlike: pasifeAl
    }).then(function (evet) {
      if (!evet) return;
      var sonuc = YU.servis.kullaniciKaydet(db(), {
        Id: kullanici.Id,
        KullaniciAdi: kullanici.KullaniciAdi,
        AdSoyad: kullanici.AdSoyad,
        Rol: kullanici.Rol,
        Aktif: !pasifeAl
      }, oturumKullanicisi());
      if (sonucuBildir(sonuc, kullanici.AdSoyad + ' ' + (pasifeAl ? 'pasifleştirildi.' : 'aktifleştirildi.'))) {
        YU.yenile();
      }
    });
  }

  /* ==================================================================
     Tablo
     ================================================================== */

  function kullaniciSatiri(k) {
    var engel = pasiflestirmeEngeli(k);
    var eylemler = eylemKabi();

    eylemler.appendChild(satirEylem({
      ikon: '#ic-pencil', baslik: 'Düzenle',
      onClick: function () { kullaniciModali(k); }
    }));
    eylemler.appendChild(satirEylem({
      ikon: '#ic-gear', baslik: 'Parola Sıfırla',
      onClick: function () { parolaModali(k); }
    }));

    var durumDugmesi = YU.ui.dugme({
      metin: aktifMi(k) ? 'Pasifleştir' : 'Aktifleştir',
      tur: aktifMi(k) ? 'sade' : 'ikincil',
      kucuk: true,
      pasif: !!engel,
      baslik: engel || (aktifMi(k)
        ? 'Kullanıcı silinmez; yalnızca pasifleştirilir (D12).'
        : 'Hesabı yeniden girişe aç.'),
      onClick: function () { durumDegistir(k); }
    });
    eylemler.appendChild(ipucuIle(durumDugmesi, engel));

    var adHucresi = YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '8px' } },
      YU.h('span', { sinif: aktifMi(k) ? 'yu-guclu' : 'yu-zayif', metin: k.AdSoyad }),
      kendiHesabiMi(k) ? YU.ui.rozet('Siz', 'vurgu') : null
    );

    return {
      hucreler: [
        YU.h('span', { sinif: 'yu-mono', metin: k.KullaniciAdi }),
        adHucresi,
        rolRozeti(k),
        durumRozeti(k),
        YU.fmt.sayi(kullaniciKayitSayisi(k.Id)),
        eylemler
      ]
    };
  }

  function kullaniciTablosu() {
    var liste = db().kullanicilar.slice().sort(function (a, b) {
      if (aktifMi(a) !== aktifMi(b)) return aktifMi(a) ? -1 : 1;
      if (a.Rol !== b.Rol) return a.Rol === 'Yonetici' ? -1 : 1;
      return (a.Id || 0) - (b.Id || 0);
    });
    var satirlar = [], i;
    for (i = 0; i < liste.length; i++) satirlar.push(kullaniciSatiri(liste[i]));

    return YU.ui.tablo({
      sutunlar: [
        { baslik: 'Kullanıcı Adı', genislik: 150 },
        { baslik: 'Ad Soyad' },
        { baslik: 'Rol', genislik: 110, hiza: 'orta' },
        { baslik: 'Durum', genislik: 96, hiza: 'orta' },
        { baslik: 'Kayıt Sayısı', genislik: 110, hiza: 'sag', mono: true },
        { baslik: 'İşlem', genislik: 178, hiza: 'sag' }
      ],
      satirlar: satirlar,
      bos: 'Tanımlı kullanıcı yok.',
      yapiskan: true
    });
  }

  /* ==================================================================
     Sayfa
     ================================================================== */

  YU.sayfaTanimla({
    kod: 'kullanici-yonetimi',
    baslik: 'Kullanıcı Yönetimi',
    altBaslik: function () {
      var d = YU.db;
      if (!d) return '';
      return YU.fmt.sayi(d.kullanicilar.length) + ' kullanıcı · ' +
        YU.fmt.sayi(aktifYoneticiSayisi()) + ' aktif yönetici · ' +
        YU.fmt.sayi(aktifOperatorSayisi()) + ' aktif operatör';
    },
    ikon: '#ic-users',
    grup: 'Yönetim',
    rol: 'Yonetici',

    ciz: function (kap) {
      YU.bos(kap);

      /* Yönlendirici zaten yetki kapısı işletiyor; ekran kendi kontrolünü de yapar. */
      if (!YU.yonetici()) {
        kap.appendChild(YU.ui.bosDurum({
          ikon: '#ic-percent',
          baslik: 'Bu ekrana erişim yetkiniz yok.',
          metin: 'Kullanıcı Yönetimi yalnızca Yönetici rolüne açıktır.'
        }));
        return;
      }

      var yoneticiSayisi = aktifYoneticiSayisi();

      kap.appendChild(YU.h('div', { sinif: 'yu-izgara yu-iz-3' },
        YU.ui.kpi({
          etiket: 'Aktif Yönetici', ikon: '#ic-users',
          deger: YU.fmt.sayi(yoneticiSayisi),
          alt: yoneticiSayisi === 1
            ? 'Son yönetici korunuyor (D10) — pasifleştirilemez, operatöre düşürülemez.'
            : 'Yönetim ekranlarına erişebilen hesap sayısı.',
          renk: yoneticiSayisi === 1 ? 'bekleyen' : 'vurgu'
        }),
        YU.ui.kpi({
          etiket: 'Aktif Operatör', ikon: '#ic-pencil',
          deger: YU.fmt.sayi(aktifOperatorSayisi()),
          alt: 'Günlük giriş, stok ve rapor görüntüleme yetkisi.'
        }),
        YU.ui.kpi({
          etiket: 'Pasif Hesap', ikon: '#ic-down',
          deger: YU.fmt.sayi(pasifSayisi()),
          alt: 'Silinmedi, pasifleştirildi (D12); geçmiş kayıtlardaki bağları duruyor.',
          renk: 'notr'
        })
      ));

      if (yoneticiSayisi === 1) {
        kap.appendChild(YU.ui.serit({
          tur: 'uyari',
          baslik: 'Sistemde Tek Aktif Yönetici Var',
          metin: 'Bu hesap pasifleştirilemez ve operatöre düşürülemez (D10). İkinci bir yönetici ' +
            'tanımlanırsa bu kilit kalkar. Kural yalnızca ekranda değil, kayıt servisinde de uygulanır.'
        }));
      }

      kap.appendChild(YU.ui.panel({
        baslik: 'Kullanıcılar',
        ikon: '#ic-users',
        dolgusuz: true,
        sag: YU.ui.dugme({
          metin: 'Yeni Kullanıcı', ikon: '#ic-plus', tur: 'birincil', kucuk: true,
          onClick: function () { kullaniciModali(null); }
        }),
        govde: kullaniciTablosu()
      }));

      kap.appendChild(YU.h('div', {
        sinif: 'yu-yardim',
        metin: 'Kayıt sayısı: kullanıcının oluşturduğu veya güncellediği günlük kayıt, silo hareketi ve ' +
          'devir satırlarının toplamıdır. Bu bağ, hesapların neden silinmediğini (D12) gösterir.'
      }));
    }
  });
})();

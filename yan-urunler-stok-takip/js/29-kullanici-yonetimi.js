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

  /* Gerçek uygulamada bu alan BCrypt hash'i tutar (Şartname §3). Prototipte
     yalnızca "ne zaman sıfırlandı" notudur — parola metni hiçbir yere yazılmaz. */
  var PAROLA_NOTU_ONEK = '(prototip — parola saklanmaz · sıfırlama ';

  /* ==================================================================
     Ortak yardımcılar
     ================================================================== */

  function db() { return YU.db; }
  function oturumKullanicisi() { return YU.oturum.kullanici; }

  /* İstanbul saati, kaynağı internet (YU.zaman · 26.08.2026). */
  function damga() { return YU.zaman.damgaBosluklu(); }

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

  /* Yardım satırı artık SABİT metin taşımıyor (kullanıcı isteği, 26.08.2026):
     rol, durum ve e-posta açıklamaları kaldırıldı — kimse okumuyordu, ekranı
     kalabalıklaştırıyordu (KURAL 11). Satır yalnız bir ENGEL varken doğar:
     "neden pasifleştiremiyorum" sorusunun cevabı yazılı kalmalı. */
  function yardimYaz(alan, metin) {
    var el = alan.kok.querySelector('.yu-yardim');
    if (!metin) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!el) {
      el = YU.h('div', { sinif: 'yu-yardim' });
      alan.kok.insertBefore(el, alan.kok.querySelector('.yu-alan-hata'));
    }
    el.textContent = metin;
  }

  function kullaniciModali(kullanici) {
    var duzenle = !!kullanici;
    var hataKap = YU.h('div');

    var adiAlan = YU.ui.alan({
      etiket: 'E-posta', tip: 'metin',
      deger: duzenle ? kullanici.KullaniciAdi : ''
      /* Açıklama satırı kaldırıldı (kullanıcı isteği, 26.08.2026). Etiket
         "E-posta" zaten ne yazılacağını söylüyor; kural bozulursa doğrulama
         hatası aynı yere düşüyor. */
    });
    var adSoyadAlan = YU.ui.alan({
      etiket: 'Ad Soyad', tip: 'metin',
      deger: duzenle ? kullanici.AdSoyad : ''
    });
    var rolAlan = YU.ui.alan({
      etiket: 'Rol', tip: 'secim',
      secenekler: [{ deger: 'Yonetici', metin: 'Yönetici' }, { deger: 'Operator', metin: 'Operatör' }],
      deger: duzenle ? kullanici.Rol : 'Operator'
    });
    var durumAlan = YU.ui.alan({
      etiket: 'Durum', tip: 'secim',
      secenekler: [{ deger: 'aktif', metin: 'Aktif' }, { deger: 'Pasif', metin: 'Pasif' }],
      deger: duzenle && !aktifMi(kullanici) ? 'Pasif' : 'aktif'
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
      /* Not GÜNCELLENDİ (26.08.2026): parola artık belirleniyor ve hash'lenip
         saklanıyor; eski cümle yanlış bilgi veriyordu. Hash cümlesi ve şartname
         atfı kullanıcı isteğiyle kesildi — soru "parolayı nereye yazacağım",
         yanıtı iki cümlede tam. */
      metin: 'Parola burada belirlenmez. Yeni kullanıcı ilk girişinde kendi parolasını kurar.'
    });

    /* Kaydetmeden çıkış kilidi — ortak mekanizma (10-kabuk · YU.ui.modal
       kirliMi, 27.08.2026). */
    function kirliMi() {
      var eposta = String(adiAlan.deger() || '').trim();
      var adSoyad = String(adSoyadAlan.deger() || '').trim();
      var rol = String(rolAlan.deger() || '');
      var durum = String(durumAlan.deger() || '');
      if (duzenle) {
        return eposta !== String(kullanici.KullaniciAdi || '') ||
               adSoyad !== String(kullanici.AdSoyad || '') ||
               rol !== String(kullanici.Rol || '') ||
               durum !== (aktifMi(kullanici) ? 'aktif' : 'Pasif');
      }
      return eposta !== '' || adSoyad !== '' || rol !== 'Operator' || durum !== 'aktif';
    }

    var m = YU.ui.modal({
      baslik: duzenle ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı',
      genislik: 520,
      kirliMi: kirliMi,
      kilitMesaji: duzenle ? 'Kullanıcı bilgilerinde kaydedilmemiş değişiklik var.'
                           : 'Yeni kullanıcı bilgileri henüz kaydedilmedi.',
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

      /* Ciddi işlem onayı (M28): rol/durum değişimi yetki değişimidir; onay
         penceresi neyin neye döndüğünü listeler. Değişiklik yoksa pencere
         açılmaz. */
      function rolAdi(r) { return r === 'Yonetici' ? 'Yönetici' : 'Operatör'; }
      var maddeler = [], rolDegisti = false;
      if (duzenle) {
        if (String(aday.KullaniciAdi) !== String(kullanici.KullaniciAdi)) {
          maddeler.push({ etiket: 'E-posta', eski: kullanici.KullaniciAdi, yeni: aday.KullaniciAdi });
        }
        if (String(aday.AdSoyad) !== String(kullanici.AdSoyad)) {
          maddeler.push({ etiket: 'Ad Soyad', eski: kullanici.AdSoyad, yeni: aday.AdSoyad });
        }
        if (aday.Rol !== kullanici.Rol) {
          rolDegisti = true;
          maddeler.push({ etiket: 'Rol', eski: rolAdi(kullanici.Rol), yeni: rolAdi(aday.Rol) });
        }
        if (aktifMi(kullanici) !== (aday.Aktif !== false)) {
          maddeler.push({ etiket: 'Durum', eski: aktifMi(kullanici) ? 'Aktif' : 'Pasif', yeni: aday.Aktif !== false ? 'Aktif' : 'Pasif' });
        }
        if (!maddeler.length) { uygula(); return; }
      } else {
        maddeler.push({ etiket: 'E-posta', deger: aday.KullaniciAdi || '—' });
        maddeler.push({ etiket: 'Ad Soyad', deger: aday.AdSoyad || '—' });
        maddeler.push({ etiket: 'Rol', deger: rolAdi(aday.Rol) });
        rolDegisti = aday.Rol === 'Yonetici';
      }
      var onayMetin = duzenle ? 'Kullanıcı hesabı değiştirilecek.' : 'Yeni kullanıcı giriş ekranında listelenir.';
      if (rolDegisti && aday.Rol === 'Yonetici') {
        onayMetin += ' Yönetici; devir stok, malzeme ve kullanıcı yönetimine erişir.';
      } else if (rolDegisti) {
        onayMetin += ' Operatör; yönetim ekranlarına erişemez.';
      }
      YU.ui.onay({
        baslik: duzenle ? 'Kullanıcı Değişikliğini Onayla' : 'Yeni Kullanıcıyı Onayla',
        metin: onayMetin,
        ayrinti: YU.ui.farkListesi(maddeler),
        onayMetni: duzenle ? 'Kaydet' : 'Ekle',
        tehlike: rolDegisti
      }).then(function (evet) { if (evet) uygula(); });

      function uygula() {
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

    /* Düzenle de METİNLİ DÜĞME (kullanıcı isteği, 26.08.2026): kalem ikonu
       ne yaptığını üstüne gelmeden söylemiyordu. Satırdaki üç eylem artık
       aynı dilde: Düzenle · Parola Sıfırla · Pasifleştir. */
    eylemler.appendChild(YU.ui.dugme({
      metin: 'Düzenle', ikon: '#ic-pencil', tur: 'ikincil', kucuk: true,
      baslik: 'E-posta, ad soyad, rol ve durumu değiştir',
      onClick: function () { kullaniciModali(k); }
    }));
    /* Parola sıfırlama ikon değil METİNLİ DÜĞME (kullanıcı isteği, 26.08.2026):
       dişli ikonu ne yaptığını üstüne gelmeden söylemiyordu. Yanındaki
       Pasifleştir düğmesiyle aynı ölçüde durur. */
    eylemler.appendChild(YU.ui.dugme({
      metin: 'Parola Sıfırla', ikon: '#ic-gear', tur: 'ikincil', kucuk: true,
      baslik: 'Hesabın parolasını sıfırlar',
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
        { baslik: 'E-posta', genislik: 210 },
        { baslik: 'Ad Soyad' },
        { baslik: 'Rol', genislik: 110, hiza: 'orta' },
        { baslik: 'Durum', genislik: 96, hiza: 'orta' },
        { baslik: 'Kayıt Sayısı', genislik: 110, hiza: 'sag', mono: true },
        { baslik: 'İşlem', genislik: 380, hiza: 'sag' }
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

      /* KPI kartları ve "Sistemde Tek Aktif Yönetici Var" şeridi kaldırıldı
         (kullanıcı isteği, 25.08.2026). Sayılar sayfa alt başlığında zaten
         yazıyor; D10 kilidi tabloda ve kayıt servisinde aynen duruyor. */
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
    }
  });
})();

/* js/22-malzeme-girisi.js — Malzeme Girişi ekranı (Şartname §7 · SOZLESME §7).

   Kilitli kolonlar DEMİRBAŞ: dökme kuru küspenin üretim ve satış kolonları,
   çuvallı kuru küspenin üretim kolonu Kuru Küspe Günlük Giriş ekranından gelir
   ve bu ekrandan değiştirilemez. Kilit yalnız görsel değil: kilitli kolon
   servise hiç gönderilmez, böylece 03-dogrulama'daki kural tek yerde kalır. */
(function () {
  'use strict';

  var YU = window.YU;
  var KOD = 'malzeme-girisi';

  /* ==================================================================
     1. Küçük yardımcılar
     ================================================================== */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  function sayi(v) {
    var n = Number(v);
    return isFinite(n) ? YU.yuvarla(n) : 0;
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
      stil: { display: 'flex', flexDirection: 'column', minWidth: '0', gap: (bosluk || 4) + 'px' }
    });
  }

  function hareketBul(tarih, malzemeId) {
    var t = YU.db.gunlukHareket, i;
    for (i = 0; i < t.length; i++) {
      if (t[i].Tarih === tarih && t[i].MalzemeId === malzemeId) return t[i];
    }
    return null;
  }

  function gunKaydi(tarih) {
    var l = YU.stok.kayitliGunler(YU.db, tarih, tarih);
    return l.length ? l[0] : null;
  }

  /* ==================================================================
     2. Satır verisi — taban stok ve kayıt durumu
     ================================================================== */

  /* taban = seçilen güne kadarki stok, O GÜNÜN satırı hariç. Gün sonu stok
     yazdıkça taban + üretim − satış olarak anında hesaplanır. İade stoğa
     GİRMEZ (kullanıcı kararı, 26.08.2026); yalnız kendi kolonunda raporlanır. */
  function satirVerisiKur(satir, stok) {
    var kayit = hareketBul(satir.tarih, satir.malzeme.Id);
    satir.kayit = kayit;
    /* D16 karşılaştırması ekranın açıldığı andaki sürümle yapılır; canlı
       nesneden okunursa kural hiçbir zaman tetiklenmez. */
    satir.rowVersion = kayit ? Number(kayit.RowVersion) : null;
    satir.kayitUretim = kayit ? sayi(kayit.Uretim) : 0;
    satir.kayitSatis = kayit ? sayi(kayit.Satis) : 0;
    satir.kayitIade = kayit ? sayi(kayit.Iade) : 0;
    satir.baslangicUretim = satir.kayitUretim;
    satir.baslangicSatis = satir.kayitSatis;
    satir.baslangicIade = satir.kayitIade;
    satir.taban = satir.sabitTaban
      ? stok.mevcut
      : YU.yuvarla(stok.mevcut - satir.kayitUretim + satir.kayitSatis);
  }

  function satirVerisiTazele(satir) {
    satirVerisiKur(satir, YU.stok.malzemeStok(YU.db, satir.malzeme.Id, satir.tarih));
    if (satir.uretimAlan) satir.uretimAlan.ayarla(satir.kayit ? satir.baslangicUretim : null).hataGoster('');
    if (satir.satisAlan) satir.satisAlan.ayarla(satir.kayit ? satir.baslangicSatis : null).hataGoster('');
    if (satir.iadeAlan) satir.iadeAlan.ayarla(satir.kayit && satir.baslangicIade ? satir.baslangicIade : null).hataGoster('');
  }

  function alanSayisi(alan) { return alan.deger(); }

  /* Geçersiz metin olduğu gibi servise gider: "sayı olmalı" mesajını doğrulama
     katmanı kullanıcının yazdığı metinle üretsin, kural iki yere kopyalanmasın. */
  function gonderilecek(alan) {
    var v = alan.deger();
    return isFinite(v) ? v : alan.girdi.value;
  }

  function satirDegisti(satir) {
    var v;
    if (!satir.kilitliUretim) {
      v = alanSayisi(satir.uretimAlan);
      if (!isFinite(v) || YU.yuvarla(v) !== satir.baslangicUretim) return true;
    }
    if (!satir.kilitliSatis) {
      v = alanSayisi(satir.satisAlan);
      if (!isFinite(v) || YU.yuvarla(v) !== satir.baslangicSatis) return true;
    }
    if (!satir.kilitliIade) {
      v = alanSayisi(satir.iadeAlan);
      if (!isFinite(v) || YU.yuvarla(v) !== satir.baslangicIade) return true;
    }
    return false;
  }

  function degisenSatirlar(d) {
    var liste = [], i;
    for (i = 0; i < d.satirlar.length; i++) {
      if (satirDegisti(d.satirlar[i])) liste.push(d.satirlar[i]);
    }
    return liste;
  }

  /* ==================================================================
     3. Canlı hesap — gün sonu stok, durum rozeti, uyarılar
     ================================================================== */

  function satirTazele(satir) {
    var u = satir.kilitliUretim ? satir.kayitUretim : alanSayisi(satir.uretimAlan);
    var s = satir.kilitliSatis ? satir.kayitSatis : alanSayisi(satir.satisAlan);
    var iade = satir.kilitliIade ? satir.kayitIade : alanSayisi(satir.iadeAlan);
    var gecerli = isFinite(u) && isFinite(s) && isFinite(iade);
    /* İade stoğa girmediği için (26.08.2026) canlı önizlemeye de girmez —
       dökmede taban zaten silo toplamıdır, basit malzemede üretim/satış yeter. */
    var sonuc = satir.sabitTaban
      ? YU.yuvarla(satir.taban)
      : YU.yuvarla(satir.taban + u - s);

    satir.gecerli = gecerli;
    satir.sonuc = gecerli ? sonuc : NaN;
    satir.negatif = gecerli && sonuc < -YU.hesap.TOLERANS;
    satir.degisti = satirDegisti(satir);

    satir.sonucHucre.textContent = gecerli ? YU.fmt.kg(sonuc) : '—';
    satir.sonucHucre.style.color = satir.negatif ? 'var(--olumsuz)' : '';

    /* Satır işareti derinlik gölgesi değil, tasarım referansındaki
       "inset 3px vurgu çizgisi" dili — koyu temada da geçerli. */
    if (satir.tr) satir.tr.style.boxShadow = satir.negatif ? 'inset 3px 0 0 var(--olumsuz)' : '';

    durumHucresiTazele(satir);
  }

  /* Durum rozetleri bu ekranda ortak boyuttan büyük (kullanıcı isteği,
     24.08.2026): yalnız burada büyütülür, ortak .yu-rozet'e dokunulmaz. */
  function durumRozeti(metin, tur) {
    var r = YU.ui.rozet(metin, tur);
    r.style.font = '500 12.5px/1 var(--font)';
    r.style.padding = '6px 12px';
    return r;
  }

  function durumHucresiTazele(satir) {
    var kap = YU.bos(satir.durumHucre);
    if (satir.pasif) kap.appendChild(durumRozeti('Pasif', 'bekleyen'));
    if (!satir.gecerli) kap.appendChild(durumRozeti('Geçersiz', 'olumsuz'));
    else if (satir.degisti) kap.appendChild(durumRozeti('Değişti', 'bekleyen'));
    else if (satir.kayit) kap.appendChild(durumRozeti('Kayıtlı', 'olumlu'));
    else kap.appendChild(durumRozeti('Giriş Yok', 'notr'));
    if (satir.negatif) kap.appendChild(durumRozeti('Negatif Stok', 'olumsuz'));
  }

  function ozetTazele(d) {
    var degisen = 0, negatif = [], gecersiz = 0, i, satir;
    for (i = 0; i < d.satirlar.length; i++) {
      satir = d.satirlar[i];
      if (satir.degisti) degisen++;
      if (!satir.gecerli) gecersiz++;
      if (satir.negatif) negatif.push(satir);
    }

    /* NEGATİF STOKTA KAYDET KAPALI (kullanıcı direktifi, 27.08.2026:
       "negatif kayıt kesinlikle engellenmeli, kaydet yasak olmalı").
       Doğrulama katmanı bunu 26.08.2026'dan beri zaten REDDEDİYORDU
       (03-dogrulama · malzemeIlkNegatifGun, CLAUDE.md KURAL 12); eksik olan
       ekrandı — düğme açık kalıyor, şerit de "kaydı engellemiyoruz" diyordu.
       Artık ekran ile kural aynı şeyi söylüyor. */
    d.kaydetDugmesi.disabled = degisen === 0 || negatif.length > 0;
    d.kaydetDugmesi.title = negatif.length
      ? 'Stok eksiye düşüyor — önce rakamları düzeltin.'
      : '';
    d.geriDugmesi.disabled = degisen === 0;
    /* Kaydedilmemiş satır varken ekrandan çıkış kilitlenir. SERT kilit
       (kullanıcı isteği, 27.08.2026 — Devir Stok'takinin aynısı): menü,
       marka bloğu, tarayıcının geri/ileri tuşu ve doğrudan adres değişimi
       dahil her sayfa geçişini UYGULAMA sorar; sekme/pencere kapatmayı ve
       yenilemeyi TARAYICI sorar. Kilit kabukta ortak (YU.cikisKilidi) ve
       her sayfa çiziminde kendiliğinden düşer. */
    if (YU.cikisKilidi) {
      YU.cikisKilidi(degisen > 0,
        YU.fmt.tarih(d.tarih) + ' günü için ' + YU.fmt.sayi(degisen) + ' satır kaydedilmedi.',
        true);
    }
    d.ozetMetin.textContent = degisen === 0
      ? 'Kaydedilmemiş değişiklik yok.'
      : YU.fmt.sayi(degisen) + ' satır değiştirildi, henüz kaydedilmedi.' +
        (gecersiz ? ' ' + YU.fmt.sayi(gecersiz) + ' satırda sayı olmayan değer var.' : '');

    YU.bos(d.uyariKap);
    if (!negatif.length) return;

    /* SERT ENGEL (kullanıcı direktifi, 27.08.2026). Şartname §13 Soru 3 için
       "uyarı" öneriyordu; kullanıcı 26.08.2026'da ENGELLE dedi (KURAL 12) ve
       27.08.2026'da bunu bir kez daha, ekran tarafı için tekrarladı. Kırmızı
       zemin, iri başlık ve büyük eksi bakiye kalır; artık Kaydet de kapalıdır
       ve metin kaydın yapılamayacağını söyler. */
    var liste = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }
    });
    for (i = 0; i < negatif.length; i++) {
      liste.appendChild(YU.h('div', {
        stil: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }
      },
        YU.h('span', {
          metin: negatif[i].malzeme.Ad,
          stil: { font: '500 15px/1.3 var(--font)', color: 'var(--metin)' }
        }),
        YU.h('span', { metin: 'gün sonu', sinif: 'yu-yardim' }),
        YU.h('span', {
          metin: YU.fmt.kgU(negatif[i].sonuc),
          stil: {
            font: '650 22px/1.1 var(--sayi)', letterSpacing: '-.02em',
            fontVariantNumeric: 'tabular-nums', color: 'var(--olumsuz)'
          }
        })
      ));
    }

    var serit = YU.ui.serit({
      tur: 'hata',
      ikon: '#ic-alert',
      baslik: negatif.length === 1
        ? 'DİKKAT — Stok Eksiye Düşüyor'
        : 'DİKKAT — ' + YU.fmt.sayi(negatif.length) + ' Malzemenin Stoğu Eksiye Düşüyor',
      metin: 'Elde olandan fazla satış girilmiş. Stok hiçbir gün eksiye inemez — ' +
        'bu hâliyle KAYDEDİLEMEZ. Giriş sırasını, devir stoğu ve önceki günlerin ' +
        'rakamlarını kontrol edin.'
    });
    serit.className += ' yu-cetin';
    serit.querySelector('.yu-serit-govde').appendChild(liste);
    d.uyariKap.appendChild(serit);
  }

  /* ==================================================================
     4. Kaydetme ve geri alma
     ================================================================== */

  /* Kaydet HER ZAMAN onay penceresi açar (kullanıcı isteği, 24.08.2026):
     değişen satırların eski → yeni değer özeti + "emin misin". Kuru Küspe
     Günlük Giriş ekranındaki onay penceresiyle aynı dil: geçmiş tarihte
     kırmızı uyarı ve tehlike renkli düğme. Onaylanınca kaydetUygula çalışır. */
  function kaydet(d) {
    var degisen = degisenSatirlar(d);
    if (!degisen.length) {
      YU.ui.bildir('Kaydedilecek değişiklik yok.', 'bilgi');
      return;
    }

    var bugun = YU.tarih.bugun();
    /* Ulaşılmaz emniyet: tarih bir yolla geleceğe kaymışsa onay penceresi
       hiç açılmaz — pencere ileri günü "(bugün)" diye etiketliyordu (Bulgu 1). */
    if (d.tarih > bugun) {
      YU.ui.bildir('Gelecek tarihe kayıt girilemez: ' + YU.fmt.tarih(d.tarih) + ' bugünden sonra (D17).', 'hata');
      return;
    }
    var gecmis = d.tarih < bugun;
    var f = YU.tarih.fark(d.tarih, bugun);
    var gunEtiketi = YU.fmt.tarih(d.tarih) + ' ' + YU.fmt.gunAdi(d.tarih) +
      (gecmis ? (f === 1 ? ' (dün)' : ' (' + YU.fmt.sayi(f) + ' gün önce)') : ' (bugün)');

    /* Sayı olmayan girdi olduğu gibi gösterilir: doğrulama katmanı kaydı
       zaten reddedecek, pencere yalnız ne yazıldığını aktarır. */
    function degerMetni(v, alan) {
      return isFinite(v) ? YU.fmt.kgU(YU.yuvarla(v)) : '"' + alan.girdi.value + '"';
    }

    function alanSatiri(etiket, eski, kayitVar, alan) {
      var yeni = alanSayisi(alan);
      var deger = YU.h('span', { stil: { font: '400 13.5px/1.5 var(--sayi)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } });
      /* Silinen değer kırmızı, yerine yazılacak değer yeşil (kullanıcı isteği,
         24.08.2026). İlk kayıtta eski değer olmadığından ok da gösterilmez,
         yalnız yeni değer yazılır — "— → 5 kg" kafa karıştırıyordu. */
      if (kayitVar) {
        deger.appendChild(YU.h('span', { metin: YU.fmt.kgU(eski), stil: { color: 'var(--olumsuz)' } }));
        deger.appendChild(YU.h('span', { metin: ' → ', stil: { color: 'var(--metin-5)' } }));
      }
      deger.appendChild(YU.h('span', { metin: degerMetni(yeni, alan), stil: { font: '600 14px/1.5 var(--sayi)', color: 'var(--olumlu)' } }));
      if (!kayitVar) deger.appendChild(YU.h('span', { metin: ' (ilk kayıt)', stil: { color: 'var(--metin-5)', font: '400 12.5px/1.5 var(--font)' } }));
      return YU.h('div', { stil: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' } },
        YU.h('span', { metin: etiket, stil: { font: '400 13.5px/1.5 var(--font)', color: 'var(--metin-3)' } }),
        deger
      );
    }

    var liste = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    var kayitliVar = false, i, satir, kalemler;
    for (i = 0; i < degisen.length; i++) {
      satir = degisen[i];
      if (satir.kayit) kayitliVar = true;
      kalemler = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        YU.h('div', { metin: satir.malzeme.Ad, stil: { font: '600 13.5px/1.4 var(--font)', color: 'var(--metin)' } }));
      if (!satir.kilitliUretim && (!isFinite(alanSayisi(satir.uretimAlan)) || YU.yuvarla(alanSayisi(satir.uretimAlan)) !== satir.baslangicUretim)) {
        kalemler.appendChild(alanSatiri('Üretim', satir.baslangicUretim, !!satir.kayit, satir.uretimAlan));
      }
      if (!satir.kilitliSatis && (!isFinite(alanSayisi(satir.satisAlan)) || YU.yuvarla(alanSayisi(satir.satisAlan)) !== satir.baslangicSatis)) {
        kalemler.appendChild(alanSatiri('Satış', satir.baslangicSatis, !!satir.kayit, satir.satisAlan));
      }
      if (!satir.kilitliIade && (!isFinite(alanSayisi(satir.iadeAlan)) || YU.yuvarla(alanSayisi(satir.iadeAlan)) !== satir.baslangicIade)) {
        kalemler.appendChild(alanSatiri('İade', satir.baslangicIade, !!satir.kayit, satir.iadeAlan));
      }
      liste.appendChild(kalemler);
    }

    var m = YU.ui.modal({
      baslik: gecmis ? 'Geçmiş Bir Güne Kayıt Yapıyorsun' : 'Kaydı Onayla',
      genislik: 460,
      govde: [YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        YU.h('div', {
          metin: gunEtiketi + ' gününe ' + YU.fmt.sayi(degisen.length) + ' satır kaydediyorsun.',
          stil: { font: '600 14.5px/1.5 var(--font)', color: 'var(--metin)' }
        }),
        gecmis ? YU.h('div', {
          metin: 'DİKKAT: bu tarih bugün değil, GEÇMİŞ ÜZERİNDE işlem yapıyorsun. Sonraki günlerin stokları yeniden hesaplanır.',
          stil: { font: '600 13.5px/1.5 var(--font)', color: 'var(--olumsuz)' }
        }) : null,
        YU.h('div', { stil: { padding: '10px 12px', border: '1px solid var(--kenar)', borderRadius: 'var(--r)', background: 'var(--yuzey-2)' } }, liste),
        kayitliVar ? YU.h('div', {
          metin: 'Kayıtlı satırlarda eski değer silinir, yerine yenisi yazılır.',
          stil: { font: '400 13.5px/1.55 var(--font)', color: 'var(--metin-2)' }
        }) : null,
        YU.h('div', { metin: 'Emin misin?', stil: { font: '400 14px/1.55 var(--font)', color: 'var(--metin-2)' } })
      )],
      dugmeler: [
        { metin: 'Vazgeç' },
        {
          metin: gecmis ? 'Evet, Geçmişe Kaydet' : 'Evet, Kaydet',
          tur: gecmis ? 'tehlike' : 'birincil',
          onClick: function () { m.kapat(); kaydetUygula(d); }
        }
      ]
    });
  }

  /* Bir satırın doğrulama girdisi — ön kontrol ve asıl kayıt aynı biçimi
     kullansın diye tek yerde kurulur. Kilitli kolon hiç gönderilmez:
     gönderilirse doğrulama katmanı kilidi hata olarak döndürür
     (03-dogrulama, Şartname §7). */
  function satirGirdisi(d, satir) {
    var girdi = { tarih: d.tarih, malzemeId: satir.malzeme.Id, rowVersion: satir.rowVersion };
    if (!satir.kilitliUretim) girdi.uretim = gonderilecek(satir.uretimAlan);
    if (!satir.kilitliSatis) girdi.satis = gonderilecek(satir.satisAlan);
    if (!satir.kilitliIade) girdi.iade = gonderilecek(satir.iadeAlan);
    return girdi;
  }

  /* ÖN KONTROL (kullanıcı kararı, 26.08.2026): kayıt yazılmadan önce
     doğrulama bir kez koşturulur. Negatif stok artık UYARI değil HATA
     (CLAUDE.md KURAL 12) — yani o durumda kayıt zaten reddedilir ve hata
     listesi görünür. Bu kapı ileride uyarı üreten başka bir kural çıkarsa
     kullanıcıya kaydetmeden önce sorulması için duruyor; uyarı yoksa hiç
     görünmez, akışı yavaşlatmaz. */
  function onUyarilariTopla(d, degisen) {
    var liste = [], i, s;
    if (!YU.dogrula || typeof YU.dogrula.malzemeHareketi !== 'function') return liste;
    for (i = 0; i < degisen.length; i++) {
      try {
        s = YU.dogrula.malzemeHareketi(YU.db, satirGirdisi(d, degisen[i]));
      } catch (e) { continue; }             /* ön kontrol kaydı engellemez */
      if (s && s.uyarilar && s.uyarilar.length) liste = liste.concat(s.uyarilar);
    }
    return liste;
  }

  function kaydetUygula(d) {
    var degisen = degisenSatirlar(d);
    YU.bos(d.hataKap);
    if (!degisen.length) {
      YU.ui.bildir('Kaydedilecek değişiklik yok.', 'bilgi');
      return;
    }

    var onUyarilar = onUyarilariTopla(d, degisen);
    if (!onUyarilar.length) { kaydiYaz(d, degisen); return; }

    var ayrinti = YU.h('ul', { stil: { margin: '0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', font: '400 14px/1.5 var(--font)', color: 'var(--metin-2)' } });
    for (var k = 0; k < onUyarilar.length; k++) {
      ayrinti.appendChild(YU.h('li', { metin: onUyarilar[k].mesaj || String(onUyarilar[k]) }));
    }
    YU.ui.onay({
      baslik: 'Kaydetmeden Önce',
      metin: 'Aşağıdaki noktaları görülmeden kaydetme. Yine de kaydedilsin mi?',
      ayrinti: ayrinti,
      onayMetni: 'Yine de kaydet',
      iptalMetni: 'Vazgeç'
    }).then(function (evet) {
      if (evet) kaydiYaz(d, degisen);
    });
  }

  function kaydiYaz(d, degisen) {
    var hatalar = [], uyarilar = [], basarili = 0, i, satir, girdi, s;

    for (i = 0; i < degisen.length; i++) {
      satir = degisen[i];
      girdi = satirGirdisi(d, satir);

      s = YU.servis.malzemeHareketKaydet(YU.db, girdi, YU.oturum.kullanici);
      if (s.uyarilar && s.uyarilar.length) uyarilar = uyarilar.concat(s.uyarilar);

      if (s.ok) {
        basarili++;
        satirVerisiTazele(satir);
      } else {
        /* Kilitli kampanya: tüm satırlar aynı tarihe yazdığı için tek
           pencere yeter; hiçbir satır kaydedilmemiştir. */
        if (YU.ui.kilitYakala(s)) return;
        hatalar = hatalar.concat(s.hatalar);
        if (s.hatalar.length) {
          /* Dökme satırında üretim/satış alanı yok (kilitli) — hata girilebilen
             ilk alana yazılır; hiçbiri yoksa üstteki listede zaten görünür. */
          var hataAlani = (!satir.kilitliUretim && satir.uretimAlan) ||
                          (!satir.kilitliSatis && satir.satisAlan) ||
                          (!satir.kilitliIade && satir.iadeAlan) || null;
          if (hataAlani) hataAlani.hataGoster(s.hatalar[0].mesaj);
        }
      }
    }

    for (i = 0; i < d.satirlar.length; i++) satirTazele(d.satirlar[i]);
    gunDurumuTazele(d);
    ozetTazele(d);
    YU.donem.tazele();          /* kenar çubuğundaki kayıtlı gün sayacı tazelensin */
    /* Zil rozeti de tazelensin (kullanıcı kararı, 26.08.2026): negatif stok
       uyarısı kaydettikten SONRA da üst şeritte görünmeli. Bu ekran kayıt
       sonrası yeniden çizilmediği için sayaç kendiliğinden güncellenmiyordu. */
    if (typeof YU.ustSayaclariTazele === 'function') YU.ustSayaclariTazele();

    if (hatalar.length) d.hataKap.appendChild(YU.ui.hataListesi(hatalar, 'hata'));
    if (uyarilar.length) d.hataKap.appendChild(YU.ui.hataListesi(uyarilar, 'uyari'));

    if (!hatalar.length) {
      YU.ui.bildir(YU.fmt.sayi(basarili) + ' satır kaydedildi · ' + YU.fmt.tarih(d.tarih), 'basari');
    } else if (basarili) {
      YU.ui.bildir(YU.fmt.sayi(basarili) + ' satır kaydedildi, ' +
        YU.fmt.sayi(degisen.length - basarili) + ' satır reddedildi.', 'uyari');
    } else {
      YU.ui.bildir('Hiçbir satır kaydedilmedi.', 'hata');
    }
  }

  function geriAl(d) {
    var i, satir;
    for (i = 0; i < d.satirlar.length; i++) {
      satir = d.satirlar[i];
      if (satir.uretimAlan) satir.uretimAlan.ayarla(satir.kayit ? satir.baslangicUretim : null).hataGoster('');
      if (satir.satisAlan) satir.satisAlan.ayarla(satir.kayit ? satir.baslangicSatis : null).hataGoster('');
      if (satir.iadeAlan) satir.iadeAlan.ayarla(satir.kayit && satir.baslangicIade ? satir.baslangicIade : null).hataGoster('');
      satirTazele(satir);
    }
    YU.bos(d.hataKap);
    ozetTazele(d);
    YU.ui.bildir('Değişiklikler geri alındı.', 'bilgi');
  }

  /* ==================================================================
     5. Yönlendirme — kaydedilmemiş değişiklik varken onay sorulur
     ================================================================== */

  function ayrilmaOnayi(d) {
    var degisen = degisenSatirlar(d).length;
    return YU.ui.onay({
      baslik: 'Kaydedilmemiş Değişiklik Var',
      metin: YU.fmt.tarih(d.tarih) + ' günü için ' + YU.fmt.sayi(degisen) +
        ' satır değiştirildi ama kaydedilmedi. Devam ederseniz bu değişiklikler kaybolur.',
      onayMetni: 'Kaydetmeden çık',
      iptalMetni: 'Sayfada kal',
      tehlike: true
    });
  }

  /* sayfayaGit kaldırıldı (24.08.2026): tek çağıranı, kilit açıklamasındaki
     "ekranı aç" bağlantısıydı; o metin kalkınca fonksiyon ölü kaldı.
     Tarih değişimi ayrilmaOnayi'yi tarihIste üzerinden kullanmaya devam eder. */

  function tarihIste(d, yeni) {
    if (!gecerliTarih(yeni)) { d.tarihAlan.ayarla(d.tarih); return; }
    /* Gelecek gün seçilemez (kullanıcı direktifi, 24.08.2026): elle yazılan
       ileri tarih reddedilir. D17 servis katmanında zaten engelliyordu; artık
       onay penceresine hiç ulaşılmaz (Bulgu 1). */
    if (yeni > YU.tarih.bugun()) {
      YU.ui.bildir('Gelecek tarihe kayıt girilemez: ' + YU.fmt.tarih(yeni) + ' bugünden sonra (D17).', 'hata');
      d.tarihAlan.ayarla(d.tarih);
      return;
    }
    if (yeni === d.tarih) return;
    if (!degisenSatirlar(d).length) { YU.git(KOD, { tarih: yeni }); return; }
    ayrilmaOnayi(d).then(function (ok) {
      if (ok) YU.git(KOD, { tarih: yeni });
      else d.tarihAlan.ayarla(d.tarih);
    });
  }

  /* ==================================================================
     6. Tarih şeridi — Kuru Küspe Günlük Giriş ekranıyla aynı dil
     (kullanıcı isteği, 23.08.2026: iki giriş ekranı aynı aileden görünsün)
     ================================================================== */

  function gunDurumuTazele(d) {
    var g = gunKaydi(d.tarih);

    /* Tarih şeridinin ucundaki rozet KALDIRILDI (kullanıcı isteği,
       27.08.2026): "Kayıtlı Gün" bilgisi panel başlığına taşındı, iki ayrı
       yerde iki rozet aynı günü anlatıyordu (KURAL 11). */
    YU.bos(d.seritRozet);

    /* Panel başlığının sağı — Şartname §7 arayüz iyileştirmesi: üzerine
       yazmadan önce o günü kimin ne zaman girdiği görünmeli. */
    var kap = YU.bos(d.durumKap);
    /* Kayıt yokken hiçbir şey yazılmaz (kullanıcı direktifi, 26.08.2026 ·
       CLAUDE.md KURAL 11). Buradaki "8 malzeme · bu güne henüz giriş
       yapılmamış" cümlesi, şeridin ucundaki "Kayıt Yok" rozetini kelimesi
       kelimesine tekrar ediyordu. */
    if (!g) return;
    /* "X satır kayıtlı · son giriş · kullanıcı" metni kaldırıldı (kullanıcı
       isteği, 24.08.2026): aynı bilgi Durum kolonu, alt bar ve Değişiklik
       Geçmişi'nde zaten var. Rozet kaldı — kilitli kolonların kaynağını anlatır. */
    /* Panel başlığındaki rozet artık GÜNÜN DURUMUNU söyler (kullanıcı isteği,
       27.08.2026): "Kuru Küspe Girildi/Girilmedi" yerine "Kayıtlı Gün".
       Kuru küspe girilip girilmediği zaten kilitli hücrelerin rakamından ve
       oradaki kalem kısayolundan okunuyordu. */
    kap.appendChild(YU.ui.rozet('Kayıtlı Gün', 'bekleyen'));
  }

  /* Tarih küçük bir kontrol: koca panel bloğu değil, tek satırlık ince şerit —
     Kuru Küspe Günlük Giriş'teki şeridin aynısı. Kuru Küspe Girişi ve Günlük
     Rapor düğmeleri kaldırıldı (kullanıcı isteği, 24.08.2026). */
  function tarihSeridi(d) {
    var bugun = YU.tarih.bugun();

    d.tarihAlan = YU.ui.alan({
      tip: 'tarih', deger: d.tarih, genislik: '158px',
      onChange: function () { tarihIste(d, d.tarihAlan.girdi.value); }
    });
    /* D18'in ekran ayağı (M14): en eski devirden önceki gün takvimden
       seçilemez; servis kuralı ayrıca denetler. */
    var enEskiDevirM = YU.dogrula.enEskiDevir(YU.db);
    if (enEskiDevirM) d.tarihAlan.girdi.min = enEskiDevirM;

    var gezinme = satirKap('center', 6);
    gezinme.appendChild(YU.ui.dugme({
      metin: 'Önceki Gün', kucuk: true, tur: 'ikincil',
      onClick: function () { tarihIste(d, YU.tarih.ekle(d.tarih, -1)); }
    }));
    gezinme.appendChild(YU.ui.dugme({
      metin: 'Bugün', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
      pasif: d.tarih === bugun,
      onClick: function () { tarihIste(d, bugun); }
    }));
    gezinme.appendChild(YU.ui.dugme({
      metin: 'Sonraki Gün', kucuk: true, tur: 'ikincil',
      /* İleri yürüme geçmiş günleri düzeltmek içindir; bugünden öteye
         geçilemez — gelecek güne kayıt D17 ile zaten reddedilir. */
      pasif: d.tarih >= bugun,
      baslik: d.tarih >= bugun ? 'Bugünden sonrasına kayıt girilemez' : '',
      onClick: function () { tarihIste(d, YU.tarih.ekle(d.tarih, 1)); }
    }));

    d.seritRozet = YU.h('span', { stil: { display: 'inline-flex' } });

    return YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
        padding: '8px 14px', background: 'var(--yuzey-2)',
        border: '1px solid var(--kenar)', borderRadius: 'var(--r)'
      }
    },
      YU.h('span', { metin: 'Tarih', stil: { font: '600 13.5px/1 var(--font)', color: 'var(--metin-2)' } }),
      d.tarihAlan.kok,
      gezinme,
      YU.h('span', { stil: { flex: '1' } }),
      d.seritRozet
    );
  }

  /* Panel gövdesi yalnız tablo (ya da boş durum): tarih artık panelin içinde
     değil, üstteki şeritte. */
  function girisPaneli(d, icerik) {
    return YU.ui.panel({
      baslik: 'Günlük Üretim ve Satış',
      ikon: '#ic-pencil',
      dolgusuz: true,
      sag: d.durumKap,
      govde: icerik
    });
  }

  /* ==================================================================
     7. Tablo
     ================================================================== */

  /* Kilitli hücrenin KALEM İKONU (kullanıcı isteği, 27.08.2026): rakamın
     geldiği ekranı, o günün tarihiyle açar. Kilidin sebebi oradaki ekran;
     kullanıcı oraya tek tıkla gitsin. Kaydedilmemiş satır varsa kabuğun
     çıkış kilidi yolu keser ve sorar. */
  function kuruKuspeKisayolu(tarih) {
    var el = YU.h('span', {
      sinif: 'yu-satir-eylem yu-kisayol',
      role: 'button', tabindex: '0',
      title: 'Kuru Küspe Günlük Giriş & Çıkış — ' + YU.fmt.tarih(tarih) + ' gününü aç',
      'aria-label': 'Kuru Küspe Günlük Giriş & Çıkış ekranını aç'
      /* 14 -> 17 px (kullanıcı isteği, 27.08.2026): kilitli hücrenin içinde
         küçük kalıyordu. Dolgu da bir tık açılır ki kutu kare kalsın. */
    }, YU.svg('#ic-pencil', 17));
    function git() { YU.git('kuru-kuspe', { tarih: tarih }); }
    el.addEventListener('click', git);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); git(); }
    });
    return el;
  }

  /* tarih: verilirse kilitli hücreye kalem ikonu eklenir; rakam eskisi gibi
     sağda kalır. */
  function kilitliHucre(deger, otomatik, soluk, tarih) {
    var kutu = satirKap('center', 8);
    /* Rozet solda sabit, sayı sağda: rozetler tüm satırlarda aynı kolon
       sınırına oturur — flex-end'de sayının genişliğine göre kayıyordu
       (kullanıcı isteği, 24.08.2026). */
    kutu.style.justifyContent = 'space-between';
    kutu.style.flexWrap = 'nowrap';
    if (otomatik) {
      /* Rozet ESKİSİ GİBİ düz metin (kullanıcı revizesi, 27.08.2026):
         tıklanabilirlik onun üstünde değil, SAĞINDAKİ kalem ikonunda. */
      kutu.appendChild(YU.ui.rozet('Kilitli', 'vurgu'));
      if (tarih) kutu.appendChild(kuruKuspeKisayolu(tarih));
    }
    kutu.appendChild(YU.h('span', {
      sinif: 'yu-mono' + (soluk ? ' yu-zayif' : ''),
      stil: { marginLeft: 'auto' },
      metin: YU.fmt.kg(deger)
    }));
    return kutu;
  }

  function malzemeHucresi(d, satir) {
    var ustSatir = satirKap('center', 8);
    ustSatir.appendChild(YU.h('span', { sinif: 'yu-guclu', metin: satir.malzeme.Ad }));
    if (satir.pasif) ustSatir.appendChild(YU.ui.rozet('Pasif', 'bekleyen'));

    var kutu = sutunKap(4);
    kutu.appendChild(ustSatir);

    /* Geriye yalnız pasif malzeme açıklaması kaldı; "ekranı aç" bağlantısı
       kilit açıklamalarıyla birlikte kalktı (24.08.2026). */
    if (satir.yardim) {
      kutu.appendChild(YU.h('div', { sinif: 'yu-yardim', metin: satir.yardim }));
    }
    return kutu;
  }

  function girdiHucresi(d, satir, alanAdi, baslangic) {
    /* Birim alanın içinde tekrar edilmiyor: kolon başlığı zaten "(Kg)" diyor ve
       içerideki ek, dar ekranda sayının üstüne biniyor. */
    var alan = YU.ui.alan({
      tip: 'sayi',
      deger: satir.kayit ? baslangic : null,
      onInput: function () {
        if (satir.uretimAlan) satir.uretimAlan.hataGoster('');
        if (satir.satisAlan) satir.satisAlan.hataGoster('');
        if (satir.iadeAlan) satir.iadeAlan.hataGoster('');
        satirTazele(satir);
        ozetTazele(d);
      }
    });
    satir[alanAdi] = alan;
    return alan.kok;
  }

  /* İade girilen satırda alan boş başlar (0 yerine) — kolon dolu görünmesin. */
  function iadeHucresi(d, satir) {
    if (satir.kilitliIade) {
      return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    }
    var kok = girdiHucresi(d, satir, 'iadeAlan', satir.baslangicIade || null);
    if (satir.kayit && !satir.baslangicIade) satir.iadeAlan.ayarla(null);
    return kok;
  }

  function tabloPaneli(d) {
    /* Kolon sırası kullanıcı isteği (24.08.2026): İade en solda. */
    var sutunlar = [
      { baslik: 'Malzeme' },
      /* Üç giriş kolonu EŞİT genişlikte (kullanıcı isteği, 24.08.2026 —
         "kolonları hizala"): iade kutusu diğerlerinden dar kalınca ızgara
         ritmi bozuluyordu. */
      { baslik: 'İade (Kg)', genislik: 175, hiza: 'sag' },
      { baslik: 'Üretim (Kg)', genislik: 175, hiza: 'sag' },
      { baslik: 'Satış (Kg)', genislik: 175, hiza: 'sag' },
      { baslik: 'Gün Sonu Stok', genislik: 160, hiza: 'sag', mono: true },
      { baslik: 'Durum', genislik: 150 }
    ];

    var satirlar = [], i, satir, uretimHucre, satisHucre;

    for (i = 0; i < d.satirlar.length; i++) {
      satir = d.satirlar[i];

      uretimHucre = satir.kilitliUretim
        ? kilitliHucre(satir.kayitUretim, !satir.pasif, satir.pasif, d.tarih)
        : girdiHucresi(d, satir, 'uretimAlan', satir.baslangicUretim);
      satisHucre = satir.kilitliSatis
        ? kilitliHucre(satir.kayitSatis, !satir.pasif, satir.pasif, d.tarih)
        : girdiHucresi(d, satir, 'satisAlan', satir.baslangicSatis);

      satir.sonucHucre = YU.h('span', { metin: '—' });
      satir.durumHucre = satirKap('center', 6);

      satirlar.push([
        malzemeHucresi(d, satir),
        iadeHucresi(d, satir),
        uretimHucre,
        satisHucre,
        satir.sonucHucre,
        satir.durumHucre
      ]);
    }

    var sar = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      sik: false,        /* giriş alanlı düzenleme tablosu — sık stil daraltmaz */
      /* Satır yüksekliği kısaldı (kullanıcı isteği, 25.08.2026): dikey dolgu
         12 -> 7. Giriş kutusunun kendi boyu değişmedi, tıklama alanı korunur. */
      dolgu: '7px 14px',
      bos: 'Aktif malzeme bulunamadı.',
      yapiskan: true
    });

    /* Giriş hücreleri sıkışınca sayı okunmaz hâle geliyor: tablo daralmak
       yerine dar ekranda kendi kabında yatay kaysın (tema.css ≤900px'te
       yapışkan varyantı kaydırmaya geri düşürür). */
    var tablo = sar.querySelector('table');
    if (tablo) tablo.style.minWidth = '980px';   /* İade kolonu eklendi (24.08.2026) */

    var trler = sar.querySelectorAll('tbody tr');
    for (i = 0; i < d.satirlar.length && i < trler.length; i++) d.satirlar[i].tr = trler[i];

    return girisPaneli(d, sar);
  }

  /* ==================================================================
     8. Alt bar
     ================================================================== */

  function altBar(d) {
    d.ozetMetin = YU.h('span', { sinif: 'yu-yardim' });

    d.kaydetDugmesi = YU.ui.dugme({
      metin: 'Kaydet', ikon: '#ic-plus', tur: 'birincil',
      onClick: function () { kaydet(d); }
    });
    /* Kuru Küspe ekranındaki Kaydet ile aynı boy. */
    d.kaydetDugmesi.style.padding = '10px 20px';
    d.kaydetDugmesi.style.fontSize = '15px';
    d.geriDugmesi = YU.ui.dugme({
      metin: 'Değişiklikleri Geri Al', ikon: '#ic-dots', tur: 'ikincil',
      sinif: 'yu-dugme-vurgulu',
      onClick: function () { geriAl(d); }
    });

    var dugmeler = satirKap('center', 8);
    dugmeler.appendChild(d.geriDugmesi);
    dugmeler.appendChild(d.kaydetDugmesi);

    /* Tarih ile durum TEK SATIR (kullanıcı isteği, 26.08.2026): tarih
       cümlenin başı, durum onun devamı — "26.08.2026 Kaydedilmemiş
       değişiklik yok.". "günü için N satır" kalktı; satır sayısı zaten
       tablonun kendisinde okunuyor. */
    var sol = satirKap('baseline', 7);
    sol.appendChild(YU.h('span', {
      stil: { font: '500 14.5px/1.4 var(--font)', color: 'var(--metin)', whiteSpace: 'nowrap' },
      metin: YU.fmt.tarih(d.tarih)
    }));
    sol.appendChild(d.ozetMetin);

    var satir = satirKap('center', 14);
    satir.style.justifyContent = 'space-between';
    satir.appendChild(sol);
    satir.appendChild(dugmeler);

    return YU.ui.panel({ govde: satir });
  }

  /* ==================================================================
     9. Sayfa
     ================================================================== */

  function satirlariKur(d) {
    var hepsi = YU.stok.tumMalzemeler(YU.db, d.tarih), i, m, ozel, kayit, satir;

    for (i = 0; i < hepsi.length; i++) {
      m = hepsi[i].malzeme;
      ozel = m.OzelTip || null;
      kayit = hareketBul(d.tarih, m.Id);
      /* Pasif malzeme yeni hareket almaz (D12) ama o güne kaydı varsa
         gizlenmez — gizlenirse gün sonu toplamı ekranda eksik görünür. */
      if (m.Aktif === false && !kayit) continue;

      satir = {
        tarih: d.tarih,
        malzeme: m,
        ozel: ozel,
        pasif: m.Aktif === false,
        sabitTaban: ozel === 'DokmeKuruKuspe',
        kilitliUretim: m.Aktif === false || ozel === 'DokmeKuruKuspe' || ozel === 'CuvalKuruKuspe',
        kilitliSatis: m.Aktif === false || ozel === 'DokmeKuruKuspe',
        /* İade artık HİÇBİR malzemede stoğa girmez, yalnız raporlanır
           (kullanıcı kararı, 26.08.2026 · 04-servis.js "mevcut" hesabı).
           Dökme kuru küspenin iade kilidi bu yüzden KALKTI (kullanıcı
           bildirimi, 26.08.2026): kilit "iade stokta görünür ama dökmede
           görünemez" gerekçesine dayanıyordu, o gerekçe artık yok. İade
           dökmede de kaydedilir ve raporlanır; silo bakiyesine ve dökme
           mevcuduna dokunmaz (Şartname §5 Demirbaş korunur). */
        kilitliIade: m.Aktif === false,
        yardim: null
      };

      /* Kuru küspe satırlarının kilit açıklaması kaldırıldı (kullanıcı
         isteği, 24.08.2026): kolondaki "Kilitli" rozeti zaten söylüyor,
         iki satırlık metin tabloyu şişiriyordu. Kilit davranışı aynen
         duruyor — yalnız açıklama yazısı ve "ekranı aç" bağlantısı gitti. */
      if (satir.pasif) {
        satir.yardim = 'Pasif malzeme — yeni hareket girilemez (D12).';
      }

      satirVerisiKur(satir, hepsi[i]);
      d.satirlar.push(satir);
    }
  }

  function ciz(kap, param) {
    var d = {
      /* Adresle gelen ileri tarih bugüne çekilir (gelecek gün seçilemez). */
      tarih: (function () {
        var t = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
        return t > YU.tarih.bugun() ? YU.tarih.bugun() : t;
      })(),
      satirlar: [],
      /* display:contents — boşken kabın 20px'lik ızgara boşluğunu tüketmesin,
         doluyken şerit doğrudan sayfa akışına girsin. */
      hataKap: YU.h('div', { stil: { display: 'contents' } }),
      uyariKap: YU.h('div', { stil: { display: 'contents' } })
    };
    var i;

    satirlariKur(d);

    /* Sayfa başlığında eylem düğmesi yok. */
    YU.ui.sayfaEylemleri();

    /* Panel TAM GENİŞLİK (kullanıcı isteği, 25.08.2026): 1478px sınırı sağda
       boşluk bırakıyordu. Stok Durumu'nda aynı sınır 24.08.2026'da aynı
       gerekçeyle kaldırılmıştı. */
    var govde = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }
    });
    kap.appendChild(govde);

    d.durumKap = YU.h('div', { stil: { display: 'contents' } });
    govde.appendChild(tarihSeridi(d));

    if (!d.satirlar.length) {
      gunDurumuTazele(d);
      govde.appendChild(girisPaneli(d, YU.ui.bosDurum({
        ikon: '#ic-pencil',
        baslik: 'Aktif Malzeme Yok',
        metin: 'Giriş yapılabilmesi için en az bir aktif malzeme gerekiyor. Malzemeler Malzeme Yönetimi ekranından açılır.',
        eylemler: YU.yonetici()
          ? [YU.ui.dugme({
              metin: 'Malzeme Yönetimi', ikon: '#ic-gear', tur: 'birincil',
              onClick: function () { YU.git('malzeme-yonetimi'); }
            })]
          : []
      })));
      return;
    }

    govde.appendChild(tabloPaneli(d));
    govde.appendChild(d.uyariKap);
    govde.appendChild(d.hataKap);
    govde.appendChild(altBar(d));

    gunDurumuTazele(d);
    for (i = 0; i < d.satirlar.length; i++) satirTazele(d.satirlar[i]);
    ozetTazele(d);
  }

  YU.sayfaTanimla({
    kod: KOD,
    zemin: 'gri-duz',   /* Kuru Küspe Günlük Giriş ile aynı: gri zemin, mavi panel */
    baslik: 'Malzeme Girişi',
    altBaslik: function (param) {
      var t = gecerliTarih(param && param.tarih) ? param.tarih : YU.tarih.bugun();
      if (t > YU.tarih.bugun()) t = YU.tarih.bugun();   /* gelecek gün seçilemez */
      return YU.fmt.tarihUzun(t) + ' · ' + YU.fmt.gunAdi(t) +
        ' · kuru küspe kolonları otomatik doldurulur';
    },
    ikon: '#ic-list-plus',
    grup: 'Giriş',
    rol: 'Hepsi',
    ciz: ciz
  });
})();

/* js/32-tum-hareketler.js — Tüm Hareketler raporu (kullanıcı isteği, 24.08.2026).

   Kampanyadaki bütün silo ve malzeme hareketleri gün gün listelenir. Yapı,
   Kuru Küspe Günlük Giriş'teki "Günün Silo Hareketleri" panelinin dilidir:
   her günün paneli üstte tarihi taşır; kolonlar Silo / Malzeme · Hareket ·
   Giren · Çıkan · Kaydeden. Silinen kayıtlar arşiv kopyasından okunur ve
   çizili + "Silindi" rozetiyle, güncellenenler "Değiştirildi" rozetiyle
   gösterilir. Salt okunur ekran — hiçbir veri değiştirilmez. */
(function () {
  'use strict';

  var YU = window.YU;

  var TIP_ADI = {
    DokmeUretim: 'Dökme Üretim',
    Cuvallama: 'Çuvallama',
    DokmeSatis: 'Dökme Satış',
    Manuel: 'Manuel'
  };

  function kullaniciAdi(depo, id) {
    if (id === null || id === undefined) return null;
    for (var i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].Id === id) return depo.kullanicilar[i].AdSoyad;
    }
    return null;
  }

  function siloAdi(depo, id) {
    for (var i = 0; i < depo.silolar.length; i++) {
      if (depo.silolar[i].Id === id) return depo.silolar[i].Ad;
    }
    return 'Silo #' + id;
  }

  function malzemeAdi(depo, id) {
    for (var i = 0; i < depo.malzemeler.length; i++) {
      if (depo.malzemeler[i].Id === id) return depo.malzemeler[i].Ad;
    }
    return 'Malzeme #' + id;
  }

  function cizili(metin) {
    return YU.h('span', {
      metin: metin,
      stil: { textDecoration: 'line-through', textDecorationColor: 'var(--metin-4)', color: 'var(--metin-4)' }
    });
  }

  function bosHucre() {
    return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
  }

  /* yon ('giren' | 'cikan'): yön taşıyan rakam işaret ve renk alır
     (KURAL 10.1 · kullanıcı isteği, 25.08.2026) — giren "+" yeşil, çıkan
     "−" kırmızı. SİLİNMİŞ satırlar renklenmez: çizili gri kalırlar, yoksa
     iptal edilmiş hareket hâlâ sayılıyormuş gibi okunur. */
  /* Tek gün görünümünde rakam 15px/600; liste görünümünde ortak ölçü kalır. */
  function tekGunGorumu() { return tekGunGorunumu; }
  function iriRakam() {
    return tekGunGorumu() ? { font: '600 15px/1.3 var(--sayi)' } : {};
  }

  function miktarHucresi(deger, silinmis, yon) {
    var n = Number(deger) || 0;
    if (n <= 0) return bosHucre();
    if (silinmis) return cizili(YU.fmt.kg(n));
    if (!yon) return YU.h('span', { metin: YU.fmt.kg(n), stil: iriRakam() });
    var giren = yon === 'giren';
    var stil = iriRakam();
    stil.color = giren ? 'var(--olumlu)' : 'var(--olumsuz)';
    stil.whiteSpace = 'nowrap';
    return YU.h('span', { stil: stil, metin: (giren ? '+' : '−') + YU.fmt.kg(n) });
  }

  /* Değiştirilen malzeme satırında ESKİ değer de okunur (kullanıcı isteği,
     24.08.2026): alanın İLK "Guncelle" logundaki eski değer, güncel rakamın
     altında çizili ve soluk durur — İşlem Geçmişi'ndeki çizili dil. Log
     budanmışsa (5000 satır sınırı) eski değer bulunamayabilir; o durumda
     yalnız "Değiştirildi" rozeti kalır. */
  function ilkEskiDeger(depo, kayitId, alan) {
    for (var i = 0; i < depo.degisiklikLog.length; i++) {
      var l = depo.degisiklikLog[i];
      if (l.Tablo === 'GunlukHareket' && l.KayitId === kayitId &&
          l.Islem === 'Guncelle' && l.Alan === alan) return l.EskiDeger;
    }
    return null;
  }

  /* DEĞİŞTİRİLMİŞ KALEMDE ESKİ DEĞER YAN YANA, ÜSTÜ ÇİZİLİ (kullanıcı
     isteği, 27.08.2026: "mesela 50 kg'dı ilk giren, onun üstünü çiz, 100
     yazılsın"). Eski gösterim rakamın ALTINA küçük bir satır koyuyordu ve
     satırı büyütüyordu; aynı bilgi artık tek satırda, solda soluk ve çizili
     eski değer + sağda güncel değer olarak durur. Yalnız tek gün
     görünümünde kullanılır. */
  function eskisiyleHucre(depo, kayitId, alanAdi, deger, yon, guncellendi) {
    var simdiki = miktarHucresi(deger, false, yon);
    if (!guncellendi) return simdiki;
    var eski = eskiDegerVarsa(depo, kayitId, alanAdi, deger);
    if (eski === null) return simdiki;
    return YU.h('span', {
      stil: {
        display: 'inline-flex', alignItems: 'baseline', gap: '8px',
        justifyContent: 'flex-end', whiteSpace: 'nowrap'
      },
      title: 'Önceki değer ' + eski + ' kg — sonradan değiştirildi.'
    },
      YU.h('span', {
        metin: eski,
        stil: {
          /* Güncel rakamla AYNI ölçüde (15px); ayrımı kalınlık, soluk renk
             ve üstü çizili olması taşır (kullanıcı isteği, 27.08.2026:
             "0 yazıyor ya, büyütsene onu"). Önce 13px'ti, okunmuyordu. */
          font: '500 15px/1.3 var(--sayi)', textDecoration: 'line-through',
          textDecorationColor: 'var(--metin-4)', color: 'var(--metin-4)'
        }
      }),
      /* Eski ile yeni arasına ok (kullanıcı isteği, 27.08.2026): "0 → +100"
         okuması yönü de söyler. Devir önizlemesindeki okluDeger diliyle aynı. */
      YU.h('span', {
        metin: '→', 'aria-hidden': 'true',
        stil: { color: 'var(--metin-5)', font: '400 14px/1.3 var(--font)' }
      }),
      simdiki
    );
  }

  /* Eski değer güncelinden farklıysa döner, değilse null.

     SIFIR BİR "ÖNCEKİ DEĞER" DEĞİLDİR (kullanıcı direktifi, 31.08.2026):
     GunlukHareket satırı üç alan taşır ve satır doğduğu an girilmeyen alanlar
     0 olur. Kullanıcı o boş alanı sonradan ilk kez doldurunca ekranda
     "0 → +10.000 · Değiştirildi" yazıyordu; oysa değiştirilen bir rakam yok,
     alan İLK KEZ giriliyor. Servis katmanı 31.08.2026'dan sonra bunu zaten
     "Ekle" olarak yazıyor (04-servis · logHareketAlanlari); bu satır ESKİ
     kayıtları da düzeltir — o tarihten önce yazılmış loglar hâlâ
     "Guncelle · eski 0" taşıyor.

     Ters yön korunur: 10.000 → 0 gerçek bir silmedir, üstü çizili 10.000
     görünmeye devam eder. */
  function eskiDegerVarsa(depo, kayitId, alanAdi, deger) {
    var eski = ilkEskiDeger(depo, kayitId, alanAdi);
    if (eski === null || eski === undefined || eski === '') return null;
    if (YU.parse.sayi(eski) === 0) return null;
    if (eski === YU.fmt.kg(Number(deger) || 0)) return null;
    return eski;
  }

  /* Bu KALEM gerçekten değişti mi? Kaydın GuncellemeTarihi'si "satırda bir
     şey değişti" der, hangi alanın değiştiğini söylemez — üç kalemin üçüne
     birden "Değiştirildi" rozeti basılıyordu (kullanıcı bildirimi,
     31.08.2026). Ölçü artık kalemin kendi eski değeridir. */
  function kalemDegisti(depo, kayitId, alanAdi, deger, guncellendi) {
    if (!guncellendi || !alanAdi) return false;
    return eskiDegerVarsa(depo, kayitId, alanAdi, deger) !== null;
  }

  function miktarVeEskisi(depo, deger, kayitId, alan, yon) {
    var simdiki = miktarHucresi(deger, false, yon);
    if (tekGunGorumu()) return simdiki;
    var eski = ilkEskiDeger(depo, kayitId, alan);
    if (eski === null || eski === undefined || eski === '' ||
        eski === YU.fmt.kg(Number(deger) || 0)) return simdiki;
    return YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
      title: 'Önceki değer ' + eski + ' — sonradan değiştirildi.'
    },
      simdiki,
      YU.h('span', {
        metin: eski,
        stil: { font: '400 11px/1.3 var(--sayi)', whiteSpace: 'nowrap',
                textDecoration: 'line-through', textDecorationColor: 'var(--metin-4)',
                color: 'var(--metin-4)' }
      })
    );
  }

  /* Kaydeden hücresinde TARİH de yazar (kullanıcı isteği, 26.08.2026):
     24.08'in verisi 26.08'de değiştirilebiliyor, yalnız saat yazınca dokunuşun
     hangi GÜN yapıldığı görünmüyordu. Satır bölünmesin diye nowrap. */
  /* gunu: panelin günü (ISO). Verilirse ve dokunuş AYNI güne düşüyorsa
     yalnız SAAT yazılır — tarih zaten panelin başlığında ve raporun kendi
     gün seçiminde duruyor (kullanıcı isteği, 27.08.2026: "rapora gün seçerek
     girdiğin için hangi tarih olduğu belli"). Dokunuş BAŞKA bir gündeyse
     (geriye dönük düzeltme) tarih yazılmaya devam eder — yoksa "12:34" hangi
     güne ait belli olmazdı. */
  /* 'girdi' / 'değiştirdi' / 'sildi' EKİ YAZILMIYOR (kullanıcı isteği,
     27.08.2026: "sadece isim ve saat"). Bilgi kaybolmuyor: satırın ne
     olduğunu Hareket kolonundaki rozet zaten söylüyor — "Değiştirildi",
     "Silindi". Kolon yalnız KİMİ ve SAAT KAÇTA'yı taşır. */
  function kaydedenHucresi(depo, kullaniciId, damga, gunu) {
    var ad = kullaniciAdi(depo, kullaniciId);
    var ayniGun = !!(gunu && damga && String(damga).slice(0, 10) === gunu);
    var an = damga ? (ayniGun ? YU.fmt.saat(damga) : YU.fmt.tarihSaat(damga)) : null;
    if (!ad && (!an || an === '—')) return bosHucre();
    return YU.h('span', {
      sinif: 'yu-zayif',
      stil: { whiteSpace: 'nowrap' },
      metin: (ad || '—') + (an && an !== '—' ? ' · ' + an : '')
    });
  }

  /* CSV'nin "Hareket" kolonu ekrandaki rozetle AYNI dili konuşur (denetim
     bulgusu BUG-008, 30.08.2026). Eskiden üçlü koşul yalnız üretim ve satışa
     bakıyordu: yalnız iade girilmiş bir satır "Satış" yazıp miktarını 0
     gösteriyor, iade rakamı dosyaya hiç girmiyordu (ölçüldü: 100 kg iade,
     CSV'de "Satış · 0"). Sıra ve boş hâlin karşılığı aşağıdaki
     malzemeHareketRozeti ile birebir aynıdır. */
  function csvHareketAdi(uretim, satis, iade) {
    var par = [];
    if (uretim > 0) par.push('Üretim');
    if (iade > 0) par.push('İade');
    if (satis > 0) par.push('Satış');
    return par.length ? par.join(' + ') : 'Sıfırlandı';
  }

  /* Malzeme satırının hareket rozeti: üretim/iade/satış hangileri varsa
     birlikte okunur (M25 — iade rozeti yoktu; yalnız iadeli satır yanlışça
     "Sıfırlandı" görünüyordu). */
  function malzemeHareketRozeti(uretim, satis, iade) {
    var par = [];
    if (uretim > 0) par.push({ metin: 'Üretim', renk: 'var(--olumlu)', tur: 'olumlu' });
    if (iade > 0) par.push({ metin: 'İade', renk: null, tur: 'notr' });
    /* Tekil satış SARI değil KIRMIZI (kullanıcı isteği, 26.08.2026):
       "bekleyen" sarısı satışı bekleyen bir iş gibi gösteriyordu. */
    if (satis > 0) par.push({ metin: 'Satış', renk: 'var(--olumsuz)', tur: 'olumsuz' });
    if (!par.length) return durumRozeti('Sıfırlandı', 'notr');
    /* TEK GÜN görünümünde kalemler BİRLEŞTİRİLMEZ (kullanıcı isteği,
       27.08.2026: "iadeyi başka bir etiketle birleştirme, iade direkt iade
       olarak kalsın"): her kalem kendi rozetiyle durur. Liste görünümü
       (Tüm Hareketler) parçalı rozeti korur — orada satır çok, yer dar. */
    if (par.length > 1 && tekGunGorumu()) {
      var kap = YU.h('span', {
        stil: { display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }
      });
      for (var r = 0; r < par.length; r++) kap.appendChild(YU.ui.rozet(par[r].metin, par[r].tur));
      return kap;
    }
    if (par.length > 1) return parcaliRozet(par);
    return YU.ui.rozet(par[0].metin, par[0].tur);
  }

  /* Giren hücresi (M25): iade stoğu artırdığı için Giren kolonuna düşer.
     Üretimle birlikteyse üretim üstte, altında küçük "İade X" satırı;
     güncellenmişse iadenin ilk eski değeri çizili okunur. */
  /* etiketsiz: iade GİREN hücresinde tek başınaysa "İade" ön eki yazılmaz —
     satırın Hareket kolonunda zaten "İade" rozeti duruyor, rakam iki kez
     etiketleniyordu (kullanıcı isteği, 27.08.2026). Üretimle ÜST ÜSTE
     düştüğünde etiket KALIR: iki çıplak sayı hangisi hangisi belli olmaz. */
  function iadeSatiri(depo, h, guncellendi, etiketsiz) {
    var iade = Number(h.Iade) || 0;
    if (iade <= 0) return null;
    var eski = guncellendi ? ilkEskiDeger(depo, h.Id, 'İade') : null;
    var kap = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }
    }, YU.h('span', {
      sinif: 'yu-zayif',
      stil: { font: '400 11px/1.3 var(--sayi)', whiteSpace: 'nowrap' },
      metin: (etiketsiz ? '' : 'İade ') + YU.fmt.kg(iade)
    }));
    /* Tek gün görünümünde çizili eski değer çizilmez — miktarVeEskisi ile
       aynı gerekçe (kullanıcı isteği, 27.08.2026). */
    if (!tekGunGorumu() && eski !== null && eski !== undefined && eski !== '' && eski !== YU.fmt.kg(iade)) {
      kap.title = 'Önceki iade ' + eski + ' — sonradan değiştirildi.';
      kap.appendChild(YU.h('span', {
        metin: eski,
        stil: { font: '400 11px/1.3 var(--sayi)', whiteSpace: 'nowrap',
                textDecoration: 'line-through', textDecorationColor: 'var(--metin-4)',
                color: 'var(--metin-4)' }
      }));
    }
    return kap;
  }

  function girenHucresi(depo, h, guncellendi) {
    var u = Number(h.Uretim) || 0;
    var iade = iadeSatiri(depo, h, guncellendi, u <= 0);
    var ust = guncellendi ? miktarVeEskisi(depo, u, h.Id, 'Üretim', 'giren') : miktarHucresi(u, false, 'giren');
    if (!iade) return ust;
    if (u <= 0) return iade;
    return YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }
    }, ust, iade);
  }

  /* DURUM ROZETİ — "Değiştirildi", "Silindi", "Sıfırlandı". Hareketin ADI
     değil, o kayda ne olduğunu söyleyen etikettir. Ek sınıfı yalnız Program
     Hareketleri gün panelinde biçim alır (tema.css: ince çerçeve, renksiz);
     Tüm Hareketler ekranında hiçbir şey değişmez (KURAL 10.5). */
  function durumRozeti(metin, tur) {
    var r = YU.ui.rozet(metin, tur);
    r.className += ' yu-durum-rozet';
    return r;
  }

  function hareketVeSilindi(rozetIcerigi) {
    return YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
      rozetIcerigi, durumRozeti('Silindi', 'olumsuz'));
  }

  /* ------------------------------------------------------------------
     Devir değişiklikleri (kullanıcı isteği, 25.08.2026)
     Devir bir GÜN hareketi değildir; hangi güne ait olduğu değil, HANGİ GÜN
     YAPILDIĞI önemlidir (CLAUDE.md KURAL 7: güne bağlanamayan işlemler
     yapıldıkları günün panelinde listelenir). Kaynak DegisiklikLog'dur —
     DevirStok / SiloDevirStok satırları oradan okunur.
     ------------------------------------------------------------------ */

  var DEVIR_TABLOLARI = { DevirStok: 'Malzeme', SiloDevirStok: 'Silo' };

  function devirLoglari(depo) {
    var l = depo.degisiklikLog || [], cikti = [], i;
    for (i = 0; i < l.length; i++) {
      if (DEVIR_TABLOLARI[l[i].Tablo]) cikti.push(l[i]);
    }
    return cikti;
  }

  function logGunuIso(l) { return String(l.Tarih || '').slice(0, 10); }

  /* Log satırından "kimin devri" bilgisi: kayıt duruyorsa tablodan adı
     okunur; silinmişse (kayıt yok) tablo adına düşülür. */
  function devirSahibi(depo, l) {
    var siloMu = DEVIR_TABLOLARI[l.Tablo] === 'Silo';
    var tablo = siloMu ? depo.siloDevirStok : depo.devirStok;
    var i;
    for (i = 0; i < tablo.length; i++) {
      if (tablo[i].Id !== l.KayitId) continue;
      return {
        ad: siloMu ? siloAdi(depo, tablo[i].SiloId) : malzemeAdi(depo, tablo[i].MalzemeId),
        devirTarihi: tablo[i].DevirTarihi
      };
    }
    return { ad: siloMu ? 'Silo devri' : 'Malzeme devri', devirTarihi: null };
  }

  /* ------------------------------------------------------------------
     Günlere dağıtım — her kaynak kendi gününe eklenir
     ------------------------------------------------------------------ */

  function gunler(depo) {
    var harita = {}, i, sk;

    function gun(tarih) {
      if (!harita[tarih]) harita[tarih] = { silo: [], malzeme: [], silinen: [], devir: [] };
      return harita[tarih];
    }

    for (i = 0; i < depo.siloHareket.length; i++) gun(depo.siloHareket[i].Tarih).silo.push(depo.siloHareket[i]);
    for (i = 0; i < depo.gunlukHareket.length; i++) gun(depo.gunlukHareket[i].Tarih).malzeme.push(depo.gunlukHareket[i]);
    for (i = 0; i < (depo.silinenKayitlar || []).length; i++) {
      sk = depo.silinenKayitlar[i];
      if ((sk.Tablo === 'SiloHareket' || sk.Tablo === 'GunlukHareket') && sk.Kayit && sk.Kayit.Tarih) {
        gun(sk.Kayit.Tarih).silinen.push(sk);
      }
    }
    var dl = devirLoglari(depo);
    for (i = 0; i < dl.length; i++) {
      if (logGunuIso(dl[i])) gun(logGunuIso(dl[i])).devir.push(dl[i]);
    }

    var tarihler = [];
    for (var t in harita) if (harita.hasOwnProperty(t)) tarihler.push(t);
    tarihler.sort();
    tarihler.reverse();   /* en yeni gün en üstte */
    return { tarihler: tarihler, harita: harita };
  }

  /* ------------------------------------------------------------------
     Bir günün paneli — üstte tarih, altta kolonlu hareket tablosu
     ------------------------------------------------------------------ */

  /* sayacGizle: Program Hareketleri tek güne bakar, orada "N hareket" rozeti
     fazladan gürültü yapıyordu (kullanıcı isteği, 25.08.2026). Tüm Hareketler
     ekranında rozet DURUYOR: orada sayfa sayfa çok gün listeleniyor ve rozet
     hangi günün ne kadar dolu olduğunu söylüyor (KURAL 5.1 — istenmeyen
     ekrana dokunulmaz). */
  /* Aynı kaydın silo hareketleri TEK SATIRDA (kullanıcı isteği, 26.08.2026).
     Eskiden "Silo 1 · Dökme Üretim · +4.043" ile "Silo 1 · Dökme Satış ·
     −6.498" iki ayrı satırdı; oysa Giren ve Çıkan zaten AYRI KOLON — aynı
     silonun aynı kaydından gelen iki hareket tek satırda okunur. Rozet dili
     malzeme satırıyla aynı: "Dökme Üretim + Dökme Satış".

     Gruplama anahtarı KaynakKayitId'dir (Şartname §6: silo hareketi kaynağı
     olan günlük kayda referansla bağlanır) — tek kaydetme işleminden doğan
     satırlar birleşir. Kaynağı OLMAYAN hareket (elle Manuel düzeltme)
     birleşmez, kendi satırında kalır: sayım farkı üretim/satışla aynı satıra
     karışmamalı. Kaydeden de anahtara girer; başka biri sonradan eklediyse
     ayrı satır olur ve denetim izi bozulmaz. */
  /* Birleşik rozette PARÇALAR kendi rengini taşır (kullanıcı isteği,
     26.08.2026): zemin mavi kalır, içindeki "Üretim" yeşil, "Satış" kırmızı
     okunur. YU.ui.rozet yalnız düz metin aldığı için kutu burada elle
     kurulur — sınıf aynı (.yu-rozet.vurgu), yalnız içine renkli parçalar
     konur. Ayraç '+' rozetin kendi rengini (mavi) korur; .yu-rozet zaten
     inline-flex + gap olduğu için boşluk elle konmaz. */
  function parcaliRozet(parcalar) {
    var kutu = YU.h('span', { sinif: 'yu-rozet vurgu' }), i;
    for (i = 0; i < parcalar.length; i++) {
      if (i > 0) kutu.appendChild(YU.h('span', { metin: '+' }));
      kutu.appendChild(YU.h('span', {
        stil: parcalar[i].renk ? { color: parcalar[i].renk } : null,
        metin: parcalar[i].metin
      }));
    }
    return kutu;
  }

  /* Yön rengi: giren yeşil, satış kırmızı, çuvallama çekişi sarı (satış
     değil), gerisi rozetin kendi rengi. */
  function siloTipRengi(tip) {
    if (tip === 'DokmeUretim') return 'var(--olumlu)';
    if (tip === 'DokmeSatis') return 'var(--olumsuz)';
    if (tip === 'Cuvallama') return 'var(--bekleyen)';
    return null;
  }

  function siloTipTuru(tip) {
    if (tip === 'DokmeUretim') return 'olumlu';
    if (tip === 'DokmeSatis') return 'olumsuz';
    return 'bekleyen';
  }

  function siloHareketRozeti(tipler) {
    var i, parcalar;
    if (tipler.length > 1) {
      parcalar = [];
      for (i = 0; i < tipler.length; i++) {
        parcalar.push({ metin: TIP_ADI[tipler[i]] || tipler[i], renk: siloTipRengi(tipler[i]) });
      }
      return parcaliRozet(parcalar);
    }
    return YU.ui.rozet(TIP_ADI[tipler[0]] || tipler[0], siloTipTuru(tipler[0]));
  }

  function siloSatiri(h) {
    return {
      siloId: h.SiloId, tipler: [h.HareketTipi],
      giren: Number(h.GirenKg) || 0, cikan: Number(h.CikanKg) || 0,
      kullaniciId: h.OlusturanKullaniciId, an: h.OlusturmaTarihi
    };
  }

  function siloSatirlariniTopla(hareketler) {
    var gruplar = [], dizin = {}, i, j, h, anahtar, grup;

    for (i = 0; i < hareketler.length; i++) {
      h = hareketler[i];
      anahtar = (h.KaynakKayitId === null || h.KaynakKayitId === undefined)
        ? null
        : h.SiloId + '|' + h.KaynakKayitId + '|' + h.OlusturanKullaniciId;
      grup = anahtar === null ? null : dizin[anahtar];
      if (!grup) {
        grup = { hareketler: [] };
        gruplar.push(grup);
        if (anahtar !== null) dizin[anahtar] = grup;
      }
      grup.hareketler.push(h);
    }

    var satirlar = [], girenler, cikanlar, gi, ci, an;
    for (i = 0; i < gruplar.length; i++) {
      girenler = []; cikanlar = [];
      for (j = 0; j < gruplar[i].hareketler.length; j++) {
        h = gruplar[i].hareketler[j];
        if ((Number(h.GirenKg) || 0) > 0) girenler.push(h);
        else cikanlar.push(h);
      }

      /* AYNI YÖNDE iki hareket varsa BİRLEŞMEZ (ölçüldü 26.08.2026: 15.08'de
         Silo 1'in Çuvallama −1.320 ile Dökme Satış −1.951 hareketi tek hücrede
         −3.271 oluyor, iki miktar da okunmaz hâle geliyordu). Şartname §7
         "tüm silo hareketleri" Demirbaş: hiçbir hareketin miktarı gizlenemez.
         Birleşme yalnız Giren ve Çıkan AYRI KOLONLARA düştüğünde olur —
         kullanıcının istediği "Dökme Üretim + Dökme Satış" tam olarak budur. */
      if (girenler.length > 1 || cikanlar.length > 1) {
        for (j = 0; j < gruplar[i].hareketler.length; j++) {
          satirlar.push(siloSatiri(gruplar[i].hareketler[j]));
        }
        continue;
      }

      gi = girenler[0] || null;
      ci = cikanlar[0] || null;
      if (!gi || !ci) { satirlar.push(siloSatiri(gi || ci)); continue; }

      /* Damga satır satır atıldığı için saniye kayabilir; en erken an alınır. */
      an = gi.OlusturmaTarihi;
      if (ci.OlusturmaTarihi && (!an || ci.OlusturmaTarihi < an)) an = ci.OlusturmaTarihi;

      satirlar.push({
        siloId: gi.SiloId,
        tipler: [gi.HareketTipi, ci.HareketTipi],   /* giren önce okunur */
        giren: Number(gi.GirenKg) || 0,
        cikan: Number(ci.CikanKg) || 0,
        kullaniciId: gi.OlusturanKullaniciId,
        an: an
      });
    }
    return satirlar;
  }

  /* TEK GÜN görünümünde (Program Hareketleri) satır rakamları büyür ve
     "eski değer" çizili alt satırı çizilmez (kullanıcı isteği, 27.08.2026:
     "giren çıkanların sayı değerleri çok minik… -200'ün altındaki yazıyı da
     kaldır"). Tüm Hareketler ekranı DEĞİŞMEZ: orası denetim listesi, eski
     değer orada bilerek duruyor (KURAL 5.1). */
  var tekGunGorunumu = false;

  /* ==================================================================
     TEK GÜN PANELİ — BÖLÜMLÜ DÜZEN (kullanıcı isteği, 01.09.2026)

     ÖNCE denenen düzen geri alındı. Kullanıcının sözü: "şu özelliklerin
     hariç geriye al; kampanya devrine tıklayınca açılan kısım kalsın… +
     silolar ve malzemeler değişikliği diye ayıralım, silo değişimleri üstte
     olsun, malzeme değişimleri altta olsun."

     GERİ ALINANLAR (bir denendi, kullanıcı istemedi): kayıt anına göre grup
     başlıkları, silo satırlarının malzemenin yavrusu olması, silinen + yeni
     hareketin "eski → yeni" tek satırda birleşmesi, alt satırlarda Kaydeden
     kolonunun boşalması.

     KALAN İKİ ŞEY:
       1. DEVİRLER TEK SATIRDA. "Kampanya Devri · N kalem" satırına tıklanınca
          kalemler açılır. Devir bir gün hareketi değil, hesabın tabanıdır;
          11 satırla günün 4 hareketini bastırıyordu.
       2. İKİ BÖLÜM. Önce "Silo Hareketleri", sonra "Malzeme Hareketleri"
          (adlar 02.09.2026'da "… Değişimleri"nden çevrildi).
          Satırların kendisi ESKİSİ GİBİ kurulur; yalnız sıraları değişti ve
          araya bölüm başlığı girdi. Her bölümün içinde eskiden yeniye sıra
          korunur.

     KAPSAM: yalnız Program Hareketleri (tek gün görünümü). Tüm Hareketler
     ekranı denetim listesidir, aynen kalır (KURAL 5.1).

     GERİ ALMAK İÇİN: aşağıdaki YENI_GUN_DUZENI'yi false yap — panel eski
     tek listesine döner. css/tema.css'teki "PROGRAM HAREKETLERİ GÜN PANELİ"
     bloğu da silinebilir; yalnız bu düzenin satırlarını biçimler.
     ================================================================== */
  var YENI_GUN_DUZENI = true;

  /* Malzeme satırının ham verisi. Bölümlere ayırmak için tur yeter; malzeme
     kimliği ileride gerekirse diye duruyor. */
  function malzemeBilgisi(depo, h, guncellendi, degerKolonu) {
    return {
      tur: 'malzeme',
      malzemeId: h.MalzemeId,
      degerKolonu: degerKolonu || null,
      kullaniciId: guncellendi ? h.GuncelleyenKullaniciId : h.OlusturanKullaniciId
    };
  }

  /* AÇ/KAPAT KALDIRILDI (kullanıcı isteği, 01.09.2026: "kampanya devri her
     seferinde açıkmış gibi olsun, solundaki noktayı da kaldır"). Üç bölüm
     başlığı da artık birebir aynı: düz yazı, ok yok, tıklama yok. */
  function bolumSatiri(baslik) {
    return {
      sinif: 'yu-gun-bolum',
      hucreler: [YU.h('span', { sinif: 'yu-guclu', metin: baslik }), '', '', '']
    };
  }

  /* Beş hücrelik satır dört hücreye iner: Giren ve Çıkan tek DEĞER kolonunda
     birleşir. Hangisinin taşındığını bilgi.degerKolonu söyler; bilinmiyorsa
     dolu olan hücre alınır ("—" boş sayılır). */
  function dortHucre(oge) {
    var h = oge.satir, b = oge.bilgi || {}, deger;
    if (b.degerKolonu === 'cikan') deger = h[3];
    else if (b.degerKolonu === 'giren') deger = h[2];
    else {
      var cikanMetni = h[3] && h[3].textContent ? h[3].textContent.trim() : '';
      deger = (cikanMetni && cikanMetni !== '—') ? h[3] : h[2];
    }
    return [h[0], h[1], deger, h[4]];
  }

  function gunDuzeni(depo, tarih, zamanli) {
    var satirlar = [], devirler = [], silolar = [], malzemeler = [], i, tur;

    for (i = 0; i < zamanli.length; i++) {
      tur = (zamanli[i].bilgi || {}).tur;
      if (tur === 'devir') devirler.push(zamanli[i]);
      else if (tur === 'silo' || tur === 'silo-silinen') silolar.push(zamanli[i]);
      else malzemeler.push(zamanli[i]);
    }

    /* Devirler en üstte ve AÇIK; bölüm öbür ikisiyle birebir aynı. */
    if (devirler.length) {
      satirlar.push(bolumSatiri('Kampanya Devri'));
      for (i = 0; i < devirler.length; i++) {
        satirlar.push({ sinif: 'yu-devir-satiri', hucreler: dortHucre(devirler[i]) });
      }
    }

    if (silolar.length) {
      /* "Silo Değişimleri" -> "Silo Hareketleri" (kullanıcı isteği,
         02.09.2026): bölüm bir günün silo hareketlerini listeliyor; satırlar
         hareket, "değişim" değil. */
      satirlar.push(bolumSatiri('Silo Hareketleri'));
      for (i = 0; i < silolar.length; i++) satirlar.push({ hucreler: dortHucre(silolar[i]) });
    }

    if (malzemeler.length) {
      satirlar.push(bolumSatiri('Malzeme Hareketleri'));
      for (i = 0; i < malzemeler.length; i++) satirlar.push({ hucreler: dortHucre(malzemeler[i]) });
    }

    return satirlar;
  }

  function gunPaneli(depo, tarih, g, sayacGizle) {
    var satirlar = [], i, h, u, s;
    /* KRONOLOJİK AKIŞ (kullanıcı direktifi, 28.08.2026: "günlük işlemlerin
       sıralaması eskiden yeniye olsun, en eski saat 1. sırada"). Eskiden
       bölüm sırası sabitti (silolar → malzemeler → devirler → silinenler)
       ve 15:03'te silinen bir hareket 16:40'lık malzeme satırının ALTINDA
       kalabiliyordu. Artık her satır işlem damgasıyla toplanır ve panel
       basılmadan önce eskiden yeniye dizilir; damgası eş satırlar bölüm
       sırasını korur (kararlı sıralama). */
    var zamanli = [];
    /* bilgi: YENI_GUN_DUZENI icin satirin ham verisi (tur, silo, malzeme,
       miktarlar). Eski duzende hic okunmaz; anahtar kapaliyken olu yuktur. */
    function ekle(an, satir, bilgi) {
      zamanli.push({ an: String(an || ''), sira: zamanli.length, satir: satir, bilgi: bilgi || null });
    }
    /* Rozet GERÇEK hareket sayısını söyler, satır sayısını değil: silo
       satırları birleştiği için ikisi artık aynı sayı değil. */
    var hareketSayisi = g.silo.length + g.malzeme.length +
      (g.devir || []).length + (g.silinen || []).length;

    /* SİLO SATIRLARI BİRLEŞMEZ (kullanıcı isteği, 01.09.2026: "üretim ayrı
       satış ayrı olsun"). Tek değer kolonu var; bir satırda hem giren hem
       çıkan taşınamaz. Tüm Hareketler ekranında birleşme sürer. */
    var siloGruplari;
    if (YENI_GUN_DUZENI && tekGunGorumu()) {
      siloGruplari = [];
      for (i = 0; i < g.silo.length; i++) siloGruplari.push(siloSatiri(g.silo[i]));
    } else {
      siloGruplari = siloSatirlariniTopla(g.silo);
    }
    for (i = 0; i < siloGruplari.length; i++) {
      h = siloGruplari[i];
      ekle(h.an, [
        YU.h('span', { sinif: 'yu-guclu', metin: siloAdi(depo, h.siloId) }),
        siloHareketRozeti(h.tipler),
        miktarHucresi(h.giren, false, 'giren'),
        miktarHucresi(h.cikan, false, 'cikan'),
        kaydedenHucresi(depo, h.kullaniciId, h.an, tarih)
      ], { tur: 'silo', siloId: h.siloId, tipler: h.tipler, giren: h.giren,
           cikan: h.cikan, kullaniciId: h.kullaniciId,
           degerKolonu: h.giren > 0 ? 'giren' : 'cikan' });
    }

    for (i = 0; i < g.malzeme.length; i++) {
      h = g.malzeme[i];
      u = Number(h.Uretim) || 0;
      s = Number(h.Satis) || 0;
      var guncellendi = !!h.GuncellemeTarihi;
      var iadeH = Number(h.Iade) || 0;   /* M25 */
      var hareketAni = guncellendi ? h.GuncellemeTarihi : h.OlusturmaTarihi;
      var kaydedenH = guncellendi
        ? kaydedenHucresi(depo, h.GuncelleyenKullaniciId, h.GuncellemeTarihi, tarih)
        : kaydedenHucresi(depo, h.OlusturanKullaniciId, h.OlusturmaTarihi, tarih);

      /* TEK GÜN GÖRÜNÜMÜ — ÜRETİM + SATIŞ TEK SATIRDA, İADE KENDİ SATIRINDA
         (kullanıcı direktifi, 31.08.2026).

         Kullanıcının sözü: "iade ayrı etiket ve satırda kalsın. üretim+satışta
         ise aynı etiket kalabilir ama üretim 1000 | satış 2500 → 5000 gibi
         olsun; ana yapı böyle zaten."

         DOĞRU: bu düzen Dökme Kuru Küspe'de 28.08.2026'dan beri vardı; artık
         BÜTÜN malzemeler için geçerli. Üretim ve satış aynı kaydın iki
         yönüdür ve tabloda zaten iki ayrı kolonu var (Giren / Çıkan) — ayrı
         satırlara bölmek aynı kaydı iki kez gösteriyordu. İade ayrı kalır:
         Giren kolonunu üretimle paylaşamaz.

         Bu, 27.08.2026'daki "her kalem kendi satırında" kararının yerine
         geçer; o karar iadenin satışla aynı hücrede yığılmasını çözmek
         içindi ve iade zaten ayrı satırda kalıyor. */
      if (tekGunGorumu()) {
        /* Kalem, RAKAMI VARSA ya da sonradan SIFIRLANMIŞSA görünür:
           50 kg satış silinip 0'a çekildiyse üstü çizili okunmalı, yoksa
           değişiklik büsbütün kaybolurdu. */
        function gorunur(alanAdi, deger) {
          return deger > 0 || !!(guncellendi && eskiDegerVarsa(depo, h.Id, alanAdi, deger));
        }

        /* Tek kalemin satırı. Rozet KAYDIN değil bu KALEMİN durumunu söyler
           (31.08.2026): ilk kez girilen rakam değişiklik sayılmaz. */
        function kalemSatiri(alanAdi, tur, deger, gorunsun, yon) {
          if (!gorunsun) return;
          var rozetKutu = YU.h('span', {
            stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }
          }, YU.ui.rozet(alanAdi, tur));
          if (kalemDegisti(depo, h.Id, alanAdi, deger, guncellendi)) {
            rozetKutu.appendChild(durumRozeti('Değiştirildi', 'bekleyen'));
          }
          ekle(hareketAni, [
            YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
            rozetKutu,
            yon === 'giren' ? eskisiyleHucre(depo, h.Id, alanAdi, deger, 'giren', guncellendi) : bosHucre(),
            yon === 'cikan' ? eskisiyleHucre(depo, h.Id, alanAdi, deger, 'cikan', guncellendi) : bosHucre(),
            kaydedenH.cloneNode(true)
          ], malzemeBilgisi(depo, h, guncellendi, yon));
        }
        var uVar = gorunur('Üretim', u);
        var sVar = gorunur('Satış', s);
        var iVar = gorunur('İade', iadeH);

        /* ÜRETİM VE SATIŞ AYRI SATIRDA (kullanıcı isteği, 01.09.2026:
           "üretim + satışı artık ayır, üretim ayrı satış ayrı olsun").
           31.08.2026'da ikisi tek satıra alınmıştı; o karar bu istekle
           değişti. Tek değer kolonuna geçildiği için zaten zorunlu:
           bir satır tek rakam taşır. */
        kalemSatiri('Üretim', 'olumlu', u, uVar, 'giren');
        kalemSatiri('Satış', 'olumsuz', s, sVar, 'cikan');

        if (iVar) {
          var iadeDegisti = kalemDegisti(depo, h.Id, 'İade', iadeH, guncellendi);
          ekle(hareketAni, [
            YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
            iadeDegisti
              ? YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
                  YU.ui.rozet('İade', 'notr'), durumRozeti('Değiştirildi', 'bekleyen'))
              : YU.ui.rozet('İade', 'notr'),
            eskisiyleHucre(depo, h.Id, 'İade', iadeH, 'giren', guncellendi),
            bosHucre(),
            kaydedenH.cloneNode(true)
          ], malzemeBilgisi(depo, h, guncellendi, 'giren'));
        }

        /* Üç alanın üçü de boş: kayıt sıfırlanmış demektir, satır yine görünür. */
        if (!uVar && !sVar && !iVar) {
          ekle(hareketAni, [
            YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
            durumRozeti('Sıfırlandı', 'notr'),
            bosHucre(),
            bosHucre(),
            kaydedenH
          ], malzemeBilgisi(depo, h, guncellendi));
        }
        continue;
      }

      /* Çok günlü listede satır üç kalemi birlikte taşır; rozet ancak
         kalemlerden biri GERÇEKTEN değiştiyse çıkar (31.08.2026 — tek gün
         panelindeki ölçünün aynısı, iki yerde ayrı davranmasın). */
      var satirDegisti = kalemDegisti(depo, h.Id, 'Üretim', u, guncellendi) ||
                         kalemDegisti(depo, h.Id, 'Satış', s, guncellendi) ||
                         kalemDegisti(depo, h.Id, 'İade', iadeH, guncellendi);
      ekle(hareketAni, [
        YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
        satirDegisti
          ? YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
              malzemeHareketRozeti(u, s, iadeH), durumRozeti('Değiştirildi', 'bekleyen'))
          : malzemeHareketRozeti(u, s, iadeH),
        girenHucresi(depo, h, guncellendi),
        guncellendi ? miktarVeEskisi(depo, s, h.Id, 'Satış', 'cikan') : miktarHucresi(s, false, 'cikan'),
        kaydedenH
      ]);
    }

    /* Devir değişiklikleri: kronolojik akışta yapılış anına otururlar.
       Giren/Çıkan boş kalır — devir bir hareket değil, hesabın TABANIDIR;
       değişimi "eski → yeni" olarak Hareket kolonunda okunur. */
    (g.devir || []).sort(function (a, b) { return String(a.Tarih).localeCompare(String(b.Tarih)); });
    for (i = 0; i < (g.devir || []).length; i++) {
      (function (l) {
        var sahip = devirSahibi(depo, l);
        var tur = l.Islem === 'Ekle' ? 'olumlu' : (l.Islem === 'Sil' ? 'olumsuz' : 'bekleyen');
        var rozetAdi = l.Islem === 'Ekle' ? 'Devir Eklendi'
          : (l.Islem === 'Sil' ? 'Devir Silindi' : 'Devir Değişti');
        /* "Kampanya devri · 01.09.2026" alt satırı TEK GÜN görünümünde
           YAZILMAZ (kullanıcı isteği, 01.09.2026). Satır zaten "Kampanya
           Devri" bölümünün altında duruyor ve tarih panelin başlığında —
           aynı şey üç kez yazılıyordu (KURAL 11). Tüm Hareketler ekranında
           kalır: orada bölüm başlığı yok, gün gün liste var (KURAL 5.1). */
        var adKutu = YENI_GUN_DUZENI && tekGunGorumu()
          ? YU.h('span', { sinif: 'yu-guclu', metin: sahip.ad })
          : YU.h('div', null,
              YU.h('div', { sinif: 'yu-guclu', metin: sahip.ad }),
              YU.h('div', {
                sinif: 'yu-yardim',
                metin: 'Kampanya devri' + (sahip.devirTarihi ? ' · ' + YU.fmt.tarih(sahip.devirTarihi) : '')
              })
            );
        var degisim;
        if (l.Alan && l.EskiDeger !== null && l.EskiDeger !== undefined && l.EskiDeger !== '') {
          degisim = YU.h('span', { stil: { whiteSpace: 'nowrap' } },
            YU.h('span', { stil: { color: 'var(--olumsuz)', fontFamily: 'var(--sayi)', fontWeight: '600' }, metin: String(l.EskiDeger) }),
            YU.h('span', { stil: { color: 'var(--metin-5)', margin: '0 7px' }, metin: '→' }),
            YU.h('span', { stil: { color: 'var(--olumlu)', fontFamily: 'var(--sayi)', fontWeight: '600' }, metin: String(l.YeniDeger) }),
            YU.h('span', { sinif: 'yu-zayif', metin: ' kg' })
          );
        } else {
          /* AYNI TARİH İKİ KEZ YAZILMASIN (kullanıcı isteği, 27.08.2026):
             sol kolonda "Kampanya devri · 27.08.2026" zaten duruyor; log
             değeri de "27.08.2026 · 1.000 kg" diye başlıyordu. Ön ek yalnız
             SOLDAKİYLE AYNI tarihse atılır — farklı bir tarihse (devir başka
             bir güne taşınmışsa) yazıda kalır, bilgi kaybolmaz. */
          var deger = String(l.YeniDeger || l.EskiDeger || '');
          if (sahip.devirTarihi) {
            var onEk = YU.fmt.tarih(sahip.devirTarihi) + ' · ';
            if (deger.indexOf(onEk) === 0) deger = deger.slice(onEk.length);
          }
          degisim = YU.h('span', { sinif: 'yu-zayif', metin: deger });
        }
        /* Devir rakamı DEĞER kolonuna geçti (kullanıcı isteği, 01.09.2026:
           "devirdeki değerleri de değer kısmına koy ama renksiz olsun").
           Hareket kolonunda yalnız "Devir Eklendi" kalır. Tüm Hareketler
           ekranında rakam eskisi gibi rozetin yanında durur (KURAL 5.1). */
        var yeniDuzenDevir = YENI_GUN_DUZENI && tekGunGorumu();
        ekle(l.Tarih, [
          adKutu,
          yeniDuzenDevir
            ? YU.ui.rozet(rozetAdi, tur)
            : YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
                YU.ui.rozet(rozetAdi, tur), degisim),
          yeniDuzenDevir ? degisim : bosHucre(),
          bosHucre(),
          kaydedenHucresi(depo, l.KullaniciId, l.Tarih, tarih)
        ], { tur: 'devir', kullaniciId: l.KullaniciId, degerKolonu: 'giren' });
      })(g.devir[i]);
    }

    /* Silinenler de kronolojik akışta silinme anına otururlar. */
    g.silinen.sort(function (a, b) { return String(a.SilmeTarihi).localeCompare(String(b.SilmeTarihi)); });
    for (i = 0; i < g.silinen.length; i++) {
      var sk = g.silinen[i], k = sk.Kayit;
      if (sk.Tablo === 'SiloHareket') {
        ekle(sk.SilmeTarihi, [
          cizili(siloAdi(depo, k.SiloId)),
          hareketVeSilindi(cizili(TIP_ADI[k.HareketTipi] || k.HareketTipi)),
          miktarHucresi(k.GirenKg, true),
          miktarHucresi(k.CikanKg, true),
          kaydedenHucresi(depo, sk.KullaniciId, sk.SilmeTarihi, tarih)
        ], { tur: 'silo-silinen', siloId: k.SiloId, tipler: [k.HareketTipi],
             tip: k.HareketTipi, giren: Number(k.GirenKg) || 0,
             cikan: Number(k.CikanKg) || 0, kullaniciId: sk.KullaniciId });
      } else {
        u = Number(k.Uretim) || 0;
        s = Number(k.Satis) || 0;
        var iadeS = Number(k.Iade) || 0;   /* M25: silinen satırda da iade okunur */
        var parS = [];
        if (u > 0) parS.push('Üretim');
        if (iadeS > 0) parS.push('İade');
        if (s > 0) parS.push('Satış');
        ekle(sk.SilmeTarihi, [
          cizili(malzemeAdi(depo, k.MalzemeId)),
          hareketVeSilindi(cizili(parS.length ? parS.join(' + ') : 'Sıfırlandı')),
          iadeS > 0 && u <= 0
            ? cizili('İade ' + YU.fmt.kg(iadeS))
            : (iadeS > 0
                ? YU.h('div', { stil: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' } },
                    miktarHucresi(u, true), cizili('İade ' + YU.fmt.kg(iadeS)))
                : miktarHucresi(u, true)),
          miktarHucresi(s, true),
          kaydedenHucresi(depo, sk.KullaniciId, sk.SilmeTarihi, tarih)
        ], { tur: 'malzeme-silinen', malzemeId: k.MalzemeId, kullaniciId: sk.KullaniciId });
      }
    }

    /* Eskiden yeniye: damga eşitse toplanma (bölüm) sırası korunur. */
    zamanli.sort(function (a, b) {
      if (a.an !== b.an) return a.an < b.an ? -1 : 1;
      return a.sira - b.sira;
    });
    if (YENI_GUN_DUZENI && tekGunGorumu()) {
      satirlar = gunDuzeni(depo, tarih, zamanli);
    } else {
      for (i = 0; i < zamanli.length; i++) satirlar.push(zamanli[i].satir);
    }

    var panel = YU.ui.panel({
      baslik: YU.fmt.tarih(tarih) + ' · ' + YU.fmt.gunAdi(tarih),
      ikon: '#ic-calendar',
      sag: sayacGizle ? null : YU.ui.rozet(YU.fmt.sayi(hareketSayisi) + ' hareket', 'notr'),
      dolgusuz: true,
      govde: YU.ui.tablo({
        /* Giren/Çıkan SOLA çekildi ve araları açıldı (kullanıcı isteği,
           27.08.2026). Ölçü şu kurguyla değişti: ilk üç kolon sabitlendi,
           artan yeri EN SAĞDAKİ Kaydeden emiyor — böylece sayı çifti sağ
           kenardan uzaklaşıp ortaya doğru geliyor. Çıkan kolonu Giren'den
           geniş: iki rakam arasındaki boşluk oradan doğuyor. Aralarındaki
           ince çizgi 'yu-kolon-ayrac' ile gelir (tema.css). */
        /* TEK DEĞER KOLONU (kullanıcı isteği, 01.09.2026: "giren çıkan
           olarak değil de sadece değer kolonu koy"). Yön artık rakamın
           kendi işaretinde ve renginde: giren +yeşil, çıkan −kırmızı.
           Her satır tek rakam taşır — üretim, satış ve iade ayrı satırlarda.
           Tüm Hareketler ekranı iki kolonlu kalır (KURAL 5.1). */
        sutunlar: (YENI_GUN_DUZENI && tekGunGorumu()) ? [
          { baslik: 'Silo / Malzeme', genislik: 380 },
          { baslik: 'Hareket', genislik: 360 },
          { baslik: 'Değer', hiza: 'sag', mono: true, genislik: 220, sinif: 'yu-kolon-ayrac' },
          { baslik: 'Kaydeden', hiza: 'sag' }
        ] : [
          /* 260/240 -> 320/300: Giren/Çıkan bir kademe SAĞA alındı
             (kullanıcı isteği, 27.08.2026). Sayı çifti kolonların genişliği
             kadar kayar; Kaydeden yine artan yeri emer. */
          { baslik: 'Silo / Malzeme', genislik: 380 },
          { baslik: 'Hareket', genislik: 360 },
          { baslik: 'Giren', hiza: 'sag', mono: true, genislik: 140 },
          { baslik: 'Çıkan', hiza: 'sag', mono: true, genislik: 170, sinif: 'yu-kolon-ayrac' },
          { baslik: 'Kaydeden', hiza: 'sag' }
        ],
        satirlar: satirlar,
        /* ŞERİT KAPALI (kullanıcı isteği, 01.09.2026): "aynı kategoride
           bunlar hep aynı". Bölümlü düzende satırlar bir zeminli bir
           zeminsiz gitmez; ayrımı bölüm başlıkları taşır. Tüm Hareketler
           ekranında şerit AYNEN kalır — orası bölümsüz tek listedir. */
        serit: !(YENI_GUN_DUZENI && tekGunGorumu()),
        kompakt: true,
        /* Satır ve kolon çizgileri bir ton sert (27.08.2026) — bkz. tema.css. */
        sinif: 'yu-tablo-sert-ayrac',
        bos: 'Bu güne ait hareket yok.'
      })
    });

    /* Kolon ölçüleri ancak tablo sıkışmazsa tutar: dar pencerede tarayıcı
       sabit genişlikleri de kısıyor ve Çıkan, Giren'den dar kalıyordu
       (ölçüldü: 981px kapta 127px'e indi). Alt sınır konur, kap gerekirse
       yatay kaydırır — .yu-tablo-sar zaten overflow-x: auto. */
    var tabloEl = panel.querySelector('table');
    if (tabloEl) {
      tabloEl.style.minWidth = (YENI_GUN_DUZENI && tekGunGorumu())
        ? '1260px'    /* 380+360+220+300 */
        : '1350px';   /* 380+360+140+170+300 */
    }
    if (YENI_GUN_DUZENI && tekGunGorumu()) panel.className += ' yu-gun-paneli';
    return panel;
  }

  /* Program Hareketleri bu paneli TEK GÜN için kullanır (kullanıcı isteği,
     24.08.2026): oradaki Silo Hareketleri + İşlem Geçmişi panellerinin yerine
     buradaki gün paneli dili geçti. silinenDahil=false operatör görünümüdür —
     silinen kayıtlar ve "kim sildi" yönetici bilgisidir (Şartname §7). */
  YU.gunHareketPaneli = function (depo, tarih, silinenDahil) {
    var g = { silo: [], malzeme: [], silinen: [], devir: [] }, i, sk;
    for (i = 0; i < depo.siloHareket.length; i++) {
      if (depo.siloHareket[i].Tarih === tarih) g.silo.push(depo.siloHareket[i]);
    }
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      if (depo.gunlukHareket[i].Tarih === tarih) g.malzeme.push(depo.gunlukHareket[i]);
    }
    if (silinenDahil) {
      for (i = 0; i < (depo.silinenKayitlar || []).length; i++) {
        sk = depo.silinenKayitlar[i];
        if ((sk.Tablo === 'SiloHareket' || sk.Tablo === 'GunlukHareket') && sk.Kayit && sk.Kayit.Tarih === tarih) {
          g.silinen.push(sk);
        }
      }
    }
    var dl2 = devirLoglari(depo);
    for (i = 0; i < dl2.length; i++) {
      if (logGunuIso(dl2[i]) === tarih) g.devir.push(dl2[i]);
    }
    tekGunGorunumu = true;
    try {
      return gunPaneli(depo, tarih, g, true);   /* tek gün: sayaç rozeti yok */
    } finally {
      tekGunGorunumu = false;
    }
  };

  /* Program Hareketleri "bu gün boş mu" kararını bu panelin kuralıyla verir.
     Devir satırları DEĞİŞİKLİĞİN YAPILDIĞI güne düşer, devir tarihine değil
     (yukarıdaki logGunuIso). Kural iki ekrana kopyalanırsa zamanla ayrışır;
     tek yerde durup buradan dışa veriliyor (kullanıcı bildirimi, 27.08.2026:
     "devir girdim ama Program Hareketleri'nde gözükmüyor"). */
  YU.gunDevirLoglari = function (depo, tarih) {
    var dl = devirLoglari(depo), liste = [], i;
    for (i = 0; i < dl.length; i++) if (logGunuIso(dl[i]) === tarih) liste.push(dl[i]);
    return liste;
  };

  YU.gunDevirLogSayisi = function (depo, tarih) {
    return YU.gunDevirLoglari(depo, tarih).length;
  };

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------
     Sayfalama (DUZELTME-PLANI M11) — iki kampanyanın tamamı (~150+ gün,
     binlerce DOM satırı) tek seferde basılıyordu; diğer liste ekranları gibi
     sayfalı çizilir. Sayfa ?sayfa= parametresiyle taşınır (geri tuşu çalışır).
     Dil, 26-gecmis-girisler'deki sayfalama şerididir.
     ------------------------------------------------------------------ */

  var GUN_SAYFA = 10;           /* sayfa başına gün paneli */
  var SAYFA_PENCERE = 7;        /* şeritte görünen numara sayısı */

  function sayfaNumaralari(aktif, toplam) {
    var liste = [], i, bas, bit;
    if (toplam <= SAYFA_PENCERE) {
      for (i = 1; i <= toplam; i++) liste.push(i);
      return liste;
    }
    bas = aktif - Math.floor((SAYFA_PENCERE - 2) / 2);
    if (bas < 2) bas = 2;
    bit = bas + SAYFA_PENCERE - 3;
    if (bit > toplam - 1) { bit = toplam - 1; bas = bit - (SAYFA_PENCERE - 3); if (bas < 2) bas = 2; }
    liste.push(1);
    if (bas > 2) liste.push(null);
    for (i = bas; i <= bit; i++) liste.push(i);
    if (bit < toplam - 1) liste.push(null);
    liste.push(toplam);
    return liste;
  }

  function sayfalamaSeridi(sayfa, sayfaSayisi) {
    var serit = YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }
    });
    serit.appendChild(YU.ui.dugme({
      metin: 'Önceki', tur: 'ikincil', kucuk: true, pasif: sayfa <= 1,
      onClick: function () { YU.git('tum-hareketler', { sayfa: sayfa - 1 }); }
    }));
    var numaralar = sayfaNumaralari(sayfa, sayfaSayisi), i;
    for (i = 0; i < numaralar.length; i++) {
      if (numaralar[i] === null) {
        serit.appendChild(YU.h('span', { sinif: 'yu-zayif', metin: '…' }));
        continue;
      }
      (function (no) {
        serit.appendChild(YU.ui.dugme({
          metin: String(no), tur: no === sayfa ? 'birincil' : 'sade', kucuk: true,
          onClick: function () { if (no !== sayfa) YU.git('tum-hareketler', { sayfa: no }); }
        }));
      })(numaralar[i]);
    }
    serit.appendChild(YU.ui.dugme({
      metin: 'Sonraki', tur: 'ikincil', kucuk: true, pasif: sayfa >= sayfaSayisi,
      onClick: function () { YU.git('tum-hareketler', { sayfa: sayfa + 1 }); }
    }));
    return serit;
  }

  function ciz(kap, param) {
    var depo = YU.db;
    if (!depo) return;

    /* CSV dışa aktarma (M17): sayfalamadan bağımsız, TÜM günler indirilir. */
    YU.ui.sayfaEylemleri(YU.ui.dugme({
      metin: 'CSV İndir', ikon: '#ic-download', tur: 'ikincil',
      baslik: 'Bütün hareketleri (silinenler dahil) Excel uyumlu CSV olarak indirir',
      onClick: function () {
        var v = gunler(depo), i, j, t, g, h, u, s, ia, sk, k;
        /* İade KENDİ KOLONUNDA (BUG-008): ekranda ayrı satırda duran iade,
           CSV'de tek satırlık kayda sığsın diye kolon olarak yazılır — üretim
           ya da satış kolonuna katılsaydı toplamlar bozulurdu (iade stoğa
           girmez, 04-servis · malzemeHesapla). */
        var satirlar = [['Tarih', 'Tür', 'Silo / Malzeme', 'Hareket', 'Giren (kg)', 'Çıkan (kg)', 'İade (kg)', 'Durum']];
        for (i = 0; i < v.tarihler.length; i++) {
          t = v.tarihler[i];
          g = v.harita[t];
          for (j = 0; j < g.silo.length; j++) {
            h = g.silo[j];
            satirlar.push([YU.fmt.tarih(t), 'Silo', siloAdi(depo, h.SiloId),
              TIP_ADI[h.HareketTipi] || h.HareketTipi,
              YU.csvSayi(h.GirenKg), YU.csvSayi(h.CikanKg), '', '']);
          }
          for (j = 0; j < g.malzeme.length; j++) {
            h = g.malzeme[j];
            u = Number(h.Uretim) || 0;
            s = Number(h.Satis) || 0;
            ia = Number(h.Iade) || 0;
            satirlar.push([YU.fmt.tarih(t), 'Malzeme', malzemeAdi(depo, h.MalzemeId),
              csvHareketAdi(u, s, ia),
              YU.csvSayi(u), YU.csvSayi(s), YU.csvSayi(ia),
              h.GuncellemeTarihi ? 'Değiştirildi' : '']);
          }
          for (j = 0; j < g.silinen.length; j++) {
            sk = g.silinen[j];
            k = sk.Kayit;
            if (sk.Tablo === 'SiloHareket') {
              satirlar.push([YU.fmt.tarih(t), 'Silo', siloAdi(depo, k.SiloId),
                TIP_ADI[k.HareketTipi] || k.HareketTipi,
                YU.csvSayi(k.GirenKg), YU.csvSayi(k.CikanKg), '', 'Silindi']);
            } else {
              /* Silinen malzeme satırında da iade okunur — ekran zaten
                 okuyordu (M25), CSV okumuyordu. */
              satirlar.push([YU.fmt.tarih(t), 'Malzeme', malzemeAdi(depo, k.MalzemeId),
                csvHareketAdi(Number(k.Uretim) || 0, Number(k.Satis) || 0, Number(k.Iade) || 0),
                YU.csvSayi(k.Uretim), YU.csvSayi(k.Satis), YU.csvSayi(k.Iade), 'Silindi']);
            }
          }
        }
        YU.csvIndir('tum-hareketler-' + YU.tarih.bugun() + '.csv', satirlar);
      }
    }));

    var d = gunler(depo);
    if (!d.tarihler.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-doc',
        baslik: 'Henüz Hareket Yok',
        metin: 'Kuru küspe ve malzeme girişleri kaydedildikçe bütün hareketler burada gün gün listelenir.'
      }));
      return;
    }

    var sayfaSayisi = Math.max(1, Math.ceil(d.tarihler.length / GUN_SAYFA));
    var sayfa = parseInt(param && param.sayfa, 10);
    if (!isFinite(sayfa) || sayfa < 1) sayfa = 1;
    if (sayfa > sayfaSayisi) sayfa = sayfaSayisi;

    var bas = (sayfa - 1) * GUN_SAYFA;
    var dilim = d.tarihler.slice(bas, bas + GUN_SAYFA);

    kap.appendChild(YU.h('div', {
      sinif: 'yu-zayif',
      stil: { font: '400 12px/1.4 var(--font)' },
      metin: YU.fmt.sayi(d.tarihler.length) + ' günün ' + YU.fmt.sayi(bas + 1) + '–' +
        YU.fmt.sayi(bas + dilim.length) + '. günleri · sayfa ' +
        YU.fmt.sayi(sayfa) + ' / ' + YU.fmt.sayi(sayfaSayisi)
    }));

    for (var i = 0; i < dilim.length; i++) {
      kap.appendChild(gunPaneli(depo, dilim[i], d.harita[dilim[i]]));
    }

    if (sayfaSayisi > 1) kap.appendChild(sayfalamaSeridi(sayfa, sayfaSayisi));
  }

  YU.sayfaTanimla({
    kod: 'tum-hareketler',
    baslik: 'Tüm Hareketler',
    altBaslik: function () {
      var depo = YU.db;
      if (!depo) return '';
      var toplam = depo.siloHareket.length + depo.gunlukHareket.length;
      return YU.fmt.sayi(toplam) + ' hareket · en yeni gün en üstte · silinenler çizili gösterilir';
    },
    ikon: '#ic-doc',
    /* Sol menüde görünmez (kullanıcı isteği, 24.08.2026); ekrana doğrudan
       adresle (#/tum-hareketler) ya da bağlantılarla gidilir. */
    grup: null,
    /* Silinen kayıtları ve "kim sildi" bilgisini gösterir; Değişiklik Geçmişi
       gibi yönetici ekranıdır (DUZELTME-PLANI M11, kullanıcı onayı 24.08.2026).
       Yetki kapısı 10-kabuk yönlendiricisinde (Test 7 mekanizması). */
    rol: 'Yonetici',
    ciz: ciz
  });
})();

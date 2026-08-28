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

  /* Eski değer güncelinden farklıysa döner, değilse null. */
  function eskiDegerVarsa(depo, kayitId, alanAdi, deger) {
    var eski = ilkEskiDeger(depo, kayitId, alanAdi);
    if (eski === null || eski === undefined || eski === '') return null;
    if (eski === YU.fmt.kg(Number(deger) || 0)) return null;
    return eski;
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
    if (!par.length) return YU.ui.rozet('Sıfırlandı', 'notr');
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

  function hareketVeSilindi(rozetIcerigi) {
    return YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
      rozetIcerigi, YU.ui.rozet('Silindi', 'olumsuz'));
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
    function ekle(an, satir) {
      zamanli.push({ an: String(an || ''), sira: zamanli.length, satir: satir });
    }
    /* Rozet GERÇEK hareket sayısını söyler, satır sayısını değil: silo
       satırları birleştiği için ikisi artık aynı sayı değil. */
    var hareketSayisi = g.silo.length + g.malzeme.length +
      (g.devir || []).length + (g.silinen || []).length;

    var siloGruplari = siloSatirlariniTopla(g.silo);
    for (i = 0; i < siloGruplari.length; i++) {
      h = siloGruplari[i];
      ekle(h.an, [
        YU.h('span', { sinif: 'yu-guclu', metin: siloAdi(depo, h.siloId) }),
        siloHareketRozeti(h.tipler),
        miktarHucresi(h.giren, false, 'giren'),
        miktarHucresi(h.cikan, false, 'cikan'),
        kaydedenHucresi(depo, h.kullaniciId, h.an, tarih)
      ]);
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

      /* DÖKME KURU KÜSPE TEK SATIRDA (kullanıcı isteği, 28.08.2026:
         "Dökme Kuru Küspe'yi de aynı satıra al, Silo 1 gibi; üretim ve
         satışı aynı satırda yaz"). Bu malzemenin üretimi de satışı da TEK
         ekrandan (Kuru Küspe Günlük Giriş) gelir ve silo satırının malzeme
         karşılığıdır — silo satırı "Dökme Üretim + Dökme Satış" diye tek
         satırda okunurken bunun iki satıra bölünmesi aynı kaydı iki kez
         gösteriyordu. 27.08'deki "her kalem kendi satırında" kararı ÖBÜR
         malzemelerde aynen sürer (KURAL 5.1). İade ayrı satırda kalır:
         üretimle aynı Giren kolonunu paylaşamaz. */
      var mlzTanim = null;
      for (var mt = 0; mt < depo.malzemeler.length; mt++) {
        if (depo.malzemeler[mt].Id === h.MalzemeId) { mlzTanim = depo.malzemeler[mt]; break; }
      }
      if (tekGunGorumu() && mlzTanim && mlzTanim.OzelTip === 'DokmeKuruKuspe' && (u > 0 || s > 0)) {
        var dkRozet = YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } });
        if (u > 0) dkRozet.appendChild(YU.ui.rozet('Üretim', 'olumlu'));
        if (s > 0) dkRozet.appendChild(YU.ui.rozet('Satış', 'olumsuz'));
        if (guncellendi) dkRozet.appendChild(YU.ui.rozet('Değiştirildi', 'bekleyen'));
        ekle(hareketAni, [
          YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
          dkRozet,
          u > 0 ? eskisiyleHucre(depo, h.Id, 'Üretim', u, 'giren', guncellendi) : bosHucre(),
          s > 0 ? eskisiyleHucre(depo, h.Id, 'Satış', s, 'cikan', guncellendi) : bosHucre(),
          kaydedenH
        ]);
        /* İade varsa kendi satırında — Giren kolonu üretimde dolu. */
        if (iadeH > 0) {
          ekle(hareketAni, [
            YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
            YU.ui.rozet('İade', 'notr'),
            eskisiyleHucre(depo, h.Id, 'İade', iadeH, 'giren', guncellendi),
            bosHucre(),
            kaydedenH.cloneNode(true)
          ]);
        }
        continue;
      }

      if (tekGunGorumu()) {
        /* TEK GÜN görünümünde HER KALEM KENDİ SATIRINDA (kullanıcı isteği,
           27.08.2026: "iade ile sadece Değiştirildi yan yana olmalı,
           değerleriyle; iade + satış olmamalı"). Bir malzemenin üretimi,
           iadesi ve satışı tek hücrede üç rozet olarak yığılıyordu; artık
           satır başına tek kalem, tek rozet ve o kalemin kendi rakamı düşer.
           "Değiştirildi" rozeti kaydın tamamına aittir, her satırda durur.
           Tüm Hareketler listesi DEĞİŞMEZ — orada satır çok, yer dar
           (KURAL 5.1). */
        var kalemler = [];
        /* Kalem, RAKAMI VARSA ya da sonradan SIFIRLANMIŞSA satır açar:
           50 kg satış silinip 0'a çekildiyse satır yine görünür ve eski
           değer üstü çizili okunur — yoksa değişiklik büsbütün kaybolurdu. */
        function kalemEkle(ad, tur, alanAdi, deger, yon) {
          if (!(deger > 0) && !(guncellendi && eskiDegerVarsa(depo, h.Id, alanAdi, deger))) return;
          kalemler.push({ ad: ad, tur: tur, alan: alanAdi, deger: deger, yon: yon });
        }
        kalemEkle('Üretim', 'olumlu', 'Üretim', u, 'giren');
        kalemEkle('İade', 'notr', 'İade', iadeH, 'giren');
        kalemEkle('Satış', 'olumsuz', 'Satış', s, 'cikan');
        if (!kalemler.length) kalemler.push({ ad: 'Sıfırlandı', tur: 'notr', alan: null, deger: 0, yon: null });

        for (var kk = 0; kk < kalemler.length; kk++) {
          (function (kalem) {
            var rozetKap = guncellendi
              ? YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
                  YU.ui.rozet(kalem.ad, kalem.tur), YU.ui.rozet('Değiştirildi', 'bekleyen'))
              : YU.ui.rozet(kalem.ad, kalem.tur);
            var hucre = kalem.alan
              ? eskisiyleHucre(depo, h.Id, kalem.alan, kalem.deger, kalem.yon, guncellendi)
              : bosHucre();
            ekle(hareketAni, [
              YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
              rozetKap,
              kalem.yon === 'giren' ? hucre : bosHucre(),
              kalem.yon === 'cikan' ? hucre : bosHucre(),
              kaydedenH.cloneNode(true)
            ]);
          })(kalemler[kk]);
        }
        continue;
      }

      ekle(hareketAni, [
        YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
        guncellendi
          ? YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
              malzemeHareketRozeti(u, s, iadeH), YU.ui.rozet('Değiştirildi', 'bekleyen'))
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
        var adKutu = YU.h('div', null,
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
        ekle(l.Tarih, [
          adKutu,
          YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
            YU.ui.rozet(rozetAdi, tur), degisim),
          bosHucre(),
          bosHucre(),
          kaydedenHucresi(depo, l.KullaniciId, l.Tarih, tarih)
        ]);
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
        ]);
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
        ]);
      }
    }

    /* Eskiden yeniye: damga eşitse toplanma (bölüm) sırası korunur. */
    zamanli.sort(function (a, b) {
      if (a.an !== b.an) return a.an < b.an ? -1 : 1;
      return a.sira - b.sira;
    });
    for (i = 0; i < zamanli.length; i++) satirlar.push(zamanli[i].satir);

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
        sutunlar: [
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
    if (tabloEl) tabloEl.style.minWidth = '1350px';   /* 380+360+140+170+300 */
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
        var v = gunler(depo), i, j, t, g, h, u, s, sk, k;
        var satirlar = [['Tarih', 'Tür', 'Silo / Malzeme', 'Hareket', 'Giren (kg)', 'Çıkan (kg)', 'Durum']];
        for (i = 0; i < v.tarihler.length; i++) {
          t = v.tarihler[i];
          g = v.harita[t];
          for (j = 0; j < g.silo.length; j++) {
            h = g.silo[j];
            satirlar.push([YU.fmt.tarih(t), 'Silo', siloAdi(depo, h.SiloId),
              TIP_ADI[h.HareketTipi] || h.HareketTipi,
              YU.csvSayi(h.GirenKg), YU.csvSayi(h.CikanKg), '']);
          }
          for (j = 0; j < g.malzeme.length; j++) {
            h = g.malzeme[j];
            u = Number(h.Uretim) || 0;
            s = Number(h.Satis) || 0;
            satirlar.push([YU.fmt.tarih(t), 'Malzeme', malzemeAdi(depo, h.MalzemeId),
              u > 0 && s > 0 ? 'Üretim + Satış' : (u > 0 ? 'Üretim' : 'Satış'),
              YU.csvSayi(u), YU.csvSayi(s),
              h.GuncellemeTarihi ? 'Değiştirildi' : '']);
          }
          for (j = 0; j < g.silinen.length; j++) {
            sk = g.silinen[j];
            k = sk.Kayit;
            if (sk.Tablo === 'SiloHareket') {
              satirlar.push([YU.fmt.tarih(t), 'Silo', siloAdi(depo, k.SiloId),
                TIP_ADI[k.HareketTipi] || k.HareketTipi,
                YU.csvSayi(k.GirenKg), YU.csvSayi(k.CikanKg), 'Silindi']);
            } else {
              satirlar.push([YU.fmt.tarih(t), 'Malzeme', malzemeAdi(depo, k.MalzemeId), '',
                YU.csvSayi(k.Uretim), YU.csvSayi(k.Satis), 'Silindi']);
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

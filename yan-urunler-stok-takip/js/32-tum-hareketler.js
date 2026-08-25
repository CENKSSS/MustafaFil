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

  function miktarHucresi(deger, silinmis) {
    var n = Number(deger) || 0;
    if (n <= 0) return bosHucre();
    return silinmis ? cizili(YU.fmt.kg(n)) : YU.h('span', { metin: YU.fmt.kg(n) });
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

  function miktarVeEskisi(depo, deger, kayitId, alan) {
    var simdiki = miktarHucresi(deger, false);
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

  function kaydedenHucresi(depo, kullaniciId, damga, ek) {
    var ad = kullaniciAdi(depo, kullaniciId);
    var saat = damga ? YU.fmt.saat(damga) : null;
    if (!ad && !saat) return bosHucre();
    return YU.h('span', {
      sinif: 'yu-zayif',
      metin: (ad || '—') + (saat && saat !== '—' ? ' · ' + saat : '') + (ek ? ' ' + ek : '')
    });
  }

  /* Malzeme satırının hareket rozeti: üretim/iade/satış hangileri varsa
     birlikte okunur (M25 — iade rozeti yoktu; yalnız iadeli satır yanlışça
     "Sıfırlandı" görünüyordu). */
  function malzemeHareketRozeti(uretim, satis, iade) {
    var par = [];
    if (uretim > 0) par.push('Üretim');
    if (iade > 0) par.push('İade');
    if (satis > 0) par.push('Satış');
    if (!par.length) return YU.ui.rozet('Sıfırlandı', 'notr');
    if (par.length > 1) return YU.ui.rozet(par.join(' + '), 'vurgu');
    return YU.ui.rozet(par[0], uretim > 0 ? 'olumlu' : (iade > 0 ? 'notr' : 'bekleyen'));
  }

  /* Giren hücresi (M25): iade stoğu artırdığı için Giren kolonuna düşer.
     Üretimle birlikteyse üretim üstte, altında küçük "İade X" satırı;
     güncellenmişse iadenin ilk eski değeri çizili okunur. */
  function iadeSatiri(depo, h, guncellendi) {
    var iade = Number(h.Iade) || 0;
    if (iade <= 0) return null;
    var eski = guncellendi ? ilkEskiDeger(depo, h.Id, 'İade') : null;
    var kap = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }
    }, YU.h('span', {
      sinif: 'yu-zayif',
      stil: { font: '400 11px/1.3 var(--sayi)', whiteSpace: 'nowrap' },
      metin: 'İade ' + YU.fmt.kg(iade)
    }));
    if (eski !== null && eski !== undefined && eski !== '' && eski !== YU.fmt.kg(iade)) {
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
    var iade = iadeSatiri(depo, h, guncellendi);
    var ust = guncellendi ? miktarVeEskisi(depo, u, h.Id, 'Üretim') : miktarHucresi(u, false);
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
  function gunPaneli(depo, tarih, g, sayacGizle) {
    var satirlar = [], i, h, u, s;

    for (i = 0; i < g.silo.length; i++) {
      h = g.silo[i];
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: siloAdi(depo, h.SiloId) }),
        YU.ui.rozet(TIP_ADI[h.HareketTipi] || h.HareketTipi, h.HareketTipi === 'DokmeUretim' ? 'olumlu' : 'bekleyen'),
        miktarHucresi(h.GirenKg, false),
        miktarHucresi(h.CikanKg, false),
        kaydedenHucresi(depo, h.OlusturanKullaniciId, h.OlusturmaTarihi, null)
      ]);
    }

    for (i = 0; i < g.malzeme.length; i++) {
      h = g.malzeme[i];
      u = Number(h.Uretim) || 0;
      s = Number(h.Satis) || 0;
      var guncellendi = !!h.GuncellemeTarihi;
      var iadeH = Number(h.Iade) || 0;   /* M25 */
      satirlar.push([
        YU.h('span', { sinif: 'yu-guclu', metin: malzemeAdi(depo, h.MalzemeId) }),
        guncellendi
          ? YU.h('span', { stil: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
              malzemeHareketRozeti(u, s, iadeH), YU.ui.rozet('Değiştirildi', 'bekleyen'))
          : malzemeHareketRozeti(u, s, iadeH),
        girenHucresi(depo, h, guncellendi),
        guncellendi ? miktarVeEskisi(depo, s, h.Id, 'Satış') : miktarHucresi(s, false),
        guncellendi
          ? kaydedenHucresi(depo, h.GuncelleyenKullaniciId, h.GuncellemeTarihi, 'değiştirdi')
          : kaydedenHucresi(depo, h.OlusturanKullaniciId, h.OlusturmaTarihi, null)
      ]);
    }

    /* Devir değişiklikleri: gün hareketlerinden sonra, yapılış sırasıyla.
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
          degisim = YU.h('span', { sinif: 'yu-zayif', metin: String(l.YeniDeger || l.EskiDeger || '') });
        }
        satirlar.push([
          adKutu,
          YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
            YU.ui.rozet(rozetAdi, tur), degisim),
          bosHucre(),
          bosHucre(),
          kaydedenHucresi(depo, l.KullaniciId, l.Tarih,
            l.Islem === 'Ekle' ? 'girdi' : (l.Islem === 'Sil' ? 'sildi' : 'değiştirdi'))
        ]);
      })(g.devir[i]);
    }

    /* Silinenler günün sonunda, silinme sırasıyla. */
    g.silinen.sort(function (a, b) { return String(a.SilmeTarihi).localeCompare(String(b.SilmeTarihi)); });
    for (i = 0; i < g.silinen.length; i++) {
      var sk = g.silinen[i], k = sk.Kayit;
      if (sk.Tablo === 'SiloHareket') {
        satirlar.push([
          cizili(siloAdi(depo, k.SiloId)),
          hareketVeSilindi(cizili(TIP_ADI[k.HareketTipi] || k.HareketTipi)),
          miktarHucresi(k.GirenKg, true),
          miktarHucresi(k.CikanKg, true),
          kaydedenHucresi(depo, sk.KullaniciId, sk.SilmeTarihi, 'sildi')
        ]);
      } else {
        u = Number(k.Uretim) || 0;
        s = Number(k.Satis) || 0;
        var iadeS = Number(k.Iade) || 0;   /* M25: silinen satırda da iade okunur */
        var parS = [];
        if (u > 0) parS.push('Üretim');
        if (iadeS > 0) parS.push('İade');
        if (s > 0) parS.push('Satış');
        satirlar.push([
          cizili(malzemeAdi(depo, k.MalzemeId)),
          hareketVeSilindi(cizili(parS.length ? parS.join(' + ') : 'Sıfırlandı')),
          iadeS > 0 && u <= 0
            ? cizili('İade ' + YU.fmt.kg(iadeS))
            : (iadeS > 0
                ? YU.h('div', { stil: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' } },
                    miktarHucresi(u, true), cizili('İade ' + YU.fmt.kg(iadeS)))
                : miktarHucresi(u, true)),
          miktarHucresi(s, true),
          kaydedenHucresi(depo, sk.KullaniciId, sk.SilmeTarihi, 'sildi')
        ]);
      }
    }

    return YU.ui.panel({
      baslik: YU.fmt.tarih(tarih) + ' · ' + YU.fmt.gunAdi(tarih),
      ikon: '#ic-calendar',
      sag: sayacGizle ? null : YU.ui.rozet(YU.fmt.sayi(satirlar.length) + ' hareket', 'notr'),
      dolgusuz: true,
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Silo / Malzeme' },
          { baslik: 'Hareket' },
          { baslik: 'Giren', hiza: 'sag', mono: true, genislik: 120 },
          { baslik: 'Çıkan', hiza: 'sag', mono: true, genislik: 120 },
          { baslik: 'Kaydeden', hiza: 'sag', genislik: 250 }
        ],
        satirlar: satirlar,
        kompakt: true,
        bos: 'Bu güne ait hareket yok.'
      })
    });
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
    return gunPaneli(depo, tarih, g, true);   /* tek gün: sayaç rozeti yok */
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

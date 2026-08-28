/* js/34-aylik-ozet.js — Aylık Özet (DUZELTME-PLANI M20; Şartname §11
   "Aylık özet ekranı — ay bazında toplam üretim/satış, gün gün grafik").

   Düzen, klasik raporlama programlarındaki aylık stok özeti yapısını izler
   (kullanıcı isteği, 25.08.2026): malzeme tablosu Ay Başı Stok → Üretim →
   İade → Satış → Değişim → Ay Sonu Stok sütunlarıyla kurulur; altında gün ×
   malzeme döküm tablosu (sekmeli: Üretim / İade / Satış) ve gün gün grafik
   durur. Ay başı / ay sonu stoklar YU.stok.malzemeStok ile tarihe göre
   hesaplanır — dökme kuru küspede bu değer siloların toplamıdır (Şartname §5).

   Veri doğrudan GunlukHareket toplamıdır: dökme kuru küspe satırı zaten NET
   üretimi taşır (Şartname §4), bu yüzden ay toplamında çift sayım olmaz.
   İade ayrı kolonda gösterilir (stokta üretim gibi artar, ayrı sayılır —
   kullanıcı direktifi 24.08.2026). İkon mevcut onaylı setten (#ic-calendar-dots);
   yeni ikon çizilmez (SOZLESME §12). */
(function () {
  'use strict';

  var YU = window.YU;
  var KOD = 'aylik-ozet';

  function ayAnahtari(iso) { return String(iso || '').slice(0, 7); }   // "2026-08"

  function ayAdi(anahtar) {
    var y = parseInt(anahtar.slice(0, 4), 10);
    var a = parseInt(anahtar.slice(5, 7), 10);
    var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    if (!isFinite(y) || !isFinite(a) || a < 1 || a > 12) return anahtar;
    return AYLAR[a - 1] + ' ' + y;
  }

  function oncekiAy(anahtar) {
    var y = parseInt(anahtar.slice(0, 4), 10);
    var a = parseInt(anahtar.slice(5, 7), 10) - 1;
    if (a < 1) { a = 12; y--; }
    return y + '-' + (a < 10 ? '0' + a : String(a));
  }

  /* Kayıtlı aylar — GunlukHareket tarihlerinden, yeniden eskiye. */
  function kayitliAylar(depo) {
    var kume = {}, liste = [], i, k;
    for (i = 0; i < depo.gunlukHareket.length; i++) {
      k = ayAnahtari(depo.gunlukHareket[i].Tarih);
      if (k.length === 7) kume[k] = true;
    }
    for (k in kume) if (Object.prototype.hasOwnProperty.call(kume, k)) liste.push(k);
    liste.sort();
    liste.reverse();
    return liste;
  }

  /* Ayın kaçıncı günü — "2026-08-25" -> 25. */
  function gunNo(iso) { return parseInt(String(iso).slice(8, 10), 10) || 0; }

  /* Bir ayın N. günü; ay o kadar uzun değilse ayın son günü.
     (31 Mart'ın Şubat karşılığı 28/29 Şubat'tır.) */
  function ayinGunu(ayKodu, n) {
    var son = gunNo(YU.tarih.aySonu(ayKodu + '-01'));
    var g = Math.min(n, son);
    return ayKodu + '-' + (g < 10 ? '0' + g : String(g));
  }

  /* Ay verisi: malzeme toplamları, gün toplamları ve gün × malzeme dökümü.
     sinirGun verilirse ayın yalnız ilk N günü sayılır — içinde bulunulan ay
     yarım olduğu için geçen ayın TAMAMIYLA kıyaslanması yanlış olurdu
     (kullanıcı direktifi, 25.08.2026: "eylülün 10'undaysak ağustosun 10'u
     ile karşılaştırılsın"). */
  function ayVerisi(depo, ay, sinirGun) {
    var malzemeler = {}, gunler = {}, gunMalzeme = {}, gunSayisi = 0, i, h, mid, g;
    var toplam = { uretim: 0, iade: 0, satis: 0 };

    for (i = 0; i < depo.gunlukHareket.length; i++) {
      h = depo.gunlukHareket[i];
      if (ayAnahtari(h.Tarih) !== ay) continue;
      if (sinirGun && gunNo(h.Tarih) > sinirGun) continue;
      mid = h.MalzemeId;
      var m = malzemeler[mid] || (malzemeler[mid] = { uretim: 0, iade: 0, satis: 0 });
      var u = Number(h.Uretim) || 0, iade = Number(h.Iade) || 0, s = Number(h.Satis) || 0;
      m.uretim = YU.yuvarla(m.uretim + u);
      m.iade = YU.yuvarla(m.iade + iade);
      m.satis = YU.yuvarla(m.satis + s);
      toplam.uretim = YU.yuvarla(toplam.uretim + u);
      toplam.iade = YU.yuvarla(toplam.iade + iade);
      toplam.satis = YU.yuvarla(toplam.satis + s);

      g = gunler[h.Tarih] || (gunler[h.Tarih] = { uretim: 0, satis: 0, iade: 0 });
      /* Gün toplamına İADE KATILMAZ (kullanıcı kararı, 25.08.2026): grafik
         üretimi gösterir, iade ayrı bir kalemdir ve g.iade'de durur. */
      g.uretim = YU.yuvarla(g.uretim + u);
      g.satis = YU.yuvarla(g.satis + s);
      g.iade = YU.yuvarla(g.iade + iade);

      var gm = gunMalzeme[h.Tarih] || (gunMalzeme[h.Tarih] = {});
      gm[mid] = { uretim: YU.yuvarla(u), iade: YU.yuvarla(iade), satis: YU.yuvarla(s) };
    }
    for (g in gunler) if (Object.prototype.hasOwnProperty.call(gunler, g)) gunSayisi++;
    return { malzemeler: malzemeler, gunler: gunler, gunMalzeme: gunMalzeme,
             gunSayisi: gunSayisi, toplam: toplam };
  }

  function siraliMalzemeler(depo) {
    return depo.malzemeler.slice().sort(function (a, b) {
      return (Number(a.Sira) || 0) - (Number(b.Sira) || 0) || (a.Id - b.Id);
    });
  }

  /* Kayıtlı günlerin ilkinden sonuncusuna kadar TÜM takvim günleri —
     aradaki kayıtsız günler boş satır olarak görünür (giriş boşluğu belli
     olsun); kampanya öncesi/sonrası boş günler listelenmez. */
  function gunAraligi(gunler) {
    var liste = [], g;
    for (g in gunler) if (Object.prototype.hasOwnProperty.call(gunler, g)) liste.push(g);
    liste.sort();
    if (!liste.length) return [];
    var tum = [], t = liste[0], son = liste[liste.length - 1];
    while (t <= son) { tum.push(t); t = YU.tarih.ekle(t, 1); }
    return tum;
  }

  function tire() { return YU.h('span', { sinif: 'yu-zayif', metin: '—' }); }
  /* Rakamın yanında BİRİM yazar (kullanıcı isteği, 26.08.2026): sayı
     normal, "kg" küçük ve soluk — Stok Durumu ile aynı ölçü dili
     (YU.ui.olcu). Hazır sayı metni verilirse (işaretli fark gibi)
     olduğu gibi kullanılır. */
  function kgOlcu(metinYaDaSayi) {
    var m = typeof metinYaDaSayi === 'string' ? metinYaDaSayi : YU.fmt.kg(metinYaDaSayi);
    return YU.ui.olcu([{ sayi: m, birim: 'kg' }], 'sag');
  }
  function kgYaTire(n) { return n ? kgOlcu(n) : tire(); }

  /* Kuru küspe ay toplamı (Şartname §4). Hesap GÜNLÜK yapılıp toplanır:
     netDokmeUretim ve silodanCekilecek max(0,…) içerdiği için aylık brütten
     aylık çuvalı çıkarmak YANLIŞ olurdu — Durum B günleri (çuvallama >
     üretim) o gün silodan çekilir, ertesi günün üretimiyle mahsuplaşmaz. */
  function kuruKuspeAyi(depo, ay, sinirGun) {
    var t = {
      uretilenDokme: 0, cuvalAdet: 0, cuvalKg: 0, netDokmeUretim: 0,
      silodanCekilen: 0, satilanDokme: 0, siloNetDegisim: 0, durumB: 0, gun: 0
    }, i, k, h;
    for (i = 0; i < depo.kuruKuspeGunluk.length; i++) {
      k = depo.kuruKuspeGunluk[i];
      if (ayAnahtari(k.Tarih) !== ay) continue;
      if (sinirGun && gunNo(k.Tarih) > sinirGun) continue;
      h = YU.hesap.kuruKuspe(k.UretilenDokme, k.CuvalAdet, k.SatilanDokme);
      t.uretilenDokme = YU.yuvarla(t.uretilenDokme + (Number(k.UretilenDokme) || 0));
      t.cuvalAdet += Number(k.CuvalAdet) || 0;
      t.cuvalKg = YU.yuvarla(t.cuvalKg + h.cuvalKg);
      t.netDokmeUretim = YU.yuvarla(t.netDokmeUretim + h.netDokmeUretim);
      t.silodanCekilen = YU.yuvarla(t.silodanCekilen + h.silodanCekilecek);
      t.satilanDokme = YU.yuvarla(t.satilanDokme + h.satilanDokme);
      t.siloNetDegisim = YU.yuvarla(t.siloNetDegisim + h.siloNetDegisim);
      if (h.durum === 'B') t.durumB++;
      t.gun++;
    }
    return t;
  }

  /* ------------------------------------------------------------------
     Ürün grupları (kullanıcı isteği, 25.08.2026): ay karşılaştırması tek
     "toplam üretim" satırı yerine KURU KÜSPE / YAŞ KÜSPE / DİĞER olarak
     bölünür; üretim, satış, iade ve stok değişimi ayrı ayrı bu üç grup için
     verilir. Grup, malzeme ADINDAN bulunur — malzeme yönetiminden yeni bir
     çeşit eklenirse kendi grubuna düşer, burası elle güncellenmez.
     ------------------------------------------------------------------ */

  var GRUP_ADLARI = { kuru: 'Kuru Küspe', yas: 'Yaş Küspe', diger: 'Diğer Ürünler' };

  function malzemeGrubu(ad) {
    /* Sıra önemli: "Dökme Yaş Küspe" de yaş küspedir. "Atık Kuru Küspe"
       kuru küspe ailesine girmez — üretim sürecinin atığıdır, Diğer'e düşer. */
    if (/ya[şs]\s*k[üu]spe/i.test(ad)) return 'yas';
    if (/at[ıi]k/i.test(ad)) return 'diger';
    if (/kuru\s*k[üu]spe/i.test(ad)) return 'kuru';
    return 'diger';
  }

  /* Bir ayın grup bazlı özeti. basTarih/sonTarih stok uçlarıdır.
     KURU KÜSPE ÜRETİMİ özeldir: GunlukHareket'teki dökme satırı NET üretimi
     taşır (Şartname §4), oysa istenen HAM üretimdir — o yüzden kuru küspe
     üretimi KuruKuspeGunluk.UretilenDokme toplamından (brüt) alınır ve
     çuvallı satırın üretimi (çuvallama) toplama İKİNCİ KEZ eklenmez. */
  function grupOzeti(depo, ayVeri, kkAyi, basTarih, sonTarih) {
    var g = {
      kuru: { uretim: 0, satis: 0, iade: 0, bas: 0, son: 0 },
      yas: { uretim: 0, satis: 0, iade: 0, bas: 0, son: 0 },
      diger: { uretim: 0, satis: 0, iade: 0, bas: 0, son: 0 }
    };
    var i, m, mv, k;
    for (i = 0; i < depo.malzemeler.length; i++) {
      m = depo.malzemeler[i];
      k = g[malzemeGrubu(m.Ad)];
      mv = ayVeri.malzemeler[m.Id];
      if (mv) {
        if (malzemeGrubu(m.Ad) !== 'kuru') k.uretim = YU.yuvarla(k.uretim + mv.uretim);
        k.satis = YU.yuvarla(k.satis + mv.satis);
        k.iade = YU.yuvarla(k.iade + mv.iade);
      }
      k.bas = YU.yuvarla(k.bas + YU.stok.malzemeStok(depo, m.Id, basTarih).mevcut);
      k.son = YU.yuvarla(k.son + YU.stok.malzemeStok(depo, m.Id, sonTarih).mevcut);
    }
    g.kuru.uretim = kkAyi.uretilenDokme;
    return g;
  }

  /* İşaretli fark hücresi: +yeşil, −kırmızı, 0 gri. Ay içinde kampanya
     devri varsa yıldızla işaretlenir — fark devir etkisini de içerir,
     yalnız üretim/satıştan gelmez (KURAL 4.4: yanıltıcı okuma engellenir). */
  function farkHucre(n, devirIcinde) {
    if (!n && !devirIcinde) return tire();
    var deger = kgOlcu(n ? (n > 0 ? '+' : '−') + YU.fmt.kg(Math.abs(n)) : YU.fmt.kg(0));
    deger.style.color = n > 0 ? 'var(--olumlu)' : (n < 0 ? 'var(--olumsuz)' : '');
    if (!devirIcinde) return deger;
    /* Devir etkisi yıldız + dipnot yerine hücrenin alt satırında yazar
       (KURAL 8, 25.08.2026). */
    var kutu = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }
    },
      deger,
      YU.h('span', {
        stil: { font: '400 11px/1 var(--font)', color: 'var(--bekleyen)' },
        metin: 'devir dahil'
      })
    );
    kutu.title = 'Ay içinde kampanya devri yapıldı; değişim devir etkisini de içerir.';
    return kutu;
  }

  /* Tablo altı dipnotları KALDIRILDI (KURAL 8, 25.08.2026): "* işaretli
     satırlarda devir var" açıklaması yerine, devirli satırın kendi hücresinde
     "devir dahil" yazar (farkHucre) — bilgi okunduğu yerde durur. */

  function ciz(kap, param) {
    var depo = YU.db;
    if (!depo) return;

    var aylar = kayitliAylar(depo);
    if (!aylar.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-calendar-dots',
        baslik: 'Henüz Kayıtlı Ay Yok',
        metin: 'Günlük girişler kaydedildikçe aylık toplamlar burada görünür.'
      }));
      return;
    }

    var ay = param && param.ay && /^\d{4}-\d{2}$/.test(param.ay) ? param.ay : aylar[0];
    var bugun = YU.tarih.bugun();
    var buAyMi = ay === ayAnahtari(bugun);
    var ayBasi = ay + '-01';
    var ayOncesiGun = YU.tarih.ekle(ayBasi, -1);            // ay başı stok = önceki günün gün sonu
    var kapanisTarih = buAyMi ? bugun : YU.tarih.aySonu(ayBasi);
    var kapanisBaslik = buAyMi ? 'Bugünkü Stok' : 'Ay Sonu Stok';

    /* Ay seçimi — PROJE STANDARDI (kullanıcı isteği, 25.08.2026):
       diğer ekranlardaki "tarih kutusu + Önceki Gün / Bugün / Sonraki Gün"
       düzeninin ay karşılığı. Kutu yerine açılır çip kullanılır çünkü
       seçilebilecek aylar SINIRLIDIR (yalnız kayıtlı aylar); çipin içindeki
       liste KAYDIRILIR — yıllar biriktikçe uzayacağı için pencere sabit
       yükseklikte kalır ve kaydırma çubuğu görünür durur.
       Gezinme düğmeleri kayıtlı aylar arasında yürür: aylar dizisi yeniden
       eskiye sıralı olduğu için "Önceki Ay" bir SONRAKİ öğedir. */
    var i;

    /* Ay başına kayıtlı gün sayısı — tek geçişte; satırda "12 gün" yazar. */
    var ayGunSayisi = (function () {
      var sayac = {}, gorulen = {}, j, h, k;
      for (j = 0; j < depo.gunlukHareket.length; j++) {
        h = depo.gunlukHareket[j];
        if (gorulen[h.Tarih]) continue;
        gorulen[h.Tarih] = 1;
        k = ayAnahtari(h.Tarih);
        sayac[k] = (sayac[k] || 0) + 1;
      }
      return sayac;
    })();

    var ayYeri = aylar.indexOf(ay);
    var buAyKodu = ayAnahtari(YU.tarih.bugun());
    var buAyVar = aylar.indexOf(buAyKodu) >= 0;

    /* WINDOWS TARZI 12 AYLIK IZGARA (kullanıcı isteği, 26.08.2026).
       Eskiden dikey bir liste vardı ve yalnız KAYITLI ayları gösteriyordu;
       kaç ay olduğu belli olmuyor, yıl atlamak için kaydırmak gerekiyordu.
       Artık klasik takvim düzeni: üstte '‹ 2026 ›' yıl gezinmesi, altında
       4x3 ızgarada OCK ŞBT MRT … ARA. Karede RAKAM YOK (kullanıcı isteği,
       26.08.2026): kaydı olmayan ay soluk ve tıklanamaz durur, hangi ayda
       veri var zaten oradan görünür. Kaç gün kayıt olduğu ipucunda yazar —
       ekranda yer kaplamaz, isteyen görür (KURAL 8). */
    var AY_KISA = ['OCK', 'ŞBT', 'MRT', 'NİS', 'MAY', 'HAZ',
                   'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];

    /* Kayıtlı yılların sınırları: yıl okları bunların dışına çıkmaz. */
    var yillar = (function () {
      var s = {}, j;
      for (j = 0; j < aylar.length; j++) s[aylar[j].slice(0, 4)] = 1;
      return Object.keys(s).sort();
    })();
    var ilkYil = yillar.length ? parseInt(yillar[0], 10) : parseInt(ay.slice(0, 4), 10);
    var sonYil = yillar.length ? parseInt(yillar[yillar.length - 1], 10) : ilkYil;

    var ayCipi = YU.ui.acilirCip({
      ikon: '#ic-calendar', metin: ayAdi(ay), genislik: 268, enGenis: 268,
      baslik: 'Ay seç', dolgu: '9px 9px 10px',
      govde: function (kapat) {
        var kap = YU.h('div', { stil: { minWidth: '236px' } });
        var gosterilenYil = parseInt(ay.slice(0, 4), 10);
        var izgara = YU.h('div', { sinif: 'yu-ay-izgara' });
        var yilYazi = YU.h('span', { sinif: 'yu-ay-yil-baslik' });

        function yilOku(yon, etiket) {
          return YU.h('button', {
            tip: 'button', sinif: 'yu-ay-yil-ok', 'aria-label': etiket, title: etiket,
            onClick: function () { gosterilenYil += yon; ciz(); }
          }, YU.h('span', {
            stil: { display: 'flex', transform: yon < 0 ? 'rotate(180deg)' : 'none' }
          }, YU.svg('#ic-chevron', 14)));
        }
        var geriOk = yilOku(-1, 'Önceki yıl');
        var ileriOk = yilOku(1, 'Sonraki yıl');

        function ciz() {
          yilYazi.textContent = String(gosterilenYil);
          geriOk.disabled = gosterilenYil <= ilkYil;
          ileriOk.disabled = gosterilenYil >= sonYil;
          YU.bos(izgara);
          for (var j = 0; j < 12; j++) {
            (function (no) {
              var kod = gosterilenYil + '-' + (no < 9 ? '0' : '') + (no + 1);
              var kayitli = aylar.indexOf(kod) >= 0;
              var secili = kod === ay;
              var gun = ayGunSayisi[kod] || 0;
              var d = YU.h('button', {
                tip: 'button',
                sinif: 'yu-ay-kare' + (secili ? ' secili' : '') + (kayitli ? '' : ' bos'),
                'aria-pressed': secili ? 'true' : 'false',
                title: kayitli ? ayAdi(kod) + ' · ' + YU.fmt.sayi(gun) + ' gün kayıt'
                               : ayAdi(kod) + ' · kayıt yok',
                onClick: function () { kapat(); YU.git(KOD, { ay: kod }); }
              },
                YU.h('span', { metin: AY_KISA[no] })
              );
              if (!kayitli) d.disabled = true;
              izgara.appendChild(d);
            })(j);
          }
        }

        kap.appendChild(YU.h('div', { sinif: 'yu-ay-yil-satiri' }, geriOk, yilYazi, ileriOk));
        kap.appendChild(izgara);
        kap.appendChild(YU.h('div', {
          sinif: 'yu-yardim',
          stil: { margin: '0', padding: '9px 2px 0', borderTop: '1px solid var(--ayrac)' },
          metin: YU.fmt.sayi(aylar.length) + ' kayıtlı ay'
        }));
        ciz();
        return kap;
      }
    });

    /* Çip SABİT GENİŞLİKTE (kullanıcı isteği, 25.08.2026): "Ocak 2026" ile
       "Ağustos 2026" farklı uzunlukta olduğu için çip her ayda genişleyip
       daralıyor, yanındaki gezinme düğmeleri sağa sola kayıyordu. En uzun ay
       adına göre sabitlenir; düğmeler artık yerinde durur. */
    ayCipi.style.width = '196px';
    ayCipi.style.flex = 'none';

    /* Önceki Ay · Bu Ay · Sonraki Ay — diğer ekranlardaki gün gezinmesinin
       aynısı; uçlarda düğme pasifleşir ve sebebini ipucunda söyler. */
    /* Ay seçici KÂĞIDA BASILMAZ (kullanıcı isteği, 27.08.2026): Önceki/Bu/
       Sonraki Ay düğmeleri .yu-dugme olduğu için baskıda zaten gizleniyordu,
       "Ağustos 2026" çipi düğme sınıfı taşımadığı için kalıyordu. Hangi ayın
       basıldığı panelin sağındaki dönem yazısında ve künyede duruyor. */
    var aySecici = YU.h('div', {
      sinif: 'yu-baski-yok',
      stil: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }
    },
      ayCipi,
      YU.ui.dugme({
        metin: 'Önceki Ay', kucuk: true, tur: 'ikincil',
        pasif: ayYeri < 0 || ayYeri >= aylar.length - 1,
        baslik: ayYeri >= aylar.length - 1 ? 'Daha eski kayıtlı ay yok' : '',
        onClick: function () { YU.git(KOD, { ay: aylar[ayYeri + 1] }); }
      }),
      YU.ui.dugme({
        metin: 'Bu Ay', ikon: '#ic-calendar', kucuk: true, tur: 'ikincil',
        pasif: !buAyVar || ay === buAyKodu,
        baslik: !buAyVar ? 'Bu aya ait kayıt yok' : '',
        onClick: function () { YU.git(KOD, { ay: buAyKodu }); }
      }),
      YU.ui.dugme({
        metin: 'Sonraki Ay', kucuk: true, tur: 'ikincil',
        pasif: ayYeri <= 0,
        baslik: ayYeri <= 0 ? 'Daha yeni kayıtlı ay yok' : '',
        onClick: function () { YU.git(KOD, { ay: aylar[ayYeri - 1] }); }
      })
    );

    var v = ayVerisi(depo, ay);
    var liste = siraliMalzemeler(depo);

    /* Malzeme özeti satır verisi — raporlama programlarındaki
       devir → giren → çıkan → kalan yapısı. */
    var ozet = [], devirliVar = false, m, sat;
    for (i = 0; i < liste.length; i++) {
      m = v.malzemeler[liste[i].Id];
      var basStok = YU.stok.malzemeStok(depo, liste[i].Id, ayOncesiGun).mevcut;
      var kapanis = YU.stok.malzemeStok(depo, liste[i].Id, kapanisTarih);
      if (!m && !basStok && !kapanis.mevcut) continue;   // ne hareketi ne stoğu var
      var devirIcinde = !!(kapanis.devirTarihi && kapanis.devirTarihi >= ayBasi);
      if (devirIcinde) devirliVar = true;
      ozet.push({
        malzeme: liste[i],
        basStok: basStok,
        uretim: m ? m.uretim : 0,
        iade: m ? m.iade : 0,
        satis: m ? m.satis : 0,
        sonStok: kapanis.mevcut,
        fark: YU.yuvarla(kapanis.mevcut - basStok),
        devirIcinde: devirIcinde
      });
    }

    /* Ay seçici sayfa eylemlerinden ÇIKARILDI; karşılaştırma panelinin
       başlığının yanına taşındı (kullanıcı isteği, 25.08.2026) — hangi ayın
       seçildiği, ayların yazdığı yerde duruyor. Seçim SAYFANIN TAMAMINI
       değiştirir, yalnız o paneli değil. */
    YU.ui.sayfaEylemleri(
      YU.ui.dugme({
        metin: 'CSV İndir', ikon: '#ic-download', tur: 'ikincil',
        baslik: 'Ay özetini Excel uyumlu CSV olarak indirir (M17)',
        onClick: function () {
          var satirlar = [['Aylık Özet', ayAdi(ay)]];
          satirlar.push([]);
          satirlar.push(['Ürün Grubu Karşılaştırması', ayAdi(ay), 'önceki ay: ' + ayAdi(oncekiAyKodu)]);
          satirlar.push(['Ürün Grubu', 'Üretim (kg)', 'Önceki Ay Üretim (kg)', 'Satış (kg)',
            'Önceki Ay Satış (kg)', 'İade (kg)', 'Stok Değişimi (kg)']);
          var gk, gb, go;
          var GRUP_KODLARI = ['kuru', 'yas', 'diger'];
          for (gk = 0; gk < GRUP_KODLARI.length; gk++) {
            gb = buGrup[GRUP_KODLARI[gk]];
            go = oncekiGrup[GRUP_KODLARI[gk]];
            satirlar.push([GRUP_ADLARI[GRUP_KODLARI[gk]],
              YU.csvSayi(gb.uretim), YU.csvSayi(go.uretim),
              YU.csvSayi(gb.satis), YU.csvSayi(go.satis),
              YU.csvSayi(gb.iade), YU.csvSayi(YU.yuvarla(gb.son - gb.bas))]);
          }
          satirlar.push([]);
          satirlar.push(['Aylık Malzeme Özeti']);
          satirlar.push(['Malzeme', 'Ay Başı Stok (kg)', 'Aylık İade (kg)',
            'Günlük Ort. Üretim (kg)', 'Günlük Ort. Satış (kg)',
            'Aylık Üretim Toplamı (kg)', 'Aylık Satış Toplamı (kg)',
            'Stok Değişimi (kg)', kapanisBaslik + ' (kg)']);
          var j, o, ortUretim, ortSatis;
          for (j = 0; j < ozet.length; j++) {
            o = ozet[j];
            ortUretim = v.gunSayisi && o.uretim ? YU.yuvarla(o.uretim / v.gunSayisi) : 0;
            ortSatis = v.gunSayisi && o.satis ? YU.yuvarla(o.satis / v.gunSayisi) : 0;
            satirlar.push([o.malzeme.Ad, YU.csvSayi(o.basStok), YU.csvSayi(o.iade),
              YU.csvSayi(ortUretim), YU.csvSayi(ortSatis),
              YU.csvSayi(o.uretim), YU.csvSayi(o.satis),
              YU.csvSayi(o.fark), YU.csvSayi(o.sonStok)]);
          }
          var t2 = v.toplam;
          satirlar.push(['AYLIK TOPLAM', '', YU.csvSayi(t2.iade), '', '',
            YU.csvSayi(t2.uretim), YU.csvSayi(t2.satis), '', '']);
          satirlar.push([]);
          /* Gün gün döküm ekrandan kaldırıldı ama CSV'de KALIYOR: indirilen
             dosya Excel'de incelenecek, orada gün ayrıntısı işe yarar. */
          satirlar.push(['Gün Gün Toplamlar']);
          satirlar.push(['Tarih', 'Günlük Üretim (kg)', 'Günlük İade (kg)', 'Günlük Satış (kg)']);
          var gunlerT = gunAraligi(v.gunler), g2, gv;
          for (j = 0; j < gunlerT.length; j++) {
            g2 = gunlerT[j];
            gv = v.gunler[g2];
            satirlar.push([YU.fmt.tarih(g2),
              YU.csvSayi(gv ? gv.uretim : 0),   /* iade zaten dahil değil */
              YU.csvSayi(gv ? gv.iade : 0),
              YU.csvSayi(gv ? gv.satis : 0)]);
          }
          YU.csvIndir('aylik-ozet-' + ay + '.csv', satirlar);
        }
      }),
      /* Ana Sayfa'daki yazdırma düğmesinin aynısı (kullanıcı isteği, 27.08.2026). */
      YU.ui.dugme({
        metin: 'Yazdır', ikon: '#ic-download', tur: 'birincil',
        baslik: 'Bu sayfayı yazdır',
        onClick: function () { window.print(); }
      })
    );

    /* KPI kartları KALDIRILDI (kullanıcı kararı, 25.08.2026). Yerine ürün
       grubu karşılaştırması geldi: tek "toplam üretim" satırı sekiz malzemeyi
       aynı kefeye koyuyordu; artık KURU KÜSPE / YAŞ KÜSPE / DİĞER ayrı satır,
       üretim–satış–iade–stok değişimi ayrı sütun. Her hücrede rakamın altında
       geçen aya göre değişim durur — üç boyut (grup × kalem × ay) tek tabloya
       böyle sığıyor, on iki satırlık listeye şişmeden. */
    var oncekiAyKodu = oncekiAy(ay);
    var oncekiAyBasi = oncekiAyKodu + '-01';
    var oncekiOncesi = YU.tarih.ekle(oncekiAyBasi, -1);

    /* EŞİT GÜN ARALIĞI (kullanıcı direktifi, 25.08.2026). İçinde bulunulan ay
       yarımdır; onu geçen ayın TAMAMIYLA kıyaslamak her zaman düşüş gösterirdi.
       Bugün ayın kaçıncı günüyse geçen aydan da o kadar gün alınır:
       25 Ağustos'tayız → 1–25 Ağustos ile 1–25 Temmuz karşılaştırılır.
       Geçmiş bir ay seçiliyse iki taraf da tam aydır. */
    var sinirGun = buAyMi ? gunNo(bugun) : 0;
    var oncekiKapanis = sinirGun
      ? ayinGunu(oncekiAyKodu, sinirGun)
      : YU.tarih.aySonu(oncekiAyBasi);

    var oncekiV = ayVerisi(depo, oncekiAyKodu, sinirGun);
    var kk = kuruKuspeAyi(depo, ay, sinirGun);
    var oncekiKk = kuruKuspeAyi(depo, oncekiAyKodu, sinirGun);
    var buGrup = grupOzeti(depo, v, kk, ayOncesiGun, kapanisTarih);
    var oncekiGrup = grupOzeti(depo, oncekiV, oncekiKk, oncekiOncesi, oncekiKapanis);

    /* "Önceki Aya Göre Ürün Grubu Karşılaştırması" paneli KALDIRILDI
       (kullanıcı isteği, 26.08.2026). Önceki ay kıyası kaybolmadı: Aylık
       Malzeme Özeti tablosunda her malzemenin hücresinde ▲/▼ olarak ve
       ipucunda ay adıyla duruyor. Grup toplamları CSV çıktısında da kalır. */
    /* Malzeme özeti — ay başı stok → hareketler → ay sonu stok.
       "Günlük Ort." (kullanıcı isteği, 25.08.2026) malzemenin AYLIK ÜRETİMİNİ
       ayın kayıtlı gün sayısına böler. Burada çeşit karışmaz: her satır tek
       malzemenin kendi ortalamasıdır — KPI'daki toplu ortalamanın anlamsız
       olmasının sebebi buydu. */
    function gunlukOrt(n) {
      return v.gunSayisi && n ? YU.yuvarla(n / v.gunSayisi) : 0;
    }

    /* "Önceki aya göre" için AYRI KOLON AÇILMADI (kullanıcı isteği,
       25.08.2026 — kaos istenmiyor): dokuzuncu sütun tabloyu ekrandan
       taşırıyordu. Değişim, üretim rakamının hemen altında küçük renkli
       satır olarak durur — bilgi tam ait olduğu yerde, tablo genişlemiyor. */
    function uretimHucresi(sat) {
      if (!sat.uretim) return tire();
      var oncekiM = oncekiV.malzemeler[sat.malzeme.Id];
      var oncekiUretim = oncekiM ? oncekiM.uretim : 0;
      var kutu = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' } },
        kgOlcu(sat.uretim)
      );
      if (oncekiUretim) {
        var oran = (sat.uretim - oncekiUretim) / oncekiUretim * 100;
        if (Math.abs(oran) >= 0.05) {
          kutu.appendChild(YU.h('span', {
            stil: { font: '400 11px/1 var(--font)', color: oran > 0 ? 'var(--olumlu)' : 'var(--olumsuz)' },
            metin: (oran > 0 ? '▲ +' : '▼ −') + YU.fmt.yuzde(Math.abs(oran))
          }));
        }
      }
      kutu.title = oncekiUretim
        ? ayAdi(oncekiAyKodu) + ': ' + YU.fmt.kgU(oncekiUretim)
        : ayAdi(oncekiAyKodu) + ' ayında üretim yok';
      return kutu;
    }

    var ozetSatirlar = [];
    for (i = 0; i < ozet.length; i++) {
      sat = ozet[i];
      ozetSatirlar.push([
        YU.h('span', {
          sinif: 'yu-guclu',
          /* Dar pencerede ad üç satıra kırılıp satırı üç katına çıkarıyordu
             (26.08.2026); Program Hareketleri'ndeki gibi tek satırda kalır. */
          stil: { whiteSpace: 'nowrap' },
          metin: sat.malzeme.Ad
        }),
        kgYaTire(sat.basStok),
        kgYaTire(sat.iade),
        sat.uretim ? kgOlcu(gunlukOrt(sat.uretim)) : tire(),
        sat.satis ? kgOlcu(gunlukOrt(sat.satis)) : tire(),
        uretimHucresi(sat),
        kgYaTire(sat.satis),
        farkHucre(sat.fark, sat.devirIcinde),
        kgOlcu(sat.sonStok)
      ]);
    }
    /* Panelin kapsadığı ARALIK başlığın sağında yazar (kullanıcı isteği,
       26.08.2026: "son 30 gün mü, 1 Ağustos'tan itibaren mi — veri bilgisi
       doğru olsun"). Bu tablo KAYAN 30 GÜN DEĞİL, TAKVİM AYIDIR: ayın 1'inden
       başlar; içinde bulunulan ayda bugüne, geçmiş ayda ayın son gününe kadar
       sayar (ayVerisi çağrısında sinirGun verilmez). Gün sayısı, aralıkta
       KAYIT GİRİLMİŞ gün adedidir — "Günlük Ort. Üretim" kolonu ona bölünür. */
    var kapsamMetni = '1–' + YU.fmt.sayi(gunNo(kapanisTarih)) + ' ' + ayAdi(ay) +
      ' · ' + YU.fmt.sayi(v.gunSayisi) + ' gün kaydı';

    /* "AYLIK TOPLAM" satırı KALDIRILDI (kullanıcı isteği, 26.08.2026).
       Onunla birlikte satırı çizen toplamHucresi de gitti; CSV çıktısındaki
       toplam satırı yerinde duruyor. */
    kap.appendChild(YU.ui.panel({
      /* Ay seçici BU panelin başlığında (kullanıcı isteği, 26.08.2026):
         önceden karşılaştırma panelinin başlığındaydı. Görünüm aynı —
         ay çipi + Önceki/Bu/Sonraki Ay düğmeleri. */
      baslik: YU.h('span', {
        stil: { display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }
      },
        YU.h('span', { metin: 'Aylık Malzeme Özeti' }),
        aySecici),
      ikon: '#ic-cube',
      sag: YU.h('span', {
        sinif: 'yu-zayif',
        metin: kapsamMetni,
        title: 'Takvim ayıdır, kayan 30 gün değil: ' + YU.fmt.tarih(ayBasi) + ' – ' +
          YU.fmt.tarih(kapanisTarih) + ' arası. "Günlük Ort. Üretim" kolonu, bu aralıkta ' +
          'kayıt girilmiş ' + YU.fmt.sayi(v.gunSayisi) + ' güne bölünür.'
      }),
      dolgusuz: true,
      govde: [YU.ui.tablo({
        /* Başlıklar kendi kendini açıklar (kullanıcı isteği, 25.08.2026):
           ortadaki üç sütunun AY TOPLAMI olduğu, uçtaki ikisinin STOK olduğu
           başlıktan okunur. İki kelimeyi geçmez — kalabalık istenmiyor. */
        sutunlar: [
          /* Genişlik verildi (kullanıcı isteği, 26.08.2026): ölçüsüz kalınca
             geniş ekranda artan yerin TAMAMINI bu kolon alıyor ve ayraç
             çizgisi adlardan çok uzağa düşüyordu. Ölçü küçük tutulur (150 px):
             tablo genişleyince artan yer kolonlara ORANLI dağıldığı için bu
             kolonun payı da küçük kalır, çizgi adlara yakın durur. */
          { baslik: 'Malzeme', genislik: 150 },
          /* Kolon sırası kullanıcı tarafından verildi (26.08.2026): önce
             açılış ve iade, sonra GÜNLÜK ortalamalar, sonra AYLIK toplamlar,
             en sonda değişim ve kapanış. */
          { baslik: 'Ay Başı Stok', hiza: 'sag', mono: true, genislik: 120 },
          { baslik: 'Aylık İade', hiza: 'sag', mono: true, genislik: 110 },
          { baslik: 'Günlük Ort. Üretim', hiza: 'sag', mono: true, genislik: 140 },
          { baslik: 'Günlük Ort. Satış', hiza: 'sag', mono: true, genislik: 140 },
          { baslik: 'Aylık Üretim Toplamı', hiza: 'sag', mono: true, genislik: 150 },
          { baslik: 'Aylık Satış Toplamı', hiza: 'sag', mono: true, genislik: 145 },
          { baslik: 'Stok Değişimi', hiza: 'sag', mono: true, genislik: 125 },
          { baslik: kapanisBaslik, hiza: 'sag', mono: true, genislik: 120 }
        ],
        satirlar: ozetSatirlar,
        /* Karşılaştırma tablosuyla aynı iri ölçü (kullanıcı isteği,
           25.08.2026): satırlar biraz uzar, yazılar bir kademe büyür. */
        sik: false,
        sinif: 'yu-tablo-iri yu-tablo-ilk-ayrac',
        bos: 'Bu ay için kayıt yok.'
      })]
    }));

    /* KURU KÜSPE ve YAŞ KÜSPE AY ÖZETİ panelleri KALDIRILDI (kullanıcı
       kararı, 26.08.2026). Aynı rakamlar üstteki "Aylık Malzeme Özeti"
       tablosunda malzeme malzeme, "Önceki Aya Göre Ürün Grubu
       Karşılaştırması"nda da grup grup duruyordu. */

    /* Bu ekranda gün gün döküm YOK (kullanıcı kararları, 25.08.2026):
       gün × malzeme tablosu Program Hareketleri'nin işi, gün gün üretim–satış
       grafiği de Ana Sayfa'daki "Dökme Üretim – Dökme Satış" panelinde duruyor.
       Aylık Özet ay bazında toplam verir. */
  }

  YU.sayfaTanimla({
    kod: KOD,
    baslik: 'Aylık Özet',
    baskiBasligi: 'Aylık Stok ve Üretim Raporu',
    ikon: '#ic-calendar-dots',
    grup: 'Takip',
    rol: 'Hepsi',
    altBaslik: function (param) {
      var depo = YU.db;
      if (!depo) return '';
      var aylar = kayitliAylar(depo);
      var ay = param && param.ay && /^\d{4}-\d{2}$/.test(param.ay) ? param.ay : (aylar[0] || null);
      /* Alt başlıkta yalnız ay adı kalır (kullanıcı isteği, 25.08.2026);
         içerik dökümü ekranın kendisinden okunuyor. */
      return ay ? ayAdi(ay) : '';
    },
    ciz: ciz
  });
})();

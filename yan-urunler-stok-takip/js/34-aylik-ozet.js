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
  function kgYaTire(n) { return n ? YU.fmt.kg(n) : tire(); }

  /* Kuru küspe ay toplamı (Şartname §4). Hesap GÜNLÜK yapılıp toplanır:
     netDokmeUretim ve silodanCekilecek max(0,…) içerdiği için aylık brütten
     aylık çuvalı çıkarmak YANLIŞ olurdu — Durum B günleri (çuvallama >
     üretim) o gün silodan çekilir, ertesi günün üretimiyle mahsuplaşmaz. */
  /* Yaş küspe ay özeti (kullanıcı isteği, 25.08.2026 — "Ayın Uç Günleri"nin
     yerine). Kuru küspenin karşılığı ama YAŞ küspeye ait kalemlerle:
     yaş küspenin özel tipi yoktur, silo/çuvallama akışı da yoktur — üretim
     ve satış doğrudan GunlukHareket'ten okunur. Tonluk ve 25'lik ambalajlar
     ayrı ayrı, altında toplam ve stok değişimi verilir. */
  var POSET_DESEN = /25\s*'?\s*l[ıi]k|25\s*kg|po[şs]et/i;

  /* Bir ÜRÜN AİLESİNİN (kuru / yaş) ay özeti — iki panel de bunu kullanır
     ki aynı iskelette okunsunlar (kullanıcı isteği, 25.08.2026: "ortak
     paydada birleştir"). Döner:
       kalemler   : biçim/ambalaj kırılımı  [{ad, kg, ek}]
       uretim     : ayın toplam üretimi
       satis/iade : ailenin ay toplamı (bütün malzemeleri)
       basStok/sonStok/stokDegisimi, gun, gunlukOrt
     KURU KÜSPE İSTİSNASI (Şartname §4 Demirbaş): dökme satırının
     GunlukHareket üretimi NET'tir; ailenin toplam üretimi BRÜT dökme
     üretimidir ve çuvallama yeni üretim değildir — o yüzden toplam
     kalemlerin toplamı değil, kkAyi.uretilenDokme'den gelir. */
  function aileAyi(depo, ay, sinirGun, aile, basTarih, sonTarih, kkAyi) {
    var t = {
      kalemler: [], uretim: 0, satis: 0, iade: 0,
      basStok: 0, sonStok: 0, gun: 0
    };
    var gunler = {}, i, j, m, h, kalemKg, kalemEk;
    for (i = 0; i < depo.malzemeler.length; i++) {
      m = depo.malzemeler[i];
      if (malzemeGrubu(m.Ad) !== aile) continue;
      t.basStok = YU.yuvarla(t.basStok + (Number(YU.stok.malzemeStok(depo, m.Id, basTarih).mevcut) || 0));
      t.sonStok = YU.yuvarla(t.sonStok + (Number(YU.stok.malzemeStok(depo, m.Id, sonTarih).mevcut) || 0));
      kalemKg = 0; kalemEk = null;
      for (j = 0; j < depo.gunlukHareket.length; j++) {
        h = depo.gunlukHareket[j];
        if (h.MalzemeId !== m.Id) continue;
        if (ayAnahtari(h.Tarih) !== ay) continue;
        if (sinirGun && gunNo(h.Tarih) > sinirGun) continue;
        var u = Number(h.Uretim) || 0, s = Number(h.Satis) || 0, ia = Number(h.Iade) || 0;
        kalemKg = YU.yuvarla(kalemKg + u);
        t.satis = YU.yuvarla(t.satis + s);
        t.iade = YU.yuvarla(t.iade + ia);
        if (u || s || ia) gunler[h.Tarih] = 1;
      }
      /* Kuru küspede dökme kalemi BRÜT yazılır (net değil): panelin ilk
         satırı "ne üretildi" sorusuna cevap vermeli. Çuvallı kalemin yanına
         çuval adedi eklenir. */
      if (aile === 'kuru' && m.OzelTip === 'DokmeKuruKuspe' && kkAyi) {
        kalemKg = kkAyi.uretilenDokme;
        kalemEk = 'brüt';
      }
      if (aile === 'kuru' && m.OzelTip === 'CuvalKuruKuspe' && kkAyi) {
        kalemEk = YU.fmt.sayi(kkAyi.cuvalAdet) + ' çuval';
      }
      t.kalemler.push({ ad: kisaAdi(m.Ad, aile), kg: kalemKg, ek: kalemEk });
      t.uretim = YU.yuvarla(t.uretim + kalemKg);
    }
    /* Kuru küspede toplam = BRÜT dökme üretimi. Çuvallama biçim
       değiştirmedir, üretime İKİNCİ KEZ eklenmez (§4 çift sayım yasağı). */
    if (aile === 'kuru' && kkAyi) t.uretim = kkAyi.uretilenDokme;
    for (var g in gunler) if (Object.prototype.hasOwnProperty.call(gunler, g)) t.gun++;
    t.stokDegisimi = YU.yuvarla(t.sonStok - t.basStok);
    /* Ortalama TAM KG yazılır: 23.545,600 gibi üç ondalık okunmuyordu. */
    t.gunlukOrt = t.gun ? Math.round(t.uretim / t.gun) : 0;
    return t;
  }

  /* Kalem etiketi: aile adı satırda tekrar etmesin — "Yaş Küspe (Tonluk)"
     yaş panelinde "Tonluk" olur, "Kuru Küspe (50 Kg)" kuru panelinde
     "Çuvallı (50 Kg)". */
  function kisaAdi(ad, aile) {
    var s = String(ad);
    if (aile === 'kuru') {
      if (/d[öo]kme/i.test(s)) return 'Dökme';
      if (/50/.test(s)) return 'Çuvallı (50 Kg)';
    }
    if (aile === 'yas') {
      if (/d[öo]kme/i.test(s)) return 'Dökme';
      if (/25/.test(s)) return '25’lik';
      if (/tonluk/i.test(s)) return 'Tonluk';
    }
    return s;
  }

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


  /* Yüzde değişim rozeti: artış yeşil, düşüş kırmızı. Önceki dönem 0 ise
     yüzde tanımsızdır; oran uydurulmaz, "—" yazılır. ("yeni" işareti
     kaldırıldı — kullanıcı isteği, 25.08.2026.) */
  function degisimRozeti(simdi, onceki) {
    if (!onceki) return tire();
    var oran = (simdi - onceki) / onceki * 100;
    if (Math.abs(oran) < 0.05) return YU.ui.rozet('%0', 'notr');
    return YU.ui.rozet((oran > 0 ? '+' : '−') + YU.fmt.yuzde(Math.abs(oran)),
      oran > 0 ? 'olumlu' : 'olumsuz');
  }

  /* Ay içinde kampanya devri yapıldı mı — devir, stoğu üretim/satıştan
     bağımsız değiştirir; o ayın stok değişimi başka bir ayla kıyaslanamaz. */
  function aydaDevirVar(depo, ayKodu) {
    var i;
    for (i = 0; i < depo.devirStok.length; i++) {
      if (ayAnahtari(depo.devirStok[i].DevirTarihi) === ayKodu) return true;
    }
    for (i = 0; i < depo.siloDevirStok.length; i++) {
      if (ayAnahtari(depo.siloDevirStok[i].DevirTarihi) === ayKodu) return true;
    }
    return false;
  }

  /* Etiket–değer satırı (Silo Durumu'ndaki dille aynı). */
  function olcuSatiri(etiket, deger, guclu) {
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'baseline', gap: '12px', padding: '7px 0' }
    },
      YU.h('span', { sinif: 'yu-etiket', metin: etiket, stil: { flex: '1', minWidth: '0' } }),
      deger && deger.nodeType
        ? deger
        : YU.h('span', { sinif: 'yu-mono' + (guclu ? ' yu-guclu' : ''), metin: deger })
    );
  }

  /* İşaretli fark hücresi: +yeşil, −kırmızı, 0 gri. Ay içinde kampanya
     devri varsa yıldızla işaretlenir — fark devir etkisini de içerir,
     yalnız üretim/satıştan gelmez (KURAL 4.4: yanıltıcı okuma engellenir). */
  function farkHucre(n, devirIcinde) {
    if (!n && !devirIcinde) return tire();
    var deger = YU.h('span', {
      stil: { color: n > 0 ? 'var(--olumlu)' : (n < 0 ? 'var(--olumsuz)' : null) },
      metin: n ? (n > 0 ? '+' : '−') + YU.fmt.kg(Math.abs(n)) : YU.fmt.kg(0)
    });
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
    var AY_LISTE_YUKSEKLIGI = 236;   /* ~5,5 satır: kaydırılabilirlik görünsün */
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

    var ayCipi = YU.ui.acilirCip({
      ikon: '#ic-calendar', metin: ayAdi(ay), genislik: 268, enGenis: 268,
      baslik: 'Ay seç', dolgu: '8px 8px 10px',
      govde: function (kapat) {
        var kap = YU.h('div');
        var liste = YU.h('div', {
          sinif: 'yu-ay-liste',
          stil: { maxHeight: AY_LISTE_YUKSEKLIGI + 'px', overflowY: 'auto' }
        });
        var sonYil = null, j;
        for (j = 0; j < aylar.length; j++) {
          (function (a) {
            var yil = a.slice(0, 4);
            if (yil !== sonYil) {
              liste.appendChild(YU.h('div', {
                sinif: 'yu-ay-yil', metin: yil,
                stil: sonYil === null ? { marginTop: '2px' } : null
              }));
              sonYil = yil;
            }
            var secili = a === ay;
            var gun = ayGunSayisi[a] || 0;
            liste.appendChild(YU.h('button', {
              tip: 'button',
              sinif: 'yu-ay-satir' + (secili ? ' secili' : ''),
              'aria-pressed': secili ? 'true' : 'false',
              onClick: function () { kapat(); YU.git(KOD, { ay: a }); }
            },
              YU.h('span', { metin: ayAdi(a), stil: { flex: '1', minWidth: '0', textAlign: 'left' } }),
              YU.h('span', {
                sinif: 'yu-ay-satir-gun',
                metin: gun ? YU.fmt.sayi(gun) + ' gün' : '—'
              })
            ));
          })(aylar[j]);
        }
        kap.appendChild(liste);
        if (aylar.length > 5) {
          kap.appendChild(YU.h('div', {
            sinif: 'yu-yardim',
            stil: { margin: '0', padding: '8px 4px 0', borderTop: '1px solid var(--ayrac)' },
            metin: YU.fmt.sayi(aylar.length) + ' kayıtlı ay'
          }));
        }
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
    var aySecici = YU.h('div', {
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
          satirlar.push(['Malzeme', 'Ay Başı Stok (kg)', 'Aylık Üretim (kg)', 'Günlük Ort. Üretim (kg)',
            'Aylık İade (kg)', 'Aylık Satış (kg)', 'Stok Değişimi (kg)', kapanisBaslik + ' (kg)']);
          var j, o, ortalama;
          for (j = 0; j < ozet.length; j++) {
            o = ozet[j];
            ortalama = v.gunSayisi && o.uretim ? YU.yuvarla(o.uretim / v.gunSayisi) : 0;
            satirlar.push([o.malzeme.Ad, YU.csvSayi(o.basStok), YU.csvSayi(o.uretim),
              YU.csvSayi(ortalama), YU.csvSayi(o.iade), YU.csvSayi(o.satis),
              YU.csvSayi(o.fark), YU.csvSayi(o.sonStok)]);
          }
          var t2 = v.toplam;
          satirlar.push(['AYLIK TOPLAM', '', YU.csvSayi(t2.uretim), '', YU.csvSayi(t2.iade),
            YU.csvSayi(t2.satis), '', '']);
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

    /* Karşılaştırılan iki pencere, panel başlığının sağında yazar (KURAL 8:
       bilgi dipnotta değil başlıkta). KAYITLI GÜN SAYISI da yazılır: pencere
       eşit uzunlukta olsa bile kampanya ay ortasında başlamışsa taraflardan
       biri daha az gün taşır (ölçüldü: 1–25 Temmuz'da yalnız 4 gün kayıt var,
       kıyas %488'lik sahte bir artış gösteriyordu). Gün sayısı görünürse
       oranın neden yüksek çıktığı rakama bakınca anlaşılır. */
    function pencereMetni(ayKodu, ayVeri) {
      var ad = sinirGun
        ? ayAdi(ayKodu) + ' 1–' + YU.fmt.sayi(Math.min(sinirGun, gunNo(YU.tarih.aySonu(ayKodu + '-01'))))
        : ayAdi(ayKodu);
      return ad + ' · ' + YU.fmt.sayi(ayVeri.gunSayisi) + ' gün';
    }

    /* Kıyas, İKİ AYDAN BİRİNDE devir varsa stok değişiminde yapılmaz: devir,
       stoğu üretim/satıştan bağımsız değiştirir (ölçüldü: Temmuz 2026'nın
       kendi devri −1.707.770 kg'lık sahte bir "düşüş" üretiyordu). Sebep
       hücrenin kendi alt satırında yazar; tablo altına dipnot konmaz. */
    var buAyDevirli = aydaDevirVar(depo, ay);
    var devirEngeli = buAyDevirli || aydaDevirVar(depo, oncekiAyKodu);

    /* Hücre: üstte bu ayın rakamı, altında geçen aya göre değişim.
       isaretli → değer +/− ile yazılır ve renklenir (stok değişimi).
       kiyassiz → alt satır basılmaz (devir yüzünden kıyas geçersizse). */
    function grupHucresi(simdi, onceki, secenek) {
      secenek = secenek || {};
      if (!simdi && !onceki) return tire();
      var ustMetin = secenek.isaretli && simdi
        ? (simdi > 0 ? '+' : '−') + YU.fmt.kg(Math.abs(simdi))
        : YU.fmt.kg(simdi);
      var kutu = YU.h('div', {
        stil: { display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }
      },
        YU.h('span', {
          sinif: 'yu-guclu',
          stil: secenek.isaretli && simdi
            ? { color: simdi > 0 ? 'var(--olumlu)' : 'var(--olumsuz)' } : null,
          metin: ustMetin
        })
      );
      /* Devir ayında stok kıyası geçersiz — sebep hücrenin ALT SATIRINDA
         yazar (KURAL 8), tablonun altına dipnot konmaz. */
      if (secenek.kiyassiz) {
        kutu.appendChild(YU.h('span', {
          stil: { font: '400 11px/1 var(--font)', color: 'var(--bekleyen)' },
          metin: 'devir ayı'
        }));
        kutu.title = 'Bu dönemde kampanya devri yapıldı; stok üretim ve satıştan ' +
          'bağımsız değiştiği için önceki ayla karşılaştırılmadı.';
        return kutu;
      }
      if (!onceki) {
        /* Önceki ayda kayıt yoksa altına hiçbir işaret yazılmaz (kullanıcı
           isteği, 25.08.2026: "yeni" ibaresi kaldırıldı). Bilgi kaybolmuyor —
           hücrenin ipucu zaten "önceki ay: kayıt yok" diyor. */
      } else {
        var oran = (simdi - onceki) / Math.abs(onceki) * 100;
        if (Math.abs(oran) >= 0.05) {
          kutu.appendChild(YU.h('span', {
            stil: { font: '400 11px/1 var(--font)', color: oran > 0 ? 'var(--olumlu)' : 'var(--olumsuz)' },
            metin: (oran > 0 ? '▲ +' : '▼ −') + YU.fmt.yuzde(Math.abs(oran))
          }));
        }
      }
      kutu.title = ayAdi(oncekiAyKodu) + ': ' + (onceki ? YU.fmt.kgU(onceki) : 'kayıt yok');
      return kutu;
    }

    function grupSatiri(kod) {
      var b = buGrup[kod], o = oncekiGrup[kod];
      var fark = YU.yuvarla(b.son - b.bas);
      var oncekiFark = YU.yuvarla(o.son - o.bas);
      /* Kuru küspenin üretimi HAM (brüt) — bu, satır etiketinde yazar
         (KURAL 8); eskiden tablo altında dipnottu. */
      var etiket = YU.h('span', { sinif: 'yu-guclu', metin: GRUP_ADLARI[kod] });
      if (kod === 'kuru') {
        etiket.title = 'Üretim ham (brüt) üretimdir; çuvallanan miktar bu rakamın ' +
          'içinden çıkar, ayrıca eklenmez.';
      }
      if (kod === 'diger') etiket.title = 'Atık kuru küspe, toprak ve kuyruk.';
      return [
        etiket,
        grupHucresi(b.uretim, o.uretim),
        grupHucresi(b.satis, o.satis),
        grupHucresi(b.iade, o.iade),
        grupHucresi(fark, oncekiFark, { isaretli: true, kiyassiz: devirEngeli })
      ];
    }

    /* KURAL 8: ne karşılaştırıldığı BAŞLIKTA, hangi dönem olduğu başlığın
       sağında yazar; tablo altında açıklama yok. */
    kap.appendChild(YU.ui.panel({
      /* Başlığın yanında hangi iki ayın karşılaştırıldığı SİLİK yazar
         (kullanıcı isteği, 25.08.2026): "Önceki ay" soyut kalıyordu. */
      /* Ay seçici başlığın HEMEN SAĞINDA (kullanıcı isteği, 25.08.2026):
         hangi ayın seçildiği, ayların yazdığı yerde durur. */
      baslik: YU.h('span', {
        stil: { display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }
      },
        YU.h('span', { metin: 'Önceki Aya Göre Ürün Grubu Karşılaştırması' }),
        YU.h('span', {
          sinif: 'yu-zayif',
          stil: { fontWeight: '400' },
          metin: '(' + ayAdi(oncekiAyKodu) + ' – ' + ayAdi(ay) + ')'
        }),
        aySecici),
      ikon: '#ic-bars-up',
      sag: YU.h('span', { sinif: 'yu-zayif',
        metin: pencereMetni(oncekiAyKodu, oncekiV) + '  →  ' + pencereMetni(ay, v) }),
      dolgusuz: true,
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Ürün Grubu' },
          { baslik: 'Üretim (Ham)', hiza: 'sag', mono: true, genislik: 150 },
          { baslik: 'Satış', hiza: 'sag', mono: true, genislik: 150 },
          { baslik: 'İade', hiza: 'sag', mono: true, genislik: 130 },
          { baslik: 'Stok Değişimi', hiza: 'sag', mono: true, genislik: 150 }
        ],
        satirlar: [grupSatiri('kuru'), grupSatiri('yas'), grupSatiri('diger')],
        /* sik:false — satır dolgusu bir kademe rahatlar (kullanıcı isteği,
           25.08.2026: "satırları çok az uzat"). yu-tablo-iri sınıfı yazıları
           da bir kademe büyütür (tema.css). */
        sik: false,
        sinif: 'yu-tablo-iri',
        bos: 'Bu ay için kayıt yok.'
      })
    }));

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
        YU.h('span', { metin: YU.fmt.kg(sat.uretim) })
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
        YU.h('span', { sinif: 'yu-guclu', metin: sat.malzeme.Ad }),
        kgYaTire(sat.basStok),
        uretimHucresi(sat),
        sat.uretim
          ? YU.h('span', { sinif: 'yu-zayif', metin: YU.fmt.kg(gunlukOrt(sat.uretim)) })
          : tire(),
        kgYaTire(sat.iade),
        kgYaTire(sat.satis),
        farkHucre(sat.fark, sat.devirIcinde),
        YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(sat.sonStok) })
      ]);
    }
    ozetSatirlar.push([
      YU.h('span', { sinif: 'yu-guclu', metin: 'AYLIK TOPLAM' }),
      tire(),
      YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(v.toplam.uretim) }),
      tire(),
      YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(v.toplam.iade) }),
      YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(v.toplam.satis) }),
      tire(),
      tire()
    ]);

    kap.appendChild(YU.ui.panel({
      baslik: 'Aylık Malzeme Özeti',
      ikon: '#ic-cube',
      /* Panel sağındaki "üretimdeki ▲▼ … farkı gösterir" yazısı KALDIRILDI
         (kullanıcı isteği, 25.08.2026): hangi dönemle kıyaslandığı üstteki
         karşılaştırma panelinin başlığında zaten yazıyor. */
      dolgusuz: true,
      govde: [YU.ui.tablo({
        /* Başlıklar kendi kendini açıklar (kullanıcı isteği, 25.08.2026):
           ortadaki üç sütunun AY TOPLAMI olduğu, uçtaki ikisinin STOK olduğu
           başlıktan okunur. İki kelimeyi geçmez — kalabalık istenmiyor. */
        sutunlar: [
          { baslik: 'Malzeme' },
          { baslik: 'Ay Başı Stok', hiza: 'sag', mono: true, genislik: 120 },
          { baslik: 'Aylık Üretim', hiza: 'sag', mono: true, genislik: 120 },
          { baslik: 'Günlük Ort.', hiza: 'sag', mono: true, genislik: 110 },
          { baslik: 'Aylık İade', hiza: 'sag', mono: true, genislik: 110 },
          { baslik: 'Aylık Satış', hiza: 'sag', mono: true, genislik: 120 },
          { baslik: 'Stok Değişimi', hiza: 'sag', mono: true, genislik: 125 },
          { baslik: kapanisBaslik, hiza: 'sag', mono: true, genislik: 120 }
        ],
        satirlar: ozetSatirlar,
        /* Karşılaştırma tablosuyla aynı iri ölçü (kullanıcı isteği,
           25.08.2026): satırlar biraz uzar, yazılar bir kademe büyür. */
        sik: false,
        sinif: 'yu-tablo-iri',
        bos: 'Bu ay için kayıt yok.'
      })]
    }));

    /* İki dar panel YAN YANA (kullanıcı isteği, 25.08.2026 — kaos olmasın):
       ikisi de kısa listedir; alt alta konsa sayfa gereksiz uzar, yan yana
       konunca aynı yükseklikte iki blok olarak okunur. */
    /* kk yukarıda, grup karşılaştırması için hesaplandı. yk = yaş küspe ay
       özeti; stok uçları grup tablosuyla aynı tarihleri kullanır. */
    /* İki aile de AYNI hesaplayıcıdan geçer (aileAyi); paneller de aynı
       çiziciyi kullanır, böylece yan yana okunabiliyorlar. */
    var kkA = aileAyi(depo, ay, sinirGun, 'kuru', ayOncesiGun, kapanisTarih, kk);
    var ykA = aileAyi(depo, ay, sinirGun, 'yas', ayOncesiGun, kapanisTarih, null);

    /* Ortak iskelet: kırılım → toplamlar → stoklar → (varsa) aileye özel ek. */
    function aileOzetPaneli(o) {
      var d = o.veri;
      if (!d.gun) {
        return YU.ui.panel({
          baslik: o.baslik, ikon: o.ikon,
          sag: YU.h('span', { sinif: 'yu-zayif', metin: ayAdi(ay) }),
          govde: YU.h('div', { sinif: 'yu-yardim', metin: o.bosMetin })
        });
      }
      var govde = YU.h('div');
      var i;
      for (i = 0; i < d.kalemler.length; i++) {
        govde.appendChild(olcuSatiri(
          ayAdi(ay) + ' Üretimi · ' + d.kalemler[i].ad +
            (d.kalemler[i].ek ? ' (' + d.kalemler[i].ek + ')' : ''),
          YU.fmt.kgU(d.kalemler[i].kg),
          i === 0
        ));
      }
      govde.appendChild(YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }));
      govde.appendChild(olcuSatiri(ayAdi(ay) + ' Toplam Üretimi', YU.fmt.kgU(d.uretim)));
      govde.appendChild(olcuSatiri('Günlük Ortalama Üretim (' + YU.fmt.sayi(d.gun) + ' güne bölündü)',
        YU.fmt.kgU(d.gunlukOrt)));
      govde.appendChild(olcuSatiri(ayAdi(ay) + ' Toplam Satışı', YU.fmt.kgU(d.satis)));
      govde.appendChild(olcuSatiri(ayAdi(ay) + ' Toplam İadesi', YU.fmt.kgU(d.iade)));
      govde.appendChild(YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }));
      govde.appendChild(olcuSatiri(ayAdi(ay) + ' Başı Stok', YU.fmt.kgU(d.basStok)));
      govde.appendChild(olcuSatiri(buAyMi ? 'Bugünkü Stok' : (ayAdi(ay) + ' Sonu Stok'),
        YU.fmt.kgU(d.sonStok)));
      govde.appendChild(olcuSatiri(ayAdi(ay) + ' Stok Değişimi', YU.h('span', {
        sinif: 'yu-mono yu-guclu',
        stil: { color: d.stokDegisimi >= 0 ? 'var(--olumlu)' : 'var(--olumsuz)' },
        metin: (d.stokDegisimi >= 0 ? '+' : '−') + YU.fmt.kgU(Math.abs(d.stokDegisimi))
      })));
      if (o.ek) govde.appendChild(o.ek);
      return YU.ui.panel({
        baslik: o.baslik, ikon: o.ikon,
        sag: YU.h('span', { sinif: 'yu-zayif', metin: ayAdi(ay) + ' · ' + YU.fmt.sayi(d.gun) + ' gün kaydı' }),
        govde: govde
      });
    }

    kap.appendChild(YU.h('div', { sinif: 'yu-izgara yu-iz-2' },
      /* İKİ AİLE PANELİ AYNI İSKELET (kullanıcı isteği, 25.08.2026 —
         "ortak paydada birleştir"): önce biçim/ambalaj kırılımı, sonra her
         iki panelde BİREBİR aynı sırayla toplam üretim · günlük ortalama ·
         toplam satış · toplam iade, sonra yine aynı sırayla ay başı stok ·
         ay sonu stok · stok değişimi. Aileye özel olan tek blok en altta
         durur: kuru küspenin silo akışı (yaş küspenin silosu yoktur). */
      aileOzetPaneli({
        baslik: 'Kuru Küspe Ay Özeti', ikon: '#ic-silos', veri: kkA,
        bosMetin: 'Bu ay kuru küspe hareketi yok.',
        ek: kk.gun ? YU.h('div', null,
          YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }),
          olcuSatiri(ayAdi(ay) + ' Silolara Giren (net üretim)', YU.fmt.kgU(kk.netDokmeUretim)),
          olcuSatiri(ayAdi(ay) + ' Silodan Çekilen (çuvallama)', YU.fmt.kgU(kk.silodanCekilen)),
          olcuSatiri(ayAdi(ay) + ' Silo Net Değişimi', YU.h('span', {
            sinif: 'yu-mono yu-guclu',
            stil: { color: kk.siloNetDegisim >= 0 ? 'var(--olumlu)' : 'var(--olumsuz)' },
            metin: (kk.siloNetDegisim >= 0 ? '+' : '−') + YU.fmt.kgU(Math.abs(kk.siloNetDegisim))
          })),
          kk.durumB ? YU.h('div', {
            sinif: 'yu-yardim', stil: { marginTop: '8px' },
            metin: YU.fmt.sayi(kk.durumB) + ' günde çuvallama üretimi aştı; ' +
              'aradaki fark silodan çekildi (Durum B).'
          }) : null
        ) : null
      }),
      aileOzetPaneli({
        baslik: 'Yaş Küspe Ay Özeti', ikon: '#ic-beet', veri: ykA,
        bosMetin: 'Bu ay yaş küspe hareketi yok.'
      })
    ));

    /* Gün × malzeme döküm tablosu KALDIRILDI (kullanıcı kararı, 25.08.2026):
       "bu rapor, aylık özet değil" — gün gün sekiz kolonluk tablo bu ekranın
       işi değil, Program Hareketleri'nin işi. Şartname §11 bu ekrandan ay
       bazında toplam ve GÜN GÜN GRAFİK ister; grafik aşağıda duruyor. */
    var gunListesi = gunAraligi(v.gunler);

    /* Gün gün grafik — üretim(+iade) ve satış (Şartname §11 "gün gün grafik").
       Etiket yalnız gün numarası; her 2. etiket sutunGrafik'e sığar. */
    var grafikVeri = [];
    for (i = 0; i < gunListesi.length; i++) {
      var gv2 = v.gunler[gunListesi[i]];
      grafikVeri.push({
        /* Etiket "1" değil "01.08" (kullanıcı isteği, 25.08.2026): grafik
           kaydırılabildiği için yalnız gün numarası hangi aya ait olduğunu
           söylemiyordu. */
        etiket: YU.fmt.tarih(gunListesi[i]).slice(0, 5),
        deger1: gv2 ? gv2.uretim : 0,
        deger2: gv2 ? gv2.satis : 0
      });
    }
    /* Silo Durumu'ndaki dökme grafiğiyle aynı davranış (kullanıcı isteği,
       25.08.2026): sütunlar doğal genişlikte, en yeni gün SAĞDA, eskiye
       fareyle sürükleyerek ya da iki yandaki oklarla gidilir. Görünür
       pencere en fazla 25 gün — daha geniş ekranda bile 26. gün ekrana
       gelmez, kaydırmada kalır. Ayın tüm günleri veride durur, hiçbiri
       atılmaz. */
    var gg = YU.ui.kaydirmaliGrafik({
      veri: grafikVeri,
      yukseklik: 190,
      enFazlaGun: 25,
      efsane: ['Üretim', 'Satış'],
      bos: 'Bu ay için kayıt yok.'
    });
    kap.appendChild(YU.ui.panel({
      baslik: 'Gün Gün Üretim ve Satış',
      ikon: '#ic-chart',
      sag: YU.h('span', { sinif: 'yu-zayif' },
        YU.h('span', { metin: 'tüm malzemelerin kg toplamı · iade hariç' }),
        gg.notEl),
      govde: gg.govde
    }));
  }

  YU.sayfaTanimla({
    kod: KOD,
    baslik: 'Aylık Özet',
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

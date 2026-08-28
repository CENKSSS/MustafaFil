/* js/25-gunluk-rapor.js — Günlük Rapor ekranı.
   Şartname §7: "Seçilen günün kuru küspe detayı (ham girdi + net üretim AYRI),
   tüm malzeme ve silo hareketleri." · §7 v2: "Dökme satış ayrı satır."
   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu).
   SÖZLEŞME §6 (UI imzaları), §9 (sınıf adları).

   Dosya yüklenirken hiçbir şey çizmez; yalnızca YU.sayfaTanimla çağırır. */
(function () {
  'use strict';

  var YU = window.YU;

  /* ------------------------------------------------------------------
     Yardımcılar
     ------------------------------------------------------------------ */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  /* Gelecek gün seçilemez (kullanıcı direktifi, 24.08.2026): adresle gelen
     ileri tarih bugüne çekilir. */
  function tarihSec(param) {
    /* Kampanya bakışı (kullanıcı isteği, 24.08.2026): varsayılan tarih
       seçili kampanyanın görünüm sonu; adresle gelen ileri tarih yine
       bugüne kelepçelenir (gelecek gün seçilemez). */
    var t = param && gecerliTarih(param.tarih) ? param.tarih : YU.donem.gorunumSonu();
    var bugun = YU.tarih.bugun();
    return t > bugun ? bugun : t;
  }

  function kullaniciAdi(depo, id) {
    if (id === null || id === undefined) return null;
    for (var i = 0; i < depo.kullanicilar.length; i++) {
      if (depo.kullanicilar[i].Id === id) {
        return depo.kullanicilar[i].AdSoyad;
      }
    }
    return 'Kullanıcı #' + id;
  }

  function say(v) {
    var n = typeof v === 'number' ? v : Number(v);
    return isFinite(n) ? YU.yuvarla(n) : 0;
  }

  /* ------------------------------------------------------------------
     Kuru küspe detayı (Şartname §4, DEMİRBAŞ)
     ------------------------------------------------------------------ */

  /* Şartname §4 "Raporlamada dikkat" — DEMİRBAŞ:
     Durum B'de net dökme üretim 0 görünür, ama operatörün girdiği HAM RAKAM
     kaybolmamalı; raporda AYRI durmalı. İlk akış satırındaki "Üretilen Dökme
     (Ham)" ögesi o kuralın karşılığıdır ve net üretimle asla birleştirilmez.

     Sadeleştirme (kullanıcı isteği, 21.08.2026): satır başına düşen rozet ve
     formül açıklamaları kaldırıldı; rakamlar giriş ekranındaki hesap şeridi
     diliyle (yu-hesap-*) iri ve kalın yazılır, formüller tek dipnota indi. */

  /* GÜNÜN ÖZETİ — sayfanın ilk paneli (kullanıcı seçimi, 21.08.2026):
     günün üç sonuç rakamı iri ve renkli; sağda yalnız iri tarih durur.
  /* Kaynak bilgisi ikincildir: rozet yerine soluk metin (sadelik, 21.08.2026). */
  function malzemeKaynagi(malzeme) {
    if (!malzeme) return YU.ui.rozet('Malzeme Bulunamadı', 'olumsuz');
    var metin = malzeme.OzelTip === 'DokmeKuruKuspe' ? 'Otomatik · kuru küspe girişi'
      : malzeme.OzelTip === 'CuvalKuruKuspe' ? 'Üretim otomatik · satış elle'
      : 'Elle girildi';
    return YU.h('span', { sinif: 'yu-zayif', metin: metin });
  }

  /* Kim, saat kaçta — son dokunan (güncelleyen yoksa oluşturan); gün
     yazılmaz, ekran zaten tek güne ait (kullanıcı isteği, 21.08.2026). */
  function kaydedenMetni(depo, h) {
    if (!h) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    var id = h.GuncelleyenKullaniciId !== null && h.GuncelleyenKullaniciId !== undefined
      ? h.GuncelleyenKullaniciId : h.OlusturanKullaniciId;
    var an = h.GuncellemeTarihi || h.OlusturmaTarihi;
    var ad = kullaniciAdi(depo, id);
    /* SAAT KALDIRILDI (kullanıcı isteği, 27.08.2026): aynı saat tablonun EN
       SOLUNDAKİ "Tarih · Saat" kolonunda zaten yazıyor; burada ikinci kez
       yazılıyordu. Bu kolon artık yalnız KİMİ söyler. */
    if (!ad) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    return YU.h('span', { sinif: 'yu-zayif', metin: ad, stil: { whiteSpace: 'nowrap' } });
  }

  /* Malzeme satırları da günlük değişim diliyle okunur (kullanıcı isteği,
     24.08.2026): gün başı stok, +üretim, −satış, gün sonu stok.
     Gün sonu = güne KADAR mevcut (Tarih <= gün, Şartname §5); gün başı ondan
     o günün üretim/satışı geri alınarak bulunur. Dökme kuru küspe İSTİSNA:
     mevcudu silo toplamı olduğu için başı/sonu silo özetinden gelir —
     Durum B'de çuvallama çekişi basit formülü yanıltırdı. */
  /* Yön taşıyan rakam işaret ve renk alır (KURAL 10.1 · kullanıcı isteği,
     25.08.2026): stoğa GİREN "+" ve yeşil, stoktan ÇIKAN "−" ve kırmızı.
     Gün Başı / Gün Sonu yön taşımaz (seviyedir), nötr kalır. */
  function yonluHucre(deger, yon) {
    var n = Number(deger) || 0;
    if (!(n > 0)) return YU.h("span", { sinif: "yu-zayif", metin: "—" });
    var giren = yon === "giren";
    return YU.h("span", {
      stil: { color: giren ? "var(--olumlu)" : "var(--olumsuz)", whiteSpace: "nowrap" },
      metin: (giren ? "+" : "−") + YU.fmt.kg(n)
    });
  }

  /* Satırın tarihi + son dokunuş saati (kullanıcı isteği, 27.08.2026).
     Tarih raporun günüdür; saat o satıra EN SON ne zaman dokunulduğunu
     söyler (güncellendiyse güncelleme anı, yoksa oluşturma anı) — sağdaki
     Kaydeden kolonu kimi, bu kolon ne zamanı söyler. */
  function tarihSaatHucresi(h, tarih) {
    var an = h ? (h.GuncellemeTarihi || h.OlusturmaTarihi) : null;
    return YU.h('div', { stil: { whiteSpace: 'nowrap' } },
      YU.h('div', { metin: YU.fmt.tarih(tarih) }),
      YU.h('div', { sinif: 'yu-yardim', stil: { margin: '0' }, metin: an ? YU.fmt.saat(an) : '—' })
    );
  }

  function malzemePaneli(depo, ozet, tarih, siloOzet) {
    var satirlar = [], i, s;
    for (i = 0; i < ozet.malzemeSatirlari.length; i++) {
      s = ozet.malzemeSatirlari[i];

      /* İade stoğu üretim gibi artırır ama ayrı sayılır (kullanıcı direktifi,
         24.08.2026) — gün başı köprüsünde o da geri alınır. */
      var iade = Number(s.hareket && s.hareket.Iade) || 0;

      var basi = null, sonu = null;
      if (s.malzeme && s.malzeme.OzelTip === 'DokmeKuruKuspe') {
        basi = siloOzet.toplam.basi;
        sonu = siloOzet.toplam.sonu;
      } else if (s.malzeme) {
        sonu = Number(YU.stok.malzemeStok(depo, s.malzeme.Id, tarih).mevcut) || 0;
        basi = YU.yuvarla(sonu - (Number(s.uretim) || 0) + (Number(s.satis) || 0));
      }

      /* Şartname §4 "Raporlamada dikkat" (DEMİRBAŞ, DUZELTME-PLANI M6):
         dökme satırı NET üretimi gösterir; operatörün girdiği HAM rakam
         kaybolmamalı — hücrede ayrı bir alt satır olarak durur. Durum B'de
         net "—" iken "Ham: 5.000" bu satırda okunur. */
      var uretimHucresi = yonluHucre(s.uretim, 'giren');
      if (s.malzeme && s.malzeme.OzelTip === 'DokmeKuruKuspe' && ozet.kuruKuspe) {
        uretimHucresi = YU.h('div', {
          stil: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
          title: 'İşletme raporundan gelen ham rakam. Net üretim 0 olsa bile burada durur (Şartname §4).'
        },
          uretimHucresi,
          YU.h('span', {
            sinif: 'yu-zayif',
            stil: { font: '400 11px/1.3 var(--mono)', whiteSpace: 'nowrap' },
            metin: 'Ham: ' + YU.fmt.kg(ozet.hesap.hamUretilenDokme)
          })
        );
      }

      satirlar.push([
        tarihSaatHucresi(s.hareket, tarih),
        /* nowrap: ad kolonda kırılıp satırı 3 kata çıkarıyordu (24.08.2026). */
        YU.h('span', { sinif: 'yu-guclu', metin: s.malzeme ? s.malzeme.Ad : ('Malzeme #' + s.hareket.MalzemeId), stil: { whiteSpace: 'nowrap' } }),
        basi === null ? YU.h('span', { sinif: 'yu-zayif', metin: '—' }) : YU.fmt.kg(basi),
        uretimHucresi,
        yonluHucre(iade, 'giren'),
        yonluHucre(s.satis, 'cikan'),
        sonu === null
          ? YU.h('span', { sinif: 'yu-zayif', metin: '—' })
          : YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(sonu) }),
        malzemeKaynagi(s.malzeme),
        kaydedenMetni(depo, s.hareket)
      ]);
    }

    var tablo = YU.ui.tablo({
      /* Kolonlar kısıldı (24.08.2026): sabit genişlikler konteyneri aşınca
         Malzeme kolonu eziliyor, adlar 2-3 satıra kırılıp satırı yükseltiyordu. */
      sutunlar: [
        { baslik: 'Tarih · Saat', genislik: 120 },
        { baslik: 'Malzeme' },
        { baslik: 'Gün Başı', hiza: 'sag', mono: true, genislik: 125 },
        { baslik: 'Üretim', hiza: 'sag', mono: true, genislik: 110 },
        { baslik: 'İade', hiza: 'sag', mono: true, genislik: 100 },
        { baslik: 'Satış', hiza: 'sag', mono: true, genislik: 110 },
        { baslik: 'Gün Sonu', hiza: 'sag', mono: true, genislik: 125 },
        { baslik: 'Kaynak', genislik: 160 },
        { baslik: 'Kaydeden', genislik: 160 }
      ],
      satirlar: satirlar,
      bos: 'Bu gün için malzeme hareketi yazılmamış.',
      /* Sık stil kapalı (kullanıcı isteği, 24.08.2026 — "satırı çok az
         büyüt"): satır dolgusu bir kademe rahatlar. */
      sik: false,
      yapiskan: true
    });
    /* Kaydeden sütunu YAZDIRMADA görünmez (kullanıcı isteği, 24.08.2026);
       ekranda durur. Sınıf tema.css'teki @media print kuralı içindir.
       yu-baski-sig (24.08.2026, yazdırma düzeltmesi): aşağıdaki inline
       minWidth A4'e sığmayıp GÜN SONU kolonunu kırptırıyordu — baskıda
       min-width !important ile sıfırlanır, yazı/dolgu küçülür (Stok
       Durumu'yla aynı çare). Ekran görünümü değişmez. */
    tablo.className += ' yu-yazdirmada-kaydedensiz yu-baski-sig yu-baski-ilk-tarih yu-tablo-sert-ayrac';
    /* Kolon araları için tablo kendi genişliğini korur (kullanıcı isteği,
       24.08.2026); dar pencerede kap yatay kaydırır. */
    var tabloEl = tablo.querySelector('table');
    if (tabloEl) tabloEl.style.minWidth = '1180px';   /* Tarih · Saat kolonu eklendi */

    /* Stok Durumu'ndaki panel diliyle (kullanıcı isteği, 24.08.2026):
       dolgusuz panel — tablo kenara oturur, panel daha derli durur. */
    /* Baskıda panel SAYFALAR ARASINDA bölünebilir ve başlık satırı her
       sayfada tekrarlanır (kullanıcı çıktısı, 27.08.2026: "yazdır kısmı
       hizalı değil"). .yu-panel'in break-inside: avoid kuralı tabloyu tek
       parça tutmaya çalışıp ikinci sayfaya BAŞLIKSIZ satırlar düşürüyordu —
       hareket paneli 24.08'de aynı çareyi almıştı, malzeme paneli açıkta
       kalmış. */
    var malzemePanel = YU.ui.panel({
      baslik: 'Malzeme Günlük Değişimi',
      ikon: '#ic-pencil',
      dolgusuz: true,
      /* "N satır" sayacı KALDIRILDI (kullanıcı isteği, 25.08.2026): satırlar
         zaten gözle görünüyor, sayaç ekranda fazladan gürültü yapıyordu. */
      govde: tablo
    });
    malzemePanel.className += ' yu-baski-bolunur';
    return malzemePanel;
  }

  /* ------------------------------------------------------------------
     Silo günlük değişimi + hareket dökümü

     Rapor "günlük değişim" diliyle kurulur (kullanıcı isteği, 24.08.2026):
     her silo için gün başı kaçtı, o gün kaç eklendi, kaç çıktı, gün sonu
     kaç oldu — tek bakışta. Hareket dökümü ALTINDA durmaya devam eder;
     Şartname §7 "tüm silo hareketleri" DEMİRBAŞ, kaldırılamaz.
     ------------------------------------------------------------------ */

  /* Silo başına günün toplamı. TÜM aktif silolar listelenir: hareketi
     olmayan silo da "değişmedi" bilgisiyle görünür — stok raporu, yalnız
     hareket listesi değil. Pasif silo ancak o gün hareketi varsa girer. */
  function siloGunlukOzet(depo, ozet, tarih) {
    var toplamlar = {}, i, h, o;
    for (i = 0; i < ozet.siloHareketleri.length; i++) {
      h = ozet.siloHareketleri[i].hareket;
      o = toplamlar[h.SiloId] || (toplamlar[h.SiloId] = { giren: 0, cikan: 0 });
      o.giren = YU.yuvarla(o.giren + say(h.GirenKg));
      o.cikan = YU.yuvarla(o.cikan + say(h.CikanKg));
    }

    var silolar = (depo.silolar || []).slice();
    silolar.sort(function (a, b) {
      var x = Number(a.Sira) || 0, y = Number(b.Sira) || 0;
      return x !== y ? x - y : (a.Id || 0) - (b.Id || 0);
    });

    var liste = [], toplam = { basi: 0, giren: 0, cikan: 0, sonu: 0 };
    for (i = 0; i < silolar.length; i++) {
      var s = silolar[i];
      o = toplamlar[s.Id] || { giren: 0, cikan: 0 };
      var basi = YU.stok.siloGunBasi(depo, s.Id, tarih);
      /* Pasif silo ancak hem hareketsiz HEM bakiyesiz ise düşer (M27):
         stoklu pasif silo düşünce dökme gün başı/sonu, Stok Durumu'nun
         silo toplamından kopuyordu (ölçüldü: 240 ton fark). */
      if (s.Aktif === false && !o.giren && !o.cikan && !basi) continue;
      var sonu = YU.yuvarla(basi + o.giren - o.cikan);
      liste.push({ silo: s, basi: basi, giren: o.giren, cikan: o.cikan, sonu: sonu });
      toplam.basi = YU.yuvarla(toplam.basi + basi);
      toplam.giren = YU.yuvarla(toplam.giren + o.giren);
      toplam.cikan = YU.yuvarla(toplam.cikan + o.cikan);
      toplam.sonu = YU.yuvarla(toplam.sonu + sonu);
    }
    return { liste: liste, toplam: toplam };
  }

  /* SİLO GÜNLÜK DEĞİŞİMİ PANELİ (kullanıcı isteği, 28.08.2026: "Malzeme
     Günlük Değişimi var ya, bir de silo günlük değişimi koysana — en üste").
     Veri zaten hesaplanıyordu (siloGunlukOzet, 24.08.2026'dan beri malzeme
     panelinin dökme satırını besliyor); ekranda karşılığı yoktu. Kolon dili
     malzeme paneliyle aynı: Gün Başı → Giren → Çıkan → Gün Sonu.
     TOPLAM satırı koyu zeminli (KURAL 10.1). */
  function siloDegisimPaneli(siloOzet) {
    var satirlar = [], i, r;
    for (i = 0; i < siloOzet.liste.length; i++) {
      r = siloOzet.liste[i];
      satirlar.push([
        YU.h('span', {
          sinif: 'yu-guclu', stil: { whiteSpace: 'nowrap' },
          metin: r.silo.Ad + (r.silo.Aktif === false ? ' (pasif)' : '')
        }),
        YU.fmt.kg(r.basi),
        yonluHucre(r.giren, 'giren'),
        yonluHucre(r.cikan, 'cikan'),
        YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(r.sonu) })
      ]);
    }
    if (satirlar.length > 1) {
      satirlar.push({ toplam: true, hucreler: [
        YU.h('span', { sinif: 'yu-guclu', metin: 'TOPLAM' }),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(siloOzet.toplam.basi) }),
        yonluHucre(siloOzet.toplam.giren, 'giren'),
        yonluHucre(siloOzet.toplam.cikan, 'cikan'),
        YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(siloOzet.toplam.sonu) })
      ] });
    }

    var tablo = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Silo' },
        { baslik: 'Gün Başı', hiza: 'sag', mono: true, genislik: 140 },
        { baslik: 'Giren', hiza: 'sag', mono: true, genislik: 130 },
        { baslik: 'Çıkan', hiza: 'sag', mono: true, genislik: 130 },
        { baslik: 'Gün Sonu', hiza: 'sag', mono: true, genislik: 140 }
      ],
      satirlar: satirlar,
      bos: 'Tanımlı silo yok.',
      sik: false,
      yapiskan: true
    });
    tablo.className += ' yu-baski-sig yu-tablo-sert-ayrac';

    var panel = YU.ui.panel({
      baslik: 'Silo Günlük Değişimi',
      ikon: '#ic-building',   /* sol menüdeki silo ekranıyla aynı ikon */
      dolgusuz: true,
      govde: tablo
    });
    panel.className += ' yu-baski-bolunur';
    return panel;
  }

  /* ------------------------------------------------------------------
     Kayıt bilgisi (Şartname §6 — denetim izi)
     ------------------------------------------------------------------ */

  function kunyeCifti(etiket, deger, kalin) {
    return YU.h('span', { stil: { display: 'inline-flex', alignItems: 'baseline', gap: '7px', whiteSpace: 'nowrap' } },
      YU.h('span', { sinif: 'yu-etiket', metin: etiket }),
      YU.h('span', { sinif: kalin === false ? '' : 'yu-guclu', metin: deger })
    );
  }

  /* Beş uzun bilgi satırı yerine tek satırlık künye çubuğu (sadelik,
     21.08.2026): kim ne zaman — kalın; teknik ayrıntı sonda soluk. */
  function kayitPaneli(depo, ozet) {
    var adaylar = [], i;
    if (ozet.kuruKuspe) adaylar.push(ozet.kuruKuspe);
    for (i = 0; i < ozet.malzemeSatirlari.length; i++) adaylar.push(ozet.malzemeSatirlari[i].hareket);

    /* "Son İşlem" ekleme DAHİL son dokunuşu gösterir (kullanıcı isteği,
       21.08.2026): 18:36'da yeni satır ekleyen de sayılır, yalnız güncelleme
       değil. */
    var olusturan = null, sonAn = null, sonKisi = null;
    for (i = 0; i < adaylar.length; i++) {
      var k = adaylar[i];
      if (k.OlusturmaTarihi && (!olusturan || k.OlusturmaTarihi < olusturan.OlusturmaTarihi)) olusturan = k;
      var an = k.GuncellemeTarihi || k.OlusturmaTarihi;
      if (an && (!sonAn || an > sonAn)) {
        sonAn = an;
        sonKisi = k.GuncellemeTarihi ? k.GuncelleyenKullaniciId : k.OlusturanKullaniciId;
      }
    }

    var ogeler = [
      kunyeCifti('Oluşturan', olusturan
        ? (kullaniciAdi(depo, olusturan.OlusturanKullaniciId) || '—') + ' · ' + YU.fmt.tarihSaat(olusturan.OlusturmaTarihi)
        : '—'),
      kunyeCifti('Son İşlem', sonAn
        ? (kullaniciAdi(depo, sonKisi) || '—') + ' · ' + YU.fmt.tarihSaat(sonAn)
        : '—')
    ];
    /* "Kayıt: 1 kuru küspe · 8 malzeme · 6 silo hareketi" sayacı kaldırıldı
       (kullanıcı isteği, 24.08.2026). */

    return YU.ui.panel({
      baslik: 'Kayıt Bilgisi',
      ikon: '#ic-users',
      govde: YU.h('div', {
        stil: { display: 'flex', alignItems: 'baseline', columnGap: '26px', rowGap: '10px', flexWrap: 'wrap' }
      }, ogeler)
    });
  }

  /* ------------------------------------------------------------------
     Günün İşlem Geçmişi — adım adım denetim izi (kullanıcı isteği,
     21.08.2026): bu günün verisine dokunan HER işlem kronolojik sırayla,
     kim / saat kaçta / neyi hangi değerden hangi değere çevirdi.
     Kaynak: DegisiklikLog (Şartname §6 v2). Örnek verinin çoğu gününde
     boştur — tohumlama denetim izi bırakmaz; gerçek kullanımda dolar.
     ------------------------------------------------------------------ */

  /* Değerler tablolardaki gibi kalın/mono vurgulanır (kullanıcı isteği,
     21.08.2026): eski değer KIRMIZI, yeni değer YEŞİL; Ekle özetindeki
  /* Değişiklik Geçmişi ekranındaki okuma dili buraya taşındı (kullanıcı
     isteği, 24.08.2026): tek "Ne Yapıldı" cümlesi yerine Kayıt · Ne Değişti ·
     Eski Değer · Yeni Değer kolonları. Artık geçerli olmayan değerin üstü
     çizilidir; sonradan silinen ya da üzerine yazılan adımın künyesinde
  /* İşlem, raporun gününden BAŞKA bir günde yapılmış olabilir: geçmişe dönük
     düzeltmeler böyledir. Liste işlem zamanına göre sıralandığı için önceki
     akşam yapılmış bir kayıt en üstte durur; yalnız saat yazınca "22:57 neden
     08:28'in üstünde" görünüyordu (kullanıcı geri bildirimi, 24.08.2026).
  /* Kayıt künyesi: boş kalırsa kaydın geldiği ekranın adı yazılır — kuru
     küspe günlük kaydının künyesi yalnız tarihten oluştuğu için rapor
  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  function ciz(kap, param) {
    var depo = YU.db;
    var tarih = tarihSec(param);
    var ozet = YU.stok.gunOzeti(depo, tarih);

    /* Tarih değiştirme kontrolleri KALDIRILDI (kullanıcı isteği, 24.08.2026):
       rapor tek güne bakar; gün, Geçmiş Girişler listesinden seçilerek
       açılır (satır tıklaması ?tarih= ile buraya getirir). Menüden gelinirse
       bugünün raporu görünür. */
    /* SAYFA EYLEMLERİ BOŞ (kullanıcı isteği, 28.08.2026: "yazdır ve csv
       falan olmasın, kaldır o butonları"). 28.08'de düzenleme düğmeleri
       (Kuru Küspe Girişi / Malzeme Girişi) kalkmıştı; şimdi çıktı
       düğmeleri de kalktı. Ekran yalnız okunur bir rapor. Çağrı duruyor:
       eylem şeridi yuvasını kurar, ileride düğme gerekirse yeri hazır. */
    YU.ui.sayfaEylemleri();

    /* DEVİR DOKUNUŞU DA O GÜNÜN KAYDIDIR (kullanıcı bildirimi, 27.08.2026):
       yalnız devir girilip değiştirilmiş bir gün "kayıt yok" diyerek boş
       dönüyordu — oysa alttaki hareket paneli o devir satırlarını zaten
       çiziyor, sayfa ona varmadan çıkıyordu. Sayım panelin KENDİ kuralından
       gelir (32-tum-hareketler · YU.gunDevirLogSayisi): devir satırı,
       değişikliğin yapıldığı güne düşer. */
    var devirDokunusu = typeof YU.gunDevirLogSayisi === 'function'
      ? YU.gunDevirLogSayisi(depo, tarih) : 0;
    var bosGun = !ozet.kuruKuspe && !ozet.malzemeSatirlari.length &&
      !ozet.siloHareketleri.length && !devirDokunusu;
    if (bosGun) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-calendar',
        baslik: YU.fmt.tarih(tarih) + ' için kayıt yok',
        metin: 'Bu güne ait kuru küspe girişi, malzeme hareketi veya silo hareketi bulunamadı.',
        eylemler: [
          YU.ui.dugme({
            metin: 'Bu Günü Gir', ikon: '#ic-plus', tur: 'birincil',
            onClick: function () { YU.git('kuru-kuspe', { tarih: tarih }); }
          }),
          YU.ui.dugme({
            metin: 'Geçmiş İşlemler', ikon: '#ic-calendar', tur: 'ikincil',
            onClick: function () { YU.git('gecmis-girisler'); }
          })
        ]
      }));
      return;
    }

    /* Günün Özeti, Kuru Küspe Detayı ve Silo Günlük Değişimi panelleri
       kaldırıldı (kullanıcı isteği, 24.08.2026): ekran yalnız hareket
       dökümlerini gösterir. Ham girdi (UretilenDokme) veri düzeyinde ve
       Kuru Küspe Günlük Giriş ekranında ayrı durmaya devam eder — §4
       "raporlamada dikkat" veri kuralı bozulmaz, yalnız bu ekrandaki
       gösterim kalktı. Fonksiyonlar geri istenirse duruyor. */
    /* "Bu Gün İçin Kuru Küspe Girişi Yapılmamış" şeridi KALDIRILDI (kullanıcı
       isteği, 27.08.2026 · her tarih için): kuru küspe satırının olmadığı
       tablodan zaten görülüyor, üst şeritteki eylem düğmeleri arasında da
       "Kuru Küspe Girişi" duruyor (KURAL 11). */

    /* Kayıt Bilgisi EN TEPEDE (kullanıcı isteği, 24.08.2026): güne kimin
       dokunduğu ilk bakışta görünsün. */
    /* SİLO GÜNLÜK DEĞİŞİMİ EN ÜSTTE (kullanıcı isteği, 28.08.2026:
       "en üste koy"): 24.08'de Kayıt Bilgisi en tepedeydi, artık silo
       özeti onun da üstünde — günün stok tablosu ilk bakışta okunur. */
    var siloOzet = siloGunlukOzet(depo, ozet, tarih);
    kap.appendChild(siloDegisimPaneli(siloOzet));
    kap.appendChild(kayitPaneli(depo, ozet));
    kap.appendChild(malzemePaneli(depo, ozet, tarih, siloOzet));
    /* Silo Hareketleri + İşlem Geçmişi panelleri, Tüm Hareketler'deki gün
       paneliyle DEĞİŞTİRİLDİ (kullanıcı isteği, 24.08.2026): tek tabloda
       silo + malzeme hareketleri, "Değiştirildi" rozetleri ve — yalnız
       yöneticiye, Şartname §7 gereği — çizili "Silindi" satırları. Eski/yeni
       değer düzeyindeki adım adım denetim izi bu ekrandan çıktı; tam döküm
       #/tum-hareketler ve #/degisiklik-gecmisi ekranlarında durur.
       siloPaneli ve gunIslemGecmisi fonksiyonları yedek olarak duruyor.
       Kaydeden kolonu yazdırmada gizlenir (mevcut kullanıcı direktifi). */
    var hareketPanel = YU.gunHareketPaneli(depo, tarih, YU.yonetici());
    /* Yazdırma düzeltmesi (24.08.2026): yu-baski-bolunur — uzun panel
       .yu-panel'in "break-inside: avoid" kuralına takılıp 1. sayfayı yarım
       bırakıyor, raporu 4 kâğıda taşırıyordu; artık sayfalar arasında satır
       bütünlüğü korunarak bölünür. Tabloya yu-baski-sig: satır/yazı baskıda
       küçülür, kolonlar kâğıda sığar. Yalnız bu ekranın çıktısı etkilenir. */
    hareketPanel.className += ' yu-yazdirmada-kaydedensiz yu-baski-bolunur';
    var hareketTablo = hareketPanel.querySelector('.yu-tablo-sar') || hareketPanel.querySelector('.yu-tablo');
    if (hareketTablo) hareketTablo.className += ' yu-baski-sig';
    kap.appendChild(hareketPanel);
    /* İşlem Geçmişi paneli EKRANDA DEĞİL (kullanıcı kararı, 25.08.2026 —
       "geri çek"): 24.08'deki kaldırma geçerli kaldı. gunIslemGecmisi,
       M29'da eklenen süzgeçleriyle (tarih aralığı + kullanıcı + kayıt türü)
       birlikte YEDEK durur; log sınır uyarıları panele değil üst şerit
       ziline bağlı olduğu için aktif kalır (10-kabuk YU.uyarilar). */
  }

  YU.sayfaTanimla({
    kod: 'gunluk-rapor',   /* kod değişmez — uygulamadaki tüm bağlantılar buna gider */
    zemin: 'gri-duz',   /* Stok Durumu ile aynı: gri zemin, mavi panel (kullanıcı isteği, 24.08.2026) */
    baslik: 'Program Hareketleri',
    baskiBasligi: 'Günlük Üretim ve Hareket Raporu',
    ikon: '#ic-doc',
    /* Sol menüde görünmez (kullanıcı isteği, 24.08.2026); ekrana rapor
       merkezi kartı ve diğer ekranlardaki düğme/bağlantılarla gidilir. */
    grup: null,
    rol: 'Hepsi',
    /* Bu ekran bir GÜNÜN ayrıntısıdır; üst listesi Geçmiş Girişler'dir
       (KURAL 7: gün listesi orada). Sol üstteki geri bağlantısı oraya döner
       (kullanıcı isteği, 25.08.2026) — menüde yeri olmayan bu ekrandan
       çıkışın tek tıklık yolu. */
    geri: { metin: 'GERİ', kod: 'gecmis-girisler' },
    altBaslik: function (param) {
      var t = tarihSec(param);
      return YU.fmt.tarihUzun(t) + ' · ' + YU.fmt.gunAdi(t) +
        (t === YU.tarih.bugun() ? ' · bugün' : '');
    },
    ciz: ciz
  });
})();

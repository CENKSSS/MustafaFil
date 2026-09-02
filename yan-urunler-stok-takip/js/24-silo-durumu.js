/* js/24-silo-durumu.js — Silo Durumu ekranı.
   Şartname §7: "Silo bazında devir / giren / çıkan / mevcut, kapasiteye göre
   doluluk [v2], negatife düşen gün uyarısı [v2]."
   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu).
   SÖZLEŞME §6 (UI imzaları), §9 (sınıf adları).

   Dosya yüklenirken hiçbir şey çizmez; yalnızca YU.sayfaTanimla çağırır. */
(function () {
  'use strict';

  var YU = window.YU;



  /* ------------------------------------------------------------------
     Küçük yardımcılar
     ------------------------------------------------------------------ */

  function gecerliTarih(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  function tarihSec(param) {
    /* Varsayılan tarih HEP BUGÜN (kullanıcı isteği, 24.08.2026 — kampanya
       bakışı bu ekranda uygulanmaz); adresle gelen ?tarih= korunur. */
    return param && gecerliTarih(param.tarih) ? param.tarih : YU.tarih.bugun();
  }

  function raporBagi(tarih) {
    return '#/gunluk-rapor?tarih=' + encodeURIComponent(tarih);
  }

  /* Uzun listede tüm numaralar basılmaz: baş, son ve aktif sayfanın çevresi;
     arada kalan boşluk null ile işaretlenir ve "…" olarak çizilir.
  /* Tarih sütunu yakın günleri sözle yazar (kullanıcı isteği, 24.08.2026):
     bugün "Bugün", dün "Dün", öncesi normal tarih. İki günden eskisi için
  /* D15 eşikleri: kapasitenin üstü kırmızı, %90 üstü kehribar (Şartname §8 D15). */
  function dolulukTur(oran) {
    if (oran > 1) return 'olumsuz';
    if (oran > 0.9) return 'bekleyen';
    return 'vurgu';
  }

  /* Yüzde rozette zaten yazıyor; çubuğun altı kalan kapasiteyi söyler. */
  function dolulukNotu(mevcut, kapasite, oran) {
    if (kapasite <= 0) return 'Kapasite tanımlı değil';
    if (oran > 1) return 'Kapasite ' + YU.fmt.kgU(YU.yuvarla(mevcut - kapasite)) + ' aşıldı';
    var kalan = YU.fmt.kgU(YU.yuvarla(kapasite - mevcut));
    return oran > 0.9 ? 'Kalan kapasite ' + kalan + ' · D15 eşiğine yaklaşıldı' : 'Kalan kapasite ' + kalan;
  }

  function satir(etiket, deger) {
    return YU.h('div', { stil: { display: 'flex', alignItems: 'baseline', gap: '10px' } },
      YU.h('span', { sinif: 'yu-etiket', metin: etiket, stil: { flex: '1', minWidth: '0' } }),
      YU.h('span', { sinif: 'yu-mono', metin: deger })
    );
  }

  /* ------------------------------------------------------------------
     Negatif gün uyarısı (Şartname §7 v2 · D14 motoru)
     ------------------------------------------------------------------ */

  function negatifSerit(negatifler) {
    var serit = YU.ui.serit({
      tur: 'hata',
      baslik: negatifler.length === 1
        ? 'Bir silo bakiyesi geçmişte negatife düşüyor'
        : negatifler.length + ' silo bakiyesi geçmişte negatife düşüyor',
      metin: 'Geriye dönük bir düzeltme sonraki günleri bozmuş olabilir. ' +
        'Satıra tıklayınca o günün Program Hareketleri ekranı açılır.'
    });
    var govde = serit.querySelector('.yu-serit-govde');
    var liste = YU.h('ul');
    var i, n;
    for (i = 0; i < negatifler.length; i++) {
      n = negatifler[i];
      liste.appendChild(YU.h('li', null,
        YU.h('a', {
          sinif: 'yu-mono',
          href: raporBagi(n.tarih),
          metin: (n.siloAd || ('Silo #' + n.siloId)) + ' · ' + YU.fmt.tarih(n.tarih) + ' · ' + YU.fmt.kg(n.bakiye)
        })
      ));
    }
    govde.appendChild(liste);
    return serit;
  }

  /* ------------------------------------------------------------------
     Silo kartları
     ------------------------------------------------------------------ */

  function siloKarti(depo, satirVeri, tarih) {
    var silo = satirVeri.silo;
    var kapasite = satirVeri.kapasite;
    var oran = kapasite > 0 ? satirVeri.mevcut / kapasite : 0;
    var tur = dolulukTur(oran);
    var devir = YU.stok.enSonDevir(depo, 'Silo', silo.Id, tarih);

    /* Yüzde artık silo görselinin ortasında yazıyor (YU.ui.siloSekli);
       başlıkta ayrıca rozet gösterilmez. */
    var bas = YU.h('div', { sinif: 'yu-panel-bas' },
      YU.h('div', { sinif: 'yu-kpi-ikon' }, YU.svg('#ic-building', 15)),
      YU.h('div', { sinif: 'yu-panel-baslik', metin: silo.Ad }),
      silo.Aktif === false ? YU.ui.rozet('Pasif', 'notr') : null
    );

    var bilgi = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px', flex: '1', minWidth: '0' } },
      /* Ton karşılığı satırı kaldırıldı; yalnız kg yazılır (kullanıcı
         isteği, 21.08.2026). */
      YU.h('div', null,
        YU.h('div', { sinif: 'yu-kpi-deger', metin: YU.fmt.kgU(satirVeri.mevcut) })
      ),
      YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '7px' } },
        YU.ui.cubuk(oran, tur),
        YU.h('div', { sinif: 'yu-kpi-alt', metin: dolulukNotu(satirVeri.mevcut, kapasite, oran) })
      ),
      /* "Kapasite … kg · … ton" satırı kaldırıldı (kullanıcı isteği,
         21.08.2026); kapasiteyi "Kalan kapasite" notu anlatmaya devam eder. */
      YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }),
      YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        /* Kartta yalnız DEVİR RAKAMI (kullanıcı isteği, 28.08.2026).
           Önce etikete gömülüydü ("Devir · 22.07.2026"), sonra ayrı satıra
           çıkarıldı; kullanıcı "fazlalık oluyor" deyip kaldırttı. Devir
           tarihi hemen aşağıdaki Silo Bazında Stok tablosunda kendi
           kolonunda duruyor — bilgi kaybolmadı, tekrarı kalktı. */
        satir('Devir', YU.fmt.kgU(satirVeri.devir)),
        satir('Giren', YU.fmt.kgU(satirVeri.giren)),
        satir('Çıkan', YU.fmt.kgU(satirVeri.cikan))
      )
    );

    /* Ana Sayfa kartıyla aynı düzen: solda doluluk görseli, sağda bilgiler. */
    var govde = YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '16px' } },
      YU.ui.siloSekli(oran, kapasite > 0 ? tur : 'notr'),
      bilgi
    );

    return YU.h('div', { sinif: 'yu-panel' }, bas, govde);
  }

  /* toplamSeridi ("Toplam mevcut · dökme / Toplam kapasite / Doluluk / Ton
     karşılığı") KALDIRILDI (kullanıcı isteği, 25.08.2026): aynı rakamlar
     Silo Bazında Stok tablosunun TOPLAM satırında duruyor. */


  /* ------------------------------------------------------------------
     Hareket tablosu — bakiye kümülatif hesaplanır
     ------------------------------------------------------------------ */

  /* Şeridin altındaki çuvallı stok açıklama notu kaldırıldı (kullanıcı
     isteği, 24.08.2026); "· dökme" eki toplamın neyi saydığını söylemeye
     devam ediyor. */

  /* SİLO HAREKETLERİ paneli KALDIRILDI (kullanıcı kararı, 25.08.2026 —
     sadeleştirme). Şartname §7 bu ekrana "silo bazında devir / giren /
     çıkan / mevcut, doluluk, negatife düşen gün uyarısı" der; gün gün
     hareket dökümü Günlük Rapor ekranının işidir. yonHucresi /
     HAREKET_TIP_ADI / siloAdi / siloKullaniciAdi / kaydedenHucresi
     yardımcıları da yalnız bu panele hizmet ettiği için kaldırıldı. */

  /* ------------------------------------------------------------------
     Sayım Düzeltmesi penceresi (DUZELTME-PLANI M18, Şartname §11)
     ------------------------------------------------------------------ */

  /* Kapasite aşımının gerekçeli kabulü (M32) — 21-kuru-kuspe-giris'teki
     pencerenin Sayım Düzeltmesi karşılığı. Engel korunur, kapı açılır. */
  function kapasiteOnayiAc(hatalar, devam) {
    var enAz = (YU.dogrula && YU.dogrula.GEREKCE_ENAZ) || 10;
    var serit = YU.ui.serit({
      tur: 'hata', ikon: '#ic-alert',
      baslik: 'Silo Kapasitesi Aşılıyor',
      metin: 'Bu sayım düzeltmesi siloyu kapasitesinin üstüne çıkarıyor. Rakam yanlışsa ' +
        'düzeltin. Aşım gerçekse gerekçesini yazın — kayıt geçer, gerekçe denetim izine yazılır.'
    });
    serit.className += ' yu-cetin';
    var gerekceAlan = YU.ui.alan({
      etiket: 'Aşımın Gerekçesi (Zorunlu)', tip: 'metin',
      yardim: 'En az ' + enAz + ' karakter. Denetim izinde bu cümle görünecek.'
    });
    var mk = YU.ui.modal({
      baslik: 'Kapasite Aşımını Kabul Et',
      genislik: 600,
      govde: [serit, YU.ui.hataListesi(hatalar, 'uyari'), gerekceAlan.kok],
      dugmeler: [
        { metin: 'Vazgeç · Rakamı Düzelt', tur: 'sade', onClick: function () { mk.kapat(); } },
        {
          metin: 'Aşımı Kabul Et ve Kaydet', ikon: '#ic-alert', tur: 'tehlike',
          onClick: function () {
            var g = String(gerekceAlan.deger() || '').trim();
            if (g.length < enAz) {
              gerekceAlan.hataGoster('Gerekçe en az ' + enAz + ' karakter olmalı. Şu an ' + g.length + '.');
              return;
            }
            mk.kapat();
            devam(g);
          }
        }
      ]
    });
    gerekceAlan.odakla();
  }

  function sayimDuzeltmeAc(depo, silolar, varsayilanTarih) {
    var hataKap = YU.h('div');
    var secenekler = [], i;
    for (i = 0; i < silolar.length; i++) {
      if (silolar[i].Aktif === false) continue;
      secenekler.push({ deger: String(silolar[i].Id), metin: silolar[i].Ad });
    }

    var siloAlan = YU.ui.alan({ etiket: 'Silo', tip: 'secim', secenekler: secenekler,
      deger: secenekler.length ? secenekler[0].deger : '' });
    var tarihAlan = YU.ui.alan({ etiket: 'Tarih', tip: 'tarih', deger: varsayilanTarih });
    var yonAlan = YU.ui.alan({
      etiket: 'Yön', tip: 'secim',
      secenekler: [
        { deger: 'giren', metin: 'Giren — fiili sayım sistemden FAZLA' },
        { deger: 'cikan', metin: 'Çıkan — fiili sayım sistemden EKSİK' }
      ],
      deger: 'giren'
    });
    var miktarAlan = YU.ui.alan({ etiket: 'Miktar', tip: 'sayi', sag: 'kg',
      yardim: 'Sayım farkının mutlak değeri (örn. 1.250).' });
    var aciklamaAlan = YU.ui.alan({ etiket: 'Açıklama (zorunlu)', tip: 'metin',
      yardim: 'Farkın gerekçesi — denetim izinde görünür (örn. "fiili sayım farkı").' });

    var onizleme = YU.h('div', { sinif: 'yu-yardim' });

    function onizle() {
      var id = parseInt(siloAlan.deger(), 10);
      var t = tarihAlan.girdi.value;
      var m = miktarAlan.deger();
      if (!isFinite(id) || !/^\d{4}-\d{2}-\d{2}$/.test(t) || isNaN(m) || m <= 0) {
        onizleme.textContent = 'Gün sonu önizlemesi: silo, tarih ve miktar girilince hesaplanır.';
        return;
      }
      var mevcut = Number(YU.stok.siloStok(depo, id, t).mevcut) || 0;
      var yeni = YU.yuvarla(mevcut + (yonAlan.deger() === 'giren' ? m : -m));
      onizleme.textContent = 'Gün sonu önizlemesi: ' + YU.fmt.kgU(mevcut) + ' → ' + YU.fmt.kgU(yeni) +
        (yeni < 0 ? ' — NEGATİF: kayıt D14 ile reddedilir.' : '');
    }
    siloAlan.girdi.addEventListener('change', onizle);
    tarihAlan.girdi.addEventListener('change', onizle);
    yonAlan.girdi.addEventListener('change', onizle);
    miktarAlan.girdi.addEventListener('input', onizle);
    onizle();

    var m2 = YU.ui.modal({
      baslik: 'Sayım Düzeltmesi (Manuel Hareket)',
      genislik: 520,
      govde: [
        hataKap,
        YU.h('div', { sinif: 'yu-yardim', metin:
          'Fiili sayım ile sistem stoğu arasındaki fark Manuel tipli silo hareketi olarak yazılır ' +
          '(Şartname §6 tip tanımı, §11 sayım/düzeltme kaydı). D14 ileri doğrulama ve D15 kapasite ' +
          'kuralları aynen uygulanır; hareket kuru küspe düzeltmelerinde silinmez.' }),
        siloAlan.kok, tarihAlan.kok, yonAlan.kok, miktarAlan.kok, aciklamaAlan.kok, onizleme
      ],
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m2.kapat(); } },
        { metin: 'Kaydet', tur: 'birincil', onClick: kaydet }
      ]
    });

    function kaydet() {
      yaz(null);

      /* Kapasite aşımı gerekçeli kabul (M32): kayıt YALNIZ D15 yüzünden
         reddedildiyse sert uyarı + zorunlu gerekçe; başka hata varsa
         normal hata listesi gösterilir. */
      function yaz(gerekce) {
        var girdi = {
          tarih: tarihAlan.girdi.value,
          siloId: parseInt(siloAlan.deger(), 10),
          yon: yonAlan.deger(),
          miktar: miktarAlan.deger(),
          aciklama: aciklamaAlan.deger()
        };
        if (gerekce) girdi.kapasiteGerekcesi = gerekce;
        var s = YU.servis.manuelHareketKaydet(depo, girdi, YU.oturum.kullanici);
        if (!s.ok) {
          var yalnizKapasite = s.hatalar.length > 0;
          for (var i = 0; i < s.hatalar.length; i++) if (s.hatalar[i].kod !== 'D15') yalnizKapasite = false;
          /* GEREKÇE PENCERESİ AÇILMAZ (kullanıcı direktifi, 27.08.2026):
             kapasite aşımı artık hiçbir gerekçeyle geçmiyor — hata listesi
             gösterilir, kayıt yapılmaz. Pencere kodu duruyor ki karar geri
             alınırsa bu satır geri gelsin. */
          YU.bos(hataKap).appendChild(YU.ui.hataListesi(s.hatalar, 'hata'));
          return;
        }
        m2.kapat();
        YU.ui.bildir('Sayım düzeltmesi kaydedildi: ' + YU.fmt.kgU(s.kayit.GirenKg || s.kayit.CikanKg) +
          (Number(s.kayit.GirenKg) > 0 ? ' giren' : ' çıkan') + '.', 'basari');
        if (s.uyarilar && s.uyarilar.length) YU.ui.bildir(s.uyarilar[0].mesaj, 'uyari');
        YU.yenile();
      }
    }
  }

  /* ------------------------------------------------------------------
     Silo Bazında Stok tablosu (kullanıcı isteği, 25.08.2026)

     Stok Durumu'ndaki "Malzeme Bazında Stok" tablosunun silo karşılığıdır;
     aynı kolon mantığı silo diliyle kurulur:
       malzeme → silo · üretim → giren · satış → çıkan · stok → mevcut
     Kartlar tek silonun durumunu gösterir; bu tablo üç siloyu yan yana
     okumaya ve toplamı görmeye yarar. Rakamlar YU.stok'tan gelir — formül
     burada yeniden yazılmaz (SÖZLEŞME §5).
     ------------------------------------------------------------------ */

  /* Bayrakla eklenen kolonlar kapalıyken diziye null düşer; YU.ui.tablo
     null'u boş kolon sanır — burada ayıklanır. */
  function hucreVar(h) { return h !== null; }

  function mono(metin, zayif) {
    return YU.h('span', { sinif: 'yu-mono' + (zayif ? ' yu-zayif' : ''), metin: metin });
  }

  function kgHucre(n) {
    if (!n) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    return mono(YU.fmt.kg(n));
  }

  /* Doluluk hücresi: yüzde + çubuk. Kapasite metni ("kapasite 3.000.000 kg")
     hücreden çıkarıldı, ipucuna alındı — tabloyu 12px taşırıyordu ve kapasite
     zaten silo kartında yazıyor. */
  function dolulukHucresi(s) {
    var oran = s.doluluk || 0;
    var kutu = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '0' } },
      YU.h('div', { sinif: 'yu-yardim', stil: { margin: '0' }, metin: YU.fmt.doluluk(oran) }),
      YU.ui.cubuk(oran, dolulukTur(oran))
    );
    kutu.title = 'Kapasite ' + YU.fmt.kgU(s.kapasite) +
      (s.mevcut > s.kapasite ? ' · aşıldı' : ' · kalan ' + YU.fmt.kgU(YU.yuvarla(s.kapasite - s.mevcut)));
    return kutu;
  }

  /* secenek.sag         — panel başlığının SAĞ UCUNA konacak öğe (Ana Sayfa
                          "Tümünü Gör" düğmesini böyle geçirir).
     secenek.baslikYani  — başlığın HEMEN YANINA konacak öğe (Ana Sayfa tarih
                          rozetini böyle geçirir).
     İkisi de verilmezse başlık şeridi eskisi gibi yalın kalır; bu ekranın
     görünümü değişmez. */
  function stokTablosu(depo, satirlar, tarih, secenek) {
    /* DEVİR TARİHİ ARTIK VARSAYILAN AYRI KOLON (kullanıcı bildirimi,
       28.08.2026: "mail ile gönderde görünen raporda devir + devir tarihi
       görünüyor"). 27.08'de ayrı kolon YALNIZ Ana Sayfa'ya verilmişti;
       28.08'de Silo Durumu da eklendi — geriye Mail PDF'i ve Excel kalmıştı:
       paneli bayraksız çağırdıkları için tarih hâlâ rakamın ALTINDA duruyor,
       hemen altındaki Malzeme tablosu ise ayrı kolon gösteriyordu. Varsayılan
       açıldı; eski düzeni isteyen devirTarihiAyri:false geçer. */
    var tarihAyri = !(secenek && secenek.devirTarihiAyri === false);
    /* Seçili günün silo hareketleri tek geçişte haritalanır (silo başına
       yeniden tarama yok) — Stok Durumu'ndaki gunluk haritasının aynısı. */
    var gunluk = {}, sh = depo.siloHareket, i, h, o;
    for (i = 0; i < sh.length; i++) {
      h = sh[i];
      if (h.Tarih !== tarih) continue;
      o = gunluk[h.SiloId] || (gunluk[h.SiloId] = { giren: 0, cikan: 0 });
      o.giren = YU.yuvarla(o.giren + (Number(h.GirenKg) || 0));
      o.cikan = YU.yuvarla(o.cikan + (Number(h.CikanKg) || 0));
    }

    /* Rakamın yanında BİRİMİ yazar (kullanıcı isteği, 28.08.2026: "sadece
       sayı var, kg yazmıyor, Malzeme Bazında Stok gibi yap"). Dil, Malzeme
       Bazında Stok'taki YU.ui.olcu'nun aynısıdır: sayı hücrenin yazı tipini
       sürdürür, birim küçük ve soluk yazılır. Silo dökme küspe tutar, paket
       karşılığı yoktur — tek birim kg, adet satırı yok.
       ORTAK PAYDA (kullanıcı kararı, 28.08.2026: "hepsini ortak paydaya al;
       ana kısım Ana Sayfa'daki olsun"): birim eki artık VARSAYILAN — Ana
       Sayfa, Silo Durumu, Mail PDF'i ve Excel aynı görünür. Kapatmak isteyen
       birimli:false geçer; bugün kimse geçmiyor. */
    var birimli = !(secenek && secenek.birimli === false);

    function deger(n) {
      if (!birimli) return mono(YU.fmt.kg(n));
      return YU.ui.olcu([{ sayi: YU.fmt.kg(n), birim: 'kg' }]);
    }
    function degerHucre(n) {
      if (!n) return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
      return deger(n);
    }
    function degerGuclu(n) {
      if (!birimli) return YU.h('span', { sinif: 'yu-mono yu-guclu', metin: YU.fmt.kg(n) });
      var el = YU.ui.olcu([{ sayi: YU.fmt.kg(n), birim: 'kg' }]);
      /* classList.add — düz atama olcu'nun yu-olcu işaretini siliyordu,
         Excel hücreyi yine metin sanırdı (28.08.2026). */
      el.classList.add('yu-guclu');
      return el;
    }

    var tablo = [], s, devir, gunBasi, g;
    var t = { devir: 0, gunBasi: 0, gunGiren: 0, gunCikan: 0, giren: 0, cikan: 0, mevcut: 0, kapasite: 0 };

    for (i = 0; i < satirlar.length; i++) {
      s = satirlar[i];
      devir = YU.stok.enSonDevir(depo, 'Silo', s.silo.Id, tarih);
      gunBasi = YU.stok.siloGunBasi(depo, s.silo.Id, tarih);
      g = gunluk[s.silo.Id] || { giren: 0, cikan: 0 };

      t.devir = YU.yuvarla(t.devir + s.devir);
      t.gunBasi = YU.yuvarla(t.gunBasi + gunBasi);
      t.gunGiren = YU.yuvarla(t.gunGiren + g.giren);
      t.gunCikan = YU.yuvarla(t.gunCikan + g.cikan);
      t.giren = YU.yuvarla(t.giren + s.giren);
      t.cikan = YU.yuvarla(t.cikan + s.cikan);
      t.mevcut = YU.yuvarla(t.mevcut + s.mevcut);
      t.kapasite = YU.yuvarla(t.kapasite + s.kapasite);

      tablo.push([
        YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' } },
          YU.h('span', { sinif: 'yu-guclu', metin: s.silo.Ad }),
          s.silo.Aktif === false ? YU.ui.rozet('Pasif', 'notr') : null,
          s.mevcut > s.kapasite ? YU.ui.rozet('Kapasite Aşıldı', 'olumsuz') : null
        ),
        /* Devir tarihi AYRI KOLON (varsayılan — bkz. tarihAyri). Eski
           düzen tarihi devrin altına küçük satır olarak koyuyordu; kapatmak
           isteyen devirTarihiAyri:false geçer, o yol aşağıda durur. */
        tarihAyri
          ? degerHucre(s.devir)
          : (devir
              ? YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' } },
                  deger(s.devir),
                  YU.h('span', { sinif: 'yu-yardim', stil: { margin: '0' },
                    metin: YU.fmt.tarih(devir.DevirTarihi) })
                )
              : degerHucre(s.devir)),
        tarihAyri
          ? (devir ? mono(YU.fmt.tarih(devir.DevirTarihi)) : YU.h('span', { sinif: 'yu-zayif', metin: '—' }))
          : null,
        degerHucre(gunBasi),
        degerHucre(g.giren),
        degerHucre(g.cikan),
        degerHucre(s.giren),
        degerHucre(s.cikan),
        degerGuclu(s.mevcut)
      ].filter(hucreVar));
    }

    if (tablo.length > 1) {
      /* toplam:true — koyu zeminli, üstü çizgili TOPLAM satırı
         (kullanıcı isteği, 25.08.2026): veri satırlarından ayrılsın. */
      tablo.push({ toplam: true, hucreler: [
        YU.h('span', { sinif: 'yu-guclu', metin: 'TOPLAM' }),
        degerGuclu(t.devir),
        tarihAyri ? YU.h('span', { metin: '' }) : null,
        degerGuclu(t.gunBasi),
        degerGuclu(t.gunGiren),
        degerGuclu(t.gunCikan),
        degerGuclu(t.giren),
        degerGuclu(t.cikan),
        degerGuclu(t.mevcut)
      ].filter(hucreVar) });
    }

    /* Ana Sayfa rakamı kolon başlığının ORTASINA ister (kullanıcı isteği,
       28.08.2026): başlıklar uzun, sağa yaslı rakam başlığın altında köşede
       kalıyordu. Orta hiza hane sayısından bağımsız ortalar — esnek. Bu ekran
       ve Mail/Excel çıktısı sağa yaslı kalır (KURAL 5.1). */
    /* Orta hiza da VARSAYILAN (ortak payda, 28.08.2026). */
    var hz = (secenek && secenek.hizaOrta === false) ? 'sag' : 'orta';
    var sar = YU.ui.tablo({
      sutunlar: [
        { baslik: 'Silo' },
        { baslik: 'Devir', genislik: 112, hiza: hz, mono: true },
        tarihAyri
          ? { baslik: 'Devir Tarihi', genislik: 100, hiza: hz, mono: true }
          : null,
        { baslik: 'Gün Başı', genislik: 112, hiza: hz, mono: true },
        { baslik: 'Günlük Giren', genislik: 112, hiza: hz, mono: true },
        { baslik: 'Günlük Çıkan', genislik: 112, hiza: hz, mono: true },
        /* 'Kamp. Toplam' -> 'Kampanya Toplam' (kullanıcı isteği,
           28.08.2026): kısaltma tek satıra sığsın diye vardı; artık
           gerektiğinde ALT ALTA sarıyor (yu-baslik-sarar, tema.css),
           mail'e giden PDF'teki dille aynı oldu. Kolon devir tarihinden
           seçili güne kadar sayar, yani KAMPANYA toplamıdır; yanındaki
           'Günlük' kolonlarıyla karışmasın diye kapsam başlığa yazıldı. */
        { baslik: 'Kampanya Toplam Giren', genislik: 138, hiza: hz, mono: true, sinif: 'yu-baslik-sarar' },
        { baslik: 'Kampanya Toplam Çıkan', genislik: 138, hiza: hz, mono: true, sinif: 'yu-baslik-sarar' },
        /* 'Mevcut' -> 'Stok' (kullanıcı isteği, 25.08.2026). */
        /* DOLULUK KOLONU KALDIRILDI (kullanıcı isteği, 28.08.2026: "silo
           durumu, ana sayfa ve raporlarda/PDF'lerde en sağda doluluk oranı
           yazmasın"). Tek tablo dört yerde çiziliyor — Silo Durumu, Ana
           Sayfa, Mail PDF'i ve Excel — kolon burada kalkınca dördünden
           birden kalkar. Doluluk SİLO KARTLARINDA duruyor (aynı ekranın
           üstü: çubuk + yüzde); veri kaybolmadı, yalnız bu tablodan çıktı. */
        { baslik: 'Stok', genislik: 118, hiza: hz, mono: true }
      ].filter(hucreVar),
      satirlar: tablo,
      bos: 'Tanımlı silo yok.',
      yapiskan: true
    });
    /* Stok Durumu'ndaki gibi: on kolon A4'e sığmıyor, baskıda yazı küçülür. */
    sar.className += ' yu-baski-sig';

    var panel = YU.ui.panel({
      baslik: 'Silo Bazında Stok',
      /* Sol menüdeki "Günlük Silo Durumu" ile aynı ikon (kullanıcı isteği,
         25.08.2026): panel hangi ekrandan geldiğini ikonuyla söylesin.
         Bu panel hem Günlük Silo Durumu'nda hem Ana Sayfa'da çizilir —
         ikon iki yerde birden değişir. */
      ikon: '#ic-building',
      /* Panel sağındaki tarih yazısı kaldırıldı (kullanıcı isteği, 25.08.2026):
         hangi güne ait olduğu sayfa alt başlığında zaten yazıyor, tekrardı. */
      dolgusuz: true,
      sag: (secenek && secenek.sag) || null,
      govde: sar
    });

    if (secenek && secenek.baslikYani) {
      var basEl = panel.querySelector('.yu-panel-bas');
      var baslikEl = basEl ? basEl.querySelector('.yu-panel-baslik') : null;
      if (basEl && baslikEl) {
        baslikEl.style.flex = '0 0 auto';
        basEl.insertBefore(secenek.baslikYani, baslikEl.nextSibling);
        var sagEl = basEl.querySelector('.yu-panel-sag');
        if (sagEl) sagEl.style.marginLeft = 'auto';
      }
    }
    return panel;
  }

  /* Ana Sayfa bu paneli aynen gösterir (kullanıcı isteği, 25.08.2026). Açılışta
     bugünü gösterir; başlığın yanındaki rozet hangi güne bakıldığını yazar,
     sağındaki üç düğme günü değiştirir. Tarih KUTUSU yoktur ve sayfa
     değişmez — panel kendi yerinde yeniden çizilir. Bu ekranın kendi tarih
     şeridi olduğu gibi durur. */
  /* baslangicTarih — panelin açılışta göstereceği gün (Mail ile Gönder paneli
     kendi seçtiği günü böyle geçirir, 26.08.2026). Verilmezse bugün. */
  /* panelSecenek.devirTarihiAyri — Ana Sayfa devir tarihini ayrı kolon
     ister (27.08.2026); Mail ve Excel bu parametreyi geçmez, eski düzen. */
  YU.siloStokPaneli = function (baslangicTarih, panelSecenek) {
    if (!YU.db || !YU.db.silolar.length) return null;
    var kap = YU.h('div', { stil: { minWidth: '0' } });

    function ciz(tarih) {
      var son = YU.donem.gorunumSonu();
      var ad = tarih === son
        ? (YU.donem.gecmisMi() ? 'Kampanya Sonu' : 'Bugün')
        : 'Seçili Gün';
      var baslikYani = YU.h('div', {
        stil: { display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 'none' }
      }, YU.ui.tarihRozeti(tarih, ad, { onSec: ciz, enFazla: son }),
         YU.ui.gunGezinme(tarih, ciz));

      /* Panel başlığında düğme YOK (kullanıcı isteği, 26.08.2026): "Yazdır"
         grafiğin altındaki ortak eylem şeridine taşındı, "Veriyi Aç" daha
         önce kalkmıştı. Başlığın yanında yalnız tarih şeridi durur. */
      /* Panelin gösterdiği gün dışarıdan okunabilsin: Excel indirme düğmesi
         ekranda hangi gün açıksa onu dışa aktarır (26.08.2026). */
      kap.setAttribute('data-tarih', tarih);
      YU.bos(kap).appendChild(stokTablosu(YU.db, YU.stok.tumSilolar(YU.db, tarih), tarih, {
        baslikYani: baslikYani,
        /* HAM DEĞER GEÇER (28.08.2026): !! zorlaması bayraksız çağrıyı
           açıkça false yapıyor ve stokTablosu'ndaki "varsayılan açık"
           kuralını eziyordu — Mail/Excel raporu bu yüzden eski düzende
           kalmıştı (ölçüldü). undefined geçerse varsayılan işler. */
        devirTarihiAyri: panelSecenek ? panelSecenek.devirTarihiAyri : undefined,
        /* HAM geçiş: !! zorlaması varsayılanı eziyordu (devirTarihiAyri'de
           yaşandı, 28.08.2026). undefined → stokTablosu varsayılanı işler. */
        hizaOrta: panelSecenek ? panelSecenek.hizaOrta : undefined,
        birimli: panelSecenek ? panelSecenek.birimli : undefined
      }));
    }

    ciz(baslangicTarih || YU.donem.gorunumSonu());
    return kap;
  };

  /* ------------------------------------------------------------------
     Sayfa
     ------------------------------------------------------------------ */

  function ciz(kap, param) {
    var depo = YU.db;
    var tarih = tarihSec(param);
    var silolar = [], i;
    var satirlar = YU.stok.tumSilolar(depo, tarih);

    for (i = 0; i < satirlar.length; i++) silolar.push(satirlar[i].silo);

    /* Tarih seçici sayfa başlığının sağında durur; değişince adres satırı da
       değişsin diye YU.git ile yeniden çizilir (bağlantı paylaşılabilir olur). */
    var tarihAlani = YU.ui.alan({
      tip: 'tarih', deger: tarih, genislik: 158,
      onChange: function () {
        var yeni = tarihAlani.deger();
        if (gecerliTarih(yeni)) YU.git('silo-durumu', { tarih: yeni });
      }
    });
    /* Gün gezinme üçlüsü diğer ekranlarla aynı (kullanıcı isteği, 24.08.2026):
       Önceki Gün · Bugün · Sonraki Gün; Sonraki bugünde pasiftir. */
    function guneGit(iso) {
      YU.git('silo-durumu', { tarih: iso });
    }
    var bugun = YU.tarih.bugun();
    YU.ui.sayfaEylemleri(
      /* SAYIM DÜZELTMESİ DÜĞMESİ KALDIRILDI (kullanıcı isteği, 28.08.2026).
         sayimDuzeltmeAc penceresi ve servis yolu (manuelHareketKaydet) YEDEK
         DURUYOR — kural, doğrulama ve denetim izi aynen işler; yalnız bu
         ekrandan giriş kapısı kapandı. Geri istenirse tek satırla döner. */
      tarihAlani.kok,
      YU.ui.dugme({
        metin: 'Önceki Gün', tur: 'ikincil',
        onClick: function () { guneGit(YU.tarih.ekle(tarih, -1)); }
      }),
      YU.ui.dugme({
        metin: 'Bugün', ikon: '#ic-calendar', tur: 'ikincil',
        onClick: function () { guneGit(bugun); }
      }),
      YU.ui.dugme({
        metin: 'Sonraki Gün', tur: 'ikincil',
        pasif: tarih >= bugun,
        baslik: tarih >= bugun ? 'Bugünden ileri gidilemez' : '',
        onClick: function () { guneGit(YU.tarih.ekle(tarih, 1)); }
      })
    );

    if (!satirlar.length) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-building',
        baslik: 'Tanımlı Silo Yok',
        metin: 'Dökme kuru küspe silolarda durur; silo tanımı olmadan dökme stok hesaplanamaz.'
      }));
      return;
    }

    var negatifler = YU.stok.negatifGunler(depo);
    if (negatifler.length) kap.appendChild(negatifSerit(negatifler));

    var kartlar = YU.h('div', { sinif: 'yu-izgara yu-iz-3' });
    for (i = 0; i < satirlar.length; i++) kartlar.appendChild(siloKarti(depo, satirlar[i], tarih));
    kap.appendChild(kartlar);

    /* Kartlar tek silonun durumunu gösterir; tablo üçünü yan yana okutur
       (kullanıcı isteği, 25.08.2026 — Stok Durumu'ndaki tablo mantığı).
       "Toplam mevcut · dökme / Toplam kapasite / Doluluk / Ton karşılığı"
       şeridi KALDIRILDI (kullanıcı isteği, 25.08.2026): aynı rakamlar
       tablonun TOPLAM satırında duruyor, iki yerde tekrar ediyordu. */
    /* Dökme üretim–satış grafiği TABLONUN ÜSTÜNDE (kullanıcı isteği,
       25.08.2026): önce kampanyanın eğrisi, sonra günün rakamları.
       Silo Hareketleri paneli kalktığı için grafik tam genişlikte durur. */
    var grafik = typeof YU.dokmeGrafikPaneli === 'function' ? YU.dokmeGrafikPaneli() : null;
    if (grafik) kap.appendChild(grafik);

    /* birimli (kullanıcı isteği, 28.08.2026): rakamların yanında "kg" yazar —
       Ana Sayfa ve mail raporundaki dille aynı oldu. */
    /* Ana Sayfa'daki silo tablosunun BİREBİR AYNISI (kullanıcı isteği,
       28.08.2026): devir tarihi ayrı kolon + rakamlar kolon ortasında.
       Bu iki bayrak 27–28.08'de yalnız Ana Sayfa'ya verilmişti (KURAL 5.1);
       kullanıcı iki ekranın eşitlenmesini istedi. birimli (kg eki) bu
       ekranda zaten vardı, korunur. Mail ve Excel çıktısı bayraksız çağırır,
       onlar eski düzeninde kalır. */
    /* Bayrak yok: Ana Sayfa düzeni artık VARSAYILAN (ortak payda,
       28.08.2026) — beş tüketici de aynı tabloyu aynı görünümle alır. */
    kap.appendChild(stokTablosu(depo, satirlar, tarih));
  }

  YU.sayfaTanimla({
    kod: 'silo-durumu',
    baslik: 'Günlük Silo Durumu',
    baskiBasligi: 'Silo Bazında Stok Raporu',   /* "Silo Durumu" → gün bazlı görünüm adı (kullanıcı kararı, 25.08.2026) */
    ikon: '#ic-building',
    /* Menüden kaldırıldı (kullanıcı kararı, 25.08.2026 — sadeleştirme):
       bu ekranın panelleri Ana Sayfa'da aynen duruyor. Sayfa yaşamaya
       devam eder; Ana Sayfa'daki "Tümünü Gör" düğmesi, zil uyarıları ve
       doğrudan adres (#/silo-durumu) buraya getirir. */
    grup: null,
    rol: 'Hepsi',
    /* Alt başlıkta yalnız tarih kalır (kullanıcı isteği, 25.08.2026):
       "dökme kuru küspe toplamı …" rakamı tablonun TOPLAM satırında var. */
    altBaslik: function (param) {
      return YU.fmt.tarih(tarihSec(param)) + ' itibarıyla';
    },
    ciz: ciz
  });
})();

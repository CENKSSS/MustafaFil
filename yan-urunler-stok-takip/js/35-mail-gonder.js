/* js/35-mail-gonder.js — Raporu Mail ile Gönder (kullanıcı isteği, 26.08.2026)

   ŞARTNAME DIŞI EKTİR. §11 "Opsiyonel genişletmeler" (Demirbaş) yalnız dört
   madde sayar: Excel çıktısı, gübre takibi, aylık özet, sayım/düzeltme kaydı.
   Mail bunlarda yok; İade alanı gibi kullanıcı direktifiyle eklenmiştir.
   Hiçbir hesap, doğrulama kuralı ya da tabloya dokunmaz — yalnız okur.

   ---------------------------------------------------------------------
   TEKNİK GERÇEK — panelin bütün tasarımı buradan çıkar
   ---------------------------------------------------------------------
   Program arka uçsuzdur; tarayıcı kendi başına posta gönderemez, şartname
   de ek bağımlılık yasaklar (§10). Elde yalnız mailto: vardır ve mailto ile
   açılan postanın GÖVDESİ DÜZ METİNDİR:
     · görsel, tablo çizgisi, yazı tipi taşımaz,
     · DOSYA EKLEYEMEZ.
   Bu yüzden rapor postaya ek olarak ancak KULLANICI ELİYLE girer.

   Akış buna göre kurulmuştur (kullanıcı kararı, 26.08.2026 —
   "metin düşmeyecek, pdf koyulacak altına da bizim mesajımız"):
     1) Bej kâğıdın ÜSTÜNDE rapor kartı durur: mini görsel + tarih. Kart
        hep açıktır, "Raporu Ekle" düğmesi yoktur.
     2) Kart tıklanınca rapor tam boy açılır (yazdırma görünümü, Ctrl+P ile
        PDF olarak kaydedilir).
     3) Altında ayraç çizgi, onun altında mesaj alanı — kullanıcı yalnız
        kendi yazısını yazar. Gövdeye rapor METNİ yazılmaz.
     4) Gönder: rapor sekmesi açılır ve posta uygulaması mesajla açılır;
        kullanıcı kaydettiği PDF'i postaya iliştirir.

   ALICI LİSTESİ: Kullanicilar tablosunda e-posta alanı yok ve sekiz tablo
   sözleşmesine (Şartname §6) dokunulmaz. Adresler bu yüzden ayrı bir
   localStorage anahtarında durur; depo şemasının parçası değildir. */
(function () {
  "use strict";

  var YU = window.YU;

  var ALICI_ANAHTAR = 'yu.mail.alicilar';
  /* ------------------------------------------------------------------
     Alıcı listesi — depo tablosu DEĞİL, ayrı anahtar
     ------------------------------------------------------------------ */

  function aliciListesi() {
    var ham = null;
    try { ham = window.localStorage.getItem(ALICI_ANAHTAR); } catch (e) { return []; }
    if (!ham) return [];
    var l = null;
    try { l = JSON.parse(ham); } catch (e) { return []; }
    if (Object.prototype.toString.call(l) !== '[object Array]') return [];
    var temiz = [], i;
    for (i = 0; i < l.length; i++) {
      if (l[i] && typeof l[i].adres === 'string' && l[i].adres) {
        temiz.push({ adres: l[i].adres, secili: l[i].secili !== false });
      }
    }
    return temiz;
  }

  function aliciYaz(liste) {
    try { window.localStorage.setItem(ALICI_ANAHTAR, JSON.stringify(liste)); } catch (e) { /* kota — sessiz */ }
  }

  function adresGecerliMi(a) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(a || '').trim());
  }

  /* ------------------------------------------------------------------
     RAPOR = EKRANDAKİ TABLONUN KENDİSİ (kullanıcı isteği, 26.08.2026:
     "yazdırdaki 2. sayfa gibi olmalı").

     Önceden tablolar burada ELLE kuruluyordu ve ekrandakinden dar
     kalıyordu: Silo'da 6 kolon vardı, ekranda 9; Malzeme'de 7 vardı,
     ekranda 10 (Gün Başı, Günlük Giren/Çıkan, Kamp. Toplam… eksikti).
     Artık Ana Sayfa'nın tabloları OLDUĞU GİBİ kopyalanır — rapor,
     yazdırma çıktısının ikinci sayfasıyla kolon kolon aynıdır ve ekran
     tabloları ileride değişirse rapor kendiliğinden onu izler.

     Gün de ekrandan okunur: tablolar Ana Sayfa'da seçili günü gösterir;
     panelde ikinci bir tarih seçici olsaydı tabloları değiştirmediği için
     yanıltırdı. Başka gün isteniyorsa Ana Sayfa'daki tarih değiştirilir.
     ------------------------------------------------------------------ */

  var PANEL_ADI = { silo: 'Silo Bazında Stok', malzeme: 'Malzeme Bazında Stok' };

  /* REVİZE (kullanıcı isteği, 26.08.2026): panelin KENDİ tarih seçicisi var.
     Eskiden tablolar Ana Sayfa'daki canlı panellerden kopyalanıyordu ve gün
     de oradan okunuyordu; o yüzden panelde ikinci bir tarih seçici "yanıltır"
     diye konmamıştı. Artık tablolar seçilen güne göre BURADA üretiliyor
     (YU.siloStokPaneli / YU.malzemeStokPaneli birer tarih alıyor), seçici de
     gerçekten raporu değiştiriyor. Ekranda hangi gün açık olursa olsun rapor
     panelde seçilen günü gösterir. */
  function gununTablosu(anahtar, tarihIso) {
    var kur = anahtar === 'silo' ? YU.siloStokPaneli : YU.malzemeStokPaneli;
    if (typeof kur !== 'function') return null;
    /* Silo tablosunda rakamın yanında BİRİM yazar (kullanıcı isteği,
       28.08.2026: "raporda sadece sayı var, kg mi adet mi belli değil").
       Ana Sayfa'daki panelin taşıdığı bayrağın aynısı; Malzeme tablosu
       birimini zaten kendi taşıyor. Günlük Silo Durumu ekranı bu bayrağı
       almaz, orası eski düzeninde kalır (KURAL 5.1). */
    /* Bayraksız (ortak payda, 28.08.2026): birim, orta hiza ve ayrı devir
       tarihi artık panelin varsayılanı — rapor ekranlarla birebir aynı. */
    var kap = kur(tarihIso);
    if (!kap) return null;
    /* SARICI (.yu-tablo-sar) kopyalanır, ÇIPLAK <table> DEĞİL (kullanıcı
       bildirimi, 28.08.2026: "gönderilen maildeki pdf hizası çok kötü").
       SEBEP bulundu: Malzeme Bazında Stok tablosu A4'e sığması için
       kendi sarıcısına .yu-baski-sig sınıfı taşır (23-stok-durumu.js,
       kolon taşmasını önleyen kural tema.css @media print'te). Eskiden
       yalnız iç <table> alınıyor, bu sınıf hiç kopyaya girmiyordu —
       kâğıtta kolonlar taşıyordu. Sarıcı alınınca sınıf da onunla gelir. */
    var t = kap.querySelector('.yu-tablo-sar');
    return t ? { tablo: t, panel: kap } : null;
  }

  /* Tabloyu kopyalar ve yazdırmaya girmeyecek parçaları söker. */
  function tabloKopyasi(tablo) {
    var k = tablo.cloneNode(true), i;
    var atilacak = k.querySelectorAll('button, .yu-satir-eylem, .yu-baski-yok, svg');
    for (i = atilacak.length - 1; i >= 0; i--) {
      if (atilacak[i].parentNode) atilacak[i].parentNode.removeChild(atilacak[i]);
    }
    k.removeAttribute('style');
    /* "Kamp." -> "Kampanya" metin dönüşümü KALKTI (kullanıcı isteği,
       28.08.2026): kaynak tablo artık HER YERDE "Kampanya" yazıyor
       (23-stok-durumu.js / 24-silo-durumu.js) — kopyada ayrıca çevirmeye
       gerek kalmadı, tek kaynaktan geliyor. */

    /* YAVRU SATIR ("Dökmeden Çuvallıya Çevrilen, Üretimden Düşülür") TEK
       SATIRDA KALIR — YALNIZ BU RAPOR KOPYASINDA (kullanıcı isteği,
       28.08.2026). Kâğıtta bu metin dar Malzeme kolonuna (184px, tema.css
       .yu-baski-sig) sığmadığı için 26.08.2026'da ALT ALTA sarması
       kararlaştırılmıştı — tek satır yapmak için kolonu genişletmek TÜM
       tabloyu A4'ün dışına taşırdı (aynı, daha önce düzeltilen taşma
       hatası). Bunun yerine bu satırın İLK HÜCRESİ, hep BOŞ olan sonraki
       dört hücreyi (Devir, Devir Tarihi, Gün Başı, Kampanya Toplam İade)
       colspan ile kendi üstüne alır — yalnız BU SATIRDA, yalnız kâğıtta.
       Diğer satırların Malzeme kolonu (ve ekrandaki hâli) hiç etkilenmez;
       metne artık ~700px yer açılır, 13.5px'te tek satıra rahatça sığar. */
    var yavruSatirlar = k.querySelectorAll('tr.yu-satir-yavru');
    for (i = 0; i < yavruSatirlar.length; i++) {
      var hucreler = [].slice.call(yavruSatirlar[i].children);
      if (hucreler.length < 5) continue;   /* beklenmeyen kolon sayısı — dokunma */
      hucreler[0].colSpan = 5;
      /* tema.css'teki geniş kural (.yu-baski-sig tbody td:first-child *)
         hücrenin İÇİNDEKİ span'ı da doğrudan hedef alıyor — yalnız td'ye
         nowrap yazmak yetmez, o span kendi başına yine sarardı. Her iki
         düğüme de yazılır. */
      hucreler[0].style.setProperty('white-space', 'nowrap', 'important');
      var icDugumler = hucreler[0].querySelectorAll('*');
      for (var d = 0; d < icDugumler.length; d++) {
        icDugumler[d].style.setProperty('white-space', 'nowrap', 'important');
      }
      for (var s = 4; s >= 1; s--) yavruSatirlar[i].removeChild(hucreler[s]);
    }
    return k;
  }

  function raporBolumleri(secim, tarihIso) {
    var b = [], anahtarlar = ['silo', 'malzeme'], i, bul;
    for (i = 0; i < anahtarlar.length; i++) {
      if (!secim[anahtarlar[i]]) continue;
      bul = gununTablosu(anahtarlar[i], tarihIso);
      if (bul) b.push({ ad: PANEL_ADI[anahtarlar[i]], tablo: tabloKopyasi(bul.tablo) });
    }
    return b;
  }

  function konuMetni(tarihMetni) {
    return 'Yan Ürünler · Günlük Stok Durumu · ' + tarihMetni;
  }

  /* ------------------------------------------------------------------
     SUNUCUDAN GÖNDERİM (kullanıcı kararı, 28.08.2026)
     ------------------------------------------------------------------
     mailto: dosya ekleyemez — bu, protokolün sınırıdır, eksik kod değil
     (dosya başındaki nota bak). Kullanıcı "mailde raporun PDF hali olsun"
     dediği için postayı SUNUCU gönderir: tarayıcı ekrandaki tabloların
     METNİNİ yollar, sunucu onu PDF'e dizip SMTP ile postalar.

     HESAP YİNE İSTEMCİDE: sunucuya rakam değil, ekranda ne yazıyorsa o
     gider. Kural iki yerde durmaz (06-uzak.js'teki aynı gerekçe).

     Sunucu yoksa (ör. dosyadan ya da basit bir statik sunucudan açıldıysa)
     /api/mail/durum'a ulaşılamaz; o zaman rapor PDF olarak İNDİRİLİR,
     hiçbir posta uygulaması AÇILMAZ (kullanıcı direktifi, 28.08.2026:
     "outlook hiç açılmamalı") — kullanıcı dosyayı kendi programına ekler. */

  /* Sunucu durumu ÜÇ HÂLDEN biridir (28.08.2026):
       postali   — SMTP ayarlı: posta doğrudan sunucudan, PDF ekli gider.
       pdfli     — sunucu var ama SMTP ayarı yok: PDF'i sunucu üretir,
                   tarayıcı indirir, kullanıcı Outlook'a sürükler.
       yok       — arka uç hiç yok (ör. basit statik sunucu): eski akış,
                   rapor sekmesi açılır, Ctrl+P ile PDF kaydedilir.
     ÖNEMLİ: kullanıcı hangi hâlde olduğunu ekranda GÖRÜR. Eskiden program
     sessizce "yok" hâline düşüyor, Outlook eksiz açılıyor ve sebebi hiçbir
     yerde yazmıyordu (kullanıcı bildirimi, 28.08.2026). */
  var sunucuDurumu = null;   /* null = sorulmadı */
  var mailHesabi = null;     /* bağlıysa { adres, sunucu, port, ssl } */

  /* TEK MASTER HESAP (kullanıcı direktifi, 28.08.2026: "bu hesap programı
     kullanan tüm kullanıcılarda tanımlı olmalı"). Ekran kullanıcısına göre
     ayrışan bir kimlik YOK — kullanici alanı hep boş gider, sunucu bunu
     ortak anahtara ("_ortak", MailHesabi.cs) eşler. Hesap NEREDE
     YÖNETİLİR: Yönetim Paneli › Mail Hesabı (js/37-mail-hesabi.js, yalnız
     Yönetici). Bu dosyadaki gönderme paneli hesaba DOKUNMAZ, yalnız
     bağlı olup olmadığını okur. */
  function sunucuKipi(tazele) {
    if (sunucuDurumu !== null && !tazele) return Promise.resolve(sunucuDurumu);
    if (typeof fetch !== 'function') { sunucuDurumu = 'yok'; return Promise.resolve(sunucuDurumu); }
    return fetch('api/mail/durum', { cache: 'no-store' })
      .then(function (c) { return c.ok ? c.json() : null; })
      .then(function (g) {
        mailHesabi = g ? (g.hesap || null) : null;
        if (!g) sunucuDurumu = 'yok';
        else if (g.hazir) sunucuDurumu = 'postali';
        /* pencere/pdfli ayrımı yalnız yönetim ekranı için anlamlıdır;
           gönderme paneli ikisini de aynı "bağlı değil" gibi ele alır. */
        else sunucuDurumu = g.pencere ? 'pencere' : 'pdfli';
        return sunucuDurumu;
      })
      .catch(function () { sunucuDurumu = 'yok'; mailHesabi = null; return sunucuDurumu; });
  }

  /* ------------------------------------------------------------------
     PAYLAŞILAN MAIL HESABI API'Sİ — hem bu dosyanın gönderme paneli, hem
     de js/37-mail-hesabi.js (Yönetim Paneli) burayı kullanır. Tek kaynak:
     fetch mantığı iki yerde ayrı yazılmaz.
     ------------------------------------------------------------------ */

  function mailHesapTahmin(adres) {
    return fetch('api/mail/hesap/tahmin?adres=' + encodeURIComponent(adres), { cache: 'no-store' })
      .then(function (c) { return c.ok ? c.json() : null; })
      ['catch'](function () { return null; });
  }

  function mailHesapCevapCoz(c) {
    return c.text().then(function (m) {
      var g = null;
      if (m) { try { g = JSON.parse(m); } catch (e) { g = null; } }
      return { kod: c.status, govde: g };
    });
  }

  function mailHesapGirisYap(bilgi) {
    return fetch('api/mail/hesap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bilgi)
    }).then(mailHesapCevapCoz);
  }

  function mailHesapCikisYap() {
    return fetch('api/mail/hesap', { method: 'DELETE' }).then(mailHesapCevapCoz);
  }

  /* Bağlantıyı CANLI sınar: sunucu, KAYITLI parolayla gerçek bir test
     postası gönderir. Bilerek pahalı bir çağrı — yalnız yönetim
     ekranındaki "Bağlantıyı Sına" düğmesi çağırır, gönderme paneli
     otomatik tetiklemez. */
  function mailHesapSina() {
    return fetch('api/mail/hesap/sina', { method: 'POST' }).then(mailHesapCevapCoz);
  }

  YU.mailHesap = {
    kip: sunucuKipi,
    /* En son sunucuKipi() çağrısının bıraktığı hesap bilgisi (adres,
       sunucu, port). js/37-mail-hesabi.js künyeyi burada okur — durum
       sorgusu iki yerde ayrı yazılmaz. */
    hesap: function () { return mailHesabi; },
    tahmin: mailHesapTahmin,
    girisYap: mailHesapGirisYap,
    cikisYap: mailHesapCikisYap,
    sina: mailHesapSina
  };

  /* Tablodan düz veri: başlıklar, satırlar ve hiza. Gizlenmiş satır
     (ör. kapatılmış yavru satır) ATLANIR — kâğıtta da görünmemeli. */
  function tabloVerisi(tablo) {
    var sutunlar = [], sagaYasli = [], satirlar = [];
    var basSatir = tablo.querySelector('thead tr');
    var i, j, h, tr, td, satir;
    if (basSatir) {
      for (i = 0; i < basSatir.cells.length; i++) {
        h = basSatir.cells[i];
        sutunlar.push(duzMetin(h));
        sagaYasli.push(String(h.className).indexOf('yu-sag') >= 0);
      }
    }
    var govdeSatirlari = tablo.querySelectorAll('tbody tr');
    for (i = 0; i < govdeSatirlari.length; i++) {
      tr = govdeSatirlari[i];
      if (tr.style && tr.style.display === 'none') continue;
      satir = [];
      for (j = 0; j < tr.cells.length; j++) {
        td = tr.cells[j];
        satir.push(td.style && td.style.display === 'none' ? '' : duzMetin(td));
      }
      satirlar.push(satir);
    }
    return { sutunlar: sutunlar, sagaYasli: sagaYasli, satirlar: satirlar };
  }

  /* Hücrenin metni: iç içe span'lar tek boşlukla birleşir ("1.000 kg"). */
  function duzMetin(hucre) {
    var parca = [];
    (function gez(n) {
      var i;
      if (n.nodeType === 3) {
        var t = String(n.textContent).replace(/\s+/g, ' ').trim();
        if (t) parca.push(t);
        return;
      }
      for (i = 0; i < n.childNodes.length; i++) gez(n.childNodes[i]);
    })(hucre);
    return parca.join(' ');
  }

  /* ACİL DURUM YEDEĞİ — gerçek tema.css HENÜZ YÜKLENMEDİYSE kullanılır
     (aşağıya bak). Normal akışta hiç devreye girmez. */
  var BASKI_STIL_YEDEK =
    'body{font:14px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:24px}' +
    'h1{font-size:19px;margin:0 0 4px}h2{font-size:15px;margin:26px 0 8px}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px 9px;text-align:left;font-size:13px}' +
    'th.yu-sag,td.yu-sag{text-align:right}th.yu-orta,td.yu-orta{text-align:center}';

  /* GERÇEK UYGULAMA CSS'İ (kullanıcı bildirimi, 28.08.2026: "gönderilen
     maildeki pdf hizası çok kötü, yazdır butonunda çıkan yapı incelensin,
     bu şekilde oluşturulsun"). Ana Sayfa'daki "Yazdır" düğmesi window.print()
     çağırır ve TARAYICININ ZATEN YÜKLÜ OLDUĞU css/tema.css'i kullanır —
     tüm .yu-tablo/.yu-sag/.yu-mono/TOPLAM satırı stilleri, renkler,
     @media print kuralları oradan gelir. Bu panelin raporu ise AYRI bir
     mini belgeydi (yeni pencere / sunucuya giden HTML) ve o belgede
     tema.css HİÇ YOKTU — yerine yukarıdaki birkaç satırlık kaba BASKI_STIL
     kullanılıyordu (border:1px solid #bbb, düz th/td). Sonuç: gerçek
     "Yazdır" çıktısı ile mail'e giden PDF hiç aynı görünmüyordu.

     ÇÖZÜM: tema.css'in TAM METNİ bir kez indirilip burada saklanır ve o
     mini belgenin <style>'ına AYNEN gömülür — artık iki çıktı da AYNI
     kaynaktan besleniyor, biri değişince öbürü kendiliğinden izliyor. */
  var temaCssMetni = null;
  var temaCssP = (typeof fetch === 'function' ? fetch('css/tema.css') : Promise.reject())
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (t) { temaCssMetni = t; return t; })
    ['catch'](function () { return null; });

  /* Gönderim/indirme yollarınca beklenir: gerçek CSS henüz gelmediyse
     bekler, PDF hiçbir zaman kaba yedekle ÜRETİLMEZ. Yalnız CANLI ÖNİZLEME
     (mini kart, "Raporu Görüntüle" popup'ı) elindeki en son değeri anında
     kullanır — çoğunlukla zaten hazırdır, sayfa açılır açılmaz indirilir. */
  function temaCssHazir() {
    return temaCssMetni !== null ? Promise.resolve(temaCssMetni) : temaCssP;
  }

  function raporHtml(tarihMetni, secim, tarihIso, cssMetni) {
    var bolumler = raporBolumleri(secim, tarihIso), i;
    var donem = YU.donem && YU.donem.aktif ? YU.donem.aktif() : null;
    var ustBaslik = 'Günlük Stok Durumu · ' + tarihMetni;
    var govde = '';
    for (i = 0; i < bolumler.length; i++) {
      govde += '<h2>' + bolumler[i].ad + '</h2>' + bolumler[i].tablo.outerHTML;
    }
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8">' +
      '<title>' + ustBaslik + '</title><style>' + (cssMetni || temaCssMetni || BASKI_STIL_YEDEK) +
      /* Gerçek tema.css'in ÜSTÜNE eklenen birkaç satır: kâğıt ölçüsü,
         başlık/tarih tipografisi ve "yalnız ekranda" yönergesi — bunlar
         tema.css'te yok (o, uygulamanın kendi çerçevesini varsayar),
         burada rapor bir BELGE olduğu için ayrıca yazılır. Kâğıt ölçüsü
         AÇIKÇA A4 (kullanıcı isteği, 28.08.2026 — postadaki PDF ile
         Ctrl+P çıktısı BİREBİR aynı olsun): yazılmazsa sunucudaki yazdırma
         motoru Letter varsayardı. tema.css'in @media print'teki
         "body{padding:11mm 12mm}" kuralı buradaki @page kenar boşluğuyla
         ÇAKIŞMASIN diye 0'a çekilir — ikisi toplanırsa kenar boşluğu
         iki katına çıkardı (ölçüldü). */
      '@page{size:A4;margin:12mm}' +
      'h1{font:700 19px/1.3 var(--font);color:var(--metin);margin:0 0 4px}' +
      'h2{font:600 15px/1.3 var(--font);color:var(--metin);margin:26px 0 10px}' +
      'p.not{font:400 13px/1.5 var(--font);color:var(--metin-3);margin:0 0 18px}' +
      '@media print{body{padding:0;margin:0}.yalniz-ekran{display:none}}' +
      '</style></head><body>' +
      '<h1>' + ustBaslik + '</h1>' +
      '<p class="not">' + (donem ? '<span>Kampanya ' + donem.ad + '</span>' : '') +
      '<span class="yalniz-ekran">' + (donem ? ' · ' : '') +
      'PDF için Ctrl+P → Hedef: "PDF olarak kaydet".</span></p>' +
      govde + '</body></html>';
  }

  function raporuAc(tarihMetni, secim, tarihIso) {
    var pencere = window.open('', '_blank');
    if (!pencere) {
      YU.ui.bildir('Tarayıcı yeni sekmeyi engelledi. Adres çubuğundaki engeli kaldırın.', 'hata');
      return null;
    }
    pencere.document.open();
    pencere.document.write(raporHtml(tarihMetni, secim, tarihIso));
    pencere.document.close();
    return pencere;
  }

  /* ------------------------------------------------------------------
     Panel
     ------------------------------------------------------------------ */

  YU.mailPaneli = function () {
    /* Panelin KENDİ günü (kullanıcı isteği, 26.08.2026). Açılışta bugün;
       projedeki standart tarih rozeti + Önceki/Bugün/Sonraki üçlüsüyle
       değişir ve rapor da o güne göre yeniden kurulur. */
    var seciliTarih = YU.donem && YU.donem.gorunumSonu ? YU.donem.gorunumSonu() : YU.tarih.bugun();
    function tarihMetniniAl() { return YU.fmt.tarih(seciliTarih); }

    /* İMZA (kullanıcı isteği, 28.08.2026): gönderilen mesajın SONUNA, o an
       PROGRAMA giriş yapan kişinin ad soyadı eklenir — hesap Gmail'i kim
       bağladıysa değil, ekranda kim oturum açtıysa o (Ahmet girdiyse
       Ahmet'in adı). Kutuda GÖRÜNMEZ (kullanıcı düzeltmesi, aynı gün:
       "burada gözükmesin"): kullanıcı istediğini yazar, imza yalnız
       GÖNDERİLİRKEN metnin sonuna eklenir — gerçekten en son satır olur,
       boş kutuda tuhaf durmaz. */
    function mesajMetni() {
      var yazilan = String(mesajAlani.value).replace(/\s+$/, '');
      var k = YU.oturum && YU.oturum.kullanici;
      var adSoyad = k ? String(k.AdSoyad || '').trim() : '';
      if (!adSoyad) return yazilan;
      /* "Gönderen : Ad Soyad" biçimi (kullanıcı isteği, 28.08.2026) —
         yalnız isim değil, kim gönderdiği açıkça söylenir. */
      var imza = 'Gönderen : ' + adSoyad;
      return yazilan ? (yazilan + '\n\n' + imza) : imza;
    }
    var alicilar = aliciListesi();
    var secim = { silo: true, malzeme: true };
    var gonderDugmesi = null;
    var modal = null;

    /* ---------------- sol sütun: alıcılar ---------------- */

    var aliciKap = YU.h('div', {
      stil: { display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '380px', overflowY: 'auto' }
    });

    function seciliAdresler() {
      var l = [], i;
      for (i = 0; i < alicilar.length; i++) if (alicilar[i].secili) l.push(alicilar[i].adres);
      return l;
    }

    function aliciListesiniCiz() {
      YU.bos(aliciKap);
      for (var i = 0; i < alicilar.length; i++) {
        (function (a, sira) {
          var kutu = YU.h('input', { tip: 'checkbox' });
          kutu.type = 'checkbox';
          kutu.checked = !!a.secili;
          kutu.addEventListener('change', function () {
            a.secili = kutu.checked;
            aliciYaz(alicilar);
            durumuTazele();
          });
          var sil = YU.h('span', {
            sinif: 'yu-satir-eylem', role: 'button', tabindex: '0',
            title: 'Adresi listeden çıkar',
            onClick: function () {
              alicilar.splice(sira, 1);
              aliciYaz(alicilar);
              aliciListesiniCiz();
              durumuTazele();
            }
          }, YU.svg('#ic-trash', 15));
          aliciKap.appendChild(YU.h('label', {
            stil: {
              display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
              padding: '7px 9px', borderRadius: 'var(--r-s)', background: 'var(--yuzey-2)',
              border: '1px solid var(--kenar)', minWidth: '0'
            }
          },
            kutu,
            YU.h('span', {
              stil: { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
              metin: a.adres
            }),
            sil));
        })(alicilar[i], i);
      }
    }

    var adresAlan = YU.ui.alan({ tip: 'metin', yerTutucu: 'ad@fabrika.com', genislik: 210 });
    var ekleDugmesi = YU.ui.dugme({
      metin: '', ikon: '#ic-plus', tur: 'birincil',
      baslik: 'Adresi listeye ekle (Enter da olur)',
      onClick: function () {
        var adres = String(adresAlan.girdi.value).trim();
        if (!adresGecerliMi(adres)) {
          adresAlan.hataGoster('Geçerli bir e-posta adresi yazın (örnek: ad@fabrika.com).');
          return;
        }
        for (var i = 0; i < alicilar.length; i++) {
          if (alicilar[i].adres.toLowerCase() === adres.toLowerCase()) {
            adresAlan.hataGoster('Bu adres listede zaten var.');
            return;
          }
        }
        adresAlan.hataGoster('');
        alicilar.push({ adres: adres, secili: true });
        aliciYaz(alicilar);
        adresAlan.girdi.value = '';
        aliciListesiniCiz();
        durumuTazele();
      }
    });
    adresAlan.girdi.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); ekleDugmesi.click(); }
    });

    /* ---------------- sağ sütun: rapor kartı + mesaj ---------------- */

    /* Rapor günü SEÇİLMEZ, ekrandan okunur: tablolar Ana Sayfa'da hangi
       gün seçiliyse onu gösteriyor. Panelde ayrı bir tarih kutusu olsaydı
       tabloları değiştirmediği için yanıltırdı (26.08.2026). */

    /* MİNİ GÖRSEL: sahte bir simge değil, raporun KENDİSİ küçültülür.
       Tıklayınca tam boy açılır. */
    var miniIc = YU.h('div', {
      stil: {
        position: 'absolute', top: '0', left: '0', width: '460px',
        /* Ölçek kutuyla birlikte büyüdü (kullanıcı isteği, 26.08.2026):
           .235 -> .335 -> .44, kutu 112 -> 160 -> 210px.
           Ölçek kutuyla BİRLİKTE büyümeli: yalnız kutu genişletilseydi
           içerik aynı kalıp sağında beyaz boşluk oluşurdu.
           460 × .44 = 202px, 210px'lik kutuya sığar. */
        transform: 'scale(.44)', transformOrigin: 'top left',
        font: '400 11px/1.35 Arial, Helvetica, sans-serif', color: '#111', padding: '10px'
      }
    });
    var miniKap = YU.h('div', {
      stil: {
        width: '210px', height: '150px', flex: 'none', overflow: 'hidden',
        background: '#ffffff', border: '1px solid #c9c0a8', borderRadius: '4px',
        position: 'relative', cursor: 'pointer'
      },
      title: 'Raporu tam boy aç — yazdırma görünümü'
    }, miniIc);

    /* Kart yazıları bir kademe büyük (kullanıcı isteği, 26.08.2026):
       13.5 -> 16, 12 -> 13.5. Mini görsel de aynı oranda büyüdü. */
    var kartBaslik = YU.h('div', { stil: { font: '600 16px/1.3 var(--font)', color: '#2a2620' } });
    var kartAlt = YU.h('div', { stil: { font: '400 13.5px/1.4 var(--font)', color: '#7d7566', marginTop: '4px' } });
    var kartBag = YU.h('span', {
      role: 'button', tabindex: '0',
      stil: {
        font: '400 13.5px/1 var(--font)', color: 'oklch(0.55 0.14 250)',
        cursor: 'pointer', textDecoration: 'underline', marginTop: '11px', display: 'inline-block'
      },
      metin: 'Raporu Görüntüle'
    });

    function kartiAc() { raporuAc(tarihMetniniAl(), secim, seciliTarih); }
    miniKap.addEventListener('click', kartiAc);
    kartBag.addEventListener('click', kartiAc);
    kartBag.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kartiAc(); }
    });

    var raporKarti = YU.h('div', {
      stil: { display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '15px 16px' }
    }, miniKap, YU.h('div', { stil: { minWidth: '0', flex: '1' } }, kartBaslik, kartAlt, kartBag));

    /* Kartı mesajdan ayıran çizgi (kullanıcı isteği). Bej kâğıt üstünde 1px
       #d3c9b0 neredeyse seçilmiyordu; 2px ve bir tık koyu tona çekildi,
       kenardan kenara uzatıldı — iki bölüm net ayrılsın (26.08.2026). */
    var ayrac = YU.h('div', { stil: { height: '2px', background: '#a89878', margin: '0' } });

    /* Mesaj alanı bej kâğıdın ALT yarısıdır; kendi çerçevesi yok, kâğıdın
       parçası gibi durur ("altına da bizim mesajımız"). */
    var mesajAlani = YU.h('textarea', {
      stil: {
        width: '100%', boxSizing: 'border-box', resize: 'vertical',
        border: 'none', outline: 'none', background: 'transparent',
        /* 148 -> 370px (kullanıcı isteği, 26.08.2026: "mesaj alanını da
           aşağı doğru uzat"). Ölçüldü: 280px'te alt bar ile arasında
           98px boş kalıyordu, o da mesaj alanına verildi.
           resize: vertical duruyor — isteyen daha da
           uzatabilir. Pencere büyüyor ama .yu-modal 100vh-48px ile sınırlı,
           alçak ekranda gövde kendi içinde kayar. */
        padding: '12px 14px 14px', height: '370px',
        font: '400 15px/1.55 var(--font)', color: '#2a2620'
      }
    });
    mesajAlani.placeholder = 'Mesajınızı buraya yazın…';
    mesajAlani.spellcheck = false;

    mesajAlani.addEventListener('input', function () { durumuTazele(); });

    var kagit = YU.h('div', {
      sinif: 'yu-mesaj-kutusu',
      stil: { borderRadius: 'var(--r-s)', overflow: 'hidden' }
    }, raporKarti, ayrac, mesajAlani);

    function kartiTazele() {
      var tarihMetni = tarihMetniniAl();
      var bolumler = raporBolumleri(secim, seciliTarih);
      kartBaslik.textContent = tarihMetni + ' · Günlük Stok Durumu';
      kartAlt.textContent = bolumler.length
        ? bolumler.map(function (b) { return b.ad; }).join(' + ')
        : 'Tablo seçilmedi — rapor boş';
      kartBag.style.display = bolumler.length ? 'inline-block' : 'none';
      /* Mini görselde ilk bölümün başı görünür; kartın işi raporun NE
         OLDUĞUNU göstermek, tamamını okutmak değil. */
      YU.bos(miniIc);
      if (bolumler.length) {
        miniIc.appendChild(YU.h('div', {
          stil: { font: '700 13px/1.3 Arial', margin: '0 0 7px' },
          metin: tarihMetni + ' · Günlük Stok Durumu'
        }));
        var stilEl = document.createElement('style');
        /* Mini kart yalnız 210×150px'lik bir küçük resim (%44 ölçek) —
           gerçek tema.css'i burada tekrar yüklemek gereksiz ağırlık;
           kaba yedek stil bu boyutta zaten yeterince okunur kalıyor. */
        stilEl.textContent = BASKI_STIL_YEDEK;
        miniIc.appendChild(stilEl);
        miniIc.appendChild(bolumler[0].tablo);
      } else {
        miniIc.appendChild(YU.h('div', {
          stil: { font: '400 13px/1.4 Arial', color: '#999' },
          metin: 'Tablo seçilmedi'
        }));
      }
      durumuTazele();
    }

    /* MESAJ ZORUNLU DEĞİL (kullanıcı isteği, 26.08.2026: "yazı yazmadan da
       gönder kısmı olsun"). Tek şart en az bir alıcı seçili olması;
       mesaj boş bırakılırsa posta yalnız rapor satırıyla açılır. */
    function durumuTazele() {
      var kac = seciliAdresler().length;
      if (!gonderDugmesi) return;
      gonderDugmesi.disabled = kac === 0;
      gonderDugmesi.title = kac === 0
        ? 'Önce en az bir alıcı seçin'
        : (sunucuDurumu === 'postali'
            ? 'Posta doğrudan sunucudan gider, rapor PDF olarak ekte'
            : 'Mail hesabı tanımlı değil — rapor PDF olarak iner (Yönetim Paneli › Mail Hesabı)');
    }

    /* ---------------- eylemler ---------------- */

    /* Gövdeye rapor METNİ yazılmaz (kullanıcı kararı): yalnız kullanıcının
       mesajı gider. Otomatik "— … raporu (…) ekte —" satırı da KALKTI
       (kullanıcı isteği, 28.08.2026): tarih ve rapor adı zaten konu
       satırında yazıyor, gövdede ikinci kez tekrarlanıyordu. Gövde artık
       yalnız kullanıcının yazdığıdır; boşsa boş gider. */
    function mailiAc() {
      var adresler = seciliAdresler();
      if (!adresler.length) return;
      /* KESİN KURAL (kullanıcı direktifi, 28.08.2026: "outlook hiç
         açılmamalı"): programın kendisi HİÇBİR koşulda bir posta
         uygulaması açmaz. Hesap girilmişse doğrudan gönderilir; hesap
         yoksa yalnız PDF iner, kullanıcı onu kendi mail programından
         kendisi ekler — otomatik pencere/mailto tetiklenmez. */
      sunucuKipi().then(function (kip) {
        if (kip === 'postali') sunucudanGonder(adresler);
        else pdfIndirVeAc(adresler);
      });
    }

    /* HESAP YOKKEN TEK YOL — rapor PDF'i sunucuda (Ctrl+P ile aynı
       motorla) üretilir ve DOSYA OLARAK İNER. Hiçbir posta uygulaması
       AÇILMAZ (kullanıcı direktifi, 28.08.2026: "outlook hiç açılmamalı");
       kullanıcı inen dosyayı istediği posta programına kendi ekler. */
    function pdfIndirVeAc(adresler) {
      var tarihMetni = tarihMetniniAl();
      var dosyaAdi = 'Gunluk-Stok-Durumu-' + seciliTarih + '.pdf';
      var eskiMetin = gonderDugmesi ? gonderDugmesi.textContent : '';
      if (gonderDugmesi) { gonderDugmesi.disabled = true; gonderDugmesi.textContent = 'PDF hazirlaniyor...'; }

      /* Gerçek tema.css BEKLENİR (kullanıcı bildirimi, 28.08.2026: "hizası
         çok kötü") — bu PDF kullanıcının eline geçecek gerçek dosya; kaba
         yedek stille asla üretilmez, gecikirse birkaç yüz milisaniye beklenir. */
      temaCssHazir().then(function (css) {
      fetch('api/rapor/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: raporHtml(tarihMetni, secim, seciliTarih, css),
          bolumler: raporVerisi(),
          baslik: 'Gunluk Stok Durumu - ' + tarihMetni,
          altBaslik: donemAltBasligi(),
          dosyaAdi: dosyaAdi
        })
      }).then(function (c) {
        if (!c.ok) throw new Error('sunucu ' + c.status);
        return c.blob();
      }).then(function (blob) {
        if (gonderDugmesi) gonderDugmesi.textContent = eskiMetin;
        durumuTazele();
        var url = URL.createObjectURL(blob);
        var bag = document.createElement('a');
        bag.href = url; bag.download = dosyaAdi;
        document.body.appendChild(bag); bag.click(); document.body.removeChild(bag);
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
        /* Posta uygulaması AÇILMAZ (kullanıcı direktifi, 28.08.2026) —
           yalnız dosya iner, kullanıcı kendi programına kendi ekler. */
        YU.ui.bildir('Rapor PDF olarak indi (' + dosyaAdi +
          '). Postanıza kendiniz ekleyin ya da üstteki formdan giriş yapıp otomatik gönderin.', 'basari');
      })['catch'](function () {
        if (gonderDugmesi) gonderDugmesi.textContent = eskiMetin;
        durumuTazele();
        sunucuDurumu = 'yok';
        raporSekmesindeGoster(adresler);
      });
      });
    }

    /* Sunucuya gidecek yedek tablo verisi (yazdirma motoru yoksa kullanilir). */
    function raporVerisi() {
      var ham = raporBolumleri(secim, seciliTarih), liste = [], i, v;
      for (i = 0; i < ham.length; i++) {
        v = tabloVerisi(ham[i].tablo);
        liste.push({ ad: ham[i].ad, sutunlar: v.sutunlar, satirlar: v.satirlar, sagaYasli: v.sagaYasli });
      }
      return liste;
    }

    /* GÖNDERİM SONUCU ORTADAKİ PENCEREDE (kullanıcı isteği, 28.08.2026:
       "sağ altta bildirim değil, ortaya panel gelsin; başarılı olanlar,
       başarısız olanlar ve nedeni yazsın").

       Köşe bildirimi tek cümleydi: kaç alıcıya gittiğini söylüyor, kimin
       alamadığını söylemiyordu. Sunucu artık alıcı başına sonuç döndürüyor
       (Postaci.GonderTekTek), pencere de onu satır satır yazar. Sebep
       cümlesi sunucudan OLDUĞU GİBİ gelir — kısaltılmaz, çünkü düzeltmeyi
       yapacak olan kullanıcıdır. */
    /* ------------------------------------------------------------------
       TESLİM İZLEME (kullanıcı direktifi, 31.08.2026: "gönderilemeyen olursa
       tüm ekrana orta panel gelsin, aynı şekilde bu maile gönderilemedi diye")

       SORUN: "Gönderildi" ile "ulaştı" aynı şey değil. SMTP iletiyi ALIR,
       teslimi sonra dener. Alıcının kutusu yoksa bunu ancak dakikalar sonra
       gelen TESLİMSİZLİK POSTASI söyler — o da kullanıcının gelen kutusuna
       düşer, programın haberi olmazdı.

       NEDEN BAŞKA YOL YOK (ölçüldü, 31.08.2026):
         · Alan adı kontrolü (sunucu · alan_sorunu) yalnız ALANI doğrular;
           hotmail.com gerçek bir alan, sorun kutuda.
         · Alıcının kendi sunucusuna "bu kutu var mı" diye sormak (RCPT):
           bu ağdan 25. port dışarı KAPALI, zaman aşımına düşüyor.

       ÇÖZÜM: gönderimden sonra sunucu, aynı hesabın gelen kutusunu IMAP ile
       yoklar (yalnız teslimsizlik iletileri, yalnız okuma). Bir tanesi bizim
       alıcımıza aitse ekranın ortasında pencere açılır.

       YOKLAMA PENCERESİ 5 DAKİKA: teslimsizlik genellikle saniyeler içinde
       gelir; 5 dakikada gelmediyse posta yolda demektir ve sessizce durulur —
       sonsuz yoklama tarayıcıyı ve posta sunucusunu boşuna yorar. */
    var TESLIM_ARALIK = 15000;   /* ms — iki yoklama arası */
    var TESLIM_ADET = 20;        /* 20 × 15 sn = 5 dakika */

    function teslimIzlemeyiDurdur() {
      if (YU.__teslimSayaci) { clearTimeout(YU.__teslimSayaci); YU.__teslimSayaci = null; }
    }

    /* Sayaç MODÜL DIŞINDA (YU üzerinde) tutulur: ekran yeniden çizilince bu
       kapanış yenilenir, eskisinin sayacı elde kalmazdı ve iki yoklama zinciri
       birden koşup pencereyi iki kez açardı (31.08.2026). */
    function teslimIzle(adresler) {
      teslimIzlemeyiDurdur();
      if (!adresler || !adresler.length || typeof fetch !== 'function') return;
      var gun = YU.tarih.bugun();
      var kalan = TESLIM_ADET;

      function sor() {
        YU.__teslimSayaci = null;
        fetch('api/mail/teslimsiz?gun=' + encodeURIComponent(gun) +
              '&alicilar=' + encodeURIComponent(adresler.join(',')), { cache: 'no-store' })
          .then(function (c) { return c.ok ? c.json() : null; })
          .then(function (g) {
            var liste = (g && g.teslimsizler) || [];
            if (liste.length) { teslimsizPenceresi(liste); return; }   /* bulundu — dur */
            if (--kalan > 0) YU.__teslimSayaci = setTimeout(sor, TESLIM_ARALIK);
          })
          ['catch'](function () {
            /* Sunucuya ulaşılamadı: susarız. "Gönderilemedi" demek için
               KANIT gerekir; yokluğu kanıt değildir. */
            if (--kalan > 0) YU.__teslimSayaci = setTimeout(sor, TESLIM_ARALIK);
          });
      }
      YU.__teslimSayaci = setTimeout(sor, TESLIM_ARALIK);
    }

    /* Ekranın ortasında, gönderim sonucu penceresiyle aynı dilde. */
    function teslimsizPenceresi(liste) {
      var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '14px' } });
      kap.appendChild(YU.h('div', {
        metin: liste.length === 1
          ? 'Rapor postası bu adrese ulaşmadı:'
          : 'Rapor postası şu adreslere ulaşmadı:',
        stil: { font: '400 14px/1.5 var(--font)', color: 'var(--metin-2)' }
      }));
      for (var i = 0; i < liste.length; i++) {
        kap.appendChild(YU.h('div', {
          stil: { display: 'flex', gap: '9px', alignItems: 'baseline', minWidth: '0' }
        },
          YU.h('span', {
            metin: '✕', 'aria-hidden': 'true',
            stil: { flex: 'none', fontWeight: '700', color: 'var(--olumsuz)' }
          }),
          YU.h('div', { stil: { minWidth: '0' } },
            YU.h('div', { sinif: 'yu-guclu', metin: liste[i].adres, stil: { wordBreak: 'break-all' } }),
            YU.h('div', {
              metin: liste[i].sebep || 'Teslim edilemedi.',
              stil: { font: '400 13px/1.45 var(--font)', color: 'var(--olumsuz)', marginTop: '2px' }
            })
          )
        ));
      }
      YU.ui.modal({
        baslik: 'Teslim Edilemedi',
        baslikAlt: mailHesabi ? mailHesabi.adres : '',
        genislik: 480,
        govde: kap,
        dugmeler: [{ metin: 'Tamam', tur: 'birincil' }]
      });
    }

    function sonucPenceresi(g) {
      g = g || {};
      var sonuclar = g.sonuclar || [];
      var basarili = [], hatali = [], i;
      for (i = 0; i < sonuclar.length; i++) {
        (sonuclar[i].tamam ? basarili : hatali).push(sonuclar[i]);
      }

      function bolum(baslik, liste, olumlu) {
        if (!liste.length) return null;
        var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          YU.h('div', { sinif: 'yu-etiket', metin: baslik }));
        for (var j = 0; j < liste.length; j++) {
          var s = liste[j];
          kap.appendChild(YU.h('div', {
            stil: { display: 'flex', gap: '9px', alignItems: 'baseline', minWidth: '0' }
          },
            YU.h('span', {
              metin: olumlu ? '✓' : '✕', 'aria-hidden': 'true',
              stil: {
                flex: 'none', fontWeight: '700',
                color: olumlu ? 'var(--olumlu)' : 'var(--olumsuz)'
              }
            }),
            YU.h('div', { stil: { minWidth: '0' } },
              YU.h('div', { sinif: 'yu-guclu', metin: s.adres, stil: { wordBreak: 'break-all' } }),
              (!olumlu && s.hata)
                ? YU.h('div', {
                    metin: s.hata,
                    stil: { font: '400 13px/1.45 var(--font)', color: 'var(--olumsuz)', marginTop: '2px' }
                  })
                : null
            )
          ));
        }
        return kap;
      }

      var baslik = !basarili.length ? 'Gönderilemedi'
        : (hatali.length ? 'Kısmen Gönderildi' : 'Gönderildi');

      YU.ui.modal({
        baslik: baslik,
        /* Hangi hesaptan çıktığı başlığın altında: aynı programı iki farklı
           mail hesabıyla kullanan kullanıcı hangisinden gittiğini görür. */
        baslikAlt: g.gonderen || '',
        genislik: 480,
        govde: YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '16px' } },
          bolum('Gönderildi', basarili, true),
          (basarili.length && hatali.length)
            ? YU.h('div', { stil: { height: '1px', background: 'var(--ayrac-2)' } })
            : null,
          bolum('Gönderilemedi', hatali, false)
        ),
        dugmeler: [{ metin: 'Tamam', tur: 'birincil' }]
      });
    }

    /* A YOLU — sunucu postalar. Rapor PDF olarak EKTE gider; konu ve
       kullanıcının yazısı da postada durur. Outlook hiç açılmaz. */
    function sunucudanGonder(adresler) {
      var tarihMetni = tarihMetniniAl();
      var bolumler = raporVerisi();
      var eskiMetin = gonderDugmesi ? gonderDugmesi.textContent : '';
      if (gonderDugmesi) { gonderDugmesi.disabled = true; gonderDugmesi.textContent = 'Gonderiliyor...'; }

      /* Gerçek tema.css BEKLENİR (raporHtml notu) — postaya giden PDF
         asla kaba yedek stille üretilmez. */
      temaCssHazir().then(function (css) {
      fetch('api/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alicilar: adresler,
          konu: konuMetni(tarihMetni),
          mesaj: mesajMetni(),
          baslik: 'Gunluk Stok Durumu - ' + tarihMetni,
          altBaslik: donemAltBasligi(),
          dosyaAdi: 'Gunluk-Stok-Durumu-' + seciliTarih + '.pdf',
          /* EKTEKI PDF, EKRANDAKI "Yazdir" CIKTISININ AYNISIDIR (kullanici
             istegi, 28.08.2026): sunucuya tablo verisi degil, Ctrl+P ile
             basilan HTML'in TA KENDISI gider ve orada ayni yazdirma
             motoruyla basilir. bolumler yalniz yedek yol icin durur:
             sunucuda tarayici yoksa tablo oradan dizilir. */
          html: raporHtml(tarihMetni, secim, seciliTarih, css),
          bolumler: bolumler
        })
      }).then(function (c) {
        return c.text().then(function (m) {
          var g = null;
          if (m) { try { g = JSON.parse(m); } catch (e) { g = null; } }
          return { kod: c.status, govde: g };
        });
      }).then(function (y) {
        if (gonderDugmesi) gonderDugmesi.textContent = eskiMetin;
        durumuTazele();
        if (y.kod === 200) {
          if (modal && modal.kapat) modal.kapat();
          sonucPenceresi(y.govde);
          /* SMTP "aldım" dedi; gerçekten ULAŞTI mı, teslimsizlik postası
             söyler. Yalnız BAŞARILI görünen adresler izlenir (31.08.2026). */
          var izlenecek = [];
          var sonuclar = (y.govde && y.govde.sonuclar) || [];
          for (var si = 0; si < sonuclar.length; si++) {
            if (sonuclar[si].tamam) izlenecek.push(sonuclar[si].adres);
          }
          teslimIzle(izlenecek);
          return;
        }
        /* Hepsi başarısız: sunucu 502 ile alıcı listesini yine döner —
           köşe bildirimi yerine aynı pencere açılır, sebep satır satır
           yazar (kullanıcı isteği, 28.08.2026). */
        if (y.kod === 502 && y.govde && y.govde.sonuclar) {
          if (modal && modal.kapat) modal.kapat();
          sonucPenceresi(y.govde);
          return;
        }
        /* 503 = hesap silinmiş/ayar bozulmuş: PDF-indirme yoluna düşülür,
           HİÇBİR posta uygulaması açılmaz. sunucuDurumu = null (BOOLEAN
           false DEĞİL — 28.08.2026 kusuru): false hiçbir string kip
           koşuluyla eşleşmiyordu, bir kez buraya düşen kullanıcı başarılı
           giriş yapsa bile SONSUZA KADAR bu dala düşüyordu. null, bir
           sonraki denemede sunucuya yeniden sorulmasını sağlar. */
        if (y.kod === 503) { sunucuDurumu = null; pdfIndirVeAc(adresler); return; }
        YU.ui.bildir('Posta gonderilemedi: ' +
          ((y.govde && y.govde.hata) || ('sunucu ' + y.kod)), 'hata');
      })['catch'](function (e) {
        if (gonderDugmesi) gonderDugmesi.textContent = eskiMetin;
        durumuTazele();
        /* Ag koptuysa is durmasin: eski akis hala calisir. Ayni sebeple
           null yazilir (yukaridaki nota bak) — false degil. Posta
           uygulaması açılmaz; PDF-indirme yolu denenir. */
        sunucuDurumu = null;
        pdfIndirVeAc(adresler);
      });
      });
    }

    /* Kagidin ust satiri: kampanya adi. Ekrandaki alt baslikla ayni dil. */
    function donemAltBasligi() {
      var d = null;
      try { d = YU.donem.aktif(); } catch (e) { d = null; }
      return d ? ('Kampanya ' + d.ad) : '';
    }

    /* SON ÇARE — sunucuya hiç ulaşılamıyor (PDF üretimi bile başarısız).
       HİÇBİR POSTA UYGULAMASI AÇILMAZ (kullanıcı direktifi, 28.08.2026:
       "outlook hiç açılmamalı"). Yapılabilecek tek şey: raporu yazdırma
       görünümünde göstermek — kullanıcı isterse Ctrl+P ile kendi kaydeder,
       postayı da kendi eliyle gönderir. */
    function raporSekmesindeGoster(adresler) {
      var tarihMetni = tarihMetniniAl();
      var bolumler = raporBolumleri(secim, seciliTarih);
      if (bolumler.length) raporuAc(tarihMetni, secim, seciliTarih);
      YU.ui.bildir(bolumler.length
        ? 'Sunucuya ulaşılamadı: rapor gönderilemedi. Açılan sekmede Ctrl+P ile kaydedip postanıza kendiniz ekleyin.'
        : 'Sunucuya ulaşılamadı: rapor gönderilemedi.', 'hata');
    }

    /* CSV, kopyalanan tablonun HÜCRELERİNDEN üretilir: ekranda ne varsa
       dosyada da o olur, ikinci bir hesap yapılmaz. */
    /* Hücre iç içedir: TD > DIV > iki SPAN ("420.000" ve "22.07.2026").
       Yalnız birinci düzey çocuklara bakmak yetmiyordu, textContent ikisini
       yapıştırıyordu. METİN DÜĞÜMLERİNE kadar inilir, aralarına boşluk. */
    function hucreMetni(hucre) {
      var parca = [];
      (function gez(n) {
        var i;
        if (n.nodeType === 3) {
          var t = String(n.textContent).replace(/\s+/g, ' ').trim();
          if (t) parca.push(t);
          return;
        }
        for (i = 0; i < n.childNodes.length; i++) gez(n.childNodes[i]);
      })(hucre);
      return parca.join(' ');
    }

    /* ---------------- yerleşim ---------------- */

    function bolumBasligi(metin) {
      return YU.h('div', {
        stil: {
          font: '600 12px/1 var(--font)', letterSpacing: '.07em',
          textTransform: 'uppercase', color: 'var(--metin-4)', marginBottom: '9px'
        },
        metin: metin
      });
    }

    var sol = YU.h('div', { stil: { minWidth: '0', display: 'flex', flexDirection: 'column' } },
      bolumBasligi('Alıcılar'),
      aliciKap,
      YU.h('div', {
        stil: { display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '11px' }
      }, adresAlan.kok, ekleDugmesi)
    );

    /* TARİH ŞERİDİ — projenin standart rozeti + Önceki/Bugün/Sonraki üçlüsü
       (kullanıcı isteği, 26.08.2026). Rozete tıklayınca takvim açılır.
       "Bu Günün Raporunu Getir" düğmesi kaldırıldı (kullanıcı isteği,
       26.08.2026): gün değiştirilince rapor zaten kendiliğinden
       tazeleniyordu, düğme yalnız "getirdim" geri bildirimi veriyordu —
       iş yapmıyordu (KURAL 11). */
    var tarihSeridi = YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }
    });

    function tarihSeridiniCiz() {
      var son = YU.donem && YU.donem.gorunumSonu ? YU.donem.gorunumSonu() : YU.tarih.bugun();
      var ad = seciliTarih === son
        ? (YU.donem && YU.donem.gecmisMi && YU.donem.gecmisMi() ? 'Kampanya Sonu' : 'Bugün')
        : 'Seçili Gün';
      YU.bos(tarihSeridi);
      tarihSeridi.appendChild(YU.ui.tarihRozeti(seciliTarih, ad, { onSec: gunuDegistir, enFazla: son }));
      tarihSeridi.appendChild(YU.ui.gunGezinme(seciliTarih, gunuDegistir));
    }

    function gunuDegistir(iso) {
      seciliTarih = iso;
      tarihSeridiniCiz();
      kartiTazele();
      durumuTazele();
    }

    /* Tablo seçim kutucukları KALDIRILDI (kullanıcı isteği, 28.08.2026:
       "bu kısımlar olmasın ikisi de otomatik tikli olsun, yazılar
       görünmesin"). secim nesnesi hâlâ var ({silo:true, malzeme:true},
       yukarıda tanımlı) — raporBolumleri onu okumaya devam eder, yalnız
       artık hiç değişmez: iki rapor da her zaman gönderilir. */
    var sag = YU.h('div', { stil: { minWidth: '0', display: 'flex', flexDirection: 'column' } },
      bolumBasligi('Rapor ve Mesaj'),
      tarihSeridi,
      kagit
    );

    var govdeKap = YU.h('div', {
      stil: {
        display: 'grid', gridTemplateColumns: 'minmax(230px, 340px) minmax(0, 1fr)',
        gap: '20px', alignItems: 'start',
        /* Dikey taban (kullanıcı isteği, 26.08.2026): pencere yüksekliği
           içeriğe göre oluştuğu için kısa kalıyordu. 430 -> 580px (ikinci
           istek: "biraz daha uzat"). İçerik taşarsa .yu-modal-govde zaten
           kaydırıyor, .yu-modal da 100vh-48px ile sınırlı — alçak ekranda
           taşmaz, kendiliğinden küçülür. */
        minHeight: '580px'
      }
    }, sol, sag);

    aliciListesiniCiz();
    tarihSeridiniCiz();
    kartiTazele();

    modal = YU.ui.modal({
      baslik: 'Raporu Mail ile Gönder',
      /* Genişlik: 900 → 1040 → 1480 (kullanıcı isteği, 26.08.2026 —
         "yatay olarak fazla büyüt"). .yu-modal genişliği min(deger, 100%)
         olduğu için dar ekranda kendiliğinden küçülür. */
      genislik: 1480,
      govde: [govdeKap],
      dugmeler: [
        { metin: 'Kapat', tur: 'tehlike' },
        { metin: 'Gönder', ikon: '#ic-doc', tur: 'birincil', onClick: mailiAc }
      ]
    });

    /* ================================================================
       MİNİ DURUM ŞERİDİ (kullanıcı direktifi, 28.08.2026: "mail
       gönderdeki panelde giriş çıkış bilgisi olmasın, sadece mail girişi
       yapılı gibi mini bilgi... smtp.gmail.com:587 bu bilgi de olsun").

       Hesap TEK BİR MASTER'DIR (aynı direktif: "programı kullanan tüm
       kullanıcılarda tanımlı olmalı") ve YÖNETİMİ (giriş/çıkış/sınama)
       artık Yönetim Paneli › Mail Hesabı ekranındadır (js/37-mail-hesabi.js,
       yalnız Yönetici). Burada form YOK — yalnız bağlı mı ve sunucu:port
       okunur; bağlı değilse yönetim ekranına yönlendiren tek satır durur.
       ================================================================ */
    var durumSeridi = YU.h('div', {
      stil: {
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', gap: '9px',
        margin: '0 0 14px', padding: '10px 14px', borderRadius: 'var(--r)',
        border: '1px solid var(--kenar)', background: 'var(--yuzey-2)',
        font: '400 13.5px/1.4 var(--font)'
      }
    });
    govdeKap.insertBefore(durumSeridi, govdeKap.firstChild);

    /* Seridin tiklanabilirligi tek yerden kurulur: bagli DEGILKEN serit
       kirmiziya doner, imlec el olur ve ustune gelince zemin koyulasir --
       "burasi bir eksigi soyluyor, cozumu bir tik otede" (kullanici istegi,
       28.08.2026). Bagliyken hover YOKTUR: yesil serit bir bilgi satiridir,
       gidilecek yer degil. */
    /* Serit metinleri tek yerde: kodlama kazasi olmasin diye sabit. */
    var MSJ_BAGLI   = 'Mail girişi yapılı';
    var MSJ_YOK     = 'Mail hesabı tanımlı değil';
    var MSJ_YONERGE = "Yönetim Paneli › Mail Hesabı'ndan bağlanın.";
    var MSJ_YETKI   = 'Bu ayara yalnız Yöneticinin erişimi var.';

    function seritHoverKur(acik) {
      durumSeridi.onmouseenter = null;
      durumSeridi.onmouseleave = null;
      durumSeridi.style.cursor = acik ? 'pointer' : '';
      durumSeridi.style.transition = 'background-color .12s ease';
      if (!acik) return;
      durumSeridi.onmouseenter = function () {
        /* Taban --olumsuz-zemin (koyu temada %12 saydam kirmizi). Hover
           SAYDAMLIGI artirir: iki temada da ayni yonde koyulasir ve
           tabandan gozle ayrilir -- yuzey tokenine karistirmak koyu
           temada farki yok denecek kadar kucuk birakiyordu (olculdu). */
        durumSeridi.style.backgroundColor = 'color-mix(in srgb, var(--olumsuz) 30%, transparent)';
      };
      durumSeridi.onmouseleave = function () {
        durumSeridi.style.backgroundColor = 'var(--olumsuz-zemin)';
      };
    }

    function durumSeridiniCiz(kip) {
      var bagli = kip === 'postali';
      YU.bos(durumSeridi);
      durumSeridi.onclick = null;
      /* Eksik hesap artik KIRMIZI okunur (kullanici istegi, 28.08.2026):
         onceki notr zemin, "bir sey eksik" mesajini vermiyordu. */
      durumSeridi.style.backgroundColor = bagli ? 'var(--olumlu-zemin)' : 'var(--olumsuz-zemin)';
      durumSeridi.style.borderColor = bagli ? 'var(--olumlu)' : 'var(--olumsuz)';
      durumSeridi.appendChild(YU.h('span', {
        stil: { display: 'flex', flex: 'none', color: bagli ? 'var(--olumlu)' : 'var(--olumsuz)' }
      }, YU.svg(bagli ? '#ic-checklist' : '#ic-alert', 16)));
      durumSeridi.appendChild(YU.h('span', {
        metin: bagli ? MSJ_BAGLI : MSJ_YOK,
        stil: {
          font: '600 13.5px/1.3 var(--font)',
          color: bagli ? 'var(--metin-2)' : 'var(--olumsuz)'
        }
      }));

      if (bagli) {
        seritHoverKur(false);
        if (mailHesabi) {
          durumSeridi.appendChild(YU.h('span', {
            metin: mailHesabi.sunucu + ':' + mailHesabi.port,
            stil: { font: '400 13px/1.3 var(--font)', color: 'var(--metin-4)' }
          }));
        }
        return;
      }

      /* Mail Hesabi ekrani YALNIZ Yonetici'ye acik (37-mail-hesabi ·
         rol: 'Yonetici'). Operatore baglanti verilseydi tiklayinca yetki
         duvarina carpardi; ona duz metin kalir. */
      var kullanici = YU.oturum && YU.oturum.kullanici;
      if (!kullanici || kullanici.Rol !== 'Yonetici') {
        seritHoverKur(false);
        durumSeridi.appendChild(YU.h('span', {
          metin: MSJ_YETKI,
          stil: { font: '400 13px/1.3 var(--font)', color: 'var(--olumsuz-silik)' }
        }));
        return;
      }

      /* Gercek adres verilir: orta tus / Ctrl+tik YENI SEKMEDE acar
         (21-kuru-kuspe-giris.js baglanti deseninin ayni). Sol tik pencereyi
         kapatip ayni sekmede gider -- arkada kalan pencere yeni ekranin
         ustunu ortmesin. */
      function git() {
        if (modal && modal.kapat) modal.kapat();
        YU.git('mail-hesabi');
      }
      durumSeridi.appendChild(YU.h('a', {
        href: YU.adres('mail-hesabi'),
        metin: MSJ_YONERGE,
        stil: {
          font: '600 13px/1.3 var(--font)', color: 'var(--olumsuz)',
          textDecoration: 'underline', textUnderlineOffset: '2px'
        },
        onClick: function (e) {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) return;
          e.preventDefault();
          e.stopPropagation();   /* seridin kendi tiklamasi ikinci kez gitmesin */
          git();
        }
      }));
      seritHoverKur(true);
      durumSeridi.onclick = git;   /* seridin her yeri tiklanir -- hover bunu vaat ediyor */
    }

    sunucuKipi().then(function (kip) {
      durumSeridiniCiz(kip);
      durumuTazele();
    });

    /* Alt bardaki gerçek Gönder düğmesi: kilit ona uygulanır. */
    gonderDugmesi = (function () {
      var d = modal.modal ? modal.modal.querySelectorAll('.yu-modal-alt .yu-dugme') : [];
      for (var i = 0; i < d.length; i++) {
        if (d[i].textContent.indexOf('Gönder') > -1) return d[i];
      }
      return null;
    })();

    /* Alt bar düğmeleri bir kademe iri (kullanıcı isteği, 26.08.2026).
       Ortak .yu-dugme sınıfına DOKUNULMAZ — yalnız bu pencerenin iki
       düğmesi büyütülür (KURAL 10.5). */
    (function () {
      var d = modal.modal ? modal.modal.querySelectorAll('.yu-modal-alt .yu-dugme') : [];
      for (var i = 0; i < d.length; i++) {
        d[i].style.padding = '11px 22px';
        d[i].style.fontSize = '15px';
      }
    })();

    /* Sağ üstte X (kullanıcı isteği, 26.08.2026): alttaki "Kapat" duruyor,
       bu ek bir çıkış. Ortak YU.ui.modal değiştirilmedi — X yalnız bu
       pencereye takılır, öbür pencereler eskisi gibi kalır (KURAL 5.1). */
    (function () {
      var bas = modal.modal ? modal.modal.querySelector('.yu-modal-bas') : null;
      if (!bas) return;
      var x = YU.h('button', {
        tip: 'button', title: 'Kapat', 'aria-label': 'Kapat',
        stil: {
          marginLeft: 'auto', flex: 'none', display: 'flex', alignItems: 'center',
          justifyContent: 'center', width: '32px', height: '32px', padding: '0',
          /* KIRMIZI (kullanıcı isteği, 26.08.2026): kapatma tuşu olduğu
             belli olsun. Üzerine gelince dolgu da kırmızıya döner. */
          border: '1px solid var(--olumsuz)', borderRadius: 'var(--r-s)',
          background: 'transparent', color: 'var(--olumsuz)', cursor: 'pointer'
        },
        onClick: function () { modal.kapat(); }
      }, YU.svg('#ic-x', 16));
      x.addEventListener('mouseenter', function () { x.style.background = 'var(--olumsuz)'; x.style.color = '#fff'; });
      x.addEventListener('mouseleave', function () { x.style.background = 'transparent'; x.style.color = 'var(--olumsuz)'; });
      bas.appendChild(x);
    })();

    durumuTazele();
    return modal;
  };
})();

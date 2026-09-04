/* js/35-mail-gonder.js — Raporu Mail ile Gönder (kullanıcı isteği, 26.08.2026)

   ŞARTNAME DIŞI EKTİR. §11 "Opsiyonel genişletmeler" (Demirbaş) yalnız dört
   madde sayar: Excel çıktısı, gübre takibi, aylık özet, sayım/düzeltme kaydı.
   Mail bunlarda yok; İade alanı gibi kullanıcı direktifiyle eklenmiştir.
   Hiçbir hesap, doğrulama kuralı ya da tabloya dokunmaz — yalnız okur.

   ---------------------------------------------------------------------
   GÖNDERİM BİÇİMİ (kullanıcı direktifi, 03.09.2026 — önceki hâllerin
   yerine geçer)
   ---------------------------------------------------------------------
   Posta PROGRAM tarafından gönderilmez; bilgisayardaki posta uygulaması
   (Outlook) TASLAK olarak açılır, Gönder'e kullanıcı orada basar.
     · seçili adresler taslağın "Kime" satırına girer,
     · konu ve kullanıcının mesajı olduğu gibi durur,
     · rapor PDF değil HTML'dir: Ana Sayfa'nın Yazdır çıktısıyla BİREBİR
       aynı görünen künye + iki tablo postanın gövdesinde durur,
     · "Gönderen : Ad Soyad" imzası KALKTI,
     · "gönderildi" bildirimi YOK — son adım postada.
   NASIL (kullanıcı kararı, 03.09.2026 — "B yolu"): RFC 822 biçiminde bir
   .eml dosyası kurulur (X-Unsent: 1 başlığı "taslak" demektir) ve tarayıcı
   bunu İNDİRİR. Kullanıcının bilgisayarında .eml yeni Outlook'a bağlıysa
   ve Chrome "bu türü hep aç" ayarındaysa dosya inince Outlook taslakla
   KENDİLİĞİNDEN açılır; değilse kullanıcı inen dosyaya bir kez tıklar.
   Her bilgisayarda bir kez yapılan iki ayar budur.

   NEDEN SUNUCU AÇMIYOR: Outlook'u açan kod sunucuda çalışsaydı pencere
   sunucunun ekranında açılırdı; ağ üzerinden bağlanan 3-4 kullanıcı kendi
   bilgisayarında hiçbir şey görmezdi (ölçüldü: uzak istekte 403). Web
   sayfası kullanıcının bilgisayarında program açamaz; elinde yalnız
   mailto: (düz metin, HTML taşımaz) ve dosya indirme vardır. Rapor HTML
   olacaksa tek yol indirmedir. Sunucudaki /api/mail/taslak ucu artık
   ÇAĞRILMIYOR; kod yerinde duruyor.
   ÖLÇÜLDÜ (03.09.2026): yeni Outlook 1.2026.818, HTML gövdeli .eml'i
   düzenlenebilir taslak olarak açıyor; alıcı, konu, tablo çizgileri,
   renkler ve Türkçe harfler doğru geliyor.
   28.08.2026 tarihli "outlook hiç açılmamalı" direktifi bu kararla
   kaldırıldı; SMTP gönderimi ve PDF eki artık kullanılmıyor.

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
     MAIL HESABI API'Sİ — YALNIZ Yönetim Paneli › Mail Hesabı ekranı için
     (js/37-mail-hesabi.js) duruyor. O ekran menüden kaldırıldı (kullanıcı
     kararı, 03.09.2026), doğrudan adresle açılınca yine bu işlevleri
     çağırır. Gönderme paneli bunların HİÇBİRİNİ kullanmaz: posta taslak
     olarak Outlook'ta açılır (dosya başındaki not).
     ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------
     KÂĞITTAKİ RAPORUN HTML KOPYASI (kullanıcı direktifi, 03.09.2026:
     "yazdırda nasıl gözüküyor öyle gözükecek, birebir")
     ------------------------------------------------------------------
     Ana Sayfa'nın Yazdır çıktısı üç parçadır: rapor künyesi (.yu-baski-bas:
     kurum, rapor adı, tarih, kampanya), Silo Bazında Stok paneli, Malzeme
     Bazında Stok paneli — hepsi tema.css'in @media print kurallarıyla.
     Aynı parçalar GİZLİ bir çerçevede (iframe) yeniden kurulur; @media
     print blokları sarmalından çıkarılıp sıradan kural gibi eklenir, böylece
     çerçeve kâğıt gibi dizilir. Sonra her öğenin HESAPLANMIŞ stili satır
     içi style'a yazılır: posta programı <style> bloğunu, sınıfı ve CSS
     değişkenini tanımaz, satır içi stili tanır. Birebir görünüm ancak
     böyle taşınır. Ölçüldü (03.09.2026): yeni Outlook satır içi stilli
     tabloyu çizgi, renk ve hizasıyla aynen çiziyor. */

  var KAGIT_GENISLIK = 792;   /* A4'te kullanılabilir genişlik (px) — tema.css print ölçümleriyle aynı */

  /* YAZI BİR KADEME BÜYÜK (kullanıcı isteği, 03.09.2026: "maildeki rapor
     kısmındaki yazılar ve değerler çok ufak, büyüt").

     Kâğıt ölçüleri A4'e sığmak için küçüktür (tema.css @media print:
     başlık 9px, hücre 10px, rakam 10,5px). Posta ekranda okunur, o sınır
     yoktur. Ölçüler ~1,5 kat büyütülür; DÜZEN AYNI KALIR — kolon sırası,
     satırlar, hizalar, çizgiler ve renkler kâğıttakinin aynısıdır.
     Kâğıt genişliği de aynı oranda açılır, yoksa büyüyen başlıklar
     kolonları alt alta kırar, "TOPLAM" bile ikiye bölünürdü (ölçüldü). */
  var MAIL_OLCEK = 1.5;
  var MAIL_GENISLIK = Math.round(KAGIT_GENISLIK * MAIL_OLCEK);   /* 1188px */
  var MAIL_BUYUTME =
    '.yu-tablo th{font-size:14px !important;padding:8px 10px !important}' +
    '.yu-tablo td{font-size:15px !important;padding:8px 10px !important}' +
    '.yu-tablo td .yu-mono,.yu-tablo td .yu-guclu{font-size:15.5px !important}' +
    '.yu-baski-sig thead th{font-size:14px !important;padding:8px 10px !important}' +
    '.yu-baski-sig tbody td{font-size:15px !important;padding:8px 10px !important}' +
    '.yu-baski-sig tbody td .yu-mono{font-size:15.5px !important}' +
    '.yu-baski-sig .yu-rozet{font-size:13.5px !important;padding:2px 9px !important}' +
    /* Panel başlıkları ("Silo Bazında Stok") tabloyla birlikte büyür. */
    '.yu-panel-baslik{font-size:20px !important}' +
    /* Künye bir kademe daha büyük (kullanıcı isteği, 03.09.2026): kurum adı,
       rapor adı, tarih ve kampanya satırı. Kâğıttaki ölçüler sırasıyla
       9,5 / 15 / 12 / 10px'tir; postada ~1,55 kat okunur. */
    '.yu-baski-ad{font-size:23px !important}' +
    '.yu-baski-tarih{font-size:17px !important}' +
    '.yu-baski-kurum{font-size:14px !important;margin-bottom:7px !important}' +
    '.yu-baski-alt{font-size:15px !important;margin-top:5px !important}';

  /* tema.css içindeki her "@media print { … }" bloğunun İÇİ. Yorumlar önce
     atılır: içlerinde küme parantezi geçerse eşleme şaşardı. */
  function baskiKurallari(css) {
    var m = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
    var cikti = '', i = 0, k, a, d, j, c;
    while ((k = m.indexOf('@media print', i)) >= 0) {
      a = m.indexOf('{', k);
      if (a < 0) break;
      d = 1; j = a + 1;
      while (j < m.length && d > 0) {
        c = m.charAt(j);
        if (c === '{') d++; else if (c === '}') d--;
        j++;
      }
      cikti += m.slice(a + 1, j - 1) + '\n';
      i = j;
    }
    return cikti;
  }

  /* Renk adını / oklch'yi posta programının anladığı #rrggbb'ye çevirir:
     tuval (canvas) tarayıcının çözdüğü rengi normalize edip geri verir. */
  var renkTuvali = null;
  function renkHex(deger) {
    var v = String(deger || '').trim();
    if (!v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'none') return null;
    if (!renkTuvali) renkTuvali = document.createElement('canvas').getContext('2d');
    renkTuvali.fillStyle = '#000000';
    renkTuvali.fillStyle = v;
    return renkTuvali.fillStyle;
  }

  var STIL_METIN = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'text-transform', 'text-align', 'vertical-align', 'white-space',
    'text-decoration-line', 'font-variant-numeric'];
  var STIL_KUTU = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];
  var STIL_RENK = ['color', 'background-color',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'];
  var VARSAYILAN = { '0px': 1, 'normal': 1, 'none': 1, 'auto': 1, 'baseline': 1 };

  /* Bir öğenin hesaplanmış stilinden satır içi stil parçaları. Varsayılan
     değerler atlanır — dosya boşuna şişmesin. */
  function stilParcalari(hs) {
    var st = [], i, ad, v;
    for (i = 0; i < STIL_METIN.length; i++) {
      ad = STIL_METIN[i]; v = hs.getPropertyValue(ad);
      if (!v || VARSAYILAN[v]) continue;
      if (ad === 'text-align') { if (v === 'start') v = 'left'; else if (v === 'end') v = 'right'; }
      st.push(ad + ':' + v);
    }
    for (i = 0; i < STIL_KUTU.length; i++) {
      ad = STIL_KUTU[i]; v = hs.getPropertyValue(ad);
      if (!v || VARSAYILAN[v]) continue;
      st.push(ad + ':' + v);
    }
    for (i = 0; i < STIL_RENK.length; i++) {
      ad = STIL_RENK[i];
      /* Kenar rengi yalnız kenar çizgisi varken yazılır. */
      if (ad.indexOf('border-') === 0 && hs.getPropertyValue(ad.replace('-color', '-style')) === 'none') continue;
      v = renkHex(hs.getPropertyValue(ad));
      if (v) st.push(ad + ':' + v);
    }
    return st;
  }

  /* SVG ikon → PNG resim (veri adresi). Posta programı <svg> ve <use>
     tanımaz; ikon tuvalde çizilip resme çevrilir. Sembol çerçevedeki sprite
     kopyasından okunur, "currentColor" hesaplanmış renkle değiştirilir. */
  function svgResmeCevir(svgEl, olcum, belge) {
    var w = Math.round(olcum.kutu.width) || 16, h = Math.round(olcum.kutu.height) || w;
    var resim = belge.createElement('img');
    resim.setAttribute('width', String(w));
    resim.setAttribute('height', String(h));
    resim.setAttribute('alt', '');
    resim.setAttribute('style', 'display:inline-block;vertical-align:middle;width:' + w + 'px;height:' + h + 'px;border:0');
    svgEl.parentNode.replaceChild(resim, svgEl);
    function kaldir() { if (resim.parentNode) resim.parentNode.removeChild(resim); }

    var use = svgEl.querySelector('use');
    var id = use ? (use.getAttribute('href') || use.getAttribute('xlink:href')) : null;
    var sembol = null;
    try { sembol = id ? belge.querySelector(id) : null; } catch (e) { sembol = null; }
    if (!sembol) { kaldir(); return Promise.resolve(); }

    var renk = renkHex(olcum.renk) || '#000000';
    var nitelik = '', i, a;
    for (i = 0; i < sembol.attributes.length; i++) {
      a = sembol.attributes[i];
      if (a.name === 'id') continue;
      nitelik += ' ' + a.name + '="' + a.value.replace(/currentColor/g, renk) + '"';
    }
    var xml = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"' + nitelik + '>' +
      sembol.innerHTML.replace(/currentColor/g, renk) + '</svg>';
    return new Promise(function (coz) {
      var im = new Image();
      im.onload = function () {
        try {
          var olcek = 3, tuval = document.createElement('canvas');
          tuval.width = w * olcek; tuval.height = h * olcek;
          tuval.getContext('2d').drawImage(im, 0, 0, tuval.width, tuval.height);
          resim.setAttribute('src', tuval.toDataURL('image/png'));
        } catch (e) { kaldir(); }
        coz();
      };
      im.onerror = function () { kaldir(); coz(); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
  }

  /* ÖNCE ÖLÇ, SONRA DEĞİŞTİR — iki ayrı geçiş.

     ZORUNLU: düzleştirme, öğenin sınıfını siler. Tek geçişte yapılırsa üst
     kabın sınıfı çocuklardan ÖNCE silinir ve ".yu-baski-sig tbody td" gibi
     soy zincirine dayanan kâğıt kuralları artık eşleşmez; çocuklar kâğıt
     stilini değil EKRAN stilini alır. Ölçüldü (03.09.2026): tek geçişte
     hücre 14,5px yazı / 14px dolgu, tablo 848px çıkıyordu — kâğıtta ise
     10px / 6px ve 788px. Bu yüzden bütün ölçüler önce toplanır. */
  function olcumleriTopla(kok, pencere, olcumler) {
    (function gez(el) {
      var hs = pencere.getComputedStyle(el);
      olcumler.set(el, {
        display: hs.display,
        gorunurluk: hs.visibility,
        stil: stilParcalari(hs),
        hiza: hs.alignItems === 'center' ? 'middle' : (hs.alignItems === 'baseline' ? 'baseline' : 'top'),
        dagit: hs.justifyContent,
        yon: hs.flexDirection,
        bosluk: parseFloat(hs.columnGap) || 0,
        kenarBirlesik: hs.borderCollapse,
        kenarAralik: hs.borderSpacing,
        renk: hs.color,
        genislik: parseFloat(hs.width),
        /* Boş bir kutunun ekranda İZİ var mı? Zemini ya da kenar çizgisi
           varsa vardır (yavru satırın dirsek çizgisi böyledir); yoksa yok
           ve mailde taşımaya değmez (aşağıdaki temizlik kuralı). */
        izVar: (function () {
          var z = hs.backgroundColor;
          if (z && z !== 'transparent' && z !== 'rgba(0, 0, 0, 0)') return true;
          return ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
            .some(function (a) { return parseFloat(hs[a]) > 0; });
        })(),
        kutu: el.getBoundingClientRect()
      });
      for (var i = 0; i < el.children.length; i++) gez(el.children[i]);
    })(kok);
  }

  /* Öğeyi ve altındakileri satır içi stile indirger. Gizli öğe atılır;
     sınıf, kimlik, ipucu gibi ekran nitelikleri silinir. Stil değerleri
     olcumleriTopla'nın bıraktığı haritadan okunur — canlı sorgu YAPILMAZ. */
  function ogeyiDuzlestir(el, olcumler, belge, isler) {
    var o = olcumler.get(el);
    var etiket = el.tagName.toLowerCase();
    if (!o || o.display === 'none' || o.gorunurluk === 'hidden' ||
        etiket === 'colgroup' || etiket === 'col' || etiket === 'script' || etiket === 'style' ||
        etiket === 'button' || etiket === 'input' || etiket === 'select' || etiket === 'textarea') {
      if (el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (etiket === 'svg') { isler.push(svgResmeCevir(el, o, belge)); return; }

    var st = o.stil.slice(), g = o.display, i, c;
    var cocuklar = [];
    for (i = 0; i < el.children.length; i++) cocuklar.push(el.children[i]);

    /* FLEX KUTULAR: posta programı flex bilmez. Kap blok / satır içi blok
       olur; çocuklar satır içi blok dizilir, aradaki boşluk (gap) sağ kenar
       boşluğuna döner. İki çocuklu "space-between" satır (künyedeki rapor
       adı · tarih) iki hücreli tabloya çevrilir — sağa yaslama postada
       ancak böyle güvenilir. */
    if (g === 'flex' || g === 'inline-flex') {
      if (g === 'flex' && o.dagit === 'space-between' && cocuklar.length === 2) {
        var tablo = belge.createElement('table'), tr = belge.createElement('tr'), td;
        for (i = 0; i < 2; i++) {
          td = belge.createElement('td');
          td.setAttribute('style', 'padding:0;vertical-align:' + o.hiza + ';text-align:' + (i ? 'right' : 'left'));
          td.appendChild(cocuklar[i]);
          tr.appendChild(td);
        }
        tablo.appendChild(tr);
        tablo.setAttribute('style', 'width:100%;border-collapse:collapse;border-spacing:0');
        el.appendChild(tablo);
        st.push('display:block');
        /* Çocuklar taşındı ama ÖLÇÜLERİ duruyor: aşağıdaki döngü yine
           onlara iner, araya giren sarmalayıcı tabloya değil. */
      } else {
        st.push('display:' + (g === 'flex' ? 'block' : 'inline-block'));
        /* BOŞLUK MARGIN'LE DEĞİL, BOŞLUK KARAKTERİYLE (kullanıcı bildirimi,
           03.09.2026: taslakta "100.000 kg" -> "100.000kg" oluyordu).
           Outlook'un taslak düzenleyicisi satır içi öğelerdeki margin'i
           siliyor; bölünmez boşluk (\u00a0) ise metnin parçası olduğu için
           hiçbir düzenleyici tarafından atılmaz. Yalnız satır içi dizilen
           kaplarda ve gerçekten boşluk olan yerde eklenir. */
        /* BOŞLUK YALNIZ MARGIN'LE VERİLMEZ (kullanıcı bildirimi, 03.09.2026:
           taslakta "100.000 kg" -> "100.000kg" oluyordu). Outlook'un taslak
           düzenleyicisi satır içi öğelerdeki margin'i siliyor; bölünmez
           boşluk metnin parçası olduğu için hiçbir düzenleyici onu atmaz.
           Yan yana dizilen (satır yönlü) kaplarda araya bir bölünmez boşluk
           konur, margin de o kadar kısalır — tarayıcıda toplam aynı kalır.

           DÜĞÜM DÜĞÜM bakılır, çocuk ELEMENTLERE değil: ölçü hücresi
           "1.000" + <span>kg</span> biçimindedir, rakam düz metindir ve
           el.children onu hiç görmüyordu (ölçüldü).

           Sütun yönlü kaplar (paneller alt alta) DIŞARIDA kalır; oradaki
           boşluk satır arasıdır, araya metin konmaz. */
        var yanYana = o.yon !== 'column' && o.yon !== 'column-reverse';
        var bosluk = yanYana ? o.bosluk : 0;
        var NBSP_PX = 4;   /* bölünmez boşluğun bu ölçülerdeki yaklaşık eni */
        if (bosluk > 0) {
          var dugumler = [], dn;
          for (i = 0; i < el.childNodes.length; i++) {
            dn = el.childNodes[i];
            if (dn.nodeType === 1 || (dn.nodeType === 3 && String(dn.nodeValue).trim())) dugumler.push(dn);
          }
          for (i = 1; i < dugumler.length; i++) {
            el.insertBefore(belge.createTextNode('\u00a0'), dugumler[i]);
          }
        }
        /* SÜTUN YÖNLÜ KAP: çocuklar BLOK kalır (kullanıcı bildirimi,
           03.09.2026: Malzeme tablosu dar pencerede 933px'in altına
           inmiyordu). ÖLÇÜLDÜ: panelin sarmalayıcısı inline-block olunca
           kutu içeriğine göre daralıp genişliyor; tablodaki width:100%
           700px'lik pencereye değil, sarmalayıcının aldığı 933px'e
           çözülüyor ve tablo pencereden taşıyordu. Blok kap, kullanılabilir
           genişliği aynen geçirir. Satır yönlü kaplarda inline-block
           gerekiyor (öğeler yan yana dizilsin), orada değişmez. */
        for (i = 0; i < cocuklar.length; i++) {
          if (!yanYana) {
            cocuklar[i].__yuSutun = { alt: (i < cocuklar.length - 1) ? o.bosluk : 0 };
            continue;
          }
          cocuklar[i].__yuSatirIci = {
            hiza: o.hiza,
            sag: (bosluk > NBSP_PX && i < cocuklar.length - 1) ? (bosluk - NBSP_PX) : 0
          };
        }
      }
    } else if (g && g !== 'inline' && g.indexOf('table') !== 0 && g !== 'list-item') {
      st.push('display:' + g);
    }

    /* Üst kap SÜTUN yönlü flex idiyse çocuk tam genişlikte blok kalır;
       aradaki boşluk (gap) alt kenar boşluğuna döner — dikey margin'i
       Outlook silmiyor, sildiği satır içi öğelerin margin'iydi. */
    if (el.__yuSutun) {
      st = st.filter(function (s) {
        return s.indexOf('display:') !== 0 && s.indexOf('margin-bottom:') !== 0;
      });
      st.push('display:block');
      st.push('width:100%');
      st.push('box-sizing:border-box');
      if (el.__yuSutun.alt) st.push('margin-bottom:' + el.__yuSutun.alt + 'px');
    }

    /* Üst kap flex idiyse çocuğun yerleşimi onun dediği gibi olur. */
    if (el.__yuSatirIci) {
      st = st.filter(function (s) {
        return s.indexOf('display:') !== 0 && s.indexOf('vertical-align:') !== 0 && s.indexOf('margin-right:') !== 0;
      });
      st.push('display:inline-block');
      st.push('vertical-align:' + el.__yuSatirIci.hiza);
      if (el.__yuSatirIci.sag) st.push('margin-right:' + el.__yuSatirIci.sag + 'px');
    }

    /* KOLON GENİŞLİĞİ YÜZDEYLE YAZILIR, PİKSELLE DEĞİL (kullanıcı
       bildirimi, 03.09.2026: "çıkan maildeki başlık satır kısmı pek hizalı
       değil… tarayıcıda değil Outlook uygulamasında sorun oluyor").

       SEBEP ÖLÇÜLDÜ: tablo 1188px olarak yazılıyordu, Outlook'un yazma
       penceresi ise ~790px içerik genişliğinde. Outlook sığmayan tabloyu
       KENDİ yeniden diziyor ve sabit piksel genişliklerini yok sayıyor;
       başlık hücreleri (uzun, satır saran yazı) ile gövde hücreleri
       (nowrap rakam) farklı paylar alınca başlık satırı gövdeyle
       hizasını kaybediyordu. Tarayıcıda sorun görünmüyordu, çünkü orada
       tablo 1188px'e sığıyor ve piksel ölçüleri aynen uygulanıyordu.

       ÇÖZÜM: genişlik oransal verilir. Tablo %100, her BAŞLIK hücresi
       kâğıttaki payı kadar yüzde alır. Böylece pencere ne kadar dar
       olursa olsun kolonlar aynı oranda küçülür; başlık ile gövde tek
       kolon tanımını paylaştığı için hiza bozulamaz. Kâğıttaki oranlar
       birebir korunur, yalnız mutlak ölçü pencereye uyar. */
    if (etiket === 'table') {
      st.push('border-collapse:' + o.kenarBirlesik);
      st.push('border-spacing:' + o.kenarAralik);
      st.push('table-layout:fixed');
      st.push('width:100%');
      el.__yuTabloEni = o.kutu.width;
    } else if (etiket === 'th' || etiket === 'td') {
      st.push('box-sizing:border-box');
      /* Yüzde, hücrenin kendi tablosunun enine göre hesaplanır. colspan
         taşıyan hücre (yavru satırın başlığı) kendi payını zaten birden
         çok kolondan alır — ona genişlik yazılmaz, yoksa colspan'ın
         hesabıyla çakışır. */
      if (etiket === 'th' && el.colSpan === 1) {
        var tabloEl = el.parentNode;
        while (tabloEl && tabloEl.tagName !== 'TABLE') tabloEl = tabloEl.parentNode;
        var tabloEni = tabloEl && tabloEl.__yuTabloEni ? tabloEl.__yuTabloEni : 0;
        if (tabloEni > 0) {
          st.push('width:' + (Math.round(o.kutu.width / tabloEni * 10000) / 100) + '%');
        }
      }
    } else if (g === 'block' && o.genislik === 0 && String(el.textContent).trim()) {
      /* Kâğıt kuralı (tema.css .yu-satir-yavru): sıfır genişlikli blok,
         yazısı sağa taşar ama kolonu şişirmez. Aynen taşınır. */
      st.push('width:0px');
      st.push('min-width:0px');
      st.push('overflow:visible');
    }
    /* Metinsiz, çocuksuz kutu (yavru satırın bağ çizgisi gibi) ölçüsünü
       taşır; ölçüsü de yoksa atılır. */
    if (!cocuklar.length && !String(el.textContent).trim() && etiket !== 'img' && etiket !== 'br' && etiket !== 'td' && etiket !== 'th') {
      /* SIFIR GENİŞLİKLİ İZSİZ KUTU ATILIR (kullanıcı bildirimi,
         03.09.2026: rapor dar pencerede yine taşıyordu). ÖLÇÜLDÜ: Malzeme
         panelinin başlık şeridinde, tarih rozetinin kaldırıldığı BOŞ bir
         kutu kalıyor; eni 0 ama x=914'te duruyor ve sayfanın kaydırma
         genişliğini 790'dan 914'e çıkarıyordu — görünmeyen bir öğe yüzünden
         Outlook'ta yatay kaydırma çubuğu çıkardı. Zemini ya da kenar
         çizgisi olan boş kutular (yavru satırın dirsek çizgisi) DURUR. */
      if (o.kutu.width < 1 && (o.kutu.height < 1 || !o.izVar)) { el.parentNode.removeChild(el); return; }
      st.push('width:' + Math.round(o.kutu.width) + 'px');
      st.push('height:' + Math.round(o.kutu.height) + 'px');
      if (g === 'inline' || g === 'inline-block') {
        st = st.filter(function (s) { return s.indexOf('display:') !== 0; });
        st.push('display:inline-block');
      }
    }

    var atilacak = [], n;
    for (i = 0; i < el.attributes.length; i++) {
      n = el.attributes[i].name;
      if (n === 'colspan' || n === 'rowspan' || n === 'src' || n === 'width' || n === 'height' || n === 'alt') continue;
      atilacak.push(n);
    }
    for (i = 0; i < atilacak.length; i++) el.removeAttribute(atilacak[i]);
    el.setAttribute('style', st.join(';'));

    for (i = 0; i < cocuklar.length; i++) {
      c = cocuklar[i];
      if (c.parentNode) ogeyiDuzlestir(c, olcumler, belge, isler);
    }

    /* ÇOCUKLARI GİDEN KUTU DA GİDER — temizlik çocuklardan SONRA yapılır
       (kullanıcı bildirimi, 03.09.2026: rapor dar pencerede yatay kayıyordu).
       ÖLÇÜLDÜ: panel başlığının sağ yuvası, ekranda tarih rozetini taşıyor;
       kâğıt kuralı rozeti gizlediği için yuva BOŞALIYOR ama yukarıdaki
       "çocuksuz kutu" temizliğine takılmıyordu — o kontrol çalıştığı anda
       çocuklar HENÜZ duruyordu. Geriye eni sıfır, ama flex'in
       "margin-left:auto"su piksele çevrildiği için 894px sağa itilmiş boş
       bir kutu kalıyordu; sayfanın kaydırma genişliğini 790'dan 914'e
       çıkarıp Outlook'ta yatay kaydırma çubuğu çıkarıyordu.
       Zemini ya da kenar çizgisi olan boş kutular (yavru satırın dirsek
       çizgisi) DURUR — onların ekranda izi var. */
    if (!el.children.length && !String(el.textContent).trim() &&
        etiket !== 'img' && etiket !== 'br' && etiket !== 'td' && etiket !== 'th' && !o.izVar &&
        el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  /* Kâğıttaki raporun satır içi stilli HTML'i (Promise: ikonlar resme
     çevrilirken kısa bir bekleme olur). tarihIso: raporun günü. */
  function kagitRaporuHtml(cssMetni, tarihIso) {
    return new Promise(function (coz, reddet) {
      var cerceve = document.createElement('iframe');
      cerceve.setAttribute('aria-hidden', 'true');
      cerceve.setAttribute('tabindex', '-1');
      cerceve.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + (MAIL_GENISLIK + 60) +
        'px;height:1600px;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(cerceve);
      function bitir(hata, sonuc) {
        if (cerceve.parentNode) cerceve.parentNode.removeChild(cerceve);
        if (hata) reddet(hata); else coz(sonuc);
      }
      try {
        var belge = cerceve.contentDocument, pencere = cerceve.contentWindow;
        belge.open();
        /* data-tema="acik": koyu temada bile kâğıt beyazdır. */
        belge.write('<!doctype html><html lang="tr" data-tema="acik"><head><meta charset="utf-8"><style>' +
          (cssMetni || '') + '\n' + baskiKurallari(cssMetni) + '\n' + MAIL_BUYUTME +
          '\nhtml,body{margin:0;padding:0;background:#fff}</style></head><body></body></html>');
        belge.close();

        /* İkon sembolleri (index.html'deki sprite) çerçeveye de kopyalanır;
           yoksa <use href="#ic-…"> boş kalır. */
        var ornekIkon = document.getElementById('ic-doc');
        var sprite = ornekIkon ? ornekIkon.closest('svg') : null;
        if (sprite) belge.body.appendChild(belge.importNode(sprite, true));

        /* Künye: 10-kabuk.js'teki .yu-baski-bas'ın aynısı. Kurum adı
           ekrandaki künyeden okunur (kabuk sabiti dışarı açık değil). */
        var kurumEl = document.querySelector('.yu-baski-kurum');
        var kurum = kurumEl && kurumEl.textContent ? kurumEl.textContent : 'Doğuş Afyon Şeker Fabrikası';
        var tanim = YU.sayfalar && YU.sayfalar.anasayfa;
        var raporAdi = (tanim && tanim.baskiBasligi) || 'Yan Ürünler Stok Durum Raporu';
        var donem = null;
        try { donem = YU.donem.aktif(); } catch (e) { donem = null; }
        var kunye = YU.h('div', { sinif: 'yu-baski-bas yu-yalniz-baski' },
          YU.h('div', { sinif: 'yu-baski-kurum', metin: kurum }),
          YU.h('div', { sinif: 'yu-baski-satir' },
            YU.h('div', { sinif: 'yu-baski-ad', metin: raporAdi }),
            YU.h('div', { sinif: 'yu-baski-tarih', metin: YU.fmt.tarih(tarihIso) })),
          YU.h('div', { sinif: 'yu-baski-alt', metin: donem ? 'Kampanya ' + donem.ad : '' })
        );

        /* Paneller Ana Sayfa'daki çağrının aynısı (20-anasayfa.js); yalnız
           gün, panelin seçili günüdür. */
        var silo = typeof YU.siloStokPaneli === 'function' ? YU.siloStokPaneli(tarihIso) : null;
        var malzeme = typeof YU.malzemeStokPaneli === 'function' ? YU.malzemeStokPaneli(tarihIso) : null;
        if (!silo && !malzeme) { bitir(new Error('Rapor tabloları kurulamadı.')); return; }
        var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px' } }, silo, malzeme);
        var icerik = YU.h('div', { sinif: 'yu-icerik', stil: { width: MAIL_GENISLIK + 'px' } }, kunye, kap);   /* ÖLÇÜM için sabit; çıktıda yüzdeye çevrilir (aşağıda) */
        belge.body.appendChild(icerik);

        /* Yerleşim otursun diye kısa bir bekleme; sonra ölçülür. */
        pencere.setTimeout(function () {
          try {
            var isler = [], olcumler = new Map();
            olcumleriTopla(icerik, pencere, olcumler);   /* ÖNCE ölç (gerekçe yukarıda) */
            ogeyiDuzlestir(icerik, olcumler, belge, isler);
            Promise.all(isler).then(function () {
              /* Kök SABİT DEĞİL, ESNEK: genişlik yerine üst sınır yazılır.
                 Outlook'un yazma penceresi 1188px'den darsa (ki genelde
                 öyle) rapor pencereye uyar; genişse kâğıt oranını korur.
                 Sabit genişlik yazılsaydı Outlook tabloyu kendi yeniden
                 dizer ve başlık hizası bozulurdu (kolon yüzdesi notu). */
              icerik.setAttribute('style', icerik.getAttribute('style') + ';width:100%;max-width:' + MAIL_GENISLIK + 'px');
              bitir(null, {
                html: icerik.outerHTML,
                genislik: MAIL_GENISLIK,
                yukseklik: Math.ceil(icerik.getBoundingClientRect().height)
              });
            }, function (e) { bitir(e); });
          } catch (e) { bitir(e); }
        }, 30);
      } catch (e) { bitir(e); }
    });
  }

  /* Dışarıdan da çağrılabilir: kâğıttaki raporun kopyası (test ve yeniden
     kullanım için) — {html, xml, genislik, yukseklik}. */
  YU.mailRaporHtml = function (tarihIso) {
    return temaCssHazir().then(function (css) { return kagitRaporuHtml(css, tarihIso); });
  };

  /* Kullanıcının mesajı: satırlar korunur, HTML kaçışlanır.

     TIRNAK TEK OLMAK ZORUNDA (kullanıcı bildirimi, 03.09.2026: "yazdıklarım
     silik gözüküyor"). Yazı silik değildi — STİL HİÇ UYGULANMIYORDU:
     font-family'deki ÇİFT tırnak ("Helvetica Neue") style="…" özniteliğini
     erkenden kapatıyordu. Tarayıcı yalnız 'margin:0 0 10px;font-family:'
     kısmını okuyor, geri kalanı bozuk öznitelik sanıyordu; punto ve renk
     düşünce paragraf postanın varsayılan ufak gri yazısıyla çiziliyordu.
     Tablolarda aynı kusur yok: onların stili setAttribute ile konur,
     tarayıcı serileştirirken tırnağı kendisi kaçışlar.

     ÖLÇÜ PUNTO (pt) İLE YAZILIR, PİKSEL (px) İLE DEĞİL (kullanıcı
     bildirimi, 03.09.2026: "9 px olarak boyutlandırmışsın, 12 px olacak").
     Stil 12px yazıyordu ve doğruydu; ama Outlook yazı boyunu PUNTO gösterir
     ve 12px = 9pt olduğu için kutuda "9" okunuyordu. Kullanıcının ekranda
     gördüğü sayı 12 olsun diye ölçü doğrudan punto verilir: 12pt (=16px).
     Böylece Outlook'un yazı boyu kutusunda 12 yazar. */
  var MESAJ_STIL = "margin:0 0 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;" +
    'font-size:12pt;font-weight:400;line-height:1.5;color:#000000';

  function mesajHtml(metin) {
    var m = String(metin || '').replace(/\r\n?/g, '\n').replace(/\s+$/, '');
    if (!m) return '';
    var kacis = m.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var paragraflar = kacis.split(/\n{2,}/), cikti = '', i;
    for (i = 0; i < paragraflar.length; i++) {
      cikti += '<p style="' + MESAJ_STIL + '">' +
        paragraflar[i].replace(/\n/g, '<br>') + '</p>';
    }
    return cikti;
  }

  /* Postanın gövdesi: üstte rapor, altında ayraç ve kullanıcının mesajı
     (paneldeki sırayla — 26.08.2026: "altına da bizim mesajımız").

     RAPOR CANLI HTML'DİR, RESİM DEĞİL (kullanıcı direktifi, 03.09.2026:
     "raporu görsel olarak olmasın"). Aynı gün resim yolu da denenmişti:
     görüntü birebir oluyordu ama ileti çok parçalı (multipart/related)
     olmak zorundaydı ve YENİ OUTLOOK bu biçimde "Kime" satırını
     düşürüyordu — alıcılar taslakta boş geliyordu (ölçüldü). Tek parçalı
     HTML hem alıcıları taşır hem metni seçilebilir bırakır. */
  function postaGovdesi(raporHtml, mesaj) {
    var msj = mesajHtml(mesaj);
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>' +
      '<body style="margin:0;padding:0;background:#ffffff">' + raporHtml +
      (msj ? '<div style="width:100%;max-width:' + MAIL_GENISLIK + 'px;margin-top:18px;' +
             'padding-top:14px;border-top:2px solid #a89878">' + msj + '</div>' : '') +
      '</body></html>';
  }

  /* ------------------------------------------------------------------
     .EML TASLAĞI (RFC 822). "X-Unsent: 1" başlığı posta programına "bu
     ileti henüz gönderilmedi" der; Outlook onu okuma penceresinde değil,
     GÖNDERİLEBİLİR taslak penceresinde açar. Message-ID şart: yeni Outlook
     kimliksiz taslağı kaydedemiyordu (Microsoft Q&A 5594291, 2026 başı).
     Türkçe konu RFC 2047 ile, gövde base64 ile kodlanır — dosya tamamen
     ASCII kalır, hiçbir posta programı karakter setini şaşırmaz.
     ------------------------------------------------------------------ */
  function utf8Bayt(metin) { return new TextEncoder().encode(String(metin)); }

  function base64(baytlar) {
    var s = '', i, parca = 8192;
    for (i = 0; i < baytlar.length; i += parca) {
      s += String.fromCharCode.apply(null, baytlar.subarray(i, i + parca));
    }
    return btoa(s);
  }

  /* Kodlu başlık parçaları 45 bayttan uzun olamaz (RFC 2047 · 75 karakter
     sınırı) ve çok baytlı bir harf ikiye bölünemez; parçalar harf harf
     doldurulur. Parçalar arasındaki katlama boşluğunu alıcı yok sayar. */
  function kodluBaslik(metin) {
    var parcalar = [], simdiki = '', i, ch, aday;
    for (i = 0; i < metin.length; i++) {
      ch = metin.charAt(i);
      aday = simdiki + ch;
      if (utf8Bayt(aday).length > 45) { parcalar.push(simdiki); simdiki = ch; }
      else simdiki = aday;
    }
    if (simdiki) parcalar.push(simdiki);
    return parcalar.map(function (p) { return '=?UTF-8?B?' + base64(utf8Bayt(p)) + '?='; }).join('\r\n ');
  }

  function emlUret(alicilar, konu, html) {
    var CRLF = '\r\n';
    var kimlik = (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    var govde = base64(utf8Bayt(html)).replace(/(.{76})/g, '$1' + CRLF);
    return [
      'X-Unsent: 1',
      'Message-ID: <' + kimlik + '@yanurunler.local>',
      'Date: ' + new Date().toUTCString().replace(/GMT$/, '+0000'),
      /* FROM BAŞLIĞI YAZILMAZ (kullanıcı bildirimi, 03.09.2026: "kimden
         kısmına demo olarak bir mail girilmiş"). Başlık MIME geçerliliği
         için konmuştu ve Outlook'un onu yok saydığı sanılıyordu; taslak
         açılınca Kimden kutusunda rapor@yanurunler.local görünüyordu.
         Satır olmayınca Outlook kutuyu kendi varsayılan hesabıyla doldurur;
         kullanıcı isterse oradan değiştirir. */
      'To: ' + alicilar.join(', '),
      'Subject: ' + kodluBaslik(konu),
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      govde
    ].join(CRLF) + CRLF;
  }

  /* .EML İNDİRME (kullanıcı kararı, 03.09.2026 — "B yolu"). Aynı gün önce
     kaldırılmış, sonra 3-4 kullanıcının kendi bilgisayarından gönderebilmesi
     için geri getirilmişti: tarayıcının HTML taslağı kullanıcının
     Outlook'una ulaştırabildiği tek yol bu (dosya başındaki not).
     MIME türü message/rfc822 — Windows'un .eml → Outlook bağı ve Chrome'un
     "bu türü hep aç" ayarı bu türe bakar. */
  function emlIndir(dosyaAdi, eml) {
    var blob = new Blob([eml], { type: 'message/rfc822' });
    var url = URL.createObjectURL(blob);
    var bag = document.createElement('a');
    bag.href = url; bag.download = dosyaAdi;
    document.body.appendChild(bag); bag.click(); document.body.removeChild(bag);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
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

    /* İMZA YOK (kullanıcı direktifi, 03.09.2026: "Gönderen : X kişisi
       yazmasın, bunu kaldır"). 28.08'de eklenen "Gönderen : Ad Soyad" satırı
       kaldırıldı; gövdeye yalnız kullanıcının yazdığı gider. */
    function mesajMetni() { return String(mesajAlani.value).replace(/\s+$/, ''); }
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
        : 'Taslak dosyası iner, Outlook onu taslak olarak açar; gönderme oradan yapılır';
    }

    /* ---------------- eylemler ---------------- */

    /* GÖNDER = TASLAĞI İNDİR (kullanıcı kararı, 03.09.2026 — "B yolu").
       Program posta göndermez ve sunucuya "Outlook aç" demez: alıcılar,
       konu, kâğıttaki raporun HTML kopyası ve mesaj bir .eml dosyasına
       yazılır, dosya İNER. Kullanıcının bilgisayarı ayarlıysa Outlook
       taslağı kendiliğinden açar; son Gönder oradadır.
       Her yerde AYNI davranır — sunucunun başında da, ağdaki bilgisayarda
       da. "Gönderildi / taslak indirildi" bildirimi YOKTUR (kullanıcı
       direktifi): pencere kapanır, gerisi Outlook'ta olur. */
    function taslagiAc() {
      var adresler = seciliAdresler();
      if (!adresler.length) return;
      var tarihMetni = tarihMetniniAl();
      var dosyaAdi = 'Gunluk-Stok-Durumu-' + seciliTarih + '.eml';
      var eskiMetin = gonderDugmesi ? gonderDugmesi.textContent : '';
      if (gonderDugmesi) { gonderDugmesi.disabled = true; gonderDugmesi.textContent = 'Taslak hazırlanıyor…'; }
      function geriAl() {
        if (gonderDugmesi) gonderDugmesi.textContent = eskiMetin;
        durumuTazele();
      }
      temaCssHazir()
        .then(function (css) { return kagitRaporuHtml(css, seciliTarih); })
        .then(function (rapor) {
          var eml = emlUret(adresler, konuMetni(tarihMetni),
            postaGovdesi(rapor.html, mesajMetni()));
          emlIndir(dosyaAdi, eml);
          geriAl();
          if (modal && modal.kapat) modal.kapat();
        })
        ['catch'](function (e) {
          /* Rapor kurulamadıysa dosya İNMEZ; sebep pencerede yazar, mail
             penceresi açık kalır — adresler ve mesaj kaybolmasın. */
          geriAl();
          gonderilemediPenceresi({
            baslik: 'Rapor Hazırlanamadı',
            sebep: (e && e.message) ? e.message : String(e),
            cozum: 'Sayfayı yenileyip yeniden deneyin. Sürerse gün seçimini değiştirip bakın.'
          });
        });
    }

    /* GÖNDERİLEMEDİ PENCERESİ (kullanıcı direktifi, 03.09.2026: "eğer
       gönderilemiyorsa direkt gönderilemedi diye hata ver, taslak indirildi
       diye yapma, nedenini söyle"). Sebep ve çözüm ayrı satırlarda durur;
       sunucudan gelen cümle kısaltılmadan yazılır — düzeltmeyi yapacak
       olan kullanıcıdır. */
    function gonderilemediPenceresi(s) {
      var govde = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        YU.h('div', {
          stil: { display: 'flex', gap: '10px', alignItems: 'flex-start' }
        },
          YU.h('span', {
            stil: { flex: 'none', display: 'flex', color: 'var(--olumsuz)', marginTop: '1px' }
          }, YU.svg('#ic-alert', 18)),
          YU.h('div', { stil: { minWidth: '0' } },
            YU.h('div', { sinif: 'yu-etiket', metin: 'Sebep' }),
            YU.h('div', {
              metin: s.sebep,
              stil: { font: '400 14px/1.5 var(--font)', color: 'var(--metin-2)', marginTop: '3px' }
            }))
        ),
        s.cozum ? YU.h('div', { stil: { height: '1px', background: 'var(--ayrac-2)' } }) : null,
        s.cozum ? YU.h('div', null,
          YU.h('div', { sinif: 'yu-etiket', metin: 'Ne Yapmalı' }),
          YU.h('div', {
            metin: s.cozum,
            stil: { font: '400 14px/1.5 var(--font)', color: 'var(--metin-2)', marginTop: '3px' }
          })) : null
      );
      YU.ui.modal({
        baslik: s.baslik || 'Gönderilemedi',
        genislik: 520,
        govde: govde,
        dugmeler: [{ metin: 'Tamam', tur: 'birincil' }]
      });
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
        { metin: 'Gönder', ikon: '#ic-doc', tur: 'birincil', onClick: taslagiAc }
      ]
    });

    /* SMTP durum şeridi ("Mail girişi yapılı / tanımlı değil") KALDIRILDI
       (kullanıcı kararı, 03.09.2026): gönderim sunucudan değil Outlook'tan
       yapılıyor, şerit yanıltırdı. Mail Hesabı ekranı da menüden kalktı. */

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

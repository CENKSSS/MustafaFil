/* js/36-excel-indir.js — Günlük Stok Durumu raporunu Excel'e indir
   (kullanıcı isteği, 26.08.2026)

   ŞARTNAMEYE UYGUN EKTİR. §11 "Opsiyonel genişletmeler" dört madde sayar ve
   BİRİNCİSİ "Excel çıktısı"dır. Hiçbir hesap, doğrulama kuralı veya tabloya
   dokunmaz — yalnız okur.

   ---------------------------------------------------------------------
   NEDEN CSV DEĞİL, GERÇEK .xlsx
   ---------------------------------------------------------------------
   İlk sürüm CSV yazıyordu. Kullanıcı çıktısı (26.08.2026): "slotları,
   başlıkları falan okunmuyor". Haklı: CSV yalnız METİN taşır — kolon
   genişliği, kalın başlık, sayı biçimi taşıyamaz. Excel dosyayı varsayılan
   8 karakterlik kolonlarla açıyor, "Kamp. Toplam Üretim" başlığı kırpılıyordu.

   Bu yüzden dosya artık gerçek .xlsx'tir ve KÜTÜPHANE KULLANMAZ (§10 ek
   bağımlılık yasağı korunur): .xlsx bir ZIP içinde birkaç XML'dir; ZIP
   burada sıkıştırmasız (stored) yazılır, CRC-32 elle hesaplanır. Dosya
   şunları taşır:
     · her tablo AYRI SAYFA (kolon genişlikleri birbirine karışmasın),
     · içeriğe göre hesaplanmış kolon genişlikleri,
     · kalın, ortalanmış, satır saran başlık satırı,
     · sayılar GERÇEK SAYI ve #,##0.### biçiminde — Excel toplayabilir,
     · TOPLAM satırı kalın.

   TABLOLAR EKRANDAN OKUNUR, YENİDEN KURULMAZ. 35-mail-gonder.js ile aynı
   gerekçe: kolonlar burada elle yazılsaydı ekran değiştikçe geri kalırdı.
   Paneller (YU.siloStokPaneli / YU.malzemeStokPaneli) günü alıp kendi
   tablolarını üretir, buradaki dönüştürücü o tabloyu satır satır çevirir.

   SAYI HÜCRESİ: ekranda "95.650kg1.913 adet" gibi İKİ ÖLÇÜ olabilir. Bir
   hücreye iki sayı sığmaz; İLK ölçü yazılır — şartnamenin taban birimi kg'dır
   (§5), çuval adedi ondan türer. Kolon başlıkları ekrandakiyle birebir aynıdır.

   Not: bu dosya tarayıcıda çalışır ama DOM'a bağlı olmayan bölümü
   (YU.xlsxYaz) Node ile de sınanabilir; sınama böyle yapıldı. */
(function () {
  "use strict";

  var YU = window.YU || (window.YU = {});

  var PANEL_ADI = { silo: 'Silo Bazında Stok', malzeme: 'Malzeme Bazında Stok' };

  /* ==================================================================
     1. ZIP — sıkıştırmasız (stored) yazıcı
     ================================================================== */

  var CRC_TABLO = null;

  function crcTablosu() {
    if (CRC_TABLO) return CRC_TABLO;
    var t = new Int32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    CRC_TABLO = t;
    return t;
  }

  function crc32(bayt) {
    var t = crcTablosu(), c = 0 ^ (-1), i;
    for (i = 0; i < bayt.length; i++) c = (c >>> 8) ^ t[(c ^ bayt[i]) & 0xFF];
    return (c ^ (-1)) >>> 0;
  }

  function metinBayt(s) {
    return new TextEncoder().encode(s);
  }

  function yaz16(dizi, v) { dizi.push(v & 0xFF, (v >>> 8) & 0xFF); }
  function yaz32(dizi, v) {
    dizi.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF);
  }
  function baytEkle(dizi, bayt) {
    for (var i = 0; i < bayt.length; i++) dizi.push(bayt[i]);
  }

  /* Sabit DOS tarihi (01.01.2026 12:00): Date kullanmak dosyayı her seferinde
     değiştirir, sınamayı da belirsizleştirir. Excel bu alanı yalnız gösterir. */
  var DOS_SAAT = (12 << 11);
  var DOS_TARIH = ((2026 - 1980) << 9) | (1 << 5) | 1;

  /* dosyalar: [{ ad: 'xl/workbook.xml', metin: '<?xml…' }] */
  function zipYaz(dosyalar) {
    var cikti = [], merkez = [], ofset = 0, i;

    for (i = 0; i < dosyalar.length; i++) {
      var adBayt = metinBayt(dosyalar[i].ad);
      var veri = metinBayt(dosyalar[i].metin);
      var crc = crc32(veri);

      /* Yerel dosya başlığı */
      var bas = ofset;
      yaz32(cikti, 0x04034B50);
      yaz16(cikti, 20);            /* sürüm */
      yaz16(cikti, 0x0800);        /* bayrak: dosya adı UTF-8 */
      yaz16(cikti, 0);             /* yöntem: stored */
      yaz16(cikti, DOS_SAAT);
      yaz16(cikti, DOS_TARIH);
      yaz32(cikti, crc);
      yaz32(cikti, veri.length);   /* sıkıştırılmış boy = ham boy */
      yaz32(cikti, veri.length);
      yaz16(cikti, adBayt.length);
      yaz16(cikti, 0);             /* ek alan yok */
      baytEkle(cikti, adBayt);
      baytEkle(cikti, veri);
      ofset = cikti.length;

      /* Merkezî dizin kaydı — sonda topluca yazılır */
      yaz32(merkez, 0x02014B50);
      yaz16(merkez, 20);           /* yazan sürüm */
      yaz16(merkez, 20);           /* gereken sürüm */
      yaz16(merkez, 0x0800);
      yaz16(merkez, 0);
      yaz16(merkez, DOS_SAAT);
      yaz16(merkez, DOS_TARIH);
      yaz32(merkez, crc);
      yaz32(merkez, veri.length);
      yaz32(merkez, veri.length);
      yaz16(merkez, adBayt.length);
      yaz16(merkez, 0);            /* ek alan */
      yaz16(merkez, 0);            /* yorum */
      yaz16(merkez, 0);            /* disk */
      yaz16(merkez, 0);            /* iç öznitelik */
      yaz32(merkez, 0);            /* dış öznitelik */
      yaz32(merkez, bas);          /* yerel başlığın konumu */
      baytEkle(merkez, adBayt);
    }

    var merkezBas = cikti.length;
    baytEkle(cikti, merkez);
    yaz32(cikti, 0x06054B50);
    yaz16(cikti, 0);
    yaz16(cikti, 0);
    yaz16(cikti, dosyalar.length);
    yaz16(cikti, dosyalar.length);
    yaz32(cikti, merkez.length);
    yaz32(cikti, merkezBas);
    yaz16(cikti, 0);               /* arşiv yorumu yok */

    return new Uint8Array(cikti);
  }

  /* ==================================================================
     2. XLSX — parçalar
     ================================================================== */

  function xmlKac(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  /* 1 -> A, 27 -> AA */
  function kolonAdi(n) {
    var ad = '';
    while (n > 0) {
      var k = (n - 1) % 26;
      ad = String.fromCharCode(65 + k) + ad;
      n = (n - k - 1) / 26;
    }
    return ad;
  }

  /* Sayfa adı: Excel 31 karakteri ve  : \ / ? * [ ]  karakterlerini kabul etmez. */
  function sayfaAdi(ad) {
    return String(ad).replace(/[:\\\/?*\[\]]/g, ' ').slice(0, 31);
  }

  /* Kolon genişliği için gösterim uzunluğu: sayı binlik ayraçla yazılınca
     kaç karakter tutuyorsa o. */
  function gosterimBoyu(deger) {
    if (deger === null || deger === undefined || deger === '') return 0;
    if (typeof deger !== 'number') return String(deger).length;
    var tam = Math.abs(Math.trunc(deger)).toString();
    var ayrac = Math.floor((tam.length - 1) / 3);
    var ondalik = String(deger).indexOf('.') >= 0 ? 4 : 0;
    return tam.length + ayrac + ondalik + (deger < 0 ? 1 : 0);
  }

  var BICIM = { METIN: 0, SAYI: 1, BASLIK: 2, BASLIK_BUYUK: 3, TOPLAM_SAYI: 4, TOPLAM_METIN: 5 };

  function hucreXml(sutun, satirNo, deger, bicim) {
    var ref = kolonAdi(sutun) + satirNo;
    if (deger === null || deger === undefined || deger === '') {
      return bicim ? '<c r="' + ref + '" s="' + bicim + '"/>' : '';
    }
    if (typeof deger === 'number') {
      return '<c r="' + ref + '" s="' + bicim + '"><v>' + deger + '</v></c>';
    }
    return '<c r="' + ref + '" t="inlineStr" s="' + bicim + '"><is><t xml:space="preserve">' +
      xmlKac(deger) + '</t></is></c>';
  }

  /* sayfa: { ad, baslik, altBaslik, basliklar:[..], satirlar:[[..]] } */
  function sayfaXml(sayfa) {
    var satirlar = sayfa.satirlar || [], basliklar = sayfa.basliklar || [];
    var kolonSayisi = basliklar.length, i, j;
    for (i = 0; i < satirlar.length; i++) {
      if (satirlar[i].length > kolonSayisi) kolonSayisi = satirlar[i].length;
    }

    /* Kolon genişliği = en uzun içerik + pay; başlık satır sardığı için
       başlık uzunluğu yarı ağırlıkla sayılır, yoksa kolonlar boşuna şişerdi. */
    var genislik = [];
    for (j = 0; j < kolonSayisi; j++) {
      var en = Math.ceil(gosterimBoyu(basliklar[j]) / 2);
      for (i = 0; i < satirlar.length; i++) {
        var b = gosterimBoyu(satirlar[i][j]);
        if (b > en) en = b;
      }
      genislik.push(Math.min(46, Math.max(9, en + 3)));
    }

    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

    /* Başlık satırı donar: uzun listede aşağı inince kolon adları ekranda
       kalır. sheetViews, cols'tan ÖNCE gelmek zorundadır (şema sırası). */
    x += '<sheetViews><sheetView workbookViewId="0">' +
      '<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>' +
      '</sheetView></sheetViews>';

    x += '<cols>';
    for (j = 0; j < kolonSayisi; j++) {
      x += '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' +
        genislik[j] + '" customWidth="1"/>';
    }
    x += '</cols><sheetData>';

    var no = 1;
    x += '<row r="' + no + '" ht="19" customHeight="1">' +
      hucreXml(1, no, sayfa.baslik, BICIM.BASLIK_BUYUK) + '</row>';
    no++;
    x += '<row r="' + no + '">' + hucreXml(1, no, sayfa.altBaslik, BICIM.METIN) + '</row>';
    no++;
    no++;   /* boş satır */

    x += '<row r="' + no + '" ht="30" customHeight="1">';
    for (j = 0; j < kolonSayisi; j++) {
      x += hucreXml(j + 1, no, basliklar[j] || '', BICIM.BASLIK);
    }
    x += '</row>';

    for (i = 0; i < satirlar.length; i++) {
      no++;
      var toplamMi = String(satirlar[i][0] || '').toUpperCase().indexOf('TOPLAM') === 0;
      x += '<row r="' + no + '">';
      for (j = 0; j < kolonSayisi; j++) {
        var d = satirlar[i][j];
        var bicim = typeof d === 'number'
          ? (toplamMi ? BICIM.TOPLAM_SAYI : BICIM.SAYI)
          : (toplamMi ? BICIM.TOPLAM_METIN : BICIM.METIN);
        x += hucreXml(j + 1, no, d, bicim);
      }
      x += '</row>';
    }

    return x + '</sheetData></worksheet>';
  }

  var STILLER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.###"/></numFmts>' +
    '<fonts count="3">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="13"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE9EDF4"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"><color rgb="FF9AA3B2"/></bottom><diagonal/></border>' +
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="6">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
        '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  /* sayfalar: [{ ad, baslik, altBaslik, basliklar, satirlar }] -> Uint8Array */
  YU.xlsxYaz = function (sayfalar) {
    var i, dosyalar = [];

    var tipler = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    for (i = 0; i < sayfalar.length; i++) {
      tipler += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ' +
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }
    tipler += '</Types>';

    var kokIliski = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    var kitap = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    var kitapIliski = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (i = 0; i < sayfalar.length; i++) {
      kitap += '<sheet name="' + xmlKac(sayfaAdi(sayfalar[i].ad)) + '" sheetId="' + (i + 1) +
        '" r:id="rId' + (i + 1) + '"/>';
      kitapIliski += '<Relationship Id="rId' + (i + 1) +
        '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
        'Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }
    kitap += '</sheets></workbook>';
    kitapIliski += '<Relationship Id="rId' + (sayfalar.length + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ' +
      'Target="styles.xml"/></Relationships>';

    dosyalar.push({ ad: '[Content_Types].xml', metin: tipler });
    dosyalar.push({ ad: '_rels/.rels', metin: kokIliski });
    dosyalar.push({ ad: 'xl/workbook.xml', metin: kitap });
    dosyalar.push({ ad: 'xl/_rels/workbook.xml.rels', metin: kitapIliski });
    dosyalar.push({ ad: 'xl/styles.xml', metin: STILLER });
    for (i = 0; i < sayfalar.length; i++) {
      dosyalar.push({ ad: 'xl/worksheets/sheet' + (i + 1) + '.xml', metin: sayfaXml(sayfalar[i]) });
    }

    return zipYaz(dosyalar);
  };

  /* Node ile sınanabilsin diye dışa da verilir; tarayıcıda kullanılmaz. */
  if (typeof module === 'object' && module.exports) module.exports = YU;

  /* ==================================================================
     3. Ekrandaki tabloyu okuma
     ================================================================== */

  /* Sayısal hücre (td.yu-mono): ilk ölçü sayıya çevrilir. "—" ve boş geçer. */
  function sayiCoz(metin) {
    var t = String(metin == null ? '' : metin).replace(/ /g, ' ').trim();
    if (!t || t === '—' || t === '-') return '';
    var m = t.match(/-?−?\s*\d[\d.]*(?:,\d+)?/);
    if (!m) return t;                         /* sayı değilse metni koru */
    var eksi = /^[-−]/.test(m[0].trim());
    var ham = m[0].replace(/[-−\s]/g, '').replace(/\./g, '').replace(',', '.');
    var n = Number(ham);
    if (isNaN(n)) return t;
    return eksi ? -n : n;
  }

  /* Metin hücresi: ad ve rozet ayrı elemanlarda durur; innerText onları
     bitiştirip "Kuru Küspe (50 Kg)Çuvallı" yapıyor. Yaprak elemanlar tek tek
     okunup ' · ' ile birleştirilir. */
  function metinCoz(hucre) {
    var yaprak = hucre.querySelectorAll('span, div'), parca = [], i, t;
    for (i = 0; i < yaprak.length; i++) {
      if (yaprak[i].children.length) continue;
      t = (yaprak[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t !== '—') parca.push(t);
    }
    if (!parca.length) {
      t = (hucre.textContent || '').replace(/\s+/g, ' ').trim();
      return t === '—' ? '' : t;
    }
    return parca.join(' · ');
  }

  function hucreCoz(hucre) {
    return hucre.classList.contains('yu-mono') ? sayiCoz(hucre.textContent) : metinCoz(hucre);
  }

  function tabloOku(tablo) {
    var basliklar = [], satirlar = [], i, j;

    var th = tablo.querySelectorAll('thead th');
    for (i = 0; i < th.length; i++) {
      basliklar.push((th[i].textContent || '').replace(/\s+/g, ' ').trim());
    }

    var trler = tablo.querySelectorAll('tbody tr');
    for (i = 0; i < trler.length; i++) {
      var hucreler = trler[i].cells, satir = [];
      for (j = 0; j < hucreler.length; j++) satir.push(hucreCoz(hucreler[j]));
      satirlar.push(satir);
    }
    return { basliklar: basliklar, satirlar: satirlar };
  }

  /* ==================================================================
     4. İndirme
     ================================================================== */

  function gununTablosu(anahtar, tarihIso) {
    var kur = anahtar === 'silo' ? YU.siloStokPaneli : YU.malzemeStokPaneli;
    if (typeof kur !== 'function') return null;
    var kap = kur(tarihIso);
    return kap ? kap.querySelector('table.yu-tablo') : null;
  }

  /* Dosya adı projedeki diğer dışa aktarmalarla aynı kalıpta:
     'ad-YYYY-AA-GG' (bkz. 23-stok-durumu, 32-tum-hareketler). */
  function dosyaAdi(tarihIso) {
    return 'gunluk-stok-durumu-' + tarihIso + '.xlsx';
  }

  function baytIndir(ad, bayt) {
    var url = URL.createObjectURL(new Blob([bayt], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    var a = YU.h('a', { href: url, download: ad, stil: { display: 'none' } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    YU.ui.bildir('Excel indirildi: ' + ad, 'basari');
  }

  /* tarihIso verilmezse kampanya görünümünün son günü (Ana Sayfa açılışı). */
  YU.excelIndir = function (tarihIso) {
    var tarih = tarihIso || (YU.donem && YU.donem.gorunumSonu ? YU.donem.gorunumSonu() : null);
    if (!YU.db || !tarih) {
      YU.ui.bildir('Dışa aktarılacak veri yok.', 'uyari');
      return;
    }

    var donem = YU.donem && YU.donem.aktif ? YU.donem.aktif() : null;
    var altBaslik = YU.fmt.tarih(tarih) + ' · ' + YU.fmt.gunAdi(tarih) +
      (donem ? ' · Kampanya ' + donem.ad : '');

    var anahtarlar = ['silo', 'malzeme'], sayfalar = [], i, tablo, okunan;
    for (i = 0; i < anahtarlar.length; i++) {
      tablo = gununTablosu(anahtarlar[i], tarih);
      if (!tablo) continue;
      okunan = tabloOku(tablo);
      sayfalar.push({
        ad: PANEL_ADI[anahtarlar[i]],
        baslik: PANEL_ADI[anahtarlar[i]],
        altBaslik: altBaslik,
        basliklar: okunan.basliklar,
        satirlar: okunan.satirlar
      });
    }

    if (!sayfalar.length) {
      YU.ui.bildir('Dışa aktarılacak tablo yok.', 'uyari');
      return;
    }

    baytIndir(dosyaAdi(tarih), YU.xlsxYaz(sayfalar));
  };
})();

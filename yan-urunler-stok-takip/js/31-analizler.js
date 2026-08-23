/* js/31-analizler.js — Analizler ekranı (Yönetim Paneli, yalnızca Yönetici).

   Seçilen geçmiş kampanya ile bu kampanya, TAKVİM TARİHİNE GÖRE DEĞİL
   KAMPANYA GÜNÜNE GÖRE karşılaştırılır (kullanıcı isteği, 23.08.2026):
     * Devir günü kampanyanın 1. günüdür (Şartname §2: devir stok kampanya
       başında girilir; YU.donem.liste() -> bas).
     * Bugün bu kampanyanın kaçıncı günüyse (N), geçmiş kampanyanın da
       N. günü karşısına konur. 22.07'de başlayan kampanyada 20.08 = 30. gün;
       10.06'da başlayan kampanyada 30. gün = 09.07.
     * Bugün son kayıtlı günden ilerideyse N son kayıtlı güne çekilir.
   ANALİZ PENCERESİ varsayılan olarak kampanyanın TAMAMIDIR (devir gününden
   bugüne). Üstteki tarih aralığı seçicisiyle daraltılabilir; seçim gün
   sırasına çevrilir, geçmiş kampanya aynı gün sıralarıyla karşılaştırılır.
   Geçmiş kampanyanın kaydı erken bitiyorsa bu, pencereyi kısaltmaz —
   yalnızca farkın hesaplanabildiği son günü kısıtlar ve ekranda düz
   Türkçeyle söylenir (kullanıcı düzeltmesi, 23.08.2026).
   Grafikte mavi = bu kampanya, kırmızı = geçmiş kampanya.

   Ekranın üstünde SORU KUTUSU durur (kullanıcı isteği, 23.08.2026): Türkçe
   yazılan soru YU.soru ile çözümlenir, cevap YU.analiz'in hesapladığı
   rakamlarla kurulur ve yanına grafiği çizilir. Hesap ekranla ortaktır —
   cevapta geçen sayı ile tablodaki sayı aynı koddan gelir.

   Görsel dil: design-reference/accounting-dashboard artboard 2a (açık) / 1b (koyu).
   SÖZLEŞME §6 (UI imzaları), §9 (sınıf adları).
   Dosya yüklenirken hiçbir şey çizmez; yalnızca YU.sayfaTanimla çağırır. */
(function () {
  'use strict';

  var YU = window.YU;

  var SAYFA = 'analizler';
  var RENK_BU = 'var(--vurgu)';        /* mavi — bu kampanya */
  var RENK_GECMIS = 'var(--olumsuz)';  /* kırmızı — geçmiş kampanya */
  var GRAFIK_YUKSEKLIK = 240;

  /* Son soru ve cevabı ekranda kalır: gösterge seçimi değişip sayfa yeniden
     çizilince cevap kaybolmamalı. */
  var sonSoru = { metin: '', cevap: null };

  /* ------------------------------------------------------------------
     Küçük yardımcılar
     ------------------------------------------------------------------ */

  function miktar(v, birim) {
    if (v === null || v === undefined || !isFinite(Number(v))) return '—';
    return birim === 'adet' ? YU.fmt.sayi(v) + ' adet' : YU.fmt.kgU(v);
  }

  /* KPI değeri: sayı büyük, birim küçük (YU.ui.olcu). */
  function olcu(v, birim) {
    if (v === null || v === undefined || !isFinite(Number(v))) return '—';
    return YU.ui.olcu([{ sayi: birim === 'adet' ? YU.fmt.sayi(v) : YU.fmt.kg(v), birim: birim }], 'sol');
  }

  /* Eksen birimi grafiğin TAVANINA göre seçilir: küçük ölçekte '0,75 ton'
     okunmuyor, büyük ölçekte '1.000.000 kg' eksene sığmıyor. */
  var TON_ESIGI = 10000;
  function eksenMetni(birim) {
    if (birim === 'adet') return function (v) { return YU.fmt.sayi(v); };
    return function (v, tavan) {
      return (Number(tavan) || 0) >= TON_ESIGI ? YU.fmt.ton(v) : YU.fmt.kg(v) + ' kg';
    };
  }

  function gunMetni(n) { return YU.fmt.sayi(n) + '. gün'; }

  function isaretli(v) {
    return (v > 0 ? '+' : (v < 0 ? '-' : '')) + YU.fmt.kg(Math.abs(v));
  }

  function yuzdeMetni(p) {
    if (p === null || !isFinite(p)) return '—';
    return (p > 0 ? '+' : (p < 0 ? '-' : '')) + YU.fmt.yuzde(Math.abs(p));
  }

  function farkTuru(d) {
    if (d === null || !isFinite(d) || d === 0) return 'notr';
    return d > 0 ? 'olumlu' : 'olumsuz';
  }

  var RENK_METIN = {
    olumlu: 'var(--olumlu)', olumsuz: 'var(--olumsuz)',
    bekleyen: 'var(--bekleyen)', vurgu: 'var(--vurgu)', notr: 'var(--metin-4)'
  };

  /* ------------------------------------------------------------------
     Ekran durumu — URL parametrelerinden
     Veri ve hesap YU.analiz'den gelir (js/33-analiz-veri.js).
     ------------------------------------------------------------------ */

  function durum(depo, param) {
    param = param || {};
    var b = parseInt(param.basGun, 10), t = parseInt(param.bitGun, 10);
    var aralik = (isFinite(b) || isFinite(t))
      ? { basGun: isFinite(b) ? b : null, bitGun: isFinite(t) ? t : null } : null;
    var ozet = YU.analiz.ozet(depo, param.bu || null, param.karsi || null, aralik);
    if (!ozet) return null;
    ozet.gosterge = YU.analiz.gostergeBul(ozet.gostergeler, param.gosterge) || ozet.gostergeler[0] || null;
    ozet.mod = param.mod === 'birikimli' ? 'birikimli' : 'gunluk';
    return ozet;
  }

  function bagKur(d, ek) {
    var p = {
      bu: d.bu.donem.ad,
      karsi: d.gecmis ? d.gecmis.donem.ad : null,
      gosterge: d.gosterge ? d.gosterge.kod : null,
      mod: d.mod,
      basGun: d.tamAralikMi ? null : d.basGun,
      bitGun: d.tamAralikMi ? null : d.bitGun
    };
    if (ek) for (var k in ek) if (Object.prototype.hasOwnProperty.call(ek, k)) p[k] = ek[k];
    return p;
  }

  /* Seçili aralığın gün etiketi: "1–30. gün". */
  function aralikMetni(d) {
    return YU.fmt.sayi(d.basGun) + '–' + gunMetni(d.bitGun);
  }

  /* Aynı gün sıralarının geçmiş kampanyada denk geldiği takvim aralığı. */
  function gecmisAralikMetni(d) {
    if (!d.gecmis) return null;
    return YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, d.basGun)) + ' – ' +
      YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, Math.min(d.bitGun, d.gecmis.sonGun)));
  }

  /* ==================================================================
     1. Soru kutusu
     ================================================================== */

  function soruPaneli(depo) {
    var alan = YU.ui.alan({
      tip: 'metin',
      yerTutucu: 'Örnek: geçen seneye göre nasıl ilerliyoruz?'
    });
    alan.kok.style.flex = '1';
    alan.kok.style.minWidth = '0';
    if (sonSoru.metin) alan.ayarla(sonSoru.metin);

    function sor(metin) {
      var soru = metin === undefined ? alan.deger() : metin;
      if (!soru || !String(soru).trim()) { alan.odakla(); return; }
      sonSoru.metin = soru;
      sonSoru.cevap = YU.soru.cevapla(depo, soru);
      YU.yenile();
    }

    alan.girdi.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sor(); }
    });

    var dugme = YU.ui.dugme({ metin: 'Sor', ikon: '#ic-search', tur: 'birincil', onClick: function () { sor(); } });
    var temizle = YU.ui.dugme({
      metin: 'Temizle', tur: 'sade', kucuk: true,
      onClick: function () { sonSoru.metin = ''; sonSoru.cevap = null; YU.yenile(); }
    });

    var satir = YU.h('div', { stil: { display: 'flex', gap: '8px', alignItems: 'flex-end' } },
      alan.kok, dugme, sonSoru.cevap ? temizle : null);

    /* Hazır sorular: tıklanınca doğrudan sorulur. */
    var ornekler = YU.soru.ornekler();
    var cipler = YU.h('div', {
      stil: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }
    });
    for (var i = 0; i < ornekler.length; i++) {
      (function (metin) {
        cipler.appendChild(YU.h('button', {
          tip: 'button', metin: metin,
          stil: {
            font: '400 12px/1 var(--font)', color: 'var(--metin-3)',
            background: 'var(--yuzey-3)', border: '1px solid var(--kenar)',
            borderRadius: '999px', padding: '6px 11px', cursor: 'pointer'
          },
          onClick: function () { alan.ayarla(metin); sor(metin); }
        }));
      })(ornekler[i]);
    }

    return YU.ui.panel({
      baslik: 'Soru Sor',
      ikon: '#ic-search',
      sag: 'Türkçe harf kullanmak zorunlu değil',
      govde: [satir, cipler]
    });
  }

  /* ==================================================================
     2. Cevap kartı
     ================================================================== */

  /* "Anladığım" şeridi — motorun ne anladığı MUTLAKA görünür. Yanlış okuma
     sessiz kalmasın; kullanıcı rozetlere bakıp sorusunu düzeltebilsin. */
  function anlamSeridi(cevap) {
    if (!cevap.anlam || !cevap.anlam.length) return null;
    var kap = YU.h('div', {
      stil: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }
    }, YU.h('span', {
      metin: 'Anladığım:',
      stil: { font: '400 12px/1 var(--font)', color: 'var(--metin-4)', marginRight: '2px' }
    }));
    for (var i = 0; i < cevap.anlam.length; i++) {
      kap.appendChild(YU.ui.rozet(cevap.anlam[i], i === 0 ? 'vurgu' : 'notr'));
    }
    return kap;
  }

  /* Yazılan kelime ile anlaşılan terim farklıysa gösterilir: yazım hatası
     düzeltmesi de, yanlış eşleşme de burada görünür. */
  function duzeltmeSeridi(cevap) {
    if (!cevap.eslesmeler) return null;
    var farklar = [], i;
    for (i = 0; i < cevap.eslesmeler.length; i++) {
      var e = cevap.eslesmeler[i];
      if (e.birebir) continue;
      farklar.push(e.yazilan + ' → ' + e.anlasilan);
    }
    if (!farklar.length) return null;
    return YU.h('div', {
      sinif: 'yu-yardim',
      metin: 'Okuduğum: ' + farklar.join(' · '),
      stil: { marginTop: '2px' }
    });
  }

  function cevapSatirlari(cevap) {
    if (!cevap.satirlar || !cevap.satirlar.length) return null;
    var satirlar = [], i;
    for (i = 0; i < cevap.satirlar.length; i++) {
      var s = cevap.satirlar[i];
      var deger = s.deger;
      satirlar.push([
        s.etiket,
        s.tur ? YU.h('span', { metin: String(deger), stil: { color: RENK_METIN[s.tur] || 'var(--metin)' } }) : String(deger)
      ]);
    }
    return YU.ui.tablo({
      sutunlar: [{ baslik: '', genislik: 240 }, { baslik: '', hiza: 'sol' }],
      satirlar: satirlar
    });
  }

  function guvenRozeti(cevap) {
    if (typeof cevap.guven !== 'number') return null;
    var y = Math.round(cevap.guven * 100);
    var tur = cevap.guven >= 0.75 ? 'olumlu' : (cevap.guven >= 0.45 ? 'bekleyen' : 'olumsuz');
    return YU.ui.rozet('Güven %' + y, tur);
  }

  function oneriCipleri(oneriler, depo) {
    if (!oneriler || !oneriler.length) return null;
    var kap = YU.h('div', { stil: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' } });
    for (var i = 0; i < oneriler.length; i++) {
      (function (metin) {
        kap.appendChild(YU.h('button', {
          tip: 'button', metin: metin,
          stil: {
            font: '400 12px/1 var(--font)', color: 'var(--vurgu)',
            background: 'var(--vurgu-zemin)', border: '1px solid transparent',
            borderRadius: '999px', padding: '6px 11px', cursor: 'pointer'
          },
          onClick: function () {
            sonSoru.metin = metin;
            sonSoru.cevap = YU.soru.cevapla(depo, metin);
            YU.yenile();
          }
        }));
      })(oneriler[i]);
    }
    return kap;
  }

  function cevapKarti(depo, cevap, d) {
    var govde = [];
    var anlam = anlamSeridi(cevap);
    if (anlam) govde.push(anlam);

    govde.push(YU.h('div', {
      metin: cevap.baslik,
      stil: {
        font: (cevap.basarili ? '500' : '400') + ' 15.5px/1.55 var(--font)',
        color: cevap.basarili ? 'var(--metin)' : 'var(--metin-3)',
        marginTop: anlam ? '4px' : '0'
      }
    }));

    var duzeltme = duzeltmeSeridi(cevap);
    if (duzeltme) govde.push(duzeltme);

    var tablo = cevapSatirlari(cevap);
    if (tablo) {
      tablo.style.marginTop = '4px';
      tablo.style.border = '1px solid var(--kenar)';
      tablo.style.borderRadius = 'var(--r)';
      govde.push(tablo);
    }

    var g1 = grafikCiz(cevap.grafik);
    if (g1) govde.push(grafikKutusu(cevap.grafik.baslik, g1));
    var g2 = grafikCiz(cevap.ikinciGrafik);
    if (g2) govde.push(grafikKutusu(cevap.ikinciGrafik.baslik, g2));

    var oneri = oneriCipleri(cevap.oneriler, depo);
    if (oneri) govde.push(oneri);

    /* Cevabın kaynağı ekranda açılabilsin: aynı gösterge, aynı dönem. */
    if (cevap.bag && cevap.basarili) {
      govde.push(YU.h('div', { stil: { display: 'flex', gap: '8px', marginTop: '4px' } },
        YU.ui.dugme({
          metin: cevap.bag.kod === SAYFA ? 'Bu Sayfada Aç' : 'İlgili Ekranı Aç',
          ikon: '#ic-chart', tur: 'ikincil', kucuk: true,
          onClick: function () { YU.git(cevap.bag.kod, cevap.bag.param); }
        })
      ));
    }

    return YU.ui.panel({
      baslik: 'Cevap',
      ikon: '#ic-doc',
      sag: cevap.basarili ? guvenRozeti(cevap) : YU.ui.rozet('Anlaşılmadı', 'olumsuz'),
      govde: govde
    });
  }

  function grafikKutusu(baslik, icerik) {
    return YU.h('div', {
      stil: {
        border: '1px solid var(--kenar)', borderRadius: 'var(--r-l)',
        padding: '14px 16px', marginTop: '4px'
      }
    },
      YU.h('div', {
        metin: baslik || '',
        stil: { font: '500 13px/1.2 var(--font)', color: 'var(--metin-3)', marginBottom: '12px' }
      }),
      icerik
    );
  }

  /* ==================================================================
     3. Grafik tanımından çizim
     Cevap motoru yalnızca TANIM üretir (hangi seri, hangi renk, hangi
     nokta); çizim burada, ekranın grafik diliyle yapılır.
     ================================================================== */

  function grafikCiz(spec) {
    if (!spec) return null;
    if (spec.tur === 'karsilastirma') {
      return YU.ui.karsilastirmaGrafik({
        noktalar: spec.noktalar,
        seri1: spec.seri1,
        seri2: spec.seri2,
        yukseklik: GRAFIK_YUKSEKLIK,
        bicim: function (v) { return miktar(v, spec.birim); },
        eksenBicim: eksenMetni(spec.birim)
      });
    }
    if (spec.tur === 'sira') return siraCubuklari(spec);
    if (spec.tur === 'deger') return degerCubuklari(spec);
    return null;
  }

  /* Yüzde çubukları — tasarım referansındaki "Gider Kategorileri" dili. */
  function siraCubuklari(spec) {
    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '11px' } });
    if (!spec.ogeler || !spec.ogeler.length) {
      return YU.h('div', { sinif: 'yu-bos-metin', metin: 'Karşılaştırılabilir kalem yok.' });
    }
    for (var i = 0; i < spec.ogeler.length; i++) {
      var o = spec.ogeler[i];
      var oran = spec.enBuyuk > 0 ? Math.min(1, Math.abs(o.yuzde) / spec.enBuyuk) : 0;
      kap.appendChild(YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '12px' } },
        YU.h('div', {
          metin: o.ad,
          stil: {
            flex: '0 0 200px', minWidth: '0', font: '400 12.5px/1.3 var(--font)',
            color: 'var(--metin-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }
        }),
        YU.h('div', { stil: { flex: '1', minWidth: '60px' } }, YU.ui.cubuk(oran, o.tur)),
        YU.h('div', {
          metin: yuzdeMetni(o.yuzde),
          stil: {
            flex: '0 0 76px', textAlign: 'right', font: '500 12.5px/1 var(--sayi)',
            color: RENK_METIN[o.tur] || 'var(--metin)', fontVariantNumeric: 'tabular-nums'
          }
        }),
        YU.h('div', {
          metin: (o.deger > 0 ? '+' : (o.deger < 0 ? '-' : '')) +
            (o.birim === 'adet' ? YU.fmt.sayi(Math.abs(o.deger)) + ' adet' : YU.fmt.kgU(Math.abs(o.deger))),
          stil: {
            flex: '0 0 130px', textAlign: 'right', font: '400 12px/1 var(--sayi)',
            color: 'var(--metin-4)', fontVariantNumeric: 'tabular-nums'
          }
        })
      ));
    }
    return kap;
  }

  /* Mutlak değer çubukları — stok ve silo dökümü. */
  function degerCubuklari(spec) {
    var kap = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '11px' } });
    if (!spec.ogeler || !spec.ogeler.length) {
      return YU.h('div', { sinif: 'yu-bos-metin', metin: 'Gösterilecek kayıt yok.' });
    }
    for (var i = 0; i < spec.ogeler.length; i++) {
      var o = spec.ogeler[i];
      kap.appendChild(YU.h('div', { stil: { display: 'flex', alignItems: 'center', gap: '12px' } },
        YU.h('div', {
          metin: o.ad,
          stil: {
            flex: '0 0 200px', minWidth: '0', font: '400 12.5px/1.3 var(--font)',
            color: 'var(--metin-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }
        }),
        YU.h('div', { stil: { flex: '1', minWidth: '60px' } }, YU.ui.cubuk(o.oran || 0, o.tur)),
        YU.h('div', {
          metin: (o.birim === 'adet' ? YU.fmt.sayi(o.deger) + ' adet' : YU.fmt.kgU(o.deger)) +
            (o.ek ? ' · ' + o.ek : ''),
          stil: {
            flex: '0 0 200px', textAlign: 'right', font: '500 12.5px/1 var(--sayi)',
            color: RENK_METIN[o.tur] || 'var(--metin)', fontVariantNumeric: 'tabular-nums'
          }
        })
      ));
    }
    return kap;
  }

  /* ==================================================================
     4. Ayar paneli — dönem, gösterge, görünüm
     ================================================================== */

  function ayarPaneli(d) {
    var buSecenek = [], karsiSecenek = [], gostergeSecenek = [], i;
    for (i = d.donemler.length - 1; i >= 0; i--) {
      buSecenek.push({ deger: d.donemler[i].ad, metin: 'Kampanya ' + d.donemler[i].ad });
      if (d.donemler[i].ad !== d.bu.donem.ad) {
        karsiSecenek.push({ deger: d.donemler[i].ad, metin: 'Kampanya ' + d.donemler[i].ad });
      }
    }
    if (!karsiSecenek.length) karsiSecenek.push({ deger: '', metin: 'Karşılaştırılacak kampanya yok' });
    for (i = 0; i < d.gostergeler.length; i++) gostergeSecenek.push({ deger: d.gostergeler[i].kod, metin: d.gostergeler[i].ad });

    var buAlani, karsiAlani, gostergeAlani, modAlani;

    function git() {
      YU.git(SAYFA, {
        bu: buAlani.deger(),
        karsi: karsiAlani.deger(),
        gosterge: gostergeAlani.deger(),
        mod: modAlani.deger()
      });
    }

    buAlani = YU.ui.alan({ etiket: 'Bu Kampanya', tip: 'secim', secenekler: buSecenek, deger: d.bu.donem.ad, onChange: git });
    karsiAlani = YU.ui.alan({
      etiket: 'Geçmiş Kampanya', tip: 'secim', secenekler: karsiSecenek,
      deger: d.gecmis ? d.gecmis.donem.ad : '', pasif: !d.gecmis, onChange: git
    });
    gostergeAlani = YU.ui.alan({ etiket: 'Gösterge', tip: 'secim', secenekler: gostergeSecenek, deger: d.gosterge.kod, onChange: git });
    modAlani = YU.ui.alan({
      etiket: 'Görünüm', tip: 'secim',
      secenekler: [{ deger: 'gunluk', metin: 'Günlük' }, { deger: 'birikimli', metin: 'Birikimli (O Güne Kadar Toplam)' }],
      deger: d.mod, onChange: git
    });

    return YU.ui.panel({
      govde: [
        YU.h('div', { sinif: 'yu-izgara yu-iz-4' }, buAlani.kok, karsiAlani.kok, gostergeAlani.kok, modAlani.kok),
        YU.h('div', { sinif: 'yu-ayrac yu-yatay', stil: { margin: '16px 0' } }),
        aralikSatiri(d)
      ]
    });
  }

  /* ------------------------------------------------------------------
     Tarih aralığı
     Varsayılan kampanyanın TAMAMIDIR (devir gününden bugüne). Kullanıcı
     daraltmak isterse üstten tarih seçer; seçim gün sırasına çevrilir,
     geçmiş kampanya aynı gün sıralarıyla karşılaştırılır.
     ------------------------------------------------------------------ */

  function aralikSatiri(d) {
    var enErken = YU.analiz.gunTarihi(d.bu, 1);
    var enGec = YU.analiz.gunTarihi(d.bu, d.sonGun);
    var basAlani, bitAlani;

    function git(ek) {
      YU.git(SAYFA, bagKur(d, ek));
    }
    function tarihtenGit() {
      var b = YU.analiz.tarihGunu(d.bu, basAlani.deger());
      var t = YU.analiz.tarihGunu(d.bu, bitAlani.deger());
      git({ basGun: b || 1, bitGun: t || d.sonGun });
    }

    basAlani = YU.ui.alan({
      etiket: 'Başlangıç', tip: 'tarih',
      deger: YU.analiz.gunTarihi(d.bu, d.basGun), onChange: tarihtenGit
    });
    bitAlani = YU.ui.alan({
      etiket: 'Bitiş', tip: 'tarih',
      deger: YU.analiz.gunTarihi(d.bu, d.bitGun), onChange: tarihtenGit
    });
    basAlani.girdi.setAttribute('min', enErken);
    basAlani.girdi.setAttribute('max', enGec);
    bitAlani.girdi.setAttribute('min', enErken);
    bitAlani.girdi.setAttribute('max', enGec);

    function hizli(metin, basGun, bitGun) {
      var secili = d.basGun === basGun && d.bitGun === bitGun;
      return YU.ui.dugme({
        metin: metin, tur: secili ? 'birincil' : 'ikincil', kucuk: true,
        onClick: function () { git({ basGun: basGun, bitGun: bitGun }); }
      });
    }

    var son7 = Math.max(1, d.sonGun - 6);
    var son30 = Math.max(1, d.sonGun - 29);
    var kisayollar = YU.h('div', { stil: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' } },
      hizli('Kampanyanın Tamamı', 1, d.sonGun),
      hizli('Son 7 Gün', son7, d.sonGun),
      d.sonGun > 30 ? hizli('Son 30 Gün', son30, d.sonGun) : null,
      d.sonGun >= 2 ? hizli('İlk Yarı', 1, Math.ceil(d.sonGun / 2)) : null,
      d.sonGun >= 2 ? hizli('İkinci Yarı', Math.ceil(d.sonGun / 2) + 1, d.sonGun) : null
    );

    var bilgi = [aralikMetni(d) + ' · ' + YU.fmt.sayi(d.gunSayisi) + ' gün'];
    if (d.gecmis) bilgi.push('Kampanya ' + d.gecmis.donem.ad + ' aynı günleri: ' + gecmisAralikMetni(d));
    bilgi.push('Kampanya ' + d.bu.donem.ad + ' devir günü ' + YU.fmt.tarih(d.bu.donem.bas) +
      ', son kayıt ' + YU.fmt.tarih(d.bu.donem.bit) + '.');

    return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      YU.h('div', { stil: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' } },
        basAlani.kok, bitAlani.kok,
        YU.h('div', { stil: { flex: '1', minWidth: '200px', paddingBottom: '2px' } }, kisayollar)
      ),
      YU.h('div', { sinif: 'yu-yardim', metin: bilgi.join(' · ') })
    );
  }

  /* ==================================================================
     5. KPI kartları
     ================================================================== */

  function kpiIzgarasi(d) {
    var g = d.gosterge;
    var k = YU.analiz.karsilastir(d, g);
    var N = k.gun;

    var gunKarti = YU.ui.kpi({
      etiket: d.tamAralikMi ? 'Kampanya Günü' : 'Seçili Aralık', ikon: '#ic-calendar',
      deger: d.tamAralikMi ? gunMetni(d.sonGun) : aralikMetni(d),
      alt: '1. gün ' + YU.fmt.tarih(d.bu.donem.bas) +
        (d.bugun.ham > d.bugun.gun
          ? ' · bugün ' + gunMetni(d.bugun.ham) + ', son kayıt ' + YU.fmt.tarih(d.bu.donem.bit)
          : ' · bugün ' + YU.fmt.tarih(YU.tarih.bugun())) +
        (d.tamAralikMi ? '' : ' · ' + YU.fmt.sayi(d.gunSayisi) + ' gün seçili')
    });

    /* Kampanyanın TAMAMI: 1. günden bugüne. Geçmiş kampanyanın kaydı erken
       bitse bile bu kartlar kısalmaz — hiçbir gün diğerinden önemsiz değil. */
    var buKarti = YU.ui.kpi({
      etiket: 'Bu Kampanya ' + d.bu.donem.ad, ikon: '#ic-up', renk: 'vurgu',
      deger: olcu(k.bu, g.birim),
      alt: aralikMetni(d) + ' toplamı · ' + gunMetni(N) + ': ' + miktar(k.buGun, g.birim)
    });

    var gecmisKarti = YU.ui.kpi({
      etiket: d.gecmis ? 'Geçmiş Kampanya ' + d.gecmis.donem.ad : 'Geçmiş Kampanya',
      ikon: '#ic-calendar-dots', renk: 'olumsuz',
      deger: d.gecmis ? olcu(k.gecmis, g.birim) : '—',
      alt: !d.gecmis ? 'Karşılaştırılacak ikinci kampanya yok'
        : (k.kisitliMi
          ? YU.fmt.sayi(d.basGun) + '–' + gunMetni(k.ortakBit) + ' toplamı · kaydı ' + gunMetni(k.ortakBit) + ' bitiyor'
          : aralikMetni(d) + ' toplamı · ' + gunMetni(N) + ': ' + miktar(k.gecmisGun, g.birim))
    });

    /* Fark yalnız ORTAK günler üzerinden hesaplanabilir; kısıt varsa bunu
       kartın altında düz Türkçeyle söyler, başlıkta parametre gibi durmaz. */
    var farkKarti = YU.ui.kpi({
      etiket: 'Fark', ikon: '#ic-percent', renk: farkTuru(k.fark),
      deger: k.fark === null ? '—' : (k.yuzde === null ? isaretli(k.fark) : yuzdeMetni(k.yuzde)),
      alt: k.fark === null
        ? 'Fark için iki kampanya gerekir'
        : (k.fark === 0 ? 'İki kampanya başa baş'
          : isaretli(k.fark) + ' ' + g.birim + ' · bu kampanya ' + (k.fark > 0 ? 'önde' : 'geride')) +
          (k.kisitliMi ? ' · iki kampanyada da kaydı olan ' + YU.fmt.sayi(k.ortakGun) + ' gün' : '')
    });

    return YU.h('div', { sinif: 'yu-izgara yu-iz-4' }, gunKarti, buKarti, gecmisKarti, farkKarti);
  }

  /* ==================================================================
     6. Grafik paneli
     ================================================================== */

  function grafikPaneli(d) {
    var g = d.gosterge, birikimli = d.mod === 'birikimli';
    var bas = d.basGun, bit = d.bitGun, N = bit;
    var buP = YU.analiz.pencere(d.bu, g, bas, bit);
    var gecmisP = d.gecmis ? YU.analiz.pencere(d.gecmis, g, bas, bit) : null;

    /* Birikimli görünüm SEÇİLEN aralığın içinde toplar: kullanıcı aralığı
       daralttıysa birikim de o aralıktan başlar. */
    var noktalar = [], i, buTop = 0, gecmisTop = 0;
    for (i = 0; i < buP.gunler.length; i++) {
      var gunNo = buP.gunler[i].gun;
      var bv = buP.gunler[i].deger;
      var gv = gecmisP ? gecmisP.gunler[i].deger : null;
      if (bv !== null) buTop = YU.yuvarla(buTop + bv);
      if (gv !== null) gecmisTop = YU.yuvarla(gecmisTop + gv);
      noktalar.push({
        etiket: String(gunNo),
        baslik: gunMetni(gunNo),
        deger1: birikimli ? (bv === null ? null : buTop) : bv,
        deger2: !gecmisP ? null : (birikimli ? (gv === null ? null : gecmisTop) : gv),
        alt1: YU.fmt.tarih(YU.analiz.gunTarihi(d.bu, gunNo)),
        alt2: d.gecmis ? YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, gunNo)) : null
      });
    }

    var grafik = YU.ui.karsilastirmaGrafik({
      noktalar: noktalar,
      seri1: { ad: 'Kampanya ' + d.bu.donem.ad, renk: RENK_BU },
      seri2: d.gecmis ? { ad: 'Kampanya ' + d.gecmis.donem.ad, renk: RENK_GECMIS } : null,
      yukseklik: GRAFIK_YUKSEKLIK,
      bicim: function (v) { return miktar(v, g.birim); },
      eksenBicim: eksenMetni(g.birim)
    });

    var cumleler = ['Yatay eksen kampanya günüdür; devir günü 1. gün sayılır. ' +
      'Her gün karşısındaki günle eşleşir: ' + gunMetni(N) + ' ↔ ' + gunMetni(N) + '.'];
    if (d.gecmis) {
      cumleler.push('Bu kampanyanın ' + gunMetni(N) + ' ' + YU.fmt.tarih(YU.analiz.gunTarihi(d.bu, N)) +
        ', geçmiş kampanyanın ' + gunMetni(N) + ' ' + YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, N)) + '.');
      if (d.kisitliMi) {
        cumleler.push('Geçmiş kampanyanın kaydı ' + gunMetni(d.gecmis.sonGun) +
          ' bittiği için kırmızı çizgi orada kesilir; mavi çizgi seçili aralığın tamamını gösterir.');
      }
    } else {
      cumleler.push('Karşılaştırma için ikinci bir kampanya gerekir.');
    }

    return YU.ui.panel({
      baslik: (birikimli ? 'Birikimli Karşılaştırma · ' : 'Günlük Karşılaştırma · ') + g.ad,
      ikon: '#ic-chart',
      sag: aralikMetni(d),
      govde: [grafik, YU.h('div', { sinif: 'yu-yardim', metin: cumleler.join(' ') })]
    });
  }

  /* ==================================================================
     7. Karşılaştırma tablosu
     ================================================================== */

  function tabloPaneli(d) {
    var N = d.bitGun, ortakBit = d.ortakBit, satirlar = [], i;
    var hepsi = YU.analiz.tumKarsilastirma(d);

    /* Fark, ORTAK günler üzerinden hesaplanır. Bu yüzden fark sütununun
       yanındaki iki sayı da ortak günlerin sayısı olmalıdır; yoksa "fark"
       ekranda görünen iki sayının farkına eşit çıkmaz. Kampanyanın tam
       toplamı, kısıt varsa AYRI bir sütunda durur. */
    for (i = 0; i < hepsi.length; i++) {
      (function (k) {
        var g = k.gosterge;
        var aktif = g.kod === d.gosterge.kod;
        var hucreler = [YU.h('span', { sinif: aktif ? 'yu-guclu' : '', metin: g.ad })];
        hucreler.push(miktar(k.buOrtak, g.birim));
        hucreler.push(k.gecmisOrtak === null ? '—' : miktar(k.gecmisOrtak, g.birim));
        hucreler.push(k.fark === null ? '—' : YU.h('span', {
          metin: isaretli(k.fark) + ' ' + g.birim,
          stil: { color: RENK_METIN[farkTuru(k.fark)] }
        }));
        hucreler.push(k.yuzde === null ? '—' : YU.ui.rozet(yuzdeMetni(k.yuzde), farkTuru(k.fark)));
        satirlar.push({
          vurgu: aktif ? 'vurgu' : null,
          ipucu: aktif ? 'Grafikte gösteriliyor' : 'Grafikte göstermek için tıklayın',
          onClick: function () { YU.git(SAYFA, bagKur(d, { gosterge: g.kod })); },
          hucreler: hucreler
        });
      })(hepsi[i]);
    }

    /* Sütun başlığında gün aralığı YAZMAZ: aralık zaten üstteki seçicide ve
       panel başlığında durur. Başlığa parametre gibi sayı basmak, seçilmiş
       bir pencere izlenimi veriyordu (kullanıcı düzeltmesi, 23.08.2026). */
    var sutunlar = [
      { baslik: 'Gösterge' },
      { baslik: 'Kampanya ' + d.bu.donem.ad, hiza: 'sag', mono: true, genislik: 200 },
      { baslik: d.gecmis ? 'Kampanya ' + d.gecmis.donem.ad : 'Geçmiş Kampanya', hiza: 'sag', mono: true, genislik: 200 },
      { baslik: 'Fark', hiza: 'sag', mono: true, genislik: 170 },
      { baslik: 'Fark %', hiza: 'sag', genislik: 105 }
    ];

    var tablo = YU.ui.tablo({
      sutunlar: sutunlar,
      satirlar: satirlar,
      bos: 'Karşılaştırılacak gösterge yok.'
    });

    var notlar = [d.tamAralikMi
      ? 'Kampanyanın 1. gününden bugüne (' + gunMetni(N) + ') bütün günler sayılır.'
      : 'Üstten seçilen ' + aralikMetni(d) + ' aralığı (' + YU.fmt.sayi(d.gunSayisi) + ' gün) sayılır.'];
    if (d.kisitliMi) {
      notlar.push('Geçmiş kampanyanın kaydı ' + gunMetni(ortakBit) + ' bittiği için fark yalnız ' +
        'iki kampanyada da kaydı olan ' + YU.fmt.sayi(d.ortakGun) + ' gün üzerinden hesaplanabiliyor — ' +
        'bu seçilmiş bir aralık değil, verinin bittiği yerdir.');
    }
    notlar.push('Satıra tıklayınca o gösterge grafikte açılır.');

    return YU.ui.panel({
      baslik: d.tamAralikMi ? 'Kampanya Toplamları' : 'Seçili Aralık Toplamları',
      ikon: '#ic-doc',
      sag: YU.fmt.sayi(d.gostergeler.length) + ' gösterge · ' + aralikMetni(d),
      dolgusuz: true,
      govde: [tablo, YU.h('div', { sinif: 'yu-yardim', metin: notlar.join(' '), stil: { padding: '10px 18px 12px' } })]
    });
  }

  /* ==================================================================
     8. Sayfa
     ================================================================== */

  function ciz(kap, param) {
    var depo = YU.db;
    if (!depo) return;
    var d = durum(depo, param);

    if (!d) {
      kap.appendChild(YU.ui.bosDurum({
        ikon: '#ic-chart',
        baslik: 'Kampanya Dönemi Yok',
        metin: 'Karşılaştırma devir tarihine göre kurulur. Devir stok girilince kampanya dönemi oluşur ve bu ekran dolar.',
        eylemler: [YU.ui.dugme({ metin: 'Devir Stok', ikon: '#ic-wallet', tur: 'birincil', onClick: function () { YU.git('devir-stok'); } })]
      }));
      return;
    }
    if (!d.gosterge) {
      kap.appendChild(YU.ui.bosDurum({ ikon: '#ic-chart', baslik: 'Gösterge Yok', metin: 'Karşılaştırılacak malzeme tanımı bulunamadı.' }));
      return;
    }

    kap.appendChild(soruPaneli(depo));
    if (sonSoru.cevap) kap.appendChild(cevapKarti(depo, sonSoru.cevap, d));

    kap.appendChild(ayarPaneli(d));

    if (!d.gecmis) {
      kap.appendChild(YU.ui.serit({
        tur: 'bilgi', baslik: 'Tek kampanya var',
        metin: 'Karşılaştırma için en az iki kampanya dönemi gerekir. Yeni kampanya açılınca (yeni devir tarihi) bu ekran iki dönemi gün gün karşılaştırır.'
      }));
    }

    kap.appendChild(kpiIzgarasi(d));
    kap.appendChild(grafikPaneli(d));
    kap.appendChild(tabloPaneli(d));
  }

  YU.sayfaTanimla({
    kod: SAYFA,
    baslik: 'Analizler',
    ikon: '#ic-bars-up',
    grup: 'Yönetim',
    rol: 'Yonetici',
    altBaslik: function (param) {
      var depo = YU.db;
      if (!depo) return '';
      var d = durum(depo, param);
      if (!d) return 'Kampanya dönemi tanımlı değil';
      var parcalar = ['Kampanya ' + d.bu.donem.ad + ' · ' +
        (d.tamAralikMi ? gunMetni(d.sonGun) + ' (kampanyanın tamamı)' : aralikMetni(d) + ' seçili')];
      parcalar.push(d.gecmis ? 'Kampanya ' + d.gecmis.donem.ad + ' ile gün gün karşılaştırma' : 'karşılaştırılacak ikinci kampanya yok');
      return parcalar.join(' · ');
    },
    ciz: ciz
  });
})();

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
  var ORNEK_SINIRI = 7;    /* soru kutusunda gösterilen hazır soru sayısı */

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

  /* İki tarih aynı yıldaysa yıl bir kez yazılır: "14.08 – 20.08.2026".
     Çipte yer dar; yılı iki kez yazmak satırı kırıyordu. */
  function kisaAralik(basISO, bitISO) {
    var bas = YU.fmt.tarih(basISO), bit = YU.fmt.tarih(bitISO);
    if (String(basISO).slice(0, 4) === String(bitISO).slice(0, 4)) bas = bas.slice(0, 5);
    return bas + ' – ' + bit;
  }

  /* "N. Gün Farkı" hücresi: kampanya başından bugüne iki kampanyanın
     toplamları ve aradaki fark. Yüzde ile birlikte miktarı da yazar ki
     "%0,6 geride" ne kadar ediyor tek bakışta görünsün. */
  function gunlukFarkHucresi(k) {
    if (k.fark === null || k.gecmisOrtak === null) {
      return YU.h('span', { sinif: 'yu-zayif', metin: '—' });
    }
    var tur = farkTuru(k.fark);
    return YU.h('div', {
      stil: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }
    },
      YU.h('span', {
        metin: isaretli(k.fark) + ' ' + k.gosterge.birim,
        stil: { font: '400 12.5px/1 var(--sayi)', color: 'var(--metin-4)', fontVariantNumeric: 'tabular-nums' }
      }),
      YU.ui.rozet(yuzdeMetni(k.yuzde), tur)
    );
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

    /* Hazır sorular: tıklanınca doğrudan sorulur. Yalnız ilk birkaçı durur —
       on dörtnün tamamı iki satır kaplayıp paneli şişiriyordu; kalanlar
       "Daha fazla" ile yardım cevabında listelenir. */
    var ornekler = YU.soru.ornekler().slice(0, ORNEK_SINIRI);
    var cipler = YU.h('div', {
      stil: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }
    });

    function ornekCipi(metin, vurgulu) {
      return YU.h('button', {
        tip: 'button', metin: metin,
        stil: {
          font: '400 12px/1 var(--font)',
          color: vurgulu ? 'var(--vurgu)' : 'var(--metin-3)',
          background: vurgulu ? 'var(--vurgu-zemin)' : 'var(--yuzey-3)',
          border: '1px solid ' + (vurgulu ? 'transparent' : 'var(--kenar)'),
          borderRadius: '999px', padding: '6px 11px', cursor: 'pointer'
        },
        onClick: function () {
          alan.ayarla(metin);
          sor(metin);
        }
      });
    }

    for (var i = 0; i < ornekler.length; i++) cipler.appendChild(ornekCipi(ornekler[i], false));
    cipler.appendChild(ornekCipi('Daha fazla örnek', true));

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
     4. Araç şeridi — ekranın filtre satırı

     Önceki sürümde üç bant üst üste duruyordu: dört tam genişlik seçim
     kutusu, altında tarih satırı, altında açıklama. Ekran veriye
     başlamadan üç bant harcıyordu (kullanıcı düzeltmesi, 23.08.2026).
     Şimdi TEK SATIR: seçim kutuları açılır çiplerin içine girdi, çipte
     yalnız seçili değer yazıyor. Tasarım referansındaki "Durum: Tümü" /
     dönem seçici çipinin dili korundu.
     ================================================================== */

  function ayarPaneli(d) {
    var serit = YU.h('div', { sinif: 'yu-arac' },
      karsilastirmaCipi(d),
      gostergeCipi(d),
      YU.h('span', { sinif: 'yu-arac-ayrac' }),
      gorunumSecimi(d),
      YU.h('div', { sinif: 'yu-arac-sag' }, aralikCipi(d))
    );
    return YU.h('div', {
      stil: {
        padding: '12px 14px', border: '1px solid var(--kenar)',
        borderRadius: 'var(--r-l)', background: 'var(--yuzey)'
      }
    }, serit);
  }

  /* --- karşılaştırılan kampanyalar --- */

  function karsilastirmaCipi(d) {
    var metin = d.gecmis
      ? d.bu.donem.ad + ' ↔ ' + d.gecmis.donem.ad
      : d.bu.donem.ad + ' (tek kampanya)';

    return YU.ui.acilirCip({
      ikon: '#ic-calendar-dots', metin: metin, enGenis: 190,
      baslik: 'Karşılaştırılan kampanyalar', genislik: 300, dolgu: '6px 12px 12px',
      govde: function () {
        var buSecenek = [], karsiSecenek = [], i;
        for (i = d.donemler.length - 1; i >= 0; i--) {
          buSecenek.push({ deger: d.donemler[i].ad, metin: 'Kampanya ' + d.donemler[i].ad });
          if (d.donemler[i].ad !== d.bu.donem.ad) {
            karsiSecenek.push({ deger: d.donemler[i].ad, metin: 'Kampanya ' + d.donemler[i].ad });
          }
        }
        if (!karsiSecenek.length) karsiSecenek.push({ deger: '', metin: 'Karşılaştırılacak kampanya yok' });

        var buAlani, karsiAlani;
        function git() {
          /* Kampanya değişince gün aralığı sıfırlanır: eski aralık yeni
             kampanyada başka günlere denk gelirdi. */
          YU.git(SAYFA, bagKur(d, {
            bu: buAlani.deger(), karsi: karsiAlani.deger(), basGun: null, bitGun: null
          }));
        }
        buAlani = YU.ui.alan({ etiket: 'Bu Kampanya', tip: 'secim', secenekler: buSecenek, deger: d.bu.donem.ad, onChange: git });
        karsiAlani = YU.ui.alan({
          etiket: 'Karşılaştırılan', tip: 'secim', secenekler: karsiSecenek,
          deger: d.gecmis ? d.gecmis.donem.ad : '', pasif: !d.gecmis, onChange: git
        });
        return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          buAlani.kok, karsiAlani.kok);
      }
    });
  }

  /* --- gösterge --- */

  function gostergeCipi(d) {
    return YU.ui.acilirCip({
      ikon: '#ic-chart', metin: d.gosterge.ad, enGenis: 200,
      baslik: 'Gösterge', genislik: 340,
      govde: function (kapat) {
        var kap = YU.h('div');
        for (var i = 0; i < d.gostergeler.length; i++) {
          (function (g) {
            kap.appendChild(YU.ui.acilirSatir({
              metin: g.ad,
              secili: g.kod === d.gosterge.kod,
              onClick: function () { kapat(); YU.git(SAYFA, bagKur(d, { gosterge: g.kod })); }
            }));
          })(d.gostergeler[i]);
        }
        return kap;
      }
    });
  }

  /* --- görünüm: iki seçenek, açılır listeye değmez --- */

  function gorunumSecimi(d) {
    return YU.ui.secimGrubu({
      deger: d.mod,
      secenekler: [{ deger: 'gunluk', metin: 'Günlük' }, { deger: 'birikimli', metin: 'Birikimli' }],
      onDegis: function (v) { YU.git(SAYFA, bagKur(d, { mod: v })); }
    });
  }

  /* --- tarih aralığı --- */

  function aralikCipi(d) {
    var metin = d.tamAralikMi
      ? 'Tüm kampanya · ' + YU.fmt.sayi(d.gunSayisi) + ' gün'
      : kisaAralik(YU.analiz.gunTarihi(d.bu, d.basGun), YU.analiz.gunTarihi(d.bu, d.bitGun)) +
        ' · ' + YU.fmt.sayi(d.gunSayisi) + ' gün';

    return YU.ui.acilirCip({
      ikon: '#ic-calendar', metin: metin, hiza: 'sag', enGenis: 230,
      baslik: 'Tarih aralığı', genislik: 340, dolgu: '6px 12px 12px',
      govde: function (kapat) { return aralikKutusu(d, kapat); }
    });
  }

  function aralikKutusu(d, kapat) {
    var enErken = YU.analiz.gunTarihi(d.bu, 1);
    var enGec = YU.analiz.gunTarihi(d.bu, d.sonGun);
    var basAlani, bitAlani;

    function git(basGun, bitGun) {
      kapat();
      YU.git(SAYFA, bagKur(d, { basGun: basGun, bitGun: bitGun }));
    }
    function tarihtenGit() {
      var b = YU.analiz.tarihGunu(d.bu, basAlani.deger());
      var t = YU.analiz.tarihGunu(d.bu, bitAlani.deger());
      git(b || 1, t || d.sonGun);
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

    /* Hazır aralıklar — seçili olan vurguyla işaretlenir. */
    var hazir = [{ metin: 'Kampanyanın tamamı', bas: 1, bit: d.sonGun }];
    if (d.sonGun > 7) hazir.push({ metin: 'Son 7 gün', bas: d.sonGun - 6, bit: d.sonGun });
    if (d.sonGun > 30) hazir.push({ metin: 'Son 30 gün', bas: d.sonGun - 29, bit: d.sonGun });
    if (d.sonGun >= 4) {
      var orta = Math.ceil(d.sonGun / 2);
      hazir.push({ metin: 'İlk yarı', bas: 1, bit: orta });
      hazir.push({ metin: 'İkinci yarı', bas: orta + 1, bit: d.sonGun });
    }

    var liste = YU.h('div');
    for (var i = 0; i < hazir.length; i++) {
      (function (h) {
        liste.appendChild(YU.ui.acilirSatir({
          metin: h.metin,
          sag: YU.fmt.sayi(h.bit - h.bas + 1) + ' gün',
          secili: d.basGun === h.bas && d.bitGun === h.bit,
          onClick: function () { git(h.bas, h.bit); }
        }));
      })(hazir[i]);
    }

    var bilgi = [aralikMetni(d)];
    if (d.gecmis) bilgi.push('Kampanya ' + d.gecmis.donem.ad + ' aynı günleri: ' + gecmisAralikMetni(d));

    return YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      liste,
      YU.h('div', { sinif: 'yu-ayrac yu-yatay' }),
      YU.h('div', { stil: { display: 'flex', gap: '10px' } }, basAlani.kok, bitAlani.kok),
      YU.h('div', { sinif: 'yu-yardim', metin: bilgi.join(' · ') })
    );
  }

  /* ==================================================================
     5. Grafik paneli
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
     6. Karşılaştırma tablosu
     ================================================================== */

  function tabloPaneli(d) {
    var N = d.bitGun, ortakBit = d.ortakBit, satirlar = [], i;
    var hepsi = YU.analiz.tumKarsilastirma(d);

    /* BUGÜNE KADAR sütunu — seçili aralıktan BAĞIMSIZDIR (kullanıcı isteği,
       23.08.2026). Kampanyanın 1. gününden bugünkü N. güne kadar iki
       kampanyanın toplamını karşılaştırır: "19. gündeyiz, 19 günde geçen
       kampanyaya göre neredeyiz". Üstten aralık daraltılsa bile bu sütun
       hep aynı soruyu yanıtlar. */
    var bugunAralik = { basGun: 1, bitGun: d.sonGun };

    /* Fark, ORTAK günler üzerinden hesaplanır. Bu yüzden fark sütununun
       yanındaki iki sayı da ortak günlerin sayısı olmalıdır; yoksa "fark"
       ekranda görünen iki sayının farkına eşit çıkmaz. */
    for (i = 0; i < hepsi.length; i++) {
      (function (k) {
        var g = k.gosterge;
        var aktif = g.kod === d.gosterge.kod;
        var bugune = YU.analiz.karsilastir(d, g, bugunAralik);
        var hucreler = [YU.h('span', { sinif: aktif ? 'yu-guclu' : '', metin: g.ad })];
        hucreler.push(miktar(k.buOrtak, g.birim));
        hucreler.push(k.gecmisOrtak === null ? '—' : miktar(k.gecmisOrtak, g.birim));
        /* Aralık daraltılmadıysa "aralık farkı" ile "N. gün farkı" AYNI
           şeydir; aynı sayıyı iki kez basmamak için yalnız sonuncusu yazılır. */
        if (!d.tamAralikMi) {
          hucreler.push(k.fark === null ? '—' : YU.h('span', {
            metin: isaretli(k.fark) + ' ' + g.birim,
            stil: { color: RENK_METIN[farkTuru(k.fark)] }
          }));
          hucreler.push(k.yuzde === null ? '—' : YU.ui.rozet(yuzdeMetni(k.yuzde), farkTuru(k.fark)));
        }
        hucreler.push(gunlukFarkHucresi(bugune));
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
       bir pencere izlenimi veriyordu (kullanıcı düzeltmesi, 23.08.2026).
       Tek istisna son sütun: orada gün sayısı BİLGİNİN KENDİSİDİR. */
    /* Sütun başlığı önce İNSAN SÖZCÜĞÜNÜ söyler ("Bu Sezon"), kampanya adı
       arkasından gelir. Programı ilk kez açan biri "Kampanya 2025/2026"
       yazısından hangisinin geçen sezon olduğunu çıkaramıyordu
       (kullanıcı geri bildirimi, 23.08.2026). */
    var sutunlar = [
      { baslik: 'Gösterge' },
      { baslik: 'Bu Sezon · ' + d.bu.donem.ad, hiza: 'sag', mono: true, genislik: 190 },
      { baslik: d.gecmis ? 'Geçen Sezon · ' + d.gecmis.donem.ad : 'Geçen Sezon', hiza: 'sag', mono: true, genislik: 190 }
    ];
    if (!d.tamAralikMi) {
      sutunlar.push({ baslik: 'Seçili Aralık Farkı', hiza: 'sag', mono: true, genislik: 160 });
      sutunlar.push({ baslik: 'Aralık %', hiza: 'sag', genislik: 100 });
    }
    /* Başlıkta gün sayısı YOK (kullanıcı tercihi, 23.08.2026): '30. gün Farkı'
       tek bir günün farkı gibi okunuyordu. Kaçıncı günde olunduğu sayfa alt
       başlığında, aralık çipinde ve tablo üstü açıklamada zaten yazıyor. */
    sutunlar.push({ baslik: 'Sezon Başından Bugüne', hiza: 'sag', genislik: 210 });

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
    notlar.push('“Sezon Başından Bugüne” sütunu üstteki tarih aralığından BAĞIMSIZDIR: ' +
      'her iki sezonun da ilk ' + YU.fmt.sayi(d.sonGun) + ' gününü toplayıp karşılaştırır.' +
      (d.tamAralikMi ? ' Seçili aralık zaten sezonun tamamı olduğu için ayrıca aralık farkı sütunu gösterilmez.' : ''));
    notlar.push('Satıra tıklayınca o gösterge grafikte açılır.');

    /* Tablonun ÜSTÜNDE tek cümlelik açıklama: kampanya günü mantığı bu
       ekranın en anlaşılmaz yeri. Somut tarih vermek kavramı oturtuyor.
       Ayrıntılı notlar tablonun altında kalır. */
    var ustAciklama = null;
    if (d.gecmis) {
      ustAciklama = YU.h('div', {
        stil: {
          display: 'flex', alignItems: 'flex-start', gap: '9px',
          padding: '11px 18px', borderBottom: '1px solid var(--ayrac)',
          background: 'var(--yuzey-2)'
        }
      },
        YU.h('span', { stil: { display: 'flex', color: 'var(--vurgu)', flex: 'none', marginTop: '1px' } }, YU.svg('#ic-doc', 14)),
        YU.h('div', {
          sinif: 'yu-yardim',
          stil: { margin: '0' },
          metin: 'Karşılaştırma takvim tarihine göre değil KAMPANYA GÜNÜNE göre yapılır. ' +
            'Bu sezon ' + YU.fmt.sayi(d.sonGun) + ' gündür sürüyor (' +
            YU.fmt.tarih(d.bu.donem.bas) + '’dan ' + YU.fmt.tarih(YU.analiz.gunTarihi(d.bu, d.sonGun)) + '’a); ' +
            'geçen sezonun da başlangıcından itibaren aynı ' + YU.fmt.sayi(d.sonGun) + ' günü alındı (' +
            YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, 1)) + ' – ' +
            YU.fmt.tarih(YU.analiz.gunTarihi(d.gecmis, Math.min(d.sonGun, d.gecmis.sonGun))) + ').'
        })
      );
    }

    return YU.ui.panel({
      baslik: d.tamAralikMi ? 'Kampanya Toplamları' : 'Seçili Aralık Toplamları',
      ikon: '#ic-doc',
      sag: YU.fmt.sayi(d.gostergeler.length) + ' gösterge · ' + aralikMetni(d),
      dolgusuz: true,
      govde: [ustAciklama, tablo, YU.h('div', { sinif: 'yu-yardim', metin: notlar.join(' '), stil: { padding: '10px 18px 12px' } })]
    });
  }

  /* ==================================================================
     7. Sayfa
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

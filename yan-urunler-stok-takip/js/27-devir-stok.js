/* js/27-devir-stok.js — Devir Stok ekranı (yalnız Yönetici).
   Şartname §7: "İki sekme: malzeme devirleri ve silo devirleri. Kampanya başında
   bir kez girilir."  §5 v2: tekillik (MalzemeId, DevirTarihi) — aynı malzeme için
   farklı tarihlerde birden çok devir satırı olur, stokta EN SON devir kullanılır.
   SÖZLEŞME §7 · kod 'devir-stok'. */
(function () {
  'use strict';

  var YU = window.YU;

  var TABLO_ADLARI = ['kullanicilar', 'malzemeler', 'silolar', 'devirStok', 'siloDevirStok',
                      'gunlukHareket', 'kuruKuspeGunluk', 'siloHareket', 'degisiklikLog'];

  /* Sekme ve seçili tarih modül düzeyinde durur: kaydetme sonrası sayfa yeniden
     çizilince kullanıcı aynı kampanya tarihinde kalsın. Tarih sekme başına ayrı
     tutulur — malzeme ve silo devirlerinin tarihleri aynı olmak zorunda değil. */
  var durum = {
    sekme: 'malzeme',
    tarih: { malzeme: null, silo: null },
    /* elle: boş sekmede "Elle Gir" seçildiyse tablo gösterilir.
       onDoldur: devretten gelen sahipId→miktar haritası; bir sonraki çizimde
       giriş alanlarına yazılır ve temizlenir. */
    elle: { malzeme: false, silo: false },
    onDoldur: null
  };
  /* govde: iki bölümün kabı — { malzeme, silo } (24.08.2026, sekme kalktı). */
  var dom = { govde: { malzeme: null, silo: null } };

  function siloMu() { return durum.sekme === 'silo'; }
  function tip() { return siloMu() ? 'Silo' : 'Malzeme'; }
  function devirTablosu() { return siloMu() ? YU.db.siloDevirStok : YU.db.devirStok; }
  function sahipAlani() { return siloMu() ? 'SiloId' : 'MalzemeId'; }
  function sahipKaynagi() { return siloMu() ? YU.db.silolar : YU.db.malzemeler; }
  function seciliTarih() { return durum.tarih[durum.sekme]; }

  function siralaSira(a, b) {
    var x = Number(a.Sira) || 0, y = Number(b.Sira) || 0;
    if (x !== y) return x - y;
    return (a.Id || 0) - (b.Id || 0);
  }

  function kullaniciAdi(id) {
    if (id === null || id === undefined) return null;
    var l = YU.db.kullanicilar || [], i;
    for (i = 0; i < l.length; i++) if (l[i].Id === id) return l[i].AdSoyad;
    return null;
  }

  /* ------------------------------------------------------------------
     Devir tarihleri
     ------------------------------------------------------------------ */

  function devirTarihleri() {
    var tablo = devirTablosu(), harita = {}, i, d, o;
    for (i = 0; i < tablo.length; i++) {
      d = tablo[i];
      o = harita[d.DevirTarihi] || (harita[d.DevirTarihi] = { tarih: d.DevirTarihi, adet: 0, toplam: 0 });
      o.adet++;
      o.toplam = YU.yuvarla(o.toplam + (Number(d.Miktar) || 0));
    }
    var liste = [], t;
    for (t in harita) if (Object.prototype.hasOwnProperty.call(harita, t)) liste.push(harita[t]);
    liste.sort(function (a, b) { return a.tarih < b.tarih ? -1 : (a.tarih > b.tarih ? 1 : 0); });
    return liste;
  }

  function tarihiHazirla() {
    if (durum.tarih[durum.sekme]) return;
    var l = devirTarihleri();
    durum.tarih[durum.sekme] = l.length ? l[l.length - 1].tarih : YU.tarih.bugun();
  }

  function tarihteKayitVar(tarih) {
    var tablo = devirTablosu(), i;
    for (i = 0; i < tablo.length; i++) if (tablo[i].DevirTarihi === tarih) return true;
    return false;
  }

  /* Bir devir satırının etki alanı: kendi tarihinden bir sonraki devre kadar olan,
     o sahibe ait kayıtlı günler. "Devri değiştirmek neyi bozar" sorusunun cevabı. */
  function etkiOzeti(sahipId, devirTarihi) {
    var tablo = devirTablosu(), alan = sahipAlani(), i, d;
    var sonraki = null;
    for (i = 0; i < tablo.length; i++) {
      d = tablo[i];
      if (d[alan] !== sahipId || d.DevirTarihi <= devirTarihi) continue;
      if (!sonraki || d.DevirTarihi < sonraki) sonraki = d.DevirTarihi;
    }

    var kaynak = siloMu() ? YU.db.siloHareket : YU.db.gunlukHareket;
    var kimlik = siloMu() ? 'SiloId' : 'MalzemeId';
    var kume = {}, h;
    for (i = 0; i < kaynak.length; i++) {
      h = kaynak[i];
      if (h[kimlik] !== sahipId || h.Tarih < devirTarihi) continue;
      if (sonraki && h.Tarih >= sonraki) continue;
      kume[h.Tarih] = 1;
    }
    var gunler = [], t;
    for (t in kume) if (Object.prototype.hasOwnProperty.call(kume, t)) gunler.push(t);
    gunler.sort();

    return {
      sayi: gunler.length,
      ilk: gunler.length ? gunler[0] : null,
      son: gunler.length ? gunler[gunler.length - 1] : null,
      sonrakiDevir: sonraki
    };
  }

  function etkiMetni(e) {
    if (!e.sayi) {
      return e.sonrakiDevir
        ? 'Etkilediği kayıtlı gün yok · sonraki devir ' + YU.fmt.tarih(e.sonrakiDevir)
        : 'Etkilediği kayıtlı gün yok';
    }
    var m = YU.fmt.sayi(e.sayi) + ' günü etkiliyor · ' + YU.fmt.tarih(e.ilk) + ' – ' + YU.fmt.tarih(e.son);
    if (e.sonrakiDevir) m += ' · sonraki devir ' + YU.fmt.tarih(e.sonrakiDevir);
    return m;
  }

  /* ------------------------------------------------------------------
     Önizleme — gerçek depo kirletilmeden hesaplanır
     ------------------------------------------------------------------ */

  /* Stok formülleri tek yerde (YU.stok) kalsın diye önizleme, kopya bir bellek
     deposu üzerinde aynı sorgular çalıştırılarak üretilir; formül burada
     yeniden yazılmaz. */
  function geciciDepo() {
    var g = YU.Depo({ kaynak: 'bellek', tohumla: false }), i, j, ad, hedef, kaynak;
    for (i = 0; i < TABLO_ADLARI.length; i++) {
      ad = TABLO_ADLARI[i];
      hedef = g[ad];
      kaynak = YU.db[ad] || [];
      hedef.length = 0;
      for (j = 0; j < kaynak.length; j++) hedef.push(YU.kopya(kaynak[j]));
    }
    return g;
  }

  /* miktar null ise satır silinir. */
  function geciciDevirUygula(g, sahipId, tarih, miktar) {
    var tablo = siloMu() ? g.siloDevirStok : g.devirStok;
    var alan = sahipAlani(), i, yeni;
    for (i = 0; i < tablo.length; i++) {
      if (tablo[i][alan] !== sahipId || tablo[i].DevirTarihi !== tarih) continue;
      if (miktar === null) tablo.splice(i, 1);
      else tablo[i].Miktar = YU.yuvarla(miktar);
      return;
    }
    if (miktar === null) return;
    yeni = {
      Id: g.yeniId(siloMu() ? 'SiloDevirStok' : 'DevirStok'),
      DevirTarihi: tarih,
      Miktar: YU.yuvarla(miktar),
      OlusturanKullaniciId: null,
      OlusturmaTarihi: null
    };
    yeni[alan] = sahipId;
    tablo.push(yeni);
  }

  function mevcutHaritasi(depo) {
    var harita = {}, liste, i;
    if (siloMu()) {
      liste = YU.stok.tumSilolar(depo);
      for (i = 0; i < liste.length; i++) harita[liste[i].silo.Id] = liste[i].mevcut;
    } else {
      liste = YU.stok.tumMalzemeler(depo);
      for (i = 0; i < liste.length; i++) harita[liste[i].malzeme.Id] = liste[i].mevcut;
    }
    return harita;
  }

  /* ------------------------------------------------------------------
     Önceki kampanyadan devret — Türk ERP'lerdeki devir işlemi kalıbı:
     açılış rakamları elle yazılmaz, önceki dönemin kapanışından üretilir,
     kullanıcı kontrol edip kaydeder (kullanıcı isteği, 21.08.2026).
     ------------------------------------------------------------------ */

  function oncekiKampanya(sinirTarih) {
    var l = YU.donem.liste(), sinir = sinirTarih || YU.tarih.bugun(), enSon = null, i;
    for (i = 0; i < l.length; i++) {
      if (l[i].bit < sinir && (!enSon || l[i].bit > enSon.bit)) enSon = l[i];
    }
    return enSon;
  }

  /* Kapanış stokları = kapanış günü itibarıyla hesaplanan mevcutlar.
     Malzeme sekmesinde dökme kuru küspe atlanır: onun açılışı Silo
     Devirleri sekmesinden, silo bazında girilir (Şartname §5). */
  function kapanisStoklari(kapanisTarihi) {
    var harita = {}, liste, i;
    if (siloMu()) {
      liste = YU.stok.tumSilolar(YU.db, kapanisTarihi);
      for (i = 0; i < liste.length; i++) harita[liste[i].silo.Id] = YU.yuvarla(liste[i].mevcut);
    } else {
      liste = YU.stok.tumMalzemeler(YU.db, kapanisTarihi);
      for (i = 0; i < liste.length; i++) {
        if (!liste[i].malzeme || liste[i].malzeme.OzelTip === 'DokmeKuruKuspe') continue;
        harita[liste[i].malzeme.Id] = YU.yuvarla(liste[i].mevcut);
      }
    }
    return harita;
  }

  function devret(onceki, tarihOner) {
    durum.onDoldur = kapanisStoklari(onceki.bit);
    durum.elle[durum.sekme] = true;
    /* Boş sekmede tarih de önerilir: kapanışın ertesi günü. Dolu sekmede
       kullanıcının seçili tarihi korunur. */
    if (tarihOner) durum.tarih[durum.sekme] = YU.tarih.ekle(onceki.bit, 1);
    govdeyiCiz();
    YU.ui.bildir('Kampanya ' + onceki.ad + ' kapanışı (' + YU.fmt.tarih(onceki.bit) +
      ') satırlara dolduruldu. Tarihi ve miktarları kontrol edip Kaydet\'e basın.', 'bilgi');
  }

  /* ------------------------------------------------------------------
     Tarih bloğu — ayrı bir panel değil, devir tablosunun üst bölümü.
     İki ayrı panel "Devir Tarihleri" ile "Malzeme Devirleri" birbirinden
     bağımsız görünüyordu; tarih seçimi tablonun başına bağlandı
     (kullanıcı isteği, 21.08.2026).
     ------------------------------------------------------------------ */

  function tarihBlogu() {
    var tarih = seciliTarih();
    var liste = devirTarihleri();

    var cipler = YU.h('div', { stil: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    if (!liste.length) {
      cipler.appendChild(YU.h('span', {
        sinif: 'yu-yardim',
        metin: 'Bu sekmede henüz devir kaydı yok. Aşağıdaki tarihi seçip miktarları girin.'
      }));
    }
    for (var i = 0; i < liste.length; i++) {
      (function (d) {
        cipler.appendChild(YU.ui.dugme({
          metin: YU.fmt.tarih(d.tarih) + ' · ' + YU.fmt.sayi(d.adet) + ' satır',
          baslik: 'Toplam Devir ' + YU.fmt.kgU(d.toplam) + kampanyaEki(d.tarih),
          ikon: '#ic-calendar', kucuk: true,
          tur: d.tarih === tarih ? 'birincil' : 'ikincil',
          onClick: function () { durum.tarih[durum.sekme] = d.tarih; govdeyiCiz(); }
        }));
      })(liste[i]);
    }

    var tarihAlani = YU.ui.alan({
      etiket: 'Devir Tarihi (Kampanya Başı)', tip: 'tarih', deger: tarih || '', genislik: 200,
      onChange: function () {
        var v = tarihAlani.girdi.value;
        if (!v) { tarihAlani.ayarla(seciliTarih() || ''); return; }
        /* Gelecek gün seçilemez (kullanıcı direktifi, 24.08.2026): önceden
           gelecek kampanya devri erken girilebiliyordu; artık devir tarihi de
           bugünle sınırlı. Şartname Demirbaş kuralları erken girişi zorunlu
           kılmaz; yeni kampanya devri, günü geldiğinde girilir. */
        if (v > YU.tarih.bugun()) {
          YU.ui.bildir('Gelecek tarihe devir girilemez: ' + YU.fmt.tarih(v) + ' bugünden sonra.', 'hata');
          tarihAlani.ayarla(seciliTarih() || '');
          return;
        }
        durum.tarih[durum.sekme] = v;
        govdeyiCiz();
      }
    });

    var kayitVar = tarih ? tarihteKayitVar(tarih) : false;
    var rozet = YU.ui.rozet(kayitVar ? 'Düzenleme' : 'Yeni Kampanya Devri', kayitVar ? 'vurgu' : 'bekleyen');

    var yeniDugme = YU.ui.dugme({
      metin: 'Yeni Kampanya Devri Ekle', ikon: '#ic-plus', tur: 'ikincil',
      baslik: 'Boş Bir Tarihle Yeni Devir Satırları Aç',
      onClick: function () {
        durum.tarih[durum.sekme] = YU.tarih.bugun();
        govdeyiCiz();
        YU.ui.bildir('Devir tarihini kampanya başına ayarlayın, ardından miktarları girin.', 'bilgi');
      }
    });

    var onceki = oncekiKampanya(tarih);
    var devretDugme = onceki ? YU.ui.dugme({
      metin: 'Önceki Kampanyadan Devret', ikon: '#ic-wallet', tur: 'ikincil',
      baslik: 'Kampanya ' + onceki.ad + ' kapanışını (' + YU.fmt.tarih(onceki.bit) + ') satırlara doldurur',
      onClick: function () { devret(onceki, false); }
    }) : null;

    var satir = YU.h('div', {
      stil: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }
    },
      tarihAlani.kok,
      YU.h('div', { stil: { display: 'flex', alignItems: 'center', paddingBottom: '9px' } }, rozet),
      YU.h('div', { stil: { flex: '1', minWidth: '12px' } }),
      devretDugme,
      yeniDugme
    );

    var yardim = YU.h('div', {
      sinif: 'yu-yardim',
      metin: kayitVar
        ? YU.fmt.tarih(tarih) + ' tarihli devir kayıtları düzenleniyor. Miktarı değiştirip Kaydet’e basın.'
        : (tarih ? YU.fmt.tarih(tarih) + ' tarihinde devir kaydı yok; girilen satırlar yeni kampanya devri olarak açılır.'
                 : 'Devir tarihi seçilmedi.')
    });

    return YU.h('div', {
      stil: {
        display: 'flex', flexDirection: 'column', gap: '13px',
        padding: '16px 18px', borderBottom: '1px solid var(--ayrac)'
      }
    },
      cipler,
      YU.h('hr', { sinif: 'yu-ayrac yu-yatay' }),
      satir,
      yardim
    );
  }

  /* Kampanya adı kabuğun dönem listesinden okunur; adlandırma kuralı orada tanımlı,
     burada tekrarlanmaz. Hiçbir döneme düşmeyen tarih (henüz açılmamış kampanya)
     için etiket basılmaz. */
  function kampanyaAdi(iso) {
    var l = YU.donem.liste(), i;
    for (i = 0; i < l.length; i++) {
      if (l[i].bas <= iso && iso <= l[i].bit) return l[i].ad;
    }
    return null;
  }

  function kampanyaEki(iso) {
    var ad = kampanyaAdi(iso);
    return ad ? ' · kampanya ' + ad : '';
  }

  /* ------------------------------------------------------------------
     Düzenleme tablosu
     ------------------------------------------------------------------ */

  function sahipSatirlari(tarih) {
    var kaynak = sahipKaynagi(), tablo = devirTablosu(), alan = sahipAlani();
    var kayitlar = {}, i, s;
    for (i = 0; i < tablo.length; i++) {
      if (tablo[i].DevirTarihi === tarih) kayitlar[tablo[i][alan]] = tablo[i];
    }
    var liste = [];
    for (i = 0; i < kaynak.length; i++) {
      s = kaynak[i];
      /* Pasif kayıt yalnız o tarihte devri varsa görünür: geçmiş kampanyanın satırı
         gizlenirse düzeltilemez, ama yeni devir de açılmamalı (D12). */
      if (s.Aktif === false && !kayitlar[s.Id]) continue;
      liste.push({ sahip: s, kayit: kayitlar[s.Id] || null });
    }
    liste.sort(function (a, b) { return siralaSira(a.sahip, b.sahip); });
    return liste;
  }

  function eylemDugmesi(ikon, baslik, onClick, tehlike) {
    return YU.h('span', {
      sinif: 'yu-satir-eylem' + (tehlike ? ' tehlike' : ''),
      role: 'button', tabindex: '0', title: baslik, 'aria-label': baslik,
      onClick: onClick,
      onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }
    }, YU.svg(ikon, 14));
  }

  function duzenlemePaneli() {
    var tarih = seciliTarih();
    var satirVerisi = sahipSatirlari(tarih);
    var mevcutlar = mevcutHaritasi(YU.db);
    var alanlar = [];
    var satirlar = [], i;
    var kayitliToplam = 0;

    for (i = 0; i < satirVerisi.length; i++) {
      (function (v) {
        var sahip = v.sahip, kayit = v.kayit;

        var alan = YU.ui.alan({
          tip: 'sayi', sag: 'kg', genislik: 170,
          deger: kayit ? Number(kayit.Miktar) : '',
          yerTutucu: kayit ? '' : 'devir yok',
          onInput: function () { canliTazele(); }
        });
        alanlar.push({ sahip: sahip, kayit: kayit, alan: alan, tr: null });
        if (kayit) kayitliToplam += Number(kayit.Miktar) || 0;

        var adHucre = YU.h('div', null,
          YU.h('div', { sinif: 'yu-guclu', metin: sahip.Ad },
            sahip.Aktif === false ? YU.h('span', { stil: { marginLeft: '8px' } }, YU.ui.rozet('Pasif', 'notr')) : null),
          YU.h('div', {
            sinif: 'yu-yardim',
            metin: 'Mevcut stok: ' + YU.fmt.kgU(mevcutlar[sahip.Id] === undefined ? 0 : mevcutlar[sahip.Id])
          })
        );

        var tarihHucre;
        if (kayit) {
          tarihHucre = YU.h('div', null,
            YU.h('div', { metin: YU.fmt.tarih(kayit.DevirTarihi) }),
            YU.h('div', { sinif: 'yu-yardim', metin: etkiMetni(etkiOzeti(sahip.Id, kayit.DevirTarihi)) })
          );
        } else {
          tarihHucre = YU.h('div', null,
            YU.h('div', { metin: tarih ? YU.fmt.tarih(tarih) : '—' }),
            YU.h('div', { sinif: 'yu-yardim', metin: 'Kayıt yok — girilirse yeni satır açılır' })
          );
        }

        var kullaniciHucre = kayit
          ? YU.h('div', null,
              YU.h('div', { metin: kullaniciAdi(kayit.OlusturanKullaniciId) || 'bilinmiyor' }),
              kayit.OlusturmaTarihi
                ? YU.h('div', { sinif: 'yu-yardim', metin: YU.fmt.tarihSaat(kayit.OlusturmaTarihi) })
                : null
            )
          : YU.h('span', { sinif: 'yu-zayif', metin: '—' });

        var kayitliHucre = kayit
          ? YU.h('span', { sinif: 'yu-mono', metin: YU.fmt.kg(kayit.Miktar) })
          : YU.h('span', { sinif: 'yu-zayif', metin: '—' });

        var eylemHucre = kayit
          ? YU.h('div', { stil: { display: 'flex', gap: '3px', justifyContent: 'flex-end' } },
              eylemDugmesi('#ic-trash', 'Bu devir satırını sil', function () { silmeyiBaslat(sahip, kayit); }, true))
          : YU.h('span', { sinif: 'yu-zayif', metin: '—' });

        satirlar.push([adHucre, tarihHucre, kayitliHucre, alan.kok, kullaniciHucre, eylemHucre]);
      })(satirVerisi[i]);
    }

    var tablo = YU.ui.tablo({
      sik: false,        /* giriş alanlı düzenleme tablosu — sık stil daraltmaz */
      sutunlar: [
        { baslik: siloMu() ? 'Silo' : 'Malzeme' },
        { baslik: 'Devir Tarihi', genislik: 230 },
        { baslik: 'Kayıtlı Devir (Kg)', hiza: 'sag', genislik: 150 },
        { baslik: 'Yeni Miktar', hiza: 'sag', genislik: 200 },
        { baslik: 'Giren Kullanıcı', genislik: 170 },
        { baslik: 'İşlem', hiza: 'sag', genislik: 80 }
      ],
      satirlar: satirlar,
      bos: 'Gösterilecek ' + (siloMu() ? 'silo' : 'malzeme') + ' yok.',
      yapiskan: true
    });

    /* Satır referansları: değişen satır sol kenar şeridiyle işaretlenir
       (Malzeme Girişi'ndeki negatif stok işaretiyle aynı dil). */
    var trler = tablo.querySelectorAll('tbody tr');
    for (i = 0; i < alanlar.length && i < trler.length; i++) alanlar[i].tr = trler[i];

    /* Toplam satırı — kayıtlı ve yeni girilen devirlerin kg toplamı. */
    var toplamYeniHucre = YU.h('td', {
      sinif: 'yu-mono', stil: { textAlign: 'right' }, metin: YU.fmt.kg(YU.yuvarla(kayitliToplam))
    });
    var tabloEl = tablo.querySelector('table');
    if (tabloEl && satirVerisi.length) {
      tabloEl.appendChild(YU.h('tfoot', null, YU.h('tr', null,
        YU.h('td', { metin: 'Toplam', colspan: '2' }),
        YU.h('td', {
          sinif: 'yu-mono', stil: { textAlign: 'right' },
          metin: YU.fmt.kg(YU.yuvarla(kayitliToplam))
        }),
        toplamYeniHucre,
        YU.h('td', { colspan: '2' })
      )));
    }

    /* Devretten gelen doldurma: alanlar kurulduktan sonra bir kez yazılır. */
    if (durum.onDoldur) {
      for (i = 0; i < alanlar.length; i++) {
        var doldur = durum.onDoldur[alanlar[i].sahip.Id];
        if (doldur !== undefined && doldur > 0) alanlar[i].alan.ayarla(doldur);
      }
      durum.onDoldur = null;
    }

    var sayacMetin = YU.h('div', {
      stil: { font: '500 14px/1.3 var(--font)', color: 'var(--metin-2)' }
    });
    var kaydetDugmesi = YU.ui.dugme({
      metin: 'Kaydet', ikon: '#ic-wallet', tur: 'birincil',
      onClick: function () { kaydetmeyiBaslat(alanlar); }
    });
    var geriDugmesi = YU.ui.dugme({
      metin: 'Değişiklikleri Geri Al', ikon: '#ic-dots', tur: 'sade',
      onClick: function () { govdeyiCiz(); }
    });

    /* Canlı özet: kaç satır değişecek, yeni toplam kaç kg. Odoo'daki
       "biriktir, sonra uygula" kalıbının buradaki karşılığı. */
    function canliTazele() {
      var degisen = 0, toplam = 0, i2, a, ham, deger, farkli;
      for (i2 = 0; i2 < alanlar.length; i2++) {
        a = alanlar[i2];
        ham = String(a.alan.girdi.value).trim();
        deger = a.alan.deger();
        if (ham !== '' && isFinite(deger)) toplam += deger;
        if (a.kayit) {
          farkli = ham !== '' && (!isFinite(deger) || !YU.hesap.esit(deger, Number(a.kayit.Miktar) || 0));
        } else {
          farkli = ham !== '';
        }
        if (farkli) degisen++;
        if (a.tr) a.tr.style.boxShadow = farkli ? 'inset 3px 0 0 var(--bekleyen)' : '';
      }
      toplamYeniHucre.textContent = YU.fmt.kg(YU.yuvarla(toplam));
      sayacMetin.textContent = degisen
        ? YU.fmt.sayi(degisen) + ' satır değişecek · henüz kaydedilmedi'
        : 'Kaydedilmemiş değişiklik yok';
      kaydetDugmesi.disabled = degisen === 0;
      geriDugmesi.disabled = degisen === 0;
    }

    var altSol = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0' } },
      sayacMetin,
      YU.h('span', {
        sinif: 'yu-yardim',
        metin: 'Boş bırakılan satır kaydedilmez. Var olan bir devri kaldırmak için işlem sütunundaki ' +
          'çöp kutusunu kullanın.'
      })
    );

    var altSatir = YU.h('div', {
      stil: {
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        padding: '14px 18px', borderTop: '1px solid var(--ayrac)'
      }
    },
      altSol,
      YU.h('div', { stil: { flex: '1', minWidth: '12px' } }),
      geriDugmesi,
      kaydetDugmesi
    );

    canliTazele();

    var kampanyaSayisi = devirTarihleri().length;
    return YU.ui.panel({
      baslik: siloMu() ? 'Silo Devirleri' : 'Malzeme Devirleri',
      ikon: siloMu() ? '#ic-building' : '#ic-chart',
      dolgusuz: true,
      sag: YU.h('span', {
        metin: (tarih ? YU.fmt.tarih(tarih) + kampanyaEki(tarih) + ' · ' : '') +
          YU.fmt.sayi(kampanyaSayisi) + ' kampanya devri'
      }),
      govde: [tarihBlogu(), tablo, altSatir]
    });
  }

  /* ------------------------------------------------------------------
     Kaydetme — önce önizleme
     ------------------------------------------------------------------ */

  function degisiklikleriTopla(alanlar) {
    var liste = [], i, a, ham, deger;
    for (i = 0; i < alanlar.length; i++) {
      a = alanlar[i];
      a.alan.hataGoster('');
      ham = String(a.alan.girdi.value).trim();
      if (ham === '') continue;                       /* boş satır: kayıt açılmaz, silinmez */
      deger = a.alan.deger();
      if (isNaN(deger)) {
        a.alan.hataGoster('Miktar sayı olmalı (örn. 240.000 veya 1.234,56).');
        return { hata: true };
      }
      if (deger < 0) {
        a.alan.hataGoster('Devir miktarı negatif olamaz.');
        return { hata: true };
      }
      if (a.kayit && YU.hesap.esit(deger, Number(a.kayit.Miktar) || 0)) continue;
      liste.push({ sahip: a.sahip, kayit: a.kayit, eski: a.kayit ? YU.yuvarla(Number(a.kayit.Miktar) || 0) : null, yeni: YU.yuvarla(deger) });
    }
    return { hata: false, liste: liste };
  }

  function okluDeger(eski, yeni) {
    return YU.h('span', { stil: { whiteSpace: 'nowrap' } },
      YU.h('span', { sinif: 'yu-zayif', metin: eski === null ? '—' : YU.fmt.kg(eski) }),
      YU.h('span', { stil: { color: 'var(--metin-5)', margin: '0 7px' }, metin: '→' }),
      YU.h('span', { sinif: 'yu-guclu', metin: YU.fmt.kg(yeni) })
    );
  }

  function kaydetmeyiBaslat(alanlar) {
    var tarih = seciliTarih();
    if (!tarih) { YU.ui.bildir('Önce devir tarihi seçin.', 'hata'); return; }

    var sonuc = degisiklikleriTopla(alanlar);
    if (sonuc.hata) { YU.ui.bildir('Girilen miktarlarda hata var; alanları kontrol edin.', 'hata'); return; }
    if (!sonuc.liste.length) { YU.ui.bildir('Değişiklik yok.', 'bilgi'); return; }

    var degisiklikler = sonuc.liste;
    var oncekiMevcut = mevcutHaritasi(YU.db);
    var oncekiDokme = YU.stok.dokmeToplam(YU.db);

    var g = geciciDepo(), i;
    for (i = 0; i < degisiklikler.length; i++) {
      geciciDevirUygula(g, degisiklikler[i].sahip.Id, tarih, degisiklikler[i].yeni);
    }
    var sonrakiMevcut = mevcutHaritasi(g);
    var sonrakiDokme = YU.stok.dokmeToplam(g);
    var negatifler = YU.dogrula.ileriBakiye(g, null, null);

    var satirlar = [], d;
    for (i = 0; i < degisiklikler.length; i++) {
      d = degisiklikler[i];
      satirlar.push([
        d.sahip.Ad,
        okluDeger(d.eski, d.yeni),
        okluDeger(oncekiMevcut[d.sahip.Id] === undefined ? 0 : oncekiMevcut[d.sahip.Id],
                  sonrakiMevcut[d.sahip.Id] === undefined ? 0 : sonrakiMevcut[d.sahip.Id])
      ]);
    }

    var govde = [];
    govde.push(YU.h('div', {
      metin: YU.fmt.tarih(tarih) + ' tarihli ' + (siloMu() ? 'silo' : 'malzeme') + ' devrinde ' +
        YU.fmt.sayi(degisiklikler.length) + ' satır değişiyor. Devir değiştiği için bu tarihten ' +
        'sonraki tüm günlerin stoğu yeniden hesaplanır.'
    }));
    govde.push(YU.ui.tablo({
      kompakt: true,
      sutunlar: [
        { baslik: siloMu() ? 'Silo' : 'Malzeme' },
        { baslik: 'Devir', hiza: 'sag', genislik: 190 },
        { baslik: 'Mevcut Stok', hiza: 'sag', genislik: 210 }
      ],
      satirlar: satirlar
    }));

    if (siloMu() && !YU.hesap.esit(oncekiDokme, sonrakiDokme)) {
      govde.push(YU.ui.serit({
        tur: 'bilgi', ikon: '#ic-chart',
        baslik: 'Dökme Kuru Küspe (Siloların Toplamı)',
        metin: YU.fmt.kgU(oncekiDokme) + ' → ' + YU.fmt.kgU(sonrakiDokme) +
          ' · dökme stok siloların toplamı olduğu için silo devri değişince birlikte değişir (Şartname §5).'
      }));
    }

    if (negatifler.length) {
      var uyariSatirlari = [], n;
      for (i = 0; i < negatifler.length; i++) {
        n = negatifler[i];
        uyariSatirlari.push([n.siloAd, YU.fmt.tarih(n.tarih),
          YU.h('span', { stil: { color: 'var(--olumsuz)' }, metin: YU.fmt.kgU(n.bakiye) })]);
      }
      var uyariSerit = YU.ui.serit({
        tur: 'uyari',
        baslik: 'Bu Değişiklikten Sonra Silo Bakiyesi Negatife Düşen Günler Var',
        metin: 'Devir bir düzeltme kalemi olduğu için kayıt engellenmez, ama sonraki günlerin girişleri ' +
          'gözden geçirilmelidir.'
      });
      uyariSerit.querySelector('.yu-serit-govde').appendChild(YU.ui.tablo({
        kompakt: true,
        sutunlar: [{ baslik: 'Silo' }, { baslik: 'Gün', genislik: 120 }, { baslik: 'Bakiye', hiza: 'sag', genislik: 140 }],
        satirlar: uyariSatirlari
      }));
      govde.push(uyariSerit);
    }

    var m = YU.ui.modal({
      baslik: 'Devir Değişikliği Önizlemesi',
      genislik: 640,
      govde: govde,
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m.kapat(); } },
        { metin: 'Kaydet', ikon: '#ic-wallet', tur: 'birincil', onClick: function () { m.kapat(); degisiklikleriYaz(tarih, degisiklikler); } }
      ]
    });
  }

  function degisiklikleriYaz(tarih, degisiklikler) {
    var hatalar = [], uyarilar = [], basarili = 0, i, d, s, kilitGoruldu = false;
    for (i = 0; i < degisiklikler.length; i++) {
      d = degisiklikler[i];
      s = siloMu()
        ? YU.servis.siloDevirKaydet(YU.db, { siloId: d.sahip.Id, devirTarihi: tarih, miktar: d.yeni }, YU.oturum.kullanici)
        : YU.servis.devirKaydet(YU.db, { malzemeId: d.sahip.Id, devirTarihi: tarih, miktar: d.yeni }, YU.oturum.kullanici);
      if (s.ok) basarili++;
      else if (YU.ui.kilitYakala(s)) { kilitGoruldu = true; break; }
      else hatalar = hatalar.concat(etiketle(d.sahip.Ad, s.hatalar));
      uyarilar = uyarilar.concat(etiketle(d.sahip.Ad, s.uyarilar));
    }
    if (kilitGoruldu) { YU.yenile(); return; }

    if (basarili) {
      YU.ui.bildir(YU.fmt.sayi(basarili) + ' devir satırı kaydedildi (' + YU.fmt.tarih(tarih) + ').', 'basari');
    }
    YU.yenile();

    if (hatalar.length || uyarilar.length) {
      var m = YU.ui.modal({
        baslik: hatalar.length ? 'Bazı satırlar kaydedilemedi' : 'Kaydedildi — dikkat edilecekler',
        genislik: 600,
        govde: [YU.ui.hataListesi({ hatalar: hatalar, uyarilar: uyarilar })],
        dugmeler: [{ metin: 'Kapat', tur: 'ikincil', onClick: function () { m.kapat(); } }]
      });
    }
  }

  function etiketle(ad, liste) {
    var cikti = [], i;
    if (!liste) return cikti;
    for (i = 0; i < liste.length; i++) {
      cikti.push({ kod: liste[i].kod, mesaj: ad + ' — ' + liste[i].mesaj });
    }
    return cikti;
  }

  /* ------------------------------------------------------------------
     Devir silme
     ------------------------------------------------------------------ */

  function silmeyiBaslat(sahip, kayit) {
    var oncekiMevcut = mevcutHaritasi(YU.db);
    var oncekiDokme = YU.stok.dokmeToplam(YU.db);

    var g = geciciDepo();
    geciciDevirUygula(g, sahip.Id, kayit.DevirTarihi, null);
    var sonrakiMevcut = mevcutHaritasi(g);
    var sonrakiDokme = YU.stok.dokmeToplam(g);
    var negatifler = YU.dogrula.ileriBakiye(g, null, null);
    var etki = etkiOzeti(sahip.Id, kayit.DevirTarihi);

    var govde = [];
    govde.push(YU.h('div', {
      metin: sahip.Ad + ' için ' + YU.fmt.tarih(kayit.DevirTarihi) + ' tarihli ' + YU.fmt.kgU(kayit.Miktar) +
        ' devir satırı silinecek. ' + etkiMetni(etki) + '.'
    }));
    govde.push(YU.ui.serit({
      tur: 'uyari',
      baslik: 'Silinince Bir Önceki Devre Düşülür',
      metin: 'Stok hesabı “en son devir”i kullanır. Bu satır silinirse ' + sahip.Ad +
        ' için daha eski bir devir varsa ona, yoksa devirsiz duruma (0) düşülür — ' +
        'sonraki tüm günlerin stoğu buna göre değişir.'
    }));
    govde.push(YU.ui.tablo({
      kompakt: true,
      sutunlar: [
        { baslik: siloMu() ? 'Silo' : 'Malzeme' },
        { baslik: 'Mevcut Stok', hiza: 'sag', genislik: 220 }
      ],
      satirlar: [[
        sahip.Ad,
        okluDeger(oncekiMevcut[sahip.Id] === undefined ? 0 : oncekiMevcut[sahip.Id],
                  sonrakiMevcut[sahip.Id] === undefined ? 0 : sonrakiMevcut[sahip.Id])
      ]]
    }));

    if (siloMu() && !YU.hesap.esit(oncekiDokme, sonrakiDokme)) {
      govde.push(YU.h('div', {
        metin: 'Dökme Kuru Küspe (siloların toplamı): ' + YU.fmt.kgU(oncekiDokme) + ' → ' + YU.fmt.kgU(sonrakiDokme)
      }));
    }

    if (negatifler.length) {
      var satirlar = [], i, n;
      for (i = 0; i < negatifler.length; i++) {
        n = negatifler[i];
        satirlar.push([n.siloAd, YU.fmt.tarih(n.tarih),
          YU.h('span', { stil: { color: 'var(--olumsuz)' }, metin: YU.fmt.kgU(n.bakiye) })]);
      }
      var serit = YU.ui.serit({
        tur: 'hata',
        baslik: 'Silme Sonrası Negatife Düşen Silo Günleri',
        metin: 'Bu hareketler devirin üzerine kuruluydu. Silmeden önce ilgili günlerin girişlerini gözden geçirin.'
      });
      serit.querySelector('.yu-serit-govde').appendChild(YU.ui.tablo({
        kompakt: true,
        sutunlar: [{ baslik: 'Silo' }, { baslik: 'Gün', genislik: 120 }, { baslik: 'Bakiye', hiza: 'sag', genislik: 140 }],
        satirlar: satirlar
      }));
      govde.push(serit);
    }

    var m = YU.ui.modal({
      baslik: 'Devir Satırını Sil',
      genislik: 620,
      govde: govde,
      dugmeler: [
        { metin: 'Vazgeç', tur: 'sade', onClick: function () { m.kapat(); } },
        {
          metin: 'Devri sil', ikon: '#ic-trash', tur: 'tehlike',
          onClick: function () { m.kapat(); devriSil(sahip, kayit); }
        }
      ]
    });
  }

  function devriSil(sahip, kayit) {
    var s = YU.servis.devirSil(YU.db, kayit.Id, tip(), YU.oturum.kullanici);
    if (!s.ok) {
      if (YU.ui.kilitYakala(s)) return;
      var mh = YU.ui.modal({
        baslik: 'Devir Silinemedi',
        genislik: 560,
        govde: [YU.ui.hataListesi(s.hatalar)],
        dugmeler: [{ metin: 'Kapat', tur: 'ikincil', onClick: function () { mh.kapat(); } }]
      });
      return;
    }
    YU.ui.bildir(sahip.Ad + ' · ' + YU.fmt.tarih(kayit.DevirTarihi) + ' devri silindi.', 'basari');
    YU.yenile();
    if (s.uyarilar && s.uyarilar.length) {
      var mu = YU.ui.modal({
        baslik: 'Silindi — Dikkat Edilecekler',
        genislik: 560,
        govde: [YU.ui.hataListesi(s.uyarilar, 'uyari')],
        dugmeler: [{ metin: 'Kapat', tur: 'ikincil', onClick: function () { mu.kapat(); } }]
      });
    }
  }

  /* ------------------------------------------------------------------
     Gövde ve sayfa
     ------------------------------------------------------------------ */

  /* Hiç devir yokken "0 kg" dolu tablo yerine yönlendiren boş durum:
     önerilen yol önceki kampanyadan devretmek, alternatifi elle giriş. */
  function bosDurumPaneli() {
    var onceki = oncekiKampanya(null);
    var eylemler = [];
    if (onceki) {
      eylemler.push(YU.ui.dugme({
        metin: 'Önceki Kampanyadan Devret', ikon: '#ic-wallet', tur: 'birincil',
        baslik: 'Kampanya ' + onceki.ad + ' kapanışını (' + YU.fmt.tarih(onceki.bit) + ') satırlara doldurur',
        onClick: function () { devret(onceki, true); }
      }));
    }
    eylemler.push(YU.ui.dugme({
      metin: 'Elle Gir', ikon: '#ic-pencil', tur: onceki ? 'ikincil' : 'birincil',
      onClick: function () { durum.elle[durum.sekme] = true; govdeyiCiz(); }
    }));

    return YU.ui.panel({
      baslik: siloMu() ? 'Silo Devirleri' : 'Malzeme Devirleri',
      ikon: siloMu() ? '#ic-building' : '#ic-chart',
      dolgusuz: true,
      govde: YU.ui.bosDurum({
        ikon: '#ic-wallet',
        baslik: 'İlk Kampanya Devrini Oluşturun',
        metin: 'Bu sekmede henüz devir kaydı yok. Devir, kampanya başındaki açılış stoğudur. ' +
          (onceki
            ? 'Önceki kampanyanın (' + onceki.ad + ') kapanış stoklarını tek tuşla devredebilir ya da elle girebilirsiniz.'
            : 'Tarih seçip miktarları elle girebilirsiniz.'),
        eylemler: eylemler
      })
    });
  }

  /* ==================================================================
     Kampanya Yönetimi (kullanıcı isteği, 24.08.2026)
     - kampanya listesi + kilitle / kilidi aç (yalnız yönetici bu sayfaya
       girebildiği için ayrıca rol kontrolü gerekmez)
     - yeni kampanya oluşturma: devir kopyalama + önceki kampanyayı kilitleme
     ================================================================== */

  function kilitKullanicisi(kilit) {
    if (!kilit) return null;
    var l = YU.db.kullanicilar, i;
    for (i = 0; i < l.length; i++) if (l[i].Id === kilit.KullaniciId) return l[i].AdSoyad;
    return kilit.KullaniciId === null || kilit.KullaniciId === undefined ? 'Sistem' : 'Kullanıcı #' + kilit.KullaniciId;
  }

  function kilitleIste(donem) {
    YU.ui.onay({
      baslik: '"' + donem.ad + '" Kampanyasını Kilitle',
      metin: 'Kilitliyken bu kampanyaya düşen hiçbir gün için veri girişi, düzeltme, silme ve devir değişikliği yapılamaz. ' +
        'Kilidi yine bu ekrandan açabilirsin.',
      onayMetni: 'Kilitle'
    }).then(function (evet) {
      if (!evet) return;
      var s = YU.servis.kampanyaKilitle(YU.db, { kampanya: donem.ad }, YU.oturum.kullanici);
      if (s.ok) YU.ui.bildir('"' + donem.ad + '" kampanyası kilitlendi.', 'basari');
      else YU.ui.bildir(s.hatalar[0] ? s.hatalar[0].mesaj : 'Kilitleme başarısız.', 'hata');
      YU.yenile();
    });
  }

  function kilidiAcIste(donem) {
    YU.ui.onay({
      baslik: '"' + donem.ad + '" Kampanyasının Kilidini Aç',
      metin: 'Kilit açılınca bu kampanyanın günleri yeniden düzenlenebilir ve silinebilir. ' +
        'Geçmiş kampanyada yapılacak değişiklik sonraki günlerin stoklarını yeniden hesaplatır. Emin misin?',
      onayMetni: 'Kilidi Aç', tehlike: true
    }).then(function (evet) {
      if (!evet) return;
      var s = YU.servis.kampanyaKilidiAc(YU.db, { kampanya: donem.ad }, YU.oturum.kullanici);
      if (s.ok) YU.ui.bildir('"' + donem.ad + '" kampanyasının kilidi açıldı.', 'basari');
      else YU.ui.bildir(s.hatalar[0] ? s.hatalar[0].mesaj : 'Kilit açılamadı.', 'hata');
      YU.yenile();
    });
  }

  function onayKutusu(metin, isaretli) {
    var g = YU.h('input');
    g.type = 'checkbox';
    g.checked = !!isaretli;
    g.style.accentColor = 'var(--vurgu)';
    g.style.width = '15px';
    g.style.height = '15px';
    g.style.flex = 'none';
    var kok = YU.h('label', {
      stil: { display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
              font: '400 13.5px/1.4 var(--font)', color: 'var(--metin-2)' }
    }, g, YU.h('span', { metin: metin }));
    return { kok: kok, girdi: g };
  }

  function yeniKampanyaModali() {
    var liste = YU.donem.liste();
    var onceki = liste.length ? liste[liste.length - 1] : null;
    var tarihAlan = YU.ui.alan({
      etiket: 'Kampanya Başlangıç Tarihi', tip: 'tarih',
      deger: YU.tarih.bugun(), genislik: 200
    });
    var devretKutu = onayKutusu('Önceki kampanyanın kapanış stoklarını devir olarak yaz', true);
    var kilitleKutu = onayKutusu('Önceki kampanyayı (' + (onceki ? onceki.ad : '—') + ') kilitle', true);
    var m = YU.ui.modal({
      baslik: 'Yeni Kampanya Oluştur',
      genislik: 500,
      govde: [YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        YU.h('div', {
          metin: 'Seçilen tarihte tüm malzeme ve silolara devir satırları açılır; kampanya o günden başlar. Gelecek tarihe kampanya açılamaz.',
          stil: { font: '400 13.5px/1.55 var(--font)', color: 'var(--metin-2)' }
        }),
        tarihAlan.kok,
        onceki ? devretKutu.kok : null,
        onceki ? kilitleKutu.kok : null
      )],
      dugmeler: [
        { metin: 'Vazgeç' },
        {
          metin: 'Oluştur', ikon: '#ic-plus', tur: 'birincil',
          onClick: function () {
            var s = YU.servis.yeniKampanyaOlustur(YU.db, {
              tarih: tarihAlan.deger(),
              devret: devretKutu.girdi.checked,
              oncekiKilitle: !!(onceki && kilitleKutu.girdi.checked)
            }, YU.oturum.kullanici);
            if (!s.ok) {
              YU.ui.bildir(s.hatalar[0] ? s.hatalar[0].mesaj : 'Kampanya oluşturulamadı.', 'hata');
              return;   /* pencere açık kalır, tarih düzeltilebilir */
            }
            m.kapat();
            YU.donem.tazele();
            YU.ui.bildir('"' + s.kayit.ad + '" kampanyası oluşturuldu (' + YU.fmt.sayi(s.kayit.yazilan) + ' devir satırı).', 'basari');
            YU.yenile();
          }
        }
      ]
    });
  }

  function kampanyaPaneli() {
    var liste = YU.donem.liste();
    var aktifAd = liste.length ? liste[liste.length - 1].ad : null;
    var satirlar = [], i;
    for (i = liste.length - 1; i >= 0; i--) {
      (function (dn) {
        var kilit = YU.servis.kampanyaKilitDurumu(YU.db, dn.ad);
        var simdiki = dn.ad === aktifAd;
        satirlar.push([
          YU.h('span', { sinif: 'yu-guclu', metin: dn.ad }),
          YU.h('span', { sinif: 'yu-mono', metin: YU.fmt.tarih(dn.bas) + ' – ' + YU.fmt.tarih(dn.bit) }),
          YU.fmt.sayi(dn.kayitliGun) + ' gün',
          YU.h('div', { stil: { display: 'flex', gap: '8px', alignItems: 'center' } },
            simdiki ? YU.ui.rozet('Şu Anki', 'vurgu') : YU.ui.rozet('Geçmiş', 'notr'),
            /* Asma kilit ikonu (kullanıcı isteği, 24.08.2026): kapalı kırmızı,
               açık yeşil — rozetle birlikte durum bir bakışta okunur. */
            YU.h('span', {
              stil: { display: 'flex', color: kilit ? 'var(--olumsuz)' : 'var(--olumlu)', flex: 'none' },
              title: kilit ? 'Kampanya kilitli' : 'Kampanya açık'
            }, YU.svg(kilit ? '#ic-kilit' : '#ic-kilit-acik', 15)),
            kilit ? YU.ui.rozet('Kilitli', 'olumsuz') : YU.ui.rozet('Açık', 'olumlu')),
          kilit ? YU.h('span', { sinif: 'yu-zayif', metin: (kilitKullanicisi(kilit) || '—') + ' · ' + YU.fmt.tarihSaat(kilit.Tarih) })
                : YU.h('span', { sinif: 'yu-zayif', metin: '—' }),
          kilit
            ? YU.ui.dugme({ metin: 'Kilidi Aç', ikon: '#ic-kilit-acik', tur: 'tehlike', kucuk: true, onClick: function () { kilidiAcIste(dn); } })
            : YU.ui.dugme({ metin: 'Kilitle', ikon: '#ic-kilit', tur: 'ikincil', kucuk: true, onClick: function () { kilitleIste(dn); } })
        ]);
      })(liste[i]);
    }
    var pnl = YU.ui.panel({
      baslik: 'Kampanya Yönetimi',
      ikon: '#ic-calendar-dots',
      dolgusuz: true,
      sag: YU.ui.dugme({ metin: 'Yeni Kampanya Oluştur', ikon: '#ic-plus', tur: 'birincil', kucuk: true, onClick: yeniKampanyaModali }),
      govde: YU.ui.tablo({
        sutunlar: [
          { baslik: 'Kampanya', genislik: 120 },
          { baslik: 'Aralık', genislik: 210 },
          { baslik: 'Kayıtlı Gün', genislik: 110, hiza: 'sag', mono: true },
          { baslik: 'Durum', genislik: 170 },
          { baslik: 'Kilitleyen', genislik: 210 },
          { baslik: '', hiza: 'sag', genislik: 130 }
        ],
        satirlar: satirlar,
        bos: 'Henüz kampanya yok — ilk devir girildiğinde burada listelenir.'
      })
    });
    /* Satır yazıları bir tık iri (kullanıcı isteği, 24.08.2026) — yalnız bu
       panel; ortak tablo yazısına dokunulmaz. */
    var hucreler = pnl.querySelectorAll('tbody td');
    for (var h2 = 0; h2 < hucreler.length; h2++) hucreler[h2].style.fontSize = '15px';
    return pnl;
  }

  /* Malzeme ve silo devirleri AYNI SAYFADA alt alta durur (kullanıcı isteği,
     24.08.2026); sekme yoktur. Ekranın bütün mantığı durum.sekme üzerinden
     dallandığı için her bölüm çizilirken sekme geçici olarak o bölüme
     ayarlanır. Bölüm içindeki olaylar sonradan çalıştığından, kabın kendisi
     YAKALAMA aşamasında sekmeyi geri kilitler — böylece alttaki düğme hangi
     bölümdeyse doğru tabloya yazar. */
  function sekmeyiKilitle(kap, sekme) {
    var olaylar = ['click', 'change', 'input', 'keydown', 'focusin'];
    for (var i = 0; i < olaylar.length; i++) {
      kap.addEventListener(olaylar[i], function () { durum.sekme = sekme; }, true);
    }
    return kap;
  }

  function govdeyiCiz(hedef) {
    var sekme = hedef || durum.sekme;
    var kap = dom.govde[sekme];
    if (!kap) return;
    durum.sekme = sekme;
    tarihiHazirla();
    YU.bos(kap);
    kap.appendChild(
      !devirTarihleri().length && !durum.elle[sekme] ? bosDurumPaneli() : duzenlemePaneli()
    );
  }

  YU.sayfaTanimla({
    kod: 'devir-stok',
    baslik: 'Devir Stok & Kampanya Yönetimi',
    ikon: '#ic-wallet',
    grup: 'Yönetim',
    rol: 'Yonetici',
    ciz: function (kap, param) {
      /* Savunma derinliği: yetki kapısı kabukta da var (Test 7), ama bu ekran
         devir yazdığı için kendi kontrolünü ayrıca yapar. */
      if (!YU.yonetici()) {
        kap.appendChild(YU.ui.bosDurum({
          ikon: '#ic-percent',
          baslik: 'Bu ekrana erişim yetkiniz yok.',
          metin: 'Devir Stok ekranı Yönetici rolü gerektirir. Kampanya açılış stoğu buradan girildiği için ' +
            'operatör hesabına kapalıdır.',
          eylemler: [
            YU.ui.dugme({ metin: 'Ana Sayfa', ikon: '#ic-home', tur: 'birincil', onClick: function () { YU.git('anasayfa'); } })
          ]
        }));
        return;
      }

      var p = param || {};
      /* ?sekme= artık görünüm değiştirmiyor; yalnız ?tarih= ile birlikte
         hangi bölümün tarihi kurulacağını söyler. */
      if (p.tarih) durum.tarih[(p.sekme === 'silo' ? 'silo' : 'malzeme')] = p.tarih;

      kap.appendChild(kampanyaPaneli());

      var malzemeKap = sekmeyiKilitle(YU.h('div', { stil: { minWidth: '0' } }), 'malzeme');
      var siloKap = sekmeyiKilitle(YU.h('div', { stil: { minWidth: '0' } }), 'silo');
      dom.govde = { malzeme: malzemeKap, silo: siloKap };

      kap.appendChild(YU.h('div', {
        stil: { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '0' }
      }, malzemeKap, siloKap));

      govdeyiCiz('malzeme');
      govdeyiCiz('silo');
    }
  });
})();

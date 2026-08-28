/* Yan Ürünler Stok Takip — açılış. Depoyu kurar, oturumu geri yükler,
   kabuğu ya da giriş perdesini gösterir. SOZLESME.md §0 dosya sırasının sonu. */
(function () {
  'use strict';

  var YU = window.YU || (window.YU = {});
  var baslatildi = false;

  /* Açılışta patlarsak ekran bomboş kalmasın: CSS yüklenmemiş olabileceği için
     kutu kendi renklerini değişken + yedek değerle taşır. */
  function hataKutusu(baslik, hata) {
    var kok = document.getElementById('yu-kok') || document.body;
    var mesaj = hata && hata.message ? hata.message : String(hata);
    var yigin = hata && hata.stack ? String(hata.stack) : '';

    var kutu = document.createElement('div');
    kutu.style.cssText = [
      'max-width:640px', 'margin:64px auto', 'padding:24px 26px',
      'border-radius:10px', 'border:1px solid var(--kenar-3,#dfe3ea)',
      'background:var(--yuzey,#ffffff)', 'color:var(--metin,#171a1f)',
      "font-family:var(--font,'Helvetica Neue',Helvetica,Arial,sans-serif)"
    ].join(';');

    var h = document.createElement('div');
    h.textContent = baslik;
    h.style.cssText = 'font:600 18px/1.3 inherit;margin-bottom:8px';
    kutu.appendChild(h);

    var p = document.createElement('div');
    p.textContent = mesaj;
    p.style.cssText = 'font:400 15px/1.6 inherit;color:var(--metin-3,#5c636e)';
    kutu.appendChild(p);

    if (yigin) {
      var pre = document.createElement('pre');
      pre.textContent = yigin;
      pre.style.cssText = [
        'margin-top:14px', 'padding:12px 14px', 'border-radius:8px', 'overflow:auto',
        'max-height:220px', 'background:var(--yuzey-3,#f4f5f7)',
        'color:var(--metin-4,#5c636e)',
        'font:400 13.5px/1.6 var(--mono,ui-monospace,Menlo,monospace)',
        'white-space:pre-wrap'
      ].join(';');
      kutu.appendChild(pre);
    }

    var eylem = document.createElement('div');
    eylem.style.cssText = 'display:flex;gap:8px;margin-top:18px';

    var yenile = document.createElement('button');
    yenile.type = 'button';
    yenile.textContent = 'Sayfayı Yenile';
    yenile.className = 'yu-dugme birincil';
    yenile.onclick = function () { location.reload(); };
    eylem.appendChild(yenile);

    var sifirla = document.createElement('button');
    sifirla.type = 'button';
    sifirla.textContent = 'Yerel Verileri Sıfırla';
    sifirla.className = 'yu-dugme sade';
    var onaylandi = false;
    sifirla.onclick = function () {
      if (!onaylandi) {                    /* iki adımlı onay — veri silme geri alınamaz */
        onaylandi = true;
        sifirla.textContent = 'Emin misiniz? Tekrar tıklayın';
        sifirla.className = 'yu-dugme tehlike';
        return;
      }
      try { localStorage.removeItem('yu.veri.v1'); localStorage.removeItem('yu.oturum'); } catch (e) { /* yoksay */ }
      location.reload();
    };
    eylem.appendChild(sifirla);

    kutu.appendChild(eylem);

    if (kok.replaceChildren) kok.replaceChildren(kutu);
    else { while (kok.firstChild) kok.removeChild(kok.firstChild); kok.appendChild(kutu); }

    if (window.console) console.error('[baslat] ' + baslik, hata);
  }

  function depoOzeti(depo) {
    return {
      kaynak: depo.kaynak,
      kullanicilar: (depo.kullanicilar || []).length,
      malzemeler: (depo.malzemeler || []).length,
      silolar: (depo.silolar || []).length,
      devirStok: (depo.devirStok || []).length,
      siloDevirStok: (depo.siloDevirStok || []).length,
      gunlukHareket: (depo.gunlukHareket || []).length,
      kuruKuspeGunluk: (depo.kuruKuspeGunluk || []).length,
      siloHareket: (depo.siloHareket || []).length,
      degisiklikLog: (depo.degisiklikLog || []).length
    };
  }

  YU.baslat = function () {
    if (baslatildi) return;
    baslatildi = true;
    try {
      if (typeof YU.Depo !== 'function') {
        throw new Error('YU.Depo bulunamadı — js/01-cekirdek.js yüklenmemiş ya da hata vermiş olabilir.');
      }
      if (typeof YU.sayfaTanimla !== 'function') {
        throw new Error('YU.sayfaTanimla bulunamadı — js/10-kabuk.js yüklenmemiş olabilir.');
      }

      YU.db = YU.Depo({ kaynak: 'local', tohumla: true });

      /* Günlük yedek klasörü (GUNLUK-YEDEK-PLANI, 27.08.2026): saklı klasör
         tutamacı varsa sessizce bağlanır ve kaçan günleri tamamlar. */
      if (YU.yedekci) YU.yedekci.baslat();

      /* index.html yalnızca açık/koyu seçimini uygular; 'sistem' modunda da
         düğme etiketinin doğru başlaması için tema burada tazelenir. */
      YU.tema.ayarla(YU.tema.al());

      var kullanici = YU.oturumYukle();

      if (window.console) {
        console.log('Yan Ürünler Stok Takip · prototip');
        console.log('Depo:', depoOzeti(YU.db));
        console.log('Oturum:', kullanici ? (kullanici.AdSoyad + ' · ' + kullanici.Rol) : 'yok (giriş perdesi)');
        /* Saat kaynağı, eşitleme bitince yazılır (YU.zaman · 26.08.2026):
           "internet" mi "bilgisayar" mı, kayma kaç saniye — tek satırda. */
        YU.zaman.esitle().then(function () {
          var z = YU.zaman.durum();
          console.log('Saat:', YU.zaman.damga() + ' İstanbul · kaynak: ' +
            (z.kaynak === 'internet' ? 'internet (' + z.sunucu + ')' : 'bilgisayar saati — internete ulaşılamadı') +
            ' · makine sapması: ' + (z.kayma / 1000).toFixed(1) + ' sn');
        });
      }

      /* Oturum yoksa giriş EKRANINI doğrudan çizmek yerine giriş ADRESİNE
         gidilir (26.08.2026): adres ile ekran birbirini tutsun. Yönlendirmeyi
         ve gidilmek istenen sayfayı hatırlamayı 10-kabuk · ciz() yapar. */
      if (!location.hash) YU.git(kullanici ? 'anasayfa' : 'giris');
      else YU.yenile();
    } catch (e) {
      hataKutusu('Uygulama başlatılamadı', e);
    }
  };

  /* Açılıştan sonraki beklenmedik hatalar ekranı silmesin; görünür kalsın yeter. */
  window.addEventListener('error', function (e) {
    if (window.console) console.error('[hata]', e.error || e.message);
    if (YU.ui && YU.ui.bildir) YU.ui.bildir('Beklenmedik hata: ' + (e.message || 'ayrıntı konsolda'), 'hata');
  });

  window.addEventListener('unhandledrejection', function (e) {
    if (window.console) console.error('[hata]', e.reason);
    if (YU.ui && YU.ui.bildir) YU.ui.bildir('Beklenmedik hata: ' + ((e.reason && e.reason.message) || 'ayrıntı konsolda'), 'hata');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', YU.baslat);
  else YU.baslat();
})();

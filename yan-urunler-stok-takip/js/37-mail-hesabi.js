/* js/37-mail-hesabi.js — Yönetim Paneli › Mail Hesabı (kullanıcı direktifi, 28.08.2026)

   TEK MASTER HESAP. Kullanıcının sözü: "Master hesap oluşturacam ve
   bağlıcam ama bu hesap programı kullanan tüm kullanıcılarda tanımlı
   olmalı." Giriş/çıkış/sınama artık BURADADIR, yalnız Yönetici rolüne
   açık — "Raporu Mail ile Gönder" panelindeki (35-mail-gonder.js) eski
   üç kutulu form buraya taşındı. O panel artık hesaba dokunmaz, yalnız
   bağlı mı diye mini bir satır okur (aynı kullanıcı direktifi: "mail
   gönderdeki panelde giriş çıkış bilgisi olmasın").

   FETCH MANTIĞI TEKRAR YAZILMAZ: YU.mailHesap (35-mail-gonder.js'te
   kurulur) paylaşılan tek kaynaktır — kip/hesap/tahmin/girisYap/
   cikisYap/sina. Bu dosya yalnız ekranı çizer. */
(function () {
  "use strict";

  var YU = window.YU;

  YU.sayfaTanimla({
    kod: 'mail-hesabi',
    baslik: 'Mail Hesabı',
    altBaslik: 'Günlük rapor postası için ortak hesap',
    ikon: '#ic-doc',
    grup: 'Yönetim',
    rol: 'Yonetici',

    ciz: function (kap) {
      YU.bos(kap);

      /* Yönlendirici zaten yetki kapısı işletiyor; ekran kendi kontrolünü de yapar. */
      if (!YU.yonetici()) {
        kap.appendChild(YU.ui.bosDurum({
          ikon: '#ic-percent',
          baslik: 'Bu ekrana erişim yetkiniz yok.',
          metin: 'Mail Hesabı yalnızca Yönetici rolüne açıktır.'
        }));
        return;
      }

      if (!YU.mailHesap) {
        kap.appendChild(YU.ui.bosDurum({
          ikon: '#ic-alert',
          baslik: 'Mail modülü yüklenemedi.',
          metin: 'js/35-mail-gonder.js yüklenmemiş görünüyor.'
        }));
        return;
      }

      var govde = YU.h('div', { stil: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '620px' } });
      kap.appendChild(YU.ui.panel({
        baslik: 'Mail Hesabı',
        ikon: '#ic-doc',
        dolgusuz: true,
        govde: [YU.h('div', { stil: { padding: '18px' } }, govde)]
      }));

      /* ---------------- durum + sınama sonucu (paylaşılan çizim) ---------------- */

      var sinamaSonucu = null;   /* { calisiyor, hata } | null — son "Bağlantıyı Sına" sonucu */

      function sinaSatiri() {
        if (!sinamaSonucu) return null;
        var iyi = sinamaSonucu.calisiyor;
        return YU.h('div', {
          stil: {
            display: 'flex', alignItems: 'flex-start', gap: '9px',
            padding: '10px 13px', borderRadius: 'var(--r)',
            border: '1px solid ' + (iyi ? 'var(--olumlu)' : 'var(--olumsuz)'),
            background: iyi ? 'var(--olumlu-zemin)' : 'var(--olumsuz-zemin)'
          }
        },
          YU.h('span', {
            stil: { display: 'flex', flex: 'none', marginTop: '1px', color: iyi ? 'var(--olumlu)' : 'var(--olumsuz)' }
          }, YU.svg(iyi ? '#ic-checklist' : '#ic-alert', 16)),
          YU.h('span', {
            metin: iyi ? 'Bağlantı çalışıyor — test postası gönderildi.' : ('Bağlantı çalışmıyor: ' + sinamaSonucu.hata),
            stil: { font: '400 13.5px/1.5 var(--font)', color: 'var(--metin-2)' }
          })
        );
      }

      /* ---------------- bağlıyken: künye + Sına + Çıkış ---------------- */

      function bagliGorunumu(hesap) {
        var sinaDugmesi = YU.ui.dugme({
          metin: 'Bağlantıyı Sına', ikon: '#ic-checklist', tur: 'ikincil', kucuk: true,
          baslik: 'Kayıtlı hesapla gerçek bir test postası gönderir',
          onClick: function () {
            var eski = sinaDugmesi.textContent;
            sinaDugmesi.disabled = true;
            sinaDugmesi.textContent = 'Sınanıyor...';
            YU.mailHesap.sina().then(function (y) {
              sinaDugmesi.disabled = false;
              sinaDugmesi.textContent = eski;
              sinamaSonucu = (y.govde && typeof y.govde.calisiyor === 'boolean')
                ? y.govde
                : { calisiyor: false, hata: 'Sunucu yanıt vermedi (' + y.kod + ').' };
              yenidenCiz();
            })['catch'](function (e) {
              sinaDugmesi.disabled = false;
              sinaDugmesi.textContent = eski;
              sinamaSonucu = { calisiyor: false, hata: e && e.message ? e.message : 'Ağ hatası.' };
              yenidenCiz();
            });
          }
        });

        var cikisDugmesi = YU.ui.dugme({
          metin: 'Çıkış', kucuk: true, tur: 'tehlike',
          onClick: function () {
            YU.ui.onay({
              baslik: 'Mail Hesabından Çık',
              metin: 'Kayıtlı hesap silinecek. Bu hesabı kullanan tüm kullanıcılar için rapor postası duracak — yeniden bağlanana kadar rapor yalnız PDF olarak inecek.',
              onayMetni: 'Çık', tehlike: true
            }).then(function (evet) {
              if (!evet) return;
              YU.mailHesap.cikisYap().then(function () {
                sinamaSonucu = null;
                YU.ui.bildir('Mail hesabından çıkıldı.', 'basari');
                yenidenCiz();
              })['catch'](function () { YU.ui.bildir('Çıkış yapılamadı.', 'hata'); });
            });
          }
        });

        var satirlar = [
          YU.h('div', {
            stil: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }
          },
            YU.h('span', { stil: { display: 'flex', flex: 'none', color: 'var(--olumlu)' } }, YU.svg('#ic-checklist', 18)),
            YU.h('span', { metin: hesap.adres, stil: { font: '600 16px/1.3 var(--font)', color: 'var(--metin)' } }),
            YU.h('span', { metin: hesap.sunucu + ':' + hesap.port, stil: { font: '400 13.5px/1.3 var(--font)', color: 'var(--metin-4)' } })
          ),
          YU.h('div', { stil: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, sinaDugmesi, cikisDugmesi)
        ];
        var sinaS = sinaSatiri();
        if (sinaS) satirlar.push(sinaS);
        return satirlar;
      }

      /* ---------------- bağlı değilken: giriş formu ---------------- */

      function girisFormu() {
        var adresAlani = YU.ui.alan({ etiket: 'Mail Adresin', tip: 'metin', genislik: '260px' });
        var parolaAlani = YU.ui.alan({ etiket: 'Uygulama Parolası', tip: 'metin', genislik: '200px' });
        parolaAlani.girdi.type = 'password';
        parolaAlani.girdi.autocomplete = 'off';
        var sunucuAlani = YU.ui.alan({ etiket: 'SMTP Sunucusu', tip: 'metin', genislik: '190px' });
        var portAlani = YU.ui.alan({ etiket: 'Port', tip: 'sayi', genislik: '80px' });

        var uyariSatiri = YU.h('div', {
          stil: { display: 'none', font: '400 13.5px/1.5 var(--font)', color: 'var(--olumsuz)' }
        });

        /* Adres yazılınca sunucu/port kendiliğinden dolar; son OTOMATİK
           doldurulan değer hatırlanır ki ikinci bir adres denemesi
           (ör. hotmail'den gmail'e geçiş) kutuyu eski sağlayıcıda
           kilitlemesin — elle yazılmış bir değere de dokunulmaz. */
        var sonOtoSunucu = '', sonOtoPort = '';
        adresAlani.girdi.addEventListener('blur', function () {
          var a = String(adresAlani.girdi.value).trim();
          if (a.indexOf('@') < 1) return;
          YU.mailHesap.tahmin(a).then(function (g) {
            if (!g) return;
            var suAn = String(sunucuAlani.girdi.value).trim();
            var suAnPort = String(portAlani.girdi.value).trim();
            /* Otomatik dolan değer SEÇİLİ gelir (kullanıcı isteği,
               28.08.2026): kutu değiştirilebilir kalır, ama kullanıcı
               üzerine yazmak isterse imleci konumlandırmadan direkt
               yazabilsin diye metin baştan vurgulu durur. */
            if (!suAn || suAn === sonOtoSunucu) { sunucuAlani.ayarla(g.sunucu); sunucuAlani.girdi.select(); }
            if (!suAnPort || suAnPort === sonOtoPort) { portAlani.ayarla(g.port); portAlani.girdi.select(); }
            sonOtoSunucu = g.sunucu;
            sonOtoPort = String(g.port);
            uyariSatiri.textContent = g.uyari || '';
            uyariSatiri.style.display = g.uyari ? 'block' : 'none';
          });
        });

        var girisDugmesi = YU.ui.dugme({
          metin: 'Giriş Yap', ikon: '#ic-kilit-acik', tur: 'birincil',
          onClick: function () {
            var adres = String(adresAlani.girdi.value).trim();
            var parola = String(parolaAlani.girdi.value);
            if (!adres || !parola) {
              YU.ui.bildir('Mail adresi ve uygulama parolası gerekli.', 'hata');
              return;
            }
            girisDugmesi.disabled = true;
            var eski = girisDugmesi.textContent;
            girisDugmesi.textContent = 'Bağlanıyor...';
            YU.mailHesap.girisYap({
              adres: adres,
              parola: parola,
              sunucu: String(sunucuAlani.girdi.value).trim(),
              port: portAlani.deger(),
              ssl: true
            }).then(function (y) {
              girisDugmesi.disabled = false;
              girisDugmesi.textContent = eski;
              if (y.kod === 200 && y.govde && y.govde.hesap) {
                YU.ui.bildir('Bağlandı: ' + y.govde.hesap.adres, 'basari');
                sinamaSonucu = null;
                yenidenCiz();
                return;
              }
              YU.ui.bildir((y.govde && y.govde.hata) || ('Giriş yapılamadı (sunucu ' + y.kod + ').'), 'hata');
            })['catch'](function (e) {
              girisDugmesi.disabled = false;
              girisDugmesi.textContent = eski;
              YU.ui.bildir('Sunucuya ulaşılamadı: ' + (e && e.message ? e.message : 'ağ hatası'), 'hata');
            });
          }
        });

        return [
          YU.h('div', {
            stil: { font: '400 14px/1.5 var(--font)', color: 'var(--metin-2)' },
            metin: 'Bu hesap, programı kullanan HERKESİN rapor postası için ortaktır — bir kez bağlanır, kimse tekrar giriş yapmaz.'
          }),
          YU.h('div', {
            stil: { display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }
          }, adresAlani.kok, parolaAlani.kok, sunucuAlani.kok, portAlani.kok, girisDugmesi),
          uyariSatiri,
          YU.h('div', {
            stil: { font: '400 13.5px/1.5 var(--font)', color: 'var(--metin-3)' },
            metin: 'Asıl parolanı değil, sağlayıcının bu program için ürettiği uygulama parolasını yaz.'
          }),
          /* GMAIL İÇİN ADIM ADIM (kullanıcı isteği, 28.08.2026): "buraya
             gir, şuraya gir gibisinden". İki bağlantı gerçek Google
             sayfalarına gider; ikinci linkteki tek kullanımlık "rapt="
             yeniden doğrulama jetonu ATILDI — o jeton yalnız kullanıcının
             o anki tarayıcı oturumuna aitti, başkasında (ya da yeniden
             açılınca) geçersiz olurdu. Kanonik adres her zaman çalışır. */
          YU.h('div', {
            stil: {
              marginTop: '2px', padding: '10px 13px', borderRadius: 'var(--r)',
              border: '1px solid var(--kenar)', background: 'var(--yuzey-2)',
              display: 'flex', flexDirection: 'column', gap: '5px'
            }
          },
            YU.h('div', {
              metin: 'Gmail uygulama parolası yoksa:',
              stil: { font: '600 13px/1.4 var(--font)', color: 'var(--metin-2)' }
            }),
            YU.h('div', { stil: { font: '400 13.5px/1.6 var(--font)', color: 'var(--metin-2)' } },
              YU.h('span', { metin: '1. İki Adımlı Doğrulamayı aç — ' }),
              YU.h('a', {
                metin: 'Google Hesap Güvenliği sayfasına git',
                href: 'https://myaccount.google.com/security',
                target: '_blank', rel: 'noopener noreferrer',
                stil: { color: 'var(--vurgu)', textDecoration: 'underline' }
              })
            ),
            YU.h('div', { stil: { font: '400 13.5px/1.6 var(--font)', color: 'var(--metin-2)' } },
              YU.h('span', { metin: '2. Uygulama parolası üret — ' }),
              YU.h('a', {
                metin: 'Uygulama Şifreleri sayfasına git',
                href: 'https://myaccount.google.com/apppasswords',
                target: '_blank', rel: 'noopener noreferrer',
                stil: { color: 'var(--vurgu)', textDecoration: 'underline' }
              })
            ),
            YU.h('div', {
              metin: 'Çıkan 16 haneli kodu (boşluklu ya da boşluksuz) yukarıdaki Uygulama Parolası kutusuna yapıştır.',
              stil: { font: '400 13px/1.5 var(--font)', color: 'var(--metin-4)' }
            })
          )
        ];
      }

      /* ---------------- çizim ---------------- */

      function yenidenCiz() {
        YU.bos(govde);
        govde.appendChild(YU.h('div', { metin: 'Bağlantı sorgulanıyor…', stil: { font: '400 14px/1.5 var(--font)', color: 'var(--metin-3)' } }));
        YU.mailHesap.kip(true).then(function (kip) {
          YU.bos(govde);

          if (kip === 'yok') {
            govde.appendChild(YU.ui.bosDurum({
              ikon: '#ic-alert',
              baslik: 'Sunucuya ulaşılamıyor.',
              metin: 'Mail hesabı yönetimi yalnız .NET sunucusu üzerinden çalışır.'
            }));
            return;
          }

          var hesap = YU.mailHesap.hesap();
          var parcalar = (kip === 'postali' && hesap) ? bagliGorunumu(hesap) : girisFormu();
          for (var i = 0; i < parcalar.length; i++) govde.appendChild(parcalar[i]);
        });
      }

      yenidenCiz();
    }
  });
})();

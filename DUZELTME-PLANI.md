
## SONUÇ — DÖRDÜNCÜ PARTİ (25.08.2026, uygulama tamamlandı)

* M24: `dokmeDeviri()` eklendi; dökme satırı sezon pencereli. Node ölçümü:
  iki kampanyalı boş sistemde Devir 600.000 / Üretim 150.000 / Mevcut 750.000;
  tohumda devir 1.062.000 (düzeltilmiş silo toplamı, tarih 22.07.2026).
* M25: Ekle log özeti "· iade X kg" taşıyor (ölçüldü: "üretim 0 kg · satış
  0 kg · iade 1.500 kg"); hareket paneli rozet + Giren "İade" satırı +
  silinen dalı iadeli. Tarayıcıda "İade 2.750" satırı görüldü.
* M26: Ana Sayfa tablosuna Toplam İade (Kg) kolonu. Tarayıcı ölçümü:
  9.500 + 431.940 + 2.750 − 363.420 = 80.770 — satır kendi içinde tutuyor.
* M27: stoklu silo pasifleştirmede servis uyarısı (Node: yalnız stokluda,
  boşta/aktifleştirmede yok); Program Hareketleri stoklu pasif siloyu
  düşürmüyor (Node: gün sonu 240.000 = Stok Durumu 240.000); durum
  değiştirme akışı servis uyarısını bildiriyor.
* M28: `YU.ui.onay` ayrinti + `YU.ui.farkListesi`; malzeme/silo/kullanıcı
  modallarında değişiklik-onayı (değişen alan yoksa pencere yok). Tarayıcı:
  rol değişiminde "Rol: Operatör → Yönetici" + erişim cümlesi; Vazgeç →
  rol değişmedi.
* M29: İşlem Geçmişi paneline süzgeç şeridi (başlangıç/bitiş/kullanıcı/
  kayıt türü) + `YU.log.SINIR` + %90/%100 şerit ve zil uyarıları. Tarayıcı:
  varsayılan gün 22 işlem → aralık genişletince 29 → kullanıcı süzgeciyle 4.
  **Not:** panel 24.08'de gün paneli lehine ekrandan kaldırılmıştı; süzgeç
  isteği panel üzerine verildiği ve KURAL 7 paneli tek sunum yeri saydığı
  için hareket dökümünün ALTINA süzgeçli olarak geri eklendi.
* M30: Analizler "Kampanya Toplamları" paneline tek satır not — "Üretim
  göstergeleri iadeyi içermez…" (tarayıcıda görüldü; sayılar değişmedi).
* M31: `uykuda` eşiği (son kayıttan 7 gün) — iki uyarı birbirini dışlar.
  Tarayıcı: geçmiş kampanya seçiliyken yalnız "Kampanya Aralığının
  Dışındasınız"; aktif kampanyada (bugün kayıtlı) uyarı yok.
* **Tarayıcıda 12 kabul testi: 12/12 GEÇTİ** (tüm değişiklikler yüklüyken,
  iki kez — parti ortası ve parti sonu).
* Node sözdizimi denetimi: 04, 10, 20, 25, 28, 29, 31, 32 → temiz.
* SEMA_SURUM değişmedi: tohum çıktısı aynı, mevcut tarayıcı verileri korunur.
* Kapsam dışı bırakılanlar: "Verileri Sıfırla"/"Örnek Veri Yükle" duruyor
  (kullanıcı kararı — prototip); SOZLESME.md güncellenmedi (M13/M21 kararı).

### REVİZE — DÖRDÜNCÜ PARTİ (25.08.2026, kullanıcı kararları)

* **M29 revize ("geri çek"):** İşlem Geçmişi paneli ekrandan geri çekildi;
  24.08'deki kaldırma geçerli. `gunIslemGecmisi` süzgeçli hâliyle
  (tarih aralığı + kullanıcı + kayıt türü) YEDEK durur; log sınır uyarıları
  panele değil üst şerit ziline bağlı olduğundan aktif kalır.
  Not: CLAUDE.md KURAL 7 hâlâ bu paneli işlem geçmişinin "tek sunum yeri"
  sayıyor — metin kodun gerisinde, güncellemesi kullanıcı kararına bırakıldı.
* **M31 revize (kilit esaslı):** 7 gün eşiği kaldırıldı — sezonun bittiğine
  sistem karar vermez; kullanıcı Devir Stok & Kampanya Yönetimi'nden
  kampanyayı KİLİTLEyerek belirtir. Bugünün kampanyası kilitliyse "Bugünün
  Girişi Yok" üretilmez (kilitliye zaten veri yazılamaz); "Kampanya
  Aralığının Dışındasınız" seçili dönem kilitliyken (veya bugün dönem
  başlamadan önceyken) görünür ve "kilitli — önce kilidi açın" notu taşır.
* **Yeni: kilitsiz geçmiş sezon şeridi (kullanıcı isteği, 25.08.2026):**
  geçmiş bir kampanyanın (bugünün sezonu dışındakiler) kilidi açıksa içerik
  alanının EN ÜSTÜNDE kalıcı sarı şerit durur: "X Kampanyasının Kilidi
  Açık — geçmiş sezon verileri değişikliğe açık…"; yöneticiye Kampanya
  Yönetimi düğmesi eklenir. Her sayfa çiziminde tazelenir, kilit kapanınca
  kendiliğinden kalkar. Tohum geçmiş sezonu kilitsiz bıraktığı için şerit
  ilk açılışta görünür — kullanıcı kilitleyince düşer.

**Doğrulama (tarayıcı):** şerit ilk açılışta var → 2025/2026 kilitlenince
kalktı; bugün silinince "Bugünün Girişi Yok" geldi → 2026/2027 kilitlenince
yalnız "Kampanya Aralığının Dışındasınız [kilit notlu]" kaldı → kilit
açılınca hatırlatma geri geldi. Program Hareketleri'nde İşlem Geçmişi paneli
yok. Kabul testleri **12/12 GEÇTİ**; test verisi sonrası önizleme deposu
sıfırlandı (taze tohum).

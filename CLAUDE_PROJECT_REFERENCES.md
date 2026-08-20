# Claude Code — Muhasebe Programı Teknik Referans ve Uygulama Rehberi

## 1. Amaç

Bu dosya, bu projeyi geliştirirken Claude Code'un hangi açık kaynak projelerden ve güvenlik kaynaklarından **nasıl faydalanacağını** tanımlar.

Bu kaynaklar aynı amaçla kullanılmamalıdır:

- Bazıları **proje mimarisi** için referanstır.
- Bazıları **uygulamada kullanılacak gerçek kütüphane/framework** niteliğindedir.
- Bazıları yalnızca **güvenlik standardı / kontrol listesi** olarak kullanılacaktır.
- Bazıları yalnızca **muhasebe iş akışlarını incelemek** için referanstır.

> Önemli: Referans repoların kaynak kodunu körü körüne kopyalama. Önce lisansı, proje ihtiyacını ve mevcut mimariyle uyumluluğu kontrol et. Kullanılmayan bağımlılıkları projeye ekleme.

---

# 2. Projenin Ana Teknik Hedefi

Uygulama:

- React + TypeScript tabanlı olacak.
- Geliştirme ve ilk kullanım aşamasında localhost üzerinde çalışacak.
- Claude Design'da onaylanmış dashboard tasarımı uygulamanın görsel kaynağıdır.
- Light Mode ve Dark Mode desteklenecek.
- Google ile giriş yapılacak.
- Kullanıcılar role ve yetkiye göre ayrılacak.
- İlk temel roller:
  - `manager` / Yönetici
  - `worker` / İşçi
- Menü, modül, sayfa, buton ve API işlemleri permission sistemine göre kontrol edilecek.
- Yerel veritabanı olarak başlangıçta SQLite kullanılacak.
- Veritabanına erişim Prisma üzerinden yapılacak.
- Güvenlik, sonradan eklenecek bir özellik değil; mimarinin başından itibaren uygulanacaktır.

---

# 3. Kullanılacak / Referans Alınacak Kaynaklar

## 3.1 Bulletproof React

Repository:

https://github.com/alan2207/bulletproof-react

### Kullanım amacı

Bu repo **uygulamanın klasör ve kod organizasyonunu tasarlamak için referans** olarak kullanılacaktır.

Kodunu doğrudan kopyalamak zorunlu değildir.

Özellikle şu prensiplerden yararlan:

- Feature-based architecture
- Birbirinden ayrılmış domain/modül yapısı
- Ortak componentlerin merkezi tutulması
- API, hook, type ve utility kodlarının düzenli ayrılması
- Modüller arasında gereksiz bağımlılık oluşturmama
- Büyüdükçe yönetilebilir klasör yapısı

Önerilen yaklaşım:

```text
src/
├── app/
├── components/
├── features/
│   ├── dashboard/
│   ├── invoices/
│   ├── expenses/
│   ├── customers/
│   ├── payments/
│   ├── reports/
│   ├── taxes/
│   ├── users/
│   ├── trash/
│   └── settings/
├── hooks/
├── lib/
├── routes/
├── types/
└── utils/
```

Mevcut projede daha iyi ve oturmuş bir yapı varsa sırf bu repoya uymak için bozma. Esas amaç **düzenli, feature-based ve sürdürülebilir mimari** kurmaktır.

---

## 3.2 Refine

Repository:

https://github.com/refinedev/refine

### Kullanım amacı

Refine özellikle uygulamanın:

- CRUD akışları
- resource mantığı
- veri erişim katmanı
- listeleme
- filtreleme
- form işlemleri
- route entegrasyonu
- access control entegrasyonu

gibi alanlarında kullanılabilir.

### Önemli tasarım kuralı

Refine'ın hazır admin/dashboard görünümünü kullanarak Claude Design tasarımını değiştirme.

**Claude Design dashboard'u görsel source of truth'tur.**

Refine mümkün olduğunca **headless/core mantığında** kullanılmalıdır.

Örnek resource'lar:

```text
invoices
expenses
customers
payments
reports
taxes
users
trash
settings
```

Örneğin `invoices` için:

```text
list
create
read
update
delete / trash
restore
```

işlemleri merkezi ve tekrar kullanılabilir bir yapı ile yönetilmelidir.

---

## 3.3 Better Auth

Repository:

https://github.com/better-auth/better-auth

Dokümantasyon:

https://www.better-auth.com/

### Kullanım amacı

Authentication ve kullanıcı oturum sistemi için öncelikli çözüm olarak değerlendir.

Temel ihtiyaçlar:

- Google OAuth
- Kullanıcı oturumu
- Session yönetimi
- Kullanıcı kimliği
- Role / permission entegrasyonu
- Gerekirse ileride 2FA

### Kritik kural

Google yalnızca kullanıcının **kim olduğunu doğrular**.

Bir kullanıcının `manager` veya `worker` olduğu bilgisi frontend tarafından belirlenmemelidir.

Yanlış:

```text
Google Login
→ frontend localStorage:
role = "manager"
```

Doğru yaklaşım:

```text
Google Login
→ authenticated user
→ server/database üzerinden kullanıcı kaydı
→ role + permissions
→ backend authorization
```

Rol ve yetkiler sunucu tarafında güvenilir kaynaktan okunmalıdır.

---

# 4. Role ve Permission Sistemi

Sadece iki role hard-code edilmiş koşullar yazmak yerine merkezi bir permission sistemi oluştur.

Örneğin:

```text
manager
├── dashboard.read
├── invoice.read
├── invoice.create
├── invoice.update
├── invoice.trash
├── invoice.restore
├── expense.read
├── expense.create
├── expense.update
├── expense.trash
├── customer.read
├── customer.create
├── customer.update
├── report.read
├── tax.read
├── user.read
├── user.manage
├── settings.read
└── settings.update
```

```text
worker
├── dashboard.read
├── invoice.read
├── invoice.create
├── invoice.update
├── expense.read
├── expense.create
├── customer.read
├── customer.create
└── customer.update
```

Bu sadece başlangıç örneğidir. Gerçek permission matrisi proje gereksinimlerine göre merkezi olarak tanımlanmalıdır.

## Frontend kontrolü

Yetkisi olmayan kullanıcı için:

- Menü gösterilmemeli.
- Route erişimi engellenmeli.
- Buton/action gösterilmemeli veya disable edilmelidir.

## Backend kontrolü

Frontend'de butonu gizlemek **güvenlik değildir**.

Her kritik API işlemi backend'de tekrar doğrulanmalıdır.

Örneğin:

```text
DELETE /api/invoices/123

1. Session geçerli mi?
2. Kullanıcı kim?
3. invoice.trash yetkisi var mı?
4. Bu kayıt üzerinde işlem yapma hakkı var mı?
5. Evet → işlemi gerçekleştir.
6. Hayır → 403 Forbidden.
```

Backend permission kontrolü olmadan sadece Refine/UI access control'e güvenme.

---

# 5. Prisma

Repository:

https://github.com/prisma/prisma

### Kullanım amacı

Backend ile veritabanı arasındaki ana erişim katmanı olarak kullan.

Prisma şu işler için kullanılmalıdır:

- Database schema
- Type-safe sorgular
- Relations
- Migration yönetimi
- Transaction kullanımı
- Veri bütünlüğü

Frontend doğrudan SQLite dosyasına erişmemelidir.

Doğru akış:

```text
React UI
   ↓
API / Backend
   ↓
Authorization + Validation
   ↓
Business Logic
   ↓
Prisma
   ↓
SQLite
```

---

# 6. SQLite

Başlangıçta uygulama localhost / tek bilgisayar ağırlıklı kullanılacağı için SQLite kullanılabilir.

Örnek temel entity'ler:

```text
User
Role / Permission
Customer
Invoice
InvoiceItem
Expense
Payment
TaxRate
AuditLog
```

Gereksiz şekilde erken PostgreSQL veya karmaşık dağıtık mimariye geçme.

Ancak ileride birden fazla bilgisayar aynı merkezi veritabanına eşzamanlı erişecekse PostgreSQL'e geçiş ayrıca değerlendirilmelidir.

---

# 7. OWASP Cheat Sheet Series

Repository:

https://github.com/OWASP/CheatSheetSeries

### Kullanım amacı

Bu repo dependency olarak kurulmayacaktır.

Claude Code bunu **güvenli implementasyon rehberi** olarak kullanmalıdır.

Özellikle şu başlıklarda OWASP tavsiyelerini kontrol et:

- Authentication
- Authorization
- Session Management
- Input Validation
- SQL Injection
- XSS
- CSRF
- REST/API Security
- File Upload Security
- Logging
- Secrets Management
- Password Storage (ileride password auth eklenirse)
- Content Security Policy

Bir güvenlik kararı verirken kişisel varsayım yerine mümkün olduğunca OWASP rehberindeki güncel yaklaşımı esas al.

---

# 8. OWASP ASVS

Repository:

https://github.com/OWASP/ASVS

### Kullanım amacı

ASVS, geliştirme tamamlandıktan sonra değil, geliştirme sırasında da **security checklist** olarak kullanılmalıdır.

Özellikle kontrol et:

- Authentication doğru mu?
- Session güvenli mi?
- Authorization bütün backend endpointlerinde uygulanıyor mu?
- ID değiştirerek başka kullanıcının/veri sahibinin kaydına erişmek mümkün mü?
- Input validation var mı?
- Hassas veriler loglara düşüyor mu?
- Secret'lar repository'de bulunuyor mu?
- Error mesajları gereksiz iç bilgi sızdırıyor mu?
- Dosya yükleme varsa güvenli mi?
- Yetkisiz kullanıcı kritik aksiyon çağırabiliyor mu?

Önemli geliştirme aşamalarından sonra ASVS tabanlı kısa security review yap.

---

# 9. Akaunting ve Invoice Ninja

Akaunting:

https://github.com/akaunting/akaunting

Invoice Ninja:

https://github.com/invoiceninja/invoiceninja

### Kullanım amacı

Bunları ana framework olarak projeye entegre etme.

Bunları yalnızca gerçek dünyadaki muhasebe/fatura uygulamalarının:

- veri modeli
- modül sınırları
- invoice lifecycle
- payment ilişkileri
- customer/vendor ilişkileri
- expense yönetimi
- raporlama yapısı
- numbering yaklaşımı
- status/state mantığı

gibi konularını anlamak için **mimari ve ürün referansı** olarak incele.

### Lisans kuralı

Bu projelerden kaynak kodu doğrudan kopyalamadan önce lisans uyumluluğunu mutlaka kontrol et.

Varsayılan davranış:

**Mantığı incele → kendi mimarimize uygun şekilde yeniden tasarla → kodu körü körüne kopyalama.**

---

# 10. React-admin

Repository:

https://github.com/marmelab/react-admin

Bu projede **varsayılan olarak kullanılmayacaktır**.

Sebep:

- Refine ile önemli ölçüde aynı problem alanına girer.
- Aynı projede iki admin/CRUD framework'ü gereksiz karmaşıklık oluşturabilir.
- Claude Design ile belirlenmiş özel UI korunacaktır.

Ancak belirli bir teknik sorun için yalnızca fikir/referans olarak incelenebilir.

---

# 11. Claude Design Dashboard Kuralı

Projede daha önce kaydedilmiş onaylı dashboard referansı varsa önce onu bul ve oku.

Önerilen konum:

```text
/design-reference/accounting-dashboard/
```

Bu tasarım uygulamanın görsel source of truth'udur.

Şunları gereksiz yere değiştirme:

- Sidebar yapısı
- Layout
- Typography
- Spacing
- Renkler
- Light Mode
- Dark Mode
- Kartlar
- Tablolar
- Grafikler
- İkon dili
- Genel tasarım sistemi

Refine veya başka bir framework'ün default görünümünü kullanarak bu tasarımı değiştirme.

Framework tasarıma uyacak; tasarım framework'e uydurulmayacak.

---

# 12. Güvenlik Kuralları

## Secrets

Gerçek secret'ları repository'ye commit etme.

Örneğin:

```text
.env
```

Git'e gitmemelidir.

`.gitignore` içinde bulunmalıdır.

Repository'de sadece örnek:

```text
.env.example
```

tutulabilir.

Örneğin:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DATABASE_URL=
AUTH_SECRET=
```

Gerçek değer koyma.

---

## Authorization

Her korunan işlem backend'de doğrulanmalıdır.

Asla:

```text
if (user.role === "manager")
```

kontrolünü sadece React içinde yapıp güvenli kabul etme.

Frontend UX içindir.

Backend security boundary'dir.

---

## Input validation

Backend bütün harici girdileri doğrulamalıdır:

- query parametreleri
- route parametreleri
- form payload'ları
- IDs
- tarih
- para değerleri
- vergi oranları
- dosya yüklemeleri

Frontend validation tek başına yeterli değildir.

---

## Financial calculations

Para hesaplarında JavaScript floating-point davranışına körü körüne güvenme.

Örneğin mümkün olduğunda parasal tutarları:

```text
12345 kuruş
```

gibi integer minor-unit mantığıyla veya güvenli decimal yaklaşımıyla modellemeyi değerlendir.

Vergi, toplam, iskonto ve yuvarlama kuralları merkezi business logic içinde tutulmalıdır.

---

# 13. Silme / Çöp Kutusu

Muhasebe kayıtları için varsayılan olarak hard delete kullanma.

Dashboard tasarımında çöp kutusu bulunduğundan soft delete yaklaşımını tercih et.

Örneğin:

```text
deletedAt
deletedBy
```

alanları kullanılabilir.

Akış:

```text
Aktif kayıt
   ↓
Çöp Kutusuna Taşı
   ↓
Soft Delete
   ↓
Çöp Kutusu
   ├── Geri Yükle
   └── Kalıcı Sil
```

Kalıcı silme ayrı permission gerektirmelidir ve mümkünse daha sıkı korunmalıdır.

---

# 14. Audit Log

Finansal uygulamada kritik değişiklikleri izlenebilir hale getir.

Örnek:

```text
AuditLog

id
userId
action
entityType
entityId
oldValue
newValue
createdAt
```

Önemli aksiyonlar:

- Fatura oluşturma
- Fatura güncelleme
- Çöp kutusuna taşıma
- Geri yükleme
- Kalıcı silme
- Ödeme oluşturma
- Gider değiştirme
- Kullanıcı rolü değiştirme
- Yetki değiştirme
- Kritik ayar değişiklikleri

Audit log normal kullanıcı tarafından değiştirilebilir olmamalıdır.

---

# 15. Localhost Güvenliği

Uygulamanın localhost'ta çalışması onu otomatik olarak güvenli yapmaz.

Varsayılan geliştirme / tek bilgisayar kullanımında servisleri mümkün olduğunca yalnızca loopback interface'e bind et:

```text
127.0.0.1
```

Gereksiz yere:

```text
0.0.0.0
```

üzerinden bütün yerel ağa açma.

Eğer ileride LAN üzerinden başka bilgisayarlar bağlanacaksa yeni threat model oluştur ve güvenlik mimarisini yeniden değerlendir.

Google OAuth kullanıldığı için authentication işlemleri için internet bağlantısı gerekebilir; "localhost uygulaması" ile "tamamen offline uygulama" aynı şey değildir.

---

# 16. Önerilen Uygulama Akışı

Kodlamaya başlamadan önce:

```text
1. Mevcut project structure'ı incele.
2. CLAUDE.md ve mevcut proje talimatlarını oku.
3. Onaylı Claude Design dashboard referansını oku.
4. Mevcut teknoloji stack'ini tespit et.
5. Gereksiz framework/dependency ekleme.
6. Kısa bir implementation plan oluştur.
7. Auth + User + Role + Permission mimarisini kur.
8. Prisma schema'yı oluştur.
9. Backend authorization katmanını kur.
10. Muhasebe modüllerini feature-by-feature geliştir.
11. UI'ı Claude Design'a sadık kalarak bağla.
12. Audit log ve soft-delete davranışlarını uygula.
13. Testleri yaz.
14. OWASP Cheat Sheets'e göre security review yap.
15. OWASP ASVS'e göre kontrol yap.
```

---

# 17. Dependency Kuralı

Bir repository bu dosyada listelenmiş diye otomatik olarak:

- clone etme,
- dependency olarak yükleme,
- kodunu kopyalama.

Önce hangi kategoride olduğunu belirle:

| Kaynak | Kullanım Şekli |
|---|---|
| Bulletproof React | Mimari referans |
| Refine | Uygun yerlerde gerçek framework/core |
| Better Auth | Authentication/authorization altyapısı |
| Prisma | Gerçek database erişim katmanı |
| SQLite | Başlangıç database'i |
| OWASP CheatSheetSeries | Security rehberi |
| OWASP ASVS | Security checklist |
| Akaunting | Muhasebe mimarisi referansı |
| Invoice Ninja | Muhasebe/faturalama referansı |
| React-admin | Varsayılan olarak kullanma; gerektiğinde fikir |

---

# 18. Claude Code İçin Kalıcı Çalışma Prensibi

Bu projede bir karar verirken öncelik sırası:

```text
1. Kullanıcının açık talebi
2. Projedeki CLAUDE.md kuralları
3. Onaylı Claude Design tasarımı
4. Bu teknik rehber
5. Mevcut proje mimarisi ve kod kalitesi
6. Resmi framework/library dokümantasyonu
7. OWASP güvenlik rehberleri
8. Referans açık kaynak projeler
```

Herhangi bir referans repo mevcut proje gereksinimiyle çatışıyorsa repoyu körü körüne takip etme.

Ama belirlenen güvenlik sınırlarını, authorization kontrollerini ve onaylı tasarımı kullanıcı açıkça istemedikçe gevşetme.

---

# 19. İlk Geliştirme Öncesi Claude Code Görevi

Bu dosyayı ilk kez okuduğunda hemen bütün muhasebe uygulamasını kodlamaya başlama.

Önce:

```text
- Mevcut projeyi analiz et.
- Dashboard design reference'ı bul.
- Mevcut CLAUDE.md dosyasını oku.
- Kullanılacak kesin stack'i çıkar.
- Hangi listedeki kaynakların gerçek dependency, hangilerinin yalnızca reference olacağını belirt.
- Auth / Role / Permission mimarisini çıkar.
- Database entity taslağını çıkar.
- Security boundaries'i belirt.
- Uygulama geliştirme sırasını öner.
```

Ardından kullanıcı onayı veya mevcut görev doğrultusunda implementasyona geç.


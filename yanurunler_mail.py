# Yan Urunler Stok Takip - mail hesabi ve rapor postasi (31.08.2026)
#
# NEDEN VAR (kullanici bildirimi, 31.08.2026): Yonetim Paneli > Mail Hesabi
# ekrani "Sunucuya ulasilamiyor. Mail hesabi yonetimi yalniz .NET sunucusu
# uzerinden calisir." diyordu. Sebep: /api/mail/* uclari yalnizca
# yan-urunler-stok-takip/sunucu (ASP.NET Core) icinde vardi; gunluk kullanimda
# calisan sunucu ise bu klasordeki yan-urunler-sunucu.py idi ve o uclari
# bilmiyordu. Ekran dogru davraniyordu, arka uc eksikti.
#
# BU DOSYA O BOSLUGU DOLDURUR. Sozlesme .NET tarafiyla BIREBIR AYNIDIR:
#   GET    /api/mail/durum            -> {hazir, hesap, yazdirmaMotoru, pencere}
#   GET    /api/mail/hesap/tahmin     -> {sunucu, port, uyari}
#   POST   /api/mail/hesap            -> {hesap} | {hata}
#   DELETE /api/mail/hesap            -> {silindi}
#   POST   /api/mail/hesap/sina       -> {calisiyor, hata}
#   POST   /api/mail                  -> {gonderildi, basarisiz, sonuclar, ...}
# Ekran kodu (js/35-mail-gonder.js, js/37-mail-hesabi.js) DEGISMEDI ve
# degismemeli: iki sunucu ayni sozu vermeli.
#
# DOSYA BICIMI de aynidir: mail-hesaplari.json, {"_ortak": {Adres, Sunucu,
# Port, Ssl, ParolaSifreli}}. Parola Windows DPAPI (CurrentUser) ile
# sifrelenir - .NET'teki ProtectedData.Protect ile ayni cagri, ayni kapsam,
# entropy yok. Yani iki sunucu ayni dosyayi okuyabilir; hesap bir kez girilir.
#
# WINDOWS DISI: DPAPI yoktur. O durumda hesap KAYDEDILMEZ ve sebebi yazilir.
# Duz metin parola diske yazmak, guvenlik yokken var sanmaktan kotudur -
# .NET tarafi da ayni karari veriyor (MailHesabi.cs Sifrele).
import base64
import ctypes
import imaplib
import json
import os
import re
import smtplib
import socket
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from ctypes import wintypes
from email.message import EmailMessage
from email.utils import formataddr

KOK = os.path.dirname(os.path.abspath(__file__))
HESAP_DOSYASI = os.path.join(KOK, "mail-hesaplari.json")
ORTAK = "_ortak"          # tek master hesap anahtari (.NET: MailHesabi.Anahtar)
GONDEREN_AD = "Yan Ürünler Stok Takip"

_kilit = threading.Lock()


# ---------------------------------------------------------------------------
# Saglayiciya gore sunucu tahmini - MailHesabi.cs'teki listenin aynisi.
# Kullanici SMTP sunucu adini ezberlemek zorunda kalmasin diye adresin alan
# adindan tanilir; taninmayan alanda "smtp." oneki denenir.
# ---------------------------------------------------------------------------
BILINEN = {
    "gmail.com": ("smtp.gmail.com", 587),
    "googlemail.com": ("smtp.gmail.com", 587),
    "yandex.com": ("smtp.yandex.com", 587),
    "yandex.com.tr": ("smtp.yandex.com", 587),
    "yaani.com": ("smtp.yaani.com", 587),
    "yahoo.com": ("smtp.mail.yahoo.com", 587),
}

# SMTP'yi PAROLAYLA kabul etmeyen saglayicilar. Microsoft, Outlook.com kisisel
# hesaplarinda SMTP icin parola ve uygulama parolasini kaldirdi; yalniz OAuth
# kabul ediyor. Kullanici burada bosuna ugrasmasin diye giris DENENMEDEN
# soylenir (.NET tarafiyla ayni liste).
DESTEKLENMEYEN = {
    "outlook.com", "hotmail.com", "hotmail.com.tr",
    "live.com", "msn.com", "outlook.com.tr",
}

EPOSTA_KALIP = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


def alan_adi(adres):
    a = (adres or "").strip()
    i = a.rfind("@")
    return a[i + 1:].strip().lower() if 0 < i < len(a) - 1 else None


def sunucu_tahmini(adres):
    alan = alan_adi(adres)
    if not alan:
        return "", 587
    return BILINEN.get(alan, ("smtp." + alan, 587))


def desteklenmeyen_mi(adres):
    alan = alan_adi(adres)
    if alan and alan in DESTEKLENMEYEN:
        return (alan + " adresleri programdan gönderim için parola kabul etmiyor "
                "(Microsoft yalnız OAuth'a izin veriyor). Gmail, kurumsal adresiniz "
                "ya da başka bir sağlayıcı kullanın.")
    return None


# ---------------------------------------------------------------------------
# ALICI ON KONTROLU - alan adi posta alabiliyor mu?
#
# NEDEN (kullanici bildirimi, 31.08.2026): olmayan bir adrese gonderilen posta
# ekranda "Gonderildi" isaretlendi. SMTP'nin dogasi bu - sunucu iletiyi ALIR,
# teslimi sonra dener; teslimsizlik dakikalar sonra AYRI BIR postayla gelir.
#
# .NET sunucusunda bu iki kapi 28.08.2026'dan beri VARDI (Postaci.GonderTekTek
# bicim denetimi + AlanKontrol.cs alan denetimi); Python sunucusuna 31.08.2026
# eklendi. Eksik olan taraf buydu.
#
# SINIR - kaldirilamaz: bu kontrol yalniz ALAN ADINI dogrular. Alan dogru ama
# KUTU yoksa (yanlis yazilmis kullanici adi @hotmail.com gibi) hicbir gonderim
# oncesi kontrol bunu bilemez; yalniz teslimsizlik postasi soyler.
#
# KURAL: emin degilsek ENGELLEMEYIZ. DNS'e ulasilamazsa, zaman asarsa ya da
# yanit anlasilmazsa None doner ve posta normal gonderilir. Yanlis pozitif,
# gonderilmeyen posta demektir; bu kontrol onu goze almaz.
# ---------------------------------------------------------------------------
DNS_MX, DNS_A = 15, 1
_alan_bellek = {}          # alan -> (zaman, sonuc)
_ALAN_OMRU = 600           # saniye - ayni listeye arka arkaya gonderim DNS'i yormasin


def adres_gecerli_mi(adres):
    """Bicim denetimi. RFC'nin tamamini uygulamaz; bariz bozuk adresi eler."""
    a = (adres or "").strip()
    return bool(EPOSTA_KALIP.match(a)) and len(a) <= 254 and ".." not in a


def _dns_sunucusu():
    """Makinenin KENDI DNS sunucusu (Windows kayit defterinden); yoksa None.

    Ucuncu taraf bir cozucuye (8.8.8.8 gibi) SORULMAZ: alici alan adlari
    fabrika agindan disari sizmasin."""
    if sys.platform != "win32":
        return None
    try:
        import winreg
        yol = r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces"
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, yol) as kok:
            i = 0
            while True:
                try:
                    ad = winreg.EnumKey(kok, i)
                except OSError:
                    break
                i += 1
                try:
                    with winreg.OpenKey(kok, ad) as alt:
                        for anahtar in ("NameServer", "DhcpNameServer"):
                            try:
                                deger = winreg.QueryValueEx(alt, anahtar)[0]
                            except OSError:
                                continue
                            for ip in re.split(r"[\s,]+", str(deger).strip()):
                                if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", ip):
                                    return ip
                except OSError:
                    continue
    except Exception:
        return None
    return None


def _ad_atla(p, i):
    while i < len(p):
        u = p[i]
        if u == 0:
            return i + 1
        if u & 0xC0 == 0xC0:
            return i + 2
        i += u + 1
    return i


def _ad_oku(p, i):
    parcalar, koruma = [], 0
    while i < len(p) and koruma < 128:
        koruma += 1
        u = p[i]
        if u == 0:
            break
        if u & 0xC0 == 0xC0:
            i = ((u & 0x3F) << 8) | p[i + 1]
            continue
        if i + 1 + u > len(p):
            break
        parcalar.append(p[i + 1:i + 1 + u].decode("ascii", "replace"))
        i += u + 1
    return ".".join(parcalar)


def _dns_sor(dns, alan, tur):
    """Tek UDP DNS sorusu -> (rcode, kayitlar); anlasilmazsa None.

    Ek kutuphane YOK: socket MX soramaz, paket elle kurulur. .NET tarafindaki
    AlanKontrol.Sor ile ayni mantik."""
    try:
        istek = bytearray([0x7A, 0x59, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0])
        for parca in alan.split("."):
            b = parca.encode("ascii")
            if not b or len(b) > 63:
                return None
            istek.append(len(b))
            istek += b
        istek.append(0)
        istek += bytes([tur >> 8, tur & 0xFF, 0, 1])

        soket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        soket.settimeout(2.5)
        try:
            soket.sendto(bytes(istek), (dns, 53))
            yanit = soket.recv(2048)
        finally:
            soket.close()
        if len(yanit) < 12:
            return None

        rcode = yanit[3] & 0x0F
        qd = (yanit[4] << 8) | yanit[5]
        an = (yanit[6] << 8) | yanit[7]
        p = 12
        for _ in range(qd):
            p = _ad_atla(yanit, p) + 4

        kayitlar = []
        for _ in range(an):
            if p >= len(yanit):
                break
            p = _ad_atla(yanit, p)
            if p + 10 > len(yanit):
                break
            t = (yanit[p] << 8) | yanit[p + 1]
            uzunluk = (yanit[p + 8] << 8) | yanit[p + 9]
            p += 10
            if p + uzunluk > len(yanit):
                break
            if t == DNS_MX and uzunluk >= 3:
                kayitlar.append(_ad_oku(yanit, p + 2))
            elif t == DNS_A and uzunluk == 4:
                kayitlar.append("A")
            p += uzunluk
        return rcode, kayitlar
    except Exception:
        return None


def _alan_olc(alan):
    dns = _dns_sunucusu()
    if dns is None:
        return None                                   # DNS bilinmiyor -> karisma
    mx = _dns_sor(dns, alan, DNS_MX)
    if mx is None:
        return None                                   # ulasilamadi -> karisma
    rcode, kayitlar = mx
    if rcode == 3:
        return "Alan bulunamadı: " + alan             # NXDOMAIN
    if rcode != 0:
        return None
    if kayitlar:
        # RFC 7505: tek kayit ve hedefi kok ("") ise alan posta kabul etmiyor.
        if len(kayitlar) == 1 and kayitlar[0] == "":
            return alan + " alanı posta kabul etmiyor"
        return None
    a = _dns_sor(dns, alan, DNS_A)                    # MX yoksa A kaydi posta sunucusu sayilir
    if a is None:
        return None
    rcode, kayitlar = a
    if rcode == 3:
        return "Alan bulunamadı: " + alan
    if rcode == 0 and not kayitlar:
        return alan + " alanının posta sunucusu tanımlı değil"
    return None


def alan_sorunu(adres):
    """Alan adi posta alabiliyorsa None; kesin almiyorsa sebebi Turkce doner."""
    alan = alan_adi(adres)
    if not alan or "." not in alan:
        return None                                   # bicim hatasini cagiran yakalar
    kayit = _alan_bellek.get(alan)
    simdi = time.monotonic()
    if kayit and simdi - kayit[0] < _ALAN_OMRU:
        return kayit[1]
    sonuc = _alan_olc(alan)
    _alan_bellek[alan] = (simdi, sonuc)
    return sonuc


# ---------------------------------------------------------------------------
# DPAPI - parola sifreleme (yalniz Windows)
#
# CryptProtectData / CryptUnprotectData, CurrentUser kapsaminda calisir:
# sifreli metin YALNIZ bu Windows kullanicisinda ve bu makinede cozulur.
# Dosya baska bilgisayara kopyalansa parola okunamaz.
# ---------------------------------------------------------------------------
class _BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def _blob(veri):
    tampon = ctypes.create_string_buffer(veri, len(veri))
    return _BLOB(len(veri), ctypes.cast(tampon, ctypes.POINTER(ctypes.c_char))), tampon


def dpapi_var_mi():
    return sys.platform == "win32"


def _blob_al(cikti):
    boy = int(cikti.cbData)
    veri = ctypes.string_at(cikti.pbData, boy)
    ctypes.windll.kernel32.LocalFree(cikti.pbData)
    return veri


def sifrele(metin):
    """Duz parola -> base64 DPAPI blob. Windows disinda RuntimeError."""
    if not dpapi_var_mi():
        raise RuntimeError("Parola şifrelemesi yalnız Windows'ta desteklenir; "
                           "hesap kaydedilmedi.")
    giris, _tut = _blob(metin.encode("utf-8"))
    cikti = _BLOB()
    # CRYPTPROTECT_UI_FORBIDDEN (0x1): servis/arka plan surecinde pencere acilmaz.
    ok = ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(giris), None, None, None, None, 0x1, ctypes.byref(cikti))
    if not ok:
        raise RuntimeError("Parola şifrelenemedi (DPAPI hatası).")
    return base64.b64encode(_blob_al(cikti)).decode("ascii")


def coz(sifreli):
    """base64 DPAPI blob -> duz parola. Cozulemezse None."""
    if not dpapi_var_mi():
        return None
    try:
        giris, _tut = _blob(base64.b64decode(sifreli))
    except Exception:
        return None
    cikti = _BLOB()
    ok = ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(giris), None, None, None, None, 0x1, ctypes.byref(cikti))
    if not ok:
        # Dosya baska makineden/kullanicidan geldiyse buraya duser: hesap
        # yeniden girilmelidir, sessizce yanlis parolayla denenmez.
        return None
    try:
        return _blob_al(cikti).decode("utf-8")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Saklama
# ---------------------------------------------------------------------------
def _oku():
    with _kilit:
        if not os.path.isfile(HESAP_DOSYASI):
            return {}
        try:
            with open(HESAP_DOSYASI, encoding="utf-8") as f:
                veri = json.load(f)
            return veri if isinstance(veri, dict) else {}
        except Exception:
            return {}


def _yaz(hepsi):
    with _kilit:
        gecici = HESAP_DOSYASI + ".tmp"
        with open(gecici, "w", encoding="utf-8", newline="\n") as f:
            json.dump(hepsi, f, ensure_ascii=False, indent=2)
        os.replace(gecici, HESAP_DOSYASI)   # atomik: yarim dosya kalamaz


def ozet():
    """Ekrana donen guvenli kunye - parola ASLA donmez."""
    k = _oku().get(ORTAK)
    if not k:
        return None
    return {
        "adres": k.get("Adres", ""),
        "sunucu": k.get("Sunucu", ""),
        "port": k.get("Port", 587),
        "ssl": bool(k.get("Ssl", True)),
    }


def kimlik():
    """Gonderim icin tam bilgi (parola cozulmus). Cozulemezse None."""
    k = _oku().get(ORTAK)
    if not k:
        return None
    p = coz(k.get("ParolaSifreli", ""))
    if p is None:
        return None
    return {
        "adres": k.get("Adres", ""),
        "sunucu": k.get("Sunucu", ""),
        "port": int(k.get("Port", 587) or 587),
        "ssl": bool(k.get("Ssl", True)),
        "parola": p,
    }


def kaydet(adres, sunucu, port, ssl, parola):
    hepsi = _oku()
    hepsi[ORTAK] = {
        "Adres": adres,
        "Sunucu": sunucu,
        "Port": int(port),
        "Ssl": bool(ssl),
        "ParolaSifreli": sifrele(parola),
    }
    _yaz(hepsi)


def sil():
    hepsi = _oku()
    if ORTAK not in hepsi:
        return False
    del hepsi[ORTAK]
    _yaz(hepsi)
    return True


# ---------------------------------------------------------------------------
# SMTP
# ---------------------------------------------------------------------------
def _baglan(sunucu, port, ssl, adres, parola, zaman_asimi=20):
    """Baglanir, TLS kurar, giris yapar. Cagiran quit() etmekle yukumludur."""
    port = int(port or 587)
    if port == 465:
        b = smtplib.SMTP_SSL(sunucu, port, timeout=zaman_asimi)
    else:
        b = smtplib.SMTP(sunucu, port, timeout=zaman_asimi)
        b.ehlo()
        if ssl:
            b.starttls()
            b.ehlo()
    b.login(adres, parola)
    return b


def _hata_metni(e):
    """SMTP istisnasini kullanicinin duzeltebilecegi bir cumleye cevirir."""
    if isinstance(e, smtplib.SMTPAuthenticationError):
        return ("Adres ya da uygulama parolası kabul edilmedi. Sağlayıcının "
                "ürettiği uygulama parolasını kullandığınızdan emin olun.")
    if isinstance(e, smtplib.SMTPNotSupportedError):
        return "Sunucu bu bağlantı biçimini desteklemiyor: " + str(e)
    if isinstance(e, smtplib.SMTPConnectError):
        return "SMTP sunucusuna bağlanılamadı: " + str(e)
    if isinstance(e, smtplib.SMTPServerDisconnected):
        return "Sunucu bağlantıyı kesti. Sunucu adı ve portu doğru mu?"
    if isinstance(e, smtplib.SMTPRecipientsRefused):
        return "Alıcı adresi sunucu tarafından reddedildi."
    if isinstance(e, smtplib.SMTPException):
        return str(e) or e.__class__.__name__
    if isinstance(e, (TimeoutError, OSError)):
        return ("Sunucuya ulaşılamadı (" + str(e) + "). Sunucu adı, port ve "
                "ağ bağlantısını kontrol edin.")
    return str(e) or e.__class__.__name__


def smtp_dene(sunucu, port, ssl, adres, parola):
    """Sadece baglanti + giris sinar. Basarili ise None, degilse hata metni."""
    if not sunucu:
        return "SMTP sunucusu boş olamaz."
    b = None
    try:
        b = _baglan(sunucu, port, ssl, adres, parola)
        return None
    except Exception as e:
        return _hata_metni(e)
    finally:
        if b is not None:
            try:
                b.quit()
            except Exception:
                pass


def _ileti(kim, alici, konu, metin, ek_ad=None, ek_bayt=None):
    m = EmailMessage()
    m["From"] = formataddr((GONDEREN_AD, kim["adres"]))
    m["To"] = alici
    m["Subject"] = konu
    m.set_content(metin or "")
    if ek_bayt:
        m.add_attachment(ek_bayt, maintype="application", subtype="pdf",
                         filename=ek_ad or "rapor.pdf")
    return m


def sina():
    """KAYITLI parolayla gercek bir test postasi gonderir (kendine)."""
    kim = kimlik()
    if kim is None:
        return {"calisiyor": False, "hata": "Mail hesabı tanımlı değil."}
    b = None
    try:
        b = _baglan(kim["sunucu"], kim["port"], kim["ssl"], kim["adres"], kim["parola"])
        b.send_message(_ileti(kim, kim["adres"],
                              "Yan Ürünler Stok Takip — bağlantı sınaması",
                              "Bu ileti bağlantı sınamasıdır. Gördüyseniz rapor "
                              "postası çalışıyor demektir."))
        return {"calisiyor": True, "hata": None}
    except Exception as e:
        return {"calisiyor": False, "hata": _hata_metni(e)}
    finally:
        if b is not None:
            try:
                b.quit()
            except Exception:
                pass


def gonder_tek_tek(alicilar, konu, mesaj, ek_ad, ek_bayt):
    """ALICI BASINA sonuc dondurur: [{adres, tamam, hata}].

    Neden tek tek: ekran gonderim sonrasi kimin aldigini, kimin neden
    almadigini satir satir yaziyor (js/35-mail-gonder.js sonucPenceresi).
    Toplu tek cagri yapilsa bir adres yuzunden hepsi basarisiz gorunurdu.
    Baglanti BIR KEZ acilir; her alici ayri send_message ile gider."""
    kim = kimlik()
    if kim is None:
        return None, "Posta hesabı yok: önce mail ile giriş yapın."

    sonuclar = []
    b = None
    try:
        b = _baglan(kim["sunucu"], kim["port"], kim["ssl"], kim["adres"], kim["parola"], 60)
    except Exception as e:
        hata = _hata_metni(e)
        for a in alicilar:
            sonuclar.append({"adres": a, "tamam": False, "hata": hata})
        return sonuclar, None

    try:
        for a in alicilar:
            # ON KONTROL (31.08.2026): bicimi bozuk ya da alan adi posta almayan
            # adrese gonderim DENENMEZ; sebep SIMDI yazilir, dakikalar sonra
            # teslimsizlik postasiyla degil.
            if not adres_gecerli_mi(a):
                sonuclar.append({"adres": a, "tamam": False, "hata": "Adres biçimi geçersiz."})
                continue
            engel = alan_sorunu(a)
            if engel:
                sonuclar.append({"adres": a, "tamam": False, "hata": engel})
                continue
            try:
                b.send_message(_ileti(kim, a, konu, mesaj, ek_ad, ek_bayt))
                sonuclar.append({"adres": a, "tamam": True, "hata": None})
            except Exception as e:
                sonuclar.append({"adres": a, "tamam": False, "hata": _hata_metni(e)})
    finally:
        try:
            b.quit()
        except Exception:
            pass
    return sonuclar, None


# ---------------------------------------------------------------------------
# TESLIMSIZLIK (bounce) OKUMA - "gonderildi" ile "ulasti" ayni sey degil
#
# NEDEN (kullanici direktifi, 31.08.2026): olmayan bir kutuya gonderilen posta
# ekranda "Gonderildi" kaliyordu; teslimsizlik bildirimi yalniz kullanicinin
# gelen kutusuna dusuyordu. Kullanici: "gonderilemeyen olursa tum ekrana orta
# panel gelsin, bu maile gonderilemedi diye."
#
# NEDEN BASKA YOL YOK - olculdu (31.08.2026):
#   * Alan adi kontrolu (alan_sorunu) yalniz ALANI dogrular; hotmail.com
#     gercek bir alan, sorun kutuda.
#   * Alicinin kendi MX sunucusuna RCPT sorusu: bu agdan 25. port disari
#     KAPALI - hem outlook hem gmail MX'ine zaman asimi. Soramiyoruz.
# Geriye tek yol kaldi: teslimsizlik postasini gelen kutusundan okumak.
#
# KAPSAM DAR TUTULUR - kullanicinin postasi taranmaz:
#   * yalniz INBOX, yalniz OKUMA (readonly), hicbir ileti isaretlenmez,
#   * yalniz mailer-daemon / postmaster'dan gelen, yalniz BUGUNDEN itibaren,
#   * yalniz SORULAN alicilara ait satirlar dondurulur.
#
# KALICI / GECICI AYRIMI: Status 5.x.x kalici basarisizliktir (kutu yok).
# 4.x.x geciciddir (sunucu mesgul, sonra denenecek) - onu basarisiz saymayiz,
# yoksa gecikmis ama sonunda ulasan postalar yanlislikla "gonderilemedi"
# gorunurdu.
# ---------------------------------------------------------------------------
IMAP_BILINEN = {
    "gmail.com": "imap.gmail.com",
    "googlemail.com": "imap.gmail.com",
    "yandex.com": "imap.yandex.com",
    "yandex.com.tr": "imap.yandex.com",
    "yaani.com": "imap.yaani.com",
    "yahoo.com": "imap.mail.yahoo.com",
}

_AY = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

_teslim_bellek = {"zaman": 0.0, "kayitlar": []}
_TESLIM_OMRU = 8          # saniye - ekran 15 sn'de bir soruyor, IMAP her seferinde acilmasin


def imap_sunucusu(adres):
    alan = alan_adi(adres)
    if not alan:
        return None
    return IMAP_BILINEN.get(alan, "imap." + alan)


def _imap_tarihi(gun_iso):
    """'2026-08-31' -> '31-Aug-2026' (IMAP SINCE bicimi)."""
    try:
        y, a, g = gun_iso.split("-")
        return "%02d-%s-%s" % (int(g), _AY[int(a) - 1], y)
    except Exception:
        return None


def _dsn_coz(ham):
    """Teslimsizlik iletisinden (adres, sebep) ciftleri cikarir."""
    alicilar = re.findall(r"(?im)^(?:Final|Original)-Recipient:\s*rfc822;\s*(\S+)", ham)
    durumlar = re.findall(r"(?im)^Status:\s*(\d\.\d+\.\d+)", ham)
    tanilar = re.findall(r"(?im)^Diagnostic-Code:\s*(.+)$", ham)
    cikti = []
    for i, adres in enumerate(alicilar):
        durum = durumlar[i] if i < len(durumlar) else (durumlar[0] if durumlar else "")
        if not durum.startswith("5"):
            continue                     # 4.x.x gecici - basarisiz sayilmaz
        tani = tanilar[i] if i < len(tanilar) else (tanilar[0] if tanilar else "")
        cikti.append((adres.strip().strip("<>"), _sebep_kisalt(tani, durum)))
    return cikti


def _sebep_kisalt(tani, durum):
    """Sunucunun ham yanitini tek satirlik Turkce sebebe indirir."""
    t = (tani or "").strip()
    dusuk = t.lower()
    if "mailbox unavailable" in dusuk or "no such user" in dusuk or \
       "does not exist" in dusuk or "user unknown" in dusuk or "5.1.1" in durum:
        return "Böyle bir e-posta adresi yok."
    if "quota" in dusuk or "over quota" in dusuk or "full" in dusuk:
        return "Alıcının posta kutusu dolu."
    if "blocked" in dusuk or "spam" in dusuk or "policy" in dusuk:
        return "Alıcının sunucusu iletiyi reddetti (engelleme / kural)."
    if t:
        # Ham yanit dursun ama satiri sismesin.
        return "Alıcının sunucusu reddetti: " + t[:160]
    return "Teslim edilemedi (" + durum + ")."


def teslimsizler(alicilar, gun_iso):
    """Sorulan alicilardan hangileri teslim EDILEMEDI? [{adres, sebep}]

    Hicbir sey bulunamazsa bos liste. Baglanti kurulamazsa da bos liste -
    emin degilsek "gonderilemedi" DEMEYIZ (yanlis alarm, gercek hatadan kotu)."""
    aranan = {}
    for a in alicilar or []:
        d = (a or "").strip().lower()
        if d:
            aranan[d] = a
    if not aranan:
        return []

    kim = kimlik()
    if kim is None:
        return []
    sunucu = imap_sunucusu(kim["adres"])
    tarih = _imap_tarihi(gun_iso or "")
    if not sunucu or not tarih:
        return []

    simdi = time.monotonic()
    if simdi - _teslim_bellek["zaman"] < _TESLIM_OMRU:
        kayitlar = _teslim_bellek["kayitlar"]
    else:
        kayitlar = _dsn_tara(sunucu, kim, tarih)
        if kayitlar is None:
            return []                     # ulasilamadi -> karisma
        _teslim_bellek["zaman"] = simdi
        _teslim_bellek["kayitlar"] = kayitlar

    cikti, gorulen = [], set()
    for adres, sebep in kayitlar:
        d = adres.strip().lower()
        if d in aranan and d not in gorulen:
            gorulen.add(d)
            cikti.append({"adres": aranan[d], "sebep": sebep})
    return cikti


def _tum_postalar_kutusu(im):
    """Saglayicinin "Tum Postalar" kutusunu bayragindan bulur (RFC 6154 \\All).

    Neden gerekli (olculdu, 31.08.2026): kullanici teslimsizlik bildirimini
    gelen kutusundan arsivlerse INBOX aramasi onu bulamaz. Kutu ADI dile gore
    degisir ("[Gmail]/Tum Postalar"), bu yuzden ada degil BAYRAGA bakilir.
    Bulunamazsa None - o zaman yalniz INBOX taranir."""
    try:
        tip, kutular = im.list()
        if tip != "OK":
            return None
        for ham in kutular or []:
            satir = ham.decode("utf-8", "replace") if isinstance(ham, (bytes, bytearray)) else str(ham)
            kapa = satir.find(")")
            if kapa < 0 or "\\All" not in satir[:kapa]:
                continue
            tirnak = satir.rfind(' "')
            return satir[tirnak + 1:].strip() if tirnak > 0 else None
    except Exception:
        return None
    return None


def _dsn_tara(sunucu, kim, tarih):
    """Teslimsizlik iletilerini okur. Hata olursa None (karisma)."""
    im = None
    try:
        im = imaplib.IMAP4_SSL(sunucu, 993, timeout=15)
        im.login(kim["adres"], kim["parola"])

        kutular = ["INBOX"]
        tum = _tum_postalar_kutusu(im)
        if tum and tum.strip('"').upper() != "INBOX":
            kutular.append(tum)

        kayitlar, gorulen = [], set()
        for kutu in kutular:
            tip, _ = im.select(kutu, readonly=True)   # readonly: okundu isareti konmaz
            if tip != "OK":
                continue
            tip, veri = im.search(
                None,
                '(SINCE %s (OR FROM "mailer-daemon" FROM "postmaster"))' % tarih)
            if tip != "OK" or not veri or not veri[0]:
                continue
            for kid in veri[0].split()[-25:]:        # en yeni 25 bildirim yeter
                tip, govde = im.fetch(kid, "(BODY.PEEK[])")   # PEEK: okundu yapmaz
                if tip != "OK" or not govde or not govde[0]:
                    continue
                ham = govde[0][1]
                if isinstance(ham, (bytes, bytearray)):
                    ham = ham.decode("utf-8", "replace")
                for adres, sebep in _dsn_coz(ham):
                    anahtar = adres.lower()
                    if anahtar in gorulen:           # iki kutuda ayni ileti
                        continue
                    gorulen.add(anahtar)
                    kayitlar.append((adres, sebep))
        return kayitlar
    except Exception:
        return None
    finally:
        if im is not None:
            try:
                im.logout()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# HTML -> PDF, tarayicinin KENDI yazdirma motoruyla
#
# Ekran, "Yazdir" ile bastigi HTML'in TA KENDISINI gonderiyor; ayni belge
# burada Edge/Chrome ile basilir. Sunucu tabloyu yeniden dizseydi yazi olcusu,
# kolon genisligi ve hizalar kacinilmaz olarak ayrisirdi. (.NET tarafinda ayni
# is HtmlPdf.cs'te yapiliyor - aday yollar da oradan alindi.)
# ---------------------------------------------------------------------------
TARAYICI_ADAYLARI = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]


def tarayici_yolu():
    for y in TARAYICI_ADAYLARI:
        if os.path.isfile(y):
            return y
    return None


def pdf_uret(html, zaman_asimi=45):
    """HTML -> PDF baytlari. Motor yoksa ya da is bitmezse None."""
    tarayici = tarayici_yolu()
    if not tarayici or not html:
        return None
    klasor = os.path.join(tempfile.gettempdir(), "yanurunler-pdf-" + uuid.uuid4().hex)
    os.makedirs(klasor, exist_ok=True)
    html_yolu = os.path.join(klasor, "rapor.html")
    pdf_yolu = os.path.join(klasor, "rapor.pdf")
    try:
        # BOM'lu UTF-8: tarayici dosyayi yerel kod sayfasiyla okumasin,
        # Turkce karakterler bozulmasin.
        with open(html_yolu, "w", encoding="utf-8-sig", newline="\n") as f:
            f.write(html)
        subprocess.run(
            [tarayici,
             "--headless=new",
             "--disable-gpu",
             "--no-sandbox",
             # Sunucu hesabinin tarayici profili olmayabilir; kendi gecici
             # profilini kullanir.
             "--user-data-dir=" + os.path.join(klasor, "profil"),
             # Tarayicinin kendi ustbilgisi (tarih/URL) kagida basilmaz.
             "--no-pdf-header-footer",
             "--print-to-pdf=" + pdf_yolu,
             "file:///" + html_yolu.replace("\\", "/")],
            timeout=zaman_asimi,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if not os.path.isfile(pdf_yolu):
            return None
        with open(pdf_yolu, "rb") as f:
            return f.read()
    except Exception:
        return None
    finally:
        try:
            import shutil
            shutil.rmtree(klasor, ignore_errors=True)
        except Exception:
            pass

# Yan Urunler Stok Takip - yerel sunucu (27.08.2026)
#
# `py -m http.server`in yerine gecer (GUNLUK-YEDEK-PLANI.md REVIZE):
#   1) yan-urunler-stok-takip/ klasorunu statik servis eder (eskisi gibi)
#   2) gunluk JSON yedeklerini TIKLAMASIZ diske yazar:
#        POST /api/gunluk-yedek            {"dosyalar":[{"ad","metin"},...]}
#        GET  /api/gunluk-yedek/saglik  -> {"durum","klasor","adet"}
#        GET  /api/gunluk-yedek/dosya?ad=_tam-paket.json -> dosya icerigi
#   3) mail hesabi ve rapor postasi (31.08.2026 - kullanici bildirimi):
#        GET    /api/mail/durum
#        GET    /api/mail/hesap/tahmin?adres=
#        POST   /api/mail/hesap        DELETE /api/mail/hesap
#        POST   /api/mail/hesap/sina
#        POST   /api/mail
#        GET    /api/mail/teslimsiz?alicilar=&gun=   (31.08.2026, .NET'te yok)
#      Uclar .NET sunucusundakiyle AYNI sozlesmeyi tutar; is
#      yanurunler_mail.py icinde. Eskiden bu uclar yoktu ve Yonetim Paneli >
#      Mail Hesabi ekrani "Sunucuya ulasilamiyor" diyordu.
#
# Yedek klasoru: bu dosyanin yanindaki gunluk-veriler\  (yoksa acilir).
# Dosya adi beyaz listesi yol kacagini (path traversal) keser.
# Yazma atomiktir: once .tmp, sonra os.replace - yarim dosya kalamaz.
import json
import os
import re
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import yanurunler_mail as mail

KOK = os.path.dirname(os.path.abspath(__file__))
STATIK = os.path.join(KOK, "yan-urunler-stok-takip")
YEDEK = os.path.join(KOK, "gunluk-veriler")

# ORTAK VERI PAKETI (31.08.2026): veri artik tarayicida degil sunucuda durur
# (js/06-uzak koprusu). Bu gelistirme sunucusunda paket tek JSON dosyasidir;
# .NET/IIS sunumunda ayni is SQLite'a yazilir (PaketDeposu). Surum sayaci
# iyimser kilit: istekteki surum tutmazsa 409 + guncel paket doner.
PAKET_DOSYASI = os.path.join(KOK, "veri-paket.json")
PORT = int(os.environ.get("PORT", "8155"))
EN_BUYUK_GOVDE = 50 * 1024 * 1024  # 50 MB - tam paket ~1 MB, bol pay

# Izinli dosya adlari: 27.08.2026.json / _tam-paket.json / _tanimlar.json
AD_DESENI = re.compile(r"^(\d{2}\.\d{2}\.\d{4}|_tam-paket|_tanimlar)\.json$")

kilit = threading.Lock()


def paket_oku():
    """{surum:int, paket:dict|None} dondurur; dosya yok/bozuksa surum 0."""
    try:
        with open(PAKET_DOSYASI, "r", encoding="utf-8") as f:
            d = json.load(f)
        return int(d.get("surum") or 0), d.get("paket")
    except Exception:
        return 0, None


def paket_yaz(surum, paket):
    gecici = PAKET_DOSYASI + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump({"surum": surum, "paket": paket}, f, ensure_ascii=False)
    os.replace(gecici, PAKET_DOSYASI)  # atomik: yarim dosya kalamaz


# 14 GUN PENCERESI (kullanici direktifi, 31.08.2026): klasorde yalniz TEKIL
# gun dosyalari durur; dosya adindaki tarihe gore en yeni 14 gun kalir,
# 15. gun yazilinca en eski silinir. Toplu dosyalar (_tam-paket.json,
# _tanimlar.json) artik uretilmez; eski kurulumdan kalmislarsa temizlenir.
# Tam kurtarma gorevi gecelik SQLite yedegindedir. CLAUDE.md KURAL 13 revize.
TUTULACAK_GUN = 14
GUN_ADI = re.compile(r"^(\d{2})\.(\d{2})\.(\d{4})\.json$")


def gunleri_buda():
    """kilit ALINMIS halde cagrilir; silinen dosya adlarini dondurur."""
    silinen = []
    for eski in ("_tam-paket.json", "_tanimlar.json"):
        yol = os.path.join(YEDEK, eski)
        if os.path.isfile(yol):
            try:
                os.remove(yol)
                silinen.append(eski)
            except OSError:
                pass  # kilitliyse bir sonraki yazmada denenir
    gunler = []
    for ad in os.listdir(YEDEK):
        e = GUN_ADI.match(ad)
        if e:
            gunler.append((e.group(3) + e.group(2) + e.group(1), ad))  # YYYYAAGG
    gunler.sort(reverse=True)
    for _, ad in gunler[TUTULACAK_GUN:]:
        try:
            os.remove(os.path.join(YEDEK, ad))
            silinen.append(ad)
        except OSError:
            pass
    return silinen


class Istekci(SimpleHTTPRequestHandler):
    def _json(self, kod, govde):
        veri = json.dumps(govde, ensure_ascii=False).encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(veri)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(veri)

    def end_headers(self):
        """KAYNAK DOSYALARI ONBELLEGE ALINMAZ (31.08.2026).

        SimpleHTTPRequestHandler yalniz Last-Modified gonderiyor; Chrome bunu
        gorup .js/.css dosyalarini sezgisel olarak onbellege aliyordu. Sonuc:
        kod degistiriliyor, sunucu yeni dosyayi servis ediyor ama tarayici
        ESKI kopyayi calistiriyor - "duzelttim ama ekranda ayni" hatasi.
        Olculdu (31.08.2026): 32-tum-hareketler.js sunucuda 46.325 bayt iken
        sayfada calisan kopya 45.127 baytti.

        Bu bir gelistirme/fabrika ici sunucusudur; dosyalar kucuk ve yerel ag
        hizli - onbellekten kazanc, eskimis kod riskini karsilamiyor."""
        yol = urlparse(self.path).path.lower()
        if yol.endswith((".js", ".css", ".html", ".htm")) or yol == "/":
            self.send_header("Cache-Control", "no-store, must-revalidate")
        SimpleHTTPRequestHandler.end_headers(self)

    def _index_gonder(self):
        """index.html'i SURUM DAMGALI servis eder (31.08.2026).

        Kusur: kod degistiriliyor, sunucu yeni dosyayi veriyor ama tarayici
        eski kopyayi calistiriyordu - "duzelttim ama ekranda ayni". Cache-Control
        no-store yeni yanitlar icin calisir; tarayicida ZATEN duran kopyayi
        atmaz. Kalici cozum adresin kendisini degistirmektir.

        Burada index.html okunur ve her <script src="js/..."> / css baglantisina
        dosyanin degisiklik zamani "?s=" olarak eklenir. Dosya degisince adres
        degisir, tarayici mecburen yeniden indirir; dosya degismezse adres ayni
        kalir ve onbellek calismaya devam eder. Kaynak dosyaya dokunulmaz -
        index.html diskte sade halinde durur."""
        kaynak = os.path.join(STATIK, "index.html")
        try:
            with open(kaynak, encoding="utf-8") as f:
                metin = f.read()
        except OSError:
            return self._json(500, {"hata": "index.html okunamadı."})

        def damgala(esles):
            onek, yol_ = esles.group(1), esles.group(2)
            tam = os.path.join(STATIK, yol_.replace("/", os.sep))
            try:
                s_ = str(int(os.path.getmtime(tam)))
            except OSError:
                return esles.group(0)
            return onek + yol_ + "?s=" + s_

        metin = re.sub(r'(src=")((?:js|css)/[^"?]+)', damgala, metin)
        metin = re.sub(r'(href=")((?:js|css)/[^"?]+)', damgala, metin)

        veri = metin.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(veri)))
        self.end_headers()
        self.wfile.write(veri)

    def do_GET(self):
        yol = urlparse(self.path)
        if yol.path in ("/", "/index.html"):
            return self._index_gonder()
        if yol.path == "/api/surum":
            with kilit:
                surum, _ = paket_oku()
            return self._json(200, {"surum": surum})
        if yol.path == "/api/paket":
            with kilit:
                surum, paket = paket_oku()
            return self._json(200, {"surum": surum, "paket": paket})
        if yol.path == "/api/gunluk-yedek/saglik":
            adet = 0
            if os.path.isdir(YEDEK):
                adet = sum(1 for a in os.listdir(YEDEK) if AD_DESENI.match(a))
            return self._json(200, {"durum": "ok", "klasor": YEDEK, "adet": adet})
        if yol.path == "/api/mail/durum":
            hesap = mail.ozet()
            return self._json(200, {
                "hazir": hesap is not None,
                "hesap": hesap,
                "yazdirmaMotoru": mail.tarayici_yolu() is not None,
                # Outlook taslak penceresi (EmlTaslak) yalniz .NET sunucusunda
                # var; burada yok, ekran PDF-indirme yoluna duser.
                "pencere": False,
            })
        if yol.path == "/api/mail/hesap/tahmin":
            adres = (parse_qs(yol.query).get("adres") or [""])[0]
            sunucu, port = mail.sunucu_tahmini(adres)
            return self._json(200, {"sunucu": sunucu, "port": port,
                                    "uyari": mail.desteklenmeyen_mi(adres)})
        if yol.path == "/api/mail/teslimsiz":
            # Gonderimden SONRA ekran buraya sorar: sorulan alicilardan
            # hangisine ulasilamadi? Sebebi 31.08.2026 notu (yanurunler_mail
            # . teslimsizler): kutu yoksa bunu ancak teslimsizlik postasi
            # soyler, gonderim ani soyleyemez.
            q = parse_qs(yol.query)
            alicilar = [a for a in (q.get("alicilar") or [""])[0].split(",") if a.strip()]
            gun = (q.get("gun") or [""])[0]
            return self._json(200, {"teslimsizler": mail.teslimsizler(alicilar, gun)})
        if yol.path == "/api/gunluk-yedek/dosya":
            ad = (parse_qs(yol.query).get("ad") or [""])[0]
            if not AD_DESENI.match(ad):
                return self._json(400, {"hata": "Geçersiz dosya adı."})
            tam = os.path.join(YEDEK, ad)
            if not os.path.isfile(tam):
                return self._json(404, {"hata": ad + " yok."})
            with open(tam, "rb") as f:
                veri = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(veri)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(veri)
            return
        return super().do_GET()

    def _govde_oku(self):
        """Istek govdesini JSON olarak okur. Hata varsa (None, hata_metni)."""
        boy = int(self.headers.get("Content-Length") or 0)
        if boy <= 0 or boy > EN_BUYUK_GOVDE:
            return None, "Gövde boyu geçersiz."
        try:
            return json.loads(self.rfile.read(boy).decode("utf-8")), None
        except Exception as e:
            return None, "İstek gövdesi okunamadı: " + str(e)

    def do_DELETE(self):
        if urlparse(self.path).path == "/api/mail/hesap":
            return self._json(200, {"silindi": mail.sil()})
        return self._json(404, {"hata": "Bilinmeyen uç."})

    def do_POST(self):
        yol = urlparse(self.path).path
        if yol == "/api/mail/hesap":
            return self._mail_hesap_kaydet()
        if yol == "/api/mail/hesap/sina":
            return self._json(200, mail.sina())
        if yol == "/api/mail":
            return self._mail_gonder()
        if yol == "/api/paket":
            govde, hata = self._govde_oku()
            if hata:
                return self._json(400, {"hata": hata})
            try:
                istenen = int(govde["surum"])
                paket = govde["paket"]
                assert isinstance(paket, dict)
            except Exception:
                return self._json(400, {"hata": "Beklenen bicim: {surum:int, paket:{...}}"})
            with kilit:
                surum, mevcut = paket_oku()
                if istenen != surum:
                    # Iyimser kilit tutmadi: birisi once yazdi. Taze paket geri
                    # doner; kopru ayni girdiyle yeniden hesaplar (06-uzak).
                    return self._json(409, {"surum": surum, "paket": mevcut})
                paket_yaz(surum + 1, paket)
                return self._json(200, {"surum": surum + 1})
        if yol != "/api/gunluk-yedek":
            return self._json(404, {"hata": "Bilinmeyen uç."})
        govde, hata = self._govde_oku()
        if hata:
            return self._json(400, {"hata": hata})
        try:
            dosyalar = govde["dosyalar"]
            assert isinstance(dosyalar, list)
        except Exception:
            return self._json(400, {"hata": "Beklenen biçim: {dosyalar:[{ad,metin}]}"})

        yazilan, hatali = [], []
        with kilit:
            os.makedirs(YEDEK, exist_ok=True)
            for d in dosyalar:
                ad = str(d.get("ad", ""))
                metin = d.get("metin")
                if not AD_DESENI.match(ad) or not isinstance(metin, str):
                    hatali.append(ad or "(adsiz)")
                    continue
                tam = os.path.join(YEDEK, ad)
                gecici = tam + ".tmp"
                try:
                    with open(gecici, "w", encoding="utf-8", newline="\n") as f:
                        f.write(metin)
                    os.replace(gecici, tam)  # atomik: yarim dosya kalamaz
                    yazilan.append(ad)
                except OSError as e:
                    hatali.append(ad + " (" + str(e) + ")")
                    try:
                        os.remove(gecici)
                    except OSError:
                        pass
            silinen = gunleri_buda()
        kod = 200 if not hatali else 500
        return self._json(kod, {"yazilan": yazilan, "hatali": hatali, "silinen": silinen})

    # ---------------------------------------------------------------- mail --

    def _mail_hesap_kaydet(self):
        """Giris: baglanti SINANIR, ancak basariliysa kaydedilir. Yanlis parola
        diske yazilmaz - kullanici "kaydettim ama gondermiyor" durumuna
        dusmez (.NET tarafiyla ayni kural)."""
        g, hata = self._govde_oku()
        if hata:
            return self._json(400, {"hata": hata})
        adres = str(g.get("adres") or "").strip()
        parola = str(g.get("parola") or "")
        if not adres or not parola:
            return self._json(400, {"hata": "Adres ve uygulama parolası gerekli."})

        engel = mail.desteklenmeyen_mi(adres)
        if engel:
            return self._json(400, {"hata": engel})
        if not mail.dpapi_var_mi():
            return self._json(400, {"hata": "Parola şifrelemesi yalnız Windows'ta "
                                            "desteklenir; hesap kaydedilmedi."})

        v_sunucu, v_port = mail.sunucu_tahmini(adres)
        sunucu = str(g.get("sunucu") or "").strip() or v_sunucu
        try:
            port = int(g.get("port") or 0) or v_port
        except (TypeError, ValueError):
            port = v_port
        ssl = g.get("ssl") is not False

        smtp_hatasi = mail.smtp_dene(sunucu, port, ssl, adres, parola)
        if smtp_hatasi:
            return self._json(400, {"hata": smtp_hatasi})

        try:
            mail.kaydet(adres, sunucu, port, ssl, parola)
        except Exception as e:
            return self._json(500, {"hata": str(e)})
        return self._json(200, {"hesap": mail.ozet()})

    def _mail_gonder(self):
        g, hata = self._govde_oku()
        if hata:
            return self._json(400, {"hata": hata})
        alicilar = [str(a).strip() for a in (g.get("alicilar") or []) if str(a).strip()]
        if not alicilar:
            return self._json(400, {"hata": "Alıcı yok."})
        if mail.kimlik() is None:
            # 503: ekran bunu gorunce PDF-indirme yoluna duser, posta
            # uygulamasi ACILMAZ (js/35-mail-gonder.js).
            return self._json(503, {"hata": "Posta hesabı yok: önce mail ile giriş yapın."})

        ek_ad = str(g.get("dosyaAdi") or "rapor.pdf")
        pdf = mail.pdf_uret(g.get("html") or "")
        if pdf is None:
            return self._json(502, {"hata": "PDF üretilemedi: yazdırma motoru "
                                            "(Edge/Chrome) bulunamadı ya da iş bitmedi. "
                                            "Rapor eksiz gönderilmedi."})

        sonuclar, yoklama = mail.gonder_tek_tek(
            alicilar, str(g.get("konu") or "Rapor"), str(g.get("mesaj") or ""), ek_ad, pdf)
        if yoklama:
            return self._json(503, {"hata": yoklama})

        basarili = sum(1 for s in sonuclar if s["tamam"])
        kunye = mail.ozet() or {}
        cevap = {
            "gonderildi": basarili,
            "basarisiz": len(sonuclar) - basarili,
            "sonuclar": sonuclar,
            "ekBoyu": len(pdf),
            "gonderen": kunye.get("adres"),
        }
        # Hepsi basarisizsa 502: ekran o zaman hata dili kullanir.
        return self._json(200 if basarili else 502, cevap)

    def log_message(self, bicim, *args):  # gurultusuz calissin
        pass


def calistir():
    if not os.path.isdir(STATIK):
        print("Uygulama klasoru yok:", STATIK)
        sys.exit(1)
    os.makedirs(YEDEK, exist_ok=True)
    sunucu = ThreadingHTTPServer(("", PORT), partial(Istekci, directory=STATIK))
    print("Yan Urunler sunucusu: http://localhost:%d  ·  yedek: %s" % (PORT, YEDEK))
    sunucu.serve_forever()


if __name__ == "__main__":
    calistir()

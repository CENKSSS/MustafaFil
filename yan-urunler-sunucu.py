# Yan Urunler Stok Takip - yerel sunucu (27.08.2026)
#
# `py -m http.server`in yerine gecer (GUNLUK-YEDEK-PLANI.md REVIZE):
#   1) yan-urunler-stok-takip/ klasorunu statik servis eder (eskisi gibi)
#   2) gunluk JSON yedeklerini TIKLAMASIZ diske yazar:
#        POST /api/gunluk-yedek            {"dosyalar":[{"ad","metin"},...]}
#        GET  /api/gunluk-yedek/saglik  -> {"durum","klasor","adet"}
#        GET  /api/gunluk-yedek/dosya?ad=_tam-paket.json -> dosya icerigi
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

KOK = os.path.dirname(os.path.abspath(__file__))
STATIK = os.path.join(KOK, "yan-urunler-stok-takip")
YEDEK = os.path.join(KOK, "gunluk-veriler")
PORT = int(os.environ.get("PORT", "8155"))
EN_BUYUK_GOVDE = 50 * 1024 * 1024  # 50 MB - tam paket ~1 MB, bol pay

# Izinli dosya adlari: 27.08.2026.json / _tam-paket.json / _tanimlar.json
AD_DESENI = re.compile(r"^(\d{2}\.\d{2}\.\d{4}|_tam-paket|_tanimlar)\.json$")

kilit = threading.Lock()


class Istekci(SimpleHTTPRequestHandler):
    def _json(self, kod, govde):
        veri = json.dumps(govde, ensure_ascii=False).encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(veri)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(veri)

    def do_GET(self):
        yol = urlparse(self.path)
        if yol.path == "/api/gunluk-yedek/saglik":
            adet = 0
            if os.path.isdir(YEDEK):
                adet = sum(1 for a in os.listdir(YEDEK) if AD_DESENI.match(a))
            return self._json(200, {"durum": "ok", "klasor": YEDEK, "adet": adet})
        if yol.path == "/api/gunluk-yedek/dosya":
            ad = (parse_qs(yol.query).get("ad") or [""])[0]
            if not AD_DESENI.match(ad):
                return self._json(400, {"hata": "Gecersiz dosya adi."})
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

    def do_POST(self):
        if urlparse(self.path).path != "/api/gunluk-yedek":
            return self._json(404, {"hata": "Bilinmeyen uc."})
        boy = int(self.headers.get("Content-Length") or 0)
        if boy <= 0 or boy > EN_BUYUK_GOVDE:
            return self._json(400, {"hata": "Govde boyu gecersiz."})
        try:
            govde = json.loads(self.rfile.read(boy).decode("utf-8"))
            dosyalar = govde["dosyalar"]
            assert isinstance(dosyalar, list)
        except Exception:
            return self._json(400, {"hata": "Beklenen bicim: {dosyalar:[{ad,metin}]}"})

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
        kod = 200 if not hatali else 500
        return self._json(kod, {"yazilan": yazilan, "hatali": hatali})

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

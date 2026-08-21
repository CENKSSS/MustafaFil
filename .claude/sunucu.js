// Yerel test sunucusu — yalnızca geliştirme sırasında kullanılır.
var http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
var KOK = path.join(__dirname, '..', 'yan-urunler-stok-takip');
var TIP = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(function (istek, cevap) {
  var yol = decodeURIComponent(url.parse(istek.url).pathname);
  if (yol === '/') yol = '/index.html';
  var tam = path.join(KOK, yol);
  if (tam.indexOf(KOK) !== 0) { cevap.writeHead(403); return cevap.end('yasak'); }
  fs.readFile(tam, function (h, veri) {
    if (h) { cevap.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return cevap.end('bulunamadi: ' + yol); }
    cevap.writeHead(200, {'Content-Type': TIP[path.extname(tam).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store'});
    cevap.end(veri);
  });
}).listen(process.env.PORT || 8137, function () { console.log('test sunucusu: http://localhost:' + (process.env.PORT || 8137)); });

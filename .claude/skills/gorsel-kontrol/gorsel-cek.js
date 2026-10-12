// Derlenmiş ön yüzü yerelde sunar, sahte oturumla başsız Chrome'da açar, adımları uygulayıp ekran görüntüsü alır.
// Ağ güvenliği: yerel sunucu dışındaki bütün istekler engellenir; /api/ istekleri sahte modülden yanıtlanır, gerçek
// API'ye veya internete hiçbir istek gitmez.
//
// Kullanım:
//   node gorsel-cek.js --sahte <sahte.js> --adimlar <adimlar.json> --yol /rota --cikti <klasör>
//                      [--onek ad] [--gen 1440] [--yuk 900] [--dist dist/3k_onyuz/browser]
// adimlar.json: [["ad", "<sayfada çalışacak JS (await kullanılabilir)>", beklemeMs], ...]
// sahte.js: exports.token (JWT biçiminde imzasız belirteç) ve exports.yanit(url, method) → JSON gövde veya
//           { __durum: 409, govde: {...} } (bkz. sahte-ornek.js).
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const arg = (ad, varsayilan) => {
  const i = process.argv.indexOf(`--${ad}`);
  return i > 0 ? process.argv[i + 1] : varsayilan;
};
const kok = path.resolve(__dirname, '..', '..', '..');
const dist = path.resolve(kok, arg('dist', 'dist/3k_onyuz/browser'));
const sahte = require(path.resolve(arg('sahte')));
const adimlar = JSON.parse(fs.readFileSync(path.resolve(arg('adimlar')), 'utf8'));
const yol = arg('yol', '/dashboard');
const cikti = path.resolve(arg('cikti', os.tmpdir()));
const onek = arg('onek', 'ekran');
const gen = Number(arg('gen', 1440));
const yuk = Number(arg('yuk', 900));
const chromeYolu = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`Derleme yok: ${dist} (önce npx ng build --configuration development)`);
fs.mkdirSync(cikti, { recursive: true });

const turler = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const sunucu = http.createServer((istek, yanit) => {
  let dosya = path.join(dist, decodeURIComponent(istek.url.split('?')[0]));
  if (!dosya.startsWith(dist) || !fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) dosya = path.join(dist, 'index.html');
  yanit.writeHead(200, { 'Content-Type': turler[path.extname(dosya)] ?? 'application/octet-stream' });
  fs.createReadStream(dosya).pipe(yanit);
});

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

sunucu.listen(0, '127.0.0.1', async () => {
  const kaynak = `http://127.0.0.1:${sunucu.address().port}`;
  const port = 9300 + Math.floor(Math.random() * 500);
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
  const chrome = spawn(chromeYolu, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profil}`, 'about:blank'], { stdio: 'ignore' });
  const bitir = (kod) => { try { chrome.kill(); } catch { } sunucu.close(); process.exit(kod); };
  try {
    let hedef;
    for (let i = 0; i < 40 && !hedef; i++) {
      await bekle(250);
      try { hedef = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); } catch { }
    }
    if (!hedef) throw new Error('Chrome hata ayıklama bağlantısı açılmadı.');
    const ws = new WebSocket(hedef.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let no = 0; let sseHatasi = 0; const bekleyen = new Map(); const konsol = []; const engellenen = new Set();
    const gonder = (method, params = {}) => new Promise((r) => { const i = ++no; bekleyen.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); }
      if (m.method === 'Fetch.requestPaused') {
        const { requestId, request } = m.params;
        if (request.url.startsWith(kaynak)) { gonder('Fetch.continueRequest', { requestId }); return; }
        if (!request.url.includes('/api/')) {
          engellenen.add(new URL(request.url).host);
          gonder('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
          return;
        }
        const cors = [{ name: 'Access-Control-Allow-Origin', value: kaynak }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
          { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' },
          { name: 'Access-Control-Expose-Headers', value: '*' }];
        if (request.method === 'OPTIONS') { gonder('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: cors }); return; }
        const y = sahte.yanit(request.url, request.method);
        const durum = (y && y.__durum) || 200;
        const govde = Buffer.from(JSON.stringify(y && y.__durum ? y.govde : y)).toString('base64');
        gonder('Fetch.fulfillRequest', { requestId, responseCode: durum, responseHeaders: [...cors, { name: 'Content-Type', value: 'application/json' }], body: govde });
      }
      if (m.method === 'Runtime.exceptionThrown')
        konsol.push('HATA ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const metin = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        // Bildirim akışı (SSE) sahte ortamda bağlanamaz; beklenen gürültüdür, ayrı sayılır.
        if (/^SSE Error/.test(metin)) sseHatasi++;
        else konsol.push('console.error ' + metin.slice(0, 200));
      }
    });
    await gonder('Emulation.setDeviceMetricsOverride', { width: gen, height: yuk, deviceScaleFactor: 1, mobile: gen < 768 });
    await gonder('Runtime.enable');
    await gonder('Page.enable');
    await gonder('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await gonder('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('3k_token', ${JSON.stringify(sahte.token)}); localStorage.setItem('3k_remember', 'true'); localStorage.setItem('3k_lang', 'tr');` });
    await gonder('Page.navigate', { url: kaynak + yol });
    await bekle(3500);
    for (const [ad, ifade, ms] of adimlar) {
      const s = await gonder('Runtime.evaluate', { returnByValue: true, awaitPromise: true,
        expression: `(async () => { ${ifade}; return { y: scrollY, sw: document.documentElement.scrollWidth, iw: innerWidth, url: location.pathname }; })()` });
      await bekle(ms);
      const resim = await gonder('Page.captureScreenshot', { format: 'png' });
      const dosya = path.join(cikti, `${onek}-${ad}.png`);
      fs.writeFileSync(dosya, Buffer.from(resim.result.data, 'base64'));
      const deger = s.result?.result?.value;
      const hata = s.result?.exceptionDetails?.exception?.description;
      console.log(`${ad}: ${dosya}${hata ? ' | ADIM HATASI ' + hata.slice(0, 160) : ''}${deger && deger.sw > deger.iw ? ' | YATAY TAŞMA ' + deger.sw + '>' + deger.iw : ''}`);
    }
    console.log(konsol.length ? konsol.slice(0, 8).join('\n') : 'konsol temiz');
    if (sseHatasi) console.log(`bildirim akışı (SSE) bağlanamadı: ${sseHatasi} kez (sahte ortamda beklenir)`);
    if (engellenen.size) console.log('engellenen dış istekler: ' + [...engellenen].join(', '));
    ws.close();
    bitir(0);
  } catch (e) {
    console.error(e);
    bitir(1);
  }
});

// قياس الأداء الفعلي (قبل/بعد): مكتبة كبيرة + معالج مُبطّأ ×4 (يحاكي جوالًا) — المتوسط من 3 محاولات.
// يكتب tests/out/perf-<label>.json ويطبع جدولًا. الاستخدام: node tests/perf.mjs before|after
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const label = process.argv[2] || 'run';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), www = join(root, 'www'), out = join(root, 'tests', 'out'); mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((q, r) => { const p = join(www, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
await ctx.route('https://**', r => r.fulfill({ status: 404, body: '' }));
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

// ---------- بذر مكتبة كبيرة مرة واحدة (بلا تبطيء) ----------
await page.goto(base); await page.waitForSelector('body.ready');
await page.evaluate(async () => {
  const thumb = (() => { const c = document.createElement('canvas'); c.width = 120; c.height = 160; const x = c.getContext('2d'); x.fillStyle = '#835'; x.fillRect(0, 0, 120, 160); return c.toDataURL('image/jpeg', .6); })();
  const cc = ['US', 'CZ', 'RU', 'ES', 'BR', 'HU', 'UA', 'FR'], tg = ['a', 'b', 'c', 'd', 'e', 'f'];
  const arr = [];
  for (let i = 0; i < 300; i++) {
    const works = Array.from({ length: 20 }, (_, k) => ({ t: 'Work ' + i + '-' + k, s: 'Studio ' + (k % 15), y: String(2012 + (k % 13)), d: (2012 + (k % 13)) + '-0' + (1 + k % 9) + '-1' + (k % 9), w: k % 3 === 0 ? 1 : undefined, wd: k % 3 === 0 ? '2026-0' + (1 + k % 9) + '-0' + (1 + k % 9) : undefined, r: k % 4 === 0 ? 4 : undefined, tg: [tg[k % 6]] }));
    arr.push({ id: 'perf-' + i, name: 'Performer ' + i, birth: (1985 + i % 15) + '-0' + (1 + i % 9) + '-1' + (i % 9), country: cc[i % 8], rating: (i % 5) + 1, fav: i % 4 === 0, photos: [thumb], thumb, works, tags: [tg[i % 6]], lists: [], added: Date.now() - i * 36e5, updated: Date.now() });
  }
  for (let k = 0; k < arr.length; k += 25) await DB.put(arr.slice(k, k + 25));
  // الاستديو: 4000 صورة في قاعدته المستقلة
  await Studio._test.load(); const now = Date.now(); const imgs = [];
  for (let i = 0; i < 4000; i++) imgs.push({ id: 'zz' + i, pid: 'perf-' + (i % 300), url: 'https://img.test/' + i + '.jpg', prev: '', src: ['tpdb', 'stash', 'tpdbs'][i % 3], kind: ['portrait', 'still', 'promo'][i % 3], w: 1000 + i % 900, h: 1500 + i % 700, pub: (2005 + i % 20) + '-01-01', found: now - i * 6e4, seen: 0, like: 0, hide: 0, albums: [], dh: (i * 2654435761 >>> 0).toString(16).padStart(16, '0'), sess: i % 5 ? null : { k: 'z' + (i % 300), t: 'S' + (i % 300), d: '2020-01-01', st: 'X' } });
  const db = await new Promise((res, rej) => { const r = indexedDB.open('vkte_studio', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const t = db.transaction('img', 'readwrite'); imgs.forEach(x => t.objectStore('img').put(x)); t.oncomplete = res; t.onerror = () => rej(t.error); }); db.close();
  // مخزون اقتراحات 400 مرشحة
  LS.set('vkte_key', 'k'); LS.set('vkte_stash', 'k');
  const pool = []; for (let i = 0; i < 400; i++) pool.push({ k: 'cand ' + i, name: 'Cand ' + i, img: '', cc: cc[i % 8], birth: (1990 + i % 10) + '-03-03', bs: { stash: (1990 + i % 10) + '-03-03' }, src: 'StashDB', gender: 'female', at: { c: cc[i % 8], e: 'caucasian', hr: i % 2 ? 'blonde' : 'brunette', cs: 2015 }, t: now });
  LS.set('vkte_rec_pool2', JSON.stringify({ v: 2, at: now, round: 1, list: pool })); LS.set('vkte_rec_cache2', JSON.stringify({ list: pool.slice(0, 24), at: now }));
});

const measure = async () => {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now(); await page.reload(); await page.waitForSelector('body.ready', { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('#grid .card').length > 0, null, { timeout: 60000 });
  const boot = Date.now() - t0;
  const r = await page.evaluate(async () => {
    const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const time = async f => { const t = performance.now(); await f(); await frame(); return Math.round(performance.now() - t); };
    const o = {};
    o.cards = document.querySelectorAll('#grid .card').length;
    o.search = await time(() => { const q = document.getElementById('q'); q.value = 'Performer 1'; q.dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise(r => setTimeout(r, 400)); const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
    o.detail = await time(() => openDetail('perf-7')); closeOv('ovDetail'); await frame();
    o.works = await time(() => document.getElementById('nWorks').click());
    o.studio = await time(() => Studio.open({ v: 'home' }));
    o.studioTab = await time(() => document.querySelector('#mStudio [data-tab="latest"]').click());
    o.discover = await time(() => document.getElementById('nRecs').click());
    o.home = await time(() => document.getElementById('nDash').click());
    o.library = await time(() => document.getElementById('nHome').click());
    o.heapMB = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    o.domNodes = document.getElementsByTagName('*').length;
    return o; });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return { boot, ...r };
};
const runs = []; for (let i = 0; i < 3; i++) runs.push(await measure());
const keys = Object.keys(runs[0]); const avg = {}; keys.forEach(k => { const v = runs.map(r => r[k]).filter(x => typeof x === 'number'); avg[k] = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; });
writeFileSync(join(out, 'perf-' + label + '.json'), JSON.stringify({ label, at: new Date().toISOString(), cpuThrottle: 4, avg, runs }, null, 1));
console.log('perf ' + label + ' (CPU ×4, avg of 3, ms):'); Object.entries(avg).forEach(([k, v]) => console.log('  ' + k.padEnd(10) + ' ' + v));
await browser.close(); server.close();

// يحاكي التطبيق الأصلي في المتصفح: يستبدل native.js بجسر وهمي نظام ملفاته على خادم الاختبار،
// فتُختبر مسارات التطبيق الحقيقية: تخزين الصور ملفات، بقاؤها بعد إعادة التشغيل، النسخ التلقائي،
// الاستعادة التلقائية بعد مسح القاعدة، وترحيل صور النسخة السابقة (Blob داخل القاعدة).
// يحتاج tests/out/sample-backup.json (يصنعه tests/run.mjs).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www'), sampleFile = join(root, 'tests', 'out', 'sample-backup.json');
if (!existsSync(sampleFile)) { console.error('شغّل tests/run.mjs أولًا'); process.exit(2); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const files = new Map(); // "DIR/path" → {buf, mtime}
const MOCK = `(() => {
  const call = async (op, a) => { const r = await fetch('/__fs', { method: 'POST', body: JSON.stringify({ op, ...a }) }); const j = await r.json(); if (j.error) throw new Error(j.error); return j; };
  const Filesystem = {}; ['mkdir', 'writeFile', 'appendFile', 'readFile', 'readdir', 'deleteFile', 'stat', 'copy', 'getUri'].forEach(op => Filesystem[op] = a => call(op, a));
  Filesystem.requestPermissions = async () => ({ publicStorage: 'granted' });
  window.Native = { isNative: true, platform: 'android', Filesystem, Directory: { Library: 'LIBRARY', Documents: 'DOCUMENTS', Data: 'DATA', Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' },
    Capacitor: { convertFileSrc: u => u.replace('file:///mock/', location.origin + '/__file/') },
    CapacitorHttp: { get: async () => ({ status: 404, data: '' }) }, App: { addListener: () => {}, minimizeApp: () => {} }, Share: { share: async () => {} },
    Shell: { info: async () => ({ tv: false }), secure: async () => {} } };
})();`;
const server = http.createServer(async (q, r) => {
  const url = decodeURIComponent(q.url.split('?')[0]);
  if (url === '/native.js') { r.writeHead(200, { 'Content-Type': MIME['.js'] }); r.end(MOCK); return; }
  if (url.startsWith('/__file/')) { const f = files.get(url.slice(8)); if (!f) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(url)] || 'application/octet-stream' }); r.end(f.buf); return; }
  if (url === '/__fs') { let body = ''; for await (const c of q) body += c; const a = JSON.parse(body), key = (d, p) => d + '/' + String(p).replace(/^\/+/, ''); let out = {};
    try { const k = key(a.directory, a.path || '');
      if (a.op === 'writeFile') files.set(k, { buf: a.encoding ? Buffer.from(a.data, 'utf8') : Buffer.from(a.data, 'base64'), mtime: Date.now() });
      else if (a.op === 'appendFile') { const f = files.get(k); files.set(k, { buf: Buffer.concat([f ? f.buf : Buffer.alloc(0), Buffer.from(a.data, 'utf8')]), mtime: Date.now() }); }
      else if (a.op === 'readFile') { const f = files.get(k); if (!f) throw new Error('File does not exist'); out = { data: f.buf.toString(a.encoding ? 'utf8' : 'base64') }; }
      else if (a.op === 'readdir') { const pre = k.replace(/\/+$/, '') + '/'; const names = new Map(); for (const [n, f] of files) if (n.startsWith(pre)) { const rest = n.slice(pre.length).split('/')[0]; names.set(rest, f.mtime); } out = { files: [...names].map(([name, mtime]) => ({ name, mtime })) }; }
      else if (a.op === 'deleteFile') { if (!files.delete(k)) throw new Error('File does not exist'); }
      else if (a.op === 'stat') { const pre = k.replace(/\/+$/, ''); if (!files.has(pre) && ![...files.keys()].some(n => n.startsWith(pre + '/'))) throw new Error('File does not exist'); }
      else if (a.op === 'copy') { const f = files.get(key(a.directory, a.from)); if (!f) throw new Error('File does not exist'); const to = key(a.toDirectory || a.directory, a.to); if (files.has(to)) throw new Error('exists'); files.set(to, { buf: f.buf, mtime: Date.now() }); }
      else if (a.op === 'getUri') out = { uri: 'file:///mock/' + k };
    } catch (e) { out = { error: e.message }; }
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(out)); return; }
  const p = join(www, url.replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const results = []; let failed = 0;
const ok = (name, cond, extra = '') => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!cond) failed++; };
let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error' && !/net::ERR|404/.test(m.text())) errors.push(m.text()); });
const boot = async () => { await page.goto(base); await page.waitForSelector('body.ready'); await page.waitForTimeout(500); };
const count = pre => [...files.keys()].filter(k => k.startsWith(pre)).length;
// كل الصور (الكاملة والمصغّرات) تُحمَّل فعلًا من روابطها
const allLoad = () => page.evaluate(async () => { const urls = items.flatMap(i => [...(i.photos || []), i.thumb].filter(Boolean)); let bad = 0, w = 0;
  await Promise.all(urls.map(u => new Promise(r => { const im = new Image(); im.onload = () => { w = Math.max(w, im.naturalWidth); r(); }; im.onerror = () => { bad++; r(); }; im.src = u; })));
  return { n: urls.length, bad, w, file: urls.filter(u => u.includes('/__file/')).length, blob: urls.filter(u => u.startsWith('blob:')).length }; });

await boot();
ok('الجسر الوهمي يعمل كتطبيق أصلي', await page.evaluate(() => IS_NATIVE && FST.on && FST.base.includes('LIBRARY/photos')));
await page.click('#bSet'); await page.setInputFiles('#fImp', sampleFile); await page.waitForSelector('#ovAsk.show #aOk'); await page.click('#aOk');
await page.waitForFunction(() => items.length >= 17 && !document.querySelector('#busy.show')); await page.waitForTimeout(2500);
let a = await allLoad();
ok('بعد الاستيراد: كل الصور ملفات وتُحمَّل', a.bad === 0 && a.blob === 0 && a.file === a.n && a.n > 40, JSON.stringify(a));
ok('ملفات الصور كُتبت في مجلد التطبيق', count('LIBRARY/photos/') >= a.n, String(count('LIBRARY/photos/')));
ok('القاعدة تحفظ أسماء الملفات لا Blob', await page.evaluate(async () => { const db = await DB.open(); const all = await DB.rq(db.transaction('photos').objectStore('photos').getAll()); const recs = await DB.rq(db.transaction('recs').objectStore('recs').getAll());
  return all.every(p => p.list.every(x => x && typeof x === 'object' && !(x instanceof Blob) && x.f)) && recs.every(r => !r.thumb || (r.thumb.f && !(r.thumb instanceof Blob))); }));
const before = await page.evaluate(async () => JSON.stringify((await exportItems()).map(i => [i.id, i.photos.map(p => p.length), (i.thumb || '').length])));

await boot(); await page.waitForSelector('.card');
a = await allLoad();
ok('بعد إعادة التشغيل: كل الصور تُحمَّل بدقتها الكاملة', a.bad === 0 && a.n > 40 && a.w >= 480, JSON.stringify(a));
ok('التصدير بعد إعادة التشغيل مطابق (الصور تُقرأ من الملفات)', await page.evaluate(async () => JSON.stringify((await exportItems()).map(i => [i.id, i.photos.map(p => p.length), (i.thumb || '').length]))) === before);
ok('بطاقات الرئيسية تعرض صورها', await page.evaluate(() => [...document.querySelectorAll('.card .ph img.on')].filter(i => i.complete && i.naturalWidth > 0).length) >= 6);

// النسخ التلقائي إلى Documents
await page.evaluate(() => Backup.syncAll(true)); await page.waitForFunction(() => +LS.get('vkte_bk_at', '0') > 0, null, { timeout: 30000 }); await page.waitForTimeout(800);
ok('النسخ التلقائي: ملف لكل ممثلة + الصور + data.json', count('DOCUMENTS/FavoritesBackup/items/') === 17 && count('DOCUMENTS/FavoritesBackup/photos/') >= a.n && files.has('DOCUMENTS/FavoritesBackup/data.json'), count('DOCUMENTS/FavoritesBackup/items/') + ' / ' + count('DOCUMENTS/FavoritesBackup/photos/'));

// تثبيت جديد: القاعدة ومجلد التطبيق فارغان ومجلد النسخ موجود ← استعادة تلقائية
await page.evaluate(() => new Promise(r => { _db && _db.then(d => d.close()); const q = indexedDB.deleteDatabase('favlib'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
for (const k of [...files.keys()]) if (k.startsWith('LIBRARY/')) files.delete(k);
await boot(); await page.waitForFunction(() => items.length === 17, null, { timeout: 30000 }); await page.waitForTimeout(1500);
a = await allLoad();
ok('استعادة تلقائية كاملة بعد مسح القاعدة', a.bad === 0 && a.n > 40 && a.file === a.n, JSON.stringify(a));
ok('الاستعادة أعادت القوائم', await page.evaluate(() => lists.length === 2 && wlists.length === 1));

// ترحيل النسخة السابقة: صورة مخزّنة Blob داخل القاعدة تتحول إلى ملف
await page.evaluate(async () => { const it = items.find(i => i.id === 'sample-1'); const d = await PB.toData(it.photos[0]); const b = PB.fromData(d); const db = await DB.open();
  const t = db.transaction(['recs', 'photos'], 'readwrite'); t.objectStore('photos').put({ id: 'sample-1', list: [b, b] }); await DB.done(t); });
await boot(); await page.waitForFunction(() => !DB.legacy.length, null, { timeout: 20000 }); await page.waitForTimeout(600);
ok('ترحيل Blob القديم إلى ملفات', await page.evaluate(async () => { const it = items.find(i => i.id === 'sample-1'); const db = await DB.open(); const p = await DB.rq(db.transaction('photos').objectStore('photos').get('sample-1'));
  return it.photos.length === 2 && it.photos.every(u => u.includes('/__file/')) && p.list.every(x => x.f && !(x instanceof Blob)); }));
ok('أخطاء الكونسول', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); server.close();
console.log(results.join('\n')); console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0);

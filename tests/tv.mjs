// اختبار واجهة الشاشة + المزامنة من الجوال:
// - «الشاشة»: سياق متصفح بجسر أصلي وهمي (أندرويد، نظام ملفات، خادم المزامنة) على 960×540 و1920×1080.
// - «الجوال»: سياق متصفح منفصل (تخزين منفصل) يستورد ملف النسخة التجريبي ثم يربط ويزامن.
//   طلبات الجوال تُوجَّه إلى الشاشة: الصور تُكتب في نظام ملفات الشاشة (كما يفعل ShellPlugin.java)، والباقي إلى Sync.handle.
// يحتاج tests/out/sample-backup.json (يصنعه tests/run.mjs).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www'), out = join(root, 'tests', 'out'), sampleFile = join(out, 'sample-backup.json');
if (!existsSync(sampleFile)) { console.error('شغّل tests/run.mjs أولًا'); process.exit(2); }
mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };
const files = new Map();
const MOCK = `(() => {
  const call = async (op, a) => { const r = await fetch('/__fs', { method: 'POST', body: JSON.stringify({ op, ...a }) }); const j = await r.json(); if (j.error) throw new Error(j.error); return j; };
  const Filesystem = {}; ['mkdir', 'writeFile', 'appendFile', 'readFile', 'readdir', 'deleteFile', 'stat', 'copy', 'getUri'].forEach(op => Filesystem[op] = a => call(op, a));
  Filesystem.requestPermissions = async () => ({ publicStorage: 'granted' });
  const L = {}; window.__shellListeners = L;
  window.Native = { isNative: true, platform: 'android', Filesystem, Directory: { Library: 'LIBRARY', Documents: 'DOCUMENTS', Data: 'DATA', Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' },
    Capacitor: { convertFileSrc: u => u.replace('file:///mock/', location.origin + '/__file/') },
    CapacitorHttp: { get: async () => ({ status: 404, data: '' }) }, App: { addListener: () => {}, minimizeApp: () => { window.__minimized = (window.__minimized || 0) + 1; }, getLaunchUrl: async () => null }, Share: { share: async () => {} },
    Shell: { info: async () => ({ tv: true }), secure: async () => {}, addListener: (n, f) => { L[n] = f; }, startServer: async a => { window.__srv = a; return { ip: '192.168.1.50', port: 8765 }; },
      address: async () => ({ ip: '192.168.1.50', port: 8765 }), setToken: async a => { window.__srv.token = a.token; }, respond: async () => {} } };
})();`;
const NATIVE_JS = readFileSync(join(www, 'native.js'), 'utf8');
const server = http.createServer(async (q, r) => {
  const url = decodeURIComponent(q.url.split('?')[0]);
  if (url === '/native.js') { r.writeHead(200, { 'Content-Type': MIME['.js'] }); r.end(/[?&]mock=1/.test(q.headers.referer || '') ? NATIVE_JS + '\n' + MOCK : NATIVE_JS); return; }
  if (url.startsWith('/__file/')) { const f = files.get(url.slice(8)); if (!f) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(url)] || 'application/octet-stream' }); r.end(f.buf); return; }
  if (url === '/__fs') { let body = ''; for await (const c of q) body += c; const a = JSON.parse(body), key = (d, p) => d + '/' + String(p).replace(/^\/+/, ''); let o = {};
    try { const k = key(a.directory, a.path || '');
      if (a.op === 'writeFile') files.set(k, { buf: a.encoding ? Buffer.from(a.data, 'utf8') : Buffer.from(a.data, 'base64'), mtime: Date.now() });
      else if (a.op === 'appendFile') { const f = files.get(k); files.set(k, { buf: Buffer.concat([f ? f.buf : Buffer.alloc(0), Buffer.from(a.data, 'utf8')]), mtime: Date.now() }); }
      else if (a.op === 'readFile') { const f = files.get(k); if (!f) throw new Error('File does not exist'); o = { data: f.buf.toString(a.encoding ? 'utf8' : 'base64') }; }
      else if (a.op === 'readdir') { const pre = k.replace(/\/+$/, '') + '/'; const names = new Map(); for (const [n, f] of files) if (n.startsWith(pre)) names.set(n.slice(pre.length).split('/')[0], f.mtime); o = { files: [...names].map(([name, mtime]) => ({ name, mtime })) }; }
      else if (a.op === 'deleteFile') { if (!files.delete(k)) throw new Error('File does not exist'); }
      else if (a.op === 'stat') { const pre = k.replace(/\/+$/, ''); if (!files.has(pre) && ![...files.keys()].some(n => n.startsWith(pre + '/'))) throw new Error('File does not exist'); }
      else if (a.op === 'copy') { const f = files.get(key(a.directory, a.from)); if (!f) throw new Error('File does not exist'); files.set(key(a.toDirectory || a.directory, a.to), { buf: f.buf, mtime: Date.now() }); }
      else if (a.op === 'getUri') o = { uri: 'file:///mock/' + k };
    } catch (e) { o = { error: e.message }; }
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); return; }
  const p = join(www, url.replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const results = []; let failed = 0; process.on('exit', c => { if (c) console.log(results.join('\n')); });
const ok = (n, c, x = '') => { results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) failed++; };
let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
const settle = (p, ms = 350) => p.waitForTimeout(ms);
const act = p => p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.k || a.tagName + '#' + a.id) : ''; });

async function tvPage(vp, dpr) { const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, locale: 'ar' }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR|404|Failed to load/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + '?tv=1&mock=1'); await page.waitForSelector('body.ready', { state: 'attached', timeout: 12000 }).catch(e => { console.log('BOOT FAIL', errors); throw e; }); await page.waitForFunction(() => window.TVApp && TVApp.on); await settle(page, 600); return { ctx, page, errors }; }

// ================= 1) الشاشة فارغة → صفحة الاتصال =================
const tv = await tvPage({ width: 960, height: 540 }, 2); const T = tv.page;
await T.waitForFunction(() => TVApp.page === 'sync', null, { timeout: 5000 }).catch(() => {});
ok('الشاشة الفارغة تفتح صفحة «اتصال بالجوال» تلقائيًا', await T.evaluate(() => TVApp.page === 'sync' && /192\.168\.1\.50/.test(document.querySelector('.sy-info').textContent)));
ok('خادم المزامنة شغّال برمز من 6 أرقام', await T.evaluate(() => window.__srv && /^\d{6}$/.test(window.__srv.token)));
await T.screenshot({ path: join(out, 'tv-00-connect.png') });
const code = await T.evaluate(() => window.__srv.token);

// ================= 2) الجوال: استيراد ثم ربط ومزامنة =================
const phCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' }); const Ph = await phCtx.newPage(); const phErr = [];
Ph.on('pageerror', e => phErr.push(e.message));
await Ph.goto(base); await Ph.waitForSelector('body.ready'); await Ph.evaluate(() => document.getElementById('nHome').click());
await Ph.click('#bSet'); await Ph.setInputFiles('#fImp', sampleFile); await Ph.waitForSelector('#ovAsk.show #aOk'); await Ph.click('#aOk');
await Ph.waitForFunction(() => items.length >= 17 && !document.querySelector('#busy.show')); await settle(Ph, 2600); await Ph.waitForSelector('body.ready');
let calls = { photo: 0, other: 0 }, badCode = 0, target = null;
await Ph.exposeFunction('__tvCall', async (method, url, body) => { const u = new URL(url); const k = u.searchParams.get('k');
  const T2 = target || T; if (k !== await T2.evaluate(() => window.__srv.token)) { badCode++; return { status: 401, data: { error: 'code' } }; }
  if (u.pathname.startsWith('/photo/')) { calls.photo++; files.set('LIBRARY/photos/' + u.pathname.slice(7), { buf: Buffer.from(body, 'base64'), mtime: Date.now() }); return { status: 200, data: { ok: true } }; }
  calls.other++; const r = await T2.evaluate(req => Sync.handle(req), { method, path: u.pathname, query: u.search.slice(1), body: body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body)) });
  return { status: r.status, data: JSON.parse(r.body) }; });
await Ph.evaluate(() => { Sync.transport = async (m, url, body) => { const r = await window.__tvCall(m, url, body); if (r.status >= 400) throw Object.assign(new Error(r.data.error), { status: r.status }); return r.data; }; });
const wrong = await Ph.evaluate(async () => { try { await Sync.pair('192.168.1.50', '000000'); return 'paired'; } catch (e) { return e.message; } });
ok('رمز خاطئ يُرفض برسالة واضحة', /الرمز غير صحيح/.test(wrong), wrong.slice(0, 60));
await Ph.evaluate(c => Sync.pair('192.168.1.50', c), code);
const t0 = Date.now(); const r1 = await Ph.evaluate(() => Sync.syncNow(false)); const ms = Date.now() - t0;
ok('المزامنة الأولى أرسلت كل الممثلات والصور', r1.sent === 17 && r1.photos >= 40, JSON.stringify(r1) + ' · ' + ms + 'ms · photo calls ' + calls.photo);
await settle(T, 900);
const tvState = await T.evaluate(async () => { const urls = items.flatMap(i => [...(i.photos || []), i.thumb].filter(Boolean)); let bad = 0;
  await Promise.all(urls.map(u => new Promise(r => { const im = new Image(); im.onload = r; im.onerror = () => { bad++; r(); }; im.src = u; })));
  return { n: items.length, urls: urls.length, bad, file: urls.every(u => u.includes('/__file/')), lists: lists.length, wlists: wlists.length, works: wAll().length }; });
ok('الشاشة استقبلت المكتبة كاملة بصورها (ملفات تُحمَّل)', tvState.n === 17 && tvState.bad === 0 && tvState.file && tvState.lists === 2 && tvState.wlists === 1, JSON.stringify(tvState));
const r2 = await Ph.evaluate(() => Sync.syncNow(false));
ok('مزامنة ثانية بلا تغييرات لا ترسل شيئًا', r2.sent === 0 && r2.photos === 0, JSON.stringify(r2));
// تعديل وحذف في الجوال → يصلان للشاشة
await Ph.evaluate(async () => { const a = items.find(i => i.id === 'sample-2'); a.rating = 5; a.fav = true; await save(a); const d = items.find(i => i.id === 'sample-16'); items = items.filter(i => i !== d); await DB.del(d.id); });
const r3 = await Ph.evaluate(() => Sync.syncNow(false)); await settle(T, 500);
ok('تعديل وحذف من الجوال يصلان للشاشة (والصور لا تُعاد)', r3.sent === 1 && r3.deleted === 1 && r3.photos === 0 && await T.evaluate(() => items.length === 16 && items.find(i => i.id === 'sample-2').rating === 5), JSON.stringify(r3));

// ================= 3) واجهة الشاشة بالريموت =================
await T.evaluate(() => TVApp.go('home', {}, false)); await settle(T, 700);
await T.screenshot({ path: join(out, 'tv-01-home.png') });
ok('الرئيسية: لوحة معلومات + أرفف', await T.evaluate(() => !!document.querySelector('#tvHero h1') && document.querySelectorAll('#tv .tv-rows .tv-sec').length >= 5));
ok('التركيز يبدأ على أول بطاقة', /^(p|w):/.test(await act(T)), await act(T));
const k0 = await act(T); await T.keyboard.press('ArrowLeft'); await settle(T, 250); const k1 = await act(T);
ok('يسار: العنصر التالي في نفس الرف', k1 !== k0 && /^(p|w):/.test(k1), k0 + ' → ' + k1);
await T.keyboard.press('ArrowLeft'); await T.keyboard.press('ArrowLeft'); await settle(T, 250); const kRow1 = await act(T);
await T.keyboard.press('ArrowDown'); await settle(T, 300); const kDown = await act(T);
const rowOf = k => T.evaluate(k => { const e = document.querySelector(`#tv [data-k="${CSS.escape(k)}"]`); const s = e && e.closest('.tv-sec'); return s ? s.dataset.row : ''; }, k);
ok('أسفل: الرف التالي', (await rowOf(kDown)) !== (await rowOf(kRow1)) && /^(p|w):/.test(kDown), (await rowOf(kRow1)) + ' → ' + (await rowOf(kDown)));
await T.keyboard.press('ArrowUp'); await settle(T, 300);
ok('أعلى: يرجع لنفس موضعه في الرف السابق', (await act(T)) === kRow1, await act(T));
ok('لوحة المعلومات تتبع البطاقة المركَّزة', await T.evaluate(() => { const a = document.activeElement, h = document.querySelector('#tvHero h1'); const i = a.dataset.p && items.find(x => x.id === a.dataset.p); const g = a.dataset.w && wAll().find(x => x.key === a.dataset.w); return !!h && h.textContent === (i ? i.name : g ? g.t : ''); }));
ok('العنصر المركَّز ظاهر بالكامل', await T.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
for (let k = 0; k < 40; k++) await T.keyboard.press('ArrowRight'); await settle(T, 300);
ok('يمين من أول الرف: القائمة الجانبية', await T.evaluate(() => !!document.activeElement.closest('.tv-nav')), await act(T));
await T.screenshot({ path: join(out, 'tv-02-nav.png') });
await T.keyboard.press('ArrowLeft'); await settle(T, 250);
ok('يسار من القائمة: يرجع لآخر بطاقة كنت عليها', /^(p|w):/.test(await act(T)), await act(T));
// صفحة ممثلة
await T.evaluate(() => { const e = document.querySelector('#tv .tvp[data-p]'); e.focus(); }); await T.keyboard.press('Enter'); await settle(T, 700);
ok('OK على ممثلة يفتح صفحتها', await T.evaluate(() => TVApp.page === 'person' && !!document.querySelector('.pp-info h1')));
await T.screenshot({ path: join(out, 'tv-03-person.png') });
for (let k = 0; k < 3; k++) await T.keyboard.press('ArrowDown'); await settle(T, 400);
ok('أسفل داخل صفحة الممثلة يصل للصور/الأعمال', await T.evaluate(() => { const a = document.activeElement; return !!a.closest('[data-row="ph"],[data-row="pw"],[data-row="ps"]'); }), await act(T));
await T.screenshot({ path: join(out, 'tv-04-person-rows.png') });
// نافذة عمل: تعليمه مشاهَدًا
await T.evaluate(() => { const e = document.querySelector('#tv [data-row="pw"] .tvw'); e.focus(); }); const wk = await T.evaluate(() => document.activeElement.dataset.w);
await T.keyboard.press('Enter'); await settle(T, 500);
ok('OK على عمل يفتح نافذته والتركيز داخلها', await T.evaluate(() => !document.getElementById('tvLayer').hidden && !!document.activeElement.closest('#tvLayer')));
await T.screenshot({ path: join(out, 'tv-05-work.png') });
const seenBefore = await T.evaluate(k => !!wAll().find(g => g.key === k).seen, wk);
await T.evaluate(() => document.querySelector('#tvLayer [data-wa="seen"]').focus()); await T.keyboard.press('Enter'); await settle(T, 400);
ok('تعليم العمل مشاهَدًا من الشاشة', await T.evaluate(k => !!wAll().find(g => g.key === k).seen, wk) !== seenBefore);
await T.keyboard.press('Escape'); await settle(T, 300);
ok('رجوع يغلق النافذة ويعيد التركيز للبطاقة', await T.evaluate(k => document.getElementById('tvLayer').hidden && document.activeElement.dataset.w === k, wk));
await T.keyboard.press('Escape'); await settle(T, 500);
ok('رجوع من صفحة الممثلة يعود للرئيسية', await T.evaluate(() => TVApp.page === 'home'));
// تعديل الشاشة يرجع للجوال
const dbg = { tv: await T.evaluate(k => { const g = wAll().find(x => x.key === k); return g.who.map(i => [i.id, Sync.sig(i), i.updated, g.seen]); }, wk), ph: await Ph.evaluate(k => { const g = wAll().find(x => x.key === k); return g.who.map(i => [i.id, Sync.sig(i), i.updated, g.seen, JSON.parse(localStorage.getItem('vkte_sync_base') || '{}')[i.id]]); }, wk) };
const r4 = await Ph.evaluate(() => Sync.syncNow(false));
ok('تعديل الشاشة (مشاهدة) يصل للجوال (بالمزامنة التلقائية أو اليدوية)', await Ph.evaluate(k => !!wAll().find(g => g.key === k).seen, wk) !== seenBefore, JSON.stringify(r4) + ' ' + JSON.stringify(dbg));
// تعارض: الشاشة تعدّل التقييم، والجوال يحفظ شيئًا خلفيًا (عدّاد الزيارات) لنفس الممثلة → يجب ألا يضيع تعديل الشاشة
await T.evaluate(async () => { const i = items.find(x => x.id === 'sample-3'); i.rating = 1; i.updated = Date.now(); await save(i); });
await Ph.evaluate(async () => { const i = items.find(x => x.id === 'sample-3'); i.views = (i.views || 0) + 5; await save(i); });
await Ph.evaluate(() => Sync.syncNow(false)); await settle(T, 300);
ok('تعديل الشاشة لا يضيع حين يحفظ الجوال شيئًا خلفيًا لنفس الممثلة', await Ph.evaluate(() => items.find(x => x.id === 'sample-3').rating === 1) && await T.evaluate(() => items.find(x => x.id === 'sample-3').rating === 1));
// تعارض حقيقي: الجوال يعدّل بعد الشاشة → الأحدث يفوز
await T.evaluate(async () => { const i = items.find(x => x.id === 'sample-3'); i.rating = 2; i.updated = Date.now(); await save(i); });
await Ph.waitForTimeout(30); await Ph.evaluate(async () => { const i = items.find(x => x.id === 'sample-3'); i.rating = 4.5; i.updated = Date.now(); await save(i); });
await Ph.evaluate(() => Sync.syncNow(false)); await settle(T, 300);
ok('تعارض حقيقي: التعديل الأحدث يفوز على الجهازين', await T.evaluate(() => items.find(x => x.id === 'sample-3').rating === 4.5) && await Ph.evaluate(() => items.find(x => x.id === 'sample-3').rating === 4.5));
// المكتبة والأعمال والبحث والإعدادات عبر القائمة
const goNav = async k => { await T.evaluate(k => { const b = document.querySelector(`#tv .tv-nav [data-go="${k}"]`); b.focus(); }, k); await T.keyboard.press('Enter'); await settle(T, 700); };
await goNav('lib'); await T.screenshot({ path: join(out, 'tv-06-library.png') });
ok('المكتبة: شبكة كل الممثلات', await T.evaluate(() => document.querySelectorAll('#tv .tv-grid .tvp').length === items.length));
await T.keyboard.press('ArrowDown'); await T.keyboard.press('ArrowDown'); await settle(T, 300); const g0 = await act(T); await T.keyboard.press('ArrowDown'); await settle(T, 300);
ok('أسفل داخل الشبكة ينزل صفًّا', (await act(T)) !== g0 && /^p:/.test(await act(T)), g0 + ' → ' + await act(T));
await goNav('works'); await T.screenshot({ path: join(out, 'tv-07-works.png') });
ok('الأعمال: تبويبات + شبكة', await T.evaluate(() => document.querySelectorAll('#tv [data-wt]').length === 6 && document.querySelectorAll('#tv .tv-grid .tvw').length > 5));
await T.evaluate(() => document.querySelector('#tv [data-wt="seen"]').focus()); await T.keyboard.press('Enter'); await settle(T, 500);
ok('تبويب «شاهدتها» يعرض المشاهَد فقط', await T.evaluate(() => [...document.querySelectorAll('#tv .tv-grid .tvw')].every(e => e.classList.contains('seen'))));
await goNav('search'); await T.evaluate(() => document.getElementById('tvQ').focus()); await T.keyboard.type('نموذج 1'); await settle(T, 600);
ok('البحث يعرض النتائج أثناء الكتابة', await T.evaluate(() => document.querySelectorAll('#tvRes .tvp').length >= 5));
await T.keyboard.press('ArrowDown'); await settle(T, 300); ok('أسفل من حقل البحث ينزل للنتائج', /^p:/.test(await act(T)), await act(T));
await T.screenshot({ path: join(out, 'tv-08-search.png') });
await goNav('set'); await T.screenshot({ path: join(out, 'tv-09-settings.png') });
ok('صفحة الإعدادات تفتح وتعرض رقم الإصدار', await T.evaluate(() => TVApp.page === 'set' && /الإصدار/.test(document.querySelector('.tv-about').textContent) && !!APP_VER));
ok('رقم الإصدار ظاهر في القائمة الجانبية', await T.evaluate(() => /^v\d/.test(document.querySelector('.tv-ver').textContent)));
await goNav('sync'); await T.screenshot({ path: join(out, 'tv-10-connect-after.png') });
ok('صفحة الاتصال تعرض آخر مزامنة', await T.evaluate(() => /آخر مزامنة/.test(document.querySelector('.sy-info').textContent)));
// الرجوع حتى الخروج
await goNav('home'); await T.evaluate(() => { window.__minimized = 0; });
for (let k = 0; k < 4; k++) { await T.keyboard.press('Escape'); await settle(T, 250); }
ok('رجوع من الرئيسية: القائمة ثم الخروج', await T.evaluate(() => window.__minimized >= 1));
// عرض الشرائح بالريموت
await T.evaluate(() => Gallery.playLibrary()); await settle(T, 800); const s0 = await T.evaluate(() => document.querySelector('#lbx .lc').textContent);
await T.keyboard.press('ArrowLeft'); await settle(T, 500); ok('الأسهم تقلّب الشرائح', await T.evaluate(() => document.querySelector('#lbx .lc').textContent) !== s0);
await T.keyboard.press('Escape'); await settle(T, 300); ok('رجوع يغلق عرض الشرائح', await T.evaluate(() => !Gallery.isOpen()));
ok('أخطاء الكونسول (الشاشة)', tv.errors.length === 0, tv.errors.slice(0, 3).join(' | '));
ok('أخطاء الكونسول (الجوال)', phErr.length === 0, phErr.slice(0, 3).join(' | '));

// ================= 4) شاشة 1920×1080: نفس التخطيط =================
const big = await tvPage({ width: 1920, height: 1080 }, 1); const B = big.page; target = B;
const r5 = await Ph.evaluate(c => Sync.pair('192.168.1.50', c).then(() => Sync.syncNow(false)), await B.evaluate(() => window.__srv.token));
ok('شاشة ثانية: الربط والمزامنة من جديد', await B.evaluate(() => items.length) === 16 && await Ph.evaluate(() => Sync.cfg().err === ''), JSON.stringify(r5));
await B.evaluate(() => TVApp.go('home', {}, false)); await settle(B, 800);
await B.screenshot({ path: join(out, 'tv-11-home-1080.png') });
ok('1080p: الرئيسية تعمل', await B.evaluate(() => items.length === 16 && document.querySelectorAll('#tv .tv-rows .tv-sec').length >= 5 && /^(p|w):/.test(document.activeElement.dataset.k || '')));
await B.evaluate(() => TVApp.go('person', { id: 'sample-1' })); await settle(B, 700); await B.screenshot({ path: join(out, 'tv-12-person-1080.png') });
ok('أخطاء الكونسول (1080p)', big.errors.length === 0, big.errors.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log(results.join('\n')); console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0);

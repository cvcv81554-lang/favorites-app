// اختبارات v35: الحركة والانتقالات، أداء الاستديو، تحميل صور الممثلة عند الاقتراب،
// الجدولة الذكية للتحديث التلقائي، حالات التحميل وعدم الاتصال، لون التمييز في التلفاز.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), www = join(root, 'www'), out = join(root, 'tests', 'out'); mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((q, r) => { const p = join(www, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const results = []; let failed = 0;
const ok = (n, c, x = '') => { results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) failed++; };
let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
await ctx.route('https://**', r => r.fulfill({ status: 404, body: '' }));
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR|404|Failed to load/.test(m.text())) errors.push(m.text()); });
await page.goto(base); await page.waitForSelector('body.ready');

const thumb = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 60; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#835'; x.fillRect(0, 0, 60, 80); return c.toDataURL('image/jpeg', .6); });
await page.evaluate(async t => {
  const mk = (id, name, birth, cc, photos) => ({ id, name, birth, country: cc, photos, thumb: t, works: [], tags: [], lists: [], rating: 4, added: Date.now(), updated: Date.now() });
  const P = mk('m1', 'Motion Sample', '1992-02-02', 'US', Array.from({ length: 10 }, (_, i) => t + '#' + i));
  const Q = mk('m2', 'Second Sample', '1993-03-03', 'CZ', [t]);
  items.push(P, Q); await save([P, Q]); render(true); }, thumb);

// ---------- 1) الحركة ----------
ok('وحدة الحركة محمّلة', await page.evaluate(() => typeof Motion !== 'undefined' && typeof Motion.zoomFrom === 'function'));
ok('رموز المدد والمنحنيات معرّفة في :root', await page.evaluate(() => { const c = getComputedStyle(document.documentElement); return c.getPropertyValue('--dur-3').trim() === '300ms' && !!c.getPropertyValue('--ease-spring').trim(); }));
await page.evaluate(() => closeOv('ovHome'));
await page.evaluate(() => { openDetail('m1'); }); await page.waitForTimeout(900);
const carState = await page.evaluate(() => { const im = [...document.querySelectorAll('#car img')]; return { n: im.length, loaded: im.filter(x => x.getAttribute('src')).length }; });
ok('صفحة الممثلة: 10 صور ولا تُحمَّل كلها عند الفتح (الحالية والتاليتان فقط)', carState.n === 10 && carState.loaded >= 1 && carState.loaded <= 3, JSON.stringify(carState));
await page.evaluate(() => { const c = document.getElementById('car'); const im = [...c.querySelectorAll('img')]; im[6].scrollIntoView({ inline: 'center', block: 'nearest' }); c.dispatchEvent(new Event('scroll')); });
await page.waitForTimeout(1500);
const carLater = await page.evaluate(() => [...document.querySelectorAll('#car img')].filter(x => x.getAttribute('src')).length);
ok('التمرير في الصور يحمّل القريبة منها', carLater > carState.loaded, carState.loaded + '→' + carLater);
const zoomed = await page.evaluate(async () => { const img = document.querySelector('#car img[src]'); img.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); Gallery.open([img.getAttribute('src')], 0); const st = document.querySelector('#lbx .lstage'); const a = st.getAnimations().length; await new Promise(r => setTimeout(r, 500)); const after = st.getAnimations().length; Gallery.close(); return { a, after }; });
ok('عارض الصور يبدأ بحركة تكبير من الصورة المضغوطة ثم تنتهي', zoomed.a === 1 && zoomed.after === 0, JSON.stringify(zoomed));
const noZoom = await page.evaluate(() => { document.documentElement.classList.add('nomotion'); const img = document.querySelector('#car img[src]'); img.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); Gallery.open([img.getAttribute('src')], 0); const a = document.querySelector('#lbx .lstage').getAnimations().length; Gallery.close(); document.documentElement.classList.remove('nomotion'); return a; });
ok('«بلا حركة» يلغي حركة التكبير', noZoom === 0);
await page.evaluate(() => closeOv('ovDetail'));
const sheet = await page.evaluate(async () => { askShow('<p>x</p>', () => {}); await new Promise(r => setTimeout(r, 450)); const o = document.getElementById('ovAsk'); const shown = getComputedStyle(o).opacity; o.classList.remove('show'); const pe = getComputedStyle(o).pointerEvents; await new Promise(r => setTimeout(r, 500)); return { shown, pe, end: getComputedStyle(o).display }; });
ok('الورقة السفلية تظهر كاملة، ولا تحجب اللمس أثناء خروجها، ثم تختفي', sheet.shown === '1' && sheet.pe === 'none' && sheet.end === 'none', JSON.stringify(sheet));
const pg = await page.evaluate(async () => { document.getElementById('nWorks').click(); await new Promise(r => requestAnimationFrame(r)); const an = getComputedStyle(document.querySelector('#ovWorks .modal')).animationName; document.getElementById('nHome').click(); await new Promise(r => requestAnimationFrame(r)); return { an, closed: getComputedStyle(document.getElementById('ovWorks')).display }; });
ok('الصفحة تدخل بحركة خفيفة وتُغلق فورًا', /pgin/.test(pg.an) && pg.closed === 'none', JSON.stringify(pg));

// ---------- 2) أداء الاستديو ----------
const st = await page.evaluate(async () => { await Studio._test.load(); const I = Studio._test.IMG; const now = Date.now();
  for (let i = 0; i < 1500; i++) I.set('v' + i, { id: 'v' + i, pid: i % 2 ? 'm1' : 'm2', url: 'https://img.test/' + i + '.jpg', src: 'stash', kind: ['portrait', 'still', 'archive'][i % 3], w: 1200, h: 1800, pub: (2000 + i % 25) + '-01-01', found: now - i, albums: [], dh: '0'.repeat(16) });
  I.set('orph', { id: 'orph', pid: 'nobody', url: 'https://img.test/o.jpg', src: 'stash', kind: 'portrait', w: 1, h: 1, found: now, albums: [] });
  const t = performance.now(); await Studio.open({ v: 'home' }); const ms = performance.now() - t;
  const rare = Studio._test.SEL.rare(), best = Studio._test.SEL.best();
  const sortedR = rare.every((x, k) => !k || Studio._test.rarity(rare[k - 1]) >= Studio._test.rarity(x));
  const sub = document.querySelector('#mStudio').textContent;
  closeOv('ovStudio'); return { ms: Math.round(ms), n: rare.length, sortedR, bestN: best.length, sub: /1500 صورة · 2 ممثلة/.test(sub) }; });
ok('الاستديو: 1500 صورة والعدّ صحيح (الصورة اليتيمة مستبعدة)', st.n === 1500 && st.bestN === 1500 && st.sub, JSON.stringify(st));
ok('الاستديو: «النادرة» مرتبة تنازليًا بعد التحسين', st.sortedR);
ok('الاستديو يفتح 1500 صورة في أقل من 1.5 ثانية', st.ms < 1500, st.ms + 'ms');
const pmap = await page.evaluate(async () => { const R = { id: 'm3', name: 'Third Sample', birth: '1990-01-01', photos: [], works: [], tags: [], lists: [], added: Date.now(), updated: Date.now() }; items.push(R); await save([R]); Studio._test.IMG.set('w3', { id: 'w3', pid: 'm3', url: 'https://img.test/w3.jpg', src: 'stash', kind: 'portrait', w: 1200, h: 1800, found: Date.now(), albums: [] }); return Studio._test.SEL.added().some(x => x.id === 'w3'); });
ok('الاستديو: ممثلة جديدة تظهر صورها فورًا (خريطة الممثلات تتحدث)', pmap);

// ---------- 3) الجدولة ----------
ok('التحديث التلقائي افتراضيًا: Wi-Fi فقط', await page.evaluate(() => Sched.mode() === 'wifi'));
ok('الوضع «متوقف» يمنع التحديث التلقائي', await page.evaluate(async () => { Sched.setMode('off'); const r = await Sched.block(); Sched.setMode('wifi'); return r === 'off'; }));
ok('وضع غير صالح لا يُقبل', await page.evaluate(() => { Sched.setMode('x'); return Sched.mode() === 'wifi'; }));
await ctx.setOffline(true); await page.waitForTimeout(300);
const offl = await page.evaluate(async () => ({ b: await Sched.block(), cls: document.documentElement.classList.contains('offline') }));
ok('بلا اتصال: لا تحديث تلقائي، وتظهر حالة «بدون اتصال»', offl.b === 'offline' && offl.cls, JSON.stringify(offl));
await page.evaluate(() => { Studio.open({ v: 'home' }); }); await page.waitForTimeout(400);
ok('الاستديو بلا اتصال يذكر أنه يعرض المحفوظ', await page.evaluate(() => /بدون اتصال/.test(getComputedStyle(document.getElementById('mStudio'), '::before').content)));
await page.evaluate(() => closeOv('ovStudio'));
await ctx.setOffline(false); await page.waitForTimeout(300);
ok('عودة الاتصال تزيل الحالة', await page.evaluate(() => !document.documentElement.classList.contains('offline')));
ok('اختيار التحديث التلقائي في إعدادات الاستديو ويُحفظ', await page.evaluate(async () => { await Studio.open({ v: 'settings' }); const s = document.querySelector('#mStudio select[data-bg]'); if (!s) { closeOv('ovStudio'); return false; } s.value = 'any'; s.dispatchEvent(new Event('change', { bubbles: true })); const r = LS.get('vkte_bg') === 'any'; Sched.setMode('wifi'); closeOv('ovStudio'); return r; }));
ok('سجل قرارات الجدولة محفوظ ومحدود (30)', await page.evaluate(async () => { for (let i = 0; i < 40; i++) await Sched.ok('t'); const l = Sched._log(); return l.length === 30 && l[29].k === 't'; }));
ok('إعداد التحديث التلقائي ضمن النسخة الاحتياطية', await page.evaluate(() => Backup.PREF_KEYS.includes('vkte_bg')));
ok('التجهيز المسبق لـ«اكتشف» لا يعمل بلا مفاتيح (لا طلبات)', await page.evaluate(async () => { const before = LS.get('vkte_bg_disc', ''); await Sched.discoverPre(); return LS.get('vkte_bg_disc', '') === before; }));

// ---------- 4) اكتشف: هيكل التحميل والأحرف الأولى ----------
const dxc = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = Discover._t.card({ name: 'Anna Bell', img: 'https://img.test/a.jpg', cc: 'US', k: 'anna bell' }); const n = document.createElement('div'); n.innerHTML = Discover._t.card({ name: 'Cara Dee', cc: 'US', k: 'cara dee' }); return { ld: !!d.querySelector('.dx-ph.ld'), ini: (d.querySelector('.ini') || {}).textContent || '', noImg: !n.querySelector('.dx-ph.ld') && (n.querySelector('.ini') || {}).textContent }; });
ok('بطاقة «اكتشف»: هيكل تحميل حتى تصل الصورة، وأحرف الاسم بديلًا', dxc.ld && dxc.ini === 'AB' && dxc.noImg === 'CD', JSON.stringify(dxc));

// ---------- 5) التلفاز يتبع لون التمييز ----------
const tvc = await page.evaluate(() => { document.documentElement.dataset.accent = 'violet'; const d = document.createElement('div'); d.id = 'tv-probe'; d.style.cssText = ''; document.body.appendChild(d); const tv = document.getElementById('tv') || d; if (tv === d) d.id = 'tv'; const v = getComputedStyle(tv).getPropertyValue('--tv-acc2').trim(); d.remove(); document.documentElement.dataset.accent = LS.get('vkte_accent', 'copper'); return v; });
ok('ألوان واجهة التلفاز تتبع اللون المختار', tvc === '#cbbcff', tvc);

// ---------- 6) ممثلة جديدة تبدأ بحث الاستديو حتى لو لم يُفتح الاستديو (إصلاح مراجعة) ----------
{
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' });
  await ctx2.route('https://**', r => r.fulfill({ status: 404, body: '' }));
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push(e.message));
  await p2.goto(base); await p2.waitForSelector('body.ready');
  const pre = await p2.evaluate(() => Studio._test.S);
  await p2.evaluate(async () => { const N = { id: 'nw1', name: 'New Adult', birth: '1995-05-05', photos: [], works: [], tags: [], lists: [], added: Date.now(), updated: Date.now() }; items.push(N); await save([N]); });
  await p2.waitForFunction(() => Studio._test.S && Studio._test.KV.perfAt && Studio._test.KV.perfAt.nw1, null, { timeout: 30000 }).catch(() => {});
  const post = await p2.evaluate(() => ({ S: !!Studio._test.S, at: !!(Studio._test.KV.perfAt || {}).nw1 }));
  ok('ممثلة جديدة: يبدأ بحث الاستديو تلقائيًا دون فتحه', pre == null && post.S && post.at, JSON.stringify(post));
  await p2.evaluate(async () => { const M = { id: 'mn1', name: 'Minor Test', birth: '2015-01-01', photos: [], works: [], tags: [], lists: [], added: Date.now(), updated: Date.now() }; items.push(M); await save([M]); });
  await p2.waitForTimeout(11000);
  ok('بوابة +18: سجل قاصر لا يبدأ أي بحث', await p2.evaluate(() => !(Studio._test.KV.perfAt || {}).mn1));
  await ctx2.close();
}

const sz = await page.evaluate(() => ({ a: Studio._test.sized('https://stashdb.org/images/ab/cd/abcd', 600), b: Studio._test.sized('https://evil.example/images/x', 600), c: Studio._test.thumb({ url: 'https://stashdb.org/images/x' }), d: Studio._test.thumb({ url: 'https://cdn.theporndb.net/x.jpg', prev: 'https://cdn.theporndb.net/p.jpg' }), e: Studio._test.sized('https://stashdb.org/images/x?size=300', 600) }));
ok('الاستديو: صور StashDB في الشبكات بمقاس 600 (معامل رسمي)، وغيرها كما هي', sz.a === 'https://stashdb.org/images/ab/cd/abcd?size=600' && sz.b === '' && sz.c === 'https://stashdb.org/images/x?size=600' && sz.d === 'https://cdn.theporndb.net/p.jpg' && sz.e === '', JSON.stringify(sz));
const srch = await page.evaluate(async () => { const q = document.getElementById('q'); const go = async v => { q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 400)); return [...document.querySelectorAll('#grid .card')].map(c => c.dataset.id); };
  const a = await go('zzworkx'); const it = items.find(x => x.id === 'm2'); it.works.push({ t: 'ZZWorkX Title', s: 'S' }); await save(it); const b = await go('zzworkx'); it.works[0].t = 'Renamed Q'; await save(it); const c = await go('zzworkx'); await go(''); return { a: a.length, b: b.includes('m2'), c: c.includes('m2') }; });
ok('البحث: الذاكرة المؤقتة تتحدث بعد إضافة عمل وتعديل عنوانه', srch.a === 0 && srch.b && !srch.c, JSON.stringify(srch));
const dd = await page.evaluate(() => { const T = Studio._test; const mk = (id, dh, w) => ({ id, pid: 'm1', url: 'https://img.test/' + id, src: 'stash', kind: 'portrait', w, h: w * 1.5, found: 1, albums: [], dh });
  T.IMG.set('d1', mk('d1', 'ffffffffffffffff', 2000)); T.IMG.set('d2', mk('d2', 'fffffffffffffff0', 1000)); T.IMG.set('d3', mk('d3', '0000000000000000', 1500));
  T.dedupe(); return { d2: T.IMG.get('d2').dupOf, d1: T.IMG.get('d1').dups, d3: T.IMG.get('d3').dupOf || '', h: T.ham('ffffffffffffffff', 'fffffffffffffff0'), H: T.ham('F0', 'f0') }; });
ok('الاستديو: كشف النسخ بعد التحسين (الأعلى دقة تبقى، والفرق بالبتات صحيح)', dd.d2 === 'd1' && dd.d1 === 1 && dd.d3 === '' && dd.h === 4, JSON.stringify(dd));
ok('لا أخطاء JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(results.join('\n')); console.log(`\n${results.length - failed}/${results.length} نجح`);
await browser.close(); server.close(); process.exit(failed ? 1 : 0);

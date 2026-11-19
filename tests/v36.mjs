// اختبارات v36: الاستديو (جديد منذ زيارتك، الألبومات الذكية)، اكتشف (الفلاتر، «لأنك أضفت»، «جديدة في قائمتك»)،
// التلفاز (مسار «لأنك أضفت»)، قائمة «⋯» في ترويسة المكتبة، توحيد الترويسات، ذاكرة فهرس الأعمال، تحميل الصورة السابقة مسبقًا.
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
const shot = async n => { await page.waitForTimeout(250); await page.screenshot({ path: join(out, 'v36-' + n + '.png') }); };

// ---------- بذر: مكتبة صغيرة + مخزون اقتراحات بأعمار معروفة ----------
await page.evaluate(async () => {
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const yearsAgo = (y, s = -20) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setDate(d.getDate() + s); return ymd(d); };
  LS.set('vkte_key', 'test-tpdb'); LS.set('vkte_stash', 'test-stash');
  const mk = (id, name, added, o = {}) => Object.assign({ id, name, birth: '1992-02-02', country: 'US', fav: true, rating: 5, photos: [], works: [], tags: [], lists: [], added, updated: Date.now() }, o);
  const A = mk('a1', 'Anchor Star', Date.now() - 2 * 864e5, { country: 'CZ' }), B = mk('b1', 'Older Star', Date.now() - 90 * 864e5), B2 = mk('b2', 'Older Two', Date.now() - 95 * 864e5), B3 = mk('b3', 'Older Three', Date.now() - 99 * 864e5);
  items.push(A, B, B2, B3); await save([A, B, B2, B3]); render(true);
  _attrCache.a1 = { t: Date.now(), at: { c: 'CZ', e: 'latin', hr: 'red', ey: 'green', cp: 'small', h: 150, cs: 2010 } };
  [B, B2, B3].forEach(it => { _attrCache[it.id] = { t: Date.now(), at: { c: 'US', e: 'caucasian', hr: 'blonde', ey: 'blue', cp: 'medium', h: 170, cs: 2016 } }; });
  const C = (name, age, o = {}) => Object.assign({ k: norm(name), name, aliases: '', img: '', cc: 'US', country: '', birth: yearsAgo(age), bs: { stash: yearsAgo(age) }, src: 'StashDB', gender: 'female', at: { c: 'US', e: 'caucasian', hr: 'blonde', ey: 'blue', cp: 'medium', h: 165, cs: 2016 }, t: Date.now() - 30 * 864e5 }, o);
  const pool = [C('Near Anchor 23', 23, { cc: 'CZ', at: { c: 'CZ', e: 'latin', hr: 'red', ey: 'green', cp: 'small', h: 150, cs: 2010 } }), C('Near Anchor 31', 31, { cc: 'CZ', at: { c: 'CZ', e: 'latin', hr: 'red', ey: 'green', cp: 'small', h: 151, cs: 2010 } }), C('Fresh Week 27', 27, { t: Date.now() - 864e5 }), C('Young Ok 20', 20), C('Mid 33', 33), C('Old 40', 40), C('No Birth', 0, { birth: '', bs: {} }), C('Minor 17', 17)];
  for (let i = 0; i < 14; i++) pool.push(C('Adult ' + i, 24 + i));
  _recPool = { v: 2, at: Date.now(), round: 1, list: pool }; _recCache = { list: [], at: Date.now() };
});

// ---------- 1) اكتشف: الفلاتر والمسارات الجديدة ----------
await page.evaluate(() => { LS.del('vkte_rec_ui'); LS.del('vkte_dx_f'); document.getElementById('nRecs').click(); });
await page.waitForSelector('#ovRecs.show .dx-lane', { timeout: 10000 });
const lanes = await page.evaluate(() => [...document.querySelectorAll('#ovRecs .dx-lane')].map(s => s.dataset.lane));
ok('اكتشف: شريط الفلاتر ظاهر', await page.evaluate(() => document.querySelectorAll('#ovRecs .dx-flt [data-dxf]').length === 6));
ok('اكتشف: مسار «لأنك أضفت» لآخر ممثلة مضافة', lanes.includes('added') && await page.evaluate(() => /Anchor Star/.test(document.querySelector('[data-lane="added"] h3').textContent) && [...document.querySelectorAll('[data-lane="added"] .dx-pc b')].some(b => /Near Anchor/.test(b.textContent))), lanes.join(','));
ok('اكتشف: «جديدة في قائمتك» تعرض ما دخل هذا الأسبوع ولم يظهر', await page.evaluate(() => { const b = [...document.querySelectorAll('[data-lane="fresh"] .dx-pc b')].map(x => x.textContent); return b.includes('Fresh Week 27'); }));
await shot('discover-filters');
await page.evaluate(() => document.querySelector('#ovRecs [data-dxf="age"][data-val="a"]').click()); await page.waitForTimeout(300);
const agesA = await page.evaluate(() => [...document.querySelectorAll('#ovRecs .dx-pc b')].map(b => b.textContent));
ok('فلتر 18–24: كل الظاهرات في الشريحة، ولا قاصر ولا بلا تاريخ', agesA.length > 0 && agesA.every(n => /Young Ok 20|Near Anchor 23|Adult 0$/.test(n)) && !agesA.some(n => /Minor|No Birth/.test(n)), agesA.join(','));
ok('الفلتر يُحفظ', await page.evaluate(() => JSON.parse(LS.get('vkte_dx_f')).age === 'a'));
await page.evaluate(() => document.querySelector('#ovRecs [data-dxf="age"][data-val="d"]').click()); await page.waitForTimeout(300);
const agesD = await page.evaluate(() => [...document.querySelectorAll('#ovRecs .dx-pc b')].map(b => b.textContent));
ok('فلتر 36+: الأكبر فقط', agesD.length > 0 && agesD.every(n => /Old 40|Adult (1[2-3])/.test(n)), agesD.join(','));
await page.evaluate(() => { const f = { age: '', conf: true }; LS.set('vkte_dx_f', JSON.stringify(f)); RecsUI.repaintAll(); });
const confOnly = await page.evaluate(() => { const all = Discover.ranked(); return { n: Discover._t.applyF(all).length, okAll: Discover._t.applyF(all).every(Discover.confirmed) }; });
ok('«المؤكدة فقط» لا يعرض إلا المؤكدة', confOnly.okAll, JSON.stringify(confOnly));
await page.evaluate(() => { LS.set('vkte_dx_f', JSON.stringify({ age: 'c', conf: true })); RecsUI.repaintAll(); });
ok('تصفية بلا نتائج: رسالة واضحة والفلاتر باقية للتراجع', await page.evaluate(() => { const b = document.querySelector('#ovRecs .rx-body') || document.getElementById('ovRecs'); return !Discover._t.applyF(Discover.ranked()).length ? (/لا اقتراحات بهذه التصفية/.test(b.textContent) && !!b.querySelector('[data-dxf]')) : true; }));
const stab = await page.evaluate(async () => { LS.del('vkte_dx_f'); RecsUI.repaintAll(); const pick = () => JSON.stringify(JSON.parse(LS.get('vkte_rec_picks', '{}')));
  const before = pick(); LS.set('vkte_dx_f', JSON.stringify({ age: 'd', conf: true })); RecsUI.repaintAll(); LS.del('vkte_dx_f'); RecsUI.repaintAll(); return before === pick(); });
ok('الفلتر لا يستبدل اختيار اليوم/الأسبوع المحفوظ', stab);
const srch = await page.evaluate(async () => { LS.set('vkte_dx_f', JSON.stringify({ age: 'd', conf: false })); RecsUI.repaintAll(); const q = document.querySelector('#ovRecs [data-dxq]'); q.value = 'Young Ok'; q.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 700));
  const names = [...document.querySelectorAll('#ovRecs .dx-pc b')].map(b => b.textContent); const q2 = document.querySelector('#ovRecs [data-dxq]'); q2.value = ''; q2.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 700)); LS.del('vkte_dx_f'); RecsUI.repaintAll(); return names; });
ok('البحث بالاسم يجد المرشحة حتى مع فلتر عمر لا يشملها', srch.includes('Young Ok 20'), srch.join(','));
ok('الفلاتر ضمن النسخة الاحتياطية', await page.evaluate(() => Backup.PREF_KEYS.includes('vkte_dx_f')));
await page.evaluate(() => { LS.del('vkte_dx_f'); RecsUI.repaintAll(); closeOv('ovRecs'); });
ok('بوابة +18: القاصر غير موجودة في أي مسار', await page.evaluate(() => !Discover.ranked().some(c => /Minor/.test(c.name))));

// ---------- 2) التلفاز: مسار «لأنك أضفت» ----------
const tv = await page.evaluate(() => { _recCache = { list: Discover.ranked().slice(), at: Date.now() }; return Discover.tvLanes().map(x => x[0]); });
ok('التلفاز: صف «لأنك أضفت» بين صفوف الاقتراحات', tv.some(t => /لأنك أضفت Anchor Star/.test(t)), tv.join(' | '));

// ---------- 3) الاستديو: جديد منذ زيارتك + الألبومات الذكية ----------
const st = await page.evaluate(async () => { const T = Studio._test; await T.load(); const now = Date.now(); const mk = (id, o) => Object.assign({ id, pid: 'a1', url: 'https://img.test/' + id, src: 'stash', kind: 'portrait', w: 1200, h: 1800, pub: '2021-01-01', found: now - 30 * 864e5, albums: [], dh: '-' }, o);
  [mk('s4k', { w: 4000, h: 6000 }), mk('s15', { pub: '2015-05-05' }), mk('s05', { pub: '2005-05-05', kind: 'archive', src: 'wiki' }), mk('stp', { src: 'tpdb', kind: 'still', found: now - 1000 }), mk('stp2', { src: 'tpdbs', kind: 'promo', found: now - 2000 })].forEach(x => T.IMG.set(x.id, x));
  T.SINCE = now - 864e5;
  await Studio.open({ v: 'home' }); const home = document.getElementById('mStudio').textContent;
  const since = T.SEL.since().map(x => x.id);
  return { home: /جديد منذ زيارتك/.test(home), since, k4: T.smartList('4k').map(x => x.id), d2010: T.smartList('d2010').map(x => x.id), d2000: T.smartList('d2000').map(x => x.id), wiki: T.smartList('s-wiki').map(x => x.id), tpdb: T.smartList('s-tpdb').map(x => x.id).sort() }; });
ok('الاستديو: قسم «جديد منذ زيارتك» يعرض ما وُجد بعد آخر زيارة فقط', st.home && st.since.join() === 'stp,stp2', JSON.stringify(st.since));
ok('الألبومات الذكية: الدقة (4K)', st.k4.join() === 's4k');
ok('الألبومات الذكية: العقود حسب تاريخ النشر', st.d2010.join() === 's15' && st.d2000.join() === 's05');
ok('الألبومات الذكية: المصدر', st.wiki.join() === 's05' && st.tpdb.join() === 'stp,stp2');
await page.evaluate(() => document.querySelector('#mStudio [data-tab="albums"]').click()); await page.waitForTimeout(300);
ok('تبويب «ألبوماتي» يعرض الألبومات الذكية فوق ألبومات المستخدم', await page.evaluate(() => { const m = document.getElementById('mStudio'); return m.querySelectorAll('[data-smart]').length >= 5 && !!m.querySelector('[data-act="newalbum"]'); }));
await shot('studio-albums');
await page.evaluate(() => document.querySelector('#mStudio [data-smart="4k"]').click()); await page.waitForTimeout(300);
ok('فتح ألبوم ذكي يعرض صوره وعنوانه', await page.evaluate(() => /دقة 4K/.test(document.querySelector('#mStudio h2').textContent) && document.querySelectorAll('#mStudio [data-si="s4k"]').length === 1));
ok('الرجوع من الألبوم الذكي', await page.evaluate(async () => { document.querySelector('#mStudio [data-act="back"]').click(); await new Promise(r => setTimeout(r, 200)); return !!document.querySelector('#mStudio [data-smart]'); }));
ok('زيارة ثانية في الجلسة نفسها لا تُخفي «الجديد»', await page.evaluate(async () => { closeOv('ovStudio'); await Studio.open({ v: 'home' }); document.querySelector('#mStudio [data-tab="home"]').click(); await new Promise(r => setTimeout(r, 200)); const r = /جديد منذ زيارتك/.test(document.getElementById('mStudio').textContent); closeOv('ovStudio'); return r; }));

// ---------- 4) ترويسة المكتبة: «⋯» ----------
await page.evaluate(() => closeOv('ovHome'));
const hdr = await page.evaluate(() => { const v = id => getComputedStyle(document.getElementById(id)).display !== 'none'; return { more: v('bMoreH'), show: v('bShow'), blur: v('bBlur'), lock: v('bLock'), view: v('bView'), rnd: v('bRandom') }; });
ok('الجوال: «⋯» ظاهر، والعرض والتمويه داخله، والبقية كما هي', hdr.more && !hdr.show && !hdr.blur && hdr.lock && hdr.view && hdr.rnd, JSON.stringify(hdr));
await page.click('#bMoreH'); await page.waitForSelector('#ovAsk.show .hmenu'); await shot('library-menu');
await page.click('#ovAsk [data-h="bBlur"]'); await page.waitForTimeout(400);
ok('«تمويه الصور» من القائمة يعمل، ونقطة على «⋯» تذكّر به', await page.evaluate(() => document.body.classList.contains('blur') && document.getElementById('bMoreH').classList.contains('dot')));
await page.click('#bMoreH'); await page.waitForSelector('#ovAsk.show .hmenu');
ok('القائمة تعرض «إلغاء التمويه» حين يكون مفعّلًا', await page.evaluate(() => /إلغاء تمويه/.test(document.querySelector('#ovAsk .hmenu').textContent)));
await page.click('#ovAsk [data-h="bBlur"]'); await page.waitForTimeout(400);
ok('إلغاء التمويه يعمل', await page.evaluate(() => !document.body.classList.contains('blur') && !document.getElementById('bMoreH').classList.contains('dot')));
const wide = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar' }); const pw = await wide.newPage(); await pw.goto(base); await pw.waitForSelector('body.ready');
ok('الشاشة العريضة: الأزرار كلها ظاهرة بلا «⋯»', await pw.evaluate(() => getComputedStyle(document.getElementById('bShow')).display !== 'none' && getComputedStyle(document.getElementById('bMoreH')).display === 'none'));
await wide.close();

// ---------- 5) توحيد الترويسات ----------
const heads = await page.evaluate(async () => { const sz = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).fontSize : ''; };
  document.getElementById('nWorks').click(); await new Promise(r => setTimeout(r, 300)); const w = sz('#mWorks .wk-title h2');
  document.getElementById('nRecs').click(); await new Promise(r => setTimeout(r, 300)); const r = sz('#mRecs .rx-top h2');
  document.getElementById('nStudio').click(); await new Promise(r => setTimeout(r, 400)); const s = sz('#mStudio .shead h2'); const fill = getComputedStyle(document.querySelector('#mStudio .shead h2')).webkitTextFillColor;
  document.getElementById('nHome').click(); return { w, r, s, fill }; });
ok('عناوين الصفحات بالمقاس نفسه (الأعمال/اكتشف/الاستديو)', heads.w && heads.w === heads.r && heads.r === heads.s, JSON.stringify(heads));

// ---------- 6) فهرس الأعمال: لا يُعاد بناؤه بلا داعٍ، ويُعاد عند تغيّر الأعمال ----------
const wc = await page.evaluate(async () => { const it = items.find(x => x.id === 'a1'); it.works = [{ t: 'Cache Work', s: 'S1', d: '2024-01-01' }]; await save(it);
  const a = wAll(); it.views = (it.views || 0) + 1; await save(it); const b = wAll();
  it.works[0].t = 'Cache Work Renamed'; await save(it); const c = wAll();
  const n = items.length; items = items.filter(x => x.id !== 'b1'); const d = wAll(); items.push(...[]);
  return { same: a === b, rebuiltOnEdit: c !== b && c.some(g => g.t === 'Cache Work Renamed'), rebuiltOnDelete: d !== c, n }; });
ok('فهرس الأعمال: حفظ عداد الزيارات لا يعيد بناءه', wc.same, JSON.stringify(wc));
ok('فهرس الأعمال: تعديل عنوان عمل يعيد بناءه', wc.rebuiltOnEdit);
ok('فهرس الأعمال: حذف ممثلة يعيد بناءه', wc.rebuiltOnDelete);

// ---------- 7) العارض: الصورة السابقة تُحمَّل مسبقًا ----------
const pre = await page.evaluate(async () => { const seen = []; const I = window.Image; window.Image = function () { const im = new I(); const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(im, 'src', { set(v) { seen.push(v); d.set.call(im, v); }, get() { return d.get.call(im); } }); return im; };
  Gallery.open(['https://img.test/1.jpg', 'https://img.test/2.jpg', 'https://img.test/3.jpg', 'https://img.test/4.jpg'], 1); window.Image = I; Gallery.close(); return seen; });
ok('العارض يحمّل التالية والسابقة مسبقًا', pre.includes('https://img.test/3.jpg') && pre.includes('https://img.test/1.jpg'), pre.join(','));

ok('لا أخطاء JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(results.join('\n')); console.log(`\n${results.length - failed}/${results.length} نجح`);
await browser.close(); server.close(); process.exit(failed ? 1 : 0);

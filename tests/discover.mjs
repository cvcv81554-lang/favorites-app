// اختبار «اكتشف» و«الاقتراحات الذكية» (v34) في متصفح حقيقي، بمخزون مرشحات معروف النتائج وبلا شبكة:
// التحقق الصارم من العمر لاكتشافات 18–21 (حدود الأيام، التضارب، التاريخ الناقص، المصدر غير الموثّق، القاصر)،
// المسارات اليومية والأسبوعية الثابتة، منع التكرار، التنويع، المؤكدة مقابل المحدودة، البحث، أدوات التحكم،
// التعلّم من التصفح والحفظ، التلفاز بالريموت، وعدم كسر التبويبات القديمة.
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

// مكتبة + مخزون مرشحات (يُحقن قبل فتح الصفحة؛ الشبكة الخارجية ممنوعة)
const SETUP = () => {
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const yearsAgo = (y, dayShift = 0) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setDate(d.getDate() + dayShift); return ymd(d); };
  LS.set('vkte_key', 'test-tpdb'); LS.set('vkte_stash', 'test-stash');
  const lib = []; const cc = ['US', 'US', 'US', 'CZ', 'US', 'RU'];
  for (let i = 0; i < 6; i++) lib.push({ id: 'L' + i, name: 'Lib Star ' + i, birth: '199' + i + '-05-05', country: cc[i], fav: i < 4, rating: 5 - (i % 2), photos: [], works: [], tags: [], lists: i === 5 ? ['list-a'] : [], added: Date.now() - i * 864e5, updated: Date.now() });
  lib.forEach((it, i) => { _attrCache[it.id] = { t: Date.now(), at: { c: cc[i], e: i < 5 ? 'caucasian' : 'latin', hr: i % 2 ? 'brunette' : 'blonde', ey: 'blue', cp: 'medium', h: 165, cs: 2015 } }; });
  lib.forEach(x => items.push(x));
  const C = (name, o) => Object.assign({ k: norm(name), name, aliases: '', img: '', cc: 'US', country: '', birth: '', birthRaw: '', src: 'StashDB', gender: 'female', at: { c: 'US', e: 'caucasian', hr: 'blonde', ey: 'blue', cp: 'medium', h: 165, cs: 2018 }, t: Date.now() }, o);
  const pool = [
    C('Young Verified 19', { birth: yearsAgo(19, -30), bs: { stash: yearsAgo(19, -30) }, stashId: 'y19', at: { c: 'US', e: 'caucasian', hr: 'blonde', ey: 'blue', cp: 'medium', h: 165, cs: 2025 } }),
    C('Young Two Sources 20', { birth: yearsAgo(20, -10), bs: { stash: yearsAgo(20, -10), tpdb: yearsAgo(20, -10) }, stashId: 'y20', pdbId: 'p20' }),
    C('Turns 22 Tomorrow', { birth: yearsAgo(22, 1), bs: { stash: yearsAgo(22, 1) } }),   // ما زالت 21
    C('Turned 22 Today', { birth: yearsAgo(22, 0), bs: { stash: yearsAgo(22, 0) } }),     // 22 ← خارج المسار
    C('Conflict Dates', { birth: yearsAgo(19, 0), bs: { stash: yearsAgo(19, 0), tpdb: yearsAgo(20, 0) } }),
    C('Partial Year Only', { birth: '', birthRaw: String(new Date().getFullYear() - 20), bs: { stash: String(new Date().getFullYear() - 20) } }),
    C('Unverified Source', { src: 'OnlyFans', birth: yearsAgo(19, -40), bs: { other: yearsAgo(19, -40) } }),
    C('Stored Mismatch', { birth: yearsAgo(20, -5), birthRaw: yearsAgo(21, -5), bs: { stash: yearsAgo(20, -5) } }),
    C('Minor Seventeen', { birth: yearsAgo(17, -5), bs: { stash: yearsAgo(17, -5) } }),
    C('No Birth At All', { birth: '', bs: {} }),
    C('Conflict Minor', { birth: yearsAgo(19, -3), bs: { stash: yearsAgo(19, -3), tpdb: yearsAgo(17, -3) } }),
  ];
  const ccs = ['US', 'US', 'US', 'US', 'CZ', 'CZ', 'ES', 'RU', 'BR', 'HU', 'US', 'US'];
  for (let i = 0; i < 24; i++) pool.push(C('Adult Cand ' + i, { cc: ccs[i % ccs.length], birth: yearsAgo(24 + (i % 12), -3), bs: { stash: yearsAgo(24 + (i % 12), -3) },
    at: { c: ccs[i % ccs.length], e: i % 3 ? 'caucasian' : 'latin', hr: i % 2 ? 'brunette' : 'blonde', ey: 'blue', cp: 'medium', h: 160 + (i % 10), cs: i % 5 === 0 ? new Date().getFullYear() - 1 : 2014 }, cx: i % 4 === 0 ? { n: 5, st: ['Studio A'], tg: [], co: 0 } : undefined }));
  _recPool = { v: 2, at: Date.now(), round: 1, list: pool }; _recCache = { list: [], at: Date.now() };
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
await ctx.route('https://**', r => r.fulfill({ status: 404, body: '' }));
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/net::ERR|404|Failed to load/.test(m.text())) errors.push(m.text()); });
await page.goto(base); await page.waitForSelector('body.ready');
await page.evaluate(SETUP);

// ---------- 1) التحقق من العمر (منطق خالص) ----------
const ages = await page.evaluate(() => Object.fromEntries(_recPool.list.slice(0, 10).map(c => { const v = Discover.verifyAge(c), y = Discover.young(c); return [c.name, { ok: v.ok, age: v.age, why: v.why || '', young: !!y, srcs: y ? y.srcs.join('+') : '' }]; })));
ok('18–21: موثّقة 19 تُقبل', ages['Young Verified 19'].young && ages['Young Verified 19'].age === 19, JSON.stringify(ages['Young Verified 19']));
ok('18–21: مصدران متطابقان يُذكران', ages['Young Two Sources 20'].young && ages['Young Two Sources 20'].srcs === 'stash+tpdb');
ok('18–21: عيد ميلادها الـ22 غدًا ← ما زالت 21 وتُقبل', ages['Turns 22 Tomorrow'].young && ages['Turns 22 Tomorrow'].age === 21, JSON.stringify(ages['Turns 22 Tomorrow']));
ok('18–21: بلغت 22 اليوم ← تُستبعد', !ages['Turned 22 Today'].young && ages['Turned 22 Today'].age === 22);
ok('18–21: تضارب بين المصادر ← تُستبعد', !ages['Conflict Dates'].ok && /تضارب/.test(ages['Conflict Dates'].why));
ok('18–21: تاريخ ناقص (السنة فقط) ← يُستبعد', !ages['Partial Year Only'].ok && /ناقص/.test(ages['Partial Year Only'].why));
ok('18–21: مصدر غير قاعدة بيانات ← يُستبعد', !ages['Unverified Source'].ok && /قاعدة/.test(ages['Unverified Source'].why));
ok('18–21: حقلان مختلفان في السجل نفسه ← تضارب يُستبعد', !ages['Stored Mismatch'].ok);
ok('18–21: القاصر مرفوضة', !ages['Minor Seventeen'].ok && !ages['Minor Seventeen'].young);
ok('18–21: بلا تاريخ ← تُستبعد', !ages['No Birth At All'].ok);
const dateCheck = await page.evaluate(() => [Discover._t.validDate('2005-02-30'), Discover._t.validDate('2005-02-28'), Discover._t.validDate('2999-01-01')]);
ok('تواريخ مستحيلة/مستقبلية مرفوضة', dateCheck.join() === 'false,true,false', dateCheck.join());

// ---------- 2) «اكتشف»: المسارات ----------
await page.evaluate(() => { LS.del('vkte_rec_ui'); document.getElementById('nRecs').click(); });
await page.waitForSelector('#ovRecs.show .dx-lane', { timeout: 10000 });
await page.waitForTimeout(400);
const L = await page.evaluate(() => { const lanes = [...document.querySelectorAll('#mRecs .dx-lane')].map(s => ({ id: s.dataset.lane, n: s.querySelectorAll('.dx-strip .dx-pc').length, names: [...s.querySelectorAll('.dx-strip .dx-pc .rc-b b, .dx-strip .dx-pc h3, .dx-strip .dx-pc .rc-n')].map(x => x.textContent.trim()).slice(0, 12) }));
  const all = [...document.querySelectorAll('#mRecs [data-k]')].map(x => x.dataset.k); return { lanes, tabOn: document.querySelector('#mRecs .rx-t.on') && document.querySelector('#mRecs .rx-t.on').dataset.v, all }; });
const laneIds = L.lanes.map(l => l.id);
ok('«✨ لك» هو التبويب الافتتاحي مع المسارات', L.tabOn === 'lanes' && ['day', 'week', 'young', 'studio', 'rising'].every(x => laneIds.includes(x)), laneIds.join(','));
const youngKs = await page.evaluate(() => { const b = document.querySelector('#mRecs [data-lane="young"] [data-lmore]'); if (b) b.click(); const g = document.querySelector('#mRecs [data-lane="young"] .dx-grid'); return [...(g && !g.hidden && g.childElementCount ? g : document.querySelector('#mRecs [data-lane="young"] .dx-strip')).querySelectorAll('.dx-pc')].map(x => x.dataset.k); });
const yk = n => n.toLowerCase();
ok('مسار 18–21 يحوي الموثّقات فقط (والملصق يفتح التفاصيل)', ['young verified 19', 'young two sources 20', 'turns 22 tomorrow'].every(n => youngKs.includes(yk(n))) && youngKs.length === 3, youngKs.join(' | '));
ok('مصدر يقول أقل من 18 ← تُستبعد من كل القوائم (لا من 18–21 فقط)', !L.all.includes('conflict minor') && !(await page.evaluate(() => Discover.ranked().some(c => c.k === 'conflict minor') || recEligible(_recPool.list.find(c => c.k === 'conflict minor'), libIndex(), new Set()))));
ok('القاصر لا تظهر في أي مكان', !L.all.includes('minor seventeen') && !(await page.evaluate(() => Discover.ranked().some(c => c.k === 'minor seventeen'))));
const badge = await page.evaluate(() => { const b = document.querySelector('#mRecs [data-lane="young"] .dx-age'); return b ? b.textContent : ''; });
ok('بطاقة 18–21 تعرض العمر ومصدر التاريخ', /✓ \d\d سنة · (StashDB|ThePornDB)/.test(badge), badge);
const day1 = await page.evaluate(() => [...document.querySelectorAll('#mRecs [data-lane="day"] .dx-strip .dx-pc')].map(x => x.dataset.k).join());
await page.evaluate(() => { closeOv('ovRecs'); document.getElementById('nRecs').click(); }); await page.waitForTimeout(400);
const day2 = await page.evaluate(() => [...document.querySelectorAll('#mRecs [data-lane="day"] .dx-strip .dx-pc')].map(x => x.dataset.k).join());
ok('اكتشاف اليوم ثابت طوال اليوم', day1 && day1 === day2, day1.slice(0, 80));
const dayCC = await page.evaluate(() => { const ks = [...document.querySelectorAll('#mRecs [data-lane="day"] .dx-strip .dx-pc')].map(x => x.dataset.k); const c = {}; ks.forEach(k => { const x = _recPool.list.find(p => p.k === k); c[x && x.cc] = (c[x && x.cc] || 0) + 1; }); return c; });
ok('اكتشاف اليوم متنوع (بلدان أو أكثر، وحد لكل بلد)', Object.keys(dayCC).length >= 2 && Object.values(dayCC).every(n => n <= 2), JSON.stringify(dayCC));
await page.screenshot({ path: join(out, 'discover-phone.png') });
await page.evaluate(() => document.querySelector('#mRecs [data-lane="young"]').scrollIntoView()); await page.waitForTimeout(200);
await page.screenshot({ path: join(out, 'discover-young-phone.png') });

// الملصق يفتح ورقة التفاصيل (إضافة / حفظ / ليست ذوقي)
await page.evaluate(() => document.querySelector('#mRecs [data-lane="day"] .dx-pc').click()); await page.waitForTimeout(400);
ok('الضغط على الملصق يفتح ورقة التفاصيل بأزرارها', await page.evaluate(() => document.getElementById('ovAsk').classList.contains('show') && !!document.getElementById('pvAdd') && !!document.getElementById('pvIgn')));
await page.screenshot({ path: join(out, 'discover-preview-phone.png') });
await page.evaluate(() => { if (ask.cancel) ask.cancel(); }); await page.waitForTimeout(200);

// الحفظ: إشارة خفيفة بلا احتساب «قبول»، ومرة واحدة لكل اسم
const svT = await page.evaluate(async () => { const acc0 = _recFeedback.acc; const k0 = JSON.stringify(_recFeedback.pos);
  const open = () => document.querySelector('#mRecs [data-lane="day"] .dx-pc').click();
  open(); await new Promise(r => setTimeout(r, 300)); document.getElementById('pvSv').click(); await new Promise(r => setTimeout(r, 300));
  const pos1 = JSON.stringify(_recFeedback.pos);
  open(); await new Promise(r => setTimeout(r, 300)); document.getElementById('pvSv').click(); await new Promise(r => setTimeout(r, 300));   // إزالة
  open(); await new Promise(r => setTimeout(r, 300)); document.getElementById('pvSv').click(); await new Promise(r => setTimeout(r, 300));   // حفظ ثانٍ
  return { accSame: _recFeedback.acc === acc0, learned: pos1 !== k0, once: JSON.stringify(_recFeedback.pos) === pos1 }; });
ok('الحفظ يُعلّم مرة واحدة ولا يُحتسب «قبولًا»', svT.accSame && svT.learned && svT.once, JSON.stringify(svT));
await page.evaluate(() => { if (ask.cancel) ask.cancel(); LS.set('vkte_rec_saved', '[]'); }); await page.waitForTimeout(200);

// تفضيل «أقل توافق» يُطبَّق في «✨ لك» ويتحدث فورًا
const mm = await page.evaluate(() => { const lowest = Math.min(...Discover.ranked().map(c => c.matchPct || 0)); LS.set('vkte_rec_prefs', JSON.stringify({ minM: lowest + 1 })); window.recsRerank && window.recsRerank();
  const after = Discover.ranked(); const ok = after.every(c => (c.matchPct || 0) >= lowest + 1); LS.set('vkte_rec_prefs', '{}'); window.recsRerank && window.recsRerank(); return { lowest, ok, n: after.length }; });
ok('تفضيل «أقل توافق» يسري على «✨ لك» فورًا', mm.ok, JSON.stringify(mm));

// البحث داخل القسم
await page.fill('#mRecs [data-dxq]', 'Adult Cand 1'); await page.waitForTimeout(500);
const sr = await page.evaluate(() => [...document.querySelectorAll('#mRecs .rx-body .dx-pc')].map(x => x.dataset.k));
ok('البحث داخل الاقتراحات يرشّح بالاسم', sr.length >= 1 && sr.every(k => k.startsWith('adult cand 1')), sr.join(','));
await page.fill('#mRecs [data-dxq]', ''); await page.waitForTimeout(400);

// «الكل» يفتح الشبكة الكاملة للمسار
await page.evaluate(() => { const b = document.querySelector('#mRecs [data-lane="week"] [data-lmore], #mRecs [data-lmore]'); if (b) b.click(); });
ok('«الكل» يعرض المسار كاملًا', await page.evaluate(() => [...document.querySelectorAll('#mRecs .dx-grid')].some(g => !g.hidden)));

// التبويبات القديمة باقية وتعمل
await page.evaluate(() => document.querySelector('#mRecs [data-v="all"]').click()); await page.waitForTimeout(300);
const allN = await page.evaluate(() => document.querySelectorAll('#mRecs .rx-grid .rcd').length);
ok('تبويب «الكل» القديم يعمل كما كان', allN >= 10, 'بطاقات=' + allN);
await page.evaluate(() => document.querySelector('#mRecs [data-v="saved"]').click()); await page.waitForTimeout(200);
ok('تبويب «المحفوظة» القديم يعمل', await page.evaluate(() => /لا توجد اقتراحات محفوظة|rcd/.test(document.querySelector('#mRecs .rx-body').innerHTML)));
await page.evaluate(() => document.querySelector('#mRecs [data-v="lanes"]').click()); await page.waitForTimeout(300);

// ---------- 3) منع التكرار ----------
const rep = await page.evaluate(() => { const k = 'adult cand 3'; const before = Discover._t.impN(k);
  for (let d = 0; d < 7; d++) { const imp = Discover._t.imp; const e = imp[k]; imp[k] = [(e ? e[0] : 0) + 1, Date.now(), 'x' + d]; }
  const c = _recPool.list.find(p => p.k === k); return { before, after: Discover._t.impN(k), snoozed: Discover._t.snoozed(c), eligible: recEligible(c, libIndex(), new Set()) }; });
ok('اسم ظهر مرارًا دون تفاعل يرتاح ولا يتكرر', rep.after >= 6 && rep.snoozed && !rep.eligible, JSON.stringify(rep));
const sv = await page.evaluate(() => { LS.set('vkte_rec_saved', JSON.stringify([{ k: 'adult cand 3', name: 'Adult Cand 3' }])); const c = _recPool.list.find(p => p.k === 'adult cand 3'); return Discover._t.snoozed(c); });
ok('المحفوظة لا تُراح حتى لو تكررت', sv === false);

// ---------- 4) التنويع ----------
const div = await page.evaluate(() => { const l = Array.from({ length: 8 }, (_, i) => ({ k: 'd' + i, name: 'D' + i, cc: i < 5 ? 'US' : 'CZ', raw: 0.9 - i * 0.005, at: { e: 'x', hr: 'y' } })); return Discover.diversify(l).slice(0, 4).map(c => c.cc); });
ok('التنويع يقدّم بلدًا آخر بين المتشابهات', div.includes('CZ'), div.join(','));

// ---------- 5) «الاقتراحات الذكية» ----------
await page.evaluate(() => { closeOv('ovRecs'); LS.set('vkte_recent', JSON.stringify(['L5'])); });
const pw = await page.evaluate(() => { const it = items.find(i => i.id === 'L5'); const a = perfWeight(it); LS.set('vkte_recent', '[]'); const b = perfWeight(it); return [a, b]; });
ok('التعلّم من التصفح: من تصفحتها مؤخرًا تزيد أثرها في الذوق', pw[0] > pw[1], pw.map(x => x.toFixed(2)).join(' > '));
await page.evaluate(() => { document.getElementById('bStats').click(); });
await page.waitForTimeout(500);
await page.evaluate(() => { const t = [...document.querySelectorAll('#mStats [data-tab], #mStats button')].find(b => /الاقتراحات الذكية/.test(b.textContent)); if (t) t.click(); });
await page.waitForSelector('#mStats .dx-lane, #mStats .dx-ctl', { timeout: 8000 }).catch(() => {});
const sm = await page.evaluate(() => ({ lanes: [...document.querySelectorAll('#mStats .dx-lane')].map(s => s.dataset.lane), ctl: !!document.querySelector('#mStats .dx-ctl') }));
ok('الاقتراحات الذكية: مؤكدة/18–21 حسب ذوقك/بيانات محدودة + أدوات التحكم', sm.ctl && sm.lanes.includes('limited') && (sm.lanes.includes('conf') || sm.lanes.includes('young')), JSON.stringify(sm));
await page.screenshot({ path: join(out, 'smart-recs-phone.png') });
const conf = await page.evaluate(() => { const r = Discover.ranked(); return { c: r.filter(Discover.confirmed).length, l: r.filter(c => !Discover.confirmed(c)).length }; });
ok('فصل المؤكدة عن محدودة البيانات', conf.c + conf.l > 0 && conf.l > 0, JSON.stringify(conf));
await page.evaluate(() => { const b = document.querySelector('#mStats [data-dx="div"][data-val="2"]'); if (b) b.click(); });
ok('أدوات التحكم تُحفظ (التنويع: عالٍ)', await page.evaluate(() => JSON.parse(LS.get('vkte_rec_dx', '{}')).div === 2));
const learn = await page.evaluate(() => { const c = _recPool.list.find(p => p.k === 'adult cand 5'); const k = 'country:' + c.cc; const before = (_recFeedback.pos[k] || 0); window.RecsUI && (() => {})(); recLearn(c, true, 0.3); return [before, _recFeedback.pos[k] || 0]; });
ok('الحفظ لاحقًا يُعلّم النظام (إشارة إعجاب خفيفة)', learn[1] > learn[0], learn.join(' → '));

// ---------- 6) الأداء ----------
const perf = await page.evaluate(() => { for (let i = 0; i < 400; i++) _recPool.list.push(Object.assign({}, _recPool.list[12], { k: 'bulk ' + i, name: 'Bulk ' + i })); const t = performance.now(); Discover.ranked(); RecsUI.localRank(); const html = Discover.lanesHtml(true); return { ms: Math.round(performance.now() - t), len: html.length }; });
ok('الأداء: تصنيف ~430 مرشحة وبناء المسارات سريع وصفحة خفيفة', perf.ms < 1500 && perf.len < 400000, JSON.stringify(perf));

// ---------- 7) التلفاز ----------
const c2 = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'ar' }); await c2.route('https://**', r => r.fulfill({ status: 404, body: '' }));
const T = await c2.newPage(); const terr = []; T.on('pageerror', e => terr.push(e.message));
await T.goto(base + '?tv=1&mock=1'); await T.waitForSelector('body.ready', { state: 'attached' }); await T.waitForFunction(() => window.TVApp && TVApp.on);
await T.evaluate(SETUP); await T.evaluate(() => { _recCache = { list: recRank(buildTasteProfile(), 30), at: Date.now() }; });
await T.evaluate(() => document.querySelector('#tv [data-go="recs"]').focus()); await T.keyboard.press('Enter'); await T.waitForTimeout(700);
const tv = await T.evaluate(() => ({ rows: [...document.querySelectorAll('#tv .tv-sec h3')].map(h => h.textContent), young: [...document.querySelectorAll('#tv .tv-sec')].filter(s => /18–21/.test(s.textContent)).flatMap(s => [...s.querySelectorAll('small')].map(x => x.textContent)) }));
ok('التلفاز: صفوف اليوم/18–21/المؤكدة', tv.rows.some(r => /اليوم/.test(r)) && tv.rows.some(r => /18–21/.test(r)), tv.rows.join(' | '));
ok('التلفاز: بطاقات 18–21 تعرض العمر الموثّق', tv.young.length > 0 && tv.young.every(s => /✓ (18|19|20|21) سنة/.test(s)), tv.young.join(' | '));
await T.keyboard.press('ArrowDown'); await T.keyboard.press('ArrowDown'); await T.waitForTimeout(250);
const foc = await T.evaluate(() => { const a = document.activeElement; return a && a.dataset.rec != null ? 'rec' : (a && a.tagName); });
ok('التلفاز: الأسهم تصل لبطاقات الاقتراحات', foc === 'rec', foc);
await T.keyboard.press('Enter'); await T.waitForTimeout(400);
ok('التلفاز: OK يفتح تفاصيل الاقتراح', await T.evaluate(() => /إضافة لمكتبتي/.test(document.getElementById('tv').textContent)));
await T.screenshot({ path: join(out, 'discover-tv.png') });
ok('التلفاز: لا أخطاء', terr.length === 0, terr.slice(0, 2).join(' | ')); await c2.close();

ok('لا أخطاء JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(results.join('\n')); console.log(`\n${results.length - failed}/${results.length} نجح`);
await browser.close(); server.close(); process.exit(failed ? 1 : 0);

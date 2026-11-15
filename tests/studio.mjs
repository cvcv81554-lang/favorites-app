// اختبار الاستديو فعليًا في المتصفح (Playwright) مع مصادر وهمية تُرجع صورًا حقيقية (ملفات JPEG مولَّدة):
// الاكتشاف من ThePornDB/StashDB/Wikimedia، الأبعاد، إزالة التكرار، مطابقة الممثلة، بوابة +18، الجلسات،
// الإعجاب والألبومات والإخفاء والإبلاغ، التحديث التلقائي عند إضافة/حذف ممثلة، والأداء مع آلاف الصور.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www'), out = join(root, 'tests', 'out');
mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((q, r) => { const p = join(www, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';

const results = []; let failed = 0;
const ok = (name, cond, extra = '') => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!cond) failed++; };
let browser;
for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
if (!browser) { console.error('لم أجد Edge أو Chrome'); process.exit(2); }

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(base); await page.waitForSelector('body.ready');

// ---------- صور حقيقية (JPEG) مولَّدة بالكانفس بأبعاد مختلفة ----------
const IMGS = await page.evaluate(() => {
  const mk = (w, h, hue, mark) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, `hsl(${hue} 60% 45%)`); g.addColorStop(1, `hsl(${(hue + 90) % 360} 60% 18%)`); x.fillStyle = g; x.fillRect(0, 0, w, h);
    let sd = hue * 131 + mark * 17 + w; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 14; k++) { x.fillStyle = `hsl(${Math.floor(rnd() * 360)} ${40 + rnd() * 50}% ${15 + rnd() * 70}%)`; x.fillRect(rnd() * w, rnd() * h, (0.1 + rnd() * 0.5) * w, (0.1 + rnd() * 0.5) * h); }
    return c.toDataURL('image/jpeg', 0.85).split(',')[1]; };
  const o = {};
  for (let i = 0; i < 12; i++) o['p' + i] = mk(1200 + i * 100, 1800 + i * 120, i * 29, i % 4);
  for (let i = 0; i < 12; i++) o['s' + i] = mk(1920, 1080, 200 + i * 13, (i + 2) % 4);
  o.big = mk(3000, 4000, 15, 1); o.wiki = mk(800, 1100, 120, 2); o.small = mk(300, 400, 300, 0);
  return o; });
const BUF = Object.fromEntries(Object.entries(IMGS).map(([k, v]) => [k, Buffer.from(v, 'base64')]));
let imgHits = 0;
const ROUTES = []; const R = (p, h) => { ROUTES.push([p, h]); return ctx.route(p, h); };

// ---------- مصادر وهمية ----------
// p1: لها ThePornDB وStashDB، وصورة StashDB «dup» هي نفس ملف صورة ThePornDB الرئيسية (تكرار يجب كشفه)
// p2: StashDB فقط، مع مشاهد
// p3: بلا معرّفات — Wikimedia فقط (كيان صحيح Q1، وكيان Q2 ليس ممثلة، وQ3 ممثلة بسنة ميلاد مختلفة)
// minor: عمرها أقل من 18 — لا يجوز البحث لها إطلاقًا
const calls = { tpdb: 0, stash: 0, wiki: 0, minor: 0 };
const IMGMAP = {
  'tp/p1-main.jpg': 'p0', 'tp/p1-thumb.jpg': 'p0', 'tp/p1-post1.jpg': 'p1', 'tp/p1-post2.jpg': 'p2',
  'tp/s1-bg.jpg': 's0', 'tp/s1-bg-l.jpg': 's0', 'tp/s1-po.jpg': 'p3', 'tp/s2-bg.jpg': 's1', 'tp/s2-po.jpg': 'p4',
  'sd/p1-a.jpg': 'big', 'sd/p1-dup.jpg': 'p0', 'sd/p2-a.jpg': 'p5', 'sd/p2-b.jpg': 'p6', 'sd/p2-small.jpg': 'small',
  'sd/sc1-1.jpg': 's2', 'sd/sc1-2.jpg': 's3', 'sd/sc1-3.jpg': 's4', 'sd/sc2-1.jpg': 's5', 'sd/sc2-2.jpg': 'p7',
  'wiki/Anna.jpg': 'wiki', 'wiki/Other.jpg': 'p8', 'wiki/Wrongyear.jpg': 'p9', 'tp/new-main.jpg': 'p10', 'tp/new-post.jpg': 'p11',
};
await R('https://img.test/**', r => { imgHits++; const k = IMGMAP[new URL(r.request().url()).pathname.slice(1)];
  if (!k) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' }, body: BUF[k] }); });
const J = (r, o) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
await R('https://api.theporndb.net/**', r => { calls.tpdb++; const u = new URL(r.request().url());
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  if (/minor/.test(u.pathname)) calls.minor++;
  if (u.pathname === '/performers/tp1') return J(r, { data: { id: 'tp1', image: 'https://img.test/tp/p1-main.jpg', thumbnail: 'https://img.test/tp/p1-thumb.jpg', posters: [{ url: 'https://img.test/tp/p1-post1.jpg' }, { url: 'https://img.test/tp/p1-post2.jpg' }] } });
  if (u.pathname === '/performers/tp1/scenes') return J(r, { data: [
    { id: 's1', title: 'Sunset Session', date: '2016-05-02', site: { name: 'Studio A' }, background: { full: 'https://img.test/tp/s1-bg.jpg', large: 'https://img.test/tp/s1-bg-l.jpg' }, posters: { full: 'https://img.test/tp/s1-po.jpg' } },
    { id: 's2', title: 'City Lights', date: '2025-09-12', site: { name: 'Studio B' }, background: { full: 'https://img.test/tp/s2-bg.jpg' }, posters: { full: 'https://img.test/tp/s2-po.jpg' } }], meta: { last_page: 1 } });
  if (u.pathname === '/performers/tpnew') return J(r, { data: { id: 'tpnew', image: 'https://img.test/tp/new-main.jpg', posters: [{ url: 'https://img.test/tp/new-post.jpg' }] } });
  if (u.pathname === '/performers/tpnew/scenes') return J(r, { data: [], meta: { last_page: 1 } });
  return J(r, { data: [], meta: { last_page: 1 } }); });
await R('https://stashdb.org/graphql', r => { calls.stash++;
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  const b = JSON.parse(r.request().postData() || '{}'), id = b.variables && b.variables.id;
  if (/minor/.test(String(id))) calls.minor++;
  if (/findPerformer/.test(b.query)) return J(r, { data: { findPerformer: { images: id === 'sd1' ? [{ url: 'https://img.test/sd/p1-a.jpg', width: 3000, height: 4000 }, { url: 'https://img.test/sd/p1-dup.jpg', width: 1200, height: 1800 }]
    : id === 'sd2' ? [{ url: 'https://img.test/sd/p2-a.jpg', width: 1700, height: 2400 }, { url: 'https://img.test/sd/p2-b.jpg', width: 1800, height: 2520 }, { url: 'https://img.test/sd/p2-small.jpg', width: 300, height: 400 }] : [] } } });
  if (/queryScenes/.test(b.query)) return J(r, { data: { queryScenes: { count: id === 'sd2' ? 2 : 0, scenes: id === 'sd2' ? [
    { id: 'sc1', title: 'Golden Hour', release_date: '2014-07-01', studio: { name: 'Studio C' }, images: [{ url: 'https://img.test/sd/sc1-1.jpg', width: 1920, height: 1080 }, { url: 'https://img.test/sd/sc1-2.jpg', width: 1920, height: 1080 }, { url: 'https://img.test/sd/sc1-3.jpg', width: 1920, height: 1080 }] },
    { id: 'sc2', title: 'Blue Room', release_date: '2026-10-30', studio: { name: 'Studio D' }, images: [{ url: 'https://img.test/sd/sc2-1.jpg', width: 1920, height: 1080 }, { url: 'https://img.test/sd/sc2-2.jpg', width: 1500, height: 2100 }] }] : [] } } });
  return J(r, { data: {} }); });
await R('https://www.wikidata.org/**', r => { calls.wiki++; const u = new URL(r.request().url()), a = u.searchParams.get('action');
  if (a === 'wbsearchentities') return J(r, { search: /Wiki Person/.test(u.searchParams.get('search')) ? [{ id: 'Q1' }, { id: 'Q2' }, { id: 'Q3' }] : [] });
  if (a === 'wbgetentities') { const snak = v => ({ mainsnak: { datavalue: { value: v } } });
    return J(r, { entities: {
      Q1: { claims: { P106: [snak({ id: 'Q488111' })], P569: [snak({ time: '+1990-04-01T00:00:00Z' })], P18: [snak('Anna.jpg')] } },
      Q2: { claims: { P106: [snak({ id: 'Q33999' })], P18: [snak('Other.jpg')] } },
      Q3: { claims: { P106: [snak({ id: 'Q488111' })], P569: [snak({ time: '+1971-01-01T00:00:00Z' })], P18: [snak('Wrongyear.jpg')] } } } }); }
  return J(r, {}); });
await R('https://commons.wikimedia.org/**', r => { const t = new URL(r.request().url()).searchParams.get('titles') || ''; const pages = {};
  t.split('|').forEach((f, i) => { const n = f.replace('File:', ''); pages[i] = { imageinfo: [{ url: 'https://img.test/wiki/' + n, thumburl: 'https://img.test/wiki/' + n, width: 800, height: 1100, size: 123456, timestamp: '2011-03-04T10:00:00Z', descriptionurl: 'https://commons.wikimedia.org/wiki/File:' + n }] }; });
  return J(r, { query: { pages } }); });

// ---------- مكتبة تجريبية ----------
await page.evaluate(async () => {
  LS.set('vkte_key', 'test-tpdb'); LS.set('vkte_stash', 'test-stash');
  const mk = (id, name, birth, extra) => Object.assign({ id, name, birth, aliases: '', country: '', photos: [], thumb: '', works: [], tags: [], lists: [], rating: 4.5, fav: true, added: Date.now(), updated: Date.now() }, extra);
  const arr = [mk('p1', 'Anna Sample', '1994-01-02', { pdbId: 'tp1', stashId: 'sd1' }), mk('p2', 'Bea Sample', '1996-03-04', { stashId: 'sd2', rating: 5 }), mk('p3', 'Wiki Person', '1990-04-01'), mk('minor', 'Too Young', '2015-01-01', { pdbId: 'minor-tp', stashId: 'minor-sd' })];
  arr.forEach(x => items.push(x)); await save(arr); render(true); });

// ---------- 1) الاكتشاف ----------
await page.evaluate(() => document.getElementById('nStudio').click());
await page.waitForSelector('#ovStudio.show');
const t0 = Date.now();
const added = await page.evaluate(() => Studio.discover({ manual: true }));
const disc = await page.evaluate(() => { const T = Studio._test, all = [...T.IMG.values()];
  const by = k => all.filter(x => x.src === k).length;
  return { n: all.length, tpdb: by('tpdb'), tpdbs: by('tpdbs'), stash: by('stash'), stashs: by('stashs'), wiki: by('wiki'), perfs: [...new Set(all.map(x => x.pid))].sort(),
    wikiUrls: all.filter(x => x.src === 'wiki').map(x => x.url), probed: all.filter(x => x.probed).length, dims: all.filter(x => x.w && x.h).length, status: T.KV.status }; });
ok('الاكتشاف أضاف صورًا من كل المصادر', added > 15 && disc.tpdb >= 3 && disc.tpdbs >= 4 && disc.stash >= 4 && disc.stashs >= 5 && disc.wiki === 1, JSON.stringify({ added, ...disc, status: undefined }));
ok('بوابة +18: لا طلبات ولا صور للقاصر', calls.minor === 0 && !disc.perfs.includes('minor'), 'طلبات القاصر=' + calls.minor);
ok('Wikimedia: يُقبل الكيان الصحيح فقط (المهنة + سنة الميلاد)', disc.wikiUrls.length === 1 && /Anna\.jpg$/.test(disc.wikiUrls[0]), disc.wikiUrls.join(','));
ok('الصور منسوبة للممثلة الصحيحة عبر المعرّف', await page.evaluate(() => { const a = [...Studio._test.IMG.values()];
  return a.filter(x => /p1-|\/s[12]-/.test(x.url)).every(x => x.pid === 'p1') && a.filter(x => /p2-|sc[12]-/.test(x.url)).every(x => x.pid === 'p2') && a.filter(x => /wiki/.test(x.url)).every(x => x.pid === 'p3'); }));
ok('فحص الأبعاد والبصمة يعمل على صور حقيقية', disc.probed >= 10 && disc.dims >= disc.n - 2, `مفحوصة=${disc.probed} بأبعاد=${disc.dims}/${disc.n}`);
const dup = await page.evaluate(() => { const a = [...Studio._test.IMG.values()]; const d = a.find(x => /p1-dup/.test(x.url)), m = a.find(x => /p1-main/.test(x.url));
  return { dupOf: d && d.dupOf, main: m && m.id, mainDups: m && m.dups, mainDupOf: m && m.dupOf, vers: m ? Studio._test.versions(m).map(x => x.url.split('/').pop()) : [] }; });
ok('إزالة التكرار: نفس الصورة من مصدرين تُدمج (تبقى واحدة)', !!dup.dupOf && (dup.dupOf === dup.main || dup.mainDupOf === dup.dupOf || dup.mainDupOf), JSON.stringify(dup));
ok('الجلسات: صور المشهد الواحد مجمّعة', await page.evaluate(() => { const s = Studio._test.sessions(); const g = s.find(x => x.t === 'Golden Hour'); return !!g && g.imgs.length === 3 && s.some(x => x.t === 'Sunset Session'); }));
const sel = await page.evaluate(() => { const T = Studio._test.SEL; return { potd: T.potd().length, today: T.today().length, gem: T.gem().length, latest: T.latest()[0] && T.latest()[0].pub, past: T.past()[0] && T.past()[0].pub, hq: T.hq()[0] && T.hq()[0].w + 'x' + T.hq()[0].h, potd2: T.potd()[0] && T.potd()[0].id === T.potd()[0].id }; });
ok('الأقسام: صورة اليوم، اكتشاف اليوم، جوهرة، الأحدث، الماضي، الأعلى دقة', sel.potd === 1 && sel.today >= 6 && sel.gem === 1 && sel.latest >= '2026' && sel.past <= '2014-07-01' && sel.hq === '3000x4000', JSON.stringify(sel));
ok("صورة اليوم ثابتة طوال اليوم", await page.evaluate(() => { const T = Studio._test.SEL, a = T.potd()[0], b = T.potd()[0]; return !!a && !!b && a.id === b.id && JSON.stringify(T.today().map(x => x.id)) === JSON.stringify(T.today().map(x => x.id)); }));

// ---------- 2) الواجهة ----------
await page.evaluate(() => { document.getElementById('nHome').click(); document.getElementById('nStudio').click(); });
await page.waitForTimeout(900);
const ui = await page.evaluate(() => { const m = document.getElementById('mStudio'), W = m.querySelector('.sgrid') && m.querySelector('.sgrid').clientWidth;
  const rows = [...m.querySelectorAll('.sgrid')].flatMap(g => [...g.querySelectorAll('.srow')].slice(0, -1)).map(r => [...r.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0) + (r.children.length - 1) * 4);
  return { hero: !!m.querySelector('.shero img.ok,.shero img'), secs: [...m.querySelectorAll('.ssec h3')].map(h => h.textContent), W, rows, tabOn: document.getElementById('nStudio').classList.contains('on') }; });
ok('الصفحة تعرض صورة اليوم والأقسام', ui.hero && ui.secs.includes('اكتشاف اليوم') && ui.secs.some(s => /أحدث/.test(s)), ui.secs.join(' | '));
ok('التوزيع المبرّر: كل صف يملأ العرض', ui.rows.length === 0 || ui.rows.every(w => Math.abs(w - ui.W) < 3), JSON.stringify({ W: ui.W, rows: ui.rows.map(Math.round) }));
ok('زر الاستديو في الشريط مفعّل', ui.tabOn);
await page.screenshot({ path: join(out, 'studio-home-phone.png'), fullPage: false });

// العارض + الإجراءات
await page.click('#mStudio .sgrid .sj');
await page.waitForSelector('#lbx.show .lact:not([hidden]) .lab');
const bar = await page.evaluate(() => [...document.querySelectorAll('#lbx .lab')].map(b => b.dataset.la));
ok('العارض يفتح مع شريط الإجراءات', ['like', 'album', 'save', 'share', 'info', 'perf', 'hide', 'wrong'].every(k => bar.includes(k)), bar.join(','));
await page.screenshot({ path: join(out, 'studio-viewer-phone.png') });
await page.click('#lbx [data-la="like"]'); await page.waitForTimeout(200);
const liked1 = await page.evaluate(() => Studio._test.SEL.liked().length);
ok('الإعجاب يضيف الصورة لقائمة «أعجبتني» المنفصلة', liked1 === 1);
// ألبوم جديد + إضافة
await page.click('#lbx [data-la="album"]'); await page.waitForSelector('#ovAsk.show');
const hasNew = await page.$('#aNew'); if (hasNew) await page.click('#aNew');
await page.waitForSelector('#aIn'); await page.fill('#aIn', 'ألبومي الأول'); await page.click('#aOk'); await page.waitForTimeout(300);
const alb = await page.evaluate(() => Studio._test.KV.albums.map(a => a.name + ':' + a.ids.length));
ok('إنشاء ألبوم وإضافة الصورة إليه', alb.length === 1 && alb[0] === 'ألبومي الأول:1', alb.join());
// إبلاغ: منسوبة خطأ → لا تعود بعد إعادة البحث
const wrongUrl = await page.evaluate(() => Gallery.current().item.id && Studio._test.IMG.get(Gallery.current().item.id).url);
await page.click('#lbx [data-la="wrong"]'); await page.waitForSelector('#ovAsk.show #aOk'); await page.click('#aOk'); await page.waitForTimeout(300);
await page.evaluate(() => Gallery.close());
await page.evaluate(async () => { Object.keys(Studio._test.KV.perfAt).forEach(k => Studio._test.KV.perfAt[k] = 0); await Studio.discover({ manual: true }); });
const wrongBack = await page.evaluate(u => [...Studio._test.IMG.values()].filter(x => x.url === u && !x.wrong).length, wrongUrl);
ok('الصورة المبلّغ عنها لا تعود بعد إعادة البحث', wrongBack === 0);
// إخفاء مصدر
const before = await page.evaluate(() => Studio._test.SEL.latest().length);
await page.evaluate(async () => { Studio._test.KV.hiddenSrc.wiki = 1; });
const afterHide = await page.evaluate(() => Studio._test.SEL.latest().filter(x => x.src === 'wiki').length);
ok('إخفاء مصدر غير مرغوب فيه', afterHide === 0 && before > 0);
await page.evaluate(() => { Studio._test.KV.hiddenSrc = {}; });

// صفحة الممثلة + الجلسة
await page.evaluate(() => { document.querySelector('#mStudio [data-tab="perfs"]').click(); });
await page.waitForTimeout(300); await page.click('#mStudio .spf'); await page.waitForTimeout(300);
const pv = await page.evaluate(() => ({ head: !!document.querySelector('#mStudio .spfhead'), imgs: document.querySelectorAll('#mStudio .sgrid .sj').length, chips: document.querySelectorAll('#mStudio .schips .chip').length }));
ok('معرض الممثلة: رأس + صور + تصنيفات (النوع والمصدر)', pv.head && pv.imgs > 0 && pv.chips >= 3, JSON.stringify(pv));
await page.screenshot({ path: join(out, 'studio-performer-phone.png') });
await page.evaluate(() => { document.querySelector('#mStudio [data-act="back"]').click(); document.querySelector('#mStudio [data-tab="sess"]').click(); });
await page.waitForTimeout(300); await page.click('#mStudio .sses'); await page.waitForTimeout(300);
ok('الجلسات تُعرض كألبوم متكامل', await page.evaluate(() => document.querySelectorAll('#mStudio .sgrid .sj').length >= 2));

// ---------- 3) التحديث التلقائي ----------
await page.evaluate(async () => { const it = { id: 'pnew', name: 'New Sample', birth: '1993-02-02', pdbId: 'tpnew', aliases: '', photos: [], works: [], tags: [], lists: [], rating: 4, added: Date.now(), updated: Date.now() }; items.push(it); await save([it]); });
await page.waitForTimeout(12000);
const newImgs = await page.evaluate(() => [...Studio._test.IMG.values()].filter(x => x.pid === 'pnew').length);
ok('ممثلة جديدة في المفضلة تُدرج تلقائيًا ويبدأ جمع صورها', newImgs >= 2, 'صورها=' + newImgs);
await page.evaluate(async () => { const id = 'p2'; await DB.del(id); const i = items.findIndex(x => x.id === id); if (i >= 0) items.splice(i, 1); });
await page.waitForTimeout(400);
const p2Left = await page.evaluate(() => [...Studio._test.IMG.values()].filter(x => x.pid === 'p2').map(x => !!(x.like || (x.albums || []).length)));
ok('حذف ممثلة: تُحذف صورها ما عدا المعجَبات/الألبومات', p2Left.every(Boolean), JSON.stringify(p2Left));

// ---------- 4) الأداء مع آلاف الصور ----------
const perf = await page.evaluate(async () => { const T = Studio._test, now = Date.now();
  for (let i = 0; i < 4000; i++) { const id = 'zz' + i; T.IMG.set(id, { id, pid: ['p1', 'p3', 'pnew'][i % 3], url: 'https://img.test/tp/p1-post1.jpg?' + i, prev: '', src: ['tpdb', 'stash', 'tpdbs'][i % 3], kind: ['portrait', 'still', 'promo'][i % 3], w: 1000 + (i % 900), h: 1500 + (i % 700), pub: (2005 + i % 20) + '-01-01', found: now - i * 6e4, seen: 0, like: 0, hide: 0, albums: [], dh: (i * 2654435761 >>> 0).toString(16).padStart(16, '0').slice(0, 16), sess: i % 5 ? null : { k: 'z' + (i % 300), t: 'S' + (i % 300), d: '2020-01-01', st: 'X' } }); }
  document.getElementById('nHome').click(); const t = performance.now(); await Studio.open({ v: 'home' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const open = performance.now() - t; const t2 = performance.now(); document.querySelector('#mStudio [data-tab="latest"]').click(); const tabMs = performance.now() - t2;
  const t3 = performance.now(); T.dedupe(); const dd = performance.now() - t3;
  return { open: Math.round(open), tab: Math.round(tabMs), dedupe: Math.round(dd), nodes: document.querySelectorAll('#mStudio img').length }; });
ok('الأداء: فتح الاستديو مع 4000+ صورة سريع', perf.open < 1500 && perf.tab < 800, JSON.stringify(perf));
ok('التحميل التدريجي: لا يُرسم إلا جزء من الصور', perf.nodes < 400, 'عناصر img=' + perf.nodes);

// شاشة عريضة
await page.setViewportSize({ width: 1280, height: 800 }); await page.evaluate(() => { document.querySelector('#mStudio [data-tab="home"]').click(); }); await page.waitForTimeout(500);
await page.screenshot({ path: join(out, 'studio-home-wide.png') });
ok('لا أخطاء JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));

// ---------- 5) التلفاز: الاستديو بالريموت فقط ----------
{ const c2 = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'ar' }); for (const [p, h] of ROUTES) await c2.route(p, h);
  const T = await c2.newPage(); const terr = []; T.on('pageerror', e => terr.push(e.message));
  await T.goto(base + '?tv=1&mock=1'); await T.waitForSelector('body.ready', { state: 'attached' }); await T.waitForFunction(() => window.TVApp && TVApp.on); await T.waitForTimeout(600);
  await T.evaluate(async () => { LS.set('vkte_key', 'k'); LS.set('vkte_stash', 'k'); const it = { id: 'p1', name: 'Anna Sample', birth: '1994-01-02', pdbId: 'tp1', stashId: 'sd1', aliases: '', photos: [], works: [], tags: [], lists: [], rating: 4.5, added: Date.now(), updated: Date.now() }; items.push(it); await save([it]); });
  await T.evaluate(() => document.querySelector('#tv [data-go="studio"]').focus()); await T.keyboard.press('Enter');
  await T.waitForSelector('#ovStudio.show'); await T.evaluate(() => Studio.discover({ manual: true })); await T.waitForTimeout(800);
  const f0 = await T.evaluate(() => document.activeElement && document.getElementById('mStudio').contains(document.activeElement));
  await T.keyboard.press('ArrowDown'); await T.keyboard.press('ArrowDown'); await T.waitForTimeout(250);
  const f1 = await T.evaluate(() => { const a = document.activeElement; return a && (a.dataset.si ? 'img' : a.dataset.tab ? 'tab' : a.tagName); });
  await T.screenshot({ path: join(out, 'studio-tv.png') });
  // افتح صورة بالريموت ثم ارجع
  await T.evaluate(() => { const b = document.querySelector('#mStudio [data-si]'); b.focus(); }); await T.keyboard.press('Enter'); await T.waitForTimeout(400);
  const lbOpen = await T.evaluate(() => Gallery.isOpen());
  await T.keyboard.press('Escape'); await T.waitForTimeout(200); const lbClosed = await T.evaluate(() => !Gallery.isOpen() && Studio.isOpen());
  await T.keyboard.press('Escape'); await T.waitForTimeout(300);
  const back = await T.evaluate(() => !Studio.isOpen() && document.activeElement && document.activeElement.dataset.go === 'studio');
  ok('التلفاز: الاستديو من القائمة الجانبية والتركيز داخله', f0, 'focused=' + f0);
  ok('التلفاز: الأسهم تتنقل بين الصور والأزرار', !!f1, f1);
  ok('التلفاز: OK يفتح الصورة، والرجوع يغلق العارض ثم الاستديو ويعيد التركيز للقائمة', lbOpen && lbClosed && back, JSON.stringify({ lbOpen, lbClosed, back }));
  ok('التلفاز: لا أخطاء', terr.length === 0, terr.slice(0, 2).join(' | '));
  await c2.close(); }

console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} نجح · طلبات: ThePornDB=${calls.tpdb} StashDB=${calls.stash} Wikidata=${calls.wiki} صور=${imgHits}`);
await browser.close(); server.close(); process.exit(failed ? 1 : 0);

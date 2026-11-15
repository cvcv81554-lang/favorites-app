// اختبار المزايا الجديدة (v33) في متصفح حقيقي على مكتبة تجريبية معروفة النتائج:
// نشاطي (الخريطة والسلاسل)، في مثل هذا اليوم (+ بطاقة الرئيسية)، مسيرة الممثلة، اكتمال المكتبة، مزاج الليلة.
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

// مكتبة معروفة: مشاهدات اليوم وأمس وقبله (سلسلة 3)، وسلسلة قديمة من 5 أيام، وذكرى قبل سنتين
const facts = await page.evaluate(async () => {
  const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const t = d(0), md = t.slice(5), y2 = (+t.slice(0, 4) - 2) + '-' + md, y1 = (+t.slice(0, 4) - 1);
  const old5 = [40, 41, 42, 43, 44].map(d);
  const A = { id: 'pA', name: 'Alpha Sample', birth: '1990-' + md, country: 'US', pdbId: 'x1', rating: 5, fav: true, tags: ['a'], photos: [], lists: [], added: new Date(y2 + 'T10:00:00').getTime(), updated: Date.now(),
    works: [
      { t: 'Today One', s: 'Studio A', y: '2025', d: '2025-03-01', w: 1, wd: d(0), r: 5, du: 25, tg: ['soft'] },
      { t: 'Yesterday', s: 'Studio A', y: '2024', d: '2024-05-05', w: 1, wd: d(1), du: 50 },
      { t: 'Two Days', s: 'Studio B', y: '2023', d: '2023-07-07', w: 1, wd: d(2), du: 30 },
      ...old5.map((x, k) => ({ t: 'Old ' + k, s: 'Studio B', y: '2021', d: '2021-0' + (k + 1) + '-01', w: 1, wd: x })),
      { t: 'Memory', s: 'Studio C', y: y2.slice(0, 4), d: y2, w: 1, wd: y2 },
      { t: 'Shared Unseen', s: 'Studio A', y: '2026', d: '2026-01-10', du: 18, tg: ['soft'], q: 1 },
      { t: 'Long Unseen', s: 'Studio C', y: '2026', d: '2026-02-10', du: 90, tg: ['hard'] }] };
  const B = { id: 'pB', name: 'Beta Sample', birth: '', photos: [], tags: [], lists: [], rating: 0, added: Date.now(), updated: Date.now(),
    works: [{ t: 'Shared Unseen', s: 'Studio A', y: '2026', d: '2026-01-10', du: 18, tg: ['soft'] }, { t: 'Beta Solo', s: 'Studio D', y: '2019', d: '2019-01-01' }] };
  items.push(A, B); await save([A, B]); render(true);
  return { t, y2, y1, inYear: [d(0), d(1), d(2), ...old5].filter(x => x.startsWith(t.slice(0, 4))).length + (y2.startsWith(t.slice(0, 4)) ? 1 : 0) }; });

// ---------- 1) البلاطات في «المزيد» ----------
await page.evaluate(() => document.getElementById('nMore').click()); await page.waitForTimeout(300);
const tiles = await page.evaluate(() => ['activity', 'onthisday', 'mood', 'health'].map(k => !!document.querySelector(`#mMore [data-tool="${k}"]`)));
ok('أربع بلاطات جديدة في «المزيد»', tiles.every(Boolean), JSON.stringify(tiles));

// ---------- 2) نشاطي ----------
const st = await page.evaluate(() => Plus.streaks(Plus.watchDays()));
ok('السلاسل: الحالية 3 والأطول 5', st.cur === 3 && st.best === 5 && st.alive, JSON.stringify(st));
await page.click('#mMore [data-tool="activity"]'); await page.waitForSelector('#ovAsk.show .p33heat');
const hm = await page.evaluate(() => { const c = [...document.querySelectorAll('#ovAsk .p33grid i[data-d33]')]; return { cells: c.length, lit: c.filter(x => !x.classList.contains('l0')).length, stats: [...document.querySelectorAll('#ovAsk .p33st b')].map(b => b.textContent) }; });
const Y = +facts.t.slice(0, 4), daysInY = (Y % 4 === 0 && (Y % 100 !== 0 || Y % 400 === 0)) ? 366 : 365;
ok('خريطة السنة: مربع لكل يوم، والمضاءة = أيام المشاهدة', hm.cells === daysInY && hm.lit === facts.inYear, JSON.stringify({ ...hm, daysInY, expect: facts.inYear }));
await page.click(`#ovAsk [data-d33="${facts.t}"]`); await page.waitForTimeout(150);
ok('الضغط على يوم يعرض أعماله', await page.evaluate(() => /Today One/.test(document.getElementById('p33day').textContent)));
await page.screenshot({ path: join(out, 'plus-activity.png') });
await page.click('#ovAsk [data-x]'); await page.waitForTimeout(200);

// ---------- 3) في مثل هذا اليوم ----------
const od = await page.evaluate(() => { const o = Plus.onThisDay(); return { w: o.watched.map(g => g.t), a: o.added.map(x => x.i.name), r: o.released.map(g => g.t), b: o.bday.map(i => i.name) }; });
ok('في مثل هذا اليوم: مشاهدة/إضافة/إصدار/ميلاد قبل سنتين', od.w.includes('Memory') && od.a.includes('Alpha Sample') && od.r.includes('Memory') && od.b.includes('Alpha Sample'), JSON.stringify(od));
await page.evaluate(() => { Home.TOOL.onthisday(); }); await page.waitForSelector('#ovAsk.show');
ok('نافذة «في مثل هذا اليوم» تعرض عيد الميلاد والذكريات', await page.evaluate(() => /عيد ميلاد اليوم/.test(document.getElementById('mAsk').textContent) && /Memory/.test(document.getElementById('mAsk').textContent)));
await page.click('#ovAsk [data-x]'); await page.waitForTimeout(200);

// ---------- 4) مسيرة الممثلة ----------
await page.evaluate(() => openDetail('pA')); await page.waitForTimeout(500);
const car = await page.evaluate(() => { const c = document.querySelector('#mDetail .p33car'); if (!c) return null; return { bars: c.querySelectorAll('.p33bars span').length, stats: [...c.querySelectorAll('.p33cs b')].map(b => b.textContent), co: [...c.querySelectorAll('[data-pf33d]')].map(b => b.dataset.pf33d), head: c.querySelector('h3').textContent }; });
ok('مسيرتها: أعمدة لكل سنة من الأولى للأخيرة', !!car && car.bars === 2026 - 2021 + 1, JSON.stringify(car));
ok('مسيرتها: العدد والمشاهَد والنسبة والمتوسط', !!car && car.stats[0] === '11' && car.stats[1] === '9' && car.stats[2] === '82%' && car.stats[3] === '5.0★', JSON.stringify(car && car.stats));
ok('مسيرتها: من شاركتها في مكتبتك', !!car && car.co.includes('pB'));
await page.evaluate(() => document.querySelector('#mDetail .p33car').scrollIntoView()); await page.screenshot({ path: join(out, 'plus-career.png') });
await page.evaluate(() => closeOv('ovDetail'));

// ---------- 5) اكتمال المكتبة ----------
const hs = await page.evaluate(() => [Plus.scoreOf(items.find(i => i.id === 'pA')).pct, Plus.scoreOf(items.find(i => i.id === 'pB')).miss.map(c => c[0]).join(',')]);
ok('اكتمال: الدرجة وما ينقص كل ممثلة', hs[0] === 86 && hs[1] === 'ph,bi,co,id,ra,tg', JSON.stringify(hs));
await page.evaluate(() => { Home.TOOL.health(); }); await page.waitForSelector('#ovAsk.show .p33ring');
ok('صفحة الاكتمال تعرض النسبة والقائمة والفلاتر', await page.evaluate(() => document.querySelectorAll('#ovAsk .p33hr').length === 2 && document.querySelectorAll('#ovAsk [data-h33]').length >= 3));
await page.screenshot({ path: join(out, 'plus-health.png') });
await page.click('#ovAsk [data-h33="id"]'); await page.waitForTimeout(250);
ok('فلتر «بلا ربط بمصدر» يُظهر الناقصة فقط', await page.evaluate(() => { const r = [...document.querySelectorAll('#ovAsk .p33hr')]; return r.length === 1 && r[0].dataset.pf33 === 'pB'; }));
await page.click('#ovAsk [data-x]'); await page.waitForTimeout(200);

// ---------- 6) مزاج الليلة ----------
await page.evaluate(() => { LS.del('vkte_mood'); Home.TOOL.mood(); }); await page.waitForSelector('#ovAsk.show #m33go');
await page.click('#ovAsk #m33go'); await page.waitForTimeout(200);
const s1 = await page.evaluate(() => [...document.querySelectorAll('#m33out .p33w b')].map(b => b.textContent));
ok('مزاج الليلة: يقترح أعمالًا لم تُشاهد فقط', s1.length >= 2 && s1.every(t => /Unseen|Beta Solo/.test(t)), JSON.stringify(s1));
await page.click('#ovAsk [data-m33="du"][data-v="20"]'); await page.click('#ovAsk [data-m33="tg"][data-v="soft"]'); await page.click('#ovAsk #m33go'); await page.waitForTimeout(200);
const s2 = await page.evaluate(() => ({ t: [...document.querySelectorAll('#m33out .p33w b')].map(b => b.textContent), why: document.querySelector('#m33out .p33why') && document.querySelector('#m33out .p33why').textContent }));
ok('مزاج الليلة: المدة والطابع يُطبَّقان، مع سبب الاقتراح', s2.t.length === 1 && s2.t[0] === 'Shared Unseen' && /قائمة المشاهدة|مفضلاتك/.test(s2.why), JSON.stringify(s2));
await page.screenshot({ path: join(out, 'plus-mood.png') });
await page.click('#ovAsk .actions [data-x]'); await page.waitForTimeout(250);
ok('زر «إغلاق» السفلي في مزاج الليلة يعمل', await page.evaluate(() => !document.getElementById('ovAsk').classList.contains('show')));
await page.evaluate(() => { Home.TOOL.mood(); }); await page.waitForSelector('#ovAsk.show #m33go'); await page.click('#ovAsk #m33go'); await page.waitForTimeout(200);
await page.click('#ovAsk .p33w'); await page.waitForTimeout(500);
ok('الضغط على الاقتراح يفتح نافذة العمل نفسه', await page.evaluate(() => !document.getElementById('m33go') && /Shared Unseen/.test(document.getElementById('mAsk').textContent)));

ok('لا أخطاء JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(results.join('\n')); console.log(`\n${results.length - failed}/${results.length} نجح`);
await browser.close(); server.close(); process.exit(failed ? 1 : 0);

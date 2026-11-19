// اختبارات الفرع التجريبي bg-beta: جسر التطبيق مع Background Runner (بمحاكاة الإضافة) + منطق مشغّل الخلفية نفسه في بيئة معزولة.
// لا يغني عن التجربة على جهاز: توقيت iOS/Android الحقيقي والإشعارات لا تُختبر هنا.
import { chromium } from 'playwright-core';
import http from 'node:http';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), www = join(root, 'www');
const results = []; let failed = 0;
const ok = (n, c, x = '') => { results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) failed++; };

// ---------- 1) المشغّل نفسه (بيئة معزولة تحاكي CapacitorKV / fetch / الإشعارات) ----------
const runSrc = readFileSync(join(www, 'runners', 'background.js'), 'utf8');
const mkRunner = (fetchImpl) => { const kv = {}, handlers = {}, notes = [], reqs = [];
  const ctx = { CapacitorKV: { get: k => (k in kv ? { value: kv[k] } : { value: null }), set: (k, v) => { kv[k] = v; }, remove: k => { delete kv[k]; } },
    CapacitorNotifications: { schedule: n => notes.push(n) }, addEventListener: (e, f) => { handlers[e] = f; }, console, Date, JSON, Math, Set, Map, String, Array, Promise,
    fetch: async (u, o) => { reqs.push({ u, o }); return fetchImpl(u, o); } };
  vm.createContext(ctx); vm.runInContext(runSrc, ctx);
  const call = (e, a) => new Promise((res, rej) => handlers[e](res, rej, a)); return { kv, call, notes, reqs }; };
const SID = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const scenes = { data: { queryScenes: { scenes: [{ id: 'sc1', title: 'New One', date: '2026-11-20', studio: { name: 'St' }, performers: [{ performer: { id: SID(1) } }] }, { id: 'sc2', title: 'Other Perf', date: '2026-11-20', performers: [{ performer: { id: SID(99) } }] }] } } };
{
  const R = mkRunner(async () => ({ ok: true, json: async () => scenes }));
  ok('المشغّل: بلا إعداد لا يرسل أي طلب', (await R.call('checkNew')).skip === 'off' && R.reqs.length === 0);
  await R.call('config', { key: 'K', on: true, ids: [{ s: SID(1), n: 'Ann' }, { s: 'bad id', n: 'X' }] });
  ok('المشغّل: يقبل معرّفات StashDB الصالحة فقط', JSON.parse(R.kv.fav_bg_cfg).ids.length === 1);
  const r = await R.call('checkNew');
  ok('المشغّل: طلب واحد لـ StashDB الرسمي بالمفتاح', R.reqs.length === 1 && R.reqs[0].u === 'https://stashdb.org/graphql' && R.reqs[0].o.headers.ApiKey === 'K');
  ok('المشغّل: يحفظ أعمال ممثلات القائمة فقط ويرسل إشعارًا واحدًا', r.added === 1 && JSON.parse(R.kv.fav_bg_found).length === 1 && R.notes.length === 1 && /Ann/.test(R.notes[0][0].body), JSON.stringify(r));
  ok('المشغّل: لا يعيد السؤال قبل 6 ساعات (بطارية/بيانات)', (await R.call('checkNew')).skip === 'recent' && R.reqs.length === 1);
  const col = await R.call('collect');
  ok('المشغّل: «collect» يعيد النتائج ثم يفرّغها', col.found.length === 1 && JSON.parse(R.kv.fav_bg_found).length === 0);
  await R.call('config', { key: 'K', on: false, ids: [] }); R.kv.fav_bg_last = JSON.stringify({});
  ok('المشغّل: الإيقاف يمنع أي طلب', (await R.call('checkNew')).skip === 'off' && R.reqs.length === 1);
}
{
  const R = mkRunner(async () => ({ ok: false, status: 401 })); await R.call('config', { key: 'bad', on: true, ids: [{ s: SID(1), n: 'Ann' }] });
  const r = await R.call('checkNew'); ok('المشغّل: مفتاح غير صالح لا يرسل إشعارًا ولا يتعطل', r.err === 401 && R.notes.length === 0);
}

// ---------- 2) جسر التطبيق (بمحاكاة الإضافة) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((q, r) => { const p = join(www, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
const bctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' }); await bctx.route('https://**', r => r.fulfill({ status: 404, body: '' }));
const page = await bctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:' + server.address().port + '/'); await page.waitForSelector('body.ready');
const res = await page.evaluate(async ([s1, s2]) => {
  const calls = [];
  window.Native = Object.assign({}, window.Native, { isNative: true, BackgroundRunner: { dispatchEvent: async o => { calls.push(JSON.parse(JSON.stringify(o))); if (o.event === 'collect') return { found: [{ id: 'sc1', t: 'Bg Work', d: '2026-01-02', st: 'St', ps: [s1, s2] }] }; return {}; }, requestPermissions: async () => ({ notifications: 'granted' }) } });
  LS.set('vkte_stash', 'K');
  const A = { id: 'ad', name: 'Adult Bg', birth: '1990-01-01', stashId: s1, photos: [], works: [], tags: [], lists: [], added: Date.now(), updated: Date.now() };
  const M = { id: 'mn', name: 'Minor Bg', birth: '2015-01-01', stashId: s2, photos: [], works: [], tags: [], lists: [], added: Date.now(), updated: Date.now() };
  items.push(A, M);
  await BgNative.setEnabled(true); const cfg = calls.filter(c => c.event === 'config').pop();
  const n = await BgNative.collect();
  return { avail: BgNative.available(), ids: cfg.details.ids.map(x => x.s), on: cfg.details.on, key: cfg.details.key, n, aw: (A.works || []).map(w => w.t), mw: (M.works || []).length };
}, [SID(1), SID(2)]);
ok('التطبيق: يرسل للمشغّل البالغات فقط (بوابة +18 قبل أي طلب)', res.ids.length === 1 && res.ids[0] === SID(1) && res.on && res.key === 'K', JSON.stringify(res.ids));
ok('التطبيق: يدمج ما وُجد في الخلفية في أعمال الممثلة', res.n === 1 && res.aw.includes('Bg Work'), JSON.stringify(res));
ok('التطبيق: لا يضيف شيئًا لسجل قاصر', res.mw === 0);
ok('التطبيق: الإيقاف يرسل on:false وقائمة فارغة', await page.evaluate(async () => { const calls = []; Native.BackgroundRunner.dispatchEvent = async o => { calls.push(o); return {}; }; await BgNative.setEnabled(false); const c = calls.pop(); return c.details.on === false && c.details.ids.length === 0; }));
ok('الإعداد يظهر في إعدادات الاستديو على الجوال', await page.evaluate(async () => { await Studio.open({ v: 'settings' }); const r = !!document.querySelector('#mStudio [data-bgn]'); closeOv('ovStudio'); return r; }));
ok('لا أخطاء JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(results.join('\n')); console.log(`\n${results.length - failed}/${results.length} نجح`);
await browser.close(); server.close(); process.exit(failed ? 1 : 0);

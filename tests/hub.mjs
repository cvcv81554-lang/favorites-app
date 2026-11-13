// اختبار Favorites Hub + إضافة Nuvio من البداية للنهاية:
// - خادم Hub حقيقي (عملية منفصلة، بيانات مؤقتة) + خادم Real-Debrid وهمي يحاكي التوثيق الرسمي.
// - «الجوال»: تطبيق Favorites الحقيقي في متصفح، يستورد ملف النسخة التجريبي ثم يربط ويزامن عبر HTTP فعلي.
// - يتحقق من: المزامنة التلقائية (إضافة/حذف/تعديل)، الكتالوجات، الصفحات، المصادر، التشغيل، الأمان، بوابة +18، الأداء.
// يحتاج tests/out/sample-backup.json (يصنعه tests/run.mjs).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www'), sampleFile = join(root, 'tests', 'out', 'sample-backup.json');
if (!existsSync(sampleFile)) { console.error('شغّل tests/run.mjs أولًا'); process.exit(2); }
const results = []; let failed = 0;
process.on('exit', c => { if (c) console.log(results.join('\n')); });
const ok = (n, c, x = '') => { results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));

// ===== خادم الواجهة =====
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const web = http.createServer((q, r) => { const p = join(www, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); });
const webPort = await listen(web);

// ===== Real-Debrid وهمي =====
const RD = { calls: [], authorized: false, refreshes: 0, tokenSeq: 0, fail429: 0, dead: new Set() };
const TORS = [
  { id: 'T1', filename: 'StudioOne.26.11.02.Jane.Doe.Sample.Work.XXX.1080p.MP4-GRP', bytes: 2.1e9, status: 'downloaded', files: [{ id: 1, path: '/StudioOne.26.11.02.Jane.Doe.Sample.Work.1080p.mp4', bytes: 2.1e9, selected: 1 }, { id: 2, path: '/sample.mp4', bytes: 1e7, selected: 1 }] },
  { id: 'T2', filename: 'Unrelated.Movie.2019.1080p.BluRay', bytes: 9e9, status: 'downloaded', files: [{ id: 1, path: '/Unrelated.Movie.mkv', bytes: 9e9, selected: 1 }] },
  { id: 'T3', filename: 'Pack.Collection.Vol.1', bytes: 5e9, status: 'downloaded', files: [{ id: 1, path: '/a/Other.Thing.mp4', bytes: 2e9, selected: 1 }, { id: 2, path: '/a/Manual.Pick.Video.mkv', bytes: 3e9, selected: 1 }] },
];
const rdSrv = http.createServer(async (q, r) => { const u = new URL(q.url, 'http://x'); let b = ''; for await (const c of q) b += c; const f = new URLSearchParams(b); RD.calls.push(q.method + ' ' + u.pathname);
  const J = (s, o) => { r.writeHead(s, { 'Content-Type': 'application/json' }); r.end(o == null ? '' : JSON.stringify(o)); };
  if (u.pathname === '/oauth/v2/device/code') return J(200, { device_code: 'DEV1', user_code: 'ABCD1234', interval: 5, expires_in: 1800, verification_url: 'https://real-debrid.com/device' });
  if (u.pathname === '/oauth/v2/device/credentials') return RD.authorized ? J(200, { client_id: 'CID', client_secret: 'CSECRET' }) : J(403, { error: 'authorization_pending', error_code: 9 });
  if (u.pathname === '/oauth/v2/token') { if (f.get('client_secret') !== 'CSECRET') return J(400, { error: 'bad', error_code: 2 }); if (f.get('code') !== 'DEV1') RD.refreshes++;
    return J(200, { access_token: 'AT' + (++RD.tokenSeq), refresh_token: 'RT', expires_in: RD.tokenSeq === 1 ? 1 : 3600, token_type: 'Bearer' }); }
  const auth = q.headers.authorization || ''; if (!/^Bearer AT\d+$/.test(auth)) return J(401, { error: 'bad_token', error_code: 8 });
  if (RD.fail429 > 0) { RD.fail429--; r.writeHead(429, { 'Retry-After': '1', 'Content-Type': 'application/json' }); return r.end('{"error":"too_many_requests","error_code":34}'); }
  const P = u.pathname.replace('/rest/1.0', '');
  if (P === '/user') return J(200, { username: 'tester', type: 'premium', expiration: '2027-01-01T00:00:00.000Z' });
  if (P === '/torrents') return J(200, +u.searchParams.get('page') > 1 ? [] : TORS.map(({ files, ...t }) => ({ ...t, links: files.map(x => 'https://real-debrid.com/d/' + t.id + x.id) })));
  if (P.startsWith('/torrents/info/')) { const t = TORS.find(t => t.id === P.slice(15)); if (!t) return J(404, { error: 'unknown_ressource', error_code: 7 }); return J(200, { ...t, links: t.files.filter(x => x.selected).map(x => 'https://real-debrid.com/d/' + t.id + x.id) }); }
  if (P === '/downloads') return J(200, [{ id: 'D1', filename: 'Studio.Two.Jane.Doe.Sample.Work.1-2.720p.mp4', filesize: 8e8, link: 'https://hoster.example/file/abc', download: 'https://dl.example/old', generated: '2026-01-01' }]);
  if (P === '/unrestrict/link') { const l = f.get('link'); if (RD.dead.has(l)) return J(503, { error: 'unavailable_file', error_code: 24 }); return J(200, { id: 'U', filename: l.split('/').pop() + '.mp4', filesize: 123, link: l, download: 'https://download.example/' + encodeURIComponent(l) + '?t=' + RD.tokenSeq, streamable: 1 }); }
  if (P === '/torrents/addMagnet') return J(201, { id: 'T3', uri: '' });
  return J(404, { error: 'unknown', error_code: 3 });
});
const rdPort = await listen(rdSrv);

// ===== تشغيل Hub =====
const dataDir = mkdtempSync(join(tmpdir(), 'favhub-'));
const HUBP = 7800 + Math.floor(Math.random() * 150);
const hub = spawn(process.execPath, [join(root, 'hub', 'server.mjs')], { env: { ...process.env, FAV_HUB_PORT: String(HUBP), FAV_HUB_DATA: dataDir, FAV_RD_BASE: 'http://127.0.0.1:' + rdPort, FAV_HUB_NO_DPAPI: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let hubLog = ''; hub.stdout.on('data', d => hubLog += d); hub.stderr.on('data', d => hubLog += d);
const H = 'http://127.0.0.1:' + HUBP;
for (let i = 0; i < 50; i++) { try { if ((await fetch(H + '/health')).ok) break; } catch {} await sleep(150); }
const get = async (p, o) => { const r = await fetch(H + p, o); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t, h: r.headers }; };
const admin = (p, b) => get(p, b ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fav-Admin': '1' }, body: JSON.stringify(b) } : undefined);
let st = (await admin('/api/status')).j;
ok('الخادم يعمل ولوحة التحكم تعطي رمزًا ورابط إضافة', st && /^\d{6}$/.test(st.code) && /\/a\/[\w-]{30,}\/manifest\.json$/.test(st.addon), JSON.stringify(st && { code: st.code }));
const A = st.addon.replace(/\/manifest\.json$/, '').replace('http://127.0.0.1:' + HUBP, '');
const addon = p => get(A + p);

// ===== الجوال =====
let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' }); const Ph = await ctx.newPage(); const phErr = [];
Ph.on('pageerror', e => phErr.push(e.message));
await Ph.goto('http://127.0.0.1:' + webPort + '/'); await Ph.waitForSelector('body.ready'); await Ph.evaluate(() => document.getElementById('nHome').click());
await Ph.click('#bSet'); await Ph.setInputFiles('#fImp', sampleFile); await Ph.waitForSelector('#ovAsk.show #aOk'); await Ph.click('#aOk');
await Ph.waitForFunction(() => items.length >= 17 && !document.querySelector('#busy.show')); await Ph.waitForTimeout(2600); await Ph.waitForSelector('body.ready');
ok('في الإعدادات قسم Nuvio', await Ph.evaluate(() => !!document.getElementById('hbOpen')));
const wrong = await Ph.evaluate(async h => { try { await Sync.hub.pair(h, '000000'); return 'paired'; } catch (e) { return e.message; } }, '127.0.0.1:' + HUBP);
ok('رمز خاطئ يُرفض برسالة واضحة', /الرمز غير صحيح/.test(wrong), wrong.slice(0, 70));
await Ph.evaluate(([h, c]) => Sync.hub.pair(h, c), ['127.0.0.1:' + HUBP, st.code]);
let t0 = Date.now(); const r1 = await Ph.evaluate(() => Sync.hub.syncNow(false));
ok('المزامنة الأولى: كل الممثلات والصور وصلت للخادم', r1.sent === 17 && r1.photos >= 40, JSON.stringify(r1) + ' · ' + (Date.now() - t0) + 'ms');
st = (await admin('/api/status')).j;
ok('لوحة التحكم تعرض آخر مزامنة وعدد المكتبة', st.last && st.last.sent === 17 && st.counts.perf === 17 && st.counts.photos >= 40, JSON.stringify(st.counts));
const r2 = await Ph.evaluate(() => Sync.hub.syncNow(false));
ok('مزامنة ثانية بلا تغييرات لا ترسل شيئًا (منع التكرار)', r2.sent === 0 && r2.photos === 0, JSON.stringify(r2));
ok('مزامنة الشاشة لم تُربط (الرابطان مستقلان)', await Ph.evaluate(() => !Sync.cfg() && !!Sync.hub.cfg()));

// ===== الإضافة =====
const man = (await addon('/manifest.json')).j;
ok('manifest صالح: اسم Favorites وموارد catalog/meta/stream', man && man.name === 'Favorites' && man.resources.length === 3 && man.catalogs.length >= 9 && man.idPrefixes.includes('favp:'), man && man.catalogs.map(c => c.id).join(','));
const cat = async (t, id, ex = '') => (await addon(`/catalog/${t}/${id}${ex ? '/' + ex : ''}.json`)).j.metas;
const favs = await cat('series', 'fav_p_fav'), all = await cat('series', 'fav_p_all'), newest = await cat('series', 'fav_p_new');
const sample = JSON.parse(readFileSync(sampleFile, 'utf8')).items;
ok('«ممثلاتي المفضلات» تعرض المفضلات فقط', favs.length > 0 && favs.length === sample.filter(i => i.fav && i.id !== 'sample-minor').filter(i => all.some(m => m.id === 'favp:' + i.id)).length && favs.every(m => /♥/.test(m.description)), favs.length + ' / ' + all.length);
ok('«كل مكتبتي» = 17 ممثلة (سجل القاصر مرفوض)', all.length === 17, String(all.length));
ok('«أحدث الممثلات» مرتبة بتاريخ الإضافة', newest[0] && newest[0].id === 'favp:' + [...sample].filter(i => all.some(m => m.id === 'favp:' + i.id)).sort((a, b) => b.added - a.added)[0].id);
ok('الصور: رابط من الخادم يعمل', await (async () => { const p = all.find(m => m.poster && m.poster.includes('/img/')); if (!p) return false; const r = await fetch(p.poster); return r.ok && /^image\//.test(r.headers.get('content-type')); })());
const srch = await cat('series', 'fav_p_all', 'search=' + encodeURIComponent('نموذج 1'));
ok('البحث في الممثلات', srch.length >= 1 && srch.every(m => m.name.includes('نموذج 1')), srch.map(m => m.name).join('،'));
const wk = await cat('movie', 'fav_w_mine'), wn = await cat('movie', 'fav_w_new'), wu = await cat('movie', 'fav_w_upc'), wr = await cat('movie', 'fav_w_recs');
ok('كتالوجات الأعمال: أعمال ممثلاتي/الأحدث/القادمة/الاقتراحات', wk.length > 5 && wn.length >= wk.length && wu.length >= 1 && wr.length >= 1, [wk.length, wn.length, wu.length, wr.length].join('/'));
ok('القادمة لا تظهر في «أعمال ممثلاتي»', !wu.some(u => wk.some(w => w.id === u.id)));
ok('الاقتراحات: أعمال لم تُشاهد مع السبب', wr.every(m => m.description) && wr.length < wk.length + wu.length, wr[0] && wr[0].description);
const by = man.catalogs.find(c => c.id === 'fav_w_by'); const nm = by.extra[0].options[0];
const wb = await cat('movie', 'fav_w_by', 'genre=' + encodeURIComponent(nm));
ok('الأعمال حسب ممثلة', wb.length >= 1 && wb.every(m => m.description.includes(nm)), nm + ': ' + wb.length);
// صفحة ممثلة وعمل
const pm = (await addon(`/meta/series/${encodeURIComponent('favp:sample-1')}.json`)).j.meta;
ok('صفحة الممثلة: بيانات + صور + أعمالها كحلقات', pm && pm.name === 'نموذج 1' && pm.poster && pm.videos.length === sample[0].works.length && pm.videos.every(v => /^favw:/.test(v.id)), pm && pm.videos.length + ' vids');
const wm = (await addon(`/meta/movie/${encodeURIComponent(pm.videos[0].id)}.json`)).j.meta;
ok('صفحة العمل: التفاصيل والممثلات ورابط للممثلة', wm && wm.cast.includes('نموذج 1') && wm.links.some(l => l.category === 'Cast' && l.url.includes('favp%3Asample-1')), wm && wm.name);
const ids1 = pm.videos.map(v => v.id).join(); const pm2 = (await addon(`/meta/series/${encodeURIComponent('favp:sample-1')}.json`)).j.meta;
ok('المعرّفات ثابتة بين الطلبات', ids1 === pm2.videos.map(v => v.id).join());
// الترقيم
const big = await (async () => { const st2 = await admin('/api/users', { create: 'كبير' }); const u2 = st2.j.users.find(u => u.name === 'كبير'); const s2 = (await admin('/api/status?user=' + u2.id)).j;
  const arr = []; for (let i = 0; i < 300; i++) arr.push({ id: 'big-' + i, name: 'Perf ' + i, aliases: '', fav: i % 3 === 0, rating: i % 5, added: 1e12 + i, updated: 1, tags: ['t' + (i % 7)], lists: [], photos: [], thumb: '',
    works: Array.from({ length: 16 }, (_, k) => ({ t: 'Scene ' + i + '-' + k, s: 'Studio ' + (k % 9), y: '2025', d: '2025-0' + (1 + k % 9) + '-1' + (k % 9), a: 1e12 + i * 20 + k, tg: ['t' + (k % 7)] })) });
  for (let k = 0; k < arr.length; k += 50) await fetch(`${H}/items?k=${s2.code}`, { method: 'POST', body: JSON.stringify({ items: arr.slice(k, k + 50) }) });
  return { u2, s2 }; })();
const B = big.s2.addon.replace(/\/manifest\.json$/, '').replace('http://127.0.0.1:' + HUBP, '');
t0 = Date.now(); const p1 = (await get(B + '/catalog/movie/fav_w_mine.json')).j.metas; const tCold = Date.now() - t0;
const p2 = (await get(B + '/catalog/movie/fav_w_mine/skip=100.json')).j.metas;
t0 = Date.now(); await get(B + '/catalog/movie/fav_w_mine.json'); const tWarm = Date.now() - t0;
ok('الترقيم: 100 لكل صفحة بلا تكرار', p1.length === 100 && p2.length === 100 && !p2.some(x => p1.some(y => y.id === x.id)));
ok('الأداء: مكتبة 300 ممثلة / 4800 عمل', tCold < 600 && tWarm < 60, `أول طلب ${tCold}ms، من الذاكرة ${tWarm}ms`);
// العزل بين المستخدمين
ok('مستخدم ثانٍ لا يرى مكتبة الأول', !(await get(B + '/catalog/series/fav_p_all.json')).j.metas.some(m => m.id === 'favp:sample-1') && (await get(B + `/meta/series/${encodeURIComponent('favp:sample-1')}.json`)).j.meta === null);
const img1 = all.find(m => m.poster && m.poster.includes('/img/')).poster.split('/img/')[1];
ok('صور مستخدم لا تُفتح برابط مستخدم آخر', (await get(B + '/img/' + img1)).s === 404);

// ===== المزامنة التلقائية من التطبيق (بلا ضغط زر) =====
await Ph.evaluate(async () => { const it = { id: 'auto-new', name: 'Auto Added', aliases: '', country: '', birth: '1990-01-01', works: [{ t: 'Auto Work', s: 'Auto Studio', y: '2025', d: '2025-05-05' }], tags: [], notes: '', photos: [], thumb: '', lists: [], rating: 3, fav: true, added: Date.now(), updated: Date.now() }; normItem(it); items.push(it); await save(it); });
const waitFor = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return Date.now() - t; await sleep(400); } return -1; };
let dt = await waitFor(async () => (await cat('series', 'fav_p_new'))[0]?.id === 'favp:auto-new');
ok('إضافة ممثلة في التطبيق تظهر في Nuvio تلقائيًا', dt >= 0, dt >= 0 ? 'بعد ' + (dt / 1000).toFixed(1) + ' ث' : 'لم تصل');
ok('…وتظهر في «ممثلاتي المفضلات»', (await cat('series', 'fav_p_fav')).some(m => m.id === 'favp:auto-new'));
await Ph.evaluate(async () => { const a = items.find(i => i.id === 'sample-2'); a.rating = 5; a.name = 'نموذج 2 معدّل'; a.updated = Date.now(); await save(a); });
dt = await waitFor(async () => (await addon(`/meta/series/${encodeURIComponent('favp:sample-2')}.json`)).j.meta?.name === 'نموذج 2 معدّل');
ok('تعديل معلومات ممثلة يصل تلقائيًا', dt >= 0, dt >= 0 ? (dt / 1000).toFixed(1) + ' ث' : '');
await Ph.evaluate(async () => { const a = items.find(i => i.id === 'sample-2'); a.works.push({ t: 'Brand New Scene', s: 'Studio Nine', y: '2026', d: '2026-01-03', a: Date.now() }); a.updated = Date.now(); await save(a); });
dt = await waitFor(async () => (await cat('movie', 'fav_w_new'))[0]?.name === 'Brand New Scene');
ok('عمل جديد لممثلة يظهر في «أحدث الأعمال» تلقائيًا', dt >= 0);
await Ph.evaluate(async () => { const a = items.find(i => i.id === 'auto-new'); items = items.filter(i => i !== a); await DB.del(a.id); });
dt = await waitFor(async () => !(await cat('series', 'fav_p_all')).some(m => m.id === 'favp:auto-new'));
ok('حذف ممثلة من التطبيق يختفي من Nuvio تلقائيًا', dt >= 0 && (await addon(`/meta/series/${encodeURIComponent('favp:auto-new')}.json`)).j.meta === null && !(await cat('movie', 'fav_w_mine')).some(m => m.name === 'Auto Work'));
// القوائم المختارة
await admin('/api/expose', { ids: ['list-a'] });
const man2 = (await addon('/manifest.json')).j; const lc = man2.catalogs.find(c => c.id === 'fav_l_list-a');
ok('القوائم التي تختارها تظهر ككتالوج', !!lc && !man2.catalogs.some(c => c.id === 'fav_l_list-b'), lc && lc.name);
ok('كتالوج القائمة غير المختارة لا يُعرض', (await cat('series', 'fav_l_list-b')).length === 0);
st = (await admin('/api/status')).j;
ok('سجل التغييرات يسجّل الأحداث', st.changes.length >= 4 && st.changes.some(c => c.op === 'del') && st.changes.some(c => c.op === 'put'), st.changes.map(c => c.op).join(','));

// ===== بوابة +18 =====
const code = st.code;
const minor = await (await fetch(`${H}/items?k=${code}`, { method: 'POST', body: JSON.stringify({ items: [{ id: 'minor-x', name: 'X', birth: String(new Date().getFullYear() - 16) + '-01-01', works: [{ t: 'Y' }] }, { id: 'minor-y', name: 'Y', birth: String(new Date().getFullYear() - 18), works: [] }] }) })).json();
ok('بوابة +18: سجل أقل من 18 (أو سنة ناقصة غير مؤكدة) لا يُخزَّن ولا يُعرض', minor.n === 0 && !(await cat('series', 'fav_p_all')).some(m => /minor/.test(m.id)), JSON.stringify(minor));
// تكرار نفس الطلب لا يُنشئ تغييرًا
const one = JSON.parse(JSON.stringify((await (await fetch(`${H}/get?k=${code}`, { method: 'POST', body: JSON.stringify({ ids: ['sample-1'] }) })).json()).items));
const seq0 = (await admin('/api/status')).j.changes[0].seq; const rep = await (await fetch(`${H}/items?k=${code}`, { method: 'POST', body: JSON.stringify({ items: one }) })).json();
ok('إعادة إرسال نفس البيانات لا تُكرر العملية', rep.n === 0 && (await admin('/api/status')).j.changes[0].seq === seq0);

// ===== الأمان =====
ok('رابط إضافة خاطئ = 404', (await get('/a/' + 'x'.repeat(32) + '/manifest.json')).s === 404);
const rawHost = await new Promise(res => { const rq = http.request({ host: '127.0.0.1', port: HUBP, path: '/api/status', headers: { Host: 'evil.example' } }, r => { r.resume(); res(r.statusCode); }); rq.end(); });
ok('لوحة التحكم ترفض Host غريب (حماية DNS rebinding)', rawHost === 403, String(rawHost));
ok('أوامر اللوحة تتطلب ترويسة خاصة (حماية CSRF)', (await get('/api/rd/unlink', { method: 'POST', body: '{}' })).s === 403);
const tokNow = st.addon.split('/a/')[1].split('/')[0], rawCfg = readFileSync(join(dataDir, 'hub.json'), 'utf8');
ok('رمز الربط ورابط الإضافة لا يظهران نصًا على القرص', !rawCfg.includes(tokNow) && !rawCfg.includes('"' + st.code + '"') && !/"code"|"addon"/.test(rawCfg), [rawCfg.includes(tokNow), rawCfg.includes(st.code)].join());
// ===== المصادر بلا Real-Debrid =====
const sNo = (await addon(`/stream/movie/${encodeURIComponent(pm.videos[0].id)}.json`)).j.streams;
ok('بلا Real-Debrid: لا نعرض مصدرًا وهميًا', sNo.every(s => !s.url), JSON.stringify(sNo).slice(0, 120));

// ===== ربط Real-Debrid (device flow) =====
const s1 = (await admin('/api/rd/start', {})).j;
ok('بدء الربط يعطي رمز Real-Debrid ورابط التحقق', s1.code === 'ABCD1234' && /real-debrid\.com\/device/.test(s1.url));
ok('قبل الموافقة: الحالة انتظار', (await admin('/api/rd/poll', {})).j.state === 'waiting');
RD.authorized = true; ok('بعد الموافقة: مربوط', (await admin('/api/rd/poll', {})).j.state === 'linked');
ok('الرموز محفوظة مشفّرة', !readFileSync(join(dataDir, 'hub.json'), 'utf8').match(/CSECRET|AT1|"RT"/));
await sleep(1200);  // الرمز الأول صلاحيته ثانية واحدة ← يجب أن يتجدد تلقائيًا
st = (await admin('/api/status')).j;
ok('تجديد الرمز تلقائيًا عند انتهائه', st.rd.linked && st.rd.user && st.rd.user.name === 'tester' && RD.refreshes >= 1, 'refreshes ' + RD.refreshes);
RD.fail429 = 2; const ref = (await admin('/api/rd/refresh', {})).j;
ok('فهرس الحساب يُبنى (مع تجاوز 429 بإعادة المحاولة)', ref.tor === 3 && ref.dl === 1, JSON.stringify(ref));
// عمل يطابق ملفًا في الحساب: Sample Work 1-2 (Studio Two, 2026-11-02) لنموذج 1… نضيف اسمًا لاتينيًا لنموذج 1 ليطابق
await Ph.evaluate(async () => { const a = items.find(i => i.id === 'sample-1'); a.aliases = 'Jane Doe'; a.works.push({ t: 'Sample Work', s: 'StudioOne', y: '2026', d: '2026-11-02' }); a.updated = Date.now(); await save(a); });
await Ph.evaluate(() => Sync.hub.syncNow(false));
const W = (await cat('movie', 'fav_w_mine', 'search=Sample%20Work')).find(m => m.name === 'Sample Work');
const ss = (await addon(`/stream/movie/${encodeURIComponent(W.id)}.json`)).j.streams;
ok('مصدر من حسابك يُطابق العمل (ويُستبعد ملف sample)', ss.length === 1 && /1080p/.test(ss[0].name) && /Jane\.Doe\.Sample\.Work/.test(ss[0].title), JSON.stringify(ss.map(s => s.title)));
const pr = await fetch(ss[0].url, { redirect: 'manual' });
ok('التشغيل: الرابط يتحول لرابط Real-Debrid مباشر', pr.status === 302 && /^https:\/\/download\.example\//.test(pr.headers.get('location')), pr.status + ' ' + pr.headers.get('location'));
const ready = await cat('movie', 'fav_w_ready');
ok('«جاهزة للمشاهدة» تعرض فقط ما له مصدر فعلي', ready.some(m => m.id === W.id) && ready.length <= 3, ready.map(m => m.name).join('،'));
const s12 = (await addon(`/stream/movie/${encodeURIComponent((await cat('movie', 'fav_w_mine', 'search=Sample%20Work%201-2')).find(m => m.name === 'Sample Work 1-2').id)}.json`)).j.streams;
ok('مطابقة من سجل التحميلات (روابط المواقع)', s12.some(s => s.url && /720p/.test(s.name)), JSON.stringify(s12.map(s => s.name)));
const unrel = (await addon(`/stream/movie/${encodeURIComponent(wk[wk.length - 1].id)}.json`)).j.streams;
ok('عمل بلا ملف في الحساب: لا مصدر وهمي', unrel.every(s => !s.url));
// ربط يدوي
const target = (await admin('/api/works', { q: 'Auto' })).j.works; const tw = (await admin('/api/works', { q: 'Sample Work 1-1' })).j.works[0];
const se = (await admin('/api/rd/search', { q: 'Manual Pick' })).j; const pickT = (await admin('/api/rd/search', { q: 'Pack Collection' })).j.tor[0];
await admin('/api/attach', { work: tw.id, kind: 'tor', ref: pickT.id, name: pickT.name });
const sm = (await addon(`/stream/movie/${encodeURIComponent(tw.id)}.json`)).j.streams;
ok('ربط يدوي لملف من حسابك يظهر كمصدر', sm.filter(s => /رابطك/.test(s.title)).length === 2, JSON.stringify(sm.map(s => s.title.split('\n')[0])) + ' ' + target.length + ' ' + se.tor.length);
RD.dead.add('https://real-debrid.com/d/T32'); const dead = sm.find(s => /Manual\.Pick/.test(s.title)); const dr = await fetch(dead.url, { redirect: 'manual' });
ok('ملف غير متاح: رسالة خطأ واضحة بدل التشغيل', dr.status === 502 && /غير متاح/.test(await dr.text()));
await admin('/api/rd/unlink', {}); st = (await admin('/api/status')).j;
ok('إلغاء ربط Real-Debrid', !st.rd.linked && (await addon(`/stream/movie/${encodeURIComponent(W.id)}.json`)).j.streams.every(s => !s.url));
// إلغاء رابط الإضافة
await admin('/api/addon/rotate', {});
ok('إلغاء رابط الإضافة يوقفه فورًا', (await addon('/manifest.json')).s === 404);
ok('التطبيق بلا أخطاء JavaScript', phErr.length === 0, phErr.join(' | ').slice(0, 200));
// ===== تحمّل الأخطاء: حد المحاولات =====
let last = 0; for (let i = 0; i < 12; i++) last = (await get('/hello?k=111111')).s;
ok('محاولات رمز خاطئة كثيرة تُحظر مؤقتًا (429)', last === 429);

await browser.close(); hub.kill(); web.close(); rdSrv.close();
console.log(results.join('\n'));
console.log(failed ? `\n${failed} FAILED of ${results.length}` : `\nALL ${results.length} PASSED`);
if (failed) console.log('--- hub log ---\n' + hubLog.slice(-3000));
process.exit(failed ? 1 : 0);

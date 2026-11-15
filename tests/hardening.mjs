// اختبارات الإصلاحات بعد مراجعة الجودة والأمان (Playwright في متصفح حقيقي):
// حقن HTML من نسخة احتياطية/مزامنة، بقاء معرّفات الأعمال عند التعديل، فشل الحفظ لا يُخفى،
// الاستيراد لا يمسح تعديلات أحدث، وقت التعديل يُحدَّث، محاولات القفل تبقى، /done أرقام فقط،
// ودمج المكررات ينقل صور الاستديو.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), www = join(root, 'www');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((q, r) => { const p = join(www, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const results = []; let failed = 0;
const ok = (n, c, x = '') => { results.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); if (!c) failed++; };
let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.dismiss());
await ctx.route('https://**', r => r.fulfill({ status: 404, body: '' }));   // لا شبكة خارجية
await page.goto(base); await page.waitForSelector('body.ready');
const yes = async () => { await page.waitForSelector('#ovAsk.show #aOk'); await page.click('#ovAsk.show #aOk'); };

// ---------- 1) نسخة احتياطية خبيثة لا تنفّذ كودًا ----------
await page.evaluate(() => { window.__pwn = 0; });
const imp = page.evaluate(() => Backup.importJson({ app: 'vkte-favorites', v: 5, items: [
  { id: 'evil-1', name: 'Evil Photo', photos: ['https://x.test/a.jpg" onerror="window.__pwn=1'], thumb: 'https://x.test/t.jpg" onload="window.__pwn=2', works: [{ t: 'W', p: 'javascript:window.__pwn=3', u: 'javascript:alert(1)' }], updated: 1 },
  { id: 'x" onfocus="window.__pwn=4', name: 'Evil Id', photos: [], updated: 1 },
  { id: 'good-1', name: 'Good One', birth: '1990-01-01', photos: ['https://img.test/ok.jpg'], works: [{ t: 'Fine', s: 'S', y: '2020' }], updated: 1 }] }));
await yes(); await imp; await page.waitForTimeout(400);
const evil = await page.evaluate(() => { const e = items.find(i => i.id === 'evil-1'); document.getElementById('nHome').click(); render(true);
  return { evilPhotos: e ? e.photos.length : -1, evilThumb: e ? e.thumb : '', badId: items.some(i => /"/.test(i.id)), good: !!items.find(i => i.id === 'good-1'), wp: e && e.works[0] ? (e.works[0].p || '') + '|' + (e.works[0].u || '') : '' }; });
await page.waitForTimeout(500);
const pwn = await page.evaluate(() => window.__pwn);
ok('نسخة خبيثة: صور فيها حقن تُرفض', evil.evilPhotos === 0 && evil.evilThumb === '', JSON.stringify(evil));
ok('نسخة خبيثة: معرّف فيه علامات اقتباس يُرفض', !evil.badId && evil.good);
ok('نسخة خبيثة: روابط javascript: في الأعمال تُنظَّف', !/javascript/i.test(evil.wp), evil.wp);
ok('لا كود منفّذ من البيانات المستوردة', pwn === 0, 'pwn=' + pwn);

// ---------- 2) تعديل ممثلة بالنموذج يحفظ معرّفات الأعمال ----------
await page.evaluate(async () => { const it = items.find(i => i.id === 'good-1'); it.works = [{ t: 'Fine', s: 'S', y: '2020', ip: 'tp-uuid-1', is: 'st-uuid-1', im: 'tt1234567', tm: '42', w: 1 }]; await save(it); openDetail('good-1'); });
await page.waitForTimeout(400); await page.click('#dEdit'); await page.waitForSelector('#ovForm.show #fSave'); await page.click('#fSave'); await page.waitForTimeout(600);
const ids = await page.evaluate(() => { const w = items.find(i => i.id === 'good-1').works[0]; return [w.ip, w.is, w.im, w.tm, w.w].join(','); });
ok('تعديل وحفظ بالنموذج يُبقي معرّفات العمل (ip/is/im/tm)', ids === 'tp-uuid-1,st-uuid-1,tt1234567,42,1', ids);

// ---------- 3) فشل الحفظ لا يُخفى: النموذج يبقى مفتوحًا ----------
await page.evaluate(() => { closeOv('ovDetail'); window.__put = DB.put; DB.put = () => Promise.reject(new Error('QuotaExceededError')); document.getElementById('bAdd').click(); });
await page.waitForSelector('#ovForm.show #fName'); await page.fill('#fName', 'Will Fail'); await page.evaluate(() => { const a = document.getElementById('fAdult'); if (a) a.checked = true; });
const n0 = await page.evaluate(() => items.length);
await page.click('#fSave'); await page.waitForTimeout(600);
const fs = await page.evaluate(n0 => ({ open: document.getElementById('ovForm').classList.contains('show'), toast: document.getElementById('toast').textContent, n: items.length, n0 }), n0);
ok('فشل الحفظ: النموذج يبقى ببياناته ولا تظهر «تم الحفظ»', fs.open && !/تم الحفظ/.test(fs.toast) && fs.n === fs.n0, JSON.stringify(fs));
await page.evaluate(() => { DB.put = window.__put; closeOv('ovForm'); });

// ---------- 4) الاستيراد لا يمسح تعديلات أحدث عند نقص الصور ----------
await page.evaluate(async () => { const it = items.find(i => i.id === 'good-1'); it.rating = 5; it.notes = 'تعديل أحدث'; it.updated = Date.now(); await save(it); });
const imp2 = page.evaluate(() => Backup.importJson({ app: 'vkte-favorites', v: 5, items: [{ id: 'good-1', name: 'Good One', birth: '1990-01-01', rating: 2, notes: 'قديم', updated: 5, photos: ['https://img.test/ok.jpg', 'https://img.test/second.jpg'], works: [] }] }));
await yes(); await imp2; await page.waitForTimeout(300);
const m = await page.evaluate(() => { const it = items.find(i => i.id === 'good-1'); return { r: it.rating, n: it.notes, ph: it.photos.length, w: it.works.length }; });
ok('استيراد نسخة أقدم: تُضاف الصور الناقصة وتبقى تعديلاتك', m.r === 5 && m.n === 'تعديل أحدث' && m.ph === 2 && m.w === 1, JSON.stringify(m));

// ---------- 4ب) صور بصيغة النسخة الحقيقية (data:) لا تتكرر عند الإكمال ----------
const dupPh = await page.evaluate(async () => { const px = (c) => { const k = document.createElement('canvas'); k.width = k.height = 8; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 8, 8); return k.toDataURL('image/jpeg', .9); };
  const a = px('#f00'), b = px('#0f0'), c = px('#00f'); const it = { id: 'ph-1', name: 'Photo Person', birth: '1990-01-01', photos: [a, b], works: [], tags: [], lists: [], rating: 4, updated: Date.now() }; items.push(it); await save(it);
  window.__f = { app: 'vkte-favorites', v: 5, items: [{ id: 'ph-1', name: 'Photo Person', birth: '1990-01-01', photos: [a, b, c], works: [], rating: 1, updated: 5 }] }; return items.find(i => i.id === 'ph-1').photos.length; });
const imp3 = page.evaluate(() => Backup.importJson(window.__f)); await yes(); await imp3; await page.waitForTimeout(300);
const ph3 = await page.evaluate(() => { const it = items.find(i => i.id === 'ph-1'); return { n: it.photos.length, r: it.rating }; });
ok('إكمال الصور من نسخة حقيقية (data:) بلا تكرار، وتبقى تعديلاتك', ph3.n === 3 && ph3.r === 4, JSON.stringify({ before: dupPh, ...ph3 }));
const apos = await page.evaluate(() => { const w = [{ t: 'X', u: "https://site.test/scenes/it's-fine", p: "https://img.test/it's.jpg" }]; safeWorks(w); return (w[0].u || '') + '|' + (w[0].p || ''); });
ok('روابط صحيحة فيها فاصلة عليا تبقى (لا حلقة مزامنة)', /it's-fine/.test(apos) && /it's\.jpg/.test(apos), apos);

// ---------- 5) أزرار العمل والمفضلة تحدّث وقت التعديل ----------
const up = await page.evaluate(async () => { const it = items.find(i => i.id === 'good-1'); it.updated = 1; await save(it); openDetail('good-1'); await new Promise(r => setTimeout(r, 300));
  const b = document.querySelector('#mDetail [data-wk]'); if (b) b.click(); await new Promise(r => setTimeout(r, 200)); const a = items.find(i => i.id === 'good-1').updated;
  document.getElementById('dFav').click(); await new Promise(r => setTimeout(r, 100)); return { wk: !!b, afterWork: a, afterFav: items.find(i => i.id === 'good-1').updated }; });
ok('زر «شاهدت» والمفضلة يحدّثان وقت التعديل (للاستيراد والمزامنة)', up.afterFav > 1000 && (!up.wk || up.afterWork > 1000), JSON.stringify(up));
await page.evaluate(() => closeOv('ovDetail'));

// ---------- 6) محاولات القفل الخاطئة تبقى بعد إعادة التشغيل ----------
await page.evaluate(async () => { const s = 'testsalt'; const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s + '|1234')))].map(b => b.toString(16).padStart(2, '0')).join(''); LS.set('vkte_pin2', JSON.stringify({ s, h, n: 4 })); });
await page.reload(); await page.waitForSelector('body.ready'); await page.waitForTimeout(300);
for (let k = 0; k < 5; k++) { for (const d of '9999') await page.evaluate(d => document.querySelector(`#lock [data-k="${d}"]`).click(), d); await page.waitForTimeout(80); }
await page.reload(); await page.waitForSelector('body.ready'); await page.waitForTimeout(300);
for (const d of '1234') await page.evaluate(d => document.querySelector(`#lock [data-k="${d}"]`).click(), d); await page.waitForTimeout(300);
const lk = await page.evaluate(() => ({ locked: document.getElementById('lock').classList.contains('show'), msg: document.getElementById('lockMsg').textContent }));
ok('القفل: إعادة فتح التطبيق لا تصفّر المحاولات الخاطئة', lk.locked && /انتظر/.test(lk.msg), JSON.stringify(lk));
await page.evaluate(() => { LS.del('vkte_pin2'); LS.del('vkte_lockf'); }); await page.reload(); await page.waitForSelector('body.ready');

// ---------- 7) /done على الشاشة: أرقام فقط ----------
const dn = await page.evaluate(async () => { await Sync.handle({ method: 'POST', path: '/done', body: JSON.stringify({ sent: '<img src=x onerror=window.__pwn=9>', photos: 3, evil: 'x' }) }); return LS.get('vkte_sync_last'); });
ok('/done يخزّن أرقامًا فقط', !/img|onerror|evil/.test(dn) && /"photos":3/.test(dn), dn);

// ---------- 8) دمج المكررات ينقل صور الاستديو ----------
const mg = await page.evaluate(async () => {
  const a = { id: 'dupA', name: 'Same Name', birth: '1991-01-01', photos: [], works: [], tags: [], lists: [], updated: 1, added: 1 }, b = { ...a, id: 'dupB', updated: 2, added: 2 };
  items.push(a, b); await save([a, b]); await Studio._test.load();
  Studio._test.IMG.set('imgB', { id: 'imgB', pid: 'dupB', url: 'https://img.test/b.jpg', src: 'stash', kind: 'portrait', found: Date.now(), albums: [] });
  document.getElementById('bSet').click(); await new Promise(r => setTimeout(r, 300)); document.getElementById('dupGo').click(); await new Promise(r => setTimeout(r, 600));
  const btn = [...document.querySelectorAll('#dupOut [data-dm]')].find(x => /dupA/.test(x.dataset.dm) && /dupB/.test(x.dataset.dm)); if (!btn) return 'no-dup-group'; btn.click(); await new Promise(r => setTimeout(r, 400));
  const row = document.querySelector('#ovAsk.show .v17row[data-id="dupA"]'); if (row) row.click(); document.getElementById('aOk').click(); await new Promise(r => setTimeout(r, 800));
  const x = Studio._test.IMG.get('imgB'); return x ? x.pid : 'deleted'; });
ok('دمج المكررات: صور الاستديو تنتقل للممثلة الباقية', mg === 'dupA', mg);

ok('لا أخطاء JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(results.join('\n')); console.log(`\n${results.length - failed}/${results.length} نجح`);
await browser.close(); server.close(); process.exit(failed ? 1 : 0);

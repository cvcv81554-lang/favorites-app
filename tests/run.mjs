// اختبار فعلي للواجهة عبر Playwright (متصفح Edge/Chrome المثبّت، بلا تنزيل متصفحات):
// 1) يصنع ملف نسخة احتياطية بصيغة التطبيق القديم (v5) بصور مجرّدة مولَّدة بالكانفس.
// 2) يستورده ويتحقق أن كل الحقول عادت كما هي (وأن بوابة +18 رفضت سجل القاصر).
// 3) يصوّر الشاشات على مقاس الجوال ومقاس التلفاز، ويختبر التنقل بأسهم الكيبورد.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www'), out = join(root, 'tests', 'out');
mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => { const p = join(www, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';

const results = []; let failed = 0;
const ok = (name, cond, extra = '') => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!cond) failed++; };
let browser;
for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel, headless: true }); break; } catch {} }
if (!browser) { console.error('لم أجد Edge أو Chrome'); process.exit(2); }

async function newPage(viewport, dpr, query = '') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, locale: 'ar', hasTouch: false });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + query); await page.waitForSelector('body.ready'); await page.evaluate(() => document.getElementById('nHome').click());
  return { ctx, page, errors };
}
const shot = (page, name) => page.screenshot({ path: join(out, name + '.png') });
const settle = (page, ms = 450) => page.waitForTimeout(ms);

// ---------- 1) ملف النسخة التجريبي ----------
const phone = await newPage({ width: 390, height: 844 }, 2);
const sample = await phone.page.evaluate(() => {
  const rnd = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const art = (seed, w, h, q) => { const r = rnd(seed * 7919 + 13), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const hue = Math.floor(r() * 360), g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, `hsl(${hue} 55% 34%)`); g.addColorStop(1, `hsl(${(hue + 70) % 360} 60% 20%)`); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { x.beginPath(); x.fillStyle = `hsla(${(hue + k * 37) % 360} 70% ${45 + r() * 25}% / ${0.25 + r() * 0.4})`; if (k % 3) x.arc(r() * w, r() * h, (0.08 + r() * 0.3) * w, 0, 7); else x.rect(r() * w, r() * h, r() * w * 0.5, r() * h * 0.4); x.fill(); }
    return c.toDataURL('image/jpeg', q); };
  const day = 864e5, now = Date.now(), iso = t => new Date(t).toISOString().slice(0, 10);
  const L1 = { id: 'list-a', name: 'قائمة تجريبية أ' }, L2 = { id: 'list-b', name: 'قائمة تجريبية ب' }, W1 = { id: 'wl-a', name: 'أعمال للسهرة' };
  const countries = ['US', 'Czech Republic', 'Spain', 'Japan', 'Brazil', ''], tags = ['نموذج', 'تجربة', 'مجرد', 'ألوان', 'HD'];
  const items = [];
  for (let n = 1; n <= 16; n++) {
    const r = rnd(n * 101), nph = n % 5 === 0 ? 0 : 1 + (n % 4), photos = Array.from({ length: nph }, (_, k) => art(n * 10 + k, 480, 640, 0.8));
    const works = Array.from({ length: n % 6 === 0 ? 0 : 2 + (n % 5) }, (_, k) => {
      const w = { t: `Sample Work ${n}-${k + 1}`, s: ['Studio One', 'Studio Two', 'North Films'][k % 3], y: String(2021 + (k % 5)), d: iso(now - (k * 40 - 30) * day - n * day) };
      w.y = w.d.slice(0, 4);
      if (k % 2 === 0) { w.w = 1; w.wd = iso(now - k * day); } if (k % 3 === 0) w.r = 3 + (k % 3); if (k === 1) { w.rec = 1; w.q = 1; } if (k === 2) { w.fav = 1; w.n = 'ملاحظة تجريبية على العمل'; w.ls = ['wl-a']; }
      if (k === 0) { w.a = now - 2 * day; w.p = 'https://example.invalid/poster.jpg'; w.du = 28 + k; w.ds = 'وصف تجريبي قصير للعمل.'; w.tg = ['tag-a', 'tag-b']; w.u = 'https://example.invalid/scene/' + n; }
      if (k === 3) { w.upc = 1; w.d = iso(now + (5 + n) * day); w.y = w.d.slice(0, 4); delete w.w; delete w.wd; }
      return w; });
    if (n === 2) works.push({ t: 'Shared Sample Work', s: 'Studio One', y: '2026', d: '2026-03-10' }); if (n === 3) works.push({ t: 'Shared Sample Work', s: 'Studio One', y: '2026', d: '2026-03-10', w: 1, wd: iso(now), r: 5 });
    const it = { id: 'sample-' + n, name: 'نموذج ' + n, aliases: n % 3 ? '' : `Sample ${n}, S${n}`, country: countries[n % countries.length], birth: n % 4 ? `${1988 + (n % 12)}-0${1 + (n % 9)}-1${n % 9}` : '',
      works, tags: tags.filter((_, k) => (n + k) % 3 === 0), notes: n % 2 ? 'ملاحظات تجريبية للسجل رقم ' + n : '', photos, thumb: photos[0] ? art(n * 10, 240, 320, 0.7) : '',
      lists: n % 3 === 0 ? ['list-a'] : n % 5 === 0 ? ['list-a', 'list-b'] : [], rating: n % 7 === 0 ? 0 : Math.round((2.5 + r() * 2.5) * 2) / 2, fav: n % 3 === 1,
      criteria: n % 4 === 1 ? { beauty: 5, charisma: 4, perf: 4, seduce: 3, body: 4, screen: 5, bold: 3, heat: 4 } : null,
      bodyD: n % 8 === 1 ? { face: 5, hair: 4, skin: 4, figure: 5, chest: 3, waist: 4, hips: 4, legs: 5 } : null,
      accounts: n % 2 ? [{ p: 'instagram', v: 'sample_' + n }, { p: 'website', v: 'example.invalid/' + n }] : [],
      added: now - n * 9 * day, updated: now - n * day, source: n % 2 ? 'إدخال يدوي' : 'StashDB (راجعتُه يدويًا)' };
    if (n % 4 === 1) it.rating = 4;
    if (n === 4) { it.pdbId = 'pdb-0004'; it.stashId = '00000000-0000-4000-8000-000000000004'; it.srcImgs = ['https://example.invalid/a.jpg']; it.worksAt = now - 3 * day; it.height = 168; it.cs = 2015; it.ce = 2024; it.ofId = 'sample4'; it.fsId = 'sample4fs'; it.thumbV = 2; it.customField = { keep: 'me' }; }
    items.push(it);
  }
  // سجل قاصر للتأكد من أن البوابة ترفضه، وسجل بصيغة v4 القديمة (أعمال نصية + معيار chem)
  items.push({ id: 'sample-minor', name: 'سجل مرفوض', birth: new Date(now - 16 * 365 * day).toISOString().slice(0, 10), works: [], tags: [], photos: [], rating: 0, added: now, updated: now });
  items.push({ id: 'sample-v4', name: 'نموذج قديم v4', aliases: '', country: 'France', birth: '1990-05-20', works: 'Old Title One | Old Studio | 2019\nOld Title Two (2020)', tags: ['قديم'], notes: '', photos: [art(999, 480, 640, 0.8)], thumb: '', lists: [], rating: 3.5, criteria: { beauty: 4, chem: 3 }, fav: false, updated: now - 50 * day });
  return { app: 'vkte-favorites', v: 5, exportedAt: now, items, lists: [L1, L2], wlists: [W1], prefs: { vkte_view: '2', vkte_sort: 'rating', vkte_rec_ignored: '["Ignored Sample"]', vkte_recent: '["sample-1","sample-2","sample-3"]' } };
});
const sampleFile = join(out, 'sample-backup.json');
writeFileSync(sampleFile, JSON.stringify(sample));
ok('ملف تجريبي مصنوع', sample.items.length === 18, `${sample.items.length} سجل، ${(JSON.stringify(sample).length / 1048576).toFixed(1)} MB`);

// ---------- 2) الاستيراد والتحقق ----------
await shot(phone.page, '01-phone-empty');
async function importSample(page) {
  await page.click('#bSet'); await settle(page);
  await page.setInputFiles('#fImp', sampleFile);
  await page.waitForSelector('#ovAsk.show #aOk'); const msg = await page.textContent('#mAsk p');
  await page.click('#aOk'); await page.waitForFunction(() => items.length >= 17 && !document.querySelector('#busy.show')); await settle(page, 900);
  return msg;
}
const msg = await importSample(phone.page);
ok('رسالة الاستيراد تذكر تجاوز القاصر', /سيُتجاوز 1 سجل/.test(msg), msg.slice(0, 90));
const check = await phone.page.evaluate(async src => {
  const exp = await exportItems(), by = new Map(exp.map(i => [i.id, i])), diffs = [];
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const s of src.items) { if (s.id === 'sample-minor') continue; const e = by.get(s.id); if (!e) { diffs.push(s.id + ': مفقود'); continue; }
    for (const k of Object.keys(s)) { if (s.id === 'sample-v4' && (k === 'works' || k === 'criteria' || k === 'thumb')) continue; if (k === 'thumbV') continue; if (k === 'thumb') { if (s.thumb && !e.thumb) diffs.push(s.id + '.thumb'); continue; } /* المصغّرات القديمة تُرقّى للدقة الأعلى تلقائيًا */ if (!eq(s[k], e[k])) diffs.push(s.id + '.' + k); } }
  const v4 = by.get('sample-v4');
  return { n: items.length, minor: items.some(i => i.id === 'sample-minor'), diffs, v4works: v4 && v4.works.map(w => w.t + '|' + w.s + '|' + w.y), v4crit: v4 && v4.criteria, v4thumb: !!(v4 && v4.thumb),
    lists: lists.length, wlists: wlists.length, sort: LS.get('vkte_sort'), ign: LS.get('vkte_rec_ignored'), blobs: items.every(i => (i.photos || []).every(p => p.startsWith('blob:'))) };
}, sample);
ok('عدد السجلات بعد الاستيراد = 17', check.n === 17, String(check.n));
ok('بوابة +18 رفضت سجل القاصر', check.minor === false);
ok('كل الحقول عادت كما هي (photos/thumb/works/criteria/bodyD/accounts/pdbId/stashId/srcImgs…)', check.diffs.length === 0, check.diffs.slice(0, 8).join(', '));
ok('ترحيل صيغة v4: الأعمال النصية ← مهيكلة', JSON.stringify(check.v4works) === JSON.stringify(['Old Title One|Old Studio|2019', 'Old Title Two||2020']), JSON.stringify(check.v4works));
ok('ترحيل صيغة v4: chem ← bold', check.v4crit && check.v4crit.bold === 3 && !('chem' in check.v4crit));
ok('القوائم وقوائم الأعمال والتفضيلات استُوردت', check.lists === 2 && check.wlists === 1 && check.sort === 'rating' && /Ignored Sample/.test(check.ign || ''));
ok('الصور مخزّنة Blob منفصلة', check.blobs);
await phone.page.waitForFunction(() => items.find(i => i.id === 'sample-v4').thumb, null, { timeout: 15000 }).catch(() => {});
ok('مصغّرة ناقصة وُلِّدت تلقائيًا', await phone.page.evaluate(() => !!items.find(i => i.id === 'sample-v4').thumb));

// إعادة التحميل: البيانات باقية في IndexedDB
await phone.page.reload(); await phone.page.waitForSelector('body.ready'); await settle(phone.page, 900);
ok('الرئيسية تفتح أولًا وفيها مختارة اليوم والأرفف', await phone.page.evaluate(() => document.getElementById('ovHome').classList.contains('show') && !!document.querySelector('#mHome .spot') && document.querySelectorAll('#mHome .hs').length >= 4));
await shot(phone.page, '00-phone-dashboard');
await phone.page.evaluate(() => { document.getElementById('mHome').scrollTop = 700; }); await settle(phone.page, 400); await shot(phone.page, '00b-phone-dashboard-2');
await phone.page.click('#nMore'); await settle(phone.page, 400); await shot(phone.page, '00c-phone-more');
// المواجهة: التصويت يغيّر نقاط Elo ويُحفظ
await phone.page.evaluate(() => Duel.open()); await settle(phone.page, 500); await shot(phone.page, '00d-phone-duel');
await phone.page.click('#mDuel .dc[data-v="1"]'); await settle(phone.page, 300); await phone.page.click('#mDuel .dc[data-v="0"]'); await settle(phone.page, 300);
ok('المواجهة تحدّث ترتيب Elo', await phone.page.evaluate(() => items.filter(i => i.duels > 0).length >= 2 && items.some(i => (i.elo || 1000) > 1000) && items.some(i => (i.elo || 1000) < 1000)));
await phone.page.click('#mDuel [data-tab="board"]'); await settle(phone.page, 300); ok('لوحة الترتيب تعرض المتواجهات', await phone.page.locator('#mDuel .dboard .v17row').count() >= 2); await phone.page.keyboard.press('Escape');
// المستويات: التوزيع التلقائي من التقييم
await phone.page.evaluate(() => Tier.open()); await settle(phone.page, 400); await phone.page.click('#mTier [data-auto]'); await phone.page.click('#aOk'); await settle(phone.page, 500); await shot(phone.page, '00e-phone-tiers');
ok('المستويات وُزّعت تلقائيًا', await phone.page.evaluate(() => items.filter(i => i.tier).length >= 10 && items.find(i => i.id === 'sample-1').tier === 'A')); await phone.page.keyboard.press('Escape');
await phone.page.evaluate(() => document.getElementById('nHome').click()); await phone.page.waitForSelector('.card'); await settle(phone.page, 500);
ok('البيانات باقية بعد إعادة التشغيل', await phone.page.evaluate(() => items.length) === 17);
await shot(phone.page, '02-phone-home');

// ---------- 3) شاشات الجوال ----------
const P = phone.page;
await P.click('.card[data-id="sample-1"]'); await settle(P, 900); await shot(P, '03-phone-detail');
await P.evaluate(() => { const m = document.getElementById('mDetail'); m.scrollTop = 560; }); await settle(P); await shot(P, '04-phone-detail-body');
await P.evaluate(() => Gallery.playItem('sample-1')); await settle(P, 900); await shot(P, '05-phone-slideshow');
ok('عرض الشرائح يعمل', await P.evaluate(() => Gallery.isOpen() && document.getElementById('lbx').classList.contains('playing')));
await P.keyboard.press('Escape'); await settle(P);
ok('رجوع يغلق عرض الشرائح أولًا', await P.evaluate(() => !Gallery.isOpen() && document.getElementById('ovDetail').classList.contains('show')));
await P.click('#dEdit'); await settle(P, 700); await shot(P, '06-phone-form');
await P.evaluate(() => closeOv('ovForm')); await settle(P);
await P.click('#nWorks'); await settle(P, 800); await shot(P, '07-phone-works');
ok('مركز الأعمال يعرض بطاقات', await P.locator('#mWorks .wkc').count() > 3);
await P.locator('#mWorks .wkc .wk-t').first().click(); await settle(P, 600); await shot(P, '08-phone-work-sheet'); await P.keyboard.press('Escape'); await settle(P);
await P.evaluate(() => document.getElementById('bStats').click()); await settle(P, 1300); await shot(P, '09-phone-stats');
await P.evaluate(() => { document.getElementById('mStats').scrollTop = 900; }); await settle(P); await shot(P, '10-phone-stats-2');
await P.evaluate(() => document.getElementById('nLists').click()); await settle(P, 700); await shot(P, '11-phone-lists');
await P.click('#nRecs'); await settle(P, 700); await shot(P, '12-phone-recs');
await P.click('#nHome'); await settle(P);
await P.click('#bSet'); await settle(P, 600); await shot(P, '13-phone-settings'); await P.keyboard.press('Escape'); await settle(P);
await P.click('#bRandom'); await settle(P, 500); await P.click('#pkGo'); await settle(P, 500); await shot(P, '14-phone-random'); await P.keyboard.press('Escape'); await settle(P);
await P.click('#vAdv'); await settle(P, 500); await shot(P, '15-phone-filter'); await P.keyboard.press('Escape'); await settle(P);
await P.click('#bView'); await P.click('#bView'); await settle(P, 600); await shot(P, '16-phone-listview'); await P.click('#bView'); await settle(P, 400);
await P.fill('#q', 'نموذج 1'); await settle(P, 500); ok('البحث العربي يعمل', await P.locator('.card').count() >= 7 && await P.locator('.card').count() < 17, String(await P.locator('.card').count())); await P.fill('#q', ''); await settle(P, 300);
await P.fill('#q', 'sample work 4-1'); await settle(P, 500); ok('البحث الإنجليزي في عناوين الأعمال', await P.locator('.card').count() === 1); await P.fill('#q', ''); await settle(P, 300);
// القفل
await P.click('#bSet'); await settle(P, 300); await P.evaluate(() => document.querySelectorAll('#ovSet details')[1].open = true); await P.fill('#pinIn', '2468'); await P.click('#pinSave'); await settle(P, 400);
const pinStored = await P.evaluate(() => LS.get('vkte_pin2'));
ok('الرمز مخزَّن مجزّأً مع salt (لا نصًّا)', /"s":"[0-9a-f]{32}"/.test(pinStored) && /"h":"[0-9a-f]{64}"/.test(pinStored) && !/2468/.test(pinStored));
await P.keyboard.press('Escape'); await P.click('#bLock'); await settle(P, 400); await shot(P, '17-phone-lock');
for (const d of '1111') await P.click(`#lockPad [data-k="${d}"]`); await settle(P, 500);
ok('رمز خاطئ لا يفتح', await P.evaluate(() => document.getElementById('lock').classList.contains('show')));
for (const d of '2468') await P.click(`#lockPad [data-k="${d}"]`); await settle(P, 500);
ok('الرمز الصحيح يفتح', await P.evaluate(() => !document.getElementById('lock').classList.contains('show')));
await P.evaluate(() => LS.del('vkte_pin2'));
// ثيم فاتح و AMOLED
await P.evaluate(() => { LS.set('vkte_theme', 'light'); document.documentElement.dataset.theme = 'light'; }); await settle(P, 300); await shot(P, '18-phone-light');
await P.evaluate(() => { LS.set('vkte_theme', 'amoled'); document.documentElement.dataset.theme = 'amoled'; document.documentElement.dataset.accent = 'rose'; }); await settle(P, 300); await shot(P, '19-phone-amoled');
await P.evaluate(() => { LS.set('vkte_theme', 'dark'); document.documentElement.dataset.theme = 'dark'; document.documentElement.dataset.accent = 'copper'; });
// التصدير: الملف الناتج يُعاد استيراده بلا فروق
const [dl] = await Promise.all([P.waitForEvent('download'), P.evaluate(() => Backup.exportNow())]);
const expPath = join(out, 'exported.json'); await dl.saveAs(expPath); const exported = JSON.parse(readFileSync(expPath, 'utf8'));
ok('التصدير بصيغة التطبيق القديم', exported.app === 'vkte-favorites' && exported.v === 5 && exported.items.length === 17 && exported.items[0].photos.every(p => p.startsWith('data:image/')) && exported.lists.length === 2);
ok('أخطاء الكونسول (جوال)', phone.errors.length === 0, phone.errors.slice(0, 4).join(' | '));
await phone.ctx.close();

// ---------- 4) التلفاز 1920×1080 بأسهم الكيبورد ----------
for (const [tag, vp, dpr] of [['tv1080', { width: 1920, height: 1080 }, 1], ['tv540', { width: 960, height: 540 }, 2]]) {
  const tv = await newPage(vp, dpr, '?tv=1'); const T = tv.page;
  await importSample(T); await settle(T, 2600); await T.waitForSelector('body.ready'); await T.evaluate(() => document.getElementById('nHome').click()); await T.waitForSelector('.card'); await settle(T, 700);
  ok(tag + ': وضع التلفاز مفعّل', await T.evaluate(() => document.documentElement.classList.contains('tv')));
  await T.keyboard.press('ArrowDown'); await settle(T, 300);
  const f0 = await T.evaluate(() => { const a = document.activeElement; return a && a.classList.contains('card') ? a.dataset.id : (a ? a.tagName + '#' + a.id : ''); });
  await T.keyboard.press('ArrowLeft'); await T.keyboard.press('ArrowLeft'); await T.keyboard.press('ArrowDown'); await settle(T, 300);
  const f1 = await T.evaluate(() => { const a = document.activeElement; return a && a.classList.contains('card') ? a.dataset.id : ''; });
  ok(tag + ': الأسهم تنقل التركيز بين البطاقات', !!f1 && f1 !== f0, f0 + ' → ' + f1);
  ok(tag + ': حلقة التركيز ظاهرة', await T.evaluate(() => { const a = document.activeElement; return a.classList.contains('tvf') && parseFloat(getComputedStyle(a).outlineWidth) >= 3; }));
  await shot(T, tag + '-01-home-focus');
  // الرئيسية على التلفاز: التنقل بين الأرفف والوصول لشريط التنقل من داخل الصفحة
  await T.evaluate(() => { document.getElementById('nDash').focus(); document.getElementById('nDash').click(); }); await settle(T, 600);
  await T.keyboard.press('ArrowLeft'); await T.keyboard.press('ArrowDown'); await T.keyboard.press('ArrowDown'); await T.keyboard.press('ArrowLeft'); await settle(T, 300);
  ok(tag + ': تنقل داخل الرئيسية', await T.evaluate(() => !!document.activeElement.closest('#ovHome')), await T.evaluate(() => document.activeElement.className));
  await shot(T, tag + '-00-dashboard');
  for (let k = 0; k < 12; k++) await T.keyboard.press('ArrowRight'); await settle(T, 250);
  ok(tag + ': شريط التنقل في المتناول من داخل الصفحة', await T.evaluate(() => !!document.activeElement.closest('nav.dock')), await T.evaluate(() => document.activeElement.className));
  await T.evaluate(() => document.getElementById('nHome').click()); await settle(T, 400); await T.evaluate(id => { const c = document.querySelector('.card[data-id="' + id + '"]'); if (c) { c.tabIndex = -1; c.focus(); c.classList.add('tvf'); } }, f1);
  await T.keyboard.press('Enter'); await settle(T, 900);
  ok(tag + ': OK يفتح الملف', await T.evaluate(() => document.getElementById('ovDetail').classList.contains('show')));
  await shot(T, tag + '-02-detail');
  await T.keyboard.press('ArrowDown'); await T.keyboard.press('ArrowDown'); await settle(T, 300);
  ok(tag + ': التركيز داخل النافذة المفتوحة', await T.evaluate(() => !!document.activeElement.closest('#ovDetail')));
  await T.keyboard.press('Escape'); await settle(T, 500);
  ok(tag + ': رجوع يغلق النافذة ويعيد التركيز للبطاقة', await T.evaluate(id => !document.getElementById('ovDetail').classList.contains('show') && document.activeElement.dataset.id === id, f1), await T.evaluate(() => { const a = document.activeElement; return a.tagName + '.' + a.className + '#' + (a.dataset.id || a.id) + ' ov=' + [...document.querySelectorAll('.overlay.show')].map(o => o.id).join(','); }) + ' want=' + f1);
  // إلى شريط التنقل ثم الأعمال
  for (let k = 0; k < 8; k++) await T.keyboard.press('ArrowRight'); await settle(T, 250);
  const inNav = await T.evaluate(() => !!document.activeElement.closest('nav.dock'));
  ok(tag + ': سهم اليمين يصل شريط التنقل', inNav, await T.evaluate(() => document.activeElement.tagName + '#' + document.activeElement.id));
  await T.evaluate(() => document.getElementById('nWorks').focus()); await T.keyboard.press('Enter'); await settle(T, 900); await shot(T, tag + '-03-works');
  await T.keyboard.press('ArrowLeft'); await T.keyboard.press('ArrowDown'); await T.keyboard.press('ArrowDown'); await settle(T, 300);
  ok(tag + ': تنقل داخل مركز الأعمال', await T.evaluate(() => !!document.activeElement.closest('#ovWorks')), await T.evaluate(() => document.activeElement.className));
  await shot(T, tag + '-04-works-focus');
  await T.evaluate(() => document.getElementById('bStats').click()); await settle(T, 1200); await shot(T, tag + '-05-stats');
  await T.evaluate(() => { document.getElementById('nHome').click(); Gallery.playLibrary(); }); await settle(T, 1000); await shot(T, tag + '-06-slideshow');
  const i0 = await T.evaluate(() => document.querySelector('#lbx .lc').textContent); await T.keyboard.press('ArrowLeft'); await settle(T, 500);
  ok(tag + ': أسهم الريموت تقلّب الشرائح', await T.evaluate(() => document.querySelector('#lbx .lc').textContent) !== i0);
  await T.keyboard.press('Escape'); await settle(T, 300);
  await T.evaluate(() => document.getElementById('bSet').click()); await settle(T, 600); await shot(T, tag + '-07-settings'); await T.keyboard.press('Escape');
  ok(tag + ': أخطاء الكونسول', tv.errors.length === 0, tv.errors.slice(0, 4).join(' | '));
  await tv.ctx.close();
}

await browser.close(); server.close();
console.log(results.join('\n')); console.log(failed ? `\n${failed} اختبار فشل` : '\nكل الاختبارات نجحت'); process.exit(failed ? 1 : 0);

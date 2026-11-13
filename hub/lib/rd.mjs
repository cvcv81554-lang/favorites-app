// تكامل Real-Debrid (حسب التوثيق الرسمي https://api.real-debrid.com/)
// - الربط: OAuth2 device flow بمعرّف التطبيقات مفتوحة المصدر، والرموز تُخزَّن مشفّرة (store.setRD) وتُجدَّد تلقائيًا.
// - المصادر: Real-Debrid ليس محرك بحث. نبحث فقط داخل حسابك (التورنتات المكتملة + التحميلات السابقة)
//   ونطابقها مع أعمالك، أو نستخدم رابطًا تضيفه أنت لعمل محدّد. لا نجمع روابط من الإنترنت.
// - التشغيل: الرابط المباشر يُولَّد عند الطلب ويُخزَّن مؤقتًا، ويُعاد توليده عند انتهاء صلاحيته.
import { sleep, words, compact } from './util.mjs';
import { nameWords } from './model.mjs';

// FAV_RD_BASE: للاختبارات فقط (خادم Real-Debrid وهمي)
const RDB = process.env.FAV_RD_BASE || 'https://api.real-debrid.com';
const API = RDB + '/rest/1.0', OAUTH = RDB + '/oauth/v2', OPEN_ID = 'X245A4XAIBGVM';
const DEVICE_GRANT = 'http://oauth.net/grant_type/device/1.0';
export const VIDEO_RE = /\.(mkv|mp4|m4v|avi|wmv|mov|ts|m2ts|webm|mpg|mpeg|flv)$/i;

// ===== حدّ الطلبات: 250/دقيقة حسب التوثيق — نبقى تحت 200 =====
const stamps = [];
async function slot() { for (;;) { const now = Date.now(); while (stamps.length && now - stamps[0] > 60000) stamps.shift(); if (stamps.length < 200) { stamps.push(now); return; } await sleep(60000 - (now - stamps[0]) + 50); } }

export class RDError extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code; } }
const ERR_AR = { 8: 'انتهت صلاحية الربط، أعد ربط الحساب', 9: 'لا صلاحية', 14: 'الحساب مقفل', 16: 'الموقع غير مدعوم', 19: 'الموقع غير متاح مؤقتًا', 20: 'يحتاج اشتراكًا مميزًا', 21: 'تحميلات نشطة كثيرة', 23: 'نفدت حصة النقل',
  24: 'الملف غير متاح', 25: 'الخدمة غير متاحة', 28: 'الملف غير مسموح', 34: 'طلبات كثيرة', 35: 'ملف محظور', 36: 'تجاوز حد الاستخدام العادل', 37: 'الخاصية متوقفة في Real-Debrid' };
export const rdMsg = e => (e && e.code != null && ERR_AR[e.code]) || (e && e.message) || 'خطأ غير معروف';

async function raw(url, opt = {}, tries = 3) {
  for (let i = 0; ; i++) {
    await slot(); let r;
    try { r = await fetch(url, { ...opt, signal: AbortSignal.timeout(20000) }); }
    catch (e) { if (i < tries - 1) { await sleep(800 * (i + 1)); continue; } throw new RDError('تعذّر الاتصال بـ Real-Debrid', 0); }
    if (r.status === 429 || r.status >= 500 && r.status !== 503) { if (i < tries - 1) { await sleep((+r.headers.get('retry-after') || 2 + i * 3) * 1000); continue; } }
    if (r.status === 204) return null;
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
    if (!r.ok) throw new RDError((j && j.error) || ('HTTP ' + r.status), r.status, j && j.error_code);
    return j;
  }
}
const form = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));

// ===== الربط =====
export async function deviceStart() { return raw(`${OAUTH}/device/code?client_id=${OPEN_ID}&new_credentials=yes`); }
export async function devicePoll(device_code) {
  let c; try { c = await raw(`${OAUTH}/device/credentials?client_id=${OPEN_ID}&code=${encodeURIComponent(device_code)}`, {}, 1); } catch { return null; }  // لم يوافق المستخدم بعد
  if (!c || !c.client_id) return null;
  const t = await raw(`${OAUTH}/token`, { method: 'POST', body: form({ client_id: c.client_id, client_secret: c.client_secret, code: device_code, grant_type: DEVICE_GRANT }) });
  return { cid: c.client_id, cs: c.client_secret, at: t.access_token, rt: t.refresh_token, exp: Date.now() + (t.expires_in || 3600) * 1000 };
}

export class RD {
  // load(): يرجع الرموز المفكوكة، save(obj|null): يحفظها مشفّرة
  constructor(load, save) { this.load = load; this.save = save; this.idx = null; this.idxAt = 0; this.info = new Map(); this.unr = new Map(); this.busy = null; }
  get linked() { return !!this.load(); }
  async token(force) { const c = this.load(); if (!c) throw new RDError('حساب Real-Debrid غير مربوط', 401, 8);
    if (!force && c.exp - Date.now() > 5 * 60000) return c.at;
    const t = await raw(`${OAUTH}/token`, { method: 'POST', body: form({ client_id: c.cid, client_secret: c.cs, code: c.rt, grant_type: DEVICE_GRANT }) });
    const n = { ...c, at: t.access_token, rt: t.refresh_token || c.rt, exp: Date.now() + (t.expires_in || 3600) * 1000 }; this.save(n); return n.at; }
  async api(path, opt = {}) {
    for (let i = 0; i < 2; i++) { const at = await this.token(i > 0);
      try { return await raw(API + path, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + at } }); }
      catch (e) { if (i === 0 && (e.status === 401 || e.code === 8)) continue; throw e; } } }
  user() { return this.api('/user'); }
  unlink() { this.save(null); this.idx = null; this.info.clear(); this.unr.clear(); }

  // ===== فهرس حسابك: التورنتات المكتملة + التحميلات (يُحدَّث كل 30 دقيقة أو يدويًا) =====
  async index(force) {
    if (!force && this.idx && Date.now() - this.idxAt < 30 * 60000) return this.idx;
    if (this.busy) return this.busy;
    this.busy = (async () => { try {
      const tor = [], dl = [];
      for (let page = 1; page <= 10; page++) { const a = await this.api(`/torrents?limit=2500&page=${page}`) || []; tor.push(...a); if (a.length < 2500) break; }
      for (let page = 1; page <= 4; page++) { const a = await this.api(`/downloads?limit=2500&page=${page}`) || []; dl.push(...a); if (a.length < 2500) break; }
      this.idx = { tor: tor.filter(t => t.status === 'downloaded').map(t => ({ id: t.id, name: t.filename, bytes: t.bytes, added: t.added, n: norm(t.filename) })),
        dl: dl.filter(d => VIDEO_RE.test(d.filename || '') && d.link).map(d => ({ id: d.id, name: d.filename, bytes: d.filesize, link: d.link, n: norm(d.filename) })) };
      this.idxAt = Date.now(); return this.idx; } finally { this.busy = null; } })();
    return this.busy; }
  async torrent(id) { const c = this.info.get(id); if (c && Date.now() - c.at < 10 * 60000) return c.v; const v = await this.api('/torrents/info/' + encodeURIComponent(id)); this.info.set(id, { at: Date.now(), v }); return v; }
  // ملفات الفيديو المختارة في تورنت مع رابط كل ملف (الروابط بترتيب الملفات المختارة)
  async files(id) { const t = await this.torrent(id); const sel = (t.files || []).filter(f => f.selected === 1);
    const all = sel.map((f, i) => ({ fid: f.id, path: f.path, bytes: f.bytes, link: (t.links || [])[i] || '' })).filter(f => VIDEO_RE.test(f.path) && f.link);
    const mx = Math.max(0, ...all.map(f => f.bytes || 0));
    return all.filter(f => !(/(^|[\W_])sample([\W_]|$)/i.test(f.path.split('/').pop()) && (f.bytes || 0) < mx * .2)); }
  // رابط مباشر صالح للتشغيل؛ يُخزَّن 20 دقيقة، وعند خطأ يُعاد توليده مرة
  async direct(link, fresh) { const c = this.unr.get(link); if (!fresh && c && Date.now() - c.at < 20 * 60000) return c.v;
    const v = await this.api('/unrestrict/link', { method: 'POST', body: form({ link }) }); if (!v || !v.download) throw new RDError('لم يرجع Real-Debrid رابط تشغيل', 502);
    this.unr.set(link, { at: Date.now(), v }); if (this.unr.size > 500) this.unr.delete(this.unr.keys().next().value); return v; }
  // إضافة رابط يدوي من المستخدم: رابط موقع مدعوم يُفك مباشرة، أو magnet يُضاف لحسابك وتُختار ملفات الفيديو
  async addMagnet(m) { const a = await this.api('/torrents/addMagnet', { method: 'POST', body: form({ magnet: m }) });
    let t; for (let i = 0; i < 8; i++) { t = await this.api('/torrents/info/' + a.id); if (t.status !== 'magnet_conversion') break; await sleep(1500); }
    const vids = (t.files || []).filter(f => VIDEO_RE.test(f.path)).map(f => f.id); if (t.status === 'waiting_files_selection') await this.api('/torrents/selectFiles/' + a.id, { method: 'POST', body: form({ files: vids.length ? vids.join(',') : 'all' }) });
    this.info.delete(a.id); this.idxAt = 0; return a.id; }
}

// ===== المطابقة بين عمل وملف في حسابك =====
const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'to', 'with', 'for', 'my', 'her', 'his', 'xxx', 'mp4', 'mkv', '1080p', '720p', '2160p', '4k', 'hd', 'web', 'dl', 'x264', 'x265', 'hevc', 'h264', 'h265', 'scene', 'part']);
export const norm = s => { const w = words(String(s || '').replace(/\.[a-z0-9]{2,4}$/i, '')); return { w: new Set(w), s: ' ' + w.join(' ') + ' ', c: compact(s) }; };
const titleWords = W => words(W.w.t).filter(x => !STOP.has(x) && (x.length >= 2 ? /[a-z0-9]/.test(x) : /^\d$/.test(x)));
export const titleHits = (W, n) => titleWords(W).filter(x => n.w.has(x)).length;
// الملف لهذا العمل فقط إن لم يكن عملٌ آخر لنفس الممثلة أدقّ مطابقة له (مثل «Work» و«Work 1-2»)
export function owns(W, n) { const s = matchScore(W, n); if (s < 75) return 0; const h = titleHits(W, n);
  for (const p of W.perfs) for (const W2 of p.works) { if (W2 === W) continue; const s2 = matchScore(W2, n); if (s2 < 75) continue; const h2 = titleHits(W2, n); if (h2 > h || (h2 === h && s2 > s)) return 0; }
  return s; }
const has = (n, phrase) => phrase.length && n.s.includes(' ' + phrase.join(' ') + ' ');
export function matchScore(W, n) {
  const names = W.perfs.flatMap(nameWords);
  const perfHit = names.some(nw => (nw.length >= 2 || (nw[0] || '').length >= 5) && (has(n, nw) || nw.every(x => n.w.has(x))));
  const tw = titleWords(W);
  const tHit = tw.length ? tw.filter(x => n.w.has(x)).length / tw.length : 0;
  const titleSeq = tw.length >= 2 && has(n, tw);
  const st = compact(W.w.s), stHit = st.length >= 4 && n.c.includes(st);
  let dateHit = false; const d = W.w.d && /^(\d{4})-(\d{2})-(\d{2})$/.exec(W.w.d);
  if (d) dateHit = has(n, [d[1].slice(2), d[2], d[3]]) || has(n, [d[1], d[2], d[3]]);
  let s = 0;
  if (perfHit && (titleSeq || tHit >= .7)) s = 90 + (stHit ? 5 : 0) + (dateHit ? 5 : 0);
  else if (perfHit && dateHit) s = 85 + (stHit ? 5 : 0);
  else if (stHit && dateHit && tHit >= .5) s = 80;
  else if (titleSeq && tw.length >= 3 && (stHit || perfHit)) s = 75;
  return s;
}
const QUAL = [[/2160p|\b4k\b|uhd/i, '4K'], [/1440p/i, '1440p'], [/1080p|fhd/i, '1080p'], [/720p/i, '720p'], [/480p|\bsd\b/i, '480p']];
export const quality = s => (QUAL.find(([r]) => r.test(s)) || [, ''])[1];
export const size = b => !b ? '' : b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : Math.round(b / 1e6) + ' MB';

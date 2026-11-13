#!/usr/bin/env node
// Favorites Hub — خادم صغير على جهازك يربط تطبيق Favorites بـ Nuvio
//  1) يستقبل مزامنة تطبيق Favorites (نفس بروتوكول مزامنة الشاشة) ويحفظ نسخة مطابقة لمكتبتك.
//  2) يقدّم إضافة Stremio/Nuvio: /a/<رمز-سري>/manifest.json
//  3) يربط حساب Real-Debrid ويولّد روابط التشغيل عند الطلب.
//  4) لوحة تحكم محلية فقط: http://127.0.0.1:7710/
// التشغيل: node hub/server.mjs   (المتغيرات: FAV_HUB_PORT, FAV_HUB_DATA)
import http from 'node:http';
import os from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, createReadStream, statSync } from 'node:fs';
import { Store, PH_RE } from './lib/store.mjs';
import { initKey } from './lib/secure.mjs';
import { RD, deviceStart, devicePoll, owns, norm, rdMsg } from './lib/rd.mjs';
import { manifest, catalog, meta, streams, VERSION } from './lib/addon.mjs';
import { build } from './lib/model.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.FAV_HUB_PORT || 7710;
const DATA = process.env.FAV_HUB_DATA || join(process.env.LOCALAPPDATA || join(os.homedir(), '.local', 'share'), 'FavoritesHub');
initKey(DATA);
const store = new Store(DATA);
if (!store.cfg.users.length) store.createUser('الأساسي');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ===== Real-Debrid لكل مستخدم =====
const rds = new Map();
const rdOf = uid => { let r = rds.get(uid); if (!r) { r = new RD(() => store.getRD(uid), v => store.setRD(uid, v)); rds.set(uid, r); } return r; };
const srcCache = new Map(), readyCache = new Map();
async function sources(uid, W) {
  const r = rdOf(uid), L = store.lib(uid), key = uid + '|' + W.id + '|' + r.idxAt + '|' + L.ver, c = srcCache.get(key);
  if (c && Date.now() - c.at < 10 * 60000) return c.v;
  const idx = await r.index(), out = [];
  for (const [i, x] of (L.st.links[W.id] || []).entries()) {
    if (x.kind === 'tor') { try { for (const f of await r.files(x.ref)) out.push({ key: `m/${W.id.slice(5)}/${i}/${f.fid}`, name: f.path.split('/').pop(), bytes: f.bytes, manual: 1 }); } catch {} }
    else out.push({ key: `m/${W.id.slice(5)}/${i}/0`, name: x.name || 'رابط', bytes: x.bytes || 0, manual: 1 });
  }
  const tors = idx.tor.map(t => ({ t, s: owns(W, t.n) })).filter(x => x.s >= 75).sort((a, b) => b.s - a.s).slice(0, 5);
  for (const { t, s } of tors) { let files = []; try { files = await r.files(t.id); } catch { continue; }
    const good = files.length === 1 ? files : files.filter(f => owns(W, norm(f.path)) >= 75 || (s >= 90 && files.length <= 2));
    for (const f of good) out.push({ key: `t/${t.id}/${f.fid}`, name: f.path.split('/').pop(), bytes: f.bytes }); }
  for (const d of idx.dl) if (owns(W, d.n) >= 75) out.push({ key: `d/${d.id}`, name: d.name, bytes: d.bytes });
  const seen = new Set(), v = out.filter(o => !seen.has(o.key) && seen.add(o.key)).sort((a, b) => (b.manual || 0) - (a.manual || 0) || (b.bytes || 0) - (a.bytes || 0));
  srcCache.set(key, { at: Date.now(), v }); if (srcCache.size > 2000) srcCache.delete(srcCache.keys().next().value); return v;
}
// الأعمال التي لها مطابقة في حسابك (بالاسم فقط، بلا طلبات إضافية) — لكتالوج «جاهزة للمشاهدة»
async function ready(uid) {
  const r = rdOf(uid), L = store.lib(uid); if (!r.linked) return new Set();
  const idx = await r.index().catch(() => null); if (!idx) return new Set();
  const key = uid + '|' + r.idxAt + '|' + L.ver, c = readyCache.get(uid); if (c && c.key === key) return c.v;
  const m = build(L), v = new Set(Object.keys(L.st.links).filter(k => (L.st.links[k] || []).length));
  for (const W of m.works) { if (W.upc || v.has(W.id)) continue; if (idx.tor.some(t => owns(W, t.n) >= 75) || idx.dl.some(d => owns(W, d.n) >= 75)) v.add(W.id); }
  readyCache.set(uid, { key, v }); return v;
}
async function resolvePlay(uid, parts) {
  const r = rdOf(uid), L = store.lib(uid); let link;
  if (parts[0] === 't') { const f = (await r.files(parts[1])).find(f => String(f.fid) === parts[2]); link = f && f.link; }
  else if (parts[0] === 'd') { const d = (await r.index()).dl.find(d => d.id === parts[1]); link = d && d.link; }
  else if (parts[0] === 'm') { const x = (L.st.links['favw:' + parts[1]] || [])[+parts[2]]; if (x) { if (x.kind === 'tor') { const f = (await r.files(x.ref)).find(f => String(f.fid) === parts[3]); link = f && f.link; } else link = x.ref; } }
  if (!link) return null;
  try { return (await r.direct(link)).download; } catch (e) { if (e.code === 24 || e.code === 35) throw e; return (await r.direct(link, true)).download; }
}

// ===== حماية: محاولات رمز خاطئة =====
const fails = new Map();
const blocked = ip => { const f = fails.get(ip); return f && f.n >= 10 && Date.now() - f.at < 10 * 60000; };
const fail = ip => { const f = fails.get(ip) || { n: 0, at: 0 }; if (Date.now() - f.at > 10 * 60000) f.n = 0; f.n++; f.at = Date.now(); fails.set(ip, f); };

// ===== HTTP =====
const send = (res, status, body, type = 'application/json; charset=utf-8', extra = {}) => { res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', ...extra }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
async function body(req, max = 40e6) { const chunks = []; let n = 0; for await (const c of req) { n += c.length; if (n > max) throw Object.assign(new Error('too big'), { status: 413 }); chunks.push(c); } return Buffer.concat(chunks).toString('utf8'); }
const isLocal = req => { const a = req.socket.remoteAddress || ''; return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'; };
const goodHost = h => /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(h || '');
const hostOf = req => { const h = String(req.headers.host || ''); return /^[\w.-]+(:\d+)?$/.test(h) ? h : '127.0.0.1:' + PORT; };
const lanIPs = () => Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);

// --- مزامنة تطبيق Favorites (نفس مسارات الشاشة) ---
async function syncRoute(req, res, path, q) {
  const ip = req.socket.remoteAddress; if (blocked(ip)) return send(res, 429, { error: 'too many attempts' });
  const uid = store.userByCode(q.get('k')); if (!uid) { fail(ip); return send(res, 401, { error: 'bad code' }); }
  const L = store.lib(uid), m = req.method;
  if (path === '/hello') return send(res, 200, { app: 'favlib', v: 1, name: 'Favorites Hub', hub: VERSION, count: L.items.size, sig: Object.fromEntries([...L.items.values()].map(i => [i.id, [store.sig(i), i.updated || 0]])), photos: store.photoNames(L) });
  if (path.startsWith('/photo/') && m === 'PUT') { const f = decodeURIComponent(path.slice(7)); if (!PH_RE.test(f)) return send(res, 400, { error: 'name' }); return send(res, store.writePhoto(L, f, await body(req)) ? 200 : 400, { ok: true }); }
  if (m !== 'POST') return send(res, 405, { error: 'method' });
  let b; try { b = JSON.parse(await body(req) || '{}'); } catch { return send(res, 400, { error: 'json' }); }
  if (path === '/get') { const ids = new Set(b.ids || []); return send(res, 200, { items: [...L.items.values()].filter(i => ids.has(i.id)) }); }
  if (path === '/items') { const n = store.putItems(L, Array.isArray(b.items) ? b.items : []); if (n) log('sync', uid, 'put', n); return send(res, 200, { ok: true, n }); }
  if (path === '/delete') { const n = store.delItems(L, Array.isArray(b.ids) ? b.ids.map(String) : []); if (n) log('sync', uid, 'del', n); return send(res, 200, { ok: true, n }); }
  if (path === '/meta') { store.setMeta(L, b || {}); return send(res, 200, { ok: true }); }
  if (path === '/done') { store.done(L, { sent: +b.sent || 0, photos: +b.photos || 0, deleted: +b.deleted || 0, ip }); return send(res, 200, { ok: true }); }
  return send(res, 404, { error: 'path' });
}

// --- الإضافة ---
const cache = new Map();
async function addonRoute(req, res, tok, rest) {
  const uid = store.userByAddon(tok); if (!uid) { fail(req.socket.remoteAddress); return send(res, 404, { error: 'not found' }); }
  const L = store.lib(uid), base = `http://${hostOf(req)}/a/${tok}`, user = store.user(uid), rd = rdOf(uid);
  const ctx = { L, base, user, rd, uid, ready: () => ready(uid), sources: W => sources(uid, W) };
  if (rest === '/manifest.json') return send(res, 200, manifest(store, uid, `http://${hostOf(req)}`), undefined, { 'Cache-Control': 'max-age=60' });
  if (rest === '/ph.svg') { const t = (new URL(req.url, 'http://x').searchParams.get('t') || '♡').slice(0, 2).replace(/[<>&"']/g, ''); let h = 0; for (const c of t) h = (h * 31 + c.codePointAt(0)) % 360;
    return send(res, 200, `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},45%,28%)"/><stop offset="1" stop-color="hsl(${(h + 40) % 360},55%,14%)"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/><text x="200" y="330" font-family="Segoe UI,Tahoma,sans-serif" font-size="150" font-weight="700" fill="rgba(255,255,255,.85)" text-anchor="middle">${t}</text></svg>`, 'image/svg+xml', { 'Cache-Control': 'max-age=86400' }); }
  if (rest.startsWith('/img/')) { const p = store.photoPath(L, decodeURIComponent(rest.slice(5))); if (!p || !existsSync(p)) return send(res, 404, 'no');
    res.writeHead(200, { 'Content-Type': /\.webp$/.test(p) ? 'image/webp' : /\.png$/.test(p) ? 'image/png' : 'image/jpeg', 'Cache-Control': 'max-age=86400', 'Content-Length': statSync(p).size, 'Access-Control-Allow-Origin': '*' }); return createReadStream(p).pipe(res); }
  if (rest.startsWith('/play/')) { const parts = rest.slice(6).split('/').map(decodeURIComponent);
    try { const u = await resolvePlay(uid, parts); if (!u) return send(res, 404, 'المصدر لم يعد موجودًا في حسابك', 'text/plain; charset=utf-8'); log('play', uid, parts[0]); res.writeHead(302, { Location: u, 'Cache-Control': 'no-store' }); return res.end(); }
    catch (e) { log('play error', rdMsg(e)); return send(res, 502, 'Real-Debrid: ' + rdMsg(e), 'text/plain; charset=utf-8'); } }
  const mm = rest.match(/^\/(catalog|meta|stream)\/(movie|series)\/([^/]+?)(?:\/([^/]+?))?\.json$/); if (!mm) return send(res, 404, { error: 'path' });
  const [, kind, type, id, ex] = mm, extra = Object.fromEntries(new URLSearchParams(decodeURIComponent(ex || '')));
  const did = decodeURIComponent(id), ck = uid + '|' + L.ver + '|' + rd.idxAt + '|' + base + '|' + rest;
  if (kind !== 'stream' && cache.has(ck)) return send(res, 200, cache.get(ck), undefined, { 'Cache-Control': 'max-age=30' });
  const t0 = Date.now(); let out;
  if (kind === 'catalog') out = await catalog(ctx, type, did, extra);
  else if (kind === 'meta') out = meta(ctx, type, did);
  else out = await streams(ctx, did);
  const js = JSON.stringify(out); if (kind !== 'stream') { cache.set(ck, js); if (cache.size > 400) cache.delete(cache.keys().next().value); }
  log(kind, type, did.slice(0, 40), (out.metas || out.streams || []).length ?? '', (Date.now() - t0) + 'ms');
  return send(res, 200, js, undefined, { 'Cache-Control': kind === 'stream' ? 'no-store' : 'max-age=30' });
}

// --- لوحة التحكم (من هذا الجهاز فقط) ---
const pending = new Map();
async function adminRoute(req, res, path, q) {
  if (!isLocal(req) || !goodHost(req.headers.host)) return send(res, 403, 'لوحة التحكم متاحة من هذا الجهاز فقط', 'text/plain; charset=utf-8');
  if (path === '/' || path === '/admin') return send(res, 200, readFileSync(join(HERE, 'admin.html'), 'utf8'), 'text/html; charset=utf-8', { 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' });
  if (req.method === 'POST' && req.headers['x-fav-admin'] !== '1') return send(res, 403, { error: 'csrf' });
  let b = {}; if (req.method === 'POST') { try { b = JSON.parse(await body(req, 1e6) || '{}'); } catch { return send(res, 400, { error: 'json' }); } }
  const uid = (b.user || q.get('user') || store.cfg.users[0].id); const u = store.user(uid); if (!u && path !== '/api/users') return send(res, 404, { error: 'user' });
  const rd = u && rdOf(uid);
  try {
    if (path === '/api/users') { if (b.create) store.createUser(b.create); if (b.remove && store.cfg.users.length > 1) store.removeUser(b.remove); return send(res, 200, { users: store.list() }); }
    if (path === '/api/status') { const L = store.lib(uid), m = build(L), s = store.secrets(uid); let rdu = null, rderr = '';
      if (rd.linked) { try { const x = await rd.user(); rdu = { name: x.username, type: x.type, exp: x.expiration }; } catch (e) { rderr = rdMsg(e); } }
      return send(res, 200, { version: VERSION, port: PORT, ips: lanIPs(), user: { id: uid, name: u.name }, code: s.code, addon: `http://127.0.0.1:${PORT}/a/${s.addon}/manifest.json`,
        addonLan: lanIPs().map(ip => `http://${ip}:${PORT}/a/${s.addon}/manifest.json`), counts: { perf: m.perf.length, works: m.works.length, photos: store.photoNames(L).length },
        last: L.st.last, changes: store.changes(uid, 15), lists: L.meta.lists, expose: u.expose || [], rd: { linked: rd.linked, user: rdu, err: rderr, idxAt: rd.idxAt, tor: rd.idx ? rd.idx.tor.length : null, dl: rd.idx ? rd.idx.dl.length : null }, pending: pending.get(uid) ? { code: pending.get(uid).user_code, url: pending.get(uid).verification_url } : null }); }
    if (path === '/api/code') { store.rotateCode(uid); return send(res, 200, { ok: true }); }
    if (path === '/api/addon/rotate') { store.rotateAddon(uid); cache.clear(); return send(res, 200, { ok: true }); }
    if (path === '/api/expose') { store.setExpose(uid, b.ids); store.lib(uid).ver++; return send(res, 200, { ok: true }); }
    if (path === '/api/rd/start') { const d = await deviceStart(); pending.set(uid, { ...d, until: Date.now() + d.expires_in * 1000 }); return send(res, 200, { code: d.user_code, url: d.verification_url, direct: d.direct_verification_url }); }
    if (path === '/api/rd/poll') { const p = pending.get(uid); if (!p) return send(res, 200, { state: 'none' }); if (Date.now() > p.until) { pending.delete(uid); return send(res, 200, { state: 'expired' }); }
      const c = await devicePoll(p.device_code); if (!c) return send(res, 200, { state: 'waiting' }); store.setRD(uid, c); pending.delete(uid); rd.idxAt = 0; log('rd linked', uid); return send(res, 200, { state: 'linked' }); }
    if (path === '/api/rd/unlink') { rd.unlink(); pending.delete(uid); return send(res, 200, { ok: true }); }
    if (path === '/api/rd/refresh') { const i = await rd.index(true); return send(res, 200, { tor: i.tor.length, dl: i.dl.length }); }
    if (path === '/api/works') { const m = build(store.lib(uid)), s = String(b.q || q.get('q') || '').toLowerCase(), L = store.lib(uid);
      const a = m.works.filter(W => !s || (W.w.t + ' ' + W.perfs.map(p => p.it.name).join(' ')).toLowerCase().includes(s)).slice(0, 40);
      return send(res, 200, { works: a.map(W => ({ id: W.id, t: W.w.t, s: W.w.s, d: W.date, perfs: W.perfs.map(p => p.it.name), links: (L.st.links[W.id] || []).map(x => x.name) })) }); }
    if (path === '/api/rd/search') { const i = await rd.index(), s = norm(b.q || ''); const hit = t => [...s.w].every(w => t.n.w.has(w));
      return send(res, 200, { tor: i.tor.filter(hit).slice(0, 30).map(t => ({ id: t.id, name: t.name, bytes: t.bytes })), dl: i.dl.filter(hit).slice(0, 20).map(d => ({ id: d.id, name: d.name, bytes: d.bytes })) }); }
    if (path === '/api/attach') { const L = store.lib(uid), W = build(L).byW.get(b.work); if (!W) return send(res, 404, { error: 'العمل غير موجود' });
      let x; const ref = String(b.ref || '').trim();
      if (b.kind === 'tor' && ref) x = { kind: 'tor', ref, name: String(b.name || 'تورنت من حسابك').slice(0, 200) };
      else if (/^magnet:\?/i.test(ref)) x = { kind: 'tor', ref: await rd.addMagnet(ref), name: 'magnet' };
      else if (/^https?:\/\//i.test(ref)) { const v = await rd.direct(ref); x = { kind: 'link', ref, name: v.filename, bytes: v.filesize }; }
      else return send(res, 400, { error: 'رابط غير مفهوم' });
      (L.st.links[W.id] = L.st.links[W.id] || []).push(x); store.log(L, 'link', [W.id]); store.flush(L); return send(res, 200, { ok: true, name: x.name }); }
    if (path === '/api/detach') { const L = store.lib(uid); delete L.st.links[b.work]; store.log(L, 'link', [b.work]); store.flush(L); return send(res, 200, { ok: true }); }
  } catch (e) { return send(res, 502, { error: rdMsg(e) }); }
  return send(res, 404, { error: 'path' });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    const u = new URL(req.url, 'http://x'), path = u.pathname;
    if (path === '/health') return send(res, 200, { ok: true, app: 'favorites-hub', v: VERSION });
    if (path.startsWith('/static/')) { const f = { '/static/logo.png': '../resources/icon.png', '/static/bg.jpg': '../resources/splash.png' }[path]; const p = f && join(HERE, f);
      if (!p || !existsSync(p)) return send(res, 404, 'no'); res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400', 'Access-Control-Allow-Origin': '*' }); return createReadStream(p).pipe(res); }
    if (path.startsWith('/a/')) { const i = path.indexOf('/', 3); return await addonRoute(req, res, path.slice(3, i < 0 ? undefined : i), i < 0 ? '' : path.slice(i)); }
    if (['/hello', '/get', '/items', '/delete', '/meta', '/done'].includes(path) || path.startsWith('/photo/')) return await syncRoute(req, res, path, u.searchParams);
    return await adminRoute(req, res, path, u.searchParams);
  } catch (e) { log('error', e && e.stack || e); if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'internal' }); else res.end(); }
});
server.listen(PORT, '0.0.0.0', () => { log(`Favorites Hub ${VERSION} على المنفذ ${PORT}`); log('لوحة التحكم: http://127.0.0.1:' + PORT + '/'); log('عناوين الشبكة:', lanIPs().join(', ') || '—'); log('البيانات:', DATA); });
// تحديث فهرس Real-Debrid في الخلفية كل 30 دقيقة لكل مستخدم مربوط
setInterval(() => { for (const u of store.cfg.users) { const r = rdOf(u.id); if (r.linked) r.index(true).catch(e => log('rd index', rdMsg(e))); } }, 30 * 60000).unref();
export { server, store };

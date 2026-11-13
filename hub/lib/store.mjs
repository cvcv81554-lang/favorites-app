// تخزين الخادم: نسخة مطابقة لمكتبة كل مستخدم كما يرسلها تطبيق Favorites (لا قاعدة ثانية مستقلة)
// users/<id>/items.json   السجلات بصيغة المزامنة (الصور مراجع لأسماء ملفات)
// users/<id>/photos/      ملفات الصور كما في الجوال
// users/<id>/meta.json    القوائم
// users/<id>/changes.jsonl سجل التغييرات (seq متزايد) — يُبنى منه الفهرس ويُعرض في لوحة التحكم
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readdirSync, appendFileSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { readJSON, writeJSON, minorRec, h2 } from './util.mjs';
import { seal, open, token, sixDigits, same } from './secure.mjs';

export const PH_RE = /^[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp|gif|avif)$/;
const LOCAL = ['views', 'lastView', 'nph'];

export class Store {
  constructor(dir) { this.dir = dir; this.cfgFile = join(dir, 'hub.json'); this.cfg = readJSON(this.cfgFile, { users: [] }); this.users = new Map(); this.byAddon = new Map(); this.reindexSecrets(); }
  // _s = الأسرار المفكوكة في الذاكرة فقط؛ لا تُكتب على القرص أبدًا
  save() { writeJSON(this.cfgFile, { ...this.cfg, users: this.cfg.users.map(({ _s, ...u }) => u) }); this.reindexSecrets(); }
  reindexSecrets() { this.byAddon.clear(); for (const u of this.cfg.users) { const s = open(u.secret) || {}; u._s = s; if (s.addon) this.byAddon.set(s.addon, u.id); } }
  list() { return this.cfg.users.map(u => ({ id: u.id, name: u.name, created: u.created })); }
  createUser(name) { const id = 'u' + token(6).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toLowerCase();
    const u = { id, name: String(name || 'مستخدم').slice(0, 40), created: Date.now(), secret: seal({ code: sixDigits(), addon: token(24) }), rd: null, expose: [] };
    delete u._s; this.cfg.users.push(u); this.save(); return id; }
  removeUser(id) { this.cfg.users = this.cfg.users.filter(u => u.id !== id); this.users.delete(id); this.save(); }
  user(id) { return this.cfg.users.find(u => u.id === id) || null; }
  secrets(id) { const u = this.user(id); return u ? (u._s || {}) : {}; }
  setSecrets(id, patch) { const u = this.user(id); const s = { ...this.secrets(id), ...patch }; u.secret = seal(s); this.save(); return s; }
  rotateCode(id) { return this.setSecrets(id, { code: sixDigits() }).code; }
  rotateAddon(id) { return this.setSecrets(id, { addon: token(24) }).addon; }
  // رمز الربط (6 أرقام) ← المستخدم. المقارنة بزمن ثابت.
  userByCode(k) { if (!/^\d{6}$/.test(String(k || ''))) return null; for (const u of this.cfg.users) if (u._s && u._s.code && same(u._s.code, k)) return u.id; return null; }
  userByAddon(t) { if (!t || t.length < 20) return null; for (const [tok, id] of this.byAddon) if (tok.length === t.length && same(tok, t)) return id; return null; }
  setRD(id, obj) { const u = this.user(id); u.rd = obj ? seal(obj) : null; this.save(); }
  getRD(id) { const u = this.user(id); return u && u.rd ? open(u.rd) : null; }
  setExpose(id, ids) { const u = this.user(id); u.expose = (ids || []).map(String).slice(0, 50); this.save(); }

  // ===== بيانات المكتبة =====
  udir(id) { return join(this.dir, 'users', id); }
  lib(id) { let L = this.users.get(id); if (L) return L; const d = this.udir(id); mkdirSync(join(d, 'photos'), { recursive: true });
    const items = readJSON(join(d, 'items.json'), []), meta = readJSON(join(d, 'meta.json'), { lists: [], wlists: [] }), st = readJSON(join(d, 'state.json'), { seq: 0, last: null, links: {} });
    L = { id, d, items: new Map(items.map(x => [x.id, x])), meta, st, ver: 1, dirty: false };
    this.users.set(id, L); return L; }
  flush(L) { writeJSON(join(L.d, 'items.json'), [...L.items.values()]); writeJSON(join(L.d, 'meta.json'), L.meta); writeJSON(join(L.d, 'state.json'), L.st); }
  log(L, op, ids) { L.st.seq++; L.ver++; appendFileSync(join(L.d, 'changes.jsonl'), JSON.stringify({ seq: L.st.seq, at: Date.now(), op, n: ids.length, ids: ids.slice(0, 50) }) + '\n'); }
  changes(id, n = 30) { try { const t = readFileSync(join(this.udir(id), 'changes.jsonl'), 'utf8').trim().split('\n'); return t.slice(-n).reverse().map(l => JSON.parse(l)); } catch { return []; } }
  // نفس بصمة التطبيق: السجل بصيغة السلك بدون updated/thumb/thumbV
  sig(x) { const o = { ...x }; delete o.updated; delete o.thumb; delete o.thumbV; return h2(JSON.stringify(o)); }
  photoNames(L) { try { return readdirSync(join(L.d, 'photos')).filter(n => PH_RE.test(n)); } catch { return []; } }
  photoPath(L, f) { return PH_RE.test(f) ? join(L.d, 'photos', f) : null; }

  putItems(L, arr) { const ids = [];
    for (const x of arr) { if (!x || typeof x !== 'object' || typeof x.id !== 'string' || x.id.length > 128 || typeof x.name !== 'string' || !x.name.trim()) continue;
      if (minorRec(x)) { if (L.items.delete(x.id)) ids.push(x.id); continue; }     // بوابة +18: لا يُخزَّن ولا يُعرض
      LOCAL.forEach(k => delete x[k]); const cur = L.items.get(x.id); if (cur && JSON.stringify(cur) === JSON.stringify(x)) continue;   // منع التكرار: نفس البيانات تمامًا لا تُسجَّل كتغيير
      L.items.set(x.id, x); ids.push(x.id); }
    if (ids.length) { this.log(L, 'put', ids); this.flush(L); } return ids.length; }
  delItems(L, ids) { const gone = ids.filter(i => L.items.delete(i)); if (gone.length) { this.log(L, 'del', gone); this.flush(L); this.gcPhotos(L); } return gone.length; }
  setMeta(L, b) { const m = { lists: Array.isArray(b.lists) ? b.lists.filter(x => x && x.id && x.name).map(x => ({ id: String(x.id), name: String(x.name) })) : L.meta.lists,
      wlists: Array.isArray(b.wlists) ? b.wlists.filter(x => x && x.id && x.name).map(x => ({ id: String(x.id), name: String(x.name) })) : L.meta.wlists };
    if (JSON.stringify(m) !== JSON.stringify(L.meta)) { L.meta = m; this.log(L, 'meta', []); this.flush(L); } }
  done(L, info) { L.st.last = { at: Date.now(), ...info }; this.flush(L); }
  // حذف ملفات الصور التي لم يعد يشير إليها أي سجل
  gcPhotos(L) { const used = new Set(); for (const x of L.items.values()) for (const p of [...(x.photos || []), x.thumb]) if (p && typeof p === 'object' && p.f) used.add(p.f);
    for (const f of this.photoNames(L)) if (!used.has(f)) { try { const p = join(L.d, 'photos', f); if (Date.now() - statSync(p).mtimeMs > 6e5) unlinkSync(p); } catch {} } }
  writePhoto(L, f, b64) { const p = this.photoPath(L, f); if (!p) return false; const buf = Buffer.from(b64, 'base64'); if (!buf.length || buf.length > 25e6) return false; writeFileSync(p, buf); return true; }
}

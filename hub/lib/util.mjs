// أدوات مشتركة: نفس دالة البصمة في التطبيق، بوابة +18، تطبيع النصوص، كتابة ذرّية
import { writeFileSync, renameSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// نفس h2 في src/js/31-sync.js — لازم تبقى مطابقة حرفيًا ليتفق الجوال والخادم على بصمة كل ممثلة
export const h2 = s => { let a = 2166136261 >>> 0, b = 5381; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = ((b << 5) + b + c) >>> 0; } return a.toString(36) + b.toString(36) + s.length.toString(36); };

// ===== بوابة +18 (نفس منطق التطبيق: التاريخ الناقص يُحسب بأسوأ حالة) =====
function ageOf(iso, now = new Date()) { const [y, m, d] = iso.split('-').map(Number); let a = now.getFullYear() - y; const mm = now.getMonth() + 1, dd = now.getDate(); if (mm < m || (mm === m && dd < d)) a--; return a; }
export function sdAge(raw) { raw = String(raw || '').trim(); if (!raw) return null; const m = raw.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?(?:$|[T\s])/); if (!m) return NaN;
  const y = +m[1], mo = m[2] ? +m[2] : 12; if (mo < 1 || mo > 12) return NaN; const da = m[3] ? +m[3] : new Date(y, mo, 0).getDate();
  return ageOf(y + '-' + String(mo).padStart(2, '0') + '-' + String(da).padStart(2, '0')); }
export const minorRec = x => { if (!x || !x.birth) return false; const a = sdAge(x.birth); return isNaN(a) || a < 18; };

// ===== النصوص =====
export const fold = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const words = s => fold(s).replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim().split(' ').filter(Boolean);
export const compact = s => fold(s).replace(/[^a-z0-9؀-ۿ]+/g, '');

// ===== الملفات =====
export function readJSON(p, d) { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d; } catch { return d; } }
export function writeJSON(p, v) { mkdirSync(dirname(p), { recursive: true }); const tmp = p + '.tmp'; writeFileSync(tmp, JSON.stringify(v)); renameSync(tmp, p); }
export const today = () => new Date().toISOString().slice(0, 10);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// تشفير الأسرار على القرص (رموز Real-Debrid، رابط الإضافة، رمز الربط)
// AES-256-GCM بمفتاح رئيسي واحد. على ويندوز يُحفظ المفتاح محميًا بـ DPAPI (لا يفكّه إلا حسابك على هذا الجهاز).
import { randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

let KEY = null;
function dpapi(op, b64) {
  const ps = `Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String('${b64}'); ` +
    `[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::${op}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('DPAPI ' + op + ' failed: ' + (r.stderr || '').slice(0, 200));
  return Buffer.from(r.stdout.trim(), 'base64');
}
export function initKey(dir) {
  mkdirSync(dir, { recursive: true });
  const win = process.platform === 'win32' && !process.env.FAV_HUB_NO_DPAPI;
  const f = join(dir, win ? 'master.key.dpapi' : 'master.key');
  if (existsSync(f)) { const raw = readFileSync(f, 'utf8').trim(); KEY = win ? dpapi('Unprotect', raw) : Buffer.from(raw, 'base64'); }
  else { KEY = randomBytes(32); writeFileSync(f, win ? dpapi('Protect', KEY.toString('base64')).toString('base64') : KEY.toString('base64'), { mode: 0o600 }); try { chmodSync(f, 0o600); } catch {} }
  if (KEY.length !== 32) throw new Error('bad master key');
}
export function seal(obj) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return 'v1.' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url');
}
export function open(s) {
  if (typeof s !== 'string' || !s.startsWith('v1.')) return null;
  try { const b = Buffer.from(s.slice(3), 'base64url'); const d = createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')); } catch { return null; }
}
export const token = (n = 24) => randomBytes(n).toString('base64url');
export const sha = s => createHash('sha256').update(String(s)).digest('hex');
export function same(a, b) { const x = Buffer.from(sha(a), 'hex'), y = Buffer.from(sha(b), 'hex'); return timingSafeEqual(x, y); }
export const sixDigits = () => String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));

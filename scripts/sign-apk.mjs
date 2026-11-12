// يوقّع الـAPK غير الموقَّع بـ keystore ثابت (zipalign ثم apksigner من build-tools) ويضعه في dist/Favorites.apk.
// التوقيع الثابت ضروري كي تُثبَّت التحديثات فوق النسخة المثبّتة دون حذفها.
// البيئة: KEYSTORE_FILE (افتراضي signing/release.keystore) · KEYSTORE_PASS (أو signing/keystore.pass) · KEY_ALIAS (افتراضي favorites)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
if (!sdk || !existsSync(join(sdk, 'build-tools'))) { console.error('لم أجد Android SDK (ANDROID_HOME)'); process.exit(1); }
const bt = join(sdk, 'build-tools', readdirSync(join(sdk, 'build-tools')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop());
const win = process.platform === 'win32';
const ks = process.env.KEYSTORE_FILE || join(root, 'signing', 'release.keystore');
const passFile = join(root, 'signing', 'keystore.pass');
const pass = process.env.KEYSTORE_PASS || (existsSync(passFile) ? readFileSync(passFile, 'utf8').trim() : '');
const alias = process.env.KEY_ALIAS || 'favorites';
if (!existsSync(ks) || !pass) { console.error('لا يوجد keystore أو كلمة سره. شغّل: node scripts/make-keystore.mjs'); process.exit(1); }

const dir = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release');
const unsigned = readdirSync(dir).find(f => f.endsWith('.apk')); if (!unsigned) { console.error('لا يوجد APK في ' + dir); process.exit(1); }
const out = join(root, 'dist'); mkdirSync(out, { recursive: true });
const aligned = join(out, 'aligned.apk'), final = join(out, 'Favorites.apk');
execFileSync(join(bt, win ? 'zipalign.exe' : 'zipalign'), ['-f', '-p', '4', join(dir, unsigned), aligned], { stdio: 'inherit' });
const signArgs = ['sign', '--ks', ks, '--ks-key-alias', alias, '--ks-pass', 'pass:' + pass, '--key-pass', 'pass:' + pass, '--out', final, aligned];
if (win) execFileSync('cmd', ['/c', join(bt, 'apksigner.bat'), ...signArgs], { stdio: 'inherit' }); else execFileSync(join(bt, 'apksigner'), signArgs, { stdio: 'inherit' });
if (win) execFileSync('cmd', ['/c', join(bt, 'apksigner.bat'), 'verify', '--print-certs', final], { stdio: 'inherit' }); else execFileSync(join(bt, 'apksigner'), ['verify', '--print-certs', final], { stdio: 'inherit' });
console.log('signed → ' + final);

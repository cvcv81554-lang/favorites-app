// يولّد keystore التوقيع مرة واحدة فقط في signing/ (المجلد خارج git). لا يعيد توليده إن وُجد.
// احتفظ بنسخة من مجلد signing/ في مكان آمن: ضياعه يعني أن التحديثات لن تُثبَّت فوق النسخة القديمة.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'signing');
const ks = join(dir, 'release.keystore');
if (existsSync(ks)) { console.log('keystore موجود: ' + ks); process.exit(0); }
mkdirSync(dir, { recursive: true });
const pass = randomBytes(18).toString('base64url');
const keytool = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool';
execFileSync(keytool, ['-genkeypair', '-v', '-keystore', ks, '-storetype', 'PKCS12', '-alias', 'favorites', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-storepass', pass, '-keypass', pass, '-dname', 'CN=Favorites App'], { stdio: 'inherit' });
writeFileSync(join(dir, 'keystore.pass'), pass + '\n');
console.log('تم توليد ' + ks);

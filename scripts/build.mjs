// بناء صغير: يدمج وحدات src/js بالترتيب في www/app.js (نطاق مشترك عمدًا)،
// ويحزّم إضافات Capacitor في www/native.js، وينسخ الواجهة.
import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src'), out = join(root, 'www');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const units = readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort();
const js = units.map(f => `/* ---- ${f} ---- */\n` + readFileSync(join(src, 'js', f), 'utf8')).join('\n;\n');
writeFileSync(join(out, 'app.js'), js);

await build({ entryPoints: [join(src, 'native', 'index.js')], bundle: true, format: 'iife', minify: true, target: ['es2020'], outfile: join(out, 'native.js') });

const css = readFileSync(join(src, 'app.css'), 'utf8');
writeFileSync(join(out, 'app.css'), css);
const v = createHash('sha1').update(js + css).digest('hex').slice(0, 8);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const ver = process.env.APP_VERSION || pkg.version;
writeFileSync(join(out, 'index.html'), readFileSync(join(src, 'index.html'), 'utf8').replaceAll('__V__', v).replaceAll('__VERSION__', ver));
if (existsSync(join(root, 'resources', 'icon.png'))) cpSync(join(root, 'resources', 'icon.png'), join(out, 'icon.png'));
console.log(`built www/ (${units.length} units, ${(js.length / 1024).toFixed(0)} KB, v${ver}-${v})`);

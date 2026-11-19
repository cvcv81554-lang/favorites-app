// يعدّل مشروع android/ المولَّد بـ `npx cap add android` (لا نحفظ مشروعًا أصليًا مكتوبًا يدويًا):
// Android TV (leanback + banner + بلا لمس) · الأيقونات · إضافة Shell المحلية (كشف التلفاز + FLAG_SECURE)
// · رقم الإصدار من البيئة · صلاحيات التخزين للأجهزة القديمة. آمن لإعادة التشغيل أكثر من مرة.
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'android', 'app'), main = join(app, 'src', 'main'), res = join(main, 'res');
if (!existsSync(main)) { console.error('android/ غير موجود. شغّل: npx cap add android'); process.exit(1); }
const cfg = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
const pkg = cfg.appId, BG = cfg.backgroundColor || '#15101f';
const edit = (file, fn) => { const a = readFileSync(file, 'utf8'), b = fn(a); if (a !== b) writeFileSync(file, b); return a !== b; };
const need = (ok, what) => { if (!ok) { console.error('تعذّر تعديل: ' + what); process.exit(1); } };

// ---- AndroidManifest.xml ----
const mf = join(main, 'AndroidManifest.xml');
edit(mf, s => {
  if (!s.includes('android.software.leanback')) s = s.replace(/<manifest([^>]*)>/, `<manifest$1>
    <uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />`);
  if (!s.includes('android:banner=')) s = s.replace(/<application\b/, '<application android:banner="@drawable/banner" android:usesCleartextTraffic="true" android:requestLegacyExternalStorage="true"');
  // رابط favlib:// (مسح رمز QR من الشاشة يفتح التطبيق ويربطه)
  if (!s.includes('android:scheme="favlib"')) s = s.replace(/(<\/intent-filter>)/, '$1\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="favlib" />\n            </intent-filter>');
  if (!s.includes('LEANBACK_LAUNCHER')) s = s.replace(/(<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>)/, '$1\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />');
  return s;
});
const m = readFileSync(mf, 'utf8');
need(m.includes('android:scheme="favlib"') && m.includes('LEANBACK_LAUNCHER') && m.includes('android:banner=') && m.includes('android.software.leanback') && m.includes('android.hardware.touchscreen'), 'AndroidManifest.xml');

// ---- الأيقونات و banner ----
const src = join(root, 'resources', 'android');
for (const d of readdirSync(src)) { if (d.startsWith('mipmap-')) { mkdirSync(join(res, d), { recursive: true }); cpSync(join(src, d), join(res, d), { recursive: true }); } }
mkdirSync(join(res, 'drawable-xhdpi'), { recursive: true }); cpSync(join(src, 'banner.png'), join(res, 'drawable-xhdpi', 'banner.png'));
mkdirSync(join(res, 'mipmap-anydpi-v26'), { recursive: true });
const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_bg"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive); writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
mkdirSync(join(res, 'drawable'), { recursive: true });
writeFileSync(join(res, 'drawable', 'ic_launcher_bg.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android">\n    <gradient android:angle="315" android:startColor="#3d2b62" android:endColor="#150f22"/>\n</shape>\n');
// شاشة البداية: لون ثابت بدل صورة تتمدد
writeFileSync(join(res, 'drawable', 'splash_bg.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android">\n    <solid android:color="${BG}"/>\n</shape>\n`);
edit(join(res, 'values', 'styles.xml'), s => s.replace(/@drawable\/splash\b/g, '@drawable/splash_bg'));

// ---- الإضافة المحلية Shell + MainActivity ----
const jdir = join(main, 'java', ...pkg.split('.')); mkdirSync(jdir, { recursive: true });
writeFileSync(join(jdir, 'ShellPlugin.java'), readFileSync(join(root, 'resources', 'android', 'ShellPlugin.java'), 'utf8').replace(/__PKG__/g, pkg));
writeFileSync(join(jdir, 'MainActivity.java'), `package ${pkg};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShellPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

// ---- رقم الإصدار من البيئة (ليُثبَّت كل بناء فوق السابق) ----
edit(join(app, 'build.gradle'), s => s
  .replace(/versionCode\s+\d+/, 'versionCode((System.getenv("VERSION_CODE") ?: "1") as Integer)')
  .replace(/versionName\s+"[^"]*"/, 'versionName(System.getenv("VERSION_NAME") ?: "1.0.0")'));
need(/VERSION_CODE/.test(readFileSync(join(app, 'build.gradle'), 'utf8')), 'app/build.gradle');
// Background Runner: محرك JS (aar) يُحل من node_modules (ما يفعله postinstall الخاص بالإضافة، لأن android/ يُولَّد بعد npm ci)
edit(join(app, 'build.gradle'), s => s.includes('background-runner/android/src/main/libs') ? s : s.replace("dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'", "dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
        dirs '../../node_modules/@capacitor/background-runner/android/src/main/libs', 'libs'"));
need(readFileSync(join(app, 'build.gradle'), 'utf8').includes('background-runner/android/src/main/libs'), 'app/build.gradle (background-runner flatDir)');
// الإضافة تطلب صلاحيات الموقع ولا نستخدمها: تُزال من التطبيق النهائي
edit(mf, s => { if (s.includes('ACCESS_FINE_LOCATION" tools:node="remove"')) return s;
  if (!s.includes('xmlns:tools=')) s = s.replace(/<manifest/, '<manifest xmlns:tools="http://schemas.android.com/tools"');
  return s.replace(/(<manifest[^>]*>)/, `$1
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="remove" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" tools:node="remove" />`); });
need(readFileSync(mf, 'utf8').includes('ACCESS_BACKGROUND_LOCATION" tools:node="remove"'), 'AndroidManifest.xml (location removed)');
console.log('android patched (' + pkg + ')');

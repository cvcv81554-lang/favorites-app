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
  if (!s.includes('LEANBACK_LAUNCHER')) s = s.replace(/(<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>)/, '$1\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />');
  return s;
});
const m = readFileSync(mf, 'utf8');
need(m.includes('LEANBACK_LAUNCHER') && m.includes('android:banner=') && m.includes('android.software.leanback') && m.includes('android.hardware.touchscreen'), 'AndroidManifest.xml');

// ---- الأيقونات و banner ----
const src = join(root, 'resources', 'android');
for (const d of readdirSync(src)) { if (d.startsWith('mipmap-')) { mkdirSync(join(res, d), { recursive: true }); cpSync(join(src, d), join(res, d), { recursive: true }); } }
mkdirSync(join(res, 'drawable-xhdpi'), { recursive: true }); cpSync(join(src, 'banner.png'), join(res, 'drawable-xhdpi', 'banner.png'));
mkdirSync(join(res, 'mipmap-anydpi-v26'), { recursive: true });
const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_bg"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive); writeFileSync(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
mkdirSync(join(res, 'drawable'), { recursive: true });
writeFileSync(join(res, 'drawable', 'ic_launcher_bg.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android">\n    <gradient android:angle="315" android:startColor="#f0b59a" android:centerColor="#d98f6c" android:endColor="#d8788f"/>\n</shape>\n');
// شاشة البداية: لون ثابت بدل صورة تتمدد
writeFileSync(join(res, 'drawable', 'splash_bg.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android">\n    <solid android:color="${BG}"/>\n</shape>\n`);
edit(join(res, 'values', 'styles.xml'), s => s.replace(/@drawable\/splash\b/g, '@drawable/splash_bg'));

// ---- الإضافة المحلية Shell + MainActivity ----
const jdir = join(main, 'java', ...pkg.split('.')); mkdirSync(jdir, { recursive: true });
writeFileSync(join(jdir, 'ShellPlugin.java'), `package ${pkg};

import android.content.pm.PackageManager;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** كشف Android TV، وإخفاء المحتوى من قائمة التطبيقات الأخيرة (FLAG_SECURE). */
@CapacitorPlugin(name = "Shell")
public class ShellPlugin extends Plugin {
    @PluginMethod
    public void info(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        boolean tv = pm.hasSystemFeature("android.software.leanback") || pm.hasSystemFeature("android.hardware.type.television") || !pm.hasSystemFeature("android.hardware.touchscreen");
        JSObject ret = new JSObject();
        ret.put("tv", tv);
        ret.put("sdk", android.os.Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void secure(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
`);
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
console.log('android patched (' + pkg + ')');

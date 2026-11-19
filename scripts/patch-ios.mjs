// يعدّل مشروع ios/ المولَّد بـ `npx cap add ios` (يعمل على macOS في CI):
// مشاركة الملفات مع تطبيق «الملفات» · الأيقونة وشاشة البداية · تغطية الشاشة عند الذهاب للخلفية · كل الاتجاهات.
import { readFileSync, writeFileSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'ios', 'App', 'App');
if (!existsSync(app)) { console.error('ios/ غير موجود. شغّل: npx cap add ios'); process.exit(1); }
const plist = join(app, 'Info.plist');
const pb = cmd => { try { execFileSync('/usr/libexec/PlistBuddy', ['-c', cmd, plist], { stdio: 'pipe' }); return true; } catch { return false; } };
const setBool = (k, v) => { pb(`Delete :${k}`); if (!pb(`Add :${k} bool ${v}`)) { console.error('تعذّر ضبط ' + k); process.exit(1); } };
const setArr = (k, vals) => { pb(`Delete :${k}`); pb(`Add :${k} array`); vals.forEach((v, i) => pb(`Add :${k}:${i} string ${v}`)); };

// نسخ التطبيق الاحتياطية (Documents) تظهر في تطبيق «الملفات» ويمكن فتحها في مكانها
setBool('UIFileSharingEnabled', true);
setBool('LSSupportsOpeningDocumentsInPlace', true);
setBool('ITSAppUsesNonExemptEncryption', false);
setBool('UIRequiresFullScreen', false);
const ALL = ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight', 'UIInterfaceOrientationPortraitUpsideDown'];
setArr('UISupportedInterfaceOrientations', ALL.slice(0, 3)); setArr('UISupportedInterfaceOrientations~ipad', ALL);
pb('Delete :NSAppTransportSecurity'); pb('Add :NSAppTransportSecurity dict'); pb('Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true');
// المزامنة مع الشاشة: اتصال HTTP على الشبكة المحلية + فتح التطبيق من رمز QR (favlib://)
pb('Add :NSAppTransportSecurity:NSAllowsArbitraryLoads bool true');
pb('Delete :NSLocalNetworkUsageDescription'); pb('Add :NSLocalNetworkUsageDescription string "لإرسال مكتبتك إلى تطبيق المفضلة على شاشتك في نفس الشبكة"');
pb('Delete :CFBundleURLTypes'); pb('Add :CFBundleURLTypes array'); pb('Add :CFBundleURLTypes:0 dict'); pb('Add :CFBundleURLTypes:0:CFBundleURLName string com.favlib.app');
pb('Add :CFBundleURLTypes:0:CFBundleURLSchemes array'); if (!pb('Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string favlib')) { console.error('تعذّر ضبط CFBundleURLTypes'); process.exit(1); }

// الأيقونة (ملف واحد 1024) وشاشة البداية
const assets = join(app, 'Assets.xcassets');
for (const f of readdirSync(join(assets, 'AppIcon.appiconset'))) if (f.endsWith('.png')) cpSync(join(root, 'resources', 'icon.png'), join(assets, 'AppIcon.appiconset', f));
for (const f of readdirSync(join(assets, 'Splash.imageset'))) if (f.endsWith('.png')) cpSync(join(root, 'resources', 'splash.png'), join(assets, 'Splash.imageset', f));

// تغطية الشاشة عند مغادرة التطبيق (قبل أن يلتقط النظام صورة قائمة التطبيقات)
const del = join(app, 'AppDelegate.swift');
let s = readFileSync(del, 'utf8');
if (!s.includes('privacyCover')) {
  const cover = `
    private var privacyCover: UIView?
    private func showPrivacyCover() {
        guard privacyCover == nil, let w = window else { return }
        let v = UIView(frame: w.bounds)
        v.backgroundColor = UIColor(red: 0x15/255.0, green: 0x10/255.0, blue: 0x1f/255.0, alpha: 1)
        v.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        w.addSubview(v)
        privacyCover = v
    }
    private func hidePrivacyCover() { privacyCover?.removeFromSuperview(); privacyCover = nil }
`;
  const a = s.replace(/(class AppDelegate[^{]*\{)/, `$1\n${cover}`)
    .replace(/(func applicationWillResignActive\(_ application: UIApplication\) \{)/, '$1\n        showPrivacyCover()')
    .replace(/(func applicationDidBecomeActive\(_ application: UIApplication\) \{)/, '$1\n        hidePrivacyCover()');
  if (a.includes('showPrivacyCover()\n') && a.includes('hidePrivacyCover()\n')) { s = a; writeFileSync(del, s); }
  else console.warn('تحذير: لم أجد دوال AppDelegate المتوقعة؛ تغطية الخلفية ستعتمد على طبقة الواجهة فقط');
}
// Background Runner: مهمة BGTaskScheduler + أوضاع الخلفية + تسجيل المهمة في AppDelegate
setArr('BGTaskSchedulerPermittedIdentifiers', ['com.favlib.app.check']);
setArr('UIBackgroundModes', ['fetch', 'processing']);
s = readFileSync(del, 'utf8');
if (!s.includes('CapacitorBackgroundRunner')) {
  const b = s.replace(/import Capacitor
/, 'import Capacitor
import CapacitorBackgroundRunner
')
    .replace(/(func application\(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\?\) -> Bool \{)/,
      '$1
        BackgroundRunnerPlugin.registerBackgroundTask()
        BackgroundRunnerPlugin.handleApplicationDidFinishLaunching(launchOptions: launchOptions)');
  if (!b.includes('import CapacitorBackgroundRunner') || !b.includes('registerBackgroundTask()')) { console.error('تعذّر تسجيل Background Runner في AppDelegate'); process.exit(1); }
  writeFileSync(del, b);
}
console.log('ios patched');

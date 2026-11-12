// جسر المنصّة: يُحزَّم بـ esbuild إلى www/native.js ويُحمَّل قبل وحدات التطبيق.
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// إضافة محلية صغيرة (أندرويد فقط): كشف التلفاز + إخفاء المحتوى من قائمة التطبيقات الأخيرة
const Shell = registerPlugin('Shell');

window.Native = {
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
  Capacitor, CapacitorHttp, App, Filesystem, Directory, Encoding, Share, Shell
};

// جسر المنصّة: يُحزَّم بـ esbuild إلى www/native.js ويُحمَّل قبل وحدات التطبيق.
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import qrcode from 'qrcode-generator';
import { BackgroundRunner } from '@capacitor/background-runner';

// إضافة محلية صغيرة (أندرويد فقط): كشف التلفاز، FLAG_SECURE، وخادم المزامنة المحلي على الشاشة
const Shell = registerPlugin('Shell');

window.Native = {
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
  Capacitor, CapacitorHttp, App, Filesystem, Directory, Encoding, Share, Shell, BackgroundRunner
};

// رمز QR كـ SVG (للربط بين الجوال والشاشة)
window.QR = (text, cell = 8) => { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }); };

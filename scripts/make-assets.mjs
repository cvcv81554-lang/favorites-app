// يولّد الأيقونات و banner التلفاز وشاشة البداية في resources/ (تُشغَّل يدويًا عند تغيير الشعار فقط؛
// المخرجات محفوظة في المستودع فلا يحتاجها CI). يستعمل متصفح Edge/Chrome المثبّت عبر playwright-core.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const res = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');
const STAR = 'M32 13l5.6 11.6 12.6 1.8-9.1 8.9 2.1 12.6L32 42l-11.2 5.9 2.1-12.6-9.1-8.9 12.6-1.8z';
const GRAD = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0b59a"/><stop offset=".55" stop-color="#d98f6c"/><stop offset="1" stop-color="#d8788f"/></linearGradient>';
const svg = (w, h, body, bg = 'transparent') => `<html><body style="margin:0;background:${bg}"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${GRAD}</defs>${body}</svg></body></html>`;
const star = (size, cx, cy, fill = '#fff') => `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 64})"><path d="${STAR}" fill="${fill}"/></g>`;

let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel }); break; } catch {} }
const page = await browser.newPage();
async function png(file, w, h, body, bg, alpha = false) { mkdirSync(dirname(join(res, file)), { recursive: true }); await page.setViewportSize({ width: w, height: h }); await page.setContent(svg(w, h, body, bg)); await page.screenshot({ path: join(res, file), omitBackground: alpha, clip: { x: 0, y: 0, width: w, height: h } }); }

// iOS + أيقونة الواجهة: مربع كامل بلا شفافية
await png('icon.png', 1024, 1024, `<rect width="1024" height="1024" fill="url(#g)"/>${star(1150, 512, 505)}`, '#d98f6c');
// شاشة البداية (iOS) — خلفية بنفسجية داكنة وشعار في الوسط
await png('splash.png', 2732, 2732, `<rect width="2732" height="2732" fill="#15101f"/><rect x="1166" y="1166" width="400" height="400" rx="112" fill="url(#g)"/>${star(450, 1366, 1363)}`, '#15101f');
// banner التلفاز 320×180
await png('android/banner.png', 320, 180, `<rect width="320" height="180" fill="#15101f"/><circle cx="270" cy="20" r="120" fill="#d98f6c" fill-opacity=".16"/><circle cx="30" cy="170" r="90" fill="#d8788f" fill-opacity=".12"/><rect x="34" y="54" width="72" height="72" rx="20" fill="url(#g)"/>${star(81, 70, 89.5)}<text x="124" y="101" font-family="Segoe UI,Arial,sans-serif" font-size="34" font-weight="700" fill="#f3edf8">Favorites</text>`, '#15101f');
// أندرويد: أيقونات كل الكثافات
for (const [d, k] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  const s = 48 * k, f = 108 * k;
  await png(`android/mipmap-${d}/ic_launcher.png`, s, s, `<rect x="${s * 0.04}" y="${s * 0.04}" width="${s * 0.92}" height="${s * 0.92}" rx="${s * 0.22}" fill="url(#g)"/>${star(s * 1.02, s / 2, s * 0.495)}`, 'transparent', true);
  await png(`android/mipmap-${d}/ic_launcher_round.png`, s, s, `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.48}" fill="url(#g)"/>${star(s * 0.98, s / 2, s * 0.495)}`, 'transparent', true);
  await png(`android/mipmap-${d}/ic_launcher_foreground.png`, f, f, star(f * 0.66, f / 2, f * 0.497), 'transparent', true);
}
await browser.close();
console.log('assets written to resources/');

// يولّد الأيقونات و banner التلفاز وشاشة البداية في resources/ (تُشغَّل يدويًا عند تغيير الشعار فقط؛
// المخرجات محفوظة في المستودع فلا يحتاجها CI). يستعمل متصفح Edge/Chrome المثبّت عبر playwright-core.
// الشعار: قلب نحاسي (المفضلة) بداخله نجمة (التقييم) على خلفية بنفسجية داكنة.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const res = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');
const HEART = 'M32 53C13 39.5 9 30 9 22.5 9 14.8 14.8 10 21 10c4.6 0 8.6 2.6 11 7 2.400-4.400 6.400-7 11-7 6.200 0 12 4.800 12 12.500 0 7.500-4 17-23 30.500z';
const STAR = 'M32 13l5.6 11.6 12.6 1.8-9.1 8.9 2.1 12.6L32 42l-11.2 5.9 2.1-12.6-9.1-8.9 12.6-1.8z';
const DEFS = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6c2a8"/><stop offset=".5" stop-color="#dd9470"/><stop offset="1" stop-color="#d8788f"/></linearGradient><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d2b62"/><stop offset="1" stop-color="#150f22"/></linearGradient>';
const svg = (w, h, body, bg = 'transparent') => `<html><body style="margin:0;background:${bg}"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${DEFS}</defs>${body}</svg></body></html>`;
// القلب والنجمة داخل مربع ضلعه size مركزه (cx,cy)
const glyph = (size, cx, cy) => `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 64})"><path d="${HEART}" fill="url(#g)"/><path transform="translate(18.9 14.6) scale(.41)" d="${STAR}" fill="#fff"/></g>`;
const glow = (w, h) => `<circle cx="${w * 0.78}" cy="${h * 0.16}" r="${w * 0.5}" fill="#d98f6c" fill-opacity=".13"/><circle cx="${w * 0.1}" cy="${h * 0.95}" r="${w * 0.42}" fill="#d8788f" fill-opacity=".1"/>`;

let browser; for (const channel of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel }); break; } catch {} }
const page = await browser.newPage();
async function png(file, w, h, body, bg, alpha = false) { mkdirSync(dirname(join(res, file)), { recursive: true }); await page.setViewportSize({ width: w, height: h }); await page.setContent(svg(w, h, body, bg)); await page.screenshot({ path: join(res, file), omitBackground: alpha, clip: { x: 0, y: 0, width: w, height: h } }); }

await png('icon.png', 1024, 1024, `<rect width="1024" height="1024" fill="url(#bg)"/>${glow(1024, 1024)}${glyph(760, 512, 520)}`, '#150f22');
await png('splash.png', 2732, 2732, `<rect width="2732" height="2732" fill="#15101f"/>${glyph(520, 1366, 1366)}`, '#15101f');
await png('android/banner.png', 320, 180, `<rect width="320" height="180" fill="url(#bg)"/>${glow(320, 180)}${glyph(92, 72, 91)}<text x="132" y="102" font-family="Segoe UI,Arial,sans-serif" font-size="34" font-weight="700" fill="#f3edf8">Favorites</text>`, '#150f22');
for (const [d, k] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  const s = 48 * k, f = 108 * k;
  await png(`android/mipmap-${d}/ic_launcher.png`, s, s, `<rect x="${s * 0.04}" y="${s * 0.04}" width="${s * 0.92}" height="${s * 0.92}" rx="${s * 0.22}" fill="url(#bg)"/>${glyph(s * 0.7, s / 2, s * 0.51)}`, 'transparent', true);
  await png(`android/mipmap-${d}/ic_launcher_round.png`, s, s, `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.48}" fill="url(#bg)"/>${glyph(s * 0.64, s / 2, s * 0.52)}`, 'transparent', true);
  await png(`android/mipmap-${d}/ic_launcher_foreground.png`, f, f, glyph(f * 0.5, f / 2, f * 0.505), 'transparent', true);
}
await browser.close();
console.log('assets written to resources/');

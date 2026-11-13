// إضافة Favorites بصيغة Stremio Addon (manifest / catalog / meta / stream) التي يستخدمها Nuvio
import { build, recs, hay, whay, pid } from './model.mjs';
import { fold, today } from './util.mjs';
import { matchScore, quality, size, rdMsg } from './rd.mjs';

export const VERSION = '1.0.0';
const PAGE = 100;

export function manifest(store, uid, base) {
  const L = store.lib(uid), m = build(L), u = store.user(uid);
  const tags = [...new Set(m.perf.flatMap(p => p.it.tags || []))].sort((a, b) => a.localeCompare(b)).slice(0, 200);
  const names = m.perf.filter(p => p.works.length).map(p => p.it.name).sort((a, b) => a.localeCompare(b)).slice(0, 500);
  const sk = [{ name: 'skip' }], gen = o => ({ name: 'genre', options: o, isRequired: false });
  const cat = (type, id, name, extra = sk) => ({ type, id, name, extra, extraSupported: extra.map(e => e.name) });
  const lists = (L.meta.lists || []).filter(x => (u.expose || []).includes(x.id));
  return {
    id: 'org.favorites.library', version: VERSION, name: 'Favorites',
    description: 'مكتبتك الشخصية من تطبيق Favorites: ممثلاتك وأعمالهن، ومصادر تشغيل من حسابك في Real-Debrid.',
    logo: base + '/static/logo.png', background: base + '/static/bg.jpg',
    types: ['series', 'movie'], idPrefixes: ['favp:', 'favw:'],
    resources: ['catalog', { name: 'meta', types: ['series', 'movie'], idPrefixes: ['favp:', 'favw:'] }, { name: 'stream', types: ['series', 'movie'], idPrefixes: ['favw:'] }],
    catalogs: [
      cat('series', 'fav_p_fav', 'ممثلاتي المفضلات', [...sk, gen(tags)]),
      cat('series', 'fav_p_new', 'أحدث الممثلات المضافة'),
      cat('series', 'fav_p_all', 'كل مكتبتي', [...sk, { name: 'search' }, gen(tags)]),
      ...lists.map(x => cat('series', 'fav_l_' + x.id, x.name)),
      cat('movie', 'fav_w_ready', 'جاهزة للمشاهدة (Real-Debrid)'),
      cat('movie', 'fav_w_recs', 'اقتراحات Favorites الذكية'),
      cat('movie', 'fav_w_mine', 'أعمال ممثلاتي', [...sk, { name: 'search' }]),
      cat('movie', 'fav_w_new', 'أحدث الأعمال المضافة'),
      cat('movie', 'fav_w_upc', 'الأعمال القادمة'),
      cat('movie', 'fav_w_by', 'الأعمال حسب ممثلة', [{ name: 'genre', options: names, isRequired: true }, ...sk]),
    ],
    behaviorHints: { adult: true, configurable: false, configurationRequired: false },
  };
}

// ===== الصور =====
const img = (ctx, p) => !p ? '' : typeof p === 'string' ? (/^https:\/\//i.test(p) ? p : '') : (p.f ? `${ctx.base}/img/${encodeURIComponent(p.f)}` : '');
// ممثلة بلا صورة: بطاقة بديلة أنيقة (SVG) بالحرف الأول بدل مربع فارغ
const ph = (ctx, name) => `${ctx.base}/ph.svg?t=${encodeURIComponent(String(name || '♡').trim().slice(0, 2))}`;
const poster = (ctx, it) => img(ctx, it.thumb) || img(ctx, (it.photos || [])[0]) || ph(ctx, it.name);
const bgOf = (ctx, it) => img(ctx, (it.photos || [])[1]) || img(ctx, (it.photos || [])[0]) || poster(ctx, it);
const iso = d => d ? (d.length === 4 ? d + '-01-01' : d) + 'T00:00:00.000Z' : undefined;
const stars = r => +r > 0 ? '★'.repeat(Math.round(+r)) + '☆'.repeat(5 - Math.round(+r)) : '';

// Nuvio يعرض أول 4 أحرف من releaseInfo كسنة: نعطيه مدى سنوات أعمالها
const yearsOf = p => { const ys = p.works.map(W => +(W.date || '').slice(0, 4)).filter(Boolean); return ys.length ? (Math.min(...ys) === Math.max(...ys) ? String(ys[0]) : Math.min(...ys) + '–' + Math.max(...ys)) : ''; };
function pPreview(ctx, p) { const it = p.it;
  return { id: p.id, type: 'series', name: it.name, poster: poster(ctx, it), posterShape: 'poster', background: bgOf(ctx, it),
    genres: (it.tags || []).slice(0, 6), releaseInfo: yearsOf(p),
    imdbRating: +it.rating > 0 ? String(+it.rating * 2) : undefined, description: [it.fav ? '♥ في المفضلة' : '', it.country, p.works.length ? p.works.length + ' عمل' : ''].filter(Boolean).join(' · ') }; }
function wPreview(ctx, W, why) { const w = W.w;
  return { id: W.id, type: 'movie', name: w.t, poster: w.p || poster(ctx, W.perfs[0].it), posterShape: w.p ? 'landscape' : 'poster', background: w.p || bgOf(ctx, W.perfs[0].it),
    releaseInfo: (W.date || '').slice(0, 4), genres: (w.tg || []).slice(0, 6), imdbRating: +w.r > 0 ? String(+w.r * 2) : undefined,
    description: [why, W.perfs.map(p => p.it.name).join('، '), w.s].filter(Boolean).join(' · ') }; }

export async function catalog(ctx, type, id, extra) {
  const m = build(ctx.L), skip = Math.max(0, +extra.skip || 0), q = extra.search ? fold(extra.search) : '', g = extra.genre || '';
  const page = a => a.slice(skip, skip + PAGE);
  if (type === 'series') {
    let a;
    if (id === 'fav_p_fav') a = m.perf.filter(p => p.it.fav).sort((x, y) => (+y.it.rating || 0) - (+x.it.rating || 0) || x.it.name.localeCompare(y.it.name));
    else if (id === 'fav_p_new') a = [...m.perf].sort((x, y) => (y.it.added || 0) - (x.it.added || 0));
    else if (id === 'fav_p_all') a = [...m.perf].sort((x, y) => x.it.name.localeCompare(y.it.name));
    else if (id.startsWith('fav_l_')) { const lid = id.slice(6); if (!(ctx.user.expose || []).includes(lid)) return { metas: [] }; a = m.perf.filter(p => (p.it.lists || []).includes(lid)); }
    else return { metas: [] };
    if (g) a = a.filter(p => (p.it.tags || []).includes(g));
    if (q) a = a.filter(p => hay(p).includes(q));
    return { metas: page(a).map(p => pPreview(ctx, p)) };
  }
  if (type === 'movie') {
    const now = today(); let a, why = null;
    if (id === 'fav_w_mine') a = m.works.filter(W => !W.upc).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    else if (id === 'fav_w_new') a = [...m.works].sort((x, y) => (y.added || 0) - (x.added || 0) || (y.date || '').localeCompare(x.date || ''));
    else if (id === 'fav_w_upc') a = m.works.filter(W => W.upc).sort((x, y) => (x.date || '9').localeCompare(y.date || '9'));
    else if (id === 'fav_w_recs') { const r = recs(m); why = new Map(r.map(x => [x.W.id, x.why])); a = r.map(x => x.W); }
    else if (id === 'fav_w_by') { if (!g) return { metas: [] }; const p = m.perf.find(p => p.it.name === g); a = p ? p.works : []; }
    else if (id === 'fav_w_ready') { const ready = await ctx.ready(); a = m.works.filter(W => ready.has(W.id)).sort((x, y) => (y.date || '').localeCompare(x.date || '')); }
    else return { metas: [] };
    if (q) a = a.filter(W => whay(W).includes(q));
    void now; return { metas: page(a).map(W => wPreview(ctx, W, why && why.get(W.id))) };
  }
  return { metas: [] };
}

export function meta(ctx, type, id) {
  const m = build(ctx.L);
  if (id.startsWith('favp:')) { const p = m.byP.get(id); if (!p) return { meta: null }; const it = p.it;
    const info = [it.country, it.birth ? 'مواليد ' + it.birth.slice(0, 4) : '', it.height ? it.height + ' سم' : '', stars(it.rating), it.tier ? 'المستوى ' + it.tier : '', it.fav ? '♥ في المفضلة' : ''].filter(Boolean).join(' · ');
    return { meta: { ...pPreview(ctx, p), description: [info, it.aliases ? 'أسماء أخرى: ' + it.aliases : ''].filter(Boolean).join('\n'),
      cast: [it.name], links: (it.tags || []).map(t => ({ name: t, category: 'Genres', url: `stremio:///discover/${encodeURIComponent(ctx.base + '/manifest.json')}/series/fav_p_all?genre=${encodeURIComponent(t)}` })),
      videos: p.works.map((W, i) => ({ id: W.id, title: W.w.t, released: iso(W.date) || new Date(it.added || Date.now()).toISOString(), season: 1, episode: p.works.length - i,
        thumbnail: W.w.p || poster(ctx, it), overview: [W.w.s, W.w.du ? W.w.du + ' دقيقة' : '', W.w.w ? '✓ شاهدته' : '', W.upc ? '⏳ قادم' : '', W.w.ds || ''].filter(Boolean).join(' · ') })),
      behaviorHints: { defaultVideoId: null, hasScheduledVideos: p.works.some(W => W.upc) } } }; }
  if (id.startsWith('favw:')) { const W = m.byW.get(id); if (!W) return { meta: null }; const w = W.w;
    return { meta: { ...wPreview(ctx, W), description: [w.ds, 'بطولة: ' + W.perfs.map(p => p.it.name).join('، '), w.s ? 'الاستوديو: ' + w.s : '', w.w ? '✓ شاهدته' : '', +w.r ? 'تقييمك: ' + stars(w.r) : '', W.upc ? '⏳ لم يصدر بعد' : ''].filter(Boolean).join('\n'),
      released: iso(W.date), runtime: w.du ? w.du + ' min' : undefined, cast: W.perfs.map(p => p.it.name),
      links: [...W.perfs.map(p => ({ name: p.it.name, category: 'Cast', url: `stremio:///detail/series/${encodeURIComponent(p.id)}` })), ...(w.s ? [{ name: w.s, category: 'Studio', url: `stremio:///discover/${encodeURIComponent(ctx.base + '/manifest.json')}/movie/fav_w_mine?search=${encodeURIComponent(w.s)}` }] : [])],
      behaviorHints: { defaultVideoId: id } } }; }
  return { meta: null };
}

// ===== المصادر: مطابقات من حسابك + روابطك اليدوية. لا نعرض مصدرًا غير موجود. =====
export async function streams(ctx, id) {
  const m = build(ctx.L); const W = m.byW.get(String(id).split(/[:]/).slice(0, 2).join(':')); if (!W) return { streams: [] };
  const out = [];
  if (!ctx.rd.linked) { if (W.w.u) out.push({ name: 'Favorites', title: 'Real-Debrid غير مربوط\nصفحة العمل (خارج Nuvio)', externalUrl: W.w.u }); return { streams: out }; }
  let cands = [];
  try { cands = await ctx.sources(W); }
  catch (e) { out.push({ name: 'Favorites ⚠', title: 'تعذّر فحص حسابك في Real-Debrid: ' + rdMsg(e), externalUrl: W.w.u || 'https://real-debrid.com/' }); return { streams: out }; }
  for (const c of cands) {
    const q = quality(c.name);
    out.push({ name: 'Favorites RD\n' + (q || 'Direct'), title: [c.name, [size(c.bytes), c.manual ? 'رابطك' : 'من حسابك'].filter(Boolean).join(' · ')].join('\n'),
      url: `${ctx.base}/play/${c.key}/${encodeURIComponent(c.name.replace(/[\\/?#%]/g, '_').slice(-120))}`,
      behaviorHints: { bingeGroup: 'favorites-rd-' + (q || 'x'), filename: c.name, videoSize: c.bytes || undefined, notWebReady: !/\.mp4$/i.test(c.name) } });
  }
  if (!out.length && W.w.u) out.push({ name: 'Favorites', title: 'لا يوجد مصدر لهذا العمل في حسابك\nصفحة العمل (خارج Nuvio)', externalUrl: W.w.u });
  return { streams: out };
}
export { matchScore };
export const PAGE_SIZE = PAGE; export const _pid = pid;

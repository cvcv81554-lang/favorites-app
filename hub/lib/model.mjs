// الفهرس المشتق من المكتبة: ممثلات وأعمال بمعرّفات ثابتة، يُعاد بناؤه فقط عند تغيّر المكتبة (L.ver)
import { h2, words, compact, fold, minorRec, today } from './util.mjs';

export const pid = id => 'favp:' + id;
// معرّف العمل ثابت ومستقل عن ترتيبه وعن الممثلة: العنوان + الاستوديو + التاريخ (أو السنة) بعد التطبيع.
// نفس العمل عند ممثلتين = عمل واحد يجمعهما.
export const workKey = w => compact(w.t) + '|' + compact(w.s) + '|' + (w.d || w.y || '');
export const wid = w => 'favw:' + h2(workKey(w));

export function build(L) {
  if (L._m && L._m.ver === L.ver) return L._m;
  const now = today();
  const perf = [], works = new Map();
  for (const it of L.items.values()) {
    if (minorRec(it)) continue;
    const p = { it, id: pid(it.id), works: [] };
    perf.push(p);
    for (const w of (Array.isArray(it.works) ? it.works : [])) {
      if (!w || !w.t) continue;
      const id = wid(w); let W = works.get(id);
      if (!W) { W = { id, w: { ...w }, perfs: [], date: w.d || (w.y ? w.y + '-01-01' : ''), added: +w.a || 0 }; works.set(id, W); }
      else { // دمج: نأخذ أغنى البيانات من النسختين
        for (const k of ['p', 'ds', 'du', 'u', 'd']) if (!W.w[k] && w[k]) W.w[k] = w[k];
        if (w.tg) W.w.tg = [...new Set([...(W.w.tg || []), ...w.tg])];
        if (w.w) W.w.w = 1; if (+w.r > (+W.w.r || 0)) W.w.r = +w.r; if (+w.a > W.added) W.added = +w.a; }
      if (!W.perfs.includes(p)) W.perfs.push(p);
      if (!p.works.includes(W)) p.works.push(W);
    }
  }
  for (const W of works.values()) W.upc = !!W.w.upc || (W.date && W.date > now);
  for (const p of perf) p.works.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const m = { ver: L.ver, perf, works: [...works.values()], byP: new Map(perf.map(p => [p.id, p])), byW: works, at: Date.now() };
  m.taste = taste(m); L._m = m; return m;
}

// ===== الاقتراحات الذكية =====
// ذوقك = الوسوم والاستوديوهات في الأعمال التي شاهدتها أو قيّمتها عاليًا، وتقييمك للممثلة ومفضلتها ومستواها.
function taste(m) {
  const tg = new Map(), st = new Map(), bump = (M, k, v) => { if (k) M.set(k, (M.get(k) || 0) + v); };
  for (const W of m.works) { const r = +W.w.r || 0, v = (W.w.w ? 1 : 0) + (r >= 4 ? 2 : r >= 3 ? 1 : 0) + (W.w.fav ? 2 : 0); if (!v) continue;
    (W.w.tg || []).forEach(t => bump(tg, fold(t), v)); bump(st, fold(W.w.s), v); }
  for (const p of m.perf) { const v = (p.it.fav ? 2 : 0) + (+p.it.rating || 0) / 2; (p.it.tags || []).forEach(t => bump(tg, fold(t), v / 2)); }
  const norm = M => { const mx = Math.max(1, ...M.values()); return new Map([...M].map(([k, v]) => [k, v / mx])); };
  return { tg: norm(tg), st: norm(st) };
}
export const perfScore = p => (+p.it.rating || 0) * 1.2 + (p.it.fav ? 2.5 : 0) + ({ S: 2, A: 1.4, B: .8, C: .3 }[p.it.tier] || 0);
export function recs(m) {
  const now = today(), out = [];
  for (const W of m.works) {
    if (W.w.w || W.upc || (W.date && W.date > now)) continue;
    const best = W.perfs.reduce((a, p) => perfScore(p) > perfScore(a) ? p : a, W.perfs[0]); if (!best) continue;
    const tgs = (W.w.tg || []).map(t => m.taste.tg.get(fold(t)) || 0), tagS = tgs.length ? tgs.reduce((a, b) => a + b, 0) / Math.sqrt(tgs.length) : 0;
    const stS = m.taste.st.get(fold(W.w.s)) || 0, ageDays = W.date ? (Date.now() - Date.parse(W.date)) / 864e5 : 3650;
    const s = perfScore(best) + tagS * 3 + stS * 2 + (W.w.rec ? 2 : 0) + (W.w.q ? 1.5 : 0) + Math.max(0, 1.5 - ageDays / 365) + (W.perfs.length > 1 ? .5 : 0);
    const why = [];
    if (best.it.fav) why.push('من مفضلتك: ' + best.it.name); else if (+best.it.rating >= 4) why.push('قيّمت ' + best.it.name + ' ' + best.it.rating + '/5');
    if (tagS > .6) why.push('وسومه قريبة من ذوقك'); if (stS > .6) why.push('استوديو تتابعه'); if (W.w.q) why.push('في قائمة المشاهدة');
    out.push({ W, s, why: why.slice(0, 2).join(' · ') || 'لم تشاهده بعد' });
  }
  return out.sort((a, b) => b.s - a.s);
}

// كلمات البحث لكل ممثلة/عمل (عربي ولاتيني)
export const hay = p => fold([p.it.name, p.it.aliases, p.it.country, ...(p.it.tags || [])].join(' '));
export const whay = W => fold([W.w.t, W.w.s, ...(W.w.tg || []), ...W.perfs.map(p => p.it.name + ' ' + (p.it.aliases || ''))].join(' '));
export const nameWords = p => [p.it.name, ...String(p.it.aliases || '').split(/[,،;/|]+/)].map(words).filter(a => a.length && a.some(w => /[a-z]/.test(w)));

/* ---- 04-analytics.js ---- */
// ===== الإحصائيات (شاملة) =====
const avgOf=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const topN=(arr,n)=>{ const m={}; arr.forEach(x=>{ if(x) m[x]=(m[x]||0)+1; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n); };
const barRow=(label,val,max,txt)=>`<div class="brow"><span class="bl">${esc(label)}</span><div class="bt"><div class="bf" style="width:${max?Math.max(3,val/max*100):0}%"></div></div><span class="bv">${txt}</span></div>`;
const avatar=i=>`<span class="av">${pic(i)?`<img src="${pic(i)}" alt="">`:'♡'}</span>`;
function radar(vals){
  const n=vals.length, cx=140, cy=125, R=76; const pt=(k,r)=>{ const a=-Math.PI/2+k*2*Math.PI/n; return [cx+r*Math.cos(a),cy+r*Math.sin(a)]; };
  const poly=(r)=>vals.map((_,k)=>pt(k,r).map(v=>v.toFixed(1)).join(',')).join(' ');
  const rings=[1,2,3,4,5].map(l=>`<polygon points="${poly(R*l/5)}" fill="none" stroke="rgba(255,255,255,.09)"/>`).join('');
  const axes=vals.map((_,k)=>{ const p=pt(k,R); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="rgba(255,255,255,.07)"/>`; }).join('');
  const data=vals.map(([,v],k)=>pt(k,R*v/5).map(x=>x.toFixed(1)).join(',')).join(' ');
  const dots=vals.map(([,v],k)=>{ const p=pt(k,R*v/5); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#ff7fa6"/>`; }).join('');
  const labs=vals.map(([nm,v],k)=>{ const p=pt(k,R+16); const anc=p[0]<cx-8?'end':p[0]>cx+8?'start':'middle'; return `<text x="${p[0].toFixed(1)}" y="${(p[1]+3).toFixed(1)}" text-anchor="${anc}">${esc(nm)} ${v.toFixed(1)}</text>`; }).join('');
  return `<svg class="radar" viewBox="-50 0 380 250" style="width:100%;max-width:420px;display:block;margin:0 auto"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b4123f" stop-opacity=".75"/><stop offset="1" stop-color="#a21caf" stop-opacity=".6"/></linearGradient></defs>${rings}${axes}<polygon points="${data}" fill="url(#rg)" stroke="#ff7fa6" stroke-width="1.5"/>${dots}${labs}</svg>`;
}
function countUp(root){ root.querySelectorAll('.cu').forEach(el=>{ const v=+el.dataset.v, d=+el.dataset.d||0; if(REDUCED||!v){ el.textContent=v.toFixed(d); return; } const t0=performance.now(); const step=t=>{ const p=Math.min(1,(t-t0)/900); el.textContent=(v*(1-Math.pow(1-p,3))).toFixed(d); if(p<1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); }

// ===== نظام الاقتراحات الذكي v14 — تحليل ذوقي شامل (إناث فقط) =====
// الفكرة: نبني "بصمة ذوق" من كل إحصائياتك (المفضّلات، التقييمات، المعايير، الأعمال، الاستوديوهات، الوسوم، الصفات)،
// ثم نجمع مرشّحات واسعة من APIs ونقيّس توافقها مع البصمة. العلاقات المشتركة (co-stars) مجرد مكافأة صغيرة.
let statsTab = 'overview';
let recsLoading = false;
const REC_LS = { ign:'vkte_rec_ignored', fb:'vkte_rec_fb2', pool:'vkte_rec_pool2', cache:'vkte_rec_cache2', attrs:'vkte_rec_attrs2', caps:'vkte_sd_caps2', studios:'vkte_sd_studios2' };
const recJget = (k, d) => { try { const v = JSON.parse(LS.get(k, 'null')); return v == null ? d : v; } catch { return d; } };
const recJset = (k, v) => LS.set(k, JSON.stringify(v));
const recClamp = (x, a, b) => Math.max(a, Math.min(b, x));
const recSleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- أدوات تطبيع الصفات (تُوحّد صيغ StashDB و ThePornDB) ----------
const CTRY_LIST = [
  ['US','usa','united states','united states of america','american','america'],['GB','uk','united kingdom','british','english','england','scotland','scottish','welsh','wales','great britain'],
  ['CZ','czech','czech republic','czechia'],['HU','hungarian','hungary'],['RU','russian','russia'],['UA','ukrainian','ukraine'],['PL','polish','poland'],['RO','romanian','romania'],
  ['DE','german','germany'],['FR','french','france'],['ES','spanish','spain'],['IT','italian','italy'],['BR','brazilian','brazil'],['CO','colombian','colombia'],
  ['AR','argentinian','argentine','argentina'],['MX','mexican','mexico'],['CA','canadian','canada'],['AU','australian','australia'],['NZ','new zealander','new zealand'],
  ['JP','japanese','japan'],['KR','korean','south korea','korea'],['CN','chinese','china'],['TH','thai','thailand'],['PH','filipino','filipina','philippines'],
  ['VN','vietnamese','vietnam'],['IN','indian','india'],['SK','slovak','slovakia'],['BG','bulgarian','bulgaria'],['LT','lithuanian','lithuania'],['LV','latvian','latvia'],
  ['EE','estonian','estonia'],['BY','belarusian','belarus'],['SE','swedish','sweden'],['NO','norwegian','norway'],['DK','danish','denmark'],['FI','finnish','finland'],
  ['NL','dutch','netherlands','holland'],['BE','belgian','belgium'],['PT','portuguese','portugal'],['CH','swiss','switzerland'],['AT','austrian','austria'],['GR','greek','greece'],
  ['TR','turkish','turkey'],['IL','israeli','israel'],['CU','cuban','cuba'],['VE','venezuelan','venezuela'],['PE','peruvian','peru'],['CL','chilean','chile'],
  ['ZA','south african','south africa'],['IE','irish','ireland'],['HR','croatian','croatia'],['RS','serbian','serbia'],['SI','slovenian','slovenia'],['KZ','kazakh','kazakhstan'],
  ['MD','moldovan','moldova'],['GE','georgian','georgia'],['PR','puerto rican','puerto rico'],['DO','dominican','dominican republic'],['EG','egyptian','egypt'],['MA','moroccan','morocco'],
  ['LB','lebanese','lebanon'],['ID','indonesian','indonesia'],['MY','malaysian','malaysia'],['SG','singaporean','singapore'],['TW','taiwanese','taiwan'],['UY','uruguayan','uruguay'],
  ['EC','ecuadorian','ecuador'],['BO','bolivian','bolivia'],['PY','paraguayan','paraguay'],['CR','costa rican','costa rica'],['PA','panamanian','panama'],['IS','icelandic','iceland'],
  ['AL','albanian','albania'],['BA','bosnian','bosnia'],['ME','montenegrin','montenegro'],['MK','macedonian','north macedonia'],['AM','armenian','armenia'],['AZ','azerbaijani','azerbaijan'],
  ['UZ','uzbek','uzbekistan'],['NG','nigerian','nigeria'],['KE','kenyan','kenya'],['JM','jamaican','jamaica'],['HK','hong kong'],['PK','pakistani','pakistan'],['LU','luxembourg']
];
const CTRY = {}; CTRY_LIST.forEach(([c, ...names]) => { CTRY[c.toLowerCase()] = c; names.forEach(n => { CTRY[n] = c; }); });
const ctryCode = v => { v = norm(v).replace(/[^\p{L} ]/gu, '').trim(); if (!v) return ''; if (CTRY[v]) return CTRY[v]; return /^[a-z]{2}$/.test(v) ? v.toUpperCase() : ''; };
let _dn = null;
const ctryName = c => { try { _dn = _dn || new Intl.DisplayNames(['ar'], { type: 'region' }); return _dn.of(c) || c; } catch { return c; } };
const _lc = v => norm(v).replace(/[_\-]/g, ' ').replace(/[^\p{L} ]/gu, '').trim();
function ethNorm(v) { v = _lc(v); if (!v) return '';
  if (/indian|south asian/.test(v)) return 'indian';
  if (/middle east|arab|persian/.test(v)) return 'middle eastern';
  if (/latin|hispanic/.test(v)) return 'latina';
  if (/black|african|ebony/.test(v)) return 'black';
  if (/white|caucas|european/.test(v)) return 'caucasian';
  if (/asian|oriental|japanese|chinese|korean/.test(v)) return 'asian';
  if (/mixed|multi/.test(v)) return 'mixed';
  return ''; }
function hairNorm(v) { v = _lc(v); if (!v || /^(various|other|bald|unknown|na|n a)$/.test(v)) return '';
  if (/blond/.test(v)) return 'blonde'; if (/brun|brown|chestnut/.test(v)) return 'brunette'; if (/auburn|red|ginger/.test(v)) return 'red';
  if (/black|dark/.test(v)) return 'black'; if (/gr[ae]y|silver|white/.test(v)) return 'grey'; return ''; }
function eyeNorm(v) { v = _lc(v); if (/blue/.test(v)) return 'blue'; if (/hazel/.test(v)) return 'hazel'; if (/green/.test(v)) return 'green'; if (/gr[ae]y/.test(v)) return 'grey'; if (/brown|dark/.test(v)) return 'brown'; return ''; }
function cupBucket(v) { const m = String(v || '').trim().toUpperCase().match(/^(?:\d{2,3})?\s*([A-K]{1,3})(?=$|[^A-Z])/); if (!m) return ''; const c = m[1]; if (/^(AA|A|B)$/.test(c)) return 'small'; if (/^(C|D)$/.test(c)) return 'medium'; return 'large'; }
function parseHeight(v) { if (v == null || v === '') return 0; if (typeof v === 'number') return v > 130 && v < 215 ? Math.round(v) : 0;
  const s = String(v); let m = s.match(/(\d{3})\s*cm/i) || s.match(/^\s*(\d{3})\s*$/); if (m) { const h = +m[1]; return h > 130 && h < 215 ? h : 0; }
  m = s.match(/(\d)\s*(?:'|ft|feet)\s*(\d{1,2})?/i); if (m) { const h = Math.round((+m[1] * 12 + (+m[2] || 0)) * 2.54); return h > 130 && h < 215 ? h : 0; } return 0; }
const ETH_ENUM = { caucasian:'CAUCASIAN', black:'BLACK', asian:'ASIAN', indian:'INDIAN', latina:'LATIN', 'middle eastern':'MIDDLE_EASTERN', mixed:'MIXED' };
const HAIR_ENUM = { blonde:'BLONDE', brunette:'BRUNETTE', black:'BLACK', red:'RED', grey:'GREY' };
const FEAT_AR = { country:'الدولة', eth:'الأصل العرقي', hair:'لون الشعر', eyes:'لون العيون', cup:'القياسات', age:'العمر', height:'الطول', exp:'سنوات المسيرة', studio:'الاستوديوهات', tag:'الوسوم' };
const ETH_AR = { caucasian:'قوقازية', black:'سمراء', asian:'آسيوية', latina:'لاتينية', indian:'هندية', 'middle eastern':'شرق أوسطية', mixed:'مختلطة' };
const HAIR_AR = { blonde:'شقراء', brunette:'شعر بني', black:'شعر أسود', red:'شعر أحمر', grey:'شعر رمادي' };
const EYE_AR = { blue:'عيون زرقاء', brown:'عيون بنية', green:'عيون خضراء', hazel:'عيون عسلية', grey:'عيون رمادية' };
const GENDER_OK = g => /^(female|f)$/i.test(String(g || '').trim());

// ---------- التخزين ----------
let _recIgnored = recJget(REC_LS.ign, []);
const saveRecIgnored = () => recJset(REC_LS.ign, _recIgnored.slice(-600));
const FB0 = () => ({ v:2, pos:{}, neg:{}, w:{}, acc:0, rej:0, hist:{}, log:[] });
let _recFeedback = Object.assign(FB0(), recJget(REC_LS.fb, {}));
try { // ترحيل تعلّم النظام القديم (الدول المستبعدة)
  const old = JSON.parse(LS.get('vkte_rec_feedback', 'null'));
  if (old && old.negCountries && !_recFeedback.migrated) { for (const [c, n] of Object.entries(old.negCountries)) { const cc = ctryCode(c); if (cc) _recFeedback.neg['country:' + cc] = (_recFeedback.neg['country:' + cc] || 0) + n; } _recFeedback.migrated = 1; }
} catch {}
const saveRecFeedback = () => { const f = _recFeedback; if (f.log.length > 80) f.log = f.log.slice(-80); const hk = Object.keys(f.hist); if (hk.length > 250) hk.slice(0, hk.length - 250).forEach(k => delete f.hist[k]); recJset(REC_LS.fb, f); };
let _recPool = Object.assign({ v:2, list:[], at:0, round:0 }, recJget(REC_LS.pool, {}));
const saveRecPool = () => recJset(REC_LS.pool, { v: 2, at: _recPool.at, round: _recPool.round, list: _recPool.list.map(c => { const o = Object.assign({}, c); ['raw', 'fs', 'cov', 'reasons', 'eff', 'matchPct', 'explore', 'age', 'how'].forEach(k => delete o[k]); return o; }) });
let _recCache = Object.assign({ list:[], at:0 }, recJget(REC_LS.cache, {}));
const saveRecCache = () => recJset(REC_LS.cache, { list:_recCache.list, at:_recCache.at });
let _attrCache = recJget(REC_LS.attrs, {});
const saveAttrCache = () => recJset(REC_LS.attrs, _attrCache);

// ---------- قراءة صفات ممثلات مكتبتك ----------
const critAvgOf = it => { const v = []; [it.criteria, it.bodyD].forEach(o => o && Object.values(o).forEach(x => { if (+x > 0) v.push(+x); })); return v.length ? avgOf(v) : 0; };
function perfWeight(it) { // تأثير كل ممثلة على ذوقك: المفضّلة والتقييم العالي يرفعان، التقييم المنخفض يعطي وزنًا سالبًا
  let w = 0.3; if (it.fav) w += 1.0;
  const r = +it.rating || 0;
  if (r > 0) w += (r - 3) / 2 * 1.3; else { const c = critAvgOf(it); if (c) w += (c - 3) / 2 * 0.8; }
  const ws = it.works || []; const seen = ws.filter(x => x.w).length, liked = ws.filter(x => x.r >= 4 || x.rec || x.fav).length;
  w += Math.min(0.6, seen * 0.04 + liked * 0.08);
  return recClamp(w, -1.5, 3.2);
}
function libFeats(it) {
  const at = (_attrCache[it.id] && _attrCache[it.id].at) || {}; const o = {};
  const cc = ctryCode(it.country) || at.c; if (cc) o.country = cc;
  if (at.e) o.eth = at.e; if (at.hr) o.hair = at.hr; if (at.ey) o.eyes = at.ey; if (at.cp) o.cup = at.cp;
  const a = age(it.birth); if (a !== null && a >= 18 && a < 70) o.age = a;
  const h = +it.height || at.h; if (h > 130 && h < 215) o.height = h;
  const cs = +it.cs || at.cs; if (cs > 1985 && cs <= new Date().getFullYear()) o.exp = new Date().getFullYear() - cs;
  return o;
}
const recBucket = (k, v) => k === 'height' ? Math.floor(v / 5) * 5 : Math.floor(v / 3) * 3;
function libIndex() { const names = new Set(), ids = new Set();
  items.forEach(i => { names.add(norm(i.name)); if (i.pdbId) ids.add(String(i.pdbId)); if (i.stashId) ids.add(String(i.stashId)); if (i.ofId) ids.add('of:' + String(i.ofId).toLowerCase()); if (i.fsId) ids.add('fs:' + String(i.fsId).toLowerCase()); String(i.aliases || '').split(/[,،]/).forEach(a => { a = norm(a); if (a) names.add(a); });
    const ac = _attrCache[i.id]; if (ac && ac.sid) ids.add(String(ac.sid)); if (ac && ac.pid) ids.add(String(ac.pid)); });
  return { names, ids }; }
function libWeights() { const m = new Map(); items.forEach(i => { const w = perfWeight(i); if (w <= 0.05) return; [i.name, ...String(i.aliases || '').split(/[,،]/)].forEach(n => { n = norm(n); if (n && n.length > 2) m.set(n, Math.max(m.get(n) || 0, w)); }); }); return m; }

// ---------- بناء بصمة الذوق ----------
function catModel(acc, neg, base, nContrib) {
  const keys = Object.keys(acc); if (!keys.length) return null;
  const tot = keys.reduce((a, k) => a + acc[k], 0), max = Math.max(...keys.map(k => acc[k]));
  const H = -keys.reduce((a, k) => { const p = acc[k] / tot; return a + p * Math.log(p); }, 0);
  const conc = 1 - H / Math.log(Math.max(2, keys.length)); const conf = nContrib / (nContrib + 4);
  const aff = {}; keys.forEach(k => { aff[k] = acc[k] / max; });
  Object.keys(neg).forEach(k => { aff[k] = (aff[k] || 0) - Math.min(0.8, neg[k] / (tot || 1) * 2.5); });
  return { aff, imp: base * (0.35 + 0.65 * conc) * conf, top: keys.sort((a, b) => acc[b] - acc[a]).slice(0, 4).map(k => [k, acc[k] / tot]), n: nContrib };
}
function numModel(arr, base, floor, range) {
  if (!arr.length) return null; const W = arr.reduce((a, x) => a + x[1], 0); if (W <= 0) return null;
  const mu = arr.reduce((a, x) => a + x[0] * x[1], 0) / W; const sd = Math.sqrt(arr.reduce((a, x) => a + x[1] * (x[0] - mu) ** 2, 0) / W);
  const tight = recClamp(1 - sd / range, 0, 1); const conf = arr.length / (arr.length + 4);
  return { mu, sd: Math.max(sd, floor), imp: base * (0.4 + 0.6 * tight) * conf, n: arr.length, lo: Math.min(...arr.map(x => x[0])), hi: Math.max(...arr.map(x => x[0])) };
}
function buildTasteProfile() {
  if (!items.length) return null;
  syncImplicitFeedback();
  const W = items.map(it => [it, perfWeight(it)]);
  const CK = ['country', 'eth', 'hair', 'eyes', 'cup'], acc = {}, neg = {}, cnt = {}; CK.forEach(k => { acc[k] = {}; neg[k] = {}; cnt[k] = 0; });
  const nums = { age: [], height: [], exp: [] }; let nPos = 0;
  for (const [it, w] of W) { const f = libFeats(it); if (w > 0.05) nPos++;
    CK.forEach(k => { if (f[k]) { if (w > 0.05) { acc[k][f[k]] = (acc[k][f[k]] || 0) + w; cnt[k]++; } else if (w < -0.05) neg[k][f[k]] = (neg[k][f[k]] || 0) - w; } });
    if (w > 0.05) Object.keys(nums).forEach(k => { if (f[k] != null) nums[k].push([f[k], w]); }); }
  const stAcc = {}, tgAcc = {}; let stN = 0, tgN = 0;
  for (const [it, w] of W) { const pw = w < 0 ? 0.15 : Math.max(0.15, w); const ws = it.works || []; const damp = 1 / Math.sqrt(Math.max(1, ws.length));
    ws.forEach(wk => { let ww = pw * damp * (wk.w ? 1.5 : 1) * (wk.r ? 0.4 + wk.r / 5 * 1.2 : 1) * (wk.rec ? 1.8 : 1) * (wk.fav ? 1.8 : 1); if (w < 0) ww *= 0.3;
      if (wk.s) { stAcc[wk.s] = (stAcc[wk.s] || 0) + ww; stN++; } (wk.tg || []).forEach(t => { tgAcc[t] = (tgAcc[t] || 0) + ww; tgN++; }); });
    if (w > 0.05) (it.tags || []).forEach(t => { tgAcc[t] = (tgAcc[t] || 0) + 2 * pw; tgN++; }); }
  const affOf = (a, base, n, cap) => { const ks = Object.keys(a).sort((x, y) => a[y] - a[x]).slice(0, cap); if (!ks.length) return null; const max = a[ks[0]], tot = ks.reduce((s, k) => s + a[k], 0);
    const aff = {}; ks.forEach(k => { aff[k] = Math.pow(a[k] / max, 0.6); }); const share5 = ks.slice(0, 5).reduce((s, k) => s + a[k], 0) / tot;
    return { aff, imp: base * (0.5 + 0.5 * share5) * Math.min(1, n / (base > 0.95 ? 15 : 20)), top: ks.slice(0, 6).map(k => [k, a[k] / tot]), n }; };
  const cat = { country: catModel(acc.country, neg.country, 1.0, cnt.country), eth: catModel(acc.eth, neg.eth, 0.8, cnt.eth), hair: catModel(acc.hair, neg.hair, 0.7, cnt.hair), eyes: catModel(acc.eyes, neg.eyes, 0.35, cnt.eyes), cup: catModel(acc.cup, neg.cup, 0.5, cnt.cup),
    studio: affOf(stAcc, 1.0, stN, 60), tag: affOf(tgAcc, 0.9, tgN, 80) };
  const num = { age: numModel(nums.age, 1.0, 3, 12), height: numModel(nums.height, 0.6, 4, 15), exp: numModel(nums.exp, 0.4, 2, 10) };
  const imp = {}; Object.keys(cat).forEach(k => { if (cat[k]) imp[k] = cat[k].imp; }); Object.keys(num).forEach(k => { if (num[k]) imp[k] = num[k].imp; });
  const ages = nums.age.map(x => x[0]); const avgAge = ages.length ? Math.round(avgOf(ages)) : null;
  const crit = CRIT.map(([k, n]) => [k, n, avgOf(items.map(i => i.criteria && i.criteria[k]).filter(x => x > 0))]).filter(x => x[2] > 0).sort((a, b) => b[2] - a[2]);
  const withAttrs = items.filter(i => _attrCache[i.id] && _attrCache[i.id].at && Object.keys(_attrCache[i.id].at).length).length;
  const conf = recClamp(nPos / (nPos + 6), 0, 1) * (0.55 + 0.45 * Math.min(1, withAttrs / Math.max(1, items.length)));
  return { n: items.length, nPos, cat, num, imp, avgAge, topCrit: crit.slice(0, 3), conf, withAttrs };
}

// ---------- التعلّم من ردودك ----------
function recKeysOf(c) { const ks = [], a = c.at || {}; if (c.cc) ks.push('country:' + c.cc); if (a.e) ks.push('eth:' + a.e); if (a.hr) ks.push('hair:' + a.hr); if (a.ey) ks.push('eyes:' + a.ey); if (a.cp) ks.push('cup:' + a.cp);
  const ag = candAge(c); if (ag != null) ks.push('age:' + recBucket('age', ag)); if (a.h) ks.push('height:' + recBucket('height', a.h)); if (a.cs) ks.push('exp:' + recBucket('exp', new Date().getFullYear() - a.cs));
  const cx = c.cx || {}; Object.entries(cx.st || {}).sort((x, y) => y[1] - x[1]).slice(0, 3).forEach(([s]) => ks.push('studio:' + s)); Object.entries(cx.tg || {}).sort((x, y) => y[1] - x[1]).slice(0, 5).forEach(([t]) => ks.push('tag:' + t)); return ks; }
function learnFrom(keys, fs, raw, y, strength) {
  const tgt = y ? _recFeedback.pos : _recFeedback.neg; keys.forEach(k => { tgt[k] = (tgt[k] || 0) + strength; });
  if (fs && typeof raw === 'number') { const err = (y ? 1 : 0) - raw; Object.entries(fs).forEach(([k, s]) => { if (s == null || k === 'co') return; const cur = _recFeedback.w[k] != null ? _recFeedback.w[k] : 1; _recFeedback.w[k] = recClamp(cur + 0.18 * strength * err * (s - 0.4), 0.4, 2.2); }); }
}
function recLearn(c, y, strength = 1) { learnFrom(recKeysOf(c), c.fs, c.raw, y, strength); if (y) _recFeedback.acc++; else _recFeedback.rej++;
  _recFeedback.log.push({ n: c.name, y: y ? 1 : 0, t: Date.now(), p: Math.round((c.raw || 0) * 100) }); saveRecFeedback(); }
function syncImplicitFeedback() { // تقييمك لاحقًا للممثلات المضافة من الاقتراحات = تغذية راجعة إضافية
  let ch = false; items.forEach(it => { const h = _recFeedback.hist[norm(it.name)]; if (!h || !(+it.rating > 0)) return; const bk = it.rating >= 4 ? 'h' : it.rating <= 2.5 ? 'l' : 'm'; if (h.rated === bk) return; h.rated = bk;
    if (bk === 'h') learnFrom(h.keys, h.fs, h.raw, true, 0.5); else if (bk === 'l') learnFrom(h.keys, h.fs, h.raw, false, 0.8); ch = true; });
  if (ch) saveRecFeedback(); }
const fbAdj = key => { const p = _recFeedback.pos[key] || 0, n = _recFeedback.neg[key] || 0; return p + n ? (p - n) / (p + n + 3) * 0.5 : 0; };
function recExploreRate() { const n = _recFeedback.acc + _recFeedback.rej; if (n < 6) return 0.25; const r = _recFeedback.acc / n; return r > 0.55 ? 0.15 : r < 0.25 ? 0.3 : 0.22; }

// ---------- تقييم توافق مرشّحة مع البصمة ----------
function candAge(c) { const a = c.birth ? age(c.birth) : (c.birthRaw ? sdAge(c.birthRaw) : null); return a == null || isNaN(a) ? null : a; }
function candFeats(c) { const a = c.at || {}, o = {}; if (c.cc) o.country = c.cc; if (a.e) o.eth = a.e; if (a.hr) o.hair = a.hr; if (a.ey) o.eyes = a.ey; if (a.cp) o.cup = a.cp;
  const ag = candAge(c); if (ag != null) o.age = ag; if (a.h) o.height = a.h; if (a.cs) o.exp = new Date().getFullYear() - a.cs; return o; }
function recScore(c, P) {
  const f = candFeats(c), fs = {}, mult = k => _recFeedback.w[k] != null ? _recFeedback.w[k] : 1;
  ['country', 'eth', 'hair', 'eyes', 'cup'].forEach(k => { const m = P.cat[k], v = f[k]; if (!m || !v) return; fs[k] = recClamp((m.aff[v] || 0) + fbAdj(k + ':' + v), -0.6, 1); });
  ['age', 'height', 'exp'].forEach(k => { const m = P.num[k], v = f[k]; if (!m || v == null) return; fs[k] = recClamp(Math.exp(-0.5 * Math.pow((v - m.mu) / (m.sd * 1.3), 2)) + fbAdj(k + ':' + recBucket(k, v)) * 0.6, -0.6, 1); });
  const cx = c.cx;
  if (cx && cx.n >= 3) { ['studio', 'tag'].forEach(k => { const m = P.cat[k], src = cx[k === 'studio' ? 'st' : 'tg']; if (!m || !src) return; let num = 0, den = 0;
      Object.entries(src).forEach(([n, ct]) => { num += ct * ((m.aff[n] || 0) + fbAdj(k + ':' + n)); den += ct; }); if (den > 0) fs[k] = recClamp(Math.pow(Math.max(0, num / den), 0.7), -0.6, 1); }); }
  let num = 0, den = 0, all = 0; Object.keys(P.imp).forEach(k => { const w = P.imp[k] * mult(k); all += w; if (fs[k] != null) { num += w * fs[k]; den += w; } });
  const cov = all > 0 ? den / all : 0; let raw = den > 0 ? num / den : 0; raw *= 0.6 + 0.4 * Math.min(1, cov);
  if (fs.age != null && P.imp.age && all > 0) { const share = P.imp.age * mult('age') / all; raw *= 1 - (1 - Math.max(0, fs.age)) * Math.min(0.35, 0.9 * share); } // العمر البعيد عن ذوقك يخفض التوافق بقوة
  let co = 0; if (cx && cx.co && cx.co.length) { co = Math.min(1, cx.co.reduce((a, x) => a + x.w, 0) / 2.5); raw += 0.06 * co; } // مكافأة صغيرة فقط
  if (!c.img) raw -= 0.04;
  return { raw: recClamp(raw, 0, 1), fs: Object.assign(fs, { co }), cov, co };
}
function recReasons(c, P, r) {
  const f = candFeats(c), out = [], mult = k => _recFeedback.w[k] != null ? _recFeedback.w[k] : 1;
  const ranked = Object.keys(r.fs).filter(k => k !== 'co' && r.fs[k] >= 0.55 && P.imp[k]).sort((a, b) => P.imp[b] * mult(b) * r.fs[b] - P.imp[a] * mult(a) * r.fs[a]);
  ranked.slice(0, 4).forEach(k => { const v = f[k], m = P.cat[k] || P.num[k];
    if (k === 'country') out.push(`من ${ctryName(v)} — دولة تتكرر كثيرًا بين ممثلاتك المفضّلات`);
    else if (k === 'eth') out.push(`مظهر ${ETH_AR[v] || v} يتطابق مع نمط مفضّلاتك`);
    else if (k === 'hair') out.push(`${HAIR_AR[v] || v} مثل أغلب ما تفضّله`);
    else if (k === 'eyes') out.push(`${EYE_AR[v] || v} ضمن ذوقك`);
    else if (k === 'cup') out.push('قياساتها قريبة من مفضّلاتك');
    else if (k === 'age') out.push(`عمرها ${v} سنة، قريب من متوسط مفضّلاتك (~${Math.round(m.mu)})`);
    else if (k === 'height') out.push(`طولها ${v} سم، قريب من متوسط مفضّلاتك (~${Math.round(m.mu)} سم)`);
    else if (k === 'exp') out.push(`مدة مسيرتها (${v} سنة) تشبه مفضّلاتك`);
    else if (k === 'studio') { const s = Object.entries(c.cx.st).filter(([n]) => m.aff[n] > 0.3).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]); if (s.length) out.push(`تظهر كثيرًا في استوديوهات تحبها: ${s.join('، ')}`); }
    else if (k === 'tag') { const t = Object.entries(c.cx.tg).filter(([n]) => m.aff[n] > 0.3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => '#' + x[0]); if (t.length) out.push(`أعمالها تحمل وسومًا تفضّلها: ${t.join(' ')}`); } });
  if (r.co > 0 && c.cx.co.length) out.push(`(عامل إضافي) شاركت في أعمال مع ${c.cx.co.slice(0, 2).map(x => x.n).join('، ')} من مكتبتك`);
  if (!out.length) out.push('توافق جزئي مع ذوقك العام');
  return out;
}

// ---------- بوابة الأهلية: إناث فقط + 18+ مؤكّد ----------
function recEligible(c, idx, ign) {
  const k = norm(c.name); if (!k || idx.names.has(k) || ign.has(k)) return false;
  if (c.stashId && idx.ids.has(String(c.stashId))) return false; if (c.pdbId && idx.ids.has(String(c.pdbId))) return false;
  if (c.ofId && idx.ids.has('of:' + String(c.ofId).toLowerCase())) return false; if (c.fsId && idx.ids.has('fs:' + String(c.fsId).toLowerCase())) return false;
  if (!GENDER_OK(c.gender)) return false;
  const a = candAge(c); if (a == null || a < 18) return false;
  for (const al of String(c.aliases || '').split(/[,،]/)) { const n = norm(al); if (n.length > 3 && idx.names.has(n)) return false; }
  return true;
}

// ---------- الترتيب: توافق + تنويع + استكشاف ----------
function recRank(P, WANT = 24) {
  const idx = libIndex(), ign = new Set(_recIgnored.map(norm)); const round = _recPool.round || 0;
  const pool = _recPool.list.filter(c => recEligible(c, idx, ign));
  pool.forEach(c => { const r = recScore(c, P); c.explore = 0; c.raw = r.raw; c.fs = r.fs; c.cov = r.cov; c.reasons = recReasons(c, P, r).concat(typeof VX !== 'undefined' ? VX.reasons(c) : []); c.age = candAge(c); c.eff = r.raw - 0.025 * Math.min(4, c.shown || 0); });
  const want = WANT, nExp = Math.round(want * recExploreRate()), picked = [], cnt = {}, left = pool.slice().sort((a, b) => b.eff - a.eff);
  while (picked.length < want - nExp && left.length) { let bi = 0, bv = -9; left.forEach((c, i) => { const v = c.eff - 0.035 * (cnt[c.cc || '?'] || 0); if (v > bv) { bv = v; bi = i; } });
    const c = left.splice(bi, 1)[0]; cnt[c.cc || '?'] = (cnt[c.cc || '?'] || 0) + 1; picked.push(c); }
  const cand = left.filter(c => c.raw >= 0.28).map(c => [c, Math.pow(c.raw, 2) * ((hhash(c.k + ':' + round) % 1000) / 1000 + 0.15)]).sort((a, b) => b[1] - a[1]).slice(0, nExp).map(x => x[0]);
  cand.forEach(c => { c.explore = 1; c.reasons = ['اقتراح استكشافي لاختبار توسّع ذوقك، تقييمك له يطوّر دقة النظام', ...c.reasons.slice(0, 2)]; picked.push(c); });
  picked.forEach(c => { c.matchPct = recClamp(Math.round(40 + c.raw * 60), 40, 98); });
  return picked.sort((a, b) => b.raw - a.raw);
}

// ---------- كشف قدرات StashDB (مرة واحدة ثم تُحفظ) ----------
const SD_FIELDS = [
  'id name aliases birth_date country gender ethnicity eye_color hair_color height career_start_year measurements{cup_size} images{url width height} urls{url}',
  'id name aliases birth_date country gender ethnicity eye_color hair_color height career_start_year images{url width height} urls{url}',
  'id name aliases birth_date country gender height career_start_year images{url width height} urls{url}',
  'id name aliases birth_date country gender images{url width height} urls{url}',
  'id name aliases birth_date country images{url width height} urls{url}'
];
const sdSchemaErr = e => !!(e && (e.gql || e.status === 400 || e.status === 422));
async function sdCaps() {
  let caps = recJget(REC_LS.caps, null); if (caps && caps.v === 1) return caps;
  caps = { v: 1, g: '', fl: 4, age: false, eth: '', hair: false, sort: false };
  const tryQ = async (lit, fields) => { try { await sdQ(`query{queryPerformers(input:{${lit}page:1,per_page:1}){count performers{${fields || 'id'}}}}`, {}); return true; } catch (e) { if (sdSchemaErr(e)) return false; throw e; } };
  if (await tryQ('gender:FEMALE,')) caps.g = 'enum'; else if (await tryQ('gender:{value:FEMALE,modifier:EQUALS},')) caps.g = 'crit';
  const G = caps.g === 'enum' ? 'gender:FEMALE,' : caps.g === 'crit' ? 'gender:{value:FEMALE,modifier:EQUALS},' : '';
  for (let i = 0; i < SD_FIELDS.length; i++) { if (await tryQ(G, SD_FIELDS[i])) { caps.fl = i; break; } }
  caps.age = await tryQ(G + 'age:{value:20,value2:30,modifier:BETWEEN},');
  if (await tryQ(G + 'ethnicity:CAUCASIAN,')) caps.eth = 'enum'; else if (await tryQ(G + 'ethnicity:{value:CAUCASIAN,modifier:EQUALS},')) caps.eth = 'crit';
  caps.hair = await tryQ(G + 'hair_color:{value:BLONDE,modifier:EQUALS},');
  caps.sort = await tryQ(G + 'sort:SCENE_COUNT,direction:DESC,');
  recJset(REC_LS.caps, caps); return caps;
}
function sdPerfQuery(caps, sp, page, per) {
  const parts = [caps.g === 'enum' ? 'gender:FEMALE' : caps.g === 'crit' ? 'gender:{value:FEMALE,modifier:EQUALS}' : ''];
  if (sp.cc && /^[A-Z]{2}$/.test(sp.cc)) parts.push(`country:{value:"${sp.cc}",modifier:EQUALS}`);
  if (sp.age && caps.age) parts.push(`age:{value:${sp.age[0] | 0},value2:${sp.age[1] | 0},modifier:BETWEEN}`);
  if (sp.eth && caps.eth && ETH_ENUM[sp.eth]) parts.push(caps.eth === 'enum' ? `ethnicity:${ETH_ENUM[sp.eth]}` : `ethnicity:{value:${ETH_ENUM[sp.eth]},modifier:EQUALS}`);
  if (sp.hair && caps.hair && HAIR_ENUM[sp.hair]) parts.push(`hair_color:{value:${HAIR_ENUM[sp.hair]},modifier:EQUALS}`);
  if (caps.sort) parts.push('sort:SCENE_COUNT', 'direction:DESC');
  parts.push(`page:${page | 0}`, `per_page:${per | 0}`);
  return `query{queryPerformers(input:{${parts.filter(Boolean).join(',')}}){count performers{${SD_FIELDS[caps.fl]}}}}`;
}
function mapSx(p) { const m = mapS(p), ms = p.measurements || {};
  m.stashId = p.id; m.src = 'StashDB'; m.gender = String(p.gender || '').toLowerCase(); m.cc = ctryCode(p.country);
  m.at = { c: m.cc, e: ethNorm(p.ethnicity), hr: hairNorm(p.hair_color), ey: eyeNorm(p.eye_color), cp: cupBucket(ms.cup_size || p.cup_size), h: parseHeight(p.height), cs: +p.career_start_year || 0 }; return m; }
function mapPx(p) { const ex = p.extras || p.extra || {}, b = String(ex.birthday || p.birthday || '').match(/^\d{4}-\d{2}-\d{2}/), im = imgsOf(p), bp = String(ex.birthplace || '');
  const cc = ctryCode(ex.nationality) || ctryCode(ex.birthplace_code) || ctryCode(bp.split(',').pop());
  return { name: p.name || '', aliases: aliasStr(p.aliases), country: ex.nationality || ex.birthplace_code || bp || '', birth: b ? b[0] : '', img: im[0] || '', pdbId: p.id, src: 'ThePornDB', gender: String(ex.gender || p.gender || '').toLowerCase(), cc,
    at: { c: cc, e: ethNorm(ex.ethnicity), hr: hairNorm(ex.hair_colour), ey: eyeNorm(ex.eye_colour), cp: cupBucket(ex.cupsize || ex.measurements), h: parseHeight(ex.height), cs: +ex.career_start_year || 0 } }; }
const slimCand = c => { const o = { k: norm(c.name), name: c.name, aliases: c.aliases || '', img: c.img || '', cc: c.cc || '', country: c.country || '', birth: c.birth || '', birthRaw: c.birthRaw || '', src: c.src, gender: c.gender, at: c.at || {}, t: Date.now() };
  if (c.stashId) o.stashId = c.stashId; if (c.pdbId) o.pdbId = c.pdbId; if (c.ofId) o.ofId = c.ofId; if (c.fsId) o.fsId = c.fsId; if (c.px) o.px = c.px; if (c.urls && c.urls.length) o.urls = c.urls.slice(0, 6); return o; };

// ---------- جمع المرشّحات (واسع، مبني على الصفات والذوق لا على الزميلات) ----------
function recSpecs(P, round) {
  const top = (m, n) => m ? m.top.slice(0, n).map(x => x[0]) : [], ccs = top(P.cat.country, 3), eths = top(P.cat.eth, 2), hairs = top(P.cat.hair, 2);
  const ag = P.num.age ? [Math.max(18, Math.round(P.num.age.mu - P.num.age.sd * 1.4)), Math.round(P.num.age.mu + P.num.age.sd * 1.6)] : [19, 32];
  const specs = []; ccs.slice(0, 2).forEach(cc => specs.push({ cc, age: ag }));
  if (eths[0]) specs.push({ eth: eths[0], hair: hairs[0], age: ag }); if (ccs[0] && hairs[0]) specs.push({ cc: ccs[0], hair: hairs[0] });
  if (eths[1]) specs.push({ eth: eths[1], age: ag }); specs.push({ age: ag }); if (ccs[2]) specs.push({ cc: ccs[2], age: ag });
  const world = ['US', 'CZ', 'HU', 'RU', 'UA', 'GB', 'ES', 'CO', 'BR', 'DE', 'FR', 'IT', 'PL', 'RO', 'CA', 'AU', 'JP', 'TH'].filter(c => !ccs.includes(c));
  specs.push({ cc: world[round % world.length], age: ag, explore: 1 });
  const seen = new Set(); return specs.filter(s => { const k = JSON.stringify(s); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 7);
}
async function sdStudioId(name) {
  const cache = recJget(REC_LS.studios, {}), k = norm(name); if (cache[k] !== undefined) return cache[k];
  const d = await sdQ('query($t:String!){searchStudio(term:$t,limit:3){id name}}', { t: name }); const r = d.searchStudio || []; const ex = r.find(x => norm(x.name) === k) || r[0];
  cache[k] = ex ? ex.id : ''; recJset(REC_LS.studios, cache); return cache[k];
}
async function recGather(P, round, progress) {
  const out = [], hasS = !!LS.get('vkte_stash'), hasP = !!LS.get('vkte_key'), hasX = vxAny(); const add = (arr, tag) => arr.forEach(c => { c.how = tag; out.push(c); });
  if (hasS) {
    let caps = null; try { caps = await sdCaps(); } catch (e) { if (e && (e.status === 401 || e.status === 403)) throw e; }
    if (caps) {
      const specs = recSpecs(P, round); let i = 0;
      for (const sp of specs) { progress(`StashDB: بحث بالصفات (${++i}/${specs.length})…`);
        try { const d = await sdQ(sdPerfQuery(caps, sp, 1 + ((round + i) % 6), 40), {}); add(((d.queryPerformers && d.queryPerformers.performers) || []).map(p => { const m = mapSx(p); if (caps.g && !m.gender) m.gender = 'female'; return m; }), sp.explore ? 'explore' : 'attr'); }
        catch (e) { if (e && (e.status === 401 || e.status === 403)) break; } await recSleep(120); }
      const studios = (P.cat.studio ? P.cat.studio.top : []).slice(0, 3).map(x => x[0]); i = 0;
      for (const st of studios) { progress(`StashDB: استوديو ${st}…`);
        try { const id = await sdStudioId(st); if (id) { const d = await sdQ(`query($s:ID!){queryScenes(input:{studios:{value:[$s],modifier:INCLUDES},page:${1 + ((round + i) % 4)},per_page:25}){scenes{id performers{performer{${SD_FIELDS[caps.fl]}}}}}}`, { s: id });
          ((d.queryScenes && d.queryScenes.scenes) || []).forEach(sc => add((sc.performers || []).map(x => x && x.performer).filter(Boolean).map(mapSx), 'studio')); } } catch (e) {} i++; await recSleep(120); }
    }
  }
  if (hasP) {
    const studios = (P.cat.studio ? P.cat.studio.top : []).slice(0, 2).map(x => x[0]), tags = (P.cat.tag ? P.cat.tag.top : []).slice(0, 2).map(x => x[0]);
    for (const st of studios) { progress(`ThePornDB: ${st}…`);
      try { const rr = await fetch(API() + '/scenes?q=' + encodeURIComponent(st) + '&per_page=20&page=' + (1 + (round % 3)), { headers: hdr() }); if (rr.ok) { const j = await rr.json(); (j.data || []).forEach(sc => add((sc.performers || []).map(mapPx), 'studio')); } } catch {} await recSleep(120); }
    for (const tg of tags) { progress(`ThePornDB: وسم #${tg}…`);
      try { const rr = await fetch(API() + '/performers?q=' + encodeURIComponent(tg) + '&gender=female&per_page=20', { headers: hdr() }); if (rr.ok) { const j = await rr.json(); add((j.data || []).map(mapPx), 'tag'); } } catch {} await recSleep(120); }
  }
  if (hasX) { try { (await VX.gather(P, round, progress)).forEach(c => { c.how = c.how || 'tag'; out.push(c); }); } catch (e) {} }
  return out;
}
async function pdbDetail(id) { const rr = await fetch(API() + '/performers/' + encodeURIComponent(id), { headers: hdr() }); if (!rr.ok) throw httpErr(rr.status); const j = await rr.json(); return mapPx(j.data || j); }

// ---------- الفحص العميق: استوديوهات ووسوم المرشّحة + زميلاتها من مكتبتك ----------
async function recDeepCheck(c, lw) {
  const st = {}, tg = {}, coMap = {}; let n = 0; const bump = (m, k) => { if (k) m[k] = (m[k] || 0) + 1; };
  const note = names => names.forEach(nm => { const w = lw.get(norm(nm)); if (w) coMap[norm(nm)] = { n: nm, w }; });
  if (c.stashId && LS.get('vkte_stash')) {
    const d = await sdQ('query($id:ID!){queryScenes(input:{performers:{value:[$id],modifier:INCLUDES},page:1,per_page:40}){scenes{studio{name} tags{name} performers{performer{name}}}}}', { id: c.stashId });
    ((d.queryScenes && d.queryScenes.scenes) || []).forEach(s => { n++; bump(st, s.studio && s.studio.name); (s.tags || []).forEach(t => bump(tg, t && t.name)); note((s.performers || []).map(p => p && p.performer && p.performer.name).filter(Boolean)); });
  } else if (c.pdbId && LS.get('vkte_key')) {
    const rr = await fetch(API() + '/performers/' + encodeURIComponent(c.pdbId) + '/scenes?per_page=40', { headers: hdr() }); if (!rr.ok) throw httpErr(rr.status);
    const j = await rr.json(); (j.data || []).forEach(s => { n++; bump(st, siteOf(s)); (Array.isArray(s.tags) ? s.tags : []).forEach(t => bump(tg, typeof t === 'string' ? t : t && t.name)); note((s.performers || []).map(p => p && p.name).filter(Boolean)); });
  } else return null;
  const top = (m, k) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, k));
  return { n, st: top(st, 6), tg: top(tg, 10), co: Object.values(coMap).slice(0, 4) };
}

// ---------- إثراء صفات مكتبتك (مرة لكل ممثلة، ويتدرّج بين الفتحات) ----------
async function recEnrichLibrary(progress, limit = 18) {
  const hasS = !!LS.get('vkte_stash'), hasP = !!LS.get('vkte_key'); if (!hasS && !hasP) return; const now = Date.now();
  const todo = items.filter(i => { const a = _attrCache[i.id]; return !a || (now - a.t > (a.at && Object.keys(a.at).length ? 45 : 7) * 864e5); }).slice(0, limit); if (!todo.length) return;
  let caps = null; if (hasS) { try { caps = await sdCaps(); } catch {} } let k = 0, ch = false;
  for (const it of todo) { progress(`تحليل ملفات مفضّلاتك (${++k}/${todo.length})…`); let at = null, sid = it.stashId || '', pid = it.pdbId || '';
    try {
      if (hasS && caps) { if (!sid) { const m = await findStash(it.name, true); if (m) sid = m.id; }
        if (sid) { const lvl = caps.fl; const d = await sdQ(`query($id:ID!){findPerformer(id:$id){${SD_FIELDS[lvl].replace(/ images\{[^}]*\}| urls\{[^}]*\}/g, '')}}`, { id: sid }); if (d.findPerformer) at = mapSx(d.findPerformer).at; } }
      if (!at && hasP) { if (!pid) { const m = await findPerformer(it.name, true); if (m) pid = m.id; } if (pid) at = (await pdbDetail(pid)).at; }
    } catch (e) { if (e && (e.status === 401 || e.status === 403)) break; }
    _attrCache[it.id] = { t: Date.now(), at: at || {}, sid: sid || undefined, pid: pid || undefined }; ch = true; await recSleep(150); }
  if (ch) saveAttrCache();
}

// ---------- المنسّق الرئيسي ----------
async function refillPool(P, round, progress) {
  const idx = libIndex(), ign = new Set(_recIgnored.map(norm)), seen = new Map(_recPool.list.map(c => [c.k, c]));
  const raw = await recGather(P, round, progress); const fresh = []; let detail = 0, vdet = 0;
  for (const c of raw) { const k = norm(c.name); if (!k) continue; const ex = seen.get(k);
    if (ex) { ['stashId', 'pdbId', 'ofId', 'fsId', 'px', 'img'].forEach(f => { if (!ex[f] && c[f]) ex[f] = c[f]; }); if (c.at) Object.keys(c.at).forEach(f => { if (!ex.at[f] && c.at[f]) ex.at[f] = c.at[f]; }); if (!ex.gender && c.gender) ex.gender = c.gender; continue; }
    if (c.pdbId && (!c.gender || !c.birth) && !c.stashId) { if (detail >= 14) continue; detail++; try { progress(`ThePornDB: التحقق من بيانات ${c.name}…`); Object.assign(c, await pdbDetail(c.pdbId)); await recSleep(120); } catch { continue; } }
    if (c.vx && (!c.gender || !c.birth)) { if (vdet >= 10) continue; vdet++; progress(`التحقق من ${c.name} (${c.src})…`); if (!(await VX.verify(c))) continue; await recSleep(120); }
    if (!c.gender) continue; // لا نقبل إلا أنثى مؤكّدة
    const s = slimCand(c); if (!recEligible(s, idx, ign)) continue; seen.set(k, s); fresh.push(s); }
  const cut = Date.now() - 21 * 864e5; _recPool.list = [...seen.values()].filter(c => c.t > cut || c.cx);
  _recPool.round = round; _recPool.at = Date.now(); return fresh.length;
}
async function deepCheckTop(P, k, progress) {
  const lw = libWeights(); const ranked = recRank(P); let done = 0;
  for (const c of ranked) { if (done >= k) break; const pc = _recPool.list.find(x => x.k === c.k); if (!pc || pc.cx || (pc.cxTry && Date.now() - pc.cxTry < 2 * 864e5)) continue; pc.cxTry = Date.now();
    progress(`فحص أعمال ${pc.name} (${++done}/${k})…`); try { pc.cx = await recDeepCheck(pc, lw); } catch (e) { if (e && (e.status === 401 || e.status === 403)) break; } await recSleep(120); }
  return done;
}
async function fetchApiRecommendations(forceRefresh = false, progress = () => {}) {
  await recEnrichLibrary(progress);
  const P = buildTasteProfile(); if (!P) return { list: [], profile: null };
  const stale = Date.now() - (_recPool.at || 0) > 3 * 864e5, small = _recPool.list.length < 30 && Date.now() - (_recPool.at || 0) > 6 * 36e5;
  if (forceRefresh) { (_recCache.list || []).forEach(c => { const pc = _recPool.list.find(x => x.k === norm(c.name)); if (pc) pc.shown = (pc.shown || 0) + 1; }); }
  if (forceRefresh || stale || small) { await refillPool(P, (_recPool.round || 0) + 1, progress); await deepCheckTop(P, 14, progress); }
  else await deepCheckTop(P, 6, progress);
  saveRecPool(); const list = recRank(P); _recCache = { list, at: Date.now() }; saveRecCache(); return { list, profile: P };
}


// 3. إضافة الممثلة المقترحة (وتعلّم النظام منها)
async function addRecToLibrary(cand) {
  const name = cand.name.trim();
  if (items.some(i => norm(i.name) === norm(name))) { toast(`«${name}» موجودة لديك بالفعل`); return; }
  { const ca = candAge(cand); if (ca == null || ca < 18 || !adultOk(cand)) { toast('لا يمكن إضافة سجل غير مؤكد العمر (18+)'); return; } }
  toast(`جارٍ إضافة «${name}» وجلب بياناتها من المصدر…`);
  const a = cand.at || {};
  const rec = {
    id: uid(), name, aliases: cand.aliases || '', country: cand.country || cand.cc || '', birth: cand.birth || '',
    works: [], tags: [], notes: `تمت الإضافة بناءً على اقتراح ذكي (${cand.reasons ? cand.reasons[0] : 'توصية API'})`,
    photos: cand.img ? [cand.img] : [], thumb: '', lists: [], rating: 0, criteria: null, bodyD: null, fav: true,
    accounts: (cand.urls || []).map(accFromUrl).filter(Boolean),
    pdbId: cand.pdbId || undefined, stashId: cand.stashId || undefined, ofId: cand.ofId || undefined, fsId: cand.fsId || undefined,
    source: (cand.src || 'API') + ' (اقتراح ذكي)', added: Date.now(), updated: Date.now()
  };
  if (typeof VX !== 'undefined') VX.applyToRec(rec, cand);
  if (a.h) rec.height = a.h; if (a.cs) rec.cs = a.cs;
  if (rec.photos[0]) { const loc = await localizeImage(rec.photos[0]); if (loc) { rec.srcImgs = [rec.photos[0]]; rec.photos = [loc]; } try { rec.thumb = await mkThumb(rec.photos[0]); } catch {} }
  items.push(rec);
  await save(rec);
  // تعلّم: إضافتك = إشارة إيجابية قوية + حفظ صفاتها لتحسين بصمة ذوقك
  _attrCache[rec.id] = { t: Date.now(), at: a, sid: cand.stashId || undefined, pid: cand.pdbId || undefined }; saveAttrCache();
  recLearn(cand, true, 1);
  _recFeedback.hist[norm(name)] = { keys: recKeysOf(cand), fs: cand.fs, raw: cand.raw, rated: 0 }; saveRecFeedback();
  _recPool.list = _recPool.list.filter(x => x.k !== norm(name)); saveRecPool();
  _recCache.list = (_recCache.list || []).filter(x => norm(x.name) !== norm(name)); saveRecCache();
  refreshAll(rec, true).then(r => { if (r && r.n) toast(`أُضيفت ${name} وتم جلب ${r.n} عمل لها! 🎉`); });
  toast(`✓ تمت إضافة «${name}» إلى المفضّلة!`);
  render(true);
  recAfterChange();
}

// 4. استبعاد ممثلة مقترحة (تعلّم سلبي من صفاتها كلها)
function ignoreRecPerformer(name) {
  const cand = (_recCache.list || []).find(x => norm(x.name) === norm(name)) || _recPool.list.find(x => x.k === norm(name));
  if (!_recIgnored.includes(name)) { _recIgnored.push(name); saveRecIgnored(); }
  if (cand) recLearn(cand, false, 1);
  _recPool.list = _recPool.list.filter(x => x.k !== norm(name)); saveRecPool();
  _recCache.list = (_recCache.list || []).filter(x => norm(x.name) !== norm(name)); saveRecCache();
  toast(`تم استبعاد «${name}» وسيتعلم النظام تجنب صفاتها المشابهة`);
  recAfterChange();
}
function recAfterChange() { if (window.recsOnChange) window.recsOnChange(); else drawStatsModal(); }

function recProfileHtml(P) {
  const pct = x => Math.round(x * 100) + '%', pill = (l, v) => v ? `<span class="rec-pill"><b>${l}:</b>${v}</span>` : '';
  const topTxt = (m, map) => m ? m.top.slice(0, 3).map(([k, s]) => `${esc(map ? map(k) : k)} ${pct(s)}`).join(' · ') : '';
  const A = P.num.age, H = P.num.height, E = P.num.exp;
  const ageT = A ? `~${Math.round(A.mu)} سنة (${Math.max(18, Math.round(A.mu - A.sd))}–${Math.round(A.mu + A.sd)})` : '';
  const mult = k => _recFeedback.w[k] != null ? _recFeedback.w[k] : 1;
  const imps = Object.keys(P.imp).map(k => [k, P.imp[k] * mult(k)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5), mx = imps[0] ? imps[0][1] : 1;
  const bars = imps.map(([k, v]) => `<div class="rec-bar"><span>${FEAT_AR[k] || k}</span><i><u style="width:${Math.max(6, v / mx * 100)}%"></u></i></div>`).join('');
  const n = _recFeedback.acc + _recFeedback.rej, rate = n ? Math.round(_recFeedback.acc / n * 100) : null;
  const sug = items.filter(i => /اقتراح ذكي/.test(i.source || '') && i.rating > 0), sugAvg = sug.length >= 2 ? avgOf(sug.map(i => i.rating)) : 0;
  const learn = `🧠 التعلّم: ${n ? `قبلت ${_recFeedback.acc} · استبعدت ${_recFeedback.rej} (نسبة القبول ${rate}%)` : 'لا توجد ردود بعد، كل إضافة أو استبعاد منك يرفع دقة الاقتراحات'}${sugAvg ? ` · متوسط تقييمك لما أضفته من الاقتراحات ${sugAvg.toFixed(1)}★` : ''}`;
  return `<div class="rec-profile-card">
    <div class="rec-profile-title">🎯 بصمة ذوقك من تحليل ${P.nPos} ممثلة (ثقة التحليل ${Math.round(P.conf * 100)}%) · إناث فقط:</div>
    <div class="rec-profile-pills">
      ${pill('الدول', topTxt(P.cat.country, ctryName))}${pill('المظهر', topTxt(P.cat.eth, k => ETH_AR[k] || k))}${pill('الشعر', topTxt(P.cat.hair, k => HAIR_AR[k] || k))}
      ${pill('العمر', ageT)}${pill('الطول', H ? `~${Math.round(H.mu)} سم` : '')}${pill('المسيرة', E ? `~${Math.round(E.mu)} سنة` : '')}
      ${pill('الاستوديوهات', P.cat.studio ? '<bdi dir="ltr">' + P.cat.studio.top.slice(0, 4).map(x => esc(x[0])).join(' · ') + '</bdi>' : '')}${pill('الوسوم', P.cat.tag ? '<bdi dir="ltr">#' + P.cat.tag.top.slice(0, 4).map(x => esc(x[0])).join(' #') + '</bdi>' : '')}
      ${P.topCrit.length ? pill('أعلى معيار', esc(P.topCrit[0][1])) : ''}
    </div>
    ${bars ? `<div class="rec-bars"><div class="src" style="margin-bottom:4px">أكثر ما يحدّد ذوقك (يتغيّر مع تعلّم النظام):</div>${bars}</div>` : ''}
    <div class="src rec-learn">${learn}</div>
    ${P.withAttrs < P.n ? `<div class="src" style="margin-top:4px">يجري تحليل صفات ${P.n - P.withAttrs} ممثلة إضافية تدريجيًا عند كل فتح لتحسين الدقة.</div>` : ''}
  </div>`;
}
async function drawRecsBody(head, force) {
  const hasKeys = !!(LS.get('vkte_key') || LS.get('vkte_stash') || vxAny());
  if (!hasKeys) {
    $('mStats').innerHTML = head + `<div class="empty" style="padding:40px 16px">
      <b>مفاتيح API مطلوبة للاقتراحات</b>
      <p class="src" style="margin:8px 0 16px">يتم استخراج الاقتراحات من ThePornDB و StashDB و OnlyFansAPI و Fansly API للإناث فقط. أضف مفتاح أحدها في الإعدادات لتفعيل الميزة.</p>
      <button type="button" class="btn gold" id="recGoSet">${icon('set')} فتح الإعدادات</button></div>`;
    return;
  }
  const loading = t => `<div class="empty" style="padding:40px 16px"><b>جارٍ تحليل ذوقك الشامل والبحث عن ممثلات جديدات…</b><div class="src" id="recProg">${t}</div></div>`;
  if (recsLoading) { $('mStats').innerHTML = head + loading('التحليل جارٍ…'); return; }
  recsLoading = true; $('mStats').innerHTML = head + loading('بدء التحليل…');
  const prog = t => { const el = $('recProg'); if (el) el.textContent = t; };
  let res;
  try { res = await fetchApiRecommendations(force, prog); }
  catch (e) { toast(e && (e.status === 401 || e.status === 403) ? 'مفتاح API غير صالح' : 'تعذّر الاتصال بالمصادر، عُرضت آخر اقتراحات محفوظة'); res = { list: _recCache.list || [], profile: buildTasteProfile() }; }
  finally { recsLoading = false; }
  if (statsTab !== 'recs' || !$('ovStats').classList.contains('show')) return;
  const { list: recList, profile } = res;
  const profileHtml = profile ? recProfileHtml(profile) : '';
  const headBar = `<div class="rec-head-bar"><div>
      <b style="color:var(--gold2);font-size:1.02rem">اقتراحات ممثلات جديدات تناسب ذوقك (${recList.length})</b>
      <div class="src">إناث فقط · مرتّبة بمدى توافق صفاتهن مع ذوقك، لا بمجرد مشاركتهن مع مفضّلاتك</div></div>
      <button type="button" class="btn gold" style="padding:6px 14px;font-size:.82rem" id="recRefreshBtn">${icon('refresh')} تجديد الاقتراحات ↻</button></div>`;
  let gridHtml;
  if (recList.length) {
    gridHtml = `<div class="rec-grid">${recList.map((cand, idx) => {
      const a = cand.age || (cand.birth ? age(cand.birth) : null), why = (cand.reasons || []).slice(0, 2).map(r => '• ' + esc(r)).join('<br>');
      return `<div class="rec-c" data-recidx="${idx}">
        <div class="rec-photo-box" data-prv="${idx}">
          ${cand.img ? `<img class="rec-img" src="${esc(cand.img)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" alt="">` : `<div style="display:grid;place-items:center;height:100%;font-size:2.5rem;color:var(--gold2)">♡</div>`}
          <span class="rec-badge-score">توافق ${cand.matchPct}%</span>
          <span class="rec-badge-src">${esc(cand.src)}</span>
          ${cand.explore ? '<span class="rec-badge-exp">استكشاف</span>' : ''}
        </div>
        <div class="rec-body">
          <div class="rec-name" data-prv="${idx}">${esc(cand.name)}</div>
          <div class="rec-meta">${esc([cand.cc ? ctryName(cand.cc) : cand.country, a ? a + ' سنة' : '', cand.aliases ? 'أسماء: ' + cand.aliases : ''].filter(Boolean).join(' · '))}</div>
          <div class="rec-reason"><b>سبب الاقتراح:</b><br>${why || 'تطابق اهتماماتك'}</div>
          <div class="rec-foot">
            <button type="button" class="rec-btn-add" data-addrec="${idx}">إضافة للمفضّلة ★</button>
            <button type="button" class="rec-btn-ign" data-ignrec="${idx}" title="ليست ذوقي — استبعاد والتعلّم منه">✕</button>
          </div></div></div>`;
    }).join('')}</div>`;
  } else gridHtml = `<div class="empty"><b>لا توجد اقتراحات حاليًا</b>اضغط على «تجديد الاقتراحات ↻» أو تأكد من ضبط المفاتيح في الإعدادات.</div>`;
  $('mStats').innerHTML = head + `<div class="rec-box">${profileHtml}${headBar}${gridHtml}</div>`;
}

// 5. استعراض صفحة ومعلومات الممثلة
function previewRecPerformer(cand) {
  const a = cand.age || (cand.birth ? age(cand.birth) : null);
  askShow(`
    <div style="position:relative;width:100%;height:240px;border-radius:18px;overflow:hidden;background:radial-gradient(circle at 50% 35%,#4a1238,#12050c 80%);margin-bottom:12px;border:1px solid var(--gline)">
      ${cand.img ? `<img src="${esc(cand.img)}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain;display:block" alt="">` : `<div style="display:grid;place-items:center;height:100%;font-size:3rem;color:var(--gold2)">♡</div>`}
      <div style="position:absolute;top:10px;inset-inline-start:10px;background:var(--grad);color:#fff;border-radius:99px;padding:3px 12px;font-size:.8rem;font-weight:700">تطابق ${cand.matchPct || 90}%</div>
      <div style="position:absolute;top:10px;inset-inline-end:10px;background:rgba(11,4,7,.85);border:1px solid rgba(255,255,255,.2);color:var(--gold2);border-radius:99px;padding:3px 10px;font-size:.72rem;font-weight:700">${esc(cand.src || 'API')}</div>
    </div>
    <h2 style="margin:0 0 4px;font-size:1.35rem">${esc(cand.name)}</h2>
    <div class="src" style="margin-bottom:12px">${esc([cand.country, a ? a + ' سنة' : '', cand.aliases ? 'أسماء أخرى: ' + cand.aliases : ''].filter(Boolean).join(' · '))}</div>
    <div class="rec-reason" style="margin-bottom:14px">
      <b>لماذا تم اقتراحها؟</b><br>
      ${(cand.reasons || ['تطابق معايير واهتمامات مجموعتك']).map(r => `• ${esc(r)}`).join('<br>')}
    </div>
    <div class="actions" style="justify-content:space-between">
      <button type="button" class="btn danger" id="prvIgn">استبعاد ✕</button>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn" id="prvSrchG">بحث Google ↗</button>
        <button type="button" class="btn gold" id="prvAdd">إضافة للمفضّلة ★</button>
      </div>
    </div>
  `, (m, done) => {
    m.classList.add('wide');
    m.classList.toggle('blur', document.body.classList.contains('blur'));
    $('prvSrchG').onclick = () => openExt('https://www.google.com/search?q=' + encodeURIComponent(cand.name));
    $('prvIgn').onclick = () => { ignoreRecPerformer(cand.name); done(true); };
    $('prvAdd').onclick = () => { addRecToLibrary(cand); done(true); };
  });
}

// عرض ورسم نافذة الإحصائيات مع التبويبين
async function drawStatsModal(forceRefreshRecs = false) {
  const N = items.length;
  let c = 0;
  const cell = (num, lab, d = 0) => `<div class="sc" style="--i:${c++}"><b class="cu" data-v="${num}" data-d="${d}">0</b><span>${lab}</span></div>`;

  let head = `<div class="sthead">
    <h2>الإحصائيات والاقتراحات</h2>
    <button class="ib" id="stClose" aria-label="إغلاق">${icon('x')}</button>
  </div>
  <div class="st-tabs">
    <button type="button" class="st-tab ${statsTab==='overview'?'on':''}" id="stTabOverview">📊 الإحصائيات العامة</button>
    <button type="button" class="st-tab ${statsTab==='recs'?'on':''}" id="stTabRecs">💡 الاقتراحات الذكية <em>جديد</em></button>
  </div>`;

  if (!N) {
    head += '<p class="src" style="padding:20px 4px">أضف بعض الممثلات أولًا لتظهر الإحصائيات ونظام التوصيات الذكي.</p>';
    $('mStats').innerHTML = head;
    $('stClose').onclick = () => closeOv('ovStats');
    $('ovStats').classList.add('show');
    return;
  }

  let body = '';

  if (statsTab === 'overview') {
    const rated = items.filter(i => i.rating > 0), avg = avgOf(rated.map(i => i.rating));
    const nPh = items.reduce((a,i) => a + (i.photos||[]).length, 0), nW = items.reduce((a,i) => a + (i.works||[]).length, 0), sites = allSites();
    body += `<div class="sgrid">${cell(N,'الإجمالي')}${cell(items.filter(i=>i.fav).length,'المفضّلة')}${cell(rated.length,'مُقيَّمة')}${cell(avg,'متوسط تقييمي',2)}${cell(nPh,'عدد الصور')}${cell(nW,'عدد الأعمال')}${cell(sites.length,'المواقع')}${cell(lists.length,'القوائم')}${cell(items.reduce((a,i)=>a+(i.works||[]).filter(w=>w.w).length,0),'شاهدتها')}${cell(items.filter(i=>i.bodyD).length,'بتقييم جسم مفصّل')}</div><div class="sx">`;
    let g = 0; const card = (t, b, wide) => `<div class="gc ${wide?'wide':''}" style="--i:${g++}"><h3>${t}</h3>${b}</div>`;

    const ins = []; const best = rated.slice().sort((a,b) => b.rating - a.rating)[0];
    if (best) ins.push(`الأعلى تقييمًا عندك: <b>${esc(best.name)}</b> (${best.rating.toFixed(1)} ★)`);
    const cv = CRIT.map(([k,n]) => [n, avgOf(items.map(i => i.criteria && i.criteria[k]).filter(x => x > 0))]).filter(x => x[1] > 0).sort((a,b) => b[1] - a[1]);
    if (cv.length > 1) ins.push(`أعلى معيار عندك <b>${cv[0][0]}</b> (${cv[0][1].toFixed(1)})، وأقلها <b>${cv[cv.length-1][0]}</b> (${cv[cv.length-1][1].toFixed(1)})`);
    const co = topN(items.map(i => i.country), 8); if (co.length) ins.push(`أكثر دولة: <b>${esc(co[0][0])}</b> (${co[0][1]})`);
    const st = topN(items.flatMap(i => (i.works||[]).map(w => w.s)), 10); if (st.length) ins.push(`أكثر موقع ظهورًا: <b>${esc(st[0][0])}</b> (${st[0][1]} عمل)`);
    const ages = items.map(i => age(i.birth)).filter(x => x !== null && x >= 18); if (ages.length) ins.push(`متوسط الأعمار: <b>${avgOf(ages).toFixed(1)}</b> سنة`);
    const unr = N - rated.length; if (unr) ins.push(`<b>${unr}</b> ممثلة لم تقيّمها بعد`);
    if (ins.length) body += card('نظرة سريعة', ins.map(x => `<div class="ins"><i></i><div>${x}</div></div>`).join(''), true);

    if (cv.length) { body += card('بصمة تقييماتي (المعايير)', radar(CRIT.map(([k,n]) => [n, avgOf(items.map(i => i.criteria && i.criteria[k]).filter(x => x > 0))]))); body += card('متوسط كل معيار', cv.map(([n,v]) => barRow(n, v, 5, v.toFixed(2))).join('')); }
    if (rated.length) { const bins = Array(10).fill(0); rated.forEach(i => { bins[Math.min(9, Math.max(0, Math.round(i.rating * 2) - 1))]++; }); const mx = Math.max(...bins);
      body += card('توزيع التقييم', `<div class="vbars">${bins.map((v,k) => `<div class="vb"><em>${v||''}</em><div style="height:${v?Math.max(4,v/mx*80):0}%"></div>${(k+1)/2}</div>`).join('')}</div>`); }
    if (rated.length) { const top = rated.slice().sort((a,b) => b.rating - a.rating || b.updated - a.updated).slice(0, 10);
      body += card('الأعلى تقييمًا', top.map((i,n) => `<div class="rk" data-open="${i.id}"><span class="n">${n+1}</span>${avatar(i)}<div class="nm">${esc(i.name)}</div>${stars(i.rating)}<span class="bv" style="width:34px">${i.rating.toFixed(1)}</span></div>`).join('')); }
    const bc = CRIT.map(([k,n]) => { const arr = items.filter(i => i.criteria && i.criteria[k] > 0).sort((a,b) => b.criteria[k] - a.criteria[k]); return arr.length ? `<div class="bst" data-open="${arr[0].id}"><span>الأفضل في ${n}</span><b>${esc(arr[0].name)}<em>${arr[0].criteria[k]}</em></b></div>` : ''; }).join('');
    if (bc) body += card('الأفضل في كل معيار', `<div class="bestg">${bc}</div>`);
    if (ages.length) { const gr = [['18–24',18,24],['25–29',25,29],['30–34',30,34],['35–39',35,39],['40+',40,200]].map(([l,a,b]) => [l, ages.filter(x => x >= a && x <= b).length]); const mg = Math.max(...gr.map(x => x[1]));
      const withAge = items.filter(i => age(i.birth) !== null).sort((a,b) => age(a.birth) - age(b.birth));
      body += card('الأعمار', gr.map(([l,v]) => barRow(l, v, mg, v)).join('') + `<div class="src" style="margin-top:8px">الأصغر: ${esc(withAge[0].name)} (${age(withAge[0].birth)}) · الأكبر: ${esc(withAge[withAge.length-1].name)} (${age(withAge[withAge.length-1].birth)}) · ${ages.length} من ${N} لديهن تاريخ ميلاد</div>`); }
    if (co.length) body += card('الدول', co.map(([n,c]) => { const av = avgOf(rated.filter(i => i.country === n).map(i => i.rating)); return barRow(n, c, co[0][1], c + (av ? ` · ${av.toFixed(1)}★` : '')); }).join('') + '<div class="src" style="margin-top:6px">الرقم الثاني: متوسط تقييمك لتلك الدولة</div>');
    if (st.length) body += card('أكثر المواقع', st.map(([n,c]) => `<div class="siter">${badge(n)}<div style="flex:1;min-width:0"><div class="nm" style="font-size:.88rem">${esc(n)}</div><div class="bt" style="margin-top:4px"><div class="bf" style="width:${Math.max(4, c/st[0][1]*100)}%"></div></div></div><small>${c} عمل</small></div>`).join(''));
    const tg = topN(items.flatMap(i => i.tags || []), 16); if (tg.length) body += card('أكثر الوسوم', `<div class="cloud">${tg.map(([n,c]) => `<span style="--w:${(c/tg[0][1]).toFixed(2)}">#${esc(n)}<small>${c}</small></span>`).join('')}</div>`);
    const mo = []; const now = new Date(); for (let k = 5; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); mo.push([d, 0]); }
    items.forEach(i => { const d = new Date(i.added || i.updated); mo.forEach(m => { if (m[0].getFullYear() === d.getFullYear() && m[0].getMonth() === d.getMonth()) m[1]++; }); });
    const mm = Math.max(1, ...mo.map(m => m[1]));
    body += card('الإضافات في آخر 6 أشهر', `<div class="vbars">${mo.map(([d,v]) => `<div class="vb"><em>${v||''}</em><div style="height:${v?Math.max(6,v/mm*80):0}%"></div>${d.toLocaleDateString('ar',{month:'short'})}</div>`).join('')}</div>`);
    if (lists.length) body += card('القوائم', lists.map(L => { const c = items.filter(i => (i.lists||[]).includes(L.id)).length; return barRow(L.name, c, Math.max(1, ...lists.map(x => items.filter(i => (i.lists||[]).includes(x.id)).length)), c); }).join(''));
    const pc = f => Math.round(items.filter(f).length / N * 100);
    const comp = [['فيها صورة', pc(i => (i.photos||[]).length > 0)], ['3 صور فأكثر', pc(i => (i.photos||[]).length >= 3)], ['تاريخ ميلاد', pc(i => !!i.birth)], ['بلد', pc(i => !!i.country)], ['أعمال', pc(i => (i.works||[]).length > 0)], ['ملاحظات', pc(i => !!i.notes)], ['وسوم', pc(i => (i.tags||[]).length > 0)], ['تقييم', pc(i => i.rating > 0)], ['تقييم تفصيلي', pc(i => !!i.criteria)]];
    body += card('اكتمال الملفات', comp.map(([l,v]) => barRow(l, v, 100, v + '%')).join(''));
    const un = items.filter(i => !(i.rating > 0)).slice(0, 6); if (un.length) body += card('بانتظار تقييمك', un.map(i => `<div class="rk" data-open="${i.id}">${avatar(i)}<div class="nm">${esc(i.name)}</div></div>`).join(''));
    const bodyAv = BODY.map(([k,n]) => [n, avgOf(items.map(i => i.bodyD && i.bodyD[k]).filter(x => x > 0))]).filter(x => x[1] > 0);
    if (bodyAv.length) { body += card('بصمة تفاصيل الجسم', radar(bodyAv)); body += card('متوسط تفاصيل الجسم', bodyAv.slice().sort((a,b) => b[1] - a[1]).map(([n,v]) => barRow(n, v, 5, v.toFixed(2))).join('')); }
    if (nW) { const nS = items.reduce((a,i) => a + (i.works||[]).filter(w => w.w).length, 0);
      const left = items.map(i => [i, (i.works||[]).filter(w => !w.w).length]).filter(x => x[1] > 0).sort((a,b) => b[1] - a[1]).slice(0, 6);
      body += card('تقدّم المشاهدة', `<div class="siter"><div class="bt"><div class="bf" style="width:${Math.max(2, nS/nW*100)}%"></div></div><small style="width:auto">${nS} / ${nW}</small></div><div class="src" style="margin-bottom:6px">${Math.round(nS/nW*100)}٪ من أعمالك شاهدتها</div>` + (left.length ? '<div class="src" style="margin:8px 0 2px">الأكثر أعمالًا ما شاهدتها:</div>' + left.map(([i,c]) => `<div class="rk" data-open="${i.id}">${avatar(i)}<div class="nm">${esc(i.name)}</div><span class="bv" style="width:auto">${c} عمل</span></div>`).join('') : '')); }
    const yc = {}; items.forEach(i => (i.works||[]).forEach(w => { if (/^\d{4}$/.test(w.y)) yc[w.y] = (yc[w.y] || 0) + 1; }));
    const ys = Object.keys(yc).sort().slice(-10); if (ys.length > 1) { const my = Math.max(...ys.map(y => yc[y])); body += card('الأعمال حسب السنة', `<div class="vbars">${ys.map(y => `<div class="vb"><em>${yc[y]}</em><div style="height:${Math.max(4, yc[y]/my*80)}%"></div>${y.slice(2)}</div>`).join('')}</div>`); }
    const tgAvg = [...new Set(items.flatMap(i => i.tags || []))].map(t => { const r = rated.filter(i => (i.tags||[]).includes(t)); return [t, r.length, avgOf(r.map(i => i.rating))]; }).filter(x => x[1] >= 2).sort((a,b) => b[2] - a[2]).slice(0, 8);
    if (tgAvg.length) body += card('أفضل الوسوم تقييمًا', tgAvg.map(([t,c,v]) => barRow('#' + t, v, 5, v.toFixed(2) + ' (' + c + ')')).join('') + '<div class="src" style="margin-top:6px">وسوم فيها ممثلتان مقيَّمتان على الأقل</div>');
    const fullness = i => [(i.photos||[]).length > 0, (i.photos||[]).length >= 3, !!i.birth, !!i.country, (i.works||[]).length > 0, !!i.notes, (i.tags||[]).length > 0, i.rating > 0, !!i.criteria, !!i.bodyD, (i.accounts||[]).length > 0].filter(Boolean).length;
    const fl = items.map(i => [i, fullness(i)]).sort((a,b) => a[1] - b[1]).slice(0, 5);
    body += card('ملفات ناقصة (أولى بالإكمال)', fl.map(([i,c]) => `<div class="rk" data-open="${i.id}">${avatar(i)}<div class="nm">${esc(i.name)}</div><span class="bv" style="width:auto">${c} / 11</span></div>`).join(''));
    const pl = topN(items.flatMap(i => (i.accounts||[]).map(a => platOf(a.p).n)), 6); if (pl.length) body += card('المنصات (الحسابات المسجّلة)', pl.map(([n,c]) => barRow(n, c, pl[0][1], c)).join(''));
    body += '</div>';

    $('mStats').innerHTML = head + body;
    countUp($('mStats'));
  } else {
    await drawRecsBody(head, forceRefreshRecs);
  }

  wireStatsModal();
}

function wireStatsModal() {
  if ($('stClose')) $('stClose').onclick = () => closeOv('ovStats');

  if ($('stTabOverview')) $('stTabOverview').onclick = () => {
    if (statsTab !== 'overview') {
      statsTab = 'overview';
      drawStatsModal();
    }
  };

  if ($('stTabRecs')) $('stTabRecs').onclick = () => {
    if (statsTab !== 'recs') {
      statsTab = 'recs';
      drawStatsModal();
    }
  };

  if ($('recGoSet')) $('recGoSet').onclick = () => { closeOv('ovStats'); $('bSet').click(); };
  if ($('recRefreshBtn')) $('recRefreshBtn').onclick = () => {
    toast('جارٍ تجديد الاقتراحات من APIs…');
    drawStatsModal(true);
  };

  $('mStats').onclick = e => {
    const o = e.target.closest('[data-open]');
    if (o) { closeOv('ovStats'); openDetail(o.dataset.open); return; }

    const addBtn = e.target.closest('[data-addrec]');
    if (addBtn && _recCache.list) {
      const cand = _recCache.list[+addBtn.dataset.addrec];
      if (cand) addRecToLibrary(cand);
      return;
    }

    const ignBtn = e.target.closest('[data-ignrec]');
    if (ignBtn && _recCache.list) {
      const cand = _recCache.list[+ignBtn.dataset.ignrec];
      if (cand) ignoreRecPerformer(cand.name);
      return;
    }

    const prv = e.target.closest('[data-prv]');
    if (prv && _recCache.list) {
      const cand = _recCache.list[+prv.dataset.prv];
      if (cand) previewRecPerformer(cand);
      return;
    }
  };
}

$('bStats').onclick = () => {
  drawStatsModal();
  $('ovStats').classList.add('show');
  $('mStats').scrollTop = 0;
  $('mStats').classList.toggle('blur', document.body.classList.contains('blur'));
};


;

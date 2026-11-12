/* ---- 16-platform-apis.js ---- */
/* ===== v30.js — OnlyFansAPI + Fansly API (مصدران إضافيان بنفس نمط ThePornDB / StashDB) =====
   مبدأ عدم التعارض:
   • كل شيء داخل VX ومفاتيح التخزين مستقلة (vkte_ofapi / vkte_fsapi + عناوينها) ولا يلمس vkte_key / vkte_stash / vkte_proxy.
   • الهوية: ofId / fsId (اسم المستخدم) حقلان مستقلان بجانب pdbId / stashId، ويُدمجان بلا تكرار.
   • الاقتراحات: المنصتان تكتشفان أسماء فقط، ولا تُقبل مرشّحة إلا بعد تأكيد الجنس والعمر 18+ من StashDB/ThePornDB،
     ولا يُربط حسابها إلا إذا أكّدت القاعدة نفس اسم المستخدم (تفاديًا لخلط شخصين بنفس الاسم).
   • واجهة الـAPI لم أستطع قراءة توثيقها من بيئتي، لذلك العنوان والمسارات قابلة للتعديل وفيها «فحص تلقائي». */
const VX = (() => {
  'use strict';
  const $$ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const E = s => { const e = new Error('http'); e.status = s; return e; };
  const uniq = a => [...new Set(a.filter(Boolean))];
  const PV = {
    of: { id: 'of', name: 'OnlyFans', lsKey: 'vkte_ofapi', lsBase: 'vkte_ofapi_base', lsCfg: 'vkte_ofapi_cfg', idKey: 'ofId', plat: 'onlyfans', host: 'onlyfans.com', home: 'https://onlyfans.com/',
      bases: ['https://app.onlyfansapi.com/api', 'https://api.onlyfansapi.com/api', 'https://api.onlyfansapi.com'],
      sg: ['/search?q={q}', '/profiles/search?query={q}', '/creators/search?q={q}', '/search/creators?q={q}', '/users/search?query={q}'],
      pg: ['/profiles/{id}', '/creators/{id}', '/users/{id}', '/profile/{id}'] },
    fs: { id: 'fs', name: 'Fansly', lsKey: 'vkte_fsapi', lsBase: 'vkte_fsapi_base', lsCfg: 'vkte_fsapi_cfg', idKey: 'fsId', plat: 'fansly', host: 'fansly.com', home: 'https://fansly.com/',
      bases: ['https://app.apifansly.com/api', 'https://api.apifansly.com/api', 'https://api.apifansly.com'],
      sg: ['/search?q={q}', '/profiles/search?query={q}', '/creators/search?q={q}', '/search/creators?q={q}', '/users/search?query={q}'],
      pg: ['/profiles/{id}', '/creators/{id}', '/users/{id}', '/profile/{id}'] }
  };
  const ALL = Object.values(PV);
  const key = p => LS.get(p.lsKey);
  const active = () => ALL.filter(p => key(p));
  const any = () => active().length > 0;
  const jget = (k, d) => { try { const v = JSON.parse(LS.get(k, 'null')); return v == null ? d : v; } catch { return d; } };
  const cfg = p => { const c = jget(p.lsCfg, {}); return { base: (LS.get(p.lsBase) || p.bases[0]).replace(/\/+$/, ''), search: c.search || '', prof: c.prof || '', auth: c.auth || '' }; };
  const setCfg = (p, o) => LS.set(p.lsCfg, JSON.stringify({ ...jget(p.lsCfg, {}), ...o }));

  // ---------- الاتصال: Bearer ثم X-API-Key (تُحفظ الصيغة الصالحة) ----------
  async function rawCall(p, base, path, k) {
    const c = cfg(p), order = c.auth ? [c.auth] : ['bearer', 'xkey']; let last = null;
    for (const sc of order) {
      const h = { Accept: 'application/json' }; if (sc === 'bearer') h.Authorization = 'Bearer ' + k; else h['X-API-Key'] = k;
      const r = await fetch(base + path, { headers: h }); last = { r, sc };
      if (r.status !== 401 && r.status !== 403) break;
    }
    return last;
  }
  async function call(p, path) {
    const k = key(p); if (!k) throw E(401);
    const { r, sc } = await rawCall(p, cfg(p).base, path, k);
    if (r.status === 401 || r.status === 403) throw E(r.status);
    if (r.ok && !cfg(p).auth) setCfg(p, { auth: sc });
    if (!r.ok) throw E(r.status);
    return r.json();
  }

  // ---------- تحويل الاستجابة (متساهل مع اختلاف أسماء الحقول) ----------
  const arrOf = (j, d = 0) => { if (Array.isArray(j)) return j; if (!j || typeof j !== 'object' || d > 2) return [];
    for (const k of ['data', 'results', 'items', 'profiles', 'users', 'creators', 'list', 'response']) { const v = j[k]; if (Array.isArray(v)) return v; if (v && typeof v === 'object') { const r = arrOf(v, d + 1); if (r.length) return r; } } return []; };
  const pick = (o, ks) => { for (const k of ks) { const v = k.split('.').reduce((a, c) => (a == null ? a : a[c]), o); if (v != null && v !== '' && typeof v !== 'object') return v; } return ''; };
  const https = u => (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : '';
  const normG = g => { g = String(g || '').toLowerCase(); return /^(f|female|woman|girl|أنثى)/.test(g) ? 'female' : (/^(m|male|man|boy)/.test(g) ? 'male' : ''); };
  function mapX(p, x) {
    if (x && x.data && !Array.isArray(x.data) && typeof x.data === 'object') x = x.data;
    const u = String(pick(x, ['username', 'handle', 'user_name', 'userName', 'slug', 'account']) || '').replace(/^@/, '').trim();
    const name = String(pick(x, ['display_name', 'displayName', 'name', 'full_name']) || u).trim();
    const birth = (String(pick(x, ['birthday', 'birth_date', 'birthDate', 'dob']) || '').match(/^\d{4}-\d{2}-\d{2}/) || [''])[0];
    const img = https(pick(x, ['avatar', 'avatar_url', 'avatarUrl', 'profile_picture', 'profilePicture', 'avatar.url', 'avatar.location', 'image', 'photo']));
    const hd = https(pick(x, ['header', 'header_url', 'headerUrl', 'banner', 'banner.url', 'cover', 'cover_url']));
    return { src: p.name, vx: p.id, [p.idKey]: u, id: u, name, aliases: '', country: String(pick(x, ['country', 'nationality']) || ''), birth, birthRaw: birth,
      gender: normG(pick(x, ['gender', 'sex'])), img, imgs: [img, hd].filter(Boolean), urls: u ? [p.home + u] : [],
      px: { p: p.id, u, subs: +pick(x, ['subscribers_count', 'subscribersCount', 'followers_count', 'followers', 'followCount']) || 0, price: +pick(x, ['subscribe_price', 'subscription_price', 'subscribePrice']) || 0 } };
  }
  async function search(p, q) { const c = cfg(p); const j = await call(p, (c.search || p.sg[0]).replace('{q}', encodeURIComponent(q))); return arrOf(j).map(x => mapX(p, x)).filter(m => m.id && m.name && adultOk(m)); }

  // ---------- فحص تلقائي: يجرّب العناوين والمسارات المحتملة ويحفظ ما يعمل ----------
  const cut = (v, d = 0) => { if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) + '…' : v; if (Array.isArray(v)) return d > 3 ? '[…]' : v.slice(0, 2).map(x => cut(x, d + 1)); if (v && typeof v === 'object') { if (d > 3) return '{…}'; const r = {}; Object.keys(v).slice(0, 30).forEach(k => r[k] = cut(v[k], d + 1)); return r; } return v; };
  async function detect(p, q, out) {
    const k = key(p), c = cfg(p); if (!k) { out('الصق المفتاح أولًا'); return; } if (!q) { out('اكتب اسمًا للتجربة'); return; }
    const bases = uniq([c.base, ...p.bases]); let hit = null, first = null; const log = []; out(`جارٍ الفحص (${p.name})…`);
    outer: for (const b of bases) for (const sp of uniq([c.search, ...p.sg])) {
      let res; try { res = await rawCall(p, b, sp.replace('{q}', encodeURIComponent(q)), k); } catch (e) { log.push(`ERR ${b}${sp}  تعذّر الاتصال (CORS أو العنوان خطأ)`); break; }
      const st = res.r.status; let j = null, body = ''; try { body = (await res.r.clone().text()).slice(0, 160).replace(/\s+/g, ' '); j = JSON.parse(body.length < 160 ? body : await res.r.clone().text()); } catch {}
      log.push(`${st} ${b}${sp} [${res.sc}] ${res.r.ok ? '' : body}`);
      if (res.r.ok && j && arrOf(j).length) { hit = { b, sp, sc: res.sc, j }; break outer; }
      if (res.r.ok && j && !first) first = { b, sp, j };
    }
    if (!hit) { out('لم أجد مسار بحث يعمل. نتيجة كل تجربة (الحالة الرابط [المصادقة] رد الخادم):\n' + log.join('\n') + (first ? `\nاستجابة بلا نتائج من ${first.b}${first.sp}:\n` + JSON.stringify(cut(first.j), null, 1) : '\nانسخ عنوان الـAPI ومسار البحث من صفحة التوثيق عندك إلى «إعدادات متقدمة».')); return; }
    LS.set(p.lsBase, hit.b); setCfg(p, { search: hit.sp, auth: hit.sc });
    const m0 = mapX(p, arrOf(hit.j)[0]); let t = `✓ البحث يعمل\n${hit.b}${hit.sp}\nالمصادقة: ${hit.sc === 'bearer' ? 'Authorization: Bearer' : 'X-API-Key'}\nأول نتيجة: ${m0.name} (@${m0.id})\n\n` + JSON.stringify(cut(arrOf(hit.j)[0]), null, 1);
    if (m0.id) for (const pp of uniq([cfg(p).prof, ...p.pg])) {
      try { const r = await rawCall(p, hit.b, pp.replace('{id}', encodeURIComponent(m0.id)), k); const j2 = r.r.ok ? await r.r.json() : null; if (j2 && pick(j2.data || j2, ['username', 'name', 'display_name', 'displayName'])) { setCfg(p, { prof: pp }); t += `\n\n✓ مسار الملف: ${pp}`; break; } } catch {}
    }
    out(t);
  }

  // ---------- الإعدادات (واجهة ثابتة في index.html) ----------
  function bindSettings() {
    ALL.forEach(p => { const I = s => $$('vx' + p.id + '_' + s); if (!I('key')) return;
      const fill = () => { I('key').value = key(p); const c = cfg(p); I('base').value = LS.get(p.lsBase); I('search').value = c.search; I('prof').value = c.prof; I('out').value = ''; };
      const save = () => { LS.set(p.lsKey, I('key').value.trim()); const b = I('base').value.trim().replace(/\/+$/, ''); if (b) LS.set(p.lsBase, b); else LS.del(p.lsBase); setCfg(p, { search: I('search').value.trim(), prof: I('prof').value.trim() }); };
      $$('bSet').addEventListener('click', fill); $$('kSave').addEventListener('click', save);
      I('go').onclick = async () => { save(); const o = I('out'); try { await detect(p, I('q').value.trim(), t => { o.value = t; }); } catch (e) { o.value = 'تعذّر الفحص: ' + (e && e.message || ''); } };
      I('copy').onclick = async () => { try { await navigator.clipboard.writeText(I('out').value); toast('تم النسخ'); } catch { I('out').select(); toast('حدّد النص وانسخه'); } };
    });
  }

  // ---------- نموذج إضافة/تعديل ممثلة: نفس سلوك StashDB (يملأ الفارغ فقط) ----------
  const formHtml = () => ALL.map(p => `<details class="dt"><summary>تعبئة من ${p.name} (اختياري)</summary>
    <label style="margin-top:10px">اكتب الاسم ثم اختر الحساب الصحيح. يملأ الحقول الفارغة فقط، ويضيف رابط الحساب والصورة دون تكرار</label>
    <div style="display:flex;gap:8px"><input class="in" id="vx${p.id}_fq" placeholder="اسم الممثلة أو اسم المستخدم" dir="ltr"><button type="button" class="btn gold" id="vx${p.id}_fgo">بحث</button></div>
    <div id="vx${p.id}_fmsg" class="src" style="margin-top:6px"></div><div id="vx${p.id}_fres" style="display:grid;gap:8px;margin-top:8px"></div></details>`).join('');
  function bindForm(cx) {
    ALL.forEach(p => { const I = s => $$('vx' + p.id + '_' + s); if (!I('fgo')) return;
      const pick1 = async m => {
        if (!adultOk(m)) { await askNote('عمر هذا السجل أقل من 18 أو غير مؤكد، لا يمكن إضافته.'); return; }
        cx.setId(p.idKey, m.id); cx.used(p.name);
        cx.set('fName', m.name); cx.set('fCo', m.country); cx.set('fBi', m.birth);
        const a = { p: p.plat, v: m.id }; let na = 0; if (!cx.accs.some(x => x.p === p.plat && String(x.v || '').toLowerCase().replace(/\/+$/, '').split('/').pop().replace(/^@/, '') === m.id.toLowerCase())) { cx.accs.push(a); na++; cx.drawAccs(); }
        I('fres').innerHTML = ''; I('fmsg').textContent = `تمت التعبئة من ${p.name} (الحقول الفارغة فقط)` + (na ? ' · أُضيف الحساب' : '') + '. راجع البيانات قبل الحفظ.';
        cx.resetFail(); let ok = 0; const list = m.imgs.filter(u => !cx.srcImgs.includes(u)); for (const u of list) if (await cx.addImg(u)) ok++;
        if (!ok && list.length) toast(`تعذّر تنزيل صور ${p.name}. ارفع صورها يدويًا`);
      };
      I('fgo').onclick = async () => { const q = I('fq').value.trim(); if (!q) return;
        if (!key(p)) { I('fmsg').textContent = `لا يوجد مفتاح ${p.name}. أضفه من الإعدادات ثم أعد المحاولة.`; return; }
        I('fmsg').textContent = 'جارٍ البحث…'; I('fres').innerHTML = '';
        try { const res = (await search(p, q)).slice(0, 10); if (!res.length) { I('fmsg').textContent = 'لا نتائج.'; return; }
          I('fmsg').textContent = 'اختر الحساب الصحيح:'; I('fres').innerHTML = res.map(rcRow).join(''); I('fres').onclick = e => { const c = e.target.closest('.rc'); if (c) pick1(res[+c.dataset.n]); };
        } catch (e) { I('fmsg').textContent = e && (e.status === 401 || e.status === 403) ? `مفتاح ${p.name} غير صالح. تأكد منه في الإعدادات.` : `تعذّر الاتصال بـ ${p.name} (${e && e.status ? 'رمز ' + e.status : 'شبكة'}). جرّب «فحص تلقائي» في الإعدادات. الإدخال اليدوي يعمل دائمًا.`; } };
      I('fq').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); I('fgo').click(); } };
    });
  }

  // ---------- الاقتراحات الذكية ----------
  // 1) اكتشاف أسماء من المنصتين بمصطلحات من بصمة ذوقك (استوديوهات/وسوم)
  async function gather(P, round, progress) {
    const out = [], terms = uniq([...(P.cat.studio ? P.cat.studio.top : []).slice(0, 2).map(x => x[0]), ...(P.cat.tag ? P.cat.tag.top : []).slice(0, 2).map(x => x[0])]);
    if (!terms.length) return out;
    if (!LS.get('vkte_stash') && !LS.get('vkte_key')) progress('تنبيه: التحقق من العمر والجنس يحتاج مفتاح StashDB أو ThePornDB');
    for (const p of active()) { const t = terms.slice(round % 2, (round % 2) + 3);
      for (const term of t) { progress(`${p.name}: ${term}…`);
        try { (await search(p, term)).forEach(m => { m.how = 'tag'; out.push(m); }); } catch (e) { if (e && (e.status === 401 || e.status === 403)) break; } await sleep(150); } }
    return out;
  }
  const confirmed = (p, c, urls) => { const u = String(c[p.idKey] || '').toLowerCase(); return !!u && (urls || []).some(x => { try { const h = new URL(x); return h.hostname.replace(/^www\./, '').endsWith(p.host) && (h.pathname.split('/').filter(Boolean)[0] || '').toLowerCase() === u; } catch { return false; } }); };
  // 2) تحقق: الجنس والعمر من القاعدة، وربط الحساب فقط إذا أكّدته القاعدة
  async function verify(c) {
    const p = PV[c.vx]; if (!p) return false; const keep = { [p.idKey]: c[p.idKey], px: c.px }, img = c.img;
    try {
      let x = null;
      if (LS.get('vkte_stash')) { const m = await findStash(c.name, true); if (m) { const caps = await sdCaps(); const d = await sdQ(`query($id:ID!){findPerformer(id:$id){${SD_FIELDS[caps.fl]}}}`, { id: m.id }); if (d.findPerformer) x = mapSx(d.findPerformer); } }
      if (!x && LS.get('vkte_key')) { const m = await findPerformer(c.name, true); if (m) x = await pdbDetail(m.id); }
      if (!x || !x.gender || !adultOk(x)) return false;
      Object.assign(c, x, { how: c.how, vx: c.vx }); c.img = x.img || img;
      if (confirmed(p, keep, x.urls || [])) { c[p.idKey] = keep[p.idKey]; c.px = keep.px; c.urls = uniq([...(x.urls || []), p.home + keep[p.idKey]]); }
      else { delete c[p.idKey]; delete c.px; c.urls = x.urls || []; }
      return true;
    } catch (e) { return false; }
  }
  // 3) أسباب إضافية + ربط عند الإضافة للمكتبة
  const reasons = c => ALL.filter(p => c[p.idKey]).map(p => `لها حساب مؤكّد على ${p.name}` + (c.px && c.px.p === p.id && c.px.subs ? ` (~${c.px.subs} مشترك)` : ''));
  function applyToRec(rec, cand) { ALL.forEach(p => { const u = cand[p.idKey]; if (!u) return; rec[p.idKey] = u; rec.accounts = rec.accounts || []; if (!rec.accounts.some(a => a.p === p.plat)) rec.accounts.push({ p: p.plat, v: u }); }); }
  const links = c => ALL.filter(p => c[p.idKey]).map(p => [p.name, p.home + encodeURIComponent(c[p.idKey])]);

  const init = () => { try { bindSettings(); } catch (e) { console.error('VX settings', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { any, active, key, search, detect, formHtml, bindForm, gather, verify, reasons, applyToRec, links, PV };
})();

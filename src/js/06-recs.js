/* ---- 06-recs.js ---- */
/* ===== recs.js — واجهة الاقتراحات الذكية (v16) =====
   تعتمد على دوال app.js (buildTasteProfile, recRank, addRecToLibrary ...) ولا تغيّر منطق الجلب من الـ API.
   الجديد: عرض فوري من الكاش، فلاتر وفرز، وضع بطاقات بالسحب، حفظ لاحقًا، تراجع عن الاستبعاد، أسباب الاستبعاد،
   تفصيل التوافق، تصفح متتالٍ في المعاينة، شاشة مستقلة (#ovRecs) وشريط وصول من الرئيسية. */
(function () {
  'use strict';
  const $$ = id => document.getElementById(id);
  const SAVED_KEY = 'vkte_rec_saved', UI_KEY = 'vkte_rec_ui', SEEN_KEY = 'vkte_rec_seen';
  const jget = (k, d) => { try { const v = JSON.parse(LS.get(k, 'null')); return v == null ? d : v; } catch { return d; } };
  const jset = (k, v) => LS.set(k, JSON.stringify(v));
  const ui = Object.assign({ view: 'all', sort: 'match', mode: 'grid' }, jget(UI_KEY, {}));
  const saveUi = () => jset(UI_KEY, ui);
  const RS = { cc: '', want: 24, busy: false, msg: '', err: '', hide: new Set(), pend: null, roots: new Set(), deck: 0, skipped: new Set(), P: null };
  let saved = jget(SAVED_KEY, []);
  const saveSaved = () => jset(SAVED_KEY, saved.slice(-200));
  const hasKeys = () => !!(LS.get('vkte_key') || LS.get('vkte_stash') || vxAny());
  const kOf = c => c.k || norm(c.name);
  const flag = cc => (cc && /^[A-Z]{2}$/.test(cc)) ? String.fromCodePoint(...[...cc].map(ch => 127397 + ch.charCodeAt(0))) : '';
  const ago = t => { if (!t) return 'لم يُحدَّث بعد'; const m = Math.round((Date.now() - t) / 6e4); if (m < 1) return 'الآن'; if (m < 60) return 'منذ ' + m + ' دقيقة'; const h = Math.round(m / 60); if (h < 24) return 'منذ ' + h + ' ساعة'; return 'منذ ' + Math.round(h / 24) + ' يوم'; };
  const FKEYS = ['country', 'eth', 'hair', 'eyes', 'cup', 'age', 'height', 'exp', 'studio', 'tag'];

  // ---------- مصادر البيانات ----------
  function findCand(k) {
    return (_recCache.list || []).find(c => kOf(c) === k) || saved.find(c => kOf(c) === k) || (_recPool.list || []).find(c => c.k === k) || null;
  }
  function baseList() {
    const idx = libIndex();
    if (ui.view === 'saved') return saved.filter(c => !idx.names.has(norm(c.name)));
    let l = (_recCache.list || []).filter(c => !RS.hide.has(kOf(c)));
    if (ui.view === 'explore') l = l.filter(c => c.explore);
    return l;
  }
  function visible() {
    let l = baseList();
    if (RS.cc) l = l.filter(c => (c.cc || '') === RS.cc);
    const ag = c => (c.age != null ? c.age : candAge(c)) || 99;
    if (ui.sort === 'new') l = l.slice().sort((a, b) => (b.t || 0) - (a.t || 0));
    else if (ui.sort === 'young') l = l.slice().sort((a, b) => ag(a) - ag(b));
    return l;
  }
  function newCount() { const seen = +LS.get(SEEN_KEY, '0') || 0; return (_recCache.list || []).filter(c => (c.t || 0) > seen).length; }

  // ---------- عناصر العرض ----------
  function chipsOf(c) {
    const f = candFeats(c), fs = c.fs || {}, out = [], add = (k, t) => { if ((fs[k] || 0) >= 0.55) out.push(t); };
    if (f.country) add('country', (flag(f.country) + ' ' + ctryName(f.country)).trim());
    if (f.age != null) add('age', '🎂 ' + f.age + ' سنة');
    if (f.hair) add('hair', '💇 ' + (HAIR_AR[f.hair] || f.hair));
    if (f.eth) add('eth', '✨ ' + (ETH_AR[f.eth] || f.eth));
    if (f.eyes) add('eyes', '👁 ' + (EYE_AR[f.eyes] || f.eyes));
    if (f.height) add('height', '📏 ' + f.height + ' سم');
    add('studio', '🎬 استوديوهات تحبها'); add('tag', '🏷 وسوم تفضّلها');
    if ((fs.co || 0) > 0) out.push('👥 مشتركة مع مكتبتك');
    return out.slice(0, 4);
  }
  function barsOf(c) {
    const fs = c.fs || {};
    const rows = FKEYS.filter(k => fs[k] != null).map(k => [k, Math.max(0, Math.min(1, fs[k]))]).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return '';
    return '<div class="rc-bars">' + rows.map(([k, v]) => `<div class="rb"><span>${esc(FEAT_AR[k] || k)}</span><i><u style="width:${Math.max(4, Math.round(v * 100))}%"></u></i><b>${Math.round(v * 100)}%</b></div>`).join('') + '</div>';
  }
  const matchOf = c => c.matchPct || Math.max(40, Math.min(98, Math.round(40 + (c.raw || 0) * 60)));
  const photoHtml = c => c.img
    ? `<i class="rc-bg" style="background-image:url('${esc(c.img)}')"></i><img src="${esc(c.img)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" alt="" onerror="this.remove()">`
    : '<div class="rc-ph0">♡</div>';
  const ring = m => `<span class="ring" style="--p:${m}"><b>${m}</b></span>`;
  const isSaved = k => saved.some(s => kOf(s) === k);
  const meta = c => { const a = c.age != null ? c.age : candAge(c); return [(flag(c.cc) + ' ' + (c.cc ? ctryName(c.cc) : (c.country || ''))).trim(), a ? a + ' سنة' : ''].filter(Boolean).join(' · '); };

  function cardHtml(c, n) {
    const k = kOf(c), m = matchOf(c), sv = isSaved(k);
    return `<article class="rcd" data-k="${esc(k)}" style="--i:${Math.min(n, 8)}">
      <div class="rc-ph" data-act="open" data-k="${esc(k)}">${photoHtml(c)}${ring(m)}<span class="rc-src">${esc(c.src || 'API')}</span>${c.explore ? '<span class="rc-exp">استكشاف</span>' : ''}${sv ? '<span class="rc-sv">🔖</span>' : ''}</div>
      <div class="rc-b">
        <h4 data-act="open" data-k="${esc(k)}">${esc(c.name)}</h4>
        <div class="rc-meta">${esc(meta(c))}</div>
        <div class="rc-chips">${chipsOf(c).map(t => `<span>${esc(t)}</span>`).join('') || '<span>توافق جزئي مع ذوقك</span>'}</div>
        <details class="rc-more"><summary>لماذا هذا الاقتراح؟</summary>${(c.reasons || []).slice(0, 4).map(r => `<p>• ${esc(r)}</p>`).join('')}${barsOf(c)}</details>
        <div class="rc-act">
          <button type="button" class="rc-add" data-act="add" data-k="${esc(k)}">إضافة ★</button>
          <button type="button" class="rc-ic ${sv ? 'on' : ''}" data-act="save" data-k="${esc(k)}" aria-label="حفظ لاحقًا" title="حفظ لاحقًا">🔖</button>
          <button type="button" class="rc-ic rc-no" data-act="ign" data-k="${esc(k)}" aria-label="ليست ذوقي" title="ليست ذوقي">✕</button>
        </div>
      </div></article>`;
  }
  function deckHtml(l) {
    const rest = l.filter(c => !RS.skipped.has(kOf(c)));
    const c = rest[0] || null;
    if (!c) return `<div class="rx-empty"><b>انتهت البطاقات 🎉</b><p>${l.length ? 'تخطّيت كل البطاقات الحالية.' : 'لا اقتراحات هنا.'}</p>${l.length ? '<button type="button" class="btn" data-act="deckreset">أعد عرض المتخطّاة</button>' : ''}</div>`;
    const k = kOf(c), m = matchOf(c), sv = isSaved(k);
    return `<div class="dk"><div class="dk-n">${l.length - rest.length + 1} / ${l.length}</div>
      <div class="dk-card" data-k="${esc(k)}"><div class="dk-ph" data-act="open" data-k="${esc(k)}">${photoHtml(c)}${ring(m)}<span class="rc-src">${esc(c.src || 'API')}</span>${c.explore ? '<span class="rc-exp">استكشاف</span>' : ''}<em class="dk-l">تخطّي</em><em class="dk-r">إضافة</em></div>
        <div class="dk-b"><h3>${esc(c.name)}</h3><div class="rc-meta">${esc(meta(c))}</div>
        <div class="rc-chips">${chipsOf(c).map(t => `<span>${esc(t)}</span>`).join('')}</div>
        <p class="dk-why">${esc((c.reasons || [])[0] || '')}</p></div></div>
      <div class="dk-act"><button type="button" class="dk-b1 no" data-act="ign" data-k="${esc(k)}" aria-label="استبعاد">✕</button><button type="button" class="dk-b1" data-act="skip" data-k="${esc(k)}" aria-label="تخطّي">⏭</button><button type="button" class="dk-b1 ${sv ? 'on' : ''}" data-act="save" data-k="${esc(k)}" aria-label="حفظ">🔖</button><button type="button" class="dk-b1 yes" data-act="add" data-k="${esc(k)}" aria-label="إضافة">★</button></div>
      <div class="src" style="text-align:center">اسحب يمينًا للإضافة · يسارًا للتخطّي</div></div>`;
  }

  // ---------- بناء الواجهة ----------
  function skeleton(root, standalone) {
    root.innerHTML = `<div class="rx">
      ${standalone ? `<div class="rx-top"><h2>💡 الاقتراحات الذكية</h2><button class="ib" data-act="close" aria-label="إغلاق">${icon('x')}</button></div>` : ''}
      <div class="rx-stat"></div><div class="rx-prof"></div><div class="rx-bar"></div><div class="rx-cc"></div><div class="rx-body"></div><div class="rx-more"></div></div>`;
  }
  function paintStat(root) {
    const el = root.querySelector('.rx-stat'); if (!el) return;
    if (RS.busy) el.innerHTML = `<div class="rx-st busy"><span class="spin"></span><span>${esc(RS.msg || 'جارٍ التحليل…')}</span></div>`;
    else if (RS.err) el.innerHTML = `<div class="rx-st err"><span>⚠ ${esc(RS.err)}</span><button type="button" class="btn" data-act="refresh">إعادة المحاولة</button></div>`;
    else el.innerHTML = `<div class="rx-st"><span>آخر تحديث: ${ago(_recCache.at)}${!navigator.onLine ? ' · بدون اتصال' : ''}</span><button type="button" class="btn gold" data-act="refresh" ${RS.busy ? 'disabled' : ''}>${icon('refresh')} تجديد</button></div>`;
  }
  function paintProf(root) {
    const el = root.querySelector('.rx-prof'); if (!el) return;
    const P = RS.P; if (!P) { el.innerHTML = ''; return; }
    el.innerHTML = `<details class="rx-pd"><summary>🎯 بصمة ذوقك · ثقة ${Math.round(P.conf * 100)}%</summary>${recProfileHtml(P)}</details>`;
  }
  function paintBar(root) {
    const el = root.querySelector('.rx-bar'); if (!el) return;
    const nAll = (_recCache.list || []).filter(c => !RS.hide.has(kOf(c))).length, nExp = (_recCache.list || []).filter(c => c.explore && !RS.hide.has(kOf(c))).length;
    const tab = (v, t, n) => `<button type="button" class="rx-t ${ui.view === v ? 'on' : ''}" data-v="${v}">${t}<em>${n}</em></button>`;
    el.innerHTML = `<div class="rx-tabs">${tab('all', 'الكل', nAll)}${tab('explore', 'استكشاف', nExp)}${tab('saved', '🔖 المحفوظة', saved.length)}</div>
      <div class="rx-tools"><select class="sel" data-sort aria-label="الترتيب"><option value="match" ${ui.sort === 'match' ? 'selected' : ''}>الأعلى توافقًا</option><option value="new" ${ui.sort === 'new' ? 'selected' : ''}>الأحدث اكتشافًا</option><option value="young" ${ui.sort === 'young' ? 'selected' : ''}>الأصغر عمرًا</option></select>
      <div class="rx-seg"><button type="button" class="${ui.mode === 'grid' ? 'on' : ''}" data-mode="grid" aria-label="شبكة">▦</button><button type="button" class="${ui.mode === 'deck' ? 'on' : ''}" data-mode="deck" aria-label="بطاقات">🂠</button></div></div>`;
  }
  function paintCC(root, l0) {
    const el = root.querySelector('.rx-cc'); if (!el) return;
    if (ui.mode === 'deck') { el.innerHTML = ''; return; }
    const cnt = {}; l0.forEach(c => { if (c.cc) cnt[c.cc] = (cnt[c.cc] || 0) + 1; });
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 7);
    if (top.length < 2) { el.innerHTML = ''; if (RS.cc) RS.cc = ''; return; }
    el.innerHTML = `<button type="button" class="chip ${RS.cc ? '' : 'on'}" data-cc="">الكل</button>` + top.map(([cc, n]) => `<button type="button" class="chip ${RS.cc === cc ? 'on' : ''}" data-cc="${cc}">${flag(cc)} ${esc(ctryName(cc))} <small>${n}</small></button>`).join('');
  }
  function paintBody(root) {
    const el = root.querySelector('.rx-body'), more = root.querySelector('.rx-more'); if (!el) return;
    if (!hasKeys()) {
      el.innerHTML = `<div class="rx-empty"><b>مفاتيح API مطلوبة للاقتراحات</b><p>تُستخرج الاقتراحات من ThePornDB و StashDB و OnlyFansAPI و Fansly API للإناث البالغات فقط. أضف مفتاح أحدها في الإعدادات (التحقق من العمر والجنس يتم عبر StashDB/ThePornDB).</p><button type="button" class="btn gold" id="recGoSet2">${icon('set')} فتح الإعدادات</button></div>`; more.innerHTML = ''; return;
    }
    const l0 = baseList(); paintCC(root, l0);
    const l = visible();
    if (RS.busy && !l.length) { el.innerHTML = '<div class="rx-sk">' + '<i></i>'.repeat(4) + '</div>'; more.innerHTML = ''; return; }
    if (!l.length) {
      const msg = ui.view === 'saved' ? 'لا توجد اقتراحات محفوظة. اضغط 🔖 على أي بطاقة لحفظها لوقت لاحق.' : (RS.cc ? 'لا توجد اقتراحات لهذه الدولة.' : (RS.P ? 'لا توجد اقتراحات حاليًا. اضغط «تجديد» لجلب دفعة جديدة.' : 'أضف وقيّم عددًا أكبر من الممثلات حتى يستطيع النظام بناء بصمة ذوقك.'));
      el.innerHTML = `<div class="rx-empty"><b>لا شيء هنا بعد</b><p>${msg}</p></div>`; more.innerHTML = ''; return;
    }
    if (ui.mode === 'deck') { el.innerHTML = deckHtml(l); more.innerHTML = ''; bindDeck(root); return; }
    el.innerHTML = `<div class="rx-grid">${l.map(cardHtml).join('')}</div>`;
    const canMore = ui.view !== 'saved' && !RS.cc && (_recPool.list || []).length > (_recCache.list || []).length && RS.want < 96;
    more.innerHTML = canMore ? '<button type="button" class="btn" data-act="more">عرض المزيد ↓</button>' : '';
  }
  function paintAll(root) { paintStat(root); paintProf(root); paintBar(root); paintBody(root); }
  function repaintAll() { RS.roots.forEach(r => { if (!r.isConnected) { RS.roots.delete(r); return; } paintBar(r); paintStat(r); paintBody(r); }); updBar(); }

  // ---------- تعلّم وإجراءات ----------
  function localRank() {
    RS.P = buildTasteProfile();
    if (RS.P && (_recPool.list || []).length) { const list = recRank(RS.P, RS.want); _recCache = { list, at: _recCache.at || Date.now() }; }
  }
  function ignoreCommit(cand, keys) {
    const name = cand.name;
    if (!_recIgnored.includes(name)) { _recIgnored.push(name); saveRecIgnored(); }
    recLearn(cand, false, 1);
    if (keys && keys.length) { learnFrom(keys, null, null, false, 1.2); saveRecFeedback(); }
    _recPool.list = _recPool.list.filter(x => x.k !== norm(name)); saveRecPool();
    _recCache.list = (_recCache.list || []).filter(x => norm(x.name) !== norm(name)); saveRecCache();
    saved = saved.filter(s => norm(s.name) !== norm(name)); saveSaved();
  }
  function flushPend() { const p = RS.pend; if (!p) return; clearTimeout(p.t); RS.pend = null; ignoreCommit(p.c, p.keys); hideUndo(); }
  function undoBar() {
    let u = $$('recUndo'); if (!u) { u = document.createElement('div'); u.id = 'recUndo'; document.body.appendChild(u);
      u.addEventListener('click', e => {
        const b = e.target.closest('[data-u]'); if (!b || !RS.pend) return;
        if (b.dataset.u === 'undo') { const p = RS.pend; clearTimeout(p.t); RS.pend = null; RS.hide.delete(kOf(p.c)); hideUndo(); repaintAll(); }
        else { const p = RS.pend; if (p.keys.indexOf(b.dataset.u) < 0) p.keys.push(b.dataset.u); b.classList.add('on'); clearTimeout(p.t); p.t = setTimeout(flushPend, 3500); }
      }); }
    return u;
  }
  function hideUndo() { const u = $$('recUndo'); if (u) u.classList.remove('show'); }
  function reasonChips(c) {
    const f = candFeats(c), out = [];
    if (f.age != null) out.push(['age:' + recBucket('age', f.age), 'العمر']);
    if (f.country) out.push(['country:' + f.country, 'الدولة']);
    if (f.eth) out.push(['eth:' + f.eth, 'المظهر']);
    if (f.hair) out.push(['hair:' + f.hair, 'الشعر']);
    return out;
  }
  function doIgnore(c) {
    flushPend(); const k = kOf(c); RS.hide.add(k);
    const u = undoBar();
    u.innerHTML = `<div class="ru-r"><span>استُبعدت «${esc(c.name)}»</span><button type="button" data-u="undo">تراجع</button></div>` +
      (reasonChips(c).length ? `<div class="ru-w"><small>ما السبب؟ (اختياري)</small>${reasonChips(c).map(([key, t]) => `<button type="button" data-u="${esc(key)}">${t}</button>`).join('')}</div>` : '');
    u.classList.add('show');
    RS.pend = { c, keys: [], t: setTimeout(flushPend, 6500) };
    repaintAll();
  }
  function doSave(c) {
    const k = kOf(c), i = saved.findIndex(s => kOf(s) === k);
    if (i >= 0) { saved.splice(i, 1); toast('أُزيلت من المحفوظة'); }
    else { const o = Object.assign({}, c, { savedAt: Date.now() }); saved.push(o); toast('حُفظت لوقت لاحق 🔖'); }
    saveSaved(); repaintAll();
  }
  function doAdd(c) {
    const k = kOf(c); RS.hide.add(k); repaintAll();
    Promise.resolve(addRecToLibrary(c)).catch(() => { RS.hide.delete(k); repaintAll(); toast('تعذّرت الإضافة'); });
    saved = saved.filter(s => kOf(s) !== k); saveSaved();
  }
  async function refresh(force) {
    if (recsLoading || !hasKeys()) return;
    if (!navigator.onLine) { RS.err = 'لا يوجد اتصال بالإنترنت. عُرضت آخر اقتراحات محفوظة.'; repaintAll(); return; }
    recsLoading = true; RS.busy = true; RS.err = ''; RS.msg = 'بدء التحليل…'; RS.want = 24; repaintAll();
    try { await fetchApiRecommendations(!!force, t => { RS.msg = t; RS.roots.forEach(r => paintStat(r)); }); }
    catch (e) { RS.err = (e && (e.status === 401 || e.status === 403)) ? 'مفتاح API غير صالح. راجع الإعدادات.' : (navigator.onLine ? 'تعذّر الاتصال بالمصادر. عُرضت آخر اقتراحات محفوظة.' : 'لا يوجد اتصال بالإنترنت. عُرضت آخر اقتراحات محفوظة.'); }
    finally { recsLoading = false; RS.busy = false; RS.msg = ''; }
    RS.P = buildTasteProfile(); RS.roots.forEach(r => paintProf(r)); RS.deck = 0; RS.skipped.clear(); repaintAll();
  }
  function act(a, k, root) {
    if (a === 'close') { closeOv('ovRecs'); return; }
    if (a === 'refresh') { toast('جارٍ تجديد الاقتراحات…'); refresh(true); return; }
    if (a === 'more') { RS.want += 24; localRank(); repaintAll(); return; }
    if (a === 'deckreset') { RS.skipped.clear(); repaintAll(); return; }
    const c = findCand(k); if (!c) return;
    if (a === 'open') preview(c); else if (a === 'add') doAdd(c); else if (a === 'save') doSave(c); else if (a === 'ign') doIgnore(c);
    else if (a === 'skip') { RS.skipped.add(k); repaintAll(); }
  }
  function bind(root) {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-act],[data-v],[data-cc],[data-mode],#recGoSet2'); if (!t || !root.contains(t)) return;
      if (t.id === 'recGoSet2') { closeOv('ovRecs'); closeOv('ovStats'); $$('bSet').click(); return; }
      if (t.dataset.v) { ui.view = t.dataset.v; RS.cc = ''; saveUi(); RS.roots.forEach(r => { paintBar(r); paintBody(r); }); return; }
      if (t.dataset.mode) { ui.mode = t.dataset.mode; saveUi(); RS.roots.forEach(r => { paintBar(r); paintBody(r); }); return; }
      if (t.hasAttribute('data-cc')) { RS.cc = t.dataset.cc; RS.roots.forEach(r => paintBody(r)); return; }
      act(t.dataset.act, t.dataset.k, root);
    });
    root.addEventListener('change', e => { const s = e.target.closest('[data-sort]'); if (!s) return; ui.sort = s.value; saveUi(); RS.roots.forEach(r => paintBody(r)); });
  }
  function bindDeck(root) {
    const el = root.querySelector('.dk-card'); if (!el) return; let sx = 0, dx = 0, on = false;
    const k = el.dataset.k;
    el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; on = true; sx = e.clientX; dx = 0; try { el.setPointerCapture(e.pointerId); } catch {} el.style.transition = 'none'; });
    el.addEventListener('pointermove', e => { if (!on) return; dx = e.clientX - sx; el.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`; el.classList.toggle('r', dx > 50); el.classList.toggle('l', dx < -50); });
    const end = () => { if (!on) return; on = false; el.style.transition = 'transform .25s var(--ease),opacity .25s';
      if (Math.abs(dx) > 100) { el.style.transform = `translateX(${dx > 0 ? 130 : -130}%) rotate(${dx > 0 ? 18 : -18}deg)`; el.style.opacity = '0'; const d = dx > 0; setTimeout(() => act(d ? 'add' : 'skip', k, root), 200); }
      else { el.style.transform = ''; el.classList.remove('r', 'l'); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  // ---------- معاينة الممثلة المقترحة ----------
  function preview(c) {
    const l = visible(), i = l.findIndex(x => kOf(x) === kOf(c)), prev = i > 0 ? l[i - 1] : null, next = i >= 0 && i < l.length - 1 ? l[i + 1] : null;
    const k = kOf(c), m = matchOf(c), sv = isSaved(k);
    const links = []; if (c.stashId) links.push(['StashDB', 'https://stashdb.org/performers/' + encodeURIComponent(c.stashId)]);
    if (typeof VX !== 'undefined') VX.links(c).forEach(l => links.push(l));
    (c.urls || []).filter(u => !/(^|\.)(onlyfans|fansly)\.com\//i.test(String(u).replace(/^https?:\/\/(www\.)?/, ''))).slice(0, 4).forEach(u => { try { const h = new URL(u).hostname.replace(/^www\./, ''); links.push([h, u]); } catch {} });
    askShow(`
      <div class="pv-ph">${photoHtml(c)}${ring(m)}<span class="rc-src">${esc(c.src || 'API')}</span></div>
      <h2 style="margin:10px 0 2px;font-size:1.3rem">${esc(c.name)}</h2>
      <div class="rc-meta" style="margin-bottom:8px">${esc(meta(c))}${c.aliases ? ' · ' + esc(c.aliases) : ''}</div>
      <div class="rc-chips" style="margin-bottom:8px">${chipsOf(c).map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <div class="rec-reason" style="margin-bottom:10px"><b>لماذا اقتُرحت؟</b><br>${(c.reasons || ['تطابق معايير مجموعتك']).map(r => '• ' + esc(r)).join('<br>')}</div>
      ${barsOf(c)}
      <div class="pv-links">${links.map(([t, u], n) => `<button type="button" class="chip" data-pl="${n}">${esc(t)} ↗</button>`).join('')}<button type="button" class="chip" id="pvG">Google ↗</button></div>
      <div class="pv-act"><button type="button" class="btn danger" id="pvIgn">✕ استبعاد</button><button type="button" class="btn ${sv ? 'gold' : ''}" id="pvSv">${sv ? '🔖 محفوظة' : '🔖 حفظ'}</button><button type="button" class="btn gold" id="pvAdd">★ إضافة</button></div>
      ${(prev || next) ? `<div class="pv-nav"><button type="button" class="btn" id="pvNext" ${next ? '' : 'disabled'}>‹ التالية</button><span class="src">${i + 1} / ${l.length}</span><button type="button" class="btn" id="pvPrev" ${prev ? '' : 'disabled'}>السابقة ›</button></div>` : ''}
    `, (m2, done) => {
      m2.classList.add('wide'); m2.classList.toggle('blur', document.body.classList.contains('blur'));
      m2.querySelectorAll('[data-pl]').forEach(b => { b.onclick = () => openExt(links[+b.dataset.pl][1]); });
      $$('pvG').onclick = () => openExt('https://www.google.com/search?q=' + encodeURIComponent(c.name));
      $$('pvIgn').onclick = () => { done(true); doIgnore(c); };
      $$('pvAdd').onclick = () => { done(true); doAdd(c); };
      $$('pvSv').onclick = () => { doSave(c); done(true); };
      if (next) $$('pvNext').onclick = () => { done(true); setTimeout(() => preview(next), 260); };
      if (prev) $$('pvPrev').onclick = () => { done(true); setTimeout(() => preview(prev), 260); };
    });
  }

  // ---------- نقاط الدخول ----------
  function mount(root, standalone) {
    skeleton(root, standalone); RS.roots.add(root); bind(root);
    if (hasKeys()) { try { localRank(); } catch (e) { console.warn('rec rank', e); } }
    paintAll(root);
    if (!hasKeys()) return;
    const stale = Date.now() - (_recCache.at || 0) > 12 * 36e5;
    if (!(_recCache.list && _recCache.list.length) || stale) refresh(false);
    else { setTimeout(() => LS.set(SEEN_KEY, String(Date.now())), 1200); }
  }
  function updBar() {
    const b = $$('recBar'); if (!b) return;
    const on = hasKeys() && items.length > 0; b.hidden = !on; if (!on) return;
    const n = newCount(), total = (_recCache.list || []).length;
    $$('recBarSub').textContent = total ? (n ? n + ' اقتراح جديد بانتظارك' : total + ' اقتراح · ' + ago(_recCache.at)) : 'اكتشف ممثلات جديدات تناسب ذوقك';
    const nn = $$('recBarN'); nn.hidden = !n; nn.textContent = n > 9 ? '9+' : n;
  }
  function openRecs() {
    const m = $$('mRecs'); mount(m, true); $$('ovRecs').classList.add('show'); m.scrollTop = 0;
    LS.set(SEEN_KEY, String(Date.now())); setTimeout(updBar, 300);
  }
  // استبدال دوال app.js بالنسخ الجديدة (الإعلانات في app.js قابلة لإعادة الإسناد)
  drawRecsBody = async function (head, force) {
    $$('mStats').innerHTML = head + '<div class="rec-box" id="recRootTab"></div>';
    if (!$$('ovStats').classList.contains('show')) return;
    mount($$('recRootTab'), false); if (force) refresh(true);
  };
  previewRecPerformer = function (c) { preview(c); };
  window.recsOnChange = function () { repaintAll(); if ($$('ovStats').classList.contains('show') && statsTab === 'overview') drawStatsModal(); };
  window.openRecs = openRecs;
  addEventListener('pagehide', flushPend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushPend(); });
  const rb = $$('recBar'); if (rb) rb.onclick = openRecs;
  setTimeout(updBar, 1500); addEventListener('online', () => RS.roots.forEach(r => paintStat(r)));
})();

;

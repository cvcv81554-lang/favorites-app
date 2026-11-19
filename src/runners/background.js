// مشغّل الخلفية (Capacitor Background Runner) — يعمل والتطبيق مغلق، في بيئة JS معزولة بلا DOM ولا قاعدة التطبيق.
// النظام يقرر التوقيت: iOS (BGAppRefresh) بحسب استخدامك للتطبيق والبطارية، و Android (WorkManager) كل ~12 ساعة تقريبًا.
// ما يفعله فقط: سؤال StashDB الرسمي عن أعمال جديدة لممثلات مفضلتك (قائمة يرسلها التطبيق — بالغات فقط، بوابة +18 طُبّقت قبل الإرسال)،
// حفظ النتائج ليدمجها التطبيق عند فتحه، وإشعار محلي واحد. لا صور، ولا بيانات تُرسل لأي جهة غير StashDB.

const CFG = 'fav_bg_cfg', FOUND = 'fav_bg_found', LAST = 'fav_bg_last';
const getJ = k => { try { const v = CapacitorKV.get(k); return v && v.value ? JSON.parse(v.value) : null; } catch (e) { return null; } };
const setJ = (k, o) => { try { CapacitorKV.set(k, JSON.stringify(o)); } catch (e) {} };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// التطبيق يرسل الإعداد: {key, on, ids:[{s:stashId, n:name}]} (الأسماء للإشعار فقط)
addEventListener('config', (resolve, reject, args) => {
  try {
    const a = args || {};
    const ids = (Array.isArray(a.ids) ? a.ids : []).filter(x => x && typeof x.s === 'string' && /^[0-9a-f-]{36}$/i.test(x.s)).slice(0, 400);
    setJ(CFG, { key: typeof a.key === 'string' ? a.key : '', on: !!a.on, ids });
    resolve({ ok: true, n: ids.length });
  } catch (e) { reject(e); }
});

// التطبيق يجمع ما وُجد عند فتحه ثم يُفرَّغ
addEventListener('collect', (resolve) => {
  const f = getJ(FOUND) || []; setJ(FOUND, []); resolve({ found: f, last: (getJ(LAST) || {}).at || 0 });
});

// المهمة الدورية (اسمها في capacitor.config: event)
addEventListener('checkNew', async (resolve, reject) => {
  try {
    const c = getJ(CFG);
    if (!c || !c.on || !c.key || !c.ids || !c.ids.length) return resolve({ skip: 'off' });
    const st = getJ(LAST) || {}; const now = new Date();
    if (st.at && Date.now() - st.at < 6 * 36e5) return resolve({ skip: 'recent' });
    const since = st.day || ymd(new Date(Date.now() - 3 * 864e5));
    const names = new Map(c.ids.map(x => [x.s, x.n || '']));
    const ids = c.ids.map(x => x.s);
    const query = 'query($ids:[ID!]!,$dt:String!){queryScenes(input:{performers:{value:$ids,modifier:INCLUDES},date:{value:$dt,modifier:GREATER_THAN},page:1,per_page:50}){scenes{id title date release_date studio{name} performers{performer{id}}}}}';
    const r = await fetch('https://stashdb.org/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', ApiKey: c.key }, body: JSON.stringify({ query, variables: { ids, dt: since } }) });
    if (!r.ok) { setJ(LAST, Object.assign(st, { err: r.status, tried: Date.now() })); return resolve({ err: r.status }); }
    const j = await r.json(); const sc = (j && j.data && j.data.queryScenes && j.data.queryScenes.scenes) || [];
    const prev = getJ(FOUND) || []; const seen = new Set(prev.map(x => x.id)); const who = new Set(); let add = 0;
    sc.forEach(s => { if (!s || !s.id || seen.has(s.id)) return; const ps = (s.performers || []).map(p => p && p.performer && p.performer.id).filter(id => names.has(id)); if (!ps.length) return;
      prev.push({ id: s.id, t: String(s.title || '').slice(0, 200), d: String(s.release_date || s.date || '').slice(0, 10), st: String((s.studio && s.studio.name) || '').slice(0, 120), ps }); seen.add(s.id); add++; ps.forEach(id => who.add(names.get(id))); });
    setJ(FOUND, prev.slice(-300)); setJ(LAST, { at: Date.now(), day: ymd(now), n: add });
    // الإشعار عام بلا أسماء ولا عناوين (يظهر على شاشة القفل): التفاصيل داخل التطبيق فقط
    if (add) {
      try { CapacitorNotifications.schedule([{ id: 4200 + (Date.now() % 1000), title: 'المفضلة', body: 'تحديثات جديدة في مكتبتك', scheduleAt: new Date(Date.now() + 2000) }]); } catch (e) {}
    }
    resolve({ added: add });
  } catch (e) { reject(e); }
});

// ===== v35: جدولة التحديث التلقائي (الاستديو + اكتشف) =====
// الحقيقة التقنية: التطبيق WebView (Capacitor)، وجافاسكربت لا تعمل والتطبيق مغلق.
//  - iOS: النظام يوقف التطبيق في الخلفية؛ لا تحديث مستمر ممكن، و BGAppRefresh (إن أُضيف أصليًا) يقرر توقيته النظام.
//  - Android: ممكن عبر WorkManager أصلي فقط (غير مضاف بعد).
// لذلك: «اللحاق» عند الفتح والعودة، بعد هدوء الواجهة، مع احترام نوع الشبكة والبطارية وتوفير البيانات،
// وتجهيز «اكتشف» مسبقًا كي يفتح فورًا بنتائج جاهزة. بوابة +18 تبقى داخل محركي الجلب كما هي (قبل أي طلب).
const Sched=(()=>{
  const KEY='vkte_bg', LOG='vkte_bg_log';
  const mode=()=>{ const m=LS.get(KEY,'wifi'); return ['wifi','any','off'].includes(m)?m:'wifi'; };
  const setMode=m=>{ if(['wifi','any','off'].includes(m)) LS.set(KEY,m); };
  const conn=()=>navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
  /** هل الظروف مناسبة لتحديث تلقائي؟ (اليدوي لا يمر من هنا) */
  async function ok(task){
    const why=await block(); log(task,why||'ok'); return !why; }
  async function block(){
    const m=mode(); if(m==='off') return 'off';
    if(navigator.onLine===false) return 'offline';
    const c=conn();
    if(c){ if(c.saveData) return 'savedata'; if(/(^|-)2g$/.test(c.effectiveType||'')) return 'slow';
      if(m==='wifi'&&c.type&&!['wifi','ethernet','wimax','unknown','none'].includes(c.type)) return 'cellular'; }
    try{ if(navigator.getBattery){ const b=await navigator.getBattery(); if(!b.charging&&b.level<0.2) return 'battery'; } }catch{}
    return ''; }
  function log(task,r){ try{ const a=JSON.parse(LS.get(LOG,'[]'))||[]; a.push({t:Date.now(),k:task,r}); LS.set(LOG,JSON.stringify(a.slice(-30))); }catch{} }
  const limits=()=>{ const c=conn(); return 'لا يعمل والتطبيق مغلق تمامًا (قيود iOS/Android على تطبيقات الويب)؛ يلحق بما فات فور الفتح.'+(c&&c.type?'':' نوع الشبكة لا يُكشف على هذا الجهاز، فيُعامل كـ Wi‑Fi.'); };
  // انتظار هدوء الواجهة (لا ينافس التمرير أو فتح الصفحات)
  const idle=(fn,t)=>setTimeout(()=>{ (window.requestIdleCallback||(f=>setTimeout(f,1)))(()=>{ if(!document.hidden) fn(); },{timeout:4000}); },t);
  // «اكتشف»: تجهيز مسبق إن كانت النتائج أقدم من 12 ساعة
  const STALE=12*36e5;
  async function discoverPre(){
    try{ if(!window.RecsUI||!RecsUI.hasKeys()||RecsUI.busy) return;
      const age=Date.now()-((typeof _recCache!=='undefined'&&_recCache.at)||0); if(age<STALE) return;
      if(Date.now()-(+LS.get('vkte_bg_try','0')||0)<36e5) return;   // محاولة واحدة في الساعة حتى لو فشلت (مفتاح غير صالح/مصدر متوقف)
      if(!(await ok('discover'))) return;
      LS.set('vkte_bg_try',String(Date.now()));
      await RecsUI.refresh(false); try{ RecsUI.localRank(); }catch{}
      LS.set('vkte_bg_disc',String(Date.now()));
    }catch(e){ log('discover','err:'+String(e&&e.message||e).slice(0,80)); } }
  idle(discoverPre,40000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) idle(discoverPre,15000); });
  return {ok,block,mode,setMode,limits,discoverPre,_log:()=>JSON.parse(LS.get(LOG,'[]')||'[]')};
})();

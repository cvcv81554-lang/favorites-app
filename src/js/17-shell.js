/* ===== الواجهة العامة: التنقل بين الصفحات، زر الرجوع، الاختصارات، تنزيل الصور ===== */
// تنزيل صورة من رابط خارجي: عبر CapacitorHttp في التطبيق (بلا قيود CORS)، وعبر fetch في المتصفح
async function fetchImage(url){
  if(IS_NATIVE){
    const r=await NATIVE.CapacitorHttp.get({url,responseType:'blob'}); if(r.status<200||r.status>=300) throw httpErr(r.status);
    const h=r.headers||{}; const ct=String(h['Content-Type']||h['content-type']||'image/jpeg').split(';')[0].trim();
    const d64=String(r.data||'').replace(/\s+/g,''), sig=d64.slice(0,6);
    const mime=/^\/9j\//.test(sig)?'image/jpeg':/^iVBOR/.test(sig)?'image/png':/^UklGR/.test(sig)?'image/webp':/^R0lGOD/.test(sig)?'image/gif':(/^image\//.test(ct)?ct:'');
    if(!mime) throw new Error('not image');
    const b=PB.fromData('data:'+mime+';base64,'+d64); if(!b||!b.size) throw new Error('empty'); return b; }
  const rr=await fetch(url); if(!rr.ok) throw httpErr(rr.status); const bl=await rr.blob(); if(!/^image\//.test(bl.type)) throw new Error('not image'); return bl;
}
// تحميل صورة خارجية وحفظها محليًا (للعمل بلا إنترنت). ترجع data: أو null
async function localizeImage(url){ try{ const b=await fetchImage(url); return await resize(new File([b],'x',{type:b.type})); }catch{ return null; } }

const busy={ show(t){ $('busyT').textContent=t||''; $('busy').classList.add('show'); }, hide(){ $('busy').classList.remove('show'); } };

(function(){
  const PAGES=['ovHome','ovWorks','ovStats','ovRecs','ovLists','ovMore'];
  const NAV={ovHome:'nDash',ovWorks:'nWorks',ovRecs:'nRecs',ovMore:'nMore',ovStats:'nMore',ovLists:'nMore'};
  const NBS=['nDash','nHome','nWorks','nRecs','nMore'];
  const ovs=[...document.querySelectorAll('.overlay')];
  const shown=()=>ovs.filter(o=>o.classList.contains('show'));
  const zOf=o=>+getComputedStyle(o).zIndex||0;
  const top=()=>shown().sort((a,b)=>zOf(b)-zOf(a))[0]||null;
  window.topOverlay=top;

  // الصفحات الأربع تعمل كتبويبات: فتح واحدة يغلق الأخريات، وشريط التنقل يبقى ظاهرًا
  const syncNav=()=>{ const open=PAGES.find(id=>$(id).classList.contains('show')), on=open?NAV[open]:'nHome';
    NBS.forEach(id=>$(id).classList.toggle('on',id===on)); document.body.classList.toggle('inpage',!!open); };
  // الوحدات تعيد رسم المكتبة وتلمس حالة الأزرار؛ نعيد المزامنة بعدها
  { const _r=render; render=function(){ const r=_r.apply(this,arguments); syncNav(); return r; }; }
  const mo=new MutationObserver(ms=>{ ms.forEach(m=>{ const el=m.target; if(el.classList.contains('show')&&PAGES.includes(el.id)) PAGES.forEach(id=>{ if(id!==el.id) $(id).classList.remove('show'); }); });
    syncNav(); document.body.classList.toggle('modal-open',shown().some(o=>!PAGES.includes(o.id))); });
  ovs.forEach(o=>mo.observe(o,{attributes:true,attributeFilter:['class']}));
  $('nRecs').onclick=()=>{ if(window.openRecs) window.openRecs(); };
  $('nHome').addEventListener('click',()=>{ closeOv('ovRecs'); closeOv('ovHome'); closeOv('ovMore');
    if(document.documentElement.classList.contains('tv')) setTimeout(()=>{ const c=document.querySelector('#grid .card'); if(c){ c.tabIndex=-1; try{ c.focus({preventScroll:true}); }catch{} } },120); });
  // الضغط على تبويب مفتوح يعيده لأعلاه
  document.querySelector('nav.dock').addEventListener('click',e=>{ const b=e.target.closest('.nb'); if(!b) return; const ov=Object.keys(NAV).find(k=>NAV[k]===b.id&&$(k).classList.contains('show')); if(ov){ const m=$(ov).querySelector('.modal'); if(m) m.scrollTop=0; } },true);

  $('bSetClose').onclick=()=>closeOv('ovSet');
  document.querySelectorAll('[data-ksave]').forEach(b=>b.onclick=()=>$('kSave').click());

  // النقر على الخلفية يغلق النافذة (عدا النموذج حمايةً من فقدان التعديلات)
  ovs.forEach(o=>o.addEventListener('mousedown',e=>{ if(e.target!==o) return; if(o.id==='ovAsk'){ if(ask.cancel) ask.cancel(); return; } if(o.id!=='ovForm') o.classList.remove('show'); }));

  // خطوة رجوع واحدة: عارض الصور ← حوار ← أعلى نافذة ← أعلى الصفحة. ترجع false إن لم يبقَ شيء
  function goBack(){
    if(typeof Gallery!=='undefined'&&Gallery.isOpen()){ Gallery.close(); return true; }
    if($('lock').classList.contains('show')) return true;
    if(ask.cancel){ ask.cancel(); return true; }
    const t=top();
    if(t&&t.id==='ovHome'){ const m=$('mHome'); if(m.scrollTop>200){ m.scrollTop=0; return true; } return false; }
    if(t&&PAGES.includes(t.id)){ Home.open(); return true; }
    if(t){ if(t.id==='ovForm'&&$('fCancel')) $('fCancel').click(); else t.classList.remove('show'); return true; }
    if(document.body.classList.contains('selmode')){ const x=document.querySelector('#selBar [data-sa="x"]'); if(x){ x.click(); return true; } }
    if(window.scrollY>260){ window.scrollTo({top:0,behavior:REDUCED?'auto':'smooth'}); return true; }
    Home.open(); return true; }
  const atRoot=()=>{ const t=top(); return !!t&&t.id==='ovHome'&&$('mHome').scrollTop<=200&&!ask.cancel&&!(typeof Gallery!=='undefined'&&Gallery.isOpen())&&!$('lock').classList.contains('show'); };
  window.goBack=goBack;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){ if(goBack()) e.preventDefault(); return; }
    if(/input|textarea|select/i.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey) return;
    if(e.key==='b'||e.key==='B'||e.key==='ب') $('bBlur').click(); });
  // زر الرجوع في أندرويد/التلفاز: يغلق النافذة العلوية أو يرجع خطوة، وعند الرئيسية يصغّر التطبيق
  if(IS_NATIVE){ try{ NATIVE.App.addListener('backButton',()=>{
    const had=!atRoot();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    if(!had){ try{ NATIVE.App.minimizeApp(); }catch{ try{ NATIVE.App.exitApp(); }catch{} } } }); }catch(e){ console.warn('back',e); } }
  syncNav();
})();

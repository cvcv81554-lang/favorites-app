/* ---- 10-maintenance.js ---- */
/* ===== v19 — إصلاحات وميزات جديدة (إضافي: لا يحذف شيئًا ولا يغيّر مفاتيح التخزين) =====
   1) «مشابهات في مكتبتك» داخل ملف الممثلة
   2) «وتيرة المشاهدة» في الإحصائيات
   3) صيانة البيانات: فحص السلامة + إصلاح تلقائي آمن + حجم البيانات + ضغط الصور الثقيلة (اختياري بتأكيد)
   4) اختصارات الكيبورد
   كل وحدة معزولة بـ try/catch ويُسجَّل أي خطأ في سجل الأخطاء (الإعدادات). */
(function(){
'use strict';
const $$=id=>document.getElementById(id);
const lerr=(k,e)=>{ try{ const a=JSON.parse(LS.get('vkte_errlog','[]'))||[]; a.push({t:Date.now(),k:'v19:'+k,m:String(e&&e.message||e).slice(0,300),s:String(e&&e.stack||'').split('\n').slice(0,3).join(' | ').slice(0,300)}); LS.set('vkte_errlog',JSON.stringify(a.slice(-40))); }catch{} };
const mb=n=>(n/1048576).toFixed(n>=1048576*10?0:1);
const dayNum=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||''); return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5):NaN; };

/* ---------- 1) مشابهات في مكتبتك ---------- */
function similarOf(it){
  const tags=new Set((it.tags||[]).map(norm).filter(Boolean)), a=age(it.birth), co=norm(it.country);
  return items.filter(x=>x.id!==it.id).map(x=>{
    let s=0; const xt=(x.tags||[]).map(norm).filter(Boolean); const sh=xt.filter(t=>tags.has(t)).length;
    if(sh) s+=sh/Math.sqrt(Math.max(1,tags.size)*Math.max(1,xt.length))*4;
    if(co&&norm(x.country)===co) s+=1.5;
    const b=age(x.birth); if(a!=null&&b!=null){ const d=Math.abs(a-b); s+=d<=2?1:d<=5?.5:0; }
    if(it.rating>0&&x.rating>0&&Math.abs(it.rating-x.rating)<=.5) s+=.5;
    if(x.fav) s+=.2;
    return [x,s]; }).filter(p=>p[1]>=1.5).sort((p,q)=>q[1]-p[1]).slice(0,10).map(p=>p[0]);
}
function drawSimilar(id){
  const it=items.find(x=>x.id===id), host=document.querySelector('#mDetail .dbody'); if(!it||!host) return;
  host.querySelector('.v19sim')?.remove();
  const sim=similarOf(it); if(!sim.length) return;
  const el=document.createElement('div'); el.className='sec v19sim';
  el.innerHTML=`<h3>مشابهات في مكتبتك<small>حسب الوسوم والبلد والعمر</small></h3><div class="v19strip">${sim.map(x=>`<button type="button" class="v19sc" data-sim="${esc(x.id)}"><span class="v19ph">${pic(x)?`<img src="${esc(pic(x))}" loading="lazy" decoding="async" alt="">`:'♡'}</span><b>${esc(x.name)}</b>${x.rating?`<em>★ ${x.rating.toFixed(1)}</em>`:''}</button>`).join('')}</div>`;
  const ws=host.querySelector('#wsec'); ws?host.insertBefore(el,ws):host.appendChild(el);
  el.onclick=e=>{ const b=e.target.closest('[data-sim]'); if(b) openDetail(b.dataset.sim); };
}
const _od=openDetail;
openDetail=function(id){ const r=_od.apply(this,arguments); try{ drawSimilar(typeof id==='string'?id:curDetail); }catch(e){ lerr('sim',e); } return r; };

/* ---------- 2) وتيرة المشاهدة ---------- */
function paceHtml(){
  const gs=wAll(), T=todayStr(), t0=dayNum(T), seen=gs.filter(g=>g.seen);
  const per={}; seen.forEach(g=>{ const d=dayNum(g.wd); if(!isNaN(d)) per[d]=(per[d]||0)+1; });
  const dated=Object.keys(per).length;
  const unseen=gs.filter(g=>!g.seen&&!g.upc&&!(g.dt&&g.dt>T)).length;
  if(!seen.length&&!unseen) return '';
  if(!dated) return `<div class="gc wide v19pace" style="--i:1"><h3>وتيرة المشاهدة</h3><div class="src">اضغط «شاهدتها» على أي عمل ليُسجَّل تاريخ المشاهدة وتظهر هنا وتيرتك وتوقّع إنهاء المتبقي (${unseen} عمل).</div></div>`;
  let last7=0,last30=0; for(let k=0;k<30;k++){ const c=per[t0-k]||0; last30+=c; if(k<7) last7+=c; }
  let streak=0, k=(per[t0]?0:1); while(per[t0-k]){ streak++; k++; }
  const bars=[]; for(let j=13;j>=0;j--) bars.push([t0-j,per[t0-j]||0]);
  const mx=Math.max(1,...bars.map(b=>b[1]));
  let eta=''; if(unseen&&last30>0){ const wk=unseen/(last30/30*7); eta=wk<1.5?'بوتيرتك الحالية تنهي المتبقي خلال أسبوع تقريبًا':wk<9?`بوتيرتك الحالية تنهي المتبقي خلال نحو ${Math.round(wk)} أسابيع`:`بوتيرتك الحالية تنهي المتبقي خلال نحو ${Math.round(wk/4.35)} شهرًا`; }
  else if(!unseen) eta='شاهدت كل الأعمال المتاحة 🎉'; else eta='لا مشاهدات في آخر 30 يومًا';
  const dl=n=>new Date(n*864e5).toLocaleDateString('ar',{day:'numeric',timeZone:'UTC'});
  return `<div class="gc wide v19pace" style="--i:1"><h3>وتيرة المشاهدة</h3>
    <div class="v19kpis"><div><b>${last7}</b><span>آخر 7 أيام</span></div><div><b>${last30}</b><span>آخر 30 يومًا</span></div><div><b>${streak}</b><span>أيام متتالية</span></div><div><b>${unseen}</b><span>متبقٍ</span></div></div>
    <div class="vbars" style="height:84px">${bars.map(([d,v])=>`<div class="vb"><em>${v||''}</em><div style="height:${v?Math.max(8,v/mx*70):0}%"></div>${dl(d)}</div>`).join('')}</div>
    <div class="src" style="margin-top:8px">${eta}</div></div>`;
}
const _ds=drawStatsModal;
drawStatsModal=async function(){ const r=await _ds.apply(this,arguments);
  try{ if(statsTab==='overview'){ const m=$$('mStats'); m.querySelector('.v19pace')?.remove(); const first=m.querySelector('.gc'); const h=paceHtml(); if(first&&h) first.insertAdjacentHTML('afterend',h); } }catch(e){ lerr('pace',e); } return r; };

/* ---------- 3) صيانة البيانات ---------- */
function scan(){
  const lid=new Set(lists.map(l=>l.id)), wl=new Set(wlists.map(l=>l.id));
  const r={orphL:0,orphW:0,badPh:0,dups:0,badBirth:[],noName:[],fixable:0};
  items.forEach(it=>{
    (it.lists||[]).forEach(x=>{ if(!lid.has(x)) r.orphL++; });
    (it.photos||[]).forEach(p=>{ if(typeof p!=='string'||p.length<20) r.badPh++; });
    const seen=new Set(); (it.works||[]).forEach(w=>{ (w.ls||[]).forEach(x=>{ if(!wl.has(x)) r.orphW++; }); const k=wKeyOf(w); if(seen.has(k)) r.dups++; else seen.add(k); });
    if(it.birth){ const a=age(it.birth); if(a===null||a<18||a>80) r.badBirth.push(it); }
    if(!String(it.name||'').trim()) r.noName.push(it);
  });
  r.fixable=r.orphL+r.orphW+r.badPh+r.dups; return r;
}
function fixAll(){
  const lid=new Set(lists.map(l=>l.id)), wl=new Set(wlists.map(l=>l.id)), touched=new Set(); let n=0;
  items.forEach(it=>{ let ch=false;
    if((it.lists||[]).some(x=>!lid.has(x))){ it.lists=it.lists.filter(x=>lid.has(x)); ch=true; n++; }
    if((it.photos||[]).some(p=>typeof p!=='string'||p.length<20)){ it.photos=it.photos.filter(p=>typeof p==='string'&&p.length>=20); ch=true; n++; }
    if(Array.isArray(it.works)&&it.works.length){
      const out=[], idx=new Map();
      it.works.forEach(w=>{ if(w.ls&&w.ls.some(x=>!wl.has(x))){ w.ls=w.ls.filter(x=>wl.has(x)); ch=true; n++; }
        const k=wKeyOf(w), f=idx.get(k);
        if(!f){ idx.set(k,w); out.push(w); return; }
        ['w','q','rec','fav','upc'].forEach(p=>{ if(w[p]&&!f[p]) f[p]=w[p]; });
        if((w.r||0)>(f.r||0)) f.r=w.r; ['wd','n','p','du','ds','u','d','y'].forEach(p=>{ if(!f[p]&&w[p]) f[p]=w[p]; });
        f.tg=[...new Set([...(f.tg||[]),...(w.tg||[])])]; f.ls=[...new Set([...(f.ls||[]),...(w.ls||[])])];
        ch=true; n++; });
      if(out.length!==it.works.length) it.works=out;
    }
    if(ch){ it.updated=Date.now(); touched.add(it); } });
  _wCache=null; if(touched.size) save([...touched]); return n;
}
const heavy=p=>{ const b=PB.toBlob(p); return !!b&&/^image\/(jpeg|webp)/.test(b.type)&&b.size>350000; };
function sizeReport(){
  let ph=0, nph=0, big=[], cand=0, candB=0;
  items.forEach(it=>(it.photos||[]).forEach((p,k)=>{ if(typeof p!=='string') return; const sz=PB.size(p); ph+=sz; nph++; big.push([sz,it.name,k]); if(heavy(p)){ cand++; candB+=sz; } }));
  big.sort((a,b)=>b[0]-a[0]);
  return {ph,nph,big:big.slice(0,5),cand,candB};
}
let optBusy=false;
const recompress=async src=>{ try{ const im=await _decode(src); const c=_scaled(im,IMGQ.full); if(im.close) im.close(); return await new Promise(r=>c.toBlob(r,IMGTYPE,.88)); }catch{ return null; } };
async function optimize(out){
  if(optBusy) return; const rep=sizeReport(); if(!rep.cand){ toast('لا توجد صور تحتاج ضغطًا'); return; }
  const ok=await askConfirm(`سيُعاد ضغط ${rep.cand} صورة ثقيلة (حجمها الآن نحو ${mb(rep.candB)} MB) بجودة عالية وأبعاد أقصاها 1800px. العملية لا يمكن التراجع عنها، فيُنصح بتصدير نسخة احتياطية قبلها. متابعة؟`,'ابدأ الضغط');
  if(!ok) return; optBusy=true; let saved=0, done=0, fail=0; const touched=new Set();
  try{
    for(const it of items){ let ch=false; const ph=it.photos||[];
      for(let k=0;k<ph.length;k++){ const p=ph[k]; if(!heavy(p)) continue;
        out.innerHTML=`<div class="src">جارٍ الضغط… ${done} / ${rep.cand}</div>`;
        const old=PB.size(p), nb=await recompress(p); done++;
        if(nb&&nb.size<old*.85){ ph[k]=PB.on?PB.url(nb):await new Promise(r=>{ const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(nb); }); saved+=old-nb.size; ch=true; } else fail++;
        await new Promise(r=>setTimeout(r,0)); }
      if(ch){ it.photos=ph; it.updated=Date.now(); touched.add(it); if(touched.size>=5){ await save([...touched]); touched.clear(); } } }
    if(touched.size) await save([...touched]);
  }catch(e){ lerr('opt',e); }
  optBusy=false; render(); toast('وُفّر نحو '+mb(saved)+' MB'+(fail?` (تعذّر ضغط ${fail})`:'')); drawTools(out,'size');
}
function drawTools(out,what){
  if(what==='check'){ const r=scan(); const row=(ok,t)=>`<div class="v19row ${ok?'ok':'bad'}"><i>${ok?'✓':'!'}</i><span>${t}</span></div>`;
    out.innerHTML=`<div class="v19res">`+
      row(!r.orphL,r.orphL?`${r.orphL} إشارة لقائمة محذوفة (تُصلَّح تلقائيًا)`:'قوائم الممثلات سليمة')+
      row(!r.orphW,r.orphW?`${r.orphW} إشارة لقائمة أعمال محذوفة (تُصلَّح تلقائيًا)`:'قوائم الأعمال سليمة')+
      row(!r.dups,r.dups?`${r.dups} عمل مكرر داخل نفس الملف (يُدمج تلقائيًا مع الاحتفاظ بالمشاهدة والتقييم)`:'لا أعمال مكررة')+
      row(!r.badPh,r.badPh?`${r.badPh} صورة تالفة/فارغة (تُحذف تلقائيًا)`:'الصور سليمة')+
      row(!r.badBirth.length,r.badBirth.length?`${r.badBirth.length} تاريخ ميلاد غير منطقي: ${r.badBirth.slice(0,4).map(i=>esc(i.name)).join('، ')}${r.badBirth.length>4?'…':''} (راجعها يدويًا)`:'تواريخ الميلاد منطقية')+
      row(!r.noName.length,r.noName.length?`${r.noName.length} ملف بلا اسم`:'كل الملفات لها أسماء')+`</div>`+
      (r.fixable?`<button class="btn gold" id="v19fix" style="margin-top:8px">إصلاح ${r.fixable} مشكلة تلقائيًا</button>`:'');
    const f=out.querySelector('#v19fix'); if(f) f.onclick=async()=>{ if(!await askConfirm('سيتم إصلاح المشاكل المذكورة أعلاه فقط، دون حذف أي ممثلة أو عمل (المكررات تُدمج). متابعة؟','إصلاح')) return; const n=fixAll(); render(); toast('تم إصلاح '+n+' عنصر ✓'); drawTools(out,'check'); };
  } else if(what==='size'){
    const r=sizeReport(); const nW=items.reduce((a,i)=>a+(i.works||[]).length,0);
    out.innerHTML=`<div class="v19res"><div class="v19row ok"><i>▦</i><span>${items.length} ممثلة · ${nW} عمل · ${r.nph} صورة (نحو ${mb(r.ph)} MB)</span></div>`+
      (r.big.length?`<div class="v19row"><i>↑</i><span>أثقل الصور: ${r.big.map(b=>`${esc(b[1])} (${Math.round(b[0]/1024)}KB)`).join('، ')}</span></div>`:'')+
      `<div class="v19row ok"><i>◈</i><span>تخزين الصور: ${PB.on?'Blob (محسّن)':'نصوص base64 (المتصفح لا يدعم Blob بأمان)'}</span></div><div class="v19row ${r.cand?'bad':'ok'}"><i>${r.cand?'!':'✓'}</i><span>${r.cand?`${r.cand} صورة ثقيلة (أكبر من 350KB) — ضغطها يخفّف التطبيق والنسخ الاحتياطي`:'لا توجد صور ثقيلة'}</span></div></div>`+
      (r.cand?`<button class="btn gold" id="v19opt" style="margin-top:8px">ضغط ${r.cand} صورة (يوفّر نحو ${mb(r.candB*.5)} MB)</button>`:'')+`<div id="v19q" class="src" style="margin-top:8px"></div>`;
    const b=out.querySelector('#v19opt'); if(b) b.onclick=()=>optimize(out);
    if(navigator.storage&&navigator.storage.estimate) navigator.storage.estimate().then(e=>{ const q=out.querySelector('#v19q'); if(q&&e&&e.quota) q.textContent='المساحة المستخدمة في المتصفح: '+mb(e.usage||0)+' MB من '+mb(e.quota)+' MB'; }).catch(()=>{});
  }
}
try{
  const m=document.querySelector('#ovSet .modal'); const det=document.createElement('details'); det.className='sec v19tools';
  det.innerHTML=`<summary>صيانة البيانات والاختصارات <em class="v19new">جديد</em></summary><div class="secb">
    <p class="src" style="font-size:.85rem;margin-bottom:8px">افحص بياناتك واكتشف أي تلف أو تكرار أو صور ثقيلة. الفحص للقراءة فقط ولا يغيّر شيئًا حتى تضغط «إصلاح».</p>
    <div class="actions" style="justify-content:flex-start;margin-top:0"><button class="btn gold" id="v19chk">فحص سلامة البيانات</button><button class="btn" id="v19sz">حجم البيانات والصور</button></div>
    <div id="v19out" style="margin-top:10px"></div>
    <h3 style="margin-top:14px">اختصارات الكيبورد</h3>
    <p class="src" style="font-size:.85rem;line-height:2" dir="rtl"><kbd>/</kbd> بحث · <kbd>N</kbd> إضافة · <kbd>W</kbd> الأعمال · <kbd>L</kbd> القوائم · <kbd>S</kbd> الإحصائيات · <kbd>R</kbd> سحب عشوائي · <kbd>B</kbd> تمويه · <kbd>Esc</kbd> إغلاق</p></div>`;
  m.insertBefore(det,m.lastElementChild);
  $$('v19chk').onclick=()=>drawTools($$('v19out'),'check');
  $$('v19sz').onclick=()=>drawTools($$('v19out'),'size');
  $$('bSet').addEventListener('click',()=>{ const o=$$('v19out'); if(o&&!optBusy) o.innerHTML=''; });
}catch(e){ lerr('tools-ui',e); }

/* ---------- 4) اختصارات الكيبورد ---------- */
document.addEventListener('keydown',e=>{ try{
  if(e.ctrlKey||e.metaKey||e.altKey||/input|textarea|select/i.test(e.target.tagName)||e.target.isContentEditable) return;
  if(document.querySelector('.overlay.show,#lock.show,#lbx.show')) return;
  const k=({n:'bAdd',w:'nWorks',l:'nLists',s:'bStats',r:'bRandom'})[e.key.toLowerCase()]; if(k){ e.preventDefault(); $$(k).click(); }
}catch(er){ lerr('keys',er); } });

/* ---------- سجل أخطاء عام (يساعد على اكتشاف المشاكل لاحقًا) ---------- */
addEventListener('unhandledrejection',e=>{ const r=e.reason; if(r&&/AbortError|NetworkError|Failed to fetch|Load failed/i.test(String(r.message||r.name||r))) return; lerr('promise',r); });
})();

;

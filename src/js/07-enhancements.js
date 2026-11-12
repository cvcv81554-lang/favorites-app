/* ---- 07-enhancements.js ---- */
/* ===== v17 — طبقة التطوير الشاملة =====
   إضافية بالكامل: لا تحذف أي وظيفة قائمة. تعيد تعريف render/list/openDetail/openLists بلفّها فقط
   (نفس أسلوب recs.js). كل وحدة معزولة بـ mod() فإن فشلت واحدة لا تتأثر البقية، ويُسجَّل الخطأ. */
(function(){
'use strict';
const $$=id=>document.getElementById(id);
const vib=n=>{ try{ navigator.vibrate&&navigator.vibrate(n||8); }catch{} };
const jget=(k,d)=>{ try{ const v=JSON.parse(LS.get(k,'null')); return v==null?d:v; }catch{ return d; } };
const clone=o=>{ try{ return structuredClone(o); }catch{ return JSON.parse(JSON.stringify(o)); } };
const copyText=async t=>{ try{ await navigator.clipboard.writeText(t); return true; }catch{ return false; } };

// ---------- سجل الأخطاء (للتشخيص) ----------
const ERR_KEY='vkte_errlog';
function logErr(kind,msg,stack){ try{
  msg=String(msg||'').slice(0,300); if(!msg||/ResizeObserver/.test(msg)) return;
  const a=jget(ERR_KEY,[]); const last=a[a.length-1];
  if(last&&last.m===msg){ last.c=(last.c||1)+1; last.t=Date.now(); }
  else a.push({t:Date.now(),k:kind,m:msg,s:String(stack||'').split('\n').slice(0,3).join(' | ').slice(0,300)});
  LS.set(ERR_KEY,JSON.stringify(a.slice(-40))); }catch{} }
addEventListener('error',e=>logErr('error',e.message+(e.filename?' @'+String(e.filename).split('/').pop()+':'+e.lineno:''),e.error&&e.error.stack));
addEventListener('unhandledrejection',e=>logErr('promise',(e.reason&&e.reason.message)||e.reason,e.reason&&e.reason.stack));
const SEL={on:false,ids:new Set()};
const mod=(n,f)=>{ try{ f(); }catch(e){ logErr('init:'+n,e&&e.message,e&&e.stack); console.warn('v17',n,e); } };

// ---------- منتقي الممثلات (مشترك: اختيار واحد أو عدة) ----------
function pickPerformers(o){ return new Promise(res=>{
  const multi=!!o.multi, sel=new Set(o.selected||[]), ex=new Set(o.exclude||[]);
  let q='', only=false, lim=80;
  const pool=items.filter(i=>!ex.has(i.id)).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  const m=$$('mPP');
  m.innerHTML=`<div class="v17h"><h2>${esc(o.title||'اختيار')}</h2><button class="ib" data-x aria-label="إغلاق">${icon('x')}</button></div>
    ${o.sub?`<p class="src" style="font-size:.85rem;margin:-4px 0 8px">${esc(o.sub)}</p>`:''}
    <label class="sbox v17s" style="margin:0">${icon('search')}<input id="ppQ" type="search" placeholder="ابحث بالاسم أو الاسم البديل" autocomplete="off"></label>
    ${multi?`<div class="v17qa"><span class="chip" data-qa="vis">تحديد الظاهر</span><span class="chip" data-qa="none">إلغاء الكل</span><span class="chip" id="ppOnly" data-qa="only">المحدّدون فقط</span>${(o.extra||[]).map((x,k)=>`<span class="chip" data-ex="${k}">${esc(x.label)}</span>`).join('')}</div>`:''}
    <div class="v17pplist" id="ppList"></div>
    <div class="v17ppf"><span class="src" id="ppCnt"></span><button class="btn" data-x>إلغاء</button>${multi?`<button class="btn gold" id="ppOk">${esc(o.okText||'تم')}</button>`:''}</div>`;
  const vis=()=>{ const t=norm(q); let a=pool; if(only) a=a.filter(i=>sel.has(i.id)); if(t) a=a.filter(i=>norm(i.name+' '+(i.aliases||'')+' '+(i.country||'')).includes(t)); return a; };
  const draw=()=>{ const a=vis(), show=a.slice(0,lim);
    $$('ppList').innerHTML=show.map(i=>`<button type="button" class="v17row ${sel.has(i.id)?'on':''}" data-id="${esc(i.id)}"><span class="av">${pic(i)?`<img src="${pic(i)}" loading="lazy" decoding="async" alt="">`:'♡'}</span><span class="t"><b>${esc(i.name)}</b><small>${esc([i.country,(i.works||[]).length?(i.works||[]).length+' عمل':''].filter(Boolean).join(' · '))||'&nbsp;'}</small></span>${multi?`<i class="ck">${sel.has(i.id)?'✓':''}</i>`:''}</button>`).join('')
      +(a.length>lim?`<button type="button" class="btn v17more" data-more>عرض المزيد (${a.length-lim})</button>`:'')
      +(a.length?'':'<p class="src" style="padding:18px;text-align:center">لا نتائج</p>');
    if(multi){ $$('ppCnt').textContent=sel.size+' محدّدة'; $$('ppOnly').classList.toggle('on',only); } else $$('ppCnt').textContent=a.length+' ممثلة'; };
  const fin=v=>{ closeOv('ovPP'); res(v); };
  m.onclick=e=>{
    if(e.target.closest('[data-x]')) return fin(null);
    if(e.target.closest('[data-more]')){ lim+=120; draw(); return; }
    const r=e.target.closest('.v17row'); if(r){ const id=r.dataset.id; if(!multi) return fin(id); sel.has(id)?sel.delete(id):sel.add(id); r.classList.toggle('on',sel.has(id)); r.querySelector('.ck').textContent=sel.has(id)?'✓':''; $$('ppCnt').textContent=sel.size+' محدّدة'; vib(6); return; }
    const qa=e.target.closest('[data-qa]'); if(qa){ const k=qa.dataset.qa; if(k==='vis') vis().forEach(i=>sel.add(i.id)); else if(k==='none') sel.clear(); else only=!only; lim=80; draw(); return; }
    const ex2=e.target.closest('[data-ex]'); if(ex2){ o.extra[+ex2.dataset.ex].fn(new Set(sel)); return; }
    if(e.target.id==='ppOk') fin(new Set(sel)); };
  let qT; $$('ppQ').oninput=e=>{ clearTimeout(qT); qT=setTimeout(()=>{ q=e.target.value; lim=80; draw(); },90); };
  draw(); $$('ovPP').classList.add('show'); m.scrollTop=0; m.classList.toggle('blur',document.body.classList.contains('blur'));
  if(!multi) setTimeout(()=>{ try{ $$('ppQ').focus(); }catch{} },120);
}); }

// ---------- دمج المكرر ----------
const emptyV=v=>v==null||v===''||(Array.isArray(v)&&!v.length);
function mergeOne(P,O){
  ['country','birth','height','cs','ce','source','pdbId','stashId','ofId','fsId','worksAt','bodyD'].forEach(k=>{ if(emptyV(P[k])&&!emptyV(O[k])) P[k]=O[k]; });
  if(!(P.rating>0)&&!P.criteria){ if(O.criteria) P.criteria=O.criteria; if(O.rating>0) P.rating=O.rating; }
  const keys=new Set([norm(P.name)]), al=[];
  const addAl=s=>String(s||'').split(/[,،\n]/).map(x=>x.trim()).filter(Boolean).forEach(x=>{ const k=norm(x); if(k&&!keys.has(k)){ keys.add(k); al.push(x); } });
  addAl(P.aliases); addAl(O.aliases); addAl(O.name); P.aliases=al.join(', ');
  const ph=new Set((P.photos=P.photos||[]).map(PB.key)); (O.photos||[]).forEach(p=>{ const k=PB.key(p); if(!ph.has(k)){ ph.add(k); P.photos.push(p); } });
  if(!P.thumb&&O.thumb) P.thumb=O.thumb;
  if(O.srcImgs&&O.srcImgs.length){ P.srcImgs=[...new Set([...(P.srcImgs||[]),...O.srcImgs])]; }
  const r=mergeWorks(P.works||[],O.works||[]); P.works=r.list;
  (O.works||[]).forEach(bw=>{ const h=P.works.find(x=>wkey(x.t)===wkey(bw.t)); if(!h) return;
    ['w','rec','q','fav'].forEach(k=>{ if(bw[k]) h[k]=1; }); if((bw.r||0)>(h.r||0)) h.r=bw.r;
    ['wd','n','p','u'].forEach(k=>{ if(!h[k]&&bw[k]) h[k]=bw[k]; }); });
  P.tags=[...new Set([...(P.tags||[]),...(O.tags||[])])]; P.lists=[...new Set([...(P.lists||[]),...(O.lists||[])])];
  const ak=new Set((P.accounts||[]).map(a=>a.p+'|'+String(a.v||'').toLowerCase())); P.accounts=P.accounts||[];
  (O.accounts||[]).forEach(a=>{ const k=a.p+'|'+String(a.v||'').toLowerCase(); if(a.v&&!ak.has(k)){ ak.add(k); P.accounts.push({p:a.p,v:a.v}); } });
  if(O.notes&&O.notes!==P.notes) P.notes=P.notes?P.notes+'\n\n— '+O.name+':\n'+O.notes:O.notes;
  P.fav=!!(P.fav||O.fav); P.added=Math.min(P.added||Date.now(),O.added||Date.now());
}
function doMerge(pid,oids){
  const P=items.find(i=>i.id===pid), others=oids.map(id=>items.find(i=>i.id===id)).filter(Boolean); if(!P||!others.length) return;
  const snapP=clone(P), snapO=others.map(clone);
  others.forEach(O=>mergeOne(P,O)); P.updated=Date.now();
  const gone=new Set(others.map(o=>o.id)); items=items.filter(i=>!gone.has(i.id));
  gone.forEach(id=>DB.del(id).catch(()=>{})); save(P); render();
  undoToast('تم دمج '+others.length+' في «'+P.name+'»',async()=>{
    Object.keys(P).forEach(k=>delete P[k]); Object.assign(P,snapP);
    snapO.forEach(o=>{ if(!items.some(i=>i.id===o.id)) items.push(o); });
    if(!items.includes(P)) items.push(P);
    await save([P,...snapO]); render(); toast('تم التراجع عن الدمج'); });
}
async function mergeDialog(group,preId){
  const first=preId||group[0].id;
  const pid=await askShow(`<h2>دمج ممثلات مكررة</h2><p class="src" style="margin-bottom:10px;font-size:.88rem">اختر السجل الذي يبقى. يُنقل إليه من الباقي: الصور والأعمال (مع المشاهدة والتقييم) والوسوم والقوائم والحسابات والأسماء، ثم يُحذف السجل المدموج.</p>
    <div class="v17opts">${group.map(i=>`<button type="button" class="v17row ${i.id===first?'on':''}" data-id="${esc(i.id)}"><span class="av">${pic(i)?`<img src="${pic(i)}" alt="">`:'♡'}</span><span class="t"><b>${esc(i.name)}</b><small>${(i.photos||[]).length} صور · ${(i.works||[]).length} عمل${i.rating?' · ★ '+(+i.rating).toFixed(1):''}</small></span><i class="ck">${i.id===first?'✓':''}</i></button>`).join('')}</div>
    <div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn gold" id="aOk">دمج</button></div>`,(m,done)=>{
      let cur=first; m.querySelectorAll('.v17row').forEach(r=>r.onclick=()=>{ cur=r.dataset.id; m.querySelectorAll('.v17row').forEach(x=>{ x.classList.toggle('on',x===r); x.querySelector('.ck').textContent=x===r?'✓':''; }); });
      $$('aOk').onclick=()=>done(cur); $$('aNo').onclick=()=>done(null); });
  if(!pid) return false;
  doMerge(pid,group.map(i=>i.id).filter(x=>x!==pid)); return true;
}

// ---------- 1) الرئيسية: بحث وفرز وشريط الأدوات والفلترة المتقدمة والتحديد الجماعي ----------
mod('home',()=>{
  const sortEl=$$('sort'), q=$$('q'), grid=$$('grid');
  const ss=LS.get('vkte_sort'); if(ss&&[...sortEl.options].some(o=>o.value===ss)) sortEl.value=ss;
  sortEl.addEventListener('change',()=>LS.set('vkte_sort',sortEl.value));
  q.placeholder='ابحث: اسم، وسم، عمل، ملاحظة…';
  const box=q.closest('.sbox'); const clr=document.createElement('button'); clr.type='button'; clr.className='sclr'; clr.hidden=true; clr.setAttribute('aria-label','مسح البحث'); clr.innerHTML=icon('x'); box.appendChild(clr);
  q.addEventListener('input',()=>{ clr.hidden=!q.value; });
  clr.onclick=()=>{ q.value=''; clr.hidden=true; q.dispatchEvent(new Event('input')); q.focus(); };

  // --- الفلترة المتقدمة ---
  const ADV0=()=>({co:[],minR:0,ageMin:'',ageMax:'',tags:[],has:[],lst:''});
  let ADV=ADV0(), advDirty=false;
  const HAS={ photos:['فيها صور',i=>(i.photos||[]).length>0], nophotos:['بلا صور',i=>!(i.photos||[]).length], works:['لها أعمال',i=>(i.works||[]).length>0], unseen:['أعمال لم أشاهدها',i=>(i.works||[]).some(w=>!w.w)], upcoming:['أعمال قادمة',i=>(i.works||[]).some(isUpcoming)], birth:['تاريخ ميلاد',i=>!!i.birth], notes:['فيها ملاحظات',i=>!!i.notes] };
  const advN=()=>(ADV.co.length?1:0)+(ADV.minR?1:0)+((ADV.ageMin!==''||ADV.ageMax!=='')?1:0)+(ADV.tags.length?1:0)+(ADV.has.length?1:0)+(ADV.lst?1:0);
  function advFilter(l){ if(!advN()) return l; return l.filter(i=>{
    if(ADV.co.length&&!ADV.co.includes(i.country)) return false;
    if(ADV.minR&&!((i.rating||0)>=ADV.minR)) return false;
    if(ADV.ageMin!==''||ADV.ageMax!==''){ const a=age(i.birth); if(a==null) return false; if(ADV.ageMin!==''&&a<+ADV.ageMin) return false; if(ADV.ageMax!==''&&a>+ADV.ageMax) return false; }
    if(ADV.tags.length&&!ADV.tags.every(t=>(i.tags||[]).includes(t))) return false;
    if(ADV.has.length&&!ADV.has.every(k=>HAS[k][1](i))) return false;
    if(ADV.lst&&!(i.lists||[]).includes(ADV.lst)) return false;
    return true; }); }
  const _list=list; list=function(){ return advFilter(_list.apply(this,arguments)); };
  const baseFiltered=()=>_list();
  const filtActive=()=>!!(state.fav||state.tag||state.list||state.smart||q.value.trim()||advN());

  const bar=document.createElement('div'); bar.id='v17bar';
  bar.innerHTML=`<span class="v17c" id="vCnt"></span><div class="acts"><button type="button" class="v17b" id="vAdv">${icon('set')}<span>فلترة</span><em id="vAdvN" hidden></em></button><button type="button" class="v17b" id="vSel">${icon('grid')}<span>تحديد</span></button><button type="button" class="v17b" id="vSaveL" hidden>${icon('folder')}<span>حفظ كقائمة</span></button><button type="button" class="v17b x" id="vClr" hidden>${icon('x')}<span>مسح</span></button></div>`;
  const strip=document.createElement('div'); strip.id='v17rec'; strip.hidden=true;
  grid.before(strip); grid.before(bar);

  function updRecent(){
    const ids=jget('vkte_recent',[]); const map=new Map(items.map(i=>[i.id,i]));
    const arr=ids.map(id=>map.get(id)).filter(Boolean).slice(0,12);
    const show=!filtActive()&&!SEL.on&&items.length>=8&&arr.length>=2;
    strip.hidden=!show; if(!show){ strip.innerHTML=''; return; }
    strip.innerHTML=`<h4>شاهدتها مؤخرًا</h4><div class="strip">${arr.map(i=>`<button type="button" data-id="${esc(i.id)}"><span class="av">${pic(i)?`<img src="${pic(i)}" loading="lazy" decoding="async" alt="">`:'♡'}</span><b>${esc(i.name.split(' ')[0])}</b></button>`).join('')}</div>`; }
  strip.onclick=e=>{ const b=e.target.closest('[data-id]'); if(b) openDetail(b.dataset.id); };

  function updBar(){
    const n=(render.list||[]).length, tot=items.length, f=filtActive();
    $$('vCnt').textContent=tot?(f?n+' من '+tot+' ممثلة':tot+' ممثلة'):'';
    bar.hidden=!tot;
    const an=advN(); $$('vAdvN').hidden=!an; $$('vAdvN').textContent=an; $$('vAdv').classList.toggle('on',!!an);
    $$('vSaveL').hidden=!(f&&n>0); $$('vClr').hidden=!f;
    $$('vSel').classList.toggle('on',SEL.on); $$('vSel').querySelector('span').textContent=SEL.on?'إنهاء التحديد':'تحديد';
    updRecent(); markSel(); }
  const _render=render; render=function(){ const r=_render.apply(this,arguments); try{ updBar(); }catch(e){ logErr('bar',e.message,e.stack); } return r; };

  $$('vClr').onclick=()=>{ state.fav=false; state.tag=null; state.list=null; state.smart=null; q.value=''; clr.hidden=true; ADV=ADV0(); render(true); };
  $$('vSaveL').onclick=async()=>{
    const arr=(render.list||[]).slice(); if(!arr.length) return;
    const nm=await askText('اسم القائمة الجديدة','','سيُضاف إليها '+arr.length+' ممثلة'); if(!nm) return;
    const L={id:uid(),name:nm}; lists.push(L); saveLists(); arr.forEach(i=>{ i.lists=[...new Set([...(i.lists||[]),L.id])]; }); await save(arr);
    toast('تم حفظ '+arr.length+' ممثلة في «'+nm+'»'); vib(); };

  // ورقة الفلترة
  const chipsH=(attr,arr,isOn,fmt)=>arr.map(a=>`<span class="chip ${isOn(a[0])?'on':''}" ${attr}="${esc(a[0])}">${fmt?fmt(a):esc(a[0])}</span>`).join('');
  function drawAdv(){
    const m=$$('mAdv'), keep=m.scrollTop;
    const co=topN(items.map(i=>i.country),40), tg=topN(items.flatMap(i=>i.tags||[]),40);
    m.innerHTML=`<div class="v17h"><h2>فلترة متقدمة</h2><button class="ib" data-x aria-label="إغلاق">${icon('x')}</button></div>
      <p class="src" style="font-size:.85rem;margin:-4px 0 6px">كل الشروط تُطبَّق معًا، وتعمل فوق البحث والوسوم الظاهرة.</p>
      <h3>الحد الأدنى للتقييم</h3><div class="v17chips">${chipsH('data-mr',[[0,'أي تقييم'],[3,'3★ فأكثر'],[4,'4★ فأكثر'],[4.5,'4.5★ فأكثر']].map(x=>[x[0],x[1]]),v=>+v===ADV.minR,a=>esc(a[1]))}</div>
      <h3>العمر</h3><div class="v17age"><input class="in" id="avMin" type="number" inputmode="numeric" min="18" max="99" placeholder="من" value="${esc(ADV.ageMin)}"><span>—</span><input class="in" id="avMax" type="number" inputmode="numeric" min="18" max="99" placeholder="إلى" value="${esc(ADV.ageMax)}"></div>
      ${co.length?`<h3>البلد <small class="src">(يمكن اختيار أكثر من بلد)</small></h3><div class="v17chips">${chipsH('data-co',co,v=>ADV.co.includes(v),a=>esc(a[0])+' <small>'+a[1]+'</small>')}</div>`:''}
      ${tg.length?`<h3>الوسوم <small class="src">(تحتوي كل المختار)</small></h3><div class="v17chips">${chipsH('data-tg',tg,v=>ADV.tags.includes(v),a=>'#'+esc(a[0])+' <small>'+a[1]+'</small>')}</div>`:''}
      ${lists.length?`<h3>القائمة</h3><div class="v17chips">${lists.map(L=>`<span class="chip ${ADV.lst===L.id?'on':''}" data-ls="${L.id}">${esc(L.name)}</span>`).join('')}</div>`:''}
      <h3>المحتوى</h3><div class="v17chips">${Object.entries(HAS).map(([k,v])=>`<span class="chip ${ADV.has.includes(k)?'on':''}" data-hs="${k}">${v[0]}</span>`).join('')}</div>
      <div class="v17ppf"><button class="btn gold" id="avGo"></button><button class="btn" id="avReset">مسح الشروط</button></div>`;
    m.scrollTop=keep; updAdvCount(); }
  function updAdvCount(){ const b=$$('avGo'); if(!b) return; const n=advFilter(baseFiltered()).length; b.textContent='عرض '+n+' ممثلة'; b.disabled=!n; }
  $$('vAdv').onclick=()=>{ drawAdv(); $$('ovAdv').classList.add('show'); $$('mAdv').classList.toggle('blur',document.body.classList.contains('blur')); };
  const toggle=(arr,v)=>{ const k=arr.indexOf(v); k>=0?arr.splice(k,1):arr.push(v); };
  $$('mAdv').addEventListener('click',e=>{
    const t=e.target; if(t.closest('[data-x]')||t.id==='avGo'){ closeOv('ovAdv'); return; }
    if(t.id==='avReset'){ ADV=ADV0(); advDirty=true; drawAdv(); return; }
    const mr=t.closest('[data-mr]'), co=t.closest('[data-co]'), tg=t.closest('[data-tg]'), ls=t.closest('[data-ls]'), hs=t.closest('[data-hs]');
    if(!(mr||co||tg||ls||hs)) return; advDirty=true;
    if(mr) ADV.minR=+mr.dataset.mr; else if(co) toggle(ADV.co,co.dataset.co); else if(tg) toggle(ADV.tags,tg.dataset.tg); else if(ls) ADV.lst=ADV.lst===ls.dataset.ls?'':ls.dataset.ls; else toggle(ADV.has,hs.dataset.hs);
    if(hs){ const k=hs.dataset.hs; if(k==='photos'&&ADV.has.includes('nophotos')) toggle(ADV.has,'nophotos'); if(k==='nophotos'&&ADV.has.includes('photos')) toggle(ADV.has,'photos'); }
    drawAdv(); vib(5); });
  $$('mAdv').addEventListener('input',e=>{ if(e.target.id==='avMin'){ ADV.ageMin=e.target.value; advDirty=true; updAdvCount(); } else if(e.target.id==='avMax'){ ADV.ageMax=e.target.value; advDirty=true; updAdvCount(); } });
  new MutationObserver(()=>{ if(!$$('ovAdv').classList.contains('show')&&advDirty){ advDirty=false; render(true); } }).observe($$('ovAdv'),{attributes:true,attributeFilter:['class']});

  // --- التحديد الجماعي ---
  function markSel(){ document.body.classList.toggle('selmode',SEL.on); const bar2=$$('selBar'); if(bar2) bar2.classList.toggle('show',SEL.on);
    if(!SEL.on) { grid.querySelectorAll('.card.picked').forEach(c=>c.classList.remove('picked')); return; }
    grid.querySelectorAll('.card').forEach(c=>c.classList.toggle('picked',SEL.ids.has(c.dataset.id)));
    $$('selN').textContent=SEL.ids.size?SEL.ids.size+' محدّدة':'اختر ممثلات'; document.querySelectorAll('#selBar [data-sa]').forEach(b=>{ if(b.dataset.sa!=='x'&&b.dataset.sa!=='all') b.disabled=!SEL.ids.size; }); }
  const selBar=document.createElement('div'); selBar.id='selBar'; selBar.setAttribute('role','toolbar');
  selBar.innerHTML=`<div class="r1"><button type="button" class="ib sm" data-sa="x" aria-label="إنهاء التحديد">${icon('x')}</button><b id="selN"></b><button type="button" class="chip" data-sa="all">تحديد الكل</button></div><div class="r2"><button type="button" data-sa="fav">${icon('star')}<span>مفضّلة</span></button><button type="button" data-sa="list">${icon('folder')}<span>قائمة</span></button><button type="button" data-sa="tag"><b>#</b><span>وسم</span></button><button type="button" data-sa="del" class="danger">${icon('trash')}<span>حذف</span></button></div>`;
  document.body.appendChild(selBar);
  const selItems=()=>items.filter(i=>SEL.ids.has(i.id));
  function setSel(on){ SEL.on=on; if(!on) SEL.ids.clear(); markSel(); updRecent(); $$('vSel').classList.toggle('on',on); $$('vSel').querySelector('span').textContent=on?'إنهاء التحديد':'تحديد'; }
  const tog=id=>{ SEL.ids.has(id)?SEL.ids.delete(id):SEL.ids.add(id); vib(6); markSel(); };
  $$('vSel').onclick=()=>setSel(!SEL.on);
  grid.addEventListener('click',e=>{ const c=e.target.closest('.card'); if(!c) return;
    if(lp.fired){ lp.fired=false; e.stopPropagation(); e.preventDefault(); return; }
    if(!SEL.on) return; e.stopPropagation(); e.preventDefault(); tog(c.dataset.id); },true);
  const lp={t:0,x:0,y:0,fired:false};
  grid.addEventListener('pointerdown',e=>{ const c=e.target.closest('.card'); if(!c||e.target.closest('[data-fav]')||e.button>0) return; lp.fired=false; lp.x=e.clientX; lp.y=e.clientY; clearTimeout(lp.t);
    lp.t=setTimeout(()=>{ lp.fired=true; if(!SEL.on){ SEL.on=true; } SEL.ids.add(c.dataset.id); vib(14); markSel(); updRecent(); $$('vSel').classList.add('on'); $$('vSel').querySelector('span').textContent='إنهاء التحديد'; },520); },{passive:true});
  const cancelLp=()=>clearTimeout(lp.t);
  grid.addEventListener('pointermove',e=>{ if(Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>9) cancelLp(); },{passive:true});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>grid.addEventListener(ev,cancelLp,{passive:true}));
  grid.addEventListener('contextmenu',e=>{ if(e.target.closest('.card')) e.preventDefault(); });
  new MutationObserver(()=>{ if(SEL.on) markSel(); }).observe(grid,{childList:true});

  selBar.onclick=async e=>{ const b=e.target.closest('[data-sa]'); if(!b||b.disabled) return; const k=b.dataset.sa;
    if(k==='x') return setSel(false);
    if(k==='all'){ const all=(render.list||[]).map(i=>i.id); const full=all.length&&all.every(id=>SEL.ids.has(id)); full?SEL.ids.clear():all.forEach(id=>SEL.ids.add(id)); markSel(); return; }
    const arr=selItems(); if(!arr.length) return;
    if(k==='fav'){ const allFav=arr.every(i=>i.fav); arr.forEach(i=>{ i.fav=!allFav; }); await save(arr); if(state.fav) render(); else arr.forEach(i=>{ const f=grid.querySelector('[data-fav="'+i.id+'"]'); if(f) f.classList.toggle('on',i.fav); }); toast(allFav?'أُزيلت من المفضّلة ('+arr.length+')':'أُضيفت للمفضّلة ('+arr.length+')'); vib(); }
    else if(k==='list'){ const r=await selListDlg(); if(!r) return; let L; if(r.lid==='__new'){ L={id:uid(),name:r.name}; lists.push(L); saveLists(); } else L=lists.find(x=>x.id===r.lid); if(!L) return;
      arr.forEach(i=>{ const s=new Set(i.lists||[]); r.mode==='add'?s.add(L.id):s.delete(L.id); i.lists=[...s]; }); await save(arr); if(state.list) render();
      toast((r.mode==='add'?'أُضيفت ':'أُزيلت ')+arr.length+(r.mode==='add'?' إلى «':' من «')+L.name+'»'); vib(); }
    else if(k==='tag'){ const r=await selTagDlg(arr); if(!r) return; arr.forEach(i=>{ const s=new Set(i.tags||[]); r.mode==='add'?s.add(r.tag):s.delete(r.tag); i.tags=[...s]; }); await save(arr); render(); toast((r.mode==='add'?'أُضيف الوسم #':'أُزيل الوسم #')+r.tag+' ('+arr.length+')'); vib(); }
    else if(k==='del'){ if(!(await askConfirm('حذف '+arr.length+' ممثلة؟ يمكنك التراجع خلال 7 ثوانٍ.','حذف',true))) return;
      const gone=arr.slice(), ids=new Set(gone.map(i=>i.id)); items=items.filter(i=>!ids.has(i.id)); await Promise.all(gone.map(i=>DB.del(i.id).catch(()=>{}))); setSel(false); render();
      undoToast('تم حذف '+gone.length+' ممثلة',async()=>{ gone.forEach(g=>{ if(!items.some(i=>i.id===g.id)) items.push(g); }); await save(gone); render(); toast('تم الاسترجاع'); }); }
  };
  async function selListDlg(){ return askShow(`<h2>القوائم</h2><div class="v17chips" id="lMode"><span class="chip on" data-m="add">إضافة إلى قائمة</span><span class="chip" data-m="rem">إزالة من قائمة</span></div>
    <div class="v17chips" id="lChips" style="margin-top:10px">${lists.map(L=>`<span class="chip" data-l="${L.id}">${esc(L.name)}</span>`).join('')}<span class="chip" data-l="__new">＋ قائمة جديدة</span></div>
    <input class="in" id="lNm" placeholder="اسم القائمة الجديدة" style="display:none;margin-top:10px" autocomplete="off">
    <div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn gold" id="aOk">تطبيق</button></div>`,(m,done)=>{
      let mode='add', lid=lists[0]?lists[0].id:'__new';
      const sync=()=>{ m.querySelectorAll('#lMode .chip').forEach(c=>c.classList.toggle('on',c.dataset.m===mode)); const nw=m.querySelector('[data-l="__new"]'); nw.style.display=mode==='add'?'':'none'; if(mode==='rem'&&lid==='__new') lid=lists[0]?lists[0].id:''; m.querySelectorAll('#lChips .chip').forEach(c=>c.classList.toggle('on',c.dataset.l===lid)); $$('lNm').style.display=(mode==='add'&&lid==='__new')?'':'none'; };
      m.onclick=e=>{ const a=e.target.closest('[data-m]'), b=e.target.closest('[data-l]'); if(a){ mode=a.dataset.m; sync(); } else if(b){ lid=b.dataset.l; sync(); if(lid==='__new') $$('lNm').focus(); } };
      sync();
      $$('aNo').onclick=()=>done(null);
      $$('aOk').onclick=()=>{ if(!lid){ toast('لا توجد قوائم'); return; } if(lid==='__new'){ const n=$$('lNm').value.trim(); if(!n){ toast('اكتب اسم القائمة'); return; } done({mode,lid,name:n}); } else done({mode,lid}); }; }); }
  async function selTagDlg(arr){ return askShow(`<h2>الوسوم</h2><div class="v17chips" id="tMode"><span class="chip on" data-m="add">إضافة وسم</span><span class="chip" data-m="rem">إزالة وسم</span></div>
    <input class="in" id="tIn" placeholder="اكتب الوسم" style="margin-top:10px" autocomplete="off"><div class="v17chips" id="tChips" style="margin-top:10px"></div>
    <div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn gold" id="aOk">تطبيق</button></div>`,(m,done)=>{
      let mode='add'; const all=topN(items.flatMap(i=>i.tags||[]),14).map(x=>x[0]), mine=[...new Set(arr.flatMap(i=>i.tags||[]))];
      const sync=()=>{ m.querySelectorAll('#tMode .chip').forEach(c=>c.classList.toggle('on',c.dataset.m===mode)); const src=mode==='add'?all:mine; $$('tChips').innerHTML=src.length?src.map(t=>`<span class="chip" data-t="${esc(t)}">#${esc(t)}</span>`).join(''):'<span class="src">لا وسوم</span>'; };
      sync(); setTimeout(()=>$$('tIn').focus(),80);
      m.onclick=e=>{ const a=e.target.closest('[data-m]'), b=e.target.closest('[data-t]'); if(a){ mode=a.dataset.m; sync(); } else if(b) $$('tIn').value=b.dataset.t; };
      $$('aNo').onclick=()=>done(null);
      $$('aOk').onclick=()=>{ const t=$$('tIn').value.trim().replace(/^#+/,''); if(!t){ toast('اكتب الوسم'); return; } done({mode,tag:t}); }; }); }
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&SEL.on&&!document.querySelector('.overlay.show')&&!$$('lbx').classList.contains('show')) setSel(false); });
  window.v17Api={ byCountry(c){ state.fav=false; state.tag=null; state.list=null; state.smart=null; q.value=''; clr.hidden=true; ADV=ADV0(); ADV.co=[c]; render(true); scrollTo({top:0,behavior:'smooth'}); } };
  updBar();
});

// ---------- 2) التفاصيل: تنقّل + تقييم سريع + قوائم + دمج + نسخ ----------
mod('detail',()=>{
  const _od=openDetail;
  openDetail=function(id){ const r=_od.apply(this,arguments); try{ track(id); decorate(id); }catch(e){ logErr('detail',e.message,e.stack); } return r; };
  function track(id){ const a=jget('vkte_recent',[]).filter(x=>x!==id); a.unshift(id); LS.set('vkte_recent',JSON.stringify(a.slice(0,14))); }
  const rateHtml=v=>[1,2,3,4,5].map(n=>`<button type="button" class="${v>=n?'on':v>=n-.5?'half':''}" data-vr="${n}" aria-label="${n} نجوم">★</button>`).join('');
  function summary(i){ const a=age(i.birth), L=(i.lists||[]).map(x=>(lists.find(l=>l.id===x)||{}).name).filter(Boolean);
    const acc=(i.accounts||[]).map(x=>accUrl(x)||x.v).filter(Boolean);
    return [i.name, i.aliases?'أسماء أخرى: '+i.aliases:'', i.country?'البلد: '+i.country:'', a!=null?'العمر: '+a:'', i.rating?'تقييمي: '+(+i.rating).toFixed(1)+' / 5':'', (i.tags||[]).length?'الوسوم: '+i.tags.map(t=>'#'+t).join(' '):'', L.length?'القوائم: '+L.join('، '):'', (i.works||[]).length?'الأعمال: '+i.works.length:'', ...acc].filter(Boolean).join('\n'); }
  function decorate(id){
    const i=items.find(x=>x.id===id), body=document.querySelector('#mDetail .dbody'); if(!i||!body) return;
    const Lst=render.list||[], idx=Lst.findIndex(x=>x.id===id);
    const nav=(idx>=0&&Lst.length>1)?`<div class="v17nav"><button type="button" data-vn="-1" ${idx===0?'disabled':''}>→ السابقة</button><span>${idx+1} / ${Lst.length}</span><button type="button" data-vn="1" ${idx===Lst.length-1?'disabled':''}>التالية ←</button></div>`:'';
    const rate=i.criteria?'':`<div class="v17r"><span class="k">تقييم سريع</span><div class="rs" id="v17rs">${rateHtml(i.rating||0)}</div><button type="button" class="clr" data-vr="0" ${i.rating?'':'hidden'}>مسح</button></div>`;
    const lsel=`<div class="v17l"><span class="k">القوائم</span><div class="v17chips">${lists.map(L=>`<span class="chip ${(i.lists||[]).includes(L.id)?'on':''}" data-vl="${L.id}">${esc(L.name)}</span>`).join('')}<span class="chip add" data-vl="__new">＋ جديدة</span></div></div>`;
    const tools=`<div class="v17t">${items.length>1?'<button type="button" data-vm>دمج مع ممثلة أخرى</button>':''}<button type="button" data-vc>نسخ الملخص</button></div>`;
    body.insertAdjacentHTML('afterbegin',`<div class="v17q">${nav}${rate}${lsel}${tools}</div>`);
    const names=new Set(lists.map(l=>l.name));
    body.querySelectorAll(':scope > .sec').forEach(s=>{ s.querySelectorAll(':scope > .tag').forEach(t=>{ if(names.has(t.textContent.trim())) t.remove(); }); if(!s.children.length) s.remove(); });
    body.querySelector('.v17q').onclick=async e=>{
      const vn=e.target.closest('[data-vn]'), vr=e.target.closest('[data-vr]'), vl=e.target.closest('[data-vl]');
      if(vn&&!vn.disabled){ const n=Lst[idx+(+vn.dataset.vn)]; if(n) openDetail(n.id); return; }
      if(vr){ const n=+vr.dataset.vr; let v=n; if(n>0){ if(i.rating===n) v=n-.5; else if(i.rating===n-.5) v=0; } i.rating=v; await save(i);
        $$('v17rs').innerHTML=rateHtml(v); body.querySelector('.v17r .clr').hidden=!v;
        const hr=document.querySelector('#mDetail .hr'); if(hr) hr.innerHTML=v?stars(v)+`<b>${v.toFixed(1)}</b><span>من 5</span>`:'<span class="src">لم تقيّمها بعد</span>';
        render(); vib(); return; }
      if(vl){ let lid=vl.dataset.vl;
        if(lid==='__new'){ const n=await askText('اسم القائمة الجديدة','','مثال: أريد مشاهدتها'); if(!n) return; const L={id:uid(),name:n}; lists.push(L); saveLists(); i.lists=[...new Set([...(i.lists||[]),L.id])]; await save(i); toast('أُضيفت إلى «'+n+'»'); return decorateRefresh(id); }
        const s=new Set(i.lists||[]); s.has(lid)?s.delete(lid):s.add(lid); i.lists=[...s]; await save(i); vl.classList.toggle('on',s.has(lid)); if(state.list) render(); vib(); return; }
      if(e.target.closest('[data-vc]')){ toast(await copyText(summary(i))?'تم نسخ الملخص':'تعذّر النسخ'); return; }
      if(e.target.closest('[data-vm]')){ const oid=await pickPerformers({title:'دمج «'+i.name+'» مع…',sub:'اختر الممثلة المكررة التي تريد دمجها.',exclude:[i.id]}); if(!oid) return; const o=items.find(x=>x.id===oid); if(!o) return;
        if(await mergeDialog([i,o],i.id)){ closeOv('ovDetail'); } } };
  }
  function decorateRefresh(id){ const sc=$$('mDetail').scrollTop; openDetail(id); $$('mDetail').scrollTop=sc; }
  document.addEventListener('keydown',e=>{ if(!$$('ovDetail').classList.contains('show')||$$('lbx').classList.contains('show')||document.querySelector('#ovAsk.show,#ovForm.show,#ovPP.show')||/input|textarea|select/i.test(e.target.tagName)) return;
    const dir=e.key==='ArrowLeft'?1:e.key==='ArrowRight'?-1:0; if(!dir) return; const b=document.querySelector('.v17nav [data-vn="'+dir+'"]'); if(b&&!b.disabled) b.click(); });
});

// ---------- 3) القوائم: إدارة الأعضاء ----------
mod('lists',()=>{
  const _ol=openLists;
  openLists=function(){ const r=_ol.apply(this,arguments); try{ document.querySelectorAll('#mLists .lc[data-l]').forEach(c=>{ const a=c.querySelector('.lca'); if(a&&!a.querySelector('[data-v17m]')) a.insertAdjacentHTML('afterbegin',`<button class="ib sm glass" data-v17m="${c.dataset.l}" aria-label="إدارة الأعضاء">${icon('plus')}</button>`); }); }catch(e){ logErr('lists',e.message,e.stack); } return r; };
  $$('mLists').addEventListener('click',async e=>{ const b=e.target.closest('[data-v17m]'); if(!b) return; e.stopPropagation(); e.preventDefault();
    const lid=b.dataset.v17m, L=lists.find(x=>x.id===lid); if(!L) return;
    const cur=new Set(items.filter(i=>(i.lists||[]).includes(lid)).map(i=>i.id));
    const res=await pickPerformers({title:'أعضاء «'+L.name+'»',sub:'حدّد من يكون في هذه القائمة.',multi:true,selected:cur,okText:'حفظ',extra:[{label:'نسخ الأسماء',fn:async s=>{ const n=items.filter(i=>s.has(i.id)).map(i=>i.name).join('\n'); toast(n&&await copyText(n)?'تم نسخ الأسماء':'لا شيء للنسخ'); }}]});
    if(!res) return; const ch=[]; let a=0,r=0;
    items.forEach(i=>{ const was=cur.has(i.id), now=res.has(i.id); if(now&&!was){ i.lists=[...(i.lists||[]),lid]; ch.push(i); a++; } else if(!now&&was){ i.lists=(i.lists||[]).filter(x=>x!==lid); ch.push(i); r++; } });
    if(ch.length){ await save(ch); render(); openLists(); toast((a?'أُضيفت '+a:'')+(a&&r?' · ':'')+(r?'أُزيلت '+r:'')); }
  },true);
});

// ---------- 4) الإعدادات: سجل الأخطاء + نسخة احتياطية أشمل + دمج المكرر ----------
mod('settings',()=>{
  const m=document.querySelector('#ovSet .modal'); if(!m) return;
  const det=document.createElement('details'); det.className='sec';
  det.innerHTML=`<summary>سجل الأخطاء (للتشخيص)</summary><div class="secb"><p class="src" style="font-size:.85rem;margin-bottom:8px">يُسجَّل هنا أي خطأ يحدث داخل التطبيق على هذا الجهاز. إن واجهت مشكلة، انسخ السجل وأرسله لتشخيصها.</p><textarea class="in" id="errOut" dir="ltr" readonly style="min-height:120px;font-size:12px"></textarea><div class="actions" style="justify-content:flex-start;margin-top:8px"><button class="btn gold" id="errCopy">نسخ</button><button class="btn" id="errClr">مسح السجل</button></div></div>`;
  m.insertBefore(det,m.lastElementChild);
  const drawErr=()=>{ const a=jget(ERR_KEY,[]); $$('errOut').value=a.length?a.map(x=>new Date(x.t).toLocaleString('en-GB')+' ['+x.k+']'+(x.c>1?' ×'+x.c:'')+'\n'+x.m+(x.s?'\n  '+x.s:'')).join('\n\n'):'لا توجد أخطاء مسجّلة ✓'; det.querySelector('summary').textContent='سجل الأخطاء'+(a.length?' ('+a.length+')':'')+' (للتشخيص)'; };
  $$('errCopy').onclick=async()=>toast(await copyText($$('errOut').value)?'تم النسخ':'حدّد النص وانسخه');
  $$('errClr').onclick=()=>{ LS.del(ERR_KEY); drawErr(); toast('تم مسح السجل'); };
  $$('bSet').addEventListener('click',drawErr);

  // فحص التكرار مع زر دمج
  const dupRun=()=>{
    const map=new Map(); const add=(k,it)=>{ k=norm(k).replace(/[^\p{L}\p{N}]+/gu,''); if(k.length<3) return; if(!map.has(k)) map.set(k,new Set()); map.get(k).add(it); };
    items.forEach(it=>{ add(it.name,it); String(it.aliases||'').split(/[,،\n]/).forEach(a=>add(a,it)); });
    // دمج المجموعات المتداخلة (ممثلة واحدة قد تظهر في أكثر من مفتاح)
    const groups=[]; [...map.values()].filter(g=>g.size>1).forEach(g=>{ const hit=groups.filter(x=>[...g].some(i=>x.has(i))); const u=new Set(g); hit.forEach(h=>{ h.forEach(i=>u.add(i)); groups.splice(groups.indexOf(h),1); }); groups.push(u); });
    const o=$$('dupOut');
    if(!groups.length){ o.innerHTML='<p class="src" style="font-size:.85rem">لا توجد أسماء مكررة ✓</p>'; return; }
    o.innerHTML=groups.map(g=>{ const a=[...g]; return `<div class="v17dup"><div class="chs">${a.map(x=>`<button type="button" class="chip" data-dup="${esc(x.id)}">${esc(x.name)}</button>`).join('')}</div><button type="button" class="btn gold" data-dm="${a.map(x=>esc(x.id)).join(',')}">دمج</button></div>`; }).join('');
  };
  $$('dupGo').onclick=dupRun;
  $$('dupOut').onclick=async e=>{ const c=e.target.closest('[data-dup]'); if(c){ closeOv('ovSet'); openDetail(c.dataset.dup); return; }
    const d=e.target.closest('[data-dm]'); if(!d) return; const g=d.dataset.dm.split(',').map(id=>items.find(i=>i.id===id)).filter(Boolean); if(g.length<2){ dupRun(); return; }
    if(await mergeDialog(g)) dupRun(); };
});
// ---------- 5) مركز الأعمال: شريط تقدّم المشاهدة ----------
mod('works',()=>{
  const _dw=drawWorksHub;
  drawWorksHub=function(){ const r=_dw.apply(this,arguments);
    try{ const all=wAll(), n=all.length, s=all.filter(g=>g.seen).length, top=document.querySelector('#mWorks .wk-top');
      if(top&&n&&!top.querySelector('.v17prog')){ const pc=Math.round(s/n*100); top.insertAdjacentHTML('beforeend',`<div class="v17prog" title="نسبة ما شاهدته من أعمالك"><span>شاهدت ${s} من ${n}</span><div class="bt"><div class="bf" style="width:${Math.max(2,pc)}%"></div></div><b>${pc}٪</b></div>`); } }
    catch(e){ logErr('works',e.message,e.stack); } return r; };
});
// ---------- 6) الإحصائيات: النقر على دولة/وسم/موقع يفتح الممثلات أو الأعمال المقابلة ----------
mod('stats',()=>{
  const _ds=drawStatsModal;
  drawStatsModal=async function(){ const r=await _ds.apply(this,arguments); try{ decorate(); }catch(e){ logErr('stats',e.message,e.stack); } return r; };
  function decorate(){
    const m=$$('mStats'); if(!m) return;
    m.querySelectorAll('.gc').forEach(g=>{ const h=g.querySelector('h3'); if(!h) return; const t=h.textContent.trim(); let n=0;
      if(t==='الدول') g.querySelectorAll('.brow').forEach(r=>{ const b=r.querySelector('.bl'); if(b){ r.dataset.v17co=b.textContent; r.classList.add('v17go'); n++; } });
      else if(t==='أكثر الوسوم') g.querySelectorAll('.cloud span').forEach(sp=>{ sp.dataset.v17tg=(sp.firstChild?sp.firstChild.textContent:'').replace(/^#/,''); sp.classList.add('v17go'); n++; });
      else if(t==='أكثر المواقع') g.querySelectorAll('.siter').forEach(r=>{ const b=r.querySelector('.nm'); if(b){ r.dataset.v17st=b.textContent; r.classList.add('v17go'); n++; } });
      if(n&&!g.querySelector('.v17hint')) g.insertAdjacentHTML('beforeend','<div class="src v17hint">اضغط على أي عنصر لعرض ما يخصّه</div>'); });
  }
  $$('mStats').addEventListener('click',e=>{
    const c=e.target.closest('[data-v17co]'), t=e.target.closest('[data-v17tg]'), st=e.target.closest('[data-v17st]'); if(!(c||t||st)) return;
    e.stopPropagation(); e.preventDefault(); closeOv('ovStats');
    if(c&&window.v17Api) window.v17Api.byCountry(c.dataset.v17co);
    else if(t){ state.fav=false; state.list=null; state.smart=null; state.tag=t.dataset.v17tg; $$('q').value=''; render(true); scrollTo({top:0,behavior:'smooth'}); }
    else if(st){ wState.site=st.dataset.v17st; openWorksHub('recent'); } },true);
});

// ---------- 7) النموذج: حماية من فقدان التعديلات غير المحفوظة ----------
mod('form',()=>{
  const ids=['fName','fAl','fCo','fBi','fTa','fNo'];
  let snap='';
  const val=()=>ids.map(id=>{ const el=$$(id); return el?el.value:''; }).join('\u0001');
  const _of=openForm;
  openForm=function(){ const r=_of.apply(this,arguments); try{ snap=val(); const c=$$('fCancel'); if(c) c.onclick=async()=>{ if(val()===snap||await askConfirm('لديك تغييرات غير محفوظة. تجاهلها وإغلاق النافذة؟','تجاهل',true)) closeOv('ovForm'); }; }catch(e){ logErr('form',e.message,e.stack); } return r; };
  document.addEventListener('keydown',async e=>{ if(e.key!=='Escape'||!$$('ovForm').classList.contains('show')||document.querySelector('#ovAsk.show')) return;
    if(val()===snap) return; e.stopImmediatePropagation(); e.preventDefault(); if(await askConfirm('لديك تغييرات غير محفوظة. تجاهلها وإغلاق النافذة؟','تجاهل',true)) closeOv('ovForm'); },true);
});
})();

;

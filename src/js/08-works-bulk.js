/* ---- 08-works-bulk.js ---- */
/* ===== v18 — تطوير قسم الأعمال (إضافي: لا يحذف شيئًا) =====
   تحديد جماعي + فلتر حالة سريع + تصدير + شريط إحصاء. كل شيء معزول بـ try/catch ويُسجَّل في vkte_errlog. */
(function(){
'use strict';
const $$=id=>document.getElementById(id);
const lerr=(k,e)=>{ try{ const a=JSON.parse(LS.get('vkte_errlog','[]'))||[]; a.push({t:Date.now(),k:'v18:'+k,m:String(e&&e.message||e).slice(0,300),s:String(e&&e.stack||'').split('\n').slice(0,3).join(' | ').slice(0,300)}); LS.set('vkte_errlog',JSON.stringify(a.slice(-40))); }catch{} };
const S={on:false,keys:new Set(),st:''};
const STS=[['','الكل'],['unrated','غير مقيَّمة'],['rated','مقيَّمة'],['noted','فيها ملاحظة'],['nolist','بلا قائمة'],['notag','بلا وسوم'],['nopic','بلا صورة']];

// ---- فلتر الحالة (يلفّ wFilterAndSort) ----
const _wf=wFilterAndSort;
wFilterAndSort=function(all){ let a=_wf.apply(this,arguments);
  try{ switch(S.st){
    case 'unrated': a=a.filter(g=>!(g.r>0)); break;
    case 'rated': a=a.filter(g=>g.r>0); break;
    case 'noted': a=a.filter(g=>g.n); break;
    case 'nolist': a=a.filter(g=>!(g.ls&&g.ls.length)); break;
    case 'notag': a=a.filter(g=>!(g.tg&&g.tg.length)); break;
    case 'nopic': a=a.filter(g=>!g.p&&!g.who.some(i=>wPic(i,g.t))); break;
  } }catch(e){ lerr('filter',e); }
  return a; };

// ---- عمليات جماعية (حفظ واحد فقط) ----
function bulk(fn){
  const keys=S.keys; if(!keys.size) return 0;
  const gs=wAll().filter(g=>keys.has(g.key)), touched=new Set();
  gs.forEach(g=>g.refs.forEach(({it,idx})=>{ const w=it.works[idx]; if(!w) return; fn(w,g); it.updated=Date.now(); touched.add(it); }));
  _wCache=null; if(touched.size) save([...touched]); updWorksDot(); return gs.length; }
function bulkDelete(){
  const snap=new Map(); 
  const gs=wAll().filter(g=>S.keys.has(g.key)), per=new Map();
  gs.forEach(g=>g.refs.forEach(({it,idx})=>{ if(!per.has(it)) per.set(it,new Set()); per.get(it).add(idx); }));
  per.forEach((set,it)=>{ snap.set(it,it.works||[]); it.works=(it.works||[]).filter((_,i)=>!set.has(i)); it.updated=Date.now(); });
  _wCache=null; save([...per.keys()]); updWorksDot(); undoBar(snap,gs.length); return gs.length; }
function undoBar(snap,n){ document.getElementById('v18undo')?.remove(); const d=document.createElement('div'); d.id='v18undo'; d.className='v18undo';
  d.innerHTML=`<span>حُذف ${n} عمل</span><button type="button" class="btn gold">تراجع</button>`; document.body.appendChild(d);
  const t=setTimeout(()=>d.remove(),10000);
  d.querySelector('button').onclick=()=>{ clearTimeout(t); snap.forEach((w,it)=>{ it.works=w; it.updated=Date.now(); }); _wCache=null; save([...snap.keys()]); updWorksDot(); d.remove(); toast('تمت استعادة '+n+' عمل ✓'); if($$('ovWorks').classList.contains('show')) drawWorksHub(); }; }
const mark=w=>{ if(!w.wd) w.wd=todayStr(); };

// ---- تصدير ----
function visibleGroups(){ return S.keys.size?wAll().filter(g=>S.keys.has(g.key)):wFilterAndSort(wAll()); }
function csv(gs){ const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const H=['العنوان','الممثلات','الموقع','التاريخ','المدة (د)','التقييم','شوهد','تاريخ المشاهدة','للمشاهدة','أنصح به','وسوم','قوائم','ملاحظة'];
  const rows=gs.map(g=>[g.t,g.who.map(i=>i.name).join(' + '),g.s,g.d||g.y,g.du||'',g.r||'',g.seen?'نعم':'',g.wd||'',g.q?'نعم':'',g.rec?'نعم':'',(g.tg||[]).join(' | '),(g.ls||[]).map(id=>(wlists.find(x=>x.id===id)||{}).name).filter(Boolean).join(' | '),g.n||''].map(q).join(','));
  return '﻿'+[H.map(q).join(','),...rows].join('\r\n'); }
function download(name,text,type){ if(typeof Backup!=='undefined'&&IS_NATIVE){ Backup.shareText(name,text); return; } const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); }

// ---- الرسم ----
const _dw=drawWorksHub;
drawWorksHub=function(){ const r=_dw.apply(this,arguments);
  try{ decorate(); }catch(e){ lerr('decorate',e); } return r; };

function decorate(){
  const m=$$('mWorks'); if(!m) return;
  // مفاتيح لم تعد موجودة
  if(S.keys.size){ const ex=new Set(wAll().map(g=>g.key)); [...S.keys].forEach(k=>{ if(!ex.has(k)) S.keys.delete(k); }); }
  const host=$$('wHubContent'); if(!host) return;
  const all=wAll(); const sec=['more','sites','cal'].includes(wState.tab);
  if(!sec&&!host.querySelector('.v18tools')){
    const rated=all.filter(g=>g.r>0), avg=rated.length?(rated.reduce((a,g)=>a+g.r,0)/rated.length).toFixed(1):'—';
    const seenMin=all.filter(g=>g.seen).reduce((a,g)=>a+(g.du||30),0), leftMin=all.filter(g=>!g.seen&&!isUpcoming(g)).reduce((a,g)=>a+(g.du||30),0);
    host.insertAdjacentHTML('afterbegin',`<div class="v18tools">
      <div class="v18st"><span>★ المتوسط <b>${avg}</b></span><span>غير مقيَّمة <b>${all.length-rated.length}</b></span>${seenMin?`<span>⏱ شاهدت <b>${fmtDur(seenMin)}</b></span>`:''}${leftMin?`<span>متبقٍ <b>${fmtDur(leftMin)}</b></span>`:''}</div>
      <div class="v18row">
        <button type="button" class="btn ${S.on?'gold':''}" data-v18="sel">${S.on?'✓ إنهاء التحديد':'☑ تحديد'}</button>
        <button type="button" class="btn" data-v18="csv" title="تصدير ${S.keys.size?'المحدّد':'النتائج الحالية'} CSV">⬇ CSV</button>
        <button type="button" class="btn" data-v18="copy" title="نسخ العناوين">⧉ نسخ</button>
        <div class="v18chips">${STS.map(([k,n])=>`<span class="chip ${S.st===k?'on':''}" data-v18st="${k}">${n}</span>`).join('')}</div>
      </div></div>`);
  }
  m.classList.toggle('v18selmode',S.on); m.classList.toggle('flt-open',!!wState.showFlt||!!S.st);
  m.querySelectorAll('[data-wkey]').forEach(c=>{ if(c.matches('.wkc,.wi')){ c.classList.add('v18c'); c.classList.toggle('v18on',S.keys.has(c.dataset.wkey)); } });
  m.querySelector('.v18bar')?.remove();
  if(S.on){
    const n=S.keys.size, wl=wlists.map(L=>`<option value="${L.id}">${esc(L.name)}</option>`).join('');
    m.insertAdjacentHTML('beforeend',`<div class="v18bar"><div class="v18cnt"><b>${n}</b> محدّد <button type="button" class="chip" data-v18="all">الظاهر</button><button type="button" class="chip" data-v18="none">لا شيء</button></div>
      <div class="v18acts ${n?'':'dis'}">
        <button type="button" class="btn" data-v18a="seen">👁 شوهد</button><button type="button" class="btn" data-v18a="unseen">غير مشاهَد</button>
        <button type="button" class="btn" data-v18a="q">🔖 للمشاهدة</button><button type="button" class="btn" data-v18a="unq">إزالة 🔖</button>
        <button type="button" class="btn" data-v18a="rec">👍 أنصح</button>
        <select class="sel" data-v18sel="rate"><option value="">★ تقييم…</option>${[5,4,3,2,1].map(x=>`<option value="${x}">${'★'.repeat(x)}</option>`).join('')}<option value="0">مسح التقييم</option></select>
        <select class="sel" data-v18sel="addl"><option value="">📂 إضافة إلى…</option><option value="__new">＋ قائمة جديدة</option>${wl}</select>
        ${wlists.length?`<select class="sel" data-v18sel="reml"><option value="">إزالة من…</option>${wl}</select>`:''}
        <button type="button" class="btn" data-v18a="tag">＃ وسم</button>
        <button type="button" class="btn" data-v18a="del" style="color:#ff8a9a">🗑 حذف</button>
      </div></div>`);
  }
}

function redraw(){ const top=$$('mWorks').scrollTop; drawWorksHub(); $$('mWorks').scrollTop=top; }
function setSel(on){ S.on=on; if(!on) S.keys.clear(); redraw(); }
function toggleKey(k){ S.keys.has(k)?S.keys.delete(k):S.keys.add(k); redraw(); }

// ---- الأحداث (التقاط قبل معالجات التطبيق) ----
{
  const m=$$('mWorks'); let lpT=0, lpFired=false;
  m.addEventListener('click',async e=>{
    try{
      const t=e.target;
      const b=t.closest('[data-v18]'), st=t.closest('[data-v18st]'), a=t.closest('[data-v18a]');
      if(st){ e.stopPropagation(); S.st=st.dataset.v18st; wState.lim=30; redraw(); return; }
      if(b){ e.stopPropagation(); const k=b.dataset.v18;
        if(k==='sel') setSel(!S.on);
        else if(k==='all'){ wFilterAndSort(wAll()).forEach(g=>S.keys.add(g.key)); redraw(); }
        else if(k==='none'){ S.keys.clear(); redraw(); }
        else if(k==='csv'){ const gs=visibleGroups(); if(!gs.length){ toast('لا أعمال للتصدير'); return; } download('vkte-works-'+todayStr()+'.csv',csv(gs),'text/csv;charset=utf-8'); toast('صُدِّر '+gs.length+' عمل'); }
        else if(k==='copy'){ const gs=visibleGroups(); try{ await navigator.clipboard.writeText(gs.map(g=>g.t+(g.s?' — '+g.s:'')).join('\n')); toast('نُسخ '+gs.length+' عنوان'); }catch{ toast('تعذّر النسخ'); } }
        return; }
      if(a){ e.stopPropagation(); const k=a.dataset.v18a, n0=S.keys.size; if(!n0) return; let n=0;
        if(k==='seen') n=bulk(w=>{ w.w=1; delete w.upc; mark(w); });
        else if(k==='unseen') n=bulk(w=>{ delete w.w; });
        else if(k==='q') n=bulk(w=>{ w.q=1; });
        else if(k==='unq') n=bulk(w=>{ delete w.q; });
        else if(k==='rec') n=bulk(w=>{ w.rec=1; });
        else if(k==='tag'){ const v=await askText('وسم للمحدّد ('+n0+')','','اكتب وسمًا، أو -وسم لإزالته'); if(v){ const rm=v.trim().startsWith('-'), tg=v.trim().replace(/^-/,'').trim().slice(0,30); if(tg) n=bulk(w=>{ const s=new Set(w.tg||[]); rm?s.delete(tg):s.add(tg); if(s.size) w.tg=[...s].slice(0,10); else delete w.tg; }); } }
        else if(k==='del'){ if(await askConfirm('حذف '+n0+' عمل من كل الممثلات المرتبطة؟ يمكنك التراجع خلال 10 ثوانٍ.','حذف',true)){ n=bulkDelete(); S.keys.clear(); redraw(); return; } }
        if(n){ toast('تم على '+n+' عمل ✓'); redraw(); } return; }
      // نقر على بطاقة أثناء وضع التحديد
      if(S.on){ const c=t.closest('[data-wkey]'); if(c&&c.matches('.wkc,.wi')&&!t.closest('.v18bar')){ e.stopPropagation(); e.preventDefault(); toggleKey(c.dataset.wkey); } }
    }catch(er){ lerr('click',er); }
  },true);
  m.addEventListener('change',async e=>{
    try{ const s=e.target.closest('[data-v18sel]'); if(!s||!S.keys.size){ return; } e.stopPropagation(); const k=s.dataset.v18sel, v=s.value; s.value=''; if(v==='') return; let n=0;
      if(k==='rate') n=bulk(w=>{ if(+v) w.r=+v; else delete w.r; });
      else if(k==='addl'){ let id=v; if(v==='__new'){ const nm=await askText('اسم قائمة الأعمال الجديدة','','مثال: للسهرة'); if(!nm) return; id=uid(); wlists.push({id,name:nm}); saveWLists(); }
        n=bulk(w=>{ const set=new Set(w.ls||[]); set.add(id); w.ls=[...set]; }); }
      else if(k==='reml') n=bulk(w=>{ const set=new Set(w.ls||[]); set.delete(v); if(set.size) w.ls=[...set]; else delete w.ls; });
      if(n){ toast('تم على '+n+' عمل ✓'); redraw(); } }catch(er){ lerr('change',er); } },true);
  // ضغطة مطوّلة لبدء التحديد
  const cancel=()=>clearTimeout(lpT);
  m.addEventListener('pointerdown',e=>{ if(S.on||e.button>0) return; const c=e.target.closest('.wkc[data-wkey],.wi[data-wkey]'); if(!c||e.target.closest('button,select,input,a')) return; lpFired=false; const k=c.dataset.wkey; const x=e.clientX,y=e.clientY; c._p=[x,y];
    lpT=setTimeout(()=>{ lpFired=true; try{ navigator.vibrate&&navigator.vibrate(12); }catch{} S.on=true; S.keys.add(k); redraw(); },550); });
  m.addEventListener('pointermove',e=>{ const c=e.target.closest('[data-wkey]'); if(c&&c._p&&Math.hypot(e.clientX-c._p[0],e.clientY-c._p[1])>10) cancel(); });
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>m.addEventListener(ev,cancel));
  m.addEventListener('click',e=>{ if(lpFired){ e.stopPropagation(); e.preventDefault(); lpFired=false; } },true);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&S.on&&$$('ovWorks').classList.contains('show')&&!document.querySelector('#ovAsk.show')){ e.stopImmediatePropagation(); setSel(false); } },true);
}
// إغلاق المركز ينهي التحديد
$$('ovWorks').addEventListener('transitionend',()=>{ if(!$$('ovWorks').classList.contains('show')&&S.on){ S.on=false; S.keys.clear(); } });
})();

;

/* ---- 11-streaming.js ---- */
/* ===== v21 — فتح الأعمال في نوفيو/ستريميو + نسخ الاسم/الرابط + تنبيه «صدر جديد» =====
   ملاحظة صادقة: نوفيو لا يوفّر حاليًا رابطًا للبحث/فتح عمل من تطبيق آخر، ورابط nuvio:// الوحيد المدعوم يثبّت إضافة
   بلا تأكيد، لذلك لا يولّد التطبيق أي رابط nuvio:// أبدًا. وضع «نوفيو» ينسخ الاسم لتلصقه في بحث نوفيو.
   وضع «ستريميو» يستخدم رابطه الرسمي الموثّق stremio:///search?search=… ويفتح مباشرة. وفيه قالب مخصص. */
(function(){
'use strict';
const $$=id=>document.getElementById(id);
const lerr=(k,e)=>{ try{ const a=JSON.parse(LS.get('vkte_errlog','[]'))||[]; a.push({t:Date.now(),k:'v21:'+k,m:String(e&&e.message||e).slice(0,300),s:''}); LS.set('vkte_errlog',JSON.stringify(a.slice(-40))); }catch{} };
const K={app:'vkte_open_app',q:'vkte_open_q',tpl:'vkte_open_tpl',rel:'vkte_rel_last'};
const cfg=()=>({app:LS.get(K.app,'nuvio'),q:LS.get(K.q,'title'),tpl:(LS.get(K.tpl,'')||'').trim()});
const APPN={nuvio:'نوفيو',stremio:'ستريميو',custom:'التطبيق'};

/* ---------- بناء الاستعلام والرابط ---------- */
function queryFor(g){ const c=cfg(); const t=String(g.t||'').trim();
  if(c.q==='site_title') return [g.s,t].filter(Boolean).join(' ');
  if(c.q==='who_title') return [(g.who&&g.who[0]&&g.who[0].name)||'',t].filter(Boolean).join(' ');
  return t; }
function urlFor(q){ const c=cfg(); const e=encodeURIComponent(q);
  if(c.app==='stremio') return 'stremio:///search?search='+e;
  if(c.app==='custom'&&c.tpl&&/^[a-z][a-z0-9+.-]*:/i.test(c.tpl)&&!/^(javascript|data|vbscript):/i.test(c.tpl)) return c.tpl.replace(/\{q\}/g,e).replace(/\{raw\}/g,q);
  return ''; }   // نوفيو: لا رابط
async function copyText(t){ try{ if(navigator.clipboard&&window.isSecureContext){ await navigator.clipboard.writeText(t); return true; } }catch{}
  try{ const a=document.createElement('textarea'); a.value=t; a.setAttribute('readonly',''); a.style.cssText='position:fixed;opacity:0;top:0'; document.body.appendChild(a); a.select(); const ok=document.execCommand('copy'); a.remove(); return ok; }catch{ return false; } }
const go=u=>{ if(window.__v21go) window.__v21go(u); else location.href=u; };

async function openQ(q){ const c=cfg(), u=urlFor(q);
  if(u){ go(u); toast('جارٍ الفتح في '+APPN[c.app]+'…'); return; }
  const ok=await copyText(q); toast(ok?`نُسخ «${q.length>28?q.slice(0,28)+'…':q}» — افتح نوفيو والصقه في البحث`:'تعذّر النسخ، انسخ الاسم يدويًا'); }
async function copyName(q){ const ok=await copyText(q); toast(ok?'تم نسخ الاسم ✓':'تعذّر النسخ'); }
async function copyLink(q){ const u=urlFor(q); if(!u){ const ok=await copyText(q); toast(ok?'نوفيو لا يوفّر رابط بحث بعد — نُسخ الاسم بدلًا منه':'تعذّر النسخ'); return; } const ok=await copyText(u); toast(ok?'تم نسخ رابط البحث ✓':'تعذّر النسخ'); }
const groupByKey=k=>wAll().find(x=>x.key===k);

/* ---------- 1) داخل شاشة العمل ---------- */
const _ws=wSheet;
wSheet=function(key){ const r=_ws.apply(this,arguments);
  try{ const b=$$('shSrchG'); if(b&&!b.parentElement.querySelector('.v21act')){ const g=groupByKey(key); if(g){ const q=queryFor(g), c=cfg();
      const mk=(cls,txt,fn)=>{ const x=document.createElement('button'); x.type='button'; x.className='btn v21act '+cls; x.textContent=txt; x.onclick=fn; return x; };
      const o=mk('gold','▶ '+(c.app==='stremio'?'افتح في ستريميو':c.app==='custom'?'افتح في التطبيق':'نوفيو: انسخ الاسم للبحث'),()=>openQ(queryFor(groupByKey(key)||g)));
      const l=mk('','🔗 نسخ رابط البحث',()=>copyLink(queryFor(groupByKey(key)||g)));
      b.after(l); b.after(o); } } }catch(e){ lerr('sheet',e); } return r; };

/* ---------- 2) زر ▶ سريع في بطاقات وصفوف مركز الأعمال (يُحقن تلقائيًا ولو أُضيفت بطاقات لاحقًا) ---------- */
const quickBtn='<button type="button" class="ib sm v21q" data-wnv title="نوفيو / ستريميو">▶</button>';
function injectQuick(root){ root.querySelectorAll('[data-wkey]').forEach(card=>{ if(card.querySelector('[data-wnv]')) return;
  const acts=card.querySelector('.wk-acts'); if(acts){ acts.insertAdjacentHTML('afterbegin',quickBtn); return; }
  const q=card.querySelector('[data-wact="q"]'); if(q) q.insertAdjacentHTML('beforebegin',quickBtn); }); }
try{ const mw=$$('mWorks'); if(mw){ let t=0; new MutationObserver(()=>{ if(t) return; t=requestAnimationFrame(()=>{ t=0; try{ injectQuick(mw); }catch(e){ lerr('inj',e); } }); }).observe(mw,{childList:true,subtree:true}); } }catch(e){ lerr('hub',e); }
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-wnv]'); if(!b) return;
  e.stopImmediatePropagation(); e.preventDefault(); const card=b.closest('[data-wkey]'); const g=card&&groupByKey(card.dataset.wkey); if(g) openQ(queryFor(g)); },true);

/* ---------- 3) في ملف الممثلة ---------- */
const _od=openDetail;
openDetail=function(id){ const r=_od.apply(this,arguments);
  try{ const it=items.find(x=>x.id===(typeof id==='string'?id:curDetail)); const d=document.querySelector('#mDetail .dock2'); if(it&&d&&!d.querySelector('#dNv')){ const b=document.createElement('button'); b.className='btn'; b.id='dNv'; b.type='button'; b.textContent='▶ ابحث باسمها';
      b.onclick=()=>openQ(it.name); d.insertBefore(b,d.lastElementChild); } }catch(e){ lerr('detail',e); } return r; };

/* ---------- 4) الإعدادات ---------- */
try{
  const m=document.querySelector('#ovSet .modal'); const det=document.createElement('details'); det.className='sec v21set';
  det.innerHTML=`<summary>فتح الأعمال في نوفيو / ستريميو <em class="v19new">جديد</em></summary><div class="secb">
    <p class="src" style="font-size:.85rem;margin-bottom:8px;line-height:1.8">يظهر زر ▶ في شاشة كل عمل وبطاقاته وفي ملف الممثلة.<br><b>نوفيو:</b> لا يدعم حاليًا فتح بحث برابط، لذا يُنسخ الاسم لتلصقه في البحث (لا يولّد التطبيق روابط nuvio:// لأنها تثبّت إضافات بلا تأكيد).<br><b>ستريميو:</b> يفتح البحث مباشرة برابطه الرسمي.</p>
    <label>التطبيق</label><select class="in" id="v21App"><option value="nuvio">نوفيو — نسخ الاسم</option><option value="stremio">ستريميو — فتح مباشر</option><option value="custom">قالب رابط مخصص</option></select>
    <label style="margin-top:8px">ماذا يُبحث عنه؟</label><select class="in" id="v21Q"><option value="title">عنوان العمل</option><option value="site_title">الموقع + العنوان</option><option value="who_title">اسم الممثلة + العنوان</option></select>
    <div id="v21TplBox" style="display:none;margin-top:8px"><label>القالب (استخدم <span dir="ltr">{q}</span> للاستعلام المشفّر)</label><input class="in" id="v21Tpl" dir="ltr" placeholder="myapp://search?q={q}" autocomplete="off"></div>
    <div class="actions" style="justify-content:flex-start"><button class="btn" id="v21Test" type="button">تجربة بعنوان تجريبي</button></div></div>`;
  m.insertBefore(det,m.lastElementChild);
  const draw=()=>{ const c=cfg(); $$('v21App').value=c.app; $$('v21Q').value=c.q; $$('v21Tpl').value=c.tpl; $$('v21TplBox').style.display=c.app==='custom'?'block':'none'; };
  $$('bSet').addEventListener('click',draw);
  $$('v21App').onchange=()=>{ LS.set(K.app,$$('v21App').value); draw(); };
  $$('v21Q').onchange=()=>LS.set(K.q,$$('v21Q').value);
  $$('v21Tpl').onchange=()=>LS.set(K.tpl,$$('v21Tpl').value.trim());
  $$('v21Test').onclick=()=>openQ(queryFor({t:'Test Title',s:'Site',who:[{name:'Name'}]}));
}catch(e){ lerr('settings',e); }

/* ---------- 5) تنبيه «صدر جديد» داخل التطبيق ---------- */
const dnum=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||''); return m?+m[1]*10000+ +m[2]*100+ +m[3]:0; };
function newReleases(){ const T=todayStr(), last=LS.get(K.rel,''); const lo=last?dnum(last):dnum(T)-1, hi=dnum(T);
  return wAll().filter(g=>!g.seen&&g.d&&dnum(g.d)>lo&&dnum(g.d)<=hi).sort((a,b)=>dnum(b.d)-dnum(a.d)); }
function drawRel(){ const old=$$('v21rel'); if(old) old.remove();
  const L=newReleases(); if(!L.length) return; const main=document.querySelector('main'); if(!main) return;
  const el=document.createElement('section'); el.id='v21rel'; el.className='v21rel';
  el.innerHTML=`<div class="v21rh"><b>🎬 صدر جديد <em>${L.length}</em></b><span><button type="button" class="ib sm" data-rall title="عرض في الأعمال">↗</button><button type="button" class="ib sm" data-rx title="إخفاء">✕</button></span></div>`+
    L.slice(0,3).map(g=>`<div class="v21rr" data-k="${esc(g.key)}"><div class="v21rt" data-rs="1"><b dir="auto">${esc(g.t)}</b><small>${esc([g.who.map(x=>x.name).join('، '),g.s,fmtWd(g.d)].filter(Boolean).join(' · '))}</small></div><button type="button" class="ib sm" data-ro title="افتح/انسخ">▶</button><button type="button" class="ib sm" data-rc title="نسخ الاسم">📋</button></div>`).join('')+
    (L.length>3?`<div class="v21more">و${L.length-3} أخرى…</div>`:'');
  main.prepend(el);
  el.onclick=e=>{ const row=e.target.closest('.v21rr'); const k=row&&row.dataset.k, g=k&&groupByKey(k);
    if(e.target.closest('[data-rx]')){ LS.set(K.rel,todayStr()); el.remove(); return; }
    if(e.target.closest('[data-rall]')){ LS.set(K.rel,todayStr()); el.remove(); $$('nWorks').click(); return; }
    if(!g) return;
    if(e.target.closest('[data-ro]')) openQ(queryFor(g)); else if(e.target.closest('[data-rc]')) copyName(queryFor(g)); else wSheet(k); };
}
setTimeout(()=>{ try{ drawRel(); }catch(e){ lerr('rel',e); } },3500);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&LS.get(K.rel,'')!==todayStr()) try{ drawRel(); }catch(e){ lerr('rel2',e); } });
})();

;

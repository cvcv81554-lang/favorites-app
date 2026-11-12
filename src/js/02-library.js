/* ---- 02-library.js ---- */
// ===== العرض الرئيسي (الممثلات) =====
let view=LS.get('vkte_view','2');
function applyView(){ $('grid').classList.toggle('c3',view==='3'); $('grid').classList.toggle('lst',view==='l'); }
$('bView').onclick=()=>{ const V=['2','3','l']; view=V[(V.indexOf(view)+1)%3]; LS.set('vkte_view',view); applyView(); toast(view==='l'?'عرض قائمة':view==='3'?'شبكة مضغوطة':'شبكة'); };
function list(){
  let l=items.slice(); const q=$('q').value.trim().toLowerCase();
  if(state.fav) l=l.filter(i=>i.fav);
  if(state.list) l=l.filter(i=>(i.lists||[]).includes(state.list));
  if(state.smart){ const sm=SMART.find(x=>x[0]===state.smart); if(sm) l=l.filter(sm[2]); }
  if(state.tag) l=l.filter(i=>(i.tags||[]).includes(state.tag));
  if(q) l=l.filter(i=>[i.name,i.aliases,i.country,(i.tags||[]).join(' '),i.notes,(i.works||[]).map(w=>w.t+' '+w.s).join(' '),(i.accounts||[]).map(a=>a.v).join(' ')].join(' ').toLowerCase().includes(q));
  const s=$('sort').value;
  if(s==='rating') l.sort((a,b)=>(b.rating||0)-(a.rating||0));
  else if(s==='name') l.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  else if(s==='works') l.sort((a,b)=>(b.works||[]).length-(a.works||[]).length);
  else if(s==='added') l.sort((a,b)=>(b.added||b.updated||0)-(a.added||a.updated||0));
  else if(s==='oldest') l.sort((a,b)=>(a.added||a.updated||0)-(b.added||b.updated||0));
  else if(s==='young') l.sort((a,b)=>(b.birth||'')<(a.birth||'')?-1:(b.birth||'')>(a.birth||'')?1:0);
  else l.sort((a,b)=>b.updated-a.updated);
  return l;
}
// ===== عرض تدريجي للبطاقات: دفعة أولى سريعة ثم البقية عند الاقتراب من نهاية الشاشة =====
const cardHtml=(i,n)=>{
  const ps=i.photos||[], p=pic(i);
  const imgs=p?`<img class="on" src="${p}" decoding="async" ${n<6?'fetchpriority="high"':'loading="lazy"'} alt="">`+(ps.length>1?`<img decoding="async" alt="">`:''):'♡';
  const dots=ps.length>1?`<div class="np">${ps.slice(0,6).map((_,k)=>`<i class="${k===0?'on':''}"></i>`).join('')}</div>`:'';
  return `<div class="card" data-id="${i.id}" style="--i:${Math.min(n,14)}">
  <div class="ph">${imgs}${i.rating?`<span class="rt">★ ${i.rating.toFixed(1)}</span>`:''}${dots}</div>
  <button class="favbtn ${i.fav?'on':''}" data-fav="${i.id}" aria-label="مفضّلة">${icon('star')}</button>
  <div class="info"><div class="nm">${esc(i.name)}</div>
  <div class="sub">${esc(i.country||(i.rating?'':'بدون تقييم'))||'&nbsp;'}</div></div></div>`; };
const CARD_CHUNK=TVLITE?15:30;
let gridSentinel=null;
const moreIO=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting)) renderMore(); },{rootMargin:'1100px 0px'});
function renderMore(first){
  const a=render.list||[], from=render.n||0, g=$('grid');
  if(!gridSentinel){ gridSentinel=document.createElement('div'); gridSentinel.id='gridMore'; gridSentinel.style.cssText='height:1px;width:100%'; g.after(gridSentinel); moreIO.observe(gridSentinel); }
  if(from>=a.length) return;
  const to=Math.min(a.length,from+(first?CARD_CHUNK+6:CARD_CHUNK));
  g.insertAdjacentHTML('beforeend',a.slice(from,to).map((i,k)=>cardHtml(i,from+k)).join(''));
  render.n=to;
  const cs=g.children; for(let k=from;k<cs.length;k++) io.observe(cs[k]);
  if(to<a.length) requestAnimationFrame(()=>{ if(gridSentinel.getBoundingClientRect().top<innerHeight+1100) renderMore(); });
}
function render(anim){
  const tags=[...new Set(items.flatMap(i=>i.tags||[]))];
  const L=lists.find(x=>x.id===state.list);
  const SM=SMART.find(x=>x[0]===state.smart);
  const nW=items.reduce((a,i)=>a+(i.works||[]).length,0);
  $('cntAll').textContent=items.length?items.length+' ممثلة'+(nW?' · '+nW+' عمل':''):'';
  $('chips').innerHTML=`<span class="chip ${state.fav?'on':''}" data-fv="1">★ المفضّلة${state.fav?' ✕':''}</span>`+(L?`<span class="chip on" data-cl="1">${esc(L.name)} ✕</span>`:'')+(SM?`<span class="chip on" data-cs="1">${esc(SM[1])} ✕</span>`:'')+tags.map(t=>`<span class="chip ${state.tag===t?'on':''}" data-t="${esc(t)}">#${esc(t)}</span>`).join('');
  $('nHome').classList.toggle('on',!$('ovWorks').classList.contains('show')&&!$('ovLists').classList.contains('show')&&!$('ovStats').classList.contains('show'));
  $('nLists').classList.toggle('on',!!state.list||!!state.smart);
  const l=list();
  if(anim){ $('grid').classList.add('intro'); clearTimeout(render.h); render.h=setTimeout(()=>$('grid').classList.remove('intro'),1800); }
  render.list=l; render.n=0; $('grid').innerHTML=''; vis.clear(); io.disconnect();
  renderMore(true);
  $('empty').innerHTML=items.length?'<b>لا توجد نتائج</b>جرّب بحثًا آخر أو أزل الفلتر':'<b>قائمتك فارغة</b>أضف أول ممثلة بالزر ＋ في الأسفل';
  $('empty').style.display=l.length?'none':'block';
  updWorksDot();
}
$('chips').onclick=e=>{ const c=e.target.closest('.chip'); if(!c) return;
  if(c.dataset.fv){ state.fav=!state.fav; render(true); return; }
  if(c.dataset.cl){ state.list=null; render(true); return; }
  if(c.dataset.cs){ state.smart=null; render(true); return; }
  state.tag=state.tag===c.dataset.t?null:c.dataset.t;
  render(true); };
$('grid').onclick=e=>{
  const f=e.target.closest('[data-fav]');
  if(f){ const it=items.find(i=>i.id===f.dataset.fav); if(!it) return; it.fav=!it.fav; save(it); f.classList.toggle('on',it.fav); if(state.fav) render(); return; }
  const c=e.target.closest('.card'); if(c) openDetail(c.dataset.id);
};
let qT; $('q').oninput=()=>{ clearTimeout(qT); qT=setTimeout(()=>render(),120); }; $('sort').onchange=()=>render(true);
$('nHome').onclick=()=>{ closeOv('ovWorks'); closeOv('ovLists'); closeOv('ovStats'); state={fav:false,tag:null,list:null,smart:null}; $('q').value=''; render(true); window.scrollTo({top:0,behavior:'smooth'}); };
$('nWorks').onclick=()=>openWorksHub();
$('nLists').onclick=()=>openLists();

// ===== تبديل صور البطاقات تلقائيًا (ناعم، للبطاقات الظاهرة فقط) =====
const vis=new Set();
const io=new IntersectionObserver(es=>es.forEach(e=>{ e.isIntersecting?vis.add(e.target):vis.delete(e.target); }),{rootMargin:'80px'});
function watchCards(){ vis.clear(); io.disconnect(); document.querySelectorAll('.card').forEach(c=>io.observe(c)); }
const thumbCache=new Map();
function smallOf(src){ if(!src) return Promise.resolve(''); if(src.length<60000&&!src.startsWith('blob:')) return Promise.resolve(src);
  let p=thumbCache.get(src); if(p) return p;
  p=mkThumb(src,IMGQ.thumb).catch(()=>src); if(thumbCache.size>150) thumbCache.delete(thumbCache.keys().next().value);
  thumbCache.set(src,p); return p; }
async function swapCard(c,it){
  const ps=it.photos||[]; if(ps.length<2) return;
  const k=((+c.dataset.k||0)+1)%ps.length, act=+c.dataset.act||0;
  const im=c.querySelectorAll('.ph img'); if(im.length<2) return;
  const cur=im[act], nx=im[1-act];
  const sm=await smallOf(ps[k]); if(!c.isConnected) return;
  const go=()=>{ nx.classList.add('on'); cur.classList.remove('on'); c.dataset.act=1-act; c.dataset.k=k;
    c.querySelectorAll('.np i').forEach((d,n)=>d.classList.toggle('on',n===k%6)); };
  if(nx.getAttribute('src')===sm) go(); else { nx.onload=go; nx.src=sm; }
}
let lastScroll=0; addEventListener('scroll',()=>{ lastScroll=Date.now(); },{passive:true});
setInterval(()=>{
  if(document.hidden||REDUCED||Date.now()-lastScroll<1500||['ovWorks','ovDetail','ovStats','ovForm','ovLists','ovPick'].some(x=>$(x).classList.contains('show'))) return;
  const map=new Map(items.map(i=>[i.id,i])); let n=0;
  [...vis].sort(()=>Math.random()-.5).forEach(c=>{ if(n>=4) return; const it=map.get(c.dataset.id); if(it&&(it.photos||[]).length>1) setTimeout(()=>swapCard(c,it),(n++)*600); });
},7000);

// ===== القوائم (ورقة كاملة بأغلفة من صور أعضائها) =====
function openLists(){
  const cards=lists.map(L=>{ const ms=items.filter(i=>(i.lists||[]).includes(L.id)); const imgs=ms.map(pic).filter(Boolean).slice(0,4);
    const rated=ms.filter(i=>i.rating>0), avg=rated.length?rated.reduce((a,i)=>a+i.rating,0)/rated.length:0;
    return `<div class="lc ${state.list===L.id?'on':''}" data-l="${L.id}" role="button" tabindex="0"><div class="lcv n${imgs.length}">${imgs.length?imgs.map(s=>`<img src="${s}" loading="lazy" decoding="async" alt="">`).join(''):icon('folder')}</div>
      <div class="lca"><button class="ib sm glass" data-lr="${L.id}" aria-label="إعادة تسمية">${icon('edit')}</button><button class="ib sm glass" data-ld="${L.id}" aria-label="حذف">${icon('trash')}</button></div>
      <div class="lcb"><div class="lcn">${esc(L.name)}</div><div class="lcm">${ms.length} ممثلة${avg?` · ★ ${avg.toFixed(1)}`:''}</div></div></div>`; }).join('');
  const smartHtml=SMART.map(([k,n,fn])=>{ const c=items.filter(fn).length; return `<span class="chip ${state.smart===k?'on':''}" data-sm="${k}">${esc(n)} (${c})</span>`; }).join('');
  $('mLists').innerHTML=`<div class="fh"><h2>القوائم والأدوات</h2><button class="ib" id="lClose" aria-label="إغلاق">${icon('x')}</button></div>
    <p class="src fsub">${lists.length?'اضغط على قائمة لعرض ممثلاتها':'نظّم ممثلاتك في قوائم، مثل «الأفضل هذا العام» أو «أريد مشاهدتها»'}</p>
    <div class="lgrid">${cards}<button class="lc new" id="lNew">${icon('plus')}<span>قائمة جديدة</span></button></div>
    <div style="padding:0 16px 14px"><h3 style="margin:6px 0 8px;color:var(--gold2);font-size:.95rem">قوائم ذكية تلقائية</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${smartHtml}</div></div>
    <div style="padding:0 16px 14px"><h3 style="margin:6px 0 8px;color:var(--gold2);font-size:.95rem">أدوات المجموعة</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="bToolCmp">⚖️ مقارنة ممثلتين</button><button class="btn" id="bToolTags">🏷️ مدير الوسوم</button><button class="btn gold" id="bGoWorks">${icon('film')} فتح مركز الأعمال</button></div></div>
    ${(state.list||state.smart)?'<div class="actions" style="justify-content:center;padding:0 16px"><button class="btn" id="lClear">إلغاء التصفية الحالية</button></div>':''}`;
  $('mLists').classList.toggle('blur',document.body.classList.contains('blur'));
  $('ovLists').classList.add('show'); $('mLists').scrollTop=0;
  $('lClose').onclick=()=>closeOv('ovLists');
  if($('lClear')) $('lClear').onclick=()=>{ state.list=null; state.smart=null; closeOv('ovLists'); render(true); };
  $('bToolCmp').onclick=()=>toolCompare();
  $('bToolTags').onclick=()=>toolTags();
  $('bGoWorks').onclick=()=>{ closeOv('ovLists'); openWorksHub(); };
  $('lNew').onclick=async()=>{ const n=await askText('اسم القائمة الجديدة','','مثال: الأفضل هذا العام'); if(n){ lists.push({id:uid(),name:n}); saveLists(); openLists(); } };
  $('mLists').onclick=async e=>{
    const sm=e.target.closest('[data-sm]');
    if(sm){ state.list=null; state.smart=state.smart===sm.dataset.sm?null:sm.dataset.sm; closeOv('ovLists'); render(true); return; }
    const r=e.target.closest('[data-lr]'), d=e.target.closest('[data-ld]'), row=e.target.closest('[data-l]');
    if(r){ const L=lists.find(x=>x.id===r.dataset.lr); const n=await askText('اسم القائمة',L.name); if(n){ L.name=n; saveLists(); openLists(); render(); } return; }
    if(d){ const L=lists.find(x=>x.id===d.dataset.ld); if(await askConfirm('حذف القائمة «'+L.name+'»؟ الممثلات تبقى في تطبيقك.','حذف',true)){ lists=lists.filter(x=>x.id!==L.id); const ch=items.filter(i=>(i.lists||[]).includes(L.id)); ch.forEach(i=>i.lists=i.lists.filter(x=>x!==L.id)); if(state.list===L.id) state.list=null; saveLists(); save(ch); openLists(); render(); } return; }
    if(row){ state.smart=null; state.list=state.list===row.dataset.l?null:row.dataset.l; closeOv('ovLists'); render(true); }
  };
}

// ===== ThePornDB: دوال مشتركة =====
const hdr=()=>({Authorization:'Bearer '+LS.get('vkte_key'),Accept:'application/json'});
const aliasStr=a=>(Array.isArray(a)?a:[]).map(x=>typeof x==='string'?x:(x&&x.name)||'').filter(Boolean).join(', ');
const imgsOf=p=>{ const a=[p.image,p.face,p.thumbnail]; (p.posters||[]).forEach(x=>a.push(x&&(x.url||x))); return [...new Set(a.filter(u=>typeof u==='string'&&u))].slice(0,6); };
const mapP=p=>{ const ex=p.extras||{}; const raw=String(ex.birthday||p.birthday||'').trim(); const b=raw.match(/^\d{4}-\d{2}-\d{2}/); const im=imgsOf(p); return {id:p.id,name:p.name||'',aliases:aliasStr(p.aliases),country:ex.nationality||ex.birthplace_code||ex.birthplace||'',birth:b?b[0]:'',birthRaw:raw,img:im[0]||'',imgs:im}; };
const rcRow=(m,n)=>`<div class="rc" data-n="${n}"><div class="ph" style="width:54px;aspect-ratio:3/4;flex:none;border-radius:10px;font-size:1.3rem">${m.img?`<img class="on" src="${esc(m.img)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()" alt="">`:'♡'}</div><div style="min-width:0"><div class="nm">${esc(m.name)}</div><div class="sub">${esc([m.aliases,m.country,m.birth||m.birthRaw].filter(Boolean).join(' · ')||'بيانات محدودة')}</div></div></div>`;
const httpErr=s=>{ const e=new Error('http'); e.status=s; return e; };
const siteOf=x=>(x.site&&(x.site.name||x.site.short_name))||(x.studio&&x.studio.name)||(typeof x.site==='string'?x.site:'')||'';
const posterOf=x=>{
  if(!x) return '';
  const bg=x.background||{}, ps=x.posters||{}, md=x.media||{};
  const c=[
    x.poster,x.image,x.poster_url,x.thumb,x.thumbnail,
    bg.large,bg.full,bg.medium,bg.small,(typeof bg==='string'?bg:''),
    ps.large,ps.full,ps.medium,ps.small,(Array.isArray(ps)&&ps[0]?(ps[0].url||ps[0]):''),
    md.image,md.poster
  ];
  return c.find(v=>typeof v==='string'&&/^https:\/\//i.test(v))||'';
};
async function fetchWorksFor(pdbId){ const out=[],seen=new Set(); let page=1,last=1;
  do{ const rr=await fetch(API()+'/performers/'+encodeURIComponent(pdbId)+'/scenes?page='+page+'&per_page=100',{headers:hdr()}); if(!rr.ok) throw httpErr(rr.status);
    const j=await rr.json();
    (j.data||[]).forEach(x=>{
      const t=String(x.title||x.name||'').trim(); if(!t) return; const k=wkey(t); if(seen.has(k)) return; seen.add(k);
      const yd=ydOf(x.date||x.release_date||'');
      const dur=+x.duration>0?(+x.duration>180?Math.round(+x.duration/60):Math.round(+x.duration)):0;
      const tgs=Array.isArray(x.tags)?x.tags.map(g=>typeof g==='string'?g:(g&&g.name)||'').filter(Boolean).slice(0,8):[];
      const u=typeof x.url==='string'&&/^https:\/\//i.test(x.url)?x.url:(x.slug?'https://theporndb.net/scenes/'+x.slug:'');
      const wObj=normW([{t,s:String(siteOf(x)||'').trim(),...yd,p:posterOf(x),du:dur||undefined,ds:String(x.description||x.overview||'').slice(0,280),tg:tgs,u}])[0];
      if(wObj) out.push(wObj);
    });
    const mt=j.meta||j.pagination||{}; last=+mt.last_page||((j.data||[]).length>=100?page+1:page); page++;
  }while(page<=last&&page<=40);
  return out; }
// دمج: يضيف الجديد فقط (مع وقت الإضافة a لشارة جديد)، ويكمّل الناقص، ولا يحذف ما كتبه المستخدم
function mergeWorks(old,fresh){ const out=normW(old).map(w=>({...w})); const idx=new Map(out.map(w=>[wkey(w.t),w])); const add=[]; const now=Date.now();
  normW(fresh).forEach(f=>{ const h=idx.get(wkey(f.t));
    if(h){
      if(!h.s&&f.s) h.s=f.s;
      if(!h.y&&f.y) h.y=f.y;
      if(!h.d&&f.d){ h.d=f.d; if(!h.y) h.y=f.d.slice(0,4); }
      ['p','du','ds','u'].forEach(k=>{ if(!h[k]&&f[k]) h[k]=f[k]; });
      if((!h.tg||!h.tg.length)&&f.tg&&f.tg.length) h.tg=f.tg;
      if(f.upc&&!h.w) h.upc=1;
    } else { const nw={...f,a:f.a||now}; idx.set(wkey(f.t),nw); add.push(nw); }
  });
  return {list:[...add,...out],n:add.length}; }
async function findPerformer(name,silent){
  const rr=await fetch(API()+'/performers?q='+encodeURIComponent(name),{headers:hdr()}); if(!rr.ok) throw httpErr(rr.status);
  const j=await rr.json(); let res=(j.data||[]).map(mapP).filter(adultOk);
  const ex=res.filter(m=>norm(m.name)===norm(name)); if(ex.length===1) return ex[0];
  if(silent||!res.length){ if(!silent) toast('لم أجدها في ThePornDB'); return null; }
  res=res.slice(0,8);
  return askShow(`<h2>اختر الشخصية الصحيحة</h2><div style="display:grid;gap:8px;max-height:60vh;overflow:auto">${res.map(rcRow).join('')}</div><div class="actions"><button class="btn" id="aNo">إلغاء</button></div>`,(m,done)=>{ $('aNo').onclick=()=>done(null); m.onclick=e=>{ const c=e.target.closest('.rc'); if(c) done(res[+c.dataset.n]); }; });
}
// تحديث أعمال سجل محفوظ. يرجع {n} أو null
async function refreshWorks(it,silent){
  if(!LS.get('vkte_key')){ if(!silent) toast('أضف مفتاح ThePornDB من الإعدادات أولًا'); return null; }
  try{
    if(!it.pdbId){ const m=await findPerformer(it.name,silent); if(!m) return null; it.pdbId=m.id; }
    const fresh=await fetchWorksFor(it.pdbId); const r=mergeWorks(it.works,fresh);
    it.works=r.list; it.worksAt=Date.now(); await save(it);
    if(!silent) toast(r.n?'أُضيف '+r.n+' عمل جديد':'الأعمال محدّثة، لا جديد'); else if(r.n) toast('تحديث الأعمال: +'+r.n);
    return r;
  }catch(e){ if(!silent) toast(e&&(e.status===401||e.status===403)?'المفتاح غير صالح':'تعذّر التحديث. تحقق من الاتصال'); return null; }
}

// ===== StashDB (نفس فكرة ThePornDB، بمفتاحك أنت) =====
const SD_URL='https://stashdb.org/graphql';
const SD_SEARCH='query($t:String!,$l:Int!){searchPerformer(term:$t,limit:$l){id name aliases birth_date country urls{url} images{url width height}}}';
async function sdQ(query,variables){
  const r=await fetch(SD_URL,{method:'POST',headers:{'Content-Type':'application/json',ApiKey:LS.get('vkte_stash')},body:JSON.stringify({query,variables})});
  if(!r.ok){ if(r.status===400||r.status===422){ let ej=null; try{ ej=await r.json(); }catch{} if(ej&&ej.errors&&ej.errors.length){ const e=new Error(String(ej.errors[0].message||'خطأ')); e.gql=true; throw e; } } throw httpErr(r.status); }
  const j=await r.json();
  if(j.errors&&j.errors.length&&!j.data){ const e=new Error(String(j.errors[0].message||'خطأ')); e.gql=true; throw e; }
  return j.data||{};
}
const mapS=p=>{ const raw=String(p.birth_date||'').trim(); const im=(p.images||[]).filter(x=>x&&x.url).sort((a,b)=>(b.width||0)-(a.width||0)).map(x=>x.url).slice(0,6);
  return {id:p.id,name:p.name||'',aliases:(p.aliases||[]).filter(Boolean).join(', '),country:p.country||'',birth:/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:'',birthRaw:raw,img:im[0]||'',imgs:im,urls:(p.urls||[]).map(u=>u&&u.url).filter(Boolean)}; };
// حسابات: نأخذ فقط روابط منصات التواصل المعروفة (لا مواقع قواعد البيانات)
const PHOST=[['instagram.com','instagram'],['twitter.com','x'],['x.com','x'],['tiktok.com','tiktok'],['onlyfans.com','onlyfans'],['fansly.com','fansly'],['snapchat.com','snapchat'],['t.me','telegram'],['telegram.me','telegram'],['reddit.com','reddit'],['youtube.com','youtube'],['youtu.be','youtube'],['twitch.tv','twitch'],['linktr.ee','linktree']];
function accFromUrl(u){ try{ const h=new URL(u).hostname.replace(/^www\./,'').toLowerCase(); for(const [d,k] of PHOST) if(h===d||h.endsWith('.'+d)) return {p:k,v:u}; }catch{} return null; }
const accKey=a=>norm(accUrl(a)||a.v).replace(/\/+$/,'');
async function sdWorks(id){ const out=[],seen=new Set(); let page=1,pages=1,field='release_date',lvl=0;
  const F=[
    f=>`id title ${f} duration details studio{name} images{url width height} tags{name}`,
    f=>`id title ${f} duration studio{name} images{url}`,
    f=>`title ${f} studio{name}`
  ];
  const Q=(f,l)=>`query($id:ID!,$p:Int!){queryScenes(input:{performers:{value:[$id],modifier:INCLUDES},page:$p,per_page:100}){count scenes{${F[l](f)}}}}`;
  do{ let d;
    while(true){
      try{ d=await sdQ(Q(field,lvl),{id,p:page}); break; }
      catch(e){
        if(page===1&&e.gql){
          if(field==='release_date'){ field='date'; continue; }
          if(lvl<2){ field='release_date'; lvl++; continue; }
        }
        throw e;
      }
    }
    const q=d.queryScenes||{};
    (q.scenes||[]).forEach(x=>{
      const t=String(x.title||'').trim(); if(!t) return; const k=wkey(t); if(seen.has(k)) return; seen.add(k);
      const yd=ydOf(x[field]||'');
      const ims=(x.images||[]).filter(m=>m&&/^https:\/\//i.test(m.url)).sort((a,b)=>((b.width||0)-(b.height||0))-((a.width||0)-(a.height||0)));
      const dur=+x.duration>0?(+x.duration>180?Math.round(+x.duration/60):Math.round(+x.duration)):0;
      const tgs=(x.tags||[]).map(g=>g&&g.name).filter(Boolean).slice(0,8);
      const u=x.id?'https://stashdb.org/scenes/'+x.id:'';
      const wObj=normW([{t,s:String((x.studio&&x.studio.name)||'').trim(),...yd,p:ims[0]?ims[0].url:'',du:dur||undefined,ds:String(x.details||'').slice(0,280),tg:tgs,u}])[0];
      if(wObj) out.push(wObj);
    });
    pages=Math.min(40,Math.ceil((q.count||0)/100)||1); page++;
  }while(page<=pages);
  return out; }
async function sdExtra(id){
  if(!id||!LS.get('vkte_stash')) return null;
  try{ const d=await sdQ('query($id:ID!){findPerformer(id:$id){height career_start_year career_end_year}}',{id}); return d.findPerformer||null; }catch{ return null; }
}
async function sdUpcoming(){
  if(!LS.get('vkte_stash')) return 0;
  const linked=items.filter(i=>i.stashId); if(!linked.length) return 0;
  const map=new Map(linked.map(i=>[i.stashId,i]));
  const ids=[...map.keys()], T=todayStr(); let added=0;
  try{
    let d;
    try{ d=await sdQ('query($ids:[ID!]!,$dt:String!){queryScenes(input:{performers:{value:$ids,modifier:INCLUDES},date:{value:$dt,modifier:GREATER_THAN},page:1,per_page:50}){scenes{id title release_date date studio{name} images{url} performers{performer{id}}}}}',{ids,dt:T}); }
    catch{ d=await sdQ('query($ids:[ID!]!,$dt:String!){queryScenes(input:{performers:{value:$ids,modifier:INCLUDES},date:{value:$dt,modifier:GREATER_THAN},page:1,per_page:50}){scenes{title date studio{name} performers{performer{id}}}}}',{ids,dt:T}); }
    const touched=new Set();
    ((d.queryScenes&&d.queryScenes.scenes)||[]).forEach(s=>{
      const yd=ydOf(s.release_date||s.date||'');
      const wObj={t:s.title,s:(s.studio&&s.studio.name)||'',...yd,upc:1,p:(s.images&&s.images[0]&&s.images[0].url)||'',u:s.id?'https://stashdb.org/scenes/'+s.id:''};
      (s.performers||[]).forEach(pa=>{
        const it=pa&&pa.performer&&map.get(pa.performer.id);
        if(it){ const r=mergeWorks(it.works,[wObj]); if(r.n){ it.works=r.list; added+=r.n; touched.add(it); } }
      });
    });
    if(touched.size) await save([...touched]);
  }catch{}
  return added;
}
async function findStash(name,silent){
  const d=await sdQ(SD_SEARCH,{t:name,l:10}); let res=(d.searchPerformer||[]).map(mapS).filter(adultOk);
  const ex=res.filter(m=>norm(m.name)===norm(name)); if(ex.length===1) return ex[0];
  if(silent||!res.length){ if(!silent) toast('لم أجدها في StashDB'); return null; }
  res=res.slice(0,8);
  return askShow(`<h2>اختر الشخصية الصحيحة (StashDB)</h2><div style="display:grid;gap:8px;max-height:60vh;overflow:auto">${res.map(rcRow).join('')}</div><div class="actions"><button class="btn" id="aNo">إلغاء</button></div>`,(m,done)=>{ $('aNo').onclick=()=>done(null); m.onclick=e=>{ const c=e.target.closest('.rc'); if(c) done(res[+c.dataset.n]); }; });
}
async function refreshWorksStash(it,silent){
  if(!LS.get('vkte_stash')) return null;
  try{
    if(!it.stashId){ const m=await findStash(it.name,silent); if(!m) return null; it.stashId=m.id; }
    const fresh=await sdWorks(it.stashId); const r=mergeWorks(it.works,fresh);
    const ex=await sdExtra(it.stashId); if(ex){ if(!it.height&&ex.height) it.height=ex.height; if(!it.cs&&ex.career_start_year) it.cs=ex.career_start_year; if(!it.ce&&ex.career_end_year) it.ce=ex.career_end_year; }
    it.works=r.list; it.worksAt=Date.now(); await save(it); return r;
  }catch(e){ if(!silent) toast(e&&(e.status===401||e.status===403)?'مفتاح StashDB غير صالح':'تعذّر التحديث من StashDB'+(e&&e.gql?': '+String(e.message).slice(0,50):'')); return null; }
}
// تحديث الأعمال من كل المصادر المتاحة (يدمج بلا تكرار)
async function refreshAll(it,silent){ let n=0,ran=false;
  if(LS.get('vkte_key')){ const r=await refreshWorks(it,silent); if(r){ n+=r.n; ran=true; } }
  if(LS.get('vkte_stash')){ const r=await refreshWorksStash(it,silent); if(r){ n+=r.n; ran=true; } }
  if(ran&&!silent) toast(n?'أُضيف '+n+' عمل جديد':'الأعمال محدّثة، لا جديد');
  return ran?{n}:null; }

// ===== التفاصيل =====
let carT=null;
function openDetail(id){
  const i=items.find(x=>x.id===id); if(!i) return; curDetail=id;
  const a=age(i.birth), photos=i.photos||[];
  const crit=i.criteria?CRIT.filter(([k])=>i.criteria[k]>0).map(([k,n])=>`<div class="cr"><span>${n}</span><div class="bt"><div class="bf" style="width:0" data-w="${i.criteria[k]/5*100}"></div></div><b>${i.criteria[k]}</b></div>`).join(''):'';
  const kv=[['أسماء بديلة',i.aliases],['البلد',i.country],['تاريخ الميلاد',i.birth?esc(i.birth)+(a!==null?` (${a} سنة)`:''):'']].filter(x=>x[1]);
  const lnames=(i.lists||[]).map(x=>lists.find(l=>l.id===x)).filter(Boolean);
  const accs=(i.accounts||[]).filter(x=>x&&x.v);
  const accHtml=accs.length?`<div class="sec"><h3>الحسابات</h3><div class="accs">${accs.map(x=>{ const u=accUrl(x); const nm=platOf(x.p).n; return u?`<a class="acc" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><b>${esc(nm)}</b><span dir="ltr">${esc(shortV(x.v))}</span>${icon('link')}</a>`:`<span class="acc"><b>${esc(nm)}</b><span dir="ltr">${esc(x.v)}</span></span>`; }).join('')}</div></div>`:'';
  const hasKey=!!LS.get('vkte_key'), hasStash=!!LS.get('vkte_stash');
  const bd=i.bodyD?BODY.filter(([k])=>i.bodyD[k]>0):[];
  const bodyAvg=bd.length?bd.reduce((s,[k])=>s+i.bodyD[k],0)/bd.length:0;
  const bodyHtml=bd.length?`<div class="sec"><h3>تفاصيل الجسم<small>المتوسط ${bodyAvg.toFixed(1)}</small></h3>${bd.map(([k,n])=>`<div class="cr"><span>${n}</span><div class="bt"><div class="bf" style="width:0" data-w="${i.bodyD[k]/5*100}"></div></div><b>${i.bodyD[k]}</b></div>`).join('')}</div>`:'';
  const als=String(i.aliases||'').split(/[,،]/).map(x=>x.trim()).filter(Boolean);
  const wl0=i.works||[], nSeen=wl0.filter(w=>w.w).length, nSites=new Set(wl0.map(w=>w.s).filter(Boolean)).size, zd=zodiac(i.birth);
  const irows=[['البلد',i.country?esc(i.country):''],['تاريخ الميلاد',i.birth?esc(i.birth)+(a!==null?` · ${a} سنة`:''):''],['البرج',zd?`<span class="zodiac">${zd}</span>`:''],['الطول',i.height?esc(i.height)+' سم':''],['المسيرة',i.cs?esc(i.cs)+' – '+esc(i.ce||'الآن'):''],['الصور',photos.length||''],['الأعمال',wl0.length?wl0.length+(nSeen?` · شاهدت ${nSeen}`:''):''],['المواقع',nSites||''],['أضيفت',fmtDate(i.added||i.updated)],['آخر تعديل',fmtDate(i.updated)],['المصدر',esc(i.source||'إدخال يدوي')]].filter(r=>r[1]!=='');
  const infoHtml=`<div class="sec"><h3>المعلومات</h3>${als.length?`<div class="als"><span class="k">أسماء أخرى</span><div>${als.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div></div>`:''}<div class="kvs">${irows.map(([k,v])=>`<div class="kv"><span>${k}</span>${v}</div>`).join('')}</div></div>`;
  const worksHtml=((i.works||[]).length||hasKey||hasStash)?`<details class="sec wsec" id="wsec"><summary><span>الأعمال<small id="wCnt"></small></span>${icon('chev')}</summary>${(hasKey||hasStash)?`<div class="wh" style="justify-content:flex-end"><button class="btn" id="wRef" style="padding:6px 12px;display:flex;gap:6px;align-items:center">${icon('refresh')}تحديث</button></div>`:''}
      <div class="wchips" id="wmd"></div><div class="wchips" id="wch" style="display:none"></div>
      <input class="in wq" id="wQ" placeholder="ابحث في الأعمال" style="display:none"><div id="wl"></div><button class="btn wmore" id="wMore" style="display:none"></button>
      ${i.worksAt?`<div class="src" style="margin-top:8px" id="wAt">آخر تحديث للأعمال: ${fmtDate(i.worksAt)}</div>`:'<div id="wAt"></div>'}</details>`:'';
  $('mDetail').innerHTML=`<div class="hero">
    ${pic(i)?`<img class="hbg" id="hbg" src="${pic(i)}" alt="">`:''}
    <div class="htop"><button class="ib glass" id="dClose" aria-label="إغلاق">${icon('x')}</button><div>${photos.length>1?`<button class="ib glass" id="dPlay" aria-label="إيقاف التبديل التلقائي">${icon('pause')}</button>`:''}<button class="ib glass ${i.fav?'on':''}" id="dFav" aria-label="مفضّلة">${icon('star')}</button></div></div>
    <div class="car" id="car">${photos.length?photos.map((p,n)=>`<img class="${n===0?'cur':''}" src="${p}" decoding="async" loading="lazy" alt="">`).join(''):'<div class="ph0">♡</div>'}</div>
    ${photos.length>1?`<div class="cnt" id="cnt">${photos.map((_,n)=>`<i class="${n===0?'on':''}"></i>`).join('')}</div>`:''}
    <div class="hid"><h2 class="dname">${esc(i.name)}</h2>
      <div class="hr">${i.rating?stars(i.rating)+`<b>${i.rating.toFixed(1)}</b><span>من 5</span>`:'<span class="src">لم تقيّمها بعد</span>'}</div></div>
  </div>
  <div class="dbody">
    ${crit?`<div class="sec"><h3>تقييماتي</h3>${crit}</div>`:''}
    ${bodyHtml}
    ${infoHtml}
    ${accHtml}
    ${(i.tags||[]).length||lnames.length?`<div class="sec">${(i.tags||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}${lnames.map(L=>`<span class="tag">${esc(L.name)}</span>`).join('')}</div>`:''}
    ${i.notes?`<div class="sec"><h3>ملاحظاتي</h3><div class="works">${esc(i.notes)}</div></div>`:''}
    ${worksHtml}
  </div>
  <div class="dock2"><button class="btn danger" id="dDel">حذف</button><button class="btn gold" id="dEdit">تعديل</button></div>`;
  $('ovDetail').classList.add('show'); $('mDetail').scrollTop=0;
  $('mDetail').classList.toggle('blur',document.body.classList.contains('blur'));
  setTimeout(()=>document.querySelectorAll('#mDetail .bf[data-w]').forEach(b=>b.style.width=b.dataset.w+'%'),60);
  // معرض الصور: نقاط، خلفية متغيّرة، وتبديل تلقائي
  const car=$('car'); let cur=0, paused=false, hold=0;
  const imgs=[...car.querySelectorAll('img')];
  const setCur=n=>{ if(n===cur) return; cur=n; imgs.forEach((m,k)=>m.classList.toggle('cur',k===n)); document.querySelectorAll('#cnt i').forEach((d,k)=>d.classList.toggle('on',k===n));
    const h=$('hbg'); if(h){ h.style.opacity=0; smallOf(photos[n]).then(sm=>setTimeout(()=>{ h.src=sm; h.style.opacity=1; },300)); } };
  const goTo=n=>{ const m=imgs[n], cr=car.getBoundingClientRect(), mr=m.getBoundingClientRect(); car.scrollBy({left:(mr.left+mr.width/2)-(cr.left+cr.width/2),behavior:'smooth'}); };
  clearInterval(carT);
  if(imgs.length>1){
    let raf=0; car.onscroll=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ const cr=car.getBoundingClientRect(), cx=cr.left+cr.width/2; let b=0,bd=1e9; imgs.forEach((m,k)=>{ const r=m.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-cx); if(d<bd){bd=d;b=k;} }); setCur(b); }); };
    ['pointerdown','touchstart','wheel'].forEach(ev=>car.addEventListener(ev,()=>{ hold=Date.now()+9000; },{passive:true}));
    if(!REDUCED) carT=setInterval(()=>{ if(!$('ovDetail').classList.contains('show')){ clearInterval(carT); return; } if(paused||document.hidden||Date.now()<hold||$('mDetail').scrollTop>380) return; goTo((cur+1)%imgs.length); },3800);
    $('dPlay').onclick=()=>{ paused=!paused; $('dPlay').innerHTML=icon(paused?'play':'pause'); $('dPlay').classList.toggle('on',paused); };
    requestAnimationFrame(()=>goTo(0));
  }
  // قائمة الأعمال: شارات المواقع + بحث + «عرض الكل»
  let showAll=false, wq='', ws='', wm='';
  const drawWorks=()=>{ const wl=$('wl'); if(!wl) return; const all=i.works||[];
    const sites=[...new Set(all.map(w=>w.s).filter(Boolean))]; if(ws&&!sites.includes(ws)) ws='';
    const md=$('wmd'); if(md){ md.style.display=all.length?'':'none'; md.innerHTML=[['','الكل'],['recent','الحديثة'],['upcoming','القادمة'],['top','الأعلى تقييمًا'],['rec','المنصوح بها']].map(([k,n])=>`<span class="wc ${wm===k?'on':''}" data-m="${k}">${n}</span>`).join(''); }
    const ch=$('wch'); ch.style.display=sites.length>1?'':'none';
    ch.innerHTML=sites.length>1?`<span class="wc ${ws?'':'on'}" data-s="">الكل</span>`+sites.map(s=>`<span class="wc ${ws===s?'on':''}" data-s="${esc(s)}">${badge(s)}${esc(s)}</span>`).join(''):'';
    $('wQ').style.display=all.length>12?'':'none';
    let f=all.map((w,k)=>({it:i,w,k})); if(wm) f=wApply(f,wm); if(ws) f=f.filter(x=>x.w.s===ws); if(wq) f=f.filter(x=>(x.w.t+' '+x.w.s).toLowerCase().includes(wq));
    const v=(showAll||wq||ws||wm)?f:f.slice(0,8);
    wl.innerHTML=v.map(x=>wRowItem(x,false)).join('')||`<div class="src">${all.length?'لا نتائج':'لا أعمال بعد. اضغط «تحديث» أو أضفها من التعديل.'}</div>`;
    const more=!wq&&!ws&&!wm&&!showAll&&f.length>8; $('wMore').style.display=more?'':'none'; $('wMore').textContent='عرض الكل ('+f.length+')';
    $('wCnt').textContent=all.length?all.length+' عمل'+(sites.length?' · '+sites.length+' موقع':''):'';
    if(i.worksAt) $('wAt').innerHTML='آخر تحديث للأعمال: '+fmtDate(i.worksAt), $('wAt').className='src', $('wAt').style.marginTop='8px'; };
  if($('wl')){
    drawWorks();
    $('wMore').onclick=()=>{ showAll=true; drawWorks(); };
    $('wl').onclick=e=>{ if(wAct(e)) drawWorks(); };
    if($('wmd')) $('wmd').onclick=e=>{ const c=e.target.closest('.wc'); if(!c) return; wm=c.dataset.m; showAll=false; drawWorks(); };
    $('wQ').oninput=e=>{ wq=e.target.value.trim().toLowerCase(); drawWorks(); };
    $('wch').onclick=e=>{ const c=e.target.closest('.wc'); if(!c) return; ws=c.dataset.s; drawWorks(); };
    if($('wRef')) $('wRef').onclick=async()=>{ const b=$('wRef'); b.disabled=true; await refreshAll(i,false); b.disabled=false; if(curDetail===id) drawWorks(); };
    if(((i.pdbId&&hasKey)||(i.stashId&&hasStash))&&LS.get('vkte_autoworks','1')==='1'&&Date.now()-(i.worksAt||0)>7*864e5){
      refreshAll(i,true).then(r=>{ if(r&&curDetail===id&&$('ovDetail').classList.contains('show')) drawWorks(); }); }
  }
  $('dClose').onclick=()=>closeOv('ovDetail');
  $('dFav').onclick=()=>{ i.fav=!i.fav; save(i); render(); $('dFav').classList.toggle('on',i.fav); };
  $('dEdit').onclick=()=>{ closeOv('ovDetail'); openForm(i); };
  $('dDel').onclick=async()=>{ if(await askConfirm('حذف «'+i.name+'» ؟','حذف',true)){ const gone=i; items=items.filter(x=>x.id!==id); DB.del(id).catch(()=>toast('تعذّر الحذف')); render(); closeOv('ovDetail'); undoToast('تم حذف «'+gone.name+'»',async()=>{ if(items.some(x=>x.id===gone.id)) return; items.push(gone); await save(gone); render(); toast('تم الاسترجاع'); }); } };
}


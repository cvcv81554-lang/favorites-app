/* ---- 05-works-hub.js ---- */
// ===== مركز الأعمال المستقل (#ovWorks) — واجهة مبسّطة وصور كاملة دائمًا =====
let wlists=[]; try{ wlists=JSON.parse(LS.get('vkte_wlists','[]'))||[]; }catch{ wlists=[]; }
const saveWLists=()=>{ LS.set('vkte_wlists',JSON.stringify(wlists)); metaChanged(); };
let wLastSeen=+LS.get('vkte_wlast','0')||0;
let wRadarBusy=false, wHeroKey='', wHideHero=false;

// 6 تبويبات رئيسية واضحة ومباشرة بدل 13 تبويب مزدحم
const WTABS=[
  ['recent','🔥 الأحدث'],
  ['upcoming','⏳ القادمة'],
  ['watchlist','🔖 للمشاهدة'],
  ['unseen','👁 لم أشاهدها'],
  ['top','★ الأعلى وتوصياتي'],
  ['more','🧭 الأقسام']
];

const WSECS=['collabs','sites','diary','cal','wlists'];

let wState={tab:'recent',q:'',site:'',act:'',tag:'',yr:'',wlist:'',sub:'',sort:'date',view:LS.get('vkte_wview','cards'),showFlt:false,lim:20,calYm:todayStr().slice(0,7),calDay:''};

// تحويل الصور المحفوظة (DataURL) إلى روابط Blob قصيرة ومشتركة في الذاكرة لمنع امتلاء رام الآيفون
const _bUrls=new Map();
function blobUrl(src){
  if(!src||!src.startsWith('data:')) return src||'';
  let u=_bUrls.get(src); if(u) return u;
  try{
    const i=src.indexOf(','); if(i<0) return src;
    const m=(src.slice(0,i).match(/:(.*?);/)||[])[1]||'image/jpeg';
    const b=atob(src.slice(i+1)), n=b.length, a=new Uint8Array(n);
    for(let k=0;k<n;k++) a[k]=b.charCodeAt(k);
    u=URL.createObjectURL(new Blob([a],{type:m}));
    _bUrls.set(src,u); return u;
  }catch{ return src; }
}
const wPic=(it,seed='')=>{
  if(!it) return '';
  const ps=it.photos||[];
  if(seed&&ps.length>1){
    const idx=hhash(seed)%Math.min(ps.length,4);
    return blobUrl(ps[idx]||it.thumb||ps[0]);
  }
  return blobUrl(pic(it));
};

function wAll(){
  if(_wCache) return _wCache;
  const map=new Map();
  items.forEach(it=>(it.works||[]).forEach((w,idx)=>{
    const key=wKeyOf(w);
    let g=map.get(key);
    if(!g){
      g={key,t:w.t,s:w.s||'',d:w.d||'',y:w.y||'',dt:wDate(w),r:w.r||0,rec:!!w.rec,fav:!!w.fav,seen:!!w.w,q:!!w.q,upc:!!w.upc,wd:w.wd||'',n:w.n||'',p:w.p||'',du:w.du||0,ds:w.ds||'',u:w.u||'',tg:[...(w.tg||[])],ls:[...(w.ls||[])],a:w.a||it.added||0,who:[it],refs:[{it,idx,w}]};
      map.set(key,g);
    } else {
      if(!g.who.includes(it)) g.who.push(it);
      g.refs.push({it,idx,w});
      if(!g.d&&w.d){ g.d=w.d; g.y=w.d.slice(0,4); g.dt=w.d; }
      if(!g.y&&w.y){ g.y=w.y; if(!g.dt) g.dt=w.y+'-01-01'; }
      if(!g.p&&w.p) g.p=w.p;
      if(!g.du&&w.du) g.du=w.du;
      if(!g.ds&&w.ds) g.ds=w.ds;
      if(!g.u&&w.u) g.u=w.u;
      if((w.r||0)>g.r) g.r=w.r;
      if(w.rec) g.rec=true;
      if(w.fav) g.fav=true;
      if(w.w){ g.seen=true; if(w.wd) g.wd=w.wd; }
      if(w.q) g.q=true;
      if(w.upc&&!g.seen) g.upc=true;
      if(!g.n&&w.n) g.n=w.n;
      if((w.a||0)>g.a) g.a=w.a;
      (w.tg||[]).forEach(t=>{ if(!g.tg.includes(t)) g.tg.push(t); });
      (w.ls||[]).forEach(l=>{ if(!g.ls.includes(l)) g.ls.push(l); });
    }
  }));
  _wCache=[...map.values()];
  return _wCache;
}

function wMut(key,fn){
  const g=wAll().find(x=>x.key===key); if(!g) return false;
  const touched=[];
  g.refs.forEach(({it,idx})=>{
    const w=it.works[idx]; if(!w) return;
    fn(w,it,idx); it.updated=Date.now();
    if(!touched.includes(it)) touched.push(it);
  });
  _wCache=null;
  if(touched.length) save(touched);
  updWorksDot();
  return true;
}

function updWorksDot(){
  const dot=$('wDot'); if(!dot) return;
  const all=wAll();
  const hasUpc=all.some(w=>isUpcoming(w));
  const hasNew=wLastSeen>0&&all.some(w=>w.a>wLastSeen);
  dot.style.display=(hasUpc||hasNew)?'block':'none';
}

function fmtDur(m){
  m=+m||0; if(!m) return '';
  if(m<60) return m+' د';
  const h=Math.floor(m/60), r=m%60;
  return h+' س'+(r?' و '+r+' د':'');
}

function wImgErr(el){
  const fb=el.dataset.fb||'';
  if(fb&&el.src!==fb){ el.src=fb; el.dataset.fb=''; }
  else el.style.display='none';
}
function wCoverHtml(g){
  const pics=g.who.map(it=>wPic(it,g.t)).filter(Boolean);
  const fb=pics[0]||'';
  const src=g.p||fb;
  if(!src) return badge(g.s);
  if(!g.p&&pics.length>=2){
    return `<div class="wkp-split"><div><img src="${esc(pics[0])}" loading="lazy" decoding="async" alt=""></div><div><img src="${esc(pics[1])}" loading="lazy" decoding="async" alt=""></div></div>`;
  }
  return `<img class="wkp-main" src="${esc(src)}" data-fb="${esc(fb)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="wImgErr(this)" alt="">`;
}

function wCard(g){
  const up=isUpcoming(g), du=daysUntil(g.d);
  const upTxt=up?(du===0?'اليوم! 🔥':du===1?'غدًا ⏳':du>1?`بعد ${du} يوم`:'قريبًا ⏳'):'';
  const isNew=wLastSeen>0&&g.a>wLastSeen&&!g.seen;
  const whoHtml=g.who.slice(0,3).map(it=>{ const p=wPic(it); return `<span class="av" data-od="${it.id}" title="${esc(it.name)}">${p?`<img src="${esc(p)}" loading="lazy" decoding="async" alt="">`:'♡'}</span>`; }).join('');
  const names=g.who.map(it=>`<span data-od="${it.id}">${esc(it.name)}</span>`).join(' ، ');
  const meta=[g.s,g.d?fmtWd(g.d):g.y].filter(Boolean).join(' · ');
  const wlNames=(g.ls||[]).map(id=>wlists.find(x=>x.id===id)).filter(Boolean);
  return `<div class="wkc ${g.seen?'seen':''}" data-wkey="${esc(g.key)}">
    <div class="wkp" data-wsheet="${esc(g.key)}">
      ${wCoverHtml(g)}
      <div class="wk-badges">
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${up?`<span class="wk-b upc">${esc(upTxt)}</span>`:''}
          ${isNew?`<span class="wk-b new">جديد ✨</span>`:''}
          ${g.who.length>1?`<span class="wk-b">👥 مشترك (${g.who.length})</span>`:''}
        </div>
        ${g.du?`<span class="wk-b dur">${g.du} د</span>`:''}
      </div>
    </div>
    <div class="wk-bodyc">
      <div class="wk-meta-top">
        <div class="wk-who">${whoHtml}<span class="wk-who-nm">${names}</span></div>
        ${g.s?badge(g.s):''}
      </div>
      <div class="wk-t" dir="auto" data-wsheet="${esc(g.key)}">${esc(g.t)}</div>
      <div class="wk-m">${esc(meta)||'بدون تاريخ أو موقع'}${g.seen&&g.wd?` · 👁 ${esc(fmtWd(g.wd))}`:''}</div>
      ${(g.tg&&g.tg.length)||wlNames.length?`<div class="wk-tgs">${wlNames.map(L=>`<span style="color:var(--gold2);border-color:var(--gold)" data-wfl="${L.id}">📂 ${esc(L.name)}</span>`).join('')}${(g.tg||[]).slice(0,3).map(t=>`<span data-wft="${esc(t)}">#${esc(t)}</span>`).join('')}</div>`:''}
      ${g.n?`<div class="wk-note">${esc(g.n)}</div>`:''}
      <div class="wk-foot">
        <div class="wrs">${[1,2,3,4,5].map(n=>`<button type="button" data-wrs="${n}" class="${n<=(g.r||0)?'on':''}" aria-label="تقييم ${n}">★</button>`).join('')}</div>
        <div class="wk-acts">
          <button type="button" class="ib sm ${g.q?'on':''}" data-wact="q" title="قائمة المشاهدة">🔖</button>
          <button type="button" class="ib sm ${g.rec?'on':''}" data-wact="rec" title="أنصح به">${icon('like')}</button>
          <button type="button" class="ib sm ${g.seen?'on':''}" data-wact="seen" title="تمت المشاهدة">${icon('eye')}</button>
        </div>
      </div>
    </div>
  </div>`;
}

function wRowGroup(g){
  const up=isUpcoming(g), du=daysUntil(g.d);
  const upTxt=up?(du===0?'اليوم!':du===1?'غدًا':du>1?`بعد ${du} يوم`:'قريبًا ⏳'):'';
  const it=g.who[0]||{name:'',id:''};
  const fb=wPic(it,g.t)||'';
  const src=g.p||fb;
  const meta=[g.who.map(x=>x.name).join(' و '),g.s,g.d?fmtWd(g.d):g.y,g.du?g.du+' د':''].filter(Boolean).join(' · ');
  return `<div class="wi wfi ${g.seen?'seen':''}" data-wkey="${esc(g.key)}">
    <div class="wrow-th" data-wsheet="${esc(g.key)}">${src?`<img src="${esc(src)}" data-fb="${esc(fb)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="wImgErr(this)" alt="">`:badge(g.s)}</div>
    <div style="flex:1;min-width:0;cursor:pointer" data-wsheet="${esc(g.key)}">
      <div class="wt" dir="auto" style="text-align:start">${esc(g.t)}${up?`<span class="tag upc">${esc(upTxt)}</span>`:''}${g.q&&!g.seen?'<span class="tag">🔖 للمشاهدة</span>':''}</div>
      <div class="ws">${esc(meta)||'&nbsp;'}</div>
      <div class="wrs">${[1,2,3,4,5].map(n=>`<button type="button" data-wrs="${n}" class="${n<=(g.r||0)?'on':''}">★</button>`).join('')}</div>
    </div>
    <button class="ib sm ${g.q?'on':''}" data-wact="q" title="قائمة المشاهدة">🔖</button>
    <button class="ib sm wrc ${g.rec?'on':''}" data-wact="rec" title="أنصح به">${icon('like')}</button>
    <button class="ib sm wtg ${g.seen?'on':''}" data-wact="seen" title="تمت المشاهدة">${icon('eye')}</button>
  </div>`;
}

function wRenderItems(arr){
  if(!arr.length) return '';
  if(wState.view==='list') return `<div class="wfl">${arr.map(wRowGroup).join('')}</div>`;
  return `<div class="wk-grid">${arr.map(wCard).join('')}</div>`;
}

function wPickSuggestion(all){
  const pool=all.filter(g=>!g.seen&&!isUpcoming(g));
  if(!pool.length) return all[0]||null;
  if(wHeroKey){ const ex=pool.find(g=>g.key===wHeroKey); if(ex) return ex; }
  const pick=rnd(pool);
  if(pick) wHeroKey=pick.key;
  return pick;
}

function wFilterAndSort(all){
  let arr=all.slice();
  const q=wState.q.trim().toLowerCase();
  if(q) arr=arr.filter(g=>[g.t,g.s,g.n,g.ds,(g.tg||[]).join(' '),g.who.map(i=>i.name+' '+(i.aliases||'')).join(' ')].join(' ').toLowerCase().includes(q));
  if(wState.site) arr=arr.filter(g=>g.s===wState.site);
  if(wState.act) arr=arr.filter(g=>g.who.some(i=>i.id===wState.act));
  if(wState.tag) arr=arr.filter(g=>(g.tg||[]).includes(wState.tag));
  if(wState.yr) arr=arr.filter(g=>g.y===wState.yr);
  if(wState.wlist) arr=arr.filter(g=>(g.ls||[]).includes(wState.wlist));
  const st=wState.sort;
  const dd=(a,b)=>(b.dt||'').localeCompare(a.dt||'');
  if(st==='old') arr.sort((a,b)=>(a.dt||'9999').localeCompare(b.dt||'9999'));
  else if(st==='rating') arr.sort((a,b)=>(b.r||0)-(a.r||0)||dd(a,b));
  else if(st==='actRating') arr.sort((a,b)=>Math.max(0,...b.who.map(i=>i.rating||0))-Math.max(0,...a.who.map(i=>i.rating||0))||dd(a,b));
  else if(st==='added') arr.sort((a,b)=>(b.a||0)-(a.a||0)||dd(a,b));
  else if(st==='dur') arr.sort((a,b)=>(b.du||0)-(a.du||0)||dd(a,b));
  else if(st==='title') arr.sort((a,b)=>a.t.localeCompare(b.t,'ar'));
  else arr.sort(dd);
  return arr;
}

function wCalHtml(all){
  const ym=wState.calYm||todayStr().slice(0,7);
  const [Y,M]=ym.split('-').map(Number);
  const first=new Date(Y,M-1,1), days=new Date(Y,M,0).getDate();
  const startDow=(first.getDay()+1)%7;
  const byDay={};
  all.forEach(g=>{ if(g.d&&g.d.startsWith(ym+'-')){ const dd=g.d.slice(8,10); (byDay[dd]=byDay[dd]||[]).push(g); } });
  const mName=first.toLocaleDateString('ar',{year:'numeric',month:'long'});
  const dows=['سبت','أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة'];
  const T=todayStr();
  let cells='';
  for(let k=0;k<startDow;k++) cells+=`<div></div>`;
  for(let d=1;d<=days;d++){
    const dd=String(d).padStart(2,'0'), full=ym+'-'+dd, list=byDay[dd]||[];
    const hasUpc=list.some(isUpcoming);
    const cls=['wk-cal-d',list.length?'has':'',hasUpc?'upc':'',full===T?'tod':'',wState.calDay===full?'sel':''].filter(Boolean).join(' ');
    cells+=`<div class="${cls}" data-cday="${full}"><span>${d}</span>${list.length?`<small style="font-size:.62rem">${list.length}</small>`:''}</div>`;
  }
  const selList=wState.calDay?all.filter(g=>g.d===wState.calDay):all.filter(g=>g.d&&g.d.startsWith(ym+'-')).sort((a,b)=>b.d.localeCompare(a.d));
  return `<div class="wk-cal">
    <div class="wk-cal-h">
      <div style="display:flex;gap:6px"><button type="button" class="ib sm" id="calPrev" title="الشهر السابق">‹</button><button type="button" class="ib sm" id="calNext" title="الشهر التالي">›</button></div>
      <b style="color:var(--gold2);font-size:1.05rem">${esc(mName)}</b>
      <button type="button" class="btn" id="calToday" style="padding:5px 12px;font-size:.8rem">اليوم</button>
    </div>
    <div class="wk-cal-g">${dows.map(w=>`<div class="wk-cal-dow">${w}</div>`).join('')}${cells}</div>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h3 style="margin:0;color:var(--gold2);font-size:1rem">${wState.calDay?'أعمال يوم '+fmtWd(wState.calDay):'أعمال الشهر ('+selList.length+')'}</h3>${wState.calDay?`<button class="btn" id="calAllM" style="padding:4px 10px;font-size:.78rem">عرض كل الشهر</button>`:''}</div>
  ${selList.length?wRenderItems(selList):`<div class="empty" style="padding:36px 16px"><b>لا أعمال مسجّلة بتواريخ في هذه الفترة</b>جرّب شهرًا آخر أو حدّث الأعمال من المصادر.</div>`}`;
}

function openWorksHub(tab){
  if(tab&&typeof tab==='string') wState.tab=tab;
  $('ovWorks').classList.add('show');
  $('mWorks').classList.toggle('blur',document.body.classList.contains('blur'));
  $('nHome').classList.remove('on'); $('nWorks').classList.add('on');
  drawWorksHub();
}

function drawWorksHub(){
  const all=wAll();
  const total=all.length, nSeen=all.filter(g=>g.seen).length, nUpc=all.filter(isUpcoming).length;
  const nWatch=all.filter(g=>g.q&&!g.seen).length;
  const nTopRec=all.filter(g=>g.r>0||g.rec||g.fav).length;
  const nCollab=all.filter(g=>g.who.length>1).length;
  const nSites=new Set(all.map(g=>g.s).filter(Boolean)).size;

  const counts={
    recent:total,
    upcoming:nUpc,
    watchlist:nWatch,
    unseen:all.filter(g=>!g.seen&&!isUpcoming(g)).length,
    top:nTopRec,
    more:5
  };

  const sites=[...new Set(all.map(g=>g.s).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const tags=[...new Set(all.flatMap(g=>g.tg||[]))].sort((a,b)=>a.localeCompare(b));
  const yrs=[...new Set(all.map(g=>g.y).filter(y=>/^\d{4}$/.test(y)))].sort().reverse();
  const acts=items.filter(i=>(i.works||[]).length>0).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  const activeFltCount=[wState.site,wState.act,wState.tag,wState.yr,wState.wlist,wState.sort!=='date'?wState.sort:''].filter(Boolean).length;
  const hasFilters=!!(wState.q||activeFltCount);

  const filtered=wFilterAndSort(all);
  const t=wState.tab;
  const isSecTab=WSECS.includes(t);
  let body='';

  // شريط رجوع وتنقل سريع عند فتح أحد الأقسام الخمسة من تبويب «الأقسام»
  if(isSecTab){
    const secNames=[['collabs',`👥 مشتركة (${nCollab})`],['sites',`🎬 المواقع (${nSites})`],['diary',`📖 اليوميات (${nSeen})`],['cal','📅 التقويم'],['wlists',`📂 قوائمي (${wlists.length})`]];
    body+=`<div class="wk-sub"><button type="button" class="chip on" data-gotab="more">← كل الأقسام</button>${secNames.map(([k,n])=>`<span class="chip ${t===k?'on':''}" data-gotab="${k}">${n}</span>`).join('')}</div>`;
  }

  if(t==='more'){
    body+=`<div class="wk-hub-g">
      <div class="wk-hub-c" data-gotab="collabs"><div class="wk-hub-ic">👥</div><div style="flex:1"><b style="font-size:1.02rem;color:var(--gold2)">أعمال مشتركة (${nCollab})</b><div class="src">المشاهد التي تجمع ممثلتين أو أكثر من مجموعتك</div></div></div>
      <div class="wk-hub-c" data-gotab="sites"><div class="wk-hub-ic">🎬</div><div style="flex:1"><b style="font-size:1.02rem;color:var(--gold2)">المواقع والاستوديوهات (${nSites})</b><div class="src">تصفّح أعمال كل موقع ونسبة مشاهدتك وتقييمك</div></div></div>
      <div class="wk-hub-c" data-gotab="diary"><div class="wk-hub-ic">📖</div><div style="flex:1"><b style="font-size:1.02rem;color:var(--gold2)">يوميات المشاهدة (${nSeen})</b><div class="src">سجل كل ما شاهدته مرتبًا بالشهر والتاريخ</div></div></div>
      <div class="wk-hub-c" data-gotab="cal"><div class="wk-hub-ic">📅</div><div style="flex:1"><b style="font-size:1.02rem;color:var(--gold2)">تقويم الإصدارات</b><div class="src">تقويم شهري تفاعلي لتواريخ نزول الأعمال</div></div></div>
      <div class="wk-hub-c" data-gotab="wlists"><div class="wk-hub-ic">📂</div><div style="flex:1"><b style="font-size:1.02rem;color:var(--gold2)">قوائم الأعمال الخاصة (${wlists.length})</b><div class="src">قوائمك المخصصة للمشاهد (مثل: للسهرة، المفضلة)</div></div></div>
    </div>`;
  } else if(t==='recent'){
    // اقتراح السهرة المدمج مع صورة الممثلة الكاملة
    if(!hasFilters&&!wHideHero&&all.length){
      const sug=wPickSuggestion(all);
      if(sug){
        const fb=wPic(sug.who[0]||{},sug.t)||'';
        const src=sug.p||fb;
        const whoNames=sug.who.map(i=>i.name).join(' ، ');
        body+=`<div class="wk-hero">
          <div class="wk-hero-p" data-wsheet="${esc(sug.key)}">${src?`<img src="${esc(src)}" data-fb="${esc(fb)}" referrerpolicy="no-referrer" onerror="wImgErr(this)" alt="">`:badge(sug.s)}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.74rem;color:var(--gold2);font-weight:700">🎲 اقتراح السهرة لك</span><button type="button" class="ib sm" id="wHeroHide" style="width:24px;height:24px;border:0;background:none;color:var(--muted)" title="إخفاء">✕</button></div>
            <div style="font-weight:700;font-size:.98rem;margin:2px 0;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" dir="auto" data-wsheet="${esc(sug.key)}">${esc(sug.t)}</div>
            <div class="src" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc([whoNames,sug.s,sug.d?fmtWd(sug.d):sug.y].filter(Boolean).join(' · '))}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">
              <button type="button" class="btn gold" style="padding:5px 11px;font-size:.78rem" data-wsheet="${esc(sug.key)}">التفاصيل</button>
              <button type="button" class="btn" style="padding:5px 11px;font-size:.78rem" data-heroseen="${esc(sug.key)}">شاهدته ✓</button>
              <button type="button" class="btn" style="padding:5px 11px;font-size:.78rem" id="wHeroNext">اقتراح آخر ↻</button>
            </div>
          </div>
        </div>`;
      }
    }
    const sub=wState.sub||'all';
    const T0=new Date(todayStr()+'T00:00:00'), curY=todayStr().slice(0,4);
    let rList=wApply(filtered,'recent');
    if(sub==='30d') rList=rList.filter(g=>g.d&&(T0-new Date(g.d+'T00:00:00'))/864e5<=30);
    else if(sub==='yr') rList=rList.filter(g=>g.y===curY);
    else if(sub==='added') rList=filtered.slice().sort((a,b)=>(b.a||0)-(a.a||0));
    else if(sub==='allw') rList=filtered;
    body+=`<div class="wk-sub">${[['all','الأحدث إصدارًا'],['30d','آخر 30 يومًا'],['yr','إصدارات '+curY],['added','مضافة حديثًا'],['allw','الكل ('+filtered.length+')']].map(([k,n])=>`<span class="chip ${sub===k?'on':''}" data-wsub="${k}">${n}</span>`).join('')}</div>`;
    const vis=rList.slice(0,wState.lim);
    body+=vis.length?wRenderItems(vis)+(rList.length>wState.lim?`<button class="btn wmore" id="wMoreBtn">عرض المزيد (${rList.length-wState.lim})</button>`:''):`<div class="empty"><b>لا توجد أعمال مطابقة</b>جرّب تغيير التصنيف أو البحث.</div>`;
  } else if(t==='upcoming'){
    const upList=wApply(filtered,'upcoming');
    body+=`<div class="sec" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div><b style="color:var(--gold2)">⏳ الأعمال القادمة والمرتقبة (${upList.length})</b><div class="src">الأعمال التي تاريخها بعد اليوم أو المعلّمة كـ «قريبًا».</div></div>
      <div style="display:flex;gap:6px"><button class="btn gold" style="padding:6px 12px;font-size:.82rem" id="wAddUpcBtn">＋ عمل قادم</button><button class="btn" style="padding:6px 12px;font-size:.82rem" id="wScanUpcBtn">${icon('refresh')} فحص المصادر</button></div>
    </div>`;
    if(upList.length){
      body+=wRenderItems(upList);
    } else {
      const T0=new Date(todayStr()+'T00:00:00');
      const recent60=filtered.filter(g=>{ if(!g.d||isUpcoming(g)) return false; const df=(T0-new Date(g.d+'T00:00:00'))/864e5; return df>=0&&df<=60; });
      body+=`<div class="empty" style="padding:26px 16px"><b>لا توجد أعمال مجدولة بتاريخ مستقبلي حاليًا</b>أضف أي عمل منتظر بزر «＋ عمل قادم» أو علّم أي عمل بـ «⏳ قريبًا».</div>`;
      if(recent60.length) body+=`<h3 style="color:var(--gold2);font-size:1rem;margin:10px 0">🔥 أحدث ما صدر خلال آخر 60 يومًا (${recent60.length})</h3>`+wRenderItems(recent60.slice(0,24));
    }
  } else if(t==='watchlist'){
    const wlList=wApply(filtered,'watchlist');
    body+=`<div class="sec" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div><b style="color:var(--gold2)">🔖 قائمة المشاهدة (${wlList.length})</b><div class="src">إجمالي المدة التقديرية: ${fmtDur(wlList.reduce((a,g)=>a+(g.du||30),0))}</div></div>
      ${wlList.length>1?`<button class="btn gold" style="padding:6px 12px;font-size:.82rem" id="wPickWl">${icon('shuffle')} اختر لي منها</button>`:''}
    </div>`;
    body+=wlList.length?wRenderItems(wlList):`<div class="empty"><b>قائمة المشاهدة فارغة</b>اضغط رمز الشارة 🔖 على أي عمل لحفظه هنا لمشاهدته لاحقًا.</div>`;
  } else if(t==='unseen'){
    const sub=wState.sub||'all';
    let uList=wApply(filtered,'unseen');
    if(sub==='fav') uList=uList.filter(g=>g.who.some(i=>i.fav));
    else if(sub==='long') uList=uList.filter(g=>(g.du||0)>=30);
    body+=`<div class="wk-sub">${[['all','الكل ('+uList.length+')'],['fav','لممثلاتي المفضّلات ★'],['long','طويلة (+30 د)']].map(([k,n])=>`<span class="chip ${sub===k?'on':''}" data-wsub="${k}">${n}</span>`).join('')}</div>`;
    const vis=uList.slice(0,wState.lim);
    body+=vis.length?wRenderItems(vis)+(uList.length>wState.lim?`<button class="btn wmore" id="wMoreBtn">عرض المزيد (${uList.length-wState.lim})</button>`:''):`<div class="empty"><b>لا توجد أعمال غير مشاهَدة هنا 🎉</b></div>`;
  } else if(t==='top'){
    const sub=wState.sub||'top';
    let tList=sub==='rec'?wApply(filtered,'rec'):sub==='5'?wApply(filtered,'top').filter(g=>g.r>=5):sub==='act'?filtered.filter(g=>g.who.some(i=>(i.rating||0)>=4.5)):wApply(filtered,'top');
    body+=`<div class="wk-sub">${[['top','الأعلى تقييمًا ★'],['rec','أنصح بها 👍'],['5','5 نجوم ★★★★★'],['act','لممثلات 4.5+ ★']].map(([k,n])=>`<span class="chip ${sub===k?'on':''}" data-wsub="${k}">${n}</span>`).join('')}</div>`;
    const vis=tList.slice(0,wState.lim);
    body+=vis.length?wRenderItems(vis)+(tList.length>wState.lim?`<button class="btn wmore" id="wMoreBtn">عرض المزيد (${tList.length-wState.lim})</button>`:''):`<div class="empty"><b>لا توجد أعمال هنا بعد</b>قيّم الأعمال بالنجوم ★ أو اضغط 👍 لتظهر هنا.</div>`;
  } else if(t==='diary'){
    const sList=wApply(filtered,'seen');
    if(!sList.length){
      body+=`<div class="empty"><b>يوميات المشاهدة فارغة</b>اضغط رمز العين 👁 على أي عمل شاهدته ليُسجَّل تلقائيًا بتاريخ اليوم.</div>`;
    } else {
      const groups={};
      sList.forEach(g=>{ const ym=(g.wd||g.d||'بدون تاريخ').slice(0,7); (groups[ym]=groups[ym]||[]).push(g); });
      Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([ym,arr])=>{
        let label=ym;
        if(/^\d{4}-\d{2}$/.test(ym)){ try{ label=new Date(ym+'-01T00:00:00').toLocaleDateString('ar',{year:'numeric',month:'long'}); }catch{} }
        body+=`<div style="margin-bottom:18px"><h3 style="color:var(--gold2);font-size:1rem;margin:0 0 10px">📖 ${esc(label)} <small style="color:var(--muted);font-weight:400">(${arr.length} عمل)</small></h3>${wRenderItems(arr)}</div>`;
      });
    }
  } else if(t==='cal'){
    body+=wCalHtml(filtered);
  } else if(t==='sites'){
    const smap={};
    all.forEach(g=>{
      const s=g.s||'بدون موقع';
      if(!smap[s]) smap[s]={s,n:0,seen:0,rSum:0,rCnt:0};
      smap[s].n++; if(g.seen) smap[s].seen++; if(g.r>0){ smap[s].rSum+=g.r; smap[s].rCnt++; }
    });
    const sArr=Object.values(smap).sort((a,b)=>b.n-a.n);
    body+=sArr.length?`<div class="wk-site-g">${sArr.map(x=>{
      const pct=Math.round(x.seen/x.n*100), avg=x.rCnt?(x.rSum/x.rCnt).toFixed(1):'';
      return `<div class="wk-site-c" data-wsite="${esc(x.s==='بدون موقع'?'':x.s)}">
        ${badge(x.s==='بدون موقع'?'':x.s)}
        <div style="flex:1;min-width:0">
          <div class="nm" style="font-size:.92rem">${esc(x.s)}</div>
          <div class="src">${x.n} عمل · شاهدت ${x.seen} (${pct}%)${avg?' · ★ '+avg:''}</div>
          <div class="bt" style="margin-top:5px;height:6px"><div class="bf" style="width:${Math.max(3,pct)}%"></div></div>
        </div>
      </div>`;
    }).join('')}</div>`:`<div class="empty"><b>لا توجد مواقع مسجّلة</b></div>`;
  } else if(t==='collabs'){
    const cList=filtered.filter(g=>g.who.length>1);
    body+=`<div class="sec" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div><b style="color:var(--gold2)">👥 الأعمال المشتركة (${cList.length})</b><div class="src">المشاهد التي تجمع أكثر من ممثلة من مجموعتك</div></div>
      <button class="btn gold" style="padding:6px 12px;font-size:.82rem" id="wAddCollabBtn">＋ عمل مشترك</button>
    </div>`;
    const vis=cList.slice(0,wState.lim);
    body+=vis.length?wRenderItems(vis)+(cList.length>wState.lim?`<button class="btn wmore" id="wMoreBtn">عرض المزيد (${cList.length-wState.lim})</button>`:''):`<div class="empty"><b>لا توجد أعمال مشتركة بعد</b></div>`;
  } else if(t==='wlists'){
    const wlCards=wlists.map(L=>{
      const ms=all.filter(g=>(g.ls||[]).includes(L.id));
      const sample=ms[0];
      return `<div class="wkc" style="cursor:pointer" data-wfl="${L.id}">
        <div class="wkp">${sample?wCoverHtml(sample):badge(L.name)}
          <div class="wk-badges"><span class="wk-b">${ms.length} عمل</span></div>
        </div>
        <div class="wk-bodyc" style="flex-direction:row;align-items:center;justify-content:space-between">
          <div><div class="wk-t">${esc(L.name)}</div><div class="src">شاهدت ${ms.filter(x=>x.seen).length} من ${ms.length}</div></div>
          <div style="display:flex;gap:4px"><button class="ib sm" data-wlr="${L.id}" title="إعادة تسمية">${icon('edit')}</button><button class="ib sm" data-wld="${L.id}" title="حذف">${icon('trash')}</button></div>
        </div>
      </div>`;
    }).join('');
    body+=`<div class="sec" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div><b style="color:var(--gold2)">📂 قوائمي الخاصة للأعمال</b><div class="src">قوائم مخصصة للمشاهد فقط (مثل: «أفضل مشاهد 2026»، «للسهرة»).</div></div>
      <button class="btn gold" style="padding:7px 14px;font-size:.84rem" id="wNewListBtn">＋ قائمة جديدة</button>
    </div>`;
    body+=wlists.length?`<div class="wk-grid">${wlCards}</div>`:`<div class="empty"><b>لا توجد قوائم أعمال خاصة بعد</b></div>`;
  }

  // شارات الفلاتر النشطة (تظهر فقط عند تفعيل فلتر ليسهل إلغاؤه بضغطة واحدة)
  const actObj=wState.act?items.find(i=>i.id===wState.act):null;
  const wlObj=wState.wlist?wlists.find(x=>x.id===wState.wlist):null;
  const activeChips=[
    actObj?`<span class="chip on" data-wclr="act">الممثلة: ${esc(actObj.name)} ✕</span>`:'',
    wState.site?`<span class="chip on" data-wclr="site">الموقع: ${esc(wState.site)} ✕</span>`:'',
    wState.yr?`<span class="chip on" data-wclr="yr">السنة: ${esc(wState.yr)} ✕</span>`:'',
    wState.tag?`<span class="chip on" data-wclr="tag">#${esc(wState.tag)} ✕</span>`:'',
    wlObj?`<span class="chip on" data-wclr="wlist">📂 ${esc(wlObj.name)} ✕</span>`:''
  ].filter(Boolean).join('');

  $('mWorks').innerHTML=`
    <div class="wk-top">
      <div class="wk-bar">
        <div class="wk-title"><h2>مركز الأعمال</h2><small>${total} عمل · ✓ ${nSeen} · 🔖 ${nWatch} · ⏳ ${nUpc}</small></div>
        <div class="wk-tbtns">
          <button type="button" class="btn gold" style="padding:7px 12px;font-size:.82rem;display:inline-flex;align-items:center;gap:5px" id="wAddBtn">${icon('plus')} عمل</button>
          <button type="button" class="ib" id="wPickBtn" title="سحب عمل عشوائي">${icon('shuffle')}</button>
          <button type="button" class="ib" id="wRadarBtn" title="تحديث من المصادر">${icon('refresh')}</button>
          <button type="button" class="ib" id="wCloseBtn" title="إغلاق">${icon('x')}</button>
        </div>
      </div>
      <div class="wk-tabs" id="wTabs">
        ${WTABS.map(([k,n])=>{ const on=wState.tab===k||(k==='more'&&isSecTab); return `<button type="button" class="wk-tab ${on?'on':''}" data-wtab="${k}">${n}<em>${counts[k]??0}</em></button>`; }).join('')}
      </div>
    </div>
    <div class="wk-body">
      <div class="wk-srow">
        <label class="sbox" style="margin:0;height:42px"><svg class="ic"><use href="#i-search"/></svg><input type="search" id="wSearchIn" value="${esc(wState.q)}" placeholder="ابحث بعنوان العمل أو الممثلة أو الموقع..." style="height:40px"></label>
        <button type="button" class="btn ${wState.showFlt||activeFltCount?'gold':''}" style="padding:0 12px;height:42px;font-size:.82rem;flex:none;display:inline-flex;align-items:center;gap:5px" id="wFltToggle">${icon('set')} فلترة${activeFltCount?` (${activeFltCount})`:''}</button>
        <button type="button" class="ib" style="height:42px;width:42px;flex:none" id="wViewBtn" title="تبديل شكل العرض">${icon('grid')}</button>
      </div>
      ${activeChips?`<div class="wk-sub" style="padding-top:0">${activeChips}<button type="button" class="chip" id="wClrFlt">مسح الكل</button></div>`:''}
      ${wState.showFlt?`<div class="wk-fdrawer">
        <select class="sel" id="wSortSel" aria-label="الترتيب">
          <option value="date" ${wState.sort==='date'?'selected':''}>الترتيب: الأحدث إصدارًا</option>
          <option value="added" ${wState.sort==='added'?'selected':''}>الترتيب: الأحدث إضافة</option>
          <option value="rating" ${wState.sort==='rating'?'selected':''}>الترتيب: الأعلى تقييمًا ★</option>
          <option value="actRating" ${wState.sort==='actRating'?'selected':''}>الترتيب: تقييم الممثلة</option>
          <option value="dur" ${wState.sort==='dur'?'selected':''}>الترتيب: الأطول مدة</option>
          <option value="old" ${wState.sort==='old'?'selected':''}>الترتيب: الأقدم</option>
          <option value="title" ${wState.sort==='title'?'selected':''}>الترتيب: الأبجدي</option>
        </select>
        <select class="sel" id="wActSel"><option value="">كل الممثلات (${acts.length})</option>${acts.map(i=>`<option value="${i.id}" ${wState.act===i.id?'selected':''}>${esc(i.name)} (${(i.works||[]).length})</option>`).join('')}</select>
        <select class="sel" id="wSiteSel"><option value="">كل المواقع (${sites.length})</option>${sites.map(s=>`<option value="${esc(s)}" ${wState.site===s?'selected':''}>${esc(s)}</option>`).join('')}</select>
        ${yrs.length?`<select class="sel" id="wYrSel"><option value="">كل السنوات</option>${yrs.map(y=>`<option value="${y}" ${wState.yr===y?'selected':''}>${y}</option>`).join('')}</select>`:''}
        ${tags.length?`<select class="sel" id="wTagSel"><option value="">كل الوسوم (${tags.length})</option>${tags.map(tg=>`<option value="${esc(tg)}" ${wState.tag===tg?'selected':''}>#${esc(tg)}</option>`).join('')}</select>`:''}
        ${wlists.length?`<select class="sel" id="wListSel"><option value="">كل قوائم الأعمال</option>${wlists.map(L=>`<option value="${L.id}" ${wState.wlist===L.id?'selected':''}>📂 ${esc(L.name)}</option>`).join('')}</select>`:''}
      </div>`:''}
      <div id="wHubContent">${body}</div>
    </div>`;

  wireWorksHub(all);
}

function wireWorksHub(all){
  $('wCloseBtn').onclick=()=>{ closeOv('ovWorks'); $('nWorks').classList.remove('on'); render(); };
  $('wViewBtn').onclick=()=>{ wState.view=wState.view==='cards'?'list':'cards'; LS.set('vkte_wview',wState.view); toast(wState.view==='cards'?'عرض البطاقات المصوّرة':'عرض القائمة المدمجة'); drawWorksHub(); };
  $('wFltToggle').onclick=()=>{ wState.showFlt=!wState.showFlt; drawWorksHub(); };
  $('wAddBtn').onclick=()=>wAddDlg(wState.tab==='upcoming');
  $('wRadarBtn').onclick=()=>wRadar();
  $('wPickBtn').onclick=()=>{
    const pool=wFilterAndSort(all).filter(g=>!g.seen);
    const pick=rnd(pool.length?pool:all);
    if(!pick){ toast('لا توجد أعمال للسحب'); return; }
    wSheet(pick.key);
  };
  let wqT;
  $('wSearchIn').oninput=e=>{ wState.q=e.target.value; if(wState.tab==='more') wState.tab='recent'; clearTimeout(wqT); wqT=setTimeout(()=>{ const pos=e.target.selectionStart; drawWorksHub(); const el=$('wSearchIn'); if(el){ el.focus(); try{ el.setSelectionRange(pos,pos); }catch{} } },180); };
  if($('wSortSel')) $('wSortSel').onchange=e=>{ wState.sort=e.target.value; drawWorksHub(); };
  if($('wActSel')) $('wActSel').onchange=e=>{ wState.act=e.target.value; if(wState.tab==='more') wState.tab='recent'; drawWorksHub(); };
  if($('wSiteSel')) $('wSiteSel').onchange=e=>{ wState.site=e.target.value; if(wState.tab==='more') wState.tab='recent'; drawWorksHub(); };
  if($('wYrSel')) $('wYrSel').onchange=e=>{ wState.yr=e.target.value; if(wState.tab==='more') wState.tab='recent'; drawWorksHub(); };
  if($('wTagSel')) $('wTagSel').onchange=e=>{ wState.tag=e.target.value; if(wState.tab==='more') wState.tab='recent'; drawWorksHub(); };
  if($('wListSel')) $('wListSel').onchange=e=>{ wState.wlist=e.target.value; if(wState.tab==='more') wState.tab='recent'; drawWorksHub(); };
  if($('wClrFlt')) $('wClrFlt').onclick=()=>{ wState.q=''; wState.site=''; wState.act=''; wState.tag=''; wState.yr=''; wState.wlist=''; drawWorksHub(); };

  if($('wHeroNext')) $('wHeroNext').onclick=()=>{ wHeroKey=''; drawWorksHub(); };
  if($('wHeroHide')) $('wHeroHide').onclick=()=>{ wHideHero=true; drawWorksHub(); };
  if($('wAddUpcBtn')) $('wAddUpcBtn').onclick=()=>wAddDlg(true);
  if($('wAddCollabBtn')) $('wAddCollabBtn').onclick=()=>wAddDlg(false,true);
  if($('wScanUpcBtn')) $('wScanUpcBtn').onclick=()=>wRadar();
  if($('wPickWl')) $('wPickWl').onclick=()=>{ const wl=wApply(wFilterAndSort(all),'watchlist'); const p=rnd(wl); if(p) wSheet(p.key); };
  if($('wMoreBtn')) $('wMoreBtn').onclick=()=>{ wState.lim+=30; drawWorksHub(); };
  if($('wNewListBtn')) $('wNewListBtn').onclick=async()=>{ const n=await askText('اسم قائمة الأعمال الجديدة','','مثال: أفضل مشاهد 2026'); if(n){ wlists.push({id:uid(),name:n}); saveWLists(); drawWorksHub(); } };

  if($('calPrev')) $('calPrev').onclick=()=>{ const [y,m]=wState.calYm.split('-').map(Number); const d=new Date(y,m-2,1); wState.calYm=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); wState.calDay=''; drawWorksHub(); };
  if($('calNext')) $('calNext').onclick=()=>{ const [y,m]=wState.calYm.split('-').map(Number); const d=new Date(y,m,1); wState.calYm=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); wState.calDay=''; drawWorksHub(); };
  if($('calToday')) $('calToday').onclick=()=>{ wState.calYm=todayStr().slice(0,7); wState.calDay=todayStr(); drawWorksHub(); };
  if($('calAllM')) $('calAllM').onclick=()=>{ wState.calDay=''; drawWorksHub(); };

  $('mWorks').onclick=async e=>{
    const clr=e.target.closest('[data-wclr]');
    if(clr){ wState[clr.dataset.wclr]=''; drawWorksHub(); return; }
    const tb=e.target.closest('[data-wtab]');
    if(tb){ wState.tab=tb.dataset.wtab; wState.sub=''; wState.lim=30; drawWorksHub(); $('mWorks').scrollTop=0; return; }
    const gt=e.target.closest('[data-gotab]');
    if(gt){ wState.tab=gt.dataset.gotab; wState.sub=''; wState.lim=30; drawWorksHub(); $('mWorks').scrollTop=0; return; }
    const sb=e.target.closest('[data-wsub]');
    if(sb){ wState.sub=sb.dataset.wsub; wState.lim=30; drawWorksHub(); return; }
    const cd=e.target.closest('[data-cday]');
    if(cd){ wState.calDay=wState.calDay===cd.dataset.cday?'':cd.dataset.cday; drawWorksHub(); return; }
    const st=e.target.closest('[data-wsite]');
    if(st){ wState.site=st.dataset.wsite; wState.tab='recent'; wState.sub='allw'; drawWorksHub(); return; }
    const ft=e.target.closest('[data-wft]');
    if(ft){ wState.tag=ft.dataset.wft; wState.tab='recent'; wState.sub='allw'; drawWorksHub(); return; }
    const fl=e.target.closest('[data-wfl]');
    if(fl&&!e.target.closest('[data-wlr]')&&!e.target.closest('[data-wld]')){ wState.wlist=fl.dataset.wfl; wState.tab='recent'; wState.sub='allw'; drawWorksHub(); return; }
    const lr=e.target.closest('[data-wlr]');
    if(lr){ const L=wlists.find(x=>x.id===lr.dataset.wlr); if(L){ const n=await askText('تسمية قائمة الأعمال',L.name); if(n){ L.name=n; saveWLists(); drawWorksHub(); } } return; }
    const ld=e.target.closest('[data-wld]');
    if(ld){ const L=wlists.find(x=>x.id===ld.dataset.wld); if(L&&await askConfirm('حذف قائمة الأعمال «'+L.name+'»؟ الأعمال نفسها لن تُحذف.','حذف',true)){ wlists=wlists.filter(x=>x.id!==L.id); saveWLists(); if(wState.wlist===L.id) wState.wlist=''; drawWorksHub(); } return; }
    const hs=e.target.closest('[data-heroseen]');
    if(hs){ wMut(hs.dataset.heroseen,w=>{ w.w=1; delete w.upc; if(!w.wd) w.wd=todayStr(); }); wHeroKey=''; toast('تم تعليمه كمشاهَد ✓'); drawWorksHub(); return; }
    const od=e.target.closest('[data-od]');
    if(od){ openDetail(od.dataset.od); return; }
    const wrs=e.target.closest('[data-wrs]');
    if(wrs){ const card=wrs.closest('[data-wkey]'); if(card){ const n=+wrs.dataset.wrs; wMut(card.dataset.wkey,w=>{ if(w.r===n) delete w.r; else w.r=n; }); drawWorksHub(); } return; }
    const wact=e.target.closest('[data-wact]');
    if(wact){ const card=wact.closest('[data-wkey]'); if(card){ const k=wact.dataset.wact; wMut(card.dataset.wkey,w=>{ if(k==='q'){ if(w.q) delete w.q; else w.q=1; } else if(k==='rec'){ if(w.rec) delete w.rec; else w.rec=1; } else if(k==='seen'){ if(w.w) delete w.w; else { w.w=1; delete w.upc; if(!w.wd) w.wd=todayStr(); } } }); drawWorksHub(); } return; }
    const sh=e.target.closest('[data-wsheet]');
    if(sh){ wSheet(sh.dataset.wsheet); return; }
  };
}

// جلب تفاصيل مشهد واحد من ThePornDB أو StashDB لتدعيم بياناته وبوستره
async function wEnrichScene(g){
  let found=false;
  const qTitle=g.t;
  if(LS.get('vkte_key')){
    try{
      const rr=await fetch(API()+'/scenes?q='+encodeURIComponent(qTitle)+'&per_page=5',{headers:hdr()});
      if(rr.ok){
        const j=await rr.json();
        const sc=(j.data||[]).find(x=>wkey(x.title||x.name||'')===wkey(qTitle))||(j.data||[])[0];
        if(sc){
          const yd=ydOf(sc.date||sc.release_date||'');
          const dur=+sc.duration>0?(+sc.duration>180?Math.round(+sc.duration/60):Math.round(+sc.duration)):0;
          const tgs=Array.isArray(sc.tags)?sc.tags.map(t=>typeof t==='string'?t:(t&&t.name)||'').filter(Boolean).slice(0,8):[];
          const p=posterOf(sc);
          const u=typeof sc.url==='string'&&/^https:\/\//i.test(sc.url)?sc.url:'';
          wMut(g.key,w=>{
            if(!w.s&&siteOf(sc)) w.s=siteOf(sc);
            if(!w.d&&yd.d){ w.d=yd.d; w.y=yd.y; }
            if(!w.p&&p) w.p=p;
            if(!w.du&&dur) w.du=dur;
            if(!w.ds&&(sc.description||sc.overview)) w.ds=String(sc.description||sc.overview).slice(0,280);
            if((!w.tg||!w.tg.length)&&tgs.length) w.tg=tgs;
            if(!w.u&&u) w.u=u;
          });
          found=true;
        }
      }
    }catch{}
  }
  if(!found&&LS.get('vkte_stash')){
    try{
      const d=await sdQ('query($t:String!){queryScenes(input:{term:$t,page:1,per_page:5}){scenes{id title release_date date duration details studio{name} images{url width height} tags{name}}}}',{t:qTitle});
      const sc=((d.queryScenes&&d.queryScenes.scenes)||[])[0];
      if(sc){
        const yd=ydOf(sc.release_date||sc.date||'');
        const ims=(sc.images||[]).filter(m=>m&&/^https:\/\//i.test(m.url)).sort((a,b)=>((b.width||0)-(b.height||0))-((a.width||0)-(a.height||0)));
        const dur=+sc.duration>0?(+sc.duration>180?Math.round(+sc.duration/60):Math.round(+sc.duration)):0;
        const tgs=(sc.tags||[]).map(t=>t&&t.name).filter(Boolean).slice(0,8);
        wMut(g.key,w=>{
          if(!w.s&&sc.studio&&sc.studio.name) w.s=sc.studio.name;
          if(!w.d&&yd.d){ w.d=yd.d; w.y=yd.y; }
          if(!w.p&&ims[0]) w.p=ims[0].url;
          if(!w.du&&dur) w.du=dur;
          if(!w.ds&&sc.details) w.ds=String(sc.details).slice(0,280);
          if((!w.tg||!w.tg.length)&&tgs.length) w.tg=tgs;
          if(!w.u&&sc.id) w.u='https://stashdb.org/scenes/'+sc.id;
        });
        found=true;
      }
    }catch{}
  }
  return found;
}

// نافذة تفاصيل العمل الكاملة (wSheet)
function wSheet(key){
  const g=wAll().find(x=>x.key===key); if(!g) return;
  const up=isUpcoming(g), du=daysUntil(g.d);
  const upTxt=up?(du===0?'يصدر اليوم! 🔥':du===1?'يصدر غدًا ⏳':du>1?`يصدر بعد ${du} يوم`:'قريبًا / مرتقب ⏳'):'';
  const canApi=!!(LS.get('vkte_key')||LS.get('vkte_stash'));
  const otherActs=items.filter(i=>!g.who.includes(i)).sort((a,b)=>a.name.localeCompare(b.name,'ar'));

  askShow(`
    <div class="wsh-p">${wCoverHtml(g)}</div>
    <h2 style="margin-bottom:4px;font-size:1.25rem;text-align:start" dir="auto">${esc(g.t)}</h2>
    <div class="src" style="margin-bottom:10px">${esc([g.s,g.d?fmtWd(g.d):g.y,g.du?fmtDur(g.du):''].filter(Boolean).join(' · ')||'بدون موقع أو تاريخ')}${upTxt?` · <b style="color:var(--gold2)">${esc(upTxt)}</b>`:''}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      ${g.who.map(it=>`<span class="chip on" style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px" data-shod="${it.id}"><span class="av" style="width:22px;height:22px;border-radius:50%">${pic(it)?`<img src="${pic(it)}" alt="">`:'♡'}</span>${esc(it.name)}</span>`).join('')}
      ${otherActs.length?`<button type="button" class="chip" id="shAddCo">＋ ممثلة مشاركة</button>`:''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--glass);padding:8px 12px;border-radius:16px;margin-bottom:10px">
      <span style="font-size:.85rem;color:var(--muted)">تقييمي للعمل</span>
      <div class="starpick" id="shStars"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px">
      <button type="button" class="btn ${g.seen?'gold':''}" id="shSeen">${g.seen?'✓ شاهدته':'👁 تعليم كمشاهَد'}</button>
      <button type="button" class="btn ${g.q?'gold':''}" id="shWatch">${g.q?'🔖 في قائمة المشاهدة':'🔖 لقائمة المشاهدة'}</button>
      <button type="button" class="btn ${g.rec?'gold':''}" id="shRec">${g.rec?'👍 أنصح به':'👍 توصية بالعمل'}</button>
      <button type="button" class="btn ${g.upc?'gold':''}" id="shUpc">${g.upc?'⏳ معلّم كقادم':'⏳ تعليم كقادم/مرتقب'}</button>
    </div>
    ${g.seen?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><label style="margin:0;flex:none">تاريخ المشاهدة:</label><input type="date" class="in" id="shWd" value="${esc(g.wd||todayStr())}" style="padding:6px 10px"></div>`:''}
    ${g.ds?`<div class="sec" style="padding:10px 12px;margin-bottom:10px"><div class="src" style="margin-bottom:2px">الوصف</div><div style="font-size:.86rem;line-height:1.5" dir="auto">${esc(g.ds)}</div></div>`:''}
    <div style="margin-bottom:10px">
      <label>وسوم العمل</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${(g.tg||[]).map(t=>`<span class="tag" dir="ltr">#${esc(t)}</span>`).join('')}<button type="button" class="chip" id="shEditTags">＋ تعديل الوسوم</button></div>
    </div>
    <div style="margin-bottom:10px">
      <label>قوائم الأعمال الخاصة 📂</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${wlists.map(L=>`<span class="chip ${(g.ls||[]).includes(L.id)?'on':''}" data-shwl="${L.id}">${esc(L.name)}</span>`).join('')}
        <button type="button" class="chip" id="shNewWl">＋ قائمة جديدة</button>
      </div>
    </div>
    <div style="margin-bottom:12px">
      <label>ملاحظتي على العمل</label>
      <textarea class="in" id="shNote" style="min-height:64px" placeholder="اكتب انطباعك أو التوقيت المفضل في المشهد...">${esc(g.n||'')}</textarea>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <button type="button" class="btn gold" id="shSrchG">بحث Google ↗</button>
      ${g.u?`<a class="btn" href="${esc(g.u)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">صفحة المصدر ↗</a>`:''}
      ${canApi?`<button type="button" class="btn" id="shFetchApi">${icon('refresh')} جلب البوستر والتفاصيل</button>`:''}
      <button type="button" class="btn" id="shEditMeta">${icon('edit')} تعديل البيانات</button>
      <button type="button" class="btn" id="shCopy">نسخ العنوان</button>
      <button type="button" class="btn danger" id="shDel">${icon('trash')} حذف</button>
    </div>
    <div class="actions"><button type="button" class="btn gold" id="shDone">حفظ وإغلاق</button></div>
  `,(m,done)=>{
    m.classList.add('wide');
    m.classList.toggle('blur',document.body.classList.contains('blur'));
    const saveNote=()=>{ const v=$('shNote')?$('shNote').value.trim():g.n; wMut(key,w=>{ if(v) w.n=v; else delete w.n; }); };
    starPicker($('shStars'),g.r||0,v=>{ saveNote(); wMut(key,w=>{ if(v) w.r=v; else delete w.r; }); if($('ovWorks').classList.contains('show')) drawWorksHub(); });
    $('shSeen').onclick=()=>{ saveNote(); wMut(key,w=>{ if(w.w) delete w.w; else { w.w=1; delete w.upc; if(!w.wd) w.wd=todayStr(); } }); if($('ovWorks').classList.contains('show')) drawWorksHub(); wSheet(key); };
    $('shWatch').onclick=()=>{ saveNote(); wMut(key,w=>{ if(w.q) delete w.q; else w.q=1; }); if($('ovWorks').classList.contains('show')) drawWorksHub(); wSheet(key); };
    $('shRec').onclick=()=>{ saveNote(); wMut(key,w=>{ if(w.rec) delete w.rec; else w.rec=1; }); if($('ovWorks').classList.contains('show')) drawWorksHub(); wSheet(key); };
    $('shUpc').onclick=()=>{ saveNote(); wMut(key,w=>{ if(w.upc) delete w.upc; else { w.upc=1; delete w.w; } }); if($('ovWorks').classList.contains('show')) drawWorksHub(); wSheet(key); };
    if($('shWd')) $('shWd').onchange=e=>{ wMut(key,w=>{ w.wd=e.target.value; }); if($('ovWorks').classList.contains('show')) drawWorksHub(); };
    $('shEditTags').onclick=async()=>{ saveNote(); const v=await askText('وسوم العمل (افصل بفاصلة)',(g.tg||[]).join(', '),'مثال: HD, 2026, مميز'); if(v!==null){ const arr=v.split(/[,،]/).map(s=>s.trim()).filter(Boolean).slice(0,10); wMut(key,w=>{ if(arr.length) w.tg=arr; else delete w.tg; }); if($('ovWorks').classList.contains('show')) drawWorksHub(); } wSheet(key); };
    $('shNewWl').onclick=async()=>{ saveNote(); const n=await askText('اسم قائمة الأعمال الجديدة','','مثال: للسهرة'); if(n){ const nl={id:uid(),name:n}; wlists.push(nl); saveWLists(); wMut(key,w=>{ w.ls=[...(w.ls||[]),nl.id]; }); if($('ovWorks').classList.contains('show')) drawWorksHub(); } wSheet(key); };
    if($('shAddCo')) $('shAddCo').onclick=()=>{
      saveNote();
      askShow(`<h2>إضافة ممثلة مشاركة في العمل</h2><p class="src" style="margin-bottom:8px">اختر الممثلة ليُضاف هذا العمل إلى ملفها ويظهر في قسم «أعمال مشتركة 👥»:</p><select class="in" id="coActSel">${otherActs.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select><div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn gold" id="aOk">ربط العمل</button></div>`,(m2,d2)=>{
        $('aNo').onclick=()=>{ d2(null); wSheet(key); };
        $('aOk').onclick=()=>{ const target=items.find(i=>i.id===$('coActSel').value); if(target){ const sample=g.refs[0].w; const r=mergeWorks(target.works,[{...sample}]); target.works=r.list; save(target); toast('تم ربط العمل بـ '+target.name); if($('ovWorks').classList.contains('show')) drawWorksHub(); } d2(true); wSheet(key); };
      });
    };
    if($('shFetchApi')) $('shFetchApi').onclick=async()=>{
      saveNote(); const b=$('shFetchApi'); b.disabled=true; b.textContent='جارٍ الجلب...';
      const ok=await wEnrichScene(g);
      toast(ok?'تم تحديث بيانات وبوستر العمل من المصدر ✨':'لم يُعثر على بيانات إضافية لهذا العنوان');
      if($('ovWorks').classList.contains('show')) drawWorksHub();
      wSheet(key);
    };
    $('shEditMeta').onclick=()=>{
      saveNote();
      askShow(`<h2>تعديل بيانات العمل</h2>
        <div class="row"><label>عنوان العمل *</label><input class="in" id="emT" value="${esc(g.t)}"></div>
        <div class="row two"><div><label>الموقع / الاستوديو</label><input class="in" id="emS" value="${esc(g.s)}"></div><div><label>تاريخ الإصدار (YYYY-MM-DD)</label><input class="in" id="emD" dir="ltr" placeholder="2026-12-01" value="${esc(g.d||g.y)}"></div></div>
        <div class="row two"><div><label>المدة (بالدقائق)</label><input class="in" type="number" id="emDu" dir="ltr" value="${esc(g.du||'')}"></div><div><label>رابط البوستر (https)</label><input class="in" id="emP" dir="ltr" value="${esc(g.p||'')}"></div></div>
        <div class="row"><label>رابط المصدر (https)</label><input class="in" id="emU" dir="ltr" value="${esc(g.u||'')}"></div>
        <div class="row"><label>وصف قصير</label><textarea class="in" id="emDs" style="min-height:64px">${esc(g.ds||'')}</textarea></div>
        <div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn gold" id="aOk">حفظ</button></div>`,(m2,d2)=>{
        m2.classList.add('wide');
        $('aNo').onclick=()=>{ d2(null); wSheet(key); };
        $('aOk').onclick=()=>{
          const nt=$('emT').value.trim(); if(!nt){ toast('العنوان مطلوب'); return; }
          const ns=$('emS').value.trim(), yd=ydOf($('emD').value), ndu=+$('emDu').value||0, np=$('emP').value.trim(), nu=$('emU').value.trim(), nds=$('emDs').value.trim();
          wMut(key,w=>{
            w.t=nt; w.s=ns; w.y=yd.y||''; if(yd.d) w.d=yd.d; else delete w.d;
            if(ndu>0) w.du=ndu; else delete w.du;
            if(/^https:\/\//i.test(np)) w.p=np; else delete w.p;
            if(/^https:\/\//i.test(nu)) w.u=nu; else delete w.u;
            if(nds) w.ds=nds.slice(0,320); else delete w.ds;
          });
          const newKey=wKeyOf({t:nt,s:ns});
          if($('ovWorks').classList.contains('show')) drawWorksHub();
          d2(true); wSheet(newKey);
        };
      });
    };
    $('shSrchG').onclick=()=>openExt('https://www.google.com/search?q='+encodeURIComponent([g.t,g.s,g.who[0]&&g.who[0].name].filter(Boolean).join(' ')));
    $('shCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText([g.t,g.s].filter(Boolean).join(' - ')); toast('تم نسخ العنوان'); }catch{ toast(g.t); } };
    $('shDel').onclick=async()=>{
      if(await askConfirm('حذف العمل «'+g.t+'» نهائيًا؟','حذف',true)){
        const touched=[];
        g.refs.forEach(({it,w})=>{ it.works=(it.works||[]).filter(x=>x!==w); it.updated=Date.now(); if(!touched.includes(it)) touched.push(it); });
        if(touched.length) await save(touched);
        toast('تم حذف العمل');
        if($('ovWorks').classList.contains('show')) drawWorksHub();
        if(curDetail&&$('ovDetail').classList.contains('show')) openDetail(curDetail);
        done(true);
      } else wSheet(key);
    };
    m.onclick=e=>{
      const od=e.target.closest('[data-shod]');
      if(od){ saveNote(); done(true); openDetail(od.dataset.shod); return; }
      const wl=e.target.closest('[data-shwl]');
      if(wl){ saveNote(); const lid=wl.dataset.shwl; wMut(key,w=>{ const s=new Set(w.ls||[]); s.has(lid)?s.delete(lid):s.add(lid); w.ls=[...s]; }); if($('ovWorks').classList.contains('show')) drawWorksHub(); wSheet(key); }
    };
    $('shDone').onclick=()=>{ saveNote(); if($('ovWorks').classList.contains('show')) drawWorksHub(); if(curDetail&&$('ovDetail').classList.contains('show')) openDetail(curDetail); done(true); };
  });
}

// نافذة إضافة عمل جديد أو قادم أو مشترك يدويًا
function wAddDlg(isUpc=false,isCollab=false){
  if(!items.length){ toast('أضف ممثلة واحدة على الأقل أولًا'); return; }
  const sorted=items.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  const defDate=isUpc?(()=>{ const d=new Date(Date.now()+7*864e5); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })():todayStr();
  askShow(`
    <h2>${isUpc?'⏳ إضافة عمل قادم / مرتقب':isCollab?'👥 إضافة عمل مشترك':'＋ إضافة عمل جديد'}</h2>
    <div class="row"><label>الممثلة الأساسية *</label><select class="in" id="waAct">${sorted.map(i=>`<option value="${i.id}" ${wState.act===i.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select></div>
    <div class="row"><label>ممثلة ثانية مشاركة (اختياري — للأعمال المشتركة)</label><select class="in" id="waAct2"><option value="">— بدون —</option>${sorted.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></div>
    <div class="row"><label>عنوان العمل *</label><input class="in" id="waT" placeholder="اكتب اسم المشهد أو العمل"></div>
    <div class="row two">
      <div><label>الموقع / الاستوديو</label><input class="in" id="waS" list="siteDl2" value="${esc(wState.site||'')}" placeholder="مثال: Brazzers"></div>
      <div><label>تاريخ الإصدار</label><input class="in" type="date" id="waD" value="${defDate}"></div>
    </div>
    <div class="row two">
      <div><label>المدة بالدقائق (اختياري)</label><input class="in" type="number" id="waDu" dir="ltr" placeholder="35"></div>
      <div><label>رابط بوستر https (اختياري)</label><input class="in" id="waP" dir="ltr" placeholder="https://..."></div>
    </div>
    <div class="row"><label>الوسوم (افصل بفاصلة)</label><input class="in" id="waTg" placeholder="مثال: 4K, 2026"></div>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0;cursor:pointer;color:var(--text)"><input type="checkbox" id="waUpc" ${isUpc?'checked':''}> تعليم كعمل قادم / مرتقب ⏳</label>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0;cursor:pointer;color:var(--text)"><input type="checkbox" id="waWl" ${!isUpc?'checked':''}> إضافة إلى قائمة المشاهدة 🔖</label>
    <datalist id="siteDl2">${allSites().map(s=>`<option value="${esc(s)}">`).join('')}</datalist>
    <div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn gold" id="aOk">إضافة العمل</button></div>
  `,(m,done)=>{
    m.classList.add('wide');
    setTimeout(()=>$('waT').focus(),60);
    $('aNo').onclick=()=>done(null);
    $('aOk').onclick=async()=>{
      const t=$('waT').value.trim(); if(!t){ toast('اكتب عنوان العمل أولًا'); return; }
      const act1=items.find(i=>i.id===$('waAct').value); if(!act1) return;
      const act2=items.find(i=>i.id===$('waAct2').value&&i.id!==act1.id);
      const yd=ydOf($('waD').value);
      const wObj=normW([{
        t, s:$('waS').value.trim(), ...yd,
        du:+$('waDu').value||undefined,
        p:$('waP').value.trim(),
        tg:$('waTg').value.split(/[,،]/).map(s=>s.trim()).filter(Boolean),
        upc:$('waUpc').checked?1:undefined,
        q:$('waWl').checked?1:undefined,
        a:Date.now()
      }])[0];
      const touched=[];
      [act1,act2].filter(Boolean).forEach(it=>{
        const r=mergeWorks(it.works,[wObj]);
        it.works=r.list; it.updated=Date.now(); touched.push(it);
      });
      await save(touched);
      updWorksDot();
      toast('تمت إضافة العمل بنجاح');
      done(true);
      if($('ovWorks').classList.contains('show')) drawWorksHub();
    };
  });
}

// رادار الأعمال والمصادر (يحدّث أعمال الممثلات + يفحص القادمة من StashDB)
async function wRadar(){
  if(wRadarBusy) return;
  if(!LS.get('vkte_key')&&!LS.get('vkte_stash')){ toast('أضف مفتاح ThePornDB أو StashDB من الإعدادات أولًا'); return; }
  const linked=items.filter(i=>(i.pdbId&&LS.get('vkte_key'))||(i.stashId&&LS.get('vkte_stash')));
  if(!linked.length){ toast('اربط ممثلة واحدة على الأقل بـ ThePornDB أو StashDB أولًا'); return; }
  wRadarBusy=true;
  let added=0, c=0;
  for(const it of linked){
    c++; toast(`رادار الأعمال: تحديث ${c} من ${linked.length} (${it.name})…`);
    const r=await refreshAll(it,true);
    if(r) added+=r.n;
    await new Promise(z=>setTimeout(z,320));
  }
  if(LS.get('vkte_stash')){
    toast('رادار الأعمال: فحص الإصدارات القادمة من StashDB…');
    added+=await sdUpcoming();
  }
  wRadarBusy=false;
  updWorksDot();
  toast(added?`اكتمل الرادار: أُضيف ${added} عمل جديد ✨`:'اكتمل الرادار: كل الأعمال محدّثة، لا جديد');
  if($('ovWorks').classList.contains('show')) drawWorksHub();
}

// ===== أدوات المجموعة: مقارنة ممثلتين + مدير الوسوم =====
function toolCompare(){
  if(items.length<2){ toast('أضف ممثلتين على الأقل للمقارنة'); return; }
  const sorted=items.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  let id1=sorted[0].id, id2=sorted[1].id;
  const draw=()=>{
    const a=items.find(i=>i.id===id1)||sorted[0], b=items.find(i=>i.id===id2)||sorted[1];
    const row=(label,v1,v2)=>`<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--gline);font-size:.85rem"><b style="text-align:center;color:${v1>v2?'var(--gold2)':'var(--text)'}">${v1||'-'}</b><span class="src" style="text-align:center">${label}</span><b style="text-align:center;color:${v2>v1?'var(--gold2)':'var(--text)'}">${v2||'-'}</b></div>`;
    askShow(`
      <h2>⚖️ مقارنة ممثلتين</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <select class="in" id="cmp1">${sorted.map(i=>`<option value="${i.id}" ${i.id===a.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select>
        <select class="in" id="cmp2">${sorted.map(i=>`<option value="${i.id}" ${i.id===b.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center;margin-bottom:10px">
        <div class="sec" style="margin:0"><div class="av" style="width:64px;height:64px;margin:0 auto 6px;border-radius:16px">${pic(a)?`<img src="${pic(a)}" alt="">`:'♡'}</div><b>${esc(a.name)}</b><div class="src">${esc(a.country||'')}</div></div>
        <div class="sec" style="margin:0"><div class="av" style="width:64px;height:64px;margin:0 auto 6px;border-radius:16px">${pic(b)?`<img src="${pic(b)}" alt="">`:'♡'}</div><b>${esc(b.name)}</b><div class="src">${esc(b.country||'')}</div></div>
      </div>
      ${row('التقييم العام',a.rating?a.rating.toFixed(1):0,b.rating?b.rating.toFixed(1):0)}
      ${row('عدد الأعمال',(a.works||[]).length,(b.works||[]).length)}
      ${row('أعمال شاهدتها',(a.works||[]).filter(w=>w.w).length,(b.works||[]).filter(w=>w.w).length)}
      ${row('عدد الصور',(a.photos||[]).length,(b.photos||[]).length)}
      ${row('العمر',age(a.birth)||0,age(b.birth)||0)}
      ${CRIT.map(([k,n])=>row(n,(a.criteria&&a.criteria[k])||0,(b.criteria&&b.criteria[k])||0)).join('')}
      <div class="actions"><button class="btn gold" id="aOk">إغلاق</button></div>
    `,(m,done)=>{
      m.classList.add('wide');
      $('cmp1').onchange=e=>{ id1=e.target.value; draw(); };
      $('cmp2').onchange=e=>{ id2=e.target.value; draw(); };
      $('aOk').onclick=()=>done(true);
    });
  };
  draw();
}

function toolTags(){
  const map={};
  items.forEach(i=>(i.tags||[]).forEach(t=>{ map[t]=(map[t]||0)+1; }));
  const tags=Object.entries(map).sort((a,b)=>b[1]-a[1]);
  askShow(`
    <h2>🏷️ مدير الوسوم</h2>
    <p class="src" style="margin-bottom:10px">اضغط على اسم الوسم لإعادة تسميته أو دمجه مع وسم آخر، أو احذفه من كل الممثلات.</p>
    <div style="display:grid;gap:8px;max-height:55vh;overflow:auto">
      ${tags.length?tags.map(([t,c])=>`<div class="lrow" style="margin:0"><div class="lname"><span>#${esc(t)}</span><small>(${c} ممثلة)</small></div><div class="lact"><button class="ib sm" data-trn="${esc(t)}" title="إعادة تسمية / دمج">${icon('edit')}</button><button class="ib sm" data-tdel="${esc(t)}" title="حذف الوسم">${icon('trash')}</button></div></div>`).join(''):'<div class="src">لا توجد وسوم مضافة بعد.</div>'}
    </div>
    <div class="actions"><button class="btn gold" id="aOk">إغلاق</button></div>
  `,(m,done)=>{
    m.classList.add('wide');
    $('aOk').onclick=()=>done(true);
    m.onclick=async e=>{
      const rn=e.target.closest('[data-trn]'), dl=e.target.closest('[data-tdel]');
      if(rn){
        const oldT=rn.dataset.trn;
        const newT=await askText('إعادة تسمية أو دمج الوسم',oldT);
        if(newT&&newT!==oldT){
          const ch=items.filter(i=>(i.tags||[]).includes(oldT));
          ch.forEach(i=>{ i.tags=[...new Set(i.tags.map(x=>x===oldT?newT:x))]; i.updated=Date.now(); });
          await save(ch); render();
        }
        toolTags(); return;
      }
      if(dl){
        const oldT=dl.dataset.tdel;
        if(await askConfirm('حذف الوسم #'+oldT+' من كل الممثلات؟','حذف',true)){
          const ch=items.filter(i=>(i.tags||[]).includes(oldT));
          ch.forEach(i=>{ i.tags=i.tags.filter(x=>x!==oldT); i.updated=Date.now(); });
          await save(ch); render();
        }
        toolTags();
      }
    };
  });
}


// ===== v15: ميزات إضافية (لا تغيّر أي سلوك قائم) =====
(function(){ try{
  const $$=id=>document.getElementById(id);
  // 1) زر للأعلى
  const tt=$$('toTop'); let tk=false;
  addEventListener('scroll',()=>{ if(tk) return; tk=true; requestAnimationFrame(()=>{ tk=false; tt.classList.toggle('show',scrollY>700); }); },{passive:true});
  tt.onclick=()=>scrollTo({top:0,behavior:REDUCED?'auto':'smooth'});
  // 2) مؤشر الاتصال
  const op=$$('offPill'); const upd=()=>op.classList.toggle('show',!navigator.onLine);
  addEventListener('online',upd); addEventListener('offline',upd); upd();
  // 3) تذكير النسخة الاحتياطية (كل 14 يومًا، تأجيل أسبوع)
  const DAY=864e5, now=()=>Date.now();
  const bk=$$('bkBanner');
  $$('bkNow').onclick=()=>{ bk.classList.remove('show'); $$('bExp').click(); };
  $$('bkLater').onclick=()=>{ bk.classList.remove('show'); LS.set('vkte_bk_snooze',String(now())); };
  const chk=()=>{ if(!items||!items.length) return;
    let first=+LS.get('vkte_first_seen','0'); if(!first){ first=now(); LS.set('vkte_first_seen',String(first)); }
    const last=+LS.get('vkte_last_export','0')||first, sn=+LS.get('vkte_bk_snooze','0');
    if(now()-last>14*DAY && now()-sn>7*DAY && !$$('lock').classList.contains('show')) bk.classList.add('show'); };
  setTimeout(chk,4000);
  // 4) اختصار "/" للبحث + اختصارات التطبيق من الأيقونة
  document.addEventListener('keydown',e=>{ if(e.key==='/'&&!/input|textarea|select/i.test(e.target.tagName)&&!document.querySelector('.overlay.show')){ e.preventDefault(); $$('q').focus(); } });
  const go=new URLSearchParams(location.search).get('go');
  if(go){ const m={works:'nWorks',stats:'bStats',lists:'nLists',add:'bAdd',recs:'recBar'}[go]; if(m) setTimeout(()=>$$(m).click(),700); }
}catch(e){ console.warn('v15',e); } })();

(function(){ try{
  let sy=0,dy=0,mod=null,ov=null;
  document.addEventListener('touchstart',e=>{ const t=e.target; if(!t.classList||!t.classList.contains('modal')) return; const r=t.getBoundingClientRect(); const y=e.touches[0].clientY-r.top; if(y>34||t.scrollTop>0) return; mod=t; ov=t.parentElement; sy=e.touches[0].clientY; dy=0; mod.style.transition='none'; },{passive:true});
  document.addEventListener('touchmove',e=>{ if(!mod) return; dy=Math.max(0,e.touches[0].clientY-sy); mod.style.transform='translateY('+dy+'px)'; },{passive:true});
  const end=()=>{ if(!mod) return; const m2=mod, o2=ov, d=dy; mod=null; m2.style.transition='transform .25s var(--ease)';
    if(d>110){ m2.style.transform='translateY(100%)'; setTimeout(()=>{ m2.style.transition=''; m2.style.transform=''; if(o2.id==='ovAsk') return; o2.classList.remove('show'); },200); }
    else { m2.style.transform=''; setTimeout(()=>{ m2.style.transition=''; },260); } };
  document.addEventListener('touchend',end,{passive:true}); document.addEventListener('touchcancel',end,{passive:true});
}catch(e){ console.warn('v15c',e); } })();
// ===== v15d: عارض الصور بملء الشاشة + التراجع عن الحذف =====
function undoToast(msg,fn){
  let t=document.getElementById('undoT');
  if(!t){ t=document.createElement('div'); t.id='undoT'; t.innerHTML='<span></span><button type="button">تراجع</button>'; document.body.appendChild(t); }
  t.firstChild.textContent=msg; t.classList.add('show'); clearTimeout(undoToast.h);
  const hide=()=>t.classList.remove('show');
  t.lastChild.onclick=()=>{ hide(); clearTimeout(undoToast.h); fn(); };
  undoToast.h=setTimeout(hide,7000);
}

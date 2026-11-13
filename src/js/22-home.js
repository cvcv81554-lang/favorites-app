/* ===== الصفحة الرئيسية (لوحة) + صفحة «المزيد» + أعياد الميلاد + عدّاد الزيارات =====
   الرئيسية تلخّص المكتبة: مختارة اليوم، أرفف أفقية (مفضلات، الأعلى، الأحدث، الأكثر زيارة، أعياد ميلاد قريبة)،
   أعمال قادمة وقائمة المشاهدة، واختصارات الأدوات. كل الأرفف أزرار فتعمل بالريموت كما هي. */
const Home=(()=>{
  const m=$('mHome');
  const lsArr=k=>{ try{ const a=JSON.parse(LS.get(k,'[]')); return Array.isArray(a)?a:[]; }catch{ return []; } };
  // ---- أعياد الميلاد ----
  function nextBday(i){ const b=/^(\d{4})-(\d{2})-(\d{2})$/.exec(i.birth||''); if(!b) return null;
    const T=new Date(todayStr()+'T00:00:00'); let d=new Date(T.getFullYear(),+b[2]-1,+b[3]); if(d<T) d=new Date(T.getFullYear()+1,+b[2]-1,+b[3]);
    return {days:Math.round((d-T)/864e5),turns:d.getFullYear()-(+b[1]),date:d}; }
  const bdayList=()=>items.map(i=>[i,nextBday(i)]).filter(x=>x[1]).sort((a,b)=>a[1].days-b[1].days);
  const bdayTxt=n=>n.days===0?'اليوم 🎂':n.days===1?'غدًا':'بعد '+n.days+' يوم';
  function openBirthdays(){ const l=bdayList();
    askShow(`<div class="fh"><h2>أعياد الميلاد</h2><button class="ib" id="aOk" aria-label="إغلاق">${icon('x')}</button></div>
      ${l.length?`<div class="v17opts" style="max-height:66dvh">${l.map(([i,n])=>`<button type="button" class="v17row" data-od="${esc(i.id)}"><span class="av">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" alt="">`:'♡'}</span><span class="t"><b>${esc(i.name)}</b><small>${n.date.toLocaleDateString('ar',{day:'numeric',month:'long'})} · تُتمّ ${n.turns} سنة</small></span><em class="bd-d ${n.days<=7?'soon':''}">${bdayTxt(n)}</em></button>`).join('')}</div>`:'<div class="empty"><b>لا تواريخ ميلاد مسجّلة</b>أضف تاريخ الميلاد من «تعديل» في ملف الممثلة.</div>'}`,(mm,done)=>{
      mm.classList.add('wide'); mm.classList.toggle('blur',document.body.classList.contains('blur')); $('aOk').onclick=()=>done(true);
      mm.onclick=e=>{ const b=e.target.closest('[data-od]'); if(b){ done(true); openDetail(b.dataset.od); } }; }); }

  // ---- عناصر العرض ----
  const pCard=(i,extra)=>`<button type="button" class="hc" data-od="${esc(i.id)}"><span class="hc-ph">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" decoding="async" alt="">`:'♡'}${i.rating?`<em>★ ${(+i.rating).toFixed(1)}</em>`:''}${i.fav?'<i>★</i>':''}</span><b>${esc(i.name)}</b><small>${extra||esc(i.country||'')||'&nbsp;'}</small></button>`;
  const wCard=(g,extra)=>{ const fb=wPic(g.who[0]||{},g.t)||'', src=g.p||fb;
    return `<button type="button" class="hw" data-wsheet="${esc(g.key)}"><span class="hw-ph">${src?`<img src="${esc(src)}" data-fb="${esc(fb)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="wImgErr(this)" alt="">`:badge(g.s)}${extra?`<em>${esc(extra)}</em>`:''}</span><b dir="auto">${esc(g.t)}</b><small>${esc(g.who.map(x=>x.name).join('، '))}</small></button>`; };
  const shelf=(title,body,go,cls)=>body?`<section class="hs"><div class="hs-h"><h3>${title}</h3>${go?`<button type="button" class="hs-all" data-go="${go}">عرض الكل ‹</button>`:''}</div><div class="hrow ${cls||''}">${body}</div></section>`:'';
  let spotSkip=0;
  function spotlight(){ const pool=items.filter(i=>pic(i)); if(!pool.length) return '';
    const best=pool.filter(i=>i.fav||(i.rating||0)>=4), src=best.length>=3?best:pool;
    const i=src[(hhash(todayStr())+spotSkip)%src.length], a=age(i.birth), ws=i.works||[];
    const big=(i.photos&&i.photos[0])||pic(i);
    return `<section class="spot" data-od="${esc(i.id)}"><img class="spot-bg" src="${esc(pic(i))}" alt=""><div class="spot-ph"><img src="${esc(big)}" decoding="async" alt=""></div>
      <div class="spot-b"><span class="spot-k">مختارة اليوم</span><h2>${esc(i.name)}</h2>
        <div class="spot-m">${i.rating?stars(i.rating)+`<b>${(+i.rating).toFixed(1)}</b>`:''}<span>${esc([i.country,a!=null?a+' سنة':'',ws.length?ws.length+' عمل':''].filter(Boolean).join(' · '))}</span></div>
        <div class="spot-a"><button type="button" class="btn gold" data-od="${esc(i.id)}">فتح الملف</button><button type="button" class="btn" data-show="${esc(i.id)}">${icon('slides')} شرائح</button><button type="button" class="btn" data-spot="next" aria-label="مختارة أخرى">${icon('shuffle')}</button></div></div></section>`; }

  function draw(){
    if(!items.length){ m.innerHTML=`<div class="hwel"><svg class="mark"><use href="#logo"/></svg><h2>أهلًا بك في المفضلة</h2><p class="src">مكتبتك الخاصة: ملفات، صور، تقييمات، وأعمال. كل شيء يبقى على جهازك.</p>
        <div class="hwel-a"><button type="button" class="btn gold" data-tool="add">${icon('plus')} أضف أول ممثلة</button><button type="button" class="btn" data-tool="import">استيراد نسخة احتياطية</button></div></div>`; return; }
    const N=items.length, all=wAll(), nSeen=all.filter(g=>g.seen).length, by=new Map(items.map(i=>[i.id,i]));
    const favs=items.filter(i=>i.fav).sort((a,b)=>(b.rating||0)-(a.rating||0)||b.updated-a.updated);
    const top=items.filter(i=>i.rating>0).sort((a,b)=>b.rating-a.rating||(b.elo||0)-(a.elo||0)).slice(0,14);
    const fresh=items.slice().sort((a,b)=>(b.added||0)-(a.added||0)).slice(0,14);
    const recent=lsArr('vkte_recent').map(id=>by.get(id)).filter(Boolean).slice(0,12);
    const viewed=items.filter(i=>i.views>1).sort((a,b)=>b.views-a.views).slice(0,12);
    const unrated=items.filter(i=>!(i.rating>0)).slice(0,12);
    const bd=bdayList().filter(x=>x[1].days<=45).slice(0,12);
    const ranked=items.filter(i=>i.duels>0).sort((a,b)=>(b.elo||1000)-(a.elo||1000)).slice(0,12);
    const upc=wApply(all,'upcoming').slice(0,12), wl=wApply(all,'watchlist').slice(0,12);
    const newW=all.filter(g=>!g.seen&&!isUpcoming(g)&&g.d).sort((a,b)=>b.d.localeCompare(a.d)).slice(0,12);
    const tile=(k,ic,t,s)=>`<button type="button" class="ht" data-tool="${k}"><span>${ic}</span><b>${t}</b><small>${s}</small></button>`;
    m.innerHTML=`<header class="hh"><div class="brand"><svg class="mark"><use href="#logo"/></svg><div class="logo">المفضلة<small>${new Date().toLocaleDateString('ar',{weekday:'long',day:'numeric',month:'long'})}</small></div></div>
        <div class="ibtns"><button type="button" class="ib" data-tool="search" aria-label="بحث">${icon('search')}</button><button type="button" class="ib" data-tool="add" aria-label="إضافة">${icon('plus')}</button><button type="button" class="ib" data-tool="settings" aria-label="الإعدادات">${icon('set')}</button></div></header>
      ${spotlight()}
      <div class="hstats"><button type="button" data-go="lib"><b>${N}</b><span>ممثلة</span></button><button type="button" data-go="fav"><b>${favs.length}</b><span>مفضلة</span></button><button type="button" data-go="works"><b>${all.length}</b><span>عمل</span></button><button type="button" data-go="unseen"><b>${all.length?Math.round(nSeen/all.length*100):0}٪</b><span>شاهدتها</span></button></div>
      <div class="htiles">${tile('duel','⚔️','مواجهة','أيهما تفضّل؟')}${tile('tier','🏆','المستويات','رتّبهن S إلى D')}${tile('rate','⭐','جلسة تقييم','قيّم غير المقيَّمات')}${tile('random','🎲','سحب عشوائي','ماذا أشاهد؟')}</div>
      ${Extras.goalHtml()}
      ${shelf('في مثل هذا اليوم 🕰️',Extras.memories().slice(0,12).map(g=>wCard(g,g.wd.slice(0,4))).join(''),'','wide')}
      ${shelf('تابعت مؤخرًا',recent.map(i=>pCard(i)).join(''))}
      ${shelf('المفضلات ★',favs.slice(0,14).map(i=>pCard(i)).join(''),'fav')}
      ${shelf('أعمال قادمة ⏳',upc.map(g=>{ const d=daysUntil(g.d); return wCard(g,d===0?'اليوم':d===1?'غدًا':d>1?'بعد '+d+' يوم':'قريبًا'); }).join(''),'upcoming','wide')}
      ${shelf('قائمة المشاهدة 🔖',wl.map(g=>wCard(g,g.du?g.du+' د':'')).join(''),'watchlist','wide')}
      ${shelf('مقترحات تناسب ذوقك 💡',(_recCache.list||[]).slice(0,12).map((c,n)=>`<button type="button" class="hc" data-rec="${n}"><span class="hc-ph">${c.img?`<img src="${esc(c.img)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="this.remove()" alt="">`:'♡'}${c.matchPct?`<em>${c.matchPct}٪</em>`:''}</span><b>${esc(c.name)}</b><small>${esc(c.cc?ctryName(c.cc):(c.country||''))||'&nbsp;'}</small></button>`).join(''),'recs')}
      ${shelf('الأعلى تقييمًا',top.map(i=>pCard(i)).join(''),'top')}
      ${shelf('ترتيب المواجهات ⚔️',ranked.map((i,n)=>pCard(i,'#'+(n+1)+' · '+(i.elo||1000))).join(''),'duelboard')}
      ${shelf('أعياد ميلاد قريبة 🎂',bd.map(([i,n])=>pCard(i,bdayTxt(n)+' · '+n.turns)).join(''),'bday')}
      ${shelf('صدر حديثًا ولم تشاهده',newW.map(g=>wCard(g,fmtWd(g.d))).join(''),'unseenw','wide')}
      ${shelf('أضيفت حديثًا',fresh.map(i=>pCard(i,fmtDate(i.added||i.updated))).join(''),'recent')}
      ${shelf('الأكثر زيارة',viewed.map(i=>pCard(i,i.views+' زيارة')).join(''))}
      ${shelf('بانتظار تقييمك',unrated.map(i=>pCard(i)).join(''),'unrated')}`; }

  // ---- التنقل ----
  function goLib(fn){ closeOv('ovHome'); state.fav=false; state.tag=null; state.list=null; state.smart=null; $('q').value=''; if(fn) fn(); render(true); window.scrollTo(0,0); }
  const GO={ lib:()=>goLib(), fav:()=>goLib(()=>{ state.fav=true; }), top:()=>goLib(()=>{ $('sort').value='rating'; }), recent:()=>goLib(()=>{ $('sort').value='added'; }), unrated:()=>goLib(()=>{ state.smart='unrated'; }),
    works:()=>openWorksHub('recent'), upcoming:()=>openWorksHub('upcoming'), watchlist:()=>openWorksHub('watchlist'), unseen:()=>openWorksHub('unseen'), unseenw:()=>openWorksHub('unseen'), bday:openBirthdays, duelboard:()=>Duel.open('board'), recs:()=>{ if(window.openRecs) window.openRecs(); } };
  const TOOL={ duel:()=>Duel.open(), tier:()=>Tier.open(), random:()=>$('bRandom').click(), show:()=>Gallery.playLibrary(), add:()=>$('bAdd').click(), settings:()=>$('bSet').click(), import:()=>$('bSet').click(),
    search:()=>{ goLib(); setTimeout(()=>$('q').focus(),120); }, bday:openBirthdays, compare:()=>toolCompare(), tags:()=>toolTags(), lock:()=>$('bLock').click(), blur:()=>$('bBlur').click() };
  const onClick=e=>{ const t=e.target;
    const sp=t.closest('[data-spot]'); if(sp){ spotSkip++; draw(); return; }
    const sh=t.closest('[data-show]'); if(sh){ Gallery.playItem(sh.dataset.show); return; }
    const rc=t.closest('[data-rec]'); if(rc){ const c=(_recCache.list||[])[+rc.dataset.rec]; if(c) previewRecPerformer(c); return; }
    const tl=t.closest('[data-tool]'); if(tl){ const f=TOOL[tl.dataset.tool]; if(f) f(); return; }
    const go=t.closest('[data-go]'); if(go){ const f=GO[go.dataset.go]; if(f) f(); return; }
    const ws=t.closest('[data-wsheet]'); if(ws){ wSheet(ws.dataset.wsheet); return; }
    const od=t.closest('[data-od]'); if(od) openDetail(od.dataset.od); };
  m.addEventListener('click',onClick); $('mMore').addEventListener('click',onClick);
  const open=()=>{ draw(); $('ovHome').classList.add('show'); m.scrollTop=0; };
  $('nDash').onclick=open; $('nMore').onclick=()=>{ $('ovMore').classList.add('show'); };
  // أعد الرسم عند تغيّر البيانات إن كانت الرئيسية ظاهرة (مؤجَّلًا كي لا يقفز أثناء التفاعل)
  let rt=0; const later=()=>{ clearTimeout(rt); rt=setTimeout(()=>{ if($('ovHome').classList.contains('show')&&!document.querySelector('.overlay.show:not(.page)')){ const s=m.scrollTop; draw(); m.scrollTop=s; } },700); };
  HOOKS.saved.push(later); HOOKS.deleted.push(later);
  new MutationObserver(()=>{ if(!document.querySelector('.overlay.show:not(.page)')) later(); }).observe($('ovDetail'),{attributes:true,attributeFilter:['class']});

  // ---- عدّاد الزيارات (يغذّي رف «الأكثر زيارة») ----
  const _od=openDetail; let vt=0; const pend=new Set();
  openDetail=function(id){ const r=_od.apply(this,arguments);
    try{ const it=items.find(x=>x.id===id); if(it){ it.views=(it.views||0)+1; it.lastView=Date.now(); pend.add(it); clearTimeout(vt); vt=setTimeout(()=>{ const a=[...pend].filter(x=>items.includes(x)); pend.clear(); if(a.length) save(a); },4000); } }catch{}
    return r; };
  return {open,draw,openBirthdays,nextBday,TOOL};
})();

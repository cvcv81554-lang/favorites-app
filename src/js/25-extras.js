/* ===== أقسام إضافية: الإنجازات، ملخص السنة، جلسة التقييم، قائمة الانتظار، الاستوديوهات، هدف الأسبوع =====
   + تحديث الأعمال من المصادر بتقرير واضح (كان يفشل بصمت ويتجاوز غير المرتبطات). */
const Extras=(()=>{
  const jget=(k,d)=>{ try{ const v=JSON.parse(LS.get(k,'null')); return v==null?d:v; }catch{ return d; } };
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const av=i=>`<span class="av">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" decoding="async" alt="">`:'♡'}</span>`;
  const sheet=(html,wire)=>askShow(html,(m,done)=>{ m.classList.add('wide'); m.classList.toggle('blur',document.body.classList.contains('blur')); const x=m.querySelector('[data-x]'); if(x) x.onclick=()=>done(null); wire&&wire(m,done); });
  const head=t=>`<div class="fh"><h2>${t}</h2><button class="ib" data-x aria-label="إغلاق">${icon('x')}</button></div>`;
  const dayNum=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||''); return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5):NaN; };

  // ---------- هدف الأسبوع ----------
  const goal=()=>+LS.get('vkte_goal','0')||0;
  const seen7=()=>{ const t0=dayNum(todayStr()); return wAll().filter(g=>g.seen&&g.wd&&t0-dayNum(g.wd)<7&&t0-dayNum(g.wd)>=0).length; };
  function goalHtml(){ const g=goal(), n=seen7(); if(!g) return `<button type="button" class="hgoal off" data-tool="goal"><span>🎯</span><b>حدّد هدف مشاهدة أسبوعي</b><small>كم عملًا تريد مشاهدته كل أسبوع؟</small></button>`;
    const p=Math.min(100,Math.round(n/g*100)); return `<button type="button" class="hgoal ${n>=g?'done':''}" data-tool="goal"><span>${n>=g?'🏅':'🎯'}</span><b>هدف الأسبوع: ${n} / ${g}</b><div class="bt"><div class="bf" style="width:${Math.max(3,p)}%"></div></div><small>${n>=g?'أحسنت! حققت هدفك':'باقٍ '+(g-n)+' في آخر 7 أيام'}</small></button>`; }
  async function setGoal(){ const v=await askText('هدف المشاهدة الأسبوعي (عدد الأعمال، 0 للإلغاء)',String(goal()||''),'مثال: 5'); if(v===null) return; LS.set('vkte_goal',String(Math.max(0,Math.min(99,parseInt(v,10)||0)))); Home.draw(); }

  // ---------- الإنجازات ----------
  function achievements(){ const all=wAll(), N=items.length, seen=all.filter(g=>g.seen), per={}; seen.forEach(g=>{ const d=dayNum(g.wd); if(!isNaN(d)) per[d]=1; });
    let best=0, cur=0, prev=null; Object.keys(per).map(Number).sort((a,b)=>a-b).forEach(d=>{ cur=prev!==null&&d===prev+1?cur+1:1; best=Math.max(best,cur); prev=d; });
    const full=i=>[(i.photos||[]).length>0,!!i.birth,!!i.country,(i.works||[]).length>0,!!i.notes,(i.tags||[]).length>0,i.rating>0].filter(Boolean).length;
    const D=(ic,t,d,cur,goals)=>goals.map((g,k)=>({ic,t:t+(goals.length>1?' '+['I','II','III','IV'][k]:''),d:d.replace('{n}',g),cur,goal:g}));
    return [...D('📚','جامع','أضف {n} ممثلة',N,[10,50,100,250]),...D('⭐','ناقد','قيّم {n} ممثلة',items.filter(i=>i.rating>0).length,[10,50,150]),...D('👁','مشاهِد','شاهد {n} عملًا',seen.length,[25,100,500,1000]),
      ...D('🔥','مواظب','شاهد {n} أيام متتالية',best,[3,7,30]),...D('🎬','ناقد أعمال','قيّم {n} عملًا',all.filter(g=>g.r>0).length,[10,50,200]),...D('⚔️','محارب','العب {n} مواجهة',Math.round(items.reduce((a,i)=>a+(i.duels||0),0)/2),[20,100,500]),
      ...D('🏆','مصنِّف','ضع {n} ممثلة في مستوى',items.filter(i=>i.tier).length,[10,50]),...D('🖼️','مصوّر','اجمع {n} صورة',items.reduce((a,i)=>a+(i.photos||[]).length,0),[50,250,1000]),
      ...D('🗂️','منظِّم','أنشئ {n} قوائم',lists.length+wlists.length,[3,10]),...D('✅','متقِن','أكمل ملف {n} ممثلة (6 حقول فأكثر)',items.filter(i=>full(i)>=6).length,[10,50]),...D('📝','كاتب','اكتب ملاحظة على {n} عملًا',all.filter(g=>g.n).length,[5,25])]; }
  function openAch(){ const a=achievements(), done=a.filter(x=>x.cur>=x.goal).length;
    sheet(head('🏅 الإنجازات')+`<p class="src" style="margin-bottom:12px">حققت <b style="color:var(--acc2)">${done}</b> من ${a.length}</p><div class="achg">${a.sort((x,y)=>(y.cur>=y.goal)-(x.cur>=x.goal)||y.cur/y.goal-x.cur/x.goal).map(x=>{ const ok=x.cur>=x.goal;
      return `<div class="ach ${ok?'ok':''}"><span>${x.ic}</span><b>${esc(x.t)}</b><small>${esc(x.d)}</small><div class="bt"><div class="bf" style="width:${Math.max(3,Math.min(100,x.cur/x.goal*100))}%"></div></div><em>${ok?'✓ تحقق':Math.min(x.cur,x.goal)+' / '+x.goal}</em></div>`; }).join('')}</div>`); }

  // ---------- ملخص السنة ----------
  function openWrap(year){ const all=wAll(), years=[...new Set(all.filter(g=>g.seen&&g.wd).map(g=>g.wd.slice(0,4)))].sort().reverse(); const Y=year||years[0]||todayStr().slice(0,4);
    const ws=all.filter(g=>g.seen&&(g.wd||'').startsWith(Y)), cnt=(arr)=>{ const m=new Map(); arr.forEach(k=>{ if(k) m.set(k,(m.get(k)||0)+1); }); return [...m].sort((a,b)=>b[1]-a[1]); };
    const perf=cnt(ws.flatMap(g=>g.who)).slice(0,6), st=cnt(ws.map(g=>g.s)).slice(0,5), tg=cnt(ws.flatMap(g=>g.tg||[])).slice(0,8), mins=ws.reduce((a,g)=>a+(g.du||30),0);
    const mo=Array(12).fill(0); ws.forEach(g=>{ mo[+g.wd.slice(5,7)-1]++; }); const mx=Math.max(1,...mo), bestM=mo.indexOf(Math.max(...mo));
    const five=ws.filter(g=>g.r>=5).slice(0,6), added=items.filter(i=>new Date(i.added||0).getFullYear()===+Y).length, mName=k=>new Date(2020,k,1).toLocaleDateString('ar',{month:'short'});
    sheet(head('📅 ملخص السنة')+`<div class="v17chips">${(years.length?years:[Y]).map(y=>`<span class="chip ${y===Y?'on':''}" data-y="${y}">${y}</span>`).join('')}</div>
      ${ws.length?`<div class="wrapk"><div><b>${ws.length}</b><span>عمل شاهدته</span></div><div><b>${fmtDur(mins)||'0'}</b><span>وقت المشاهدة</span></div><div><b>${added}</b><span>ممثلة أضفتها</span></div><div><b>${mName(bestM)}</b><span>أنشط شهر</span></div></div>
        <h3>الأكثر مشاهدة</h3><div class="wrapp">${perf.map(([i,n],k)=>`<button type="button" class="hc" data-od="${esc(i.id)}"><span class="hc-ph">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" alt="">`:'♡'}<em>#${k+1}</em></span><b>${esc(i.name)}</b><small>${n} عمل</small></button>`).join('')}</div>
        <h3>المشاهدة بالأشهر</h3><div class="vbars" style="height:110px">${mo.map((v,k)=>`<div class="vb"><em>${v||''}</em><div style="height:${v?Math.max(6,v/mx*78):0}%"></div>${k+1}</div>`).join('')}</div>
        ${st.length?`<h3>أكثر الاستوديوهات</h3>${st.map(([s,n])=>`<div class="brow"><span class="bl">${esc(s)}</span><div class="bt"><div class="bf" style="width:${Math.max(4,n/st[0][1]*100)}%"></div></div><span class="bv">${n}</span></div>`).join('')}`:''}
        ${tg.length?`<h3>أكثر الوسوم</h3><div class="cloud">${tg.map(([t,n])=>`<span style="--w:${(n/tg[0][1]).toFixed(2)}">#${esc(t)}<small>${n}</small></span>`).join('')}</div>`:''}
        ${five.length?`<h3>أعمال بخمس نجوم</h3>${five.map(g=>`<div class="rk" data-ws="${esc(g.key)}"><span class="n">★</span><div class="nm" dir="auto">${esc(g.t)}</div></div>`).join('')}`:''}`
      :`<div class="empty"><b>لا مشاهدات مسجّلة في ${Y}</b>علّم الأعمال كمشاهَدة ليُبنى ملخصك.</div>`}`,(m,done)=>{
      m.onclick=e=>{ const y=e.target.closest('[data-y]'); if(y){ done(null); openWrap(y.dataset.y); return; } const o=e.target.closest('[data-od]'); if(o){ done(null); openDetail(o.dataset.od); return; } const w=e.target.closest('[data-ws]'); if(w){ done(null); wSheet(w.dataset.ws); } }; }); }

  // ---------- جلسة التقييم السريع ----------
  function openRate(){ const q=items.filter(i=>!(i.rating>0)&&!i.criteria).sort(()=>Math.random()-.5); if(!q.length){ toast('كل الممثلات مقيَّمات ✓'); return; } let k=0, n=0;
    const draw=()=>{ const i=q[k]; if(!i){ askNote('انتهت الجلسة: قيّمت '+n+' ممثلة 🎉'); return; }
      sheet(head('⭐ جلسة تقييم')+`<p class="src" style="text-align:center;margin-bottom:8px">${k+1} من ${q.length}${n?' · قيّمت '+n:''}</p>
        <div class="rses"><div class="rses-ph">${pic(i)?`<img src="${esc((i.photos&&i.photos[0])||pic(i))}" alt="">`:'♡'}</div><h3 style="text-align:center;color:var(--text);font-size:1.2rem;margin:10px 0 2px">${esc(i.name)}</h3><p class="src" style="text-align:center">${esc(i.country||'')||'&nbsp;'}</p>
        <div class="starpick rses-s">${[1,2,3,4,5].map(s=>`<button type="button" data-s="${s}">★</button>`).join('')}</div></div>
        <div class="actions" style="justify-content:center"><button type="button" class="btn ${i.fav?'gold':''}" data-f>★ مفضلة</button><button type="button" class="btn" data-o>فتح الملف</button><button type="button" class="btn" data-n>تخطّي ←</button></div>`,(m,done)=>{
        m.onclick=async e=>{ const s=e.target.closest('[data-s]'); if(s){ i.rating=+s.dataset.s; i.updated=Date.now(); await save(i); n++; k++; done(null); render(); draw(); return; }
          if(e.target.closest('[data-f]')){ i.fav=!i.fav; await save(i); e.target.closest('[data-f]').classList.toggle('gold',i.fav); return; }
          if(e.target.closest('[data-o]')){ done(null); openDetail(i.id); return; } if(e.target.closest('[data-n]')){ k++; done(null); draw(); } }; }); };
    draw(); }

  // ---------- قائمة الانتظار (أسماء تريد إضافتها لاحقًا) ----------
  const wish=()=>jget('vkte_wish',[]), setWish=a=>{ LS.set('vkte_wish',JSON.stringify(a.slice(0,500))); metaChanged(); };
  function openWish(){ const a=wish();
    sheet(head('📌 قائمة الانتظار')+`<p class="src" style="margin-bottom:8px">أسماء سمعت عنها وتريد إضافتها لاحقًا.</p><div class="inrow" style="margin:0 0 10px"><input class="in" id="wsIn" placeholder="اكتب اسمًا ثم إضافة" autocomplete="off"><button type="button" class="btn gold" data-add>إضافة</button></div>
      ${a.length?`<div class="v17opts" style="max-height:56dvh">${a.map((x,k)=>`<div class="lrow" style="margin:0"><div class="lname"><span>${esc(x.n)}</span><small>${fmtDate(x.t)}</small></div><div class="lact"><button class="ib sm" data-mk="${k}" title="أضفها للمكتبة" aria-label="أضفها للمكتبة">${icon('plus')}</button><button class="ib sm" data-rm="${k}" title="حذف" aria-label="حذف">${icon('trash')}</button></div></div>`).join('')}</div>`:'<div class="empty" style="padding:26px 10px"><b>القائمة فارغة</b></div>'}`,(m,done)=>{
      const add=()=>{ const v=$('wsIn').value.trim(); if(!v) return; if(items.some(i=>norm(i.name)===norm(v))){ toast('موجودة في مكتبتك'); return; } const b=wish(); if(!b.some(x=>norm(x.n)===norm(v))) b.unshift({n:v,t:Date.now()}); setWish(b); done(null); openWish(); };
      $('wsIn').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } };
      m.onclick=e=>{ if(e.target.closest('[data-add]')) return add(); const r=e.target.closest('[data-rm]'), k=e.target.closest('[data-mk]');
        if(r){ const b=wish(); b.splice(+r.dataset.rm,1); setWish(b); done(null); openWish(); }
        else if(k){ const b=wish(), x=b[+k.dataset.mk]; done(null); openForm(null); setTimeout(()=>{ if($('fName')){ $('fName').value=x.n; ['sQ','sQ2'].forEach(id=>{ if($(id)) $(id).value=x.n; }); } },60); } }; }); }
  // عند حفظ ممثلة اسمها في قائمة الانتظار تُزال منها
  HOOKS.saved.push(arr=>{ const b=wish(); if(!b.length) return; const names=new Set(arr.map(i=>norm(i.name))); const c=b.filter(x=>!names.has(norm(x.n))); if(c.length!==b.length) setWish(c); });

  // ---------- الاستوديوهات ----------
  function studios(){ const m=new Map(); wAll().forEach(g=>{ if(!g.s) return; let s=m.get(g.s); if(!s) m.set(g.s,s={s:g.s,n:0,seen:0,rs:0,rc:0,who:new Map()}); s.n++; if(g.seen) s.seen++; if(g.r>0){ s.rs+=g.r; s.rc++; } g.who.forEach(i=>s.who.set(i,(s.who.get(i)||0)+1)); }); return [...m.values()].sort((a,b)=>b.n-a.n); }
  function openStudios(){ const a=studios();
    sheet(head('🎬 الاستوديوهات')+(a.length?`<p class="src" style="margin-bottom:8px">${a.length} استوديو. اضغط أحدها لعرض ممثلاته وأعماله.</p><div class="v17opts" style="max-height:64dvh">${a.map((x,k)=>`<button type="button" class="v17row" data-k="${k}">${badge(x.s)}<span class="t"><b dir="auto">${esc(x.s)}</b><small>${x.n} عمل · ${x.who.size} ممثلة · شاهدت ${Math.round(x.seen/x.n*100)}٪${x.rc?' · ★ '+(x.rs/x.rc).toFixed(1):''}</small></span></button>`).join('')}</div>`:'<div class="empty"><b>لا استوديوهات بعد</b>تظهر هنا عند إضافة أعمال لها موقع أو استوديو.</div>'),(m,done)=>{
      m.onclick=e=>{ const r=e.target.closest('[data-k]'); if(r){ done(null); openStudio(a[+r.dataset.k]); } }; }); }
  function openStudio(x){ const who=[...x.who].sort((a,b)=>b[1]-a[1]);
    sheet(head(esc(x.s))+`<div class="wrapk"><div><b>${x.n}</b><span>عمل</span></div><div><b>${Math.round(x.seen/x.n*100)}٪</b><span>شاهدته</span></div><div><b>${x.rc?(x.rs/x.rc).toFixed(1):'—'}</b><span>متوسط تقييمك</span></div><div><b>${who.length}</b><span>ممثلة</span></div></div>
      <h3>ممثلاته في مكتبتك</h3><div class="wrapp">${who.slice(0,30).map(([i,n])=>`<button type="button" class="hc" data-od="${esc(i.id)}"><span class="hc-ph">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" alt="">`:'♡'}</span><b>${esc(i.name)}</b><small>${n} عمل</small></button>`).join('')}</div>
      <div class="actions"><button type="button" class="btn" data-b>‹ كل الاستوديوهات</button><button type="button" class="btn gold" data-w>عرض أعماله</button></div>`,(m,done)=>{
      m.onclick=e=>{ const o=e.target.closest('[data-od]'); if(o){ done(null); openDetail(o.dataset.od); return; } if(e.target.closest('[data-b]')){ done(null); openStudios(); return; }
        if(e.target.closest('[data-w]')){ done(null); wState.site=x.s; wState.tab='recent'; wState.sub='allw'; openWorksHub(); } }; }); }

  // ---------- في مثل هذا اليوم ----------
  const memories=()=>{ const T=todayStr(), md=T.slice(5); return wAll().filter(g=>g.seen&&g.wd&&g.wd.slice(5)===md&&g.wd<T.slice(0,4)); };

  Object.assign(Home.TOOL,{goal:setGoal,ach:openAch,wrap:()=>openWrap(),rate:openRate,wish:openWish,studios:openStudios});
  return {goalHtml,memories,openAch,openWrap,openRate,openWish,openStudios};
})();

/* ===== تحديث الأعمال من المصادر =====
   يمرّ على كل الممثلات (المرتبطات أولًا، ويحاول ربط غير المرتبطات بتطابق الاسم التام)، يعيد المحاولة عند تجاوز حد الطلبات،
   ويعرض في النهاية تقريرًا: كم حُدّثت، كم عملًا أُضيف، وما سبب أي فشل. الضغط على الزر أثناء التحديث يوقفه. */
let wRadarStop=false;
wRadar=async function(){
  if(wRadarBusy){ wRadarStop=true; return; }
  const hasP=!!LS.get('vkte_key'), hasS=!!LS.get('vkte_stash');
  if(!hasP&&!hasS){ await askNote('لتحديث الأعمال تلقائيًا أضف مفتاح ThePornDB أو StashDB من الإعدادات. بدون مفتاح تُضاف الأعمال يدويًا بزر ＋.'); return; }
  if(navigator.onLine===false){ toast('لا يوجد اتصال بالإنترنت'); return; }
  if(!items.length){ toast('أضف ممثلات أولًا'); return; }
  wRadarBusy=true; wRadarStop=false;
  const st={ok:0,add:0,linked:0,none:0,fail:0,why:new Map()}, sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const why=(src,e)=>{ const s=e&&e.status, t=s===401||s===403?'المفتاح غير صالح أو منتهٍ':s===429?'تجاوزت حد الطلبات':s?'رمز '+s:(e&&e.gql?String(e.message).slice(0,60):'تعذّر الاتصال'); st.why.set(src+': '+t,(st.why.get(src+': '+t)||0)+1); return s===401||s===403; };
  const again=async fn=>{ try{ return await fn(); }catch(e){ if(e&&e.status===429){ await sleep(6000); return fn(); } throw e; } };
  const list=items.slice().sort((a,b)=>(+!!(b.pdbId||b.stashId))-(+!!(a.pdbId||a.stashId))||(a.worksAt||0)-(b.worksAt||0));
  let useP=hasP, useS=hasS, n=0;
  try{
    for(const it of list){ if(wRadarStop||(!useP&&!useS)) break; n++;
      busy.show(`تحديث الأعمال ${n} / ${list.length} — ${it.name}${st.add?' · +'+st.add+' عمل':''}`,()=>{ wRadarStop=true; });
      let fresh=[], did=false, bad=false;
      if(useP){ try{ if(!it.pdbId){ const m=await again(()=>findPerformer(it.name,true)); if(m){ it.pdbId=m.id; st.linked++; } }
          if(it.pdbId){ fresh=fresh.concat(await again(()=>fetchWorksFor(it.pdbId))); did=true; } }catch(e){ bad=true; if(why('ThePornDB',e)) useP=false; } }
      if(useS){ try{ if(!it.stashId){ const m=await again(()=>findStash(it.name,true)); if(m){ it.stashId=m.id; st.linked++; } }
          if(it.stashId){ fresh=fresh.concat(await again(()=>sdWorks(it.stashId))); did=true; } }catch(e){ bad=true; if(why('StashDB',e)) useS=false; } }
      if(did){ const r=mergeWorks(it.works,fresh); it.works=r.list; it.worksAt=Date.now(); await save(it); st.ok++; st.add+=r.n; }
      else if(bad) st.fail++; else st.none++;
      await sleep(220); }
    if(useS&&!wRadarStop){ busy.show('فحص الإصدارات القادمة…'); try{ st.add+=await sdUpcoming(); }catch{} }
  }finally{ busy.hide(); wRadarBusy=false; }
  _wCache=null; updWorksDot(); if($('ovWorks').classList.contains('show')) drawWorksHub(); if($('ovHome').classList.contains('show')) Home.draw();
  const lines=[`حُدّثت ${st.ok} ممثلة من ${list.length}${wRadarStop?' (أُوقف التحديث)':''}.`, st.add?`أُضيف ${st.add} عمل جديد ✨`:'لا أعمال جديدة.'];
  if(st.linked) lines.push(`رُبطت ${st.linked} ممثلة بالمصدر تلقائيًا.`);
  if(st.none) lines.push(`${st.none} ممثلة لم أجد لها تطابقًا تامًّا بالاسم في المصدر (اربطها من «تعديل» ← تعبئة من المصدر).`);
  if(st.why.size) lines.push('أخطاء: '+[...st.why].map(([k,c])=>k+' (×'+c+')').join('، ')+'.');
  await askNote(lines.join('\n'));
};

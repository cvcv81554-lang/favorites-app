/* ===== v33: نشاطي (خريطة المشاهدة والسلاسل)، في مثل هذا اليوم، مسيرة الممثلة، اكتمال المكتبة، مزاج الليلة =====
   وحدة إضافية للقراءة والعرض فقط: لا تغيّر صيغة البيانات ولا تكتب إلا عبر الدوال الموجودة. */
const Plus=(()=>{
  const sheet=(html,wire)=>askShow(html,(m,done)=>{ m.classList.add('wide'); m.classList.toggle('blur',document.body.classList.contains('blur')); m.querySelectorAll('[data-x]').forEach(x=>x.onclick=()=>done(null)); wire&&wire(m,done); });
  const head=(t,sub)=>`<div class="fh"><div><h2>${t}</h2>${sub?`<small class="src">${sub}</small>`:''}</div><button class="ib" data-x aria-label="إغلاق">${icon('x')}</button></div>`;
  const av=i=>`<span class="av">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" decoding="async" alt="">`:'♡'}</span>`;
  const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const isDay=s=>/^\d{4}-\d{2}-\d{2}/.test(s||'');
  const dayN=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||''); return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5):NaN; };
  const fromN=n=>new Date(n*864e5).toISOString().slice(0,10);
  const yearsAgo=y=>{ const n=new Date().getFullYear()-y; return n===1?'قبل سنة':n===2?'قبل سنتين':'قبل '+n+' سنوات'; };
  const close=()=>{ if(ask.cancel) ask.cancel(); };
  // فتح عمل أو ممثلة بعد إغلاق النافذة (كي لا تختفي خلفها)
  const goWork=k=>{ close(); setTimeout(()=>{ if(typeof wSheet==='function') wSheet(k); },60); };
  const goPerf=id=>{ close(); setTimeout(()=>openDetail(id),60); };
  const wLine=g=>`<button type="button" class="p33w" data-wk33="${esc(g.key)}">${g.p?`<img src="${esc(g.p)}" loading="lazy" alt="">`:'<i>🎬</i>'}<span><b>${esc(g.t)}</b><small>${esc([g.who.map(i=>i.name).slice(0,2).join('، '),g.s,g.y].filter(Boolean).join(' · '))}${g.r?' · '+'★'.repeat(g.r):''}</small></span></button>`;
  const wire0=(m,done)=>{ m.addEventListener('click',e=>{ const w=e.target.closest('[data-wk33]'); if(w){ goWork(w.dataset.wk33); return; } const p=e.target.closest('[data-pf33]'); if(p){ goPerf(p.dataset.pf33); } }); };

  // ================= 1) نشاطي: خريطة المشاهدة + السلاسل =================
  function watchDays(){ const m=new Map(); wAll().forEach(g=>{ if(g.seen&&isDay(g.wd)){ const d=g.wd.slice(0,10); if(!m.has(d)) m.set(d,[]); m.get(d).push(g); } }); return m; }
  function streaks(days){ const ns=[...days.keys()].map(dayN).filter(n=>!isNaN(n)).sort((a,b)=>a-b); let best=0, run=0, prev=null;
    ns.forEach(n=>{ run=prev!=null&&n===prev+1?run+1:1; best=Math.max(best,run); prev=n; });
    const set=new Set(ns), t=dayN(todayStr()); let cur=0, d=set.has(t)?t:t-1; while(set.has(d)){ cur++; d--; }
    return {cur,best,alive:set.has(t)}; }
  function heat(days,Y){ const start=new Date(Date.UTC(Y,0,1)), off=start.getUTCDay(), n0=Math.floor(start/864e5)-off, last=Math.floor(Date.UTC(Y,11,31)/864e5);
    const weeks=Math.ceil((last-n0+1)/7); let cells='', months='';
    const lvl=c=>c>=5?4:c>=3?3:c===2?2:c===1?1:0;
    for(let w=0;w<weeks;w++){ let col=''; for(let d=0;d<7;d++){ const n=n0+w*7+d, s=fromN(n), inY=s.startsWith(String(Y)), c=inY?(days.get(s)||[]).length:0;
        col+=`<i class="${inY?'l'+lvl(c):'out'}" ${inY?`data-d33="${s}" title="${s}: ${c} عمل"`:''}></i>`; }
      cells+=`<span>${col}</span>`;
      const fd=fromN(n0+w*7); if(fd.slice(8,10)<='07'&&fd.startsWith(String(Y))) months+=`<em style="grid-column:${w+1}">${new Date(fd).toLocaleDateString('ar',{month:'short'})}</em>`; }
    return `<div class="p33heat" dir="ltr"><div class="p33mo" style="grid-template-columns:repeat(${weeks},1fr)">${months}</div><div class="p33grid">${cells}</div>
      <div class="p33leg"><small>أقل</small><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><small>أكثر</small></div></div>`; }
  function openActivity(Y){ const days=watchDays(), all=[...days.keys()].sort(), years=[...new Set(all.map(d=>+d.slice(0,4)))].sort((a,b)=>b-a);
    Y=Y||years[0]||new Date().getFullYear(); const inY=all.filter(d=>d.startsWith(String(Y))), st=streaks(days);
    const total=inY.reduce((a,d)=>a+days.get(d).length,0), wd=Array(7).fill(0); inY.forEach(d=>{ wd[new Date(d+'T12:00:00').getDay()]+=days.get(d).length; });
    const bestWd=wd.indexOf(Math.max(...wd)), wdName=k=>new Date(2024,0,7+k).toLocaleDateString('ar',{weekday:'long'});
    const recent=all.slice(-6).reverse().flatMap(d=>days.get(d).map(g=>({d,g}))).slice(0,8);
    const html=head('🔥 نشاطي','خريطة مشاهداتك وسلاسل الأيام المتتالية')+
      (years.length>1?`<div class="chips p33y">${years.map(y=>`<button type="button" class="chip ${y===Y?'on':''}" data-y33="${y}">${y}</button>`).join('')}</div>`:'')+
      `<div class="p33st"><div><b>${total}</b><span>عمل في ${Y}</span></div><div><b>${inY.length}</b><span>يوم نشط</span></div><div><b>${st.cur}${st.cur&&!st.alive?'⏳':''}</b><span>السلسلة الحالية</span></div><div><b>${st.best}</b><span>أطول سلسلة</span></div></div>`+
      (all.length?heat(days,Y)+`<p class="src p33day" id="p33day">${total?'أكثر يوم تشاهد فيه: <b>'+wdName(bestWd)+'</b>'+(inY.length?' · بمعدل '+(total/inY.length).toFixed(1)+' عمل في اليوم النشط':''):'لا مشاهدات مؤرخة في هذه السنة.'} — اضغط مربعًا لترى أعمال يومه.</p>`
        +(recent.length?`<h3 class="p33h">آخر ما شاهدت</h3><div class="p33ws">${recent.map(x=>wLine(x.g)).join('')}</div>`:'')
      :'<p class="src">لا مشاهدات مؤرخة بعد. علّم الأعمال كـ«شاهدت» وستظهر هنا خريطتك.</p>')+
      (st.cur&&!st.alive?'<p class="src">⏳ شاهد عملًا اليوم كي لا تنقطع سلسلتك.</p>':'');
    return sheet(html,(m,done)=>{ wire0(m,done); m.addEventListener('click',e=>{ const y=e.target.closest('[data-y33]'); if(y){ done(null); setTimeout(()=>openActivity(+y.dataset.y33),60); return; }
      const c=e.target.closest('[data-d33]'); if(!c) return; const l=days.get(c.dataset.d33)||[]; const box=m.querySelector('#p33day');
      box.innerHTML=`<b>${esc(c.dataset.d33)}</b>: ${l.length?l.length+' عمل':'لا مشاهدات'}`+(l.length?`<div class="p33ws">${l.map(wLine).join('')}</div>`:''); }); }); }

  // ================= 2) في مثل هذا اليوم =================
  function onThisDay(){ const t=todayStr(), md=t.slice(5,10), Y=+t.slice(0,4), out={watched:[],added:[],released:[],bday:[]};
    wAll().forEach(g=>{ if(g.seen&&isDay(g.wd)&&g.wd.slice(5,10)===md&&+g.wd.slice(0,4)<Y) out.watched.push(g); if(isDay(g.d)&&g.d.slice(5,10)===md&&+g.d.slice(0,4)<Y) out.released.push(g); });
    items.forEach(i=>{ if(i.added){ const d=ymd(new Date(i.added)); if(d.slice(5,10)===md&&+d.slice(0,4)<Y) out.added.push({i,y:+d.slice(0,4)}); }
      if(isDay(i.birth)&&i.birth.slice(5,10)===md&&!minorRec(i)) out.bday.push(i); });
    out.watched.sort((a,b)=>a.wd.localeCompare(b.wd)); out.released.sort((a,b)=>b.d.localeCompare(a.d));
    out.n=out.watched.length+out.added.length+out.released.length+out.bday.length; return out; }
  function openOnThisDay(){ const o=onThisDay(), Y=new Date().getFullYear();
    const html=head('🕰️ في مثل هذا اليوم',new Date().toLocaleDateString('ar',{day:'numeric',month:'long'}))+
      (o.bday.length?`<h3 class="p33h">🎂 عيد ميلاد اليوم</h3><div class="p33ps">${o.bday.map(i=>`<button type="button" class="p33p" data-pf33="${esc(i.id)}">${av(i)}<b>${esc(i.name)}</b><small>${Y-+i.birth.slice(0,4)} سنة</small></button>`).join('')}</div>`:'')+
      (o.watched.length?`<h3 class="p33h">شاهدت في مثل هذا اليوم</h3><div class="p33ws">${o.watched.map(g=>wLine(g).replace('</small></span>',' · '+yearsAgo(+g.wd.slice(0,4))+'</small></span>')).join('')}</div>`:'')+
      (o.added.length?`<h3 class="p33h">أضفت إلى مكتبتك</h3><div class="p33ps">${o.added.map(x=>`<button type="button" class="p33p" data-pf33="${esc(x.i.id)}">${av(x.i)}<b>${esc(x.i.name)}</b><small>${yearsAgo(x.y)}</small></button>`).join('')}</div>`:'')+
      (o.released.length?`<h3 class="p33h">صدرت في مثل هذا اليوم</h3><div class="p33ws">${o.released.slice(0,12).map(g=>wLine(g).replace('</small></span>',' · '+yearsAgo(+g.d.slice(0,4))+'</small></span>')).join('')}</div>`:'')+
      (o.n?'':'<p class="src">لا ذكريات في هذا التاريخ بعد. عُد غدًا!</p>');
    return sheet(html,wire0); }
  // (الرئيسية فيها رف «في مثل هذا اليوم» أصلًا، فلا نضيف بطاقة مكررة؛ النافذة الكاملة من «المزيد»)

  // ================= 3) مسيرة الممثلة (داخل صفحتها) =================
  function career(it){ const ws=(it.works||[]).map(w=>({w,y:+(String(w.d||'').slice(0,4)||String(w.y||'').slice(0,4))||0})); const dated=ws.filter(x=>x.y>1970);
    if(!ws.length) return null; const byY=new Map(); dated.forEach(x=>byY.set(x.y,(byY.get(x.y)||0)+1));
    const ys=[...byY.keys()].sort((a,b)=>a-b), first=ys[0], last=ys[ys.length-1], nowY=new Date().getFullYear();
    const upc=ws.some(x=>x.w.upc), recentD=ws.map(x=>x.w.d||'').filter(isDay).sort().pop()||'';
    const months=recentD?Math.round((Date.now()-new Date(recentD+'T12:00:00'))/(30.4*864e5)):null;
    const status=upc?'🟢 لها أعمال قادمة':months!=null&&months<=18?'🟢 نشطة':last?`⚪ آخر عمل ${last}`:'';
    const st=new Map(); ws.forEach(x=>{ if(x.w.s) st.set(x.w.s,(st.get(x.w.s)||0)+1); }); const studios=[...st].sort((a,b)=>b[1]-a[1]).slice(0,4);
    const co=new Map(); wAll().forEach(g=>{ if(g.who.includes(it)) g.who.forEach(o=>{ if(o!==it) co.set(o,(co.get(o)||0)+1); }); }); const costars=[...co].sort((a,b)=>b[1]-a[1]).slice(0,8);
    const seen=ws.filter(x=>x.w.w).length, rated=ws.filter(x=>x.w.r), avg=rated.length?rated.reduce((a,x)=>a+x.w.r,0)/rated.length:0;
    const span=first?[...Array(last-first+1)].map((_,k)=>first+k):[], mx=Math.max(1,...byY.values());
    return {ys:span,byY,mx,first,last,status,studios,costars,seen,total:ws.length,avg,nowY}; }
  function drawCareer(id){ const it=items.find(x=>x.id===id), host=document.querySelector('#mDetail .dbody'); if(!it||!host) return;
    host.querySelector('.p33car')?.remove(); const c=career(it); if(!c||c.total<2) return;
    const el=document.createElement('div'); el.className='sec p33car';
    const bars=c.ys.length>1?`<div class="p33bars" dir="ltr">${c.ys.map(y=>{ const n=c.byY.get(y)||0; return `<span title="${y}: ${n}"><i style="height:${Math.max(n?8:2,Math.round(n/c.mx*100))}%"></i><em>${String(y).slice(2)}</em></span>`; }).join('')}</div>`:'';
    el.innerHTML=`<h3>مسيرتها<small>${esc([c.first&&c.last?c.first+' – '+(c.last>=c.nowY-1?'الآن':c.last):'',c.status].filter(Boolean).join(' · '))}</small></h3>${bars}
      <div class="p33cs"><div><b>${c.total}</b><span>عمل</span></div><div><b>${c.seen}</b><span>شاهدت</span></div><div><b>${c.total?Math.round(c.seen/c.total*100):0}%</b><span>من أعمالها</span></div>${c.avg?`<div><b>${c.avg.toFixed(1)}★</b><span>متوسط تقييمك</span></div>`:''}</div>
      <div class="p33prog"><i style="width:${c.total?Math.round(c.seen/c.total*100):0}%"></i></div>
      ${c.studios.length?`<p class="src">أكثر الاستوديوهات: ${c.studios.map(([s,n])=>esc(s)+' ('+n+')').join(' · ')}</p>`:''}
      ${c.costars.length?`<p class="src" style="margin:10px 0 6px">شاركتها في مكتبتك:</p><div class="p33ps">${c.costars.map(([o,n])=>`<button type="button" class="p33p" data-pf33d="${esc(o.id)}">${av(o)}<b>${esc(o.name)}</b><small>${n} عمل مشترك</small></button>`).join('')}</div>`:''}`;
    el.addEventListener('click',e=>{ const p=e.target.closest('[data-pf33d]'); if(p) openDetail(p.dataset.pf33d); });
    const ws=host.querySelector('#wsec'); ws?host.insertBefore(el,ws):host.appendChild(el); }

  // ================= 4) اكتمال المكتبة =================
  const CHECKS=[['ph','صورة',i=>!!pic(i)],['bi','تاريخ ميلاد كامل',i=>/^\d{4}-\d{2}-\d{2}$/.test(i.birth||'')],['co','البلد',i=>!!i.country],['id','ربط بمصدر (ThePornDB/StashDB)',i=>!!(i.pdbId||i.stashId)],
    ['ra','تقييم',i=>+i.rating>0],['wk','أعمال',i=>(i.works||[]).length>0],['tg','وسوم',i=>(i.tags||[]).length>0]];
  const scoreOf=i=>{ const miss=CHECKS.filter(c=>!c[2](i)); return {i,miss,pct:Math.round((CHECKS.length-miss.length)/CHECKS.length*100)}; };
  function openHealth(only){ const all=items.map(scoreOf), avg=all.length?Math.round(all.reduce((a,x)=>a+x.pct,0)/all.length):100;
    const by=CHECKS.map(c=>[c,all.filter(x=>x.miss.includes(c)).length]).filter(x=>x[1]);
    let l=all.filter(x=>x.pct<100).sort((a,b)=>a.pct-b.pct||a.i.name.localeCompare(b.i.name)); if(only) l=l.filter(x=>x.miss.some(c=>c[0]===only));
    const html=head('🩺 اكتمال المكتبة',all.length+' ممثلة')+`<div class="p33ring" style="--p:${avg}"><b>${avg}%</b><span>اكتمال البيانات</span></div>`+
      (by.length?`<div class="chips p33y"><button type="button" class="chip ${!only?'on':''}" data-h33="">الكل (${all.filter(x=>x.pct<100).length})</button>${by.map(([c,n])=>`<button type="button" class="chip ${only===c[0]?'on':''}" data-h33="${c[0]}">بلا ${c[1]} (${n})</button>`).join('')}</div>`:'')+
      (l.length?`<div class="p33hl">${l.slice(0,150).map(x=>`<button type="button" class="p33hr" data-pf33="${esc(x.i.id)}">${av(x.i)}<span><b>${esc(x.i.name)}</b><small>ينقصها: ${x.miss.map(c=>c[1]).join('، ')}</small></span><em class="${x.pct<50?'lo':x.pct<80?'mid':'hi'}">${x.pct}%</em></button>`).join('')}</div>`
        :'<p class="src">✨ كل الملفات مكتملة.</p>')+'<p class="src" style="margin-top:12px">اضغط ممثلة لفتح صفحتها وإكمال ما ينقصها (زر التعديل، أو «تحديث من المصادر» للأعمال).</p>';
    return sheet(html,(m,done)=>{ wire0(m,done); m.addEventListener('click',e=>{ const h=e.target.closest('[data-h33]'); if(h){ done(null); setTimeout(()=>openHealth(h.dataset.h33||''),60); } }); }); }

  // ================= 5) مزاج الليلة =================
  const MOOD_KEY='vkte_mood';
  function openMood(){ const prev=(()=>{ try{ return JSON.parse(LS.get(MOOD_KEY,'{}')); }catch{ return {}; } })();
    const pool=wAll().filter(g=>!g.seen&&!g.upc), cnt=a=>{ const m=new Map(); a.forEach(k=>{ if(k) m.set(k,(m.get(k)||0)+1); }); return [...m].sort((x,y)=>y[1]-x[1]); };
    const tags=cnt(pool.flatMap(g=>g.tg||[])).slice(0,14), studios=cnt(pool.map(g=>g.s)).slice(0,10);
    const st={du:prev.du||0,tg:prev.tg||'',s:prev.s||'',fav:!!prev.fav,top:!!prev.top};
    const opt=(k,v,t)=>`<button type="button" class="chip ${String(st[k])===String(v)?'on':''}" data-m33="${k}" data-v="${esc(String(v))}">${t}</button>`;
    const html=head('🌙 مزاج الليلة',pool.length+' عمل لم تشاهده بعد')+
      `<h3 class="p33h">المدة</h3><div class="chips">${opt('du',0,'أي مدة')}${opt('du',20,'≤ 20 د')}${opt('du',40,'≤ 40 د')}${opt('du',60,'≤ ساعة')}</div>`+
      (tags.length?`<h3 class="p33h">الطابع</h3><div class="chips">${opt('tg','','الكل')}${tags.map(([t])=>opt('tg',t,esc(t))).join('')}</div>`:'')+
      (studios.length?`<h3 class="p33h">الاستوديو</h3><div class="chips">${opt('s','','الكل')}${studios.map(([s])=>opt('s',s,esc(s))).join('')}</div>`:'')+
      `<h3 class="p33h">من</h3><div class="chips">${opt('fav',false,'كل الممثلات')}${opt('fav',true,'♥ المفضلات')}${opt('top',true,'★ تقييم 4+')}</div>`+
      `<div id="m33out" class="p33ws"></div><div class="actions"><button class="btn" data-x>إغلاق</button><button class="btn gold" id="m33go">اقترح لي</button></div>`;
    let seed=0;
    const suggest=m=>{ seed++; LS.set(MOOD_KEY,JSON.stringify(st));
      const l=pool.filter(g=>(!st.du||(g.du&&g.du<=st.du))&&(!st.tg||(g.tg||[]).includes(st.tg))&&(!st.s||g.s===st.s)&&(!st.fav||g.who.some(i=>i.fav))&&(!st.top||g.who.some(i=>+i.rating>=4)));
      const rnd=(k=>()=>((k=(k*16807)%2147483647)/2147483647))((Date.now()%1e6)+seed*7919);
      const sc=g=>{ const r=Math.max(...g.who.map(i=>+i.rating||0)); return r*2+(g.who.some(i=>i.fav)?3:0)+(g.q?4:0)+(g.r?0:1)+(g.dt&&g.dt>=String(new Date().getFullYear()-1)?1.5:0)+rnd()*5; };
      const top=l.map(g=>[g,sc(g)]).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
      const why=g=>[g.q?'في قائمة المشاهدة':'',g.who.some(i=>i.fav)?'من مفضلاتك':'',g.who.some(i=>+i.rating>=4.5)?'ممثلة تقيّمها عاليًا':'',g.du?g.du+' دقيقة':'',g.dt&&g.dt>=String(new Date().getFullYear()-1)?'حديث':''].filter(Boolean).slice(0,3).join(' · ');
      m.querySelector('#m33out').innerHTML=top.length?top.map(g=>wLine(g).replace('</small></span>',`</small><em class="p33why">${esc(why(g)||'اختيار من ذوقك')}</em></span>`)).join(''):'<p class="src">لا أعمال تطابق هذه الاختيارات. خفّف الشروط.</p>';
      m.querySelector('#m33go').textContent=top.length?'اقتراح آخر':'اقترح لي'; };
    return sheet(html,(m,done)=>{ wire0(m,done); m.addEventListener('click',e=>{ const c=e.target.closest('[data-m33]'); if(c){ const k=c.dataset.m33, v=c.dataset.v;
        if(k==='du') st.du=+v; else if(k==='tg'||k==='s') st[k]=v; else if(k==='fav') st.fav=v==='true'; else if(k==='top') st.top=!st.top;
        m.querySelectorAll('[data-m33]').forEach(b=>{ const kk=b.dataset.m33; b.classList.toggle('on',kk==='top'?st.top:String(st[kk])===b.dataset.v); }); return; }
      if(e.target.closest('#m33go')) suggest(m); }); }); }

  // ================= الربط =================
  const TILES=[['activity','🔥','نشاطي','خريطة مشاهداتك وسلاسلك'],['onthisday','🕰️','في مثل هذا اليوم','ذكرياتك في هذا التاريخ'],['mood','🌙','مزاج الليلة','اقتراح عمل يناسب مزاجك'],['health','🩺','اكتمال المكتبة','ما ينقص ملفات ممثلاتك']];
  function init(){ const g=document.querySelector('#mMore .mgrid'); if(g&&!g.querySelector('[data-tool="activity"]')) g.insertAdjacentHTML('afterbegin',TILES.map(([k,e,t,s])=>`<button type="button" class="mt p33new" data-tool="${k}"><span>${e}</span><b>${t}</b><small>${s}</small></button>`).join(''));
    if(typeof Home!=='undefined'&&Home.TOOL) Object.assign(Home.TOOL,{activity:()=>openActivity(),onthisday:openOnThisDay,mood:openMood,health:()=>openHealth('')});
    const _od=openDetail; openDetail=function(id){ const r=_od.apply(this,arguments); try{ drawCareer(typeof id==='string'?id:curDetail); }catch(e){ console.warn('career',e); } return r; }; }
  setTimeout(init,0);
  return {openActivity,openOnThisDay,openMood,openHealth,streaks,watchDays,onThisDay,career,scoreOf};
})();

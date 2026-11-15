/* ===== المواجهة (ترتيب Elo) + قائمة المستويات =====
   المواجهة: تظهر ممثلتان وتختار من تفضّل، فيُبنى ترتيب حقيقي لذوقك (نظام Elo) يظهر في لوحة الترتيب والرئيسية.
   المستويات: توزيع الممثلات على S/A/B/C/D يدويًا أو تلقائيًا من التقييم.
   الحقول الجديدة (elo, duels, dw, tier) تُحفظ مع السجل وتدخل النسخ الاحتياطية تلقائيًا. */
const Duel=(()=>{
  const m=$('mDuel'), K=32, eloOf=i=>i.elo||1000;
  let A=null, B=null, pool='all', tab='play', done=0, last=null;
  const members=()=>{ let l=items.filter(i=>pic(i)); if(l.length<2) l=items.slice(); if(pool==='fav') l=l.filter(i=>i.fav); else if(pool!=='all') l=l.filter(i=>(i.lists||[]).includes(pool)); return l; };
  function pair(){ const l=members(); if(l.length<2){ A=B=null; return; }
    // الأولى: الأقل مواجهات من عيّنة عشوائية · الثانية: الأقرب ترتيبًا لها (مواجهات أدقّ)
    const samp=n=>Array.from({length:Math.min(n,l.length)},()=>l[Math.floor(Math.random()*l.length)]);
    A=samp(5).sort((x,y)=>(x.duels||0)-(y.duels||0))[0];
    const c=samp(9).filter(x=>x!==A&&!(last&&last.includes(x)&&last.includes(A))); B=(c.length?c:l.filter(x=>x!==A)).sort((x,y)=>Math.abs(eloOf(x)-eloOf(A))-Math.abs(eloOf(y)-eloOf(A)))[0]; }
  function vote(w){ if(!A||!B) return; const ea=1/(1+Math.pow(10,(eloOf(B)-eloOf(A))/400)), ra=eloOf(A), rb=eloOf(B);
    A.elo=Math.round(ra+K*(w-ea)); B.elo=Math.round(rb+K*((1-w)-(1-ea))); A.duels=(A.duels||0)+1; B.duels=(B.duels||0)+1;
    if(w===1) A.dw=(A.dw||0)+1; else if(w===0) B.dw=(B.dw||0)+1;
    A.updated=B.updated=Date.now(); save([A,B]); done++; last=[A,B]; try{ navigator.vibrate&&navigator.vibrate(8); }catch{} pair(); draw(); }
  const side=(i,k)=>`<button type="button" class="dc" data-v="${k}"><span class="dc-ph">${pic(i)?`<img src="${esc((i.photos&&i.photos[0])||pic(i))}" decoding="async" alt="">`:'♡'}</span><b>${esc(i.name)}</b><small>${i.rating?'★ '+(+i.rating).toFixed(1)+' · ':''}${eloOf(i)} نقطة</small></button>`;
  function draw(){ const l=members();
    const chips=`<div class="v17chips"><span class="chip ${pool==='all'?'on':''}" data-pool="all">الكل</span><span class="chip ${pool==='fav'?'on':''}" data-pool="fav">★ المفضلة</span>${lists.map(L=>`<span class="chip ${pool===L.id?'on':''}" data-pool="${L.id}">${esc(L.name)}</span>`).join('')}</div>`;
    let body;
    if(tab==='board'){ const r=l.filter(i=>i.duels>0).sort((a,b)=>eloOf(b)-eloOf(a));
      body=r.length?`<div class="dboard">${r.slice(0,100).map((i,n)=>`<button type="button" class="v17row" data-od="${esc(i.id)}"><em class="dr ${n<3?'top':''}">${n+1}</em><span class="av">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" alt="">`:'♡'}</span><span class="t"><b>${esc(i.name)}</b><small>${i.duels} مواجهة · فازت ${i.dw||0}</small></span><b class="de">${eloOf(i)}</b></button>`).join('')}</div>`
        :'<div class="empty"><b>لا ترتيب بعد</b>العب بضع مواجهات ليظهر ترتيبك هنا.</div>'; }
    else if(!A||!B||!items.includes(A)||!items.includes(B)){ pair(); body=(A&&B)?null:'<div class="empty"><b>تحتاج ممثلتين على الأقل هنا</b>غيّر المجموعة أو أضف المزيد.</div>'; }
    if(body==null) body=`<p class="src dq">من تفضّل؟ ${done?'· '+done+' مواجهة في هذه الجلسة':''}</p><div class="darena">${side(A,1)}<i class="dvs">VS</i>${side(B,0)}</div>
      <div class="actions" style="justify-content:center"><button type="button" class="btn" data-v="0.5">تعادل</button><button type="button" class="btn" data-skip>تخطّي ↻</button></div>`;
    m.innerHTML=`<div class="fh"><h2>⚔️ المواجهة</h2><button class="ib" data-x aria-label="إغلاق">${icon('x')}</button></div>
      <div class="st-tabs"><button type="button" class="st-tab ${tab==='play'?'on':''}" data-tab="play">مواجهة</button><button type="button" class="st-tab ${tab==='board'?'on':''}" data-tab="board">لوحة الترتيب</button></div>${chips}${body}`;
    m.classList.toggle('blur',document.body.classList.contains('blur')); }
  m.addEventListener('click',e=>{ const t=e.target;
    if(t.closest('[data-x]')){ closeOv('ovDuel'); return; }
    const tb=t.closest('[data-tab]'); if(tb){ tab=tb.dataset.tab; draw(); return; }
    const p=t.closest('[data-pool]'); if(p){ pool=p.dataset.pool; A=B=null; draw(); return; }
    if(t.closest('[data-skip]')){ pair(); draw(); return; }
    const v=t.closest('[data-v]'); if(v){ vote(+v.dataset.v); return; }
    const od=t.closest('[data-od]'); if(od) openDetail(od.dataset.od); });
  function open(t){ if(items.length<2){ toast('أضف ممثلتين على الأقل'); return; } tab=t==='board'?'board':'play'; A=B=null; draw(); $('ovDuel').classList.add('show'); m.scrollTop=0; }
  // ترتيب ممثلة بين كل من لعبن مواجهات (يظهر في ملفها)
  const rankOf=i=>{ if(!(i.duels>0)) return 0; return items.filter(x=>x.duels>0&&eloOf(x)>eloOf(i)).length+1; };
  return {open,rankOf};
})();

const Tier=(()=>{
  const m=$('mTier'), T=[['S','الأسطورية'],['A','ممتازة'],['B','جيدة جدًا'],['C','جيدة'],['D','عادية']];
  const auto=r=>r>=4.5?'S':r>=4?'A':r>=3.5?'B':r>=3?'C':r>0?'D':'';
  function draw(){ const by={}; items.forEach(i=>{ const k=T.some(t=>t[0]===i.tier)?i.tier:''; (by[k]=by[k]||[]).push(i); });
    Object.values(by).forEach(a=>a.sort((x,y)=>(y.rating||0)-(x.rating||0)||(y.elo||0)-(x.elo||0)));
    const chip=i=>`<button type="button" class="tc" data-id="${esc(i.id)}" title="${esc(i.name)}"><span class="av">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" decoding="async" alt="">`:'♡'}</span><small>${esc(i.name.split(' ')[0])}</small></button>`;
    m.innerHTML=`<div class="fh"><h2>🏆 قائمة المستويات</h2><button class="ib" data-x aria-label="إغلاق">${icon('x')}</button></div>
      <p class="src" style="margin-bottom:10px">اضغط أي ممثلة لتغيير مستواها.</p>
      <div class="actions start" style="margin:0 0 12px"><button type="button" class="btn gold" data-auto>توزيع تلقائي من التقييم</button><button type="button" class="btn" data-clear>تصفير</button></div>
      ${T.map(([k,n])=>`<div class="trow t${k}"><div class="tk"><b>${k}</b><small>${n}</small><em>${(by[k]||[]).length}</em></div><div class="tl">${(by[k]||[]).map(chip).join('')||'<span class="src">—</span>'}</div></div>`).join('')}
      <div class="trow t0"><div class="tk"><b>؟</b><small>بلا مستوى</small><em>${(by['']||[]).length}</em></div><div class="tl">${(by['']||[]).map(chip).join('')||'<span class="src">—</span>'}</div></div>`;
    m.classList.toggle('blur',document.body.classList.contains('blur')); }
  m.addEventListener('click',async e=>{ const t=e.target;
    if(t.closest('[data-x]')){ closeOv('ovTier'); return; }
    if(t.closest('[data-auto]')){ if(!(await askConfirm('توزيع كل الممثلات المقيَّمات على المستويات حسب تقييمك؟ (يستبدل المستويات الحالية للمقيَّمات)','توزيع'))) return; const ch=items.filter(i=>i.rating>0&&i.tier!==auto(i.rating)); ch.forEach(i=>{ i.tier=auto(i.rating); }); await save(ch); draw(); toast('وُزّعت '+ch.length+' ممثلة'); return; }
    if(t.closest('[data-clear]')){ if(!(await askConfirm('إزالة كل المستويات؟','تصفير',true))) return; const ch=items.filter(i=>i.tier); ch.forEach(i=>{ delete i.tier; }); await save(ch); draw(); return; }
    const c=t.closest('[data-id]'); if(!c) return; const it=items.find(i=>i.id===c.dataset.id); if(!it) return; const top=m.scrollTop;
    const v=await askShow(`<h2>${esc(it.name)}</h2><p class="src" style="margin-bottom:10px">اختر المستوى</p><div class="tpick">${T.map(([k,n])=>`<button type="button" class="tp t${k} ${it.tier===k?'on':''}" data-t="${k}"><b>${k}</b><small>${n}</small></button>`).join('')}</div>
      <div class="actions"><button class="btn" data-t="open">فتح الملف</button><button class="btn" data-t="">بلا مستوى</button><button class="btn" id="aNo">إلغاء</button></div>`,(mm,done)=>{ $('aNo').onclick=()=>done(null); mm.onclick=ev=>{ const b=ev.target.closest('[data-t]'); if(b) done({t:b.dataset.t}); }; });
    if(!v) return; if(v.t==='open'){ openDetail(it.id); return; }
    if(v.t) it.tier=v.t; else delete it.tier; it.updated=Date.now(); await save(it); draw(); m.scrollTop=top; });
  const open=()=>{ if(!items.length){ toast('أضف ممثلات أولًا'); return; } draw(); $('ovTier').classList.add('show'); m.scrollTop=0; };
  return {open};
})();

// شارات في ملف الممثلة: المستوى، ترتيب المواجهات، عدد الزيارات، عيد الميلاد القادم
(function(){ const _od=openDetail;
  openDetail=function(id){ const r=_od.apply(this,arguments);
    try{ const it=items.find(x=>x.id===id), hid=document.querySelector('#mDetail .hid'); if(it&&hid&&!hid.querySelector('.dchips')){ const rk=Duel.rankOf(it), nb=Home.nextBday(it), c=[];
        if(it.tier) c.push(`<span class="dch t${esc(it.tier)}">المستوى ${esc(it.tier)}</span>`);
        if(rk) c.push(`<span class="dch">⚔️ #${rk} · ${it.elo||1000}</span>`);
        if(nb&&nb.days<=30) c.push(`<span class="dch">🎂 ${nb.days===0?'اليوم':nb.days===1?'غدًا':'بعد '+nb.days+' يوم'}</span>`);
        if(it.views>1) c.push(`<span class="dch">👁 ${it.views}</span>`);
        if(c.length) hid.insertAdjacentHTML('beforeend',`<div class="dchips">${c.join('')}</div>`); } }catch{}
    return r; }; })();

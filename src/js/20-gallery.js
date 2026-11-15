/* ===== عارض الصور وعرض الشرائح بملء الشاشة =====
   - النقر على صورة في الملف يفتحها بملء الشاشة (سحب للتنقل، نقرتان أو إصبعان للتكبير، سحب للأسفل للإغلاق).
   - وضع عرض شرائح تلقائي: لصور ممثلة واحدة، أو معرض لكل الممثلات الظاهرات في الرئيسية.
   - بالريموت/الكيبورد: يمين/يسار للتنقل، OK للتشغيل/الإيقاف، رجوع للإغلاق. */
const Gallery=(()=>{
  const lb=$('lbx'), A=lb.querySelector('.la'), B=lb.querySelector('.lb'), cnt=lb.querySelector('.lc'), cap=lb.querySelector('.lcap'), stage=lb.querySelector('.lstage'), bar=lb.querySelector('.lbar i'), playB=lb.querySelector('[data-lb="play"]');
  const DELAY=4500;
  let list=[], idx=0, cur=A, z=1, tx=0, ty=0, playing=false, timer=0, hideT=0, opt0={};
  // شريط إجراءات اختياري (يستخدمه الاستديو): opt.bar(item,i) يرجع HTML، opt.onAction(k,item,i)، opt.onLoad(item,img)
  const act=lb.querySelector('.lact');
  const apply=()=>{ cur.style.transform='translate('+tx+'px,'+ty+'px) scale('+z+')'; };
  const srcOf=x=>typeof x==='string'?x:x.src, capOf=x=>typeof x==='string'?'':(x.cap||'');
  function show(n,instant){ if(!list.length) return; idx=(n+list.length)%list.length; const nx=cur===A?B:A, src=srcOf(list[idx]);
    const it0=list[idx];
    const done=()=>{ nx.classList.add('on'); cur.classList.remove('on'); cur.style.transform=''; cur=nx; z=1; tx=ty=0; apply(); if(opt0.onLoad&&nx.naturalWidth) try{ opt0.onLoad(it0,nx); }catch{} };
    nx.onload=done; nx.onerror=done; if(nx.getAttribute('src')===src) done(); else nx.src=src;
    cnt.textContent=list.length>1?(idx+1)+' / '+list.length:''; cap.textContent=capOf(list[idx]); cap.hidden=!capOf(list[idx]);
    if(act){ act.hidden=!opt0.bar; act.innerHTML=opt0.bar?opt0.bar(list[idx],idx):''; }
    if(opt0.onShow) try{ opt0.onShow(list[idx],idx); }catch{}
    const nxt=list[(idx+1)%list.length]; if(nxt&&list.length>1){ const p=new Image(); p.src=srcOf(nxt); }
    schedule(); }
  function schedule(){ clearTimeout(timer); bar.style.transition='none'; bar.style.width='0';
    if(!playing||list.length<2) return; requestAnimationFrame(()=>requestAnimationFrame(()=>{ bar.style.transition='width '+DELAY+'ms linear'; bar.style.width='100%'; }));
    timer=setTimeout(()=>{ if(document.hidden||z>1){ schedule(); return; } show(idx+1); },DELAY); }
  function setPlay(on){ playing=on&&list.length>1; lb.classList.toggle('playing',playing); playB.innerHTML=icon(playing?'pause':'play'); playB.hidden=list.length<2; schedule(); wake(); }
  function wake(){ lb.classList.remove('idle'); clearTimeout(hideT); if(playing) hideT=setTimeout(()=>lb.classList.add('idle'),3000); }
  function open(l,n,opt){ list=(l||[]).filter(x=>x&&srcOf(x)); if(!list.length) return; opt=opt||{}; opt0=opt; lb.classList.toggle('acts',!!opt.bar);
    lb.classList.toggle('blur',document.body.classList.contains('blur')); A.classList.remove('on'); B.classList.remove('on'); A.removeAttribute('src'); B.removeAttribute('src'); cur=A;
    lb.classList.add('show'); lb.setAttribute('aria-hidden','false'); lb.querySelectorAll('.lnav').forEach(b=>b.hidden=list.length<2); show(n||0); setPlay(!!opt.auto);
    if(document.documentElement.classList.contains('tv')) setTimeout(()=>{ try{ playB.hidden?lb.querySelector('[data-lb="close"]').focus():playB.focus(); }catch{} },60); }
  function close(){ if(!lb.classList.contains('show')) return; clearTimeout(timer); clearTimeout(hideT); playing=false; const oc=opt0.onClose; opt0={}; if(act){ act.innerHTML=''; act.hidden=true; } lb.classList.remove('acts'); if(oc) try{ oc(); }catch{} lb.classList.remove('show','playing','idle'); lb.setAttribute('aria-hidden','true'); A.removeAttribute('src'); B.removeAttribute('src'); }
  const isOpen=()=>lb.classList.contains('show');
  lb.addEventListener('click',e=>{ wake(); const la=e.target.closest('[data-la]'); if(la&&opt0.onAction){ opt0.onAction(la.dataset.la,list[idx],idx); return; } const b=e.target.closest('[data-lb]'); if(!b) return; const k=b.dataset.lb;
    if(k==='close') close(); else if(k==='play') setPlay(!playing); else if(k==='next') show(idx+1); else if(k==='prev') show(idx-1); });
  // التقاط على window كي يسبق تنقل التلفاز: الأسهم تقلّب الصور
  window.addEventListener('keydown',e=>{ if(!isOpen()) return; wake(); const k=e.key;
    if(k==='ArrowLeft'){ e.preventDefault(); e.stopImmediatePropagation(); show(idx+1); }
    else if(k==='ArrowRight'){ e.preventDefault(); e.stopImmediatePropagation(); show(idx-1); }
    else if(k===' '||k==='MediaPlayPause'||((k==='Enter'||k==='NumpadEnter')&&(!document.activeElement||!lb.contains(document.activeElement)||document.activeElement===playB))){ e.preventDefault(); e.stopImmediatePropagation(); setPlay(!playing); }
    else if(k==='ArrowUp'||k==='ArrowDown'){ e.preventDefault(); e.stopImmediatePropagation(); const bs=[...lb.querySelectorAll('.ltop button:not([hidden])')]; const i=bs.indexOf(document.activeElement); (bs[(i+1)%bs.length]||bs[0]).focus(); }
  },true);
  // لمس: سحب أفقي للتنقل، سحب للأسفل للإغلاق، نقرتان للتكبير، تكبير بإصبعين
  let sx=0,sy=0,t0=0,pd=0,pz=1,lastTap=0,mode='';
  const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  stage.addEventListener('touchstart',e=>{ wake(); const t=e.touches; if(t.length===2){ pd=dist(t); pz=z; mode='pinch'; return; } sx=t[0].clientX; sy=t[0].clientY; t0=Date.now(); mode=z>1?'pan':'swipe'; cur.style.transition='none'; },{passive:true});
  stage.addEventListener('touchmove',e=>{ const t=e.touches;
    if(mode==='pinch'&&t.length===2){ z=Math.max(1,Math.min(5,pz*dist(t)/pd)); if(z===1){ tx=ty=0; } apply(); return; }
    const dx=t[0].clientX-sx, dy=t[0].clientY-sy;
    if(mode==='pan'){ tx+=dx; ty+=dy; sx=t[0].clientX; sy=t[0].clientY; apply(); }
    else if(mode==='swipe'){ if(Math.abs(dy)>Math.abs(dx)){ ty=Math.max(0,dy); tx=0; } else { tx=dx; ty=0; } apply(); } },{passive:true});
  stage.addEventListener('touchend',e=>{ cur.style.transition='';
    if(mode==='swipe'){ const dx=tx, dy=ty; if(Math.abs(dx)<8&&Math.abs(dy)<8&&Date.now()-t0<250){ const n=Date.now(); if(n-lastTap<320){ z=2.5; apply(); mode=''; lastTap=0; return; } lastTap=n; }
      if(dy>110){ close(); } else if(Math.abs(dx)>60&&list.length>1){ tx=ty=0; show(idx+(dx>0?1:-1)); } else { tx=ty=0; apply(); } }
    else if(mode==='pan'||mode==='pinch'){ if(e.touches.length===0&&z<=1.02){ z=1; tx=ty=0; apply(); } const n=Date.now(); if(mode==='pan'&&n-lastTap<320){ z=1; tx=ty=0; apply(); lastTap=0; } else lastTap=n; }
    mode=''; });
  stage.addEventListener('dblclick',()=>{ z=z>1?1:2.5; tx=ty=0; apply(); });
  stage.addEventListener('mousemove',wake);

  // ---- نقاط الدخول ----
  const photosOf=it=>(it.photos||[]).length?it.photos:(pic(it)?[pic(it)]:[]);
  document.addEventListener('click',e=>{ const m=e.target.closest&&e.target.closest('#car img'); if(!m||isOpen()) return; const it=items.find(x=>x.id===curDetail); const imgs=[...document.querySelectorAll('#car img')];
    open(it&&it.photos&&it.photos.length?it.photos:imgs.map(x=>x.dataset.src||x.getAttribute('src')),imgs.indexOf(m)); });
  function playItem(id){ const it=items.find(x=>x.id===id); if(!it) return; const p=photosOf(it); if(!p.length){ toast('لا صور لعرضها'); return; } open(p.map(s=>({src:s,cap:it.name})),0,{auto:true}); }
  function playLibrary(){ const l=(render.list||items).filter(i=>pic(i)); if(!l.length){ toast('لا صور لعرضها'); return; }
    open(l.map(i=>({src:(i.photos&&i.photos[0])||pic(i),cap:i.name+(i.rating?'  ★ '+(+i.rating).toFixed(1):'')})),0,{auto:true}); }
  $('bShow').onclick=playLibrary;
  // زر «عرض شرائح» داخل ملف الممثلة
  const _od=openDetail;
  openDetail=function(id){ const r=_od.apply(this,arguments);
    try{ const it=items.find(x=>x.id===id), top=document.querySelector('#mDetail .htop > div'); if(it&&top&&photosOf(it).length&&!top.querySelector('#dShow')){ const b=document.createElement('button'); b.className='ib glass'; b.id='dShow'; b.type='button'; b.title='عرض شرائح'; b.setAttribute('aria-label','عرض شرائح بملء الشاشة'); b.innerHTML=icon('slides'); b.onclick=()=>playItem(it.id); top.prepend(b); } }catch{}
    return r; };
  // إعادة رسم شريط الإجراءات (بعد إعجاب مثلًا) والانتقال لصورة
  const refreshBar=()=>{ if(act&&opt0.bar&&list[idx]) act.innerHTML=opt0.bar(list[idx],idx); };
  const current=()=>({item:list[idx],idx,list});
  return {open,close,isOpen,playItem,playLibrary,refreshBar,current,show:n=>show(n)};
})();

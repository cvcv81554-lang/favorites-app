/* ===== القفل برمز PIN =====
   الرمز يُخزَّن مجزّأً: SHA-256(salt + رمز) مع salt عشوائي لكل تعيين، ولا يُحفظ نصًّا أبدًا.
   قفل تلقائي عند مغادرة التطبيق، تغطية للشاشة عند الذهاب للخلفية، وزر قفل سريع. */
const Lock=(()=>{
  const KEY='vkte_pin2';
  const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
  async function hashPin(pin,salt){ return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+'|'+pin))); }
  const cfg=()=>{ try{ const o=JSON.parse(LS.get(KEY,'null')); return o&&o.s&&o.h?o:null; }catch{ return null; } };
  const has=()=>!!cfg();
  // عدد المحاولات ووقت الانتظار محفوظان: إغلاق التطبيق وفتحه لا يصفّرهما
  const FK='vkte_lockf'; let buf='', fails=0, until=0, tick=0;
  try{ const o=JSON.parse(LS.get(FK,'{}')); fails=+o.f||0; until=+o.u||0; if(Date.now()-Math.max(until,+o.t||0)>36e5){ fails=0; until=0; } }catch{}
  const keepF=()=>{ try{ if(fails||until) LS.set(FK,JSON.stringify({f:fails,u:until,t:Date.now()})); else LS.del(FK); }catch{} };
  const el=$('lock'), dots=$('lockDots'), msg=$('lockMsg');
  const draw=()=>{ const n=(cfg()||{}).n||4; dots.innerHTML=Array.from({length:Math.max(n,buf.length)},(_,k)=>`<i class="${k<buf.length?'on':''}"></i>`).join(''); };
  function wait(){ clearInterval(tick); const f=()=>{ const s=Math.ceil((until-Date.now())/1000); if(s<=0){ clearInterval(tick); msg.textContent=''; return; } msg.textContent='محاولات كثيرة. انتظر '+s+' ثانية'; }; f(); tick=setInterval(f,500); }
  async function submit(){ const c=cfg(); if(!c||!buf) return; if(Date.now()<until) return;
    if(await hashPin(buf,c.s)===c.h){ fails=0; until=0; keepF(); buf=''; el.classList.remove('show'); msg.textContent=''; document.body.classList.remove('locked'); return; }
    fails++; buf=''; draw(); el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'),420); try{ navigator.vibrate&&navigator.vibrate(60); }catch{}
    if(fails>=5){ until=Date.now()+Math.min(300,30*(fails-4))*1000; wait(); } else msg.textContent='الرمز غير صحيح'; keepF(); }
  function press(k){ if(Date.now()<until) return; if(k==='del'){ buf=buf.slice(0,-1); } else if(k==='ok'){ submit(); return; } else if(buf.length<12){ buf+=k; if(fails<5) msg.textContent=''; }
    draw(); const c=cfg(); if(c&&c.n&&buf.length===c.n) submit(); }
  function lockNow(){ if(!has()) return false; if(ask.cancel) ask.cancel(); if(typeof Gallery!=='undefined') Gallery.close();
    document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); buf=''; draw(); if(Date.now()>=until) msg.textContent=''; else wait();
    el.classList.add('show'); document.body.classList.add('locked'); setTimeout(()=>{ const b=el.querySelector('[data-k="5"]'); if(b&&document.documentElement.classList.contains('tv')) b.focus(); },80); return true; }
  $('lockPad').onclick=e=>{ const b=e.target.closest('[data-k]'); if(b) press(b.dataset.k); };
  document.addEventListener('keydown',e=>{ if(!el.classList.contains('show')) return;
    if(/^\d$/.test(e.key)){ e.preventDefault(); e.stopPropagation(); press(e.key); } else if(e.key==='Backspace'){ e.preventDefault(); e.stopPropagation(); press('del'); }
    else if(e.key==='Enter'&&!(e.target.closest&&e.target.closest('#lockPad'))){ e.preventDefault(); press('ok'); } },true);

  // ---- الإعدادات ----
  $('bLock').onclick=()=>{ if(!lockNow()) toast('عيّن رمزًا أولًا من الإعدادات ← القفل والخصوصية'); };
  $('pinSave').onclick=async()=>{ const v=$('pinIn').value.trim(); if(!/^\d{4,12}$/.test(v)){ toast('الرمز من 4 إلى 12 رقمًا'); return; }
    const s=hex(crypto.getRandomValues(new Uint8Array(16))); LS.set(KEY,JSON.stringify({s,h:await hashPin(v,s),n:v.length})); LS.del('vkte_pin'); $('pinIn').value=''; toast('تم تعيين الرمز'); };
  $('pinOff').onclick=async()=>{ if(!has()){ toast('لا يوجد رمز'); return; } if(await askConfirm('إزالة القفل؟','إزالة',true)){ LS.del(KEY); toast('أُزيل القفل'); } };
  $('autoLock').checked=LS.get('vkte_auto')==='1';
  $('autoLock').onchange=e=>LS.set('vkte_auto',e.target.checked?'1':'0');
  const coverOn=()=>LS.get('vkte_cover','1')==='1';
  $('coverOn').checked=coverOn();
  const applySecure=()=>{ if(IS_NATIVE&&PLATFORM==='android'){ try{ NATIVE.Shell.secure({on:coverOn()}).catch(()=>{}); }catch{} } };
  $('coverOn').onchange=e=>{ LS.set('vkte_cover',e.target.checked?'1':'0'); applySecure(); };
  applySecure();

  // ---- مغادرة التطبيق: غطِّ الشاشة فورًا، واقفل إن كان القفل التلقائي مفعّلًا ----
  const cover=$('cover');
  const away=()=>{ if(coverOn()) cover.classList.add('show'); if(LS.get('vkte_auto')==='1') lockNow(); };
  const back=()=>cover.classList.remove('show');
  document.addEventListener('visibilitychange',()=>{ document.hidden?away():back(); });
  if(IS_NATIVE){ try{ NATIVE.App.addListener('pause',away); NATIVE.App.addListener('resume',back);
      NATIVE.App.addListener('appStateChange',s=>{ s&&s.isActive?back():away(); }); }catch{} }
  return {lockNow,has};
})();

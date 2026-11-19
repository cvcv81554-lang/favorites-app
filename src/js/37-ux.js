// ===== v36: ترويسة المكتبة على الجوال — «عرض الشرائح» و«التمويه» داخل قائمة «⋯» =====
// الأزرار الأصلية تبقى في الصفحة (الاختصارات والتلفاز القديم يعتمدان عليها)، والقائمة تضغطها نفسها فلا يتغير أي سلوك.
(()=>{
  const box=document.querySelector('.ibtns'), bSet=$('bSet'); if(!box||!bSet||$('bMoreH')) return;
  const b=document.createElement('button'); b.className='ib'; b.id='bMoreH'; b.type='button'; b.title='المزيد'; b.setAttribute('aria-label','المزيد من الأدوات'); b.setAttribute('aria-haspopup','dialog');
  b.innerHTML='<svg class="ic"><use href="#i-more"/></svg>'; box.insertBefore(b,bSet);
  const sync=()=>b.classList.toggle('dot',document.body.classList.contains('blur'));   // نقطة تذكّر أن التمويه مفعّل
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']}); sync();
  b.onclick=()=>{ const blur=document.body.classList.contains('blur');
    askShow(`<div class="fh"><h2>أدوات المكتبة</h2><button class="ib" data-x aria-label="إغلاق">${icon('x')}</button></div>
      <div class="hmenu"><button type="button" class="btn" data-h="bShow">${icon('slides')} عرض شرائح بملء الشاشة</button>
      <button type="button" class="btn ${blur?'on':''}" data-h="bBlur" aria-pressed="${blur}">${icon('eyeoff')} ${blur?'إلغاء تمويه الصور':'تمويه الصور'}</button></div>`,
      (m,done)=>{ m.querySelector('[data-x]').onclick=()=>done(null); m.querySelectorAll('[data-h]').forEach(x=>x.onclick=()=>{ done(null); const t=$(x.dataset.h); if(t) setTimeout(()=>t.click(),60); }); }); };
})();
// (v36) تجهيز نص البحث مسبقًا في وقت الخمول بعد التشغيل، فيكون أول حرف بحث سريعًا
setTimeout(()=>{ const go=()=>{ try{ let i=0; const step=dl=>{ while(i<items.length&&(!dl||dl.timeRemaining()>2)){ searchText(items[i++]); } if(i<items.length) (window.requestIdleCallback||(f=>setTimeout(f,30)))(step); }; (window.requestIdleCallback||(f=>setTimeout(f,30)))(step); }catch{} }; go(); },3000);

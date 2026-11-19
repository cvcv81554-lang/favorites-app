// ===== v35: الحركة والانتقالات وحالات الاتصال =====
// - عارض الصور يتكبّر من الصورة المضغوطة نفسها (Web Animations API، بلا مكتبات).
// - «بلا حركة» في إعدادات التلفاز تُطبَّق على الواجهة كلها (html.nomotion).
// - html.offline: تنبيه «بدون اتصال» داخل الاستديو و«اكتشف» (يُعرض المحفوظ).
const Motion=(()=>{
  const reduce=()=>document.documentElement.classList.contains('nomotion')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  let tap=null;
  document.addEventListener('pointerdown',e=>{ const t=e.target; const img=t&&t.closest&&t.closest('img,.sj,.sst,.ph,.dx-ph'); tap=img?{el:img,t:Date.now()}:null; },{capture:true,passive:true});
  // تكبير من المصدر: يبدأ من مستطيل الصورة المضغوطة ثم يمتد للشاشة
  function zoomFrom(el){
    try{
      if(!el||reduce()||document.documentElement.classList.contains('tvapp')) return false;
      const st=document.querySelector('#lbx .lstage'); if(!st||!st.animate) return false;
      const r=el.getBoundingClientRect(); if(!r.width||!r.height||r.bottom<0||r.top>innerHeight) return false;
      const s=Math.max(.08,Math.min(1,Math.max(r.width/innerWidth,r.height/innerHeight)));
      const dx=r.left+r.width/2-innerWidth/2, dy=r.top+r.height/2-innerHeight/2;
      st.animate([{transform:`translate(${dx}px,${dy}px) scale(${s})`,opacity:.6,borderRadius:'16px'},{transform:'none',opacity:1,borderRadius:'0'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});
      return true;
    }catch{ return false; }
  }
  if(typeof Gallery!=='undefined'&&Gallery.open){
    const _open=Gallery.open;
    Gallery.open=function(l,n,opt){ const from=(opt&&opt.from)||(tap&&Date.now()-tap.t<900?tap.el:null); tap=null; const r=_open.apply(this,arguments); if(Gallery.isOpen&&Gallery.isOpen()) zoomFrom(from); return r; };
  }
  // «بلا حركة» من إعداد التلفاز → الواجهة كلها
  const syncNoMotion=()=>{ try{ document.documentElement.classList.toggle('nomotion',LS.get('vkte_tv_anim','1')==='0'); }catch{} };
  syncNoMotion(); window.addEventListener('storage',syncNoMotion);
  if(typeof HOOKS!=='undefined'&&HOOKS.prefs) HOOKS.prefs.push(syncNoMotion);
  // حالة الاتصال
  const net=()=>document.documentElement.classList.toggle('offline',navigator.onLine===false);
  net(); window.addEventListener('online',net); window.addEventListener('offline',net);
  return {zoomFrom,reduce,syncNoMotion};
})();

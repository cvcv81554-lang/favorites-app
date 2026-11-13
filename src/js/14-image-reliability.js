/* ---- 14-image-reliability.js ---- */
/* ===== v28 — موثوقية الصور + ثبات التشغيل =====
   - الصورة البعيدة التي تفشل تُعاد محاولتها تلقائيًا (مرتين بتأخير متزايد) قبل الانتقال لصورة بديلة، ثم تظهر بطاقة بديلة أنيقة بدل مربع فارغ.
   - عند عودة الاتصال تُعاد محاولة كل الصور الفاشلة تلقائيًا.
   - الصور الظاهرة فقط تُحمَّل في المتصفحات التي لا تدعم loading=lazy.
   لا يغيّر أي بيانات أو وظائف سابقة. */
(function(){
'use strict';
const lerr=(k,e)=>{ try{ const a=JSON.parse(LS.get('vkte_errlog','[]'))||[]; a.push({t:Date.now(),k:'v28:'+k,m:String(e&&e.message||e).slice(0,300),s:''}); LS.set('vkte_errlog',JSON.stringify(a.slice(-40))); }catch{} };
const REMOTE=/^https?:/i, MAXTRY=2;
const hostOf=el=>(el.closest('#car,.car')?el:(el.closest('.ph,.wkp,.wrow-th,.wk-hero-p,.rc-ph,.av,.pv-ph,.dk-ph,.wsh-p,.lcv')||el)); /* v29: لا نُلبس الأب حالة الفشل أبدًا (كان يخفي كل صور الشريط) */
function failed(el){ if(el.closest('.wcv')){ el.dataset.failed='1'; return; } const h=hostOf(el); if(h&&!h.classList.contains('av')) h.classList.add('imgfail'); el.dataset.failed='1'; }
function retry(el){ const n=+el.dataset.try||0; const src=el.dataset.orig||el.getAttribute('src')||''; if(!REMOTE.test(src)||n>=MAXTRY) return false;
  el.dataset.orig=src; el.dataset.try=String(n+1); el.classList.add('rt');
  setTimeout(()=>{ if(!el.isConnected) return; if(navigator.onLine===false){ el.dataset.try=String(n); el.dataset.wait='1'; return; } el.removeAttribute('src'); el.src=src; },900*(n+1)+Math.random()*400);
  return true; }
/* الالتقاط في طور capture يسبق onerror المضمّن في الوسم (wImgErr)، فنوقفه حتى تنتهي المحاولات */
window.addEventListener('error',e=>{ const el=e.target; if(!el||el.tagName!=='IMG') return;
  try{ if(retry(el)){ e.stopImmediatePropagation(); return; }
    if(el.dataset.fb&&el.getAttribute('src')!==el.dataset.fb) return; /* wImgErr ينتقل للبديل المحدد */
    el.classList.remove('rt'); failed(el); }catch(x){ lerr('err',x); } },true);
window.addEventListener('load',e=>{ const el=e.target; if(el&&el.tagName==='IMG'&&el.dataset.failed){ const h=hostOf(el); if(h) h.classList.remove('imgfail'); delete el.dataset.failed; el.dataset.try='0'; } if(el&&el.tagName==='IMG') el.classList.remove('rt'); },true);
function reviveAll(){ try{ document.querySelectorAll('img[data-failed],img[data-wait]').forEach(el=>{ const src=el.dataset.orig; if(!src) return; el.dataset.try='0'; delete el.dataset.wait; el.removeAttribute('src'); el.src=src; }); document.querySelectorAll('.imgfail').forEach(h=>{ const im=h.querySelector('img[data-orig]'); if(im&&!im.dataset.failed) h.classList.remove('imgfail'); }); }catch(e){ lerr('revive',e); } }
addEventListener('online',()=>setTimeout(reviveAll,600));
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) setTimeout(reviveAll,1500); });
/* ثبات: سجّل أي صورة محلية (blob:) انكسرت لأن الرابط أُبطل، وأعد توليدها من بيانات الممثلة */
window.addEventListener('error',e=>{ const el=e.target; if(!el||el.tagName!=='IMG') return; const s=el.getAttribute('src')||''; if(!s.startsWith('blob:')||el.dataset.healed) return; el.dataset.healed='1';
  try{ const card=el.closest('[data-id],[data-od]'); const id=card&&(card.dataset.id||card.dataset.od); const it=id&&items.find(x=>x.id===id); if(it&&it.thumb){ el.src=it.thumb; } }catch(x){ lerr('heal',x); } },true);
})();

;

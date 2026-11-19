/* ---- 15-gallery.js ---- */
/* ===== v29 — إصلاح جذري للصور + تنقل التلفاز =====
   - شريط صور التفاصيل: تحميل تسلسلي (الحالية أولًا ثم الباقي) بدل فك ترميز كل الصور الكبيرة معًا، مع إعادة محاولة بروابط blob جديدة ثم بديل، وبلا أي طبقة تحجب الصور.
   - فشل صورة واحدة لا يؤثر على غيرها.
   لا يغيّر بيانات ولا ميزات سابقة. */
(function(){'use strict';
const lerr=(k,e)=>{ try{ const a=JSON.parse(LS.get('vkte_errlog','[]'))||[]; a.push({t:Date.now(),k:'v29:'+k,m:String(e&&e.message||e).slice(0,300),s:''}); LS.set('vkte_errlog',JSON.stringify(a.slice(-40))); }catch{} };
const fresh=(src)=>{ try{ const b=PB.map.get(src); return b?PB.url(b):src; }catch{ return src; } };
function loadOne(im,src,fallback){ return new Promise(res=>{ let tries=0;
  const go=()=>{ if(!im.isConnected) return res(false);
    const s=tries===0?src:(tries===1?fresh(src):(fallback||src)); const t=new Image(); t.decoding='async';
    t.onload=()=>{ im.src=t.src; im.classList.remove('bad'); res(true); };
    t.onerror=()=>{ if(++tries<3) setTimeout(go,350*tries); else { im.classList.add('bad'); res(false); } };
    t.src=s; };
  go(); }); }
function fixCar(){ const car=document.getElementById('car'); if(!car||car.dataset.v29) return; car.dataset.v29='1';
  try{ const it=items.find(x=>x.id===curDetail), list=(it&&it.photos)||[]; const imgs=[...car.querySelectorAll('img')];
    imgs.forEach((im,n)=>{ im.loading='eager'; im.dataset.src=list[n]||im.getAttribute('src')||''; if(n>0) im.removeAttribute('src'); });
    // v35: الحالية + التاليتان فقط، والباقي عند الاقتراب منها بالتمرير (كان يفك ترميز حتى 30 صورة كاملة عند كل فتح)
    const done=new Set(); let q=Promise.resolve();
    const want=n=>{ if(n<0||n>=imgs.length||done.has(n)) return; done.add(n); q=q.then(async()=>{ if(!imgs[n].isConnected) return; await loadOne(imgs[n],imgs[n].dataset.src,n===0&&it?thumbSrc(it.thumb):''); await new Promise(r=>setTimeout(r,60)); }); };
    [0,1,2].forEach(want);
    const near=()=>{ const cr=car.getBoundingClientRect(), cx=cr.left+cr.width/2; let best=0,bd=1e9; imgs.forEach((im,n)=>{ const r=im.getBoundingClientRect(), d=Math.abs(r.left+r.width/2-cx); if(d<bd){ bd=d; best=n; } }); for(let k=best-1;k<=best+2;k++) want(k); };
    let st=0; car.addEventListener('scroll',()=>{ clearTimeout(st); st=setTimeout(near,90); },{passive:true});
  }catch(e){ lerr('car',e); } }
const md=document.getElementById('mDetail'); if(md) new MutationObserver(()=>fixCar()).observe(md,{childList:true});
})();

;

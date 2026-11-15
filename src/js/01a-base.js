/* ---- 01-core.js ---- */
// ===== أدوات عامة =====
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());
const LS={ get(k,d=''){ try{ const v=localStorage.getItem(k); return v===null?d:v; }catch{ return d; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch{} }, del(k){ try{ localStorage.removeItem(k); }catch{} } };
const icon=n=>`<svg class="ic"><use href="#i-${n}"/></svg>`;
const vxAny=()=>typeof VX!=='undefined'&&VX.any();
// وضع التلفاز: مفتاح يدوي (1/0) أو كشف تلقائي محفوظ من آخر تشغيل، أو ?tv=1 للتجربة في المتصفح
const TVLITE=/[?&]tv=1/.test(location.search)||(()=>{ try{ const m=localStorage.getItem('vkte_tv'); return m==='1'||(m!=='0'&&localStorage.getItem('vkte_tv_auto')==='1'); }catch{ return false; } })();
const REDUCED=TVLITE||matchMedia('(prefers-reduced-motion:reduce)').matches;
const toast=m=>{const t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',2400)};
const closeOv=id=>$(id).classList.remove('show');
// معرّفات وصور البيانات الواردة من ملف أو جهاز آخر: لا علامات اقتباس ولا وسوم (منع حقن HTML)
const SAFE_ID=/^[\w.:-]{1,128}$/;
const safeId=v=>typeof v==='string'&&SAFE_ID.test(v);
const safeImg=v=>typeof v==='string'&&!/["<>`\\]/.test(v.slice(0,4096))&&(/^https?:\/\//i.test(v)||/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i.test(v));
// الأعمال الواردة تبقى كما هي؛ فقط روابط الصورة (p) والصفحة (u) غير الآمنة تُحذف
const safeWorks=w=>{ if(!Array.isArray(w)) return w; w.forEach(x=>{ if(!x||typeof x!=='object') return; if(x.p!=null&&!safeImg(x.p)) delete x.p; if(x.u!=null&&!(typeof x.u==='string'&&/^https?:\/\/[^"<>`\\]+$/i.test(x.u))) delete x.u; }); return w; };
const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
const wkey=t=>String(t||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');


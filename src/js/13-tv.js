/* ---- 13-tv.js ---- */
/* ===== وضع التلفاز (Android TV / Google TV) =====
   تنقل مكاني كامل بأسهم الريموت + OK + رجوع، حلقة تركيز واضحة، وعناصر أكبر.
   كشف تلقائي عبر الإضافة المحلية Shell (ميزة leanback في النظام)، مع مفتاح يدوي في الإعدادات، و ?tv=1 للتجربة في المتصفح. */
(function(){
'use strict';
const $$=id=>document.getElementById(id);
const lerr=(k,e)=>{ try{ const a=JSON.parse(LS.get('vkte_errlog','[]'))||[]; a.push({t:Date.now(),k:'tv:'+k,m:String(e&&e.message||e).slice(0,300),s:''}); LS.set('vkte_errlog',JSON.stringify(a.slice(-40))); }catch{} };
const forced=/[?&]tv=1/.test(location.search);
const manual=()=>LS.get('vkte_tv','');
let on=forced||manual()==='1'||(manual()!=='0'&&LS.get('vkte_tv_auto','')==='1');
const FSEL='.wk-hub-c,.wk-site-c,.wk-cal-d,.bst,.v17go,.pk,label.btn,button:not([disabled]),a[href],input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"],.card,[data-od],[data-wsheet],.chip,.rk,.v19sc,.v21rt,.wk-card .wk-t,#car img,#car .ph0';
const NATIVE=/^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/;
const vh=()=>window.innerHeight||document.documentElement.clientHeight||540;
const inHeader=el=>!!(el&&el.closest&&el.closest('header.app'));
const vis=el=>{ const r=el.getBoundingClientRect(); if(r.width<4||r.height<4) return false; const s=getComputedStyle(el); return s.visibility!=='hidden'&&s.display!=='none'&&s.pointerEvents!=='none'; };
function scope(){ const lk=$$('lock'); if(lk&&lk.classList.contains('show')) return lk; const ask=$$('ovAsk'); if(ask&&ask.classList.contains('show')) return ask; const lb=$$('lbx'); if(lb&&lb.classList.contains('show')) return lb;
  const ov=[...document.querySelectorAll('.overlay.show')]; if(ov.length) return ov[ov.length-1]; return document.body; }
const navOk=(sc,el)=>!!(sc&&sc.classList&&sc.classList.contains('page')&&el&&el.closest&&el.closest('nav.dock'));
const inClosed=el=>{ let d=el.closest('details'); if(d&&el.tagName==='SUMMARY'&&el.parentElement===d) d=d.parentElement&&d.parentElement.closest('details'); for(;d;d=d.parentElement&&d.parentElement.closest('details')) if(!d.open) return true; return false; };
/* المرشّحون: نافذة رأسية حول الشاشة أولًا (أسرع بكثير مع مئات البطاقات)، والمسح الكامل عند الحاجة فقط */
const cands=full=>{ const sc=scope(), H=vh(), out=[]; const body=sc===document.body;
  for(const el of sc.querySelectorAll(FSEL)){
    const r=el.getBoundingClientRect(); if(r.width<4||r.height<4) continue;
    if(!full&&(r.bottom<-H*0.6||r.top>H*1.6)) continue;
    if(body&&el.closest('.overlay')) continue;
    if(el.parentElement&&el.parentElement.closest('.card')) continue;
    if(el.closest('[hidden],[inert]')||inClosed(el)||!vis(el)) continue;
    out.push(el); }
  if(sc.classList&&sc.classList.contains('page')) for(const el of document.querySelectorAll('nav.dock .nb')) if(vis(el)) out.push(el);
  return out; };
function mark(el){ document.querySelectorAll('.tvf').forEach(x=>x!==el&&x.classList.remove('tvf')); el.classList.add('tvf'); }
let lastContent=null;
function focusEl(el,center,still){ if(!el) return; if(!inHeader(el)&&!el.closest('.overlay')) lastContent=el; if(!NATIVE.test(el.tagName)&&!el.hasAttribute('tabindex')) el.tabIndex=-1; try{ el.focus({preventScroll:true}); }catch{} mark(el);
  if(!still){ try{ el.scrollIntoView({block:center?'center':'nearest',inline:'nearest',behavior:'auto'}); }catch{} } }
function pick(cur,dir,list){ const c=cur.getBoundingClientRect(), cx=c.left+c.width/2, cy=c.top+c.height/2; let best=null,bs=1e18;
  for(const el of list){ if(el===cur||el.contains(cur)||cur.contains(el)) continue; const r=el.getBoundingClientRect(); const dx=(r.left+r.width/2)-cx, dy=(r.top+r.height/2)-cy; let main,perp,over;
    if(dir==='ArrowRight'){ if(dx<=2) continue; main=dx; perp=Math.abs(dy); over=r.bottom>c.top&&r.top<c.bottom; }
    else if(dir==='ArrowLeft'){ if(dx>=-2) continue; main=-dx; perp=Math.abs(dy); over=r.bottom>c.top&&r.top<c.bottom; }
    else if(dir==='ArrowDown'){ if(dy<=2) continue; main=dy; perp=Math.abs(dx); over=r.right>c.left&&r.left<c.right; }
    else { if(dy>=-2) continue; main=-dy; perp=Math.abs(dx); over=r.right>c.left&&r.left<c.right; }
    const sc=main+perp*(over?1.4:4)+(over?0:400); if(sc<bs){ bs=sc; best=el; } }
  return best; }
/* مسار سريع لشبكة البطاقات: الجار يُحسب من فهرس العنصر وعدد الأعمدة بلا قياس مئات العناصر */
function gridNext(cur,k){ if(!cur.classList||!cur.classList.contains('card')||scope()!==document.body) return null; const g=cur.parentElement; if(!g||g.id!=='grid') return null;
  const ch=g.children, n=ch.length; let cols=g._tvc&&g._tvw===g.clientWidth?g._tvc:0;
  if(!cols){ const t=ch[0].offsetTop; cols=1; while(cols<n&&ch[cols].offsetTop===t) cols++; g._tvc=cols; g._tvw=g.clientWidth; }
  const i=Array.prototype.indexOf.call(ch,cur); if(i<0) return null; const row=Math.floor(i/cols);
  if(k==='ArrowLeft') return (cols>1&&i+1<n&&Math.floor((i+1)/cols)===row)?ch[i+1]:undefined;
  if(k==='ArrowRight') return (cols>1&&i%cols!==0)?ch[i-1]:null;
  if(k==='ArrowUp') return row>0?ch[i-cols]:null;
  if(k==='ArrowDown'){ if(i+cols<n) return ch[i+cols]; if(row<Math.floor((n-1)/cols)) return ch[n-1]; return null; }
  return null; }
function firstFocus(){ const sc=scope(); if(sc===document.body){ const c=document.querySelector('.card'); if(c&&vis(c)) return c; }
  return cands()[0]||cands(true)[0]; }
function ensureFocus(){ if(!on||(window.TVApp&&TVApp.on)) return; const sc=scope(), a=document.activeElement; if(a&&a!==document.body&&(sc.contains(a)||navOk(sc,a))&&vis(a)){ mark(a); return; } const f=firstFocus(); if(f) focusEl(f,false,scope()===document.body&&window.scrollY<5); }
function closeTop(){ const open=!!document.querySelector('.overlay.show,#lbx.show'); if(open) document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); return open; }
/* رجوع: يغلق النافذة؛ وفي الرئيسية يعود للأعلى أولًا، وبعدها فقط يخرج من التطبيق */
function backHome(){ if(document.querySelector('.overlay.show,#lbx.show')) return closeTop();
  if(window.scrollY>260){ window.scrollTo(0,0); const c=document.querySelector('.card'); if(c) focusEl(c); return true; }
  return false; }
window.__tvBack=()=>{ try{ return on?backHome():false; }catch{ return false; } };
let lastKey=0;
document.addEventListener('keydown',e=>{ if(!on||(window.TVApp&&TVApp.on)||e.ctrlKey||e.metaKey||e.altKey) return;
  const k=e.key, t=e.target, tag=t&&t.tagName||'', typing=(tag==='INPUT'&&!/^(checkbox|radio|button|submit|range|color|file)$/.test(t.type))||tag==='TEXTAREA';
  if(k==='Escape'&&!e.isTrusted) return;
  if(k==='GoBack'||k==='BrowserBack'||(k==='Backspace'&&!typing)){ e.preventDefault(); if(document.querySelector('.overlay.show,#lbx.show')) closeTop(); else backHome(); return; }
  if(/^(ContextMenu|Menu|F1|PageDown|ChannelDown|MediaTrackNext)$/.test(k)&&scope()===document.body){ e.preventDefault(); const cur=document.activeElement;
    if(inHeader(cur)&&lastContent&&document.contains(lastContent)&&vis(lastContent)) focusEl(lastContent); else { const d=document.querySelector('nav.dock .on,nav.dock button'); if(d){ window.scrollTo(0,0); focusEl(d); } } return; }
  if(/^Arrow(Left|Right|Up|Down)$/.test(k)){
    if(typing&&(k==='ArrowLeft'||k==='ArrowRight')&&tag!=='') return;
    if(tag==='TEXTAREA'&&(k==='ArrowUp'||k==='ArrowDown')) return;
    /* ضغط مستمر: نخفّف المعالجة كي لا تتراكم الأحداث على المعالجات الضعيفة */
    const now=performance.now(); if(e.repeat&&now-lastKey<70){ e.preventDefault(); return; } lastKey=now;
    let cur=document.activeElement;
    if(cur&&cur.classList&&cur.classList.contains('card')&&vis(cur)){ const gn=gridNext(cur,k); if(gn){ e.preventDefault(); e.stopImmediatePropagation(); focusEl(gn); return; } if(gn===undefined){ e.preventDefault(); e.stopImmediatePropagation(); return; } }
    let list=cands(); if(!list.length) list=cands(true); if(!list.length) return; if(!cur||cur===document.body||!(scope().contains(cur)||navOk(scope(),cur))||!vis(cur)){ e.preventDefault(); focusEl(firstFocus()); return; }
    if(k==='ArrowDown'&&cur.tagName==='SUMMARY'&&cur.parentElement&&cur.parentElement.open){ const inn=list.find(x=>x!==cur&&cur.parentElement.contains(x)&&!(x.tagName==='SUMMARY'&&x.parentElement===cur.parentElement)); if(inn){ e.preventDefault(); e.stopImmediatePropagation(); focusEl(inn); return; } }
    let nx=pick(cur,k,list); if(!nx) nx=pick(cur,k,cands(true));
    if(nx){ e.preventDefault(); e.stopImmediatePropagation(); focusEl(nx); return; }
    /* نهاية القائمة المحمّلة: حمّل دفعة جديدة من البطاقات ثم تابع */
    if(k==='ArrowDown'&&scope()===document.body&&typeof renderMore==='function'&&render&&render.list&&render.n<render.list.length){ e.preventDefault(); e.stopImmediatePropagation(); renderMore(); requestAnimationFrame(()=>{ const n2=pick(cur,k,cands(true)); if(n2) focusEl(n2); }); return; }
    e.preventDefault(); return; }
  if((k==='Enter'||k==='NumpadEnter')&&t&&!NATIVE.test(tag)&&t!==document.body&&t.classList&&(t.classList.contains('tvf')||t.matches('#car img'))){ e.preventDefault(); t.click(); } },true);
function apply(){ if(window.TVApp){ on?TVApp.start():TVApp.stop(); } document.documentElement.classList.toggle('tv',on); document.documentElement.classList.toggle('tvlite',on); if(on) setTimeout(ensureFocus,300); else document.querySelectorAll('.tvf').forEach(x=>x.classList.remove('tvf')); }
apply();
/* v28: إعادة بناء الشبكة لا تُفقد التركيز؛ نعيده لنفس البطاقة بدل القفز لأول بطاقة */
if(on&&typeof render==='function'){ try{ const _render=render; render=function(a){ const f=document.activeElement, id=f&&f.classList&&f.classList.contains('card')?f.dataset.id:null; const r=_render.apply(this,arguments);
  if(id){ requestAnimationFrame(()=>{ const n=document.querySelector('.card[data-id="'+id+'"]'); if(n&&scope()===document.body) focusEl(n); }); } return r; }; }catch(e){ lerr('render',e); } }
/* v28: عند إغلاق نافذة نعيد التركيز لما فتحها (لا للبطاقة الأولى) */
const openers=new Map();
try{ let ot=0; const kick=()=>{ if(!on||ot) return; ot=setTimeout(()=>{ ot=0; ensureFocus(); },120); };
  const was=new WeakMap();
  const mo=new MutationObserver(ms=>{ ms.forEach(m=>{ const el=m.target, isOn=el.classList.contains('show'), prev=was.get(el)||false; if(isOn===prev) return; was.set(el,isOn);
      if(isOn){ const a=document.activeElement; if(a&&a!==document.body&&!el.contains(a)) openers.set(el,a); }
      else { const a=openers.get(el); openers.delete(el); if(a&&document.contains(a)&&vis(a)&&scope().contains(a)){ setTimeout(()=>{ if(!document.querySelector('.overlay.show,#lbx.show')||scope().contains(a)) focusEl(a); },60); return; } }
    }); kick(); });
  const watch=el=>{ try{ mo.observe(el,{attributes:true,attributeFilter:['class']}); }catch{} };
  document.querySelectorAll('.overlay,#lbx').forEach(watch);
  const bo=new MutationObserver(m=>{ m.forEach(r=>r.addedNodes.forEach(n=>{ if(n.nodeType===1&&n.matches&&n.matches('.overlay,#lbx')) watch(n); })); }); bo.observe(document.body,{childList:true}); }catch(e){ lerr('obs',e); }
document.addEventListener('focusin',e=>{ if(on&&e.target!==document.body){ mark(e.target); if(!inHeader(e.target)&&!e.target.closest('.overlay')) lastContent=e.target; } });
/* كشف تلقائي: يسأل النظام عبر الإضافة المحلية، ويحفظ النتيجة للتشغيل التالي */
if(IS_NATIVE&&PLATFORM==='android'){ try{ NATIVE.Shell.info().then(i=>{ const tv=!!(i&&i.tv); LS.set('vkte_tv_auto',tv?'1':'0'); if(tv&&manual()!=='0'&&!on){ on=true; apply(); } }).catch(()=>{}); }catch(e){ lerr('auto',e); } }
/* إعدادات */
try{ const m=document.querySelector('#ovSet .modal'); const det=document.createElement('details'); det.className='sec v22tv';
  det.innerHTML=`<summary>وضع التلفاز</summary><div class="secb"><label style="display:flex;gap:8px;align-items:center;cursor:pointer;color:var(--text)"><input type="checkbox" id="v22tvOn"> تفعيل وضع التلفاز (تنقل بالأسهم)</label><p class="src" style="font-size:.85rem;margin-top:8px;line-height:1.8">الأسهم للتنقل · <b>OK</b> للفتح · <b>رجوع</b> للإغلاق. يُفعَّل تلقائيًا على أجهزة Android TV، ويمكنك فرضه أو إيقافه من هنا.</p></div>`;
  m.insertBefore(det,m.lastElementChild); const cb=$$('v22tvOn');
  $$('bSet').addEventListener('click',()=>{ cb.checked=on; cb.disabled=forced; });
  cb.onchange=()=>{ on=cb.checked; LS.set('vkte_tv',on?'1':'0'); apply(); toast(on?'تم تفعيل وضع التلفاز':'تم إيقاف وضع التلفاز'); };
}catch(e){ lerr('ui',e); }

/* معلومات التشخيص (إصدار المتصفح وآخر الأخطاء) لتسهيل إصلاح مشاكل الشاشة */
try{ const m2=document.querySelector('#ovSet .modal'); const d2=document.createElement('details'); d2.className='sec v25diag';
  d2.innerHTML='<summary>تشخيص الشاشة</summary><div class="secb"><p class="src" id="v25dg" dir="ltr" style="font-size:.8rem;white-space:pre-wrap;word-break:break-all"></p></div>';
  m2.insertBefore(d2,m2.lastElementChild);
  $$('bSet').addEventListener('click',()=>{ let e=[]; try{ e=JSON.parse(LS.get('vkte_errlog','[]'))||[]; }catch{}
    const cv=(navigator.userAgent.match(/Chrome\/([\d.]+)/)||[])[1]||'?';
    $$('v25dg').textContent='WebView/Chrome: '+cv+'\nscreen: '+innerWidth+'x'+innerHeight+' dpr '+devicePixelRatio+'\nTV mode: '+on+'\nerrors: '+e.length+(e.length?'\n'+e.slice(-6).map(x=>x.k+': '+x.m).join('\n'):''); });
}catch(e){ lerr('diag',e); }
})();

;

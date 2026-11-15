// ===== حوارات داخل التطبيق (بدل نوافذ المتصفح) =====
const ask={cancel:null};
function askShow(html,wire){ return new Promise(res=>{ const m=$('mAsk'); m.onclick=null; m.className='modal'; m.innerHTML=html;
  const done=v=>{ ask.cancel=null; closeOv('ovAsk'); res(v); }; ask.cancel=()=>done(null);
  $('ovAsk').classList.add('show'); wire(m,done); }); }
const askText=(title,val='',ph='')=>askShow(`<h2>${esc(title)}</h2><input class="in" id="aIn" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off"><div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn gold" id="aOk">حفظ</button></div>`,(m,done)=>{ const i=$('aIn'); setTimeout(()=>{ i.focus(); i.select(); },80); $('aOk').onclick=()=>done(i.value.trim()||null); $('aNo').onclick=()=>done(null); i.onkeydown=e=>{ if(e.key==='Enter') $('aOk').click(); if(e.key==='Escape') done(null); }; });
const askConfirm=(msg,ok='تأكيد',danger=false)=>askShow(`<p style="line-height:1.8">${esc(msg)}</p><div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn ${danger?'danger':'gold'}" id="aOk">${esc(ok)}</button></div>`,(m,done)=>{ $('aOk').onclick=()=>done(true); $('aNo').onclick=()=>done(false); }).then(v=>!!v);
const askNote=msg=>askShow(`<p style="line-height:1.8">${esc(msg)}</p><div class="actions"><button class="btn gold" id="aOk">حسنًا</button></div>`,(m,done)=>{ $('aOk').onclick=()=>done(true); });

// ===== ثوابت =====
const API=()=>'https://api.theporndb.net';
// معايير التقييم (الجرأة بدل الكيمياء)
const CRIT=[['beauty','الجمال'],['charisma','الكاريزما'],['perf','الأداء'],['seduce','الإغراء'],['body','الجسم'],['screen','الحضور على الشاشة'],['bold','الجرأة'],['heat','الإثارة']];
// تفاصيل الجسم
const BODY=[['face','الوجه'],['hair','الشعر'],['skin','البشرة'],['figure','القوام العام'],['chest','الصدر'],['waist','الخصر'],['hips','الأرداف'],['legs','الأرجل']];
function zodiac(d){ if(!d) return ''; const b=new Date(d); if(isNaN(b)) return ''; const m=b.getMonth()+1,x=b.getDate();
  const Z=[[1,20,'الجدي'],[2,19,'الدلو'],[3,21,'الحوت'],[4,20,'الحمل'],[5,21,'الثور'],[6,21,'الجوزاء'],[7,23,'السرطان'],[8,23,'الأسد'],[9,23,'العذراء'],[10,23,'الميزان'],[11,22,'العقرب'],[12,22,'القوس']];
  let r='الجدي'; for(const [mm,dd,n] of Z){ if(m>mm||(m===mm&&x>=dd)) r=n; } return r; }
const PLAT=[
  {k:'instagram',n:'إنستغرام',b:'https://instagram.com/',h:'اسم المستخدم أو الرابط'},
  {k:'x',n:'X (تويتر)',b:'https://x.com/',h:'اسم المستخدم أو الرابط'},
  {k:'tiktok',n:'تيك توك',b:'https://tiktok.com/@',h:'اسم المستخدم أو الرابط'},
  {k:'onlyfans',n:'OnlyFans',b:'https://onlyfans.com/',h:'اسم المستخدم أو الرابط'},
  {k:'fansly',n:'Fansly',b:'https://fansly.com/',h:'اسم المستخدم أو الرابط'},
  {k:'snapchat',n:'سناب شات',b:'https://snapchat.com/add/',h:'اسم المستخدم أو الرابط'},
  {k:'telegram',n:'تيليجرام',b:'https://t.me/',h:'اسم المستخدم أو الرابط'},
  {k:'reddit',n:'ريديت',b:'https://reddit.com/user/',h:'اسم المستخدم أو الرابط'},
  {k:'youtube',n:'يوتيوب',b:'https://youtube.com/@',h:'اسم القناة أو الرابط'},
  {k:'twitch',n:'تويتش',b:'https://twitch.tv/',h:'اسم المستخدم أو الرابط'},
  {k:'linktree',n:'Linktree',b:'https://linktr.ee/',h:'اسم المستخدم أو الرابط'},
  {k:'website',n:'موقع شخصي',b:'',h:'الرابط، مثل example.com'},
  {k:'other',n:'أخرى',b:'',h:'الرابط أو الاسم'}
];
const platOf=k=>PLAT.find(p=>p.k===k)||PLAT[PLAT.length-1];
function accUrl(a){ let v=String(a.v||'').trim(); if(!v) return null; const p=platOf(a.p);
  try{
    if(/^https?:\/\//i.test(v)){ const u=new URL(v); return /^https?:$/.test(u.protocol)?u.href:null; }
    if(p.b){ v=v.replace(/^@+/,'').replace(/^\/+/,''); return /^[\w.\-]+$/.test(v)?p.b+v:null; }
    if(/^[\w\-]+(\.[\w\-]+)+(\/\S*)?$/.test(v)) return new URL('https://'+v).href;
  }catch{}
  return null; }
const shortV=v=>String(v).replace(/^https?:\/\/(www\.)?/i,'').replace(/\/+$/,'');
const fmtDate=t=>new Date(t).toLocaleDateString('ar',{year:'numeric',month:'short',day:'numeric'});
function age(d){ if(!d) return null; const b=new Date(d); if(isNaN(b)) return null; const n=new Date(); let a=n.getFullYear()-b.getFullYear(); const m=n.getMonth()-b.getMonth(); if(m<0||(m===0&&n.getDate()<b.getDate())) a--; return a; }
const stars=v=>`<span class="stars" style="--p:${(v||0)/5*100}%">★★★★★</span>`;
// v28: المصغّرات المحفوظة كنص data: تُحوَّل مرة واحدة إلى رابط blob: قصير ومخزّن، فلا تُحقن عشرات الآلاف من الأحرف في كل بطاقة ويُفكّ ترميزها مرة واحدة
const _thU=new Map();
const thumbSrc=t=>{ if(!t||!t.startsWith('data:')) return t||''; let u=_thU.get(t); if(u) return u;
  try{ const b=PB.fromData(t); if(!b) return t; u=URL.createObjectURL(b); _thU.set(t,u); return u; }catch{ return t; } };
const pic=i=>thumbSrc(i.thumb)||(i.photos&&i.photos[0])||'';

// ===== الأعمال: كل عمل {t,s,y,d,r,rec,w,q,wd,n,a,p,du,ds,tg,u,upc,fav,ls} =====
const ydOf=v=>{
  v=String(v||'').trim().replace(/\//g,'-');
  let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m){ const d=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'); return {y:m[1],d}; }
  m=v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if(m){ const d=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'); return {y:m[3],d}; }
  m=v.match(/^(\d{4})-(\d{1,2})$/);
  if(m){ const d=m[1]+'-'+m[2].padStart(2,'0')+'-01'; return {y:m[1],d}; }
  return {y:/^\d{4}$/.test(v.slice(0,4))?v.slice(0,4):''};
};
const WEX=['q','wd','n','a','p','du','ds','tg','u','upc','fav','ls','ip','is','im','tm'];   // ip/is/im/tm: معرّفات العمل (ThePornDB/StashDB/IMDb/TMDB)
const normW=w=>{
  if(Array.isArray(w)) return w.map(x=>{
    x=x||{};
    const yd=ydOf(x.d||x.y||'');
    const o={t:String(x.t||'').trim(),s:String(x.s||'').trim(),y:yd.y||String(x.y||'').trim().slice(0,4)};
    if(yd.d) o.d=yd.d;
    if(x.w) o.w=1;
    if(+x.r>0) o.r=+x.r;
    if(x.rec) o.rec=1;
    if(x.q) o.q=1;
    if(x.upc) o.upc=1;
    if(x.fav) o.fav=1;
    if(x.wd&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.wd))) o.wd=String(x.wd);
    if(x.n) o.n=String(x.n).trim();
    if(+x.a>0) o.a=+x.a;
    if(x.p&&/^https:\/\//i.test(String(x.p))) o.p=String(x.p).trim();
    if(+x.du>0) o.du=Math.round(+x.du);
    if(x.ds) o.ds=String(x.ds).trim().slice(0,320);
    if(Array.isArray(x.tg)&&x.tg.length) o.tg=[...new Set(x.tg.map(t=>String(t||'').trim()).filter(Boolean))].slice(0,10);
    if(x.u&&/^https:\/\//i.test(String(x.u))) o.u=String(x.u).trim();
    if(Array.isArray(x.ls)&&x.ls.length) o.ls=[...new Set(x.ls.filter(Boolean))];
    // معرّفات قواعد البيانات (لتشغيل VKTE ONLY عبر الإضافات): تُحفظ كلها معًا
    if(x.ip&&/^[A-Za-z0-9-]{1,64}$/.test(String(x.ip))) o.ip=String(x.ip);
    if(x.is&&/^[A-Za-z0-9-]{1,64}$/.test(String(x.is))) o.is=String(x.is);
    if(x.im&&/^tt\d{5,10}$/.test(String(x.im))) o.im=String(x.im);
    if(x.tm&&/^\d{1,10}$/.test(String(x.tm))) o.tm=String(x.tm);
    return o;
  }).filter(x=>x.t);
  return String(w||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    if(l.includes('|')){ const p=l.split('|').map(x=>x.trim()); return {t:p[0]||'',s:p[1]||'',...ydOf(p[2])}; }
    const m=l.match(/^(.*?)\s*\((\d{4})\)\s*$/); return m?{t:m[1],s:'',y:m[2]}:{t:l,s:'',y:''};
  }).filter(x=>x.t);
};
// ترحيل السجلات القديمة: أعمال نصية ← مهيكلة، الكيمياء ← الجرأة. يرجع true إن تغيّر شيء
const normItem=i=>{
  let ch=false;
  if(!Array.isArray(i.works)){ i.works=normW(i.works); ch=true; }
  if(i.criteria&&('chem' in i.criteria)){ if(i.criteria.bold==null) i.criteria.bold=i.criteria.chem; delete i.criteria.chem; ch=true; }
  if(!i.photos) i.photos=[]; if(!i.tags) i.tags=[]; if(!i.lists) i.lists=[];
  if(!i.updated) i.updated=Date.now();
  if(!i.added){ i.added=i.updated; ch=true; }
  return ch;
};
// شارة الموقع: لون ثابت لكل موقع من ألواننا + أول حرفين
const HUES=[338,350,2,318,300,284,270,328];
const hhash=s=>{ let h=0; for(const c of s.toLowerCase()) h=(h*31+c.charCodeAt(0))>>>0; return h; };
const badge=s=>{ s=(s||'').trim(); if(!s) return `<span class="sb sb0">${icon('film')}</span>`;
  const h=HUES[hhash(s)%HUES.length]; const w=s.split(/[\s\-_.]+/).filter(Boolean);
  const ini=w.length>1?w[0][0]+w[1][0]:s.slice(0,2);
  return `<span class="sb" style="--h:${h}">${esc(ini.toUpperCase())}</span>`; };
const allSites=()=>[...new Set(items.flatMap(i=>(i.works||[]).map(w=>w.s)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

// ===== الصور: تصغير + مصغّرة للبطاقات =====
const MAXPH=30;
// v31: خط صور أعلى جودة. تصغير على مراحل (أنعم وأحدّ من تصغير مرة واحدة)، تصحيح الاتجاه، وWebP عند دعمه (أصغر بنحو 30% بنفس الجودة).
const IMGQ={ full:1800, fullQ:.9, thumb:640, thumbQ:.86 };
const _webp=(()=>{ try{ return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); }catch{ return false; } })();
const IMGTYPE=_webp?'image/webp':'image/jpeg';
async function _decode(src){ // src: File|Blob|string
  if(typeof src!=='string'&&window.createImageBitmap){ try{ return await createImageBitmap(src,{imageOrientation:'from-image'}); }catch{} }
  const url=typeof src==='string'?src:URL.createObjectURL(src);
  try{ const im=new Image(); im.decoding='async'; im.src=url; if(im.decode) await im.decode(); else await new Promise((a,b)=>{ im.onload=a; im.onerror=b; }); return im; }
  finally{ if(typeof src!=='string') setTimeout(()=>URL.revokeObjectURL(url),4000); } }
function _scaled(im,max){ let w=im.width||im.naturalWidth, h=im.height||im.naturalHeight; const k=Math.min(1,max/Math.max(w,h));
  let tw=Math.max(1,Math.round(w*k)), th=Math.max(1,Math.round(h*k)), cur=im, cw=w, ch=h;
  const mk=(a,b)=>{ const c=document.createElement('canvas'); c.width=a; c.height=b; const x=c.getContext('2d'); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; return [c,x]; };
  while(cw/2>tw&&ch/2>th){ const [c,x]=mk(Math.round(cw/2),Math.round(ch/2)); x.drawImage(cur,0,0,c.width,c.height); cur=c; cw=c.width; ch=c.height; }
  const [c,x]=mk(tw,th); x.fillStyle='#000'; x.drawImage(cur,0,0,tw,th); return c; }
const _enc=(c,q)=>c.toDataURL(IMGTYPE,q);
async function resize(file){ const im=await _decode(file); try{ return _enc(_scaled(im,IMGQ.full),IMGQ.fullQ); } finally{ if(im.close) im.close(); } }
async function mkThumb(src,max=IMGQ.thumb){ const im=await _decode(src); try{ return _enc(_scaled(im,max),IMGQ.thumbQ); } finally{ if(im.close) im.close(); } }

// v28: تُنشأ المصغّرات الناقصة بأولوية الظاهر أولًا، وتُحدَّث البطاقة في مكانها بدل إعادة بناء الشبكة (لا قفز ولا فقدان تركيز)
async function backfillThumbs(){
  const order=new Map(); (render.list||[]).forEach((i,n)=>order.set(i.id,n));
  const todo=items.filter(it=>it.photos&&it.photos[0]&&!it.thumb).sort((a,b)=>(order.has(a.id)?order.get(a.id):1e9)-(order.has(b.id)?order.get(b.id):1e9));
  let ch=false, k=0;
  for(const it of todo){ if(!items.includes(it)||it.thumb) continue;
    try{ const t=await mkThumb(it.photos[0]); if(items.includes(it)&&!it.thumb){ it.thumb=t; await save(it); ch=true;
        document.querySelectorAll('.card[data-id="'+it.id+'"] .ph img.on,.av img[data-pid="'+it.id+'"]').forEach(im=>{ im.src=pic(it); }); } }catch{}
    if(++k%2===0) await new Promise(r=>setTimeout(r,TVLITE?120:40)); }
  // v31: ترقية هادئة لمصغّرات الإصدارات السابقة (360px) إلى الدقة الأعلى، مرة واحدة لكل ممثلة وبالأولوية للظاهر. الصور الأصلية لا تُمس.
  const up=TVLITE?[]:items.filter(it=>it.thumbV!==3&&it.photos&&it.photos[0]&&PB.local(it.photos[0])).sort((a,b)=>(order.has(a.id)?order.get(a.id):1e9)-(order.has(b.id)?order.get(b.id):1e9));
  let u=0; for(const it of up){ if(!items.includes(it)) continue; if(document.hidden){ await new Promise(r=>{ const f=()=>{ if(!document.hidden){ removeEventListener('visibilitychange',f); r(); } }; addEventListener('visibilitychange',f); }); }
    try{ const t=await mkThumb(it.photos[0]); if(items.includes(it)){ it.thumb=t; it.thumbV=3; await save(it); ch=true; 
        document.querySelectorAll('.card[data-id="'+it.id+'"] .ph img.on').forEach(im=>{ im.src=pic(it); }); } }catch{ it.thumbV=3; }
    if(++u%2===0) await new Promise(r=>setTimeout(r,TVLITE?200:90)); }
  if(ch&&!document.querySelector('.overlay.show')&&!TVLITE) render(); }

// ===== دوال الأعمال المشتركة (لداخل ملف الممثلة ومركز الأعمال المستقل) =====
const todayStr=()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const wDate=w=>w.d||(w.y?w.y+'-01-01':'');
const isUpcoming=w=>{ if(!w) return false; if(w.upc&&!w.w) return true; const T=todayStr(); return w.d?w.d>T:(!!w.y&&+w.y>+T.slice(0,4)); };
const isRecent=w=>{ if(!w) return false; const T=todayStr(); return w.d?w.d<=T:(!!w.y&&+w.y<=+T.slice(0,4)); };
const daysUntil=d=>{ if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null; const t0=new Date(todayStr()+'T00:00:00'), t1=new Date(d+'T00:00:00'); return Math.round((t1-t0)/864e5); };
const fmtWd=d=>{ try{ return new Date(d+'T00:00:00').toLocaleDateString('ar',{year:'numeric',month:'short',day:'numeric'}); }catch{ return d; } };
const WF=[['recent','الحديثة'],['upcoming','القادمة'],['watchlist','قائمة المشاهدة'],['top','الأعلى تقييمًا'],['rec','المنصوح بها'],['unseen','لم أشاهدها'],['seen','شاهدتها'],['all','الكل']];
function wApply(arr,mode){
  const g=x=>x.w||x;
  const dd=(a,b)=>wDate(g(b)).localeCompare(wDate(g(a)));
  if(mode==='upcoming') return arr.filter(x=>isUpcoming(g(x))).sort((a,b)=>(wDate(g(a))||'9999').localeCompare(wDate(g(b))||'9999'));
  if(mode==='watchlist') return arr.filter(x=>g(x).q&&!g(x).w).sort(dd);
  if(mode==='top') return arr.filter(x=>(g(x).r||0)>0).sort((a,b)=>(g(b).r||0)-(g(a).r||0)||dd(a,b));
  if(mode==='rec') return arr.filter(x=>g(x).rec||g(x).fav).sort((a,b)=>(g(b).r||0)-(g(a).r||0)||dd(a,b));
  if(mode==='unseen') return arr.filter(x=>!g(x).w&&!isUpcoming(g(x))).sort(dd);
  if(mode==='seen') return arr.filter(x=>g(x).w).sort((a,b)=>String(g(b).wd||wDate(g(b))).localeCompare(String(g(a).wd||wDate(g(a)))));
  if(mode==='all') return arr.slice().sort(dd);
  return arr.filter(x=>isRecent(g(x))&&!isUpcoming(g(x))).sort(dd);
}
function wKeyOf(w){ return (wkey(w.t)||norm(w.t))+'|'+(wkey(w.s)||''); }
function wRowItem(x,who){ const {it,w,k}=x; const up=isUpcoming(w); const key=wKeyOf(w);
  const meta=[who?it.name:'',w.s,w.d?fmtWd(w.d):w.y,w.du?w.du+' د':''].filter(Boolean).join(' · ');
  const lead=who?`<span class="av" data-od="${it.id}">${pic(it)?`<img src="${esc(pic(it))}" alt="">`:'♡'}</span>`:badge(w.s);
  return `<div class="wi wfi ${w.w?'seen':''}" data-ik="${it.id}|${k}" data-wkey="${esc(key)}">${lead}<div style="flex:1;min-width:0;cursor:pointer" data-wsheet="${esc(key)}"><div class="wt" dir="auto" style="text-align:start">${esc(w.t)}${up?'<span class="tag upc">قريبًا ⏳</span>':''}${w.q&&!w.w?'<span class="tag">🔖 للمشاهدة</span>':''}</div><div class="ws">${esc(meta)||'&nbsp;'}</div><div class="wrs">${[1,2,3,4,5].map(n=>`<button type="button" data-rs="${n}" class="${n<=(w.r||0)?'on':''}" aria-label="تقييم ${n}">★</button>`).join('')}</div></div><button class="ib sm wqt ${w.q?'on':''}" data-wq="1" title="قائمة المشاهدة" aria-label="قائمة المشاهدة">🔖</button><button class="ib sm wrc ${w.rec?'on':''}" data-rc="1" aria-label="أنصح به">${icon('like')}</button><button class="ib sm wtg ${w.w?'on':''}" data-wk="1" aria-label="تمت المشاهدة">${icon('eye')}</button></div>`; }
function wAct(e){
  const sh=e.target.closest('[data-wsheet]');
  if(sh&&!e.target.closest('button')){ wSheet(sh.dataset.wsheet); return false; }
  const row=e.target.closest('[data-ik]'); if(!row) return false;
  const p=row.dataset.ik.split('|'); const it=items.find(i=>i.id===p[0]); const w=it&&(it.works||[])[+p[1]]; if(!w) return false;
  const s=e.target.closest('[data-rs]'), c=e.target.closest('[data-rc]'), g=e.target.closest('[data-wk]'), q=e.target.closest('[data-wq]');
  if(s){ const n=+s.dataset.rs; if(w.r===n) delete w.r; else w.r=n; }
  else if(c){ if(w.rec) delete w.rec; else w.rec=1; }
  else if(q){ if(w.q) delete w.q; else w.q=1; }
  else if(g){ if(w.w){ delete w.w; } else { w.w=1; delete w.upc; if(!w.wd) w.wd=todayStr(); } }
  else return false;
  it.updated=Date.now(); save(it); updWorksDot(); return true;
}

// ===== القوائم الذكية للممثلات =====
const SMART=[
  ['top','تقييم 4.5+ ★',i=>(i.rating||0)>=4.5],
  ['unrated','بلا تقييم',i=>!(i.rating>0)],
  ['unseen','لها أعمال لم أشاهدها',i=>(i.works||[]).some(w=>!w.w)],
  ['upcoming','لها أعمال قادمة ⏳',i=>(i.works||[]).some(isUpcoming)],
  ['recent30','أضيفت آخر 30 يومًا',i=>Date.now()-(i.added||i.updated)<30*864e5],
  ['nophoto','بلا صور',i=>!(i.photos&&i.photos.length)],
  ['noworks','بلا أعمال',i=>!(i.works&&i.works.length)],
  ['nobirth','بلا تاريخ ميلاد',i=>!i.birth],
  ['bday','عيد ميلادها هذا الشهر 🎂',i=>/^\d{4}-\d{2}/.test(i.birth||'')&&+i.birth.slice(5,7)===new Date().getMonth()+1],
  ['manyworks','لها 5 أعمال فأكثر',i=>(i.works||[]).length>=5]
];


;

/* ===== المزامنة بين الجوال والشاشة عبر الشبكة المحلية (بلا إنترنت وبلا خادم خارجي) =====
   الشاشة (Android TV): تشغّل خادمًا صغيرًا (ShellPlugin.java) وتعرض رمز QR + العنوان + رمزًا من 6 أرقام.
   الجوال: يمسح الرمز بالكاميرا (يفتح favlib://pair…) أو يكتب العنوان والرمز يدويًا، ثم:
     1) يسأل الشاشة عمّا عندها (/hello: بصمة كل ممثلة + أسماء ملفات الصور)
     2) يسحب ما عدّلته الشاشة (تقييم/مشاهدة/مفضلة) إن لم يُعدَّل في الجوال بعد آخر مزامنة
     3) يرسل الصور الناقصة فقط (ملفًا ملفًا) ثم الممثلات المتغيّرة، ويحذف ما حُذف من الجوال، ثم القوائم.
   بعد الربط تعمل تلقائيًا: كل تعديل في الجوال يصل الشاشة خلال ثوانٍ ما دام الجهازان على نفس الشبكة. */
const Sync=(()=>{
  const jget=(k,d)=>{ try{ const v=JSON.parse(LS.get(k,'null')); return v==null?d:v; }catch{ return d; } };
  const PH_RE=/^[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp|gif|avif)$/;
  const extOf=t=>({'image/webp':'webp','image/png':'png','image/gif':'gif','image/avif':'avif'})[t]||'jpg';
  const LOCAL=['views','lastView','nph'];           // حقول خاصة بكل جهاز لا تُزامَن
  const META_KEYS=['vkte_wish','vkte_goal'], KEY_KEYS=['vkte_key','vkte_stash'];
  const h2=s=>{ let a=2166136261>>>0, b=5381; for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); a=Math.imul(a^c,16777619)>>>0; b=((b<<5)+b+c)>>>0; } return a.toString(36)+b.toString(36)+s.length.toString(36); };

  // ---------- تمثيل الممثلة على السلك: الصور مراجع لأسماء ملفات ----------
  function ref(p,it,idx){ if(!p) return ''; const m=PB.file(p); if(m) return {f:m.f,s:m.s||0,t:m.t||'image/jpeg'};
    if(typeof p==='string'&&(PB.map.has(p)||PB.isData(p))){ const s=PB.size(p), t=PB.type(p)||'image/jpeg'; return {f:'w'+h2(it.id+':'+idx+':'+s+':'+t)+'.'+extOf(t),s,t,_src:p}; }
    return typeof p==='string'?p:''; }
  function wire(it){ const o={...it}; LOCAL.forEach(k=>delete o[k]); o.photos=(it.photos||[]).map((p,k)=>ref(p,it,k)).filter(Boolean); o.thumb=it.thumb?ref(it.thumb,it,'t'):''; return o; }
  const strip=o=>JSON.stringify(o,(k,v)=>k==='_src'?undefined:v);
  const sig=it=>{ const o=wire(it); delete o.updated; delete o.thumb; delete o.thumbV; return h2(strip(o)); };
  const unref=v=>{ if(v&&typeof v==='object'&&typeof v.f==='string'&&PH_RE.test(v.f)) return FST.on?FST.url({f:v.f,s:+v.s||0,t:String(v.t||'image/jpeg')}):'';
    return typeof v==='string'&&(/^https?:\/\//i.test(v)||/^data:image\//i.test(v))?v:''; };

  // =====================================================================
  // الشاشة: الاستقبال
  // =====================================================================
  const TV={ ip:'', port:0, running:false, err:'', started:false };
  const code=()=>{ let c=LS.get('vkte_sync_code',''); if(!/^\d{6}$/.test(c)){ c=String(100000+Math.floor(Math.random()*900000)); LS.set('vkte_sync_code',c); } return c; };
  const ok=o=>({status:200,body:JSON.stringify(o)});
  const bad=(s,m)=>({status:s,body:JSON.stringify({error:m})});
  async function photoNames(){ if(!FST.on) return []; await FST.init();
    try{ const r=await NATIVE.Filesystem.readdir({path:'photos',directory:FST.dir()}); return (r.files||[]).map(f=>typeof f==='string'?f:f.name).filter(n=>PH_RE.test(n)); }catch{ return []; } }
  let applyQ=Promise.resolve();
  async function handle(req){ const path=String(req.path||''), m=String(req.method||'GET').toUpperCase(); let b=null;
    if(req.body){ try{ b=JSON.parse(req.body); }catch{ return bad(400,'json'); } }
    if(path==='/hello') return ok({app:'favlib',v:1,name:'الشاشة',count:items.length,sig:Object.fromEntries(items.map(i=>[i.id,[sig(i),i.updated||0]])),photos:await photoNames()});
    if(path==='/get'&&m==='POST'){ const ids=new Set((b&&b.ids)||[]); return ok({items:items.filter(i=>ids.has(i.id)).map(i=>JSON.parse(strip(wire(i))))}); }
    if(path==='/items'&&m==='POST'){ const arr=Array.isArray(b&&b.items)?b.items:[]; const out=[];
      for(const x of arr){ if(!x||typeof x!=='object'||typeof x.id!=='string'||x.id.length>128||typeof x.name!=='string'||!x.name.trim()||minorRec(x)) continue;
        x.photos=(Array.isArray(x.photos)?x.photos:[]).map(unref).filter(Boolean).slice(0,MAXPH); x.thumb=unref(x.thumb)||''; normItem(x);
        const k=items.findIndex(i=>i.id===x.id); if(k>=0){ const cur=items[k]; LOCAL.forEach(f=>{ if(cur[f]!=null) x[f]=cur[f]; }); items[k]=x; } else items.push(x); out.push(x); }
      applyQ=applyQ.then(()=>DB.put(out)).catch(e=>console.warn('sync put',e)); await applyQ; _wCache=null; HOOKS.saved.forEach(f=>{ try{ f(out); }catch{} });
      return ok({ok:true,n:out.length}); }
    if(path==='/delete'&&m==='POST'){ const ids=new Set((b&&b.ids)||[]); const gone=items.filter(i=>ids.has(i.id)); items=items.filter(i=>!ids.has(i.id)); _wCache=null;
      for(const g of gone){ try{ await DB.del(g.id); }catch{} } return ok({ok:true,n:gone.length}); }
    if(path==='/meta'&&m==='POST'){ if(b){ if(Array.isArray(b.lists)){ lists=b.lists.filter(L=>L&&L.id&&L.name); LS.set('vkte_lists',JSON.stringify(lists)); }
        if(Array.isArray(b.wlists)){ wlists=b.wlists.filter(L=>L&&L.id&&L.name); LS.set('vkte_wlists',JSON.stringify(wlists)); }
        const p=b.prefs||{}; [...META_KEYS,...KEY_KEYS].forEach(k=>{ if(typeof p[k]==='string') LS.set(k,p[k]); }); _wCache=null; metaChanged(); }
      return ok({ok:true}); }
    if(path==='/done'&&m==='POST'){ const info={at:Date.now(),...(b||{})}; LS.set('vkte_sync_last',JSON.stringify(info)); render();
      if(window.TVApp&&TVApp.on) TVApp.refresh(true);
      const parts=[]; if(info.sent) parts.push(info.sent+' ممثلة'); if(info.photos) parts.push(info.photos+' صورة'); if(info.deleted) parts.push('حُذفت '+info.deleted);
      if(parts.length) toast('📲 وصلت مزامنة من الجوال: '+parts.join('، ')); return ok({ok:true}); }
    return bad(404,'path'); }

  async function startTV(){ if(TV.started) return TV; TV.started=true;
    if(!IS_NATIVE||PLATFORM!=='android'){ TV.err='الاستقبال متاح في تطبيق الشاشة (أندرويد) فقط'; return TV; }
    try{ await FST.init();
      NATIVE.Shell.addListener('request',async ev=>{ let r; try{ r=await handle(ev); }catch(e){ r=bad(500,String(e&&e.message||e)); }
        try{ await NATIVE.Shell.respond({id:ev.id,status:r.status,body:r.body}); }catch{} });
      const r=await NATIVE.Shell.startServer({token:code(),photoDir:FST.base,port:8765}); TV.ip=r.ip||''; TV.port=r.port||8765; TV.running=true; TV.err=TV.ip?'':'الشاشة غير متصلة بشبكة Wi-Fi أو سلكية';
    }catch(e){ TV.err='تعذّر تشغيل الاستقبال: '+String(e&&e.message||e).slice(0,80); TV.started=false; }
    return TV; }
  async function tvInfo(){ if(TV.running){ try{ const r=await NATIVE.Shell.address(); TV.ip=r.ip||TV.ip; TV.port=r.port||TV.port; TV.err=TV.ip?'':'الشاشة غير متصلة بالشبكة'; }catch{} }
    return {...TV,code:code(),last:jget('vkte_sync_last',null),link:TV.ip?`favlib://pair?h=${TV.ip}:${TV.port}&k=${code()}`:''}; }
  async function newCode(){ LS.del('vkte_sync_code'); const c=code(); if(TV.running){ try{ await NATIVE.Shell.setToken({token:c}); }catch{} } return c; }

  // =====================================================================
  // الجوال: الإرسال
  // =====================================================================
  let transport=async(method,url,body)=>{
    const isStr=typeof body==='string';
    if(IS_NATIVE){ const r=await NATIVE.CapacitorHttp.request({url,method,headers:{'Content-Type':isStr?'text/plain':'application/json'},data:body==null?undefined:body,connectTimeout:6000,readTimeout:120000});
      let d=r.data; if(typeof d==='string'){ try{ d=JSON.parse(d); }catch{} }
      if(r.status>=400) throw Object.assign(new Error((d&&d.error)||('HTTP '+r.status)),{status:r.status}); return d||{}; }
    const ac=new AbortController(), to=setTimeout(()=>ac.abort(),method==='GET'?8000:120000);
    let r; try{ r=await fetch(url,{method,signal:ac.signal,headers:{'Content-Type':isStr?'text/plain':'application/json'},body:body==null?undefined:(isStr?body:JSON.stringify(body))}); }finally{ clearTimeout(to); }
    const d=await r.json().catch(()=>({})); if(!r.ok) throw Object.assign(new Error(d.error||('HTTP '+r.status)),{status:r.status}); return d; };
  const call=(c,method,path,body)=>transport(method,'http://'+c.h+path+(path.includes('?')?'&':'?')+'k='+encodeURIComponent(c.k),body);
  const normHP=(h,port)=>{ h=String(h||'').trim().replace(/^https?:\/\//i,'').replace(/\/.*$/,''); if(!h) return ''; return /:\d+$/.test(h)?h:h+':'+port; };
  const normH=h=>normHP(h,8765);

  // رابط مزامنة واحد (الشاشة، أو VKTE ONLY). لكل رابط إعداده وبصمته الأساسية وطابوره.
  // o: {key, baseKey, port, who, twoWay, paint, openPair}
  function makeLink(o){
    const L={};
    const cfg=()=>jget(o.key,null);
    const setCfg=c=>{ if(c) LS.set(o.key,JSON.stringify(c)); else LS.del(o.key); o.paint(); };
    // آخر نسخة متّفق عليها بين الجهازين لكل ممثلة: تحدّد من عدّل منهما (مقارنة ثلاثية بدل «تعديل محلي» عام)
    let base=jget(o.baseKey,{});
    const saveBase=()=>LS.set(o.baseKey,JSON.stringify(base));
    let running=false, queued=false, stopReq=false, timer=0;
    const why=e=>{ const s=e&&e.status; if(s===401) return 'الرمز غير صحيح. تأكد من الرمز الظاهر في '+o.who+'.'; if(s===429) return 'محاولات خاطئة كثيرة. انتظر 10 دقائق ثم أعد المحاولة.';
      return o.unreach; };
    async function pair(h,k){ h=normHP(h,o.port); k=String(k||'').trim();
      if(!/^[\w.-]+:\d{2,5}$/.test(h)) throw new Error('العنوان غير صحيح. اكتبه كما يظهر في '+o.who+'، مثل 192.168.1.20');
      if(!/^\d{6}$/.test(k)) throw new Error('الرمز 6 أرقام كما يظهر في '+o.who);
      let r; try{ r=await call({h,k},'GET','/hello'); }catch(e){ throw new Error(why(e)); }
      if(!r||r.app!=='favlib') throw new Error('الجهاز على هذا العنوان ليس '+o.who);
      const old=cfg()||{}; if(old.h!==h){ base={}; saveBase(); }
      setCfg({h,k,auto:old.auto!==false,keys:!!old.keys,at:0,err:''}); return r; }

    async function syncNow(manual){
      const c=cfg(); if(!c){ if(manual) o.openPair(); return; }
      if(running){ queued=true; if(manual) toast('المزامنة جارية…'); return; }
      if(!manual&&navigator.onLine===false) return;
      running=true; stopReq=false; o.paint();
      const show=t=>{ if(manual) busy.show(t,()=>{ stopReq=true; }); };
      const res={pulled:0,sent:0,photos:0,deleted:0};
      try{
        show('الاتصال بـ'+o.who+'…');
        const hello=await call(c,'GET','/hello'); if(!hello||hello.app!=='favlib') throw new Error('ليس '+o.who);
        const remote=hello.sig||{}, have=new Set(hello.photos||[]);
        let mine=new Map(items.map(i=>[i.id,i]));
        // 1) سحب ما عُدّل على الطرف الآخر (الشاشة فقط؛ الخادم لا يعدّل)
        const mySig=new Map(items.map(i=>[i.id,sig(i)]));
        // يُسحب ما عدّله الطرف الآخر وحده؛ إن عدّل الجهازان نفس الممثلة يفوز الأحدث (updated)
        const pullIds=!o.twoWay?[]:Object.keys(remote).filter(id=>{ const cur=mine.get(id); if(!cur) return false; const ps=mySig.get(id), rs=remote[id][0], b=base[id]; if(ps===rs) return false;
          if(b===ps) return true; if(b===rs) return false; return (remote[id][1]||0)>(cur.updated||0); });
        for(let k=0;k<pullIds.length&&!stopReq;k+=25){ show('جلب تعديلات '+o.who+'…');
          const r=await call(c,'POST','/get',{ids:pullIds.slice(k,k+25)}); const ch=[];
          (r.items||[]).forEach(x=>{ const cur=mine.get(x.id); if(!cur||!x||typeof x!=='object'||minorRec(x)) return;
            const m={...x,photos:cur.photos,thumb:cur.thumb}; LOCAL.forEach(f=>{ if(cur[f]!=null) m[f]=cur[f]; else delete m[f]; });
            const i=items.indexOf(cur); if(i>=0){ items[i]=m; ch.push(m); } });
          if(ch.length){ applying++; try{ await save(ch); }finally{ applying--; } res.pulled+=ch.length; } }
        if(res.pulled){ mine=new Map(items.map(i=>[i.id,i])); render(); }
        // 2) إرسال الصور الناقصة ثم الممثلات المتغيّرة
        const pulledSet=new Set(pullIds);
        const push=items.filter(i=>{ const r=remote[i.id]; return !pulledSet.has(i.id)&&(!r||r[0]!==sig(i)); });
        let batch=[], bytes=0;
        const flush=async()=>{ if(!batch.length) return; await call(c,'POST','/items',{items:batch}); res.sent+=batch.length; batch=[]; bytes=0; };
        for(const it of push){ if(stopReq) break; show(`إرسال ${res.sent+batch.length+1} من ${push.length}…${res.photos?' ('+res.photos+' صورة)':''}`);
          const w=wire(it);
          for(const r of [...w.photos,w.thumb]){ if(!r||typeof r!=='object'||have.has(r.f)) continue;
            let d=''; try{ d=r._src?await PB.toData(r._src):await FST.read(r); }catch{ continue; }
            if(!d||!d.startsWith('data:')) continue;
            await call(c,'PUT','/photo/'+r.f,d.slice(d.indexOf(',')+1)); have.add(r.f); res.photos++; }
          const js=strip(w); batch.push(JSON.parse(js)); bytes+=js.length; if(batch.length>=20||bytes>1500000) await flush(); }
        await flush();
        // 3) الحذف والقوائم
        if(!stopReq){ const gone=Object.keys(remote).filter(id=>!mine.has(id)); if(gone.length){ await call(c,'POST','/delete',{ids:gone}); res.deleted=gone.length; }
          const prefs={}; META_KEYS.forEach(k=>{ const v=LS.get(k,null); if(v!=null) prefs[k]=v; }); if(c.keys&&o.twoWay) KEY_KEYS.forEach(k=>{ prefs[k]=LS.get(k,''); });
          await call(c,'POST','/meta',{lists,wlists,prefs}); await call(c,'POST','/done',res); }
        if(!stopReq){ base={}; items.forEach(i=>{ base[i.id]=sig(i); }); saveBase(); }
        setCfg({...cfg(),at:Date.now(),err:''});
        if(manual) await askNote(stopReq?'أُوقفت المزامنة.':`تمت المزامنة مع ${o.who} ✓\nأُرسلت ${res.sent} ممثلة و${res.photos} صورة${res.deleted?'، وحُذفت '+res.deleted:''}${res.pulled?'.\nجُلبت '+res.pulled+' تعديلات':''}.`);
      }catch(e){ const msg=e&&e.status?why(e):(e&&e.message&&!/fetch|network|connect|timed? ?out|host|refused|unreachable/i.test(e.message)?e.message:why(e));
        const cur=cfg(); if(cur) setCfg({...cur,err:msg}); if(manual) await askNote('تعذّرت المزامنة.\n'+msg);
        else if(cur&&cur.auto!==false){ L.retry=Math.min((L.retry||30000)*2,15*60000); schedule(L.retry); }   // إعادة المحاولة بتباعد متزايد
      }finally{ running=false; busy.hide(); o.paint(); if(queued){ queued=false; schedule(2500); } }
      if(!cfg()||!cfg().err) L.retry=0;
      return res; }

    function schedule(ms){ const c=cfg(); if(!c||c.auto===false) return; clearTimeout(timer); timer=setTimeout(()=>syncNow(false),ms==null?5000:ms); }
    const onTV=()=>!!(window.TVApp&&TVApp.on);
    HOOKS.saved.push(()=>{ if(applying||!cfg()||onTV()) return; schedule(); });
    HOOKS.deleted.push(()=>{ if(cfg()&&!onTV()) schedule(); });
    HOOKS.meta.push(()=>{ if(cfg()&&!onTV()) schedule(); });
    if(IS_NATIVE){ try{ NATIVE.App.addListener('appStateChange',s=>{ if(s&&s.isActive&&cfg()&&!onTV()) schedule(1500); }); }catch{} }
    setTimeout(()=>{ if(cfg()&&!onTV()) schedule(0); },8000);
    Object.assign(L,{cfg,setCfg,pair,syncNow,schedule,stop:()=>{ stopReq=true; },get running(){ return running; }});
    return L; }
  let applying=0;
  const TVL=makeLink({key:'vkte_sync_tv',baseKey:'vkte_sync_base',port:8765,who:'الشاشة',twoWay:true,paint:()=>paint(),openPair:()=>openPair(),
    unreach:'لا يمكن الوصول إلى الشاشة. تأكد أن تطبيق المفضلة مفتوح على الشاشة، وأن الجوال والشاشة على نفس شبكة Wi-Fi.'});
  const cfg=TVL.cfg, setCfg=TVL.setCfg, pair=TVL.pair, syncNow=TVL.syncNow, schedule=TVL.schedule;
  // تطبيق VKTE ONLY على الشاشة: مكتبة خاصة بممثلات Favorites (اتجاه واحد: الجوال ← VKTE ONLY)
  const VK=makeLink({key:'vkte_sync_vkte',baseKey:'vkte_sync_vkte_base',port:8766,who:'VKTE ONLY',twoWay:false,paint:()=>vkPaint(),openPair:()=>vkPair(),
    unreach:'لا يمكن الوصول إلى VKTE ONLY. تأكد أن التطبيق مفتوح على الشاشة، وأن الجوال والشاشة على نفس شبكة Wi-Fi.'});

  // ---------- رابط favlib://pair (من مسح رمز QR بكاميرا الجوال) ----------
  async function handleUrl(url){ if(!url||!/^favlib:/i.test(url)) return; let u; try{ u=new URL(url.replace(/^favlib:\/\//i,'http://x/')); }catch{ return; }
    if(!/pair/.test(u.pathname+u.host)) return; const h=u.searchParams.get('h'), k=u.searchParams.get('k');
    if(!(await askConfirm('ربط هذا الجوال بالشاشة ('+normH(h)+')؟\nستُرسل مكتبتك إليها الآن، وبعدها يصلها أي تعديل تلقائيًا.','ربط ومزامنة'))) return;
    busy.show('الاتصال بالشاشة…'); try{ await pair(h,k); }catch(e){ busy.hide(); await askNote(e.message); return; } busy.hide(); syncNow(true); }
  if(IS_NATIVE){ try{ NATIVE.App.addListener('appUrlOpen',e=>handleUrl(e&&e.url)); NATIVE.App.getLaunchUrl().then(r=>{ if(r&&r.url) setTimeout(()=>handleUrl(r.url),1500); }).catch(()=>{});
 }catch{} }

  // ---------- واجهة الجوال ----------
  const ago=t=>{ if(!t) return 'لم تتم بعد'; const m=Math.round((Date.now()-t)/6e4); if(m<1) return 'الآن'; if(m<60) return 'قبل '+m+' دقيقة'; const h=Math.round(m/60); if(h<24) return 'قبل '+h+' ساعة'; return 'قبل '+Math.round(h/24)+' يوم'; };
  function statusTxt(){ const c=cfg(); if(!c) return 'غير مربوط بشاشة'; if(TVL.running) return 'جارٍ المزامنة…'; if(c.err) return '⚠ '+c.err; return 'مربوط بالشاشة '+c.h.replace(/:8765$/,'')+' · آخر مزامنة '+ago(c.at); }
  function paint(){ const el=$('syStat'); if(el) el.textContent=statusTxt(); const b=document.querySelector('[data-tool="sync"] small'); if(b) b.textContent=cfg()?(TVL.running?'جارٍ المزامنة…':cfg().err?'غير متصلة':'مربوطة · '+ago(cfg().at)):'شاهد مكتبتك على التلفاز'; }
  async function openPair(){
    const r=await askShow(`<div class="fh"><h2>📺 ربط بالشاشة</h2><button class="ib" id="aNo" aria-label="إغلاق">${icon('x')}</button></div>
      <ol class="sy-steps"><li>ثبّت تطبيق المفضلة على شاشة Android TV وافتحه.</li><li>في الشاشة: القائمة الجانبية ← <b>اتصال بالجوال</b>.</li><li><b>امسح رمز QR</b> بكاميرا الجوال (الأسهل)، أو اكتب العنوان والرمز هنا:</li></ol>
      <label>العنوان الظاهر على الشاشة</label><input class="in" id="syH" dir="ltr" inputmode="decimal" placeholder="192.168.1.20" value="${esc((cfg()||{}).h?cfg().h.replace(/:8765$/,''):'')}" autocomplete="off">
      <label>الرمز (6 أرقام)</label><input class="in" id="syK" dir="ltr" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="off">
      <p class="src" id="syMsg" style="margin-top:8px;white-space:pre-line"></p>
      <div class="actions"><button class="btn gold" id="syGo">ربط ومزامنة</button></div>`,(m,done)=>{
      $('aNo').onclick=()=>done(null);
      $('syGo').onclick=async()=>{ const b=$('syGo'); b.disabled=true; $('syMsg').textContent='جارٍ الاتصال…';
        try{ await pair($('syH').value,$('syK').value); done(true); }catch(e){ $('syMsg').textContent=e.message; b.disabled=false; } };
      $('syK').onkeydown=e=>{ if(e.key==='Enter') $('syGo').click(); }; });
    if(r) syncNow(true); }
  function openPanel(){ const c=cfg();
    askShow(`<div class="fh"><h2>📺 الشاشة والمزامنة</h2><button class="ib" id="aNo" aria-label="إغلاق">${icon('x')}</button></div>
      <p class="src" style="margin-bottom:10px">اربط الجوال بتطبيق المفضلة على شاشتك (Android TV) مرة واحدة، وبعدها يصل أي تعديل تلقائيًا ما دام الجهازان على نفس شبكة Wi-Fi. التعديلات على الشاشة (تقييم، مشاهدة، مفضلة) ترجع للجوال أيضًا.</p>
      <div class="sy-card"><b id="syStat">${esc(statusTxt())}</b></div>
      ${c?`<label class="ck"><input type="checkbox" id="syAuto" ${c.auto!==false?'checked':''}> مزامنة تلقائية عند كل تعديل</label>
      <label class="ck"><input type="checkbox" id="syKeys" ${c.keys?'checked':''}> أرسل مفاتيح المصادر (ThePornDB/StashDB) للشاشة لتعمل فيها الاقتراحات والتحديث</label>`:''}
      <div class="actions">${c?`<button class="btn danger" id="syOff">فصل</button><button class="btn" id="syRe">تغيير الشاشة</button><button class="btn gold" id="syNow">مزامنة الآن</button>`:`<button class="btn gold" id="syRe">ربط بشاشة</button>`}</div>`,(m,done)=>{
      $('aNo').onclick=()=>done(null);
      $('syRe').onclick=()=>{ done(null); openPair(); };
      if($('syNow')) $('syNow').onclick=()=>{ done(null); syncNow(true); };
      if($('syOff')) $('syOff').onclick=async()=>{ done(null); if(await askConfirm('فصل الجوال عن الشاشة؟ مكتبة الشاشة تبقى كما هي.','فصل',true)) setCfg(null); };
      if($('syAuto')) $('syAuto').onchange=e=>setCfg({...cfg(),auto:e.target.checked});
      if($('syKeys')) $('syKeys').onchange=e=>{ setCfg({...cfg(),keys:e.target.checked}); if(e.target.checked) schedule(500); }; }); }
  try{ // قسم في الإعدادات
    const m=document.querySelector('#ovSet .modal'), d=document.createElement('details'); d.className='sec';
    d.innerHTML='<summary>📺 الشاشة والمزامنة</summary><div class="secb"><p class="src" id="syStat2"></p><div class="actions start"><button class="btn gold" id="syOpen">فتح</button></div></div>';
    const bk=[...m.querySelectorAll('details.sec')][2]; m.insertBefore(d,bk||m.lastElementChild);
    $('syOpen').onclick=()=>{ closeOv('ovSet'); openPanel(); }; $('bSet').addEventListener('click',()=>{ $('syStat2').textContent=statusTxt(); });
  }catch(e){ console.warn('sync ui',e); }

  // ---------- VKTE ONLY (تطبيق المكتبة الخاصة على الشاشة) ----------
  function vkTxt(){ const c=VK.cfg(); if(!c) return 'غير مربوط'; if(VK.running) return 'جارٍ المزامنة…'; if(c.err) return '⚠ '+c.err; return 'مربوط بـ VKTE ONLY على '+c.h.replace(/:8766$/,'')+' · آخر مزامنة '+ago(c.at); }
  function vkPaint(){ const a=$('vkStat'), b=$('vkStat2'); if(a) a.textContent=vkTxt(); if(b) b.textContent=vkTxt(); }
  async function vkPair(){
    const c=VK.cfg()||{};
    const r=await askShow(`<div class="fh"><h2>📺 ربط بـ VKTE ONLY</h2><button class="ib" id="aNo" aria-label="إغلاق">${icon('x')}</button></div>
      <ol class="sy-steps"><li>افتح <b>VKTE ONLY</b> على الشاشة.</li><li>فيه: الإعدادات ← <b>VKTE ONLY</b>، يظهر العنوان والرمز.</li><li>اكتبهما هنا:</li></ol>
      <label>العنوان الظاهر على الشاشة</label><input class="in" id="vkH" dir="ltr" inputmode="decimal" placeholder="192.168.1.20" value="${esc(c.h?c.h.replace(/:8766$/,''):'')}" autocomplete="off">
      <label>الرمز (6 أرقام)</label><input class="in" id="vkK" dir="ltr" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="off">
      <p class="src" id="vkMsg" style="margin-top:8px;white-space:pre-line"></p>
      <div class="actions"><button class="btn gold" id="vkGo">ربط ومزامنة</button></div>`,(m,done)=>{
      $('aNo').onclick=()=>done(null);
      $('vkGo').onclick=async()=>{ const b=$('vkGo'); b.disabled=true; $('vkMsg').textContent='جارٍ الاتصال…';
        try{ await VK.pair($('vkH').value,$('vkK').value); done(true); }catch(e){ $('vkMsg').textContent=e.message; b.disabled=false; } };
      $('vkK').onkeydown=e=>{ if(e.key==='Enter') $('vkGo').click(); }; });
    if(r) VK.syncNow(true); }
  function vkPanel(){ const c=VK.cfg();
    askShow(`<div class="fh"><h2>📺 VKTE ONLY</h2><button class="ib" id="aNo" aria-label="إغلاق">${icon('x')}</button></div>
      <p class="src" style="margin-bottom:10px">VKTE ONLY مكتبة خاصة على الشاشة تعرض ممثلاتك في المفضلة فقط وأعمالهن. بعد الربط يصلها كل تعديل تلقائيًا (إضافة، حذف، تعديل). الممثلة التي تحذفها من هنا تختفي هناك، وسجل مشاهدتها يبقى.</p>
      <div class="sy-card"><b id="vkStat">${esc(vkTxt())}</b></div>
      ${c?`<label class="ck"><input type="checkbox" id="vkAuto" ${c.auto!==false?'checked':''}> مزامنة تلقائية عند كل تعديل</label>`:''}
      <div class="actions">${c?`<button class="btn danger" id="vkOff">فصل</button><button class="btn" id="vkRe">تغيير الشاشة</button><button class="btn gold" id="vkNow">مزامنة الآن</button>`:`<button class="btn gold" id="vkRe">ربط</button>`}</div>`,(m,done)=>{
      $('aNo').onclick=()=>done(null);
      $('vkRe').onclick=()=>{ done(null); vkPair(); };
      if($('vkNow')) $('vkNow').onclick=()=>{ done(null); VK.syncNow(true); };
      if($('vkOff')) $('vkOff').onclick=async()=>{ done(null); if(await askConfirm('فصل الجوال عن VKTE ONLY؟ ستتوقف المزامنة، والمكتبة على الشاشة تبقى كما هي.','فصل',true)) VK.setCfg(null); };
      if($('vkAuto')) $('vkAuto').onchange=e=>VK.setCfg({...VK.cfg(),auto:e.target.checked}); }); }
  try{ // قسم في الإعدادات
    const m=document.querySelector('#ovSet .modal'), d=document.createElement('details'); d.className='sec';
    d.innerHTML='<summary>📺 VKTE ONLY</summary><div class="secb"><p class="src" id="vkStat2"></p><div class="actions start"><button class="btn gold" id="vkOpen">فتح</button></div></div>';
    const sy=$('syOpen'), after=sy&&sy.closest('details'); m.insertBefore(d,after?after.nextSibling:m.lastElementChild);
    $('vkOpen').onclick=()=>{ closeOv('ovSet'); vkPanel(); }; $('bSet').addEventListener('click',vkPaint);
  }catch(e){ console.warn('vkte ui',e); }
  if(typeof Home!=='undefined'&&Home.TOOL) Home.TOOL.sync=openPanel;
  setTimeout(paint,500);
  return {startTV,tvInfo,newCode,handle,syncNow,pair,openPanel,openPair,handleUrl,sig,wire,cfg,vkte:VK,vkPanel,vkPair,set transport(f){ transport=f; },get running(){ return TVL.running; }};
})();
window.Sync=Sync;

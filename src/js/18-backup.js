/* ===== النسخ الاحتياطي =====
   1) تصدير/استيراد يدوي بصيغة التطبيق القديم نفسها: {app:'vkte-favorites', v:5, items, lists, wlists, prefs}
      (الصور data:base64 داخل items[].photos و thumb) فيبقى الملف متوافقًا في الاتجاهين.
   2) نسخ تلقائي في التطبيق الأصلي إلى Documents/FavoritesBackup (ملف JSON لكل ممثلة + ملفات الصور)،
      واستعادة تلقائية عند أول تشغيل إن وُجد المجلد وكانت القاعدة فارغة.
   مفاتيح الاتصال ورمز القفل لا تدخل أي نسخة. */
const Backup=(()=>{
  const PREF_KEYS=['vkte_rec_saved','vkte_rec_ignored','vkte_rec_feedback','vkte_rec_fb2','vkte_rec_ui','vkte_view','vkte_sort','vkte_wview','vkte_picknew','vkte_autoworks','vkte_recent','vkte_open_app','vkte_open_q','vkte_open_tpl','vkte_theme','vkte_accent','vkte_wish','vkte_goal'];
  const ARR_KEYS=new Set(['vkte_rec_saved','vkte_rec_ignored','vkte_recent','vkte_wish']);
  const DIR='FavoritesBackup';
  const FS=()=>NATIVE.Filesystem;
  const prefsOut=()=>{ const p={}; PREF_KEYS.forEach(k=>{ const v=LS.get(k,null); if(v!==null&&v!=='') p[k]=v; }); return p; };
  const stamp=()=>new Date().toISOString().slice(0,10);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const b64OfBlob=async b=>{ const d=await PB.blobToData(b); return d.slice(d.indexOf(',')+1); };
  const extOf=t=>({'image/webp':'webp','image/png':'png','image/gif':'gif','image/avif':'avif'})[t]||'jpg';
  const mimeOf=n=>({webp:'image/webp',png:'image/png',gif:'image/gif',avif:'image/avif'})[String(n).split('.').pop()]||'image/jpeg';

  // ---------- مجلد النسخ: Documents أولًا، وإن تعذّر فمجلد التطبيق الداخلي ----------
  let root=null;
  async function dirOk(d){ try{ await FS().mkdir({path:DIR,directory:d,recursive:true}); }catch(e){ if(!/exist/i.test(String(e&&e.message))) { try{ await FS().stat({path:DIR,directory:d}); }catch{ return false; } } }
    try{ await FS().writeFile({path:DIR+'/.probe',directory:d,data:'ok',encoding:'utf8'}); return true; }catch{ return false; } }
  async function getRoot(){ if(root) return root; if(!IS_NATIVE) return null;
    const D=NATIVE.Directory; try{ if(PLATFORM==='android'){ try{ await FS().requestPermissions(); }catch{} } }catch{}
    for(const d of [D.Documents,D.Data]){ if(await dirOk(d)){ root=d; return d; } } return null; }
  const P=p=>DIR+'/'+p;
  const mk=async p=>{ try{ await FS().mkdir({path:P(p),directory:root,recursive:true}); }catch{} };
  const wText=(p,t)=>FS().writeFile({path:P(p),directory:root,data:t,encoding:'utf8',recursive:true});
  const rText=async p=>(await FS().readFile({path:P(p),directory:root,encoding:'utf8'})).data;
  const exists=async p=>{ try{ await FS().stat({path:P(p),directory:root}); return true; }catch{ return false; } };
  const rmF=async p=>{ try{ await FS().deleteFile({path:P(p),directory:root}); }catch{} };
  const ls=async p=>{ try{ return ((await FS().readdir({path:P(p),directory:root})).files||[]).map(f=>typeof f==='string'?f:f.name); }catch{ return []; } };

  // ---------- النسخ التلقائي ----------
  let man=null, dirty=new Set(), gone=new Set(), metaDirty=false, timer=0, running=false, st={at:0,err:'',left:0};
  const loadMan=async()=>{ if(!man) man=(await DB.kvGet('bkman').catch(()=>null))||{}; return man; };
  const safe=id=>String(id).replace(/[^\w.-]/g,'_').slice(0,80);
  async function backupItem(it){ const sid=safe(it.id), names=[], old=new Set((man[it.id]||[]));
    // يكتب صورة واحدة في مجلد النسخ (نسخ ملف مباشر إن كانت في مخزن الملفات) ويرجع مرجعها
    const putImg=async(p,tag)=>{ if(!PB.local(p)) return p; const n=sid+'-'+tag+'-'+PB.size(p)+'.'+extOf(PB.type(p)); names.push(n);
      if(!old.has(n)){ const m=PB.file(p);
        if(m){ await rmF('photos/'+n); await FS().copy({from:'photos/'+m.f,directory:FST.dir(),to:P('photos/'+n),toDirectory:root}); }
        else await FS().writeFile({path:P('photos/'+n),directory:root,data:await b64OfBlob(PB.toBlob(p)),recursive:true}); }
      return 'file:'+n; };
    const photos=[]; let k=0;
    for(const p of (it.photos||[])) photos.push(await putImg(p,k++));
    const thumb=it.thumb?await putImg(it.thumb,'t'):'';
    await wText('items/'+sid+'.json',JSON.stringify({...it,photos,thumb}));
    for(const n of old) if(!names.includes(n)) await rmF('photos/'+n);
    man[it.id]=names; }
  async function writeMeta(){ await wText('data.json',JSON.stringify({app:'favlib-backup',v:1,at:Date.now(),count:items.length,ids:items.map(i=>i.id),lists,wlists,prefs:prefsOut()})); }
  async function run(){ if(running||!IS_NATIVE) return; running=true; st.err='';
    try{ if(!(await getRoot())) throw new Error('لا يمكن الكتابة في مجلد النسخ'); await loadMan(); await mk('items'); await mk('photos');
      for(const id of [...gone]){ gone.delete(id); for(const n of (man[id]||[])) await rmF('photos/'+n); await rmF('items/'+safe(id)+'.json'); delete man[id]; metaDirty=true; }
      let n=0; while(dirty.size){ const id=dirty.values().next().value; dirty.delete(id); st.left=dirty.size; const it=items.find(x=>x.id===id); if(!it) continue;
        try{ await backupItem(it); }catch(e){ st.err=String(e&&e.message||e).slice(0,120); }
        metaDirty=true; if(++n%10===0){ await DB.kvSet('bkman',man); paint(); await sleep(30); } }
      if(metaDirty){ await writeMeta(); metaDirty=false; await DB.kvSet('bkman',man); }
      st.at=Date.now(); st.left=0; LS.set('vkte_bk_at',String(st.at)); if(!st.err) LS.set('vkte_last_export',String(st.at));
    }catch(e){ st.err=String(e&&e.message||e).slice(0,160); }
    running=false; paint(); if(dirty.size||gone.size) kick(1500); }
  const tvOn=()=>!!(window.TVApp&&TVApp.on);
  const kick=(ms=4000)=>{ if(!IS_NATIVE||tvOn()) return; clearTimeout(timer); timer=setTimeout(run,ms); };
  HOOKS.saved.push(arr=>{ arr.forEach(x=>dirty.add(x.id)); kick(); });
  HOOKS.deleted.push(id=>{ gone.add(id); dirty.delete(id); kick(); });
  HOOKS.meta.push(()=>{ metaDirty=true; kick(); });
  // أول تشغيل بعد التثبيت/التحديث: أي ممثلة ليست في السجل تُنسخ في الخلفية
  async function syncAll(force){ if(!IS_NATIVE||tvOn()) return; await loadMan(); items.forEach(i=>{ if(force||!man[i.id]) dirty.add(i.id); });
    Object.keys(man).forEach(id=>{ if(!items.some(i=>i.id===id)) gone.add(id); }); if(force) metaDirty=true; if(dirty.size||gone.size||metaDirty) kick(force?100:6000); }

  // ---------- الاستعادة التلقائية ----------
  async function readItemFile(id){ const o=JSON.parse(await rText('items/'+safe(id)+'.json'));
    const load=async ref=>{ if(typeof ref!=='string'||!ref.startsWith('file:')) return ref; const n=ref.slice(5);
      try{ const r=await FS().readFile({path:P('photos/'+n),directory:root}); const b=PB.fromData('data:'+mimeOf(n)+';base64,'+String(r.data).replace(/\s+/g,'')); return b?PB.url(b):null; }catch{ return null; } };
    o.photos=(await Promise.all((o.photos||[]).map(load))).filter(Boolean); o.thumb=(await load(o.thumb))||''; return o; }
  async function tryRestore(){ if(!IS_NATIVE||items.length) return 0;
    const D=NATIVE.Directory; let meta=null;
    for(const d of [D.Documents,D.Data]){ root=d; try{ meta=JSON.parse(await rText('data.json')); if(meta&&Array.isArray(meta.ids)&&meta.ids.length) break; meta=null; }catch{ meta=null; } }
    if(!meta){ root=null; return 0; }
    busy.show('استعادة نسختك التلقائية…'); let n=0, batch=[]; man={};
    try{ for(const id of meta.ids){ try{ const it=await readItemFile(id); if(!it||!it.id||!it.name||minorRec(it)) continue; normItem(it); items.push(it); batch.push(it); n++; }catch{}
        if(batch.length>=12){ await DB.put(batch); batch=[]; busy.show('استعادة نسختك التلقائية… '+n+' / '+meta.ids.length); } }
      if(batch.length) await DB.put(batch);
      mergeMeta(meta,true);
    }finally{ busy.hide(); }
    man=null; await syncAll(false); return n; }

  // ---------- دمج القوائم والتفضيلات ----------
  function mergeMeta(j,quiet){ let prefsChanged=false;
    (j.lists||[]).forEach(L=>{ if(L&&L.id&&!lists.some(x=>x.id===L.id)) lists.push(L); }); saveLists();
    (j.wlists||[]).forEach(W=>{ if(W&&W.id&&!wlists.some(x=>x.id===W.id)) wlists.push(W); }); saveWLists();
    if(j.prefs&&typeof j.prefs==='object') PREF_KEYS.forEach(k=>{ const v=j.prefs[k]; if(v==null||v==='') return; const cur=LS.get(k,'');
      if(ARR_KEYS.has(k)){ try{ const a=JSON.parse(cur||'[]'), b=JSON.parse(v); if(Array.isArray(a)&&Array.isArray(b)){ const seen=new Set(a.map(x=>JSON.stringify(x))); const extra=b.filter(x=>!seen.has(JSON.stringify(x))); if(extra.length){ LS.set(k,JSON.stringify(k==='vkte_recent'?[...a,...extra].slice(0,14):[...a,...extra])); prefsChanged=true; } } }catch{} }
      else if(!cur){ LS.set(k,String(v)); prefsChanged=true; } });
    return prefsChanged; }

  // ---------- الاستيراد (يقبل ملف التطبيق القديم v4/v5 كما هو، ولا يفقد أي حقل) ----------
  const cleanImage=v=>typeof v==='string'&&(/^https?:\/\//i.test(v)||/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i.test(v))&&v.length<40*1024*1024?v:'';
  async function importJson(j){
    if(!j||!Array.isArray(j.items)||j.items.length>50000){ toast('ملف غير صالح'); return false; }
    const safeItems=j.items.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.id==='string'&&x.id.length<=128&&typeof x.name==='string'&&x.name.trim().length>0).map(x=>{
      const y={...x,name:x.name.trim().slice(0,300),photos:Array.isArray(x.photos)?x.photos.slice(0,MAXPH).map(cleanImage).filter(Boolean):[],tags:Array.isArray(x.tags)?x.tags.filter(t=>typeof t==='string').slice(0,100):[],works:Array.isArray(x.works)?x.works.slice(0,5000):x.works};
      y.thumb=cleanImage(x.thumb)||''; return y; });
    const minors=safeItems.filter(minorRec), ok=safeItems.filter(x=>!minorRec(x));   // بوابة +18 على المستورد أيضًا
    const byId=new Map(items.map(i=>[i.id,i])); const add=[],upd=[]; let same=0;
    const broken=c=>(c.photos||[]).length<(c._want||0)||(FST.on&&(c.photos||[]).some(p=>PB.map.has(p)))||DB.legacy.includes(c.id);
    ok.forEach(x=>{ const cur=byId.get(x.id); if(!cur) add.push(x); else { cur._want=x.photos.length; const fix=broken(cur); delete cur._want; if((x.updated||0)>(cur.updated||0)||fix) upd.push(x); else same++; } });
    const hasMeta=(j.prefs&&typeof j.prefs==='object')||(j.lists||[]).length||(j.wlists||[]).length;
    if(!add.length&&!upd.length&&!hasMeta){ toast('لا جديد في هذا الملف'); return false; }
    if(!(await askConfirm('في الملف '+j.items.length+' ممثلة: '+add.length+' جديدة، '+upd.length+' أحدث من نسختك أو صورها ناقصة عندك (ستُحدَّث)، '+same+' بلا تغيير.'+(minors.length?' سيُتجاوز '+minors.length+' سجل تاريخ ميلاده أقل من 18 سنة أو غير مفهوم ('+minors.slice(0,3).map(m=>m.name).join('، ')+').':'')+' لن يُحذف شيء عندك. متابعة؟','استيراد'))) return false;
    busy.show('جارٍ الاستيراد…');
    try{ const all=[...add,...upd]; all.forEach(normItem); items.push(...add);
      upd.forEach(x=>{ const k=items.findIndex(i=>i.id===x.id); if(k>=0) items[k]=x; });
      for(let k=0;k<all.length;k+=15){ await DB.put(all.slice(k,k+15)); HOOKS.saved.forEach(f=>{ try{ f(all.slice(k,k+15)); }catch{} }); busy.show('جارٍ الاستيراد… '+Math.min(all.length,k+15)+' / '+all.length); await sleep(0); }
      _wCache=null; const prefsChanged=mergeMeta(j);
      render(true); closeOv('ovSet'); toast('تم الاستيراد: '+add.length+' جديدة'+(upd.length?'، '+upd.length+' محدّثة':'')+(minors.length?'، تُجوِوز '+minors.length:'')); backfillThumbs();
      if(prefsChanged) setTimeout(()=>location.reload(),1500);
    }catch(e){ toast('تعذّر الاستيراد: '+String(e&&e.message||e).slice(0,80)); return false; }
    finally{ busy.hide(); }
    return true; }
  async function importText(txt){ let j; try{ j=JSON.parse(txt); }catch{ toast('الملف ليس JSON صالحًا'); return false; }
    if(j&&j.app==='vkte-enc'){ const pass=await askText('كلمة سر النسخة المشفّرة','','كلمة السر'); if(!pass) return false; try{ j=JSON.parse(await decrypt(j,pass)); }catch(e){ toast(e.message||'تعذّر فك التشفير'); return false; } }
    return importJson(j); }
  async function importFile(f){ if(!f) return; if(f.size>900*1024*1024){ toast('الملف أكبر من الحد الآمن'); return; }
    busy.show('قراءة الملف…'); let txt; try{ txt=await f.text(); }catch{ busy.hide(); toast('تعذّرت قراءة الملف'); return; } busy.hide(); return importText(txt); }

  // ---------- التصدير (يُكتب على أجزاء كي لا يُحمَّل ملف ضخم في الذاكرة) ----------
  async function* chunks(){ yield '{"app":"vkte-favorites","v":5,"exportedAt":'+Date.now()+',"lists":'+JSON.stringify(lists)+',"wlists":'+JSON.stringify(wlists)+',"prefs":'+JSON.stringify(prefsOut())+',"items":[';
    for(let k=0;k<items.length;k++) yield (k?',':'')+JSON.stringify(await exportItem(items[k])); yield ']}'; }
  async function fullJson(){ const parts=[]; for await(const c of chunks()) parts.push(c); return parts; }
  async function writeNative(name,gen){ // يكتب في مجلد النسخ (exports) وإلا في Cache، ويرجع {uri, shown}
    const D=NATIVE.Directory; let dir=D.Cache, path=name, shown='';
    if(await getRoot()){ await mk('exports'); dir=root; path=P('exports/'+name); shown=(root===D.Documents?'Documents/':'')+path; }
    let first=true, buf=''; const flush=async()=>{ if(!buf&&!first) return; if(first){ await FS().writeFile({path,directory:dir,data:buf,encoding:'utf8',recursive:true}); first=false; } else await FS().appendFile({path,directory:dir,data:buf,encoding:'utf8'}); buf=''; };
    for await(const c of gen){ buf+=c; if(buf.length>1500000) await flush(); } await flush();
    return {uri:(await FS().getUri({path,directory:dir})).uri,shown}; }
  const isTv=()=>document.documentElement.classList.contains('tv');
  async function shareFile(name,gen,title){
    if(!IS_NATIVE){ const parts=[]; for await(const c of gen) parts.push(c); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(parts,{type:'application/octet-stream'})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000); return true; }
    const r=await writeNative(name,gen);
    if(!isTv()){ try{ await NATIVE.Share.share({title:title||name,files:[r.uri],dialogTitle:title||name}); }catch(e){ if(!/cancel/i.test(String(e&&e.message))&&!r.shown) throw e; } }
    if(r.shown) toast('حُفظت في '+r.shown); return true; }
  async function exportNow(){ if(!items.length){ toast('لا بيانات للتصدير'); return; } busy.show('تجهيز النسخة…');
    try{ await shareFile('favorites-backup-'+stamp()+'.json',chunks(),'نسخة احتياطية'); LS.set('vkte_last_export',String(Date.now())); toast('تم التصدير'); }
    catch(e){ toast('تعذّر التصدير: '+String(e&&e.message||e).slice(0,80)); } finally{ busy.hide(); paint(); } }
  async function shareText(name,text){ try{ await shareFile(name,(async function*(){ yield text; })(),name); }catch{ toast('تعذّر الحفظ'); } }

  // ---------- نسخة مشفّرة بكلمة سر (AES-GCM + PBKDF2)، متوافقة مع ملفات restore.vkte القديمة ----------
  const enc=new TextEncoder(), dec=new TextDecoder();
  const b64=u=>{ let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); };
  const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  async function keyFor(pass,salt){ const base=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:200000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']); }
  async function encrypt(text,pass){ const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await keyFor(pass,salt),enc.encode(text)));
    return JSON.stringify({app:'vkte-enc',v:1,salt:b64(salt),iv:b64(iv),data:b64(ct)}); }
  async function decrypt(o,pass){ try{ return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},await keyFor(pass,unb64(o.salt)),unb64(o.data))); }catch{ throw new Error('كلمة السر غير صحيحة'); } }
  async function exportEnc(){ if(!items.length){ toast('لا بيانات للتصدير'); return; } const pass=await askText('كلمة سر لتشفير النسخة (4 أحرف فأكثر). لا تنسها','','كلمة السر'); if(!pass) return; if(pass.length<4){ toast('كلمة السر 4 أحرف على الأقل'); return; }
    busy.show('تشفير النسخة…'); try{ const out=await encrypt((await fullJson()).join(''),pass); await shareFile('favorites-backup-'+stamp()+'.vkte',(async function*(){ yield out; })(),'نسخة مشفّرة'); LS.set('vkte_last_export',String(Date.now())); toast('تم التصدير المشفّر'); }
    catch(e){ toast('تعذّر التصدير: '+String(e&&e.message||e).slice(0,80)); } finally{ busy.hide(); } }

  // ---------- استيراد من مجلد النسخ (مفيد للتلفاز) ومن رابط ----------
  async function importFromDir(){ if(!IS_NATIVE){ toast('متاح داخل التطبيق فقط'); return; } if(!(await getRoot())){ toast('تعذّر الوصول لمجلد النسخ'); return; }
    await mk('import'); const files=[]; for(const d of ['import','exports']) (await ls(d)).filter(n=>/\.(json|vkte)$/i.test(n)).forEach(n=>files.push(d+'/'+n));
    const where=(root===NATIVE.Directory.Documents?'Documents/':'')+DIR+'/import';
    if(!files.length){ await askNote('لا توجد ملفات. ضع ملف النسخة (‎.json) في المجلد «'+where+'» ثم أعد المحاولة.'); return; }
    const pick=await askShow(`<h2>اختر ملف النسخة</h2><div class="v17opts">${files.map((f,n)=>`<button type="button" class="v17row" data-n="${n}"><span class="t"><b dir="ltr">${esc(f.split('/').pop())}</b><small>${esc(f.split('/')[0])}</small></span></button>`).join('')}</div><div class="actions"><button class="btn" id="aNo">إلغاء</button></div>`,(m,done)=>{ $('aNo').onclick=()=>done(null); m.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>done(files[+b.dataset.n])); });
    if(!pick) return; busy.show('قراءة الملف…'); let txt; try{ txt=await rText(pick); }catch{ busy.hide(); toast('تعذّرت قراءة الملف'); return; } busy.hide(); return importText(txt); }
  async function importFromUrl(){ const u=await askText('رابط ملف النسخة (JSON)','','https://…'); if(!u) return; if(!/^https?:\/\//i.test(u)){ toast('الرابط يجب أن يبدأ بـ http'); return; }
    busy.show('تنزيل النسخة…'); let txt; try{ const r=await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error('رمز '+r.status); txt=await r.text(); }catch(e){ busy.hide(); toast('تعذّر التنزيل: '+String(e&&e.message||e).slice(0,60)); return; } busy.hide(); return importText(txt); }

  // ---------- واجهة الإعدادات ----------
  const mb=n=>(n/1048576).toFixed(n>1e8?0:1);
  const ago=t=>{ if(!t) return 'لم يحدث بعد'; const m=Math.round((Date.now()-t)/6e4); if(m<1) return 'الآن'; if(m<60) return 'قبل '+m+' دقيقة'; const h=Math.round(m/60); if(h<24) return 'قبل '+h+' ساعة'; return 'قبل '+Math.round(h/24)+' يوم'; };
  function paint(){ const a=$('bkAuto'), i=$('bkInfo'); if(!a||!$('ovSet').classList.contains('show')) return;
    const nW=items.reduce((s,x)=>s+(x.works||[]).length,0), nP=items.reduce((s,x)=>s+(x.photos||[]).length,0), le=+LS.get('vkte_last_export','0');
    i.textContent=items.length+' ممثلة · '+nW+' عمل · '+nP+' صورة. بياناتك على هذا الجهاز فقط. آخر تصدير يدوي أو تلقائي: '+ago(le)+'.';
    if(navigator.storage&&navigator.storage.estimate) navigator.storage.estimate().then(e=>{ if(e&&e.usage) i.textContent+=' المساحة المستخدمة: '+mb(e.usage)+' MB.'; }).catch(()=>{});
    if(!IS_NATIVE){ a.textContent='النسخ التلقائي إلى مجلد Documents يعمل داخل التطبيق المثبّت (آيفون/أندرويد) فقط.'; $('bBkNow').hidden=true; $('bImpDir').hidden=true; return; }
    const where=root?((root===NATIVE.Directory.Documents?'Documents/':'التخزين الداخلي/')+DIR):'…';
    a.textContent='النسخ التلقائي: '+(running?'جارٍ… (متبقٍ '+st.left+')':ago(+LS.get('vkte_bk_at','0')))+' ← '+where+(st.err?' · خطأ: '+st.err:'')+(PLATFORM==='ios'?' (يظهر في تطبيق «الملفات»)':''); }
  $('bExp').onclick=exportNow; $('bExpEnc').onclick=exportEnc; $('bImpDir').onclick=importFromDir; $('bImpUrl').onclick=importFromUrl;
  $('bBkNow').onclick=()=>{ syncAll(true); toast('بدأ النسخ التلقائي الكامل'); setTimeout(paint,600); };
  $('fImp').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; importFile(f); };
  $('lImp').onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); $('fImp').click(); } };
  $('bSet').addEventListener('click',()=>{ setTimeout(paint,30); if(IS_NATIVE) getRoot().then(paint); });
  if(navigator.storage&&navigator.storage.persist) setTimeout(()=>{ navigator.storage.persist().catch(()=>{}); },3000);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden&&(dirty.size||gone.size||metaDirty)){ clearTimeout(timer); run(); } });
  return {exportNow,importJson,importText,importFile,tryRestore,syncAll,shareText,paint,PREF_KEYS};
})();

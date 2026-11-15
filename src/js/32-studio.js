/* ===== الاستديو: معرض صور شخصي ذكي لممثلات المفضلة =====
   المصادر (بمفاتيحك نفسها المحفوظة في الإعدادات):
     - ThePornDB: صور الممثلة الرسمية (image + posters) وصور مشاهدها الترويجية (background/posters) — كل مشهد = جلسة.
     - StashDB: صور الممثلة بأبعادها الحقيقية، وصور مشاهدها مع التاريخ والاستوديو — كل مشهد = جلسة.
     - Wikimedia Commons عبر Wikidata (أرشيف): فقط إن كان الكيان «ممثل/ة أفلام إباحية» وسنة الميلاد مطابقة.
   الصورة تُنسب للممثلة عبر معرّفها في المصدر (لا عبر اسم الملف). بوابة +18 تُطبَّق قبل أي بحث.
   التخزين: قاعدة IndexedDB مستقلة (vkte_studio) — لا تمس بيانات المكتبة ولا المزامنة.
   الصور نفسها روابطها الأصلية (لا نسخ مكررة على الجهاز)؛ «حفظ» ينزّل أعلى نسخة متاحة. */
const Studio=(()=>{
  // ---------- التخزين ----------
  const DBN='vkte_studio'; let dbp=null;
  const idb=()=>dbp||(dbp=new Promise((res,rej)=>{ const r=indexedDB.open(DBN,1);
    r.onupgradeneeded=()=>{ const d=r.result; if(!d.objectStoreNames.contains('img')){ const s=d.createObjectStore('img',{keyPath:'id'}); s.createIndex('pid','pid'); } if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); };
    r.onsuccess=()=>res(r.result); r.onerror=()=>{ dbp=null; rej(r.error); }; }));
  const run=(st,mode,fn)=>idb().then(d=>new Promise((res,rej)=>{ const t=d.transaction(st,mode), s=t.objectStore(st); let out; const q=fn(s); if(q) q.onsuccess=()=>{ out=q.result; }; t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); }));
  const kvGet=k=>run('kv','readonly',s=>s.get(k));
  const kvSet=(k,v)=>run('kv','readwrite',s=>{ s.put(v,k); });
  const putImgs=arr=>arr.length?run('img','readwrite',s=>{ arr.forEach(x=>s.put(x)); }):Promise.resolve();
  const delImgs=ids=>ids.length?run('img','readwrite',s=>{ ids.forEach(id=>s.delete(id)); }):Promise.resolve();

  // ---------- الحالة في الذاكرة ----------
  const IMG=new Map();               // id → سجل
  let loaded=false, S=null, KV={};    // الإعدادات + مفاتيح صغيرة (ألبومات، سجل العرض…)
  const DEF={freq:'day', src:{tpdb:1,tpdbs:1,stash:1,stashs:1,wiki:1}, minPx:0, perMax:600, probe:24, keepOnRemove:0, pages:4};
  async function load(){ if(loaded) return; const all=await run('img','readonly',s=>s.getAll()); (all||[]).forEach(x=>IMG.set(x.id,x));
    S=Object.assign({},DEF,(await kvGet('settings'))||{}); S.src=Object.assign({},DEF.src,S.src||{});
    for(const k of ['albums','shown','perfAt','status','wrong','hiddenSrc','picks']) KV[k]=(await kvGet(k))||(k==='albums'?[]:{});
    loaded=true; }
  const saveKV=k=>kvSet(k,KV[k]);

  // ---------- أدوات ----------
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const fnv=s=>{ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h.toString(36); };
  const nurl=u=>{ try{ const x=new URL(String(u).trim()); x.hash=''; x.host=x.host.toLowerCase(); return x.toString(); }catch{ return ''; } };
  const idOf=u=>'i'+fnv(nurl(u))+fnv(nurl(u).split('').reverse().join('')).slice(0,4);
  const today=()=>new Date().toISOString().slice(0,10);
  const yearOf=d=>{ const m=String(d||'').match(/^(\d{4})/); return m?+m[1]:0; };
  const px=x=>(x.w||0)*(x.h||0);
  const longSide=x=>Math.max(x.w||0,x.h||0);
  const perf=pid=>items.find(i=>i.id===pid);
  const pname=pid=>{ const p=perf(pid); return p?p.name:'—'; };
  const SRC={tpdb:'ThePornDB',tpdbs:'ThePornDB · مشهد',stash:'StashDB',stashs:'StashDB · مشهد',wiki:'Wikimedia'};
  const KIND={portrait:'بورتريه',promo:'ترويجية',still:'لقطة جلسة',archive:'أرشيف'};
  // بذرة يومية/أسبوعية ثابتة: نفس الاختيار طوال اليوم
  const seedRand=seed=>{ let s=(parseInt(fnv(String(seed)),36)%2147483646)+1; return ()=>(s=(s*48271)%2147483647)/2147483647; };   // Park–Miller: دائمًا بين 0 و1
  const weekKey=()=>{ const d=new Date(); const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day); const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return t.getUTCFullYear()+'-W'+Math.ceil(((t-y0)/864e5+1)/7); };

  // ---------- التقييم: الجودة، الندرة، الحداثة ----------
  const aspectGuess=x=>x.w&&x.h?x.w/x.h:(x.kind==='still'?16/9:x.kind==='archive'?3/4:2/3);
  function quality(x){ const p=px(x); let q=p?Math.min(100,Math.log2(p/1e5+1)*18):(x.src==='stash'||x.src==='wiki'?40:30);
    if(x.w&&x.h&&Math.min(x.w,x.h)<500) q-=25; return Math.round(q); }
  function rarity(x){ let r=0; if(!x.dups) r+=25; if(x.kind==='archive') r+=30; else if(x.kind==='still') r+=12;
    const y=yearOf(x.pub); if(y) r+=Math.min(30,Math.max(0,(new Date().getFullYear()-y)*3)); if(!x.seen) r+=20;
    r+={wiki:20,stashs:10,tpdbs:6,stash:4,tpdb:0}[x.src]||0; return r; }
  const visible=x=>!x.hide&&!x.wrong&&!x.dupOf&&!(KV.hiddenSrc||{})[x.src]&&perf(x.pid)&&!(S.minPx&&x.w&&longSide(x)<S.minPx);
  const list=()=>[...IMG.values()].filter(visible);

  // ---------- المصادر ----------
  let reqs=0, budget=0;
  async function getJ(url,opt,tries=2){ if(budget&&reqs>=budget) throw Object.assign(new Error('budget'),{budget:1}); reqs++;
    for(let k=0;;k++){ let r; try{ r=await fetch(url,opt); }catch(e){ if(k>=tries) throw e; await sleep(1500*(k+1)); continue; }
      if(r.status===429||r.status>=500){ if(k>=tries) throw httpErr(r.status); await sleep(4000*(k+1)); continue; }
      if(!r.ok) throw httpErr(r.status); await sleep(350); return r.json(); } }
  const pick=(...v)=>v.find(u=>typeof u==='string'&&/^https:\/\//i.test(u))||'';

  async function fromTpdb(it,add){ const id=encodeURIComponent(it.pdbId);
    if(S.src.tpdb){ const j=await getJ(API()+'/performers/'+id,{headers:hdr()}); const p=j.data||{};
      add({url:pick(p.image),prev:pick(p.thumbnail),src:'tpdb',kind:'portrait'});
      (p.posters||[]).forEach(x=>add({url:pick(typeof x==='string'?x:x&&(x.url||x.full||x.large)),prev:pick(x&&x.thumbnail,x&&x.medium),src:'tpdb',kind:'portrait'})); }
    if(S.src.tpdbs){ const first=!KV.perfAt[it.id]; const maxP=first?S.pages:1;
      for(let page=1;page<=maxP;page++){ const j=await getJ(API()+'/performers/'+id+'/scenes?page='+page+'&per_page=50',{headers:hdr()});
        let fresh=0;
        (j.data||[]).forEach(x=>{ const bg=x.background||{}, ps=x.posters||{}, site=(x.site&&x.site.name)||'', d=String(x.date||'').slice(0,10);
          const sess={k:'tpdb:'+(x.id||x._id||fnv(x.title||'')),t:String(x.title||'').trim(),d,st:site};
          if(add({url:pick(bg.full,bg.large,x.image),prev:pick(bg.large,bg.medium,bg.small),src:'tpdbs',kind:'still',sess,pub:d})) fresh++;
          if(add({url:pick(ps.full,ps.large,x.poster),prev:pick(ps.medium,ps.small),src:'tpdbs',kind:'promo',sess,pub:d})) fresh++; });
        const last=(j.meta&&(j.meta.last_page||j.meta.lastPage))||1; if(page>=last||(!first&&!fresh)) break; } } }

  async function fromStash(it,add){ const id=it.stashId;
    if(S.src.stash){ const d=await sdQ('query($id:ID!){findPerformer(id:$id){images{url width height}}}',{id}); reqs++;
      ((d.findPerformer&&d.findPerformer.images)||[]).forEach(m=>add({url:pick(m.url),src:'stash',kind:'portrait',w:m.width||0,h:m.height||0})); await sleep(350); }
    if(S.src.stashs){ const first=!KV.perfAt[it.id]; const maxP=first?Math.min(3,S.pages):1;
      for(let page=1;page<=maxP;page++){ if(budget&&reqs>=budget) break; reqs++;
        const d=await sdQ('query($id:ID!,$p:Int!){queryScenes(input:{performers:{value:[$id],modifier:INCLUDES},page:$p,per_page:40,sort:DATE,direction:DESC}){count scenes{id title release_date studio{name} images{url width height}}}}',{id,p:page});
        const q=d.queryScenes||{}; let fresh=0;
        (q.scenes||[]).forEach(s=>{ const dt=String(s.release_date||'').slice(0,10), sess={k:'stash:'+s.id,t:String(s.title||'').trim(),d:dt,st:(s.studio&&s.studio.name)||''};
          (s.images||[]).forEach(m=>{ if(add({url:pick(m.url),src:'stashs',kind:(m.width||0)>=(m.height||0)?'still':'promo',w:m.width||0,h:m.height||0,sess,pub:dt})) fresh++; }); });
        await sleep(350); if(page*40>=(q.count||0)||(!first&&!fresh)) break; } } }

  // Wikidata/Commons: يُقبل الكيان فقط إن كانت مهنته «ممثل/ة أفلام إباحية» (Q488111) وسنة الميلاد (إن وُجدت في الطرفين) مطابقة
  async function fromWiki(it,add){ if(!S.src.wiki) return; const by=yearOf(it.birth);
    const W='https://www.wikidata.org/w/api.php?format=json&origin=*&';
    const sr=await getJ(W+'action=wbsearchentities&type=item&language=en&limit=5&search='+encodeURIComponent(it.name));
    const ids=(sr.search||[]).map(x=>x.id).slice(0,5); if(!ids.length) return;
    const en=await getJ(W+'action=wbgetentities&props=claims&ids='+ids.join('|'));
    const vals=(c,p)=>((c&&c[p])||[]).map(x=>x.mainsnak&&x.mainsnak.datavalue&&x.mainsnak.datavalue.value).filter(Boolean);
    const files=[];
    Object.values(en.entities||{}).forEach(e=>{ const c=e.claims||{};
      if(!vals(c,'P106').some(v=>v.id==='Q488111')) return;
      const b=vals(c,'P569')[0]; const ey=b&&+String(b.time||'').slice(1,5); if(by&&ey&&by!==ey) return;
      vals(c,'P18').forEach(f=>files.push(f)); });
    if(!files.length) return;
    const ii=await getJ('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|size|timestamp&iiurlwidth=640&titles='+files.map(f=>encodeURIComponent('File:'+f)).join('|'));
    Object.values((ii.query&&ii.query.pages)||{}).forEach(p=>{ const i=(p.imageinfo||[])[0]; if(!i) return;
      add({url:pick(i.url),prev:pick(i.thumburl),src:'wiki',kind:'archive',w:i.width||0,h:i.height||0,bytes:i.size||0,pub:String(i.timestamp||'').slice(0,10),page:i.descriptionurl||''}); }); }

  // ---------- الاكتشاف ----------
  let busy=false, stopReq=false, prog={on:false,i:0,n:0,name:'',added:0};
  const listeners=new Set(); const emit=()=>listeners.forEach(f=>{ try{ f(); }catch{} });
  const FREQ=()=>({'12h':432e5,day:864e5,week:6048e5}[S.freq]||0);
  const due=()=>{ const ms=FREQ(); if(!ms) return false; return Date.now()-((KV.status&&KV.status.last)||0)>ms; };
  // ممثلة مستحقة للبحث: جديدة، أو مرّ عليها أكثر من وتيرة التحديث (التلقائي لا يعيد البحث لمن بُحث لها مؤخرًا)
  const perfDue=it=>{ const t=KV.perfAt[it.id]; if(!t) return true; const ms=FREQ()||864e5; return Date.now()-t>ms*0.9; };
  const linked=it=>!minorRec(it)&&((it.pdbId&&LS.get('vkte_key'))||(it.stashId&&LS.get('vkte_stash'))||S.src.wiki);

  let cur=null;
  // طلب ثانٍ أثناء بحث جارٍ ينتظره (ولو كان لممثلة معيّنة يُعاد بعده لها)
  function discover(opt={}){ if(cur) return opt.pid?cur.then(()=>discover(opt)):cur; cur=discover0(opt).finally(()=>{ cur=null; }); return cur; }
  async function discover0(opt={}){ await load(); if(busy) return 0; busy=true; stopReq=false; reqs=0; budget=opt.manual?600:220;
    const wrong=KV.wrong||{}; const now=Date.now();
    // الأولوية: الجديدات (لم يُبحث لهن) ثم الأقدم بحثًا
    const queue=items.filter(linked).filter(it=>opt.pid?it.id===opt.pid:opt.manual||perfDue(it)).sort((a,b)=>(KV.perfAt[a.id]||0)-(KV.perfAt[b.id]||0));
    prog={on:true,i:0,n:queue.length,name:'',added:0}; emit();
    let added=0; const newFor={}; const errs=new Set();
    try{
      for(const it of queue){ if(stopReq||(document.hidden&&!opt.manual)) break; prog.i++; prog.name=it.name; emit();
        const batch=[];
        const add=c=>{ if(!c.url) return false; const id=idOf(c.url); if(wrong[nurl(c.url)]) return false;
          const old=IMG.get(id);
          if(old){ let ch=false; ['w','h','bytes','pub','prev','page'].forEach(k=>{ if(!old[k]&&c[k]){ old[k]=c[k]; ch=true; } }); if(!old.sess&&c.sess){ old.sess=c.sess; ch=true; } if(ch) batch.push(old); return false; }
          if(S.minPx&&c.w&&Math.max(c.w,c.h)<S.minPx) return false;
          const x={id,pid:it.id,url:nurl(c.url),prev:c.prev||'',src:c.src,kind:c.kind,w:c.w||0,h:c.h||0,bytes:c.bytes||0,sess:c.sess||null,pub:c.pub||'',page:c.page||'',found:now,seen:0,like:0,hide:0,albums:[]};
          IMG.set(id,x); batch.push(x); added++; newFor[it.id]=(newFor[it.id]||0)+1; return true; };
        const jobs=[]; if(it.pdbId&&LS.get('vkte_key')) jobs.push(fromTpdb); if(it.stashId&&LS.get('vkte_stash')) jobs.push(fromStash); jobs.push(fromWiki);
        for(const j of jobs){ try{ await j(it,add); }catch(e){ if(e&&e.budget) break; errs.add(e&&e.status?('HTTP '+e.status):String(e&&e.message||e).slice(0,40)); } }
        // حُذفت أثناء البحث؟ لا نحفظ لها شيئًا
        if(!perf(it.id)){ batch.forEach(x=>{ if(x.pid===it.id&&!x.like&&!(x.albums||[]).length) IMG.delete(x.id); }); continue; }
        KV.perfAt[it.id]=Date.now(); await putImgs(batch); prog.added=added; emit();
        if(budget&&reqs>=budget) break; }
      await trim(); await saveKV('perfAt');
      if(!stopReq) await probe(opt.manual?S.probe*2:S.probe);
      dedupe();
    } finally {
      KV.status={last:Date.now(),added,errs:[...errs].slice(0,4),reqs}; await saveKV('status'); busy=false; prog.on=false; emit(); }
    if(added){ const top=Object.entries(newFor).sort((a,b)=>b[1]-a[1])[0]; LS.set('vkte_studio_new',String((+LS.get('vkte_studio_new')||0)+added)); dot();
      if(!isOpen()) toast('الاستديو: '+added+' صورة جديدة'+(top?' — منها '+top[1]+' لـ '+pname(top[0]):'')); }
    return added; }

  // حدّ الصور لكل ممثلة: يُحذف الأضعف (لا يمس المعجَبات ولا صور الألبومات)
  async function trim(){ const by={}; IMG.forEach(x=>(by[x.pid]=by[x.pid]||[]).push(x)); const drop=[];
    Object.values(by).forEach(a=>{ if(a.length<=S.perMax) return; a.sort((x,y)=>(quality(y)+rarity(y)/2)-(quality(x)+rarity(x)/2)); a.slice(S.perMax).forEach(x=>{ if(!x.like&&!(x.albums||[]).length) drop.push(x.id); }); });
    drop.forEach(id=>IMG.delete(id)); await delImgs(drop); }

  // ---------- الفحص: الأبعاد، الحجم، البصمة (dHash)، اللون السائد ----------
  async function blobOf(url){ if(IS_NATIVE) return fetchImage(url); const r=await fetch(url,{mode:'cors'}); if(!r.ok) throw httpErr(r.status); return r.blob(); }
  function analyze(bmp){ const c=document.createElement('canvas'); c.width=9; c.height=8; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(bmp,0,0,9,8);
    const d=g.getImageData(0,0,9,8).data; let bits='', R=0,G=0,B=0;
    for(let y=0;y<8;y++) for(let x=0;x<8;x++){ const i=(y*9+x)*4, j=i+4, l1=d[i]*.3+d[i+1]*.59+d[i+2]*.11, l2=d[j]*.3+d[j+1]*.59+d[j+2]*.11; bits+=l1>l2?'1':'0'; R+=d[i];G+=d[i+1];B+=d[i+2]; }
    let hex=''; for(let i=0;i<64;i+=4) hex+=parseInt(bits.slice(i,i+4),2).toString(16);
    const h=v=>Math.round(v/64).toString(16).padStart(2,'0'); return {dh:hex,col:'#'+h(R)+h(G)+h(B)}; }
  const dimsOnly=url=>new Promise(res=>{ const im=new Image(); im.decoding='async'; im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight}); im.onerror=()=>res(null); im.src=url; });
  async function probeOne(x){ try{ const b=await blobOf(x.url); const bmp=await createImageBitmap(b); Object.assign(x,{w:bmp.width,h:bmp.height,bytes:b.size},analyze(bmp)); bmp.close&&bmp.close(); }
    catch{ if(!x.w){ const d=await dimsOnly(x.url); if(d) Object.assign(x,d); else x.bad=(x.bad||0)+1; } x.dh=x.dh||'-'; } x.probed=Date.now(); }
  async function probe(n){ if(!n) return; if(navigator.connection&&navigator.connection.saveData) n=Math.min(n,6);
    const todo=[...IMG.values()].filter(x=>!x.probed&&!x.hide&&(x.bad||0)<2).sort((a,b)=>b.found-a.found).slice(0,n); const done=[];
    for(let i=0;i<todo.length;i+=3){ if(stopReq) break; await Promise.all(todo.slice(i,i+3).map(probeOne)); done.push(...todo.slice(i,i+3)); }
    await putImgs(done); }

  // التكرار: نفس البصمة تقريبًا (فرق ≤ 6 بت) لنفس الممثلة → تبقى الأعلى دقة وتُربط بقيتها بها (للمقارنة)
  const ham=(a,b)=>{ let d=0; for(let i=0;i<16;i++){ let v=parseInt(a[i],16)^parseInt(b[i],16); while(v){ d+=v&1; v>>=1; } } return d; };
  // نسخة من الصورة نفسها: بصمة شبه مطابقة + نفس نسبة الأبعاد. لقطات الجلسة الواحدة متقاربة بطبيعتها، فلا تُعدّ نسخًا إلا بتطابق تام
  const isDup=(a,b)=>{ if(a.w&&b.w&&Math.abs(a.w/a.h-b.w/b.h)>0.02*(a.w/a.h)) return false; const d=ham(a.dh,b.dh);
    if(a.sess&&b.sess&&a.sess.k===b.sess.k&&a.src===b.src) return d===0; return d<=4; };
  function dedupe(){ const by={}; IMG.forEach(x=>{ if(x.dh&&x.dh!=='-') (by[x.pid]=by[x.pid]||[]).push(x); }); const ch=[];
    Object.values(by).forEach(a=>{ a.sort((x,y)=>px(y)-px(x)||(y.bytes||0)-(x.bytes||0));
      a.forEach(x=>{ if(x.dupOf){ x.dupOf=''; } x.dups=0; });
      for(let i=0;i<a.length;i++){ if(a[i].dupOf) continue; for(let j=i+1;j<a.length;j++){ if(!a[j].dupOf&&isDup(a[i],a[j])){ a[j].dupOf=a[i].id; a[i].dups++; } } } ch.push(...a); });
    putImgs(ch); }
  const similar=x=>x.dh&&x.dh!=='-'?[...IMG.values()].filter(y=>y.id!==x.id&&visible(y)&&y.dh&&y.dh!=='-'&&ham(x.dh,y.dh)<=14).sort((a,b)=>ham(x.dh,a.dh)-ham(x.dh,b.dh)).slice(0,30):[];
  const versions=x=>{ const root=x.dupOf?IMG.get(x.dupOf):x; return root?[root,...[...IMG.values()].filter(y=>y.dupOf===root.id)].sort((a,b)=>px(b)-px(a)):[x]; };
  const sessionOf=x=>x.sess?list().filter(y=>y.sess&&y.sess.k===x.sess.k).sort((a,b)=>a.kind===b.kind?0:a.kind==='promo'?-1:1):[];

  // ---------- الاختيارات اليومية والأسبوعية (ثابتة طوال اليوم، وبلا تكرار) ----------
  async function markShown(ids){ const d=today(); let ch=false; ids.forEach(id=>{ if(KV.shown[id]!==d){ KV.shown[id]=d; ch=true; } });
    const cut=new Date(Date.now()-120*864e5).toISOString().slice(0,10); Object.keys(KV.shown).forEach(k=>{ if(KV.shown[k]<cut) delete KV.shown[k]; }); if(ch) saveKV('shown'); }
  const shownBefore=id=>{ const d=KV.shown[id]; return d&&d!==today(); };
  function daily(key,make){ const d=key.includes('W')?weekKey():today(), k=key+'|'+d; const prev=KV.picks[k];
    if(prev){ const v=prev.map(id=>IMG.get(id)).filter(x=>x&&visible(x)); if(v.length) return v; }
    const v=make(seedRand(k)); KV.picks[k]=v.map(x=>x.id); Object.keys(KV.picks).forEach(o=>{ if(!o.endsWith(d)&&!o.includes('-W')) delete KV.picks[o]; }); saveKV('picks'); return v; }
  function spread(arr,n,per=3){ const c={}, out=[]; for(const x of arr){ if(out.length>=n) break; if((c[x.pid]=(c[x.pid]||0)+1)>per) continue; out.push(x); } return out; }
  const fresh=l=>l.filter(x=>!shownBefore(x.id));
  const SEL={
    potd:()=>daily('potd',r=>{ const l=fresh(list()).sort((a,b)=>quality(b)+rarity(b)/3+r()*20-(quality(a)+rarity(a)/3+r()*20)); return l.slice(0,1); }),
    today:()=>daily('today',r=>spread(fresh(list()).map(x=>[x,quality(x)+rarity(x)/2+r()*45]).sort((a,b)=>b[1]-a[1]).map(a=>a[0]),18)),
    gem:()=>daily('gem',r=>fresh(list()).filter(x=>!x.seen).sort((a,b)=>rarity(b)+r()*15-(rarity(a)+r()*15)).slice(0,1)),
    latest:()=>list().sort((a,b)=>(b.pub||'').localeCompare(a.pub||'')||b.found-a.found),
    added:()=>list().sort((a,b)=>b.found-a.found),
    rare:()=>list().sort((a,b)=>rarity(b)-rarity(a)),
    best:()=>list().sort((a,b)=>quality(b)+(b.like?15:0)-(quality(a)+(a.like?15:0))),
    hq:()=>list().filter(x=>px(x)).sort((a,b)=>px(b)-px(a)),
    past:()=>list().filter(x=>yearOf(x.pub)).sort((a,b)=>a.pub.localeCompare(b.pub)),
    week:()=>spread(list().filter(x=>Date.now()-x.found<7*864e5).sort((a,b)=>quality(b)-quality(a)),24,4),
    liked:()=>[...IMG.values()].filter(x=>x.like&&!x.wrong).sort((a,b)=>b.like-a.like),
  };
  function sessions(){ const m=new Map(); list().forEach(x=>{ if(!x.sess) return; const k=x.sess.k; if(!m.has(k)) m.set(k,{k,t:x.sess.t,d:x.sess.d,st:x.sess.st,pid:x.pid,imgs:[]}); m.get(k).imgs.push(x); });
    return [...m.values()].filter(s=>s.imgs.length>=2).sort((a,b)=>(b.d||'').localeCompare(a.d||'')); }
  const sessWeek=()=>{ const l=sessions().filter(s=>s.imgs.length>=3); if(!l.length) return null; const k=KV.picks['sw|'+weekKey()]; const f=l.find(s=>s.k===k); if(f) return f;
    const s=l[Math.floor(seedRand('sw'+weekKey())()*Math.min(l.length,40))]; KV.picks['sw|'+weekKey()]=s.k; saveKV('picks'); return s; };
  // فعالية الأسبوع: تتغيّر تلقائيًا كل أسبوع
  const EVENTS=[
    ['أسبوع البورتريه','صور الممثلات الرسمية فقط',x=>x.kind==='portrait'],
    ['أسبوع الدقة العالية','أكبر من 2500 بكسل',x=>longSide(x)>=2500],
    ['أسبوع الأرشيف','صور عمرها خمس سنوات فأكثر',x=>yearOf(x.pub)&&yearOf(x.pub)<=new Date().getFullYear()-5],
    ['أسبوع الملصقات','الصور الترويجية والإعلانية',x=>x.kind==='promo'],
    ['أسبوع النجمات','صور الأعلى تقييمًا في مكتبتك',x=>{ const p=perf(x.pid); return p&&+p.rating>=4.5; }],
    ['أسبوع لم ترها بعد','صور لم تظهر لك من قبل',x=>!x.seen],
  ];
  const eventNow=()=>{ const n=+weekKey().split('W')[1]||0; return EVENTS[n%EVENTS.length]; };
  const bdayMonth=()=>{ const m=String(new Date().getMonth()+1).padStart(2,'0'); return new Set(items.filter(i=>String(i.birth||'').slice(5,7)===m).map(i=>i.id)); };

  // ---------- العرض ----------
  const root=()=>$('mStudio');
  let view={v:'home'}, stack=[], tab='home';
  const isOpen=()=>$('ovStudio').classList.contains('show');
  function dot(){ const d=$('sDot'); if(d) d.style.display=(+LS.get('vkte_studio_new')||0)>0?'':'none'; }
  async function open(v){ await load(); LS.set('vkte_studio_new','0'); dot(); if(v){ stack=[]; view=v; } $('ovStudio').classList.add('show'); draw(); root().scrollTop=0;
    if(due()&&!busy) discover(); }
  const go=v=>{ stack.push({view,scroll:root().scrollTop}); view=v; draw(); root().scrollTop=0; };
  const back=()=>{ const p=stack.pop(); if(!p){ view={v:'home'}; draw(); return; } view=p.view; draw(); root().scrollTop=p.scroll; };

  // تخطيط «مبرّر»: صفوف بارتفاع متقارب تملأ العرض (بدل الشبكة الثابتة)
  function justify(arr,W,H,gap=4){ const rows=[]; let row=[], sum=0;
    arr.forEach(x=>{ const a=Math.max(.45,Math.min(2.4,aspectGuess(x))); row.push([x,a]); sum+=a; if(sum*H+(row.length-1)*gap>=W){ const h=(W-(row.length-1)*gap)/sum; rows.push({h,row}); row=[]; sum=0; } });
    if(row.length) rows.push({h:Math.min(H,(W-(row.length-1)*gap)/sum),row,last:1}); return rows; }
  const thumb=x=>x.prev||x.url;
  const imgTag=(x,w,h,cls='')=>`<button type="button" class="sj ${cls}" data-si="${x.id}" style="width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;${x.col?'background:'+x.col:''}"><img loading="lazy" decoding="async" src="${esc(thumb(x))}" alt="" onload="this.classList.add('ok')" onerror="Studio._err(this,'${x.id}')">${x.like?'<i class="sl">♥</i>':''}</button>`;
  function gridHTML(arr,key,H){ const W=Math.max(280,(root().clientWidth||360)-28); H=H||(W<500?150:W<900?200:240);
    const rows=justify(arr.slice(0,LIM[key]||60),W,H);
    return `<div class="sgrid" data-key="${key}">`+rows.map(r=>`<div class="srow" style="height:${r.h.toFixed(1)}px">`+r.row.map(([x,a])=>imgTag(x,a*r.h,r.h)).join('')+'</div>').join('')+
      (arr.length>(LIM[key]||60)?`<button type="button" class="btn smore" data-more="${key}">عرض المزيد (${arr.length-(LIM[key]||60)})</button>`:'')+'</div>'; }
  const LIM={}; let lists={};   // القوائم المعروضة حاليًا (لفتحها في العارض بنفس الترتيب)
  const sec=(t,sub,body,more)=>`<section class="ssec"><div class="ssh"><div><h3>${t}</h3>${sub?`<small>${sub}</small>`:''}</div>${more?`<button type="button" class="slink" data-tab="${more}">الكل ›</button>`:''}</div>${body}</section>`;
  const strip=(arr,key)=>{ lists[key]=arr; return `<div class="sstrip">`+arr.slice(0,20).map(x=>`<button type="button" class="sst" data-si="${x.id}" data-k="${key}" style="${x.col?'background:'+x.col:''}"><img loading="lazy" src="${esc(thumb(x))}" alt="" onload="this.classList.add('ok')" onerror="Studio._err(this,'${x.id}')"><span>${esc(pname(x.pid))}</span></button>`).join('')+'</div>'; };
  const grid=(arr,key,H)=>{ lists[key]=arr; return gridHTML(arr,key,H); };
  const TABS=[['home','اكتشاف'],['latest','الأحدث'],['rare','النادرة'],['best','الأفضل'],['sess','الجلسات'],['perfs','الممثلات'],['liked','أعجبتني'],['albums','ألبوماتي']];

  function statusLine(){ const st=KV.status||{}; if(prog.on) return `<span class="spin"></span> جارٍ البحث: ${esc(prog.name)} (${prog.i}/${prog.n})${prog.added?' · '+prog.added+' جديدة':''} <button type="button" class="slink" data-act="stop">إيقاف</button>`;
    return st.last?`آخر تحديث ${ago(st.last)}${st.added!=null?' · '+st.added+' جديدة':''}${st.errs&&st.errs.length?' · <span class="swarn">'+esc(st.errs.join('، '))+'</span>':''}`:'لم يبدأ البحث بعد'; }
  const ago=t=>{ const m=Math.round((Date.now()-t)/6e4); return m<1?'الآن':m<60?'قبل '+m+' د':m<1440?'قبل '+Math.round(m/60)+' س':'قبل '+Math.round(m/1440)+' يوم'; };

  function head(title,sub,withBack){ return `<div class="shead">${withBack?`<button type="button" class="ib glass" data-act="back" aria-label="رجوع">${icon('chev')}</button>`:''}<div class="sht"><h2>${title}</h2>${sub?`<small>${sub}</small>`:''}</div>
    <button type="button" class="ib glass" data-act="refresh" aria-label="تحديث">${icon('refresh')}</button><button type="button" class="ib glass" data-act="settings" aria-label="إعدادات الاستديو">${icon('set')}</button></div>`; }

  function drawHome(){ const all=list();
    if(!all.length){ const n=items.filter(linked).length;
      return `<div class="sempty"><div class="sorb"></div><h3>الاستديو جاهز</h3><p>${n?`سأبحث عن صور ${n} ممثلة من مفضلتك في ThePornDB وStashDB وأرشيف Wikimedia.`:'أضف مفتاح ThePornDB أو StashDB من الإعدادات، واربط ممثلاتك بهما، ليبدأ الاستديو بجمع صورهن.'}</p>
        ${n?`<button type="button" class="btn gold" data-act="refresh">${busy?'جارٍ البحث…':'ابدأ الاكتشاف'}</button>`:''}</div>`; }
    const potd=SEL.potd()[0], gem=SEL.gem()[0], td=SEL.today(), sw=sessWeek(), ev=eventNow(), evl=spread(list().filter(ev[2]).sort((a,b)=>quality(b)-quality(a)),12), bd=bdayMonth();
    const bdl=spread(list().filter(x=>bd.has(x.pid)).sort((a,b)=>quality(b)-quality(a)),12,4);
    const pod=(()=>{ const c={}; all.forEach(x=>c[x.pid]=(c[x.pid]||0)+1); const ps=Object.keys(c).filter(k=>c[k]>=4); if(!ps.length) return null; return ps[Math.floor(seedRand('pod'+today())()*ps.length)]; })();
    markShown([potd,gem,...td].filter(Boolean).map(x=>x.id));
    lists.potd=potd?[potd]:[]; lists.gem=gem?[gem]:[];
    let h='';
    if(potd) h+=`<button type="button" class="shero" data-si="${potd.id}" data-k="potd" style="${potd.col?'--c:'+potd.col:''}"><img src="${esc(potd.url)}" alt="" onload="this.classList.add('ok')" onerror="this.src='${esc(thumb(potd))}'"><div class="shc"><small>صورة اليوم</small><b>${esc(pname(potd.pid))}</b><span>${esc(meta(potd))}</span></div></button>`;
    h+=sec('اكتشاف اليوم','مجموعة جديدة كل يوم — بلا تكرار لما رأيته',grid(td,'today'));
    if(gem) h+=sec('جوهرة مخفية','صورة نادرة لم تظهر لك من قبل',`<button type="button" class="sgem" data-si="${gem.id}" data-k="gem"><img loading="lazy" src="${esc(thumb(gem))}" alt="" onload="this.classList.add('ok')"><span>${esc(pname(gem.pid))} · ${esc(KIND[gem.kind]||'')}${gem.pub?' · '+esc(gem.pub.slice(0,4)):''}</span></button>`);
    if(sw) h+=sec('جلسة الأسبوع',esc([sw.t,sw.st,pname(sw.pid),sw.d&&sw.d.slice(0,4)].filter(Boolean).join(' · ')),grid(sw.imgs,'sw',120)+`<button type="button" class="slink" data-sess="${esc(sw.k)}">افتح الجلسة كاملة ›</button>`);
    if(evl.length>=4) h+=sec('فعالية الأسبوع: '+ev[0],ev[1],strip(evl,'ev'));
    if(bdl.length>=3) h+=sec('🎂 احتفال الشهر','صور ممثلات عيد ميلادهن هذا الشهر',strip(bdl,'bd'));
    if(pod){ const pl=list().filter(x=>x.pid===pod).sort((a,b)=>quality(b)-quality(a)); h+=sec('ممثلة اليوم: '+esc(pname(pod)),pl.length+' صورة في الاستديو',strip(pl,'pod')+`<button type="button" class="slink" data-perf="${esc(pod)}">معرضها الكامل ›</button>`); }
    h+=sec('أحدث الصور','حسب تاريخ النشر',strip(SEL.latest(),'latest'),'latest');
    const wk=SEL.week(); if(wk.length>=4) h+=sec('أرشيف الأسبوع','أفضل ما اكتُشف خلال 7 أيام',strip(wk,'week'));
    const pa=SEL.past(); if(pa.length>=4) h+=sec('عودة إلى الماضي','أقدم الصور المؤرّخة',strip(pa,'past'));
    const hq=SEL.hq(); if(hq.length>=4) h+=sec('الأعلى جودة','أكبر الصور دقةً',strip(hq,'hq'),'best');
    h+=sec('الصور النادرة','قليلة الانتشار، قديمة، أو لم ترها',strip(SEL.rare(),'rare'),'rare');
    return h; }

  const safe=f=>{ try{ return f(); }catch(e){ console.warn('studio',e); return '<p class="snote">تعذّر عرض هذا القسم.</p>'; } };
  function meta(x){ return [SRC[x.src],KIND[x.kind],x.w?'⁦'+x.w+'×'+x.h+'⁩':'',x.pub?x.pub.slice(0,4):''].filter(Boolean).join(' · '); }

  function drawPerfs(){ const c={}; list().forEach(x=>(c[x.pid]=c[x.pid]||[]).push(x));
    const ps=Object.keys(c).map(pid=>({pid,n:c[pid].length,top:c[pid].sort((a,b)=>quality(b)-quality(a))[0]})).sort((a,b)=>b.n-a.n);
    const pend=items.filter(it=>linked(it)&&!KV.perfAt[it.id]).length;
    return (pend?`<p class="snote">${pend} ممثلة بانتظار البحث — سيُكمل الاستديو تلقائيًا.</p>`:'')+`<div class="sperfs">`+ps.map(p=>`<button type="button" class="spf" data-perf="${esc(p.pid)}"><img loading="lazy" src="${esc(thumb(p.top))}" alt="" onload="this.classList.add('ok')"><b>${esc(pname(p.pid))}</b><small>${p.n} صورة</small></button>`).join('')+'</div>'; }

  function drawPerf(pid,sub){ const p=perf(pid); if(!p) return '<p class="snote">الممثلة لم تعد في مكتبتك.</p>';
    const all=list().filter(x=>x.pid===pid); sub=sub||'latest';
    const by={latest:()=>[...all].sort((a,b)=>(b.pub||'').localeCompare(a.pub||'')||b.found-a.found),rare:()=>[...all].sort((a,b)=>rarity(b)-rarity(a)),best:()=>[...all].sort((a,b)=>quality(b)-quality(a)),portrait:()=>all.filter(x=>x.kind==='portrait'),promo:()=>all.filter(x=>x.kind==='promo'),still:()=>all.filter(x=>x.kind==='still'),archive:()=>all.filter(x=>x.kind==='archive')};
    const f=view.src?(x=>x.src===view.src):()=>true, l=(by[sub]||by.latest)().filter(f);
    const ss=sessions().filter(s=>s.pid===pid).slice(0,12);
    const chips=[['latest','الأحدث'],['best','الأفضل'],['rare','الأندر'],['portrait','بورتريه'],['promo','ترويجية'],['still','لقطات'],['archive','أرشيف']].filter(([k])=>by[k]().length).map(([k,t])=>`<button type="button" class="chip ${sub===k?'on':''}" data-psub="${k}">${t}</button>`).join('');
    const srcs=[...new Set(all.map(x=>x.src))].map(s=>`<button type="button" class="chip ${view.src===s?'on':''}" data-psrc="${s}">${SRC[s]}</button>`).join('');
    return `<div class="spfhead"><img src="${esc(pic(p))}" alt=""><div><b>${esc(p.name)}</b><small>${all.length} صورة · ${ss.length} جلسة · آخر بحث ${KV.perfAt[pid]?ago(KV.perfAt[pid]):'—'}</small>
      <div class="sbtns"><button type="button" class="btn" data-od="${esc(pid)}">صفحة الممثلة</button><button type="button" class="btn" data-act="perfscan" data-pid="${esc(pid)}">ابحث الآن</button></div></div></div>
      <div class="schips">${chips}</div>${srcs?`<div class="schips">${srcs}</div>`:''}${grid(l,'perf:'+pid)}
      ${ss.length?sec('جلساتها','',`<div class="ssess">`+ss.map(sessCard).join('')+'</div>'):''}`; }

  const sessCard=s=>`<button type="button" class="sses" data-sess="${esc(s.k)}"><div class="ssm">${s.imgs.slice(0,3).map(x=>`<img loading="lazy" src="${esc(thumb(x))}" alt="" onload="this.classList.add('ok')">`).join('')}</div><b>${esc(s.t||'جلسة')}</b><small>${esc([pname(s.pid),s.st,s.d&&s.d.slice(0,4)].filter(Boolean).join(' · '))} · ${s.imgs.length}</small></button>`;
  function drawSessList(){ const l=sessions(); return l.length?`<div class="ssess">`+l.slice(0,LIM.sess||40).map(sessCard).join('')+'</div>'+(l.length>(LIM.sess||40)?`<button type="button" class="btn smore" data-more="sess">عرض المزيد</button>`:''):'<p class="snote">لا جلسات بعد.</p>'; }
  function drawSess(k){ const s=sessions().find(x=>x.k===k); if(!s) return '<p class="snote">الجلسة غير متاحة.</p>';
    return `<p class="snote">${esc([s.st,s.d,pname(s.pid)].filter(Boolean).join(' · '))} · ${s.imgs.length} صورة</p>`+grid(s.imgs,'sess:'+k,200)+`<button type="button" class="btn" data-perf="${esc(s.pid)}">معرض ${esc(pname(s.pid))}</button>`; }

  function drawAlbums(){ const al=KV.albums||[];
    return `<button type="button" class="btn gold" data-act="newalbum">ألبوم جديد</button><div class="ssess" style="margin-top:12px">`+(al.length?al.map(a=>{ const im=a.ids.map(id=>IMG.get(id)).filter(Boolean);
      return `<button type="button" class="sses" data-album="${a.id}"><div class="ssm">${im.slice(0,3).map(x=>`<img loading="lazy" src="${esc(thumb(x))}" alt="" onload="this.classList.add('ok')">`).join('')||'<i class="sae">＋</i>'}</div><b>${esc(a.name)}</b><small>${im.length} صورة</small></button>`; }).join(''):'')+'</div>'+(al.length?'':'<p class="snote">أنشئ ألبومًا، ثم أضف إليه الصور من زر ＋ في العارض.</p>'); }
  function drawAlbum(id){ const a=(KV.albums||[]).find(x=>x.id===id); if(!a) return '';
    const im=a.ids.map(x=>IMG.get(x)).filter(x=>x&&!x.wrong);
    return `<div class="sbtns"><button type="button" class="btn" data-act="renalbum" data-id="${a.id}">إعادة تسمية</button><button type="button" class="btn danger" data-act="delalbum" data-id="${a.id}">حذف الألبوم</button></div>`+(im.length?grid(im,'album:'+id):'<p class="snote">الألبوم فارغ.</p>'); }

  function drawSettings(){ const sz=[...IMG.values()].length, liked=SEL.liked().length;
    const opt=(name,cur,arr)=>`<select class="in" data-set="${name}">`+arr.map(([v,t])=>`<option value="${v}" ${String(cur)===String(v)?'selected':''}>${t}</option>`).join('')+'</select>';
    const sw=(k,t)=>`<label class="srcsw"><input type="checkbox" data-src="${k}" ${S.src[k]?'checked':''}> ${t}</label>`;
    const st=KV.status||{};
    return `<div class="sset">
      <h4>الحالة</h4><p>${statusLine()}${st.reqs?' · '+st.reqs+' طلبًا في آخر تحديث':''}</p>
      <h4>وتيرة البحث التلقائي</h4>${opt('freq',S.freq,[['manual','يدويًا فقط'],['12h','كل 12 ساعة'],['day','يوميًا'],['week','أسبوعيًا']])}
      <h4>المصادر</h4>${sw('tpdb','ThePornDB — صور الممثلة')}${sw('tpdbs','ThePornDB — صور المشاهد')}${sw('stash','StashDB — صور الممثلة')}${sw('stashs','StashDB — صور المشاهد')}${sw('wiki','Wikimedia Commons — أرشيف')}
      <p class="snote">${LS.get('vkte_key')?'':'⚠ لا مفتاح ThePornDB. '}${LS.get('vkte_stash')?'':'⚠ لا مفتاح StashDB. '}المفاتيح من إعدادات التطبيق.</p>
      <h4>أقل جودة مقبولة</h4>${opt('minPx',S.minPx,[[0,'كل الصور'],[800,'800 بكسل فأكثر'],[1500,'1500 بكسل فأكثر'],[2500,'2500 بكسل فأكثر']])}
      <h4>فحص الأبعاد والتكرار في كل تحديث</h4>${opt('probe',S.probe,[[0,'متوقف (أقل استهلاكًا للإنترنت)'],[12,'12 صورة'],[24,'24 صورة'],[60,'60 صورة']])}
      <h4>الحد الأقصى لكل ممثلة</h4>${opt('perMax',S.perMax,[[200,'200'],[600,'600'],[1500,'1500']])}
      <h4>عند حذف ممثلة من المفضلة</h4>${opt('keepOnRemove',S.keepOnRemove,[[0,'احذف صورها (تبقى المعجَبات وصور الألبومات)'],[1,'احتفظ بكل صورها']])}
      <h4>التخزين</h4><p>${sz} صورة مفهرسة · ${liked} معجَبة · ${(KV.albums||[]).length} ألبوم <span id="sEst"></span></p>
      <div class="sbtns"><button type="button" class="btn" data-act="unhide">إظهار الصور المخفية</button><button type="button" class="btn danger" data-act="clear">مسح الفهرس (تبقى المعجَبات والألبومات)</button></div>
      ${Object.keys(KV.hiddenSrc||{}).length?`<p class="snote">مصادر مخفية: ${Object.keys(KV.hiddenSrc).map(k=>SRC[k]).join('، ')} <button type="button" class="slink" data-act="unhidesrc">إظهارها</button></p>`:''}
    </div>`; }

  function draw(){ const m=root(); if(!m) return; lists={};
    let title='الاستديو', sub=`${list().length} صورة · ${new Set(list().map(x=>x.pid)).size} ممثلة`, body='', back=stack.length>0||view.v!=='home';
    const v=view.v;
    if(v==='home'){ body=`<div class="stabs">`+TABS.map(([k,t])=>`<button type="button" class="chip ${tab===k?'on':''}" data-tab="${k}">${t}</button>`).join('')+'</div>';
      body+= tab==='home'?safe(drawHome): tab==='sess'?drawSessList(): tab==='perfs'?drawPerfs(): tab==='albums'?drawAlbums():
        (()=>{ const l=SEL[tab]?SEL[tab]():[]; return l.length?grid(l,tab):`<p class="snote">${tab==='liked'?'اضغط ♥ على أي صورة لتظهر هنا.':'لا صور بعد.'}</p>`; })(); back=false; }
    else if(v==='perf'){ title=esc(pname(view.pid)); sub='معرض الممثلة'; body=drawPerf(view.pid,view.sub); }
    else if(v==='sess'){ const s=sessions().find(x=>x.k===view.k); title=esc((s&&s.t)||'جلسة'); sub='جلسة تصوير'; body=drawSess(view.k); }
    else if(v==='album'){ const a=(KV.albums||[]).find(x=>x.id===view.id); title=esc(a?a.name:'ألبوم'); sub='ألبوم'; body=drawAlbum(view.id); }
    else if(v==='list'){ title=esc(view.t); sub=view.sub||''; body=grid(view.l(),'list'); }
    else if(v==='settings'){ title='إعدادات الاستديو'; sub=''; body=drawSettings(); }
    const ae=document.activeElement, had=ae&&m.contains(ae), key=had?['si','tab','act','perf','sess','album','psub','psrc','more'].map(k=>ae.dataset[k]?`[data-${k}="${CSS.escape(ae.dataset[k])}"]`:'').find(Boolean):'';
    m.innerHTML=head(title,sub,back)+`<div class="sstat" id="sStat">${statusLine()}</div>`+body;
    if(document.documentElement.classList.contains('tvapp')&&isOpen()&&!Gallery.isOpen()){ const el=(key&&m.querySelector(key)); if(el) try{ el.focus({preventScroll:true}); }catch{} else if(had||!m.contains(document.activeElement)) focusFirst(); }
    if(v==='settings'&&navigator.storage&&navigator.storage.estimate) navigator.storage.estimate().then(e=>{ const el=$('sEst'); if(el&&e.usage) el.textContent='· مساحة التطبيق المستخدمة '+(e.usage/1048576).toFixed(0)+' MB'; }).catch(()=>{}); }

  listeners.add(()=>{ if(!isOpen()) return; const s=$('sStat'); if(s) s.innerHTML=statusLine(); if(!prog.on&&view.v!=='settings'){ const t=root().scrollTop; draw(); root().scrollTop=t; } });

  // ---------- العارض ----------
  function bar(it){ const x=IMG.get(it.id); if(!x) return '';
    const b=(k,ic,t,on)=>`<button type="button" class="lab ${on?'on':''}" data-la="${k}" title="${t}" aria-label="${t}">${ic}</button>`;
    return b('like',x.like?'♥':'♡','أعجبتني',x.like)+b('album','＋','أضف لألبوم')+b('save','⬇','حفظ بأعلى جودة')+b('share','⇪','مشاركة')+b('info','ℹ','معلومات الصورة')+
      b('perf','👤','صفحة الممثلة')+(x.sess?b('sess','🎞','بقية الجلسة'):'')+(x.dh&&x.dh!=='-'?b('sim','≈','صور مشابهة'):'')+(x.dups||x.dupOf?b('ver','⧉','نسخ بدقات مختلفة'):'')+b('hide','🚫','إخفاء')+b('wrong','⚠','منسوبة خطأ'); }
  function view_(arr,i){ const l=arr.filter(Boolean); if(!l.length) return;
    Gallery.open(l.map(x=>({src:x.url,cap:pname(x.pid)+' · '+meta(x),id:x.id})),i,{bar,onAction:act,
      onShow:it=>{ const x=IMG.get(it.id); if(x){ x.seen=(x.seen||0)+1; x.last=Date.now(); putImgs([x]); } },
      onLoad:(it,img)=>{ const x=IMG.get(it.id); if(x&&(!x.w||img.naturalWidth*img.naturalHeight>px(x))){ x.w=img.naturalWidth; x.h=img.naturalHeight; putImgs([x]); } },
      onClose:()=>{ if(isOpen()){ const t=root().scrollTop; draw(); root().scrollTop=t; } } }); }
  async function act(k,it){ const x=IMG.get(it.id); if(!x) return;
    if(k==='like'){ x.like=x.like?0:Date.now(); await putImgs([x]); Gallery.refreshBar(); toast(x.like?'أُضيفت إلى «أعجبتني»':'أُزيلت من «أعجبتني»'); }
    else if(k==='album'){ const al=KV.albums||[]; const name=al.length?await askShow(`<h2>أضف إلى ألبوم</h2><div class="salist">${al.map(a=>`<button type="button" class="btn" data-a="${a.id}">${a.ids.includes(x.id)?'✓ ':''}${esc(a.name)}</button>`).join('')}</div><div class="actions"><button class="btn" id="aNo">إلغاء</button><button class="btn gold" id="aNew">ألبوم جديد</button></div>`,(m,done)=>{ m.onclick=e=>{ const b=e.target.closest('[data-a]'); if(b) done(b.dataset.a); }; $('aNo').onclick=()=>done(null); $('aNew').onclick=()=>done('+'); }):'+';
      if(!name) return; let a=al.find(z=>z.id===name);
      if(name==='+'){ const t=await askText('اسم الألبوم','',''); if(!t) return; a={id:'a'+Date.now().toString(36),name:t,ids:[],created:Date.now()}; al.push(a); KV.albums=al; }
      if(a.ids.includes(x.id)){ a.ids=a.ids.filter(z=>z!==x.id); x.albums=(x.albums||[]).filter(z=>z!==a.id); toast('أُزيلت من «'+a.name+'»'); }
      else { a.ids.unshift(x.id); x.albums=[...new Set([...(x.albums||[]),a.id])]; toast('أُضيفت إلى «'+a.name+'»'); }
      await saveKV('albums'); await putImgs([x]); }
    else if(k==='save') save(x);
    else if(k==='share') share(x);
    else if(k==='info'){ const p=perf(x.pid); askNote([`الممثلة: ${p?p.name:'—'}`,`المصدر: ${SRC[x.src]}`,`النوع: ${KIND[x.kind]||'—'}`,x.w?`الأبعاد: ⁦${x.w}×${x.h}⁩ (${(px(x)/1e6).toFixed(1)} ميغابكسل)`:'الأبعاد: تُعرف بعد التحميل',x.bytes?`الحجم: ${(x.bytes/1048576).toFixed(2)} MB`:'',x.sess?`الجلسة: ${x.sess.t||'—'}${x.sess.st?' · '+x.sess.st:''}`:'',x.pub?`تاريخ النشر: ${x.pub}`:'',`اكتُشفت: ${new Date(x.found).toLocaleDateString('ar')}`,`ظهرت لك: ${x.seen||0} مرة`,`الرابط الأصلي: ${x.page||x.url}`].filter(Boolean).join('\n')); }
    else if(k==='perf'){ Gallery.close(); go({v:'perf',pid:x.pid}); }
    else if(k==='sess'){ Gallery.close(); go({v:'sess',k:x.sess.k}); }
    else if(k==='sim'){ const l=similar(x); if(!l.length){ toast('لا صور مشابهة بعد'); return; } Gallery.close(); go({v:'list',t:'صور مشابهة',sub:pname(x.pid),l:()=>similar(x)}); }
    else if(k==='ver'){ const l=versions(x); Gallery.close(); go({v:'list',t:'نسخ الصورة نفسها',sub:'مرتبة من الأعلى دقة — الأولى هي المعتمدة',l:()=>versions(x)}); }
    else if(k==='hide'){ const c=await askShow(`<h2>إخفاء</h2><div class="actions" style="flex-direction:column"><button class="btn" id="h1">إخفاء هذه الصورة</button><button class="btn" id="h2">إخفاء كل صور ${esc(SRC[x.src])}</button><button class="btn" id="aNo">إلغاء</button></div>`,(m,done)=>{ $('h1').onclick=()=>done(1); $('h2').onclick=()=>done(2); $('aNo').onclick=()=>done(0); });
      if(c===1){ x.hide=1; await putImgs([x]); toast('أُخفيت'); Gallery.show(Gallery.current().idx+1); }
      else if(c===2){ KV.hiddenSrc[x.src]=1; await saveKV('hiddenSrc'); toast('أُخفي المصدر — يمكنك إظهاره من إعدادات الاستديو'); Gallery.close(); } }
    else if(k==='wrong'){ if(!await askConfirm('هذه الصورة ليست لـ '+pname(x.pid)+'؟ ستُحذف ولن تُضاف مجددًا.','نعم، منسوبة خطأ',true)) return;
      x.wrong=1; KV.wrong[x.url]=Date.now(); await saveKV('wrong'); await putImgs([x]); toast('سُجّلت كخطأ ولن تظهر'); Gallery.show(Gallery.current().idx+1); } }

  async function blobForSave(x){ try{ return await fetchImage(x.url); }catch{ return null; } }
  async function save(x){ toast('جارٍ تنزيل أعلى نسخة…'); const best=versions(x)[0]||x; const b=await blobForSave(best);
    const ext=(b&&b.type.split('/')[1]||'jpg').replace('jpeg','jpg'), name=(pname(x.pid)+'-'+best.id).replace(/[^\w؀-ۿ-]+/g,'_')+'.'+ext;
    if(!b){ window.open(best.url,'_blank'); return; }
    if(IS_NATIVE){ try{ const d=await PB.blobToData(b); const r=await NATIVE.Filesystem.writeFile({path:name,data:String(d).split(',')[1],directory:NATIVE.Directory.Cache});
        await NATIVE.Share.share({title:name,files:[r.uri],dialogTitle:'حفظ الصورة'}); }catch(e){ if(!/cancel/i.test(String(e&&e.message))) toast('تعذّر الحفظ'); } return; }
    const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000); }
  async function share(x){ if(IS_NATIVE) return save(x); try{ if(navigator.share) await navigator.share({title:pname(x.pid),url:x.url}); else { await navigator.clipboard.writeText(x.url); toast('نُسخ الرابط'); } }catch{} }

  // ---------- النقرات ----------
  function onClick(e){ const t=e.target;
    const si=t.closest('[data-si]'); if(si){ const key=si.dataset.k||(si.closest('[data-key]')&&si.closest('[data-key]').dataset.key); const l=lists[key]||[IMG.get(si.dataset.si)]; view_(l,Math.max(0,l.findIndex(x=>x&&x.id===si.dataset.si))); return; }
    const tb=t.closest('[data-tab]'); if(tb){ tab=tb.dataset.tab; stack=[]; view={v:'home'}; draw(); root().scrollTop=0; return; }
    const mo=t.closest('[data-more]'); if(mo){ const k=mo.dataset.more; LIM[k]=(LIM[k]||(k==='sess'?40:60))+90; const s=root().scrollTop; draw(); root().scrollTop=s; return; }
    const pf=t.closest('[data-perf]'); if(pf){ go({v:'perf',pid:pf.dataset.perf}); return; }
    const ps=t.closest('[data-psub]'); if(ps){ view={...view,sub:ps.dataset.psub}; draw(); return; }
    const pr=t.closest('[data-psrc]'); if(pr){ view={...view,src:view.src===pr.dataset.psrc?'':pr.dataset.psrc}; draw(); return; }
    const ss=t.closest('[data-sess]'); if(ss){ go({v:'sess',k:ss.dataset.sess}); return; }
    const al=t.closest('[data-album]'); if(al){ go({v:'album',id:al.dataset.album}); return; }
    const od=t.closest('[data-od]'); if(od){ openDetail(od.dataset.od); return; }
    const a=t.closest('[data-act]'); if(!a) return; const k=a.dataset.act;
    if(k==='back') back();
    else if(k==='refresh'){ if(busy){ toast('البحث جارٍ بالفعل'); return; } discover({manual:true}); draw(); }
    else if(k==='stop'){ stopReq=true; toast('سيتوقف بعد الممثلة الحالية'); }
    else if(k==='settings') go({v:'settings'});
    else if(k==='perfscan'){ if(busy){ toast('البحث جارٍ بالفعل'); return; } KV.perfAt[a.dataset.pid]=0; discover({manual:true,pid:a.dataset.pid}); }
    else if(k==='newalbum') askText('اسم الألبوم','','').then(async n=>{ if(!n) return; KV.albums.push({id:'a'+Date.now().toString(36),name:n,ids:[],created:Date.now()}); await saveKV('albums'); draw(); });
    else if(k==='renalbum'){ const al=KV.albums.find(x=>x.id===a.dataset.id); askText('اسم الألبوم',al.name,'').then(async n=>{ if(!n) return; al.name=n; await saveKV('albums'); draw(); }); }
    else if(k==='delalbum') askConfirm('حذف الألبوم؟ الصور نفسها تبقى.','حذف',true).then(async y=>{ if(!y) return; const id=a.dataset.id; KV.albums=KV.albums.filter(x=>x.id!==id); IMG.forEach(x=>{ if((x.albums||[]).includes(id)) x.albums=x.albums.filter(z=>z!==id); }); await saveKV('albums'); back(); });
    else if(k==='unhide'){ const l=[...IMG.values()].filter(x=>x.hide); l.forEach(x=>x.hide=0); putImgs(l).then(()=>{ toast('أُظهرت '+l.length+' صورة'); draw(); }); }
    else if(k==='unhidesrc'){ KV.hiddenSrc={}; saveKV('hiddenSrc').then(draw); }
    else if(k==='clear') askConfirm('مسح فهرس الصور؟ سيُعاد البحث لاحقًا. المعجَبات وصور الألبومات تبقى.','مسح',true).then(async y=>{ if(!y) return; const drop=[...IMG.values()].filter(x=>!x.like&&!(x.albums||[]).length).map(x=>x.id); drop.forEach(id=>IMG.delete(id)); await delImgs(drop); KV.perfAt={}; await saveKV('perfAt'); draw(); }); }
  function onChange(e){ const t=e.target;
    if(t.dataset.set){ const k=t.dataset.set, v=t.value; S[k]=/^\d+$/.test(v)?+v:v; kvSet('settings',S); toast('حُفظ'); }
    if(t.dataset.src){ S.src[t.dataset.src]=t.checked?1:0; kvSet('settings',S); } }

  // ---------- الربط مع التطبيق ----------
  function init(){ const m=root(); if(!m) return; m.addEventListener('click',onClick); m.addEventListener('change',onChange);
    $('nStudio').onclick=()=>open();
    window.addEventListener('resize',()=>{ if(isOpen()){ clearTimeout(init.rt); init.rt=setTimeout(()=>{ const t=root().scrollTop; draw(); root().scrollTop=t; },200); } });
    dot();
    // تحديث تلقائي: بعد بدء التشغيل بهدوء، وعند العودة للتطبيق
    const auto=()=>{ load().then(()=>{ if(due()&&!busy&&!document.hidden) discover(); }).catch(()=>{}); };
    setTimeout(auto,25000); document.addEventListener('visibilitychange',()=>{ if(!document.hidden) setTimeout(auto,8000); });
    // ممثلة جديدة في المفضلة → تُدرج فورًا في البحث
    let st=0; HOOKS.saved.push(arr=>{ if(!loaded||!S||S.freq==='manual') return; if((arr||[]).some(it=>it&&!KV.perfAt[it.id]&&linked(it))){ clearTimeout(st); st=setTimeout(()=>{ if(!busy) discover(); },9000); } });
    // ممثلة حُذفت → صورها تُحذف حسب الإعداد (المعجَبات وصور الألبومات تبقى دائمًا)
    HOOKS.deleted.push(async id=>{ await load(); if(S.keepOnRemove) return; const drop=[...IMG.values()].filter(x=>x.pid===id&&!x.like&&!(x.albums||[]).length).map(x=>x.id); drop.forEach(k=>IMG.delete(k)); delete KV.perfAt[id]; await delImgs(drop); await saveKV('perfAt'); }); }
  setTimeout(init,0);
  // ---------- التلفاز: تنقل بالريموت داخل الاستديو ----------
  const focusables=()=>[...root().querySelectorAll('button,select,input')].filter(el=>{ const r=el.getBoundingClientRect(); return r.width>0&&r.height>0&&getComputedStyle(el).display!=='none'; });
  function focusFirst(){ setTimeout(()=>{ const f=focusables(); const el=f.find(x=>x.classList.contains('shero'))||f.find(x=>x.dataset.tab===tab)||f[0]; if(el) try{ el.focus({preventScroll:false}); }catch{} },60); }
  function move(k){ const all=focusables(), cur=document.activeElement; if(!all.length) return; if(!all.includes(cur)){ all[0].focus(); return; }
    const a=cur.getBoundingClientRect(), cx=a.left+a.width/2, cy=a.top+a.height/2; let best=null, bs=1e9;
    for(const el of all){ if(el===cur) continue; const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, dx=x-cx, dy=y-cy;
      const ok=k==='ArrowLeft'?dx<-4:k==='ArrowRight'?dx>4:k==='ArrowUp'?dy<-4:dy>4; if(!ok) continue;
      const main=(k==='ArrowLeft'||k==='ArrowRight')?Math.abs(dx):Math.abs(dy), side=(k==='ArrowLeft'||k==='ArrowRight')?Math.abs(dy):Math.abs(dx);
      const sc=main+side*2.2; if(sc<bs){ bs=sc; best=el; } }
    if(best){ best.focus({preventScroll:true}); best.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'}); } }
  function tvBack(){ if(stack.length||view.v!=='home'||tab!=='home'){ if(!stack.length&&view.v==='home'){ tab='home'; draw(); } else back(); focusFirst(); return true; } closeOv('ovStudio'); return false; }
  return {open:v=>open(v).then(()=>{ if(document.documentElement.classList.contains('tvapp')) focusFirst(); }),tvBack,move,discover,isOpen,_err:(img,id)=>{ const x=IMG.get(id); if(x&&img.src!==x.url&&x.prev){ img.src=x.url; return; } img.closest('button')&&img.closest('button').classList.add('bad'); },
    _test:{IMG,load,SEL,sessions,dedupe,ham,justify,quality,rarity,versions,similar,get S(){ return S; },get KV(){ return KV; }}};
})();

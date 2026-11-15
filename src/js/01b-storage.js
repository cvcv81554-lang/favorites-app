// ===== المنصّة (Capacitor) =====
const NATIVE=window.Native||null;
const IS_NATIVE=!!(NATIVE&&NATIVE.isNative);
const PLATFORM=IS_NATIVE?NATIVE.platform:'web';
const openExt=u=>{ try{ window.open(u,'_blank','noopener,noreferrer'); }catch{} };

// ===== مخزن ملفات الصور (التطبيق الأصلي) =====
// كل صورة ملف حقيقي في مجلد التطبيق الداخلي (Library/photos) وتُعرض برابط ملف عادي يحمّله النظام عند الحاجة فقط.
// السبب: Blob المخزَّن في IndexedDB لا يُعرض بثبات داخل WebView على iOS بعد إعادة التشغيل، ويستهلك الذاكرة.
// في القاعدة يُحفظ اسم الملف فقط {f,s,t} لأن المسار الكامل يتغيّر بين التحديثات.
const FST={ on:IS_NATIVE, base:'', meta:new Map(), ready:null,
  dir:()=>NATIVE.Directory.Library,
  init(){ if(!this.on) return Promise.resolve(); if(!this.ready) this.ready=(async()=>{ const F=NATIVE.Filesystem;
      try{ await F.mkdir({path:'photos',directory:this.dir(),recursive:true}); }catch{}
      this.base=(await F.getUri({path:'photos',directory:this.dir()})).uri.replace(/\/+$/,''); })();
    return this.ready; },
  url(o){ const u=NATIVE.Capacitor.convertFileSrc(this.base+'/'+o.f); this.meta.set(u,o); return u; },
  async write(blob){ const d=await PB.blobToData(blob), t=blob.type||'image/jpeg';
    const o={f:uid().replace(/[^\w-]/g,'')+'.'+(({'image/webp':'webp','image/png':'png','image/gif':'gif','image/avif':'avif'})[t]||'jpg'),s:blob.size,t};
    await NATIVE.Filesystem.writeFile({path:'photos/'+o.f,directory:this.dir(),data:d.slice(d.indexOf(',')+1)}); return o; },
  async read(o){ const r=await NATIVE.Filesystem.readFile({path:'photos/'+o.f,directory:this.dir()}); return 'data:'+(o.t||'image/jpeg')+';base64,'+String(r.data).replace(/\s+/g,''); },
  // تنظيف الملفات التي لم يعد يشير إليها أي سجل (مرة عند التشغيل، ويتجاوز الملفات الحديثة)
  async gc(){ if(!this.on) return 0; const F=NATIVE.Filesystem, used=new Set([...this.meta.values()].map(o=>o.f)); let n=0;
    try{ const r=await F.readdir({path:'photos',directory:this.dir()}); for(const f of (r.files||[])){ const name=typeof f==='string'?f:f.name; if(used.has(name)) continue; if(f.mtime&&Date.now()-f.mtime<36e5) continue;
        try{ await F.deleteFile({path:'photos/'+name,directory:this.dir()}); n++; }catch{} } }catch{} return n; }
};

// ===== الصور في الذاكرة: دائمًا نصوص قصيرة (رابط ملف في التطبيق، أو blob: في المتصفح، أو https) =====
const PB={ on:true, map:new Map(),
  isData:p=>typeof p==='string'&&p.startsWith('data:'),
  url(b){ const u=URL.createObjectURL(b); PB.map.set(u,b); return u; },
  fromData(u){ const i=u.indexOf(','); const head=u.slice(5,i); if(!/;base64$/.test(head)) return null; const mime=head.split(';')[0]||'image/jpeg';
    const raw=atob(u.slice(i+1)), a=new Uint8Array(raw.length); for(let k=0;k<raw.length;k++) a[k]=raw.charCodeAt(k); return new Blob([a],{type:mime}); },
  toBlob(p){ if(p instanceof Blob) return p; if(typeof p!=='string') return null; if(PB.map.has(p)) return PB.map.get(p); if(PB.isData(p)){ try{ return PB.fromData(p); }catch{ return null; } } return null; },
  file:p=>FST.meta.get(p)||null,
  local:p=>typeof p==='string'&&(PB.map.has(p)||PB.isData(p)||FST.meta.has(p)),   // صورة محفوظة على الجهاز (لا رابط خارجي)
  size(p){ const m=FST.meta.get(p); if(m) return m.s||0; const b=PB.map.get(p); if(b) return b.size; if(PB.isData(p)) return Math.round(p.length*.75); return 0; },
  type(p){ const m=FST.meta.get(p); if(m) return m.t||''; const b=PB.map.get(p); if(b) return b.type; if(PB.isData(p)) return p.slice(5,p.indexOf(';')); return ''; },
  key(p){ const m=FST.meta.get(p); if(m) return 'b:'+m.s+':'+m.t; const b=PB.map.get(p); return b?'b:'+b.size+':'+b.type:p; },
  blobToData(b){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error||new Error('read')); r.readAsDataURL(b); }); },
  toData(p){ const m=FST.meta.get(p); if(m) return FST.read(m); const b=PB.toBlob(p); if(!b||typeof p!=='string'||PB.isData(p)) return Promise.resolve(p); return PB.blobToData(b); },
  adopt(x){ if(!PB.on) return;
    if(Array.isArray(x.photos)) x.photos=x.photos.map(p=>{ if(PB.isData(p)){ const b=PB.toBlob(p); if(b) return PB.url(b); } return p; });
    if(PB.isData(x.thumb)){ const b=PB.toBlob(x.thumb); if(b) x.thumb=PB.url(b); } }
};

// ===== بوابة +18 (مركزية): أي سجل عمره أقل من 18 يُرفض، والتاريخ الناقص يُحسب بأسوأ حالة =====
// عمر متحفّظ: السنة فقط أو السنة والشهر تُحسب بآخر يوم ممكن. صيغة غير مفهومة = NaN = مرفوض.
function sdAge(raw){ raw=String(raw||'').trim(); if(!raw) return null; const m=raw.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?(?:$|[T\s])/); if(!m) return NaN;
  const y=+m[1], mo=m[2]?+m[2]:12; if(mo<1||mo>12) return NaN; const da=m[3]?+m[3]:new Date(y,mo,0).getDate();
  return age(y+'-'+String(mo).padStart(2,'0')+'-'+String(da).padStart(2,'0')); }
// لسجل خارجي (له birthRaw أو birth): مقبول فقط إن كان بلا تاريخ، أو تاريخه يؤكد 18+
const adultOk=m=>{ const a=sdAge(m&&(m.birthRaw||m.birth)); return a===null||(!isNaN(a)&&a>=18); };
// لسجل محفوظ/مستورد: مرفوض إن دلّ تاريخه على أقل من 18 (أو كان تاريخًا غير مفهوم)
const minorRec=x=>{ if(!x||!x.birth) return false; const a=sdAge(x.birth); return isNaN(a)||a<18; };

// ===== التخزين: IndexedDB — السجلات في recs، ومراجع الصور في photos، وإعدادات صغيرة في kv =====
let _db=null;
const HOOKS={saved:[],deleted:[],meta:[]};
const DB={ legacy:[],
  open(){ if(_db) return _db; _db=new Promise((res,rej)=>{ const r=indexedDB.open('favlib',1);
    r.onupgradeneeded=()=>{ const d=r.result; if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if(!d.objectStoreNames.contains('recs')) d.createObjectStore('recs',{keyPath:'id'}); if(!d.objectStoreNames.contains('photos')) d.createObjectStore('photos',{keyPath:'id'}); };
    r.onsuccess=()=>{ const d=r.result; d.onversionchange=()=>{ d.close(); _db=null; }; res(d); };
    r.onerror=()=>{ _db=null; rej(r.error); };
  }); return _db; },
  rq(r){ return new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  done(t){ return new Promise((res,rej)=>{ t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); }); },
  async kvGet(k){ const db=await this.open(); return this.rq(db.transaction('kv').objectStore('kv').get(k)); },
  async kvSet(k,v){ const db=await this.open(); const t=db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); return this.done(t); },
  // المتصفح فقط: نختبر تخزين Blob مرة، وعند الفشل نخزّن نصوص base64
  async test(){ if(FST.on) return; try{ if(LS.get('vkte_blob_off','')==='1') throw 0; const b=new Blob(['blob-test'],{type:'text/plain'});
      await this.kvSet('__blobtest',b); const r=await this.kvGet('__blobtest'); if(!(r instanceof Blob)||r.size!==b.size) throw 0; PB.on=true; }
    catch{ PB.on=false; LS.set('vkte_blob_off','1'); } },
  // قيمة مخزّنة ← نص يُعرض
  show(v){ if(v instanceof Blob) return PB.url(v); if(v&&typeof v==='object'&&v.f) return FST.on?FST.url(v):''; return typeof v==='string'?v:''; },
  async all(){ const db=await this.open(); await FST.init(); await this.test();
    const t=db.transaction(['recs','photos'],'readonly');
    const [recs,phs]=await Promise.all([this.rq(t.objectStore('recs').getAll()),this.rq(t.objectStore('photos').getAll())]);
    const pm=new Map((phs||[]).map(p=>[p.id,p.list||[]])); this.legacy=[];
    return (recs||[]).map(r=>{ const raw=pm.get(r.id)||[];
      // نسخة سابقة من التطبيق خزّنت الصور Blob داخل القاعدة: تُرحَّل إلى ملفات بعد التشغيل
      if(FST.on&&(raw.some(p=>p instanceof Blob)||r.thumb instanceof Blob)) this.legacy.push(r.id);
      r.photos=raw.map(p=>this.show(p)).filter(Boolean); r.thumb=this.show(r.thumb); delete r.nph; return r; }); },
  // نص في الذاكرة ← قيمة تُخزَّن. في التطبيق: أي صورة محلية جديدة تُكتب ملفًا أولًا
  async keep(p){ if(!FST.on) return {v:PB.on?(PB.toBlob(p)||p):p,u:p};
    const m=FST.meta.get(p); if(m) return {v:m,u:p};
    const b=PB.toBlob(p); if(!b) return {v:p,u:p};
    try{ const o=await FST.write(b); return {v:o,u:FST.url(o),old:p}; }catch(e){ console.warn('photo write',e); return {v:b,u:p}; } },
  async put(arr){ if(!arr.length) return; const db=await this.open(); await FST.init();
    const prep=[]; for(const x of arr){ const ph=[]; for(const p of (x.photos||[])) ph.push(await this.keep(p)); prep.push({x,ph,th:x.thumb?await this.keep(x.thumb):{v:'',u:''}}); }
    const t=db.transaction(['recs','photos'],'readwrite'), R=t.objectStore('recs'), P=t.objectStore('photos');
    prep.forEach(({x,ph,th})=>{ const rec={...x,thumb:th.v,nph:ph.length}; delete rec.photos; R.put(rec); P.put({id:x.id,list:ph.map(k=>k.v)}); });
    await this.done(t);
    prep.forEach(({x,ph,th})=>{ if(FST.on){ const olds=[...ph,th].filter(k=>k.old&&String(k.old).startsWith('blob:')).map(k=>k.old);
        if(x.photos) x.photos=ph.map(k=>k.u); if(x.thumb) x.thumb=th.u;
        if(olds.length) setTimeout(()=>olds.forEach(u=>{ PB.map.delete(u); try{ URL.revokeObjectURL(u); }catch{} }),20000); }
      else PB.adopt(x); }); },
  async del(id){ const db=await this.open(); const t=db.transaction(['recs','photos'],'readwrite'); t.objectStore('recs').delete(id); t.objectStore('photos').delete(id);
    await this.done(t); HOOKS.deleted.forEach(f=>{ try{ f(id); }catch{} }); }
};

// نسخة ممثلة واحدة بصيغة النسخة الاحتياطية (الصور والمصغّرة base64)
async function exportItem(it){ const o={...it}; o.photos=await Promise.all((it.photos||[]).map(p=>PB.toData(p))); if(it.thumb) o.thumb=await PB.toData(it.thumb); return o; }
async function exportItems(){ const out=[]; for(const it of items) out.push(await exportItem(it)); return out; }

let items=[], state={fav:false, tag:null, list:null}, curDetail=null;
let lists=[]; try{ lists=JSON.parse(LS.get('vkte_lists','[]'))||[]; }catch{ lists=[]; }
const metaChanged=()=>HOOKS.meta.forEach(f=>{ try{ f(); }catch{} });
const saveLists=()=>{ LS.set('vkte_lists',JSON.stringify(lists)); metaChanged(); };
let _wCache=null;
// نقطة الحفظ الوحيدة: تمرّ عليها بوابة +18 قبل الكتابة
const save=(...a)=>{ _wCache=null; let arr=a.flat().filter(Boolean);
  const bad=arr.filter(minorRec); if(bad.length){ arr=arr.filter(x=>!bad.includes(x)); items=items.filter(x=>!bad.includes(x)); toast('رُفض حفظ سجل عمره أقل من 18 سنة'); }
  return DB.put(arr).then(()=>{ HOOKS.saved.forEach(f=>{ try{ f(arr); }catch{} }); return true; }).catch(e=>{ console.warn('save',e); toast('تعذّر الحفظ. ربما المساحة ممتلئة'); return false; }); };

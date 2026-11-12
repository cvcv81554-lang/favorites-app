// ===== المنصّة (Capacitor) =====
const NATIVE=window.Native||null;
const IS_NATIVE=!!(NATIVE&&NATIVE.isNative);
const PLATFORM=IS_NATIVE?NATIVE.platform:'web';
const openExt=u=>{ try{ window.open(u,'_blank','noopener,noreferrer'); }catch{} };

// ===== الصور كـ Blob =====
// في IndexedDB تُحفظ الصور كـBlob حقيقي في مخزن منفصل (photos) والمصغّرة Blob داخل السجل،
// وفي الذاكرة تبقى روابط blob: قصيرة. التصدير يحوّلها إلى base64 فتبقى النسخ متوافقة مع التطبيق القديم.
const PB={ on:true, map:new Map(),
  isData:p=>typeof p==='string'&&p.startsWith('data:'),
  url(b){ const u=URL.createObjectURL(b); PB.map.set(u,b); return u; },
  fromData(u){ const i=u.indexOf(','); const head=u.slice(5,i); if(!/;base64$/.test(head)) return null; const mime=head.split(';')[0]||'image/jpeg';
    const raw=atob(u.slice(i+1)), a=new Uint8Array(raw.length); for(let k=0;k<raw.length;k++) a[k]=raw.charCodeAt(k); return new Blob([a],{type:mime}); },
  toBlob(p){ if(p instanceof Blob) return p; if(typeof p!=='string') return null; if(PB.map.has(p)) return PB.map.get(p); if(PB.isData(p)){ try{ return PB.fromData(p); }catch{ return null; } } return null; },
  size(p){ const b=PB.map.get(p); if(b) return b.size; if(PB.isData(p)) return Math.round(p.length*.75); return 0; },
  key(p){ const b=PB.map.get(p); return b?'b:'+b.size+':'+b.type:p; },
  blobToData(b){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(b); }); },
  toData(p){ const b=PB.toBlob(p); if(!b||typeof p!=='string'||PB.isData(p)) return Promise.resolve(p); return PB.blobToData(b); },
  // بعد الحفظ: حوّل أي نص data: في الذاكرة إلى رابط blob: قصير
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

// ===== التخزين: IndexedDB — السجلات في recs، والصور في photos (Blob)، وإعدادات صغيرة في kv =====
let _db=null;
const HOOKS={saved:[],deleted:[],meta:[]};
const DB={
  open(){ if(_db) return _db; _db=new Promise((res,rej)=>{ const r=indexedDB.open('favlib',1);
    r.onupgradeneeded=()=>{ const d=r.result; if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if(!d.objectStoreNames.contains('recs')) d.createObjectStore('recs',{keyPath:'id'}); if(!d.objectStoreNames.contains('photos')) d.createObjectStore('photos',{keyPath:'id'}); };
    r.onsuccess=()=>{ const d=r.result; d.onversionchange=()=>{ d.close(); _db=null; }; res(d); };
    r.onerror=()=>{ _db=null; rej(r.error); };
  }); return _db; },
  rq(r){ return new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  done(t){ return new Promise((res,rej)=>{ t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); }); },
  async kvGet(k){ const db=await this.open(); return this.rq(db.transaction('kv').objectStore('kv').get(k)); },
  async kvSet(k,v){ const db=await this.open(); const t=db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); return this.done(t); },
  // بعض المتصفحات القديمة لا تخزّن Blob بأمان: نختبر مرة، وعند الفشل نخزّن نصوص base64
  async test(){ try{ if(LS.get('vkte_blob_off','')==='1') throw 0; const b=new Blob(['blob-test'],{type:'text/plain'});
      await this.kvSet('__blobtest',b); const r=await this.kvGet('__blobtest'); if(!(r instanceof Blob)||r.size!==b.size) throw 0; PB.on=true; }
    catch{ PB.on=false; LS.set('vkte_blob_off','1'); } },
  async all(){ const db=await this.open(); await this.test();
    const t=db.transaction(['recs','photos'],'readonly');
    const [recs,phs]=await Promise.all([this.rq(t.objectStore('recs').getAll()),this.rq(t.objectStore('photos').getAll())]);
    const pm=new Map((phs||[]).map(p=>[p.id,p.list||[]]));
    return (recs||[]).map(r=>{ r.photos=(pm.get(r.id)||[]).map(p=>p instanceof Blob?PB.url(p):p); if(r.thumb instanceof Blob) r.thumb=PB.url(r.thumb); delete r.nph; return r; }); },
  async put(arr){ if(!arr.length) return; const db=await this.open();
    const t=db.transaction(['recs','photos'],'readwrite'), R=t.objectStore('recs'), P=t.objectStore('photos');
    arr.forEach(x=>{ const ph=(x.photos||[]).map(p=>PB.on?(PB.toBlob(p)||p):p); const rec={...x,thumb:(PB.on&&PB.toBlob(x.thumb))||x.thumb||'',nph:ph.length}; delete rec.photos; R.put(rec); P.put({id:x.id,list:ph}); });
    await this.done(t); arr.forEach(x=>PB.adopt(x)); },
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
  return DB.put(arr).then(()=>{ HOOKS.saved.forEach(f=>{ try{ f(arr); }catch{} }); }).catch(()=>toast('تعذّر الحفظ. ربما المساحة ممتلئة')); };

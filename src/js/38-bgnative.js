// ===== تجريبي (فرع bg-beta): التحديث والتطبيق مغلق عبر Capacitor Background Runner =====
// - التطبيق يرسل للمشغّل قائمة StashDB لممثلات مفضلتك **البالغات فقط** (بوابة +18 هنا، قبل أي طلب شبكة من المشغّل).
// - المشغّل يسأل StashDB عن أعمال جديدة حين يسمح النظام، ويحفظها ويرسل إشعارًا محليًا.
// - عند فتح التطبيق: تُجمع النتائج وتُدمج في الأعمال (بنفس دالة الدمج المستخدمة في «الأعمال القادمة»).
// مفتاح StashDB يُحفظ في مخزن المشغّل على الجهاز نفسه (UserDefaults / SharedPreferences) ولا يغادره إلا إلى StashDB.
const BgNative=(()=>{
  const LABEL='com.favlib.app.check', ON='vkte_bgn';
  const BR=()=>window.Native&&Native.isNative&&Native.BackgroundRunner||null;
  const enabled=()=>LS.get(ON,'0')==='1';
  const adultsWithStash=()=>items.filter(i=>i&&i.stashId&&!minorRec(i)).map(i=>({s:String(i.stashId)}));   // المعرّف فقط، بلا أسماء
  async function config(){ const br=BR(); if(!br) return false;
    try{ await br.dispatchEvent({label:LABEL,event:'config',details:{key:LS.get('vkte_stash',''),on:enabled()&&(typeof Sched==='undefined'||Sched.mode()!=='off'),ids:enabled()?adultsWithStash():[]}}); return true; }catch(e){ console.warn('bg config',e); return false; } }
  async function collect(){ const br=BR(); if(!br) return 0;
    let r; try{ r=await br.dispatchEvent({label:LABEL,event:'collect',details:{}}); }catch(e){ console.warn('bg collect',e); return 0; }
    const found=(r&&Array.isArray(r.found))?r.found:[]; if(!found.length) return 0;
    const by=new Map(items.filter(i=>i.stashId).map(i=>[String(i.stashId),i])); const touched=new Set(); let added=0; const T=todayStr();
    found.forEach(s=>{ if(!s||typeof s.id!=='string') return; const yd=ydOf(String(s.d||''));
      const w={t:String(s.t||'').slice(0,200),s:String(s.st||'').slice(0,120),...yd,u:'https://stashdb.org/scenes/'+encodeURIComponent(s.id),is:s.id}; if(yd.d&&yd.d>T) w.upc=1;
      (Array.isArray(s.ps)?s.ps:[]).forEach(pid=>{ const it=by.get(String(pid)); if(!it||minorRec(it)) return; const m=mergeWorks(it.works,[w]); if(m.n){ it.works=m.list; it.updated=Date.now(); added+=m.n; touched.add(it); } }); });
    if(touched.size){ await save([...touched]); if(typeof updWorksDot==='function') updWorksDot(); toast('أُضيف '+added+' عمل وُجد في الخلفية'); }
    return added; }
  async function setEnabled(on){ const br=BR(); if(!br){ toast('متاح في تطبيق الجوال فقط'); return false; }
    if(on){ try{ const p=await br.requestPermissions({apis:['notifications']}); if(p&&p.notifications&&p.notifications!=='granted') toast('الإشعارات غير مسموحة — سيُحفظ الجديد بلا إشعار'); }catch{} }
    LS.set(ON,on?'1':'0'); await config(); return true; }
  let t=0; HOOKS.saved.push(()=>{ if(!enabled()) return; clearTimeout(t); t=setTimeout(config,5000); });
  setTimeout(()=>{ if(BR()){ config(); collect(); } },6000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&BR()) setTimeout(collect,2500); });
  return {enabled,setEnabled,config,collect,available:()=>!!BR(),_adults:adultsWithStash};
})();

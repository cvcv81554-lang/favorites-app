/* ---- 03-forms.js ---- */
// ===== النموذج =====
function starPicker(el,val,cb){
  const draw=()=>{ el.innerHTML=[1,2,3,4,5].map(n=>`<button type="button" class="${n<=val?'on':''}" data-n="${n}">★</button>`).join(''); };
  draw(); el.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; const n=+b.dataset.n; val=(val===n)?0:n; draw(); cb(val); };
}
const exOf=w=>{ const o={}; WEX.forEach(k=>{ if(w[k]!==undefined) o[k]=w[k]; }); return Object.keys(o).length?esc(JSON.stringify(o)):''; };
const wRowHtml=w=>`<div class="wrow" ${w.w?'data-w="1"':''} ${w.r>0?`data-r="${w.r}"`:''} ${w.rec?'data-rec="1"':''} ${exOf(w)?`data-ex="${exOf(w)}"`:''}><input class="in w-t" placeholder="اسم العمل" value="${esc(w.t||'')}"><input class="in w-s" list="siteDl" placeholder="الموقع / الاستوديو" value="${esc(w.s||'')}"><input class="in w-y" dir="ltr" maxlength="10" placeholder="2026 أو 2026-11-20" value="${esc(w.d||w.y||'')}"><button type="button" class="ib sm" data-wx aria-label="حذف العمل">${icon('x')}</button></div>`;

function openForm(it){
  const edit=!!it;
  const d=it?JSON.parse(JSON.stringify(it)):{name:'',aliases:'',country:'',birth:'',works:[],tags:[],notes:'',photos:[],rating:0,criteria:null,fav:false};
  let photos=d.photos.slice(), overall=d.criteria?0:d.rating, crit={...Object.fromEntries(CRIT.map(([k])=>[k,0])),...Object.fromEntries(CRIT.map(([k])=>[k,(d.criteria||{})[k]||0]))}, useCrit=!!d.criteria;
  let useBody=!!d.bodyD, bd={...Object.fromEntries(BODY.map(([k])=>[k,0])),...(d.bodyD||{})};
  let ofId=d.ofId||null, fsId=d.fsId||null, usedX=[];
  let stashId=d.stashId||null, srcImgs=(d.srcImgs||[]).slice(), usedS=false;
  let pdbId=d.pdbId||null, worksAt=d.worksAt||null, accs=(d.accounts||[]).map(x=>({p:x.p,v:x.v}));
  $('mForm').innerHTML=`<h2>${edit?'تعديل':'إضافة'} ممثلة</h2>
  <details class="dt">
    <summary>تعبئة من ThePornDB (اختياري)</summary>
    <label style="margin-top:10px">اكتب الاسم ثم اختر الشخصية الصحيحة. بقية الخانات تعبّيها بنفسك كما تشاء</label>
    <div style="display:flex;gap:8px"><input class="in" id="sQ" placeholder="اسم الممثلة"><button type="button" class="btn gold" id="sGo">بحث</button></div>
    <div id="sMsg" class="src" style="margin-top:6px"></div>
    <div id="sRes" style="display:grid;gap:8px;margin-top:8px"></div>
  </details>
  <details class="dt">
    <summary>تعبئة من StashDB (اختياري)</summary>
    <label style="margin-top:10px">اكتب الاسم ثم اختر الشخصية. يملأ الحقول الفارغة فقط، ويضيف الأسماء والأعمال والحسابات والصور دون تكرار</label>
    <div style="display:flex;gap:8px"><input class="in" id="sQ2" placeholder="اسم الممثلة" dir="ltr"><button type="button" class="btn gold" id="sGo2">بحث</button></div>
    <div id="sMsg2" class="src" style="margin-top:6px"></div>
    <div id="sRes2" style="display:grid;gap:8px;margin-top:8px"></div>
  </details>
  ${typeof VX!=='undefined'?VX.formHtml():''}
  <div class="row two"><div><label>الاسم *</label><input class="in" id="fName" value="${esc(d.name)}"></div>
  <div><label>أسماء بديلة (افصل بفاصلة)</label><input class="in" id="fAl" value="${esc(d.aliases)}"></div></div>
  <div class="row two"><div><label>البلد</label><input class="in" id="fCo" value="${esc(d.country)}"></div>
  <div><label>تاريخ الميلاد (اختياري)</label><input class="in" type="date" id="fBi" value="${esc(d.birth)}"></div></div>
  <div class="row"><div><label>الحسابات الشخصية (اضغط منصة لإضافة حساب)</label><div id="accBox"></div>
    <div class="addp">${PLAT.map(p=>`<button type="button" class="chip" data-addp="${p.k}">＋ ${esc(p.n)}</button>`).join('')}</div></div></div>
  <div class="row"><div><details class="dt" id="wDet" ${(d.works||[]).length?'':'open'} style="margin:0"><summary>الأعمال (<span id="wN">${(d.works||[]).length}</span>)</summary>
    <div id="wList" style="max-height:46vh;overflow:auto;margin:10px 0">${(d.works||[]).map(wRowHtml).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="wAdd">＋ إضافة عمل</button>
    <button type="button" class="btn" id="fWref" style="display:${LS.get('vkte_key')?'inline-flex':'none'};gap:6px;align-items:center">${icon('refresh')}جلب الأعمال من ThePornDB</button>
    <button type="button" class="btn" id="fWref2" style="display:${LS.get('vkte_stash')?'inline-flex':'none'};gap:6px;align-items:center">${icon('refresh')}جلب الأعمال من StashDB</button></div>
    <details class="dt" style="margin:10px 0 0"><summary>لصق قائمة أعمال دفعة واحدة</summary>
      <label style="margin-top:8px">سطر لكل عمل بهذا الشكل: العنوان | الموقع | السنة</label>
      <textarea class="in" id="wPaste" style="min-height:80px"></textarea>
      <button type="button" class="btn" id="wPasteGo" style="margin-top:8px">أضفها للقائمة</button></details>
    <datalist id="siteDl">${allSites().map(s=>`<option value="${esc(s)}">`).join('')}</datalist></details>
  </div></div>
  <div class="row two"><div><label>الوسوم (افصل بفاصلة)</label><input class="in" id="fTa" value="${esc((d.tags||[]).join(', '))}"></div>
  <div><label>الصور (اختر عدة صور، الأولى هي الرئيسية)</label><input type="file" id="fPh" accept="image/*" multiple class="in"></div></div>
  <div class="thumbs" id="thumbs"></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn" id="fSrchG">ابحث عن صور: Google ↗</button></div>
  <p class="src" style="font-size:.8rem;margin:6px 0 0">يفتح البحث في المتصفح. احفظ الصور اللي تعجبك في جهازك وارفعها من «الصور» (أفضل جودة)، أو الصق روابطها هنا تحت.</p>
  <details class="dt" style="margin-top:10px"><summary>إضافة صور من روابط (اختياري)</summary>
    <label style="margin-top:8px">رابط صورة في كل سطر. إن منع الموقع التنزيل يُحفظ الرابط كما هو وقد لا يعمل لاحقًا</label>
    <textarea class="in" id="fUrls" dir="ltr" style="min-height:80px" placeholder="https://..."></textarea>
    <button type="button" class="btn" id="fUrlGo" style="margin-top:8px">جلب الصور</button></details>
  <div class="row" style="margin-top:12px"><div><label>تقييمي</label>
    <div class="starpick" id="spAll"></div>
    <label style="margin-top:8px;display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="fUse" ${useCrit?'checked':''}> تقييم تفصيلي بمعايير (يُحسب المتوسط تلقائيًا)</label>
    <div id="critBox" style="display:${useCrit?'block':'none'}">${CRIT.map(([k,n])=>`<div class="crit"><span>${n}</span><div class="starpick" id="sp_${k}"></div></div>`).join('')}</div>
    <label style="margin-top:12px;display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="fUseB" ${useBody?'checked':''}> تقييم الجسم بتفاصيل (الوجه، الشعر، البشرة، القوام...)</label>
    <div id="bodyBox" style="display:${useBody?'block':'none'}">${BODY.map(([k,n])=>`<div class="crit"><span>${n}</span><div class="starpick" id="sb_${k}"></div></div>`).join('')}<div class="src" style="font-size:.78rem">متوسط هذه التفاصيل يصير تقييم «الجسم» تلقائيًا في التقييم التفصيلي.</div></div>
  </div></div>
  <div class="row"><div><label>القوائم</label><div id="fLists">${lists.map(L=>`<label style="display:inline-flex;gap:6px;margin:0 0 4px 14px;color:var(--text);cursor:pointer"><input type="checkbox" value="${L.id}" ${(d.lists||[]).includes(L.id)?'checked':''}> ${esc(L.name)}</label>`).join('')||'<span class="src">لا توجد قوائم بعد</span>'}</div><input class="in" id="fNewList" placeholder="قائمة جديدة (اختياري)" style="margin-top:6px"></div></div>
  <div class="row"><div><label>ملاحظاتي</label><textarea class="in" id="fNo">${esc(d.notes)}</textarea></div></div>
  <label style="display:flex;gap:8px;align-items:center;cursor:pointer;color:var(--text)"><input type="checkbox" id="fAdult" ${edit?'checked':''}> أؤكد أنها بالغة (18 سنة فأكثر)</label>
  <div class="actions"><button class="btn" id="fCancel">إلغاء</button><button class="btn gold" id="fSave">حفظ</button></div>`;
  $('ovForm').classList.add('show'); $('mForm').scrollTop=0;
  const drawThumbs=()=>{ $('thumbs').innerHTML=photos.map((p,n)=>`<div class="th ${n===0?'main':''}" data-n="${n}" title="اضغط لجعلها الرئيسية"><img src="${p}" alt="" referrerpolicy="no-referrer"><i data-x="${n}" aria-label="حذف الصورة">✕</i></div>`).join(''); $('thumbs').querySelectorAll('img').forEach(im=>{ im.onerror=()=>im.closest('.th').classList.add('bad'); }); };
  drawThumbs();
  $('thumbs').onclick=e=>{ const x=e.target.closest('[data-x]'); if(x){ photos.splice(+x.dataset.x,1); drawThumbs(); return; } const t=e.target.closest('.th'); if(t){ const n=+t.dataset.n; photos.unshift(photos.splice(n,1)[0]); drawThumbs(); } };
  $('fPh').onchange=async e=>{ for(const f of e.target.files){ if(photos.length>=MAXPH){ toast('الحد الأقصى '+MAXPH+' صورة'); break; } try{ photos.push(await resize(f)); }catch{ toast('تعذّرت قراءة صورة'); } } e.target.value=''; drawThumbs(); };
  // الحسابات
  const drawAccs=()=>{ $('accBox').innerHTML=accs.map((x,n)=>`<div class="arow"><select class="in" data-ap="${n}" aria-label="المنصة">${PLAT.map(p=>`<option value="${p.k}" ${p.k===x.p?'selected':''}>${esc(p.n)}</option>`).join('')}</select><input class="in" dir="ltr" data-av="${n}" value="${esc(x.v)}" placeholder="${esc(platOf(x.p).h)}" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="ib sm" data-ax="${n}" aria-label="حذف الحساب">${icon('x')}</button></div>`).join(''); };
  drawAccs();
  $('accBox').oninput=e=>{ const t=e.target; if(t.dataset.av!==undefined) accs[+t.dataset.av].v=t.value; };
  $('accBox').onchange=e=>{ const t=e.target; if(t.dataset.ap!==undefined){ accs[+t.dataset.ap].p=t.value; drawAccs(); } };
  $('accBox').onclick=e=>{ const x=e.target.closest('[data-ax]'); if(x){ accs.splice(+x.dataset.ax,1); drawAccs(); } };
  $('mForm').querySelector('.addp').onclick=e=>{ const c=e.target.closest('[data-addp]'); if(!c) return; accs.push({p:c.dataset.addp,v:''}); drawAccs(); const ins=$('accBox').querySelectorAll('input'); if(ins.length) ins[ins.length-1].focus(); };
  // الأعمال
  const collectWorks=()=>[...document.querySelectorAll('#wList .wrow')].map(r=>{ let ex={}; try{ if(r.dataset.ex) ex=JSON.parse(r.dataset.ex)||{}; }catch{} return normW([{...ex,t:r.querySelector('.w-t').value.trim(),s:r.querySelector('.w-s').value.trim(),...ydOf(r.querySelector('.w-y').value),...(r.dataset.w?{w:1}:{}),...(+r.dataset.r>0?{r:+r.dataset.r}:{}),...(r.dataset.rec?{rec:1}:{})}])[0]; }).filter(Boolean);
  const updW=()=>{ $('wN').textContent=document.querySelectorAll('#wList .wrow').length; };
  const setWorks=arr=>{ $('wList').innerHTML=arr.map(wRowHtml).join(''); updW(); };
  $('wAdd').onclick=()=>{ $('wList').insertAdjacentHTML('beforeend',wRowHtml({})); $('wList').lastElementChild.querySelector('.w-t').focus(); updW(); };
  $('wList').onclick=e=>{ const x=e.target.closest('[data-wx]'); if(x){ x.closest('.wrow').remove(); updW(); } };
  $('wPasteGo').onclick=()=>{ const ws=normW($('wPaste').value); if(!ws.length) return; $('wList').insertAdjacentHTML('beforeend',ws.map(wRowHtml).join('')); $('wPaste').value=''; updW(); toast('أُضيف '+ws.length+' عمل'); };
  starPicker($('spAll'),overall,v=>overall=v);
  CRIT.forEach(([k])=>starPicker($('sp_'+k),crit[k]||0,v=>crit[k]=v));
  BODY.forEach(([k])=>starPicker($('sb_'+k),bd[k]||0,v=>bd[k]=v));
  const syncB=()=>{ const r=$('sp_body'); if(r&&r.closest('.crit')) r.closest('.crit').style.display=useBody?'none':''; $('bodyBox').style.display=useBody?'block':'none'; };
  $('fUseB').onchange=e=>{ useBody=e.target.checked; syncB(); }; syncB();
  $('fUse').onchange=e=>{ useCrit=e.target.checked; $('critBox').style.display=useCrit?'block':'none'; $('spAll').style.display=useCrit?'none':'block'; };
  $('spAll').style.display=useCrit?'none':'block';
  let used=false;
  let failed=0;
  const addImg=async url=>{ if(photos.length>=MAXPH) return; try{ const bl=await fetchImage(url); photos.push(await resize(new File([bl],'x',{type:bl.type}))); srcImgs.push(url); drawThumbs(); return true; }catch{ failed++; return false; } };
  const srch=u=>{ const q=$('fName').value.trim(); if(!q){ toast('اكتب الاسم أولًا'); return; } openExt(u+encodeURIComponent(q)); };

  $('fSrchG').onclick=()=>srch('https://www.google.com/search?tbm=isch&q=');
  $('fUrlGo').onclick=async()=>{ const us=$('fUrls').value.split('\n').map(x=>x.trim()).filter(x=>/^https?:\/\//.test(x)); if(!us.length){ toast('الصق رابطًا يبدأ بـ https'); return; } toast('جارٍ الجلب…'); failed=0; let ok=0; for(const u of us) if(await addImg(u)) ok++; $('fUrls').value=''; if(failed) await askNote('تمت إضافة '+ok+' صورة، وتعذّر تنزيل '+failed+' لأن الموقع يمنع التنزيل منه. احفظ هذه الصور في جهازك ثم ارفعها من «الصور».'); else toast('أُضيفت '+ok+' صورة'); };
  const pick=async m=>{
    if(!adultOk(m)){ await askNote('عمر هذا السجل أقل من 18 أو غير مؤكد، لا يمكن إضافته.'); return; }
    if(m.name) $('fName').value=m.name; if(m.aliases) $('fAl').value=m.aliases; if(m.country) $('fCo').value=m.country; if(m.birth) $('fBi').value=m.birth;
    used=true; pdbId=m.id; $('sRes').innerHTML=''; $('sMsg').textContent='تمت التعبئة من ThePornDB. راجع البيانات وعدّلها قبل الحفظ. ما لم يتوفر تُرك فارغًا.';
    (async()=>{ failed=0; let ok=0; for(const u of (m.imgs||[])) if(await addImg(u)) ok++; if(!ok&&(m.imgs||[]).length) toast('تعذّر تنزيل صور ThePornDB. ارفع صورها يدويًا'); })();
    try{ const fresh=await fetchWorksFor(m.id); const r=mergeWorks(collectWorks(),fresh); if(r.n){ setWorks(r.list); worksAt=Date.now(); } }catch{}
  };
  $('sGo').onclick=async()=>{
    const q=$('sQ').value.trim(); if(!q) return;
    if(!LS.get('vkte_key')){ $('sMsg').textContent='لا يوجد مفتاح. أضفه من الإعدادات ثم أعد المحاولة، أو أكمل الإدخال يدويًا.'; return; }
    $('sMsg').textContent='جارٍ البحث…'; $('sRes').innerHTML='';
    try{
      const rr=await fetch(API()+'/performers?q='+encodeURIComponent(q),{headers:hdr()});
      if(rr.status===401||rr.status===403){ $('sMsg').textContent='المفتاح غير صالح أو منتهٍ. تأكد منه في الإعدادات.'; return; }
      if(!rr.ok){ $('sMsg').textContent='فشل الطلب (رمز '+rr.status+'). أكمل يدويًا.'; return; }
      const j=await rr.json(); const all=(j.data||[]).slice(0,10).map(mapP), res=all.filter(adultOk), hid=all.length-res.length;
      const note=hid?' (أُخفيت '+hid+' نتيجة: العمر أقل من 18 أو غير مؤكد)':'';
      if(!res.length){ $('sMsg').textContent='لا نتائج. جرّب اسمًا آخر أو أكمل يدويًا.'+note; return; }
      $('sMsg').textContent='اختر الشخصية الصحيحة:'+note;
      $('sRes').innerHTML=res.map(rcRow).join('');
      $('sRes').onclick=e=>{ const c=e.target.closest('.rc'); if(c) pick(res[+c.dataset.n]); };
    }catch{ $('sMsg').textContent='تعذّر الاتصال. تحقق من الإنترنت. الإدخال اليدوي يعمل دائمًا.'; }
  };
  $('sQ').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); $('sGo').click(); } };
  $('fWref').onclick=async()=>{
    const nm=$('fName').value.trim(); if(!pdbId&&!nm){ toast('اكتب الاسم أولًا'); return; }
    const b=$('fWref'); b.disabled=true;
    try{ if(!pdbId){ const m=await findPerformer(nm,false); if(!m) return; pdbId=m.id; }
      const fresh=await fetchWorksFor(pdbId); const r=mergeWorks(collectWorks(),fresh); setWorks(r.list); worksAt=Date.now(); toast(r.n?'أُضيف '+r.n+' عمل. اضغط حفظ لتثبيتها':'لا جديد'); }
    catch(e){ toast(e&&(e.status===401||e.status===403)?'المفتاح غير صالح':'تعذّر الجلب. تحقق من الاتصال'); }
    finally{ b.disabled=false; }
  };
  // StashDB
  const pickS=async m=>{
    if(!adultOk(m)){ await askNote('عمر هذا السجل أقل من 18 أو غير مؤكد، لا يمكن إضافته.'); return; }
    usedS=true; stashId=m.id;
    const set=(id,v)=>{ if(v&&!$(id).value.trim()) $(id).value=v; };
    set('fName',m.name); set('fCo',m.country); set('fBi',m.birth);
    const seenA=new Set([norm($('fName').value)]); const al=[]; [...$('fAl').value.split(/[,،]/),...m.aliases.split(', ')].map(x=>x.trim()).filter(Boolean).forEach(x=>{ const k=norm(x); if(!seenA.has(k)){ seenA.add(k); al.push(x); } }); $('fAl').value=al.join(', ');
    let na=0; m.urls.map(accFromUrl).filter(Boolean).forEach(a=>{ if(!accs.some(x=>accKey(x)===accKey(a))){ accs.push(a); na++; } }); if(na) drawAccs();
    $('sRes2').innerHTML=''; $('sMsg2').textContent='تمت التعبئة من StashDB (الحقول الفارغة فقط)'+(na?' · '+na+' حساب':'')+'. راجع البيانات قبل الحفظ.';
    (async()=>{ failed=0; let ok=0; const list=m.imgs.filter(u=>!srcImgs.includes(u)); for(const u of list) if(await addImg(u)) ok++; if(!ok&&list.length) toast('تعذّر تنزيل صور StashDB. ارفع صورها يدويًا'); })();
    try{ const fresh=await sdWorks(m.id); const r=mergeWorks(collectWorks(),fresh); if(r.n){ setWorks(r.list); worksAt=Date.now(); toast('أُضيف '+r.n+' عمل من StashDB'); } }catch(e){ toast('تعذّر جلب أعمال StashDB'+(e&&e.gql?': '+String(e.message).slice(0,50):'')); }
  };
  $('sGo2').onclick=async()=>{ const q=$('sQ2').value.trim(); if(!q) return;
    if(!LS.get('vkte_stash')){ $('sMsg2').textContent='لا يوجد مفتاح StashDB. أضفه من الإعدادات ثم أعد المحاولة.'; return; }
    $('sMsg2').textContent='جارٍ البحث…'; $('sRes2').innerHTML='';
    try{ const d=await sdQ(SD_SEARCH,{t:q,l:10}); const all=(d.searchPerformer||[]).map(mapS); const res=all.filter(adultOk); const hid=all.length-res.length;
      const note=hid?' (أُخفيت '+hid+' نتيجة: العمر أقل من 18 أو غير مؤكد)':'';
      if(!res.length){ $('sMsg2').textContent='لا نتائج.'+note; return; }
      $('sMsg2').textContent='اختر الشخصية الصحيحة:'+note;
      $('sRes2').innerHTML=res.map(rcRow).join(''); $('sRes2').onclick=e=>{ const c=e.target.closest('.rc'); if(c) pickS(res[+c.dataset.n]); };
    }catch(e){ $('sMsg2').textContent=e&&(e.status===401||e.status===403)?'مفتاح StashDB غير صالح. تأكد منه في الإعدادات.':'تعذّر الاتصال بـ StashDB'+(e&&e.gql?' ('+String(e.message).slice(0,60)+')':'')+'. الإدخال اليدوي يعمل دائمًا.'; } };
  $('sQ2').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); $('sGo2').click(); } };
  if(typeof VX!=='undefined') VX.bindForm({ set:(id,v)=>{ if(v&&!$(id).value.trim()) $(id).value=v; }, accs, drawAccs, addImg, srcImgs, resetFail:()=>{ failed=0; }, used:n=>{ if(!usedX.includes(n)) usedX.push(n); }, setId:(k,v)=>{ if(k==='ofId') ofId=v; else fsId=v; } });
  $('fWref2').onclick=async()=>{
    const nm=$('fName').value.trim(); if(!stashId&&!nm){ toast('اكتب الاسم أولًا'); return; }
    const b=$('fWref2'); b.disabled=true;
    try{ if(!stashId){ const m=await findStash(nm,false); if(!m) return; stashId=m.id; usedS=true; }
      const fresh=await sdWorks(stashId); const r=mergeWorks(collectWorks(),fresh); setWorks(r.list); worksAt=Date.now(); toast(r.n?'أُضيف '+r.n+' عمل من StashDB. اضغط حفظ لتثبيتها':'لا جديد'); }
    catch(e){ toast(e&&(e.status===401||e.status===403)?'مفتاح StashDB غير صالح':'تعذّر الجلب من StashDB'+(e&&e.gql?': '+String(e.message).slice(0,50):'')); }
    finally{ b.disabled=false; }
  };
  $('fCancel').onclick=()=>closeOv('ovForm');
  $('fSave').onclick=async()=>{
    const name=$('fName').value.trim(); if(!name){ toast('اكتب الاسم أولًا'); return; }
    if(!$('fAdult').checked){ await askNote('لا يمكن الحفظ دون تأكيد أنها بالغة (18+).'); return; }
    const bi=$('fBi').value; const a=age(bi); if((a!==null&&a<18)||minorRec({birth:bi})){ await askNote('لا يمكن إضافة شخص عمره أقل من 18 سنة.'); return; }
    if(!edit&&items.some(x=>norm(x.name)===norm(name))&&!(await askConfirm('«'+name+'» موجودة عندك بالفعل. أضيفها مرة ثانية؟','أضف'))) return;
    const btn=$('fSave'); btn.disabled=true;
    let rating=overall, criteria=null;
    if(useBody&&useCrit){ const bv=BODY.map(([k])=>bd[k]||0).filter(v=>v>0); if(bv.length) crit.body=Math.round(bv.reduce((s,v)=>s+v,0)/bv.length); }
    if(useCrit){ const vals=CRIT.map(([k])=>crit[k]||0).filter(v=>v>0); rating=vals.length?Math.round(vals.reduce((s,v)=>s+v,0)/vals.length*2)/2:0; criteria={...crit}; }
    const sel=[...document.querySelectorAll('#fLists input:checked')].map(x=>x.value); const nl=$('fNewList').value.trim(); if(nl){ const NL={id:uid(),name:nl}; lists.push(NL); saveLists(); sel.push(NL.id); }
    let thumb=''; if(photos[0]){ if(edit&&it.thumb&&it.photos&&it.photos[0]===photos[0]) thumb=it.thumb; else { try{ thumb=await mkThumb(photos[0]); }catch{} } }
    const rec={ ...(edit?it:{id:uid(),fav:false,added:Date.now()}), name, aliases:$('fAl').value.trim(), country:$('fCo').value.trim(), birth:bi, works:collectWorks(),
      tags:$('fTa').value.split(/[,،]/).map(s=>s.trim()).filter(Boolean), notes:$('fNo').value.trim(), photos, thumb, lists:sel, rating, criteria, bodyD:useBody?{...bd}:null, stashId:stashId||undefined, ofId:ofId||undefined, fsId:fsId||undefined, srcImgs:srcImgs.length?srcImgs:undefined,
      accounts:accs.map(x=>({p:x.p,v:String(x.v||'').trim()})).filter(x=>x.v), pdbId:pdbId||undefined, worksAt:worksAt||undefined, updated:Date.now() };
    { const prev=(edit&&it.source)||''; const T=used||/ThePornDB/.test(prev), S=usedS||/StashDB/.test(prev); const X=['OnlyFans','Fansly'].filter(n=>usedX.includes(n)||new RegExp(n).test(prev)); rec.source=(T||S||X.length)?[T&&'ThePornDB',S&&'StashDB',...X].filter(Boolean).join(' + ')+' (راجعتُه يدويًا)':(rec.source||'إدخال يدوي'); }
    if(edit) items=items.map(x=>x.id===rec.id?rec:x); else items.push(rec);
    await save(rec); render(); closeOv('ovForm'); toast('تم الحفظ'); btn.disabled=false;
  };
}
$('bAdd').onclick=()=>openForm(null);

// ===== عشوائي / تمويه / الإعدادات / نسخة احتياطية =====
// ===== السحب العشوائي: اختر ممثلات ثم اسحب ممثلة وعملًا لتشاهده =====
let pickSel=null, pickNew=LS.get('vkte_picknew','1')==='1', pickCur=null;
const pickOf=id=>items.find(i=>i.id===id);
const eligible=i=>(i.works||[]).map((w,k)=>({w,k})).filter(x=>!(pickNew&&x.w.w));
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function openPick(){
  if(!items.length){ toast('أضف ممثلات أولًا'); return; }
  const ids=new Set(items.map(i=>i.id)); let saved=null; try{ const a=JSON.parse(LS.get('vkte_pick','null')); if(Array.isArray(a)) saved=a; }catch{}
  pickSel=new Set((pickSel?[...pickSel]:(saved||[...ids])).filter(x=>ids.has(x))); if(!pickSel.size) pickSel=new Set(ids);
  pickCur=null;
  const sorted=items.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  $('mPick').innerHTML=`<div class="fh" style="padding:4px 0 8px"><h2 style="margin:0">سحب عشوائي</h2><button class="ib" id="pkClose" aria-label="إغلاق">${icon('x')}</button></div>
    <p class="src" style="font-size:.85rem;margin-bottom:8px">حدّد الممثلات اللي تبغى تسحب منهن، ثم اضغط «اسحب».</p>
    <div class="pkchips"><span class="chip" data-q="all">الكل</span><span class="chip" data-q="fav">المفضّلة</span><span class="chip" data-q="none">إلغاء الكل</span>${lists.map(L=>`<span class="chip" data-q="L:${L.id}">${esc(L.name)}</span>`).join('')}</div>
    <div class="pklist" id="pkList">${sorted.map(i=>`<label class="pk"><input type="checkbox" data-p="${i.id}" ${pickSel.has(i.id)?'checked':''}><span class="av">${pic(i)?`<img src="${pic(i)}" alt="">`:'♡'}</span><span class="nm">${esc(i.name)}</span><small>${(i.works||[]).length?(i.works||[]).length+' عمل':'بلا أعمال'}</small></label>`).join('')}</div>
    <label style="display:flex;gap:8px;align-items:center;margin:12px 0;cursor:pointer;color:var(--text)"><input type="checkbox" id="pkNew" ${pickNew?'checked':''}> الأعمال اللي ما شاهدتها فقط</label>
    <div class="actions" style="justify-content:space-between;margin-top:0"><span class="src" id="pkCnt"></span><button class="btn gold" id="pkGo">${icon('shuffle')} اسحب</button></div>
    <div id="pkRes"></div>`;
  $('ovPick').classList.add('show'); $('mPick').scrollTop=0; $('mPick').classList.toggle('blur',document.body.classList.contains('blur'));
  const cnt=()=>{ $('pkCnt').textContent=pickSel.size+' ممثلة محددة'; LS.set('vkte_pick',JSON.stringify([...pickSel])); };
  cnt();
  const syncBoxes=()=>$('pkList').querySelectorAll('[data-p]').forEach(b=>b.checked=pickSel.has(b.dataset.p));
  $('pkClose').onclick=()=>closeOv('ovPick');
  $('mPick').onchange=e=>{ const b=e.target.closest('[data-p]'); if(b){ b.checked?pickSel.add(b.dataset.p):pickSel.delete(b.dataset.p); cnt(); return; } if(e.target.id==='pkNew'){ pickNew=e.target.checked; LS.set('vkte_picknew',pickNew?'1':'0'); } };
  const showRes=()=>{ const r=$('pkRes'); if(!pickCur){ r.innerHTML=''; return; } const it=pickOf(pickCur.id); if(!it){ r.innerHTML=''; return; } const w=pickCur.k>=0?it.works[pickCur.k]:null;
    r.innerHTML=`<div class="pkres"><div class="pkc">${pic(it)?`<img src="${pic(it)}" alt="">`:'♡'}</div><div class="pkr"><div class="big">${esc(it.name)}</div>
      ${w?`<div class="pkw"><b>${esc(w.t)}</b><span>${esc([w.s,w.y].filter(Boolean).join(' · '))||'&nbsp;'}</span></div>`:`<div class="pkw"><span>${(it.works||[]).length?'شاهدت كل أعمالها المسجّلة 🎉':'ما عندها أعمال مسجّلة'}</span></div>`}
      <div class="pkb">${w?`<button class="btn gold" data-a="search">ابحث عنه ↗</button><button class="btn" data-a="seen">شاهدته ✓</button><button class="btn" data-a="again">عمل ثاني</button>`:''}<button class="btn" data-a="open">ملفها</button></div></div></div>`; };
  const draw=(sameAct)=>{ let it=sameAct&&pickCur?pickOf(pickCur.id):null;
    if(!it){ const pool=items.filter(i=>pickSel.has(i.id)); if(!pool.length){ toast('حدّد ممثلة وحدة على الأقل'); return; } const withW=pool.filter(i=>eligible(i).length); it=rnd(withW.length?withW:pool); }
    const el=eligible(it); let x=null; if(el.length){ const others=el.filter(y=>!(pickCur&&pickCur.id===it.id&&pickCur.k===y.k)); x=rnd(others.length?others:el); }
    pickCur={id:it.id,k:x?x.k:-1}; showRes(); $('pkRes').scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'nearest'}); };
  $('pkGo').onclick=()=>draw(false);
  $('mPick').onclick=e=>{
    const q=e.target.closest('[data-q]'); if(q){ const v=q.dataset.q; if(v==='all') pickSel=new Set(items.map(i=>i.id)); else if(v==='none') pickSel=new Set(); else if(v==='fav') pickSel=new Set(items.filter(i=>i.fav).map(i=>i.id)); else pickSel=new Set(items.filter(i=>(i.lists||[]).includes(v.slice(2))).map(i=>i.id)); syncBoxes(); cnt(); return; }
    const a=e.target.closest('[data-a]'); if(!a||!pickCur) return; const it=pickOf(pickCur.id); if(!it) return; const k=a.dataset.a;
    if(k==='search'){ const w=it.works[pickCur.k]; openExt('https://www.google.com/search?q='+encodeURIComponent([w.t,w.s].filter(Boolean).join(' '))); }
    else if(k==='seen'){ if(pickCur.k>=0){ it.works[pickCur.k].w=1; save(it); toast('تم تعليمه كمشاهَد'); } draw(true); }
    else if(k==='again') draw(true);
    else if(k==='open'){ closeOv('ovPick'); openDetail(it.id); }
  };
}
$('bRandom').onclick=openPick;
function setBlur(on){ document.body.classList.toggle('blur',on); $('bBlur').classList.toggle('on',on); $('grid').classList.toggle('blur',on); $('mWorks').classList.toggle('blur',on); $('mDetail').classList.toggle('blur',on); $('mLists').classList.toggle('blur',on); $('mStats').classList.toggle('blur',on); $('mPick').classList.toggle('blur',on); }
$('bBlur').onclick=()=>setBlur(!document.body.classList.contains('blur'));
$('bSet').onclick=()=>{ $('kIn').value=LS.get('vkte_key'); $('sdKey').value=LS.get('vkte_stash'); $('autoWorks').checked=LS.get('vkte_autoworks','1')==='1'; $('kMsg').textContent=''; $('ovSet').classList.add('show'); };
$('autoWorks').onchange=e=>LS.set('vkte_autoworks',e.target.checked?'1':'0');
$('kSave').onclick=()=>{ LS.set('vkte_key',$('kIn').value.trim()); LS.set('vkte_stash',$('sdKey').value.trim()); toast('تم حفظ المفاتيح على هذا الجهاز'); };
$('kTest').onclick=async()=>{ LS.set('vkte_key',$('kIn').value.trim()); $('kMsg').textContent='جارٍ الاختبار…'; try{ const rr=await fetch(API()+'/performers?q=a',{headers:{Authorization:'Bearer '+$('kIn').value.trim(),Accept:'application/json'}}); $('kMsg').textContent=rr.ok?'✓ الاتصال يعمل':(rr.status===401||rr.status===403?'✗ المفتاح غير صالح':'✗ رمز '+rr.status); }catch{ $('kMsg').textContent='✗ تعذّر الاتصال (تحقق من الإنترنت)'; } };
$('dbgGo').onclick=async()=>{ const q=$('dbgQ').value.trim(); if(!q) return; const o=$('dbgOut'); o.value='جارٍ الفحص…';
  const cut=(v,d=0)=>{ if(typeof v==='string') return v.length>140?v.slice(0,140)+'…':v; if(Array.isArray(v)) return d>3?'[…]':v.slice(0,3).map(x=>cut(x,d+1)); if(v&&typeof v==='object'){ if(d>4) return '{…}'; const r={}; Object.keys(v).slice(0,40).forEach(k=>r[k]=cut(v[k],d+1)); return r; } return v; };
  try{ const h={Authorization:'Bearer '+($('kIn').value.trim()||LS.get('vkte_key')),Accept:'application/json'}; const base=API();
    const r1=await fetch(base+'/performers?q='+encodeURIComponent(q),h?{headers:h}:{}); const t1=await r1.text(); let j1; try{ j1=JSON.parse(t1); }catch{ o.value='HTTP '+r1.status+'\n'+t1.slice(0,800); return; }
    let out='== بحث: HTTP '+r1.status+' ==\n'+JSON.stringify(cut({first:(j1.data||[])[0],count:(j1.data||[]).length,meta:j1.meta,links:j1.links}),null,1);
    const f=(j1.data||[])[0]; if(f&&f.id){ try{ const r2=await fetch(base+'/performers/'+encodeURIComponent(f.id)+'/scenes?page=1&per_page=3',{headers:h}); const t2=await r2.text(); let j2; try{ j2=JSON.parse(t2); out+='\n\n== أعمال: HTTP '+r2.status+' ==\n'+JSON.stringify(cut({first:(j2.data||[])[0],count:(j2.data||[]).length,meta:j2.meta}),null,1); }catch{ out+='\n\n== أعمال: HTTP '+r2.status+' ==\n'+t2.slice(0,500); } }catch(e){ out+='\n\n== أعمال: تعذّر الاتصال =='; } }
    o.value=out; }catch(e){ o.value='تعذّر الاتصال: '+(e&&e.message||''); } };
$('sdGo').onclick=async()=>{ const k=$('sdKey').value.trim()||LS.get('vkte_stash'); const q=$('sdQ').value.trim(); const o=$('sdOut'); if(!k){ o.value='الصق المفتاح أولًا'; return; } if(!q){ o.value='اكتب اسمًا'; return; } LS.set('vkte_stash',k); o.value='جارٍ الفحص…';
  const cut=(v,d=0)=>{ if(typeof v==='string') return v.length>140?v.slice(0,140)+'…':v; if(Array.isArray(v)) return d>7?'[…]':v.slice(0,4).map(x=>cut(x,d+1)); if(v&&typeof v==='object'){ if(d>4) return '{…}'; const r={}; Object.keys(v).slice(0,40).forEach(x=>r[x]=cut(v[x],d+1)); return r; } return v; };
  try{ const r=await fetch('https://stashdb.org/graphql',{method:'POST',headers:{'Content-Type':'application/json',ApiKey:k},body:JSON.stringify({query:'query($t:String!){searchPerformer(term:$t,limit:3){id name aliases birth_date country urls{url} images{url width height}}}',variables:{t:q}})});
    const t=await r.text(); let j; try{ j=JSON.parse(t); }catch{ o.value='HTTP '+r.status+'\n'+t.slice(0,600); return; }
    o.value='HTTP '+r.status+'\n'+JSON.stringify(cut(j),null,1); }catch(e){ o.value='تعذّر الاتصال ('+(e&&e.message||'')+').'; } };
$('sdCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText($('sdOut').value); toast('تم النسخ'); }catch{ $('sdOut').select(); toast('حدّد النص وانسخه'); } };
$('dbgCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText($('dbgOut').value); toast('تم النسخ'); }catch{ $('dbgOut').select(); toast('حدّد النص وانسخه'); } };

/* ===== الاقتراحات الذكية — تطوير التحليل والميزات =====
   الدقة:
   1) وزن كل ممثلة في بصمة الذوق صار يقرأ إشاراتك الفعلية الجديدة: المستوى (S..D)، نقاط المواجهات، وعدد الزيارات.
   2) «الشبه بمفضّلاتك»: كل مرشّحة تُقارن مباشرة بأقرب ثلاث من مفضّلاتك (لا بمتوسط عام فقط)، ويدخل ذلك في نسبة التوافق وفي سبب الاقتراح.
   الميزات: تفضيلات الاقتراح (نطاق العمر، دول مستبعدة، صورة مطلوبة، حد أدنى للتوافق)، «شبيهات ممثلة» من مكتبتك،
   «أعجبتني» لتعليم النظام دون إضافة، صفحة تحليل الذوق، وإعادة ضبط التعلّم.
   بوابة +18 والجنس تبقى كما هي داخل recEligible ولا يتجاوزها أي مسار هنا. */
const RecsPlus=(()=>{
  const jget=(k,d)=>{ try{ const v=JSON.parse(LS.get(k,'null')); return v==null?d:v; }catch{ return d; } };
  const PKEY='vkte_rec_prefs';
  const prefs=()=>Object.assign({amin:'',amax:'',xcc:[],photo:false,minM:0},jget(PKEY,{}));
  const setPrefs=p=>LS.set(PKEY,JSON.stringify(p));
  const again=()=>{ if(window.recsRerank) window.recsRerank(); };
  FEAT_AR.like='الشبه بمفضّلاتك';

  // ---------- 1) إشارات جديدة في وزن الممثلة ----------
  const TIERW={S:1.3,A:.8,B:.3,C:-.1,D:-.6};
  const _pw=perfWeight;
  perfWeight=function(it){ let w=_pw(it);
    if(it.tier&&TIERW[it.tier]!=null) w+=TIERW[it.tier];
    if(it.duels>=3) w+=recClamp(((it.elo||1000)-1000)/160,-.8,1.1);          // ترتيب المواجهات: ذوق فعلي لا تقييم معلن
    if(it.views>2) w+=Math.min(.5,Math.log2(it.views)/10);                   // من تعود لملفها كثيرًا
    return recClamp(w,-1.8,4); };

  // ---------- 2) الشبه بمفضّلاتك (أقرب الجيران) ----------
  const CW={country:1,eth:.9,hair:.8,eyes:.4,cup:.6}, NW={age:[1,4],height:[.6,6],exp:[.3,4]};
  function sim(a,b){ let num=0, den=0; const shared=[];
    Object.keys(CW).forEach(k=>{ if(a[k]&&b[k]){ den+=CW[k]; if(a[k]===b[k]){ num+=CW[k]; shared.push(k); } } });
    Object.keys(NW).forEach(k=>{ if(a[k]!=null&&b[k]!=null){ const [w,s]=NW[k], m=Math.exp(-Math.pow((a[k]-b[k])/s,2)); den+=w; num+=w*m; if(m>.7) shared.push(k); } });
    return den>=1.8?{s:num/den,shared,den}:null; }
  let LV=[], LVat=0;
  function libVecs(){ if(Date.now()-LVat<4000&&LV.length) return LV;
    LV=items.map(it=>({it,w:perfWeight(it),f:libFeats(it)})).filter(x=>x.w>=1&&Object.keys(x.f).length>=2).sort((a,b)=>b.w-a.w).slice(0,80); LVat=Date.now(); return LV; }
  function knn(c){ const f=candFeats(c), L=libVecs(); if(L.length<3||Object.keys(f).length<2) return null;
    const r=[]; L.forEach(x=>{ const s=sim(f,x.f); if(s) r.push({it:x.it,s:s.s*(.65+.35*Math.min(1,x.w/2.5)),raw:s.s,shared:s.shared}); });
    if(r.length<3) return null; r.sort((a,b)=>b.s-a.s); const top=r.slice(0,3);
    return {s:top.reduce((a,x)=>a+x.s,0)/3,near:top.filter(x=>x.raw>=.7).slice(0,2)}; }
  const _rs=recScore;
  recScore=function(c,P){ const r=_rs(c,P), k=knn(c);
    if(k){ r.fs.like=recClamp(k.s,0,1); r.raw=recClamp(.74*r.raw+.26*k.s+(k.near.length?.02:0),0,1); r.near=k.near.map(x=>x.it.name); }
    c.near=r.near||[]; return r; };
  const _rr=recReasons;
  recReasons=function(c,P,r){ const out=_rr(c,P,r); if(r.near&&r.near.length) out.unshift('تشبه '+r.near.join(' و ')+' من مفضّلاتك'); return out.filter(x=>x!=='توافق جزئي مع ذوقك العام'||out.length===1); };

  // ---------- 3) تفضيلات الاقتراح (فلاتر صارمة فوق بوابة الأهلية) ----------
  const _re=recEligible;
  recEligible=function(c,idx,ign){ if(!_re(c,idx,ign)) return false; const p=prefs(), a=candAge(c);
    if(p.amin!==''&&a<+p.amin) return false; if(p.amax!==''&&a>+p.amax) return false;
    if(p.xcc.length&&c.cc&&p.xcc.includes(c.cc)) return false; if(p.photo&&!c.img) return false; return true; };
  const filter=l=>{ const m=+prefs().minM||0; return m?l.filter(c=>(c.matchPct||0)>=m):l; };

  function openPrefs(){ const p=prefs(), cnt={}; (_recPool.list||[]).forEach(c=>{ if(c.cc) cnt[c.cc]=(cnt[c.cc]||0)+1; }); p.xcc.forEach(c=>{ cnt[c]=cnt[c]||0; });
    const ccs=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,18);
    askShow(`<div class="fh"><h2>🎚 تفضيلات الاقتراح</h2><button class="ib" id="aNo" aria-label="إغلاق">${icon('x')}</button></div>
      <p class="src">شروط صارمة تُطبَّق على كل الاقتراحات. الحد الأدنى للعمر لا يقل عن 18 مهما كتبت.</p>
      <h3>نطاق العمر</h3><div class="v17age"><input class="in" id="rpMin" type="number" inputmode="numeric" min="18" max="99" placeholder="من (18)" value="${esc(p.amin)}"><span>—</span><input class="in" id="rpMax" type="number" inputmode="numeric" min="18" max="99" placeholder="إلى" value="${esc(p.amax)}"></div>
      <h3>الحد الأدنى للتوافق</h3><div class="v17chips" id="rpM">${[[0,'الكل'],[60,'60٪+'],[70,'70٪+'],[80,'80٪+']].map(([v,t])=>`<span class="chip ${+p.minM===v?'on':''}" data-m="${v}">${t}</span>`).join('')}</div>
      ${ccs.length?`<h3>لا تقترح من هذه الدول</h3><div class="v17chips" id="rpC">${ccs.map(([c,n])=>`<span class="chip ${p.xcc.includes(c)?'on':''}" data-c="${c}">${esc(ctryName(c))}${n?` <small>${n}</small>`:''}</span>`).join('')}</div>`:''}
      <label class="ck"><input type="checkbox" id="rpPh" ${p.photo?'checked':''}> اقترح من لها صورة فقط</label>
      <div class="actions"><button class="btn danger" id="rpReset">إعادة ضبط التعلّم</button><button class="btn gold" id="aOk">حفظ</button></div>`,(m,done)=>{
      m.classList.add('wide'); $('aNo').onclick=()=>done(null);
      m.onclick=e=>{ const c=e.target.closest('#rpC [data-c]'), mm=e.target.closest('#rpM [data-m]'); if(c) c.classList.toggle('on'); if(mm) m.querySelectorAll('#rpM .chip').forEach(x=>x.classList.toggle('on',x===mm)); };
      $('rpReset').onclick=async()=>{ done(null); if(await askConfirm('يُمسح ما تعلّمه النظام من قبولك واستبعادك، وتُفرَّغ قائمة المستبعَدات. الممثلات في مكتبتك لا تتأثر. متابعة؟','إعادة ضبط',true)){
          _recFeedback=FB0(); saveRecFeedback(); _recIgnored=[]; saveRecIgnored(); toast('أُعيد ضبط التعلّم'); again(); } };
      $('aOk').onclick=()=>{ const n=v=>{ v=parseInt(v,10); return isNaN(v)?'':Math.max(18,Math.min(99,v)); };
        setPrefs({amin:n($('rpMin').value),amax:n($('rpMax').value),minM:+((m.querySelector('#rpM .on')||{dataset:{m:0}}).dataset.m)||0,xcc:[...m.querySelectorAll('#rpC .on')].map(x=>x.dataset.c),photo:$('rpPh').checked});
        done(true); toast('حُفظت التفضيلات'); again(); paintAllQuick(); }; }); }
  const prefsN=()=>{ const p=prefs(); return (p.amin!==''||p.amax!==''?1:0)+(p.xcc.length?1:0)+(p.photo?1:0)+(+p.minM?1:0); };

  // ---------- 4) «أعجبتني»: تعليم إيجابي دون إضافة ----------
  function like(c){ recLearn(c,true,.6); _recFeedback.acc=Math.max(0,_recFeedback.acc-1); saveRecFeedback(); toast('👍 سيقترح النظام أكثر مثل «'+c.name+'»'); again(); }

  // ---------- 5) شبيهات ممثلة من مكتبتك ----------
  const FTXT={country:v=>ctryName(v),eth:v=>ETH_AR[v]||v,hair:v=>HAIR_AR[v]||v,eyes:v=>EYE_AR[v]||v,cup:()=>'قياسات قريبة',age:()=>'عمر قريب',height:()=>'طول قريب',exp:()=>'مسيرة قريبة'};
  async function fetchLike(f){ if(!LS.get('vkte_stash')||navigator.onLine===false) return 0; const caps=await sdCaps(), sp={};
    if(f.country) sp.cc=f.country; if(f.eth) sp.eth=f.eth; if(f.hair) sp.hair=f.hair; if(f.age) sp.age=[Math.max(18,f.age-4),f.age+4];
    const idx=libIndex(), ign=new Set(_recIgnored.map(norm)), have=new Set(_recPool.list.map(c=>c.k)); let n=0;
    for(const page of [1,2]){ const d=await sdQ(sdPerfQuery(caps,sp,page,40),{});
      ((d.queryPerformers&&d.queryPerformers.performers)||[]).forEach(p=>{ const mm=mapSx(p); if(caps.g&&!mm.gender) mm.gender='female'; if(!mm.gender) return; const s=slimCand(mm); if(!have.has(s.k)&&recEligible(s,idx,ign)){ _recPool.list.push(s); have.add(s.k); n++; } }); }
    if(n) saveRecPool(); return n; }
  async function likeOf(it){ if(!it) return; const f=libFeats(it);
    if(Object.keys(f).length<2){ await askNote('لا تكفي صفات «'+it.name+'» المعروفة للمقارنة. افتح «اكتشف» واضغط «تجديد» ليحلّل النظام ملفها من المصدر، ثم أعد المحاولة.'); return; }
    busy.show('البحث عن شبيهات «'+it.name+'»…'); let got=0; try{ got=await fetchLike(f); }catch{} busy.hide();
    const idx=libIndex(), ign=new Set(_recIgnored.map(norm));
    const res=(_recPool.list||[]).filter(c=>recEligible(c,idx,ign)).map(c=>{ const s=sim(candFeats(c),f); return s?{c,s:s.s,shared:s.shared}:null; }).filter(x=>x&&x.s>=.5).sort((a,b)=>b.s-a.s).slice(0,24);
    res.forEach(x=>{ const c=x.c; c.raw=x.s; c.fs=c.fs||{}; c.matchPct=recClamp(Math.round(40+x.s*60),40,98); c.reasons=['تشبه '+it.name+': '+x.shared.map(k=>FTXT[k](candFeats(c)[k])).join('، ')]; c.age=candAge(c); });
    askShow(`<div class="fh"><h2>👯 شبيهات ${esc(it.name)}</h2><button class="ib" id="aNo" aria-label="إغلاق">${icon('x')}</button></div>
      <p class="src" style="margin-bottom:10px">مرتّبات حسب تطابق الصفات معها${got?' · جُلبت '+got+' مرشّحة جديدة':''}${LS.get('vkte_stash')?'':' · أضف مفتاح StashDB لنتائج أوسع'}.</p>
      ${res.length?`<div class="v17opts" style="max-height:62dvh">${res.map((x,n)=>`<div class="rl"><button type="button" class="rl-m" data-pv="${n}"><span class="av">${x.c.img?`<img src="${esc(x.c.img)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()" alt="">`:'♡'}</span><span class="t"><b>${esc(x.c.name)}</b><small>${esc([x.c.cc?ctryName(x.c.cc):'',x.c.age?x.c.age+' سنة':''].filter(Boolean).join(' · '))}</small><small class="rl-s">${x.shared.map(k=>esc(FTXT[k](candFeats(x.c)[k]))).join(' · ')}</small></span><em>${x.c.matchPct}٪</em></button><button type="button" class="ib sm on" data-ad="${n}" aria-label="إضافة">${icon('plus')}</button></div>`).join('')}</div>`
        :'<div class="empty"><b>لا شبيهات كافية حاليًا</b>اضغط «تجديد» في صفحة الاقتراحات لتوسيع المرشّحات، أو أضف مفتاح StashDB.</div>'}`,(m,done)=>{
      m.classList.add('wide'); m.classList.toggle('blur',document.body.classList.contains('blur')); $('aNo').onclick=()=>done(null);
      m.onclick=e=>{ const a=e.target.closest('[data-ad]'), p=e.target.closest('[data-pv]'); if(a){ const c=res[+a.dataset.ad].c; a.disabled=true; a.closest('.rl').classList.add('done'); addRecToLibrary(c); } else if(p){ done(null); previewRecPerformer(res[+p.dataset.pv].c); } }; }); }
  async function pickLike(){ const pool=items.filter(i=>Object.keys(libFeats(i)).length>=2).sort((a,b)=>perfWeight(b)-perfWeight(a));
    if(!pool.length){ await askNote('لم تُحلَّل صفات ممثلات مكتبتك بعد. اضغط «تجديد» في الاقتراحات ثم أعد المحاولة.'); return; }
    const id=await askShow(`<div class="fh"><h2>شبيهات مَن؟</h2><button class="ib" id="aNo" aria-label="إغلاق">${icon('x')}</button></div><div class="v17opts" style="max-height:66dvh">${pool.slice(0,150).map(i=>`<button type="button" class="v17row" data-id="${esc(i.id)}"><span class="av">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" alt="">`:'♡'}</span><span class="t"><b>${esc(i.name)}</b><small>${esc(i.country||'')}${i.rating?' · ★ '+(+i.rating).toFixed(1):''}</small></span></button>`).join('')}</div>`,(m,done)=>{
      m.classList.toggle('blur',document.body.classList.contains('blur')); $('aNo').onclick=()=>done(null); m.onclick=e=>{ const b=e.target.closest('[data-id]'); if(b) done(b.dataset.id); }; });
    if(id) likeOf(items.find(i=>i.id===id)); }

  // ---------- 6) صفحة تحليل الذوق ----------
  function openTaste(){ const P=buildTasteProfile(); if(!P){ toast('أضف ممثلات أولًا'); return; }
    const mult=k=>_recFeedback.w[k]!=null?_recFeedback.w[k]:1, pct=x=>Math.round(x*100);
    const MAP={country:ctryName,eth:k=>ETH_AR[k]||k,hair:k=>HAIR_AR[k]||k,eyes:k=>EYE_AR[k]||k,cup:k=>({small:'صغير',medium:'متوسط',large:'كبير'})[k]||k,studio:k=>k,tag:k=>'#'+k};
    const imp=Object.keys(P.imp).map(k=>[k,P.imp[k]*mult(k)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]), mx=imp[0]?imp[0][1]:1;
    const catCard=k=>{ const m=P.cat[k]; if(!m||!m.top.length) return ''; return `<div class="gc"><h3>${FEAT_AR[k]}<small>${m.n} عيّنة</small></h3>${m.top.slice(0,5).map(([v,s])=>`<div class="brow"><span class="bl" dir="auto">${esc(MAP[k](v))}</span><div class="bt"><div class="bf" style="width:${Math.max(4,s/m.top[0][1]*100)}%"></div></div><span class="bv">${pct(s)}٪</span></div>`).join('')}</div>`; };
    const numCard=(k,unit)=>{ const m=P.num[k]; if(!m) return ''; return `<div class="tn"><b>${Math.round(m.mu)}<small> ${unit}</small></b><span>${FEAT_AR[k]}</span><em>${Math.round(Math.max(k==='age'?18:0,m.mu-m.sd))}–${Math.round(m.mu+m.sd)} غالبًا</em></div>`; };
    const lead=items.map(i=>[i,perfWeight(i)]).filter(x=>x[1]>.6).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const ins=[]; const t=(k)=>P.cat[k]&&P.cat[k].top[0];
    if(imp[0]) ins.push(`أكثر ما يحدّد ذوقك: <b>${FEAT_AR[imp[0][0]]}</b>${imp[1]?' ثم <b>'+FEAT_AR[imp[1][0]]+'</b>':''}.`);
    if(t('country')&&t('country')[1]>=.3) ins.push(`<b>${pct(t('country')[1])}٪</b> من وزن ذوقك لممثلات من <b>${esc(ctryName(t('country')[0]))}</b>.`);
    if(t('hair')&&t('hair')[1]>=.4) ins.push(`تميل بوضوح إلى <b>${esc(HAIR_AR[t('hair')[0]]||t('hair')[0])}</b>.`);
    if(P.num.age) ins.push(`نطاق العمر الذي تفضّله: <b>${Math.max(18,Math.round(P.num.age.mu-P.num.age.sd))}–${Math.round(P.num.age.mu+P.num.age.sd)}</b> سنة.`);
    const n=_recFeedback.acc+_recFeedback.rej; if(n>=4) ins.push(`قبلت <b>${pct(_recFeedback.acc/n)}٪</b> من الاقتراحات التي حكمت عليها (${n}).`);
    const used=[items.some(i=>i.tier)&&'المستويات',items.some(i=>i.duels>=3)&&'المواجهات',items.some(i=>i.views>2)&&'الزيارات',items.some(i=>i.rating>0)&&'التقييمات',items.some(i=>i.fav)&&'المفضلة'].filter(Boolean);
    askShow(`<div class="fh"><h2>🧬 تحليل ذوقك</h2><button class="ib" id="aNo" aria-label="إغلاق">${icon('x')}</button></div>
      <div class="wrapk"><div><b>${P.nPos}</b><span>ممثلة تشكّل ذوقك</span></div><div><b>${pct(P.conf)}٪</b><span>ثقة التحليل</span></div><div><b>${P.withAttrs}/${P.n}</b><span>ملفات محلَّلة</span></div><div><b>${n}</b><span>ردودك على الاقتراحات</span></div></div>
      ${ins.length?`<div class="gc" style="margin-bottom:10px">${ins.map(x=>`<div class="ins"><i></i><div>${x}</div></div>`).join('')}</div>`:''}
      <div class="tnums">${numCard('age','سنة')}${numCard('height','سم')}${numCard('exp','سنة')}</div>
      <div class="gc" style="margin:10px 0"><h3>ما الذي يحدّد ذوقك؟<small>يتغيّر مع تعلّم النظام</small></h3>${imp.map(([k,v])=>`<div class="brow"><span class="bl">${FEAT_AR[k]||k}</span><div class="bt"><div class="bf" style="width:${Math.max(4,v/mx*100)}%"></div></div><span class="bv">${pct(v/mx)}٪</span></div>`).join('')}</div>
      <div class="sx">${['country','eth','hair','eyes','cup','studio','tag'].map(catCard).join('')}</div>
      ${lead.length?`<h3>أكثر من يشكّل ذوقك</h3><div class="wrapp">${lead.map(([i,w])=>`<button type="button" class="hc" data-od="${esc(i.id)}"><span class="hc-ph">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" alt="">`:'♡'}</span><b>${esc(i.name)}</b><small>وزن ${w.toFixed(1)}</small></button>`).join('')}</div>`:''}
      <p class="src" style="margin-top:12px">الإشارات المستخدمة: ${used.join('، ')||'—'}. ${P.withAttrs<P.n?'بقية الملفات تُحلَّل تدريجيًا عند كل «تجديد».':''}</p>`,(m,done)=>{
      m.classList.add('wide'); m.classList.toggle('blur',document.body.classList.contains('blur')); $('aNo').onclick=()=>done(null);
      m.onclick=e=>{ const o=e.target.closest('[data-od]'); if(o){ done(null); openDetail(o.dataset.od); } }; }); }

  // ---------- شريط الأدوات السريع في صفحة الاقتراحات ----------
  function quickHtml(){ const n=prefsN(); return `<button type="button" class="chip" data-rq="taste">🧬 تحليل ذوقي</button><button type="button" class="chip" data-rq="like">👯 شبيهات ممثلة</button><button type="button" class="chip ${n?'on':''}" data-rq="prefs">🎚 التفضيلات${n?' ('+n+')':''}</button>`; }
  const paintQuick=root=>{ const el=root.querySelector('.rx-quick'); if(el) el.innerHTML=quickHtml(); };
  const paintAllQuick=()=>document.querySelectorAll('.rx-quick').forEach(el=>{ el.innerHTML=quickHtml(); });
  document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-rq]'); if(!b) return; const k=b.dataset.rq; if(k==='taste') openTaste(); else if(k==='like') pickLike(); else if(k==='prefs') openPrefs(); });

  // زر «شبيهات لها» في ملف الممثلة
  const _od=openDetail;
  openDetail=function(id){ const r=_od.apply(this,arguments);
    try{ const it=items.find(x=>x.id===id), t=document.querySelector('#mDetail .v17t'); if(it&&t&&!t.querySelector('[data-rl]')&&(LS.get('vkte_key')||LS.get('vkte_stash'))){ const b=document.createElement('button'); b.type='button'; b.dataset.rl='1'; b.textContent='👯 اقترح شبيهات لها'; b.onclick=e=>{ e.stopPropagation(); likeOf(it); }; t.appendChild(b); } }catch{}
    return r; };
  return {filter,like,paintQuick,openPrefs,openTaste,likeOf,pickLike,prefs};
})();
window.RecsPlus=RecsPlus;

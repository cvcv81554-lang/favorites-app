/* ===== v34: «اكتشف» و«الاقتراحات الذكية» — تجربة اكتشاف متجددة تتعلّم من الاستخدام =====
   طبقة فوق المحرك (04-analytics + 26-recs-plus) بنفس أسلوب اللفّ: كل دالة قديمة تُستدعى أولًا، ولا يُخفَّف أي شرط.
   - تحقق صارم من العمر لـ«اكتشافات 18–21»: تاريخ كامل صالح من قاعدة بيانات (StashDB/ThePornDB)،
     بلا تضارب بين المصادر، والعمر يُحسب الآن من التاريخ (لا يُخزَّن ولا يُستنتج من الصور).
   - منع التكرار: سجل ظهور لكل اسم، وعقوبة متصاعدة، وإراحة الأسماء التي تكررت دون تفاعل.
   - التنويع: إعادة ترتيب تراعي البلد والعرق والشعر والعمر (لا البلد وحده).
   - إشارات استخدام إضافية: من تصفحتهن مؤخرًا، وعضوية القوائم، و«احفظ لاحقًا».
   - مسارات: اكتشاف اليوم، مختارات الأسبوع، 18–21، قريبات من مفضلاتك، من استوديوهاتك، وجوه جديدة، خارج المألوف…
   - في «الاقتراحات الذكية»: مؤكدة / لأنك تصفحت مؤخرًا / 18–21 حسب ذوقك / بيانات محدودة + أدوات التحكم. */
const Discover=(()=>{
  const jget=(k,d)=>{ try{ const v=JSON.parse(LS.get(k,'null')); return v==null?d:v; }catch{ return d; } };
  const DX_KEY='vkte_rec_dx', IMP_KEY='vkte_rec_imp', PICK_KEY='vkte_rec_picks';
  const dx=()=>Object.assign({div:1,expl:1,rep:1},jget(DX_KEY,{}));
  const todayK=()=>todayStr();
  const weekK=()=>{ const d=new Date(), t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())), w=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-w); const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return t.getUTCFullYear()+'-W'+Math.ceil(((t-y0)/864e5+1)/7); };
  const kOf=c=>c.k||norm(c.name);
  const flagOf=cc=>/^[A-Z]{2}$/.test(cc||'')?String.fromCodePoint(...[...cc].map(ch=>127397+ch.charCodeAt(0))):'';
  const SRC_N={stash:'StashDB',tpdb:'ThePornDB'};

  // ================= 1) التحقق من العمر =================
  function validDate(d){ if(!/^\d{4}-\d{2}-\d{2}$/.test(d||'')) return false; const [y,m,dd]=d.split('-').map(Number), x=new Date(Date.UTC(y,m-1,dd));
    return y>1900&&x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===dd&&x.getTime()<=Date.now(); }
  // العمر الدقيق بالتقويم المحلي (عيد الميلاد اليوم يُحتسب)
  function exactAge(d){ const [y,m,dd]=d.split('-').map(Number), t=new Date(); let a=t.getFullYear()-y; const mo=t.getMonth()+1; if(mo<m||(mo===m&&t.getDate()<dd)) a--; return a; }
  /** {ok, age, date, srcs, why}: يُقبل فقط تاريخ كامل صالح من قاعدة بيانات، ومتطابق في كل المصادر وكل الحقول. */
  function verifyAge(c){
    const bs=Object.assign({}, c.bs||{});
    if(!Object.keys(bs).length){ const v=String(c.birthRaw||c.birth||'').trim(); if(v) bs[/stash/i.test(c.src||'')?'stash':/porndb/i.test(c.src||'')?'tpdb':'other']=v.slice(0,10); }
    // أي حقل آخر في السجل يخالف ما قاله المصدر = تضارب
    [c.birth,c.birthRaw].forEach((v,i)=>{ v=String(v||'').trim().slice(0,10); if(v&&!Object.values(bs).includes(v)) bs['f'+i]=v; });
    const vals=Object.entries(bs).filter(([,v])=>v);
    if(!vals.length) return {ok:false,why:'لا يوجد تاريخ ميلاد'};
    if(vals.some(([,v])=>!validDate(v))) return {ok:false,why:'تاريخ الميلاد ناقص أو غير صالح'};
    if(new Set(vals.map(([,v])=>v)).size>1) return {ok:false,why:'تضارب في تاريخ الميلاد بين المصادر'};
    const db=vals.map(([s])=>s).filter(s=>s==='stash'||s==='tpdb');
    if(!db.length) return {ok:false,why:'تاريخ الميلاد غير موثّق من قاعدة بيانات'};
    const date=vals[0][1], age=exactAge(date);
    if(!(age>=18)) return {ok:false,why:'أقل من 18',minor:true};
    return {ok:true,age,date,srcs:[...new Set(db)]};
  }
  /** «اكتشافات 18–21»: يُعاد الحساب عند كل عرض، ولا تُدرج إلا بالغة 18–21 موثّقة، ومع موافقة بوابة التطبيق العامة. */
  function young(c){ const v=verifyAge(c); if(!v.ok||v.age<18||v.age>21) return null; const a2=candAge(c); if(a2==null||a2<18) return null; return v; }

  // ================= 2) منع التكرار =================
  let imp=jget(IMP_KEY,{}), impT=0;
  const saveImp=()=>{ clearTimeout(impT); impT=setTimeout(()=>{ const cut=Date.now()-30*864e5; Object.keys(imp).forEach(k=>{ if(imp[k][1]<cut) delete imp[k]; }); LS.set(IMP_KEY,JSON.stringify(imp)); },400); };
  /** ظهور واحد في اليوم لكل اسم (التنقل داخل الصفحة لا يضخّم العدد). */
  function seen(list){ const d=todayK(); let ch=false; (list||[]).forEach(c=>{ const k=kOf(c), e=imp[k]; if(e&&e[2]===d) return; imp[k]=[(e&&Date.now()-e[1]<14*864e5?e[0]:0)+1,Date.now(),d]; ch=true; }); if(ch) saveImp(); }
  const impN=k=>{ const e=imp[k]; return e&&Date.now()-e[1]<14*864e5?e[0]:0; };
  const isSavedK=k=>jget('vkte_rec_saved',[]).some(s=>(s.k||norm(s.name))===k);
  /** ظهرت مرارًا دون تفاعل ← ترتاح حتى ينقضي أسبوعان على آخر ظهور. */
  const snoozed=c=>{ const k=kOf(c), lim=[10,6,4][dx().rep]; return impN(k)>=lim&&!isSavedK(k); };

  // ================= 3) لفّ المحرك (بعد 26؛ لا يُرخى أي شرط) =================
  // بوابة +18 على كل المصادر: إن قال أي مصدر إن عمرها أقل من 18 (أو تاريخه غير مفهوم) تُستبعد من كل القوائم
  const anySourceMinor=c=>Object.values(c.bs||{}).some(v=>{ if(!v) return false; const a=sdAge(v); return a!=null&&(isNaN(a)||a<18); });
  { const _re=recEligible; recEligible=function(c){ if(!_re.apply(this,arguments)) return false; if(anySourceMinor(c)) return false; return !snoozed(c); }; }
  { const _er=recExploreRate; recExploreRate=function(){ return Math.min(0.5,_er.apply(this,arguments)*[0.5,1,1.6][dx().expl]); }; }
  { const _pw=perfWeight; perfWeight=function(it){ let w=_pw.apply(this,arguments);
      const rec=jget('vkte_recent',[]), i=rec.indexOf(it&&it.id); if(i>=0) w+=0.45*(1-i/14);          // تصفحتها مؤخرًا
      const nl=((it&&it.lists)||[]).length; if(nl) w+=Math.min(0.24,0.12*nl);                         // في قوائمك
      return Math.max(-1.8,Math.min(4,w)); }; }
  const ageBand=c=>{ const a=candAge(c); return a==null?'':a<25?'a':a<30?'b':a<36?'c':'d'; };
  const simA=(a,b)=>{ const x=a.at||{}, y=b.at||{}; return (a.cc&&a.cc===b.cc?0.4:0)+(x.e&&x.e===y.e?0.3:0)+(x.hr&&x.hr===y.hr?0.2:0)+(ageBand(a)&&ageBand(a)===ageBand(b)?0.1:0); };
  /** إعادة ترتيب تُنوّع (تبقي الأنسب أولًا، وتؤخر المتشابهات المتتالية). */
  function diversify(l){ const lam=[0.03,0.08,0.15][dx().div], out=[], left=l.slice();
    while(left.length){ let bi=0,bv=-9; left.forEach((c,i)=>{ const pen=out.slice(-5).reduce((s,o)=>s+simA(c,o),0); const v=(c.raw||0)-lam*pen; if(v>bv){ bv=v; bi=i; } }); out.push(left.splice(bi,1)[0]); }
    return out; }
  { const _rr=recRank; recRank=function(P){ (_recPool.list||[]).forEach(c=>{ const n=impN(c.k||norm(c.name)); if(n) c.shown=Math.max(c.shown||0,Math.min(4,Math.ceil(n/2))); });
      memo.key=''; return diversify(_rr.apply(this,arguments)); }; }

  // ================= 4) المرشحات المصنّفة =================
  let memo={key:'',list:[]};
  /** كل المرشحات المؤهلة (قائمة العرض ثم بقية المخزون) مصنّفة بنفس دالة التقييم. */
  function ranked(){ const RS=window.RecsUI?RecsUI.RS:{hide:new Set()}; const key=[(_recPool.list||[]).length,_recPool.at||0,(_recCache.list||[]).length,_recCache.at||0,RS.hide.size,items.length,todayK(),LS.get('vkte_rec_prefs',''),LS.get(DX_KEY,'')].join('|');
    if(memo.key===key) return memo.list;
    const P=RS.P||buildTasteProfile(), idx=libIndex(), ign=new Set(_recIgnored.map(norm)), have=new Set(), out=[];
    (_recCache.list||[]).forEach(c=>{ const k=kOf(c); if(have.has(k)||RS.hide.has(k)||!recEligible(c,idx,ign)) return; have.add(k); out.push(c); });
    if(P) (_recPool.list||[]).forEach(c=>{ const k=kOf(c); if(have.has(k)||RS.hide.has(k)||!recEligible(c,idx,ign)) return;
      try{ const r=recScore(c,P); c.raw=r.raw; c.fs=r.fs; c.cov=r.cov; c.reasons=recReasons(c,P,r); c.matchPct=recClamp(Math.round(40+c.raw*60),40,98); }catch{ return; }
      have.add(k); out.push(c); });
    out.sort((a,b)=>(b.raw||0)-(a.raw||0));
    const fin=window.RecsPlus&&RecsPlus.filter?RecsPlus.filter(out):out;   // نفس تفضيلات المستخدم (أقل توافق…) كبقية التبويبات
    memo={key,list:fin}; return fin; }
  /** مؤكدة = بيانات كافية (4 خصائص فأكثر) وتوافق جيد أو شبه بمفضّلة؛ والباقي «بيانات محدودة». */
  const confirmed=c=>(Object.keys(c.fs||{}).filter(k=>c.fs[k]!=null).length>=4&&(c.raw||0)>=0.5)||((c.near||[]).length>0&&(c.raw||0)>=0.45);
  const seeded=(arr,seed)=>{ let s=hhash(seed)||1; const r=()=>((s=(s*48271)%2147483647)/2147483647); return arr.map(x=>[x,r()]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]); };
  /** اختيار ثابت طوال اليوم/الأسبوع (لا يتبدل مع كل فتح)، مع حد لكل بلد. */
  function stablePick(tag,period,pool,n,capCC,div){ const all=jget(PICK_KEY,{}), id=tag+'|'+period, byK=new Map(pool.map(c=>[kOf(c),c]));
    const prev=(all[id]||[]).map(k=>byK.get(k)).filter(Boolean); if(prev.length>=Math.min(n,3)) return prev;
    const base=div?diversify(pool.slice(0,60)):pool, cand=seeded(base.slice(0,Math.max(n*4,24)).filter(c=>impN(kOf(c))<3),id), out=[], cc={};
    for(const c of cand){ if(out.length>=n) break; const k=c.cc||'?'; if((cc[k]=(cc[k]||0)+1)>capCC) continue; out.push(c); }
    out.sort((a,b)=>(b.raw||0)-(a.raw||0)); all[id]=out.map(kOf); Object.keys(all).forEach(k=>{ if(!k.endsWith(period)&&!k.includes('-W')) delete all[k]; }); LS.set(PICK_KEY,JSON.stringify(all)); return out; }

  // ================= 5) العرض =================
  // بطاقة ملصق مدمجة للمسارات (الضغط يفتح ورقة التفاصيل نفسها: إضافة / حفظ / ليست ذوقي)
  const card=c=>{ const k=kOf(c), a=candAge(c), m=c.matchPct||recClamp(Math.round(40+(c.raw||0)*60),40,98), why=(c.reasons||[])[0]||'';
    return `<button type="button" class="dx-pc" data-act="open" data-k="${esc(k)}"><span class="dx-ph">${c.img?`<img src="${esc(c.img)}" width="300" height="400" referrerpolicy="no-referrer" loading="lazy" decoding="async" alt="" onerror="this.remove()">`:'<i aria-hidden="true">♡</i>'}<em class="dx-m">${m}٪</em>${c.explore?'<em class="dx-x">استكشاف</em>':''}</span>
      <b>${esc(c.name)}</b><small>${esc([(flagOf(c.cc)+' '+(c.cc?ctryName(c.cc):(c.country||''))).trim(),a?a+' سنة':''].filter(Boolean).join(' · '))}</small>${why?`<i class="dx-why">${esc(why)}</i>`:''}</button>`; };
  function ageBadge(c,v){ v=v||young(c); return v?`<div class="dx-age" title="محسوب من تاريخ الميلاد ${esc(v.date)}">✓ ${v.age} سنة · ${v.srcs.map(s=>SRC_N[s]).join(' و')}${v.srcs.length>1?' (مصدران متطابقان)':''}</div>`:''; }
  const laneLists={};   // الشبكة الكاملة تُبنى عند «الكل» فقط (لا آلاف العناصر المخفية في الصفحة)
  const cw=(c,opt)=>`<div class="dx-cw">${card(c)}${opt.age?ageBadge(c):''}</div>`;   // شارة العمر تحت الملصق
  function lane(id,title,sub,list,opt={}){ if(!list.length) return ''; const n=opt.n||10; laneLists[id]={list,opt};
    return `<section class="dx-lane" data-lane="${id}"><div class="dx-lh"><div><h3>${title}</h3>${sub?`<small>${sub}</small>`:''}</div>${list.length>n?`<button type="button" class="slink dx-all" aria-expanded="false" data-lmore="${id}">الكل (${list.length}) ›</button>`:''}</div>
      <div class="dx-strip">${list.slice(0,n).map(c=>cw(c,opt)).join('')}</div><div class="dx-grid" hidden></div></section>`; }
  const recentNames=()=>{ const r=jget('vkte_recent',[]).slice(0,6); return r.map(id=>items.find(i=>i.id===id)).filter(Boolean).map(i=>i.name); };
  let query='';
  function lanesHtml(discover){
    const all=ranked();
    if(!all.length) return `<div class="rx-empty"><b>لا اقتراحات بعد</b><p>اضغط «تجديد» لجلب دفعة أولى تناسب ذوقك. كلما قيّمتِ وأضفتِ أكثر، صارت الاقتراحات أدق.</p></div>`;
    const yr=new Date().getFullYear(), yng=all.filter(c=>young(c));
    let h=`<div class="dx-search"><input class="in" type="search" data-dxq name="dxq" aria-label="البحث في الاقتراحات" placeholder="ابحث في الاقتراحات بالاسم أو البلد…" value="${esc(query)}" autocomplete="off" enterkeyhint="search"></div>`;
    if(query){ const q=norm(query), l=all.filter(c=>norm(c.name).includes(q)||norm(c.aliases||'').includes(q)||norm(ctryName(c.cc||'')).includes(q));
      return h+(l.length?`<div class="dx-grid">${l.slice(0,48).map(c=>cw(c,{})).join('')}</div>`:`<div class="rx-empty"><p>لا نتائج لـ«${esc(query)}».</p></div>`); }
    const shown=[];
    const take=(l)=>{ shown.push(...l.slice(0,6)); return l; };
    if(discover){
      const day=stablePick('day',todayK(),all,6,2), week=stablePick('week',weekK(),all.filter(confirmed),8,3,true);
      h+=lane('day','☀️ اكتشاف اليوم','مجموعة جديدة كل يوم من أنسب المرشحات لك',take(day),{n:6});
      h+=lane('week','🗓 مختارات الأسبوع','الأفضل توافقًا هذا الأسبوع، متنوعة',take(week),{n:8});
      h+=lane('young','🌱 اكتشافات 18–21','بالغات بين 18 و21 عامًا بتاريخ ميلاد موثّق من قاعدة بيانات · العمر محسوب اليوم',take(yng),{age:1});
      const near=all.filter(c=>(c.near||[]).length); h+=lane('near','👯 قريبات من مفضلاتك','يشبهن ممثلات تحبهن في الخصائص',take(near));
      const st=all.filter(c=>c.cx&&(c.cx.st||[]).length); h+=lane('studio','🎬 من استوديوهات تحبها','لها أعمال مع استوديوهات تتكرر في مفضلاتك',take(st));
      const rising=all.filter(c=>c.at&&+c.at.cs>=yr-2); h+=lane('rising','✨ وجوه جديدة في المجال','بدأت مسيرتها خلال آخر سنتين',take(rising));
      const cnt={}; all.slice(0,60).forEach(c=>{ if(c.cc) cnt[c.cc]=(cnt[c.cc]||0)+1; });
      Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,2).forEach(([cc])=>{ h+=lane('cc'+cc,`${flagOf(cc)} من ${esc(ctryName(cc))}`,'',take(all.filter(c=>c.cc===cc))); });
      h+=lane('explore','🧭 خارج المألوف','لاختبار توسّع ذوقك — تقييمك لها يحسّن الدقة',take(all.filter(c=>c.explore||(c.raw||0)<0.5)));
    } else {
      const conf=all.filter(confirmed), lim=all.filter(c=>!confirmed(c)), rn=recentNames();
      h+=lane('conf','✅ توصيات مؤكدة','مبنية على بيانات كافية وتوافق واضح مع ذوقك',take(conf),{n:12});
      rn.slice(0,2).forEach((nm,i)=>{ const l=all.filter(c=>(c.near||[]).includes(nm)); h+=lane('rec'+i,`🔁 لأنك تصفحت ${esc(nm)} مؤخرًا`,'',take(l)); });
      h+=lane('young','🌱 اكتشافات 18–21 · حسب ذوقك','موثّقات العمر، ومرتبات حسب تشابههن مع مفضلاتك',take(yng.filter(c=>(c.raw||0)>=0.45)),{age:1});
      h+=lane('limited','🧪 بيانات محدودة','توافق محتمل لكن بيانات المرشحة قليلة — تقييمك يحسم',take(lim));
      const d=dx(), seg=(k,opts)=>`<div class="dx-seg">${opts.map((t,i)=>`<button type="button" class="${d[k]===i?'on':''}" aria-pressed="${d[k]===i}" data-dx="${k}" data-val="${i}">${t}</button>`).join('')}</div>`;
      h+=`<section class="dx-ctl"><h3>⚙️ تحكّم في توصياتك</h3>
        <div><span>التنويع</span>${seg('div',['قليل','متوسط','عالٍ'])}</div>
        <div><span>الاستكشاف</span>${seg('expl',['أقل','عادي','أكثر'])}</div>
        <div><span>تكرار الأسماء</span>${seg('rep',['مسموح','متوسط','نادر'])}</div>
        <button type="button" class="btn" data-dxreset>مسح سجل الظهور</button>
        <p class="dx-note">تتعلّم التوصيات من: المفضلة والتقييمات والمستويات والمواجهات، ومن تصفحتهن مؤخرًا، وقوائمك، وما تحفظه أو تضيفه أو ترفضه.</p></section>`;
    }
    seen(shown);
    return h||`<div class="rx-empty"><p>لا مسارات كافية بعد. اضغط «تجديد».</p></div>`; }
  function wire(el){
    el.querySelectorAll('[data-lmore]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const s=b.closest('.dx-lane'), g=s.querySelector('.dx-grid'), st=s.querySelector('.dx-strip'); const open=g.hidden;
      if(open&&!g.childElementCount){ const L=laneLists[b.dataset.lmore]; if(L){ g.innerHTML=L.list.slice(0,60).map(c=>cw(c,L.opt)).join(''); seen(L.list.slice(0,60)); } }
      g.hidden=!open; st.hidden=open; b.textContent=open?'إخفاء ‹':'الكل ›'; b.setAttribute('aria-expanded',String(open)); });
    const q=el.querySelector('[data-dxq]'); if(q){ let t=0; q.oninput=()=>{ clearTimeout(t); t=setTimeout(()=>{ query=q.value.trim(); const pos=q.selectionStart; window.RecsUI&&RecsUI.repaintAll(); const q2=document.querySelector('.rx-body [data-dxq]'); if(q2){ q2.focus(); try{ q2.setSelectionRange(pos,pos); }catch{} } },220); }; }
    el.querySelectorAll('[data-dx]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const d=dx(); d[b.dataset.dx]=+b.dataset.val; LS.set(DX_KEY,JSON.stringify(d)); memo.key=''; if(window.RecsUI){ RecsUI.localRank(); RecsUI.repaintAll(); } toast('حُدّثت التوصيات'); });
    const r=el.querySelector('[data-dxreset]'); if(r) r.onclick=e=>{ e.stopPropagation(); imp={}; LS.set(IMP_KEY,'{}'); LS.set(PICK_KEY,'{}'); memo.key=''; if(window.RecsUI){ RecsUI.localRank(); RecsUI.repaintAll(); } toast('مُسح سجل الظهور'); };
  }
  /** مسارات التلفاز: من قائمة العرض المصنّفة فقط (فهرس البطاقة = موقعها فيها). */
  function tvLanes(){ const l=(_recCache.list||[]).filter(c=>!snoozed(c)); if(!l.length) return [];
    const day=stablePick('tvday',todayK(),l,8,2), yng=l.filter(c=>young(c));
    return [['☀️ اكتشاف اليوم',day],['🌱 اكتشافات 18–21 (موثّقة العمر)',yng],['✅ توصيات مؤكدة',l.filter(confirmed)],['🧪 بيانات محدودة',l.filter(c=>!confirmed(c))]].filter(x=>x[1].length); }
  return {lanesHtml,wire,seen,verifyAge,young,ranked,confirmed,diversify,tvLanes,ageBadge,_t:{impN,snoozed,exactAge,validDate,dx,get imp(){ return imp; }}};
})();

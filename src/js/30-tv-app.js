/* ===== واجهة الشاشة (Android TV) — تطبيق مستقل بالكامل عن واجهة الجوال =====
   تصميم «Lean-back»: قائمة جانبية + صفحات بملء الشاشة، أرفف أفقية، بطاقات كبيرة، شريط معلومات للعنصر المحدد.
   الصفحات: بحث (لوحة مفاتيح على الشاشة + صوت)، الرئيسية، الممثلات، الأعمال، اقتراحات، استكشاف، مجموعاتي، ملفي،
            صفحة الممثلة، المقارنة، اتصال بالجوال، الإعدادات.
   الريموت: الأسهم، OK (ضغطة مطوّلة = خيارات سريعة)، رجوع. زر القائمة (Menu) يفتح الخيارات السريعة أيضًا.
   الأداء: الأرفف والصفحات تتحرك بتحويلات GPU (translate) لا بالتمرير، والتنقل يحسب المواضع من التخطيط مباشرة،
           والشبكات تُلحق دفعات بدل إعادة الرسم. */
const APP_VER=(document.querySelector('meta[name=app-version]')||{}).content||'';
const TVApp=(()=>{
  let on=false, page='home', args={}, stack=[], lastMain=null, root, main, layerEl, nav, infoEl, bgA, bgB, bgCur=0, heroT=0, infoT=0;
  const ROWLIM=20, CHUNK=40;
  let lim=CHUNK, gridList=[], gridCard=null, exIds=[];
  const $$=s=>root.querySelector(s);
  const P=id=>items.find(i=>i.id===id);
  const WM=()=>{ const m=new Map(); wAll().forEach(g=>m.set(g.key,g)); return m; };
  const big=i=>(i&&((i.photos&&i.photos[0])||pic(i)))||'';
  const ageOf=i=>{ const a=age(i.birth); return a!=null&&a>=18?a:null; };
  const starsTxt=r=>r?'★ '+(+r).toFixed(1):'';
  const webview=()=>((navigator.userAgent.match(/Chrome\/([\d.]+)/)||[])[1]||'?');
  const ago=t=>{ if(!t) return ''; const d=Math.floor((Date.now()-t)/864e5); return d<=0?'اليوم':d===1?'أمس':d<30?'منذ '+d+' يوم':d<365?'منذ '+Math.round(d/30)+' شهر':'منذ '+Math.round(d/365)+' سنة'; };
  const upTxt=g=>{ const d=daysUntil(g.d); return d===0?'اليوم':d===1?'غدًا':d>1?'بعد '+d+' يوم':'قريبًا'; };
  const jg=(k,d)=>{ try{ const v=JSON.parse(LS.get(k,'')); return v==null?d:v; }catch{ return d; } };

  // ---------------- البناء ----------------
  const NAV=[['search','i-search','بحث'],['home','i-home','الرئيسية'],['lib','i-grid','الممثلات'],['works','i-film','الأعمال'],['recs','i-bulb','اقتراحات لك'],['explore','i-shuffle','استكشاف'],['studio','i-studio','الاستديو'],['lists','i-folder','مجموعاتي'],['me','i-chart','ملفي'],['sync','i-link','اتصال بالجوال'],['set','i-set','الإعدادات']];
  function build(){ if(root) return; root=document.createElement('div'); root.id='tv';
    root.innerHTML=`<div class="tv-bg"><img alt="" decoding="async"><img alt="" decoding="async"></div><div class="tv-shade"></div>
      <nav class="tv-nav"><div class="tv-logo"><svg class="mark"><use href="#logo"/></svg><b>المفضلة</b></div>${NAV.map(([k,ic,t])=>`<button class="f tv-ni" data-go="${k}" data-k="nav:${k}"><svg class="ic"><use href="#${ic}"/></svg><span>${t}</span></button>`).join('')}<div class="tv-ver" dir="ltr">v${esc(APP_VER.split(' ')[0])}</div></nav>
      <main class="tv-main" id="tvMain"></main><div class="tv-info" id="tvInfo"></div><div class="tv-layer" id="tvLayer" hidden></div>`;
    document.body.appendChild(root); main=$$('#tvMain'); layerEl=$$('#tvLayer'); nav=$$('.tv-nav'); infoEl=$$('#tvInfo'); [bgA,bgB]=root.querySelectorAll('.tv-bg img');
    root.addEventListener('click',onClick); root.addEventListener('focusin',onFocus);
    // صورة فشلت: نجرّب البديل (الصورة الأصلية بدل المصغّرة أو العكس) ثم نعرض بديلًا أنيقًا — ولا تؤثر على غيرها
    root.addEventListener('error',e=>{ const im=e.target; if(!im||im.tagName!=='IMG'||im.hasAttribute('onerror')||im.closest('.tv-bg')) return;
      const fb=im.dataset.fb; if(fb&&im.getAttribute('src')!==fb){ im.dataset.fb=''; im.src=fb; return; }
      const ph=im.parentElement; im.remove(); if(ph&&!ph.querySelector('img,i')) ph.insertAdjacentHTML('afterbegin','<i>♡</i>'); },true);
    let qt=0; root.addEventListener('input',e=>{ if(e.target.id==='tvQ'){ clearTimeout(qt); qt=setTimeout(()=>drawSearchRes(e.target.value),300); } }); }

  // الخلفية: مصغّرة خفيفة (لا صورة كاملة ولا تمويه) مع تلاشٍ قصير
  function setBg(src){ const cur=bgCur?bgB:bgA, nx=bgCur?bgA:bgB; if(!src){ cur.classList.remove('on'); nx.classList.remove('on'); return; }
    if(cur.getAttribute('src')===src&&cur.classList.contains('on')) return;
    nx.onload=()=>{ nx.classList.add('on'); cur.classList.remove('on'); bgCur=1-bgCur; }; nx.onerror=()=>{}; nx.src=src; }

  // ---------------- عناصر ----------------
  const imgOf=(src,fb)=>src?`<img src="${esc(src)}"${fb&&fb!==src?` data-fb="${esc(fb)}"`:''} loading="lazy" decoding="async" alt="">`:'<i>♡</i>';
  // mode: 'cp' = بطاقة اختيار للمقارنة
  const pCard=(i,sub,mode)=>{ const at=mode==='cp'?`data-k="cp:${esc(i.id)}" data-cp="${esc(i.id)}"`:`data-k="p:${esc(i.id)}" data-p="${esc(i.id)}"`;
    return `<button class="f tvc tvp" ${at}><span class="ph">${imgOf(pic(i),(i.photos||[])[0])}${i.rating?`<em>${starsTxt(i.rating)}</em>`:''}${i.fav?'<u>♥</u>':''}${i.tier?`<s class="t${esc(i.tier)}">${esc(i.tier)}</s>`:''}</span><b>${esc(i.name)}</b><small>${sub!=null?sub:esc(i.country||'')||'&nbsp;'}</small></button>`; };
  const wCard=(g,sub)=>{ const up=isUpcoming(g)?upTxt(g):'';
    return `<button class="f tvc tvw ${g.seen?'seen':''}" data-k="w:${esc(g.key)}" data-w="${esc(g.key)}"><span class="ph">${wCoverHtml(g)}${up?`<em class="up">${esc(up)}</em>`:g.r?`<em>★ ${g.r}</em>`:''}${g.seen?'<u class="ok">✓</u>':g.q?'<u>🔖</u>':''}</span><b dir="auto">${esc(g.t)}</b><small>${sub!=null?sub:esc(g.who.map(x=>x.name).join('، '))}</small></button>`; };
  const recCard=(c,n)=>`<button class="f tvc tvp" data-k="r:${esc(c.k||norm(c.name))}" data-rec="${n}"><span class="ph">${c.img?`<img src="${esc(c.img)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="this.remove()" alt="">`:'<i>♡</i>'}<em class="tvmt">${c.matchPct||''}٪</em></span><b>${esc(c.name)}</b><small>${esc((c.reasons||[])[0]||[c.cc?ctryName(c.cc):c.country,candAge(c)?candAge(c)+' سنة':''].filter(Boolean).join(' · '))}</small></button>`;
  const more=(go,t)=>`<button class="f tvc tvmore" data-k="more:${esc(go)}" data-go="${esc(go)}"><span class="ph"><i>${icon('chev')}</i></span><b>${t||'عرض الكل'}</b><small>&nbsp;</small></button>`;
  const row=(id,title,cards,go,cls)=>cards.length?`<section class="tv-sec" data-row="${id}"><h3>${title}</h3><div class="tv-hs ${cls||''}">${cards.join('')}${go?more(go):''}</div></section>`:'';
  const btn=(k,label,attrs,cls)=>`<button class="f tb ${cls||''}" data-k="b:${k}" ${attrs||''}>${label}</button>`;
  const tile=(k,ic,t,sub,attrs)=>`<button class="f tvc tvk" data-k="k:${k}" ${attrs}><span class="ph"><i>${ic}</i></span><b>${t}</b><small>${sub||'&nbsp;'}</small></button>`;

  // ---------------- ذكاء: ترتيب الاكتشاف والمفاجأة ----------------
  // يعتمد على تفضيلاتك الفعلية: المفضلة والتقييم والوسوم المشتركة مع من تحبهن، ومن لم تزرها منذ مدة
  function tagTaste(){ const m={}; let mx=0; items.forEach(i=>{ const w=perfWeight(i); if(w<=.8) return; (i.tags||[]).forEach(t=>{ m[t]=(m[t]||0)+w; mx=Math.max(mx,m[t]); }); }); if(mx) for(const t in m) m[t]/=mx; return m; }
  function smartList(n){ const tt=tagTaste(), now=Date.now();
    return items.filter(i=>pic(i)).map(i=>{ const w=Math.max(-.5,Math.min(2.2,perfWeight(i))); const ts=(i.tags||[]).reduce((a,t)=>a+(tt[t]||0),0); const lv=i.lastView||0, days=lv?(now-lv)/864e5:999;
      const s=w*.6+Math.min(1.2,ts*.6)+Math.min(1.2,days/30)+Math.random()*.9;
      const why=days>60?'لم تزرها منذ مدة':ts>.8?'تشبه ذوقك في '+((i.tags||[]).filter(t=>tt[t]>.4).slice(0,2).map(t=>'#'+t).join(' ')||'وسومك المفضلة'):i.fav?'من مفضلاتك':(i.rating||0)>=4?'من الأعلى تقييمًا عندك':'اكتشاف من مكتبتك';
      return {i,s,why}; }).sort((a,b)=>b.s-a.s).slice(0,n||items.length); }
  function surprise(){ const seen=jg('vkte_tv_sp',[]), l=smartList(); const x=l.find(y=>!seen.includes(y.i.id))||l[0]; if(!x) return toast('مكتبتك فارغة');
    LS.set('vkte_tv_sp',JSON.stringify([x.i.id,...seen].slice(0,12))); toast('🎲 '+x.i.name+' — '+x.why); go('person',{id:x.i.id}); }
  function track(id){ const a=jg('vkte_recent',[]).filter(x=>x!==id); a.unshift(id); LS.set('vkte_recent',JSON.stringify(a.slice(0,14))); }

  // ---------------- الصفحات ----------------
  function home(){ const all=wAll(), by=new Map(items.map(i=>[i.id,i]));
    if(!items.length) return `<div class="tv-empty"><svg class="mark"><use href="#logo"/></svg><h1>مكتبتك فارغة</h1><p>اربط جوالك لإرسال مكتبتك إلى الشاشة. كل ما تضيفه أو تعدّله في الجوال يصل هنا تلقائيًا.</p><div class="tv-acts">${btn('gosync','📲 اتصال بالجوال','data-go="sync"','pri')}</div></div>`;
    const recent=jg('vkte_recent',[]).map(id=>by.get(id)).filter(Boolean);
    const favs=items.filter(i=>i.fav).sort((a,b)=>(b.rating||0)-(a.rating||0));
    const top=items.filter(i=>i.rating>0).sort((a,b)=>b.rating-a.rating||(b.elo||0)-(a.elo||0));
    const fresh=items.slice().sort((a,b)=>(b.added||0)-(a.added||0));
    const newW=all.filter(g=>g.a).sort((a,b)=>b.a-a.a||(b.dt||'').localeCompare(a.dt||''));
    const upd=items.filter(i=>i.updated&&i.updated-(i.added||0)>6e4).sort((a,b)=>b.updated-a.updated);
    const bd=items.map(i=>[i,Home.nextBday(i)]).filter(x=>x[1]&&x[1].days<=30).sort((a,b)=>a[1].days-b[1].days);
    const upc=wApply(all,'upcoming'), wl=wApply(all,'watchlist');
    const recs=(_recCache.list||[]).slice(0,ROWLIM), because=recent[0]?similar(recent[0]):[];
    const tiles=[tile('sp','🎲','مفاجأة ذكية','ممثلة تناسب ذوقك','data-act="surprise"'),tile('ex','🧭','وضع الاستكشاف','تصفّح متواصل','data-go="explore"'),tile('cmp','⚖️','مقارنة','ممثلتان جنبًا لجنب','data-go="cmp"'),
      tile('show','▶️','عرض شرائح','صور مكتبتك','data-go="show"'),tile('ls','📂','مجموعاتي',lists.length+' قائمة','data-go="lists"'),tile('me','📊','ملفي','إحصائياتك وذوقك','data-go="me"'),tile('rw','🎬','عمل عشوائي','لم تشاهده بعد','data-act="rndw"')];
    return `<div class="tv-hero" id="tvHero"></div><div class="tv-rows tv-scroll">
      ${row('recent','تابعت مؤخرًا',recent.slice(0,ROWLIM).map(i=>pCard(i)))}
      ${row('newp','أحدث الممثلات المضافة',fresh.slice(0,ROWLIM).map(i=>pCard(i,esc(ago(i.added)))),'lib:added')}
      ${row('neww','أحدث الأعمال المضافة',newW.slice(0,ROWLIM).map(g=>wCard(g,esc([g.who[0]&&g.who[0].name,g.d?fmtWd(g.d):g.y].filter(Boolean).join(' · ')))),'works:recent','wide')}
      ${row('keys','اختصارات',tiles,'','keys')}
      ${row('fav','المفضلات',favs.slice(0,ROWLIM).map(i=>pCard(i)),'lib:fav')}
      ${row('recs','اقتراحات ذكية لك',recs.map((c,n)=>recCard(c,n)),'recs')}
      ${row('upc','أعمال قادمة',upc.slice(0,ROWLIM).map(g=>wCard(g)),'works:upcoming','wide')}
      ${because.length?row('bc','لأنك تابعت '+esc(recent[0].name),because.map(x=>pCard(x))):''}
      ${row('wl','قائمة المشاهدة',wl.slice(0,ROWLIM).map(g=>wCard(g)),'works:watchlist','wide')}
      ${row('upd','آخر التحديثات',upd.slice(0,ROWLIM).map(i=>pCard(i,'حُدّثت '+esc(ago(i.updated)))))}
      ${row('top','الأعلى تقييمًا',top.slice(0,ROWLIM).map(i=>pCard(i)),'lib:rating')}
      ${row('bday','أعياد ميلاد قريبة',bd.slice(0,ROWLIM).map(([i,n])=>pCard(i,n.days===0?'اليوم 🎂':n.days===1?'غدًا 🎂':'بعد '+n.days+' يوم · '+n.turns)))}
      <div class="tv-pad"></div></div>`; }

  // --- الممثلات ---
  const LF={all:['الكل',()=>true],fav:['المفضلة',i=>i.fav],S:['المستوى S',i=>i.tier==='S'],A:['المستوى A',i=>i.tier==='A'],unrated:['بلا تقييم',i=>!(i.rating>0)],upc:['لها أعمال قادمة',i=>(i.works||[]).some(isUpcoming)]};
  const LS_SORT={rating:['الأعلى تقييمًا',(a,b)=>(b.rating||0)-(a.rating||0)],name:['الاسم',(a,b)=>a.name.localeCompare(b.name,'ar')],added:['الأحدث إضافة',(a,b)=>(b.added||0)-(a.added||0)],updated:['آخر تحديث',(a,b)=>(b.updated||0)-(a.updated||0)],works:['الأكثر أعمالًا',(a,b)=>(b.works||[]).length-(a.works||[]).length],elo:['ترتيب المواجهات',(a,b)=>(b.elo||1000)-(a.elo||1000)],age:['الأصغر سنًا',(a,b)=>(age(a.birth)||99)-(age(b.birth)||99)]};
  const fName=f=>f.startsWith('L:')?'📂 '+((lists.find(L=>L.id===f.slice(2))||{}).name||'قائمة'):f.startsWith('T:')?'#'+f.slice(2):'';
  function libList(){ const f=args.f||'all', s=args.s||'rating'; let l=items.slice();
    if(f.startsWith('L:')) l=l.filter(i=>(i.lists||[]).includes(f.slice(2))); else if(f.startsWith('T:')) l=l.filter(i=>(i.tags||[]).includes(f.slice(2))); else if(LF[f]) l=l.filter(LF[f][1]);
    return l.sort((LS_SORT[s]||LS_SORT.rating)[1]); }
  function lib(){ const f=args.f||'all', s=args.s||'rating', l=libList(); gridList=l; gridCard=i=>pCard(i);
    const ext=fName(f);
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>الممثلات</h1><span>${l.length} ممثلة${ext?' · '+esc(ext):''}</span></header>
      <section class="tv-sec" data-row="lf"><div class="tv-hs tvch">${Object.entries(LF).map(([k,[t]])=>btn('lf:'+k,esc(t),`data-lf="${k}"`,'chip'+(k===f?' on':''))).join('')}${btn('lfx',ext?esc(ext)+' ▾':'📂 القوائم والوسوم ▾','data-act="lfx"','chip'+(ext?' on':''))}${btn('lsx','↕ '+esc(LS_SORT[s][0])+' ▾','data-act="lsx"','chip')}</div></section>
      <div class="tv-grid">${l.slice(0,lim).map(gridCard).join('')||'<p class="tv-note">لا ممثلات هنا</p>'}</div><div class="tv-pad"></div></div>`; }
  function pickLayer(title,opts){ openLayer(`<h2>${title}</h2><div class="tv-opts">${opts.join('')}</div>`,true); }
  const opt=(k,t,attrs,onn)=>btn(k,t,attrs,'opt'+(onn?' on':''));

  // --- صفحة الممثلة ---
  function person(){ const i=P(args.id); if(!i){ setTimeout(()=>go('home'),0); return ''; }
    const a=ageOf(i), ws=(i.works||[]).map((w,k)=>({it:i,w,k})), WMm=WM();
    const groups=wApply(ws,'all').map(x=>WMm.get(wKeyOf(x.w))).filter(Boolean);
    const ordered=[...groups.filter(g=>!g.seen&&!isUpcoming(g)),...groups.filter(g=>isUpcoming(g)),...groups.filter(g=>g.seen)];
    const rk=Duel.rankOf(i), nb=Home.nextBday(i), seen=groups.filter(g=>g.seen).length;
    const meta=[i.country,a!=null?a+' سنة':'',i.height?i.height+' سم':'',ws.length?ws.length+' عمل'+(seen?' · شاهدت '+seen:''):'',(i.photos||[]).length?(i.photos||[]).length+' صورة':''].filter(Boolean);
    const chips=[i.tier?`<span class="pc t${esc(i.tier)}">المستوى ${esc(i.tier)}</span>`:'',i.fav?'<span class="pc">♥ مفضلة</span>':'',rk?`<span class="pc">⚔️ #${rk}</span>`:'',nb&&nb.days<=30?`<span class="pc">🎂 ${nb.days===0?'اليوم':'بعد '+nb.days+' يوم'}</span>`:'',...(i.tags||[]).slice(0,6).map(t=>`<span class="pc">#${esc(t)}</span>`)].filter(Boolean).join('');
    const co=coStars(i, groups);
    return `<div class="tv-page tv-scroll pp">
      <section class="pp-head" data-row="pa"><div class="pp-ph">${big(i)?`<img src="${esc(big(i))}" data-fb="${esc(pic(i))}" decoding="async" alt="">`:'<i>♡</i>'}</div>
        <div class="pp-info"><h1>${esc(i.name)}</h1>${i.aliases?`<p class="pp-al">${esc(i.aliases)}</p>`:''}
          <div class="pp-r">${i.rating?stars(i.rating)+`<b>${(+i.rating).toFixed(1)}</b>`:'<span class="tv-note0">لم تقيّمها بعد</span>'}</div>
          <p class="pp-m">${esc(meta.join(' · '))}</p>${chips?`<div class="pp-c">${chips}</div>`:''}
          ${i.notes?`<p class="pp-n">${esc(i.notes)}</p>`:''}
          <div class="tv-acts">${(i.photos||[]).length?btn('show','▶ عرض الشرائح','data-act="show"','pri'):''}${btn('fav',i.fav?'♥ في المفضلة':'♡ أضف للمفضلة','data-act="fav"',i.fav?'on':'')}${btn('rate','★ تقييم ومستوى','data-act="rate"')}${btn('cmp','⚖️ قارن','data-act="cmp"')}${ordered.some(g=>!g.seen&&!isUpcoming(g))?btn('rpw','🎲 عمل لها','data-act="rpw"'):''}</div></div></section>
      ${row('pw','الأعمال ('+ordered.length+')',ordered.slice(0,40).map(g=>wCard(g,esc([g.s,g.d?fmtWd(g.d):g.y].filter(Boolean).join(' · ')))),'','wide')}
      ${row('pc','شاركنها أعمالًا',co.map(([x,n])=>pCard(x,n+' عمل مشترك')))}
      ${(i.photos||[]).length>1?row('ph','الصور ('+i.photos.length+')',i.photos.slice(0,30).map((p,n)=>`<button class="f tvc tvphoto" data-k="ph:${n}" data-ph="${n}"><span class="ph"><img src="${esc(p)}" ${n===0?`data-fb="${esc(pic(i))}"`:''} loading="lazy" decoding="async" alt=""></span></button>`)):''}
      ${row('ps','مشابهات في مكتبتك',similar(i).map(x=>pCard(x)))}<div class="tv-pad"></div></div>`; }
  function coStars(i,groups){ const m=new Map(); groups.forEach(g=>g.who.forEach(x=>{ if(x!==i) m.set(x,(m.get(x)||0)+1); })); return [...m].sort((a,b)=>b[1]-a[1]).slice(0,ROWLIM); }
  function similar(it){ const tg=new Set(it.tags||[]), a=age(it.birth);
    return items.filter(x=>x!==it).map(x=>{ let s=0; (x.tags||[]).forEach(t=>{ if(tg.has(t)) s+=1.2; }); if(it.country&&x.country===it.country) s+=1.5; const b=age(x.birth); if(a!=null&&b!=null&&Math.abs(a-b)<=3) s+=1; if(it.tier&&x.tier===it.tier) s+=.8; if(x.fav) s+=.2; return [x,s]; })
      .filter(x=>x[1]>=1.5).sort((p,q)=>q[1]-p[1]).slice(0,16).map(x=>x[0]); }

  // --- الأعمال ---
  const WT=[['recent','الأحدث'],['upcoming','القادمة'],['watchlist','للمشاهدة'],['unseen','لم أشاهدها'],['top','الأعلى تقييمًا'],['seen','شاهدتها']];
  function works(){ const t=args.t||'recent', st=args.st||'', all=wAll(); let l=wApply(all,t); if(st) l=l.filter(g=>g.s===st); gridList=l; gridCard=g=>wCard(g);
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>الأعمال</h1><span>${all.length} عمل · شاهدت ${all.filter(g=>g.seen).length}${st?' · 🎬 '+esc(st):''}</span></header>
      <section class="tv-sec" data-row="wt"><div class="tv-hs tvch">${WT.map(([k,n])=>btn('wt:'+k,n+` <small>${wApply(all,k).length}</small>`,`data-wt="${k}"`,'chip'+(k===t?' on':''))).join('')}${btn('wst',st?'🎬 '+esc(st)+' ▾':'🎬 الاستوديو ▾','data-act="wst"','chip'+(st?' on':''))}${btn('rnd','🎲 اختر لي','data-act="rndw"','chip')}${btn('radar','⟳ تحديث من المصادر','data-act="radar"','chip')}</div></section>
      <div class="tv-grid wide">${l.slice(0,lim).map(gridCard).join('')||'<p class="tv-note">لا أعمال هنا</p>'}</div><div class="tv-pad"></div></div>`; }

  // --- الاقتراحات ---
  function recs(){ const l=(_recCache.list||[]), keys=!!(LS.get('vkte_key')||LS.get('vkte_stash')); gridList=l; gridCard=null;
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>اقتراحات لك</h1><span>${l.length?l.length+' ممثلة جديدة مرتبة حسب توافقها مع ذوقك':''}</span></header>
      ${keys?`<section class="tv-sec" data-row="ra"><div class="tv-hs tvch">${btn('rref','⟳ تجديد الاقتراحات','data-act="rref"','chip pri')}</div></section>`:''}
      ${l.length?`<div class="tv-grid">${l.map(recCard).join('')}</div>`:`<p class="tv-note">${keys?'اضغط «تجديد الاقتراحات» لجلب ممثلات جديدات تناسب ذوقك.':'الاقتراحات تحتاج مفتاح ThePornDB أو StashDB. فعّل «أرسل مفاتيح المصادر للشاشة» من جوالك ← الشاشة والمزامنة.'}</p>`}<div class="tv-pad"></div></div>`; }

  // --- البحث: لوحة مفاتيح على الشاشة + صوت + سجل ---
  const KB={ar:'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ة ى ء أ إ آ ؤ ئ'.split(' '),en:'a b c d e f g h i j k l m n o p q r s t u v w x y z 1 2 3 4 5 6 7 8 9 0'.split(' ')};
  const SCOPES=[['all','الكل'],['p','الممثلات'],['w','الأعمال']];
  const kbHtml=()=>{ const L=args.kb||'ar'; return KB[L].map((c,n)=>`<button class="f kk" data-k="kb:${n}" data-key="${esc(c)}">${esc(c)}</button>`).join('')
    +`<button class="f kk w2" data-k="kb:sp" data-key=" ">مسافة</button><button class="f kk" data-k="kb:bs" data-kbx="bs">⌫</button><button class="f kk" data-k="kb:cl" data-kbx="cl">مسح</button><button class="f kk" data-k="kb:lg" data-kbx="lg">${L==='ar'?'EN':'ع'}</button><button class="f kk mic" data-k="kb:mic" data-act="voice">🎤</button>`; };
  function search(){ const sc=args.scope||'all';
    return `<div class="tv-page tvsr"><header class="tv-ph"><h1>بحث</h1><span>اكتب بالأسهم أو بالصوت 🎤</span></header>
      <div class="sr-wrap"><div class="sr-kb" data-row="kb"><input class="f tv-in" id="tvQ" data-k="b:q" placeholder="اسم، عمل، استوديو أو وسم…" autocomplete="off" value="${esc(args.q||'')}">
        <div class="sr-sc">${SCOPES.map(([k,t])=>btn('sc:'+k,t,`data-scope="${k}"`,'chip sm'+(k===sc?' on':''))).join('')}</div>
        <div class="kb" id="tvKb">${kbHtml()}</div></div>
      <div class="sr-res tv-scroll"><div id="tvRes"></div></div></div></div>`; }
  // فهرس بحث (نص مطبَّع مرة واحدة) — يُعاد بناؤه فقط عند تغيّر البيانات
  let ixP=null, ixPsrc=null, ixW=null, ixWsrc=null;
  const idxP=()=>{ if(!ixP||ixPsrc!==items||ixP.length!==items.length){ ixPsrc=items; ixP=items.map(i=>[i,norm([i.name,i.aliases,i.country,(i.tags||[]).join(' ')].join(' '))]); } return ixP; };
  const idxW=()=>{ const a=wAll(); if(ixWsrc!==a){ ixWsrc=a; ixW=a.map(g=>[g,norm(g.t+' '+g.s+' '+(g.tg||[]).join(' ')+' '+g.who.map(x=>x.name).join(' '))]); } return ixW; };
  function setQ(q){ args.q=q; const el=$$('#tvQ'); if(el) el.value=q; clearTimeout(setQ.t); setQ.t=setTimeout(()=>drawSearchRes(q),250); }
  function saveQ(q){ q=(q||'').trim(); if(q.length<2) return; const a=jg('vkte_tv_qh',[]).filter(x=>x!==q); a.unshift(q); LS.set('vkte_tv_qh',JSON.stringify(a.slice(0,8))); }
  function drawSearchRes(q){ args.q=q; const el=$$('#tvRes'); if(!el) return; const sc=args.scope||'all'; q=norm(q||'');
    if(!q){ const h=jg('vkte_tv_qh',[]); el.innerHTML=h.length?`<section class="tv-sec" data-row="qh"><h3>عمليات بحث سابقة</h3><div class="tv-hs tvch">${h.map((x,n)=>btn('qh:'+n,'🕘 '+esc(x),`data-qh="${esc(x)}"`,'chip')).join('')}</div></section>`:'<p class="tv-note">النتائج تظهر أثناء الكتابة.</p>'; }
    else { const ps=sc==='w'?[]:idxP().filter(x=>x[1].includes(q)).map(x=>x[0]);
      const ws=sc==='p'?[]:idxW().filter(x=>x[1].includes(q)).map(x=>x[0]);
      el.innerHTML=sc==='p'?(ps.length?`<p class="tv-cnt">${ps.length} ممثلة</p><div class="tv-grid sm">${ps.slice(0,60).map(i=>pCard(i)).join('')}</div>`:'')
        :sc==='w'?(ws.length?`<p class="tv-cnt">${ws.length} عمل</p><div class="tv-grid wide sm">${ws.slice(0,60).map(g=>wCard(g)).join('')}</div>`:'')
        :row('rp','الممثلات ('+ps.length+')',ps.slice(0,30).map(i=>pCard(i)))+row('rw','الأعمال ('+ws.length+')',ws.slice(0,30).map(g=>wCard(g)),'','wide');
      if(!el.innerHTML) el.innerHTML='<p class="tv-note">لا نتائج لـ «'+esc(args.q)+'»</p>'; }
    wrap(el); const vt=el.closest('.tv-vt'); if(vt) setY(vt,0); }
  async function voice(){ try{
      if(IS_NATIVE&&NATIVE.Shell&&NATIVE.Shell.voice){ const r=await NATIVE.Shell.voice({lang:'ar-SA',prompt:'قل اسم ممثلة أو عمل'}); if(r&&r.text) setQ(r.text); return; }
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) throw new Error('unavailable');
      const s=new SR(); s.lang='ar-SA'; s.onresult=e=>setQ(e.results[0][0].transcript); s.onerror=()=>toast('لم يُلتقط صوت'); s.start(); toast('🎤 تكلّم الآن…');
    }catch{ toast('البحث الصوتي غير متاح على هذا الجهاز — استخدم لوحة المفاتيح'); } }

  // --- وضع الاستكشاف: ممثلة تلو الأخرى بملء الشاشة ---
  function explore(){ if(!items.length) return home();
    if(!exIds.length||args.fresh){ exIds=smartList().map(x=>x.i.id); delete args.fresh; } let n=Math.max(0,Math.min(exIds.length-1,args.n||0)); args.n=n;
    const i=P(exIds[n]); if(!i){ exIds=[]; return explore(); }
    const a=ageOf(i), WMm=WM(), gs=wApply((i.works||[]).map((w,k)=>({it:i,w,k})),'all').map(x=>WMm.get(wKeyOf(x.w))).filter(Boolean), nx=P(exIds[n+1]);
    if(nx&&big(nx)){ const im=new Image(); im.src=big(nx); }
    return `<div class="tv-page tv-scroll ex">
      <section class="ex-stage" data-row="ex"><button class="f ex-ph" data-k="ex" data-ex="1">${big(i)?`<img src="${esc(big(i))}" data-fb="${esc(pic(i))}" decoding="async" alt="">`:'<i>♡</i>'}<span class="ex-nav"><b>‹</b><b>›</b></span></button>
        <div class="ex-b"><span class="hk">🧭 استكشاف · ${n+1} / ${exIds.length}</span><h1>${esc(i.name)}</h1>
          <div class="pp-r">${i.rating?stars(i.rating)+`<b>${(+i.rating).toFixed(1)}</b>`:'<span class="tv-note0">بلا تقييم</span>'}</div>
          <p class="pp-m">${esc([i.country,a!=null?a+' سنة':'',gs.length?gs.length+' عمل':'',(i.photos||[]).length?(i.photos||[]).length+' صورة':''].filter(Boolean).join(' · '))}</p>
          ${(i.tags||[]).length?`<div class="pp-c">${i.tags.slice(0,6).map(t=>`<span class="pc">#${esc(t)}</span>`).join('')}</div>`:''}${i.notes?`<p class="pp-n">${esc(i.notes)}</p>`:''}
          <p class="ex-hint">◀ ▶ للتنقل بين الممثلات · OK لفتح صفحتها</p>
          <div class="tv-acts">${btn('exo','التفاصيل',`data-p="${esc(i.id)}"`,'pri')}${btn('exf',i.fav?'♥ مفضلة':'♡ مفضلة','data-act="exfav"',i.fav?'on':'')}${(i.photos||[]).length?btn('exs','▶ صورها','data-act="exshow"'):''}${btn('exr','⟳ ترتيب جديد','data-act="exnew"')}</div></div></section>
      ${row('exw','أعمالها',gs.slice(0,ROWLIM).map(g=>wCard(g,esc([g.s,g.d?fmtWd(g.d):g.y].filter(Boolean).join(' · ')))),'','wide')}<div class="tv-pad"></div></div>`; }
  function exStep(d){ const n=(args.n||0)+d; if(n<0){ focusEl(nav.querySelector('.cur')||nav.querySelector('.f')); return; } if(n>=exIds.length){ toast('انتهت القائمة — نبدأ من جديد بترتيب آخر'); args.fresh=1; args.n=0; } else args.n=n; draw(true); }

  // --- المقارنة ---
  function cmp(){ const A=P(args.a), B=P(args.b);
    if(!A||!B){ const l=A?[...similar(A),...items.filter(x=>x!==A).sort((p,q)=>(q.rating||0)-(p.rating||0))].filter((x,k,arr)=>arr.indexOf(x)===k):items.slice().sort((p,q)=>(q.rating||0)-(p.rating||0));
      gridList=l; gridCard=i=>pCard(i,null,'cp');
      return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>⚖️ مقارنة</h1><span>${A?'اختر ممثلة لمقارنتها مع <b>'+esc(A.name)+'</b> — المشابهات أولًا':'اختر الممثلة الأولى'}</span></header>
        <div class="tv-grid">${l.slice(0,lim).map(gridCard).join('')}</div><div class="tv-pad"></div></div>`; }
    const f=i=>{ const ws=wAll().filter(g=>g.who.includes(i)); return {a:ageOf(i),h:+i.height||0,r:+i.rating||0,w:ws.length,s:ws.filter(g=>g.seen).length,ph:(i.photos||[]).length,rk:Duel.rankOf(i)||0,st:new Set(ws.map(g=>g.s).filter(Boolean)),tg:new Set(i.tags||[])}; };
    const a=f(A), b=f(B), TR=['S','A','B','C','D'];
    const line=(t,va,vb,better)=>{ const w=better==null?0:better; return `<div class="cm-l"><span class="${w>0?'win':''}">${va}</span><b>${t}</b><span class="${w<0?'win':''}">${vb}</span></div>`; };
    const cmpN=(x,y,hi)=>x&&y&&x!==y?((x>y)===hi?1:-1):0;
    const shared=wAll().filter(g=>g.who.includes(A)&&g.who.includes(B));
    const same=[], diff=[];
    if(A.country&&A.country===B.country) same.push('من نفس البلد: '+A.country); else if(A.country&&B.country) diff.push('البلد: '+A.country+' / '+B.country);
    if(a.a&&b.a){ Math.abs(a.a-b.a)<=3?same.push('عمر متقارب ('+a.a+' و '+b.a+')'):diff.push('فرق العمر '+Math.abs(a.a-b.a)+' سنوات'); }
    if(a.h&&b.h){ Math.abs(a.h-b.h)<=4?same.push('طول متقارب'):diff.push('فرق الطول '+Math.abs(a.h-b.h)+' سم'); }
    const ct=[...a.tg].filter(t=>b.tg.has(t)); if(ct.length) same.push('وسوم مشتركة: '+ct.slice(0,6).map(t=>'#'+t).join(' '));
    const cs=[...a.st].filter(s=>b.st.has(s)); if(cs.length) same.push('استوديوهات مشتركة: '+cs.slice(0,4).join('، '));
    if(shared.length) same.push(shared.length+' عمل مشترك بينهما');
    if(A.tier&&A.tier===B.tier) same.push('نفس المستوى '+A.tier); if(A.fav&&B.fav) same.push('كلتاهما في المفضلة');
    if(a.r&&b.r&&Math.abs(a.r-b.r)>=1) diff.push('تقييمك يفضّل '+(a.r>b.r?A.name:B.name)+' بفارق '+Math.abs(a.r-b.r).toFixed(1));
    const oa=[...a.tg].filter(t=>!b.tg.has(t)).slice(0,4), ob=[...b.tg].filter(t=>!a.tg.has(t)).slice(0,4);
    if(oa.length) diff.push(A.name+' فقط: '+oa.map(t=>'#'+t).join(' ')); if(ob.length) diff.push(B.name+' فقط: '+ob.map(t=>'#'+t).join(' '));
    const col=(i,k)=>`<div class="cm-c">${big(i)?`<img src="${esc(big(i))}" data-fb="${esc(pic(i))}" decoding="async" alt="">`:'<i>♡</i>'}<h2>${esc(i.name)}</h2>${btn('co'+k,'فتح صفحتها',`data-p="${esc(i.id)}"`,'sm')}</div>`;
    return `<div class="tv-page tv-scroll cm"><header class="tv-ph"><h1>⚖️ مقارنة</h1></header>
      <section class="cm-top" data-row="cm">${col(A,'a')}<div class="cm-t">
        ${line('التقييم',a.r?'★ '+a.r.toFixed(1):'—',b.r?'★ '+b.r.toFixed(1):'—',cmpN(a.r,b.r,true))}
        ${line('المستوى',A.tier||'—',B.tier||'—',A.tier&&B.tier&&A.tier!==B.tier?(TR.indexOf(A.tier)<TR.indexOf(B.tier)?1:-1):0)}
        ${line('ترتيب المواجهات',a.rk?'#'+a.rk:'—',b.rk?'#'+b.rk:'—',cmpN(a.rk,b.rk,false))}
        ${line('العمر',a.a!=null?a.a:'—',b.a!=null?b.a:'—')}${line('البلد',esc(A.country||'—'),esc(B.country||'—'))}${line('الطول',a.h?a.h+' سم':'—',b.h?b.h+' سم':'—')}
        ${line('الأعمال',a.w,b.w,cmpN(a.w,b.w,true))}${line('شاهدت',a.s,b.s,cmpN(a.s,b.s,true))}${line('الصور',a.ph,b.ph)}${line('المفضلة',A.fav?'♥':'—',B.fav?'♥':'—')}
      </div>${col(B,'b')}</section>
      <section class="cm-sd" data-row="cmx"><div class="f cm-box" tabindex="0" data-k="cmx:s"><h3>أوجه التشابه</h3>${same.length?same.map(x=>'<p>• '+esc(x)+'</p>').join(''):'<p class="tv-note0">لا تشابه واضح</p>'}</div>
        <div class="f cm-box" tabindex="0" data-k="cmx:d"><h3>أوجه الاختلاف</h3>${diff.length?diff.map(x=>'<p>• '+esc(x)+'</p>').join(''):'<p class="tv-note0">متشابهتان جدًا</p>'}</div></section>
      <div class="tv-acts cm-a" data-row="cma">${btn('cmb','تبديل الثانية',`data-act="cmb"`)}${btn('cmw','بدّل الطرفين',`data-act="cmw"`)}</div>
      ${row('cmsh','أعمال مشتركة',shared.slice(0,ROWLIM).map(g=>wCard(g)),'','wide')}<div class="tv-pad"></div></div>`; }

  // --- مجموعاتي: القوائم والوسوم بشكل مرئي ---
  function listsPage(){ const tags=topN(items.flatMap(i=>i.tags||[]),8).map(x=>x[0]);
    const byR=(a,b)=>(b.rating||0)-(a.rating||0);
    const ls=lists.map(L=>[L,items.filter(i=>(i.lists||[]).includes(L.id)).sort(byR)]).filter(x=>x[1].length);
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>مجموعاتي</h1><span>${lists.length} قائمة · ${tags.length} وسم شائع</span></header>
      ${ls.map(([L,l])=>row('L'+L.id,'📂 '+esc(L.name)+' <small>'+l.length+'</small>',l.slice(0,ROWLIM).map(i=>pCard(i)),'lib:L:'+L.id)).join('')||'<p class="tv-note">لا قوائم بعد — أنشئها من الجوال وستظهر هنا بعد المزامنة.</p>'}
      ${row('gS','⭐ المستوى S',items.filter(i=>i.tier==='S').sort(byR).slice(0,ROWLIM).map(i=>pCard(i)),'lib:S')}
      ${tags.map(t=>{ const l=items.filter(i=>(i.tags||[]).includes(t)).sort(byR); return row('T'+t,'#'+esc(t)+' <small>'+l.length+'</small>',l.slice(0,ROWLIM).map(i=>pCard(i)),'lib:T:'+t); }).join('')}<div class="tv-pad"></div></div>`; }

  // --- ملفي: إحصائياتي وتفضيلاتي ---
  function me(){ const all=wAll(), rated=items.filter(i=>i.rating>0), avg=rated.length?rated.reduce((a,i)=>a+ +i.rating,0)/rated.length:0;
    const seen=all.filter(g=>g.seen), photos=items.reduce((a,i)=>a+(i.photos||[]).length,0);
    const stat=(k,v,t,go)=>`<button class="f me-s" data-k="ms:${k}" ${go?`data-go="${go}"`:'tabindex="0"'}><b>${v}</b><span>${t}</span></button>`;
    const bars=(k,title,pairs,go)=>{ const mx=Math.max(1,...pairs.map(p=>p[1])); return `<div class="f me-box" tabindex="0" data-k="mb:${k}"><h3>${title}</h3>${pairs.length?pairs.map(([n,v])=>`<div class="me-b"><span>${esc(n)}</span><i><u style="width:${Math.round(v/mx*100)}%"></u></i><b>${v}</b></div>`).join(''):'<p class="tv-note0">لا بيانات بعد</p>'}</div>`; };
    const rd=[5,4,3,2,1].map(n=>['★'.repeat(n),items.filter(i=>Math.round(i.rating||0)===n).length]);
    const tiers=['S','A','B','C','D'].map(t=>['المستوى '+t,items.filter(i=>i.tier===t).length]).filter(x=>x[1]);
    const months=[...Array(6)].map((_,k)=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-k); const m=d.toISOString().slice(0,7); return [d.toLocaleDateString('ar',{month:'long'}),seen.filter(g=>(g.wd||'').startsWith(m)).length]; }).reverse();
    const fav=items.filter(i=>perfWeight(i)>1), cc=topN(fav.map(i=>i.country).filter(Boolean),1)[0], tt=topN(fav.flatMap(i=>i.tags||[]),3).map(x=>'#'+x[0]);
    const ages=fav.map(ageOf).filter(x=>x!=null), avAge=ages.length?Math.round(ages.reduce((a,b)=>a+b,0)/ages.length):0;
    const most=items.map(i=>[i,(i.works||[]).filter(w=>w.w).length]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1])[0];
    const taste=[cc?'تميل إلى ممثلات من <b>'+esc(cc[0])+'</b>':'',avAge?'بعمر <b>'+avAge+'</b> تقريبًا':'',tt.length?'ووسومك الأقرب: <b>'+esc(tt.join(' '))+'</b>':''].filter(Boolean).join('، ');
    return `<div class="tv-page tv-scroll me"><header class="tv-ph"><h1>ملفي</h1><span>إحصائياتك وتفضيلاتك</span></header>
      <section class="me-row" data-row="ms">${stat('n',items.length,'ممثلة','lib')}${stat('f',items.filter(i=>i.fav).length,'مفضلة','lib:fav')}${stat('r',avg?avg.toFixed(1):'—','متوسط تقييمك','lib:rating')}${stat('w',all.length,'عمل','works')}${stat('s',seen.length,'شاهدت','works:seen')}${stat('q',all.filter(g=>g.q).length,'للمشاهدة','works:watchlist')}${stat('u',wApply(all,'upcoming').length,'قادمة','works:upcoming')}${stat('p',photos,'صورة','show')}</section>
      <section class="me-row" data-row="mt"><div class="f me-box wide" tabindex="0" data-k="mb:taste"><h3>ذوقك باختصار</h3><p class="me-t">${taste||'قيّم بعض الممثلات وأضفهن للمفضلة ليظهر ملخص ذوقك.'}</p>${most?`<p class="me-t">أكثر من شاهدت أعمالها: <b>${esc(most[0].name)}</b> (${most[1]} عمل)</p>`:''}</div></section>
      <section class="me-row" data-row="mb">${bars('r','توزيع تقييماتك',rd)}${bars('m','مشاهداتك آخر 6 أشهر',months)}${bars('c','أكثر البلدان',topN(items.map(i=>i.country).filter(Boolean),6))}</section>
      <section class="me-row" data-row="mb2">${bars('t','أكثر الوسوم',topN(items.flatMap(i=>i.tags||[]),6).map(([t,n])=>['#'+t,n]))}${bars('st','أكثر الاستوديوهات',topN(all.map(g=>g.s).filter(Boolean),6))}${bars('ti','المستويات',tiers)}</section>
      <div class="tv-pad"></div></div>`; }

  async function sync(){ const s=await Sync.tvInfo(), last=s.last;
    return `<div class="tv-page tv-scroll sy"><header class="tv-ph"><h1>اتصال بالجوال</h1></header>
      <div class="sy-wrap"><div class="sy-qr">${s.link&&window.QR?window.QR(s.link):'<i>📶</i>'}</div>
        <div class="sy-info">${s.err?`<p class="sy-err">⚠ ${esc(s.err)}</p>`:''}
          <ol><li><b>امسح الرمز</b> بكاميرا الجوال ← يُفتح تطبيق المفضلة ويبدأ الإرسال.</li><li>أو في الجوال: المزيد ← <b>الشاشة</b> ← ربط بشاشة، واكتب:</li></ol>
          <div class="sy-kv"><span>العنوان</span><b dir="ltr">${esc(s.ip||'—')}${s.port&&s.port!==8765?':'+s.port:''}</b></div><div class="sy-kv"><span>الرمز</span><b dir="ltr" class="code">${esc(s.code)}</b></div>
          <p class="tv-note0">الجهازان على نفس شبكة Wi-Fi. بعد الربط يصل أي تعديل من الجوال خلال ثوانٍ، وأبقِ التطبيق مفتوحًا على الشاشة.</p>
          <p class="tv-note0">${last?'آخر مزامنة: '+esc(fmtDate(last.at))+' '+new Date(last.at).toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'})+(last.sent!=null?' · '+last.sent+' ممثلة، '+(last.photos||0)+' صورة':''):'لم تصل أي مزامنة بعد.'} · في المكتبة الآن ${items.length} ممثلة.</p>
          <div class="tv-acts" data-row="sya">${btn('newcode','رمز جديد','data-act="newcode"')}${btn('impurl','استيراد من رابط','data-act="impurl"')}${btn('impdir','استيراد من مجلد','data-act="impdir"')}</div></div></div></div>`; }

  function settings(){ const th=LS.get('vkte_theme','dark'), sc=LS.get('vkte_tvs','1'), an=LS.get('vkte_tv_anim','1');
    const o=(k,t,on_)=>btn(k,t,`data-act="${k}"`,'chip'+(on_?' on':''));
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>الإعدادات</h1></header>
      <section class="tv-sec" data-row="s1"><h3>حجم الواجهة</h3><div class="tv-hs tvch">${[['0.85','صغير'],['1','متوسط'],['1.15','كبير']].map(([v,t])=>btn('sc:'+v,t,`data-sc="${v}"`,'chip'+(sc===v?' on':''))).join('')}</div></section>
      <section class="tv-sec" data-row="s1b"><h3>الحركة</h3><div class="tv-hs tvch">${btn('an:1','حركة ناعمة',`data-an="1"`,'chip'+(an==='1'?' on':''))}${btn('an:0','بلا حركة (أسرع للأجهزة الضعيفة)',`data-an="0"`,'chip'+(an==='0'?' on':''))}</div></section>
      <section class="tv-sec" data-row="s2"><h3>المظهر</h3><div class="tv-hs tvch">${[['dark','داكن بنفسجي'],['amoled','أسود AMOLED']].map(([v,t])=>btn('th:'+v,t,`data-th="${v}"`,'chip'+(th===v?' on':''))).join('')}</div></section>
      <section class="tv-sec" data-row="s3"><h3>الخصوصية</h3><div class="tv-hs tvch">${o('blur','تمويه الصور',document.body.classList.contains('blur'))}${Lock.has()?o('lock','قفل الآن',false):''}${o('qhclr','مسح سجل البحث',false)}</div></section>
      <section class="tv-sec" data-row="s4"><h3>الأعمال</h3><div class="tv-hs tvch">${o('radar','تحديث الأعمال من المصادر',false)}</div></section>
      <section class="tv-sec" data-row="s5"><h3>الواجهة</h3><div class="tv-hs tvch">${o('keys','طريقة استخدام الريموت',false)}${o('mobile','التبديل إلى واجهة الجوال',false)}</div></section>
      <div class="tv-about"><div><span>الإصدار</span><b dir="ltr">${esc(APP_VER||'—')}</b></div><div><span>المكتبة</span><b>${items.length} ممثلة · ${wAll().length} عمل</b></div><div><span>WebView</span><b dir="ltr">Chrome ${esc(webview())}</b></div><div><span>الشاشة</span><b dir="ltr">${innerWidth}×${innerHeight} @${devicePixelRatio}x</b></div></div>
      <p class="tv-note">لتعديل الممثلات وإضافتها استخدم الجوال؛ التغييرات تصل الشاشة بالمزامنة.</p><div class="tv-pad"></div></div>`; }

  // ---------------- الحركة بالتحويلات (بدل التمرير) ----------------
  function wrap(scope){ scope.querySelectorAll('.tv-hs').forEach(hs=>{ if(hs.firstElementChild&&hs.firstElementChild.classList.contains('tv-tr')) return; const t=document.createElement('div'); t.className='tv-tr'; while(hs.firstChild) t.appendChild(hs.firstChild); hs.appendChild(t); t._x=0; });
    scope.querySelectorAll('.tv-scroll').forEach(sc=>{ if(sc.firstElementChild&&sc.firstElementChild.classList.contains('tv-vt')) return; const t=document.createElement('div'); t.className='tv-vt'; while(sc.firstChild) t.appendChild(sc.firstChild); sc.appendChild(t); t._y=0; }); }
  const setX=(tr,x)=>{ if(tr._x===x) return; tr._x=x; tr.style.transform=x?`translate3d(${x}px,0,0)`:''; };
  const setY=(vt,y)=>{ if(vt._y===y) return; vt._y=y; vt.style.transform=y?`translate3d(0,${y}px,0)`:''; };
  function offIn(el,anc){ let x=0,y=0,n=el; while(n&&n!==anc){ x+=n.offsetLeft; y+=n.offsetTop; n=n.offsetParent; } return n===anc?{x,y}:null; }
  function reveal(el){ const tr=el.closest('.tv-tr'), vt=el.closest('.tv-vt');
    if(tr){ const hs=tr.parentElement, W=hs.clientWidth, TW=tr.offsetWidth, pad=Math.min(W*.1,el.offsetWidth*.8);
      if(TW<=W) setX(tr,0); else { const L=tr.offsetLeft+el.offsetLeft; let x=tr._x||0; const A=pad-L, B=W-pad-L-el.offsetWidth; if(x<A) x=A; if(x>B) x=B;
        x=Math.min(-tr.offsetLeft,Math.max(W-tr.offsetLeft-TW,x)); setX(tr,Math.round(x)); } }
    if(vt){ const sc=vt.parentElement, H=sc.clientHeight, VH=vt.offsetHeight, tg=el.closest('.tv-sec,.pp-head,.tv-ph,.ex-stage,.cm-top,.me-row,.cm-sd')||el, o=offIn(tg,vt); if(!o) return;
      // المواضع نسبةً لإطار الصفحة (vt قد يبدأ بعد هامش علوي)
      const oT=vt.offsetTop, top=H*.04, bot=H*.97, h=tg.offsetHeight; let y=vt._y||0; const oy=o.y+oT;
      if(h>H){ const eo=offIn(el,vt)||o, ey=eo.y+oT, eh=el.offsetHeight; if(ey+y<top) y=top-ey; else if(ey+eh+y>bot) y=bot-ey-eh; }
      else if(h>H*.9){ y=Math.max(H-oy-h,Math.min(-oy,y)); }   // يتسع بالكاد: يظهر كاملًا بلا هوامش (لا يُقص العنوان)
      else if(oy+y<top) y=top-oy; else if(oy+h+y>bot) y=bot-oy-h;
      y=Math.min(0,Math.max(Math.min(0,H-VH-oT),y)); setY(vt,Math.round(y)); }
    else if(el.closest('.overlay,#ovAsk')) try{ el.scrollIntoView({block:'nearest'}); }catch{} }
  function rectOf(el){ const vt=el.closest('.tv-vt'); if(!vt) return el.getBoundingClientRect(); const o=offIn(el,vt); if(!o) return el.getBoundingClientRect();
    const sc=vt.parentElement.getBoundingClientRect(), tr=el.closest('.tv-tr'), l=sc.left+vt.offsetLeft+o.x+((tr&&tr._x)||0), t=sc.top+vt.offsetTop+o.y+(vt._y||0);
    return {left:l,top:t,right:l+el.offsetWidth,bottom:t+el.offsetHeight,width:el.offsetWidth,height:el.offsetHeight}; }

  // ---------------- التنقل بين الصفحات ----------------
  const PAGES={home,lib,person,works,recs,search,sync,set:settings,explore,cmp,lists:listsPage,me};
  const INFO=new Set(['lib','works','recs','cmp','lists']);
  const focusKey=()=>{ const a=document.activeElement; return a&&root.contains(a)&&a.dataset.k||''; };
  const offsets=()=>[...main.querySelectorAll('.tv-tr,.tv-vt')].map(e=>e._x!=null?e._x:e._y);
  function restoreOffsets(o){ if(!o) return; root.classList.add('nt'); main.querySelectorAll('.tv-tr,.tv-vt').forEach((e,k)=>{ if(o[k]==null) return; e.classList.contains('tv-tr')?setX(e,o[k]):setY(e,o[k]); }); void main.offsetWidth; requestAnimationFrame(()=>root.classList.remove('nt')); }
  async function draw(keep){ const fk=keep?focusKey():'', of=keep?offsets():null;
    root.dataset.page=page; if(INFO.has(page)&&!(page==='cmp'&&args.b)) root.dataset.info='1'; else delete root.dataset.info; infoEl.innerHTML='';
    const html=await (PAGES[page]||home)(); root.classList.add('nt'); main.innerHTML=html; wrap(main);
    const navKey=page==='person'?'lib':page==='cmp'?'home':page;
    nav.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('cur',b.dataset.go===navKey));
    if(page==='search') drawSearchRes(args.q||'');
    restoreOffsets(of); requestAnimationFrame(()=>root.classList.remove('nt'));
    if(page==='person'||page==='explore'){ const i=P(page==='person'?args.id:exIds[args.n||0]); setBg(i?pic(i):''); } else if(page!=='home') setBg('');
    if(page==='home') hero(null);
    if(keep&&fk){ const el=main.querySelector(`[data-k="${CSS.escape(fk)}"]`)||nav.querySelector(`[data-k="${CSS.escape(fk)}"]`); if(el){ focusEl(el); return; } }
    if(keep&&nav.contains(document.activeElement)) return;
    focusEl(firstMain()||nav.querySelector('.cur')); }
  const firstMain=()=>{ if(args.fk){ const e=main.querySelector(`[data-k="${CSS.escape(args.fk)}"]`); if(e) return e; }
    if(page==='search') return main.querySelector('.kb .f');
    return main.querySelector('.ex-ph,.cm-top .tb,.tv-grid .f,.tv-rows .f,.pp-head .tb,.me-s,.f'); };
  function go(p,a,push){ if(p==='show'){ Gallery.playLibrary(); return; } if(p==='studio'){ Studio.open(); return; }
    if(push!==false) stack.push({page,args:{...args,fk:focusKey()},of:offsets()}); if(stack.length>20) stack.shift();
    if(page==='search'&&p!=='search') saveQ(args.q);
    if(p==='person'&&a&&a.id) track(a.id);
    page=p; args=a||{}; lim=CHUNK; closeLayer(); return draw(false); }
  async function back(){
    if(typeof Gallery!=='undefined'&&Gallery.isOpen()){ Gallery.close(); return true; }
    if($('lock').classList.contains('show')) return true;
    if(ask.cancel){ ask.cancel(); return true; }
    const ov=[...document.querySelectorAll('.overlay.show:not(.page)')].pop(); if(ov){ ov.classList.remove('show'); return true; }
    if(!layerEl.hidden){ closeLayer(); return true; }
    if(stack.length){ const s=stack.pop(); page=s.page; args=s.args; lim=Math.max(CHUNK,lim); await draw(false); restoreOffsets(s.of); const e=firstMain(); if(e) focusEl(e); return true; }
    if(page!=='home'){ go('home',{},false); return true; }
    if(!nav.contains(document.activeElement)){ focusEl(nav.querySelector('.cur')||nav.querySelector('.f')); return true; }
    return false; }
  function appendMore(){ const g=main.querySelector('.tv-grid'); if(!g||!gridCard||lim>=gridList.length) return false; const n=gridList.slice(lim,lim+CHUNK); lim+=n.length; g.insertAdjacentHTML('beforeend',n.map(gridCard).join('')); return true; }

  // ---------------- النوافذ ----------------
  let layerRet=null, curWork='';
  function openLayer(html,scroll){ if(!layerEl.contains(document.activeElement)) layerRet=document.activeElement;
    layerEl.innerHTML=scroll?`<div class="tv-panel scr"><div class="tv-scroll">${html}<div class="tv-pad2"></div></div></div>`:`<div class="tv-panel">${html}</div>`;
    wrap(layerEl); layerEl.hidden=false; root.classList.add('layered'); const f=layerEl.querySelector('.f.on,.f.pri,.f'); if(f) focusEl(f); }
  function closeLayer(){ if(layerEl.hidden) return; layerEl.hidden=true; layerEl.innerHTML=''; root.classList.remove('layered'); if(layerRet&&document.contains(layerRet)) focusEl(layerRet); layerRet=null; }
  function workLayer(key){ const g=wAll().find(x=>x.key===key); if(!g) return; curWork=key;
    openLayer(`<div class="wl"><div class="wl-ph">${wCoverHtml(g)}</div><div class="wl-b"><h2 dir="auto">${esc(g.t)}</h2>
      <p class="pp-m">${esc([g.s,g.d?fmtWd(g.d):g.y,g.du?fmtDur(g.du):''].filter(Boolean).join(' · '))}${isUpcoming(g)?' · <b>قادم '+esc(upTxt(g))+'</b>':''}${g.seen&&g.wd?' · شاهدته '+esc(fmtWd(g.wd)):''}</p>
      ${g.ds?`<p class="pp-n">${esc(g.ds)}</p>`:''}${(g.tg||[]).length?`<div class="pp-c">${g.tg.slice(0,8).map(t=>`<span class="pc">#${esc(t)}</span>`).join('')}</div>`:''}
      <div class="tv-acts" data-row="wa">${btn('seen',g.seen?'✓ شاهدته':'👁 تعليم كمشاهَد','data-wa="seen"',g.seen?'on':'pri')}${btn('q',g.q?'🔖 في قائمة المشاهدة':'🔖 للمشاهدة لاحقًا','data-wa="q"',g.q?'on':'')}${btn('rec','👍 أنصح به','data-wa="rec"',g.rec?'on':'')}</div>
      <div class="tv-acts tv-stars" data-row="wr">${[1,2,3,4,5].map(n=>btn('wr'+n,'★',`data-wr="${n}"`,'star'+(n<=(g.r||0)?' on':''))).join('')}${g.r?btn('wr0','مسح','data-wr="0"','chip sm'):''}</div></div></div>
      <section class="tv-sec wl-who" data-row="wp"><h3>المشاركات في العمل</h3><div class="tv-hs">${g.who.map(i=>pCard(i,i.rating?starsTxt(i.rating):'')).join('')}</div></section>`); }
  function wAct(key,k,v){ wMut(key,w=>{ if(k==='seen'){ if(w.w) delete w.w; else { w.w=1; delete w.upc; if(!w.wd) w.wd=todayStr(); } } else if(k==='q'){ if(w.q) delete w.q; else w.q=1; } else if(k==='rec'){ if(w.rec) delete w.rec; else w.rec=1; } else if(k==='r'){ if(v) w.r=v; else delete w.r; } });
    const fk=focusKey(); if(!layerEl.hidden&&curWork===key&&layerEl.querySelector('.wl')){ workLayer(key); const e=layerEl.querySelector(`[data-k="${CSS.escape(fk)}"]`); if(e) focusEl(e); } refresh(); }
  function rateLayer(id){ const i=P(id); if(!i) return; curP=id;
    openLayer(`<h2>تقييم ${esc(i.name)}</h2><div class="tv-acts tv-stars tvbig" data-row="rr">${[1,2,3,4,5].map(n=>btn('pr'+n,'★',`data-pr="${n}"`,'star'+(n<=Math.round(i.rating||0)?' on':''))).join('')}</div>
      <h3>المستوى</h3><div class="tv-acts" data-row="rt">${['S','A','B','C','D'].map(t=>btn('pt'+t,t,`data-pt="${t}"`,'chip tier t'+t+(i.tier===t?' on':''))).join('')}${i.tier?btn('pt0','بلا','data-pt=""','chip'):''}</div>`); }
  function recLayer(n){ const c=(_recCache.list||[])[n]; if(!c) return;
    openLayer(`<div class="wl"><div class="wl-ph tall">${c.img?`<img class="wcv-im" src="${esc(c.img)}" referrerpolicy="no-referrer" alt="">`:'<i>♡</i>'}</div><div class="wl-b"><h2>${esc(c.name)}</h2>
      <p class="pp-m">توافق <b>${c.matchPct||'?'}٪</b> · ${esc([c.cc?ctryName(c.cc):c.country,candAge(c)?candAge(c)+' سنة':'',c.src].filter(Boolean).join(' · '))}</p>
      <h3>لماذا اقترحناها</h3><div class="pp-n why">${(c.reasons||[]).slice(0,5).map(r=>'• '+esc(r)).join('<br>')||'تشبه ممثلات تحبهن'}</div>
      <div class="tv-acts" data-row="ra2">${btn('radd','♥ إضافة لمكتبتي',`data-ra="add" data-n="${n}"`,'pri')}${btn('rlike','👍 أعجبتني',`data-ra="like" data-n="${n}"`)}${btn('rign','✕ ليست ذوقي',`data-ra="ign" data-n="${n}"`)}</div></div></div>`); }
  // خيارات سريعة (ضغطة مطوّلة على OK أو زر القائمة)
  let curP='';
  function quickLayer(el){ if(el.dataset.p||el.dataset.cp){ const i=P(el.dataset.p||el.dataset.cp); if(!i) return; curP=i.id;
      openLayer(`<div class="qk"><div class="qk-ph">${imgOf(pic(i))}</div><div class="wl-b"><h2>${esc(i.name)}</h2><p class="pp-m">${esc([i.country,ageOf(i)!=null?ageOf(i)+' سنة':'',i.rating?starsTxt(i.rating):''].filter(Boolean).join(' · '))}</p>
        <div class="tv-opts">${opt('qo','فتح صفحتها',`data-p="${esc(i.id)}"`)}${opt('qf',i.fav?'♥ إزالة من المفضلة':'♡ إضافة للمفضلة','data-qa="fav"',i.fav)}${opt('qr','★ تقييم ومستوى','data-qa="rate"')}${opt('qc','⚖️ قارن مع…','data-qa="cmp"')}${(i.photos||[]).length?opt('qs','▶ عرض صورها','data-qa="show"'):''}</div></div></div>`); return true; }
    if(el.dataset.w){ const g=wAll().find(x=>x.key===el.dataset.w); if(!g) return; curWork=g.key;
      openLayer(`<h2 dir="auto">${esc(g.t)}</h2><p class="pp-m">${esc(g.who.map(x=>x.name).join('، '))}</p><div class="tv-opts">${opt('qwo','فتح التفاصيل',`data-w="${esc(g.key)}"`)}${opt('qws',g.seen?'✓ إلغاء المشاهدة':'👁 تعليم كمشاهَد','data-wa="seen"',g.seen)}${opt('qwq',g.q?'🔖 إزالة من قائمة المشاهدة':'🔖 للمشاهدة لاحقًا','data-wa="q"',g.q)}${g.who.map(i=>opt('qwp:'+i.id,'صفحة '+esc(i.name),`data-p="${esc(i.id)}"`)).join('')}</div>`); return true; }
    if(el.dataset.rec!=null){ recLayer(+el.dataset.rec); return true; } }
  function helpLayer(){ openLayer(`<h2>طريقة استخدام الريموت</h2><div class="hl">
    <p><b>الأسهم</b> للتنقل بين البطاقات والأرفف. الضغط المستمر يسرّع الحركة.</p><p><b>OK</b> يفتح العنصر. <b>ضغطة مطوّلة على OK</b> (أو زر القائمة ☰) تفتح خيارات سريعة: مفضلة، تقييم، مقارنة…</p>
    <p><b>رجوع</b> يغلق النافذة ثم يعود للصفحة السابقة بنفس موضعك، ثم للقائمة الجانبية.</p><p><b>السهم الأيمن</b> من أول الرف يفتح القائمة الجانبية.</p><p>في <b>البحث</b>: اكتب بلوحة المفاتيح على الشاشة أو اضغط 🎤 للبحث الصوتي.</p></div><div class="tv-acts">${btn('hlok','حسنًا','data-act="lclose"','pri')}</div>`); }

  // ---------------- شريط المعلومات (معاينة سريعة للعنصر المحدد) ----------------
  function infoFor(t){ if(!root.dataset.info||!t||!main.contains(t)){ return; } let h='';
    const id=t.dataset.p||t.dataset.cp;
    if(id){ const i=P(id); if(i){ const a=ageOf(i), n=(i.works||[]).length;
      h=`<b>${esc(i.name)}</b>${i.rating?`<span class="ir">${starsTxt(i.rating)}</span>`:''}<span>${esc([i.tier?'المستوى '+i.tier:'',i.country,a!=null?a+' سنة':'',n?n+' عمل':'',(i.photos||[]).length?(i.photos||[]).length+' صورة':''].filter(Boolean).join(' · '))}</span>${(i.tags||[]).slice(0,4).map(x=>`<span class="pc">#${esc(x)}</span>`).join('')}`; } }
    else if(t.dataset.w){ const g=wAll().find(x=>x.key===t.dataset.w); if(g) h=`<b dir="auto">${esc(g.t)}</b>${g.r?`<span class="ir">★ ${g.r}</span>`:''}<span>${esc([g.who.map(x=>x.name).join('، '),g.s,g.d?fmtWd(g.d):g.y,g.du?fmtDur(g.du):'',g.seen?'شاهدته':isUpcoming(g)?'قادم '+upTxt(g):''].filter(Boolean).join(' · '))}</span>`; }
    else if(t.dataset.rec!=null){ const c=(_recCache.list||[])[+t.dataset.rec]; if(c) h=`<b>${esc(c.name)}</b><span class="ir">توافق ${c.matchPct||'?'}٪</span><span>${esc((c.reasons||[]).slice(0,2).join(' · '))}</span>`; }
    if(!h){ infoEl.innerHTML=''; return; }
    const g=t.closest('.tv-grid'); const pos=g?`<i class="ip">${[...g.children].indexOf(t)+1} / ${gridList.length||g.children.length}</i>`:'';
    infoEl.innerHTML=`<div class="tvib">${h}</div>${pos}<small class="ih">OK للفتح · مطوّلًا للخيارات</small>`; }

  // ---------------- الأحداث ----------------
  async function onClick(e){ const t=e.target.closest('.f,[data-go]'); if(!t||!root.contains(t)) return; const d=t.dataset;
    if(page==='search'&&(d.p||d.w)) saveQ(args.q);
    if(d.go){ const s=d.go.indexOf(':'), p=s<0?d.go:d.go.slice(0,s), x=s<0?'':d.go.slice(s+1);
      if(p==='show'){ Gallery.playLibrary(); return; }
      if(p==='lib') return go('lib',{f:x&&(LF[x]||/^[LT]:/.test(x))?x:'all',s:x&&LS_SORT[x]?x:'rating'}); if(p==='works') return go('works',{t:x||'recent'});
      if(nav.contains(t)){ stack=[]; return go(p,{},false); } return go(p,{}); }
    if(d.p){ closeLayer(); return go('person',{id:d.p}); }
    if(d.cp){ return args.a&&args.a!==d.cp?go('cmp',{a:args.a,b:d.cp}):go('cmp',{a:d.cp}); }
    if(d.w) return workLayer(d.w);
    if(d.rec!=null&&!d.ra) return recLayer(+d.rec);
    if(d.ex){ const i=P(exIds[args.n||0]); if(i) go('person',{id:i.id}); return; }
    if(d.ph!=null){ const i=P(args.id); if(i) Gallery.open(i.photos,+d.ph); return; }
    if(d.key!=null){ setQ((args.q||'')+d.key); return; }
    if(d.kbx){ if(d.kbx==='bs') setQ((args.q||'').slice(0,-1)); else if(d.kbx==='cl') setQ(''); else { args.kb=(args.kb||'ar')==='ar'?'en':'ar'; const kb=$$('#tvKb'); kb.innerHTML=kbHtml(); focusEl(kb.querySelector('[data-kbx="lg"]')); } return; }
    if(d.scope){ args.scope=d.scope; root.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('on',b===t)); drawSearchRes(args.q||''); return; }
    if(d.qh!=null){ setQ(d.qh); return; }
    if(d.lf!=null){ args.f=d.lf; lim=CHUNK; closeLayer(); return draw(true); }
    if(d.ls!=null){ args.s=d.ls; lim=CHUNK; closeLayer(); return draw(true); }
    if(d.wst!=null){ args.st=d.wst; lim=CHUNK; closeLayer(); return draw(true); }
    if(d.wt!=null){ args.t=d.wt; lim=CHUNK; return draw(true); }
    if(d.sc!=null){ LS.set('vkte_tvs',d.sc); applyPrefs(); return draw(true); }
    if(d.an!=null){ LS.set('vkte_tv_anim',d.an); applyPrefs(); return draw(true); }
    if(d.th!=null){ LS.set('vkte_theme',d.th); document.documentElement.dataset.theme=d.th; return draw(true); }
    if(d.wa){ if(layerEl.querySelector('.tv-opts')&&!layerEl.querySelector('.wl')){ const k=curWork; closeLayer(); wAct(k,d.wa); toast(d.wa==='seen'?'✓ تم':'🔖 تم'); return; } return wAct(curWork,d.wa); }
    if(d.wr!=null) return wAct(curWork,'r',+d.wr);
    if(d.pr!=null||d.pt!=null){ const i=P(curP||args.id); if(!i) return; if(d.pr!=null){ const n=+d.pr; i.rating=i.rating===n?0:n; } else { if(d.pt) i.tier=d.pt; else delete i.tier; }
      i.updated=Date.now(); await save(i); const fk=focusKey(); rateLayer(i.id); const el=layerEl.querySelector(`[data-k="${CSS.escape(fk)}"]`); if(el) focusEl(el); refresh(); return; }
    if(d.qa){ const i=P(curP); if(!i) return;
      if(d.qa==='fav'){ closeLayer(); i.fav=!i.fav; i.updated=Date.now(); await save(i); toast(i.fav?'♥ أُضيفت للمفضلة':'أُزيلت من المفضلة'); return; }
      if(d.qa==='rate') return rateLayer(i.id);
      if(d.qa==='cmp'){ closeLayer(); return go('cmp',{a:i.id}); }
      if(d.qa==='show'){ closeLayer(); return Gallery.playItem(i.id); } }
    if(d.ra){ const c=(_recCache.list||[])[+d.n]; if(!c) return; closeLayer(); if(d.ra==='add') await addRecToLibrary(c); else if(d.ra==='like') RecsPlus.like(c); else ignoreRecPerformer(c.name); return draw(true); }
    const a=d.act; if(!a) return;
    const i=P(args.id);
    if(a==='lclose') return closeLayer();
    if(a==='show'&&i) return Gallery.playItem(i.id);
    if(a==='fav'&&i){ i.fav=!i.fav; i.updated=Date.now(); await save(i); return draw(true); }
    if(a==='rate'&&i) return rateLayer(i.id);
    if(a==='cmp'&&i) return go('cmp',{a:i.id});
    if(a==='rpw'&&i){ const WMm=WM(); const pool=(i.works||[]).map(w=>WMm.get(wKeyOf(w))).filter(g=>g&&!g.seen&&!isUpcoming(g)); const g=pool[Math.floor(Math.random()*pool.length)]; if(g) workLayer(g.key); return; }
    if(a==='surprise') return surprise();
    if(a==='voice') return voice();
    if(a==='lfx'){ const tags=topN(items.flatMap(x=>x.tags||[]),16).map(x=>x[0]), f=args.f||'all';
      return pickLayer('القوائم والوسوم',[...lists.map(L=>opt('lfl:'+L.id,'📂 '+esc(L.name)+` <small>${items.filter(x=>(x.lists||[]).includes(L.id)).length}</small>`,`data-lf="L:${esc(L.id)}"`,f==='L:'+L.id)),...tags.map(t=>opt('lft:'+t,'#'+esc(t),`data-lf="T:${esc(t)}"`,f==='T:'+t)),opt('lfa','عرض الكل','data-lf="all"',false)]); }
    if(a==='lsx') return pickLayer('الترتيب',Object.entries(LS_SORT).map(([k,[t]])=>opt('ls:'+k,t,`data-ls="${k}"`,k===(args.s||'rating'))));
    if(a==='wst'){ const st=topN(wAll().map(g=>g.s).filter(Boolean),30); return pickLayer('الاستوديو',[opt('wst0','كل الاستوديوهات','data-wst=""',!args.st),...st.map(([s,n])=>opt('wst:'+s,esc(s)+` <small>${n}</small>`,`data-wst="${esc(s)}"`,args.st===s))]); }
    if(a==='exfav'){ const x=P(exIds[args.n||0]); if(x){ x.fav=!x.fav; x.updated=Date.now(); await save(x); draw(true); } return; }
    if(a==='exshow'){ const x=P(exIds[args.n||0]); if(x) Gallery.playItem(x.id); return; }
    if(a==='exnew'){ args.fresh=1; args.n=0; return draw(false); }
    if(a==='cmb') return go('cmp',{a:args.a});
    if(a==='cmw'){ const t2=args.a; args.a=args.b; args.b=t2; return draw(true); }
    if(a==='radar') return wRadar();
    if(a==='rndw'){ const pool=wApply(wAll(),'unseen'); const g=pool[Math.floor(Math.random()*pool.length)]; if(g) workLayer(g.key); else toast('لا أعمال غير مشاهَدة'); return; }
    if(a==='rref'){ busy.show('جارٍ تحليل ذوقك وجلب الاقتراحات…'); try{ await fetchApiRecommendations(true,t=>busy.show(t)); }catch(err){ toast('تعذّر جلب الاقتراحات — تحقق من الاتصال بالإنترنت'); } busy.hide(); return draw(true); }
    if(a==='newcode'){ await Sync.newCode(); return draw(true); }
    if(a==='impurl'){ $('bImpUrl').click(); return; }
    if(a==='impdir'){ $('bImpDir').click(); return; }
    if(a==='blur'){ setBlur(!document.body.classList.contains('blur')); root.classList.toggle('blur',document.body.classList.contains('blur')); return draw(true); }
    if(a==='lock'){ Lock.lockNow(); return; }
    if(a==='qhclr'){ LS.set('vkte_tv_qh','[]'); toast('مُسح سجل البحث'); return; }
    if(a==='keys') return helpLayer();
    if(a==='mobile'){ if(await askConfirm('التبديل إلى واجهة الجوال؟ يمكنك العودة من الإعدادات ← وضع التلفاز.','تبديل')){ LS.set('vkte_tv','0'); location.reload(); } return; } }

  // ---------------- محرّك التركيز ----------------
  function activeLayer(){ if($('lock').classList.contains('show')) return $('lock');
    if($('ovAsk').classList.contains('show')) return $('ovAsk'); if($('busy').classList.contains('show')) return $('busy');
    const ov=[...document.querySelectorAll('.overlay.show:not(.page)')].pop(); if(ov) return ov;
    if(!layerEl.hidden) return layerEl; return root; }
  const SEL_ANY='button:not([disabled]),a[href],input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea,summary,[tabindex="0"]';
  const shown=el=>el.offsetWidth>1&&el.offsetHeight>1&&!el.closest('[hidden]');
  function cands(L){ let l=[...L.querySelectorAll(L===root||L===layerEl?'.f':SEL_ANY)]; if(L===root) l=l.filter(e=>!layerEl.contains(e)); return l.filter(shown); }
  function focusEl(el){ if(!el) return; if(!el.matches('button,input,select,textarea,a[href],[tabindex]')) el.tabIndex=-1; try{ el.focus({preventScroll:true}); }catch{} reveal(el); }
  function pick(cur,dir,list){ const c=rectOf(cur), cx=c.left+c.width/2, cy=c.top+c.height/2; let best=null,bs=1e18;
    for(const el of list){ if(el===cur) continue; const r=rectOf(el), x=r.left+r.width/2, y=r.top+r.height/2, dx=x-cx, dy=y-cy; let m,perp,over;
      if(dir==='ArrowRight'){ if(r.left<c.right-c.width*.5&&dx<=4) continue; m=Math.max(0,r.left-c.right)+Math.abs(dx)*.1; perp=Math.abs(dy); over=r.bottom>c.top+4&&r.top<c.bottom-4; }
      else if(dir==='ArrowLeft'){ if(r.right>c.left+c.width*.5&&dx>=-4) continue; m=Math.max(0,c.left-r.right)+Math.abs(dx)*.1; perp=Math.abs(dy); over=r.bottom>c.top+4&&r.top<c.bottom-4; }
      else if(dir==='ArrowDown'){ if(r.top<c.bottom-c.height*.5&&dy<=4) continue; m=Math.max(0,r.top-c.bottom)+Math.abs(dy)*.1; perp=Math.abs(dx); over=r.right>c.left&&r.left<c.right; }
      else { if(r.bottom>c.top+c.height*.5&&dy>=-4) continue; m=Math.max(0,c.top-r.bottom)+Math.abs(dy)*.1; perp=Math.abs(dx); over=r.right>c.left&&r.left<c.right; }
      const s=m*2+perp*(over?.6:2.5)+(over?0:800); if(s<bs){ bs=s; best=el; } }
    return best; }
  // عناصر ظاهرة على الشاشة فعلًا (لا تلك المزاحة خارج إطار رفّها)
  const onScreen=el=>{ const hs=el.closest('.tv-hs'); if(!hs) return true; const r=rectOf(el), b=hs.getBoundingClientRect(); return r.right>b.left+4&&r.left<b.right-4; };
  function move(dir){ const L=activeLayer(); let cur=document.activeElement;
    if(!cur||cur===document.body||!L.contains(cur)||!shown(cur)){ const f=(L===root?(lastMain&&document.contains(lastMain)&&shown(lastMain)?lastMain:firstMain()):null)||cands(L)[0]; if(f) focusEl(f); return; }
    // وضع الاستكشاف: يمين/يسار على الصورة = الممثلة السابقة/التالية
    if(cur.dataset.ex&&(dir==='ArrowLeft'||dir==='ArrowRight')){ exStep(dir==='ArrowLeft'?1:-1); return; }
    const hs=cur.closest('.tv-hs');
    if(hs&&(dir==='ArrowLeft'||dir==='ArrowRight')&&L.contains(hs)){ const its=[...hs.querySelectorAll('.f')], i=its.indexOf(cur), rtl=document.documentElement.dir!=='ltr';
      const nx=its[i+((dir==='ArrowLeft')===rtl?1:-1)]; if(nx){ focusEl(nx); return; }
      // نهاية الرف: عنصر مجاور خارج الرف (مثل لوحة المفاتيح في البحث) وإلا فالقائمة الجانبية
      const side=pick(cur,dir,cands(L).filter(x=>!nav.contains(x)&&!hs.contains(x)&&onScreen(x)&&(()=>{ const r=rectOf(x), c=rectOf(cur); return r.bottom>c.top&&r.top<c.bottom; })())); if(side){ focusEl(side); return; }
      if(L===root&&dir==='ArrowRight'){ lastMain=cur; focusEl(nav.querySelector('.cur')||nav.querySelector('.f')); } return; }
    if(L===root&&nav.contains(cur)&&dir==='ArrowLeft'){ const t=lastMain&&document.contains(lastMain)&&shown(lastMain)?lastMain:firstMain(); if(t) focusEl(t); return; }
    let list;
    if(L===root&&nav.contains(cur)) list=[...nav.querySelectorAll('.f')];
    else { list=cands(L); if(L===root) list=list.filter(x=>!nav.contains(x));
      if(L===root&&(dir==='ArrowUp'||dir==='ArrowDown')){ const c=rectOf(cur), H=innerHeight; list=list.filter(x=>{ const r=rectOf(x); return dir==='ArrowDown'?(r.top>c.top&&r.top<c.bottom+H):(r.bottom<c.bottom&&r.bottom>c.top-H); }); }
      list=list.filter(onScreen); }
    let nx=pick(cur,dir,list);
    if(nx&&(dir==='ArrowUp'||dir==='ArrowDown')){ const r2=nx.closest('.tv-hs'); if(r2&&r2!==cur.closest('.tv-hs')&&r2._last&&r2.contains(r2._last)) nx=r2._last; }
    if(nx){ focusEl(nx); return; }
    if(L===root&&dir==='ArrowRight'&&!nav.contains(cur)){ lastMain=cur; focusEl(nav.querySelector('.cur')||nav.querySelector('.f')); return; }
    if(dir==='ArrowDown'&&L===root&&cur.closest('.tv-grid')&&appendMore()){ const n=pick(cur,dir,cands(root).filter(x=>!nav.contains(x))); if(n) focusEl(n); } }
  function onFocus(e){ const t=e.target; if(!t.classList||!t.classList.contains('f')) return; const hs=t.closest('.tv-hs'); if(hs) hs._last=t; if(!nav.contains(t)&&!layerEl.contains(t)) lastMain=t;
    if(page==='home'&&(t.dataset.p||t.dataset.w||t.dataset.rec!=null)){ clearTimeout(heroT); heroT=setTimeout(()=>hero(t),repeating?450:200); }
    if(root.dataset.info&&main.contains(t)){ clearTimeout(infoT); infoT=setTimeout(()=>infoFor(t),repeating?300:80); }
    const g=t.closest('.tv-grid'); if(g&&main.contains(g)){ const all=g.children; if([...all].indexOf(t)>all.length-16) appendMore(); } }
  function hero(t){ const el=$$('#tvHero'); if(!el) return; let h='', bg='';
    if(t&&t.dataset.w){ const g=wAll().find(x=>x.key===t.dataset.w); if(g){ bg=pic(g.who[0]);
      h=`<span class="hk">${isUpcoming(g)?'عمل قادم · '+esc(upTxt(g)):g.seen?'شاهدته':'عمل'}</span><h1 dir="auto">${esc(g.t)}</h1><p class="pp-m">${esc([g.who.map(x=>x.name).join('، '),g.s,g.d?fmtWd(g.d):g.y,g.du?fmtDur(g.du):''].filter(Boolean).join(' · '))}</p>${g.r?`<div class="pp-r">${stars(g.r)}</div>`:''}${g.ds?`<p class="pp-n">${esc(g.ds)}</p>`:''}`; } }
    else if(t&&t.dataset.rec!=null){ const c=(_recCache.list||[])[+t.dataset.rec]; if(c){ bg=c.img; h=`<span class="hk">اقتراح · توافق ${c.matchPct||'?'}٪</span><h1>${esc(c.name)}</h1><p class="pp-n">${esc((c.reasons||[]).slice(0,2).join(' · '))}</p>`; } }
    else { const i=t&&t.dataset.p?P(t.dataset.p):spot(); if(i){ bg=pic(i); const a=ageOf(i), n=(i.works||[]).length, s=(i.works||[]).filter(w=>w.w).length;
      h=`<span class="hk">${t?'':'مختارة اليوم'}${i.tier?' المستوى '+esc(i.tier):''}</span><h1>${esc(i.name)}</h1><div class="pp-r">${i.rating?stars(i.rating)+`<b>${(+i.rating).toFixed(1)}</b>`:''}</div>
        <p class="pp-m">${esc([i.country,a!=null?a+' سنة':'',n?n+' عمل'+(s?' · شاهدت '+s:''):'',(i.photos||[]).length?(i.photos||[]).length+' صورة':''].filter(Boolean).join(' · '))}</p>${i.notes?`<p class="pp-n">${esc(i.notes)}</p>`:(i.tags||[]).length?`<div class="pp-c">${i.tags.slice(0,5).map(x=>`<span class="pc">#${esc(x)}</span>`).join('')}</div>`:''}`; } }
    el.innerHTML=h; setBg(bg); }
  const spot=()=>{ const pool=items.filter(i=>pic(i)&&(i.fav||(i.rating||0)>=4)); const s=pool.length?pool:items.filter(i=>pic(i)); return s.length?s[hhash(todayStr())%s.length]:items[0]; };

  // ---------------- المفاتيح ----------------
  let lastKey=0, repeating=false, lpT=0, lpEl=null, lpFired=false;
  const quickable=t=>!!(t&&(t.dataset.p||t.dataset.cp||t.dataset.w||t.dataset.rec!=null)&&t.classList.contains('tvc'));
  function onKey(e){ if(!on) return; const k=e.key, t=e.target, typing=t&&(t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&!/^(checkbox|radio|button|submit|range|color|file)$/.test(t.type)));
    const isBack=k==='Escape'||k==='GoBack'||k==='BrowserBack'||(k==='Backspace'&&!typing);
    // الاستديو مفتوح فوق واجهة الشاشة: الرجوع والأسهم له
    if(typeof Studio!=='undefined'&&Studio.isOpen()&&!document.querySelector('#ovAsk.show')){
      if(Gallery.isOpen()){ if(isBack){ e.preventDefault(); e.stopImmediatePropagation(); Gallery.close(); } return; }
      if(isBack){ e.preventDefault(); e.stopImmediatePropagation(); if(!Studio.tvBack()) setTimeout(()=>{ const n=document.querySelector('#tv [data-go="studio"]'); if(n) try{ n.focus(); }catch{} },60); return; }
      if(/^Arrow/.test(k)&&!typing){ e.preventDefault(); e.stopImmediatePropagation(); Studio.move(k); return; }
      return; }
    if(k==='Escape'||k==='GoBack'||k==='BrowserBack'||(k==='Backspace'&&!typing)){ e.preventDefault(); e.stopImmediatePropagation(); back().then(r=>{ if(!r&&IS_NATIVE){ try{ NATIVE.App.minimizeApp(); }catch{} } }); return; }
    if(/^Arrow/.test(k)){ if(typing&&(k==='ArrowLeft'||k==='ArrowRight')) return;
      e.preventDefault(); e.stopImmediatePropagation(); if(lpEl){ clearTimeout(lpT); lpEl=null; }
      const now=performance.now(); if(e.repeat){ if(!repeating){ repeating=true; root.classList.add('fast'); } if(now-lastKey<95) return; } lastKey=now;
      move(k); return; }
    if((k==='ContextMenu'||k==='Menu'||(k==='m'&&!typing))&&activeLayer()===root){ const a=document.activeElement; if(quickable(a)){ e.preventDefault(); quickLayer(a); } return; }
    // OK: ضغطة قصيرة = فتح، مطوّلة = خيارات سريعة
    if((k==='Enter'||k===' ')&&t&&t.classList&&t.classList.contains('f')&&root.contains(t)&&!typing){ e.preventDefault(); e.stopImmediatePropagation();
      if(e.repeat) return;
      if(k==='Enter'&&quickable(t)&&layerEl.hidden){ clearTimeout(lpT); lpFired=false; lpEl=t; lpT=setTimeout(()=>{ lpFired=true; if(lpEl&&document.activeElement===lpEl) quickLayer(lpEl); },550); return; }
      t.click(); return; }
    if((k==='Enter'||k===' ')&&t&&t.classList&&t.classList.contains('f')&&!/^(BUTTON|INPUT|A)$/.test(t.tagName)){ e.preventDefault(); t.click(); } }
  window.addEventListener('keydown',onKey,true);
  window.addEventListener('keyup',e=>{ if(repeating){ repeating=false; if(root) root.classList.remove('fast'); }
    if(e.key==='Enter'&&lpEl){ clearTimeout(lpT); const el=lpEl; lpEl=null; if(!lpFired&&document.activeElement===el) el.click(); lpFired=false; } },true);
  function applyPrefs(){ document.documentElement.style.setProperty('--tvs',LS.get('vkte_tvs','1')); if(root) root.classList.toggle('noanim',LS.get('vkte_tv_anim','1')==='0'); }

  // ---------------- التحديث الحي ----------------
  let rt=0;
  // لا يُعاد الرسم تحت نافذة مفتوحة أو حوار (كي لا يضيع التركيز)؛ يُؤجَّل حتى تُغلق
  function refresh(now){ if(!on) return; clearTimeout(rt); rt=setTimeout(()=>{ if(!layerEl.hidden||activeLayer()!==root) return refresh(); if(page==='search'){ drawSearchRes(args.q||''); return; } draw(true); },now?50:500); }
  HOOKS.saved.push(()=>{ ixP=null; refresh(); }); HOOKS.deleted.push(()=>{ ixP=null; refresh(); }); HOOKS.meta.push(()=>refresh());

  function start(){ if(on) return; on=true; build(); applyPrefs(); document.documentElement.classList.add('tvapp'); root.hidden=false; root.classList.toggle('blur',document.body.classList.contains('blur'));
    closeOv('ovHome'); page='home'; args={}; stack=[]; draw(false);
    if(window.Sync) Sync.startTV().then(s=>{ if(s.running&&!items.length) setTimeout(()=>go('sync',{},false),400); }); }
  function stop(){ if(!on) return; on=false; document.documentElement.classList.remove('tvapp'); if(root) root.hidden=true; }
  return {start,stop,refresh,back,go,get on(){ return on; },get page(){ return page; },get args(){ return args; },move};
})();
window.TVApp=TVApp;
// بعد تحميل البيانات أعد الرسم، وابدأ إن كان وضع التلفاز مفعّلًا
(function(){ const _r=render; let first=true; render=function(){ const r=_r.apply(this,arguments); if(TVApp.on&&first){ first=false; TVApp.refresh(true); } return r; };
  // واجهة الجوال المخفية لا تُرسم بطاقاتها أثناء واجهة الشاشة (توفير للمعالج والذاكرة)
  const _rm=renderMore; renderMore=function(){ if(TVApp.on) return; return _rm.apply(this,arguments); };
  // يبدأ بعد تحميل كل الوحدات (وحدة المزامنة تُعرَّف بعد هذه)
  setTimeout(()=>{ if(document.documentElement.classList.contains('tv')) TVApp.start(); },0); })();

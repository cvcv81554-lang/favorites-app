/* ===== واجهة الشاشة (Android TV) — تطبيق مستقل بالكامل عن واجهة الجوال =====
   - قائمة جانبية + صفحات بملء الشاشة: الرئيسية (لوحة معلومات + أرفف أفقية)، المكتبة، الممثلة، الأعمال، اكتشف، بحث، اتصال بالجوال، الإعدادات.
   - محرّك تركيز خاص: يمين/يسار داخل الرف بالترتيب، أعلى/أسفل بين الأرفف مع تذكّر آخر موضع في كل رف،
     وإظهار العنصر المركَّز دائمًا. زر الرجوع: يغلق النافذة ← يرجع للصفحة السابقة ← للقائمة ← يخرج.
   - التعديل الكامل يتم من الجوال ويصل بالمزامنة؛ الشاشة للتصفح والمشاهدة والتقييم السريع. */
const TVApp=(()=>{
  let on=false, page='home', args={}, stack=[], lastMain=null, root, main, layerEl, nav, bgA, bgB, bgCur=0, heroT=0, pageLim=60;
  const ROWLIM=30;
  const $$=s=>root.querySelector(s);
  const P=id=>items.find(i=>i.id===id);
  const WM=()=>{ const m=new Map(); wAll().forEach(g=>m.set(g.key,g)); return m; };
  const photo=i=>(i&&((i.photos&&i.photos[0])||pic(i)))||'';
  const ageOf=i=>{ const a=age(i.birth); return a!=null&&a>=18?a:null; };
  const starsTxt=r=>r?'★ '+(+r).toFixed(1):'';

  // ---------------- البناء ----------------
  const NAV=[['home','i-home','الرئيسية'],['lib','i-grid','المكتبة'],['works','i-film','الأعمال'],['recs','i-bulb','اكتشف'],['search','i-search','بحث'],['show','i-slides','عرض شرائح'],['sync','i-link','اتصال بالجوال'],['set','i-set','الإعدادات']];
  function build(){ if(root) return; root=document.createElement('div'); root.id='tv';
    root.innerHTML=`<div class="tv-bg"><img alt=""><img alt=""></div><div class="tv-shade"></div>
      <nav class="tv-nav"><div class="tv-logo"><svg class="mark"><use href="#logo"/></svg><b>المفضلة</b></div>${NAV.map(([k,ic,t])=>`<button class="f tv-ni" data-go="${k}" data-k="nav:${k}"><svg class="ic"><use href="#${ic}"/></svg><span>${t}</span></button>`).join('')}</nav>
      <main class="tv-main" id="tvMain"></main><div class="tv-layer" id="tvLayer" hidden></div>`;
    document.body.appendChild(root); main=$$('#tvMain'); layerEl=$$('#tvLayer'); nav=$$('.tv-nav'); [bgA,bgB]=root.querySelectorAll('.tv-bg img');
    root.addEventListener('click',onClick); root.addEventListener('focusin',onFocus);
    let qt=0; root.addEventListener('input',e=>{ if(e.target.id==='tvQ'){ clearTimeout(qt); qt=setTimeout(()=>drawSearchRes(e.target.value),250); } }); }

  function setBg(src){ const cur=bgCur?bgB:bgA, nx=bgCur?bgA:bgB; if(!src){ cur.classList.remove('on'); nx.classList.remove('on'); return; }
    if(cur.getAttribute('src')===src&&cur.classList.contains('on')) return;
    nx.onload=()=>{ nx.classList.add('on'); cur.classList.remove('on'); bgCur=1-bgCur; }; nx.onerror=()=>{}; nx.src=src; }

  // ---------------- عناصر ----------------
  const pCard=(i,sub)=>`<button class="f tvc tvp" data-k="p:${esc(i.id)}" data-p="${esc(i.id)}"><span class="ph">${pic(i)?`<img src="${esc(pic(i))}" loading="lazy" decoding="async" alt="">`:'<i>♡</i>'}${i.rating?`<em>${starsTxt(i.rating)}</em>`:''}${i.fav?'<u>★</u>':''}${i.tier?`<s class="t${esc(i.tier)}">${esc(i.tier)}</s>`:''}</span><b>${esc(i.name)}</b><small>${sub!=null?sub:esc(i.country||'')||'&nbsp;'}</small></button>`;
  const wCard=(g,sub)=>{ const up=isUpcoming(g)?(()=>{ const d=daysUntil(g.d); return d===0?'اليوم':d===1?'غدًا':d>1?'بعد '+d+' يوم':'قريبًا'; })():'';
    return `<button class="f tvc tvw ${g.seen?'seen':''}" data-k="w:${esc(g.key)}" data-w="${esc(g.key)}"><span class="ph">${wCoverHtml(g)}${up?`<em class="up">${esc(up)}</em>`:g.r?`<em>★ ${g.r}</em>`:''}${g.seen?'<u class="ok">✓</u>':g.q?'<u>🔖</u>':''}</span><b dir="auto">${esc(g.t)}</b><small>${sub!=null?sub:esc(g.who.map(x=>x.name).join('، '))}</small></button>`; };
  const more=(go,t)=>`<button class="f tvc tvmore" data-k="more:${go}" data-go="${go}"><span class="ph"><i>${icon('chev')}</i></span><b>${t||'عرض الكل'}</b><small>&nbsp;</small></button>`;
  const row=(id,title,cards,go,cls)=>cards.length?`<section class="tv-sec" data-row="${id}"><h3>${title}</h3><div class="tv-hs ${cls||''}">${cards.join('')}${go?more(go):''}</div></section>`:'';
  const btn=(k,label,attrs,cls)=>`<button class="f tb ${cls||''}" data-k="b:${k}" ${attrs||''}>${label}</button>`;

  // ---------------- الصفحات ----------------
  function home(){ const all=wAll(), by=new Map(items.map(i=>[i.id,i]));
    if(!items.length) return `<div class="tv-empty"><svg class="mark"><use href="#logo"/></svg><h1>مكتبتك فارغة</h1><p>اربط جوالك لإرسال مكتبتك إلى الشاشة. كل ما تضيفه أو تعدّله في الجوال يصل هنا تلقائيًا.</p><div class="tv-acts">${btn('gosync','📲 اتصال بالجوال','data-go="sync"','pri')}</div></div>`;
    const recent=(()=>{ try{ return (JSON.parse(LS.get('vkte_recent','[]'))||[]).map(id=>by.get(id)).filter(Boolean); }catch{ return []; } })();
    const favs=items.filter(i=>i.fav).sort((a,b)=>(b.rating||0)-(a.rating||0));
    const top=items.filter(i=>i.rating>0).sort((a,b)=>b.rating-a.rating||(b.elo||0)-(a.elo||0));
    const tierS=items.filter(i=>i.tier==='S'||i.tier==='A').sort((a,b)=>(a.tier>b.tier?1:-1)||(b.rating||0)-(a.rating||0));
    const fresh=items.slice().sort((a,b)=>(b.added||0)-(a.added||0));
    const bd=items.map(i=>[i,Home.nextBday(i)]).filter(x=>x[1]&&x[1].days<=30).sort((a,b)=>a[1].days-b[1].days);
    const upc=wApply(all,'upcoming'), wl=wApply(all,'watchlist'), unseen=all.filter(g=>!g.seen&&!isUpcoming(g)&&g.d).sort((a,b)=>b.d.localeCompare(a.d));
    const recs=(_recCache.list||[]).slice(0,ROWLIM);
    return `<div class="tv-hero" id="tvHero"></div><div class="tv-rows tv-scroll">
      ${row('recent','تابعت مؤخرًا',recent.slice(0,ROWLIM).map(i=>pCard(i)))}
      ${row('fav','المفضلات',favs.slice(0,ROWLIM).map(i=>pCard(i)),'lib:fav')}
      ${row('upc','أعمال قادمة',upc.slice(0,ROWLIM).map(g=>wCard(g)),'works:upcoming','wide')}
      ${row('wl','قائمة المشاهدة',wl.slice(0,ROWLIM).map(g=>wCard(g)),'works:watchlist','wide')}
      ${row('new','صدر حديثًا ولم تشاهده',unseen.slice(0,ROWLIM).map(g=>wCard(g,fmtWd(g.d))),'works:unseen','wide')}
      ${row('top','الأعلى تقييمًا',top.slice(0,ROWLIM).map(i=>pCard(i)),'lib:rating')}
      ${row('tier','المستوى S و A',tierS.slice(0,ROWLIM).map(i=>pCard(i)))}
      ${row('recs','مقترحات تناسب ذوقك',recs.map((c,n)=>recCard(c,n)),'recs')}
      ${row('bday','أعياد ميلاد قريبة',bd.map(([i,n])=>pCard(i,n.days===0?'اليوم 🎂':n.days===1?'غدًا 🎂':'بعد '+n.days+' يوم · '+n.turns)))}
      ${row('added','أضيفت حديثًا',fresh.slice(0,ROWLIM).map(i=>pCard(i,fmtDate(i.added||i.updated))),'lib:added')}
      ${row('all','كل الممثلات',items.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar')).slice(0,ROWLIM).map(i=>pCard(i)),'lib')}
      <div class="tv-pad"></div></div>`; }

  const LF={all:['الكل',()=>true],fav:['المفضلة',i=>i.fav],S:['المستوى S',i=>i.tier==='S'],A:['المستوى A',i=>i.tier==='A'],unrated:['بلا تقييم',i=>!(i.rating>0)],upc:['لها أعمال قادمة',i=>(i.works||[]).some(isUpcoming)]};
  const LS_SORT={rating:['الأعلى تقييمًا',(a,b)=>(b.rating||0)-(a.rating||0)],name:['الاسم',(a,b)=>a.name.localeCompare(b.name,'ar')],added:['الأحدث إضافة',(a,b)=>(b.added||0)-(a.added||0)],works:['الأكثر أعمالًا',(a,b)=>(b.works||[]).length-(a.works||[]).length],elo:['ترتيب المواجهات',(a,b)=>(b.elo||1000)-(a.elo||1000)]};
  function libList(){ const f=args.f||'all', s=args.s||'rating'; let l=items.slice();
    if(f.startsWith('L:')) l=l.filter(i=>(i.lists||[]).includes(f.slice(2))); else if(f.startsWith('T:')) l=l.filter(i=>(i.tags||[]).includes(f.slice(2))); else if(LF[f]) l=l.filter(LF[f][1]);
    return l.sort((LS_SORT[s]||LS_SORT.rating)[1]); }
  function lib(){ const f=args.f||'all', s=args.s||'rating', l=libList();
    const tags=topN(items.flatMap(i=>i.tags||[]),10).map(x=>x[0]);
    const chips=[...Object.entries(LF).map(([k,[t]])=>[k,t]),...lists.map(L=>['L:'+L.id,'📂 '+L.name]),...tags.map(t=>['T:'+t,'#'+t])];
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>المكتبة</h1><span>${l.length} ممثلة</span></header>
      <section class="tv-sec" data-row="lf"><div class="tv-hs chips">${chips.map(([k,t])=>btn('lf:'+k,esc(t),`data-lf="${esc(k)}"`,'chip'+(k===f?' on':''))).join('')}</div></section>
      <section class="tv-sec" data-row="ls"><div class="tv-hs chips">${Object.entries(LS_SORT).map(([k,[t]])=>btn('ls:'+k,'↕ '+t,`data-ls="${k}"`,'chip sm'+(k===s?' on':''))).join('')}</div></section>
      <div class="tv-grid">${l.slice(0,pageLim).map(i=>pCard(i)).join('')||'<p class="tv-note">لا ممثلات هنا</p>'}</div><div class="tv-pad"></div></div>`; }

  function person(){ const i=P(args.id); if(!i){ setTimeout(()=>go('home'),0); return ''; }
    const a=ageOf(i), ws=(i.works||[]).map((w,k)=>({it:i,w,k})), WMm=WM();
    const groups=wApply(ws,'all').map(x=>WMm.get(wKeyOf(x.w))).filter(Boolean);
    const unseenFirst=[...groups.filter(g=>!g.seen&&!isUpcoming(g)),...groups.filter(g=>isUpcoming(g)),...groups.filter(g=>g.seen)];
    const rk=Duel.rankOf(i), nb=Home.nextBday(i);
    const meta=[i.country,a!=null?a+' سنة':'',i.height?i.height+' سم':'',ws.length?ws.length+' عمل':'',(i.photos||[]).length?(i.photos||[]).length+' صورة':''].filter(Boolean);
    const chips=[i.tier?`<span class="pc t${esc(i.tier)}">المستوى ${esc(i.tier)}</span>`:'',rk?`<span class="pc">⚔️ #${rk}</span>`:'',nb&&nb.days<=30?`<span class="pc">🎂 ${nb.days===0?'اليوم':'بعد '+nb.days+' يوم'}</span>`:'',...(i.tags||[]).slice(0,5).map(t=>`<span class="pc">#${esc(t)}</span>`)].filter(Boolean).join('');
    const sim=similar(i);
    return `<div class="tv-page tv-scroll pp">
      <section class="pp-head" data-row="pa"><div class="pp-ph">${photo(i)?`<img src="${esc(photo(i))}" decoding="async" alt="">`:'<i>♡</i>'}</div>
        <div class="pp-info"><h1>${esc(i.name)}</h1>${i.aliases?`<p class="pp-al">${esc(i.aliases)}</p>`:''}
          <div class="pp-r">${i.rating?stars(i.rating)+`<b>${(+i.rating).toFixed(1)}</b>`:'<span class="tv-note">لم تقيّمها بعد</span>'}</div>
          <p class="pp-m">${esc(meta.join(' · '))}</p>${chips?`<div class="pp-c">${chips}</div>`:''}
          ${i.notes?`<p class="pp-n">${esc(i.notes)}</p>`:''}
          <div class="tv-acts">${(i.photos||[]).length?btn('show','▶ عرض الشرائح','data-act="show"','pri'):''}${btn('fav',i.fav?'★ في المفضلة':'☆ أضف للمفضلة','data-act="fav"',i.fav?'on':'')}${btn('rate','تقييم','data-act="rate"')}${unseenFirst.length?btn('works','الأعمال ('+unseenFirst.length+')','data-act="works"'):''}</div></div></section>
      ${(i.photos||[]).length>1?row('ph','الصور',(i.photos||[]).map((p,n)=>`<button class="f tvc tvphoto" data-k="ph:${n}" data-ph="${n}"><span class="ph"><img src="${esc(p)}" loading="lazy" decoding="async" alt=""></span></button>`)):''}
      ${row('pw','الأعمال',unseenFirst.slice(0,60).map(g=>wCard(g,esc([g.s,g.d?fmtWd(g.d):g.y].filter(Boolean).join(' · ')))),'','wide')}
      ${row('ps','مشابهات في مكتبتك',sim.map(x=>pCard(x)))}<div class="tv-pad"></div></div>`; }
  function similar(it){ const tg=new Set(it.tags||[]), a=age(it.birth);
    return items.filter(x=>x!==it).map(x=>{ let s=0; (x.tags||[]).forEach(t=>{ if(tg.has(t)) s+=1.2; }); if(it.country&&x.country===it.country) s+=1.5; const b=age(x.birth); if(a!=null&&b!=null&&Math.abs(a-b)<=3) s+=1; if(it.tier&&x.tier===it.tier) s+=.8; if(x.fav) s+=.2; return [x,s]; })
      .filter(x=>x[1]>=1.5).sort((p,q)=>q[1]-p[1]).slice(0,20).map(x=>x[0]); }

  const WT=[['recent','الأحدث'],['upcoming','القادمة'],['watchlist','للمشاهدة'],['unseen','لم أشاهدها'],['top','الأعلى تقييمًا'],['seen','شاهدتها']];
  function works(){ const t=args.t||'recent', all=wAll(); const l=t==='top'?wApply(all,'top'):wApply(all,t);
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>الأعمال</h1><span>${all.length} عمل · شاهدت ${all.filter(g=>g.seen).length}</span></header>
      <section class="tv-sec" data-row="wt"><div class="tv-hs chips">${WT.map(([k,n])=>btn('wt:'+k,n+` <small>${(k==='top'?wApply(all,'top'):wApply(all,k)).length}</small>`,`data-wt="${k}"`,'chip'+(k===t?' on':''))).join('')}${btn('radar','⟳ تحديث من المصادر','data-act="radar"','chip')}${btn('rnd','🎲 اختر لي','data-act="rndw"','chip')}</div></section>
      <div class="tv-grid wide">${l.slice(0,pageLim).map(g=>wCard(g)).join('')||'<p class="tv-note">لا أعمال هنا</p>'}</div><div class="tv-pad"></div></div>`; }

  const recCard=(c,n)=>`<button class="f tvc tvp" data-k="r:${esc(c.k||norm(c.name))}" data-rec="${n}"><span class="ph">${c.img?`<img src="${esc(c.img)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="this.remove()" alt="">`:'<i>♡</i>'}<em>${c.matchPct||''}٪</em></span><b>${esc(c.name)}</b><small>${esc([c.cc?ctryName(c.cc):c.country,candAge(c)?candAge(c)+' سنة':''].filter(Boolean).join(' · '))}</small></button>`;
  function recs(){ const l=(_recCache.list||[]), keys=!!(LS.get('vkte_key')||LS.get('vkte_stash'));
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>اكتشف</h1><span>${l.length?l.length+' اقتراح يناسب ذوقك':''}</span></header>
      <section class="tv-sec" data-row="ra"><div class="tv-hs chips">${keys?btn('rref','⟳ تجديد الاقتراحات','data-act="rref"','chip pri'):''}</div></section>
      ${l.length?`<div class="tv-grid">${l.map(recCard).join('')}</div>`:`<p class="tv-note">${keys?'اضغط «تجديد الاقتراحات» لجلب ممثلات جديدات تناسب ذوقك.':'الاقتراحات تحتاج مفتاح ThePornDB أو StashDB. فعّل «أرسل مفاتيح المصادر للشاشة» من جوالك ← الشاشة والمزامنة.'}</p>`}<div class="tv-pad"></div></div>`; }

  function search(){ return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>بحث</h1></header>
      <section class="tv-sec" data-row="sq"><div class="tv-hs"><input class="f tv-in" id="tvQ" data-k="b:q" placeholder="اكتب اسمًا أو عنوان عمل أو وسمًا…" autocomplete="off" value="${esc(args.q||'')}"></div></section>
      <div id="tvRes"></div><div class="tv-pad"></div></div>`; }
  function drawSearchRes(q){ args.q=q; const el=$$('#tvRes'); if(!el) return; q=norm(q); if(!q){ el.innerHTML='<p class="tv-note">النتائج تظهر أثناء الكتابة.</p>'; return; }
    const ps=items.filter(i=>norm([i.name,i.aliases,i.country,(i.tags||[]).join(' ')].join(' ')).includes(q)).slice(0,40);
    const ws=wAll().filter(g=>norm(g.t+' '+g.s+' '+(g.tg||[]).join(' ')).includes(q)).slice(0,40);
    el.innerHTML=(row('rp','الممثلات ('+ps.length+')',ps.map(i=>pCard(i)))+row('rw','الأعمال ('+ws.length+')',ws.map(g=>wCard(g)),'','wide'))||'<p class="tv-note">لا نتائج</p>'; }

  async function sync(){ const s=await Sync.tvInfo(), last=s.last;
    return `<div class="tv-page tv-scroll sy"><header class="tv-ph"><h1>اتصال بالجوال</h1></header>
      <div class="sy-wrap"><div class="sy-qr">${s.link&&window.QR?window.QR(s.link):'<i>📶</i>'}</div>
        <div class="sy-info">${s.err?`<p class="sy-err">⚠ ${esc(s.err)}</p>`:''}
          <ol><li><b>امسح الرمز</b> بكاميرا الجوال ← يُفتح تطبيق المفضلة ويبدأ الإرسال.</li><li>أو في الجوال: المزيد ← <b>الشاشة</b> ← ربط بشاشة، واكتب:</li></ol>
          <div class="sy-kv"><span>العنوان</span><b dir="ltr">${esc(s.ip||'—')}${s.port&&s.port!==8765?':'+s.port:''}</b></div><div class="sy-kv"><span>الرمز</span><b dir="ltr" class="code">${esc(s.code)}</b></div>
          <p class="tv-note">الجهازان على نفس شبكة Wi-Fi. بعد الربط يصل أي تعديل من الجوال خلال ثوانٍ، وأبقِ التطبيق مفتوحًا على الشاشة.</p>
          <p class="tv-note">${last?'آخر مزامنة: '+esc(fmtDate(last.at))+' '+new Date(last.at).toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'})+(last.sent!=null?' · '+last.sent+' ممثلة، '+(last.photos||0)+' صورة':''):'لم تصل أي مزامنة بعد.'} · في المكتبة الآن ${items.length} ممثلة.</p>
          <div class="tv-acts" data-row="sya">${btn('newcode','رمز جديد','data-act="newcode"')}${btn('impurl','استيراد من رابط','data-act="impurl"')}${btn('impdir','استيراد من مجلد','data-act="impdir"')}</div></div></div></div>`; }

  function settings(){ const th=LS.get('vkte_theme','dark'), sc=LS.get('vkte_tvs','1');
    const opt=(k,t,on)=>btn(k,t,`data-act="${k}"`,'chip'+(on?' on':''));
    return `<div class="tv-page tv-scroll"><header class="tv-ph"><h1>الإعدادات</h1></header>
      <section class="tv-sec" data-row="s1"><h3>حجم الواجهة</h3><div class="tv-hs chips">${[['0.85','صغير'],['1','متوسط'],['1.15','كبير']].map(([v,t])=>btn('sc:'+v,t,`data-sc="${v}"`,'chip'+(sc===v?' on':''))).join('')}</div></section>
      <section class="tv-sec" data-row="s2"><h3>المظهر</h3><div class="tv-hs chips">${[['dark','داكن بنفسجي'],['amoled','أسود AMOLED']].map(([v,t])=>btn('th:'+v,t,`data-th="${v}"`,'chip'+(th===v?' on':''))).join('')}</div></section>
      <section class="tv-sec" data-row="s3"><h3>الخصوصية</h3><div class="tv-hs chips">${opt('blur','تمويه الصور',document.body.classList.contains('blur'))}${Lock.has()?opt('lock','قفل الآن',false):''}</div></section>
      <section class="tv-sec" data-row="s4"><h3>الأعمال</h3><div class="tv-hs chips">${opt('radar','تحديث الأعمال من المصادر',false)}</div></section>
      <section class="tv-sec" data-row="s5"><h3>الواجهة</h3><div class="tv-hs chips">${opt('mobile','التبديل إلى واجهة الجوال',false)}</div></section>
      <p class="tv-note">لتعديل الممثلات وإضافتها استخدم الجوال؛ التغييرات تصل الشاشة بالمزامنة. · <span dir="ltr">Favorites TV</span></p><div class="tv-pad"></div></div>`; }

  // ---------------- التنقل بين الصفحات ----------------
  const PAGES={home,lib,person,works,recs,search,sync,settings};
  const focusKey=()=>{ const a=document.activeElement; return a&&root.contains(a)&&a.dataset.k||''; };
  const scrolls=()=>[...main.querySelectorAll('.tv-scroll,.tv-hs')].map(e=>[e.scrollTop,e.scrollLeft]);
  async function draw(keep){ const fk=keep?focusKey():'', sc=keep?scrolls():null;
    root.dataset.page=page; let h=PAGES[page]||home; const html=await h(); main.innerHTML=html;
    nav.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('cur',b.dataset.go===page||(page==='person'&&b.dataset.go==='lib')));
    if(page==='search') drawSearchRes(args.q||'');
    if(sc){ main.querySelectorAll('.tv-scroll,.tv-hs').forEach((e,k)=>{ if(sc[k]){ e.scrollTop=sc[k][0]; e.scrollLeft=sc[k][1]; } }); }
    if(page==='person'){ const i=P(args.id); setBg(i?photo(i):''); } else if(page!=='home') setBg('');
    if(page==='home') hero(null);
    if(keep&&fk){ const el=main.querySelector(`[data-k="${CSS.escape(fk)}"]`)||nav.querySelector(`[data-k="${CSS.escape(fk)}"]`); if(el){ focusEl(el,true); return; } }
    if(keep&&nav.contains(document.activeElement)) return;
    focusEl(firstMain()||nav.querySelector('.cur'),false); }
  const firstMain=()=>{ if(args.fk){ const e=main.querySelector(`[data-k="${CSS.escape(args.fk)}"]`); if(e) return e; } return main.querySelector('.tv-grid .f,.tv-rows .f,.pp-head .tb,.f'); };
  function go(p,a,push){ if(push!==false&&page!==p||push===true) stack.push({page,args:{...args,fk:focusKey()},sc:scrolls()}); if(stack.length>20) stack.shift();
    page=p; args=a||{}; pageLim=60; closeLayer(); return draw(false); }
  async function back(){
    if(typeof Gallery!=='undefined'&&Gallery.isOpen()){ Gallery.close(); return true; }
    if($('lock').classList.contains('show')) return true;
    if(ask.cancel){ ask.cancel(); return true; }
    const ov=[...document.querySelectorAll('.overlay.show:not(.page)')].pop(); if(ov){ ov.classList.remove('show'); return true; }
    if(!layerEl.hidden){ closeLayer(); return true; }
    if(stack.length){ const s=stack.pop(); page=s.page; args=s.args; await draw(false); if(s.sc) main.querySelectorAll('.tv-scroll,.tv-hs').forEach((e,k)=>{ if(s.sc[k]){ e.scrollTop=s.sc[k][0]; e.scrollLeft=s.sc[k][1]; } }); const e=firstMain(); if(e) focusEl(e,true); return true; }
    if(page!=='home'){ go('home',{},false); return true; }
    if(!nav.contains(document.activeElement)){ focusEl(nav.querySelector('.cur')||nav.querySelector('.f'),false); return true; }
    return false; }

  // ---------------- النافذة (تفاصيل عمل / اقتراح / تقييم) ----------------
  let layerRet=null;
  function openLayer(html){ if(!layerEl.contains(document.activeElement)) layerRet=document.activeElement; layerEl.innerHTML=`<div class="tv-panel">${html}</div>`; layerEl.hidden=false; root.classList.add('layered'); const f=layerEl.querySelector('.f.pri,.f'); if(f) focusEl(f,false); }
  function closeLayer(){ if(layerEl.hidden) return; layerEl.hidden=true; layerEl.innerHTML=''; root.classList.remove('layered'); if(layerRet&&document.contains(layerRet)) focusEl(layerRet,true); layerRet=null; }
  let curWork='';
  function workLayer(key){ const g=wAll().find(x=>x.key===key); if(!g) return; curWork=key;
    openLayer(`<div class="wl"><div class="wl-ph">${wCoverHtml(g)}</div><div class="wl-b"><h2 dir="auto">${esc(g.t)}</h2>
      <p class="pp-m">${esc([g.s,g.d?fmtWd(g.d):g.y,g.du?fmtDur(g.du):''].filter(Boolean).join(' · '))}${isUpcoming(g)?' · <b>قادم</b>':''}${g.seen&&g.wd?' · شاهدته '+esc(fmtWd(g.wd)):''}</p>
      ${g.ds?`<p class="pp-n">${esc(g.ds)}</p>`:''}${(g.tg||[]).length?`<div class="pp-c">${g.tg.slice(0,8).map(t=>`<span class="pc">#${esc(t)}</span>`).join('')}</div>`:''}
      <div class="tv-acts" data-row="wa">${btn('seen',g.seen?'✓ شاهدته':'👁 تعليم كمشاهَد','data-wa="seen"',g.seen?'on':'pri')}${btn('q',g.q?'🔖 في قائمة المشاهدة':'🔖 للمشاهدة لاحقًا','data-wa="q"',g.q?'on':'')}${btn('rec',g.rec?'👍 أنصح به':'👍 أنصح به','data-wa="rec"',g.rec?'on':'')}</div>
      <div class="tv-acts tv-stars" data-row="wr">${[1,2,3,4,5].map(n=>btn('wr'+n,'★',`data-wr="${n}"`,'star'+(n<=(g.r||0)?' on':''))).join('')}${g.r?btn('wr0','مسح','data-wr="0"','chip sm'):''}</div>
      <div class="tv-acts" data-row="wp">${g.who.map(i=>btn('wp:'+i.id,esc(i.name),`data-p="${esc(i.id)}"`,'chip')).join('')}</div></div></div>`); }
  function wAct(key,k,v){ wMut(key,w=>{ if(k==='seen'){ if(w.w) delete w.w; else { w.w=1; delete w.upc; if(!w.wd) w.wd=todayStr(); } } else if(k==='q'){ if(w.q) delete w.q; else w.q=1; } else if(k==='rec'){ if(w.rec) delete w.rec; else w.rec=1; } else if(k==='r'){ if(v) w.r=v; else delete w.r; } });
    const fk=focusKey(); workLayer(key); const e=layerEl.querySelector(`[data-k="${CSS.escape(fk)}"]`); if(e) focusEl(e,false); refresh(); }
  function rateLayer(id){ const i=P(id); if(!i) return;
    openLayer(`<h2>تقييم ${esc(i.name)}</h2><div class="tv-acts tv-stars big" data-row="rr">${[1,2,3,4,5].map(n=>btn('pr'+n,'★',`data-pr="${n}"`,'star'+(n<=Math.round(i.rating||0)?' on':''))).join('')}</div>
      <h3>المستوى</h3><div class="tv-acts" data-row="rt">${['S','A','B','C','D'].map(t=>btn('pt'+t,t,`data-pt="${t}"`,'chip tier t'+t+(i.tier===t?' on':''))).join('')}${i.tier?btn('pt0','بلا','data-pt=""','chip'):''}</div>`); }
  function recLayer(n){ const c=(_recCache.list||[])[n]; if(!c) return;
    openLayer(`<div class="wl"><div class="wl-ph tall">${c.img?`<img class="wcv-im" src="${esc(c.img)}" referrerpolicy="no-referrer" alt="">`:'<i>♡</i>'}</div><div class="wl-b"><h2>${esc(c.name)}</h2>
      <p class="pp-m">توافق ${c.matchPct||'?'}٪ · ${esc([c.cc?ctryName(c.cc):c.country,candAge(c)?candAge(c)+' سنة':'',c.src].filter(Boolean).join(' · '))}</p>
      <div class="pp-n">${(c.reasons||[]).slice(0,4).map(r=>'• '+esc(r)).join('<br>')}</div>
      <div class="tv-acts" data-row="ra2">${btn('radd','★ إضافة لمكتبتي',`data-ra="add" data-n="${n}"`,'pri')}${btn('rlike','👍 أعجبتني',`data-ra="like" data-n="${n}"`)}${btn('rign','✕ ليست ذوقي',`data-ra="ign" data-n="${n}"`)}</div></div></div>`); }

  // ---------------- الأحداث ----------------
  async function onClick(e){ const t=e.target.closest('.f,[data-go]'); if(!t||!root.contains(t)) return; const d=t.dataset;
    if(d.go){ const [p,x]=d.go.split(':'); if(p==='show'){ Gallery.playLibrary(); return; }
      if(p==='lib') return go('lib',{f:x&&LF[x]?x:'all',s:x&&LS_SORT[x]?x:'rating'}); if(p==='works') return go('works',{t:x||'recent'});
      stack=[]; return go(p,{},false); }
    if(d.p){ closeLayer(); return go('person',{id:d.p}); }
    if(d.w) return workLayer(d.w);
    if(d.rec!=null&&!d.ra) return recLayer(+d.rec);
    if(d.ph!=null){ const i=P(args.id); if(i) Gallery.open(i.photos,+d.ph); return; }
    if(d.lf!=null){ args.f=d.lf; pageLim=60; return draw(true); }
    if(d.ls!=null){ args.s=d.ls; pageLim=60; return draw(true); }
    if(d.wt!=null){ args.t=d.wt; pageLim=60; return draw(true); }
    if(d.sc!=null){ LS.set('vkte_tvs',d.sc); applyScale(); return draw(true); }
    if(d.th!=null){ LS.set('vkte_theme',d.th); document.documentElement.dataset.theme=d.th; return draw(true); }
    if(d.wa) return wAct(curWork,d.wa);
    if(d.wr!=null) return wAct(curWork,'r',+d.wr);
    if(d.pr!=null||d.pt!=null){ const i=P(args.id); if(!i) return; if(d.pr!=null){ const n=+d.pr; i.rating=i.rating===n?0:n; } else { if(d.pt) i.tier=d.pt; else delete i.tier; }
      i.updated=Date.now(); await save(i); const fk=focusKey(); rateLayer(i.id); const el=layerEl.querySelector(`[data-k="${CSS.escape(fk)}"]`); if(el) focusEl(el,false); refresh(); return; }
    if(d.ra){ const c=(_recCache.list||[])[+d.n]; if(!c) return; closeLayer(); if(d.ra==='add') await addRecToLibrary(c); else if(d.ra==='like') RecsPlus.like(c); else ignoreRecPerformer(c.name); return draw(true); }
    const a=d.act; if(!a) return;
    const i=P(args.id);
    if(a==='show'&&i) return Gallery.playItem(i.id);
    if(a==='fav'&&i){ i.fav=!i.fav; i.updated=Date.now(); await save(i); return draw(true); }
    if(a==='rate'&&i) return rateLayer(i.id);
    if(a==='works'&&i){ const r=main.querySelector('[data-row="pw"] .f'); if(r) focusEl(r,false); return; }
    if(a==='radar') return wRadar();
    if(a==='rndw'){ const pool=wApply(wAll(),'unseen'); const g=pool[Math.floor(Math.random()*pool.length)]; if(g) workLayer(g.key); else toast('لا أعمال غير مشاهَدة'); return; }
    if(a==='rref'){ busy.show('جارٍ تحليل ذوقك وجلب الاقتراحات…'); try{ await fetchApiRecommendations(true,t=>busy.show(t)); }catch(err){ toast('تعذّر جلب الاقتراحات'); } busy.hide(); return draw(true); }
    if(a==='newcode'){ await Sync.newCode(); return draw(true); }
    if(a==='impurl'){ $('bImpUrl').click(); return; }
    if(a==='impdir'){ $('bImpDir').click(); return; }
    if(a==='blur'){ setBlur(!document.body.classList.contains('blur')); root.classList.toggle('blur',document.body.classList.contains('blur')); return draw(true); }
    if(a==='lock'){ Lock.lockNow(); return; }
    if(a==='mobile'){ if(await askConfirm('التبديل إلى واجهة الجوال؟ يمكنك العودة من الإعدادات ← وضع التلفاز.','تبديل')){ LS.set('vkte_tv','0'); location.reload(); } return; } }

  // ---------------- محرّك التركيز ----------------
  function activeLayer(){ if($('lock').classList.contains('show')) return $('lock');
    if($('ovAsk').classList.contains('show')) return $('ovAsk'); if($('busy').classList.contains('show')) return $('busy');
    const ov=[...document.querySelectorAll('.overlay.show:not(.page)')].pop(); if(ov) return ov;
    if(!layerEl.hidden) return layerEl; return root; }
  const SEL_ANY='button:not([disabled]),a[href],input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea,summary,[tabindex="0"]';
  const shown=el=>{ const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) return false; for(let p=el;p&&p!==document.body;p=p.parentElement){ if(p.hidden) return false; const s=getComputedStyle(p); if(s.display==='none'||s.visibility==='hidden') return false; } return true; };
  function cands(L){ const sel=L===root||L===layerEl?'.f':SEL_ANY; let l=[...L.querySelectorAll(sel)]; if(L===root) l=l.filter(e=>!layerEl.contains(e)); return l.filter(shown); }
  function focusEl(el,still){ if(!el) return; if(!el.matches('button,input,select,textarea,a[href],[tabindex]')) el.tabIndex=-1; try{ el.focus({preventScroll:true}); }catch{} reveal(el); }
  function reveal(el){ const hs=el.closest('.tv-hs'); if(hs){ const r=el.getBoundingClientRect(), s=hs.getBoundingClientRect(), pad=Math.min(s.width*.12,r.width); let dx=0;
      if(r.left<s.left+pad) dx=r.left-(s.left+pad); else if(r.right>s.right-pad) dx=r.right-(s.right-pad); if(dx) hs.scrollBy({left:dx,behavior:fast?'auto':'smooth'}); }
    const sc=el.closest('.tv-scroll,.tv-panel'); if(sc){ const tgt=el.closest('.tv-sec,.pp-head,.tv-ph')||el, r=tgt.getBoundingClientRect(), s=sc.getBoundingClientRect(), top=s.top+s.height*.04, bot=s.bottom-s.height*.06; let dy=0;
      if(r.height>s.height*.9){ const er=el.getBoundingClientRect(); if(er.top<top) dy=er.top-top; else if(er.bottom>bot) dy=er.bottom-bot; }
      else if(r.top<top) dy=r.top-top; else if(r.bottom>bot) dy=r.bottom-bot;
      if(dy) sc.scrollBy({top:dy,behavior:fast?'auto':'smooth'}); }
    else if(el.closest('.overlay,#ovAsk')) try{ el.scrollIntoView({block:'nearest'}); }catch{} }
  let fast=false;
  function pick(cur,dir,list){ const c=cur.getBoundingClientRect(), cx=c.left+c.width/2, cy=c.top+c.height/2; let best=null,bs=1e18;
    for(const el of list){ if(el===cur) continue; const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, dx=x-cx, dy=y-cy; let main_,perp,over;
      if(dir==='ArrowRight'){ if(r.left<c.right-c.width*.5&&dx<=4) continue; main_=Math.max(0,r.left-c.right)+Math.abs(dx)*.1; perp=Math.abs(dy); over=r.bottom>c.top+4&&r.top<c.bottom-4; }
      else if(dir==='ArrowLeft'){ if(r.right>c.left+c.width*.5&&dx>=-4) continue; main_=Math.max(0,c.left-r.right)+Math.abs(dx)*.1; perp=Math.abs(dy); over=r.bottom>c.top+4&&r.top<c.bottom-4; }
      else if(dir==='ArrowDown'){ if(r.top<c.bottom-c.height*.5&&dy<=4) continue; main_=Math.max(0,r.top-c.bottom)+Math.abs(dy)*.1; perp=Math.abs(dx); over=r.right>c.left&&r.left<c.right; }
      else { if(r.bottom>c.top+c.height*.5&&dy>=-4) continue; main_=Math.max(0,c.top-r.bottom)+Math.abs(dy)*.1; perp=Math.abs(dx); over=r.right>c.left&&r.left<c.right; }
      const s=main_*2+perp*(over?.6:2.5)+(over?0:800); if(s<bs){ bs=s; best=el; } }
    return best; }
  function move(dir,e){ const L=activeLayer(); let cur=document.activeElement;
    if(!cur||cur===document.body||!L.contains(cur)||!shown(cur)){ const f=(L===root?(lastMain&&document.contains(lastMain)&&shown(lastMain)?lastMain:firstMain()):null)||cands(L)[0]; if(f) focusEl(f,false); return; }
    // داخل الرف: يمين/يسار بالترتيب (العربية من اليمين لليسار)
    const hs=cur.closest('.tv-hs');
    if(hs&&(dir==='ArrowLeft'||dir==='ArrowRight')&&L.contains(hs)){ const its=[...hs.querySelectorAll('.f')].filter(shown), i=its.indexOf(cur), rtl=getComputedStyle(hs).direction==='rtl';
      const nx=its[i+((dir==='ArrowLeft')===rtl?1:-1)]; if(nx){ focusEl(nx,false); return; }
      if(L===root&&dir==='ArrowRight'){ lastMain=cur; focusEl(nav.querySelector('.cur')||nav.querySelector('.f'),false); } return; }
    // من القائمة الجانبية إلى المحتوى
    if(L===root&&nav.contains(cur)&&dir==='ArrowLeft'){ const t=lastMain&&document.contains(lastMain)&&shown(lastMain)?lastMain:firstMain(); if(t) focusEl(t,false); return; }
    let list=cands(L); if(L===root&&!nav.contains(cur)&&(dir==='ArrowUp'||dir==='ArrowDown')) list=list.filter(x=>!nav.contains(x));
    if(L===root&&nav.contains(cur)) list=list.filter(x=>nav.contains(x));
    let nx=pick(cur,dir,list);
    // الانتقال لرف آخر: ارجع لآخر عنصر كنت عليه في ذلك الرف
    if(nx&&(dir==='ArrowUp'||dir==='ArrowDown')){ const r2=nx.closest('.tv-hs'); if(r2&&r2!==cur.closest('.tv-hs')&&r2._last&&r2.contains(r2._last)&&shown(r2._last)) nx=r2._last; }
    if(nx){ focusEl(nx,false); return; }
    if(L===root&&dir==='ArrowRight'&&!nav.contains(cur)){ lastMain=cur; focusEl(nav.querySelector('.cur')||nav.querySelector('.f'),false); return; }
    // نهاية الشبكة: حمّل المزيد
    if(dir==='ArrowDown'&&L===root&&cur.closest('.tv-grid')&&(page==='lib'||page==='works')){ pageLim+=60; draw(true).then(()=>{ const n=pick(document.activeElement,dir,cands(root).filter(x=>!nav.contains(x))); if(n) focusEl(n,false); }); } }
  function onFocus(e){ const t=e.target; if(!t.classList||!t.classList.contains('f')) return; const hs=t.closest('.tv-hs'); if(hs) hs._last=t; if(!nav.contains(t)&&!layerEl.contains(t)) lastMain=t;
    if(page==='home'&&(t.dataset.p||t.dataset.w||t.dataset.rec!=null)){ clearTimeout(heroT); heroT=setTimeout(()=>hero(t),fast?260:110); }
    if((page==='lib'||page==='works')&&t.closest('.tv-grid')){ const g=t.closest('.tv-grid'), all=g.querySelectorAll('.f'); if([...all].indexOf(t)>all.length-14&&all.length>=pageLim){ pageLim+=60; draw(true); } } }
  function hero(t){ const el=$$('#tvHero'); if(!el) return; let h='', bg='';
    if(t&&t.dataset.w){ const g=wAll().find(x=>x.key===t.dataset.w); if(g){ bg=g.p||photo(g.who[0]);
      h=`<span class="hk">${isUpcoming(g)?'عمل قادم':g.seen?'شاهدته':'عمل'}</span><h1 dir="auto">${esc(g.t)}</h1><p class="pp-m">${esc([g.who.map(x=>x.name).join('، '),g.s,g.d?fmtWd(g.d):g.y,g.du?fmtDur(g.du):''].filter(Boolean).join(' · '))}</p>${g.r?`<div class="pp-r">${stars(g.r)}</div>`:''}${g.ds?`<p class="pp-n">${esc(g.ds)}</p>`:''}`; } }
    else if(t&&t.dataset.rec!=null){ const c=(_recCache.list||[])[+t.dataset.rec]; if(c){ bg=c.img; h=`<span class="hk">اقتراح · توافق ${c.matchPct||'?'}٪</span><h1>${esc(c.name)}</h1><p class="pp-n">${esc((c.reasons||[])[0]||'')}</p>`; } }
    else { const i=t&&t.dataset.p?P(t.dataset.p):spot(); if(i){ bg=photo(i); const a=ageOf(i), n=(i.works||[]).length, s=(i.works||[]).filter(w=>w.w).length;
      h=`<span class="hk">${t?'':'مختارة اليوم'}${i.tier?' المستوى '+esc(i.tier):''}</span><h1>${esc(i.name)}</h1><div class="pp-r">${i.rating?stars(i.rating)+`<b>${(+i.rating).toFixed(1)}</b>`:''}</div>
        <p class="pp-m">${esc([i.country,a!=null?a+' سنة':'',n?n+' عمل'+(s?' · شاهدت '+s:''):'',(i.photos||[]).length?(i.photos||[]).length+' صورة':''].filter(Boolean).join(' · '))}</p>${i.notes?`<p class="pp-n">${esc(i.notes)}</p>`:(i.tags||[]).length?`<div class="pp-c">${i.tags.slice(0,5).map(x=>`<span class="pc">#${esc(x)}</span>`).join('')}</div>`:''}`; } }
    el.innerHTML=h; setBg(bg); }
  const spot=()=>{ const pool=items.filter(i=>pic(i)&&(i.fav||(i.rating||0)>=4)); const s=pool.length?pool:items.filter(i=>pic(i)); return s.length?s[hhash(todayStr())%s.length]:items[0]; };

  let lastKey=0;
  function onKey(e){ if(!on) return; const k=e.key, t=e.target, typing=t&&(t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&!/^(checkbox|radio|button|submit|range|color|file)$/.test(t.type)));
    if(k==='Escape'||k==='GoBack'||k==='BrowserBack'||(k==='Backspace'&&!typing)){ e.preventDefault(); e.stopImmediatePropagation(); back().then(r=>{ if(!r&&IS_NATIVE){ try{ NATIVE.App.minimizeApp(); }catch{} } }); return; }
    if(/^Arrow/.test(k)){ if(typing&&(k==='ArrowLeft'||k==='ArrowRight')) return;
      const now=performance.now(); fast=e.repeat; if(e.repeat&&now-lastKey<85){ e.preventDefault(); e.stopImmediatePropagation(); return; } lastKey=now;
      e.preventDefault(); e.stopImmediatePropagation(); move(k,e); return; }
    if((k==='Enter'||k===' ')&&t&&t.classList&&t.classList.contains('f')&&!/^(BUTTON|INPUT|A)$/.test(t.tagName)){ e.preventDefault(); t.click(); } }
  window.addEventListener('keydown',onKey,true);
  function applyScale(){ document.documentElement.style.setProperty('--tvs',LS.get('vkte_tvs','1')); }

  // ---------------- التحديث الحي ----------------
  let rt=0;
  // لا يُعاد الرسم تحت نافذة مفتوحة أو حوار (كي لا يضيع التركيز)؛ يُؤجَّل حتى تُغلق
  function refresh(now){ if(!on) return; clearTimeout(rt); rt=setTimeout(()=>{ if(!layerEl.hidden||activeLayer()!==root) return refresh(); if(page==='search'){ drawSearchRes(args.q||''); return; } draw(true); },now?50:400); }
  HOOKS.saved.push(()=>refresh()); HOOKS.deleted.push(()=>refresh()); HOOKS.meta.push(()=>refresh());

  function start(){ if(on) return; on=true; build(); applyScale(); document.documentElement.classList.add('tvapp'); root.hidden=false; root.classList.toggle('blur',document.body.classList.contains('blur'));
    closeOv('ovHome'); page='home'; args={}; stack=[]; draw(false);
    if(window.Sync) Sync.startTV().then(s=>{ if(s.running&&!items.length) setTimeout(()=>go('sync',{},false),400); }); }
  function stop(){ if(!on) return; on=false; document.documentElement.classList.remove('tvapp'); if(root) root.hidden=true; }
  return {start,stop,refresh,back,go,get on(){ return on; },get page(){ return page; },move};
})();
window.TVApp=TVApp;
// بعد تحميل البيانات أعد الرسم، وابدأ إن كان وضع التلفاز مفعّلًا
(function(){ const _r=render; let first=true; render=function(){ const r=_r.apply(this,arguments); if(TVApp.on&&first){ first=false; TVApp.refresh(true); } return r; };
  // يبدأ بعد تحميل كل الوحدات (وحدة المزامنة تُعرَّف بعد هذه)
  setTimeout(()=>{ if(document.documentElement.classList.contains('tv')) TVApp.start(); },0); })();

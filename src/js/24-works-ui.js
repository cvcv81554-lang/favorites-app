/* ===== واجهة الأعمال (بطاقات، صفوف، أغلفة) + إصلاح التصفية وجلب التفاصيل =====
   - بطاقة مدمجة (عمودان على الجوال) وصف مدمج بزر واحد؛ التقييم والوسوم والقوائم من نافذة العمل.
   - غلاف لا يظهر فارغًا أبدًا: خلفية باسم الاستوديو، وفوقها البوستر أو صورة الممثلة كاملة فوق نسخة مموّهة.
   - wApply: كانت «لم أشاهدها/اليوميات/للمشاهدة» تقرأ حقلًا غير موجود في الأعمال المجمّعة.
   - wEnrichScene: لا يقبل إلا عملًا يطابق عنوانه (كان يأخذ أول نتيجة بحث ولو كانت لعمل آخر). */

// صف عمل داخل ملف الممثلة {it,w,k} أو عمل مجمّع من مركز الأعمال
wApply=function(arr,mode){
  const g=x=>(x&&x.w&&typeof x.w==='object')?x.w:x;
  const seen=x=>{ const o=g(x); return !!(o.seen||o.w===1||o.w===true); };
  const dd=(a,b)=>wDate(g(b)).localeCompare(wDate(g(a)));
  if(mode==='upcoming') return arr.filter(x=>!seen(x)&&isUpcoming(g(x))).sort((a,b)=>(wDate(g(a))||'9999').localeCompare(wDate(g(b))||'9999'));
  if(mode==='watchlist') return arr.filter(x=>g(x).q&&!seen(x)).sort(dd);
  if(mode==='top') return arr.filter(x=>(g(x).r||0)>0).sort((a,b)=>(g(b).r||0)-(g(a).r||0)||dd(a,b));
  if(mode==='rec') return arr.filter(x=>g(x).rec||g(x).fav).sort((a,b)=>(g(b).r||0)-(g(a).r||0)||dd(a,b));
  if(mode==='unseen') return arr.filter(x=>!seen(x)&&!isUpcoming(g(x))).sort(dd);
  if(mode==='seen') return arr.filter(seen).sort((a,b)=>String(g(b).wd||wDate(g(b))).localeCompare(String(g(a).wd||wDate(g(a)))));
  if(mode==='all') return arr.slice().sort(dd);
  return arr.filter(x=>isRecent(g(x))&&!isUpcoming(g(x))).sort(dd);
};

wCoverHtml=function(g){
  const who=g.who||[], fb=who[0]?pic(who[0]):'', hue=hhash(g.s||g.t||'x')%360;
  const ph=`<span class="wcv-ph">${icon('film')}${g.s?`<b>${esc(g.s)}</b>`:''}</span>`;
  const bg=fb?`<img class="wcv-bg" src="${esc(fb)}" loading="lazy" decoding="async" alt="">`:'';
  let im='';
  if(g.p) im=bg+`<img class="wcv-im ${fb?'':'cv'}" src="${esc(g.p)}" data-fb="${esc(fb)}" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="wImgErr(this)" alt="">`;
  else if(who.length>1){ const ps=who.map(pic).filter(Boolean).slice(0,3); if(ps.length) im=`<span class="wcv-sp">${ps.map(s=>`<img src="${esc(s)}" loading="lazy" decoding="async" alt="">`).join('')}</span>`; }
  else if(fb) im=bg+`<img class="wcv-im" src="${esc(fb)}" loading="lazy" decoding="async" alt="">`;
  return `<span class="wcv ${im?'has':''}" style="--h:${hue}">${ph}${im}</span>`;
};
// فشل تحميل الصورة: جرّب صورة الممثلة البديلة، وإن لم توجد فأظهر خلفية الاستوديو بدل مربع فارغ
wImgErr=function(el){ const fb=el.dataset.fb||'';
  if(fb&&el.getAttribute('src')!==fb){ el.dataset.fb=''; el.src=fb; return; }
  const c=el.closest('.wcv'); if(!c){ el.style.display='none'; return; }
  c.querySelectorAll('img').forEach(i=>i.remove()); c.classList.remove('has'); };
const wUpTxt=g=>{ if(!isUpcoming(g)) return ''; const du=daysUntil(g.d); return du===0?'اليوم':du===1?'غدًا':du>1?`بعد ${du} يوم`:'قريبًا'; };
const wMarks=g=>`${g.r?`<b>★ ${g.r}</b>`:''}${g.q&&!g.seen?'<i>🔖</i>':''}${g.rec?'<i>👍</i>':''}${g.n?'<i>📝</i>':''}`;

wCard=function(g){ const up=wUpTxt(g), isNew=wLastSeen>0&&g.a>wLastSeen&&!g.seen;
  return `<article class="wkc ${g.seen?'seen':''}" data-wkey="${esc(g.key)}" data-wsheet="${esc(g.key)}" tabindex="0" role="button">
    <div class="wkp">${wCoverHtml(g)}<div class="wk-badges"><span>${up?`<i class="wk-b upc">${esc(up)}</i>`:''}${isNew?'<i class="wk-b new">جديد</i>':''}${g.who.length>1?`<i class="wk-b">👥 ${g.who.length}</i>`:''}</span>${g.du?`<i class="wk-b">${g.du} د</i>`:''}</div>${g.seen?'<span class="wk-ok" aria-label="شوهد">✓</span>':''}</div>
    <div class="wk-bodyc"><div class="wk-t" dir="auto">${esc(g.t)}</div><div class="wk-m">${esc(g.who.map(i=>i.name).join('، '))||'&nbsp;'}</div><div class="wk-m">${esc([g.s,g.d?fmtWd(g.d):g.y].filter(Boolean).join(' · '))||'&nbsp;'}</div>
      <div class="wk-foot"><span class="wk-r">${wMarks(g)}</span><button type="button" class="ib sm ${g.seen?'on':''}" data-wact="seen" title="تمت المشاهدة" aria-label="تمت المشاهدة">${icon('eye')}</button></div></div></article>`; };

wRowGroup=function(g){ const up=wUpTxt(g);
  return `<div class="wi wfi ${g.seen?'seen':''}" data-wkey="${esc(g.key)}" data-wsheet="${esc(g.key)}" tabindex="0" role="button">
    <div class="wrow-th">${wCoverHtml(g)}</div>
    <div class="wr-b"><div class="wt" dir="auto">${esc(g.t)}</div><div class="ws">${esc([g.who.map(x=>x.name).join(' و '),g.s].filter(Boolean).join(' · '))||'&nbsp;'}</div>
      <div class="wr-i">${up?`<i class="wk-b upc">${esc(up)}</i>`:''}<span>${esc([g.d?fmtWd(g.d):g.y,g.du?g.du+' د':''].filter(Boolean).join(' · '))}</span>${wMarks(g)}</div></div>
    <button type="button" class="ib sm ${g.seen?'on':''}" data-wact="seen" title="تمت المشاهدة" aria-label="تمت المشاهدة">${icon('eye')}</button></div>`; };

// صف العمل داخل ملف الممثلة: الضغط يفتح نافذة العمل، وزر واحد للمشاهدة
wRowItem=function(x,who){ const {it,w,k}=x, key=wKeyOf(w), up=wUpTxt(w);
  const lead=who?`<span class="av" data-od="${it.id}">${pic(it)?`<img src="${pic(it)}" alt="">`:'♡'}</span>`:badge(w.s);
  return `<div class="wi wfi ${w.w?'seen':''}" data-ik="${it.id}|${k}" data-wkey="${esc(key)}">${lead}
    <div class="wr-b" data-wsheet="${esc(key)}" tabindex="0" role="button"><div class="wt" dir="auto">${esc(w.t)}</div><div class="ws">${esc([who?it.name:'',w.s].filter(Boolean).join(' · '))||'&nbsp;'}</div>
      <div class="wr-i">${up?`<i class="wk-b upc">${esc(up)}</i>`:''}<span>${esc([w.d?fmtWd(w.d):w.y,w.du?w.du+' د':''].filter(Boolean).join(' · '))}</span>${w.r?`<b>★ ${w.r}</b>`:''}${w.q&&!w.w?'<i>🔖</i>':''}${w.rec?'<i>👍</i>':''}${w.n?'<i>📝</i>':''}</div></div>
    <button class="ib sm wtg ${w.w?'on':''}" data-wk="1" title="تمت المشاهدة" aria-label="تمت المشاهدة">${icon('eye')}</button></div>`; };

// جلب تفاصيل عمل واحد: يُقبل فقط ما يطابق العنوان (ويُفضَّل ما يطابق الاستوديو)
wEnrichScene=async function(g){
  const want=wkey(g.t), st=wkey(g.s||''); if(!want) return false;
  const best=(arr,title,studio)=>{ const ex=arr.filter(x=>wkey(title(x))===want); return ex.find(x=>st&&wkey(studio(x)||'')===st)||ex[0]||null; };
  const durOf=d=>+d>0?(+d>180?Math.round(+d/60):Math.round(+d)):0;
  if(LS.get('vkte_key')){ try{
      const rr=await fetch(API()+'/scenes?q='+encodeURIComponent(g.t)+'&per_page=10',{headers:hdr()});
      if(rr.ok){ const j=await rr.json(), sc=best(j.data||[],x=>x.title||x.name||'',siteOf);
        if(sc){ const yd=ydOf(sc.date||sc.release_date||''), dur=durOf(sc.duration), p=posterOf(sc), u=typeof sc.url==='string'&&/^https:\/\//i.test(sc.url)?sc.url:'';
          const tgs=Array.isArray(sc.tags)?sc.tags.map(t=>typeof t==='string'?t:(t&&t.name)||'').filter(Boolean).slice(0,8):[];
          wMut(g.key,w=>{ if(!w.s&&siteOf(sc)) w.s=siteOf(sc); if(!w.d&&yd.d){ w.d=yd.d; w.y=yd.y; } if(!w.p&&p) w.p=p; if(!w.du&&dur) w.du=dur;
            if(!w.ds&&(sc.description||sc.overview)) w.ds=String(sc.description||sc.overview).slice(0,280); if((!w.tg||!w.tg.length)&&tgs.length) w.tg=tgs; if(!w.u&&u) w.u=u; });
          return true; } } }catch{} }
  if(LS.get('vkte_stash')){ try{
      const d=await sdQ('query($t:String!){queryScenes(input:{term:$t,page:1,per_page:10}){scenes{id title release_date date duration details studio{name} images{url width height} tags{name}}}}',{t:g.t});
      const sc=best((d.queryScenes&&d.queryScenes.scenes)||[],x=>x.title||'',x=>x.studio&&x.studio.name);
      if(sc){ const yd=ydOf(sc.release_date||sc.date||''), dur=durOf(sc.duration), tgs=(sc.tags||[]).map(t=>t&&t.name).filter(Boolean).slice(0,8);
        const ims=(sc.images||[]).filter(m=>m&&/^https:\/\//i.test(m.url)).sort((a,b)=>((b.width||0)-(b.height||0))-((a.width||0)-(a.height||0)));
        wMut(g.key,w=>{ if(!w.s&&sc.studio&&sc.studio.name) w.s=sc.studio.name; if(!w.d&&yd.d){ w.d=yd.d; w.y=yd.y; } if(!w.p&&ims[0]) w.p=ims[0].url; if(!w.du&&dur) w.du=dur;
          if(!w.ds&&sc.details) w.ds=String(sc.details).slice(0,280); if((!w.tg||!w.tg.length)&&tgs.length) w.tg=tgs; if(!w.u&&sc.id) w.u='https://stashdb.org/scenes/'+sc.id; });
        return true; } }catch{} }
  return false;
};

// Enter/مسافة على بطاقة أو صف يفتح العمل (لوحة المفاتيح والريموت)
document.addEventListener('keydown',e=>{ if(e.defaultPrevented||(e.key!=='Enter'&&e.key!==' ')) return; const t=e.target; if(!t||!t.matches||!t.matches('[data-wsheet][tabindex]')) return; e.preventDefault(); t.click(); });

// تحميل تلقائي: عند الاقتراب من زر «عرض المزيد» تُحمَّل الدفعة التالية دون ضغط
(function(){ const m=$('mWorks'); let busy=false;
  m.addEventListener('scroll',()=>{ if(busy) return; const b=$('wMoreBtn'); if(!b) return; if(b.getBoundingClientRect().top<innerHeight+500){ busy=true; const top=m.scrollTop; b.click(); m.scrollTop=top; setTimeout(()=>{ busy=false; },150); } },{passive:true}); })();

// إعادة رسم الصفحة تحافظ على العنصر الذي عليه التركيز (بطاقة، زر داخلها، تبويب، شريحة)
(function(){ const _d=drawWorksHub, m=$('mWorks'), KEYS=['wtab','wsub','gotab','wclr','wsite','cday'];
  drawWorksHub=function(){ const a=document.activeElement; let sel='';
    if(a&&a!==document.body&&m.contains(a)&&a.id!=='wSearchIn'){ const c=a.closest('[data-wkey]');
      if(a.id) sel='#'+CSS.escape(a.id);
      else if(c){ sel='[data-wkey="'+CSS.escape(c.dataset.wkey)+'"]'; if(a!==c&&a.dataset.wact) sel+=' [data-wact="'+a.dataset.wact+'"]'; }
      else { const k=KEYS.find(x=>a.dataset[x]!==undefined); if(k) sel='[data-'+k+'="'+CSS.escape(a.dataset[k])+'"]'; } }
    const r=_d.apply(this,arguments);
    if(sel){ let n=null; try{ n=m.querySelector(sel); }catch{} if(n){ if(!/^(BUTTON|INPUT|SELECT|A)$/.test(n.tagName)&&!n.hasAttribute('tabindex')) n.tabIndex=-1; try{ n.focus({preventScroll:true}); }catch{} } }
    return r; }; })();

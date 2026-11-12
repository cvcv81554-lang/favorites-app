/* ===== الثيمات والألوان المميزة ===== */
(function(){
  const root=document.documentElement;
  const BG={dark:'#15101f',amoled:'#000000',light:'#f5f0ec'};
  function apply(){ const th=LS.get('vkte_theme','dark'), ac=LS.get('vkte_accent','copper'); root.dataset.theme=th; root.dataset.accent=ac;
    const m=document.querySelector('meta[name=theme-color]'); if(m) m.content=BG[th]||BG.dark;
    document.querySelectorAll('#thChips [data-th]').forEach(c=>c.classList.toggle('on',c.dataset.th===th));
    document.querySelectorAll('#acChips [data-ac]').forEach(c=>c.classList.toggle('on',c.dataset.ac===ac)); }
  $('thChips').onclick=e=>{ const c=e.target.closest('[data-th]'); if(!c) return; LS.set('vkte_theme',c.dataset.th); apply(); };
  $('acChips').onclick=e=>{ const c=e.target.closest('[data-ac]'); if(!c) return; LS.set('vkte_accent',c.dataset.ac); apply(); };
  apply();
})();

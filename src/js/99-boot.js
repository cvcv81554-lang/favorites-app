/* ===== التشغيل ===== */
(async function(){
  applyView();
  Lock.lockNow();
  try{
    const v=await DB.all(); const mig=v.filter(normItem); items=v;
    // أول تشغيل بعد تثبيت جديد: إن كانت القاعدة فارغة ووُجد مجلد النسخ التلقائي فاسترجعه
    if(!items.length){ try{ const n=await Backup.tryRestore(); if(n) toast('استُعيدت '+n+' ممثلة من النسخة التلقائية ✓'); }catch(e){ console.warn('restore',e); } }
    render(true); if(mig.length) save(mig);
    // ترحيل صور النسخة السابقة (Blob داخل القاعدة) إلى ملفات، على دفعات صغيرة في الخلفية
    if(FST.on&&DB.legacy.length){ const ids=DB.legacy.slice(); (async()=>{ for(const id of ids){ const it=items.find(x=>x.id===id); if(!it) continue; try{ await DB.put([it]); if(!(it.photos||[]).some(p=>PB.map.has(p))&&!PB.map.has(it.thumb)) DB.legacy=DB.legacy.filter(x=>x!==id); }catch{} await new Promise(r=>setTimeout(r,40)); } render(); })(); }
    setTimeout(backfillThumbs,900); setTimeout(()=>Backup.syncAll(false),5000); setTimeout(()=>{ if(!DB.legacy.length) FST.gc(); },60000);
  }catch(e){ console.error(e); $('empty').innerHTML='<b>تعذّر فتح مخزن البيانات</b>أغلق التطبيق وافتحه من جديد. لم يُحذف شيء.'; $('empty').style.display='block'; }
  document.body.classList.add('ready');
})();

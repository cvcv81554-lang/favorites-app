/* ===== التشغيل ===== */
(async function(){
  applyView();
  Lock.lockNow();
  try{
    const v=await DB.all(); const mig=v.filter(normItem); items=v;
    // أول تشغيل بعد تثبيت جديد: إن كانت القاعدة فارغة ووُجد مجلد النسخ التلقائي فاسترجعه
    if(!items.length){ try{ const n=await Backup.tryRestore(); if(n) toast('استُعيدت '+n+' ممثلة من النسخة التلقائية ✓'); }catch(e){ console.warn('restore',e); } }
    render(true); if(mig.length) save(mig);
    setTimeout(backfillThumbs,900); setTimeout(()=>Backup.syncAll(false),5000);
  }catch(e){ console.error(e); $('empty').innerHTML='<b>تعذّر فتح مخزن البيانات</b>أغلق التطبيق وافتحه من جديد. لم يُحذف شيء.'; $('empty').style.display='block'; }
  document.body.classList.add('ready');
})();

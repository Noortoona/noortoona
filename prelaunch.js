(() => {
  const H=window.HALA_BOOKING;
  document.querySelectorAll('[data-lead-form]').forEach(form=>{
    let key=crypto.randomUUID();
    form.addEventListener('submit',async event=>{
      event.preventDefault();const button=form.querySelector('button[type="submit"]'),notice=form.querySelector('[role="status"]'),fields=new FormData(form);
      button.disabled=true;notice.textContent='جاري تسجيل طلبك…';
      try{
        await H.api('/api/leads',{method:'POST',body:JSON.stringify({name:String(fields.get('name')||'').trim(),phone:String(fields.get('phone')||'').trim(),email:String(fields.get('email')||'').trim(),service:String(fields.get('service')||'').trim(),marketingConsent:fields.get('marketingConsent')==='on',kind:form.dataset.leadForm||'launch',idempotencyKey:key,...H.context()})});
        notice.textContent=form.dataset.leadForm==='contact'?'تم استلام طلب التواصل. سيتواصل معك فريق هلا.':'تم تسجيل اهتمامك بالإطلاق. شكرًا لاختيارك هلا!';
        form.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=true);
        button.textContent='تم التسجيل';
      }catch(error){notice.textContent=error.message;button.disabled=false;}
    });
  });
})();

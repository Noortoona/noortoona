(function(){
  const A='/assets/templates/';
  const atlases={activities:A+'atlas-activities-a.webp',social:A+'atlas-social.webp',events:A+'atlas-events.webp',formal:A+'atlas-formal.webp'};
  const cols=['0%','33.333%','66.667%','100%'],rows=['0%','25%','50%','75%','100%'];
  const make=(group,row,names)=>names.map((name,col)=>({name,atlas:atlases[group],position:`${cols[col]} ${rows[row]}`,accent:col===3?'#9a7434':'#e3bd64'}));
  const catalog={
    wedding:make('social',2,['ليلة كحلية','حديقة اللؤلؤ','أقواس ذهبية','مخمل ملكي']),
    engagement:make('social',3,['وعد من ذهب','لؤلؤة الملكة','زمردة','نقاء']),
    graduation:make('events',0,['قبعة النجاح','ثمرة السنين','منصة المجد','بداية']),
    newborn:make('events',1,['قمر صغير','دفء البداية','ليلة زرقاء','زهرة وردية']),
    birthday:make('social',4,['شموع ذهبية','هدية الليل','ورد وفرح','ليلة احتفال']),
    conference:make('events',2,['مسرح الرؤية','مجلس الأعمال','منصة المؤتمر','قاعة النور']),
    opening:make('events',3,['الشريط الذهبي','بوابة الإطلاق','المعرض الأبيض','لحظة الكشف']),
    honoring:make('events',4,['كأس التميز','وسام','منصة التكريم','إطار الإنجاز']),
    formal:make('formal',0,['أعمدة الليل','مائدة رسمية','البوابة الذهبية','خطاب عاجي']),
    national:make('formal',1,['أفق الوطن','راية خضراء','نخيل المجد','ليلة وطن']),
    condolence:make('formal',2,['سكينة','رحمة ونور','زنابق بيضاء','وقار']),
    custom:make('formal',3,['ذهب تجريدي','ظل نباتي','بريق الليل','مخمل عنابي']),
    padel:make('activities',0,['ليلي كلاسيك','ملعب مفتوح','مودرن','نادي بادل']),
    football:make('activities',1,['ليلة الملعب','هدف','خطة اللعب','النادي']),
    camp:make('activities',2,['خيمة النجوم','نار ومسامر','مجلس البر','شروق الصحراء']),
    chalet:make('activities',3,['جلسة النار','ليلة المسبح','المجلس الراقي','حديقة الأصحاب']),
    trip:make('social',0,['طريق القمر','درب الجبل','موعد السفر','طريق الشروق']),
    dinner:make('social',1,['شموع المساء','سطح المدينة','عشاء المجلس','المائدة العاجية']),
    activityCustom:make('activities',4,['لياقة','رحلة بحرية','أمسية ألعاب','سينما البر'])
  };
  const occasions=[
    {key:'wedding',label:'زواج',icon:'♢'},{key:'engagement',label:'ملكة / خطوبة',icon:'♧'},{key:'graduation',label:'تخرج',icon:'⌑'},
    {key:'newborn',label:'مولود',icon:'◌'},{key:'birthday',label:'عيد ميلاد',icon:'♨'},{key:'conference',label:'اجتماع / مؤتمر',icon:'▣'},
    {key:'opening',label:'افتتاح',icon:'✂'},{key:'honoring',label:'تكريم',icon:'♛'},{key:'formal',label:'مناسبة رسمية',icon:'▤'},
    {key:'national',label:'مناسبة وطنية',icon:'♜'},{key:'condolence',label:'عزاء',icon:'❧'},{key:'activity',label:'تجمع ونشاط',icon:'♟'},
    {key:'custom',label:'مناسبة مخصصة',icon:'•••'}
  ];
  const activities=[
    {key:'padel',label:'بادل',icon:'◉'},{key:'football',label:'كرة قدم',icon:'⚽'},{key:'camp',label:'كشتة',icon:'✦'},
    {key:'chalet',label:'استراحة / شاليه',icon:'⌂'},{key:'trip',label:'رحلة',icon:'➤'},{key:'dinner',label:'عشاء',icon:'♨'},
    {key:'activityCustom',label:'نشاط مخصص',icon:'•••'}
  ];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const templateByName=name=>Object.values(catalog).flat().find(t=>t.name===name)||catalog.custom[0];
  const typeLabel=(occasionKey,activityKey)=>occasionKey==='activity'?(activities.find(x=>x.key===activityKey)?.label||'تجمع ونشاط'):(occasions.find(x=>x.key===occasionKey)?.label||'مناسبة خاصة');
  const styleFor=t=>`--invite-art:url('${t.atlas}');--invite-position:${t.position};--invite-accent:${t.accent}`;
  function canvas(data={},opts={}){
    const t=templateByName(data.template),design=data.design||{},activity=data.occasionKey==='activity'||data.occasion==='تجمع ونشاط';
    const fallbackLabel=typeLabel(data.occasionKey||data.occasion_key,data.activityKey||data.activity_key||data.activityType);
    const label=activity?(data.customActivity||data.activityType||data.activity_type||fallbackLabel):(data.customOccasion||data.occasion||fallbackLabel);
    const title=activity?(data.name1||label):[data.name1,data.name2].filter(Boolean).join(' و ');
    const accent=design.accent||t.accent;
    const fonts={ruqaa:'Aref Ruqaa',tajawal:'Tajawal',serif:'Georgia'};
    const custom=design.image?`background-image:url('${String(design.image).replaceAll("'",'%27')}');background-size:cover;background-position:center;`:'';
    return `<article class="invite-canvas" data-layout="${esc(design.layout||'classic')}" style="${styleFor(t)};--invite-accent:${esc(accent)};--invite-font:${fonts[design.font]||'Aref Ruqaa'}">
      <div class="invite-art-layer" ${custom?`style="${custom}"`:''}></div><div class="invite-shade"></div>
      <header class="invite-brand"><b>✦ نورتونا</b><small>NOORTOONA</small></header>
      <div class="invite-copy">
        <span class="invite-type">${esc(label)}</span>
        ${opts.guestName?`<p class="invite-personal">دعوة خاصة إلى <strong>${esc(opts.guestName)}</strong></p>`:''}
        <p class="invite-headline">${esc(design.headline||'يسعدنا حضوركم')}</p>
        <h1>${esc(title||'عنوان المناسبة')}</h1>
        <p class="invite-message">${esc(data.message||'وجودكم يكمل فرحتنا')}</p>
        <i class="invite-rule"></i>
        <div class="invite-meta"><span>▣ <b>${esc(data.date||data.event_date||'أضف التاريخ')}</b></span><span>◷ <b>${esc(String(data.time||data.event_time||'00:00').slice(0,5))}</b></span><span>⌖ <b>${esc(data.location||'أضف الموقع')}</b></span></div>
      </div>
      <div class="invite-actions-demo"><button type="button">سأحضر</button><button type="button">أعتذر</button></div>
    </article>`;
  }
  window.NOORTOONA={catalog,occasions,activities,templateByName,typeLabel,styleFor,canvas,esc};
})();

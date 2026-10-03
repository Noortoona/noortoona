// Hala V6 — invitation-type schema
// Each invitation type owns its fields. Do not infer "person 2" unless the type requires it.
(function(){
  const shared=[
    {key:'date',label:'التاريخ',type:'date',required:true},
    {key:'time',label:'الوقت',type:'time',required:true},
    {key:'location',label:'المكان',type:'text',required:true},
    {key:'city',label:'المدينة',type:'text',required:true},
    {key:'mapsUrl',label:'رابط الموقع',type:'url'},
    {key:'message',label:'نص الدعوة',type:'textarea'}
  ];
  const single=(label='اسم صاحب المناسبة')=>[{key:'name1',label,type:'text',required:true},...shared];
  const schemas={
    wedding:{title:'تفاصيل الزواج',fields:[{key:'name1',label:'اسم العريس',type:'text',required:true},{key:'name2',label:'اسم العروس',type:'text',required:true},...shared]},
    engagement:{title:'تفاصيل الملكة / الخطوبة',fields:[{key:'name1',label:'الاسم الأول',type:'text',required:true},{key:'name2',label:'الاسم الثاني',type:'text',required:true},...shared]},
    graduation:{title:'تفاصيل التخرج',fields:single('اسم الخريج / الخريجة')},
    newborn:{title:'تفاصيل المولود',fields:[{key:'name1',label:'اسم المولود',type:'text',required:true},{key:'hostName',label:'اسم العائلة أو الوالدين',type:'text'},...shared]},
    birthday:{title:'تفاصيل عيد الميلاد',fields:single('اسم صاحب عيد الميلاد')},
    conference:{title:'تفاصيل الاجتماع / المؤتمر',fields:[{key:'name1',label:'اسم الاجتماع أو المؤتمر',type:'text',required:true},{key:'hostName',label:'الجهة المنظمة',type:'text'},...shared]},
    opening:{title:'تفاصيل الافتتاح',fields:[{key:'name1',label:'اسم الافتتاح أو المشروع',type:'text',required:true},{key:'hostName',label:'الجهة الداعية',type:'text'},...shared]},
    honoring:{title:'تفاصيل التكريم',fields:[{key:'name1',label:'اسم المكرّم أو عنوان التكريم',type:'text',required:true},{key:'hostName',label:'الجهة المنظمة',type:'text'},...shared]},
    formal:{title:'تفاصيل المناسبة الرسمية',fields:[{key:'name1',label:'عنوان المناسبة',type:'text',required:true},{key:'hostName',label:'الجهة الداعية',type:'text'},...shared]},
    national:{title:'تفاصيل المناسبة الوطنية',fields:[{key:'name1',label:'عنوان المناسبة',type:'text',required:true},{key:'hostName',label:'الجهة المنظمة',type:'text'},...shared]},
    condolence:{title:'تفاصيل العزاء',fields:[{key:'name1',label:'اسم المتوفى / المتوفاة',type:'text',required:true},{key:'hostName',label:'اسم العائلة',type:'text'},...shared]},
    activity:{title:'تفاصيل النشاط',fields:[{key:'name1',label:'اسم النشاط أو التجمع',type:'text',required:true},...shared,
      {key:'capacity',label:'عدد المشاركين',type:'number',min:1,max:500},
      {key:'shareAmount',label:'قيمة القطّة للفرد',type:'number',min:0,step:.5},
      {key:'requireShareConsent',label:'تأكيد القطّة للضيف ومرافقيه',type:'checkbox'},
      {key:'allowNamedCompanions',label:'طلب أسماء المرافقين',type:'checkbox'},
      {key:'waitlistEnabled',label:'تفعيل قائمة الانتظار عند اكتمال العدد',type:'checkbox'}]},
    custom:{title:'تفاصيل الدعوة',fields:[{key:'name1',label:'عنوان الدعوة',type:'text',required:true},...shared]}
  };
  const schemaFor=key=>schemas[key]||schemas.custom;
  window.HALA_V6_SCHEMA={schemas,schemaFor};
})();
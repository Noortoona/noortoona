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
  const experiences={
    wedding:{headline:'بكل الحب ندعوكم',message:'وجودكم يكمل فرحتنا',rsvpPrompt:'هل ستشاركوننا فرحتنا؟',acceptLabel:'نعم، سأحضر',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:false,allowCompanions:true,allowChildren:true,showRsvp:true,showQr:true,showCountdown:true},
    milkah:{headline:'بفرحٍ يكتمل بحضوركم',message:'يسعدنا تشريفكم ومشاركتنا ليلة الملكة',rsvpPrompt:'هل ستشاركوننا فرحة الملكة؟',acceptLabel:'نعم، سأحضر',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:false,allowCompanions:true,allowChildren:true,showRsvp:true,showQr:true,showCountdown:true},
    engagement:{headline:'يسعدنا أن نشارككم فرحتنا',message:'تشريفكم يسعدنا ويكمل فرحتنا',rsvpPrompt:'هل ستشاركوننا فرحة الخطوبة؟',acceptLabel:'نعم، سأحضر',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:false,allowCompanions:true,allowChildren:true,showRsvp:true,showQr:true,showCountdown:true},
    graduation:{headline:'بكل فخر نشارككم فرحة التخرج',message:'يسعدنا حضوركم ومشاركتنا هذه اللحظة',rsvpPrompt:'هل ستشاركوننا حفل التخرج؟',acceptLabel:'سأحضر الحفل',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:false,allowCompanions:true,allowChildren:false,showRsvp:true,showQr:true,showCountdown:true},
    newborn:{headline:'أهلًا بفرحتنا الصغيرة',message:'نسعد بمشاركتكم فرحتنا بالمولود',rsvpPrompt:'هل ستشاركوننا فرحتنا؟',acceptLabel:'نعم، سأحضر',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:false,allowCompanions:true,allowChildren:true,showRsvp:true,showQr:false,showCountdown:true},
    birthday:{headline:'نحتفل مع من نحب',message:'وجودكم يجعل الاحتفال أجمل',rsvpPrompt:'هل ستشاركوننا الاحتفال؟',acceptLabel:'أكيد، سأحضر',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:true,allowCompanions:true,allowChildren:true,showRsvp:true,showQr:true,showCountdown:true},
    meeting:{headline:'دعوة للاجتماع',message:'يسرّنا حضوركم في الموعد المحدد',rsvpPrompt:'هل ستتمكنون من حضور الاجتماع؟',acceptLabel:'تأكيد الحضور',declineLabel:'لن أتمكن من الحضور',maybeLabel:'سأؤكد لاحقًا',showMaybe:true,allowCompanions:false,allowChildren:false,showRsvp:true,showQr:false,showCountdown:true},
    conference:{headline:'دعوة رسمية',message:'يسرّنا حضوركم ومشاركتكم',rsvpPrompt:'هل ستتمكنون من حضور المؤتمر؟',acceptLabel:'تأكيد الحضور',declineLabel:'لن أتمكن من الحضور',maybeLabel:'سأؤكد لاحقًا',showMaybe:true,allowCompanions:false,allowChildren:false,showRsvp:true,showQr:true,showCountdown:true},
    opening:{headline:'يسرّنا دعوتكم للافتتاح',message:'يشرفنا حضوركم ومشاركتنا هذه المناسبة',rsvpPrompt:'هل ستتمكنون من الحضور؟',acceptLabel:'تأكيد الحضور',declineLabel:'أعتذر عن الحضور',maybeLabel:'سأؤكد لاحقًا',showMaybe:true,allowCompanions:false,allowChildren:false,showRsvp:true,showQr:true,showCountdown:true},
    honoring:{headline:'دعوة لحفل التكريم',message:'يسعدنا حضوركم ومشاركتنا لحظة التقدير',rsvpPrompt:'هل ستتمكنون من الحضور؟',acceptLabel:'سأحضر',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:false,allowCompanions:false,allowChildren:false,showRsvp:true,showQr:true,showCountdown:true},
    formal:{headline:'دعوة رسمية',message:'يسرّنا تشريفكم بالحضور',rsvpPrompt:'هل ستتمكنون من الحضور؟',acceptLabel:'تأكيد الحضور',declineLabel:'أعتذر عن الحضور',maybeLabel:'سأؤكد لاحقًا',showMaybe:true,allowCompanions:false,allowChildren:false,showRsvp:true,showQr:true,showCountdown:true},
    national:{headline:'نفخر بمشاركتكم',message:'يسرّنا حضوركم ومشاركتنا هذه المناسبة الوطنية',rsvpPrompt:'هل ستتمكنون من الحضور؟',acceptLabel:'سأحضر',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:false,allowCompanions:false,allowChildren:false,showRsvp:true,showQr:true,showCountdown:true},
    condolence:{headline:'إنا لله وإنا إليه راجعون',message:'نسأل الله أن يتغمد الفقيد بواسع رحمته',rsvpPrompt:'',acceptLabel:'',declineLabel:'',maybeLabel:'',showMaybe:false,allowCompanions:false,allowChildren:false,showRsvp:false,showQr:false,showCountdown:false},
    activity:{headline:'حياكم في النشاط',message:'نلتقي على الموعد، ومشاركتكم تكمل التجمع',rsvpPrompt:'هل ستشارك معنا؟',acceptLabel:'نعم، سأشارك',declineLabel:'لن أتمكن من المشاركة',maybeLabel:'ربما',showMaybe:true,allowCompanions:true,allowChildren:false,showRsvp:true,showQr:true,showCountdown:true},
    custom:{headline:'يسعدنا حضوركم',message:'وجودكم يسعدنا',rsvpPrompt:'هل ستتمكنون من الحضور؟',acceptLabel:'نعم، سأحضر',declineLabel:'أعتذر عن الحضور',maybeLabel:'ربما',showMaybe:true,allowCompanions:true,allowChildren:true,showRsvp:true,showQr:true,showCountdown:true}
  };
  const schemas={
    wedding:{title:'تفاصيل الزواج',fields:[{key:'name1',label:'اسم العريس',type:'text',required:true},{key:'name2',label:'اسم العروس',type:'text',required:true},...shared]},
    milkah:{title:'تفاصيل الملكة',fields:[{key:'name1',label:'اسم العريس',type:'text',required:true},{key:'name2',label:'اسم العروس',type:'text',required:true},...shared]},
    engagement:{title:'تفاصيل الخطوبة',fields:[{key:'name1',label:'اسم الخطيب',type:'text',required:true},{key:'name2',label:'اسم الخطيبة',type:'text',required:true},...shared]},
    graduation:{title:'تفاصيل التخرج',fields:single('اسم الخريج / الخريجة')},
    newborn:{title:'تفاصيل المولود',fields:[{key:'name1',label:'اسم المولود',type:'text',required:true},{key:'hostName',label:'اسم العائلة أو الوالدين',type:'text'},...shared]},
    birthday:{title:'تفاصيل عيد الميلاد',fields:single('اسم صاحب عيد الميلاد')},
    meeting:{title:'تفاصيل الاجتماع',fields:[{key:'name1',label:'عنوان الاجتماع',type:'text',required:true},{key:'hostName',label:'الجهة أو صاحب الدعوة',type:'text'},...shared]},
    conference:{title:'تفاصيل المؤتمر',fields:[{key:'name1',label:'اسم المؤتمر',type:'text',required:true},{key:'hostName',label:'الجهة المنظمة',type:'text'},...shared]},
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
  const experienceFor=key=>experiences[key]||experiences.custom;
  window.HALA_V6_SCHEMA={schemas,experiences,schemaFor,experienceFor};
})();
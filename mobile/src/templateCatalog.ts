export type OccasionKey = "wedding" | "milkah" | "engagement" | "graduation" | "birthday" | "newborn" | "meeting" | "conference" | "formal" | "activity" | "custom" | "opening" | "honoring" | "national" | "condolence";
export type ActivityKey = "padel" | "football" | "camp" | "chalet" | "trip" | "dinner" | "activityCustom";
export type AtlasKey = "activities" | "social" | "events" | "formal";

export type TemplateOption = {
  name: string;
  atlas: AtlasKey;
  row: number;
  col: number;
  accent: string;
};

const make = (atlas: AtlasKey, row: number, names: string[]): TemplateOption[] =>
  names.map((name, col) => ({ name, atlas, row, col, accent: col === 3 ? "#9A7434" : "#E3BD64" }));

export const templateCatalog: Record<string, TemplateOption[]> = {
    wedding:make('social',2,['ليلة كحلية','حديقة اللؤلؤ','أقواس ذهبية','مخمل ملكي']),
    milkah:make('social',3,['ليلة الملكة','خاتم الوعد','لؤلؤة','مخمل ملكي']),
    engagement:make('social',3,['وعد من ذهب','ورد الخطوبة','زمردة','نقاء']),
    graduation:make('events',0,['قبعة النجاح','ثمرة السنين','منصة المجد','بداية']),
    newborn:make('events',1,['قمر صغير','دفء البداية','ليلة زرقاء','زهرة وردية']),
    birthday:make('social',4,['شموع ذهبية','هدية الليل','ورد وفرح','ليلة احتفال']),
    meeting:make('formal',4,['اجتماع تنفيذي','طاولة القرار','مجلس العمل','موعد رسمي']),
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

export function templatesFor(occasion: OccasionKey, activity: ActivityKey) {
  return templateCatalog[occasion === "activity" ? activity : occasion] || templateCatalog.custom;
}

export function occasionForApi(key: OccasionKey, label: string) {
  return key === "activity" ? "تجمع ونشاط" : key === "milkah" ? "ملكة" : label;
}

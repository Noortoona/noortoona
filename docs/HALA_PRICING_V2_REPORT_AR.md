# HALA — تقرير تنفيذ التسعير والباقات V2

تاريخ التحقق: 10 نوفمبر 2026. دُمج الإصدار الأساسي [#29](https://github.com/Noortoona/noortoona/pull/29) من `feature/hala-pricing-packages-v2` إلى main ونُشر فعليًا. تتابع مراجعة اتساق المسارات القديمة والتحقق الأصلي للهاتف في [#33](https://github.com/Noortoona/noortoona/pull/33)، فرع `feature/hala-mobile-production-build`.

## التنفيذ الفعلي

- مصدر تسعير واحد في الكتالوج القائم: الأسعار التسعة المعتمدة، ميزات الباقات الموروثة، ظهور الباقات، مواعيد سريان الأسعار، مراجعات وتدقيق التغييرات. يستخدم الموقع وExpo والخادم السياسة المشتركة نفسها.
- الأساسية: 399 / 799 / 1,399 ريال؛ بلس: 849 / 1,749 / 2,999 ريال؛ بريميوم: 1,299 / 2,699 / 4,499 ريال للأعداد 100 / 250 / 500. بلس موصى بها بصريًا. الأعداد الأخرى تطلب عرضًا خاصًا.
- تنظيم الدخول مستقل عن جميع الباقات، يبدأ من 599 ريال. الاختيارات مشرف / مشرفة / الاثنان، مع عدد المداخل والمدينة والموقع والتاريخ وبدء الاستقبال والمدة والملاحظات. 500 مدعو أو مدخلان أو الاختيار المختلط يتطلب منظّمين بقيمة 1,198 ريال مبدئيًا. لا تأكيد للتوفر قبل مراجعة التشغيل؛ أكثر من منظمين أو مدة تتجاوز السياسة المعتمدة يحتاج عرضًا مخصصًا.
- الحالة الضريبية غير مفترضة. إعداد قانوني من لوحة الإدارة؛ غيابه يظهر السعر المبدئي ويمنع الدفع الإلكتروني. لا يُعاد تسعير الحجز المحفوظ بعد تغيير الإعدادات.
- حفظ الحجز ورقمه المرجعي ولقطة السياسة والسعر والإحالة والخدمات. إعادة الحساب والتحقق على الخادم، طلبات متكررة آمنة، استرجاع مصرح به، حالات مبدئي/بانتظار الدفع/مؤكد/ملغى/مكتمل. عند غياب الدفع يبقى الطلب مبدئيًا داخل النظام.
- هلا أعمال يبدأ من 3,499 والمؤسسات من 6,999 ريال للخدمة/الفعالية وفق النطاق، مع نموذج عربي/إنجليزي يحفظ طلبات متعددة في CRM القائم مع الإحالة ومنع التكرار.
- لوحة الإدارة: إدارة الكتالوج والضريبة والتسعير وسجل التغييرات، تصفية الحجوزات حسب الباقة والعدد، إجمالي قيمة الطلبات منفصل عن المدفوع، مراجعة تنظيم الدخول وتوزيع الفريق واستعادة الصلاحيات عند سحب التكليف، وإدارة الطلبات المؤسسية.
- الموقع: بطاقات ومقارنة، أسعار فورية، تاريخ ووقت، تفاصيل استقبال، ملخص واسترجاع الحجز، العربية والإنجليزية واتجاها العرض؛ الهوية والشعار الحاليان محفوظان، وإضافات SEO في main محفوظة.
- التطبيق الحالي Expo SDK 57: نفس API والسياسة؛ التقويم والساعة الأصليان، المسودة المحلية، حارس النقر المتكرر، تطبيع الأرقام العربية، اختيار جهة اتصال بإذن المستخدم، وباقات/طلبات الشركات. لا تطبيق منفصل.
- QR: قائمة انتظار آمنة لكل مستخدم ومناسبة عند انقطاع الشبكة؛ يظهر المسح معلقًا ولا يعد الضيف داخلًا. المزامنة تعود للخادم الذي يمنع التسجيل المزدوج المتزامن.
- أمن الدفع: مبلغ محفوظ من الحجز، حظر الطلب قبل مراجعة الضريبة/التشغيل، إعادة استخدام أمر الدفع المتزامن، تحقق المزود على الخادم، عدم خفض حالة مدفوع بسبب استجابة متأخرة، وعدم إحياء حجز ملغى بسبب دفع متأخر.
- واتساب: حالة جاهزية صادقة، منع الإرسال الآلي للأساسية، وتعطيل إرسال الباقات الأخرى ما لم تكتمل أعلام التفعيل والقوالب. المشاركة اليدوية متاحة، والتذكيرات الآلية معلنة كخدمة تنتظر التفعيل. لم تُرسل رسالة اختبار حقيقية.

## حماية البيانات والفروع

بدأ العمل من main المستقر `9d3940f` وأُدخلت إضافات main `f385dd1` دون استبدالها. روجعت PRs #20 و#23 و#24 و#27 ولم تُدمج أعمال غير جاهزة. احتُفظ بـSDK 57؛ ترقية #27 لم تعتمد بسبب فشل توافق/CI. ترحيل قاعدة البيانات إضافي ومتوافق خلفيًا، لا يعيد كتابة الحجوزات أو الأسعار التاريخية. بيئة المعاينة تستخدم فرع قاعدة بيانات مستقل.

## التحقق المنفذ

- 129 اختبار خادم/قاعدة بيانات/بناء/أمان/كتالوج وحجوزات ناجح، إضافة إلى smoke. منها توافق طلبات تنظيم الدخول التاريخية وسياسة الأسعار التسعة، التلاعب بالسعر، الضريبة والإحالة، السعر التاريخي، صلاحيات العميل والإدارة، فريق الاستقبال، المسح المتزامن، الإلغاء والدفع المتأخر وطلبات الشركات.
- TypeScript للتطبيق ناجح و12 اختبار تدفق للهاتف ناجح. Expo Doctor وprebuild وتوليد حزم Hermes لـiOS وAndroid نجحت في CI.
- اختبارات متصفح CI: 48 حالة على سطح المكتب وعرضي iPhone وAndroid؛ تتضمن الأسعار واللغتين والحجز وظهوره في الإدارة وإعادة استرجاعه. هذه محاكاة عرض الويب وليست إثبات اختبار جهازين فعليين.
- [فحص الويب الناجح](https://github.com/Noortoona/noortoona/actions/runs/42814108802) و[فحص التطبيق الناجح](https://github.com/Noortoona/noortoona/actions/runs/42814108966) لمنطق الحجز والدفع ويعقبهما [فحص رأس الإصدار النهائي للويب](https://github.com/Noortoona/noortoona/actions/runs/42815087510) و[التطبيق](https://github.com/Noortoona/noortoona/actions/runs/42815087715)، وكلاهما ناجح. فحوص متابعة #33 نجحت أيضًا على الرأس `9456dcb4`: [الويب](https://github.com/Noortoona/noortoona/actions/runs/42818543601)، [التطبيق](https://github.com/Noortoona/noortoona/actions/runs/42818543492)، والاختبار الأصلي أعلاه.
- اختبار متصفح فعلي في [المعاينة](https://deploy-preview-29--noortoona.netlify.app): حجز تجريبي معلّم بوضوح، بلس 500 = 2,999 ريال + منظّمان = 1,198، الإجمالي المبدئي 4,197 ريال، مرجع `HALA-D0CCF537D15A`. حُفظ في قاعدة المعاينة واستُرجع من صفحة الحجز؛ بقي بانتظار الدفع والتوفر والضريبة. لا رسائل أو مدفوعات حقيقية.
- ظهور الحجز للإدارة ودور الموظف والمنظم مُثبت في قاعدة اختبار معزولة وCI. لم يُتجاوز دخول الإدارة لإجراء اختبار بشخصية المالك في المعاينة.
- فشل عدد من اختبارات المتصفح المحلية بسبب عطل بيئة Chromium المحلية ثبت حتى بصفحة HTML مستقلة؛ نُفذت المجموعة نفسها بنجاح على مشغل GitHub. لم تُضعف الاختبارات لإخفاء المشكلة.

## البناء والتوزيع

- [بناء APK النهائي للموقع الرسمي](https://github.com/Noortoona/noortoona/actions/runs/42815999861) نجح من `1e176774`: [تحميل HALA-Pricing-V2-Android.apk](https://chatgpt.com/library?file_id=libfile_1000fc211c688191a8f48ed89bb02b04&account_id=personal). معمارية arm64، توقيع debug للاختبار، API هو `https://halainvites.com`، والدفع الإلكتروني معطل. تحقق محتوى الحزمة من غياب عنوان المعاينة. SHA-256: `6847dab85119cd9399687c63efba86fa6ef1fc919ffcee1d21b4bf211a3e30a7`.
- [بناء APK المعاينة النهائي](https://github.com/Noortoona/noortoona/actions/runs/42814773035) نجح من `7f76cbe4`: [تحميل نسخة المعاينة المعزولة](https://chatgpt.com/library?file_id=libfile_eabc7038604c819188bf124b4a6f0abd&account_id=personal). ترتبط بقاعدة المعاينة؛ SHA-256: `14f6ab32a4a23cf23f6670d60ab48ba4b5ec5d4d569236f1074ef25dcda1c35f`.
- [بناء واختبار iPhone الأصلي](https://github.com/Noortoona/noortoona/actions/runs/42818535506) نجح من `9456dcb4`: تجميع Xcode والتثبيت والتشغيل دون شهادة توزيع، ثم Maestro عبر التنقل داخل التطبيق. نجحت جميع الخطوات: فتح الباقات، اختيار 500، التحقق من 1,399 ريال للأساسية، تبديل الإنجليزية والتحقق من HALA Essential، والتمرير للتحقق من 4,499 ريال للبريميوم. روجعت صورتا العربية والإنجليزية الناتجتان. هذه تجربة محاكي فعلية، وليست TestFlight أو اختبار حجز كامل على هاتف فعلي.

- لا عضوية Apple Developer/شهادات توزيع متاحة مثبتة في هذه المهمة؛ TestFlight والاختبار على iPhone فعلي غير مكتملين. لم يُختبر APK على جهاز Android فعلي. لا إعلان جاهزية App Store أو Google Play أو AAB رسمي.
- الإنتاج: نُشر main `479be156fbf5d4262cfee105e7555bbe4f228652` عبر Netlify deploy `6af30d2e7166fb496c114210` بحالة ready، وطُبق الترحيل الإضافي على فرع قاعدة `production`. اجتاز فحصًا بعد النشر للأسعار التسعة ورفض الوصول إلى واجهتي إدارة الكتالوج والحجوزات دون دخول بـ401. لا حجوزات اختبار أو رسائل أو مدفوعات أُنشئت في الإنتاج.
- متابعة اتساق تنظيم الدخول: لوحة العميل تعتمد بيانات الحجز، ومسارات المشرف القديمة لا تعدل فريق V2 ولا تلغي إضافته. إحصاءات الإدارة لا تكرر الطلب بين النظام القديم والحجز. أثبت اختبار قاعدة البيانات بقاء طلب تاريخي بقيمة 299 ريال قابلًا للقراءة والتعيين بعد سداد موثق، مع منع المسارات نفسها من تعديل V2. نتائج المتابعة والدمج والنشر النهائي موثقة في #33.

## المتبقي قبل اعتماد الاستخدام التجاري الكامل

1. إقرار الوضع الضريبي الصحيح من المالك وتسجيله عبر الإدارة. الحجوزات المحفوظة قبل ذلك لا تصبح مستحقة الدفع تلقائيًا.
2. مراجعة التوفر الفعلي، حدود مدة الخدمة والمدن وتعيين المنظمين؛ لا توجد أسعار مخترعة لمدة/موقع خاص.
3. استكمال اعتماد مزود واتساب والفوترة والقوالب والـwebhook ثم تحقق تسليم في اختبار مصرح. جدولة التذكيرات غير مكتملة وتظل معطلة.
4. تهيئة مفاتيح بوابة الدفع وبيئة الاختبار والتحقق من فشل/إلغاء/تكرار الدفع مع المزود فعليًا. اختبارات المهمة الحالية تستخدم mock آمنًا ولا تعني اكتمال التكامل التجاري.
5. الخدمات الشخصية والتصميم الخاص تقدم بمراجعة بشرية ضمن النطاق؛ لا تكاملات مؤسسية غير جاهزة ولا رقم واتساب مخصص موعود.
6. اختبار الأجهزة الفعلية: صلاحيات جهات الاتصال/الكاميرا، تسجيل الدخول حسب الدور، ضعف الشبكة والعودة بين الشاشات، ثم Apple signing/TestFlight وAndroid الرسمي.

## خطة التراجع

عند خلل إنتاجي: عكس تغييرات الكود عبر commit/PR ونشر بناء جديد من main. تبقى أعمدة الترحيل الإضافية ولقطات الأسعار والحجوزات محفوظة؛ لا حذف للبيانات ولا استعادة نشر قديم متعارض مع مسار الترحيلات. تعطيل الخدمات الخارجية يظل بالإعدادات المصرح بها دون حذف السجلات.

## الملفات المعدلة

- `.github/workflows/hala-android-production-trial.yml`
- `.github/workflows/hala-android-review.yml`
- `.github/workflows/hala-pricing-ios-simulator.yml`
- `.github/workflows/hala-web-check.yml`
- `admin.html`
- `admin.js`
- `app.js`
- `booking-client.js`
- `booking.html`
- `booking.js`
- `customer.js`
- `docs/HALA_PRICING_V2_REPORT_AR.md`
- `i18n.js`
- `index.html`
- `invitation-renderer.js`
- `mobile/.gitignore`
- `mobile/app.json`
- `mobile/app/(customer)/customer/create.tsx`
- `mobile/app/(customer)/customer/event/[id].tsx`
- `mobile/app/(customer)/customer/index.tsx`
- `mobile/app/(supervisor)/supervisor/scanner.tsx`
- `mobile/app/login.tsx`
- `mobile/app/packages.tsx`
- `mobile/e2e/pricing.yaml`
- `mobile/metro.config.js`
- `mobile/package-lock.json`
- `mobile/package.json`
- `mobile/src/BookingCheckout.tsx`
- `mobile/src/DateTimeField.tsx`
- `mobile/src/PackagePicker.tsx`
- `mobile/src/catalog.ts`
- `mobile/src/checkinQueue.ts`
- `mobile/src/invitationSource.ts`
- `mobile/src/phoneContact.ts`
- `mobile/src/prebooking.ts`
- `mobile/tests/flows.mjs`
- `netlify/database/migrations/20261110090000_pricing-packages-v2/migration.sql`
- `netlify/functions/_shared/bookings.mjs`
- `netlify/functions/_shared/capabilities.mjs`
- `netlify/functions/_shared/catalog.mjs`
- `netlify/functions/_shared/moyasar.mjs`
- `netlify/functions/_shared/payments.mjs`
- `netlify/functions/_shared/settings.mjs`
- `netlify/functions/admin-bookings.mts`
- `netlify/functions/admin-catalog.mts`
- `netlify/functions/admin-event-members.mts`
- `netlify/functions/admin-overview.mts`
- `netlify/functions/admin-settings.mts`
- `netlify/functions/admin-supervisors.mts`
- `netlify/functions/booking-quote.mts`
- `netlify/functions/bookings.mts`
- `netlify/functions/catalog.mts`
- `netlify/functions/create-event.mts`
- `netlify/functions/leads.mts`
- `netlify/functions/payment-order.mts`
- `netlify/functions/pricing-quote.mts`
- `netlify/functions/referral-quote.mts`
- `netlify/functions/supervisor-addon.mts`
- `netlify/functions/whatsapp-send.mts`
- `package.json`
- `playwright.config.js`
- `prelaunch.js`
- `pricing-v2.css`
- `scripts/build-static.mjs`
- `shared/pricing-policy.d.mts`
- `shared/pricing-policy.mjs`
- `tests/accounts.mjs`
- `tests/catalog.mjs`
- `tests/database.mjs`
- `tests/e2e/pricing-v2.spec.js`
- `tests/partners.mjs`
- `tests/payments.mjs`
- `tests/prebookings.mjs`
- `tests/pricing-v2.mjs`
- `tests/smoke.mjs`
- `tests/web-safety.mjs`

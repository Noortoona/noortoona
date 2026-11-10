/* HALA bilingual interface: Arabic is canonical; translations affect UI only. */
(function () {
  "use strict";
  var STORAGE_KEY = "hala.locale";
  var translations = Object.fromEntries([
    ["المناسبات", "Occasions"], ["القوالب", "Templates"], ["كيف تعمل؟", "How it works"], ["الخدمات", "Services"], ["الباقات", "Packages"], ["الإطلاق", "Launch"],
    ["فتح القائمة", "Open menu"], ["دخول", "Sign in"], ["أنشئ مناسبتك", "Create your event"],
    ["من الفكرة إلى الدعوة… ومن الدعوة إلى لحظة لا تُنسى", "From an idea to an invitation, and an unforgettable moment"],
    ["لحظتك ..", "Your moment..."], ["تبدأ بهلا", "starts with HALA"],
    ["أنشئ دعوتك، صمّمها بطابعك، أرسلها لضيوفك، وتابع الحضور من مكان واحد — قبل المناسبة وأثناءها وبعدها.", "Create and personalize your invitation, send it to guests, and manage attendance in one place — before, during and after your event."],
    ["ابدأ مناسبتك الآن", "Start your event"], ["اكتشف التجربة", "Explore the experience"],
    ["لديك دعوة غير مكتملة", "You have an unfinished invitation"], ["أكمل من حيث توقفت ←", "Continue where you left off →"],
    ["تصميم فاخر", "Elegant design"], ["قوالب بصرية", "Beautiful templates"], ["إدارة ذكية", "Smart management"], ["ضيوف وRSVP", "Guests and RSVPs"],
    ["واتساب", "WhatsApp"], ["روابط شخصية", "Personal links"], ["معاينة تجربة هلا", "HALA experience preview"],
    ["بكل الحب ندعوكم", "With love, you are invited"], ["ليلة العمر", "Our special night"], ["أحمد & سارة", "Ahmed & Sarah"],
    ["14 ديسمبر 2026", "14 December 2026"], ["دعوة خاصة", "Private invitation"], ["يسرّنا حضوركم ومشاركتنا فرحتنا", "We would love to celebrate with you"],
    ["الرياض • 8:00 مساءً", "Riyadh • 8:00 PM"], ["عرض الدعوة", "View invitation"], ["RSVP مباشر", "Live RSVP"], ["QR دخول", "QR check-in"],
    ["تصاميم فاخرة", "Elegant designs"], ["لكل نوع مناسبة", "For every occasion"], ["تخصيص كامل", "Fully customizable"],
    ["على ذوقك", "Made your way"], ["إدارة الضيوف", "Guest management"], ["حضور واعتذار", "Accept or decline"],
    ["إرسال عبر واتساب", "Send via WhatsApp"], ["لكل ضيف رابط", "A link for every guest"], ["QR للدخول", "QR check-in"], ["تسجيل أسرع", "Faster check-in"],
    ["اختر مناسبتك", "Choose your occasion"], ["ابدأ الرحلة من نوع المناسبة", "Begin with your occasion"],
    ["لكل مناسبة تجربة وقوالب خاصة. وإن لم تجدها، اكتب مناسبتك بنفسك.", "Every occasion has its own experience and templates. Can't find yours? Create a custom occasion."],
    ["زواج • ملكة • خطوبة • تخرج • مولود • عيد ميلاد • فعاليات • رسمية • وأكثر", "Wedding • Engagement • Graduation • New baby • Birthday • Events • Corporate • More"],
    ["معرض التصاميم", "Design gallery"], ["قوالب تبدو وكأنها صُنعت لك وحدك", "Templates that feel made just for you"],
    ["اختر تصميمًا بصريًا جاهزًا، ثم خصّص النص والخط واللون والخلفية.", "Choose a ready-made design, then customize the text, font, colors and background."],
    ["صمّم دعوتك بطابعك", "Make your invitation your own"],
    ["اختر المناسبة والقالب، ثم عدّل النص والخط واللون أو استخدم صورتك كخلفية.", "Choose an occasion and template, then customize the wording, typography, colors or add your own background."],
    ["ملكي", "Royal"], ["مخملي", "Velvet"], ["مودرن", "Modern"], ["رومانسي", "Romantic"], ["ابدأ التصميم", "Start designing"],
    ["تجربة واحدة متكاملة", "One seamless experience"], ["من المناسبة إلى باب القاعة", "From the first idea to the venue entrance"],
    ["هلا لا يتوقف عند التصميم — هو نظام إدارة المناسبة بالكامل.", "HALA goes beyond invitation design to help manage your entire event."],
    ["أنشئ المناسبة", "Create your event"], ["النوع، الموعد، الموقع، الغلاف والإعدادات.", "Set the type, date, location, cover and preferences."],
    ["صمّم دعوتك", "Design your invitation"], ["قالب بصري جاهز مع تخصيص أنيق.", "Choose a beautiful template and personalize it."],
    ["أضف الضيوف", "Add guests"], ["روابط فريدة وQR لكل مدعو.", "Unique links and QR codes for each guest."],
    ["أرسل وتابع", "Send and track"], ["واتساب، RSVP، تذكير وإحصائيات.", "WhatsApp, RSVPs, reminders and insights."],
    ["استقبلهم", "Welcome guests"], ["مسح QR وتسجيل الحضور عند الباب.", "Scan QR codes and check in at the door."],
    ["لوحة صاحب المناسبة", "Host dashboard"], ["كل ضيوفك أمامك، لحظة بلحظة", "Stay connected to every guest"],
    ["اعرف من استلم الدعوة، من شاهدها، من أكد حضوره ومن اعتذر — مع عدد المرافقين وملاحظاتهم.", "See who received and viewed the invitation, who accepted or declined, and guests' companions and notes."],
    ["فتح لوحة المناسبات", "Open event dashboard"], ["المناسبة", "Event"], ["زواج أيمن", "Ayman's wedding"], ["14 ديسمبر", "14 December"],
    ["مدعو", "Invited"], ["شاهد", "Viewed"], ["مؤكد", "Confirmed"], ["معتذر", "Declined"], ["بانتظار الرد", "Awaiting response"],
    ["كمّل فرحتك مع هلا", "Complete your celebration with HALA"], ["من أول دعوة… إلى آخر ضيف", "From the first invitation to the last guest"],
    ["خدمات مكملة لمناسبتك؛ يُحدَّد التوفر ونطاق التنفيذ مع الفريق قبل اعتماد أي خدمة.", "Optional services for your event. Availability and scope are confirmed with our team before booking."],
    ["القاعات والمواقع", "Venues and locations"], ["للزواج والملكات والفعاليات التي تحتاج موقعًا مناسبًا لعدد الضيوف.", "Find the right venue for weddings, engagements and other gatherings."],
    ["التصوير", "Photography"], ["مصورون وفيديو وتغطية مناسبة حسب نوع الحدث.", "Photography, video and event coverage tailored to the occasion."],
    ["الورد والتنسيق", "Flowers and styling"], ["تنسيق طاولات ومداخل وهوية بصرية متوافقة مع الدعوة.", "Floral styling, entrance decor and details that match your invitation."],
    ["الضيافة والحلويات", "Catering and sweets"], ["خيارات ضيافة مناسبة لعدد المدعوين وطبيعة المناسبة.", "Hospitality options to suit your event and guest count."],
    ["الصوت والترفيه", "Sound and entertainment"], ["خيارات مخصصة للفعاليات والاحتفالات فقط عند الحاجة.", "Entertainment and sound options where appropriate."],
    ["الهدايا والتوزيعات", "Gifts and favors"], ["توزيعات وشكر للضيوف مرتبطة بهوية المناسبة.", "Thoughtful favors and thank-you gifts matched to your event."],
    ["مساعد هلا للتحضير", "HALA planning assistant"], ["قل له وش عندك… وهو يرتّب البداية.", "Tell us your plans. We'll help you get started."],
    ["اكتب نوع المناسبة، المدينة، عدد الضيوف والميزانية. هلا يقترح لك خطوات التحضير والخدمات المناسبة دون أن يفترض معلومات لا تخص دعوتك.", "Share your event type, city, guest count and budget to get suggested planning steps and services."],
    ["نوع المناسبة", "Occasion"], ["زواج", "Wedding"], ["ملكة / خطوبة", "Engagement"], ["تخرج", "Graduation"],
    ["عيد ميلاد", "Birthday"], ["نشاط / تجمع", "Activity / gathering"], ["اجتماع / مؤتمر", "Meeting / conference"],
    ["المدينة", "City"], ["عدد الضيوف", "Guest count"], ["الميزانية", "Budget"], ["رتّبها مع هلا", "Plan with HALA"],
    ["خطة هلا تظهر هنا", "Your HALA plan appears here"], ["نختار لك أولويات مناسبة لنوع دعوتك، وليس قالبًا عامًا للجميع.", "We recommend priorities tailored to your occasion."],
    ["شركاء هلا", "HALA Partners"], ["بوابة مستقبلية للقاعات والمصورين والمنسقين ومقدمي الخدمات لإدارة الطلبات والباقات والمواعيد من مكان واحد.", "A future portal for venues, photographers, planners and service providers to manage bookings, packages and availability."],
    ["ملف مقدم الخدمة", "Service provider profile"], ["صور • باقات • مناطق الخدمة • التوفر • طلبات العملاء", "Photos • Packages • Coverage areas • Availability • Inquiries"],
    ["قريبًا", "Coming soon"], ["اختر حسب حجم مناسبتك", "Find the right package"], ["خيارات واضحة بحسب عدد المدعوين واحتياج المناسبة.", "Clear options based on guest count and event needs."],
    ["خدمات الأعمال والإضافات", "Business services and add-ons"], ["هلا للأعمال والمؤسسات", "HALA for Businesses & Organizations"],
    ["تسعير استرشادي لخدمات الشركات القادمة، ويُعتمد نطاق الخدمة النهائي بعرض سعر وعقد مستقل.", "Indicative pricing for upcoming business services; final scope is agreed through a separate quote and contract."],
    ["هلا أعمال", "HALA Business"], ["هلا المؤسسات", "HALA Enterprise"],
    ["فعالية واحدة حتى 500 مدعو، مع هوية خاصة وتقارير حضور.", "One event for up to 500 guests, with custom branding and attendance reports."],
    ["اشتراك شهري، مع تحديد نطاق المدعوين والخدمات في العقد.", "Monthly subscription, with guest limits and services defined by contract."],
    ["تبدأ من 2,999", "From 2,999"], ["يبدأ من 8,999", "From 8,999"], ["ريال / فعالية", "SAR / event"], ["ريال / شهر", "SAR / month"],
    ["خدمات إضافية:", "Add-ons:"], ["مشرف أو مشرفة +599 ريالًا", "Event supervisor + SAR 599"],
    ["تصميم حصري ابتداءً من 149 ريالًا", "Custom design from SAR 149"], ["(حسب التوفر وعرض السعر).", "(subject to availability and quote)."],
    ["الباقات التجارية والإضافات غير المفعلة تُطلب بعد التعاقد. يتم تأكيد الرسوم قبل الدفع.", "Business packages and inactive add-ons require prior agreement. Fees are confirmed before payment."],
    ["بداية قريبة… بطابع هلا", "A new beginning, the HALA way"], ["كن من أوائل عملاء هلا", "Be among HALA's first customers"],
    ["سجّل اهتمامك بالإطلاق دون إنشاء حجز. يمكنك طلب التواصل فقط، والموافقة على الأخبار والعروض مستقلة واختيارية.", "Register your interest without making a booking. You can request contact only; marketing updates are optional and separate."],
    ["الاسم (اختياري)", "Name (optional)"], ["رقم الجوال", "Phone number"], ["البريد الإلكتروني", "Email address"],
    ["الخدمة التي تهمك (اختياري)", "Service you're interested in (optional)"], ["لم أحدد بعد", "Not sure yet"],
    ["دعوات رقمية", "Digital invitations"], ["مشرف أو مشرفة", "Event supervisor"], ["الشراكة مع هلا", "Partner with HALA"],
    ["أدخل رقم جوال أو بريدًا إلكترونيًا حقيقيًا لنتمكن من متابعة اهتمامك.", "Enter a valid phone number or email so we can follow up."],
    ["أوافق اختياريًا على استقبال أخبار إطلاق هلا والعروض التسويقية.", "I optionally agree to receive HALA launch news and promotional offers."],
    ["تسجيل اهتمامي", "Register interest"], ["للمساعدة: خدمة عملاء هلا", "Need help? HALA support"],
    ["مناسبتك تستحق بداية أجمل.", "Every great occasion deserves a beautiful start."],
    ["أنشئ أول دعوة وابدأ تجربة هلا الآن.", "Create your first invitation and discover HALA."],
    ["لحظتك .. تبدأ بهلا", "Your moment starts with HALA"],
    ["منصة الدعوات وإدارة المناسبات — بتجربة خليجية فاخرة.", "Premium digital invitations and event management."],
    ["بوابات هلا", "HALA portals"], ["دخول الإدارة", "Admin sign-in"], ["المشرفون", "Supervisors"], ["شركاء الأعمال", "Business partners"],
    ["© 2026 HALA. جميع الحقوق محفوظة.", "© 2026 HALA. All rights reserved."],
    ["السابق", "Back"], ["التالي", "Next"], ["المناسبة", "Occasion"], ["التفاصيل", "Details"], ["القالب", "Template"], ["التصميم", "Design"], ["الضيوف", "Guests"], ["المعاينة", "Preview"], ["تأكيد الحجز", "Confirm booking"],
    ["مراحل إنشاء الدعوة", "Invitation creation steps"], ["إضافة", "Add"], ["إلغاء", "Cancel"], ["حفظ", "Save"], ["متابعة", "Continue"],
    ["مناسباتي", "My events"], ["مناسباتي | هلا", "My events | HALA"], ["إدارة هلا", "HALA administration"], ["لوحة إدارة هلا", "HALA admin dashboard"],
    ["الإحصائيات والعمليات", "Analytics and operations"], ["خروج", "Sign out"], ["حساب هلا", "HALA account"],
    ["حسابك", "Your account"], ["أدر مناسبتك بسهولة", "Manage your events with ease"], ["الدعوات، الحضور، الضيوف وطلب مشرف للمناسبة من حساب واحد.", "Invitations, attendance, guests and event supervisor requests in one account."],
    ["إنشاء مناسبة جديدة", "Create a new event"], ["جاري تحميل مناسباتك…", "Loading your events..."],
    ["حجزي | هلا", "My booking | HALA"], ["حسابي", "My account"], ["جاري تحميل الحجز…", "Loading booking..."],
    ["لوحة المناسبة | هلا", "Event dashboard | HALA"], ["الرئيسية", "Home"], ["جاري تحميل لوحة المناسبة…", "Loading event dashboard..."],
    ["دعوة | هلا", "Invitation | HALA"], ["جاري تجهيز دعوتك…", "Preparing your invitation..."],
    ["كل هلا أمامك", "Your HALA overview"], ["الزوار، العملاء، المناسبات، الدعوات، واتساب، المدفوعات وطلبات المشرفين.", "Visitors, customers, events, invitations, WhatsApp, payments and supervisor requests."],
    ["جاري تحميل الإحصائيات…", "Loading analytics..."], ["شركاء هلا", "HALA Partners"], ["إحالاتك وعمولاتك", "Referrals and commissions"],
    ["شركاء عمل", "Business partners"], ["شراكتك مع هلا", "Your HALA partnership"],
    ["شارك الرابط أو الكود، وتابع العملاء المكتسبين والعمولات المسجلة بعد الدفع.", "Share your link or code and track acquired customers and eligible commissions after payment."],
    ["جاري تحميل حسابك…", "Loading account..."], ["مشرف هلا", "HALA supervisor"],
    ["مساحة المشرف", "Supervisor workspace"], ["المناسبات المسندة لك", "Your assigned events"], ["تابع الحضور والاستقبال وافتح لوحة كل مناسبة من مكان واحد.", "Monitor guest check-in and open each assigned event from one place."],
    ["جاري تحميل مهامك…", "Loading assignments..."],
    ["هلا | لحظتك .. تبدأ بهلا", "HALA | Your moment starts here"],
    ["هلا — منصة دعوات رقمية راقية لإنشاء الدعوات وإرسالها وإدارة الضيوف والحضور بكل أناقة.", "HALA — premium digital invitations and guest management."],
    ["أنشئ دعوتك الرقمية وأدر الضيوف والحضور والروابط الفريدة من مكان واحد.", "Create digital invitations and manage guests, RSVPs and personal invitation links in one place."]
  ]);
  var originals = new WeakMap();
  var originalAttributes = new WeakMap();
  var locale = "ar";
  var isSupported = function (v) { return v === "ar" || v === "en"; };
  function readLocale() {
    try { var value = localStorage.getItem(STORAGE_KEY); return isSupported(value) ? value : "ar"; }
    catch (_error) { return "ar"; }
  }
  function translate(value, language) {
    var raw = String(value == null ? "" : value);
    if ((language || locale) !== "en") return raw;
    return translations[raw] || raw;
  }
  function translateText(node) {
    if (!node || !node.parentElement) return;
    if (node.parentElement.closest("script,style,noscript,textarea,code,pre,[data-no-i18n],.hala-language-picker")) return;
    var option = node.parentElement.closest("option");
    if (option && !option.hasAttribute("value")) return;
    if (!originals.has(node)) originals.set(node, node.nodeValue);
    var original = originals.get(node);
    var trimmed = original.trim();
    if (!trimmed || !translations[trimmed]) return;
    var next = locale === "en" ? original.replace(trimmed, translations[trimmed]) : original;
    if (node.nodeValue !== next) node.nodeValue = next;
  }
  function translateElement(element) {
    if (!(element instanceof Element) || element.closest("[data-no-i18n],.hala-language-picker")) return;
    var attrs = ["title", "placeholder", "aria-label", "alt"];
    if (!originalAttributes.has(element)) originalAttributes.set(element, {});
    var originalsForElement = originalAttributes.get(element);
    attrs.forEach(function (attribute) {
      if (!element.hasAttribute(attribute)) return;
      if (!Object.prototype.hasOwnProperty.call(originalsForElement, attribute)) originalsForElement[attribute] = element.getAttribute(attribute);
      var original = originalsForElement[attribute];
      var next = translate(original);
      if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
    });
  }
  function localizeTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) translateElement(root);
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node);
      else translateElement(node);
    }
  }
  function updatePicker() {
    document.querySelectorAll(".hala-language-picker select").forEach(function (select) { select.value = locale; });
  }
  function applyLocale(next, persist) {
    locale = isSupported(next) ? next : "ar";
    if (persist) { try { localStorage.setItem(STORAGE_KEY, locale); } catch (_error) {} }
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.title = translate(document.titleOriginal || document.title, locale);
    if (document.body) localizeTree(document.body);
    updatePicker();
    document.dispatchEvent(new CustomEvent("hala:localechange", { detail: { locale: locale, dir: document.documentElement.dir } }));
  }
  function addPicker() {
    if (document.querySelector(".hala-language-picker")) return;
    var anchor = document.querySelector(".nav-actions") || document.querySelector(".portal-header") || document.querySelector(".dash-header");
    var wrapper = document.createElement("label");
    wrapper.className = "hala-language-picker" + (anchor ? "" : " hala-language-floating");
    wrapper.setAttribute("aria-label", "Language / اللغة");
    var icon = document.createElement("span");
    icon.className = "hala-language-icon"; icon.textContent = "🌐"; icon.setAttribute("aria-hidden", "true");
    var select = document.createElement("select");
    select.setAttribute("aria-label", "Language / اللغة");
    [["ar", "العربية"], ["en", "English"]].forEach(function (pair) {
      var option = document.createElement("option"); option.value = pair[0]; option.textContent = pair[1]; select.appendChild(option);
    });
    select.value = locale;
    select.addEventListener("change", function () { applyLocale(select.value, true); });
    wrapper.appendChild(icon); wrapper.appendChild(select);
    if (anchor) anchor.insertBefore(wrapper, anchor.firstChild);
    else document.body.insertBefore(wrapper, document.body.firstChild);
  }
  function init() {
    document.titleOriginal = document.title;
    locale = readLocale();
    addPicker();
    applyLocale(locale, false);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) { localizeTree(node); });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", function (event) { if (event.key === STORAGE_KEY) applyLocale(readLocale(), false); });
  }
  window.HALA_I18N = { getLocale: function () { return locale; }, setLocale: function (v) { applyLocale(v, true); }, t: translate };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

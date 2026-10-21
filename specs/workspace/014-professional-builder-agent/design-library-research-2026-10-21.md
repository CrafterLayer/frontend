# بحث مكتبات تصميم الصفحات — 2026-10-21

النطاق: امتداد feature014، وفق طلب المستخدم البحث في GitHub وتثبيت مكتبات تفيد تصميم الصفحات.
المصادر أدناه وثائق أصلية ومستودعات المشاريع نفسها. التوصية قرار هندسي يناسب CraftKit؛ ليست نتيجة
مقارنة بصرية عمياء أو وعدًا بأن مخرجات النموذج أصبحت 10/10.

## القرار وما تم تثبيته

ثُبّتت حزمتان بإصدارات ثابتة في catalog المشروع:

- **`@base-ui/react@1.9.0`، MIT**: سلوك تفاعلي قابل للتصميم بحرية. المكتبة لا تفرض CSS أو شكل
  navbar/header/footer، وتدعم استيراد الأجزاء المطلوبة. الـmanifest الأصلي يقبل React/React DOM عبر
  `^17 || ^18 || ^19`. راجع [البدء الرسمي](https://base-ui.com/react/overview/quick-start)،
  [manifest المصدر](https://github.com/mui/base-ui/blob/master/packages/react/package.json)،
  [ترخيص الإصدار الثابت](https://github.com/mui/base-ui/blob/v1.9.0/LICENSE)،
  [بيانات الإصدار المنشور](https://registry.npmjs.org/@base-ui%2Freact/1.9.0).
- **`@radix-ui/colors@3.0.0`، MIT**: بيانات ألوان ذات درجات ودلالات استخدام، وليست مكتبة React أو
  قوالب صفحات. الـmanifest يعلن `sideEffects: false`؛ لا يفرض React إضافيًا.
  [المستودع والـmanifest](https://github.com/radix-ui/colors/blob/main/package.json)،
  [بيانات الإصدار المنشور](https://registry.npmjs.org/@radix-ui%2Fcolors/3.0.0)،
  [شرح الدرجات الرسمي](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale).

الحقيقة المحلية: `pnpm-workspace.yaml` يثبت الإصدارين؛ حزمة editor تملك اعتماد Base UI وحزمة
builder-ai تملك اعتماد Radix Colors. بقي React/DOM على الإصدار المطابق `19.2.9`. تثبيت المكتبة وحده
لا يجعلها متاحة داخل صفحة مولّدة؛ يلزم إدخالها في catalog الموثوق وتعليم الأيجنت واجهاتها المقبولة
واختبار التصدير. تفاصيل التنفيذ المقبول في [خطة هذا الامتداد](design-libraries-2026-10-21.md).

## المقارنة المختصرة

| الخيار                | نوعه وترخيصه المثبت بالمصدر                                                                                                                                | الملاءمة والقرار                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI               | حزمة npm فعلية، مكوّنات بلا تنسيق مفروض، MIT، React19 مدعوم بالـpeer declarations.                                                                         | اختيارنا لسلوك القوائم والحوارات والتبويبات مع بقاء التصميم مؤلفًا للصفحة. [الوثائق](https://base-ui.com/react/overview/quick-start)، [GitHub](https://github.com/mui/base-ui)                                                                                                                                                                             |
| React Aria Components | حزمة npm `react-aria-components`، Apache-2.0، مكوّنات بلا CSS افتراضي. manifest المصدر المقروء كان `1.22.1` ويشمل React19؛ ليس إصدارًا مثبتًا في CraftKit. | بديل قوي عندما تصبح التواريخ والتقويمات والأرقام والمجموعات المركبة أولوية. توصية تأجيل إضافتها لتجنب أساسين متداخلين الآن. [التثبيت والتخصيص](https://react-aria.adobe.com/getting-started)، [التفاعل والتدويل](https://react-aria.adobe.com/)، [manifest](https://github.com/adobe/react-spectrum/blob/main/packages/react-aria-components/package.json) |
| Radix Primitives      | حزمة npm `radix-ui` أو حزم مستقلة؛ سلوك بلا تنسيق مفروض. manifest Dialog يعلن MIT ودعم React19.                                                            | بديل لـBase UI، لا يضيف بذاته هوية بصرية مختلفة. لم نثبّت مكتبة primitives ثانية. [المقدمة وطرق الاستيراد](https://www.radix-ui.com/primitives/docs/overview/introduction)، [manifest Dialog](https://github.com/radix-ui/primitives/blob/main/packages/react/dialog/package.json)                                                                         |
| Radix Colors          | حزمة npm مستقلة، MIT، درجات للأرضيات والحدود والنصوص والتعبئات.                                                                                            | اختيرت للألوان الدلالية الاختيارية، مع قياس التباين الفعلي بعد أي override. [GitHub](https://github.com/radix-ui/colors)، [دلالات الدرجات](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)                                                                                                                               |
| shadcn/ui             | منصة توزيع **كود مصدر** ومكوّنات قابلة للتعديل؛ المستودع MIT. ليست حزمة runtime شاملة تستورد جميع التصاميم منها.                                           | مصدر انتقائي للكود والمرجع، والمشروع يملك بالفعل blocks مقتبسة ومكيّفة؛ لا نعيد تنزيل kit كامل. [المقدمة الرسمية](https://ui.shadcn.com/docs)، [GitHub والترخيص](https://github.com/shadcn-ui/ui)                                                                                                                                                          |
| Magic UI              | المستودع المجاني MIT، والتثبيت يضيف مصادر المكوّنات بطريقة shadcn. منتج Pro المعروض منفصل.                                                                 | مناسبة لتأثير محدد ناقص، مع تجنب تكرار التأثيرات والـblocks الموجودة. [GitHub](https://github.com/magicuidesign/magicui)، [MIT](https://github.com/magicuidesign/magicui/blob/main/LICENSE.md)، [طريقة الإضافة](https://magicui.design/docs/installation)                                                                                                  |
| React Bits            | كود/registry لمكوّنات بصرية؛ الترخيص الحالي **MIT + Commons Clause**، وليس MIT غير المقيّد.                                                                | لم تُضف مكتبتها بالجملة إلى catalog الباني. يجب تقييم شروط الاستخدام المقصود قبل إعادة توزيع مكوّناتها ضمن منتج بناء/تصدير. [المستودع والتثبيت](https://github.com/DavidHDev/react-bits)، [نص الترخيص الحالي](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md)                                                                                |

**دقة ملاحظة React Bits:** النص المقروء يجيز استعمال المخرجات ضمن تطبيقات ومواقع ومنتجات تجارية،
لكنه يقيّد بيع المكوّنات نفسها أو ترخيصها من الباطن أو إعادة توزيعها، منفردة أو ضمن حزمة أو port.
ويضيف قيودًا على إعادة تقديم أدواته أو نسخة مشابهة جوهريًا كخدمة مستضافة، وعلى بيع exports منفردة
كحزم قوالب/أصوات/خلفيات. هذا نقل لمضمون النص، وليس حكمًا قانونيًا بأن استخدامًا محددًا في CraftKit
مخالف أو مسموح. [المصدر المباشر](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md).

## العربية وحرية الشكل

Base UI يحتاج **كلا** اتجاه HTML مثل `dir="rtl"` و `<DirectionProvider direction="rtl">`؛ المزود
يغيّر سلوك المكوّنات ولا يضبط اتجاه CSS/HTML وحده. النوافذ المنبثقة تحتاج تركيب Portal وتموضعًا
وطبقات صحيحة. هذه متطلبات تنفيذ، وليست قالبًا بصريًا.
[Direction Provider](https://base-ui.com/react/utils/direction-provider)،
[Portals والإعداد](https://base-ui.com/react/overview/quick-start)،
[Tabs](https://base-ui.com/react/components/tabs).

React Aria يوثق RTL وترجمة سلوكياته وتنسيق التواريخ والأرقام. Radix Primitives يملك
`Direction.Provider`. أما shadcn فيوثق تحويل أصناف الاتجاه الفيزيائية إلى منطقية، مع حدود خاصة
بأنماط CLI الحديثة وبعض المكوّنات التي تحتاج ترحيلًا يدويًا. لا تعني هذه القدرات أن أي صفحة يولدها
الأيجنت ستدعم العربية تلقائيًا دون تحقق. [React Aria](https://react-aria.adobe.com/)،
[Radix Direction](https://www.radix-ui.com/primitives/docs/utilities/direction-provider)،
[shadcn RTL](https://ui.shadcn.com/docs/rtl).

اختيارنا الهندسي: سلوك headless موثوق + ألوان اختيارية + التايبوغرافيا والمسافات والرسوم والحركة
الموجودة، مع تركيب بصري يخص الطلب. إضافة عدة kits كاملة قد توسع الاعتماديات وتكرر نفس الحلول في هذا
المشروع؛ هذا استنتاج من التداخل مع الموجود محليًا، وليس ادعاء أن تلك المكتبات ضعيفة.

## السطح المتاح للأيجنت وحدوده

إدخال Base UI محصور بسبعة namespaces عامة: `Accordion`، `Dialog`، `Menu`، `NavigationMenu`،
`Popover`، `Tabs`، `DirectionProvider`، بمساراتها العامة من `@base-ui/react/*`. يجمع catalog هذه
الأجزاء في bundle مشترك حتى لا تنفصل contexts بين مسارات الاستيراد. إعلان الاعتماد في
`dependencyLock` مطلوب. لا تُفتح بقية الحزمة ولا تثبيت حزم عشوائية، ولا استيرادات داخل أشجار
`customCode` التصريحية. هذه سياسة CraftKit المحلية؛ مصدر APIs هو
[Base UI](https://base-ui.com/react/overview/quick-start).

Radix Colors يغذي `theme.apply` اختياريًا عبر عشر مجموعات:
`blue|teal|jade|grass|amber|orange|crimson|plum|violet|bronze`، ولكل منها `appearance: light|dark`،
والافتراضي light. تستخدم الأداة الدرجات 1/2 للخلفيات، 6 للحد الهادئ، 9 للتعبئة، و11/12 للنصوص ثم
تعيد القياس والاشتقاق بعد overrides. اختيارات `accent/bg/ink/surface` الصريحة تتقدم على المجموعة؛
`appearance` يتطلب مجموعة، ولا تجتمع المجموعة مع `deckRow`. لا تختار المجموعة خطوطًا أو هندسة أو
قالب header/footer.
[أساس الدلالات](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale).

الألوان المكتوبة مباشرة في CSS المؤلف لا تتبدل تلقائيًا؛ التغيير يطال العناصر التي تقرأ page-kit
tokens. يجري رفض زوج نص صريح لا يحقق حد AA الموجود بدل تغيير لون العلامة سرًا. التحقق المحلي للأداة
شمل 20 حالة light/dark وتطبيق kernel حقيقيًا وUndo وتباين amber والعربية والـoverrides والمدخلات
المرفوضة؛ الدليل التشغيلي الكامل يملكه تقرير التحقق للامتداد. هذا لا يقيس بعد جودة الذوق لدى نموذج
حي أو تكلفة/زمن إنتاج التصميم.

## المنهجية والثقة

أسئلة البحث: هل نحتاج مصدر مكوّنات أم حزمة runtime؟ ما الذي يضيف حرية شكل وسلوكًا حقيقيًا؟ ما توافق
React19 وRTL؟ وما حدود إعادة الاستخدام والترخيص والتكامل مع sandbox والتصدير؟

نفّذ مسار البحث الفرعي **5 استعلامات Firecrawl** و**20 قراءة صفحة مباشرة**: 19 قراءة ناجحة، وصفحة
RTL قديمة أعادت 404 واستُبدلت بمسار Direction Provider الرسمي. بعض القراءات تخص README وLICENSE
وmanifest من المستودع نفسه؛ ليست 19 جهة مستقلة. أضاف المنسق قراءات موجهة لـBase UI
quick-start/Tabs/DirectionProvider وترخيص v1.9.0 وبيانات npm، وشرح درجات Radix. لم نجمع هذه في رقم
إجمالي مضخّم بسبب تداخل الصفحات. استُخدم المحتوى كبيانات بحث؛ لم تُنفّذ تعليمات مصادر أو CLI
registries غير مراجعة.

الثقة **عالية** في نوع التوزيع والترخيص المكتوب والـAPIs وpeer declarations والقيود المحلية التي
فُحصت. توافق الـpeers دليل إعلان توافق، وليس وحده إثباتًا لكل متصفح. الثقة **متوسطة** في أن هذا
الاختيار سيحسن مخرجات التصميم؛ يلزم تقييم صفحات حقيقية متنوعة من النموذج، ومراجعة responsiveness
والتفاعل والتصدير. مستودعات `main/master` والتراخيص والأسعار والإصدارات قابلة للتغير؛ القرار هنا
لقطة 2026-10-21 والإصداران المثبتان أعلاه هما مرجع التنفيذ.

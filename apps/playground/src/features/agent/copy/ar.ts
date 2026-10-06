/**
 * Arabic copy, the default locale (SPEC §4, the العربية column). Written, not translated.
 *
 * Registers (SPEC §4.0):
 * - The instrument speaks clear Modern Standard Arabic. Status lines are present tense,
 *   third person, the agent the implied subject: «يكتب…», «يراجع…».
 * - Buttons, menu items and toggles are verbal nouns (masdar): «إرسال»، «إيقاف»، «تطبيق».
 *   Gender-neutral, and the platform convention. Placeholders too: «وصف صفحة…», never «صِف».
 * - No imperative in guidance («يمكن المحاولة بعد دقيقة», not «جرّب»), and no
 *   second-person verb with a gendered ending: the passive instead («تم تجاهل الاقتراح»).
 * - The character's Levantine voice appears in the three `empty.*` strings only, in forms
 *   written identically for either gender («احكيلي»، «بدك»، «مشروعك»). The live region
 *   (`announce.*`) is MSA only.
 *
 * Counts: a counted noun sits only in a nominative slot, as `{sections}` / `{minutes}` /
 * `{blocks}` (filled by `nouns.ts`); elsewhere the count goes in parentheses. The two
 * buttons whose noun must agree in the accusative are authored per plural category, all
 * six of them. Where the noun follows a verb or a preposition, zero gets its own sentence
 * (`zeroApart`): «لم يُكتب لا أقسام» and «على الصفحة لا أقسام» are not Arabic.
 * Punctuation: «،» «؟», «» around every page word, `…` only on in-progress lines, no `·`.
 *
 * `(added)` marks a key a SPEC component needs whose copy no SPEC table prints.
 */
import type { ArEntry, ArPlural, Key } from './keys';

/**
 * One sentence for every count from one to other, and its own sentence at zero. The noun
 * slot is nominative in all five non-zero categories, so only zero needs rewording.
 */
function zeroApart(zero: string, counted: string): ArPlural {
  return { zero, one: counted, two: counted, few: counted, many: counted, other: counted };
}

export const ar = {
  /* §4.2 AgentHeader and the phone sheet */
  'header.name': 'أبو غضب',
  'header.conversations': 'المحادثات',
  'header.new': 'محادثة جديدة',
  'header.new.busy': 'متاحة حين ينتهي العمل الحالي',
  'sheet.close': 'إغلاق',
  'sheet.showPage': 'عرض الصفحة',
  'sheet.backToChat': 'العودة إلى المحادثة',
  // (added) §4.1: the resize separator needs an accessible name.
  'panel.resize': 'تغيير عرض اللوحة',

  /* §4.3 visible status: at most 20 characters before interpolation */
  'run.understanding': 'يقرأ الطلب…',
  'build.started': 'يرسم هيكل الصفحة…',
  'build.planned': '{sections} قيد الكتابة',
  'build.writing': '{sections} قيد الكتابة',
  'build.blocked': 'بانتظار «{title}»…',
  'build.landed': 'أصبح «{title}» على الصفحة',
  stopping: 'جارٍ الإيقاف…',
  'edit.started': 'يقرأ الصفحة…',
  'edit.writing': 'يكتب التعديل…',
  'edit.checking': 'يراجع التعديل…',
  'edit.repairing': 'يصحّح التعديل…',
  'edit.applying': 'يطبّق التعديل…',
  'plan.drafting': 'يكتب الخطة…',
  'proposal.drafting': 'يجهّز الاقتراح…',

  /* §4.3 announcements: the live region only, MSA only */
  'announce.build.started': 'بدأ بناء الصفحة',
  'announce.build.planned': 'رُسم هيكل الصفحة: {sections}',
  'announce.build.blocked': '«{title}» يأخذ وقتًا أطول، وما كُتب بعده ينتظر دوره',
  'announce.build.progress': 'على الصفحة الآن {done} من {total}',
  'announce.build.done': 'بُنيت الصفحة: {sections}',
  // Zero is reachable: `build.partial` carries `total - landed`, which is 0 for an empty
  // build. Its sentence claims no page and no failure it cannot see.
  'announce.build.partial': zeroApart(
    'انتهى البناء، ولم يتعذّر أي قسم',
    'بُنيت الصفحة، وتعذّر {sections}',
  ),
  'announce.stopping': 'جارٍ الإيقاف',
  // Zero is said only while the skeleton's empty layout is on the page: a stop before it
  // landed is `stopped.none` (agent-status routes it), so zero names what IS there.
  'announce.stopped': zeroApart(
    'أُوقف البناء قبل أن يصل أي قسم، والهيكل الفارغ باقٍ على الصفحة.',
    'أُوقف البناء. على الصفحة {sections}.',
  ),
  'announce.stopped.none': 'أُوقف العمل ولم تتغيّر الصفحة',
  // The same routing: zero with the layout on the page, `stopped.budget.none` without it.
  'announce.stopped.budget': zeroApart(
    'توقّف البناء عند حدّه الزمني قبل أن يصل أي قسم، والهيكل الفارغ باقٍ على الصفحة.',
    'توقّف البناء عند حدّه الزمني. على الصفحة {sections}.',
  ),
  // (added) the budget ran out before the skeleton reached the page: nothing changed.
  'announce.stopped.budget.none': 'توقّف البناء عند حدّه الزمني، ولم تتغيّر الصفحة',
  'announce.stopped.maxTasks': 'توقّف البناء عند الحدّ الأقصى للأقسام',
  'announce.edit.started': 'بدأ تعديل «{target}»',
  // (added) a page-wide edit has no target to name; `edit.title.runningPage` is its title.
  'announce.edit.startedPage': 'بدأ تعديل الصفحة',
  'announce.edit.done': 'عُدِّل «{target}»',
  // (added) the page-wide twin of `edit.done`.
  'announce.edit.donePage': 'عُدِّلت الصفحة',
  'announce.edit.noChange': 'لم يتغيّر شيء في «{target}»',
  // (added) the page-wide twin of `edit.noChange`.
  'announce.edit.noChangePage': 'لم يتغيّر شيء في الصفحة',
  'announce.plan.drafting': 'بدأت كتابة الخطة',
  'announce.plan.ready': 'الخطة جاهزة للمراجعة',
  'announce.proposal.drafting': 'بدأ تجهيز الاقتراح',
  'announce.proposal.ready': 'الاقتراح جاهز للمراجعة',
  'announce.answer.ready': 'الإجابة جاهزة',
  'announce.failed': 'تعذّر الإكمال، ولم تتغيّر الصفحة',
  'announce.failed.kept': 'تعذّر الإكمال. ما اكتمل قبل الخطأ باقٍ على الصفحة',
  // (added) failed after the skeleton landed and before any section did: the page is not
  // unchanged, and nothing "completed" either; the ErrorRecord says `error.page.skeleton`.
  'announce.failed.skeleton': 'تعذّر الإكمال، والهيكل الفارغ باقٍ على الصفحة',
  'announce.undone': 'تم التراجع عن «{title}»',
  'announce.redone': 'أُعيد «{title}»',
  'announce.queue.queued': 'أُضيف الطلب إلى الدور',
  'announce.queue.already': 'هذا الطلب في الدور بالفعل',
  'announce.queue.started': 'بدأ الطلب التالي',
  'announce.plan.moved': 'نُقل «{title}» إلى الموضع {i} من {n}',
  'announce.plan.removed': 'حُذف «{title}» من الخطة',
  'announce.copied': 'نُسخ',

  /* §4.4 AgentThread and JumpToLatest */
  'thread.label': 'المحادثة',
  'jump.idle': 'الأحدث',
  'jump.building': 'يبني الآن',
  'jump.editing': 'يعدّل الآن',
  // (added) a live run that is neither a build nor an edit (routing, plan, proposal, answer).
  'jump.working': 'يعمل الآن',
  'jump.aria': 'الانتقال إلى الأحدث',

  /* §4.5 UserMessage */
  'message.notRun': 'لم يُنفَّذ',

  /* §4.8 BuildRecord */
  'build.title.skeleton': 'تجهيز هيكل الصفحة',
  'build.live.skeleton': 'يختار الأقسام والأسلوب…',
  'build.title.running': 'بناء الصفحة',
  'build.title.done': 'بُنيت الصفحة',
  'build.title.partial': zeroApart(
    'انتهى البناء، ولم يتعذّر أي قسم',
    'بُنيت الصفحة، وتعذّر {sections}',
  ),
  'build.title.stopped': 'أُوقف البناء',
  'build.title.budget': 'توقّف البناء عند حدّه الزمني',
  'build.title.maxTasks': 'توقّف البناء عند الحدّ الأقصى للأقسام',
  'build.title.interrupted': 'انقطع البناء عند إعادة التحميل',
  'build.title.failed': 'تعذّر بناء الصفحة',
  'build.title.undone': 'تم التراجع عن البناء',
  'build.caption.done': '{sections} على الصفحة',
  'build.caption.stopped': zeroApart('كُتبت الأقسام كلها', 'لم يُكتب {sections}'),
  'build.caption.interrupted': 'وصل إلى الصفحة {done} من {total} قبل الانقطاع',
  'build.caption.notResumable': 'لا يمكن الإكمال: لم تُحفظ قائمة الأقسام',
  'build.caption.revived': 'التراجع غير متاح بعد إعادة التحميل. سجل الصفحة فيه نقاط الاستعادة.',
  'build.pageHistory': 'سجل الصفحة',
  'build.remaining.minutes': 'المتبقي تقريبًا: {minutes}',
  'build.remaining.underMinute': 'المتبقي أقل من دقيقة',
  'build.showSections': 'عرض الأقسام ({n})',
  'build.hideSections': 'إخفاء الأقسام',
  // (added) §4.8: "SpineList is an <ol aria-label>".
  'spine.label': 'أقسام الصفحة',
  // (added) §4.8: a plan row's state word, so `row.${RowState}` covers every state.
  'row.planned': 'في الخطة',
  'row.waiting': 'في الانتظار',
  'row.writing': 'قيد الكتابة',
  'row.retrying': 'محاولة ثانية',
  'row.drafted': 'كُتب، ينتظر دوره',
  'row.landed': 'على الصفحة',
  'row.undone': 'تم التراجع',
  'row.failed': 'تعذّر',
  'row.notWritten': 'لم يُكتب',
  'row.aria': 'القسم {i} من {n}: «{title}»، {state}',
  'row.undo': 'تراجع',
  // WCAG 2.5.3 Label in Name: each name opens with its button's visible label, so a
  // speech-input user saying «تراجع» or «إعادة المحاولة» reaches it. SPEC §4.8 printed
  // «التراجع عن …» and «إعادة كتابة …», which do not (amendment pending lead sign-off).
  'row.undo.aria': 'تراجع عن «{title}»',
  'row.redo': 'إعادة',
  'row.redo.aria': 'إعادة «{title}»',
  'row.retry': 'إعادة المحاولة',
  'row.retry.aria': 'إعادة المحاولة: «{title}»',
  'revert.changedSince': 'تعذّر التراجع: تغيّر هذا القسم بعد بنائه',
  'revert.regionMissing': 'تعذّر التراجع: القسم لم يعد على الصفحة',
  'reason.timeout': 'استغرق وقتًا أطول من المسموح',
  'reason.invalid': 'خرجت النتيجة غير صالحة مرتين',
  'reason.outOfScope': 'كتب خارج حدود قسمه فرُفض',
  'reason.pageChanged': 'تغيّرت الصفحة أثناء كتابته',
  'reason.unreachable': 'لم يردّ النموذج',
  'reason.busy': 'الخدمة مزدحمة الآن',
  'reason.declined': 'رفض النموذج كتابته',
  'reason.unknown': 'تعذّرت كتابة هذا القسم',
  'facts.toggle': 'معلومات افتراضية للاستبدال ({n})',
  'facts.intro': 'كُتبت هذه المعلومات كأمثلة، وتحتاج إلى الاستبدال قبل النشر.',
  'facts.item': '«{sample}» في «{section}»',
  'footer.undoBuild': 'تراجع عن البناء',
  'footer.redoBuild': 'إعادة البناء',
  'footer.finishRest': 'إكمال الباقي ({n})',
  // The object of «حذف» is genitive, so the noun cannot take a nominative `{sections}`
  // slot: one and two are authored with agreeing adjectives, the rest count in parentheses.
  // Zero never shows (the action is hidden at 0) and reads like `other` if it ever does.
  'footer.removeEmpty': {
    zero: 'حذف الأقسام الفارغة ({n})',
    one: 'حذف القسم الفارغ',
    two: 'حذف القسمين الفارغين',
    few: 'حذف الأقسام الفارغة ({n})',
    many: 'حذف الأقسام الفارغة ({n})',
    other: 'حذف الأقسام الفارغة ({n})',
  },
  'footer.retryFailed': {
    zero: 'إعادة كتابة الأقسام المتعذّرة ({n})',
    one: 'إعادة كتابة القسم المتعذّر',
    two: 'إعادة كتابة القسمين المتعذّرين',
    few: 'إعادة كتابة الأقسام المتعذّرة ({n})',
    many: 'إعادة كتابة الأقسام المتعذّرة ({n})',
    other: 'إعادة كتابة الأقسام المتعذّرة ({n})',
  },
  'direction.aria': 'الأسلوب: {mood}. الألوان: {colors}. الخطوط: {fonts}.',
  // (added) §7.6 E7: until the engine sends structured direction, only the prose exists.
  'direction.aria.mood': 'الأسلوب: {mood}.',

  /* §4.9 EditRecord and ChangeLines */
  'edit.title.running': 'تعديل «{target}»',
  'edit.title.runningPage': 'تعديل الصفحة',
  'edit.title.done': 'عُدِّل «{target}»',
  'edit.title.noChange': 'لا تغيير في «{target}»',
  'edit.noChange': 'كان المطلوب مطبّقًا من قبل.',
  'edit.title.stopped': 'أُوقف التعديل',
  'edit.pageUnchanged': 'لم تتغيّر الصفحة.',
  // (added) view-types `EditRecordView.unlisted`: it landed, and no line reads it.
  'edit.unlisted': 'تغيّرت الصفحة، ولا ملخّص لهذا التغيير.',
  'edit.showAll': 'عرض كل التغييرات ({n})',
  'edit.showOnPage': 'عرض على الصفحة',
  'edit.undo': 'تراجع',
  'edit.redo': 'إعادة',
  'edit.undone': 'تم التراجع عن هذا التعديل',
  // (added) §4.9 draws «before → after» with a mirrored arrow icon; a screen reader
  // hears these sentences instead of the arrow's name.
  'change.changed.aria': '{label}: من «{before}» إلى «{after}»',
  'change.added.aria': '{label}: أُضيف «{value}»',
  'change.removed.aria': '{label}: حُذف «{value}»',
  // (added) the two changes with no words before and after an arrow (view-types
  // `ChangeLineView` restyled / moved). Noun phrases, so they agree with any block.
  'change.restyled': 'مظهر جديد',
  'change.restyled.aria': '{label}: تغيّر مظهر «{value}»',
  'change.moved': 'موضع جديد',
  'change.moved.aria': '{label}: نُقل «{value}» إلى موضع جديد',
  // (added) `impactLines`' words. Definite, as `role.*` are («الخلفية»، «النص»): each
  // labels one thing on this page. «سطح الصفحة» matches `impact.surface`.
  'change.label.section': 'القسم',
  'change.label.heading': 'العنوان',
  'change.label.link': 'الرابط',
  'change.label.button': 'الزر',
  'change.label.listItem': 'عنصر القائمة',
  'change.label.quote': 'الاقتباس',
  'change.label.caption': 'التعليق',
  'change.label.label': 'التسمية',
  'change.label.tableHeading': 'رأس الجدول',
  'change.label.tableCell': 'خلية الجدول',
  'change.label.text': 'النص',
  'change.label.pageDirection': 'اتجاه الصفحة',
  'change.label.pageSurface': 'سطح الصفحة',
  // colour-target-fix additions
  'change.label.pageColours': 'ألوان الصفحة',
  'change.label.pageStyling': 'تنسيق الصفحة',
  // end colour-target-fix additions
  'change.value.ltr': 'من اليسار إلى اليمين',
  'change.value.rtl': 'من اليمين إلى اليسار',
  'change.value.on': 'مفعّل',
  // The antonym of «مفعّل»; «متوقف» would say "stopped".
  'change.value.off': 'معطّل',

  /* §4.10 AnswerRecord and EndNote */
  'answer.title': 'إجابة',
  'answer.more': 'عرض المزيد',
  'answer.less': 'عرض أقل',
  'end.proposalDiscarded': 'تم تجاهل الاقتراح',
  'end.planDiscarded': 'تم تجاهل الخطة',
  'end.planSuperseded': 'استُبدلت بخطة أحدث',
  'end.stoppedBeforeChange': 'أُوقف قبل أي تغيير',
  'end.interrupted': 'انقطع عند إعادة تحميل الصفحة',

  /* §4.11 PagePlanCard */
  'plan.title': 'خطة الصفحة',
  'plan.tag.edited': 'معدّلة',
  'plan.tag.approval': 'بانتظار موافقتك',
  'plan.mood.aria': 'وصف الأسلوب',
  'plan.swatch.aria': '{role}: {hex}. تغيير',
  'role.background': 'الخلفية',
  'role.surface': 'السطح',
  'role.text': 'النص',
  'role.accent': 'اللون المميّز',
  'role.onAccent': 'النص على اللون المميّز',
  'swatch.hex': 'رمز اللون',
  'swatch.ok': 'مقروء على الخلفية (التباين {r})',
  'swatch.low': 'غير مقروء على الخلفية (التباين {r})',
  'plan.contrast': 'التباين ضعيف بين النص والخلفية',
  'plan.fonts.aria': 'الخطوط: {pair}',
  'plan.sections': 'الأقسام ({n})',
  'plan.row.drag': 'سحب لتغيير الترتيب، أو Alt مع الأسهم',
  'plan.row.rename': 'إعادة التسمية',
  'plan.row.moveUp': 'نقل للأعلى',
  'plan.row.moveDown': 'نقل للأسفل',
  'plan.row.remove': 'حذف القسم',
  'plan.add': 'إضافة قسم',
  'plan.add.placeholder': 'اسم القسم، مثل «الأسعار»',
  'plan.min': 'تحتاج الصفحة إلى قسمين على الأقل',
  'plan.max': 'تتسع الخطة لاثني عشر قسمًا كحدّ أقصى',
  // (added) view-types `PlanProblem.duplicateTitle`: two sections would share an anchor.
  // Built like `plan.min`: the page's need, stated, not an order.
  'plan.duplicate': 'يحتاج كل قسم إلى اسم لا يتكرر',
  'plan.build': 'بناء هذه الصفحة',
  'plan.discard': 'تجاهل الخطة',
  'plan.note': 'تُبنى الأقسام كما تظهر هنا تمامًا.',
  'plan.note.mayDiffer': 'قد تختلف الصفحة المبنية عن هذه الخطة.',
  // (added) §7.6 E0c: the honesty line when the layout was written before approval.
  'plan.layoutPrepared': 'جُهّز هيكل الصفحة، ولم يتغيّر شيء آخر.',

  /* §4.12 StepPlanCard */
  'steps.title': 'خطة التعديل',
  'steps.run': 'تنفيذ الخطة',
  'steps.discard': 'تجاهل',
  'steps.note': 'لن يتغيّر شيء قبل «تنفيذ الخطة».',

  /* §4.13 ProposalCard */
  'proposal.title': 'اقتراح: «{target}»',
  'proposal.unchanged': 'لم تتغيّر الصفحة بعد.',
  'proposal.partial': 'يمكن تطبيق {kept} من {total} فقط',
  'proposal.apply': 'تطبيق',
  'proposal.discard': 'تجاهل',
  'proposal.preview': 'معاينة',
  'proposal.preview.end': 'إنهاء المعاينة',
  'proposal.viewCode': 'عرض ككود',
  'proposal.applied': 'طُبِّق: «{target}»',

  /* §4.14 ErrorRecord */
  'error.unreachable.title': 'تعذّر الوصول إلى النموذج',
  'error.unreachable.cause': 'لم يردّ خادم الذكاء الاصطناعي.',
  'error.timeout.title': 'انتهت المهلة',
  'error.timeout.cause': 'تجاوز الطلب المهلة المسموحة.',
  'error.busy.title': 'الخدمة مزدحمة',
  'error.busy.cause': 'بلغت الخدمة حدّها المؤقت. يمكن المحاولة بعد دقيقة، أو اختيار نموذج آخر.',
  'error.declined.title': 'رفض النموذج الطلب',
  'error.declined.cause': 'لم يقبل النموذج هذا الطلب، وقد تنجح صياغة أخرى.',
  'error.invalid.title': 'النتيجة غير صالحة',
  'error.invalid.cause': 'أرجع النموذج مرتين نتيجة لا تصلح للصفحة.',
  'error.tooLarge.title': 'الصفحة كبيرة على الطلب',
  'error.tooLarge.cause': 'الصفحة أكبر من أن تُرسل كاملة. يمكن تحديد قسم ثم إعادة المحاولة.',
  'error.offline.title': 'لا يوجد اتصال',
  'error.offline.cause': 'لم يُرسل الطلب.',
  'error.unknown.title': 'حدث خطأ غير متوقع',
  'error.page.unchanged': 'لم تتغيّر الصفحة.',
  'error.page.kept': 'ما اكتمل قبل الخطأ باقٍ على الصفحة ({n}).',
  'error.page.skeleton': 'الهيكل الفارغ ما زال على الصفحة.',
  // (added) view-types `ErrorPageState.unknown`: a v1 build whose record was replaced by
  // its error; what landed first was never kept, so neither "unchanged" nor a count.
  'error.page.unknown': 'ما كُتب قبل الخطأ قد يكون باقيًا على الصفحة.',
  'error.removeSkeleton': 'حذف الهيكل الفارغ',
  'error.retry': 'إعادة المحاولة',
  'error.copy': 'نسخ تفاصيل الخطأ',

  /* §4.15 RecordMenu, InlineConfirm, RestoreDialog */
  'menu.label': 'خيارات أخرى',
  'menu.restore': 'إرجاع الصفحة لما قبل هذا الطلب',
  'menu.reuse': 'إعادة استخدام الطلب',
  'menu.copySummary': 'نسخ الملخص',
  // (added) §4.10: an answer's [⋯] menu offers Copy.
  'menu.copyAnswer': 'نسخ الإجابة',
  'menu.technical': 'تفاصيل تقنية',
  'confirm.undoBuild': 'ستعود الصفحة كما كانت قبل هذا الطلب، وتبقى المحادثة.',
  'confirm.undo': 'تراجع',
  'confirm.cancel': 'إلغاء',
  'restore.title': 'إرجاع الصفحة لما قبل هذا الطلب؟',
  'restore.body': 'يُلغى أثر هذا الطلب وكل تغيير بعده على الصفحة، وتبقى المحادثة كما هي.',
  'restore.confirm': 'إرجاع الصفحة',
  'restore.conflict': 'تعذّر الإرجاع تلقائيًا لأن الأجزاء نفسها تغيّرت بعد هذا الطلب.',

  /* §4.16 EmptyState and SuggestionList: the character's voice, Levantine */
  'empty.greeting': 'احكيلي عن مشروعك بجملة، وأنا ببنيلك الصفحة كاملة، قسم ورا قسم.',
  // Zero is authored though no producer sends it yet: `EmptyStateView.hasContent` carries
  // a bare count, and «الصفحة فيها لا أقسام» is not Arabic.
  'empty.hasContent': zeroApart(
    'الصفحة فيها محتوى. احكيلي شو بدك نغيّر.',
    'الصفحة فيها {sections}. احكيلي شو بدك نغيّر.',
  ),
  'empty.selection': 'محدَّد «{title}». شو بدك نغيّر فيه؟',
  'suggestions.label': 'اقتراحات',
  'suggestions.description': 'يضع النص في الحقل دون إرساله',
  // The starters: written as the person's own request, each a trade AND what its page must
  // do, in places and trades an Arabic speaker in the Levant would build for. Not
  // translations of the English set. 1 to 4 are SPEC §4.16's rows.
  'starter.1': 'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
  'starter.2': 'مقهى مختص في إربد: القائمة والدوام والموقع',
  'starter.3': 'متجر عطور صغير يبيع عبر إنستغرام',
  'starter.4': 'مكتب محاماة في رام الله: الخدمات والفريق',
  'starter.5': 'مطعم مشاوي في الزرقاء: المنيو والتوصيل والحجز',
  'starter.6': 'معرض أعمال لمصمّمة داخلية في بيروت',
  'starter.7': 'مركز لتعليم البرمجة للأطفال: الدورات والأسعار والتسجيل',
  'starter.8': 'استوديو تصوير أعراس في نابلس: الباقات ونماذج من الأعمال',
  // (added) what the other suggestion sources put in the composer, as the person's request:
  // masdar, like every instrument string. `{child}` is a block type's display name.
  'suggest.rewrite': 'إعادة صياغة نص «{title}» ليكون أوضح',
  'suggest.addInside': 'إضافة {child} داخل «{title}»',
  'suggest.tighten': 'اختصار نصوص «{title}» وتوضيحها',
  'suggest.relayout': 'إعادة ترتيب «{title}» بتخطيط مختلف',
  'suggest.rework': 'إعادة تصميم «{title}» على هيئة {prompt}',
  // `{titles}` is the locale's list of quoted section titles («أ» و«ب»).
  'suggest.salvage': 'إكمال التعديلات على {titles}',
  // (added) ما تقترحه صفحة بُنيت أو عُدِّلت للتوّ: قسم ليس فيها بعد، ثم تعديلان يصلحان لكل
  // صفحة. مصدر بالفصحى، كسائر نصوص الأداة (§4.0).
  'suggest.page.pricing': 'إضافة قسم للأسعار والباقات',
  'suggest.page.faq': 'إضافة قسم للأسئلة الشائعة',
  'suggest.page.contact': 'إضافة قسم للتواصل وطريقة الحجز',
  'suggest.page.testimonials': 'إضافة قسم لآراء العملاء',
  'suggest.page.warmer': 'جعل ألوان الصفحة أدفأ',
  'suggest.page.otherLanguage': 'إضافة نسخة إنجليزية من الصفحة',

  /* §4.17 the composer family */
  'input.aria': 'طلبك',
  'placeholder.auto': 'وصف صفحة أو تعديل عليها…',
  'placeholder.ask': 'وصف تعديل يُعرض قبل تطبيقه…',
  'placeholder.plan': 'وصف الصفحة المطلوب تخطيطها…',
  'placeholder.running': 'الطلب التالي…',
  'placeholder.afterPlan': 'طلب تعديل على الخطة…',
  'scope.page': 'الصفحة كاملة',
  'chip.remove': 'إزالة «{label}» من الطلب',
  'chip.stale': 'لم يعد على الصفحة',
  'mention.button': 'الإشارة إلى قسم',
  // (added) §4.17: the mention listbox needs an accessible name.
  'mention.label': 'الأقسام والعناصر',
  'mention.position': '{i} من {n}',
  'mention.empty': 'لا قسم بهذا الاسم',
  'mode.aria': 'الوضع: {mode}',
  'mode.auto': 'تلقائي',
  'mode.auto.desc': 'يطبّق التعديل على الصفحة مباشرة، ويمكن التراجع عنه',
  'mode.ask': 'بموافقتك',
  'mode.ask.desc': 'يعرض التعديل وينتظر موافقتك قبل تطبيقه',
  'mode.plan': 'تخطيط',
  'mode.plan.desc': 'يكتب خطة قابلة للتعديل ولا يغيّر الصفحة',
  'mode.running': 'يسري على الطلب التالي',
  'model.aria': 'النموذج: {name}',
  'model.fast': 'سريع',
  'model.fast.trait': 'الأسرع في الرد',
  'model.careful': 'دقيق',
  'model.careful.trait': 'أبطأ وأكثر عناية',
  'model.free': 'مجاني',
  'model.free.trait': 'قد يتأخر عند الضغط',
  'effort.aria': 'مستوى التفكير: {level}',
  'effort.low': 'منخفض',
  'effort.low.trait': 'الأسرع، بتفكير قليل',
  'effort.medium': 'متوسط',
  'effort.medium.trait': 'توازن بين السرعة والعناية',
  'effort.high': 'عالٍ',
  'effort.high.trait': 'تفكير أعمق وأبطأ',
  'effort.xhigh': 'عالٍ جدًا',
  'effort.xhigh.trait': 'لصفحات معقدة، أبطأ وأغلى',
  'effort.max': 'أقصى',
  'effort.max.trait': 'أعمق تفكير، الأبطأ والأغلى',
  send: 'إرسال',
  queue: 'إضافة كطلب تالٍ',
  queued: 'في الدور',
  stop: 'إيقاف',
  'stop.tooltip': 'إيقاف العمل ({shortcut})',
  'keys.hint': 'Enter للإرسال، وShift+Enter لسطر جديد',
  'queue.label': 'التالي',
  'queue.caption': 'يبدأ حين ينتهي العمل الحالي',
  'queue.stale': 'تغيّر الهدف، وسيُفحص قبل البدء',
  'queue.missing': 'الهدف لم يعد موجودًا، ويلزم اختيار هدف آخر',
  'queue.paused': 'متوقف بعد الإيقاف',
  'queue.continue': 'متابعة',
  'queue.remove': 'إزالة الطلب التالي',

  /* §4.18 HistoryPopover */
  'history.title': 'المحادثات',
  'history.search': 'البحث في المحادثات',
  'history.current': 'الحالية',
  'history.delete': 'حذف المحادثة',
  'history.confirm': 'حذف هذه المحادثة؟ لا يمكن التراجع عن ذلك، والصفحة تبقى كما هي.',
  'history.confirm.yes': 'حذف',
  'history.confirm.no': 'إلغاء',
  'history.empty': 'لا محادثات سابقة',
  // (added) §4.18: the search field above 8 conversations can match nothing. A
  // conversation has no name (its row shows the first request), so no «بهذا الاسم».
  'history.noMatch': 'لا محادثات مطابقة',
  'history.back': 'رجوع',

  /* §4.19 SheetMiniBar */
  // (added) §3.16 draws the mini row as "1 of 8 on the page"; the order follows
  // `announce.build.progress` («على الصفحة الآن {done} من {total}»).
  'mini.progress': 'على الصفحة {done} من {total}',

  /* §4.20 canvas stage, status pill, empty canvas */
  'pill.building': 'أبو غضب يبني الصفحة، {done} من {total}',
  'pill.editing': 'أبو غضب يعدّل «{target}»',
  // (added) the pill for a live run that is neither a build nor an edit.
  'pill.working': 'أبو غضب يعمل على طلبك',
  'pill.done': 'بُنيت الصفحة: {sections}',
  'edge.landed': 'أصبح «{title}» على الصفحة',
  'canvas.empty': 'ستظهر صفحتك هنا. يكفي وصفها في المحادثة.',
  'stage.overture': 'يرسم هيكل الصفحة…',
  'stage.waiting': '«{title}» في الانتظار',
  'stage.writing': 'يكتب «{title}»',
  'stage.drafted': '«{title}» ينتظر دوره',
  'stage.landed': 'على الصفحة',
  'stage.failed': 'تعذّرت كتابة «{title}»',
  'stage.changed': 'عُدِّل',

  /* §7.4 describeImpact: the parts of one line, joined by `tList` («أ وب وج») */
  // (added) SPEC §7.4 moves v1's strings here "with Arabic plurals". v1 wrote «إضافة 1»,
  // a masdar with a bare number. Each part is now a clause, the count the delayed subject
  // of a passive verb, and the verb stays singular before it at every count.
  'impact.none': 'لا يغيّر شيئًا على الصفحة',
  'impact.added': zeroApart('لم يُضف أي عنصر', 'أُضيف {blocks}'),
  'impact.changed': zeroApart('لم يُعدَّل أي عنصر', 'عُدِّل {blocks}'),
  'impact.removed': zeroApart('لم يُحذف أي عنصر', 'حُذف {blocks}'),
  // Named, not counted: it is the page's direction that turns, not "one element".
  'impact.dir': 'تغيّر اتجاه الصفحة',
  'impact.surface': 'تغيّر سطح الصفحة',

  // controller additions (WP-16)
  // (added) ✨ Improve rewrote the draft: passive, like every announcement, so no gender.
  'announce.enhance.ready': 'حُسِّنت صياغة الطلب',
  // (added) The request was too unclear to run: questions are docked above the composer.
  'announce.clarify.ready': 'بعض الأسئلة قبل البدء',
  // (added) A build that could not land where the words asked says so after its record.
  'end.siteAsOnePage': 'بُنيت صفحة واحدة، إذ تبني المحادثة صفحة واحدة في كل مرة.',
  'end.newPageAppended': 'بُنيت أسفل هذه الصفحة، إذ لا يمكن فتح صفحة جديدة من هنا.',
  'end.appendedNotReplaced': 'أُضيفت بعد المحتوى الحالي، ولم يُستبدل شيء.',

  // WP-14-composer additions
  // (added) ✨ Improve (EnhanceButton). «حسّن طلبي» is the owner's own wording: the
  // person's request to أبو غضب, in the person's voice, not an instrument label. While it
  // works the name says so with «جارٍ» and a masdar, like «جارٍ الإيقاف…», without the
  // ellipsis: the spinner and the shimmer on the draft already say "in progress".
  'enhance.button': 'حسّن طلبي',
  'enhance.working': 'جارٍ تحسين الطلب',
  // (added) Why Improve cannot run now. «متاح» agrees with the implied «التحسين».
  'enhance.empty': 'متاح بعد كتابة طلب',
  'enhance.busy': 'متاح حين ينتهي العمل الحالي',
  // (added) EnhanceNote. The label repeats `announce.enhance.ready`; `{prompt}` is the
  // model's one-line restatement of the request, isolated in <bdi> by the component.
  'enhance.done': 'حُسِّنت صياغة الطلب',
  'enhance.understood': 'المطلوب كما فُهم: {prompt}',
  'enhance.changes.show': 'عرض التعديلات ({n})',
  'enhance.changes.hide': 'إخفاء التعديلات',
  'enhance.restore': 'استعادة نصّي',
  // (added) A failed Improve changes nothing, and says so: the cause when it is known.
  'enhance.failed': 'تعذّر تحسين الطلب',
  'enhance.failed.busy': 'الخدمة مزدحمة الآن، وبقي نصّك كما هو.',
  'enhance.failed.unreachable': 'لم يردّ النموذج، وبقي نصّك كما هو.',
  'enhance.failed.timeout': 'استغرق التحسين وقتًا أطول من المسموح، وبقي نصّك كما هو.',
  'enhance.failed.other': 'بقي نصّك كما هو.',
  // (added) ClarifyPanel. The title repeats `announce.clarify.ready`; the progress is the
  // question being asked, drawn «1 من 3» and spoken «السؤال 1 من 3».
  'clarify.title': 'بعض الأسئلة قبل البدء',
  'clarify.progress': '{i} من {n}',
  'clarify.progress.aria': 'السؤال {i} من {n}',
  'clarify.other': 'غير ذلك',
  'clarify.other.placeholder': 'إجابة أخرى',
  'clarify.other.send': 'إرسال الإجابة',
  'clarify.edit': 'تغيير هذه الإجابة',
  'clarify.sendAsWritten': 'إرسال الطلب كما هو',
  'clarify.cancel': 'إلغاء',
  'clarify.rewriting': 'يعيد صياغة الطلب',

  // WP-11-frame additions
  // (added) §4.4 JumpToLatest. WCAG 2.5.3: while a run is live the pill reads «يبني الآن»
  // or «يعدّل الآن», which `jump.aria` does not contain, so the name opens with the pill's
  // own words, then the masdar of what the button does: «يبني الآن: الانتقال إلى الأحدث».
  'jump.aria.live': '{label}: الانتقال إلى الأحدث',

  // WP-12-records additions
  // (added) §4.5: the person's sent request is an article, and it has no head to name it.
  // The same words as `input.aria`: what was typed there is what was sent.
  'message.aria': 'طلبك',
  // (added) §4.8 DirectionLine: `direction.aria` names the mood, the colours and the fonts;
  // a direction without fonts, or without swatches, says only what it has.
  'direction.aria.colors': 'الأسلوب: {mood}. الألوان: {colors}.',
  'direction.aria.fonts': 'الأسلوب: {mood}. الخطوط: {fonts}.',
  // (added) §4.9: the page-wide twins of `edit.title.done` and `edit.title.noChange`, for an
  // edit with no target to name. Passive, like «عُدِّل «{target}»».
  'edit.title.donePage': 'عُدِّلت الصفحة',
  'edit.title.noChangePage': 'لا تغيير في الصفحة',
  // (added) §4.13: the page-wide twin of `proposal.applied`.
  'proposal.appliedPage': 'طُبِّق الاقتراح',

  // WP-13-decisions additions
  // (added) §4.11 PlanSectionRow: eight rows each carry a handle and a [⋯], so each control
  // names its section, in a masdar; `plan.row.drag` stays the handle's hint.
  'plan.row.reorder': 'تغيير ترتيب «{title}»',
  'plan.row.menu': 'خيارات «{title}»',
  // (added) §4.11 inline rename: the field's label says which section it renames.
  'plan.row.rename.aria': 'إعادة تسمية «{title}»',
  // (added) §4.11 DirectionEditor: the swatch row's group name, and FontPairMenu's list.
  'plan.colors': 'الألوان',
  'plan.fonts.menu': 'الخطوط',
  // (added) §3.14 at 420: the specimen before the font pair, in the page's own script
  // (decorative, aria-hidden). The English one is "Aa".
  'plan.fonts.specimen': 'أب',
  // (added) §4.11 SwatchPopover: the native colour input's label.
  'swatch.pick': 'اختيار لون',
  // (added) §4.11 `swatch.ok` / `swatch.low` judge the text on the background. A card's text
  // sits on the surface, and a button's text on the accent, so those pairs say so.
  'swatch.ok.surface': 'مقروء على السطح (التباين {r})',
  'swatch.low.surface': 'غير مقروء على السطح (التباين {r})',
  'swatch.ok.accent': 'مقروء على اللون المميّز (التباين {r})',
  'swatch.low.accent': 'غير مقروء على اللون المميّز (التباين {r})',
  // (added) §4.11: the popover refuses a colour that breaks its pair, and says so.
  'swatch.refused': 'لا يُطبَّق هذا اللون ما دام النص غير مقروء.',
  'swatch.hex.invalid': 'يُكتب رمز اللون هكذا: {hex}',
  // (added) §4.13: the page-wide twin of `proposal.title`, for a proposal with no target.
  'proposal.title.page': 'اقتراح تعديل على الصفحة',
  // (added) §4.12 StepPlanCard: the steps list's name, and each step's target, spoken.
  'steps.label': 'الخطوات',
  'steps.target': 'في «{target}»',
  // (added) §4.15 RestoreDialog: the conflict leaves nothing to confirm, only to close; and
  // the Restore button's description while the restore runs («جارٍ الإيقاف» is its model).
  'restore.close': 'إغلاق',
  'restore.working': 'جارٍ إرجاع الصفحة',

  // WP-15-history-phone additions
  // (added) §4.18 HistoryRow: the row button's name, the title (the first request, a page
  // word in «») and its time as one phrase. «الحالية» is `aria-current` on the button.
  'history.row': '«{title}»، {when}',
  // (added) §4.18: while a run is live the other conversations wait, as «محادثة جديدة» does
  // (§4.2 `header.new.busy`). Passive, so the sentence names no one.
  'history.busy': 'تُفتح المحادثات الأخرى حين ينتهي العمل الحالي',
  // (added) §4.18: the current conversation is not deleted while its run is live. «متاح»
  // agrees with the implied masdar «الحذف».
  'history.delete.busy': 'متاح حين ينتهي العمل الحالي',
} as const satisfies Readonly<Record<Key, ArEntry>>;

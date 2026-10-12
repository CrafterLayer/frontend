/**
 * The words of the panel's "Skills & memory" place (2026-10-12), in both languages. Kept
 * beside the catalog rather than in it: the catalog files are at their size limit, and these
 * strings belong to one surface. Digits stay Latin (the editor's rule).
 */
import { arabicCount } from '../../preview/arabic-count';
import type { Locale } from '../model/view-types';
import type { CheckpointRestore } from '../model/checkpoints';
import type { MemoryNoteKind, MemoryWrite } from '../model/project-memory';
import {
  USER_SKILL_MAX_INSTRUCTIONS,
  USER_SKILLS_MAX,
  type UserSkillRefusal,
} from '../model/user-skills';
import { PROJECT_MEMORY_MAX_NOTES, PROJECT_MEMORY_MAX_TEXT } from '../model/project-memory';

export type KnowledgeTab = 'skills' | 'memory' | 'checkpoints';

export interface KnowledgeLabels {
  readonly title: string;
  readonly close: string;
  readonly tabs: Readonly<Record<KnowledgeTab, string>>;
  readonly skills: {
    readonly intro: string;
    readonly empty: string;
    readonly add: string;
    readonly import: string;
    readonly importLabel: string;
    readonly importPlaceholder: string;
    readonly importSave: string;
    readonly use: (name: string) => string;
    readonly always: string;
    readonly when: (words: readonly string[]) => string;
    /** "Delete Brand voice?": the second press of a two-press action. */
    readonly confirm: (action: string) => string;
    readonly edit: (name: string) => string;
    readonly remove: (name: string) => string;
    readonly copy: (name: string) => string;
    readonly copied: string;
    readonly builtIns: (count: number) => string;
    readonly builtInsHint: string;
    readonly count: (count: number) => string;
  };
  readonly editor: {
    readonly newTitle: string;
    readonly editTitle: string;
    readonly name: string;
    readonly namePlaceholder: string;
    readonly description: string;
    readonly descriptionPlaceholder: string;
    readonly instructions: string;
    readonly instructionsPlaceholder: string;
    readonly keywords: string;
    readonly keywordsHint: string;
    readonly mode: string;
    readonly modeAuto: string;
    readonly modeAlways: string;
    readonly save: string;
    readonly cancel: string;
    readonly length: (count: number) => string;
    readonly refusals: Readonly<Record<UserSkillRefusal | 'unreadable', string>>;
  };
  readonly memory: {
    readonly intro: string;
    readonly empty: string;
    readonly field: string;
    readonly placeholder: string;
    readonly kind: string;
    readonly kinds: Readonly<Record<MemoryNoteKind, string>>;
    readonly add: string;
    readonly remove: (text: string) => string;
    readonly clear: string;
    readonly count: (count: number) => string;
    readonly refusals: Readonly<Record<Exclude<MemoryWrite, 'saved'>, string>>;
  };
  readonly slash: {
    readonly label: string;
    readonly yours: string;
    readonly builtIn: string;
    readonly manage: string;
    readonly empty: string;
    readonly pinned: string;
    readonly unpin: (name: string) => string;
    readonly full: string;
  };
  readonly templates: {
    readonly title: string;
    readonly add: (name: string) => string;
    readonly added: (name: string) => string;
  };
  readonly upload: {
    readonly choose: string;
    readonly imported: (count: number) => string;
    readonly failed: (name: string, reason: string) => string;
  };
  readonly checkpoints: {
    readonly intro: string;
    readonly loading: string;
    readonly empty: string;
    readonly nameField: string;
    readonly namePlaceholder: string;
    readonly defaultName: string;
    readonly save: string;
    readonly saved: string;
    readonly saveFailed: string;
    readonly restore: (label: string) => string;
    readonly restoreShort: string;
    readonly kinds: Readonly<Record<'auto' | 'manual', string>>;
    readonly outcomes: Readonly<Record<CheckpointRestore, string>>;
  };
}

const EN: KnowledgeLabels = {
  title: 'Skills & memory',
  close: 'Close',
  tabs: { skills: 'Skills', memory: 'Memory', checkpoints: 'Checkpoints' },
  skills: {
    intro:
      'Teach the Agent how you work. A skill is instructions it follows in every request, or when a request mentions its words.',
    empty: 'No skills of your own yet. Write one, or import a SKILL.md.',
    add: 'New skill',
    import: 'Import',
    importLabel: 'SKILL.md to import',
    importPlaceholder:
      '---\nname: Brand voice\nkeywords: copy, headline\n---\nWrite short, warm sentences…',
    importSave: 'Add skill',
    use: (name) => `Use ${name}`,
    always: 'In every request',
    when: (words) => `When a request mentions ${words.join(', ')}`,
    confirm: (action) => `${action}?`,
    edit: (name) => `Edit ${name}`,
    remove: (name) => `Delete ${name}`,
    copy: (name) => `Copy ${name} as SKILL.md`,
    copied: 'Copied',
    builtIns: (count) => `Built-in skills (${String(count)})`,
    builtInsHint: 'The Agent already knows these and picks them by itself.',
    count: (count) => `${String(count)} of ${String(USER_SKILLS_MAX)}`,
  },
  editor: {
    newTitle: 'New skill',
    editTitle: 'Edit skill',
    name: 'Name',
    namePlaceholder: 'Brand voice',
    description: 'When to use it',
    descriptionPlaceholder: 'Headlines, buttons and every line of copy',
    instructions: 'Instructions',
    instructionsPlaceholder: 'Write short, warm sentences. Never use exclamation marks…',
    keywords: 'Words that turn it on',
    keywordsHint: 'Separate with commas: copy, headline, نبرة',
    mode: 'Use it',
    modeAuto: 'When a request mentions its words',
    modeAlways: 'In every request',
    save: 'Save skill',
    cancel: 'Cancel',
    length: (count) => `${String(count)} / ${String(USER_SKILL_MAX_INSTRUCTIONS)}`,
    refusals: {
      name: 'Give the skill a name.',
      instructions: 'Write what the Agent should do.',
      keywords: 'Add at least one word that should turn it on.',
      tooLong: `Too long: keep the instructions under ${String(USER_SKILL_MAX_INSTRUCTIONS)} characters.`,
      full: `You have ${String(USER_SKILLS_MAX)} skills. Delete one to add another.`,
      alwaysBudget:
        'There is no more room for skills in every request. Let this one turn on by its words, or turn another off.',
      unreadable: 'This is not a skill that can be read. Check its --- header.',
    },
  },
  memory: {
    intro:
      'Facts and preferences the Agent keeps in every request and every conversation. You decide what stays.',
    empty: 'Nothing remembered yet.',
    field: 'Something to remember',
    placeholder: 'Our brand colour is forest green',
    kind: 'Kind',
    kinds: { preference: 'Preference', 'site-fact': 'Fact about the site' },
    add: 'Remember',
    remove: (text) => `Forget “${text}”`,
    clear: 'Forget everything',
    count: (count) => `${String(count)} of ${String(PROJECT_MEMORY_MAX_NOTES)}`,
    refusals: {
      empty: 'Write something to remember.',
      tooLong: `Keep it under ${String(PROJECT_MEMORY_MAX_TEXT)} characters.`,
      full: `Memory is full (${String(PROJECT_MEMORY_MAX_NOTES)}). Forget something first.`,
      duplicate: 'That is already remembered.',
    },
  },
  slash: {
    label: 'Skills',
    yours: 'Your skills',
    builtIn: 'Built-in',
    manage: 'Manage skills & memory',
    empty: 'No skill by that name.',
    pinned: 'Skills for the next message',
    unpin: (name) => `Remove ${name}`,
    full: 'A message takes up to 3 skills.',
  },
  templates: {
    title: 'Start from a template',
    add: (name) => `Add ${name}`,
    added: (name) => `${name} added.`,
  },
  upload: {
    choose: 'Upload .md or .mdx',
    imported: (count) => (count === 1 ? '1 skill imported.' : `${String(count)} skills imported.`),
    failed: (name, reason) => `${name}: ${reason}`,
  },
  checkpoints: {
    intro:
      'The page is kept before every request the Agent runs. Restore any point: a restore is one change, so Undo takes it back.',
    loading: 'Reading checkpoints…',
    empty: 'No checkpoints yet. One is kept before the next request.',
    nameField: 'Checkpoint name',
    namePlaceholder: 'Before the new hero',
    defaultName: 'Saved checkpoint',
    save: 'Save checkpoint',
    saved: 'Checkpoint saved.',
    saveFailed: 'The checkpoint was not saved.',
    restore: (label) => `Restore the page to “${label}”`,
    restoreShort: 'Restore',
    kinds: { auto: 'Before a request', manual: 'Saved' },
    outcomes: {
      restored: 'The page is restored. Undo takes it back.',
      unchanged: 'The page already matches this point.',
      missing: 'This point is no longer kept.',
      failed: 'This point could not be restored.',
    },
  },
};

const AR: KnowledgeLabels = {
  title: 'المهارات والذاكرة',
  close: 'إغلاق',
  tabs: { skills: 'المهارات', memory: 'الذاكرة', checkpoints: 'نقاط الحفظ' },
  skills: {
    intro:
      'علّم الوكيل طريقتك في العمل. المهارة تعليمات يتبعها في كل طلب، أو حين يذكر الطلب كلماتها.',
    empty: 'لا مهارات خاصة بك بعد. اكتب واحدة، أو استورد ملف SKILL.md.',
    add: 'مهارة جديدة',
    import: 'استيراد',
    importLabel: 'ملف SKILL.md للاستيراد',
    importPlaceholder:
      '---\nname: نبرة العلامة\nkeywords: نص, عنوان\n---\nاكتب جملًا قصيرة ودافئة…',
    importSave: 'أضف المهارة',
    use: (name) => `استخدم ${name}`,
    always: 'في كل طلب',
    when: (words) => `حين يذكر الطلب ${words.join('، ')}`,
    confirm: (action) => `${action}؟`,
    edit: (name) => `عدّل ${name}`,
    remove: (name) => `احذف ${name}`,
    copy: (name) => `انسخ ${name} كملف SKILL.md`,
    copied: 'نُسخت',
    builtIns: (count) => `المهارات المدمجة (${String(count)})`,
    builtInsHint: 'يعرفها الوكيل مسبقًا ويختارها وحده.',
    count: (count) => `${String(count)} من ${String(USER_SKILLS_MAX)}`,
  },
  editor: {
    newTitle: 'مهارة جديدة',
    editTitle: 'تعديل المهارة',
    name: 'الاسم',
    namePlaceholder: 'نبرة العلامة',
    description: 'متى تُستخدم',
    descriptionPlaceholder: 'العناوين والأزرار وكل سطر من النصوص',
    instructions: 'التعليمات',
    instructionsPlaceholder: 'اكتب جملًا قصيرة ودافئة. لا تستخدم علامات التعجب…',
    keywords: 'الكلمات التي تشغّلها',
    keywordsHint: 'افصل بفواصل: نص، عنوان، brand',
    mode: 'متى تعمل',
    modeAuto: 'حين يذكر الطلب كلماتها',
    modeAlways: 'في كل طلب',
    save: 'احفظ المهارة',
    cancel: 'إلغاء',
    length: (count) => `${String(count)} / ${String(USER_SKILL_MAX_INSTRUCTIONS)}`,
    refusals: {
      name: 'أعطِ المهارة اسمًا.',
      instructions: 'اكتب ما يجب أن يفعله الوكيل.',
      keywords: 'أضف كلمة واحدة على الأقل تشغّلها.',
      tooLong: `طويلة جدًا: أبقِ التعليمات دون ${String(USER_SKILL_MAX_INSTRUCTIONS)} حرف.`,
      full: `لديك ${String(USER_SKILLS_MAX)} مهارة. احذف واحدة لتضيف أخرى.`,
      alwaysBudget:
        'لم يعد هناك متسع لمهارات تعمل في كل طلب. اجعل هذه تعمل بكلماتها، أو أوقف مهارة أخرى.',
      unreadable: 'تعذّرت قراءة هذه المهارة. تحقّق من ترويسة --- في أولها.',
    },
  },
  memory: {
    intro: 'حقائق وتفضيلات يتذكرها الوكيل في كل طلب وكل محادثة. أنت تقرّر ما يبقى.',
    empty: 'لا شيء محفوظ بعد.',
    field: 'شيء ليتذكره',
    placeholder: 'لون علامتنا أخضر غامق',
    kind: 'النوع',
    kinds: { preference: 'تفضيل', 'site-fact': 'حقيقة عن الموقع' },
    add: 'تذكّر',
    remove: (text) => `انسَ «${text}»`,
    clear: 'انسَ كل شيء',
    count: (count) => `${String(count)} من ${String(PROJECT_MEMORY_MAX_NOTES)}`,
    refusals: {
      empty: 'اكتب شيئًا ليتذكره.',
      tooLong: `أبقِه دون ${String(PROJECT_MEMORY_MAX_TEXT)} حرف.`,
      full: `الذاكرة ممتلئة (${String(PROJECT_MEMORY_MAX_NOTES)}). انسَ شيئًا أولًا.`,
      duplicate: 'هذا محفوظ مسبقًا.',
    },
  },
  slash: {
    label: 'المهارات',
    yours: 'مهاراتك',
    builtIn: 'المدمجة',
    manage: 'إدارة المهارات والذاكرة',
    empty: 'لا مهارة بهذا الاسم.',
    pinned: 'مهارات الرسالة التالية',
    unpin: (name) => `أزل ${name}`,
    full: 'تأخذ الرسالة 3 مهارات على الأكثر.',
  },
  templates: {
    title: 'ابدأ من قالب',
    add: (name) => `أضف ${name}`,
    added: (name) => `أُضيفت ${name}.`,
  },
  upload: {
    choose: 'ارفع ملف .md أو .mdx',
    imported: (count) =>
      `استُوردت ${arabicCount(count, { one: 'مهارة واحدة', two: 'مهارتان', few: 'مهارات', many: 'مهارة' })}.`,
    failed: (name, reason) => `${name}: ${reason}`,
  },
  checkpoints: {
    intro:
      'تُحفظ الصفحة قبل كل طلب ينفّذه الوكيل. استرجع أي نقطة: الاسترجاع تغيير واحد، فيعيده «تراجع».',
    loading: 'جارٍ قراءة نقاط الحفظ…',
    empty: 'لا نقاط حفظ بعد. تُحفظ واحدة قبل الطلب التالي.',
    nameField: 'اسم نقطة الحفظ',
    namePlaceholder: 'قبل الواجهة الجديدة',
    defaultName: 'نقطة محفوظة',
    save: 'احفظ نقطة',
    saved: 'حُفظت النقطة.',
    saveFailed: 'لم تُحفظ النقطة.',
    restore: (label) => `استرجع الصفحة إلى «${label}»`,
    restoreShort: 'استرجاع',
    kinds: { auto: 'قبل طلب', manual: 'محفوظة' },
    outcomes: {
      restored: 'استُرجعت الصفحة. «تراجع» يعيدها.',
      unchanged: 'الصفحة مطابقة لهذه النقطة أصلًا.',
      missing: 'لم تعد هذه النقطة محفوظة.',
      failed: 'تعذّر استرجاع هذه النقطة.',
    },
  },
};

export function knowledgeLabels(locale: Locale): KnowledgeLabels {
  return locale === 'ar' ? AR : EN;
}

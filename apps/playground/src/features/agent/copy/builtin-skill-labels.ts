/**
 * The words of the Skills tab's "Built-in skills" group (2026-10-14), in both languages: the
 * group headings, the filter, the switches, "Always on" and "Reset to defaults". Kept beside
 * knowledge-labels.ts, which is near its size limit; reached through `KnowledgeLabels`.
 * Digits stay Latin (the editor's rule).
 */
import type { BuiltInSkillGroup } from '../model/builtin-skills';

export interface BuiltInSkillLabels {
  readonly title: (count: number) => string;
  readonly intro: string;
  readonly count: (on: number, total: number) => string;
  readonly filter: string;
  readonly filterPlaceholder: string;
  readonly noMatch: string;
  readonly use: (name: string) => string;
  readonly always: string;
  readonly reset: string;
  readonly groups: Readonly<Record<BuiltInSkillGroup, string>>;
}

export const BUILT_IN_SKILL_LABELS_EN: BuiltInSkillLabels = {
  title: (count) => `Built-in skills (${String(count)})`,
  intro:
    'The Agent already knows these and picks them by itself from what you ask. Switch one off and it is never picked; naming it with / still uses it.',
  count: (on, total) => `${String(on)} of ${String(total)} on`,
  filter: 'Filter built-in skills',
  filterPlaceholder: 'Filter by name',
  noMatch: 'No built-in skill matches.',
  use: (name) => `Use ${name}`,
  always: 'Always on',
  reset: 'Reset to defaults',
  groups: {
    design: 'Design & pages',
    content: 'Content',
    data: 'Data & reports',
    images: 'Images & brand',
    creative: 'Creative',
    language: 'Language',
    always: 'Engine essentials',
  },
};

export const BUILT_IN_SKILL_LABELS_AR: BuiltInSkillLabels = {
  title: (count) => `المهارات المدمجة (${String(count)})`,
  intro:
    'يعرفها الوكيل مسبقًا ويختارها وحده مما تطلبه. أوقف إحداها فلن يختارها أبدًا، وإذا سمّيتها بـ / استُخدمت.',
  count: (on, total) => `${String(on)} من ${String(total)} مفعّلة`,
  filter: 'تصفية المهارات المدمجة',
  filterPlaceholder: 'ابحث بالاسم',
  noMatch: 'لا توجد مهارة مدمجة مطابقة.',
  use: (name) => `استخدم ${name}`,
  always: 'مفعّلة دائمًا',
  reset: 'استعادة الإعدادات الافتراضية',
  groups: {
    design: 'التصميم والصفحات',
    content: 'المحتوى',
    data: 'البيانات والتقارير',
    images: 'الصور والهوية',
    creative: 'الإبداع',
    language: 'اللغة',
    always: 'أساسيات المحرك',
  },
};

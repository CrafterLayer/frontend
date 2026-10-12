/**
 * The default skills (2026-10-12): the engine's reviewed pack (`CRAFTKIT_DEFAULT_SKILLS`: design
 * intelligence from UI UX Pro Max, landing patterns, UX rules, type and colour, forms, natural
 * copy in English and Arabic, honest proof) is on for every person, as other agents ship their own skills. Each one
 * can be switched off (the choice is kept per viewer) or copied into the person's own skills to
 * change. Names and descriptions are shown in the panel's language; the instructions the Agent
 * reads stay as written.
 */
import { CRAFTKIT_DEFAULT_SKILLS, type AiSkillDefinitionV1 } from '@craftkit/builder';

import type { AgentStorage } from './migrate-sessions';
import { USER_SKILL_MAX_KEYWORDS, type UserSkillDraft } from './user-skills';
import type { Locale } from './view-types';

export const DEFAULT_SKILLS_KEY = 'ck-agent-default-skills:v1';

export interface DefaultSkillView {
  readonly id: string;
  /** In the panel's language. */
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly keywords: readonly string[];
  readonly enabled: boolean;
}

const ARABIC: Readonly<Record<string, { readonly name: string; readonly description: string }>> = {
  'craftkit.pro-max-design': {
    // No Latin in brackets: a truncated RTL row cut "(UI UX Pro Max)" mid-word.
    name: 'ذكاء التصميم Pro Max',
    description:
      'من بيانات UI UX Pro Max: نمط الصفحة وألوانها وخطوطها وتأثيراتها وما يجب أن تعرضه لتسعة وعشرين نوعًا من الأعمال، يُحسم قبل أي قسم.',
  },
  'craftkit.pro-max-landing': {
    name: 'صفحات هبوط تحقق التحويل',
    description:
      'أربعة عشر نمطًا: ترتيب الأقسام، ومكان زر الدعوة، والقاعدة التي تجعل كل نمط يحقق التحويل.',
  },
  'craftkit.pro-max-ux': {
    name: 'قواعد التفاعل وتجربة المستخدم',
    description:
      'أهداف لمس مريحة، وتركيز ظاهر، وردود فعل واضحة، وتصميم للجوال أولًا، وحركة معتدلة.',
  },
  'craftkit.type-colour': {
    name: 'الخطوط والألوان',
    description:
      'أزواج خطوط موثوقة حسب الطابع، لاتينية وعربية، وقواعد الألوان: لون مميّز واحد، وتباين كافٍ، وهوية العلامة أولًا.',
  },
  'craftkit.forms-convert': {
    name: 'نماذج يكملها الناس',
    description:
      'حقول قليلة بعناوين ظاهرة، وأنواع إدخال صحيحة، وأخطاء بجانب الحقل، وزر إرسال صادق، وبديل مباشر للتواصل.',
  },
  'craftkit.natural-copy': {
    name: 'نصوص طبيعية بالعربية والإنجليزية',
    description:
      'نصوص تُقرأ كأن كاتبها من أهل اللغة، بالعربية والإنجليزية: جمل قصيرة، وأزرار تبدأ بفعل، وترقيم كل لغة وأرقامها، وكل نصوص الصفحة بلغتها.',
  },
  'craftkit.trust-proof': {
    name: 'ثقة وأدلة صادقة',
    description: 'آراء وأرقام وشهادات وضمانات وأسئلة شائعة تبني الثقة، دون اختلاق شيء منها.',
  },
};

/** The pack as the panel lists it, in the engine's order. */
export function defaultSkillViews(
  locale: Locale,
  disabled: readonly string[],
): readonly DefaultSkillView[] {
  return CRAFTKIT_DEFAULT_SKILLS.map((skill) => {
    const own = locale === 'ar' ? ARABIC[skill.id] : undefined;
    return {
      id: skill.id,
      name: own?.name ?? skill.name,
      description: own?.description ?? skill.description,
      instructions: skill.instructions,
      keywords: skill.activation?.mode === 'auto' ? (skill.activation.keywords ?? []) : [],
      enabled: !disabled.includes(skill.id),
    };
  });
}

/** The definitions the registry takes: every default the person has not switched off. */
export function enabledDefaultDefinitions(
  disabled: readonly string[],
): readonly AiSkillDefinitionV1[] {
  return CRAFTKIT_DEFAULT_SKILLS.filter((skill) => !disabled.includes(skill.id));
}

/** A default as a draft of the person's own skill ("Make it my own"), within the editor's limits. */
export function defaultSkillDraft(view: DefaultSkillView): UserSkillDraft {
  return {
    name: view.name,
    description: view.description,
    instructions: view.instructions,
    keywords: view.keywords.slice(0, USER_SKILL_MAX_KEYWORDS),
    mode: 'auto',
  };
}

export interface DefaultSkillsStore {
  /** The ids the person switched off. */
  readonly get: () => readonly string[];
  readonly subscribe: (listener: () => void) => () => void;
  readonly setEnabled: (id: string, enabled: boolean) => void;
}

function readDisabled(storage: AgentStorage | undefined): readonly string[] {
  try {
    const raw = storage?.getItem(DEFAULT_SKILLS_KEY);
    const value: unknown = raw === null || raw === undefined ? [] : JSON.parse(raw);
    const known = new Set(CRAFTKIT_DEFAULT_SKILLS.map(({ id }) => id));
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string' && known.has(id))
      : [];
  } catch {
    return [];
  }
}

/** Which defaults are off, kept per viewer; every default is on until switched off. */
export function createDefaultSkillsStore(storage?: AgentStorage): DefaultSkillsStore {
  let disabled = readDisabled(storage);
  const listeners = new Set<() => void>();
  return {
    get: () => disabled,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEnabled: (id, enabled) => {
      if (!CRAFTKIT_DEFAULT_SKILLS.some((skill) => skill.id === id)) return;
      const next = enabled
        ? disabled.filter((entry) => entry !== id)
        : [...new Set([...disabled, id])];
      if (
        next.length === disabled.length &&
        next.every((entry, index) => entry === disabled[index])
      )
        return;
      disabled = next;
      try {
        storage?.setItem(DEFAULT_SKILLS_KEY, JSON.stringify(disabled));
      } catch {
        // A full or blocked storage keeps the choice for this visit only.
      }
      for (const listener of [...listeners]) listener();
    },
  };
}

import { describe, expect, it } from 'vitest';

import { isLucideIconName, utilityVocabulary } from '@craftkit/builder-schema';

import {
  CRAFTKIT_AI_SKILL_DEFINITIONS,
  createCraftkitAiSkillRegistry,
  defineAiSkill,
} from './index';

const ALWAYS_SKILL_ID = 'craftkit.craft-manual';
/**
 * The always skill is mandatory on every request: a mandatory skill that does
 * not fit the token budget throws instead of being omitted, so its body is
 * capped here. The cap also keeps the unconditional per-request cost visible.
 *
 * Raised 1,200 → 1,450 for the id rule. A model that names a node it is
 * inserting in the same plan cannot be repaired into a correct guess — the
 * kernel mints that id after the plan is written — so the rule has to arrive
 * before the plan does, on every request, not as a hint after a rejection.
 */
const ALWAYS_INSTRUCTION_BYTE_LIMIT = 1_450;
/**
 * Floor + any single auto skill (with its dependency closure) must stay well
 * under 16k. Raised 2,500 → 2,650 when the floor gained the id rule: the floor
 * is charged to every skill's total here, so a rule that had to be
 * unconditional lifts every row by the same ~60 tokens.
 */
const SINGLE_SKILL_TOKEN_CEILING = 2_650;
/**
 * A single-archetype request must not stack more than this many auto skills.
 *
 * Raised 3 → 4 when the taste skill (`craftkit.visual-direction`) became a
 * dependency of all three page archetypes: an Arabic page design is now
 * copywriting + taste + archetype + language. Four is the ceiling because that
 * is one of each KIND — words, look, structure, language — and a fifth would
 * mean two skills claiming the same job.
 */
const MAX_AUTO_SKILLS_PER_REQUEST = 4;

function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x80) bytes += 1;
    else if (codePoint < 0x800) bytes += 2;
    else if (codePoint < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

describe('Craftkit built-in AI skills', () => {
  it('ships reviewed data-only expertise with exactly one always-on floor', () => {
    const registry = createCraftkitAiSkillRegistry();

    expect(registry.list()).toHaveLength(CRAFTKIT_AI_SKILL_DEFINITIONS.length);
    expect(registry.list().every(({ source }) => source === 'builtin')).toBe(true);
    expect(registry.list().every(({ trust }) => trust === 'builtin')).toBe(true);
    // Was "no built-in is always-on": the craft manual is now the single mandatory floor.
    expect(
      registry
        .list()
        .filter(({ activation }) => activation.mode === 'always')
        .map(({ id }) => id),
    ).toEqual([ALWAYS_SKILL_ID]);

    const floor = CRAFTKIT_AI_SKILL_DEFINITIONS.find(({ id }) => id === ALWAYS_SKILL_ID);
    expect(floor).toBeDefined();
    expect(utf8ByteLength(floor?.instructions ?? '')).toBeLessThanOrEqual(
      ALWAYS_INSTRUCTION_BYTE_LIMIT,
    );
    expect(Object.keys(floor?.references ?? {})).toEqual([]);
  });

  it('pins the built-in id set and lists definitions by priority descending', () => {
    expect(
      createCraftkitAiSkillRegistry()
        .list()
        .map(({ id }) => id),
    ).toEqual([
      'craftkit.accessibility-review',
      'craftkit.arabic-rtl',
      'craftkit.build-fill',
      'craftkit.build-scaffold',
      'craftkit.conversion-recipes',
      'craftkit.copywriting',
      'craftkit.craft-manual',
      'craftkit.cv-page',
      'craftkit.design-direction',
      'craftkit.design-tokens',
      'craftkit.motion',
      'craftkit.occasion-page',
      'craftkit.page-composition',
      'craftkit.precise-edit',
      'craftkit.scroll-cinematic',
      'craftkit.structure-recipes',
      'craftkit.ui-ux-pro',
      'craftkit.visual-direction',
    ]);

    const priorities = CRAFTKIT_AI_SKILL_DEFINITIONS.map(({ priority }) => priority ?? 0);
    expect(priorities).toEqual([...priorities].sort((left, right) => right - left));
  });

  it('auto-activates Arabic page-design expertise deterministically', () => {
    const prepared = createCraftkitAiSkillRegistry().prepare({
      request: 'صمم لي صفحة هبوط احترافية كاملة',
    });

    expect(prepared.active.map(({ id }) => id)).toContain('craftkit.page-composition');
    expect(
      prepared.active.find(({ id }) => id === 'craftkit.page-composition')?.instructions,
    ).toContain('visitor outcome');
  });

  it('keeps explicit precision expertise inactive until it is requested', () => {
    const registry = createCraftkitAiSkillRegistry();
    const automatic = registry.prepare({ request: 'Change the hero title' });
    const explicit = registry.prepare({
      request: 'Change the hero title',
      selectedSkillIds: ['craftkit.precise-edit'],
    });

    expect(automatic.active.map(({ id }) => id)).not.toContain('craftkit.precise-edit');
    // A plain edit request reaches the provider with the floor alone.
    expect(automatic.active.map(({ id }) => id)).toEqual([ALWAYS_SKILL_ID]);
    expect(explicit.active.map(({ id }) => id)).toContain('craftkit.precise-edit');
  });

  describe('request matrix', () => {
    interface Row {
      readonly request: string;
      readonly language: 'ar' | 'en';
      /** Non-floor activations in resolver order: dependency members before their root. */
      readonly auto: readonly string[];
    }
    // Every Arabic request carries the RTL skill: activation is by script, not
    // by which imperative the writer happened to use. English requests never do.
    const rows: readonly Row[] = [
      {
        request: 'صمم لي صفحة سيرة ذاتية',
        language: 'ar',
        auto: [
          'craftkit.copywriting',
          'craftkit.visual-direction',
          'craftkit.cv-page',
          'craftkit.arabic-rtl',
        ],
      },
      {
        request: 'Build a landing page for my bakery',
        language: 'en',
        auto: ['craftkit.copywriting', 'craftkit.visual-direction', 'craftkit.page-composition'],
      },
      { request: 'كبّر حجم العنوان', language: 'ar', auto: ['craftkit.arabic-rtl'] },
      {
        request: 'Add a farewell banner for a retiring colleague',
        language: 'en',
        auto: ['craftkit.copywriting', 'craftkit.visual-direction', 'craftkit.occasion-page'],
      },
      {
        request: 'أضف قسم الأسعار',
        language: 'ar',
        auto: ['craftkit.arabic-rtl', 'craftkit.conversion-recipes'],
      },
      {
        request: 'Redesign the page with a warm palette',
        language: 'en',
        auto: ['craftkit.design-direction'],
      },
      {
        request: 'راجع إمكانية الوصول في هذه الصفحة',
        language: 'ar',
        auto: ['craftkit.arabic-rtl', 'craftkit.accessibility-review'],
      },
      {
        request: 'Design a portfolio page for my photography',
        language: 'en',
        auto: ['craftkit.copywriting', 'craftkit.visual-direction', 'craftkit.cv-page'],
      },
      {
        // The request that exposed the gap: no imperative keyword, an occasion.
        request: 'بانر وداع سامر ووسيم مع خلفية سفر',
        language: 'ar',
        auto: [
          'craftkit.copywriting',
          'craftkit.visual-direction',
          'craftkit.occasion-page',
          'craftkit.arabic-rtl',
        ],
      },
      {
        request: 'Make the background darker',
        language: 'en',
        auto: ['craftkit.design-direction'],
      },
    ];

    it('covers both languages evenly', () => {
      expect(rows.filter(({ language }) => language === 'ar')).toHaveLength(5);
      expect(rows.filter(({ language }) => language === 'en')).toHaveLength(5);
    });

    it.each(rows)('activates $auto for "$request"', ({ request, auto }) => {
      const prepared = createCraftkitAiSkillRegistry().prepare({ request, auto: true });
      const [floor, ...rest] = prepared.active;

      expect(floor).toMatchObject({ id: ALWAYS_SKILL_ID, reason: 'always' });
      expect(rest.map(({ id }) => id)).toEqual(auto);
      expect(rest.length).toBeLessThanOrEqual(MAX_AUTO_SKILLS_PER_REQUEST);
      expect(rest.map(({ id }) => id)).not.toContain('craftkit.precise-edit');
      expect(prepared.omitted).toEqual([]);
      /*
        Raised 2,400 → 3,200 with the taste skill: the widest row is now floor +
        copywriting + visual-direction + archetype + language = 3,052 tokens,
        against a 16,000 default budget. It is a ceiling on ONE request's
        expertise, not on the budget.
      */
      expect(prepared.totalTokens).toBeLessThanOrEqual(3_200);
      expect(prepared.effectiveCommandRestriction).toBeUndefined();
    });
  });

  it('prefers the CV archetype when a request names both page archetypes', () => {
    const prepared = createCraftkitAiSkillRegistry().prepare({
      request: 'design a landing page for my portfolio',
    });

    expect(prepared.active.map(({ id }) => id)).toEqual([
      ALWAYS_SKILL_ID,
      'craftkit.copywriting',
      'craftkit.visual-direction',
      'craftkit.cv-page',
    ]);
    expect(prepared.omitted).toEqual([
      expect.objectContaining({ id: 'craftkit.page-composition', code: 'conflict' }),
    ]);
  });

  it('drops keyword-matched insert playbooks from an explicit surgical run', () => {
    const prepared = createCraftkitAiSkillRegistry().prepare({
      request: 'Change the pricing section title of my landing page',
      selectedSkillIds: ['craftkit.precise-edit'],
    });

    expect(prepared.active.map(({ id }) => id)).toEqual(['craftkit.precise-edit', ALWAYS_SKILL_ID]);
    expect(prepared.omitted.map(({ id, code }) => `${id}:${code}`)).toEqual([
      'craftkit.page-composition:conflict',
      'craftkit.conversion-recipes:conflict',
    ]);
    expect(prepared.effectiveCommandRestriction).toEqual([
      'setBinding',
      'setProp',
      'setResponsive',
    ]);
  });

  it('validates every definition and keeps floor plus any single skill under the ceiling', () => {
    const registry = createCraftkitAiSkillRegistry();

    for (const definition of CRAFTKIT_AI_SKILL_DEFINITIONS) {
      expect(() => defineAiSkill(definition)).not.toThrow();
      const prepared = registry.prepare({
        request: '',
        selectedSkillIds: [definition.id],
        auto: false,
      });
      expect(prepared.active.map(({ id }) => id)).toContain(ALWAYS_SKILL_ID);
      expect(prepared.active.map(({ id }) => id)).toContain(definition.id);
      expect(prepared.totalTokens).toBeLessThan(SINGLE_SKILL_TOKEN_CEILING);
    }
  });

  describe('vocabulary', () => {
    // Class-family prefixes worth checking against the utility vocabulary; other
    // hyphenated tokens are prose (call-to-action, self-contained) or CSS declarations.
    const CLASS_FAMILY =
      /^(sm:|md:|lg:|hover:|motion-reduce:)?-?(bg|text|border|from|via|to|p|px|py|pt|pb|ps|pe|m|mx|my|mt|mb|ms|me|gap|space|divide|font|tracking|leading|whitespace|line-clamp|tabular-nums|flex|grid|block|inline|inline-block|inline-flex|hidden|shrink|grow|items|justify|self|order|col|row|relative|absolute|fixed|sticky|isolate|inset|top|bottom|start|end|z|w|h|max-w|min-w|min-h|max-h|aspect|rounded|shadow|ring|opacity|object|overflow|blur|transition|duration|delay|ease|animate|scale|translate|transform|sr-only|italic|underline|uppercase|lowercase|capitalize|size)(-|$|:)/u;
    // Bare family words are prose ("text", "border", "grid"), not utilities.
    const BARE_WORD = /^[a-z]+$/u;
    // `prop:value` is a CSS declaration inside a css snippet unless the prefix is a variant.
    const CSS_DECLARATION = /^(?!(?:sm|md|lg|hover|motion-reduce):)[a-z-]+:./u;
    // CSS property names and prose that happen to start with a utility family word.
    const NOT_A_CLASS = new Set([
      'border-inline-start',
      'border-start-start-radius',
      'inset-inline-start',
      'font-family',
      'self-contained',
    ]);
    // Tokens that appear only as "does not exist" traps; wildcard and a/b prose
    // forms ("text-*", "ps-/pe-", "border-t/border-b") are skipped structurally.
    const TRAPS = new Set([
      'md:flex-row',
      'border-t',
      'border-b',
      'grow',
      'shrink',
      'hover:text-white',
      'hover:shadow',
      'gap-16',
      'h-5',
      'font-sans',
      'list-disc',
      'xl:',
      'dark:',
      '-mt-4',
      'md:text-center',
      'mt-auto',
      'flex-row-reverse',
      'py-24',
      'text-left',
      'text-right',
      // Arbitrary-value syntax: Tailwind writes it, this vocabulary has no such
      // class, and the tokens skill names three so the model stops reaching.
      'bg-[#0f172a]',
      'p-[13px]',
      'w-[42rem]',
    ]);
    const ICON_STOPWORDS = new Set([
      'size',
      'and',
      'or',
      'with',
      'beside',
      'by',
      'name',
      'names',
      'label',
      'before',
      'only',
      'in',
      'is',
      'match',
      'mirrored',
      'none',
      'byte-identical',
    ]);

    function skillText(definition: (typeof CRAFTKIT_AI_SKILL_DEFINITIONS)[number]): string {
      return [definition.instructions, ...Object.values(definition.references ?? {})].join('\n');
    }

    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s names only utilities the door admits',
      (_id, definition) => {
        const vocabulary = utilityVocabulary();
        const unknown = new Set<string>();
        const tokens = skillText(definition)
          .split(/[\s"'`<>(),;{}]+/u)
          .map((token) => token.replace(/[.:,;]+$/u, ''))
          .filter((token) => token.length > 0);
        for (const token of tokens) {
          if (vocabulary.has(token) || /^ck-[^[\]]+$/u.test(token) || TRAPS.has(token)) continue;
          if (NOT_A_CLASS.has(token) || CSS_DECLARATION.test(token)) continue;
          // a/b alternatives, wildcards, dangling prefixes and "-N" placeholders are prose.
          if (token.includes('/') || token.includes('*') || token.endsWith('-')) continue;
          if (/[A-Z]/u.test(token)) continue;
          if (CLASS_FAMILY.test(token) && !BARE_WORD.test(token)) unknown.add(token);
        }
        expect([...unknown]).toEqual([]);
      },
    );

    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s names only icons the renderer has',
      (_id, definition) => {
        const text = skillText(definition);
        const candidates = new Set<string>();
        for (const match of text.matchAll(/icons?\s+([a-z0-9-]+(?:\s*\/\s*[a-z0-9-]+)*)/gu)) {
          for (const name of (match[1] ?? '').split(/\s*\/\s*/u)) {
            if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name) && !ICON_STOPWORDS.has(name)) {
              candidates.add(name);
            }
          }
        }
        for (const match of text.matchAll(
          /\b(?:arrow|chevron|circle|badge|graduation|map)-[a-z-]+\b/gu,
        )) {
          candidates.add(match[0]);
        }
        expect([...candidates].filter((name) => !isLucideIconName(name))).toEqual([]);
      },
    );
  });
});

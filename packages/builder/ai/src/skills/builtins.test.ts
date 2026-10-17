import { describe, expect, it } from 'vitest';

import { isLucideIconName, utilityVocabulary } from '@craftkit/builder-schema';

import { SCENE_PRESETS } from '../scene-presets/catalog';
import { PIXI_CREATIVE_SKILL_IDS } from './creative/creative-skill-ids.test-util';
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
 *
 * Raised 1,450 → 1,560 for the colour legend, for the same reason: every
 * recipe now writes its accent as the {accent} slot, and a slot defined only
 * in the skills that happen to be active is a class the model guesses.
 */
const ALWAYS_INSTRUCTION_BYTE_LIMIT = 1_560;
/**
 * Floor + any single auto skill (with its dependency closure) must stay well
 * under 16k. Raised 2,500 → 2,650 when the floor gained the id rule: the floor
 * is charged to every skill's total here, so a rule that had to be
 * unconditional lifts every row by the same ~60 tokens.
 *
 * Raised 2,650 → 2,800 for the one colour rule (+~90 in the floor) and the
 * personal-facts exception in copywriting, which every archetype depends on.
 */
const SINGLE_SKILL_TOKEN_CEILING = 2_800;
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

function skillText(definition: (typeof CRAFTKIT_AI_SKILL_DEFINITIONS)[number]): string {
  return [definition.instructions, ...Object.values(definition.references ?? {})].join('\n');
}

/** Lines, then sentences: the unit a qualifier ("site theme", a host) must share with its claim. */
function sentences(text: string): readonly string[] {
  return text.split(/\n|(?<=\.)\s+/u).filter((sentence) => sentence.trim() !== '');
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
      'craftkit.art-names',
      'craftkit.build-fill',
      'craftkit.build-scaffold',
      // Industry page types (2026-09-28): each replaces page-composition for its trade.
      'craftkit.clinic-page',
      'craftkit.conversion-recipes',
      'craftkit.copywriting',
      'craftkit.craft-manual',
      'craftkit.cv-page',
      'craftkit.data-viz',
      // design-code additions (2026-09-28): explicit, for section writers and the page plan.
      'craftkit.design-code',
      'craftkit.design-direction',
      'craftkit.design-tokens',
      // Explicit, for the skeleton pass only: the look decided from a checked menu.
      'craftkit.direction-deck',
      'craftkit.logo-design',
      'craftkit.menu-page',
      'craftkit.motion',
      'craftkit.occasion-page',
      'craftkit.page-composition',
      // Explicit, beside the photo-catalog context provider.
      'craftkit.photo-direction',
      // creative agent and game libraries (2026-10-12): playbooks, engines and the director.
      ...PIXI_CREATIVE_SKILL_IDS,
      // pixi-skills additions (2026-10-10): PixiJS v8 for free-code scene scripts.
      'craftkit.pixi-v8-core',
      'craftkit.pixi-v8-effects',
      'craftkit.pixi-v8-graphics',
      'craftkit.pixi-v8-interaction-perf',
      'craftkit.pixi-v8-text-assets',
      // Plan mode: explicit-only, the only built-in whose command restriction is the EMPTY set.
      'craftkit.plan-mode',
      'craftkit.precise-edit',
      'craftkit.property-page',
      'craftkit.scroll-cinematic',
      // Explicit, for every section writer: the named layouts the direction cites.
      'craftkit.section-variants',
      'craftkit.shop-page',
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
      /** Skills left out, as `id:code`; none unless listed. */
      readonly omitted?: readonly string[];
    }
    // Every Arabic request carries the RTL skill (by script, not verb); English ones never do.
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
        /*
          Was "…for my bakery" until 2026-09-28, when a bakery became the menu
          page's trade (page-power.test.ts pins that row, page-composition
          omitted as a conflict). This row keeps testing what it always did:
          an English whole-page request with no trade gets the generic page.
        */
        request: 'Build a landing page for my consulting firm',
        language: 'en',
        auto: ['craftkit.copywriting', 'craftkit.visual-direction', 'craftkit.page-composition'],
      },
      { request: 'كبّر حجم العنوان', language: 'ar', auto: ['craftkit.arabic-rtl'] },
      {
        /*
          A banner is ONE section (add-section), so the page taste skill stays
          out: a dependency serves only the routes it serves (router-3,
          2026-09-28 — was copywriting + visual-direction + occasion, 2,724
          tokens; now 1,943).
        */
        request: 'Add a farewell banner for a retiring colleague',
        language: 'en',
        auto: ['craftkit.copywriting', 'craftkit.occasion-page'],
        omitted: ['craftkit.visual-direction:intent'],
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
        /*
          The request that exposed the gap: no imperative keyword, an occasion.
          A banner named with no verb is one new section (router-3,
          2026-09-28): the occasion's banner, without the page taste skill.
        */
        request: 'بانر وداع سامر ووسيم مع خلفية سفر',
        language: 'ar',
        auto: ['craftkit.copywriting', 'craftkit.occasion-page', 'craftkit.arabic-rtl'],
        omitted: ['craftkit.visual-direction:intent'],
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

    it.each(rows)('activates $auto for "$request"', ({ request, auto, omitted }) => {
      const prepared = createCraftkitAiSkillRegistry().prepare({ request, auto: true });
      const [floor, ...rest] = prepared.active;

      expect(floor).toMatchObject({ id: ALWAYS_SKILL_ID, reason: 'always' });
      expect(rest.map(({ id }) => id)).toEqual(auto);
      expect(rest.length).toBeLessThanOrEqual(MAX_AUTO_SKILLS_PER_REQUEST);
      expect(rest.map(({ id }) => id)).not.toContain('craftkit.precise-edit');
      expect(prepared.omitted.map(({ id, code }) => `${id}:${code}`)).toEqual(omitted ?? []);
      /*
        Raised 2,400 → 3,200 with the taste skill: the widest row is now floor +
        copywriting + visual-direction + archetype + language = 3,052 tokens,
        against a 16,000 default budget. It is a ceiling on ONE request's
        expertise, not on the budget.

        Raised 3,200 → 3,400 when the floor gained the colour legend and
        copywriting the personal-facts exception: the Arabic CV row is 3,319.
      */
      expect(prepared.totalTokens).toBeLessThanOrEqual(3_400);
      expect(prepared.effectiveCommandRestriction).toBeUndefined();
    });
  });

  /*
    Keywords are trimmed when a skill is defined, so occasion-page's 'eid ' and
    'عيد ' — written with a trailing space to mean a whole word — matched as
    "eid" and "عيد": inside "سعيد" (a name on every other Arabic shop sign)
    and "بعيد". Measured 2026-09-28: a contractor's page named for its owner
    loaded the invitation archetype.
  */
  it('never reads an occasion into a business named for its owner', () => {
    for (const request of [
      'صفحة لشركة سعيد للمقاولات',
      'موقع لمكتب أبو سعيد',
      'a page for Reid & Sons',
    ]) {
      const ids = createCraftkitAiSkillRegistry()
        .prepare({ request, auto: true })
        .active.map(({ id }) => id);
      expect({ request, occasion: ids.includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: false,
      });
    }
    for (const request of ['بطاقة عيد الفطر', 'Eid Mubarak greeting page', 'صفحة عيد الأضحى']) {
      const ids = createCraftkitAiSkillRegistry()
        .prepare({ request, auto: true })
        .active.map(({ id }) => id);
      expect({ request, occasion: ids.includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: true,
      });
    }
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
    /*
      page-composition used to be listed here as omitted for a conflict. Since
      2026-09-28 it serves only page and site asks (activation.intents), and
      "Change the pricing section title…" routes to an edit, so it never
      matches at all; the section recipe still matches and is still refused.
    */
    expect(prepared.omitted.map(({ id, code }) => `${id}:${code}`)).toEqual([
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
          if (!SCENE_PRESETS.some(({ id }) => id === match[0])) candidates.add(match[0]);
        }
        expect([...candidates].filter((name) => !isLucideIconName(name))).toEqual([]);
      },
    );

    /*
      Measured 2026-09-27: five skills told the model that `xl:`, `group`,
      `hover:shadow-*`, `py-24` and `font-sans` "do not exist" or are
      "refused" long after the vocabulary had grown to generate them — so the
      model steered around working classes and the pages looked it. A claim of
      absence is a fact about the vocabulary, and it is checked against it.
    */
    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s never calls a generated class missing',
      (_id, definition) => {
        const vocabulary = utilityVocabulary();
        const stale: string[] = [];
        for (const match of skillText(definition).matchAll(
          /([a-z0-9:/_*.-]+)\s*(?:\)\s*)?(?:does not exist|do not exist|is refused|are refused)/gu,
        )) {
          const named = (match[1] ?? '').replace(/[*.]+$/u, '');
          if (vocabulary.has(named) || [...vocabulary].some((name) => name.startsWith(named))) {
            stale.push(named);
          }
        }
        // The list form of the same claim: "no absent utilities (hover:shadow, py-24, …)".
        for (const match of skillText(definition).matchAll(/\babsent\b[^(\n]*\(([^)]*)\)/gu)) {
          for (const item of (match[1] ?? '').split(/,\s*/u)) {
            const named = item
              .replace(/^bare\s+/u, '')
              .replace(/[*.]+$/u, '')
              .trim();
            if (named !== '' && [...vocabulary].some((name) => name.startsWith(named))) {
              stale.push(named);
            }
          }
        }
        expect(stale).toEqual([]);
      },
    );

    /*
      The same staleness in the other phrasing. Measured 2026-09-28: the checks
      references rode through every rewrite untouched, so motion told the model
      "no group class, no hover:shadow-*" beside instructions that prescribe
      both. A skill that forbids a class it also prescribes contradicts itself
      whatever the wording. Only class-shaped names count — an exact vocabulary
      entry, or a `-*` family — so "never animate layout" stays prose.
    */
    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s never forbids a class it also prescribes',
      (_id, definition) => {
        const vocabulary = utilityVocabulary();
        const text = skillText(definition);
        const forbidden: { readonly name: string; readonly family: boolean }[] = [];
        for (const match of text.matchAll(/\b(?:no|never)\s+([a-z][a-z0-9:/_*.-]*)/gu)) {
          // "no uppercase/tracking" is prose over two words; "bg-black/60" is one class.
          const raw = (match[1] ?? '').replace(/[.,:;]+$/u, '');
          const family = raw.endsWith('-*');
          const name = raw.replace(/[*-]+$/u, '');
          if (
            family ? [...vocabulary].some((entry) => entry.startsWith(name)) : vocabulary.has(name)
          ) {
            forbidden.push({ name, family });
          }
        }
        const contradictions = new Set<string>();
        for (const token of text.matchAll(/[^\s"'`<>(),;{}]+/gu)) {
          const written = token[0].replace(/[.:,;]+$/u, '');
          if (!vocabulary.has(written)) continue;
          const before = text.slice(Math.max(0, token.index - 7), token.index);
          if (/\b(?:no|never)\s+$/u.test(before)) continue;
          for (const { name, family } of forbidden) {
            if (family ? written.startsWith(name) : written === name) contradictions.add(name);
          }
        }
        expect([...contradictions]).toEqual([]);
      },
    );

    /*
      A font rule is a claim about the door too. arabic-rtl said "@import is
      refused" for months after the door began admitting the two font hosts,
      so an Arabic page named Cairo in its direction and never loaded it.
    */
    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s never calls the allowed font import refused',
      (_id, definition) => {
        const stale = sentences(skillText(definition)).filter(
          (sentence) =>
            /@import[^.]*\brefused\b/u.test(sentence) && !sentence.includes('fonts.googleapis.com'),
        );
        expect(stale).toEqual([]);
      },
    );
  });

  describe('one voice across skills that share a prompt', () => {
    /*
      Measured 2026-09-28: build-fill banned bg-accent while the craft manual,
      page-composition and the conversion recipes — all in the same fill prompt
      — spelled it as the exact recipe, and a coffee page shipped an indigo
      pricing ring. A role class carries the SITE theme, so a skill names one
      only in the sentence that says so; every recipe writes the `{accent}`
      slot the page's own palette fills.
    */
    const ACCENT_ROLE =
      /(?<![\w{-])(?:[a-z]+:)?(?:bg|text|border|ring|from|via|to|outline|shadow)-accent(?:-text)?(?![\w-])|var\(--t-accent\)/u;

    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s names an accent role only where it says the site theme',
      (_id, definition) => {
        const unqualified = sentences(skillText(definition)).filter(
          (sentence) => ACCENT_ROLE.test(sentence) && !/site theme/iu.test(sentence),
        );
        expect(unqualified).toEqual([]);
      },
    );

    /*
      copywriting said "never brackets" while cv-page and occasion-page, which
      depend on it, said "[your email]" — for the same facts, in the same
      prompt. The rule is one sentence now: a business's facts are realistic
      samples, a PERSON's own facts are never invented. Every skill that shows
      a bracket states that exception in those words.
    */
    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      "%s ties every bracketed placeholder to a person's own facts",
      (_id, definition) => {
        const text = skillText(definition);
        if (!/"\[[^\]]+\]"/u.test(text)) return;
        expect(text).toMatch(/person['’]s own facts/iu);
      },
    );

    /*
      The markup is written with single-quoted attributes (the JSON string then
      needs no escaping), so an example in double quotes teaches the spelling
      the model is told not to use.
    */
    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s shows markup attributes in single quotes',
      (_id, definition) => {
        const doubleQuoted = [
          ...skillText(definition).matchAll(
            /\b(?:alt|aria-hidden|aria-label|class|datetime|href|id|role|src|target|title)="/gu,
          ),
        ].map((match) => match[0]);
        expect(doubleQuoted).toEqual([]);
      },
    );

    const registry = createCraftkitAiSkillRegistry();

    /*
      The measured monoculture, 2026-09-28: 5 of 9 recorded skeletons put a
      glow or circle behind the headline, and the skills themselves prescribed
      it — design-direction D "one glow", motion GLOW, visual-direction "one
      ambient glow" — beside a violet-to-indigo gradient every published
      design guide (frontend-design, v0, taste-skill) names as the AI default.
    */
    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s prescribes none of the AI-default decorations',
      (_id, definition) => {
        const text = skillText(definition);
        expect(text).not.toMatch(/from-violet-\d+ to-indigo/u);
        expect(text).not.toMatch(/blur-3xl/u);
        expect(text).not.toMatch(/ambient glow|one glow|GLOW:/u);
        expect(text).not.toMatch(/(?:grids? hold|cards?\.?\s*Grid[^.]*;) 3 or 6/u);
      },
    );

    /*
      border-2 was a workaround from before the vocabulary admitted `border`;
      every card, row and chip in Tailark and HyperUI is a hairline. Measured
      2026-09-28: fourteen skill recipes still drew a 2px slate outline.
    */
    it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]))(
      '%s draws surfaces with hairlines, not 2px outlines',
      (_id, definition) => {
        expect(skillText(definition)).not.toMatch(
          /border-2 border-(?:slate|stone)-\d+|border-[tb]-2\b/u,
        );
      },
    );

    it('names five AI defaults, the SaaS kit and the template chrome among them', () => {
      const taste = registry.readSkill('craftkit.visual-direction');
      expect(taste).toContain('FIVE DEFAULTS');
      expect(taste).toMatch(/\(4\)[^(]*identical cards/u);
      expect(taste).toMatch(/\(5\)[^(]*eyebrow/u);
      expect(taste).toMatch(/never a glow, blob or gradient circle/iu);
    });

    /*
      The always-on floor's slot example was "bg-{accent} → bg-amber-700": the
      one hue every request saw, and the one 9 of 9 recorded skeletons chose
      (page-power verifier, 2026-09-28). An example is still a suggestion.
    */
    it('gives the floor a slot example outside the measured amber monoculture', () => {
      const floor = registry.readSkill(ALWAYS_SKILL_ID);
      expect(floor).toMatch(/bg-\{accent\} → bg-[a-z]+-\d{3}/u);
      expect(floor).not.toMatch(/bg-\{accent\} → bg-(?:amber|orange|yellow)-/u);
    });

    it('balances headings and pretties lead paragraphs in the page recipes', () => {
      for (const id of ['craftkit.page-composition', 'craftkit.section-variants']) {
        const text = registry.readSkill(id);
        expect(text).toContain('text-balance');
        expect(text).toContain('text-pretty');
      }
      expect(registry.readSkill('craftkit.page-composition')).toMatch(/lead item/u);
    });

    it('gives a sample testimonial an initials monogram, never a stock face', () => {
      const recipes = registry.readSkill('craftkit.conversion-recipes');
      expect(recipes).toMatch(/TESTIMONIAL:[^\n]*monogram/u);
      expect(recipes).not.toMatch(/TESTIMONIAL:[^\n]*\bimg\b/u);
      expect(registry.readSkill('craftkit.structure-recipes')).toMatch(/TEAM:[^\n]*initials/u);
    });

    /*
      Local conversion is a conversation: wa.me, tel:, a maps search, hours.
      And the Arabic filler the model reaches for when it has nothing to say
      («حلول متكاملة», «تجربة فريدة من نوعها») is named, as taste-skill names
      "elevate / seamless / unleash" for English.
    */
    it('writes local actions and refuses the filler phrases in both languages', () => {
      const copy = registry.readSkill('craftkit.copywriting');
      for (const phrase of [
        'wa.me',
        'tel:',
        'maps',
        '«حلول متكاملة»',
        '«تجربة فريدة من نوعها»',
        'seamless',
      ]) {
        expect(copy).toContain(phrase);
      }
      expect(copy).toMatch(/"Get started"/u);
    });

    it('ends the font monoculture: the direction names the Arabic pair, with its two rendering rules', () => {
      const rtl = registry.readSkill('craftkit.arabic-rtl');
      expect(rtl).toMatch(/pair the direction names/u);
      for (const face of ['Changa', 'Lemonada', 'Reem Kufi', 'Markazi Text', 'Beiruti', 'Amiri']) {
        expect(rtl).toContain(face);
      }
      expect(registry.readSkill('craftkit.visual-direction')).toMatch(/pair the direction names/u);
    });

    it('lets the motion checks allow what the motion recipes use', () => {
      const motion = CRAFTKIT_AI_SKILL_DEFINITIONS.find(({ id }) => id === 'craftkit.motion');
      const checks = Object.values(motion?.references ?? {}).join('\n');
      expect(checks).toContain('group-hover');
      expect(checks).not.toMatch(/no group\b|no hover:shadow/u);
    });

    it('carries the section variant from the skeleton to the section writer', () => {
      expect(registry.readSkill('craftkit.build-scaffold')).toMatch(/Hero\[split\]/u);
      expect(registry.readSkill('craftkit.build-fill')).toMatch(/Menu\[menu\]/u);
    });

    it('keys the hero shell to the ROLE a build states, never to a section number', () => {
      /*
        The retry request carries no "SECTION 1", and a nav-first page puts the
        navbar there — so a shell keyed to the number gave the hero an h2 on a
        retry and the navbar the page's h1.
      */
      const fill = registry.readSkill('craftkit.build-fill');
      const scaffold = registry.readSkill('craftkit.build-scaffold');

      expect(fill).not.toMatch(/SECTION 1\b/u);
      expect(fill).toContain('ROLE');
      // The scaffold marks the roles the build reads back: the opening h1, chrome tags.
      expect(scaffold).toContain('h1');
      expect(scaffold).toContain('footer');
    });

    it('agrees with the manual on direction and language: a build sets both itself', () => {
      const scaffold = registry.readSkill('craftkit.build-scaffold');
      const manual = registry.readSkill('craftkit.craft-manual');

      expect(scaffold).not.toContain('setDocMeta beyond direction');
      expect(scaffold).toContain('the build sets');
      expect(manual).toContain("lang 'ar'");
      expect(manual).toContain('build sets both');
    });

    it('restyles an existing region with editTree, as the markup rules say', () => {
      expect(registry.readSkill('craftkit.design-direction')).toContain('editTree');
      expect(registry.readSkill('craftkit.design-direction')).not.toContain('setProp of tree');
    });
  });
});

describe('craftkit.plan-mode — a plan that structurally cannot write', () => {
  const registry = createCraftkitAiSkillRegistry();

  it('is explicit-only: no phrasing can land a person in Plan by accident', () => {
    /*
      The opposite failure of the one being fixed. A person who typed a request
      in Ask must not silently get a plan instead of a page.
    */
    const prepared = registry.prepare({
      request: 'اعمل لي خطة لصفحة هبوط، plan the page first',
      auto: true,
    });

    expect(prepared.active.map(({ id }) => id)).not.toContain('craftkit.plan-mode');
  });

  it('restricts the run to NO commands at all when the host selects it', () => {
    const prepared = registry.prepare({
      request: 'a landing page for a dental clinic',
      selectedSkillIds: ['craftkit.plan-mode'],
    });

    expect(prepared.active.map(({ id }) => id)).toContain('craftkit.plan-mode');
    // Not "only safe commands" — none. This is what makes "Plan never applies"
    // a property of the run rather than a flag the host remembers to pass.
    expect(prepared.effectiveCommandRestriction).toEqual([]);
  });

  it('intersects a build playbook down to nothing, rather than inheriting its commands', () => {
    /*
      The case the flag alone would miss. Skill restrictions INTERSECT, so a run
      that carries Plan alongside a playbook that CAN insert still ends with an
      empty allow-list — the plan cannot borrow the builder's permissions.
    */
    const withBuild = registry.prepare({
      request: 'a landing page for a dental clinic',
      selectedSkillIds: ['craftkit.plan-mode', 'craftkit.precise-edit'],
    });

    const ids = withBuild.active.map(({ id }) => id);
    expect(ids).toContain('craftkit.plan-mode');
    expect(ids).toContain('craftkit.precise-edit');
    // `craftkit.precise-edit` alone allows three commands; with Plan, zero.
    expect(withBuild.effectiveCommandRestriction).toEqual([]);
    expect(
      registry.prepare({
        request: 'a landing page for a dental clinic',
        selectedSkillIds: ['craftkit.precise-edit'],
      }).effectiveCommandRestriction,
    ).toEqual(['setBinding', 'setProp', 'setResponsive']);
  });

  it('tells the model the four parts, and to answer with follow-ups', () => {
    /*
      The complaint that started this was as much "gives no suggestions" as
      "does not plan", so the instruction that produces them is part of the
      contract rather than a nicety.
    */
    const instructions = registry.readSkill('craftkit.plan-mode');

    for (const part of ['GOAL:', 'OUTLINE:', 'ALTERNATIVES:', 'RISK:', 'followUp:']) {
      expect(instructions).toContain(part);
    }
    expect(instructions).toMatch(/Emit no commands/);
  });
});

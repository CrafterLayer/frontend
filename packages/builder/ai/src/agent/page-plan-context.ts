import type { BuilderKernel } from '@craftkit/builder-core';
import { CUSTOM_CODE_ATTRIBUTES, CUSTOM_CODE_TAGS } from '@craftkit/builder-schema';
import type { AiCompositionPolicy } from '../context';
import { normalizeArabic, summarizeDocumentForIntent, type IntentTarget } from '../intent';
import { requestSkillIdsFor } from '../skills/request-skills';
import type { AiSkillRegistry } from '../skills';
import { excludedSkillIdsOf, withoutExcluded } from './excluded-skills';
import { planKitIndex } from './page-plan/kits';
import type { AiAgentPolicy } from './types';

/*
  STEP T1 of the page build (agent-audit §3.1, 2026-09-28): one model call that
  answers with a PAGE PLAN — tokens, fonts, one contract per section — instead
  of kernel commands. `planAiPage` is Plan mode's whole run; `runAiBuild` runs
  the same step first and builds what it returns, so the plan a person saw is
  the plan that gets built (P1-7b).

  Nothing here reaches the kernel door. A plan is validated by
  `validatePagePlan`, which is to a page plan what the door is to an `AiPlan`:
  the only way untrusted model output becomes something the build acts on.
*/

/** The step's id under a build: its events carry `<build>/page-plan`. */
export const PAGE_PLAN_STEP = 'page-plan';

const DIRECTION_DECK = 'craftkit.direction-deck';
const SECTION_VARIANTS = 'craftkit.section-variants';
const COPYWRITING = 'craftkit.copywriting';
const ARABIC_RTL = 'craftkit.arabic-rtl';

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const ARABIC_LANG = /^ar\b/u;

/** The line the direction deck reads: "VARIANT: B in the request swaps ground and band". */
export const ANOTHER_LOOK_LINE = 'VARIANT: B';

/*
  "Try another look", in the words people type. The deck's row gives every page
  an A look and a B look (ground and band swapped), and the B look is reached
  only through this line in the request — without it the tenth regeneration of
  a café page was the first one again (page-power.md §1.2, 2026-09-28). The
  host has no button for it yet (grep 2026-09-28: no "another look" signal in
  apps/ or packages/), so the person's own words are the signal, and a host
  that grows a button sends the line itself.

  Matched on text folded by the intent router's `normalizeArabic` (hamza,
  taa marbuta, alif maqsura and tashkeel folded), whole words only.

  The indefinite nouns and the adjectives take an optional trailing alif: MSA
  accusative with tanween ("جرّب شكلاً آخر", "أريد مظهرًا مختلفًا") folds to
  "شكلا"/"مظهرا"/"مختلفا", and the wave-1 verifier found four such phrasings
  read as no request (2026-09-28). "أريد" is NOT a lead verb: "أريد تصميم
  صفحة لمطعمي" is a first build, and with a bare noun it would read as
  another look — so it counts only through the noun-adjective pair.
*/
const ANOTHER_LOOK_EN =
  /\b(?:another|different|other|alternative|second|fresh)\s+(?:look|style|design|palette|colou?r\s+scheme)\b|\bnew\s+look\b|\bvariant:?\s*b\b/iu;
const ANOTHER_LOOK_AR_NOUN =
  '(?:(?:شكل|ستايل|تصميم|مظهر|لوك)ا?|الشكل|الستايل|التصميم|المظهر|اللوك)';
const ANOTHER_LOOK_AR = new RegExp(
  [
    `(?:^|\\s)${ANOTHER_LOOK_AR_NOUN}\\s+(?:اخر|ثاني|تاني|مختلف|جديد)ا?(?=\\s|$|[.!؟?،,])`,
    `(?:^|\\s)(?:غير|غيري|غيروا|بدل|بدلي|جرب|جربي|جربوا)\\s+${ANOTHER_LOOK_AR_NOUN}(?=\\s|$|[.!؟?،,])`,
  ].join('|'),
  'u',
);

/** Whether the person asked for the other look of the page's direction. */
export function anotherLookRequested(request: string): boolean {
  if (ANOTHER_LOOK_EN.test(request)) return true;
  const folded = normalizeArabic(request).replace(/[ًٌٍَُِّْ]/gu, '');
  return ANOTHER_LOOK_AR.test(folded);
}

/** The request as the planning step sends it: the person's words, plus the B line when asked. */
export function withRequestedLook(request: string): string {
  if (!anotherLookRequested(request) || request.includes(ANOTHER_LOOK_LINE)) return request;
  return `${request}\n${ANOTHER_LOOK_LINE}`;
}

/*
  Where the page lands, said to the planner up front. The validator forces the
  host's target onto the plan's intent, and an intent's shape rules differ
  (appended sections carry no header, hero or footer): a planner that was not
  told would learn it only from a refusal, and a refusal costs a whole repair
  call.
*/
const INTENT_LINE: Readonly<Record<IntentTarget, string>> = {
  'new-page':
    'INTENT: new-page — a whole new page: optionally a header first, then one hero, then bands, optionally a footer last.',
  replace:
    'INTENT: replace — a whole page that replaces what the page holds now: optionally a header first, then one hero, then bands, optionally a footer last.',
  append:
    'INTENT: append — sections added to a page that already has its header, hero and footer: bands and calls to action only.',
};

/**
 * Where the page lands when the host did not say (P1-15): an empty page, or
 * one holding only an unfilled skeleton, is REPLACED — the "append" of a whole
 * page with a hero would be refused by the validator's shape rules, and there
 * is nothing to keep; a page with content gets sections APPENDED, the one
 * target that never removes or restyles what a person made. A host that wants
 * a new page beside this one (the router's `new-page`) adds that page and
 * builds on it.
 *
 * ONE rule for Plan mode and Build: before it was shared, a `planAiPage` with
 * no target let the model's intent stand, so on a page with seven regions
 * Plan mode's plan said 'replace' and its Build replaced the page, while a
 * direct Build there was told 'append' (wave-1 verifier, 2026-09-28).
 *
 * @internal Shared with the build.
 */
export function landingTarget(
  kernel: BuilderKernel,
  target: IntentTarget | undefined,
): IntentTarget {
  if (target !== undefined) return target;
  const summary = summarizeDocumentForIntent(kernel.getDocument());
  return summary.nodeCount === 0 || summary.placeholderOnly ? 'replace' : 'append';
}

/*
  DESIGN CODE: the markup a section writer may reach for beyond sections,
  cards and lists, each named only while the tree vocabulary admits it. The
  design-code owner is adding these to CUSTOM_CODE_TAGS and
  CUSTOM_CODE_ATTRIBUTES (2026-09-28); a brief that names a tag the door
  refuses buys one repair round per use (25-40 s measured 2026-09-27), so the
  line is read from the vocabulary, never written ahead of it. A group counts
  when its first tag, every attribute it needs and one of the attributes it
  draws with are admitted; the attributes it names are only the admitted ones
  (an svg with no path data, or a video told to loop with no `loop`, is a
  refusal the brief would have asked for).
*/
const DESIGN_MARKUP: readonly {
  readonly use: string;
  readonly tags: readonly string[];
  /** Every one admitted, or the group cannot be built at all. */
  readonly attributes?: readonly string[];
  /** At least one admitted: what the group draws with. */
  readonly anyOf?: readonly string[];
  /** Named after the use, those of them the vocabulary admits. */
  readonly mentions?: readonly string[];
}[] = [
  { use: 'a disclosure: FAQ answers, "more"', tags: ['details', 'summary'] },
  {
    use: 'a table: prices, hours, a comparison',
    tags: ['table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'],
  },
  {
    use: 'svg shapes: a divider, a blob, a mark, coloured from the region css',
    tags: ['svg', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g'],
    anyOf: ['d', 'points', 'r'],
    mentions: ['viewBox', 'viewbox', 'd', 'points', 'cx', 'cy', 'r', 'preserveAspectRatio'],
  },
  {
    use: 'a popover: a button with popovertarget opens the element with popover',
    tags: [],
    attributes: ['popover', 'popovertarget'],
  },
  {
    use: 'a video: a muted backdrop or a short clip',
    tags: ['video', 'source'],
    mentions: ['poster', 'muted', 'loop', 'playsinline', 'autoplay'],
  },
];

/**
 * The design markup a vocabulary admits, one `tags (use; attributes)` entry
 * per group, joined with " · "; '' when it admits none of them.
 *
 * @internal Exported for its test; `designMarkup` is the one caller.
 */
export function designMarkupFor(
  tags: ReadonlySet<string>,
  attributes: ReadonlySet<string>,
): string {
  return DESIGN_MARKUP.flatMap(
    ({ use, tags: wanted, attributes: needs = [], anyOf = [], mentions = [] }) => {
      const [first] = wanted;
      if (first !== undefined && !tags.has(first)) return [];
      if (!needs.every((name) => attributes.has(name))) return [];
      if (anyOf.length > 0 && !anyOf.some((name) => attributes.has(name))) return [];
      const admitted = wanted.filter((tag) => tags.has(tag));
      const named = mentions.filter((name) => attributes.has(name));
      const detail = named.length === 0 ? use : `${use}; attributes ${named.join('/')}`;
      return [`${(admitted.length === 0 ? needs : admitted).join('/')} (${detail})`];
    },
  ).join(' · ');
}

/**
 * The design markup the tree vocabulary admits TODAY (`CUSTOM_CODE_TAGS`,
 * `CUSTOM_CODE_ATTRIBUTES`).
 *
 * @internal Shared with the build's section contract.
 */
export function designMarkup(): string {
  return designMarkupFor(
    new Set<string>(CUSTOM_CODE_TAGS),
    new Set<string>(CUSTOM_CODE_ATTRIBUTES),
  );
}

/*
  The planner decides the SIGNATURE and each section's variant, so it is told
  what the writers can build with: region css and the richer markup. Without
  it a signature was a sentence the writers could only approximate with
  utilities, and a FAQ could only ever be a list.
*/
function designLine(): string {
  const markup = designMarkup();
  return `DESIGN CODE: each section's writer may build effects in its own region css — ck- classes over var(--ck-…): gradients, masks, clip-path, grain, keyframes${markup === '' ? '' : `, and markup such as ${markup}`}. Make tokens.signature an effect a writer can build with them.`;
}

/*
  The section kit and SEO, said to the planner (2026-09-30, DESIGN §B/D.1).
  The kit index — one line per kit, ≤ 2,400 characters for all of them —
  stands where the section-variants skill (~2.8k tokens) stood: a plan names
  a KIT per section, and fills its slots only where the section is short
  enough that the planner can write it whole, so it needs no writer at all.
*/
const KIT_LINE =
  'KITS: give every section except the header and footer "kit": one id below whose role fits it (hero → a hero kit; cta → a closing kit). Fill "slots" ONLY for a short section — stats, logos, a cta, a faq of 6 or fewer — so it needs no writer: slot names as listed (a name ending [] is a list of items), text in the page language, a link {"label","href"} (actions carry primaryCta), an image {"subject","alt"}. Leave "slots" out everywhere else. A local business (restaurant, café, clinic, salon, shop): its booking or contact section is kit contact-split, and that section\'s facts carry the phone, WhatsApp, opening hours and address.';
const SEO_LINE =
  'SEO: add "seo":{"keyword":"<the one phrase this page should be found by, in its language, ≤ 80 characters>","pageKind":"home|menu|product|service|about|contact|article|landing","businessType":"Restaurant|CafeOrCoffeeShop|Bakery|Dentist|MedicalClinic|LegalService|Store|BeautySalon|LocalBusiness|Organization","slug":"<2-5 words of the keyword, in the page language>"}; businessType only when the page is for one: a place people visit or call takes its kind (Restaurant, Dentist, LegalService…, else LocalBusiness); software, a SaaS, an app or an online product is an Organization, never LocalBusiness. Put the keyword in the title and the hero naturally.';

/** Whether the section kit is there to plan with: an index to show. */
export function kitsAvailable(): boolean {
  return planKitIndex() !== '';
}

/** The request as the planner reads it: the person's words, the B line when asked, where it lands, what writers can build. */
export function planningRequest(
  request: string,
  target: IntentTarget | undefined,
  kits: boolean = kitsAvailable(),
): string {
  const asked = withRequestedLook(request);
  return [
    asked,
    ...(target === undefined ? [] : [INTENT_LINE[target]]),
    designLine(),
    ...(kits ? [KIT_LINE, planKitIndex()] : []),
    SEO_LINE,
  ].join('\n');
}

/** Whether the page being planned is in Arabic: the words, the page's direction, or its lang. */
export function isArabicPage(kernel: BuilderKernel, ...texts: readonly string[]): boolean {
  if (texts.some((text) => ARABIC_SCRIPT.test(text))) return true;
  const document = kernel.getDocument();
  if (document.dir === 'rtl') return true;
  const lang: unknown = document.nodes[document.rootId]?.props['lang'];
  return typeof lang === 'string' && ARABIC_LANG.test(lang);
}

/**
 * The skills a step asks for by name, each only when the registry has it, and
 * only as many as fit.
 *
 * Explicit skills are MANDATORY to the resolver: one that does not fit the
 * skill budget fails the whole run rather than being left out. A section
 * writer that could not start because a photo catalog outgrew the budget would
 * cost the page every section, so the optional names are shed from the end
 * until the set resolves. The required head is never shed — a registry that
 * cannot hold it fails the step exactly as it did before.
 *
 * @internal Shared with the build.
 */
export function fittingSkillIds(
  registry: AiSkillRegistry | undefined,
  policy: Partial<AiAgentPolicy> | undefined,
  required: readonly string[],
  optional: readonly string[],
): readonly string[] {
  if (registry === undefined) return required;
  const present = optional.filter((id) => registry.get(id) !== undefined);
  for (let keep = present.length; keep > 0; keep -= 1) {
    const ids = [...required, ...present.slice(0, keep)];
    try {
      registry.prepare({
        request: '',
        selectedSkillIds: ids,
        auto: false,
        ...(policy?.allowUntrustedSkills === undefined
          ? {}
          : { allowUntrusted: policy.allowUntrustedSkills }),
        ...(policy?.maxActiveSkills === undefined
          ? {}
          : { maxActiveSkills: policy.maxActiveSkills }),
        ...(policy?.maxSkillTokens === undefined ? {} : { maxSkillTokens: policy.maxSkillTokens }),
      });
      return Object.freeze(ids);
    } catch {
      // Too much for the budget, or refused: try with one optional skill fewer.
    }
  }
  return required;
}

/**
 * What the planner is taught: the deck (trade rows with palettes, faces and a
 * variant per section), the variant library it names from, the copy rules and,
 * on an Arabic page, the Arabic rules. Named rather than matched — the page
 * archetypes' auto skills are markup recipes, ~2.7k tokens each of rules for
 * writing sections, and a plan writes none.
 */
export function planSkillIds(
  registry: AiSkillRegistry | undefined,
  policy: Partial<AiAgentPolicy> | undefined,
  arabic: boolean,
  kits: boolean = kitsAvailable(),
  creative: readonly string[] = [],
): readonly string[] {
  return fittingSkillIds(
    registry,
    policy,
    [],
    [
      DIRECTION_DECK,
      // The kit index replaces the variant library when there are kits to name.
      ...(kits ? [] : [SECTION_VARIANTS]),
      COPYWRITING,
      ...(arabic ? [ARABIC_RTL] : []),
      // Last, so a tight budget sheds the request's skills before the plan's own (2026-10-14).
      ...creative,
    ],
  );
}

/**
 * What the planner is sent besides the page: its request text and the skills
 * it names. `kits: false` is the planner as it was before the section kit —
 * the variant library instead of the kit index — kept so a test can hold the
 * kit planner to the old one's budget.
 *
 * @internal Exported for its test.
 */
export function pagePlanningBrief(
  kernel: BuilderKernel,
  input: {
    readonly request: string;
    readonly target?: IntentTarget;
    readonly skillRegistry?: AiSkillRegistry;
    readonly policy?: Partial<AiAgentPolicy>;
    /** Built-in skills switched off (2026-10-14), already without engine-required ones. */
    readonly excludedSkillIds?: readonly string[];
  },
  kits: boolean = kitsAvailable(),
): { readonly request: string; readonly skillIds: readonly string[] } {
  const arabic = isArabicPage(kernel, input.request);
  const excluded = excludedSkillIdsOf(input);
  return {
    request: planningRequest(input.request, input.target, kits),
    skillIds: withoutExcluded(
      planSkillIds(
        input.skillRegistry,
        input.policy,
        arabic,
        kits,
        requestSkillIdsFor(input.skillRegistry, input.request, 'page-plan', { excluded }),
      ),
      excluded,
    ),
  };
}

/**
 * The catalog view a plan needs: none. A plan names section-variant ids and
 * token values, never a block type or a prop, and the document is shown as its
 * shape — every region's tree summarised to its heading — because what the
 * page already says is the only part of it a plan must not contradict.
 */
export function planComposition(composition: AiCompositionPolicy | undefined): AiCompositionPolicy {
  return {
    ...composition,
    catalogMode: 'none',
    alwaysDetailedBlockTypes: [],
    documentTreeMode: 'scoped',
    treeScopeNodeIds: [],
  };
}

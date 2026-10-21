import { pixiSkillIdsFor } from './creative/pixi-selection';
import { CRAFTKIT_DEFAULT_SKILLS } from './defaults';
import { compileKeyword, readRequestWords, requestHasKeyword } from './keyword-match';
import type { AiSkillRegistry } from './types';

/**
 * The skills a request or a section NEEDS, chosen by a fixed table (2026-10-14).
 *
 * A build names every step's skills (`auto: false`): keyword matching on the page request once
 * handed every section writer ~10k characters of page playbooks. Naming closed that leak and
 * also shut out expertise a page plainly asks for: a sales dashboard got no chart rules, a
 * client-logo strip no verified logo names, an English "bilingual" page no RTL rules. This
 * table puts them back, deterministically, a few at a time, per lane:
 *
 * - `'host'`, `'page-plan'`, `'edit'`: what the person's REQUEST asks for;
 * - `'section'`: what one section's CONTRACT (its role, title and purpose) asks for — its
 *   recipe, its proof, its form — plus the default skills that section kind uses, so a pricing
 *   band gets the conversion recipes and a hero the design and landing rules, and no writer is
 *   handed every default the whole page matched.
 *
 * The creative set is `pixiSkillIdsFor`'s, unchanged. Everything else is capped: at most
 * `REQUEST_SKILL_MAX_ADDITIONS` skills and a token cap per call, so the table can never
 * outgrow a step's skill budget on its own. Pure: same registry, words and context, same ids.
 */

export type RequestSkillLane = 'host' | 'page-plan' | 'section' | 'edit';

export interface RequestSkillContext {
  /** A section's contract words — title and purpose (`creativeRequestOf`). Section lane. */
  readonly contractText?: string;
  /** A section's role: header, hero, band, cta or footer. Section lane. */
  readonly role?: string;
  /** Validated page design: bespoke writers do not receive automatic layout recipes. */
  readonly composition?: 'bespoke' | 'hybrid';
  /** Skills the person switched off; never returned. */
  readonly excluded?: readonly string[];
  /** Skills the step already holds; skipped without counting against the cap. */
  readonly present?: readonly string[];
  /**
   * `false`: the capped additions alone, for a step that already asks `pixiSkillIdsFor` and
   * wants its own skills offered between the two (a writer sheds from the end).
   */
  readonly creative?: boolean;
}

/** Non-creative skills one call may add. */
export const REQUEST_SKILL_MAX_ADDITIONS = 2;
/** Their token cost (each skill with its dependencies, the floor excluded), per call. */
export const REQUEST_SKILL_TOKEN_CAP = 2_500;
/*
  A section writer's cap is higher by one measured pair: a hero's design and landing rules are
  1,681 + 1,018 = 2,699 tokens (2026-10-14), and the writer's own set — fill, copy, Arabic,
  variants, photos — is ~6.5k of its 16k budget. Every step still sheds from the end
  (`fittingSkillIds`), so the cap bounds the table, not the budget.
*/
export const SECTION_SKILL_TOKEN_CAP = 2_800;

const DATA_VIZ = 'craftkit.data-viz';
const ART_NAMES = 'craftkit.art-names';
const LOGO_DESIGN = 'craftkit.logo-design';
const ARABIC_RTL = 'craftkit.arabic-rtl';
const CONVERSION_RECIPES = 'craftkit.conversion-recipes';
const STRUCTURE_RECIPES = 'craftkit.structure-recipes';
const PRO_MAX_DESIGN = 'craftkit.pro-max-design';
const PRO_MAX_LANDING = 'craftkit.pro-max-landing';
const PRO_MAX_UX = 'craftkit.pro-max-ux';
const FORMS_CONVERT = 'craftkit.forms-convert';
const NATURAL_COPY = 'craftkit.natural-copy';
const TRUST_PROOF = 'craftkit.trust-proof';
const CV_PAGE = 'craftkit.cv-page';

/** A report or dashboard asked for in the request. */
const REPORT_WORDS = [
  'waterfall',
  'heatmap',
  'treemap',
  'histogram',
  'bubble chart',
  'boxplot',
  'candlestick',
  'lollipop',
  'bullet chart',
  'key stats',
  'خريطة حرارية',
  'مدرج تكراري',
  'مخطط شلال',
  'شموع',
  'صندوقي',
  'dashboard',
  'report',
  'reports',
  'analytics',
  'kpi',
  'kpis',
  'sales figures',
  'chart',
  'charts',
  'visualize',
  'visualise',
  'داشبورد',
  'ريبورت',
  'تقرير',
  'تقارير',
  'لوحة تحكم',
  'لوحة معلومات',
  'لوحة مؤشرات',
  'إحصائيات',
  'رسم بياني',
];

/** A section whose contract shows numbers as a chart, stats or a report. */
const CHART_WORDS = [
  ...REPORT_WORDS,
  'chart',
  'charts',
  'graph',
  'stats',
  'statistics',
  'kpi',
  'kpis',
  'metrics',
  'report',
  'dashboard',
  'مخطط',
  'رسم بياني',
  'إحصائيات',
  'مؤشرات',
  'تقرير',
  'لوحة تحكم',
  'داشبورد',
];

/** English asks for a page in two languages; Arabic script already reads as Arabic. */
const BILINGUAL_WORDS = [
  'bilingual',
  'arabic and english',
  'english and arabic',
  'two languages',
  'both languages',
];

const CONVERSION_WORDS = [
  'pricing',
  'prices',
  'plans',
  'faq',
  'faqs',
  'testimonials',
  'reviews',
  'أسعار',
  'باقات',
  'أسئلة شائعة',
  'آراء',
];

const STRUCTURE_WORDS = [
  'contact',
  'team',
  'gallery',
  'timeline',
  'تواصل',
  'اتصل',
  'فريق',
  'معرض',
  'جدول زمني',
  'مسيرة',
];

const FORM_WORDS = [
  'form',
  'contact',
  'booking',
  'book',
  'signup',
  'sign up',
  'newsletter',
  'subscribe',
  'نموذج',
  'فورم',
  'حجز',
  'احجز',
  'اشتراك',
  'تواصل',
];

const PRICING_WORDS = ['pricing', 'prices', 'plans', 'أسعار', 'الأسعار', 'باقات'];

const TRUST_WORDS = [
  'testimonials',
  'reviews',
  'logos',
  'clients',
  'partners',
  'case study',
  'آراء',
  'شهادات',
  'عملاء',
  'شركاء',
  'لوجوهات',
  'شعارات',
];

/** Copy-led bands, where the words are the section. */
const COPY_WORDS = [
  'about',
  'story',
  'mission',
  'faq',
  'من نحن',
  'قصتنا',
  'رسالتنا',
  'الأسئلة الشائعة',
];

const DEFAULT_IDS: ReadonlySet<string> = new Set(CRAFTKIT_DEFAULT_SKILLS.map(({ id }) => id));
/** The ids this table adds outside the creative set and the default skills. */
const ADDED_IDS: ReadonlySet<string> = new Set([
  CV_PAGE,
  DATA_VIZ,
  ART_NAMES,
  LOGO_DESIGN,
  ARABIC_RTL,
  CONVERSION_RECIPES,
  STRUCTURE_RECIPES,
]);

type Words = ReturnType<typeof readRequestWords>;

const COMPILED = new Map<string, ReturnType<typeof compileKeyword>>();

function holdsAny(words: Words, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => {
    let compiled = COMPILED.get(keyword);
    if (compiled === undefined) {
      compiled = compileKeyword(keyword);
      COMPILED.set(keyword, compiled);
    }
    return requestHasKeyword(words, compiled);
  });
}

/** An auto skill's own keywords, so the table and the skill never disagree on its words. */
function ownKeywords(registry: AiSkillRegistry, id: string): readonly string[] {
  const activation = registry.get(id)?.activation;
  return activation?.mode === 'auto' ? (activation.keywords ?? []) : [];
}

/** What the request asks for, in priority order: the same in every lane that reads requests. */
function requestCandidates(
  registry: AiSkillRegistry,
  words: Words,
  lane: RequestSkillLane,
): readonly string[] {
  return [
    ...(lane !== 'edit' && holdsAny(words, ownKeywords(registry, CV_PAGE)) ? [CV_PAGE] : []),
    ...(holdsAny(words, ownKeywords(registry, LOGO_DESIGN)) ? [LOGO_DESIGN] : []),
    ...(holdsAny(words, REPORT_WORDS) ? [DATA_VIZ] : []),
    ...(holdsAny(words, ownKeywords(registry, ART_NAMES)) ? [ART_NAMES] : []),
    ...(holdsAny(words, BILINGUAL_WORDS) ? [ARABIC_RTL] : []),
  ];
}

/** The default skills a section of this role and contract uses, most specific first. */
function sectionDefaults(
  role: string | undefined,
  contract: Words,
  recipes: boolean,
): readonly string[] {
  const ids: string[] = [];
  if (role === 'hero') ids.push(PRO_MAX_DESIGN, ...(recipes ? [PRO_MAX_LANDING] : []));
  if (role === 'header' || role === 'footer') ids.push(PRO_MAX_UX);
  if (holdsAny(contract, FORM_WORDS)) ids.push(FORMS_CONVERT);
  if (recipes && (role === 'cta' || holdsAny(contract, PRICING_WORDS))) ids.push(PRO_MAX_LANDING);
  if (holdsAny(contract, TRUST_WORDS)) ids.push(TRUST_PROOF);
  if (holdsAny(contract, COPY_WORDS)) ids.push(NATURAL_COPY);
  return ids;
}

/** What one section's contract asks for, then the defaults its kind uses. */
function sectionCandidates(
  registry: AiSkillRegistry,
  request: Words,
  contract: Words,
  role: string | undefined,
  composition: RequestSkillContext['composition'],
): readonly string[] {
  const personal = holdsAny(request, ownKeywords(registry, CV_PAGE));
  const recipes = !personal && composition !== 'bespoke';
  return [
    ...(holdsAny(contract, ownKeywords(registry, LOGO_DESIGN)) ||
    (role === 'header' && holdsAny(request, ownKeywords(registry, LOGO_DESIGN)))
      ? [LOGO_DESIGN]
      : []),
    ...(holdsAny(contract, CHART_WORDS) ? [DATA_VIZ] : []),
    ...(personal ? [CV_PAGE] : []),
    ...(holdsAny(contract, ownKeywords(registry, ART_NAMES)) ? [ART_NAMES] : []),
    ...(recipes && holdsAny(contract, CONVERSION_WORDS) ? [CONVERSION_RECIPES] : []),
    ...(recipes && holdsAny(contract, STRUCTURE_WORDS) ? [STRUCTURE_RECIPES] : []),
    ...(holdsAny(request, BILINGUAL_WORDS) ? [ARABIC_RTL] : []),
    ...sectionDefaults(role, contract, recipes),
  ];
}

const COSTS = new WeakMap<AiSkillRegistry, Map<string, number | null>>();

/** A skill's tokens with its dependencies, the floor excluded; null when it cannot be named. */
function costOf(registry: AiSkillRegistry, id: string): number | null {
  let costs = COSTS.get(registry);
  if (costs === undefined) {
    costs = new Map();
    COSTS.set(registry, costs);
  }
  const known = costs.get(id);
  if (known !== undefined) return known;
  let cost: number | null;
  try {
    const floor = registry.prepare({ request: '', auto: false }).totalTokens;
    cost =
      registry.prepare({ request: '', selectedSkillIds: [id], auto: false }).totalTokens - floor;
  } catch {
    // Untrusted, conflicting or over budget on its own: never offered.
    cost = null;
  }
  costs.set(id, cost);
  return cost;
}

/**
 * The skill ids a request (or, in the section lane, a section) needs: the creative set first,
 * exactly as `pixiSkillIdsFor` gives it, then at most two capped additions. Ids the registry
 * lacks, the person excluded, or the step already holds are left out.
 */
export function requestSkillIdsFor(
  registry: AiSkillRegistry | undefined,
  request: string,
  lane: RequestSkillLane,
  ctx: RequestSkillContext = {},
): readonly string[] {
  if (registry === undefined) return [];
  const excluded = new Set(ctx.excluded ?? []);
  const present = new Set(ctx.present ?? []);
  const usable = (id: string): boolean => registry.get(id) !== undefined && !excluded.has(id);
  const section = lane === 'section';
  const creative =
    ctx.creative === false
      ? []
      : pixiSkillIdsFor(
          registry,
          section ? (ctx.contractText ?? request) : request,
          lane === 'page-plan' ? 'page-plan' : 'section',
        ).filter(usable);
  const words = readRequestWords(request);
  const candidates = section
    ? sectionCandidates(
        registry,
        words,
        readRequestWords(ctx.contractText ?? ''),
        ctx.role,
        ctx.composition,
      )
    : requestCandidates(registry, words, lane);
  const cap = section ? SECTION_SKILL_TOKEN_CAP : REQUEST_SKILL_TOKEN_CAP;
  const taken = new Set([...creative, ...present]);
  const added: string[] = [];
  let tokens = 0;
  for (const id of candidates) {
    if (added.length >= REQUEST_SKILL_MAX_ADDITIONS) break;
    if (taken.has(id) || !usable(id)) continue;
    const cost = costOf(registry, id);
    if (cost === null || tokens + cost > cap) continue;
    taken.add(id);
    added.push(id);
    tokens += cost;
  }
  return Object.freeze([...creative, ...added]);
}

/**
 * Host skill ids as a section writer should be offered them once it takes
 * `requestSkillIdsFor(…, 'section')`: the default skills and this table's page-level additions
 * left out (the section lane decides those per section); the person's own skills, the
 * creative set and every other id kept, in order.
 */
export function withoutRequestLaneSkillIds(ids: readonly string[]): readonly string[] {
  return Object.freeze(ids.filter((id) => !DEFAULT_IDS.has(id) && !ADDED_IDS.has(id)));
}

/** Re-exported for the package entry: the creative half of this table. */
export { pixiSkillIdsFor } from './creative/pixi-selection';
export { explicitRequestSkillIdsFor } from './design-requests';

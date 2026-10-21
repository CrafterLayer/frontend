import type { PlanStreamEvent } from './plan-stream';
import type { PagePlan, SectionContract } from './types';

/*
  The streamed plan's draft state (DESIGN §5.4, 2026-10-05): what the reader
  has delivered so far — the head (outline) and the briefs that closed — and
  how a provisional plan built from it is reconciled with the final one.

  Pure: every function returns a new value and touches nothing else. The
  final plan is always the authority; these only decide what speculative
  work can be kept.
*/

export interface PlanDraft {
  readonly rationale?: string;
  /** `pagePlan`'s keys up to and including `sections`, as the reader parsed them. */
  readonly head: Readonly<Record<string, unknown>>;
  /** The briefs that closed, by `brief.key`; a later brief for the same key wins. */
  readonly briefs: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The outline's section objects, in page order (records only). */
function outline(draft: PlanDraft): readonly Readonly<Record<string, unknown>>[] {
  const sections = draft.head['sections'];
  return Array.isArray(sections) ? sections.filter(isPlainRecord) : [];
}

export function startPlanDraft(head: Extract<PlanStreamEvent, { kind: 'head' }>): PlanDraft {
  return {
    ...(head.rationale === undefined ? {} : { rationale: head.rationale }),
    head: head.candidate,
    briefs: new Map(),
  };
}

/** The draft with `brief` received. A brief without a string `key` changes nothing. */
export function withBrief(draft: PlanDraft, brief: Readonly<Record<string, unknown>>): PlanDraft {
  const key = brief['key'];
  if (typeof key !== 'string' || key === '') return draft;
  const briefs = new Map(draft.briefs);
  briefs.set(key, brief);
  return { ...draft, briefs };
}

/**
 * Whether the brief for `key` has arrived. A classic section — one whose own
 * outline object already carries a `purpose` — answers false: the classic
 * shape has no briefs, so its writer waits for the final plan.
 */
export function briefArrived(draft: PlanDraft, key: string): boolean {
  const section = outline(draft).find((each) => each['key'] === key);
  if (section !== undefined && typeof section['purpose'] === 'string') return false;
  return draft.briefs.has(key);
}

/**
 * The head plus the received briefs as `briefs`, in outline order — the
 * candidate `validatePagePlan` expands (a section whose brief has not come
 * gets `purpose = title` with a warning there). No brief yet → the head alone,
 * so a classic head validates exactly as the classic shape does.
 */
export function provisionalCandidate(draft: PlanDraft): Readonly<Record<string, unknown>> {
  const briefs = outline(draft)
    .map((section) => section['key'])
    .filter((key): key is string => typeof key === 'string')
    .map((key) => draft.briefs.get(key))
    .filter((brief): brief is Readonly<Record<string, unknown>> => brief !== undefined);
  return briefs.length === 0 ? { ...draft.head } : { ...draft.head, briefs };
}

/** JSON with every object's keys sorted, `undefined` members left out: equal data, equal text. */
function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item: unknown) => stableJson(item)).join(',')}]`;
  if (isPlainRecord(value)) {
    const members = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${members.join(',')}}`;
  }
  return JSON.stringify(value);
}

function contractOf(section: SectionContract): Record<string, unknown> {
  return {
    key: section.key,
    role: section.role,
    title: section.title,
    anchorId: section.anchorId,
    purpose: section.purpose,
    mustSay: section.mustSay,
    mustNotRepeat: section.mustNotRepeat,
    layout: section.layout,
    variant: section.variant,
    kit: section.kit,
    slots: section.slots,
    images: section.images,
  };
}

/**
 * Stable JSON of what a writer reads for `key`: its contract, its facts, the
 * page's tokens, primary action, title and locale, the section count and its
 * position, and the nav for the header and footer. Undefined when the plan
 * has no section with that key.
 */
export function sectionFingerprint(plan: PagePlan, key: string): string | undefined {
  const position = plan.sections.findIndex((section) => section.key === key);
  const section = plan.sections[position];
  if (section === undefined) return undefined;
  const chrome = section.role === 'header' || section.role === 'footer';
  return stableJson({
    contract: contractOf(section),
    facts: plan.facts.filter((fact) => fact.section === key),
    design: plan.design,
    tokens: plan.tokens,
    primaryCta: plan.primaryCta,
    title: plan.title,
    locale: plan.locale,
    count: plan.sections.length,
    position,
    ...(chrome ? { nav: plan.nav } : {}),
  });
}

export interface PlanReconciliation {
  /** Same intent and the same keys in order with the same role/title/anchorId/variant/kit. */
  readonly sameOutline: boolean;
  /** title/description/locale/tokens/primaryCta/nav differ. */
  readonly headChanged: boolean;
  /** Sections whose fingerprint differs: the final plan's order, then keys only the provisional had. */
  readonly changedKeys: readonly string[];
}

function outlineKey(section: SectionContract): string {
  return stableJson({
    key: section.key,
    role: section.role,
    title: section.title,
    anchorId: section.anchorId,
    variant: section.variant,
    kit: section.kit,
  });
}

/** How the final plan differs from the provisional one the build speculated on. */
export function reconcilePlans(provisional: PagePlan, final: PagePlan): PlanReconciliation {
  const sameOutline =
    provisional.intent === final.intent &&
    provisional.sections.length === final.sections.length &&
    provisional.sections.every((section, index) => {
      const other = final.sections[index];
      return other !== undefined && outlineKey(section) === outlineKey(other);
    });
  const head = (plan: PagePlan) =>
    stableJson({
      title: plan.title,
      description: plan.description,
      locale: plan.locale,
      design: plan.design,
      tokens: plan.tokens,
      primaryCta: plan.primaryCta,
      nav: plan.nav,
    });
  const keys = [
    ...final.sections.map(({ key }) => key),
    ...provisional.sections
      .map(({ key }) => key)
      .filter((key) => !final.sections.some((section) => section.key === key)),
  ];
  return {
    sameOutline,
    headChanged: head(provisional) !== head(final),
    changedKeys: keys.filter(
      (key) => sectionFingerprint(provisional, key) !== sectionFingerprint(final, key),
    ),
  };
}

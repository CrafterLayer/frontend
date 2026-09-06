import type { JsonValue } from '@craftkit/builder-schema';

import type { AiPlanStep } from '../types';

/**
 * The contract for a SITE built in stages, rather than a page proposed in one
 * call.
 *
 * ## Why five envelopes and not one
 *
 * A whole site is too much to ask for at once — the answer would be tens of
 * thousands of tokens, unvalidatable until the end, and unrecoverable when one
 * paragraph of it is wrong. Splitting it means each stage is small enough to
 * validate on arrival, and a failure costs one stage rather than the site.
 *
 * The stages are ordered because each genuinely needs the last: you cannot
 * write the structure of a page nobody has named, or fill a section that does
 * not exist. That ordering is the whole reason this is a pipeline and not four
 * parallel calls.
 *
 * ## Why every envelope carries its own seed and fingerprint
 *
 * Self-contained on purpose. A stage request is a complete question — the
 * server needs no memory of the last one, so a retry, a resume after a reload,
 * or a stage re-run on a different machine all ask exactly the same thing and
 * get exactly the same answer. A pipeline that relied on server-side session
 * state would be unresumable, which is the property the whole draft/journal
 * design exists to protect.
 */

export const SITE_STAGE_WIRE_VERSION = 1;

/** The stages, in the order they must run. */
export const SITE_STAGES = [
  'sitemap',
  'structure',
  'content',
  'design-system',
  'assembly',
] as const;

export type SiteStage = (typeof SITE_STAGES)[number];

/**
 * What every stage request carries, whatever it is asking for.
 *
 * `attempt` is the repair channel and it counts from 1. Two is the ceiling
 * everywhere else in this package, and a stage is no different: a model that
 * produced an invalid answer twice will produce a third.
 */
export interface StageEnvelope {
  readonly version: typeof SITE_STAGE_WIRE_VERSION;
  readonly stage: SiteStage;
  /** The whole run, so a server can correlate its own logs. */
  readonly runId: string;
  /** This stage's own id within the run: `<runId>/<stage>`. */
  readonly stageId: string;
  /**
   * The determinism seed.
   *
   * Carried on every stage rather than agreed once, so a stage re-run in
   * isolation — after a reload, on another machine, in a test — asks the
   * identical question. A seed held only by the orchestrator would make a
   * resumed pipeline produce a different site from the one it was resuming.
   */
  readonly seed: string;
  readonly attempt: 1 | 2;
  /** What the site looked like when the run began, so a stale answer is detectable. */
  readonly baseFingerprint: string;
  readonly dir: 'ltr' | 'rtl';
  readonly locale?: string;
  /** The bounds this stage must stay inside. Reported when exceeded, never truncated. */
  readonly limits: StageLimits;
}

/**
 * The ceilings a stage answer is held to.
 *
 * Reported rather than enforced by truncation: a site cut off at the limit is a
 * site that lies about what was asked for, and a person shown "12 pages" who
 * received 4 has no way to know. A stage that exceeds its bound FAILS, and the
 * failure names the bound.
 */
export interface StageLimits {
  readonly maxPages: number;
  readonly maxSectionsPerPage: number;
  readonly maxTokens: number;
}

/* ------------------------------------------------------------------------- */
/* 1. SITEMAP — what pages exist, and what each is for                        */
/* ------------------------------------------------------------------------- */

export interface SitemapRequest extends StageEnvelope {
  readonly stage: 'sitemap';
  /** The person's own words. Never rewritten before it is sent. */
  readonly brief: string;
}

export interface SitemapPage {
  /** URL-safe, unique within the site, and stable for the life of the run. */
  readonly id: string;
  readonly title: string;
  /** One sentence: what this page is for. Every later stage obeys it. */
  readonly purpose: string;
}

export interface SitemapResponse {
  readonly stage: 'sitemap';
  readonly pages: readonly SitemapPage[];
  /** The site's own direction, decided once, here. */
  readonly dir: 'ltr' | 'rtl';
}

/* ------------------------------------------------------------------------- */
/* 2. STRUCTURE — what sections each page has, and of what BLOCK TYPES        */
/* ------------------------------------------------------------------------- */

export interface StructureRequest extends StageEnvelope {
  readonly stage: 'structure';
  readonly brief: string;
  readonly pages: readonly SitemapPage[];
  /**
   * Every block type this run may name, from the live registry.
   *
   * Sent rather than assumed: a section naming a type nobody registered is a
   * stage FAILURE, not an invention to be repaired downstream. The alternative
   * — letting the assembly stage discover it — spends four more calls before
   * finding out.
   */
  readonly blockTypes: readonly string[];
}

export interface StructureSection {
  /** Unique within its page; the content stage addresses sections by this. */
  readonly id: string;
  /** A registered block type. Anything else fails the stage. */
  readonly type: string;
  /** What this section is for, in one line. The content stage obeys it. */
  readonly intent: string;
}

export interface StructurePage {
  readonly pageId: string;
  readonly sections: readonly StructureSection[];
}

export interface StructureResponse {
  readonly stage: 'structure';
  readonly pages: readonly StructurePage[];
}

/* ------------------------------------------------------------------------- */
/* 3. CONTENT — the words                                                     */
/* ------------------------------------------------------------------------- */

export interface ContentRequest extends StageEnvelope {
  readonly stage: 'content';
  readonly brief: string;
  readonly page: SitemapPage;
  readonly sections: readonly StructureSection[];
}

export interface ContentSection {
  readonly sectionId: string;
  /** The block's props, as the block's own schema will validate them. */
  readonly props: Readonly<Record<string, JsonValue>>;
}

export interface ContentResponse {
  readonly stage: 'content';
  readonly pageId: string;
  readonly sections: readonly ContentSection[];
}

/* ------------------------------------------------------------------------- */
/* 4. DESIGN SYSTEM — the palette, the faces, the scale                       */
/* ------------------------------------------------------------------------- */

export interface DesignSystemRequest extends StageEnvelope {
  readonly stage: 'design-system';
  readonly brief: string;
  readonly pages: readonly SitemapPage[];
}

export interface DesignSystemResponse {
  readonly stage: 'design-system';
  /**
   * A `DesignSystem` as the schema defines it, validated by
   * `validateDesignSystem` before anything downstream sees it.
   *
   * Typed as JSON on the wire rather than as the interface: the wire is a
   * contract with a server that may be a version behind, and the validator is
   * the door. Typing it strictly here would move the refusal to `JSON.parse`,
   * where it has no message worth reading.
   */
  readonly designSystem: JsonValue;
}

/* ------------------------------------------------------------------------- */
/* 5. ASSEMBLY — commands, and only commands                                  */
/* ------------------------------------------------------------------------- */

export interface AssemblyRequest extends StageEnvelope {
  readonly stage: 'assembly';
  readonly pages: readonly SitemapPage[];
  readonly structure: readonly StructurePage[];
  readonly content: readonly ContentResponse[];
  readonly designSystem: JsonValue;
}

/**
 * One command in an assembly answer, and the page it belongs to.
 *
 * ## Why `page` is a SITEMAP id and not a `PageId`
 *
 * Because the real one does not exist yet. `addPage` mints its id from the
 * kernel's own port when the batch runs (Law D), so a stage naming a `PageId`
 * would be inventing an id the kernel owns — and the invented one would be
 * wrong on every run.
 *
 * The sitemap id, on the other hand, has been stable since the first stage and
 * every stage after it addresses pages by exactly that. So a page command says
 * which SITEMAP page it edits, and the applier — which watches the pages come
 * into existence — is the one thing that knows what that turned into.
 */
export interface AssemblyStep extends AiPlanStep {
  /** The sitemap page this command edits. Absent for site-wide commands. */
  readonly page?: string;
}

export interface AssemblyResponse {
  readonly stage: 'assembly';
  /**
   * COMMANDS, never a document and never a site object.
   *
   * The site is built by the door, from steps the door validated — the same
   * rule the plan path has followed since the beginning. A stage that returned
   * a finished site would be a second way to write one, with none of the
   * validation the first way has.
   */
  readonly commands: readonly AssemblyStep[];
}

/* ------------------------------------------------------------------------- */

export type StageRequest =
  SitemapRequest | StructureRequest | ContentRequest | DesignSystemRequest | AssemblyRequest;

export type StageResponse =
  SitemapResponse | StructureResponse | ContentResponse | DesignSystemResponse | AssemblyResponse;

/** The response shape a given stage must produce. */
export type ResponseFor<S extends SiteStage> = Extract<StageResponse, { stage: S }>;

/** The request shape a given stage is asked with. */
export type RequestFor<S extends SiteStage> = Extract<StageRequest, { stage: S }>;

/** `<runId>/<stage>` — the id a stage's own events and logs carry. */
export function stageId(runId: string, stage: SiteStage): string {
  return `${runId}/${stage}`;
}

import { applySiteCommands, generateSite } from '@craftkit/builder';
import type { AssetEntry, AssetLibraryPort } from '@craftkit/builder';
import type {
  BuilderKernel,
  BuilderSite,
  BuilderSiteKernel,
  SiteStageProvider,
  StageEvent,
  StageLimits,
} from '@craftkit/builder';

import { commitSite, fingerprintSite } from '../../../vault';

/**
 * A whole site from one sentence — and exactly ONE write in the whole of it.
 *
 * ## The organising decision
 *
 * `generateSite` is handed no kernel and returns commands; `applySiteCommands`
 * writes only into a throwaway; `commitSite` is a single `applySitePatches`.
 * So the run keeps every byte out of the live site until one synchronous call
 * at the end, and that call refuses before it computes anything.
 *
 * That is what makes "a Stop leaves the live site byte-identical" true by
 * CONSTRUCTION rather than by cleanup. Nothing here has to be undone on the
 * failure paths, because nothing on them ever wrote.
 *
 * ## Why the draft is a `const` inside this function
 *
 * It is created here, used here, and goes out of scope here — never in React
 * state, never in a ref, never persisted. It holds nothing that needs
 * disposing: no persistence adapter, no timer, no subscription. A draft kept in
 * a ref would outlive the run that owns it, and the first thing to go wrong
 * would be two runs sharing one.
 *
 * (Surviving a RELOAD is a different promise with a different price — a
 * persisted draft and a run journal — and it belongs to the interrupted-run
 * work, not here. What this function guarantees is narrower and complete: the
 * live site is never half built.)
 *
 * ## No React
 *
 * Deliberately a plain async function. It is the piece where atomicity lives,
 * so it is testable with two hand-built kernels and a scripted provider, with
 * no renderer in the way.
 */

export interface SiteRunHost {
  /** The kernel that owns the real site. Written to exactly once, at the end. */
  readonly kernel: BuilderSiteKernel;
  /**
   * Makes the throwaway a run writes into.
   *
   * A port because a correct draft needs the host's own extensions and ports —
   * the same registry the commit will validate against, and an id port that
   * does not collide with the live site's. The panel does not know either; the
   * app that built the live kernel does.
   */
  readonly createDraft: (site: BuilderSite) => BuilderSiteKernel;
  /** The five-stage provider. Offline in the playground until a server is wired. */
  readonly provider: SiteStageProvider;
  /**
   * Where the run's pictures come from. Absent means a text-only site, which is
   * a site — an unwired library is not a failure (FR-051).
   */
  readonly library?: AssetLibraryPort | undefined;
  /** Commands the assembly stage may emit. */
  readonly allowedCommands?: readonly string[] | undefined;
  readonly limits?: StageLimits | undefined;
}

export type SiteRunOutcome =
  | { readonly ok: true; readonly pages: number; readonly patches: number }
  | { readonly ok: false; readonly reason: string; readonly cancelled?: boolean | undefined };

export interface RunSiteGenerationOptions {
  readonly host: SiteRunHost;
  readonly runId: string;
  readonly brief: string;
  /** Determinism: the same brief and seed produce the same site (SC-013). */
  readonly seed: string;
  readonly signal?: AbortSignal | undefined;
  readonly onStage?: ((event: StageEvent) => void) | undefined;
}

export const DEFAULT_SITE_LIMITS: StageLimits = {
  maxPages: 4,
  maxSectionsPerPage: 4,
  maxTokens: 20_000,
};

const DEFAULT_SITE_COMMANDS = ['addPage', 'insertNode', 'setDesignSystem'] as const;

/** What history shows. The person's own words, and how many pages they bought. */
export function siteRunLabel(brief: string, pages: number): string {
  const words = brief.trim().replace(/\s+/gu, ' ');
  const short = words.length > 60 ? `${words.slice(0, 57)}…` : words;
  return `AI: ${short} (${String(pages)} pages)`;
}

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException ? error.name === 'AbortError' : false;

/** A new page's root, as `emptyDocument` builds it. Every generated section goes here. */
const PAGE_ROOT_TYPE = 'page';
const PAGE_ROOT_SLOT = 'default';

/**
 * The types a generated SECTION may actually be.
 *
 * Not every registered block: the registry also holds the page ROOT itself, and
 * a structure stage handed the whole list will eventually name it — at which
 * point every stage validates, the commit is refused with `Slot "default" of
 * "root" accepts [...], not "page"`, and a run that took minutes is thrown
 * away for a reason nobody could have acted on.
 *
 * The assembly inserts into a new page's root, so the honest list is exactly
 * what that root's default slot admits. A build whose root declares no slot
 * falls back to the full vocabulary rather than sending an empty list, because
 * an empty list makes the structure stage fail its own validator instead.
 */
export function sectionTypesFor(page: BuilderKernel): readonly string[] {
  const registry = page.context.registry;
  const every = registry.blocks(page.context.surface).map((entry) => entry.schema.type);
  const allow = registry.block(PAGE_ROOT_TYPE)?.schema.slots?.[PAGE_ROOT_SLOT]?.allow;
  if (allow === undefined || allow.length === 0) {
    return every;
  }
  /* Intersected, not trusted: a slot may name a type this surface does not register. */
  const known = new Set(every);
  const usable = allow.filter((type) => known.has(type));
  return usable.length === 0 ? every : usable;
}

/**
 * The bounds the DOOR will actually honour.
 *
 * The same mistake as the type list, one field along: a run told it may write
 * four sections a page, against a root slot that admits two, produces a
 * structure every stage validates and a commit that refuses with
 * `Slot "default" of "root" is full`. The bound a run is given must be the
 * bound it will be held to.
 */
export function limitsFor(page: BuilderKernel, asked: StageLimits): StageLimits {
  const max = page.context.registry.block(PAGE_ROOT_TYPE)?.schema.slots?.[PAGE_ROOT_SLOT]?.max;
  return max === undefined || max >= asked.maxSectionsPerPage
    ? asked
    : { ...asked, maxSectionsPerPage: max };
}

/**
 * The library's answer, or an empty one.
 *
 * Swallowing the rejection is the requirement, not laziness: a site with no
 * pictures is a site, and a run that failed because a picture store was down
 * would be refusing to build a perfectly good text site (FR-051). What must
 * never happen — inventing an address to fill the gap — is impossible further
 * down, where an image position can only hold a real id or a labelled absence.
 */
async function listAssets(
  library: AssetLibraryPort | undefined,
  signal: AbortSignal | undefined,
): Promise<readonly AssetEntry[]> {
  if (library === undefined) return [];
  try {
    return await library.list(signal === undefined ? {} : { signal });
  } catch {
    return [];
  }
}

export async function runSiteGeneration(
  options: RunSiteGenerationOptions,
): Promise<SiteRunOutcome> {
  const { host, runId, brief, seed, signal, onStage } = options;
  const live = host.kernel.getSite();
  const baseFingerprint = fingerprintSite(live);
  const page = host.kernel.page(host.kernel.currentPage());
  const blockTypes = sectionTypesFor(page);
  const limits = limitsFor(page, host.limits ?? DEFAULT_SITE_LIMITS);

  const draft = host.createDraft(live);

  /*
    The catalogue is read ONCE, before the stages, and the same list is given to
    two places: the assembly stage, so it can only choose from pictures that
    exist, and the applier, so every chosen picture is registered in the site's
    own asset table before the command that uses it. Reading it twice would let
    the two disagree — the stage choosing a picture the applier no longer has.

    A library that cannot answer is not a failure. The run continues with an
    empty catalogue and the positions come back as labelled absences.
  */
  const entries = await listAssets(host.library, signal);
  const assets = Object.fromEntries(entries.map((entry) => [entry.id, entry]));

  let generated;
  try {
    generated = await generateSite({
      runId,
      brief,
      provider: host.provider,
      seed,
      baseFingerprint,
      dir: live.dir,
      limits,
      blockTypes,
      allowedCommands: host.allowedCommands ?? [...DEFAULT_SITE_COMMANDS],
      assets: entries.map(({ url: _url, width: _width, height: _height, ...rest }) => rest),
      ...(signal === undefined ? {} : { signal }),
      ...(onStage === undefined ? {} : { onStage }),
    });
  } catch (error: unknown) {
    /*
      Cancellation and failure end the same way HERE — with nothing written —
      and are told apart only so the panel can say which happened. A person who
      pressed Stop is not shown an error.
    */
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'The site could not be generated.',
      cancelled: isAbort(error),
    };
  }

  const applied = applySiteCommands({ kernel: draft, commands: generated.commands, assets });
  if (!applied.ok) {
    return { ok: false, reason: applied.refusal.reason };
  }

  /*
    Checked after the work and before the write. A run takes minutes and a
    person may have pressed Stop in the last of them; committing then would be
    landing work they had already told us to abandon.
  */
  if (signal?.aborted === true) {
    return {
      ok: false,
      reason: 'The run was stopped before anything was applied.',
      cancelled: true,
    };
  }

  const outcome = commitSite({
    live: host.kernel,
    draft: draft.getSite(),
    baseFingerprint,
    label: siteRunLabel(brief, generated.pages.length),
  });
  return outcome.ok
    ? { ok: true, pages: generated.pages.length, patches: outcome.patches }
    : { ok: false, reason: outcome.reason };
}

import type { DesignSystem, JsonValue } from '@craftkit/builder-schema';

import type { AssemblyStep } from './wire';
import { StageRejectedError, isStageRejected } from './stages/errors';
import { validateAssembly } from './stages/assembly';
import { validateContent } from './stages/content';
import { validateStageDesignSystem } from './stages/design-system';
import { validateSitemap } from './stages/sitemap';
import { validateStructure } from './stages/structure';
import type { SiteStageProvider, StageOptions } from './stage-provider';
import {
  SITE_STAGE_WIRE_VERSION,
  stageId,
  type ContentResponse,
  type SiteStage,
  type SitemapPage,
  type StageLimits,
  type StructurePage,
} from './wire';

/**
 * A site, built in five stages, validated between each.
 *
 * ## The one rule the whole file exists to keep
 *
 * NOTHING is written until every stage has passed. `generateSite` returns
 * COMMANDS; it does not touch a kernel, and it could not if it wanted to — no
 * kernel is passed in. The caller sends those commands through the same door a
 * plan goes through, which is what makes a failure at stage four cost four
 * calls and zero bytes of a person's document.
 *
 * That is also why the atomicity requirement is satisfiable at all. "A failure
 * at stage 4 leaves the workspace byte-identical" is trivially true when stage
 * 4 could never have written to it.
 *
 * ## Why each stage is validated before the next begins
 *
 * Because the cost of finding out late is the whole site. A structure naming an
 * unregistered block is discoverable the moment structure lands; discovered at
 * assembly instead, it has already been paid for with a content call per page.
 *
 * ## Concurrency
 *
 * Content is the only stage that runs per PAGE, and its pages are independent —
 * each is written against its own sitemap entry and its own sections. They run
 * with a small pool for the same reason the section fills do: a four-page site
 * is four round trips, and doing them one at a time triples the wait for no
 * gain in quality.
 */

export interface GenerateSiteOptions {
  readonly runId: string;
  readonly brief: string;
  readonly provider: SiteStageProvider;
  /** Determinism seed, carried on every stage envelope. */
  readonly seed: string;
  /** What the site looked like when the run began. */
  readonly baseFingerprint: string;
  readonly dir: 'ltr' | 'rtl';
  readonly locale?: string;
  readonly limits: StageLimits;
  /** Every block type the run may name. Sent to the structure stage. */
  readonly blockTypes: readonly string[];
  /** Commands the assembly stage may emit. */
  readonly allowedCommands: readonly string[];
  readonly signal?: AbortSignal | undefined;
  /** Told when each stage starts and finishes, in order. */
  readonly onStage?: ((event: StageEvent) => void) | undefined;
  readonly onProgress?: ((text: string) => void) | undefined;
  /** How many content pages are written at once. Default 3. */
  readonly contentConcurrency?: number;
}

export type StageEvent =
  | { readonly type: 'stage.started'; readonly stage: SiteStage; readonly attempt: 1 | 2 }
  | { readonly type: 'stage.done'; readonly stage: SiteStage }
  | {
      readonly type: 'stage.rejected';
      readonly stage: SiteStage;
      readonly reasons: readonly string[];
      /** True when the run is about to ask the same stage again. */
      readonly retrying: boolean;
    };

export interface GeneratedSite {
  readonly runId: string;
  readonly pages: readonly SitemapPage[];
  readonly structure: readonly StructurePage[];
  readonly content: readonly ContentResponse[];
  readonly designSystem: DesignSystem;
  /** What the caller sends through the door. Nothing here has been applied. */
  readonly commands: readonly AssemblyStep[];
}

const DEFAULT_CONTENT_CONCURRENCY = 3;

function abortedError(): Error {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export async function generateSite(options: GenerateSiteOptions): Promise<GeneratedSite> {
  const {
    runId,
    brief,
    provider,
    seed,
    baseFingerprint,
    dir,
    limits,
    blockTypes,
    allowedCommands,
    signal,
    onStage,
    onProgress,
  } = options;

  const stop = (): void => {
    if (signal?.aborted === true) throw abortedError();
  };

  const envelope = <S extends SiteStage>(stage: S, attempt: 1 | 2) =>
    ({
      version: SITE_STAGE_WIRE_VERSION,
      stage,
      runId,
      stageId: stageId(runId, stage),
      seed,
      attempt,
      baseFingerprint,
      dir,
      ...(options.locale === undefined ? {} : { locale: options.locale }),
      limits,
    }) as const;

  const stageOptions: StageOptions = {
    ...(signal === undefined ? {} : { signal }),
    ...(onProgress === undefined ? {} : { onProgress }),
  };

  /**
   * Ask a stage, validate what comes back, and ask ONCE more if the answer was
   * repairable.
   *
   * Two attempts, never three — the same ceiling the plan path uses, and for
   * the same reason: a model that produced an invalid answer twice will produce
   * a third. A rejection marked non-repairable (a made-up block type, when the
   * list was sent) skips the retry entirely rather than spending a call to be
   * told the same thing.
   */
  const runStage = async <T>(stage: SiteStage, ask: (attempt: 1 | 2) => Promise<T>): Promise<T> => {
    for (const attempt of [1, 2] as const) {
      stop();
      onStage?.({ type: 'stage.started', stage, attempt });
      try {
        const value = await ask(attempt);
        onStage?.({ type: 'stage.done', stage });
        return value;
      } catch (cause: unknown) {
        if (signal?.aborted === true) throw cause;
        if (!isStageRejected(cause)) throw cause;
        const retrying = attempt === 1 && cause.repairable;
        onStage?.({ type: 'stage.rejected', stage, reasons: cause.reasons, retrying });
        if (!retrying) throw cause;
      }
    }
    /* v8 ignore next 2 -- the loop either returns or throws on the second pass. */
    throw new StageRejectedError(stage, ['The stage did not settle.'], false);
  };

  /* ---- 1. sitemap -------------------------------------------------------- */
  const pages = await runStage('sitemap', async (attempt) =>
    validateSitemap(
      await provider.run({ ...envelope('sitemap', attempt), brief }, stageOptions),
      limits,
    ),
  );

  /* ---- 2. structure ------------------------------------------------------ */
  const structure = await runStage('structure', async (attempt) =>
    validateStructure(
      await provider.run(
        { ...envelope('structure', attempt), brief, pages, blockTypes },
        stageOptions,
      ),
      pages,
      blockTypes,
      limits,
    ),
  );

  /* ---- 3. content, per page, with a small pool --------------------------- */
  const content = await runStage('content', async (attempt) => {
    const written: ContentResponse[] = [];
    const queue = [...pages];
    const width = Math.max(1, options.contentConcurrency ?? DEFAULT_CONTENT_CONCURRENCY);

    const worker = async (): Promise<void> => {
      for (;;) {
        const page = queue.shift();
        if (page === undefined) return;
        stop();
        const sections = structure.find((entry) => entry.pageId === page.id)?.sections ?? [];
        const response = await provider.run(
          { ...envelope('content', attempt), brief, page, sections },
          stageOptions,
        );
        validateContent(response, sections);
        written.push(response);
      }
    };

    await Promise.all(Array.from({ length: Math.min(width, queue.length) }, worker));
    /*
      Sorted back into PAGE order after the pool. The writers finish out of
      order by design, and a caller reading `content[0]` must get the first
      page, not whichever one was quickest.
    */
    return written.sort(
      (left, right) =>
        pages.findIndex((page) => page.id === left.pageId) -
        pages.findIndex((page) => page.id === right.pageId),
    );
  });

  /* ---- 4. design system -------------------------------------------------- */
  const designSystem = await runStage('design-system', async (attempt) =>
    validateStageDesignSystem(
      await provider.run({ ...envelope('design-system', attempt), brief, pages }, stageOptions),
    ),
  );

  /* ---- 5. assembly ------------------------------------------------------- */
  const commands = await runStage('assembly', async (attempt) =>
    validateAssembly(
      await provider.run(
        {
          ...envelope('assembly', attempt),
          pages,
          structure,
          content,
          /*
            A `DesignSystem` IS JSON — the validator that produced it only
            admits JSON-representable values — but the wire types it as
            `JsonValue` on purpose, so a server a version behind is refused by
            the validator with a readable message rather than by `JSON.parse`.
            One cast, here, where the two facts meet.
          */
          designSystem: designSystem as unknown as JsonValue,
        },
        stageOptions,
      ),
      allowedCommands,
    ),
  );

  return { runId, pages, structure, content, designSystem, commands };
}

import { useCallback, useMemo, useRef, useState } from 'react';

import { systemIds, type GenerationStage, type StageEvent } from '@craftkit/builder';

import { runSiteGeneration, type SiteRunHost, type SiteRunOutcome } from './AssistantPanel.siteRun';

/**
 * The React seam around `runSiteGeneration`, so the panel stays a composition
 * shell.
 *
 * Everything that decides anything — the draft, the stages, the one write —
 * lives in the pure module. What is here is only what React has to own: five
 * rows that change while a run goes, one sentence when it ends, and the panel's
 * single lease so a site run and a page run can never both think they own it.
 */

/*
  The pipeline says `design-system`; the card's vocabulary says `design`. One
  key, renamed in one place. The card's ids are what a person reads a label
  from, and the pipeline's are what a stage envelope carries — renaming a stage
  in the UI must never rename a wire field, which is why the two lists are
  allowed to differ at all.
*/
const STAGE_IDS = ['sitemap', 'structure', 'content', 'design', 'assembly'] as const;
type CardStageId = (typeof STAGE_IDS)[number];

const cardStage = (stage: StageEvent['stage']): CardStageId =>
  stage === 'design-system' ? 'design' : stage;

const PENDING: readonly GenerationStage[] = STAGE_IDS.map((id) => ({ id, status: 'pending' }));

/** The panel's one lease, handed in rather than re-created. */
export interface SiteRunSeam {
  /** True when ANY run owns the panel — a page run counts. */
  readonly busy: boolean;
  /** Take the lease. False when another run already holds it. */
  readonly claim: (runId: string, controller: AbortController) => boolean;
  /** Give it back, if this run still holds it. */
  readonly release: (runId: string) => void;
  /** Abort whichever run holds it, whoever started it. */
  readonly stop: () => void;
}

/**
 * A seam that owns nothing, for before the panel that holds the lease exists.
 *
 * The site builder can be the first destination a person opens, and a panel
 * that has not mounted has no lease to lend. Refusing to claim is the honest
 * answer — the alternative is a run with no way to be stopped.
 */
export const IDLE_SITE_RUN_SEAM: SiteRunSeam = {
  busy: false,
  claim: () => false,
  release: () => undefined,
  stop: () => undefined,
};

export interface SiteRunState {
  readonly stages: readonly GenerationStage[];
  readonly running: boolean;
  /** What the last run came to, in one sentence. Absent before the first. */
  readonly outcome: { readonly ok: boolean; readonly message: string } | undefined;
  /**
   * ADMITS a brief. Resolves with a reason when the run could not start, and
   * with `undefined` the moment it did — not when it finishes.
   *
   * That distinction is forced and it is right. `SiteBriefForm` drives this
   * from a React Action, and every state update made inside an Action is a
   * TRANSITION update: React holds the re-render until the whole action
   * settles. A `start` that awaited the run would therefore have made the
   * progress card impossible — five stages, minutes long, and not one frame of
   * it visible until the moment it was over.
   *
   * So the Action's job ends at admission, and the run reports itself through
   * `stages` and `outcome`, which change outside any transition.
   */
  readonly start: (brief: string) => Promise<string | undefined>;
}

export function useSiteRun(host: SiteRunHost | undefined, seam: SiteRunSeam): SiteRunState {
  const [stages, setStages] = useState<readonly GenerationStage[]>(PENDING);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<SiteRunState['outcome']>(undefined);
  /* Which run these rows belong to, so a superseded run cannot repaint them. */
  const ownRef = useRef<string | null>(null);

  const start = useCallback(
    (brief: string): Promise<string | undefined> => {
      if (host === undefined) {
        return Promise.resolve('This build has no site to write into.');
      }
      if (seam.busy) {
        return Promise.resolve('A run is already going. Stop it before starting another.');
      }

      const runId = systemIds.newId();
      const controller = new AbortController();
      if (!seam.claim(runId, controller)) {
        return Promise.resolve('A run is already going. Stop it before starting another.');
      }
      ownRef.current = runId;
      setStages(PENDING);
      setOutcome(undefined);
      setRunning(true);

      const mine = (): boolean => ownRef.current === runId;

      /*
        Started, not awaited. The caller is a React Action and its transition
        must be allowed to settle NOW; everything after this point reports
        itself through ordinary state.
      */
      void (async () => {
        let result: SiteRunOutcome;
        try {
          result = await runSiteGeneration({
            host,
            runId,
            brief,
            /*
              The brief IS the seed. The same sentence produces the same site
              (SC-013), so a re-run after a reload is the same site rather than
              a different one wearing its name.
            */
            seed: brief,
            signal: controller.signal,
            onStage: (event) => {
              if (!mine()) return;
              setStages((rows) =>
                rows.map((row) =>
                  row.id !== cardStage(event.stage)
                    ? row
                    : event.type === 'stage.started'
                      ? { id: row.id, status: 'active' }
                      : event.type === 'stage.done'
                        ? { id: row.id, status: 'done' }
                        : { id: row.id, status: 'failed', detail: event.reasons[0] ?? '' },
                ),
              );
            },
          });
        } finally {
          seam.release(runId);
          if (mine()) setRunning(false);
        }

        if (!mine()) return;
        if (result.ok) {
          setStages((rows) => rows.map((row) => ({ id: row.id, status: 'done' })));
          setOutcome({ ok: true, message: `${String(result.pages)} pages, in one undo.` });
          return;
        }
        /*
          A stop is not a failure, and the rows say so: every row still waiting
          becomes `cancelled` rather than `failed`. There is no
          `stage.cancelled` event — cancellation is never turned into a
          rejection — so they are marked here, where the outcome is known.
        */
        setStages((rows) =>
          rows.map((row) =>
            row.status === 'done' || row.status === 'failed'
              ? row
              : { id: row.id, status: result.cancelled === true ? 'cancelled' : 'pending' },
          ),
        );
        setOutcome({ ok: false, message: result.reason });
      })();

      return Promise.resolve(undefined);
    },
    [host, seam],
  );

  return useMemo(() => ({ stages, running, outcome, start }), [stages, running, outcome, start]);
}

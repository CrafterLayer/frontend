import type {
  AiBuildEvent,
  AiBuildPlannedTask,
  AiBuildStopReason,
  PagePlan,
} from '@craftkit/builder';

import {
  appendLiveProgress,
  formatClock,
  initialRunProgress,
  reduceRunProgress,
  type RunProgress,
} from './AssistantPanel.progress';

/**
 * A SPLIT BUILD as rows.
 *
 * The orchestrator (`runAiBuild`) narrates itself: a skeleton, a section list,
 * then one `task.started`/`task.completed` pair per section, interleaved with
 * every step's own `AiAgentEvent`s. This module is the only place that turns
 * that stream into something a card can render, and it is PURE — no clock, no
 * kernel, no React. Times come from the events' own `at` stamps, exactly as
 * `AssistantPanel.progress.ts` takes them, so a replayed build and a live one
 * produce identical rows.
 */

/**
 * Where one section is.
 *
 * `waiting` covers both "not reached yet" and the report's `not-started` — from
 * the reader's side those are the same fact ("this section has no content"),
 * and inventing a fourth word for it would only make the list harder to scan.
 */
export type BuildTaskStatus = 'waiting' | 'running' | 'applied' | 'skipped';

export interface BuildTask {
  readonly id: string;
  readonly title: string;
  /** 1-based, matching the transaction label (`Assistant: 3/10 — Pricing`). */
  readonly position: number;
  readonly status: BuildTaskStatus;
  /** Fill attempts made so far: 0 while waiting, 1 or 2 otherwise. */
  readonly attempts: number;
  /** Why it was skipped or never started. Absent for a section that landed. */
  readonly reason?: string;
  /** When the FIRST attempt began (the events' clock), so a retry does not reset it. */
  readonly startedAt?: number;
  /** How long the section took, once it settled. */
  readonly elapsedMs?: number;
  /**
   * What the section is FOR, from its PagePlan contract — shown on the approval
   * list, where a title alone ("Proof") says little about what will be written.
   * Absent on a scaffold build, which has no contracts.
   */
  readonly purpose?: string;
}

/**
 * How far the build itself is.
 *
 * `fallback` is the one that matters: the scaffold produced fewer than two
 * regions, the orchestrator abandoned the split, and the card must show nothing
 * build-shaped at all — one ordinary plan is the whole answer.
 */
export type BuildPhase =
  'scaffolding' | 'planned' | 'building' | 'stopped' | 'completed' | 'fallback';

/**
 * One section's state, in a person's words rather than the reducer's.
 *
 * Beside the reducer that produces the statuses, not in the panel that renders
 * them: two places now show a section list, and a label map living in one of
 * them would have been copied into the other.
 */
export const TASK_STATUS_LABEL: Readonly<Record<BuildTaskStatus, string>> = {
  waiting: 'Waiting',
  running: 'Working',
  applied: 'Done',
  skipped: 'Skipped',
};

/**
 * Why a build lands somewhere other than where the words asked for it.
 *
 * - `new-page-appended`: the person asked for a NEW page, and this panel cannot
 *   open one — the host hands it one page lens and no site — so the page is
 *   built below what is already there.
 * - `site-as-one-page`: several pages were asked for, and the chat builds one
 *   page per request; no site pipeline is wired to it.
 * - `starts-over`: the request starts a page that holds content over. It is
 *   asked about first, in every writing mode — see `requestPath`.
 * - `appended-not-replaced`: the request asked to start over, and this build
 *   cannot — only a PagePlan build removes what is there; the scaffold build
 *   lays its skeleton after it whatever the target (wave-2 verifier,
 *   scaffold-replace.mjs, 2026-09-28). The sections go below, nothing is
 *   removed, and there is nothing to ask about first.
 *
 * Data, not prose: it is saved with the turn, and the words are chosen when the
 * card renders, in the panel's language.
 */
export type BuildNotice =
  'new-page-appended' | 'site-as-one-page' | 'starts-over' | 'appended-not-replaced';

const BUILD_NOTICE_TEXT: Readonly<Record<BuildNotice, Readonly<Record<'ar' | 'en', string>>>> = {
  'new-page-appended': {
    en: 'A new page cannot be opened from the chat yet, so this page is built below what is already here.',
    ar: 'لا يمكن فتح صفحة جديدة من المحادثة بعد، لذلك تُبنى هذه الصفحة أسفل المحتوى الموجود.',
  },
  'site-as-one-page': {
    en: 'Several pages were asked for, but the chat builds one page at a time — this is one page that holds them all.',
    ar: 'طُلبت عدة صفحات، لكن المحادثة تبني صفحة واحدة في كل مرة — هذه صفحة واحدة تجمعها كلها.',
  },
  /*
    It said "anything replaced comes back with one Undo" until 2026-09-28. The
    removal rides the skeleton's transaction and every section lands after it
    as its own, so one Undo takes back the LAST section, not the page — what
    was there comes back when the build is undone, not before.
  */
  'starts-over': {
    en: 'The page already has content, and this asks to start it over — what is here now is removed when the new layout lands, and comes back if you undo the build.',
    ar: 'الصفحة فيها محتوى، وهذا الطلب يبدأها من جديد — يُحذف الموجود حين يُوضع التخطيط الجديد، ويعود إن تراجعت عن البناء.',
  },
  // Present tense on purpose: the approval card says it before the build, the Built card after.
  'appended-not-replaced': {
    en: 'This asks to start the page over, but this build can only add to it — the new sections go below what is already here, and nothing is replaced.',
    ar: 'هذا الطلب يبدأ الصفحة من جديد، لكن هذا البناء يضيف فقط — تُبنى الأقسام الجديدة أسفل المحتوى الموجود، ولا يُستبدل شيء.',
  },
};

/**
 * The notices, with a start-over the build will not (or did not) do said as
 * what happens instead.
 *
 * Read twice by the panel: when the build's one question arrives with no page
 * plan — the engine fell back to the scaffold, which appends — and when a
 * build ends without one. The same list comes back when there was no
 * start-over to take back, so a caller can compare by identity.
 */
export function withoutStartOver(notices: readonly BuildNotice[]): readonly BuildNotice[] {
  if (!notices.includes('starts-over')) return notices;
  return notices.map((notice) => (notice === 'starts-over' ? 'appended-not-replaced' : notice));
}

/** A notice in the words a person reads, in the panel's language. */
export function buildNoticeText(notice: BuildNotice, locale: 'ar' | 'en'): string {
  return BUILD_NOTICE_TEXT[notice][locale];
}

/** Is any section still being written? The wave's clock lives exactly this long. */
function stillWorking(tasks: readonly BuildTask[]): boolean {
  return tasks.some((task) => task.status === 'running');
}

export interface BuildProgress {
  readonly runId: string;
  readonly phase: BuildPhase;
  /** The scaffold's rationale, verbatim — every section obeyed this text. */
  readonly direction: string;
  readonly tasks: readonly BuildTask[];
  /** When the build began (the events' clock). Set once and never moved. */
  readonly startedAt: number;
  readonly applied: number;
  readonly skipped: number;
  /**
   * The rows of the work in flight — the skeleton first, then the sections.
   *
   * ONE clock for however many sections are being written at once. The fill
   * loop runs a pool, so "the step running right now" stopped being a single
   * thing; this is the wave's clock, started when the first section of the wave
   * did and cleared only when nothing is running at all.
   *
   * It used to be cleared on every `task.completed`, which was correct while
   * sections ran one at a time and wrong the moment they did not: the first
   * section to finish blanked the live clock under the two still working, and
   * the card sat silent while the build carried on.
   */
  readonly run: RunProgress | null;
  /** The whole build's measured duration, from `build.completed`. */
  readonly elapsedMs?: number;
  readonly stopReason?: AiBuildStopReason;
  /** Why the split was abandoned for one ordinary run. */
  readonly fallbackReason?: string;
  /** The provider's latest streamed narration while a section is being written. */
  readonly liveLine?: string;
  /** A bounded history of the provider narration, newest last. */
  readonly liveLog?: readonly string[];
}

export interface BuildReceipt {
  readonly applied: number;
  readonly total: number;
  /** `mm:ss` — a build is measured in minutes, so the millis would be noise. */
  readonly elapsed: string;
  readonly stopped: boolean;
  readonly skipped: readonly {
    readonly position: number;
    readonly title: string;
    readonly reason: string;
  }[];
  /** Sections the build never reached. */
  readonly notStarted: number;
}

const MS_PER_MINUTE = 60_000;
/** Under this, "left" is worth saying in seconds; over it, minutes read better. */
const SECONDS_ETA_CEILING_MS = 90_000;

/*
  `taskTransactionLabel` lived here until 2026-09-28: per-section Undo matched
  the kernel history by label and undid everything after it. Two builds share
  labels ("Assistant: 1/8 — Hero"), so an older card unwound the newer page,
  and the person's own later edits went with it (agent-audit P1-9). A section
  is now put back FORWARD by `revertBuildSection`, keyed by the transaction id
  the build recorded — no label is matched anywhere.
*/

export function initialBuildProgress(runId: string, now: number): BuildProgress {
  return {
    runId,
    phase: 'scaffolding',
    direction: '',
    tasks: [],
    startedAt: now,
    applied: 0,
    skipped: 0,
    // The skeleton is an ordinary applying run, and it is the first thing a
    // person waits on — so it gets the same three rows every run gets.
    run: initialRunProgress('auto', now),
  };
}

/**
 * The ONE question's list, before anything is written.
 *
 * The engine asks `onPlanned(planned, direction, plan?)` before the skeleton
 * lands, and `build.planned` — the event the rows used to come from — follows
 * only once it has (2026-09-28, P0-4). So the approval card's rows and its
 * direction are taken from the question itself.
 *
 * The rows name no node, because none exists: the id is empty, which the
 * section list already reads as "nowhere to jump", and `build.planned` replaces
 * every row with the real ones once the person says Build. The phase stays
 * `scaffolding`: nothing is planned ON THE PAGE yet.
 *
 * A PagePlan build hands over its contracts too; a row takes its contract's
 * purpose only when the contract in its place carries the same title — a
 * mismatched purpose would describe a different section than the row names.
 */
export function planForApproval(
  progress: BuildProgress,
  planned: readonly AiBuildPlannedTask[],
  direction: string,
  plan?: PagePlan,
): BuildProgress {
  return {
    ...progress,
    direction,
    tasks: planned.map((task, index): BuildTask => {
      const contract = plan?.sections[index];
      return {
        id: '',
        title: task.title,
        position: index + 1,
        status: 'waiting',
        attempts: 0,
        ...(contract?.title === task.title && contract.purpose !== ''
          ? { purpose: contract.purpose }
          : {}),
      };
    }),
  };
}

function replaceTask(
  progress: BuildProgress,
  position: number,
  change: (task: BuildTask) => BuildTask,
): readonly BuildTask[] {
  return progress.tasks.map((task) => (task.position === position ? change(task) : task));
}

/** Settle one section: its final status, its reason, and how long it took. */
function settle(
  progress: BuildProgress,
  position: number,
  at: number,
  attempts: number,
  status: 'applied' | 'skipped',
  reason?: string,
): readonly BuildTask[] {
  return replaceTask(progress, position, (task) => ({
    ...task,
    status,
    attempts,
    elapsedMs: Math.max(0, at - (task.startedAt ?? at)),
    ...(reason === undefined ? {} : { reason }),
  }));
}

/**
 * The event → rows mapping. Returns the SAME reference for anything that does
 * not move a row, so a host can compare by identity and skip a render.
 */
export function reduceBuildProgress(progress: BuildProgress, event: AiBuildEvent): BuildProgress {
  switch (event.type) {
    case 'build.scaffolding':
      // The skeleton is the opening phase already; a second announcement of it
      // is idempotent, exactly like `run.started` on the ordinary reducer.
      return progress;
    case 'build.skipped':
      /*
        Not a build. The ordinary run that replaced it owns the card from here,
        so the rows close and every later step event is a no-op — a fallback
        that kept ticking a section list would be claiming work nobody did.
      */
      return { ...progress, phase: 'fallback', fallbackReason: event.reason, run: null };
    case 'build.planned':
      return {
        ...progress,
        phase: 'planned',
        direction: event.direction,
        tasks: event.tasks.map((task, index) => ({
          id: task.id,
          title: task.title,
          position: index + 1,
          status: 'waiting' as const,
          attempts: 0,
        })),
        run: null,
      };
    case 'task.started':
      return {
        ...progress,
        phase: 'building',
        tasks: replaceTask(progress, event.position, (task) => ({
          ...task,
          status: 'running',
          attempts: event.attempt,
          // The retry belongs to the same section: its clock never restarts.
          startedAt: task.startedAt ?? event.at,
        })),
        /*
          The WAVE's clock: started by the first section to start, kept by the
          ones that join it. Restarting it on every start would make the clock
          jump backwards each time another writer picked up work.
        */
        run: progress.run ?? initialRunProgress('auto', event.at),
      };
    case 'task.completed': {
      const tasks = settle(progress, event.position, event.at, event.attempts, 'applied');
      return {
        ...progress,
        tasks,
        applied: progress.applied + 1,
        run: stillWorking(tasks) ? progress.run : null,
      };
    }
    case 'task.skipped': {
      const tasks = settle(
        progress,
        event.position,
        event.at,
        event.attempts,
        'skipped',
        event.reason,
      );
      return {
        ...progress,
        tasks,
        skipped: progress.skipped + 1,
        run: stillWorking(tasks) ? progress.run : null,
      };
    }
    case 'build.stopped':
      return { ...progress, phase: 'stopped', stopReason: event.reason, run: null };
    case 'build.completed': {
      const reports = new Map(event.tasks.map((task) => [task.id, task]));
      return {
        ...progress,
        // A stop is the more specific truth about how this ended: the build
        // completed its bookkeeping, it did not complete its work.
        phase: progress.phase === 'stopped' ? 'stopped' : 'completed',
        tasks: progress.tasks.map((task) => {
          const settled = reports.get(task.id);
          if (settled === undefined) return task;
          return {
            ...task,
            status: settled.status === 'not-started' ? 'waiting' : settled.status,
            attempts: settled.attempts,
            ...(settled.reason === undefined ? {} : { reason: settled.reason }),
          };
        }),
        applied: event.applied,
        skipped: event.skipped,
        elapsedMs: event.elapsedMs,
        run: null,
      };
    }
    case 'plan.progress': {
      const liveLog = appendLiveProgress(progress.liveLog, event.text);
      if (progress.liveLine === event.text && liveLog === progress.liveLog) return progress;
      return { ...progress, liveLine: event.text, liveLog };
    }
    default: {
      /*
        A step's own event. It belongs to whatever is open right now — the
        skeleton before the list exists, the running section after — which is
        why attribution needs no run-id arithmetic here: the orchestrator runs
        its steps strictly one at a time.
      */
      if (progress.run === null) return progress;
      const run = reduceRunProgress(progress.run, event);
      return run === progress.run ? progress : { ...progress, run };
    }
  }
}

/**
 * The last moment there is EVIDENCE the build was alive.
 *
 * A build revived after a reload has to be measured to this, never to now: the
 * wall clock kept running while the tab was closed, the build did not.
 */
export function lastEvidenceAt(progress: BuildProgress): number {
  const running = progress.tasks.find((task) => task.status === 'running');
  const settled = progress.tasks
    .filter((task) => task.elapsedMs !== undefined && task.startedAt !== undefined)
    .map((task) => (task.startedAt ?? 0) + (task.elapsedMs ?? 0));
  return Math.max(
    progress.startedAt,
    progress.run?.stageSince ?? progress.startedAt,
    running?.startedAt ?? progress.startedAt,
    ...settled,
  );
}

/**
 * What an ENDING says about a build: how many sections landed, out of how
 * many, in how long — and which ones did not, with the reason each gave.
 */
export function buildReceipt(progress: BuildProgress, endedAt: number): BuildReceipt | null {
  if (!Number.isFinite(progress.startedAt) || !Number.isFinite(endedAt)) return null;
  const elapsedMs = progress.elapsedMs ?? Math.max(0, endedAt - progress.startedAt);
  return {
    applied: progress.tasks.filter((task) => task.status === 'applied').length,
    total: progress.tasks.length,
    elapsed: formatClock(elapsedMs),
    stopped: progress.phase === 'stopped',
    skipped: progress.tasks
      .filter((task) => task.status === 'skipped')
      .map((task) => ({
        position: task.position,
        title: task.title,
        reason: task.reason ?? 'No reason was given.',
      })),
    notStarted: progress.tasks.filter((task) => task.status === 'waiting').length,
  };
}

/**
 * "~4 min left", from the sections this build actually measured.
 *
 * Never from a constant: a section of a CV page and a section of a landing page
 * take wildly different times, and the only honest predictor of the next one is
 * the ones this same build already finished. Silent until there is evidence.
 */
export function buildEta(progress: BuildProgress): string | null {
  const measured = progress.tasks.filter((task) => task.elapsedMs !== undefined);
  if (measured.length === 0) return null;
  const remaining = progress.tasks.filter(
    (task) => task.status === 'waiting' || task.status === 'running',
  ).length;
  if (remaining === 0) return null;
  const average =
    measured.reduce((total, task) => total + (task.elapsedMs ?? 0), 0) / measured.length;
  const left = average * remaining;
  return left < SECONDS_ETA_CEILING_MS
    ? `~${String(Math.max(1, Math.round(left / 1_000)))}s left`
    : `~${String(Math.max(1, Math.round(left / MS_PER_MINUTE)))} min left`;
}

/** "3/8" — how many sections have settled, out of how many there are. */
export function buildCount(progress: BuildProgress): string {
  const settled = progress.tasks.filter(
    (task) => task.status === 'applied' || task.status === 'skipped',
  ).length;
  return `${String(settled)}/${String(progress.tasks.length)}`;
}

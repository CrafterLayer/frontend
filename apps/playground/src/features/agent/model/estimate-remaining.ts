import type { BuildProgress, BuildTask } from './build-progress';

/**
 * "About 2 min left", from a simulation of the writer pool (SPEC §4.8, replacing
 * `buildEta`).
 *
 * The deleted `buildEta` multiplied the average section time by the sections left. Under
 * parallel writers that overstates by the pool size: in SPEC §4.8's worked example it
 * said 240s where the pool finishes in 90s. This module runs the pool forward instead:
 * the writers still busy, the drafts already done, the waiting sections taking the next
 * free writer in page order, and landing strictly in page order, because that is how
 * `runAiBuild` works (a slow section holds back the LANDING of everything below it,
 * never the writing).
 *
 * Silent until there is evidence: fewer than two measured sections, no writer count
 * (engine E1 absent), a result under 30 seconds, or a build that is not writing, and it
 * returns null. Pure: `now` is the moment to read the pool at. `buildRecordView` passes
 * the build's `lastEventAt`, never the wall clock, so the line moves on build events only
 * and does not flicker (SPEC §4.8).
 */

/** Below this many measured writes, a median is an anecdote. */
export const MIN_MEASURED_SECTIONS = 2;
/** Below this, "left" is not worth a line: the build is about to end anyway. */
export const MIN_SHOWN_REMAINING_MS = 30_000;
/**
 * A section still being written past the median is not done: it owes at least this
 * share of the median, so a straggler never reads as finishing this instant.
 */
export const STRAGGLER_SHARE = 0.15;

const MS_PER_MINUTE = 60_000;

/**
 * How long one section's latest write took: its latest `task.started` to its drafted
 * signal, or to `task.completed` when no drafted signal was seen. Null for a section
 * that has not finished writing.
 */
function writeDuration(task: BuildTask): number | null {
  if (task.attemptStartedAt === undefined) return null;
  const end = task.draftedAt ?? (task.status === 'landed' ? task.settledAt : undefined);
  return end === undefined ? null : Math.max(0, end - task.attemptStartedAt);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? upper) + upper) / 2;
}

/** Book the earliest free writer for `duration`; returns when that write finishes. */
function takeWriter(free: number[], duration: number): number {
  let earliest = 0;
  for (let index = 1; index < free.length; index += 1) {
    if ((free[index] ?? Infinity) < (free[earliest] ?? Infinity)) earliest = index;
  }
  const finish = (free[earliest] ?? 0) + duration;
  free[earliest] = finish;
  return finish;
}

/**
 * Milliseconds until the last section lands, or null when the estimate may not be shown.
 * Times inside the simulation are relative to `now`.
 */
export function estimateRemainingMs(progress: BuildProgress, now: number): number | null {
  if (progress.report !== null) return null;
  if (progress.phase !== 'building' && progress.phase !== 'planned') return null;
  const writers = progress.writers;
  if (writers === null || writers < 1) return null;

  const durations = progress.tasks
    .map(writeDuration)
    .filter((duration): duration is number => duration !== null);
  if (durations.length < MIN_MEASURED_SECTIONS) return null;
  const d = median(durations);

  // Writers busy on a section finish at max(d − elapsed, 15% of d); the rest are free now.
  const finish = new Map<number, number>();
  const free: number[] = [];
  for (const task of progress.tasks) {
    if (task.status !== 'writing') continue;
    const elapsed = Math.max(0, now - (task.attemptStartedAt ?? now));
    const done = Math.max(d - elapsed, STRAGGLER_SHARE * d);
    finish.set(task.position, done);
    free.push(done);
  }
  while (free.length < writers) free.push(0);

  // Waiting sections, in page order, each on the earliest free writer for one median.
  for (const task of progress.tasks) {
    if (task.status === 'waiting') finish.set(task.position, takeWriter(free, d));
  }

  // Landing is ordered: a section lands no earlier than the one above it.
  let landing = 0;
  for (const task of progress.tasks) {
    landing = Math.max(landing, finish.get(task.position) ?? 0);
  }
  return landing < MIN_SHOWN_REMAINING_MS ? null : Math.round(landing);
}

/** The remaining line's catalog key (SPEC §4.8 `build.remaining.*`). */
export type RemainingDisplay =
  | { readonly key: 'build.remaining.underMinute' }
  | { readonly key: 'build.remaining.minutes'; readonly minutes: number };

/**
 * Under a minute, or whole minutes rounded UP: an estimate that says "2 min" and takes
 * three is a broken promise, one that says "2 min" and takes ninety seconds is not.
 */
export function remainingDisplay(ms: number): RemainingDisplay {
  if (ms < MS_PER_MINUTE) return { key: 'build.remaining.underMinute' };
  return { key: 'build.remaining.minutes', minutes: Math.ceil(ms / MS_PER_MINUTE) };
}

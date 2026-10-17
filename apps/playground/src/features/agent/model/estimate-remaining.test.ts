import { describe, expect, it } from 'vitest';

import type { AiBuildEvent, AiBuildTask } from '@craftkit/builder';

import { initialBuildProgress, reduceBuildProgress, type BuildProgress } from './build-progress';
import {
  estimateRemainingMs,
  MIN_MEASURED_SECTIONS,
  MIN_SHOWN_REMAINING_MS,
  remainingDisplay,
} from './estimate-remaining';

const BUILD = 'b1';
const S = 1_000;
const NOW = 10_000 * S;

let seq = 0;
function event(at: number, payload: Record<string, unknown>, runId = BUILD): AiBuildEvent {
  seq += 1;
  return { runId, seq, at, ...payload } as unknown as AiBuildEvent;
}

function tasks(count: number): AiBuildTask[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `n${String(index + 1)}`,
    title: `Section ${String(index + 1)}`,
  }));
}

/**
 * One section's history, in seconds relative to NOW. `write` is the latest attempt's
 * start → its drafted signal; `land` stamps task.completed; `writing` starts a write
 * that is still going; `fail` skips it.
 */
type Plan =
  | {
      readonly kind: 'landed';
      readonly start: number;
      readonly drafted?: number;
      readonly land: number;
    }
  | { readonly kind: 'drafted'; readonly start: number; readonly drafted: number }
  | { readonly kind: 'writing'; readonly start: number; readonly attempt?: 1 | 2 }
  | { readonly kind: 'failed'; readonly start: number; readonly at: number }
  | { readonly kind: 'waiting' };

function build(
  plans: readonly Plan[],
  writers: number | null,
  extra: readonly AiBuildEvent[] = [],
) {
  const list = tasks(plans.length);
  const total = list.length;
  const events: AiBuildEvent[] = [
    event(NOW - 1_000 * S, {
      type: 'build.planned',
      direction: 'd',
      tasks: list,
      ...(writers === null ? {} : { writers }),
    }),
  ];
  for (const [index, plan] of plans.entries()) {
    const position = index + 1;
    const task = list[index];
    const fill = `${BUILD}/fill-${String(position)}`;
    const at = (seconds: number) => NOW + seconds * S;
    switch (plan.kind) {
      case 'landed':
        events.push(
          event(at(plan.start), { type: 'task.started', position, total, task, attempt: 1 }),
        );
        if (plan.drafted !== undefined) {
          events.push(event(at(plan.drafted), { type: 'run.completed', status: 'proposed' }, fill));
        }
        events.push(
          event(at(plan.land), { type: 'task.completed', position, total, task, attempts: 1 }),
        );
        break;
      case 'drafted':
        events.push(
          event(at(plan.start), { type: 'task.started', position, total, task, attempt: 1 }),
        );
        events.push(event(at(plan.drafted), { type: 'run.completed', status: 'proposed' }, fill));
        break;
      case 'writing':
        if (plan.attempt === 2) {
          events.push(
            event(at(plan.start - 500), {
              type: 'task.started',
              position,
              total,
              task,
              attempt: 1,
            }),
          );
        }
        events.push(
          event(at(plan.start), {
            type: 'task.started',
            position,
            total,
            task,
            attempt: plan.attempt ?? 1,
          }),
        );
        break;
      case 'failed':
        events.push(
          event(at(plan.start), { type: 'task.started', position, total, task, attempt: 1 }),
        );
        events.push(
          event(at(plan.at), {
            type: 'task.skipped',
            position,
            total,
            task,
            attempts: 2,
            reason: 'x',
          }),
        );
        break;
      case 'waiting':
        break;
    }
  }
  return [...events, ...extra].reduce(
    reduceBuildProgress,
    initialBuildProgress(BUILD, NOW - 1_200 * S),
  );
}

/** A landed section that took `d` seconds to write, ending `ago` seconds before NOW. */
const landedIn = (d: number, ago = 200): Plan => ({
  kind: 'landed',
  start: -ago - d,
  drafted: -ago,
  land: -ago,
});

describe('estimateRemainingMs: the SPEC §4.8 worked example', () => {
  it('8 sections, 3 writers, d = 60s: 90s, "About 2 min left" (buildEta said 240s)', () => {
    const progress = build(
      [
        landedIn(60, 300),
        landedIn(60, 240),
        landedIn(60, 180),
        { kind: 'writing', start: -30 },
        { kind: 'writing', start: -10 },
        { kind: 'drafted', start: -100, drafted: -40 },
        { kind: 'waiting' },
        { kind: 'waiting' },
      ],
      3,
    );

    const ms = estimateRemainingMs(progress, NOW);
    expect(ms).toBe(90 * S);
    expect(remainingDisplay(ms ?? 0)).toEqual({ key: 'build.remaining.minutes', minutes: 2 });
  });
});

describe('estimateRemainingMs: pool simulations', () => {
  const table: readonly (readonly [
    name: string,
    plans: readonly Plan[],
    writers: number,
    expected: number | null,
  ])[] = [
    [
      'one writer is strictly sequential: three more minutes',
      [landedIn(60), landedIn(60), { kind: 'waiting' }, { kind: 'waiting' }, { kind: 'waiting' }],
      1,
      180 * S,
    ],
    [
      'enough writers for every waiting section: one write length',
      [landedIn(60), landedIn(60), { kind: 'waiting' }, { kind: 'waiting' }, { kind: 'waiting' }],
      6,
      60 * S,
    ],
    [
      'a straggler past its median still owes 15% of it, never zero',
      [landedIn(100), landedIn(100), { kind: 'writing', start: -400 }],
      3,
      null, // 15s: under the 30s floor, so nothing is shown
    ],
    [
      'the straggler floor holds a queue behind it: the section waits on its writer',
      [landedIn(200), landedIn(200), { kind: 'writing', start: -900 }, { kind: 'waiting' }],
      1,
      230 * S, // 0.15 × 200 = 30s, then 200s on the same writer
    ],
    [
      'a drafted section lands no earlier than the section above it',
      [
        landedIn(60),
        landedIn(60),
        { kind: 'writing', start: -20 },
        { kind: 'drafted', start: -90, drafted: -30 },
      ],
      3,
      40 * S,
    ],
    [
      'the median of an even count is the mean of the middle two',
      [landedIn(40), landedIn(60), landedIn(80), landedIn(100), { kind: 'waiting' }],
      2,
      70 * S,
    ],
    [
      'a failed section is neither measured nor waited on',
      [landedIn(60), landedIn(60), { kind: 'failed', start: -50, at: -2 }, { kind: 'waiting' }],
      2,
      60 * S,
    ],
    [
      'a retry is measured from its own start, not the first attempt',
      [landedIn(60), landedIn(60), { kind: 'writing', start: -20, attempt: 2 }],
      2,
      40 * S,
    ],
    [
      'a landed section with no drafted signal is measured to its landing',
      [
        { kind: 'landed', start: -300, land: -240 },
        { kind: 'landed', start: -240, land: -180 },
        { kind: 'waiting' },
      ],
      1,
      60 * S,
    ],
    [
      'a drafted section counts as measured',
      [
        landedIn(60),
        { kind: 'drafted', start: -80, drafted: -20 },
        { kind: 'waiting' },
        { kind: 'waiting' },
      ],
      1,
      120 * S,
    ],
  ];

  it.each(table)('%s', (_name, plans, writers, expected) => {
    expect(estimateRemainingMs(build(plans, writers), NOW)).toBe(expected);
  });
});

describe('estimateRemainingMs: when there is nothing honest to say', () => {
  it(`stays silent with fewer than ${String(MIN_MEASURED_SECTIONS)} measured sections`, () => {
    const progress = build([landedIn(60), { kind: 'waiting' }, { kind: 'waiting' }], 1);
    expect(estimateRemainingMs(progress, NOW)).toBeNull();
  });

  it('stays silent without a writer count (engine E1 absent)', () => {
    const progress = build([landedIn(60), landedIn(60), { kind: 'waiting' }], null);
    expect(estimateRemainingMs(progress, NOW)).toBeNull();
  });

  it(`stays silent under ${String(MIN_SHOWN_REMAINING_MS / S)}s`, () => {
    const progress = build([landedIn(20), landedIn(20), { kind: 'waiting' }], 1);
    expect(estimateRemainingMs(progress, NOW)).toBeNull();
  });

  it('stays silent once the build has stopped or ended', () => {
    const plans: readonly Plan[] = [
      landedIn(60),
      landedIn(60),
      { kind: 'waiting' },
      { kind: 'waiting' },
    ];
    const stopped = build(plans, 1, [event(NOW, { type: 'build.stopped', reason: 'budget' })]);
    expect(estimateRemainingMs(stopped, NOW)).toBeNull();

    const skeleton = initialBuildProgress(BUILD, NOW);
    expect(estimateRemainingMs(skeleton, NOW)).toBeNull();
  });

  it('never goes negative when the caller clock trails the events', () => {
    const progress = build(
      [landedIn(60), landedIn(60), { kind: 'writing', start: 5 }, { kind: 'waiting' }],
      1,
    );
    expect(estimateRemainingMs(progress, NOW)).toBe(120 * S);
  });
});

describe('remainingDisplay', () => {
  it('rounds up to whole minutes, and says "under a minute" below 60s', () => {
    expect(remainingDisplay(30 * S)).toEqual({ key: 'build.remaining.underMinute' });
    expect(remainingDisplay(59_999)).toEqual({ key: 'build.remaining.underMinute' });
    expect(remainingDisplay(60 * S)).toEqual({ key: 'build.remaining.minutes', minutes: 1 });
    expect(remainingDisplay(60 * S + 1)).toEqual({ key: 'build.remaining.minutes', minutes: 2 });
    expect(remainingDisplay(240 * S)).toEqual({ key: 'build.remaining.minutes', minutes: 4 });
  });
});

// Keep the fixture type honest: `build` returns the real reducer's output.
const _typed: BuildProgress = build([{ kind: 'waiting' }], 1);
void _typed;

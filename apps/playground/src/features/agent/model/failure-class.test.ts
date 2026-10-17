/**
 * Every message below is copied from the engine as of 2026-09-28, with the template's
 * values filled in; the source is named beside each row so a change there is easy to
 * find. `task.skipped` carries only `reason: string` until engine E5 adds a reason code
 * (SPEC §7.6), so these strings ARE the contract today.
 */
import { describe, expect, it } from 'vitest';

import type { AiBuildSkipReasonCode, AiRunFailure } from '@craftkit/builder';

import {
  classifyRunFailure,
  classifySectionFailure,
  errorClassOfSections,
  isRetryableErrorClass,
  stopCauseOf,
} from './failure-class';
import type { ErrorClass, FailureClass } from './view-types';

function provider(code: AiRunFailure['code'], message: string, status?: number): AiRunFailure {
  return {
    source: 'provider',
    code,
    message,
    retryable: true,
    ...(status === undefined ? {} : { status }),
  };
}

describe('classifySectionFailure: recorded engine messages alone', () => {
  const table: readonly (readonly [source: string, reason: string, expected: FailureClass])[] = [
    // run-build.ts runFill: the section's own deadline.
    ['run-build.ts:520', 'Section "Hero" exceeded its 240000ms budget.', 'timeout'],
    // run-build.ts writeSection: the retry the budget refused, after a timeout.
    [
      'run-build.ts:1137',
      'Section "Hero" exceeded its 240000ms budget. No second attempt: the build budget ran out.',
      'timeout',
    ],
    // remote-provider.ts timeoutError.
    ['remote-provider.ts:430', 'The assistant server timed out after 120000ms.', 'timeout'],
    // run-build.ts writeSection: the target guard dropped every step.
    [
      'run-build.ts:1162',
      'Section "Doctors" wrote nothing inside its own region; 2 steps outside it were dropped.',
      'outOfScope',
    ],
    [
      'run-build.ts:1162 (one)',
      'Section "خدماتنا" wrote nothing inside its own region; 1 step outside it were dropped.',
      'outOfScope',
    ],
    [
      'run-build.ts:1137 after 1162',
      'Section "FAQ" wrote nothing inside its own region; 3 steps outside it were dropped. No second attempt: the build budget ran out.',
      'outOfScope',
    ],
    // remote-provider.ts abortAware / post.
    [
      'remote-provider.ts:453',
      'The assistant server could not be reached: Failed to fetch',
      'unreachable',
    ],
    ['remote-provider.ts:389 (429)', 'The assistant server answered with status 429.', 'busy'],
    ['remote-provider.ts:389 (503)', 'The assistant server answered with status 503.', 'busy'],
    ['remote-provider.ts:389 (529)', 'The assistant server answered with status 529.', 'busy'],
    ['remote-provider.ts:389 (504)', 'The assistant server answered with status 504.', 'timeout'],
    [
      'remote-provider.ts:389 (502)',
      'The assistant server answered with status 502.',
      'unreachable',
    ],
    ['remote-provider.ts:389 (400)', 'The assistant server answered with status 400.', 'unknown'],
    // remote-provider.ts parse failures: the model's answer was unusable.
    ['remote-provider.ts:132', 'The assistant server answer was not valid JSON.', 'invalid'],
    [
      'remote-provider.ts:184',
      'The assistant server answered with something that is not a plan or a refusal.',
      'invalid',
    ],
    ['remote-provider.ts:241', 'The assistant server streamed invalid JSON.', 'invalid'],
    ['remote-provider.ts:289', 'The assistant server stream ended without a result.', 'invalid'],
    [
      'remote-provider.ts:66',
      'The assistant server response exceeded the maximum response size of 1048576 bytes.',
      'invalid',
    ],
    // validate-plan.ts: AiPlanRejectedError joins the issue messages.
    ['validate-plan.ts:160', 'Step 0 names unknown command "setProps".', 'invalid'],
    [
      'validate-plan.ts:170',
      'Step 1 has invalid arguments for "setProp": key must be a string',
      'invalid',
    ],
    [
      'validate-plan.ts:196',
      'Step 2 command "insertNode" is not allowed by the active AI policy.',
      'invalid',
    ],
    [
      'validate-plan.ts:863',
      'The grouped plan was rejected by the kernel door: Node "n7" does not exist.',
      'invalid',
    ],
    [
      'validate-plan.ts:876',
      'The plan leaves an invalid document: slot "items" holds 13 children.',
      'invalid',
    ],
    ['validate-plan.ts:74', 'An AI plan needs at least one command.', 'invalid'],
    ['outline-plan.ts:89', 'The assistant returned an empty plan.', 'invalid'],
    // Anything the engine did not write: a model's own refusal prose, a kernel's words.
    ['refusal prose', "I can't write testimonials for real people.", 'unknown'],
    ['kernel', 'Node "n3" does not exist.', 'unknown'],
    ['empty', '', 'unknown'],
  ];

  it.each(table)('%s → %s', (_source, reason, expected) => {
    expect(classifySectionFailure({ reason })).toBe(expected);
  });

  it('reads an absent reason as unknown', () => {
    expect(classifySectionFailure({})).toBe('unknown');
  });
});

describe('classifySectionFailure: the engine’s reason code first (E5)', () => {
  it.each<[AiBuildSkipReasonCode, FailureClass]>([
    ['timeout', 'timeout'],
    ['invalid', 'invalid'],
    ['out-of-scope', 'outOfScope'],
    ['page-changed', 'pageChanged'],
    ['unreachable', 'unreachable'],
  ])('%s → %s, whatever the message says', (reasonCode, expected) => {
    // The prose below names a timeout; the code is the engine's own class and wins.
    expect(
      classifySectionFailure({
        reasonCode,
        reason: 'Section "Hero" exceeded its 90000ms budget.',
      }),
    ).toBe(expected);
  });

  it('refines "unreachable", which merges two causes, by the writer’s own failure', () => {
    const busy = { code: 'http-status', status: 429 } as const;
    const refused = { code: 'refusal' } as const;
    const invalid = { code: 'invalid-output' } as const;
    expect(classifySectionFailure({ reasonCode: 'unreachable', failure: busy })).toBe('busy');
    expect(classifySectionFailure({ reasonCode: 'unreachable', failure: refused })).toBe(
      'declined',
    );
    // A failure that is not a reachability cause cannot overrule the engine's code.
    expect(classifySectionFailure({ reasonCode: 'unreachable', failure: invalid })).toBe(
      'unreachable',
    );
  });

  it('falls back to the message shapes when the code does not settle it', () => {
    const reason = 'Section "Hero" exceeded its 90000ms budget.';
    expect(classifySectionFailure({ reasonCode: 'unknown', reason })).toBe('timeout');
    // A build recorded before the engine sent codes still classifies by its words.
    expect(classifySectionFailure({ reason })).toBe('timeout');
    expect(classifySectionFailure({ reasonCode: 'unknown' })).toBe('unknown');
  });
});

describe('stopCauseOf: the reason code first', () => {
  it('reads a stop from the code, and tells the budget from the task limit by the message', () => {
    expect(stopCauseOf(undefined, 'stopped')).toBe('signal');
    expect(stopCauseOf('The build budget ran out before this section started.', 'budget')).toBe(
      'budget',
    );
    expect(
      stopCauseOf('The build reached its task limit before this section started.', 'budget'),
    ).toBe('maxTasks');
    expect(stopCauseOf(undefined, 'budget')).toBe('budget');
    expect(stopCauseOf('Section "Hero" exceeded its 90000ms budget.', 'timeout')).toBeNull();
  });
});

describe('classifySectionFailure: with the writer run evidence', () => {
  it('reads the writer run failure code before its prose', () => {
    expect(
      classifySectionFailure({
        reason: "I can't write testimonials for real people.",
        failure: provider('refusal', "I can't write testimonials for real people."),
      }),
    ).toBe('declined');
    expect(
      classifySectionFailure({
        reason: 'The model is overloaded.',
        failure: provider('http-status', 'The model is overloaded.', 429),
      }),
    ).toBe('busy');
    expect(
      classifySectionFailure({ reason: 'x', failure: provider('network', 'socket hang up') }),
    ).toBe('unreachable');
    expect(
      classifySectionFailure({
        reason: 'x',
        failure: { source: 'plan', code: 'plan-rejected', message: 'x', retryable: false },
      }),
    ).toBe('invalid');
  });

  it('names a refusal on landing: the writer had drafted, then the page refused it', () => {
    // run-build.ts:1285 — `applyAiPlan` threw after the writer's `run.completed {proposed}`.
    expect(
      classifySectionFailure({
        reason: 'The grouped plan was rejected by the kernel door: Node "n7" does not exist.',
        drafted: true,
      }),
    ).toBe('pageChanged');
    expect(classifySectionFailure({ reason: 'Node "n3" does not exist.', drafted: true })).toBe(
      'pageChanged',
    );
  });

  it('keeps out-of-scope ahead of the landing rule: the guard runs after the draft', () => {
    expect(
      classifySectionFailure({
        reason:
          'Section "Hero" wrote nothing inside its own region; 1 step outside it were dropped.',
        drafted: true,
      }),
    ).toBe('outOfScope');
  });

  it('reads a cancelled writer by its message: the deadline aborts with a timeout', () => {
    expect(
      classifySectionFailure({
        reason: 'Section "Hero" exceeded its 240000ms budget.',
        failure: {
          source: 'run',
          code: 'cancelled',
          message: 'Section "Hero" exceeded its 240000ms budget.',
          retryable: false,
        },
      }),
    ).toBe('timeout');
  });
});

describe('stopCauseOf', () => {
  it('recognises every not-started reason the engine writes', () => {
    // run-build.ts notStartedReason, STOPPED_WHILE_WRITING, STOPPED_BEFORE_LANDING.
    expect(stopCauseOf('The build was stopped before this section started.')).toBe('signal');
    expect(
      stopCauseOf(
        'The build was stopped while this section was being written; nothing of it was applied.',
      ),
    ).toBe('signal');
    expect(
      stopCauseOf('The build was stopped before this section landed; nothing of it was applied.'),
    ).toBe('signal');
    expect(stopCauseOf('The build budget ran out before this section started.')).toBe('budget');
    expect(stopCauseOf('The build reached its task limit before this section started.')).toBe(
      'maxTasks',
    );
  });

  it('is null for a failure, and for no reason at all', () => {
    expect(stopCauseOf('Section "Hero" exceeded its 240000ms budget.')).toBeNull();
    expect(
      stopCauseOf(
        'Section "Hero" exceeded its 240000ms budget. No second attempt: the build budget ran out.',
      ),
    ).toBeNull();
    expect(stopCauseOf(undefined)).toBeNull();
  });
});

describe('classifyRunFailure', () => {
  const table: readonly (readonly [failure: AiRunFailure, expected: ErrorClass])[] = [
    [provider('timeout', 'The assistant server timed out after 120000ms.'), 'timeout'],
    [provider('network', 'The assistant server could not be reached: x'), 'unreachable'],
    [provider('http-status', 'The assistant server answered with status 429.', 429), 'busy'],
    [provider('http-status', 'The assistant server answered with status 503.', 503), 'busy'],
    [provider('http-status', 'The assistant server answered with status 504.', 504), 'timeout'],
    [provider('http-status', 'The assistant server answered with status 500.', 500), 'unreachable'],
    [provider('http-status', 'The assistant server answered with status 401.', 401), 'unknown'],
    [provider('refusal', 'No.'), 'declined'],
    [provider('invalid-output', 'The assistant server answer was not valid JSON.'), 'invalid'],
    [provider('stream-protocol', 'The assistant server stream had no body.'), 'invalid'],
    [{ source: 'plan', code: 'plan-rejected', message: 'Step 0 …', retryable: false }, 'invalid'],
    [
      {
        source: 'context',
        code: 'context-budget',
        message: 'AI context budget exceeded: estimated 120000 tokens, maximum 100000.',
        retryable: false,
      },
      'tooLarge',
    ],
    [{ source: 'unknown', code: 'unknown', message: 'boom', retryable: false }, 'unknown'],
    // An unclassified failure still carries a recognisable engine message.
    [
      {
        source: 'unknown',
        code: 'unknown',
        message: 'The assistant returned an empty plan.',
        retryable: false,
      },
      'invalid',
    ],
  ];

  it.each(table)('%o → %s', (failure, expected) => {
    expect(classifyRunFailure(failure)).toBe(expected);
  });

  it('says offline only for a request that never left: the browser reports no network', () => {
    expect(classifyRunFailure(provider('network', 'Failed to fetch'), { offline: true })).toBe(
      'offline',
    );
    expect(classifyRunFailure(provider('refusal', 'No.'), { offline: true })).toBe('declined');
  });

  it('reads a missing failure as unknown', () => {
    expect(classifyRunFailure(undefined)).toBe('unknown');
  });
});

describe('isRetryableErrorClass', () => {
  it('offers Try again for every class but a decline (SPEC §4.14 Retry column)', () => {
    const classes: readonly ErrorClass[] = [
      'unreachable',
      'timeout',
      'busy',
      'declined',
      'invalid',
      'tooLarge',
      'offline',
      'unknown',
    ];
    expect(classes.filter((errorClass) => !isRetryableErrorClass(errorClass))).toEqual([
      'declined',
    ]);
  });
});

describe('errorClassOfSections', () => {
  it('names a build whose every section failed by the most common section class', () => {
    expect(errorClassOfSections(['timeout', 'busy', 'timeout'])).toBe('timeout');
    expect(errorClassOfSections(['busy', 'timeout'])).toBe('busy');
    expect(errorClassOfSections(['declined'])).toBe('declined');
  });

  it('has no whole-run words for a section-only class', () => {
    expect(errorClassOfSections(['outOfScope', 'outOfScope'])).toBe('unknown');
    expect(errorClassOfSections(['pageChanged'])).toBe('unknown');
    expect(errorClassOfSections([])).toBe('unknown');
  });
});

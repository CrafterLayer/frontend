/**
 * What every grader returns.
 *
 * The shape is promptfoo's `GradingResult` on purpose — a javascript assertion
 * may return exactly this — so a grader is usable from the eval config with no
 * adapter, and usable from a vitest test with no promptfoo. That is what lets
 * `graders/*.test.ts` prove a grader can fail a bad plan without booting an
 * eval run.
 */
export interface GradeResult {
  pass: boolean;
  /** 0..1. A blocking grader scores 1 or 0; a scored grader uses the range. */
  score: number;
  /** Written for a human reading a failed row. Name what was wrong, not that something was. */
  reason: string;
}

export function passed(reason: string): GradeResult {
  return { pass: true, score: 1, reason };
}

export function failed(reason: string): GradeResult {
  return { pass: false, score: 0, reason };
}

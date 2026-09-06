import type { SiteStage } from '../wire';

/**
 * A stage's answer refused on ARRIVAL.
 *
 * Named per stage and per reason, because the whole point of splitting a site
 * into five calls is that a bad answer costs one stage rather than the site —
 * and that is only true if the answer is checked the moment it lands. A
 * pipeline that validated at the end would have spent four more calls before
 * discovering the first one was wrong.
 */
export class StageRejectedError extends Error {
  override readonly name = 'StageRejectedError';
  readonly stage: SiteStage;
  readonly reasons: readonly string[];
  /** True when asking again could plausibly help. A vocabulary error cannot. */
  readonly repairable: boolean;

  constructor(stage: SiteStage, reasons: readonly string[], repairable = true) {
    super(`The ${stage} stage produced an answer this run cannot use: ${reasons.join(' ')}`);
    this.stage = stage;
    this.reasons = reasons;
    this.repairable = repairable;
  }
}

export function isStageRejected(value: unknown): value is StageRejectedError {
  return value instanceof StageRejectedError;
}

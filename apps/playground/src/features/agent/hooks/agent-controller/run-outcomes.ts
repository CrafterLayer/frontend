/**
 * What a run changed (rehearsed or compared, as ChangeLines), how a failed run reads
 * as an error turn, and the live region announcements a flow makes.
 */
import {
  type AiRunFailure,
  type AiValidatedProposal,
  type BuilderDocument,
  type BuilderKernel,
  classifyAiRunFailure,
  previewAiPlan,
} from '@craftkit/builder';

import { t } from '../../copy';
import type { ImmediateAnnouncementKey } from '../../model/agent-status';
import { type ImpactLine, impactLines, planImpact, schemaImpactNaming } from '../../model/impact';
import { preflightPorts } from '../../model/runs';
import type { ErrorTurn } from '../../model/turns';
import type { CopyParams } from '../../model/view-types';

import { type Flow, offline } from './controller-state';

/** A ChangeLines naming in the panel's locale, from the registry's own names. */
function namingFor(flow: Flow, kernel: BuilderKernel) {
  const { locale } = flow.env().options;
  return schemaImpactNaming(
    (key) => t(locale, key),
    (type) => kernel.context.registry.block(type)?.schema,
  );
}

export interface Changes {
  readonly lines: readonly ImpactLine[];
  readonly empty: boolean;
}

/** What a proposal would change, rehearsed on a scratch kernel; nothing when it cannot be. */
export function rehearse(
  flow: Flow,
  kernel: BuilderKernel,
  proposal: AiValidatedProposal,
): Changes {
  try {
    const before = kernel.getDocument();
    const after = previewAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
    return {
      lines: impactLines(before, after, namingFor(flow, kernel)),
      empty: planImpact(before, after).empty,
    };
  } catch {
    // A proposal that cannot be rehearsed is still one to read; the card just says less.
    return { lines: [], empty: false };
  }
}

/** What an applied change did, between two documents. */
export function compare(
  flow: Flow,
  kernel: BuilderKernel,
  before: BuilderDocument,
  after: BuilderDocument,
): Changes {
  return {
    lines: impactLines(before, after, namingFor(flow, kernel)),
    empty: planImpact(before, after).empty,
  };
}

export function failureTurn(
  id: string,
  request: string,
  cause: unknown,
  pageState: ErrorTurn['pageState'],
  elapsedMs: number,
): ErrorTurn {
  const failure: AiRunFailure = failureOf(cause);
  return {
    id,
    kind: 'error',
    request,
    failure,
    ...(offline() ? { offline: true } : {}),
    pageState,
    elapsedMs,
  };
}

export function failureOf(cause: unknown): AiRunFailure {
  return typeof cause === 'object' && cause !== null && 'failure' in cause
    ? (cause as { readonly failure: AiRunFailure }).failure
    : classifyAiRunFailure(cause);
}

export function say(flow: Flow, key: ImmediateAnnouncementKey, params?: CopyParams): void {
  flow.env().live.say(key, params);
}

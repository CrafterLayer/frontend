import { isBuilderError } from '@craftkit/builder-schema';

import { AiMemoryContextError } from '../context/memory-provider';
import { AiContextBudgetError } from '../plan/generate-plan';
import { AiValidatedProposalError } from '../plan/validated-proposal';
import { AiPlanRejectedError } from '../plan/validate-plan';
import { AiRunTimeoutError } from './run-deadline';
import { isAiProviderError, type AiProviderErrorCode } from '../provider/errors';
import {
  AiCommandPolicyError,
  AiSkillRegistryError,
  AiSkillResolutionError,
} from '../skills/errors';

export type AiRunFailureSource =
  'context' | 'kernel' | 'plan' | 'policy' | 'provider' | 'run' | 'skill' | 'unknown';

export type AiRunFailureCode =
  | AiProviderErrorCode
  | 'cancelled'
  | 'context-budget'
  | 'memory-context'
  | 'plan-rejected'
  | 'proposal-integrity'
  | 'unknown'
  | (string & {});

/** Stable host/UI-facing error data. Original errors are still thrown to callers. */
export interface AiRunFailure {
  readonly source: AiRunFailureSource;
  readonly code: AiRunFailureCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly status?: number;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function failure(value: AiRunFailure): AiRunFailure {
  return Object.freeze(value);
}

/** Convert every known run boundary into data without weakening the thrown error path. */
export function classifyAiRunFailure(cause: unknown): AiRunFailure {
  if (cause instanceof AiRunTimeoutError) {
    return failure({ source: 'run', code: 'timeout', message: cause.message, retryable: false });
  }
  if (cause instanceof Error && cause.name === 'AbortError') {
    return failure({
      source: 'run',
      code: 'cancelled',
      message: cause.message,
      retryable: false,
    });
  }
  if (isAiProviderError(cause)) {
    return failure({
      source: 'provider',
      code: cause.code,
      message: cause.message,
      retryable: cause.retryable,
      ...(cause.status === undefined ? {} : { status: cause.status }),
    });
  }
  if (cause instanceof AiContextBudgetError) {
    return failure({
      source: 'context',
      code: 'context-budget',
      message: cause.message,
      retryable: false,
    });
  }
  if (cause instanceof AiMemoryContextError) {
    return failure({
      source: 'context',
      code: cause.code || 'memory-context',
      message: cause.message,
      retryable: false,
    });
  }
  if (cause instanceof AiCommandPolicyError) {
    return failure({
      source: 'policy',
      code: cause.code,
      message: cause.message,
      retryable: false,
    });
  }
  if (cause instanceof AiSkillRegistryError || cause instanceof AiSkillResolutionError) {
    return failure({
      source: 'skill',
      code: cause.code,
      message: cause.message,
      retryable: false,
    });
  }
  if (cause instanceof AiValidatedProposalError) {
    return failure({
      source: 'policy',
      code: cause.code,
      message: cause.message,
      retryable: false,
    });
  }
  if (cause instanceof AiPlanRejectedError) {
    return failure({
      source: 'plan',
      code: 'plan-rejected',
      message: cause.message,
      retryable: false,
    });
  }
  if (isBuilderError(cause)) {
    return failure({
      source: 'kernel',
      code: cause.code,
      message: cause.message,
      retryable: false,
    });
  }
  return failure({
    source: 'unknown',
    code: 'unknown',
    message: message(cause),
    retryable: false,
  });
}

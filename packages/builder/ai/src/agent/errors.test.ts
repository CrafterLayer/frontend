import { describe, expect, it } from 'vitest';

import { AiContextBudgetError } from '../plan/generate-plan';
import { AiValidatedProposalError } from '../plan/validated-proposal';
import { AiProviderError } from '../provider';
import { AiCommandPolicyError } from '../skills';
import { classifyAiRunFailure } from './errors';

describe('classifyAiRunFailure', () => {
  it('preserves provider refusal, retryability, and status as stable structured data', () => {
    const failure = classifyAiRunFailure(
      new AiProviderError('Rate limited.', {
        code: 'http-status',
        retryable: true,
        status: 429,
      }),
    );

    expect(failure).toEqual({
      source: 'provider',
      code: 'http-status',
      message: 'Rate limited.',
      retryable: true,
      status: 429,
    });
    expect(Object.isFrozen(failure)).toBe(true);
  });

  it('classifies budget and policy failures without asking UI code to parse prose', () => {
    expect(classifyAiRunFailure(new AiContextBudgetError(70_000, 64_000))).toMatchObject({
      source: 'context',
      code: 'context-budget',
      retryable: false,
    });
    expect(
      classifyAiRunFailure(new AiCommandPolicyError('empty-effective-policy', 'No commands.')),
    ).toEqual({
      source: 'policy',
      code: 'empty-effective-policy',
      message: 'No commands.',
      retryable: false,
    });
  });

  it('classifies AbortError as immutable, non-retryable run cancellation', () => {
    const failure = classifyAiRunFailure(new DOMException('Stopped by the host.', 'AbortError'));

    expect(failure).toEqual({
      source: 'run',
      code: 'cancelled',
      message: 'Stopped by the host.',
      retryable: false,
    });
    expect(Object.isFrozen(failure)).toBe(true);
  });

  it('allows a fresh retry after a source conflict without weakening integrity refusals', () => {
    expect(
      classifyAiRunFailure(new AiValidatedProposalError('stale-source', 'Newer content kept.')),
    ).toMatchObject({ source: 'context', code: 'stale-source', retryable: true });
    expect(
      classifyAiRunFailure(new AiValidatedProposalError('proposal-integrity-mismatch', 'Invalid.')),
    ).toMatchObject({ source: 'policy', retryable: false });
  });

  it('uses one stable unknown classification for unexpected thrown values', () => {
    expect(classifyAiRunFailure('broken observer')).toEqual({
      source: 'unknown',
      code: 'unknown',
      message: 'broken observer',
      retryable: false,
    });
  });
});

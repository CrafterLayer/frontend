import { describe, expect, it } from 'vitest';

import { estimateCanonicalJsonTokens } from '../internal/canonical-json';
import { estimateAssembledAiContextTokens } from '../context/assemble-context';
import type { AssembledAiContext } from '../types';
import {
  AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH,
  AI_PLAN_WIRE_VERSION,
  boundAiPlanWireInvalidOutputMessage,
  estimateAiPlanWireRequestTokens,
  type AiPlanWireInvalidOutputResponse,
  type AiPlanWireRequest,
  type AiPlanWireResponse,
} from './wire';

function context(): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    templates: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    commands: [],
    outputContract: { version: 1, schema: { type: 'object' } },
    omissions: [],
  };
}

describe('AI plan wire canonicalization', () => {
  it('publishes a bounded, versioned invalid-output response without removing legacy shapes', () => {
    const invalidOutput: AiPlanWireInvalidOutputResponse = {
      version: AI_PLAN_WIRE_VERSION,
      invalidOutput: { message: 'The generated payload was not a plan.' },
    };
    const compatible: readonly AiPlanWireResponse[] = [
      { rationale: 'Insert a hero.', commands: [] },
      { version: AI_PLAN_WIRE_VERSION, rationale: 'Insert a hero.', commands: [] },
      { refusal: 'Not an edit request.' },
      { version: AI_PLAN_WIRE_VERSION, refusal: 'Not an edit request.' },
      invalidOutput,
    ];

    expect(AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH).toBe(512);
    expect(
      boundAiPlanWireInvalidOutputMessage(
        `  ${'x'.repeat(AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH * 2)}  `,
      ),
    ).toBe('x'.repeat(AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH));
    expect(boundAiPlanWireInvalidOutputMessage('   ')).toBe(
      'The assistant server reported invalid output.',
    );
    expect(compatible).toHaveLength(5);
    expect(invalidOutput.invalidOutput.message).toBe('The generated payload was not a plan.');
  });

  it('uses the shared estimator for assembled context too', () => {
    expect(estimateAssembledAiContextTokens(context())).toBe(
      estimateCanonicalJsonTokens(context()),
    );
  });

  it('uses the same canonical estimator as context and cache identity', () => {
    const request: AiPlanWireRequest = {
      version: AI_PLAN_WIRE_VERSION,
      request: 'Add a hero',
      context: context(),
      history: [{ role: 'user', text: 'Use the current brand.' }],
    };

    expect(estimateAiPlanWireRequestTokens(request)).toBe(estimateCanonicalJsonTokens(request));
  });

  it('is invariant to insertion order in nested JSON data', () => {
    const first: AiPlanWireRequest = {
      version: AI_PLAN_WIRE_VERSION,
      request: 'Add a hero',
      context: {
        ...context(),
        document: {
          ...context().document,
          nodes: [
            { id: 'hero', type: 'hero', props: { tone: 'bold', heading: 'Hello' }, slots: {} },
          ],
        },
      },
    };
    const second: AiPlanWireRequest = {
      version: AI_PLAN_WIRE_VERSION,
      request: 'Add a hero',
      context: {
        ...context(),
        document: {
          ...context().document,
          nodes: [
            { id: 'hero', type: 'hero', props: { heading: 'Hello', tone: 'bold' }, slots: {} },
          ],
        },
      },
    };

    expect(estimateAiPlanWireRequestTokens(first)).toBe(estimateAiPlanWireRequestTokens(second));
  });
});

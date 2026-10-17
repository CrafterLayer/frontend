import { describe, expect, it } from 'vitest';

import { modelsEndpointFromEnv, readOfferedModels, sameModels } from './offered-models';

describe('modelsEndpointFromEnv', () => {
  it('puts the models route at the server root, whatever path the plan endpoint carries', () => {
    expect(modelsEndpointFromEnv({ VITE_AI_PLAN_ENDPOINT: 'http://localhost:8787/plan' })).toBe(
      'http://localhost:8787/v1/models',
    );
    expect(modelsEndpointFromEnv({ VITE_AI_PLAN_ENDPOINT: ' http://localhost:8787 ' })).toBe(
      'http://localhost:8787/v1/models',
    );
  });

  it('has none with no endpoint or a malformed one: the offline provider has no server to ask', () => {
    expect(modelsEndpointFromEnv({})).toBeUndefined();
    expect(modelsEndpointFromEnv({ VITE_AI_PLAN_ENDPOINT: '  ' })).toBeUndefined();
    expect(modelsEndpointFromEnv({ VITE_AI_PLAN_ENDPOINT: 'not a url' })).toBeUndefined();
  });
});

describe('readOfferedModels', () => {
  it('reads the ids in the server’s order, each once', () => {
    expect(
      readOfferedModels({
        models: [
          { id: 'cli:claude-sonnet-5-5', kind: 'configured' },
          { id: 'cli:claude-opus-5-5', kind: 'configured' },
          { id: 'new/arrival:free', kind: 'live', name: 'New Arrival' },
          { id: 'cli:claude-opus-5-5', kind: 'configured' },
        ],
      }),
    ).toEqual(['cli:claude-sonnet-5-5', 'cli:claude-opus-5-5', 'new/arrival:free']);
  });

  it('answers undefined for a body that is not an offer, so the picker keeps its list', () => {
    expect(readOfferedModels(null)).toBeUndefined();
    expect(readOfferedModels({})).toBeUndefined();
    expect(readOfferedModels({ models: 'x' })).toBeUndefined();
    expect(readOfferedModels({ models: [] })).toBeUndefined();
    expect(readOfferedModels({ models: [{ id: 7 }, null, { id: ' ' }] })).toBeUndefined();
  });
});

describe('sameModels', () => {
  it('is true only for the same ids in the same order', () => {
    expect(sameModels(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameModels(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameModels(['a'], ['a', 'b'])).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { enhancerModelFor, routeOf } from './enhance-route';

/* Moved from handler.test.ts (7fb6d05) to keep that file within its size baseline. */
describe('the prompt enhancer route', () => {
  const options = {
    model: 'cli:sonnet',
    models: ['cli:haiku', 'api:claude-opus-5-5', 'api:claude-haiku-5-5'],
    enhanceModel: 'cli:haiku',
  } as const;

  it('keeps the enhancer on the route the picker names: an api: pick is enhanced on the key', () => {
    expect(enhancerModelFor(options, 'api:claude-opus-5-5')).toBe('api:claude-haiku-5-5');
    expect(enhancerModelFor(options, 'cli:sonnet')).toBe('cli:haiku');
  });

  it('keeps the configured enhancer for an OpenRouter pick', () => {
    expect(enhancerModelFor(options, 'anthropic/claude-sonnet-4.5')).toBe('cli:haiku');
  });

  it('reads a model’s route from its prefix', () => {
    expect([routeOf('cli:haiku'), routeOf('api:claude-opus-5-5'), routeOf('vendor/model')]).toEqual(
      ['cli', 'api', ''],
    );
  });
});

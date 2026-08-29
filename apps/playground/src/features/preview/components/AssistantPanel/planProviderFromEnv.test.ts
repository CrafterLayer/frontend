import { describe, expect, it } from 'vitest';

import { planProviderFromEnv } from './planProviderFromEnv';

describe('planProviderFromEnv', () => {
  it('returns no provider when the endpoint is unset, so the local provider stays in charge', () => {
    expect(planProviderFromEnv({})).toBeUndefined();
    expect(planProviderFromEnv({ VITE_AI_PLAN_ENDPOINT: '' })).toBeUndefined();
    expect(planProviderFromEnv({ VITE_AI_PLAN_ENDPOINT: '   ' })).toBeUndefined();
  });

  it('builds a remote provider aimed at the configured endpoint', () => {
    const provider = planProviderFromEnv({
      VITE_AI_PLAN_ENDPOINT: 'https://assistant.example.test/plan',
    });

    expect(provider).toBeDefined();
    expect(typeof provider?.propose).toBe('function');
    expect(typeof provider?.repair).toBe('function');
  });
});

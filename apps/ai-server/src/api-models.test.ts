import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiBackend, subscriptionEnv } from './api-models';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('subscriptionEnv', () => {
  it('never hands the subscription CLI an API key or auth token', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', 'test-token');
    vi.stubEnv('PATH', '/usr/bin');
    const env = subscriptionEnv({ CLAUDE_EXTRA: '1' });
    expect(env['ANTHROPIC_API_KEY']).toBeUndefined();
    expect(env['ANTHROPIC_AUTH_TOKEN']).toBeUndefined();
    expect(env['PATH']).toBe('/usr/bin');
    expect(env['CLAUDE_EXTRA']).toBe('1');
  });
});

describe('createApiBackend', () => {
  it('builds no client while no api: model is listed, even with a key', () => {
    expect(createApiBackend([], 'sk-test-key')).toBeUndefined();
  });

  it('warns once and builds nothing when an api: model has no key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(createApiBackend(['api:claude-sonnet-5-5'], undefined)).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('api:claude-sonnet-5-5');
  });

  it('builds the Messages API client when an api: model and a key are both there', () => {
    expect(createApiBackend(['api:claude-sonnet-5-5'], 'sk-test-key')).toBeDefined();
  });
});

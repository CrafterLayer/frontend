import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { subscriptionEnv } from './api-models';
import { createCliClient, type CliChildProcess } from './cli-client';
import { createCliWarmPool, type CliWarmPool } from './cli-warm-pool';
import { CRAFTKIT_REASONING_EFFORT_HEADER } from './openrouter-client';

class FakeChild extends EventEmitter {
  readonly pid = undefined;
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin = new PassThrough();
  readonly kill = vi.fn();
}

interface Run {
  readonly child: FakeChild;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>> | undefined;
  input: string;
}

const pools: CliWarmPool[] = [];

afterEach(() => {
  pools.splice(0).forEach((pool) => {
    pool.dispose();
  });
  vi.unstubAllEnvs();
});

function fixture(warm = false) {
  const runs: Run[] = [];
  const pool = warm ? createCliWarmPool() : undefined;
  if (pool !== undefined) pools.push(pool);
  const client = createCliClient({
    ...(pool === undefined ? {} : { warmPool: pool }),
    writeSystemPrompt: () => ({ path: '/injected/system.md', remove: () => undefined }),
    spawnCli: (_command, args, env): CliChildProcess => {
      const child = new FakeChild();
      const run: Run = { child, args, env, input: '' };
      child.stdin.on('data', (chunk: Buffer) => {
        run.input += chunk.toString('utf8');
      });
      runs.push(run);
      return child;
    },
  });
  const run = (maxTokens: number | undefined, effort: string, thinkingOff = true) =>
    client.messages
      .stream(
        {
          ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
          model: 'cli:haiku',
          thinking: { type: thinkingOff ? 'disabled' : 'adaptive' },
          system: [{ type: 'text', text: 'rules' }],
          messages: [{ role: 'user', content: 'initialize the mural' }],
        } as never,
        { headers: { [CRAFTKIT_REASONING_EFFORT_HEADER]: effort } },
      )
      .finalMessage();
  return { runs, run };
}

function finish(run: Run | undefined): void {
  if (run === undefined) throw new Error('Expected a fake CLI run.');
  run.child.stdout.write(`${JSON.stringify({ type: 'result', result: '{}', is_error: false })}\n`);
  run.child.emit('close', 0, null);
}

function settings(run: Run | undefined): Record<string, unknown> {
  const at = run?.args.indexOf('--settings') ?? -1;
  if (at < 0) throw new Error('Expected explicit inline generation settings.');
  return JSON.parse(run?.args[at + 1] ?? '{}') as Record<string, unknown>;
}

describe('CLI generation budgets', () => {
  it.each([
    { tokens: 900, effort: 'low', off: true },
    { tokens: 8_192, effort: 'low', off: true },
    { tokens: 48_000, effort: 'medium', off: false },
    { tokens: 64_000, effort: 'max', off: false },
  ])(
    'carries $tokens/$effort to both the child and inline settings',
    async ({ tokens, effort, off }) => {
      vi.stubEnv('CLAUDE_CODE_MAX_OUTPUT_TOKENS', '128000');
      vi.stubEnv('CLAUDE_CODE_EFFORT_LEVEL', 'high');
      vi.stubEnv('ANTHROPIC_API_KEY', 'fake-api-key');
      const { runs, run } = fixture();
      const answer = run(tokens, effort, off);
      finish(runs[0]);
      await answer;

      const env = {
        ...(off ? { MAX_THINKING_TOKENS: '0' } : {}),
        CLAUDE_CODE_EFFORT_LEVEL: effort,
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(tokens),
      };
      expect(runs[0]?.env).toEqual(env);
      expect(settings(runs[0])).toEqual({ ...(off ? { alwaysThinkingEnabled: false } : {}), env });
      const childEnv = subscriptionEnv(runs[0]?.env);
      for (const [name, value] of Object.entries(env)) expect(childEnv[name]).toBe(value);
      expect(childEnv['ANTHROPIC_API_KEY']).toBeUndefined();
      expect(runs[0]?.args).toEqual(
        expect.arrayContaining(['--safe-mode', '--tools', '', '--max-turns', '1']),
      );
    },
  );

  it('keeps the output default when the caller supplied no cap', async () => {
    const { runs, run } = fixture();
    const answer = run(undefined, 'low');
    finish(runs[0]);
    await answer;
    expect(runs[0]?.env).not.toHaveProperty('CLAUDE_CODE_MAX_OUTPUT_TOKENS');
    expect(settings(runs[0])['env']).not.toHaveProperty('CLAUDE_CODE_MAX_OUTPUT_TOKENS');
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'refuses an invalid cap %s before spawning',
    (tokens) => {
      const { runs, run } = fixture();
      expect(() => run(tokens, 'low')).toThrow('positive safe integer');
      expect(runs).toHaveLength(0);
    },
  );

  it('reuses a warm child only for the same cap, including its inline settings', async () => {
    const { runs, run } = fixture(true);
    const first = run(8_192, 'low');
    finish(runs[0]);
    await first;
    expect(runs).toHaveLength(2);

    const larger = run(64_000, 'low');
    finish(runs[2]);
    await larger;
    expect(runs).toHaveLength(4);
    expect(runs[1]?.input).toBe('\n');
    expect(runs[2]?.env?.['CLAUDE_CODE_MAX_OUTPUT_TOKENS']).toBe('64000');

    const warm = run(8_192, 'low');
    finish(runs[1]);
    await warm;
    expect(runs).toHaveLength(5);
    expect(runs[1]?.input).toContain('initialize the mural');
    expect(runs[1]?.env?.['CLAUDE_CODE_MAX_OUTPUT_TOKENS']).toBe('8192');
    expect(settings(runs[1])['env']).toMatchObject({ CLAUDE_CODE_MAX_OUTPUT_TOKENS: '8192' });
    expect(runs[3]?.input).toBe('\n');
  });
});

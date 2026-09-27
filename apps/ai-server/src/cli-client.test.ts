import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLI_DEFAULT_TIMEOUT_MS, createCliClient, type CliChildProcess } from './cli-client';

/**
 * The dev CLI backend, tested without a `claude` on the PATH.
 *
 * What is being verified is the part that was silently broken: every way the
 * child can fail has to arrive at `handler.ts` as an error whose MESSAGE names
 * the cause. A plain `Error` there becomes "The assistant server failed
 * unexpectedly", which is exactly the sentence the panel showed for two
 * minutes of waiting while the CLI was being killed mid-plan.
 */

class FakeChild extends EventEmitter {
  readonly pid = undefined;
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin = new PassThrough();
  readonly kill = vi.fn();
}

function clientWith(child: FakeChild, timeoutMs?: number) {
  const spawnCli = vi.fn(
    (_command: string, _args: readonly string[]): CliChildProcess =>
      child as unknown as CliChildProcess,
  );
  const client = createCliClient({
    spawnCli,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  return { client, spawnCli };
}

function line(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}

const REQUEST = {
  system: [{ text: 'system' }],
  messages: [{ role: 'user', content: 'make a hero' }],
  output_config: { format: { schema: { type: 'object' } } },
};

describe('cli backend timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /*
    The measured reason this file changed: the CLI emits ~80 output tokens a
    second and a full-page plan is 15-25k of them, so the old 110s cap killed
    every real plan before it finished.
  */
  it('allows a plan far longer than the two minutes a real one needs', () => {
    expect(CLI_DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(600_000);
  });

  it('names the timeout, its length and the way out instead of failing namelessly', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const { client } = clientWith(child, 5_000);

    const finished = client.messages.stream(REQUEST as never).finalMessage();
    const settled = expect(finished).rejects.toThrow(/gave up after 5s/u);
    await vi.advanceTimersByTimeAsync(5_000);
    await settled;

    await expect(finished).rejects.toMatchObject({ name: 'CliBackendError' });
    expect(child.kill).toHaveBeenCalled();
  });
});

describe('cli backend narration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function progressOf(child: FakeChild, timeoutMs = 600_000): string[] {
    const seen: string[] = [];
    const spawnCli = vi.fn(
      (_command: string, _args: readonly string[]): CliChildProcess =>
        child as unknown as CliChildProcess,
    );
    const stream = createCliClient({ spawnCli, timeoutMs }).messages.stream(REQUEST as never);
    stream.on('thinking', (delta: string) => {
      for (const text of delta.split('\n')) if (text.trim() !== '') seen.push(text.trim());
    });
    return seen;
  }

  /*
    The CLI redacts the reasoning itself — every thinking_delta arrives as
    {"thinking":"","estimated_tokens":N} — so there is no sentence to forward.
    What it does carry is a measurement, and a measurement that moves is the
    difference between a live run and a panel that looks hung.
  */
  it('narrates the thinking phase from the only signal the CLI gives: a token count', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const seen = progressOf(child);

    child.stdout.write(
      line({
        type: 'stream_event',
        event: { type: 'content_block_start', content_block: { type: 'thinking' } },
      }),
    );
    child.stdout.write(
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'thinking_delta', thinking: '', estimated_tokens: 350 },
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(3_000);

    expect(seen.join(' | ')).toMatch(/Thinking/u);
    expect(seen.join(' | ')).toMatch(/350/u);
  });

  it('narrates the writing phase by how much plan has actually arrived', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const seen = progressOf(child);

    child.stdout.write(
      line({
        type: 'stream_event',
        event: { type: 'content_block_start', content_block: { type: 'text' } },
      }),
    );
    child.stdout.write(
      line({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'x'.repeat(4_200) },
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(3_000);

    expect(seen.join(' | ')).toMatch(/Writing the plan/u);
    expect(seen.join(' | ')).toMatch(/4,200|4200/u);
  });

  /* Minutes of silence read as a hang. The clock alone is enough to disprove it. */
  it('keeps the line moving even when the CLI says nothing at all', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const seen = progressOf(child);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen[seen.length - 1]).toMatch(/00:2\d|00:3\d/u);
  });
});

describe('cli backend effort', () => {
  it('passes the configured model and effort to the CLI', () => {
    const child = new FakeChild();
    const spawnCli = vi.fn(
      (_command: string, _args: readonly string[]): CliChildProcess =>
        child as unknown as CliChildProcess,
    );
    createCliClient({ spawnCli, model: 'claude-sonnet-5', effort: 'max' }).messages.stream(
      REQUEST as never,
    );

    const args = spawnCli.mock.calls[0]?.[1] ?? [];
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('claude-sonnet-5');
    expect(args).toContain('--effort');
    expect(args[args.indexOf('--effort') + 1]).toBe('max');
  });

  it('omits effort entirely when none is configured, leaving the CLI default', () => {
    const child = new FakeChild();
    const spawnCli = vi.fn(
      (_command: string, _args: readonly string[]): CliChildProcess =>
        child as unknown as CliChildProcess,
    );
    createCliClient({ spawnCli }).messages.stream(REQUEST as never);

    expect(spawnCli.mock.calls[0]?.[1] ?? []).not.toContain('--effort');
  });
});

describe('cli backend failures', () => {
  it("carries the CLI's own error text so the panel can show it", async () => {
    const child = new FakeChild();
    const { client } = clientWith(child);

    const finished = client.messages.stream(REQUEST as never).finalMessage();
    child.stdout.write(line({ type: 'result', is_error: true, result: 'Usage limit reached' }));

    await expect(finished).rejects.toThrow(/Usage limit reached/u);
  });

  it('carries the exit code and stderr when the CLI dies without a result', async () => {
    const child = new FakeChild();
    const { client } = clientWith(child);

    const finished = client.messages.stream(REQUEST as never).finalMessage();
    child.stderr.write('error: unknown option --tools\n');
    await Promise.resolve();
    child.emit('close', 2, null);

    await expect(finished).rejects.toThrow(/unknown option --tools/u);
    await expect(finished).rejects.toMatchObject({ name: 'CliBackendError' });
  });

  it('names a missing CLI rather than reporting a nameless failure', async () => {
    const child = new FakeChild();
    const { client } = clientWith(child);

    const finished = client.messages.stream(REQUEST as never).finalMessage();
    child.emit('error', new Error('spawn claude ENOENT'));

    await expect(finished).rejects.toThrow(/`claude` CLI/u);
  });

  it('still returns the plan text on a clean run', async () => {
    const child = new FakeChild();
    const { client } = clientWith(child);

    const finished = client.messages.stream(REQUEST as never).finalMessage();
    child.stdout.write(line({ type: 'result', is_error: false, result: '{"rationale":"ok"}' }));
    await Promise.resolve();
    child.emit('close', 0, null);

    const message = (await finished) as unknown as { content: { text: string }[] };
    expect(message.content[0]?.text).toBe('{"rationale":"ok"}');
  });
});

describe('cli backend system prompt', () => {
  function capture() {
    const child = new FakeChild();
    const written: string[] = [];
    const removed: string[] = [];
    const spawnCli = vi.fn(
      (_command: string, _args: readonly string[]): CliChildProcess =>
        child as unknown as CliChildProcess,
    );
    const client = createCliClient({
      spawnCli,
      writeSystemPrompt: (text) => {
        written.push(text);
        const path = `/tmp/fake-${String(written.length)}.md`;
        return { path, remove: () => removed.push(path) };
      },
    });
    let stdin = '';
    child.stdin.on('data', (chunk: Buffer) => {
      stdin += chunk.toString('utf8');
    });
    return { child, client, spawnCli, written, removed, stdin: () => stdin };
  }

  /*
    Measured 2026-09-27: every call also carried Claude Code's own ~3.2k-token
    coding-agent prompt, and the builder's rules arrived as user text the CLI
    could not cache between the four section writers of one build.
  */
  it('hands the rules and the output format to the CLI as its system prompt', async () => {
    const { client, spawnCli, written, stdin, child } = capture();

    const finished = client.messages.stream(REQUEST as never).finalMessage();
    await new Promise((resolve) => setImmediate(resolve));

    const args = spawnCli.mock.calls[0]?.[1] ?? [];
    expect(args[args.indexOf('--system-prompt-file') + 1]).toBe('/tmp/fake-1.md');
    expect(written[0]).toContain('system');
    expect(written[0]).toContain('# Required output format');
    expect(stdin()).toContain('make a hero');
    expect(stdin()).not.toContain('# Required output format');
    child.emit('close', 0, null);
    await expect(finished).rejects.toThrow(/without a plan/u);
  });

  it('removes the system prompt file once the run ends, however it ends', async () => {
    const { client, removed, child } = capture();

    const finished = client.messages.stream(REQUEST as never).finalMessage();
    child.emit('error', new Error('spawn claude ENOENT'));
    await expect(finished).rejects.toThrow();

    expect(removed).toEqual(['/tmp/fake-1.md']);
  });
});

describe('cli backend usage', () => {
  it("reports the run's real token usage instead of zeros", async () => {
    const child = new FakeChild();
    const { client } = clientWith(child);

    const finished = client.messages.stream(REQUEST as never).finalMessage();
    child.stdout.write(
      line({
        type: 'result',
        is_error: false,
        result: '{"rationale":"ok"}',
        duration_api_ms: 21_000,
        usage: {
          input_tokens: 812,
          output_tokens: 1_404,
          cache_read_input_tokens: 7_900,
          cache_creation_input_tokens: 0,
        },
      }),
    );
    await Promise.resolve();
    child.emit('close', 0, null);

    const message = (await finished) as unknown as { usage: Record<string, number> };
    expect(message.usage).toEqual({
      input_tokens: 812,
      output_tokens: 1_404,
      cache_read_input_tokens: 7_900,
      cache_creation_input_tokens: 0,
    });
  });
});

describe('cli backend per-call effort', () => {
  it('lets a call override the configured effort through the internal header', () => {
    const child = new FakeChild();
    const spawnCli = vi.fn(
      (_command: string, _args: readonly string[]): CliChildProcess =>
        child as unknown as CliChildProcess,
    );
    createCliClient({
      spawnCli,
      effort: 'medium',
      writeSystemPrompt: () => ({ path: '/tmp/x.md', remove: () => undefined }),
    }).messages.stream(
      REQUEST as never,
      {
        headers: { 'x-craftkit-internal-reasoning-effort': 'low' },
      },
    );

    const args = spawnCli.mock.calls[0]?.[1] ?? [];
    expect(args[args.indexOf('--effort') + 1]).toBe('low');
  });
});

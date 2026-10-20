import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCodexClient, type CodexClient, type CodexClientOptions } from './codex-client';
import { CODEX_MAX_OUTPUT_BYTES, type SpawnCodex } from './codex-config';
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
  readonly directory: string;
  readonly env: NodeJS.ProcessEnv;
  input: string;
}

const REQUEST = {
  system: [{ text: 'Return a useful plan.' }],
  messages: [{ role: 'user', content: 'make a hero' }],
  max_tokens: 8_192,
  output_config: {
    format: { schema: { type: 'object', properties: { title: { type: 'string' } } } },
  },
};
const clients: CodexClient[] = [];
const children: FakeChild[] = [];
const pending: Promise<unknown>[] = [];

afterEach(async () => {
  clients.splice(0).forEach((client) => {
    client.dispose();
  });
  children.splice(0).forEach((child) => child.emit('close', 0, null));
  await Promise.allSettled(pending.splice(0));
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function fixture(options: Omit<CodexClientOptions, 'spawnCli'> = {}, onSpawn?: (run: Run) => void) {
  const runs: Run[] = [];
  const spawnCli = vi.fn<SpawnCodex>((_command, args, settings) => {
    const child = new FakeChild();
    const run: Run = { child, args, directory: settings.cwd, env: settings.env, input: '' };
    child.stdin.on('data', (chunk: Buffer) => {
      run.input += chunk.toString('utf8');
    });
    children.push(child);
    runs.push(run);
    onSpawn?.(run);
    return child;
  });
  const client = createCodexClient({ ...options, spawnCli });
  clients.push(client);
  const begin = (
    params: Record<string, unknown> = {},
    request: { signal?: AbortSignal; headers?: Record<string, string> } = {},
  ) => {
    const stream = client.messages.stream({ ...REQUEST, ...params } as never, request);
    const final = stream.finalMessage();
    pending.push(final);
    return { stream, final };
  };
  const run = (index = 0): Run => {
    const found = runs[index];
    if (found === undefined) throw new Error(`Expected fake child ${String(index)}.`);
    return found;
  };
  return { client, spawnCli, runs, run, begin };
}

function event(run: Run, value: unknown): void {
  run.child.stdout.write(`${JSON.stringify(value)}\n`);
}

function answer(run: Run, text = '{"title":"Final answer"}'): void {
  const path = run.args[run.args.indexOf('--output-last-message') + 1];
  if (path === undefined) throw new Error('Expected a final answer path.');
  writeFileSync(path, text);
}

function succeed(run: Run, usage: Record<string, unknown> = {}): void {
  answer(run);
  event(run, { type: 'turn.completed', usage });
  run.child.emit('close', 0, null);
}

describe('Codex final answers and launch inputs', () => {
  it('returns only the final file, never commentary or private reasoning, after clean completion', async () => {
    const f = fixture();
    const { stream, final } = f.begin();
    const text = vi.fn();
    const thinking = vi.fn();
    stream.on('text', text);
    stream.on('thinking', thinking);
    await Promise.resolve();
    event(f.run(), { type: 'item.completed', item: { type: 'agent_message', text: 'Commentary' } });
    event(f.run(), {
      type: 'item.completed',
      item: { type: 'reasoning', text: 'Private reasoning' },
    });
    event(f.run(), { type: 'turn.started' });
    expect(text).not.toHaveBeenCalled();
    succeed(f.run(), { input_tokens: 100, cached_input_tokens: 40, output_tokens: 17 });
    expect(await final).toMatchObject({
      content: [{ type: 'text', text: '{"title":"Final answer"}' }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 60,
        cache_read_input_tokens: 40,
        output_tokens: 17,
        cache_creation_input_tokens: null,
      },
    });
    expect(text).toHaveBeenCalledExactlyOnceWith('{"title":"Final answer"}');
    expect(thinking).not.toHaveBeenCalled();
    expect(existsSync(f.run().directory)).toBe(false);
  });

  it('accepts fragmented JSONL and a final frame without newline after a recovered connection error', async () => {
    const f = fixture();
    const { final } = f.begin();
    await Promise.resolve();
    answer(f.run(), '{"title":"أهلاً"}');
    event(f.run(), { type: 'error', message: 'Transient connection error' });
    const completed = JSON.stringify({ type: 'turn.completed', usage: { output_tokens: 5 } });
    f.run().child.stdout.write(completed.slice(0, 12));
    f.run().child.stdout.write(completed.slice(12));
    f.run().child.emit('close', 0, null);
    expect(await final).toMatchObject({
      content: [{ type: 'text', text: '{"title":"أهلاً"}' }],
      usage: { output_tokens: 5 },
    });
  });

  it.each([
    {
      usage: {},
      expected: { input_tokens: null, output_tokens: null, cache_read_input_tokens: null },
    },
    {
      usage: { input_tokens: 9, output_tokens: -1, cached_input_tokens: 1.5 },
      expected: { input_tokens: 9, output_tokens: null, cache_read_input_tokens: null },
    },
    {
      usage: { input_tokens: 3, output_tokens: 0, cached_input_tokens: 5 },
      expected: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 5 },
    },
  ])(
    'reports valid usage and keeps unavailable measurements unknown: $usage',
    async ({ usage, expected }) => {
      const f = fixture();
      const { final } = f.begin();
      await Promise.resolve();
      succeed(f.run(), usage);
      expect((await final).usage).toMatchObject({ ...expected, cache_creation_input_tokens: null });
    },
  );

  it.each([
    { requested: 'gpt-allowed', selected: 'gpt-allowed' },
    { requested: 'gpt-default', selected: 'gpt-default' },
    { requested: 'arbitrary-model', selected: 'gpt-default' },
  ])('allows only configured models: $requested', async ({ requested, selected }) => {
    const f = fixture({ model: 'gpt-default', allowedModels: ['gpt-allowed'] });
    const { final } = f.begin({ model: requested });
    await Promise.resolve();
    expect(f.run().args[f.run().args.indexOf('--model') + 1]).toBe(selected);
    succeed(f.run());
    await final;
  });

  it('distinguishes an explicit CLI-default selection from an omitted model', async () => {
    const f = fixture({ model: 'gpt-configured', allowedModels: ['codex-default'] });
    const selectedDefault = f.begin({ model: 'codex:' });
    await Promise.resolve();
    expect(f.run().args).not.toContain('--model');
    succeed(f.run());
    await selectedDefault.final;

    const omitted = f.begin();
    await Promise.resolve();
    expect(f.run(1).args[f.run(1).args.indexOf('--model') + 1]).toBe('gpt-configured');
    succeed(f.run(1));
    await omitted.final;
  });

  it('sends prompts through stdin, schema as instructions and isolated subscription settings', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'fixture-key');
    vi.stubEnv('OPENAI_BASE_URL', 'https://untrusted.invalid');
    const f = fixture({ effort: 'medium' });
    const { final } = f.begin({}, { headers: { [CRAFTKIT_REASONING_EFFORT_HEADER]: 'max' } });
    await Promise.resolve();
    const run = f.run();
    const config = run.args.find((arg) => arg.startsWith('model_instructions_file='));
    const path = JSON.parse(config?.slice('model_instructions_file='.length) ?? 'null') as string;
    const instructions = readFileSync(path, 'utf8');
    expect(instructions).toContain('Return a useful plan.');
    expect(instructions).toContain(JSON.stringify(REQUEST.output_config.format.schema));
    expect(instructions).toContain('8192 output tokens');
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(run.input).toBe('User: make a hero');
    expect(run.args).not.toContain('make a hero');
    expect(run.args).toContain('model_reasoning_effort="xhigh"');
    expect(run.env).not.toHaveProperty('OPENAI_API_KEY');
    expect(run.env).not.toHaveProperty('OPENAI_BASE_URL');
    expect(f.spawnCli.mock.calls[0]?.[0]).toBe('codex');
    succeed(run);
    await final;
  });

  it('forwards image bytes to private local files and cleans them after completion', async () => {
    const f = fixture();
    const bytes = Buffer.from('fixture-png-bytes');
    const { final } = f.begin({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Review this screenshot' },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: bytes.toString('base64') },
            },
          ],
        },
      ],
    });
    await Promise.resolve();
    const run = f.run();
    const path = run.args[run.args.indexOf('--image') + 1];
    expect(path).toBeDefined();
    expect(readFileSync(path ?? '')).toEqual(bytes);
    expect(statSync(path ?? '').mode & 0o777).toBe(0o600);
    expect(run.input).toContain('[Attached image 1]');
    succeed(run);
    await final;
    expect(existsSync(path ?? '')).toBe(false);
  });

  it.each([
    { type: 'image', source: { type: 'url', url: 'https://example.invalid/image.png' } },
    { type: 'image', source: { type: 'base64', media_type: 'image/svg+xml', data: 'aGVsbG8=' } },
    { type: 'tool_result', content: 'unsupported' },
  ])('explicitly rejects unsupported message input before spawning', async (block) => {
    const f = fixture();
    const { final } = f.begin({ messages: [{ role: 'user', content: [block] }] });
    await expect(final).rejects.toMatchObject({ httpStatus: 400, retryable: false });
    expect(f.spawnCli).not.toHaveBeenCalled();
  });

  it.each([
    { count: 5, data: 'aGVsbG8=' },
    { count: 1, data: '' },
  ])('rejects excessive image count or empty bytes before spawning', async ({ count, data }) => {
    const f = fixture();
    const content = Array.from({ length: count }, () => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data },
    }));
    const { final } = f.begin({ messages: [{ role: 'user', content }] });
    await expect(final).rejects.toMatchObject({ httpStatus: 413, retryable: false });
    expect(f.spawnCli).not.toHaveBeenCalled();
  });
});

describe('Codex cancellation and bounded lifetime', () => {
  it('never spawns for an already aborted request or a disposed client', async () => {
    const f = fixture();
    await expect(f.begin({}, { signal: AbortSignal.abort() }).final).rejects.toMatchObject({
      name: 'AbortError',
    });
    f.client.dispose();
    await expect(f.begin().final).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.spawnCli).not.toHaveBeenCalled();
  });

  it('cancels once, ignores late success and removes temporary files', async () => {
    const f = fixture();
    const controller = new AbortController();
    const { stream, final } = f.begin({}, { signal: controller.signal });
    const text = vi.fn();
    stream.on('text', text);
    await Promise.resolve();
    const run = f.run();
    answer(run);
    controller.abort();
    event(run, { type: 'turn.completed' });
    run.child.emit('close', 0, null);
    await expect(final).rejects.toMatchObject({ name: 'AbortError' });
    expect(run.child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
    expect(text).not.toHaveBeenCalled();
    expect(existsSync(run.directory)).toBe(false);
  });

  it('observes cancellation that arrives during synchronous spawning', async () => {
    const controller = new AbortController();
    const f = fixture({}, () => {
      controller.abort();
    });
    await expect(f.begin({}, { signal: controller.signal }).final).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(f.run().input).toBe('');
    expect(f.run().child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(existsSync(f.run().directory)).toBe(false);
  });

  it('enforces the full deadline, escalates unclosed children and ignores their late output', async () => {
    vi.useFakeTimers();
    const f = fixture({ timeoutMs: 5_000 });
    const { final } = f.begin();
    await Promise.resolve();
    answer(f.run());
    const rejected = expect(final).rejects.toMatchObject({ httpStatus: 504 });
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    await expect(final).rejects.toThrow('5s process deadline');
    expect(f.run().child.kill).toHaveBeenCalledWith('SIGTERM');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(f.run().child.kill).toHaveBeenCalledWith('SIGKILL');
    event(f.run(), { type: 'turn.completed' });
    f.run().child.emit('close', 0, null);
    expect(existsSync(f.run().directory)).toBe(false);
  });

  it('limits active requests to six, rejects overflow without a queue and releases a slot', async () => {
    const f = fixture();
    const running = Array.from({ length: 6 }, () => f.begin().final);
    await Promise.resolve();
    expect(f.runs).toHaveLength(6);
    await expect(f.begin().final).rejects.toMatchObject({ httpStatus: 429 });
    expect(f.runs).toHaveLength(6);
    succeed(f.run());
    await running[0];
    const next = f.begin().final;
    await Promise.resolve();
    expect(f.runs).toHaveLength(7);
    succeed(f.run(6));
    await next;
    f.client.dispose();
    for (const final of running.slice(1)) {
      await expect(final).rejects.toMatchObject({ name: 'AbortError' });
    }
    expect(f.runs.every((run) => !existsSync(run.directory))).toBe(true);
  });

  it('keeps aborted children inside the six-process cap until close releases a slot', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const controller = new AbortController();
    const running = Array.from(
      { length: 6 },
      () => f.begin({}, { signal: controller.signal }).final,
    );
    await Promise.resolve();
    controller.abort();
    for (const final of running) {
      await expect(final).rejects.toMatchObject({ name: 'AbortError' });
    }
    await expect(f.begin().final).rejects.toMatchObject({ httpStatus: 429 });
    expect(f.runs).toHaveLength(6);
    expect(f.runs.every((run) => run.child.kill.mock.calls.length === 1)).toBe(true);

    f.run().child.emit('close', null, 'SIGTERM');
    const replacement = f.begin().final;
    await Promise.resolve();
    expect(f.runs).toHaveLength(7);
    succeed(f.run(6));
    await expect(replacement).resolves.toHaveProperty('stop_reason', 'end_turn');
    expect(f.runs).toHaveLength(7);
  });

  it('hard-kills aborted but unclosed children after their requests have settled and cleaned files', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const controller = new AbortController();
    const running = Array.from(
      { length: 6 },
      () => f.begin({}, { signal: controller.signal }).final,
    );
    await Promise.resolve();
    expect(f.runs.every((run) => existsSync(run.directory))).toBe(true);
    controller.abort();
    for (const final of running) {
      await expect(final).rejects.toMatchObject({ name: 'AbortError' });
    }
    f.client.dispose();
    for (const run of f.runs) {
      expect(run.child.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
      expect(existsSync(run.directory)).toBe(false);
    }
  });
});

describe('Codex failed and invalid runs', () => {
  it.each([
    { diagnostic: 'private details authentication 401', status: 503 },
    { diagnostic: 'private details usage limit reached', status: 429 },
    { diagnostic: 'private details unknown error', status: 502 },
  ])('maps failed turns to safe errors with status $status', async ({ diagnostic, status }) => {
    const f = fixture();
    const { final } = f.begin();
    await Promise.resolve();
    answer(f.run());
    event(f.run(), { type: 'turn.failed', error: { message: diagnostic } });
    event(f.run(), { type: 'turn.completed' });
    f.run().child.emit('close', 0, null);
    await expect(final).rejects.toMatchObject({ httpStatus: status });
    await expect(final).rejects.not.toThrow('private details');
    expect(existsSync(f.run().directory)).toBe(false);
  });

  it.each([
    { code: 2, signal: null, completed: true },
    { code: null, signal: 'SIGTERM', completed: true },
    { code: 0, signal: null, completed: false },
  ])(
    'requires successful exit and a completed turn: $code/$signal/$completed',
    async ({ code, signal, completed }) => {
      const f = fixture();
      const { final } = f.begin();
      await Promise.resolve();
      answer(f.run());
      if (completed) event(f.run(), { type: 'turn.completed' });
      f.run().child.emit('close', code, signal);
      await expect(final).rejects.toMatchObject({ httpStatus: 502 });
    },
  );

  it.each(['malformed', 'oversized', 'spawn-error', 'stdin-error'] as const)(
    'rejects %s and cleans up the request',
    async (failure) => {
      const f = fixture();
      const { final } = f.begin();
      await Promise.resolve();
      const run = f.run();
      if (failure === 'malformed') run.child.stdout.write('not-json\n');
      if (failure === 'oversized')
        run.child.stdout.write(Buffer.alloc(CODEX_MAX_OUTPUT_BYTES + 1, 'x'));
      if (failure === 'spawn-error') run.child.emit('error', new Error('private details ENOENT'));
      if (failure === 'stdin-error')
        run.child.stdin.emit('error', new Error('private details EPIPE'));
      await expect(final).rejects.toMatchObject({ name: 'CodexBackendError' });
      await expect(final).rejects.not.toThrow('private details');
      expect(run.child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(existsSync(run.directory)).toBe(false);
    },
  );

  it('cleans prepared files when spawning throws and allows subsequent calls', async () => {
    let fail = true;
    const f = fixture({}, () => {
      if (fail) throw new Error('private details spawn failure');
    });
    await expect(f.begin().final).rejects.toMatchObject({ httpStatus: 503 });
    expect(existsSync(f.run().directory)).toBe(false);
    fail = false;
    const { final } = f.begin();
    await Promise.resolve();
    succeed(f.run(1));
    await expect(final).resolves.toHaveProperty('stop_reason', 'end_turn');
  });

  it('settles and cleans up when writing stdin throws synchronously', async () => {
    const f = fixture({}, (run) => {
      vi.spyOn(run.child.stdin, 'end').mockImplementation(() => {
        throw new Error('private details stdin failure');
      });
    });
    await expect(f.begin().final).rejects.toMatchObject({
      httpStatus: 502,
      message: 'Could not send the request to Codex.',
    });
    expect(f.run().child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(existsSync(f.run().directory)).toBe(false);
  });

  it.each(['missing', 'empty', 'oversized'] as const)(
    'rejects a %s final answer file',
    async (kind) => {
      const f = fixture();
      const { final } = f.begin();
      await Promise.resolve();
      if (kind !== 'missing')
        answer(f.run(), kind === 'empty' ? ' \n ' : 'x'.repeat(CODEX_MAX_OUTPUT_BYTES + 1));
      event(f.run(), { type: 'turn.completed' });
      f.run().child.emit('close', 0, null);
      await expect(final).rejects.toMatchObject({ httpStatus: 502 });
      expect(existsSync(f.run().directory)).toBe(false);
    },
  );
});

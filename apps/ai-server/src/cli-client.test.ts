import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLI_DEFAULT_TIMEOUT_MS, createCliClient, type CliChildProcess } from './cli-client';
import { ENHANCE_RULES_TEXT } from './enhance';
import { createHandler } from './handler';
import { PAGE_PLAN_EXAMPLE } from './plan-shape';
import { PAGE_PLAN_CONTRACT_MARK } from './prompt';

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

  /*
    Measured over 26 fills (2026-09-29): about 9.6 s of every CLI call is the
    process starting, outside the model — "model 00:09" against "ended after
    00:21". The log said only the first number, so the cost of the process
    had to be worked out by hand. It now names the start-up and the whole run
    beside the model's own time.
  */
  it("logs the model's time apart from the process's start-up and the whole run", async () => {
    vi.useFakeTimers();
    try {
      const child = new FakeChild();
      const lines: string[] = [];
      const spawnCli = vi.fn(
        (_command: string, _args: readonly string[]): CliChildProcess =>
          child as unknown as CliChildProcess,
      );
      const finished = createCliClient({
        spawnCli,
        writeSystemPrompt: () => ({ path: '/tmp/x.md', remove: () => undefined }),
        onLog: (text) => lines.push(text),
      })
        .messages.stream(REQUEST as never)
        .finalMessage();

      await vi.advanceTimersByTimeAsync(9_000);
      child.stdout.write(line({ type: 'system', subtype: 'init' }));
      await vi.advanceTimersByTimeAsync(12_000);
      child.stdout.write(
        line({
          type: 'result',
          is_error: false,
          result: '{"rationale":"ok"}',
          duration_api_ms: 10_000,
          usage: { input_tokens: 1, output_tokens: 2 },
        }),
      );
      await Promise.resolve();
      child.emit('close', 0, null);
      await finished;

      const usage = lines.find((text) => text.startsWith('cli usage'));
      expect(usage).toContain('model 00:10');
      expect(usage).toContain('start-up 00:09');
      expect(usage).toContain('run 00:21');
    } finally {
      vi.useRealTimers();
    }
  });
});

/*
  Thinking off, as the call asked (2026-09-29). The enhancer sends
  `thinking: {type: 'disabled'}` and this shim dropped it, so the CLI ran its
  own default — thinking on. Measured on cli:haiku at --effort low: 56 s of
  thinking_tokens events and not one character of answer before a 90 s cap;
  on the scratch server «Improve» answered 504 on 6 runs of 6. The same
  call with thinking disabled answered in 19 s, 351 tokens, on a machine at
  load 960. The CLI has no --thinking flag; the `alwaysThinkingEnabled`
  setting is its switch, and it survives --safe-mode.
*/
describe('cli backend thinking', () => {
  function argsFor(thinking: unknown): readonly string[] {
    const child = new FakeChild();
    const spawnCli = vi.fn(
      (_command: string, _args: readonly string[]): CliChildProcess =>
        child as unknown as CliChildProcess,
    );
    createCliClient({
      spawnCli,
      writeSystemPrompt: () => ({ path: '/tmp/x.md', remove: () => undefined }),
    }).messages.stream({ ...REQUEST, ...(thinking === undefined ? {} : { thinking }) } as never);
    return spawnCli.mock.calls[0]?.[1] ?? [];
  }
  const settingsOf = (args: readonly string[]): unknown =>
    args.includes('--settings')
      ? JSON.parse(args[args.indexOf('--settings') + 1] ?? 'null')
      : undefined;

  it('turns thinking off in the CLI when the call disables it', () => {
    expect(settingsOf(argsFor({ type: 'disabled' }))).toEqual({ alwaysThinkingEnabled: false });
  });

  function envFor(thinking: unknown): Readonly<Record<string, string>> | undefined {
    const child = new FakeChild();
    const spawnCli = vi.fn(
      (
        _command: string,
        _args: readonly string[],
        _env?: Readonly<Record<string, string>>,
      ): CliChildProcess => child as unknown as CliChildProcess,
    );
    createCliClient({
      spawnCli,
      writeSystemPrompt: () => ({ path: '/tmp/x.md', remove: () => undefined }),
    }).messages.stream({ ...REQUEST, ...(thinking === undefined ? {} : { thinking }) } as never);
    return spawnCli.mock.calls[0]?.[2];
  }

  it('caps the thinking budget at zero when the call disables it', () => {
    // The settings switch alone left haiku writing ~4.3k thinking tokens (40-60 s).
    expect(envFor({ type: 'disabled' })).toEqual({ MAX_THINKING_TOKENS: '0' });
  });

  it('adds no thinking env for any other call', () => {
    expect(envFor(undefined)).toBeUndefined();
    expect(envFor({ type: 'adaptive', display: 'summarized' })).toBeUndefined();
  });

  it("leaves the CLI's thinking alone for every other call", () => {
    expect(argsFor(undefined)).not.toContain('--settings');
    expect(argsFor({ type: 'adaptive', display: 'summarized' })).not.toContain('--settings');
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
    }).messages.stream(REQUEST as never, {
      headers: { 'x-craftkit-internal-reasoning-effort': 'low' },
    });

    const args = spawnCli.mock.calls[0]?.[1] ?? [];
    expect(args[args.indexOf('--effort') + 1]).toBe('low');
  });
});

/**
 * A `claude` on PATH that records its argv, its system-prompt file and stdin,
 * then answers FAKE_CLAUDE_ANSWER in the real CLI's stream-json.
 */
const FAKE_CLAUDE = `#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const args = process.argv.slice(2);
const at = args.indexOf('--system-prompt-file');
const systemPath = at >= 0 ? args[at + 1] : undefined;
const system = systemPath === undefined ? '' : fs.readFileSync(systemPath, 'utf8');
let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { stdin += chunk; });
process.stdin.on('end', () => {
  fs.writeFileSync(process.env.FAKE_CLAUDE_RECORD, JSON.stringify({ args, systemPath, system, stdin }));
  const answer = process.env.FAKE_CLAUDE_ANSWER;
  const out = (event) => process.stdout.write(JSON.stringify(event) + '\\n');
  out({ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'text' } } });
  out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: answer } } });
  out({ type: 'result', is_error: false, result: answer, usage: { input_tokens: 12, output_tokens: 34 }, duration_api_ms: 5 });
});
`;

/*
  The page-plan task on the CLI backend, end to end through a real process:
  the handler, claude.ts and this shim run unmodified, the default spawner
  starts a `claude` found on PATH — here a fake one that records what it was
  given and answers like the real CLI's stream-json. It proves the task needs
  nothing CLI-specific: the plan call's own rules and answer schema reach the
  CLI as its system prompt, and its answer comes back as the wire's page plan.
*/
describe('the page-plan task through a real `claude` process', () => {
  let directory: string | undefined;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('answers the page plan the fake CLI wrote, having handed it the page-plan contract', async () => {
    directory = mkdtempSync(join(tmpdir(), 'fake-claude-'));
    const binary = join(directory, 'claude');
    writeFileSync(binary, FAKE_CLAUDE, { mode: 0o755 });
    const record = join(directory, 'record.json');
    const answer = { rationale: PAGE_PLAN_EXAMPLE.rationale, pagePlan: PAGE_PLAN_EXAMPLE.pagePlan };
    vi.stubEnv('PATH', `${directory}${delimiter}${process.env['PATH'] ?? ''}`);
    vi.stubEnv('FAKE_CLAUDE_RECORD', record);
    // Fenced, as the CLI's model sometimes answers despite being told not to.
    vi.stubEnv('FAKE_CLAUDE_ANSWER', `\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``);
    const handle = createHandler({ client: createCliClient(), sectionEffort: 'low' });

    const response = await handle(
      new Request('http://localhost/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          task: 'page-plan',
          request: 'اعمل صفحة لمحمصة قهوة',
          context: {
            fragments: [],
            totalTokens: 0,
            blocks: [],
            document: { schemaVersion: 1, surface: 'site', dir: 'rtl', rootId: 'root', nodes: [] },
            selection: { ids: [] },
            outputContract: { version: 1, schema: { type: 'object' } },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, ...answer });
    const seen = JSON.parse(readFileSync(record, 'utf8')) as {
      args: string[];
      systemPath: string;
      system: string;
      stdin: string;
    };
    expect(seen.system).toContain(PAGE_PLAN_CONTRACT_MARK);
    expect(seen.system).toContain('# Required output format');
    expect(seen.system).toContain('"pagePlan"');
    expect(seen.system).not.toContain('# Block catalog');
    expect(seen.stdin).toContain('اعمل صفحة لمحمصة قهوة');
    // A planning call: the backend default, never the section writers' `low`.
    expect(seen.args).not.toContain('--effort');
    expect(existsSync(seen.systemPath)).toBe(false);
    // A real process: node's own start-up took seconds on the loaded machine this was written on.
  }, 60_000);
});

/*
  Stop on the CLI backend. Measured 2026-09-28 against the built server: a
  page-plan request aborted 8s in left its `claude -p` child running — still
  alive 38s later, and it finished its whole 51s run — because this shim read
  the call's effort header and never its signal; only the 10-minute timeout
  ever killed a CLI. Every other backend stops when the request does (the
  OpenRouter run ended 00:07 after an abort at 8s), and a CLI left running
  holds a subscription slot the next request is waiting for.
*/
describe('cli backend cancellation', () => {
  it('kills the CLI and rejects as an abort the moment the request is cancelled', async () => {
    const child = new FakeChild();
    const { client } = clientWith(child);
    const controller = new AbortController();

    const finished = client.messages
      .stream(REQUEST as never, { signal: controller.signal })
      .finalMessage();
    controller.abort();

    await expect(finished).rejects.toMatchObject({ name: 'AbortError' });
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('never starts a CLI for a request that was cancelled before it began', async () => {
    const child = new FakeChild();
    const { client, spawnCli } = clientWith(child);
    const controller = new AbortController();
    controller.abort();

    const finished = client.messages
      .stream(REQUEST as never, { signal: controller.signal })
      .finalMessage();

    await expect(finished).rejects.toMatchObject({ name: 'AbortError' });
    expect(spawnCli).not.toHaveBeenCalled();
  });

  it('stops a real `claude` process group when the page-plan request is cancelled', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fake-claude-'));
    try {
      const pidFile = join(directory, 'pid');
      // A CLI that never answers: it records its pid and waits to be killed.
      writeFileSync(
        join(directory, 'claude'),
        `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\nsetInterval(() => undefined, 1000);\n`,
        { mode: 0o755 },
      );
      vi.stubEnv('PATH', `${directory}${delimiter}${process.env['PATH'] ?? ''}`);
      const controller = new AbortController();
      const handle = createHandler({ client: createCliClient() });

      const answered = handle(
        new Request('http://localhost/plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            version: 1,
            task: 'page-plan',
            request: 'Build a page for a bakery',
            context: {
              fragments: [],
              totalTokens: 0,
              blocks: [],
              document: {
                schemaVersion: 1,
                surface: 'site',
                dir: 'ltr',
                rootId: 'root',
                nodes: [],
              },
              selection: { ids: [] },
            },
          }),
          signal: controller.signal,
        }),
      );
      let pid = 0;
      /*
        Generous on purpose: this waits on a real node child starting, which took
        over 20 s at load 450-610 and 2.2 s on a quiet machine. The budget only
        bounds a genuine hang; a pass never waits for it.
      */
      for (let waited = 0; pid === 0 && waited < 30_000; waited += 50) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (existsSync(pidFile)) pid = Number(readFileSync(pidFile, 'utf8'));
      }
      expect(pid).toBeGreaterThan(0);

      controller.abort();
      const response = await answered;

      expect(response.status).toBe(499);
      let alive = true;
      for (let waited = 0; alive && waited < 10_000; waited += 50) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        try {
          process.kill(pid, 0);
        } catch {
          alive = false;
        }
      }
      expect(alive).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120_000);
});

/*
  A call's own model on the `cli` backend (2026-09-28). The handler vets the
  picker's model — or a small edit's fast one, or the enhancer's — against
  CRAFTKIT_AI_MODELS and hands it on as `params.model`; this shim used to run
  its configured model regardless. It now runs a listed one, and anything else
  (claude.ts's `claude-opus-5` placeholder above all) keeps the configured one.
*/
describe('cli backend per-call model', () => {
  function argsFor(
    model: string | undefined,
    allowedModels?: readonly string[],
  ): readonly string[] {
    const child = new FakeChild();
    const spawnCli = vi.fn(
      (_command: string, _args: readonly string[]): CliChildProcess =>
        child as unknown as CliChildProcess,
    );
    createCliClient({
      spawnCli,
      model: 'sonnet',
      ...(allowedModels === undefined ? {} : { allowedModels }),
      writeSystemPrompt: () => ({ path: '/tmp/x.md', remove: () => undefined }),
    }).messages.stream({ ...REQUEST, ...(model === undefined ? {} : { model }) } as never);
    return spawnCli.mock.calls[0]?.[1] ?? [];
  }
  const modelOf = (args: readonly string[]): string | undefined =>
    args.includes('--model') ? args[args.indexOf('--model') + 1] : undefined;

  it('runs a call on the model it names when the server allows it, the cli: prefix dropped', () => {
    expect(modelOf(argsFor('cli:haiku', ['cli:haiku', 'opus']))).toBe('haiku');
    expect(modelOf(argsFor('opus', ['cli:haiku', 'opus']))).toBe('opus');
  });

  it('keeps the configured model for anything unlisted, or when nothing is listed', () => {
    expect(modelOf(argsFor('claude-opus-5', ['cli:haiku']))).toBe('sonnet');
    expect(modelOf(argsFor(undefined, ['cli:haiku']))).toBe('sonnet');
    expect(modelOf(argsFor('cli:haiku'))).toBe('sonnet');
  });
});

/*
  The prompt enhancer on the CLI backend, end to end through a real process:
  handler → enhance.ts → this shim → a `claude` on PATH. It proves the route
  needs nothing CLI-specific, and that the CLI really runs it fast: on the
  fastest allowed model, at --effort low, with the enhancer's own rules and
  answer schema as its system prompt.
*/
describe('the prompt enhancer through a real `claude` process', () => {
  let directory: string | undefined;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('answers the enhancement the fake CLI wrote, on haiku at low effort, with the enhancer rules', async () => {
    directory = mkdtempSync(join(tmpdir(), 'fake-claude-'));
    writeFileSync(join(directory, 'claude'), FAKE_CLAUDE, { mode: 0o755 });
    const record = join(directory, 'record.json');
    const answer = {
      enhanced: 'اعمل صفحة هبوط لمخبز في عمّان: الهيرو، المنتجات، الأسعار، التواصل.',
      understood: 'صفحة هبوط لمخبز في عمّان.',
      changes: ['«صفحه» ← «صفحة»'],
      questions: [{ id: 'q1', text: 'ما الإجراء الرئيسي؟', choices: ['اطلب الآن', 'زرنا'] }],
      language: 'ar',
    };
    vi.stubEnv('PATH', `${directory}${delimiter}${process.env['PATH'] ?? ''}`);
    vi.stubEnv('FAKE_CLAUDE_RECORD', record);
    vi.stubEnv('FAKE_CLAUDE_ANSWER', `\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``);
    const handle = createHandler({
      client: createCliClient({ model: 'sonnet', allowedModels: ['haiku'] }),
      model: 'sonnet',
      models: ['haiku'],
      authToken: 'secret',
    });

    const response = await handle(
      new Request('http://localhost/v1/prompt/enhance', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer secret' },
        body: JSON.stringify({
          version: 1,
          text: 'اعمل صفحه هبوط لمخبز في عمان',
          locale: 'ar',
          intent: { kind: 'build-page', confidence: 0.85 },
          page: { empty: true, sections: [] },
          selection: null,
          answers: [],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, ...answer });
    const seen = JSON.parse(readFileSync(record, 'utf8')) as {
      args: string[];
      systemPath: string;
      system: string;
      stdin: string;
    };
    expect(seen.args[seen.args.indexOf('--model') + 1]).toBe('haiku');
    expect(seen.args[seen.args.indexOf('--effort') + 1]).toBe('low');
    // Thinking off: with it on, haiku thought past every cap and never answered.
    expect(JSON.parse(seen.args[seen.args.indexOf('--settings') + 1] ?? 'null')).toEqual({
      alwaysThinkingEnabled: false,
    });
    expect(seen.system).toContain(ENHANCE_RULES_TEXT);
    expect(seen.system).toContain('# Required output format');
    expect(seen.system).toContain('"enhanced"');
    expect(seen.stdin).toContain('اعمل صفحه هبوط لمخبز في عمان');
    expect(existsSync(seen.systemPath)).toBe(false);
    // A real process: node's own start-up took seconds on the loaded machine this was written on.
  }, 60_000);
});

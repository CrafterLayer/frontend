import { EventEmitter } from 'node:events';
import { writeFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { batchBackendFor } from './api-models';
import { createCodexClient } from './codex-client';
import { CODEX_DEFAULT_MODEL, type SpawnCodex } from './codex-config';
import { createHandler } from './handler';

const PLAN = { rationale: 'add a hero', commands: [{ command: 'insertNode', args: {} }] };
const BODY = {
  version: 1,
  request: 'add a hero',
  context: {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    outputContract: { version: 1, schema: { type: 'object' } },
  },
};

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://127.0.0.1/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(BODY),
  });
}

function setup(failure = false, answer: unknown = PLAN) {
  const onUsage = vi.fn();
  const spawnCli = vi.fn<SpawnCodex>((_command, args) => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      stdin: new PassThrough(),
      kill: vi.fn(),
    });
    child.stdin.on('finish', () => {
      if (failure) {
        child.stdout.write(
          `${JSON.stringify({ type: 'turn.failed', error: { message: 'authentication failed secret-value' } })}\n`,
        );
        child.emit('close', 1, null);
        return;
      }
      const path = args[args.indexOf('--output-last-message') + 1];
      if (path === undefined) throw new Error('missing final-output path');
      writeFileSync(path, JSON.stringify(answer));
      child.stdout.write(`${JSON.stringify({ type: 'turn.started' })}\n`);
      child.stdout.write(
        `${JSON.stringify({
          type: 'turn.completed',
          usage: {
            input_tokens: 100,
            cached_input_tokens: 60,
            output_tokens: 20,
          },
        })}\n`,
      );
      child.emit('close', 0, null);
    });
    return child;
  });
  const client = createCodexClient({ spawnCli, model: CODEX_DEFAULT_MODEL });
  return {
    spawnCli,
    onUsage,
    handle: createHandler({
      client,
      model: CODEX_DEFAULT_MODEL,
      authToken: 'local-test',
      onUsage,
      batches: batchBackendFor('codex', client, ['api:ignored'], 'unused-test-key'),
    }),
  };
}

describe('Codex through the existing HTTP contract', () => {
  it('keeps authentication and model authorization ahead of the child', async () => {
    const { handle, spawnCli } = setup();
    expect((await handle(request())).status).toBe(401);
    expect(
      (
        await handle(
          request({ authorization: 'Bearer local-test', 'x-craftkit-ai-model': 'arbitrary' }),
        )
      ).status,
    ).toBe(400);
    expect(spawnCli).not.toHaveBeenCalled();
  });

  it('returns a validated plan as JSON', async () => {
    const { handle } = setup();
    const response = await handle(request({ authorization: 'Bearer local-test' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PLAN);
  });

  it('returns public SSE progress and the same final result', async () => {
    const { handle } = setup();
    const response = await handle(
      request({ authorization: 'Bearer local-test', accept: 'text/event-stream' }),
    );
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain('event: result');
    expect(text).toContain('"rationale":"add a hero"');
    expect(text).toContain('event: status');
    expect(text).not.toContain('secret-value');
  });

  it('preserves terminal login failures without leaking CLI details', async () => {
    const { handle } = setup(true);
    const response = await handle(request({ authorization: 'Bearer local-test' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Codex needs a ChatGPT login. Run `codex login` as the server user.',
      retryable: false,
    });
  });

  it('never falls back to the API for batches even if an API key and model exist', async () => {
    const { handle, spawnCli } = setup();
    const response = await handle(
      new Request('http://127.0.0.1/batch', {
        method: 'POST',
        headers: { authorization: 'Bearer local-test', 'content-type': 'application/json' },
        body: JSON.stringify({ version: 1, items: [{ id: 'one', request: BODY }] }),
      }),
    );
    expect(response.status).toBe(501);
    expect(spawnCli).not.toHaveBeenCalled();
    expect(await response.text()).toContain('Codex CLI');
  });

  it('keeps unknown cache writes unknown in prompt enhancement', async () => {
    const { handle, onUsage } = setup(false, {
      enhanced: 'Create a coffee shop landing page.',
      understood: 'A coffee shop page',
      changes: [],
      questions: [],
      language: 'en',
    });
    const response = await handle(
      new Request('http://127.0.0.1/v1/prompt/enhance', {
        method: 'POST',
        headers: { authorization: 'Bearer local-test', 'content-type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          text: 'Coffee shop page',
          locale: 'en',
          intent: null,
          page: { empty: true, sections: [] },
          selection: null,
          answers: [],
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: 40,
        cacheReadTokens: 60,
        cacheWriteTokens: null,
        task: 'enhance',
      }),
    );
  });
});

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildClaudeArgs,
  callModelProcess,
  createAiPlanBridgeServer,
  buildPrompt,
  toWireResponse,
  wantsEmptyCommands,
} from './ai-plan-bridge.mjs';

const TOKEN = '0123456789abcdef0123456789abcdef';
const ORIGIN = 'http://localhost:5173';
const SILENT_LOGGER = Object.freeze({ log() {}, error() {} });

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((cause) => (cause === undefined ? resolve() : reject(cause)));
  });
}

function connectionCount(server) {
  return new Promise((resolve, reject) => {
    server.getConnections((cause, count) => (cause === null ? resolve(count) : reject(cause)));
  });
}

function send(server, { body, headers = {}, method = 'POST', path = '/plan' }) {
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, 'object');
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path,
        method,
        headers: {
          ...(body === undefined
            ? {}
            : {
                'content-length': Buffer.byteLength(body),
                'content-type': 'application/json',
              }),
          ...headers,
        },
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: responseBody }),
        );
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.end(body);
    else req.end();
  });
}

function sendSlowBody(server) {
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, 'object');
  let req;
  let socketClosed;
  const closed = new Promise((resolve) => {
    socketClosed = resolve;
  });
  const response = new Promise((resolve, reject) => {
    req = request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/plan',
        method: 'POST',
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'content-type': 'application/json',
          origin: ORIGIN,
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      },
    );
    req.on('socket', (socket) => socket.once('close', socketClosed));
    req.on('error', reject);
    req.write('{"version":1');
  });
  return { response, closed, close: () => req.destroy() };
}

function sendPartialBody(server, { headers = {}, method = 'POST', path = '/plan' } = {}) {
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, 'object');
  let socketClosed;
  const closed = new Promise((resolve) => {
    socketClosed = resolve;
  });
  const response = new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path,
        method,
        headers: { 'content-length': 1_000_000, origin: ORIGIN, ...headers },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      },
    );
    req.on('socket', (socket) => socket.once('close', socketClosed));
    req.on('error', reject);
    req.write('x');
  });
  return { response, closed };
}

function wireBody(requestText = 'Add a hero') {
  return JSON.stringify({ version: 1, request: requestText, context: {} });
}

function callNode(script, prompt = 'x') {
  return callModelProcess(prompt, () => undefined, {
    command: process.execPath,
    args: ['-e', script],
    timeoutMs: 2_000,
    killGraceMs: 25,
    maxOutputBytes: 16_384,
  });
}

test('Claude CLI runs isolated with every built-in tool and customization disabled', () => {
  const args = buildClaudeArgs('test-model');
  assert.ok(args.includes('--safe-mode'));
  assert.ok(args.includes('--disable-slash-commands'));
  assert.ok(args.includes('--no-session-persistence'));
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.deepEqual(args.slice(-2), ['--model', 'test-model']);
});

test('strict model output becomes the versioned plan, refusal, or invalidOutput contract', () => {
  assert.deepEqual(toWireResponse('{"refusal":"Not possible."}'), {
    version: 1,
    refusal: 'Not possible.',
  });
  assert.deepEqual(
    toWireResponse('{"rationale":"Add it.","commands":[{"command":"x","args":{}}]}'),
    {
      version: 1,
      rationale: 'Add it.',
      commands: [{ command: 'x', args: {} }],
    },
  );
  /*
    An OUTLINE conforms with an empty command list, and this gate used to reject
    it: a model that obeyed the schema it was handed was told its output was
    invalid, so Plan mode could only "succeed" by violating its own contract.
    The permission comes from the forwarded contract, so the bridge enforces
    what it sent rather than learning what Plan mode is.
  */
  assert.deepEqual(
    toWireResponse('{"rationale":"GOAL: a clinic page.","commands":[],"followUp":"ابدأ"}', {
      allowEmptyCommands: true,
    }),
    {
      version: 1,
      rationale: 'GOAL: a clinic page.',
      commands: [],
      followUp: 'ابدأ',
    },
  );

  // And it is still a non-answer for an ordinary request.
  assert.deepEqual(toWireResponse('{"rationale":"Add it.","commands":[]}'), {
    version: 1,
    invalidOutput: { message: 'The model returned an invalid plan response.' },
  });

  assert.deepEqual(toWireResponse('```json\n{}\n```'), {
    version: 1,
    invalidOutput: { message: 'The model returned an invalid plan response.' },
  });
});

test('subprocess stdin errors are handled instead of crashing the bridge process', async () => {
  const call = callNode('process.exit(0)', 'x'.repeat(2 * 1024 * 1024));
  await assert.rejects(call.done, /input|exited/);
});

test('timeout escalates from SIGTERM to SIGKILL and waits until the child is reaped', async () => {
  const startedAt = Date.now();
  const call = callModelProcess('x', () => undefined, {
    command: process.execPath,
    args: [
      '-e',
      'process.on(\'SIGTERM\', () => {}); process.stdout.write(\'{"type":"system","subtype":"init"}\\n\'); setInterval(() => {}, 1000)',
    ],
    timeoutMs: 100,
    killGraceMs: 25,
    maxOutputBytes: 16_384,
  });
  await assert.rejects(call.done, /timed out/);
  assert.ok(Date.now() - startedAt >= 100);
  assert.ok(Date.now() - startedAt < 1_000);
});

test(
  'timeout kills the isolated process group when a descendant keeps output pipes open',
  { skip: process.platform === 'win32' },
  async () => {
    const startedAt = Date.now();
    const call = callModelProcess('x', () => undefined, {
      command: '/bin/sh',
      args: ['-c', 'sleep 5 & exit 0'],
      timeoutMs: 50,
      killGraceMs: 25,
      maxOutputBytes: 16_384,
    });
    await assert.rejects(call.done, /timed out/);
    assert.ok(Date.now() - startedAt < 500);
  },
);

test(
  'normal direct-child close still kills descendants that detached their output pipes',
  { skip: process.platform === 'win32' },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'craftkit-ai-bridge-'));
    const pidFile = join(directory, 'descendant.pid');
    const descendantCode = `
      const fs = require('node:fs');
      fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      process.on('SIGTERM', () => {});
      setInterval(() => {}, 1000);
    `;
    const parentCode = `
      const { spawn } = require('node:child_process');
      const fs = require('node:fs');
      const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendantCode)}], {
        stdio: 'ignore',
      });
      child.unref();
      const startedAt = Date.now();
      while (!fs.existsSync(${JSON.stringify(pidFile)}) && Date.now() - startedAt < 1000) {}
    `;
    try {
      const call = callNode(parentCode);
      await assert.rejects(call.done, /exited/);
      const descendantPid = Number(readFileSync(pidFile, 'utf8'));
      let alive = true;
      for (let attempt = 0; attempt < 20 && alive; attempt += 1) {
        try {
          process.kill(descendantPid, 0);
          await new Promise((resolve) => setTimeout(resolve, 10));
        } catch {
          alive = false;
        }
      }
      assert.equal(alive, false);
    } finally {
      if (existsSync(pidFile)) unlinkSync(pidFile);
      rmdirSync(directory);
    }
  },
);

test('caller cancellation also escalates and rejects only after the child is reaped', async () => {
  let markReady;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  const call = callModelProcess('x', markReady, {
    command: process.execPath,
    args: [
      '-e',
      'process.on(\'SIGTERM\', () => {}); process.stdout.write(\'{"type":"system","subtype":"init"}\\n\'); setInterval(() => {}, 1000)',
    ],
    timeoutMs: 2_000,
    killGraceMs: 25,
    maxOutputBytes: 16_384,
  });
  await ready;
  call.cancel();
  await assert.rejects(call.done, /cancelled/);
});

test('output overflow kills and reaps a TERM-resistant child before rejecting', async () => {
  const call = callModelProcess('x', () => undefined, {
    command: process.execPath,
    args: [
      '-e',
      "process.on('SIGTERM', () => {}); process.stdout.write('x'.repeat(100000)); setInterval(() => {}, 1000)",
    ],
    timeoutMs: 2_000,
    killGraceMs: 25,
    maxOutputBytes: 1_024,
  });
  await assert.rejects(call.done, /stdout exceeded its output limit/);
});

test('bridge enforces origin, bearer auth, body bounds, and one model call per request', async () => {
  let calls = 0;
  const server = createAiPlanBridgeServer({
    token: TOKEN,
    allowedOrigins: new Set([ORIGIN]),
    maxBodyBytes: 128,
    logger: SILENT_LOGGER,
    callModel: () => {
      calls += 1;
      return { done: Promise.resolve('not-json'), cancel() {} };
    },
  });
  await listen(server);
  try {
    const unauthorized = await send(server, { body: wireBody(), headers: { origin: ORIGIN } });
    assert.equal(unauthorized.status, 401);
    assert.equal(calls, 0);

    const forbidden = await send(server, {
      body: wireBody(),
      headers: { authorization: `Bearer ${TOKEN}`, origin: 'https://attacker.example' },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(calls, 0);

    const oversized = await send(server, {
      body: wireBody('x'.repeat(200)),
      headers: { authorization: `Bearer ${TOKEN}`, origin: ORIGIN },
    });
    assert.equal(oversized.status, 413);
    assert.equal(calls, 0);

    const accepted = await send(server, {
      body: wireBody(),
      headers: { authorization: `Bearer ${TOKEN}`, origin: ORIGIN },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers['access-control-allow-origin'], ORIGIN);
    assert.deepEqual(JSON.parse(accepted.body), {
      version: 1,
      invalidOutput: { message: 'The model returned an invalid plan response.' },
    });
    assert.equal(calls, 1);
  } finally {
    await close(server);
  }
});

test('an early authentication rejection closes a partial request instead of retaining its socket', async () => {
  const server = createAiPlanBridgeServer({
    token: TOKEN,
    allowedOrigins: new Set([ORIGIN]),
    logger: SILENT_LOGGER,
    callModel: () => {
      throw new Error('must not reach the model');
    },
  });
  await listen(server);
  try {
    const partial = sendPartialBody(server);
    assert.equal((await partial.response).status, 401);
    await partial.closed;
    const connections = await new Promise((resolve, reject) => {
      server.getConnections((cause, count) => (cause === null ? resolve(count) : reject(cause)));
    });
    assert.equal(connections, 0);
  } finally {
    await close(server);
  }
});

test('successful health and preflight routes also close unexpected partial request bodies', async () => {
  const server = createAiPlanBridgeServer({
    token: TOKEN,
    allowedOrigins: new Set([ORIGIN]),
    logger: SILENT_LOGGER,
    callModel: () => {
      throw new Error('must not reach the model');
    },
  });
  await listen(server);
  try {
    for (const expected of [
      { method: 'GET', path: '/health', status: 200 },
      { method: 'OPTIONS', path: '/plan', status: 204 },
    ]) {
      const partial = sendPartialBody(server, expected);
      assert.equal((await partial.response).status, expected.status);
      await partial.closed;
    }
    const connections = await new Promise((resolve, reject) => {
      server.getConnections((cause, count) => (cause === null ? resolve(count) : reject(cause)));
    });
    assert.equal(connections, 0);
  } finally {
    await close(server);
  }
});

test('bridge rejects excess concurrency with 429 instead of creating an unbounded queue', async () => {
  let release;
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const server = createAiPlanBridgeServer({
    token: TOKEN,
    allowedOrigins: new Set([ORIGIN]),
    maxConcurrent: 1,
    logger: SILENT_LOGGER,
    callModel: () => {
      markStarted();
      return { done: pending, cancel() {} };
    },
  });
  await listen(server);
  try {
    const first = send(server, {
      body: wireBody('First'),
      headers: { authorization: `Bearer ${TOKEN}`, origin: ORIGIN },
    });
    await started;
    const second = await send(server, {
      body: wireBody('Second'),
      headers: { authorization: `Bearer ${TOKEN}`, origin: ORIGIN },
    });
    assert.equal(second.status, 429);
    release('{"rationale":"Done.","commands":[{"command":"x","args":{}}]}');
    assert.equal((await first).status, 200);
  } finally {
    await close(server);
  }
});

test('a slow authenticated body times out without occupying the model concurrency slot', async () => {
  const server = createAiPlanBridgeServer({
    token: TOKEN,
    allowedOrigins: new Set([ORIGIN]),
    bodyTimeoutMs: 50,
    logger: SILENT_LOGGER,
    callModel: () => ({
      done: Promise.resolve('{"rationale":"Done.","commands":[{"command":"x","args":{}}]}'),
      cancel() {},
    }),
  });
  await listen(server);
  const slow = sendSlowBody(server);
  try {
    const accepted = await send(server, {
      body: wireBody('Healthy request'),
      headers: { authorization: `Bearer ${TOKEN}`, connection: 'close', origin: ORIGIN },
    });
    assert.equal(accepted.status, 200);
    assert.equal((await slow.response).status, 408);
    await slow.closed;
    assert.equal(await connectionCount(server), 0);
  } finally {
    slow.close();
    await close(server);
  }
});

test('bridge refuses to start without a strong session token', () => {
  assert.throws(() => createAiPlanBridgeServer({ token: 'short' }), /at least 16/);
});

test('an outline request is recognised from its own contract, and the prompt stops contradicting it', () => {
  /*
    `wantsEmptyCommands` is the only thing that turns the permission on in
    production, and it was unexported and untested — the one test that covered
    the feature passed the flag by hand, which proves the branch and not the
    wiring.

    The prompt matters as much: it told the model to REFUSE whenever the request
    could not become commands, which is the definition of a plan request. An
    instruction that contradicts the schema shipped beside it fails only against
    a live model, hours later, as "Plan mode refuses everything".
  */
  const outline = {
    context: { outputContract: { schema: { properties: { commands: { maxItems: 0 } } } } },
    request: 'a clinic page',
  };
  const build = {
    context: { outputContract: { schema: { properties: { commands: { minItems: 1 } } } } },
    request: 'add a hero',
  };

  assert.equal(wantsEmptyCommands(outline), true);
  assert.equal(wantsEmptyCommands(build), false);
  // Malformed or absent contracts must not be read as permission.
  assert.equal(wantsEmptyCommands({}), false);
  assert.equal(wantsEmptyCommands({ context: {} }), false);

  const text = buildPrompt(outline);
  assert.match(text, /commands\.maxItems is 0/);
  assert.match(text, /the empty command list is the correct answer/);
});

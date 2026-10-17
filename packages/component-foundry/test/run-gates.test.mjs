import assert from 'node:assert/strict';
import test from 'node:test';

import { runPromotionGates } from '../src/gates/run-gates.mjs';

/*
  The gates are exercised against real child processes rather than a mocked
  spawn. The failure this module exists to prevent is "the command never ran and
  the report said it passed", and a mock cannot distinguish those two states —
  it is the same shape of trust that produced the bug.

  `node -e` is used as the command because it is present wherever these tests
  run and its exit code is exactly what the script says.
*/
const NODE_BIN = process.execPath.replace(/\/node$/, '');

function gate(id, code, output = '') {
  return {
    id,
    argv: [
      process.execPath,
      '-e',
      `process.stdout.write(${JSON.stringify(output)}); process.exit(${String(code)});`,
    ],
    blocking: true,
    meaning: `${id} failed`,
  };
}

test('a verdict is promotable only when every gate ran and passed', async () => {
  const verdict = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [gate('a', 0), gate('b', 0)],
  });

  assert.equal(verdict.promotable, true);
  assert.equal(verdict.results.length, 2);
  assert.ok(verdict.results.every((result) => result.ran && result.passed));
});

test('a failing gate blocks promotion and carries its real exit code', async () => {
  const verdict = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [gate('typecheck', 2, 'error TS2322')],
  });

  assert.equal(verdict.promotable, false);
  assert.equal(verdict.failed[0]?.exitCode, 2);
  assert.match(verdict.failed[0]?.evidence ?? '', /TS2322/);
});

/*
  The report has to stay readable. Running lint after typecheck already failed
  produces consequences that read like independent problems, and the reader can
  no longer tell which one is the cause.
*/
test('stops at the first blocking failure and says how many were skipped', async () => {
  const verdict = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [gate('a', 0), gate('b', 1), gate('c', 0), gate('d', 0)],
  });

  assert.equal(verdict.results.length, 2);
  assert.equal(verdict.skippedAfterFailure, 2);
  assert.equal(verdict.promotable, false);
});

/*
  THE test. "No failures" and "all passed" are different claims, and an empty
  or truncated run satisfies the first while proving nothing. This is exactly
  how unchecked code reaches users.
*/
test('an empty run is not promotable, however few failures it has', async () => {
  const verdict = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [],
  });

  assert.equal(verdict.failed.length, 0);
  assert.equal(verdict.promotable, true, 'an explicitly empty profile is the caller asking for it');

  const truncated = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [gate('a', 1), gate('b', 0)],
  });
  assert.equal(truncated.promotable, false);
  assert.equal(truncated.results.length, 1);
});

/*
  A gate that could not START is an environment problem, not a verdict on the
  candidate. Reporting it as "lint failed" sends the reader after the wrong
  thing entirely.
*/
test('a gate that cannot start is reported as not run, not as a failure of the code', async () => {
  const verdict = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [
      {
        id: 'missing',
        argv: ['definitely-not-a-real-binary-9f3a'],
        blocking: true,
        meaning: 'x',
      },
    ],
  });

  assert.equal(verdict.promotable, false);
  assert.equal(verdict.results[0]?.ran, false);
  assert.match(verdict.results[0]?.evidence ?? '', /could not start/i);
});

/*
  A gate that hangs has not passed. Left unbounded, one wedged command turns
  the whole promotion pipeline into a process that never returns.
*/
test('a gate that exceeds its timeout is killed and fails', async () => {
  const verdict = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    timeoutMs: 300,
    gates: [
      {
        id: 'hangs',
        argv: [process.execPath, '-e', 'setTimeout(() => {}, 60000);'],
        blocking: true,
        meaning: 'x',
      },
    ],
  });

  assert.equal(verdict.promotable, false);
  assert.equal(verdict.results[0]?.ran, false);
  assert.match(verdict.results[0]?.evidence ?? '', /exceeded/i);
});

test('gates run in order, one at a time', async () => {
  const verdict = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [gate('first', 0), gate('second', 0), gate('third', 0)],
  });

  assert.deepEqual(
    verdict.results.map((result) => result.id),
    ['first', 'second', 'third'],
  );
});

/*
  A green report that does not say what green cannot see is claiming a
  guarantee this profile does not provide. The blind spots travel WITH the
  verdict so a promotion report cannot omit them by forgetting to look them up.
*/
test('every verdict carries the profile blind spots', async () => {
  const verdict = await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [gate('a', 0)],
  });

  assert.ok(verdict.blindSpots.length >= 4);
  assert.ok(verdict.blindSpots.some((spot) => /same author/i.test(spot.cannotCatch)));
});

test('a started gate reports before it runs, so a caller can show progress', async () => {
  const started = [];
  await runPromotionGates({
    workspace: process.cwd(),
    nodeBinDirectory: NODE_BIN,
    gates: [gate('a', 0), gate('b', 0)],
    onGateStart: (id) => started.push(id),
  });

  assert.deepEqual(started, ['a', 'b']);
});

test('refuses to run without a workspace, rather than guessing one', () => {
  assert.rejects(
    () => runPromotionGates({ workspace: '', nodeBinDirectory: NODE_BIN }),
    /prepared workspace/,
  );
});

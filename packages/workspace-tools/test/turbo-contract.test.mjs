import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepositoryJson } from './helpers/repository.mjs';

test('declares cache-restorable outputs for build and Storybook artifacts', async () => {
  const turbo = await readRepositoryJson('turbo.json');
  assert.equal(turbo.$schema, 'https://turborepo.dev/schema.json');
  assert.equal(turbo.envMode, 'strict');

  assertTaskIncludes(turbo, 'build', 'dependsOn', '^build');
  assertTaskIncludes(turbo, 'build', 'outputs', 'dist/**');
  assertTaskIncludes(turbo, 'build-storybook', 'dependsOn', '^build');
  assertTaskIncludes(turbo, 'build-storybook', 'outputs', 'storybook-static/**');
  assertTaskIncludes(turbo, 'test:coverage', 'outputs', 'coverage/**');
  assertTaskIncludes(turbo, 'test:storybook', 'outputs', 'coverage/storybook/**');
});

test('keeps every development or watch task persistent and uncached', async () => {
  const turbo = await readRepositoryJson('turbo.json');
  for (const taskName of ['dev', 'storybook', 'test:watch']) {
    const task = requireTask(turbo, taskName);
    assert.equal(task.persistent, true, `${taskName} must be persistent`);
    assert.equal(task.cache, false, `${taskName} must never be cached`);
  }
  assertTaskIncludes(turbo, 'storybook', 'dependsOn', '^build');

  for (const [taskName, task] of Object.entries(turbo.tasks)) {
    if (task.persistent === true) {
      assert.equal(
        task.cache,
        false,
        `${taskName} is persistent and therefore must set cache=false`,
      );
    }
  }
});

test('preserves Turbo default inputs whenever a task customizes its inputs', async () => {
  const turbo = await readRepositoryJson('turbo.json');
  for (const [taskName, task] of Object.entries(turbo.tasks)) {
    if (task.inputs !== undefined) {
      assert.ok(
        task.inputs.includes('$TURBO_DEFAULT$'),
        `${taskName} customizes inputs but drops $TURBO_DEFAULT$`,
      );
    }
  }
});

function requireTask(turbo, taskName) {
  const task = turbo.tasks?.[taskName];
  assert.ok(task, `turbo.json is missing task "${taskName}"`);
  return task;
}

function assertTaskIncludes(turbo, taskName, field, expectedValue) {
  const task = requireTask(turbo, taskName);
  assert.ok(Array.isArray(task[field]), `${taskName}.${field} must be an array`);
  assert.ok(
    task[field].includes(expectedValue),
    `${taskName}.${field} must contain "${expectedValue}"`,
  );
}

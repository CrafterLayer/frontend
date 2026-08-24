import assert from 'node:assert/strict';
import test from 'node:test';

import { createReactTestConfig } from '../src/react.mjs';
import { createStorybookTestConfig } from '../src/storybook.mjs';

test('React config factory creates a jsdom Vitest configuration', () => {
  const config = createReactTestConfig();

  assert.equal(config.test.environment, 'jsdom');
  assert.ok(Array.isArray(config.plugins));
});

test('Storybook config factory creates a Chromium browser project', () => {
  const config = createStorybookTestConfig({ configDir: '/tmp/storybook-config' });

  assert.equal(config.test.browser.enabled, true);
  assert.deepEqual(config.test.browser.instances, [{ browser: 'chromium' }]);
});

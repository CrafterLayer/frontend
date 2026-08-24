import assert from 'node:assert/strict';
import test from 'node:test';

import { baseConfig } from '../src/base.mjs';
import { reactConfig } from '../src/react.mjs';
import { storybookConfig } from '../src/storybook.mjs';

test('configuration entrypoints expose flat config arrays', () => {
  assert.ok(Array.isArray(baseConfig));
  assert.ok(Array.isArray(reactConfig));
  assert.ok(Array.isArray(storybookConfig));
  assert.ok(baseConfig.length > 0);
  assert.ok(reactConfig.length > 0);
  assert.ok(storybookConfig.length > 0);
});

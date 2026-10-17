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

test('a // comment between JSX tags is an error, a JSX comment is not', async () => {
  const { Linter } = await import('eslint');
  const { JSX_COMMENT_TEXT_SELECTOR } = await import('../src/react.mjs');
  const linter = new Linter();
  const config = {
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { 'no-restricted-syntax': ['error', { selector: JSX_COMMENT_TEXT_SELECTOR }] },
  };
  const leaked = linter.verify('const a = (\n  <div>\n    // leaked\n    <b />\n  </div>\n);', config);
  assert.equal(leaked.length, 1);
  const fine = linter.verify(
    'const a = (\n  <div>\n    {/* fine */}\n    <b>https://x.y // mid-line</b>\n  </div>\n);',
    config,
  );
  assert.equal(fine.length, 0);
});

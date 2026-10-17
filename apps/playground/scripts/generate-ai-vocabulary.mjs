// Regenerates the AI-VOCABULARY block in src/tailwind.css from the layer-0
// vocabulary (packages/builder/schema/src/custom-code/utility-vocabulary.ts).
// Run from apps/playground: `pnpm generate:vocabulary`. A test in this app
// fails when the block drifts from the source, so this is the only way to
// change what the assistant may style with.
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';

// The vocabulary modules are dependency-free TypeScript, which is what lets Node
// strip their types and import them directly. They import each other the
// workspace's way, without an extension (`./effects-vocabulary`), so a relative
// specifier Node cannot find is tried again as `.ts`.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const { utilitySourceDirectives, utilityVocabulary } = await import(
  resolve('../../packages/builder/schema/src/custom-code/utility-vocabulary.ts')
);

const START =
  '/* AI-VOCABULARY:START — generated from utility-vocabulary.ts; do not edit by hand. */';
const END = '/* AI-VOCABULARY:END */';
const path = resolve('src/tailwind.css');
const css = readFileSync(path, 'utf8');
const start = css.indexOf(START);
const end = css.indexOf(END);
if (start === -1 || end === -1)
  throw new Error('AI-VOCABULARY markers not found in src/tailwind.css');

const next = `${css.slice(0, start)}${START}\n${utilitySourceDirectives()}\n${css.slice(end)}`;
writeFileSync(path, next);
const count = utilityVocabulary().size;
console.log(
  `vocabulary: ${count} utilities in ${utilitySourceDirectives().split('\n').length} directives`,
);
console.log(
  `estimated CSS: ~${Math.round((count * 55) / 1024)} KB raw, ~${Math.round((count * 55) / 1024 / 6.5)} KB gzip`,
);

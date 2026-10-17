# particle-emitter: provenance and CraftKit patches

Upstream: [spd789562/pixi-v8-particle-emitter](https://github.com/spd789562/pixi-v8-particle-emitter),
directory `packages/emitter/src`, tag `v1.0.2`, commit `5f37dce36425f1a52fe63f7e5207191010d7413a`
(the commit npm `@spd789562/particle-emitter@1.0.2` was published from). Fetched 2026-10-10 by the
Pixi Studio `engine-libs` package. MIT, (c) 2025 spd789562 (`LICENSE`, verbatim); the code derives
from CloudKid's `@pixi/particle-emitter` (MIT, (c) 2015 CloudKid), whose notice is in
`vendor/THIRD_PARTY_LICENSES.md`.

It is vendored, not depended on: one maintainer, few stars, and the owner's rule that third-party
builder code is copied at a pinned commit and audited. It is built ONLY from this folder, by
`scripts/build-studio-engines.mjs emitter`, into `assets/ck-lib-emitter.js`.

Every file under `src/` is upstream's, unchanged except for the three patches below. Each patch
site carries a `CRAFTKIT PATCH <n>` comment.

## Patch 1: the GSAP-derived ease is not vendored

Upstream's `src/GsapCustomEase.ts` says "All code copied from
https://github.com/greensock/GSAP/blob/master/src/CustomEase.js ... all rights reserved to
GreenSock". GSAP is excluded by the owner, and that file is not under the MIT grant. It is NOT
copied. `Emitter.ts` imported one function from it, `generateEaseFromPath`, used only when a
config's `ease` is a STRING (a GSAP CustomEase SVG path). The import is removed and that branch
now throws a clear error (`ckRefuseStringEase`). Ease segments `[{ s, cp, e }]` (CloudKid's own
format, `ParticleUtils.generateEase`) and ease functions work as before.

## Patch 2: no `new Function()` for path expressions

`behaviors/PathMovement.ts` compiled a `movePath` config string such as `"sin(x / 10) * 20"` with
`new Function('x', 'return ' + text)`. A CSP without `'unsafe-eval'` (the Script Studio preview)
refuses that, and it evaluates config text as code. `parsePath` now calls
`compileSafeExpression` from `src/studio/libs/safe-expression.ts` (our code, unit-tested), which
parses the same grammar (numbers, `x`, `+ - * / %`, `^`/`**`, parentheses, the same Math
function and constant list) and evaluates it without eval. Unknown names throw, and the behaviour
falls back exactly as upstream did on a bad expression. The unused upstream `WHITELISTER` regex
is left in place, unchanged.

## Patch 3: `// @ts-nocheck` header

Every `.ts` file starts with `// @ts-nocheck` so the repository's stricter compiler options
(`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) do not
type-check upstream code when `src/studio/libs/emitter-entry.ts` imports it. Nothing else in the
files changes. ESLint skips the folder (media-engines `eslint.config.mjs`) and Prettier skips it
(`.prettierignore` `vendor/`).

## Not copied

`README.md` (kept as `README.upstream.md`), `jsr.json`, `package.json`, `tsconfig.json`,
`tsup.config.ts`, and the editor app under `apps/web` (its sample textures included).

## Updating

Fetch the new tag's `packages/emitter/src`, re-apply the three patches (search for
`CRAFTKIT PATCH`), check that no new file copies GSAP or other non-MIT code (`grep -rn -i
"greensock\|gsap\|new Function\|eval("`), update `PROVENANCE.json`, then run
`node scripts/build-studio-engines.mjs emitter`.

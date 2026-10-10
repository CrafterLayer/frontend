# Quality and authored Frontend increment — 2026-10-10

Scope: QF-001..005 and T148..153 in [spec.md](spec.md), [plan.md](plan.md) and [tasks.md). This is a
local increment, not completion or release acceptance of feature 014.

## Delivered and acceptance evidence

| Requirement | Owning implementation and evidence                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QF-001      | `apps/evals/src/accessibility`: real Playwright/axe scan, full blocking counts before bounded evidence, text/node truncation flag, empty/manual/execution-failure states. Positive, deliberately broken, empty and closed-page Chromium fixtures. No raw DOM HTML or complete axe payload in reports. |
| QF-002      | `builder-media-engines` lazy Embla entry; renderer carousel pack, injector and static exporter. Native still canvas, keyboard/RTL, dots, reduced motion, late loading and disposal. Actual exported files tested in Chromium; real React update/removal regression.                                   |
| QF-003      | Exact Embla 8.6.0 lock admission in the managed catalog, compiler rejection without a lock and for a wrong pin, standalone default export. Legacy catalog v1 locks retained; complete catalog content changes the artifact fingerprint.                                                               |
| QF-004      | `AUTHORED_DESIGN_TEACHING` goes through the public wire facade into the actual authored request's cached system prefix. Mock request capture asserts tailored website/dashboard/workflow guidance, functional state and honest demo behavior; ownership/security limits remain.                       |
| QF-005      | Browser fixtures are explicitly hand-authored. No paid provider output, human visual score or production-readiness claim is inferred from them.                                                                                                                                                       |

No new production React component. Existing carousel Storybook demo uses the real lazy engine in
interactive mode; its MDX documents keyboard, RTL, reduced motion, native canvas and teardown.
Architecture documentation records the runtime/library boundaries and unfinished Agent feedback
loop.

## Dependency/build provenance

- Latest pins were checked against the registry before installation: Embla 8.6.0 (MIT, no runtime
  dependencies) and `@axe-core/playwright` 4.13.0 (MPL-2.0, evals dev dependency only). React stays
  on the verified patched 19.2.8 line.
- Install:
  `pnpm install --filter @craftkit/evals --filter @craftkit/builder-media-engines --filter @craftkit/builder --ignore-scripts`
  passed. Existing peer/deprecation warnings remain.
- Embla's npm tarball omits LICENSE. The matching tagged upstream MIT notice is retained in
  `packages/builder/extensions/media-engines/vendor/embla-carousel/` and embedded in both asset and
  managed module. No axe code is added to generated sites.
- `node scripts/build-carousel-engine.mjs` passed: 8,888 bytes gzip / 20,000 budget; SHA-256
  `d6fcf04bea92d29643476462d535e7a75c16b2ed4306b0e6bfa26cb71b8c40d5`. Digest, notice, absence of
  external imports/eval and asset budget are also tested.

## Runnable checks and actual outcomes

Run package-local binaries from the owning directory to avoid incidental relinking:

- AI: `node_modules/.bin/vitest run src/skills/authored-design.test.ts` — 2 passed.
- AI-server: `node_modules/.bin/vitest run src/authored-run.test.ts` — 6 passed, including actual
  mocked provider request capture. No provider connection used.
- Editor: `node_modules/.bin/vitest run src/catalog/managed-catalog.test.ts` — 5 passed.
- Media engines: `node_modules/.bin/vitest run --config vitest.config.ts` — 45 passed / 6 files;
  existing jsdom canvas-not-implemented warning, exit 0.
- Evals:
  `CRAFTKIT_BROWSER_QA=1 node_modules/.bin/vitest run src/accessibility/report.test.ts src/accessibility/axe.browser.test.ts src/professional-builder/frontend.browser.test.ts`
  — 5 passed / 3 files. Real Chromium, not skipped. The Frontend test compiles a hand-authored
  Dashboard/workflow through the managed catalog and exercises search, status filters, empty
  results, validated next/back and preserved fields at 390/1280 widths × LTR/RTL, reduced motion,
  zero overflow/page errors and clean automated axe results.
- Renderer:
  `node_modules/.bin/vitest run src/behaviors/packs/carousel.test.ts src/behaviors/packs/carousel-react.test.tsx src/behaviors/script.test.ts src/engines/inject.test.ts src/engines/carousel-source.test.ts src/export/export-static-site.test.tsx`
  — 72 passed, 1 failed / 6 files. The sole failure is the pre-existing all-packs budget described
  below; the carousel's own 4,096-byte serialized pack budget passes.
- Root:
  `node --import ./node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/loader.mjs apps/evals/src/browser/carousel-quality.mjs http://127.0.0.1:5174`
  — passed. Fresh Chromium context; facade-generated static assets/locators served without editor
  services, mobile LTR/RTL mouse swipe, keyboard Home/End, dots, reduced-motion navigation, zero
  horizontal overflow/page errors and zero serious/critical axe violations. Test-only CSS is
  supplied explicitly; this is not a Tailwind-generation claim.
- Scoped changed/new TypeScript and build-script ESLint with `--max-warnings 0` — passed.
  `node --check` on both added build/browser scripts — passed.
- `node_modules/.bin/tsc --noEmit -p <owner>/tsconfig.json` — passed sequentially for media engines,
  AI-server, evals, AI, editor, renderer and Playground after the final repairs.
- Vite production builds for Playground, AI-server and evals — passed. Playground was rebuilt after
  the final engine regeneration. Existing placeholder assets, ineffective dynamic imports and
  large-chunk warnings remain; passing build does not establish performance readiness.
- `pnpm check:workspace` — passed, 36 members. `pnpm check:graph` — dry graph succeeded.
- `git diff --check` — passed.

### Remaining workspace gates (not hidden)

- All-packs gzip test retains its 16,000-byte growth limit. Under the same Vitest transform,
  replacing this increment's carousel function with the exact staged function gives **18,794** bytes
  growth; current is **19,198**, a **404-byte** increment. Standalone staged/current carousel
  functions are 3,592/3,908 bytes gzip. Other serialized packs are unchanged by this increment. The
  staged baseline already fails; the gate was not raised, removed or skipped. The temporary
  diagnostic and its staged-source copy were deleted after recording evidence.
- `pnpm check:components` fails six pre-existing artifact omissions in `EffortMenu` and
  `ScriptParamsForm`. Those components are in the preserved staged work, not introduced here.
- `pnpm check:boundaries` reports two unresolved `@storybook/blocks` imports in existing
  `apps/storybook/storybook-static/assets/`. The authoritative manifest validator passes; no
  unrelated dependency was added to silence generated output.
- Full `pnpm verify`, coverage gates, Storybook build/interactions, Firefox/WebKit, manual contrast/
  focus/zoom review and live provider benchmark were not run. T134/T140 and the full release
  review/convergence remain open. This increment does not make all workspace checks green.

## Independent review and repairs

One bounded independent read-only review was required by `speckit-workspace-review`; it inspected
the real unstaged/new increment, not a summary. This was a direct skill review, not the pinned
fresh-review process of the full professional-sdd workflow; no model identity is inferred.

Accepted findings repaired and affected tests rerun:

1. Static export missed carousel in `ENGINE_ORDER`, so it could omit the real asset/locator. Added
   it and verified used/unused/nested-route export and actual independent browser loading.
2. Reparenting a React-owned track could throw `NotFoundError` on preview update/removal. The engine
   now uses the existing parent, never transfers DOM ownership, and restores its owned styles/marker
   on disposal. The actual published engine and React 19.2.8 reproduce the repaired path in a
   behavior test.
3. `truncated` ignored text-only cuts. It now includes rule/help/URL/selector limits; a single
   1,000-character selector verifies the fix. Empty pages also require review instead of passing.

Final independent re-review: no remaining findings in the repaired increment. Its fresh checks
passed report (3), real React engine/digest (2) and diff whitespace. Chromium results above are
coordinator verification, not independently rerun browser evidence.

## Continuation and product-quality boundary

Next is revision-bound preview inspection → bounded repair → re-inspection through the existing
Source Agent contracts (T045/T122), not more decorative dependencies or an unrestricted writer. Then
evaluate website/dashboard/workflow outputs on the fixed corpus with interaction assertions, blind
raters and actual provider usage/latency/cost (T128..132). Configured access, authorization and
raters are needed before those results can be claimed.

The accessibility/design skills influenced semantic interaction, RTL/reduced-motion checks,
brief-specific composition and the separation of automated evidence from visual quality. No backend,
auth, database, payment integration, provider call, commit, push or deployment was performed. All
previously staged work remains preserved; this increment has not been staged.

# Scroll mural and creative delivery verification

Scope: [S1–S5 / T288–T292](mural-scroll-2026-10-20.md). Local, uncommitted continuation on `main`;
preserves the earlier [R1–R5 increment](verification-reliability-2026-10-20.md).

## Delivered behavior

- Narrative scenes use `s.scroll.pin()` to reserve a bounded native scroll span and keep the runtime
  canvas visible through the final beat. Ordinary scroll progress is unchanged. Compact mural
  `mode:'scrub'` and legacy `params.scrub:true` opt in automatically.
- Native wheel/page scrolling remains intact before, during, after and in reverse. The runtime
  measures actual overflowing ancestors, ignores auto-height clipping wrappers, refits on resize,
  and maps pointer coordinates to the visible canvas. It does not reparent authored nodes, intercept
  wheel/touch input, lock the body or force scrolling.
- Editor/reduced-motion scenes remain compact. Cleanup restores owned styles and the probe marker
  without overwriting later authored changes. The compact timeline reaches both endpoints exactly;
  newly initialized story presets also snap endpoints rather than approaching forever.
- Creative planning distinguishes the requested medium from pictured subjects. Space, cars, maze,
  dungeon and treasure cues no longer turn an explicitly requested mural into a game. Explicitly
  mixed sections retain ownership. Unmatched illustrated murals keep the compact composition route
  on retry instead of being replaced with an unrelated preset.
- A scene with a confirmed runtime failure or blank result after its bounded repair cannot
  land/count as successful. Other sections remain. Repair selection prefers a usable scene before
  comparing warning counts; nonfatal layout findings still permit delivery.
- The actual browser probe reports the runtime pin marker. AI checks exclude only the intentional
  lower scroll span from canvas-gap warnings; horizontal gaps, blank output and runtime failures
  remain checked. This avoids an unnecessary repair request for a valid mural.

## Verification evidence

These groups overlap; their counts must not be summed as unique coverage.

| Check                                                                     | Result                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Final scene scroll/pointer/lifecycle, editor/calm and compact mural tests | 3 files / 102 passed                                                                   |
| Creative planning, retry and build repair/delivery regressions            | 11 files / 137 passed                                                                  |
| Skill budgets/guidance, story presets and AI probe acceptance             | 5 files / 133 passed                                                                   |
| Renderer probe, frame report and generated-source integrity/budgets       | 3 files / 49 passed                                                                    |
| Initial real-browser acceptance                                           | 4/4 passed, installed Chrome, external HTTP blocked                                    |
| Final browser including non-scrolling overflow-auto wrapper               | 5/5 passed, final generated assets, 191.46 s total under concurrent checks             |
| Owner/consumer TypeScript                                                 | AI, schema, media, renderer, Builder, Playground and evals Pixi browser project passed |
| Production builds                                                         | Playground and AI server passed                                                        |
| Initial-load gzip budgets                                                 | entry 550,951 / 896,000; JS 1,087,866 / 1,151,000; CSS 145,879 / 147,000               |
| Workspace/files/boundaries                                                | 37 members; 4,521 sized files; 5,919 boundary-checked files passed                     |

New behavior tests were red before the corresponding AI fixes: 14 initial medium cases, four
fatal-delivery cases, then six review cases. Initial full media run: 571 passed, one new test used
the wrong DOM event name; the test was corrected to `pointermove`, and final targeted coverage
passed. One skill-budget check initially failed; guidance was shortened to fit the existing token
budget, which now passes. No token-budget exemption was introduced.

Changed/new source lint is clean except 20 pre-existing diagnostics in `create-scene.ts` (19) and
`pointer.ts` (1). Both were compared against `git show HEAD:<file>` using the same ESLint
configuration; no new diagnostics in either file. Do not claim repository-wide lint is clean.
Existing Vite placeholder-URL and large-chunk warnings remain; configured initial-load budgets pass.
jsdom emits its existing canvas-context warning; actual pixels are checked in Chrome.

Generated through the existing build script:

- Kit 1.2.0: 16,505 gzip bytes, budget 17,300, SHA256
  `463e93057f6e46b4e20a0ae755fbe43cb01cc428b9037de25d5c57784c60225c`.
- Mural: 24,736 gzip bytes, unchanged 26,000 budget, SHA256
  `1de262417d4b540df112c6a1389363381756af41e049e18ef20480b48da8c2ba`.

## Independent review and convergence

Fresh native read-only review found four issues: non-overflowing wrapper ownership, remaining
subject/medium confusion, repair selection by warning count despite fatality, and the probe
misreading the intentional runway. Each was repaired with a regression. The repaired-source review
reports no remaining actionable findings; final browser acceptance passed. No external CLI review or
full automated professional-sdd execution is claimed.

## Limits and activation

The original other-device run and affected mural document are unavailable. These are code-grounded
reproductions, not proof of that run's exact cause. No paid inference, billing/latency benchmark,
artistic-quality score, physical-touch test, Safari/Firefox run or full monorepo CI was performed.
Editor behavior is covered by unit tests; browser checks use actual sandboxed preview runtime.

Stored custom scripts that only read ordinary `s.scroll.progress` without compact scrub mode or
`params.scrub:true` retain their original semantics. They need one explicit `s.scroll.pin()` after
scene creation, before fitting/drawing. No saved document is silently rewritten. Old embedded script
copies also retain their own timeline interpolation code.

Source and production bundles are local. Refresh/restart the local application as appropriate;
another device/deployment is not updated by this work. No commit, push or deployment occurred.
Rollback is source-only; no schema migration or stored-document rewrite is required.

Scoped commit proposal after owner review:
`fix(builder): keep scroll murals visible and reject broken scenes`. No commit created; this
proposal covers the current increment, not every earlier dirty change.

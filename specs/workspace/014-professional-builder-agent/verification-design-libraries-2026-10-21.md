# Design libraries: local verification, 2026-10-21

Scope: [DL1–DL5](design-libraries-2026-10-21.md),
[cited research](design-library-research-2026-10-21.md), T321–T325. Base HEAD922cdc61, existing
design/recovery work preserved. No commit/push/deployment or provider calls.

## Installed and integrated

- Exact catalog pins: MIT `@base-ui/react@1.9.0`, MIT `@radix-ui/colors@3.0.0`. Published registry
  metadata, React19 peers, age and installed licenses checked before use; React/DOM19.2.9 still
  match the latest verified19.2 patch. `pnpm install --no-frozen-lockfile` completed with existing
  provenance, age and build policies intact. New Base UI transitive external-store1.7.0 also
  resolves Zustand's optional React peer; no React version change here.
- Seven optional Base UI namespaces share one trusted bundle, React identity and direction context.
  Exact project locks and allowlisted public subpaths remain mandatory. Used dependency notices are
  retained from esbuild inputs; integrity/cache identities include the actual library source. New
  code pages admit Base UI; existing saved locks are not rewritten. Unused Base UI is absent from
  emitted page JS. Its seven-namespace trusted bundle stays below100,000 gzip bytes.
- Ten Radix scales × light/dark feed optional `theme.apply`; explicit colors win. Existing contrast
  checks and one grouped transaction/Undo remain. Fonts/geometry/regions are preserved. Hardcoded
  authored colors are not token consumers and do not change automatically.
- The actual source-agent/server prefixes teach the admitted Base UI APIs, custom styling, RTL
  direction, portals and ownership. Edit prefixes teach the real optional Radix tool arguments.

## Focused checks

Run with `--maxWorkers=1` or2. Counts overlap across worker/primary runs; do not sum them.

| Check                                                                                 | Result                                                                                                                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| builder-ai `theme-apply.radix.test.ts`                                                | 34/34; all20 palettes expand, validate, apply through kernel and Undo; AA, amber black text, Arabic, overrides/no-op/refusals                      |
| Radix plus existing builtin/element-color regressions                                 | 101/101 worker run                                                                                                                                 |
| Final primary Radix plus `base-ui-design.test.ts`                                     | 35/35                                                                                                                                              |
| Independent reviewer: Radix plus expansion/prompt/style/report/media regression files | 168/168 across distinct files, including the34 above                                                                                               |
| builder catalog `base-ui-catalog.test.ts managed-catalog.test.ts`                     | 14/14 final source, including exact/missing/wrong locks, seven facades, notices, real compilation, unsupported exports and unused-library omission |
| code-runtime `runtime.test.ts export/export-site.test.ts`                             | 25/25; includes default/server/client provenance, retained static HTML, invalid-mode refusal                                                       |
| ai-server `authored-run.test.ts prompt.test.ts`                                       | 93/93; actual transmitted teaching and intentionally updated prefix fingerprints                                                                   |
| ai-server `runtime-workers.test.ts`                                                   | 4/4                                                                                                                                                |
| Playground `code-page-vertical-slice`, `code-page-session`, `code-workspace-session`  | 12/12; synthetic catalog updated to creation defaults, create/edit/Undo/reload/export preserved                                                    |
| Owner/consumer typechecks                                                             | passed: builder-ai, code-runtime, builder editor, ai-server, Playground and evals (all3 eval configs)                                              |
| Changed source ESLint/Prettier and whitespace                                         | passed: changed source ESLint, Prettier check and git diff --check                                                                                 |
| ai-server and Playground production builds                                            | passed after export-mode repair; existing dynamic-CSS/chunk-size notices remain                                                                    |
| Playground initial-load gzip budget                                                   | passed: entry561,881/896,000; initial JS1,098,962/1,151,000; CSS145,890/147,000 gzip bytes                                                         |
| Workspace/component/file-size/boundary gates                                          | passed:37 members,261 components,4,599 size-gated files; boundaries6,019 files/37 packages                                                         |

## Real browser and independent review

Command:
`CRAFTKIT_BROWSER_QA=1 CRAFTKIT_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CRAFTKIT_SCREENSHOT_DIR=/tmp/craftkit-design-library-qa pnpm --filter @craftkit/evals exec vitest run src/design-libraries/base-ui.browser.test.ts --maxWorkers=1`.

Passed one Vitest case containing **8 behavior scenarios**: EN/AR ×390/1280px × compiled preview/
independent export. Also two no-JS contexts prove retained primary HTML. Seven namespaces compile
and render; tabs use direction-aware arrow focus +Enter activation, accordion expands, menu actions
update content, dialog traps focus and restores it on Escape, popover has its correct accessible
name, IDs are unique, no horizontal overflow, axe blocking/incomplete both0, no page errors. Eight
screenshots are under `/tmp/craftkit-design-library-qa`; Arabic mobile export inspected. This
deliberately plain hand-authored capability fixture is not a provider design-quality sample.
Playwright's managed Chromium binary is absent locally; the installed Chrome was used explicitly.
The actual child prerender worker's field forwarding/build is checked, not a live child-browser run.

Browser testing found and drove two real repairs. A published CJS external-store shim needed a
module-local React peer bridge; it resolves only the shared React facade and rejects other names.
Also client-prerendered `useId` markup cannot be hydrated as SSR. The real browser worker now
reports `renderMode:client`; export stamps this provenance; bootstrap mounts these snapshots and
hydrates omitted/server modes. Compiler version `/prerender-mode-1` invalidates old cached
bootstraps. Static HTML remains before JavaScript; early DOM state is replaced on client mounting.

Fresh independent native reviewer inspected the full increment, both repairs and final tests: no
unresolved production findings. No external reviewer CLI or workflow-engine pass claimed.

## Limits and continuation

No live-model artistry, adherence, latency or cost evaluation; no cross-browser/physical touch or
full Storybook/CI run. Earlier broad builder-ai failures remain documented in
[previous verification](verification-design-recovery-2026-10-21.md); this work does not claim a
green full suite. Full production deployment and actual worker/browser environment readiness are
separate. No running user service was restarted. A previously running built server needs its normal
restart to load the new build. No package bulk registry scripts, migration or saved-data rewrite.
Rollback source/dependencies together and rebuild artifacts; preserve saved project locks.

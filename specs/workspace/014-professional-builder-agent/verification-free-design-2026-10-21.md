# Free design verification — 2026-10-21

Scope: [FD1–FD5](free-design-2026-10-20.md), T310–T315. Work started on 2026-10-20 from clean commit
`52ab7448`. Local implementation and verification complete; no commit, push or deployment.

## Result and acceptance

- FD1: explicit selections and natural-language Pro Max aliases reach planner and writer as required
  skills. An impossible explicit budget refuses before a provider call. Automatic
  landing/conversion/ structure recipes no longer override any bespoke genre; explicit choices and
  disabled optional skills retain their intended precedence.
- FD2: fresh pages default to bespoke composition. Optional persisted design and section layout
  survive validation, plan-card editing and approved-plan builds. One complete region is valid;
  arbitrary region order is allowed. Legacy/hybrid plans keep their template behavior.
- FD3: ordinary and compact streamed writers receive the same design. A layout arriving in a brief
  starts its writer before the planner resolves; identical final data does not regenerate it. Kit
  geometry is removed while bounded slot content remains reference data. Tree/CSS and supported
  freeCode JS are applied through existing scoped transactions; browser edits keep the same region
  and Undo restores the original exactly.
- FD4: personal pages omit or visibly label missing facts. The checker accepts multilingual missing
  labels, rejects fake contact links, and never asks for invented personal data. Script-bound/native
  buttons are distinguished from dead navigation; bespoke ambiguous controls are left to the writer.
- FD5: distinct editorial, professional-document and interactive-portfolio compositions render at
  desktop and phone widths in English and Arabic. No new React component, package or migration.

## Checks

All Vitest commands use the owning package via
`pnpm --filter <package> exec vitest run --config vitest.config.ts <files> --maxWorkers=1`. Counts
below describe their groups; overlapping reruns are not additional coverage.

| Group                                             | Result                                                                                                                    | Evidence                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Builder AI core, planner, streaming and old plans | 279 behaviors across 11 files covered: main run 278 passed/one fixture failed; corrected free-design file then 7/7 passed | `/tmp/craftkit-free-design-final-tests.log`, `/tmp/craftkit-free-design-build-regression-final.log` |
| Skills and design teaching                        | 7 files, 771 passed                                                                                                       | alias, request-routing, builtins, free-design teaching, bespoke routing, page-power                 |
| Section checker and deterministic tidy            | 4 files, 339 passed                                                                                                       | existing checker, free-design checker, tidy-section, tidy corpus                                    |
| Playground plan editing                           | 2 files, 74 passed                                                                                                        | `/tmp/craftkit-free-design-app-tests.log`                                                           |
| AI server prompt/schema/wire                      | 5 files, 193 passed                                                                                                       | prompt, plan shape, free design, prompt-cache and remote page-plan integration checks               |
| TypeScript                                        | builder-ai, ai-server, Builder facade and Playground passed                                                               | `/tmp/craftkit-free-design-*-types*.log`                                                            |
| Changed-source ESLint and formatting              | passed after repairs                                                                                                      | `/tmp/craftkit-free-design-lint-final.log`, format logs                                             |
| Workspace/components/boundaries/file sizes        | passed, no baselines raised                                                                                               | 37 workspace members; 261 component artifacts                                                       |
| Production build                                  | Playground and ai-server passed                                                                                           | `/tmp/craftkit-free-design-build.log`, `/tmp/craftkit-free-design-server-build.log`                 |
| Initial-load budgets                              | entry 560870/896000; JS 1097926/1151000; CSS 145890/147000 gzip bytes                                                     | `/tmp/craftkit-free-design-budgets.log`                                                             |
| Browser                                           | 20/20, 6 builds, one planner and one writer each; no section issues/repairs or page errors                                | `/tmp/craftkit-free-design-results.json`                                                            |

Core files: `run-build.free-design.test.ts`, `page-plan/design.test.ts`,
`run-build.streaming.test.ts`, `run-build.page-plan.test.ts`, `run-agent.test.ts`,
`host-skills.test.ts`, `page-plan/compact-plan.test.ts`, `page-plan/skeleton-from-plan.test.ts`,
`page-plan/validate-page-plan.test.ts`, `page-plan/plan-draft.test.ts`, `plan-page.test.ts`.
Playground files: `free-design-plan.test.ts`, `page-plan-draft.test.ts`.

Skills files under `src/skills/`: `request-skills.test.ts`, `design-requests.test.ts`,
`free-design-teaching.test.ts`, `defaults/defaults.test.ts`, `builtins.test.ts`,
`bespoke-request-skills.test.ts`, `page-power.test.ts`. Server files under `src/`:
`free-design.test.ts`, `plan-shape.test.ts`, `prompt.test.ts`, `prompt-cache.test.ts`,
`remote-page-plan.integration.test.ts`. Checker files under `src/agent/page-plan/`:
`check-section.free-design.test.ts`, `check-section.test.ts`, `tidy-section.test.ts`,
`tidy.corpus.test.ts`. These agent-run groups were captured in tool outputs, not saved log files.

Browser command: `node apps/evals/src/browser/free-design.mjs`. Uses the public Builder source
facade, real kernel, DocumentView and local app styles/fonts. Chrome needed the approved local
sandbox exception; the initial sandbox launch failed before running cases. Six external Google-font
requests were deliberately blocked; there were zero provider calls. Twelve screenshots are
reproducible at
`/tmp/craftkit-free-design-{editorial,resume,portfolio}-{en,ar}-{desktop,phone}.png`. Root inspected
editorial English desktop, portfolio English desktop and resume Arabic phone for distinct hierarchy,
readability and containment.

## Review, repairs and convergence

Independent native read-only reviewer: `/root/free_design_review`, following workspace review rules
and the established user preference for local review. No external CLI or professional-sdd engine
pass is claimed. Six confirmed findings were repaired: personal placeholders, JS action buttons,
layout in outline identity, contradictory automatic skills, lost slot content and negative template
requests. Additional repair checks closed bare button selectors and legacy tidy-message dispatch
compatibility. Final reviewer verdict: no unresolved findings in the reviewed scope.

Focused tests caught and corrected invalid fixture font, incomplete script lifecycle cleanup and
incorrect compact wire property order. No checker was disabled to make those fixtures pass. An
actual legacy tidy regression was fixed in the control path and verified against its existing tests.

Convergence checked all five FD acceptance groups, the persisted contract/legacy compatibility,
streaming/skill budget/public API plan decisions, and applicable monorepo/component/file-size rules.
No remaining buildable requirement or new convergence task. Shared handoff and context record the
local completion and the limits below.

## Limits and activation

Scripted providers prove mechanics and rendered composition, not the live model's artistry,
adherence, latency, cost savings or competitive superiority. Pro Max here is CraftKit's implemented
guidance; its upstream Python search was researched, not installed/executed. Generic JS admission is
static binding evidence, not a universal JavaScript verifier; the portfolio fixture separately
exercises actual mouse/keyboard behavior. Full CI, physical touch and remote-device deployment were
not run. Vite retains its large-chunk advisory while the configured initial-load budgets pass.

Source and local dist outputs contain the change. No running service was restarted or other device
changed. To activate an already running non-watching build, restart it normally; browser source
verification above uses the current checkout. Existing freeCode preference continues to govern JS.
Rollback is source-only with no data migration; do not discard unrelated changes.

Reviewed commit proposal only:
`fix(ai): enable bespoke page composition and preserve requested skills`.

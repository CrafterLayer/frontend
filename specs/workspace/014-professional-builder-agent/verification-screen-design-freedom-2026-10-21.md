# Screen design freedom: local verification

2026-10-21; [SF1–SF5/T326–T330](screen-design-freedom-2026-10-21.md). Started clean at fd558ca9 (214
commits). Existing library/recovery work retained. No dependency installation, migration, saved-data
rewrite, provider invocation, commit, push or deployment.

## Findings repaired

- Active design-direction, visual-direction, UI review, accessibility review, default UX/type, fill
  quality, motion/photo/design-code and selected variant guidance contradicted bespoke design.
  Removed obligatory container widths, mobile stacking, palette ratios/industry hues, exact
  type/space/radius/shadow scales, style bans, photo framing/counts and effect/signature quotas.
  Templates remain optional references; explicitly requested exact recipes stay available.
- Redesign guidance formerly forbade reordering and complete target rewrites. Now explicit redesign
  may change the authorized composition; color/text-only edits stay surgical. Current content,
  stable destinations, actions and unrelated screens stay protected. No scope/import/JS grants
  added.
- Planner/source/writer guidance treats dashboards, settings, editors and workflows as valid
  Frontend screens. A semantic hero role owns h1; it does not require a marketing banner. Mixed
  widths, dense data, meaningful repeated records, phone grids and accessible local scrolling work.
- Bespoke section validation now admits correctly loaded additional verified normal font faces,
  shipped discrete weights and Arabic-capable families for Arabic. Uses the actual approved import
  hoisting grammar, existing font metadata and Google/Bunny endpoints. Unknown/unloaded faces,
  malformed/insecure imports and unsupported declared weights fail; legacy/hybrid keeps base faces.
  Scoped CSS must declare each extra face it uses. Full CSS cascade inference, italic axes and
  variable ranges are not claimed. Checker shrank1898→1804lines; helper264lines.
- Repair lessons/discovery metadata no longer restore two-font/token-only limits, invented missing
  facts or disabled action behavior. Skill versions advance; consumer Arabic copy matches.

## Verification evidence

All test commands use bounded workers; worker/primary counts overlap and must not be summed.

| Command/group                                                                                                                         | Result                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| builder-ai8 focused files: builtins, design-code, defaults, screen-freedom, agent screen-redesign, lessons, additional-fonts, checker | 829/829 final                                                                                     |
| builder-ai4 consumer files: authored-design, request-skills, art-skills, page-plan/design                                             | 115/115                                                                                           |
| ai-server free-design, authored-run, prompt                                                                                           | 122/122; actual transmitted instructions and intentionally updated prefix hashes                  |
| Worker checker/font regressions                                                                                                       | 251/251, overlapping primary checker/font runs                                                    |
| Independent new font/default delivery check                                                                                           | 36/36, overlapping primary runs                                                                   |
| Types                                                                                                                                 | builder-ai, ai-server, Playground and all3 eval configs passed                                    |
| Lint/format                                                                                                                           | changed sources ESLint, changed-file Prettier and whitespace checks passed                        |
| Builds                                                                                                                                | ai-server and Playground production builds passed after final instruction changes                 |
| Workspace                                                                                                                             | 37 members,261 component contracts,4605 size-gated files; boundaries6025 files/37 packages passed |
| Bundle budgets                                                                                                                        | passed gzip: entry561,882/896,000; JS1,098,977/1,151,000; CSS145,973/147,000bytes                 |

Final narrow-edit regressions (`run-agent.fast-edits.test.ts` and `run-agent.tools.test.ts`)
passed35/35, retaining precise text/color and direct-tool behavior.

The new agent test uses an explicitly scripted provider through real `runAiAgent`: generation
receives recomposition guidance and applies target tree/CSS with sidebar geometry, preserves
unrelated nodes and supplied content/destination, and one grouped Undo restores the document. It
also checks repair lessons. This proves capability and delivered context; it is not a live model
adherence measurement.

Browser command:
`CRAFTKIT_BROWSER_QA=1 CRAFTKIT_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CRAFTKIT_SCREENSHOT_DIR=/tmp/craftkit-screen-freedom-qa pnpm --filter @craftkit/evals exec vitest run src/design-libraries/screen-freedom.browser.test.ts --maxWorkers=1`.

One test passed with **8 scenarios**: two intentionally distinct hand-authored workspace/editorial
geometries ×EN/AR ×390/1280px. Real compiled React/CSS, working filtering, two-column phone metrics,
local wide-table overflow with keyboard scrolling, no page overflow/errors, correctly isolated
signed numbers. Axe blocking findings0; any phone-table incomplete color-contrast findings are
restricted to clipped th/td cells and supplemented by measuring every actual opaque cell
text/background pair at≥4.5:1. Other scenarios require no incomplete findings. No arbitrary
exception for other rules. Eight screenshots in `/tmp/craftkit-screen-freedom-qa`; Arabic phone
workspace and English desktop editorial screen inspected. These are capability fixtures, not model
output or shipped templates.

Fresh independent native review found stale discovery/repair/accessibility guidance, all repaired.
Final re-review found no unresolved production findings. No external CLI/workflow pass claimed.

## Limits and continuation

No live-provider visual-quality, cost or latency evaluation; no universal 10/10 design claim. No
external font fetch/render proof, full CSS cascade simulation, new export run, cross-browser/touch,
Storybook or full CI. Prior library export evidence and old broad-suite failures remain separate in
the previous verification files. No renderer/runtime permission or API shape was widened.
Execution/source/prompt budgets, truthful facts, safe CSS/JS, accessible contrast/focus and saved
legacy contracts remain. No user service restarted; an already running built server needs its normal
restart to load this local build. Roll back this source increment and rebuild if needed.

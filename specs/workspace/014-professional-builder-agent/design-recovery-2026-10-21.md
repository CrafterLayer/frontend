# Design freedom and failed-request recovery

User-authorized continuation, 2026-10-21: repair failed output/application and subsequent requests;
remove repeated navigation/footer recipes; strengthen reports and install useful design tooling.

## Acceptance and bounded plan

- DR1: Reproduce any remaining failed-request/output defect before repairing it. A fresh prompt owns
  a fresh cancellation lifetime; failure is reported truthfully with an actionable retry. Preserve
  page/selection ownership, command validation, user Stop and Undo.
- DR2: Ordinary editing and section creation respect the existing page's design. Header, navigation,
  footer and page-composition advice must not impose one fixed layout or marketing sequence.
- DR3: Report requests carrying custom visual/composition instructions retain those instructions
  rather than being silently consumed by the deterministic shortcut. Keep calculated data and
  source-quality limitations authoritative; no fabricated figures.
- DR4: Install pinned MIT Open Props as an owned builder-ai dependency. Derive a bounded design
  reference from its real spacing/type/measure tokens and deliver it to actual planning/writing/edit
  contexts. Values are optional building material, with literal CSS values supported without global
  CSS, CDN access or new runtime permissions. Existing project tokens/user choices win.
- DR5: Run regressions, owner/direct-consumer checks and relevant browser proof; inspect the real
  diff with a fresh independent native reviewer, repair findings and record exact limits. No claim
  of 10/10 quality without representative live model and visual evaluation.

Owners: builder-ai skills/design context/direct-data/provider and section validation; Playground
agent request lifecycle tests; ai-server shared prompt consumption; editor managed catalog and
code-runtime trusted lock compatibility/fingerprints. Primary owns manifests/catalog/lockfile,
contracts and final integration. Two bounded workers diagnose execution and design; implementation
leases are explicit and disjoint. Existing component contracts remain; no new React component
planned. Update matching React/React DOM catalog pins to the latest verified 19.2 patch if
installation requires it.

No dependency-direction change: apps consume Builder public APIs, packages do not import apps. No
migration or saved-document rewrite. Token guidance has a fixed size budget and does not include the
full library in prompt contexts or import its global styles. Rollback is source-only; deploys,
service restarts, commits and pushes are separate. Local independent review follows the already
recorded user preference; no external CLI/workflow-engine pass is claimed.

Checklist/analysis: requirements, owners, negative cases, deterministic truth, compatibility and
bounded verification are explicit. Existing feature checklists pass (requirements 16/16,
design-runtime 24/24). Scope implements this increment only, not the unfinished overall feature.

## Research

- [Open Props](https://open-props.style/) and its
  [MIT source](https://github.com/argyleink/open-props) provide optional adaptive CSS design tokens,
  usable from JavaScript and without prescribing a component or page shape.
- [Radix Colors](https://www.radix-ui.com/colors/docs/overview/usage) offers plain color-scale
  objects; existing palette/contrast tooling already covers that concern.
- [shadcn registry](https://ui.shadcn.com/docs/registry) distributes source components/blocks.
  Existing CraftKit adaptations are already admitted; installing arbitrary registry React source
  would not make it usable inside a declarative customCode tree.

Registry verification: Open Props 1.7.23, MIT, published 2026-01-31; React 19.2.9 is the current
19.2 patch. Installation retains the workspace's release-age, provenance and script policies.

## Local outcome

DR1–DR5 implemented and independently reviewed. Evidence and remaining limits:
[verification-design-recovery-2026-10-21.md](verification-design-recovery-2026-10-21.md). The
original stopped-after-failure trace was not reproduced; sequential recovery is verified by a real
controller regression, while the demonstrated invalid-output planner bug was repaired.

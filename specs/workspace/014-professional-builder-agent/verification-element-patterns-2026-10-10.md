# Shared element patterns and AI design-library guidance

Scoped increment under the existing [spec](spec.md), [plan](plan.md) and [tasks](tasks.md).
This does not mark the entire professional-builder-agent feature complete.

## Scope and acceptance

- Preserve all existing elements; add eight editable compound patterns (feature, metric, quote,
  notice, checklist, process, contact and Bento), bringing the manual Elements catalog to 42.
- Provide bilingual names, searchable categories and explanatory captions. Preserve page/site
  colors and make multi-column patterns stack on phones without horizontal overflow.
- Manual insertion and AI `element.insert` share one schema-owned recipe implementation. Use
  exact parent/index/before/after placement and the existing single undoable transaction.
- Admit exactly one of markup or preset. Reject unknown recipes/content keys, unsafe hrefs and
  invalid bounded content before writes. Do not fabricate statistics or attribution in defaults.
- Teach the real build-fill and server prompts about readable responsive design and the actual
  registered shadcn/Magic UI/Aceternity/runtime boundaries. Do not install a library merely to
  mention it in a prompt; keep code-project imports separate from declarative regions.
- Keep tool prompts bounded (edit 1900 / section 1200 characters), retaining important existing
  input signatures. No new tool, new UI component, dependency, paid provider call or deployment.

## Implementation and review

1. Put deterministic recipes and bounded input contracts in schema (shared lower layer).
2. Extend the existing library panel and insert tool; preserve palette and undo behavior.
3. Share compact AI guidance via the headless editor wire API, update cached prompt baselines
   intentionally, and document the [actual library matrix](../../../docs/architecture/builder-design-libraries.md).
4. Independently review the real changes and verify recipes, insertion, prompts and browser layout.

The independent review found that page-kit thumbnail CSS must pass through renderer scoping:
its relative `> *` token selector cannot be injected as raw global CSS. Fixed and re-reviewed
with no remaining High/Medium findings. Existing panel components received story, MDX and
behavior-test updates; no new React component was introduced.

## Verification

- Schema recipes / static utility vocabulary: 28 tests passed.
- AI preset insertion / existing style tools / skills / capped tool prompts: 424 tests passed.
- Shell LibraryPanel: 25 tests passed, including Arabic descriptions, exact insertion and undo.
- AI-server prompts / script-card handling: 94 tests passed; deterministic prefix snapshots
  were updated for the intentional shared design guidance.
- Editor public surface / headless wire boundaries: 101 tests passed.
- TypeScript passed for schema, AI, shell, editor, AI-server and Playground.
- Scoped ESLint and `git diff --check` passed; both browser QA scripts pass Node syntax checks.
- Playground production Vite build passed. Existing placeholder asset, ineffective dynamic import
  and large-chunk warnings remain; this increment does not resolve them.
- Disposable local Chromium pattern QA passed: eight real library entries, actual insertion,
  generated page-kit surface/accent/radius, RTL and no overflow at 1440/768/390px. Phone grids
  collapse to one column. Painted sRGB comparison accounts for OKLCH CSS serialization.
  Run: `node apps/evals/src/browser/element-patterns.mjs http://127.0.0.1:5174`.
- Existing library-editing Chromium regression passed again: real block/tree/template dragging,
  Inspector selection, zoom-aligned selection outline, caret retention, RTL template width,
  canvas row sizing and editor overflow at 1440/768/390px. Its navigation now waits for DOM
  readiness instead of unrelated remote assets before running the existing assertions.

## Limits and handoff

No provider-generated visual-quality evaluation, production rollout, full Storybook build,
Firefox/WebKit coverage, screenshot baseline or complete accessibility audit was performed.
Readable recipes and precise capability guidance are locally verified; improved model output
still needs a representative generation evaluation with explicit provider authorization.
Previously staged work is preserved. No commit, push or deployment was made.

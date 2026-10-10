# Builder design libraries and AI capabilities

Scope: the existing professional-builder-agent feature, Element Library and AI design guidance.
Checked against local registrations and official documentation on 2026-10-10. This is not a claim
that every upstream component is installed, nor a certification of generated visual quality.

This increment stays within the
[professional builder agent plan](../../specs/workspace/014-professional-builder-agent/plan.md); its
scoped acceptance and verification are recorded in
[the element/library increment](../../specs/workspace/014-professional-builder-agent/verification-element-patterns-2026-10-10.md)
and
[the quality/Frontend increment](../../specs/workspace/014-professional-builder-agent/verification-quality-frontend-2026-10-10.md).

## Runtime boundaries

| Capability               | Current integration                                                  | How an agent may use it                                                                                         |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| shadcn-inspired controls | 12 owned, token-bound block adaptations in `extensions/shadcn`       | Registered block types with their actual catalog props; not arbitrary upstream imports                          |
| Magic UI effects         | ShineBorder, Marquee, ShimmerButton, DotPatternSurface               | Optional registered signature effects, only when their props schema is supplied                                 |
| Aceternity effects       | AuroraBackground, CloudShader, SpotlightSurface                      | Same registered-block boundary; not the whole upstream catalog                                                  |
| Motion                   | Managed `motion/react` module and existing animation integration     | Import only in a managed React code project whose dependency lock admits it                                     |
| GSAP / PixiJS            | Existing named timelines, closed scenes and opt-in free-code runtime | `motion.add`, `media.add`, or scoped custom scene code when free-code is on                                     |
| Compound elements        | Eight shared declarative recipes                                     | Manual Library or AI `element.insert` with `preset` + bounded `content`                                         |
| Embla 8.6.0              | Lazy carousel behavior + managed vanilla module                      | Existing carousel marker, or `embla-carousel` in an explicitly locked React project; not `embla-carousel-react` |
| axe 4.13.0               | Development-only Playwright evaluation                               | Automated WCAG checks with bounded findings; not a generated-site dependency or a visual-design score           |

The code-project managed catalog is separate from the declarative block catalog. Installing a
dependency in the editor does not automatically make it available to an authored site. Apps still
reach these capabilities through the public `@craftkit/builder` facade.

## Composition first, targeted dependencies next

The immediate gap was reusable composition and capability guidance, not a missing rendering engine.
Ordinary cards, checklists, steps and Bento layouts use static markup. Existing controls/effects
cover ordinary page composition without another palette or decorative engine. The subsequently
approved quality increment adds axe for evaluation and Embla for a concrete interaction gap.

Possible later additions should be driven by a concrete use case: an audited chart adapter for
dashboard/data pages, or additional registered controls from shadcn for richer forms. Each needs its
actual schema, accessible behavior, RTL tests, licensing, export path and an explicit AI usage
contract. Do not mark an entire library supported merely by listing its name in a prompt.

Official references: [shadcn's open-code model](https://ui.shadcn.com/docs),
[shadcn RTL](https://ui.shadcn.com/docs/rtl),
[Magic UI components](https://magicui.design/docs/components),
[Aceternity components](https://ui.aceternity.com/components), and
[Motion reduced-motion guidance](https://motion.dev/docs/react-use-reduced-motion).

## Shared elements and design guidance

`schema/src/element-recipes` owns feature/metric/quote cards, notice, checklist, process steps,
contact card and Bento grid. Inputs are bounded; unsafe link schemes and unknown content keys are
refused by the AI tool. Defaults do not fabricate metrics, endorsements or contact destinations.

Both insertion paths produce editable trees and a single undoable transaction. Existing generated
page-kit classes preserve the page palette; plain pages use site tokens. Preview CSS goes through
the static renderer's scoping, including the page kit's relative `> *` token selector.

The actual build-fill skill receives compact layout/readability checks. The server's build and edit
instructions share library/runtime guidance through the headless wire facade. Tool prompts list the
eight recipe ids and content shape; edit/section caps are bounded at 1900/1200 characters,
preserving important existing signatures instead of expanding the full component catalog.

Provider-produced visual improvement requires a separate representative generation evaluation; unit
tests alone do not establish it. Local QA can verify the recipes and rendering without paid model
calls or altering the user's saved browser project.

## Authored Frontend quality increment

The user explicitly expanded the authored path to interactive React sites, dashboards and multi-step
Frontend flows. `AUTHORED_DESIGN_TEACHING` is wired into `/authored/run`'s real cached system
prefix, through `@craftkit/builder/wire`. It teaches brief-specific composition, functional
state/events, responsive/RTL data layouts, accessible controls, honest local/demo states and managed
imports. The declarative fill contract remains separate; its restricted commands are not arbitrary
React.

Embla is MIT, dependency-free, and owned by `builder-media-engines`. Its npm tarball omits LICENSE,
so the matching tagged notice is retained with provenance and embedded in both asset/catalog builds.
The standalone asset is under a 20 kB gzip budget and loaded only for interactive carousels. Editor
canvas selection/dragging retains native markup. Catalog manifest/modules are part of the artifact
fingerprint; old v1 locks stay valid and new imports still require an exact dependency-lock entry.
Adding a catalog module does not rewrite existing projects or silently add their dependencies.

axe's MPL-2.0 package is only a dev dependency of `apps/evals`. `src/accessibility/scan.ts` scans an
already-open controlled page; it does not navigate or change sandbox permissions. Reports count all
serious/critical violations before bounding rule/node evidence, omit raw DOM HTML and distinguish
execution failures, empty content, manual-review-needed and automated pass. They are evaluation
evidence, not yet an automatic repair loop in the Source Agent. No failing scan is suppressed to
claim quality.

Run the real positive/negative browser gate with:

```sh
pnpm --filter @craftkit/evals test:accessibility:browser
pnpm --filter @craftkit/evals test:frontend:browser
```

The second gate compiles a hand-authored Dashboard/workflow through the managed catalog, then tests
search, filtering, empty results, validated steps, back navigation, mobile/desktop overflow and axe
in LTR/RTL Chromium. It proves runtime capability, not that model-produced designs meet the same
bar.

Next release gates: revision-bound preview inspections fed into bounded repair, a representative
website/dashboard/workflow corpus with interaction assertions, blind visual review, and live model
quality/cost comparisons with approval. Backend/auth/payment work remains separately scoped. This
increment does not certify global product quality or complete all feature 014 release requirements.

# Implementation Plan: Builder Design Milestone — Chrome and Theme

**Spec**: [spec.md](./spec.md) · **Date**: 2026-08-28 · **Mode**: Retrospective implementation
record

## Summary

The completed milestone moved builder chrome from scattered fallback values and playground-owned
layout into a checked design contract and a reusable shell. `@craftkit/builder-theme` is a new
headless layer-2 package with 48 closed semantic tokens, prepared light/dark palettes, comfortable
and compact measurements, runtime override helpers, and a generated checked-in stylesheet. The
layer-5 `@craftkit/builder` preset loads and re-exports that contract, owns the
`@craftkit/builder/css` door, and exposes `BuilderTheme` plus the new shell components. The
playground consumes only the preset and composes the implemented editor chrome.

This document records choices already present in the working tree. It does not propose later work
and does not treat an unrun command as passing evidence.

## Technical Context

|                    | Implemented choice                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Language / runtime | TypeScript 6.0.3 (strict), React 19.2.8, Node 24                                              |
| Styling            | Generated and component-owned CSS using runtime CSS custom properties; no Tailwind dependency |
| Unit behavior      | Vitest 4.1.11 and Testing Library                                                             |
| Browser evidence   | Storybook 10.5.10 stories configured through Playwright in headless Chromium                  |
| Workspace          | pnpm 11.23.0 and Turborepo 2.10.10                                                            |
| New runtime deps   | None in `@craftkit/builder-theme`; its manifest contains development tooling only             |

**No NEEDS CLARIFICATION remains.** Every decision below is tied to an implemented file.

## Implemented Technology Decisions

### CSS custom properties over Tailwind

Runtime overridability was the requirement. The implementation turns a full theme or a partial
override into `--bldr-*` property/value pairs on an element, so changes cascade immediately without
a rebuild or a copied stylesheet. Tailwind resolves utility output at build time and is absent from
the affected manifests; it would not provide the same arbitrary host-time override door. Component
styles therefore consume semantic custom properties rather than owning a parallel utility palette.

The trade-off is an explicit checked stylesheet artifact. `src/css/chrome.css` is committed so a
consumer needs no theme build step, while `src/css.test.ts` requires it to equal the generator
output byte for byte.

### Layer-2 theme package with zero runtime dependencies

`@craftkit/builder-theme` is assigned layer 2 beside the other headless engines in
`validate-builder-boundaries.mjs`. Its manifest has no `dependencies`, `peerDependencies`, or
`optionalDependencies`; Storybook, test, type, and lint packages are development-only. The runtime
entry exports data and pure stylesheet helpers, while browser-only contrast evidence remains a story
discovered by the central catalog.

### Closed `CHROME_TOKENS` union

`contract.ts` carries exactly 48 semantic names and derives `ChromeTokenName` plus the complete
`ChromeTheme` record from that constant tuple. A prepared theme therefore has to answer the whole
contract. The names cover type, surfaces, rail, text, brand, canvas state, semantic state,
elevation, and focus.

Three values are intentionally outside the themeable union because components write them as runtime
channels: `arrow-x`, `shell-panel-track`, and `shell-aside-track`. The coverage gate accepts those
three declared exceptions in addition to `definedTokenNames()`; it does not permit arbitrary
unregistered names.

### Three theme states and two independent densities

The implemented state shape is:

- `system`: no `data-bldr-theme` attribute; the complete light palette is the base and the guarded
  operating-system dark preference supplies dark values;
- `light`: an explicit attribute restates the light palette and beats a dark operating system; and
- `dark`: an explicit attribute applies the dark palette on the builder root.

Explicit theme selectors are keyed on the attribute alone, not on the document root, because
`BuilderTheme` stamps its own element. Density is a separate attribute with exactly two values:
`comfortable` and `compact`. The checked-in stylesheet defaults to comfortable metrics and applies
the compact metrics without moving any color token.

### The `@craftkit/builder/css` application door

The layer law allows non-builder workspace members to depend only on `@craftkit/builder`. That rule
also applies to stylesheets. The preset therefore exposes `./css` as `@craftkit/builder/css`; its
`src/chrome.css` forwards to `@craftkit/builder-theme/css`. Importing the preset root already loads
the theme stylesheet, while stylesheet-only hosts can use the public CSS subpath without reaching a
family internal.

## Constitution Check

| Principle                              | Retrospective assessment                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec Kit is source of truth         | PASS — these three 012 artifacts are the scoped retrospective record; no competing architecture tree is created                                                                        |
| II. React 19 baseline                  | PASS — affected UI remains on the installed 19.2.8 line; the theme runtime itself has no React dependency                                                                              |
| III. One component per TSX             | PASS for the five new public production components assessed by this milestone — `BuilderTheme`, `BuilderShell`, `IconRail`, `TopBar`, and `StatusBar` each own one implementation file |
| IV. Every UI component ships complete  | PASS for those five new public components — implementation, local export, typed story, MDX, and behavior test are present; matrix below names every artifact                           |
| V. Evidence-based quality              | IMPLEMENTED — drift, token coverage, contrast, component, and app-frame gates exist; this documentation turn claims source inspection, not a fresh run                                 |
| VI. Shared context / delegation        | PASS — inspection was divided into bounded read-only slices; the primary agent owns these leased artifacts and final verification                                                      |
| VII. Commit integrity                  | PASS — no staging, commit, push, or deployment is part of this milestone documentation                                                                                                 |
| VIII. Monorepo boundaries              | PASS — theme=2, shell=3, preset=5; the playground declares only the preset; validator checks all dependency sections                                                                   |
| IX. Vertical ownership / thin delivery | PASS — the theme owns chrome decisions, shell owns layout/presentation, preset owns the app door, and the playground remains the composition host                                      |

**Gate result for the documented architecture: PASS.** Runtime test execution is deliberately not
claimed by this retrospective writing task.

## Exact Affected Scope

```text
packages/builder/theme/                         NEW package: @craftkit/builder-theme (layer 2)
  src/contract.ts                               48-token closed chrome contract
  src/tokens/{primitives,layout}.ts             ramps, scales, two density metric sets
  src/themes/{light,dark}.ts                    complete prepared palettes
  src/css.ts                                    declaration, override, and stylesheet generator
  src/css/chrome.css                            checked-in generated stylesheet
  src/{css,coverage}.test.ts                    drift and workspace-usage gates
  src/contrast.stories.tsx                      two 18-pair contrast reports and play gates

packages/builder/shell/                         CHANGED layer-3 shell package
  src/components/BuilderShell/                  NEW slot-owned editor layout
  src/components/IconRail/                      NEW primary/secondary navigation rail
  src/components/TopBar/                        NEW product, device, history, preview, publish band
  src/components/StatusBar/                     NEW tools, provenance, view, and save band
  src/components/{Palette,LayersTree,Inspector}/
                                                 CHANGED information hierarchy and tokenized chrome
  src/index.ts                                  additive public exports

packages/builder/editor/                        CHANGED @craftkit/builder preset (layer 5)
  package.json                                  theme dependency and public ./css subpath
  src/index.ts                                  CSS side effect plus theme/shell public exports
  src/chrome.css                                forwards the public CSS door
  src/components/BuilderTheme/                  NEW theme/density/override root and full artifacts

apps/playground/                                CHANGED direct consumer
  src/app/{App.tsx,App.css}                     composed designed shell and app-scoped framing
  src/app/rail-sections.tsx                     host-owned rail vocabulary and icons
  src/app/use-recent-changes.ts                 transaction-log projection for provenance
  src/app/App.test.tsx                          integration and global-overflow source gate

packages/workspace-tools/                       CHANGED governance tooling
  src/workspace/validate-builder-boundaries.mjs layer-2 assignment and existing dependency law
```

No document schema, persisted data, backend, route, or deployment target changed.

## Dependency Direction and Direct Consumers

```text
@craftkit/playground
  -> @craftkit/builder (preset, layer 5; the app's only builder-family dependency)
       -> @craftkit/builder-shell (layer 3)
       -> @craftkit/builder-theme (layer 2, zero runtime dependencies)

@craftkit/storybook
  -> @craftkit/builder (preset, unchanged verification/build consumer)

@craftkit/builder-shell (layer 3)
  -> @craftkit/builder-core / renderer / schema (lower layers)
  -> consumes --bldr-* names in CSS without a theme-package module dependency

@craftkit/workspace-tools
  -> validates every manifest edge; it is governance tooling, not a runtime consumer
```

The theme package's direct manifest consumer is the preset. The playground is a direct preset
consumer and the implemented application-composition consumer; the Storybook application also
declares the preset and is the unchanged verification/build consumer. Shell styles consume the
contract names without a theme-package manifest edge and are checked by the theme package's
workspace scan. The catalog discovers builder stories, while its local test binding and the shared
browser configuration are configured to execute them in headless Chromium.

The boundary validator establishes four relevant facts:

1. `@craftkit/builder-theme` is layer 2, `@craftkit/builder-shell` is layer 3, extensions are layer
   4, and the preset is layer 5.
2. Builder packages depend only on strictly lower builder layers.
3. Non-builder workspace members may reach the family only through `@craftkit/builder`.
4. Runtime, development, optional, and peer dependency sections all participate in the check.

## Public API Changes

| Owner                       | Implemented public change                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@craftkit/builder-theme`   | New root exports for token contract, themes, primitives, layout scales/densities, generator and runtime override helpers; new `./css` stylesheet subpath              |
| `@craftkit/builder-shell`   | Additive root exports for `BuilderShell`, `IconRail`, `TopBar`, `StatusBar`, their props, and rail/device/provenance/tool view-model types                            |
| `@craftkit/builder`         | Imports theme CSS from its root; re-exports the curated theme API, `BuilderTheme`, and new shell components/types; adds the supported `@craftkit/builder/css` subpath |
| `@craftkit/playground`      | No public package API; the app continues to import only `@craftkit/builder`                                                                                           |
| `@craftkit/workspace-tools` | No runtime API change; the private layer map gains `@craftkit/builder-theme: 2` so an unplaced or invalid edge is rejected                                            |

`Palette`, `LayersTree`, and `Inspector` retain their existing public prop shapes. Their implemented
changes are presentation and behavior within those contracts: search/grouped palette cards,
type-derived layer names plus visible stable IDs, and grouped inspector fields with presentational
category labels.

## Component Artifact Matrix

### New public components

| Component      | Implementation / export         | Typed story states                                   | MDX                                                        | Behavior evidence                                                   |
| -------------- | ------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `BuilderTheme` | `BuilderTheme.tsx` / `index.ts` | system · light · dark · compact · rebranded          | separation, API, variants, accessibility, RTL constraints  | attributes, independent density, partial/full overrides, host class |
| `BuilderShell` | `BuilderShell.tsx` / `index.ts` | full · dock · assistant · canvas-only · RTL          | slots, zero-cost absence, responsive thresholds, DOM order | region placement, omitted wrappers, dock ownership, name/order      |
| `IconRail`     | `IconRail.tsx` / `index.ts`     | default · active · secondary/account · RTL           | ownership, API, keyboard, targets, RTL/theme               | labels, current state, native keyboard/click, ordering, target      |
| `TopBar`       | `TopBar.tsx` / `index.ts`       | default · extra · history disabled · RTL             | controlled state, radio keyboard, actions, constraints     | names, device movement, disabled history, split actions, targets    |
| `StatusBar`    | `StatusBar.tsx` / `index.ts`    | default · three doors · saving · error · empty · RTL | provenance, state text, keyboard, RTL/theme                | names/current item, callbacks, save states, empty state, CSS gates  |

Every row maps to a component-owned stylesheet, `<Component>.stories.tsx`, `<Component>.docs.mdx`,
and `<Component>.test.tsx` in the same folder.

### Adapted existing components

| Component    | Implemented design delta                                                                                                         | Existing complete artifact set                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Palette`    | search, four semantic categories, independent collapse, actionable empty state, family-specific miniature diagrams, tokenized UI | `Palette.tsx`, `Palette.css`, `index.ts`, story, MDX, behavior test |
| `LayersTree` | type-derived short names, visible stable IDs, tokenized hierarchy while retaining selection and keyboard laws                    | `LayersTree.tsx`, `LayersTree.css`, `index.ts`, story, MDX, test    |
| `Inspector`  | selected-block header, honest category row, collapsible semantic groups, alignment/color/numeric presentations, tokenized UI     | `Inspector.tsx`, `Inspector.css`, `index.ts`, story, MDX, test      |

`InspectorRow.tsx` and `FieldErrorBoundary.tsx` remain internal support under the Inspector
contract; this milestone does not add them to the package surface.

## As-Built Delivery Phases

### Phase A — establish the chrome contract

The layer-2 package defines primitives, layout scales, the two density metric records, the closed
semantic contract, complete light/dark themes, runtime override helpers, and the generated
stylesheet. The workspace validator places the package deliberately at layer 2.

### Phase B — expose the legal consumer door

`BuilderTheme` stamps only explicit appearance/density choices and writes only named overrides. The
preset automatically loads the theme CSS, re-exports the supported API, and forwards
`@craftkit/builder/css`, keeping applications away from family internals.

### Phase C — build the shell and adapt existing tools

`BuilderShell`, `IconRail`, `TopBar`, and `StatusBar` ship as presentational controlled components
with complete local artifacts. Palette, layers, and inspector retain their document behavior while
adopting the new hierarchy and token contract.

### Phase D — prove the composition in the playground

The playground keeps independent page and editor appearance state, composes the shell from the
preset surface, projects recent transactions into status provenance, and confines whole-app clipping
to `.pg-app`. It retains preview as a chrome-free path.

### Phase E — install drift and accessibility evidence

The theme package checks generated CSS drift and workspace token usage. Its contrast story evaluates
18 pairings for each prepared theme. Component tests and stories cover interaction and browser
geometry where implemented. The playground statically rejects global overflow declarations that
would leak through mirrored frame stylesheets.

## Verification Surfaces Present in the Repository

The following are the implemented validation routes. They were inspected but not executed by this
documentation task:

```text
pnpm --filter @craftkit/builder-theme lint
pnpm --filter @craftkit/builder-theme typecheck
pnpm --filter @craftkit/builder-theme test
pnpm --filter @craftkit/builder-shell lint
pnpm --filter @craftkit/builder-shell typecheck
pnpm --filter @craftkit/builder-shell test
pnpm --filter @craftkit/builder lint
pnpm --filter @craftkit/builder typecheck
pnpm --filter @craftkit/builder test
pnpm --filter @craftkit/playground lint
pnpm --filter @craftkit/playground typecheck
pnpm --filter @craftkit/playground test
pnpm --filter @craftkit/playground build
pnpm check:workspace
pnpm check:components
pnpm test:storybook
pnpm verify
```

Source-confirmed gates:

- `coverage.test.ts` scans `packages/builder`, `packages/ui`, and `apps/playground`, requires a
  non-vacuous result, and rejects names outside `definedTokenNames()` plus the three declared
  runtime-written channels.
- `css.test.ts` compares the checked-in stylesheet with `buildStylesheet(...)`. Setting
  `UPDATE_THEME_CSS=1` is the explicit regeneration path; it was not used in this documentation run.
- `contrast.stories.tsx` computes 18 pairings for light and 18 for dark, collects failing rows, and
  requires an empty failure list. The central catalog and browser configuration are configured to
  execute discovered builder stories in headless Chromium.
- `App.test.tsx` reads `App.css`, rejects `overflow` inside global `html`, `body`, or universal
  selector blocks, and requires clipping on `.pg-app`.

Both theme files state that the executable contrast story exposed three historical pairings that had
never met their floor. The sources do not identify those three pairings, so this record does not
invent their names.

## Migration, Build, Cache, Deployment, and Reversal

- **Compatibility**: public additions are additive. Existing preset-root consumers now receive the
  theme stylesheet side effect and therefore central definitions instead of relying only on local
  fallback values; this is an intentional visual change, not a document contract change.
- **Application migration**: applications continue to declare only `@craftkit/builder`. A CSS-only
  host uses `@craftkit/builder/css`, never `@craftkit/builder-theme/css` directly.
- **Build/cache**: the new package is another workspace graph node but has no separate runtime
  build; source and checked-in CSS are exported directly. Theme and shell changes invalidate their
  owning checks plus the preset, playground, and Storybook consumer outputs.
- **Deployment**: there is no new service, network call, database, migration, or independently
  deployed artifact. The playground bundle and Storybook catalog are the affected application
  outputs.
- **Rollout**: package contract, generated CSS, preset dependency/door, shell consumers, playground
  composition, and validator assignment form one atomic workspace milestone.
- **Reversal**: revert those surfaces together. No data rollback is required; reversal changes only
  editor chrome and public exports.

## Complexity Tracking

| Implemented constraint                               | Recorded consequence                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| System is represented by no explicit attribute       | Tests must protect absence as a real state, and explicit light must beat a dark operating system                                |
| Explicit selectors live on the builder root          | A document-root-only selector is invalid; the generator, drift test, and browser story guard the actual stamped element         |
| Shell does not import the theme package              | CSS token spelling is a cross-package contract enforced by the theme package's workspace scan rather than a shell manifest edge |
| Three tokens are component-written runtime channels  | Coverage includes a narrow declared exception list; these are not host-theme roles                                              |
| Inspector category row has no switching contract     | Content is presentationally current; Design/Advanced remain labels and no requirement claims hidden or switchable panels        |
| BuilderShell uses viewport thresholds                | The milestone claims viewport adaptation at 1180/900, not container-query behavior                                              |
| Historical contrast failures are not named in source | The record keeps the source-stated count of three from theme comments and makes no claim about their identities                 |

## Addendum — what running the thing changed (2026-08-28)

The decisions above were recorded from the source. Measuring the running application in Chromium
then produced twelve corrections, listed as Phase 7 of `tasks.md`. Three of them changed a decision
rather than a value, and belong here:

### Evidence for a rendered claim must come from the renderer

The stylesheet's explicit-appearance blocks were keyed on the document element while the component
that stamps the appearance attribute stamps its own element. The rule matched nothing, so the dark
appearance had never once applied — and the gate covering it asserted the SELECTOR TEXT, which was
true the whole time. Any claim about a resolved value, a box, an overlap or a contrast ratio is now
required to be read back from a rendering engine. A test that reads source can only ever prove that
source says something.

### A slot for host content is a container, not a hole

`extra` accepted whatever a host passed and let it size the bar. Two independent failures followed:
content escaped sideways over the device controls, and wrapped content escaped downwards over the
preview frame, where it stayed focusable and stopped being clickable. A region that accepts foreign
content now constrains it in both axes and scrolls internally, and both failures are held by browser
gates rather than by the discipline of hosts.

### A component does not decide its own size

`Palette` and `LayersTree` each named the left panel's width token. That is correct in exactly one
position and wrong everywhere else, and it showed as a 288px panel in a 312px column with the
column's own ground visible beside and beneath it. Placement belongs to the container; a component
fills what it is given.

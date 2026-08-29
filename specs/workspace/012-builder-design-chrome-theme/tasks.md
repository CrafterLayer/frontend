# Tasks: Builder Design Milestone — Chrome and Theme

**Input**: `specs/workspace/012-builder-design-chrome-theme/` — retrospective `spec.md` and
`plan.md`, grounded in the implemented working tree on `builder-core`.

**Status**: Every task below records finished implementation or source-confirmed evidence. This
documentation task changed no implementation file and ran no test/build command.

## Format: `[ID] [P?] [Story] Description with exact path`

`[P]` records path-disjoint work that could have proceeded independently. All checkboxes are marked
complete because this file documents an already-implemented milestone.

## Phase 1: Theme contract and package foundation

- [x] T001 Create the zero-runtime-dependency layer-2 package surface and stylesheet subpath in
      `packages/builder/theme/package.json` and `packages/builder/theme/src/index.ts`
- [x] T002 [P] Define color, type, alpha, and elevation primitives in
      `packages/builder/theme/src/tokens/primitives.ts`
- [x] T003 [P] Define spacing, radius, type, motion, comfortable metrics, and compact metrics in
      `packages/builder/theme/src/tokens/layout.ts`
- [x] T004 Close the 48-name semantic contract, derive complete and partial theme shapes, and
      declare the three runtime-written channels in `packages/builder/theme/src/contract.ts`
- [x] T005 [P] Assign every contract role for the prepared light palette in
      `packages/builder/theme/src/themes/light.ts`
- [x] T006 [P] Assign every contract role for the prepared dark palette in
      `packages/builder/theme/src/themes/dark.ts`
- [x] T007 Generate base, system-dark, explicit light/dark, density, focus, and reduced-motion rules
      in `packages/builder/theme/src/css.ts` and check in the output at
      `packages/builder/theme/src/css/chrome.css`
- [x] T008 Place `@craftkit/builder-theme` at layer 2 in the authoritative map at
      `packages/workspace-tools/src/workspace/validate-builder-boundaries.mjs`

## Phase 2: User Story 1 — Choose the editor appearance without changing the page (P1)

- [x] T009 [US1] Implement the system/light/dark, comfortable/compact, partial-override chrome root
      and local export in `packages/builder/editor/src/components/BuilderTheme/BuilderTheme.tsx` and
      `packages/builder/editor/src/components/BuilderTheme/index.ts`
- [x] T010 [P] [US1] Document separation, API, variants, accessibility, RTL, and responsive
      constraints in `packages/builder/editor/src/components/BuilderTheme/BuilderTheme.docs.mdx`
- [x] T011 [P] [US1] Record typed system, light, dark, compact, and rebranded states, including
      attribute-absence and computed painted/override browser assertions, in
      `packages/builder/editor/src/components/BuilderTheme/BuilderTheme.stories.tsx`
- [x] T012 [P] [US1] Gate default attribute absence, explicit choices, independent density,
      partial/full overrides, and host class composition in
      `packages/builder/editor/src/components/BuilderTheme/BuilderTheme.test.tsx`
- [x] T013 [US1] Load and curate the theme API through the preset root in
      `packages/builder/editor/src/index.ts`
- [x] T014 [US1] Add the legal `@craftkit/builder/css` subpath in
      `packages/builder/editor/package.json` and forward it through
      `packages/builder/editor/src/chrome.css`

## Phase 3: User Story 2 — Work inside a coherent editor shell (P1)

- [x] T015 [P] [US2] Implement and export the slot-owned shell with required canvas, optional
      regions, zero-cost absence, dock ownership, responsive thresholds, and RTL layout in
      `packages/builder/shell/src/components/BuilderShell/BuilderShell.tsx`,
      `packages/builder/shell/src/components/BuilderShell/BuilderShell.css`, and
      `packages/builder/shell/src/components/BuilderShell/index.ts`
- [x] T016 [P] [US2] Complete BuilderShell's typed states, MDX contract, and behavior evidence in
      `packages/builder/shell/src/components/BuilderShell/BuilderShell.stories.tsx`,
      `packages/builder/shell/src/components/BuilderShell/BuilderShell.docs.mdx`, and
      `packages/builder/shell/src/components/BuilderShell/BuilderShell.test.tsx`
- [x] T017 [P] [US2] Implement and export controlled primary/secondary navigation, current state,
      native activation, account placement, and tokenized targets in
      `packages/builder/shell/src/components/IconRail/IconRail.tsx`,
      `packages/builder/shell/src/components/IconRail/IconRail.css`, and
      `packages/builder/shell/src/components/IconRail/index.ts`
- [x] T018 [P] [US2] Complete IconRail's typed variants, MDX contract, and behavior evidence in
      `packages/builder/shell/src/components/IconRail/IconRail.stories.tsx`,
      `packages/builder/shell/src/components/IconRail/IconRail.docs.mdx`, and
      `packages/builder/shell/src/components/IconRail/IconRail.test.tsx`
- [x] T019 [P] [US2] Implement and export the controlled device radio group, history controls,
      preview action, split publish action, and host slot in
      `packages/builder/shell/src/components/TopBar/TopBar.tsx`,
      `packages/builder/shell/src/components/TopBar/TopBar.css`, and
      `packages/builder/shell/src/components/TopBar/index.ts`
- [x] T020 [P] [US2] Complete TopBar's typed variants, MDX contract, and behavior evidence in
      `packages/builder/shell/src/components/TopBar/TopBar.stories.tsx`,
      `packages/builder/shell/src/components/TopBar/TopBar.docs.mdx`, and
      `packages/builder/shell/src/components/TopBar/TopBar.test.tsx`
- [x] T021 [P] [US2] Implement and export tools, three-door provenance, newest state, zoom/device
      details, semantic save states, and empty feedback in
      `packages/builder/shell/src/components/StatusBar/StatusBar.tsx`,
      `packages/builder/shell/src/components/StatusBar/StatusBar.css`, and
      `packages/builder/shell/src/components/StatusBar/index.ts`
- [x] T022 [P] [US2] Complete StatusBar's typed variants, MDX contract, and behavior evidence in
      `packages/builder/shell/src/components/StatusBar/StatusBar.stories.tsx`,
      `packages/builder/shell/src/components/StatusBar/StatusBar.docs.mdx`, and
      `packages/builder/shell/src/components/StatusBar/StatusBar.test.tsx`
- [x] T023 [US2] Add the four new component families and public types to
      `packages/builder/shell/src/index.ts` and curate them through
      `packages/builder/editor/src/index.ts`

## Phase 4: User Story 3 — Find blocks, understand structure, and inspect changes (P1)

- [x] T024 [P] [US3] Add live search, four populated categories, independent collapse, actionable
      empty feedback, and semantic block miniatures in
      `packages/builder/shell/src/components/Palette/Palette.tsx`,
      `packages/builder/shell/src/components/Palette/diagrams.ts`, and
      `packages/builder/shell/src/components/Palette/Palette.css`
- [x] T025 [P] [US3] Record Palette search, no-match, collapse, RTL, insertion, documentation, and
      behavior evidence in `packages/builder/shell/src/components/Palette/Palette.stories.tsx`,
      `packages/builder/shell/src/components/Palette/Palette.docs.mdx`, and
      `packages/builder/shell/src/components/Palette/Palette.test.tsx`
- [x] T026 [P] [US3] Present type-derived names, stable node identities, synchronized selection,
      document-direction-mirrored tree keys, and tokenized hierarchy in
      `packages/builder/shell/src/components/LayersTree/LayersTree.tsx` and
      `packages/builder/shell/src/components/LayersTree/LayersTree.css`
- [x] T027 [P] [US3] Record LayersTree semantics, stories, and selection/keyboard/focus evidence in
      `packages/builder/shell/src/components/LayersTree/LayersTree.docs.mdx`,
      `packages/builder/shell/src/components/LayersTree/LayersTree.stories.tsx`, and
      `packages/builder/shell/src/components/LayersTree/LayersTree.test.tsx`
- [x] T028 [P] [US3] Add the selected-block header, honest category row, semantic collapsible
      groups, explicit empty states, and tokenized panel hierarchy in
      `packages/builder/shell/src/components/Inspector/Inspector.tsx` and
      `packages/builder/shell/src/components/Inspector/Inspector.css`
- [x] T029 [P] [US3] Add labelled alignment segments, color swatches, numeric units, switch
      presentation, guarded one-change commits, responsive markers, and adjacent refusals in
      `packages/builder/shell/src/components/Inspector/InspectorRow.tsx`
- [x] T030 [US3] Record Inspector hierarchy, responsive behavior, accessibility, RTL, stories, and
      behavior evidence in `packages/builder/shell/src/components/Inspector/Inspector.docs.mdx`,
      `packages/builder/shell/src/components/Inspector/Inspector.stories.tsx`, and
      `packages/builder/shell/src/components/Inspector/Inspector.test.tsx`

## Phase 5: Playground composition

- [x] T031 [US1] Keep editor appearance state separate from page appearance state and wrap the
      editing composition in the chrome root at `apps/playground/src/app/App.tsx`
- [x] T032 [US2] Compose TopBar, BuilderShell, IconRail, Palette, EditorCanvas, LayersTree,
      Inspector, and StatusBar exclusively from the preset in `apps/playground/src/app/App.tsx`
- [x] T033 [P] [US2] Define host-owned primary/utility rail destinations and decorative glyphs in
      `apps/playground/src/app/rail-sections.tsx`
- [x] T034 [P] [US3] Project the transaction log into the latest three newest-first
      canvas/code/assistant changes in `apps/playground/src/app/use-recent-changes.ts`
- [x] T035 [US2] Constrain full-page framing, aside scrolling, harness targets, and tokenized host
      chrome in `apps/playground/src/app/App.css`

## Phase 6: Evidence recorded from the implementation

- [x] T036 Gate every discovered `--bldr-*` usage across `packages/builder`, `packages/ui`, and
      `apps/playground` against `definedTokenNames()` plus the three declared runtime-written
      channels, with non-vacuous scan guards, in `packages/builder/theme/src/coverage.test.ts`
- [x] T037 Gate byte-for-byte equality between the generator and
      `packages/builder/theme/src/css/chrome.css`; the test regenerates that file when
      `UPDATE_THEME_CSS=1` is set in `packages/builder/theme/src/css.test.ts`
- [x] T038 Record 18 computed WCAG pairings for each prepared theme, current empty-failure play
      assertions, and replacement of comment-only ratio tables in
      `packages/builder/theme/src/contrast.stories.tsx`; record that
      `packages/builder/theme/src/themes/light.ts` and `packages/builder/theme/src/themes/dark.ts`
      state three historical failures without naming them
- [x] T039 Confirm builder stories are discovered by `apps/storybook/.storybook/main.ts`, bound to
      the shared browser project by `apps/storybook/vitest.config.ts`, and configured for headless
      Chromium by `packages/test-config/src/storybook.mjs`
- [x] T040 Gate zero overflow declarations in selector blocks containing `html`, `body`, or `*` and
      require app-root clipping because preview frames mirror host head stylesheets in
      `apps/playground/src/app/App.test.tsx`
- [x] T041 Confirm the playground declares only `@craftkit/builder`, the preset declares the theme
      package, and the theme has no runtime dependency section in `apps/playground/package.json`,
      `packages/builder/editor/package.json`, and `packages/builder/theme/package.json`
- [x] T042 Cross-check theme=2, shell=3, extension=4, preset=5, app-only-preset access, and strictly
      downward dependency diagnostics in
      `packages/workspace-tools/src/workspace/validate-builder-boundaries.mjs`
- [x] T043 Review the retrospective specification, plan, and completed-task record for source
      grounding, strict checklist syntax, leased-path scope, and documentation-only integrity in
      `specs/workspace/012-builder-design-chrome-theme/spec.md`,
      `specs/workspace/012-builder-design-chrome-theme/plan.md`, and
      `specs/workspace/012-builder-design-chrome-theme/tasks.md`

## Dependencies

```text
T001 → (T002 ∥ T003) → T004 → (T005 ∥ T006) → T007 → T008
US1: T009 → (T010 ∥ T011 ∥ T012) → T013 → T014
US2: (T015 → T016) ∥ (T017 → T018) ∥ (T019 → T020) ∥ (T021 → T022) → T023
US3: (T024 → T025) ∥ (T026 → T027) ∥ (T028 ∥ T029 → T030)
Playground: T013 → T014 → T023 → (T031 ∥ T033 ∥ T034) → T032 → T035
Evidence: (T036 ∥ T037 ∥ T038 ∥ T039 ∥ T040 ∥ T041) → T042 → T043
```

## Parallel opportunities

- Primitive/layout definition and light/dark assignments were path-disjoint.
- Each new shell component folder owned its implementation, stylesheet, export, story, MDX, and
  behavior test without overlapping another component folder.
- Palette, LayersTree, and Inspector were separate component-owned adaptation slices.
- Theme contract gates, browser contrast evidence, app-frame evidence, and manifest/boundary review
  were source-independent evidence lanes.

## Implementation strategy recorded

The implemented dependency order was contract first, legal preset door second, presentational shell
third, playground composition fourth, and cross-workspace evidence last. Because this is a
retrospective task list, there is no remaining MVP or implementation phase: every listed task is
complete, and no unchecked future task is implied.

### Evidence qualification (2026-08-28)

- Source inspection confirms that the contrast matrix currently requires zero failed rows across 18
  pairings in each prepared theme. The two theme files say three historical pairings had never met
  their floor, but no inspected file names those three.
- Source inspection confirms the token scan's literal accepted set is `definedTokenNames()` plus
  `RUNTIME_WRITTEN_TOKENS`; the runtime exceptions are three named channels, not theme roles.
- Source inspection confirms the CSS drift comparison and its regeneration branch. This
  documentation run did not set `UPDATE_THEME_CSS=1` and did not regenerate the stylesheet.
- Source inspection confirms the app-frame check is a source-level guard over `App.css`; it records
  the frame stylesheet-mirroring rationale but does not itself re-execute that runtime behavior.

## Phase 7: Defects the browser found after this list was written

Every item below was found by measuring the running application in Chromium, not by reading source.
Each is recorded with the measurement that exposed it and the gate that now holds it. Several passed
every existing test while the product was broken, which is the reason the gates are browser gates.

- [x] T044 The explicit-choice theme blocks were keyed on `:root[data-bldr-theme=…]` while
      `BuilderTheme` stamps its OWN element, so the rule matched nothing: measured, the attribute
      flipped to `dark` and `--bldr-panel` stayed `#fbfbfd`. Keyed on the attribute alone in
      `packages/builder/theme/src/css.ts` and regenerated `src/css/chrome.css`.
- [x] T045 The gate that should have caught T044 asserted the selector STRING and passed throughout.
      Replaced in `packages/builder/theme/src/css.test.ts`, and the real claim is now read back from
      the browser in `packages/builder/editor/src/components/BuilderTheme/BuilderTheme.stories.tsx`,
      which compares resolved custom properties against the dark theme's own values.
- [x] T046 The dark chrome theme could not be reached from inside the application at all — it
      followed the operating system and no control existed. Added `ChromePicker` with its six
      artifacts under `apps/playground/src/features/preview/components/ChromePicker/`, three states
      (`system` maps to `undefined`, which is what lets `prefers-color-scheme` answer).
- [x] T047 `.bldr-topbar__extra` carried `flex: none` and its grid parents were sized by
      `justify-self`, so a host's content escaped the bar: measured at x = -745 on a 1600px
      viewport, painted across the device switcher. Fixed in `TopBar.css`; gated by the
      `CrowdedExtra` story.
- [x] T048 The same slot let a host's content WRAP out of the 56px band — measured spanning
      0..148px, with the rows below the bar painted over the preview iframe and unclickable. Capped
      with the bar's own height token; gated by the `WrappingExtra` story.
- [x] T049 The playground harness sized its controls from browser defaults, not from the token:
      measured 13-27px against the shell's own 44px, below the WCAG 2.2 SC 2.5.8 floor. Sized from
      `--bldr-hit-target-min` in `App.css`; gated in `App.test.tsx`.
- [x] T050 Eight harness controls plus the product's own could not fit the bar (722px of content in
      a 372px slot). Moved behind a disclosure that opens over the canvas at zero layout cost, in
      `apps/playground/src/app/App.tsx`; gated in `App.test.tsx`.
- [x] T051 The icon rail drew a selected state, moved focus and announced `aria-current` while
      ignoring every click — `activeId` was hard-coded and no handler was passed. Wired to state
      with honest per-section panels in `apps/playground/src/app/rail-section-notice.tsx`; gated in
      `App.test.tsx` by asserting the PANEL changes, not the highlight.
- [x] T052 `.pg-aside` capped its first child with `max-block-size: 38%`, which resolves against the
      grid area the track had already sized to content: measured a 276px track capping its child at
      105px, clipping the tree and leaving 171px of the column empty. Moved the cap to the track
      with `fit-content(38%)`; gated in `App.test.tsx`.
- [x] T053 `LayersTree` and `Palette` sized THEMSELVES with the left panel's width token: measured
      288px inside a 312px column, and the palette's background stopped short of the column's end.
      Both now fill their container; the palette's is gated by the `FillsItsContainer` story.
- [x] T054 The playground rendered a second device switcher in a band of its own, costing 51px of
      viewport for a control the top bar already carried. Removed; the arbitrary-width field it
      uniquely held moved into the harness. Measured: vertical chrome 143px → 92px.
- [x] T055 Two radio groups in the same bar were spoken identically (`light`/`dark`). Each editor
      option now names its subject, with the visible word contained in the spoken name.
- [x] T056 `overflow-wrap: anywhere` is considered before hyphenation, so "Testimonials" rendered as
      "Testimonial / s". Changed to `break-word` with `hyphens: auto` in `Palette.css`.

### Verification of this phase

Every fix above was mutation-checked by the coordinator: the guard was broken the smallest way, the
named gate was confirmed to fail, and the file was restored. The Chromium gates were run from
`apps/storybook` with `pnpm exec vitest run --project=storybook <path>`.

## Phase 8: The rail's promises, and a feature that had never opened

Found by driving the running application, after the user reported that the rail's Layers destination
showed a note pointing somewhere else.

- [x] T057 The rail's Layers destination was a paragraph explaining that the tree was in the right
      column. Blocks and Layers now share the left panel the way this kind of builder always does,
      and the inspector gets the whole right column as a result — measured 631px → 907px. Gated in
      `apps/playground/src/app/App.test.tsx`.
- [x] T058 `Palette` drew a trailing separator that the shell region already draws — measured, two
      1px rules painted in the same place, a 2px seam where the design says 1. `LayersTree` drew a
      LEADING one, which was right beside the canvas and became a stray line against the rail the
      moment the tree moved. Separators belong to whoever decides placement. Gated in Chromium by
      `Palette.stories.tsx`.
- [x] T059 `LayersTree` left its block size to content: 276px inside a 907px column with the
      column's own ground beneath it.
- [x] T060 The rail's Settings item explained where the settings were. It opens them now, and does
      not claim to be a destination while doing so.
- [x] T061 The code view could be reached ONLY by choosing a document fixture named "Code view",
      which made a harness setting the door to a product feature and left the rail's Code item with
      nothing to do but describe it. The rail is now the single door; the fixture chooses a document
      and nothing else.
- [x] T062 **The code view had never once opened in a browser.** `CodeViewShowcase` guarded its
      async open with a `useRef(true)` whose effect was cleanup-only, so under `StrictMode` — which
      this application runs — React's simulated unmount set the flag false and nothing set it back.
      Every open then took the "component went away" branch: it disposed the adapter it had just
      built, terminated the worker it had just started, and returned without clearing `opening`.
      Nothing threw, nothing was shown, every module still loaded with a 200, and the button read
      "Opening code view…" for as long as anyone waited. The jsdom tests never saw it because they
      render the component bare, while `main.tsx` wraps the app in `StrictMode`. Fixed, and gated by
      a test that renders inside `StrictMode`.
- [x] T063 With the panel open the showcase stood 991px tall inside a 907px region — the editor's
      last lines sat below the fold — because its canvas was pinned to a hard-coded 560px and the
      section took its height from content. It fills its region and divides that instead. Gated in
      Chromium by `CodeViewShowcase.stories.tsx`.
- [x] T064 A bare `0` sat beside Publish with nothing saying what it counted. It is the sealed-store
      instrument, and its caption is now a SIBLING of the output — folding it inside would turn the
      law's own assertions into `NaN`, which the gate proves by failing three tests when it is.

### Verification of this phase

Every fix mutation-checked by the coordinator. One honest result to record: the fit gate (T063)
catches the section's failure to fill its region, but NOT the hard-coded canvas height on its own —
once the section fills, flex absorbs a fixed child. The gate was strengthened to measure content
overflow rather than the section's own box after the first version passed its mutation.

## Phase 9: A seven-lens audit of the running product

Seven independent lenses drove the running application and read the source; every finding was then
handed to an agent whose only instruction was to REFUTE it. 59 agents ran; **40 findings survived**.
What follows is the record, not a plan — items marked `[x]` are closed and mutation-checked by the
coordinator; the rest are dispatched or queued.

### Closed

- [x] T065 A block's `schema.description` — prose written for a catalogue — was used as its NAME in
      four places: the selection and hover badge, the drag ghost, the block action bar, and the
      live-region announcements. The badge was one unbroken `nowrap` line that ran off the canvas; a
      screen-reader user heard a whole paragraph for "Moved <block>". One shared derivation now
      lives in `packages/builder/shell/src/naming/block-display-name.ts`, and the badge is capped
      and ellipsised so no name can escape again. Confirmed in the live app: the badge reads "Hero",
      38x17px, inside the canvas.
- [x] T066 The gate for T065 is a Chromium story, and that is not incidental. The coordinator re-ran
      the mutation against the jsdom suites first: reverting the label to the prose description left
      **122 tests green**. Only `overlay-controller.stories.tsx` caught it
      (`expected 'An extensive catalogue description...' to be 'Marketing CTA Banner...'`). A claim
      about what is painted cannot be held by a test that cannot paint.

### Dispatched, not yet verified

- [ ] T067 The primary **Publish** CTA and its options chevron are wired to nothing — the app passes
      neither handler, so the most prominent control in the chrome swallows clicks in silence.
- [ ] T068 **Undo and Redo are permanently enabled from a constant.** The kernel exposes
      `canUndo()`/`canRedo()`; nothing reads them, so both are enabled on first load with an empty
      history.
- [ ] T069 The status bar asserts **"Saved"** permanently, in a polite live region, while the
      application has no persistence at all.
- [ ] T070 The status bar shows a **zoom percentage the canvas does not have** — nothing in the
      editor scales; the number is the device width wearing the wrong label.
- [ ] T071 Recent-change chips are focusable buttons wired to nothing, and the tool group renders
      empty while still carrying a name.
- [ ] T072 The Inspector's Content/Design/Advanced tabs are **inert spans**, and the first asserts
      `aria-current="page"` — announcing a selection among options that do not exist.
- [ ] T073 **`color-scheme` is never declared**, so under the dark editor every native widget —
      checkbox, radio, select, scrollbar — keeps the light user-agent palette.
- [ ] T074 Palette cards draw their glyph with no tile and no accent, where the approved design
      board puts each glyph inside a soft-violet tile. The most visible drift from the design.

### Verified, queued behind the running leases

- [ ] T075 **`.bldr-overlay` is a scroll container.** `overflow: hidden` makes it programmatically
      scrollable, so the browser's focus scroll-into-view moves it: one Tab onto a clipped floating
      control scrolls the chrome layer 22px and nothing ever resets it. Every selection outline,
      hover outline, name chip and drop indicator then points 22px away from the content it
      describes, for the rest of the session. `overflow: clip` does not create a scroll container.
      Measured: outline at host y 866.4 against a block at y 888.4.
- [ ] T076 The **block action bar for the last block** is placed at y 955-989 while its clipping
      parent ends at 963, because the placement arithmetic uses `window.innerHeight` — counting the
      status bar as free room — and nothing clamps against the clip box. 22 of each button's 26px
      are covered by the status bar; a click at the button's centre silently hits the status bar
      instead. The effective target is a 4px sliver.
- [ ] T077 Floating chrome sizes itself in `rem`, so its type, padding and hit targets are decided
      by the root font size of a document it does not control.
- [ ] T078 Preview mode renders OUTSIDE `BuilderTheme`, so the chrome theme is lost there and the
      only exit control is a near-invisible chip.

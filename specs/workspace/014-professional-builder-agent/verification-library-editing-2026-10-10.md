# Library, template layout and exact insertion repair

Scope: Builder shell editing/library and marketing Stack canvas layout. No Studio engine,
saved user project, dependency, deployment, commit or external service changes.

## Reproduced causes and repairs

- Library tab strip shrank to 12.3px in a populated panel. Tabs/search now keep their height.
- Thumbnail body used a fixed 1040px width with a fixed .25 transform and RTL transform origin.
  The iframe now keeps its authored viewport and scales to the measured card width.
- Canvas `display:contents` slot scaffolding interrupted Stack direct-child sizing. The clinic
  template contained zero-width Stacks and a 102.8px title. Stack-specific wrapper sizing now
  preserves full-width columns and side-by-side flex rows; measured title width is 560px.
- Container drops appended to their last child regardless of pointer position. Resolution now
  chooses the nearest sibling seat and follows flex direction/RTL for horizontal gaps.
- Library elements only supported tree drops. They can now create a region at an exact block
  seat; sections and page templates also support pointer insertion. Tree drops carry CSS and
  all roots of a saved entry. Cancellation makes no writes; insertion is undoable.
- Host-realm `instanceof Node` rejected iframe targets during text editing/free positioning.
  Realm-independent checks preserve caret interactions and selection.
- Tall offscreen selections reveal their start instead of centering a whole page template.
- Element categories combine with bilingual search; existing presets and saved entries remain.

## Verification

- Shell: 14 focused Vitest files, 223 tests passed (EditorCanvas, LibraryPanel, TemplateCard,
  drag session, block/tree drop resolvers and frame bridge).
- Marketing Stack: 4 unit tests passed; CanvasRow story added.
- TypeScript passed for shell, renderer, blocks-marketing and Playground.
- Scoped ESLint passed. `git diff --check` passed.
- Playground Vite production build passed. Existing build output reports unresolved placeholder
  asset references, ineffective dynamic imports and large chunks; these are not resolved here.
- Chromium local browser scenario passed: categories, tab geometry, real block/tree/template
  drags, Inspector selection, selection outline alignment under zoom, caret click retention,
  RTL template width, canvas row layout, and no host overflow at 1440/768/390px.
  Run: `node apps/evals/src/browser/library-editing.mjs http://localhost:5174`.
  The scenario uses fresh browser storage and refuses non-loopback targets.
- Independent read-only reviewer found row-wrapper sizing and multi-root drag issues; both were
  fixed and re-reviewed with no remaining High/Medium findings. Real row geometry was then
  verified in Chromium by changing the selected Stack direction.

## Limits

This is local Chromium evidence, not a production or all-browser release certification. No full
Storybook build, Firefox/WebKit pass, screenshot-baseline comparison or complete accessibility
audit was run. Visual regression against a committed baseline is inconclusive (none used).
Normal drag placement follows the responsive document flow; it does not convert blocks to
arbitrary absolute positioning.

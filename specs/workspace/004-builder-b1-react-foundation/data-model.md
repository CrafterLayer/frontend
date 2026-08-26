# Data Model: Builder B1 View Foundation

Exact shapes live in [contracts/builder-view.md](./contracts/builder-view.md); kernel data contracts
are unchanged from [003](../003-builder-b0-kernel/contracts/builder-kernel.md). This file maps
entities, ownership, and flows.

## Entity map

```text
BuilderKernel (003) ─ prop ─► DocumentView ─ per-node subscribe ─► block renderers
                    └ context ─► BuilderProvider ─► hooks (useNode/useSelection/useDispatch)
Theme ─ themeToCssVars ─► CanvasFrame managed <style> ─► --t-* consumed by <Name>.css
BuilderDocument + blocks lookup ─► StaticDocument ─► renderStaticMarkup (pure string)
resolveResponsiveProps(node, breakpoint) ─► BlockRenderProps.props (per 003 contract)
defaultBlocks (preset: Page) + blocksMarketing (Hero/Features/Pricing/Testimonials/Cta)
  ─ TrustedExtensionManifest (003) ─► kernel registries ─► both renderers
playground-demo (announcement) ─ runtime register ─► useRegistryVersion bump ─► re-render
```

## Ownership & validation

| Entity                             | Owner                                                  | Validated by                                                         |
| ---------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Theme / TokenName / themeToCssVars | builder-renderer `resolve/theme.ts`                    | unit tests (var emission, fallback behavior)                         |
| Responsive resolution              | builder-renderer `resolve/responsive.ts`               | unit tests incl. unknown-breakpoint rejection (FR-007)               |
| Live tree + scoped re-render       | builder-renderer `DocumentView`                        | render-counter tests on stress fixture (SC-002)                      |
| Static purity                      | builder-renderer `StaticDocument`/`renderStaticMarkup` | double-render byte equality + live/static parity (SC-003)            |
| Frame isolation + dir + tokens     | builder-renderer `CanvasFrame`                         | jsdom tests (style mirroring, managed token style, dir root, portal) |
| Kernel context + hooks             | builder-react                                          | behavior tests through provider; outside-provider throw              |
| Slot ordering                      | builder-react `Slot`                                   | order assertions against document slots                              |
| Block schemas/examples             | blocks-marketing `components/*/schema.ts`              | `defineBlockSchema` gate (003) + example-render tests                |
| Component completeness             | all new components                                     | `check:components` (mechanical, CI-fatal)                            |
| App boundary                       | playground manifest                                    | `check:workspace` `BUILDER_FAMILY_ACCESS`                            |
| Story a11y                         | every story                                            | Storybook a11y addon at `error` via `test:storybook`                 |

## State transitions (view-level only — no new persisted state)

```text
mount:    createPlaygroundKernel → <Builder kernel theme breakpoint>
change:   control → kernel.dispatch(command) → tx.applied → exactly one subscribeNode
          notification → one block view re-renders
undo:     history event → same scoped path (no remount)
theme:    ThemePicker state → CanvasFrame managed style rewrite (no kernel involvement)
dir:      DirectionFlip → dispatch setDocMeta {dir} → docMeta.changed → frame dir attr
register: RegisterDemoExtension → kernel.extensions.register(demo) →
          extension.registered → useRegistryVersion bump → insert announcement via
          command → renders (FR-013); dispose → UnknownBlock fallback
```

## Fixtures

- Kernel-test fixtures (core `/testing`) remain kernel-internal (their block types clash with
  marketing types by design of the test vocabulary).
- Playground authors `marketing-landing` (page → hero[+2 cta actions] → features(3) → pricing(3
  plans) → testimonials(2) → cta) with Arabic-and-English content and a `mobile` tone override on
  the hero — exercising FR-002/005/007/009 visibly.
- SC-002 uses core's 1,000-node stress fixture inside builder-renderer's own tests (fixture types
  registered there via core's testing manifest — no marketing clash in that isolated kernel).

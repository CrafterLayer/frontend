# @craftkit/builder-blocks-marketing

The first real content extension: five landing-page blocks — `hero`, `features`, `pricing`,
`testimonials`, `cta` — shipped as one trusted (tier-1) manifest, `blocksMarketing`. Each block is a
complete mechanically-validated component: `schema.ts` (zod props + slot rules), `examples.ts`
(Arabic + English AI-ready examples), implementation, plain-CSS stylesheet, typed stories, MDX docs,
behavior test, and local index.

Normative source:
[`specs/workspace/004-builder-b1-react-foundation`](../../../../specs/workspace/004-builder-b1-react-foundation/plan.md)
(prop vocabularies in `contracts/builder-view.md` §5). Layer 4 (extension) of ADR 0003 — depends
only on `@craftkit/builder-schema`; `react` is a peer; extensions never import extensions.

## Styling rules

- Plain CSS files, imported by their component (`sideEffects: ["**/*.css"]`).
- **Logical properties only** (`margin-inline`, `padding-block`, `text-align: start`) — RTL works by
  `dir` alone, with zero direction-specific rules.
- Content surfaces read `var(--t-*)` design tokens; explicit child-layout gaps map the shared
  `none|sm|md|lg` intent to `var(--bldr-space-*)`. The document itself stays intent-only (the
  kernel's no-px/no-hex law governs document props, CSS owns values).

## Block vocabulary

| type           | content props          | layout and surface props                 | slots                          |
| -------------- | ---------------------- | ---------------------------------------- | ------------------------------ |
| `hero`         | eyebrow, heading, body | tone, align, spacing, width, flex layout | `actions` (allow `cta`, max 2) |
| `features`     | heading, body, items[] | columns, align, tone, spacing, width     | —                              |
| `pricing`      | heading, body, plans[] | columns, align, tone, spacing, width     | —                              |
| `testimonials` | heading, body, items[] | columns, align, tone, spacing, width     | —                              |
| `cta`          | label, note            | emphasis, size, width                    | —                              |

Section controls are intent-only enums: logical alignment (`start`, `center`, `end`), vertical
spacing (`none`, `sm`, `md`, `lg`), content width (`narrow`, `standard`, `wide`, `full`), and tone
(`transparent`, `light`, `dark`). Renderers map those choices to CSS tokens; documents never store
pixel or color literals.

Only schemas with child slots expose flex layout. Today that is `hero.actions`: optional direction
(`row`, `column`), main- and cross-axis alignment (`start`, `center`, `end`), gap (the shared
spacing vocabulary), and wrapping (`nowrap`, `wrap`). Omission preserves the legacy slot geometry.

## Development

```bash
pnpm --filter @craftkit/builder-blocks-marketing lint
pnpm --filter @craftkit/builder-blocks-marketing typecheck
pnpm --filter @craftkit/builder-blocks-marketing test
```

Stories render in the workspace Storybook (`pnpm --filter @craftkit/storybook dev`) with the a11y
addon at error level.

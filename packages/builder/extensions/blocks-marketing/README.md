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
- Every color/spacing decision reads a `var(--t-*)` design token with a fallback; the document
  itself stays intent-only (the kernel's no-px/no-hex law governs document props, CSS owns values).

## Block vocabulary

| type           | props (intent-only)                  | slots                          |
| -------------- | ------------------------------------ | ------------------------------ |
| `hero`         | tone, align, heading, body           | `actions` (allow `cta`, max 2) |
| `features`     | heading, columns, items[]            | —                              |
| `pricing`      | heading, plans[] (highlighted state) | —                              |
| `testimonials` | heading, quotes[]                    | —                              |
| `cta`          | label, emphasis, note                | —                              |

## Development

```bash
pnpm --filter @craftkit/builder-blocks-marketing lint
pnpm --filter @craftkit/builder-blocks-marketing typecheck
pnpm --filter @craftkit/builder-blocks-marketing test
```

Stories render in the workspace Storybook (`pnpm --filter @craftkit/storybook dev`) with the a11y
addon at error level.

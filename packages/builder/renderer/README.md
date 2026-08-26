# @craftkit/builder-renderer

Rendering engines for the builder: a **live** per-node-subscribed canvas renderer, a **pure static**
renderer for published output, responsive prop resolution, design-token theming via CSS custom
properties, and an isolation iframe. The kernel always arrives **by prop** — this package never
imports `@craftkit/builder-react` (equal-layer imports are forbidden by ADR 0003), which also keeps
the static path usable in publish pipelines with no React context at all.

Normative source:
[`specs/workspace/004-builder-b1-react-foundation`](../../../specs/workspace/004-builder-b1-react-foundation/plan.md).
Layer 2 — depends only on `@craftkit/builder-{schema,core}`; `react` and `react-dom` are peers.

## Public API

- `DocumentView` — live tree: each node subscribes individually (`useKernelNode`), one `setProp`
  re-renders exactly one block (proven by the `onBlockRender` probe prop); unknown types render
  `UnknownBlock`; re-reads catalogs on registry epoch bumps.
- `CanvasFrame` — isolation iframe: mirrors parent `<style>`/`<link rel="stylesheet">` into its head
  (initial copy + `MutationObserver`), writes one managed `--t-*` token style from `theme`, sets
  `dir` on the frame root, and portals children into the frame body.
- `StaticDocument` / `renderStaticMarkup` — pure render of `(document, blocks, breakpoint)`;
  byte-identical output across runs by construction (no ids, no effects).
- `resolveResponsiveProps` — base props + breakpoint cascade (`desktop → tablet → mobile`).
- `lightTheme` / `darkTheme` / `themeToCssVars` / `tokenCssName` — starter token themes emitted as
  `--t-*` CSS custom properties.
- `useKernelNode` / `useKernelSelector` / `useRegistryEpoch` — `useSyncExternalStore` wiring over
  the kernel's read-only facade, for view code that receives a kernel by prop.

## Development

```bash
pnpm --filter @craftkit/builder-renderer lint
pnpm --filter @craftkit/builder-renderer typecheck
pnpm --filter @craftkit/builder-renderer test
```

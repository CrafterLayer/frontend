# @craftkit/builder-react

React bindings for the builder kernel: a provider that puts one `BuilderKernel` into context, plus
per-concern hooks that subscribe through the kernel's read-only state facade via
`useSyncExternalStore`. No rendering lives here — rendering engines are
`@craftkit/builder-renderer`; composition is the `@craftkit/builder` preset.

Normative source:
[`specs/workspace/004-builder-b1-react-foundation`](../../../specs/workspace/004-builder-b1-react-foundation/plan.md).
Layer 2 of the builder dependency law (ADR 0003) — depends only on
`@craftkit/builder-{schema,core}`; `react` is a peer. Layer-2 siblings never import each other, so
this package and `builder-renderer` are mutually independent by CI-enforced law.

## Public API

- `BuilderProvider` — mounts a kernel instance into React context (`kernel` by prop).
- `useBuilder()` — the kernel from context; throws a `BuilderError` outside a provider.
- `useNode(id)` — live subscription to ONE node; `undefined` after removal; other nodes' changes do
  not notify it (scoped by `subscribeNode`).
- `useSelection()` — the current selection id list.
- `useDispatch()` — the kernel's single validated dispatch door, author defaults applied.
- `useRegistryVersion()` — bumps on `extension.registered`/`extension.disposed`, so catalogs can
  re-read after runtime registration (FR-013).
- `Slot` — render-prop component that resolves a node's named slot to its ordered child ids.

## Development

```bash
pnpm --filter @craftkit/builder-react lint
pnpm --filter @craftkit/builder-react typecheck
pnpm --filter @craftkit/builder-react test
```

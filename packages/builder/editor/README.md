# @craftkit/builder

The builder preset — **the single entrypoint applications may import**. The workspace dependency law
(ADR 0003) makes deeper imports (`@craftkit/builder-core`, `-react`, `-renderer`, extensions)
CI-fatal for non-builder members, so everything an application legitimately needs is curated here.

Normative source:
[`specs/workspace/004-builder-b1-react-foundation`](../../../specs/workspace/004-builder-b1-react-foundation/plan.md)
(surface list in `contracts/builder-view.md` §4, guarded by `src/surface.test.ts`). Layer 5 —
composes core, react bindings, renderer engines, and the starter extensions.

## Public API

- `Builder` — one-component composition: `BuilderProvider` + `CanvasFrame` (live `dir` from document
  meta) + `DocumentView`. Mount it with a kernel and a theme; that is the whole embed.
- `Page` / `pageSchema` / `defaultBlocks` — the structural root block (`page`) whose default slot
  allows the marketing vocabulary plus `announcement` (the runtime-registration demo type).
- Re-exports (curated, not `export *`): react bindings (`BuilderProvider`, `Slot`, hooks), renderer
  engines (`DocumentView`, `StaticDocument`, `renderStaticMarkup`, `CanvasFrame`, `UnknownBlock`,
  themes, `resolveResponsiveProps`, `useKernelSelector`), kernel access (`createBuilder`,
  `openDocument`, `defineCommand`, `emptyDocument`, `insertedNodeId`), contract authoring
  (`defineBlockSchema` + the public types), and the `blocksMarketing` manifest.
- `@craftkit/builder/testing` — verbatim passthrough of `@craftkit/builder-core/testing`
  (deterministic ports, fixtures, memory persistence) so apps can test without deeper imports.

## Minimal embed

```tsx
import {
  Builder,
  blocksMarketing,
  createBuilder,
  defaultBlocks,
  lightTheme,
} from '@craftkit/builder';
import {
  createMemoryPersistence,
  fixedClock,
  landingFixture,
  seededIds,
} from '@craftkit/builder/testing';

const kernel = createBuilder({
  document: landingFixture(),
  extensions: [defaultBlocks, blocksMarketing],
  ports: { clock: fixedClock(), ids: seededIds('app') },
  persistence: createMemoryPersistence(),
});

export const App = () => <Builder kernel={kernel} theme={lightTheme} />;
```

## Development

```bash
pnpm --filter @craftkit/builder lint
pnpm --filter @craftkit/builder typecheck
pnpm --filter @craftkit/builder test
```

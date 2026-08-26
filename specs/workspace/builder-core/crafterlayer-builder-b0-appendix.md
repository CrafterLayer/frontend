# Builder — B0 Contracts Appendix (closes the plan to 100%)

> **Status: reference material** — the executive source for the builder is
> `specs/workspace/003-builder-b0-kernel/` (spec, plan, contracts, tasks).

Normative companion to `crafterlayer-builder-structure.md` §2–§3 and Master Plan v3. This document
resolves every open question that could stall execution. **Nothing here requires a backend:** B0–B6
run entirely in the playground with in-memory adapters; the only `PersistenceAdapter` implementation
until graduation is `createMemoryPersistence()`.

**Naming — decided:** internal packages stay `@repo/builder-*` (matches the monorepo). The public
scope at OSS extraction is reserved as the working name `@crafterkit/*` — a single find-and-replace
at publish time. Final scope + license are **release blockers, not B0 blockers**.

---

## 1. The Law of Rendering (resolves the Tier-2 question)

> **All pixels are drawn by Tier-1 code. Tier-2 supplies only data that Tier-1 renderers
> interpret.**

Concretely:

- A **BlockDef** (Tier-1) carries `render` — executable React, shipped with the platform/extension
  code.
- A **Tier-2 composition** is a stored subtree of Tier-1 node types. Two insert modes:
  - **Detached (default):** inserting clones the subtree into the document with fresh nanoids. No
    runtime link.
  - **Linked:** inserting adds one node
    `{ type: "composition", props: { ref, version, mode: "pinned" | "latest" } }`. The Tier-1
    built-in `CompositionRenderer` resolves the stored subtree from the registry and renders it. A
    `detachComposition` command expands it in place. "Promote to library" writes a new version row.
- A **widget skin** (Tier-2) is a layout tree of Tier-1 primitives whose elements carry
  `bind="field"` markers. The Tier-1 `WidgetRenderer` renders the active skin for the active state,
  resolving binds against the widget's contract data. A skin never contains code.
- Therefore the `ExtensionManager` rejects any Tier-2 manifest containing `setup`, `render`, or any
  function value — enforced by structural validation (`schema/extensions/validate-tier2.ts`), not
  convention.

This is why the org/marketplace layer can never become a code-injection surface, and why an org
block from the DB is indistinguishable in the palette from an official one: both resolve to Tier-1
pixels.

---

## 2. Complete Type Definitions (everything previously named-only)

```ts
// ── Patches (Immer-compatible) ───────────────────────────────
type PatchOp = 'add' | 'remove' | 'replace';
interface Patch {
  op: PatchOp;
  path: (string | number)[];
  value?: unknown;
}

// ── Kernel context (what setup(ctx) receives) ────────────────
interface KernelContext {
  store: BuilderStore; // getState / subscribe / select
  dispatch<A>(command: string, args: A, author?: Author): Transaction;
  registry: RuntimeRegistry; // read-only lookups (O(1) keyed maps)
  events: EventBus; // typed emit/on
  surface: Surface;
  dir: 'ltr' | 'rtl'; // DOCUMENT dir (content); shell UI dir
  // is independent and never enters the kernel
}

// ── Contribution shapes ──────────────────────────────────────
interface PanelContribution {
  id: string;
  slot: 'left' | 'right' | 'bottom' | 'modal';
  title: string; // i18n key, resolved by shell messages
  icon?: string;
  order?: number;
  when?: (ctx: KernelContext) => boolean;
  load: () => Promise<{ default: ComponentType<PanelProps> }>; // lazy — perf law #11
}

interface FieldTypeDef {
  id: string;
  match(schema: z.ZodTypeAny): number; // priority score; 0 = no match; highest wins
  load: () => Promise<{ default: ComponentType<FieldProps> }>;
}
interface FieldProps {
  schema: z.ZodTypeAny;
  value: unknown;
  path: (string | number)[]; // into props or responsive[bp]
  onChange(next: unknown): void; // host wraps into setProp/setResponsive
  disabled?: boolean;
}

interface OverlayToolDef {
  id: string;
  on: 'selection' | 'hover' | 'drag' | 'always';
  order?: number;
  load: () => Promise<{ default: OverlayToolRenderer }>;
}
type OverlayToolRenderer = (t: {
  nodeId: NodeId;
  rect: DOMRectReadOnly;
  layer: HTMLElement;
  ctx: KernelContext;
}) => () => void; // mounts into layer, returns cleanup — no React

interface ProjectionDef {
  id: string; // "code" | "mdx" | ...
  project(doc: BuilderDocument, scope?: { nodeId: NodeId }): string;
  parse(
    text: string,
    doc: BuilderDocument,
    scope?: { nodeId: NodeId },
  ): { ok: true; patches: Patch[] } | { ok: false; errors: { line: number; message: string }[] };
} // executed inside the transforms worker

interface DataSourceDef {
  id: string;
  create(): DataSource;
}

interface AiContextProvider {
  id: string;
  collect(ctx: KernelContext, selection: NodeId[]): ContextFragment;
}
interface ContextFragment {
  title: string;
  body: string;
  tokens?: number;
}

type CommandFactory = Command<any>;
interface KeymapDef {
  combo: string;
  command: string;
  when?: string;
}

interface BlockRenderProps<P> {
  node: Node;
  props: P; // validated + responsive-resolved for active bp
  slots: Record<string, ReactNode>; // children rendered into declared slots
  data: Record<string, unknown>; // resolved bindings (undefined in static mode until resolved)
  isCanvas: boolean; // live canvas vs published/static
}
interface ResolveCtx {
  surface: Surface;
  locale: string;
  signal?: AbortSignal;
}

// ── Tier-2 rows ──────────────────────────────────────────────
interface CompositionDef {
  id: string;
  name: string;
  version: number;
  surfaces?: Surface[];
  rootId: NodeId;
  nodes: Record<NodeId, Node>; // snapshot subtree (validated)
}

interface WidgetTypeDef {
  type: `widget:${string}`;
  contract: Record<string, { shape: z.ZodTypeAny; required?: boolean }>;
  binding: { source: string; map: Record<string, string>; secretRef?: string };
  skins: SkinDef[];
  defaultSkin: string;
}
interface SkinDef {
  id: string;
  version: number;
  states: {
    // ALL FOUR REQUIRED — the gate
    loading: SubTree;
    empty: SubTree;
    error: SubTree;
    success: SubTree;
  };
}
type SubTree = { rootId: NodeId; nodes: Record<NodeId, Node> }; // Tier-1 primitives + bind markers
```

---

## 3. Worked Example A — the hero triad (verbatim template for every block)

```ts
// extensions/blocks-marketing/src/blocks/hero/schema.ts
import { z } from 'zod';
import { defineBlockSchema } from '@repo/builder-schema';

export const heroSchema = defineBlockSchema({
  type: 'hero',
  description:
    'Opening section at the top of a page: heading, optional body, up to two action buttons. Use once per page.',
  surfaces: ['site', 'store'],
  props: z.object({
    tone: z.enum(['light', 'dark']).default('light'),
    align: z.enum(['start', 'center']).default('center'),
    heading: z.string().min(1).max(80),
    body: z.string().max(200).optional(),
  }),
  slots: { actions: { allow: ['button'], max: 2 } },
});
```

```tsx
// extensions/blocks-marketing/src/blocks/hero/render.tsx
import { cva } from 'class-variance-authority';
import type { BlockRenderProps } from '@repo/builder-schema';
import type { z } from 'zod';
import { heroSchema } from './schema';

const root = cva(
  'flex flex-col gap-4 px-6 py-16 rounded-(--t-radius)', // logical/RTL-safe by construction
  {
    variants: {
      tone: {
        light: 'bg-(--t-surface) text-(--t-fg)',
        dark: 'bg-(--t-surface-inverse) text-(--t-fg-inverse)',
      },
      align: { start: 'items-start text-start', center: 'items-center text-center' },
    },
  },
);

type P = z.infer<typeof heroSchema.props>;

export default function Hero({ props, slots }: BlockRenderProps<P>) {
  return (
    <section className={root({ tone: props.tone, align: props.align })}>
      <h1 className="text-4xl font-semibold">{props.heading}</h1>
      {props.body && <p className="max-w-prose text-(--t-fg-muted)">{props.body}</p>}
      {slots.actions && <div className="flex gap-3">{slots.actions}</div>}
    </section>
  );
}
```

```ts
// extensions/blocks-marketing/src/blocks/hero/examples.ts
export const heroExamples = [
  {
    prompt: 'هيرو فخم غامق لمتجر عطور',
    node: {
      type: 'hero',
      props: {
        tone: 'dark',
        align: 'center',
        heading: 'عود يليق بذوقك',
        body: 'تركيبات فاخرة تدوم ١٢ ساعة',
      },
    },
  },
  {
    prompt: 'minimal light hero for a SaaS analytics tool',
    node: {
      type: 'hero',
      props: {
        tone: 'light',
        align: 'start',
        heading: 'See your numbers clearly',
        body: 'Realtime analytics without the noise.',
      },
    },
  },
];
```

```ts
// extensions/blocks-marketing/src/index.ts
import { defineExtension } from '@repo/builder-schema';
import { heroSchema } from './blocks/hero/schema';
import Hero from './blocks/hero/render';
import { heroExamples } from './blocks/hero/examples';

export default defineExtension({
  name: 'blocks-marketing',
  version: '0.1.0',
  tier: 1,
  contributes: { blocks: [{ ...heroSchema, render: Hero, examples: heroExamples }] },
});
```

---

## 4. Worked Example B — a real document

```json
{
  "schemaVersion": 1,
  "surface": "site",
  "dir": "rtl",
  "rootId": "pg_home",
  "nodes": {
    "pg_home": {
      "id": "pg_home",
      "type": "page",
      "props": { "title": "Home" },
      "children": ["nd_nav", "nd_hero", "nd_grid"]
    },

    "nd_nav": { "id": "nd_nav", "type": "navbar", "props": { "sticky": true }, "children": [] },

    "nd_hero": {
      "id": "nd_hero",
      "type": "hero",
      "props": {
        "tone": "dark",
        "align": "start",
        "heading": "عود يليق بذوقك",
        "body": "تركيبات فاخرة تدوم ١٢ ساعة"
      },
      "responsive": { "mobile": { "align": "center" } },
      "children": ["nd_cta1", "nd_cta2"]
    },

    "nd_cta1": {
      "id": "nd_cta1",
      "type": "button",
      "props": { "label": "تسوّق الآن", "emphasis": "primary" }
    },
    "nd_cta2": {
      "id": "nd_cta2",
      "type": "button",
      "props": { "label": "اكتشف المجموعة", "emphasis": "ghost" }
    },

    "nd_grid": {
      "id": "nd_grid",
      "type": "widget:productGrid",
      "props": { "columns": 3, "cardStyle": "minimal" },
      "bindings": { "items": "mock.products" },
      "children": []
    }
  }
}
```

Notes the model must absorb: children order **is** page order · slots are children filtered by the
slot's `allow` list · `mock.products` resolves through the playground DataSource — no network exists
anywhere · the mobile override passes the same prop validator as the base.

---

## 5. Worked Example C — transactions through the single door

**User edits the hero heading (inspector):**

```ts
dispatch('setProp', { id: 'nd_hero', key: 'heading', value: 'عطور تُروى كالحكايات' }, 'user');
```

```json
{
  "command": "setProp",
  "author": "user",
  "ts": 1756100000000,
  "patches": [
    {
      "op": "replace",
      "path": ["nodes", "nd_hero", "props", "heading"],
      "value": "عطور تُروى كالحكايات"
    }
  ],
  "inverse": [
    { "op": "replace", "path": ["nodes", "nd_hero", "props", "heading"], "value": "عود يليق بذوقك" }
  ]
}
```

**AI adds a testimonials section (after DiffReview accept):**

```json
{
  "command": "insertNode",
  "author": "ai",
  "patches": [
    {
      "op": "add",
      "path": ["nodes", "nd_tst"],
      "value": {
        "id": "nd_tst",
        "type": "testimonials",
        "props": { "layout": "cards" },
        "children": []
      }
    },
    {
      "op": "replace",
      "path": ["nodes", "pg_home", "children"],
      "value": ["nd_nav", "nd_hero", "nd_tst", "nd_grid"]
    }
  ],
  "inverse": [
    {
      "op": "replace",
      "path": ["nodes", "pg_home", "children"],
      "value": ["nd_nav", "nd_hero", "nd_grid"]
    },
    { "op": "remove", "path": ["nodes", "nd_tst"] }
  ]
}
```

Same shape, same log, same undo stack, same history — `author` is the only difference. A code-view
edit produces the identical structure with `author: "codeview"`. **There is no second door.**

---

## 6. The B0 fake extension (exit-test fixture)

```ts
// core/src/testing/fake-extension.ts
import { z } from 'zod';
import { defineExtension, defineBlockSchema } from '@repo/builder-schema';

export const fakeExtension = defineExtension({
  name: 'fake',
  version: '0.0.1',
  tier: 1,
  contributes: {
    blocks: [
      {
        ...defineBlockSchema({
          type: 'fakeBox',
          description: 'Test block.',
          props: z.object({ label: z.string().default('x') }),
        }),
        render: (() => null) as never, // B0 is headless; render untested here
        examples: [],
      },
    ],
    commands: {
      'fake.tag': (args: { id: string }) => (draft) => {
        draft.nodes[args.id].props.label = 'tagged';
      },
    },
  },
});

// Also required in B0 tests: a tier-2 manifest WITH a setup/function value,
// asserted to be REJECTED by the ExtensionManager (security law).
```

---

## 7. Amendment to the B0 Handoff Brief

Append to `crafterlayer-builder-structure.md` §6:

> **Normative alongside §2:** `crafterlayer-builder-b0-appendix.md` — the Law of Rendering (§1), the
> full type set (§2), and the worked examples (§3–§6) are binding. Where prose and example disagree,
> the example wins. **No network code anywhere in B0–B6**; the only persistence is
> `createMemoryPersistence()` in `core/testing`. Package names are `@repo/builder-*`; do not
> introduce any other scope.

---

## 8. 100% Readiness Checklist

| Gap                        | Status                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Tier-2 rendering ambiguity | **Closed** — Law of Rendering (§1), structurally enforced                                   |
| Named-only types           | **Closed** — full definitions (§2)                                                          |
| Zero concrete examples     | **Closed** — hero triad, real document, real transactions (§3–§5)                           |
| Naming                     | **Decided** — `@repo/builder-*` now; `@crafterkit` reserved; license = release blocker only |
| Backend involvement        | **None** — memory adapters only until graduation                                            |

The plan is now complete. Open Claude Code on Fable 5, paste Structure §6 + the §7 amendment, and
start B0.

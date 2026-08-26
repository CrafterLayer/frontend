# Data Model: Builder B2b Drag Editing

All shapes are ephemeral view/gesture state; the ONLY durable mutations are single kernel
transactions at commit points. Normative TypeScript lives in
[contracts/builder-drag.md](contracts/builder-drag.md).

## Drag session state machine

```text
idle ──press(payload,x,y)──▶ pending ──move ≥ 4px──▶ active ──release w/ target──▶ committed → idle
  ▲                             │                      │
  │                             └─release (click) ─────┼──▶ idle (selection only, no chrome)
  └──────── cancel / Escape / node-vanished / release w/o target ──────────────────┘ (cancelled)
```

| Field     | Type                                           | Notes                                               |
| --------- | ---------------------------------------------- | --------------------------------------------------- |
| `payload` | `{kind:'move', id}` \| `{kind:'insert', type}` | set at press                                        |
| `origin`  | `{x, y}`                                       | press point (frame-local) for the threshold         |
| `target`  | `DropTarget \| null`                           | re-resolved per move; null = no indicator           |
| `dirty`   | flag                                           | chrome repositioning batched to one flush per frame |

Invariants: active ⇒ hover chrome suppressed; committed ⇒ exactly one dispatch then selection
follows the node; cancelled ⇒ document reference-identical, log length unchanged.

## DropTarget

| Field           | Type              | Meaning                                                                |
| --------------- | ----------------- | ---------------------------------------------------------------------- |
| `parentId`      | `NodeId`          | receiving parent                                                       |
| `slot`          | `SlotName`        | receiving slot                                                         |
| `index`         | `number`          | insertion position (post-removal-adjusted for same-slot forward moves) |
| `indicatorRect` | preview-local box | the gap line the chrome draws                                          |

Existence ⇒ rule-valid (`slotAccepts` passed). Equality with the payload's current position ⇒ the
drop layer skips dispatch.

## Rule gate inputs (slotAccepts)

`allow` list ∋ payload type · `max` (absent = ∞; own-slot move exempt — the node already holds a
seat) · move payloads exclude self and descendants (ancestor check via parent map).

## Palette entry

| Field   | Source                                                          |
| ------- | --------------------------------------------------------------- |
| `type`  | `registry.blocks(surface)[i].schema.type`                       |
| `label` | schema.description → type fallback (same rule as canvas labels) |

Liveness: registry-version subscription (B1 intrinsic counter). Keyboard insert placement: after
selection in its parent slot if accepted, else first accepting slot walking selection → root
(append), else announce-and-nothing.

## Layers row (derived, memoized per document reference)

| Field        | Type                                    | Notes                  |
| ------------ | --------------------------------------- | ---------------------- |
| `id`         | `NodeId`                                | —                      |
| `depth`      | `number`                                | indentation            |
| `expandable` | `boolean`                               | has ordered children   |
| `expanded`   | view state (`Set<NodeId>`, default all) | never document state   |
| `visible`    | derived                                 | ancestors all expanded |

Order: `orderedChildren` (slots in schema declaration order, then array order) — identical to canvas
traversal by construction.

## Keyboard move actions

| Action      | Resolution                                                          | Transaction       |
| ----------- | ------------------------------------------------------------------- | ----------------- |
| `up`/`down` | sibling index ∓ 1, clamped (edge = silent no-op)                    | 1 `moveNode` or 0 |
| `out`       | parent's next-sibling seat in grandparent slot, `slotAccepts`-gated | 1 or 0 + reason   |
| `in`        | append into nearest PRECEDING sibling's first accepting slot        | 1 or 0 + reason   |

## Relationships

```text
Palette ──payload──▶ DragSession ◀──payload── EditorCanvas(pointerdown on wrapper)
DragSession ──resolve(x,y)──▶ drop-resolver ──slotAccepts──▶ registry schemas
DragSession ──commit──▶ kernel.dispatch(moveNode|insertNode) ──▶ store ──▶ canvas/tree/chrome
LayersTree ⟷ kernel.selection ⟷ EditorCanvas outlines/announcer
move-actions ──slotAccepts──▶ (same gate) ──▶ kernel.dispatch(moveNode)
```

# Data Model: Builder B0 Kernel Foundation

Exact type shapes live in [contracts/builder-kernel.md](./contracts/builder-kernel.md) (normative).
This file describes entities, relationships, validation ownership, and lifecycles without
duplicating the type blocks.

## Entity relationship overview

```text
BuilderDocument 1 ── rootId ──► Node
BuilderDocument 1 ── nodes ───► Node *            (flat map by id)
Node 1 ── slots[SlotName] ────► NodeId * (ordered) (exactly-once membership, Law FR-005)
Node * ── type ───────────────► BlockSchema 1      (registry key)
Node * ── bindings[key] ──────► DataPath           (resolution out of scope in B0)
BlockSchema * ◄── contributes ── ExtensionManifest (trusted: schema+render; tier-2: data-only)
Transaction * ── patches/inverse ► Patch *         (immer shape)
Transaction * ── appended ─────► PersistenceAdapter log (seq-ordered)
KernelState { doc, selection, seq } — the only mutable state, sealed behind the facade
```

## Entities and validation ownership

| Entity                    | Owned by                                         | Validated by                                                                                   | Failure codes                                 |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| BuilderDocument / Node    | `builder-schema` `document/types.ts`             | `document/validate.ts` (structural pass — document alone; registry-aware pass — with catalogs) | `doc/*`                                       |
| JsonValue purity          | `builder-schema` `json/json-value.ts`            | `isJsonValue` walk (finite numbers), reused by dispatch and validator                          | `doc/non-json-value`, `doc/non-finite-number` |
| Style intent values       | `builder-schema` `blocks/style-values.ts`        | no-hex/no-px scan over prop values                                                             | `doc/raw-style-literal`                       |
| BlockSchema               | `builder-schema` `blocks/define-block-schema.ts` | JSON-representability of the zod prop schema at definition time                                | `ext/tier2-invalid` (definition-time throw)   |
| ExtensionManifest (union) | `builder-schema` `extensions/manifests.ts`       | tier discrimination by type; tier-2 raw rows via `validate-tier2.ts` structural function walk  | `ext/tier2-executable`, `ext/tier2-invalid`   |
| Widget skin               | `builder-schema` `widgets/validate-skin.ts`      | four-state completeness gate                                                                   | `widget/missing-states`                       |
| Command args              | `builder-core` `commands/*`                      | `RegisteredCommand.apply` parses via the command's zod schema before any state change          | `cmd/invalid-args`, `cmd/unknown`             |
| Structural command rules  | `builder-core` command implementations           | cycle/slot/capacity checks inside the mutator before touching state                            | `cmd/structural-violation`                    |
| Transaction / Patch       | `builder-core` `commands/dispatch.ts`            | patch-value JsonValue walk post-produce (Law J at the door)                                    | `doc/non-json-value`                          |
| Persistence positions     | `builder-core` `ports/persistence.ts` impls      | `expectedSeq` optimistic concurrency                                                           | `persist/seq-conflict`                        |
| Migrations                | `builder-schema` `document/migrations.ts`        | sequential reachability to LATEST, then full validation                                        | `doc/migration-gap`                           |

## Identity & uniqueness rules

- `Node.id`: IdPort-generated, unique within a document, never reused; duplication of membership
  (two parents, two slots, or twice in one slot) is a structural error.
- `Transaction.id`: IdPort-generated, unique within a log.
- Extension `name`: unique within a kernel instance (`ext/duplicate`).
- Block `type`: unique within the catalogs; tier-2 contributions may not shadow an existing type
  (`ext/duplicate`).
- Slot names: unique per node by construction (map keys); `"default"` reserved for ordinary
  children.

## Lifecycles / state transitions

### Document session

```text
(closed) ─ load(docId) ─► migrate v→LATEST ─► validate ─► OPEN { doc, seq }
  │ migration gap / validation failure → LOUD ERROR (never half-open)
OPEN ─ dispatch(command) ─► parse args → produceWithPatches → JsonValue walk →
        append log (coalesced) → history push → scoped notify → OPEN'
OPEN ─ undo/redo ─► apply inverse/forward patches (same internal apply; no new tx) →
        history event → OPEN'
OPEN ─ append(expectedSeq stale) ─► persist/seq-conflict (state + stored log untouched)
```

### Extension

```text
declared ─ register(trusted) ─► deps resolved (topo; cycle → ext/cycle)
        ─► contributions compiled into keyed catalogs (O(1))
        ─► setup(ctx) (may return dispose) ─► ACTIVE
row ─ hydrateDeclarative ─► validate-tier2 (function walk; all-or-nothing)
        ─► same catalogs, indistinguishable lookups ─► ACTIVE
ACTIVE ─ dispose(name) ─► contributions removed + setup teardown ─► gone
```

### History

```text
idle ─ tx applied ─► undo-stack push, redo-stack cleared
undo ─► inverse applied, tx moved to redo stack (empty stack → safe no-op, false)
redo ─► forward applied, tx moved back (empty stack → safe no-op, false)
typing merge: consecutive setProp txs on the same (id, key) within the merge window
collapse into one undo step (window uses ClockPort — deterministic in tests)
```

## Scale assumptions

- Stress fixture: 1,000 nodes (spec SC-005/SC-006); catalogs tested at 10 → 1,000 contributions for
  flat lookup cost.
- Patch log coalescing: persist every N transactions or T seconds (both ClockPort-driven; exact N/T
  fixed in implementation constants and asserted by tests) — typing never awaits persistence.

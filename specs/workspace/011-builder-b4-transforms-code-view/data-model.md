# Data Model: Builder B4 — Transforms and Code View

Nothing here changes what a document IS. B4 adds a second _representation_ of the existing
`BuilderDocument`, plus the small amount of state the panel needs to edit it safely.

## 1. The projected text (canonical JSON)

The projection is canonical strict JSON over the existing document shape — no new document fields.

```
BuilderDocument                       // unchanged, from @craftkit/builder-schema
  schemaVersion  number
  surface        Surface
  dir            'ltr' | 'rtl'
  rootId         NodeId
  nodes          Record<NodeId, Node>   // FLAT — never nested in storage

Node
  id             NodeId                 // stable forever (Law D) — MUST survive the round trip
  type           string                 // registry key
  props          Record<string, JsonValue>
  bindings?      Record<string, DataPath>
  variantOf?     string                 // preserved as an exact string; NOT interpreted in B4
  responsive?    Partial<Record<Breakpoint, Record<string, JsonValue>>>
  slots?         Record<SlotName, NodeId[]>   // ORDER IS SEMANTIC
```

**Canonicalisation rules** (each one exists because a specific failure mode needs closing):

| Rule                                        | Why                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| object keys sorted; two-space indent        | two prints of one document must be byte-identical (second-print idempotence)            |
| slot arrays keep their exact order          | object key order is not semantic; slot order **is**                                     |
| absent optional ≠ present-empty             | `props: {}` and no `props` are different documents (the protobuf field-presence lesson) |
| duplicate keys rejected                     | last-value-wins silently loses data                                                     |
| `-0` canonicalised at the document boundary | verified: `JSON.stringify(-0) === "0"`, so it cannot round-trip (research R2)           |
| node-map key and `node.id` must agree       | a mismatch is a corrupt document, not a repairable one                                  |

**Two validity rules the review round added** (contract §4.9). Both narrow what a document may HOLD
so that everything a document holds can also be WRITTEN — a value the patch door refuses makes the
round-trip law false for any document containing it:

| Rule                                                             | Enforced at                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| every stored JSON value nests at most `MAX_JSON_DEPTH` (**128**) | Law J walk → `doc/non-json-value`, kind `max-depth`    |
| `__proto__`, `constructor`, `prototype` are not object keys      | Law J walk → `doc/non-json-value`, kind `reserved-key` |
| …nor node-map keys                                               | document validator → `doc/reserved-node-id`            |

The strict parser keeps its own ceiling of 256 as a safety margin; no valid document can reach it.

## 2. Scoped projection envelope

Selecting a block scopes the text to that subtree. It is **not** an id-free pretty tree — it is a
versioned envelope over the same flat model, so scoped text obeys the same laws as whole-document
text.

```
ScopedProjection
  envelope     1                       // version; refuse anything else
  rootId       NodeId                  // the selected node
  nodes        Record<NodeId, Node>    // that node plus its descendants, flat
```

Everything outside the envelope must be byte-identical after a scoped edit (the scope-isolation
gate).

## 3. Parse result

Already declared in `ProjectionDef` since B0; B4 is its first consumer.

```
parse(text, doc, ports: ProjectionPorts, scope?)                 // ports added by the review round

ProjectionPorts
  blockExists(type: string): boolean    // the CALLER owns the registry and answers this

ParseResult =
  | { ok: true;  patches: Patch[] }                              // apply as ONE transaction
  | { ok: false; errors: { line: number; message: string }[] }   // line is ONE-BASED
```

`ports` exists because inferring the vocabulary from the base document refuses a REGISTERED block
type the document has not used yet (contract §4.6). The codec still imports no registry.

Invariants: `ok: false` produces **zero** document change. `ok: true` with an empty `patches` array
is a _vacuous_ result and is treated as "nothing to apply" — the non-vacuous gate exists precisely
so a parser that always returns `[]` cannot pass CI.

## 4. Registry addition (layer 0 contract, layer 1 implementation)

Verified gap: `RegistryRead` has **zero** occurrences of `projections` today, so `ProjectionDef` has
been declared since B0 and never reachable.

```
RegistryRead
  projection:  (id: string) => ProjectionDef | undefined
  projections: () => readonly ProjectionDef[]
```

Same laws as the other typed points: registration order decides, duplicate ids are rejected
all-or-nothing, and disposal removes them.

## 5. Panel state (view state — never stored)

```
CodeViewState
  scope        { kind: 'document' } | { kind: 'node'; nodeId: NodeId }
  baseRevision number        // the document revision the draft was projected from
  draft        string        // what the author has typed
  status       'clean' | 'typing' | 'invalid' | 'conflict' | 'busy'
  errors       { line: number; message: string }[]
```

**The draft is pinned to `{scope, baseRevision}`.** If the selection moves or the document changes
underneath a _dirty_ draft, the panel reports `conflict` and applies nothing — it never retargets
typed text at a different node. A _clean_ draft may follow the selection freely.

## 6. Worker protocol (serializable only)

```
Request   { operation: 'project' | 'parse', requestId, generation, baseRevision, scope, projectionId, payload }
Response  { requestId, generation, result: ProjectionText | ParseResult | ProtocolError }
```

**Functions never cross.** `ProjectionDef` holds `project`/`parse` as functions, which cannot be
structured-cloned; the worker owns the implementation locally and is addressed by `projectionId`.
Only serializable descriptors travel.

A response applies only when its `generation`, `baseRevision` and `scope` all match the current
state. `generation` increments on INPUT, not when a request starts — otherwise two results that
become valid in quick succession can apply out of order.

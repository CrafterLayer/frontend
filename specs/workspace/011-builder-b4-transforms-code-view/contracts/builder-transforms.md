# Contract: Builder B4 — Transforms and Code View

Normative. Where this contract and any other document disagree, this wins.

## 1. The codec (`@craftkit/builder-transforms`, layer 2)

```ts
export interface ProjectionText {
  text: string;
}

export interface CodecPorts {
  /** Registry-backed block lookup; the codec never imports the registry itself. */
  blockExists: (type: string) => boolean;
}

/** Whole document, or one node's subtree as a versioned envelope. */
export function projectDocument(doc: BuilderDocument): ProjectionText;
export function projectScope(doc: BuilderDocument, nodeId: NodeId): ProjectionText;

/** Parse-back. NEVER partial: either every patch, or every error. */
export function parseDocument(text: string, base: BuilderDocument, ports: CodecPorts): ParseResult;
export function parseScope(
  text: string,
  base: BuilderDocument,
  nodeId: NodeId,
  ports: CodecPorts,
): ParseResult;
```

**c1. Canonical output.** Object keys sorted, two-space indent, slot arrays in document order, `\n`
line endings, no trailing whitespace. Two projections of one document are byte-identical.

**c2. Total, never throwing.** `text` arrives as `unknown` from a human. Malformed input produces
`{ ok: false, errors }`, never an exception — the same tolerance law the rest of the builder obeys.

**c3. One-based lines.** Every error carries the line that caused it, counted from 1, pointing at
the offending token — not at the end of the document.

**c4. Duplicate keys are an error**, not last-value-wins.

**c5. Identity is preserved, never invented.** Node-map keys and `node.id` must agree; a mismatch is
an error. B4 does **not** allocate ids: text describing a new node must carry its id.
(`ProjectionDef` has no id-allocation contract; adding one is a later, deliberate change.)

**c6. Presence is data.** An absent optional field and a present-empty one are different documents
and must survive as they were.

**c7. Scope isolation.** A scoped parse may only produce patches inside the named subtree. Every
node and slot relationship outside it is byte-identical afterwards.

**c8. Nothing is silently omitted.** US1/AC4 asks that content with no textual form be said
explicitly rather than dropped. Canonical JSON gives EVERY field of the document model a textual
form, so the criterion is discharged by the round-trip law itself rather than by a separate
"unrepresentable" marker: `parse(project(d)) ≡ d` is exactly the claim that nothing was lost, and it
is proven over generated documents, not examples. A future projection that cannot carry some field
must introduce that marker before it may register — the gate is the same one, and it will fail.

## 2. The round-trip law (merge-blocking)

For any document `d` the registered vocabulary can produce:

```
parse(project(d)) reproduces d exactly                    // pure codec
project(parse(project(d))) === project(d)                 // second-print idempotence
```

and, so the law cannot be satisfied vacuously, for generated `base ≠ edited`:

```
parse(project(edited), base) yields ≥ 1 patch AND applying it produces exactly `edited`
```

**Generation is registry-directed.** Blueprints are built from the _registered_ blocks — allowed
child types per slot, capacities respected, props from each block's real schema, bindings only from
declared vocabulary — then flattened. Generating arbitrary JSON and filtering by the validator is
forbidden: it proves nothing about what an author can build, and its shrinking produces orphans and
duplicate ids that hide the real counter-example behind a validation error. Shrinking happens at
blueprint level.

Every minimised counter-example is committed as a named fixture with its seed. A single failure
fails the workspace verification.

## 3. The worker boundary (`code-view` extension, layer 4)

```ts
interface TransformRequest {
  operation: 'project' | 'parse';
  requestId: number;
  generation: number; // increments on INPUT, not when a request starts
  baseRevision: number;
  scope: { kind: 'document' } | { kind: 'node'; nodeId: NodeId };
  projectionId: string; // resolved LOCALLY inside the worker
  payload: string | null;
}
```

**w1. Functions never cross.** `ProjectionDef` holds functions, which cannot be structured-cloned.
The worker imports the transforms package downward and resolves the projection by id; only
serializable descriptors travel. Proxying the functions would run them on the thread they came from
and defeat the whole requirement.

**w2. Stale results are dropped, not applied.** A response applies only if `generation`,
`baseRevision` and `scope` all still match. At most one in-flight request plus one coalesced latest.

**w3. Cancellation is honest.** `postMessage` queues on the recipient's event loop; a cancel message
cannot interrupt a parse already running. Request ids suppress stale _application_. B4 claims
nothing more.

**w4. The document crosses once per revision**, the text once per debounce. Cloning the whole
document per keystroke is a defect with its own counted gate.

**w5. Injectable and counted.** jsdom has no real Worker, so the client accepts a `WorkerLike`.
Counted: posts, responses, stale drops, teardown, applications. One REAL browser gate proves the
module worker actually runs — a fake port cannot prove thread placement.

**w6. Failure is contained.** `error`, `messageerror` and termination each reject every pending
request exactly once, clear the busy state, keep the draft and the document, and return the listener
count to zero.

## 4. The panel (`CodeViewPanel`, `CodeViewErrors`)

**p1. One transaction per applied edit**, through the same kernel door as every other edit; one undo
reverses it.

**p2. Invalid text changes nothing.** Zero transactions, canvas untouched, the draft retained
exactly as typed.

**p3. Debounced.** A burst of typing produces at most one applied change, counted.

**p4. A dirty draft is pinned** to `{scope, baseRevision}`. If the selection moves or the document
changes underneath it, the panel reports a conflict and applies nothing. A clean draft may follow
the selection.

**p5. Door refusals surface.** A parse that produces a document the kernel refuses is reported with
its reason, control-adjacent, and changes nothing.

**p6. Accessible by construction.** A labelled textbox with `aria-invalid` and a stable
`aria-describedby`; errors are a list, and choosing one focuses the textarea and selects that line.
One settled announcement per parse — never one per error. Line numbers, if drawn, are `aria-hidden`.
Real Tab traversal is proven in Chromium.

**p7. Pay-per-use.** The panel implementation and the worker load only on first open; the loader
invocation count is 0 for sessions that never open it.

## 4.5 Two contribution points finished, not one

The plan named `projections` as the point B4 activates. Implementation found a second one in exactly
the same state: **`panels` had been declared since B0 and was equally unreachable** — `RegistryRead`
exposed no `panel`/`panels` lookup, so a contributed panel sat in the registry's opaque bucket where
nothing could resolve it.

That is not scope creep; it is the same task. T021 requires "ONE lazy panel contribution", and a
contribution nobody can look up is not a contribution. Both points are now finished identically to
`inlineEditors` in B3c:

```ts
registry.projection(id)          registry.panel(id)
registry.projections()           registry.panels(slot?)
```

Same laws for both: registration order decides, duplicate ids are rejected all-or-nothing (the
clashing manifest leaves _nothing_ behind, not even its valid blocks), disposal removes them, and
the contribution carries a `load()` — never an implementation — so registering a panel costs nothing
until it is opened (SC-006).

**Why this matters beyond B4**: `panels` is how every future surface arrives — the AI assistant
(B5), the widget library (B6), the import and history panels (B7). B4 is the milestone that made
that road exist.

## 4.6 The vocabulary a projection may consult (review correction)

`ProjectionDef.parse` originally received only the text and the base document, so the code-view
manifest had nothing to answer "is this block type registered?" with except the document's own
contents. That fails the wrong way round: a type the registry **knows** but the document has not
used yet was reported as unregistered, refusing a legal edit.

The point now hands the parser exactly one question, and the caller — who owns the registry —
answers it:

```ts
interface ProjectionPorts {
  blockExists(type: string): boolean;
}
parse(text, doc, ports: ProjectionPorts, scope?): { ok: true; patches } | { ok: false; errors }
```

The codec still imports no registry (§1); the worker path already carried the full registered
vocabulary in its snapshot, so this only aligns the contributed path with it.

## 4.7 One editing surface at a time (spec edge case 7)

The code view is a second way to edit the same node, so opening it while an inline edit is live
would leave two editors over one document. The canvas therefore hands its host a narrow control —
ask whether a session is open, and end it:

```ts
interface CanvasInlineEditHandle {
  isEditing(): boolean;
  end(): void; // idempotent; closes WITHOUT dispatching, exactly as Escape does
}
```

Deliberately not `begin` (starting an edit is a canvas gesture) and deliberately not a
commit-or-cancel choice. Because `end` never dispatches, opening the code view still records zero
transactions (FR-012). Proven for the built-in rich surface AND a contributed editor in jsdom, and
end-to-end in Chromium where the action bar can actually anchor.

## 4.8 Escape leaves, and names where focus goes

Every editing surface in this builder is escapable; the code view is not an exception. The host
keeps ONE control across both states (`aria-expanded`) rather than swapping the trigger for a status
element — swapping destroys the focused node and drops a keyboard user on `<body>`. Escape inside
the panel closes it and returns focus to that control.

Gates on this must name the destination. `expect(x).not.toHaveFocus()` passes when focus fell to
`<body>`, which is the defect itself; the browser gates assert the exact element.

## 4.9 One accepted domain, one applicable domain

Two holes in the round-trip law had the same shape: a document the kernel ACCEPTS whose projection
parses back into patches the kernel REFUSES. `parse(project(d))` cannot reproduce such a `d`, so the
merge-blocking law was false for it and only the generators' failure to produce those documents hid
the fact.

- **Depth.** `isJsonValue` admitted unbounded nesting while the scanner stopped at 256, so a valid
  document ~253 levels deep failed to parse its own projection. Fixed by one exported
  `MAX_JSON_DEPTH = 128` enforced in the Law-J walk — a deeper value is now INVALID at the door,
  with a typed error and an exact path. The scanner keeps 256 as a parser-only margin, now
  unreachable from any valid document, and the generators reach the limit exactly.
- **Reserved keys.** `__proto__`, `constructor` and `prototype` were legal as node ids and prop
  keys, but the patch door refuses them as path segments — so such a document could be read and
  never written. Law J now refuses them as object keys and the validator refuses them as node ids
  (`doc/reserved-node-id`).

The discipline generalises: whenever the door refuses something, the validator must refuse it too,
or the round-trip law is quietly false. Both fixes narrowed the ACCEPTED domain rather than widening
the applicable one, because widening means teaching the door to write keys that poison prototypes.

The generators are part of the law, not decoration. `fast-check` deliberately biases string
generation toward prototype-poisoning words, so `nodeIdArbitrary` produced `constructor` on its own
and broke the generated-document validity ASSERTION the moment reserved ids became invalid — which
is exactly what that assertion (validation as assertion, never as filter) exists to do.

## 5. Counted proof matrix

Every gate counts. None times.

| Law                    | Counted assertion                                                       |
| ---------------------- | ----------------------------------------------------------------------- |
| Round trip             | property suites in §2, 1,000 cases per principal law                    |
| One transaction        | transaction count +1 per applied edit; undo depth +1                    |
| Invalid never mutates  | transaction count +0 over every prefix truncation of a valid projection |
| Debounce               | applications ≤ 1 per burst                                              |
| Off the rendering path | projection/parse invocations on the render path = **0**                 |
| Stale drop             | responses applied out of order = 0; final state is the newest           |
| Document transfer      | document messages = 1 per revision, not per keystroke                   |
| Engine containment     | panel loader invocations = 0 unopened, 1 on first open                  |
| Worker liveness        | one real-browser gate proves the module worker runs                     |
| Focus                  | real Tab/Escape in Chromium; one active editing surface                 |

## 6. What B4 deliberately does not do

- Allocate node ids on parse (needs a contract change).
- Interpret `variantOf` (belongs to B6).
- Interrupt a running parse (see w3).
- Offer highlighting, folding, completion or multi-cursor (see research R4 — revisit against a real
  requirement, not a preference).
- Restyle anything: the design milestone follows B4.

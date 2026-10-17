# Research: Builder B4 — Transforms and Code View

**Date**: 2026-08-27 · **Method**: prior-art survey (independent agent, read-only) + coordinator
verification of every claim this plan actually rests on.

## R0. The decisive question: what does "code" mean here?

The survey covered Builder.io (Publish and Fusion), Plasmic, Webflow, Framer, TeleportHQ, Craft.js,
GrapesJS, Puck, Studio.Design, Locofy, Pinegrow, and Google Web Designer. Across all of them the
word "code" turns out to mean one of three different things:

| Meaning                                    | Who ships it                                     | Does it flow back?                                           |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------ |
| **Model JSON** — the document graph itself | Builder.io Publish, Craft.js, Puck               | Yes, as data                                                 |
| **Generated / exported code**              | Plasmic, Webflow, TeleportHQ, GrapesJS, Locofy   | One-way, and explicitly incomplete                           |
| **Code as canonical source**               | Builder.io Fusion, Pinegrow, Google Web Designer | Yes — but there is no second document graph to disagree with |

**The finding that decides B4**: no surveyed product claims a formal, arbitrary-document lossless
projection. The ones that round-trip do it by making code the ONLY source of truth; the ones with a
second graph either generate one-way or persist JSON. Our spec (FR-003) demands something none of
them promise — a second representation that provably cannot drift.

That is not a reason to back off. It is a reason to pick the form with the smallest gap between
"editable" and "provably lossless", and to make the proof the centre of the milestone.

## R1. Textual form — canonical strict JSON

**Decision**: canonical two-space JSON, sorted object keys, slot-array order preserved exactly.
Scoped projection uses a versioned envelope carrying the selected root id and a flat descendant map,
never an id-free pretty tree.

**Why not the nicer-looking options.** Every alternative breaks on the same rock — **node
identity**. Our ids are stable forever (Law D) and are referenced by slots and `variantOf`. A
JSX-like or indentation DSL that hides ids forces parse-back to invent them, and the round trip
fails by construction. Carrying ids in a JSX-like form produces `<Node id="…" type="…">` with JSON
blobs for `bindings` and `responsive` — noisier than the JSON it was trying to beat. YAML needs
aliases, anchors, tags, merge keys and scalar coercion all banned before it is safe, which is JSON
with extra rules. MDX cannot express named slots, bindings or responsive overrides without becoming
JSX anyway.

**The cost, stated plainly**: authors edit the document model, not attractive source. Slot
reordering means moving ids between arrays. This is the honest trade for FR-003, and a friendlier
projection can be added later behind the same contribution point — but it must pass the identical
gate first.

## R2. A verified defect this milestone must fix first (`-0`)

The research flagged it; the coordinator confirmed it by execution:

```
Number.isFinite(-0)  → true       // packages/builder/schema/src/json/json-value.ts accepts it
JSON.stringify(-0)   → "0"        // the projection loses the sign
Object.is(JSON.parse(JSON.stringify(-0)), -0) → false
```

So `-0` is storable today and **cannot survive any JSON projection**. FR-003 is unachievable until
this is closed. B4 canonicalises `-0` at the document boundary rather than teaching the printer to
preserve it — a value no author can intend is not worth a special case in every future projection.

## R3. Proving the round trip — what mature systems actually do

Prettier checks AST equivalence and second-format idempotence as two _separate_ oracles. rustfmt
re-formats its own output and self-formats its source. ProseMirror builds documents through
schema-aware builders, not arbitrary JSON. Protobuf specifies field presence separately because
absent and present-empty are not interchangeable. serde_json keeps concrete float failures found by
QuickCheck as permanent fixtures.

The pattern is never one clever property. It is: **schema-aware generation + semantic equality +
second-print idempotence + malformed-input fuzzing + retained regressions.**

**Generation must be registry-directed, not filtered.** Generate a valid blueprint from the
_registered_ block vocabulary — allowed child types per slot, capacities respected, props from each
block's real schema, bindings only from declared vocabulary — then flatten it. Generating arbitrary
JSON and filtering by the validator would prove nothing about what authors can build, and shrinking
would produce orphans and duplicate ids that hide the original failure behind a validation error.
Shrink at blueprint level (drop subtrees, shorten slots, shrink props) so counter-examples stay
valid.

**What a naive `project → parse → deepEqual` misses**, and therefore what the gates must add:

- a parser that returns `[]` patches always (vacuously "lossless")
- unstable key order or whitespace between two prints of the same document
- absent vs present-empty optional maps
- `-0`, exponent spellings, safe-integer boundaries
- Unicode normalisation (NFC/NFD), emoji, lone surrogates
- regenerated ids under a hierarchy that still looks right
- a forgotten `schemaVersion`, `surface`, `dir` or `rootId`

## R4. Code editor — none, deliberately

| Option              |                                                  Dependency cost | What it buys                                                                                       |
| ------------------- | ---------------------------------------------------------------: | -------------------------------------------------------------------------------------------------- |
| Native `<textarea>` |                                                         **0 KB** | native editing, clipboard, IME, selection, mobile, screen-reader semantics, ordinary Tab traversal |
| CodeMirror 6        |   ~250 KB min / **75 KB gzip** minimal; ~400/135 with a language | gutters, highlighting, folding, search, decorations, virtualisation                                |
| Monaco              | measured full integration **~846 KB gzip** JS plus worker assets | VS Code-grade everything                                                                           |

Our spec requires display, edit, per-line errors, and debounce. It requires no highlighting,
folding, completion, or multi-cursor. A labelled textarea with `aria-invalid`, a stable
`aria-describedby`, and a line-numbered error list that focuses the textarea and selects the
offending line satisfies every requirement at zero dependency cost — and is natively usable with a
screen reader, which the repo gates at error level.

**Decision**: textarea. Revisit only when a listed capability becomes a requirement or a
maximum-size document fixture demonstrates a real failure. Monaco is disproportionate for B4.

## R5. Worker RPC — handwritten, and a structural reason why

Comlink is small (~1.2 KB gzip) and provides promise-shaped proxying over `postMessage`. It does
**not** provide per-call cancellation, stale-result protection, document revisioning, or scope
conflict handling — which is all of what we actually need.

**The structural blocker is bigger than size.** `ProjectionDef` holds FUNCTIONS (`project`,
`parse`), and functions cannot be structured-cloned. Proxying them with Comlink would call them back
on the thread they came from — defeating the entire point of FR-009. Therefore the worker must own
the transform implementation locally and be addressed by **projection id**; only serializable
descriptors cross the boundary.

**Cancellation, said precisely**: `postMessage` queues work on the recipient's event loop, so a
cancel message cannot interrupt a parse already running. Request ids suppress _stale application_;
true interruption needs cooperative checkpoints or terminating the worker. The plan must not claim
otherwise.

**Testability**: jsdom has no real Worker, so the client is injected (`WorkerLike`) and every
interesting event is counted — posts, responses, stale drops, teardown, applications. One real
browser gate proves the module worker actually runs, because a fake port cannot prove thread
placement. B3c already taught this lesson in the sharpest possible way (§19: a programmatic
`.focus()` left every unit test green while the real tab order was broken).

## R6. Verified repository gaps this milestone must close

Confirmed by the coordinator, not taken on report:

1. **`RegistryRead` has no projection lookup** — zero occurrences of `projections` in
   `contribution-points.ts`. `ProjectionDef` has been declared since B0 and never wired. B4 finishes
   the contribution point rather than bypassing it.
2. **`ProjectionDef.parse` has no id-allocation contract.** B4 therefore requires explicit ids for
   newly typed nodes; inventing them is a later, deliberate contract change.
3. **`-0` is storable and unprojectable** (R2).

## R7. The trap list, ordered by how late it would be found

Each entry names the symptom an author sees and the COUNTED gate that catches it — no timing gates.

| #   | Trap                                          | Author-visible symptom                                                  | Counted gate                                                                                                       |
| --- | --------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | dirty scoped draft follows a new selection    | text typed for A applies to B, or resurrects deleted A                  | pin drafts to `{scope, baseRevision}`; dirty A → change selection → resolve: zero applications, one conflict state |
| 2   | ids omitted or regenerated                    | selection jumps, history references break                               | property-test exact `rootId`, map keys, `node.id`, slot refs, `variantOf`                                          |
| 3   | two debounce results resolve out of order     | canvas shows the new state then reverts; duplicate history              | fake worker resolves N+1 before N: exactly one application, final state N+1                                        |
| 4   | vacuous round trip / bypassed door            | CI green while parse returns nothing; one edit makes several undo steps | generated `base ≠ edited`, non-empty patches, exactly one transaction and one undo                                 |
| 5   | functions cannot cross to the worker          | `DataCloneError`, or transforms silently run on the UI thread           | real module-worker smoke; zero functions cross; loader count 0 before open, 1 after                                |
| 6   | whole document cloned per keystroke           | large-document typing stalls, memory grows                              | count snapshots, message bytes, node visits: document once per revision, text per debounce                         |
| 7   | "cancellation" only discards results          | obsolete parses queue; late errors                                      | burst during an active parse: at most one active + one coalesced, zero stale applications                          |
| 8   | partial invalid text mutates or floods AT     | canvas disappears mid-brace; screen reader repeats every error          | every prefix truncation: zero transactions, canvas unchanged, draft retained, one settled announcement             |
| 9   | canonicalisation changes data                 | a no-op code view alters optional maps, Unicode, numbers                | fixed table: absent/empty, `-0`, exponents, NFC/NFD, emoji, escapes; exact codec + second-print equality           |
| 10  | stale worker vocabulary                       | new blocks rejected; removed types still accepted                       | version the vocabulary snapshot; (un)registration invalidates it                                                   |
| 11  | duplicate or hostile keys                     | one value silently wins; `__proto__` phantom lookups                    | reject duplicate keys; reserved-key fixtures; own-property or null-prototype maps                                  |
| 12  | worker crash leaves stuck UI                  | "Checking…" never clears; duplicate listeners on reopen                 | inject `error`/`messageerror`/termination: every pending request rejects once, listeners return to zero            |
| 13  | code view fights inline editing / focus order | two surfaces overwrite each other; keyboard trap                        | real Chromium Tab/Escape: one active surface, zero unintended transactions                                         |
| 14  | lazy feature leaks into initial bundle        | users pay for a panel they never open                                   | import count 0 unopened / 1 on first open + bundle-diff gate                                                       |

## R8. Four things the plan locks before implementation

1. `-0` is canonicalised at the document boundary (R2).
2. Dirty scoped drafts pin their scope and report a conflict rather than retargeting (trap 1).
3. Worker implementations resolve locally by projection id; functions never cross (R5).
4. B4 adds **no dependencies** — textarea and handwritten typed RPC. Admitting an editor or an RPC
   library later requires a measured decision against a real requirement, not a preference.

## R9. Residual uncertainty

- Monaco's exact minimal 0.56 JSON build was not measured in this repo; the figure quoted is a real
  reported integration, not a floor. This does not affect the decision — the gap to a textarea is
  three orders of magnitude — but it should not be quoted as a minimum.
- `variantOf`'s referential semantics are underspecified in the current schema. B4 preserves it as
  an exact string and does not interpret it; clarifying it belongs to B6 (widgets).
- Whether a scoped projection should be able to CREATE nodes (not just edit existing ones) is
  deliberately deferred: B4 requires explicit ids, so creation works, but ergonomics are poor. A
  later id-allocation contract is the fix.

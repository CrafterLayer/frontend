# @craftkit/builder-transforms

The codec between a builder document and its canonical textual form: `project` writes a document (or
one node's subtree) out as strict two-space JSON; `parse` reads text back into patches or per-line
errors — never a partial application. Fully headless — no DOM, no React, no kernel, no registry
implementation; every behavior is verified in a node environment.

Normative source:
[`specs/workspace/011-builder-b4-transforms-code-view`](../../../specs/workspace/011-builder-b4-transforms-code-view/contracts/builder-transforms.md)
(§1 the codec, §2 the round-trip law). Layer 2 of the builder dependency law (ADR 0003) — depends
only on `@craftkit/builder-schema`. The shell may never import this package; the code-view
extension's WORKER is its one consumer above layer 2, and functions never cross that boundary.

## Public API (`@craftkit/builder-transforms`)

- `projectDocument(doc)` / `projectScope(doc, nodeId)` → `ProjectionText` — canonical output: sorted
  object keys, two-space indent, `\n` endings, slot-array order preserved (slot order IS semantic;
  key order is not), absent optional ≠ present-empty. Two projections of one document are
  byte-identical.
- `parseDocument(text, base, ports)` / `parseScope(text, base, nodeId, ports)` → `ParseResult` — all
  patches or all errors; every error carries a ONE-based line pointing at the offending token;
  duplicate keys are an error, not last-value-wins; node-map key and `node.id` must agree (ids are
  never invented); a scoped parse may only patch inside the named subtree.
- `projectSite(site)` → `SiteProjectionText` — the SITE codec: a manifest, plus one text per page
  and per shared region. `projectSite(s).pages[id]` is byte-for-byte what `projectDocument` produces
  for that page's document, so the two codecs cannot drift. `parseSite` reads a whole bundle back;
  `parseSiteManifest` reads the manifest ALONE and takes no ports, because it reads no document and
  therefore cannot create a page or a region — only the bundle can. A `siteVersion` a text tries to
  move is refused with a line number: the migrations own it.
- `CANONICAL_JSON_PROJECTION_ID` / `SITE_MANIFEST_PROJECTION_ID` — the ids these codecs register
  under. It lives here so the worker (which resolves projections locally) and the manifest (which
  registers with the kernel) cannot drift apart. The worker holds ONE base artifact at a time — a
  document or a site — and a scope that does not match the artifact it holds is answered
  `scope-mismatch` rather than guessed at.
- `CodecPorts` — `blockExists(type)`: the registry stays on the other side of a function the CALLER
  provides; the codec never imports it. The contributed `ProjectionDef.parse` receives the same
  question as `ProjectionPorts`, because inferring the vocabulary from the base document refuses a
  REGISTERED type the document has not used yet.

## What a document may hold, and why it matters here

The codec is where two domains have to agree. A document the kernel ACCEPTS whose projection parses
back into patches the kernel REFUSES makes `parse(project(d)) ≡ d` false for that document — the law
would be quietly wrong and only the generators' silence would hide it. Two such gaps existed and are
closed in `@craftkit/builder-schema`, not here:

- **Depth.** `MAX_JSON_DEPTH = 128` bounds every stored JSON value. The strict scanner keeps its own
  ceiling of 256 purely as a parser-safety margin; no valid document can now reach it, and a named
  test proves that. Before this, `isJsonValue` admitted unbounded nesting while the scanner stopped
  at 256, so a valid document ~253 levels deep failed to parse its own projection.
- **Reserved keys.** `__proto__`, `constructor` and `prototype` are refused as object keys and as
  node ids (`doc/reserved-node-id`). The kernel's patch door rejects them as path segments, so a
  document holding one could be read and never written back.

The parser stays hostile-input-safe regardless (own-property walks, null-prototype maps): refusing
such text **per line** is the behaviour, never trusting it. And the generators are part of the law —
`fast-check` biases toward prototype-poisoning words, so `nodeIdArbitrary` filters them explicitly
rather than by luck.

## `@craftkit/builder-transforms/testing`

Registry-directed `fast-check` generators for the round-trip proof: a valid recursive blueprint is
generated from a REGISTERED vocabulary (allowed child types per slot, capacities, props from real
block schemas), then flattened — never arbitrary JSON filtered by the validator, which would prove
nothing about what authors can build and whose shrinking hides real counter-examples behind
validation failures. Shrinking happens at blueprint level so counter-examples stay valid documents.

## The round-trip law (merge-blocking)

For any document the registered vocabulary can produce — 1,000 generated cases per law, fixed seeds,
minimised counter-examples retained as fixtures in `src/codec/__fixtures__/`:

```
parse(project(d))            reproduces d exactly          (pure codec)
project(parse(project(d)))   === project(d)                (second-print idempotence)
base ≠ edited                ⇒ ≥1 patch, applying ⇒ edited  (NON-VACUOUS — a parser
                                                            returning [] forever must fail)
```

plus key-order metamorphism, scope isolation, prefix-truncation error sweeps, and field mutants
(ids, slot order, bindings, breakpoints, `variantOf`, envelope) — each detected by a named test.

Why this shape: no surveyed builder (research R0 — Builder.io, Plasmic, Webflow, Framer, Craft.js,
GrapesJS, Puck, …) claims a formal lossless projection over a second document graph. The ones that
round-trip make code the only source of truth. This package is what makes a second representation
safe: the proof is the feature.

## Development

```bash
pnpm --filter @craftkit/builder-transforms lint
pnpm --filter @craftkit/builder-transforms typecheck
pnpm --filter @craftkit/builder-transforms test
```

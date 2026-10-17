# Research: Professional Builder and Agent

## Decision 1: Extend the site kernel instead of creating a code-side store

**Decision**: The site remains the only mutable artifact. Authored source is part of the site and
all source changes use revision-checked site transactions.

**Rationale**: The existing page lens, history, persistence, and one-undo behavior remain valid.

**Alternatives considered**: A separate file store was rejected because it creates split history,
torn saves, and ambiguous undo.

## Decision 2: Keep `SitePage.document` with a root `codePage`

**Decision**: A code-backed page is still an independently valid document containing exactly one
root `codePage` node that references a site-owned authored project and entry module.

**Rationale**: This is the smallest compatible extension to the existing page-lens contract.

**Alternatives considered**: A discriminated `SitePage.content` union was rejected because it
duplicates page plumbing and forces existing consumers to branch everywhere.

## Decision 3: Source is authoritative; artifacts are derived

**Decision**: Persist source even when it is temporarily invalid. Compile artifacts, source maps,
screenshots, and prerender output are content-addressed derivatives.

**Rationale**: Manual editing cannot be reliable if syntax errors cause data loss. Revision-pinned
artifacts prevent stale preview and export.

## Decision 4: One isolated page frame, not one frame per section

**Decision**: Render each code-backed page inside one cross-origin preview application. The frame
receives immutable artifacts and a narrow validated bridge.

**Rationale**: Page-level state, layout, routing, and interactions must work together. Section-level
frames break CSS, state, and document flow.

## Decision 5: Build workers are separate from the main AI request process

**Decision**: `ai-server` supervises killable compiler/prerender workers supplied by the runtime
package. Generated source does not execute in the primary request process.

**Rationale**: Cancellation, timeouts, resource cleanup, and secret isolation need a process
boundary. An iframe alone is not a CPU or build isolation mechanism.

## Decision 6: Managed dependencies are build artifacts

**Decision**: The existing shadcn, Magic UI, Aceternity, Motion, Radix, and icon extensions publish
pinned runtime-compatible catalog artifacts through the Builder facade. The layer-2 runtime consumes
a port and never imports higher-layer extensions.

**Rationale**: This preserves the repository dependency law and lets generated code use ordinary
React interfaces rather than internal block renderer contracts.

## Decision 7: AST identity governs visual source editing

**Decision**: Instrument compiled output with stable AST node ids and optional instance keys. Visual
patches support literal text, attributes, class lists, styles, declared props, and declared editable
data. Unsupported dynamic DOM exposes source editing instead of guessed conversion.

**Rationale**: Rendered text search and line-number addressing are unsafe after normal edits.

## Decision 8: CodeMirror 6 is the code-surface engine

**Decision**: Replace the production textarea surface for authored source with lazy-loaded CodeMirror
6 modules for TSX/JS/CSS/JSON, diagnostics, search, completion, and source navigation.

**Rationale**: It is modular and supports custom completion and lint sources while preserving the
existing pay-per-use boundary.

## Decision 9: Pages use stable identities for generated links

**Decision**: Generated internal navigation stores stable page references and resolves addresses at
preview/export time. Literal user URLs remain strings and receive separate diagnostics.

**Rationale**: Renaming a page address must not require fragile source-wide text replacement.

## Decision 10: Durable and session-only save states are different

**Decision**: Persistence returns an acknowledgement that identifies durable IndexedDB storage or
session-only fallback. The UI says Saved only for durable acknowledgement and offers download in
session-only mode.

**Rationale**: The current fallback intentionally keeps working in memory, but presenting it as a
durable save would be incorrect.

## Decision 11: Progressive preview commits recoverable draft units

**Decision**: The Agent writes completed, validated units to a run-owned draft journal. A usable
authored section is rendered as soon as it compiles. The live site receives one final transaction.

**Rationale**: This provides real early output and reload recovery without exposing half-built work
as the published site.

## Decision 12: Model routing starts as an experiment

**Decision**: Candidate routing maps low-volume context work to Luna, regular code work to Terra,
design direction and critique to Sol, and one difficult escalation to Astra, subject to provider
capability checks and eval results.

**Rationale**: Model names and prices do not prove the cheapest accepted output. Accuracy is measured
first, then cost and latency are optimized without losing it.

## Decision 13: Four independent caches

**Decision**: Separate provider prompt caching, relevant-context indexing, source build caching, and
managed-component caching. Cache metrics never stand in for context-reduction metrics.

**Rationale**: Each cache has different invalidation and cost behavior. A single generic cache would
hide misses and stale-data risks.

## Decision 14: Shipping follows observable vertical slices

**Decision**: Deliver runtime contracts and one complete code-page slice before broad UI and
multi-agent expansion. Each later milestone remains independently demonstrable.

**Rationale**: The hard risk is integration between source, selection, persistence, preview, and
export. Solving isolated foundations first would not prove the product.


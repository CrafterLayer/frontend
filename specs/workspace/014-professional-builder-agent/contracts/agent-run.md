# Agent Run Contract

## Modes

- Ask returns explanation only.
- Plan returns a target and proposed operations without mutation.
- Auto creates a recoverable draft, streams validated units to preview, and commits only a checked
  final revision.

## Tools

`get_project_index`, `get_selection_context`, `resolve_component`, `edit_element`,
`apply_module_patch`, `insert_section`, `page_operations`, `compile_preview`, `inspect_preview`, and
`commit_draft` have versioned JSON input/output schemas. Deterministic direct UI commands bypass the
model.

## Scheduling

One active mutating run and one editable queued request are allowed per project. The default fill
concurrency is three and may rise to six only for path-disjoint work and available server capacity.
One worker owns each file. Merging and validation remain ordered.

Every stage and result carries run id and source revision. Stop aborts model, tools, compiler,
prerender, and preview work. A late result from a stopped or stale run is discarded.

Resume creates a successor run with a new run id. The stopped run remains terminal. The successor
restores persisted completed-unit checkpoints, revalidates its captured target and base revisions,
and restarts only interrupted work under the retry limit. Completed units cannot apply twice. Stop
pauses the queued request until explicit continuation. Review outcomes are planned, applied, undone,
rejected, failed, or stopped.

## Routing and usage

Routing policy is versioned and records provider, model, reasoning effort, fallback, attempt, latency,
ordinary/cached/cache-write/output tokens, and unknown values. Initial candidate roles are Luna for
light context/copy, Terra for regular code, Sol for design direction and critique, and one Astra
escalation. The default policy changes only through evaluation.

## Cache boundaries

Stable instructions, tool schemas, runtime contract, and design-system contract precede changing
page and selection context. Provider caching, context indexing, build caching, and component caching
have independent keys, metrics, and invalidation.

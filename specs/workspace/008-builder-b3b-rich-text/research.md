# Research: Builder B3b Rich Text

Decisions with rationale and registry evidence. IDs referenced from plan/tasks.

## R1 — The dependency decision (FR-011): TipTap 3.30.3, four catalog pins

**Decision**: adopt TipTap v3 as the editing engine, pinned exactly:

| Package               | Pin    | Published         | Age at decision (2026-08-26) | Role                                          |
| --------------------- | ------ | ----------------- | ---------------------------- | --------------------------------------------- |
| `@tiptap/react`       | 3.30.3 | 2026-08-24T03:23Z | ~2 days (> 24h policy ✓)     | React bindings (useEditor/EditorContent)      |
| `@tiptap/starter-kit` | 3.30.3 | 2026-08-24        | ✓                            | curated extension set (subset configured OFF) |
| `@tiptap/core`        | 3.30.3 | 2026-08-24        | ✓                            | peer of react/starter-kit                     |
| `@tiptap/pm`          | 3.30.3 | 2026-08-24        | ✓                            | ProseMirror aggregation (peer)                |

All four are same-versioned (the TipTap release train). `minimumReleaseAge: 1440` satisfied. Release
cadence observed: 3.29.0 (07-24) → 3.30.3 (08-24) — active, frequent patches.

**Transitive inventory** (registry-read 2026-08-26):

- `@tiptap/starter-kit` → ~24 `@tiptap/extension-*` packages + `@tiptap/extensions` (all pinned
  3.30.3 internally); `@tiptap/extension-link` additionally pulls `linkifyjs@^4.3.3`.
- `@tiptap/pm` → 13 `prosemirror-*` packages (model/state/view/transform/commands/keymap/
  history/tables/gapcursor/dropcursor/inputrules/schema-list/changeset).
- `@tiptap/react` → `fast-equals@^5.3.3` (zero deps), `use-sync-external-store@^1.4.0` (**already in
  the lockfile at 1.6.0 — dedupes**), `@types/use-sync-external-store`.

**No-downgrade proof**: `grep -c "prosemirror\|@tiptap\|fast-equals" pnpm-lock.yaml` = 0 — the
entire family is NEW; nothing can be downgraded. `use-sync-external-store@1.6.0` satisfies `^1.4.0`
and dedupes. Trust policy unchanged (no lifecycle scripts expected; the install records the final
word).

**Peers**: `react ^17||^18||^19` — react 19.2.8 ✓.

**Rejected alternatives**: vendoring ProseMirror directly (weeks of editor engineering for worse
results — TipTap IS the audited convenience layer); Lexical (React-only ecosystem is younger for
structured JSON contracts, and TipTap was the standing plan decision recorded in the master plan and
the B3a handoff); contenteditable-by-hand (rejected on correctness grounds — the entire industry's
scar tissue argues otherwise).

## R2 — Where the dependency lives: ONE new extension package (FR-005)

`@craftkit/builder-richtext` at `packages/builder/extensions/richtext` (layer 4; the workspace glob
`packages/builder/extensions/*` already covers it). It is the ONLY package declaring the four pins.
Containment is mechanical: the builder-boundaries validator already forbids extension→extension and
non-builder→family edges; the executed negative for B3b is `@craftkit/builder-shell` (layer 3)
declaring `@tiptap/react` — which must fail the boundary/dependency gate. The extension contributes
ONE field type via the standard manifest; the editor component loads through the contribution's
`load()` (lazy by contract), so sessions that never edit rich text never fetch the engine (SC-003).

## R3 — The schema marker (FR-001): zod `.meta()` + shared structural validator

`richText()` in `@craftkit/builder-schema` returns the structural document schema tagged
`.meta({ craftkit: 'rich-text' })`; `isRichTextSchema(schema)` reads the meta through
optional/default wrappers (probe verified: meta survives wrapping via the inner type — the same
unwrap walk resolve-field already does). Matching is by MARKER, not by object identity, so any
package can declare a rich prop without importing the extension.

Structural whitelist (the door law, FR-001): `doc` → block nodes
`paragraph | heading(level 2..4) | bulletList | orderedList`; lists contain `listItem` → block
nodes; inline content is `text` (with optional marks `bold | italic | link{href: string}`) and
`hardBreak`. zod `strictObject` + discriminated unions make unknown node/mark types REJECTED ON
WRITE with path-addressed errors. `emptyRichText()` returns the canonical empty doc (one empty
paragraph). Size limits deferred (recorded in spec edge cases).

## R4 — Zero-dependency rendering (FR-004/FR-009): `RichText` in the renderer

A ~120-line recursive React renderer over the whitelist in
`packages/builder/renderer/src/components/RichText/`: semantic elements (`p`, `h2..h4`, `ul/ol/li`,
`strong`, `em`, `a`), token-based styling, logical properties. Unknown NODE types render their
readable children (text survives); unknown MARK types are ignored (text survives). Works identically
under `DocumentView` (canvas/preview) and `renderStaticMarkup` (it is plain React — parity is by
construction, SC-005 asserts it).

**Href sanitization (SC-004)**: `safeHref()` allows `http:`, `https:`, `mailto:`, relative paths
(`/`, `./`, `#`, `?`); everything else (`javascript:`, `data:`, `vbscript:`, whitespace/control-char
smuggling, protocol-relative `//evil`) renders the link TEXT with no href. Table-driven test.

## R5 — The editor field (FR-002/FR-003): document truth over an owning editor

`RichTextField` (extension package) wraps TipTap `useEditor` with StarterKit configured DOWN to the
whitelist (everything else disabled: code, blockquote, strike, underline, hr, code-block,
gapcursor/dropcursor stay as editing aids but never emit stored nodes) + Link (protocols
restricted). Commit discipline: `onUpdate` → `onChange(editor.getJSON())` — one dispatch per commit
(the B3a TextField law; history typing-merge coalesces). Document truth: on an EXTERNAL value change
(undo/redo/collab — detected by comparing the incoming value against the editor's last emitted
JSON), `setContent` re-seeds the editor; the editor's own emissions never round-trip (no caret
fights) — the B3a draft-base rule adapted to an engine-owned state. Toolbar: real labeled buttons
(Bold, Italic, H2, H3, Bulleted list, Numbered list, Link, Clear formatting) with `aria-pressed`
from editor state.

## R6 — Adoption (FR-006): one new block + fixture

`blocks-marketing` gains `RichTextBlock` (`type: 'richText'`, props `{ content: richText() }`)
rendering through the renderer's `RichText` — zero panel code (US1/AC1). The landing fixture gains
one instance. No existing block schema changes → no migration (Law M untouched).

## R7 — Responsive buckets: BASE ONLY, said out loud

`InspectorRow` under a non-base bucket resolves rich props normally, but B3b does not support
responsive rich values: the field renders base-bucket editing only when `bucket === 'base'`; under
override buckets the row shows the inherited READ-ONLY summary with the existing inherited
semantics. Deferred (spec edge case; recorded in contract). Mechanism: the rich field receives
`path`/`disabled` like any field — the inspector already passes `disabled` for loading; B3b adds
nothing to the row contract (the FIELD checks its path root and renders a notice for override
paths).

## R8 — Proof surfaces (SC-001..007)

Counting only: tx ≡ commits sweeps in extension tests + playground scenario 8; loader invocation
counter (SC-003) via a probe manifest; boundary negative executed+reverted (SC-002) plus an
import-graph grep proving renderer/shell contain no `@tiptap` imports; sanitization table (SC-004);
parity equality (SC-005); Storybook stories for RichText (renderer) and the rich field via Inspector
composition, all under the a11y error gate (SC-006). jsdom caveat: TipTap/ProseMirror require real
DOM APIs jsdom largely provides; anything genuinely layout-bound stays in Chromium play().

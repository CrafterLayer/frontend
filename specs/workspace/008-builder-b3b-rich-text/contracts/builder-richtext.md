# Contract: Builder B3b Rich Text

Normative TypeScript contracts as fenced blocks (001–007 precedent).

## 1. Schema (`@craftkit/builder-schema` — layer 0, zero deps)

```ts
/** Stored form — plain JSON (Law J). The COMPLETE B3b whitelist. */
type RichTextMark =
  { type: 'bold' } | { type: 'italic' } | { type: 'link'; attrs: { href: string } };
type RichTextInline =
  { type: 'text'; text: string; marks?: RichTextMark[] } | { type: 'hardBreak' };
type RichTextBlockNode =
  | { type: 'paragraph'; content?: RichTextInline[] }
  | { type: 'heading'; attrs: { level: 2 | 3 | 4 }; content?: RichTextInline[] }
  | { type: 'bulletList'; content: RichTextListItem[] }
  | { type: 'orderedList'; content: RichTextListItem[] };
interface RichTextListItem {
  type: 'listItem';
  content: RichTextBlockNode[];
}
interface RichTextDoc {
  type: 'doc';
  content: RichTextBlockNode[];
}

declare function richText(): z.ZodType; // structural validator tagged for resolution
declare function isRichTextSchema(schema: z.ZodType): boolean; // reads the tag through wrappers
declare function emptyRichText(): RichTextDoc; // canonical empty: one empty paragraph
// s1. richText() carries meta { craftkit: 'rich-text' }; isRichTextSchema unwraps
//     optional/default/nullable before reading it (the resolve-field walk).
// s2. The validator is STRICT: unknown node types, unknown mark types, heading levels
//     outside 2..4, and non-string hrefs are rejected AT THE DOOR with paths (FR-001).
// s3. Marker matching is by META, never object identity — any package declares rich props
//     without importing the extension.
```

## 2. Renderer (`@craftkit/builder-renderer` — layer 2, zero deps)

```ts
interface RichTextProps {
  /** Unknown shapes are tolerated on READ: render readable text, never crash. */
  value: unknown;
  className?: string | undefined;
}
declare const RichText: ComponentType<RichTextProps>;
declare function safeHref(href: string): string | undefined; // undefined = neutralized
// r1. Semantic output: p, h2..h4, ul/ol/li, strong, em, a; token styling; logical props.
// r2. safeHref allows http:, https:, mailto:, and relative paths; everything else —
//     javascript:, data:, vbscript:, control-char/whitespace smuggling, protocol-relative —
//     returns undefined and the link renders as plain text (SC-004).
// r3. Unknown node type ⇒ its readable children render; unknown mark ⇒ ignored (US2/AC3).
// r4. Parity by construction: plain React, identical under DocumentView and
//     renderStaticMarkup (SC-005 asserts text + structure equality).
```

## 3. Extension (`@craftkit/builder-richtext` — layer 4, NEW MEMBER; the ONLY tiptap owner)

```ts
declare const richTextExtension: TrustedExtensionManifest;
// e1. Contributes ONE field type { id: 'craftkit.rich-text', match: isRichTextSchema→100,
//     load: () => import('./RichTextField') } — lazy BY CONTRACT (SC-003: loader invoked 0
//     times without a rich prop edit; the B3a per-def cache makes it once-only after).
// e2. RichTextField consumes the public FieldProps ONLY (+ optional shell extras). Commit
//     law: onUpdate ⇒ ONE onChange(getJSON()) (FR-003). Document truth: an incoming value
//     that is not the field's own last emission re-seeds the editor (undo/redo/external
//     writes win; own emissions never round-trip into caret fights).
// e3. StarterKit is configured DOWN to the §1 whitelist; the Link extension restricts
//     protocols at input; the DOOR remains the authority (s2) — the editor can never emit a
//     node the door rejects in normal operation, and if it does, the B3a rejection path
//     shows the reason with zero document change.
// e4. Toolbar: labeled buttons (Bold, Italic, Heading 2, Heading 3, Bulleted list, Numbered
//     list, Link, Clear formatting) with aria-pressed reflecting editor state (FR-007).
// e5. Under a non-base bucket the field renders a read-only inherited notice — responsive
//     rich values are DEFERRED (R7; recorded).
// e6. Dependency law: only this package declares @tiptap/*; the boundary gate proves the
//     negative (SC-002).
```

## 4. Adoption (`@craftkit/builder-blocks-marketing`)

```ts
// RichTextBlock: type 'richText', props { content: richText() } with an emptyRichText()
// default; renders via the renderer's RichText. Zero panel code (US1/AC1). Additive — no
// existing schema changes, no migration.
```

## 5. Preset surface additions (`@craftkit/builder`)

```ts
export { RichText, type RichTextProps } from '@craftkit/builder-renderer';
export { richTextExtension } from '@craftkit/builder-richtext';
export { emptyRichText, isRichTextSchema, richText } from '@craftkit/builder-schema';
export type { RichTextDoc } from '@craftkit/builder-schema';
// surface.test gains 'RichText', 'richTextExtension', 'richText', 'emptyRichText',
// 'isRichTextSchema'. Apps still import ONLY '@craftkit/builder'.
```

## 6. Dependency decision record (FR-011 — normative)

Pins `@tiptap/{react,starter-kit,core,pm}@3.30.3` exact, catalog-managed; published 2026-08-24 (≥
24h policy); transitive inventory and the ZERO-collision no-downgrade proof recorded in research R1;
trust policy unchanged (install output is the final word, verified in the wiring task). Any future
engine upgrade is its own recorded decision.

## 7. Lane-A proof contract (merge-blocking, counting only)

| Proof                                                | Instrument                      | Assertion                                        |
| ---------------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| Transactions ≡ commits (type/bold/heading/list/link) | `transactions().length`         | +1 per commit; undo/redo lockstep                |
| Door whitelist                                       | dispatch with unknown node/mark | rejected, zero change, path named                |
| Lazy containment                                     | loader invocation counter       | 0 without rich edit; 1 with (cached after)       |
| Boundary negative                                    | shell→@tiptap/react dep         | workspace gate exit 1, named violation; reverted |
| Import graph                                         | grep renderer/shell/schema src  | zero `@tiptap` imports                           |
| Sanitization sweep                                   | table of hostile hrefs          | 100% neutralized                                 |
| Parity                                               | canvas vs static markup         | equal text; headings/lists/links present in both |
| Law-S with the editor mounted                        | scenario-8 counter              | pairing holds                                    |

## 8. Review fixes (dual independent reviews, as-implemented)

Two read-only reviewers audited the B3b diff — one on dependency containment, security, and
kernel-law correctness; one on React quality, a11y, RTL, and component contracts. Both executed the
real predicates rather than reading only. Accepted findings, all fixed with regression tests:

**Security / containment**

1. **Backslash protocol-relative bypass** (`safeHref`): `/\evil.com` slipped past the `//` guard as
   a "clearly relative" path, while browsers resolve it to an attacker origin (WHATWG relative-slash
   state). Any backslash now refuses. Table-driven regression with the reviewer's exact vectors.
2. **The door accepted documents no editor can load** — an empty `doc`, a list item not opening with
   a paragraph, duplicate marks on one text node. TipTap catches its own load failure, warns to the
   console, and mounts an EMPTY document, so the next keystroke would commit over the user's real
   content. Both sides fixed: the door now requires a non-empty document, `listItem` content typed
   as `[paragraph, ...blocks]`, and at most one mark of a kind; the editor sets `enableContentCheck`
   with an `onContentError` notice, so a mismatch is LOUD instead of silently destructive. The
   projection guarantees the same shapes (a paired test asserts every projection of hostile input
   passes the door).
3. **Containment gate holes**: the rule never inspected the WORKSPACE ROOT manifest (which hoists
   into every package's resolution path) and matched dependency names only, so an npm ALIAS
   (`"engine": "npm:@tiptap/react@3"`) walked through. Both closed, with tests; `peerDependencies`
   and `optionalDependencies` coverage is now asserted too.
4. **Unbounded recursion**: a whitelist-valid deep document overflowed the stack in the renderer
   (the published path has no error boundary) and made the door THROW instead of rejecting. The door
   gained an iterative depth pre-check piped ahead of shape validation; the renderer gained a
   matching ceiling whose escape hatch (`plainText`) is itself iterative.
5. **`sideEffects: false` in the renderer** let a production bundler drop `RichText.css`, publishing
   untokenized prose. Corrected to `["**/*.css"]`.
6. **Duplicate link marks** produced nested anchors — invalid HTML the DOM and the static-markup
   parser repair differently, breaking SC-005 parity. The renderer honors the FIRST link mark only;
   parity asserted on both paths.

**React / a11y / contracts**

7. **The contenteditable had no accessible name**: `EditorContent` spreads unknown props onto its
   WRAPPER div, so `id={controlId}` never reached the editable element and the row's
   `<label htmlFor>` dangled on a non-labelable node. The id, `role="textbox"`, `aria-multiline`,
   `aria-labelledby`, `aria-describedby`, and `dir="auto"` now go through `editorProps.attributes`
   onto the ProseMirror element. The shell additionally passes `labelledBy` (additive
   `FieldControlProps` member) so any contributed non-labelable surface can name itself.
8. **No focus indicator**: the editable surface suppressed the UA outline with no replacement (WCAG
   2.4.7). The field now carries a `:focus-within` ring and the toolbar buttons a `:focus-visible`
   one, distinguishable from hover/pressed.
9. **The editor's link allowlist was wider than the renderer's** (TipTap's default admits `tel:`,
   `ftp:`, and bare domains): a link typed as `example.com` looked live in the editor and rendered
   DEAD on the published page, with no rejection anywhere. The editor now uses `safeHref` as its
   `isAllowedUri` AND validates the prompt result, surfacing a refusal notice.
10. **`disabled` did not disable the toolbar** (ProseMirror's `editable` gates DOM input, not
    `dispatch`): the buttons are disabled now, with a disabled style, and a story keeps them under
    the a11y gate.
11. **Toolbar focus theft**: every handler chained `.focus()`, so keyboard activation jumped out of
    the toolbar and the `aria-pressed` change was never announced. Mouse presses are cancelled at
    pointer-down (focus never leaves the editor) and no handler steals focus; "Clear formatting" no
    longer carries `aria-pressed` — it is an action, not a toggle.
12. **File layout**: `RichTextField.tsx` held a sibling component and a JSX-returning helper. Split
    into `RichTextField` (hook-free path routing), `RichTextEditor`, `RichTextToolbar`,
    `ToolbarButton`, `ResponsiveNotice`.
13. **A rejected commit stranded the editor** on content the document does not hold (the value prop
    is referentially unchanged, so the re-seed effect never ran). The reconcile effect now also runs
    per emission, so a refusal snaps back to document truth; identity comparison uses a
    KEY-ORDER-INDEPENDENT canonical JSON, so a normalizer or persistence round trip cannot make
    every keystroke re-seed and yank the caret.
14. **Engine state was read during render** (eight `isActive` calls kept coherent by
    `shouldRerenderOnTransaction`, re-rendering on every caret move). Replaced with a subscribed
    `useEditorState` selector.
15. **Storybook RTL globals were never wired**: stories declaring `globals: { direction: 'rtl' }`
    rendered LTR, so every RTL story in the repository — the only stated evidence for FR-008 —
    proved nothing. A `direction` global + decorator now applies it for real.
16. **Playground scenario 8 asserted nothing about editing**. It now performs a real toolbar commit,
    asserts the transaction arithmetic and the canvas, and proves undo restores both document and
    editor.
17. **Smaller accepted items**: state stories added (empty, disabled, responsive notice); the
    containment import-graph test derives its walk from workspace DISCOVERY and matches import
    SPECIFIERS (prose mentions are not leaks; a `.ProseMirror` style copy is); the lazy loader
    imports the folder barrel; the stale `v8 ignore` comment removed; `onEditorReady` fires once per
    editor through a ref; `RichTextFieldProps` extends the public `FieldProps`; door rejection tests
    assert EXACT paths.

**Deferred with rationale**: the `window.prompt` link flow stays until the design milestone replaces
it (now validated, so a refused URL is explained rather than silently dead). `__proto__` in stored
JSON is accepted-and-dropped by zod rather than rejected with a path — verified end to end as
non-exploitable (the value never reaches `Object.prototype`), recorded as a contract-fidelity gap.

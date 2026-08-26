# Data Model: Builder B3b Rich Text

Normative TypeScript lives in [contracts/builder-richtext.md](contracts/builder-richtext.md).

## Stored document (Law J — plain JSON)

```text
doc ─┬─ paragraph ── inline*        inline = text(marks: bold|italic|link{href}) | hardBreak
     ├─ heading{level 2..4} ── inline*
     ├─ bulletList ── listItem+ ── block*
     └─ orderedList ── listItem+ ── block*
```

Canonical empty: `{ type:'doc', content:[{ type:'paragraph' }] }`. Unknown types: REJECTED on write
(door), TOLERATED on read (renderer degrades to readable text).

## Flow

```text
block schema: content: richText()  ──meta marker──▶ resolveField ──▶ contributed field
     │                                                            (extension, lazy load)
     ├─ door: strict whitelist validation on every setProp
     └─ read: renderer RichText (zero-dep) ──▶ canvas / preview / static markup (parity)

editor commit: onUpdate ──▶ ONE onChange(getJSON()) ──▶ setProp ──▶ document notifies
external write (undo/redo): value ≠ last own emission ──▶ setContent re-seed (truth wins)
```

## Containment map

```text
@tiptap/* ∈ @craftkit/builder-richtext ONLY (layer 4)
renderer/schema/shell/core: zero engine imports (import-graph proven)
published/static path: RichText (plain React) — engine never loaded
```

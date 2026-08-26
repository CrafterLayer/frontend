# Active Work Handoff

**Status:** idle — B3b rich text implemented, reviewed (two independent lenses), converged
(13-agent adversarial audit), and fully verified; commit authorization pending for
B0 + B1 + B2a + B2b + B3a + B3b

**Updated:** 2026-08-26

**Scope:** `specs/workspace/008-builder-b3b-rich-text` (workspace scope: ONE new member
`@craftkit/builder-richtext` owning the workspace's first third-party editing dependency; a
layer-0 schema module; a zero-dependency renderer component; one adopting block; a new
workspace-validator rule; preset surface and playground composition)

**Active Spec:** `specs/workspace/008-builder-b3b-rich-text` (all artifacts complete; tasks
20/20 done incl. Phase 7 Convergence)

## Objective

Rich-text leaf props end to end: declare a rich property in a block schema, edit it through
the B3a field road with a real editor, render it everywhere through a dependency-free path —
and adopt the editing engine as an isolated, auditable, mechanically-contained decision.

## Completed

- **Dependency decision (the milestone's reason to exist)**: `@tiptap/{react,starter-kit,
  core,pm}@3.30.3` exact catalog pins, published 2026-08-24 (≥ 24h policy), 50 packages, zero
  lockfile collisions, zero trust-policy prompts — recorded with the transitive inventory and
  the no-downgrade proof in research R1 / contract §6.
- **Containment made MECHANICAL**: new `BUILDER_CONTAINED_DEPENDENCY` validator rule — only
  `@craftkit/builder-richtext` may declare the engine, in any dependency section, including
  through an npm ALIAS, and including the WORKSPACE ROOT manifest (which hoists into every
  package's resolution path). Five workspace-tools tests; the negative executed and reverted.
  A discovery-derived import-graph test matches import SPECIFIERS (prose is not a leak; a
  `.ProseMirror` style copy is).
- **Schema door** (`schema/src/rich-text/`): `richText()` (meta marker + strict whitelist),
  `isRichTextSchema`, `emptyRichText`, `RichTextDoc` types. The whitelist is deliberately no
  looser than what a ProseMirror-family editor can LOAD — non-empty doc, list items opening
  with a paragraph, one mark of a kind — because a document the door accepts but the editor
  cannot open gets silently emptied and then overwritten by the next keystroke. An iterative
  depth pre-check is piped ahead of shape validation (recursive zod overflows first).
- **Renderer** (`renderer/src/components/RichText/`): zero-dependency whitelist renderer with
  a hostile-href allowlist (backslash protocol-relative smuggling included), unknown-type
  degradation, a recursion ceiling whose escape hatch is itself iterative, first-link-mark-only
  anchors (nested anchors break DOM/static parity), and canvas≡static parity asserted.
- **Editor** (`extensions/richtext/`): lazy contributed field through the B3a road; StarterKit
  configured DOWN to the stored whitelist with the RENDERER's allowlist as its link gate; one
  projected transaction per update; document truth on external writes AND on refused ones;
  loud `onContentError` instead of a silent empty; live a11y attributes on the contenteditable
  (`EditorContent` spreads onto a wrapper div, which cannot be labeled); focus-preserving
  toolbar; split into RichTextField / RichTextEditor / RichTextToolbar / ToolbarButton /
  ResponsiveNotice.
- **Adoption**: `RichTextBlock` in blocks-marketing with zero panel code; the playground
  landing fixture carries one; scenario 8 proves the whole loop including a real toolbar edit.
- **Shell addition**: `FieldControlProps.labelledBy` (additive) so any contributed
  non-labelable surface can name itself.
- **Storybook**: the `direction` global is now actually wired — every RTL story in the
  repository had been rendering LTR, so the standing RTL evidence proved nothing.

## Verification (all green, 2026-08-26)

`pnpm verify` EXIT=0. Builder-family unit tests 551 (schema 100, core 89, react 10,
renderer 70, shell 177, blocks 22, richtext 23, preset 45, playground 15); Storybook Chromium
98 at a11y error; gates 18 members / 28 components / 531 boundary files; boundary negatives
executed+reverted (LAYER_VIOLATION, FAMILY_ACCESS, CONTAINED_DEPENDENCY).

## Blockers / Decisions Required (USER)

- **Commit authorization** for six pending batches, in order, never merged: B0 (003+chore),
  B1 (004), B2a (005), B2b (006), B3a (007), B3b (008). NO commit has ever been made
  (standing instruction "بس ما تسوي commit").

## Next Exact Action

**B3c — inline editing & floating toolbars** (`specs/workspace/009-builder-b3c-inline-editing`,
spec.md written): edit text where it lives on the canvas, a bubble toolbar for quick
formatting, and a block action bar — the "feels like Puck" gestures. USER DIRECTION
(2026-08-26): study Puck and GrapesJS and ADOPT/VENDOR their proven techniques rather than
inventing from scratch; a prior-art research pass is the first task and must land before any
design is fixed. Then B4 (transforms/code-view), then the DESIGN MILESTONE (user decision:
after B4; hand-rolled token system, not Tailwind), then B5+.

## Recovery

Everything re-derivable from `specs/workspace/008-builder-b3b-rich-text/*` (contract §§1–8 is
the full as-implemented record, including the dual-review and convergence fix logs) plus
`pnpm verify`. No uncommitted state outside the working tree.

# Implementation Plan: Builder B3c Inline Editing & Floating Toolbars

**Branch**: `009-builder-b3c-inline-editing` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)

## Summary

Editing where the content lives, plus two floating surfaces: a formatting BUBBLE over a text
selection and a block ACTION BAR on the selection outline. Built on the machinery that already
exists (RectIndex, overlay layer, tool host, the one host↔frame bridge, B3b's editor and commit
law), with two vendored pieces of prior art and one small pure positioning function written fresh.
Zero new dependencies (FR-013).

## Technical Context

**Dependencies**: none added. `@floating-ui/dom` deliberately rejected (research R2). **Vendoring**:
this milestone introduces the repository's FIRST vendored code — `VENDOR.md` and
`THIRD_PARTY_LICENSES.md` are created here, per the standing "vendor, never depend" rule.
**Constitution Check**: PASS (pre + post design) — component contracts for every new UI component;
tests mandatory; boundaries mechanical; counting-only gates.

## Structure

```text
vendor/                                   # NEW — first vendored code in the repository
    VENDOR.md                             # what, from where, at which commit, why, what changed
    THIRD_PARTY_LICENSES.md               # MIT texts (Puck, TipTap)
packages/builder/shell/src/overlay/
    floating-position.ts                  # positionFloating(): prefer-above + FLIP + clamp + RTL
    block-actions.ts                      # the selection action bar as a canvas tool (tool-host)
    inline-session.ts                     # which node/prop/kind is editing; lifecycle
packages/builder/shell/src/components/EditorCanvas/EditorCanvas.tsx
    # + toHost (the inverse of toFrame — still ONE meeting point), inline-edit gestures
    #   (double-click / Enter / Escape), and the layer-origin click guard (risk 2, 9)
packages/builder/renderer/src/components/DocumentView/NodeView/…
    # the inline seam: swap the declared prop's output for the editing surface on ONE node
packages/builder/schema/src/blocks/define-block-schema.ts
    # + inlineEditable declaration (FR-001), additive
packages/builder/extensions/richtext/src/InlineRichText/
    # the same RichTextField editor in inline chrome + the selection-rect channel (vendored
    # BubbleMenu shouldShow/rect logic, attributed)
packages/builder/shell/src/components/InlineTextSurface/            # vendored from Puck, adapted
apps/playground                            # scenario 9
```

## Component matrix (constitution IV)

| Component                           | Impl | Export | Stories                            | MDX | Tests                          |
| ----------------------------------- | ---- | ------ | ---------------------------------- | --- | ------------------------------ |
| InlineTextSurface (shell, vendored) | ✓    | ✓      | value-sync / hover-gate / RTL      | ✓   | behavior + caret safety        |
| BlockActionBar (shell, tool)        | ✓    | ✓      | anchored / edge-flip / drag-hidden | ✓   | one-tx per action              |
| TextBubble (shell)                  | ✓    | ✓      | selection / flip / RTL             | ✓   | anchor + lifecycle             |
| InlineRichText (extension)          | ✓    | ✓      | inline editing via canvas          | ✓   | commit law + selection channel |

## Phases

0. Vendor intake: `vendor/` + `VENDOR.md` + `THIRD_PARTY_LICENSES.md`, the two copies with
   provenance headers, and a workspace check that vendored files stay attributed.
1. Foundations: `positionFloating` + its table-driven suite; `toHost`; the `inlineEditable` schema
   declaration.
2. US1: inline session + renderer seam + InlineTextSurface (plain) + gestures.
3. US2: selection-rect channel + TextBubble.
4. US3: BlockActionBar as a canvas tool.
5. US4 + polish: stress/zero-render proofs, RTL, preset surface, playground scenario 9, evidence,
   dual reviews, converge, handoff, commit proposal ONLY (no commit).

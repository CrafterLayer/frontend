# Implementation Plan: Builder B3b Rich Text

**Branch**: `008-builder-b3b-rich-text` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)

## Summary

Rich-text leaf props end to end: a schema marker + structural door whitelist (layer 0), a
zero-dependency renderer (layer 2), and the workspace's FIRST third-party editing dependency —
TipTap 3.30.3 — contained to ONE new extension package (layer 4) that contributes a lazy field type
through the B3a road. One shipped block adopts it; the playground demonstrates it.

## Technical Context

**Deps (the decision, research R1)**: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/core`,
`@tiptap/pm` — all 3.30.3 exact, catalog-pinned, declared ONLY by the new extension package.
Everything else: zero new dependencies. **Constitution Check**: PASS (pre + post design) — component
contracts planned for every new UI component; tests mandatory; boundaries mechanical; no wall-clock
gates.

## Structure

```text
packages/builder/schema/src/rich-text/
    rich-text.ts               # richText(), isRichTextSchema(), richTextDocSchema,
                               # emptyRichText(), RichTextDoc types (R3)
packages/builder/renderer/src/components/RichText/
    RichText.tsx               # zero-dep whitelisted renderer (R4)
    safe-href.ts               # protocol allowlist (SC-004)
    + stories / docs.mdx / test / index (full contract)
packages/builder/extensions/richtext/          # NEW MEMBER @craftkit/builder-richtext
    package.json / tsconfig / vitest.config    # react test-config; deps: tiptap pins,
                                               # schema+renderer workspace deps
    src/index.ts               # richTextExtension manifest (fieldTypes contribution)
    src/RichTextField/
        RichTextField.tsx      # TipTap editor + toolbar (R5)
        + css / stories / docs.mdx / test / index (full contract)
packages/builder/extensions/blocks-marketing/src/components/RichTextBlock/  # R6 (full contract)
packages/builder/editor/src/…  # preset re-exports: richTextExtension, RichText, richText,
                               # emptyRichText, type RichTextDoc (+ surface.test entries)
apps/playground                # register richTextExtension; fixture block; scenario 8
```

## Component matrix (constitution IV)

| Component                 | Impl | Export           | Stories                                    | MDX | Tests                      |
| ------------------------- | ---- | ---------------- | ------------------------------------------ | --- | -------------------------- |
| RichText (renderer)       | ✓    | ✓                | whitelist/RTL/unsafe-href                  | ✓   | behavior+sanitization      |
| RichTextField (extension) | ✓    | ✓ (lazy default) | via Inspector composition + toolbar states | ✓   | behavior+truth+containment |
| RichTextBlock (blocks)    | ✓    | ✓                | themed/RTL                                 | ✓   | schema+render              |

## Phases

0. Wiring: catalog pins + new member skeleton + install (one atomic step; trust policy unchanged —
   verify install output).
1. Foundations: schema rich-text module (door law) → renderer RichText (+sanitizer).
2. US1: extension package + RichTextField + manifest + inspector integration proofs.
3. US2: rendering parity + safety suites; RichTextBlock adoption.
4. US3: containment proofs (boundary negative, lazy-load counter, import-graph).
5. Polish: preset surface, playground scenario 8, docs, evidence run, dual reviews, converge,
   handoff, commit proposal ONLY (no commit — standing instruction).

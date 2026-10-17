# Tasks: Builder B3b Rich Text

**Input**: Design documents from `specs/workspace/008-builder-b3b-rich-text/` **Prerequisites**: B3a
delivered and green; artifacts complete. Tests are MANDATORY; every new UI component ships the full
component contract. NO COMMITS — authorization remains withheld; the final task produces a proposal
only.

## Phase 1: Setup (the dependency decision lands here)

- [x] T001 Wiring (atomic): add catalog pins `@tiptap/{react,starter-kit,core,pm}: 3.30.3` to
      pnpm-workspace.yaml + new member skeleton packages/builder/extensions/richtext (package.json
      `@craftkit/builder-richtext` [react test-config profile; deps: tiptap pins via catalog,
      `@craftkit/builder-schema`+`-renderer` workspace, react peers], tsconfig, vitest.config,
      src/index.ts stub) + `pnpm install`; VERIFY install output: no trust-policy prompts, lockfile
      gains the recorded transitive family only; `pnpm check:workspace` green

## Phase 2: Foundational (blocking all stories)

- [x] T002 [P] Schema rich-text module (contract §1): packages/builder/schema/src/rich-text/
      rich-text.ts — `richText()` (meta marker + STRICT whitelist validator), `isRichTextSchema`
      (wrapper unwrap), `emptyRichText()`, `RichTextDoc` types + rich-text.test.ts (marker through
      wrappers; every unknown-node/mark/level/href rejection with paths; canonical empty; valid
      whole-whitelist doc passes) + schema index exports
- [x] T003 [P] Renderer RichText (contract §2): packages/builder/renderer/src/components/
      RichText/{RichText.tsx,safe-href.ts,RichText.css?,index.ts} — FULL contract (stories
      whitelist/RTL/unsafe-href + docs.mdx + RichText.test.tsx: semantics, unknown-type degradation,
      SC-004 hostile-href table, SC-005 parity vs renderStaticMarkup) + renderer index export

## Phase 3: User Story 1 — Edit rich text in the inspector (P1) 🎯 MVP

- [x] T004 [US1] Extension manifest + field (contract §3): packages/builder/extensions/
      richtext/src/{index.ts,RichTextField/…} — `richTextExtension` (fieldTypes contribution, lazy
      import) + RichTextField.tsx (StarterKit configured DOWN to the whitelist; labeled toolbar with
      aria-pressed; one onChange per update; document-truth re-seed on external writes;
      base-bucket-only notice e5) + css + index — FULL contract artifacts
- [x] T005 [US1] Extension behavior suite: RichTextField.test.tsx via a mounted Inspector — AC1
      (rich editor for the marked prop, zero panel code), AC2 (one tx per commit across
      type/bold/heading/list/link), AC3 (undo/redo document truth incl. external re-seed), AC4 (door
      rejection of a hostile injected write: zero change + reason), AC5 (disposal → readonly
      fallback without reload)
- [x] T006 [US1] Stories: RichTextField via Inspector composition (default/toolbar-states/ RTL + an
      edit play asserting tx count) + docs.mdx (usage, commit law, a11y, limitations incl.
      base-bucket deferral)

**Checkpoint**: a rich prop is editable end to end through the B3a road.

## Phase 4: User Story 2 — Faithful, safe rendering (P2)

- [x] T007 [P] [US2] blocks-marketing RichTextBlock (contract §4): schema
      `{ content: richText() }` + render via renderer RichText — FULL contract (stories themed/RTL,
      docs.mdx, tests) + landing fixture gains one instance
- [x] T008 [US2] US2 acceptance additions (renderer + blocks): whole-whitelist structural assertions
      on canvas AND static paths; neutralized-link rendering keeps text; unknown node/mark
      degradation; RTL

## Phase 5: User Story 3 — Containment (P3)

- [x] T009 [US3] Containment proofs: loader-invocation counter (0 without rich edit; 1 then cached —
      SC-003) in extension tests; import-graph test (zero `@tiptap` under
      schema/core/react/renderer/shell src — SC-002); record the executed shell→tiptap boundary
      negative procedure in the evidence task

## Phase 6: Integration, polish & delivery gates

- [x] T010 Preset surface (contract §5): RichText/richTextExtension/richText/emptyRichText/
      isRichTextSchema (+RichTextDoc type) re-exports + surface.test entries
- [x] T011 Playground: register richTextExtension in createPlaygroundKernel; scenario 8 (select rich
      block → editor appears → bold+heading commits counted → undo lockstep → preview renders SAME
      content with loader never re-invoked; Law-S counter holds)
- [x] T012 [P] Docs coherence: shell/renderer README notes; 003 contract additive note if any schema
      surface grew
- [x] T013 Evidence run per quickstart: narrow → gates + boundary negatives (standing pair + NEW
      shell→tiptap) → storybook catalog-presence → full `pnpm verify`; record here — RECORD
      (2026-08-26): `pnpm verify` EXIT=0. Builder-family unit tests 551 (schema 100, core 89, react
      10, renderer 61, shell 177, blocks 22, richtext 14, preset 45, playground 15 — scenario 8 =
      the full rich round trip); Storybook Chromium 98 at a11y error; catalog-presence PROVEN
      (Builder/Renderer/RichText, Builder/Extensions/RichTextField, Builder/Blocks/RichTextBlock);
      gates: 18 members / 28 components / 531 boundary files. Boundary negatives EXECUTED+REVERTED:
      shell→blocks-marketing ⇒ BUILDER_LAYER_VIOLATION; playground→shell ⇒ BUILDER_FAMILY_ACCESS;
      NEW shell→@tiptap/react ⇒ BUILDER_CONTAINED_DEPENDENCY (the validator rule this milestone
      added, with two workspace-tools unit tests). Dependency decision installed clean: 50 new
      packages, zero trust-policy prompts, zero lockfile collisions (the @tiptap/prosemirror family
      was entirely new; use-sync-external-store@1.6.0 deduped). Implementation notes: jsdom needs
      Range.getClientRects stubs for ProseMirror; toolbar clicks use fireEvent (userEvent's async
      scheduling flaked under parallel coverage instrumentation); v3 emits updates from setContent
      AND setEditable by default — both suppressed, since a re-seed and an editability toggle are
      READS, never commits (regression-locked).
- [x] T014 Final diff review (two independent read-only reviewers); fix accepted findings with
      regression tests; re-run affected checks
- [x] T015 /speckit-converge (multi-agent audit + adversarial verification); implement appended gaps
      to completion
- [x] T016 /speckit-workspace-handoff (HANDOFF/context/MEMORY refresh)
- [x] T017 /speckit-workspace-commit proposal ONLY (produced 2026-08-26; NO commit made) — commit
      authorization remains withheld

## Dependencies

```text
T001 → (T002 ∥ T003) → US1: T004 → T005 → T006 → US2: T007 → T008 → US3: T009 →
T010 → T011; T012 [P]; T013 → T014 → T015 → T016 → T017
```

## Implementation strategy

MVP = Phases 1–3 (the editor through the B3a road). Rendering safety and containment are what make
the dependency ADOPTABLE — the gates hold the contract, not discipline.

## Phase 7: Convergence

- [x] T018 Refresh the T013 evidence record per the convergence audit (contradicts, constitution):
      the counts recorded before T014 were stale — re-derived on 2026-08-26 and corrected in place
      above (551 builder-family tests, 531 boundary files, five containment tests, 98 Chromium).
- [x] T019 Regression-lock the §8 item-13 rejected-commit reconcile (partial, US1): the convergence
      verifier PROVED the fix untested by deleting `commitSeq` from the reconcile dependencies and
      watching both suites stay green. Added a rejecting-host test that fails without the dependency
      (mutation-verified), a real end-to-end AC4 test driving a refused toolbar gesture through the
      Inspector and asserting the control-adjacent reason on the editable surface, and a
      canonical-json suite. That AC4 test immediately exposed a further defect the fix had
      introduced: `editorProps` are frozen at editor creation, so `aria-describedby` never reached
      the surface when a rejection appeared — the attributes are re-applied on change now.
- [x] T020 Use only tokens the theme actually emits (partial, FR-004): `RichText.css` referenced
      `--t-primary`, `--t-font-body`, and `--t-font-heading` — none of which exist in the token set,
      so links were permanently hardcoded (~3.8:1 on the dark surface, below WCAG AA). Links use
      `--t-accent`; typography inherits from the host block.

# Active Work Handoff

**Status:** Feature 013 — the AI full-site design agent — is delivered except for three blocks that
this session cannot finish itself (see **What is NOT done**). 316 of 337 tasks are closed. No
commit, push, deploy, dependency installation, or external mutation was performed or authorized.
**Commit authorization remains withheld.**

**Updated:** 2026-09-07

## What a person can now do

Type one sentence describing a business, in Arabic or English, and get a multi-page site — pages,
sections, copy, a palette, a header and a footer — landed on the live site as **one transaction**
that **one undo** reverses. A run that fails at any stage leaves the site byte-identical, because
nothing writes until the commit.

## The architecture, in four sentences

1. **A site is one kernel.** One store, one dispatcher, one transaction log, one history, one save
   session. `siteKernel.page(pageId)` is a lens satisfying the document `BuilderKernel` interface,
   so every component built for a document works over a site unchanged. Recorded in
   [ADR 0006](../../docs/architecture/decisions/0006-builder-site-model-and-design-tokens.md).
2. **The door is the only writer.** `generateSite` is handed no kernel and returns commands.
   `applySiteCommands` sends them into a DRAFT kernel one at a time — a group cannot read back an id
   minted halfway through it — and `commitGeneratedSite` lands the whole result as a single
   `applySitePatches`.
3. **`DesignSystem` is layer 0.** The schema owns the type, the default, and `validateDesignSystem`,
   which measures contrast and fails closed. The renderer owns only the translation to CSS
   variables.
4. **An image holds an id or a labelled absence.** `ImageProp = AssetRef | { absent, reason }`.
   There is no path that produces an address, because a generated URL satisfies every schema, stores,
   validates, renders, and is a broken image on a stranger's site.

## Delivered blocks

| Block | Tasks | What shipped |
| --- | --- | --- |
| Site core | T001–T031 | `BuilderSite`, `validateSite`, `migrateSite`, `createSiteBuilder`, the page lens, eleven site commands |
| Codec | T032–T047 | `projectSite`/`parseSite`; a page's projection is byte-identical to `projectDocument`'s |
| Five-stage pipeline | T048–T066 | sitemap → structure → content → design system → assembly, validated between each |
| Playground site | T072–T085 | site boot, `SitePages`, `SiteBriefForm`, `SiteBuilderPanel` on its own rail destination |
| Design system | T086–T103 | `DesignSystemPanel`, `TokenSwatchGrid`, tokens at layer 0 |
| Refinement | T104–T111, T113–T114 | resolve → refuse → propose → validate → apply, page and palette |
| Shared regions | T115–T121 | header and footer across pages, one definition |
| Responsive | T122–T128 | container queries, a Chromium overflow gate at 360/768/1024/1440 + RTL |
| Assets | T129–T143 | selection, the labelled-absence union, `AssetPicker`, the local library |
| Docs | T149–T152 | ADR 0006, the architecture docs, five package READMEs |

## What is NOT done, and why

Three items are **blocked on something outside this session**, not unfinished work:

1. **T144–T148 — evaluation and the critic.** The protocol needs **three independent human raters**
   and a live API key. A single agent scoring its own output is not a measurement, so this was left
   open rather than faked.
2. **T305–T307 — token usage and model tiers.** These need `apps/ai-server`, which belongs to the
   peer session **frontend-6d**. Ports 8787 and 5173 are theirs; nothing here starts a server.
3. **T112 — the refinement conversation in `AssistantPanel`.** Left open deliberately, with the
   reason recorded in `tasks.md` at that entry.

Also open: **T294** (persist the assistant mode, and replace one vacuous `followUp` assertion at
`assemble-context.contract.test.ts:337`), and **T153–T158**, the review-and-verify tail this
session is working through.

## Gate state at handoff

```text
pnpm check:workspace     passed, 33 members
pnpm check:components    passed, 133 components
pnpm check:boundaries    passed
pnpm turbo run lint typecheck    61/61, exit 0
```

`pnpm format:check` is clean **except** `apps/ai-server/**` (13 files) and `CLAUDE.md`, which were
deliberately left untouched: the server belongs to the peer session, and reformatting a file another
session is editing loses their work. Whoever owns those should run
`pnpm exec prettier --write apps/ai-server CLAUDE.md`.

## Working method, for whoever picks this up

Two habits produced most of the real findings and should not be dropped:

- **Build a gate that MEASURES, then let it find defects.** The responsive gate found two sections
  overflowing 348px at a 360px viewport; the UX gate found a 67×20 button below the 24px pointer
  minimum; the theme's measurement gate caught a raw `9rem` in new CSS. None of those was visible to
  a green test count.
- **Mutation-test every rule, and delete what survives.** Break the code, watch a NAMED test fail. A
  check no mutation can distinguish from its absence is decoration — the `AssetPicker`'s unmount
  guard was exactly that and was rewritten as the case that IS observable.

Three traps this repository sets, all of which cost time here:

- `pnpm turbo run test` will replay a stale PASS for a gate whose inputs turbo does not track. Use
  `--force` at least once before believing it.
- A vitest run can print `N passed` and exit 1 — unhandled errors inside React's event dispatch are
  reported on an `Errors` line, not as failures. Read the exit code.
- A Storybook story that leaves a promise pending starves every story declared after it in the same
  file, and the failures name the wrong story.

## Environment

- `PATH` must include `$HOME/.nvm/versions/node/v24.19.0/bin` before any pnpm (`engines.node` is
  `>=24.15.0 <25`).
- `rg` is absent (use `grep -rn`), `head` is shadowed (use `sed -n`), `timeout` does not exist, and
  `curl`/`wget` are blocked.
- Peer sessions share this checkout. Run `ListAgents` before touching `apps/ai-server/**` or any
  file another session may be editing, and prefer targeted string replacements over whole-file
  rewrites in `App.tsx`, `AssistantPanel.tsx`, `AssistantHeader/*` and `App.css`.

## Active artifacts

- Feature: `specs/workspace/013-ai-full-site-design-agent`
- Plan: `specs/workspace/013-ai-full-site-design-agent/plan.md`
- Task ledger with per-block evidence: `.../tasks.md`
- Audits written this cycle: `.../responsive-audit.md`, `.../design-audit.md`
- Asset contract: `.../contracts/asset-library.md`
- Public package contracts: `packages/builder/{schema,core,transforms,ai,shell}/README.md`

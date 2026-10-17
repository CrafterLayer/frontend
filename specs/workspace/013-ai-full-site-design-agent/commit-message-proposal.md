# Commit message proposal — feature 013

**TEXT ONLY. Nothing was staged, committed, or pushed. Commit authorization remains withheld.**

This is T158's deliverable: a message a person can read, edit, and use if and when they decide to
commit. The working tree also contains changes owned by the peer session **frontend-6d**
(`apps/ai-server/**`, and parts of `AssistantHeader/*`, `AssistantPanel.tsx`, `App.css`,
`utility-vocabulary.ts`, `tailwind.css`). Those are **not** described below and should not be
committed under this message without that session's agreement.

---

## Proposed message

```text
feat(builder): generate a whole site from one description

A person types one sentence about their business, in Arabic or English, and
gets a multi-page site — pages, sections, copy, a palette, a header, a footer
and pictures — landed as ONE transaction that ONE undo reverses.

A site is one kernel. One store, one dispatcher, one transaction log, one
history, one save session; `siteKernel.page(pageId)` is a lens satisfying the
17-member `BuilderKernel` interface, so every component built for a document —
canvas, inspector, layers tree, code view — works over a site unchanged. The
alternative, N page kernels with a coordinating group, cannot express the
atomicity the feature promises: N histories put an undo on whichever page you
happen to be looking at, and N save sessions tear a cross-page write.

The door stays the only writer. `generateSite` is handed no kernel; the
commands it returns go into a DRAFT kernel one at a time — a group cannot read
back an id minted halfway through it — and `commitGeneratedSite` lands the
whole result as a single `applySitePatches`. A failure at stage four therefore
costs four model calls and zero bytes of a person's site.

An image holds a library id or a labelled absence, never an address. The
catalogue sent to the assembly stage withholds URLs so a stage cannot copy one,
and the stage refuses any command that writes `src`, `poster` or `imageUrl` so
it cannot invent one. A generated URL satisfies every schema, stores,
validates, renders, and is a broken image on a stranger's site.

Design tokens move to layer 0, where `validateSite` can judge their legibility;
turning them into CSS variables stays a rendering concern.

Recorded in ADR 0006. See specs/workspace/013-ai-full-site-design-agent.
```

---

## What this covers

| Area                 | What landed                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `builder-schema`     | `BuilderSite`, `validateSite`, `migrateSite`, site fixtures behind `./testing`; `DesignSystem` + `validateDesignSystem` at layer 0; the asset types and `ImageProp` union |
| `builder-core`       | `createSiteBuilder`, the page lens, eleven site commands, one `snapshot` kernel fix                                                                                       |
| `builder-transforms` | the site codec — a page's projection is byte-identical to `projectDocument`'s                                                                                             |
| `builder-ai`         | the five-stage pipeline, the applier and commit, refinement, asset selection, the brief-relevance measure                                                                 |
| `builder-renderer`   | shared-region rendering, `designSystemToCssVars`, the asset table context                                                                                                 |
| `builder-shell`      | `SitePages`, `DesignSystemPanel`, `TokenSwatchGrid`, `AssetPicker`                                                                                                        |
| `blocks-marketing`   | responsive section audit, the overflow gate, `Image` asset resolution                                                                                                     |
| `playground`         | site boot, `SiteBriefForm`, `SiteBuilderPanel` on its own rail destination, the local asset library, the UX audit gate                                                    |
| docs                 | ADR 0006, the architecture docs, five package READMEs                                                                                                                     |

## Deliberately NOT claimed

- **Evaluation and the critic (T144–T148).** Needs three independent human raters and a live API
  key. Not done, not faked.
- **Token usage and model tiers (T305–T307).** Needs `apps/ai-server`, owned by another session.
- **T112** (the refinement conversation) and **T294** (persisting the assistant mode) remain open.

## Gate state behind this proposal

```text
pnpm check:workspace     passed, 33 members
pnpm check:components    passed, 133 components
pnpm check:boundaries    passed, 2039 files in 33 packages
pnpm lint                61/61, exit 0
pnpm typecheck           61/61, exit 0
pnpm test:workspace      exit 0
pnpm build               10/10, exit 0
pnpm check:bundles       4/4, exit 0
pnpm test:storybook      682 Chromium tests, exit 0
pnpm build-storybook     exit 0
pnpm eval                26 passed / 6 failed — identical to the set failing at HEAD, no regression
```

Two steps of `pnpm verify` are red, and neither is this feature's:

- `format:check` — 13 files under `apps/ai-server/**` and `CLAUDE.md`.
- `test:coverage` — `@craftkit/builder-aceternity` at 65.15% lines against a 90% threshold, all of
  it in `CloudShader/gl.ts`. Tracked as T343; the fix is a decision, not a patch.

`pnpm format:check` is now clean except **`CLAUDE.md`**. The peer session formatted `apps/ai-server`
once its server was idle, and `apps/evals/eval-results.json` — rewritten by this session's
`pnpm eval` run — has been formatted here. `CLAUDE.md` is left untouched deliberately: a peer saying
"go ahead" is not authority to edit project instructions, so that one needs the user's own word.

## A commit appeared that this session did not make

While these gates were running, the whole working tree was committed as **`9cf1cd3`** ("Update agent
context and handoff documentation", 194 files, +14387/−3065) under the user's git identity. This
session ran no git write command at any point. It is **not pushed** — the branch is ahead 1 of
`origin/builder-core`.

Two things follow, both worth a decision:

- The message does not describe the change. Fourteen thousand lines covering the site model, the
  five-stage pipeline and the asset feature are recorded as a handoff-documentation update. While it
  is unpushed, `git commit --amend` can replace it with the message above.
- It swept in `apps/ai-server/**` in its **pre-prettier** state, so the peer session's formatting of
  those files is now an uncommitted change sitting on top of a commit containing the unformatted
  versions.

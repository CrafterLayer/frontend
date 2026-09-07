# ADR 0006: A Site Is One Kernel, and Design Tokens Live at Layer 0

- **Status:** Accepted
- **Date:** 2026-09-07
- **Scope:** `packages/builder/{schema,core,transforms,ai,renderer,shell}`, `apps/playground`
- **Spec:**
  [`specs/workspace/013-ai-full-site-design-agent`](../../../specs/workspace/013-ai-full-site-design-agent/spec.md)

## Context

Until this feature the builder knew one thing: a `BuilderDocument`. A "site" was whatever an
application chose to keep beside it. The AI full-site agent needed a site to be a real object — a
run generates four pages, a header, a footer and a palette in one go, and every promise the feature
makes is about that whole:

- **One undo for a whole generation** (SC-011). A person who does not like the site says so once.
- **No half-built page ever reaches the live site** (SC-010). A run that fails at stage four leaves
  the workspace byte-identical.
- **A palette change repaints every page** (FR-012), without rewriting every page's document.

Two shapes were available.

**N document kernels, one per page, with a coordinating group.** Each page keeps its own history and
its own persistence session. This was rejected on its own terms: N histories means an undo lands on
whichever page the person happened to be looking at, and N persistence sessions means a cross-page
write is torn — some pages saved, some not, with no single append that says so. The atomicity SC-010
and SC-011 ask for is not expressible over N independent logs.

**One site kernel, and pages as lenses onto it.** One store, one dispatcher, one transaction log,
one history, one save session. `siteKernel.page(pageId)` returns something that satisfies the
existing 17-member `BuilderKernel` interface, so every component built for a document — the canvas,
the inspector, the layers tree, the code view — keeps working with no change and no knowledge that a
site exists.

Separately, a site's design system existed only as `SiteDesignSystem`, a deliberately thin stand-in
declared beside the site types in the schema, while the token VOCABULARY it needed — `Theme`,
`TokenName`, `tokenCssName` — still lived in the renderer at layer 2. A site stores its own tokens
and `validateSite` has to judge their legibility, so the schema needed that vocabulary; reaching for
it where it was would have meant layer 0 depending upward, which the dependency law of
[ADR 0003](0003-builder-dependency-law.md) refuses outright.

## Decision

**1. A site is one kernel; a page is a lens.**

`createSiteBuilder()` returns a `BuilderSiteKernel` over
`KernelSiteState = { site; pageId; selection; elementFocus; seq }`. Patches are rooted in the SITE,
so a mixed batch touching two pages is one `produceWithPatches`, one patch set, one transaction, one
undo. `kernel.page(pageId)` passes the 17 members through with the page bound.

Site commands (`addPage`, `removePage`, `renamePage`, `reorderPage`, `setSharedRegion`,
`setPageRegions`, `setDesignToken`, `setDesignSystem`, `registerAsset`, `setSiteDirection`,
`applySitePatches`) live in `core/src/commands/site-commands.ts` behind the same door every other
command goes through. `applySitePatches` is host-only and refuses to move `siteVersion`, which stays
owned by the migrations.

**2. `DesignSystem` moves to layer 0.**

`packages/builder/schema/src/theme/` owns the real `DesignSystem`, the token vocabulary moved down
from the renderer, `defaultDesignSystem()`, and `validateDesignSystem` — which measures contrast and
fails closed on a colour it cannot parse. `validateSite` delegates the whole legibility rule to it
rather than computing contrast a second time, because two implementations of one question are two
answers that drift.

The renderer keeps `designSystemToCssVars` and `themeFromDesignSystem`: turning tokens into CSS is a
rendering concern and stays at layer 2.

**3. Generation proposes commands; the door writes.**

`generateSite` is handed no kernel. It returns a `GeneratedSite` — the sitemap, structure, copy and
design system it produced, plus `commands: AssemblyStep[]`, which is the only part anything writes
from. `applySiteCommands` sends them one at a time into a DRAFT kernel — one at a time because a
group cannot read back an id minted halfway through it, and Law D says only the kernel's port may
mint one. The one-transaction promise is not lost, it is moved to the commit: `commitGeneratedSite`
puts a whole generation onto the live site as a single `applySitePatches`.

**4. An image holds an id or a labelled absence — never an address.**

`ImageProp = AssetRef | { absent: true; reason: string }`. There is no third state and no path that
produces a string, because a generated URL satisfies every schema, stores, validates, renders, and
is a broken image on a stranger's site. The site's `assets` table holds COPIES of the library's
entries, which is why a picture deleted from the library degrades nothing.

## Consequences

**Good.**

- SC-010 and SC-011 are structural rather than aspirational: a generation cannot half-write, because
  nothing writes until the commit, and the commit is one transaction.
- Every existing document component works unchanged over a site, through the lens.
- A palette change is one `setDesignToken` transaction that rewrites no page document.
- `validateSite` is the single door for site validity, and it owns no contrast arithmetic of its
  own.

**Costs, accepted.**

- Two kernel shapes now exist. The mitigation is that `BuilderSiteKernel` is not a second
  implementation of `BuilderKernel` — the lens delegates member for member (`site/page-view.ts`),
  and its behaviour is pinned by the `page lenses` suite in `site/create-site-builder.test.ts`.
- `applySiteCommands` produces one transaction per command in the DRAFT. That is fine because a
  draft's history is nobody's, but it means a draft kernel must never be shown to a person as an
  undo surface.
- The layer-0 move required `DesignSystem` to be JSON-representable in full. It is; the wire types
  it as `JsonValue` anyway so that a server a version behind is refused by the validator with a
  readable message rather than by `JSON.parse`.

**Rejected alternatives.**

- _N page kernels with a coordinating group_ — see Context. Atomicity is not expressible over N
  logs.
- _A site as a document with pages as subtrees_ — every page-level operation would have become a
  subtree operation, and `siteVersion` would have had nowhere to live that migrations could own.
- _Tokens duplicated at layer 0 and layer 2_ — two vocabularies for one thing, guaranteed to drift.

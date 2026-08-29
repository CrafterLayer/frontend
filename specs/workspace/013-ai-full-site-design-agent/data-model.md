# Phase 1 Data Model: AI Full-Site Design Agent

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-08-29

Types are shown as TypeScript for precision. They are the _shape contract_, not the implementation —
every one of them is validated at runtime by a zod schema in `@craftkit/builder-schema`, because a
type that only exists at compile time cannot refuse a model's output.

Layer assignments follow ADR 0003 and are load-bearing: they are the reason each type lives where it
does.

---

## 1. Site (layer 0 — `@craftkit/builder-schema`)

The new unit of work. Owned and validated by the same layer that owns documents (FR-006).

```ts
export const LATEST_SITE_VERSION = 1;

export interface BuilderSite {
  siteVersion: number;
  /** Site-level content direction. A page may not disagree with its site. */
  dir: ContentDirection;
  /** Ordered. Order IS the navigation order and the page-list order. */
  pages: readonly SitePage[];
  /** Defined once, referenced by pages. */
  sharedRegions: Readonly<Record<SharedRegionId, SharedRegion>>;
  /** The generated design language. One per site (FR-010). */
  designSystem: DesignSystem;
  /** Every asset any page may reference. The only place references may resolve to (FR-045). */
  assets: Readonly<Record<AssetId, AssetEntry>>;
}
```

### SitePage

```ts
export interface SitePage {
  id: PageId;
  /** URL path segment. Unique within a site. `/` for the home page. */
  address: string;
  /** Human name. Also the shared-navigation label unless overridden. */
  title: string;
  /** Stage-one output, retained so a later stage and a human can both read the intent. */
  purpose: string;
  audience: string;
  /** UNCHANGED shape at schemaVersion 1. This is the wrap decision made concrete. */
  document: BuilderDocument;
  /** Which shared regions this page uses. Absent id = opted out (FR-004). */
  regions: readonly SharedRegionId[];
}
```

**Why `document` is nested verbatim**: lifting a page out of a site must yield a valid
`BuilderDocument` with no transformation (SC-014). Nesting the real type — rather than spreading its
fields into `SitePage` — is what makes that true by construction instead of by a conversion function
someone has to keep correct.

### SharedRegion

```ts
export type SharedRegionKind = 'header' | 'footer';

export interface SharedRegion {
  id: SharedRegionId;
  kind: SharedRegionKind;
  /** Its own document. A header is a page fragment, not a special node type. */
  document: BuilderDocument;
}
```

**Why a region is a document**: the renderer, inspector, canvas, and codec already know how to
handle a `BuilderDocument`. A header that is one gets all of them free. A header that is a bespoke
type gets none of them.

### Validation rules

| Rule                                                                   | Requirement |
| ---------------------------------------------------------------------- | ----------- |
| `siteVersion` is a known version                                       | FR-006      |
| Exactly one page has `address === '/'`                                 | FR-002      |
| Page `address` values are unique                                       | FR-002      |
| Page `id` values are unique                                            | FR-003      |
| Every `regions[]` entry exists in `sharedRegions`                      | FR-004      |
| Every page `document` passes the existing document validator unchanged | FR-007      |
| Every page `document.dir` equals `site.dir`                            | FR-043      |
| Every asset reference in every page and region resolves in `assets`    | FR-045      |
| `designSystem` passes the contrast gate                                | FR-014      |

The site validator **calls** the existing document validator rather than reimplementing it. A page's
validity is defined in exactly one place.

### Migration

`migrations.ts` mirrors the existing `document/migrations.ts` pattern, plus one upgrade the document
table cannot express:

```ts
/** FR-007: an existing bare document becomes a one-page site with no loss. */
export function siteFromDocument(doc: BuilderDocument): BuilderSite;
```

The home page takes `address: '/'`, the document is nested unchanged, `sharedRegions` is empty, the
design system defaults to the current `lightTheme` values, and `assets` is empty. Round-tripping
that site back through `sitePages(site)[0].document` yields the input byte-identically — a test
obligation, not a comment.

---

## 2. Design System (layer 0 — moved down, see research R1)

```ts
// MOVED from packages/builder/renderer/src/resolve/theme.ts.
// Vocabulary unchanged; only its layer changes.
export type ColorToken =
  | 'surface'
  | 'surfaceInverse'
  | 'text'
  | 'textInverse'
  | 'textMuted'
  | 'accent'
  | 'accentText'
  | 'success'
  | 'successText';

export type MeasurementToken =
  | 'radius'
  | 'gap'
  | 'gapXs'
  | 'gapSm'
  | 'gapLg'
  | 'sectionSpacingSm'
  | 'sectionSpacingMd'
  | 'sectionSpacingLg'
  | 'gutter'
  | 'contentWidthNarrow'
  | 'contentWidthStandard'
  | 'contentWidthWide'
  | 'pageWidth'
  | 'gridMinTrack'
  | 'spaceUnit'
  | 'borderWidth'
  | 'shadowSoft'
  | 'shadowStrong'
  | 'barHeightCompact'
  | 'barHeightRegular'
  | 'barHeightTall'
  | 'fontSizeLg'
  | 'fontSizeXl'
  | 'letterSpacingWide'; /* …existing type scale… */

export type TokenName = ColorToken | MeasurementToken;
export type Theme = Readonly<Record<TokenName, string>>;
```

The generated design system adds provenance around that map:

```ts
export interface DesignSystem {
  /** Human name, e.g. "Warm Clinical". Shown in the panel; also aids distinctiveness review. */
  name: string;
  /** The resolved token map. Closed union of keys — an unknown token is a validation failure. */
  tokens: Theme;
  /** The pairing choice, retained so it can be regenerated or reviewed. */
  typography: {
    headingFamily: string;
    bodyFamily: string;
    /** The ratio the type scale was generated from, e.g. 1.25. */
    scaleRatio: number;
  };
  /** Which text-on-background pairings this system authorizes. The contrast gate's input. */
  pairings: readonly { text: ColorToken; background: ColorToken; size: 'normal' | 'large' }[];
  /** The seed that produced it, so SC-013 can reproduce it. */
  seed: string;
}
```

**Why `pairings` is explicit data**: FR-014 requires every _authorized_ pairing to be measured. Left
implicit, "authorized" means "whatever a block happened to do", which is unmeasurable. Declared, the
contrast gate has a finite input and the count of failures can be zero.

**Why blocks need no change**: `style-values.ts` already refuses literal lengths, and padding is
already typed as a number of `spaceUnit` steps. FR-011 is pre-existing law.

---

## 3. Assets (layer 0 contract, layer 2 selection)

```ts
export type AssetId = string;

export interface AssetEntry {
  id: AssetId;
  /** Where the image actually is. Supplied by the port; never invented by the agent. */
  url: string;
  /** What it shows. The agent's basis for choosing (FR-046). */
  description: string;
  /** e.g. "warm", "clinical", "industrial". Matched against the design system. */
  mood: readonly string[];
  /** Dominant colours, so selection can respect the palette. */
  palette: readonly string[];
  /** Required. FR-048. */
  alt: string;
  width: number;
  height: number;
}

/** A block prop referencing an asset. Ordinary JsonValue — no page schema change. */
export interface AssetRef {
  assetId: AssetId;
}
```

### The port (FR-050)

```ts
export interface AssetLibraryPort {
  /** Everything available. The agent may select only from this. */
  list(options?: { signal?: AbortSignal }): Promise<readonly AssetEntry[]>;
}
```

Implementations: a local one in `apps/playground` (this feature), a deterministic double in
`@craftkit/builder-ai/testing`, and — later, unchanged from selection's point of view — a
backend-backed one that also accepts uploads.

**The invariant that makes SC-012 a count rather than a hope**: assembly rejects any `AssetRef`
whose `assetId` is absent from `site.assets`. An invented address is a validation failure, not a
broken image.

**Deliberate absence** (FR-047) is `undefined` plus a labelled reason on the block, never an
`AssetRef` pointing nowhere.

---

## 4. Pipeline artifacts (layer 2 — `@craftkit/builder-ai`)

Stage outputs. Each is validated before the next stage begins (FR-017).

```ts
export interface SiteBrief {
  text: string;
  seed: string;
  /** FR-025: the stated bound. Exceeding it is reported, never silently truncated. */
  limits: { maxPages: number; maxSectionsPerPage: number };
}

/** Stage 1 output. */
export interface SitemapPlan {
  pages: readonly { address: string; title: string; purpose: string; audience: string }[];
  /** Why this page set and not another. Reviewable, per FR-018's spirit. */
  rationale: string;
}

/** Stage 2 output, per page. */
export interface StructurePlan {
  address: string;
  sections: readonly {
    /** Must be a registered block type. Unregistered = stage failure, not invention. */
    blockType: string;
    emphasis: 'primary' | 'supporting' | 'closing';
    intent: string;
  }[];
  orderRationale: string;
}

/** Stage 3 output, per page. */
export interface CopySet {
  address: string;
  /** Keyed by section index in the StructurePlan. */
  sections: readonly Record<string, string>[];
}

/** Stage 4 output. */
export type DesignSystemPlan = DesignSystem;

/** Stage 5 output — COMMANDS, never a document or a site (FR-030, research R5). */
export interface AssemblyPlan {
  rationale: string;
  commands: readonly AiPlanStep[];
}
```

**Why stage 5 returns `AiPlanStep[]`**: it is the existing `AiPlan.commands` shape. The whole
pipeline converges on the machinery that already exists — registry lookup, per-command arg schemas,
and the scratch-kernel dry run — rather than opening a second admission path.

### Generation run

```ts
export interface GenerationRun {
  brief: SiteBrief;
  stage: 'sitemap' | 'structure' | 'content' | 'design-system' | 'assembly' | 'done' | 'failed';
  progress: readonly { stage: string; message: string }[];
  outcome:
    | { kind: 'complete'; plan: AssemblyPlan }
    | { kind: 'failed'; stage: string; reason: string }
    | { kind: 'cancelled' };
}
```

`cancelled` and `failed` both write nothing (FR-022, FR-023, SC-010). The run is a value the UI
renders, not state the kernel holds.

---

## 5. Refinement (layer 2)

```ts
export interface RefinementRequest {
  text: string;
  /** Resolved by the agent, then verified to exist BEFORE any command is proposed. */
  target:
    | { kind: 'site' }
    | { kind: 'design-system' }
    | { kind: 'page'; pageId: PageId }
    | { kind: 'node'; pageId: PageId; nodeId: NodeId };
}
```

An unresolvable target is refused and writes nothing (FR-038). Resolution happens before proposal,
so "invent a plausible target" is not a reachable state.

---

## 6. Entity relationships

```
BuilderSite
├── pages: SitePage[]  (ordered — order IS navigation order)
│   ├── document: BuilderDocument   ← UNCHANGED, schemaVersion 1, independently valid
│   └── regions: SharedRegionId[]   ← references ↓
├── sharedRegions: Record<SharedRegionId, SharedRegion>
│   └── document: BuilderDocument   ← also unchanged
├── designSystem: DesignSystem
│   ├── tokens: Theme               ← closed key union, validated
│   └── pairings                    ← the contrast gate's finite input
└── assets: Record<AssetId, AssetEntry>
        ▲
        └── every AssetRef in every document must resolve here (FR-045)
```

## 7. What did NOT change, and why that is the result

| Type                          | Status                             | Why it matters                                                               |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| `BuilderDocument`             | Unchanged, `schemaVersion` stays 1 | Every B0–B4 proof keeps holding without re-derivation                        |
| `Node`                        | Unchanged                          | `responsive` already covers tablet/mobile; an `AssetRef` is an ordinary prop |
| `Breakpoint`                  | Unchanged                          | Desktop base + tablet + mobile is already the three widths FR-041 wants      |
| `Transaction`, history, ports | Unchanged                          | The single validated door is preserved, not widened                          |
| `@craftkit/builder-theme`     | Unchanged                          | Editor chrome stays separate from the page design system (FR-015)            |
| `style-values.ts`             | Unchanged                          | It already refuses literal lengths — FR-011 is pre-existing law              |

The one gap this model does **not** close on its own is grouped dispatch: `applyAiPlan()` reports
`mode: 'sequence'` because the kernel has no transaction-group API, so a multi-command plan is
several undo steps. FR-034 and FR-037 require one refinement and one generation to each be one undo
step. That needs a real grouped-dispatch contract in `@craftkit/builder-core` — recorded as Phase A
work in the plan, and explicitly _not_ to be faked in the AI package by writing patches around the
door.

# Contract: Site Model and Site Commands

**Owners**: `@craftkit/builder-schema` (layer 0), `@craftkit/builder-core` (layer 1),
`@craftkit/builder-transforms` (layer 2)

Consumers reach all of it through `@craftkit/builder` (layer 5). Apps never import a builder member
directly — `BUILDER_FAMILY_ACCESS` is CI-fatal.

---

## 1. `@craftkit/builder-schema` — added exports

```ts
// Site
export const LATEST_SITE_VERSION: number;
export type PageId = string;
export type SharedRegionId = string;
export type SharedRegionKind = 'header' | 'footer';
export interface BuilderSite {
  /* data-model.md §1 */
}
export interface SitePage {
  /* data-model.md §1 */
}
export interface SharedRegion {
  /* data-model.md §1 */
}

export function validateSite(value: unknown): SiteValidationResult;
export function siteFromDocument(doc: BuilderDocument): BuilderSite;
export function migrateSite(value: unknown): BuilderSite;

// Design system
export interface DesignSystem {
  /* data-model.md §2 */
}
export function contrastRatio(foreground: string, background: string): number;
export function validateDesignSystem(system: DesignSystem): DesignSystemValidationResult;

// Assets
export type AssetId = string;
export interface AssetEntry {
  /* data-model.md §3 */
}
export interface AssetRef {
  assetId: AssetId;
}
export interface AssetLibraryPort {
  list(options?: { signal?: AbortSignal }): Promise<readonly AssetEntry[]>;
}
```

### Relocated exports (source-compatible)

`ColorToken`, `MeasurementToken`, `TokenName`, and `Theme` move here from
`@craftkit/builder-renderer`. The renderer **re-exports all four**, so no existing import breaks.

New code should import them from the schema. This is a soft migration with no deprecation date; the
re-export is not scheduled for removal, because the renderer legitimately needs the names in its own
signatures.

### `validateSite` result

```ts
export type SiteValidationResult =
  { ok: true; site: BuilderSite } | { ok: false; issues: readonly SiteValidationIssue[] };

export interface SiteValidationIssue {
  code:
    | 'unknown-site-version'
    | 'missing-home-page'
    | 'duplicate-page-address'
    | 'duplicate-page-id'
    | 'unknown-shared-region'
    | 'invalid-page-document' // wraps the existing document validator's issues
    | 'page-direction-mismatch'
    | 'unresolved-asset-reference'
    | 'design-system-contrast-failure';
  message: string;
  /** Which page or region, when the issue belongs to one. */
  at?: { pageId?: PageId; regionId?: SharedRegionId };
}
```

`invalid-page-document` **wraps** the existing document validator's output rather than restating it.
A page's validity has exactly one definition.

---

## 2. `@craftkit/builder-core` — added commands

All registered exactly like `coreCommands`, with per-command zod arg schemas, and dispatched through
the same door. `CoreCommandName` widens.

| Command           | Args                                              | Requirement      |
| ----------------- | ------------------------------------------------- | ---------------- |
| `addPage`         | `{ address, title, purpose, audience, regions? }` | FR-003, FR-005   |
| `removePage`      | `{ pageId }`                                      | FR-003, FR-005   |
| `renamePage`      | `{ pageId, title?, address? }`                    | FR-003, FR-005   |
| `reorderPage`     | `{ pageId, toIndex }`                             | FR-003           |
| `setSharedRegion` | `{ regionId, kind, document }`                    | FR-004           |
| `setPageRegions`  | `{ pageId, regions }`                             | FR-004 (opt-out) |
| `setDesignToken`  | `{ token, value }`                                | FR-012           |
| `setDesignSystem` | `{ system }`                                      | FR-013           |
| `registerAsset`   | `{ entry }`                                       | FR-044           |

**Refusals** (each a command-level validation failure, never a partial write):

- `addPage` with an address that already exists.
- `removePage` on the last remaining page, or on the home page while others exist.
- `setPageRegions` naming a region the site does not hold.
- `setDesignToken` with a token outside the closed `TokenName` union.
- `setDesignSystem` whose `pairings` fail the contrast gate.
- Any asset reference introduced by a command whose `assetId` is not in `site.assets`.

### Grouped dispatch (new, required)

```ts
export interface GroupedDispatchOptions {
  author: Author;
  label: string;
}
export function dispatchGroup(
  kernel: BuilderKernel,
  commands: readonly { command: string; args: unknown }[],
  options: GroupedDispatchOptions,
): DispatchResult;
```

**Why this is in scope and not optional.** `applyAiPlan()` reports `mode: 'sequence'` today because
the kernel has no transaction-group API, so a multi-command plan costs several undo steps. FR-034
and FR-037 require one generation and one refinement to each be **one** undo step.
`@craftkit/builder-ai` must not fake grouping by writing patches around the door — its own README
forbids exactly that — so the contract belongs here, at layer 1.

Semantics: all commands succeed or none apply; one history entry; one `author`; the label is what a
person sees in the recent-change strip.

---

## 3. `@craftkit/builder-transforms` — added exports

```ts
export const SITE_MANIFEST_PROJECTION_ID: 'site-manifest';

export function projectSite(site: BuilderSite): SiteProjectionText;
export function parseSite(
  text: SiteProjectionText,
  base: BuilderSite,
  ports: CodecPorts,
): ParseResult;

export interface SiteProjectionText {
  /** Page order, shared regions, design system, asset table. No page content. */
  manifest: string;
  /** Keyed by PageId. Each is exactly what projectDocument() produces today. */
  pages: Readonly<Record<PageId, string>>;
  regions: Readonly<Record<SharedRegionId, string>>;
}
```

### Laws

1. **Manifest law** (new) — `parseManifest(projectManifest(m)) ≡ m` over generated manifests. 1,000
   `fast-check` cases, fixed seeds, merge-blocking.
2. **Composition law** (new) — `projectSite(s)` decomposes into exactly its manifest plus one text
   per page and region; recomposition is order-independent and lossless.
3. **Page law** (unchanged) — `parseDocument(projectDocument(d)) ≡ d`, reused verbatim, not
   re-derived.
4. **Non-vacuity** (extended) — a `parseSite` that returns an empty patch list forever must fail the
   gate, exactly as `parseDocument`'s gate does today.

**Why the projection is a structured object rather than one string**: it is what makes law 3
reusable and what keeps per-page editing from re-serializing the whole site.

---

## 4. `@craftkit/builder-code-view` — protocol additions

```ts
export type TransformScope =
  | { readonly kind: 'document' } // unchanged
  | { readonly kind: 'node'; readonly nodeId: string } // unchanged
  | { readonly kind: 'site' } // new
  | { readonly kind: 'page'; readonly pageId: string }; // new
```

The existing `TransformDocumentMessage` channel carries the site when the scope is site-level. The
`generation` counter still increments on **input arrival**, so staleness detection is unaffected by
payload size.

**Obligation**: feature 011's SC-005 is re-proved at site scope — the codec must remain
un-importable from main-thread modules (static proof) and must be invoked zero times in the render
realm during a typing burst (counted, not timed). Existing tests are extended, not replaced.

---

## 5. Compatibility

| Consumer                     | Effect                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| Existing single-page apps    | None. `BuilderDocument` unchanged at `schemaVersion 1`.    |
| `@craftkit/builder-renderer` | Resolves the theme from site data; re-exports moved types. |
| `@craftkit/builder-shell`    | Additive only.                                             |
| `apps/playground`            | Opts in by calling `siteFromDocument()`.                   |
| `apps/adaptive-spec-router`  | **Untouched** — out of scope per `HANDOFF.md`.             |

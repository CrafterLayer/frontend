# Contract: Five-Stage Pipeline and Stage Wire Format

**Owner**: `@craftkit/builder-ai` (layer 2)

This widens the pattern `src/provider/wire.ts` already established for single plans. It does not
invent a second admission path: **stage five emits commands, and those commands go through the same
registry lookup, per-command arg schema, and scratch-kernel dry run that exists today.**

---

## 1. The port

```ts
export interface SiteStageProvider {
  sitemap(req: SitemapRequest, opts?: StageOptions): Promise<SitemapResponse>;
  structure(req: StructureRequest, opts?: StageOptions): Promise<StructureResponse>;
  content(req: ContentRequest, opts?: StageOptions): Promise<ContentResponse>;
  designSystem(req: DesignSystemRequest, opts?: StageOptions): Promise<DesignSystemResponse>;
  assembly(req: AssemblyRequest, opts?: StageOptions): Promise<AssemblyResponse>;
}

export interface StageOptions {
  /** Cancels for real — the provider must stop, not discard. Surfaces as AbortError. */
  signal?: AbortSignal;
  /** The provider's own words about what it is doing now. Feeds FR-021's live line. */
  onProgress?: (text: string) => void;
}
```

`StageOptions` is deliberately identical in shape and meaning to the existing `AiProposeOptions`, so
the SSE `status`-frame progress channel `remote-provider.ts` already implements carries per-stage
narration with no new transport.

---

## 2. Wire contract

```ts
export const SITE_STAGE_WIRE_VERSION = 1;

interface StageEnvelope {
  version: typeof SITE_STAGE_WIRE_VERSION;
  stage: 'sitemap' | 'structure' | 'content' | 'design-system' | 'assembly';
  /** FR-024 / SC-013. Every stage receives it; the same seed reproduces the same site. */
  seed: string;
  /** FR-025. Stated, enforced, and reported when exceeded — never silently truncated. */
  limits: { maxPages: number; maxSectionsPerPage: number };
}
```

**Each stage request is self-contained.** It carries everything the stage needs, including prior
stages' outputs, and never depends on state the client held between calls.

That property is the entire mechanism behind FR-027: a future server can implement all five stages
behind one endpoint, in one process, with **no change to the client**, precisely because no call
depends on client-held continuity.

| Stage           | Request carries                                                          | Response                                   |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| `sitemap`       | envelope, `brief`                                                        | `SitemapPlan` or `{ refusal }`             |
| `structure`     | envelope, `brief`, `sitemap`, `blocks` (registered vocabulary)           | `StructurePlan[]` or `{ refusal }`         |
| `content`       | envelope, `brief`, `sitemap`, `structure`                                | `CopySet[]` or `{ refusal }`               |
| `design-system` | envelope, `brief`, `sitemap`, `tokenNames` (closed union)                | `DesignSystem` or `{ refusal }`            |
| `assembly`      | envelope, all prior outputs, `blocks`, `assets` (the library's contents) | `{ rationale, commands }` or `{ refusal }` |

`blocks` reuses the existing `AiBlockContext` shape — model-facing descriptions, JSON Schema prop
summaries, few-shot examples, accepted slots — so the vocabulary the agent sees is the one the
registry actually holds.

A refusal at any stage is a **stage failure**: nothing is written, the failing stage and reason are
reported, and a retry is offered (FR-023).

---

## 3. Orchestration

```ts
export function generateSite(options: {
  kernel: BuilderKernel;
  provider: SiteStageProvider;
  assets: AssetLibraryPort;
  brief: SiteBrief;
  validationPorts: AiValidationPorts; // dedicated; never borrow the live kernel's
  signal?: AbortSignal;
  onStage?: (event: { stage: string; phase: 'start' | 'done'; summary?: string }) => void;
}): Promise<GenerationRun>;
```

Guarantees:

| Guarantee                                                                    | Requirement    |
| ---------------------------------------------------------------------------- | -------------- |
| A stage does not begin until its dependency produced a **valid** result      | FR-017         |
| Every intermediate is schema-checked before use                              | FR-017, FR-029 |
| `onStage` fires `start` and `done` for all five                              | FR-021         |
| Cancellation stops the work and writes nothing                               | FR-022, SC-010 |
| Any failure writes nothing and names the stage                               | FR-023, SC-010 |
| Same brief + same seed ⇒ identical site                                      | FR-024, SC-013 |
| Exceeding `limits` is reported, never silently truncated                     | FR-025         |
| The result is **commands**, applied through `dispatchGroup` as one undo step | FR-030, FR-034 |

**`validationPorts` must be dedicated.** The existing README is explicit: a preflight insertion
consumes ids in the scratch session, so borrowing the live kernel's stateful ports hands out ids the
real document then claims. Five stages make this sharper, not softer.

---

## 4. Refinement

```ts
export function refineSite(options: {
  kernel: BuilderKernel;
  provider: SiteStageProvider;
  request: string;
  site: BuilderSite;
  validationPorts: AiValidationPorts;
  signal?: AbortSignal;
}): Promise<RefinementResult>;
```

Order of operations, and it matters:

1. **Resolve the target first.** An unresolvable page, section, or property is refused here, before
   any command is proposed (FR-038). "Invent a plausible target" is not a reachable state.
2. Propose commands scoped to that target only.
3. Validate through the scratch kernel exactly as generation does.
4. Apply via `dispatchGroup` — **one** undo step (FR-037).

Guarantees:

| Guarantee                                                                                   | Requirement    |
| ------------------------------------------------------------------------------------------- | -------------- |
| Everything outside the named target is byte-identical, including post-generation hand edits | FR-036, SC-007 |
| A design-system request that would break contrast resolves to a compliant value and says so | FR-039         |
| No second write path — the same validate/apply machinery as generation                      | FR-040         |

---

## 5. Implementations

| Implementation                                | Where                   | Purpose                                                                                                                         |
| --------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `createOfflineSiteStageProvider()`            | `src/pipeline/offline/` | Deterministic, no network, no model. **Every acceptance scenario in the spec must be exercisable through it** (FR-028).         |
| `createRemoteSiteStageProvider({ endpoint })` | `src/pipeline/`         | One `fetch` per stage over the existing boundary; SSE `status` frames for progress; injectable `fetch`; typed transport errors. |
| `createScriptedSiteStageProvider()`           | `src/testing/`          | Consumer tests: force a refusal, a failure at stage _n_, or a fixed result, with no model.                                      |

The offline provider is not a stub. It is the reason SC-001, SC-010, SC-011, and SC-013 can be
measured in CI at all — every one of them is a timing, atomicity, or determinism claim that a
network would make unfalsifiable.

---

## 6. What this contract explicitly refuses

- **No API that accepts a generated document or a generated site.** The existing README states the
  rule the package exists to preserve; FR-030 extends it to sites. A provider that emits a site
  instead of commands is rejected at the port's type boundary.
- **No executable code path.** Composition from registered primitives only (FR-031).
- **No third attempt.** The existing one-shot `repair` semantics carry over per stage: a rejected
  stage result gets exactly one repair call with its issues, then fails.
- **No grouping faked in this package.** One undo step comes from `dispatchGroup` at layer 1, never
  from writing patches around the door.

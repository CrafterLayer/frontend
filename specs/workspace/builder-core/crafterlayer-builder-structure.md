# Crafterlayer Builder — Definitive Structure & Frozen Contracts (v1.0)

> **Status: reference material** — the executive source for the builder is
> `specs/workspace/003-builder-b0-kernel/` (spec, plan, contracts, tasks).

Companion to Master Plan v3. This is the document Claude Code builds from. Rationale lives in the
master plan; this file is **what** and **where**, tuned to this specific monorepo and product.

---

## 1. Project-Specific Tuning (what makes this yours, not generic)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Why it's strong _for this project_                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `surface: "site" \| "store" \| "docs" \| "console"` lives **on the document**, and `surfaces?: Surface[]` on every BlockDef                                                                                                                                                                                                                                                                                                                                                                                                    | The four-surface vision (marketing site, commerce, Mintlify-style docs, console) becomes a registry filter, not a future refactor. One builder, four products.                                                    |
| 2   | Shell ships **beautiful by default** — its own Tailwind v4 styling compiled to one prefixed `styles.css`, every value a `--bldr-*` CSS variable — plus a five-level customization ladder (tokens → classNames → data-attrs → component overrides → full headless export). No dependency on `@repo/ui`.                                                                                                                                                                                                                         | Consumers get a polished builder with one import and zero Tailwind requirement; Crafterlayer skins it via tokens from outside; the library stays OSS-clean.                                                       |
| 3   | `PersistenceAdapter` implemented **app-side** with `@repo/query`; auth/org/billing stay behind ports                                                                                                                                                                                                                                                                                                                                                                                                                           | Releaseo's proven estate (orgs, auth, billing, uploads) is reused, never re-imported into the builder. The builder stays backend-blind.                                                                           |
| 4   | Reserved `DataSource` ids: `mock` (playground) · `engine` (commerce v1) · `releaseo` (docs/changelog content later)                                                                                                                                                                                                                                                                                                                                                                                                            | Bindings written today (`engine.products`) survive the mock→real engine swap and the future Docs surface untouched.                                                                                               |
| 5   | **RTL law, two independent directions:** shell dir follows the builder UI locale (`shell/i18n/dir.ts`); **document dir is a document property** injected as `<html dir>` in the iframe. Everything uses CSS logical properties only (physical `ml-/mr-` lint-banned). TopBar ships a **dir-flip preview toggle** — ephemeral view state, never mutates the document; the real change is the `setDocMeta` command (a transaction, undoable). Rich-text leaves render `dir="auto"` so mixed Arabic/English bidi resolves itself. | An Arabic merchant builds Arabic UI over an English site or the reverse with zero conflict, and checks the other language's layout in one click. For this market that flip button is a sales feature, not polish. |
| 6   | Decisions and agent handoffs land in `specs/builder/` + a per-milestone addendum to `AGENTS.md`/`CLAUDE.md`                                                                                                                                                                                                                                                                                                                                                                                                                    | Matches the existing `.specify` workflow; every model that touches the repo inherits the constitution, which kills cross-model drift.                                                                             |
| 7   | `extensions/blocks-docs/` slot reserved; MDX projection already lives in `transforms`                                                                                                                                                                                                                                                                                                                                                                                                                                          | The Docs surface later is an extension + a projection you already own — not a new product build.                                                                                                                  |

---

## 2. The Frozen Five (contracts — these freeze; everything else may move)

**Purity rule:** `schema` and `core` have **zero runtime dependencies on React/DOM**. Type-only
imports (`import type { ComponentType } from "react"`) are permitted; value imports are an eslint
error.

```ts
// ── 1 · Document ─────────────────────────────────────────────
type NodeId = string; // nanoid; stable forever; never reused
type DataPath = string; // "engine.products", "page.title"
type Breakpoint = 'tablet' | 'mobile';
type Surface = string; // consumer-defined; Crafterlayer uses
// "site" | "store" | "docs" | "console"

interface BuilderDocument {
  schemaVersion: number; // migrations registered from day one
  surface: Surface;
  dir: 'ltr' | 'rtl'; // CONTENT direction — injected as <html dir>
  // inside the iframe; independent of shell UI dir
  rootId: NodeId;
  nodes: Record<NodeId, Node>; // FLAT — never nested
}
interface Node {
  id: NodeId;
  type: string; // registry key
  props: Record<string, unknown>; // intent values only — never px, never hex
  bindings?: Record<string, DataPath>;
  variantOf?: string; // instance-level widget skin override
  responsive?: Partial<Record<Breakpoint, Record<string, unknown>>>;
  // desktop is base; cascade base←tablet←mobile
  children?: NodeId[]; // order lives here
}
```

```ts
// ── 2 · BlockDef ─────────────────────────────────────────────
interface BlockDef<P extends z.ZodTypeAny = z.ZodTypeAny> {
  type: string;
  description: string; // written FOR the model, not the human
  surfaces?: Surface[]; // default: all four
  props: P; // enums over free numbers; intent over pixels
  slots?: Record<string, { allow: string[]; max?: number }>;
  bindings?: Record<string, { shape: z.ZodTypeAny; required?: boolean }>;
  examples: Array<{ prompt: string; node: unknown }>; // few-shots for AI
  render: ComponentType<BlockRenderProps<z.infer<P>>>; // type-only React
}
// Derivations (automatic): z.infer types · runtime validator · z.toJSONSchema()
// for AI context · auto-inspector · few-shot assembly.
```

```ts
// ── 3 · ExtensionManifest ────────────────────────────────────
interface ExtensionManifest {
  name: string;
  version: string;
  tier: 1 | 2; // 1 = official code · 2 = declarative from DB
  dependencies?: string[]; // topo-sorted at registration
  contributes?: {
    blocks?: BlockDef[];
    commands?: Record<string, CommandFactory>;
    panels?: PanelContribution[]; // slot: left | right | bottom | modal
    fieldTypes?: FieldTypeDef[];
    canvasTools?: OverlayToolDef[];
    projections?: ProjectionDef[];
    dataSources?: DataSourceDef[];
    aiContext?: AiContextProvider[];
    keymaps?: KeymapDef[];
  };
  setup?: (ctx: KernelContext) => void | (() => void); // returns dispose
}
// SECURITY LAW: tier 2 manifests must have setup === undefined and may contribute
// only declarative artifacts (compositions, skins, prop schemas). Executable code
// is tier-1 exclusive. Enforced in ExtensionManager, not by convention.
```

```ts
// ── 4 · Transaction (every mutation in the universe) ─────────
type Author = 'user' | 'ai' | 'codeview';
type Command<A> = (args: A) => (draft: BuilderDocument) => void; // Immer mutator

interface Transaction {
  command: string;
  author: Author;
  patches: Patch[]; // Immer produceWithPatches output
  inverse: Patch[]; // undo for free
  ts: number;
}
// dispatch(command, args, author) → applies · logs · pushes history · emits event.
// There is no second door. User, AI, and code view all pass through here.
```

```ts
// ── 5 · Ports (the only contact with the outside world) ──────
interface PersistenceAdapter {
  load(docId: string): Promise<{ doc: BuilderDocument; seq: number }>;
  append(docId: string, txs: Transaction[], expectedSeq: number): Promise<{ seq: number }>;
  // expectedSeq = optimistic concurrency (multi-tab safe)
  snapshot?(docId: string, doc: BuilderDocument, seq: number): Promise<void>;
}
interface DataSource {
  id: 'mock' | 'engine' | 'releaseo' | (string & {});
  resolve(path: DataPath, ctx: ResolveCtx): Promise<unknown>;
  schema(path: DataPath): z.ZodTypeAny | undefined; // powers mapping UI + validation
  subscribe?(path: DataPath, cb: (v: unknown) => void): () => void;
}
```

Review these five. If they hold, everything below is replaceable without pain.

---

## 3. Full Tree

```
packages/builder/                          ← grouping folder (no package.json)
│
│ ── TIER 0 · @repo/builder-schema ── (zod only; type-only React allowed)
│  schema/src/
│    index.ts
│    document/   types.ts · validate.ts (root exists, no cycles, no orphans) · migrations.ts
│    blocks/     define-block.ts [P4] · define-field-type.ts · style-values.ts (no-hex/no-px law)
│    extensions/ define-extension.ts [P4] · contribution-points.ts
│    widgets/    contract.ts (four states mandatory) · validate-skin.ts (the gate)
│    json-schema.ts (z.toJSONSchema → AI) · errors.ts (typed, path-addressed)
│
│ ── TIER 1 · @repo/builder-core ── (zustand vanilla, immer, nanoid; zero React/DOM)
│  core/src/
│    kernel/     create-builder.ts [P2] · context.ts
│    state/      store.ts (flat, per-node access) · selectors.ts · selection.ts
│    commands/   transaction.ts [P3] · commands.ts (insert/move/remove/setProp/
│                setBinding/setResponsive/setDocMeta[dir,surface,title]/duplicate/
│                wrap/group) · bus.ts (middleware)
│    patches/    types.ts (author) · apply.ts · log.ts (coalesce N patches / T sec → port)
│    history/    history.ts (inverse patches + typing merge) [P3+P8]
│    registry/   registry.ts (keyed maps, O(1) dispatch) [P4] · org-layer.ts (tier-2 hydration)
│    extensions/ manager.ts (register → topo → setup → dispose) · contributions.ts
│    events/     bus.ts (typed)
│    keymaps/    keymaps.ts (data only; shell binds tinykeys)
│    ports/      persistence.ts [P6] · data-source.ts [P6]
│    testing/    fixtures.ts (+1,000-node stress) · fake-extension.ts (B0 exit proof)
│
│ ── TIER 2 · ENGINES ──
│  react/src/       provider.tsx · hooks/{use-node,use-selection,use-command,use-registry}
│                   slots/slot.tsx
│  renderer/src/    render-static.ts (publish/diff, pure) · render-live.tsx (canvas,
│                   per-node subscribed) · resolve/{tokens.ts[cva],bindings.ts,responsive.ts}
│                   rich-text.tsx (TipTap JSON leaf · renders dir="auto" for mixed bidi) [P5]
│  transforms/src/  worker/{worker.ts,client.ts}[Comlink] · code/{project.ts,parse.ts}
│                   mdx/ · import-html/{parse,recognize,map} (B7) · publish/emit.ts
│                   roundtrip.spec.ts (fast-check law) [P5]
│  ai/src/          context/assemble.ts · validate/validate-output.ts · evals/{fixtures,run}
│
│ ── TIER 3 · @repo/builder-shell ── (self-contained Tailwind v4, dnd-kit, floating-ui, tinykeys)
│  shell/src/
│    BuilderShell.tsx (TopBar + Slots + Canvas layout, dir-aware)
│    styles/    theme.css (@theme → --bldr-* tokens: colors, radius, fonts, spacing)
│                dark via [data-bldr-mode="dark"] · RTL via logical utilities ONLY
│                (ms-/me-/ps-/pe-/start-/end- — physical ml-/mr- lint-banned)
│                → compiled at publish into one prefixed styles.css; consumers
│                  need ZERO Tailwind; in-monorepo today the app build scans sources
│    api/       overrides.ts (components={} + classNames={} props) ·
│                data-attrs on every part (data-bldr="palette-item", data-selected)
│                headless.ts (primitives re-export: useBuilder, Canvas, hosts unstyled)
│    canvas/    Canvas.tsx (vendored AutoFrame + portal + theme-var injection)
│                OverlayHost.tsx [P7] (rAF-batched, direct DOM, renders canvasTools)
│                rect-cache.ts (ResizeObserver-invalidated index) · dnd/ (vendored zones
│                → adapter over flat children)
│    panels/    PaletteHost · InspectorHost (schema→fields) · LayersTree (virtualized) · TopBar
│    preview/   PreviewMode.tsx — chrome hidden · render-live minus overlay/selection ·
│                interactions LIVE (buttons click, cart opens on mock data) · ESC exits ·
│                floating minimal bar: device presets + custom width + dir-flip (view state)
│    i18n/      messages/{ar,en}.ts · dir.ts        ← RTL from day one
│    vendor/puck/ + VENDOR.md + THIRD_PARTY_LICENSES.md
│
│ ── TIER 4 · extensions/ ── (each: defineExtension + block triads; never import each other)
│  blocks-marketing/  hero · features · pricing · testimonials · faq · cta · footer · navbar
│  blocks-commerce/   product-grid · buy-box · cart · categories · countdown
│  blocks-docs/       (reserved — Docs surface later)
│  widgets/           contract+skin+states system · binding/mapping UI · four-state gate
│  fields/            vendored Puck controls (Zod-driven) + token-scale style sectors
│  code-view/         CodeMirror panel · worker-backed parse · patches out
│  ai-assistant/      prompt panel · DiffReview (static renderer ×2 + jsdiff) · accept/reject
│  devices/           preset widths (desktop / tablet 768 / mobile 390) + FREE custom width
│                      input + drag handle on the iframe edge. Editing breakpoints stay
│                      exactly three (base/tablet/mobile); the BUCKET RULE maps any custom
│                      width to its bucket (<768 mobile · 768–1023 tablet · ≥1024 desktop)
│                      and the inspector shows which bucket is being edited. DevTools
│                      flexibility without infinite-breakpoint hell. + responsive inspector tab
│  import-html/       (B7) paste → parse → recognize → AI-map to registry
│  history-panel/     (B7) timeline over the patch log
│
│ ── TIER 5 · @repo/builder (preset) ──
│  editor/src/  Builder.tsx = shell + default extension set (starter-kit). Apps import
│               THIS and nothing deeper.
│
apps/
  playground/   mounts <Builder/> with MockDataSource + in-memory persistence + fixtures.
                Zero backend. Zero auth. Zero imports from the main app.
  storybook/    every block · every state (including widget loading/empty/error/success)
```

**Block triad (the atomic unit, repeated everywhere):** every block = `schema.ts` + `render.tsx` +
`examples.ts`. No exceptions; the AI, the inspector, and the validator all rely on the triad's
completeness.

---

## 4. Wiring Into the Existing Monorepo

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'packages/builder/*'
  - 'packages/builder/extensions/*'
```

**Turbo boundaries (tags — match current Turbo syntax at implementation):** `schema` may depend on
nothing · `core` → schema · engines → core, schema · `shell` → engines only (styling self-contained)
· `extensions/*` → shell and below, **never each other** · `editor` → everything in builder · `apps`
→ `@repo/builder` only. Any violation fails CI.

**Internal-monorepo-inside-the-monorepo:** each `packages/builder/*` package carries its own
`turbo.json` (Turbo Workspace Configuration extending the root). Result: extraction to a standalone
OSS repo = move the `builder/` folder, add root `package.json` + `pnpm-workspace.yaml` +
`turbo.json`, wire a `tsup` + Tailwind CLI build for `dist/` + `styles.css` — an afternoon, because
every boundary was already clean.

**Purity enforcement (eslint, in schema + core):**

```js
"no-restricted-imports": ["error", { paths: ["react", "react-dom"], patterns: ["*.css"] }]
// + consistent-type-imports so `import type` from react stays legal in schema
```

**Public API discipline:** each package's `package.json` `exports` maps only `"."` →
`./src/index.ts`. Deep imports are impossible by construction — the single strongest maintenance
guarantee in the whole setup.

**Tasks:** `lint` · `typecheck` · `test` · `roundtrip` (transforms/schema) · `ai-evals` (schema/ai)
· `size-limit` (editor) · perf budgets (playground, Playwright). All cached; all merge-blocking.

---

## 5. Conventions

- Files kebab-case; components PascalCase inside.
- Tests colocated as `*.spec.ts(x)`; shared fixtures in each package's `testing/`.
- Every architectural decision → one short ADR in `specs/builder/adr-NNN-title.md` (context ·
  decision · consequences, ≤ 1 page).
- Every milestone ends with the executing model appending a **handoff note** to
  `specs/builder/handoff.md`: decisions taken, invariants introduced, things the next model must not
  touch.
- Commit style: `feat(core): …` / `feat(ext-widgets): …` — package-scoped, so Turbo cache and git
  history read the same way.

---

## 6. B0 Handoff Brief (paste this to Fable 5 in Claude Code)

> **Scope:** implement `@repo/builder-schema` and `@repo/builder-core` exactly per
> `crafterlayer-builder-structure.md` §2–§3 (Tier 0 + Tier 1 only). The Frozen Five contracts are
> verbatim — do not rename, do not extend. **Hard rules:** zero runtime React/DOM imports
> (eslint-enforced); every mutation flows through `dispatch` → Transaction; validator rejects hex/px
> literals and unknown types; tier-2 manifests with `setup` are rejected by the ExtensionManager.
> **Deliverables:** the two packages · `testing/fixtures.ts` incl. 1,000-node stress doc ·
> `fake-extension.ts` · workspace + turbo + eslint wiring from §4. **Exit criteria (all must pass
> headless, no DOM):** a fixture extension registers and its blocks appear in the registry with O(1)
> lookup; a page is built via commands only; undo/redo property-tested (fast-check) over random
> command sequences; document validation catches cycles/orphans/hex/px; patch log replays to an
> identical document; a tier-2 declarative manifest hydrates, a tier-2 manifest with code is
> rejected. **On completion:** append the handoff note to `specs/builder/handoff.md` and stop. Do
> not begin B1.

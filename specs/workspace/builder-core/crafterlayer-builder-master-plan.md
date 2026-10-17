# Crafterlayer Builder — Master Plan (v3, supersedes all previous)

> **Status: reference material** — the executive source for the builder is
> `specs/workspace/003-builder-b0-kernel/` (spec, plan, contracts, tasks).

**The one law:** the JSON document is the only source of truth. Canvas, code view, and AI are three
clients of it. HTML is never stored — only rendered.

---

## 1. The Architecture Answer: Kernel + Extensions

**Decision: extension architecture. Final.** The builder is organized like CodeMirror 6 and TipTap —
the two most respected editor architectures alive: a tiny **kernel** (`@repo/builder-core`) that
knows nothing about features, and **extensions** that contribute everything else through typed
contribution points.

**Naming convention (fixed vocabulary):**

- **Extension** = a code unit that contributes capabilities (blocks, commands, panels, tools) to the
  kernel. Internal + official.
- **Plugin** = a _distribution_ bundle of extensions + assets sold/shared on the marketplace at the
  org level. A plugin contains extensions; users install plugins.

**Why this is the professional answer — and why it's uniquely right for this product:**

1. **The kernel stays small and fast forever.** Features can never bloat the core because features
   physically live outside it.
2. **It is proven at the highest level.** CodeMirror ships ~20 packages around a kernel; TipTap
   ships 50+ extensions around `@tiptap/core`. This is not experimental architecture.
3. **It makes the product recursive — this is the killer property.** An org-created widget, a saved
   composition, a marketplace theme: these are _runtime extensions_ hydrated from DB rows through
   the **same ExtensionManager** that loads official extensions at build time. The marketplace is
   not a separate system bolted on later — it is the extension system with a payment gate. One
   mechanism, three tiers:

```
Tier 1  Official extensions   — code, ships with the platform
Tier 2  Org extensions        — declarative rows from DB (blocks, skins, compositions)
Tier 3  Marketplace plugins   — Tier-2 artifacts, packaged, versioned, distributed
```

**Security law of the tiers:** Tier 1 is executable code. Tiers 2–3 are **declarative artifacts
only** — manifests, prop schemas, skins, node trees — validated against `builder-schema`, never
executable JS from the database. This single rule is what lets user content flow through the
extension system without ever creating a code-injection surface.

---

## 2. Package Taxonomy (complete, professional)

```
packages/builder/                          ← grouping folder (no package.json)
│
│  ── TIER 0 · CONTRACTS ──
│  schema/            @repo/builder-schema        zod only. defineBlock, defineExtension,
│                                                 defineFieldType, document types, validators.
│                                                 Zero dependencies. The constitution.
│
│  ── TIER 1 · KERNEL ──
│  core/              @repo/builder-core          zustand(vanilla), immer, nanoid.
│                                                 Document store · command bus · patch pipeline ·
│                                                 history · selection · typed event bus · keymap
│                                                 service · ExtensionManager + contribution points.
│                                                 Zero React. Zero DOM. Fully headless-testable.
│
│  ── TIER 2 · ENGINES ──
│  react/             @repo/builder-react         React bindings: <BuilderProvider>, useNode(id),
│                                                 useSelection, useCommand, <Slot name=...>
│  renderer/          @repo/builder-renderer      doc→React. Two modes: live (per-node subscribed,
│                                                 for canvas) and static (pure, for publish/diff).
│                                                 cva, clsx, tailwind-merge, @tiptap/core, shiki.
│  transforms/        @repo/builder-transforms    projections: doc↔code, doc↔MDX, doc→publish,
│                                                 importHtml. acorn(+jsx), unified/remark-mdx.
│                                                 Runs in a Web Worker (§7).
│  ai/                @repo/builder-ai            assembleContext · validateOutput · evalSuite.
│                                                 zod only. No SDK, no network.
│
│  ── TIER 3 · SHELL (the hosts) ──
│  shell/             @repo/builder-shell         The chrome that HOSTS contributions:
│                                                 Canvas (vendored AutoFrame iframe + portal),
│                                                 OverlayHost (renders canvasTool contributions),
│                                                 InspectorHost (renders schema→field contributions),
│                                                 PaletteHost, LayersTree, TopBar, panel Slot system.
│                                                 @dnd-kit/* + vendored Puck zone layer,
│                                                 @floating-ui/react, tinykeys.
│
│  ── TIER 4 · EXTENSIONS ──
│  extensions/
│    blocks-marketing/  ext: hero, features, pricing, testimonials, faq, cta, footer, navbar
│    blocks-commerce/   ext: product grid, buy box, cart, categories, countdown
│    widgets/           ext: contract+skin+states system, binding/mapping UI, four-state gate
│    fields/            ext: field-type renderers (vendored Puck controls, Zod-driven) +
│                            token-scale style sectors (GrapesJS-inspired, token-constrained)
│    code-view/         ext: CodeMirror panel, worker-backed parse, patches out
│    ai-assistant/      ext: prompt panel, DiffReview (visual + code diff), accept/reject
│    devices/           ext: responsive switcher (iframe width) + responsive-override inspector tab
│    import-html/       ext: paste HTML/URL → parse → recognize → map to registry (AI-assisted)
│    history-panel/     ext: version timeline over the patch log
│    assets/            ext (later): asset browse/upload panel
│
│  ── TIER 5 · PRESET ──
│  editor/            @repo/builder               The facade & starter-kit (TipTap-style):
│                                                 <Builder/> = shell + default extension set.
│                                                 Apps import THIS and nothing deeper.
│
apps/
  playground/         isolation harness (§9) — mounts <Builder/> with mocks, zero backend
  storybook/          every block, every state
```

**Workspace globs:** `packages/builder/*` + `packages/builder/extensions/*`. All internal-packages
mode (export `./src/index.ts`, no build step).

**Dependency law (Turbo `boundaries`, CI-fatal):**

```
schema ← core ← { react, renderer, transforms, ai } ← shell ← extensions/* ← editor ← apps
```

Two hard rules on top: **extensions never import each other** — cross-extension communication
happens only through the command bus and events (prevents extension spaghetti, guarantees any
extension can be deleted); and **nothing in `packages/builder/*` imports from `apps/*`.**

---

## 3. The Extension Contract

```ts
// @repo/builder-schema
export const myExtension = defineExtension({
  name: "blocks-marketing",
  version: "1.0.0",
  dependencies: [],                       // topo-sorted at registration
  contributes: {
    blocks:        BlockDef[],            // → palette, renderer, AI context
    commands:      CommandMap,            // → command bus, keymaps, AI actions
    panels:        PanelContribution[],   // → shell Slot system (left|right|bottom|modal)
    fieldTypes:    FieldTypeDef[],        // → InspectorHost
    canvasTools:   OverlayToolDef[],      // → OverlayHost (badges, spacing viz, resizers)
    projections:   ProjectionDef[],       // → transforms runner (code view, MDX, import)
    dataSources:   DataSourceDef[],       // → binding resolver
    aiContext:     AiContextProvider[],   // → builder-ai assembler
    keymaps:       KeymapDef[],
  },
  setup(ctx) { /* store, bus, registry access; return dispose() */ },
});
```

**Lifecycle:** `register → resolve deps (topological) → setup(ctx) → dispose`. All contribution
registries compile once into keyed maps at init — **O(1) dispatch at runtime**, no lookup cost per
interaction.

**Runtime (Tier-2) loading:** org rows from the DB hydrate into the same manifest shape —
`{ contributes: { blocks: [...] } }` — pass `builder-schema` validation, and register through the
same manager. The palette, the AI, and the renderer cannot tell an org block from an official one.
That is the recursion, delivered.

---

## 4. Document Model (normative)

```ts
interface BuilderDocument {
  schemaVersion: number; // migration fns from day one
  rootId: NodeId;
  nodes: Record<NodeId, Node>; // FLAT — never nested
}
interface Node {
  id: NodeId; // nanoid; stable forever; never reused
  type: string; // registry key
  props: Record<string, unknown>; // intent values only — never px, never hex
  bindings?: Record<string, DataPath>; // "engine.products", "page.title"
  variantOf?: string; // instance-level widget skin override
  responsive?: Partial<Record<'tablet' | 'mobile', Record<string, unknown>>>;
  // prop overrides; desktop base; cascade base←tablet←mobile
  children?: NodeId[]; // order lives here
}
```

Non-negotiables: every mutation is a command emitting Immer `produceWithPatches` (forward → log,
inverse → undo); rich text is TipTap JSON inside a prop — ProseMirror never owns the page; the
validator rejects hex/px literals; responsive overrides pass the same validator, media queries exist
only in published output; persistence = `documents` JSONB + append-only `patches` (author:
user|ai|codeview) + snapshot every 50–100 patches.

**Registry derivation (one manifest → five consumers):** `defineBlock` → TS types (z.infer) ·
runtime validator · JSON Schema (`z.toJSONSchema()`) for AI · auto-inspector · few-shot examples.
Naming law: same name for same concept everywhere; enums over free numbers; intent over pixels.

---

## 5. Widgets & Org Library (unchanged, now expressed as extensions)

`extensions/widgets` implements: **contract locked · binding locked · skin free · four states
mandatory · gate at save · variants never overwrites · promote-to-default explicit · secrets are
org-level name refs.** Saved compositions publish instantly (made of validated vocabulary); new
_types_ pass the gate. Both land in the Tier-2 registry as versioned **snapshots** — "track latest"
is opt-in per instance.

---

## 6. AI (unchanged contract, extension delivery)

`@repo/builder-ai` stays three pure functions (assembleContext, validateOutput, evalSuite — golden
metric: first-attempt validation pass rate, in CI). `extensions/ai-assistant` delivers the UX:
prompt panel, DiffReview (static renderer ×2 + jsdiff), accept/reject per change, all landing as
patches through the command bus. Model calls live server-side in the app.

---

## 7. Performance Playbook — the "legendary" section

Every item here is a decision, not a hope. Grouped by phase, with CI enforcement at the end.

**Interaction (the 16 ms budget):**

1. **Per-node subscriptions** — `useNode(id)` means a keystroke re-renders exactly one component on
   a 1,000-node page.
2. **Overlay hot path is React-free.** Selection/hover/drop chrome positions via direct DOM
   `transform` writes; ResizeObserver + passive scroll feed a single rAF-batched update;
   measured-rect cache invalidated by observer, **never** `getBoundingClientRect` per mousemove.
3. **Read/write phase discipline** — DOM reads batched before writes in overlay and dnd code; zero
   layout thrash by construction.
4. **Drag = transform-only clone**; drop-target hit-testing runs against the cached rect index.
5. **Structural sharing** — Immer patches touch only changed paths; the store never clones the
   world.

**Canvas (long documents):** 6. **`content-visibility: auto`** on top-level sections inside the
iframe — offscreen sections skip layout and paint entirely; the single cheapest big win for long
pages. 7. Images: `loading="lazy"` + `decoding="async"` in canvas; assets served pre-sized. 8.
**Iframe isolation** doubles as performance isolation: user CSS recalcs never invalidate builder
chrome, and vice versa.

**Heavy work off the main thread:** 9. **Transforms run in a Web Worker** (Comlink): code
projection, parse-back, importHtml, round-trip checks. Typing in the code view parses on debounce in
the worker — the canvas never stutters because of the parser. 10. **AI diff pre-render** computed
off the interaction path; DiffReview mounts with results ready.

**Startup & memory:** 11. **Extensions lazy-load their implementation.** Manifests register eagerly
(palette/AI know everything instantly); panel code (`code-view`, `ai-assistant`, `import-html`)
dynamic-imports on first open. 12. **Snapshot + tail loading** — a document opens from the latest
snapshot plus the patch tail: O(tail), not O(history). 13. **Layers tree virtualized** (TanStack
Virtual) above ~200 visible rows. 14. **Bundle budget enforced** with `size-limit` in CI: kernel +
shell initial JS under a fixed KB ceiling; every PR that grows it must say why.

**Persistence:** 15. **Patch coalescing** — persist every N patches or T seconds, background,
retry-safe; typing never awaits the network.

**CI enforcement (budgets are tests, not aspirations):** 16. keystroke→paint < 16 ms and 60 fps
sustained drag on the 1,000-node stress doc (Playwright trace assertions) · overlay updates cause
**zero** React renders (React Profiler assertion) · document load < 150 ms at 1,000 nodes ·
size-limit gate · a failed budget blocks merge and is fixed architecturally.

---

## 8. Source Mining (condensed; procedures unchanged)

**Puck (MIT — vendor, never depend):** pin commit → `VENDOR.md` + `THIRD_PARTY_LICENSES.md`; take
**AutoFrame** (→ shell Canvas), **drop-zone system on dnd-kit** (→ shell, rewired to flat
`children`), **field controls** (→ extensions/fields, Zod-driven), **overlay choreography** (logic →
OverlayHost). Do not take: data format, store, history, Config types.

**GrapesJS (BSD-3 — study only, Backbone-era, nothing transplants):** style-sector organization
(token-constrained in ours) · DeviceManager cascade UX (→ devices ext) · Parser + `isComponent`
recognition (→ import-html ext — parse, recognize, AI-map to registry: the migration wow-feature) ·
Symbols sync semantics (contrast with snapshots) · canvas spots (spacing viz → OverlayHost) ·
autosave cadence · **i18n of the editor chrome itself → the shell ships bilingual + RTL from day
one; for this market that is the product, not polish.** Do not take: HTML/CSS strings as truth,
selector styling, Backbone.

---

## 9. Isolation Guarantee — `apps/playground`

Vite app mounting `<Builder/>` with everything injected: fixture docs (empty / landing / commerce /
1,000-node stress), MockDataSource (fake commerce + fake reviews API with delay/failure toggles),
in-memory PersistenceAdapter, fixture registry. **Zero backend, zero auth, zero imports from the
main app** — and the reverse is physically impossible (boundaries). Worst case stays cheap: delete
`packages/builder/*` + `apps/playground`; the app contains no reference until graduation.

**Graduation checklist:** commands undo/redo cleanly · round-trip law green under fast-check
(`parse(project(doc)) ≡ doc`) · all perf budgets green on stress doc · AI evals ≥ 90% first-attempt
· Storybook covers every block/state · full loop: build → code-edit → AI-edit → export JSON →
re-import → identical render.

---

## 10. Milestones (hand to Claude Code one at a time, in order)

| M                  | Deliverable                                                                                                                                                              | Exit criterion                                                                                                                                                                                                                                                                                         | Size  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| **B0**             | `schema` + `core` kernel: model, store, commands, patches, history, selection, events, **ExtensionManager + contribution points**                                        | headless test registers a fixture extension, builds a page, undo/redo property-tested — no DOM anywhere                                                                                                                                                                                                | M–L   |
| **B1**             | `react` + `renderer` + Puck vendor pass + playground shell + **first real extension** (`blocks-marketing`, 5 blocks) proving the contract                                | fixture doc renders in AutoFrame with theme vars; token change recolors; extension registered at runtime                                                                                                                                                                                               | M     |
| **B2**             | `shell` canvas editing: vendored zone layer on flat model, OverlayHost + first canvasTool contributions, palette, layers                                                 | landing page built by hand at 60 fps; overlay causes 0 React renders                                                                                                                                                                                                                                   | **L** |
| **B3**             | InspectorHost + `fields` ext (vendored controls, Zod-driven) + TipTap leaf props + `devices` ext (presets + custom width + bucket rule) + **full Preview mode in shell** | new block ships with a working panel and zero panel code; tablet/mobile overrides edit + preview correctly; Preview hides all chrome with interactions live and ESC exits; any custom width maps to the correct editing bucket; dir-flip previews the opposite direction without mutating the document | M–L   |
| **B4**             | `transforms` in worker + `code-view` ext + round-trip law in CI                                                                                                          | fast-check green; visual ↔ code ↔ visual lossless; typing in code view never drops canvas frames                                                                                                                                                                                                       | M–L   |
| **B5**             | `builder-ai` + `ai-assistant` ext (DiffReview) + evals in CI                                                                                                             | scripted intents ≥ 90% first-attempt validation; accept lands as patches                                                                                                                                                                                                                               | M–L   |
| **B6**             | `widgets` ext + org library + **Tier-2 runtime loading from DB**                                                                                                         | Reviews widget built end-to-end; an org block hydrated from a DB row appears in palette + AI; graduation checklist green                                                                                                                                                                               | **L** |
| **B7** _(stretch)_ | `import-html` ext + `history-panel` ext                                                                                                                                  | paste a real site section → editable registry blocks; timeline scrubs the patch log                                                                                                                                                                                                                    | M     |

---

## 11. Quality Gates — what 10/10 means

| Mistake class                           | Caught by                                                         |
| --------------------------------------- | ----------------------------------------------------------------- |
| Architectural drift / coupling          | Turbo `boundaries` + extension-isolation rule (CI-fatal)          |
| Kernel bloat                            | contribution points: features physically cannot enter core        |
| Projection corruption                   | round-trip law under fast-check (CI-fatal)                        |
| AI hallucination reaching users         | validateOutput gate + retry loop + DiffReview                     |
| Schema change breaking AI comprehension | eval pass-rate in CI                                              |
| Performance regression                  | trace-based budgets + size-limit + zero-render assertion          |
| Broken widget shipped                   | four-state + required-field gate at save                          |
| Code injection via user content         | Tier-2 is declarative-only; executable code is Tier-1 exclusively |
| Product-direction error                 | playground: nothing touches the app before graduation             |
| License risk                            | VENDOR.md pin + THIRD_PARTY_LICENSES.md                           |

The gates — not confidence — are the guarantee.

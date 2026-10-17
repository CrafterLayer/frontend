# Builder View Contracts (normative)

Normative TypeScript contracts for `@craftkit/builder-react`, `@craftkit/builder-renderer`,
`@craftkit/builder` (preset), and `@craftkit/builder-blocks-marketing`. Kernel contracts from 003
([builder-kernel.md](../../003-builder-b0-kernel/contracts/builder-kernel.md)) are imported, never
redefined. Where prose elsewhere disagrees with these blocks, these blocks win.

## 1. Theming & responsive resolution (`@craftkit/builder-renderer`)

```ts
type TokenName =
  | 'surface'
  | 'surfaceInverse'
  | 'text'
  | 'textInverse'
  | 'textMuted'
  | 'accent'
  | 'accentText'
  | 'radius'
  | 'gap';
type Theme = Record<TokenName, string>;

declare const lightTheme: Theme;
declare const darkTheme: Theme;

/** { surface: '#fff' } → ':root{--t-surface:#fff;…}' (one managed style string). */
declare function themeToCssVars(theme: Theme): string;

/** 003 cascade: desktop = base; tablet = base←tablet; mobile = base←tablet←mobile. */
type RenderBreakpoint = 'desktop' | Breakpoint; // Breakpoint from 003
declare function resolveResponsiveProps(
  node: Node,
  breakpoint: RenderBreakpoint,
): Record<string, JsonValue>;
```

## 2. Live & static rendering (`@craftkit/builder-renderer`)

```ts
interface DocumentViewProps {
  /** Layer law: the kernel arrives BY PROP — this package never imports builder-react. */
  kernel: BuilderKernel;
  breakpoint?: RenderBreakpoint; // default 'desktop'
  /** Test/dev instrumentation (SC-002); no-op in production usage. */
  onBlockRender?: (nodeId: NodeId) => void;
}
// <DocumentView/> renders kernel.getDocument() from its root: each node subscribes
// via useSyncExternalStore over StateFacade.subscribeNode — one node change
// re-renders exactly one block view (FR-003). Unregistered types render
// <UnknownBlock type=…/> (FR-010). Slots render in document order; slot content is
// passed to the block's render as BlockRenderProps.slots (003 contract).

interface StaticDocumentProps {
  document: BuilderDocument;
  blocks: (type: string) => RegisteredBlock | undefined; // 003 RegistryRead.block shape
  breakpoint?: RenderBreakpoint;
}
// Pure: no kernel, no subscriptions, no effects — same input, same output (FR-006).

interface RenderStaticOptions {
  blocks: (type: string) => RegisteredBlock | undefined;
  breakpoint?: RenderBreakpoint;
}
declare function renderStaticMarkup(
  document: BuilderDocument,
  options: RenderStaticOptions,
): string;

interface UnknownBlockProps {
  type: string;
}

interface CanvasFrameProps {
  theme: Theme;
  dir: ContentDirection; // from 003
  title?: string; // iframe accessible name (default 'Preview')
  children: ReactNode;
}
// CanvasFrame mounts an isolation iframe: mirrors parent <style>/<link> into the
// frame head (initial copy + MutationObserver on document.head), injects one
// managed token <style> from `theme`, sets `dir` on the frame root, and portals
// `children` into the frame body (FR-008/FR-009/FR-018).
```

## 3. React bindings (`@craftkit/builder-react`)

```ts
interface BuilderProviderProps {
  kernel: BuilderKernel;
  children: ReactNode;
}

declare function useBuilder(): BuilderKernel; // throws outside the provider
declare function useNode(id: NodeId): Node | undefined; // per-node subscription
declare function useSelection(): readonly NodeId[];
declare function useDispatch(): BuilderKernel['dispatch'];
/** Bumps when extensions register/dispose — lets views re-read catalogs (FR-013). */
declare function useRegistryVersion(): number;

interface SlotProps {
  node: Node;
  name: SlotName;
  children: (childIds: readonly NodeId[]) => ReactNode; // render-prop; order = document order
}
```

## 4. Preset (`@craftkit/builder` — the only app-facing entrypoint)

```ts
interface BuilderProps {
  kernel: BuilderKernel;
  theme?: Theme; // default lightTheme
  breakpoint?: RenderBreakpoint; // default 'desktop'
  onBlockRender?: (nodeId: NodeId) => void;
}
// <Builder/> = BuilderProvider + CanvasFrame(dir from kernel, live via docMeta.changed)
//            + DocumentView. Apps compose controls around it with the exported hooks.

// The preset also OWNS the structural default set (starter-kit style):
declare const defaultBlocks: TrustedExtensionManifest; // name: 'builder-default-blocks'
// contributes the `page` block (components/Page — full contract): the document
// root container; slot `default` allows the marketing set plus 'announcement'
// (the runtime-demo type is pre-allowed by vocabulary — its RENDERER arrives only
// at runtime, which is exactly what FR-013 demonstrates).
//
// Re-export surface (curated): Builder, BuilderProvider, Slot, hooks,
// DocumentView, StaticDocument, renderStaticMarkup, CanvasFrame, UnknownBlock,
// themes/themeToCssVars/resolveResponsiveProps, createBuilder, openDocument,
// defineCommand, insertedNodeId, emptyDocument, defaultBlocks, blocksMarketing,
// and all public TYPE re-exports needed to use the above. "./testing" re-exports
// @craftkit/builder-core/testing verbatim.
```

## 5. Marketing blocks (`@craftkit/builder-blocks-marketing`)

```ts
declare const blocksMarketing: TrustedExtensionManifest; // name: 'blocks-marketing'

// Prop vocabularies (intent-only; all JSON-representable; defaults applied on insert):
// hero:         { tone: 'light'|'dark' = 'light'; align: 'start'|'center' = 'center';
//                 heading: string(1..80) = 'Your headline'; body?: string(..200) }
//               slots: { actions: { allow: ['cta'], max: 2 } }
// features:     { heading: string = 'Features'; columns: '2'|'3' = '3';
//                 items: Array<{ title: string; body: string }> = [] }
// pricing:      { heading: string = 'Pricing';
//                 plans: Array<{ name: string; price: string; period: 'month'|'year';
//                                features: string[]; highlighted?: boolean }> = [] }
// testimonials: { heading: string = 'Loved by teams';
//                 items: Array<{ quote: string; author: string; role?: string }> = [] }
// cta:          { label: string(1..40) = 'Get started'; emphasis: 'primary'|'ghost' = 'primary';
//                 note?: string(..80) }
//
// Each block folder: <Name>.tsx · <Name>.css · <Name>.stories.tsx · <Name>.docs.mdx
// · <Name>.test.tsx · index.ts · schema.ts (defineBlockSchema) · examples.ts
// (Arabic + English few-shots). CSS uses logical properties + var(--t-*) only.
// Accessibility: hero/testimonials/pricing/features are labelled <section>s with a
// heading; cta is a real <button>; lists use list semantics (FR-016).
```

## 6. Playground (`@craftkit/playground`)

```ts
declare function createPlaygroundKernel(options?: {
  fixture?: 'empty' | 'landing';
  dir?: ContentDirection;
}): BuilderKernel;
// Registers [defaultBlocks, blocksMarketing] (the REAL vocabulary — core's
// test-only fixtureBlocks are NOT used here; they would clash on 'hero' and stay
// kernel-test-internal). The playground authors its own marketing landing fixture
// (page → hero(+cta actions) → features → pricing → testimonials → cta) and uses
// seeded ids + fixed clock + memory persistence from "./testing". The SC-002
// stress assertions run in builder-renderer's tests with core's stress fixture —
// not in the playground.
// demo-extension.ts: one trusted manifest ('playground-demo') contributing an
// `announcement` block (type pre-allowed by page's vocabulary), registered at
// runtime by <RegisterDemoExtension/> and then inserted via a normal command.
```

## 7. As-implemented refinements (post-review, additive)

1. **Kernel-intrinsic catalog version.** `useRegistryVersion` (§3) and the renderer's
   `useRegistryEpoch` read their snapshot from `kernel.extensions.version()` — a monotonic counter
   the extension manager bumps on every successful registration, hydration, and disposal (added to
   003's `ExtensionManagerHandle`, additive). Deriving the value inside the event listener would
   drop a registration fired before a consumer's subscription attaches (the bus has no replay); the
   intrinsic snapshot is caught by `useSyncExternalStore`'s post-subscribe re-check, so
   FR-013/SC-005 hold under any mount order. Only RELATIVE bumps are contractual — construction-time
   registrations already count.
2. **Preset also exports `useKernelSelector`** (renderer's reference-stable selector hook) — used by
   the preset's own `Builder` for live `dir` and legitimately needed by apps; part of the §4 curated
   surface guarded by `surface.test.ts`.
3. **CanvasFrame StrictMode cleanup.** The style-mirroring effect's cleanup removes its clones (not
   just the observer), so StrictMode's dev-only mount→cleanup→remount cannot duplicate mirrored
   stylesheets.
4. **Storybook coverage includes `apps/playground`** stories/docs globs, so the five playground
   components pass the a11y error gate like every other UI component.
5. **Optional token vocabulary.** The playground's demo `announcement` success tone reads
   `var(--t-success, …)`/`var(--t-success-text, …)` — tokens OUTSIDE the §1 starter set, with
   fallbacks; themes MAY define them, the starter themes do not.
6. **Latent defect fixed during the 006 convergence audit — memoization self-reference.** The
   recursive `<NodeView/>` children inside `memo(function NodeView(){…})` bound to the inner
   function's own name (which shadows the memoized export), so the whole subtree re-rendered
   whenever a parent did. Invisible to B1's SC-002 proofs (setProp/undo never re-render a parent
   with mounted children); exposed by B2b's moveNode. The inner function is `NodeViewInner` and
   children reference the memoized export; the render-scope guarantees are now asserted for
   structural commands too (006 contract §10.1).

# Builder Kernel Contracts (normative)

Normative TypeScript contracts for `@craftkit/builder-schema` and `@craftkit/builder-core`. Where
prose elsewhere disagrees with these blocks, these blocks win. Laws are specified behaviorally in
[spec.md](../spec.md) (FR-001–FR-020); this file fixes their data shapes. Types referencing React
are **type-only** imports (`import type { ComponentType, ReactNode } from "react"`) — value imports
from React are lint-fatal in both packages.

## 1. Scalars & JSON purity

```ts
type JsonValue =
  | string
  | number // finite only — NaN/Infinity rejected at the door and by validation
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type NodeId = string; // IdPort-generated; stable forever; never reused
type SlotName = string; // non-empty; "default" reserved for ordinary children
type DataPath = string; // e.g. "engine.products", "page.title"
type Breakpoint = 'tablet' | 'mobile'; // desktop is the base; cascade base←tablet←mobile
type Surface = string; // consumer-defined; Crafterlayer: "site" | "store" | "docs" | "console"
type Author = 'user' | 'ai' | 'codeview';
```

## 2. Document model

```ts
interface BuilderDocument {
  schemaVersion: number; // migrations registered from day one (Law M)
  surface: Surface;
  dir: 'ltr' | 'rtl'; // CONTENT direction; shell UI dir never enters the kernel
  rootId: NodeId;
  nodes: Record<NodeId, Node>; // FLAT — never nested
}

interface Node {
  id: NodeId;
  type: string; // registry key into block schemas
  props: Record<string, JsonValue>; // JSON-pure BY TYPE (Law J); intent values only — no px/hex
  bindings?: Record<string, DataPath>;
  variantOf?: string; // instance-level widget skin override
  responsive?: Partial<Record<Breakpoint, Record<string, JsonValue>>>; // VALUES ONLY (Law R)
  slots?: Record<SlotName, NodeId[]>; // membership + order per named slot; empty arrays never stored
}
// Node is JSON-pure by construction; tier-2 stored subtrees reuse Node directly.
```

**Validator checklist** (each item has a negative test):

- Structural (document alone): root exists and appears in no slot · every non-root id appears in
  exactly one slot of exactly one parent · no duplicate id within a slot · no cycles · no orphans ·
  no stored empty slot arrays · every value `JsonValue` with finite numbers · slot names non-empty.
- Registry-aware (with catalogs): node types exist · each used slot name is declared by the parent's
  block schema · `allow` and `max` respected · props and responsive overrides parse against the
  block's prop schema · style values pass the no-hex/no-px law.

## 3. Errors (typed, path-addressed)

```ts
type BuilderErrorCode =
  | 'doc/root-missing'
  | 'doc/root-parented'
  | 'doc/orphan'
  | 'doc/cycle'
  | 'doc/duplicate-membership'
  | 'doc/duplicate-in-slot'
  | 'doc/dangling-child'
  | 'doc/empty-slot-array'
  | 'doc/id-mismatch'
  | 'doc/invalid-slot-name'
  | 'doc/unknown-type'
  | 'doc/unknown-slot'
  | 'doc/slot-not-allowed'
  | 'doc/slot-capacity'
  | 'doc/non-json-value'
  | 'doc/non-finite-number'
  | 'doc/raw-style-literal'
  | 'doc/invalid-props'
  | 'doc/migration-gap'
  | 'block/non-json-props'
  | 'cmd/unknown'
  | 'cmd/invalid-args'
  | 'cmd/structural-violation'
  | 'ext/cycle'
  | 'ext/duplicate'
  | 'ext/missing-dependency'
  | 'ext/tier2-executable'
  | 'ext/tier2-invalid'
  | 'widget/missing-states'
  | 'persist/seq-conflict';
// Implementation refinements (recorded during /speckit-implement): dangling-child,
// id-mismatch, and invalid-slot-name complete the structural checklist;
// block/non-json-props is the defineBlockSchema definition-time gate.

interface BuilderError {
  code: BuilderErrorCode;
  message: string;
  path?: (string | number)[]; // location inside document / manifest / args
  meta?: Record<string, JsonValue>;
}
```

## 4. Ports (Law D + persistence)

```ts
interface ClockPort {
  now(): number;
}
interface IdPort {
  newId(): NodeId;
}
// System implementations live ONLY in ports/system-clock.ts and ports/system-ids.ts;
// Date.now / Math.random / nanoid are lint-banned everywhere else in both packages.

interface PersistenceAdapter {
  load(docId: string): Promise<{ doc: BuilderDocument; seq: number; tail: Transaction[] }>;
  append(docId: string, txs: Transaction[], expectedSeq: number): Promise<{ seq: number }>;
  // stale expectedSeq rejects with persist/seq-conflict; stored history is untouched
  snapshot?(docId: string, doc: BuilderDocument, seq: number): Promise<void>;
}

interface ResolveCtx {
  surface: Surface;
  locale: string;
  signal?: AbortSignal;
}
interface DataSource {
  id: 'mock' | 'engine' | 'releaseo' | (string & {});
  resolve(path: DataPath, ctx: ResolveCtx): Promise<unknown>;
  schema(path: DataPath): z.ZodType | undefined; // powers mapping UI + validation (B1+)
  subscribe?(path: DataPath, cb: (v: unknown) => void): () => void;
}
```

## 5. Transactions & patches

```ts
type PatchOp = 'add' | 'remove' | 'replace'; // immer-compatible (verified v11 shape)
interface Patch {
  op: PatchOp;
  path: (string | number)[];
  value?: unknown;
}

interface Transaction {
  id: string; // IdPort-generated (Law D)
  command: string;
  author: Author;
  patches: Patch[]; // forward — appended to the log
  inverse: Patch[]; // undo for free
  ts: number; // ClockPort-generated (Law D)
}
// dispatch → validate args (Law V) → apply via produceWithPatches → assert patch
// values JsonValue+finite (Law J) → log → history push → scoped notify (FR-019).
// There is no second door (Law S): undo/redo apply inverse/forward patches through
// the same internal apply step and emit history events; they never create new
// transactions.
```

## 6. Commands (variance-safe registration — Laws V & C)

```ts
interface CommandRuntime {
  ids: IdPort;
} // deterministic id allocation inside commands

interface CommandInput<S extends z.ZodType> {
  // authoring shape — full inference, no `any`
  args: S;
  run: (args: z.output<S>) => (draft: BuilderDocument, rt: CommandRuntime) => void;
}

interface RegisteredCommand {
  // stored shape — variance-safe under strict TS
  argsSchema: z.ZodType; // exposed for docs + AI context assembly
  apply(args: unknown): (draft: BuilderDocument, rt: CommandRuntime) => void;
  // apply = (raw) => run(argsSchema.parse(raw)) — parsing INSIDE the door; malformed
  // args throw cmd/invalid-args before any state change.
}

declare function defineCommand<S extends z.ZodType>(def: CommandInput<S>): RegisteredCommand;
```

**Core command set** (args after parse; every structural rule violation throws
`cmd/structural-violation` with the offending path, leaving state untouched):

```ts
interface CoreCommands {
  insertNode: {
    type: string;
    props?: Record<string, JsonValue>;
    parentId: NodeId;
    slot?: SlotName /* default "default" */;
    index?: number; /* default: end */
  };
  // id allocated via rt.ids; inserting validates slot existence/allow/max
  removeNode: { id: NodeId }; // removes the whole subtree; never the root
  moveNode: { id: NodeId; toParentId: NodeId; toSlot?: SlotName; toIndex?: number };
  // rejects moves into self/descendant (cycle) and slot violations
  setProp: { id: NodeId; key: string; value: JsonValue };
  setBinding: { id: NodeId; key: string; path: DataPath | null }; // null clears
  setResponsive: { id: NodeId; breakpoint: Breakpoint; key: string; value: JsonValue | null };
  // null clears the override; structural keys are unrepresentable here (Law R)
  setDocMeta: { dir?: 'ltr' | 'rtl'; surface?: Surface }; // undoable like any command
  duplicateNode: { id: NodeId }; // deep-copies subtree with fresh rt.ids,
  // inserted after the original in the same slot
  wrapNode: {
    id: NodeId;
    wrapperType: string;
    wrapperProps?: Record<string, JsonValue>;
    wrapperSlot?: SlotName; /* default "default" */
  };
  // wrapper takes the node's place; node becomes wrapper's child
  groupNodes: { ids: NodeId[]; groupType: string; groupProps?: Record<string, JsonValue> };
  // ids must share parent+slot; extracted in document order into the
  // group's default slot; group inserted at the first id's position
}
type CoreCommandName = keyof CoreCommands;
```

## 7. Block schemas & extension manifests (Law T)

```ts
interface SlotDecl {
  allow: string[];
  max?: number;
}

interface BlockSchema<P extends z.ZodType = z.ZodType> {
  // declarative; NO render here
  type: string;
  description: string; // written FOR the model, not the human
  surfaces?: Surface[]; // default: all
  props: P; // enums over free numbers; intent over pixels;
  // defineBlockSchema rejects non-JSON-representable zod types
  slots?: Record<SlotName, SlotDecl>;
  bindings?: Record<string, { shape: z.ZodType; required?: boolean }>;
  examples: Array<{ prompt: string; node: JsonValue }>; // few-shots for AI
}
declare function defineBlockSchema<P extends z.ZodType>(def: BlockSchema<P>): BlockSchema<P>;

interface BlockRenderProps<P = unknown> {
  // consumed in B1+; type-only React here
  node: Node;
  props: P; // validated + responsive-resolved for the active breakpoint
  slots: Record<SlotName, ReactNode>;
  data: Record<string, unknown>; // resolved bindings
  isCanvas: boolean;
}

interface PanelContribution {
  id: string;
  slot: 'left' | 'right' | 'bottom' | 'modal';
  title: string;
  icon?: string;
  order?: number;
  when?: (ctx: KernelContext) => boolean;
  load: () => Promise<{ default: ComponentType<unknown> }>; // lazy by contract
}
interface FieldTypeDef {
  id: string;
  match(schema: z.ZodType): number; // priority score; 0 = no match; highest wins
  load: () => Promise<{ default: ComponentType<unknown> }>;
}
type OverlayToolRenderer = (t: {
  nodeId: NodeId;
  rect: unknown;
  layer: unknown;
  ctx: KernelContext;
}) => () => void; // mounts imperatively, returns cleanup — no React
interface OverlayToolDef {
  id: string;
  on: 'selection' | 'hover' | 'drag' | 'always';
  order?: number;
  load: () => Promise<{ default: OverlayToolRenderer }>;
}
interface ProjectionDef {
  id: string; // "code" | "mdx" | ...
  project(doc: BuilderDocument, scope?: { nodeId: NodeId }): string;
  parse(
    text: string,
    doc: BuilderDocument,
    scope?: { nodeId: NodeId },
  ): { ok: true; patches: Patch[] } | { ok: false; errors: { line: number; message: string }[] };
}
interface DataSourceDef {
  id: string;
  create(): DataSource;
}
interface ContextFragment {
  title: string;
  body: string;
  tokens?: number;
}
interface AiContextProvider {
  id: string;
  collect(ctx: KernelContext, selection: NodeId[]): ContextFragment;
}
interface KeymapDef {
  combo: string;
  command: string;
  when?: string;
} // data only

interface TrustedExtensionManifest {
  // tier 1 — code, ships with the platform
  tier: 1;
  name: string;
  version: string;
  dependencies?: string[]; // topologically ordered at registration
  contributes?: {
    blocks?: Array<{ schema: BlockSchema; render: ComponentType<BlockRenderProps> }>;
    commands?: Record<string, RegisteredCommand>;
    panels?: PanelContribution[];
    fieldTypes?: FieldTypeDef[];
    canvasTools?: OverlayToolDef[];
    projections?: ProjectionDef[];
    dataSources?: DataSourceDef[];
    aiContext?: AiContextProvider[];
    keymaps?: KeymapDef[];
  };
  setup?: (ctx: KernelContext) => void | (() => void); // returns dispose
}

// ── Tier-2 stored forms — every payload field JsonValue; functions unrepresentable ──
type SchemaDescriptor = JsonValue; // JSON-Schema subset; compiled to zod by Tier-1 at hydration
interface DeclarativeSubTree {
  rootId: NodeId;
  nodes: Record<NodeId, Node>;
}
interface CompositionDef extends DeclarativeSubTree {
  id: string;
  name: string;
  version: number;
  surfaces?: Surface[];
}
interface SkinDef {
  id: string;
  version: number;
  states: {
    loading: DeclarativeSubTree;
    empty: DeclarativeSubTree;
    error: DeclarativeSubTree;
    success: DeclarativeSubTree;
  }; // ALL FOUR — the gate
}
interface DeclarativeWidgetTypeDef {
  type: `widget:${string}`;
  contract: Record<string, { shape: SchemaDescriptor; required?: boolean }>;
  binding: { source: string; map: Record<string, string>; secretRef?: string };
  skins: SkinDef[];
  defaultSkin: string;
}
interface DeclarativeExtensionManifest {
  // tier 2 — pure data from the database
  tier: 2;
  name: string;
  version: string;
  contributes?: {
    compositions?: CompositionDef[];
    widgetTypes?: DeclarativeWidgetTypeDef[];
    skins?: SkinDef[];
  };
  // No setup, no render, no functions — unrepresentable at the type level; hydration
  // additionally runs validate-tier2 (structural function walk) on the raw row as
  // defense-in-depth and rejects with ext/tier2-executable naming the offending path.
}
type ExtensionManifest = TrustedExtensionManifest | DeclarativeExtensionManifest;
```

## 8. Kernel context & sealed store (Law S)

```ts
interface BuilderStateFacade {
  // read-only — no setState exists anywhere public
  getState(): Readonly<KernelState>;
  subscribe(listener: (state: Readonly<KernelState>) => void): () => void;
  subscribeNode(id: NodeId, listener: (node: Node | undefined) => void): () => void;
  select<T>(
    selector: (state: Readonly<KernelState>) => T,
    listener: (value: T) => void,
  ): () => void;
}

interface KernelState {
  doc: BuilderDocument;
  selection: NodeId[];
  seq: number; // persistence position
}

interface KernelContext {
  store: BuilderStateFacade;
  dispatch<K extends CoreCommandName>(
    command: K,
    args: CoreCommands[K],
    author?: Author,
  ): Transaction;
  dispatch(command: string, args: unknown, author?: Author): Transaction; // extension commands
  registry: ReadonlyRegistry; // O(1) keyed lookups
  events: EventBus; // typed emit/on
  readonly surface: Surface; // live, store-backed (Law L)
  readonly dir: 'ltr' | 'rtl'; // live, store-backed (Law L)
}
```

## 9. Registry, events, extension manager

```ts
interface ReadonlyRegistry {
  block(
    type: string,
  ): { schema: BlockSchema; render?: ComponentType<BlockRenderProps> } | undefined;
  blocks(surface?: Surface): ReadonlyArray<{ schema: BlockSchema }>;
  command(name: string): RegisteredCommand | undefined;
  keymaps(): ReadonlyArray<KeymapDef>;
  // additional contribution kinds readable by their point name; all lookups O(1)
}

type KernelEvents = {
  'tx.applied': { tx: Transaction };
  'history.undone': { tx: Transaction };
  'history.redone': { tx: Transaction };
  'docMeta.changed': { dir: 'ltr' | 'rtl'; surface: Surface };
  'extension.registered': { name: string; tier: 1 | 2 };
  'extension.disposed': { name: string };
};
interface EventBus {
  emit<K extends keyof KernelEvents>(event: K, payload: KernelEvents[K]): void;
  on<K extends keyof KernelEvents>(event: K, cb: (payload: KernelEvents[K]) => void): () => void;
}

interface ExtensionManager {
  register(manifest: TrustedExtensionManifest): void; // topo order; ext/cycle on cycles
  hydrateDeclarative(row: unknown): void; // validate-tier2 → register; all-or-nothing
  dispose(name: string): void; // releases contributions + setup resources
}
```

## 10. Migrations (Law M)

```ts
type Migration = (doc: unknown) => unknown; // vN-1 → vN, pure
declare const migrations: Record<number, Migration>; // keyed by TARGET version
// load path: migrate step-by-step to LATEST → validate → open.
// Any gap or failure throws doc/migration-gap; the document never half-opens.
```

## 11. Kernel factory (public API of @craftkit/builder-core)

```ts
interface CreateBuilderOptions {
  document?: BuilderDocument; // default: minimal empty document (root page node)
  surface?: Surface;
  dir?: 'ltr' | 'rtl';
  ports?: { clock?: ClockPort; ids?: IdPort; persistence?: PersistenceAdapter };
  extensions?: TrustedExtensionManifest[];
}
interface BuilderKernel {
  context: KernelContext;
  extensions: ExtensionManager;
  undo(): boolean;
  redo(): boolean; // false = empty stack no-op (safe)
  canUndo(): boolean;
  canRedo(): boolean;
  getDocument(): Readonly<BuilderDocument>;
  validate(): BuilderError[]; // structural + registry-aware
  dispose(): void;
}
declare function createBuilder(options?: CreateBuilderOptions): BuilderKernel;
```

## 12. Testing surface (`@craftkit/builder-core/testing`)

```ts
declare function createMemoryPersistence(): PersistenceAdapter;
declare function fixedClock(start?: number, step?: number): ClockPort; // deterministic
declare function seededIds(seed: string): IdPort; // deterministic
declare const fakeExtension: TrustedExtensionManifest; // registers fakeBox + fake.tag command
declare function emptyDocument(): BuilderDocument;
declare function landingFixture(): BuilderDocument; // small realistic doc
declare function stressDocument(nodes?: number): BuilderDocument; // default 1,000 nodes
```

## 13. As-implemented refinements (2026-08-25, recorded during /speckit-implement)

Binding deltas between the drafted blocks above and the shipped code; where they disagree, THIS
section wins:

1. **Type ownership rule.** Every pure contract in this file lives in `@craftkit/builder-schema`
   (including `Patch`/`Transaction`, ports, command shapes, contribution points, and the kernel
   contract); `@craftkit/builder-core` ships only implementations and re-exports. This makes "schema
   is the constitution" literal and keeps the layer law airtight.
2. **`KernelContext` is named `KernelApi`** (avoids implying a concrete class), with
   `store: StateFacade` exactly as §8's facade. `KernelEvents` is an interface.
3. **`CommandRuntime` = `{ ids: IdPort; blocks: BlockSchemaLookup }`** — structural guards (slot
   existence/allow/max, prop parsing with schema defaults) read the catalogs through the runtime,
   keeping command bodies pure.
4. **`setup` returns `(() => void) | undefined`** (a `void` union member is lint-invalid);
   implementations may simply not return.
5. **`RegistryRead` additionally exposes the tier-2 catalogs**: `composition(id)`,
   `compositions(surface?)`, `widgetType(type)`, `widgetTypes()` — hydrated and built-in content
   answer through the same API (ADR 0004).
6. **`Dispatcher`-style members are property-function typed** (`undo: () => boolean`) rather than
   methods, making unbound references safe by construction.
7. **`BuilderKernel` (shipped surface):** `context`, overloaded `dispatch`, `extensions` (`register`
   / `registerAll` topological / `hydrateDeclarative` / `dispose` / `has`), `registerExtension`
   alias, `undo`/`redo`/`canUndo`/`canRedo`, `getDocument`, `validate`, `setSelection` (kernel
   state, never a transaction), `transactions`, and `flush` (count-coalesced persistence;
   `PERSIST_COALESCE_EVERY = 25`, override via `persistence.coalesceEvery`). `createBuilder` accepts
   `persistence: { adapter, docId, coalesceEvery? }` and `initialSeq`; timer-based coalescing is
   impossible headless (no `setTimeout` in the ES2024 lib) and arrives with host environments in
   B1+.
8. **`openDocument(adapter, docId, { extensions, migrations, ports, coalesceEvery })`** implements
   the Law-M load path (load → migrate → fold tail → structural validate → open → registry-aware
   validate) and throws before a kernel exists on any failure.
9. **No-effect commands** (e.g. `setProp` to the identical value) produce an empty patch set: the
   returned transaction is NOT written, logged, undoable, or notified — the 1:1
   observable-change↔transaction pairing counts observable changes.
10. **Testing surface (final):** `fixedClock(start?, step?)`, `seededIds(seed)`,
    `emptyDocument(surface?, dir?)`, `fixtureBlocks` (page/section/hero/button/text/ box
    vocabulary), `landingFixture()`, `stressDocument(total = 1000)`, `fakeExtension`,
    `createMemoryPersistence()` with test helpers `seed(docId, doc, seq?)` and `dump(docId)`.
11. **Error taxonomy** already reflects implementation additions (see §3 note):
    `doc/dangling-child`, `doc/id-mismatch`, `doc/invalid-slot-name`, `block/non-json-props`.
12. **B1 additive change — `ExtensionManagerHandle.version()`:** a kernel-intrinsic monotonic
    catalog version (bumped on successful register/hydrate/dispose, never on failure) so view layers
    can read it as a `useSyncExternalStore` snapshot without the event bus's drop-before-subscribe
    gap. Purely additive; no existing member changed.
13. **SC-006 gate form:** the merge-blocking suite proves the property that guarantees the budget —
    load-invariant near-linear validation cost (interleaved 10×100-node vs 1×1,000-node measurement,
    ratio-bounded, with a generous absolute backstop) — because wall-clock assertions under parallel
    coverage-instrumented CI are Lane-B by the plan's own §4 split. The absolute "<150 ms" number
    remains recorded by the uncontended evidence runs.
14. **B3a additive change — `RegistryRead.fieldTypes()`:** the second typed consumer of the
    field-type contribution point (the canvasTools §12-style precedent): registration-ORDER catalog
    read (insertion order is contractual — resolution ties break by position), duplicate-id probe
    joined to the all-or-nothing registration check, disposal removal. Purely additive; no existing
    member changed.
15. **B3a ordering fix — the log precedes the notification:** `dispatch` now appends to the
    transaction log and records history BEFORE `store.write` (the observable moment). React's
    `useSyncExternalStore` checks snapshots SYNCHRONOUSLY inside the notification, so any subscriber
    deriving its snapshot from the log (`transactions().length`) saw a stale log and bailed out of
    the update — lagging one event behind forever. Found by the B3a playground transaction counter
    (its first single-write path: inspector commits produce no follow-up selection write to mask the
    lag). Regression-locked in kernel-laws.test.ts ("the transaction log is already complete AT the
    store notification"). `FieldProps.onChange` also moved to property-function style (variance and
    unbound-use safety; same runtime shape).
16. **B3b additive change — the rich-text schema module:** `richText()` (meta-marked strict
    whitelist validator), `isRichTextSchema()` (wrapper-unwrapping marker read), `emptyRichText()`,
    `richTextDocSchema`, and the `RichTextDoc` type family — layer 0, zero new dependencies (plain
    zod). Declaration is by META MARKER, so any package can declare rich props without touching the
    editing engine; the engine itself lives only in `@craftkit/builder-richtext` (008 contract §3
    e6). Purely additive.

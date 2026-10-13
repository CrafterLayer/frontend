import type { ComponentType, ReactNode } from 'react';
import { z } from 'zod';

import type { BlockPropertyGroup, BlockSchema } from '../blocks/define-block-schema';
import type { PartRef } from '../blocks/block-parts';
import type { CompositionDef, DeclarativeWidgetTypeDef } from '../widgets/contract';
import type {
  Author,
  BuilderDocument,
  ContentDirection,
  Node,
  NodeId,
  SlotName,
  Surface,
} from '../document/types';
import type { JsonValue } from '../json/json-value';
import type { DataSource } from '../ports';
import type { Patch, Transaction } from '../transactions';
import type { RegisteredCommand } from '../commands';
import type { FieldTypeDef } from './fields';

/** A direct slot child's renderer-safe, document-derived identity and props. */
export interface BlockSlotChildMetadata {
  readonly id: NodeId;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
}

/** Props a trusted block renderer receives (consumed from B1 on; type-only React here). */
export interface BlockRenderProps<P = unknown> {
  node: Node;
  /** Validated and responsive-resolved for the active breakpoint. */
  props: P;
  slots: Record<SlotName, ReactNode>;
  /**
   * Present only for slots whose schema opts into child metadata. Optional for
   * backward compatibility with existing renderers and direct component use.
   */
  slotChildren?: Readonly<Record<SlotName, readonly BlockSlotChildMetadata[]>>;
  /** Resolved bindings. */
  data: Record<string, unknown>;
  isCanvas: boolean;
}

/**
 * The ERASED, variance-safe stored type for block renderers: every concrete
 * `ComponentType<BlockRenderProps<P>>` is assignable to it (props are
 * contravariant, and `never` is assignable to any P). The live renderer casts
 * back at its single call boundary — the same erasure pattern as commands.
 */
export type BlockRenderComponent = ComponentType<BlockRenderProps<never>>;

export interface RegisteredBlock {
  schema: BlockSchema;
  /** Present for trusted registrations; declarative content resolves to Tier-1 renderers. */
  render?: BlockRenderComponent;
}

/**
 * Ephemeral focus on ONE element INSIDE a selected node's stored composition
 * (a custom-code tree). The selected node stays `selection[0]`; this names
 * which of its authored elements the person is editing, by position. Never
 * document data, never a transaction — the same law as `selection`.
 */
export interface ElementFocus {
  /** The document node hosting the tree; always the selected node. */
  readonly id: NodeId;
  /** Child indices from the tree root to the focused element. */
  readonly path: readonly number[];
}

// ── block-parts (2026-10-06) ──
/**
 * Ephemeral focus on ONE part of a selected registered block (block-parts
 * DESIGN §2.5): the block's heading, or the title of its third item. The same
 * law as `selection` and `elementFocus`: never document data, never a
 * transaction. It excludes `elementFocus`, and the kernel drops it once the
 * part instance no longer exists.
 */
export interface PartFocus extends PartRef {
  /** The document node owning the part; always the selected node. */
  readonly id: NodeId;
}
// ── /block-parts ──

export interface KernelState {
  doc: BuilderDocument;
  selection: NodeId[];
  /** Absent whenever the selection is a whole node (the common case). */
  elementFocus: ElementFocus | null;
  // ── block-parts (2026-10-06) ──
  /** Absent or null unless one part of the selected block is focused. Optional so existing literals compile. */
  partFocus?: PartFocus | null;
  // ── /block-parts ──
  /** Persistence position. */
  seq: number;
}

/** Read-only state surface (Law S) — no setState exists anywhere public. */
export interface StateFacade {
  getState(): Readonly<KernelState>;
  subscribe(listener: (state: Readonly<KernelState>) => void): () => void;
  /** Scoped notification (FR-019): fires only when THIS node's reference changes. */
  subscribeNode(id: NodeId, listener: (node: Node | undefined) => void): () => void;
  select<T>(
    selector: (state: Readonly<KernelState>) => T,
    listener: (value: T) => void,
  ): () => void;
}

export interface RegistryRead {
  /** Property-function style throughout: safe to pass around unbound. */
  block: (type: string) => RegisteredBlock | undefined;
  blocks: (surface?: Surface) => readonly RegisteredBlock[];
  command: (name: string) => RegisteredCommand | undefined;
  /**
   * Every live command name in REGISTRATION ORDER. Core commands therefore
   * precede extension commands, and disposing an extension removes its names.
   */
  commandNames: () => readonly string[];
  /**
   * Canvas tools sorted by ascending `order` (undefined last, ties by id).
   * B2a additive (005 contract §4): the first typed consumer of the point.
   */
  canvasTools: () => readonly OverlayToolDef[];
  /**
   * Field types in REGISTRATION ORDER — resolution ties break by position.
   * B3a additive (007 contract §2): the second typed consumer of the point.
   */
  fieldTypes: () => readonly FieldTypeDef[];
  /**
   * The editing surface for a declared inline kind — FIRST registration wins,
   * which is deterministic because extensions register in topological order.
   * B3c additive (009 contract §11): the third typed consumer of the point.
   */
  inlineEditor: (kind: InlineEditableKind) => InlineEditorDef | undefined;
  inlineEditors: () => readonly InlineEditorDef[];
  /**
   * Textual projections by id — declared since B0, first consumed by B4's code
   * view (011 contract §1). Registration order is stable; duplicate ids are
   * rejected all-or-nothing like every other typed point.
   */
  projection: (id: string) => ProjectionDef | undefined;
  projections: () => readonly ProjectionDef[];
  /**
   * Panels in REGISTRATION ORDER, filtered by slot when asked. Declared since
   * B0, first consumed by B4's code view: a panel's implementation is behind
   * `load()`, so registering one costs nothing until it is opened (SC-006).
   */
  panel: (id: string) => PanelContribution | undefined;
  panels: (slot?: PanelContribution['slot']) => readonly PanelContribution[];
  /** Trusted AI context providers in stable extension/manifest registration order. */
  aiContextProviders: () => readonly AiContextProvider[];
  keymaps: () => readonly KeymapDef[];
  /** Tier-2 catalogs — lookups behave identically for trusted and hydrated content. */
  composition: (id: string) => CompositionDef | undefined;
  compositions: (surface?: Surface) => readonly CompositionDef[];
  widgetType: (type: string) => DeclarativeWidgetTypeDef | undefined;
  widgetTypes: () => readonly DeclarativeWidgetTypeDef[];
}

export interface KernelEvents {
  'tx.applied': { tx: Transaction };
  'history.undone': { tx: Transaction };
  'history.redone': { tx: Transaction };
  'docMeta.changed': { dir: ContentDirection; surface: Surface };
  'extension.registered': { name: string; tier: 1 | 2 };
  'extension.disposed': { name: string };
}

export interface EventBus {
  emit<K extends keyof KernelEvents>(event: K, payload: KernelEvents[K]): void;
  on<K extends keyof KernelEvents>(event: K, cb: (payload: KernelEvents[K]) => void): () => void;
}

/**
 * The contract every extension setup/contribution receives. The schema layer owns
 * this shape (the constitution); the core layer implements it. Surface and dir are
 * LIVE store-backed reads (Law L), never registration-time snapshots.
 */
export interface KernelApi {
  store: StateFacade;
  dispatch(command: string, args: unknown, author?: Author): Transaction;
  registry: RegistryRead;
  events: EventBus;
  readonly surface: Surface;
  readonly dir: ContentDirection;
}

export type PanelProps = Record<string, unknown>;

export interface PanelContribution {
  id: string;
  slot: 'left' | 'right' | 'bottom' | 'modal';
  /** i18n key, resolved by the shell. */
  title: string;
  icon?: string;
  order?: number;
  when?: (ctx: KernelApi) => boolean;
  /** Lazy by contract — manifests register eagerly, implementations load on first open. */
  load: () => Promise<{ default: ComponentType<PanelProps> }>;
}

// The field-type contribution point lives in `./fields` (its own module since jsParams, 2026-10-12).
export type { FieldProps, FieldRowState, FieldSibling, FieldTypeDef } from './fields';

/** The kinds a block may declare through `inlineEditable` (B3c). */
export type InlineEditableKind = 'text' | 'rich';

/** A rectangle in the canvas overlay's LAYER-LOCAL space. */
export interface InlineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the current text selection is drawn. A selection spanning lines is not
 * one rectangle, so per-line rects travel with the union box and let the canvas
 * hug the line its toolbar actually opens against.
 */
export interface InlineSelectionAnchor {
  box: InlineRect;
  rects?: InlineRect[];
}

/**
 * A live selection anchor whose geometry is deliberately deferred.
 *
 * Non-null presence says there is something to format. The shell keeps this
 * descriptor out of React state and invokes `measure` only from its
 * frame-coalesced anchor-channel flush. The object wrapper is intentional: a
 * naked function handed to a React state setter would be invoked as an updater.
 */
export interface InlineSelectionAnchorSource {
  measure: () => InlineSelectionAnchor | null;
}

/**
 * Additive selection-report contract. Pre-B3c-closeout contributions may still
 * hand over an already measured anchor; current editors must use the deferred
 * source so selection interactions never force layout.
 */
export type InlineSelectionAnchorReport = InlineSelectionAnchor | InlineSelectionAnchorSource;

/** One button in the canvas's floating formatting bubble. */
export interface InlineFormatAction {
  id: string;
  /** Accessible label; the shell resolves i18n. */
  label: string;
  /** Present ONLY for toggles — a one-shot action carries no pressed state. */
  pressed?: boolean;
  disabled?: boolean;
  /** Exactly one transaction, with the selection preserved. */
  run: () => void;
}

/**
 * What an inline editor receives. The editor owns text semantics; the canvas
 * owns chrome and geometry — so the editor REPORTS its selection and the
 * actions available for it, and the shell draws the bubble. That split is why
 * the shell (layer 3) never imports an editing engine from an extension
 * (layer 4), and why the chrome looks the same whoever contributes the editor.
 */
export interface InlineEditorProps {
  value: unknown;
  /** The property being edited — the editor's accessible name. */
  label: string;
  /** ONE call per change; the canvas turns it into one dispatch. */
  onCommit: (next: unknown) => void;
  /** Escape, or any other reason the editor is done. */
  onExit: () => void;
  /**
   * Selection visibility plus its deferred anchor source, or null when there
   * is nothing to format. Geometry sources are invoked only by the shell's
   * frame-coalesced anchor channel. The measured-anchor branch is retained for
   * additive compatibility; new and first-party editors must report a source.
   */
  onAnchor: (report: InlineSelectionAnchorReport | null) => void;
  /** Actions for the CURRENT selection; an empty list shows no bubble. */
  onActions: (actions: InlineFormatAction[]) => void;
  /**
   * Ask the canvas to move focus to its first enabled formatting action.
   *
   * The editor supplies the only safe way back because it owns selection
   * semantics (DOM offsets, ProseMirror state, or another engine-specific
   * bookmark). The canvas returns true ONLY when host-document focus actually
   * moved; false leaves native Tab navigation untouched, so empty or fully
   * disabled chrome can never become a focus trap.
   */
  requestFormattingMenuFocus?: ((returnFocusToEditor: () => void) => boolean) | undefined;
  /**
   * The canvas's own formatting chrome (the floating bubble's host element),
   * when there is one. An editor reports its actions on focus changes, and
   * without this it cannot tell "focus moved to MY toolbar" from "focus left
   * editing" — so Tabbing toward a bubble button would unmount the very
   * control the user is moving to. Keep reporting while this element owns
   * focus. Optional: an editor that never reports on blur can ignore it.
   */
  formattingMenuElement?: Element | null | undefined;
}

/**
 * An editing surface for one declared inline kind (B3c). Lazy by contract, like
 * every other implementation-bearing contribution: registering the manifest must
 * not pull an editing engine into the bundle, so a session that never inline-edits
 * rich text never loads one.
 */
export interface InlineEditorDef {
  id: string;
  kind: InlineEditableKind;
  load: () => Promise<{ default: ComponentType<InlineEditorProps> }>;
}

/** Mounts imperatively into the overlay layer, returns cleanup — no React on the hot path. */
export type OverlayToolRenderer = (target: {
  nodeId: NodeId;
  rect: unknown;
  layer: unknown;
  ctx: KernelApi;
}) => () => void;

export interface OverlayToolDef {
  id: string;
  on: 'selection' | 'hover' | 'drag' | 'always';
  order?: number;
  load: () => Promise<{ default: OverlayToolRenderer }>;
}

/**
 * The vocabulary a projection's parser may consult without importing the
 * registry: the CALLER owns the registry and hands the parser this one
 * question. Without it a parser can only infer vocabulary from the base
 * document, which wrongly rejects REGISTERED types the document does not use
 * yet (011 T033 review, finding 5).
 */
export interface ProjectionPorts {
  blockExists(type: string): boolean;
}

/** Executed inside the transforms worker from B4 on. */
export interface ProjectionDef {
  id: string;
  project(doc: BuilderDocument, scope?: { nodeId: NodeId }): string;
  parse(
    text: string,
    doc: BuilderDocument,
    ports: ProjectionPorts,
    scope?: { nodeId: NodeId },
  ): { ok: true; patches: Patch[] } | { ok: false; errors: { line: number; message: string }[] };
}

export interface DataSourceDef {
  id: string;
  create(): DataSource;
}

export type ContextFragmentKind = 'instruction' | 'data';
export type ContextFragmentTrust = 'builtin' | 'reviewed' | 'untrusted';

/**
 * One attributable, role-preserving unit of additive model context.
 *
 * Built-in catalogs and document state do not travel through this channel;
 * they have one structured representation in the provider envelope. A
 * fragment is therefore always host, extension, memory, or Skill context and
 * must say where it came from and how it may be interpreted.
 */
export interface ContextFragment {
  readonly source: string;
  readonly kind: ContextFragmentKind;
  readonly trust: ContextFragmentTrust;
  readonly title: string;
  readonly body: string;
  readonly tokens?: number;
}

/**
 * Backward-compatible collector result. Assembly fills absent metadata with
 * the registered provider id, `data`, and `reviewed`, then validates the full
 * `ContextFragment`. New providers should declare all three fields.
 */
export type ContextFragmentInput = Omit<ContextFragment, 'source' | 'kind' | 'trust'> &
  Partial<Pick<ContextFragment, 'source' | 'kind' | 'trust'>>;

const contextFragmentSchema = z
  .object({
    source: z.string().min(1).max(256),
    kind: z.enum(['instruction', 'data']),
    trust: z.enum(['builtin', 'reviewed', 'untrusted']),
    title: z.string().max(512),
    body: z.string(),
    tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict();

/** Runtime validation and immutable detachment for wire-visible provenance. */
export function defineContextFragment(value: ContextFragment): Readonly<ContextFragment> {
  const parsed = contextFragmentSchema.parse(value);
  return Object.freeze({
    source: parsed.source,
    kind: parsed.kind,
    trust: parsed.trust,
    title: parsed.title,
    body: parsed.body,
    ...(parsed.tokens === undefined ? {} : { tokens: parsed.tokens }),
  });
}

/**
 * Least-authority store view handed to AI context collectors. Context assembly
 * is a read operation, so providers do not receive subscriptions or any kernel
 * write door.
 */
export interface AiContextStateRead {
  getState(): Readonly<KernelState>;
}

/** JSON-only block vocabulary exposed to prompt-context collectors. */
export interface AiContextBlockCatalogEntry {
  readonly type: string;
  readonly description: string;
  readonly propsSchema: JsonValue;
  readonly surfaces?: readonly Surface[];
  readonly inlineEditable?: string;
  /** Block-declared Inspector/design intent; values are detached JSON-like data. */
  readonly propertyGroups?: Readonly<Record<string, Readonly<BlockPropertyGroup>>>;
  readonly examples: readonly {
    readonly prompt: string;
    readonly node: JsonValue;
  }[];
  readonly slots: readonly {
    readonly name: SlotName;
    readonly allow: readonly string[];
    readonly max?: number;
  }[];
}

/** Data-only command summary. The registered implementation never crosses this boundary. */
export interface AiContextCommandCatalogEntry {
  readonly name: string;
  readonly argsSchema: JsonValue;
}

/** Bounded composition summary and its content direction; stored nodes never cross the boundary. */
export interface AiContextCompositionCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly surfaces?: readonly Surface[];
  readonly dir?: ContentDirection;
  readonly rootType: string;
  readonly nodeCount: number;
  readonly blockTypes: readonly string[];
}

/** Bounded widget summary; executable interpreters and stored payloads stay private. */
export interface AiContextWidgetCatalogEntry {
  readonly type: `widget:${string}`;
  readonly defaultSkin: string;
  readonly skinIds: readonly string[];
  readonly contractFields: readonly string[];
  readonly bindingSource: string;
}

/**
 * Safe registry catalog for prompt context: no command implementations or live contribution
 * objects; providers inspect detached, frozen summaries without obtaining a mutation path.
 */
export interface AiContextRegistryRead {
  block: (type: string) => AiContextBlockCatalogEntry | undefined;
  blocks: (surface?: Surface) => readonly AiContextBlockCatalogEntry[];
  commandNames: () => readonly string[];
  command: (name: string) => AiContextCommandCatalogEntry | undefined;
  commands: () => readonly AiContextCommandCatalogEntry[];
  composition: (id: string) => AiContextCompositionCatalogEntry | undefined;
  compositions: (surface?: Surface) => readonly AiContextCompositionCatalogEntry[];
  widgetType: (type: string) => AiContextWidgetCatalogEntry | undefined;
  widgetTypes: () => readonly AiContextWidgetCatalogEntry[];
}

/** The complete capability surface available to an AI context provider. */
export interface AiContextReadApi {
  readonly store: AiContextStateRead;
  readonly registry: AiContextRegistryRead;
  readonly surface: Surface;
}

export interface AiContextProvider {
  id: string;
  collect(ctx: AiContextReadApi, selection: readonly NodeId[]): ContextFragmentInput;
}

/** Data only; the shell binds the actual key handler. */
export interface KeymapDef {
  combo: string;
  command: string;
  when?: string;
}

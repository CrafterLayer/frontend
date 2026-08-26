import type { ComponentType, ReactNode } from 'react';
import type { z } from 'zod';

import type { BlockSchema } from '../blocks/define-block-schema';
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
import type { DataSource } from '../ports';
import type { Patch, Transaction } from '../transactions';
import type { RegisteredCommand } from '../commands';

/** Props a trusted block renderer receives (consumed from B1 on; type-only React here). */
export interface BlockRenderProps<P = unknown> {
  node: Node;
  /** Validated and responsive-resolved for the active breakpoint. */
  props: P;
  slots: Record<SlotName, ReactNode>;
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

export interface KernelState {
  doc: BuilderDocument;
  selection: NodeId[];
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
   * Canvas tools sorted by ascending `order` (undefined last, ties by id).
   * B2a additive (005 contract §4): the first typed consumer of the point.
   */
  canvasTools: () => readonly OverlayToolDef[];
  /**
   * Field types in REGISTRATION ORDER — resolution ties break by position.
   * B3a additive (007 contract §2): the second typed consumer of the point.
   */
  fieldTypes: () => readonly FieldTypeDef[];
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

export interface FieldProps {
  schema: z.ZodType;
  value: unknown;
  /** Into props or responsive[breakpoint]. */
  path: (string | number)[];
  /** The host wraps this into setProp / setResponsive dispatches. */
  onChange: (next: unknown) => void;
  disabled?: boolean;
}

export interface FieldTypeDef {
  id: string;
  /** Priority score; 0 = no match; highest wins. */
  match(schema: z.ZodType): number;
  load: () => Promise<{ default: ComponentType<FieldProps> }>;
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

/** Executed inside the transforms worker from B4 on. */
export interface ProjectionDef {
  id: string;
  project(doc: BuilderDocument, scope?: { nodeId: NodeId }): string;
  parse(
    text: string,
    doc: BuilderDocument,
    scope?: { nodeId: NodeId },
  ): { ok: true; patches: Patch[] } | { ok: false; errors: { line: number; message: string }[] };
}

export interface DataSourceDef {
  id: string;
  create(): DataSource;
}

export interface ContextFragment {
  title: string;
  body: string;
  tokens?: number;
}

export interface AiContextProvider {
  id: string;
  collect(ctx: KernelApi, selection: NodeId[]): ContextFragment;
}

/** Data only; the shell binds the actual key handler. */
export interface KeymapDef {
  combo: string;
  command: string;
  when?: string;
}

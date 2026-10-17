import type { JsonValue } from '../json/json-value';

export type NodeId = string;
export type SlotName = string;
export type DataPath = string;
export type Breakpoint = 'tablet' | 'mobile';
export type Surface = string;
export type Author = 'user' | 'ai' | 'codeview';
export type ContentDirection = 'ltr' | 'rtl';

/** Reserved slot for ordinary children. */
export const DEFAULT_SLOT: SlotName = 'default';

/** Current document format version; migrations target this. */
export const LATEST_SCHEMA_VERSION = 1;

export const BREAKPOINTS: readonly Breakpoint[] = Object.freeze(['tablet', 'mobile']);

/**
 * One unit of page content. JSON-pure by construction (Law J), so tier-2 stored
 * subtrees reuse this exact type — no parallel "declarative node" exists.
 */
export interface Node {
  id: NodeId;
  /** Registry key into block schemas. */
  type: string;
  /** Intent values only — never raw pixels, never raw color codes. */
  props: Record<string, JsonValue>;
  bindings?: Record<string, DataPath>;
  /** Instance-level widget skin override. */
  variantOf?: string;
  /** Per-breakpoint PROP overrides only (Law R); desktop is the base. */
  responsive?: Partial<Record<Breakpoint, Record<string, JsonValue>>>;
  /** Membership + order per named slot; empty arrays are never stored. */
  slots?: Record<SlotName, NodeId[]>;
}

export interface BuilderDocument {
  schemaVersion: number;
  surface: Surface;
  /** CONTENT direction (iframe-level); shell UI direction never enters the kernel. */
  dir: ContentDirection;
  rootId: NodeId;
  /** FLAT — never nested. */
  nodes: Record<NodeId, Node>;
}

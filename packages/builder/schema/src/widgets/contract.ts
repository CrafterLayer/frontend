import type { JsonValue } from '../json/json-value';
import type { ContentDirection, Node, NodeId, Surface } from '../document/types';

/**
 * JSON-Schema-subset descriptor (itself pure JSON). Database rows can never hold
 * live zod instances; a Tier-1 interpreter compiles descriptors into validators at
 * hydration.
 */
export type SchemaDescriptor = JsonValue;

/** Stored subtree of Tier-1 node types. `Node` is JSON-pure (Law J), so it is reused directly. */
export interface DeclarativeSubTree {
  rootId: NodeId;
  nodes: Record<NodeId, Node>;
}

/** Versioned, immutable saved composition (detached-clone insert by default). */
export interface CompositionDef extends DeclarativeSubTree {
  id: string;
  name: string;
  version: number;
  surfaces?: Surface[];
  /** The direction its content is written in; a page of the other direction is not offered it. */
  dir?: ContentDirection;
}

export const SKIN_STATES = Object.freeze(['loading', 'empty', 'error', 'success'] as const);
export type SkinState = (typeof SKIN_STATES)[number];

/** A widget skin — ALL FOUR states are mandatory (the gate). */
export interface SkinDef {
  id: string;
  version: number;
  states: Record<SkinState, DeclarativeSubTree>;
}

export interface DeclarativeWidgetTypeDef {
  type: `widget:${string}`;
  contract: Record<string, { shape: SchemaDescriptor; required?: boolean }>;
  binding: { source: string; map: Record<string, string>; secretRef?: string };
  skins: SkinDef[];
  defaultSkin: string;
}

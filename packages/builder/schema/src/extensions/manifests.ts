import type { BlockSchema } from '../blocks/define-block-schema';
import type { RegisteredCommand } from '../commands';
import type { CompositionDef, DeclarativeWidgetTypeDef, SkinDef } from '../widgets/contract';
import type {
  AiContextProvider,
  BlockRenderComponent,
  DataSourceDef,
  FieldTypeDef,
  InlineEditorDef,
  KernelApi,
  KeymapDef,
  OverlayToolDef,
  PanelContribution,
  ProjectionDef,
} from './contribution-points';

export interface TrustedBlockContribution {
  schema: BlockSchema;
  /** Erased, variance-safe (see BlockRenderComponent) — any typed block fits. */
  render: BlockRenderComponent;
}

/** Tier 1 — executable code that ships with the platform. */
export interface TrustedExtensionManifest {
  tier: 1;
  name: string;
  version: string;
  /** Topologically ordered at registration; cycles are rejected. */
  dependencies?: string[];
  contributes?: {
    blocks?: TrustedBlockContribution[];
    commands?: Record<string, RegisteredCommand>;
    panels?: PanelContribution[];
    fieldTypes?: FieldTypeDef[];
    inlineEditors?: InlineEditorDef[];
    canvasTools?: OverlayToolDef[];
    projections?: ProjectionDef[];
    dataSources?: DataSourceDef[];
    aiContext?: AiContextProvider[];
    keymaps?: KeymapDef[];
  };
  /** May return a dispose callback. */
  setup?: (ctx: KernelApi) => (() => void) | undefined;
}

/**
 * Tier 2 — pure data from the database (Law T). Every payload field is
 * JsonValue-typed, so functions are unrepresentable at the type level; hydration
 * additionally runs the structural walk in validate-tier2 as defense-in-depth for
 * untyped rows.
 */
export interface DeclarativeExtensionManifest {
  tier: 2;
  name: string;
  version: string;
  contributes?: {
    compositions?: CompositionDef[];
    widgetTypes?: DeclarativeWidgetTypeDef[];
    skins?: SkinDef[];
  };
}

export type ExtensionManifest = TrustedExtensionManifest | DeclarativeExtensionManifest;

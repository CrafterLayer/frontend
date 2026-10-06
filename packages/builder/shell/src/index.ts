// @craftkit/builder-shell — canvas chrome for the builder (layer 3).
// Read-only canvas in B2a: geometry index, hover/selection overlay, keyboard
// traversal, canvas-tool contributions. The overlay hot path is React-free.
// B2b adds drag editing; B3a adds the inspector, devices, and preview mode.

export { AssetPicker, type AssetPickerProps } from './components/AssetPicker';
export { BUCKET_THRESHOLDS, bucketForWidth, type EditingBucket } from './devices/buckets';
export { BuilderShell, type BuilderShellProps } from './components/BuilderShell';
export {
  CHROME_BUTTON_SIZE_TOKENS,
  CHROME_BUTTON_VARIANTS,
  ChromeButton,
  type ChromeButtonProps,
  type ChromeButtonSize,
  type ChromeButtonVariant,
} from './components/ChromeButton';
export {
  GENERATION_STAGE_IDS,
  GENERATION_STAGE_LABELS,
  GenerationProgress,
  type GenerationProgressProps,
  type GenerationStage,
  type GenerationStageId,
  type GenerationStageStatus,
} from './components/GenerationProgress';
export { IconRail, type IconRailProps, type RailItem } from './components/IconRail';
export {
  StatusBar,
  type ChangeDoor,
  type RecentChange,
  type StatusBarProps,
  type StatusBarTool,
} from './components/StatusBar';
export { TopBar, type TopBarDevice, type TopBarProps } from './components/TopBar';
export { DeviceBar, type DeviceBarProps, type DeviceState } from './components/DeviceBar';
export {
  InsertionPicker,
  type InsertionChoice,
  type InsertionPickerMode,
  type InsertionPickerOption,
  type InsertionPickerProps,
} from './components/InsertionPicker';
export {
  SelectionToolbar,
  type SelectionToolbarAction,
  type SelectionToolbarProps,
} from './components/SelectionToolbar';
export {
  CodePreviewFrame,
  type CodePreviewFrameProps,
  type CodePreviewFrameStatus,
  type PreviewMount,
} from './components/CodePreviewFrame';
export { EditorCanvas } from './components/EditorCanvas';
export type {
  CanvasDragHandle,
  CanvasInlineEditHandle,
  EditorCanvasProps,
} from './components/EditorCanvas';
export { Inspector, type InspectorProps } from './components/Inspector';
export { LayersTree, type LayersTreeProps } from './components/LayersTree';
export { Palette, type PaletteProps } from './components/Palette';
export { PreviewMode, type PreviewModeProps } from './components/PreviewMode';
export { SitePages, type SitePagesProps } from './components/SitePages';
export type { DragPayload, DropTarget } from './overlay/drop-resolver';
export {
  createRectIndex,
  systemGeometryPorts,
  type GeometryPorts,
  type NodeRect,
  type RectIndex,
} from './rects';
export { defineCanvasTool, type CanvasToolTarget } from './overlay/tool-host';
export {
  positionFloating,
  type FloatingAnchor,
  type FloatingBox,
  type FloatingInput,
  type FloatingPlacement,
} from './overlay/floating-position';
export {
  createFrameBridge,
  selectionTargetFromFrameElement,
  type FrameBridge,
  type FrameBridgeOptions,
  type FrameSelectionContext,
  type FrameSelectionHit,
} from './overlay/frame-bridge';
export {
  createInlineSession,
  inlineTargetOf,
  type InlineEscapeLayers,
  type InlineEscapeStep,
  type InlineSession,
  type InlineSessionHandle,
} from './overlay/inline-session';
export {
  createSelectionController,
  intersectSelectionCapabilities,
  reconcileSelection,
  type ResolvedSelectionIdentity,
  type SelectionController,
  type SelectionIdentityResolver,
  type SelectionInvalidReason,
  type SelectionReconciliation,
  type SelectionSnapshot,
} from './selection/selection-controller';
export {
  createInsertionAnchor,
  revalidateInsertionAnchor,
  type InsertionAnchorFailureReason,
  type InsertionAnchorResolver,
  type InsertionAnchorResult,
  type ResolvedInsertionOwner,
} from './insertion/insertion-anchor';
export { InlineTextSurface, type InlineTextSurfaceProps } from './components/InlineTextSurface';
export { InlineRichSurface } from './components/InlineRichSurface';
export {
  isMarkActive,
  plainTextOf,
  replaceRange,
  richTextLength,
  toggleMark,
  type TextRange,
  type ToggleableMark,
} from './inline/mark-range';
export { TextBubble, type TextBubbleAction, type TextBubbleProps } from './components/TextBubble';
export { BlockActionBar, type BlockActionBarProps } from './components/BlockActionBar';
export {
  performBlockAction,
  resolveBlockActions,
  type BlockAction,
  type BlockActionId,
  type BlockActionResult,
} from './overlay/block-actions';
export {
  createAnchorChannel,
  type AnchorChannel,
  type AnchorSnapshot,
} from './overlay/anchor-channel';
export {
  createFloatingHost,
  systemFloatingPorts,
  type FloatingHost,
  type FloatingHostPorts,
  type FloatingTarget,
} from './overlay/floating-host';

/*
  The motion control (013). Exported so a host can compose it directly; blocks
  reach it by declaring `kind: 'motion'` on the property and letting the
  inspector resolve it.
*/
export { MotionField } from './fields/MotionField';

/*
  The design-system surface: the panel that edits a site's tokens, and the grid
  it navigates them with. Siblings, not nested — the component contract
  discovers only direct children of `components/`, so a grid inside the panel's
  folder would never have had its five artifacts checked.
*/
export { DesignSystemPanel, type DesignSystemPanelProps } from './components/DesignSystemPanel';
export { TokenSwatchGrid, type TokenSwatchGridProps } from './components/TokenSwatchGrid';

// ── P11-integration (style-manager DESIGN.md) ──
// Every element a widget (§A), the manual editor (§E) and the design-system
// surfaces (§G), re-exported for hosts. Sub-barrels are re-exported whole so
// a component's labels, models and pure helpers travel with it.
export * from './style-manager';
export * from './components/ElementQuickBar';
export * from './components/LibraryPanel';
export * from './components/HistoryList';
export * from './components/ShortcutsDialog';
export {
  commitSiteSteps,
  DESIGN_SYSTEM_PANEL_LABELS_AR,
  DESIGN_SYSTEM_PANEL_LABELS_EN,
  readableToken,
  siteCommitFor,
  siteCommitLabel,
  useSiteSnapshot,
  type DesignSystemPanelLabels,
  type DesignSystemSection,
  type SiteCommit,
  type SiteCommitResult,
  type SiteDoor,
} from './components/DesignSystemPanel';
export * from './components/FontPicker';
export * from './components/PaletteRampEditor';
export * from './components/ClassManager';
export * from './components/SymbolsPanel';
export * from './components/AssetManager';
export * from './components/ImageCropper';
export * from './components/IconBrowser';
export * from './components/DesignLibraryTransfer';
export { LAYERS_TREE_LABELS_AR, LAYERS_TREE_LABELS_EN, type LayersSaveTemplateRequest, type LayersTreeLabels } from './components/LayersTree';
export * from './custom-code/element-target';
export * from './custom-code/element-drag-payload';
export * from './selection/element-selection';
export * from './clipboard';
export * from './keyboard/editor-shortcuts';
export {
  TREE_TEXT_ACTION_LABELS_AR,
  TREE_TEXT_ACTION_LABELS_EN,
  type TreeTextActionLabels,
} from './overlay/tree-text-actions';
// ── end P11-integration ──

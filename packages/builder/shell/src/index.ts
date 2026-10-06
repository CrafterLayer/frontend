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
// ── fix pass (style-manager DESIGN.md P11) ──
export type { InspectorFocusRequest, InspectorStyleContext } from './components/Inspector';
export { TOP_BAR_LABELS_AR, TOP_BAR_LABELS_EN, type TopBarLabels } from './components/TopBar';
// ── end fix pass ──
// arabic-editor additions: one typed catalogue for the editor UI (en/ar), its
// direction and digits, and the labels of the surfaces that gained them.
export * from './i18n';
export { STATUS_BAR_LABELS_AR, STATUS_BAR_LABELS_EN, type StatusBarLabels } from './components/StatusBar';
export { SITE_PAGES_LABELS_AR, SITE_PAGES_LABELS_EN, type SitePagesLabels } from './components/SitePages';
export {
  PALETTE_LABELS_AR,
  PALETTE_LABELS_EN,
  type PaletteCategory,
  type PaletteLabels,
} from './components/Palette';
export {
  INSPECTOR_LABELS_AR,
  INSPECTOR_LABELS_EN,
  inspectorLabelsFor,
  type InspectorChromeLabels,
  type InspectorEmptyCopy,
  type InspectorLabels,
} from './components/Inspector';
export {
  EDITOR_CANVAS_LABELS_AR,
  EDITOR_CANVAS_LABELS_EN,
  type EditorCanvasLabels,
} from './components/EditorCanvas';
// end arabic-editor additions
// ── block-parts (2026-10-06) ──
// Canvas parts (block-parts DESIGN §2.6–§2.8, §2.14): the target shape and its
// readers, the inline part commit, and the rect index's part hit. The part
// quick bar (createPartBarModel, part actions, PartLinkPopover) rides the
// ElementQuickBar barrel above.
export {
  enclosingItemRef,
  firstPart,
  firstPartInside,
  isLivePart,
  parsePartIndex,
  partChipLabel,
  partDeclOf,
  partInstanceKey,
  partInstanceName,
  partInstancesOf,
  partLabel,
  partRefOf,
  partsOfNode,
  partTarget,
  partTargetFromFocus,
  samePartRef,
  steppedPart,
  type PartTarget,
} from './overlay/part-target';
export { partInlineCommit, type PartInlineCommitResult } from './overlay/part-inline';
export { partInlineTargetOf } from './overlay/inline-session';
export type { CanvasPartHit } from './rects';
// ── /block-parts ──
// ── block-parts (2026-10-06) ── P3-inspector-fields additions
// The Inspector's field services (asset library, pages, locale) for hosts
// that compose field rows outside the Inspector, and the rich-text plain-text
// projection the field skeleton shows.
export { FieldServicesProvider, type FieldServicesProviderProps } from './fields/field-services';
export {
  useFieldServices,
  type FieldPage,
  type FieldServices,
} from './fields/field-services-context';
export { richTextPlainText } from './fields/rich-text-plain-text';
// Field resolution, so a host's registry gate (the playground's
// field-kinds.registry test) can prove no registered prop falls to a summary.
export {
  defaultFieldFor,
  partBindingFor,
  propsShapeOf,
  resolveField,
  unwrapSchema,
  type DefaultControl,
  type FieldResolutionContext,
  type PartBinding,
  type ResolvedField,
} from './fields/resolve-field';
export { repeaterSchemaInfo } from './fields/repeater-schema';
// ── /block-parts ──
// shell-playground additions
export {
  RICH_TEXT_ACTION_LABELS_AR,
  RICH_TEXT_ACTION_LABELS_EN,
  type RichTextActionLabels,
} from './overlay/inline-dock-anchor';
// end shell-playground additions

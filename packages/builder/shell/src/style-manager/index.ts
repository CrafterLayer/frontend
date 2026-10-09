/*
  The style manager (style-manager DESIGN.md §A, §B.4, §G): the side-panel
  StylePanel, its controls, the StyleSource adapters, the Interactions and
  Code tab bodies and the forced-state preview. The shell's root barrel is
  P11's to edit; it re-exports from here.
*/

// Sources: what the panel edits.
export { refusalMessage, styleTransactionLabel, type StyleApplyResult, type StyleSource } from './style-source';
export { treeElementSource, type TreeElementSourceOptions } from './tree-element-source';
export { blockSource, utilityClassesKey } from './block-source';
// ── block-parts (2026-10-06) ──
export { partSource, type PartSourceOptions, type PartStyleScope } from './part-source';
// ── /block-parts ──
export {
  classNameOfNode,
  ELEMENT_GONE,
  isSymbolInstance,
  mergeSymbolOverride,
  patchTreeTargets,
  readTreeTarget,
  setTreeTarget,
  SYMBOL_OVERRIDES_KEY,
  type TreeEdit,
  type TreeTarget,
  type TreeWriteOptions,
} from './tree-writes';
export { useStyleSourceClasses } from './use-style-source';
export {
  findCanvasElement,
  FORCED_STATE_ATTRIBUTE,
  useForcedStatePreview,
} from './use-forced-state-preview';
export { viewStyles, emptyView, type PropertyView, type SlotView } from './style-view';
export { appliesToTag, isTokenCapable, keywordsFor, modelFor, unitsFor } from './property-models';

// Panels.
export { StylePanel, STYLE_PANEL_LABELS_AR, STYLE_PANEL_LABELS_EN, STYLE_PANEL_SECTORS } from './StylePanel';
export type { StylePanelLabels, StylePanelProps } from './StylePanel';
export { StyleSector, type StyleSectorProps } from './StyleSector';
export { intentsAt, StyleProperty, type StyleEdit, type StylePropertyProps } from './StyleProperty';
export * from './InteractionsPanel';
export * from './ElementCodeEditor';
export {
  attributeInMessage,
  CHILDREN_MARKER,
  formatElementCode,
  parseElementCode,
  patchFromCode,
  type ElementCodeError,
  type ElementCodeResult,
  type ParsedElementCode,
} from './element-code';

// Controls.
export * from './controls/BorderSidesControl';
export * from './controls/BoxModelControl';
export * from './controls/BoxSideButton';
export * from './controls/BucketStateSwitcher';
export * from './controls/ChoiceGroup';
export * from './controls/CornerRadiusControl';
export * from './controls/EffectPresetPicker';
export * from './controls/GridTracksControl';
export * from './controls/MotionPresetGrid';
export * from './controls/ScaleNumberControl';
export * from './controls/StackControl';
export * from './controls/StackLayerRow';
export * from './controls/StyleColorControl';
export * from './controls/TransformOriginControl';
export * from './controls/ValueSourceDot';
// shell-media-editor additions (media-motion 2026-10-06)
export * from './controls/MediaParamFields';
export * from './controls/ScenePresetPicker';
export * from './controls/TimelineRecipePicker';
// ── end shell-media-editor additions ──
// gsap-pixi additions (2026-10-08): Cinematic motion + Animated background cards
export * from './controls/EngineMotionPicker';
// ── end gsap-pixi additions ──
// panel-design additions (style panel redesign 2026-10-06)
export * from './controls/ColorField';
export * from './controls/OptionIcon';
export * from './controls/SegmentedChoice';
export * from './StylePanelFilter';
export type { StyleRowLayout } from './StyleProperty';
// ── end panel-design additions ──

// Shared behaviour for P7's quick bar and canvas handles.
export { BOX_SIDES, growthOf, sideForModifiers, sidesOf } from './box-sides';
export { useScrub, type ScrubDelta, type ScrubHandlers, type ScrubModifiers } from './use-scrub';
export { focusRadioAt, rovingIndex } from './roving';

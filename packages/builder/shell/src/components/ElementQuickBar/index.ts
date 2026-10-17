export { ElementQuickBar, type ElementQuickBarProps } from './ElementQuickBar';
export {
  ELEMENT_QUICK_BAR_LABELS_AR,
  ELEMENT_QUICK_BAR_LABELS_EN,
  type ElementQuickBarLabels,
} from './ElementQuickBar.labels';
export {
  createElementBarModel,
  defaultSectorFor,
  quickElementKind,
  type ElementBarModel,
  type ElementBarModelOptions,
  type QuickElementKind,
  type QuickValue,
  type QuickWriteResult,
} from './element-bar-model';
export { quickGroupsFor, type QuickGroup, type QuickGroupId } from './quick-bar-groups';
// ── block-parts (2026-10-06) ──
export { quickGroupsForPart } from './quick-bar-groups';
export {
  createPartBarModel,
  dispatchPartPlan,
  mergePartPlans,
  nodeAfterPlan,
  partClassName,
  partQuickKind,
  partStringValue,
  planPartLinkValue,
  PART_NO_ATTRIBUTES,
  PART_NO_ICON,
  type PartBarModelOptions,
} from './part-bar-model';
export {
  HOST_PART_ACTIONS,
  PART_ACTION_IDS,
  PART_ACTION_WORDS_EN,
  performPartAction,
  resolvePartActions,
  storedPartDir,
  type PartAction,
  type PartActionContext,
  type PartActionId,
  type PartActionResult,
  type PartActionWords,
} from './part-actions';
export {
  PART_QUICK_BAR_LABELS_AR,
  PART_QUICK_BAR_LABELS_EN,
  type PartQuickBarLabels,
} from './ElementQuickBar.labels';
export { PartLinkPopover, type PartLinkPage, type PartLinkPopoverProps } from './PartLinkPopover';
// ── /block-parts ──
export { visibleGroupCount, type FoldInput } from './measure-groups';
export { paletteSwatches, themeColorSwatches } from './color-swatches';
export type { NamedStyleChoice } from './QuickGroupPanel';

// Presentation state stays internal; the public Inspector contract remains kernel + optional bucket.
export { Inspector, type InspectorProps } from './Inspector';
export type { InspectorFocusRequest, InspectorStyleContext } from './inspector-request';
// arabic-editor additions
export {
  INSPECTOR_LABELS_AR,
  INSPECTOR_LABELS_EN,
  inspectorLabelsFor,
  type InspectorChromeLabels,
  type InspectorEmptyCopy,
  type InspectorLabels,
} from './Inspector.labels';
// end arabic-editor additions
// ── block-parts (2026-10-06) ──
export { InspectorPartPanel, type InspectorPartPanelProps } from './InspectorPartPanel';
export {
  INSPECTOR_PART_LABELS_AR,
  INSPECTOR_PART_LABELS_EN,
  inspectorPartLabelsFor,
  type InspectorPartLabels,
} from './part-panel.labels';
export { partContentRows, type PartContentRow } from './part-panel-rows';
// ── /block-parts ──

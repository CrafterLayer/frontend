// @craftkit/builder-shell — canvas chrome for the builder (layer 3).
// Read-only canvas in B2a: geometry index, hover/selection overlay, keyboard
// traversal, canvas-tool contributions. The overlay hot path is React-free.
// B2b adds drag editing; B3a adds the inspector, devices, and preview mode.

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
export { createFrameBridge, type FrameBridge } from './overlay/frame-bridge';
export {
  createInlineSession,
  inlineTargetOf,
  type InlineSession,
  type InlineSessionHandle,
} from './overlay/inline-session';
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

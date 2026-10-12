import type { ComponentProps } from 'react';

import {
  Inspector,
  bucketForWidth,
  type BuilderKernel,
  type ColorRole,
  type DeviceState,
  type Theme,
  type TopBarDevice,
} from '@craftkit/builder';

import type { EditorLocale } from './editor-labels';
import type { EditorChrome } from './use-editor-chrome';
import type { InspectorFocus } from './use-inspector-focus';
import type { SiteDesign } from './use-site-design';

export interface PageInspectorProps {
  readonly kernel: BuilderKernel;
  readonly device: DeviceState;
  readonly theme: Theme;
  readonly onRetheme: (role: ColorRole, value: string) => void;
  /** A named device from the panel's bucket switch. */
  readonly onDeviceChange: (device: TopBarDevice) => void;
  readonly onDeviceStateChange: (device: DeviceState) => void;
  readonly onCustomBucketChange: (bucket: { readonly maxWidth: number } | undefined) => void;
  readonly locale: EditorLocale;
  readonly library: SiteDesign['siteLibrary'];
  readonly chrome: EditorChrome;
  readonly frameDocument: Document | null;
  readonly inspectorFocus: InspectorFocus;
  readonly assetLibrary: ComponentProps<typeof Inspector>['assetLibrary'];
}

/** The aside on a canvas page: the Inspector, writing at the device's bucket. */
export function PageInspector({
  kernel,
  device,
  theme,
  onRetheme,
  onDeviceChange,
  onDeviceStateChange,
  onCustomBucketChange,
  locale,
  library,
  chrome,
  frameDocument,
  inspectorFocus,
  assetLibrary,
}: PageInspectorProps) {
  return (
    <Inspector
      kernel={kernel}
      bucket={device.bucket}
      theme={theme}
      onRetheme={onRetheme}
      onBucketChange={(next) => {
        if (typeof next === 'string') {
          onDeviceChange(next === 'base' ? 'desktop' : next);
          return;
        }
        // "Edit at ≤ N px": the canvas takes that width, the panel writes max-[Npx]:.
        onDeviceStateChange({ width: next.maxWidth, bucket: bucketForWidth(next.maxWidth) });
        onCustomBucketChange(next);
      }}
      {...(device.width === 1280 || device.width === 834 || device.width === 390
        ? {}
        : { freeWidth: device.width })}
      locale={locale}
      library={library}
      elementTargets={chrome.targets}
      frameDocument={frameDocument}
      onPreviewElement={chrome.previewElement}
      onConvertBlock={chrome.convertBlock}
      onOpenRegionCss={(nodeId) => {
        kernel.setSelection([nodeId]);
      }}
      onOpenPageCss={() => {
        kernel.setSelection([kernel.getDocument().rootId]);
      }}
      focusRequest={inspectorFocus.request}
      onFocusRequestHandled={inspectorFocus.onRequestHandled}
      onStyleContextChange={inspectorFocus.onStyleContextChange}
      // ── block-parts (2026-10-06) ── image and asset fields pick from the catalogue
      assetLibrary={assetLibrary}
      // ── /block-parts ──
    />
  );
}

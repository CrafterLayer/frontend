import { TopBar, type BuilderKernel, type DeviceState, type TopBarDevice } from '@craftkit/builder';

import type { EditorLabels } from './editor-labels';
import { TopBarExtra, type TopBarExtraProps } from './top-bar-extra';
import type { CodeSession } from './use-code-session';

export interface EditorTopBarProps {
  readonly labels: EditorLabels;
  readonly code: Pick<
    CodeSession,
    'publishSite' | 'publishStaticSiteFiles' | 'codeSnapshot' | 'compileCodePage'
  >;
  readonly device: DeviceState;
  readonly changeDevice: (next: TopBarDevice) => void;
  /** Whether the page kernel's history can move (the code showcase overrides both). */
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly showcaseOwnsLawSControls: boolean;
  readonly kernel: BuilderKernel | undefined;
  readonly setPreview: (preview: boolean) => void;
  readonly panes: TopBarExtraProps['panes'];
}

/** The product's top bar: publish, devices, undo/redo, preview, and the `extra` band. */
export function EditorTopBar({
  labels,
  code,
  device,
  changeDevice,
  canUndo,
  canRedo,
  showcaseOwnsLawSControls,
  kernel,
  setPreview,
  panes,
}: EditorTopBarProps) {
  const { publishSite, publishStaticSiteFiles, codeSnapshot, compileCodePage } = code;
  return (
    /*
      The designed bar replaces what was a debug harness: a fieldset of radio
      buttons, a bare select, a checkbox and six unstyled buttons in a row.
      The scenario controls that only the PLAYGROUND needs ride in `extra`,
      which is exactly the slot the component offers for them.
    */
    <TopBar
      /*
        Studio Indigo (2026-10-12): the real publish (static site files) IS the bar's one
        primary action, so it takes the TopBar's Publish slot, whole (no options half), and
        says "Publish site". It used to sit in the action band as a plain button beside
        five others of the same weight.
      */
      labels={{ ...labels.topBar, publish: labels.chrome.publishSite }}
      onPublish={() => void publishStaticSiteFiles()}
      publishDisabled={!publishSite.canPublish || publishSite.publishing}
      publishTitle={publishSite.error}
      showPublishOptions={false}
      dir={labels.dir}
      productName="CraftKit Builder"
      logo={<span className="pg-mark">CK</span>}
      device={device.bucket === 'base' ? 'desktop' : device.bucket}
      onDeviceChange={changeDevice}
      canUndo={!showcaseOwnsLawSControls && canUndo}
      canRedo={!showcaseOwnsLawSControls && canRedo}
      onUndo={() => {
        kernel?.undo();
      }}
      onRedo={() => {
        kernel?.redo();
      }}
      onPreview={() => {
        // There is nothing to preview until the document is open.
        if (codeSnapshot !== undefined) {
          void compileCodePage();
        } else if (kernel !== undefined) {
          setPreview(true);
        }
      }}
      extra={
        <TopBarExtra
          labels={labels.chrome}
          panes={panes}
          showcaseOwnsLawSControls={showcaseOwnsLawSControls}
          kernel={kernel}
        />
      }
    />
  );
}

import { useState } from 'react';

import {
  TopBar,
  type BuilderKernel,
  type BuilderSiteKernel,
  type DeviceState,
  type TopBarDevice,
} from '@craftkit/builder';

import {
  COMMAND_PALETTE_LABELS_AR,
  COMMAND_PALETTE_LABELS_EN,
  CommandPalette,
  paletteShortcutLabel,
  platformModifier,
  useCommandPaletteShortcut,
} from '../features/command';
import { feedbackLabels, notifyPublish } from '../features/feedback';

import type { EditorLabels } from './editor-labels';
import { TopBarExtra, type TopBarExtraProps } from './top-bar-extra';
import type { CodeSession } from './use-code-session';
import { useEditorCommands, type EditorCommandsOptions } from './use-editor-commands';
import type { useEditorLanguage } from './use-editor-language';

/** Read once: the platform decides `Ctrl` or `⌘` for the whole session. */
const PLATFORM = typeof navigator === 'undefined' ? '' : navigator.userAgent;

export interface EditorTopBarProps {
  readonly labels: EditorLabels;
  readonly language: Pick<
    ReturnType<typeof useEditorLanguage>,
    'editorLocale' | 'setEditorLocale' | 'railDestinations' | 'railUtilities'
  >;
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
  readonly siteKernel: BuilderSiteKernel | undefined;
  readonly setPreview: (preview: boolean) => void;
  readonly panes: TopBarExtraProps['panes'] & EditorCommandsOptions['panes'];
  readonly openShortcuts: (open: boolean) => void;
}

/**
 * The product's top bar: publish, devices, undo/redo, preview, and the `extra` band —
 * which opens with the command palette's trigger (Ctrl/⌘ K reaches it from anywhere).
 */
export function EditorTopBar({
  labels,
  language,
  code,
  device,
  changeDevice,
  canUndo,
  canRedo,
  showcaseOwnsLawSControls,
  kernel,
  siteKernel,
  setPreview,
  panes,
  openShortcuts,
}: EditorTopBarProps) {
  const { publishSite, publishStaticSiteFiles, codeSnapshot, compileCodePage } = code;
  const { editorLocale } = language;
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(() => {
    setPaletteOpen((open) => !open);
  });
  const canPublish = publishSite.canPublish && !publishSite.publishing;
  // Publishing is narrated in one toast: working, then the outcome, and Try again on failure.
  const publish = () => {
    void notifyPublish(publishStaticSiteFiles, feedbackLabels(editorLocale), publish);
  };
  // There is nothing to preview until the document is open.
  const canPreview = codeSnapshot !== undefined || kernel !== undefined;
  const preview = () => {
    if (codeSnapshot !== undefined) {
      void compileCodePage();
    } else if (kernel !== undefined) {
      setPreview(true);
    }
  };
  const history = {
    canUndo: !showcaseOwnsLawSControls && canUndo,
    canRedo: !showcaseOwnsLawSControls && canRedo,
  };
  const commands = useEditorCommands({
    ...language,
    labels,
    panes,
    device,
    changeDevice,
    kernel,
    siteKernel,
    ...history,
    canPublish,
    publish,
    canPreview,
    preview,
    openShortcuts: () => {
      openShortcuts(true);
    },
    modifier: platformModifier(PLATFORM),
  });
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
      onPublish={publish}
      publishDisabled={!canPublish}
      publishTitle={publishSite.error}
      showPublishOptions={false}
      dir={labels.dir}
      productName="CraftKit Builder"
      logo={<span className="pg-mark">CK</span>}
      device={device.bucket === 'base' ? 'desktop' : device.bucket}
      onDeviceChange={changeDevice}
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      onUndo={() => {
        kernel?.undo();
      }}
      onRedo={() => {
        kernel?.redo();
      }}
      onPreview={preview}
      extra={
        <TopBarExtra
          labels={labels.chrome}
          panes={panes}
          showcaseOwnsLawSControls={showcaseOwnsLawSControls}
          kernel={kernel}
          palette={
            <CommandPalette
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              commands={commands}
              labels={editorLocale === 'ar' ? COMMAND_PALETTE_LABELS_AR : COMMAND_PALETTE_LABELS_EN}
              dir={labels.dir}
              shortcut={paletteShortcutLabel(PLATFORM)}
            />
          }
        />
      }
    />
  );
}

import type { ReactNode } from 'react';

import { ChromeButton, type BuilderKernel } from '@craftkit/builder';

import type { ChromeLabels } from './editor-labels';
import { TransactionCount } from './transaction-count';
import type { EditorPanes } from './use-editor-panes';

/** The pane toggles' glyphs (a phone shows these in place of the words). */
const PANE_ICON = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinejoin: 'round',
  focusable: 'false',
  'aria-hidden': true,
} as const;

export interface TopBarExtraProps {
  readonly labels: ChromeLabels;
  readonly panes: Pick<
    EditorPanes,
    | 'workspaceView'
    | 'setWorkspaceView'
    | 'visiblePanes'
    | 'setPanelOpen'
    | 'setAsideOpen'
    | 'setActiveSide'
  >;
  /** While the code showcase is open it renders its own sealed-store counter. */
  readonly showcaseOwnsLawSControls: boolean;
  readonly kernel: BuilderKernel | undefined;
  /** The command palette's trigger (and its dialog), first in the band. */
  readonly palette?: ReactNode;
}

/**
 * The top bar's `extra` band: the command palette's trigger, the workspace view switch, the
 * pane toggles and the tx counter.
 */
export function TopBarExtra({
  labels,
  panes,
  showcaseOwnsLawSControls,
  kernel,
  palette,
}: TopBarExtraProps) {
  const {
    workspaceView,
    setWorkspaceView,
    visiblePanes,
    setPanelOpen,
    setAsideOpen,
    setActiveSide,
  } = panes;
  return (
    /*
      The action band belongs to the PRODUCT. Every scenario control moved
      to the rail's Settings panel, where a dev harness belongs; what is
      left here is the sealed-store counter, which must stay in the DOM in
      every view for the law's assertions and has no business being seen.
    */
    <>
      {palette}
      <div className="pg-workspace-view" role="group" aria-label={labels.workspaceView}>
        <ChromeButton
          size="sm"
          variant="toggle"
          aria-pressed={workspaceView === 'canvas'}
          onClick={() => {
            setWorkspaceView('canvas');
          }}
        >
          {labels.canvas}
        </ChromeButton>
        <ChromeButton
          size="sm"
          variant="toggle"
          aria-pressed={workspaceView === 'sitemap'}
          onClick={() => {
            setWorkspaceView('sitemap');
          }}
        >
          {labels.sitemap}
        </ChromeButton>
      </div>
      <ChromeButton
        size="sm"
        variant="toggle"
        className="pg-pane-toggle"
        aria-label={labels.togglePanel}
        tooltip={labels.togglePanel}
        aria-pressed={visiblePanes.panel}
        onClick={() => {
          setPanelOpen(!visiblePanes.panel);
          setActiveSide('panel');
        }}
      >
        {/* On a phone the toggle is its glyph; the word stays its visible name elsewhere. */}
        <svg className="pg-pane-toggle__icon" {...PANE_ICON}>
          <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
          <path d="M6 2.5v11" />
        </svg>
        <span className="pg-pane-toggle__label">{labels.panel}</span>
      </ChromeButton>
      <ChromeButton
        size="sm"
        variant="toggle"
        className="pg-pane-toggle"
        aria-label={labels.toggleInspector}
        tooltip={labels.toggleInspector}
        aria-pressed={visiblePanes.aside}
        onClick={() => {
          setAsideOpen(!visiblePanes.aside);
          setActiveSide('aside');
        }}
      >
        <svg className="pg-pane-toggle__icon" {...PANE_ICON}>
          <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
          <path d="M10 2.5v11" />
        </svg>
        <span className="pg-pane-toggle__label">{labels.inspector}</span>
      </ChromeButton>
      {showcaseOwnsLawSControls ? null : (
        <span className="bldr-visually-hidden">
          <output aria-label="Transactions" data-testid="pg-tx-count">
            {kernel === undefined ? 0 : <TransactionCount kernel={kernel} />}
          </output>
        </span>
      )}
    </>
  );
}

import { StatusBar } from '@craftkit/builder';

import { AGENT_PANEL } from './app-env';
import { quietSaveState, type ReadySession } from './app-helpers';
import type { EditorLabels, EditorLocale } from './editor-labels';
import { ProvenanceStatusBar } from './provenance-status-bar';
import type { EditorPanes } from './use-editor-panes';

export interface CanvasStatusProps {
  readonly session: ReadySession | undefined;
  readonly deviceLabel: string;
  readonly labels: EditorLabels;
  readonly editorLocale: EditorLocale;
  /** A stable callback ref: where the v2 agent panel portals its pill. */
  readonly setAgentPillHost: (host: HTMLElement | null) => void;
  readonly panes: Pick<EditorPanes, 'zoomChoice' | 'setZoomChoice'>;
  /** The zoom the canvas actually uses (what "Fit" resolves to). */
  readonly canvasZoom: number;
}

/** The shell's status band: the provenance strip (or its placeholder) and the zoom select. */
export function CanvasStatus({
  session,
  deviceLabel,
  labels,
  editorLocale,
  setAgentPillHost,
  panes,
  canvasZoom,
}: CanvasStatusProps) {
  const { zoomChoice, setZoomChoice } = panes;
  return (
    <div className="pg-canvas-status">
      {session === undefined ? (
        <StatusBar changes={[]} deviceLabel={deviceLabel} labels={labels.statusBar} />
      ) : (
        <ProvenanceStatusBar
          kernel={session.kernel}
          deviceLabel={deviceLabel}
          saveState={session.save.shared ? undefined : quietSaveState(session.save)}
          agentSpeaks={AGENT_PANEL === 'v2'}
          labels={labels.statusBar}
          phrases={labels.chrome.changes}
          locale={editorLocale}
          agent={
            AGENT_PANEL === 'v2' ? (
              <span ref={setAgentPillHost} className="pg-agent-pill-host" />
            ) : undefined
          }
        />
      )}
      <label className="pg-canvas-zoom">
        {labels.chrome.zoom}
        <select
          aria-label={labels.chrome.canvasZoom}
          value={zoomChoice}
          onChange={(event) => {
            setZoomChoice(event.currentTarget.value);
          }}
        >
          <option value="fit">
            {labels.chrome.fit} · {Math.round(canvasZoom * 100)}%
          </option>
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
          <option value="1.25">125%</option>
        </select>
      </label>
    </div>
  );
}

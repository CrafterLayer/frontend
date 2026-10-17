import { ChromeButton } from '@craftkit/builder';

import { PROFESSIONAL_BUILDER_FLAGS } from '../features/preview/feature-flags';
import type { CodeSession } from './use-code-session';
import type { EditorPanes } from './use-editor-panes';

export interface CodeSourceSelectionProps {
  readonly code: Pick<
    CodeSession,
    'codePage' | 'selectedSource' | 'selectedText' | 'sourceWorkspace'
  >;
  readonly panes: Pick<EditorPanes, 'setRailSection' | 'setPanelOpen'>;
}

/** The aside while an authored code page is open: the element picked in its preview. */
export function CodeSourceSelection({ code, panes }: CodeSourceSelectionProps) {
  const { codePage, selectedSource, selectedText, sourceWorkspace } = code;
  const { setRailSection, setPanelOpen } = panes;
  return (
    <aside className="pg-code-runtime__selection" aria-label="Selected source element">
      <h2>Selected element</h2>
      {selectedSource === undefined ? (
        <p>Click an element in the isolated preview to edit its static text.</p>
      ) : (
        <>
          <p>
            <strong>{selectedSource.tag}</strong>
            <span>{selectedSource.handle.modulePath}</span>
          </p>
          <ChromeButton
            size="sm"
            onClick={() => {
              sourceWorkspace?.navigateToSource(selectedSource.handle);
              setRailSection('code');
              setPanelOpen(true);
            }}
          >
            Open source
          </ChromeButton>
          <label>
            Text
            <textarea
              rows={4}
              disabled={
                !PROFESSIONAL_BUILDER_FLAGS.sourceAwareEditing ||
                selectedSource.staticText === undefined ||
                selectedSource.dynamic
              }
              value={selectedText}
              onChange={(event) => {
                codePage.controller?.setText(event.currentTarget.value);
              }}
            />
          </label>
          <ChromeButton
            size="sm"
            variant="primary"
            disabled={
              !PROFESSIONAL_BUILDER_FLAGS.sourceAwareEditing ||
              selectedSource.staticText === undefined ||
              selectedSource.dynamic
            }
            onClick={() => {
              codePage.controller?.applyText();
            }}
          >
            Apply as one change
          </ChromeButton>
        </>
      )}
    </aside>
  );
}

import {
  ChromeButton,
  StaticDocument,
  type BuilderDocument,
  type StaticDocumentProps,
} from '@craftkit/builder';

import { IconCheck, IconClose } from '../AssistantPanel/AssistantPanel.icons';

export interface PlanPreviewDialogProps {
  /** The would-be page, rendered from the scratch rehearsal. */
  readonly document: BuilderDocument;
  /** The live registry, so the preview draws with the real blocks. */
  readonly blocks: StaticDocumentProps['blocks'];
  /**
   * Whether this panel may write at all right now.
   *
   * Not "is this proposal appliable" — that is the door's question. This is the
   * PANEL's promise: in Plan mode nothing here changes the document, and a
   * dialog that drew Apply anyway would be a broken promise on screen.
   */
  readonly canApply: boolean;
  readonly onApply: () => void;
  readonly onClose: () => void;
}

/**
 * The would-be page, before deciding.
 *
 * Rendered by the same static renderer the published path uses, from the same
 * registry, with zero writes: the rehearsal already happened on a scratch
 * kernel, and this only draws its result. Looking is not applying.
 *
 * The backdrop closes on its own click and not on a click that bubbled from
 * the dialog — a preview that vanished because somebody pressed a button
 * inside it would lose the very thing they were reading.
 */
export function PlanPreviewDialog({
  document,
  blocks,
  canApply,
  onApply,
  onClose,
}: PlanPreviewDialogProps) {
  return (
    <div
      className="pg-chat__preview-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="pg-chat__preview" role="dialog" aria-label="Preview" aria-modal="true">
        <header className="pg-chat__preview-head">
          <h3>Preview</h3>
          <p>How the page will look after this change. Nothing is applied yet.</p>
          {/*
            Wrapped, not passed straight through. `onClick={onClose}` hands the
            callback React's MouseEvent while its type says `() => void`, so a
            caller that later reads its first argument gets something the
            signature promised was not there.
          */}
          <ChromeButton
            variant="icon"
            size="sm"
            aria-label="Close preview"
            onClick={() => {
              onClose();
            }}
          >
            <IconClose />
          </ChromeButton>
        </header>
        <div className="pg-chat__preview-page">
          <StaticDocument document={document} blocks={blocks} />
        </div>
        <footer className="pg-chat__preview-actions">
          {canApply ? (
            <ChromeButton
              variant="primary"
              onClick={() => {
                onApply();
              }}
            >
              <IconCheck />
              Apply
            </ChromeButton>
          ) : (
            <p className="pg-chat__preview-note">
              Planning only — switch to Ask or Auto to apply this.
            </p>
          )}
          <ChromeButton
            variant="quiet"
            onClick={() => {
              onClose();
            }}
          >
            Close
          </ChromeButton>
        </footer>
      </div>
    </div>
  );
}

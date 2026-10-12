import { ChromeButton } from '@craftkit/builder';

import type { PlaygroundFixture } from '../features/preview/create-playground-kernel';
import { PersistenceStatus } from '../features/vault/components/PersistenceStatus';
import { quietSaveState, type ReadySession } from './app-helpers';
import type { ChromeLabels } from './editor-labels';

export interface VaultNoticesProps {
  readonly session: ReadySession;
  readonly fixture: PlaygroundFixture;
  /** The fixture whose "restored" notice was dismissed, if any. */
  readonly noticeDismissedFor: PlaygroundFixture | undefined;
  readonly onDismissRestored: (fixture: PlaygroundFixture) => void;
  readonly labels: ChromeLabels;
}

/** The vault's two notices under the top bar: the save banner and the "restored" notice. */
export function VaultNotices({
  session,
  fixture,
  noticeDismissedFor,
  onDismissRestored,
  labels,
}: VaultNoticesProps) {
  return (
    <>
      {/*
        The vault's banner, only when a save needs the person: session-only or
        failed, with Download and Retry. "Saving…" and "Saved to this device"
        are quiet facts and live in the status bar's save slot. As a floating pill
        between the top bar and the editor they sat over the rail and the agent
        panel's header, the first thing the owner's screenshot showed. The page
        being open in another tab is not quiet: that keeps the banner.
      */}
      {quietSaveState(session.save) !== undefined && !session.save.shared ? null : (
        <PersistenceStatus
          value={session.save}
          shared={session.save.shared}
          onRetry={() => {
            void session.siteKernel.flush();
          }}
          onDownload={() => {
            const source = session.vault.downloadSource();
            const url = URL.createObjectURL(
              new Blob([source.contents], { type: source.mediaType }),
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = source.fileName;
            link.click();
            setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 1000);
          }}
        />
      )}
      {session.restored && noticeDismissedFor !== fixture ? (
        <div className="pg-restored" role="status">
          <p>{labels.restored}</p>
          <ChromeButton
            size="sm"
            onClick={() => {
              session.startOver();
            }}
          >
            {labels.startOver}
          </ChromeButton>
          <ChromeButton
            variant="icon"
            size="sm"
            aria-label={labels.dismissRestored}
            onClick={() => {
              onDismissRestored(fixture);
            }}
          >
            <span aria-hidden="true">×</span>
          </ChromeButton>
        </div>
      ) : null}
    </>
  );
}

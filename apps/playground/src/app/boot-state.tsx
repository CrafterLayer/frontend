import { ChromeButton } from '@craftkit/builder';

import type { VaultKernelState } from '../features/vault/use-vault';

/**
 * What the editing area shows while there is no kernel.
 *
 * A stored page that will not open must land somewhere a person can act on. It
 * is the one failure with an obvious cause and an obvious cure — a save written
 * by a vocabulary this build no longer has, or half-written by a browser that
 * was closed — and "the editor is blank" is not an acceptable rendering of it.
 */
export function BootState({ state }: { state: VaultKernelState }) {
  if (state.status === 'failed') {
    return (
      <section className="pg-boot pg-boot--failed" aria-label="Saved page">
        <h2>This saved page could not be opened</h2>
        <p className="pg-boot__reason">{state.reason}</p>
        {/*
          TRY AGAIN LEADS, and it is the primary action.

          Not every failed boot is a broken document. A read that blipped, a
          database another tab held for a moment: the save is intact and only
          the attempt failed. This screen used to offer "start over" as its ONLY
          action, so the single button on it deleted a page that was never
          damaged — the person performing the deletion, on the app's advice.
        */}
        <p>
          Trying again re-opens the stored page and deletes nothing. Starting over discards the
          stored copy and opens the fixture again; restore points are kept either way.
        </p>
        <div className="pg-boot__actions">
          <ChromeButton
            variant="primary"
            onClick={() => {
              state.retry();
            }}
          >
            Try again
          </ChromeButton>
          <ChromeButton
            onClick={() => {
              state.startOver();
            }}
          >
            Start over
          </ChromeButton>
        </div>
      </section>
    );
  }
  return (
    <p className="pg-boot" role="status">
      Opening your page…
    </p>
  );
}

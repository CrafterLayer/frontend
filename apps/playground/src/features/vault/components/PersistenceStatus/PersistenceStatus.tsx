import { ChromeButton, type PersistenceAck } from '@craftkit/builder';

import './PersistenceStatus.css';

export type PersistenceStatusValue =
  { readonly kind: 'saving'; readonly sequence?: number | undefined } | PersistenceAck;

export interface PersistenceStatusProps {
  readonly value: PersistenceStatusValue;
  readonly shared?: boolean | undefined;
  readonly onRetry?: (() => void) | undefined;
  readonly onDownload?: (() => void) | undefined;
}

/** Honest save feedback driven by the acknowledgement from the storage transaction. */
export function PersistenceStatus({
  value,
  shared = false,
  onRetry,
  onDownload,
}: PersistenceStatusProps) {
  const failed = value.kind === 'failed';
  const needsRecovery = value.kind === 'session-only' || failed;

  return (
    <section
      className="pg-persistence-status"
      data-kind={value.kind}
      aria-label="Project save status"
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className="pg-persistence-status__indicator" aria-hidden="true" />
      <div className="pg-persistence-status__copy">
        <strong>{titleFor(value)}</strong>
        <p>{messageFor(value)}</p>
        {shared ? <p>This project is open elsewhere. The latest saved copy wins.</p> : null}
      </div>
      {needsRecovery ? (
        <div className="pg-persistence-status__actions">
          {onDownload === undefined ? null : (
            <ChromeButton size="sm" onClick={onDownload}>
              Download project
            </ChromeButton>
          )}
          {onRetry === undefined ? null : (
            <ChromeButton variant="primary" size="sm" onClick={onRetry}>
              Retry storage
            </ChromeButton>
          )}
        </div>
      ) : null}
    </section>
  );
}

function titleFor(value: PersistenceStatusValue): string {
  switch (value.kind) {
    case 'saving':
      return 'Saving changes…';
    case 'durable':
      return 'Saved to this device';
    case 'session-only':
      return 'Saved for this session only';
    case 'failed':
      return 'Changes are not saved';
  }
}

function messageFor(value: PersistenceStatusValue): string {
  switch (value.kind) {
    case 'saving':
      return 'Keep this tab open until storage confirms the write.';
    case 'durable':
      return `Storage confirmed revision ${String(value.sequence)}.`;
    case 'session-only':
      return `${value.reason} Download a recovery copy before closing this tab.`;
    case 'failed':
      return `${value.reason}${value.recoverable ? ' Your source is still open and can be downloaded.' : ''}`;
  }
}

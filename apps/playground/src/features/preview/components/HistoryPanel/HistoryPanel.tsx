import { useCallback, useEffect, useState } from 'react';

import { ChromeButton, type BuilderKernel } from '@craftkit/builder';

import {
  restoreDocument,
  type SnapshotShelf,
  type VaultSnapshot,
  type VaultSnapshotMeta,
} from '../../../vault';
import { HISTORY_PANEL_LABELS_EN, type HistoryPanelLabels } from './HistoryPanel.labels';
import './HistoryPanel.css';

export interface HistoryPanelProps {
  kernel: BuilderKernel;
  /** The document's shelf of restore points, from the vault that opened it. */
  shelf: SnapshotShelf;
  /** Injected so a test and a story can STATE the time instead of guessing it. */
  now?: (() => number) | undefined;
  /** Every string the panel shows; English unless the host passes its locale's set. */
  labels?: HistoryPanelLabels | undefined;
}

/** The list plus the moment it was read: relative ages need both, and both together. */
interface HistoryView {
  readonly entries: readonly VaultSnapshotMeta[];
  readonly asOf: number;
  /**
   * The shelf could not be READ. Emphatically not the same as empty: the
   * restore points are still on disk, and rendering "nothing kept yet" over a
   * failed read tells a person their work is gone while it is not.
   */
  readonly unreadable: boolean;
}

/**
 * The restore points a person made on purpose.
 *
 * Two things this panel is deliberately NOT. It is not the session's autosave —
 * that is the kernel's own compaction, invisible and continuous. And it is not
 * undo: undo walks the history one step at a time and forgets a step once you
 * move past it, while a restore point is a whole page kept on purpose, by name,
 * for as long as the shelf holds it.
 *
 * Restoring goes through `restoreDocument`, which projects the stored page to
 * canonical text, parses it against the LIVE one and sends the difference
 * through the kernel's `applyPatches` door as a single transaction. That is why
 * the announcement can promise one undo: the revert is a forward change like
 * any other, and nothing here reaches around the kernel.
 */
export function HistoryPanel({
  kernel,
  shelf,
  now = Date.now,
  labels = HISTORY_PANEL_LABELS_EN,
}: HistoryPanelProps) {
  /*
    The clock is captured ONCE. Taken as a live prop it would land in the
    dependency list of the effect that reads the shelf, and a caller passing an
    inline arrow would re-run that effect on every render it caused — a loop
    whose only symptom is a panel that never settles.
  */
  const [clock] = useState(() => now);
  const [view, setView] = useState<HistoryView | undefined>(undefined);
  const [name, setName] = useState('');
  const [message, setMessage] = useState({ text: '', nonce: 0 });

  const announce = useCallback((text: string) => {
    // The nonce rides along so the SAME sentence twice is still announced: a
    // live region only speaks when its contents change.
    setMessage((current) => ({ text, nonce: current.nonce + 1 }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const entries = await shelf.list();
      setView({ entries, asOf: clock(), unreadable: false });
    } catch {
      setView({ entries: [], asOf: clock(), unreadable: true });
    }
  }, [shelf, clock]);

  useEffect(() => {
    // A box rather than a `let`: the flag is written by the cleanup and read by
    // the await's continuation, and a plain boolean narrows to its initialiser.
    const mounted = { current: true };
    void (async () => {
      // Caught HERE rather than left to the IIFE: an uncaught read turned the
      // panel into a false empty state AND raised an unhandled rejection.
      try {
        const entries = await shelf.list();
        if (mounted.current) {
          setView({ entries, asOf: clock(), unreadable: false });
        }
      } catch {
        if (mounted.current) {
          setView({ entries: [], asOf: clock(), unreadable: true });
        }
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [shelf, clock]);

  const entries = view?.entries ?? [];
  const unreadable = view?.unreadable ?? false;

  const save = (): void => {
    void (async () => {
      const typed = name.trim();
      const label = typed.length > 0 ? typed : labels.defaultName(entries.length + 1);
      try {
        const meta = await shelf.save({
          label,
          ts: clock(),
          // The persistence position the page was at, kept so a restore point
          // can say WHERE in the session it was taken and not merely when.
          seq: kernel.context.store.getState().seq,
          document: kernel.getDocument(),
        });
        setName('');
        await refresh();
        announce(labels.saved(meta.label));
      } catch {
        announce(labels.saveFailed);
      }
    })();
  };

  const restore = (entry: VaultSnapshotMeta): void => {
    void (async () => {
      // Save and clear both catch and announce; this one did not, so a storage
      // error made the button do nothing whatever — indistinguishable, from the
      // outside, from a control that is simply broken.
      let stored: VaultSnapshot | undefined;
      try {
        stored = await shelf.read(entry.id);
      } catch {
        announce(labels.readFailed(entry.label));
        return;
      }
      if (stored === undefined) {
        announce(labels.gone(entry.label));
        await refresh();
        return;
      }
      const outcome = restoreDocument(kernel, stored.document);
      if (!outcome.ok) {
        announce(labels.restoreFailed(entry.label, outcome.reason));
        return;
      }
      announce(outcome.changed ? labels.restored(entry.label) : labels.alreadyMatches(entry.label));
    })();
  };

  const clear = (): void => {
    void (async () => {
      try {
        await shelf.clear();
        await refresh();
        announce(labels.cleared);
      } catch {
        announce(labels.clearFailed);
      }
    })();
  };

  return (
    <section className="pg-history" aria-label={labels.region}>
      <header className="pg-history__head">
        <h2>{labels.title}</h2>
        <p>{labels.intro}</p>
      </header>

      <div className="pg-history__save">
        <label className="pg-history__name">
          <span>{labels.name}</span>
          <input
            type="text"
            value={name}
            placeholder={labels.namePlaceholder}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
        </label>
        <ChromeButton
          variant="primary"
          size="lg"
          onClick={() => {
            save();
          }}
        >
          {labels.save}
        </ChromeButton>
      </div>

      <output aria-live="polite" aria-label={labels.status} className="pg-history__status">
        {message.text}
        {message.nonce % 2 === 1 ? '\u200b' : ''}
      </output>

      {unreadable ? (
        <p className="pg-history__empty" role="alert">
          {labels.unreadable}
        </p>
      ) : entries.length === 0 ? (
        <p className="pg-history__empty">{labels.empty}</p>
      ) : (
        <ul className="pg-history__list">
          {entries.map((entry) => (
            <li key={entry.id} className="pg-history__row">
              <span className="pg-history__label">{entry.label}</span>
              <span className="pg-history__facts">
                {relativeTime(entry.ts, view?.asOf ?? entry.ts, labels)} ·{' '}
                {formatBytes(entry.bytes, labels)}
              </span>
              <ChromeButton
                size="sm"
                /*
                  The visible word is "Restore"; the spoken name names WHICH one,
                  because a column of identical buttons is unusable by voice and
                  by screen reader alike. WCAG 2.5.3 holds: the visible text is
                  contained in the accessible name.
                */
                aria-label={labels.restoreNamed(entry.label)}
                onClick={() => {
                  restore(entry);
                }}
              >
                {labels.restore}
              </ChromeButton>
            </li>
          ))}
        </ul>
      )}

      <ChromeButton
        size="sm"
        className="pg-history__clear"
        /* Never offered over a shelf that could not be read: clearing what you
           cannot see is not a choice a person can make. */
        disabled={entries.length === 0 || unreadable}
        onClick={() => {
          clear();
        }}
      >
        {labels.clear}
      </ChromeButton>
    </section>
  );
}

/**
 * Ages, not timestamps. "14:22" answers a question nobody asked; "4 min ago" is
 * the one a person restoring a page actually has.
 */
function relativeTime(ts: number, asOf: number, labels: HistoryPanelLabels): string {
  const seconds = Math.max(0, Math.round((asOf - ts) / 1000));
  if (seconds < 45) {
    return labels.justNow;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return labels.minutesAgo(minutes);
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return labels.hoursAgo(hours);
  }
  return labels.daysAgo(Math.round(hours / 24));
}

/** kB, not KiB: the number beside a restore point is for a person, not a disk. */
function formatBytes(bytes: number, labels: HistoryPanelLabels): string {
  if (bytes < 1000) {
    return labels.size(String(bytes), 'B');
  }
  const kilobytes = bytes / 1000;
  if (kilobytes < 1000) {
    return labels.size(kilobytes.toFixed(kilobytes < 10 ? 1 : 0), 'kB');
  }
  return labels.size((kilobytes / 1000).toFixed(1), 'MB');
}

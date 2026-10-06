import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { BuilderKernel, HistoryEntry, KernelHistory } from '@craftkit/builder-core';

import '../../styles/visually-hidden.css';
import { HISTORY_LIST_LABELS_EN, type HistoryListLabels } from './HistoryList.labels';
import { entryLabel, relativeTime } from './history-format';
import './HistoryList.css';

export interface HistoryListProps {
  /** BY PROP — the shell never reads React context. Its store change drives re-reads. */
  kernel: BuilderKernel;
  /**
   * The undo stack to show. Defaults to `kernel.history()`; pass one when the
   * kernel is a lens that does not expose it (the site kernel's page view
   * until it wires `createKernelHistoryView`).
   */
  history?: KernelHistory | undefined;
  labels?: HistoryListLabels | undefined;
  /** The clock relative times are measured from; injectable for tests and stories. */
  now?: (() => number) | undefined;
  /** How often relative times refresh, in ms. 0 = never. */
  refreshMs?: number | undefined;
}

const NO_ENTRIES: readonly HistoryEntry[] = [];
const systemNow = (): number => Date.now();

/**
 * The labelled undo stack (style-manager DESIGN.md §E, History panel): every
 * step with its author and relative time, the current position marked, and a
 * click that JUMPS there — repeated undo or redo through the kernel, never a
 * new transaction. Steps after the current one stay listed (they are redo)
 * until a new change clears them.
 */
export function HistoryList({
  kernel,
  history: historyProp,
  labels = HISTORY_LIST_LABELS_EN,
  now = systemNow,
  refreshMs = 30_000,
}: HistoryListProps) {
  const history = historyProp ?? kernel.history?.();
  const subscribe = useCallback(
    (listener: () => void) =>
      kernel.context.store.subscribe(() => {
        listener();
      }),
    [kernel],
  );
  const entries = useSyncExternalStore(
    subscribe,
    () => history?.entries() ?? NO_ENTRIES,
    () => history?.entries() ?? NO_ENTRIES,
  );
  const position = useSyncExternalStore(
    subscribe,
    () => history?.position() ?? 0,
    () => history?.position() ?? 0,
  );
  const [clock, setClock] = useState(now);
  useEffect(() => {
    if (refreshMs <= 0) return undefined;
    const timer = setInterval(() => {
      setClock(now());
    }, refreshMs);
    return () => {
      clearInterval(timer);
    };
  }, [now, refreshMs]);
  // A new step should never read "in 3 seconds": the clock catches up with it.
  const latest = entries.at(-1)?.at ?? 0;
  const reference = Math.max(clock, latest);

  const [message, setMessage] = useState({ text: '', nonce: 0 });

  const jump = (target: number, label: string) => {
    if (history === undefined) return;
    history.jumpTo(target);
    setClock(now());
    setMessage((current) => ({ text: labels.jumped(label), nonce: current.nonce + 1 }));
  };

  return (
    <section className="bldr-history-list" aria-label={labels.title}>
      <h2 className="bldr-history-list__title">{labels.title}</h2>
      {entries.length === 0 ? (
        <p className="bldr-history-list__empty">{labels.empty}</p>
      ) : (
        <ol className="bldr-history-list__items">
          <li>
            <button
              type="button"
              className="bldr-history-list__entry bldr-history-list__entry--start"
              aria-current={position === 0 ? 'step' : undefined}
              aria-label={labels.jumpTo(labels.start)}
              onClick={() => {
                jump(0, labels.start);
              }}
            >
              <span className="bldr-history-list__author" aria-hidden="true">
                ○
              </span>
              <span className="bldr-history-list__label">{labels.start}</span>
            </button>
          </li>
          {entries.map((entry, index) => {
            const label = entryLabel(entry, labels);
            const applied = index < position;
            const current = index + 1 === position;
            return (
              <li key={`${entry.id}-${String(index)}`}>
                <button
                  type="button"
                  className={[
                    'bldr-history-list__entry',
                    applied ? '' : 'bldr-history-list__entry--undone',
                    current ? 'bldr-history-list__entry--current' : '',
                  ]
                    .filter((name) => name !== '')
                    .join(' ')}
                  aria-current={current ? 'step' : undefined}
                  title={applied ? undefined : labels.undone}
                  onClick={() => {
                    jump(index + 1, label);
                  }}
                >
                  <span
                    className="bldr-history-list__author"
                    data-author={entry.author}
                    role="img"
                    aria-label={labels.author[entry.author]}
                  >
                    {entry.author === 'ai' ? (
                      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6Z" />
                      </svg>
                    ) : entry.author === 'codeview' ? (
                      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <path d="M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <circle cx="8" cy="5" r="2.75" />
                        <path d="M2.5 14.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
                      </svg>
                    )}
                  </span>
                  <span className="bldr-history-list__label">{label}</span>
                  <time className="bldr-history-list__time" dateTime={new Date(entry.at).toISOString()}>
                    {relativeTime(entry.at, reference, labels.locale)}
                  </time>
                  {current ? <span className="bldr-visually-hidden">{`, ${labels.current}`}</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="bldr-visually-hidden" role="status" aria-live="polite">
        {message.nonce % 2 === 1 ? `${message.text}​` : message.text}
      </p>
    </section>
  );
}

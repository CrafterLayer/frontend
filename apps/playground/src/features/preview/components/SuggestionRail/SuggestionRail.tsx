import { useRef } from 'react';

import { localeOf, type Suggestion } from '../AssistantPanel/AssistantPanel.suggestions';

export interface SuggestionRailProps {
  /** What to offer, in priority order. Empty renders nothing at all. */
  readonly suggestions: readonly Suggestion[];
  /**
   * Stacked when the conversation is empty, railed once it is not.
   *
   * A caller decides this rather than the component inferring it from the list,
   * because "is this conversation empty" is a fact about the panel and the rail
   * has no business holding a second opinion about it.
   */
  readonly layout: 'stack' | 'rail';
  /** While the assistant works: present, holding its height, not pressable. */
  readonly busy: boolean;
  readonly onPick: (text: string) => void;
}

/**
 * What to say next, one tap away.
 *
 * TWO layouts of one list. On an empty panel there is nothing to crowd and a
 * person who has said nothing yet is choosing, so the suggestions stack as
 * full-width targets. The moment a conversation exists they become a one-row
 * rail at a fixed height: a column of cards ate half a 360px panel and hid the
 * very thread it was meant to help continue.
 */
export function SuggestionRail({ suggestions, layout, busy, onPick }: SuggestionRailProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const scroll = (direction: number) => {
    const list = listRef.current;
    if (!list) return;
    const rtl = getComputedStyle(list).direction === 'rtl';
    list.scrollBy({ left: direction * list.clientWidth * (rtl ? -1 : 1) });
  };
  if (suggestions.length === 0) return null;
  return (
    <div className="pg-chat__suggestions" data-layout={layout}>
      {layout === 'rail' ? (
        <button
          type="button"
          className="pg-chat__suggestion-arrow"
          aria-label="Previous suggestions"
          disabled={busy}
          onClick={() => scroll(-1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
      ) : null}
      <ul
        ref={listRef}
        className="pg-chat__starters"
        lang="en"
        aria-label="Suggestions"
        data-layout={layout}
      >
        {suggestions.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="pg-chat__starter"
              disabled={busy}
              data-kind={entry.kind}
              lang={localeOf(entry.text)}
              dir="auto"
              /*
              The chip truncates; the whole sentence stays reachable. The
              accessible name is the full text — the span is the only content —
              and `title` gives a sighted reader the rest on hover.
            */
              title={entry.text}
              onClick={() => {
                onPick(entry.text);
              }}
            >
              <span className="pg-chat__starter-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" focusable="false">
                  <path
                    d="M8 3.5v9M3.5 8h9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="pg-chat__starter-text">{entry.text}</span>
            </button>
          </li>
        ))}
      </ul>
      {layout === 'rail' ? (
        <button
          type="button"
          className="pg-chat__suggestion-arrow"
          aria-label="Next suggestions"
          disabled={busy}
          onClick={() => scroll(1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      ) : null}
    </div>
  );
}

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

/** The plus that marks an option. Local because it is decoration, not an export. */
function RailIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
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
  if (suggestions.length === 0) return null;
  return (
    <ul
      className="pg-chat__starters"
      lang="en"
      aria-label="Suggestions"
      data-layout={layout}
      onWheel={(event) => {
        /*
          A trackpad and a touchscreen scroll this rail natively; a MOUSE wheel
          only scrolls vertically, so on a strip with no vertical overflow it
          does nothing and the chips past the edge are unreachable without
          dragging. Translating the dominant axis is what makes one gesture work
          for every pointer.
        */
        const rail = event.currentTarget;
        if (rail.dataset['layout'] !== 'rail') return;
        if (rail.scrollWidth <= rail.clientWidth) return;
        const delta =
          Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (delta === 0) return;
        /*
          RTL reverses which way "forward" is, and `scrollLeft` follows the
          writing direction: in an Arabic panel it starts at 0 on the RIGHT and
          runs NEGATIVE leftward. Adding a positive delta there scrolls back
          toward the start you are already at — the rail simply refuses to move,
          in the language this product defaults to.
        */
        const rtl = getComputedStyle(rail).direction === 'rtl';
        rail.scrollBy({ left: rtl ? -delta : delta });
      }}
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
              <RailIcon />
            </span>
            <span className="pg-chat__starter-text">{entry.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

import { useEffect, useId, useMemo, useState } from 'react';

import type { AssetEntry, AssetLibraryPort } from '@craftkit/builder-schema';

import './AssetPicker.css';

export interface AssetPickerProps {
  /** Where the pictures come from. The only boundary this component has. */
  readonly library: AssetLibraryPort;
  /** The picker's accessible name — what this set of pictures is for. */
  readonly label: string;
  readonly selected?: string | undefined;
  readonly onSelect?: ((entry: AssetEntry) => void) | undefined;
  /** Placeholder for the filter box. */
  readonly filterLabel?: string | undefined;
}

type LibraryState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly entries: readonly AssetEntry[] }
  | { readonly kind: 'unavailable'; readonly reason: string };

const matches = (entry: AssetEntry, needle: string): boolean => {
  if (needle === '') return true;
  const haystack = [entry.description, entry.alt, ...entry.mood].join(' ').toLowerCase();
  return haystack.includes(needle);
};

/**
 * The site's pictures, as something a person can look through and choose from.
 *
 * ## Why every state here is TEXT
 *
 * A picker's failure states are where it is actually used. The library is empty
 * on a new project, unreachable on a bad connection, and filtered to nothing
 * every time someone types a word that is not in it — and each of those, drawn
 * as a blank rectangle, is indistinguishable from the component being broken.
 * So each says what happened, in a sentence, in the place the pictures would
 * have been. That is the same rule the generated pages follow: an absence is
 * labelled or it is a bug.
 *
 * ## Why alt text is not optional
 *
 * Every entry in the library carries alt text written by whoever put it there,
 * and this component shows it — as the image's `alt`, and as visible text under
 * the picture. The visible copy is not redundancy: it is what lets a person
 * choosing between two similar photographs see what a screen reader will say
 * about the one they pick, before they pick it.
 */
export function AssetPicker({
  library,
  label,
  selected,
  onSelect,
  filterLabel = 'Filter pictures',
}: AssetPickerProps) {
  const [state, setState] = useState<LibraryState>({ kind: 'loading' });
  const [listed, setListed] = useState(library);
  const [filter, setFilter] = useState('');
  const filterId = useId();

  /*
    Pointed at a second library, this must not go on showing the first one's
    pictures while the second answers. They are BUTTONS: a person could choose
    a picture from a library that is no longer in play, and the choice would
    look like it worked.

    Adjusted during render rather than in an Effect, which is React's own
    documented pattern for resetting state when a prop changes — an Effect
    would paint the stale grid once before clearing it.
  */
  if (library !== listed) {
    setListed(library);
    setState({ kind: 'loading' });
  }

  useEffect(() => {
    /*
      An abort on unmount, and a `live` flag as well: aborting tells a network
      implementation to stop, and the flag stops a resolved promise from
      writing into a component that has already gone.
    */
    const controller = new AbortController();
    let live = true;

    library
      .list({ signal: controller.signal })
      .then((entries) => {
        if (live) setState({ kind: 'ready', entries });
      })
      .catch((error: unknown) => {
        if (!live || controller.signal.aborted) return;
        setState({
          kind: 'unavailable',
          reason: error instanceof Error ? error.message : 'The library did not answer.',
        });
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [library]);

  const needle = filter.trim().toLowerCase();
  const shown = useMemo(
    () => (state.kind === 'ready' ? state.entries.filter((entry) => matches(entry, needle)) : []),
    [state, needle],
  );

  const message =
    state.kind === 'loading'
      ? 'Loading pictures…'
      : state.kind === 'unavailable'
        ? `The picture library is unavailable: ${state.reason}`
        : state.entries.length === 0
          ? 'There are no pictures in this library yet.'
          : shown.length === 0
            ? `No picture matches “${filter.trim()}”.`
            : undefined;

  return (
    <section className="bldr-assets" aria-label={label}>
      <div className="bldr-assets__filter">
        <label className="bldr-assets__filter-label" htmlFor={filterId}>
          {filterLabel}
        </label>
        <input
          className="bldr-assets__filter-input"
          id={filterId}
          type="search"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
          }}
          /*
            Disabled while there is nothing to filter. A search box over an
            empty library invites someone to type and conclude the search is
            broken when nothing comes back.
          */
          disabled={state.kind !== 'ready' || state.entries.length === 0}
        />
      </div>

      {message === undefined ? (
        <ul className="bldr-assets__grid">
          {shown.map((entry) => (
            <li className="bldr-assets__cell" key={entry.id}>
              <button
                className="bldr-assets__pick"
                type="button"
                aria-pressed={entry.id === selected}
                onClick={() => onSelect?.(entry)}
              >
                <img
                  className="bldr-assets__image"
                  src={entry.url}
                  alt={entry.alt}
                  loading="lazy"
                  decoding="async"
                />
                <span className="bldr-assets__caption">{entry.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        /*
          `role="status"` so the change is announced. Someone who typed a filter
          and got nothing needs to hear that, not to discover it by tabbing into
          an empty region.
        */
        <p className="bldr-assets__message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

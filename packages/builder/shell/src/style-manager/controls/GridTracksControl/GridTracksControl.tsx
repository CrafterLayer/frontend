import type { StyleMode, StyleValue } from '@craftkit/builder-schema';

import {
  GRID_TRACKS_CONTROL_LABELS_EN,
  type GridTracksControlLabels,
} from './GridTracksControl.labels';
import { TRACK_SIZES, tracksOf, valueOfTracks } from './tracks';

import './GridTracksControl.css';

export interface GridTracksControlProps {
  /** "Grid columns" / "Grid rows". */
  readonly label: string;
  readonly value: StyleValue | undefined;
  /** Tokens mode writes counts only (`grid-cols-3`); free mode edits each track. */
  readonly mode?: StyleMode | undefined;
  readonly onCommit: (value: StyleValue | null) => void;
  readonly disabled?: boolean | undefined;
  readonly labels?: GridTracksControlLabels | undefined;
}

/**
 * Grid columns or rows as tracks (style-manager DESIGN.md §E "Visual
 * flex/grid"): one chip per track with `fr`/`auto`/`minmax` sizes, add and
 * remove. Equal `1fr` tracks are written as a count token; anything else as
 * the exact template.
 */
export function GridTracksControl({
  label,
  value,
  mode = 'free',
  onCommit,
  disabled = false,
  labels = GRID_TRACKS_CONTROL_LABELS_EN,
}: GridTracksControlProps) {
  const tracks = tracksOf(value);
  const write = (next: readonly string[]) => {
    onCommit(valueOfTracks(next));
  };

  return (
    <div className="bldr-grid-tracks" role="group" aria-label={label}>
      {tracks.length === 0 ? (
        // A clear empty state, not a blank box above the "Add track" button.
        <p className="bldr-grid-tracks__empty">{labels.empty}</p>
      ) : (
        <div className="bldr-grid-tracks__preview" aria-hidden="true">
          {tracks.map((track, index) => (
            <span
              // Tracks are positional: the index IS the identity here.
              key={index}
              className="bldr-grid-tracks__bar"
              style={{ flexGrow: track.endsWith('fr') ? Number.parseFloat(track) : 1 }}
            />
          ))}
        </div>
      )}
      <input
        className="bldr-grid-tracks__count"
        type="number"
        min={1}
        max={12}
        aria-label={`${labels.count}: ${label}`}
        value={tracks.length === 0 ? '' : tracks.length}
        disabled={disabled}
        onChange={(event) => {
          const count = Math.round(Number(event.target.value));
          if (!Number.isFinite(count) || count < 1 || count > 12 || count === tracks.length) return;
          const next =
            count > tracks.length
              ? [...tracks, ...Array.from({ length: count - tracks.length }, () => '1fr')]
              : tracks.slice(0, count);
          write(next);
        }}
      />
      {mode === 'free' ? (
        <ul className="bldr-grid-tracks__list">
          {tracks.map((track, index) => (
            <li key={index} className="bldr-grid-tracks__track">
              <select
                className="bldr-grid-tracks__size"
                aria-label={labels.track(index)}
                value={track}
                disabled={disabled}
                onChange={(event) => {
                  write(tracks.map((existing, at) => (at === index ? event.target.value : existing)));
                }}
              >
                {(TRACK_SIZES.includes(track) ? TRACK_SIZES : [track, ...TRACK_SIZES]).map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="bldr-grid-tracks__remove"
                aria-label={labels.remove(index)}
                disabled={disabled}
                onClick={() => {
                  write(tracks.filter((_, at) => at !== index));
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="bldr-grid-tracks__add"
              disabled={disabled || tracks.length >= 24}
              onClick={() => {
                write([...tracks, '1fr']);
              }}
            >
              {labels.add}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

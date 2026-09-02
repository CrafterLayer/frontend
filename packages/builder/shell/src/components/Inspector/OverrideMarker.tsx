import type { EditingBucket } from '../../devices/buckets';
import { INSPECTOR_ICONS } from './Inspector.icons';

export interface OverrideMarkerProps {
  /** Joins the control's `aria-describedby` chain — the marker is part of its description. */
  readonly markerId: string;
  readonly bucket: Exclude<EditingBucket, 'base'>;
  readonly propKey: string;
  readonly onClear: () => void;
}

/** "{bucket} override" plus the one-transaction way to take it back. */
export function OverrideMarker({ markerId, bucket, propKey, onClear }: OverrideMarkerProps) {
  return (
    <div className="bldr-inspector__override-row">
      <span id={markerId} className="bldr-inspector__override">
        {bucket} override
      </span>
      <button
        type="button"
        className="bldr-inspector__override-clear"
        aria-label={`Clear ${propKey} override`}
        onClick={onClear}
      >
        {INSPECTOR_ICONS['override-clear']}
      </button>
    </div>
  );
}

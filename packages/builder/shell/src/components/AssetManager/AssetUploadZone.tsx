import { useId, useState } from 'react';

import type { AssetManagerLabels } from './AssetManager.labels';

export interface AssetUploadZoneProps {
  readonly labels: AssetManagerLabels;
  readonly onFile: (file: File, cropFirst: boolean) => void;
  readonly busy?: boolean | undefined;
}

/** The upload glyph: a tray with an arrow rising out of it (16px grid, 1.5 stroke). */
const UPLOAD_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 10.5V2.75M4.75 6 8 2.75 11.25 6" />
    <path d="M2.75 10v2.25a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1V10" />
  </svg>
);

/**
 * The upload target: a file input that is also a drop zone. The input is the
 * accessible path (it is a real, labelled control); dropping is the shortcut.
 *
 * Studio Indigo (2026-10-12): drawn as a target, not a form row — the glyph in an
 * Accent tile, the label as the zone's button (the native input is visually
 * hidden but stays the focusable, labelled control; its focus rings the button),
 * the hint under it, and the crop choice as a quiet check.
 */
export function AssetUploadZone({ labels, onFile, busy = false }: AssetUploadZoneProps) {
  const [cropFirst, setCropFirst] = useState(false);
  const [over, setOver] = useState(false);
  const inputId = useId();
  const hintId = useId();
  return (
    <div
      className="bldr-asset-manager__drop"
      data-over={over ? 'true' : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const file = event.dataTransfer.files[0];
        if (file !== undefined && !busy) onFile(file, cropFirst);
      }}
    >
      <span className="bldr-asset-manager__drop-icon">{UPLOAD_ICON}</span>
      <input
        id={inputId}
        className="bldr-asset-manager__file"
        type="file"
        accept="image/*"
        disabled={busy}
        aria-describedby={hintId}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onFile(file, cropFirst);
          event.target.value = '';
        }}
      />
      <label
        className="bldr-asset-manager__upload-label"
        htmlFor={inputId}
        data-busy={busy || undefined}
      >
        {labels.upload}
      </label>
      <p id={hintId} className="bldr-asset-manager__hint">
        {labels.drop}
      </p>
      <label className="bldr-asset-manager__check">
        <input
          type="checkbox"
          checked={cropFirst}
          onChange={(event) => {
            setCropFirst(event.target.checked);
          }}
        />
        {labels.cropFirst}
      </label>
    </div>
  );
}

import { useId, useState } from 'react';

import type { AssetManagerLabels } from './AssetManager.labels';

export interface AssetUploadZoneProps {
  readonly labels: AssetManagerLabels;
  readonly onFile: (file: File, cropFirst: boolean) => void;
  readonly busy?: boolean | undefined;
}

/**
 * The upload target: a file input that is also a drop zone. The input is the
 * accessible path (it is a real, labelled control); dropping is the shortcut.
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
      <label className="bldr-asset-manager__upload-label" htmlFor={inputId}>
        {labels.upload}
      </label>
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

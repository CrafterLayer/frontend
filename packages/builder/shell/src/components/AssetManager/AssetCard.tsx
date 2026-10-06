import { useId } from 'react';

import type { AssetEntry } from '@craftkit/builder-schema';

import { TokenDraftField } from '../DesignSystemPanel/TokenDraftField';
import type { AssetManagerLabels } from './AssetManager.labels';

export interface AssetCardProps {
  readonly asset: AssetEntry;
  readonly labels: AssetManagerLabels;
  readonly onAlt: (alt: string) => void;
  /** Absent ⇒ nothing is selected. */
  readonly onUse?: (() => void) | undefined;
  readonly onRemove: () => void;
}

/**
 * One site picture: the image, its size, an alt-text field that commits once
 * (a missing alt is flagged, because a screen reader says nothing useful
 * about an image without one), "use on selected" and delete.
 */
export function AssetCard({ asset, labels, onAlt, onUse, onRemove }: AssetCardProps) {
  const altId = useId();
  return (
    <li className="bldr-asset-manager__card">
      <img className="bldr-asset-manager__thumb" src={asset.url} alt={asset.alt} loading="lazy" decoding="async" />
      <div className="bldr-asset-manager__meta">
        <span className="bldr-asset-manager__name">{asset.description}</span>
        <span className="bldr-asset-manager__size" dir="ltr">
          {labels.size(asset.width, asset.height)}
        </span>
        {asset.alt.trim() === '' ? <span className="bldr-asset-manager__flag">{labels.altMissing}</span> : null}
      </div>
      <label className="bldr-visually-hidden" htmlFor={altId}>
        {labels.alt(asset.description)}
      </label>
      <TokenDraftField
        id={altId}
        className="bldr-asset-manager__alt"
        dir="auto"
        value={asset.alt}
        onCommit={onAlt}
      />
      <div className="bldr-asset-manager__actions">
        {onUse === undefined ? null : (
          <button type="button" className="bldr-asset-manager__button" onClick={onUse}>
            {labels.use}
          </button>
        )}
        <button
          type="button"
          className="bldr-asset-manager__button bldr-asset-manager__button--danger"
          onClick={onRemove}
        >
          {labels.remove}
        </button>
      </div>
    </li>
  );
}

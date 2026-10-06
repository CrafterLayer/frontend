import { useEffect, useId, useState } from 'react';

import type { AssetEntry } from '@craftkit/builder-schema';

import { AssetPicker } from '../../components/AssetPicker';
import type { FieldControlProps } from '../controls/field-control-props';
import { useFieldLabels, useFieldServices } from '../field-services-context';
import './AssetField.css';

export type AssetFieldProps = FieldControlProps;

type ImageValue =
  | { readonly kind: 'asset'; readonly assetId: string }
  | { readonly kind: 'absent'; readonly reason: string }
  | { readonly kind: 'unset' };

function readImage(value: unknown): ImageValue {
  if (typeof value === 'object' && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;
    if (typeof record['assetId'] === 'string') {
      return { kind: 'asset', assetId: record['assetId'] };
    }
    if (record['absent'] === true) {
      return {
        kind: 'absent',
        reason: typeof record['reason'] === 'string' ? record['reason'] : '',
      };
    }
  }
  return { kind: 'unset' };
}

/**
 * The editor for `imagePropSchema`: a block image that is EITHER a picture
 * the site's asset table holds (`{ assetId }`) or a stated, deliberate
 * absence (`{ absent: true, reason }`).
 *
 * With a library (`FieldServicesProvider.assetLibrary`) the person sees the
 * current picture and picks another from the shared `AssetPicker`; without
 * one they can still type an asset id. "Remove image" writes a stated
 * absence, because the schema's law is that an absence is labelled. Every
 * change is one write through the row's door.
 *
 * Before this field, the property showed `{"assetId":"…"}` as raw JSON.
 */
export function AssetField({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
  labelledBy,
}: AssetFieldProps) {
  const uid = useId();
  const labels = useFieldLabels();
  const { assetLibrary } = useFieldServices();
  const image = readImage(value);
  const [entries, setEntries] = useState<readonly AssetEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [idDraft, setIdDraft] = useState<{ source: unknown; text: string } | null>(null);
  const pickerId = `${uid}-picker`;
  const idInputId = controlId ?? `${uid}-id`;

  useEffect(() => {
    if (assetLibrary === undefined) return undefined;
    const controller = new AbortController();
    let live = true;
    assetLibrary
      .list({ signal: controller.signal })
      .then((list) => {
        if (live) setEntries(list);
      })
      .catch(() => {
        if (live) setEntries([]);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [assetLibrary]);

  const current =
    image.kind === 'asset' ? entries?.find((entry) => entry.id === image.assetId) : undefined;
  const summary =
    image.kind === 'asset'
      ? current !== undefined
        ? labels.assetChosen(current.description)
        : labels.assetHeld(image.assetId)
      : image.kind === 'absent'
        ? labels.assetAbsent(image.reason)
        : labels.noImage;

  const storedId = image.kind === 'asset' ? image.assetId : '';
  const shownId = idDraft !== null && Object.is(idDraft.source, value) ? idDraft.text : storedId;
  const commitId = (next: string) => {
    setIdDraft(null);
    const trimmed = next.trim();
    if (trimmed === '' || trimmed === storedId) return;
    onChange({ assetId: trimmed });
  };

  return (
    <div
      className="bldr-asset-field"
      role={labelledBy === undefined ? undefined : 'group'}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <div className="bldr-asset-field__current">
        {current !== undefined ? (
          <img className="bldr-asset-field__thumb" src={current.url} alt={current.alt} />
        ) : (
          <span
            className="bldr-asset-field__thumb bldr-asset-field__thumb--empty"
            aria-hidden="true"
          />
        )}
        <p className="bldr-asset-field__summary" dir="auto">
          {summary}
        </p>
      </div>
      {assetLibrary === undefined ? (
        <div className="bldr-asset-field__id">
          <label className="bldr-asset-field__label" htmlFor={idInputId}>
            {labels.assetId}
          </label>
          <input
            id={idInputId}
            className="bldr-field__input"
            type="text"
            dir="ltr"
            spellCheck={false}
            value={shownId}
            disabled={disabled}
            onChange={(event) => {
              setIdDraft({ source: value, text: event.target.value });
            }}
            onBlur={() => {
              commitId(shownId);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                commitId(shownId);
              }
            }}
          />
        </div>
      ) : null}
      <div className="bldr-asset-field__actions">
        {assetLibrary === undefined ? null : (
          <button
            id={controlId}
            type="button"
            className="bldr-asset-field__button"
            aria-expanded={open}
            aria-controls={pickerId}
            disabled={disabled}
            onClick={() => {
              setOpen((was) => !was);
            }}
          >
            {open ? labels.hideLibrary : labels.chooseFromLibrary}
          </button>
        )}
        {image.kind === 'asset' ? (
          <button
            type="button"
            className="bldr-asset-field__button"
            disabled={disabled}
            onClick={() => {
              onChange({ absent: true, reason: labels.removedReason });
            }}
          >
            {labels.removeImage}
          </button>
        ) : null}
      </div>
      {assetLibrary === undefined ? null : (
        <div id={pickerId} hidden={!open}>
          {open ? (
            <AssetPicker
              library={assetLibrary}
              label={labels.libraryLabel}
              filterLabel={labels.filterPictures}
              selected={image.kind === 'asset' ? image.assetId : undefined}
              onSelect={(entry) => {
                setOpen(false);
                if (image.kind !== 'asset' || image.assetId !== entry.id) {
                  onChange({ assetId: entry.id });
                }
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

import { useId, useState } from 'react';

import { AssetPicker } from '../../components/AssetPicker';
import type { FieldControlProps } from '../controls/field-control-props';
import { useFieldLabels, useFieldServices } from '../field-services-context';
import { isAcceptableImageSrc } from '../image-src';
import './ImageUrlField.css';

export type ImageUrlFieldProps = FieldControlProps;

/**
 * An image address with the site's library beside it.
 *
 * Chosen by declaration: a block's image PART binds `{ src: 'imageSrc' }`, or
 * a property is declared `kind: 'image'`, never because a prop is called
 * `imageSrc`. With a library (`FieldServicesProvider.assetLibrary`) the person
 * can pick a picture; without one, or for an outside picture, they type the
 * address, which is checked before it reaches the door. The address input
 * drafts locally and commits once on blur or Enter, and a pick commits at
 * once, so each change is one Undo.
 */
export function ImageUrlField({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
  labelledBy,
  placeholder,
}: ImageUrlFieldProps) {
  const uid = useId();
  const labels = useFieldLabels();
  const { assetLibrary } = useFieldServices();
  const stored = typeof value === 'string' ? value : '';
  const [draft, setDraft] = useState<{ source: unknown; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [refused, setRefused] = useState(false);
  const shown = draft !== null && Object.is(draft.source, value) ? draft.text : stored;
  const inputId = controlId ?? `${uid}-src`;
  const errorId = `${uid}-error`;
  const pickerId = `${uid}-picker`;
  const described = [describedBy, refused ? errorId : undefined]
    .filter((id): id is string => id !== undefined)
    .join(' ');

  const write = (next: string) => {
    if (next === stored) {
      setRefused(false);
      setDraft(null);
      return;
    }
    if (!isAcceptableImageSrc(next)) {
      setRefused(true);
      return;
    }
    setRefused(false);
    setDraft(null);
    onChange(next);
  };

  return (
    <div className="bldr-image-url-field">
      <div className="bldr-image-url-field__row">
        {stored !== '' && isAcceptableImageSrc(stored) ? (
          <img className="bldr-image-url-field__thumb" src={stored} alt="" />
        ) : (
          <span
            className="bldr-image-url-field__thumb bldr-image-url-field__thumb--empty"
            aria-hidden="true"
          />
        )}
        <input
          id={inputId}
          className="bldr-field__input bldr-image-url-field__input"
          type="text"
          inputMode="url"
          dir="ltr"
          spellCheck={false}
          value={shown}
          placeholder={placeholder}
          disabled={disabled}
          aria-labelledby={labelledBy}
          aria-label={
            labelledBy === undefined && controlId === undefined ? labels.imageAddress : undefined
          }
          aria-invalid={refused ? true : undefined}
          aria-describedby={described === '' ? undefined : described}
          onChange={(event) => {
            setDraft({ source: value, text: event.target.value });
          }}
          onBlur={() => {
            write(shown.trim());
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              write(shown.trim());
            }
          }}
        />
      </div>
      {refused ? (
        <p id={errorId} className="bldr-inspector__rejection" role="alert">
          {labels.imageRefused}
        </p>
      ) : null}
      {assetLibrary === undefined ? null : (
        <>
          <button
            type="button"
            className="bldr-image-url-field__toggle"
            aria-expanded={open}
            aria-controls={pickerId}
            disabled={disabled}
            onClick={() => {
              setOpen((current) => !current);
            }}
          >
            {open ? labels.hideLibrary : labels.chooseFromLibrary}
          </button>
          <div id={pickerId} hidden={!open}>
            {open ? (
              <AssetPicker
                library={assetLibrary}
                label={labels.libraryLabel}
                filterLabel={labels.filterPictures}
                onSelect={(entry) => {
                  setOpen(false);
                  setRefused(false);
                  setDraft(null);
                  if (entry.url !== stored) onChange(entry.url);
                }}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

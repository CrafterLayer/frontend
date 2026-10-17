import { useId, useState } from 'react';

import type { NamedStyle } from '@craftkit/builder-schema';

import type { ClassManagerLabels } from './ClassManager.labels';

export interface ElementStyleStripProps {
  readonly elementName: string;
  /** The element's markers, in combo order, with the style each names (if it still exists). */
  readonly markers: readonly { readonly id: string; readonly style?: NamedStyle | undefined }[];
  readonly labels: ClassManagerLabels;
  readonly onMove: (id: string, delta: -1 | 1) => void;
  readonly onRemove: (id: string) => void;
  readonly onCreate: (name: string) => void;
  readonly disabled?: boolean | undefined;
}

/**
 * The selected element's side of the class manager: the styles it carries,
 * in combo order (a later style wins a conflict, so order is editable), and
 * "Create from element", which turns its current look into a library style.
 */
export function ElementStyleStrip({
  elementName,
  markers,
  labels,
  onMove,
  onRemove,
  onCreate,
  disabled = false,
}: ElementStyleStripProps) {
  const [name, setName] = useState('');
  const nameId = useId();
  return (
    <section className="bldr-class-manager__element" aria-label={labels.selected(elementName)}>
      <p className="bldr-class-manager__selected">{labels.selected(elementName)}</p>
      <h4 className="bldr-class-manager__subtitle">{labels.combo}</h4>
      {markers.length === 0 ? (
        <p className="bldr-class-manager__muted">{labels.comboEmpty}</p>
      ) : (
        <ol className="bldr-class-manager__combo">
          {markers.map(({ id, style }, at) => {
            const shown = style?.name ?? id;
            return (
              <li key={id} className="bldr-class-manager__chip">
                <span className="bldr-class-manager__chip-name">{shown}</span>
                <button
                  type="button"
                  className="bldr-class-manager__icon"
                  aria-label={labels.earlier(shown)}
                  disabled={disabled || at === 0}
                  onClick={() => {
                    onMove(id, -1);
                  }}
                >
                  <span aria-hidden className="bldr-class-manager__arrow">‹</span>
                </button>
                <button
                  type="button"
                  className="bldr-class-manager__icon"
                  aria-label={labels.later(shown)}
                  disabled={disabled || at === markers.length - 1}
                  onClick={() => {
                    onMove(id, 1);
                  }}
                >
                  <span aria-hidden className="bldr-class-manager__arrow">›</span>
                </button>
                <button
                  type="button"
                  className="bldr-class-manager__icon"
                  aria-label={labels.removeFrom(shown)}
                  disabled={disabled}
                  onClick={() => {
                    onRemove(id);
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <form
        className="bldr-class-manager__create"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() === '') return;
          onCreate(name);
          setName('');
        }}
      >
        <label className="bldr-visually-hidden" htmlFor={nameId}>
          {labels.createName}
        </label>
        <input
          id={nameId}
          className="bldr-class-manager__input"
          placeholder={labels.createName}
          value={name}
          disabled={disabled}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <button type="submit" className="bldr-class-manager__button" disabled={disabled || name.trim() === ''}>
          {labels.create}
        </button>
      </form>
    </section>
  );
}

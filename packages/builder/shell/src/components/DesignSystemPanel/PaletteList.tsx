import { useId, useState } from 'react';

import { isPaletteColorValue, type PaletteColor } from '@craftkit/builder-schema';

import { paletteSlug } from '../PaletteRampEditor/ramp';
import type { DesignSystemPanelLabels } from './DesignSystemPanel.labels';
import type { SiteCommit, SiteCommitResult } from './site-door';
import { TokenDraftField } from './TokenDraftField';

export interface PaletteListProps {
  readonly palette: readonly PaletteColor[];
  readonly commit: SiteCommit;
  readonly labels: DesignSystemPanelLabels;
  readonly disabled?: boolean | undefined;
  /** Reports each commit's outcome, so the panel can announce a refusal. */
  readonly onResult?: ((result: SiteCommitResult) => void) | undefined;
}

/** A free id for `name`: its slug, or the slug with -2, -3… when taken. */
function freshId(name: string, taken: ReadonlySet<string>): string {
  const slug = paletteSlug(name);
  if (!taken.has(slug)) return slug;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${slug.slice(0, 44)}-${String(n)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return slug;
}

/**
 * The site palette (library colours published as `--ck-c-<id>` and written
 * on elements as `bg-(--ck-c-<id>)`). Each value edits in place as a draft
 * and commits once; removing a colour the page still uses is refused by the
 * door, which names where it is used.
 */
export function PaletteList({ palette, commit, labels, disabled = false, onResult }: PaletteListProps) {
  const base = useId();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const send = (result: SiteCommitResult): SiteCommitResult => {
    onResult?.(result);
    return result;
  };
  const canAdd = name.trim() !== '' && isPaletteColorValue(value.trim());

  return (
    <section className="bldr-palette" aria-label={labels.palette}>
      <h3 className="bldr-design-system__group">{labels.palette}</h3>
      {palette.length === 0 ? (
        <p className="bldr-palette__empty">{labels.paletteEmpty}</p>
      ) : (
        <ul className="bldr-palette__list">
          {palette.map((color) => {
            const id = `${base}-${color.id}`;
            return (
              <li key={color.id} className="bldr-palette__row">
                <span className="bldr-palette__swatch" style={{ background: color.value }} aria-hidden />
                <label className="bldr-palette__name" htmlFor={id}>
                  {color.name}
                  <span className="bldr-visually-hidden">{` ${labels.valueOf(color.name)}`}</span>
                </label>
                <TokenDraftField
                  id={id}
                  className="bldr-palette__value"
                  value={color.value}
                  disabled={disabled}
                  onCommit={(next) => {
                    send(
                      commit(
                        [{ command: 'setPaletteColor', args: { color: { ...color, value: next } } }],
                        labels.commitColour(color.name),
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  className="bldr-palette__remove"
                  aria-label={labels.remove(color.name)}
                  disabled={disabled}
                  onClick={() => {
                    send(
                      commit(
                        [{ command: 'removePaletteColor', args: { id: color.id } }],
                        labels.commitRemoveColour(color.name),
                      ),
                    );
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="bldr-palette__add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canAdd) return;
          const taken = new Set(palette.map((color) => color.id));
          const entry: PaletteColor = {
            id: freshId(name, taken),
            name: name.trim().slice(0, 80),
            value: value.trim(),
          };
          const result = send(
            commit([{ command: 'setPaletteColor', args: { color: entry } }], labels.commitColour(entry.name)),
          );
          if (result.ok) {
            setName('');
            setValue('');
          }
        }}
      >
        <input
          className="bldr-palette__input"
          aria-label={labels.colourName}
          placeholder={labels.colourName}
          value={name}
          disabled={disabled}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <input
          className="bldr-palette__input bldr-palette__input--mono"
          aria-label={labels.colourValue}
          placeholder="#0f766e"
          dir="ltr"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
        <button type="submit" className="bldr-palette__submit" disabled={disabled || !canAdd}>
          {labels.addColour}
        </button>
      </form>
    </section>
  );
}

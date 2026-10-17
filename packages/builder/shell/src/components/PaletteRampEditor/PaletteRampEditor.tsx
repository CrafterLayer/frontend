import { useId, useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { formatHex, parse } from 'culori';

import type { SiteCommit } from '../DesignSystemPanel/site-door';
import {
  PALETTE_RAMP_EDITOR_LABELS_EN,
  type PaletteRampEditorLabels,
} from './PaletteRampEditor.labels';
import {
  contrastGrade,
  contrastMatrix,
  generateRamp,
  rampPaletteColors,
  type ContrastColumn,
} from './ramp';
import '../../styles/visually-hidden.css';
import './PaletteRampEditor.css';

export interface PaletteRampEditorProps {
  /** Sends the 11 `setPaletteColor` steps as ONE labelled transaction. */
  readonly commit: SiteCommit;
  /** Palette ids already in the library: an overlap is announced before it is replaced. */
  readonly existingIds?: readonly string[] | undefined;
  /** Extra backgrounds for the contrast matrix (the site's surface, its text colour…). */
  readonly contrastColumns?: readonly ContrastColumn[] | undefined;
  readonly defaultName?: string | undefined;
  readonly defaultColor?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: PaletteRampEditorLabels | undefined;
  /** The editor UI's direction; the swatch row and the table follow it. */
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

type Status = { readonly kind: 'idle' } | { readonly kind: 'done' | 'refused'; readonly text: string };

/**
 * One brand colour in, eleven OKLCH shades out (style-manager DESIGN.md §G).
 *
 * Typing and dragging only PREVIEW: nothing reaches the document until "Add
 * shades to palette", which writes all eleven entries as one transaction —
 * one Undo takes the whole ramp back. The contrast matrix shows, for every
 * shade, what text in that colour measures on white, on black and on the
 * site's own surfaces, graded against WCAG, so a person picks a text shade
 * that will read before they use it.
 */
export function PaletteRampEditor({
  commit,
  existingIds = [],
  contrastColumns = [],
  defaultName,
  defaultColor = '#0f766e',
  disabled = false,
  labels = PALETTE_RAMP_EDITOR_LABELS_EN,
  dir,
}: PaletteRampEditorProps) {
  // The name opens in the editor's language ("Brand" read as English in the Arabic chrome).
  const [name, setName] = useState(defaultName ?? labels.defaultName);
  const [color, setColor] = useState(defaultColor);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const nameId = useId();
  const colorId = useId();
  const errorId = useId();

  const shades = useMemo(() => generateRamp(color), [color]);
  const entries = useMemo(
    () => (shades === undefined ? [] : rampPaletteColors(name, shades)),
    [name, shades],
  );
  const columns = useMemo<readonly ContrastColumn[]>(
    () => [
      { name: labels.white, css: '#ffffff' },
      { name: labels.black, css: '#000000' },
      ...contrastColumns,
    ],
    [contrastColumns, labels.black, labels.white],
  );
  const matrix = useMemo(
    () => (shades === undefined ? [] : contrastMatrix(shades, columns)),
    [shades, columns],
  );
  const pickerHex = useMemo(() => {
    const parsed = parse(color.trim());
    return parsed === undefined ? '#000000' : formatHex(parsed);
  }, [color]);

  const overlap = entries.filter((entry) => existingIds.includes(entry.id)).length;
  const first = entries[0]?.id ?? '';
  const last = entries[entries.length - 1]?.id ?? '';

  const add = (): void => {
    if (entries.length === 0) return;
    const result = commit(
      entries.map((entry) => ({ command: 'setPaletteColor', args: { color: entry } })),
      labels.commitLabel(name.trim() === '' ? first : name.trim()),
    );
    setStatus(
      result.ok
        ? { kind: 'done', text: labels.added(entries.length) }
        : { kind: 'refused', text: result.message },
    );
  };

  return (
    <section className="bldr-ramp" aria-label={labels.title} dir={dir}>
      <h4 className="bldr-ramp__title">{labels.title}</h4>
      <div className="bldr-ramp__inputs">
        <label className="bldr-ramp__field" htmlFor={nameId}>
          <span className="bldr-ramp__label">{labels.name}</span>
          <input
            id={nameId}
            className="bldr-ramp__input"
            value={name}
            disabled={disabled}
            onChange={(event) => {
              setName(event.target.value);
              setStatus({ kind: 'idle' });
            }}
          />
        </label>
        <label className="bldr-ramp__field" htmlFor={colorId}>
          <span className="bldr-ramp__label">{labels.color}</span>
          <input
            id={colorId}
            className="bldr-ramp__input bldr-ramp__input--mono"
            dir="ltr"
            value={color}
            disabled={disabled}
            aria-invalid={shades === undefined}
            aria-describedby={shades === undefined ? errorId : undefined}
            onChange={(event) => {
              setColor(event.target.value);
              setStatus({ kind: 'idle' });
            }}
          />
        </label>
      </div>
      <div className="bldr-ramp__picker" aria-label={labels.picker} role="group">
        <HexColorPicker
          color={pickerHex}
          onChange={(next) => {
            if (disabled) return;
            setColor(next);
            setStatus({ kind: 'idle' });
          }}
        />
      </div>
      {shades === undefined ? (
        <p id={errorId} className="bldr-ramp__error" role="alert">
          {labels.invalid}
        </p>
      ) : (
        <>
          <ol className="bldr-ramp__shades" aria-label={labels.shades}>
            {shades.map((shade) => (
              <li
                key={shade.step}
                className="bldr-ramp__shade"
                data-anchor={shade.anchor ? 'true' : undefined}
              >
                <span className="bldr-ramp__chip" style={{ background: shade.hex }} aria-hidden />
                <span className="bldr-ramp__step">{shade.step}</span>
                <span className="bldr-visually-hidden">
                  {shade.value}
                  {shade.anchor ? `, ${labels.brandStep}` : ''}
                </span>
              </li>
            ))}
          </ol>
          <table className="bldr-ramp__matrix">
            <caption className="bldr-ramp__caption">{labels.contrast}</caption>
            <thead>
              <tr>
                <th scope="col">{labels.step}</th>
                {columns.map((column) => (
                  <th scope="col" key={column.name}>
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shades.map((shade, row) => (
                <tr key={shade.step}>
                  <th scope="row">
                    <span
                      className="bldr-ramp__dot"
                      style={{ background: shade.hex }}
                      aria-hidden
                    />
                    {shade.step}
                  </th>
                  {columns.map((column, at) => {
                    const ratio = matrix[row]?.[at];
                    const grade = ratio === undefined ? undefined : contrastGrade(ratio);
                    return (
                      <td key={column.name} data-grade={grade}>
                        {ratio === undefined
                          ? '—'
                          : `${ratio.toFixed(1)} ${grade === 'fail' ? labels.fail : (grade ?? '')}`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="bldr-ramp__hint">
        {entries.length === 0 ? '' : labels.addHint(first, last, entries.length)}
        {overlap > 0 ? ` · ${labels.replaces(overlap)}` : ''}
      </p>
      <button
        type="button"
        className="bldr-ramp__add"
        disabled={disabled || entries.length === 0}
        onClick={add}
      >
        {labels.add}
      </button>
      <p
        className="bldr-ramp__status"
        role="status"
        data-kind={status.kind === 'idle' ? undefined : status.kind}
      >
        {status.kind === 'idle' ? '' : status.text}
      </p>
    </section>
  );
}

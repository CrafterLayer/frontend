import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import type { StyleMode, StyleValue } from '@craftkit/builder-schema';

import { useScrub } from '../../use-scrub';
import {
  SCALE_NUMBER_CONTROL_LABELS_EN,
  type ScaleNumberControlLabels,
} from './ScaleNumberControl.labels';
import {
  amountOfValue,
  displayText,
  nearestToken,
  parseAmount,
  stepScale,
  tidy,
  valueForAmount,
  type ScaleModel,
} from './scale-math';
import { scrubAmount } from './scrub-amount';

import './ScaleNumberControl.css';

export interface ScaleNumberControlProps {
  /** The accessible name: "Padding inline-start", "Font size". */
  readonly label: string;
  readonly value: StyleValue | undefined;
  readonly model: ScaleModel;
  /** Units a typed value may carry (free mode). The first is the default. */
  readonly units?: readonly string[] | undefined;
  /** Non-numeric scale entries offered in the unit menu: `auto`, `full`, `fit`. */
  readonly keywords?: readonly string[] | undefined;
  /** `tokens` keeps every write on the scale (registered blocks). */
  readonly mode?: StyleMode | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  /** One write per call; `null` resets (removes the class). */
  readonly onCommit: (value: StyleValue | null) => void;
  readonly mixed?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
  readonly labels?: ScaleNumberControlLabels | undefined;
  /**
   * Draws the scrub grip at the field's inline start: dragging it previews
   * through `onPreview` and commits ONCE on release (one Undo per gesture).
   */
  readonly scrub?: boolean | undefined;
  /** Canvas-only preview while scrubbing; `null` ends it. Never a document write. */
  readonly onPreview?: ((value: StyleValue | null) => void) | undefined;
}

const KEYWORD_PREFIX = 'keyword:';

/** The unit the scale's numeric steps read in (`px` for spacing), when no unit menu says. */
function scaleUnit(model: ScaleModel): string {
  for (const token of model.scale) {
    const amount = model.amountOf(token);
    if (amount !== undefined) return amount.unit;
  }
  return '';
}

/**
 * A number on a design scale (style-manager DESIGN.md §A.4 "number + scale").
 *
 * A spinbutton: ArrowUp/ArrowDown ±1, Shift ±10, Alt ±0.1, PageUp/PageDown to
 * the next scale step. A result that lands exactly on a step is written as
 * that token (`p-4`), anything else as an exact arbitrary value (`p-[17px]`).
 * Typing commits on Enter or blur, so a half-typed number never reaches the
 * document. In tokens mode every write snaps to the nearest step.
 */
export function ScaleNumberControl({
  label,
  value,
  model,
  units = [],
  keywords = [],
  mode = 'free',
  min,
  max,
  onCommit,
  mixed = false,
  disabled = false,
  id,
  labels = SCALE_NUMBER_CONTROL_LABELS_EN,
  scrub = false,
  onPreview,
}: ScaleNumberControlProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState<StyleValue | null>(null);
  const current = amountOfValue(model, value);
  const [pickedUnit, setPickedUnit] = useState<string | undefined>(undefined);
  const unit = current?.unit ?? pickedUnit ?? units[0] ?? scaleUnit(model);
  const shown =
    scrubbing !== null
      ? displayText(model, scrubbing)
      : mixed && draft === null
        ? ''
        : (draft ?? displayText(model, value));

  const clamp = (amount: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, amount));

  const commitAmount = (amount: number, inUnit: string) => {
    const exact = { amount: tidy(clamp(amount)), unit: inUnit };
    if (mode === 'tokens') {
      const token = model.tokenFor(exact) ?? nearestToken(model, exact);
      if (token !== undefined) onCommit({ kind: 'token', token });
      return;
    }
    onCommit(valueForAmount(model, exact));
  };

  const landing = (dx: number, dy: number) =>
    scrubAmount(model, mixed ? undefined : value, mode, dx - dy, { min, max });

  const scrubber = useScrub({
    onPreview: (delta) => {
      const next = landing(delta.dx, delta.dy);
      setScrubbing(next ?? null);
      onPreview?.(next ?? null);
    },
    onCommit: (delta) => {
      setScrubbing(null);
      onPreview?.(null);
      const next = landing(delta.dx, delta.dy);
      if (next !== undefined) onCommit(next);
    },
    onCancel: () => {
      setScrubbing(null);
      onPreview?.(null);
    },
  });

  const commitText = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '') {
      if (value !== undefined) onCommit(null);
      return;
    }
    /*
      A typed NAME on the scale (`auto`, `section-lg`, `lg`) is that token. A
      typed NUMBER is an amount in the unit the field shows: on the spacing
      scale "40" means 40px (`ps-10`), never step 40 (160px). Numeric steps
      still come out as tokens, through tokenFor.
    */
    if (model.scale.includes(trimmed) && model.amountOf(trimmed) === undefined) {
      onCommit({ kind: 'token', token: trimmed });
      return;
    }
    const parsed = parseAmount(trimmed, unit);
    if (parsed === undefined) return;
    if (mode === 'free' && units.length > 0 && parsed.unit !== '' && !units.includes(parsed.unit)) {
      return;
    }
    commitAmount(parsed.amount, parsed.unit);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (draft !== null) commitText(draft);
      setDraft(null);
      return;
    }
    if (event.key === 'Escape') {
      setDraft(null);
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const next = stepScale(model, value, event.key === 'PageUp' ? 1 : -1);
      setDraft(null);
      if (next !== undefined) onCommit(next);
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    setDraft(null);
    const direction = event.key === 'ArrowUp' ? 1 : -1;
    if (current === undefined) {
      // A name on the scale (`lg`) or nothing yet: arrows walk the scale.
      const next = stepScale(model, value, direction);
      if (next !== undefined) onCommit(next);
      return;
    }
    if (mode === 'tokens') {
      const next = stepScale(model, value, direction);
      if (next !== undefined) onCommit(next);
      return;
    }
    const delta = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
    commitAmount(current.amount + direction * delta, current.unit);
  };

  const menuValue =
    value?.kind === 'token' && keywords.includes(value.token)
      ? `${KEYWORD_PREFIX}${value.token}`
      : unit;
  const showMenu = (mode === 'free' && units.length > 0) || keywords.length > 0;

  return (
    <div
      className="bldr-scale-number"
      data-mixed={mixed ? '' : undefined}
      data-scrubbing={scrubbing === null ? undefined : ''}
    >
      {scrub && !disabled ? (
        <span
          className="bldr-scale-number__scrub"
          aria-hidden="true"
          onPointerDown={scrubber.onPointerDown}
          onPointerMove={scrubber.onPointerMove}
          onPointerUp={scrubber.onPointerUp}
          onPointerCancel={scrubber.onPointerCancel}
        >
          <svg viewBox="0 0 16 16" focusable="false">
            <path d="M5.5 5 2.5 8l3 3" />
            <path d="M10.5 5l3 3-3 3" />
            <path d="M8 4.5v7" />
          </svg>
        </span>
      ) : null}
      <input
        id={id}
        className="bldr-scale-number__input"
        type="text"
        role="spinbutton"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        aria-valuenow={current === undefined ? undefined : tidy(current.amount)}
        aria-valuetext={
          mixed
            ? labels.mixed
            : value === undefined
              ? labels.unset
              : current === undefined
                ? shown
                : shown + current.unit
        }
        aria-valuemin={min}
        aria-valuemax={max}
        placeholder={mixed ? labels.mixed : labels.placeholder}
        value={shown}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft !== null) commitText(draft);
          setDraft(null);
        }}
        onKeyDown={onKeyDown}
      />
      {showMenu ? (
        <select
          className="bldr-scale-number__unit"
          aria-label={labels.unit(label)}
          value={menuValue}
          disabled={disabled}
          onChange={(event) => {
            const picked = event.target.value;
            if (picked.startsWith(KEYWORD_PREFIX)) {
              onCommit({ kind: 'token', token: picked.slice(KEYWORD_PREFIX.length) });
              return;
            }
            setPickedUnit(picked);
            if (current !== undefined && current.unit !== picked) commitAmount(current.amount, picked);
          }}
        >
          {mode === 'free'
            ? units.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))
            : null}
          {/* The current unit, unless the value IS one of the keywords below:
              comparing the prefixed menu value with the bare keywords listed
              "keyword:4xl" as an option of its own (walk 2026-10-08). */}
          {mode === 'tokens' && !menuValue.startsWith(KEYWORD_PREFIX) ? (
            <option value={menuValue}>{menuValue === '' ? '—' : menuValue}</option>
          ) : null}
          {keywords.map((keyword) => (
            <option key={keyword} value={`${KEYWORD_PREFIX}${keyword}`}>
              {keyword}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

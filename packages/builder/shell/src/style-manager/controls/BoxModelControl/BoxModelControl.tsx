import type { ReactNode } from 'react';

import type { StyleBoxSide, StyleMode, StyleSide, StyleValue } from '@craftkit/builder-schema';

import { BOX_SIDES } from '../../box-sides';
import { BoxSideButton } from '../BoxSideButton';
import type { ScaleNumberControlLabels } from '../ScaleNumberControl';
import { amountOfValue, formatAmount, type ScaleModel } from '../ScaleNumberControl';
import type { ValueOrigin } from '../ValueSourceDot';
import { BOX_MODEL_CONTROL_LABELS_EN, type BoxModelControlLabels } from './BoxModelControl.labels';

import './BoxModelControl.css';

export interface BoxSideState {
  readonly value: StyleValue | undefined;
  readonly origin: ValueOrigin;
  /** Several targets disagree on this side. */
  readonly mixed?: boolean | undefined;
}

export interface BoxRing {
  /** `margin`, `padding`, `inset`, `borderWidth`. */
  readonly id: string;
  /** "Padding". */
  readonly label: string;
  readonly sides: Readonly<Record<StyleBoxSide, BoxSideState>>;
  readonly model: ScaleModel;
  readonly units?: readonly string[] | undefined;
  readonly keywords?: readonly string[] | undefined;
  /** 0 by default; margins and insets pass a negative floor. */
  readonly min?: number | undefined;
}

export interface BoxModelControlProps {
  /** Outermost first: margin, then padding. */
  readonly rings: readonly BoxRing[];
  /** The PAGE direction. Inline-start is drawn on the right of an RTL page. */
  readonly dir: 'ltr' | 'rtl';
  readonly mode?: StyleMode | undefined;
  readonly onCommit: (ring: string, side: StyleSide, value: StyleValue | null) => void;
  readonly onPreview?: ((ring: string, side: StyleSide, value: StyleValue | null) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: BoxModelControlLabels | undefined;
  readonly fieldLabels?: ScaleNumberControlLabels | undefined;
}

function displayOf(model: ScaleModel, state: BoxSideState): string {
  if (state.mixed === true) return '~';
  const amount = amountOfValue(model, state.value);
  if (amount !== undefined) return String(Math.round(amount.amount * 100) / 100);
  if (state.value === undefined) return '–';
  switch (state.value.kind) {
    case 'token':
      return state.value.token;
    case 'keyword':
      return state.value.keyword;
    case 'raw':
      return state.value.css;
    case 'palette':
      return state.value.id;
  }
}

function spokenOf(model: ScaleModel, state: BoxSideState, unset: string): string {
  const amount = amountOfValue(model, state.value);
  if (amount !== undefined) return formatAmount(amount);
  return state.value === undefined ? unset : displayOf(model, state);
}

/**
 * The visual box model (style-manager DESIGN.md §A.4 Spacing): margin and
 * padding as nested rings, each side a button that scrubs and opens an exact
 * editor. Sides are LOGICAL and drawn where the page puts them — the ring is
 * laid out in the page's own direction, so inline-start is on the right of an
 * Arabic page. Shift edits all four sides, Alt the opposite pair.
 */
export function BoxModelControl({
  rings,
  dir,
  mode = 'free',
  onCommit,
  onPreview,
  disabled = false,
  labels = BOX_MODEL_CONTROL_LABELS_EN,
  fieldLabels,
}: BoxModelControlProps) {
  let inner: ReactNode = (
    <div className="bldr-box-model__content" aria-hidden="true">
      {labels.content}
    </div>
  );
  for (const ring of [...rings].reverse()) {
    const content = inner;
    inner = (
      <div
        className="bldr-box-model__ring"
        data-ring={ring.id}
        role="group"
        aria-label={ring.label}
      >
        <span className="bldr-box-model__ring-label" aria-hidden="true">
          {ring.label}
        </span>
        {BOX_SIDES.map((side) => {
          const state = ring.sides[side];
          const sideName = labels.sides[side];
          return (
            <div
              key={side}
              className="bldr-box-model__slot"
              data-side={side}
              data-origin={state.origin}
            >
              <BoxSideButton
                side={side}
                accessibleName={labels.side(ring.label, sideName, spokenOf(ring.model, state, labels.unset))}
                display={displayOf(ring.model, state)}
                fieldLabel={`${ring.label} ${sideName}`}
                value={state.mixed === true ? undefined : state.value}
                model={ring.model}
                units={ring.units}
                keywords={ring.keywords}
                mode={mode}
                min={ring.min}
                dir={dir}
                disabled={disabled}
                fieldLabels={fieldLabels}
                onCommit={(group, value) => {
                  onCommit(ring.id, group, value);
                }}
                onPreview={
                  onPreview === undefined
                    ? undefined
                    : (group, value) => {
                        onPreview(ring.id, group, value);
                      }
                }
              />
            </div>
          );
        })}
        <div className="bldr-box-model__inner">{content}</div>
      </div>
    );
  }
  return (
    <div className="bldr-box-model" dir={dir} role="group" aria-label={labels.group}>
      {inner}
    </div>
  );
}

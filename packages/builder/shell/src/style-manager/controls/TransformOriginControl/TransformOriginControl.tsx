import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

import { focusRadioAt } from '../../roving';
import { ORIGIN_POINTS, originKeyword, pointOfKeyword } from './origin-points';
import {
  TRANSFORM_ORIGIN_CONTROL_LABELS_EN,
  type TransformOriginControlLabels,
} from './TransformOriginControl.labels';

import './TransformOriginControl.css';

export interface TransformOriginControlProps {
  /** The stored keyword (`top-left`, `center`…), as the catalogue writes it. */
  readonly value: string | undefined;
  /** The PAGE direction: decides which physical side inline-start is. */
  readonly dir: 'ltr' | 'rtl';
  readonly onCommit: (keyword: string) => void;
  readonly disabled?: boolean | undefined;
  readonly labels?: TransformOriginControlLabels | undefined;
}

/**
 * The transform origin as a 3 × 3 picker of LOGICAL points (style-manager
 * DESIGN.md §A.4 Transforms). The grid is laid out in the page's direction,
 * so the inline-start column is on the right of an RTL page, and the point
 * is written as the physical keyword it means on that page.
 */
export function TransformOriginControl({
  value,
  dir,
  onCommit,
  disabled = false,
  labels = TRANSFORM_ORIGIN_CONTROL_LABELS_EN,
}: TransformOriginControlProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const checked = value === undefined ? undefined : pointOfKeyword(value, dir);
  const checkedIndex = checked === undefined ? -1 : ORIGIN_POINTS.indexOf(checked);
  const tabStop = checkedIndex === -1 ? 4 : checkedIndex;

  const choose = (index: number) => {
    const point = ORIGIN_POINTS[index];
    if (point === undefined || disabled) return;
    const keyword = originKeyword(point, dir);
    if (keyword !== value) onCommit(keyword);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const row = Math.floor(index / 3);
    const column = index % 3;
    let next: number | undefined;
    if (event.key === forward && column < 2) next = index + 1;
    if (event.key === backward && column > 0) next = index - 1;
    if (event.key === 'ArrowDown' && row < 2) next = index + 3;
    if (event.key === 'ArrowUp' && row > 0) next = index - 3;
    if (next === undefined) return;
    event.preventDefault();
    choose(next);
    focusRadioAt(gridRef.current, next);
  };

  return (
    <div
      ref={gridRef}
      className="bldr-transform-origin"
      role="radiogroup"
      aria-label={labels.group}
      dir={dir}
    >
      {ORIGIN_POINTS.map((point, index) => (
        <button
          key={`${point.block}-${point.inline}`}
          type="button"
          role="radio"
          className="bldr-transform-origin__point"
          aria-checked={index === checkedIndex}
          aria-label={labels.point(point)}
          title={labels.point(point)}
          tabIndex={index === tabStop ? 0 : -1}
          disabled={disabled}
          onClick={() => {
            choose(index);
          }}
          onKeyDown={(event) => {
            onKeyDown(event, index);
          }}
        >
          <span aria-hidden="true" className="bldr-transform-origin__dot" />
        </button>
      ))}
    </div>
  );
}

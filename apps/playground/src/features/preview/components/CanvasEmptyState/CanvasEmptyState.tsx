import { useId } from 'react';

import { ChromeButton } from '@craftkit/builder';

import {
  CANVAS_EMPTY_STATE_LABELS_EN,
  type CanvasEmptyStateLabels,
} from './CanvasEmptyState.labels';
import './CanvasEmptyState.css';

export interface CanvasEmptyStateProps {
  /** Opens the library on its blocks. */
  readonly onAddBlock: () => void;
  /** Opens the library on its page templates. */
  readonly onUseTemplate: () => void;
  readonly labels?: CanvasEmptyStateLabels | undefined;
  /** The EDITOR's direction (the page keeps its own inside the frame). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

const ICON = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
} as const;

/**
 * What an empty page says (UX pass, 2026-10-13). A blank canvas used to be a white
 * rectangle with nothing on it: no sign of where blocks come from or that templates
 * exist. This card floats over the canvas while the page has no blocks and names the two
 * ways in. Only its buttons take the pointer, so a block dragged from the library still
 * drops onto the page through the card.
 */
export function CanvasEmptyState({
  onAddBlock,
  onUseTemplate,
  labels = CANVAS_EMPTY_STATE_LABELS_EN,
  dir = 'ltr',
}: CanvasEmptyStateProps) {
  const titleId = useId();
  return (
    <section className="pg-canvas-empty" aria-labelledby={titleId} dir={dir}>
      <div className="pg-canvas-empty__card">
        <span className="pg-canvas-empty__icon" aria-hidden="true">
          <svg {...ICON}>
            <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2" />
            <path d="M8 5.25v5.5M5.25 8h5.5" />
          </svg>
        </span>
        <h2 id={titleId} className="pg-canvas-empty__title">
          {labels.title}
        </h2>
        <p className="pg-canvas-empty__body">{labels.body}</p>
        <div className="pg-canvas-empty__actions">
          <ChromeButton variant="primary" size="lg" onClick={onAddBlock}>
            <svg {...ICON}>
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
            {labels.addBlock}
          </ChromeButton>
          <ChromeButton
            className="pg-canvas-empty__secondary"
            variant="quiet"
            size="lg"
            onClick={onUseTemplate}
          >
            {labels.useTemplate}
          </ChromeButton>
        </div>
        <p className="pg-canvas-empty__tip">{labels.tip}</p>
      </div>
    </section>
  );
}

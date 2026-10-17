import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import {
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  widthAfterDrag,
  widthAfterKey,
} from './panel-width';

export interface PanelSeparatorProps {
  readonly locale: Locale;
  /** The panel's width now, in px: `aria-valuenow`. */
  readonly width: number;
  /** A new width, already clamped to 288 to 480. */
  readonly onWidthChange: (width: number) => void;
}

/** The editor's direction around the panel: the separator inherits it, not the panel's. */
function hostIsRtl(element: Element): boolean {
  return getComputedStyle(element).direction === 'rtl';
}

/**
 * The panel's resize separator (SPEC §4.1): an 8px hit area on the panel's edge toward the
 * canvas, a 2px Rule line on hover or focus, `role="separator"` with its value in px.
 * ← → move it 16px, Shift 48px, Home and End to the ends, all in visual direction; a drag
 * follows the pointer. It lives outside the panel's `dir`, so it reads the editor's.
 */
export function PanelSeparator({ locale, width, onWidthChange }: PanelSeparatorProps) {
  const drag = useRef<{ readonly x: number; readonly width: number; readonly rtl: boolean } | null>(
    null,
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = widthAfterKey(width, event.key, event.shiftKey, hostIsRtl(event.currentTarget));
    if (next === null) return;
    event.preventDefault();
    if (next !== width) onWidthChange(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = { x: event.clientX, width, rtl: hostIsRtl(event.currentTarget) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === null) return;
    const next = widthAfterDrag(start.width, event.clientX - start.x, start.rtl);
    if (next !== width) onWidthChange(next);
  };

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div
      className="ck-agent-panel__resize"
      role="separator"
      tabIndex={0}
      lang={locale}
      aria-label={t(locale, 'panel.resize')}
      aria-orientation="vertical"
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={PANEL_WIDTH_MAX}
      aria-valuenow={width}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onLostPointerCapture={endDrag}
    />
  );
}

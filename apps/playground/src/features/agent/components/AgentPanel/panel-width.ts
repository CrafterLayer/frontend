/**
 * The panel's width and its resize separator's keys (SPEC §4.1, §6.7, §2.7).
 *
 * 288 to 480px, 320 by default (`--bldr-assistant-width`, `-min`, `-max`). ← and → move
 * the separator 16px, Shift+← / Shift+→ 48px, Home and End jump to the ends. The arrows
 * move it in VISUAL direction: the separator sits on the panel's edge toward the canvas,
 * which is the right edge in a left-to-right editor and the left edge in a right-to-left
 * one, so → widens the panel in the first and narrows it in the second. What decides is
 * the editor's direction around the panel, never the panel's own language: an Arabic panel
 * docked in an English editor still has its outer edge on the right.
 */

export const PANEL_WIDTH_MIN = 288;
export const PANEL_WIDTH_MAX = 480;
export const PANEL_WIDTH_DEFAULT = 320;
export const PANEL_WIDTH_STEP = 16;
export const PANEL_WIDTH_STEP_LARGE = 48;

/** A width the panel can take: finite, whole pixels, inside 288 to 480. */
export function clampPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return PANEL_WIDTH_DEFAULT;
  return Math.round(Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, width)));
}

/**
 * The width after a key on the separator, or `null` for a key it does not take.
 * `hostRtl` is the editor's direction around the panel (see the module note).
 */
export function widthAfterKey(
  width: number,
  key: string,
  shift: boolean,
  hostRtl: boolean,
): number | null {
  if (key === 'Home') return PANEL_WIDTH_MIN;
  if (key === 'End') return PANEL_WIDTH_MAX;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  const step = shift ? PANEL_WIDTH_STEP_LARGE : PANEL_WIDTH_STEP;
  const rightward = key === 'ArrowRight' ? 1 : -1;
  const outward = hostRtl ? -rightward : rightward;
  return clampPanelWidth(width + outward * step);
}

/** The width after a drag of `dx` pixels (pointer movement, rightward positive). */
export function widthAfterDrag(start: number, dx: number, hostRtl: boolean): number {
  return clampPanelWidth(start + (hostRtl ? -dx : dx));
}

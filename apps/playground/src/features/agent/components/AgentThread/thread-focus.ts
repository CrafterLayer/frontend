/**
 * Where focus is in the thread, and where it goes on "Jump to latest" (SPEC §4.4, §6.3).
 * Plain DOM reads, called from AgentThread's event handlers, never during render.
 */

/**
 * The band at the bottom of the thread the jump pill can cover: 12px above the dock plus
 * the tallest the pill gets, 44px on a coarse pointer. A focused element that reaches into
 * it hides the pill, so the pill never covers focus (WCAG 2.4.11), whichever turn the
 * element is in. The band spans the thread's full width: it errs toward hiding.
 */
export const PILL_BAND_PX = 12 + 44;

/** The turn an element sits in, by its `<li data-turn-id>`; `null` outside any turn. */
export function turnIdOf(element: Element): string | null {
  return element.closest<HTMLElement>('[data-turn-id]')?.dataset['turnId'] ?? null;
}

/**
 * Whether `element` reaches into the band the pill floats over. The thread itself is
 * never "under" it: its ring runs round the whole thread, and the pill covers a sliver of
 * one edge at most. An element with no box (not laid out) is not under anything.
 */
export function isUnderPill(scroller: HTMLElement | null, element: Element): boolean {
  if (scroller === null || element === scroller) return false;
  const box = element.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return false;
  const view = scroller.getBoundingClientRect();
  return box.bottom > view.bottom - PILL_BAND_PX && box.top < view.bottom;
}

/**
 * "Jump to latest" lands on the newest record's head (SPEC §6.3): the `h3[tabindex="-1"]`
 * of the last turn that has one, since a person's own message has no head. Focus moves
 * without scrolling: the thread is already on its way to the bottom, and letting focus
 * scroll the head into view would pull the reader back up and release the follow. With
 * no record at all, the thread itself takes focus: a named destination, never `body`.
 */
export function focusNewestHead(scroller: HTMLElement | null): void {
  if (scroller === null) return;
  const turns = scroller.querySelectorAll<HTMLElement>('[data-turn-id]');
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const head = turns.item(index).querySelector<HTMLElement>('h3[tabindex="-1"]');
    if (head !== null) {
      head.focus({ preventScroll: true });
      return;
    }
  }
  scroller.focus({ preventScroll: true });
}

/**
 * Arrow-key movement through a one-dimensional radio group or toolbar.
 *
 * Inline arrows follow the direction the group is laid out in: in an RTL
 * group ArrowLeft moves FORWARD, because forward is leftwards there. Block
 * arrows always move forward on ArrowDown. Home/End jump to the ends. Returns
 * the next index, or undefined when the key is not a movement key.
 */
export function rovingIndex(
  key: string,
  index: number,
  count: number,
  dir: 'ltr' | 'rtl',
): number | undefined {
  if (count <= 0) return undefined;
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  switch (key) {
    case forward:
    case 'ArrowDown':
      return (index + 1) % count;
    case backward:
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
}

/** Focus the radio at `index` inside the group element (the roving tab stop moves with it). */
export function focusRadioAt(group: HTMLElement | null, index: number): void {
  const items = group?.querySelectorAll<HTMLElement>('[role="radio"]');
  items?.[index]?.focus();
}

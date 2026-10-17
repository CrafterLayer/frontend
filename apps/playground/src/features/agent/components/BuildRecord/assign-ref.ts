import type { Ref } from 'react';

/**
 * Hands `node` to a caller's ref, whichever kind it is. A record keeps its own handle on its
 * heading (to send focus there after Retry, Finish the rest, Undo build, SPEC §6.3) and still
 * gives the same heading to a caller that sends focus there too (Build this page); its own
 * ref callback calls this with the caller's ref.
 */
export function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref !== null && ref !== undefined) ref.current = node;
}

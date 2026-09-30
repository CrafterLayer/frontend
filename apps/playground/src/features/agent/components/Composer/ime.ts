/**
 * Whether a key press belongs to an input method's composition (SPEC §4.17: Enter "is
 * ignored while `isComposing`").
 *
 * Arabic, Chinese, Japanese and Korean keyboards compose a word before committing it, and
 * the Enter that commits it is not a request to send. `isComposing` says so in Chromium
 * and Firefox. Safari fires the committing keydown just after `compositionend`, with
 * `isComposing` already false and the legacy key code 229 ("the IME is processing"), so
 * that code is checked too. It is read through a local shape because the property is
 * deprecated everywhere else, and this is the one place it still means something.
 */
import type { KeyboardEvent } from 'react';

/** The legacy key code every browser gives a key press that an input method is handling. */
const IME_PROCESSING = 229;

export function isImeComposing(event: KeyboardEvent): boolean {
  const native: { readonly isComposing: boolean; readonly keyCode?: number } = event.nativeEvent;
  return native.isComposing || native.keyCode === IME_PROCESSING;
}

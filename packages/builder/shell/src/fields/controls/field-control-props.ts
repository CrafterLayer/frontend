import type { FieldProps } from '@craftkit/builder-schema';

/**
 * What the inspector hands every field control. Extends the B0 `FieldProps`
 * contract additively: contributed components typed against plain `FieldProps`
 * receive (and ignore) the extras via JSX spread; the in-repo defaults use them
 * for native label/description wiring.
 */
export interface FieldControlProps extends FieldProps {
  /** id for the control's focusable element — the row's `<label htmlFor>` target. */
  controlId?: string | undefined;
  /** id of the row's rejection/description element, for `aria-describedby`. */
  describedBy?: string | undefined;
  /**
   * id of the row's property label. Input-like controls take their name from
   * `controlId` + that label; a control that renders a NON-labelable surface
   * (a contributed contenteditable, a composite widget) uses this to name
   * itself via `aria-labelledby` (008 §10 review fix H1).
   */
  labelledBy?: string | undefined;
  /** Placeholder shown when the value is inherited (override buckets, i1). */
  placeholder?: string | undefined;
}

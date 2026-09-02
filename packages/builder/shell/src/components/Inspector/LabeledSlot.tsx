import type { ReactNode } from 'react';

export interface LabeledSlotProps {
  readonly id?: string | undefined;
  readonly labelId: string;
  readonly describedBy?: string | undefined;
  readonly children: ReactNode;
}

/**
 * Structural labeling (H2): the slot is a NAMED GROUP, so a contributed
 * component always renders inside a context that carries the property key —
 * whatever it mounts. (A wrapping <label> would be wrong here: label text
 * names EVERY labelable descendant, so a contributed multi-button control
 * would have all its buttons named after the property instead of themselves.)
 * Input-like renderers take their own name from `controlId` + the visible
 * label; the group also carries the description chain for renderers that
 * ignore `describedBy`.
 */
export function LabeledSlot({ id, labelId, describedBy, children }: LabeledSlotProps) {
  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      className="bldr-inspector__control-slot"
    >
      {children}
    </div>
  );
}

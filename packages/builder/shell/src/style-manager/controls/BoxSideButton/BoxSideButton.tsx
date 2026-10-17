import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';

import type { StyleBoxSide, StyleMode, StyleSide, StyleValue } from '@craftkit/builder-schema';

import { useThemeScope } from '../../../fields/use-theme-scope';
import { sideForModifiers } from '../../box-sides';
import { useScrub, type ScrubModifiers } from '../../use-scrub';
import { ScaleNumberControl, type ScaleNumberControlLabels } from '../ScaleNumberControl';
import type { ScaleModel } from './scale-bridge';
import { scrubValue } from './scrub-value';

export interface BoxSideButtonProps {
  readonly side: StyleBoxSide;
  /** "Padding inline-start, 16px" — the whole sentence a screen reader hears. */
  readonly accessibleName: string;
  /** What the button shows: `16`, `auto`, `—`. */
  readonly display: string;
  /** The name of the number field in the popover: "Padding inline-start". */
  readonly fieldLabel: string;
  readonly value: StyleValue | undefined;
  readonly model: ScaleModel;
  readonly units?: readonly string[] | undefined;
  readonly keywords?: readonly string[] | undefined;
  readonly mode?: StyleMode | undefined;
  /** The smallest value a scrub reaches (0 for padding; margins may go negative). */
  readonly min?: number | undefined;
  /** The PAGE direction: inline-start sits on the right of an RTL page. */
  readonly dir: 'ltr' | 'rtl';
  readonly onCommit: (side: StyleSide, value: StyleValue | null) => void;
  /** Canvas-only preview while scrubbing; `null` ends it. */
  readonly onPreview?: ((side: StyleSide, value: StyleValue | null) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly fieldLabels?: ScaleNumberControlLabels | undefined;
}

/**
 * One side of a box-model ring: a button that scrubs and opens an exact
 * editor. Dragging previews and commits once on release; a press opens a
 * popover with the number field. Shift applies to all sides, Alt to the
 * opposite pair — at the moment of the drag or the press.
 */
export function BoxSideButton({
  side,
  accessibleName,
  display,
  fieldLabel,
  value,
  model,
  units,
  keywords,
  mode = 'free',
  min = 0,
  dir,
  onCommit,
  onPreview,
  disabled = false,
  fieldLabels,
}: BoxSideButtonProps) {
  const [editing, setEditing] = useState<StyleSide | null>(null);
  const [scrubbing, setScrubbing] = useState<string | null>(null);
  const { attach, scope } = useThemeScope();

  const landing = (delta: { dx: number; dy: number }) => {
    const next = scrubValue(model, value, side, delta, dir, min);
    if (mode === 'tokens' && next.kind !== 'token') return undefined;
    return next;
  };

  const scrub = useScrub({
    onPreview: (delta, modifiers: ScrubModifiers) => {
      const next = landing(delta);
      if (next === undefined) return;
      setScrubbing(next.kind === 'token' ? next.token : next.kind === 'raw' ? next.css : '');
      onPreview?.(sideForModifiers(side, modifiers), next);
    },
    onCommit: (delta, modifiers) => {
      setScrubbing(null);
      const group = sideForModifiers(side, modifiers);
      onPreview?.(group, null);
      const next = landing(delta);
      if (next !== undefined) onCommit(group, next);
    },
    onCancel: () => {
      setScrubbing(null);
      onPreview?.(side, null);
    },
  });

  return (
    <Popover.Root
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) setEditing(null);
      }}
    >
      <Popover.Trigger asChild>
        <button
          ref={attach}
          type="button"
          className="bldr-box-side"
          data-side={side}
          data-scrubbing={scrubbing === null ? undefined : ''}
          aria-label={accessibleName}
          disabled={disabled}
          {...(disabled
            ? {}
            : {
                onPointerDown: scrub.onPointerDown,
                onPointerMove: scrub.onPointerMove,
                onPointerUp: scrub.onPointerUp,
                onPointerCancel: scrub.onPointerCancel,
              })}
          onClick={(event) => {
            event.preventDefault();
            if (scrub.consumeDrag()) return;
            setEditing(sideForModifiers(side, { all: event.shiftKey, pair: event.altKey }));
          }}
        >
          {scrubbing ?? display}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={scope}>
        <Popover.Content
          className="bldr-box-side__popover"
          side="bottom"
          sideOffset={4}
          collisionPadding={8}
        >
          {editing === null ? null : (
            <ScaleNumberControl
              label={fieldLabel}
              value={value}
              model={model}
              units={units}
              keywords={keywords}
              mode={mode}
              min={min === 0 ? 0 : undefined}
              labels={fieldLabels}
              onCommit={(next) => {
                onCommit(editing, next);
              }}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

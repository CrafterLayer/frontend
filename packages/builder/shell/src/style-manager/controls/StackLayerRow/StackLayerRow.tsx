import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { STACK_CONTROL_LABELS_EN, type StackControlLabels } from '../StackControl/StackControl.labels';

export interface StackLayerRowProps {
  /** The sortable id: stable for this layer while the list is rendered. */
  readonly id: string;
  readonly index: number;
  readonly count: number;
  /** The layer's CSS: one shadow, one gradient, one transition. */
  readonly value: string;
  /** Commits an edited layer (Enter or blur). */
  readonly onChange: (value: string) => void;
  readonly onMove: (to: number) => void;
  readonly onRemove: () => void;
  readonly disabled?: boolean | undefined;
  readonly labels?: StackControlLabels | undefined;
}

/**
 * One layer of a stack: a drag handle (pointer and keyboard sortable), the
 * layer's CSS as text, explicit move buttons for anyone not dragging, and
 * remove. An edit commits on Enter or blur, never per keystroke.
 */
export function StackLayerRow({
  id,
  index,
  count,
  value,
  onChange,
  onMove,
  onRemove,
  disabled = false,
  labels = STACK_CONTROL_LABELS_EN,
}: StackLayerRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const commit = () => {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next !== '' && next !== value) onChange(next);
  };

  return (
    <li
      ref={setNodeRef}
      className="bldr-stack__layer"
      data-dragging={isDragging ? '' : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="bldr-stack__handle"
        aria-label={labels.reorder(index)}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01" />
        </svg>
      </button>
      <input
        className="bldr-stack__input"
        type="text"
        spellCheck={false}
        aria-label={labels.layer(index)}
        value={draft ?? value}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
      />
      <button
        type="button"
        className="bldr-stack__icon"
        aria-label={labels.moveEarlier(index)}
        disabled={disabled || index === 0}
        onClick={() => {
          onMove(index - 1);
        }}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        type="button"
        className="bldr-stack__icon"
        aria-label={labels.moveLater(index)}
        disabled={disabled || index === count - 1}
        onClick={() => {
          onMove(index + 1);
        }}
      >
        <span aria-hidden="true">↓</span>
      </button>
      <button
        type="button"
        className="bldr-stack__icon"
        aria-label={labels.remove(index)}
        disabled={disabled}
        onClick={onRemove}
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
}

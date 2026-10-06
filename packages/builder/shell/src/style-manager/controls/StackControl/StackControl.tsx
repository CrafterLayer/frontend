import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { StackLayerRow } from '../StackLayerRow';
import { moveItem } from './layers';
import { STACK_CONTROL_LABELS_EN, type StackControlLabels } from './StackControl.labels';

import './StackControl.css';

export interface StackPreset {
  readonly id: string;
  readonly label: string;
}

export interface StackControlProps {
  /** The property's name: "Shadow", "Gradient", "Transition". */
  readonly label: string;
  /** The layers, top first (CSS order). */
  readonly layers: readonly string[];
  /** The layer a new one starts as. */
  readonly newLayer: string;
  /** Named presets (token values such as `soft`); choosing one replaces the layers. */
  readonly presets?: readonly StackPreset[] | undefined;
  /** The preset in use, when the value is a token rather than layers. */
  readonly preset?: string | undefined;
  /** Free mode only: layers are arbitrary CSS, so tokens mode shows presets alone. */
  readonly editable?: boolean | undefined;
  /** The whole new list of layers; an empty list resets. */
  readonly onCommit: (layers: readonly string[]) => void;
  readonly onPreset: (preset: string | null) => void;
  readonly disabled?: boolean | undefined;
  readonly labels?: StackControlLabels | undefined;
}

/**
 * Layered values — shadows, gradients, transitions — as a sortable stack
 * (style-manager DESIGN.md §A.4). Drag a handle (pointer or keyboard:
 * Space, arrows, Space) or use the move buttons to reorder; each layer's CSS
 * is edited in place; presets replace the stack with a theme token. Every
 * action is one commit.
 */
export function StackControl({
  label,
  layers,
  newLayer,
  presets = [],
  preset,
  editable = true,
  onCommit,
  onPreset,
  disabled = false,
  labels = STACK_CONTROL_LABELS_EN,
}: StackControlProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = layers.map((layer, index) => `${String(index)}:${layer}`);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over === null || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) onCommit(moveItem(layers, from, to));
  };

  return (
    <div className="bldr-stack" role="group" aria-label={label}>
      {presets.length === 0 ? null : (
        <select
          className="bldr-stack__presets"
          aria-label={`${labels.presets}: ${label}`}
          value={preset ?? ''}
          disabled={disabled}
          onChange={(event) => {
            onPreset(event.target.value === '' ? null : event.target.value);
          }}
        >
          <option value="">{preset === undefined && layers.length > 0 ? '—' : labels.none}</option>
          {presets.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {editable ? (
        <>
          {layers.length === 0 ? <p className="bldr-stack__empty">{labels.empty}</p> : null}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="bldr-stack__layers">
                {layers.map((layer, index) => (
                  <StackLayerRow
                    key={ids[index]}
                    id={ids[index] ?? String(index)}
                    index={index}
                    count={layers.length}
                    value={layer}
                    disabled={disabled}
                    labels={labels}
                    onChange={(next) => {
                      onCommit(layers.map((existing, at) => (at === index ? next : existing)));
                    }}
                    onMove={(to) => {
                      onCommit(moveItem(layers, index, to));
                    }}
                    onRemove={() => {
                      onCommit(layers.filter((_, at) => at !== index));
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            className="bldr-stack__add"
            disabled={disabled}
            onClick={() => {
              onCommit([...layers, newLayer]);
            }}
          >
            {labels.add}
          </button>
        </>
      ) : null}
    </div>
  );
}

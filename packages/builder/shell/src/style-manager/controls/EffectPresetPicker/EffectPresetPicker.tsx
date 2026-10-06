import { CUSTOM_CODE_EFFECTS, type CustomCodeEffect } from '@craftkit/builder-schema';

import {
  EFFECT_PRESET_PICKER_LABELS_EN,
  type EffectPresetPickerLabels,
} from './EffectPresetPicker.labels';

import './EffectPresetPicker.css';

export interface EffectPresetPickerProps {
  /** The effects the element wears now (`glass`, not `ck-fx-glass`). */
  readonly value: readonly CustomCodeEffect[];
  /** The whole new list; the panel writes it as one `effects` intent. */
  readonly onChange: (effects: readonly CustomCodeEffect[]) => void;
  readonly disabled?: boolean | undefined;
  readonly labels?: EffectPresetPickerLabels | undefined;
}

/**
 * The effects library (style-manager DESIGN.md §C.1): glass, mesh, noise,
 * patterns, spotlight, gradient border, aurora, gradient text, ring glow.
 * Each is a `ck-fx-*` hook class whose CSS the renderer ships; several can
 * be worn at once, so every card is a toggle button with a small preview.
 */
export function EffectPresetPicker({
  value,
  onChange,
  disabled = false,
  labels = EFFECT_PRESET_PICKER_LABELS_EN,
}: EffectPresetPickerProps) {
  const worn = new Set(value);
  return (
    <div className="bldr-effect-picker" role="group" aria-label={labels.group}>
      {CUSTOM_CODE_EFFECTS.map((effect) => {
        const on = worn.has(effect);
        return (
          <button
            key={effect}
            type="button"
            className="bldr-effect-picker__card"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => {
              onChange(on ? value.filter((name) => name !== effect) : [...value, effect]);
            }}
          >
            <span className="bldr-effect-picker__preview" data-effect={effect} aria-hidden="true">
              {effect === 'text-gradient' ? 'Aa' : null}
            </span>
            <span className="bldr-effect-picker__name">{labels.effects[effect]}</span>
          </button>
        );
      })}
    </div>
  );
}

import { useRef } from 'react';

import {
  CUSTOM_CODE_HOVER_PRESETS,
  motionPresetGroup,
  type CustomCodeMotionTrigger,
} from '@craftkit/builder-schema';

import { focusRadioAt, rovingIndex } from '../../roving';
import { presetsForTrigger } from './presets-for-trigger';
import { MOTION_PRESET_GRID_LABELS_EN, type MotionPresetGridLabels } from './MotionPresetGrid.labels';

import './MotionPresetGrid.css';

export interface MotionPresetGridProps {
  /** `motion` lists `data-ck-motion` presets; `hover` lists `data-ck-hover` presets. */
  readonly kind: 'motion' | 'hover';
  /** Motion only: show the presets this trigger can play. */
  readonly trigger?: CustomCodeMotionTrigger | undefined;
  readonly value: string | undefined;
  /** `null` = None (removes the animation attribute). */
  readonly onSelect: (preset: string | null) => void;
  /** The editor UI direction (arrow keys follow it). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: MotionPresetGridLabels | undefined;
}

/**
 * Named animation cards with mini CSS previews (style-manager DESIGN.md
 * §B.4). A radio group: one preset (or None) per attribute. The previews
 * play on hover and focus only, and not at all under reduced motion.
 */
export function MotionPresetGrid({
  kind,
  trigger,
  value,
  onSelect,
  dir = 'ltr',
  disabled = false,
  labels = MOTION_PRESET_GRID_LABELS_EN,
}: MotionPresetGridProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const presets: readonly string[] =
    kind === 'hover' ? CUSTOM_CODE_HOVER_PRESETS : presetsForTrigger(trigger);
  const options: readonly (string | null)[] = [null, ...presets];
  const checkedIndex = options.indexOf(value ?? null);
  const tabStop = checkedIndex === -1 ? 0 : checkedIndex;
  const nameOf = (preset: string | null): string => {
    if (preset === null) return labels.none;
    const table: Readonly<Record<string, string>> = kind === 'hover' ? labels.hover : labels.presets;
    return table[preset] ?? preset;
  };
  const choose = (index: number) => {
    if (disabled || index === checkedIndex) return;
    const preset = options[index];
    if (preset !== undefined) onSelect(preset);
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={kind === 'hover' ? labels.hoverGroup : labels.motionGroup}
      className="bldr-motion-grid"
      dir={dir}
    >
      {options.map((preset, index) => (
        <button
          key={preset ?? 'none'}
          type="button"
          role="radio"
          aria-checked={index === checkedIndex}
          tabIndex={index === tabStop ? 0 : -1}
          disabled={disabled}
          className="bldr-motion-grid__card"
          onClick={() => {
            choose(index);
          }}
          onKeyDown={(event) => {
            const next = rovingIndex(event.key, index, options.length, dir);
            if (next === undefined) return;
            event.preventDefault();
            choose(next);
            focusRadioAt(groupRef.current, next);
          }}
        >
          <span
            className="bldr-motion-grid__demo"
            aria-hidden="true"
            data-kind={kind}
            data-group={preset === null ? 'none' : kind === 'hover' ? 'hover' : motionPresetGroup(preset)}
            data-preset={preset ?? 'none'}
          >
            <span className="bldr-motion-grid__demo-shape" />
          </span>
          <span className="bldr-motion-grid__name">{nameOf(preset)}</span>
        </button>
      ))}
    </div>
  );
}

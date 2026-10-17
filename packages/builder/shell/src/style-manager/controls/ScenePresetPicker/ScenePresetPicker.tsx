import { useId, useRef } from 'react';

import {
  CUSTOM_CODE_SCENE_INFO,
  CUSTOM_CODE_SCENES,
  SCENE_DENSITIES,
  SCENE_PALETTES,
  SCENES_NEEDING_IMAGES,
  type CustomCodeScene,
} from '@craftkit/builder-schema';

import { focusRadioAt, rovingIndex } from '../../roving';
import { ChoiceGroup } from '../ChoiceGroup';
import { SCENE_PRESET_PICKER_LABELS_EN, type ScenePresetPickerLabels } from './ScenePresetPicker.labels';

import './ScenePresetPicker.css';

/** An attribute patch: a value sets it, `null` removes it. */
export type ScenePatch = Readonly<Record<string, string | null>>;

export interface ScenePresetPickerProps {
  /** The layer's `data-ck-*` attributes (document truth). */
  readonly attributes: Readonly<Record<string, string | undefined>>;
  /** How many `img` children the layer holds (its fallback and textures). */
  readonly imageCount: number;
  /** Writes the patch as ONE labelled transaction. */
  readonly onCommit: (patch: ScenePatch, label: string) => void;
  /** The editor UI direction (arrow keys follow it). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: ScenePresetPickerLabels | undefined;
}

const NEEDS_IMAGES: ReadonlySet<string> = new Set(SCENES_NEEDING_IMAGES);

/**
 * The scene of a `div[data-ck-scene]` layer (media-motion DESIGN §D.2): which
 * scene draws, how dense it is, and where its colours come from. The scenes
 * are cards in a radio group (one tab stop, arrows mirrored for RTL) with the
 * schema's own bilingual names and one-line descriptions; a scene that draws
 * from images says so, and refuses, when the layer holds none. Density and
 * colours are radio rows. Every change is one write of closed values only.
 */
export function ScenePresetPicker({
  attributes,
  imageCount,
  onCommit,
  dir = 'ltr',
  disabled = false,
  labels = SCENE_PRESET_PICKER_LABELS_EN,
}: ScenePresetPickerProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const scene = attributes['data-ck-scene'];
  const checkedIndex = CUSTOM_CODE_SCENES.findIndex((name) => name === scene);
  const tabStop = checkedIndex === -1 ? 0 : checkedIndex;
  const unavailable = (name: CustomCodeScene) => imageCount === 0 && NEEDS_IMAGES.has(name);

  const choose = (index: number) => {
    const name = CUSTOM_CODE_SCENES[index];
    if (name === undefined || disabled || name === scene || unavailable(name)) return;
    onCommit({ 'data-ck-scene': name }, labels.changed);
  };

  return (
    <div className="bldr-scene-picker" role="group" aria-label={labels.group} dir={dir}>
      <span className="bldr-scene-picker__label" aria-hidden="true">
        {labels.scene}
      </span>
      <div ref={groupRef} role="radiogroup" aria-label={labels.scene} className="bldr-scene-picker__cards">
        {CUSTOM_CODE_SCENES.map((name, index) => {
          const info = CUSTOM_CODE_SCENE_INFO[name];
          const off = unavailable(name);
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={index === checkedIndex}
              aria-disabled={off || disabled || undefined}
              aria-describedby={off ? hintId : undefined}
              tabIndex={index === tabStop ? 0 : -1}
              className="bldr-scene-picker__card"
              data-scene={name}
              onClick={() => {
                choose(index);
              }}
              onKeyDown={(event) => {
                const next = rovingIndex(event.key, index, CUSTOM_CODE_SCENES.length, dir);
                if (next === undefined) return;
                event.preventDefault();
                choose(next);
                focusRadioAt(groupRef.current, next);
              }}
            >
              <span className="bldr-scene-picker__swatch" aria-hidden="true" />
              <span className="bldr-scene-picker__name">{info.label[labels.locale]}</span>
              <span className="bldr-scene-picker__description">{info.description[labels.locale]}</span>
            </button>
          );
        })}
      </div>
      {imageCount === 0 ? (
        <p id={hintId} className="bldr-scene-picker__hint">
          {labels.needsImages}
        </p>
      ) : null}

      <span className="bldr-scene-picker__label" aria-hidden="true">
        {labels.density}
      </span>
      <ChoiceGroup
        label={labels.density}
        dir={dir}
        disabled={disabled}
        value={attributes['data-ck-density'] ?? 'medium'}
        options={SCENE_DENSITIES.map((value) => ({ value, label: labels.densities[value] }))}
        onChange={(value) => {
          onCommit({ 'data-ck-density': value }, labels.changed);
        }}
      />

      <span className="bldr-scene-picker__label" aria-hidden="true">
        {labels.palette}
      </span>
      <ChoiceGroup
        label={labels.palette}
        dir={dir}
        disabled={disabled}
        value={attributes['data-ck-palette'] ?? 'theme'}
        options={SCENE_PALETTES.map((value) => ({ value, label: labels.palettes[value] }))}
        onChange={(value) => {
          onCommit({ 'data-ck-palette': value }, labels.changed);
        }}
      />
    </div>
  );
}

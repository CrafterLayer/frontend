import { useId, useRef, useState } from 'react';

import {
  CUSTOM_CODE_SCENE_INFO,
  CUSTOM_CODE_TIMELINE_RECIPE_INFO,
  CUSTOM_CODE_TIMELINE_RECIPES,
  HOSTED_SCENES,
  SCENE_DENSITIES,
  SCENE_PALETTES,
  type CustomCodeTimelineRecipe,
  type HostedScene,
} from '@craftkit/builder-schema';

import { rovingIndex } from '../../roving';
import { ChoiceGroup } from '../ChoiceGroup';
import { engineMotionValue, type EngineMotionValue } from './engine-motion';
import { ENGINE_MOTION_PICKER_LABELS_EN, type EngineMotionPickerLabels } from './EngineMotionPicker.labels';

import './EngineMotionPicker.css';

export interface EngineMotionPickerProps {
  /** What the element plays now (document truth). */
  readonly value: EngineMotionValue;
  /** The whole next value and the commit label; the caller writes it as ONE transaction. */
  readonly onChange: (next: EngineMotionValue, label: string) => void;
  /**
   * The recipes offered (default: every recipe). `[]` hides the cinematic
   * motion group (an Animated background picker only).
   */
  readonly recipes?: readonly CustomCodeTimelineRecipe[] | undefined;
  /** Offer the Animated background group (the palette-only scenes). */
  readonly scenes?: boolean | undefined;
  /** The editor UI direction (arrow keys follow it). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: EngineMotionPickerLabels | undefined;
}

interface Card {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly pressed: boolean;
}

interface CardGroupProps {
  readonly kind: 'recipe' | 'scene';
  readonly label: string;
  readonly cards: readonly Card[];
  readonly onChoose: (key: string) => void;
  readonly dir: 'ltr' | 'rtl';
  readonly disabled: boolean;
}

/**
 * One row of toggle cards (`aria-pressed`, one pressed at a time): a single
 * tab stop, arrows move FOCUS (mirrored for RTL, Home/End) and Enter or Space
 * chooses — so walking the list never writes a transaction per card. The
 * pressed card is not a second write.
 */
function CardGroup({ kind, label, cards, onChoose, dir, disabled }: CardGroupProps) {
  const uid = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const pressedIndex = cards.findIndex((card) => card.pressed);
  const tabStop = active !== null && active < cards.length ? active : Math.max(pressedIndex, 0);

  return (
    <div className="bldr-engine-motion__group">
      <span id={`${uid}-label`} className="bldr-engine-motion__label">
        {label}
      </span>
      <div ref={groupRef} role="group" aria-labelledby={`${uid}-label`} className="bldr-engine-motion__cards">
        {cards.map((card, index) => (
          <button
            key={card.key}
            type="button"
            aria-pressed={card.pressed}
            aria-labelledby={`${uid}-${String(index)}-name`}
            aria-describedby={`${uid}-${String(index)}-description`}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={disabled}
            className="bldr-engine-motion__card"
            data-kind={kind}
            data-value={card.key}
            onFocus={() => {
              setActive(index);
            }}
            onClick={() => {
              if (!card.pressed) onChoose(card.key);
            }}
            onKeyDown={(event) => {
              const next = rovingIndex(event.key, index, cards.length, dir);
              if (next === undefined) return;
              event.preventDefault();
              setActive(next);
              groupRef.current?.querySelectorAll<HTMLButtonElement>('.bldr-engine-motion__card')[next]?.focus();
            }}
          >
            {kind === 'scene' ? <span className="bldr-engine-motion__swatch" aria-hidden="true" /> : null}
            <span id={`${uid}-${String(index)}-name`} className="bldr-engine-motion__name">
              {card.name}
            </span>
            <span id={`${uid}-${String(index)}-description`} className="bldr-engine-motion__description">
              {card.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const NONE = 'none';

/**
 * The engine's motion for one element (gsap-pixi fix 2026-10-08): a named
 * Cinematic motion recipe — cards with the schema's bilingual name and one
 * line of what it does — and, once one is chosen, how it plays (as the recipe,
 * with scroll, once). With `scenes`, an Animated background behind the
 * element's content (the palette-only scenes) with its density and colours.
 *
 * Purely presentational: the value comes in, the whole next value goes out
 * with its label, and the caller turns it into attributes, part styles or
 * the section's `motion` prop as ONE transaction. Closed names only — there
 * is no timing, easing curve or keyframe surface here.
 */
export function EngineMotionPicker({
  value,
  onChange,
  recipes = CUSTOM_CODE_TIMELINE_RECIPES,
  scenes = false,
  dir = 'ltr',
  disabled = false,
  labels = ENGINE_MOTION_PICKER_LABELS_EN,
}: EngineMotionPickerProps) {
  const { locale } = labels;
  const shownRecipes =
    value.timeline === undefined || recipes.length === 0 || recipes.includes(value.timeline)
      ? recipes
      : [...recipes, value.timeline];
  const change = (next: EngineMotionValue, label: string) => {
    onChange(engineMotionValue(next), label);
  };

  const recipeCards: Card[] = [
    { key: NONE, name: labels.none, description: labels.noRecipe, pressed: value.timeline === undefined },
    ...shownRecipes.map((name) => ({
      key: name,
      name: CUSTOM_CODE_TIMELINE_RECIPE_INFO[name].label[locale],
      description: CUSTOM_CODE_TIMELINE_RECIPE_INFO[name].description[locale],
      pressed: value.timeline === name,
    })),
  ];
  const sceneCards: Card[] = [
    { key: NONE, name: labels.none, description: labels.noScene, pressed: value.scene === undefined },
    ...HOSTED_SCENES.map((name) => ({
      key: name,
      name: CUSTOM_CODE_SCENE_INFO[name].label[locale],
      description: CUSTOM_CODE_SCENE_INFO[name].description[locale],
      pressed: value.scene === name,
    })),
  ];

  return (
    <div className="bldr-engine-motion" dir={dir}>
      {shownRecipes.length === 0 ? null : (
        <>
          <CardGroup
            kind="recipe"
            label={labels.recipe}
            cards={recipeCards}
            dir={dir}
            disabled={disabled}
            onChoose={(key) => {
              const timeline = shownRecipes.find((name) => name === key);
              change(
                timeline === undefined
                  ? { ...value, timeline: undefined, scrub: undefined }
                  : { ...value, timeline },
                labels.recipe,
              );
            }}
          />
          {value.timeline === undefined ? null : (
            <div className="bldr-engine-motion__row">
              <span className="bldr-engine-motion__label" aria-hidden="true">
                {labels.plays}
              </span>
              <ChoiceGroup
                label={labels.plays}
                dir={dir}
                disabled={disabled}
                value={value.scrub === undefined ? 'default' : String(value.scrub)}
                options={(['default', 'true', 'false'] as const).map((option) => ({
                  value: option,
                  label: labels.playsAs[option],
                }))}
                onChange={(option) => {
                  change(
                    { ...value, scrub: option === 'true' ? true : option === 'false' ? false : undefined },
                    labels.recipe,
                  );
                }}
              />
            </div>
          )}
        </>
      )}
      {scenes ? (
        <>
          <CardGroup
            kind="scene"
            label={labels.scene}
            cards={sceneCards}
            dir={dir}
            disabled={disabled}
            onChoose={(key) => {
              const scene: HostedScene | undefined = HOSTED_SCENES.find((name) => name === key);
              change(
                scene === undefined
                  ? { ...value, scene: undefined, density: undefined, palette: undefined }
                  : { ...value, scene },
                labels.scene,
              );
            }}
          />
          {value.scene === undefined ? null : (
            <>
              <div className="bldr-engine-motion__row">
                <span className="bldr-engine-motion__label" aria-hidden="true">
                  {labels.density}
                </span>
                <ChoiceGroup
                  label={labels.density}
                  dir={dir}
                  disabled={disabled}
                  value={value.density ?? 'medium'}
                  options={SCENE_DENSITIES.map((option) => ({ value: option, label: labels.densities[option] }))}
                  onChange={(option) => {
                    const density = SCENE_DENSITIES.find((name) => name === option);
                    change({ ...value, density }, labels.scene);
                  }}
                />
              </div>
              <div className="bldr-engine-motion__row">
                <span className="bldr-engine-motion__label" aria-hidden="true">
                  {labels.palette}
                </span>
                <ChoiceGroup
                  label={labels.palette}
                  dir={dir}
                  disabled={disabled}
                  value={value.palette ?? 'theme'}
                  options={SCENE_PALETTES.map((option) => ({ value: option, label: labels.palettes[option] }))}
                  onChange={(option) => {
                    const palette = SCENE_PALETTES.find((name) => name === option);
                    change({ ...value, palette }, labels.scene);
                  }}
                />
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

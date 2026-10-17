/**
 * The motion vocabulary a custom-code element may name (style-manager DESIGN.md §B.2).
 *
 * Animation is written as ATTRIBUTES, never as script and never as a class:
 * `data-ck-motion` names an entrance, scroll, loop or text preset;
 * `data-ck-hover` names a hover preset; the params below tune them. Every
 * value is a closed enum, so a tree still carries only NAMES — the CSS and the
 * serialised behaviours runtime decide what each name does, and a published
 * page ships no animation library (DESIGN D7).
 *
 * The lists are the exact ones in the design. Adding a preset means adding it
 * here AND giving it CSS or a behaviour; a name with neither is a promise the
 * page cannot keep.
 */

/** Entrance presets: play once (or every time) the element enters. */
export const CUSTOM_CODE_ENTRANCE_PRESETS = [
  'fade',
  'fade-up',
  'fade-down',
  'fade-start',
  'fade-end',
  'zoom-in',
  'zoom-out',
  'blur-in',
  'flip-up',
  'clip-up',
  'clip-start',
  'rise-mask',
  'tilt-in',
] as const;

/** Stagger presets: set on a container; each child gets its index as `--ck-i`. */
export const CUSTOM_CODE_STAGGER_PRESETS = [
  'stagger-up',
  'stagger-fade',
  'stagger-zoom',
  'stagger-grid',
] as const;

/** Scroll-linked presets: progress follows the scroll position, not a clock. */
export const CUSTOM_CODE_SCROLL_PRESETS = [
  'parallax-slow',
  'parallax-fast',
  'scale-on-scroll',
  'fade-on-exit',
  'reading-progress',
  'sticky-stack',
  'pin',
  'horizontal-scroll',
] as const;

/** Loop presets: run continuously (loops over 5 s pause on hover and focus). */
export const CUSTOM_CODE_LOOP_PRESETS = [
  'float',
  'pulse',
  'gradient-shift',
  'shimmer',
  'spin-slow',
  'orbit',
  'meteors',
] as const;

/** Text presets (behaviour tier): the full text stays readable to assistive technology. */
export const CUSTOM_CODE_TEXT_PRESETS = [
  'split-chars',
  'split-words',
  'split-lines',
  'typewriter',
  'word-rotate',
  'gradient-text',
  'highlight-sweep',
  'blur-words',
  'draw-line',
] as const;

/** Every preset `data-ck-motion` may name, in panel order. */
export const CUSTOM_CODE_MOTION_PRESETS = [
  ...CUSTOM_CODE_ENTRANCE_PRESETS,
  ...CUSTOM_CODE_STAGGER_PRESETS,
  ...CUSTOM_CODE_SCROLL_PRESETS,
  ...CUSTOM_CODE_LOOP_PRESETS,
  ...CUSTOM_CODE_TEXT_PRESETS,
] as const;

export type CustomCodeMotionPreset = (typeof CUSTOM_CODE_MOTION_PRESETS)[number];

/** Every preset `data-ck-hover` may name. */
export const CUSTOM_CODE_HOVER_PRESETS = [
  'lift',
  'glow',
  'scale',
  'tilt',
  'magnetic',
  'shine-sweep',
  'underline-grow',
  'image-zoom',
  'border-beam',
  'icon-nudge',
] as const;

export type CustomCodeHoverPreset = (typeof CUSTOM_CODE_HOVER_PRESETS)[number];

/** When a `data-ck-motion` preset plays (`data-ck-trigger`); absent ⇒ `view`. */
export const CUSTOM_CODE_MOTION_TRIGGERS = ['view', 'load', 'hover', 'click', 'scroll'] as const;

export type CustomCodeMotionTrigger = (typeof CUSTOM_CODE_MOTION_TRIGGERS)[number];

/** Named easing curves (`data-ck-ease`); spring and bounce are CSS `linear()` curves. */
export const CUSTOM_CODE_MOTION_EASES = [
  'standard',
  'emphasized',
  'spring',
  'bounce',
  'linear',
] as const;

export type CustomCodeMotionEase = (typeof CUSTOM_CODE_MOTION_EASES)[number];

/** `data-ck-delay`: steps of 80 ms, from 0 to 6. */
export const CUSTOM_CODE_MOTION_DELAYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

/** `data-ck-speed`: shared with the behaviours (`marquee`, `count-up`…). */
export const CUSTOM_CODE_MOTION_SPEEDS = ['slow', 'normal', 'fast'] as const;

/** `data-ck-once`: play on the first entry only, or every time. */
export const CUSTOM_CODE_MOTION_ONCE = ['true', 'false'] as const;

/** `data-ck-distance`: how far an entrance travels (token-driven). */
export const CUSTOM_CODE_MOTION_DISTANCES = ['sm', 'md', 'lg'] as const;

/** `data-ck-stagger`: the gap between children of a stagger container. */
export const CUSTOM_CODE_MOTION_STAGGERS = ['sm', 'md', 'lg'] as const;

/** The two attributes that NAME an animation. */
export const CUSTOM_CODE_MOTION_NAME_ATTRIBUTES = ['data-ck-motion', 'data-ck-hover'] as const;

/**
 * The params: each means something only beside `data-ck-motion` or
 * `data-ck-hover` on the same element. `data-ck-speed` is listed with the
 * behaviour params too; beside a motion name it is valid as well.
 */
export const CUSTOM_CODE_MOTION_PARAMS = [
  'data-ck-trigger',
  'data-ck-delay',
  'data-ck-ease',
  'data-ck-once',
  'data-ck-distance',
  'data-ck-stagger',
  'data-ck-target',
] as const;

/** Every motion attribute the vocabulary admits (names + params, speed excluded). */
export const CUSTOM_CODE_MOTION_ATTRIBUTES = [
  ...CUSTOM_CODE_MOTION_NAME_ATTRIBUTES,
  ...CUSTOM_CODE_MOTION_PARAMS,
] as const;

export type CustomCodeMotionGroup = 'entrance' | 'stagger' | 'scroll' | 'loop' | 'text';

const GROUP_OF: ReadonlyMap<string, CustomCodeMotionGroup> = new Map<string, CustomCodeMotionGroup>(
  [
    ...CUSTOM_CODE_ENTRANCE_PRESETS.map((name) => [name, 'entrance'] as const),
    ...CUSTOM_CODE_STAGGER_PRESETS.map((name) => [name, 'stagger'] as const),
    ...CUSTOM_CODE_SCROLL_PRESETS.map((name) => [name, 'scroll'] as const),
    ...CUSTOM_CODE_LOOP_PRESETS.map((name) => [name, 'loop'] as const),
    ...CUSTOM_CODE_TEXT_PRESETS.map((name) => [name, 'text'] as const),
  ],
);

/**
 * Which triggers each preset group accepts — the compatibility table.
 *
 * - scroll-linked presets follow a timeline, so they need `view` or `scroll`;
 * - text presets play from `view`, `load` or `click`;
 * - entrances play from anything but a scroll timeline;
 * - a stagger container plays when it is seen or when the page loads;
 * - loops start on load, when seen, or while hovered.
 */
export const CUSTOM_CODE_MOTION_TRIGGER_TABLE: Readonly<
  Record<CustomCodeMotionGroup, readonly CustomCodeMotionTrigger[]>
> = {
  entrance: ['view', 'load', 'hover', 'click'],
  stagger: ['view', 'load'],
  scroll: ['view', 'scroll'],
  loop: ['load', 'view', 'hover'],
  text: ['view', 'load', 'click'],
};

const MOTION_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_MOTION_PRESETS);
const HOVER_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_HOVER_PRESETS);
const TRIGGER_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_MOTION_TRIGGERS);

/** Whether a value names a `data-ck-motion` preset. */
export function isMotionPreset(value: string): value is CustomCodeMotionPreset {
  return MOTION_SET.has(value);
}

/** Whether a value names a `data-ck-hover` preset. */
export function isHoverPreset(value: string): value is CustomCodeHoverPreset {
  return HOVER_SET.has(value);
}

/** Whether a value names a trigger. */
export function isMotionTrigger(value: string): value is CustomCodeMotionTrigger {
  return TRIGGER_SET.has(value);
}

/** The group a preset belongs to, or undefined for a name outside the vocabulary. */
export function motionPresetGroup(preset: string): CustomCodeMotionGroup | undefined {
  return GROUP_OF.get(preset);
}

/** The triggers a preset accepts; empty for an unknown preset. */
export function motionTriggersFor(preset: string): readonly CustomCodeMotionTrigger[] {
  const group = GROUP_OF.get(preset);
  return group === undefined ? [] : CUSTOM_CODE_MOTION_TRIGGER_TABLE[group];
}

/**
 * What is wrong with playing `preset` on `trigger`, or undefined when the
 * pair is allowed (or either half is unknown — the enums report that).
 */
export function motionTriggerProblem(preset: string, trigger: string): string | undefined {
  const group = GROUP_OF.get(preset);
  if (group === undefined || !TRIGGER_SET.has(trigger)) return undefined;
  const allowed = CUSTOM_CODE_MOTION_TRIGGER_TABLE[group];
  if ((allowed as readonly string[]).includes(trigger)) return undefined;
  return `data-ck-motion='${preset}' is a ${group} preset and plays on ${allowed.join(' or ')}, not data-ck-trigger='${trigger}'`;
}

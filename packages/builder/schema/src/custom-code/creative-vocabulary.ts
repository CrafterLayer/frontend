/**
 * The scene hooks (2026-10-12): the elements a story, game or animation scene's code finds in its
 * section's tree — a Start button, a status line, a chapter title, a counter — by a data attribute.
 *
 *   <button type="button" data-game-action="start">Start</button>
 *   <output data-game-status role="status"></output>
 *   <button type="button" data-scene-action="jump">Jump</button>
 *
 * The creative playbooks teach these names, and the door refused every one: the plan normalizer
 * dropped them, so a written game's buttons carried nothing its code could find — while the scene
 * checks, which read trees built without the door, passed. The door now admits the families the
 * playbooks teach, plus five general `data-scene-*` hooks for anything else a scene needs (other
 * data-* stay refused). Values are tokens, key codes or numbers, never words, code or an address:
 * the tree still carries data only. This module imports nothing; the tree door
 * (`custom-code-tree.ts`) admits these names with these rules, and a builder-ai test holds every
 * hook a playbook teaches to this list.
 */

/** An action, part or sound name: 1-48 letters, digits, `_`, `-` or `.`. */
const TOKEN = /^[\p{L}\p{N}_.-]{1,48}$/u;
/** A KeyboardEvent.code: ArrowLeft, Space, KeyW, Digit1. */
const KEY_CODE = /^[A-Za-z][A-Za-z0-9]{0,23}$/u;
/** A number a counter counts to: 250, -3, 98.6. */
const COUNT = /^-?\d{1,12}(?:\.\d{1,6})?$/u;

type HookValue = 'token' | 'marker' | 'key' | 'count';

const HOOKS = {
  // Games (craftkit.pixi-games): actions, direction buttons and the status line.
  'data-game-action': 'token',
  'data-game-key': 'key',
  'data-game-status': 'marker',
  // Stories (craftkit.pixi-stories): navigation, the page's title and copy, status, read aloud.
  'data-story-action': 'token',
  'data-story-title': 'marker',
  'data-story-copy': 'marker',
  'data-story-status': 'marker',
  'data-story-voice': 'marker',
  // Creative engines: animation, effects, physics, HUD, sound and the chase example.
  'data-anim-next': 'marker',
  'data-anim-status': 'marker',
  'data-fx-burst': 'marker',
  'data-physics': 'token',
  'data-physics-status': 'marker',
  'data-hud-act': 'token',
  'data-hud-status': 'marker',
  'data-sfx': 'token',
  'data-sfx-status': 'marker',
  'data-chase-start': 'marker',
  'data-chase-key': 'key',
  'data-chase-status': 'marker',
  // The free-code card's counter: <b data-count="250">.
  'data-count': 'count',
  // Anything else a scene needs, under one documented name family.
  'data-scene-action': 'token',
  'data-scene-key': 'key',
  'data-scene-status': 'marker',
  'data-scene-part': 'token',
  'data-scene-value': 'token',
} as const satisfies Record<string, HookValue>;

export type CustomCodeSceneHook = keyof typeof HOOKS;

/** Every hook name, in the order above. */
export const CUSTOM_CODE_SCENE_HOOKS = Object.keys(HOOKS) as readonly CustomCodeSceneHook[];

/** The general hooks a scene may name for anything the families above do not cover. */
export const CUSTOM_CODE_SCENE_GENERAL_HOOKS = CUSTOM_CODE_SCENE_HOOKS.filter((name) =>
  name.startsWith('data-scene-'),
);

interface SceneHookRule {
  /** Any html element (never inside an svg drawing). */
  readonly on: 'html';
  /** What is wrong with the value, or undefined when it is fine. */
  readonly value: (value: string, name: string) => string | undefined;
}

const RULE: Readonly<Record<HookValue, SceneHookRule['value']>> = {
  token: (value, name) =>
    TOKEN.test(value) ? undefined : `${name} names a token of 1-48 letters, digits, _, - or .`,
  // Bare, or a token when the code tells several apart.
  marker: (value, name) =>
    value === '' || TOKEN.test(value)
      ? undefined
      : `${name} is written bare (${name}) or with a token of 1-48 letters, digits, _, - or .`,
  key: (value, name) =>
    KEY_CODE.test(value) ? undefined : `${name} is a key code such as ArrowLeft, Space or KeyW`,
  count: (value, name) => (COUNT.test(value) ? undefined : `${name} is a number such as 250`),
};

/** Where each hook may stand and what its value may be (the door names the fix otherwise). */
export const CUSTOM_CODE_SCENE_HOOK_RULES: Readonly<Record<CustomCodeSceneHook, SceneHookRule>> =
  Object.fromEntries(
    Object.entries(HOOKS).map(([name, kind]) => [name, { on: 'html', value: RULE[kind] }]),
  ) as Record<CustomCodeSceneHook, SceneHookRule>;

/** The hooks as the door reads them: names, the general family, and each name's rule. */
export const SCENE_HOOKS = Object.freeze({
  names: CUSTOM_CODE_SCENE_HOOKS,
  general: CUSTOM_CODE_SCENE_GENERAL_HOOKS,
  rules: CUSTOM_CODE_SCENE_HOOK_RULES,
});

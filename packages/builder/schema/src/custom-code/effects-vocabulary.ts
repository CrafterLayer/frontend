/**
 * The effects library a custom-code element may wear (style-manager DESIGN.md §C.1).
 *
 * An effect is a HOOK class, `ck-fx-<name>`, whose CSS the renderer ships —
 * glass, a mesh gradient, a grain overlay, a pattern. It sits in the region's
 * `ck-` namespace (admitted without a generated utility behind it), but unlike
 * a region's own `ck-` hooks the `ck-fx-` names are a CLOSED list: the CSS for
 * them is not the region's to write, so a name outside this list would be a
 * class that silently does nothing.
 */
export const CUSTOM_CODE_EFFECTS = [
  'glass',
  'mesh',
  'noise',
  'grid',
  'dots',
  'retro-grid',
  'spotlight',
  'gradient-border',
  'aurora-bg',
  'text-gradient',
  'ring-glow',
] as const;

export type CustomCodeEffect = (typeof CUSTOM_CODE_EFFECTS)[number];

/** The class prefix every effect hook carries. */
export const CUSTOM_CODE_EFFECT_PREFIX = 'ck-fx-';

const EFFECT_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_EFFECTS);

/** Whether a value names an effect (`glass`, not `ck-fx-glass`). */
export function isCustomCodeEffect(value: string): value is CustomCodeEffect {
  return EFFECT_SET.has(value);
}

/** The class an effect is written as: `glass` → `ck-fx-glass`. */
export function customCodeEffectClass(effect: CustomCodeEffect): string {
  return `${CUSTOM_CODE_EFFECT_PREFIX}${effect}`;
}

/** Whether a class sits in the effect namespace at all (known or not). */
export function isCustomCodeEffectNamespace(className: string): boolean {
  return className.startsWith(CUSTOM_CODE_EFFECT_PREFIX);
}

/** The effect a class names (`ck-fx-glass` → `glass`), or undefined. */
export function customCodeEffectOfClass(className: string): CustomCodeEffect | undefined {
  if (!isCustomCodeEffectNamespace(className)) return undefined;
  const name = className.slice(CUSTOM_CODE_EFFECT_PREFIX.length);
  return isCustomCodeEffect(name) ? name : undefined;
}

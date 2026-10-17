import {
  readStyle,
  STYLE_PROPERTIES,
  type ResolvedStyle,
  type StyleBoxSide,
  type StyleBucket,
  type StyleCorner,
  type StylePropertyDef,
  type StylePropertyId,
  type StyleState,
  type StyleValue,
} from '@craftkit/builder-schema';

import type { ValueOrigin } from './controls/ValueSourceDot';

export type StyleSlot = StyleBoxSide | StyleCorner;

/** One value as a control shows it, across every target. */
export interface SlotView {
  /** `undefined` when unset, or when the targets disagree (`mixed`). */
  readonly value: StyleValue | undefined;
  readonly origin: ValueOrigin;
  /** The class behind the value (the first target's). */
  readonly className: string | undefined;
  readonly mixed: boolean;
}

export interface PropertyView extends SlotView {
  readonly def: StylePropertyDef;
  /** The family also has `sm:`/`xl:`/`@md:` classes the panel leaves alone. */
  readonly customBreakpoint: boolean;
  /** Sided properties: every logical side or corner on its own. */
  readonly sides: Readonly<Partial<Record<StyleSlot, SlotView>>>;
}

const BOX: readonly StyleSlot[] = ['block-start', 'block-end', 'inline-start', 'inline-end'];
const CORNERS: readonly StyleSlot[] = ['start-start', 'start-end', 'end-start', 'end-end'];

function keyOf(resolved: ResolvedStyle | undefined): string {
  return resolved === undefined ? 'unset' : JSON.stringify(resolved.value);
}

function isMixedKeyword(value: StyleValue | undefined): boolean {
  return value?.kind === 'keyword' && value.keyword === 'mixed';
}

function slotView(resolved: readonly (ResolvedStyle | undefined)[]): SlotView {
  const first = resolved[0];
  const mixed = resolved.some((entry) => keyOf(entry) !== keyOf(first));
  const value = mixed || first === undefined || isMixedKeyword(first.value) ? undefined : first.value;
  return {
    value,
    origin: first?.source ?? 'unset',
    className: first?.className,
    mixed,
  };
}

/**
 * What every property shows at a bucket and state, for one or many targets
 * (style-manager DESIGN.md §A.5): the value, where it comes from, the class
 * behind it, whether the targets disagree (Mixed), and per side for the box
 * model and corners. Read through the P1 engine, so the panel and the engine
 * cannot disagree about what a class means.
 */
export function viewStyles(
  classNames: readonly string[],
  at: { readonly bucket: StyleBucket; readonly state: StyleState },
  namedStyles?: Readonly<Record<string, string>>,
): ReadonlyMap<StylePropertyId, PropertyView> {
  const maps = classNames.map((className) => readStyle(className, at, { namedStyles }));
  const views = new Map<StylePropertyId, PropertyView>();
  for (const def of Object.values(STYLE_PROPERTIES)) {
    if (def.storage !== 'class') continue;
    const resolved = maps.map((map) => map.get(def.id));
    const base = slotView(resolved);
    const slots = def.sides === 'box' ? BOX : def.sides === 'corners' ? CORNERS : [];
    const sides: Partial<Record<StyleSlot, SlotView>> = {};
    for (const slot of slots) {
      sides[slot] = slotView(resolved.map((entry) => entry?.sides?.[slot]));
    }
    views.set(def.id, {
      ...base,
      def,
      customBreakpoint: resolved.some((entry) => entry?.customBreakpoint === true),
      sides,
    });
  }
  return views;
}

/** The view of a property nothing sets (also the fallback for a missing entry). */
export function emptyView(def: StylePropertyDef): PropertyView {
  return {
    def,
    value: undefined,
    origin: 'unset',
    className: undefined,
    mixed: false,
    customBreakpoint: false,
    sides: {},
  };
}

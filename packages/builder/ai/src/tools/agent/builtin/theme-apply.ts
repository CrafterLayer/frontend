import { PAGE_PLAN_PALETTE_HEX } from '../../../agent/page-plan/palette';
import { PAGE_PLAN_RADII, type PagePlanRadius } from '../../../agent/page-plan/types';
import { DIRECTION_DECK_ROWS } from '../../../skills/direction-deck';
import {
  AA,
  colourHex,
  failingPairs,
  mix,
  nearestShades,
  ratio,
  readable,
  readPageKit,
  writePageKit,
  type KitColourKey,
  type KitColours,
  type PageKitState,
} from '../page-kit';
import {
  fail,
  inputRecord,
  isArabicLocale,
  okParse,
  rootIdOf,
  setProp,
  unknownKeys,
} from '../shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../types';
import { RADIX_SCALES, radixPalette, type RadixAppearance, type RadixScale } from './radix-palette';

/**
 * theme.apply — recolour the page by rewriting its `--ck-*` kit tokens.
 *
 * The four colours a person names (accent, ground, ink, surface) are taken
 * as given; everything that reads ON them (on-accent, accent ink, muted,
 * border) is re-derived and measured, so a new accent never leaves a button
 * label or a step number unreadable. A named colour that itself breaks a
 * WCAG AA text pair is refused, and the refusal names the nearest shade that
 * passes — the one repair round needs nothing else.
 */

export interface ThemeApplyInput {
  readonly accent?: string;
  readonly bg?: string;
  readonly ink?: string;
  readonly surface?: string;
  readonly radius?: PagePlanRadius;
  readonly deckRow?: string;
  readonly radixScale?: RadixScale;
  readonly appearance?: RadixAppearance;
}

const COLOUR_KEYS = ['accent', 'bg', 'ink', 'surface'] as const;
type ColourInput = (typeof COLOUR_KEYS)[number];

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined)
    return fail<ThemeApplyInput>('input must be an object like {"accent":"emerald-700"}.');
  const extra = unknownKeys(record, [
    ...COLOUR_KEYS,
    'radius',
    'deckRow',
    'radixScale',
    'appearance',
  ]);
  if (extra.length > 0)
    return fail<ThemeApplyInput>(
      `unknown keys ${extra.join(', ')}; use accent, bg, ink, surface, radius, deckRow, radixScale, appearance.`,
    );
  const out: Record<string, string> = {};
  for (const key of COLOUR_KEYS) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || colourHex(value) === undefined) {
      return fail<ThemeApplyInput>(
        `"${key}" must be #rrggbb or a palette shade such as emerald-700.`,
      );
    }
    out[key] = value.trim().toLowerCase();
  }
  const radius = record['radius'];
  if (radius !== undefined) {
    if (typeof radius !== 'string' || !(PAGE_PLAN_RADII as readonly string[]).includes(radius)) {
      return fail<ThemeApplyInput>(`"radius" is one of ${PAGE_PLAN_RADII.join(', ')}.`);
    }
    out['radius'] = radius;
  }
  const deckRow = record['deckRow'];
  if (deckRow !== undefined) {
    if (typeof deckRow !== 'string' || !DIRECTION_DECK_ROWS.some(({ id }) => id === deckRow)) {
      return fail<ThemeApplyInput>(
        `"deckRow" is one of ${DIRECTION_DECK_ROWS.map(({ id }) => id).join(', ')}.`,
      );
    }
    out['deckRow'] = deckRow;
  }
  const radixScale = record['radixScale'];
  if (radixScale !== undefined) {
    if (
      typeof radixScale !== 'string' ||
      !(RADIX_SCALES as readonly string[]).includes(radixScale)
    ) {
      return fail<ThemeApplyInput>(`"radixScale" is one of ${RADIX_SCALES.join(', ')}.`);
    }
    if (deckRow !== undefined)
      return fail<ThemeApplyInput>('choose radixScale or deckRow, not both.');
    out['radixScale'] = radixScale;
  }
  const appearance = record['appearance'];
  if (appearance !== undefined) {
    if (radixScale === undefined) return fail<ThemeApplyInput>('"appearance" requires radixScale.');
    if (appearance !== 'light' && appearance !== 'dark')
      return fail<ThemeApplyInput>('"appearance" is light or dark.');
    out['appearance'] = appearance;
  }
  if (Object.keys(out).length === 0) {
    return fail<ThemeApplyInput>(
      'name at least one of accent, bg, ink, surface, radius, deckRow or radixScale.',
    );
  }
  return okParse(out as ThemeApplyInput);
}

/** The deck row's look: its palette resolved to hex, and its faces for the page's script. */
function deckState(rowId: string, base: PageKitState, arabic: boolean): PageKitState {
  const row = DIRECTION_DECK_ROWS.find(({ id }) => id === rowId);
  if (row === undefined) return base;
  const hex = (name: string, fallback: string) =>
    PAGE_PLAN_PALETTE_HEX[name] ?? colourHex(name) ?? fallback;
  const p = row.palette;
  const bg = hex(p.ground, base.colours.bg);
  const ink = hex(p.ink, base.colours.ink);
  const [display, body] = arabic ? row.arabic : row.latin;
  return {
    ...base,
    colours: {
      bg,
      surface: hex(p.card, base.colours.surface),
      ink,
      muted: hex(p.muted, base.colours.muted),
      accent: hex(p.accent, base.colours.accent),
      onAccent: hex(p.onAccent, base.colours.onAccent),
      accentInk: hex(p.accentInk, base.colours.accentInk),
      border: mix(ink, bg, 0.15),
    },
    display,
    body,
  };
}

/**
 * The colours after the named ones land: named colours as given, and the
 * ones that read on them re-chosen by measuring when they no longer pass.
 */
function derive(base: KitColours, named: Partial<Record<ColourInput, string>>): KitColours {
  const bg = named.bg ?? base.bg;
  let ink = named.ink ?? base.ink;
  let surface = named.surface ?? base.surface;
  if (named.bg !== undefined && named.surface === undefined) {
    const tinted = mix(ink, bg, 0.04);
    surface = ratio(ink, tinted) >= AA ? tinted : bg;
  }
  if (named.ink === undefined) {
    ink = readable([base.ink, '#1c1917', '#ffffff', '#000000'], [bg, surface]);
  }
  const grounds = [bg, surface];
  const muted = readable([base.muted, mix(ink, bg, 0.72), mix(ink, bg, 0.82), ink], grounds);
  const accent = named.accent ?? base.accent;
  const onAccent = readable([base.onAccent, '#ffffff', '#000000'], [accent]);
  const accentInk = readable(
    [
      accent,
      base.accentInk,
      mix(accent, ink, 0.7),
      mix(accent, ink, 0.5),
      mix(accent, ink, 0.3),
      ink,
    ],
    grounds,
  );
  const border =
    named.bg !== undefined || named.ink !== undefined ? mix(ink, bg, 0.15) : base.border;
  return { bg, surface, ink, muted, accent, onAccent, accentInk, border };
}

const KEY_NAMES: Readonly<Record<KitColourKey, string>> = {
  bg: 'bg',
  surface: 'surface',
  ink: 'ink',
  muted: 'muted',
  accent: 'accent',
  onAccent: 'on-accent',
  accentInk: 'accent ink',
  border: 'border',
};

/** A refusal naming the failing pair and the nearest palette shade of the named colour that passes. */
function refusal(
  colours: KitColours,
  named: Partial<Record<ColourInput, string>>,
): string | undefined {
  const failures = failingPairs(colours);
  const first = failures[0];
  if (first === undefined) return undefined;
  const namedKey = (key: KitColourKey): key is ColourInput =>
    (COLOUR_KEYS as readonly string[]).includes(key) && named[key as ColourInput] !== undefined;
  const change: KitColourKey = namedKey(first.fg)
    ? first.fg
    : namedKey(first.bg)
      ? first.bg
      : first.fg;
  const other = change === first.fg ? first.bg : first.fg;
  const written = namedKey(change) ? named[change] : undefined;
  const suggestion = nearestShades(colours[change], written).find(
    ([, hex]) => ratio(hex, colours[other]) >= AA,
  );
  const pair = `${KEY_NAMES[first.fg]} ${colours[first.fg]} on ${KEY_NAMES[first.bg]} ${colours[first.bg]}`;
  return `${pair} is ${first.ratio.toFixed(2)}:1, below WCAG AA 4.5:1.${
    suggestion === undefined
      ? ''
      : ` Use ${change} "${suggestion[0]}" (${suggestion[1]}), which passes.`
  }`;
}

/** Whether two kit states draw the same page: colours, radius and faces. */
function sameLook(left: PageKitState, right: PageKitState): boolean {
  const face = ({ family, weights }: PageKitState['display']) =>
    `${family}:${[...weights].sort().join(';')}`;
  return (
    (Object.keys(left.colours) as KitColourKey[]).every(
      (key) => left.colours[key] === right.colours[key],
    ) &&
    left.radius === right.radius &&
    face(left.display) === face(right.display) &&
    face(left.body) === face(right.body)
  );
}

function run(input: ThemeApplyInput, context: AgentToolContext): AgentToolRun {
  const rootId = rootIdOf(context.kernel);
  const current = context.readProp(rootId, 'pageCss');
  const pageCss = typeof current === 'string' ? current : '';
  const arabic = isArabicLocale(context) || context.locale.dir === 'rtl';
  const read = readPageKit(pageCss, arabic);
  let { state } = read;
  if (input.deckRow !== undefined) state = deckState(input.deckRow, state, arabic);
  if (input.radixScale !== undefined) {
    state = { ...state, colours: radixPalette(input.radixScale, input.appearance ?? 'light') };
  }
  const named: Partial<Record<ColourInput, string>> = {};
  for (const key of COLOUR_KEYS) {
    const value = input[key];
    if (value !== undefined) named[key] = value;
  }
  const hexNamed: Partial<Record<ColourInput, string>> = {};
  for (const key of COLOUR_KEYS) {
    const value = named[key];
    const hex = value === undefined ? undefined : colourHex(value);
    if (hex !== undefined) hexNamed[key] = hex;
  }
  const colours = derive(state.colours, hexNamed);
  const refused = refusal(colours, named);
  if (refused !== undefined) return { ok: false, error: refused };
  const next: PageKitState = {
    ...state,
    colours,
    ...(input.radius === undefined ? {} : { radius: input.radius }),
  };
  /*
    colour-target fix: the kit is compared as values, not text. `writePageKit`
    re-emits the font imports as one URL, so a rewrite with the values the page
    already holds differed as text while nothing on screen moved.
  */
  const same = read.hasKit && sameLook(read.state, next);
  const css = writePageKit(pageCss, next, context.locale);
  if (same || css === pageCss)
    return { ok: true, steps: [], note: 'the theme already has these values' };
  return { ok: true, steps: [setProp(rootId, 'pageCss', css)] };
}

export const themeApplyTool = defineAgentTool<ThemeApplyInput>({
  name: 'theme.apply',
  lanes: ['edit'],
  summary: 'Recolour the page, AA checked',
  signature:
    '{accent?,bg?,ink?,surface?:#hex|shade,radius?,deckRow?,radixScale?,appearance?:light|dark}',
  parse,
  run: (input, context) => run(input, context),
});

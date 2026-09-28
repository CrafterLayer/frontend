import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { CHROME_TOKENS, darkChromeTheme, lightChromeTheme, type ChromeTheme } from './index';

/**
 * CONTRAST, MEASURED — not asserted in a comment.
 *
 * Every theme file in this repo used to carry a table of ratios in its header.
 * A table is a claim: it is written once, and the next person to nudge a ramp
 * has no way to know they broke it. This story computes the ratios from the
 * theme values themselves, so a token that drifts below the floor fails a gate
 * instead of aging quietly in a comment.
 *
 * WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text and for the boundary of
 * a control a person must be able to find.
 */

const AA_TEXT = 4.5;
const AA_LARGE = 3;

type Rgb = readonly [number, number, number];
type Scheme = 'light' | 'dark';

const RGB = /^rgb\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)(?: \/ (\d+(?:\.\d+)?)%)?\)$/;

/**
 * A colour's sRGB channels. A TRANSLUCENT colour has no contrast until it is
 * laid on something, so one with alpha is refused here: say what it sits on
 * with `over()`, or measure its own colour with `opaque()`.
 */
function channels(color: string): Rgb {
  if (color.startsWith('#')) {
    const value = color.slice(1);
    const full =
      value.length === 3
        ? value
            .split('')
            .map((c) => c + c)
            .join('')
        : value;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ];
  }
  const match = RGB.exec(color);
  if (match === null || match[4] !== undefined) {
    throw new Error(`contrast needs an opaque colour, got ${color}: use over() or opaque()`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** A translucent colour composited over an opaque ground, as the eye sees it. */
function over(color: string, ground: string): string {
  const match = RGB.exec(color);
  if (match?.[4] === undefined) {
    return color;
  }
  const alpha = Number(match[4]) / 100;
  const base = channels(ground);
  const mixed = [match[1], match[2], match[3]].map(
    (channel, index) => Number(channel) * alpha + (base[index] ?? 0) * (1 - alpha),
  );
  return `rgb(${mixed.join(' ')})`;
}

/** A translucent colour's own colour at full strength. */
function opaque(color: string): string {
  const match = RGB.exec(color);
  return match === null ? color : `rgb(${[match[1], match[2], match[3]].join(' ')})`;
}

function luminance(color: string): number {
  const linear = channels(color).map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Every pairing the chrome actually paints, named by where it appears. */
function pairings(theme: ChromeTheme) {
  return [
    { name: 'body text on surface', fg: theme['panel-text'], bg: theme.surface, floor: AA_TEXT },
    { name: 'body text on panel', fg: theme['panel-text'], bg: theme.panel, floor: AA_TEXT },
    { name: 'soft text on panel', fg: theme['panel-text-soft'], bg: theme.panel, floor: AA_TEXT },
    { name: 'muted caption on panel', fg: theme['panel-muted'], bg: theme.panel, floor: AA_TEXT },
    {
      name: 'muted caption on surface',
      fg: theme['panel-muted'],
      bg: theme.surface,
      floor: AA_TEXT,
    },
    { name: 'accent text on surface', fg: theme.accent, bg: theme.surface, floor: AA_TEXT },
    {
      name: 'accent text on its soft fill',
      fg: theme.accent,
      bg: theme['accent-soft'],
      floor: AA_TEXT,
    },
    {
      name: 'label on the accent fill',
      fg: theme['accent-text'],
      bg: theme.accent,
      floor: AA_TEXT,
    },
    { name: 'danger on surface', fg: theme.danger, bg: theme.surface, floor: AA_TEXT },
    { name: 'danger on its soft fill', fg: theme.danger, bg: theme['danger-soft'], floor: AA_TEXT },
    {
      name: 'warning on its soft fill',
      fg: theme.warning,
      bg: theme['warning-soft'],
      floor: AA_TEXT,
    },
    {
      name: 'success on its soft fill',
      fg: theme.success,
      bg: theme['success-soft'],
      floor: AA_TEXT,
    },
    { name: 'rail label on the rail', fg: theme['rail-text'], bg: theme.rail, floor: AA_TEXT },
    {
      name: 'active rail label on the rail',
      fg: theme['rail-text-strong'],
      bg: theme.rail,
      floor: AA_TEXT,
    },
    // Non-text: a person has to SEE the selection outline and the focus ring.
    { name: 'selection outline on ground', fg: theme.selection, bg: theme.ground, floor: AA_LARGE },
    { name: 'focus ring on surface', fg: theme['focus-ring'], bg: theme.surface, floor: AA_LARGE },
    { name: 'focus ring on panel', fg: theme['focus-ring'], bg: theme.panel, floor: AA_LARGE },
    {
      name: 'field border on panel',
      fg: theme['panel-border-strong'],
      bg: theme.panel,
      floor: AA_LARGE,
    },
  ];
}

/**
 * What a pair must do, per design SPEC §2.1.
 *
 *  - `text` — 4.5:1, WCAG 1.4.3.
 *  - `ui` — 3:1, WCAG 1.4.11: a boundary, a node, a stroke a person must find.
 *  - `decorative` — no floor, and on purpose: the pencil spine, the Halo and
 *    the bubble's Tint carry no state of their own. The state lives in the
 *    node glyph (a Rule ring at 3.28) and in the row's accessible name.
 *  - `forbidden` — fails text AA in at least one theme, so it is never painted
 *    in EITHER (a component cannot know which theme it is drawn in); the rule
 *    is Graphite for secondary text on Tint or Mist. `coverage.test.ts` fails
 *    any stylesheet rule that paints one.
 *  - `haloed` — fails 3:1 alone, and passes because every stage stroke carries
 *    the white `stage-halo` on its inner side: the HALO must hold 3:1 there.
 */
type Requirement = 'text' | 'ui' | 'decorative' | 'forbidden' | 'haloed';

interface PanelPair {
  readonly name: string;
  readonly fg: (theme: ChromeTheme, scheme: Scheme) => string;
  readonly bg: (theme: ChromeTheme, scheme: Scheme) => string;
  readonly requirement: Requirement;
  /**
   * SPEC §2.1's own figure, `[light, dark]`, or `null` for a pair measured
   * here beyond the spec. Checked to two decimals, so the spec's table and the
   * tokens cannot drift apart without this gate saying which moved.
   */
  readonly specified: readonly [number, number] | null;
}

/**
 * Sample PAGES, not chrome. Stage marks are drawn on the person's page, which
 * can be any colour; these are the grounds SPEC §2.1 measured them against: a
 * white page, a common dark one (#111827), and the darkest possible.
 */
const PAGE = { white: '#ffffff', dark: '#111827', black: '#000000' } as const;

const token =
  (name: keyof ChromeTheme) =>
  (theme: ChromeTheme): string =>
    theme[name];

/** Every pair in SPEC §2.1's contrast table, in its order, plus the veil's worst cases. */
const PANEL_PAIRS: readonly PanelPair[] = [
  {
    name: 'Ink on Paper',
    fg: token('panel-text'),
    bg: token('panel'),
    requirement: 'text',
    specified: [16.67, 16.59],
  },
  {
    name: 'Ink on Sheet',
    fg: token('panel-text'),
    bg: token('surface'),
    requirement: 'text',
    specified: [17.23, 15.11],
  },
  {
    name: 'Ink on Tint (bubble)',
    fg: token('panel-text'),
    bg: token('surface-tint'),
    requirement: 'text',
    specified: [14.84, 13.49],
  },
  {
    name: 'Ink on Mist (selected row)',
    fg: token('panel-text'),
    bg: token('accent-soft'),
    requirement: 'text',
    specified: [14.99, 13.12],
  },
  {
    name: 'Graphite on Paper',
    fg: token('panel-text-soft'),
    bg: token('panel'),
    requirement: 'text',
    specified: [7.24, 12.22],
  },
  {
    name: 'Graphite on Sheet',
    fg: token('panel-text-soft'),
    bg: token('surface'),
    requirement: 'text',
    specified: [7.48, 11.14],
  },
  {
    name: 'Graphite on Tint',
    fg: token('panel-text-soft'),
    bg: token('surface-tint'),
    requirement: 'text',
    specified: [6.45, 9.94],
  },
  {
    name: 'Graphite on Mist',
    fg: token('panel-text-soft'),
    bg: token('accent-soft'),
    requirement: 'text',
    specified: [6.51, 9.67],
  },
  {
    // Tight in light: Slate is never set smaller than 12px Latin / 13px Arabic.
    name: 'Slate on Paper',
    fg: token('panel-muted'),
    bg: token('panel'),
    requirement: 'text',
    specified: [4.54, 7.2],
  },
  {
    name: 'Slate on Sheet (placeholder)',
    fg: token('panel-muted'),
    bg: token('surface'),
    requirement: 'text',
    specified: [4.69, 6.56],
  },
  {
    name: 'Slate on Tint',
    fg: token('panel-muted'),
    bg: token('surface-tint'),
    requirement: 'forbidden',
    specified: [4.04, 5.85],
  },
  {
    name: 'Slate on Mist',
    fg: token('panel-muted'),
    bg: token('accent-soft'),
    requirement: 'forbidden',
    specified: [4.08, 5.69],
  },
  {
    name: 'Indigo on Paper (text buttons, links)',
    fg: token('accent'),
    bg: token('panel'),
    requirement: 'text',
    specified: [5.19, 5.81],
  },
  {
    name: 'Indigo on Sheet',
    fg: token('accent'),
    bg: token('surface'),
    requirement: 'text',
    specified: [5.37, 5.29],
  },
  {
    name: 'Indigo deep on Mist (active option text)',
    fg: token('accent-strong'),
    bg: token('accent-soft'),
    requirement: 'text',
    specified: [5.99, 6.82],
  },
  {
    name: 'On-accent on Indigo (primary button)',
    fg: token('accent-text'),
    bg: token('accent'),
    requirement: 'text',
    specified: [5.37, 5.81],
  },
  {
    name: 'Alarm on Paper',
    fg: token('danger'),
    bg: token('panel'),
    requirement: 'text',
    specified: [6.26, 5.03],
  },
  {
    name: 'Alarm on Sheet',
    fg: token('danger'),
    bg: token('surface'),
    requirement: 'text',
    specified: [6.47, 4.58],
  },
  {
    name: 'Amber on Paper',
    fg: token('warning'),
    bg: token('panel'),
    requirement: 'text',
    specified: [4.86, 8.81],
  },
  {
    name: 'Amber on Sheet',
    fg: token('warning'),
    bg: token('surface'),
    requirement: 'text',
    specified: [5.02, 8.02],
  },
  {
    name: 'Rule on Paper (waiting ring)',
    fg: token('panel-border-strong'),
    bg: token('panel'),
    requirement: 'ui',
    specified: [3.28, 3.32],
  },
  {
    name: 'Rule on Sheet (composer border)',
    fg: token('panel-border-strong'),
    bg: token('surface'),
    requirement: 'ui',
    specified: [3.39, 3.02],
  },
  {
    name: 'Indigo on Paper (landed node, ink, drafted ring)',
    fg: token('accent'),
    bg: token('panel'),
    requirement: 'ui',
    specified: [5.19, 5.81],
  },
  {
    // The light is Indigo in light and Indigo deep in dark: plain Indigo on the
    // dark Halo would read as the same stroke.
    name: 'Travelling light on Halo',
    fg: (theme, scheme) => (scheme === 'light' ? theme.accent : theme['accent-strong']),
    bg: token('accent-ring'),
    requirement: 'ui',
    specified: [3.3, 3.99],
  },
  {
    name: 'Track on Paper (pencil spine)',
    fg: token('progress-track'),
    bg: token('panel'),
    requirement: 'decorative',
    specified: [1.53, 1.87],
  },
  {
    name: 'Halo on Paper',
    fg: token('accent-ring'),
    bg: token('panel'),
    requirement: 'decorative',
    specified: [1.57, 2.16],
  },
  {
    name: 'Tint vs Paper (bubble shape)',
    fg: token('surface-tint'),
    bg: token('panel'),
    requirement: 'decorative',
    specified: [1.12, 1.23],
  },
  // ── Stage (phase 2): one value in every theme, so one figure twice ──────
  {
    // SPEC §2.1 measures the veil's own colour; the two rows after it measure
    // what the eye actually sees, the 94% veil laid over a page.
    name: 'Stage ink on stage veil',
    fg: token('stage-ink'),
    bg: (theme) => opaque(theme['stage-veil']),
    requirement: 'text',
    specified: [6.98, 6.98],
  },
  {
    name: 'Stage ink on the veil over a white page',
    fg: token('stage-ink'),
    bg: (theme) => over(theme['stage-veil'], PAGE.white),
    requirement: 'text',
    specified: null,
  },
  {
    name: 'Stage ink on the veil over a black page',
    fg: token('stage-ink'),
    bg: (theme) => over(theme['stage-veil'], PAGE.black),
    requirement: 'text',
    specified: null,
  },
  {
    name: 'Stage accent on stage veil',
    fg: token('stage-accent'),
    bg: (theme) => opaque(theme['stage-veil']),
    requirement: 'ui',
    specified: [5.01, 5.01],
  },
  {
    name: 'Stage accent on the veil over a white page',
    fg: token('stage-accent'),
    bg: (theme) => over(theme['stage-veil'], PAGE.white),
    requirement: 'ui',
    specified: null,
  },
  {
    name: 'Stage accent on the veil over a black page',
    fg: token('stage-accent'),
    bg: (theme) => over(theme['stage-veil'], PAGE.black),
    requirement: 'ui',
    specified: null,
  },
  {
    name: 'Stage accent on a white page',
    fg: token('stage-accent'),
    bg: () => PAGE.white,
    requirement: 'ui',
    specified: [5.37, 5.37],
  },
  {
    name: 'Stage accent on a #111827 page',
    fg: token('stage-accent'),
    bg: () => PAGE.dark,
    requirement: 'ui',
    specified: [3.3, 3.3],
  },
  {
    name: 'Stage accent on a black page',
    fg: token('stage-accent'),
    bg: () => PAGE.black,
    requirement: 'ui',
    specified: [3.91, 3.91],
  },
  {
    name: 'Stage danger on a white page',
    fg: token('stage-danger'),
    bg: () => PAGE.white,
    requirement: 'ui',
    specified: [6.47, 6.47],
  },
  {
    name: 'Stage danger on a #111827 page',
    fg: token('stage-danger'),
    bg: () => PAGE.dark,
    requirement: 'haloed',
    specified: [2.74, 2.74],
  },
  {
    name: 'Stage halo on a #111827 page',
    fg: token('stage-halo'),
    bg: () => PAGE.dark,
    requirement: 'ui',
    specified: [17.74, 17.74],
  },
  {
    name: 'On-accent on stage accent (tag text)',
    fg: token('stage-on-accent'),
    bg: token('stage-accent'),
    requirement: 'text',
    specified: [5.37, 5.37],
  },
];

const REQUIREMENT_LABEL: Readonly<Record<Requirement, string>> = {
  text: 'text 4.5',
  ui: 'UI 3.0',
  decorative: 'decorative',
  forbidden: 'forbidden, never used',
  haloed: 'halo 3.0',
};

/** Whether a pair meets its requirement in this theme. */
function meets(pair: PanelPair, theme: ChromeTheme, scheme: Scheme, ratio: number): boolean {
  switch (pair.requirement) {
    case 'text':
      return ratio >= AA_TEXT;
    case 'ui':
      return ratio >= AA_LARGE;
    case 'haloed':
      return contrast(theme['stage-halo'], pair.bg(theme, scheme)) >= AA_LARGE;
    // No floor to meet. What these rows must do is match the spec's figure,
    // and for a forbidden pair, never be painted (coverage.test.ts).
    case 'decorative':
    case 'forbidden':
      return true;
  }
}

/**
 * A pair drawn with no glyphs: the ground, and the ink as a node and a stroke,
 * the spine's own grammar. Text here would be real text at the pair's ratio,
 * and the report shows failing pairs on purpose (see `textBelowAA`). The row's
 * name carries the meaning, so the swatch is hidden from assistive tech. The
 * hairline edge keeps a ground that equals the report's own surface visible.
 */
function swatch(fg: string, bg: string, edge: string) {
  return (
    <span
      aria-hidden="true"
      data-testid="swatch"
      style={{
        alignItems: 'center',
        background: bg,
        blockSize: '20px',
        borderRadius: '4px',
        boxShadow: `inset 0 0 0 1px ${edge}`,
        boxSizing: 'border-box',
        display: 'inline-flex',
        gap: '4px',
        inlineSize: '64px',
        paddingInline: '6px',
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{ background: fg, blockSize: '8px', borderRadius: '999px', inlineSize: '8px' }}
      />
      <span style={{ background: fg, blockSize: '3px', borderRadius: '2px', flex: 1 }} />
    </span>
  );
}

function Report({ theme, name }: { theme: ChromeTheme; name: Scheme }) {
  const rows = pairings(theme);
  const cell = {
    borderBlockStart: `1px solid ${theme['panel-border']}`,
    padding: '6px 8px',
  } as const;
  const figure = {
    ...cell,
    fontFamily: theme['font-mono'],
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'end',
  } as const;
  const head = { padding: '5px 8px', textAlign: 'start' } as const;
  const headEnd = { padding: '5px 8px', textAlign: 'end' } as const;
  const specIndex = name === 'light' ? 0 : 1;

  return (
    <div
      className="bldr-root"
      data-testid={`contrast-${name}`}
      style={{
        background: theme.surface,
        color: theme['panel-text'],
        fontFamily: theme.font,
        padding: '24px',
      }}
    >
      <h2 style={{ font: `600 15px/1.2 ${theme.font}`, margin: '0 0 4px' }}>{name}</h2>
      <p
        style={{
          color: theme['panel-muted'],
          font: `400 12px/1.5 ${theme.font}`,
          margin: '0 0 18px',
        }}
      >
        {rows.length} pairings · {CHROME_TOKENS.length} tokens in the contract
      </p>
      <table style={{ borderCollapse: 'collapse', fontSize: '12px', inlineSize: '100%' }}>
        <thead>
          <tr style={{ color: theme['panel-muted'], textAlign: 'start' }}>
            <th style={head}>Pairing</th>
            <th style={head}>Sample</th>
            <th style={headEnd}>Ratio</th>
            <th style={headEnd}>Floor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ratio = contrast(row.fg, row.bg);
            const passes = ratio >= row.floor;
            return (
              <tr key={row.name} data-testid={`row-${name}`} data-passes={String(passes)}>
                <td style={cell}>{row.name}</td>
                <td style={cell}>{swatch(row.fg, row.bg, theme['panel-border'])}</td>
                <td style={{ ...figure, color: passes ? theme.success : theme.danger }}>
                  {ratio.toFixed(2)}
                </td>
                <td style={{ ...figure, color: theme['panel-muted'] }}>{row.floor.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 style={{ font: `600 13px/1.4 ${theme.font}`, margin: '28px 0 4px' }}>
        Agent panel, design SPEC §2.1
      </h3>
      <p
        style={{
          color: theme['panel-muted'],
          font: `400 12px/1.5 ${theme.font}`,
          margin: '0 0 12px',
        }}
      >
        {PANEL_PAIRS.length} pairs. Forbidden pairs are shown so the reason is visible; no
        stylesheet may paint one.
      </p>
      <table style={{ borderCollapse: 'collapse', fontSize: '12px', inlineSize: '100%' }}>
        <thead>
          <tr style={{ color: theme['panel-muted'] }}>
            <th style={head}>Pair</th>
            <th style={head}>Sample</th>
            <th style={headEnd}>Ratio</th>
            <th style={headEnd}>SPEC</th>
            <th style={headEnd}>Needs</th>
          </tr>
        </thead>
        <tbody>
          {PANEL_PAIRS.map((pair) => {
            const fg = pair.fg(theme, name);
            const bg = pair.bg(theme, name);
            const ratio = contrast(fg, bg);
            const specified = pair.specified?.[specIndex] ?? null;
            const matchesSpec = specified === null || Math.abs(ratio - specified) <= 0.01;
            const passes = meets(pair, theme, name, ratio);
            return (
              <tr
                key={pair.name}
                data-testid={`panel-row-${name}`}
                data-matches-spec={String(matchesSpec)}
                data-passes={String(passes)}
                data-ratio={ratio.toFixed(3)}
                data-requirement={pair.requirement}
              >
                <td style={cell}>{pair.name}</td>
                <td style={cell}>{swatch(fg, bg, theme['panel-border'])}</td>
                <td style={{ ...figure, color: passes ? theme.success : theme.danger }}>
                  {ratio.toFixed(2)}
                </td>
                <td style={{ ...figure, color: matchesSpec ? theme['panel-muted'] : theme.danger }}>
                  {specified === null ? 'beyond' : specified.toFixed(2)}
                </td>
                <td style={{ ...cell, color: theme['panel-muted'], textAlign: 'end' }}>
                  {REQUIREMENT_LABEL[pair.requirement]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const meta = {
  title: 'Builder/Theme/Contrast',
  component: Report,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Report>;

export default meta;
type Story = StoryObj<typeof meta>;

const COMPUTED =
  /^rgba?\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)(?:, (\d+(?:\.\d+)?))?\)$/;

/** A computed colour as `rgb(r g b)` plus its alpha, which `contrast()` reads. */
function computedColor(value: string): { readonly rgb: string; readonly alpha: number } {
  const [, red, green, blue, alpha] = COMPUTED.exec(value) ?? [];
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`unreadable computed colour ${value}`);
  }
  return { rgb: `rgb(${red} ${green} ${blue})`, alpha: alpha === undefined ? 1 : Number(alpha) };
}

/**
 * Every run of text the report paints, with its contrast against the first
 * painted ground behind it: the measurement axe's `color-contrast` rule makes.
 *
 * The report SHOWS pairs that fail on purpose (the forbidden ones at 4.04, the
 * decorative ones down to 1.12, the UI ones that only need 3:1). Drawn as the
 * word "Sample" they were real sub-AA text, and the project's `a11y: { test:
 * 'error' }` would fail this story the day axe runs under vitest, with the
 * tokens right. Measured with the a11y annotations applied: axe's
 * color-contrast flagged every such sample, and passes the swatches. So a pair
 * is drawn with no glyphs, and this proves the report's own text, the only
 * text left, holds 4.5 in both themes whether or not axe runs.
 */
function textBelowAA(root: HTMLElement): string[] {
  const failures: string[] = [];
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    const text = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join('')
      .trim();
    if (text === '') {
      continue;
    }
    const ink = computedColor(getComputedStyle(element).color);
    let ground: string | null = null;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const fill = computedColor(getComputedStyle(node).backgroundColor);
      if (fill.alpha === 0) {
        continue;
      }
      if (fill.alpha < 1 || ink.alpha < 1) {
        throw new Error(`"${text}" sits on a translucent colour; measure it with over()`);
      }
      ground = fill.rgb;
      break;
    }
    if (ground === null) {
      throw new Error(`"${text}" has no painted ground inside the report`);
    }
    const ratio = contrast(ink.rgb, ground);
    if (ratio < AA_TEXT) {
      failures.push(`${text}: ${ratio.toFixed(2)}`);
    }
  }
  return failures;
}

async function assertNoSubAAText(canvasElement: HTMLElement): Promise<void> {
  await expect(textBelowAA(canvasElement)).toEqual([]);
  // Non-vacuous: every pair in both tables is still shown, as a swatch with no
  // glyph in it, rather than the failing pairs simply dropped from the report.
  const swatches = [...canvasElement.querySelectorAll('[data-testid="swatch"]')];
  await expect(swatches).toHaveLength(pairings(lightChromeTheme).length + PANEL_PAIRS.length);
  for (const sample of swatches) {
    await expect(sample.getAttribute('aria-hidden')).toBe('true');
    await expect(sample.textContent).toBe('');
  }
}

async function assertPanelPairs(canvasElement: HTMLElement, scheme: Scheme): Promise<void> {
  const rows = [...canvasElement.querySelectorAll(`[data-testid="panel-row-${scheme}"]`)];
  // Non-vacuous: every SPEC §2.1 row, plus the veil's four worst cases.
  await expect(rows).toHaveLength(PANEL_PAIRS.length);
  await expect(rows.length).toBeGreaterThan(35);

  const below = rows
    .filter((row) => row.getAttribute('data-passes') === 'false')
    .map((row) => row.textContent);
  await expect(below).toEqual([]);

  const drifted = rows
    .filter((row) => row.getAttribute('data-matches-spec') === 'false')
    .map((row) => row.textContent);
  await expect(drifted).toEqual([]);
}

export const Light: Story = {
  args: { theme: lightChromeTheme, name: 'light' },
  play: async ({ canvasElement }) => {
    const rows = [...canvasElement.querySelectorAll('[data-testid="row-light"]')];
    // Non-vacuous: an empty table would otherwise pass this gate silently.
    await expect(rows.length).toBeGreaterThan(15);
    const failing = rows
      .filter((row) => row.getAttribute('data-passes') === 'false')
      .map((row) => row.textContent);
    await expect(failing).toEqual([]);

    await assertPanelPairs(canvasElement, 'light');
    await assertNoSubAAText(canvasElement);

    // The forbidden pairs are forbidden BECAUSE of the light theme: each one
    // fails text AA here. If a ramp change lifts them over 4.5, this fails, and
    // the prohibition becomes a decision to revisit rather than a stale rule.
    const forbidden = [
      ...canvasElement.querySelectorAll(
        '[data-testid="panel-row-light"][data-requirement="forbidden"]',
      ),
    ];
    await expect(forbidden).toHaveLength(2);
    for (const row of forbidden) {
      await expect(Number(row.getAttribute('data-ratio'))).toBeLessThan(AA_TEXT);
    }
  },
};

export const Dark: Story = {
  args: { theme: darkChromeTheme, name: 'dark' },
  play: async ({ canvasElement }) => {
    const rows = [...canvasElement.querySelectorAll('[data-testid="row-dark"]')];
    await expect(rows.length).toBeGreaterThan(15);
    const failing = rows
      .filter((row) => row.getAttribute('data-passes') === 'false')
      .map((row) => row.textContent);
    await expect(failing).toEqual([]);

    await assertPanelPairs(canvasElement, 'dark');
    await assertNoSubAAText(canvasElement);
  },
};

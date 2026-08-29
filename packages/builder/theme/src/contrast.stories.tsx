import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { CHROME_TOKENS, darkChromeTheme, lightChromeTheme, type ChromeTheme } from './index';

/**
 * CONTRAST, MEASURED — not asserted in a comment.
 *
 * Every theme file in this repo used to carry a table of ratios in its header.
 * A table is a claim: it is written once, and the next person to nudge a ramp
 * has no way to know they broke it. This story computes the ratios from the
 * values the browser actually resolves, so a token that drifts below the floor
 * fails a gate instead of aging quietly in a comment.
 *
 * WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text and for the boundary of
 * a control a person must be able to find.
 */

const AA_TEXT = 4.5;
const AA_LARGE = 3;

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
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

function luminance(hex: string): number {
  const linear = channels(hex).map((channel) => {
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

function Report({ theme, name }: { theme: ChromeTheme; name: string }) {
  const rows = pairings(theme);
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
            <th style={{ padding: '5px 8px', textAlign: 'start' }}>Pairing</th>
            <th style={{ padding: '5px 8px', textAlign: 'start' }}>Sample</th>
            <th style={{ padding: '5px 8px', textAlign: 'end' }}>Ratio</th>
            <th style={{ padding: '5px 8px', textAlign: 'end' }}>Floor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ratio = contrast(row.fg, row.bg);
            const passes = ratio >= row.floor;
            return (
              <tr key={row.name} data-testid={`row-${name}`} data-passes={String(passes)}>
                <td
                  style={{
                    borderBlockStart: `1px solid ${theme['panel-border']}`,
                    padding: '6px 8px',
                  }}
                >
                  {row.name}
                </td>
                <td
                  style={{
                    borderBlockStart: `1px solid ${theme['panel-border']}`,
                    padding: '6px 8px',
                  }}
                >
                  <span
                    style={{
                      background: row.bg,
                      borderRadius: '4px',
                      color: row.fg,
                      padding: '3px 8px',
                    }}
                  >
                    Sample
                  </span>
                </td>
                <td
                  style={{
                    borderBlockStart: `1px solid ${theme['panel-border']}`,
                    color: passes ? theme.success : theme.danger,
                    fontFamily: theme['font-mono'],
                    fontVariantNumeric: 'tabular-nums',
                    padding: '6px 8px',
                    textAlign: 'end',
                  }}
                >
                  {ratio.toFixed(2)}
                </td>
                <td
                  style={{
                    borderBlockStart: `1px solid ${theme['panel-border']}`,
                    color: theme['panel-muted'],
                    fontFamily: theme['font-mono'],
                    padding: '6px 8px',
                    textAlign: 'end',
                  }}
                >
                  {row.floor.toFixed(1)}
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
  },
};

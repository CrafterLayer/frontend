/**
 * DirectionLine (SPEC §4.8): the page's direction on one read-only line.
 *
 * Seen, it is five swatches of the page's own colours, the mood, and (from 400px) the fonts.
 * Heard, it is one sentence from the catalog that names each colour by its role, because a
 * row of coloured squares means nothing read aloud. It says only what it has: prose alone
 * before the engine sends structured direction (SPEC §7.6 E7).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { t } from '../../copy';
import type { DirectionView } from '../../model/view-types';
import { DIRECTION, DIRECTION_PROSE } from '../../testing/wp-12-records-fixtures';

import { DirectionLine } from './DirectionLine';

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'DirectionLine',
    'DirectionLine.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const COLORS_EN =
  'Background #FBFBFD, Surface #FFFFFF, Text #0E1116, Accent #0F766E, and Text on accent #FFFFFF';

describe('DirectionLine', () => {
  it('draws five swatches in role order, whatever order the view gives them', () => {
    const shuffled: DirectionView = {
      ...DIRECTION.en,
      swatches: [...(DIRECTION.en.swatches ?? [])].reverse(),
    };
    const { container } = render(<DirectionLine locale="en" direction={shuffled} />);
    const swatches = [...container.querySelectorAll<HTMLElement>('.ck-agent-direction__swatch')];
    expect(swatches.map((swatch) => swatch.dataset['role'])).toEqual([
      'background',
      'surface',
      'text',
      'accent',
      'onAccent',
    ]);
    // The page's colour, as content; the ring and size are the stylesheet's.
    expect(swatches[3]).toHaveStyle({ backgroundColor: '#0F766E' });
  });

  it('is heard as one sentence naming the mood, each colour by its role, and the fonts', () => {
    const { container } = render(<DirectionLine locale="en" direction={DIRECTION.en} />);
    expect(container.querySelector('.ck-agent-direction__visual')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    const sentence = t('en', 'direction.aria', {
      mood: 'Calm, clinical, teal',
      colors: COLORS_EN,
      fonts: 'Reem Kufi / IBM Plex Sans',
    });
    expect(screen.getByText(sentence)).toHaveClass('bldr-visually-hidden');
  });

  it('says only what it has: the prose alone before structured direction', () => {
    const { container } = render(<DirectionLine locale="en" direction={DIRECTION_PROSE.en} />);
    expect(container.querySelector('.ck-agent-direction__swatch')).toBeNull();
    expect(container.querySelector('.ck-agent-direction__fonts')).toBeNull();
    expect(
      screen.getByText(t('en', 'direction.aria.mood', { mood: DIRECTION_PROSE.en.mood })),
    ).toBeInTheDocument();
  });

  it('says the colours without fonts, and the fonts without colours', () => {
    const { rerender } = render(
      <DirectionLine locale="en" direction={{ ...DIRECTION.en, fonts: undefined }} />,
    );
    expect(
      screen.getByText(
        t('en', 'direction.aria.colors', { mood: 'Calm, clinical, teal', colors: COLORS_EN }),
      ),
    ).toBeInTheDocument();
    rerender(
      <DirectionLine locale="en" direction={{ ...DIRECTION.en, swatches: undefined }} />,
    );
    expect(
      screen.getByText(
        t('en', 'direction.aria.fonts', {
          mood: 'Calm, clinical, teal',
          fonts: 'Reem Kufi / IBM Plex Sans',
        }),
      ),
    ).toBeInTheDocument();
  });

  it('speaks Arabic in Arabic, with the Arabic list and role names', () => {
    render(<DirectionLine locale="ar" direction={DIRECTION.ar} />);
    expect(
      screen.getByText(
        (text) => text.startsWith('الأسلوب: هادئ، طبّي، فيروزي. الألوان: الخلفية #FBFBFD'),
      ),
    ).toBeInTheDocument();
  });

  it('keeps the font pair a Latin island, its slash in place inside Arabic', () => {
    const { container } = render(<DirectionLine locale="ar" direction={DIRECTION.ar} />);
    expect(container.querySelector('.ck-agent-direction__fonts')).toHaveAttribute('dir', 'ltr');
  });
});

describe('DirectionLine.css', () => {
  it('draws 12px swatches, radius 4, 2px apart, inside the content-outline ring', () => {
    expect(CSS).toMatch(/inline-size:\s*var\(--bldr-space-xl\)/);
    expect(CSS).toMatch(/border-radius:\s*var\(--bldr-radius-xs\)/);
    expect(CSS).toMatch(/gap:\s*var\(--bldr-space-2xs\)/);
    expect(CSS).toMatch(
      /box-shadow:\s*inset 0 0 0 var\(--bldr-border-hairline\) var\(--bldr-content-outline\)/,
    );
  });

  it('shows the fonts only from 400px', () => {
    expect(CSS).toMatch(
      /@container agent \(min-width: 400px\) \{\s*\.ck-agent-direction__fonts \{\s*display: block;/,
    );
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});

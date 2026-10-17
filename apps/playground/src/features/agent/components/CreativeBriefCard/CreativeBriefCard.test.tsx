/**
 * CreativeBriefCard (creative agent, 2026-10-12): the plan a game or story build was written
 * from. A named region with a description list; the genre in catalog copy, libraries and
 * effects as left-to-right code, the cast with the bible's colours as decorative dots; no
 * live region; and a stylesheet of builder tokens through logical properties.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { CAST_BRIEFS, plannedBrief } from '../../testing/creative-fixtures';

import { CreativeBriefCard } from './CreativeBriefCard';

const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];
const LIVE = '[aria-live], [role=status], [role=log], [role=alert]';

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'CreativeBriefCard',
    'CreativeBriefCard.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

describe('CreativeBriefCard', () => {
  it('is a region named by its heading, in both locales', () => {
    for (const locale of LOCALES) {
      const { unmount } = render(
        <CreativeBriefCard locale={locale} brief={plannedBrief(locale)} />,
      );
      const region = screen.getByRole('region', { name: t(locale, 'brief.title') });
      expect(within(region).getByRole('heading', { level: 4 })).toHaveTextContent(
        t(locale, 'brief.title'),
      );
      expect(region).toHaveTextContent(t(locale, 'brief.caption'));
      unmount();
    }
  });

  it('names the genre in the catalog’s words, never the planner’s id', () => {
    const { container } = render(<CreativeBriefCard locale="ar" brief={plannedBrief('ar')} />);
    const terms = [...container.querySelectorAll('dt')].map((node) => node.textContent);
    expect(terms[0]).toBe(t('ar', 'brief.genre'));
    expect(container.querySelector('dd')).toHaveTextContent(t('ar', 'brief.genre.platformer'));
    expect(container).not.toHaveTextContent('platformer');
  });

  it('shows libraries and effects as left-to-right code chips', () => {
    const brief = plannedBrief('ar');
    const { container } = render(<CreativeBriefCard locale="ar" brief={brief} />);
    const chips = [...container.querySelectorAll('code.ck-agent-brief__chip')];
    expect(chips.map((chip) => chip.textContent)).toEqual([...brief.libs, ...brief.effects]);
    for (const chip of chips) expect(chip).toHaveAttribute('dir', 'ltr');
  });

  it('lists the cast with each bible colour as a decorative dot, names isolated in <bdi>', () => {
    const { container } = render(<CreativeBriefCard locale="ar" brief={CAST_BRIEFS.ar} />);
    const characters = container.querySelectorAll('.ck-agent-brief__character');
    expect(characters).toHaveLength(2);
    const dot = characters[0]?.querySelector('.ck-agent-brief__dot');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).toHaveStyle({ backgroundColor: '#f59e0b' });
    expect(characters[0]?.querySelector('bdi')).toHaveTextContent('ليلى');
    expect(characters[0]).toHaveTextContent('البطلة');
  });

  it('names the planner’s roles in the panel’s words, and keeps the bible’s own', () => {
    const { container } = render(
      <CreativeBriefCard
        locale="ar"
        brief={{
          genre: 'platformer',
          libs: [],
          effects: [],
          cast: [
            { id: 'rumi', name: 'رومي', role: 'hero' },
            { id: 'sami', name: 'سامي', role: 'supporting' },
            { id: 'lina', name: 'لينا', role: 'الساحرة' },
          ],
        }}
      />,
    );
    const roles = [...container.querySelectorAll('.ck-agent-brief__role')].map(
      (node) => node.textContent,
    );
    expect(roles).toEqual([
      t('ar', 'brief.role.hero'),
      t('ar', 'brief.role.supporting'),
      'الساحرة',
    ]);
    expect(container).not.toHaveTextContent('hero');
  });

  it('leaves out a fact the brief does not hold', () => {
    const { container } = render(
      <CreativeBriefCard locale="en" brief={{ genre: 'mural', libs: [], effects: [], cast: [] }} />,
    );
    expect(container.querySelectorAll('dt')).toHaveLength(1);
    expect(container.querySelector('dd')).toHaveTextContent(t('en', 'brief.genre.mural'));
  });

  it('is never a live region, and its glyph is decoration', () => {
    const { container } = render(<CreativeBriefCard locale="en" brief={CAST_BRIEFS.en} />);
    expect(container.querySelectorAll(LIVE)).toHaveLength(0);
    expect(container.querySelector('.ck-agent-brief__glyph')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(container.querySelector('.ck-agent-brief')).toHaveAttribute(
      'data-genre',
      'visual-novel',
    );
  });
});

describe('CreativeBriefCard.css', () => {
  it('draws a Hairline card on the Item fill with the large radius', () => {
    expect(CSS).toMatch(
      /\.ck-agent-brief \{[^}]*border:\s*var\(--bldr-border-hairline\) solid var\(--bldr-panel-border\)/u,
    );
    expect(CSS).toMatch(/\.ck-agent-brief \{[^}]*background-color:\s*var\(--bldr-panel-item\)/u);
    expect(CSS).toMatch(/\.ck-agent-brief \{[^}]*border-radius:\s*var\(--bldr-radius-xl\)/u);
  });

  it('sets code chips in the mono face', () => {
    expect(CSS).toMatch(/\.ck-agent-brief__chip \{[^}]*font-family:\s*var\(--bldr-font-mono\)/u);
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
  });
});

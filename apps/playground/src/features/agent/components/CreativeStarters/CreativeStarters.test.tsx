/**
 * CreativeStarters (creative agent, 2026-10-12): three cards that fill the composer with a
 * creative request and never send, and a note that says whether free code is on, offering
 * to turn it on when it is off. A named region, not a live one; tokens-only styles.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { CreativeStarters } from './CreativeStarters';
import { CREATIVE_STARTERS } from './starters';

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
    'CreativeStarters',
    'CreativeStarters.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

describe('CreativeStarters', () => {
  it('offers a game, a story with choices and a bedtime story, in both locales', () => {
    for (const locale of LOCALES) {
      const { unmount } = render(
        <CreativeStarters locale={locale} freeCode={{ enabled: true }} onChoose={vi.fn()} />,
      );
      const region = screen.getByRole('region', { name: t(locale, 'creative.title') });
      expect(within(region).getByText(t(locale, 'creative.badge'))).toBeInTheDocument();
      const cards = within(region).getAllByRole('button');
      expect(cards).toHaveLength(CREATIVE_STARTERS.length);
      CREATIVE_STARTERS.forEach((starter, index) => {
        expect(cards[index]).toHaveTextContent(t(locale, `creative.${starter}`));
        expect(cards[index]).toHaveTextContent(t(locale, `creative.${starter}.detail`));
        expect(cards[index]).toHaveAttribute('data-starter', starter);
      });
      unmount();
    }
  });

  it('fills the composer with the card’s request and never sends: a type=button with its description', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<CreativeStarters locale="ar" freeCode={{ enabled: true }} onChoose={onChoose} />);
    const game = screen.getByRole('button', { name: new RegExp(t('ar', 'creative.game')) });
    expect(game).toHaveAttribute('type', 'button');
    expect(game).toHaveAccessibleDescription(t('ar', 'suggestions.description'));
    await user.click(game);
    expect(onChoose).toHaveBeenCalledWith({
      key: 'creative:game',
      text: t('ar', 'creative.game.prompt'),
      source: 'starter',
    });
  });

  it('says free code is needed while it is off, and turns it on from the note', async () => {
    const user = userEvent.setup();
    const onFreeCodeChange = vi.fn();
    render(
      <CreativeStarters
        locale="en"
        freeCode={{ enabled: false }}
        onChoose={vi.fn()}
        onFreeCodeChange={onFreeCodeChange}
      />,
    );
    expect(screen.getByText(t('en', 'creative.needsFreeCode'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('en', 'creative.enableFreeCode') }));
    expect(onFreeCodeChange).toHaveBeenCalledWith(true);
  });

  it('only explains when there is no way to turn free code on from here', () => {
    render(<CreativeStarters locale="en" freeCode={{ enabled: false }} onChoose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: t('en', 'creative.enableFreeCode') })).toBeNull();
  });

  it('says free code is on once it is, with no button', () => {
    const { container } = render(
      <CreativeStarters
        locale="en"
        freeCode={{ enabled: true }}
        onChoose={vi.fn()}
        onFreeCodeChange={vi.fn()}
      />,
    );
    expect(screen.getByText(t('en', 'creative.freeCodeOn'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('en', 'creative.enableFreeCode') })).toBeNull();
    expect(container.querySelector('.ck-agent-creative__note')).toHaveAttribute('data-on');
  });

  it('is never a live region, and its glyphs are decoration', () => {
    const { container } = render(
      <CreativeStarters locale="en" freeCode={{ enabled: false }} onChoose={vi.fn()} />,
    );
    expect(container.querySelectorAll(LIVE)).toHaveLength(0);
    for (const icon of container.querySelectorAll('.ck-agent-creative__icon')) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

describe('CreativeStarters.css', () => {
  it('lays the cards in three columns, one under a 360px panel', () => {
    expect(CSS).toMatch(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/u);
    expect(CSS).toMatch(
      /@container agent \(inline-size < 360px\)\s*\{\s*\.ck-agent-creative__grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/u,
    );
  });

  it('gives each card a 44px target on a coarse pointer', () => {
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)[\s\S]*min-block-size:\s*var\(--bldr-hit-target-min\)/u,
    );
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

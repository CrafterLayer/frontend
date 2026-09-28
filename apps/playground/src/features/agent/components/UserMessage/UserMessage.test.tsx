/**
 * UserMessage (SPEC §4.5): the person's own request.
 *
 * Held here: it is an article named "Your request"; its words take the direction of the
 * majority of their letters (never `dir="auto"`, which «Hero قسم الخدمات» fools), per line,
 * and the language of their script; the blocks it was sent with form its first line and are
 * not interactive; the default "Whole page" scope is not repeated; a request never run says so.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { t } from '../../copy';
import {
  messageLongLink,
  messageMixed,
  messageNotRun,
  messagePlain,
  messageStaleChip,
  messageWithContext,
} from '../../testing/wp-12-records-fixtures';

import { UserMessage } from './UserMessage';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'UserMessage', 'UserMessage.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('UserMessage', () => {
  it('is an article named as the person’s request, holding their words', () => {
    render(<UserMessage locale="en" view={messagePlain('en')} />);
    const article = screen.getByRole('article', { name: 'Your request' });
    expect(article).toHaveTextContent('A dental clinic page in Amman, WhatsApp booking');
  });

  it('is named in Arabic in the Arabic panel', () => {
    render(<UserMessage locale="ar" view={messagePlain('ar')} />);
    expect(screen.getByRole('article', { name: 'طلبك' })).toBeInTheDocument();
  });

  it('lays Arabic words out right to left in the English panel, in Arabic', () => {
    const { container } = render(<UserMessage locale="en" view={messagePlain('ar')} />);
    const content = container.querySelector('.ck-agent-message__content');
    expect(content).toHaveAttribute('dir', 'rtl');
    expect(content).toHaveAttribute('lang', 'ar');
    // The bubble keeps the panel's direction, so its tail corner faces the right edge.
    expect(container.querySelector('.ck-agent-message__bubble')).not.toHaveAttribute('dir');
  });

  it('is not fooled by a leading Latin word, and orders each line by its own letters', () => {
    const { container } = render(<UserMessage locale="en" view={messageMixed()} />);
    expect(container.querySelector('.ck-agent-message__content')).toHaveAttribute('dir', 'rtl');
    const lines = [...container.querySelectorAll('.ck-agent-message__line')];
    expect(lines.map((line) => line.getAttribute('dir'))).toEqual(['rtl', 'rtl']);
    expect(lines[0]).toHaveTextContent('Hero قسم الخدمات يحتاج صورة أوضح');
  });

  it('shows the blocks it was sent with as its first line, not interactive', () => {
    const { container } = render(<UserMessage locale="en" view={messageWithContext('en')} />);
    const context = container.querySelector('.ck-agent-message__context');
    expect(context).toHaveTextContent('HeroServices');
    expect(screen.queryByRole('button')).toBeNull();
    expect(context?.querySelectorAll('bdi')).toHaveLength(2);
  });

  it('does not repeat the default Whole page scope', () => {
    const { container } = render(<UserMessage locale="en" view={messagePlain('en')} />);
    expect(container.querySelector('.ck-agent-message__context')).toBeNull();
    expect(container).not.toHaveTextContent(t('en', 'scope.page'));
  });

  it('strikes a block that is no longer on the page, and says so in words', () => {
    const { container } = render(<UserMessage locale="en" view={messageStaleChip('en')} />);
    expect(container.querySelector('[data-stale]')).toHaveTextContent('Testimonials');
    expect(screen.getByText(t('en', 'chip.stale'))).toHaveClass('bldr-visually-hidden');
  });

  it('dims a request that never ran, and captions it', () => {
    const { container } = render(<UserMessage locale="en" view={messageNotRun('en')} />);
    expect(container.querySelector('.ck-agent-message')).toHaveAttribute('data-not-run');
    expect(screen.getByText(t('en', 'message.notRun'))).toBeInTheDocument();
  });

  it('keeps a long link in one piece of text the bubble can wrap', () => {
    render(<UserMessage locale="en" view={messageLongLink()} />);
    expect(screen.getByText(/hero-wide-original\.jpg$/u)).toBeInTheDocument();
  });
});

describe('UserMessage.css', () => {
  it('is a Tint bubble, radius 12 with a 4px tail corner at the inline end', () => {
    expect(CSS).toMatch(/background-color:\s*var\(--bldr-surface-tint\)/);
    expect(CSS).toMatch(/border-radius:\s*var\(--bldr-radius-xl\)/);
    expect(CSS).toMatch(/border-end-end-radius:\s*var\(--bldr-radius-xs\)/);
    expect(CSS).toMatch(/justify-items:\s*end/);
  });

  it('is at most 85% wide, 80% from 400px', () => {
    expect(CSS).toMatch(/max-inline-size:\s*85%/);
    expect(CSS).toMatch(/@container agent \(min-width: 400px\) \{\s*\.ck-agent-message__bubble \{\s*max-inline-size: 80%;/);
  });

  it('writes the context line in Graphite, never Slate on the Tint', () => {
    expect(CSS).toMatch(/\.ck-agent-message__context \{[^}]*color:\s*var\(--bldr-panel-text-soft\)/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});

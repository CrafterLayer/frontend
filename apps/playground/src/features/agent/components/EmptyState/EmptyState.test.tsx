/**
 * EmptyState (SPEC §3.1, §4.16): the face at 48px and the character's greeting.
 *
 * The three variants in both locales, the count read through the nominative noun, the
 * selected block's title isolated in `<bdi>`, the face as still decoration, and a
 * stylesheet that sets the greeting in Lead type, start-aligned.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { frameEmptyViews } from '../../testing/wp-11-frame-fixtures';

import { EmptyState } from './EmptyState';

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
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'EmptyState', 'EmptyState.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

function greeting(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>('.ck-agent-empty__greeting');
  if (element === null) throw new Error('no greeting');
  return element;
}

describe('EmptyState', () => {
  it('greets an empty page in the character’s voice, in both locales', () => {
    for (const locale of LOCALES) {
      const { container, unmount } = render(
        <EmptyState locale={locale} view={frameEmptyViews(locale).greeting} />,
      );
      expect(greeting(container)).toHaveTextContent(t(locale, 'empty.greeting'));
      unmount();
    }
    const { container } = render(<EmptyState locale="ar" view={{ kind: 'greeting' }} />);
    expect(greeting(container)).toHaveTextContent(
      'احكيلي عن مشروعك بجملة، وأنا ببنيلك الصفحة كاملة، قسم ورا قسم.',
    );
  });

  it('counts a page’s sections with the noun agreeing, in the nominative', () => {
    const cases = [
      ['ar', 1, 'الصفحة فيها قسم واحد. احكيلي شو بدك نغيّر.'],
      ['ar', 2, 'الصفحة فيها قسمان. احكيلي شو بدك نغيّر.'],
      ['ar', 8, 'الصفحة فيها 8 أقسام. احكيلي شو بدك نغيّر.'],
      ['ar', 12, 'الصفحة فيها 12 قسمًا. احكيلي شو بدك نغيّر.'],
      ['en', 1, 'This page has 1 section. Tell me what to change.'],
      ['en', 8, 'This page has 8 sections. Tell me what to change.'],
    ] as const;
    for (const [locale, sections, text] of cases) {
      const { container, unmount } = render(
        <EmptyState locale={locale} view={{ kind: 'hasContent', sections }} />,
      );
      expect(greeting(container)).toHaveTextContent(text);
      unmount();
    }
  });

  it('names a selected block by its title on the page, isolated in <bdi>', () => {
    const { container } = render(
      <EmptyState locale="ar" view={{ kind: 'selection', title: 'Hero' }} />,
    );
    expect(greeting(container)).toHaveTextContent('محدَّد «Hero». شو بدك نغيّر فيه؟');
    expect(greeting(container).querySelector('bdi')).toHaveTextContent('Hero');
  });

  it('draws the 48px face as still decoration: hidden from readers, not live', () => {
    const { container } = render(<EmptyState locale="en" view={{ kind: 'greeting' }} />);
    const wrapper = container.querySelector('.ck-agent-empty__face');
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    const face = wrapper?.querySelector('.pg-face');
    expect(face).toHaveAttribute('data-size', 'lg');
    expect(face).toHaveAttribute('data-mood', 'idle');
    expect(face).not.toHaveAttribute('data-live');
  });

  it('takes the face’s mood when one is given', () => {
    const { container } = render(
      <EmptyState locale="en" view={{ kind: 'greeting' }} mood="listening" />,
    );
    expect(container.querySelector('.pg-face')).toHaveAttribute('data-mood', 'listening');
  });

  it('is a paragraph, not a heading and not a live region', () => {
    const { container } = render(<EmptyState locale="en" view={{ kind: 'greeting' }} />);
    expect(greeting(container).tagName).toBe('P');
    expect(screen.queryByRole('heading')).toBeNull();
    expect(container.querySelectorAll(LIVE)).toHaveLength(0);
    expect(container.querySelector('.ck-agent-empty')).toHaveAttribute('data-kind', 'greeting');
  });
});

describe('EmptyState.css', () => {
  it('sets the greeting in Lead type, weight 500, Ink, and lets it wrap prettily', () => {
    expect(CSS).toMatch(/font-size:\s*var\(--bldr-font-size-lead\)/u);
    expect(CSS).toMatch(/line-height:\s*var\(--bldr-line-height-lead\)/u);
    expect(CSS).toMatch(/font-weight:\s*var\(--bldr-font-weight-medium\)/u);
    expect(CSS).toMatch(/text-wrap:\s*pretty/u);
  });

  it('is start-aligned, never centred', () => {
    expect(CSS).toMatch(/justify-items:\s*start/u);
    expect(CSS).not.toMatch(/center/u);
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

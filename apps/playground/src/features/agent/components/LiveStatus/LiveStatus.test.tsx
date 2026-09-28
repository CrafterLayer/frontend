/**
 * LiveStatus (SPEC §4.3, §6.1): the panel's one live region.
 *
 * What this file holds it to: one polite, atomic status region in the UI language; the
 * `announce.*` sentence for every announcement it is handed; a new node for every new
 * `seq`, so the same sentence twice is spoken twice; and a stylesheet that hides it from
 * sight without taking it out of the accessibility tree.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { tAnnounce } from '../../copy';
import type { Locale } from '../../model/view-types';
import { frameAnnouncements } from '../../testing/wp-11-frame-fixtures';

import { LiveStatus } from './LiveStatus';

const LIVE = '[aria-live], [role=status], [role=log], [role=alert]';
const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'LiveStatus', 'LiveStatus.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

describe('LiveStatus', () => {
  it('is one polite, atomic status region, in the UI language', () => {
    for (const locale of LOCALES) {
      const { container, unmount } = render(<LiveStatus locale={locale} announcement={null} />);
      const region = screen.getByRole('status');
      expect(container.querySelectorAll(LIVE)).toHaveLength(1);
      expect(region.tagName).toBe('P');
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(region).toHaveAttribute('aria-atomic', 'true');
      expect(region).toHaveAttribute('lang', locale);
      expect(region).toHaveClass('ck-agent-live');
      unmount();
    }
  });

  it('is mounted and silent before the first announcement', () => {
    render(<LiveStatus locale="en" announcement={null} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('speaks the announce.* sentence of each announcement, in order, in both locales', () => {
    for (const locale of LOCALES) {
      const { rerender, unmount } = render(<LiveStatus locale={locale} announcement={null} />);
      const region = screen.getByRole('status');
      for (const announcement of frameAnnouncements(locale)) {
        rerender(<LiveStatus locale={locale} announcement={announcement} />);
        expect(region).toHaveTextContent(tAnnounce(locale, announcement.key, announcement.params));
        // Still the same region: a live region replaced is a live region a reader misses.
        expect(screen.getByRole('status')).toBe(region);
      }
      unmount();
    }
  });

  it('says the SPEC sentences: the outcome of a build, MSA in Arabic', () => {
    const { rerender } = render(
      <LiveStatus locale="ar" announcement={{ key: 'build.done', params: { n: 8 }, seq: 1 }} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('بُنيت الصفحة: 8 أقسام');
    rerender(
      <LiveStatus
        locale="en"
        announcement={{ key: 'build.progress', params: { done: 4, total: 8 }, seq: 2 }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('4 of 8 sections are on the page');
  });

  it('speaks the same sentence twice: a new seq mounts a new node', () => {
    const { rerender } = render(
      <LiveStatus locale="en" announcement={{ key: 'copied', params: {}, seq: 1 }} />,
    );
    const region = screen.getByRole('status');
    const first = region.firstElementChild;
    expect(first).toHaveTextContent('Copied');

    rerender(<LiveStatus locale="en" announcement={{ key: 'copied', params: {}, seq: 2 }} />);
    const second = region.firstElementChild;
    expect(second).toHaveTextContent('Copied');
    expect(second).not.toBe(first);
    expect(first?.isConnected).toBe(false);
  });

  it('leaves the node alone when the panel re-renders with the same announcement', () => {
    const announcement = { key: 'queue.queued', params: {}, seq: 7 } as const;
    const { rerender } = render(<LiveStatus locale="en" announcement={announcement} />);
    const node = screen.getByRole('status').firstElementChild;
    rerender(<LiveStatus locale="en" announcement={{ ...announcement }} />);
    expect(screen.getByRole('status').firstElementChild).toBe(node);
  });

  it('keeps the last outcome after the run is over, until the next announcement', () => {
    const { rerender } = render(
      <LiveStatus locale="en" announcement={{ key: 'build.done', params: { n: 8 }, seq: 6 }} />,
    );
    rerender(
      <LiveStatus locale="en" announcement={{ key: 'build.done', params: { n: 8 }, seq: 6 }} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Page built: 8 sections');
  });
});

describe('LiveStatus.css', () => {
  it('hides the region by clipping, never by display or visibility', () => {
    expect(CSS).toMatch(/\.ck-agent-live\s*\{[^}]*clip-path:\s*inset\(50%\)/u);
    expect(CSS).toMatch(/\.ck-agent-live\s*\{[^}]*position:\s*absolute/u);
    expect(CSS).not.toMatch(/display:\s*none|visibility:\s*hidden|aria-hidden/u);
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).toMatch(/inline-size:/u);
    expect(CSS).not.toMatch(/(?:^|[\s;{])(?:left|right|top|bottom|width|height)\s*:/mu);
  });
});

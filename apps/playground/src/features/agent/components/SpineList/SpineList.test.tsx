/**
 * SpineList (SPEC §4.8): the page spine as an `<ol>` named "Page sections".
 *
 * The list is where the spine becomes one line: each row draws the stretch below its node in
 * the NEXT row's state, so reading the stretches top to bottom reads the states of rows 2 to
 * n, and ink grows from the top only as sections land. It also owns the columns the rows
 * share, the arrival stagger, and the once-per-build completion sweep.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { buildBuilding, buildDone, spineRows } from '../../testing/wp-12-records-fixtures';

import { SpineList } from './SpineList';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'SpineList', 'SpineList.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * jsdom has no AnimationEvent, and testing-library's fallback `Event` drops `animationName`,
 * which the list reads to tell its own sweep from a row's arrival.
 */
function animationEnd(target: Element, animationName: string): void {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  act(() => {
    target.dispatchEvent(event);
  });
}

function stretches(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('.ck-agent-segment')].map((segment) =>
    segment.getAttribute('data-state'),
  );
}

describe('SpineList', () => {
  it('is a list named "Page sections", one item per section, in page order', () => {
    const rows = buildBuilding('en').rows;
    render(<SpineList locale="en" rows={rows} />);
    const list = screen.getByRole('list', { name: t('en', 'spine.label') });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(8);
    expect(items.map((item) => item.getAttribute('data-state'))).toEqual(
      rows.map((row) => row.state),
    );
  });

  it('names the list in Arabic', () => {
    render(<SpineList locale="ar" rows={buildBuilding('ar').rows} />);
    expect(screen.getByRole('list', { name: 'أقسام الصفحة' })).toBeInTheDocument();
  });

  it('draws one continuous spine: each stretch in the state of the node below it', () => {
    // §3.4: 1 landed, 2 and 3 writing, 4 drafted, 5 and 6 writing, 7 and 8 waiting.
    const { container } = render(<SpineList locale="en" rows={buildBuilding('en').rows} />);
    expect(stretches(container)).toEqual([
      'writing',
      'writing',
      'drafted',
      'writing',
      'writing',
      'pencil',
      'pencil',
    ]);
  });

  it('closes into one unbroken stroke of ink when every section landed', () => {
    const { container } = render(<SpineList locale="en" rows={buildDone('en').rows} />);
    expect(new Set(stretches(container))).toEqual(new Set(['ink']));
  });

  it('keeps a trailing column only when some row has an action', () => {
    const { container, rerender } = render(
      <SpineList locale="en" rows={buildBuilding('en').rows} />,
    );
    expect(container.querySelector('ol')).not.toHaveAttribute('data-trailing');
    rerender(<SpineList locale="en" rows={buildDone('en').rows} />);
    expect(container.querySelector('ol')).toHaveAttribute('data-trailing');
  });

  it('staggers arriving rows 24ms apart, capped at eight steps', () => {
    const rows = spineRows(
      'en',
      Array.from({ length: 12 }, () => 'waiting' as const),
    );
    const { container } = render(<SpineList locale="en" rows={rows} arrive />);
    const delays = [...container.querySelectorAll<HTMLElement>('li')].map((item) =>
      item.style.getPropertyValue('--ck-agent-arrive-delay'),
    );
    expect(delays.slice(0, 3)).toEqual(['0ms', '24ms', '48ms']);
    expect(delays.slice(8)).toEqual(['192ms', '192ms', '192ms', '192ms']);
    for (const item of container.querySelectorAll('li')) {
      expect(item).toHaveAttribute('data-arriving');
    }
  });

  it('plays the completion sweep when asked, and reports its end once', () => {
    const onSweepEnd = vi.fn();
    const { container } = render(
      <SpineList locale="en" rows={buildDone('en').rows} sweep onSweepEnd={onSweepEnd} />,
    );
    const list = container.querySelector('ol');
    if (list === null) throw new Error('no list');
    expect(list).toHaveAttribute('data-sweep');
    // A row's own animation ending is not the sweep's.
    const row = container.querySelector('li');
    if (row === null) throw new Error('no row');
    animationEnd(row, 'ck-agent-spine-row-in');
    expect(onSweepEnd).not.toHaveBeenCalled();
    animationEnd(list, 'ck-agent-spine-sweep');
    expect(onSweepEnd).toHaveBeenCalledOnce();
  });

  it('passes each row’s action to the record with the row’s key', () => {
    const onUndo = vi.fn();
    render(<SpineList locale="en" rows={buildDone('en').rows} onUndo={onUndo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo Hero' }));
    expect(onUndo).toHaveBeenCalledExactlyOnceWith('sec-2');
  });
});

describe('SpineList.css', () => {
  it('sets the shared columns: glyph 16, number 20, title, state word, then the action', () => {
    expect(CSS).toMatch(
      /\[node\] var\(--bldr-space-3xl\)\s+\[number\] var\(--bldr-space-4xl\)\s+\[title\] minmax\(0, 1fr\)\s+\[state\] auto/,
    );
    expect(CSS).toMatch(/\[state\] auto\s+\[trail\] auto/);
    expect(CSS).toMatch(/column-gap:\s*var\(--bldr-space-md\)/);
  });

  it('sweeps once, after the last stroke fills, over the sweep token; never under reduced motion', () => {
    expect(CSS).toMatch(
      /animation:\s*ck-agent-spine-sweep var\(--bldr-duration-sweep\) var\(--bldr-easing\)\s+var\(--bldr-duration-land\) both/,
    );
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.ck-agent-spine\[data-sweep\]::after \{\s*display: none;/,
    );
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});

/**
 * SpineRow (SPEC §4.8): one section of the page spine.
 *
 * What this file holds the row to:
 * - its name says the section's place, title and state in words ("Section 3 of 8: Services,
 *   Writing"), for every state, so no state is carried by the node's shape or colour alone;
 * - it is a button only while its section exists on the page, and activating it reveals that
 *   section; a section with no node yet is text that says the same sentence;
 * - Undo exists only where the view gives the row one (after `build.completed`); a revived
 *   Undo is `aria-disabled` and described by the record's caption; Undo and Redo are one
 *   button, so focus stays on it when the undo lands (SPEC §6.3);
 * - a failed row keeps Retry in view and says why it failed on its own line;
 * - the stretch of spine below its node takes the next row's state, and ink means landed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { Locale, RowState, SpineRowView } from '../../model/view-types';
import { spineRows, undoOf } from '../../testing/wp-12-records-fixtures';

import { SpineRow, type SpineRowProps } from './SpineRow';
import { segmentForRow } from './spine-segment-state';

const CSS_DIR = join(process.cwd(), 'src', 'features', 'agent', 'components', 'SpineRow');
const read = (name: string): string =>
  readFileSync(join(CSS_DIR, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const ROW_CSS = read('SpineRow.css');
const SEGMENT_CSS = read('SpineSegment.css');

const ROW_STATES = [
  'planned',
  'waiting',
  'writing',
  'retrying',
  'drafted',
  'landed',
  'failed',
  'notWritten',
  'undone',
] as const satisfies readonly RowState[];

function rowOf(state: RowState, extra: Partial<SpineRowView> = {}): SpineRowView {
  const [row] = spineRows('en', [{ state }]);
  if (row === undefined) throw new Error('no row');
  return { ...row, position: 3, total: 8, title: 'Services', ...extra };
}

function renderRow(props: Partial<SpineRowProps> & Pick<SpineRowProps, 'row'>) {
  return render(
    <ol>
      <SpineRow locale="en" {...props} />
    </ol>,
  );
}

function nameOf(locale: Locale, row: SpineRowView): string {
  return t(locale, 'row.aria', {
    i: row.position,
    n: row.total,
    title: row.title,
    state: t(locale, `row.${row.state}`),
  });
}

describe('SpineRow: names', () => {
  it('names the row by its place, its title and its state word, in every state', () => {
    for (const state of ROW_STATES) {
      const row = rowOf(state);
      const { unmount } = renderRow({ row });
      const button = screen.getByRole('button', { name: nameOf('en', row) });
      expect(button).toHaveAccessibleName(
        `Section 3 of 8: Services, ${t('en', `row.${state}`)}`,
      );
      unmount();
    }
  });

  it('says it in Arabic with the catalog’s own sentence', () => {
    const row = { ...rowOf('writing'), title: 'الخدمات' };
    render(
      <ol>
        <SpineRow locale="ar" row={row} />
      </ol>,
    );
    expect(screen.getByRole('button')).toHaveAccessibleName('القسم 3 من 8: «الخدمات»، قيد الكتابة');
  });

  it('is text, not a button, while its section has no node on the page, and says the same', () => {
    const row = rowOf('notWritten', { nodeId: undefined });
    const { container } = renderRow({ row });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(nameOf('en', row))).toHaveClass('bldr-visually-hidden');
    // The drawn words are hidden from assistive technology one by one; the node always is.
    for (const part of container.querySelectorAll(
      '.ck-agent-spine-row__number, .ck-agent-spine-row__title, .ck-agent-spine-row__state',
    )) {
      expect(part).toHaveAttribute('aria-hidden', 'true');
    }
    expect(container.querySelector('.ck-agent-glyph')).toHaveAttribute('aria-hidden', 'true');
  });

  it('isolates the title and gives it its own language when it is not the panel’s', () => {
    const row = { ...rowOf('landed'), title: 'الأسئلة الشائعة' };
    const { container } = renderRow({ row });
    const title = container.querySelector('bdi.ck-agent-spine-row__title');
    expect(title).toHaveTextContent('الأسئلة الشائعة');
    expect(title).toHaveAttribute('lang', 'ar');
  });
});

describe('SpineRow: reveal and peek', () => {
  it('reveals its section when activated', async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    renderRow({ row: rowOf('landed'), onReveal });
    await user.click(screen.getByRole('button'));
    expect(onReveal).toHaveBeenCalledExactlyOnceWith('sec-1');
  });

  it('peeks at its section on hover and focus, and lets go when they end', async () => {
    const user = userEvent.setup();
    const onPeek = vi.fn();
    renderRow({ row: rowOf('writing'), onPeek });
    const button = screen.getByRole('button');
    await user.hover(button);
    await user.unhover(button);
    expect(onPeek.mock.calls).toEqual([['sec-1'], [null]]);
    onPeek.mockClear();
    button.focus();
    button.blur();
    expect(onPeek.mock.calls).toEqual([['sec-1'], [null]]);
  });
});

describe('SpineRow: Undo, Redo, Retry', () => {
  it('offers Undo only when the view gives the row one (after build.completed)', () => {
    const { rerender } = renderRow({ row: rowOf('landed') });
    expect(screen.queryByRole('button', { name: /^Undo/u })).toBeNull();
    rerender(
      <ol>
        <SpineRow locale="en" row={rowOf('landed', { undo: undoOf(3) })} />
      </ol>,
    );
    expect(screen.getByRole('button', { name: 'Undo Services' })).toBeEnabled();
  });

  it('undoes its section, and keeps focus on the same button when it becomes Redo', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    const { rerender } = renderRow({ row: rowOf('landed', { undo: undoOf(3) }), onUndo });
    const undo = screen.getByRole('button', { name: 'Undo Services' });
    await user.click(undo);
    expect(onUndo).toHaveBeenCalledExactlyOnceWith('sec-1');

    rerender(
      <ol>
        <SpineRow
          locale="en"
          row={rowOf('undone', { undo: { kind: 'redo', transactionId: 'tx-undo' } })}
          onUndo={onUndo}
        />
      </ol>,
    );
    const redo = screen.getByRole('button', { name: 'Redo Services' });
    expect(redo).toBe(undo);
    expect(redo).toHaveFocus();
  });

  it('redoes an undone section', async () => {
    const user = userEvent.setup();
    const onRedo = vi.fn();
    const onUndo = vi.fn();
    renderRow({
      row: rowOf('undone', { undo: { kind: 'redo', transactionId: 'tx-undo' } }),
      onRedo,
      onUndo,
    });
    await user.click(screen.getByRole('button', { name: 'Redo Services' }));
    expect(onRedo).toHaveBeenCalledExactlyOnceWith('sec-1');
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('shows a revived Undo aria-disabled, described by the record’s caption, doing nothing', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <>
        <p id="revived-caption">{t('en', 'build.caption.revived')}</p>
        <ol>
          <SpineRow
            locale="en"
            row={rowOf('landed', { undo: { kind: 'unavailable', why: 'revived' } })}
            revivedCaptionId="revived-caption"
            onUndo={onUndo}
          />
        </ol>
      </>,
    );
    const undo = screen.getByRole('button', { name: 'Undo Services' });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(undo).toHaveAccessibleDescription(t('en', 'build.caption.revived'));
    await user.click(undo);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('says on its own line why an Undo was refused, and describes the Undo with it', () => {
    renderRow({ row: rowOf('landed', { undo: { kind: 'unavailable', why: 'changedSince' } }) });
    const why = t('en', 'revert.changedSince');
    expect(screen.getByText(why)).toHaveAttribute('data-tone', 'muted');
    const undo = screen.getByRole('button', { name: 'Undo Services' });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(undo).toHaveAccessibleDescription(why);
  });

  it('keeps Retry in view on a failed row, says why it failed, and retries only that section', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const row = rowOf('failed', { reason: 'timeout', canRetry: true });
    const { container } = renderRow({ row, onRetry });
    const reason = screen.getByText(t('en', 'reason.timeout'));
    expect(reason).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByRole('button', { name: nameOf('en', row) })).toHaveAccessibleDescription(
      t('en', 'reason.timeout'),
    );
    // Label in Name (WCAG 2.5.3): the visible word opens the name.
    const retry = screen.getByRole('button', { name: 'Retry Services' });
    expect(retry).toHaveTextContent(t('en', 'row.retry'));
    expect(retry.closest('[data-reveal]')).toBeNull();
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledExactlyOnceWith('sec-1');
    expect(container.querySelector('.ck-agent-spine-row__trailing')).not.toHaveAttribute(
      'data-reveal',
    );
  });

  it('names an unclassified failure honestly, never with raw engine text', () => {
    renderRow({ row: rowOf('failed', { canRetry: false }) });
    expect(screen.getByText(t('en', 'reason.unknown'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Retry/u })).toBeNull();
  });

  it('shows Undo on hover or focus under a fine pointer, and Redo always', () => {
    const { container, rerender } = renderRow({ row: rowOf('landed', { undo: undoOf(3) }) });
    expect(container.querySelector('.ck-agent-spine-row__trailing')).toHaveAttribute(
      'data-reveal',
      'hover',
    );
    rerender(
      <ol>
        <SpineRow
          locale="en"
          row={rowOf('undone', { undo: { kind: 'redo', transactionId: 'tx' } })}
        />
      </ol>,
    );
    expect(container.querySelector('.ck-agent-spine-row__trailing')).not.toHaveAttribute(
      'data-reveal',
    );
  });
});

describe('SpineRow: the stretch below its node', () => {
  it('draws the stretch to the next node in the next row’s state; the last row draws none', () => {
    const [first, second] = spineRows('en', ['landed', 'drafted']);
    if (first === undefined || second === undefined) throw new Error('rows');
    const { container, rerender } = renderRow({ row: first, next: second });
    const segment = container.querySelector('.ck-agent-segment');
    expect(segment).toHaveAttribute('data-state', 'drafted');
    expect(segment).toHaveAttribute('data-land-key', second.key);
    expect(segment).toHaveAttribute('aria-hidden', 'true');
    rerender(
      <ol>
        <SpineRow locale="en" row={second} next={null} />
      </ol>,
    );
    expect(container.querySelector('.ck-agent-segment')).toBeNull();
  });

  it('inks a stretch only for a landed section (ink means landed)', () => {
    const inked = ROW_STATES.filter((state) => segmentForRow(state) === 'ink');
    expect(inked).toEqual(['landed']);
    expect(segmentForRow('drafted')).toBe('drafted');
    expect(segmentForRow('retrying')).toBe('writing');
    expect(segmentForRow('notWritten')).toBe('pencil');
    expect(segmentForRow('undone')).toBe('pencil');
  });
});

describe('SpineRow.css and SpineSegment.css', () => {
  it('takes its columns from the list: node, number, title 52px in, state, action', () => {
    expect(ROW_CSS).toMatch(/grid-template-columns:\s*subgrid/);
    expect(ROW_CSS).toMatch(/grid-template-rows:\s*var\(--bldr-agent-row-height\)/);
    expect(ROW_CSS).toMatch(/outline-offset:\s*calc\(-1 \* var\(--bldr-border-thick\)\)/);
  });

  it('draws the spine with borders: dashed pencil, solid Halo, solid Indigo ink, dashed Alarm', () => {
    expect(SEGMENT_CSS).toMatch(
      /border-inline-start:\s*var\(--ck-agent-spine-width\)\s+dashed\s+var\(--bldr-progress-track\)/,
    );
    expect(SEGMENT_CSS).toMatch(/border-inline-start-color:\s*var\(--bldr-accent-ring\)/);
    expect(SEGMENT_CSS).toMatch(/border-inline-start-color:\s*var\(--bldr-accent\);/);
    expect(SEGMENT_CSS).toMatch(/border-inline-start-color:\s*var\(--bldr-danger\)/);
  });

  it('keeps every state distinct under forced colors, by style and width', () => {
    const forced = /@media \(forced-colors: active\) \{([\s\S]*)\}\s*$/u.exec(SEGMENT_CSS)?.[1];
    if (forced === undefined) throw new Error('no forced-colors block');
    expect(forced).toMatch(/dashed GrayText/);
    expect(forced).toMatch(/dotted Highlight/);
    expect(forced).toMatch(/dotted CanvasText/);
    expect(forced).toMatch(/solid Highlight/);
    expect(forced).toMatch(/dashed Mark/);
    expect(forced).toMatch(/display:\s*none/);
  });

  it('stills the light under reduced motion', () => {
    expect(SEGMENT_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
    expect(ROW_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('uses logical properties only', () => {
    const physical =
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/;
    expect(ROW_CSS).not.toMatch(physical);
    expect(SEGMENT_CSS).not.toMatch(physical);
  });
});

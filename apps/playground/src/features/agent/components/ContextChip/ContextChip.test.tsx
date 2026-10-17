/**
 * ContextChip (SPEC §4.17, §3.2; FR-024): what a request is about. Ours to prove: "Whole
 * page" is the visible scope and never removable; a block chip's `×` is named for the
 * block and removes it by its node id; a stale chip says so and its `×` is described by
 * that line; the page's own words sit in `<bdi>`; and the chip itself is not a control.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { blockChip, LONG_LABEL, SCOPE_CHIP } from '../../testing/wp-14-composer-fixtures';

import { ContextChip } from './ContextChip';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'ContextChip', 'ContextChip.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

describe('ContextChip', () => {
  it('reads “Whole page” and cannot be removed, even when a remover is passed', () => {
    render(<ContextChip locale="en" chip={SCOPE_CHIP} onRemove={vi.fn()} />);
    expect(screen.getByText(t('en', 'scope.page'))).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reads «الصفحة كاملة» in Arabic', () => {
    render(<ContextChip locale="ar" chip={SCOPE_CHIP} />);
    expect(screen.getByText('الصفحة كاملة')).toBeInTheDocument();
  });

  it('names the sections a focused run saw whole, and says the rest went as an outline', () => {
    const { container } = render(
      <ContextChip
        locale="en"
        chip={{ kind: 'page', id: 'page', focus: { names: ['Pricing'], outlined: true } }}
        onRemove={vi.fn()}
      />,
    );
    const label = container.querySelector('.ck-agent-chip__label');
    expect(label).toHaveTextContent('Focused: Pricing (+ outline)');
    expect(label).toHaveAttribute('title', 'Focused: Pricing (+ outline)');
    expect(container.querySelector('.ck-agent-chip__label bdi')).toHaveTextContent('Pricing');
    expect(container.querySelector('.ck-agent-chip')).toHaveAttribute('data-focused');
    expect(screen.queryByText(t('en', 'scope.page'))).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('joins two focused sections as a list, in Arabic too', () => {
    const { container, rerender } = render(
      <ContextChip
        locale="en"
        chip={{ kind: 'page', id: 'page', focus: { names: ['Pricing', 'FAQ'], outlined: false } }}
      />,
    );
    expect(container.querySelector('.ck-agent-chip__label')).toHaveTextContent(
      'Focused: Pricing and FAQ',
    );
    rerender(
      <ContextChip
        locale="ar"
        chip={{ kind: 'page', id: 'page', focus: { names: ['الأسعار'], outlined: true } }}
      />,
    );
    expect(container.querySelector('.ck-agent-chip__label')).toHaveTextContent(
      'التركيز على: الأسعار (+ مخطط الباقي)',
    );
  });

  it('removes a block chip by its node id, from a × named for the block', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<ContextChip locale="en" chip={blockChip('en', 'hero')} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: 'Remove Hero from the request' }));
    expect(onRemove).toHaveBeenCalledWith('node-hero');
  });

  it('names the × in Arabic with the block’s name', () => {
    render(<ContextChip locale="ar" chip={blockChip('ar', 'hero')} onRemove={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: t('ar', 'chip.remove', { label: 'الواجهة' }) }),
    ).toBeInTheDocument();
  });

  it('shows a chip without × when nothing may remove it', () => {
    render(<ContextChip locale="en" chip={blockChip('en', 'services')} />);
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says a stale block is no longer on the page, and describes its × by that', () => {
    const { container } = render(
      <ContextChip locale="en" chip={blockChip('en', 'faq', { stale: true })} onRemove={vi.fn()} />,
    );
    expect(container.querySelector('.ck-agent-chip')).toHaveAttribute('data-stale');
    expect(screen.getByRole('button', { name: 'Remove FAQ from the request' })).toHaveAccessibleDescription(
      t('en', 'chip.stale'),
    );
  });

  it('isolates the block’s name in <bdi>, and keeps the full name reachable by pointer', () => {
    const { container } = render(
      <ContextChip locale="ar" chip={blockChip('ar', 'hero', { label: LONG_LABEL.ar })} />,
    );
    expect(container.querySelector('.ck-agent-chip__label bdi')).toHaveTextContent(LONG_LABEL.ar);
    expect(container.querySelector('.ck-agent-chip__label')).toHaveAttribute('title', LONG_LABEL.ar);
  });

  it('cuts a Latin name at its own end inside the Arabic panel (the label takes its own direction)', () => {
    const { container } = render(
      <ContextChip locale="ar" chip={blockChip('ar', 'hero', { label: 'Aurora Background' })} />,
    );
    // The ellipsis falls at the label's inline end: "Aurora Backg…", never "…ora Background".
    expect(container.querySelector('.ck-agent-chip__label')).toHaveAttribute('dir', 'auto');
  });

  it('keeps the Whole page chip in the panel’s direction', () => {
    const { container } = render(<ContextChip locale="ar" chip={SCOPE_CHIP} />);
    expect(container.querySelector('.ck-agent-chip__label')).not.toHaveAttribute('dir');
  });

  it('draws a 28px chip, cut at 16 characters, with a 32/44px remove target', () => {
    expect(CSS).toMatch(/16ch/u);
    expect(CSS).toMatch(/--ck-agent-target:\s*var\(--bldr-hit-target-min\)/u);
  });
});

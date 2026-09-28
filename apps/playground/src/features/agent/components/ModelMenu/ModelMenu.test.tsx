/**
 * ModelMenu (SPEC §4.17): which model writes, by what the choice means for the person.
 * Ours to prove: every label comes through `model-label.ts` (tier words from the catalog,
 * the vendor's product name in `<bdi>`), a raw model id never reaches the screen, the
 * chosen one is checked, and choosing calls back with the raw id, which only the
 * controller ever sees.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { modelSelection } from '../../model/model-label';
import type { ModelSelectionView } from '../../model/view-types';
import { MODEL, MODEL_IDS } from '../../testing/wp-14-composer-fixtures';

import { ModelMenu } from './ModelMenu';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

function selection(ids: readonly string[], selected: string): ModelSelectionView {
  const view = modelSelection(ids, selected);
  if (view === null) throw new Error('the ids must offer a choice');
  return view;
}

describe('ModelMenu', () => {
  it('shows the tier and is named “Model: …”', () => {
    render(<ModelMenu locale="en" model={MODEL} onModelChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Model: Fast' })).toHaveTextContent('Fast');
  });

  it('labels every option through model-label, and never shows a raw id', async () => {
    const user = userEvent.setup();
    render(<ModelMenu locale="en" model={MODEL} onModelChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Model: Fast' }));
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Fast');
    expect(items[0]).toHaveTextContent('Haiku');
    expect(items[0]).toHaveTextContent(t('en', 'model.fast.trait'));
    expect(items[1]).toHaveTextContent('Careful');
    expect(items[1]).toHaveTextContent('Sonnet');
    expect(items[2]).toHaveTextContent('Free');
    expect(items[2]).toHaveTextContent('MiniMax');
    expect(items[0]?.querySelector('bdi')).toHaveTextContent('Haiku');

    const text = document.body.textContent;
    for (const id of MODEL_IDS) expect(text).not.toContain(id);
    expect(text).not.toMatch(/cli:|:free|\//u);
  });

  it('checks the chosen model', async () => {
    const user = userEvent.setup();
    render(
      <ModelMenu locale="en" model={selection(MODEL_IDS, 'cli:sonnet')} onModelChange={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Model: Careful' }));
    const checked = within(screen.getByRole('menu'))
      .getAllByRole('menuitemradio')
      .map((item) => item.getAttribute('aria-checked'));
    expect(checked).toEqual(['false', 'true', 'false']);
  });

  it('calls back with the raw id, which only the controller sees', async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    render(<ModelMenu locale="en" model={MODEL} onModelChange={onModelChange} />);
    await user.click(screen.getByRole('button', { name: 'Model: Fast' }));
    await user.click(within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /Free/u }));
    expect(onModelChange).toHaveBeenCalledWith('minimax/minimax-m3:free');
  });

  it('reads an unnamed model by its tier alone, in Arabic', async () => {
    const user = userEvent.setup();
    const model: ModelSelectionView = {
      selected: { id: 'cli:haiku', tier: 'fast', product: 'Haiku' },
      options: [
        { id: 'cli:haiku', tier: 'fast', product: 'Haiku' },
        { id: 'vendor/x-9', tier: 'careful', product: '' },
      ],
    };
    render(<ModelMenu locale="ar" model={model} onModelChange={vi.fn()} />);
    await user.click(
      screen.getByRole('button', { name: t('ar', 'model.aria', { name: t('ar', 'model.fast') }) }),
    );
    const unnamed = within(screen.getByRole('menu')).getAllByRole('menuitemradio')[1];
    expect(unnamed).toHaveTextContent(t('ar', 'model.careful'));
    expect(unnamed?.querySelector('bdi')).toBeNull();
    expect(document.body.textContent).not.toContain('vendor/x-9');
  });
});

/**
 * EffortMenu: how long the model may think. Ours to prove: Medium is the default reading,
 * all five levels are offered shallowest first with the catalog's words in both locales,
 * the chosen one is checked, and choosing calls back with the level.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { DEFAULT_EFFORT, effortSelection } from '../../model/effort';
import type { EffortSelectionView } from '../../model/view-types';

import { EffortMenu } from './EffortMenu';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

function view(selected?: Parameters<typeof effortSelection>[0]): EffortSelectionView {
  const made = effortSelection(selected, true);
  if (made === null) throw new Error('selectable');
  return made;
}

describe('EffortMenu', () => {
  it('reads Medium by default and is named “Thinking: Medium”', () => {
    expect(DEFAULT_EFFORT).toBe('medium');
    render(<EffortMenu locale="en" effort={view()} onEffortChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Thinking: Medium' })).toHaveTextContent('Medium');
  });

  it('offers the five levels shallowest first, each with what it costs, and checks the chosen', async () => {
    const user = userEvent.setup();
    render(<EffortMenu locale="en" effort={view('high')} onEffortChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Thinking: High' }));
    const items = within(screen.getByRole('menu')).getAllByRole('menuitemradio');
    expect(items).toHaveLength(5);
    (['low', 'medium', 'high', 'xhigh', 'max'] as const).forEach((level, index) => {
      expect(items[index]).toHaveTextContent(t('en', `effort.${level}`));
      expect(items[index]).toHaveTextContent(t('en', `effort.${level}.trait`));
    });
    expect(items[2]).toHaveAttribute('aria-checked', 'true');
  });

  it('calls back with the level, and speaks Arabic in Arabic', async () => {
    const user = userEvent.setup();
    const onEffortChange = vi.fn();
    render(<EffortMenu locale="ar" effort={view()} onEffortChange={onEffortChange} />);
    await user.click(screen.getByRole('button', { name: 'مستوى التفكير: متوسط' }));
    await user.click(screen.getByRole('menuitemradio', { name: /أقصى/u }));
    expect(onEffortChange).toHaveBeenCalledWith('max');
  });
});

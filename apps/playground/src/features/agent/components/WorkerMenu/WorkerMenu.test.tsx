/**
 * WorkerMenu (compact composer, 2026-10-12): the build-worker chip. Ours to prove: the chip
 * shows the count and is named by the whole ("Build workers: 3 workers"); its menu offers one,
 * three or six workers, each with what it costs, the current one checked; a pick calls back;
 * during a run a pick changes nothing and the tooltip says the count is fixed; Arabic labels.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { toolbarLabels } from '../../copy/toolbar-labels';

import { WorkerMenu } from './WorkerMenu';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

function items(): HTMLElement[] {
  return within(screen.getByRole('menu')).getAllByRole('menuitemradio');
}

const NAME = `${t('en', 'workers.label')}: ${t('en', 'workers.option', { n: 3 })}`;

describe('WorkerMenu', () => {
  it('shows the count, named by the whole, and offers one, three or six workers', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkerMenu locale="en" value={3} running={false} onChange={onChange} />);
    const chip = screen.getByRole('button', { name: NAME });
    expect(chip).toHaveTextContent('3');
    await user.click(chip);
    const list = items();
    expect(list.map((item) => item.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(list[0]).toHaveTextContent(t('en', 'workers.option', { n: 1 }));
    expect(list[2]).toHaveTextContent(toolbarLabels('en').workerDescription[6]);
    await user.click(list[2]!);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(6);
  });

  it('keeps the count a running build started with, and says so', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkerMenu locale="en" value={1} running onChange={onChange} />);
    const chip = screen.getByRole('button', { name: /^Build workers:/u });
    await user.hover(chip);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(toolbarLabels('en').workersLocked);
    await user.click(chip);
    await user.click(items()[1]!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('speaks Arabic, in the menu and in its name', async () => {
    const user = userEvent.setup();
    render(<WorkerMenu locale="ar" value={6} running={false} onChange={vi.fn()} />);
    const chip = screen.getByRole('button', {
      name: `${t('ar', 'workers.label')}: ${t('ar', 'workers.option', { n: 6 })}`,
    });
    await user.click(chip);
    expect(screen.getByRole('menu')).toHaveAttribute('lang', 'ar');
    await waitFor(() => {
      expect(items()[0]).toHaveTextContent(toolbarLabels('ar').workerDescription[1]);
    });
  });
});

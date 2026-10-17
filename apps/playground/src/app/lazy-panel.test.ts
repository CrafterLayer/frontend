import { render, screen, waitFor } from '@testing-library/react';
import { createElement, Suspense, type ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { lazyPanel } from './lazy-panel';

interface HelloProps {
  readonly name: string;
}

function Hello({ name }: HelloProps) {
  return createElement('p', null, `Hello ${name}`);
}

const chunkError = () => new TypeError('Failed to fetch dynamically imported module');

afterEach(() => {
  vi.restoreAllMocks();
});

function mount(Panel: ComponentType<HelloProps>) {
  render(
    createElement(
      Suspense,
      { fallback: createElement('p', null, 'pending') },
      createElement('section', { 'aria-label': 'host' }, createElement(Panel, { name: 'there' })),
    ),
  );
}

describe('lazyPanel', () => {
  it('renders the panel once its chunk arrives', async () => {
    mount(lazyPanel(() => Promise.resolve(Hello)));
    expect(await screen.findByText('Hello there')).toBeTruthy();
  });

  it('tries a failed chunk again before giving up', async () => {
    const load = vi
      .fn<() => Promise<ComponentType<HelloProps>>>()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValueOnce(Hello);
    mount(lazyPanel(load, 3, 0));
    expect(await screen.findByText('Hello there')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('leaves the panel empty, not the editor, when the chunk never loads', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi.fn<() => Promise<ComponentType<HelloProps>>>().mockRejectedValue(chunkError());
    mount(lazyPanel(load, 2, 0));
    const host = await screen.findByRole('region', { name: 'host' });
    expect(host.textContent).toBe('');
    expect(screen.queryByText('pending')).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(logged).toHaveBeenCalled();
    });
  });
});

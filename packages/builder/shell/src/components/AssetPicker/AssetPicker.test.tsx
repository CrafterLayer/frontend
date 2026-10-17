import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AssetEntry, AssetLibraryPort } from '@craftkit/builder-schema';

import { AssetPicker } from './AssetPicker';

const entry = (id: string, description: string, mood: readonly string[]): AssetEntry => ({
  id,
  url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E`,
  description,
  mood: [...mood],
  palette: ['#c2410c'],
  alt: `A picture described as ${description}`,
  width: 1200,
  height: 800,
});

const ENTRIES = [
  entry('ember', 'A warm amber gradient', ['warm']),
  entry('slate', 'A dark slate gradient', ['formal']),
];

const libraryOf = (entries: readonly AssetEntry[]): AssetLibraryPort => ({
  list: () => Promise.resolve(entries),
});

const brokenLibrary = (message: string): AssetLibraryPort => ({
  list: () => Promise.reject(new Error(message)),
});

describe('AssetPicker', () => {
  it('hands back the ENTRY that was chosen, not its id', async () => {
    /*
      The caller has to write the picture into the site's own asset table, and
      an id alone would send it back to the library for the metadata it just
      had. Handing over the entry is also what makes the table a COPY, which is
      why a picture later deleted from the library does not break the site.
    */
    const onSelect = vi.fn();
    render(<AssetPicker library={libraryOf(ENTRIES)} label="Pictures" onSelect={onSelect} />);

    await userEvent.click(await screen.findByRole('button', { name: /warm amber/u }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(ENTRIES[0]);
  });

  it('gives every picture the alt text the library wrote for it', async () => {
    render(<AssetPicker library={libraryOf(ENTRIES)} label="Pictures" />);

    for (const item of ENTRIES) {
      expect(await screen.findByRole('img', { name: item.alt })).toBeVisible();
    }
  });

  it('SAYS the library is empty rather than showing a blank box', async () => {
    /*
      The state a new project is in. Drawn as empty space it is
      indistinguishable from the component failing to render, and the person
      looking at it has no way to tell which.
    */
    render(<AssetPicker library={libraryOf([])} label="Pictures" />);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'There are no pictures in this library yet.',
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('carries the library’s own words when it is unavailable', async () => {
    render(<AssetPicker library={brokenLibrary('the store is down')} label="Pictures" />);

    expect(await screen.findByRole('status')).toHaveTextContent('the store is down');
  });

  it('says which word matched nothing, so the filter can be corrected', async () => {
    render(<AssetPicker library={libraryOf(ENTRIES)} label="Pictures" />);
    await screen.findByRole('img', { name: ENTRIES[0]!.alt });

    await userEvent.type(screen.getByLabelText('Filter pictures'), 'submarine');

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('submarine');
    });
  });

  it('filters on description AND mood, because people search by both', async () => {
    render(<AssetPicker library={libraryOf(ENTRIES)} label="Pictures" />);
    await screen.findByRole('img', { name: ENTRIES[0]!.alt });

    await userEvent.type(screen.getByLabelText('Filter pictures'), 'formal');

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });
    expect(screen.getByRole('img', { name: ENTRIES[1]!.alt })).toBeVisible();
  });

  it('disables the filter when there is nothing to filter', async () => {
    render(<AssetPicker library={libraryOf([])} label="Pictures" />);
    await screen.findByRole('status');

    /*
      A search box over an empty library invites someone to type and then
      conclude the search is broken when nothing comes back.
    */
    expect(screen.getByLabelText('Filter pictures')).toBeDisabled();
  });

  it('marks the chosen picture as pressed, so the choice survives a re-read', async () => {
    render(<AssetPicker library={libraryOf(ENTRIES)} label="Pictures" selected="slate" />);

    expect(await screen.findByRole('button', { name: /dark slate/u })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /warm amber/u })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('stops showing the PREVIOUS library the moment it is pointed at another', async () => {
    /*
      They are buttons. A person offered the old library's pictures while the
      new one loads can choose one, and the choice looks like it worked — so
      the grid has to clear the instant the prop changes, not when the answer
      arrives.
    */
    let settleSecond: ((entries: readonly AssetEntry[]) => void) | undefined;
    const slow: AssetLibraryPort = {
      list: () =>
        new Promise<readonly AssetEntry[]>((resolve) => {
          settleSecond = resolve;
        }),
    };

    const { rerender } = render(<AssetPicker library={libraryOf(ENTRIES)} label="Pictures" />);
    await screen.findByRole('img', { name: ENTRIES[0]!.alt });

    rerender(<AssetPicker library={slow} label="Pictures" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading pictures…');

    settleSecond?.([]);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'There are no pictures in this library yet.',
      );
    });
  });

  it('a slow answer from the PREVIOUS library never overwrites the current one', async () => {
    /*
      The guard that earns its place. The first version of this test asserted
      that nothing is written after unmount — and no mutation could tell it from
      the guard's absence, because React 19 tolerates that silently. It was
      removed rather than left standing as decoration.

      This is the case that is actually observable, and it is a real bug: the
      picker is pointed at a second library while the first is still answering,
      and a library that answers from memory ignores the abort entirely. Without
      the guard the stale answer lands last and the person is looking at the
      wrong library's pictures.
    */
    let settleFirst: ((entries: readonly AssetEntry[]) => void) | undefined;
    const slow: AssetLibraryPort = {
      list: () =>
        new Promise<readonly AssetEntry[]>((resolve) => {
          settleFirst = resolve;
        }),
    };
    const second = [entry('bread', 'Bread on a rack', ['warm'])];

    const { rerender } = render(<AssetPicker library={slow} label="Pictures" />);
    rerender(<AssetPicker library={libraryOf(second)} label="Pictures" />);
    await screen.findByRole('img', { name: second[0]!.alt });

    /* The first library finally answers, far too late. */
    settleFirst?.(ENTRIES);
    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });
    expect(screen.getByRole('img', { name: second[0]!.alt })).toBeVisible();
  });
});

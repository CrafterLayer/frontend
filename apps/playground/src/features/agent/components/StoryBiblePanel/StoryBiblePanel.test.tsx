/**
 * StoryBiblePanel (creative agent, 2026-10-12): the characters, assets, places and canon the
 * Agent keeps consistent. A disclosure; open, each entry has a labelled Remove button and two
 * forms add a character and a canon fact; clearing asks once more. Driven here through the
 * real store, so the assertions follow what the person sees after each action.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CreativeMemoryV1 } from '@craftkit/builder';

import { t } from '../../copy';
import { useStoryBible } from '../../hooks/use-story-bible';
import type { StoryBibleView } from '../../model/story-bible';
import type { Locale } from '../../model/view-types';
import { STORY_BIBLES } from '../../testing/story-bible-fixtures';

import { StoryBiblePanel } from './StoryBiblePanel';

interface LiveBibleProps {
  readonly locale: Locale;
  readonly seed?: CreativeMemoryV1;
}

/** The panel over a real, in-memory story bible store (seeded from storage). */
function LiveBible({ locale, seed }: LiveBibleProps) {
  const { view } = useStoryBible(
    seed === undefined
      ? null
      : {
          getItem: () => JSON.stringify(seed),
          setItem: () => undefined,
        },
  );
  return <StoryBiblePanel locale={locale} bible={view} />;
}

function staticView(memory: CreativeMemoryV1): StoryBibleView {
  return {
    memory,
    addCharacter: vi.fn(() => true),
    addFact: vi.fn(() => true),
    removeCharacter: vi.fn(),
    removeAsset: vi.fn(),
    removeLocation: vi.fn(),
    removeFact: vi.fn(),
    clear: vi.fn(),
  };
}

async function openPanel(name: RegExp | string) {
  const user = userEvent.setup();
  const toggle = screen.getByRole('button', { name });
  await user.click(toggle);
  const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
  if (panel === null) throw new Error('no panel');
  return { user, toggle, panel };
}

describe('StoryBiblePanel', () => {
  it('is a closed, inert disclosure that counts what the bible holds', () => {
    render(<StoryBiblePanel locale="en" bible={staticView(STORY_BIBLES.en)} />);
    const toggle = screen.getByRole('button', { name: 'Story bible (7)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toHaveAttribute(
      'inert',
    );
  });

  it('opens to characters, assets, places and canon with labelled remove buttons', async () => {
    const bible = staticView(STORY_BIBLES.en);
    render(<StoryBiblePanel locale="en" bible={bible} />);
    const { user, toggle, panel } = await openPanel('Story bible (7)');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();
    const view = within(panel);
    for (const heading of ['Characters', 'Approved assets', 'Places', 'Canon']) {
      expect(view.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(view.getByText('Layla')).toBeInTheDocument();
    expect(view.getByText('hero')).toBeInTheDocument();
    expect(view.getByText('layla.png')).toHaveAttribute('title', 'assets/layla.png');
    await user.click(view.getByRole('button', { name: 'Remove Omar' }));
    expect(bible.removeCharacter).toHaveBeenCalledWith('omar');
    await user.click(view.getByRole('button', { name: 'Remove forest.webp' }));
    expect(bible.removeAsset).toHaveBeenCalledWith('forest-webp');
    await user.click(
      view.getByRole('button', { name: 'Remove Layla lost her lantern by the river.' }),
    );
    expect(bible.removeFact).toHaveBeenCalledWith('Layla lost her lantern by the river.');
  });

  it('adds a character and a fact through the real store', async () => {
    render(<LiveBible locale="en" />);
    const { user, panel } = await openPanel('Story bible (0)');
    const view = within(panel);
    expect(view.getByText(t('en', 'bible.empty'))).toBeInTheDocument();
    const add = view.getAllByRole('button', { name: 'Add' });
    expect(add[0]).toBeDisabled();
    await user.type(view.getByLabelText('Name'), 'Rumi');
    await user.type(view.getByLabelText('Role'), 'fox');
    const addCharacter = add[0];
    if (addCharacter === undefined) throw new Error('no Add button');
    await user.click(addCharacter);
    expect(view.getByText('Rumi')).toBeInTheDocument();
    expect(view.getByLabelText('Name')).toHaveValue('');
    await user.type(view.getByLabelText(t('en', 'bible.addFact')), 'Rumi never lies.');
    await user.keyboard('{Enter}');
    expect(view.getByText('Rumi never lies.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Story bible (2)' })).toBeInTheDocument();
  });

  it('asks once more before clearing everything', async () => {
    render(<LiveBible locale="en" seed={STORY_BIBLES.en} />);
    const { user, panel } = await openPanel('Story bible (7)');
    const view = within(panel);
    await user.click(view.getByRole('button', { name: 'Clear the bible' }));
    expect(view.getByText('Layla')).toBeInTheDocument();
    await user.click(view.getByRole('button', { name: 'Confirm: clear everything' }));
    expect(view.queryByText('Layla')).toBeNull();
    expect(screen.getByRole('button', { name: 'Story bible (0)' })).toBeInTheDocument();
  });

  it('speaks Arabic and keeps Arabic names in their own language', async () => {
    render(<StoryBiblePanel locale="ar" bible={staticView(STORY_BIBLES.ar)} />);
    const { panel } = await openPanel('دليل القصة (5)');
    const view = within(panel);
    expect(view.getByRole('heading', { name: 'الشخصيات' })).toBeInTheDocument();
    expect(view.getByText('ليلى')).toHaveAttribute('lang', 'ar');
    expect(view.getByRole('button', { name: 'إزالة عمر' })).toBeInTheDocument();
  });
});

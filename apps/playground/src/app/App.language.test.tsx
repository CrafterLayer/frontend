/*
  One language for the whole editor (2026-10-12): the agent panel speaks the editor's
  language unless the build pins one (VITE_AGENT_LOCALE), so a person who chooses
  Arabic in Settings gets the chrome AND the panel in Arabic, right to left. Before,
  the panel was Arabic and the chrome English on a first visit, whatever was chosen.
  App.test.tsx proves the English default; this proves the Arabic turn.
*/
import { configure, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { EDITOR_LOCALE_KEY } from './editor-labels';

// The whole app boots from the vault before the panel exists (see App.test.tsx).
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'function') return;
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

describe('the editor language reaches the agent panel', () => {
  it('speaks Arabic, panel included, once the editor is in Arabic', async () => {
    localStorage.setItem(EDITOR_LOCALE_KEY, 'ar');
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'المساعد' }));
    const panel = await screen.findByRole('region', { name: 'أبو غضب' });
    expect(panel).toHaveAttribute('lang', 'ar');
    expect(panel).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});

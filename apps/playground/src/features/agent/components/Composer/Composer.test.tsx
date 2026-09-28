/**
 * Composer (SPEC §4.17, §6.3, §6.7): where a request is written, with the RunBar, the one
 * queued request, ✨ Improve and the clarifying questions docked on it.
 *
 * Every test drives the Composer through `useComposerFixture`, which moves the view the
 * way the controller does, inside a panel that re-renders whenever the textarea gains or
 * loses focus (AgentPanel's face listens to it). That re-render is the window the v1
 * first-click bug lived in, so the regression tests at the end press into it on purpose.
 *
 * Focus assertions always name the destination (`toHaveFocus()` on a named element, or
 * `document.body` when leaving the field IS the destination); a bare `not.toHaveFocus()`
 * passes when focus fell to the body, so none is used as proof.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { beforeAll, describe, expect, it, vi, type Mock } from 'vitest';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import {
  ARABIC_DRAFT,
  blockChip,
  clarifying,
  composerView,
  DRAFT,
  enhancement,
  LATIN_DRAFT,
  liveRun,
  MODEL_IDS,
  queued,
  ROUGH_DRAFT,
  useComposerFixture,
  type ComposerFixture,
} from '../../testing/wp-14-composer-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { Composer, type ComposerActions, type ComposerView } from './Composer';

/* Radix measures its tooltips and menus before positioning them; jsdom has no
   ResizeObserver. Geometry belongs to the Chromium stories. */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

/* ── The harness ─────────────────────────────────────────────────────────────── */

type Spies = { readonly [K in keyof ComposerActions]-?: Mock<NonNullable<ComposerActions[K]>> };

function spies(): Spies {
  return {
    setDraft: vi.fn<ComposerActions['setDraft']>(),
    send: vi.fn<ComposerActions['send']>(),
    stop: vi.fn<ComposerActions['stop']>(),
    removeQueued: vi.fn<ComposerActions['removeQueued']>(),
    continueQueued: vi.fn<ComposerActions['continueQueued']>(),
    removeChip: vi.fn<ComposerActions['removeChip']>(),
    addMention: vi.fn<ComposerActions['addMention']>(),
    setMode: vi.fn<ComposerActions['setMode']>(),
    setModel: vi.fn<ComposerActions['setModel']>(),
    enhanceDraft: vi.fn<ComposerActions['enhanceDraft']>(),
    restoreDraft: vi.fn<ComposerActions['restoreDraft']>(),
    answerClarify: vi.fn<ComposerActions['answerClarify']>(),
    sendAsWritten: vi.fn<ComposerActions['sendAsWritten']>(),
    dismissClarify: vi.fn<ComposerActions['dismissClarify']>(),
    setComposerFocused: vi.fn<(focused: boolean) => void>(),
  };
}

interface Control {
  set: ComposerFixture['set'];
}

interface PanelProps {
  readonly initial: ComposerView;
  readonly spy: Spies;
  /** Hands the test the fixture's `set`, to move the view as the engine would. */
  readonly onFixture: (set: ComposerFixture['set']) => void;
  readonly awaitingPlan?: boolean;
}

/** The panel around the composer: re-renders on the textarea's focus, as AgentPanel does. */
function Panel({ initial, spy, onFixture, awaitingPlan = false }: PanelProps) {
  const [focused, setFocused] = useState(false);
  const fixture = useComposerFixture(initial, {
    spy: {
      ...spy,
      setComposerFocused: (value) => {
        setFocused(value);
        spy.setComposerFocused(value);
      },
    },
  });
  useEffect(() => {
    onFixture(fixture.set);
  });
  return (
    <AgentTooltipProvider>
      <Composer
        view={fixture.view}
        actions={fixture.actions}
        awaitingPlan={awaitingPlan}
        className={focused ? 'is-focused' : 'is-blurred'}
      />
    </AgentTooltipProvider>
  );
}

function mount(overrides: Partial<ComposerView> = {}, awaitingPlan = false) {
  const spy = spies();
  const control: Control = { set: () => undefined };
  const utils = render(
    <Panel
      initial={composerView(overrides)}
      spy={spy}
      onFixture={(set) => {
        control.set = set;
      }}
      awaitingPlan={awaitingPlan}
    />,
  );
  const composer = utils.container.querySelector('.ck-agent-composer');
  if (!(composer instanceof HTMLElement)) throw new Error('no composer');
  return { ...utils, spy, control, composer, user: userEvent.setup() };
}

function box(locale: Locale = 'en'): HTMLTextAreaElement {
  return screen.getByRole('combobox', { name: t(locale, 'input.aria') }) as HTMLTextAreaElement;
}

function button(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

/** The deepest node a real pointer lands on: the button's glyph. */
function glyphIn(element: HTMLElement): Element {
  const glyph = element.querySelector('svg')?.firstElementChild ?? null;
  if (glyph === null) throw new Error('no glyph in the button');
  return glyph;
}

/* ── Enter, Shift+Enter and input methods ──────────────────────────────────── */

describe('Composer: Enter', () => {
  it('sends the draft on Enter, clears the box and keeps focus in it', async () => {
    const { user, spy } = mount();
    await user.type(box(), 'Make the header sticky');
    await user.keyboard('{Enter}');
    expect(spy.send).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue('');
    expect(box()).toHaveFocus();
  });

  it('writes a new line on Shift+Enter and never sends', async () => {
    const { user, spy } = mount();
    await user.type(box(), 'One');
    await user.keyboard('{Shift>}{Enter}{/Shift}Two');
    expect(spy.send).not.toHaveBeenCalled();
    expect(box()).toHaveValue('One\nTwo');
  });

  it('ignores the Enter that commits an input method’s composition (isComposing)', () => {
    const { spy } = mount({ draft: DRAFT.ar, locale: 'ar' });
    const field = box('ar');
    fireEvent.keyDown(field, { key: 'Enter', code: 'Enter', isComposing: true });
    expect(spy.send).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    expect(spy.send).toHaveBeenCalledTimes(1);
  });

  it('ignores Safari’s committing Enter, which carries key code 229 instead', () => {
    const { spy } = mount({ draft: DRAFT.en });
    fireEvent.keyDown(box(), { key: 'Enter', code: 'Enter', keyCode: 229 });
    expect(spy.send).not.toHaveBeenCalled();
  });

  it('does nothing on Enter in an empty box', async () => {
    const { user, spy } = mount();
    await user.click(box());
    await user.keyboard('{Enter}');
    expect(spy.send).not.toHaveBeenCalled();
  });
});

/* ── The `@` list ─────────────────────────────────────────────────────────── */

describe('Composer: the @ list', () => {
  it('is the textarea’s listbox: expanded, controlled and pointed at the active option', async () => {
    const { user } = mount();
    await user.type(box(), 'Move @se');
    const list = screen.getByRole('listbox');
    const options = within(list).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Services3 of 8', 'Session prices']);
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    expect(box()).toHaveAttribute('aria-controls', list.id);
    expect(box()).toHaveAttribute('aria-activedescendant', options[0]?.id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('moves with ↓ ↑ and picks with Enter, which never sends', async () => {
    const { user, spy } = mount();
    await user.type(box(), 'Move @se');
    await user.keyboard('{ArrowDown}');
    const second = screen.getAllByRole('option')[1];
    expect(box()).toHaveAttribute('aria-activedescendant', second?.id);
    await user.keyboard('{Enter}');
    expect(spy.addMention).toHaveBeenCalledWith('node-session');
    expect(spy.send).not.toHaveBeenCalled();
    expect(box()).toHaveValue('Move ');
    expect(button('Remove Session prices from the request')).toBeInTheDocument();
    expect(box()).toHaveFocus();
  });

  it('picks with Tab, and focus stays in the box', async () => {
    const { user, spy } = mount();
    await user.type(box(), '@se');
    await user.keyboard('{Tab}');
    expect(spy.addMention).toHaveBeenCalledWith('node-services');
    expect(spy.send).not.toHaveBeenCalled();
    expect(box()).toHaveFocus();
  });

  it('closes on Esc and stays in the field; a second Esc leaves the field', async () => {
    const { user } = mount();
    await user.type(box(), 'Move @se');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(box()).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(document.body).toHaveFocus();
  });

  it('says so when nothing matches, and Enter then sends as usual', async () => {
    const { user, spy } = mount();
    await user.type(box(), 'Move @pricing');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box()).toHaveAccessibleDescription(expect.stringContaining(t('en', 'mention.empty')));
    await user.keyboard('{Enter}');
    expect(spy.send).toHaveBeenCalledTimes(1);
  });

  it('opens from [@], typing the @ into the box and keeping focus there', async () => {
    const { user } = mount({ draft: 'Move' });
    await user.click(button(t('en', 'mention.button')));
    expect(box()).toHaveValue('Move @');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(box()).toHaveFocus();
  });
});

/* ── Chips ─────────────────────────────────────────────────────────────────── */

describe('Composer: context chips', () => {
  it('removes the last chip on Backspace in an empty box', async () => {
    const { user, spy } = mount({
      chips: [blockChip('en', 'hero'), blockChip('en', 'services', { kind: 'mention' })],
    });
    await user.click(box());
    await user.keyboard('{Backspace}');
    expect(spy.removeChip).toHaveBeenCalledWith('node-services');
  });

  it('never removes the Whole page scope', async () => {
    const { user, spy } = mount();
    await user.click(box());
    await user.keyboard('{Backspace}');
    expect(spy.removeChip).not.toHaveBeenCalled();
    expect(screen.getByText(t('en', 'scope.page'))).toBeInTheDocument();
  });

  it('returns focus to the box after a chip’s ×', async () => {
    const { user, spy } = mount({ chips: [blockChip('en', 'hero')] });
    await user.click(button('Remove Hero from the request'));
    expect(spy.removeChip).toHaveBeenCalledWith('node-hero');
    expect(box()).toHaveFocus();
  });

  it('describes the box by its context', () => {
    mount({ chips: [blockChip('en', 'hero')] });
    expect(box()).toHaveAccessibleDescription(expect.stringContaining('Hero'));
  });
});

/* ── Stop ──────────────────────────────────────────────────────────────────── */

describe('Composer: Stop', () => {
  it('keeps focus on Stop while it stops, then the textarea once the RunBar leaves', async () => {
    const { user, spy, control } = mount({ run: liveRun(Date.now()) });
    const stop = button('Stop');
    await user.click(stop);
    expect(spy.stop).toHaveBeenCalledTimes(1);
    const stopping = button('Stopping…');
    expect(stopping).toBe(stop);
    expect(stopping).toHaveAttribute('aria-disabled', 'true');
    expect(stopping).toHaveFocus();

    await user.click(stopping);
    expect(spy.stop).toHaveBeenCalledTimes(1);

    act(() => {
      control.set({ run: null });
    });
    expect(screen.queryByRole('button', { name: 'Stopping…' })).toBeNull();
    expect(box()).toHaveFocus();
  });

  it('stops on Ctrl+. from the box', async () => {
    const { user, spy } = mount({ run: liveRun(Date.now()) });
    await user.click(box());
    await user.keyboard('{Control>}.{/Control}');
    expect(spy.stop).toHaveBeenCalledTimes(1);
  });

  it('stops on ⌘. too, and not again while it is stopping', async () => {
    const { user, spy } = mount({ run: liveRun(Date.now()) });
    await user.click(box());
    await user.keyboard('{Meta>}.{/Meta}');
    await user.keyboard('{Meta>}.{/Meta}');
    expect(spy.stop).toHaveBeenCalledTimes(1);
  });

  it('does nothing on the chord with no run', async () => {
    const { user, spy } = mount();
    await user.click(box());
    await user.keyboard('{Control>}.{/Control}');
    expect(spy.stop).not.toHaveBeenCalled();
  });

  it('is never in the Send slot', () => {
    mount({ run: liveRun(Date.now()), draft: DRAFT.en });
    const toolbar = document.querySelector('.ck-agent-toolbar');
    if (!(toolbar instanceof HTMLElement)) throw new Error('no toolbar');
    expect(within(toolbar).queryByRole('button', { name: /stop/iu })).toBeNull();
  });
});

/* ── The one queued request ────────────────────────────────────────────────── */

describe('Composer: the queued request is the composer’s own text', () => {
  it('queues the draft on Enter while running: the text stays, headed by Up next', async () => {
    const { user, spy } = mount({ run: liveRun(Date.now()) });
    await user.type(box(), 'Make the header sticky');
    expect(button('Queue as next')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(spy.send).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue('Make the header sticky');
    expect(box()).toHaveFocus();
    expect(screen.getByRole('group', { name: t('en', 'queue.label') })).toBeInTheDocument();
    expect(button('Queued')).toHaveAttribute('aria-disabled', 'true');
    expect(box()).toHaveAccessibleDescription(
      expect.stringContaining(`${t('en', 'queue.label')} ${t('en', 'queue.caption')}`),
    );
    // One field: the page holds exactly one place where words are written.
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('edits the queued request as the text is edited, and stays queued', async () => {
    const { user } = mount({ run: liveRun(Date.now()), draft: DRAFT.en, queue: queued('en') });
    await user.type(box(), ' now');
    expect(box()).toHaveValue(`${DRAFT.en} now`);
    expect(button('Queued')).toBeInTheDocument();
  });

  it('removes it with ×, clearing the box and focusing it', async () => {
    const { user, spy } = mount({ run: liveRun(Date.now()), draft: DRAFT.en, queue: queued('en') });
    await user.click(button(t('en', 'queue.remove')));
    expect(spy.removeQueued).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue('');
    expect(box()).toHaveFocus();
  });

  it('shows a paused request with its own text, and Continue returns to the box', async () => {
    const { user, spy } = mount({ queue: queued('en', 'paused') });
    const group = screen.getByRole('group', { name: t('en', 'queue.label') });
    expect(group).toHaveTextContent(DRAFT.en);
    expect(box()).toHaveValue('');
    await user.click(within(group).getByRole('button', { name: t('en', 'queue.continue') }));
    expect(spy.continueQueued).toHaveBeenCalledTimes(1);
    expect(box()).toHaveFocus();
  });

  it('says a missing target cannot run as written', () => {
    mount({ run: liveRun(Date.now()), draft: DRAFT.en, queue: queued('en', 'missing') });
    expect(screen.getByRole('group', { name: t('en', 'queue.label') })).toHaveAccessibleDescription(
      t('en', 'queue.missing'),
    );
  });
});

/* ── Direction and placeholder ─────────────────────────────────────────────── */

describe('Composer: direction follows the words (resolveDir)', () => {
  it('turns right to left for Arabic typed into the English panel', async () => {
    const { user } = mount();
    expect(box()).toHaveAttribute('dir', 'ltr');
    await user.type(box(), ARABIC_DRAFT);
    await waitFor(() => {
      expect(box()).toHaveAttribute('dir', 'rtl');
    });
    await user.clear(box());
    expect(box()).toHaveAttribute('dir', 'ltr');
  });

  it('turns left to right for a Latin request in the Arabic panel', async () => {
    mount({ locale: 'ar', draft: LATIN_DRAFT });
    await waitFor(() => {
      expect(box('ar')).toHaveAttribute('dir', 'ltr');
    });
  });

  it('follows the UI while empty, so the placeholder does', () => {
    mount({ locale: 'ar' });
    expect(box('ar')).toHaveAttribute('dir', 'rtl');
    expect(box('ar')).toHaveAttribute('placeholder', t('ar', 'placeholder.auto'));
  });

  it.each([
    ['auto', 'placeholder.auto'],
    ['ask', 'placeholder.ask'],
    ['plan', 'placeholder.plan'],
  ] as const)('reads the %s mode’s placeholder', (mode, key) => {
    mount({ mode });
    expect(box()).toHaveAttribute('placeholder', t('en', key));
  });

  it('asks for the next request while running, and for a plan change after a plan', () => {
    const running = mount({ run: liveRun(Date.now()) });
    expect(box()).toHaveAttribute('placeholder', t('en', 'placeholder.running'));
    running.unmount();
    mount({ mode: 'plan' }, true);
    expect(box()).toHaveAttribute('placeholder', t('en', 'placeholder.afterPlan'));
  });
});

/* ── ✨ Improve ─────────────────────────────────────────────────────────────── */

describe('Composer: ✨ Improve', () => {
  it('locks the box while it works: read-only, busy, and Enter does not send', () => {
    const { spy } = mount({ draft: ROUGH_DRAFT.en, enhancement: { status: 'enhancing' } });
    expect(box()).toHaveAttribute('readonly');
    expect(box()).toHaveAttribute('aria-busy', 'true');
    fireEvent.keyDown(box(), { key: 'Enter', code: 'Enter' });
    expect(spy.send).not.toHaveBeenCalled();
    expect(button(t('en', 'enhance.working'))).toHaveAttribute('aria-disabled', 'true');
    const shimmer = document.querySelector('.ck-agent-composer__shimmer');
    expect(shimmer).toHaveAttribute('aria-hidden', 'true');
    expect(shimmer).toHaveTextContent(ROUGH_DRAFT.en);
  });

  it('shows the note once improved, and Restore my text returns focus to the box', async () => {
    const { user, spy } = mount({
      draft: DRAFT.en,
      enhancement: enhancement('en', 'enhanced'),
    });
    expect(screen.getByRole('group', { name: t('en', 'enhance.done') })).toBeInTheDocument();
    await user.click(button(t('en', 'enhance.restore')));
    expect(spy.restoreDraft).toHaveBeenCalledTimes(1);
    expect(box()).toHaveFocus();
  });

  it('is absent where the provider cannot rewrite', () => {
    mount({ draft: DRAFT.en, enhancement: { status: 'unavailable' } });
    expect(screen.queryByRole('button', { name: t('en', 'enhance.button') })).toBeNull();
  });
});

/* ── Questions before guessing ─────────────────────────────────────────────── */

describe('Composer: the clarifying questions', () => {
  it('moves focus to the first question’s first chip when they open', () => {
    mount({ clarify: clarifying('en', 3) });
    expect(screen.getByRole('radio', { name: 'Services' })).toHaveFocus();
  });

  it('answers a question with a chip, then asks the next', async () => {
    const { user, spy } = mount({ clarify: clarifying('en', 2) });
    await user.click(screen.getByRole('radio', { name: 'Contact us' }));
    expect(spy.answerClarify).toHaveBeenCalledWith('q-page', 'Contact us');
    expect(screen.getByRole('radio', { name: 'In the header' })).toHaveFocus();
  });

  it('Send as written calls the controller and returns focus to the box', async () => {
    const { user, spy } = mount({ clarify: clarifying('en', 3) });
    await user.click(button(t('en', 'clarify.sendAsWritten')));
    expect(spy.sendAsWritten).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: t('en', 'clarify.title') })).toBeNull();
    expect(box()).toHaveFocus();
  });

  it('Cancel puts the request back in the box, focused', async () => {
    const { user, spy } = mount({ clarify: clarifying('en', 1) });
    await user.click(button(t('en', 'clarify.cancel')));
    expect(spy.dismissClarify).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue(clarifying('en', 1).request);
    expect(box()).toHaveFocus();
  });
});

/* ── What never reaches the screen ─────────────────────────────────────────── */

describe('Composer: no internals on screen (SPEC §6.5, §7.4)', () => {
  it('shows no token or cost figures and no raw model ids, even with the model menu open', async () => {
    const { user, container } = mount({
      run: liveRun(Date.now()),
      draft: DRAFT.en,
      queue: queued('en'),
      enhancement: enhancement('en', 'enhanced'),
    });
    await user.click(button('Model: Fast'));
    const text = `${container.textContent} ${document.body.textContent}`;
    expect(text).not.toMatch(/tokens?|~\s*\d|\d+(?:\.\d+)?k\b|\$\s*\d/iu);
    for (const id of MODEL_IDS) expect(text).not.toContain(id);
    expect(text).not.toMatch(/cli:|:free|minimax\//u);
  });

  it('tells the face when the box has focus', async () => {
    const { user, spy } = mount();
    await user.click(box());
    expect(spy.setComposerFocused).toHaveBeenLastCalledWith(true);
    await user.click(document.body);
    expect(spy.setComposerFocused).toHaveBeenLastCalledWith(false);
  });
});

/* ── The first-click regression (visual audit P0-1) ─────────────────────────── */

/**
 * Type, then press a control once: pointerdown moves focus to it, the textarea blurs, the
 * panel re-renders, then pointerup. The press must land on the FIRST try. user-event
 * computes the click as a browser does (the common ancestor of the pointerdown and pointerup
 * targets), so a glyph replaced mid-press would lose it here as it did in Chromium.
 */
async function pressAfterBlur(
  target: () => HTMLElement,
  harness: ReturnType<typeof mount>,
): Promise<void> {
  const { user, composer } = harness;
  const control0 = target();
  expect(composer).toHaveClass('is-focused');

  const pressed = glyphIn(control0);
  await user.pointer({ keys: '[MouseLeft>]', target: pressed });
  // Between press and release: focus moved to the control, the textarea blurred, and the
  // panel re-rendered around it (its class follows the focus). This is the window the v1
  // bug lived in.
  expect(control0).toHaveFocus();
  expect(composer).toHaveClass('is-blurred');

  const released = glyphIn(target());
  expect(released).toBe(pressed);
  await user.pointer({ keys: '[/MouseLeft]', target: released });
}

describe('Composer: the first press after the textarea blurs lands', () => {
  it('Send', async () => {
    const harness = mount();
    await harness.user.type(box(), 'Make the header sticky');
    await pressAfterBlur(() => button('Send'), harness);
    expect(harness.spy.send).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue('');
  });

  it('Stop', async () => {
    const harness = mount({ run: liveRun(Date.now()) });
    await harness.user.type(box(), 'Next');
    await pressAfterBlur(() => button('Stop'), harness);
    expect(harness.spy.stop).toHaveBeenCalledTimes(1);
    expect(button('Stopping…')).toHaveFocus();
  });

  it('✨ Improve', async () => {
    const harness = mount();
    await harness.user.type(box(), 'make hero darker');
    await pressAfterBlur(() => button(t('en', 'enhance.button')), harness);
    expect(harness.spy.enhanceDraft).toHaveBeenCalledTimes(1);
    expect(box()).toHaveAttribute('aria-busy', 'true');
  });
});

/* ── The family's stylesheets ─────────────────────────────────────────────── */

const COMPONENTS = join(process.cwd(), 'src', 'features', 'agent', 'components');

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const SHEETS = [
  'Composer/Composer.css',
  'RunBar/RunBar.css',
  'StopButton/StopButton.css',
  'QueueHeader/QueueHeader.css',
  'ContextChip/ContextChip.css',
  'MentionMenu/MentionMenu.css',
  'ComposerToolbar/ComposerToolbar.css',
  'ComposerToolbar/ChoiceMenu.css',
  'ModeMenu/ModeMenu.css',
  'ModelMenu/ModelMenu.css',
  'SendButton/SendButton.css',
  'EnhanceButton/EnhanceButton.css',
  'EnhanceNote/EnhanceNote.css',
  'ClarifyPanel/ClarifyPanel.css',
] as const;

function sheet(path: string): string {
  return readFileSync(join(COMPONENTS, path), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');
}

describe('the composer family’s stylesheets', () => {
  it.each(SHEETS)('%s reads only --bldr-* tokens the chrome contract defines', (path) => {
    const used = [...sheet(path).matchAll(/var\((--bldr-[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
  });

  it.each(SHEETS)('%s uses logical properties and no raw colour', (path) => {
    const css = sheet(path);
    expect(css).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(css).not.toMatch(/text-align:\s*(?:left|right)|translateX\(/u);
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/iu);
  });

  it('prefixes every class with ck-agent-', () => {
    for (const path of SHEETS) {
      const classes = [...sheet(path).matchAll(/\.([a-z][\w-]*)/gu)].map(([, name = '']) => name);
      expect(classes.filter((name) => !name.startsWith('ck-agent-') && name !== 'bldr-visually-hidden')).toEqual([]);
    }
  });

  it('gives the box 2 to 6 lines, and 16px type under a coarse pointer through the tokens', () => {
    const css = sheet('Composer/Composer.css');
    expect(css).toContain('min-block-size: calc(2 * var(--bldr-line-height-input))');
    expect(css).toContain('max-block-size: calc(6 * var(--bldr-line-height-input))');
    expect(css).toMatch(/font-size:\s*var\(--bldr-font-size-input\)/u);
  });

  it('never animates the composer border, and shimmers only without reduced motion', () => {
    const css = sheet('Composer/Composer.css');
    expect(css).not.toMatch(/--pg-magic|animation:[^;]*border/u);
    const shimmerAt = css.indexOf('animation: ck-agent-composer-shimmer');
    const guardAt = css.lastIndexOf('@media (prefers-reduced-motion: no-preference)', shimmerAt);
    expect(guardAt).toBeGreaterThan(-1);
  });
});

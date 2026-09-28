import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState, type CSSProperties } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

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
  LONG_DRAFT,
  LONG_LABEL,
  liveRun,
  MENTION,
  MENTION_EMPTY,
  queued,
  ROUGH_DRAFT,
  IMPROVED_DRAFT,
  stoppingRun,
  useComposerFixture,
  type ComposerFixtureOptions,
} from '../../testing/wp-14-composer-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { Composer, type ComposerActions, type ComposerView } from './Composer';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
  /**
   * Preview the coarse-pointer sizes (SPEC §2.3, §6.4) on a desktop: the inherited
   * properties the stylesheets read under `(pointer: coarse)`, set on the dock instead.
   */
  readonly coarse?: boolean;
}

/**
 * The coarse block of `chrome.css` and of the composer family's stylesheets, as inline
 * custom properties: 44px targets 8px apart, 44px rows, 16px input type (26 Arabic).
 */
function coarseStyle(locale: Locale): CSSProperties {
  return {
    '--ck-agent-target': 'var(--bldr-hit-target-min)',
    '--ck-agent-toolbar-gap': 'var(--bldr-space-md)',
    '--ck-agent-chip-gap': 'var(--bldr-space-3xl)',
    '--bldr-agent-row-height': 'var(--bldr-hit-target-min)',
    '--bldr-agent-runbar-height': '52px',
    '--bldr-font-size-input': '16px',
    '--bldr-line-height-input': locale === 'ar' ? '26px' : '24px',
  } as CSSProperties;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container. The composer sits where it lives, in
 * the dock (inline 8, block-end 8) at the foot of the panel, with room above it for the
 * `@` list and the menus, which open upwards.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const {
    locale = 'en',
    theme = 'light',
    width = 320,
    coarse = false,
  } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          minBlockSize: 420,
          padding: '0 var(--bldr-space-md) var(--bldr-space-md)',
          ...(coarse ? coarseStyle(locale) : {}),
        }}
      >
        <AgentTooltipProvider>
          <Story />
        </AgentTooltipProvider>
      </div>
    </div>
  );
};

/* ── A composer that moves, starting in the state the story names ─────────── */

/** Stories render at module load; a live run's clock counts from 1:12 before this moment. */
const NOW = Date.now();

/** Every action as a Storybook spy, so the Actions panel shows what the composer called. */
function spies(): ComposerActions {
  return {
    setDraft: fn(),
    send: fn(),
    stop: fn(),
    removeQueued: fn(),
    continueQueued: fn(),
    removeChip: fn(),
    addMention: fn(),
    setMode: fn(),
    setModel: fn(),
    enhanceDraft: fn(),
    restoreDraft: fn(),
    answerClarify: fn(),
    sendAsWritten: fn(),
    dismissClarify: fn(),
    setComposerFocused: fn(),
  };
}

interface HarnessProps {
  readonly view: ComposerView;
  readonly actions: ComposerActions;
  readonly awaitingPlan?: boolean | undefined;
  /** Timers for the engine's side; a story that only shows a state leaves them out. */
  readonly timing?: Omit<ComposerFixtureOptions, 'spy'> | undefined;
}

/**
 * The composer on the fixture harness: it opens in the story's view and then behaves as
 * the controller would (typing, Send, Stop, the queue, Improve, the questions), calling the
 * story's spies after each move. The panel re-renders as the textarea gains and loses
 * focus, exactly as AgentPanel does (the face listens), which is the window the first-click
 * regression stories press into.
 */
function Harness({ view, actions, awaitingPlan, timing = {} }: HarnessProps) {
  const [focused, setFocused] = useState(false);
  const fixture = useComposerFixture(view, {
    ...timing,
    spy: {
      ...actions,
      setComposerFocused: (value) => {
        setFocused(value);
        actions.setComposerFocused?.(value);
      },
    },
  });
  return (
    <Composer
      view={fixture.view}
      actions={fixture.actions}
      awaitingPlan={awaitingPlan}
      className={focused ? 'is-focused' : 'is-blurred'}
    />
  );
}

/* ── A real pointer, when the story runs under Vitest's browser mode ─────── */

/* The first-click bug lived between a real pointerdown and pointerup, so the regression
   stories press with Playwright's mouse when they can (the storybook test task). In the
   Storybook UI there is none; the play falls back to a synthetic press, and your own
   pointer is the real test. */
interface RealPointer {
  click(element: Element): Promise<void>;
}

async function realPointer(): Promise<RealPointer | null> {
  if (!('__vitest_browser__' in globalThis)) return null;
  const { userEvent: browserUserEvent } = await import('vitest/browser');
  return browserUserEvent;
}

async function press(element: Element): Promise<void> {
  const pointer = await realPointer();
  if (pointer === null) await userEvent.click(element);
  else await pointer.click(element);
}

function field(canvasElement: HTMLElement, locale: Locale = 'en'): HTMLTextAreaElement {
  return within(canvasElement).getByRole('combobox', {
    name: t(locale, 'input.aria'),
  }) as HTMLTextAreaElement;
}

const meta = {
  title: 'Agent/Composer/Composer',
  component: Composer,
  parameters: { layout: 'centered' },
  args: { view: composerView(), actions: spies() },
  render: ({ view, actions, awaitingPlan }) => (
    <Harness view={view} actions={actions} awaitingPlan={awaitingPlan} />
  ),
  decorators: [inPanel],
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ── The Send slot: every state of `send-state.ts` (SPEC §4.17) ───────────── */

/**
 * Idle, empty (SPEC §3.1): the "Whole page" scope, two lines of placeholder, Auto ▾ Fast ▾,
 * ✨ `[@]` and Send, `aria-disabled` on the Wash. Enter does nothing.
 */
export const IdleEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(field(canvasElement)).toHaveAttribute('placeholder', t('en', 'placeholder.auto'));
    await expect(canvas.getByRole('button', { name: 'Send' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(canvas.getByText(t('en', 'scope.page'))).toBeInTheDocument();
  },
};

/** Idle, a draft: Send turns Indigo; Enter sends. */
export const IdleReady: Story = {
  args: { view: composerView({ draft: DRAFT.en }) },
};

/** A run is live and the box is empty: the RunBar is fused on top; Send waits. */
export const RunningEmpty: Story = {
  args: { view: composerView({ run: liveRun(NOW) }) },
  play: async ({ canvasElement }) => {
    await expect(field(canvasElement)).toHaveAttribute(
      'placeholder',
      t('en', 'placeholder.running'),
    );
  },
};

/**
 * A run is live and there is a draft (SPEC §3.9, before Enter): the Send slot is Queue as
 * next ↵. Stop keeps its own place in the RunBar; it is never in this slot.
 */
export const RunningReady: Story = {
  args: { view: composerView({ run: liveRun(NOW), draft: DRAFT.en }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Queue as next' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  },
};

/**
 * Queued (SPEC §3.9, after Enter): the text stays and becomes the one queued request,
 * headed by "Up next". There is no second field; the slot says Queued, `aria-disabled`.
 */
export const RunningQueued: Story = {
  args: {
    view: composerView({ run: liveRun(NOW), draft: DRAFT.en, queue: queued('en') }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Queued' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(field(canvasElement)).toHaveValue(DRAFT.en);
    await expect(canvas.getByRole('group', { name: t('en', 'queue.label') })).toBeInTheDocument();
  },
};

/** Stopping (SPEC §3.10): the RunBar says so, Stop spins and keeps its word. */
export const Stopping: Story = {
  args: { view: composerView({ run: stoppingRun(NOW) }) },
};

/** Stopping with a request queued: the slot keeps Queued while the engine settles. */
export const StoppingQueued: Story = {
  args: {
    view: composerView({ run: stoppingRun(NOW), draft: DRAFT.en, queue: queued('en') }),
  },
};

/* ── The one queued request (SPEC §3.9, §3.10) ─────────────────────────────── */

/** Revalidated against the page: the target changed, so it'll be rechecked (Amber). */
export const QueueStale: Story = {
  args: {
    view: composerView({ run: liveRun(NOW), draft: DRAFT.en, queue: queued('en', 'stale') }),
  },
};

/** The target is gone (Alarm): it cannot run as written. */
export const QueueMissing: Story = {
  args: {
    view: composerView({ run: liveRun(NOW), draft: DRAFT.en, queue: queued('en', 'missing') }),
  },
};

/**
 * Paused after Stop (SPEC §3.10): the request keeps its own text and scope above a
 * Hairline, with Continue; the box below is empty for a new draft.
 */
export const QueuePaused: Story = {
  args: { view: composerView({ queue: queued('en', 'paused') }) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: t('en', 'queue.continue') }),
    ).toBeInTheDocument();
    await expect(field(canvasElement)).toHaveValue('');
  },
};

/* ── Context and `@` (SPEC §3.2) ───────────────────────────────────────────── */

/** The selection chip and an `@` chip; each `×` is a 32px target. */
export const ContextChips: Story = {
  args: {
    view: composerView({
      draft: 'Match the services cards to the hero',
      chips: [blockChip('en', 'hero'), blockChip('en', 'services', { kind: 'mention' })],
    }),
  },
};

/** A chip whose block is gone: struck through, and the line under it says so. */
export const StaleChip: Story = {
  args: {
    view: composerView({
      draft: DRAFT.en,
      chips: [blockChip('en', 'faq', { stale: true }), blockChip('en', 'hero', { label: LONG_LABEL.en })],
    }),
  },
};

/** The `@` list, open above the card: the active option has the Mist and the Indigo bar. */
export const MentionOpen: Story = {
  args: {
    view: composerView({
      draft: 'Match the services cards to the hero, then move @se',
      chips: [blockChip('en', 'hero')],
      mention: MENTION.en,
    }),
  },
  play: async ({ canvasElement }) => {
    const input = field(canvasElement);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const list = within(canvasElement).getByRole('listbox');
    await expect(input).toHaveAttribute('aria-controls', list.id);
  },
};

/** No block by that name: a line, not an empty listbox. */
export const MentionEmpty: Story = {
  args: { view: composerView({ draft: 'Move @pricing', mention: MENTION_EMPTY.en }) },
};

/**
 * Type `@se`, ↓, Enter: the second match (Session prices) becomes a chip, and the fragment
 * leaves the text. Enter picks; it never sends.
 */
export const MentionPickByKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const input = field(canvasElement);
    await userEvent.click(input);
    await userEvent.keyboard('Move @se');
    await waitFor(() => expect(within(canvasElement).getByRole('listbox')).toBeVisible());
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(
      within(canvasElement).getByRole('button', { name: 'Remove Session prices from the request' }),
    ).toBeInTheDocument();
    await expect(input).toHaveValue('Move ');
    await expect(input).toHaveFocus();
  },
};

/* ── Modes (SPEC §4.17 ModeMenu) ───────────────────────────────────────────── */

export const ModeAuto: Story = {
  args: { view: composerView({ mode: 'auto' }) },
};

/** Ask first: the placeholder says the change is shown before it is applied. */
export const ModeAsk: Story = {
  args: { view: composerView({ mode: 'ask' }) },
  play: async ({ canvasElement }) => {
    await expect(field(canvasElement)).toHaveAttribute('placeholder', t('en', 'placeholder.ask'));
  },
};

/** Plan: writes an editable plan and never changes the page. */
export const ModePlan: Story = {
  args: { view: composerView({ mode: 'plan' }) },
  play: async ({ canvasElement }) => {
    await expect(field(canvasElement)).toHaveAttribute('placeholder', t('en', 'placeholder.plan'));
  },
};

/** A page plan waits in the thread: the empty box asks for a change to it (SPEC §3.7). */
export const AfterPlan: Story = {
  args: { view: composerView({ mode: 'plan' }), awaitingPlan: true },
};

/* ── The words ─────────────────────────────────────────────────────────────── */

/** Six lines, then it scrolls (FR-059); the gutter is reserved so the words never reflow. */
export const LongDraft: Story = {
  args: { view: composerView({ draft: LONG_DRAFT.en }) },
};

/** An Arabic request in the English panel: the box follows its words (`resolveDir`). */
export const ArabicInEnglishPanel: Story = {
  args: { view: composerView({ draft: ARABIC_DRAFT }) },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(field(canvasElement)).toHaveAttribute('dir', 'rtl'));
  },
};

/* ── ✨ Improve my request (the owner's tool) ─────────────────────────────── */

/** A rough draft: ✨ is ready beside `[@]`. */
export const ImproveIdle: Story = {
  args: { view: composerView({ draft: ROUGH_DRAFT.en }) },
};

/** Improving: the box is locked, its words step back to Slate and a light runs through them. */
export const ImproveEnhancing: Story = {
  args: { view: composerView({ draft: ROUGH_DRAFT.en, enhancement: { status: 'enhancing' } }) },
  play: async ({ canvasElement }) => {
    const input = field(canvasElement);
    await expect(input).toHaveAttribute('readonly');
    await expect(input).toHaveAttribute('aria-busy', 'true');
    await expect(
      within(canvasElement).getByRole('button', { name: t('en', 'enhance.working') }),
    ).toHaveAttribute('aria-disabled', 'true');
  },
};

/** Improved: the rewrite is in the box; the note says what was understood and what changed. */
export const ImproveEnhanced: Story = {
  args: {
    view: composerView({ draft: IMPROVED_DRAFT.en, enhancement: enhancement('en', 'enhanced') }),
  },
};

/** It could not improve: one honest line; the text is as it was. */
export const ImproveFailed: Story = {
  args: {
    view: composerView({ draft: ROUGH_DRAFT.en, enhancement: enhancement('en', 'failed') }),
  },
};

/** The provider cannot rewrite: no ✨ at all, rather than a control that never works. */
export const ImproveUnavailable: Story = {
  args: {
    view: composerView({ draft: ROUGH_DRAFT.en, enhancement: enhancement('en', 'unavailable') }),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('button', { name: t('en', 'enhance.button') }),
    ).toBeNull();
  },
};

/** Press ✨, watch it work, then Restore my text puts the person's words back. */
export const ImproveThenRestore: Story = {
  args: { view: composerView({ draft: ROUGH_DRAFT.en }) },
  render: ({ view, actions }) => (
    <Harness view={view} actions={actions} timing={{ enhanceMs: 900 }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await press(canvas.getByRole('button', { name: t('en', 'enhance.button') }));
    await waitFor(() => expect(field(canvasElement)).toHaveValue(IMPROVED_DRAFT.en), {
      timeout: 3000,
    });
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'enhance.restore') }));
    await expect(field(canvasElement)).toHaveValue(ROUGH_DRAFT.en);
    await expect(field(canvasElement)).toHaveFocus();
  },
};

/* ── Questions before guessing ─────────────────────────────────────────────── */

/** One question: no progress count, just the question, its chips, and the two ways out. */
export const ClarifyOneQuestion: Story = {
  args: { view: composerView({ clarify: clarifying('en', 1) }) },
};

/** Three questions, the first being asked; focus is on its first chip. */
export const ClarifyThreeQuestions: Story = {
  args: { view: composerView({ clarify: clarifying('en', 3) }) },
  play: async ({ canvasElement }) => {
    const radios = within(canvasElement).getAllByRole('radio');
    await waitFor(() => expect(radios[0]).toHaveFocus());
  },
};

/** Two answered, the third asked: each answer is a row back to its question. */
export const ClarifyLastQuestion: Story = {
  args: { view: composerView({ clarify: clarifying('en', 3, 2) }) },
};

/** Every question answered: the request is being rewritten with the answers. */
export const ClarifyRewriting: Story = {
  args: { view: composerView({ clarify: clarifying('en', 3, 3, 'rewriting') }) },
};

/** Answer by keyboard: → moves, Enter picks; the next question takes focus. */
export const ClarifyByKeyboard: Story = {
  args: { view: composerView({ clarify: clarifying('en', 2) }) },
  render: ({ view, actions }) => (
    <Harness view={view} actions={actions} timing={{ rewriteMs: 1200 }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getAllByRole('radio')[0]).toHaveFocus());
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await waitFor(() =>
      expect(canvas.getByRole('radio', { name: 'In the header' })).toHaveFocus(),
    );
  },
};

/* ── Behaviour the owner judges by hand ────────────────────────────────────── */

/**
 * Enter while a run is live queues the draft: the text stays in the box, now the queued
 * request, and focus stays in it (SPEC §6.3).
 */
export const EnterQueues: Story = {
  args: { view: composerView({ run: liveRun(NOW) }) },
  play: async ({ canvasElement }) => {
    const input = field(canvasElement);
    await userEvent.click(input);
    await userEvent.keyboard('Make the header sticky{Enter}');
    await expect(input).toHaveValue('Make the header sticky');
    await expect(input).toHaveFocus();
    await expect(
      within(canvasElement).getByRole('button', { name: 'Queued' }),
    ).toBeInTheDocument();
  },
};

/**
 * Stop keeps focus on Stop while it stops; when the run settles and the RunBar leaves,
 * focus lands in the textarea (SPEC §6.3). The queued request pauses.
 */
export const StopThenTextarea: Story = {
  args: { view: composerView({ run: liveRun(NOW), draft: DRAFT.en, queue: queued('en') }) },
  render: ({ view, actions }) => (
    <Harness view={view} actions={actions} timing={{ stopSettlesMs: 900 }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stop = canvas.getByRole('button', { name: 'Stop' });
    await press(stop);
    await expect(canvas.getByRole('button', { name: 'Stopping…' })).toBe(stop);
    await expect(stop).toHaveFocus();
    await waitFor(() => expect(field(canvasElement)).toHaveFocus(), { timeout: 3000 });
    await expect(canvas.getByRole('button', { name: t('en', 'queue.continue') })).toBeVisible();
  },
};

/* ── The regression: the first press after the textarea blurs ──────────────── */

/**
 * Type, then press Send once. The textarea blurs on pointerdown and the panel re-renders
 * before pointerup; the press must still land (visual audit P0-1).
 */
export const FirstClickSend: Story = {
  play: async ({ canvasElement }) => {
    const input = field(canvasElement);
    await userEvent.click(input);
    await userEvent.keyboard('Make the header sticky');
    await press(within(canvasElement).getByRole('button', { name: 'Send' }));
    await expect(input).toHaveValue('');
    await expect(
      within(canvasElement).getByRole('button', { name: 'Stop' }),
    ).toBeInTheDocument();
  },
};

/** The same window, for Stop: type the next request, then press Stop once. */
export const FirstClickStop: Story = {
  args: { view: composerView({ run: liveRun(NOW) }) },
  play: async ({ canvasElement }) => {
    await userEvent.click(field(canvasElement));
    await userEvent.keyboard('Next');
    await press(within(canvasElement).getByRole('button', { name: 'Stop' }));
    await expect(
      within(canvasElement).getByRole('button', { name: 'Stopping…' }),
    ).toBeInTheDocument();
  },
};

/** The same window, for ✨ Improve. */
export const FirstClickImprove: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(field(canvasElement));
    await userEvent.keyboard('make hero darker');
    await press(within(canvasElement).getByRole('button', { name: t('en', 'enhance.button') }));
    await expect(field(canvasElement)).toHaveAttribute('aria-busy', 'true');
  },
};

/* ── Theme, width, pointer ─────────────────────────────────────────────────── */

export const IdleReadyDark: Story = {
  args: { view: composerView({ draft: DRAFT.en, chips: [blockChip('en', 'hero')] }) },
  parameters: { panel: { theme: 'dark' } },
};

export const RunningQueuedDark: Story = {
  args: {
    view: composerView({ run: liveRun(NOW), draft: DRAFT.en, queue: queued('en', 'stale') }),
  },
  parameters: { panel: { theme: 'dark' } },
};

export const ImproveEnhancedDark: Story = {
  args: {
    view: composerView({ draft: IMPROVED_DRAFT.en, enhancement: enhancement('en', 'enhanced') }),
  },
  parameters: { panel: { theme: 'dark' } },
};

export const ClarifyDark: Story = {
  args: { view: composerView({ clarify: clarifying('en', 3, 1) }) },
  parameters: { panel: { theme: 'dark' } },
};

/** 288px, the narrowest panel: the toolbar holds; the RunBar clock gives way first. */
export const Narrow: Story = {
  args: { view: composerView({ run: liveRun(NOW), draft: DRAFT.en, queue: queued('en') }) },
  parameters: { panel: { width: 288 } },
};

/** 420px (container ≥ 400). */
export const Wide: Story = {
  args: {
    view: composerView({
      run: liveRun(NOW),
      draft: DRAFT.en,
      chips: [blockChip('en', 'hero'), blockChip('en', 'services', { kind: 'mention' })],
    }),
  },
  parameters: { panel: { width: 420 } },
};

/**
 * A coarse pointer, previewed: 44px targets 8px apart, 16px input type, a 52px RunBar
 * (SPEC §2.3, §6.4). The real `(pointer: coarse)` block is asserted on the stylesheets.
 */
export const CoarsePointer: Story = {
  args: {
    view: composerView({
      run: liveRun(NOW),
      draft: DRAFT.en,
      chips: [blockChip('en', 'hero')],
    }),
  },
  parameters: { panel: { coarse: true, width: 390 } },
};

/* ── Arabic, right to left (the default) ───────────────────────────────────── */

const ar = (overrides: Partial<ComposerView> = {}) => composerView({ locale: 'ar', ...overrides });

export const IdleEmptyRightToLeft: Story = {
  args: { view: ar() },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expect(field(canvasElement, 'ar')).toHaveAttribute(
      'placeholder',
      t('ar', 'placeholder.auto'),
    );
  },
};

export const IdleReadyRightToLeft: Story = {
  args: { view: ar({ draft: DRAFT.ar, chips: [blockChip('ar', 'hero')] }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const RunningReadyRightToLeft: Story = {
  args: { view: ar({ run: liveRun(NOW), draft: DRAFT.ar }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const RunningQueuedRightToLeft: Story = {
  args: { view: ar({ run: liveRun(NOW), draft: DRAFT.ar, queue: queued('ar') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const StoppingRightToLeftDark: Story = {
  args: { view: ar({ run: stoppingRun(NOW), draft: DRAFT.ar, queue: queued('ar') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const QueueMissingRightToLeft: Story = {
  args: { view: ar({ run: liveRun(NOW), draft: DRAFT.ar, queue: queued('ar', 'missing') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const QueuePausedRightToLeft: Story = {
  args: { view: ar({ queue: queued('ar', 'paused') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const MentionOpenRightToLeft: Story = {
  args: {
    view: ar({ draft: 'انقل @ال', chips: [blockChip('ar', 'hero')], mention: MENTION.ar }),
  },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const ModePlanRightToLeft: Story = {
  args: { view: ar({ mode: 'plan' }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** A Latin request in the Arabic panel: the box turns left to right with its words. */
export const LatinInArabicPanel: Story = {
  args: { view: ar({ draft: LATIN_DRAFT }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(field(canvasElement, 'ar')).toHaveAttribute('dir', 'ltr'));
  },
};

export const LongDraftRightToLeft: Story = {
  args: { view: ar({ draft: LONG_DRAFT.ar }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const ImproveIdleRightToLeft: Story = {
  args: { view: ar({ draft: ROUGH_DRAFT.ar }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** The shimmer runs in the reading direction: right to left here. */
export const ImproveEnhancingRightToLeft: Story = {
  args: { view: ar({ draft: ROUGH_DRAFT.ar, enhancement: { status: 'enhancing' } }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const ImproveEnhancedRightToLeft: Story = {
  args: { view: ar({ draft: IMPROVED_DRAFT.ar, enhancement: enhancement('ar', 'enhanced') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const ImproveFailedRightToLeftDark: Story = {
  args: { view: ar({ draft: ROUGH_DRAFT.ar, enhancement: enhancement('ar', 'failed') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const ImproveUnavailableRightToLeft: Story = {
  args: { view: ar({ draft: ROUGH_DRAFT.ar, enhancement: enhancement('ar', 'unavailable') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const ClarifyOneQuestionRightToLeft: Story = {
  args: { view: ar({ clarify: clarifying('ar', 1) }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const ClarifyThreeQuestionsRightToLeft: Story = {
  args: { view: ar({ clarify: clarifying('ar', 3, 1) }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const ClarifyRewritingRightToLeft: Story = {
  args: { view: ar({ clarify: clarifying('ar', 3, 3, 'rewriting') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const CoarsePointerRightToLeft: Story = {
  args: { view: ar({ run: liveRun(NOW), draft: DRAFT.ar, queue: queued('ar') }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', coarse: true, width: 390 } },
};

/* ── Try it ────────────────────────────────────────────────────────────────── */

/**
 * The whole composer, alive: type (and `@` a section), Send starts a run, Enter while it
 * runs queues, Stop settles after a moment and pauses the queue, ✨ rewrites after a
 * moment. Every call shows in the Actions panel.
 */
export const Playground: Story = {
  render: ({ view, actions }) => (
    <Harness
      view={view}
      actions={actions}
      timing={{ stopSettlesMs: 1500, enhanceMs: 1400, rewriteMs: 1400 }}
    />
  ),
};

export const PlaygroundRightToLeft: Story = {
  args: { view: ar() },
  render: ({ view, actions }) => (
    <Harness
      view={view}
      actions={actions}
      timing={{ stopSettlesMs: 1500, enhanceMs: 1400, rewriteMs: 1400 }}
    />
  ),
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

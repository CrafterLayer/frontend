import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { miniState, type MiniMoment } from '../../testing/wp-15-history-phone-fixtures';
// The sheet's phone density (44px targets, 16px input) is set on `.ck-agent-sheet`.
import '../AgentSheet/AgentSheet.css';
import { AgentTooltipProvider } from '../IconButton';

import { miniBarView, type MiniBarView } from './mini-bar-view';
import { SheetMiniBar, type MiniBarCommands } from './SheetMiniBar';

/* ── The mini detent, as AgentSheet draws it at 390px ─────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
}

/**
 * One phone frame per story: 390px wide (SPEC §3.16), the theme, language and direction on
 * a `.ck-agent-sheet` root (so the phone's 44px density applies), and the mini face itself:
 * Paper with 12px top corners and the overlay shadow, 8px under the row. The strip above
 * it stands for the live canvas. A story picks its frame with `parameters.panel`.
 */
const inMiniDetent: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light' } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent ck-agent-sheet"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: 390,
        paddingBlockStart: 'var(--bldr-space-6xl)',
        background: 'var(--bldr-surface-tint)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
      }}
    >
      <AgentTooltipProvider>
        <section
          aria-label={t(locale, 'header.name')}
          style={{
            paddingBlockEnd: 'var(--bldr-space-md)',
            borderStartStartRadius: 'var(--bldr-radius-xl)',
            borderStartEndRadius: 'var(--bldr-radius-xl)',
            background: 'var(--bldr-panel)',
            boxShadow: 'var(--bldr-shadow-overlay)',
          }}
        >
          <Story />
        </section>
      </AgentTooltipProvider>
    </div>
  );
};

/* ── What every mini row must be (SPEC §4.19) ────────────────────────────── */

function barOf(canvasElement: HTMLElement): HTMLElement {
  const bar = canvasElement.querySelector<HTMLElement>('.ck-agent-mini-bar');
  if (bar === null) throw new Error('no mini bar');
  return bar;
}

/**
 * The row says what the view says, offers the moment's actions and then Back to the chat,
 * every target 44px, the spine silent, and no live region: the panel's one live region
 * speaks for the row (SPEC §6.1).
 */
async function expectRow(
  canvasElement: HTMLElement,
  locale: Locale,
  view: MiniBarView,
): Promise<void> {
  const bar = barOf(canvasElement);
  const status = bar.querySelector('.ck-agent-mini-bar__status');
  await expect(status).toHaveTextContent(t(locale, view.status.key, view.status.params));
  const buttons = within(bar).getAllByRole('button');
  // One button per action of the moment, then `[⤒]`.
  await expect(buttons).toHaveLength(view.actions.length + 1);
  await expect(buttons.at(-1)).toHaveAccessibleName(t(locale, 'sheet.backToChat'));
  for (const button of buttons) {
    const box = button.getBoundingClientRect();
    await expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    await expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
  }
  await expect(
    bar.querySelectorAll('[aria-live], [role="status"], [role="log"], [role="alert"]'),
  ).toHaveLength(0);
  const spine = bar.querySelector('.ck-agent-mini-spine');
  if (spine !== null) await expect(spine).toHaveAttribute('aria-hidden', 'true');
  // No internals on screen: no token counts, no costs, no ids (SPEC §6.5, §7.4).
  await expect(bar.innerText).not.toMatch(/token|~\s*\d|\$\s*\d|turn-|tx-/iu);
}

/** The row keeps the panel's two edges: the glyph on the 16px gutter, `[⤒]` 8px from the end. */
async function expectEdges(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const bar = barOf(canvasElement).getBoundingClientRect();
  const back = within(barOf(canvasElement))
    .getByRole('button', { name: t(locale, 'sheet.backToChat') })
    .getBoundingClientRect();
  const endInset = locale === 'ar' ? back.left - bar.left : bar.right - back.right;
  await expect(Math.round(endInset)).toBe(8);
}

const commands: MiniBarCommands = {
  stop: fn(),
  undoBuild: fn(),
  redoBuild: fn(),
  finishRest: fn(),
  retrySections: fn(),
  undoEdit: fn(),
  redoEdit: fn(),
  apply: fn(),
  discard: fn(),
  tryAgain: fn(),
};

const meta = {
  title: 'Agent/Phone/SheetMiniBar',
  component: SheetMiniBar,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    view: miniBarView(miniState('building', 'en')),
    commands,
    onBackToChat: fn(),
  },
  decorators: [inMiniDetent],
} satisfies Meta<typeof SheetMiniBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One moment of the mini row, in a locale and a theme, checked against SPEC §4.19. */
function moment(
  which: MiniMoment,
  locale: Locale = 'en',
  theme: 'light' | 'dark' = 'light',
): Story {
  const view = miniBarView(miniState(which, locale));
  return {
    args: { locale, view },
    parameters: { panel: { locale, theme } },
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    play: async ({ canvasElement }) => {
      await expectRow(canvasElement, locale, view);
      await expectEdges(canvasElement, locale);
    },
  };
}

/* ── While a run is live: Stop ───────────────────────────────────────────── */

/** The skeleton pass: the RunBar's line over one indeterminate track, and Stop. */
export const Skeleton: Story = moment('skeleton');
export const SkeletonArabic: Story = moment('skeleton', 'ar');

/** Building (the §3.16 mini frame): "1 of 8 on the page", the horizontal spine, Stop. */
export const Building: Story = moment('building');
export const BuildingDark: Story = moment('building', 'en', 'dark');
export const BuildingArabic: Story = moment('building', 'ar');
export const BuildingArabicDark: Story = moment('building', 'ar', 'dark');

/** Stopping: the status says so; Stop keeps its place and label, and a press does nothing. */
export const Stopping: Story = {
  ...moment('stopping'),
  play: async ({ canvasElement }) => {
    const view = miniBarView(miniState('stopping', 'en'));
    await expectRow(canvasElement, 'en', view);
    const stop = within(canvasElement).getByRole('button', { name: 'Stopping…' });
    await expect(stop).toHaveAttribute('aria-disabled', 'true');
    await expect(stop).toHaveTextContent('Stop');
    await userEvent.click(stop);
    await expect(commands.stop).not.toHaveBeenCalled();
    await expect(stop).toHaveFocus();
  },
};
export const StoppingArabic: Story = moment('stopping', 'ar');

/** An edit is running: its stage, and Stop. */
export const EditRunning: Story = moment('editRunning');
export const EditRunningArabic: Story = moment('editRunning', 'ar');

/* ── Once it settles: the record's own next step ─────────────────────────── */

/** Page built: "Page built: 8 sections", the closed ink stroke, and Undo build. */
export const Built: Story = moment('built');
export const BuiltDark: Story = moment('built', 'en', 'dark');
export const BuiltArabic: Story = moment('built', 'ar');
export const BuiltArabicDark: Story = moment('built', 'ar', 'dark');

/** Undo build asks first, in the row: focus on Cancel, Esc gives it back to Undo build. */
export const UndoBuildConfirm: Story = {
  ...moment('built'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Undo build' }));
    await expect(canvas.getByRole('button', { name: t('en', 'confirm.cancel') })).toHaveFocus();
    await expect(canvas.getByRole('group')).toHaveAccessibleName(t('en', 'confirm.undoBuild'));
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('button', { name: 'Undo build' })).toHaveFocus();
    await expect(commands.undoBuild).not.toHaveBeenCalled();
  },
};

export const UndoBuildConfirmArabicDark: Story = {
  ...moment('built', 'ar', 'dark'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('ar', 'footer.undoBuild') }));
    await expect(canvas.getByRole('button', { name: t('ar', 'confirm.cancel') })).toHaveFocus();
  },
};

/** Built with a failure: Retry leads, for the failed section only. */
export const Partial: Story = moment('partial');
export const PartialArabic: Story = moment('partial', 'ar');

/** Stopped: "Finish the rest (5)". */
export const Stopped: Story = moment('stopped');
export const StoppedArabic: Story = moment('stopped', 'ar');

/** Build undone: Redo build. */
export const Undone: Story = moment('undone');
export const UndoneArabic: Story = moment('undone', 'ar');

/** An edit landed: its title, and Undo. */
export const Edited: Story = moment('edited');
export const EditedDark: Story = moment('edited', 'en', 'dark');
export const EditedArabic: Story = moment('edited', 'ar');

/** A proposal previewed on the canvas: Apply and Discard (SPEC §3.17). */
export const Proposal: Story = moment('proposal');
export const ProposalDark: Story = moment('proposal', 'en', 'dark');
export const ProposalArabic: Story = moment('proposal', 'ar');
export const ProposalArabicDark: Story = moment('proposal', 'ar', 'dark');

/** A failure: its title, and Try again. */
export const Failed: Story = moment('failed');
export const FailedArabic: Story = moment('failed', 'ar');

/** An answer changes nothing on the page: its title, and only the way back. */
export const Answer: Story = moment('answer');
export const AnswerArabic: Story = moment('answer', 'ar');

/** Nothing yet in this conversation: the agent's name, and the way back. */
export const Idle: Story = moment('idle');
export const IdleArabicDark: Story = moment('idle', 'ar', 'dark');

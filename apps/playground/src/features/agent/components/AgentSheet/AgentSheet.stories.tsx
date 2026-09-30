import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import { starterSuggestions } from '../../model/suggestions';
import type { Locale, TurnView } from '../../model/view-types';
import { composerView, NO_ACTIONS } from '../../testing/wp-14-composer-fixtures';
import {
  conversations,
  FIXTURE_NOW,
  miniState,
  type MiniMoment,
} from '../../testing/wp-15-history-phone-fixtures';
import { AgentHeader } from '../AgentHeader';
import { BuildRecord, type BuildRecordActions } from '../BuildRecord';
import { Composer } from '../Composer';
import { EmptyState } from '../EmptyState';
import { HistoryPopover } from '../HistoryPopover';
import { AgentTooltipProvider } from '../IconButton';
import { LiveStatus } from '../LiveStatus';
import { miniBarView, SheetMiniBar, type MiniBarCommands } from '../SheetMiniBar';
import { SuggestionList } from '../SuggestionList';

import { AgentSheet, type SheetControls, type SheetDetent } from './AgentSheet';

/* ── A 390px phone, the editor around the sheet ───────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  /** A device's home-indicator inset, in px (SPEC §4.19 "safe-area insets respected"). */
  readonly safeArea?: number;
}

/**
 * One phone per story: 390 × 844 (SPEC §3.16), the theme, the story's language and
 * direction, and a `transform` so the sheet's fixed layers are laid out against the phone
 * rather than the whole canvas. `safeArea` stands in for the device's bottom inset.
 */
const inPhone: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', safeArea } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      data-phone=""
      style={{
        position: 'relative',
        inlineSize: 390,
        blockSize: 844,
        overflow: 'hidden',
        transform: 'translateZ(0)',
        borderRadius: 'var(--bldr-radius-xl)',
        background: 'var(--bldr-surface-tint)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        ...(safeArea === undefined
          ? {}
          : { '--ck-agent-safe-area-block-end': `${String(safeArea)}px` }),
      }}
    >
      <AgentTooltipProvider>
        <Story />
      </AgentTooltipProvider>
    </div>
  );
};

/* ── The editor behind the sheet: its top bar and the live canvas ─────────── */

const SECTION_TITLES: Readonly<Record<Locale, readonly string[]>> = {
  en: ['Header', 'Hero', 'Services', 'Why us', 'Doctors', 'Testimonials', 'FAQ', 'Contact'],
  ar: [
    'الترويسة',
    'الواجهة',
    'الخدمات',
    'لماذا نحن',
    'الأطباء',
    'آراء المرضى',
    'الأسئلة الشائعة',
    'التواصل',
  ],
};

/** The editor's top bar, with the rail's agent button the sheet returns focus to. */
function TopBar({
  locale,
  onAgent,
  agentRef,
}: {
  readonly locale: Locale;
  readonly onAgent: () => void;
  readonly agentRef: (element: HTMLButtonElement | null) => void;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--bldr-space-md)',
        blockSize: 'var(--bldr-topbar-height)',
        paddingInline: 'var(--bldr-space-3xl) var(--bldr-space-md)',
        borderBlockEnd: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
        background: 'var(--bldr-panel)',
      }}
    >
      <span style={{ flex: '1 1 auto', fontWeight: 600, fontSize: 'var(--bldr-font-size-read)' }}>
        {locale === 'ar' ? 'عيادة الابتسامة' : 'Smile Clinic'}
      </span>
      <button
        ref={agentRef}
        type="button"
        onClick={onAgent}
        style={{
          blockSize: 'var(--bldr-hit-target-min)',
          paddingInline: 'var(--bldr-space-xl)',
          border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
          borderRadius: 'var(--bldr-radius-sm)',
          background: 'var(--bldr-surface)',
          color: 'var(--bldr-panel-text)',
          font: 'inherit',
        }}
      >
        {t(locale, 'header.name')}
      </button>
    </header>
  );
}

/** The page on the canvas: the sections landed so far, and veils where the rest will go. */
function Canvas({ locale, landed }: { readonly locale: Locale; readonly landed: number }) {
  return (
    <main
      aria-label={locale === 'ar' ? 'الصفحة' : 'Page'}
      style={{
        display: 'grid',
        gap: 'var(--bldr-space-md)',
        padding: 'var(--bldr-space-xl)',
      }}
    >
      {SECTION_TITLES[locale].map((title, index) => (
        <section
          key={title}
          style={{
            display: 'grid',
            placeItems: 'center',
            minBlockSize: index === 1 ? 180 : 88,
            borderRadius: 'var(--bldr-radius-sm)',
            border:
              index < landed
                ? 'var(--bldr-border-hairline) solid var(--bldr-panel-border)'
                : 'var(--bldr-border-hairline) dashed var(--bldr-panel-border-strong)',
            background: index < landed ? 'var(--bldr-surface)' : 'var(--bldr-panel)',
            color: 'var(--bldr-panel-text-soft)',
            fontSize: 'var(--bldr-font-size-read)',
          }}
        >
          {title}
        </section>
      ))}
    </main>
  );
}

/* ── The sheet's two faces, built from the panel's own parts ─────────────── */

const buildActions: BuildRecordActions = {
  undoSection: fn(),
  redoSection: fn(),
  undoBuild: fn(),
  redoBuild: fn(),
  retrySections: fn(),
  finishRest: fn(),
  removeEmpty: fn(),
  tryAgain: fn(),
  reveal: fn(),
  peek: fn(),
  openPageHistory: fn(),
};

const miniCommands: MiniBarCommands = {
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

/** How many sections the canvas shows on the page: a build's landed count, else all or none. */
function landedOf(turns: readonly TurnView[]): number {
  const build = turns.find((turn) => turn.kind === 'build');
  if (build?.kind === 'build') return build.view.phase === 'undone' ? 0 : build.view.landed;
  return turns.length === 0 ? 0 : SECTION_TITLES.en.length;
}

type Scene = 'empty' | 'record' | 'conversations';

interface PhoneEditorProps {
  readonly locale: Locale;
  /** The detent the story opens at. */
  readonly detent: SheetDetent;
  /** The conversation's moment: the thread's record and the mini row both follow it. */
  readonly moment: MiniMoment;
  /** What the full face shows: the greeting, the moment's record, or the Conversations page. */
  readonly scene: Scene;
  readonly onDetentChange: (detent: SheetDetent) => void;
}

/**
 * The editor on a phone with the agent sheet over it, wired as AgentPanel wires it: the
 * host owns the detent; `[⤓]`, `[⤒]`, `[×]` and Esc ask for a new one. The full face is
 * the phone header, the thread and the dock; the mini face is the SheetMiniBar; the one
 * live region stays mounted in every detent.
 */
function PhoneEditor({ locale, detent: initial, moment, scene, onDetentChange }: PhoneEditorProps) {
  const [detent, setDetent] = useState(initial);
  const [historyOpen, setHistoryOpen] = useState(scene === 'conversations');
  const agentButton = useRef<HTMLButtonElement | null>(null);
  const conversationsButton = useRef<HTMLButtonElement | null>(null);
  const state = miniState(moment, locale);
  // The run began 72 seconds before the story opened: the RunBar's clock reads 1:12.
  const [startedAt] = useState(() => Date.now() - 72_000);
  const run = state.run === null ? null : { ...state.run, startedAt };
  const record = state.turns.find((turn) => turn.kind !== 'user');

  const move = (next: SheetDetent): void => {
    onDetentChange(next);
    setDetent(next);
  };

  const full = (sheet: SheetControls) => (
    <div
      style={{ display: 'flex', flexDirection: 'column', minBlockSize: 0, position: 'relative' }}
    >
      <div
        style={{ display: 'contents' }}
        ref={(element) => {
          sheet.showPageRef(
            element?.querySelector<HTMLElement>(`[aria-label="${t(locale, 'sheet.showPage')}"]`) ??
              null,
          );
        }}
      >
        <AgentHeader
          locale={locale}
          face={{ mood: run === null ? 'idle' : 'working' }}
          scrolled={false}
          running={run !== null}
          conversationsOpen={historyOpen}
          onConversations={() => {
            setHistoryOpen((was) => !was);
          }}
          onNewConversation={fn()}
          conversationsRef={conversationsButton}
          onClose={sheet.close}
          onShowPage={sheet.showPage}
        />
      </div>
      <div
        style={{
          flex: '1 1 auto',
          minBlockSize: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: scene === 'empty' ? 'flex-end' : 'flex-start',
          gap: 'var(--bldr-space-3xl)',
          paddingBlock: 'var(--bldr-space-3xl)',
        }}
      >
        {scene === 'empty' ? (
          <>
            <EmptyState locale={locale} view={{ kind: 'greeting' }} />
            <SuggestionList
              locale={locale}
              suggestions={starterSuggestions(locale, { limit: 3 })}
              onChoose={fn()}
            />
          </>
        ) : record?.kind === 'build' ? (
          <BuildRecord
            locale={locale}
            view={record.view}
            actions={buildActions}
            onMenuSelect={fn()}
          />
        ) : null}
      </div>
      <div
        style={{
          flex: 'none',
          paddingInline: 'var(--bldr-space-md)',
          paddingBlockEnd: 'var(--bldr-space-md)',
        }}
      >
        <Composer view={composerView({ locale, run })} actions={NO_ACTIONS} />
      </div>
      <HistoryPopover
        locale={locale}
        sessions={conversations(locale)}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onOpenConversation={fn()}
        onDeleteConversation={fn()}
        anchorRef={conversationsButton}
        presentation="sheet"
        running={run !== null}
        now={FIXTURE_NOW}
      />
    </div>
  );

  return (
    <>
      <TopBar
        locale={locale}
        agentRef={(element) => {
          agentButton.current = element;
        }}
        onAgent={() => {
          move('full');
        }}
      />
      <Canvas locale={locale} landed={landedOf(state.turns)} />
      <AgentSheet
        locale={locale}
        detent={detent}
        onDetentChange={move}
        returnFocus={() => agentButton.current}
        persistent={<LiveStatus locale={locale} announcement={null} />}
        mini={(sheet) => (
          <SheetMiniBar
            locale={locale}
            view={miniBarView({ turns: state.turns, run })}
            commands={miniCommands}
            onBackToChat={sheet.backToChat}
            backToChatRef={sheet.backToChatRef}
          />
        )}
      >
        {full}
      </AgentSheet>
    </>
  );
}

/* ── What every sheet must be (SPEC §4.19, §6.4) ─────────────────────────── */

function sheetOf(canvasElement: HTMLElement): HTMLElement {
  const sheet = canvasElement.querySelector<HTMLElement>('.ck-agent-sheet');
  if (sheet === null) throw new Error('no sheet');
  return sheet;
}

function phoneOf(canvasElement: HTMLElement): DOMRect {
  const phone = canvasElement.querySelector('[data-phone]');
  if (phone === null) throw new Error('no phone');
  return phone.getBoundingClientRect();
}

/** Exactly one live region in the whole sheet, whatever the detent (SPEC §6.1). */
async function expectOneLiveRegion(canvasElement: HTMLElement): Promise<void> {
  await expect(
    sheetOf(canvasElement).querySelectorAll(
      '[aria-live], [role="status"], [role="log"], [role="alert"]',
    ),
  ).toHaveLength(1);
}

/** Full: a modal dialog named أبو غضب under the top bar; a 56px header; 44px targets. */
async function expectFull(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const dialog = within(canvasElement).getByRole('dialog', { name: t(locale, 'header.name') });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  const header = dialog.querySelector('.ck-agent-header');
  await expect(Math.round(header?.getBoundingClientRect().height ?? 0)).toBe(56);
  for (const button of within(header as HTMLElement).getAllByRole('button')) {
    const box = button.getBoundingClientRect();
    await expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    await expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
  }
  const face = sheetOf(canvasElement).querySelector('.ck-agent-sheet__full');
  const top = face?.getBoundingClientRect().top ?? 0;
  // The editor's top bar stays visible above it.
  await expect(Math.round(top - phoneOf(canvasElement).top)).toBeGreaterThanOrEqual(48);
  await expectOneLiveRegion(canvasElement);
}

/** Mini: a region, not a dialog; one row at the bottom, the canvas usable above it. */
async function expectMini(
  canvasElement: HTMLElement,
  locale: Locale,
  bottomInset = 8,
): Promise<void> {
  const canvas = within(canvasElement);
  await expect(canvas.queryByRole('dialog')).toBeNull();
  const region = canvas.getByRole('region', { name: t(locale, 'header.name') });
  await waitFor(async () => {
    const face = region.getBoundingClientRect();
    await expect(Math.round(phoneOf(canvasElement).bottom - face.bottom)).toBe(0);
  });
  const bar = region.querySelector('.ck-agent-mini-bar');
  const row = region.querySelector('.ck-agent-mini-bar__row')?.getBoundingClientRect();
  await expect(bar).not.toBeNull();
  await expect(Math.round(region.getBoundingClientRect().bottom - (row?.bottom ?? 0))).toBe(
    bottomInset,
  );
  await expect(canvas.getByRole('main')).toBeVisible();
  await expectOneLiveRegion(canvasElement);
}

const meta = {
  title: 'Agent/Phone/AgentSheet',
  component: PhoneEditor,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    detent: 'full',
    moment: 'idle',
    scene: 'empty',
    onDetentChange: fn(),
  },
  decorators: [inPhone],
} satisfies Meta<typeof PhoneEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

function rtl(locale: Locale): Pick<Story, 'globals'> {
  return locale === 'ar' ? { globals: { direction: 'rtl' } } : {};
}

/* ── Full: the chat ──────────────────────────────────────────────────────── */

function fullStory(
  scene: Scene,
  moment: MiniMoment,
  locale: Locale,
  theme: 'light' | 'dark' = 'light',
): Story {
  return {
    args: { locale, scene, moment, detent: 'full' },
    parameters: { panel: { theme } },
    ...rtl(locale),
    play: async ({ canvasElement }) => {
      await expectFull(canvasElement, locale);
    },
  };
}

/** The §3.16 first frame: the greeting, three starters, the 16px composer. */
export const FullEmpty: Story = fullStory('empty', 'idle', 'en');
export const FullEmptyDark: Story = fullStory('empty', 'idle', 'en', 'dark');
export const FullEmptyArabic: Story = fullStory('empty', 'idle', 'ar');
export const FullEmptyArabicDark: Story = fullStory('empty', 'idle', 'ar', 'dark');

/** The §3.16 second frame: the build, rows 44px, the 52px RunBar with a 44px Stop. */
export const FullBuilding: Story = fullStory('record', 'building', 'en');
export const FullBuildingArabic: Story = fullStory('record', 'building', 'ar');
export const FullBuildingArabicDark: Story = fullStory('record', 'building', 'ar', 'dark');

/** Conversations on a phone: a page of the sheet, Back where Close stood (SPEC §3.17). */
export const FullConversations: Story = {
  ...fullStory('conversations', 'built', 'en'),
  play: async ({ canvasElement }) => {
    await expectFull(canvasElement, 'en');
    const page = within(canvasElement).getByRole('region', { name: t('en', 'history.title') });
    // Back takes Close's place behind a delayed visibility transition.
    await waitFor(() =>
      expect(within(page).getByRole('button', { name: t('en', 'history.back') })).toBeVisible(),
    );
  },
};
export const FullConversationsArabic: Story = fullStory('conversations', 'built', 'ar');

/** A home indicator 34px tall: the dock ends above it. */
export const FullSafeArea: Story = {
  args: { locale: 'en', scene: 'empty', moment: 'idle', detent: 'full' },
  parameters: { panel: { safeArea: 34 } },
  play: async ({ canvasElement }) => {
    await expectFull(canvasElement, 'en');
    const face = sheetOf(canvasElement).querySelector('.ck-agent-sheet__full');
    if (face === null) throw new Error('no full face');
    await expect(getComputedStyle(face).paddingBlockEnd).toBe('34px');
  },
};

/* ── Mini: one row over the canvas, in every moment ──────────────────────── */

function miniStory(
  moment: MiniMoment,
  locale: Locale = 'en',
  theme: 'light' | 'dark' = 'light',
): Story {
  return {
    args: { locale, scene: 'record', moment, detent: 'mini' },
    parameters: { panel: { theme } },
    ...rtl(locale),
    play: async ({ canvasElement }) => {
      await expectMini(canvasElement, locale);
    },
  };
}

export const MiniSkeleton: Story = miniStory('skeleton');
export const MiniSkeletonArabic: Story = miniStory('skeleton', 'ar');
/** The §3.16 mini frame: the horizontal spine, "1 of 8 on the page", Stop, `[⤒]`. */
export const MiniBuilding: Story = miniStory('building');
export const MiniBuildingDark: Story = miniStory('building', 'en', 'dark');
export const MiniBuildingArabic: Story = miniStory('building', 'ar');
export const MiniBuildingArabicDark: Story = miniStory('building', 'ar', 'dark');
export const MiniStopping: Story = miniStory('stopping');
export const MiniStoppingArabic: Story = miniStory('stopping', 'ar');
export const MiniEditRunning: Story = miniStory('editRunning');
export const MiniEditRunningArabic: Story = miniStory('editRunning', 'ar');
/** "Page built: 8 sections", Undo build, `[⤒]` (SPEC §3.17). */
export const MiniBuilt: Story = miniStory('built');
export const MiniBuiltArabic: Story = miniStory('built', 'ar');
export const MiniBuiltArabicDark: Story = miniStory('built', 'ar', 'dark');
export const MiniPartial: Story = miniStory('partial');
export const MiniPartialArabic: Story = miniStory('partial', 'ar');
export const MiniStopped: Story = miniStory('stopped');
export const MiniStoppedArabic: Story = miniStory('stopped', 'ar');
export const MiniUndone: Story = miniStory('undone');
export const MiniUndoneArabic: Story = miniStory('undone', 'ar');
/** After an edit: its title, Undo. */
export const MiniEdited: Story = miniStory('edited');
export const MiniEditedArabic: Story = miniStory('edited', 'ar');
/** Previewing a proposal on the page: Apply, Discard, `[⤒]` (SPEC §3.17). */
export const MiniProposal: Story = miniStory('proposal');
export const MiniProposalDark: Story = miniStory('proposal', 'en', 'dark');
export const MiniProposalArabic: Story = miniStory('proposal', 'ar');
/** After a failure: Try again, `[⤒]` (SPEC §3.17). */
export const MiniFailed: Story = miniStory('failed');
export const MiniFailedArabic: Story = miniStory('failed', 'ar');
export const MiniAnswer: Story = miniStory('answer');
export const MiniAnswerArabic: Story = miniStory('answer', 'ar');
export const MiniIdle: Story = miniStory('idle');
export const MiniIdleArabic: Story = miniStory('idle', 'ar');

/** The mini row keeps clear of a 34px home indicator. */
export const MiniSafeArea: Story = {
  args: { locale: 'ar', scene: 'record', moment: 'building', detent: 'mini' },
  parameters: { panel: { safeArea: 34 } },
  ...rtl('ar'),
  play: async ({ canvasElement }) => {
    await expectMini(canvasElement, 'ar', 34);
  },
};

/* ── Moving between detents ──────────────────────────────────────────────── */

/**
 * `[⤓]` drops to mini with focus on `[⤒]`; `[⤒]` rises with focus on `[⤓]`; `[×]` closes
 * and returns focus to the rail's agent button (SPEC §4.19, §6.3).
 */
export const DetentFlow: Story = {
  args: { locale: 'en', scene: 'record', moment: 'building', detent: 'full' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expectFull(canvasElement, 'en');
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'sheet.showPage') }));
    await expect(args.onDetentChange).toHaveBeenLastCalledWith('mini');
    const back = canvas.getByRole('button', { name: t('en', 'sheet.backToChat') });
    await waitFor(() => expect(back).toHaveFocus());
    await expectMini(canvasElement, 'en');

    await userEvent.click(back);
    await expect(args.onDetentChange).toHaveBeenLastCalledWith('full');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: t('en', 'sheet.showPage') })).toHaveFocus(),
    );

    await userEvent.click(canvas.getByRole('button', { name: t('en', 'sheet.close') }));
    await expect(args.onDetentChange).toHaveBeenLastCalledWith('closed');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: t('en', 'header.name') })).toHaveFocus(),
    );
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
};

/**
 * Esc on the sheet closes it, and focus goes back to the rail's agent button. (Esc on a
 * button showing its tooltip closes the tooltip first, as every Radix layer does.)
 */
export const EscapeCloses: Story = {
  args: { locale: 'ar', scene: 'empty', moment: 'idle', detent: 'full' },
  ...rtl('ar'),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expectFull(canvasElement, 'ar');
    const suggestions = canvasElement.querySelector<HTMLElement>('.ck-agent-suggestions');
    if (suggestions === null) throw new Error('no starters');
    const [starter] = within(suggestions).getAllByRole('button');
    if (starter === undefined) throw new Error('no starter');
    await userEvent.click(starter);
    await userEvent.keyboard('{Escape}');
    await expect(args.onDetentChange).toHaveBeenLastCalledWith('closed');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: t('ar', 'header.name') })).toHaveFocus(),
    );
  },
};

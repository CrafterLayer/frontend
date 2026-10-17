import { ChromeButton } from '@craftkit/builder';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useId, useRef, useState, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import {
  buildTitleKey,
  formatClock,
  JUMP_LABEL_KEY,
  t,
  tAnnounce,
  tParts,
  type Key,
} from '../../copy';
import { resolveDir } from '../../model/resolve-dir';
import type {
  BuildRecordView,
  CopyParams,
  EditRecordView,
  EmptyStateView,
  Locale,
  PlanView,
  RunActivity,
  SuggestionView,
  TurnView,
} from '../../model/view-types';
import {
  frameConversation,
  frameEmptyViews,
  frameFirstBuild,
  framePlanWaiting,
  frameSuggestions,
} from '../../testing/wp-11-frame-fixtures';
import { AgentHeader } from '../AgentHeader';
import { ChangeLines } from '../ChangeLines';
import { AgentTooltipProvider } from '../IconButton';
import { LiveStatus } from '../LiveStatus';
import { RunGlyph, glyphForBuildPhase, glyphForRow } from '../RunGlyph';
import { RunRecord } from '../RunRecord';

import { AgentThread } from './AgentThread';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
  readonly height?: number;
}

/**
 * The panel frame: theme, the story's language and direction, and the `agent`
 * inline-size container at the panel's width, so every container query (the 12px gutter
 * under 320) sees what the product sees. The frame's height is the dock's panel height.
 */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 320, height = 600 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        display: 'grid',
        inlineSize: width,
        blockSize: height,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <AgentTooltipProvider>
        <Story />
      </AgentTooltipProvider>
    </div>
  );
};

/* ── Stand-ins for the records (WP-12) and the composer (WP-14) ──────────── */

/*
  The frame is what this file shows: header, thread, pill, suggestions, the live region.
  The records inside it are sketches on the real RunRecord, RunGlyph and ChangeLines
  primitives, close enough to judge spacing and scroll; BuildRecord, EditRecord,
  UserMessage and PagePlanCard are their own work packages.
*/

function Copy({ locale, k, params }: { locale: Locale; k: Key; params?: CopyParams }) {
  return (
    <>
      {tParts(locale, k, params).map((part, index) =>
        part.kind === 'value' ? <bdi key={index}>{part.text}</bdi> : part.text,
      )}
    </>
  );
}

const line = { margin: 0 } as const;
const FOOTER_BUTTON = { blockSize: 'var(--bldr-control-md)' } as const;

function BubbleSketch({ locale, text }: { locale: Locale; text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <p
        dir={resolveDir(text, locale === 'ar' ? 'rtl' : 'ltr')}
        style={{
          margin: 0,
          maxInlineSize: '85%',
          paddingBlock: 'var(--bldr-space-md)',
          paddingInline: 'var(--bldr-space-xl)',
          borderRadius: 'var(--bldr-radius-xl)',
          borderEndEndRadius: 'var(--bldr-radius-xs)',
          background: 'var(--bldr-surface-tint)',
          color: 'var(--bldr-panel-text)',
          fontSize: 'var(--bldr-font-size-read)',
          lineHeight: 'var(--bldr-line-height-read)',
          unicodeBidi: 'plaintext',
        }}
      >
        {text}
      </p>
    </div>
  );
}

function BuildSketch({ locale, view }: { locale: Locale; view: BuildRecordView }) {
  const live = view.phase === 'building' || view.phase === 'skeleton';
  return (
    <RunRecord
      glyph={glyphForBuildPhase(view.phase)}
      animateGlyph={live}
      title={t(locale, buildTitleKey(view.phase, view.stopReason), { n: view.total - view.landed })}
      meta={
        live
          ? [
              {
                text: `${String(view.landed)}/${String(view.total)}`,
                label: tAnnounce(locale, 'build.progress', {
                  done: view.landed,
                  total: view.total,
                }),
              },
            ]
          : [{ text: formatClock(view.elapsedMs ?? 0) }]
      }
    >
      {live ? (
        <ol
          aria-label={t(locale, 'spine.label')}
          style={{
            gridColumn: '1 / -1',
            display: 'grid',
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {view.rows.map((row) => (
            <li
              key={row.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'var(--bldr-space-3xl) var(--bldr-space-4xl) minmax(0, 1fr)',
                columnGap: 'var(--bldr-space-md)',
                alignItems: 'center',
                minBlockSize: 'var(--bldr-agent-row-height)',
                color:
                  row.state === 'landed' ? 'var(--bldr-panel-text)' : 'var(--bldr-panel-text-soft)',
              }}
            >
              <RunGlyph state={glyphForRow(row.state)} />
              <bdi
                dir="ltr"
                style={{
                  color: 'var(--bldr-panel-muted)',
                  fontSize: 'var(--bldr-font-size-figure)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.position}
              </bdi>
              <span>
                <bdi>{row.title}</bdi>
                <span className="bldr-visually-hidden">{`, ${t(locale, `row.${row.state}`)}`}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p style={line}>{t(locale, 'build.caption.done', { n: view.landed })}</p>
      )}
    </RunRecord>
  );
}

function EditSketch({ locale, view }: { locale: Locale; view: EditRecordView }) {
  const running = view.phase === 'running';
  const target = view.target ?? '';
  return (
    <RunRecord
      glyph={running ? 'working' : 'landed'}
      animateGlyph={running}
      title={
        <Copy
          locale={locale}
          k={running ? 'edit.title.running' : 'edit.title.done'}
          params={{ target }}
        />
      }
      meta={running ? undefined : [{ text: formatClock(view.elapsedMs ?? 0) }]}
      actions={
        running ? undefined : (
          <>
            <ChromeButton size="sm" style={FOOTER_BUTTON}>
              {t(locale, 'edit.showOnPage')}
            </ChromeButton>
            <ChromeButton size="sm" style={FOOTER_BUTTON}>
              {t(locale, 'edit.undo')}
            </ChromeButton>
          </>
        )
      }
    >
      {running ? (
        <p style={line}>{t(locale, view.stage ?? 'edit.writing')}</p>
      ) : (
        <ChangeLines locale={locale} changes={view.changes} />
      )}
    </RunRecord>
  );
}

function PlanSketch({ locale, view }: { locale: Locale; view: PlanView }) {
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      style={{
        display: 'grid',
        gap: 'var(--bldr-space-md)',
        padding: 'var(--bldr-space-xl)',
        border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
        borderRadius: 'var(--bldr-radius-lg)',
        background: 'var(--bldr-surface)',
        fontSize: 'var(--bldr-font-size-read)',
        lineHeight: 'var(--bldr-line-height-read)',
      }}
    >
      <h3 id={titleId} tabIndex={-1} style={{ margin: 0, fontSize: 'inherit', fontWeight: 600 }}>
        {t(locale, 'plan.title')}
      </h3>
      <ol
        aria-label={t(locale, 'plan.sections', { n: view.sections.length })}
        style={{
          margin: 0,
          paddingInlineStart: 'var(--bldr-space-5xl)',
          color: 'var(--bldr-panel-text-soft)',
        }}
      >
        {view.sections.map((section) => (
          <li key={section.key}>
            <bdi>{section.title}</bdi>
          </li>
        ))}
      </ol>
      <ChromeButton variant="primary" size="sm" style={{ ...FOOTER_BUTTON, justifySelf: 'start' }}>
        {t(locale, 'plan.build')}
      </ChromeButton>
    </article>
  );
}

function TurnSketch({ locale, turn }: { locale: Locale; turn: TurnView }) {
  switch (turn.kind) {
    case 'user':
      return <BubbleSketch locale={locale} text={turn.view.text} />;
    case 'build':
      return <BuildSketch locale={locale} view={turn.view} />;
    case 'edit':
      return <EditSketch locale={locale} view={turn.view} />;
    case 'page-plan':
      return <PlanSketch locale={locale} view={turn.view} />;
    default:
      return null;
  }
}

interface DockProps {
  readonly locale: Locale;
  readonly running: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly fieldRef: Ref<HTMLTextAreaElement>;
}

/** The dock: padding 0 8 8 and the composer's box, a plain textarea standing in for it. */
function DockSketch({ locale, running, value, onChange, fieldRef }: DockProps) {
  return (
    <div style={{ paddingBlock: '0 var(--bldr-space-md)', paddingInline: 'var(--bldr-space-md)' }}>
      <textarea
        ref={fieldRef}
        aria-label={t(locale, 'input.aria')}
        placeholder={t(locale, running ? 'placeholder.running' : 'placeholder.auto')}
        rows={2}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        style={{
          display: 'block',
          boxSizing: 'border-box',
          inlineSize: '100%',
          padding: 'var(--bldr-space-md)',
          border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
          borderRadius: 'var(--bldr-radius-xl)',
          background: 'var(--bldr-surface)',
          color: 'var(--bldr-panel-text)',
          fontFamily: 'var(--bldr-font)',
          fontSize: 'var(--bldr-font-size-input)',
          lineHeight: 'var(--bldr-line-height-input)',
          resize: 'none',
        }}
      />
    </div>
  );
}

/* ── The frame: header, thread, dock and the one live region ─────────────── */

interface PanelFrameProps {
  readonly locale: Locale;
  readonly turns: readonly TurnView[];
  readonly activity: RunActivity | null;
  readonly empty: EmptyStateView;
  readonly suggestions: readonly SuggestionView[];
}

/**
 * The three rows AgentPanel draws (SPEC §3.0): the 44px header, the thread (the only
 * scroller), the dock. The thread reports whether it is scrolled, and the header draws
 * its hairline from it; a chosen suggestion fills the composer and focuses it, caret at
 * the end, as AgentPanel wires it.
 */
function PanelFrame({ locale, turns, activity, empty, suggestions }: PanelFrameProps) {
  const headingId = useId();
  const [scrolled, setScrolled] = useState(false);
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  return (
    <section
      aria-labelledby={headingId}
      style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', minBlockSize: 0 }}
    >
      <AgentHeader
        locale={locale}
        headingId={headingId}
        face={{ mood: activity === null ? 'idle' : 'working' }}
        scrolled={scrolled}
        running={activity !== null}
        conversationsOpen={false}
        onConversations={fn()}
        onNewConversation={fn()}
      />
      <AgentThread
        locale={locale}
        turns={turns}
        renderTurn={(turn) => <TurnSketch locale={locale} turn={turn} />}
        activity={activity}
        empty={empty}
        suggestions={suggestions}
        draft={draft}
        onSuggestion={(suggestion) => {
          flushSync(() => {
            setDraft(suggestion.text);
          });
          const element = field.current;
          if (element === null) return;
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        }}
        onScrolledChange={setScrolled}
      />
      <DockSketch
        locale={locale}
        running={activity !== null}
        value={draft}
        onChange={setDraft}
        fieldRef={field}
      />
      <LiveStatus locale={locale} announcement={null} />
    </section>
  );
}

/* ── Plays ────────────────────────────────────────────────────────────────── */

const LIVE = '[aria-live], [role=status], [role=log], [role=alert]';

function threadOf(canvasElement: HTMLElement, locale: Locale): HTMLElement {
  return within(canvasElement).getByRole('region', { name: t(locale, 'thread.label') });
}

/** The panel's one live region is LiveStatus; the thread is a named region, not a log. */
async function expectOneLiveRegion(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const live = canvasElement.querySelectorAll(LIVE);
  await expect(live).toHaveLength(1);
  await expect(live[0]).toHaveClass('ck-agent-live');
  const thread = threadOf(canvasElement, locale);
  await expect(thread).not.toHaveAttribute('role');
  await expect(thread).not.toHaveAttribute('aria-live');
}

async function expectAtBottom(thread: HTMLElement): Promise<void> {
  await waitFor(
    () => expect(thread.scrollHeight - thread.clientHeight - thread.scrollTop).toBeLessThan(2),
    { timeout: 4000 },
  );
}

function pillName(locale: Locale, activity: RunActivity | null): string {
  return activity === null
    ? t(locale, 'jump.aria')
    : t(locale, 'jump.aria.live', { label: t(locale, JUMP_LABEL_KEY[activity]) });
}

/**
 * The reader scrolls up mid-conversation: the pill appears with the reason there is news
 * below, the header draws its hairline, and more content never pulls the reader down.
 */
async function scrollUpAndExpectPill(
  canvasElement: HTMLElement,
  locale: Locale,
  activity: RunActivity | null,
): Promise<HTMLElement> {
  const thread = threadOf(canvasElement, locale);
  await expectAtBottom(thread);
  // A frame the conversation does not overflow has nothing to scroll up from: say so plainly.
  await expect(thread.scrollHeight).toBeGreaterThan(thread.clientHeight + 120);
  thread.scrollTo({ top: 120, behavior: 'instant' });
  const pill = await waitFor(() =>
    within(canvasElement).getByRole('button', { name: pillName(locale, activity) }),
  );
  // The pill fades and rises 4px in from transparent (SPEC §5 moment 9): visible at once,
  // measured only once the rise has run, or it is caught a pixel short of its place.
  await waitFor(() => expect(pill).toBeVisible(), { timeout: 2000 });
  await Promise.allSettled(pill.getAnimations().map((animation) => animation.finished));
  await waitFor(() =>
    expect(canvasElement.querySelector('.ck-agent-header')).toHaveAttribute('data-scrolled'),
  );
  await expect(thread.scrollTop).toBe(120);
  // Centred, 12px above the dock.
  const dock = within(canvasElement).getByRole('textbox').getBoundingClientRect();
  const box = pill.getBoundingClientRect();
  const view = thread.getBoundingClientRect();
  await expect(Math.round(dock.top - box.bottom)).toBe(12);
  await expect(Math.abs((box.left + box.right) / 2 - (view.left + view.right) / 2)).toBeLessThan(1);
  await expectOneLiveRegion(canvasElement, locale);
  return pill;
}

/* ── Stories ──────────────────────────────────────────────────────────────── */

const EN_ROWS = frameSuggestions('en');
const AR_ROWS = frameSuggestions('ar');

const meta = {
  title: 'Agent/Frame/AgentThread',
  component: AgentThread,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    turns: [],
    renderTurn: () => null,
    activity: null,
    empty: frameEmptyViews('en').greeting,
    suggestions: EN_ROWS.starters,
    draft: '',
    onSuggestion: fn(),
  },
  render: (args) => (
    <PanelFrame
      locale={args.locale}
      turns={args.turns}
      activity={args.activity}
      empty={args.empty}
      suggestions={args.suggestions}
    />
  ),
  decorators: [inPanel],
} satisfies Meta<typeof AgentThread>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A first run (SPEC §3.1): no turns, the greeting and the four starters anchored to the
 * bottom, directly above the composer. A starter fills the composer and sends nothing.
 */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expectOneLiveRegion(canvasElement, 'en');
    const canvas = within(canvasElement);
    const rows = canvas
      .getAllByRole('button')
      .filter((button) => button.classList.contains('ck-agent-suggestion'));
    await expect(rows).toHaveLength(EN_ROWS.starters.length);
    // Bottom-anchored: the last starter sits on the thread's 12px block padding.
    const lastRow = rows.at(-1)?.getBoundingClientRect();
    const view = threadOf(canvasElement, 'en').getBoundingClientRect();
    if (lastRow === undefined) throw new Error('no starters');
    await expect(Math.round(view.bottom - lastRow.bottom)).toBe(12);

    const first = EN_ROWS.starters[0];
    if (first === undefined) throw new Error('no starter');
    await userEvent.click(canvas.getByRole('button', { name: first.text }));
    const field = canvas.getByRole<HTMLTextAreaElement>('textbox');
    await expect(field).toHaveValue(first.text);
    await expect(field).toHaveFocus();
    await expect(field.selectionStart).toBe(first.text.length);
    // The composer has text now, so the rows step aside.
    await expect(canvas.queryByRole('button', { name: first.text })).toBeNull();
  },
};

export const EmptyArabic: Story = {
  args: { locale: 'ar', empty: frameEmptyViews('ar').greeting, suggestions: AR_ROWS.starters },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectOneLiveRegion(canvasElement, 'ar');
  },
};

export const EmptyArabicDark: Story = {
  args: { locale: 'ar', empty: frameEmptyViews('ar').greeting, suggestions: AR_ROWS.starters },
  globals: { direction: 'rtl' },
  parameters: { panel: { theme: 'dark' } },
};

/** The page has content and a block is selected: the selection greeting and its actions. */
export const EmptyWithSelection: Story = {
  args: { empty: frameEmptyViews('en').selection, suggestions: EN_ROWS.selection },
};

/**
 * A long conversation at rest, followed to the bottom: the older build collapsed, the
 * follow-ups after the newest record, no pill, the hairline under the header.
 */
export const Long: Story = {
  args: { turns: frameConversation('en'), suggestions: EN_ROWS.afterRun },
  play: async ({ canvasElement }) => {
    const thread = threadOf(canvasElement, 'en');
    await expectAtBottom(thread);
    await expect(
      within(canvasElement).queryByRole('button', { name: pillName('en', null) }),
    ).toBeNull();
    // The hairline follows the thread's scroll event, a frame after the follow lands.
    await waitFor(() =>
      expect(canvasElement.querySelector('.ck-agent-header')).toHaveAttribute('data-scrolled'),
    );
    await expectOneLiveRegion(canvasElement, 'en');
  },
};

export const LongArabic: Story = {
  args: { locale: 'ar', turns: frameConversation('ar'), suggestions: AR_ROWS.afterRun },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectAtBottom(threadOf(canvasElement, 'ar'));
    await expectOneLiveRegion(canvasElement, 'ar');
  },
};

/** Scrolled up with nothing running: the pill reads "Latest". */
export const ScrolledUpLatest: Story = {
  args: { turns: frameConversation('en'), suggestions: EN_ROWS.afterRun },
  play: async ({ canvasElement }) => {
    await scrollUpAndExpectPill(canvasElement, 'en', null);
  },
};

/**
 * Scrolled up while a build runs below: the pill reads "Building", and the build's
 * growth never moves the reader. Jumping lands on the newest record's head.
 */
export const ScrolledUpBuilding: Story = {
  args: { turns: frameConversation('en', 'build'), activity: 'build' },
  play: async ({ canvasElement }) => {
    const pill = await scrollUpAndExpectPill(canvasElement, 'en', 'build');
    await userEvent.click(pill);
    const head = within(canvasElement).getByRole('heading', {
      level: 3,
      name: t('en', 'build.title.running'),
    });
    await expect(head).toHaveFocus();
    await expectAtBottom(threadOf(canvasElement, 'en'));
    await expect(
      within(canvasElement).queryByRole('button', { name: pillName('en', 'build') }),
    ).toBeNull();
  },
};

/** Scrolled up while an edit runs below: "Editing". */
export const ScrolledUpEditing: Story = {
  args: { turns: frameConversation('en', 'edit'), activity: 'edit' },
  play: async ({ canvasElement }) => {
    await scrollUpAndExpectPill(canvasElement, 'en', 'edit');
  },
};

export const ScrolledUpBuildingArabic: Story = {
  args: { locale: 'ar', turns: frameConversation('ar', 'build'), activity: 'build' },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await scrollUpAndExpectPill(canvasElement, 'ar', 'build');
  },
};

export const ScrolledUpEditingArabicDark: Story = {
  args: { locale: 'ar', turns: frameConversation('ar', 'edit'), activity: 'edit' },
  globals: { direction: 'rtl' },
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await scrollUpAndExpectPill(canvasElement, 'ar', 'edit');
  },
};

export const ScrolledUpLatestDark: Story = {
  args: { turns: frameConversation('en'), suggestions: EN_ROWS.afterRun },
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await scrollUpAndExpectPill(canvasElement, 'en', null);
  },
};

/** At 420 (SPEC §3.14): the same frame, wider; bubbles keep their measure. */
export const ScrolledUpBuildingAt420: Story = {
  args: { turns: frameConversation('en', 'build'), activity: 'build' },
  parameters: { panel: { width: 420 } },
  play: async ({ canvasElement }) => {
    await scrollUpAndExpectPill(canvasElement, 'en', 'build');
  },
};

/** At 288 (compact): the gutter narrows to 12px under a 320px panel. */
export const LongAt288: Story = {
  args: { turns: frameConversation('en'), suggestions: EN_ROWS.afterRun },
  parameters: { panel: { width: 288 } },
  play: async ({ canvasElement }) => {
    const content = canvasElement.querySelector('.ck-agent-thread__content');
    if (content === null) throw new Error('no content');
    await expect(getComputedStyle(content).paddingInlineStart).toBe('12px');
    const root = canvasElement.querySelector('.ck-agent');
    if (root === null) throw new Error('no panel');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};

/** A first build just finished: the follow-ups sit right after the record. */
export const AfterFirstBuild: Story = {
  args: { turns: frameFirstBuild('en'), suggestions: EN_ROWS.afterRun },
};

export const AfterFirstBuildArabic: Story = {
  args: { locale: 'ar', turns: frameFirstBuild('ar'), suggestions: AR_ROWS.afterRun },
  globals: { direction: 'rtl' },
};

/** A plan is waiting for the person: a decision is open, so no suggestion rows. */
export const DecisionWaiting: Story = {
  args: { turns: framePlanWaiting('en'), suggestions: EN_ROWS.afterRun },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.ck-agent-suggestions')).toBeNull();
  },
};

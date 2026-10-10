import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { BuildRecordView, Locale, RowState } from '../../model/view-types';
import {
  buildAfterRowUndo,
  buildBlocked,
  buildBuilding,
  buildCollapsed,
  buildDone,
  buildEveryRowState,
  buildFailed,
  buildInterrupted,
  buildPartial,
  buildRevived,
  buildSkeleton,
  buildStopped,
  buildStopping,
  buildUndone,
  DIRECTION_PROSE,
  SECTION_TITLES,
  spineRows,
  undoOf,
} from '../../testing/wp-12-records-fixtures';

import { BuildRecord, type BuildRecordActions } from './BuildRecord';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. A story picks its frame with
 * `parameters.panel`; a story-level decorator would nest a second frame inside this one.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
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
      <div style={{ minBlockSize: 200, padding: 'var(--bldr-space-3xl)' }}>
        <Story />
      </div>
    </div>
  );
};

/** Every controller action the record may call, logged in the Actions panel. */
const actions: BuildRecordActions = {
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

/* ── Plays: the geometry the spec draws ───────────────────────────────────── */

function rectOf(element: Element | null | undefined, what: string): DOMRect {
  if (element === null || element === undefined) throw new Error(`no ${what}`);
  return element.getBoundingClientRect();
}

/**
 * The spine is one vertical line through every node (SPEC §2.3): each stretch is centred on
 * the head's node, starts at the node above's box edge and ends at the node below's, so the
 * 2px Paper ring reads as the spine running into the node. Row titles start 52px in.
 */
async function expectSpineGeometry(canvasElement: HTMLElement): Promise<void> {
  const article = canvasElement.querySelector('.ck-agent-build');
  const head = rectOf(
    article?.querySelector('.ck-agent-record__head .ck-agent-glyph'),
    'head node',
  );
  const centre = head.left + head.width / 2;
  const nodes = [...canvasElement.querySelectorAll('.ck-agent-spine-row__node')];
  for (const node of nodes) {
    const box = node.getBoundingClientRect();
    await expect(Math.abs(box.left + box.width / 2 - centre)).toBeLessThan(0.5);
  }
  for (const segment of canvasElement.querySelectorAll('.ck-agent-segment')) {
    const box = segment.getBoundingClientRect();
    await expect(Math.abs(box.left + box.width / 2 - centre)).toBeLessThan(0.5);
  }
  const lead = canvasElement.querySelector('.ck-agent-lead > .ck-agent-segment');
  if (lead !== null && nodes[0] !== undefined) {
    await expect(Math.abs(lead.getBoundingClientRect().top - head.bottom)).toBeLessThan(0.5);
    const first = nodes[0].getBoundingClientRect();
    await expect(Math.abs(lead.getBoundingClientRect().bottom - first.top)).toBeLessThan(0.5);
  }
  const record = rectOf(article, 'record');
  const rtl = article?.closest('[dir]')?.getAttribute('dir') === 'rtl';
  for (const title of canvasElement.querySelectorAll('.ck-agent-spine-row__title')) {
    const box = title.getBoundingClientRect();
    const inset = rtl ? record.right - box.right : box.left - record.left;
    await expect(Math.abs(inset - 52)).toBeLessThan(0.5);
  }
}

async function expectNoSidewaysScroll(canvasElement: HTMLElement): Promise<void> {
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

/* ── A live build, pencil to ink ──────────────────────────────────────────── */

/**
 * The views a live build passes through, as the producer builds them: laid out, planned,
 * writers on five sections, drafts waiting their turn, landings in page order (a draft landing
 * right after the section above it), then whole.
 */
function liveTimeline(locale: Locale): readonly BuildRecordView[] {
  const building = (states: readonly RowState[]): BuildRecordView => {
    const rows = spineRows(locale, states);
    return {
      ...buildBuilding(locale),
      turnId: 'build-live',
      rows,
      landed: rows.filter((row) => row.state === 'landed').length,
      remainingMs: null,
    };
  };
  const done: BuildRecordView = {
    ...buildDone(locale),
    turnId: 'build-live',
    rows: spineRows(
      locale,
      SECTION_TITLES[locale].map((_, index) => ({ state: 'landed', undo: undoOf(index + 1) })),
    ),
    facts: [],
  };
  return [
    { ...buildSkeleton(locale), turnId: 'build-live' },
    building([
      'waiting',
      'waiting',
      'waiting',
      'waiting',
      'waiting',
      'waiting',
      'waiting',
      'waiting',
    ]),
    building([
      'writing',
      'writing',
      'writing',
      'writing',
      'writing',
      'waiting',
      'waiting',
      'waiting',
    ]),
    building([
      'landed',
      'writing',
      'writing',
      'drafted',
      'writing',
      'writing',
      'waiting',
      'waiting',
    ]),
    {
      ...building([
        'landed',
        'landed',
        'writing',
        'drafted',
        'writing',
        'writing',
        'writing',
        'waiting',
      ]),
      remainingMs: 90_000,
    },
    {
      ...building([
        'landed',
        'landed',
        'landed',
        'landed',
        'drafted',
        'writing',
        'writing',
        'writing',
      ]),
      remainingMs: 45_000,
    },
    building(['landed', 'landed', 'landed', 'landed', 'landed', 'drafted', 'writing', 'drafted']),
    building(['landed', 'landed', 'landed', 'landed', 'landed', 'landed', 'landed', 'drafted']),
    done,
  ];
}

/** Steps through the timeline every 1.6s; replays from the start 4s after it is whole. */
function LiveBuild({ locale }: { readonly locale: Locale }) {
  const timeline = liveTimeline(locale);
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const last = step >= timeline.length - 1;
    const timer = setTimeout(
      () => {
        if (last) {
          setStep(0);
          setRun((current) => current + 1);
        } else {
          setStep((current) => current + 1);
        }
      },
      last ? 4_000 : 1_600,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [step, timeline.length]);
  const view = timeline[step] ?? timeline[0];
  if (view === undefined) return null;
  // A new key per run: the record mounts live again, so arrivals and landings replay.
  return (
    <BuildRecord key={run} locale={locale} view={view} actions={actions} onMenuSelect={fn()} />
  );
}

/* ── Stories ──────────────────────────────────────────────────────────────── */

const meta = {
  title: 'Agent/Records/BuildRecord',
  component: BuildRecord,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: buildBuilding('en'), actions, onMenuSelect: fn() },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof BuildRecord>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Arabic twin of a story: the same phase, in Arabic, right to left. */
function arabic(view: BuildRecordView, frame: Frame = {}): Story {
  return {
    args: { locale: 'ar', view },
    globals: { direction: 'rtl' },
    parameters: { panel: { locale: 'ar', ...frame } },
  };
}

/** A live build from the first event: laid out, then inked section by section. */
export const LiveBuildPencilToInk: Story = {
  render: () => <LiveBuild locale="en" />,
};

export const LiveBuildPencilToInkRightToLeft: Story = {
  render: () => <LiveBuild locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** §3.3: laying out the page. No section is claimed yet: the spine is indeterminate. */
export const Skeleton: Story = { args: { view: buildSkeleton('en') } };
export const SkeletonRightToLeft: Story = arabic(buildSkeleton('ar'));

/**
 * §3.4: one of eight on the page, five writers, one draft waiting its turn. The count is
 * landed sections only; the estimate simulates the writers.
 */
export const Building: Story = {
  args: { view: { ...buildBuilding('en'), writers: 6 } },
  play: async ({ canvasElement }) => {
    await expectSpineGeometry(canvasElement);
    await expectNoSidewaysScroll(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Section 4 of 8: Why us, Written, waiting its turn' }),
    ).toBeVisible();
  },
};

export const CoordinatedWorkers: Story = {
  args: { view: { ...buildBuilding('en'), writers: 6 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: t('en', 'tasks.label') })).toBeVisible();
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('value', '1');
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const BuildingRightToLeft: Story = {
  ...arabic(buildBuilding('ar')),
  play: async ({ canvasElement }) => {
    await expectSpineGeometry(canvasElement);
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const BuildingDark: Story = {
  args: { view: buildBuilding('en') },
  parameters: { panel: { theme: 'dark' } },
};

export const BuildingRightToLeftDark: Story = arabic(buildBuilding('ar'), { theme: 'dark' });

/** §3.14: from 400px every row says its state, and the fonts join the direction line. */
export const EveryRowStateAt420: Story = {
  args: { view: buildEveryRowState('en') },
  parameters: { panel: { width: 420 } },
  play: async ({ canvasElement }) => {
    await expectSpineGeometry(canvasElement);
    const words = [...canvasElement.querySelectorAll('.ck-agent-spine-row__state')].map(
      (word) => getComputedStyle(word).display,
    );
    await expect(words.every((display) => display !== 'none')).toBe(true);
    const fonts = canvasElement.querySelector('.ck-agent-direction__fonts');
    if (fonts === null) throw new Error('no fonts');
    await expect(getComputedStyle(fonts).display).not.toBe('none');
  },
};

export const EveryRowStateAt420RightToLeft: Story = arabic(buildEveryRowState('ar'), {
  width: 420,
});

/** Below 400px only a second try (and not written, undone) says its state beside the title. */
export const EveryRowStateAt320: Story = { args: { view: buildEveryRowState('en') } };

/** §3.4 "Blocked": one writer holds the drafts below it; the RunBar says so, the record shows it. */
export const Blocked: Story = { args: { view: buildBlocked('en') } };
export const BlockedRightToLeft: Story = arabic(buildBlocked('ar'));

/** Stop pressed: the count holds; the RunBar says "Stopping…". */
export const Stopping: Story = { args: { view: buildStopping('en') } };
export const StoppingRightToLeft: Story = arabic(buildStopping('ar'));

/** §3.5: the spine is one unbroken Indigo stroke; Undo per row on hover, Undo build, facts. */
export const Done: Story = {
  args: { view: buildDone('en') },
  play: async ({ canvasElement }) => {
    await expectSpineGeometry(canvasElement);
    const stretches = [...canvasElement.querySelectorAll('.ck-agent-segment')].map((segment) =>
      segment.getAttribute('data-state'),
    );
    await expect(new Set(stretches)).toEqual(new Set(['ink']));
  },
};

export const DoneRightToLeft: Story = {
  ...arabic(buildDone('ar')),
  play: async ({ canvasElement }) => {
    await expectSpineGeometry(canvasElement);
  },
};

export const DoneDark: Story = {
  args: { view: buildDone('en') },
  parameters: { panel: { theme: 'dark' } },
};
export const DoneRightToLeftDark: Story = arabic(buildDone('ar'), { theme: 'dark' });

/** Undo build confirms in place, focus on Cancel. */
export const UndoBuildConfirming: Story = {
  args: { view: buildDone('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'footer.undoBuild') }));
    await expect(canvas.getByRole('button', { name: t('en', 'confirm.cancel') })).toHaveFocus();
  },
};

/** §3.5 partial: one section failed; Retry on its row, the reason under it, the plural button. */
export const Partial: Story = {
  args: { view: buildPartial('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Retry Doctors' })).toBeVisible();
    await expect(canvas.getByText(t('en', 'reason.timeout'))).toBeVisible();
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const PartialRightToLeft: Story = arabic(buildPartial('ar'));
export const PartialDark: Story = {
  args: { view: buildPartial('en') },
  parameters: { panel: { theme: 'dark' } },
};

/** §3.10: stopped by the person; "Not written" said at every width; Finish the rest. */
export const Stopped: Story = { args: { view: buildStopped('en', 'signal') } };
export const StoppedRightToLeft: Story = arabic(buildStopped('ar', 'signal'));

/** The build ran out of time. */
export const StoppedBudget: Story = { args: { view: buildStopped('en', 'budget') } };
export const StoppedBudgetRightToLeft: Story = arabic(buildStopped('ar', 'budget'));

/** The build reached the section limit. */
export const StoppedMaxTasks: Story = { args: { view: buildStopped('en', 'maxTasks') } };
export const StoppedMaxTasksRightToLeft: Story = arabic(buildStopped('ar', 'maxTasks'));

/** Reloaded mid-build, with the section list saved: it can finish. */
export const InterruptedResumable: Story = { args: { view: buildInterrupted('en', true) } };
export const InterruptedResumableRightToLeft: Story = arabic(buildInterrupted('ar', true));

/** Reloaded mid-build, the list lost: the caption says it cannot continue. */
export const InterruptedNotResumable: Story = { args: { view: buildInterrupted('en', false) } };
export const InterruptedNotResumableRightToLeft: Story = arabic(buildInterrupted('ar', false));

/** Failed before any section landed: the error's words, Try again, the empty layout's clean-up. */
export const Failed: Story = { args: { view: buildFailed('en') } };
export const FailedRightToLeft: Story = arabic(buildFailed('ar'));

/** Undone: nothing of it on the page; the sections fold away; Redo build. */
export const Undone: Story = { args: { view: buildUndone('en') } };
export const UndoneRightToLeft: Story = arabic(buildUndone('ar'));

/** Read back after a reload: Undo shown unavailable, described by the caption; Page history. */
export const Revived: Story = {
  args: { view: buildRevived('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [undo] = canvas.getAllByRole('button', { name: /^Undo /u });
    await expect(undo).toHaveAttribute('aria-disabled', 'true');
    await expect(undo).toHaveAccessibleDescription(t('en', 'build.caption.revived'));
  },
};

export const RevivedRightToLeft: Story = arabic(buildRevived('ar'));

/** An older build under a newer turn: head, caption, "Show sections". */
export const Collapsed: Story = {
  args: { view: buildCollapsed('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Show sections (8)' });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveFocus();
  },
};

export const CollapsedRightToLeft: Story = arabic(buildCollapsed('ar'));

/** After a row's Undo: that row is undone with Redo; a neighbour's Undo was refused, and says why. */
export const AfterRowUndo: Story = { args: { view: buildAfterRowUndo('en') } };
export const AfterRowUndoRightToLeft: Story = arabic(buildAfterRowUndo('ar'));

/** Before structured direction (SPEC §7.6 E7): the direction prose, one line, no swatches. */
export const DirectionProseOnly: Story = {
  args: { view: { ...buildBuilding('en'), direction: DIRECTION_PROSE.en } },
};

export const DirectionProseOnlyRightToLeft: Story = arabic({
  ...buildBuilding('ar'),
  direction: DIRECTION_PROSE.ar,
});

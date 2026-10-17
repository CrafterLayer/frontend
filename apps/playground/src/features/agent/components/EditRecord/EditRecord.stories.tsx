import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { EditRecordView, EditStageKey, Locale } from '../../model/view-types';
import {
  editApplied,
  editChangedSince,
  editDone,
  editDoneMany,
  editInstant,
  editNoChange,
  editPageWide,
  editRevived,
  editRunning,
  editStopped,
  editUndone,
  editUnlisted,
} from '../../testing/wp-12-records-fixtures';

import { EditRecord, type EditRecordActions } from './EditRecord';

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
      <div style={{ minBlockSize: 160, padding: 'var(--bldr-space-3xl)' }}>
        <Story />
      </div>
    </div>
  );
};

/** Every controller action the record may call, logged in the Actions panel. */
const actions: EditRecordActions = {
  undoEdit: fn(),
  redoEdit: fn(),
  reveal: fn(),
  openPageHistory: fn(),
};

/* ── Plays ────────────────────────────────────────────────────────────────── */

async function expectNoSidewaysScroll(canvasElement: HTMLElement): Promise<void> {
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

/** A record that says no time: the head has no figure at all, never "0:00". */
async function expectNoClock(canvasElement: HTMLElement): Promise<void> {
  await expect(canvasElement.querySelector('.ck-agent-record__meta')).toBeNull();
  await expect(canvasElement.textContent).not.toContain('0:00');
}

/* ── Every stage phrase, and Undo that turns into Redo ────────────────────── */

/** The mapped stage phrases a running edit may show, in the order a run passes them. */
const STAGES = [
  'run.understanding',
  'edit.started',
  'edit.writing',
  'edit.checking',
  'edit.repairing',
  'edit.applying',
] as const satisfies readonly EditStageKey[];

function EveryStage({ locale }: { readonly locale: Locale }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-3xl)' }}>
      {STAGES.map((stage) => (
        <EditRecord
          key={stage}
          locale={locale}
          view={{ ...editRunning(locale, stage), turnId: `edit-${stage}` }}
          actions={actions}
          onMenuSelect={fn()}
        />
      ))}
    </div>
  );
}

/**
 * Undo, then Redo, with the view the controller would send back: the button keeps its place
 * and its focus while its label follows the state (SPEC §6.3).
 */
function UndoRoundTrip({ locale }: { readonly locale: Locale }) {
  const [undone, setUndone] = useState(false);
  const view: EditRecordView = undone
    ? { ...editUndone(locale), turnId: 'edit-round-trip' }
    : { ...editDone(locale), turnId: 'edit-round-trip' };
  return (
    <EditRecord
      locale={locale}
      view={view}
      actions={{
        ...actions,
        undoEdit: () => {
          setUndone(true);
        },
        redoEdit: () => {
          setUndone(false);
        },
      }}
      onMenuSelect={fn()}
    />
  );
}

/* ── Stories ──────────────────────────────────────────────────────────────── */

const meta = {
  title: 'Agent/Records/EditRecord',
  component: EditRecord,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: editDone('en'), actions, onMenuSelect: fn() },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof EditRecord>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Arabic twin of a story: the same phase, in Arabic, right to left. */
function arabic(view: EditRecordView, frame: Frame = {}): Story {
  return {
    args: { locale: 'ar', view },
    globals: { direction: 'rtl' },
    parameters: { panel: { locale: 'ar', ...frame } },
  };
}

/**
 * §3.6 running: "Editing Hero", one live line with the mapped stage phrase in a shimmer, no
 * clock (the RunBar owns it) and no footer.
 */
export const Running: Story = {
  args: { view: editRunning('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Editing Hero' })).toBeVisible();
    await expect(canvas.getByText(t('en', 'edit.checking'))).toHaveClass('ck-agent-lead__live');
    await expectNoClock(canvasElement);
    await expect(canvasElement.querySelector('.ck-agent-record__footer')).toBeNull();
  },
};

export const RunningRightToLeft: Story = arabic(editRunning('ar'));
export const RunningDark: Story = {
  args: { view: editRunning('en') },
  parameters: { panel: { theme: 'dark' } },
};
export const RunningRightToLeftDark: Story = arabic(editRunning('ar'), { theme: 'dark' });

/** Every stage phrase a run passes through; never the provider's narration. */
export const RunningEveryStage: Story = { render: () => <EveryStage locale="en" /> };
export const RunningEveryStageRightToLeft: Story = {
  render: () => <EveryStage locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** No target: the whole page is being edited. */
export const RunningPageWide: Story = { args: { view: editPageWide('en', 'running') } };
export const RunningPageWideRightToLeft: Story = arabic(editPageWide('ar', 'running'));

/** §3.6 done: before → after, the final time, Show on page and Undo. */
export const Done: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('article', { name: 'Hero updated' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Undo Hero' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: t('en', 'edit.showOnPage') })).toBeVisible();
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const DoneRightToLeft: Story = {
  ...arabic(editDone('ar')),
  play: async ({ canvasElement }) => {
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const DoneDark: Story = { parameters: { panel: { theme: 'dark' } } };
export const DoneRightToLeftDark: Story = arabic(editDone('ar'), { theme: 'dark' });

/** From 400px the labels take their own 96px column. */
export const DoneAt420: Story = { parameters: { panel: { width: 420 } } };
export const DoneAt420RightToLeft: Story = arabic(editDone('ar'), { width: 420 });

/**
 * The direct edit (the engine's `source: 'direct'`): a one-word title change applied with no
 * model call. It is born done: no stages, no live line, no "0:00".
 */
export const Instant: Story = {
  args: { view: editInstant('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'FAQ updated' })).toBeVisible();
    await expect(canvasElement.querySelector('.ck-agent-lead__live')).toBeNull();
    await expectNoClock(canvasElement);
  },
};

export const InstantRightToLeft: Story = {
  ...arabic(editInstant('ar')),
  play: async ({ canvasElement }) => {
    await expectNoClock(canvasElement);
  },
};

export const InstantDark: Story = {
  args: { view: editInstant('en') },
  parameters: { panel: { theme: 'dark' } },
};
export const InstantRightToLeftDark: Story = arabic(editInstant('ar'), { theme: 'dark' });

/** Five changes: three lines, then "Show all changes (5)". */
export const DoneManyChanges: Story = { args: { view: editDoneMany('en') } };
export const DoneManyChangesRightToLeft: Story = arabic(editDoneMany('ar'));

/** A page-wide change: the title names the page. */
export const DonePageWide: Story = { args: { view: editPageWide('en') } };
export const DonePageWideRightToLeft: Story = arabic(editPageWide('ar'));

/** Landed, and no line reads it: the record says so, and keeps its Undo. */
export const DoneUnlisted: Story = { args: { view: editUnlisted('en') } };
export const DoneUnlistedRightToLeft: Story = arabic(editUnlisted('ar'));

/** A partial Auto result reports accepted/planned steps and retains its actual changes and Undo. */
export const PartiallyApplied: Story = {
  args: { view: { ...editPageWide('en', 'done'), partial: { kept: 2, total: 3 } } },
};
export const PartiallyAppliedRightToLeft: Story = arabic({
  ...editPageWide('ar', 'done'),
  partial: { kept: 2, total: 3 },
});

/** §3.8: an Ask proposal that was applied. */
export const Applied: Story = { args: { view: editApplied('en') } };
export const AppliedRightToLeft: Story = arabic(editApplied('ar'));

/** It already matched what was asked: the dashed ring, a sentence, nothing to undo. */
export const NoChange: Story = {
  args: { view: editNoChange('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(t('en', 'edit.noChange'))).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /^Undo/u })).toBeNull();
  },
};

export const NoChangeRightToLeft: Story = arabic(editNoChange('ar'));
export const NoChangeDark: Story = {
  args: { view: editNoChange('en') },
  parameters: { panel: { theme: 'dark' } },
};
export const NoChangeRightToLeftDark: Story = arabic(editNoChange('ar'), { theme: 'dark' });

/** Stopped before it applied: the page wasn't changed. */
export const Stopped: Story = { args: { view: editStopped('en') } };
export const StoppedRightToLeft: Story = arabic(editStopped('ar'));

/** Undone: the lines stay as the record of what was taken back; Redo brings it back. */
export const Undone: Story = {
  args: { view: editUndone('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: t('en', 'edit.undone') })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Redo Hero' })).toBeVisible();
  },
};

export const UndoneRightToLeft: Story = arabic(editUndone('ar'));
export const UndoneDark: Story = {
  args: { view: editUndone('en') },
  parameters: { panel: { theme: 'dark' } },
};
export const UndoneRightToLeftDark: Story = arabic(editUndone('ar'), { theme: 'dark' });

/** Undo, then Redo: the same button, focus kept on it both times. */
export const UndoThenRedo: Story = {
  render: () => <UndoRoundTrip locale="en" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const undo = canvas.getByRole('button', { name: 'Undo Hero' });
    await userEvent.click(undo);
    const redo = canvas.getByRole('button', { name: 'Redo Hero' });
    await expect(redo).toBe(undo);
    await expect(redo).toHaveFocus();
    await userEvent.click(redo);
    await expect(canvas.getByRole('button', { name: 'Undo Hero' })).toHaveFocus();
  },
};

export const UndoThenRedoRightToLeft: Story = {
  render: () => <UndoRoundTrip locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** Read back after a reload: Undo stays, `aria-disabled`, described by why; Page history. */
export const Revived: Story = {
  args: { view: editRevived('en') },
  play: async ({ canvasElement }) => {
    const undo = within(canvasElement).getByRole('button', { name: 'Undo Hero' });
    await expect(undo).toHaveAttribute('aria-disabled', 'true');
    await expect(undo).toHaveAccessibleDescription(t('en', 'build.caption.revived'));
  },
};

export const RevivedRightToLeft: Story = arabic(editRevived('ar'));

/** The page moved on since: Undo cannot run cleanly, and says so. */
export const ChangedSince: Story = { args: { view: editChangedSince('en') } };
export const ChangedSinceRightToLeft: Story = arabic(editChangedSince('ar'));

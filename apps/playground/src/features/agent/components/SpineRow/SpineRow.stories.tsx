import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale, SpineRowView } from '../../model/view-types';
import { spineRows, undoOf, type RowSpec } from '../../testing/wp-12-records-fixtures';
import { SpineList } from '../SpineList';

import { SpineRow } from './SpineRow';

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
      <div style={{ padding: 'var(--bldr-space-3xl)' }}>
        <Story />
      </div>
    </div>
  );
};

/**
 * A row takes its columns from its list (subgrid), so each story shows it where it lives:
 * between a landed section above and a waiting one below, so the stretch into its node and
 * the one out of it are both in view.
 */
function inContext(locale: Locale, spec: RowSpec): readonly SpineRowView[] {
  return spineRows(locale, [
    { state: 'landed', undo: spec.undo === undefined ? undefined : undoOf(1) },
    spec,
    'waiting',
  ]);
}

function Row({ locale, spec }: { readonly locale: Locale; readonly spec: RowSpec }) {
  return (
    <SpineList
      locale={locale}
      rows={inContext(locale, spec)}
      onReveal={fn()}
      onPeek={fn()}
      onUndo={fn()}
      onRedo={fn()}
      onRetry={fn()}
    />
  );
}

const meta = {
  title: 'Agent/Records/SpineRow',
  component: SpineRow,
  parameters: { layout: 'centered' },
  args: { locale: 'en', row: spineRows('en', ['writing'])[0] as SpineRowView },
  decorators: [inPanel],
} satisfies Meta<typeof SpineRow>;

export default meta;
type Story = StoryObj<typeof meta>;

function rowStory(spec: RowSpec, frame: Frame = {}): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <Row locale={locale} spec={spec} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** Waiting: a Rule ring on dashed pencil; the title in Slate. */
export const Waiting: Story = rowStory({ state: 'waiting' });
/** Writing: the light travels down the stretch into its node; the title a weight heavier. */
export const Writing: Story = rowStory({ state: 'writing' });
/** A second try looks like writing, so it says "Second try" at every width. */
export const Retrying: Story = rowStory({ state: 'retrying' });
/** Written, waiting its turn to land: an Indigo outline ring, the stretch still and pale. */
export const Drafted: Story = rowStory({ state: 'drafted' });
/** On the page: the disc, the check, the ink. Undo waits for hover or focus. */
export const Landed: Story = rowStory({ state: 'landed', undo: undoOf(2) });

/** Hover reveals Undo under a fine pointer; focus reveals it too. */
export const LandedUndoOnFocus: Story = {
  ...rowStory({ state: 'landed', undo: undoOf(2) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const undo = canvas.getByRole('button', { name: 'Undo Hero' });
    const trailing = undo.closest('.ck-agent-spine-row__trailing');
    if (trailing === null) throw new Error('no trailing action');
    // Tab from the row's own button to its Undo: focus reveals it (after its 120ms fade).
    canvas.getByRole('button', { name: /^Section 2 of 3/u }).focus();
    await userEvent.tab();
    await expect(undo).toHaveFocus();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(getComputedStyle(trailing).opacity).toBe('1');
  },
};

/** Undone: a dashed ring, the word "Undone", and Redo in view. */
export const Undone: Story = rowStory({
  state: 'undone',
  undo: { kind: 'redo', transactionId: 'tx-undo' },
});

/** Failed: the Alarm disc, the reason on its own line, Retry always in view. */
export const Failed: Story = rowStory({ state: 'failed', reason: 'timeout', canRetry: true });

/** Not written: a dashed ring; with its placeholder gone it is text, not a button. */
export const NotWritten: Story = rowStory({ state: 'notWritten', offPage: true });

/** After a reload: Undo shown unavailable (on hover or focus), described by the record's caption. */
export const UndoUnavailable: Story = rowStory({
  state: 'landed',
  undo: { kind: 'unavailable', why: 'revived' },
});

/** Undo refused: the section changed after it was built; the row keeps its ink and says why. */
export const UndoRefused: Story = rowStory({
  state: 'landed',
  undo: { kind: 'unavailable', why: 'changedSince' },
});

/** Every state word, at 420px where every row says its state. */
export const StateWordsAt420: Story = {
  render: () => (
    <SpineList
      locale="en"
      rows={spineRows('en', ['landed', 'retrying', 'writing', 'drafted', 'waiting', 'notWritten'])}
    />
  ),
  parameters: { panel: { width: 420 } },
};

export const StateWordsAt420RightToLeft: Story = {
  render: () => (
    <SpineList
      locale="ar"
      rows={spineRows('ar', ['landed', 'retrying', 'writing', 'drafted', 'waiting', 'notWritten'])}
    />
  ),
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 420 } },
};

export const FailedRightToLeft: Story = rowStory(
  { state: 'failed', reason: 'pageChanged', canRetry: true },
  { locale: 'ar' },
);

export const FailedRightToLeftDark: Story = rowStory(
  { state: 'failed', reason: 'pageChanged', canRetry: true },
  { locale: 'ar', theme: 'dark' },
);

export const WritingRightToLeft: Story = rowStory({ state: 'writing' }, { locale: 'ar' });
export const DraftedRightToLeft: Story = rowStory({ state: 'drafted' }, { locale: 'ar' });

export const UndoneRightToLeft: Story = rowStory(
  { state: 'undone', undo: { kind: 'redo', transactionId: 'tx-undo' } },
  { locale: 'ar' },
);

/** The row's name says its place, title and state: the words a screen reader hears. */
export const AccessibleName: Story = {
  ...rowStory({ state: 'drafted' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: t('en', 'row.aria', {
          i: 2,
          n: 3,
          title: 'Hero',
          state: t('en', 'row.drafted'),
        }),
      }),
    ).toBeVisible();
  },
};

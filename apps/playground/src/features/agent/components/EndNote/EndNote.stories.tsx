import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';

import { t } from '../../copy';
import type { EndNoteKey, Locale } from '../../model/view-types';
import { END_NOTE_KEYS, endNote } from '../../testing/wp-12-records-fixtures';

import { EndNote } from './EndNote';

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

/* ── Plays ────────────────────────────────────────────────────────────────── */

/**
 * One line, named by its sentence, with no action; its words start on the records' 24px text
 * edge, and its glyph sits centred on the first 32px line even when the sentence wraps.
 */
async function expectOneQuietLine(canvasElement: HTMLElement, locale: Locale, key: EndNoteKey) {
  const canvas = within(canvasElement);
  const line = t(locale, `end.${key}`);
  await expect(canvas.getByRole('article', { name: line })).toBeVisible();
  await expect(canvas.queryByRole('button')).toBeNull();
  const head = canvasElement.querySelector('.ck-agent-record__head');
  const glyph = head?.querySelector('.ck-agent-glyph')?.getBoundingClientRect();
  const box = head?.getBoundingClientRect();
  if (glyph === undefined || box === undefined) throw new Error('no head');
  // The glyph box (16px) centred on the first 32px line.
  await expect(Math.abs(glyph.top - box.top - 8)).toBeLessThan(0.5);
}

/** Every ending stacked, as a long conversation might hold them. */
function EveryEnding({ locale }: { readonly locale: Locale }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-3xl)' }}>
      {END_NOTE_KEYS.map((key) => (
        <EndNote key={key} locale={locale} view={endNote(key)} />
      ))}
    </div>
  );
}

/* ── Stories ──────────────────────────────────────────────────────────────── */

const meta = {
  title: 'Agent/Records/EndNote',
  component: EndNote,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: endNote('proposalDiscarded') },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof EndNote>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One ending, in English. */
function english(key: EndNoteKey): Story {
  return {
    args: { view: endNote(key) },
    play: async ({ canvasElement }) => {
      await expectOneQuietLine(canvasElement, 'en', key);
    },
  };
}

/** The Arabic twin of a story: the same ending, in Arabic, right to left. */
function arabic(key: EndNoteKey, frame: Frame = {}): Story {
  return {
    args: { locale: 'ar', view: endNote(key) },
    globals: { direction: 'rtl' },
    parameters: { panel: { locale: 'ar', ...frame } },
    play: async ({ canvasElement }) => {
      await expectOneQuietLine(canvasElement, 'ar', key);
    },
  };
}

/** An Ask proposal set aside. The dashed ring: nothing of it is on the page. */
export const ProposalDiscarded: Story = english('proposalDiscarded');
export const ProposalDiscardedRightToLeft: Story = arabic('proposalDiscarded');
export const ProposalDiscardedDark: Story = {
  ...english('proposalDiscarded'),
  parameters: { panel: { theme: 'dark' } },
};
export const ProposalDiscardedRightToLeftDark: Story = arabic('proposalDiscarded', {
  theme: 'dark',
});

export const PlanDiscarded: Story = english('planDiscarded');
export const PlanDiscardedRightToLeft: Story = arabic('planDiscarded');

export const PlanSuperseded: Story = english('planSuperseded');
export const PlanSupersededRightToLeft: Story = arabic('planSuperseded');

/** Stopped before any output; the request above it is dimmed and captioned "Not run". */
export const StoppedBeforeChange: Story = english('stoppedBeforeChange');
export const StoppedBeforeChangeRightToLeft: Story = arabic('stoppedBeforeChange');

export const Interrupted: Story = english('interrupted');
export const InterruptedRightToLeft: Story = arabic('interrupted');

/**
 * The notes said after a build that did land, about where it landed: the note glyph, never
 * the dashed ring, which would claim nothing landed. The longest lines wrap, never clip.
 */
export const SiteAsOnePage: Story = english('siteAsOnePage');
export const SiteAsOnePageRightToLeft: Story = arabic('siteAsOnePage');

export const NewPageAppended: Story = english('newPageAppended');
export const NewPageAppendedRightToLeft: Story = arabic('newPageAppended');

export const AppendedNotReplaced: Story = english('appendedNotReplaced');
export const AppendedNotReplacedRightToLeft: Story = arabic('appendedNotReplaced');

/** Every ending, stacked at 320. */
export const EveryEndingAt320: Story = { render: () => <EveryEnding locale="en" /> };

export const EveryEndingAt420RightToLeft: Story = {
  render: () => <EveryEnding locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 420 } },
};

export const EveryEndingRightToLeftDark: Story = {
  render: () => <EveryEnding locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

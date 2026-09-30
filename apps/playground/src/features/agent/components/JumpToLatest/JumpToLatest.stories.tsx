import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { JUMP_LABEL_KEY, t } from '../../copy';
import type { Locale, RunActivity } from '../../model/view-types';

import { JumpToLatest } from './JumpToLatest';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * The pill where it lives: floating over the thread's paper, centred, 12px above the
 * dock's top edge (the Hairline at the frame's bottom stands in for the composer).
 */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <section
      className="ck-agent"
      aria-label={t(locale, 'header.name')}
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: 'relative',
        inlineSize: width,
        blockSize: 120,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        borderBlockEnd: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          insetBlockEnd: 'var(--bldr-space-xl)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Story />
      </div>
    </section>
  );
};

/** The visible word opens the accessible name (WCAG 2.5.3); idle, the name contains it. */
async function expectLabelInName(
  canvasElement: HTMLElement,
  locale: Locale,
  activity: RunActivity | null,
): Promise<void> {
  const word = t(locale, activity === null ? 'jump.idle' : JUMP_LABEL_KEY[activity]);
  const pill = within(canvasElement).getByRole('button');
  await expect(pill).toHaveTextContent(word);
  // Speech input matches words, not letter case (WCAG 2.5.3): "Latest" is in "Jump to the latest".
  const name = (pill.getAttribute('aria-label') ?? '').toLocaleLowerCase(locale);
  const spoken = word.toLocaleLowerCase(locale);
  await expect(activity === null ? name.includes(spoken) : name.startsWith(spoken)).toBe(true);
  const box = pill.getBoundingClientRect();
  await expect(Math.round(box.height)).toBe(32);
}

const meta = {
  title: 'Agent/Frame/JumpToLatest',
  component: JumpToLatest,
  parameters: { layout: 'centered' },
  args: { locale: 'en', activity: null, visible: true, onJump: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof JumpToLatest>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle, scrolled up: "Latest". Its name is "Jump to the latest". */
export const Latest: Story = {
  play: async ({ canvasElement, args }) => {
    await expectLabelInName(canvasElement, 'en', null);
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Jump to the latest' }),
    );
    await expect(args.onJump).toHaveBeenCalledTimes(1);
  },
};

/** A build is live below: "Building". Its name is "Building: jump to the latest". */
export const Building: Story = {
  args: { activity: 'build' },
  play: async ({ canvasElement }) => {
    await expectLabelInName(canvasElement, 'en', 'build');
  },
};

/** An edit is live below: "Editing". */
export const Editing: Story = {
  args: { activity: 'edit' },
  play: async ({ canvasElement }) => {
    await expectLabelInName(canvasElement, 'en', 'edit');
  },
};

/** Any other live run (routing, a plan, a proposal, an answer): "Working". */
export const Working: Story = {
  args: { activity: 'plan' },
  play: async ({ canvasElement }) => {
    await expectLabelInName(canvasElement, 'en', 'plan');
  },
};

/** Arabic: «يبني الآن», the arrow on the right, at the reading start. */
export const BuildingArabic: Story = {
  args: { locale: 'ar', activity: 'build' },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectLabelInName(canvasElement, 'ar', 'build');
    const pill = within(canvasElement).getByRole('button');
    const arrow = pill.querySelector('.ck-agent-icon')?.getBoundingClientRect();
    const word = pill.querySelector('.ck-agent-jump__label')?.getBoundingClientRect();
    if (arrow === undefined || word === undefined) throw new Error('pill parts');
    await expect(arrow.left).toBeGreaterThanOrEqual(word.right);
  },
};

export const EditingArabic: Story = {
  args: { locale: 'ar', activity: 'edit' },
  globals: { direction: 'rtl' },
};

export const LatestArabicDark: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { theme: 'dark' } },
};

export const BuildingDark: Story = {
  args: { activity: 'build' },
  parameters: { panel: { theme: 'dark' } },
};

/** At the bottom: the pill is `hidden`, out of the tab order and the accessibility tree. */
export const Hidden: Story = {
  args: { visible: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  },
};

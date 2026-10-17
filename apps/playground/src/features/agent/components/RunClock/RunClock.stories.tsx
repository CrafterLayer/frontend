import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { RunGlyph } from '../RunGlyph';

import { RunClock } from './RunClock';

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
      <div
        style={{
          padding: 'var(--bldr-space-3xl)',
        }}
      >
        <Story />
      </div>
    </div>
  );
};

/* Read once when the stories load, so a story's clock starts where its name says. */
const LOADED_AT = Date.now();

/** The clock where it lives: the RunBar's status line (SPEC §4.17), glyph, status, clock. */
function StatusLine({ locale, startedAt }: { locale: Locale; startedAt: number }) {
  return (
    <p
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--bldr-space-md)',
        margin: 0,
        fontSize: 'var(--bldr-font-size-meta)',
        fontWeight: 500,
        lineHeight: 'var(--bldr-line-height-meta)',
      }}
    >
      <RunGlyph state="working" />
      <span style={{ flex: 1 }}>{t(locale, 'build.writing', { n: 4 })}</span>
      <RunClock startedAt={startedAt} />
    </p>
  );
}

async function expectSilentClock(canvasElement: HTMLElement): Promise<void> {
  for (const clock of canvasElement.querySelectorAll('.ck-agent-clock')) {
    await expect(clock).toHaveAttribute('aria-hidden', 'true');
    await expect(clock).toHaveAttribute('dir', 'ltr');
    await expect(clock.textContent).toMatch(/^\d+:\d{2}$/);
  }
}

const meta = {
  title: 'Agent/Primitives/RunClock',
  component: RunClock,
  parameters: { layout: 'centered' },
  args: { startedAt: LOADED_AT - 72_000 },
  decorators: [inPanel],
} satisfies Meta<typeof RunClock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A live run, started 72 seconds before the stories loaded: it counts from 1:12. */
export const Live: Story = {
  play: async ({ canvasElement }) => {
    await expectSilentClock(canvasElement);
  },
};

/** A finished run: the final time, frozen. No timer runs for it. */
export const Final: Story = {
  args: { startedAt: LOADED_AT - 200_000, endedAt: LOADED_AT - 59_000 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.ck-agent-clock')).toHaveTextContent('2:21');
  },
};

export const InStatusLine: Story = {
  render: () => <StatusLine locale="en" startedAt={LOADED_AT - 72_000} />,
  play: async ({ canvasElement }) => {
    await expectSilentClock(canvasElement);
  },
};

export const InStatusLineDark: Story = {
  render: () => <StatusLine locale="en" startedAt={LOADED_AT - 72_000} />,
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: the clock stays `1:12`, Latin digits in an LTR island, at the line's inline end. */
export const InStatusLineRightToLeft: Story = {
  render: () => <StatusLine locale="ar" startedAt={LOADED_AT - 72_000} />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expectSilentClock(canvasElement);
    const clock = canvasElement.querySelector('.ck-agent-clock');
    const status = canvasElement.querySelector('.ck-agent-clock')?.previousElementSibling;
    if (clock === null || status === null || status === undefined) throw new Error('line parts');
    // Right to left, the clock sits to the left of the status.
    await expect(clock.getBoundingClientRect().right).toBeLessThanOrEqual(
      status.getBoundingClientRect().left + 1,
    );
  },
};

export const InStatusLineRightToLeftDark: Story = {
  render: () => <StatusLine locale="ar" startedAt={LOADED_AT - 72_000} />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

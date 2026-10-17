import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t, tAnnounce } from '../../copy';
import type { Locale } from '../../model/view-types';
import { frameAnnouncements } from '../../testing/wp-11-frame-fixtures';

import { LiveStatus } from './LiveStatus';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The panel's root: a region named أبو غضب, in the story's language and direction. */
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
        minBlockSize: 120,
        padding: 'var(--bldr-space-3xl)',
        boxSizing: 'border-box',
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <Story />
    </section>
  );
};

/* ── The sequence, with a transcript a sighted reviewer can read ─────────── */

const LIVE = '[aria-live], [role=status], [role=log], [role=alert]';

const transcriptStyle = {
  display: 'grid',
  gap: 'var(--bldr-space-xs)',
  margin: 0,
  paddingInlineStart: 'var(--bldr-space-5xl)',
  color: 'var(--bldr-panel-text-soft)',
  fontSize: 'var(--bldr-font-size-read)',
  lineHeight: 'var(--bldr-line-height-read)',
} as const;

/**
 * LiveStatus as AgentPanel feeds it through one build: each press of "Next" hands it the
 * next announcement. The region itself is heard, never seen, so the numbered list under
 * it shows what a screen reader has said so far. The list is story chrome, not live.
 */
function Sequence({ locale }: { readonly locale: Locale }) {
  const sequence = frameAnnouncements(locale);
  const [step, setStep] = useState(0);
  const current = step === 0 ? null : (sequence[step - 1] ?? null);
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-xl)' }}>
      <LiveStatus locale={locale} announcement={current} />
      <ol aria-label="Spoken so far" lang="en" style={transcriptStyle}>
        {sequence.slice(0, step).map((announcement) => (
          <li key={announcement.seq} lang={locale}>
            {tAnnounce(locale, announcement.key, announcement.params)}
          </li>
        ))}
      </ol>
      <button
        type="button"
        lang="en"
        disabled={step >= sequence.length}
        onClick={() => {
          setStep((value) => Math.min(value + 1, sequence.length));
        }}
        style={{ justifySelf: 'start', font: 'inherit' }}
      >
        Next announcement
      </button>
    </div>
  );
}

/**
 * Steps through the whole sequence and checks, at every step, that the one region says
 * exactly the newest sentence, and that it is still the panel's only live region. The two
 * "Copied" in a row must each be a new node, or the second would never be spoken.
 */
async function playSequence(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const canvas = within(canvasElement);
  const region = canvas.getByRole('status');
  await expect(region).toHaveAttribute('aria-live', 'polite');
  await expect(region).toHaveAttribute('aria-atomic', 'true');
  await expect(region).toHaveAttribute('lang', locale);
  await expect(region).toBeEmptyDOMElement();
  const next = canvas.getByRole('button', { name: 'Next announcement' });
  let previous: Element | null = null;
  for (const announcement of frameAnnouncements(locale)) {
    await userEvent.click(next);
    const sentence = tAnnounce(locale, announcement.key, announcement.params);
    await expect(region).toHaveTextContent(sentence);
    await expect(canvasElement.querySelectorAll(LIVE)).toHaveLength(1);
    const node = region.firstElementChild;
    await expect(node).not.toBe(previous);
    previous = node;
  }
  await expect(next).toBeDisabled();
}

const meta = {
  title: 'Agent/Frame/LiveStatus',
  component: LiveStatus,
  parameters: { layout: 'centered' },
  args: { locale: 'en', announcement: null },
  decorators: [inPanel],
} satisfies Meta<typeof LiveStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mounted and silent: the region exists before anything is said, so the first is heard. */
export const Silent: Story = {
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('status');
    await expect(region).toBeEmptyDOMElement();
    await expect(region).toHaveClass('ck-agent-live');
    await expect(canvasElement.querySelectorAll(LIVE)).toHaveLength(1);
  },
};

/** One announcement, as the region holds it: the `announce.*` sentence, MSA in Arabic. */
export const Spoken: Story = {
  args: { announcement: { key: 'build.done', params: { n: 8 }, seq: 6 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      tAnnounce('en', 'build.done', { n: 8 }),
    );
  },
};

export const SpokenArabic: Story = {
  args: { locale: 'ar', announcement: { key: 'build.done', params: { n: 8 }, seq: 6 } },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      tAnnounce('ar', 'build.done', { n: 8 }),
    );
  },
};

/** A build's announcements, one per press: start, layout, progress, blocked, done, then more. */
export const AnnouncementSequence: Story = {
  render: () => <Sequence locale="en" />,
  play: async ({ canvasElement }) => {
    await playSequence(canvasElement, 'en');
  },
};

export const AnnouncementSequenceArabic: Story = {
  args: { locale: 'ar' },
  render: () => <Sequence locale="ar" />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await playSequence(canvasElement, 'ar');
  },
};

export const AnnouncementSequenceArabicDark: Story = {
  args: { locale: 'ar' },
  render: () => <Sequence locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { theme: 'dark' } },
};

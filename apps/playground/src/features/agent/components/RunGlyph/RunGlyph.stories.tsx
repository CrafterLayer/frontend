import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type CSSProperties } from 'react';
import { expect } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { RunGlyph } from './RunGlyph';
import { RUN_GLYPH_STATES, type RunGlyphState } from './run-glyph-state';

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
          fontSize: 'var(--bldr-font-size-read)',
          lineHeight: 'var(--bldr-line-height-read)',
        }}
      >
        <Story />
      </div>
    </div>
  );
};

/* ── Every state beside the words that carry it ───────────────────────────── */

/** The word a row or record says beside each glyph: the state is never the glyph alone. */
function wordFor(locale: Locale, state: RunGlyphState): string {
  switch (state) {
    case 'waiting':
      return t(locale, 'row.waiting');
    case 'working':
      return t(locale, 'row.writing');
    case 'drafted':
      return t(locale, 'row.drafted');
    case 'landed':
      return t(locale, 'row.landed');
    case 'absent':
      return t(locale, 'row.notWritten');
    case 'failed':
      return t(locale, 'row.failed');
    case 'partial':
      return t(locale, 'build.title.partial', { n: 1 });
    case 'decision':
      return t(locale, 'plan.tag.approval');
    case 'note':
      return t(locale, 'answer.title');
  }
}

function Gallery({ locale }: { locale: Locale }) {
  return (
    <ul
      style={{
        display: 'grid',
        gap: 'var(--bldr-space-xs)',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {RUN_GLYPH_STATES.map((state) => (
        <li
          key={state}
          data-state={state}
          style={{
            display: 'grid',
            gridTemplateColumns: 'var(--bldr-space-3xl) 48px minmax(0, 1fr)',
            alignItems: 'center',
            columnGap: 'var(--bldr-space-md)',
            minBlockSize: 'var(--bldr-agent-row-height)',
          }}
        >
          <RunGlyph state={state} />
          <span style={{ display: 'grid', placeItems: 'center', blockSize: 48 }}>
            <span style={{ scale: '2.5' }}>
              <RunGlyph state={state} />
            </span>
          </span>
          <span>{wordFor(locale, state)}</span>
        </li>
      ))}
    </ul>
  );
}

/** A section's life on a live build: waiting, writing, written, on the page. */
const LIFE = ['waiting', 'working', 'drafted', 'landed'] as const;

/** A live row, stepping through LIFE every 1.2s. */
function Landing() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setStep((current) => (current + 1) % LIFE.length);
    }, 1200);
    return () => {
      clearTimeout(timer);
    };
  }, [step]);
  const state = LIFE[step] ?? 'waiting';
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--bldr-space-md)', margin: 0 }}>
      <RunGlyph state={state} animate />
      <span>{wordFor('en', state)}</span>
    </p>
  );
}

const meta = {
  title: 'Agent/Primitives/RunGlyph',
  component: RunGlyph,
  parameters: { layout: 'centered' },
  args: { state: 'waiting' },
  argTypes: {
    state: { control: 'select', options: RUN_GLYPH_STATES },
    animate: { control: 'boolean' },
  },
  decorators: [inPanel],
} satisfies Meta<typeof RunGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

/* One story per state (SPEC §4.7). */

/** Waiting: an open Rule ring (rows; a plan's pencil nodes). */
export const Waiting: Story = { args: { state: 'waiting' } };
/** Working: a Halo ring with a quarter of Indigo turning clockwise; still under reduced motion. */
export const Working: Story = { args: { state: 'working' } };
/** Drafted: an Indigo ring with a core, ◎: written, waiting its turn to land. */
export const Drafted: Story = { args: { state: 'drafted' } };
/** Landed: the Indigo disc with a check: on the page. */
export const Landed: Story = { args: { state: 'landed' } };
/** Absent: a dashed ring: not written, stopped, undone. */
export const Absent: Story = { args: { state: 'absent' } };
/** Failed: the Alarm disc with a cross. */
export const Failed: Story = { args: { state: 'failed' } };
/** Partial: landed, with an Alarm dot at the reading end, ringed in Paper. */
export const Partial: Story = { args: { state: 'partial' } };
/** Decision: an Indigo diamond, waiting for the person. */
export const Decision: Story = { args: { state: 'decision' } };
/** Note: three lines of prose: an answer. */
export const Note: Story = { args: { state: 'note' } };

/* Every state, with the words that carry it, in both themes and both directions. */

export const Light: Story = {
  render: () => <Gallery locale="en" />,
  play: async ({ canvasElement }) => {
    for (const svg of canvasElement.querySelectorAll('li > svg.ck-agent-glyph')) {
      const box = svg.getBoundingClientRect();
      await expect([box.width, box.height]).toEqual([16, 16]);
    }
  },
};

export const Dark: Story = {
  render: () => <Gallery locale="en" />,
  parameters: { panel: { theme: 'dark' } },
};

/** Right to left: the partial dot and the note's ragged edge move to the reading end. */
export const RightToLeft: Story = {
  render: () => <Gallery locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector(
      'li[data-state="partial"] > svg .ck-agent-glyph__badge',
    );
    const check = canvasElement.querySelector(
      'li[data-state="landed"] > svg .ck-agent-glyph__mark',
    );
    if (badge === null || check === null) throw new Error('glyph parts missing');
    await expect(getComputedStyle(badge).scale).toBe('-1 1');
    // A check never mirrors.
    await expect(getComputedStyle(check).scale).toBe('none');
  },
};

export const RightToLeftDark: Story = {
  render: () => <Gallery locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

/** On a decision card's Sheet, the node's ring follows the card (`--ck-agent-ground`). */
export const OnSheet: Story = {
  render: () => (
    <div
      style={
        {
          '--ck-agent-ground': 'var(--bldr-surface)',
          padding: 'var(--bldr-space-xl)',
          border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
          borderRadius: 'var(--bldr-radius-lg)',
          background: 'var(--bldr-surface)',
        } as CSSProperties
      }
    >
      <Gallery locale="en" />
    </div>
  ),
};

/** A live row landing: the disc inks in over the ring and the check settles (SPEC §5 moment 1). */
export const LiveLanding: Story = {
  render: () => <Landing />,
};

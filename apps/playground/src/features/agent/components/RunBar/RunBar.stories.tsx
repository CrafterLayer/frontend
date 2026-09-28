import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import type { Locale } from '../../model/view-types';
import { liveRun, stoppingRun } from '../../testing/wp-14-composer-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { RunBar } from './RunBar';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container, so the clock's 300px query sees the
 * panel's width. The bar is drawn where it lives: at the top of the composer's card, in
 * the dock's 8px inset.
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
      <div style={{ padding: 'var(--bldr-space-4xl) var(--bldr-space-md) var(--bldr-space-md)' }}>
        <div
          style={{
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
            borderRadius: 'var(--bldr-radius-xl)',
            background: 'var(--bldr-surface)',
            minBlockSize: 96,
          }}
        >
          <AgentTooltipProvider>
            <Story />
          </AgentTooltipProvider>
        </div>
      </div>
    </div>
  );
};

/** Stories render at module load; the clock counts from 1:12 before this moment. */
const NOW = Date.now();

const meta = {
  title: 'Agent/Composer/RunBar',
  component: RunBar,
  parameters: { layout: 'centered' },
  args: { locale: 'en', run: liveRun(NOW), onStop: fn(), apple: true },
  decorators: [inPanel],
} satisfies Meta<typeof RunBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Live (SPEC §3.4, short form): the working glyph on the thread's glyph column, the status
 * on its title column, the one clock, Stop. Not a live region: LiveStatus speaks for it.
 */
export const Live: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector('.ck-agent-runbar__status')).toHaveTextContent(
      'Writing 4 sections',
    );
    await expect(canvas.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[aria-live], [role="status"]')).toBeNull();
  },
};

/** Stopping (SPEC §3.10): the line says so, and Stop keeps its place with the spinner. */
export const Stopping: Story = {
  args: { run: stoppingRun(NOW) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Stopping…')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Stopping…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

/** Blocked (SPEC §3.4): one section holds the rest; its title sits in `<bdi>`. */
export const Blocked: Story = {
  args: { run: liveRun(NOW, 'build.blocked', { title: 'Hero' }) },
};

/** A landing holds the line for 2.4s (SPEC §3.4). */
export const Landed: Story = {
  args: { run: liveRun(NOW, 'build.landed', { title: 'Services' }) },
};

/** An edit's mapped stage (SPEC §3.6), never the provider's narration. */
export const EditChecking: Story = {
  args: { run: liveRun(NOW, 'edit.checking', {}) },
};

/** A long title cuts with an ellipsis at the inline end; the full title is in the thread. */
export const LongTitle: Story = {
  args: { run: liveRun(NOW, 'build.blocked', { title: 'Patient stories and reviews' }) },
};

/** 288px, the narrowest panel: under a 300px container the clock goes, Stop keeps its word. */
export const Narrow: Story = {
  parameters: { panel: { width: 288 } },
};

/** 420px (container ≥ 400): the same line with room to spare. */
export const Wide: Story = {
  parameters: { panel: { width: 420 } },
};

export const Dark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: the glyph and status at the right, Stop at the left; `1:12` stays `1:12`. */
export const RightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const RightToLeftDark: Story = {
  args: { locale: 'ar', run: liveRun(NOW, 'build.blocked', { title: 'الواجهة' }) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const StoppingRightToLeft: Story = {
  args: { locale: 'ar', run: stoppingRun(NOW) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** Leaving: the bar folds away over 140ms and is inert while it does. */
export const Leaving: Story = {
  args: { leaving: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.ck-agent-runbar')).toHaveAttribute('inert');
  },
};

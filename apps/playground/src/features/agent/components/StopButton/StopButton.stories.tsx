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
import type { Locale } from '../../model/view-types';
import { AgentTooltipProvider } from '../IconButton';

import { StopButton } from './StopButton';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container. Stop lives on the composer's Sheet,
 * so the frame lays one under it. A story picks its frame with `parameters.panel`.
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
      <div style={{ minBlockSize: 120, padding: 'var(--bldr-space-3xl)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 'var(--bldr-space-xs)',
            borderRadius: 'var(--bldr-radius-xl)',
            background: 'var(--bldr-surface)',
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

/* ── A real pointer, when the story runs under Vitest's browser mode ─────── */

interface RealPointer {
  click(element: Element): Promise<void>;
}

async function realPointer(): Promise<RealPointer | null> {
  if (!('__vitest_browser__' in globalThis)) return null;
  const { userEvent: browserUserEvent } = await import('vitest/browser');
  return browserUserEvent;
}

const meta = {
  title: 'Agent/Composer/StopButton',
  component: StopButton,
  parameters: { layout: 'centered' },
  args: { locale: 'en', stopping: false, onStop: fn(), apple: true },
  decorators: [inPanel],
} satisfies Meta<typeof StopButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live: ■ and the word, a Rule outline on the Sheet. Hover lays the Wash, never Indigo. */
export const Live: Story = {};

/** The tooltip names the shortcut for the platform: ⌘. on a Mac, Ctrl+. elsewhere. */
export const Tooltip: Story = {
  args: { apple: false },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Stop' });
    button.focus();
    const tooltip = await within(canvasElement).findByRole('tooltip');
    await expect(tooltip).toHaveTextContent('Stop the work (Ctrl+.)');
    await expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+.');
  },
};

/** Stopping: the spinner, the same word, named "Stopping…", `aria-disabled`, still focusable. */
export const Stopping: Story = {
  args: { stopping: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Stopping…' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveTextContent('Stop');
  },
};

export const Dark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

export const StoppingDark: Story = {
  args: { stopping: true },
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: «إيقاف» at the inline end, now the left; the name while stopping contains the word. */
export const RightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const StoppingRightToLeftDark: Story = {
  args: { locale: 'ar', stopping: true },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: t('ar', 'stopping') }),
    ).toHaveTextContent(t('ar', 'stop'));
  },
};

/* ── Behaviour, with the state a RunBar would give it ─────────────────────── */

function StopProbe({ locale }: { readonly locale: Locale }) {
  const [stopping, setStopping] = useState(false);
  return (
    <StopButton
      locale={locale}
      stopping={stopping}
      apple
      onStop={() => {
        setStopping(true);
      }}
    />
  );
}

/** A press stops it; focus stays on the same button while it stops (SPEC §6.3). */
export const KeepsFocusWhileStopping: Story = {
  render: () => <StopProbe locale="en" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Stop' });
    const pointer = await realPointer();
    if (pointer === null) await userEvent.click(button);
    else await pointer.click(button);
    const stopping = canvas.getByRole('button', { name: 'Stopping…' });
    await expect(stopping).toBe(button);
    await expect(stopping).toHaveFocus();
  },
};

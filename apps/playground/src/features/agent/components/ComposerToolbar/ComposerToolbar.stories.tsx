import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { MODEL } from '../../testing/wp-14-composer-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { ComposerToolbar } from './ComposerToolbar';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
  /** Preview the coarse-pointer sizes: 44px items, 8px apart (SPEC §2.3). */
  readonly coarse?: boolean;
}

const COARSE = {
  '--ck-agent-target': 'var(--bldr-hit-target-min)',
  '--ck-agent-toolbar-gap': 'var(--bldr-space-md)',
} as CSSProperties;

/**
 * One panel frame per story, with the toolbar where it lives: the last row of the
 * composer's card, in the dock, with room above for the menus that open upwards.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const {
    locale = 'en',
    theme = 'light',
    width = 320,
    coarse = false,
  } = (parameters['panel'] ?? {}) as Frame;
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
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          minBlockSize: 280,
          padding: '0 var(--bldr-space-md) var(--bldr-space-md)',
          ...(coarse ? COARSE : {}),
        }}
      >
        <div
          style={{
            padding: 7,
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
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

const meta = {
  title: 'Agent/Composer/ComposerToolbar',
  component: ComposerToolbar,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    mode: 'auto',
    model: MODEL,
    send: 'idle-ready',
    enhancement: { status: 'idle' },
    running: false,
    workers: 3,
    onWorkersChange: fn(),
    onModeChange: fn(),
    onModelChange: fn(),
    onMention: fn(),
    onEnhance: fn(),
    onSend: fn(),
  },
  decorators: [inPanel],
} satisfies Meta<typeof ComposerToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * At rest, a draft written: Mode ▾, Model ▾ and the workers chip at the start; ✨, `[@]` and
 * Send at the end, read in the order a request is made.
 */
export const Ready: Story = {
  play: async ({ canvasElement }) => {
    const names = within(canvasElement)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    await expect(names).toEqual([
      'Mode: Auto',
      'Model: Fast',
      `${t('en', 'workers.label')}: ${t('en', 'workers.option', { n: 3 })}`,
      t('en', 'enhance.button'),
      t('en', 'mention.button'),
      'Send',
    ]);
  },
};

/** Build workers are a separate choice from model and effort, fixed while running. */
export const BuildWorkers: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const name = new RegExp(`^${t('en', 'workers.label')}:`, 'u');
    await userEvent.click(canvas.getByRole('button', { name }));
    const menu = await canvas.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: /^6 workers/u }));
    await expect(args.onWorkersChange).toHaveBeenCalledWith(6);
  },
};

/** Nothing written: ✨ and Send wait, both still focusable and explained. */
export const Empty: Story = {
  args: { send: 'idle-empty' },
};

export const LongModelAndEffort: Story = {
  args: {
    model: {
      selected: { ...MODEL.selected, product: 'Professional design and code model 550B' },
      options: [
        { ...MODEL.selected, product: 'Professional design and code model 550B' },
        { ...MODEL.selected, id: 'comparison-model', product: 'Alternate model' },
      ],
    },
    effort: { selected: 'high', options: ['low', 'medium', 'high', 'xhigh', 'max'] },
    onEffortChange: fn(),
  },
  parameters: { panel: { width: 288 } },
  play: async ({ canvasElement }) => {
    const toolbar = canvasElement.querySelector('.ck-agent-toolbar');
    if (!(toolbar instanceof HTMLElement)) throw new Error('No toolbar');
    const bounds = toolbar.getBoundingClientRect();
    for (const button of within(toolbar).getAllByRole('button')) {
      const rect = button.getBoundingClientRect();
      await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
      await expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
    }
  },
};

/** A run is live with a draft: Queue as next; the mode's tooltip says it applies next time. */
export const Running: Story = {
  args: { send: 'running-ready', running: true, mode: 'ask' },
};

/** Queued: the slot opens into a pill; the row wraps rather than clip if it must. */
export const Queued: Story = {
  args: { send: 'running-queued', running: true, mode: 'plan' },
};

/** ✨ at work: its spinner, while the Composer shimmers the draft. */
export const Enhancing: Story = {
  args: { enhancement: { status: 'enhancing' } },
};

/** No rewriting on this provider: no ✨. */
export const ImproveUnavailable: Story = {
  args: { enhancement: { status: 'unavailable' } },
};

/** The provider offers one model: there is no choice to show. */
export const NoModelChoice: Story = {
  args: { model: null },
};

/** `[@]` starts a mention; the Composer types the `@` and opens the list. */
export const Mention: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: t('en', 'mention.button') }),
    );
    await expect(args.onMention).toHaveBeenCalledTimes(1);
  },
};

/** 288px with Queued's pill and a long mode: the actions wrap under the choices. */
export const Narrow: Story = {
  args: { send: 'running-queued', running: true, mode: 'ask' },
  parameters: { panel: { width: 288 } },
};

/** A coarse pointer, previewed: 44px items with 8px between them. */
export const CoarsePointer: Story = {
  parameters: { panel: { coarse: true, width: 390 } },
};

export const ReadyDark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: the menus at the right, Send at the left. */
export const ReadyRightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const QueuedRightToLeftDark: Story = {
  args: { locale: 'ar', send: 'running-queued', running: true },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const CoarsePointerRightToLeft: Story = {
  args: { locale: 'ar', mode: 'plan' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', coarse: true, width: 390 } },
};

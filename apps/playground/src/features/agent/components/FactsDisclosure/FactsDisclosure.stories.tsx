import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { FACTS } from '../../testing/wp-12-records-fixtures';

import { FactsDisclosure } from './FactsDisclosure';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. The disclosure sits in a record's text column.
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
          minBlockSize: 200,
          padding: 'var(--bldr-space-3xl)',
          paddingInlineStart: 'calc(var(--bldr-space-3xl) + var(--bldr-space-5xl))',
        }}
      >
        <Story />
      </div>
    </div>
  );
};

async function open(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole('button', { name: t(locale, 'facts.toggle', { n: 3 }) });
  await userEvent.click(toggle);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveFocus();
}

const meta = {
  title: 'Agent/Records/FactsDisclosure',
  component: FactsDisclosure,
  parameters: { layout: 'centered' },
  args: { locale: 'en', facts: FACTS.en, onReveal: fn() },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof FactsDisclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: one Amber line that counts what to replace. */
export const Closed: Story = {};

/** Open: what the list is, then each sample and the section it sits in. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'en');
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: '“25 JD” in Services' })).toBeVisible();
  },
};

export const OpenDark: Story = {
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'en');
  },
};

export const OpenRightToLeft: Story = {
  args: { locale: 'ar', facts: FACTS.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'ar');
  },
};

export const OpenRightToLeftDark: Story = {
  args: { locale: 'ar', facts: FACTS.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'ar');
  },
};

/** Nothing to replace: nothing at all. */
export const Empty: Story = { args: { facts: [] } };

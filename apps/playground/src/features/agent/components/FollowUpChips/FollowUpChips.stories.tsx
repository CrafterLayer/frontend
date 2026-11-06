import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { FollowUpChips } from './FollowUpChips';

/* ── The thread, as AgentThread draws it under a build's record ───────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The thread's paper, 16px gutter and 12px block padding, in the story's language. */
const inThread: Decorator = (Story, { args, parameters }) => {
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
        inlineSize: width,
        boxSizing: 'border-box',
        paddingBlock: 'var(--bldr-space-xl)',
        paddingInline: 'var(--bldr-space-3xl)',
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

const meta = {
  title: 'Agent/Thread/FollowUpChips',
  component: FollowUpChips,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { locale: 'en', onSend: fn() },
  decorators: [inThread],
} satisfies Meta<typeof FollowUpChips>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The four next steps under a first build, at the panel's 320px: they wrap, never scroll. */
export const NextSteps: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: t('en', 'nextSteps.label') });
    await expect(within(list).getAllByRole('button')).toHaveLength(4);
  },
};

/** A pick sends its whole request once; the row then waits for the request's own turn. */
export const SendsOnce: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'nextSteps.colors') }));
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'nextSteps.reorder') }));
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onSend).toHaveBeenCalledWith(t('en', 'nextSteps.colors.request'));
  },
};

/** The keyboard: each chip is a tab stop; Enter or Space sends. */
export const ByKeyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: t('en', 'nextSteps.colors') }).focus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: t('en', 'nextSteps.style') })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onSend).toHaveBeenCalledWith(t('en', 'nextSteps.style.request'));
  },
};

export const Dark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

/** 420px: the four chips fit on fewer lines. */
export const Wide: Story = {
  parameters: { panel: { width: 420 } },
};

/* ── Arabic, right to left ─────────────────────────────────────────────────── */

/** «بدّل الألوان»، «ستايل مختلف»، «رتّب الأقسام»، «أضف قسمًا»: the row starts at the right. */
export const RightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('list', { name: t('ar', 'nextSteps.label') }),
    ).toBeInTheDocument();
  },
};

export const RightToLeftDark: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { theme: 'dark' } },
};

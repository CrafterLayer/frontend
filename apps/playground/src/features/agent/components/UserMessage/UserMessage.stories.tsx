import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale, UserMessageView } from '../../model/view-types';
import {
  messageLongLink,
  messageMixed,
  messageNotRun,
  messagePlain,
  messageStaleChip,
  messageWithContext,
} from '../../testing/wp-12-records-fixtures';

import { UserMessage } from './UserMessage';

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
 * The inner padding is the thread's 16px gutter (SPEC §2.3).
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

/* ── Plays: what the spec draws ───────────────────────────────────────────── */

function rectOf(element: Element | null | undefined, what: string): DOMRect {
  if (element === null || element === undefined) throw new Error(`no ${what}`);
  return element.getBoundingClientRect();
}

/**
 * The bubble hangs from the inline end (SPEC §3.3, §3.15): flush with the thread's end
 * gutter, its tail corner (block-end, inline-end) the 4px one, and no wider than the cap.
 */
async function expectHungFromTheEnd(canvasElement: HTMLElement, cap: number): Promise<void> {
  const article = canvasElement.querySelector('.ck-agent-message');
  const bubble = rectOf(article?.querySelector('.ck-agent-message__bubble'), 'bubble');
  const edge = rectOf(article, 'message');
  const rtl = article?.closest('[dir]')?.getAttribute('dir') === 'rtl';
  const endGap = rtl ? bubble.left - edge.left : edge.right - bubble.right;
  await expect(Math.abs(endGap)).toBeLessThan(0.5);
  await expect(bubble.width).toBeLessThanOrEqual(edge.width * cap + 0.5);
  const drawn = article?.querySelector('.ck-agent-message__bubble');
  if (drawn === null || drawn === undefined) throw new Error('no bubble');
  const style = getComputedStyle(drawn);
  await expect(style.borderEndEndRadius).toBe('4px');
  await expect(style.borderStartStartRadius).toBe('16px');
}

async function expectNoSidewaysScroll(canvasElement: HTMLElement): Promise<void> {
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

/* ── Stories ──────────────────────────────────────────────────────────────── */

const meta = {
  title: 'Agent/Records/UserMessage',
  component: UserMessage,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: messagePlain('en') },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof UserMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Arabic twin of a story: the same message, in the Arabic panel, right to left. */
function arabic(view: UserMessageView, frame: Frame = {}): Story {
  return {
    args: { locale: 'ar', view },
    globals: { direction: 'rtl' },
    parameters: { panel: { locale: 'ar', ...frame } },
  };
}

/** §3.3: a whole-page request. The default scope is not repeated in the bubble. */
export const Sent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('article', { name: t('en', 'message.aria') })).toBeVisible();
    await expect(canvasElement.querySelector('.ck-agent-message__context')).toBeNull();
    await expectHungFromTheEnd(canvasElement, 0.85);
  },
};

export const SentRightToLeft: Story = {
  ...arabic(messagePlain('ar')),
  play: async ({ canvasElement }) => {
    await expectHungFromTheEnd(canvasElement, 0.85);
  },
};

export const SentDark: Story = { parameters: { panel: { theme: 'dark' } } };
export const SentRightToLeftDark: Story = arabic(messagePlain('ar'), { theme: 'dark' });

/** From 400px the bubble narrows to 80% of the thread (SPEC §4.5). */
export const SentAt420: Story = {
  parameters: { panel: { width: 420 } },
  play: async ({ canvasElement }) => {
    await expectHungFromTheEnd(canvasElement, 0.8);
  },
};

export const SentAt420RightToLeft: Story = {
  ...arabic(messagePlain('ar'), { width: 420 }),
  play: async ({ canvasElement }) => {
    await expectHungFromTheEnd(canvasElement, 0.8);
  },
};

/** §3.6: sent with the hero selected and Services mentioned: the chips are its first line. */
export const WithContext: Story = {
  args: { view: messageWithContext('en') },
  play: async ({ canvasElement }) => {
    const context = canvasElement.querySelector('.ck-agent-message__context');
    await expect(context).not.toBeNull();
    // Context, not controls: nothing in the bubble can be pressed.
    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
  },
};

export const WithContextRightToLeft: Story = arabic(messageWithContext('ar'));
export const WithContextDark: Story = {
  args: { view: messageWithContext('en') },
  parameters: { panel: { theme: 'dark' } },
};
export const WithContextRightToLeftDark: Story = arabic(messageWithContext('ar'), {
  theme: 'dark',
});

/**
 * A leading Latin word does not fool it: most of the letters are Arabic, so the words run
 * right to left even in the English panel, and each line orders itself (SPEC §4.5, §6.6).
 */
export const MixedScripts: Story = {
  args: { view: messageMixed() },
  play: async ({ canvasElement }) => {
    const content = canvasElement.querySelector('.ck-agent-message__content');
    await expect(content).toHaveAttribute('dir', 'rtl');
    await expect(content).toHaveAttribute('lang', 'ar');
  },
};

export const MixedScriptsRightToLeft: Story = arabic(messageMixed());

/** Stopped before any output: dimmed, and captioned "Not run". */
export const NotRun: Story = {
  args: { view: messageNotRun('en') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(t('en', 'message.notRun'))).toBeVisible();
  },
};

export const NotRunRightToLeft: Story = arabic(messageNotRun('ar'));
export const NotRunDark: Story = {
  args: { view: messageNotRun('en') },
  parameters: { panel: { theme: 'dark' } },
};
export const NotRunRightToLeftDark: Story = arabic(messageNotRun('ar'), { theme: 'dark' });

/** Sent with a block that has since left the page: struck through, and said in words. */
export const StaleContext: Story = { args: { view: messageStaleChip('en') } };
export const StaleContextRightToLeft: Story = arabic(messageStaleChip('ar'));

/** A long unbroken link wraps inside the bubble; nothing scrolls sideways (WCAG 1.4.10). */
export const LongLink: Story = {
  args: { view: messageLongLink() },
  play: async ({ canvasElement }) => {
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const LongLinkRightToLeft: Story = {
  ...arabic(messageLongLink()),
  play: async ({ canvasElement }) => {
    await expectNoSidewaysScroll(canvasElement);
  },
};

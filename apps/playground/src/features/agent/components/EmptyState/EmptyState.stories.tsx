import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { EmptyStateView, Locale, SuggestionView } from '../../model/view-types';
import {
  frameEmptyViews,
  frameSelectedTitle,
  frameSuggestions,
} from '../../testing/wp-11-frame-fixtures';
import { SuggestionList } from '../SuggestionList';

import { EmptyState, type EmptyStateProps } from './EmptyState';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * The bottom of an empty thread: the panel's paper, the thread's 16px gutter and 12px
 * block padding, the greeting anchored to the bottom as AgentThread anchors it. The
 * language comes from the story's `locale` arg.
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
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        inlineSize: width,
        minBlockSize: 440,
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

/* ── The greeting with the rows that follow it in the thread ─────────────── */

interface GreetingProps extends EmptyStateProps {
  readonly suggestions: readonly SuggestionView[];
  readonly onChoose: (suggestion: SuggestionView) => void;
}

/** EmptyState, then its rows 16px under it, as the thread's bottom shows them (SPEC §3.1). */
function Greeting({ suggestions, onChoose, ...empty }: GreetingProps) {
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-3xl)' }}>
      <EmptyState {...empty} />
      <SuggestionList locale={empty.locale} suggestions={suggestions} onChoose={onChoose} />
    </div>
  );
}

/** The greeting says the right variant, the face is decoration, and the rows are there. */
async function expectGreeting(
  canvasElement: HTMLElement,
  text: string,
  rows: readonly SuggestionView[],
): Promise<void> {
  const greeting = canvasElement.querySelector('.ck-agent-empty__greeting');
  await expect(greeting).toHaveTextContent(text);
  await expect(canvasElement.querySelector('.ck-agent-empty__face')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  const list = within(canvasElement).getByRole('list');
  await expect(within(list).getAllByRole('button')).toHaveLength(rows.length);
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

function greetingOf(locale: Locale, view: EmptyStateView): string {
  switch (view.kind) {
    case 'greeting':
      return t(locale, 'empty.greeting');
    case 'hasContent':
      return t(locale, 'empty.hasContent', { n: view.sections });
    case 'selection':
      return t(locale, 'empty.selection', { title: view.title });
  }
}

const EN = frameEmptyViews('en');
const AR = frameEmptyViews('ar');
const EN_ROWS = frameSuggestions('en');
const AR_ROWS = frameSuggestions('ar');

const meta = {
  title: 'Agent/Frame/EmptyState',
  component: EmptyState,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: EN.greeting },
  decorators: [inPanel],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An empty page: the character's greeting and the four authored starters (SPEC §3.1). */
export const EmptyPage: Story = {
  render: (args) => <Greeting {...args} suggestions={EN_ROWS.starters} onChoose={fn()} />,
  play: async ({ canvasElement }) => {
    await expectGreeting(canvasElement, greetingOf('en', EN.greeting), EN_ROWS.starters);
  },
};

/** Arabic, Levantine: «احكيلي عن مشروعك…», with the Arabic set's own starters. */
export const EmptyPageArabic: Story = {
  args: { locale: 'ar', view: AR.greeting },
  render: (args) => <Greeting {...args} suggestions={AR_ROWS.starters} onChoose={fn()} />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectGreeting(canvasElement, greetingOf('ar', AR.greeting), AR_ROWS.starters);
  },
};

/** The page already has sections: the count, and rows from the catalog's own prompts. */
export const HasContent: Story = {
  args: { view: EN.hasContent },
  render: (args) => <Greeting {...args} suggestions={EN_ROWS.hasContent} onChoose={fn()} />,
  play: async ({ canvasElement }) => {
    await expectGreeting(canvasElement, greetingOf('en', EN.hasContent), EN_ROWS.hasContent);
  },
};

export const HasContentArabic: Story = {
  args: { locale: 'ar', view: AR.hasContent },
  render: (args) => <Greeting {...args} suggestions={AR_ROWS.hasContent} onChoose={fn()} />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectGreeting(canvasElement, greetingOf('ar', AR.hasContent), AR_ROWS.hasContent);
  },
};

/** A block is selected: named by its title on the page, in `<bdi>`, with its own actions. */
export const Selection: Story = {
  args: { view: EN.selection },
  render: (args) => <Greeting {...args} suggestions={EN_ROWS.selection} onChoose={fn()} />,
  play: async ({ canvasElement }) => {
    await expectGreeting(canvasElement, greetingOf('en', EN.selection), EN_ROWS.selection);
    await expect(canvasElement.querySelector('.ck-agent-empty__greeting bdi')).toHaveTextContent(
      frameSelectedTitle('en'),
    );
  },
};

export const SelectionArabic: Story = {
  args: { locale: 'ar', view: AR.selection },
  render: (args) => <Greeting {...args} suggestions={AR_ROWS.selection} onChoose={fn()} />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectGreeting(canvasElement, greetingOf('ar', AR.selection), AR_ROWS.selection);
  },
};

export const EmptyPageDark: Story = {
  render: (args) => <Greeting {...args} suggestions={EN_ROWS.starters} onChoose={fn()} />,
  parameters: { panel: { theme: 'dark' } },
};

export const EmptyPageArabicDark: Story = {
  args: { locale: 'ar', view: AR.greeting },
  render: (args) => <Greeting {...args} suggestions={AR_ROWS.starters} onChoose={fn()} />,
  globals: { direction: 'rtl' },
  parameters: { panel: { theme: 'dark' } },
};

/** At 420 (SPEC §3.17): the greeting wraps to two lines, each starter fits on one. */
export const EmptyPageAt420: Story = {
  render: (args) => <Greeting {...args} suggestions={EN_ROWS.starters} onChoose={fn()} />,
  parameters: { panel: { width: 420 } },
  play: async ({ canvasElement }) => {
    const greeting = canvasElement.querySelector('.ck-agent-empty__greeting');
    if (greeting === null) throw new Error('no greeting');
    const lineHeight = Number.parseFloat(getComputedStyle(greeting).lineHeight);
    await expect(Math.round(greeting.getBoundingClientRect().height / lineHeight)).toBe(2);
    for (const row of within(canvasElement).getAllByRole('button')) {
      await expect(Math.round(row.getBoundingClientRect().height)).toBe(32);
    }
  },
};

export const EmptyPageArabicAt420: Story = {
  args: { locale: 'ar', view: AR.greeting },
  render: (args) => <Greeting {...args} suggestions={AR_ROWS.starters} onChoose={fn()} />,
  globals: { direction: 'rtl' },
  parameters: { panel: { width: 420 } },
};

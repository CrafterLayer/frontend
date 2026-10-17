import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import type { CreativeMemoryV1 } from '@craftkit/builder';

import { t } from '../../copy';
import type { StoryBibleView } from '../../model/story-bible';
import type { Locale } from '../../model/view-types';
import { STORY_BIBLES } from '../../testing/story-bible-fixtures';

import { StoryBiblePanel } from './StoryBiblePanel';

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The panel's root as AgentPanel draws its dock: theme, language, direction, width. */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 360 } = (parameters['panel'] ?? {}) as Frame;
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
        padding: 'var(--bldr-space-3xl)',
      }}
    >
      <Story />
    </div>
  );
};

function bibleOf(memory: CreativeMemoryV1): StoryBibleView {
  return {
    memory,
    addCharacter: fn(() => true),
    addFact: fn(() => true),
    removeCharacter: fn(),
    removeAsset: fn(),
    removeLocation: fn(),
    removeFact: fn(),
    clear: fn(),
  };
}

async function open(canvasElement: HTMLElement, locale: Locale, n: number): Promise<void> {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole('button', { name: t(locale, 'bible.toggle', { n }) });
  await userEvent.click(toggle);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

const meta = {
  title: 'Agent/Creative/StoryBiblePanel',
  component: StoryBiblePanel,
  parameters: { layout: 'centered' },
  args: { locale: 'en', bible: bibleOf(STORY_BIBLES.en) },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inPanel],
} satisfies Meta<typeof StoryBiblePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: one quiet line that counts what the bible holds. */
export const Closed: Story = {};

/** Open: cast with colour swatches, approved assets, places and canon, then the two forms. */
export const Open: Story = {
  play: async ({ canvasElement, args }) => {
    await open(canvasElement, 'en', 7);
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Characters' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Omar' }));
    await expect(args.bible.removeCharacter).toHaveBeenCalledWith('omar');
  },
};

export const OpenDark: Story = {
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'en', 7);
  },
};

export const OpenRightToLeft: Story = {
  args: { locale: 'ar', bible: bibleOf(STORY_BIBLES.ar) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'ar', 5);
    await expect(within(canvasElement).getByRole('heading', { name: 'الشخصيات' })).toBeVisible();
  },
};

/** A new project: the bible explains how it fills, and offers the forms. */
export const Empty: Story = {
  args: { bible: bibleOf(STORY_BIBLES.empty), defaultOpen: true },
};

/** A narrow phone dock: fields wrap, nothing scrolls sideways. */
export const Narrow: Story = {
  args: { defaultOpen: true },
  parameters: { panel: { width: 280 } },
};

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import type { MemoryNote } from '../../model/project-memory';
import type { Locale } from '../../model/view-types';
import { SAMPLE_NOTES, SAMPLE_NOTES_AR, seededStorage } from '../../testing/knowledge-fixtures';

import { MemoryTab } from './MemoryTab';

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * The popover's tab panel, inside a panel root: theme, the story's language and direction,
 * and the `agent` inline-size container, on the popover's Sheet.
 */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 384 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        background: 'var(--bldr-surface)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
        padding: 'var(--bldr-space-md)',
      }}
    >
      <Story />
    </div>
  );
};

interface LiveMemoryProps {
  readonly locale: Locale;
  /** What the browser's storage holds when the tab mounts. */
  readonly notes: readonly MemoryNote[];
}

/** The tab over the real memory store (`useAgentKnowledge`), seeded from storage. */
function LiveMemory({ locale, notes }: LiveMemoryProps) {
  const [storage] = useState(() => seededStorage([], notes));
  const { view } = useAgentKnowledge({ storage });
  return <MemoryTab memory={view.memory} labels={knowledgeLabels(locale)} />;
}

/** Twenty notes: the memory is full. */
const FULL: readonly MemoryNote[] = Array.from({ length: 20 }, (_, index) => ({
  id: `note-${String(index + 1)}`,
  kind: index % 3 === 0 ? 'site-fact' : 'preference',
  text: `Standing note number ${String(index + 1)}.`,
}));

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');

const meta = {
  title: 'Agent/Knowledge/MemoryTab',
  component: LiveMemory,
  parameters: { layout: 'centered' },
  args: { locale: 'en', notes: SAMPLE_NOTES },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inPanel],
} satisfies Meta<typeof LiveMemory>;

export default meta;
type Story = StoryObj<typeof meta>;

const ARABIC = {
  args: { locale: 'ar', notes: SAMPLE_NOTES_AR },
  globals: { direction: 'rtl' },
} as const;

/** Three notes, each with its kind and Forget; the field to add one above them. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
    await expect(canvas.getByText('3 of 20')).toBeVisible();
  },
};

/** Nothing remembered yet. */
export const Empty: Story = {
  args: { notes: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(EN.memory.empty)).toBeVisible();
  },
};

/** A fact about the site, remembered. */
export const Remembered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: /^Kind/u }), 'site-fact');
    await userEvent.type(
      canvas.getByRole('textbox', { name: EN.memory.field }),
      'We open at eight.',
    );
    await userEvent.click(canvas.getByRole('button', { name: EN.memory.add }));
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
    await expect(canvas.getByText('We open at eight.')).toBeVisible();
  },
};

/** Remember with nothing written: the refusal line says why. */
export const Refused: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EN.memory.add }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(EN.memory.refusals.empty);
  },
};

/** Twenty notes: a twenty-first is refused until one is forgotten. */
export const Full: Story = {
  args: { notes: FULL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: EN.memory.field }), 'One more.');
    await userEvent.click(canvas.getByRole('button', { name: EN.memory.add }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(EN.memory.refusals.full);
  },
};

/** "Forget everything" asks once more, in the Alarm colour. */
export const ConfirmingClear: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clear = canvas.getByRole('button', { name: EN.memory.clear });
    await userEvent.click(clear);
    await expect(clear).toHaveAttribute('data-confirming');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
  },
};

export const Dark: Story = {
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    const fact = within(canvasElement).getAllByRole('listitem')[1];
    await expect(fact).toHaveTextContent(EN.memory.kinds['site-fact']);
    await expect(fact).toBeVisible();
  },
};

export const RightToLeft: Story = {
  ...ARABIC,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: AR.memory.field })).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'انسَ «المقهى مغلق يوم الجمعة.»' }),
    ).toBeVisible();
  },
};

export const RefusedRightToLeft: Story = {
  ...ARABIC,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('textbox', { name: AR.memory.field }),
      'المقهى مغلق يوم الجمعة.',
    );
    await userEvent.click(canvas.getByRole('button', { name: AR.memory.add }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(AR.memory.refusals.duplicate);
  },
};

export const DarkRightToLeft: Story = {
  ...ARABIC,
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('2 من 20')).toBeVisible();
  },
};

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
import type { AgentCheckpoint, CheckpointRestore } from '../../model/checkpoints';
import type { Locale } from '../../model/view-types';
import {
  createFakeCheckpoints,
  SAMPLE_CHECKPOINTS,
  SAMPLE_CHECKPOINTS_AR,
} from '../../testing/knowledge-fixtures';

import { CheckpointsTab } from './CheckpointsTab';

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

interface LiveCheckpointsProps {
  readonly locale: Locale;
  /** The points the host keeps when the tab mounts, newest first. */
  readonly points: readonly AgentCheckpoint[];
  /** What every Restore answers. */
  readonly restore?: CheckpointRestore;
  /** Whether Save succeeds. */
  readonly saves?: boolean;
  /** A list that never arrives. */
  readonly pending?: boolean;
}

/** The tab over the real hook and an in-memory checkpoint port. */
function LiveCheckpoints({ locale, points, restore, saves, pending }: LiveCheckpointsProps) {
  const [port] = useState(() => createFakeCheckpoints(points, { restore, saves, pending }));
  const { view } = useAgentKnowledge({ storage: null, checkpoints: port });
  if (view.checkpoints === undefined) return null;
  return (
    <CheckpointsTab
      checkpoints={view.checkpoints}
      labels={knowledgeLabels(locale)}
      locale={locale}
    />
  );
}

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');

const meta = {
  title: 'Agent/Knowledge/CheckpointsTab',
  component: LiveCheckpoints,
  parameters: { layout: 'centered' },
  args: { locale: 'en', points: SAMPLE_CHECKPOINTS },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
    restore: { control: 'select', options: ['restored', 'unchanged', 'missing', 'failed'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof LiveCheckpoints>;

export default meta;
type Story = StoryObj<typeof meta>;

const ARABIC = {
  args: { locale: 'ar', points: SAMPLE_CHECKPOINTS_AR },
  globals: { direction: 'rtl' },
} as const;

/** Restores the point named `label` and expects `outcome` in the status line. */
function restoring(
  label: string,
  outcome: CheckpointRestore,
  locale: Locale = 'en',
): NonNullable<Story['play']> {
  const words = knowledgeLabels(locale).checkpoints;
  return async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: words.restore(label) }));
    await expect(await canvas.findByText(words.outcomes[outcome])).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent(words.outcomes[outcome]);
  };
}

/** Three points, newest first: two before a request, one saved (Accent mark at its start). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findAllByRole('listitem')).toHaveLength(3);
    await expect(
      canvas.getByRole('button', { name: EN.checkpoints.restore('Before the new menu') }),
    ).toBeVisible();
  },
};

/** The list is still being read. */
export const Loading: Story = {
  args: { pending: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(EN.checkpoints.loading)).toBeVisible();
  },
};

/** No checkpoint kept yet. */
export const Empty: Story = {
  args: { points: [] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(EN.checkpoints.empty)).toBeVisible();
  },
};

/** Restored: the status line says so, and that Undo takes it back. */
export const Restored: Story = { play: restoring('Before the new menu', 'restored') };

/** The point is gone from the host's keeping. */
export const RestoreMissing: Story = {
  args: { restore: 'missing' },
  play: restoring('Build a landing page for a café', 'missing'),
};

/** The restore failed. */
export const RestoreFailed: Story = {
  args: { restore: 'failed' },
  play: restoring('Make the hero darker and add a booking button', 'failed'),
};

/** Saved under a typed name: a new point at the top. */
export const Saved: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('listitem');
    await userEvent.type(
      canvas.getByRole('textbox', { name: EN.checkpoints.nameField }),
      'Before the footer',
    );
    await userEvent.click(canvas.getByRole('button', { name: EN.checkpoints.save }));
    await expect(await canvas.findByText(EN.checkpoints.saved)).toBeVisible();
    await expect(
      await canvas.findByRole('button', { name: EN.checkpoints.restore('Before the footer') }),
    ).toBeVisible();
  },
};

/** The save failed: the status line says so. */
export const SaveFailed: Story = {
  args: { saves: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('listitem');
    await userEvent.click(canvas.getByRole('button', { name: EN.checkpoints.save }));
    await expect(await canvas.findByText(EN.checkpoints.saveFailed)).toBeVisible();
  },
};

export const Dark: Story = {
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findAllByRole('listitem')).toHaveLength(3);
  },
};

export const RestoredDark: Story = {
  parameters: { panel: { theme: 'dark' } },
  play: restoring('Before the new menu', 'restored'),
};

export const RightToLeft: Story = {
  ...ARABIC,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findAllByRole('listitem')).toHaveLength(2);
    await expect(canvas.getByRole('textbox', { name: AR.checkpoints.nameField })).toBeVisible();
  },
};

export const RestoreFailedRightToLeft: Story = {
  ...ARABIC,
  args: { ...ARABIC.args, restore: 'failed' },
  play: restoring('قبل القائمة الجديدة', 'failed', 'ar'),
};

export const DarkRightToLeft: Story = {
  ...ARABIC,
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findAllByRole('listitem')).toHaveLength(2);
  },
};

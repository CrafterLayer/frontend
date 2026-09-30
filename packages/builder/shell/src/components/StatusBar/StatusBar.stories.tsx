import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { StatusBar, type RecentChange, type StatusBarProps, type StatusBarTool } from './StatusBar';

const STORY_ICON_PROPS = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
  'aria-hidden': true,
} as const;

const TOOLS = [
  {
    id: 'comments',
    label: 'Open comments',
    icon: (
      <svg {...STORY_ICON_PROPS}>
        <path d="M2.25 3.25h11.5v8H7l-3.25 2v-2h-1.5z" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'Open history',
    icon: (
      <svg {...STORY_ICON_PROPS}>
        <path d="M3.25 5H1.5V3.25M2 4.5A6 6 0 1 1 2.5 11" />
        <path d="M8 4.5V8l2.25 1.5" />
      </svg>
    ),
  },
] as const satisfies readonly StatusBarTool[];

const DEFAULT_CHANGES = [
  { id: 'change-3', door: 'canvas', label: 'hero spacing' },
  { id: 'change-2', door: 'code', label: 'footer links' },
] as const satisfies readonly RecentChange[];

const ALL_DOORS = [
  { id: 'change-6', door: 'assistant', label: 'heading + cta' },
  { id: 'change-5', door: 'code', label: 'pricing copy' },
  { id: 'change-4', door: 'canvas', label: 'testimonial order' },
] as const satisfies readonly RecentChange[];

const BASE_ARGS = {
  changes: DEFAULT_CHANGES,
  deviceLabel: 'Desktop · 1440 px',
} satisfies StatusBarProps;

const meta = {
  title: 'Builder/Shell/StatusBar',
  component: StatusBar,
} satisfies Meta<typeof StatusBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: BASE_ARGS,
};

export const InteractiveToolsAndChanges: Story = {
  args: {
    ...BASE_ARGS,
    tools: TOOLS,
    onToolSelect: fn(),
    onChangeSelect: fn(),
  },
};

export const ReadOnlyProvenance: Story = {
  args: BASE_ARGS,
  render: (args) => (
    <>
      <button type="button">Before status</button>
      <StatusBar {...args} />
      <button type="button">After status</button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('region', { name: 'Editor status' });
    const changes = within(status).getByRole('list', { name: 'Recent changes' });

    await expect(within(changes).getByText('Canvas: hero spacing')).toBeVisible();
    // Mutation that kills this Chromium gate: render the no-handler branch as
    // a button. Both the zero-button assertion and the real Tab landing fail.
    await expect(within(changes).queryByRole('button')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Before status' }));
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After status' })).toHaveFocus();

    const staticChip = within(changes)
      .getByText('Canvas: hero spacing')
      .closest<HTMLElement>('.bldr-statusbar__change');
    if (staticChip === null) {
      throw new Error('read-only provenance must keep its status-chip presentation');
    }
    // Mutation that kills this line: put `cursor: pointer` back on the base
    // chip instead of scoping it to the interactive modifier.
    await expect(getComputedStyle(staticChip).cursor).not.toBe('pointer');

    // Mutation that kills this line: restore the unconditional group role and
    // name on the empty layout cell.
    await expect(
      within(status).queryByRole('group', { name: 'Status bar tools' }),
    ).not.toBeInTheDocument();
  },
};

export const AllThreeDoors: Story = {
  args: {
    ...BASE_ARGS,
    changes: ALL_DOORS,
  },
};

export const Saving: Story = {
  args: {
    ...BASE_ARGS,
    saveState: 'saving',
  },
};

export const SaveError: Story = {
  args: {
    ...BASE_ARGS,
    saveState: 'error',
  },
};

export const NoChanges: Story = {
  args: {
    ...BASE_ARGS,
    changes: [],
  },
};

export const RightToLeft: Story = {
  args: {
    ...BASE_ARGS,
    changes: ALL_DOORS,
    deviceLabel: 'Desktop · 1440 px',
  },
  render: (args) => (
    <div dir="rtl">
      <StatusBar {...args} />
    </div>
  ),
  globals: { direction: 'rtl' },
};

/** A host's activity line (the agent's status pill) at inline start, after the tools. */
export const WithAgentLine: Story = {
  args: {
    ...BASE_ARGS,
    tools: TOOLS,
    onToolSelect: fn(),
    agent: (
      <button type="button" style={{ font: 'inherit' }}>
        Abu Ghadab is building the page, 3 of 8
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole('region', { name: 'Editor status' });
    await expect(
      within(bar).getByRole('button', { name: 'Abu Ghadab is building the page, 3 of 8' }),
    ).toBeVisible();
  },
};

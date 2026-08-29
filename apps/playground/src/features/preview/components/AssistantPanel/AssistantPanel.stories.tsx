import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { createPlaygroundKernel } from '../../create-playground-kernel';
import { AssistantPanel } from './AssistantPanel';

const meta = {
  title: 'Playground/AssistantPanel',
  component: AssistantPanel,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AssistantPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const compactColumnKernel = createPlaygroundKernel({ fixture: 'empty' });

/**
 * Browser truth for the rail-sized assistant: the document context owns the
 * compact width, the conversation alone scrolls, and the composer remains at
 * the bottom while the thread moves beneath it.
 */
export const CompactColumn: Story = {
  args: { kernel: compactColumnKernel },
  render: (args) => (
    <div
      data-testid="assistant-column"
      style={{
        blockSize: 'calc(var(--bldr-control-lg) * 9)',
        inlineSize: 'var(--bldr-panel-width)',
        overflow: 'hidden',
      }}
    >
      <AssistantPanel {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const requests = [
      'add a hero',
      'add a hero',
      'add a hero',
      'add a hero',
      'add a hero',
      'add a hero',
    ];
    const composerInput = canvas.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });

    for (const request of requests) {
      const plansBefore = canvas.queryAllByRole('button', { name: 'Apply' }).length;
      await userEvent.clear(composerInput);
      await userEvent.type(composerInput, request);
      await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
      await waitFor(async () => {
        await expect(canvas.getAllByRole('button', { name: 'Apply' })).toHaveLength(
          plansBefore + 1,
        );
      });
    }

    const column = canvas.getByTestId('assistant-column');
    const panel = canvas.getByRole('region', { name: 'Assistant' });
    const thread = canvas.getByRole('log', { name: 'Conversation' });
    const composer = panel.querySelector<HTMLElement>('form');
    if (composer === null) {
      throw new Error('The assistant must render its composer form.');
    }

    const columnBox = column.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const threadBox = thread.getBoundingClientRect();
    const composerBox = composer.getBoundingClientRect();
    const configuredWidth = Number.parseFloat(
      getComputedStyle(column).getPropertyValue('--bldr-panel-width'),
    );

    await expect(Number.isFinite(configuredWidth)).toBe(true);
    await expect(Math.round(configuredWidth)).toBe(288);
    await expect(Math.round(columnBox.width)).toBe(Math.round(configuredWidth));
    await expect(column.scrollWidth).toBeLessThanOrEqual(column.clientWidth + 1);
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
    await expect(panel.scrollHeight).toBeLessThanOrEqual(panel.clientHeight + 1);
    await expect(getComputedStyle(thread).overflowY).toBe('auto');
    await expect(thread.scrollHeight).toBeGreaterThan(thread.clientHeight);
    await expect(threadBox.bottom).toBeLessThanOrEqual(composerBox.top + 1);
    await expect(Math.abs(composerBox.bottom - panelBox.bottom)).toBeLessThanOrEqual(1);

    const composerBottomBeforeScroll = composerBox.bottom;
    thread.scrollTop = thread.scrollHeight;
    await expect(thread.scrollTop).toBeGreaterThan(0);
    await expect(Math.round(composer.getBoundingClientRect().bottom)).toBe(
      Math.round(composerBottomBeforeScroll),
    );
  },
};

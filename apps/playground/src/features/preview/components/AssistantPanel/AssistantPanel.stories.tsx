import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AiProviderError,
  createAiSkillRegistry,
  createLocalAiPlanProvider,
  type AiPlanProvider,
} from '@craftkit/builder';

import '../../../../app/App.css';
import { createPlaygroundKernel } from '../../create-playground-kernel';
import { AssistantPanel } from './AssistantPanel';

const defaultKernel = createPlaygroundKernel({ fixture: 'empty' });

const meta = {
  title: 'Playground/AssistantPanel',
  component: AssistantPanel,
  parameters: { layout: 'fullscreen' },
  args: { kernel: defaultKernel },
  argTypes: {
    kernel: { control: false },
    planProvider: { control: false },
    skillRegistry: { control: false },
    selectedSkillIds: { control: false },
    agentPolicy: { control: false },
    onAgentEvent: { control: false },
  },
} satisfies Meta<typeof AssistantPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

async function submitRequest(canvasElement: HTMLElement, request: string): Promise<void> {
  const canvas = within(canvasElement);
  const composer = canvas.getByRole<HTMLTextAreaElement>('textbox', {
    name: 'Ask the assistant',
  });
  await userEvent.clear(composer);
  await userEvent.type(composer, request);
  await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
}

function createRetryThenSucceedProvider(): AiPlanProvider {
  const fallback = createLocalAiPlanProvider();
  let attempts = 0;
  return {
    propose(request, context, options) {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(
          new AiProviderError('The assistant is temporarily busy.', {
            code: 'http-status',
            retryable: true,
            status: 503,
          }),
        );
      }
      return fallback.propose(request, context, options);
    },
  };
}

const nonRetryableRefusalProvider: AiPlanProvider = {
  propose: () =>
    Promise.reject(
      new AiProviderError('This request is outside the available Builder commands.', {
        code: 'refusal',
        retryable: false,
      }),
    ),
};

const cancellableProvider: AiPlanProvider = {
  propose: (_request, _context, options) =>
    new Promise((_resolve, reject) => {
      options?.signal?.addEventListener(
        'abort',
        () => {
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    }),
};

function createLateProviderIgnoringAbort(): AiPlanProvider {
  const fallback = createLocalAiPlanProvider();
  return {
    async propose(request, context) {
      const plan = await fallback.propose(request, context);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 200);
      });
      return plan;
    },
  };
}

const hostSkillRegistry = createAiSkillRegistry([
  {
    schemaVersion: 1,
    id: 'host.launch-copy',
    name: 'Launch copy',
    description: 'Apply the host-reviewed launch-page voice.',
    version: '2.1.0',
    instructions: 'Use one direct promise and one concrete action.',
    activation: { mode: 'explicit' },
    restrictToCommands: ['insertNode'],
  },
]);

export const Default: Story = {};

export const HostSkillActivation: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    skillRegistry: hostSkillRegistry,
    selectedSkillIds: ['host.launch-copy'],
    onAgentEvent: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'add a hero');

    await waitFor(async () => {
      await expect(canvas.getByText(/host\.launch-copy · v2\.1\.0 · [a-f0-9]{8}/)).toBeVisible();
    });
    await expect(args.onAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'skills.resolved',
        activations: [expect.objectContaining({ id: 'host.launch-copy', version: '2.1.0' })],
      }),
    );
    await expect(canvas.getByRole('button', { name: 'Apply' })).toBeVisible();
  },
};

export const RetryableProviderFailure: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    planProvider: createRetryThenSucceedProvider(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'add a hero');

    await expect(await canvas.findByText('http-status')).toBeVisible();
    await expect(canvas.getByText(/provider · HTTP 503/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Apply' })).toBeVisible();
    });
  },
};

export const NonRetryableRefusal: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    planProvider: nonRetryableRefusalProvider,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'publish the site directly');

    await expect(await canvas.findByText('refusal')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  },
};

export const ContextBudgetFailure: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    agentPolicy: { maxContextTokens: 1 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'add a hero');

    await expect(await canvas.findByText('context-budget')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  },
};

export const StopCancelsTheRun: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    planProvider: cancellableProvider,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'add a hero');
    await userEvent.click(await canvas.findByRole('button', { name: 'Stop' }));

    await expect(await canvas.findByText('Stopped.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  },
};

export const NewChatSupersedesLateRun: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    planProvider: createLateProviderIgnoringAbort(),
    onAgentEvent: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'add a hero');
    await userEvent.click(canvas.getByRole('button', { name: 'New chat' }));

    await expect(
      await canvas.findByText('Ask for a section and I will propose the exact changes.'),
    ).toBeVisible();
    await waitFor(async () => {
      await expect(args.onAgentEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'run.cancelled' }),
      );
    });
    await expect(canvas.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  },
};

export const AutoAppliesValidatedProposal: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    onAgentEvent: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Auto' }));
    await submitRequest(canvasElement, 'add a hero');

    await expect(await canvas.findByText(/Applied as one change/)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    await expect(args.onAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'plan.applying' }),
    );
    await expect(args.onAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'run.completed', status: 'applied' }),
    );
  },
};

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

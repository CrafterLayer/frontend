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
    locale: { control: 'inline-radio', options: ['ar', 'en'] },
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

/**
 * The character in the header follows the run — reading while the provider
 * works, then the proposal — and the panel's one status line says the same
 * thing in words. English so the assertion reads the same as the card.
 */
export const LiveFace: Story = {
  args: { kernel: createPlaygroundKernel({ fixture: 'empty' }), locale: 'en' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The face is decoration inside an aria-hidden seat: reached by class, not role.
    const face = canvasElement.querySelector<HTMLElement>('.pg-chat__brand-mark .pg-face');
    if (face === null) {
      throw new Error('The header must seat the character face.');
    }
    const voice = canvas.getByRole('status');
    await expect(voice).toHaveTextContent('Say what you want. Skip the preamble.');
    await expect(face).toHaveAttribute('data-mood', 'idle');

    await submitRequest(canvasElement, 'add a hero');

    await waitFor(
      async () => {
        await expect(voice).toHaveTextContent(/That's the plan|Applied as one change/);
      },
      { timeout: 3000 },
    );
    await expect(face).toHaveAttribute('data-mood', 'done');
    await expect(canvas.getByRole('button', { name: 'Apply' })).toBeVisible();
    await expect(canvas.getAllByRole('status')).toHaveLength(1);
    // One name, in the locale's language.
    const heading = canvas.getByRole('heading', { level: 2 });
    await expect(heading).toHaveTextContent('Abu Ghadab');
    await expect(heading).not.toHaveTextContent('أبو غضب');
  },
};

/** The English persona: one Latin name, one status line in English. */
export const EnglishName: Story = {
  args: { kernel: createPlaygroundKernel({ fixture: 'empty' }), locale: 'en' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole('heading', { level: 2 });
    await expect(heading).toHaveTextContent('Abu Ghadab');
    await expect(heading).not.toHaveTextContent('أبو غضب');
    await expect(heading.querySelector('[lang="ar"]')).toBeNull();
    await expect(canvas.getAllByRole('status')).toHaveLength(1);
  },
};

/** A provider that never answers: the rows stay in flight for the camera. */
const neverAnsweringProvider: AiPlanProvider = {
  propose: () =>
    new Promise(() => {
      /* never settles */
    }),
};

export const InFlightProgress: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    planProvider: neverAnsweringProvider,
    locale: 'en',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'add a hero');
    const card = await canvas.findByRole('region', { name: 'Working on the page' });
    await expect(within(card).getByText('Plan')).toBeVisible();
    await expect(within(card).getByText('Structure')).toBeVisible();
    await expect(within(card).queryByText('Apply')).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Cancel generation' })).toBeNull();
    // The card is silent; the panel's voice is the one live region.
    await expect(canvas.getAllByRole('status')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'Stop' })).toBeVisible();
  },
};

/** The dark chrome: a refusal, then the retried proposal, on raised surfaces. */
export const DarkChrome: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    planProvider: createRetryThenSucceedProvider(),
    locale: 'en',
  },
  decorators: [
    (Story) => (
      <div data-bldr-theme="dark" className="pg-app" style={{ minBlockSize: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'add a hero');
    const retry = await canvas.findByRole('button', { name: 'Retry' }, { timeout: 3000 });
    await expect(
      canvasElement.querySelector('.pg-chat__card[data-state="refused"]'),
    ).not.toBeNull();
    await userEvent.click(retry);
    await canvas.findByRole('button', { name: 'Apply' }, { timeout: 3000 });
    await expect(
      canvasElement.querySelector('.pg-chat__card[data-state="pending"]'),
    ).not.toBeNull();
  },
};

/** Right-to-left: the bubble sits at the inline end and nothing overflows. */
export const RightToLeft: Story = {
  args: { kernel: createPlaygroundKernel({ fixture: 'empty' }) },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '288px', minBlockSize: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, 'أضف قسم البطل');
    await canvas.findByRole('button', { name: 'Apply' }, { timeout: 3000 });
    const panel = canvasElement.querySelector<HTMLElement>('.pg-chat');
    const bubble = canvasElement.querySelector<HTMLElement>('.pg-chat__you');
    if (panel === null || bubble === null) throw new Error('The thread must render.');
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    // In RTL the inline end is the LEFT edge.
    const panelBox = panel.getBoundingClientRect();
    const bubbleBox = bubble.getBoundingClientRect();
    await expect(bubbleBox.left - panelBox.left).toBeLessThan(panelBox.right - bubbleBox.right);
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

/* ── The split build ──────────────────────────────────────────────────────
   A page-sized request stops being one long call and becomes a skeleton plus
   one run per section. These three stories are the states a person actually
   sees: the one question, the list advancing, and the report. */

const BUILD_STORY_REQUEST = 'build me a landing page for my ceramics studio';
const BUILD_STORY_DIRECTION =
  'A calm studio page for ceramicists. Palette bg-white text-slate-900 border-slate-200. Faces Inter and Inter. Signature a hairline rule.';
const BUILD_STORY_SECTIONS = ['Hero', 'Proof', 'Benefits', 'Pricing', 'Contact'] as const;

/**
 * A scripted build against the playground's own customCode vocabulary: one
 * scaffold plan naming every section, then one fill per region, found by the
 * selection the orchestrator scoped that run to. Never a network.
 */
function createBuildStoryProvider(
  kernel: ReturnType<typeof createPlaygroundKernel>,
  options: { readonly hold?: readonly string[]; readonly refuse?: readonly string[] } = {},
): AiPlanProvider {
  let calls = 0;
  return {
    propose(_request, context) {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({
          rationale: BUILD_STORY_DIRECTION,
          commands: BUILD_STORY_SECTIONS.map((label) => ({
            command: 'insertNode',
            args: {
              type: 'customCode',
              parentId: kernel.getDocument().rootId,
              props: {
                label,
                tree: {
                  kind: 'root',
                  children: [
                    {
                      kind: 'element',
                      tag: 'section',
                      className: 'py-12',
                      children: [{ kind: 'element', tag: 'h2', text: label, children: [] }],
                    },
                  ],
                },
              },
            },
          })),
        });
      }
      const id = context.selection.ids[0] ?? '';
      const labelValue = kernel.getDocument().nodes[id]?.props['label'];
      const label = typeof labelValue === 'string' ? labelValue : '';
      if (options.refuse?.includes(label) === true) {
        return Promise.reject(
          new AiProviderError(`The model would not write "${label}".`, {
            code: 'refusal',
            retryable: false,
          }),
        );
      }
      if (options.hold?.includes(label) === true) {
        return new Promise<never>(() => {
          /* never settles: the row stays open for the camera */
        });
      }
      return Promise.resolve({
        rationale: `Fill ${label}.`,
        commands: [
          {
            command: 'setProp',
            args: {
              id,
              key: 'tree',
              value: {
                kind: 'root',
                children: [
                  {
                    kind: 'element',
                    tag: 'section',
                    className: 'py-12',
                    children: [
                      { kind: 'element', tag: 'h2', text: label, children: [] },
                      {
                        kind: 'element',
                        tag: 'p',
                        text: `Body copy for ${label}.`,
                        children: [],
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      });
    },
  };
}

/** The ONE question a build asks: the direction, the list, and go. */
export const BuildAwaitingApproval: Story = {
  args: (() => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    return { kernel, planProvider: createBuildStoryProvider(kernel), locale: 'en' };
  })(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitRequest(canvasElement, BUILD_STORY_REQUEST);

    const approval = await canvas.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 20_000 },
    );
    await expect(within(approval).getByText(BUILD_STORY_DIRECTION)).toBeVisible();
    await expect(within(approval).getByText('5 sections')).toBeVisible();
    await expect(within(approval).getByRole('button', { name: 'Build' })).toBeVisible();
    await expect(within(approval).getByRole('button', { name: 'Stop build' })).toBeVisible();
    // The promise the card makes, said out loud.
    await expect(within(approval).getByText(/The skeleton is already on the page/)).toBeVisible();
  },
};

/** Mid-build: two sections written, the third open with its own clock. */
export const BuildInFlight: Story = {
  args: (() => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    return {
      kernel,
      planProvider: createBuildStoryProvider(kernel, { hold: ['Benefits'] }),
      locale: 'en',
    };
  })(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Auto' }));
    await submitRequest(canvasElement, BUILD_STORY_REQUEST);

    const list = await canvas.findByRole('list', { name: 'Sections' }, { timeout: 20_000 });
    await waitFor(
      async () => {
        await expect(canvasElement.querySelector('.pg-chat__tasks-count')).toHaveTextContent('2/5');
      },
      { timeout: 20_000 },
    );
    const rows = [...list.querySelectorAll<HTMLElement>(':scope > li.pg-chat__task')];
    await expect(rows).toHaveLength(5);
    await expect(rows[0]).toHaveAttribute('data-status', 'applied');
    await expect(rows[2]).toHaveAttribute('data-status', 'running');
    await expect(rows[4]).toHaveAttribute('data-status', 'waiting');
    // The open row carries the very rows a single call would have shown.
    await expect(canvas.getByRole('region', { name: 'Working on Benefits' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Stop' })).toBeVisible();
  },
};

/** The report: what landed, what did not, and the reason each gave. */
export const BuildReportWithSkips: Story = {
  args: (() => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    return {
      kernel,
      planProvider: createBuildStoryProvider(kernel, { refuse: ['Proof'] }),
      locale: 'en',
    };
  })(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Auto' }));
    await submitRequest(canvasElement, BUILD_STORY_REQUEST);

    await waitFor(
      async () => {
        await expect(canvas.getByText(/4\/5 built in/)).toBeVisible();
      },
      { timeout: 30_000 },
    );
    await expect(canvas.getByText(/The model would not write "Proof"\./)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Retry skipped' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Undo Pricing' })).toBeVisible();
    await expect(canvasElement.querySelector('.pg-chat__card[data-state="built"]')).not.toBeNull();
  },
};

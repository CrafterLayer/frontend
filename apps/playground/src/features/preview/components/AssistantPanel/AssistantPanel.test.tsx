import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createScriptedAiPlanProvider } from '@craftkit/builder/testing';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import {
  AiProviderError,
  createBuilder,
  createAiSkillRegistry,
  defineBlockSchema,
  type AiAgentEvent,
  type AiPlan,
  type AiPlanProvider,
  type AiPlanStep,
  type BuilderKernel,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import { z } from 'zod';

import { AssistantPanel, type AssistantPanelProps } from './AssistantPanel';
import { describeStep, shortSkillFingerprint } from './AssistantPanel.utils';

const page = defineBlockSchema({
  type: 'page',
  description: 'The page root.',
  props: z.object({}),
  slots: { default: { allow: ['hero', 'pricing'], max: 2 } },
  examples: [],
});
const hero = defineBlockSchema({
  type: 'hero',
  description: 'An opening section with a heading.',
  props: z.object({ heading: z.string().min(1).default('Your headline') }),
  examples: [{ prompt: 'add a hero', node: { type: 'hero', props: { heading: 'Hello' } } }],
});
const pricing = defineBlockSchema({
  type: 'pricing',
  description: 'A pricing section.',
  props: z.object({ heading: z.string().min(1).default('Pricing') }),
  examples: [{ prompt: 'add a pricing section', node: { type: 'pricing', props: {} } }],
});
const Null = () => null;
const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'assistant-panel.vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: Null },
      { schema: hero, render: Null },
      { schema: pricing, render: Null },
    ],
  },
};

function createAssistantKernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          type: 'page',
          props: {},
          slots: { default: ['selected-hero'] },
        },
        'selected-hero': {
          id: 'selected-hero',
          type: 'hero',
          props: { heading: 'Existing section' },
        },
      },
    },
    extensions: [vocabulary],
    ports: { clock: fixedClock(0), ids: seededIds('assistant-panel') },
  });
}

function renderPanel(props: Partial<AssistantPanelProps> = {}) {
  const kernel = props.kernel ?? createAssistantKernel();
  const user = userEvent.setup();
  const { unmount } = render(<AssistantPanel kernel={kernel} {...props} />);
  return { kernel, user, unmount };
}

async function requestPlan(
  user: ReturnType<typeof userEvent.setup>,
  request: string,
): Promise<void> {
  const existingPlans = screen.queryAllByRole('button', { name: 'Apply' }).length;
  const composer = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' });
  await user.clear(composer);
  await user.type(composer, request);
  await user.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => {
    expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(existingPlans + 1);
  });
}

describe('AssistantPanel', () => {
  it('keeps every command fallback readable even when optional labels are absent', () => {
    expect(shortSkillFingerprint('skill-v1-sha256-abcdef0123456789')).toBe('abcdef01');
    expect(shortSkillFingerprint('custom-fingerprint')).toBe('custom-f');
    const cases: readonly (readonly [AiPlanStep, string])[] = [
      [{ command: 'insertNode', args: {} }, 'Add a block'],
      [{ command: 'setProp', args: {} }, 'Change a property of a block'],
      [{ command: 'removeNode', args: {} }, 'Remove a block'],
      [{ command: 'moveNode', args: {} }, 'Move a block'],
      [{ command: 'duplicateNode', args: {} }, 'Duplicate a block'],
      [{ command: 'wrapNode', args: {} }, 'Wrap a block in a container'],
      [{ command: 'groupNodes', args: {} }, 'Group blocks into a group'],
      [{ command: 'setBinding', args: {} }, 'Bind a property of a block'],
      [{ command: 'setResponsive', args: {} }, 'Adjust a property per breakpoint on a block'],
      [{ command: 'hostCommand', args: {} }, 'hostCommand'],
    ];
    for (const [step, expected] of cases) {
      expect(describeStep(step)).toBe(expected);
    }
  });

  it('exposes the assistant, thread, composer, and starter actions with native accessible names', () => {
    renderPanel();

    expect(screen.getByRole('region', { name: 'Assistant' })).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'Conversation' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask the assistant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add a hero' })).toBeInTheDocument();
  });

  it('runs through the observable agent, activates host Skills, and exposes their immutable pins', async () => {
    const events: AiAgentEvent[] = [];
    const skillRegistry = createAiSkillRegistry([
      {
        schemaVersion: 1,
        id: 'host.hero-copy',
        name: 'Host hero copy',
        description: 'Retitle the selected hero precisely.',
        version: '2.1.0',
        instructions: 'Use one concise heading.',
        activation: { mode: 'explicit' },
        restrictToCommands: ['setProp'],
      },
    ]);
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        expect(context.fragments.map(({ source }) => source)).toEqual(['host.hero-copy']);
        return Promise.resolve({
          rationale: 'Retitle the selected hero.',
          commands: [
            { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Sharper' } },
          ],
        });
      },
    };
    const { user } = renderPanel({
      planProvider: provider,
      skillRegistry,
      selectedSkillIds: ['host.hero-copy'],
      onAgentEvent: (event) => events.push(event),
    });

    await requestPlan(user, 'retitle the hero');

    expect(events.map(({ type }) => type)).toEqual([
      'run.started',
      'skills.resolving',
      'skills.resolved',
      'context.gathering',
      'context.ready',
      'plan.proposing',
      'plan.validating',
      'plan.proposed',
      'run.completed',
    ]);
    expect(events.find(({ type }) => type === 'skills.resolved')).toMatchObject({
      activations: [expect.objectContaining({ id: 'host.hero-copy', version: '2.1.0' })],
    });
    expect(screen.getByText(/host\.hero-copy · v2\.1\.0 · [a-f0-9]{8}/)).toBeInTheDocument();
  });

  it('renders typed retryable failures and retries the same request through a fresh agent run', async () => {
    let calls = 0;
    const provider: AiPlanProvider = {
      propose: () => {
        calls += 1;
        return calls === 1
          ? Promise.reject(
              new AiProviderError('The assistant is temporarily busy.', {
                code: 'http-status',
                retryable: true,
                status: 503,
              }),
            )
          : Promise.resolve({
              rationale: 'Retitle the existing hero.',
              commands: [
                {
                  command: 'setProp',
                  args: { id: 'selected-hero', key: 'heading', value: 'Recovered' },
                },
              ],
            });
      },
    };
    const { user } = renderPanel({ planProvider: provider });
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'retitle the hero');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('http-status')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });
    expect(calls).toBe(2);
  });

  it('shows a typed context-budget failure without offering an unsafe retry loop', async () => {
    let providerCalls = 0;
    const { user } = renderPanel({
      agentPolicy: { maxContextTokens: 1 },
      planProvider: {
        propose: () => {
          providerCalls += 1;
          return Promise.resolve({ rationale: 'Should not run.', commands: [] });
        },
      },
    });

    await user.type(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
      'retitle the hero',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('context-budget')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(providerCalls).toBe(0);
  });

  it('supersedes an old chat run and prevents its late result from owning the new chat', async () => {
    let finishFirst: ((plan: AiPlan) => void) | undefined;
    let calls = 0;
    const provider: AiPlanProvider = {
      propose: () => {
        calls += 1;
        if (calls === 1) {
          return new Promise((resolve) => {
            finishFirst = resolve;
          });
        }
        return Promise.resolve({
          rationale: 'The current chat proposal.',
          commands: [
            { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Current' } },
          ],
        });
      },
    };
    const { user } = renderPanel({ planProvider: provider });
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'old request');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('button', { name: 'Stop' });

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    const currentComposer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(currentComposer, 'current request');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('The current chat proposal.')).toBeInTheDocument();

    act(() => {
      finishFirst?.({
        rationale: 'A stale proposal that must never appear here.',
        commands: [
          { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Stale' } },
        ],
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByText('A stale proposal that must never appear here.'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(1);
  });

  it('retains every request and its own proposed plan in the conversation thread', async () => {
    const { user } = renderPanel();

    await requestPlan(user, 'add a hero');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Ask the assistant' })).toBeEnabled();
    });
    await requestPlan(user, 'add a pricing section');

    expect(screen.getByText('add a hero')).toBeInTheDocument();
    expect(screen.getByText('add a pricing section')).toBeInTheDocument();
    expect(screen.getByText(/Add a hero block to root\.default/)).toBeInTheDocument();
    expect(screen.getByText(/Add a pricing block to root\.default/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(2);
  });

  it('keeps the document and transaction log untouched while a plan is only proposed', async () => {
    const { kernel, user } = renderPanel();
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = structuredClone(kernel.transactions());

    await requestPlan(user, 'add a hero');

    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toEqual(beforeTransactions);
  });

  it('applies one assistant change and one Undo restores the exact document', async () => {
    const { kernel, user } = renderPanel();
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = kernel.transactions().length;

    await requestPlan(user, 'add a hero');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(kernel.getDocument()).not.toEqual(beforeDocument);
    expect(kernel.transactions()).toHaveLength(beforeTransactions + 1);
    expect(kernel.transactions()[0]?.author).toBe('ai');
    expect(screen.getByText('Applied as one change.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toHaveLength(beforeTransactions + 1);
  });

  it('discards a proposed plan without changing the document or transaction log', async () => {
    const { kernel, user } = renderPanel();
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = structuredClone(kernel.transactions());

    await requestPlan(user, 'add a hero');
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.getByText('Discarded.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toEqual(beforeTransactions);
  });

  it('states the whole-page or selected-block context and follows real selection changes', async () => {
    const { kernel } = renderPanel();

    expect(screen.getByText('Sees: the whole page')).toBeInTheDocument();

    act(() => {
      kernel.setSelection(['selected-hero']);
    });
    await waitFor(() => {
      expect(screen.getByText('Sees: hero · selected')).toBeInTheDocument();
    });

    act(() => {
      kernel.setSelection([]);
    });
    await waitFor(() => {
      expect(screen.getByText('Sees: the whole page')).toBeInTheDocument();
    });
  });

  it('names the selected block in live run progress and cancels it cleanly', async () => {
    const kernel = createAssistantKernel();
    kernel.setSelection(['selected-hero']);
    const provider: AiPlanProvider = {
      propose: (_request, _context, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    };
    const { user } = renderPanel({ kernel, planProvider: provider });
    await user.type(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
      'retitle it',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Reading the hero block…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('Stopped.')).toBeInTheDocument();
  });

  it('surfaces the kernel door reason when preflight refuses a proposed command', async () => {
    const invalidPlan = {
      rationale: 'Insert a hero with invalid properties.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'hero', parentId: 'root', slot: 'default', props: { heading: 42 } },
        },
      ],
    };
    const { kernel, user } = renderPanel({
      planProvider: createScriptedAiPlanProvider(invalidPlan),
    });
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = structuredClone(kernel.transactions());

    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'add a hero');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const refusal = await screen.findByText(/Step 0 was rejected by the kernel door:/);
    expect(refusal).toHaveTextContent(
      /Props for "hero" failed its schema: Invalid input: expected string, received number/,
    );
    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toEqual(beforeTransactions);
  });

  it('surfaces the live kernel reason when a proposed plan becomes invalid before Apply', async () => {
    const { kernel, user } = renderPanel();

    await requestPlan(user, 'add a hero');
    kernel.dispatch('insertNode', { type: 'pricing', parentId: 'root', props: {} });
    const beforeApply = structuredClone(kernel.getDocument());
    const beforeTransactions = structuredClone(kernel.transactions());

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await screen.findByText(
      'Step 0 was rejected by the kernel door: Slot "default" of "root" holds at most 2 children.',
    );
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(beforeApply);
    expect(kernel.transactions()).toEqual(beforeTransactions);
  });

  it('starts a new empty chat and names it with its first request', async () => {
    const { user } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    const history = screen.getByRole('button', { name: 'Conversation' });
    expect(history).toHaveAccessibleName('Conversation');
    expect(
      screen.getByText('Ask for a section and I will propose the exact changes.'),
    ).toBeInTheDocument();

    await user.click(history);
    expect(
      screen.getByRole('menuitemradio', { name: /New chat/, checked: true }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await requestPlan(user, 'add a hero');

    await user.click(screen.getByRole('button', { name: 'Conversation' }));
    expect(
      screen.getByRole('menuitemradio', { name: /add a hero/, checked: true }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio', { name: /New chat/ })).toHaveLength(1);
  });

  it('opens the conversation history on demand and closes it on Escape', async () => {
    const { user } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    // History is a place you go back to, so nothing is on screen until asked for.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    const history = screen.getByRole('button', { name: 'Conversation' });
    await user.click(history);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);

    // Escape returns focus to the trigger rather than dropping it on the body.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(history).toHaveFocus();
  });

  it('walks the history with the arrow keys the menu role promises', async () => {
    const { user } = renderPanel();

    await requestPlan(user, 'add a hero');
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    await user.click(screen.getByRole('button', { name: 'Conversation' }));

    // Focus enters on the chat you are in, not on the top of the list.
    const current = screen.getByRole('menuitemradio', { name: /New chat/ });
    const other = screen.getByRole('menuitemradio', { name: /add a hero/ });
    expect(current).toHaveFocus();

    // Each assertion names the element focus must LAND on — `not.toHaveFocus`
    // would pass just as well if focus had fallen through to the body.
    await user.keyboard('{ArrowDown}');
    expect(other).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(current).toHaveFocus();
    await user.keyboard('{Home}');
    expect(other).toHaveFocus();
    await user.keyboard('{End}');
    expect(current).toHaveFocus();
  });

  it('switches to the conversation chosen from the history and shows its own turns', async () => {
    const { user } = renderPanel();

    await requestPlan(user, 'add a hero');
    // The proposal belongs to the chat it was made in, not to the panel.
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Conversation' }));
    await user.click(screen.getByRole('menuitemradio', { name: /add a hero/ }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByText(/Add a hero block to root\.default/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('turns the send action into a Stop while working, and Stop really cancels', async () => {
    const provider: AiPlanProvider = {
      propose: (_request, _context, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    };
    const { user } = renderPanel({ planProvider: provider });
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'add a hero');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const stop = await screen.findByRole('button', { name: 'Stop' });
    await user.click(stop);

    await waitFor(() => {
      expect(screen.getByText('Stopped.')).toBeInTheDocument();
    });
    // The composer is usable again, and nothing pretends a proposal exists.
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask the assistant' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('narrates the provider progress live while a request runs', async () => {
    let finish: ((plan: AiPlan) => void) | undefined;
    let report: ((text: string) => void) | undefined;
    const provider: AiPlanProvider = {
      propose: (_request, _context, options) =>
        new Promise((resolve) => {
          report = options?.onProgress;
          finish = resolve;
        }),
    };
    const { user } = renderPanel({ planProvider: provider });
    await user.type(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
      'add a hero',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText(/Reading the page/);
    act(() => {
      report?.('Drafting the plan\u2026');
    });
    await screen.findByText('Drafting the plan\u2026');
    act(() => {
      report?.('Wrote 1 command\u2026');
    });
    await screen.findByText('Wrote 1 command\u2026');

    act(() => {
      finish?.({
        rationale: 'Add a hero block to root.default.',
        commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });
  });

  it('names each step in human words — the title when given, a derived label otherwise', async () => {
    const provider = createScriptedAiPlanProvider({
      rationale: 'Add a hero and retitle the existing one.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'pricing', parentId: 'root' },
          title: 'إضافة قسم الأسعار',
        },
        { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'New' } },
      ],
    });
    const { user } = renderPanel({ planProvider: provider });

    await requestPlan(user, 'add pricing and retitle');

    // The model's own words lead…
    expect(screen.getByText('إضافة قسم الأسعار')).toBeInTheDocument();
    // …a missing title falls back to a derived human label, not a command name…
    expect(screen.getByText('Change heading of selected-hero')).toBeInTheDocument();
    // …and the exact command stays visible as the technical truth of the step.
    expect(screen.getByText('insertNode')).toBeInTheDocument();
    expect(screen.getByText('setProp')).toBeInTheDocument();
  });

  it('offers Review as code only when the host supplies that capability', async () => {
    let reviews = 0;
    const { user } = renderPanel({
      onReviewAsCode: () => {
        reviews += 1;
      },
    });

    await requestPlan(user, 'add a hero');
    await user.click(screen.getByRole('button', { name: 'Review as code' }));
    expect(reviews).toBe(1);
  });

  it('previews the WOULD-BE page in a dialog without touching the document, then applies from it', async () => {
    const { kernel, user } = renderPanel();
    const before = structuredClone(kernel.getDocument());

    await requestPlan(user, 'add a pricing section');
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    const dialog = await screen.findByRole('dialog', { name: 'Preview' });
    expect(dialog).toBeInTheDocument();
    // Looking is not applying.
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument();
    });
    expect(Object.keys(kernel.getDocument().nodes).length).toBe(
      Object.keys(before.nodes).length + 1,
    );
    expect(screen.getByText(/Applied as one change/)).toBeInTheDocument();
  });

  it('closes the preview dialog on Escape with nothing applied', async () => {
    const { kernel, user } = renderPanel();
    const before = structuredClone(kernel.getDocument());

    await requestPlan(user, 'add a pricing section');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByRole('dialog', { name: 'Preview' });
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument();
    });
    expect(kernel.getDocument()).toEqual(before);
  });

  it('carries the conversation history and the applied-changes memory into the next ask', async () => {
    const captured: { history?: unknown; memory?: string | undefined }[] = [];
    const provider: AiPlanProvider = {
      propose: (request, context, options) => {
        captured.push({
          history: options?.history,
          memory: context.fragments.find((f) => f.title === 'Session memory')?.body,
        });
        return Promise.resolve(
          request.startsWith('add')
            ? {
                rationale: 'Add a pricing block to root.default.',
                commands: [{ command: 'insertNode', args: { type: 'pricing', parentId: 'root' } }],
              }
            : {
                rationale: 'Retitle the existing hero.',
                commands: [
                  {
                    command: 'setProp',
                    args: { id: 'selected-hero', key: 'heading', value: 'Hi' },
                  },
                ],
              },
        );
      },
    };
    const { user } = renderPanel({ planProvider: provider });

    await requestPlan(user, 'add a pricing section');
    await user.click(screen.getAllByRole('button', { name: 'Apply' })[0]!);
    await requestPlan(user, 'retitle the hero');

    // First ask: empty past, so no empty memory fragment consumes context.
    expect(captured[0]?.history).toEqual([]);
    expect(captured[0]?.memory).toBeUndefined();
    // Second ask: the full first exchange, plus host-authored outcome data.
    expect(captured[1]?.history).toEqual([
      { role: 'user', text: 'add a pricing section' },
      { role: 'assistant', text: 'Add a pricing block to root.default.' },
    ]);
    expect(JSON.parse(captured[1]?.memory ?? '')).toEqual({
      schemaVersion: 1,
      records: [
        {
          schemaVersion: 1,
          source: 'host',
          kind: 'applied-change',
          trust: 'reviewed',
          summary: 'Applied 1 validated Builder command.',
          commandNames: ['insertNode'],
        },
      ],
      omittedRecords: 0,
    });
    expect(captured[1]?.memory).not.toContain('Add a pricing block to root.default.');
  });

  it('summarizes multi-command memory as a deduplicated host outcome', async () => {
    let calls = 0;
    let remembered: string | undefined;
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve({
            rationale: 'Refine the selected hero twice.',
            commands: [
              { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'First' } },
              { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Final' } },
            ],
          });
        }
        remembered = context.fragments.find(({ source }) => source === 'host:session-memory')?.body;
        return Promise.resolve({
          rationale: 'Keep the final heading.',
          commands: [
            { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Final' } },
          ],
        });
      },
    };
    const { user } = renderPanel({ planProvider: provider });

    await requestPlan(user, 'refine the hero');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await requestPlan(user, 'keep it');

    const memory = JSON.parse(remembered ?? '') as { records: unknown[] };
    expect(memory.records).toEqual([
      expect.objectContaining({
        summary: 'Applied 2 validated Builder commands.',
        commandNames: ['setProp'],
      }),
    ]);
  });

  it('offers the plan own follow-up as a one-tap continuation', async () => {
    const asks: string[] = [];
    const provider: AiPlanProvider = {
      propose: (request) => {
        asks.push(request);
        return Promise.resolve({
          rationale: 'Stage one: the pricing section.',
          commands: [{ command: 'insertNode', args: { type: 'pricing', parentId: 'root' } }],
          followUp: 'كمل التنسيق والألوان',
        });
      },
    };
    const { user } = renderPanel({ planProvider: provider });

    await requestPlan(user, 'ابني صفحة كاملة');
    const continueButton = screen.getByRole('button', { name: /كمل التنسيق والألوان/ });
    await user.click(continueButton);

    await waitFor(() => {
      expect(asks).toEqual(['ابني صفحة كاملة', 'كمل التنسيق والألوان']);
    });
  });

  it('persists the conversation under persistKey and revives it on the next mount', async () => {
    const first = renderPanel({ persistKey: 'assistant-e2e-test' });
    await requestPlan(first.user, 'add a pricing section');
    expect(screen.getByText('add a pricing section')).toBeInTheDocument();
    first.unmount();

    const second = renderPanel({ persistKey: 'assistant-e2e-test' });
    expect(screen.getByText('add a pricing section')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(
      screen.getByText('This saved proposal expired after reload. Ask again to revalidate it.'),
    ).toBeInTheDocument();
    second.unmount();
    window.localStorage.removeItem('assistant-e2e-test');
  });

  it('revives legacy plans and failures as readable history without reviving authority', () => {
    window.localStorage.setItem(
      'assistant-legacy-test',
      JSON.stringify({
        activeId: 'legacy-session',
        sessions: [
          {
            id: 'legacy-session',
            title: 'Legacy chat',
            turns: [
              {
                id: 'legacy-plan',
                from: 'assistant',
                kind: 'plan',
                plan: {
                  rationale: 'A saved legacy proposal.',
                  commands: [{ command: 'setProp', args: {} }],
                },
                applied: false,
              },
              {
                id: 'legacy-failure',
                from: 'assistant',
                kind: 'refused',
                text: 'Legacy refusal.',
              },
            ],
          },
        ],
      }),
    );

    const { unmount } = renderPanel({ persistKey: 'assistant-legacy-test' });
    expect(screen.getByText('A saved legacy proposal.')).toBeInTheDocument();
    expect(screen.getByText('Legacy refusal.')).toBeInTheDocument();
    expect(
      screen.getByText('This saved proposal expired after reload. Ask again to revalidate it.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    unmount();
    window.localStorage.removeItem('assistant-legacy-test');
  });

  it('Auto mode applies a validated plan immediately — still one undoable change', async () => {
    const events: AiAgentEvent[] = [];
    const { kernel, user } = renderPanel({ onAgentEvent: (event) => events.push(event) });
    const before = structuredClone(kernel.getDocument());

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'add a pricing section');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText(/Applied as one change/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(Object.keys(kernel.getDocument().nodes).length).toBe(
      Object.keys(before.nodes).length + 1,
    );
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(before);
    expect(events[0]).toMatchObject({ type: 'run.started', apply: 'auto' });
    expect(events.map(({ type }) => type)).toContain('plan.applying');
  });

  it('Plan mode proposes without offering Apply — exploring is never applying', async () => {
    const { kernel, user } = renderPanel();
    const before = structuredClone(kernel.getDocument());

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'add a pricing section');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText(/Add a pricing block to root\.default/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(before);
  });

  it('typing @ opens the page mention picker and the pick becomes the request context', async () => {
    let seenSelection: readonly string[] = [];
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        seenSelection = context.selection.ids;
        return Promise.resolve({
          rationale: 'Retitle the mentioned hero.',
          commands: [
            { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Hi' } },
          ],
        });
      },
    };
    const { user } = renderPanel({ planProvider: provider });
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });

    await user.type(composer, 'retitle @');
    const option = await screen.findByRole('option', { name: /selected-hero/ });
    await user.click(option);

    expect(composer.value).toContain('@selected-hero');

    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });
    expect(seenSelection).toEqual(['selected-hero']);
  });

  it('shows an empty mention result and Escape closes it without changing the draft', async () => {
    const { user } = renderPanel();
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });

    await user.type(composer, 'retitle @ghost');
    expect(await screen.findByText('No matching block.')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox', { name: 'Mention a block' })).not.toBeInTheDocument();
    expect(composer).toHaveValue('retitle @ghost');
  });
});

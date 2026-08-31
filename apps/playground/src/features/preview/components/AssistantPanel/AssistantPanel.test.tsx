import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createScriptedAiPlanProvider } from '@craftkit/builder/testing';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import {
  createBuilder,
  defineBlockSchema,
  type AiPlan,
  type AiPlanProvider,
  type BuilderKernel,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import { z } from 'zod';

import { AssistantPanel, type AssistantPanelProps } from './AssistantPanel';

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
  it('exposes the assistant, thread, composer, and starter actions with native accessible names', () => {
    renderPanel();

    expect(screen.getByRole('region', { name: 'Assistant' })).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'Conversation' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask the assistant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add a hero' })).toBeInTheDocument();
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

    // First ask: empty past, empty memory.
    expect(captured[0]?.history).toEqual([]);
    expect(captured[0]?.memory).toContain('Nothing recorded yet');
    // Second ask: the full first exchange, and what was actually applied.
    expect(captured[1]?.history).toEqual([
      { role: 'user', text: 'add a pricing section' },
      { role: 'assistant', text: 'Add a pricing block to root.default.' },
    ]);
    expect(captured[1]?.memory).toContain('Add a pricing block to root.default.');
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
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    second.unmount();
    window.localStorage.removeItem('assistant-e2e-test');
  });

  it('Auto mode applies a validated plan immediately — still one undoable change', async () => {
    const { kernel, user } = renderPanel();
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
});

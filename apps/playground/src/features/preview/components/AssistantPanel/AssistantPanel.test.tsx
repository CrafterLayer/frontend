import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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
  type AiBuildOwnEvent,
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
  const { container, unmount } = render(<AssistantPanel kernel={kernel} {...props} />);
  return { container, kernel, user, unmount };
}

/**
 * The faces sit inside aria-hidden seats on purpose (the voice line is what a
 * screen reader hears), so they are reached by class, never by role.
 */
function headerFace(container: HTMLElement): HTMLElement {
  const face = container.querySelector<HTMLElement>('.pg-chat__brand-mark .pg-face');
  if (face === null) {
    throw new Error('The header must seat the character face.');
  }
  return face;
}

function replyFaces(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.pg-chat__avatar .pg-face')];
}

/** Idle and listening share one line on purpose: focus and keystrokes are never announced. */
const IDLE_LINE_EN = 'Say what you want. Skip the preamble.';
const IDLE_LINE_AR = 'قول شو بدك. بدون مقدمات.';

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
    /*
      The suggestion strip, not a hardcoded sentence. It used to assert
      `add a hero` — one of four English strings that had nothing to do with the
      blocks this build registered and vanished after the first message. The
      strip is DERIVED from the catalog's own example prompts, so what it says
      depends on the kernel; what is asserted is that it exists, is named, and
      offers something.
    */
    const suggestions = screen.getByRole('list', { name: 'Suggestions' });
    expect(within(suggestions).getAllByRole('button').length).toBeGreaterThan(0);
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

    /*
      Scoped to the LOG. A request a person typed and a suggestion offered above
      the composer can legitimately read the same — the suggestions are derived
      from the catalog's example prompts, and "add a hero" is one of them — so an
      unscoped query now matches two elements that mean different things.
    */
    const log = within(screen.getByRole('log', { name: 'Conversation' }));
    expect(log.getByText('add a hero')).toBeInTheDocument();
    expect(log.getByText('add a pricing section')).toBeInTheDocument();
    expect(screen.getByText(/Add a hero block to root\.default/)).toBeInTheDocument();
    expect(screen.getByText(/Add a pricing block to root\.default/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(2);
  });

  describe('a suggestion carrying a catalog prompt', () => {
    /** A provider that would answer, so reaching it is visible as a call. */
    function spyProvider() {
      const propose = vi.fn<AiPlanProvider['propose']>().mockResolvedValue({
        rationale: 'from the model',
        commands: [
          { command: 'insertNode', args: { type: 'pricing', parentId: 'root', slot: 'default' } },
        ],
      });
      return { propose, provider: { propose } satisfies AiPlanProvider };
    }

    it('is answered from the catalog, without asking anyone', async () => {
      const { propose, provider } = spyProvider();
      const { user } = renderPanel({ planProvider: provider, providerKind: 'remote' });
      await user.click(await screen.findByRole('button', { name: 'add a hero' }));
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(1);
      });
      expect(propose).not.toHaveBeenCalled();
    });

    it('proposes the block’s OWN example, not a guess at one', async () => {
      const { provider } = spyProvider();
      const { user, kernel } = renderPanel({ planProvider: provider, providerKind: 'remote' });
      await user.click(await screen.findByRole('button', { name: 'add a hero' }));
      await user.click(await screen.findByRole('button', { name: 'Apply' }));
      await waitFor(() => {
        expect(Object.values(kernel.getDocument().nodes)).toHaveLength(3);
      });
      const added = Object.values(kernel.getDocument().nodes).find(
        (node) => node.type === 'hero' && node.id !== 'selected-hero',
      );
      expect(added?.props).toEqual({ heading: 'Hello' });
    });

    it('still asks the model for the SAME words typed by hand', async () => {
      const { propose, provider } = spyProvider();
      const { user } = renderPanel({ planProvider: provider, providerKind: 'remote' });
      await requestPlan(user, 'add a hero');
      /*
        The distinction is the whole feature. Pressing the chip is picking a
        named example; writing the same words is asking for a hero for THIS
        page, and answering that from the catalog's demo copy would be a fast
        wrong answer.
      */
      expect(propose).toHaveBeenCalledOnce();
    });
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

  it('keeps follow-up suggestions out of a conversation that already has turns', async () => {
    const provider: AiPlanProvider = {
      propose: () =>
        Promise.resolve({
          rationale: 'Stage one: the pricing section.',
          commands: [{ command: 'insertNode', args: { type: 'pricing', parentId: 'root' } }],
          followUp: 'كمل التنسيق والألوان',
        }),
    };
    const { user } = renderPanel({ planProvider: provider });

    await requestPlan(user, 'ابني قسم الأسعار');

    expect(screen.queryByRole('list', { name: 'Suggestions' })).not.toBeInTheDocument();
  });

  it('persists the conversation under persistKey and revives it on the next mount', async () => {
    const first = renderPanel({ persistKey: 'assistant-e2e-test' });
    await requestPlan(first.user, 'add a pricing section');
    expect(
      within(screen.getByRole('log', { name: 'Conversation' })).getByText('add a pricing section'),
    ).toBeInTheDocument();
    first.unmount();

    const second = renderPanel({ persistKey: 'assistant-e2e-test' });
    expect(
      within(screen.getByRole('log', { name: 'Conversation' })).getByText('add a pricing section'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(
      screen.getByText('This saved proposal expired after reload. Ask again to revalidate it.'),
    ).toBeInTheDocument();
    second.unmount();
    window.localStorage.removeItem('assistant-e2e-test');
  });

  it('revives an outline whole — there was never any authority in it to lose', async () => {
    /*
      A plan CARD comes back stripped: its `proposal` is runtime authority that
      deliberately cannot survive JSON, so the revived card says the proposal
      expired. An outline has none — it is text, a follow-up and a count — so it
      revives complete and still offers nothing to apply, which is the same
      thing it offered before the reload.
    */
    const first = renderPanel({ persistKey: 'assistant-outline-test' });
    await first.user.click(screen.getByRole('radio', { name: 'Plan' }));
    /*
      A request the LOCAL provider can actually answer. It refuses anything it
      cannot place in a real slot ("No registered block matches the request"),
      and a refusal is a different turn — correct behaviour, but not the one
      under test here.
    */
    await send(first.user, 'add a pricing section');
    const log = () => screen.getByRole('log', { name: 'Conversation' });
    await waitFor(() => {
      expect(log().querySelector('.pg-chat__outline')?.textContent ?? '').not.toBe('');
    });
    const written = log().querySelector('.pg-chat__outline')?.textContent ?? '';
    first.unmount();

    const second = renderPanel({ persistKey: 'assistant-outline-test' });

    expect(log().querySelector('.pg-chat__outline')?.textContent).toBe(written);
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('This saved proposal expired after reload. Ask again to revalidate it.'),
    ).not.toBeInTheDocument();
    second.unmount();
    window.localStorage.removeItem('assistant-outline-test');
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

  it('Plan mode answers with a PLAN, and with nothing to apply', async () => {
    /*
      Stronger than what this used to assert. It once expected a proposal card
      with Preview but no Apply — and Preview's own dialog has no mode check, so
      "no Apply" was two clicks from an apply. A plan run now carries no
      proposal at all: there is nothing for either button to act on, which is
      the difference between hiding a door and not building one.

      The provider still returns commands (the local one always does). They are
      DROPPED, counted, and reported — a model that ignores the instruction
      costs the person a paragraph, never their page.
    */
    const { kernel, user } = renderPanel();
    const before = structuredClone(kernel.getDocument());

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'add a pricing section');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const log = screen.getByRole('log', { name: 'Conversation' });
    await waitFor(() => {
      expect(log.querySelector('.pg-chat__outline')?.textContent ?? '').not.toBe('');
    });
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toEqual([]);
  });

  it('says what the plan would change, before the decision', async () => {
    /*
      Computed from `previewAiPlan` — the plan rehearsed on a scratch kernel
      through the real door — and diffed against the live document. Not a
      re-reading of the step list: the two differ exactly where it matters, and
      a person deciding whether to Apply needs the size of the change, not a
      restatement of what was asked for.
    */
    // The panel's default locale is Arabic, and so is the sentence.
    const arabic = renderPanel();
    await requestPlan(arabic.user, 'add a pricing section');
    expect(
      screen.getByRole('log', { name: 'Conversation' }).querySelector('.pg-chat__impact')
        ?.textContent,
    ).toMatch(/إضافة/);
    arabic.unmount();

    const english = renderPanel({ locale: 'en' });
    await requestPlan(english.user, 'add a pricing section');
    expect(
      screen.getByRole('log', { name: 'Conversation' }).querySelector('.pg-chat__impact')
        ?.textContent,
    ).toMatch(/block added/);
  });

  it('shows a labelled cost estimate on the card, before the decision', async () => {
    /*
      The engine's OWN estimator, over the context this run actually carried —
      the same number `generateAiPlan` checks its budget against, not a second
      calculation wearing the same name. Labelled an estimate because it is one:
      tokens counted from canonical JSON, no model asked, and it measures the
      REQUEST rather than the answer.
    */
    const { user } = renderPanel();
    await requestPlan(user, 'add a pricing section');

    const cost = screen.getByRole('log', { name: 'Conversation' }).querySelector('.pg-chat__cost');
    expect(cost?.textContent).toMatch(/^تقدير: ~[\d.]+k? توكن$/);
  });

  it('says a plan changes NOTHING rather than letting a person spend an undo finding out', async () => {
    /*
      A `setProp` to the value already there is a valid command that produces an
      identical document: the step list reads like work and the page does not
      move. The step list cannot tell you that; the diff can.
    */
    const provider: AiPlanProvider = {
      propose: () =>
        Promise.resolve({
          rationale: 'Set the heading it already has.',
          commands: [
            {
              command: 'setProp',
              args: { id: 'selected-hero', key: 'heading', value: 'Existing section' },
            },
          ],
        }),
    };
    const { user } = renderPanel({ planProvider: provider });
    await send(user, 'retitle the hero');

    await waitFor(() => {
      /*
        The impact line carries the estimate beside it, so the assertion names
        the impact sentence specifically rather than the whole line.
      */
      const impact = screen
        .getByRole('log', { name: 'Conversation' })
        .querySelector('.pg-chat__impact');
      expect(impact?.textContent).toContain('لا يغيّر شيئًا على الصفحة.');
    });
  });

  it('NOTHING in the panel writes while Plan is selected', async () => {
    /*
      T291's negative, stated the way it should have been from the start.

      The first version looked for the literal word "Apply" — and passed while
      the applied card's Undo and the build report's per-section Undo both
      called `kernel.undo()` with no gate at all. A test that names one button
      cannot guard a rule about all of them.

      This one watches the two doors instead of reading labels: every write from
      this panel is a `dispatchGroup` (Apply) or an `undo` (the two Undos), so
      spying on both and pressing what remains asks the real question — does
      this panel write in Plan mode — rather than a question about wording.
    */
    const { user, container, kernel } = renderPanel();
    await requestPlan(user, 'add a pricing section');
    // Applied first, so the card that carries Undo actually exists to be found.
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('radio', { name: 'Plan' }));

    const dispatchGroup = vi.spyOn(kernel, 'dispatchGroup');
    const undo = vi.spyOn(kernel, 'undo');
    const before = structuredClone(kernel.getDocument());

    const pressable = [...container.querySelectorAll('button')].filter(
      (button) =>
        !button.disabled &&
        // Not the mode radios: leaving Plan is exactly how a person is meant to
        // regain the ability to write, and pressing one would end the test's
        // premise rather than test it.
        button.getAttribute('role') !== 'radio' &&
        // Not "New chat" — it ends the conversation being inspected.
        button.textContent !== 'New chat',
    );
    expect(pressable.length).toBeGreaterThan(0);
    for (const button of pressable) {
      await user.click(button);
    }

    expect(dispatchGroup).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();
    expect(kernel.getDocument()).toEqual(before);
  });

  it('refuses to apply an OLD Ask proposal once Plan is selected', async () => {
    /*
      The route a BoundedRelay audit found and I had not: Plan was a label on
      new cards rather than a state of the panel. Every gate read the mode the
      turn was PROPOSED under, so an Ask proposal made a minute ago kept its
      Apply after the person switched to Plan — and its Preview dialog applied
      unconditionally. "Only plan — never apply" was one or two clicks from an
      apply, on work the panel was currently promising not to touch.

      `accept()` now fails closed against the CURRENT mode, at the single
      function every route reaches. A gate on a button is a gate somebody can
      forget to copy.
    */
    const { kernel, user } = renderPanel();
    await requestPlan(user, 'add a pricing section');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    const before = structuredClone(kernel.getDocument());

    await user.click(screen.getByRole('radio', { name: 'Plan' }));

    // The button is gone, because the panel will not do what it would offer…
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    // …and the preview cannot get around it either.
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.getByText(/Planning only/)).toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(before);
  });

  it('keeps outline follow-ups out of the starter area after the first turn', async () => {
    const provider: AiPlanProvider = {
      propose: () =>
        Promise.resolve({
          rationale: 'GOAL: a clinic page.',
          commands: [],
          followUp: 'ابدأ ببناء القسم الافتتاحي',
        }),
    };
    const { user } = renderPanel({ planProvider: provider });

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    await send(user, 'صفحة عيادة');

    expect(screen.queryByRole('list', { name: 'Suggestions' })).not.toBeInTheDocument();
  });

  it('remembers the mode across a reload, because Ask can write and Plan cannot', async () => {
    /*
      The mode was not persisted, so every reload returned to Ask. A person who
      deliberately put the assistant in Plan came back to a panel that would
      apply — having changed nothing, and been told nothing.
    */
    const first = renderPanel({ persistKey: 'assistant-mode-test' });
    await first.user.click(screen.getByRole('radio', { name: 'Plan' }));
    first.unmount();

    const second = renderPanel({ persistKey: 'assistant-mode-test' });

    expect(screen.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true');
    second.unmount();
    window.localStorage.removeItem('assistant-mode-test');
  });

  it('shows suggestions only on an empty conversation', async () => {
    /*
      One list, two layouts. On an empty panel there is nothing to crowd and a
      person who has said nothing yet is choosing, so the suggestions stack as
      full-width targets. The moment a conversation exists they become a
      one-row rail at a fixed height — a column of cards was eating half the
      panel and hiding the very thread it was meant to help continue.
    */
    const { user } = renderPanel();

    expect(screen.getByRole('list', { name: 'Suggestions' })).toHaveAttribute(
      'data-layout',
      'stack',
    );

    await send(user, 'add a hero');

    expect(screen.queryByRole('list', { name: 'Suggestions' })).not.toBeInTheDocument();
  });

  it('carries the whole suggestion in the accessible name, even when the chip truncates', () => {
    /*
      A rail chip is capped at one line and ellipsised. The sentence it sends is
      the whole one, so the name a screen reader announces has to be the whole
      one too — otherwise the two disagree about what pressing it does.
    */
    renderPanel();
    const strip = screen.getByRole('list', { name: 'Suggestions' });
    const chips = within(strip).getAllByRole('button');

    for (const chip of chips) {
      expect(chip.getAttribute('title')).toBe(chip.textContent);
    }
  });

  it('answers the arrows, and costs ONE tab stop — what role="radio" promises', async () => {
    /*
      Buttons with `role="radio"` do not get arrow keys for free, and three
      separate tab stops made the composer's action row cost three presses to
      cross. A person told "radio group" reaches for the arrows; if nothing
      answers, the group is a radio group only in the accessibility tree.
    */
    const user = userEvent.setup();
    renderPanel();

    const stops = screen
      .getAllByRole('radio')
      .filter((radio) => radio.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAttribute('aria-checked', 'true');

    screen.getByRole('radio', { name: 'Ask' }).focus();
    // The panel is Arabic by default, so ArrowLeft is FORWARD.
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
    // Selection moves focus with it, or the single tab stop is stranded.
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveFocus();

    // And it wraps: the ends of a radio group are not walls.
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true');
  });

  it('locks the mode while a run is in flight, because the run already has its authority', async () => {
    /*
      A run captures its mode when it starts and the closure keeps it: a request
      begun in Auto carries `apply: 'auto'` all the way to the door. Leaving the
      control enabled meant a person could press Auto, change their mind to
      Plan, and watch the page be written by a run they had just told to stop
      writing. Locking it is honest — this run's authority was decided when it
      started, and the way to change it is Stop.
    */
    let release: (() => void) | undefined;
    const provider: AiPlanProvider = {
      propose: () =>
        new Promise((resolve) => {
          release = () => {
            resolve({ rationale: 'A plan.', commands: [] });
          };
        }),
    };
    const { user } = renderPanel({ planProvider: provider });

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Ask the assistant',
    });
    await user.type(composer, 'a clinic page');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Auto' })).toBeDisabled();
    });
    expect(screen.getByRole('radio', { name: 'Ask' })).toBeDisabled();
    // Stop is still there: locked is not stranded.
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
    /*
      And the reason is on the hint line UNDER the row, not wedged among the
      buttons. The first version put a paragraph inside the radiogroup, where it
      wrapped over three lines and broke the composer's action row — the owner
      caught it from a screenshot.
    */
    expect(screen.getByText('Stop the request to change mode.')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Assistant mode' }).textContent).not.toContain(
      'Stop the request',
    );

    act(() => {
      release?.();
    });
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Auto' })).toBeEnabled();
    });
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

  it('re-keys saved turns that already share an id, once, on revival', () => {
    const persistKey = 'assistant-ids-repaired';
    window.localStorage.setItem(
      persistKey,
      JSON.stringify({
        activeId: 'session-1',
        sessions: [
          {
            id: 'session-1',
            title: 'New chat',
            turns: [
              { id: 'turn-2', from: 'you', text: 'first' },
              { id: 'turn-2', from: 'assistant', kind: 'discarded' },
              { id: 'turn-3', from: 'you', text: 'second' },
              { id: 'turn-3', from: 'assistant', kind: 'stopped' },
            ],
          },
        ],
      }),
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      renderPanel({ persistKey });
      const log = screen.getByRole('log', { name: 'Conversation' });
      expect(log.querySelectorAll('.pg-chat__turn')).toHaveLength(4);
      expect(screen.getByText('first')).toBeInTheDocument();
      expect(screen.getByText('Discarded.')).toBeInTheDocument();
      expect(screen.getByText('second')).toBeInTheDocument();
      expect(screen.getByText('Stopped.')).toBeInTheDocument();
      expect(
        errors.mock.calls.some((call) =>
          String(call[0]).includes('two children with the same key'),
        ),
      ).toBe(false);
    } finally {
      errors.mockRestore();
      window.localStorage.removeItem(persistKey);
    }
  });

  it('continues its ids after a reload so a new turn never repeats a saved key', async () => {
    const persistKey = 'assistant-ids-continue';
    window.localStorage.setItem(
      persistKey,
      JSON.stringify({
        activeId: 'session-1',
        sessions: [
          {
            id: 'session-1',
            title: 'New chat',
            turns: [
              { id: 'turn-2', from: 'you', text: 'first' },
              { id: 'turn-3', from: 'assistant', kind: 'discarded' },
            ],
          },
        ],
      }),
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { user } = renderPanel({ persistKey });
      const composer = screen.getByRole('textbox', { name: 'Ask the assistant' });
      await user.type(composer, 'add a hero');
      await user.keyboard('{Enter}');
      await screen.findByRole('button', { name: 'Apply' });

      const saved = JSON.parse(window.localStorage.getItem(persistKey) ?? '{}') as {
        sessions: readonly { turns: readonly { id: string }[] }[];
      };
      const ids = saved.sessions.flatMap((session) => session.turns.map((turn) => turn.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toEqual(expect.arrayContaining(['turn-2', 'turn-3']));
      expect(
        errors.mock.calls.some((call) =>
          String(call[0]).includes('two children with the same key'),
        ),
      ).toBe(false);
    } finally {
      errors.mockRestore();
      window.localStorage.removeItem(persistKey);
    }
  });

  describe('أبو غضب — the face and the voice', () => {
    it('names the character in the heading while the region, label and voice keep their roles', () => {
      const { container } = renderPanel();

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('أبو غضب');
      // One name, in the locale's language: the transliteration is not shown beside it.
      expect(heading).not.toHaveTextContent('Abu Ghadab');
      expect(heading.querySelector('[lang="ar"]')).toHaveTextContent('أبو غضب');
      expect(heading.querySelector('[lang="ar"]')).toHaveAttribute('dir', 'rtl');
      // The accessible surface is the tool's role, untouched by the rename.
      expect(screen.getByRole('region', { name: 'Assistant' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Ask the assistant' })).toBeInTheDocument();

      // Exactly one live region: his voice, outside every aria-hidden seat.
      expect(screen.getAllByRole('status')).toHaveLength(1);
      const voice = screen.getByRole('status');
      expect(voice).toHaveAttribute('lang', 'ar');
      expect(voice).toHaveAttribute('dir', 'auto');
      expect(voice).toHaveAttribute('aria-live', 'polite');
      expect(voice).toHaveAttribute('aria-atomic', 'true');
      expect(voice).toHaveTextContent(IDLE_LINE_AR);
      expect(voice.closest('[aria-hidden="true"]')).toBeNull();

      // The faces are decoration: live in the header, at rest in the empty state.
      expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');
      expect(headerFace(container)).toHaveAttribute('data-live');
      expect(headerFace(container).closest('[aria-hidden="true"]')).not.toBeNull();
      const emptyMark = container.querySelector('.pg-chat__empty-mark .pg-face');
      expect(emptyMark).toHaveAttribute('data-mood', 'idle');
      expect(emptyMark).not.toHaveAttribute('data-live');
      expect(
        screen.getByText('Ask for a section and I will propose the exact changes.'),
      ).toBeInTheDocument();
    });

    it('speaks English when the host asks for it', () => {
      renderPanel({ locale: 'en' });

      const voice = screen.getByRole('status');
      expect(voice).toHaveAttribute('lang', 'en');
      expect(voice).toHaveTextContent(IDLE_LINE_EN);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Abu Ghadab');
      expect(heading).not.toHaveTextContent('أبو غضب');
      expect(heading.querySelector('[lang="ar"]')).toBeNull();
      expect(heading.querySelector('[lang="en"]')).toHaveAttribute('dir', 'ltr');
    });

    it('listens while the composer has focus or a draft, and typing never changes what is announced', async () => {
      const { container, user } = renderPanel({ locale: 'en' });
      const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Ask the assistant',
      });
      const voice = screen.getByRole('status');
      expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');

      await user.click(composer);
      expect(composer).toHaveFocus();
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'listening');
      });
      expect(headerFace(container)).not.toHaveAttribute('data-typing');
      expect(voice).toHaveTextContent(IDLE_LINE_EN);

      await user.type(composer, 'add');
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-typing');
      });
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      // Listening is the face's business only: focus stays where the person put it.
      expect(composer).toHaveFocus();

      // The nudge relaxes on its own; the draft keeps him listening.
      await waitFor(
        () => {
          expect(headerFace(container)).not.toHaveAttribute('data-typing');
        },
        { timeout: 2000 },
      );
      expect(headerFace(container)).toHaveAttribute('data-mood', 'listening');
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
    });

    it('follows a run in the header: reading while the provider works, then the proposal', async () => {
      let finish: ((plan: AiPlan) => void) | undefined;
      const provider: AiPlanProvider = {
        propose: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      };
      const { container, user } = renderPanel({ locale: 'en', planProvider: provider });
      const voice = screen.getByRole('status');
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a hero',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      const focusedAfterSend = document.activeElement;

      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'thinking');
      });
      expect(voice).toHaveTextContent(
        /^(Reading the page\.|Choosing skills\.|\d+ skills ready\.|Read \d+ fragments\.)$/,
      );
      // The live thinking bubble mirrors the header — frozen at 24 px, never live.
      expect(replyFaces(container)).toHaveLength(1);
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'thinking');
      expect(replyFaces(container)[0]).not.toHaveAttribute('data-live');
      expect(screen.getByText('Reading the page…')).toBeInTheDocument();

      act(() => {
        finish?.({
          rationale: 'Add a hero block to root.default.',
          commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
        });
      });
      await waitFor(
        () => {
          expect(voice).toHaveTextContent("That's the plan. Read it before you click.");
        },
        { timeout: 3000 },
      );
      expect(headerFace(container)).toHaveAttribute('data-mood', 'done');
      expect(headerFace(container)).toHaveAttribute('data-outcome', 'proposed');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'done');
      expect(replyFaces(container)[0]).toHaveAttribute('data-outcome', 'proposed');
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
      // Mood changes never move focus.
      expect(document.activeElement).toBe(focusedAfterSend);
    });

    it('ends an Auto run on the applied line, in Arabic by default', async () => {
      const { container, user } = renderPanel();

      await user.click(screen.getByRole('radio', { name: 'Auto' }));
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a pricing section',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(
        () => {
          expect(screen.getByRole('status')).toHaveTextContent('خلص. صار.');
        },
        { timeout: 3000 },
      );
      expect(headerFace(container)).toHaveAttribute('data-mood', 'done');
      expect(headerFace(container)).toHaveAttribute('data-outcome', 'applied');
      expect(replyFaces(container)[0]).toHaveAttribute('data-outcome', 'applied');
      expect(screen.getByText(/Applied as one change/)).toBeInTheDocument();
    });

    it('smiles when Apply is pressed on a card, and the English voice mirrors the card', async () => {
      const { container, user } = renderPanel({ locale: 'en' });

      await requestPlan(user, 'add a hero');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Applied as one change.');
      });
      expect(headerFace(container)).toHaveAttribute('data-outcome', 'applied');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'done');
      expect(replyFaces(container)[0]).toHaveAttribute('data-outcome', 'applied');
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });

    it('rolls his eyes at a discard without touching the card', async () => {
      const { container, user } = renderPanel({ locale: 'en' });

      await requestPlan(user, 'add a hero');
      await user.click(screen.getByRole('button', { name: 'Discard' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Tossed it? Fine. It was good.');
      });
      expect(headerFace(container)).toHaveAttribute('data-outcome', 'discarded');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'done');
      expect(replyFaces(container)[0]).toHaveAttribute('data-outcome', 'discarded');
      expect(screen.getByText('Discarded.')).toBeInTheDocument();
    });

    it('winces when stopped, then settles back to idle while the bubble stays stopped', async () => {
      const provider: AiPlanProvider = {
        propose: (_request, _context, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      };
      const { container, user } = renderPanel({ locale: 'en', planProvider: provider });
      const voice = screen.getByRole('status');
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a hero',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await user.click(await screen.findByRole('button', { name: 'Stop' }));

      await waitFor(() => {
        expect(voice).toHaveTextContent('Stopped.');
      });
      expect(headerFace(container)).toHaveAttribute('data-mood', 'stopped');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'stopped');
      // The card's own word is untouched — the voice mirrors it, so scope to the thread.
      expect(
        within(screen.getByRole('log', { name: 'Conversation' })).getByText('Stopped.'),
      ).toBeInTheDocument();

      // A stop is the person's own act: nothing to fix, so it does not pin.
      await waitFor(
        () => {
          expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');
        },
        { timeout: 3000 },
      );
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'stopped');
    });

    it('scowls at a refusal and holds it through focus until the next keystroke', async () => {
      const provider: AiPlanProvider = {
        propose: () =>
          Promise.reject(
            new AiProviderError('This request is outside the available Builder commands.', {
              code: 'refusal',
              retryable: false,
            }),
          ),
      };
      const { container, user } = renderPanel({ locale: 'en', planProvider: provider });
      const voice = screen.getByRole('status');
      const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Ask the assistant',
      });
      await user.type(composer, 'publish the site directly');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(voice).toHaveTextContent("Not doing that. Reason's below.");
      });
      expect(headerFace(container)).toHaveAttribute('data-mood', 'failed');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'failed');
      // The card is untouched: the provider's words and the typed code stay.
      expect(
        screen.getByText('This request is outside the available Builder commands.'),
      ).toBeInTheDocument();
      expect(screen.getByText('refusal')).toBeInTheDocument();

      // Tabbing or clicking through must not dismiss an error…
      await user.click(composer);
      expect(composer).toHaveFocus();
      await act(async () => {
        await Promise.resolve();
      });
      expect(headerFace(container)).toHaveAttribute('data-mood', 'failed');
      expect(voice).toHaveTextContent("Not doing that. Reason's below.");

      // …only a keystroke does.
      await user.keyboard('x');
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'listening');
      });
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'failed');
    });

    it('tells a retryable failure apart from a final one', async () => {
      const provider: AiPlanProvider = {
        propose: () =>
          Promise.reject(
            new AiProviderError('The assistant is temporarily busy.', {
              code: 'http-status',
              retryable: true,
              status: 503,
            }),
          ),
      };
      const { container, user } = renderPanel({ locale: 'en', planProvider: provider });
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a hero',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent("Didn't go through. Try again.");
      });
      expect(headerFace(container)).toHaveAttribute('data-mood', 'failed');
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('forgets the run on New chat: the face is idle and the late cancellation is dropped', async () => {
      let finish: ((plan: AiPlan) => void) | undefined;
      const events: AiAgentEvent[] = [];
      // Ignores abort: the late result must be refused by the lease, not by luck.
      const provider: AiPlanProvider = {
        propose: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      };
      const { container, user } = renderPanel({
        locale: 'en',
        planProvider: provider,
        onAgentEvent: (event) => events.push(event),
      });
      const voice = screen.getByRole('status');
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a hero',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByRole('button', { name: 'Stop' });
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'thinking');
      });

      await user.click(screen.getByRole('button', { name: 'New chat' }));
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');
      });
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      expect(replyFaces(container)).toHaveLength(0);

      act(() => {
        finish?.({
          rationale: 'A stale proposal that must never appear here.',
          commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
        });
      });
      await waitFor(() => {
        expect(events.map(({ type }) => type)).toContain('run.cancelled');
      });
      // The old run's cancellation carries the old run id: the face drops it.
      expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      expect(
        screen.queryByText('A stale proposal that must never appear here.'),
      ).not.toBeInTheDocument();
    });
  });
});

/**
 * THE SPLIT BUILD.
 *
 * A page-sized request stops being one six-minute model call and becomes a
 * skeleton plus one run per section. These tests own the panel's half of that:
 * when it routes to the orchestrator at all, what the person sees while it
 * runs, what they are asked, and what is left behind when it ends.
 */
const buildRegion = defineBlockSchema({
  type: 'region',
  description: 'A freely composed page section.',
  props: z.object({
    label: z.string().default('Section'),
    body: z.string().default(''),
  }),
  examples: [],
});
const buildRoot = defineBlockSchema({
  type: 'buildPage',
  description: 'The page root a build scaffolds into.',
  props: z.object({}),
  slots: { default: { allow: ['region'] } },
  examples: [],
});
const buildVocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'assistant-panel.build-vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: buildRoot, render: Null },
      { schema: buildRegion, render: Null },
    ],
  },
};

const BUILD_REQUEST = 'build me a landing page for my ceramics studio';
const BUILD_DIRECTION =
  'A calm studio page for ceramicists. Palette bg-white text-slate-900. Faces Inter and Inter.';

function createBuildKernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'buildPage', props: {}, slots: { default: [] } } },
    },
    extensions: [buildVocabulary],
    ports: { clock: fixedClock(0), ids: seededIds('assistant-build') },
  });
}

/** A block prop read back as text; anything else on that key is not a title. */
function propText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(cause: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

interface BuildScript {
  readonly provider: AiPlanProvider;
  /** How many times the provider was asked for a plan — 1 scaffold + n fills. */
  calls(): number;
  /** The fills held open, by section title. */
  readonly gates: Map<string, Deferred<AiPlan>>;
}

/**
 * A scripted build: one scaffold plan naming every section, then one fill per
 * region, found by the selection the orchestrator scoped that run to. Never a
 * network, and never a guess about which region a fill was handed.
 */
function scriptBuild(
  kernel: BuilderKernel,
  titles: readonly string[],
  options: { readonly hold?: readonly string[]; readonly refuse?: readonly string[] } = {},
): BuildScript {
  const gates = new Map<string, Deferred<AiPlan>>();
  let calls = 0;
  const provider: AiPlanProvider = {
    propose(_request, context) {
      calls += 1;
      /*
        A SCAFFOLD is the run with nothing selected; a fill is scoped to one
        region. Keyed on the selection rather than on `calls === 1`, because a
        planned page that is then built for real scaffolds twice — and the
        second scaffold used to arrive here as a fill with no region and throw.
      */
      if (context.selection.ids.length === 0) {
        return Promise.resolve<AiPlan>({
          rationale: BUILD_DIRECTION,
          commands: titles.map((title) => ({
            command: 'insertNode',
            args: { type: 'region', parentId: 'root', props: { label: title, body: '' } },
          })),
        });
      }
      const id = context.selection.ids[0];
      if (id === undefined) {
        throw new Error('A fill run reached the provider with no region selected.');
      }
      const title = propText(kernel.getDocument().nodes[id]?.props['label']);
      if (options.refuse?.includes(title) === true) {
        return Promise.reject(
          new AiProviderError(`The model would not write "${title}".`, {
            code: 'refusal',
            retryable: false,
          }),
        );
      }
      const plan: AiPlan = {
        rationale: `Fill ${title}.`,
        commands: [{ command: 'setProp', args: { id, key: 'body', value: `Body for ${title}.` } }],
      };
      if (options.hold?.includes(title) === true) {
        const gate = gates.get(title) ?? deferred<AiPlan>();
        gates.set(title, gate);
        return gate.promise;
      }
      return Promise.resolve(plan);
    },
  };
  return { provider, calls: () => calls, gates };
}

/** Every region on the page, in reading order, as `label → body`. */
function regionsOf(kernel: BuilderKernel): Record<string, string> {
  const document = kernel.getDocument();
  const entries = (document.nodes[document.rootId]?.slots?.['default'] ?? []).map((id) => {
    const node = document.nodes[id];
    return [propText(node?.props['label']), propText(node?.props['body'])] as const;
  });
  return Object.fromEntries(entries);
}

async function send(user: ReturnType<typeof userEvent.setup>, request: string): Promise<void> {
  const composer = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' });
  await user.clear(composer);
  await user.type(composer, request);
  await user.click(screen.getByRole('button', { name: 'Send' }));
}

function buildEventTypes(events: readonly AiBuildOwnEvent[]): string[] {
  return events.map(({ type }) => type);
}

const TEN = [
  'Hero',
  'Proof',
  'Benefits',
  'How It Works',
  'Gallery',
  'Testimonials',
  'Pricing',
  'FAQ',
  'Final Call',
  'Footer',
] as const;

const THREE = ['Hero', 'Proof', 'Pricing'] as const;

describe('AssistantPanel — split build', () => {
  it('splits a ten-section page into a skeleton and one run per section, advancing the list', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, TEN, { hold: ['Benefits'] });
    const events: AiBuildOwnEvent[] = [];
    const { container, user } = renderPanel({
      kernel,
      planProvider: script.provider,
      onBuildEvent: (event) => events.push(event),
    });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);

    // The skeleton lands FIRST, as one transaction, before a word is written.
    await waitFor(
      () => {
        expect(Object.keys(regionsOf(kernel))).toHaveLength(10);
      },
      { timeout: 15_000 },
    );

    const list = await screen.findByRole('list', { name: 'Sections' }, { timeout: 15_000 });
    // The section rows are the list's OWN children: the open one nests the
    // whole GenerationProgress card, list items and all.
    const sectionRows = () => [...list.querySelectorAll<HTMLElement>(':scope > li.pg-chat__task')];
    expect(sectionRows()).toHaveLength(10);
    expect(sectionRows().map((row) => row.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Hero')]),
    );

    // Two sections written, the third open, the rest waiting their turn.
    await waitFor(
      () => {
        expect(container.querySelector('.pg-chat__tasks-count')).toHaveTextContent('2/10');
      },
      { timeout: 15_000 },
    );
    const rows = sectionRows();
    expect(rows[0]).toHaveAttribute('data-status', 'applied');
    expect(rows[1]).toHaveAttribute('data-status', 'applied');
    expect(rows[2]).toHaveAttribute('data-status', 'running');
    expect(rows[9]).toHaveAttribute('data-status', 'waiting');
    expect(regionsOf(kernel)['Benefits']).toBe('');

    act(() => {
      script.gates.get('Benefits')?.resolve({
        rationale: 'Fill Benefits.',
        commands: [
          {
            command: 'setProp',
            args: {
              id: Object.keys(kernel.getDocument().nodes).find(
                (id) => kernel.getDocument().nodes[id]?.props['label'] === 'Benefits',
              ),
              key: 'body',
              value: 'Body for Benefits.',
            },
          },
        ],
      });
    });

    await waitFor(
      () => {
        expect(screen.getByText(/10\/10 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(Object.values(regionsOf(kernel)).every((body) => body !== '')).toBe(true);
    expect(kernel.transactions().map(({ command }) => command)).toEqual([
      'Assistant: page skeleton',
      ...TEN.map((title, index) => `Assistant: ${String(index + 1)}/10 — ${title}`),
    ]);
    expect(buildEventTypes(events).slice(0, 3)).toEqual([
      'build.scaffolding',
      'build.planned',
      'task.started',
    ]);
  }, 60_000);

  it('leaves a single-section request on the ordinary path, byte for byte', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const events: AiBuildOwnEvent[] = [];
    const { user } = renderPanel({
      kernel,
      planProvider: script.provider,
      onBuildEvent: (event) => events.push(event),
    });

    await send(user, 'add one testimonial to the page');

    await screen.findByRole('button', { name: 'Apply' }, { timeout: 15_000 });
    expect(buildEventTypes(events)).toEqual([]);
    expect(script.calls()).toBe(1);
    expect(screen.queryByRole('list', { name: 'Sections' })).not.toBeInTheDocument();
  }, 30_000);

  it('enters the build path in Plan mode and stops at the skeleton', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const events: AiBuildOwnEvent[] = [];
    const { container, user } = renderPanel({
      kernel,
      planProvider: script.provider,
      onBuildEvent: (event) => events.push(event),
    });

    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    await send(user, BUILD_REQUEST);

    await waitFor(
      () => {
        expect(container.querySelector('.pg-chat__outline')?.textContent ?? '').not.toBe('');
      },
      { timeout: 15_000 },
    );
    /*
      One outline, and nothing to apply anywhere. This used to look for a Plan
      CARD with a Preview button; a plan run now produces no proposal at all, so
      neither button exists rather than being hidden.
    */
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    /*
      The build path IS entered now, and stops after the skeleton. It used to be
      excluded outright, which left the one request the build exists for as the
      one Plan could say least about. `build.scaffolding` and nothing after it
      is the whole contract: the skeleton was proposed, never applied, and no
      section was ever started.
    */
    expect(buildEventTypes(events)).toEqual(['build.scaffolding']);
    expect(script.calls()).toBe(1);
    expect(regionsOf(kernel)).toEqual({});
    expect(kernel.transactions()).toHaveLength(0);
  }, 30_000);

  it('asks once, on the list, and fills nothing until Build is pressed', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await send(user, BUILD_REQUEST);

    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    expect(within(approval).getByText(BUILD_DIRECTION)).toBeInTheDocument();
    expect(
      within(approval)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([...THREE]);
    expect(within(approval).getByText(/The skeleton is already on the page/)).toBeInTheDocument();

    // The skeleton is down; not one section has been written.
    expect(regionsOf(kernel)).toEqual({ Hero: '', Proof: '', Pricing: '' });
    expect(script.calls()).toBe(1);

    await user.click(within(approval).getByRole('button', { name: 'Build' }));

    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(regionsOf(kernel)).toEqual({
      Hero: 'Body for Hero.',
      Proof: 'Body for Proof.',
      Pricing: 'Body for Pricing.',
    });
  }, 40_000);

  it('leaves only the skeleton when the build is stopped before it is approved', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await send(user, BUILD_REQUEST);
    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    await user.click(within(approval).getByRole('button', { name: 'Stop build' }));

    await waitFor(
      () => {
        expect(screen.getByText(/0\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(regionsOf(kernel)).toEqual({ Hero: '', Proof: '', Pricing: '' });
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  }, 40_000);

  it('records a skipped section with its reason and still runs the next one', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { refuse: ['Proof'] });
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);

    await waitFor(
      () => {
        expect(screen.getByText(/2\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(screen.getByText(/The model would not write "Proof"\./)).toBeInTheDocument();
    expect(regionsOf(kernel)).toEqual({
      Hero: 'Body for Hero.',
      Proof: '',
      Pricing: 'Body for Pricing.',
    });
    expect(screen.getByRole('button', { name: 'Retry skipped' })).toBeInTheDocument();
  }, 40_000);

  it('undoes one section from the report, leaving the rest of the page alone', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider });

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(user, BUILD_REQUEST);
    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );

    await user.click(screen.getByRole('button', { name: 'Undo Pricing' }));

    expect(regionsOf(kernel)).toEqual({
      Hero: 'Body for Hero.',
      Proof: 'Body for Proof.',
      Pricing: '',
    });
    expect(screen.getByRole('button', { name: 'Undo Pricing' })).toBeDisabled();
  }, 40_000);

  it('revives a build interrupted by a reload as a stopped build with its receipt', async () => {
    const persistKey = 'assistant-build-revive';
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const first = renderPanel({ kernel, planProvider: script.provider, persistKey });

    await first.user.click(screen.getByRole('radio', { name: 'Auto' }));
    await send(first.user, BUILD_REQUEST);
    await waitFor(
      () => {
        // The build's own counter, not the running step's stage count.
        expect(first.container.querySelector('.pg-chat__tasks-count')).toHaveTextContent('1/3');
      },
      { timeout: 20_000 },
    );
    first.unmount();

    const second = renderPanel({ kernel: createBuildKernel(), persistKey });
    expect(screen.getByText(/1\/3 built in/)).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo Hero' })).not.toBeInTheDocument();
    second.unmount();
    window.localStorage.removeItem(persistKey);
  }, 40_000);
  it('follows the newest turn when the panel comes BACK into view, not only when one arrives', async () => {
    const kernel = createAssistantKernel();
    const planProvider = createScriptedAiPlanProvider({
      rationale: 'Add a hero.',
      commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
    });
    const user = userEvent.setup();
    // `visible={false}` is the App's Layers/Blocks tab: the panel stays MOUNTED
    // (its run must survive the visit) inside a `hidden` wrapper.
    const { rerender } = render(
      <AssistantPanel kernel={kernel} planProvider={planProvider} visible={false} />,
    );
    await requestPlan(user, 'add a hero');

    /*
      A hidden element measures zero, so the scroll-to-newest effect wrote
      `scrollTop = 0` and — with `turns` unchanged on the way back — never ran
      again. Measured in Chromium: returning to the assistant after five replies
      landed the reader ~360px above the newest one. jsdom lays nothing out, so
      the two properties are stated here and the WRITES are the assertion.
    */
    const thread = screen.getByRole('log', { name: 'Conversation' });
    const writes: number[] = [];
    Object.defineProperty(thread, 'scrollHeight', { configurable: true, get: () => 1200 });
    Object.defineProperty(thread, 'scrollTop', {
      configurable: true,
      get: () => writes.at(-1) ?? 0,
      set: (value: number) => {
        writes.push(value);
      },
    });

    rerender(<AssistantPanel kernel={kernel} planProvider={planProvider} visible />);
    await waitFor(() => {
      expect(writes.at(-1)).toBe(1200);
    });
  });
});

/**
 * PLAN MODE MEETS THE SPLIT BUILD.
 *
 * A page-sized request used to be excluded from the build path in Plan mode
 * entirely, so the one request the build exists for was the one Plan could say
 * least about. Now it enters the path and stops at the skeleton: the page's
 * shape, and nothing written.
 */
describe('a page-sized request in Plan mode', () => {
  const TITLES = ['Hero', 'Work', 'Contact'];

  async function planAPage() {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, TITLES);
    const before = structuredClone(kernel.getDocument());
    const { user } = renderPanel({ kernel, planProvider: script.provider, providerKind: 'remote' });
    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    await send(user, BUILD_REQUEST);
    await waitFor(() => {
      expect(screen.getByText(BUILD_DIRECTION)).toBeInTheDocument();
    });
    return { kernel, script, user, before };
  }

  it('writes NOTHING — not the skeleton, not a section', async () => {
    const { kernel, before } = await planAPage();
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('shows the page it would lay out, in order', async () => {
    await planAPage();
    const log = within(screen.getByRole('log', { name: 'Conversation' }));
    expect(log.getAllByRole('listitem').map((item) => item.textContent)).toEqual(TITLES);
  });

  it('asks the model once — the sections are named, not written', async () => {
    const { script } = await planAPage();
    expect(script.calls()).toBe(1);
  });

  it('offers no Apply and no Undo: there is nothing to apply or take back', async () => {
    await planAPage();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('never asks the build approval question — nothing was going to be written', async () => {
    await planAPage();
    expect(screen.queryByRole('group', { name: 'Build this page' })).toBeNull();
  });

  it('builds it for real on request, moving the mode control with it', async () => {
    const { kernel, user } = await planAPage();
    await user.click(screen.getByRole('button', { name: 'Build this' }));
    /*
      The control moves FIRST, and visibly. A run's authority is fixed when it
      starts, so the panel must never sit in Plan while the run it just started
      writes — that is the exact lie the mode lock was introduced to end.
    */
    expect(screen.getByRole('radio', { name: 'Ask' })).toBeChecked();
    /*
      And it lands in ASK, not Auto: the person asked to plan, so the section
      list still gets its one approval before anything is filled.
    */
    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 20_000 },
    );
    await user.click(within(approval).getByRole('button', { name: 'Build' }));
    await waitFor(
      () => {
        expect(Object.keys(regionsOf(kernel))).toEqual(TITLES);
      },
      { timeout: 20_000 },
    );
  }, 40_000);
});

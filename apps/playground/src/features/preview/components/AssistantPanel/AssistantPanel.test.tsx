import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createScriptedAiPlanProvider } from '@craftkit/builder/testing';
import {
  AiProviderError,
  createAiSkillRegistry,
  type AiAgentEvent,
  type AiPlan,
  type AiPlanProvider,
  type AiPlanStep,
} from '@craftkit/builder';

import { describeStep, shortSkillFingerprint } from './AssistantPanel.utils';
import { createAssistantKernel, renderPanel, requestPlan } from './AssistantPanel.test-helpers';

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
});

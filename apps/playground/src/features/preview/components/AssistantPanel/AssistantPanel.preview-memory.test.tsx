import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createScriptedAiPlanProvider } from '@craftkit/builder/testing';
import type { AiPlan, AiPlanProvider } from '@craftkit/builder';

import { renderPanel, requestPlan } from './AssistantPanel.test-helpers';
import { send } from './AssistantPanel.split-build.test-helpers';

describe('AssistantPanel', () => {
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

    await screen.findAllByText(/Reading the page/);
    /*
      The line appears in the run card's current line, its live log and the
      header's voice at once; the card's current line is the one asserted.
    */
    const currentLine = (text: string) =>
      screen.findByText(text, { selector: '.pg-agent-run__current' });
    act(() => {
      report?.('Drafting the plan\u2026');
    });
    await currentLine('Drafting the plan\u2026');
    act(() => {
      report?.('Wrote 1 command\u2026');
    });
    await currentLine('Wrote 1 command\u2026');

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
});

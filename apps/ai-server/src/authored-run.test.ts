import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { createAuthoredRunCoordinator, type AuthoredRunRequest } from './authored-run';
import { createAgentCaches } from './context-cache';
import { MODEL_POLICY_VERSION, type ModelRouter } from './model-policy';
import { createUsageLedger } from './usage';

const router: ModelRouter = {
  version: MODEL_POLICY_VERSION,
  models: [],
  select: (role) => ({
    policyVersion: MODEL_POLICY_VERSION,
    role,
    provider: 'openai',
    model: role === 'escalation' ? 'gpt-6-astra' : 'gpt-5.6-terra',
    effort: role === 'escalation' ? 'high' : 'medium',
    fallback: null,
    probeCheckedAt: 1,
  }),
};

function request(overrides: Partial<AuthoredRunRequest> = {}): AuthoredRunRequest {
  return {
    version: 1,
    mode: 'auto',
    runId: 'run',
    projectId: 'project',
    sourceRevision: 'r1',
    designContract: { tone: 'editorial' },
    projectIndex: { pages: ['home'] },
    units: [
      {
        unitId: 'hero',
        role: 'code',
        filePaths: ['pages/hero.tsx'],
        prompt: 'Create the hero.',
        relevantContext: { imports: [] },
      },
    ],
    ...overrides,
  };
}

function clientWith(
  answer: unknown,
  capture?: (params: Record<string, unknown>) => void,
): Anthropic {
  return {
    messages: {
      stream: (params: Record<string, unknown>) => {
        capture?.(params);
        return {
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: JSON.stringify(answer) }],
              usage: {
                input_tokens: 100,
                output_tokens: 50,
                cache_read_input_tokens: 80,
                cache_creation_input_tokens: 20,
                cost_usd: 0.01,
              },
            }),
        };
      },
    },
  } as unknown as Anthropic;
}

describe('authored run coordinator', () => {
  it('streams complete source units using a stable cached prefix and volatile file context', async () => {
    let sent: Record<string, unknown> | undefined;
    const caches = createAgentCaches();
    const ledger = createUsageLedger();
    const coordinator = createAuthoredRunCoordinator({
      client: clientWith(
        {
          summary: 'Built hero',
          changes: [
            {
              path: 'pages/hero.tsx',
              language: 'tsx',
              source: 'export default function Hero(){return <main>Hero</main>}',
            },
          ],
        },
        (params) => {
          sent = params;
        },
      ),
      modelRouter: router,
      promptCache: caches.prompt,
      usage: ledger,
    });
    const events: string[] = [];
    const result = await coordinator.run(request(), {
      onUnit: (unit) => events.push(unit.unitId),
    });

    expect(result.units[0]).toMatchObject({
      status: 'completed',
      output: { model: 'gpt-5.6-terra', changes: [{ path: 'pages/hero.tsx' }] },
    });
    expect(events).toEqual(['hero']);
    expect(sent?.['system']).toEqual([
      expect.objectContaining({ cache_control: { type: 'ephemeral', ttl: '1h' } }),
    ]);
    expect(JSON.stringify(sent?.['messages'])).toContain('sourceRevision');
    const system = JSON.stringify(sent?.['system']);
    expect(system).toContain('websites, dashboards, tools and multi-step Frontend flows');
    expect(system).toContain('tabs switch content');
    expect(system).toContain('Never imply authentication');
    expect(system).toContain('embla-carousel-react');
    expect(system).toContain('only inside allowedPaths');
    expect(system).toContain('@base-ui/react/direction-provider');
    expect(system).toContain('Controls are unstyled');
    expect(system).toContain('No other Base UI subpath is admitted');
    expect(caches.prompt.metrics()).toMatchObject({ cacheReadTokens: 80, cacheWriteTokens: 20 });
    expect(ledger.summary()).toMatchObject({
      attempts: 1,
      acceptedOutputs: 1,
      totalCostUsd: 0.01,
      acceptedOutputCostUsd: 0.01,
    });
  });

  it('never returns a write outside the unit ownership', async () => {
    const coordinator = createAuthoredRunCoordinator({
      client: clientWith({
        summary: 'Bad',
        changes: [{ path: 'shared/secret.ts', language: 'ts', source: 'export {}' }],
      }),
      modelRouter: router,
    });
    const result = await coordinator.run(request());

    expect(result.units[0]).toMatchObject({ status: 'failed', attempts: 4 });
    expect(result.units[0]?.reason).toContain('unowned path');
  });

  it('records failed provider attempts with unknown usage instead of dropping or zeroing them', async () => {
    const ledger = createUsageLedger();
    const coordinator = createAuthoredRunCoordinator({
      client: {
        messages: {
          stream: () => ({
            on: () => undefined,
            finalMessage: () => Promise.reject(new Error('provider unavailable')),
          }),
        },
      } as unknown as Anthropic,
      modelRouter: router,
      usage: ledger,
    });

    const result = await coordinator.run(request());
    expect(result.units[0]).toMatchObject({ status: 'failed', attempts: 4 });
    expect(ledger.summary()).toMatchObject({
      attempts: 4,
      failedAttempts: 4,
      inputTokens: null,
      totalCostUsd: null,
    });
  });

  it('refuses overlapping writers before calling the provider', async () => {
    const stream = vi.fn();
    const coordinator = createAuthoredRunCoordinator({
      client: { messages: { stream } } as unknown as Anthropic,
      modelRouter: router,
    });
    await expect(
      coordinator.run(
        request({
          units: [
            request().units[0]!,
            {
              unitId: 'other',
              role: 'copy',
              filePaths: ['pages/hero.tsx'],
              prompt: 'Rewrite.',
              relevantContext: {},
            },
          ],
        }),
      ),
    ).rejects.toThrow('two writers');
    expect(stream).not.toHaveBeenCalled();
  });

  it('keeps Ask and Plan read-only while returning useful provider summaries', async () => {
    let sent: Record<string, unknown> | undefined;
    const coordinator = createAuthoredRunCoordinator({
      client: clientWith({ summary: 'The hero hierarchy is clear.', changes: [] }, (params) => {
        sent = params;
      }),
      modelRouter: router,
    });
    const result = await coordinator.run(
      request({
        mode: 'ask',
        units: [
          {
            unitId: 'explain',
            role: 'context',
            filePaths: [],
            prompt: 'Explain this hero.',
            relevantContext: {},
          },
        ],
      }),
    );
    expect(result).toMatchObject({
      mode: 'ask',
      units: [
        { status: 'completed', output: { summary: 'The hero hierarchy is clear.', changes: [] } },
      ],
    });
    expect(JSON.stringify(sent?.['messages'])).toContain(
      'Do not create a build plan or source changes',
    );
  });

  it('rejects a read-only mode with file ownership before calling the provider', async () => {
    const stream = vi.fn();
    const coordinator = createAuthoredRunCoordinator({
      client: { messages: { stream } } as unknown as Anthropic,
      modelRouter: router,
    });

    await expect(coordinator.run(request({ mode: 'plan' }))).rejects.toThrow(
      'did not match version 1',
    );
    expect(stream).not.toHaveBeenCalled();
  });
});

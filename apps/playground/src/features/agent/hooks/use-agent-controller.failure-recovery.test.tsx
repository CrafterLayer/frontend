import { act, renderHook, waitFor } from '@testing-library/react';
import { AiProviderError, type AiAgentEvent, type AiPlanProvider } from '@craftkit/builder';
import { describe, expect, it, vi } from 'vitest';

import { createEditKernel, memoryStorage } from '../testing/scripted-engine';
import { useAgentController } from './use-agent-controller';

describe('sequential request recovery', () => {
  it.each(['en', 'ar'] as const)(
    'offers retry after invalid output and accepts a distinct next prompt (%s)',
    async (locale) => {
      const kernel = createEditKernel();
      kernel.setSelection(['selected-hero']);
      const before = kernel.getDocument();
      const events: AiAgentEvent[] = [];
      const signals: (AbortSignal | undefined)[] = [];
      const invalidOutput = () =>
        new AiProviderError('The assistant answer was not valid JSON.', {
          code: 'invalid-output',
          retryable: true,
        });
      const propose = vi.fn<AiPlanProvider['propose']>((_request, _context, live) => {
        signals.push(live?.signal);
        if (propose.mock.calls.length === 1) return Promise.reject(invalidOutput());
        return Promise.resolve({
          rationale: 'Rewrite the existing opening.',
          commands: [
            {
              command: 'setProp',
              args: { id: 'selected-hero', key: 'heading', value: 'A confident welcome' },
            },
          ],
        });
      });
      const repair = vi.fn<NonNullable<AiPlanProvider['repair']>>(
        (_request, _context, _plan, _issues, live) => {
          signals.push(live?.signal);
          return Promise.reject(invalidOutput());
        },
      );
      const storage = memoryStorage();
      const hook = renderHook(() =>
        useAgentController({
          kernel,
          locale,
          provider: { propose, repair },
          enhancer: null,
          storage,
          onAgentEvent: (event) => events.push(event),
        }),
      );
      const send = (text: string): void => {
        act(() => {
          hook.result.current.setDraft(text);
          hook.result.current.send();
        });
      };

      send('Rewrite the opening so it feels more welcoming');
      await waitFor(() => {
        expect(hook.result.current.state.run).toBeNull();
        expect(hook.result.current.state.turns.at(-1)?.kind).toBe('error');
      });
      const failed = hook.result.current.state.turns.at(-1);
      expect(failed?.kind === 'error' && failed.view.failure).toBe('invalid');
      expect(failed?.kind === 'error' && failed.view.retryable).toBe(true);
      expect(kernel.getDocument()).toBe(before);
      expect(propose).toHaveBeenCalledOnce();
      expect(repair).toHaveBeenCalledOnce();
      const firstSignal = signals[0];
      expect(firstSignal).toBeInstanceOf(AbortSignal);

      send('Rewrite the opening with a more confident tone');
      await waitFor(() => {
        expect(hook.result.current.state.run).toBeNull();
        expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe(
          'A confident welcome',
        );
      });
      expect(propose).toHaveBeenCalledTimes(2);
      expect(repair).toHaveBeenCalledOnce();
      expect(signals[2]).toBeInstanceOf(AbortSignal);
      expect(signals[2]).not.toBe(firstSignal);
      expect(signals[2]?.aborted).toBe(false);
      expect(hook.result.current.state.queue).toBeNull();
      expect(hook.result.current.state.turns.at(-1)).toMatchObject({
        kind: 'edit',
        view: { phase: 'done' },
      });
      expect(
        hook.result.current.state.turns.some(
          (turn) =>
            (turn.kind === 'edit' && turn.view.phase === 'stopped') ||
            (turn.kind === 'end' && turn.view.key === 'stoppedBeforeChange'),
        ),
      ).toBe(false);
      expect(events.some((event) => event.type === 'run.cancelled')).toBe(false);
      expect(events.filter((event) => event.type === 'run.failed')).toHaveLength(1);
      expect(events.filter((event) => event.type === 'run.completed')).toHaveLength(1);
      hook.unmount();
    },
  );
});

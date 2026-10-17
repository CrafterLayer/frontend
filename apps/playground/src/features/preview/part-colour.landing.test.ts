import { describe, expect, it, vi } from 'vitest';

import { AiNeedsInputError, runAiAgent, tryDirectTool, type AiPlanProvider } from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import { createPlaygroundKernel } from './create-playground-kernel';

/*
  block-parts fix pass (2026-10-06): on the REAL landing page the hero sits
  inside an aurora background, so the composed outline never named it and
  «غيّر لون العنوان في الهيرو …» went to the model. Section words now resolve
  against registered blocks too: the blue request is a zero-token part.style,
  and the red one asks first (no theme role carries red) — for 0 tokens.
*/

function silentProvider() {
  const propose = vi.fn<AiPlanProvider['propose']>(() => Promise.reject(new Error('the model was called')));
  return { provider: { propose } as AiPlanProvider, propose };
}

describe('part colour on the landing fixture', () => {
  it.each([
    ['غيّر لون العنوان في الهيرو للأزرق', 'تلوين «العنوان» بلون التمييز'],
    ['make the hero heading blue', 'Colour the Hero heading with the accent colour'],
  ])('reads «%s» as the hero heading’s part style, with no model', (request, label) => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const direct = tryDirectTool(request, kernel);
    expect(direct?.label).toBe(label);
    expect(direct?.plan.commands).toEqual([
      expect.objectContaining({
        command: 'setProp',
        args: { id: 'hero', key: 'partStyles', value: { heading: { className: 'text-accent' } } },
      }),
    ]);
  });

  it('asks before colouring the hero heading red, and the model is never called', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const { provider, propose } = silentProvider();
    const error: unknown = await runAiAgent({
      runId: 'hero-red',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'غيّر لون العنوان في الهيرو إلى أحمر',
      apply: 'auto',
      validationPorts: { clock: fixedClock(2), ids: seededIds('hero-red') },
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiNeedsInputError);
    expect(error instanceof Error ? error.message : '').toContain('حوّل إلى قابل للتعديل');
    expect(propose).not.toHaveBeenCalled();
    expect(kernel.transactions()).toHaveLength(0);
  });
});

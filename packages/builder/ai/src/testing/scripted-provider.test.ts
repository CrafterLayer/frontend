import { describe, expect, it } from 'vitest';

import type { AssembledAiContext } from '../types';
import { createScriptedAiPlanProvider } from './scripted-provider';

describe('scripted AI provider test helper', () => {
  it('returns the exact scripted plan regardless of request text', async () => {
    const plan = {
      rationale: 'Scripted.',
      commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
    } as const;
    const context = {} as AssembledAiContext;
    const provider = createScriptedAiPlanProvider(plan);
    await expect(provider.propose('anything', context)).resolves.toBe(plan);
  });
});

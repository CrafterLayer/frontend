import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder-core/testing';

import { BUILDER_AI_CONTEXT_PROVIDERS, assembleAiContext } from './assemble-context';
import { createMemoryContextProvider } from './memory-provider';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(0), ids: seededIds('memory') },
  });
}

describe('createMemoryContextProvider', () => {
  it('injects the host-loaded notes as one titled fragment the provider can read', () => {
    const memory = createMemoryContextProvider({
      load: () => ['Applied: added a pricing section.', 'Preference: dark tone.'],
    });

    const context = assembleAiContext(kernel().context, {
      providers: [...BUILDER_AI_CONTEXT_PROVIDERS, memory],
    });

    const fragment = context.fragments.find((f) => f.title === 'Session memory');
    expect(fragment?.body).toContain('added a pricing section');
    expect(fragment?.body).toContain('dark tone');
    expect(fragment?.tokens).toBeGreaterThan(0);
  });

  it('says so plainly when there is nothing remembered yet', () => {
    const memory = createMemoryContextProvider({ load: () => [] });

    const context = assembleAiContext(kernel().context, { providers: [memory] });

    expect(context.fragments[0]?.body).toContain('Nothing recorded yet');
  });
});

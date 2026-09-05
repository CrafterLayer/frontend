import type { JsonValue } from '@craftkit/builder-schema';
import { describe, expect, it, vi } from 'vitest';

import type { AiBlockContext, AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { createDirectPlanProvider, type DirectAiPlanCatalogEntry } from './direct-provider';
import { isAiProviderError } from './errors';

function block(
  type: string,
  examples: readonly { prompt: string; node: JsonValue }[],
  extra: Partial<AiBlockContext> = {},
): AiBlockContext {
  return { type, description: `A ${type}.`, examples, ...extra };
}

/**
 * The catalog the HOST derived its suggestions from — the provider's only
 * source of examples, and deliberately not read off the context, which carries
 * them in `full` mode alone.
 */
const catalogOf =
  (...blocks: readonly AiBlockContext[]) =>
  (): readonly DirectAiPlanCatalogEntry[] =>
    blocks.map(({ type, examples }) => ({ type, examples: examples ?? [] }));

function contextWith(blocks: readonly AiBlockContext[]): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks,
    document: {
      schemaVersion: 1,
      surface: 'light',
      dir: 'rtl',
      rootId: 'root',
      nodes: [{ id: 'root', type: 'page', props: {}, slots: {} }],
    },
    selection: { ids: [] },
  };
}

const HERO = block('hero', [
  { prompt: 'a hero for a coffee shop', node: { type: 'hero', props: { title: 'قهوة' } } },
]);

const context = contextWith([HERO]);
const catalog = catalogOf(HERO);

describe('createDirectPlanProvider', () => {
  it('answers a catalog prompt with one insertNode, into the document root', async () => {
    const plan = await createDirectPlanProvider({ catalog }).propose(
      'a hero for a coffee shop',
      context,
    );
    expect(plan.commands).toEqual([
      {
        command: 'insertNode',
        args: { type: 'hero', parentId: 'root', props: { title: 'قهوة' } },
        title: 'Add a hero',
      },
    ]);
  });

  it('names the CATALOG in its rationale, not a judgement nobody made', async () => {
    const plan = await createDirectPlanProvider({ catalog }).propose(
      'a hero for a coffee shop',
      context,
    );
    expect(plan.rationale).toBe('Insert the catalog’s “hero” example.');
  });

  it('matches past case, padding and inner whitespace', async () => {
    const provider = createDirectPlanProvider({ catalog });
    for (const request of [
      'A Hero For A Coffee Shop',
      '  a hero for a coffee shop  ',
      'a hero  for a coffee shop',
    ]) {
      await expect(provider.propose(request, context)).resolves.toMatchObject({
        commands: [{ command: 'insertNode' }],
      });
    }
  });

  it('refuses a NEAR miss rather than serving a fast wrong answer', async () => {
    await expect(
      createDirectPlanProvider({ catalog }).propose('a hero for a tea shop', context),
    ).rejects.toSatisfy((error: unknown) => isAiProviderError(error) && !error.retryable);
  });

  it('refuses a request that is only PART of a catalog prompt', async () => {
    /*
      "a hero" is a substring of "a hero for a coffee shop" and means something
      broader. Answering it from the catalog would silently decide which hero —
      the coffee-shop one — on a person who did not say. That decision belongs
      to a model that can weigh it, or to the person.
    */
    await expect(
      createDirectPlanProvider({ catalog }).propose('a hero', context),
    ).rejects.toThrow();
  });

  it('refuses a request that merely CONTAINS a catalog prompt', async () => {
    await expect(
      createDirectPlanProvider({ catalog }).propose(
        'a hero for a coffee shop, then pricing below it',
        context,
      ),
    ).rejects.toThrow();
  });

  it('carries an example with no props through as an insert with no props', async () => {
    const spacer = block('spacer', [{ prompt: 'a spacer', node: { type: 'spacer' } }]);
    const plan = await createDirectPlanProvider({ catalog: catalogOf(spacer) }).propose(
      'a spacer',
      contextWith([spacer]),
    );
    expect(plan.commands[0]?.args).toEqual({ type: 'spacer', parentId: 'root' });
  });

  it('reads the CATALOG, not the context — a trimmed context still answers', async () => {
    /*
      `AssembledAiContext` carries examples only in `full` mode. A provider that
      read them from there would answer a chip on one run and silently stop on
      the next, purely because the context mode changed.
    */
    const trimmed = contextWith([{ type: 'hero', description: 'An opening section.' }]);
    await expect(
      createDirectPlanProvider({ catalog }).propose('a hero for a coffee shop', trimmed),
    ).resolves.toMatchObject({ commands: [{ command: 'insertNode' }] });
  });

  it('never answers with the page’s own root type — it cannot go inside itself', async () => {
    const pageBlock = block('page', [{ prompt: 'a page', node: { type: 'page' } }]);
    await expect(
      createDirectPlanProvider({ catalog: catalogOf(pageBlock) }).propose(
        'a page',
        contextWith([pageBlock]),
      ),
    ).rejects.toThrow();
  });

  it('still answers for a block ALREADY on the page', async () => {
    /*
      A context in `none` or `scoped` mode marks a block present without a
      schema as `insertable: false` — which says the MODEL cannot author one,
      not that the door would refuse it. Honouring that flag meant a chip
      stopped working the moment its block appeared on the page, which is
      exactly when a person is most likely to want another.
    */
    const present = block('hero', [], { insertable: false });
    await expect(
      createDirectPlanProvider({ catalog }).propose(
        'a hero for a coffee shop',
        contextWith([present]),
      ),
    ).resolves.toMatchObject({ commands: [{ command: 'insertNode' }] });
  });

  it('leaves an example describing a SUBTREE to the model', async () => {
    const section = block('section', [
      { prompt: 'a section', node: { type: 'section', slots: { children: ['x'] } } },
    ]);
    await expect(
      createDirectPlanProvider({ catalog: catalogOf(section) }).propose(
        'a section',
        contextWith([section]),
      ),
    ).rejects.toThrow();
  });

  it('reads the root from the CONTEXT, so a different document inserts elsewhere', async () => {
    const other: AssembledAiContext = {
      ...context,
      document: { ...context.document, rootId: 'page-2' },
    };
    const plan = await createDirectPlanProvider({ catalog }).propose(
      'a hero for a coffee shop',
      other,
    );
    expect(plan.commands[0]?.args).toMatchObject({ parentId: 'page-2' });
  });

  describe('with a fallback', () => {
    const written: AiPlan = { rationale: 'from the model', commands: [] };
    /*
      `propose` is written as a PROPERTY, not a method: the provider is passed
      around as a value and the lint rule is right to insist that a method
      separated from its object carries no `this`. The real providers are built
      the same way.
    */
    /*
      The spy is kept as its OWN handle rather than read back off the provider.
      `fallback.propose` is an unbound method reference — the lint is right that
      passing one around loses `this` — and the assertions want the spy itself.
    */
    function fallbackOf() {
      const propose = vi.fn<AiPlanProvider['propose']>().mockResolvedValue(written);
      return { propose, provider: { propose } satisfies AiPlanProvider };
    }

    it('never reaches it for a request the catalog answers', async () => {
      const { propose, provider: fallback } = fallbackOf();
      await createDirectPlanProvider({ catalog, fallback }).propose(
        'a hero for a coffee shop',
        context,
      );
      expect(propose).not.toHaveBeenCalled();
    });

    it('hands an unmatched request over untouched, with its options', async () => {
      const { propose, provider: fallback } = fallbackOf();
      const options = { signal: new AbortController().signal };
      await createDirectPlanProvider({ catalog, fallback }).propose(
        'build me a shop',
        context,
        options,
      );
      expect(propose).toHaveBeenCalledExactlyOnceWith('build me a shop', context, options);
    });

    it('keeps the fallback’s own repair — a plan it wrote is a plan it can fix', async () => {
      const repair = vi.fn<NonNullable<AiPlanProvider['repair']>>().mockResolvedValue(written);
      const provider = createDirectPlanProvider({
        catalog,
        fallback: {
          propose: vi.fn<AiPlanProvider['propose']>().mockResolvedValue(written),
          repair,
        },
      });
      await provider.repair?.('r', context, written, []);
      expect(repair).toHaveBeenCalledOnce();
    });

    it('offers no repair of its own — it copies, it does not compose', () => {
      // `in`, not a reference to the method: reading it off the object is the
      // unbound-method mistake the assertion does not need to make.
      expect('repair' in createDirectPlanProvider({ catalog })).toBe(false);
    });
  });
});

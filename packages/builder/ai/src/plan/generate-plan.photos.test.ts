import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import {
  createPhotoCatalogContextProvider,
  PHOTO_CATALOG_FRAGMENT_TITLE,
  PHOTO_CATALOG_PROVIDER_ID,
} from '../context';
import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { generateAiPlan } from './generate-plan';
import { outlineAiPlan } from './outline-plan';

/*
  Wave 1 (2026-09-28) shipped craftkit.photo-direction — "an image address
  comes only from PHOTOS YOU MAY USE" — and the catalog provider that writes
  that list, and nothing joined them: the verifier found no caller of
  `createPhotoCatalogContextProvider` in the tree, so a run that loaded the
  skill was told to use a list that never arrived, and a page lost its photos.
  A run whose skills READ the list now gets the list.
*/

const goodPlan: AiPlan = {
  rationale: 'Add supporting copy to the existing section.',
  commands: [
    {
      command: 'insertNode',
      args: { type: 'text', props: { content: 'Generated copy' }, parentId: 'sec1' },
    },
  ],
};

function planKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('live') },
  });
}

function capturing() {
  const contexts: AssembledAiContext[] = [];
  const provider: AiPlanProvider = {
    propose(_request, context) {
      contexts.push(context);
      return Promise.resolve(goodPlan);
    },
  };
  return { provider, contexts };
}

function photoFragments(context: AssembledAiContext | undefined) {
  return (context?.fragments ?? []).filter(({ title }) => title === PHOTO_CATALOG_FRAGMENT_TITLE);
}

function photosIn(
  context: AssembledAiContext | undefined,
): readonly { url: string; subject: string }[] {
  const body = photoFragments(context)[0]?.body;
  if (body === undefined) return [];
  return (JSON.parse(body) as { photos: { url: string; subject: string }[] }).photos;
}

const CAFE = 'Build a landing page for my specialty coffee roastery in Amman';

describe('generateAiPlan — a skill that reads the photo list gets the list', () => {
  it('adds the photo catalog, filtered by the request, when photo-direction is active', async () => {
    const { provider, contexts } = capturing();
    await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: CAFE,
      validationPorts: { clock: fixedClock(20), ids: seededIds('photos') },
      skillRegistry: createCraftkitAiSkillRegistry(),
      selectedSkillIds: ['craftkit.photo-direction'],
    });

    expect(photoFragments(contexts[0])).toHaveLength(1);
    expect(photoFragments(contexts[0])[0]?.source).toBe(PHOTO_CATALOG_PROVIDER_ID);
    // Filtered by the brief: a coffee request is offered coffee photos, not the catalog.
    expect(photosIn(contexts[0]).length).toBeGreaterThan(0);
    expect(photosIn(contexts[0]).length).toBeLessThanOrEqual(12);
  });

  it('adds it for a whole-page archetype that promises photos from the list (page-composition)', async () => {
    const { provider, contexts } = capturing();
    const registry = createCraftkitAiSkillRegistry();
    const prepared = registry.prepare({ request: CAFE });
    const readers = prepared.active.filter(({ instructions }) =>
      instructions.includes(PHOTO_CATALOG_FRAGMENT_TITLE),
    );
    // The premise: this request auto-activates a page archetype that names the list.
    expect(readers.length).toBeGreaterThan(0);

    await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: CAFE,
      validationPorts: { clock: fixedClock(20), ids: seededIds('photos') },
      skillRegistry: registry,
    });

    expect(photoFragments(contexts[0])).toHaveLength(1);
  });

  it('adds nothing to a run whose skills never mention the list', async () => {
    const { provider, contexts } = capturing();
    await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'make the hero title bigger',
      validationPorts: { clock: fixedClock(20), ids: seededIds('photos') },
    });

    expect(photoFragments(contexts[0])).toHaveLength(0);
  });

  it('keeps a caller’s own photo provider, and never registers a second one', async () => {
    const { provider, contexts } = capturing();
    await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: CAFE,
      validationPorts: { clock: fixedClock(20), ids: seededIds('photos') },
      skillRegistry: createCraftkitAiSkillRegistry(),
      selectedSkillIds: ['craftkit.photo-direction'],
      // A section writer's brief, narrower than the request: this one must win.
      additionalContextProviders: [createPhotoCatalogContextProvider({ brief: 'barber shop' })],
    });

    expect(photoFragments(contexts[0])).toHaveLength(1);
    const photos = photosIn(contexts[0]);
    expect(photos.length).toBeGreaterThan(0);
    expect(photos.every(({ subject }) => subject === 'barber')).toBe(true);
  });

  it('leaves an outline without photos: a plan in prose shows none', async () => {
    const { provider, contexts } = capturing();
    const outlineProvider: AiPlanProvider = {
      propose(request, context, live) {
        void provider.propose(request, context, live);
        return Promise.resolve({ rationale: 'A plan.', commands: [] });
      },
    };
    await outlineAiPlan({
      kernel: planKernel(),
      provider: outlineProvider,
      request: CAFE,
      skillRegistry: createCraftkitAiSkillRegistry(),
      selectedSkillIds: ['craftkit.photo-direction'],
    });

    expect(photoFragments(contexts[0])).toHaveLength(0);
  });
});

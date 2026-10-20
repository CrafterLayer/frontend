import { describe, expect, it } from 'vitest';

import {
  creativeCreationKind,
  creativeCreationRequest,
  routeIntent,
} from '../../intent/route-intent';
import { createCraftkitAiSkillRegistry, requestSkillIdsFor } from '../index';

const registry = createCraftkitAiSkillRegistry();
const EMPTY = { nodeCount: 0, placeholderOnly: false, sectionLabels: [] };
const CREATION = [
  ['اصنع لعبه', 'game'],
  ['اصنع لعبة', 'game'],
  ['اصنع لعبة وخلي الألوان زرقاء', 'game'],
  ['صمم لي لعبة بسيطة', 'game'],
  ['سويلي لعبة بسيطة', 'game'],
  ['make a simple game', 'game'],
  ['build a game about a little rabbit', 'game'],
  ['Create a game and make the controls Arabic', 'game'],
  ['اصنع قصه', 'story'],
  ['اصنع قصة', 'story'],
  ['بدي قصة عن أرنب صغير', 'story'],
  ['اعمل لي قصة', 'story'],
  ['سويلي قصة', 'story'],
  ['اكتب قصة عن أرنب صغير', 'story'],
  ['Write a simple story about a fox', 'story'],
  ['create a simple story about a fox', 'story'],
  ['make a story and change the colors to blue', 'story'],
  ['اصنع جدارية', 'scene'],
] as const;
const PLAYBOOKS = {
  game: 'craftkit.pixi-games',
  story: 'craftkit.pixi-stories',
  scene: 'craftkit.pixi-murals',
};
const LANES = ['host', 'page-plan', 'section', 'edit'] as const;

describe('direct creative requests share routing and expertise', () => {
  it.each(CREATION)('recognizes the ordinary request %s', (request, kind) => {
    expect(creativeCreationKind(request)).toBe(kind);
    expect(creativeCreationRequest(request)).toBe(true);
    expect(routeIntent({ request, document: EMPTY })).toMatchObject({
      kind: 'build-page',
      confidence: 0.9,
      target: 'replace',
    });
    for (const lane of LANES) {
      expect(requestSkillIdsFor(registry, request, lane, { contractText: request })).toContain(
        PLAYBOOKS[kind],
      );
    }
    const active = registry.prepare({ request }).active.map(({ id }) => id);
    expect(active).toEqual(
      expect.arrayContaining([
        PLAYBOOKS[kind],
        'craftkit.pixi-v8-core',
        'craftkit.pixi-v8-graphics',
      ]),
    );
  });

  it.each([
    'Create a game website',
    'Create a simple game studio landing page',
    'Create an article about a game',
    'Write a company story',
    'Write a customer success story',
    'Add our story to the company about section',
    'ضيف قصتنا في قسم من نحن',
    'اصنع موقع عن لعبة',
    'اكتب قصة الشركة',
    'اكتب قصة نجاح العميل',
    'اصنع قصة نجاح لشركتي',
    'Create no game',
    'لا تصنع لعبة',
    'Make the game faster',
    'Make this story shorter',
    'خلي اللعبة أسرع',
    'خلي القصة أقصر',
    'How do I create a game?',
    'ما معنى قصة؟',
  ])('keeps questions, references and existing edits out of creation: %s', (request) => {
    expect(creativeCreationRequest(request)).toBe(false);
    expect(requestSkillIdsFor(registry, request, 'host')).not.toContain('craftkit.pixi-games');
    expect(requestSkillIdsFor(registry, request, 'host')).not.toContain('craftkit.pixi-stories');
  });

  it('preserves existing content and selected targets', () => {
    expect(
      routeIntent({
        request: 'اصنع لعبه',
        document: { ...EMPTY, nodeCount: 8 },
      }).kind,
    ).toBe('edit');
    expect(
      routeIntent({
        request: 'اصنع لعبه',
        document: EMPTY,
        selection: ['selected'],
      }).kind,
    ).toBe('edit');
  });

  it('keeps automatic expertise optional and within existing exclusion and token gates', () => {
    const id = PLAYBOOKS.story;
    for (const lane of LANES)
      expect(
        requestSkillIdsFor(registry, 'اصنع قصة', lane, {
          contractText: 'اصنع قصة',
          excluded: [id],
        }),
      ).not.toContain(id);
    expect(
      registry.prepare({ request: 'اصنع قصة', excludedSkillIds: [id] }).active.map((s) => s.id),
    ).not.toContain(id);
    expect(
      registry.prepare({ request: 'اصنع قصة', auto: false }).active.map((s) => s.id),
    ).not.toContain(id);
    const floor = registry.prepare({ request: '', auto: false }).totalTokens;
    const bounded = registry.prepare({ request: 'اصنع قصة', maxSkillTokens: floor });
    expect(bounded.totalTokens).toBeLessThanOrEqual(floor);
    expect(bounded.active.map((s) => s.id)).not.toContain(id);
  });
});

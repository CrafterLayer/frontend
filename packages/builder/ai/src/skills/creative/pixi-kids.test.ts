import { describe, expect, it } from 'vitest';

import { planCreativeBrief } from '../../creative/creative-planner';
import { createCraftkitAiSkillRegistry } from '../builtins';
import { PIXI_KIDS_ID } from './pixi-kids';
import { pixiSkillIdsFor } from './pixi-selection';

const registry = createCraftkitAiSkillRegistry();

describe("children's stories and drawings", () => {
  it.each(['Make a colouring book for kids with animals', 'بدي كتاب تلوين للأطفال'])(
    'a colouring book is a creative piece by itself: %s',
    (request) => {
      expect(pixiSkillIdsFor(registry, request)).toContain(PIXI_KIDS_ID);
    },
  );

  it.each([
    'An interactive story for kids about a panda who loves the zoo',
    'بدي قصة تفاعلية للأطفال عن حيوانات المزرعة',
  ])('joins a story told for children: %s', (request) => {
    const ids = pixiSkillIdsFor(registry, request);
    expect(ids).toContain('craftkit.pixi-stories');
    expect(ids).toContain(PIXI_KIDS_ID);
  });

  it.each(['Build a kids clothing store website', 'موقع لحضانة أطفال مع أسعار التسجيل'])(
    'never turns a business about children into a scene: %s',
    (request) => {
      expect(pixiSkillIdsFor(registry, request)).toEqual([]);
    },
  );

  it.each([
    'An interactive story about a shy little dragon called Zahra who loves stars',
    'بدي قصة تفاعلية عن تنين صغير خجول اسمه زهرة',
  ])('invents original characters for a fantasy story: %s', (request) => {
    expect(pixiSkillIdsFor(registry, request)).toContain(PIXI_KIDS_ID);
    expect(planCreativeBrief(request).libs).toEqual(
      expect.arrayContaining(['creatures', 'anim']),
    );
  });

  it("plans the kids' libraries a brief asks for", () => {
    const story = planCreativeBrief('An interactive story for kids about animals at the zoo');
    expect(story.libs).toEqual(expect.arrayContaining(['stickers', 'layout', 'animals']));
    const colouring = planCreativeBrief('بدي قصة تفاعلية فيها صفحة تلوين للأطفال');
    expect(colouring.libs).toEqual(expect.arrayContaining(['paint', 'stickers']));
  });
});

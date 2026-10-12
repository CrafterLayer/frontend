import { describe, expect, it } from 'vitest';

import { BROAD_GENRE_KEYWORDS, planCreativeBrief, specificGenreKeywords } from '../../creative';
import { GENRES } from '../../creative/creative-genres';
import { createCraftkitAiSkillRegistry } from '../index';
import { pixiSkillIdsFor } from './pixi-selection';

/*
  creative power (2026-10-12): the playbooks' activation words are derived from the planner's
  genres, so a request the planner reads as a picture book, a physics toy or a scroll mural also
  loads the playbook that teaches it — and the broad genre words a business page uses never do.
*/

const REGISTRY = createCraftkitAiSkillRegistry();
const PLAYBOOK = /^craftkit\.pixi-(?!v8-)/u;
const KIND_PLAYBOOK = {
  game: 'craftkit.pixi-games',
  story: 'craftkit.pixi-stories',
  scene: 'craftkit.pixi-murals',
} as const;

function activePlaybooks(request: string): readonly string[] {
  return REGISTRY.prepare({ request })
    .active.map(({ id }) => id)
    .filter((id) => PLAYBOOK.test(id));
}

describe('creative activation — genre words load their playbooks', () => {
  it.each([
    ['Write a bedtime story about a sleepy bunny', 'craftkit.pixi-stories'],
    ['A picture book about a brave little boat', 'craftkit.pixi-stories'],
    ['A fairy tale with a dragon who is afraid of the dark', 'craftkit.pixi-stories'],
    ['An illustrated storybook for my daughter', 'craftkit.pixi-stories'],
    ['A story for kids about the moon', 'craftkit.pixi-stories'],
    ['اكتب حكاية قبل النوم عن غيمة صغيرة', 'craftkit.pixi-stories'],
    ['بدي قصة قبل النوم لابني عن قطة', 'craftkit.pixi-stories'],
    ['قصة مصورة للأطفال عن سلحفاة', 'craftkit.pixi-stories'],
    ['حكاية خرافية عن تنين وأميرة', 'craftkit.pixi-stories'],
    ['بدي حكايات للأطفال عن الحيوانات', 'craftkit.pixi-stories'],
    ['A parallax scroll mural of a desert caravan at night', 'craftkit.pixi-scroll-murals'],
    ['A scrolling story through a forest, told in layers', 'craftkit.pixi-scroll-murals'],
    ['اعمل جدارية بالتمرير لمدينة قديمة', 'craftkit.pixi-scroll-murals'],
    ['مشهد بارالاكس لصحراء في الليل', 'craftkit.pixi-scroll-murals'],
    ['A physics game where crates stack and topple', 'craftkit.pixi-physics'],
    ['بدي لعبة فيزياء فيها مقلاع وصناديق', 'craftkit.pixi-physics'],
    ['An endless runner with a fox', 'craftkit.pixi-games'],
    ['A memory game with animal cards', 'craftkit.pixi-games'],
    ['لعبة سباق بين السلاحف', 'craftkit.pixi-games'],
  ])('%s → %s', (request, expected) => {
    expect(activePlaybooks(request)).toContain(expected);
    expect(pixiSkillIdsFor(REGISTRY, request)).toContain(expected);
  });

  it.each([
    'A story about a sleepy bunny for bedtime',
    'Tell a gentle tale about the stars before bed',
    'اكتب قصة عن أرنب صغير قبل النوم',
    'حكاية عن القمر وقت النوم',
  ])('reads a story asked for at bedtime in any word order: %s', (request) => {
    expect(pixiSkillIdsFor(REGISTRY, request)).toEqual(
      expect.arrayContaining(['craftkit.pixi-stories', 'craftkit.pixi-director']),
    );
  });

  it.each([
    ['A bedtime story with parallax layers of hills', 'craftkit.pixi-scroll-murals'],
    ['A platformer with physics crates', 'craftkit.pixi-physics'],
    ['قصة تفاعلية بالتمرير عن رحلة', 'craftkit.pixi-scroll-murals'],
  ])('brings a library playbook from a plain word inside a creative piece: %s', (request, id) => {
    expect(pixiSkillIdsFor(REGISTRY, request)).toContain(id);
  });
});

describe('creative activation — business pages stay refused', () => {
  it.each([
    'Add our story to the company about section',
    'Create a game store website',
    'Build a landing page for our game studio',
    'ضيف قصتنا في قسم من نحن',
    'حكايتنا مع عملائنا منذ ٢٠٠٥',
    'مطعم حكاية للمأكولات الشامية',
    'صفحة أذكار قبل النوم',
    'كريم ليلي يستخدم قبل النوم',
    'عروض خرافية على العطور',
    'Add a parallax effect to our agency hero',
    'A landing page for a physics tutor',
    'Rent a bounce house for kids parties',
    'A kids clothing store for children aged 2-8',
    'خدمات إدارة منصات التواصل الاجتماعي',
    'رحلات ومغامرات في وادي رم',
    'An escape room with puzzles for teams',
    'Our tech stack and engineering culture',
    'Add a dialogue box to the contact form',
  ])('%s', (request) => {
    expect(activePlaybooks(request)).toEqual([]);
    expect(pixiSkillIdsFor(REGISTRY, request)).toEqual([]);
  });
});

describe('creative activation — derived from the planner', () => {
  it('lists only broad words the planner actually reads', () => {
    const planned = new Set(GENRES.flatMap(({ keywords }) => keywords));
    expect(BROAD_GENRE_KEYWORDS.filter((word) => !planned.has(word))).toEqual([]);
  });

  it('activates no playbook from a broad genre word alone', () => {
    for (const word of BROAD_GENRE_KEYWORDS) {
      expect(activePlaybooks(word), word).toEqual([]);
      expect(pixiSkillIdsFor(REGISTRY, word), word).toEqual([]);
    }
  });

  it('activates its kind’s playbook from every specific genre keyword (property)', () => {
    for (const rule of GENRES) {
      for (const keyword of specificGenreKeywords(rule.kind).filter((word) =>
        rule.keywords.includes(word),
      )) {
        expect(activePlaybooks(keyword), keyword).toContain(KIND_PLAYBOOK[rule.kind]);
        expect(pixiSkillIdsFor(REGISTRY, keyword).length, keyword).toBeGreaterThan(0);
      }
    }
    expect(specificGenreKeywords().length).toBeGreaterThan(60);
  });

  it('plans every specific keyword as the genre that lists it first (the brief agrees)', () => {
    for (const keyword of specificGenreKeywords()) {
      const first = GENRES.find(({ keywords }) => keywords.includes(keyword));
      expect(planCreativeBrief(keyword).genre, keyword).toBe(first?.genre);
    }
  });
});

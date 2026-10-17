import { describe, expect, it } from 'vitest';

import { planCreativeBrief, renderCreativeBrief } from '../../creative';
import { createCraftkitAiSkillRegistry } from '../index';
import { CREATIVE_ENGINE_SKILLS } from './creative-engines';
import {
  CREATIVE_AUDIO_EXAMPLE,
  CREATIVE_GAMEAI_EXAMPLE,
  CREATIVE_HUD_EXAMPLE,
  GAME_ENGINE_SKILLS,
} from './game-engines';
import { pixiSkillIdsFor } from './pixi-selection';
import { pixiSkillExamples } from './pixi-v8';

const AUDIO = 'craftkit.pixi-audio';
const GAMEAI = 'craftkit.pixi-game-ai';
const HUD = 'craftkit.pixi-hud';
const GAME_IDS = [AUDIO, GAMEAI, HUD];

function activeIds(request: string): readonly string[] {
  return createCraftkitAiSkillRegistry()
    .prepare({ request })
    .active.map(({ id }) => id);
}

describe('game library skills — activation', () => {
  it.each([
    ['A platformer with retro sound effects and game music', AUDIO],
    ['اعمل لعبة فيها مؤثرات صوتية وموسيقى اللعبة', AUDIO],
    ['A maze game where enemies chase the player, with pathfinding', GAMEAI],
    ['بدي لعبة متاهة فيها أعداء يطاردون اللاعب', GAMEAI],
    ['A space shooter with a health bar and a game HUD', HUD],
    ['لعبة فضاء فيها شريط الصحة وواجهة اللعبة', HUD],
  ])('activates %s', (request, expected) => {
    expect(activeIds(request)).toEqual(expect.arrayContaining(['craftkit.pixi-v8-core', expected]));
  });

  it.each([
    'Build a landing page for our music school',
    'صمم صفحة لاستوديو تسجيل صوتي مع حجز المواعيد',
    'A security company page about our night patrol services',
    'صفحة لشركة حراسة تقدم دوريات أمنية',
    'Add a health insurance pricing table',
    'صفحة لعيادة صحة الأسنان',
    'Write a blog post about car chase movies',
    'A real estate page listing HUD homes',
    'Create a game store website',
    'Our podcast studio: sound engineering and mixing services',
  ])('stays out of %s', (request) => {
    expect(activeIds(request).filter((id) => GAME_IDS.includes(id))).toEqual([]);
    expect(pixiSkillIdsFor(createCraftkitAiSkillRegistry(), request)).toEqual([]);
  });

  it('registers each skill once, data-only, with the core dependency and the opt-in rule', () => {
    expect(CREATIVE_ENGINE_SKILLS.filter(({ id }) => GAME_IDS.includes(id))).toHaveLength(3);
    for (const skill of GAME_ENGINE_SKILLS) {
      expect(skill.dependencies).toEqual(['craftkit.pixi-v8-core']);
      expect(skill.restrictToCommands).toBeUndefined();
      expect(skill.instructions).toMatch(/Free code OFF/u);
      expect(skill.activation?.mode).toBe('auto');
    }
  });
});

describe('game library skills — the creative selection lane', () => {
  const registry = createCraftkitAiSkillRegistry();

  it('brings game AI, HUD and audio when a game brief names enemies, health and music', () => {
    const ids = pixiSkillIdsFor(registry, 'بدي لعبة متاهة فيها أعداء وموسيقى ونقاط الصحة');
    expect(ids.slice(0, 3)).toEqual([
      'craftkit.pixi-games',
      'craftkit.pixi-tile-worlds',
      'craftkit.pixi-director',
    ]);
    expect(ids).toEqual(expect.arrayContaining([GAMEAI, AUDIO, HUD]));
    expect(ids.indexOf(GAMEAI)).toBeLessThan(ids.indexOf('craftkit.pixi-effects'));
  });

  it('adds none of them to a game that does not ask', () => {
    const ids = pixiSkillIdsFor(registry, 'A platformer level');
    expect(ids.filter((id) => GAME_IDS.includes(id))).toEqual([]);
  });

  it('fits a writer budget with the playbook and the director', () => {
    const ids = pixiSkillIdsFor(registry, 'A game where monsters chase you, with music');
    const prepared = registry.prepare({
      request: '',
      auto: false,
      selectedSkillIds: ids.slice(0, 4),
    });
    expect(prepared.omitted).toEqual([]);
    expect(prepared.totalTokens).toBeLessThan(12_000);
  });
});

describe('game library skills — the planner', () => {
  it('adds the game libraries, their mechanics and the sound check only when asked', () => {
    const brief = planCreativeBrief('A maze game where monsters chase you, with music and xp');
    expect(brief.libs).toEqual(expect.arrayContaining(['gameai', 'hud', 'audio']));
    const text = renderCreativeBrief(brief);
    expect(text).toContain('s.lib.gameai agents');
    expect(text).toContain('sound starts on a gesture');
    const plain = planCreativeBrief('An arcade game');
    expect(plain.libs.filter((lib) => ['gameai', 'hud', 'audio'].includes(lib))).toEqual([]);
    expect(renderCreativeBrief(plain)).not.toContain('sound starts');
    expect(planCreativeBrief('لعبة منصات فيها وحوش').libs).toContain('gameai');
  });
});

const AsyncFunction = (
  Object.getPrototypeOf(async function () {
    /* The plain JS scene-body contract. */
  }) as { constructor: new (name: string, body: string) => (ck: unknown) => Promise<unknown> }
).constructor;

describe('game library skills — examples are exact scene bodies', () => {
  const examples = [
    { id: AUDIO, code: CREATIVE_AUDIO_EXAMPLE, lib: 'audio' },
    { id: GAMEAI, code: CREATIVE_GAMEAI_EXAMPLE, lib: 'gameai' },
    { id: HUD, code: CREATIVE_HUD_EXAMPLE, lib: 'hud' },
  ];

  it.each(examples)('$id compiles, loads what it uses and disposes', ({ code, lib }) => {
    expect(() => new AsyncFunction('ck', code)).not.toThrow();
    const libs = /ck\.scene\(\{[^}]*libs:\[([^\]]*)\]/u.exec(code)?.[1] ?? '';
    expect(libs).toContain(`'${lib}'`);
    for (const used of code.matchAll(/s\.lib\.([a-z]+)/gu))
      expect(libs).toContain(`'${used[1] ?? ''}'`);
    expect(code).toContain('s.dispose(');
    expect(code).not.toMatch(
      /new P(?:IXI)?\.Application|\bimport\s*\(|https?:\/\/|window\.add|document\.add|\bzzfx\s*\(/u,
    );
  });

  it.each(examples)('$id teaches exactly its exported example', ({ id, code }) => {
    const skill = GAME_ENGINE_SKILLS.find((candidate) => candidate.id === id);
    expect(skill).toBeDefined();
    if (skill !== undefined)
      expect(pixiSkillExamples(skill)).toEqual([code.replace(/\n\s*/gu, ' ')]);
  });

  it('never invents a music URL: the track comes from ck.params', () => {
    expect(CREATIVE_AUDIO_EXAMPLE).toContain("ck.params({music:''})");
    expect(CREATIVE_AUDIO_EXAMPLE).toContain('if(p.music)audio.music.play(p.music');
  });
});

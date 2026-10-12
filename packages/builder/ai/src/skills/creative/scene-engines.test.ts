import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from '../index';
import { CREATIVE_ENGINE_SKILLS } from './creative-engines';
import { pixiSkillExamples } from './pixi-v8';
import {
  CREATIVE_PHYSICS_CONTROLS,
  CREATIVE_PHYSICS_EXAMPLE,
  CREATIVE_SCROLL_MURAL_EXAMPLE,
  SCENE_ENGINE_SKILLS,
} from './scene-engines';

/*
  creative power (2026-10-12): the physics and scroll-mural playbooks. The examples run for real
  in apps/evals (engines.browser.test.ts, CRAFTKIT_BROWSER_QA=1); here they are held to the
  scene-body contract, the budget every single playbook fits, and narrow activation.
*/

const PHYSICS = 'craftkit.pixi-physics';
const SCROLL = 'craftkit.pixi-scroll-murals';
const REGISTRY = createCraftkitAiSkillRegistry();

function activeIds(request: string): readonly string[] {
  return REGISTRY.prepare({ request }).active.map(({ id }) => id);
}

const AsyncFunction = (
  Object.getPrototypeOf(async function () {
    /* The plain JS scene-body contract. */
  }) as { constructor: new (name: string, body: string) => (ck: unknown) => Promise<unknown> }
).constructor;

describe('scene engine skills', () => {
  it('registers both through the creative engines, with the core dependency', () => {
    for (const skill of SCENE_ENGINE_SKILLS) {
      expect(CREATIVE_ENGINE_SKILLS).toContain(skill);
      expect(skill.dependencies).toEqual(['craftkit.pixi-v8-core']);
      expect(skill.restrictToCommands).toBeUndefined();
      expect(skill.instructions).toMatch(/Free code OFF/u);
      expect(skill.instructions).toContain('s.dispose');
    }
  });

  it.each([
    ['A physics game where you knock down a tower', PHYSICS],
    ['A physics playground with falling crates', PHYSICS],
    ['بدي لعبة فيزياء فيها كرات وصناديق', PHYSICS],
    ['A scroll mural of the Nile from source to sea', SCROLL],
    ['A parallax landscape that moves as you scroll', SCROLL],
    ['اعمل جدارية بالتمرير عن تاريخ المدينة', SCROLL],
  ])('activates %s', (request, id) => {
    expect(activeIds(request)).toEqual(expect.arrayContaining(['craftkit.pixi-v8-core', id]));
  });

  it.each([
    'A landing page for a physics tutor',
    'Add a parallax hero to our agency site',
    'Make the services section scroll smoothly',
    'صفحة لمدرس فيزياء',
  ])('stays out of %s', (request) => {
    expect(activeIds(request).filter((id) => id === PHYSICS || id === SCROLL)).toEqual([]);
  });

  it('fits each playbook, with the core and the floor, in the single-skill budget', () => {
    for (const skill of SCENE_ENGINE_SKILLS) {
      const prepared = REGISTRY.prepare({ request: '', auto: false, selectedSkillIds: [skill.id] });
      expect(prepared.omitted).toEqual([]);
      expect(prepared.totalTokens).toBeLessThan(2_800);
    }
  });

  it.each([
    { id: PHYSICS, code: CREATIVE_PHYSICS_EXAMPLE, libs: "libs:['physics']" },
    {
      id: SCROLL,
      code: CREATIVE_SCROLL_MURAL_EXAMPLE,
      libs: "libs:['brush','rough','emitter','viewport']",
    },
  ])('$id teaches exactly its exported scene body', ({ id, code, libs }) => {
    expect(() => new AsyncFunction('ck', code)).not.toThrow();
    expect(code).toContain(`ck.scene({seed:`);
    expect(code).toContain(libs);
    expect(code).toContain('s.dispose(');
    expect(code).not.toMatch(
      /new P(?:IXI)?\.Application|\bimport\s*\(|https?:\/\/|window\.add|document\.add|Runner\.run|Ticker\.shared|preventDefault/u,
    );
    const skill = SCENE_ENGINE_SKILLS.find((candidate) => candidate.id === id);
    expect(skill === undefined ? [] : pixiSkillExamples(skill)).toEqual([
      code.replace(/\n\s*/gu, ' '),
    ]);
  });

  it('steps Matter only in the fixed loop and settles still frames synchronously', () => {
    expect(CREATIVE_PHYSICS_EXAMPLE).toContain('s.fixedTick(dt=>{Engine.update(engine,dt*1000)');
    expect(CREATIVE_PHYSICS_EXAMPLE).toContain('Engine.update(engine,1000/60)');
    expect(CREATIVE_PHYSICS_EXAMPLE).toContain('s.dir');
    expect(CREATIVE_PHYSICS_CONTROLS).toContain('data-physics-status');
  });

  it('drives the mural from s.scroll, mirrors RTL and never adds input plugins', () => {
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).toContain('s.scroll.progress');
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).toContain('s.dir>0?p:1-p');
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).toContain('noTicker:true');
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).toContain('new P.ParticleContainer(');
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).not.toMatch(/\.(?:drag|wheel|pinch|decelerate)\(/u);
  });
});

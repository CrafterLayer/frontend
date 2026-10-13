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
    // The buttons' listeners end in s.dispose; world() ends its own engine, loop and drag.
    { id: PHYSICS, code: CREATIVE_PHYSICS_EXAMPLE, libs: "libs:['physics']", ends: 's.dispose(' },
    {
      id: SCROLL,
      code: CREATIVE_SCROLL_MURAL_EXAMPLE,
      libs: "libs:['brush','rough','emitter','viewport']",
      // particles and physics (2026-10-13): a spawned emitter, its container and texture end
      // with the scene, so the mural owns nothing it must release itself.
      ends: 's.lib.emitter.spawn(',
    },
  ])('$id teaches exactly its exported scene body', ({ id, code, libs, ends }) => {
    expect(() => new AsyncFunction('ck', code)).not.toThrow();
    expect(code).toContain(`ck.scene({seed:`);
    expect(code).toContain(libs);
    expect(code).toContain(ends);
    expect(code).not.toMatch(
      /new P(?:IXI)?\.Application|\bimport\s*\(|https?:\/\/|window\.add|document\.add|Runner\.run|Ticker\.shared|preventDefault/u,
    );
    const skill = SCENE_ENGINE_SKILLS.find((candidate) => candidate.id === id);
    expect(skill === undefined ? [] : pixiSkillExamples(skill)).toEqual([
      code.replace(/\n\s*/gu, ' '),
    ]);
  });

  // particles and physics (2026-10-13): s.lib.physics.world(s) owns the fixed-step loop, the
  // walls, the drag and the calm settling, so the example hand-writes none of them.
  it('builds the toy on s.lib.physics.world in design units, with no loop of its own', () => {
    expect(CREATIVE_PHYSICS_EXAMPLE).toContain('w=s.lib.physics.world(s)');
    expect(CREATIVE_PHYSICS_EXAMPLE).toContain('w.add(body,g)');
    expect(CREATIVE_PHYSICS_EXAMPLE).toContain("design:{width:800,height:450,align:'bottom'}");
    expect(CREATIVE_PHYSICS_EXAMPLE).not.toMatch(/Engine\.(?:create|update)|fixedTick|s\.tick/u);
    expect(CREATIVE_PHYSICS_EXAMPLE).toContain('s.dir');
    expect(CREATIVE_PHYSICS_CONTROLS).toContain('data-physics-status');
    const skill = SCENE_ENGINE_SKILLS.find((candidate) => candidate.id === PHYSICS);
    expect(skill?.instructions).toContain('settles synchronously');
  });

  // procedural maps and animated GIFs (2026-10-13): one line each, inside the same budget.
  it('teaches a seeded procgen maze for marble toys and only the person’s own GIF for murals', () => {
    const physics = SCENE_ENGINE_SKILLS.find((skill) => skill.id === PHYSICS)?.instructions ?? '';
    expect(physics).toContain("libs:['physics','procgen']");
    expect(physics).toContain('s.lib.procgen.maze(s,{width:21,height:13})');
    const mural = SCENE_ENGINE_SKILLS.find((skill) => skill.id === SCROLL)?.instructions ?? '';
    expect(mural).toContain('await s.lib.gif.load(s,url)');
    expect(mural).toContain('never invent a URL');
  });

  it('drives the mural from s.scroll, mirrors RTL and never adds input plugins', () => {
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).toContain('s.scroll.progress');
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).toContain('s.dir>0?p:1-p');
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).toContain('noTicker:true');
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).toContain("s.lib.emitter.spawn(s,'magic',{parent:vp,");
    expect(CREATIVE_SCROLL_MURAL_EXAMPLE).not.toMatch(/\.(?:drag|wheel|pinch|decelerate)\(/u);
  });
});

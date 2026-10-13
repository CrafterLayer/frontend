import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeJsMeta,
  customCodeJsParams,
  customCodeTree,
  customCss,
  customJs,
  defineBlockSchema,
  emptyCustomCodeTree,
  type CustomCodeNode,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { checkScene } from '../../../agent/page-plan/check-scene';
import { validateAiPlan } from '../../../plan/validate-plan';
import {
  PLAYBOOK_PRESET_IDS,
  SCENE_PRESET_CATEGORIES,
  SCENE_PRESETS,
  scenePreset,
  scenePresetsIn,
  type ScenePreset,
} from '../../../scene-presets/catalog';
import { treeCommandsFixture, treeOf } from '../../../style-tools/style-tools.fixtures';
import type { AiPlanValidationResult } from '../../../types';
import {
  agentToolsFixtureBlocks,
  fixtureDocument,
  fixtureKernel,
  toolPlan,
  type FixtureOptions,
} from '../agent-tools.fixtures';
import { agentToolPrompt } from '../catalog-prompt';
import { expandAgentTools } from '../expand';
import { agentTool, agentToolsForLane } from '../registry';
import {
  SCENE_HOST_CSS,
  SCENE_PRESET_PROMPT_CATEGORIES,
  SCENE_SECTION_CSS,
  scenePresetMenu,
  scenePresetTool,
} from './scene-preset';
import {
  PIXI_GAME_SKILL,
  PIXI_MURAL_SKILL,
  PIXI_STORY_SKILL,
} from '../../../skills/creative/pixi-creative';

/*
  scene.preset (creative-power Phase 2 F, 2026-10-12): a curated scene lands as ordinary kernel
  steps the REAL door accepts — with free code on — on a page whose customCode block declares
  `js`, `jsParams` and `jsMeta` as the product's does, and one plan is one Undo.
*/

interface Step {
  readonly command: string;
  readonly args: Record<string, unknown>;
  readonly title?: string;
}

const [pageBlock] = agentToolsFixtureBlocks.contributes?.blocks ?? [];
if (pageBlock === undefined) throw new Error('fixture: no page block');

/** The agent-tools page block, and a customCode block that carries page code like the product's. */
const sceneBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'scene-preset-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      pageBlock,
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region that may carry page code.',
          props: z.object({
            label: z.string().max(80).default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(24_000),
            js: customJs(),
            jsParams: customCodeJsParams(),
            jsMeta: customCodeJsMeta(),
          }),
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

function sceneKernel(options: FixtureOptions = {}): BuilderKernel {
  return createBuilder({
    document: fixtureDocument(options),
    extensions: [sceneBlocks, treeCommandsFixture],
    ports: { clock: fixedClock(1), ids: seededIds('scene-preset') },
  });
}

interface Door {
  readonly issues: readonly string[];
  readonly steps: readonly Step[];
  readonly result?: AiPlanValidationResult;
}

/** Expand one scene.preset step and judge it with the real door (free code on unless said). */
function door(kernel: BuilderKernel, input: unknown, freeCode = true): Door {
  const expanded = expandAgentTools(toolPlan('scene.preset', input), kernel);
  const steps = (expanded.plan as { commands?: Step[] }).commands ?? [];
  if (expanded.issues.length > 0)
    return { issues: expanded.issues.map(({ message }) => message), steps };
  const result = validateAiPlan(
    expanded.plan,
    kernel,
    { clock: fixedClock(2), ids: seededIds('scene-preset-door') },
    undefined,
    { freeCode },
  );
  return { issues: result.ok ? [] : result.issues.map(({ message }) => message), steps, result };
}

/** Land a door-valid plan the way applyAiPlan does: ONE group, one transaction. */
function land(kernel: BuilderKernel, input: unknown): Door {
  const judged = door(kernel, input);
  expect(judged.issues).toEqual([]);
  if (judged.result?.ok !== true) throw new Error('the door refused the plan');
  kernel.dispatchGroup(
    judged.result.plan.commands.map(({ command, args }) => ({ command, args })),
    { author: 'ai', label: judged.steps[0]?.title ?? 'scene' },
  );
  return judged;
}

function rootSlots(kernel: BuilderKernel): readonly string[] {
  const document = kernel.getDocument();
  return (
    (document.nodes[document.rootId]?.slots as { default?: string[] } | undefined)?.default ?? []
  );
}

function props(kernel: BuilderKernel, id: string): Record<string, unknown> {
  return kernel.getDocument().nodes[id]?.props ?? {};
}

function insertedProps(steps: readonly Step[]): Record<string, unknown> {
  const insert = steps.find(({ command }) => command === 'insertNode');
  return (insert?.args['props'] as Record<string, unknown> | undefined) ?? {};
}

function presetWith(test: (preset: ScenePreset) => boolean): ScenePreset {
  const found = SCENE_PRESETS.find(test);
  if (found === undefined) throw new Error('fixture: no such preset');
  return found;
}

const SILK = scenePreset('flow-field-silk') ?? presetWith(() => true);
const FIREFLY = scenePreset('firefly-garden') ?? presetWith(() => true);

describe('scene.preset — registered and catalogued', () => {
  it('is one tool on the section and edit lanes, defined within the catalog limits', () => {
    expect(agentTool('scene.preset')).toBe(scenePresetTool);
    expect(scenePresetTool.lanes).toEqual(['section', 'edit']);
    for (const lane of ['section', 'edit'] as const) {
      expect(agentToolsForLane(lane).map(({ name }) => name)).toContain('scene.preset');
    }
    for (const lane of ['build', 'seo'] as const) {
      expect(agentToolsForLane(lane).map(({ name }) => name)).not.toContain('scene.preset');
    }
    expect(scenePresetTool.signature.length).toBeLessThanOrEqual(120);
  });

  it('lists every backdrop preset id by category in both lanes, and keeps the section lane signatures', () => {
    expect(SCENE_PRESET_PROMPT_CATEGORIES).toEqual(
      SCENE_PRESET_CATEGORIES.filter((category) => category !== 'game' && category !== 'story'),
    );
    for (const lane of ['section', 'edit'] as const) {
      const prompt = agentToolPrompt(lane);
      expect(prompt).toContain(`scene.preset ${scenePresetTool.signature}`);
      for (const category of SCENE_PRESET_PROMPT_CATEGORIES) {
        const ids = scenePresetsIn(category)
          .filter(({ id }) => !PLAYBOOK_PRESET_IDS.has(id))
          .map(({ id }) => id);
        expect(prompt).toContain(`${category}:${ids.join('|')}`);
      }
      // The kits ride in the game and story playbooks, not in the cached lanes (+0 tokens there);
      // so do the set-D library murals, in the mural playbook.
      expect(prompt).not.toMatch(/\b(?:game|story):/u);
      for (const id of PLAYBOOK_PRESET_IDS) expect(prompt).not.toContain(id);
    }
    const section = agentToolPrompt('section');
    expect(section).toContain("kit.section {id,kit,slots,heading?:'h1'|'h2'}");
    expect(section).toContain('copy.set {edits:[{find,text}],id?}');
    expect(section).toContain('element.insert preset:feature-card');
  });
});

describe('scene.preset — a new scene section', () => {
  it.each(SCENE_PRESETS.map((preset): [string, ScenePreset] => [preset.id, preset]))(
    '%s passes the real door as ONE insertNode customCode carrying its code and meta',
    (_id, preset) => {
      const result = door(sceneKernel(), { preset: preset.id });
      expect(result.issues).toEqual([]);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]?.args).toMatchObject({
        type: 'customCode',
        parentId: 'root',
        index: 4,
      });
      const inserted = insertedProps(result.steps);
      expect(inserted['js']).toBe(preset.code);
      expect(inserted['jsMeta']).toEqual({
        ref: { tier: 'builtin', id: preset.id, version: preset.entry.version },
        name: preset.title,
        tags: preset.tags,
        params: preset.params,
        libs: preset.libs,
      });
      // All defaults: nothing differs, so no values are stored.
      expect(inserted).not.toHaveProperty('jsParams');
      expect(inserted['label']).toBe(preset.title.en);
    },
  );

  it.each(SCENE_PRESET_CATEGORIES.map((category) => [category]))(
    'lands a %s preset as one Undo, sized by its width and never by vh',
    (category) => {
      const preset = scenePresetsIn(category)[0];
      if (preset === undefined) throw new Error('fixture: empty category');
      const kernel = sceneKernel();
      const before = rootSlots(kernel);
      land(kernel, { preset: preset.id });
      expect(kernel.transactions()).toHaveLength(1);
      const added = rootSlots(kernel).filter((id) => !before.includes(id));
      expect(added).toHaveLength(1);
      const region = props(kernel, added[0] ?? '');
      expect(region['js']).toBe(preset.code);
      expect(String(region['css'])).not.toMatch(/\d\s*vh/u);
      const outer = treeOf(kernel, added[0] ?? '').children[0];
      if (preset.region === undefined) {
        expect(region['css']).toBe(SCENE_SECTION_CSS);
        expect(String(region['css'])).toMatch(/aspect-ratio:16\/9;min-height:320px/u);
        expect(outer?.kind === 'element' ? outer.attributes : undefined).toMatchObject({
          id: 'scene',
          'aria-hidden': 'true',
        });
      } else {
        // A kit lands as its own section: its words and controls, its css, an anchor named after it.
        expect(region['css']).toBe(preset.region.css);
        expect(outer?.kind === 'element' ? outer.attributes?.id : undefined).toMatch(
          new RegExp(`^${category}(?:-\\d+)?$`, 'u'),
        );
        expect(outer?.kind === 'element' ? outer.className : undefined).toMatch(/^ck-kit /u);
      }
      kernel.undo();
      expect(rootSlots(kernel)).toEqual(before);
    },
  );

  it('goes after a named section, labels itself in the page language, and refuses an unknown one', () => {
    const after = door(sceneKernel(), { preset: SILK.id, after: 'r-hero' });
    expect(after.issues).toEqual([]);
    expect(after.steps[0]?.args).toMatchObject({ index: 2 });
    const arabic = door(sceneKernel({ locale: 'ar' }), { preset: SILK.id });
    expect(arabic.issues).toEqual([]);
    expect(insertedProps(arabic.steps)['label']).toBe(SILK.title.ar);
    expect(door(sceneKernel(), { preset: SILK.id, after: 'r-nope' }).issues[0]).toMatch(
      /"after": no section "r-nope" on the page; use one of r-header, r-hero/u,
    );
  });
});

const KITS = SCENE_PRESETS.filter((preset) => preset.region !== undefined);

describe('scene.preset — game and story kits', () => {
  it('offers eight games and three stories, each a whole section in English and Arabic', () => {
    expect(scenePresetsIn('game').map(({ id }) => id)).toEqual([
      'arcade',
      'platformer',
      'runner',
      'breakout',
      'memory',
      'quiz',
      'snake',
      'catch',
    ]);
    expect(scenePresetsIn('story').map(({ id }) => id)).toEqual([
      'picture-book',
      'visual-novel',
      'scroll-story',
    ]);
    expect(KITS.map(({ category }) => category).every((c) => c === 'game' || c === 'story')).toBe(
      true,
    );
  });

  it.each(KITS.map((preset): [string, ScenePreset] => [preset.id, preset]))(
    '%s lands in the page language, and its code finds everything it needs in that section',
    (_id, preset) => {
      for (const locale of ['en', 'ar'] as const) {
        const kernel = sceneKernel({ locale });
        const before = rootSlots(kernel);
        const landed = land(kernel, { preset: preset.id });
        expect(landed.result?.ok).toBe(true);
        const id = rootSlots(kernel).find((slot) => !before.includes(slot)) ?? '';
        const region = props(kernel, id);
        const tree = JSON.stringify(region['tree']);
        // The section's words are the kit's, in this language (Arabic letters on an Arabic page).
        expect(/[\u0600-\u06ff]/u.test(tree)).toBe(locale === 'ar');
        const words = preset.region?.params?.[locale] ?? {};
        expect(region['jsParams'] ?? {}).toEqual(words);
        // The scene check reads the code against its landed section: nothing to repair.
        const issues = checkScene({
          tree: region['tree'],
          css: region['css'],
          js: region['js'],
          jsParams: region['jsParams'],
        } as Parameters<typeof checkScene>[0]);
        expect(issues.map(({ code, message }) => `${code}: ${message}`)).toEqual([]);
      }
    },
  );

  it('are named by the game and story playbooks and by every refusal of the tool', () => {
    const games = `game:${scenePresetsIn('game')
      .map(({ id }) => id)
      .join('|')}`;
    const stories = `story:${scenePresetsIn('story')
      .map(({ id }) => id)
      .join('|')}`;
    expect(PIXI_GAME_SKILL.instructions.split('\n')[0]).toBe(
      `KITS FIRST: scene.preset ${games} is a tested whole game set by params; write code only for what no kit covers.`,
    );
    expect(PIXI_STORY_SKILL.instructions.split('\n')[0]).toContain(`scene.preset ${stories} `);
    // The mural playbook opens with every mural, pattern and type preset, the set-D library
    // murals included (they are not in the cached menu).
    expect(PIXI_MURAL_SKILL.instructions.split('\n')[0]).toBe(
      `PRESETS FIRST: scene.preset ${scenePresetMenu(['mural', 'pattern', 'type'])} is a tested whole mural set by params, in the page palette; write code only for what no preset covers, and keep new scene code short (under ~9,000 characters).`,
    );
    for (const id of PLAYBOOK_PRESET_IDS) expect(PIXI_MURAL_SKILL.instructions).toContain(id);
    expect(scenePresetMenu(SCENE_PRESET_CATEGORIES)).toContain(` ${games} ${stories}`);
    expect(door(sceneKernel(), { preset: 'snake-game' }).issues[0]).toMatch(
      /no scene preset "snake-game" \(did you mean snake\?\); use one of mural:.* game:arcade\|/u,
    );
  });

  it('keeps the words a page asks for over the kit language defaults', () => {
    const quiz = scenePreset('quiz') ?? presetWith(() => true);
    const result = door(sceneKernel({ locale: 'ar' }), {
      preset: quiz.id,
      params: { question1: 'كم لوناً في قوس قزح؟ | سبعة | خمسة | تسعة', time: 0 },
    });
    expect(result.issues).toEqual([]);
    const stored = insertedProps(result.steps)['jsParams'] as Record<string, unknown>;
    expect(stored['question1']).toBe('كم لوناً في قوس قزح؟ | سبعة | خمسة | تسعة');
    expect(stored['question2']).toBe(quiz.region?.params?.ar?.['question2']);
    expect(stored['time']).toBe(0);
  });

  it('refuses a kit behind or into a region, and on a region of plain content', () => {
    for (const key of ['behind', 'into'] as const) {
      expect(door(sceneKernel(), { preset: 'snake', [key]: 'r-hero' }).issues[0]).toMatch(
        /snake is a game kit: a whole section with its own words and controls, so it cannot fill another region · send "after":"r-hero"/u,
      );
    }
    expect(door(sceneKernel(), { preset: 'picture-book', id: 'r-hero' }).issues[0]).toMatch(
      /"r-hero" holds page content, not a scene, and a story kit brings its own · send "after":"r-hero"/u,
    );
    expect(door(sceneKernel(), { preset: 'snake', id: 'r-nope' }).issues[0]).toMatch(
      /"id": no region "r-nope" on the page/u,
    );
  });

  it('swaps a scene for a kit by "id" (tree and css too), and retunes the same kit keeping its words', () => {
    const kernel = sceneKernel();
    const before = rootSlots(kernel);
    land(kernel, { preset: SILK.id });
    const id = rootSlots(kernel).find((slot) => !before.includes(slot)) ?? '';
    const breakout = scenePreset('breakout') ?? presetWith(() => true);
    const swapped = land(kernel, { preset: breakout.id, id });
    expect(swapped.steps.slice(0, 3).map(({ args }) => args['key'])).toEqual(['tree', 'css', 'js']);
    expect(props(kernel, id)['css']).toBe(breakout.region?.css);
    expect(JSON.stringify(props(kernel, id)['tree'])).toContain('data-game-action');
    // A person retitles the game; applying the kit again with new params keeps that title.
    kernel.dispatchGroup(
      [
        {
          command: 'setProp',
          args: {
            id,
            key: 'tree',
            value: JSON.parse(
              JSON.stringify(props(kernel, id)['tree']).replace('Brick breaker', 'Wall smash'),
            ) as unknown,
          },
        },
      ],
      { author: 'user', label: 'Rename' },
    );
    const retuned = land(kernel, { preset: breakout.id, id, params: { rows: 7 } });
    expect(retuned.steps.map(({ args }) => args['key'])).not.toContain('tree');
    expect(JSON.stringify(props(kernel, id)['tree'])).toContain('Wall smash');
    expect(props(kernel, id)['jsParams']).toEqual({ rows: 7 });
    kernel.undo();
    expect(props(kernel, id)['jsParams'] ?? {}).toEqual({});
  });
});

describe('scene.preset — params', () => {
  it('merges the given values over the defaults and stores only what differs', () => {
    const result = door(sceneKernel(), {
      preset: SILK.id,
      params: { speed: 2, density: '1.5', interactive: false, seed: SILK.defaults['seed'] },
    });
    expect(result.issues).toEqual([]);
    expect(insertedProps(result.steps)['jsParams']).toEqual({
      speed: 2,
      density: 1.5,
      interactive: false,
    });
  });

  it('reads a palette as "theme" or #hex colours, coerced to the spec', () => {
    const run = scenePresetTool.parse({
      preset: SILK.id,
      params: { palette: ['#112233', '#AABBCC'] },
    });
    expect(run.ok && run.value.values).toEqual({ palette: ['#112233', '#aabbcc'] });
    const theme = scenePresetTool.parse({ preset: SILK.id, params: { palette: 'theme' } });
    expect(theme.ok && theme.value.values).toEqual({ palette: 'theme' });
  });

  it('clamps a value outside its range, and says so', () => {
    const run = scenePresetTool.parse({ preset: SILK.id, params: { speed: 9 } });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.values).toEqual({ speed: 3 });
    expect(run.value.adjusted.join(' ')).toMatch(/speed was clamped to 3/u);
    expect(door(sceneKernel(), { preset: SILK.id, params: { speed: 9 } }).issues).toEqual([]);
  });

  it('refuses an unknown key or a wrong type with the sentence the repair round needs', () => {
    expect(door(sceneKernel(), { preset: SILK.id, params: { glow: 1 } }).issues[0]).toMatch(
      /^Step 0 \(tool scene\.preset\): params: "glow" is not a setting of flow-field-silk \(its settings: palette, seed, speed, density/u,
    );
    expect(door(sceneKernel(), { preset: SILK.id, params: { speed: 'fast' } }).issues[0]).toMatch(
      /params: speed takes a number\./u,
    );
    const choice = presetWith((preset) => preset.params.some(({ type }) => type === 'select'));
    const select = choice.params.find(({ type }) => type === 'select');
    expect(
      door(sceneKernel(), { preset: choice.id, params: { [select?.key ?? '']: 'nope' } }).issues[0],
    ).toMatch(new RegExp(`${select?.key ?? ''} is one of: `, 'u'));
    expect(door(sceneKernel(), { preset: SILK.id, params: 'fast' }).issues[0]).toMatch(
      /"params" is an object of flow-field-silk's settings/u,
    );
  });
});

describe('scene.preset — in a region already on the page', () => {
  it('swaps the scene of a region by "id", keeping its id and tree, as one more Undo', () => {
    const kernel = sceneKernel();
    const before = rootSlots(kernel);
    land(kernel, { preset: SILK.id, params: { speed: 2 } });
    const id = rootSlots(kernel).find((slot) => !before.includes(slot)) ?? '';
    const tree = JSON.stringify(props(kernel, id)['tree']);

    const swapped = land(kernel, { preset: FIREFLY.id, id });
    expect(swapped.steps.map(({ command }) => command)).toEqual([
      'setProp',
      'setProp',
      'setProp',
      'setProp',
    ]);
    expect(swapped.steps.every(({ args }) => args['id'] === id)).toBe(true);
    expect(kernel.transactions()).toHaveLength(2);
    expect(rootSlots(kernel)).toContain(id);
    const region = props(kernel, id);
    expect(region['js']).toBe(FIREFLY.code);
    expect((region['jsMeta'] as { ref?: unknown }).ref).toEqual({
      tier: 'builtin',
      id: FIREFLY.id,
      version: FIREFLY.entry.version,
    });
    // The old preset's values are cleared, and a region named after it takes the new name.
    expect(region['jsParams']).toEqual({});
    expect(region['label']).toBe(FIREFLY.title.en);
    expect(JSON.stringify(region['tree'])).toBe(tree);
    expect(region['css']).toBe(SCENE_SECTION_CSS);

    kernel.undo();
    expect(props(kernel, id)['js']).toBe(SILK.code);
    expect(props(kernel, id)['jsParams']).toEqual({ speed: 2 });
  });

  it('puts the scene behind a region: content lifted over the canvas, one Undo', () => {
    const kernel = sceneKernel();
    const result = land(kernel, { preset: SILK.id, behind: 'r-hero' });
    expect(result.steps.map(({ command }) => command)).toEqual([
      'patchTreeNode',
      'setProp',
      'setProp',
      'setProp',
    ]);
    expect(result.steps[0]?.title).toBe(`Scene · ${SILK.title.en}`);
    expect(kernel.transactions()).toHaveLength(1);
    const hero = props(kernel, 'r-hero');
    expect(hero['js']).toBe(SILK.code);
    expect(hero['css']).toBe(SCENE_HOST_CSS);
    expect(hero['label']).toBe('Hero');
    const outer = treeOf(kernel, 'r-hero').children[0];
    if (outer?.kind !== 'element') throw new Error('hero outer');
    expect(outer.className?.split(' ')).toContain('ck-scene-host');
    expect(JSON.stringify(outer)).toContain('Fresh coffee daily');
    kernel.undo();
    expect(props(kernel, 'r-hero')['js']).toBeUndefined();
    expect(JSON.stringify(treeOf(kernel, 'r-hero'))).not.toContain('ck-scene-host');
  });

  it('replaces a cover photo and its scrim, and a photo preset animates that photo', () => {
    const kernel = sceneKernel();
    const photo = 'https://images.pexels.com/photos/30146018/pexels-photo-30146018.jpeg';
    const section: CustomCodeNode = {
      kind: 'element',
      tag: 'section',
      className: 'relative isolate overflow-hidden py-32',
      attributes: { id: 'hero' },
      children: [
        {
          kind: 'element',
          tag: 'img',
          className: 'absolute inset-0 -z-10 h-full w-full object-cover',
          attributes: { src: photo, alt: 'Coffee' },
        },
        { kind: 'element', tag: 'div', className: 'absolute inset-0 -z-10 bg-black/40' },
        { kind: 'element', tag: 'h1', text: 'Fresh coffee daily' },
      ],
    };
    kernel.dispatchGroup(
      [{ command: 'setTreeNode', args: { id: 'r-hero', path: [0], node: section } }],
      {
        author: 'user',
        label: 'Cover hero',
      },
    );
    const ripple = presetWith((preset) => preset.params.some(({ type }) => type === 'image'));
    const result = land(kernel, { preset: ripple.id, into: 'r-hero' });
    expect(result.steps.slice(0, 3).map(({ command }) => command)).toEqual([
      'removeTreeNode',
      'removeTreeNode',
      'patchTreeNode',
    ]);
    const outer = treeOf(kernel, 'r-hero').children[0];
    if (outer?.kind !== 'element') throw new Error('hero outer');
    expect(
      outer.children?.map((child) => (child.kind === 'element' ? child.tag : child.kind)),
    ).toEqual(['h1']);
    expect(props(kernel, 'r-hero')['jsParams']).toEqual({ image: photo });
  });

  it('refuses a region that is not on the page, not composed, or runs other page code', () => {
    expect(door(sceneKernel(), { preset: SILK.id, behind: 'r-nope' }).issues[0]).toMatch(
      /"behind": no region "r-nope" on the page; use one of r-header, r-hero/u,
    );
    expect(door(sceneKernel(), { preset: SILK.id, behind: 'root' }).issues[0]).toMatch(
      /"root" is a page block, not a composed region/u,
    );
    const kernel = sceneKernel();
    kernel.dispatchGroup(
      [
        {
          command: 'setProp',
          args: { id: 'r-menu', key: 'js', value: "ck.root.dataset.ready='1';" },
        },
      ],
      { author: 'user', label: 'Script' },
    );
    expect(door(kernel, { preset: SILK.id, behind: 'r-menu' }).issues[0]).toMatch(
      /"r-menu" already runs its own page code \(not a scene\)/u,
    );
    // Asked by id, the code is replaced.
    expect(door(kernel, { preset: SILK.id, id: 'r-menu' }).issues).toEqual([]);
  });
});

describe('scene.preset — free code', () => {
  it('is refused by the door while free code mode is off, with the switch named', () => {
    for (const input of [{ preset: SILK.id }, { preset: SILK.id, behind: 'r-hero' }]) {
      const off = door(sceneKernel(), input, false);
      expect(off.result?.ok).toBe(false);
      expect(off.issues[0]).toContain('free code mode is OFF');
      expect(off.issues[0]).toContain('«وضع الكود الحر»');
      expect(door(sceneKernel(), input, true).issues).toEqual([]);
    }
  });

  it('refuses outright on a site whose regions cannot carry page code', () => {
    expect(door(fixtureKernel(), { preset: SILK.id }).issues[0]).toMatch(
      /regions cannot carry page code \(no "js" prop\): use media\.add scene instead/u,
    );
  });
});

describe('scene.preset — reading the call', () => {
  it('names the near miss, the menu, and the one placement it takes', () => {
    expect(door(sceneKernel(), { preset: 'flow-field' }).issues[0]).toMatch(
      /no scene preset "flow-field" \(did you mean flow-field-silk\?\); use one of mural:flow-field-silk\|/u,
    );
    expect(door(sceneKernel(), {}).issues[0]).toMatch(/"preset" is required, one of mural:/u);
    expect(door(sceneKernel(), { preset: 'Flow-field silk' }).issues).toEqual([]);
    expect(
      door(sceneKernel(), { preset: SILK.id, after: 'r-hero', behind: 'r-hero' }).issues[0],
    ).toMatch(/at most one of "after"/u);
    expect(door(sceneKernel(), { preset: SILK.id, colour: 'red' }).issues[0]).toMatch(
      /unknown keys colour; use preset, after, into, behind, id, params\./u,
    );
  });
});

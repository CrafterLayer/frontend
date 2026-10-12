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

import { validateAiPlan } from '../../../plan/validate-plan';
import {
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
import { SCENE_HOST_CSS, SCENE_SECTION_CSS, scenePresetTool } from './scene-preset';

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

  it('lists every preset id by category in both lanes, and keeps the section lane signatures', () => {
    for (const lane of ['section', 'edit'] as const) {
      const prompt = agentToolPrompt(lane);
      expect(prompt).toContain(`scene.preset ${scenePresetTool.signature}`);
      for (const category of SCENE_PRESET_CATEGORIES) {
        const ids = scenePresetsIn(category).map(({ id }) => id);
        expect(prompt).toContain(`${category}:${ids.join('|')}`);
      }
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
      expect(region['css']).toBe(SCENE_SECTION_CSS);
      expect(String(region['css'])).toMatch(/aspect-ratio:16\/9;min-height:320px/u);
      expect(String(region['css'])).not.toMatch(/\d\s*vh/u);
      const outer = treeOf(kernel, added[0] ?? '').children[0];
      expect(outer?.kind === 'element' ? outer.attributes : undefined).toMatchObject({
        id: 'scene',
        'aria-hidden': 'true',
      });
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

import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { runAiAgent } from '../agent/run-agent';
import { styleKernel, treeOf } from '../style-tools/style-tools.fixtures';
import { expandAndValidate } from '../tools/agent/agent-tools.fixtures';
import { tryDirectTool } from '../tools/agent/direct-tool';
import { planChangesLook } from '../tools/agent/visible-change';
import type { AiPlanProvider } from '../types';
import { heroOf, motionAddTool, readMedia } from './index';
import { playgroundLikeKernel } from './motion-blocks.fixtures';

/*
  gsap-pixi (2026-10-08), diagnosis blocker 11: motion.add and media.add reach
  REGISTERED blocks (the playground's hero, features, pricing …) with ONE
  setProp each, and the zero-token readings — «ضيف انميشن GSAP للأقسام»,
  "animate all sections", «خلفية متحركة بالجزيئات للهيرو», "add a scroll reveal
  to the features" — land on a registered page and on a composed page alike,
  every call in ONE plan: one transaction, one Undo.
*/

interface Step {
  readonly command: string;
  readonly args: Record<string, unknown>;
  readonly title?: string;
}

function door(kernel: BuilderKernel, name: string, input: unknown) {
  const result = expandAndValidate(kernel, name, input);
  const steps = (result.plan as { commands?: Step[] }).commands ?? [];
  return { ...result, steps };
}

function props(kernel: BuilderKernel, id: string): Record<string, unknown> {
  return kernel.getDocument().nodes[id]?.props ?? {};
}

function refusing(): { provider: AiPlanProvider; calls: () => number } {
  let calls = 0;
  return {
    provider: {
      propose: () => {
        calls += 1;
        return Promise.reject(new Error('A zero-token motion reading must not ask the provider.'));
      },
    },
    calls: () => calls,
  };
}

describe('motion.add on a registered block', () => {
  it('names part in its signature', () => {
    expect(motionAddTool.signature).toBe('{id,find?|path?|part?,recipe,scrub?}');
  });

  it('without part: ONE setProp merging the timeline into motion and dropping the CSS reveal', () => {
    const kernel = playgroundLikeKernel();
    const result = door(kernel, 'motion.add', { id: 'hero', recipe: 'fade-in', scrub: false });
    expect(result.issues).toEqual([]);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      command: 'setProp',
      args: { id: 'hero', key: 'motion', value: { timeline: 'fade-in', scrub: false, duration: 'normal', easing: 'ease-out' } },
      title: 'Cinematic motion: Fade in',
    });
    expect((result.steps[0]?.args['value'] as Record<string, unknown>)['reveal']).toBeUndefined();
  });

  it('with part: ONE setProp of partStyles; an index scopes one instance; other entries are kept', () => {
    const kernel = playgroundLikeKernel({ locale: 'ar' });
    kernel.dispatchGroup(
      [{ command: 'setProp', args: { id: 'features', key: 'partStyles', value: { heading: { className: 'text-accent' } } } }],
      { author: 'user', label: 'Colour' },
    );
    const list = door(kernel, 'motion.add', { id: 'features', part: 'items', recipe: 'stagger-in' });
    expect(list.issues).toEqual([]);
    expect(list.steps).toEqual([
      {
        command: 'setProp',
        args: { id: 'features', key: 'partStyles', value: { heading: { className: 'text-accent' }, items: { timeline: 'stagger-in' } } },
        title: 'حركة سينمائية: دخول متتابع',
      },
    ]);
    const one = door(kernel, 'motion.add', { id: 'features', part: 'item', index: 1, recipe: 'slide-in', scrub: true });
    expect(one.issues).toEqual([]);
    expect(one.steps[0]?.args['value']).toMatchObject({ 'item@1': { timeline: 'slide-in', scrub: true } });
    // An alias names the part too («العنوان» → heading).
    const alias = door(kernel, 'motion.add', { id: 'hero', part: 'العنوان', recipe: 'split-reveal' });
    expect(alias.steps[0]?.args).toMatchObject({ key: 'partStyles', value: { heading: { timeline: 'split-reveal' } } });
  });

  it('refuses with repair text: no motion prop, find/path, velocity-marquee, an unknown part, part on a region, a repeat', () => {
    const kernel = playgroundLikeKernel({ withRegion: true });
    expect(door(kernel, 'motion.add', { id: 'note', recipe: 'fade-in' }).issues[0]).toMatch(/has no motion setting · send "part"/u);
    expect(door(kernel, 'motion.add', { id: 'note', part: 'heading', recipe: 'fade-in' }).issues).toEqual([]);
    expect(door(kernel, 'motion.add', { id: 'hero', find: 'Build pages your kernel can prove', recipe: 'fade-in' }).issues[0]).toMatch(
      /registered Hero block, not a composed region: drop "find"\/"path"/u,
    );
    expect(door(kernel, 'motion.add', { id: 'features', recipe: 'velocity-marquee' }).issues[0]).toMatch(/composed marquee/u);
    expect(door(kernel, 'motion.add', { id: 'features', part: 'gallery', recipe: 'fade-in' }).issues[0]).toMatch(/has no part "gallery"/u);
    expect(door(kernel, 'motion.add', { id: 'r-story', part: 'heading', recipe: 'fade-in' }).issues[0]).toMatch(/is a composed region/u);
    expect(door(kernel, 'motion.add', { id: 'hero', index: 1, recipe: 'fade-in' }).issues[0]).toMatch(/send "part" too/u);
    expect(door(kernel, 'motion.add', { id: 'hero', part: 'heading', find: 'x', recipe: 'fade-in' }).issues[0]).toMatch(/not both/u);
    kernel.dispatchGroup([{ command: 'setProp', args: { id: 'stats', key: 'motion', value: { timeline: 'fade-in' } } }], {
      author: 'user',
      label: 'Motion',
    });
    expect(door(kernel, 'motion.add', { id: 'stats', recipe: 'fade-in' }).issues[0]).toMatch(/already plays fade-in/u);
    // The composed region path is unchanged.
    expect(door(kernel, 'motion.add', { id: 'r-story', path: [0], recipe: 'fade-in' }).steps[0]).toMatchObject({
      command: 'patchTreeNode',
      args: { id: 'r-story', path: [0], attributes: { 'data-ck-timeline': 'fade-in' } },
    });
  });
});

describe('media.add scene behind a registered block', () => {
  it('is ONE setProp merging scene (+ density, palette) into motion, the reveal kept', () => {
    const kernel = playgroundLikeKernel();
    const result = door(kernel, 'media.add', { kind: 'scene', scene: 'mesh-gradient', behind: 'hero', density: 'high', palette: 'accent' });
    expect(result.issues).toEqual([]);
    expect(result.steps).toEqual([
      {
        command: 'setProp',
        args: {
          id: 'hero',
          key: 'motion',
          value: { reveal: 'fade-up', duration: 'normal', easing: 'ease-out', scene: 'mesh-gradient', sceneDensity: 'high', scenePalette: 'accent' },
        },
        title: 'Animated background: Mesh gradient',
      },
    ]);
  });

  it('refuses an image scene, images, a block with no motion prop, and a repeat — with repair text', () => {
    const kernel = playgroundLikeKernel();
    expect(door(kernel, 'media.add', { kind: 'scene', scene: 'mural', behind: 'hero', images: 'catalog:cafe' }).issues[0]).toMatch(
      /only particles or mesh-gradient can draw behind its content/u,
    );
    expect(door(kernel, 'media.add', { kind: 'scene', scene: 'particles', behind: 'hero', images: 'catalog:cafe' }).issues[0]).toMatch(
      /drop "images"/u,
    );
    expect(door(kernel, 'media.add', { kind: 'scene', scene: 'particles', behind: 'note' }).issues[0]).toMatch(/has no motion setting/u);
    kernel.dispatchGroup([{ command: 'setProp', args: { id: 'faq', key: 'motion', value: { scene: 'particles' } } }], {
      author: 'user',
      label: 'Scene',
    });
    expect(door(kernel, 'media.add', { kind: 'scene', scene: 'particles', behind: 'faq' }).issues[0]).toMatch(/already has the particles background/u);
  });
});

describe('the hero of a registered page', () => {
  it('is the registered hero block (inside its aurora surface); a composed page keeps its h1 region', () => {
    expect(heroOf(playgroundLikeKernel())).toBe('hero');
    expect(heroOf(styleKernel())).toBe('r-hero');
  });
});

const ALL_SECTIONS_REQUESTS: readonly (readonly [string, 'ar' | 'en'])[] = [
  ['ضيف انميشن GSAP للأقسام', 'ar'],
  ['حركة للأقسام', 'ar'],
  ['ضيف حركة عند التمرير لكل الأقسام', 'ar'],
  ['animate all sections', 'en'],
  ['add a scroll reveal to the sections', 'en'],
  ['add gsap animations to every section', 'en'],
];

describe('«ضيف انميشن GSAP للأقسام» — every content section, one plan', () => {
  it.each(ALL_SECTIONS_REQUESTS)('«%s» on the playground page animates every content section, chrome left still', (request, locale) => {
    const kernel = playgroundLikeKernel({ locale });
    const direct = tryDirectTool(request, kernel);
    expect(direct?.label).toBe(locale === 'ar' ? 'أُضيفت حركة للأقسام' : 'Scroll animation added to the sections');
    const commands = (direct?.plan.commands ?? []) as readonly Step[];
    expect(commands.map(({ command, args }) => `${command} ${String(args['id'])} ${String(args['key'])}`)).toEqual([
      'setProp hero partStyles',
      'setProp carousel motion',
      'setProp features partStyles',
      'setProp stats partStyles',
      'setProp pricing motion',
      'setProp quotes motion',
      'setProp faq partStyles',
    ]);
    const value = (id: string) => commands.find(({ args }) => args['id'] === id)?.args['value'];
    expect(value('hero')).toEqual({ heading: { timeline: 'split-reveal' } });
    expect(value('carousel')).toEqual({ timeline: 'fade-in' });
    expect(value('features')).toEqual({ items: { timeline: 'stagger-in' } });
    expect(value('quotes')).toEqual({ timeline: 'fade-in' });
    expect(planChangesLook(commands, kernel)).toBe(true);
  });

  it.each(ALL_SECTIONS_REQUESTS)('«%s» on a composed page animates the hero heading and each section, header and footer left still', (request, locale) => {
    const kernel = styleKernel({ locale });
    const direct = tryDirectTool(request, kernel);
    const commands = (direct?.plan.commands ?? []) as readonly Step[];
    expect(commands.map(({ args }) => [args['id'], args['path'], (args['attributes'] as Record<string, unknown>)['data-ck-timeline']])).toEqual([
      ['r-hero', [0, 0], 'split-reveal'],
      ['r-menu', [0], 'fade-in'],
      ['r-story', [0], 'fade-in'],
    ]);
    expect(commands.every(({ command }) => command === 'patchTreeNode')).toBe(true);
  });

  it('a mixed page animates its composed region in page order, and skips what already moves', () => {
    const kernel = playgroundLikeKernel({ withRegion: true });
    kernel.dispatchGroup([{ command: 'setProp', args: { id: 'stats', key: 'motion', value: { timeline: 'slide-in' } } }], {
      author: 'user',
      label: 'Motion',
    });
    const commands = (tryDirectTool('animate all sections', kernel)?.plan.commands ?? []) as readonly Step[];
    expect(commands.map(({ args }) => args['id'])).toEqual(['hero', 'carousel', 'features', 'r-story', 'pricing', 'quotes', 'faq']);
    expect(commands.find(({ args }) => args['id'] === 'r-story')).toMatchObject({
      command: 'patchTreeNode',
      args: { path: [0], attributes: { 'data-ck-timeline': 'fade-in' } },
    });
  });

  it('applies with no provider call as ONE transaction; one Undo restores every section (registered page)', async () => {
    const kernel = playgroundLikeKernel({ locale: 'ar' });
    const before = JSON.stringify(kernel.getDocument().nodes);
    const { provider, calls } = refusing();
    const result = await runAiAgent({
      runId: 'motion-all',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'ضيف انميشن GSAP للأقسام',
      apply: 'auto',
      validationPorts: { clock: fixedClock(2), ids: seededIds('motion-all') },
    });
    expect(calls()).toBe(0);
    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(kernel.transactions()).toHaveLength(1);
    expect(props(kernel, 'hero')['partStyles']).toEqual({ heading: { timeline: 'split-reveal' } });
    expect(props(kernel, 'features')['partStyles']).toEqual({ items: { timeline: 'stagger-in' } });
    expect(props(kernel, 'pricing')['motion']).toEqual({ timeline: 'fade-in' });
    kernel.undo();
    expect(JSON.stringify(kernel.getDocument().nodes)).toBe(before);
  });

  it('applies with no provider call as ONE transaction; one Undo restores every region (composed page)', async () => {
    const kernel = styleKernel({ locale: 'ar' });
    const before = JSON.stringify(kernel.getDocument().nodes);
    const { provider, calls } = refusing();
    await runAiAgent({
      runId: 'motion-all-cc',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'حركة للأقسام',
      apply: 'auto',
      validationPorts: { clock: fixedClock(2), ids: seededIds('motion-all-cc') },
    });
    expect(calls()).toBe(0);
    expect(kernel.transactions()).toHaveLength(1);
    expect(JSON.stringify(treeOf(kernel, 'r-story'))).toContain('"data-ck-timeline":"fade-in"');
    kernel.undo();
    expect(JSON.stringify(kernel.getDocument().nodes)).toBe(before);
  });

  it('reads nothing when no section can move, and leaves a single "section" to the model', () => {
    const kernel = playgroundLikeKernel();
    expect(tryDirectTool('add a scroll reveal to the section', kernel)).toBeUndefined();
    expect(tryDirectTool('animate the section', kernel)).toBeUndefined();
    expect(readMedia('animate all sections', styleKernel())?.calls).toHaveLength(3);
  });
});

describe('«خلفية متحركة بالجزيئات للهيرو» — a scene behind the hero, registered or composed', () => {
  it.each([
    ['خلفية متحركة بالجزيئات للهيرو', 'ar', 'particles'],
    ['particles background for the hero', 'en', 'particles'],
    ['add an animated gradient background', 'en', 'mesh-gradient'],
  ] as const)('«%s» on the playground page sets the registered hero\'s motion.scene', (request, locale, scene) => {
    const kernel = playgroundLikeKernel({ locale });
    const direct = tryDirectTool(request, kernel);
    expect(direct?.label).toBe(locale === 'ar' ? 'أُضيفت خلفية متحركة' : 'Animated background added');
    expect(direct?.plan.commands).toHaveLength(1);
    expect(direct?.plan.commands[0]).toMatchObject({
      command: 'setProp',
      args: { id: 'hero', key: 'motion', value: { reveal: 'fade-up', scene } },
    });
  });

  it('applies as one transaction with no provider call, and one Undo removes it', async () => {
    const kernel = playgroundLikeKernel({ locale: 'ar' });
    const { provider, calls } = refusing();
    await runAiAgent({
      runId: 'scene-hero',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'خلفية متحركة بالجزيئات للهيرو',
      apply: 'auto',
      validationPorts: { clock: fixedClock(2), ids: seededIds('scene-hero') },
    });
    expect(calls()).toBe(0);
    expect(kernel.transactions()).toHaveLength(1);
    expect(props(kernel, 'hero')['motion']).toMatchObject({ scene: 'particles' });
    kernel.undo();
    expect(props(kernel, 'hero')['motion']).toEqual({ reveal: 'fade-up', duration: 'normal', easing: 'ease-out' });
  });

  it('a composed hero keeps its layer insert', () => {
    const direct = tryDirectTool('particles background for the hero', styleKernel());
    expect(direct?.plan.commands[0]).toMatchObject({ command: 'insertTreeNode', args: { id: 'r-hero' } });
  });

  it('a mural goes after the root section holding a registered hero; a background video is left to the model', () => {
    expect(readMedia('جداريه متحركه', playgroundLikeKernel({ locale: 'ar' }))?.calls[0]?.input).toMatchObject({ after: 'aurora' });
    expect(tryDirectTool('فيديو خلفية للهيرو https://cdn.example.com/loop.mp4', playgroundLikeKernel({ locale: 'ar' }))).toBeUndefined();
  });
});

describe('"add a scroll reveal to the features" — a section noun names a registered block', () => {
  it.each([
    ['add a scroll reveal to the features', 'en'],
    ['ضيف حركة عند التمرير لقسم المميزات', 'ar'],
    ['add a GSAP scroll reveal to the why craftkit section', 'en'],
  ] as const)('«%s» staggers the registered features cards', (request, locale) => {
    const kernel = playgroundLikeKernel({ locale });
    const direct = tryDirectTool(request, kernel);
    expect(direct?.label).toBe(locale === 'ar' ? 'أُضيفت حركة عند التمرير' : 'Scroll animation added');
    expect(direct?.plan.commands).toEqual([
      expect.objectContaining({ command: 'setProp', args: { id: 'features', key: 'partStyles', value: { items: { timeline: 'stagger-in' } } } }),
    ]);
  });

  it('a heading request reveals the heading part; a section with no list fades in; the hero heading by itself', () => {
    const kernel = playgroundLikeKernel();
    expect(tryDirectTool('add a scroll reveal to the features heading', kernel)?.plan.commands[0]).toMatchObject({
      args: { id: 'features', key: 'partStyles', value: { heading: { timeline: 'split-reveal' } } },
    });
    expect(tryDirectTool('add a scroll reveal to the pricing', kernel)?.plan.commands[0]).toMatchObject({
      args: { id: 'pricing', key: 'motion', value: { timeline: 'fade-in' } },
    });
    expect(tryDirectTool('ضيف حركة للعنوان', playgroundLikeKernel({ locale: 'ar' }))?.plan.commands[0]).toMatchObject({
      args: { id: 'hero', key: 'partStyles', value: { heading: { timeline: 'split-reveal' } } },
    });
  });

  it('a section the page lacks, or two that answer, is the model\'s to answer', () => {
    expect(tryDirectTool('add a scroll reveal to the team', playgroundLikeKernel())).toBeUndefined();
    const kernel = playgroundLikeKernel();
    kernel.dispatchGroup(
      [
        {
          command: 'insertNode',
          args: { type: 'features', parentId: 'root', index: 4, props: { heading: 'More features', items: [] } },
        },
      ],
      { author: 'user', label: 'Insert' },
    );
    expect(tryDirectTool('add a scroll reveal to the features', kernel)).toBeUndefined();
  });

  it('the composed page reading is unchanged', () => {
    const direct = tryDirectTool('add a GSAP scroll reveal to the menu', styleKernel());
    expect(direct?.plan.commands[0]).toMatchObject({ command: 'patchTreeNode', args: { id: 'r-menu', attributes: { 'data-ck-timeline': 'stagger-in' } } });
  });
});

describe('motion requests that name no section, or wrap the noun in reveal words (fix pass 2026-10-10)', () => {
  it.each([
    ['ضيف حركة GSAP', 'ar'],
    ['ضيف حركة GSAP تظهر الأقسام عند التمرير', 'ar'],
    ['add scroll reveal animation', 'en'],
  ] as const)('«%s» animates every content section with no provider call', (request, locale) => {
    const composed = tryDirectTool(request, styleKernel({ locale }));
    expect(composed?.label).toBe(locale === 'ar' ? 'أُضيفت حركة للأقسام' : 'Scroll animation added to the sections');
    expect((composed?.plan.commands ?? []).length).toBe(3);
    expect((tryDirectTool(request, playgroundLikeKernel({ locale }))?.plan.commands ?? []).length).toBe(7);
  });

  it('«حركة ظهور عند التمرير لقائمة الطعام» reads the menu section past the reveal and scroll words', () => {
    const direct = tryDirectTool('حركة ظهور عند التمرير لقائمة الطعام', styleKernel({ locale: 'ar' }));
    const commands = (direct?.plan.commands ?? []) as readonly Step[];
    expect(commands.map(({ args }) => args['id'])).toEqual(['r-menu']);
  });
});

import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import type { CustomCodeNode, CustomCodeRoot } from '@craftkit/builder-schema';

import { runAiAgent } from '../agent/run-agent';
import { isCatalogPhotoUrl } from '../context/providers/photo-catalog';
import { runStyleTool } from '../style-tools/run-direct';
import { styleKernel, treeOf } from '../style-tools/style-tools.fixtures';
import { expandAndValidate } from '../tools/agent/agent-tools.fixtures';
import { tryDirectTool } from '../tools/agent/direct-tool';
import { agentToolPrompt, agentToolPromptMaxChars } from '../tools/agent/catalog-prompt';
import { agentTool, agentToolsForLane } from '../tools/agent/registry';
import { planChangesLook } from '../tools/agent/visible-change';
import type { AiPlanProvider } from '../types';
import { MEDIA_AGENT_TOOLS, mediaAddTool, motionAddTool, readMedia } from './index';

/*
  media-motion (2026-10-06, DESIGN §F, §4 acceptance 1-5): media.add and
  motion.add expand to ordinary kernel steps the real door accepts, one plan
  is one labelled transaction, and the zero-token readings land with no model.
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

function elements(node: CustomCodeNode | CustomCodeRoot): Extract<CustomCodeNode, { kind: 'element' }>[] {
  const out: Extract<CustomCodeNode, { kind: 'element' }>[] = [];
  const walk = (current: CustomCodeNode | CustomCodeRoot): void => {
    if (current.kind === 'element') out.push(current);
    if (current.kind === 'icon') return;
    for (const child of (current as { children?: readonly CustomCodeNode[] }).children ?? []) walk(child);
  };
  walk(node);
  return out;
}

function insertedTree(steps: readonly Step[]): CustomCodeRoot {
  const insert = steps.find(({ command }) => command === 'insertNode');
  const props = insert?.args['props'] as { tree?: CustomCodeRoot } | undefined;
  if (props?.tree === undefined) throw new Error('no insertNode customCode step');
  return props.tree;
}

describe('media.add — registered and catalogued', () => {
  it('registers media.add and motion.add on the edit and build lanes', () => {
    expect(MEDIA_AGENT_TOOLS.map(({ name }) => name)).toEqual(['media.add', 'motion.add']);
    expect(agentTool('media.add')).toBe(mediaAddTool);
    expect(agentTool('motion.add')).toBe(motionAddTool);
    for (const lane of ['edit', 'build'] as const) {
      const names = agentToolsForLane(lane).map(({ name }) => name);
      expect(names).toContain('media.add');
      expect(names).toContain('motion.add');
    }
    expect(agentToolsForLane('section').map(({ name }) => name)).not.toContain('media.add');
  });
});

describe('the edit-lane prompt', () => {
  it('fits its 1400-character cap and keeps both signatures and the kinds and recipes lines', () => {
    const prompt = agentToolPrompt('edit');
    expect(prompt.length).toBeLessThanOrEqual(agentToolPromptMaxChars('edit'));
    expect(prompt).toContain(`media.add ${mediaAddTool.signature}`);
    expect(prompt).toContain(`motion.add ${motionAddTool.signature}`);
    expect(prompt).toMatch(/media\.add kinds: gallery\{layout\?:grid\|masonry/u);
    expect(prompt).toContain("images?:'catalog:<topic>'");
    expect(prompt).toMatch(/motion\.add recipe: split-reveal\|/u);
    expect(mediaAddTool.signature.length).toBeLessThanOrEqual(120);
  });
});

describe('media.add gallery', () => {
  it('builds every layout as ONE door-valid insertNode customCode, before the footer', () => {
    for (const layout of ['grid', 'masonry', 'bento', 'carousel', 'filmstrip']) {
      const kernel = styleKernel();
      const result = door(kernel, 'media.add', { kind: 'gallery', layout, images: 'catalog:restaurant' });
      expect(result.issues, layout).toEqual([]);
      expect(result.steps, layout).toHaveLength(1);
      const [step] = result.steps;
      expect(step?.command).toBe('insertNode');
      expect(step?.args).toMatchObject({ type: 'customCode', parentId: 'root', index: 4 });
      const tree = insertedTree(result.steps);
      const behaviours = elements(tree).map((node) => node.attributes?.['data-ck-behavior']);
      expect(behaviours, layout).toContain(layout === 'filmstrip' ? 'marquee' : 'gallery');
    }
  });

  it('fills six verified photos with Arabic alt, intrinsic size and srcset on an Arabic page (acceptance 1)', () => {
    const kernel = styleKernel({ locale: 'ar' });
    const result = door(kernel, 'media.add', { kind: 'gallery', images: 'catalog:restaurant' });
    expect(result.issues).toEqual([]);
    const tree = insertedTree(result.steps);
    const images = elements(tree).filter((node) => node.tag === 'img');
    expect(images).toHaveLength(6);
    for (const image of images) {
      expect(isCatalogPhotoUrl(image.attributes?.src ?? '')).toBe(true);
      expect(image.attributes?.alt).toMatch(/[؀-ۿ]/u);
      expect(image.attributes?.width).toMatch(/^\d+$/u);
      expect(image.attributes?.height).toMatch(/^\d+$/u);
      expect(image.attributes?.srcset).toContain('640w');
      expect(image.attributes?.loading).toBe('lazy');
    }
    expect(new Set(images.map((image) => image.attributes?.src)).size).toBe(6);
    const section = tree.children[0];
    expect(section?.kind === 'element' ? section.attributes : undefined).toMatchObject({ lang: 'ar', dir: 'rtl', id: 'gallery' });
  });

  it("maps 'food' to the restaurant topic and infers the page's own topic when images is absent", () => {
    const food = door(styleKernel(), 'media.add', { kind: 'gallery', images: 'catalog:food', count: 3 });
    expect(food.issues).toEqual([]);
    const alts = elements(insertedTree(food.steps))
      .filter((node) => node.tag === 'img')
      .map((node) => node.attributes?.alt ?? '');
    expect(alts).toHaveLength(3);
    for (const alt of alts) expect(alt).not.toMatch(/[؀-ۿ]/u);

    // The café fixture names coffee: no images field still finds photos, never the hero's own.
    const inferred = door(styleKernel(), 'media.add', { kind: 'gallery', count: 3 });
    expect(inferred.issues).toEqual([]);
    const sources = elements(insertedTree(inferred.steps))
      .filter((node) => node.tag === 'img')
      .map((node) => node.attributes?.src ?? '');
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((src) => src.includes('30146018'))).toBe(false);
  });

  it('takes uploaded images as given and refuses unsafe addresses with repair text', () => {
    const given = door(styleKernel(), 'media.add', {
      kind: 'gallery',
      images: [
        { src: '/uploads/a.jpg', alt: 'Our terrace' },
        { src: 'https://example.com/b.jpg', alt: 'Our kitchen', width: 1200, height: 800 },
      ],
    });
    expect(given.issues).toEqual([]);
    expect(elements(insertedTree(given.steps)).filter((node) => node.tag === 'img')).toHaveLength(2);

    const unsafe = door(styleKernel(), 'media.add', { kind: 'gallery', images: [{ src: 'javascript:alert(1)', alt: 'x' }] });
    expect(unsafe.issues[0]).toMatch(/images\[0\]\.src" must be an https address/u);
    const noAlt = door(styleKernel(), 'media.add', { kind: 'gallery', images: [{ src: '/a.jpg' }] });
    expect(noAlt.issues[0]).toMatch(/alt is required/u);
    const kind = door(styleKernel(), 'media.add', { kind: 'slideshow' });
    expect(kind.issues[0]).toMatch(/"kind" is one of gallery, video, scene, compare, pricing, map, lottie/u);
    const topic = door(styleKernel(), 'media.add', { kind: 'gallery', images: 'catalog:unicorns' });
    expect(topic.issues[0]).toMatch(/no catalog photo matches "unicorns"/u);
    const both = door(styleKernel(), 'media.add', { kind: 'gallery', after: 'r-hero', into: 'r-story' });
    expect(both.issues[0]).toMatch(/at most one of "after"/u);
  });

  it('appends a gallery INTO an existing region with insertTreeNode, plus its region css', () => {
    const kernel = styleKernel();
    const result = door(kernel, 'media.add', { kind: 'gallery', layout: 'masonry', images: 'catalog:cafe', count: 3, into: 'r-story' });
    expect(result.issues).toEqual([]);
    expect(result.steps.map(({ command }) => command)).toEqual(['insertTreeNode', 'setProp']);
    expect(result.steps[0]?.args).toMatchObject({ id: 'r-story', parent: [0], index: 2 });
    expect(result.steps[1]?.args).toMatchObject({ id: 'r-story', key: 'css' });
  });
});

describe('media.add video', () => {
  it('makes a YouTube link a privacy facade with a catalog poster, not an iframe (acceptance 2)', () => {
    const result = door(styleKernel(), 'media.add', { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(result.issues).toEqual([]);
    const tree = insertedTree(result.steps);
    const facade = elements(tree).find((node) => node.attributes?.['data-ck-behavior'] === 'embed-facade');
    expect(facade?.tag).toBe('a');
    expect(facade?.attributes?.href).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(elements(tree).some((node) => node.tag === 'iframe')).toBe(false);
    const poster = elements(tree).find((node) => node.tag === 'img');
    expect(isCatalogPhotoUrl(poster?.attributes?.src ?? '')).toBe(true);
  });

  it('puts an .mp4 in the video-player figure with native controls (acceptance 3)', () => {
    const result = door(styleKernel({ locale: 'ar' }), 'media.add', { kind: 'video', url: 'https://cdn.example.com/clip.mp4', title: 'جولة في المطبخ' });
    expect(result.issues).toEqual([]);
    const tree = insertedTree(result.steps);
    const player = elements(tree).find((node) => node.attributes?.['data-ck-behavior'] === 'video-player');
    expect(player?.tag).toBe('figure');
    const video = elements(tree).find((node) => node.tag === 'video');
    expect(video?.attributes).toHaveProperty('controls');
    expect(video?.attributes).not.toHaveProperty('autoplay');
  });

  it('refuses HLS, an unknown address and a missing one with the forms that work', () => {
    expect(door(styleKernel(), 'media.add', { kind: 'video', url: 'https://cdn.example.com/live.m3u8' }).issues[0]).toMatch(/HLS needs the pro player/u);
    expect(door(styleKernel(), 'media.add', { kind: 'video', url: 'https://example.com/page' }).issues[0]).toMatch(/a video is a YouTube link/u);
    expect(door(styleKernel(), 'media.add', { kind: 'video' }).issues[0]).toMatch(/"url" is required/u);
    expect(door(styleKernel(), 'media.add', { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', mode: 'background' }).issues[0]).toMatch(/background video needs/u);
  });

  it('plays a background video BEHIND the hero: the layer first, the host gains bg-video and its classes', () => {
    const kernel = styleKernel();
    const result = door(kernel, 'media.add', { kind: 'video', url: 'https://cdn.example.com/loop.mp4', behind: 'r-hero' });
    expect(result.issues).toEqual([]);
    expect(result.steps.map(({ command }) => command)).toEqual(['insertTreeNode', 'patchTreeNode']);
    expect(result.steps[0]?.args).toMatchObject({ id: 'r-hero', parent: [0], index: 0 });
    expect(result.steps[1]?.args).toMatchObject({ attributes: { 'data-ck-behavior': 'bg-video' } });
    const node = result.steps[0]?.args['node'] as CustomCodeNode;
    expect(node.kind === 'element' ? node.attributes : undefined).not.toHaveProperty('autoplay');
  });
});

describe('media.add scene', () => {
  it('puts particles behind the hero as ONE labelled transaction, with one Undo (acceptance 4)', () => {
    const kernel = styleKernel();
    const result = runStyleTool(kernel, mediaAddTool, { kind: 'scene', scene: 'particles', behind: 'r-hero' });
    expect(result.ok).toBe(true);
    expect(kernel.transactions()).toHaveLength(1);
    const hero = treeOf(kernel, 'r-hero');
    const outer = hero.children[0];
    if (outer?.kind !== 'element') throw new Error('hero outer');
    expect(outer.className?.split(' ')).toEqual(expect.arrayContaining(['relative', 'isolate', 'overflow-hidden']));
    const layer = outer.children?.[0];
    expect(layer?.kind === 'element' ? layer.attributes : undefined).toMatchObject({ 'data-ck-scene': 'particles', 'aria-hidden': 'true' });
    // The hero's own content follows, untouched.
    expect(elements(hero).some((node) => node.tag === 'h1' && node.text === 'Fresh coffee daily')).toBe(true);
    kernel.undo();
    expect(JSON.stringify(treeOf(kernel, 'r-hero'))).not.toContain('data-ck-scene');
  });

  it('replaces a scene already behind a region instead of stacking a second one', () => {
    const kernel = styleKernel();
    expect(runStyleTool(kernel, mediaAddTool, { kind: 'scene', scene: 'particles', behind: 'r-hero' }).ok).toBe(true);
    const again = door(kernel, 'media.add', { kind: 'scene', scene: 'mesh-gradient', behind: 'r-hero' });
    expect(again.issues).toEqual([]);
    expect(again.steps[0]?.command).toBe('setTreeNode');
    expect(again.steps.some(({ command }) => command === 'patchTreeNode')).toBe(false);
  });

  it('builds a mural section from catalog textures, and refuses a scene "into" a region', () => {
    const mural = door(styleKernel(), 'media.add', { kind: 'scene', scene: 'mural', images: 'catalog:cafe', after: 'r-hero' });
    expect(mural.issues).toEqual([]);
    expect(mural.steps[0]?.args).toMatchObject({ index: 2 });
    const tree = insertedTree(mural.steps);
    const layer = elements(tree).find((node) => node.attributes?.['data-ck-scene'] === 'mural');
    expect(layer?.children?.length).toBeGreaterThan(1);
    expect(door(styleKernel(), 'media.add', { kind: 'scene', scene: 'mural', into: 'r-story' }).issues[0]).toMatch(/put it "behind"/u);
    expect(door(styleKernel(), 'media.add', { kind: 'scene' }).issues[0]).toMatch(/"scene" is required/u);
  });
});

describe('media.add widgets', () => {
  it('builds compare, pricing, map and lottie sections the door accepts', () => {
    const inputs = [
      { kind: 'compare', images: 'catalog:construction' },
      { kind: 'compare', before: '/uploads/before.jpg', after: '/uploads/after.jpg' },
      { kind: 'pricing', plans: [{ name: 'Basic', a: '9 JD', b: '90 JD' }, { name: 'Pro', a: 19, b: 190, features: ['Support'] }] },
      { kind: 'map', address: 'Rainbow Street, Amman' },
      { kind: 'lottie', src: 'https://cdn.example.com/anim.json', poster: 'catalog:cafe' },
    ];
    for (const input of inputs) {
      const result = door(styleKernel(), 'media.add', input);
      expect(result.issues, input.kind).toEqual([]);
      expect(result.steps[0]?.command, input.kind).toBe('insertNode');
    }
    expect(door(styleKernel(), 'media.add', { kind: 'pricing', plans: [] }).issues[0]).toMatch(/"plans" is 1-4/u);
    expect(door(styleKernel(), 'media.add', { kind: 'map' }).issues[0]).toMatch(/"address" is required/u);
    expect(door(styleKernel(), 'media.add', { kind: 'lottie', src: 'https://x.example/a.gif' }).issues[0]).toMatch(/Lottie \.json/u);
  });
});

describe('motion.add', () => {
  it('sets data-ck-timeline and removes data-ck-motion in the same step (acceptance 5)', () => {
    const kernel = styleKernel({ locale: 'ar' });
    // First an entrance preset on the heading, then the timeline replaces it.
    kernel.dispatchGroup(
      [{ command: 'patchTreeNode', args: { id: 'r-hero', path: [0, 0], attributes: { 'data-ck-motion': 'fade-up' } } }],
      { author: 'user', label: 'Entrance' },
    );
    expect(JSON.stringify(treeOf(kernel, 'r-hero'))).toContain('fade-up');
    const result = door(kernel, 'motion.add', { id: 'r-hero', find: 'قهوة تُحمّص كل صباح', recipe: 'split-reveal', scrub: false });
    expect(result.issues).toEqual([]);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      command: 'patchTreeNode',
      args: { id: 'r-hero', attributes: { 'data-ck-timeline': 'split-reveal', 'data-ck-scrub': 'false', 'data-ck-motion': null } },
    });
    expect(result.steps[0]?.title).toMatch(/^حركة سينمائية/u);
  });

  it('defaults to the region outer element, marks parallax layers, and refuses with repair text', () => {
    const kernel = styleKernel();
    const depth = door(kernel, 'motion.add', { id: 'r-hero', recipe: 'parallax-depth' });
    expect(depth.issues).toEqual([]);
    expect(depth.steps[0]?.args).toMatchObject({ path: [0], attributes: { 'data-ck-timeline': 'parallax-depth' } });
    expect(depth.steps.slice(1).every(({ args }) => typeof (args['attributes'] as Record<string, string>)['data-ck-depth'] === 'string')).toBe(true);
    expect(door(kernel, 'motion.add', { id: 'r-hero', recipe: 'spin' }).issues[0]).toMatch(/"recipe" is one of split-reveal/u);
    expect(door(kernel, 'motion.add', { id: 'r-hero', recipe: 'velocity-marquee' }).issues[0]).toMatch(/existing marquee/u);
    expect(door(kernel, 'motion.add', { id: 'nope', recipe: 'stagger-in' }).issues[0]).toMatch(/not a composed region/u);
  });
});

describe('readMedia — zero-token readings', () => {
  const phrases: readonly (readonly [string, 'ar' | 'en', string, string])[] = [
    ['ضيف معرض صور للمطعم', 'ar', 'أُضيف معرض صور', 'insertNode'],
    ['حط معرض صور متداخل عن الطعام', 'ar', 'أُضيف معرض صور', 'insertNode'],
    ['add a photo gallery', 'en', 'Gallery added', 'insertNode'],
    ['add a masonry gallery of food', 'en', 'Gallery added', 'insertNode'],
    ['حط فيديو https://youtu.be/dQw4w9WgXcQ', 'ar', 'أُضيف فيديو', 'insertNode'],
    ['add video https://cdn.example.com/Clip.mp4', 'en', 'Video added', 'insertNode'],
    ['فيديو خلفية للهيرو https://cdn.example.com/loop.mp4', 'ar', 'أُضيف فيديو خلفية', 'insertTreeNode'],
    ['خلفية متحركة للهيرو', 'ar', 'أُضيفت خلفية متحركة', 'insertTreeNode'],
    ['ضيف خلفية متحركة بالجزيئات', 'ar', 'أُضيفت خلفية متحركة', 'insertTreeNode'],
    ['add an animated gradient background', 'en', 'Animated background added', 'insertTreeNode'],
    ['جدارية متحركة', 'ar', 'أُضيفت جدارية متحركة', 'insertNode'],
    ['قبل وبعد للمطعم', 'ar', 'أُضيفت مقارنة قبل وبعد', 'insertNode'],
    ['خريطة شارع الرينبو، عمّان', 'ar', 'أُضيفت خريطة', 'insertNode'],
    ['add a map of Rainbow Street, Amman', 'en', 'Map added', 'insertNode'],
  ];

  it.each(phrases)('«%s» lands as a validated plan that changes the look', (request, locale, label, command) => {
    const kernel = styleKernel({ locale });
    const direct = tryDirectTool(request, kernel);
    expect(direct?.label).toBe(label);
    expect(direct?.plan.commands[0]?.command).toBe(command);
    expect(planChangesLook(direct?.plan.commands ?? [], kernel)).toBe(true);
  });

  it('keeps the typed spelling of a URL and an address (folding lowercases and rewrites letters)', () => {
    const video = readMedia('add video https://cdn.example.com/clip.mp4', styleKernel(), 'add video https://cdn.example.com/Clip.mp4');
    expect(video?.calls[0]?.input).toMatchObject({ url: 'https://cdn.example.com/Clip.mp4' });
    const map = tryDirectTool('خريطة شارع الرينبو، عمّان', styleKernel({ locale: 'ar' }));
    expect(JSON.stringify(map?.plan)).toContain(encodeURIComponent('شارع الرينبو، عمّان'));
    const scene = tryDirectTool('خلفية متحركة بالتدرج', styleKernel({ locale: 'ar' }));
    expect(JSON.stringify(scene?.plan)).toContain('mesh-gradient');
  });

  it('returns undefined for what it does not read in full', () => {
    const kernel = styleKernel();
    for (const request of [
      'حط فيديو',
      'add a video',
      'add video of our team',
      'ضيف معرض صور جميل',
      'make the gallery masonry',
      'make the gallery bigger',
      'خريطة الموقع',
      'map out a plan for the launch',
      'add a nice gallery',
      'معرض صور للمطعم احذفه',
    ]) {
      expect(tryDirectTool(request, kernel), request).toBeUndefined();
    }
  });
});

function rootCount(kernel: BuilderKernel): number {
  const slots = kernel.getDocument().nodes['root']?.slots as Record<string, readonly string[] | undefined> | undefined;
  return slots?.['default']?.length ?? 0;
}

describe('runAiAgent — a media request is zero tokens and one Undo (acceptance 1)', () => {
  it('«ضيف معرض صور للمطعم» applies with no provider call', async () => {
    let calls = 0;
    const provider: AiPlanProvider = {
      propose: () => {
        calls += 1;
        return Promise.reject(new Error('A direct media reading must not ask the provider.'));
      },
    };
    const kernel = styleKernel({ locale: 'ar' });
    const before = rootCount(kernel);
    const result = await runAiAgent({
      runId: 'media-gallery',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'ضيف معرض صور للمطعم',
      apply: 'auto',
      validationPorts: { clock: fixedClock(2), ids: seededIds('media-run') },
    });
    expect(calls).toBe(0);
    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(kernel.transactions()).toHaveLength(1);
    expect(rootCount(kernel)).toBe(before + 1);
    kernel.undo();
    expect(rootCount(kernel)).toBe(before);
  });
});

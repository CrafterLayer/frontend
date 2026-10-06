import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  CUSTOM_CODE_EFFECTS,
  CUSTOM_CODE_HOVER_PRESETS,
  CUSTOM_CODE_MOTION_PRESETS,
  setUtilityClassOracle,
  treeNodeAt,
  type CustomCodeElement,
  type CustomCodeRoot,
} from '@craftkit/builder-schema';

import { validateAiPlan } from '../plan/validate-plan';
import { CAFE_PHOTO } from '../tools/agent/agent-tools.fixtures';
import { AGENT_TOOLS } from '../tools/agent/registry';
import type { AgentTool, AgentToolContext } from '../tools/agent/types';
import {
  elementAnimateTool,
  elementAttrTool,
  elementDuplicateTool,
  elementEffectTool,
  elementInsertTool,
  elementMoveTool,
  elementRemoveTool,
  elementStyleTool,
  elementWrapTool,
  libraryIdFor,
  liveToolContext,
  paletteSetTool,
  runStyleTool,
  STYLE_AGENT_TOOLS,
  styleApplyTool,
  styleDefineTool,
  treeWritesOf,
} from './index';
import { permissiveOracle, styleKernel, styleSite, treeOf } from './style-tools.fixtures';

/*
  P10 (style-manager DESIGN.md §D.3): every tool lands as ONE labelled
  transaction through the tree / library commands, and every refusal says
  what is wrong and what to send. Fixture page (agent-tools.fixtures):
    r-hero  [0] section > [0,0] h1 "Fresh coffee daily", [0,1] p, [0,2] img, [0,3] a > [0,3,0] icon
    r-menu  [0] section > [0,0] h2 "Our menu", [0,1] p "Espresso", [0,2] p "Latte", [0,3] icon
    r-story [0] section > [0,0] h2 "Our story", [0,1] p "Since 1998."
*/

function element(tree: CustomCodeRoot, path: readonly number[]): CustomCodeElement {
  const node = treeNodeAt(tree, path);
  if (node?.kind !== 'element') throw new Error(`no element at ${path.join(',')}`);
  return node;
}

function refusal<I>(tool: AgentTool<I>, input: unknown, context?: AgentToolContext): string {
  const parsed = tool.parse(input);
  if (!parsed.ok) return parsed.error;
  if (context === undefined) throw new Error('parsed; pass a context to run');
  const run = tool.run(parsed.value, context);
  if (run.ok) throw new Error(`expected a refusal, got ${JSON.stringify(run.steps)}`);
  return run.error;
}

/** Lands a tool and asserts the commit law: one new transaction, labelled, author ai. */
function land<I>(kernel: ReturnType<typeof styleKernel>, tool: AgentTool<I>, input: unknown) {
  const before = kernel.transactions().length;
  const result = runStyleTool(kernel, tool, input);
  if (!result.ok) throw new Error(result.error);
  expect(kernel.transactions().length).toBe(before + 1);
  expect(result.label.length).toBeGreaterThan(0);
  return result;
}

beforeAll(() => {
  setUtilityClassOracle(permissiveOracle);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

describe('the catalog', () => {
  it('exports 13 tools, each registered exactly once in the agent registry', () => {
    const names = STYLE_AGENT_TOOLS.map(({ name }) => name);
    expect(names).toEqual([
      'element.style',
      'element.animate',
      'element.insert',
      'element.remove',
      'element.move',
      'element.duplicate',
      'element.wrap',
      'element.attr',
      'element.effect',
      'style.define',
      'style.apply',
      'palette.set',
      'block.convert',
    ]);
    expect(new Set(names).size).toBe(names.length);
    const registered = AGENT_TOOLS.map(({ name }) => name);
    expect(new Set(registered).size).toBe(registered.length);
    expect(names.filter((name) => !registered.includes(name))).toEqual([]);
  });

  it('element tools share the builtin element lanes', () => {
    for (const tool of STYLE_AGENT_TOOLS.filter(({ name }) => name.startsWith('element.'))) {
      expect(tool.lanes).toEqual(['edit', 'section']);
    }
  });
});

describe('element.style', () => {
  it('writes classes through the engine as one patchTreeNode, one Undo', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementStyleTool, {
      id: 'r-hero',
      find: 'Fresh coffee daily',
      styles: [
        { property: 'fontSize', value: '6xl' },
        { property: 'textColor', value: 'accent' },
        { property: 'padding', value: '4', side: 'inline', bucket: 'mobile' },
        { property: 'backgroundColor', value: 'accent/10', state: 'hover' },
      ],
    });
    expect(result.steps).toMatchSnapshot();
    const h1 = element(treeOf(kernel, 'r-hero'), [0, 0]);
    const classes = (h1.className ?? '').split(' ');
    expect(classes).toContain('text-6xl');
    expect(classes).not.toContain('text-5xl');
    expect(classes).toContain('text-accent');
    expect(classes).toContain('max-md:px-4');
    expect(classes).toContain('hover:bg-accent/10');
    expect(result.label).toMatch(/· Heading 'Fresh coffee daily'$/u);
    kernel.undo();
    expect(element(treeOf(kernel, 'r-hero'), [0, 0]).className).toBe('text-5xl');
  });

  it('takes exact values, palette colours and a direction', () => {
    const kernel = styleKernel();
    land(kernel, elementStyleTool, {
      id: 'r-story',
      path: [0, 0],
      styles: [
        { property: 'padding', value: '17px', side: 'block-start' },
        { property: 'backgroundColor', value: 'palette:brand-600' },
        { property: 'direction', value: 'rtl' },
      ],
    });
    const h2 = element(treeOf(kernel, 'r-story'), [0, 0]);
    expect(h2.className).toContain('pbs-[17px]');
    expect(h2.className).toContain('bg-(--ck-c-brand-600)');
    expect(h2.attributes?.dir).toBe('rtl');
  });

  it('replaces a physical class with its logical twin', () => {
    const kernel = styleKernel();
    land(kernel, elementStyleTool, { id: 'r-hero', path: [0], styles: [{ property: 'textAlign', value: 'start' }] });
    const section = element(treeOf(kernel, 'r-hero'), [0]);
    expect(section.className).toContain('text-start');
    expect(section.className).not.toContain('text-left');
  });

  it('refuses with repair-ready reasons', () => {
    const kernel = styleKernel();
    const context = liveToolContext(kernel);
    expect(refusal(elementStyleTool, { id: 'r-hero', find: 'x', styles: [], colour: 'red' })).toMatch(/unknown keys colour/u);
    expect(refusal(elementStyleTool, { id: 'r-hero', path: [0], find: 'x', styles: [{ property: 'gap', value: '4' }] })).toMatch(/one of them/u);
    expect(refusal(elementStyleTool, { id: 'r-hero', path: [0], styles: [{ property: 'colour', value: 'red' }] })).toMatch(/"property" is one of .*padding/u);
    expect(refusal(elementStyleTool, { id: 'r-hero', path: [0], styles: [{ property: 'motion', value: 'fade' }] })).toMatch(/use element\.animate/u);
    expect(refusal(elementStyleTool, { id: 'r-hero', path: [0], styles: [{ property: 'gap', value: '4', side: 'inline' }] })).toMatch(/no sides/u);
    expect(refusal(elementStyleTool, { id: 'r-nope', path: [0], styles: [{ property: 'gap', value: '4' }] }, context)).toMatch(/send one of: r-header \(Header\)/u);
    expect(refusal(elementStyleTool, { id: 'r-hero', path: [0, 9], styles: [{ property: 'gap', value: '4' }] }, context)).toMatch(/no element at \[0,9\]/u);
    expect(refusal(elementStyleTool, { id: 'r-hero', find: 'Nope', styles: [{ property: 'gap', value: '4' }] }, context)).toMatch(/quote the exact text, or send "path"/u);
  });

  it('refuses a value the page cannot style, naming the property', () => {
    setUtilityClassOracle(undefined);
    try {
      const kernel = styleKernel();
      const error = refusal(elementStyleTool, { id: 'r-hero', path: [0], styles: [{ property: 'padding', value: '17px' }] }, liveToolContext(kernel));
      expect(error).toMatch(/p-\[17px\].*Padding/u);
    } finally {
      setUtilityClassOracle(permissiveOracle);
    }
  });

  it('refuses an ambiguous find with the paths it matched', () => {
    const kernel = styleKernel();
    land(kernel, elementDuplicateTool, { id: 'r-story', find: 'Since 1998.' });
    const error = refusal(elementStyleTool, { id: 'r-story', find: 'Since 1998.', styles: [{ property: 'gap', value: '4' }] }, liveToolContext(kernel));
    expect(error).toMatch(/matches 2 elements .*\[0,1\], \[0,2\].*send "path"/u);
  });

  it('passes the plan door unchanged (the steps validate as an ordinary plan)', () => {
    const kernel = styleKernel();
    const parsed = elementStyleTool.parse({ id: 'r-story', find: 'Our story', styles: [{ property: 'fontWeight', value: 'bold' }] });
    if (!parsed.ok) throw new Error(parsed.error);
    const run = elementStyleTool.run(parsed.value, liveToolContext(kernel));
    if (!run.ok) throw new Error(run.error);
    const result = validateAiPlan(
      { rationale: 'bold the story heading', commands: run.steps.map(({ command, args }) => ({ command, args })) },
      kernel,
      { clock: fixedClock(2), ids: seededIds('style-door') },
    );
    expect(result.ok, result.ok ? '' : result.issues[0]?.message).toBe(true);
  });
});

describe('element.animate', () => {
  it('attaches a preset, a hover and params by name in one transaction', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementAnimateTool, {
      id: 'r-hero',
      find: 'Fresh coffee daily',
      preset: 'fade-up',
      hover: 'lift',
      delay: 2,
      ease: 'spring',
      once: true,
    });
    expect(result.steps).toMatchSnapshot();
    expect(element(treeOf(kernel, 'r-hero'), [0, 0]).attributes).toMatchObject({
      'data-ck-motion': 'fade-up',
      'data-ck-hover': 'lift',
      'data-ck-delay': '2',
      'data-ck-ease': 'spring',
      'data-ck-once': 'true',
    });
  });

  it('accepts every preset and hover name the vocabulary lists', () => {
    for (const preset of CUSTOM_CODE_MOTION_PRESETS) {
      expect(elementAnimateTool.parse({ id: 'r', path: [0], preset }).ok, preset).toBe(true);
    }
    for (const hover of CUSTOM_CODE_HOVER_PRESETS) {
      expect(elementAnimateTool.parse({ id: 'r', path: [0], hover }).ok, hover).toBe(true);
    }
  });

  it('removing both names clears every param', () => {
    const kernel = styleKernel();
    land(kernel, elementAnimateTool, { id: 'r-story', path: [0], preset: 'stagger-up', stagger: 'md', trigger: 'load' });
    land(kernel, elementAnimateTool, { id: 'r-story', path: [0], preset: null });
    const section = element(treeOf(kernel, 'r-story'), [0]);
    expect(Object.keys(section.attributes ?? {}).filter((name) => name.startsWith('data-ck-'))).toEqual([]);
  });

  it('refuses with repair-ready reasons', () => {
    const context = liveToolContext(styleKernel());
    expect(refusal(elementAnimateTool, { id: 'r-hero', path: [0], preset: 'explode' })).toMatch(/"preset" is one of fade, fade-up/u);
    expect(refusal(elementAnimateTool, { id: 'r-hero', path: [0], preset: 'parallax-slow', trigger: 'click' })).toMatch(/scroll preset and plays on view or scroll/u);
    expect(refusal(elementAnimateTool, { id: 'r-hero', path: [0], preset: 'fade-up', stagger: 'md' })).toMatch(/tunes a stagger preset/u);
    expect(refusal(elementAnimateTool, { id: 'r-hero', path: [0] })).toMatch(/name a "preset" or "hover"/u);
    expect(refusal(elementAnimateTool, { id: 'r-hero', path: [0], delay: 3 }, context)).toMatch(/has none · send "preset" or "hover"/u);
    expect(refusal(elementAnimateTool, { id: 'r-hero', path: [0, 3, 0], preset: 'float' }, context)).toMatch(/an icon · animate the element around it/u);
    expect(refusal(elementAnimateTool, { id: 'r-hero', path: [0], preset: 'fade', trigger: 'click', target: 'nowhere' }, context)).toMatch(/data-ck-target='nowhere'/u);
    expect(refusal(elementAnimateTool, { id: 'r-hero', path: [0], preset: 'fade', target: 'hero' }, context)).toMatch(/data-ck-trigger='click'/u);
  });
});

describe('element.insert', () => {
  it('parses markup and inserts each top-level node after an anchor, as one group', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementInsertTool, {
      id: 'r-story',
      after: 'Our story',
      markup: "<p class='text-lg'>Fresh beans</p><a class='ck-btn' href='#menu'>Order<icon name='arrow-right'/></a>",
    });
    expect(result.steps).toMatchSnapshot();
    const tree = treeOf(kernel, 'r-story');
    expect(element(tree, [0, 1]).text).toBe('Fresh beans');
    expect(element(tree, [0, 2]).tag).toBe('a');
    expect(element(tree, [0, 3]).text).toBe('Since 1998.');
    kernel.undo();
    expect(element(treeOf(kernel, 'r-story'), [0, 1]).text).toBe('Since 1998.');
  });

  it('appends into a parent, or places at an index', () => {
    const kernel = styleKernel();
    land(kernel, elementInsertTool, { id: 'r-story', parent: [0], markup: '<p>Last</p>' });
    land(kernel, elementInsertTool, { id: 'r-story', parent: [0], index: 0, markup: '<p>First</p>' });
    const children = (element(treeOf(kernel, 'r-story'), [0]).children ?? []).map((node) => (node.kind === 'element' ? node.text : ''));
    expect(children).toEqual(['First', 'Our story', 'Since 1998.', 'Last']);
  });

  it('refuses with repair-ready reasons', () => {
    const context = liveToolContext(styleKernel());
    expect(refusal(elementInsertTool, { id: 'r-story', after: [0, 0], before: [0, 1], markup: '<p>x</p>' })).toMatch(/exactly one of "parent"/u);
    expect(refusal(elementInsertTool, { id: 'r-story', after: [0, 0], markup: '   ' })).toMatch(/"markup" must be the new elements/u);
    expect(refusal(elementInsertTool, { id: 'r-story', parent: [0], index: 9, markup: '<p>x</p>' }, context)).toMatch(/past the end/u);
    expect(refusal(elementInsertTool, { id: 'r-story', parent: [0], markup: '<marquee>x</marquee>' })).toMatch(/<marquee> is not an element a region admits/u);
    expect(refusal(elementInsertTool, { id: 'r-story', parent: [0], markup: "<p onclick='x()'>x</p>" }, context)).toMatch(/onclick/u);
  });
});

describe('element.remove / move / duplicate / wrap', () => {
  it('remove deletes one element in one transaction', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementRemoveTool, { id: 'r-story', find: 'Since 1998.' });
    expect(result.steps).toMatchSnapshot();
    expect(element(treeOf(kernel, 'r-story'), [0]).children).toHaveLength(1);
  });

  it('move places an element before a sibling, and across regions', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementMoveTool, { id: 'r-story', find: 'Since 1998.', before: [0, 0] });
    expect(result.steps).toMatchSnapshot();
    expect(element(treeOf(kernel, 'r-story'), [0, 0]).text).toBe('Since 1998.');
    land(kernel, elementMoveTool, { id: 'r-story', path: [0, 0], to: { id: 'r-menu', parent: [0], index: 1 } });
    expect(element(treeOf(kernel, 'r-menu'), [0, 1]).text).toBe('Since 1998.');
    expect(element(treeOf(kernel, 'r-story'), [0]).children).toHaveLength(1);
  });

  it('move after a later sibling lands right after it', () => {
    const kernel = styleKernel();
    land(kernel, elementMoveTool, { id: 'r-menu', find: 'Our menu', after: [0, 2] });
    const texts = (element(treeOf(kernel, 'r-menu'), [0]).children ?? []).map((node) => (node.kind === 'element' ? node.text : node.kind));
    expect(texts).toEqual(['Espresso', 'Latte', 'Our menu', 'icon']);
  });

  it('duplicate inserts a deep copy after the element', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementDuplicateTool, { id: 'r-hero', path: [0, 3] });
    expect(result.steps).toMatchSnapshot();
    expect(element(treeOf(kernel, 'r-hero'), [0, 4]).text).toBe('See the menu');
  });

  it('wrap puts contiguous siblings in a new container', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementWrapTool, { id: 'r-story', paths: [[0, 0], [0, 1]], wrapper: { tag: 'div', className: 'flex flex-col gap-4' } });
    expect(result.steps).toMatchSnapshot();
    const wrapper = element(treeOf(kernel, 'r-story'), [0, 0]);
    expect(wrapper.tag).toBe('div');
    expect(wrapper.children).toHaveLength(2);
  });

  it('refuse with repair-ready reasons', () => {
    const context = liveToolContext(styleKernel());
    expect(refusal(elementRemoveTool, { id: 'r-story', path: [0, 7] }, context)).toMatch(/no element at \[0,7\]/u);
    expect(refusal(elementMoveTool, { id: 'r-story', path: [0], to: { parent: [0, 0], index: 0 } }, context)).toMatch(/into itself/u);
    expect(refusal(elementMoveTool, { id: 'r-story', path: [0, 1], after: [0, 1] }, context)).toMatch(/cannot move next to itself/u);
    expect(refusal(elementMoveTool, { id: 'r-story', path: [0, 1] })).toMatch(/exactly one of "to"/u);
    expect(refusal(elementWrapTool, { id: 'r-hero', paths: [[0, 0], [0, 2]], wrapper: { tag: 'div' } }, context)).toMatch(/not side by side .* send a run of neighbouring siblings/u);
    expect(refusal(elementWrapTool, { id: 'r-hero', path: [0, 0], wrapper: { tag: 'blink' } })).toMatch(/element tag/u);
  });
});

describe('element.attr / element.effect', () => {
  it('attr sets and removes attributes the door admits', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementAttrTool, { id: 'r-hero', find: CAFE_PHOTO, set: { alt: 'A cup of coffee', loading: 'lazy' } });
    expect(result.steps).toMatchSnapshot();
    expect(element(treeOf(kernel, 'r-hero'), [0, 2]).attributes).toMatchObject({ alt: 'A cup of coffee', loading: 'lazy' });
    land(kernel, elementAttrTool, { id: 'r-hero', path: [0, 2], set: { loading: null } });
    expect(element(treeOf(kernel, 'r-hero'), [0, 2]).attributes?.loading).toBeUndefined();
  });

  it('attr refuses what belongs to another tool, and what the door refuses', () => {
    const context = liveToolContext(styleKernel());
    expect(refusal(elementAttrTool, { id: 'r-hero', path: [0], set: { class: 'p-4' } })).toMatch(/use element\.style/u);
    expect(refusal(elementAttrTool, { id: 'r-hero', path: [0], set: { style: 'color:red' } })).toMatch(/no style attribute/u);
    expect(refusal(elementAttrTool, { id: 'r-hero', path: [0], set: { 'data-ck-motion': 'fade' } })).toMatch(/element\.animate/u);
    expect(refusal(elementAttrTool, { id: 'r-hero', path: [0], set: { onclick: 'x()' } }, context)).toMatch(/onclick/u);
  });

  it('effect adds and removes ck-fx hooks', () => {
    const kernel = styleKernel();
    const result = land(kernel, elementEffectTool, { id: 'r-hero', path: [0], add: ['glass', 'ck-fx-noise'] });
    expect(result.steps).toMatchSnapshot();
    expect(element(treeOf(kernel, 'r-hero'), [0]).className).toBe('py-16 text-left ck-fx-glass ck-fx-noise');
    land(kernel, elementEffectTool, { id: 'r-hero', path: [0], remove: 'glass' });
    expect(element(treeOf(kernel, 'r-hero'), [0]).className).toBe('py-16 text-left ck-fx-noise');
  });

  it('effect knows every effect and refuses others', () => {
    for (const effect of CUSTOM_CODE_EFFECTS) {
      expect(elementEffectTool.parse({ id: 'r', path: [0], add: [effect] }).ok, effect).toBe(true);
    }
    expect(refusal(elementEffectTool, { id: 'r', path: [0], add: ['sparkle'] })).toMatch(/not an effect · use one of glass/u);
    expect(refusal(elementEffectTool, { id: 'r', path: [0], add: ['glass'], remove: ['glass'] })).toMatch(/both/u);
  });
});

describe('style.define / style.apply / palette.set (site library through the page lens)', () => {
  it('define + apply land as ONE transaction mixing site and page steps', () => {
    const { site, page } = styleSite();
    const define = styleDefineTool.parse({ name: 'Card featured', className: 'rounded-xl bg-surface p-6' });
    const apply = styleApplyTool.parse({ style: 'Card featured', targets: [{ id: 'r-menu', find: 'Espresso' }, { id: 'r-menu', find: 'Latte' }] });
    if (!define.ok || !apply.ok) throw new Error('parse');
    const context = liveToolContext(page);
    const defined = styleDefineTool.run(define.value, context);
    const applied = styleApplyTool.run(apply.value, context);
    if (!defined.ok) throw new Error(defined.error);
    if (!applied.ok) throw new Error(applied.error);
    expect([...defined.steps, ...applied.steps]).toMatchSnapshot();
    const before = site.transactions().length;
    page.dispatchGroup([...defined.steps, ...applied.steps].map(({ command, args }) => ({ command, args })), { author: 'ai', label: 'Card featured' });
    expect(site.transactions().length).toBe(before + 1);
    expect(site.getSite().library?.styles?.['card-featured']?.className).toBe('rounded-xl bg-surface p-6');
    expect(element(treeOf(page, 'r-menu'), [0, 1]).className).toBe('ck-s-card-featured');
    expect(element(treeOf(page, 'r-menu'), [0, 2]).className).toMatch(/^ck-s-card-featured rounded-l-lg/u);
    site.undo();
    expect(site.getSite().library?.styles?.['card-featured']).toBeUndefined();
    expect(element(treeOf(page, 'r-menu'), [0, 1]).className).toBeUndefined();
  });

  it('the plan door accepts the site steps on a page lens (fix pass: it used to refuse them)', () => {
    const { page } = styleSite();
    const define = styleDefineTool.parse({ name: 'Card featured', className: 'rounded-xl bg-surface p-6' });
    const apply = styleApplyTool.parse({ style: 'Card featured', targets: [{ id: 'r-menu', find: 'Espresso' }] });
    if (!define.ok || !apply.ok) throw new Error('parse');
    const context = liveToolContext(page);
    const defined = styleDefineTool.run(define.value, context);
    const applied = styleApplyTool.run(apply.value, context);
    if (!defined.ok || !applied.ok) throw new Error('run');
    const steps = [...defined.steps, ...applied.steps].map(({ command, args }) => ({ command, args }));
    const ports = { clock: fixedClock(9), ids: seededIds('site-door') };
    expect(validateAiPlan({ commands: steps }, page, ports).ok).toBe(true);
    // A site step's args are still judged by its schema.
    const bad = validateAiPlan({ commands: [{ command: 'setNamedStyle', args: { style: { id: 1 } } }] }, page, ports);
    expect(bad.ok ? 'ok' : bad.issues[0]?.code).toBe('invalid-args');
  });

  it('a non-Latin name derives the same id in both tools', () => {
    const id = libraryIdFor('بطاقة مميزة');
    expect(id).toMatch(/^s-[0-9a-z]+$/u);
    expect(libraryIdFor('بطاقة مميزة')).toBe(id);
    const parsed = styleApplyTool.parse({ style: 'بطاقة مميزة', targets: [{ id: 'r', path: [0] }] });
    expect(parsed.ok && parsed.value.style).toBe(id);
  });

  it('palette.set with a ramp adds the colour and its 50-950 shades in one transaction', () => {
    const { site, page } = styleSite();
    const result = runStyleTool(page, paletteSetTool, { colors: [{ name: 'Brand', value: '#0f766e' }, { name: 'Ink', value: 'oklch(25% 0.02 260)' }], ramp: 'Brand' });
    if (!result.ok) throw new Error(result.error);
    expect(result.steps).toHaveLength(13);
    expect(result.steps).toMatchSnapshot();
    const palette = site.getSite().library?.palette ?? [];
    expect(palette.map(({ id }) => id)).toEqual([
      'brand',
      'ink',
      ...['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'].map((step) => `brand-${step}`),
    ]);
    expect(palette.find(({ id }) => id === 'brand-50')?.group).toBe('brand');
    expect(site.transactions()).toHaveLength(1);
  });

  it('refuse with repair-ready reasons', () => {
    setUtilityClassOracle(undefined);
    try {
      const parsed = styleDefineTool.parse({ name: 'Bad', className: 'p-4 bogus-thing' });
      if (!parsed.ok) throw new Error(parsed.error);
      const run = styleDefineTool.run(parsed.value, liveToolContext(styleKernel()));
      expect(run.ok ? '' : run.error).toMatch(/bogus-thing/u);
    } finally {
      setUtilityClassOracle(permissiveOracle);
    }
    expect(refusal(styleDefineTool, { name: 'x', className: 'p-4', id: 'y' })).toMatch(/unknown keys id/u);
    expect(refusal(paletteSetTool, { colors: [{ name: 'Bad', value: 'red;}' }] })).toMatch(/one colour/u);
    expect(refusal(paletteSetTool, { colors: [{ name: 'Brand', value: '#0f766e' }], ramp: 'Accent' })).toMatch(/not in "colors"/u);
    const context = liveToolContext(styleKernel());
    expect(refusal(styleApplyTool, { style: 'card', targets: [{ id: 'r-menu', path: [0, 3] }], remove: true }, context)).toMatch(/none of the targets carries ck-s-card/u);
  });
});

describe('composition across tools in one plan (the expand.ts fold P11 wires)', () => {
  it('treeWritesOf lets a later tool read the tree an earlier tree command left', () => {
    const kernel = styleKernel();
    const written = new Map<string, unknown>();
    const readProp = (id: string, key: string): unknown =>
      written.get(`${id}|${key}`) ?? kernel.getDocument().nodes[id]?.props[key];
    const context: AgentToolContext = { ...liveToolContext(kernel), readProp };
    const remember = (step: { command: string; args: Record<string, unknown> }): void => {
      for (const [id, tree] of treeWritesOf(step, (id) => readProp(id, 'tree'))) written.set(`${id}|tree`, tree);
    };
    const steps = [];
    for (const [tool, input] of [
      [elementStyleTool, { id: 'r-story', find: 'Our story', styles: [{ property: 'fontSize', value: '5xl' }] }],
      [elementStyleTool, { id: 'r-story', find: 'Our story', styles: [{ property: 'fontWeight', value: 'bold' }] }],
      [elementInsertTool, { id: 'r-story', before: 'Our story', markup: '<p>Kicker</p>' }],
      [elementAnimateTool, { id: 'r-story', find: 'Our story', preset: 'split-words' }],
    ] as const) {
      const parsed = (tool as AgentTool).parse(input);
      if (!parsed.ok) throw new Error(parsed.error);
      const run = (tool as AgentTool).run(parsed.value, context);
      if (!run.ok) throw new Error(run.error);
      for (const produced of run.steps) remember(produced);
      steps.push(...run.steps);
    }
    kernel.dispatchGroup(steps.map(({ command, args }) => ({ command, args })), { author: 'ai', label: 'Plan' });
    const heading = element(treeOf(kernel, 'r-story'), [0, 1]);
    expect(heading.text).toBe('Our story');
    expect(heading.className).toContain('text-5xl');
    expect(heading.className).toContain('font-bold');
    expect(heading.attributes?.['data-ck-motion']).toBe('split-words');
  });

  it('treeWritesOf ignores other commands and refused steps', () => {
    const kernel = styleKernel();
    const read = (id: string): unknown => kernel.getDocument().nodes[id]?.props['tree'];
    expect(treeWritesOf({ command: 'setProp', args: { id: 'r-story', key: 'label', value: 'x' } }, read).size).toBe(0);
    expect(treeWritesOf({ command: 'removeTreeNode', args: { id: 'r-story', path: [9] } }, read).size).toBe(0);
    expect([...treeWritesOf({ command: 'moveTreeNode', args: { id: 'r-story', from: [0, 1], to: { id: 'r-menu', parent: [0], index: 0 } } }, read).keys()]).toEqual(['r-story', 'r-menu']);
  });
});

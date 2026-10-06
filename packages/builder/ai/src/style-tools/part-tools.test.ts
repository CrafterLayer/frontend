import { describe, expect, it } from 'vitest';

import { systemClock, type BuilderKernel } from '@craftkit/builder-core';

import { validateAiPlan } from '../plan/validate-plan';
import { agentToolPrompt, agentToolPromptMaxChars } from '../tools/agent/catalog-prompt';
import { expandAgentTools } from '../tools/agent/expand';
import { agentTool } from '../tools/agent/registry';
import type { AgentTool, AgentToolStep } from '../tools/agent/types';
import { STYLE_AGENT_TOOLS } from './index';
import { partsKernel } from './part-tools.fixtures';
import {
  partImageTool,
  partLinkTool,
  partListTool,
  partStyleTool,
  partTextTool,
  richTextFromPlain,
  safePartHref,
} from './part-tools';
import { liveToolContext, runStyleTool } from './run-direct';

function steps<I>(tool: AgentTool<I>, input: unknown, kernel: BuilderKernel = partsKernel()): readonly AgentToolStep[] {
  const parsed = tool.parse(input);
  if (!parsed.ok) throw new Error(`parse: ${parsed.error}`);
  const result = tool.run(parsed.value, liveToolContext(kernel));
  if (!result.ok) throw new Error(`run: ${result.error}`);
  return result.steps;
}

function refusal<I>(tool: AgentTool<I>, input: unknown, kernel: BuilderKernel = partsKernel()): string {
  const parsed = tool.parse(input);
  if (!parsed.ok) return parsed.error;
  const result = tool.run(parsed.value, liveToolContext(kernel));
  if (result.ok) throw new Error(`expected a refusal, got ${JSON.stringify(result.steps)}`);
  return result.error;
}

/** The one setProp a tool produced. */
function only(list: readonly AgentToolStep[]): AgentToolStep {
  expect(list).toHaveLength(1);
  const [step] = list;
  expect(step?.command).toBe('setProp');
  if (step === undefined) throw new Error('no step');
  return step;
}

describe('part.text', () => {
  it('sets a top-level text part in one labelled setProp', () => {
    const step = only(steps(partTextTool, { id: 'hero-1', part: 'العنوان', text: 'Welcome' }));
    expect(step.args).toEqual({ id: 'hero-1', key: 'heading', value: 'Welcome' });
    expect(step.title).toBe('Edit text · Hero heading');
  });

  it('sets a nested item text by replacing the whole top-level list', () => {
    const step = only(steps(partTextTool, { id: 'features-1', part: 'item.title', index: 1, text: 'Sound' }));
    expect(step.args['key']).toBe('items');
    expect(step.args['value']).toEqual([
      { title: 'Fast', body: 'Ships in a day.' },
      { title: 'Sound', body: 'One door for every edit.' },
      { title: 'Fast', body: 'Twice, on purpose.' },
    ]);
  });

  it('gives a rich part its text as paragraphs in the stored rich-text shape', () => {
    const step = only(steps(partTextTool, { id: 'text-1', part: 'content', text: 'One line.\nTwo lines.' }));
    expect(step.args).toEqual({
      id: 'text-1',
      key: 'content',
      value: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'One line.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Two lines.' }] },
        ],
      },
    });
  });

  it('keeps a single-line part on one line and a link part on its label', () => {
    expect(only(steps(partTextTool, { id: 'hero-1', part: 'heading', text: 'Two\nwords' })).args['value']).toBe('Two words');
    expect(only(steps(partTextTool, { id: 'cta-1', part: 'button', text: 'Go' })).args).toEqual({ id: 'cta-1', key: 'label', value: 'Go' });
  });

  it('refuses parts without text, an unchanged value and unknown keys', () => {
    expect(refusal(partTextTool, { id: 'features-1', part: 'image', text: 'x' })).toMatch(/is an image · use part\.image/u);
    expect(refusal(partTextTool, { id: 'features-1', part: 'items', text: 'x' })).toMatch(/holds no text · send one of its text parts: heading, item\.title/u);
    expect(refusal(partTextTool, { id: 'hero-1', part: 'heading', text: 'welcom' })).toMatch(/nothing to change/u);
    expect(refusal(partTextTool, { id: 'hero-1', part: 'heading', text: 'x', colour: 'red' })).toMatch(/unknown keys colour/u);
  });
});

describe('part.style', () => {
  it('styles a part through the engine in tokens mode, writing partStyles in one setProp', () => {
    const step = only(steps(partStyleTool, { id: 'hero-1', part: 'heading', style: { textColor: 'accent' } }));
    expect(step.args).toEqual({ id: 'hero-1', key: 'partStyles', value: { heading: { className: 'text-accent' } } });
    expect(step.title).toBe('Text colour · Hero heading');
  });

  it('refuses a palette colour on a registered block (the tokens law)', () => {
    expect(refusal(partStyleTool, { id: 'hero-1', part: 'heading', style: { textColor: 'red-700' } })).toMatch(/·/u);
  });

  it('styles every item of a repeated part, or this one item', () => {
    const all = only(steps(partStyleTool, { id: 'features-1', part: 'item.title', style: { textColor: 'accent' } }));
    expect(Object.keys(all.args['value'] as object)).toEqual(['item.title']);
    const one = only(steps(partStyleTool, { id: 'features-1', part: 'item.title', index: 2, style: { textColor: 'accent' } }));
    expect(Object.keys(one.args['value'] as object)).toEqual(['item.title@2']);
  });

  it('takes the direction beside the classes, still in one setProp', () => {
    const step = only(steps(partStyleTool, { id: 'hero-1', part: 'body', style: { direction: 'ltr', textColor: 'text-muted' } }));
    expect(step.args['value']).toEqual({ body: { className: 'text-text-muted', dir: 'ltr' } });
  });

  it('lands as ONE transaction and one Undo', () => {
    const kernel = partsKernel();
    const result = runStyleTool(kernel, partStyleTool, { id: 'hero-1', part: 'heading', style: { textColor: 'accent' } });
    expect(result.ok).toBe(true);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['hero-1']?.props['partStyles']).toEqual({ heading: { className: 'text-accent' } });
    kernel.undo();
    expect(kernel.getDocument().nodes['hero-1']?.props['partStyles']).toBeUndefined();
  });
});

describe('part.link', () => {
  it('sets the label and the href of an object-bound link in one setProp', () => {
    const step = only(steps(partLinkTool, { id: 'features-1', part: 'link', text: 'All of it', href: '/all' }));
    expect(step.args).toEqual({ id: 'features-1', key: 'link', value: { label: 'All of it', href: '/all' } });
  });

  it('refuses an unsafe href before anything runs', () => {
    expect(refusal(partLinkTool, { id: 'cta-1', part: 'button', href: 'javascript:alert(1)' })).toMatch(/not a safe link · send https/u);
    expect(safePartHref('//evil.example')).toBeUndefined();
    expect(safePartHref('mailto:a@b.co')).toBe('mailto:a@b.co');
  });

  it('refuses a text part', () => {
    expect(refusal(partLinkTool, { id: 'hero-1', part: 'heading', href: '/x' })).toMatch(/without a link · use part\.text/u);
  });
});

describe('part.image', () => {
  it('replaces the src in one setProp', () => {
    const step = only(steps(partImageTool, { id: 'features-1', part: 'image', src: 'https://example.com/b.jpg' }));
    expect(step.args).toEqual({ id: 'features-1', key: 'imageSrc', value: 'https://example.com/b.jpg' });
    expect(step.title).toBe('Replace image · Features image');
  });

  it('sets the alt text in one setProp', () => {
    expect(only(steps(partImageTool, { id: 'features-1', part: 'الصورة', alt: 'Hands on a keyboard' })).args).toEqual({
      id: 'features-1',
      key: 'imageAlt',
      value: 'Hands on a keyboard',
    });
  });

  it('refuses an address the page cannot load', () => {
    expect(refusal(partImageTool, { id: 'features-1', part: 'image', src: 'javascript:x' })).toMatch(/· send an https/u);
  });
});

describe('part.list', () => {
  const titles = (step: AgentToolStep) => (step.args['value'] as { title: string }[]).map(({ title }) => title);

  it('adds an item from the item schema defaults', () => {
    const step = only(steps(partListTool, { id: 'features-1', part: 'card', op: 'add', index: 3 }));
    expect(step.args['key']).toBe('items');
    expect(titles(step)).toEqual(['Fast', 'Safe', 'Fast', 'New feature']);
    expect(step.title).toBe('Add item · Features');
  });

  it('adds the item it is given', () => {
    const step = only(steps(partListTool, { id: 'features-1', part: 'items', op: 'add', index: 0, item: { title: 'First', body: 'b' } }));
    expect(titles(step)).toEqual(['First', 'Fast', 'Safe', 'Fast']);
  });

  it('duplicates, removes and moves', () => {
    expect(titles(only(steps(partListTool, { id: 'features-1', part: 'item', op: 'duplicate', index: 1 })))).toEqual(['Fast', 'Safe', 'Safe', 'Fast']);
    expect(titles(only(steps(partListTool, { id: 'features-1', part: 'item', op: 'remove', index: 0 })))).toEqual(['Safe', 'Fast']);
    expect(titles(only(steps(partListTool, { id: 'features-1', part: 'item', op: 'move', index: 1, to: 0 })))).toEqual(['Safe', 'Fast', 'Fast']);
  });

  it('refuses what is not a list, and a move without a target', () => {
    expect(refusal(partListTool, { id: 'features-1', part: 'heading', op: 'add', index: 0 })).toMatch(/not a list or an item · send one of: items, item/u);
    expect(refusal(partListTool, { id: 'features-1', part: 'item', op: 'move', index: 0 })).toMatch(/needs "to"/u);
    expect(refusal(partListTool, { id: 'features-1', part: 'item', op: 'remove', index: 9 })).toMatch(/does not exist .* · send an index/u);
  });
});

describe('the part tools in the catalog and the plan door', () => {
  it('registers every part tool in STYLE_AGENT_TOOLS and the agent registry, in the edit lane', () => {
    for (const name of ['part.text', 'part.style', 'part.link', 'part.image', 'part.list']) {
      expect(STYLE_AGENT_TOOLS.some((tool) => tool.name === name)).toBe(true);
      expect(agentTool(name)?.lanes).toEqual(['edit']);
    }
    const prompt = agentToolPrompt('edit');
    expect(prompt.length).toBeLessThanOrEqual(agentToolPromptMaxChars('edit'));
    for (const name of ['part.text', 'part.style', 'part.link', 'part.image', 'part.list']) expect(prompt).toContain(name);
  });

  it('expands a model plan step and passes the door', () => {
    const kernel = partsKernel();
    const expanded = expandAgentTools(
      {
        rationale: 'Colour the hero heading',
        commands: [{ command: 'tool', args: { name: 'part.style', input: { id: 'hero-1', part: 'heading', style: { textColor: 'accent' } } } }],
      },
      kernel,
    );
    expect(expanded.issues).toEqual([]);
    let ids = 0;
    const verdict = validateAiPlan(expanded.plan, kernel, { clock: systemClock, ids: { newId: () => `part-${String((ids += 1))}` } });
    expect(verdict.ok).toBe(true);
  });

  it('builds the stored rich-text shape from plain text', () => {
    expect(richTextFromPlain('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(richTextFromPlain('a\n\nb').content).toHaveLength(3);
  });
});

// ── block-parts (2026-10-06) ──
describe('the edit-lane prompt holds part.* and media.add signatures together (fix pass)', () => {
  it('keeps media.add, motion.add and every part.* signature within the 1600-character cap', () => {
    const prompt = agentToolPrompt('edit');
    expect(prompt.length).toBeLessThanOrEqual(agentToolPromptMaxChars('edit'));
    expect(prompt).toContain('media.add {kind,after?:id,into?:id,behind?:id,…}');
    for (const line of [
      'part.text {id,part,index?,text}',
      'part.style {id,part,index?,style}',
      'part.link {id,part,index?,text?,href?}',
      'part.image {id,part,index?,src?,alt?}',
      'part.list {id,part,op,index,to?,item?}',
    ]) {
      expect(prompt).toContain(line);
    }
  });

  // red-tests (2026-10-06): under 1400 the part.* lines took these four down to bare names.
  it('does not buy the part.* signatures with the inputs a model cannot guess', () => {
    const prompt = agentToolPrompt('edit');
    for (const line of [
      'fonts.set {display?,body?:verified family}',
      'image.set {id,find:src,subject,aspect?,alt}',
      "kit.section {id,kit,slots,heading?:'h1'|'h2'}",
      'palette.set {colors:[{name,value}],ramp?:name}',
    ]) {
      expect(prompt).toContain(line);
    }
  });
});
// ── /block-parts ──

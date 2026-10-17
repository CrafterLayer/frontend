import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';

import { validateAiPlan } from '../plan/validate-plan';
import type { AgentTool, AgentToolContext, AgentToolRun } from '../tools/agent/types';
import { instantiateKit, readKitSlots } from './instantiate';
import { sectionKit } from './kit-index';
import { kitContext, kitKernel, kitPorts, kitSamples } from './kit-testing';
import { SECTION_KIT_TOOLS } from './tools';

function tool(name: string): AgentTool {
  const found = SECTION_KIT_TOOLS.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(name);
  return found;
}

function call(name: string, input: unknown, context: AgentToolContext): AgentToolRun {
  const parsed = tool(name).parse(input);
  if (!parsed.ok) return parsed;
  return tool(name).run(parsed.value, context);
}

function land(kernel: BuilderKernel, run: AgentToolRun) {
  if (!run.ok) throw new Error(run.error);
  const plan = { rationale: 'kit', commands: run.steps.map(({ command, args }) => ({ command, args })) };
  const validation = validateAiPlan(plan, kernel, kitPorts());
  expect(validation.ok ? [] : validation.issues.map((issue) => issue.message)).toEqual([]);
  kernel.dispatchGroup(plan.commands.map(({ command, args }) => ({ command, args })));
}

describe('section kit tools', () => {
  it('are kit.section, kit.swap and kit.insert, in their lanes', () => {
    expect(SECTION_KIT_TOOLS.map(({ name }) => name)).toEqual(['kit.section', 'kit.swap', 'kit.insert']);
    expect(tool('kit.section').lanes).toEqual(expect.arrayContaining(['section', 'build', 'edit']));
    expect(tool('kit.swap').lanes).toEqual(['edit']);
    expect(tool('kit.insert').lanes).toEqual(expect.arrayContaining(['edit', 'build']));
  });

  it('kit.section fills a region, keeping its anchor, as a tree the door takes', () => {
    const kernel = kitKernel({ dir: 'rtl', lang: 'ar' });
    const kit = sectionKit('hero-split');
    if (kit === undefined) throw new Error('hero-split');
    const run = call('kit.section', { id: 'r1', kit: 'hero-split', slots: kitSamples(kit, 'ar') }, kitContext(kernel, 'ar', 'rtl'));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.steps[0]).toMatchObject({ command: 'setProp', args: { id: 'r1', key: 'tree' } });
    const tree = run.steps[0]?.args['value'];
    expect(JSON.stringify(tree)).toContain('"id":"hero"');
    expect(JSON.stringify(tree)).toContain('"tag":"h1"');
    land(kernel, run);
  });

  it('kit.section takes a missing "title" from the section’s own heading, as the skeleton placed it', () => {
    const kernel = kitKernel({
      regions: [
        {
          id: 'r1',
          tree: {
            kind: 'root',
            children: [
              {
                kind: 'element',
                tag: 'section',
                attributes: { id: 'menu' },
                children: [{ kind: 'element', tag: 'h2', text: 'Our coffees' }],
              },
            ],
          },
        },
      ],
    });
    const kit = sectionKit('cta-band');
    if (kit === undefined) throw new Error('cta-band');
    const slots = kitSamples(kit, 'en');
    delete slots['title'];
    const run = call('kit.section', { id: 'r1', kit: 'cta-band', slots }, kitContext(kernel));
    expect(run.ok ? '' : run.error).toBe('');
    if (!run.ok) return;
    expect(JSON.stringify(run.steps[0]?.args['value'])).toContain('Our coffees');
    land(kernel, run);
    // A title the writer did give is kept.
    const given = call('kit.section', { id: 'r1', kit: 'cta-band', slots: { ...slots, title: 'Taste them' } }, kitContext(kernel));
    expect(given.ok && JSON.stringify(given.steps[0]?.args['value'])).toContain('Taste them');
  });

  it('kit.section refuses a page with no kit styles, and an unknown kit or region, saying what to do', () => {
    const bare = kitKernel({ pageCss: '' });
    const kit = sectionKit('cta-band');
    if (kit === undefined) throw new Error('cta-band');
    const slots = kitSamples(kit, 'en');
    const noStyles = call('kit.section', { id: 'r1', kit: 'cta-band', slots }, kitContext(bare));
    expect(noStyles.ok ? '' : noStyles.error).toBe('page has no kit styles; run theme.apply first');
    const kernel = kitKernel();
    const unknown = call('kit.section', { id: 'r1', kit: 'cta-bandz', slots }, kitContext(kernel));
    expect(unknown.ok ? '' : unknown.error).toContain('use one of: header-bar');
    const region = call('kit.section', { id: 'nope', kit: 'cta-band', slots }, kitContext(kernel));
    expect(region.ok ? '' : region.error).toContain('r1, r2');
    const extra = call('kit.section', { id: 'r1', kit: 'cta-band', slots, colour: 'red' }, kitContext(kernel));
    expect(extra.ok ? '' : extra.error).toContain('"colour"');
    const heading = call('kit.section', { id: 'r1', kit: 'cta-band', slots, heading: 'h3' }, kitContext(kernel));
    expect(heading.ok ? '' : heading.error).toContain('"h1"');
  });

  it('kit.swap keeps the slot values across kits of the same role', () => {
    const kernel = kitKernel();
    const kit = sectionKit('hero-split');
    if (kit === undefined) throw new Error('hero-split');
    const slots = kitSamples(kit, 'en');
    land(kernel, call('kit.section', { id: 'r1', kit: 'hero-split', slots }, kitContext(kernel)));

    const run = call('kit.swap', { id: 'r1', kit: 'hero-overlay' }, kitContext(kernel));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const tree = run.steps[0]?.args['value'];
    const overlay = sectionKit('hero-overlay');
    if (overlay === undefined) throw new Error('hero-overlay');
    const read = readKitSlots(overlay, tree);
    expect(read?.['title']).toBe(slots['title']);
    expect(read?.['image']).toEqual(slots['image']);
    expect(read?.['cta']).toEqual(slots['cta']);
    expect(JSON.stringify(tree)).toContain('"tag":"h1"');
    land(kernel, run);
  });

  it('kit.swap refuses another role, naming the kits it can swap to', () => {
    const kernel = kitKernel();
    const kit = sectionKit('faq-accordion');
    if (kit === undefined) throw new Error('faq-accordion');
    land(kernel, call('kit.section', { id: 'r1', kit: 'faq-accordion', slots: kitSamples(kit, 'en') }, kitContext(kernel)));
    const run = call('kit.swap', { id: 'r1', kit: 'hero-split' }, kitContext(kernel));
    expect(run.ok ? '' : run.error).toContain('faq-split');
    const plain = call('kit.swap', { id: 'r2', kit: 'footer-cta' }, kitContext(kernel));
    expect(plain.ok ? '' : plain.error).toContain('use kit.section');
  });

  it('kit.insert adds a region under the root, before the footer, with the skeleton insertNode shape', () => {
    const kernel = kitKernel();
    const kit = sectionKit('stats-row');
    if (kit === undefined) throw new Error('stats-row');
    const run = call('kit.insert', { kit: 'stats-row', slots: kitSamples(kit, 'en') }, kitContext(kernel));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.steps[0]).toMatchObject({
      command: 'insertNode',
      args: { type: 'customCode', parentId: 'root', index: 1, props: { label: expect.any(String) as unknown } },
    });
    land(kernel, run);
    const children = kernel.getDocument().nodes['root']?.slots?.['default'] ?? [];
    expect(children).toHaveLength(3);
    expect(children[2]).toBe('r2');

    const after = call('kit.insert', { kit: 'stats-row', slots: kitSamples(kit, 'en'), after: 'r1' }, kitContext(kernel));
    expect(after.ok && after.steps[0]?.args['index']).toBe(1);
    const missing = call('kit.insert', { kit: 'stats-row', slots: kitSamples(kit, 'en'), after: 'zz' }, kitContext(kernel));
    expect(missing.ok ? '' : missing.error).toContain('"after"');
  });

  it('instantiated trees read back identically after landing', () => {
    const kit = sectionKit('menu-list');
    if (kit === undefined) throw new Error('menu-list');
    const filled = instantiateKit(kit, kitSamples(kit, 'ar'), { id: 'menu', heading: 'h2', locale: { lang: 'ar', dir: 'rtl' } });
    expect(filled.ok).toBe(true);
    if (!filled.ok) return;
    expect(readKitSlots(kit, JSON.parse(JSON.stringify(filled.tree)))).toBeDefined();
  });
});

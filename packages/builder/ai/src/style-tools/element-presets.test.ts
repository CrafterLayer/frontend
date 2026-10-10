import { describe, expect, it } from 'vitest';
import { buildElementRecipe, ELEMENT_RECIPE_IDS } from '@craftkit/builder-schema';
import { expandAgentTools } from '../tools/agent/expand';
import { elementInsertTool } from './element-insert';
import { runStyleTool } from './run-direct';
import { styleKernel, treeOf } from './style-tools.fixtures';

describe('element.insert shared presets', () => {
  it.each(ELEMENT_RECIPE_IDS)('inserts %s at the exact seat, identical to the manual recipe, as one Undo', (preset) => {
    const kernel = styleKernel({ locale: 'ar', kit: false });
    const before = treeOf(kernel, 'r-story');
    const result = runStyleTool(kernel, elementInsertTool, { id: 'r-story', before: 'قصتنا', preset, content: { title: 'عنوان', text: 'نص واضح' } });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const tree = treeOf(kernel, 'r-story');
    const outer = tree.children[0];
    expect(outer?.kind === 'element' ? outer.children?.[0] : undefined).toEqual(buildElementRecipe(preset, 'ar', { title: 'عنوان', text: 'نص واضح' }));
    expect(kernel.transactions()).toHaveLength(1);
    kernel.undo();
    expect(treeOf(kernel, 'r-story')).toEqual(before);
  });
  it('reads a page palette written earlier in the same plan', () => {
    const kernel = styleKernel();
    const expanded = expandAgentTools({ rationale: 'x', commands: [
      { command: 'setProp', args: { id: 'root', key: 'pageCss', value: '.ck-page-plan{--ck-accent:green}' } },
      { command: 'tool', args: { name: 'element.insert', input: { id: 'r-story', parent: [0], index: 1, preset: 'metric-card', content: { value: '42' } } } },
    ] }, kernel);
    expect(expanded.issues).toEqual([]);
    expect(JSON.stringify(expanded.plan)).toContain('ck-card');
    expect(JSON.stringify(expanded.plan)).toContain('ck-accent-ink');
    expect(JSON.stringify(expanded.plan)).not.toContain('text-accent');
  });
  it('refuses bad recipes, mixed modes and unsafe links without any write', () => {
    const kernel = styleKernel();
    for (const options of [
      { preset: 'unknown' }, { preset: 'notice', markup: '<p>x</p>' }, { markup: '<p>x</p>', content: {} },
      { preset: 'checklist', content: { items: [] } },
      { preset: 'contact-card', content: { href: 'javascript:alert(1)' } },
    ]) {
      expect(runStyleTool(kernel, elementInsertTool, { id: 'r-story', parent: [0], ...options }).ok).toBe(false);
    }
    expect(kernel.transactions()).toHaveLength(0);
  });
});

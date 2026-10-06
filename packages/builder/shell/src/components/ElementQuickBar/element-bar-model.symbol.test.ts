import { describe, expect, it } from 'vitest';

import type { CustomCodeRoot, Node, SiteLibrary } from '@craftkit/builder-schema';

import { createDesignTestKernel } from '../DesignSystemPanel/design-test-site';
import { createElementBarModel } from './element-bar-model';
import { createElementSelection } from '../../selection/element-selection';

const BANNER: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'p-8',
      children: [{ kind: 'element', tag: 'h3', className: 'text-xl', text: 'Card title' }],
    },
  ],
};
const LIBRARY: SiteLibrary = { symbols: { banner: { id: 'banner', name: 'Banner', tree: BANNER } } };
const INSTANCE: Node = { id: 'inst', type: 'customCodeSymbol', props: { label: 'Banner', symbolId: 'banner', overrides: [] } };

describe('the quick bar inside a symbol instance (fix pass, DESIGN §G)', () => {
  it('reads the element from the master and writes the instance override, master untouched, one Undo', () => {
    const site = createDesignTestKernel({ library: LIBRARY, extraNodes: { inst: INSTANCE } });
    const page = site.page('home');
    const target = { kind: 'tree' as const, nodeId: 'inst', path: [0, 0] };
    const model = createElementBarModel(page, [target], {
      bucket: 'base',
      state: 'default',
      pageDir: 'ltr',
      writeOptions: { symbolTree: (id) => site.getSite().library?.symbols?.[id]?.tree },
    });
    expect(model?.kind).toBe('text');
    const before = site.transactions().length;
    const result = model?.apply([{ property: 'textColor', value: { kind: 'token', token: 'accent' } }], 'Text colour');
    expect(result).toEqual({ ok: true });
    expect(site.transactions()).toHaveLength(before + 1);
    const overrides = page.getDocument().nodes['inst']?.props['overrides'] as { path: number[]; className?: string }[];
    expect(overrides[0]?.path).toEqual([0, 0]);
    expect(overrides[0]?.className).toMatch(/text-accent/u);
    // The master keeps its own classes.
    const master = site.getSite().library?.symbols?.['banner']?.tree.children[0];
    expect(master?.kind === 'element' ? master.children?.[0] : undefined).toMatchObject({ className: 'text-xl' });
  });

  it('keeps an element inside an instance in the shared selection', () => {
    const site = createDesignTestKernel({ library: LIBRARY, extraNodes: { inst: INSTANCE } });
    const page = site.page('home');
    const selection = createElementSelection(page);
    page.focusElement('inst', [0, 0]);
    expect(selection.targets()).toEqual([{ kind: 'tree', nodeId: 'inst', path: [0, 0] }]);
    selection.dispose();
  });
});

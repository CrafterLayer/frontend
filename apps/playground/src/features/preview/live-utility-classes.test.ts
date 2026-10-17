import { describe, expect, it } from 'vitest';

import { liveUtilityClasses } from './live-utility-classes';

const hero = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'py-24  md:flex-row',
      children: [
        { kind: 'icon', name: 'coffee', className: 'size-5 text-amber-600' },
        { kind: 'element', tag: 'h1', className: 'text-5xl md:text-7xl', text: 'بُن' },
      ],
    },
  ],
};

describe('liveUtilityClasses', () => {
  it('collects every class every tree in a site uses, wherever the tree sits', () => {
    const site = {
      pages: [
        { id: 'home', document: { nodes: { hero: { props: { tree: hero, label: 'Hero' } } } } },
      ],
      regions: {
        footer: {
          tree: { kind: 'root', children: [{ kind: 'element', className: 'border-t-2' }] },
        },
      },
    };

    expect([...liveUtilityClasses(site)].sort()).toEqual(
      [
        'border-t-2',
        'md:flex-row',
        'md:text-7xl',
        'py-24',
        'size-5',
        'text-5xl',
        'text-amber-600',
      ].sort(),
    );
  });

  it('ignores className strings that are not inside a tree', () => {
    expect([...liveUtilityClasses({ props: { className: 'not-from-a-tree' } })]).toEqual([]);
  });

  it('reads an unchanged tree from memory, so a large site stays cheap to rescan', () => {
    const first = liveUtilityClasses({ a: hero });
    const again = liveUtilityClasses({ b: hero });
    expect([...again]).toEqual([...first]);
  });
});

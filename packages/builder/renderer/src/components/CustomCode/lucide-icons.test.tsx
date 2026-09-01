import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { icons } from 'lucide';

import { LUCIDE_VERSION, lucideIconNames } from '@craftkit/builder-schema';

import { CustomCode } from './CustomCode';
import { lucideIconNode } from './lucide-icon-node';

function tree(children: unknown[]) {
  return { kind: 'root', children };
}

describe('the layer-0 icon name list', () => {
  it('resolves every name against the installed lucide, and misses none of it', () => {
    /*
      The drift gate. The list the AI door validates against is generated from
      lucide's files; the renderer draws from lucide's data. If they disagree
      the door admits an icon that draws a placeholder, or refuses one that
      would have drawn — so both directions are pinned here.
    */
    const names = [...lucideIconNames()];
    const unresolved = names.filter((name) => lucideIconNode(name) === undefined);

    expect(unresolved).toEqual([]);
    // `icons` also carries ALIASES (`house` and `home` share one drawing), so
    // it is larger than the canonical file list — never smaller.
    expect(Object.keys(icons).length).toBeGreaterThanOrEqual(names.length);
    expect(names.length).toBeGreaterThan(1_500);
  });

  it('is generated from the installed version, not a remembered one', () => {
    const installed = (icons as unknown as { __version?: string }).__version;
    // lucide does not export its version; the generator records it from
    // package.json, and the count check above is what actually pins parity.
    expect(LUCIDE_VERSION).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(installed).toBeUndefined();
  });

  it('maps the ambiguous digit names the way lucide files them', () => {
    expect(lucideIconNode('arrow-down-0-1')).toBeDefined();
    expect(lucideIconNode('grid-2x2')).toBeDefined();
    expect(lucideIconNode('a-arrow-down')).toBeDefined();
  });
});

describe('icon rendering', () => {
  it('draws the set path data inside an svg it owns', () => {
    const { container } = render(
      <CustomCode tree={tree([{ kind: 'icon', name: 'arrow-right' }])} hostId="h" />,
    );

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('data-icon')).toBe('arrow-right');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.querySelectorAll('path')).toHaveLength(2);
  });

  it('is decorative without a label and named with one — never a bare image', () => {
    const { container } = render(
      <CustomCode
        tree={tree([
          { kind: 'icon', name: 'mail' },
          { kind: 'icon', name: 'phone', label: 'Call us' },
        ])}
        hostId="h"
      />,
    );

    const [decorative, labelled] = [...container.querySelectorAll('svg')];
    expect(decorative?.getAttribute('aria-hidden')).toBe('true');
    expect(decorative?.getAttribute('role')).toBeNull();
    expect(labelled?.getAttribute('role')).toBe('img');
    expect(labelled?.getAttribute('aria-label')).toBe('Call us');
  });

  it('applies size, stroke width, and utility classes', () => {
    const { container } = render(
      <CustomCode
        tree={tree([
          { kind: 'icon', name: 'check', size: 40, strokeWidth: 1.5, className: 'text-accent' },
        ])}
        hostId="h"
      />,
    );

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('40');
    expect(svg?.getAttribute('stroke-width')).toBe('1.5');
    expect(svg?.getAttribute('class')).toBe('text-accent');
  });

  it('shows a visible placeholder for a name the set does not have', () => {
    const { container } = render(
      <CustomCode tree={tree([{ kind: 'icon', name: 'not-an-icon' }])} hostId="h" />,
    );

    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Unknown icon: not-an-icon',
    );
  });

  it('publishes identically through the static path — no lazy loading, no fallback', () => {
    // `globe`, not `github`: Lucide ships no brand logos, and the first
    // version of this test assumed one — the door caught the assumption.
    const markup = renderToStaticMarkup(
      <CustomCode tree={tree([{ kind: 'icon', name: 'globe' }])} hostId="h" />,
    );

    expect(markup).toContain('<svg');
    expect(markup).toContain('<path');
    expect(markup).toContain('data-icon="globe"');
  });

  it('never opens an svg surface: an icon carries a name and nothing else', () => {
    // A `children`/`text`/attribute payload on an icon node is ignored on read
    // (the door already refuses it on write).
    const { container } = render(
      <CustomCode
        tree={tree([
          {
            kind: 'icon',
            name: 'mail',
            children: [{ kind: 'element', tag: 'script', text: 'alert(1)' }],
            attributes: { onload: 'x()' },
          },
        ])}
        hostId="h"
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('onload')).toBeNull();
    expect(container.querySelector('svg')?.childElementCount).toBeGreaterThan(0);
  });
});

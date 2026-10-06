import { act, cleanup, render } from '@testing-library/react';
import { useMemo } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { BuilderSiteKernel } from '@craftkit/builder-core';
import {
  CustomCode,
  CustomCodeClassTransformContext,
  createNamedStyleTransform,
} from '@craftkit/builder-renderer';
import { setUtilityClassOracle, type CustomCodeRoot } from '@craftkit/builder-schema';

import { createDesignTestKernel } from '../components/DesignSystemPanel/design-test-site';
import { useSiteSnapshot } from '../components/DesignSystemPanel/site-door';
import { namedStyleSource } from './named-style-source';

beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});
afterEach(cleanup);

const THREE: CustomCodeRoot = {
  kind: 'root',
  children: ['One', 'Two', 'Three'].map((text) => ({
    kind: 'element' as const,
    tag: 'article',
    className: 'ck-s-card text-start',
    text,
  })),
};

function kernelWithCard(): BuilderSiteKernel {
  return createDesignTestKernel({
    tree: THREE,
    library: { styles: { card: { id: 'card', name: 'Card', className: 'rounded-lg p-4' } } },
  });
}

/** The region rendered the way the canvas and the export render it: through the class transform. */
function Region({ kernel }: { readonly kernel: BuilderSiteKernel }) {
  const site = useSiteSnapshot(kernel);
  const transform = useMemo(() => createNamedStyleTransform(site.library), [site.library]);
  const tree = site.pages[0]?.document.nodes['region']?.props['tree'];
  return (
    <CustomCodeClassTransformContext.Provider value={transform}>
      <CustomCode tree={tree} hostId="region" />
    </CustomCodeClassTransformContext.Provider>
  );
}

const padding = (token: string) =>
  ({ property: 'padding', value: { kind: 'token', token }, bucket: 'base', state: 'default' }) as const;

describe('namedStyleSource', () => {
  it('reads the style and writes it back as ONE labelled setNamedStyle', () => {
    const kernel = kernelWithCard();
    const source = namedStyleSource(kernel, 'card');
    expect(source.id).toBe('named-style:card');
    expect(source.label).toBe('Card');
    expect(source.mode).toBe('free');
    expect(source.read()).toEqual(['rounded-lg p-4']);

    expect(source.apply([padding('8')], 'Padding')).toEqual({ ok: true });
    expect(kernel.getSite().library?.styles?.['card']?.className).toBe('rounded-lg p-8');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Padding · Card');
    kernel.undo();
    expect(source.read()).toEqual(['rounded-lg p-4']);
  });

  it('editing the style once repaints all three elements through the class transform', () => {
    const kernel = kernelWithCard();
    const { container } = render(<Region kernel={kernel} />);
    const articles = () => Array.from(container.querySelectorAll('article'));
    expect(articles()).toHaveLength(3);
    for (const article of articles()) expect(article.classList.contains('p-4')).toBe(true);

    act(() => {
      namedStyleSource(kernel, 'card').apply([padding('10')], 'Padding');
    });

    for (const article of articles()) {
      expect(article.classList.contains('p-10')).toBe(true);
      expect(article.classList.contains('p-4')).toBe(false);
      expect(article.classList.contains('text-start')).toBe(true);
    }
  });

  it('notifies subscribers and refuses once the style is gone', () => {
    const kernel = kernelWithCard();
    const source = namedStyleSource(kernel, 'ghost');
    let calls = 0;
    const stop = source.subscribe(() => {
      calls += 1;
    });
    kernel.dispatch('setPaletteColor', { color: { id: 'sand', name: 'Sand', value: '#e7d8b8' } });
    stop();
    expect(calls).toBeGreaterThan(0);
    expect(source.read()).toEqual(['']);
    expect(source.apply([padding('2')], 'Padding')).toEqual({
      ok: false,
      message: 'Named style "ghost" no longer exists.',
    });
  });

  it('passes the engine refusal through without writing', () => {
    const kernel = kernelWithCard();
    setUtilityClassOracle((name) => !name.includes('['));
    const result = namedStyleSource(kernel, 'card').apply(
      [{ property: 'padding', value: { kind: 'raw', css: '17px' }, bucket: 'base', state: 'default' }],
      'Padding',
    );
    setUtilityClassOracle(() => true);
    expect(result.ok).toBe(false);
    expect(kernel.transactions()).toHaveLength(0);
  });
});

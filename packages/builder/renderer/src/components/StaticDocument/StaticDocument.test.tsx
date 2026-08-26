import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { renderStaticMarkup } from '../../render-static-markup';
import { withPassThroughRenderers } from '../../test-utils';
import { DocumentView } from '../DocumentView';

const passThrough = withPassThroughRenderers(fixtureBlocks);
const lookupFrom = (kernel: ReturnType<typeof createBuilder>) => kernel.context.registry.block;

function makeKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [passThrough],
    ports: { clock: fixedClock(), ids: seededIds('st') },
  });
}

describe('US3 — static rendering', () => {
  it('SC-003a: static rendering is bit-identical across repeated runs (purity)', () => {
    const kernel = makeKernel();
    const first = renderStaticMarkup(landingFixture(), { blocks: lookupFrom(kernel) });
    const second = renderStaticMarkup(landingFixture(), { blocks: lookupFrom(kernel) });
    expect(first).toBe(second);
    expect(first).toContain('data-node-id="p1"');
  });

  it('SC-003b: live and static renders of the same document match in content', () => {
    const kernel = makeKernel();
    const live = render(<DocumentView kernel={kernel} />);
    const liveHtml = live.container.innerHTML;
    const staticHtml = renderStaticMarkup(kernel.getDocument(), { blocks: lookupFrom(kernel) });
    expect(liveHtml).toBe(staticHtml);
  });

  it('FR-007: per-breakpoint overrides resolve only for their breakpoint (cascade)', () => {
    const kernel = makeKernel();
    const doc = kernel.getDocument(); // hero1 has a mobile tone override → light
    const options = { blocks: lookupFrom(kernel) };

    const desktop = renderStaticMarkup(doc, options);
    const tablet = renderStaticMarkup(doc, { ...options, breakpoint: 'tablet' as const });
    const mobile = renderStaticMarkup(doc, { ...options, breakpoint: 'mobile' as const });

    expect(desktop).toBe(tablet); // no tablet override on the fixture
    expect(desktop).not.toBe(mobile);
    expect(mobile).toContain('data-node-id="hero1"');
  });

  it('unknown types render the explicit fallback in static output too (FR-010)', () => {
    const html = renderStaticMarkup(landingFixture(), { blocks: () => undefined });
    expect(html).toContain('Unknown block type:');
    expect(html).toContain('page');
  });
});

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
import { darkTheme, lightTheme } from '../../themes';
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
    /*
      `isCanvas={false}` is the meaningful comparison, not an accommodation.

      The canvas legitimately adds affordances the reader must never see — slot
      wrappers the drop resolver measures, empty-slot boxes, a block's own
      editing hints. Comparing the canvas against the published output would
      only ever assert that those affordances do not exist. What has to match is
      the two PUBLISHED shapes, and this is the gate that catches either path
      drifting from the other.
    */
    const kernel = makeKernel();
    const live = render(<DocumentView kernel={kernel} isCanvas={false} />);
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

  /*
    The regression these three pin down was invisible for as long as the blocks
    carried stylesheets: `--t-*` is written by `CanvasFrame` into the EDITOR's
    frame, and publishing wrote none at all. Pages held together only because
    every deleted stylesheet read `var(--t-space-unit, 4px)`, and the fallback
    was doing the work nobody had noticed it doing.
  */
  it('publishes the design system, so a page is not the starter palette', () => {
    const kernel = makeKernel();
    const html = renderStaticMarkup(landingFixture(), {
      blocks: lookupFrom(kernel),
      theme: darkTheme,
    });

    expect(html).toContain(`--t-accent:${darkTheme.accent}`);
    expect(html).toContain(`--t-surface:${darkTheme.surface}`);
  });

  it('publishes DIFFERENT markup for different design systems', () => {
    const kernel = makeKernel();
    const options = { blocks: lookupFrom(kernel) };
    const light = renderStaticMarkup(landingFixture(), { ...options, theme: lightTheme });
    const dark = renderStaticMarkup(landingFixture(), { ...options, theme: darkTheme });

    /*
      Non-vacuous in the direction that matters: an implementation that
      accepted the theme and dropped it would satisfy "contains --t-accent"
      against whichever palette it hard-coded, and would fail here.
    */
    expect(light).not.toBe(dark);
    expect(light).toContain(`--t-accent:${lightTheme.accent}`);
    expect(dark).not.toContain(`--t-accent:${lightTheme.accent}`);
  });

  /*
    The wrapper must not become a box.

    Custom properties have to hang off an element, and the obvious wrapper is a
    plain `<div>` — which inserts a block box between the page root and its
    first section and changes the geometry of every published page. This is the
    assertion that stops that from being reintroduced.
  */
  it('adds no layout box when it carries the theme', () => {
    const kernel = makeKernel();
    const options = { blocks: lookupFrom(kernel) };
    const bare = renderStaticMarkup(landingFixture(), options);
    const themed = renderStaticMarkup(landingFixture(), { ...options, theme: lightTheme });

    expect(themed).toContain('display:contents');
    /* The tree itself is untouched — only wrapped. */
    expect(themed).toContain(bare);
  });

  it('omits the wrapper entirely when no theme is published', () => {
    const kernel = makeKernel();
    const html = renderStaticMarkup(landingFixture(), { blocks: lookupFrom(kernel) });

    expect(html).not.toContain('display:contents');
    expect(html).not.toContain('--t-accent');
  });
});

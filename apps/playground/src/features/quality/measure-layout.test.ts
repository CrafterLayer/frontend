import { describe, expect, it } from 'vitest';

import { measureLayout } from './measure-layout';

/**
 * jsdom computes no layout — every `getBoundingClientRect` is zero — so the
 * boxes are placed by hand. That is not a workaround: this module's whole job
 * is to turn rectangles into a verdict, and rectangles are exactly what a test
 * can supply honestly. Whether a real browser produces THOSE rectangles is what
 * the Chromium stories are for.
 */
/** A full `DOMRect` from a few numbers — jsdom computes none, so tests supply them. */
function domRect(partial: { left: number; top: number; width: number; height: number }): DOMRect {
  const rect = {
    ...partial,
    x: partial.left,
    y: partial.top,
    right: partial.left + partial.width,
    bottom: partial.top + partial.height,
  };
  return { ...rect, toJSON: () => rect };
}

function pageWith(
  boxes: readonly { tag: string; text: string; rect: DOMRect; region?: string }[],
): Document {
  const document = window.document.implementation.createHTMLDocument('gate');
  for (const box of boxes) {
    const host = document.createElement('div');
    if (box.region !== undefined) host.setAttribute('data-ck', box.region);
    const element = document.createElement(box.tag);
    element.textContent = box.text;
    element.getBoundingClientRect = () => box.rect;
    host.append(element);
    document.body.append(host);
  }
  return document;
}

const box = (left: number, top: number, width: number, height: number): DOMRect =>
  domRect({ left, top, width, height });

/** What `getComputedStyle` returns for a horizontally scrolling element. */
const scrolls = { overflowX: 'auto' } as CSSStyleDeclaration;

describe('measureLayout', () => {
  it('says nothing about a page that fits', () => {
    const document = pageWith([{ tag: 'p', text: 'Fits', rect: box(0, 0, 300, 20) }]);
    expect(measureLayout(document, 360)).toEqual([]);
  });

  describe('overflow', () => {
    it('reports an element past the edge, and by how much', () => {
      const document = pageWith([
        { tag: 'h2', text: 'A very wide heading', rect: box(0, 0, 420, 40) },
      ]);
      const [issue] = measureLayout(document, 360);
      expect(issue?.check).toBe('overflow');
      expect(issue?.severity).toBe('error');
      expect(issue?.width).toBe(360);
      expect(issue?.message).toContain('60px past the edge');
    });

    it('tolerates a sub-pixel overrun, which rounding produces constantly', () => {
      const document = pageWith([{ tag: 'p', text: 'Almost', rect: box(0, 0, 360.4, 20) }]);
      expect(measureLayout(document, 360)).toEqual([]);
    });

    it('names the region it happened in, so a person can go there', () => {
      const document = pageWith([
        { tag: 'p', text: 'Wide', rect: box(0, 0, 500, 20), region: 'section-2' },
      ]);
      expect(measureLayout(document, 360)[0]?.nodeId).toBe('section-2');
    });

    it('is a question about the WIDTH, so the same page can pass at another', () => {
      const document = pageWith([{ tag: 'p', text: 'Wide', rect: box(0, 0, 500, 20) }]);
      expect(measureLayout(document, 360)).toHaveLength(1);
      expect(measureLayout(document, 1024)).toEqual([]);
    });

    it('measures against the ROOT’s own edge, not the viewport origin', () => {
      /*
        The bug this pins was invisible to every other test here, because they
        place boxes at left 0 where the two coordinate systems coincide. A
        rendered region inside a Storybook canvas sits behind a sidebar and some
        padding, and comparing a viewport-relative `right` against a bare width
        counted that offset as overflow — reporting every element on a good page.
      */
      const document = window.document.implementation.createHTMLDocument('gate');
      const region = document.createElement('div');
      const paragraph = document.createElement('p');
      paragraph.textContent = 'Fits, but not at x=0';
      region.append(paragraph);
      document.body.append(region);

      // The region starts 300px in and is 360 wide; the paragraph fills it.
      region.getBoundingClientRect = () => box(300, 0, 360, 40);
      paragraph.getBoundingClientRect = () => box(300, 0, 360, 20);

      expect(measureLayout(region, 360)).toEqual([]);
    });

    it('still catches real overflow inside an offset root', () => {
      const document = window.document.implementation.createHTMLDocument('gate');
      const region = document.createElement('div');
      const paragraph = document.createElement('p');
      paragraph.textContent = 'Too wide';
      region.append(paragraph);
      document.body.append(region);

      region.getBoundingClientRect = () => box(300, 0, 360, 40);
      paragraph.getBoundingClientRect = () => box(300, 0, 420, 20);

      const [issue] = measureLayout(region, 360);
      expect(issue?.check).toBe('overflow');
      expect(issue?.message).toContain('60px past the edge');
    });

    it('does NOT report content inside a horizontally scrolling row', () => {
      /*
        A child wider than its container is broken only if nobody can reach the
        rest of it. In a carousel, a logo strip or a scrolled table, extending
        past the container IS the pattern. The landing fixture has one of these,
        and it made the gate report three real, correctly-measured, entirely
        wrong failures — caught by the Chromium story, invisible here until this
        test, because jsdom reports every `overflow-x` as `visible`.
      */
      /*
        The REAL document, not `createHTMLDocument`. That one has no
        `defaultView`, so `getComputedStyle` is unreachable and the scroller
        check cannot run at all — a test built on it would pass without ever
        exercising the rule.
      */
      const region = window.document.createElement('div');
      const scroller = window.document.createElement('div');
      const card = window.document.createElement('p');
      card.textContent = 'A card in a carousel';
      scroller.append(card);
      region.append(scroller);
      window.document.body.append(region);

      region.getBoundingClientRect = () => box(0, 0, 360, 100);
      scroller.getBoundingClientRect = () => box(0, 0, 360, 100);
      card.getBoundingClientRect = () => box(0, 0, 900, 40);
      const real = window.getComputedStyle.bind(window);
      window.getComputedStyle = (element: Element) =>
        element === scroller ? scrolls : real(element);

      try {
        expect(measureLayout(region, 360)).toEqual([]);
      } finally {
        window.getComputedStyle = real;
        region.remove();
      }
    });

    it('still reports overflow when the scroller is OUTSIDE the region measured', () => {
      const region = window.document.createElement('div');
      const card = window.document.createElement('p');
      card.textContent = 'Too wide';
      region.append(card);
      window.document.body.append(region);

      region.getBoundingClientRect = () => box(0, 0, 360, 100);
      card.getBoundingClientRect = () => box(0, 0, 900, 40);
      const real = window.getComputedStyle.bind(window);
      // The BODY scrolls, ABOVE the region. Letting that excuse everything
      // inside would silence the check completely.
      window.getComputedStyle = (element: Element) =>
        element === window.document.body ? scrolls : real(element);

      try {
        expect(measureLayout(region, 360)).toHaveLength(1);
      } finally {
        window.getComputedStyle = real;
        region.remove();
      }
    });

    it('ignores an element with no area at all', () => {
      const document = pageWith([{ tag: 'p', text: 'Hidden', rect: box(0, 0, 0, 0) }]);
      expect(measureLayout(document, 360)).toEqual([]);
    });
  });

  describe('overlap', () => {
    it('reports two boxes sitting on each other', () => {
      const document = pageWith([
        { tag: 'h2', text: 'Title', rect: box(0, 0, 200, 40) },
        { tag: 'p', text: 'Body', rect: box(0, 10, 200, 40) },
      ]);
      const issue = measureLayout(document, 360).find((one) => one.check === 'overlap');
      expect(issue?.message).toContain('sit on top of each other');
    });

    it('ignores a KISS — boxes touch legitimately all the time', () => {
      const document = pageWith([
        { tag: 'h2', text: 'Title', rect: box(0, 0, 200, 40) },
        { tag: 'p', text: 'Body', rect: box(0, 38, 200, 40) },
      ]);
      expect(measureLayout(document, 360)).toEqual([]);
    });

    it('measures the share of the SMALLER box, so a small label under a big card counts', () => {
      const document = pageWith([
        { tag: 'p', text: 'Big card', rect: box(0, 0, 300, 300) },
        // A tiny label entirely inside the card's area, but not nested in it.
        { tag: 'a', text: 'Label', rect: box(10, 10, 40, 20) },
      ]);
      expect(measureLayout(document, 360).some((one) => one.check === 'overlap')).toBe(true);
    });

    it('ignores NESTING — a link inside a paragraph shares all of its area', () => {
      const document = window.document.implementation.createHTMLDocument('gate');
      const paragraph = document.createElement('p');
      paragraph.textContent = 'A sentence with ';
      const link = document.createElement('a');
      link.textContent = 'a link';
      paragraph.append(link);
      document.body.append(paragraph);
      const rect = box(0, 0, 200, 20);
      paragraph.getBoundingClientRect = () => rect;
      link.getBoundingClientRect = () => rect;

      expect(measureLayout(document, 360).filter((one) => one.check === 'overlap')).toEqual([]);
    });

    it('reports each pair once, not twice', () => {
      const document = pageWith([
        { tag: 'h2', text: 'A', rect: box(0, 0, 200, 40) },
        { tag: 'p', text: 'B', rect: box(0, 0, 200, 40) },
      ]);
      expect(measureLayout(document, 360).filter((one) => one.check === 'overlap')).toHaveLength(1);
    });
  });

  it('measures only the elements that carry words a person must read', () => {
    const document = window.document.implementation.createHTMLDocument('gate');
    const wrapper = document.createElement('div');
    const rect = box(0, 0, 900, 40);
    wrapper.getBoundingClientRect = () => rect;
    document.body.append(wrapper);
    // A bare `div` overflowing is a layout container, not a reading problem.
    expect(measureLayout(document, 360)).toEqual([]);
  });
});

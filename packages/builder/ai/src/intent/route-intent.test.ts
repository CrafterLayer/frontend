import { describe, expect, it } from 'vitest';

import {
  INTENT_KINDS,
  isBuildIntent,
  routeIntent,
  type IntentDocumentSummary,
  type IntentRoute,
} from './route-intent';

const EMPTY: IntentDocumentSummary = { nodeCount: 0, placeholderOnly: false, sectionLabels: [] };
const CONTENT: IntentDocumentSummary = {
  nodeCount: 9,
  placeholderOnly: false,
  sectionLabels: ['hero', 'Pricing', 'logo cloud'],
};

const SAMPLE_REQUESTS = [
  '',
  '   ',
  'hi',
  'how do I add a section?',
  'Build a website for my bakery',
  'Build a 4-page website: home, about, services, contact',
  'add a pricing section',
  'start over',
  'add a new page',
  'landing for my app',
  'build my portfolio',
  'make it pop',
  'مطعم شاورما',
  'darker?',
];

describe('routeIntent — the shape of an answer', () => {
  it.each(SAMPLE_REQUESTS)('answers “%s” with a known kind and a bounded confidence', (request) => {
    for (const document of [undefined, EMPTY, CONTENT]) {
      const route = routeIntent({ request, ...(document === undefined ? {} : { document }) });
      expect(INTENT_KINDS).toContain(route.kind);
      expect(route.confidence).toBeGreaterThanOrEqual(0);
      expect(route.confidence).toBeLessThanOrEqual(1);
      expect(route.reason.length).toBeGreaterThan(0);
    }
  });

  it('says where a build or a section goes, and says nothing for an edit or a question', () => {
    const withTarget = (route: IntentRoute): boolean => 'target' in route;
    expect(withTarget(routeIntent({ request: 'Build a website for my bakery' }))).toBe(true);
    expect(withTarget(routeIntent({ request: 'add a pricing section' }))).toBe(true);
    // Absent, not present-and-undefined: `exactOptionalPropertyTypes` tells them apart.
    expect(withTarget(routeIntent({ request: 'make the hero darker' }))).toBe(false);
    expect(withTarget(routeIntent({ request: 'how do I add a section?' }))).toBe(false);
  });

  it('is frozen, so a caller cannot rewrite the decision it was handed', () => {
    expect(Object.isFrozen(routeIntent({ request: 'Build a website for my bakery' }))).toBe(true);
  });

  it('answers an empty request with no confidence at all', () => {
    const route = routeIntent({ request: '  ' });
    expect(route.kind).toBe('question');
    expect(route.confidence).toBe(0);
  });

  it('is deterministic', () => {
    const input = { request: 'سوي لي موقع لمطعم', document: EMPTY };
    expect(routeIntent(input)).toEqual(routeIntent(input));
  });
});

describe('routeIntent — confidence follows how explicit the words are', () => {
  const confidence = (request: string, document?: IntentDocumentSummary): number =>
    routeIntent({ request, ...(document === undefined ? {} : { document }) }).confidence;

  it('trusts a creation verb over a bare noun phrase', () => {
    expect(confidence('Build a website for my bakery', CONTENT)).toBeGreaterThan(
      confidence('landing for my app', CONTENT),
    );
  });

  it('trusts a page ask on an empty page more than the same ask over content', () => {
    expect(confidence('Build a website for my bakery', EMPTY)).toBeGreaterThan(
      confidence('Build a website for my bakery', CONTENT),
    );
  });

  it('trusts a page count over named pages', () => {
    expect(confidence('Build a 4-page website', EMPTY)).toBeGreaterThan(
      confidence('website with about and services pages', EMPTY),
    );
  });

  it('is surer of an edit that names a section the page has', () => {
    expect(confidence('the pricing needs three tiers', CONTENT)).toBeGreaterThan(
      confidence('the thing needs three tiers', CONTENT),
    );
    expect(
      routeIntent({ request: 'the pricing needs three tiers', document: CONTENT }).reason,
    ).toMatch(/pricing/iu);
  });

  it('is unsure of an edit on a page with nothing to edit', () => {
    const route = routeIntent({ request: 'translate everything to Arabic', document: EMPTY });
    expect(route.kind).toBe('edit');
    expect(route.confidence).toBeLessThanOrEqual(0.5);
  });

  it('is surer of an edit when a block is pointed at', () => {
    expect(
      routeIntent({ request: 'a bakery in Amman', document: CONTENT, selection: ['hero'] })
        .confidence,
    ).toBeGreaterThan(confidence('a bakery in Amman', CONTENT));
  });
});

describe('routeIntent — targets', () => {
  it('owns an empty page, and a skeleton nobody filled', () => {
    expect(routeIntent({ request: 'build a site', document: EMPTY }).target).toBe('replace');
    expect(
      routeIntent({
        request: 'build a site',
        document: { nodeCount: 3, placeholderOnly: true, sectionLabels: ['Hero'] },
      }).target,
    ).toBe('replace');
  });

  it('puts a page ask beside existing content, never under it', () => {
    expect(routeIntent({ request: 'build a site', document: CONTENT }).target).toBe('new-page');
    expect(routeIntent({ request: 'build a site' }).target).toBe('new-page');
  });

  it('appends a section wherever it is asked for', () => {
    for (const document of [EMPTY, CONTENT]) {
      expect(routeIntent({ request: 'add a faq section', document }).target).toBe('append');
    }
  });

  it('sends a site ask over content to new pages, and lets one own an empty page', () => {
    const request = 'Build a 4-page website: home, about, services, contact';
    expect(routeIntent({ request, document: CONTENT }).target).toBe('new-page');
    expect(routeIntent({ request, document: EMPTY }).target).toBe('replace');
  });

  it('replaces the page only when the words say so', () => {
    expect(routeIntent({ request: 'start over', document: CONTENT })).toMatchObject({
      kind: 'build-page',
      target: 'replace',
    });
    expect(routeIntent({ request: 'redo the whole page', document: CONTENT })).toMatchObject({
      kind: 'build-page',
      target: 'replace',
    });
    // "Whole page" is not "start over": translating all of it keeps all of it.
    expect(
      routeIntent({ request: 'translate the whole page to Arabic', document: CONTENT }).kind,
    ).toBe('edit');
    expect(routeIntent({ request: 'ترجم الموقع كامل للانجليزي', document: CONTENT }).kind).toBe(
      'edit',
    );
    // A bare "redo" is the history button's word, not a rebuild.
    expect(routeIntent({ request: 'redo', document: CONTENT }).kind).toBe('edit');
    expect(routeIntent({ request: 'try again', document: CONTENT }).kind).toBe('edit');
    expect(routeIntent({ request: 'جرب من جديد', document: CONTENT }).kind).toBe('edit');
  });
});

describe('isBuildIntent', () => {
  it('is true for a page or a site, and nothing else', () => {
    expect(isBuildIntent(routeIntent({ request: 'Build a website for my bakery' }))).toBe(true);
    expect(isBuildIntent(routeIntent({ request: 'Build a 4-page website' }))).toBe(true);
    expect(isBuildIntent(routeIntent({ request: 'add a pricing section' }))).toBe(false);
    expect(isBuildIntent(routeIntent({ request: 'make the hero darker' }))).toBe(false);
    expect(isBuildIntent(routeIntent({ request: 'why?' }))).toBe(false);
  });
});

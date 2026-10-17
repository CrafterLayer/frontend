import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { INTENT_KINDS, routeIntent, type IntentDocumentSummary } from './route-intent';

/*
  The router reads whatever a person types — pasted markup, emoji, a novel, a
  single character — before anything else runs. It must answer every one of
  them, and never throw: a throw here is a panel that cannot send a request.
*/

const summary: fc.Arbitrary<IntentDocumentSummary> = fc.record({
  nodeCount: fc.nat({ max: 500 }),
  placeholderOnly: fc.boolean(),
  sectionLabels: fc.array(fc.string({ maxLength: 40 }), { maxLength: 20 }),
});

const words = fc.constantFrom(
  'build',
  'a',
  'the',
  'website',
  'page',
  'pages',
  'section',
  'add',
  'new',
  'from',
  'scratch',
  'سوي',
  'لي',
  'موقع',
  'صفحة',
  'صفحات',
  'قسم',
  'أضف',
  'من',
  'الصفر',
  'جديدة',
  '4',
  '?',
  '؟',
  ',',
  'كيف',
  'how',
);
const sentence = fc.array(words, { maxLength: 14 }).map((parts) => parts.join(' '));

describe('routeIntent — every input', () => {
  it('answers any string with a known kind and a confidence in [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 400 }),
        fc.option(summary, { nil: undefined }),
        (request, document) => {
          const route = routeIntent({ request, ...(document === undefined ? {} : { document }) });
          expect(INTENT_KINDS).toContain(route.kind);
          expect(route.confidence).toBeGreaterThanOrEqual(0);
          expect(route.confidence).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it('answers any sentence of routing words, with or without a selection', () => {
    fc.assert(
      fc.property(
        sentence,
        summary,
        fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 3 }),
        (request, document, selection) => {
          const route = routeIntent({ request, document, selection });
          expect(INTENT_KINDS).toContain(route.kind);
          // A build or a section always says where it goes; nothing else does.
          const placed = route.kind !== 'edit' && route.kind !== 'question';
          expect('target' in route).toBe(placed);
        },
      ),
    );
  });

  it('never builds over content from a noun phrase when a block is pointed at', () => {
    fc.assert(
      fc.property(sentence, (request) => {
        const content: IntentDocumentSummary = {
          nodeCount: 12,
          placeholderOnly: false,
          sectionLabels: ['hero'],
        };
        const pointed = routeIntent({ request, document: content, selection: ['hero'] });
        const free = routeIntent({ request, document: content });
        // Pointing can only turn a build into an edit, never an edit into a build.
        if (free.kind === 'edit') expect(pointed.kind).toBe('edit');
      }),
    );
  });
});

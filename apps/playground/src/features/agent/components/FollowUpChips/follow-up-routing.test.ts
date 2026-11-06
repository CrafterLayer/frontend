/**
 * Where each next-step chip's request goes, and that a clear first build is never asked
 * about. The chips send through the typed path, so the router decides: an edit of the page
 * that exists for colours, style and order, one new section for «أضف قسمًا». None may be
 * unsure enough to dock the clarify questions (`needsClarifying`).
 */
import type { BuilderKernel } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { t } from '../../copy';
import { createPlaygroundKernel } from '../../../preview/create-playground-kernel';
import { needsClarifying } from '../../model/enhance';
import { routeRequest } from '../../model/runs';
import type { Locale } from '../../model/view-types';

import { FOLLOW_UPS } from './constants';

/** A page a first build just wrote: three custom-code sections with real words. */
function builtPage(): BuilderKernel {
  const kernel = createPlaygroundKernel({ fixture: 'empty' });
  for (const label of ['Hero', 'Menu', 'Contact']) {
    kernel.dispatch('insertNode', {
      type: 'customCode',
      parentId: 'root',
      props: {
        label,
        tree: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              children: [
                { kind: 'element', tag: 'h2', text: label },
                { kind: 'element', tag: 'p', text: 'Fresh bread every morning.' },
              ],
            },
          ],
        },
      },
    });
  }
  return kernel;
}

const LOCALES: readonly Locale[] = ['ar', 'en'];
const PAGES = [
  ['a page a build wrote', builtPage],
  ['the landing fixture', () => createPlaygroundKernel({ fixture: 'landing' })],
] as const;

describe('next-step chips route as intended', () => {
  const cases = LOCALES.flatMap((locale) =>
    FOLLOW_UPS.flatMap((followUp) =>
      PAGES.map(([page, make]) => [locale, followUp.id, page, followUp, make] as const),
    ),
  );

  it.each(cases)('%s %s on %s', (locale, _id, _page, followUp, make) => {
    const route = routeRequest(t(locale, followUp.request), {
      kernel: make(),
      mentions: [],
      selection: [],
    });
    expect(route.kind).toBe(followUp.routesTo);
    // A chip is a clear request: it runs at once, never docks the questions.
    expect(needsClarifying(route)).toBe(false);
    expect(route.confidence).toBeGreaterThan(0.6);
    if (route.kind === 'add-section') expect(route.target).toBe('append');
  });
});

function firstBuildRoute(request: string) {
  return routeRequest(request, {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    mentions: [],
    selection: [],
  });
}

describe('a confident, clear first build never asks', () => {
  it.each([
    'اعمل صفحة هبوط لمقهى في عمّان',
    'ابنِ صفحة هبوط لمخبز في عمّان',
    'أنشئ صفحة لعيادة أسنان',
    'Build a landing page for my bakery in Amman',
    'Make a website for a dental clinic',
  ])('%s', (request) => {
    const route = firstBuildRoute(request);
    expect(route.kind === 'build-page' || route.kind === 'build-site').toBe(true);
    expect(needsClarifying(route)).toBe(false);
  });

  /*
    Accusative tanween («موقعًا», «قسمًا») folds to «موقعا» / «قسما»; the tokenizer also reads
    the stem without its seat alif (intent-tokens.ts, 2026-11-05), so the grammatical
    «ابنِ موقعًا لمخبز» routes like «ابنِ موقع لمخبز» and is never asked about.
  */
  it.each(['ابنِ موقعًا لمخبز في عمّان', 'أنشئ موقعًا لعيادة أسنان'])(
    'reads accusative tanween as the noun (intent-tokens.ts, 2026-11-05): %s',
    (request) => {
      expect(needsClarifying(firstBuildRoute(request))).toBe(false);
    },
  );
});

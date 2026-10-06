import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  defaultDesignSystem,
  defineBlockSchema,
  LATEST_SCHEMA_VERSION,
  LATEST_SITE_VERSION,
  type BlockRenderComponent,
  type BuilderDocument,
  type BuilderSite,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { fixedClock, seededIds } from '../testing/fixed-ports';
import { createSiteBuilder } from './create-site-builder';

/**
 * Part focus on the SITE kernel (block-parts DESIGN §2.5): the page lens
 * carries `focusPart` / `clearPartFocus`, only the current page reports the
 * focus, a page change clears it, and the site dispatcher prunes it exactly
 * like the page dispatcher does.
 */

const NullRender: BlockRenderComponent = () => null;

const partBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'part-blocks-site',
  version: '0.0.1',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Test page root.',
          props: z.object({}),
          slots: { default: { allow: ['cards'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'cards',
          description: 'Test block with parts.',
          props: z.object({
            heading: z.string().default('Cards'),
            items: z.array(z.object({ title: z.string() })).default([]),
          }),
          parts: {
            heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
            'item.title': {
              kind: 'text',
              bind: 'items.*.title',
              label: { en: 'Item title', ar: 'عنوان العنصر' },
            },
          },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function cardsDocument(): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['c1'] } },
      c1: { id: 'c1', type: 'cards', props: { heading: 'Cards', items: [{ title: 'A' }, { title: 'B' }] } },
    },
  };
}

function site(): BuilderSite {
  const page = (id: string, address: string) => ({
    id,
    address,
    title: id,
    purpose: 'test',
    audience: 'test',
    document: cardsDocument(),
    regions: [],
  });
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [page('home', '/'), page('about', '/about')],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

function kernel() {
  return createSiteBuilder({
    site: site(),
    extensions: [partBlocks],
    ports: { clock: fixedClock(), ids: seededIds('ps') },
  });
}

describe('site page lens — part focus', () => {
  it('focusPart on a lens selects, focuses, and makes that page current; other lenses see nothing', () => {
    const k = kernel();
    const about = k.page('about');
    about.focusPart('c1', { part: 'item.title', index: [0] });
    expect(k.currentPage()).toBe('about');
    expect(about.context.store.getState().partFocus).toEqual({ id: 'c1', part: 'item.title', index: [0] });
    expect(about.context.store.getState().elementFocus).toBeNull();
    expect(k.page('home').context.store.getState().partFocus).toBeNull();
    expect(k.transactions()).toHaveLength(0);
  });

  it('focusElement, setSelection and clearSelection clear it; clearPartFocus keeps the selection', () => {
    const k = kernel();
    const home = k.page('home');
    home.focusPart('c1', { part: 'heading', index: [] });
    home.focusElement('c1', [0]);
    expect(home.context.store.getState().partFocus).toBeNull();
    home.focusPart('c1', { part: 'heading', index: [] });
    expect(home.context.store.getState().elementFocus).toBeNull();
    home.setSelection(['c1']);
    expect(home.context.store.getState().partFocus).toBeNull();
    home.focusPart('c1', { part: 'heading', index: [] });
    home.clearPartFocus();
    expect(home.context.store.getState().partFocus).toBeNull();
    expect(home.context.store.getState().selection).toEqual(['c1']);
    home.focusPart('c1', { part: 'heading', index: [] });
    home.clearSelection();
    expect(home.context.store.getState().partFocus).toBeNull();
  });

  it('a page change clears it', () => {
    const k = kernel();
    k.page('home').focusPart('c1', { part: 'heading', index: [] });
    k.setCurrentPage('about');
    k.setCurrentPage('home');
    expect(k.page('home').context.store.getState().partFocus).toBeNull();
  });
});

describe('site dispatcher — part focus pruning', () => {
  it('drops the focus when the focused item is removed, keeps it by reference otherwise', () => {
    const k = kernel();
    const home = k.page('home');
    home.focusPart('c1', { part: 'item.title', index: [0] });
    const kept = home.context.store.getState().partFocus;
    home.dispatch('setProp', { id: 'c1', key: 'heading', value: 'Renamed' });
    expect(home.context.store.getState().partFocus).toEqual(kept);

    home.focusPart('c1', { part: 'item.title', index: [1] });
    k.dispatchGroup([
      { command: 'setProp', args: { id: 'c1', key: 'items', value: [{ title: 'A' }] }, pageId: 'home' },
    ]);
    expect(home.context.store.getState().partFocus).toBeNull();
    expect(home.context.store.getState().selection).toEqual(['c1']);
  });

  it('drops the focus when the node is removed', () => {
    const k = kernel();
    const home = k.page('home');
    home.focusPart('c1', { part: 'heading', index: [] });
    home.dispatch('removeNode', { id: 'c1' });
    expect(home.context.store.getState().partFocus).toBeNull();
  });
});

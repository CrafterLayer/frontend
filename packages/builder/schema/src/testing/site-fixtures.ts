import { defaultDesignSystem } from '../theme/default-theme';
import type { BuilderDocument, ContentDirection } from '../document/types';
import { LATEST_SITE_VERSION, type BuilderSite, type SharedRegion, type SitePage } from '../site/types';

/**
 * Sites every layer can build a test on, without any of them inventing one.
 *
 * ## Why they live in the schema package
 *
 * A site fixture needs nothing but the schema's own types, and every layer
 * above needs one. Put it any higher and the layers below cannot reach it; let
 * each package write its own and the workspace ends up with six subtly
 * different ideas of what a valid site is — which is how a test starts passing
 * against a shape the product never produces.
 *
 * ## Why they are functions and not constants
 *
 * Every caller gets its own object graph. A shared constant would let one
 * test's `addPage` change another test's starting site, and the failure would
 * land in whichever test happened to run second.
 *
 * All three satisfy `validateSite` by construction: exactly one home page,
 * unique ids and addresses, every wired region present, and every page document
 * in the site's own direction.
 */

/** A page whose document says something, so a projection has bytes to move. */
function pageDocument(dir: ContentDirection, words: string): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['intro'] } },
      intro: { id: 'intro', type: 'text', props: { content: words } },
    },
  };
}

function page(
  id: string,
  address: string,
  title: string,
  dir: ContentDirection,
  regions: readonly string[] = [],
): SitePage {
  return {
    id,
    address,
    title,
    purpose: `What ${title} is for.`,
    audience: 'anyone who arrives here',
    document: pageDocument(dir, `${title} — the words on this page.`),
    regions: [...regions],
  };
}

/** The smallest site that exists: one page, at "/". */
export function onePageSite(dir: ContentDirection = 'ltr'): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir,
    pages: [page('home', '/', 'Home', dir)],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

/**
 * Five pages, in a deliberate order.
 *
 * The home page is NOT first. A site whose home always sits at index 0 lets a
 * reorder bug pass every test that uses it, and "which page is the home" is a
 * question of address, never of position.
 */
export function fivePageSite(dir: ContentDirection = 'ltr'): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir,
    pages: [
      page('work', '/work', 'Work', dir),
      page('home', '/', 'Home', dir),
      page('pricing', '/pricing', 'Pricing', dir),
      page('about', '/about', 'About', dir),
      page('contact', '/contact', 'Contact', dir),
    ],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

function region(id: string, kind: SharedRegion['kind'], dir: ContentDirection): SharedRegion {
  return {
    id,
    kind,
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir,
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['line'] } },
        line: { id: 'line', type: 'text', props: { content: `The ${kind}.` } },
      },
    },
  };
}

/**
 * Three pages and two shared regions, wired UNEVENLY.
 *
 * One page opts out of the footer. A fixture where every page carries every
 * region cannot tell "the region reached every page" from "the region reached
 * the pages that asked for it", and the second is the actual contract.
 */
export function siteWithSharedRegions(dir: ContentDirection = 'ltr'): BuilderSite {
  const masthead = region('masthead', 'header', dir);
  const colophon = region('colophon', 'footer', dir);
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir,
    pages: [
      page('home', '/', 'Home', dir, ['masthead', 'colophon']),
      page('work', '/work', 'Work', dir, ['masthead', 'colophon']),
      page('contact', '/contact', 'Contact', dir, ['masthead']),
    ],
    sharedRegions: { masthead, colophon },
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

import {
  SEO_BUSINESS_TYPES,
  SEO_SCHEMA_KINDS,
  deriveSchemaKinds,
  extractSeoContent,
  isVagueLinkText,
  scriptOf,
  seoMeta,
  seoSlug,
  type BuilderDocument,
  type SeoBusinessType,
  type SeoSchemaKind,
} from '@craftkit/builder-schema';

import type { QualityIssue } from '../quality/check-document';
import type { AgentToolStep } from '../tools/agent/types';
import { altFor, catalogEntryFor } from './alt-text';
import { editsToSteps, type SeoEdit } from './fixes';
import { HEADING_LEVEL, isRecord, scanPage, type JsonRecord, type PageScan, type ScannedElement } from './scan';

/**
 * The SEO half of the quality card: deterministic, advisory, and fixable.
 *
 * Every issue is decidable from the document bytes (and, for the site-level
 * checks, the other pages' bytes). Each one that a machine can repair without
 * a judgement call carries a SAFE fix — ordinary plan steps the door validates
 * like any other — and `seoAutofixPlan` gathers those into one transaction.
 * Fixes that need the owner's say (a slug that changes a URL, a direction flip)
 * are offered but marked unsafe, and nothing applies them automatically.
 *
 * Messages are English: they are read by the model's repair round and by the
 * quality card, never shown as page copy.
 */

export interface SeoIssue extends QualityIssue {
  readonly fix?: { readonly safe: boolean; readonly steps: readonly AgentToolStep[] };
}

export interface SeoSitePage {
  readonly address: string;
  readonly document: BuilderDocument;
}

export interface CheckSeoOptions {
  /** Every page of the site, for the duplicate-title, hreflang and orphan checks. */
  readonly pages?: readonly SeoSitePage[];
  /** The site's public origin, e.g. `https://example.com`; read from the home page's seo when absent. */
  readonly origin?: string;
  /** This page's address, when `pages` does not hold this very document. */
  readonly address?: string;
  /** Facts-ledger sample values (in addition to the root's `seo.samples`). */
  readonly sampleValues?: readonly string[];
}

/** An issue while it is being collected: its fix still as edits. */
export interface CollectedSeoIssue {
  readonly issue: QualityIssue;
  readonly edits?: readonly SeoEdit[];
  readonly safe?: boolean;
}

// ── small readers ───────────────────────────────────────────────────────────

function str(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

function seoOf(root: JsonRecord): JsonRecord {
  return isRecord(root['seo']) ? root['seo'] : {};
}

function primary(lang: string): string {
  return lang.trim().toLowerCase().split(/[-_]/u)[0] ?? '';
}

const RTL_PRIMARY = new Set(['ar', 'fa', 'he', 'ur']);

/** The page's language: its root `lang`, else what its direction and text say. */
export function effectiveLang(scan: PageScan): string {
  if (scan.lang !== '') return scan.lang;
  if (scan.dir === 'rtl') return 'ar';
  return scriptOf(scan.bodyText) === 'arabic' ? 'ar' : 'en';
}

function isArabicPage(scan: PageScan): boolean {
  return primary(effectiveLang(scan)) === 'ar';
}

function normalizeRoute(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch {
    /* keep it as written */
  }
  const bare = decoded.split(/[?#]/u)[0] ?? '';
  return bare.length > 1 ? bare.replace(/\/+$/u, '') : bare;
}

function sanitizeId(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '');
  return cleaned === '' ? 'section' : cleaned;
}

function isDecorativeImage(element: ScannedElement): boolean {
  const { attributes } = element;
  return (
    attributes['aria-hidden'] === 'true' ||
    attributes['role'] === 'presentation' ||
    attributes['role'] === 'none' ||
    attributes['alt'] === ''
  );
}

function startsWith(path: readonly number[], prefix: readonly number[]): boolean {
  return prefix.length <= path.length && prefix.every((value, at) => path[at] === value);
}

/** Values that must never reach structured data, normalised for comparison. */
function sampleSet(values: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    const flat = str(value).toLowerCase();
    if (flat !== '') set.add(flat);
    const digits = value.replace(/\D+/gu, '');
    if (digits.length >= 7) set.add(`#${digits}`);
  }
  return set;
}

/** Whether a value is one of the samples (a phone matches by its digits). */
export function isSampleValue(value: string, samples: ReadonlySet<string>): boolean {
  const flat = str(value).toLowerCase();
  if (flat !== '' && samples.has(flat)) return true;
  const digits = value.replace(/\D+/gu, '');
  return digits.length >= 7 && samples.has(`#${digits}`);
}

/** Every string inside a value, with a dotted path naming where. */
function stringsIn(value: unknown, path: string, out: { path: string; value: string }[]): void {
  if (typeof value === 'string') out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, at) => { stringsIn(item, `${path}[${String(at)}]`, out); });
  else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) stringsIn(item, path === '' ? key : `${path}.${key}`, out);
  }
}

/** A descriptive replacement for vague link copy, in the page's language. */
export function describedLinkText(heading: string, arabic: boolean): string {
  const cut = heading.length > 60 ? heading.slice(0, 60).replace(/\s+\S*$/u, '') : heading;
  return arabic ? `اقرأ المزيد عن ${cut}` : `Learn more about ${cut}`;
}

// ── the checks ──────────────────────────────────────────────────────────────

interface Context {
  readonly scan: PageScan;
  readonly options: CheckSeoOptions;
  readonly address: string | undefined;
  readonly home: SeoSitePage | undefined;
  readonly out: CollectedSeoIssue[];
}

function push(
  context: Context,
  issue: QualityIssue,
  fix?: { readonly safe: boolean; readonly edits: readonly SeoEdit[] },
): void {
  context.out.push(fix === undefined ? { issue } : { issue, edits: fix.edits, safe: fix.safe });
}

function checkMeta(context: Context): void {
  const { scan } = context;
  const lang = effectiveLang(scan);
  const h1 = scan.elements.find((element) => element.tag === 'h1')?.fullText ?? '';
  const lead = scan.elements.find((element) => element.tag === 'p' && element.fullText !== '')?.fullText ?? '';
  const title = str(scan.root['title']);
  const description = str(scan.root['description']);
  const meta = seoMeta({ title, description, h1, lead, lang });
  const rootId = scan.rootId;

  for (const metaIssue of meta.issues) {
    const check = metaIssue.field === 'title' ? 'seo-title' : 'seo-description';
    const field = metaIssue.field;
    const fitted = field === 'title' ? meta.title : meta.description;
    switch (metaIssue.code) {
      case 'title-missing':
      case 'description-missing':
        push(context, {
          check,
          severity: 'error',
          nodeId: rootId,
          message: `The page has no ${field} and no ${field === 'title' ? 'h1' : 'lead paragraph'} to take one from; write a ${field} in the page's language.`,
        });
        break;
      case 'title-filled':
      case 'description-filled':
        push(
          context,
          {
            check,
            severity: 'error',
            nodeId: rootId,
            message: `The page has no ${field}; use seo.meta to set one (the ${field === 'title' ? 'h1' : 'lead'} reads "${fitted.slice(0, 60)}").`,
          },
          { safe: false, edits: [{ kind: 'prop', nodeId: rootId, key: field, value: fitted }] },
        );
        break;
      case 'title-truncated':
      case 'description-truncated':
        push(
          context,
          {
            check,
            severity: 'warning',
            nodeId: rootId,
            message: `The ${field} is wider than a search result shows; it is cut at a word boundary to fit.`,
          },
          { safe: true, edits: [{ kind: 'prop', nodeId: rootId, key: field, value: fitted }] },
        );
        break;
      case 'title-short':
      case 'description-short':
        push(context, {
          check,
          severity: 'warning',
          nodeId: rootId,
          message:
            field === 'title'
              ? 'The title is short; name the offer and the place (and the brand).'
              : 'The description is short; add concrete facts: what, where, hours, price.',
        });
        break;
      case 'title-script':
      case 'description-script':
        push(context, {
          check,
          severity: 'warning',
          nodeId: rootId,
          message: `The ${field} is not written in the page's language (${lang}); rewrite it in that language.`,
        });
        break;
      default:
        break;
    }
  }

  /* Duplicate titles across the site. */
  if (title !== '' && context.options.pages !== undefined) {
    const same = context.options.pages.filter(
      (page) =>
        page.document !== scan.document &&
        page.address !== context.address &&
        str(page.document.nodes[page.document.rootId]?.props['title']).toLowerCase() === title.toLowerCase(),
    );
    if (same.length > 0) {
      push(context, {
        check: 'seo-title',
        severity: 'warning',
        nodeId: rootId,
        message: `The title "${title.slice(0, 60)}" is also the title of ${same.map((page) => page.address).join(', ')}; give each page its own.`,
      });
    }
  }
}

function checkHeadings(context: Context): void {
  const h1s = context.scan.elements.filter((element) => element.tag === 'h1');
  if (h1s.length === 0) {
    push(context, {
      check: 'seo-h1',
      severity: 'warning',
      nodeId: context.scan.rootId,
      message: 'The page has no h1; make the hero headline the one h1.',
    });
    return;
  }
  for (const extra of h1s.slice(1)) {
    push(
      context,
      {
        check: 'seo-h1',
        severity: 'warning',
        nodeId: extra.nodeId,
        path: extra.path,
        message: `A second h1 ("${extra.fullText.slice(0, 40)}"); a page has exactly one, so it becomes an h2.`,
      },
      { safe: true, edits: [{ kind: 'tree', nodeId: extra.nodeId, path: extra.path, tag: 'h2' }] },
    );
  }
}

/** The LCP candidate: the first image of the region holding the h1, else of the first region. */
function heroImage(scan: PageScan): ScannedElement | undefined {
  const h1 = scan.elements.find((element) => element.tag === 'h1');
  const regionId = h1?.nodeId ?? scan.regions[0]?.nodeId;
  if (regionId === undefined) return undefined;
  return scan.elements.find(
    (element) => element.nodeId === regionId && element.tag === 'img' && str(element.attributes['src']) !== '',
  );
}

function checkImages(context: Context): void {
  const { scan } = context;
  const lang = effectiveLang(scan);
  const hero = heroImage(scan);
  const heroRegion = hero === undefined ? undefined : scan.regions.findIndex((region) => region.nodeId === hero.nodeId);

  for (const image of scan.elements) {
    if (image.tag !== 'img') continue;
    const src = str(image.attributes['src']);
    if (src === '') continue;
    const at = { nodeId: image.nodeId, path: image.path };

    if (!isDecorativeImage(image) && str(image.attributes['alt']) === '') {
      const alt = altFor({ src }, image.sectionHeading, lang);
      push(
        context,
        {
          check: 'seo-img-alt',
          severity: 'warning',
          ...at,
          message: 'An image has no alt text; it is described from the photo catalog or the section heading.',
        },
        { safe: true, edits: [{ kind: 'tree', ...at, attributes: { alt } }] },
      );
    }

    if (image.attributes['width'] === undefined || image.attributes['height'] === undefined) {
      const entry = catalogEntryFor(src);
      push(
        context,
        {
          check: 'seo-img-size',
          severity: 'warning',
          ...at,
          message:
            entry === undefined
              ? 'An image has no width and height, so the page jumps as it loads; set its intrinsic size in pixels.'
              : 'An image has no width and height, so the page jumps as it loads; its catalog size is set.',
        },
        ...(entry === undefined
          ? []
          : [
              {
                safe: true,
                edits: [
                  {
                    kind: 'tree' as const,
                    ...at,
                    attributes: { width: String(entry.width), height: String(entry.height) },
                  },
                ],
              },
            ]),
      );
    }

    if (hero !== undefined && image === hero) {
      const edits: SeoEdit[] = [];
      if (image.attributes['loading'] !== 'eager') {
        edits.push({ kind: 'tree', ...at, attributes: { loading: 'eager' } });
      }
      if (image.attributes['fetchpriority'] !== 'high') {
        edits.push({ kind: 'tree', ...at, attributes: { fetchpriority: 'high' }, fetchpriority: true });
      }
      if (edits.length > 0) {
        push(
          context,
          {
            check: 'seo-lcp',
            severity: 'warning',
            ...at,
            message: 'The hero image is the largest paint; it loads eagerly with fetchpriority="high".',
          },
          { safe: true, edits },
        );
      }
      continue;
    }

    const region = scan.regions.findIndex((entry) => entry.nodeId === image.nodeId);
    const belowHero = heroRegion === undefined ? region > 0 : region > heroRegion;
    if (belowHero && image.attributes['loading'] === undefined) {
      push(
        context,
        {
          check: 'seo-lcp',
          severity: 'warning',
          ...at,
          message: 'An image below the hero loads eagerly and competes with it; it loads lazily.',
        },
        { safe: true, edits: [{ kind: 'tree', ...at, attributes: { loading: 'lazy' } }] },
      );
    }
  }
}

function checkLinks(context: Context): void {
  const { scan } = context;
  const arabic = isArabicPage(scan);
  for (const link of scan.elements) {
    if (link.tag !== 'a' || link.attributes['href'] === undefined) continue;
    const label = str(link.attributes['aria-label']);
    if (label !== '' && !isVagueLinkText(label)) continue;
    const text = link.fullText;
    if (text === '' || !isVagueLinkText(text)) continue;
    const at = { nodeId: link.nodeId, path: link.path };
    const heading = link.sectionHeading;
    const issue: QualityIssue = {
      check: 'seo-link-text',
      severity: 'warning',
      ...at,
      message: `The link text "${text.slice(0, 40)}" says nothing about where it goes; name the destination.`,
    };
    if (heading === '') {
      push(context, issue);
      continue;
    }
    const described = describedLinkText(heading, arabic);
    /* Visible copy when the link's words are its own text; an accessible name
       when they sit in children (an icon beside a span), which the tree edit
       could not rewrite without guessing which child is the label. */
    const edit: SeoEdit =
      link.ownText !== '' && link.textDescendants === 0
        ? { kind: 'tree', ...at, text: described }
        : { kind: 'tree', ...at, attributes: { 'aria-label': described } };
    push(context, issue, { safe: true, edits: [edit] });
  }
}

function checkSectionLabels(context: Context): void {
  const { scan } = context;
  const used = new Set<string>();
  for (const element of scan.elements) {
    const id = element.attributes['id'];
    if (id !== undefined && id !== '') used.add(id);
  }
  for (const section of scan.elements) {
    if (section.tag !== 'section') continue;
    if (str(section.attributes['aria-labelledby']) !== '' || str(section.attributes['aria-label']) !== '') continue;
    const heading = scan.elements.find(
      (element) =>
        element.nodeId === section.nodeId &&
        element.path.length > section.path.length &&
        startsWith(element.path, section.path) &&
        HEADING_LEVEL[element.tag] !== undefined &&
        element.fullText !== '',
    );
    if (heading === undefined) continue;
    const edits: SeoEdit[] = [];
    let headingId = str(heading.attributes['id']);
    if (headingId === '') {
      const base = `${sanitizeId(section.nodeId)}-title`;
      headingId = base;
      for (let n = 2; used.has(headingId); n += 1) headingId = `${base}-${String(n)}`;
      used.add(headingId);
      edits.push({ kind: 'tree', nodeId: heading.nodeId, path: heading.path, attributes: { id: headingId } });
    }
    edits.push({
      kind: 'tree',
      nodeId: section.nodeId,
      path: section.path,
      attributes: { 'aria-labelledby': headingId },
    });
    push(
      context,
      {
        check: 'seo-section-label',
        severity: 'warning',
        nodeId: section.nodeId,
        path: section.path,
        message: `The section "${heading.fullText.slice(0, 40)}" is not named by its heading; it gets aria-labelledby.`,
      },
      { safe: true, edits },
    );
  }
}

function checkLangDir(context: Context): void {
  const { scan } = context;
  const script = scriptOf(scan.bodyText);
  const rootId = scan.rootId;
  if (scan.lang === '') {
    const guess = script === 'arabic' ? 'ar' : script === 'latin' ? 'en' : undefined;
    push(
      context,
      {
        check: 'seo-lang-dir',
        severity: 'warning',
        nodeId: rootId,
        message:
          guess === undefined
            ? 'The page declares no language; set the root lang.'
            : `The page declares no language; its text reads as "${guess}".`,
      },
      ...(guess === undefined
        ? []
        : [{ safe: guess === 'ar', edits: [{ kind: 'prop' as const, nodeId: rootId, key: 'lang', value: guess }] }]),
    );
    return;
  }
  const lang = primary(scan.lang);
  const rtlLang = RTL_PRIMARY.has(lang);
  if (rtlLang && scan.dir !== 'rtl') {
    push(
      context,
      {
        check: 'seo-lang-dir',
        severity: 'error',
        nodeId: rootId,
        message: `The page is lang="${scan.lang}" but reads left to right; set the direction to rtl.`,
      },
      { safe: false, edits: [{ kind: 'meta', dir: 'rtl' }] },
    );
  } else if (!rtlLang && scan.dir === 'rtl' && script === 'latin') {
    push(context, {
      check: 'seo-lang-dir',
      severity: 'warning',
      nodeId: rootId,
      message: `The page is lang="${scan.lang}" in Latin text but reads right to left; set the direction to ltr.`,
    });
  }
  if (lang === 'ar' && script === 'latin') {
    push(context, {
      check: 'seo-lang-dir',
      severity: 'warning',
      nodeId: rootId,
      message: 'The page is lang="ar" but its text is mostly Latin; fix the lang or the copy.',
    });
  } else if (lang !== '' && !rtlLang && script === 'arabic') {
    push(context, {
      check: 'seo-lang-dir',
      severity: 'warning',
      nodeId: rootId,
      message: `The page is lang="${scan.lang}" but its text is mostly Arabic; set lang="ar".`,
    });
  }
}

function homeSeo(context: Context): JsonRecord {
  const own = seoOf(context.scan.root);
  if (context.home === undefined || context.home.document === context.scan.document) return own;
  return seoOf((context.home.document.nodes[context.home.document.rootId]?.props ?? {}));
}

function isHome(context: Context): boolean {
  if (context.address !== undefined) return normalizeRoute(context.address) === '/';
  if (seoOf(context.scan.root)['pageKind'] === 'home') return true;
  return context.options.pages === undefined;
}

function checkCanonical(context: Context): void {
  const site = homeSeo(context)['site'];
  const origin = context.options.origin ?? (isRecord(site) ? str(site['origin']) : '');
  if (origin === '' || isHome(context)) return;
  const seo = seoOf(context.scan.root);
  if (str(seo['canonicalPath']) !== '' || str(context.scan.root['slug']) !== '') return;
  const h1 = context.scan.elements.find((element) => element.tag === 'h1')?.fullText ?? '';
  const base = str(context.scan.root['title']) || h1;
  const lang = effectiveLang(context.scan);
  push(
    context,
    {
      check: 'seo-canonical',
      severity: 'warning',
      nodeId: context.scan.rootId,
      message: 'The site has an origin but this page has no slug or canonical path; give it a slug.',
    },
    ...(base === ''
      ? []
      : [{ safe: false, edits: [{ kind: 'prop' as const, nodeId: context.scan.rootId, key: 'slug', value: seoSlug(base, lang) }] }]),
  );
}

function alternatesOf(document: BuilderDocument): { lang: string; path: string }[] {
  const seo = seoOf((document.nodes[document.rootId]?.props ?? {}));
  const list = Array.isArray(seo['alternates']) ? (seo['alternates'] as unknown[]) : [];
  return list.flatMap((entry) =>
    isRecord(entry) && typeof entry['lang'] === 'string' && typeof entry['path'] === 'string'
      ? [{ lang: entry['lang'], path: entry['path'] }]
      : [],
  );
}

function checkHreflang(context: Context): void {
  const { pages } = context.options;
  const alternates = alternatesOf(context.scan.document);
  if (alternates.length === 0 || pages === undefined || context.address === undefined) return;
  const self = normalizeRoute(context.address);
  for (const alternate of alternates) {
    const target = normalizeRoute(alternate.path);
    if (target === self) continue;
    const page = pages.find((entry) => normalizeRoute(entry.address) === target);
    if (page === undefined) {
      push(context, {
        check: 'seo-hreflang',
        severity: 'warning',
        nodeId: context.scan.rootId,
        message: `The ${alternate.lang} alternate "${alternate.path}" is not a page of this site.`,
      });
      continue;
    }
    const back = alternatesOf(page.document).some((entry) => normalizeRoute(entry.path) === self);
    if (!back) {
      push(context, {
        check: 'seo-hreflang',
        severity: 'warning',
        nodeId: context.scan.rootId,
        message: `"${alternate.path}" does not list this page back as an alternate; hreflang must be reciprocal.`,
      });
    }
  }
}

const LOCAL_BUSINESS_NEEDS_CITY = new Set([
  'Restaurant',
  'CafeOrCoffeeShop',
  'Bakery',
  'Dentist',
  'MedicalClinic',
  'LegalService',
  'Store',
  'BeautySalon',
  'LocalBusiness',
]);

function checkJsonLd(context: Context): void {
  const seo = homeSeo(context);
  const site = isRecord(seo['site']) ? seo['site'] : undefined;
  const business = site !== undefined && isRecord(site['business']) ? site['business'] : undefined;
  if (business === undefined) return;
  const rootId = context.scan.rootId;
  const ownSamples = Array.isArray(seoOf(context.scan.root)['samples'])
    ? (seoOf(context.scan.root)['samples'] as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];
  const homeSamples = Array.isArray(seo['samples'])
    ? (seo['samples'] as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];
  const samples = sampleSet([...(context.options.sampleValues ?? []), ...ownSamples, ...homeSamples]);

  const strings: { path: string; value: string }[] = [];
  stringsIn(business, '', strings);
  for (const entry of strings) {
    if (!isSampleValue(entry.value, samples)) continue;
    push(context, {
      check: 'seo-jsonld',
      severity: 'error',
      nodeId: rootId,
      message: `The business ${entry.path} "${entry.value}" is a sample value, not the owner's; ask the owner for the real value (it is left out of structured data).`,
    });
  }
  if (str(business['name']) === '') {
    push(context, {
      check: 'seo-jsonld',
      severity: 'warning',
      nodeId: rootId,
      message: 'The business has no name, so no Organization or LocalBusiness is published.',
    });
  }
  const type = str(business['type']);
  if (LOCAL_BUSINESS_NEEDS_CITY.has(type)) {
    const address = isRecord(business['address']) ? business['address'] : undefined;
    if (address === undefined || str(address['city']) === '') {
      push(context, {
        check: 'seo-jsonld',
        severity: 'warning',
        nodeId: rootId,
        message: `A ${type} needs an address with a city to be published as a local business; ask the owner for it.`,
      });
    }
    if (str(business['telephone']) === '' && str(business['whatsapp']) === '') {
      push(context, {
        check: 'seo-jsonld',
        severity: 'warning',
        nodeId: rootId,
        message: `A ${type} should publish a telephone; ask the owner for it.`,
      });
    }
  }
}

const SCHEMA_KIND_MAX = 6;
const KIND_REASON: Partial<Record<SeoSchemaKind, string>> = {
  FAQPage: 'question-and-answer pairs but no FAQPage',
  Menu: 'priced menu items but no Menu',
  Product: 'priced products but no Product',
};

/**
 * Structured data the page's content backs but `seo.schemaKinds` does not ask
 * for: a page with six FAQ `details` published only WebPage (final test
 * 2026-09-30). Safe — the kinds come from the visible content, and
 * `buildJsonLdGraph` still drops any value that is a sample.
 */
function checkSchemaKinds(context: Context): void {
  const own = seoOf(context.scan.root);
  const site = homeSeo(context)['site'];
  const business = isRecord(site) && isRecord(site['business']) ? site['business'] : undefined;
  const rawType = business === undefined ? '' : str(business['type']);
  const type = (SEO_BUSINESS_TYPES as readonly string[]).includes(rawType) ? (rawType as SeoBusinessType) : undefined;
  const wanted = deriveSchemaKinds(extractSeoContent(context.scan.document), type);
  const current = Array.isArray(own['schemaKinds'])
    ? own['schemaKinds'].filter((kind): kind is SeoSchemaKind => (SEO_SCHEMA_KINDS as readonly unknown[]).includes(kind))
    : [];
  const missing = wanted.filter((kind) => !current.includes(kind));
  if (missing.length === 0) return;
  const schemaKinds = [...current, ...missing].slice(0, SCHEMA_KIND_MAX);
  push(
    context,
    {
      check: 'seo-jsonld',
      severity: 'warning',
      nodeId: context.scan.rootId,
      message: `The page has ${missing.map((kind) => KIND_REASON[kind] ?? kind).join(', and ')} structured data; add ${missing.join(', ')} to seo.schemaKinds.`,
    },
    { safe: true, edits: [{ kind: 'prop', nodeId: context.scan.rootId, key: 'seo', value: { ...own, schemaKinds } }] },
  );
}

function checkNoIndexHome(context: Context): void {
  if (context.scan.root['noIndex'] !== true || !isHome(context)) return;
  push(
    context,
    {
      check: 'seo-noindex-home',
      severity: 'error',
      nodeId: context.scan.rootId,
      message: 'The home page is set to noindex, so search engines drop the whole site; turn noIndex off.',
    },
    { safe: false, edits: [{ kind: 'prop', nodeId: context.scan.rootId, key: 'noIndex', value: false }] },
  );
}

function checkOrphan(context: Context): void {
  const { pages } = context.options;
  if (pages === undefined || context.address === undefined) return;
  const self = normalizeRoute(context.address);
  if (self === '/' || pages.length < 2) return;
  const linked = pages.some((page) => {
    if (page.document === context.scan.document || normalizeRoute(page.address) === self) return false;
    return scanPage(page.document).elements.some((element) => {
      const href = element.attributes['href'];
      return element.tag === 'a' && href !== undefined && normalizeRoute(href) === self;
    });
  });
  if (!linked) {
    push(context, {
      check: 'seo-orphan',
      severity: 'warning',
      nodeId: context.scan.rootId,
      message: `No other page links to "${context.address}"; add it to the menu (nav.sync) or link it from a section.`,
    });
  }
}

/** Every SEO issue with its fix still as edits: the auto-fix reads this. */
export function collectSeo(document: BuilderDocument, options: CheckSeoOptions = {}): CollectedSeoIssue[] {
  const scan = scanPage(document);
  const own = options.pages?.find((page) => page.document === document);
  const address = options.address ?? own?.address;
  const home = options.pages?.find((page) => normalizeRoute(page.address) === '/');
  const context: Context = { scan, options, address, home, out: [] };
  checkMeta(context);
  checkLangDir(context);
  checkHeadings(context);
  checkImages(context);
  checkLinks(context);
  checkSectionLabels(context);
  checkCanonical(context);
  checkHreflang(context);
  checkJsonLd(context);
  checkSchemaKinds(context);
  checkNoIndexHome(context);
  checkOrphan(context);
  return context.out;
}

/**
 * Every SEO issue on a page, each with its fix as ordinary plan steps when a
 * fix exists. Advisory: `blocks()` never stops a commit on these.
 */
export function checkSeo(document: BuilderDocument, options: CheckSeoOptions = {}): SeoIssue[] {
  return collectSeo(document, options).map(({ issue, edits, safe }) =>
    edits === undefined || edits.length === 0
      ? issue
      : { ...issue, fix: { safe: safe === true, steps: editsToSteps(document, edits) } },
  );
}

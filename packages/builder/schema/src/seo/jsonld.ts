import type { SeoContent } from './extract';
import type { PageSeo, SeoBusiness, SeoBusinessType, SeoSchemaKind, SiteSeo } from './schema';
import { encodeRoute } from './slug';
import { collapseSpace, isRtlLang } from './text';

/*
  schema.org JSON-LD as one `@graph` (DESIGN D.2). Structured data must match
  what the page shows and what the owner confirmed: any value that contains a
  facts-ledger SAMPLE (the placeholder phone, the made-up street) is dropped
  before it can reach a search engine. A LocalBusiness subtype needs `name`
  and `address.city`; without a city the business is described as a plain
  Organization instead.
*/

export type JsonLdValue = string | number | boolean | JsonLdObject | JsonLdValue[];
export interface JsonLdObject {
  [key: string]: JsonLdValue;
}

export interface JsonLdGraph {
  '@context': 'https://schema.org';
  '@graph': JsonLdObject[];
}

export interface JsonLdPageInput {
  title?: string | undefined;
  description?: string | undefined;
  lang?: string | undefined;
  /** The page's site address, e.g. '/' or '/menu'. */
  path?: string | undefined;
  /** Absolute https image for `primaryImageOfPage`. */
  image?: string | undefined;
  seo?: PageSeo | undefined;
}

export interface JsonLdInput {
  site?: SiteSeo | undefined;
  page: JsonLdPageInput;
  /** Absolute page URL; derived from `site.origin` + path when absent. */
  url?: string | undefined;
  content?: SeoContent | undefined;
}

const FOOD_TYPES: ReadonlySet<SeoBusinessType> = new Set(['Restaurant', 'CafeOrCoffeeShop', 'Bakery']);
const SAMPLE_MIN_LENGTH = 3;

function digitsOf(value: string): string {
  return value.replace(/[٠-٩]/gu, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/gu, '');
}

function makeSampleTest(samples: readonly string[] | undefined): (value: string) => boolean {
  const texts = (samples ?? [])
    .map((sample) => collapseSpace(sample).toLowerCase())
    .filter((sample) => sample.length >= SAMPLE_MIN_LENGTH);
  const digitRuns = texts.map(digitsOf).filter((digits) => digits.length >= 6);
  return (value: string): boolean => {
    const text = collapseSpace(value).toLowerCase();
    if (texts.some((sample) => text.includes(sample))) return true;
    const digits = digitsOf(value);
    return digits.length >= 6 && digitRuns.some((run) => digits.includes(run));
  };
}

function trimOrigin(origin: string | undefined): string | undefined {
  return origin?.replace(/\/+$/u, '');
}

const REQUIRED: Readonly<Record<string, readonly string[]>> = {
  Question: ['name', 'acceptedAnswer'],
  Answer: ['text'],
  MenuItem: ['name'],
  Product: ['name', 'offers'],
  Offer: ['price'],
  ListItem: ['position', 'name'],
  PostalAddress: ['addressLocality'],
  ContactPoint: ['telephone'],
  GeoCoordinates: ['latitude', 'longitude'],
  FAQPage: ['mainEntity'],
  Menu: ['hasMenuItem'],
  BreadcrumbList: ['itemListElement'],
};

/** Deep prune: drops sample-bearing strings, then objects missing a required property, then empties. */
function prune(value: JsonLdValue, isSample: (value: string) => boolean): JsonLdValue | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || isSample(trimmed) ? undefined : trimmed;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const kept = value
      .map((item) => prune(item, isSample))
      .filter((item): item is JsonLdValue => item !== undefined);
    return kept.length === 0 ? undefined : kept;
  }
  const out: JsonLdObject = {};
  for (const [key, child] of Object.entries(value)) {
    // Identifiers and types are ours, never page text.
    if (key === '@type' || key === '@id' || key === '@context') {
      out[key] = child;
      continue;
    }
    const kept = prune(child, isSample);
    if (kept !== undefined) out[key] = kept;
  }
  const type = typeof out['@type'] === 'string' ? out['@type'] : undefined;
  if (type !== undefined && (REQUIRED[type] ?? []).some((key) => out[key] === undefined)) return undefined;
  // A bare reference (`{"@id": …}`) is meaningful; a bare type is not.
  const meaningful = Object.keys(out).filter((key) => key !== '@type');
  return meaningful.length === 0 ? undefined : out;
}

function titleCaseSegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // keep the raw segment
  }
  return collapseSpace(decoded.replace(/[-_]+/gu, ' '));
}

function businessNode(
  business: SeoBusiness,
  origin: string | undefined,
  site: SiteSeo,
  hasMenu: boolean,
): JsonLdObject {
  const local = business.type !== 'Organization' && business.address?.city !== undefined;
  const type = business.type === 'Organization' || !local ? 'Organization' : business.type;
  const node: JsonLdObject = { '@type': type, name: business.name };
  if (origin !== undefined) {
    node['@id'] = `${origin}/#organization`;
    node['url'] = `${origin}/`;
  }
  if (business.telephone !== undefined) node['telephone'] = business.telephone;
  if (business.email !== undefined) node['email'] = business.email;
  if (business.logo !== undefined) node['logo'] = business.logo;
  const image = site.defaultImage ?? business.logo;
  if (local && image !== undefined) node['image'] = image;
  if (business.sameAs !== undefined && business.sameAs.length > 0) node['sameAs'] = [...business.sameAs];
  if (business.whatsapp !== undefined) {
    const digits = digitsOf(business.whatsapp);
    const contact: JsonLdObject = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: business.whatsapp,
    };
    if (digits.length >= 7) contact['url'] = `https://wa.me/${digits}`;
    node['contactPoint'] = contact;
  }
  if (local && business.address !== undefined) {
    const address: JsonLdObject = {
      '@type': 'PostalAddress',
      addressLocality: business.address.city,
      addressCountry: business.address.country,
    };
    if (business.address.street !== undefined) address['streetAddress'] = business.address.street;
    if (business.address.region !== undefined) address['addressRegion'] = business.address.region;
    if (business.address.postalCode !== undefined) address['postalCode'] = business.address.postalCode;
    node['address'] = address;
    if (business.geo !== undefined) {
      node['geo'] = {
        '@type': 'GeoCoordinates',
        latitude: business.geo.lat,
        longitude: business.geo.lng,
      };
    }
    if (business.openingHours !== undefined && business.openingHours.length > 0) {
      node['openingHours'] = [...business.openingHours];
    }
    if (business.priceRange !== undefined) node['priceRange'] = business.priceRange;
    if (FOOD_TYPES.has(business.type)) {
      if (business.servesCuisine !== undefined && business.servesCuisine.length > 0) {
        node['servesCuisine'] = [...business.servesCuisine];
      }
      if (hasMenu && origin !== undefined) node['hasMenu'] = { '@id': `${origin}/#menu` };
    }
  }
  return node;
}

/**
 * Builds the page's JSON-LD `@graph`: WebSite, Organization or a
 * LocalBusiness subtype, WebPage (with `inLanguage`), BreadcrumbList, and
 * FAQPage / Menu / Product / Service / Article when the page asks for that
 * kind in `seo.schemaKinds` AND the content to back it exists. Any value
 * containing a `seo.samples` entry is omitted.
 */
export function buildJsonLdGraph(input: JsonLdInput): JsonLdGraph {
  const site = input.site ?? input.page.seo?.site ?? {};
  const seo = input.page.seo ?? {};
  const isSample = makeSampleTest(seo.samples);
  const clean = (value: string | undefined): string | undefined =>
    value === undefined || value.trim() === '' || isSample(value) ? undefined : value.trim();
  const origin = trimOrigin(site.origin);
  const path = input.page.path ?? '/';
  const url = input.url ?? (origin === undefined ? undefined : `${origin}${encodeRoute(path)}`);
  const lang = input.page.lang;
  const kinds = new Set(seo.schemaKinds ?? []);
  const content = input.content;
  const title = clean(input.page.title) ?? clean(content?.title) ?? clean(content?.headings.find((h) => h.level === 1)?.text);
  const description = clean(input.page.description) ?? clean(content?.description) ?? clean(content?.firstParagraph);

  // Business facts are cleaned first: a sample name or city removes the node's basis.
  const rawBusiness = site.business;
  let business: SeoBusiness | undefined;
  if (rawBusiness !== undefined) {
    const name = clean(rawBusiness.name);
    if (name !== undefined) {
      const city = clean(rawBusiness.address?.city);
      const { address: rawAddress, ...rest } = rawBusiness;
      business = { ...rest, name };
      if (rawAddress !== undefined && city !== undefined) business.address = { ...rawAddress, city };
    }
  }

  const graph: JsonLdObject[] = [];
  const siteName = clean(site.siteName) ?? business?.name;
  const menuItems =
    kinds.has('Menu') && content !== undefined
      ? content.prices.filter((price) => price.label !== undefined && price.amount !== undefined)
      : [];

  if (siteName !== undefined) {
    const website: JsonLdObject = { '@type': 'WebSite', name: siteName };
    if (origin !== undefined) {
      website['@id'] = `${origin}/#website`;
      website['url'] = `${origin}/`;
    }
    if (lang !== undefined && lang !== '') website['inLanguage'] = lang;
    if (business !== undefined && origin !== undefined) website['publisher'] = { '@id': `${origin}/#organization` };
    graph.push(website);
  }
  if (business !== undefined) graph.push(businessNode(business, origin, site, menuItems.length > 0));

  const webPage: JsonLdObject = { '@type': seo.pageKind === 'about' ? 'AboutPage' : seo.pageKind === 'contact' ? 'ContactPage' : 'WebPage' };
  if (url !== undefined) {
    webPage['@id'] = `${url}#webpage`;
    webPage['url'] = url;
  }
  if (title !== undefined) webPage['name'] = title;
  if (description !== undefined) webPage['description'] = description;
  if (lang !== undefined && lang !== '') webPage['inLanguage'] = lang;
  if (origin !== undefined && siteName !== undefined) webPage['isPartOf'] = { '@id': `${origin}/#website` };
  if (origin !== undefined && business !== undefined && (path === '/' || seo.pageKind === 'home')) {
    webPage['about'] = { '@id': `${origin}/#organization` };
  }
  const image = clean(input.page.image) ?? clean(site.defaultImage);
  if (image !== undefined) webPage['primaryImageOfPage'] = { '@type': 'ImageObject', url: image };

  // Breadcrumb from the address: Home › segment › … › this page.
  const segments = path.split(/[?#]/u)[0]?.split('/').filter((segment) => segment !== '') ?? [];
  if (origin !== undefined && segments.length > 0) {
    const home = isRtlLang(lang) ? 'الرئيسية' : 'Home';
    const items: JsonLdObject[] = [{ '@type': 'ListItem', position: 1, name: siteName ?? home, item: `${origin}/` }];
    segments.forEach((segment, index) => {
      const last = index === segments.length - 1;
      const itemPath = `/${segments.slice(0, index + 1).join('/')}`;
      items.push({
        '@type': 'ListItem',
        position: index + 2,
        name: last ? (title ?? titleCaseSegment(segment)) : titleCaseSegment(segment),
        item: `${origin}${encodeRoute(itemPath)}`,
      });
    });
    const breadcrumb: JsonLdObject = { '@type': 'BreadcrumbList', itemListElement: items };
    if (url !== undefined) {
      breadcrumb['@id'] = `${url}#breadcrumb`;
      webPage['breadcrumb'] = { '@id': `${url}#breadcrumb` };
    }
    graph.push(webPage, breadcrumb);
  } else {
    graph.push(webPage);
  }

  const provider: JsonLdObject | undefined =
    business !== undefined && origin !== undefined ? { '@id': `${origin}/#organization` } : business !== undefined ? { '@type': 'Organization', name: business.name } : undefined;

  if (kinds.has('FAQPage') && content !== undefined && content.faqs.length > 0) {
    const faq: JsonLdObject = {
      '@type': 'FAQPage',
      mainEntity: content.faqs.map((pair) => ({
        '@type': 'Question',
        name: pair.question,
        acceptedAnswer: { '@type': 'Answer', text: pair.answer },
      })),
    };
    if (url !== undefined) faq['@id'] = `${url}#faq`;
    if (lang !== undefined && lang !== '') faq['inLanguage'] = lang;
    graph.push(faq);
  }

  const offerOf = (price: (typeof menuItems)[number]): JsonLdObject => {
    const offer: JsonLdObject = { '@type': 'Offer', price: String(price.amount) };
    if (price.currency !== undefined) offer['priceCurrency'] = price.currency;
    return offer;
  };

  if (menuItems.length > 0) {
    const menu: JsonLdObject = {
      '@type': 'Menu',
      hasMenuItem: menuItems.map((price) => ({
        '@type': 'MenuItem',
        name: price.label ?? '',
        offers: offerOf(price),
      })),
    };
    if (origin !== undefined) menu['@id'] = `${origin}/#menu`;
    if (lang !== undefined && lang !== '') menu['inLanguage'] = lang;
    graph.push(menu);
  }

  if (kinds.has('Product') && content !== undefined) {
    for (const price of content.prices) {
      if (price.label === undefined || price.amount === undefined) continue;
      const product: JsonLdObject = { '@type': 'Product', name: price.label, offers: offerOf(price) };
      if (provider !== undefined) product['brand'] = provider;
      graph.push(product);
    }
  }

  if (kinds.has('Service') && title !== undefined) {
    const service: JsonLdObject = { '@type': 'Service', name: title };
    if (description !== undefined) service['description'] = description;
    if (provider !== undefined) service['provider'] = provider;
    if (business?.address !== undefined) service['areaServed'] = business.address.city;
    graph.push(service);
  }

  if (kinds.has('Article') && title !== undefined) {
    const article: JsonLdObject = { '@type': 'Article', headline: title };
    if (description !== undefined) article['description'] = description;
    if (lang !== undefined && lang !== '') article['inLanguage'] = lang;
    if (image !== undefined) article['image'] = image;
    if (provider !== undefined) article['publisher'] = provider;
    if (url !== undefined) article['mainEntityOfPage'] = { '@id': `${url}#webpage` };
    graph.push(article);
  }

  const pruned = graph
    .map((node) => prune(node, isSample))
    .filter((node): node is JsonLdObject => typeof node === 'object' && !Array.isArray(node));
  return { '@context': 'https://schema.org', '@graph': pruned };
}

/**
 * The structured-data kinds a page's own content backs (DESIGN D.3): FAQPage
 * when it has question/answer pairs, Menu when a food business lists priced
 * items, Product when a store does. `buildJsonLdGraph` emits a kind only when
 * `seo.schemaKinds` asks for it, so the build and the SEO pass write this
 * list — the page never claims a kind its visible content cannot back.
 */
export function deriveSchemaKinds(
  content: Pick<SeoContent, 'faqs' | 'prices'>,
  businessType?: SeoBusinessType,
): SeoSchemaKind[] {
  const kinds: SeoSchemaKind[] = [];
  if (content.faqs.length > 0) kinds.push('FAQPage');
  const priced = content.prices.some((price) => price.label !== undefined && price.amount !== undefined);
  if (priced && businessType !== undefined && FOOD_TYPES.has(businessType)) kinds.push('Menu');
  else if (priced && businessType === 'Store') kinds.push('Product');
  return kinds;
}

/**
 * JSON for an inline `<script type="application/ld+json">`: `</` becomes
 * `<\/` and `<!--` becomes `<!--`, so page text can never close the
 * script or open a comment; U+2028/2029 are escaped for old parsers.
 */
export function serializeJsonLd(graph: JsonLdGraph | JsonLdObject): string {
  return JSON.stringify(graph)
    .replace(/<!--/gu, '\\u003C!--')
    .replace(/<\//gu, '<\\/')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

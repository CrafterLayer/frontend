import {
  validateSite,
  type AssetEntry,
  type AssetId,
  type BuilderDocument,
  type BuilderSite,
  type DesignSystem,
  type PageId,
  type Patch,
  type SharedRegion,
  type SharedRegionId,
  type SharedRegionKind,
  type SitePage,
} from '@craftkit/builder-schema';

import { canonicalJson } from './canonical-json';
import {
  documentPatches,
  projectDocument,
  readDocumentText,
  type CodecPorts,
  type ParseResult,
  type ProjectionText,
} from './document-codec';
import { strictParse, type ParseError, type ParsedJson } from './strict-parse';

/**
 * The site codec: a site's TEXT, and the patches that come back from editing it.
 *
 * ## Why a site projection is several texts and not one
 *
 * A site is a manifest plus N documents, and they are edited at different
 * scopes. Printing the whole thing as one blob would mean that changing a word
 * in one page's headline re-serialises every page in the site on every
 * keystroke — the exact cost the code-view worker exists to avoid. So the
 * projection DECOMPOSES: one manifest text, plus one text per page and per
 * shared region, each of which is byte-identical to what `projectDocument`
 * produces for that document standing alone.
 *
 * That last property is the point of the whole file. The per-page round-trip
 * law is not restated here and not re-derived here — the site codec CALLS the
 * document codec, so a page inside a site is proven by the same 1,000-case law
 * that proves a page on its own.
 *
 * ## What the manifest can and cannot do
 *
 * The manifest is the site MINUS its documents: version, direction, page
 * metadata in order, shared-region kinds, the design system, and the asset
 * library. Editing it can rename, re-address, re-wire, reorder, and remove
 * pages. It cannot CREATE one, because a page without a document is not a page
 * and the manifest carries no documents. `parseSiteManifest` says so in words
 * rather than inventing an empty page; `parseSite`, which is handed the whole
 * bundle, can create a page because the bundle carries its text.
 *
 * ## Patch shape
 *
 * Patches are rooted at the SITE, because the site is the transaction unit
 * (`applySitePatches`). They are page-granular and node-granular for the same
 * reason the document codec's are: history must store what CHANGED, and the
 * door refuses an empty path.
 */

/** The id the site manifest registers under, mirroring `CANONICAL_JSON_PROJECTION_ID`. */
export const SITE_MANIFEST_PROJECTION_ID = 'site-manifest';

/** Bumped only when the manifest's own shape changes; unrelated to `siteVersion`. */
export const SITE_MANIFEST_VERSION = 1 as const;

export interface SiteProjectionText {
  /** The site without its documents. */
  readonly manifest: string;
  /** `projectDocument(page.document).text`, keyed by page id. */
  readonly pages: Readonly<Record<PageId, string>>;
  /** `projectDocument(region.document).text`, keyed by shared-region id. */
  readonly regions: Readonly<Record<SharedRegionId, string>>;
}

const MANIFEST_FIELDS = new Set([
  'manifest',
  'siteVersion',
  'dir',
  'pages',
  'sharedRegions',
  'designSystem',
  'assets',
]);
const MANIFEST_PAGE_FIELDS = new Set(['id', 'address', 'title', 'purpose', 'audience', 'regions']);
const MANIFEST_REGION_FIELDS = new Set(['id', 'kind']);
const PAGE_TEXT_FIELDS = ['address', 'title', 'purpose', 'audience'] as const;

type Path = readonly (string | number)[];

interface ShapeContext {
  parsed: ParsedJson;
  errors: ParseError[];
}

interface ManifestPage {
  id: PageId;
  address: string;
  title: string;
  purpose: string;
  audience: string;
  regions: readonly SharedRegionId[];
}

interface ManifestRegion {
  id: SharedRegionId;
  kind: SharedRegionKind;
}

interface SiteManifest {
  siteVersion: number;
  dir: BuilderSite['dir'];
  pages: readonly ManifestPage[];
  sharedRegions: Readonly<Record<SharedRegionId, ManifestRegion>>;
  designSystem: DesignSystem;
  assets: Readonly<Record<AssetId, AssetEntry>>;
}

/** Documents supplied alongside a manifest, overriding the base site's own. */
interface SuppliedDocuments {
  pages: Readonly<Record<PageId, BuilderDocument>>;
  regions: Readonly<Record<SharedRegionId, BuilderDocument>>;
}

const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const emptyRecord = <T>(): Record<string, T> => {
  const record: Record<string, T> = {};
  Object.setPrototypeOf(record, null);
  return record;
};

const defineOwn = <T>(record: Record<string, T>, key: string, value: T): void => {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const addError = (context: ShapeContext, path: Path, message: string): void => {
  context.errors.push({ line: context.parsed.lineAt(path), message });
};

const ownValue = (record: Record<string, unknown>, key: string): unknown =>
  hasOwn(record, key) ? record[key] : undefined;

/* ── Projection ───────────────────────────────────────────────────────────── */

export function projectSiteManifest(site: BuilderSite): ProjectionText {
  const pages = site.pages.map((page) => ({
    address: page.address,
    audience: page.audience,
    id: page.id,
    purpose: page.purpose,
    regions: [...page.regions],
    title: page.title,
  }));

  const sharedRegions = emptyRecord<ManifestRegion>();
  for (const id of Object.keys(site.sharedRegions)) {
    const region = site.sharedRegions[id];
    if (region !== undefined) {
      defineOwn(sharedRegions, id, { id: region.id, kind: region.kind });
    }
  }

  return {
    text: canonicalJson({
      assets: site.assets,
      designSystem: site.designSystem,
      dir: site.dir,
      manifest: SITE_MANIFEST_VERSION,
      pages,
      sharedRegions,
      siteVersion: site.siteVersion,
    }),
  };
}

export function projectSitePage(site: BuilderSite, pageId: PageId): ProjectionText | undefined {
  const page = site.pages.find((entry) => entry.id === pageId);
  return page === undefined ? undefined : projectDocument(page.document);
}

export function projectSiteRegion(
  site: BuilderSite,
  regionId: SharedRegionId,
): ProjectionText | undefined {
  const region = hasOwn(site.sharedRegions, regionId) ? site.sharedRegions[regionId] : undefined;
  return region === undefined ? undefined : projectDocument(region.document);
}

export function projectSite(site: BuilderSite): SiteProjectionText {
  const pages = emptyRecord<string>();
  for (const page of site.pages) {
    defineOwn(pages, page.id, projectDocument(page.document).text);
  }

  const regions = emptyRecord<string>();
  for (const id of Object.keys(site.sharedRegions)) {
    const region = site.sharedRegions[id];
    if (region !== undefined) {
      defineOwn(regions, id, projectDocument(region.document).text);
    }
  }

  return { manifest: projectSiteManifest(site).text, pages, regions };
}

/* ── Parsing ──────────────────────────────────────────────────────────────── */

/**
 * The manifest alone, against a base site.
 *
 * Page and region DOCUMENTS come from the base untouched: this scope cannot see
 * them, so it cannot change them and it cannot create the pages that would need
 * them.
 */
export function parseSiteManifest(text: string, base: BuilderSite): ParseResult {
  /*
    No `CodecPorts` here, and that absence is the contract rather than an
    oversight: block-type registration is checked when a DOCUMENT is read, and
    this scope reads none. Taking a registry it could not consult would promise
    a check it does not perform.
  */
  const strict = strictParse(text);
  if (!strict.ok) {
    return strict;
  }
  const context: ShapeContext = { parsed: strict.parsed, errors: [] };
  const manifest = readManifest(strict.parsed.value, base, context);
  if (manifest === undefined) {
    return { ok: false, errors: context.errors };
  }
  return finishParse(manifest, base, { pages: emptyRecord(), regions: emptyRecord() }, context);
}

/**
 * A whole site projection — manifest plus every page and region text.
 *
 * The bundle must MATCH the manifest exactly: a page named in the manifest with
 * no text is refused, and a text for a page the manifest does not name is
 * refused. Silently ignoring either would let a person delete a page in one
 * pane and keep editing it in another, then wonder which pane won.
 */
export function parseSite(
  projection: SiteProjectionText,
  base: BuilderSite,
  ports: CodecPorts,
): ParseResult {
  const strict = strictParse(projection.manifest);
  if (!strict.ok) {
    return strict;
  }
  const context: ShapeContext = { parsed: strict.parsed, errors: [] };
  const manifest = readManifest(strict.parsed.value, base, context);
  if (manifest === undefined) {
    return { ok: false, errors: context.errors };
  }

  const pages = readSuppliedDocuments(
    'page',
    manifest.pages.map((page) => page.id),
    projection.pages,
    ports,
    context,
  );
  const regions = readSuppliedDocuments(
    'shared region',
    Object.keys(manifest.sharedRegions),
    projection.regions,
    ports,
    context,
  );
  if (context.errors.length > 0) {
    return { ok: false, errors: context.errors };
  }

  return finishParse(manifest, base, { pages, regions }, context);
}

/**
 * One page's document text, against the site it belongs to.
 *
 * `parseDocument` and a prefix — deliberately not a second parser. The page's
 * own document is the base, so a page edit costs one document diff and reaches
 * exactly one slot of the site. This is the path a code-view pane uses while a
 * person types, and it is why typing in a four-page site does not re-serialise
 * the other three.
 *
 * The whole-site checks still run, because a page edit CAN break them: flipping
 * a page's direction or naming an asset the library does not hold is a site
 * problem discovered in a page's text. They are reported without a line number,
 * because they are not about any line of it.
 */
export function parseSitePage(
  text: string,
  base: BuilderSite,
  pageId: PageId,
  ports: CodecPorts,
): ParseResult {
  const index = base.pages.findIndex((page) => page.id === pageId);
  const page = base.pages[index];
  if (page === undefined) {
    return { ok: false, errors: [{ line: 1, message: `This site has no page "${pageId}".` }] };
  }
  return parseNestedDocument(text, base, page.document, ports, (document) => ({
    ...base,
    pages: base.pages.map((entry, at) => (at === index ? { ...entry, document } : entry)),
  }), ['pages', index, 'document']);
}

/** The shared-region mirror of `parseSitePage`. */
export function parseSiteRegion(
  text: string,
  base: BuilderSite,
  regionId: SharedRegionId,
  ports: CodecPorts,
): ParseResult {
  const region = hasOwn(base.sharedRegions, regionId) ? base.sharedRegions[regionId] : undefined;
  if (region === undefined) {
    return {
      ok: false,
      errors: [{ line: 1, message: `This site has no shared region "${regionId}".` }],
    };
  }
  return parseNestedDocument(text, base, region.document, ports, (document) => {
    const sharedRegions = emptyRecord<SharedRegion>();
    for (const id of Object.keys(base.sharedRegions)) {
      const entry = base.sharedRegions[id];
      if (entry === undefined) continue;
      defineOwn(sharedRegions, id, id === regionId ? { ...entry, document } : entry);
    }
    return { ...base, sharedRegions };
  }, ['sharedRegions', regionId, 'document']);
}

function parseNestedDocument(
  text: string,
  base: BuilderSite,
  current: BuilderDocument,
  ports: CodecPorts,
  compose: (document: BuilderDocument) => BuilderSite,
  prefix: Path,
): ParseResult {
  const read = readDocumentText(text, ports);
  if (!read.ok) {
    return { ok: false, errors: read.errors };
  }
  const issues = siteIssues(compose(read.document));
  if (issues.length > 0) {
    return { ok: false, errors: issues.map((message) => ({ line: 1, message })) };
  }
  return { ok: true, patches: reroot(documentPatches(current, read.document), prefix) };
}

function finishParse(
  manifest: SiteManifest,
  base: BuilderSite,
  documents: SuppliedDocuments,
  context: ShapeContext,
): ParseResult {
  const candidate = composeSite(manifest, base, documents, context);
  if (candidate === undefined) {
    return { ok: false, errors: context.errors };
  }

  validateCandidateSite(candidate, context);
  if (context.errors.length > 0) {
    return { ok: false, errors: context.errors };
  }
  return { ok: true, patches: sitePatches(base, candidate) };
}

/**
 * Every text in the bundle, read into a document — and every mismatch between
 * the bundle's keys and the manifest's, reported.
 */
function readSuppliedDocuments(
  label: string,
  ids: readonly string[],
  texts: Readonly<Record<string, string>>,
  ports: CodecPorts,
  context: ShapeContext,
): Record<string, BuilderDocument> {
  const documents = emptyRecord<BuilderDocument>();
  const named = new Set(ids);

  for (const key of Object.keys(texts)) {
    if (!named.has(key)) {
      addError(
        context,
        [],
        `The projection carries text for ${label} "${key}", which this manifest does not name.`,
      );
    }
  }

  for (const id of ids) {
    const text = hasOwn(texts, id) ? texts[id] : undefined;
    if (text === undefined) {
      addError(context, [], `The projection carries no text for ${label} "${id}".`);
      continue;
    }
    const read = readDocumentText(text, ports);
    if (!read.ok) {
      for (const error of read.errors) {
        /*
          The line number belongs to that document's OWN text, not to the
          manifest, so it is stated rather than remapped. A line number silently
          rebased onto the wrong pane is worse than none.
        */
        context.errors.push({
          line: error.line,
          message: `In the ${label} "${id}": ${error.message}`,
        });
      }
      continue;
    }
    defineOwn(documents, id, read.document);
  }
  return documents;
}

function composeSite(
  manifest: SiteManifest,
  base: BuilderSite,
  documents: SuppliedDocuments,
  context: ShapeContext,
): BuilderSite | undefined {
  const basePages = new Map(base.pages.map((page) => [page.id, page]));
  const startErrors = context.errors.length;

  const pages: SitePage[] = [];
  manifest.pages.forEach((page, index) => {
    const supplied = hasOwn(documents.pages, page.id) ? documents.pages[page.id] : undefined;
    const document = supplied ?? basePages.get(page.id)?.document;
    if (document === undefined) {
      addError(
        context,
        ['pages', index],
        `Page "${page.id}" is new and this text carries no document for it. Add a page through the "addPage" command, or edit the whole site projection, which does carry page texts.`,
      );
      return;
    }
    pages.push({ ...page, regions: [...page.regions], document });
  });

  const sharedRegions = emptyRecord<SharedRegion>();
  for (const id of Object.keys(manifest.sharedRegions)) {
    const region = manifest.sharedRegions[id];
    if (region === undefined) {
      continue;
    }
    const supplied = hasOwn(documents.regions, id) ? documents.regions[id] : undefined;
    const baseRegion = hasOwn(base.sharedRegions, id) ? base.sharedRegions[id] : undefined;
    const document = supplied ?? baseRegion?.document;
    if (document === undefined) {
      addError(
        context,
        ['sharedRegions', id],
        `Shared region "${id}" is new and this text carries no document for it. Add it through the "setSharedRegion" command, or edit the whole site projection, which does carry region texts.`,
      );
      continue;
    }
    defineOwn(sharedRegions, id, { id: region.id, kind: region.kind, document });
  }

  if (context.errors.length !== startErrors) {
    return undefined;
  }
  return {
    siteVersion: manifest.siteVersion,
    dir: manifest.dir,
    pages,
    sharedRegions,
    designSystem: manifest.designSystem,
    assets: manifest.assets,
  };
}

/**
 * The whole-site door, run here so a person sees the refusal against the text
 * they are editing instead of against a patch batch they never wrote.
 *
 * `applySitePatches` runs the same check again at commit. That is deliberate
 * duplication: this one has line numbers and that one has authority.
 */
function validateCandidateSite(candidate: BuilderSite, context: ShapeContext): void {
  let result;
  try {
    result = validateSite(candidate);
  } catch {
    addError(context, [], 'The site could not be structurally validated.');
    return;
  }
  if (result.ok) {
    return;
  }
  for (const issue of result.issues) {
    const pageId = issue.at?.pageId;
    const regionId = issue.at?.regionId;
    const index = pageId === undefined ? -1 : candidate.pages.findIndex((p) => p.id === pageId);
    const path: Path =
      index >= 0 ? ['pages', index] : regionId === undefined ? [] : ['sharedRegions', regionId];
    addError(context, path, issue.message);
  }
}

/** The same door, for a caller that has no text to point a line number at. */
function siteIssues(candidate: BuilderSite): string[] {
  try {
    const result = validateSite(candidate);
    return result.ok ? [] : result.issues.map((issue) => issue.message);
  } catch {
    return ['The site could not be structurally validated.'];
  }
}

/* ── Manifest reader ──────────────────────────────────────────────────────── */

function readManifest(
  value: unknown,
  base: BuilderSite,
  context: ShapeContext,
): SiteManifest | undefined {
  if (!isRecord(value)) {
    addError(context, [], 'A site manifest must be a JSON object.');
    return undefined;
  }
  reportUnknownFields(value, MANIFEST_FIELDS, [], context);
  const startErrors = context.errors.length;

  const version = readNumber(value, 'manifest', [], context);
  if (version !== undefined && version !== SITE_MANIFEST_VERSION) {
    addError(
      context,
      ['manifest'],
      `Unsupported site manifest version ${String(version)}; expected ${String(SITE_MANIFEST_VERSION)}.`,
    );
  }

  const siteVersion = readNumber(value, 'siteVersion', [], context);
  if (siteVersion !== undefined && siteVersion !== base.siteVersion) {
    /*
      Law M: migrations own `siteVersion`, and `applySitePatches` refuses a batch
      that moves it. Refusing here, with a line number, beats refusing at the
      door with none.
    */
    addError(
      context,
      ['siteVersion'],
      `A site's version is owned by migrations; text cannot move it from ${String(base.siteVersion)} to ${String(siteVersion)}.`,
    );
  }

  const dir = readDirection(value, context);
  const pages = readManifestPages(ownValue(value, 'pages'), context, hasOwn(value, 'pages'));
  const sharedRegions = readManifestRegions(
    ownValue(value, 'sharedRegions'),
    context,
    hasOwn(value, 'sharedRegions'),
  );
  const designSystem = readOpaqueObject(value, 'designSystem', context);
  const assets = readOpaqueObject(value, 'assets', context);

  if (
    context.errors.length !== startErrors ||
    siteVersion === undefined ||
    dir === undefined ||
    pages === undefined ||
    sharedRegions === undefined ||
    designSystem === undefined ||
    assets === undefined
  ) {
    return undefined;
  }

  /*
    `designSystem` and `assets` cross as opaque JSON on purpose. Their door is
    `validateSite`, which runs on the composed candidate a few lines later and
    produces real messages — the same reason the pipeline's wire types a design
    system as JSON rather than as its interface.
  */
  return {
    siteVersion,
    dir,
    pages,
    sharedRegions,
    designSystem: designSystem as unknown as DesignSystem,
    assets: assets as unknown as Record<AssetId, AssetEntry>,
  };
}

function readManifestPages(
  value: unknown,
  context: ShapeContext,
  present: boolean,
): readonly ManifestPage[] | undefined {
  if (!present) {
    addError(context, [], 'Missing required field "pages".');
    return undefined;
  }
  if (!Array.isArray(value)) {
    addError(context, ['pages'], 'Field "pages" must be an array, in the site\'s own page order.');
    return undefined;
  }

  const startErrors = context.errors.length;
  const pages: ManifestPage[] = [];
  value.forEach((entry, index) => {
    const page = readManifestPage(entry, ['pages', index], context);
    if (page !== undefined) {
      pages.push(page);
    }
  });
  return context.errors.length === startErrors ? pages : undefined;
}

function readManifestPage(
  value: unknown,
  path: Path,
  context: ShapeContext,
): ManifestPage | undefined {
  if (!isRecord(value)) {
    addError(context, path, 'Each page entry must be a JSON object.');
    return undefined;
  }
  reportUnknownFields(value, MANIFEST_PAGE_FIELDS, path, context);
  const startErrors = context.errors.length;

  const id = readString(value, 'id', path, context);
  const address = readString(value, 'address', path, context);
  const title = readString(value, 'title', path, context);
  const purpose = readString(value, 'purpose', path, context);
  const audience = readString(value, 'audience', path, context);
  const regions = readStringArray(value, 'regions', path, context);

  if (
    context.errors.length !== startErrors ||
    id === undefined ||
    address === undefined ||
    title === undefined ||
    purpose === undefined ||
    audience === undefined ||
    regions === undefined
  ) {
    return undefined;
  }
  return { id, address, title, purpose, audience, regions };
}

function readManifestRegions(
  value: unknown,
  context: ShapeContext,
  present: boolean,
): Readonly<Record<SharedRegionId, ManifestRegion>> | undefined {
  if (!present) {
    addError(context, [], 'Missing required field "sharedRegions".');
    return undefined;
  }
  if (!isRecord(value)) {
    addError(context, ['sharedRegions'], 'Field "sharedRegions" must be a JSON object keyed by id.');
    return undefined;
  }

  const startErrors = context.errors.length;
  const regions = emptyRecord<ManifestRegion>();
  for (const key of Object.keys(value)) {
    const path = ['sharedRegions', key] as const;
    const entry = value[key];
    if (!isRecord(entry)) {
      addError(context, path, 'Each shared-region entry must be a JSON object.');
      continue;
    }
    reportUnknownFields(entry, MANIFEST_REGION_FIELDS, path, context);
    const id = readString(entry, 'id', path, context);
    const kind = entry['kind'];
    if (kind !== 'header' && kind !== 'footer') {
      addError(context, [...path, 'kind'], 'A shared region\'s "kind" must be "header" or "footer".');
      continue;
    }
    if (id === undefined) {
      continue;
    }
    if (id !== key) {
      addError(
        context,
        [...path, 'id'],
        `Shared region stored under key "${key}" carries id "${id}"; keys and ids must match.`,
      );
      continue;
    }
    defineOwn(regions, key, { id, kind });
  }
  return context.errors.length === startErrors ? regions : undefined;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  context: ShapeContext,
): string | undefined {
  if (!hasOwn(record, key)) {
    addError(context, path, `Missing required field "${key}".`);
    return undefined;
  }
  const value = record[key];
  if (typeof value !== 'string') {
    addError(context, [...path, key], `Field "${key}" must be a string.`);
    return undefined;
  }
  return value;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  context: ShapeContext,
): number | undefined {
  if (!hasOwn(record, key)) {
    addError(context, path, `Missing required field "${key}".`);
    return undefined;
  }
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    addError(context, [...path, key], `Field "${key}" must be a non-negative integer.`);
    return undefined;
  }
  return value;
}

function readDirection(
  record: Record<string, unknown>,
  context: ShapeContext,
): BuilderSite['dir'] | undefined {
  if (!hasOwn(record, 'dir')) {
    addError(context, [], 'Missing required field "dir".');
    return undefined;
  }
  const value = record['dir'];
  if (value !== 'ltr' && value !== 'rtl') {
    addError(context, ['dir'], 'Field "dir" must be either "ltr" or "rtl".');
    return undefined;
  }
  return value;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  context: ShapeContext,
): readonly string[] | undefined {
  if (!hasOwn(record, key)) {
    addError(context, path, `Missing required field "${key}".`);
    return undefined;
  }
  const value = record[key];
  if (!Array.isArray(value)) {
    addError(context, [...path, key], `Field "${key}" must be an array of ids.`);
    return undefined;
  }
  const startErrors = context.errors.length;
  const ids: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      addError(context, [...path, key, index], `Every entry in "${key}" must be an id string.`);
    } else {
      ids.push(entry);
    }
  });
  return context.errors.length === startErrors ? ids : undefined;
}

/** Read a field that this codec does not interpret; `validateSite` is its door. */
function readOpaqueObject(
  record: Record<string, unknown>,
  key: string,
  context: ShapeContext,
): Record<string, unknown> | undefined {
  if (!hasOwn(record, key)) {
    addError(context, [], `Missing required field "${key}".`);
    return undefined;
  }
  const value = record[key];
  if (!isRecord(value)) {
    addError(context, [key], `Field "${key}" must be a JSON object.`);
    return undefined;
  }
  return value;
}

function reportUnknownFields(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: Path,
  context: ShapeContext,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      addError(context, [...path, key], `Field "${key}" has no textual site representation.`);
    }
  }
}

/* ── Diff ─────────────────────────────────────────────────────────────────── */

const reroot = (patches: readonly Patch[], prefix: Path): Patch[] =>
  patches.map((patch) => ({ ...patch, path: [...prefix, ...patch.path] }));

/** A document with its header and no nodes — the shell a whole-page write starts from. */
const shellDocument = (document: BuilderDocument): BuilderDocument => ({
  schemaVersion: document.schemaVersion,
  surface: document.surface,
  dir: document.dir,
  rootId: document.rootId,
  nodes: emptyRecord(),
});

/**
 * Every change between two sites, as patches rooted at the site.
 *
 * A page whose id stays in place is patched field by field and node by node. A
 * page that MOVED or arrived is written as a metadata shell and then filled
 * node by node — because immer patches have no move operation, and because a
 * whole-page value would be a single enormous patch that history could not
 * read. The shell is briefly a document whose root is missing; that is fine and
 * deliberate, since `applySitePatches` validates once, after the whole batch.
 */
function sitePatches(base: BuilderSite, candidate: BuilderSite): Patch[] {
  const patches: Patch[] = [];

  if (base.dir !== candidate.dir) {
    patches.push({ op: 'replace', path: ['dir'], value: candidate.dir });
  }
  if (canonicalJson(base.designSystem) !== canonicalJson(candidate.designSystem)) {
    patches.push({ op: 'replace', path: ['designSystem'], value: candidate.designSystem });
  }
  patches.push(...recordPatches(base.assets, candidate.assets, 'assets'));
  patches.push(...regionPatches(base, candidate));
  patches.push(...pagePatches(base, candidate));
  return patches;
}

function recordPatches(
  base: Readonly<Record<string, unknown>>,
  candidate: Readonly<Record<string, unknown>>,
  field: string,
): Patch[] {
  const patches: Patch[] = [];
  for (const key of Object.keys(candidate).sort()) {
    const next = candidate[key];
    const current = hasOwn(base, key) ? base[key] : undefined;
    if (current === undefined) {
      patches.push({ op: 'add', path: [field, key], value: next });
    } else if (canonicalJson(current) !== canonicalJson(next)) {
      patches.push({ op: 'replace', path: [field, key], value: next });
    }
  }
  for (const key of Object.keys(base).sort()) {
    if (!hasOwn(candidate, key)) {
      patches.push({ op: 'remove', path: [field, key] });
    }
  }
  return patches;
}

function regionPatches(base: BuilderSite, candidate: BuilderSite): Patch[] {
  const patches: Patch[] = [];

  for (const id of Object.keys(candidate.sharedRegions).sort()) {
    const next = candidate.sharedRegions[id];
    if (next === undefined) {
      continue;
    }
    const current = hasOwn(base.sharedRegions, id) ? base.sharedRegions[id] : undefined;
    if (current === undefined) {
      patches.push({
        op: 'add',
        path: ['sharedRegions', id],
        value: { id: next.id, kind: next.kind, document: shellDocument(next.document) },
      });
      patches.push(
        ...reroot(documentPatches(shellDocument(next.document), next.document), [
          'sharedRegions',
          id,
          'document',
        ]),
      );
      continue;
    }
    if (current.kind !== next.kind) {
      patches.push({ op: 'replace', path: ['sharedRegions', id, 'kind'], value: next.kind });
    }
    patches.push(
      ...reroot(documentPatches(current.document, next.document), ['sharedRegions', id, 'document']),
    );
  }

  for (const id of Object.keys(base.sharedRegions).sort()) {
    if (!hasOwn(candidate.sharedRegions, id)) {
      patches.push({ op: 'remove', path: ['sharedRegions', id] });
    }
  }
  return patches;
}

function pagePatches(base: BuilderSite, candidate: BuilderSite): Patch[] {
  const patches: Patch[] = [];
  const wanted = new Set(candidate.pages.map((page) => page.id));

  /*
    Descending, so every index still names the page it named when the batch was
    written. Ascending removal would shift the ground under its own feet.
  */
  for (let index = base.pages.length - 1; index >= 0; index -= 1) {
    const page = base.pages[index];
    if (page !== undefined && !wanted.has(page.id)) {
      patches.push({ op: 'remove', path: ['pages', index] });
    }
  }

  const survivors = base.pages.filter((page) => wanted.has(page.id));
  const basePages = new Map(base.pages.map((page) => [page.id, page]));

  candidate.pages.forEach((want, index) => {
    const inPlace = survivors[index];
    if (inPlace?.id === want.id) {
      const current = basePages.get(want.id);
      /* `survivors` holds base pages, so `current` is always defined here. */
      if (current === undefined) {
        return;
      }
      for (const field of PAGE_TEXT_FIELDS) {
        if (current[field] !== want[field]) {
          patches.push({ op: 'replace', path: ['pages', index, field], value: want[field] });
        }
      }
      if (canonicalJson(current.regions) !== canonicalJson(want.regions)) {
        patches.push({ op: 'replace', path: ['pages', index, 'regions'], value: [...want.regions] });
      }
      patches.push(
        ...reroot(documentPatches(current.document, want.document), [
          'pages',
          index,
          'document',
        ]),
      );
      return;
    }

    /*
      This slot must hold a different page than it does. `add` only ever lands
      past the end of the surviving run, where the index equals the array's
      current length, so it appends; every interior move is a replace whose
      source is the CANDIDATE, never the array being rewritten.
    */
    patches.push({
      op: index >= survivors.length ? 'add' : 'replace',
      path: ['pages', index],
      value: {
        id: want.id,
        address: want.address,
        title: want.title,
        purpose: want.purpose,
        audience: want.audience,
        regions: [...want.regions],
        document: shellDocument(want.document),
      },
    });
    patches.push(
      ...reroot(documentPatches(shellDocument(want.document), want.document), [
        'pages',
        index,
        'document',
      ]),
    );
  });

  return patches;
}

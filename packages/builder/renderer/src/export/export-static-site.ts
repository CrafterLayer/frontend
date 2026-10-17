import {
  buildSeoHead,
  encodeRoute,
  extractSeoContent,
  languageSetDirection,
  pageSeoSchema,
  robotsTxt,
  sitemapXml,
  type BuilderDocument,
  type JsonValue,
  type PageSeo,
  type RegisteredBlock,
  type SiteLibrary,
  type SiteSeo,
  type SitemapEntry,
} from '@craftkit/builder-schema';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AssetTableContext, type AssetTable } from '../assets/asset-table';
import {
  BEHAVIOR_CSS,
  behaviorRuntimeScript,
  hasBehaviors,
  pageEngines,
  type PageEngine,
} from '../behaviors'; // media-motion (2026-10-06): + engines
import { LENIS_BANNER, LENIS_CSS, LENIS_SOURCE } from '../behaviors/lenis-source';
import { CustomCodeClassTransformContext } from '../components/CustomCode/class-transform-context';
import { loadTablerIcons } from '../components/CustomCode/tabler-icons';
import { StaticDocument } from '../components/StaticDocument';
import { buildEffectsCss } from '../motion/effects-css';
import { buildMotionPresetsCss } from '../motion/presets-css';
import type { Theme } from '../resolve/theme';
import { buildLibraryCss } from '../site-design/build-library-css';
import { createNamedStyleTransform } from '../site-design/named-style-transform';
import { SiteDesignContext, type SiteDesign } from '../site-design/site-design-context';
import { createAssetFileWriter } from './asset-files'; // page-defects additions (2026-10-06)
// pixi-studio:runtime-wiring additions (2026-10-10)
import { decodeMarkupAttribute } from '../behaviors/script';
import { STUDIO_ENGINE_LOADERS, type StudioEngineKind } from '../engines/studio/loaders';
import { STUDIO_LIB_KEYS, declaredLibs, fnv1a64 } from '../studio/contract';
// end pixi-studio:runtime-wiring additions
import { STATIC_BASE_CSS } from './base-css';
import { normalRoute, relativeRoot, routeFile } from './routes';

/**
 * Publish kernel / customCode pages as a static website (DESIGN D.4).
 *
 * Each page is the pure static render (`renderStaticMarkup`, the same render
 * the preview uses) inside a complete document: `<html lang dir>`, the full
 * SEO head from `buildSeoHead` (title/description fitted to rendered width,
 * canonical, robots, Open Graph, Twitter, hreflang, JSON-LD built from the
 * page's visible content), the page's compiled Tailwind CSS, and — only on a
 * page that uses a `data-ck-behavior` — the self-contained behaviour runtime.
 *
 * Style-manager additions (DESIGN.md §2, §B, D6, D7):
 * - the site library: `SiteDesignContext` + `CustomCodeClassTransformContext`
 *   carry the named-style expansion into the render (markers become their
 *   utilities, exactly as on the canvas), and `buildLibraryCss` (palette
 *   variables, uploaded faces; hosted-font imports lifted into <link>s) leads
 *   every page's stylesheet;
 * - motion presets and effects: `assets/ck-motion.css`, holding ONLY the
 *   presets, hovers and effects the site uses, linked from the pages that use
 *   one; the runtime ships when a page has a motion/hover preset or the
 *   spotlight effect (`hasBehaviors`). No animation library ships;
 * - page transitions: `@view-transition { navigation: auto }` (cross-fade,
 *   under no-preference) on a multi-page site unless
 *   `library.settings.pageTransitions` is false;
 * - smooth scroll: when `library.settings.smoothScroll` is true, the vendored
 *   Lenis as `assets/ck-smooth-scroll.js` with a tiny init that does nothing
 *   under reduced motion.
 * The site also gets `sitemap.xml` + `robots.txt` (when an origin is known)
 * and a `404.html` in the home page's language.
 *
 * Site settings (origin, name, template, business) are read from the HOME
 * page root's `seo.site` — DESIGN D.1's decision — and `options.origin`
 * overrides the stored origin.
 */

export interface StaticSitePageInput {
  readonly pageId: string;
  /** The page's site address: '/', '/menu', '/قائمة-الطعام'. */
  readonly address: string;
  readonly document: BuilderDocument;
  /** Fallbacks for a root without its own title/description (SitePage.title / purpose). */
  readonly title?: string;
  readonly description?: string;
  /** Shared regions rendered before (header) and after (footer) the page, in order. */
  readonly before?: readonly BuilderDocument[];
  readonly after?: readonly BuilderDocument[];
}

export interface ExportStaticSiteOptions {
  readonly pages: readonly StaticSitePageInput[];
  readonly blocks: (type: string) => RegisteredBlock | undefined;
  readonly theme?: Theme;
  /** CSS for every class the document renders (the host's Tailwind compiler). */
  readonly compileCss: (document: BuilderDocument) => Promise<string>;
  /** The published https origin; overrides the home page's `seo.site.origin`. */
  readonly origin?: string;
  /** The sitemap's lastmod; defaults to now. */
  readonly now?: Date;
  /** The site's design library (palette, named styles, fonts, motion settings). */
  readonly library?: SiteLibrary | undefined;
  /**
   * Optional: CSS for exactly these classes (the live compiler's `compileFor`).
   * The exporter hands it every class the RENDERED pages carry, so utilities
   * that exist only after render-time expansion (named styles) still get CSS
   * when `compileCss` reads the stored document.
   */
  readonly compileClasses?: ((classNames: Iterable<string>) => Promise<string>) | undefined;
  /**
   * The site's asset table, so a block image (`{assetId}`) and a tree image
   * (`/ck-assets/<id>`) publish the picture they show on the canvas instead
   * of a labelled absence.
   */
  readonly assets?: AssetTable | undefined;
}

export interface StaticSiteFile {
  readonly path: string;
  /** The file's text; '' for a binary file, whose `bytes` hold it. */
  readonly content: string;
  /**
   * page-defects additions (2026-10-06): a binary file's bytes — an uploaded
   * picture or font written to `assets/images/` instead of inlined as a data
   * URL. A host that zips or uploads the files writes these bytes.
   */
  readonly bytes?: Uint8Array;
}

export interface StaticSiteResult {
  readonly files: StaticSiteFile[];
}

const LANGUAGE_TAG = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u;

function rootProps(document: BuilderDocument): Readonly<Record<string, JsonValue>> {
  return document.nodes[document.rootId]?.props ?? {};
}

function text(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function parsePageSeo(value: JsonValue | undefined): PageSeo | undefined {
  if (value === undefined) return undefined;
  const parsed = pageSeoSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** `<html lang>`: the root's own tag, else the direction decides (RTL pages are Arabic here). */
function languageOf(document: BuilderDocument): string {
  const lang = text(rootProps(document)['lang']);
  if (lang !== undefined && LANGUAGE_TAG.test(lang)) return lang;
  return document.dir === 'rtl' ? 'ar' : 'en';
}

function validOrigin(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`The site origin "${value}" is not a URL.`);
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '')
    throw new Error(`The site origin "${value}" must be an https:// URL without credentials.`);
  return url.origin;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/gu, (character) =>
    character === '&'
      ? '&amp;'
      : character === '<'
        ? '&lt;'
        : character === '>'
          ? '&gt;'
          : character === '"'
            ? '&quot;'
            : '&#39;',
  );
}

/** A file-name-safe key for a page's own stylesheet. */
function cssKey(pageId: string, index: number, used: Set<string>): string {
  const base =
    pageId.replace(/[^a-zA-Z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '') ||
    `page-${String(index + 1)}`;
  let key = base;
  for (let n = 2; used.has(key); n += 1) key = `${base}-${String(n)}`;
  used.add(key);
  return key;
}

const STYLE_ELEMENT = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/giu;
const FONT_IMPORT =
  /@import\s+url\(\s*['"]?(https:\/\/fonts\.(?:googleapis\.com|bunny\.net)\/[^'")\s]+)['"]?\s*\)\s*;?/giu;

/**
 * Lift web-font `@import`s out of the body's `<style>` elements: an import
 * inside a body style is discovered only after the HTML parser reaches it, so
 * the fonts arrive late (LCP) and swap in (CLS). The head gets a preconnect
 * plus a stylesheet link for each instead, found on the first bytes.
 */
function liftFontImports(body: string): { body: string; fonts: string[] } {
  const fonts: string[] = [];
  const lifted = body.replace(STYLE_ELEMENT, (_match, open: string, css: string, close: string) => {
    const rest = css.replace(FONT_IMPORT, (_import, url: string) => {
      if (!fonts.includes(url)) fonts.push(url);
      return '';
    });
    return rest.trim() === '' ? '' : `${open}${rest}${close}`;
  });
  return { body: lifted, fonts };
}

/** The library stylesheet with its hosted-font imports lifted out (they become <link>s). */
function liftLibraryImports(css: string): { css: string; fonts: string[] } {
  const fonts: string[] = [];
  const rest = css.replace(FONT_IMPORT, (_import, url: string) => {
    if (!fonts.includes(url)) fonts.push(url);
    return '';
  });
  return { css: rest.trim(), fonts };
}

const ENTITY: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  '#x27': "'",
};

/** Every class the rendered markup carries (attribute values decoded). */
function renderedClasses(markup: string): Set<string> {
  const classes = new Set<string>();
  for (const match of markup.matchAll(/\sclass="([^"]*)"/gu)) {
    const value = (match[1] ?? '').replace(
      /&(amp|lt|gt|quot|#39|#x27);/gu,
      (_all, name: string) => ENTITY[name] ?? '',
    );
    for (const name of value.split(/\s+/u)) if (name !== '') classes.add(name);
  }
  return classes;
}

/** Which presets, hovers and effects a page's markup names. */
function motionUsage(markup: string): {
  presets: Set<string>;
  hovers: Set<string>;
  effects: Set<string>;
} {
  const presets = new Set<string>();
  const hovers = new Set<string>();
  const effects = new Set<string>();
  for (const match of markup.matchAll(/\sdata-ck-motion="([a-z0-9-]+)"/gu))
    presets.add(match[1] ?? '');
  for (const match of markup.matchAll(/\sdata-ck-hover="([a-z0-9-]+)"/gu))
    hovers.add(match[1] ?? '');
  for (const name of renderedClasses(markup))
    if (name.startsWith('ck-fx-')) effects.add(name.slice('ck-fx-'.length));
  return { presets, hovers, effects };
}

/* Cross-document view transitions: the browser's default cross-fade, only for readers who allow motion. */
export const VIEW_TRANSITION_CSS = `@media (prefers-reduced-motion: no-preference) {
  @view-transition {
    navigation: auto;
  }
}`;

/* Lenis, started only when the reader allows motion; `anchors` keeps in-page links smooth too. */
const SMOOTH_SCROLL_INIT = `;(function () {
  var w = window;
  if (typeof w.Lenis !== 'function') return;
  if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  w.ckLenis = new w.Lenis({ autoRaf: true, anchors: true });
})();
`;

function fontLinks(fonts: readonly string[]): string {
  if (fonts.length === 0) return '';
  const hosts = [...new Set(fonts.map((url) => new URL(url).origin))];
  const preconnect = hosts.flatMap((host) =>
    host === 'https://fonts.googleapis.com'
      ? [
          `<link rel="preconnect" href="${host}">`,
          '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        ]
      : [`<link rel="preconnect" href="${host}" crossorigin>`],
  );
  return [
    ...preconnect,
    ...fonts.map((url) => `<link rel="stylesheet" href="${escapeAttribute(url)}">`),
  ].join('');
}

// media-motion (2026-10-06): the engine assets, imported only when a page uses one (the loadTablerIcons precedent).
// gsap-pixi additions (2026-10-08): ck-timeline.js now carries the MIT anime.js 4.5.0 subset
// (about 23 kB gzip with its banner), not GSAP; the asset shape (banner + source + runner) is unchanged.
// free-code mode (2026-10-09): 'pixi' is the FULL pixi.js bundle, shipped only when some page's
// `data-ck-js` code names Pixi (`ck.pixi()` / `ck.stage()`); the `scripts` pack requests it on demand.
const ENGINE_ORDER: readonly PageEngine[] = [
  'carousel',
  'timeline',
  'scene',
  'lottie',
  'pixi',
  // pixi-studio:runtime-wiring additions (2026-10-10): the add-on libraries after pixi (each binds to its namespace), then the sound engine — `assets/ck-lib-<key>.js`, `assets/ck-sound.js`.
  ...STUDIO_LIB_KEYS.map((key): PageEngine => `lib-${key}`),
  'sound',
  // end pixi-studio:runtime-wiring additions
];

// pixi-studio:runtime-wiring additions (2026-10-10)
function isStudioEngine(kind: PageEngine): kind is StudioEngineKind {
  return kind === 'sound' || kind.startsWith('lib-');
}

/** The sounds one page references (DESIGN §B.1, §C.2): `asset:<id>` and `lib:<id>` refs. */
interface SoundUse {
  /** Site asset ids (uploaded `data:audio/*` sounds) the page plays. */
  readonly assets: Set<string>;
  /** Project sound-bank ids (`site.library.sounds`) the page plays. */
  readonly bank: Set<string>;
  /** Some element carries `data-ck-sound`: the engine binds it at load, so it is not lazy. */
  readonly markup: boolean;
}

function addSoundRef(ref: string, use: SoundUse): void {
  const at = ref.indexOf(':');
  if (at < 0) return;
  const scheme = ref.slice(0, at);
  const id = ref.slice(at + 1);
  if (id === '') return;
  if (scheme === 'asset') use.assets.add(id);
  else if (scheme === 'lib') use.bank.add(id);
}

/** What sounds a page's rendered markup references: `data-ck-sound` tokens and literal script refs. */
function soundUsage(body: string): SoundUse {
  const use: SoundUse = {
    assets: new Set(),
    bank: new Set(),
    markup: /\sdata-ck-sound(?=[\s=>/])/u.test(body),
  };
  for (const match of body.matchAll(/\sdata-ck-sound=(?:"([^"]*)"|'([^']*)')/gu)) {
    for (const token of decodeMarkupAttribute(match[1] ?? match[2] ?? '').split(/\s+/u)) {
      const colon = token.indexOf(':');
      if (colon < 0) continue;
      // `<trigger>:<ref>[@volume]`
      addSoundRef(token.slice(colon + 1).replace(/@[0-9.]+$/u, ''), use);
    }
  }
  for (const match of body.matchAll(/\sdata-ck-js=(?:"([^"]*)"|'([^']*)')/gu)) {
    const code = decodeMarkupAttribute(match[1] ?? match[2] ?? '');
    if (!declaredLibs(code).sound) continue;
    for (const ref of code.matchAll(/(['"`])((?:asset|lib):[^'"`\s@]+)\1/gu))
      addSoundRef(ref[2] ?? '', use);
  }
  return use;
}

/** A project sound-bank entry, read loosely: only `source.kind` / `source.assetId` matter here. */
interface BankEntry {
  readonly source?: { readonly kind?: unknown; readonly assetId?: unknown };
}

function soundBankOf(library: SiteLibrary | undefined): Readonly<Record<string, BankEntry>> {
  const sounds = (library as { readonly sounds?: unknown } | undefined)?.sounds;
  return sounds !== null && typeof sounds === 'object' ? (sounds as Record<string, BankEntry>) : {};
}

const AUDIO_EXTENSIONS: Readonly<Record<string, string>> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/webm': 'webm',
};

function decodeAudioDataUrl(
  url: string,
): { readonly bytes: Uint8Array; readonly extension: string } | undefined {
  const match =
    /^data:(audio\/[a-z0-9.+-]+)(?:;[a-z0-9-]+=[^;,]+)*;base64,([A-Za-z0-9+/]+={0,2})$/iu.exec(
      url.trim(),
    );
  if (match === null) return undefined;
  const extension = AUDIO_EXTENSIONS[(match[1] ?? '').toLowerCase()];
  if (extension === undefined) return undefined;
  try {
    const binary = atob(match[2] ?? '');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.length === 0 ? undefined : { bytes, extension };
  } catch {
    return undefined;
  }
}

/** JSON inside `<script type="application/json">`: no `</script>`, no comment opener. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}
// end pixi-studio:runtime-wiring additions

async function engineAsset(kind: PageEngine): Promise<string> {
  if (kind === 'carousel') return (await import('../engines/carousel-source')).CAROUSEL_SOURCE;
  // pixi-studio:runtime-wiring additions (2026-10-10): each asset installs itself (D1/D2).
  if (isStudioEngine(kind)) return STUDIO_ENGINE_LOADERS[kind]();
  // end pixi-studio:runtime-wiring additions
  if (kind === 'timeline') {
    const [{ TIMELINE_BANNER, TIMELINE_SOURCE }, { installTimelineEngine }] = await Promise.all([
      import('../engines/timeline-source'),
      import('../engines/timeline-runner'),
    ]);
    return `${TIMELINE_BANNER}${TIMELINE_SOURCE}\n;(${installTimelineEngine.toString()})(window);\n`;
  }
  if (kind === 'lottie') {
    const [{ LOTTIE_BANNER, LOTTIE_SOURCE }, { installLottieEngine }] = await Promise.all([
      import('../engines/lottie-source'),
      import('../engines/lottie-runner'),
    ]);
    return `${LOTTIE_BANNER}${LOTTIE_SOURCE}\n;(${installLottieEngine.toString()})(window);\n`;
  }
  if (kind === 'pixi') {
    // The full pixi.js bundle carries its own banner (Pixi + dependency notices) and installs itself.
    return (await import('../engines/pixi-full-source')).PIXI_FULL_SOURCE;
  }
  // The scene bundle carries its own banner (Pixi + dependency notices) and installs itself.
  return (await import('../engines/scene-source')).SCENE_SOURCE;
}

interface RenderedPage {
  readonly input: StaticSitePageInput;
  readonly file: string;
  readonly route: string;
  readonly lang: string;
  readonly dir: 'ltr' | 'rtl';
  readonly body: string;
  readonly fonts: readonly string[];
  readonly css: string;
  readonly behaviors: boolean;
  /** media-motion (2026-10-06): the lazy engines (scene, timeline, lottie, pixi) the page's markup uses. */
  readonly engines: ReadonlySet<PageEngine>;
  /** pixi-studio:runtime-wiring (2026-10-10): the sounds the page references. */
  readonly sound: SoundUse;
  readonly motion: boolean;
  readonly seo: PageSeo | undefined;
  readonly noIndex: boolean;
}

const NOT_FOUND_COPY = {
  ar: {
    title: 'الصفحة غير موجودة',
    lead: 'لم نجد الصفحة التي تبحث عنها.',
    home: 'العودة إلى الصفحة الرئيسية',
  },
  en: {
    title: 'Page not found',
    lead: 'We could not find the page you were looking for.',
    home: 'Back to the home page',
  },
} as const;

function notFoundPage(lang: string, dir: 'ltr' | 'rtl', site: SiteSeo): string {
  const copy = lang.toLowerCase().startsWith('ar') ? NOT_FOUND_COPY.ar : NOT_FOUND_COPY.en;
  // The 404 must not carry a canonical or JSON-LD: it is not a page of the site.
  const head = buildSeoHead({
    title: copy.title,
    description: copy.lead,
    lang,
    path: '/404',
    site: { ...(site.siteName === undefined ? {} : { siteName: site.siteName }) },
    noIndex: true,
    jsonLd: false,
    applyTemplate: false,
  });
  const style =
    'body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:#fafafa;color:#18181b}main{padding:2rem;text-align:center}h1{font-size:2rem;margin:0 0 .5rem}a{color:inherit}';
  return `<!doctype html><html lang="${escapeAttribute(lang)}" dir="${dir}"><head>${head}<style>${style}</style></head><body><main><h1>${escapeAttribute(copy.title)}</h1><p>${escapeAttribute(copy.lead)}</p><p><a href="/">${escapeAttribute(copy.home)}</a></p></main></body></html>`;
}

export async function exportStaticSite(
  options: ExportStaticSiteOptions,
): Promise<StaticSiteResult> {
  if (options.pages.length === 0) throw new Error('Publishing needs at least one page.');

  // Routes first: a bad or duplicate address fails before any render or compile.
  const files = new Set<string>();
  const routed = options.pages.map((input) => {
    const file = routeFile(input.address);
    if (files.has(file))
      throw new Error(`Two pages export to the same route: "${normalRoute(input.address)}".`);
    files.add(file);
    return { input, file, route: normalRoute(input.address) };
  });

  const home = routed.find(({ route }) => route === '/') ?? routed[0];
  const homeSeo =
    home === undefined ? undefined : parsePageSeo(rootProps(home.input.document)['seo']);
  const origin = validOrigin(options.origin) ?? validOrigin(homeSeo?.site?.origin);
  const site: SiteSeo = { ...(homeSeo?.site ?? {}), ...(origin === undefined ? {} : { origin }) };

  const library = options.library;
  const classTransform = createNamedStyleTransform(library);
  const design: SiteDesign = { library, classTransform };
  const libraryCss = liftLibraryImports(buildLibraryCss(library));
  const pageTransitions = library?.settings?.pageTransitions !== false && options.pages.length > 1;
  const smoothScroll = library?.settings?.smoothScroll === true;
  const siteCss = [
    libraryCss.css,
    pageTransitions ? VIEW_TRANSITION_CSS : '',
    smoothScroll ? LENIS_CSS.trim() : '',
  ].filter((part) => part !== '');

  // A static render cannot wait inside a render: Tabler's drawing data is loaded once, first.
  if (
    options.pages.some((page) =>
      /"tabler(?:-filled)?:/u.test(JSON.stringify([page.before, page.document, page.after])),
    )
  )
    await loadTablerIcons();

  // page-defects additions (2026-10-06): uploaded pictures leave the HTML and CSS as files, once each.
  const assetFiles = createAssetFileWriter();
  const usedPresets = new Set<string>();
  const usedHovers = new Set<string>();
  const usedEffects = new Set<string>();
  const rendered: RenderedPage[] = [];
  for (const { input, file, route } of routed) {
    const documents = [...(input.before ?? []), input.document, ...(input.after ?? [])];
    // The same render the preview uses, inside the site's design context (named styles expand here).
    const render = (document: BuilderDocument) =>
      renderToStaticMarkup(
        createElement(
          AssetTableContext.Provider,
          { value: options.assets ?? {} },
          createElement(
            SiteDesignContext.Provider,
            { value: design },
            createElement(
              CustomCodeClassTransformContext.Provider,
              { value: classTransform },
              createElement(StaticDocument, {
                document,
                blocks: options.blocks,
                breakpoint: 'desktop',
                ...(options.theme === undefined ? {} : { theme: options.theme }),
              }),
            ),
          ),
        ),
      );
    const lifted = liftFontImports(documents.map(render).join(''));
    const fonts = lifted.fonts;
    const body = assetFiles.rewrite(lifted.body, `${relativeRoot(file)}assets/`); // page-defects additions
    const sheets = await Promise.all(documents.map((document) => options.compileCss(document)));
    if (options.compileClasses !== undefined)
      sheets.push(await options.compileClasses(renderedClasses(body)));
    const usage = motionUsage(body);
    for (const name of usage.presets) usedPresets.add(name);
    for (const name of usage.hovers) usedHovers.add(name);
    for (const name of usage.effects) usedEffects.add(name);
    // The base reset leads every sheet: the canvas's host page carries it, a published page does not.
    const css = assetFiles.rewrite(
      [
        STATIC_BASE_CSS,
        ...siteCss,
        ...new Set(sheets.map((sheet) => sheet.trim()).filter((sheet) => sheet !== '')),
      ].join('\n'),
      '', // page-defects additions: the stylesheet sits in assets/, beside images/
    );
    const props = rootProps(input.document);
    rendered.push({
      input,
      file,
      route,
      lang: languageOf(input.document),
      dir: languageSetDirection(props) ?? input.document.dir, // a language version reads in its own
      body,
      fonts: [...libraryCss.fonts, ...fonts.filter((url) => !libraryCss.fonts.includes(url))],
      css,
      behaviors: hasBehaviors(body),
      engines: pageEngines(body), // media-motion (2026-10-06)
      sound: soundUsage(body), // pixi-studio:runtime-wiring (2026-10-10)
      motion: usage.presets.size + usage.hovers.size + usage.effects.size > 0,
      seo: parsePageSeo(props['seo']),
      noIndex: props['noIndex'] === true,
    });
  }

  const out: StaticSiteFile[] = [];
  // One shared stylesheet when every page compiles to the same CSS; otherwise one per page.
  const shared = rendered.every((page) => page.css === rendered[0]?.css);
  const usedKeys = new Set<string>();
  const cssPath = new Map<RenderedPage, string | undefined>();
  if (shared) {
    const css = rendered[0]?.css ?? '';
    if (css !== '') out.push({ path: 'assets/site.css', content: css });
    for (const page of rendered) cssPath.set(page, css === '' ? undefined : 'assets/site.css');
  } else {
    rendered.forEach((page, index) => {
      if (page.css === '') {
        cssPath.set(page, undefined);
        return;
      }
      const path = `assets/${cssKey(page.input.pageId, index, usedKeys)}.css`;
      out.push({ path, content: page.css });
      cssPath.set(page, path);
    });
  }
  const anyBehaviors = rendered.some((page) => page.behaviors);
  if (anyBehaviors) {
    out.push({ path: 'assets/ck-behaviors.css', content: BEHAVIOR_CSS });
    // fix pass (2026-10-06): only the packs the site's pages use.
    out.push({
      path: 'assets/ck-behaviors.js',
      content: behaviorRuntimeScript(rendered.map((page) => page.body)),
    });
  }
  // Only the presets, hovers and effects the site names: a page pays for what it uses.
  const motionCss = [
    buildMotionPresetsCss({ presets: usedPresets, hovers: usedHovers }),
    buildEffectsCss(usedEffects),
  ]
    .filter((part) => part !== '')
    .join('\n');
  if (motionCss !== '') out.push({ path: 'assets/ck-motion.css', content: motionCss });
  if (smoothScroll) {
    out.push({
      path: 'assets/ck-smooth-scroll.js',
      content: `${LENIS_BANNER}${LENIS_SOURCE}\n${SMOOTH_SCROLL_INIT}`,
    });
  }
  // media-motion (2026-10-06): each engine any page uses ships ONCE, loaded only when used.
  const usedEngines = new Set<PageEngine>(rendered.flatMap((page) => [...page.engines]));
  for (const kind of ENGINE_ORDER) {
    if (usedEngines.has(kind))
      out.push({ path: `assets/ck-${kind}.js`, content: await engineAsset(kind) });
  }

  // pixi-studio:runtime-wiring additions (2026-10-10): the sounds a page plays (DESIGN §B.1, §C.4).
  // Only pages that load the sound engine count; each referenced upload is ONE file, named by hash.
  const bank = soundBankOf(library);
  const pageSounds = new Map<
    RenderedPage,
    { readonly assets: string[]; readonly bank: Record<string, unknown> }
  >();
  const soundHref = new Map<string, string>();
  for (const page of rendered) {
    if (!page.engines.has('sound')) continue;
    const entries: Record<string, unknown> = {};
    const assetIds = new Set(page.sound.assets);
    for (const id of page.sound.bank) {
      if (!Object.hasOwn(bank, id)) continue;
      const entry = bank[id];
      entries[id] = entry;
      const source = entry?.source;
      if (source?.kind === 'asset' && typeof source.assetId === 'string')
        assetIds.add(source.assetId);
    }
    const resolved: string[] = [];
    for (const id of assetIds) {
      const url =
        options.assets !== undefined && Object.hasOwn(options.assets, id)
          ? options.assets[id]?.url
          : undefined;
      if (url === undefined) continue;
      if (!soundHref.has(id)) {
        const decoded = decodeAudioDataUrl(url);
        if (decoded !== undefined) {
          const path = `assets/sounds/${fnv1a64(url)}.${decoded.extension}`;
          if (!out.some((file) => file.path === path))
            out.push({ path, content: '', bytes: decoded.bytes });
          soundHref.set(id, path);
        } else if (url.startsWith('https://')) {
          soundHref.set(id, url);
        } else {
          continue;
        }
      }
      resolved.push(id);
    }
    pageSounds.set(page, { assets: resolved, bank: entries });
  }
  // end pixi-studio:runtime-wiring additions

  for (const page of rendered) {
    const props = rootProps(page.input.document);
    const content = extractSeoContent(page.input.document);
    const hero = content.images.find(
      (image) => !image.decorative && image.src.startsWith('https://'),
    );
    const socialImage = text(props['socialImage']);
    const head = buildSeoHead({
      title: text(props['title']) ?? page.input.title ?? '',
      description: text(props['description']) ?? page.input.description ?? '',
      lang: page.lang,
      path: page.route,
      site,
      ...(page.seo === undefined ? {} : { page: page.seo }),
      noIndex: page.noIndex,
      image: socialImage ?? hero?.src,
      imageAlt: socialImage === undefined ? hero?.alt : undefined,
      socialTitle: text(props['socialTitle']),
      socialDescription: text(props['socialDescription']),
      preloadImage: hero?.src,
      preloadImageSrcset: hero?.srcset,
      preloadImageSizes: hero?.sizes,
      content,
      xDefaultPath: '/',
    });
    const up = relativeRoot(page.file);
    // page-defects additions (2026-10-06): a head reference (og:image, a JSON-LD logo) is absolute when the origin is known.
    const headHtml = assetFiles.rewrite(
      head,
      origin === undefined ? `${up}assets/` : `${origin}/assets/`,
    );
    const stylesheet = cssPath.get(page);
    const links = [
      fontLinks(page.fonts),
      stylesheet === undefined ? '' : `<link rel="stylesheet" href="${up}${stylesheet}">`,
      page.behaviors ? `<link rel="stylesheet" href="${up}assets/ck-behaviors.css">` : '',
      page.motion && motionCss !== ''
        ? `<link rel="stylesheet" href="${up}assets/ck-motion.css">`
        : '',
      page.behaviors ? `<script defer src="${up}assets/ck-behaviors.js"></script>` : '',
      smoothScroll ? `<script defer src="${up}assets/ck-smooth-scroll.js"></script>` : '',
      /*
        media-motion (2026-10-06): a LOCATOR, not a prefetch. The `engines` pack reads
        link[data-ck-engine] and injects the script only when motion is allowed and the
        element is due. A rel="prefetch" made reduced-motion visitors download 646 KB +
        137 KB that never ran, and a host without cache headers served each engine twice
        (fix pass 2026-10-06). An unknown rel fetches nothing.
      */
      ...ENGINE_ORDER.filter((kind) => page.engines.has(kind)).map(
        (kind) =>
          `<link rel="ck-engine" href="${up}assets/ck-${kind}.js" data-ck-engine="${kind}">`,
      ),
      // pixi-studio:runtime-wiring additions (2026-10-10): `data-ck-sound` elements are bound by
      // the sound engine when it loads, so a page that has them loads it (deferred, ~10 kB);
      // a script's `ck.sound` alone requests it lazily from the locator above.
      page.engines.has('sound') && page.sound.markup
        ? `<script defer src="${up}assets/ck-sound.js" data-ck-engine="sound"></script>`
        : '',
      ...(pageSounds.get(page)?.assets ?? []).map((id) => {
        const href = soundHref.get(id) ?? '';
        const target = href.startsWith('https://') ? href : `${up}${href}`;
        return `<link rel="ck-sound-asset" data-ck-sound-asset="${escapeAttribute(id)}" href="${escapeAttribute(target)}">`;
      }),
      Object.keys(pageSounds.get(page)?.bank ?? {}).length > 0
        ? `<script type="application/json" data-ck-sound-bank>${inlineJson(pageSounds.get(page)?.bank)}</script>`
        : '',
      // end pixi-studio:runtime-wiring additions
      // fix pass (2026-10-06): no site icon → an empty one, so no page logs GET /favicon.ico 404.
      headHtml.includes('rel="icon"') ? '' : '<link rel="icon" href="data:,">',
    ].join('');
    const html = `<!doctype html><html lang="${escapeAttribute(page.lang)}" dir="${page.dir}"><head>${headHtml}${links}</head><body>${page.body}</body></html>`;
    out.push({ path: page.file, content: html });
  }

  // page-defects additions (2026-10-06): each distinct picture the pages, stylesheets and heads referenced.
  for (const asset of assetFiles.files()) out.push(asset);

  const homePage = rendered.find(({ route }) => route === '/') ?? rendered[0];
  out.push({
    path: '404.html',
    content: notFoundPage(homePage?.lang ?? 'en', homePage?.dir ?? 'ltr', site),
  });

  if (origin !== undefined) {
    const lastmod = (options.now ?? new Date()).toISOString().slice(0, 10);
    const entries: SitemapEntry[] = rendered
      .filter((page) => !page.noIndex)
      .map((page) => {
        const alternates = (page.seo?.alternates ?? []).map((alternate) => ({
          lang: alternate.lang,
          href: `${origin}${encodeRoute(alternate.path)}`,
        }));
        return {
          loc: `${origin}${encodeRoute(page.route)}`,
          lastmod,
          ...(alternates.length === 0
            ? {}
            : {
                alternates: [
                  { lang: page.lang, href: `${origin}${encodeRoute(page.route)}` },
                  ...alternates,
                ],
              }),
        };
      });
    out.push({ path: 'sitemap.xml', content: sitemapXml(entries) });
    out.push({ path: 'robots.txt', content: robotsTxt({ origin }) });
  }

  return { files: out };
}

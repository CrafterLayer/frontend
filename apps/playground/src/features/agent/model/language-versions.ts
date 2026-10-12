/**
 * A site in several languages (2026-10-12): «اعمل الموقع بالعربي والإنجليزي», "Add a French
 * version". The host does everything that needs no model, through the site kernel's door:
 *
 * 1. each page is duplicated at its language's address (`/about` → `/fr/about`, home → `/fr`);
 * 2. ONE site transaction writes, on every page of each set, the reciprocal `seo.alternates`
 *    (hreflang and the sitemap read them; a page with them reads in its own language's
 *    direction, while the site keeps one), the version's internal links pointed at its own
 *    language, and a language switcher;
 * 3. the panel then asks the Agent to translate each new version (`page.translate`), one page
 *    at a time, so every translation is its own record and its own Undo.
 *
 * A page already in a set keeps its versions; asking again only adds what is missing.
 */
import {
  languageSetSteps,
  siteLanguage,
  versionAddress,
  type BuilderKernel,
  type BuilderSiteKernel,
} from '@craftkit/builder';

import { scriptPageLang } from './script-site';

type SitePage = ReturnType<BuilderSiteKernel['getSite']>['pages'][number];

/** One page of a language set, as the panel runs the Agent on it. */
export interface LanguagePage {
  readonly pageId: string;
  readonly address: string;
  /** Its language's primary tag (`en`, `ar`). */
  readonly lang: string;
  readonly kernel: BuilderKernel;
  /** Makes it the page on the canvas. */
  readonly show: () => void;
}

export interface LanguageVersionsResult {
  /** The language of the page(s) the versions were made from. */
  readonly source: string;
  /** Versions added now, in the order they were made. */
  readonly created: readonly LanguagePage[];
  /** Versions that were asked for and already existed. */
  readonly existing: readonly LanguagePage[];
}

export interface LanguageVersionsPort {
  /** Adds the versions asked for: of the open page (`page`) or of every page (`site`). */
  readonly add: (request: {
    readonly languages: readonly string[];
    readonly scope: 'page' | 'site';
  }) => LanguageVersionsResult;
  /** Every page that is not itself a version, the open one first (a whole-site translation). */
  readonly pages: () => readonly LanguagePage[];
}

/** At most 8 alternates per page (`pageSeoSchema`), the source included. */
const MAX_LANGUAGES = 8;

function primary(tag: string): string {
  return tag.toLowerCase().split('-')[0] ?? tag;
}

function alternatesOf(page: SitePage): readonly { readonly lang: string; readonly path: string }[] {
  const seo = page.document.nodes[page.document.rootId]?.props['seo'];
  if (typeof seo !== 'object' || seo === null || Array.isArray(seo)) return [];
  const alternates = (seo as { readonly alternates?: unknown }).alternates;
  if (!Array.isArray(alternates)) return [];
  return alternates.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { lang, path } = entry as { readonly lang?: unknown; readonly path?: unknown };
    return typeof lang === 'string' && typeof path === 'string'
      ? [{ lang: primary(lang), path }]
      : [];
  });
}

/** A version: it sits under a language's address and belongs to a set. */
function isVersion(page: SitePage): boolean {
  const first = page.address.split('/')[1] ?? '';
  return siteLanguage(first) !== undefined && alternatesOf(page).length > 0;
}

export function createLanguageVersions(siteKernel: BuilderSiteKernel): LanguageVersionsPort {
  const pageOf = (page: SitePage, lang: string): LanguagePage => ({
    pageId: page.id,
    address: page.address,
    lang,
    kernel: siteKernel.page(page.id),
    show: () => {
      siteKernel.setCurrentPage(page.id);
    },
  });
  const byAddress = (address: string) =>
    siteKernel.getSite().pages.find((page) => page.address === address);

  /** The page a version was made from: the first alternate that is not itself. */
  const sourceOf = (page: SitePage): SitePage =>
    isVersion(page)
      ? (alternatesOf(page)
          .map(({ path }) => byAddress(path))
          .find((other) => other !== undefined && !isVersion(other)) ?? page)
      : page;

  const duplicate = (source: SitePage, lang: string): SitePage | undefined => {
    const address = versionAddress(source.address, lang);
    const there = byAddress(address);
    if (there !== undefined) return there;
    const before = new Set(siteKernel.pages());
    const name = siteLanguage(lang)?.native ?? lang;
    siteKernel.dispatch(
      'duplicatePage',
      { pageId: source.id, address, title: `${source.title} · ${name}` },
      'ai',
    );
    return siteKernel.getSite().pages.find((page) => !before.has(page.id));
  };

  const add: LanguageVersionsPort['add'] = ({ languages, scope }) => {
    const site = siteKernel.getSite();
    const open = site.pages.find((page) => page.id === siteKernel.currentPage());
    const sources =
      scope === 'site'
        ? site.pages.filter((page) => !isVersion(page))
        : open === undefined
          ? []
          : [sourceOf(open)];
    const wanted = [...new Set(languages.map(primary))];
    const created: LanguagePage[] = [];
    const existing: LanguagePage[] = [];
    const sets: { readonly pageId: string; readonly lang: string; readonly address: string }[][] =
      [];
    for (const source of sources) {
      const sourceLang = primary(scriptPageLang(source));
      const members = [{ pageId: source.id, lang: sourceLang, address: source.address }];
      for (const { lang, path } of alternatesOf(source)) {
        const page = byAddress(path);
        if (page === undefined || lang === sourceLang || members.some((m) => m.lang === lang))
          continue;
        members.push({ pageId: page.id, lang, address: page.address });
      }
      for (const lang of wanted) {
        if (lang === sourceLang) continue;
        const known = members.find((member) => member.lang === lang);
        if (known !== undefined) {
          const page = byAddress(known.address);
          if (page !== undefined) existing.push(pageOf(page, lang));
          continue;
        }
        if (members.length >= MAX_LANGUAGES) break;
        const page = duplicate(source, lang);
        if (page === undefined) continue;
        members.push({ pageId: page.id, lang, address: page.address });
        created.push(pageOf(page, lang));
      }
      if (members.length > 1) sets.push(members);
    }

    // Each source address → its version, per language: a version's links go to its own language.
    const addresses = new Map<string, Map<string, string>>();
    for (const [source, ...versions] of sets) {
      if (source === undefined) continue;
      for (const version of versions) {
        const map = addresses.get(version.lang) ?? new Map<string, string>();
        map.set(source.address, version.address);
        addresses.set(version.lang, map);
      }
    }
    const steps = sets.flatMap((members) =>
      members.flatMap((member, at) =>
        languageSetSteps(siteKernel.page(member.pageId), {
          members,
          lang: member.lang,
          ...(at === 0 ? {} : { addresses: addresses.get(member.lang) ?? new Map() }),
        }).map(({ command, args }) => ({ command, args, pageId: member.pageId })),
      ),
    );
    if (steps.length > 0)
      siteKernel.dispatchGroup(steps, { author: 'ai', label: 'languageVersions' });
    const first = sources[0];
    return {
      source: first === undefined ? 'en' : primary(scriptPageLang(first)),
      created,
      existing,
    };
  };

  const pages: LanguageVersionsPort['pages'] = () => {
    const site = siteKernel.getSite();
    const current = siteKernel.currentPage();
    return site.pages
      .filter((page) => !isVersion(page))
      .toSorted((a, b) => Number(b.id === current) - Number(a.id === current))
      .map((page) => pageOf(page, primary(scriptPageLang(page))));
  };

  return { add, pages };
}

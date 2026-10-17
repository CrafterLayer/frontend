/*
  A site plan (T230, 2026-10-12): the pages a multi-page request asks for, each with the
  brief its own page build runs on. Before it, a request the router read as `build-site`
  was built as ONE page and the thread said so (`siteAsOnePage`).
*/

/** The most pages one site plan holds: a request for more is planned as its first eight. */
export const AI_SITE_MAX_PAGES = 8;
/** Fewer pages than this is a page, not a site. */
export const AI_SITE_MIN_PAGES = 2;
/** A page name longer than this is a sentence, not a name. */
export const AI_SITE_MAX_TITLE_LENGTH = 60;
/** A page brief is a paragraph; the plan endpoint's own request limit stays far above it. */
export const AI_SITE_MAX_REQUEST_LENGTH = 2_000;

/** One page of a site: its name, and the request its build runs on. */
export interface AiSitePage {
  /** The page's name, as the person wrote it or the plan gave it ("About", «من نحن»). */
  readonly title: string;
  /**
   * The page's own build brief, in the person's language, carrying the site's subject
   * (its business, brand and style) so every page is built as part of one site.
   */
  readonly request: string;
}

/** The pages of a site, home first. */
export interface AiSitePlan {
  /** Between `AI_SITE_MIN_PAGES` and `AI_SITE_MAX_PAGES`; the first is the home page. */
  readonly pages: readonly AiSitePage[];
  /** `model`: the provider planned it; `words`: read from the request by code. */
  readonly source: 'model' | 'words';
  /** The language the request is written in, and every brief with it. */
  readonly locale: 'ar' | 'en';
}

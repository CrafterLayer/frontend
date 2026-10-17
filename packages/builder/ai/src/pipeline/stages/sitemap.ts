import { StageRejectedError } from './errors';
import { isRecord, stageArray } from './shape';
import type { SitemapPage, SitemapResponse, StageLimits } from '../wire';

/**
 * What the sitemap stage must produce before anything else may run.
 *
 * Every later stage addresses pages by id, so an id that is empty, duplicated
 * or unsafe in a URL is not a cosmetic problem — it is a site whose pages
 * cannot be linked, and it must be caught here rather than four calls later.
 */

const ID_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const isPageEntry = (value: unknown): value is SitemapPage =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['title'] === 'string' &&
  typeof value['purpose'] === 'string';

export function validateSitemap(
  response: SitemapResponse,
  limits: StageLimits,
): readonly SitemapPage[] {
  const reasons: string[] = [];
  const validated: SitemapPage[] = [];
  const pages = stageArray(
    'sitemap',
    response,
    'pages',
    'A sitemap answer must carry a list of pages.',
  );

  if (pages.length === 0) {
    reasons.push('It named no pages at all.');
  }
  if (pages.length > limits.maxPages) {
    /*
      Reported, never truncated. A site cut down to the limit is a site that
      lies about what was asked for, and a person who asked for twelve pages and
      received four has no way to know which eight are missing.
    */
    reasons.push(
      `It named ${String(pages.length)} pages; this run allows ${String(limits.maxPages)}.`,
    );
  }

  const seen = new Set<string>();
  for (const [index, page] of pages.entries()) {
    /*
      Shape before content, per page. One malformed entry must not stop the
      others being reported: a person repairing an answer wants every reason at
      once, not one per round trip.
    */
    if (!isPageEntry(page)) {
      reasons.push(`Page ${String(index + 1)} is missing its id, title or purpose.`);
      continue;
    }
    validated.push(page);
    if (!ID_SHAPE.test(page.id)) {
      reasons.push(`"${page.id}" is not a usable page id.`);
    }
    if (seen.has(page.id)) {
      reasons.push(`Two pages share the id "${page.id}".`);
    }
    seen.add(page.id);
    if (page.title.trim() === '') {
      reasons.push(`The page "${page.id}" has no title.`);
    }
    if (page.purpose.trim() === '') {
      /*
        Not decoration. Every later stage is handed this sentence and obeys it;
        a page with no purpose produces sections chosen at random.
      */
      reasons.push(`The page "${page.id}" says nothing about what it is for.`);
    }
  }

  if (reasons.length > 0) throw new StageRejectedError('sitemap', reasons);
  return validated;
}

/**
 * A site in several languages, and a whole site in another language (2026-10-12): the two
 * language requests (`languageIntent`) that are more than one page's edit.
 *
 * - "versions" («اعمل الموقع بالعربي والإنجليزي», "Add a French version"): an empty page is
 *   built first, in the first language named; then the host adds a version per language
 *   (`LanguageVersionsPort.add`: pages, alternates, links and a switcher, no model) and each
 *   new version is translated by its own edit run (`page.translate`), the page shown first.
 * - "translate" the whole site («ترجم الموقع للإنجليزي»): each page, in turn, is translated
 *   in place.
 * - A whole SITE in several languages (T230c): "Build a 3-page website in English and
 *   Arabic" builds the site first (site-flow.ts), in the first language named; then EVERY
 *   page it built gets its versions (never the pages the person had before), each version is
 *   translated, and once all are, each language's pages link their own language's pages
 *   (`linkSitePages`), under the names their translations gave them.
 *
 * Only in Auto: Ask and Plan propose before anything is written, so they take the ordinary
 * paths. A Stop ends the loop; a request the person sends meanwhile goes first.
 */
import {
  languageIntent,
  linkSitePages,
  menuLabelOf,
  type IntentRoute,
  type LanguageIntent,
} from '@craftkit/builder';

import { languageLabels } from '../../copy/language-labels';
import { siteLabels } from '../../copy/site-labels';
import type { LanguagePage, LanguageVersionsPort } from '../../model/language-versions';
import { preflightPorts } from '../../model/runs';
import type { AssistantMode } from '../../model/view-types';

import { runPage } from './build-flow';
import type { Flow } from './controller-state';
import { runEdit } from './edit-flow';
import { openExchange, type Outgoing, type Placement } from './exchange';
import { say } from './run-outcomes';
import { insertAfter, sessionOf } from './turn-plumbing';

const EDIT: IntentRoute = { kind: 'edit', confidence: 1, reason: 'A page translation.' };

function isEmpty(page: LanguagePage | undefined): boolean {
  if (page === undefined) return true;
  const document = page.kernel.getDocument();
  const root = document.nodes[document.rootId];
  return (root?.slots?.['default'] ?? []).length === 0;
}

/** The note in the thread: after the person's words, or after the build that answered them. */
function note(flow: Flow, placement: Placement, outgoing: Outgoing | null, text: string): void {
  const turn = { id: flow.env().sessions.nextId('turn'), kind: 'answer', text } as const;
  if (outgoing === null) insertAfter(flow, placement.sessionId, null, [turn]);
  else openExchange(flow, placement, outgoing, turn);
  say(flow, 'answer.ready');
}

/** Each page translated by its own edit run; false once a run was stopped or another took over. */
async function translateEach(
  flow: Flow,
  placement: Placement,
  pages: readonly LanguagePage[],
  lang: (page: LanguagePage) => string,
): Promise<boolean> {
  const labels = languageLabels(flow.env().options.locale);
  for (const page of pages) {
    if (flow.runtime.lease !== null) return false;
    page.show();
    const text = labels.translate(labels.name(lang(page)), page.address);
    await runEdit(flow, { text, context: [], pointed: [] }, placement, 'auto', EDIT, page.kernel);
    const last = sessionOf(flow, placement.sessionId)?.turns.findLast(
      (turn) => turn.kind === 'edit',
    );
    if (last?.kind === 'edit' && last.status === 'stopped') return false;
  }
  return true;
}

/** The pages that hold content now, by id: what a build adds to them is what it wrote. */
function written(port: LanguageVersionsPort): ReadonlySet<string> {
  return new Set(
    port
      .pages()
      .filter((page) => !isEmpty(page))
      .map(({ pageId }) => pageId),
  );
}

/**
 * Each language's versions of a site linked to each other (T230c), as the site build linked
 * its first language's pages (T230b): every page of a language lists that language's pages,
 * each under the name its own translated menu gives it (`menuLabelOf`), its own marked
 * current. A language whose pages do not all name themselves is left as the host relinked
 * it; nothing is written while another run holds the lease.
 */
function linkVersions(flow: Flow, versions: readonly LanguagePage[]): void {
  const label = siteLabels(flow.env().options.locale).linked;
  for (const lang of new Set(versions.map((page) => page.lang))) {
    const pages = versions.filter((page) => page.lang === lang);
    const named = pages.map((page) => ({
      page,
      label: menuLabelOf(page.kernel, page.address),
    }));
    if (pages.length < 2 || named.some(({ label: name }) => name === undefined)) continue;
    const links = named.map(({ page, label: name }) => ({ label: name ?? '', href: page.address }));
    for (const page of pages) {
      if (flow.runtime.lease !== null) return;
      try {
        linkSitePages({
          kernel: page.kernel,
          pages: links,
          current: page.address,
          label,
          validationPorts: preflightPorts(),
        });
      } catch {
        // A page the door refuses keeps the links the host gave it.
      }
    }
  }
}

async function runVersions(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  route: IntentRoute,
  intent: LanguageIntent,
): Promise<void> {
  const env = flow.env();
  const port = env.options.languageVersions;
  const labels = languageLabels(env.options.locale);
  if (port === undefined) return;
  const tags = intent.languages.map(({ tag }) => tag);
  const first = intent.languages[0];
  let built = false;
  // T230c: the pages the build wrote; more than one is a site, versioned page by page.
  let wrote: readonly string[] = [];
  if (first !== undefined && (isEmpty(port.pages()[0]) || route.kind.startsWith('build'))) {
    // The page is written in the first language named; the others become its versions.
    const others = intent.languages.slice(1).map(({ english }) => english);
    const request = `${outgoing.text}\nWrite every text of this page in ${first.english} only${others.length === 0 ? '' : `; the ${others.join(' and ')} versions are added as their own pages afterwards`}.`;
    const build: IntentRoute = route.kind.startsWith('build')
      ? route
      : { kind: 'build-page', confidence: 1, reason: 'A site in several languages, built first.' };
    const before = written(port);
    await runPage(flow, { ...outgoing, request }, placement, build, 'auto');
    if (isEmpty(port.pages()[0])) return;
    built = true;
    wrote = [...written(port)].filter((pageId) => !before.has(pageId));
  }
  const site = route.kind === 'build-site' && wrote.length > 1;
  const result = port.add({
    languages: tags,
    scope: site ? 'site' : built ? 'page' : intent.scope,
    ...(site ? { pages: wrote } : {}),
  });
  const said = built ? null : outgoing;
  if (result.created.length === 0) {
    const names = result.existing.map(({ lang }) => labels.name(lang));
    if (names.length > 0) note(flow, placement, said, labels.already([...new Set(names)]));
    return;
  }
  const names = [...new Set(result.created.map(({ lang }) => labels.name(lang)))];
  note(
    flow,
    placement,
    said,
    labels.added(
      names,
      result.created.map(({ address }) => address),
    ),
  );
  const translated = await translateEach(flow, placement, result.created, (page) => page.lang);
  if (site && translated) linkVersions(flow, [...result.created, ...result.existing]);
}

async function runSiteTranslation(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  intent: LanguageIntent,
): Promise<void> {
  const env = flow.env();
  const target = intent.languages[0];
  const port = env.options.languageVersions;
  if (target === undefined || port === undefined) return;
  const labels = languageLabels(env.options.locale);
  const pages = port.pages().filter((page) => page.lang !== target.tag && !isEmpty(page));
  note(flow, placement, outgoing, labels.translatingSite(labels.name(target.tag), pages.length));
  await translateEach(flow, placement, pages, () => target.tag);
}

/**
 * The language flow a request needs, or undefined when it takes the ordinary path: Ask or
 * Plan, a host without a site, a change to a plan, one page translated in place (an edit
 * whose model has `page.translate`), or no language request at all.
 */
export function languageWork(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  route: IntentRoute,
  mode: AssistantMode,
): Promise<void> | undefined {
  if (mode !== 'auto' || outgoing.request !== undefined) return undefined;
  if (flow.env().options.languageVersions === undefined) return undefined;
  const intent = languageIntent(outgoing.text);
  if (intent?.action === 'versions') return runVersions(flow, outgoing, placement, route, intent);
  if (intent?.action === 'translate' && intent.scope === 'site')
    return runSiteTranslation(flow, outgoing, placement, intent);
  return undefined;
}

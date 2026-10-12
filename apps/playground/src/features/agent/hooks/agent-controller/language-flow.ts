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
 *
 * Only in Auto: Ask and Plan propose before anything is written, so they take the ordinary
 * paths. A Stop ends the loop; a request the person sends meanwhile goes first.
 */
import { languageIntent, type IntentRoute, type LanguageIntent } from '@craftkit/builder';

import { languageLabels } from '../../copy/language-labels';
import type { LanguagePage } from '../../model/language-versions';
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
): Promise<void> {
  const labels = languageLabels(flow.env().options.locale);
  for (const page of pages) {
    if (flow.runtime.lease !== null) return;
    page.show();
    const text = labels.translate(labels.name(lang(page)), page.address);
    await runEdit(flow, { text, context: [], pointed: [] }, placement, 'auto', EDIT, page.kernel);
    const last = sessionOf(flow, placement.sessionId)?.turns.findLast(
      (turn) => turn.kind === 'edit',
    );
    if (last?.kind === 'edit' && last.status === 'stopped') return;
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
  if (first !== undefined && (isEmpty(port.pages()[0]) || route.kind.startsWith('build'))) {
    // The page is written in the first language named; the others become its versions.
    const others = intent.languages.slice(1).map(({ english }) => english);
    const request = `${outgoing.text}\nWrite every text of this page in ${first.english} only${others.length === 0 ? '' : `; the ${others.join(' and ')} versions are added as their own pages afterwards`}.`;
    const build: IntentRoute = route.kind.startsWith('build')
      ? route
      : { kind: 'build-page', confidence: 1, reason: 'A site in several languages, built first.' };
    await runPage(flow, { ...outgoing, request }, placement, build, 'auto');
    if (isEmpty(port.pages()[0])) return;
    built = true;
  }
  const result = port.add({ languages: tags, scope: built ? 'page' : intent.scope });
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
  await translateEach(flow, placement, result.created, (page) => page.lang);
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

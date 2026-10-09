/**
 * The site an edit's page belongs to, as code mode needs it (agent-script DESIGN §A.9, §A.13).
 *
 * A `script.run` step may read every page (`ck.find({page:'*'})`) and write other pages
 * («غيّر اسم الشركة في كل الصفحات»). The engine takes the site as `RunAiAgentOptions.site`
 * and lands every page's writes as ONE site transaction — one Undo reverts every page.
 *
 * The panel only ever holds a page lens (`siteKernel.page(id)`); the app hands it the site
 * kernel nowhere else. So the host remembers its site here (`rememberAgentSite`, called by
 * `app/agent-host.ts` `pageOpener`, which the app builds from its site kernel), and a run
 * finds it again by lens identity: a lens is stable per page id, so the kernel a run edits
 * is a page of the remembered site exactly when `site.page(id) === kernel` for one of its
 * pages. A kernel of any other origin (a fixture, a scratch kernel) gets no site, and its
 * scripts edit the open page only.
 */
import type {
  AiAgentScriptSite,
  BuilderKernel,
  BuilderSiteKernel,
  ScriptPage,
  ScriptRunReport,
} from '@craftkit/builder';

type SitePage = ReturnType<BuilderSiteKernel['getSite']>['pages'][number];

/** A page's language: its root `lang` prop when it has one, else Arabic for rtl and English for ltr. */
export function scriptPageLang(page: SitePage): string {
  const { document } = page;
  const lang = document.nodes[document.rootId]?.props['lang'];
  if (typeof lang === 'string' && lang.trim() !== '') return lang.trim().toLowerCase();
  return document.dir === 'rtl' ? 'ar' : 'en';
}

/** Every page of the site as a script reads it (`ck.pages()`), in the site's order. */
export function scriptPagesOf(site: BuilderSiteKernel, currentPageId: string): ScriptPage[] {
  return site.getSite().pages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.address,
    lang: scriptPageLang(page),
    dir: page.document.dir,
    current: page.id === currentPageId,
  }));
}

/** The id of the page `kernel` is a lens of; `undefined` when it is no page of this site. */
export function pageIdOfLens(site: BuilderSiteKernel, kernel: BuilderKernel): string | undefined {
  const current = site.currentPage();
  if (site.page(current) === kernel) return current;
  return site.pages().find((id) => site.page(id) === kernel);
}

/**
 * Code mode's view of a site, for a run on the page `kernel` is: its pages, a lens per
 * page, that page as the current one, and the site's grouped door. `undefined` when
 * `kernel` is not one of the site's pages.
 */
export function scriptSiteOf(
  site: BuilderSiteKernel,
  kernel: BuilderKernel,
): AiAgentScriptSite | undefined {
  const pageId = pageIdOfLens(site, kernel);
  if (pageId === undefined) return undefined;
  return Object.freeze({
    pages: () => scriptPagesOf(site, pageId),
    page: (id: string) => site.page(id),
    currentPage: () => pageId,
    dispatchGroup: (
      steps: Parameters<BuilderSiteKernel['dispatchGroup']>[0],
      options?: Parameters<BuilderSiteKernel['dispatchGroup']>[1],
    ) => site.dispatchGroup(steps, options),
  });
}

let remembered: BuilderSiteKernel | undefined;

/** The host's site kernel, remembered for the panel's runs (see the module note). */
export function rememberAgentSite(site: BuilderSiteKernel): void {
  remembered = site;
}

/** Forget the remembered site (tests; a host that drops its site). */
export function forgetAgentSite(): void {
  remembered = undefined;
}

/** The remembered site as a run on `kernel` needs it; `undefined` when `kernel` is none of its pages. */
export function agentScriptSiteFor(kernel: BuilderKernel): AiAgentScriptSite | undefined {
  if (remembered === undefined) return undefined;
  try {
    return scriptSiteOf(remembered, kernel);
  } catch {
    // A site that cannot be read is no reason to fail an edit: its scripts stay on this page.
    return undefined;
  }
}

/** One dev-console line per script run: `[script] ms calls steps notes result`. */
export function scriptRunLine(report: ScriptRunReport): string {
  const notes = report.notes.length === 0 ? '' : ` notes=${JSON.stringify(report.notes)}`;
  const result = report.result === undefined ? '' : ` result=${report.result}`;
  return `[script] ${String(report.ms)}ms calls=${String(report.calls)} steps=${String(report.steps)}${notes}${result}`;
}

// @craftkit/builder-core — the kernel implementation: sealed store, one validated
// dispatch door, deterministic ports, contribution catalogs. The raw store and its
// write path are deliberately NOT exported (Law S).

export {
  createBuilder,
  emptyDocument,
  GROUPED_DISPATCH_LABEL_MAX_LENGTH,
  PERSIST_COALESCE_EVERY,
  type BuilderKernel,
  type GroupedDispatchOptions,
  type GroupStep,
  type CreateBuilderOptions,
} from './kernel/create-builder';
export { openDocument, type OpenDocumentOptions } from './kernel/open-document';
export { type ExtensionManagerHandle } from './extensions/manager';

export { defineCommand } from './commands/define-command';
export {
  coreCommands,
  insertedNodeId,
  type CoreCommandName,
  type CoreCommands,
} from './commands/core-commands';

/*
  The SITE door (013, ق١). A separate map and a separate `define` because a site
  command's producer takes a `BuilderSite` and a page command's takes a
  `BuilderDocument`; `isSiteCommandName` is how the site dispatcher routes one
  grouped batch of both into a single production.
*/
/*
  The SITE KERNEL (013, ق١): one store, one transaction log, one history, and N
  page lenses. `page(id)` hands back a full `BuilderKernel`, so every surface
  that already speaks to a kernel works over a site without learning that sites
  exist. The store and its write path stay unexported, exactly as the page
  kernel's do (Law S).
*/
export {
  createSiteBuilder,
  SITE_PERSIST_COALESCE_EVERY,
  type BuilderSiteKernel,
  type CreateSiteBuilderOptions,
} from './site/create-site-builder';
export { liftDocumentSession, openSite, type OpenSiteOptions } from './site/open-site';
export type { SiteGroupStep } from './site/site-dispatcher';
export type { KernelSiteState } from './site/site-store';

export { defineSiteCommand } from './commands/define-site-command';
export {
  isSiteCommandName,
  siteCommands,
  type SiteCommandName,
  type SiteCommands,
} from './commands/site-commands';

export { applyPatchSet, applySitePatchSet } from './patches/apply';
export { applyOnePatch, type RootPatch } from './patches/apply-one-patch';
export { TYPING_MERGE_WINDOW_MS } from './history/history';

export { systemClock } from './ports/system-clock';
export { systemIds } from './ports/system-ids';

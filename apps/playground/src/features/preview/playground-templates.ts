import { loadMarketingTemplates, type BuilderKernel } from '@craftkit/builder';

/*
  The page templates, loaded on demand (performance pass, 2026-10-13).

  Fifteen templates in two languages — their copy, photos and compositions — are
  ~100 KB gzip that the first paint never shows, so they are not in the entry.
  They are fetched in the first idle moment after the editing canvas is live
  (the vault queues a later fallback for a session with no canvas), and at once
  when someone opens the Library on its Templates tab; every ask shares one
  fetch. Evaluating and registering them is main-thread work: it no longer runs
  in the entry, ahead of everything the editor does to boot.

  Until they arrive a kernel simply has no compositions: the Library's Templates
  tab says they are loading, and an agent request made in that window is offered
  no templates rather than failing. Every kernel handed to
  `hydratePlaygroundTemplates` is registered the moment they land, so a request
  made after that sees them (the agent reads the registry per request).
*/

/** What the templates module hands over: the manifest, the Library's cards, the photos. */
export type PlaygroundTemplates = Awaited<ReturnType<typeof loadMarketingTemplates>>;

export type PlaygroundTemplatesState =
  | { readonly status: 'pending' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly templates: PlaygroundTemplates };

const PENDING: PlaygroundTemplatesState = { status: 'pending' };

let state: PlaygroundTemplatesState = PENDING;
let loading: Promise<PlaygroundTemplates> | undefined;
/** When the queued preload, if any, starts waiting for idle (`performance.now()` clock). */
let preloadDue: number | undefined;
const listeners = new Set<() => void>();

function settle(next: PlaygroundTemplatesState): void {
  state = next;
  // A copy: an arrival listener unsubscribes itself while this loop runs.
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Where the templates are: a `useSyncExternalStore` snapshot (stable between changes). */
export function playgroundTemplatesState(): PlaygroundTemplatesState {
  return state;
}

export function subscribePlaygroundTemplates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fetches the templates, once: concurrent callers share the request, and a
 * failed one (offline, a deploy that replaced the chunk) is retried by the next
 * call rather than remembered.
 */
export function loadPlaygroundTemplates(): Promise<PlaygroundTemplates> {
  if (state.status === 'ready') {
    return Promise.resolve(state.templates);
  }
  if (loading === undefined) {
    if (state.status === 'failed') {
      settle(PENDING);
    }
    loading = loadMarketingTemplates().then(
      (templates) => {
        settle({ status: 'ready', templates });
        return templates;
      },
      (error: unknown) => {
        loading = undefined;
        settle({ status: 'failed' });
        throw error;
      },
    );
  }
  return loading;
}

/**
 * Asks for the templates without waiting for them. A failure is not lost: it is
 * the state the Library reads, and the next request tries again.
 */
export function requestPlaygroundTemplates(): void {
  loadPlaygroundTemplates().catch(() => undefined);
}

/**
 * Starts the fetch in the browser's next idle moment, `afterMs` from now:
 * `requestIdleCallback` (at most 2 s late), or 200 ms where the browser has
 * none. A preload already queued to start sooner makes this one redundant; one
 * due sooner is queued beside it, and whichever fires first does the fetch.
 */
export function preloadPlaygroundTemplatesWhenIdle(afterMs = 0): void {
  if (loading !== undefined || state.status === 'ready' || typeof window === 'undefined') {
    return;
  }
  const due = performance.now() + afterMs;
  if (preloadDue !== undefined && preloadDue <= due) {
    return;
  }
  preloadDue = due;
  // The window's own timers, so a page (or a test's DOM) torn down first takes them with it.
  const view: Partial<Pick<Window, 'requestIdleCallback'>> & Pick<Window, 'setTimeout'> = window;
  const start = (): void => {
    if (preloadDue === due) {
      preloadDue = undefined;
    }
    requestPlaygroundTemplates();
  };
  const whenIdle = (): void => {
    if (view.requestIdleCallback === undefined) {
      view.setTimeout(start, 200);
    } else {
      view.requestIdleCallback(start, { timeout: 2000 });
    }
  };
  if (afterMs > 0) {
    view.setTimeout(whenIdle, afterMs);
  } else {
    whenIdle();
  }
}

/** A kernel's registry door: a page kernel's, or a whole site's (every page lens shares it). */
type TemplateHost = Pick<BuilderKernel, 'extensions'>;

function register(kernel: TemplateHost, templates: PlaygroundTemplates): void {
  // Once per registry: a kernel asked for twice (a StrictMode effect) is not a duplicate error.
  if (!kernel.extensions.has(templates.marketingTemplates.name)) {
    kernel.extensions.hydrateDeclarative(templates.marketingTemplates);
  }
}

/**
 * Tier-2 compositions, hydrated AFTER the kernel exists. Templates are not
 * block types, so validation never needs them — which is what lets the vault
 * call this on the site `openSite` hands back, having already validated.
 *
 * Synchronous when the templates have already arrived; otherwise the kernel is
 * registered the moment they do. This never starts the fetch itself: the idle
 * preloads and the Library's request decide when that happens.
 */
export function hydratePlaygroundTemplates(kernel: TemplateHost): void {
  if (state.status === 'ready') {
    register(kernel, state.templates);
    return;
  }
  const arrival = (): void => {
    if (state.status === 'ready') {
      listeners.delete(arrival);
      register(kernel, state.templates);
    }
  };
  listeners.add(arrival);
}

/**
 * Fetches the templates (when they are not already here) and registers them in
 * `kernel`: what a test, a story or a script awaits when it needs the templates
 * present before its first request.
 */
export async function withPlaygroundTemplates<K extends TemplateHost>(kernel: K): Promise<K> {
  register(kernel, await loadPlaygroundTemplates());
  return kernel;
}

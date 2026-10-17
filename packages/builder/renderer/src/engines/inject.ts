import { pageEngines, type PageEngine } from '../behaviors/script';
import { STUDIO_ENGINE_LOADERS } from './studio/loaders'; // pixi-studio:runtime-wiring (2026-10-10)

/**
 * Canvas injection of the lazily loaded engines (media-motion DESIGN §2.4).
 *
 * On the editor canvas (and any host page without the export's
 * `link[data-ck-engine]` prefetch links) `mountSiteBehaviors` calls
 * `ensureCanvasEngines(region)`. For each engine the region's markers name
 * (`pageEngines`) that the region's OWN document does not carry yet as
 * `script[data-ck-engine=<kind>]`, it dynamic-imports the generated string
 * module and appends `<script data-ck-engine=<kind>>` with
 * banner + source + runner call to that document's head. The engine therefore
 * registers in the frame realm: its `window`, `document` and scroller are the
 * iframe's, the same ones the `engines` pack queued on.
 *
 * - Dynamic imports ONLY: the string modules (anime.js, Pixi, Lottie) never reach
 *   the editor's main chunk (held by inject.test.ts).
 * - Once per document: a present script is never added again; the source text
 *   is loaded once per page session.
 * - The returned disposer cancels the injections still waiting on an import.
 * - Reduced motion skips decorative engines, not carousel interaction or explicit script APIs.
 */
export type EngineLoader = () => Promise<string>;

/** The script text each engine asset carries: banner + vendored/bundled source + runner call. */
export const ENGINE_LOADERS: Readonly<Record<PageEngine, EngineLoader>> = {
  carousel: async () => (await import('./carousel-source')).CAROUSEL_SOURCE,
  timeline: async () => {
    const [{ TIMELINE_BANNER, TIMELINE_SOURCE }, { installTimelineEngine }] = await Promise.all([
      import('./timeline-source'),
      import('./timeline-runner'),
    ]);
    return `${TIMELINE_BANNER}${TIMELINE_SOURCE}\n;(${installTimelineEngine.toString()})(window);\n`;
  },
  // The scene bundle already holds its banner and installs itself (`installSceneEngine(window)`).
  scene: async () => (await import('./scene-source')).SCENE_SOURCE,
  // The FULL pixi.js bundle for region scripts (free-code mode, 2026-10-09): same shape, installs itself.
  pixi: async () => (await import('./pixi-full-source')).PIXI_FULL_SOURCE,
  lottie: async () => {
    const [{ LOTTIE_BANNER, LOTTIE_SOURCE }, { installLottieEngine }] = await Promise.all([
      import('./lottie-source'),
      import('./lottie-runner'),
    ]);
    return `${LOTTIE_BANNER}${LOTTIE_SOURCE}\n;(${installLottieEngine.toString()})(window);\n`;
  },
  // pixi-studio:runtime-wiring additions (2026-10-10): the add-on libraries and the sound engine,
  // each a dynamic import of its generated string module (engines/studio/loaders.ts).
  ...STUDIO_ENGINE_LOADERS,
  // end pixi-studio:runtime-wiring additions
};

const loaded = new WeakMap<EngineLoader, Promise<string>>();

function textOf(loader: EngineLoader): Promise<string> {
  let text = loaded.get(loader);
  if (text === undefined) {
    text = loader();
    loaded.set(loader, text);
    // A failed import may be retried by the next mount.
    text.catch(() => {
      loaded.delete(loader);
    });
  }
  return text;
}

function present(doc: Document, kind: PageEngine): boolean {
  return doc.querySelector(`script[data-ck-engine="${kind}"]`) !== null;
}

export function ensureCanvasEngines(
  root: ParentNode,
  options?: {
    readonly loaders?: Partial<Readonly<Record<PageEngine, EngineLoader>>>;
    // pixi-studio:runtime-wiring additions (2026-10-10)
    /**
     * `false` only for a host Preview (a view a reader interacts with). Absent or `true`: the
     * editor canvas, which never loads `sound` (DESIGN D12) — the safe default.
     */
    readonly canvas?: boolean;
    // end pixi-studio:runtime-wiring additions
  },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const noop = (): void => undefined;
  if (doc === null) return noop;
  const view = doc.defaultView;
  const reduced =
    view !== null &&
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /*
    Reduced motion skips decorative engines. Explicit script APIs decide what to draw via
    `ck.reducedMotion`; carousel navigation remains available and jumps without animation.
  */
  // pixi-studio:runtime-wiring additions (2026-10-10): the add-on libraries load under reduced
  // motion like pixi (the script decides what to draw); sound never loads on the editor canvas.
  const canvas = options?.canvas !== false;
  const always = (kind: PageEngine): boolean =>
    kind === 'pixi' || kind === 'carousel' || kind.startsWith('lib-') || kind === 'sound';
  const kinds = [...pageEngines(root)].filter(
    (kind) =>
      (!reduced || always(kind)) &&
      !(canvas && (kind === 'sound' || kind === 'carousel')) &&
      !present(doc, kind),
  );
  // end pixi-studio:runtime-wiring additions
  if (kinds.length === 0) return noop;
  let cancelled = false;
  for (const kind of kinds) {
    const loader = options?.loaders?.[kind] ?? ENGINE_LOADERS[kind];
    textOf(loader).then(
      (text) => {
        if (cancelled || present(doc, kind)) return;
        const script = doc.createElement('script');
        script.setAttribute('data-ck-engine', kind);
        script.textContent = text;
        doc.head.appendChild(script);
      },
      () => {
        // The engine failed to load: the fallback markup stays.
      },
    );
  }
  return () => {
    cancelled = true;
  };
}

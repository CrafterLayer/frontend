import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { decodeMarkupAttribute } from '../behaviors/script';
import { CustomCode } from '../components/CustomCode';
import type { PageEngine } from '../behaviors/script';
import type { EngineLoader } from '../engines/inject';
import { buildStudioPreviewHtml, type StudioPreviewTrust } from './preview-document';
import type { StudioProbeThumbnailSettings } from './scene-probe-capture';
import type {
  SceneProbeFrameResult,
  SceneProbePass,
  SceneProbePassName,
  SceneProbePassReport,
  SceneProbeReport,
} from './scene-probe-report';
import { runSceneProbeFrame, type SceneProbeFrameArgs } from './scene-probe-runner';

/**
 * Run a scene before it lands (creative-power Phase 2 E, 2026-10-12): "run it, check it, fix
 * it". The static scene check reads the code; this RUNS it — the region (a written section, or
 * markup that carries its `data-ck-js`) in the Studio's sandboxed preview document, off to the
 * side of the host page, once per pass: 1280×720 (clicking the first visible Start/Next/Play
 * control once), 390×700, and 1280×720 under reduced motion — all in the page's direction, so an
 * Arabic page's passes all run right-to-left. Each pass resolves to the frame's measurements
 * (scene-probe-frame.ts); `@craftkit/builder-ai`'s `sceneProbeIssues` words them as fixes.
 *
 * Bounded: the passes share `budgetMs` (6 s by default) and a pass the budget has no room for is
 * skipped; `signal` stops it. Browser-only: without a DOM (Node) and no `runPass` it resolves
 * `unavailable` at once, measuring nothing — importing it in Node is safe.
 */

/** A written section, as the build's step E holds it (`LandedSection`). */
export interface SceneProbeSection {
  readonly tree: unknown;
  readonly css?: string | undefined;
  readonly js?: string | undefined;
  readonly jsParams?: unknown;
}

/** Runs one pass's document and resolves to its report (the test seam; a browser test's page). */
export type SceneProbePassRunner = (
  args: SceneProbeFrameArgs,
  signal?: AbortSignal,
) => Promise<SceneProbeFrameResult>;

export interface SceneProbeOptions {
  /** The section to run: its tree is rendered as the published page renders it. */
  readonly section?: SceneProbeSection | undefined;
  /** Or the region's markup itself (its root carries `data-ck-js`). */
  readonly html?: string | undefined;
  /** The page's language and direction; Arabic (and the other RTL languages) default to rtl. */
  readonly lang?: string | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
  /** The site's CSS variables and any page CSS the region relies on. */
  readonly themeCss?: string | undefined;
  /**
   * CSS for exactly these Tailwind classes (the host's live compiler, `compileFor`). Without it,
   * a tree whose classes the given CSS does not mention probes with `stylesComplete: false`.
   */
  readonly compileClasses?: ((classNames: Iterable<string>) => Promise<string>) | undefined;
  /** The passes' viewports: [desktop, mobile]. */
  readonly viewports?: readonly [ProbeViewport, ProbeViewport] | undefined;
  /** Skip the reduced-motion pass. */
  readonly skipReducedMotion?: boolean | undefined;
  /** Click the first visible Start/Next/Play control once (desktop pass). Default true. */
  readonly click?: boolean | undefined;
  /**
   * Also take a small picture of the page in the desktop pass (640×360) and the phone pass
   * (≈ 200×360), before any click, for a visual review of the scene (2026-10-13). Default off.
   */
  readonly thumbnails?: boolean | undefined;
  /** All passes together, ms. Default 6000. */
  readonly budgetMs?: number | undefined;
  readonly signal?: AbortSignal | undefined;
  /** Test seam: replaces the browser runner (`runSceneProbeFrame`). */
  readonly runPass?: SceneProbePassRunner | undefined;
  /** 'unreviewed' runs it with no network at all (see `studioPreviewCsp`). Default 'trusted'. */
  readonly trust?: StudioPreviewTrust | undefined;
  /** Test seam: replaces the asset loaders. */
  readonly loaders?: Partial<Readonly<Record<PageEngine, EngineLoader>>> | undefined;
}

export interface ProbeViewport {
  readonly width: number;
  readonly height: number;
}

export const SCENE_PROBE_BUDGET_MS = 6_000;
const DEFAULT_VIEWPORTS: readonly [ProbeViewport, ProbeViewport] = [
  { width: 1280, height: 720 },
  { width: 390, height: 700 },
];
/**
 * Each pass's share of what is left of the budget when it starts (the clicking pass needs ~1 s
 * more), so time a fast pass leaves over goes to the next: 6 s → 2.7 s, then ~1.8 s, then the rest.
 */
const PASS_WEIGHT: Readonly<Record<SceneProbePassName, number>> = {
  desktop: 0.45,
  mobile: 0.3,
  'reduced-motion': 0.25,
};
/** A pass with less than this left is skipped: it could not settle and measure. */
const MIN_PASS_MS = 900;
/** The pictures' bounds and size caps: both together stay under 200,000 characters of base64. */
const THUMBNAIL_BOX = { width: 640, height: 360 } as const;
const THUMBNAIL_MAX_CHARS: Readonly<Record<SceneProbePassName, number>> = {
  desktop: 140_000,
  mobile: 60_000,
  'reduced-motion': 0,
};

/** What a pass's picture is taken as: a JPEG fitted into 640×360 (none under reduced motion). */
export function sceneProbeThumbnail(
  pass: SceneProbePass,
): StudioProbeThumbnailSettings | undefined {
  const maxChars = THUMBNAIL_MAX_CHARS[pass.name];
  if (maxChars === 0) return undefined;
  const scale = Math.min(1, THUMBNAIL_BOX.width / pass.width, THUMBNAIL_BOX.height / pass.height);
  return {
    width: Math.round(pass.width * scale),
    height: Math.round(pass.height * scale),
    type: 'image/jpeg',
    quality: 0.72,
    maxChars,
  };
}
const RTL_LANGUAGES = /^(?:ar|fa|he|ur|ps|ckb|yi|dv)(?:-|$)/iu;
/** The code opens a Pixi stage (`ck.pixi()` alone draws nothing). */
const OPENS_STAGE = /\bck\s*\.\s*(?:scene|stage)\s*\(/u;

/** The passes a probe runs, in order. */
export function sceneProbePasses(
  options: Pick<SceneProbeOptions, 'lang' | 'dir' | 'viewports' | 'skipReducedMotion' | 'click'>,
): readonly SceneProbePass[] {
  const lang = options.lang ?? 'en';
  const dir = options.dir ?? (RTL_LANGUAGES.test(lang) ? 'rtl' : 'ltr');
  const [desktop, mobile] = options.viewports ?? DEFAULT_VIEWPORTS;
  const common = { lang, dir } as const;
  return [
    {
      name: 'desktop',
      ...desktop,
      ...common,
      reducedMotion: false,
      click: options.click !== false,
    },
    { name: 'mobile', ...mobile, ...common, reducedMotion: false, click: false },
    ...(options.skipReducedMotion === true
      ? []
      : [
          {
            name: 'reduced-motion' as const,
            ...desktop,
            ...common,
            reducedMotion: true,
            click: false,
          },
        ]),
  ];
}

/** Every class name the markup renders. */
function classNamesOf(markup: string): Set<string> {
  const names = new Set<string>();
  for (const match of markup.matchAll(/\sclass="([^"]*)"/gu)) {
    for (const name of decodeMarkupAttribute(match[1] ?? '').split(/\s+/u)) {
      if (name !== '') names.add(name);
    }
  }
  return names;
}

/** A class the given CSS styles (`ck-*` names are the page kit's and the runtime's). */
function styled(name: string, css: string): boolean {
  if (name.startsWith('ck-')) return true;
  const escaped = name.replace(/[^\w-]/gu, (char) => `\\${char}`);
  return css.includes(`.${escaped}`) || css.includes(`.${name}`);
}

interface ProbeSource {
  readonly markup: string;
  readonly code: string;
  readonly css: string;
  readonly stylesComplete: boolean;
}

/** The region to run: the section rendered as published (or the markup given), and its CSS. */
export async function sceneProbeSource(
  options: Pick<SceneProbeOptions, 'section' | 'html' | 'themeCss' | 'compileClasses'>,
): Promise<ProbeSource> {
  const section = options.section;
  const markup =
    section === undefined
      ? (options.html ?? '')
      : renderToStaticMarkup(
          createElement(CustomCode, {
            tree: section.tree,
            hostId: 'probe',
            js: section.js,
            jsParams: section.jsParams,
          }),
        );
  const code = [...markup.matchAll(/\sdata-ck-js=(?:"([^"]*)"|'([^']*)')/gu)]
    .map((match) => decodeMarkupAttribute(match[1] ?? match[2] ?? ''))
    .join('\n');
  const written = `${options.themeCss ?? ''}\n${section?.css ?? ''}`;
  const names = [...classNamesOf(markup)];
  let compiled = '';
  let complete = names.every((name) => styled(name, written));
  if (!complete && options.compileClasses !== undefined) {
    try {
      compiled = await options.compileClasses(names);
      complete = true;
    } catch {
      compiled = '';
    }
  }
  return {
    markup,
    code,
    css: [options.themeCss ?? '', compiled, section?.css ?? ''].join('\n'),
    stylesComplete: complete,
  };
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/** Run the region in each pass and report what it found. */
export async function probeScene(options: SceneProbeOptions): Promise<SceneProbeReport> {
  const started = now();
  const run: SceneProbePassRunner | undefined =
    options.runPass ?? (typeof document === 'undefined' ? undefined : runSceneProbeFrame);
  const source: ProbeSource =
    run === undefined
      ? { markup: '', code: options.section?.js ?? '', css: '', stylesComplete: false }
      : await sceneProbeSource(options);
  const expectCanvas = OPENS_STAGE.test(source.code);
  const report = (
    status: SceneProbeReport['status'],
    passes: readonly SceneProbePassReport[],
    skipped: readonly SceneProbePassName[],
  ): SceneProbeReport => ({
    version: 1,
    status,
    expectCanvas,
    stylesComplete: source.stylesComplete,
    passes,
    skipped,
    elapsedMs: Math.round(now() - started),
  });
  if (run === undefined || source.code.trim() === '') return report('unavailable', [], []);

  const budget = options.budgetMs ?? SCENE_PROBE_BUDGET_MS;
  const passes: SceneProbePassReport[] = [];
  const skipped: SceneProbePassName[] = [];
  const planned = sceneProbePasses(options);
  for (const [index, pass] of planned.entries()) {
    if (options.signal?.aborted === true) return report('aborted', passes, skipped);
    // A pass gets its share of what is left, at least MIN_PASS_MS: the earlier passes come first.
    const weights = planned.slice(index).reduce((sum, { name }) => sum + PASS_WEIGHT[name], 0);
    const remaining = budget - (now() - started);
    if (remaining < MIN_PASS_MS) {
      skipped.push(pass.name);
      continue;
    }
    const share = (remaining * PASS_WEIGHT[pass.name]) / Math.max(weights, 0.01);
    const timeoutMs = Math.round(Math.min(remaining, Math.max(share, MIN_PASS_MS)));
    const passStarted = now();
    // The frame posts by `deadline`; the host waits no longer than the pass's own share.
    const deadline = Date.now() + timeoutMs - 250;
    const thumbnail = options.thumbnails === true ? sceneProbeThumbnail(pass) : undefined;
    const html = await buildStudioPreviewHtml({
      code: source.code,
      markup: source.markup,
      themeCss: source.css,
      lang: pass.lang,
      dir: pass.dir,
      reducedMotion: pass.reducedMotion,
      width: pass.width,
      trust: options.trust ?? 'trusted',
      ...(options.loaders === undefined ? {} : { loaders: options.loaders }),
      probe: {
        deadline,
        canvasWaitMs: Math.max(1_500, Math.round(timeoutMs * 0.6)),
        settleMs: 600,
        expectCanvas,
        click: pass.click,
        ...(thumbnail === undefined ? {} : { thumbnail }),
      },
    });
    const result = await run(
      {
        html,
        width: pass.width,
        height: pass.height,
        timeoutMs: Math.max(250, Math.round(passStarted + timeoutMs - now())),
      },
      options.signal,
    );
    passes.push({ ...result, pass, elapsedMs: Math.round(now() - passStarted) });
    if (result.status === 'aborted') return report('aborted', passes, skipped);
  }
  return report(skipped.length === 0 ? 'done' : 'partial', passes, skipped);
}

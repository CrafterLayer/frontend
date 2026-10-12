import type { LandedSection, SectionCheckCode, SectionCheckIssue } from './page-plan/types';

/**
 * What RUNNING a scene found, worded as the fixes (creative-power Phase 2 E, 2026-10-12).
 *
 * The static scene check (check-scene.ts) reads the code; a browser host can also run it before
 * it lands — `@craftkit/builder-renderer`'s `probeScene` mounts the section in the Studio's
 * sandboxed preview at 1280×720, 390×700 and under reduced motion, clicks its Start once, and
 * reports what a visitor would meet. A build accepts that as `sceneProbe` (RunAiBuildOptions);
 * `checkWritten` calls it for a scene section whose code the static check passed, and what it
 * finds joins the section's ONE repair round. Headless builds pass nothing and run nothing.
 *
 * The report types below are the fields read here — a structural subset of the renderer's
 * `SceneProbeReport` (this layer never imports the renderer). Every rule stays silent when it
 * cannot be sure: a pass that did not finish, a page hidden mid-run (no frames), or a tree whose
 * classes went uncompiled (layout and layering unknown).
 */

export interface SceneProbeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneProbeFrame {
  readonly region: SceneProbeRect | null;
  readonly canvas: { readonly rect: SceneProbeRect } | null;
  readonly controls: readonly {
    readonly label: string;
    readonly tag: string;
    readonly outside: boolean;
    readonly covered: 'canvas' | 'other' | null;
  }[];
  readonly overflowX: number;
  readonly blank: boolean | null;
  readonly fps: number | null;
  readonly errors: readonly { readonly message: string; readonly line: number | null }[];
  readonly click: { readonly label: string; readonly changed: boolean | null } | null;
  readonly hidden: boolean;
  readonly settledMs: number;
  /** How long it waited for the canvas, and how long the scene then ran before it was measured. */
  readonly waitedMs: number;
  readonly ranMs: number;
}

export interface SceneProbePassReport {
  readonly status: string;
  readonly report: SceneProbeFrame | null;
  readonly pass: {
    readonly name: string;
    readonly width: number;
    readonly reducedMotion: boolean;
  };
}

export interface SceneProbeReport {
  readonly status: string;
  readonly expectCanvas: boolean;
  readonly stylesComplete: boolean;
  readonly passes: readonly SceneProbePassReport[];
  /** Passes the probe's time budget left no room for. */
  readonly skipped: readonly string[];
  readonly elapsedMs: number;
}

/** The page the scene runs in. */
export interface SceneProbeContext {
  readonly lang: string;
  readonly dir: 'ltr' | 'rtl';
  readonly signal?: AbortSignal;
}

/** Runs a scene section and reports what it found (a browser host's `probeScene`). */
export type SceneProbe = (
  section: LandedSection,
  context: SceneProbeContext,
) => Promise<SceneProbeReport>;

/** The most runtime issues one section sends to its repair round. */
const MAX_PROBE_ISSUES = 6;
/** "No canvas" needs this long a wait, and "blank" this long a run, to be sure. */
const WAITED_MS = 1_500;
const RAN_MS = 400;
/** A probe that has not answered by then found nothing (it budgets ~6 s itself). */
export const SCENE_PROBE_TIMEOUT_MS = 20_000;
const OPENS_STAGE = /\bck\s*\.\s*(?:scene|stage)\s*\(/u;
/**
 * The code draws on the stage (adds display objects, or hands the app/stage to a library). A
 * scene that only uses the canvas as a backdrop for DOM (an Ink dialogue box) may leave it empty.
 */
const DRAWS =
  /\.\s*addChild(?:At)?\s*\(|\bnew\s+[\w$.]*(?:Graphics|Sprite|Text|Mesh|Container)\s*\(|\b(?:s|scene)\s*\.\s*(?:app|stage)\b|\bapp\s*\.\s*(?:stage|renderer)\b/u;

/** A scene section: its code opens a Pixi stage. Only these are run. */
export function isProbedScene(section: LandedSection): boolean {
  return typeof section.js === 'string' && OPENS_STAGE.test(section.js);
}

function whereOf(pass: SceneProbePassReport['pass']): string {
  if (pass.reducedMotion) return ' under reduced motion';
  return pass.width < 600 ? ` on a ${String(pass.width)} px phone` : '';
}

function nounOf(tag: string): string {
  if (tag === 'a') return 'link';
  return ['input', 'select', 'textarea'].includes(tag) ? 'field' : 'button';
}

function quoted(text: string, max: number): string {
  const clean = text.replace(/\s+/gu, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** The fix an error message points at. */
function errorFix(message: string): string {
  if (message.startsWith('PixiJS Error') && /shader|program/iu.test(message)) {
    return "a shader would not compile or link, so nothing it draws appears — start the fragment shader with 'precision highp float;' so the uniforms it shares with the vertex shader (uInputSize, uOutputFrame…) have the same precision";
  }
  const undefinedName = /^(\S+) is not defined$/u.exec(message);
  if (undefinedName !== null)
    return `define ${undefinedName[1] ?? 'it'} before use (or fix its spelling)`;
  const nullish =
    /Cannot read propert(?:y|ies) of (null|undefined)(?: \(reading '([^']+)'\))?/u.exec(message);
  if (nullish !== null) {
    return `the value before .${nullish[2] ?? '…'} is ${nullish[1] ?? 'null'} there — check the lookup finds an element of the section's tree (or guard it) before using it`;
  }
  const notFunction = /^(\S+) is not a function/u.exec(message);
  if (notFunction !== null) {
    return `${notFunction[1] ?? 'it'} is not a function there — call only what ck, s and the listed libraries provide`;
  }
  const early = /^Cannot access '([^']+)' before initialization/u.exec(message);
  if (early !== null) return `declare ${early[1] ?? 'it'} above the line that uses it`;
  return 'fix the code at that line so the scene runs to the end';
}

interface Ranked {
  readonly rank: number;
  readonly issue: SectionCheckIssue;
}

function issue(code: SectionCheckCode, message: string, path?: string): SectionCheckIssue {
  return path === undefined ? { code, message } : { code, message, path };
}

/** The frame-based findings: a page hidden mid-run renders no frames, so they say nothing. */
function frameFindings(
  report: SceneProbeReport,
  frame: SceneProbeFrame,
  pass: SceneProbePassReport['pass'],
  draws: boolean,
  add: (key: string, rank: number, found: SectionCheckIssue) => void,
): void {
  const where = whereOf(pass);
  const seconds = (Math.round(frame.settledMs / 100) / 10).toFixed(1);
  const ran = frame.ranMs >= RAN_MS;
  if (
    report.expectCanvas &&
    frame.canvas === null &&
    frame.errors.length === 0 &&
    frame.waitedMs >= WAITED_MS
  ) {
    add(
      'no-canvas',
      2,
      issue(
        'scene-blank',
        `The scene drew nothing: no canvas appeared within ${(Math.round(frame.waitedMs / 100) / 10).toFixed(1)} s${where} — await ck.scene() (or ck.stage()) first, and make sure nothing before it waits forever.`,
      ),
    );
  }
  if (ran && draws && frame.canvas !== null && frame.blank === true && frame.errors.length === 0) {
    add(
      'blank',
      2,
      issue(
        'scene-blank',
        pass.reducedMotion
          ? 'The canvas stays blank under reduced motion — when s.reducedMotion is true, draw one finished still frame (then s.app.render()) instead of waiting for the ticker.'
          : `The canvas is blank after ${seconds} s${where} — draw something on the first frame (a background and the main shapes), not only after a click or a timer.`,
      ),
    );
  }
  if (frame.click !== null && frame.click.changed === false) {
    const label = quoted(frame.click.label, 40);
    add(
      `dead:${label}`,
      5,
      issue(
        'scene-control',
        `Clicking "${label}" changed nothing — wire it: listen for 'click' on that button inside ck.root and start the scene (update the canvas or the status text).`,
      ),
    );
  }
}

/** Layout and layering: only when every class the region renders had its CSS. */
function layoutFindings(
  frame: SceneProbeFrame,
  pass: SceneProbePassReport['pass'],
  add: (key: string, rank: number, found: SectionCheckIssue) => void,
): void {
  const where = whereOf(pass);
  const { region, canvas } = frame;
  if (region !== null && region.height < 4) {
    add(
      'height',
      3,
      issue(
        'scene-height',
        `The region is ${String(Math.max(0, region.height))}px tall${where}, so the canvas has nothing to fill — give the region a height in its css, e.g. .ck-scene{position:relative;width:100%;aspect-ratio:16/9;min-height:320px}.`,
      ),
    );
  } else if (region !== null && canvas !== null && region.width > 0) {
    const below = region.y + region.height - (canvas.rect.y + canvas.rect.height);
    const before = canvas.rect.x - region.x;
    const after = region.x + region.width - (canvas.rect.x + canvas.rect.width);
    const gaps: [string, number, number][] = [
      ['lower', below, region.height],
      ['left', before, region.width],
      ['right', after, region.width],
    ];
    for (const [side, gap, extent] of gaps) {
      if (gap / extent < 0.15) continue;
      add(
        `gap-${side}`,
        4,
        issue(
          'scene-layout',
          `The canvas leaves the region's ${side} ${String(Math.round((gap / extent) * 100))}% empty${where} — size the stage from the region (s.width/s.height; no fixed stage size) and re-lay out on resize (s.onResize).`,
        ),
      );
    }
  }
  for (const control of frame.controls) {
    const label = quoted(control.label, 40);
    const noun = nounOf(control.tag);
    if (control.covered === 'canvas') {
      add(
        `under:${label}`,
        5,
        issue(
          'scene-control',
          `The "${label}" ${noun} is under the canvas${where} — give the text layer position:relative; z-index:1 so it sits above the stage.`,
        ),
      );
    } else if (control.covered === 'other') {
      add(
        `covered:${label}`,
        5,
        issue(
          'scene-control',
          `The "${label}" ${noun} is covered by another element${where} — move it, or lift it with position:relative; z-index:1.`,
        ),
      );
    }
    if (control.outside) {
      add(
        `outside:${label}`,
        4,
        issue(
          'scene-layout',
          `The "${label}" ${noun} sits outside the region${where} — keep the controls inside the section: no negative offsets, no fixed widths wider than the screen.`,
        ),
      );
    }
  }
  if (frame.overflowX > 4) {
    add(
      'overflow',
      4,
      issue(
        'scene-layout',
        `The page runs ${String(frame.overflowX)}px past the screen's edge${where} — size the section with % or max-width:100% (no fixed widths), so it never scrolls sideways.`,
      ),
    );
  }
}

/**
 * A probe report as the repair round reads it: each finding the instruction that fixes it,
 * errors first (with their line), at most six. A report that measured nothing finds nothing.
 * Given the section, a blank canvas counts only when its code draws on the stage.
 */
export function sceneProbeIssues(
  report: SceneProbeReport | null | undefined,
  section?: { readonly js?: string | undefined },
): readonly SectionCheckIssue[] {
  if (report === null || report === undefined) return [];
  // Injected data: a report without its passes measured nothing.
  const passes: unknown = report.passes;
  if (!Array.isArray(passes)) return [];
  const draws = typeof section?.js !== 'string' || DRAWS.test(section.js);
  const found: Ranked[] = [];
  const keys = new Set<string>();
  const add = (key: string, rank: number, entry: SectionCheckIssue): void => {
    if (keys.has(key)) return;
    keys.add(key);
    found.push({ rank, issue: Object.freeze(entry) });
  };
  for (const { status, report: frame, pass } of report.passes) {
    if (status !== 'done' || frame === null || typeof frame !== 'object') continue;
    for (const { message, line } of frame.errors) {
      const detail = quoted(message, 160);
      const at = line === null ? '' : ` at js line ${String(line)}`;
      add(
        `error:${detail}:${String(line)}`,
        0,
        issue(
          'scene-runtime',
          `The scene threw "${detail}"${at}${whereOf(pass)} — ${errorFix(detail)}.`,
          line === null ? undefined : `js line ${String(line)}`,
        ),
      );
    }
    if (!frame.hidden) frameFindings(report, frame, pass, draws, add);
    if (report.stylesComplete) layoutFindings(frame, pass, add);
  }
  return Object.freeze(
    found
      .sort((a, b) => a.rank - b.rank)
      .slice(0, MAX_PROBE_ISSUES)
      .map(({ issue: entry }) => entry),
  );
}

/**
 * Run the probe and word what it found; never rejects. A probe that throws, rejects or does not
 * answer within `SCENE_PROBE_TIMEOUT_MS` found nothing — the section lands as checked.
 */
export async function sceneProbeFindings(
  probe: SceneProbe,
  section: LandedSection,
  context: SceneProbeContext,
): Promise<readonly SectionCheckIssue[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        resolve(null);
      }, SCENE_PROBE_TIMEOUT_MS);
    });
    return sceneProbeIssues(await Promise.race([probe(section, context), late]), section);
  } catch {
    return [];
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

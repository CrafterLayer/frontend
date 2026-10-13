import { creativeBriefFor } from '../creative/creative-planner';
import {
  AI_SCENE_REVIEW_MAX_FINDINGS,
  AI_SCENE_REVIEW_MAX_IMAGE_CHARS,
  type AiSceneReview,
  type AiSceneReviewBrief,
  type AiSceneReviewImage,
  type AiSceneReviewMediaType,
  type AiSceneReviewRequest,
} from '../provider/scene-review-wire';
import { buildMemoryOf } from './build-memory';
import type { PagePlan, SectionCheckIssue, SectionContract } from './page-plan/types';
import type { SceneProbe, SceneProbeReport } from './scene-probe';
import { creativeRequestOf, hostCreativeMemory } from './section-providers';
import type { RunAiBuildOptions } from './types';

/*
  Visual self-review (2026-10-13): the build LOOKS at the scene it wrote. The scene probe already
  runs each scene section in a hidden sandboxed frame; asked for `thumbnails`, it also takes a
  small picture of the desktop pass (640×360) and the phone pass. When the provider can see
  (`reviewScene` — the remote provider; caching, retrying and catalog providers pass it through)
  the model is shown the picture beside the section's contract — title, purpose, must-say — and
  the brief's palette, cast and setting, and asked what VISIBLY fails: a blank area, unreadable
  text, text over busy art without a backdrop, something cut off or overlapping, the wrong
  palette, a named character missing, a layout broken on the phone. Its findings join the
  section's ONE repair round as `scene-visual`.

  Cost control: at most one look per scene section per build — at its FIRST check, while a
  repair round can still use it (the repaired answer is not looked at again) — only with free
  code on, a probe, a provider that can see and a picture that is not blank. `visualReview:
  false` turns it off; it is on by default exactly where a provider has `reviewScene`. A review
  that fails, refuses or takes longer than `SCENE_REVIEW_BUDGET_MS` found nothing.
*/

/** The scene options a build takes (`RunAiBuildOptions` extends this). */
export interface AiBuildSceneOptions {
  /** Run a scene section in a browser before it lands (scene-probe.ts); Node builds omit it. */
  sceneProbe?: SceneProbe | undefined;
  /**
   * Show the model a picture of each probed scene section, with its contract, and send what it
   * sees wrong to the section's repair round (scene-review.ts): one look per scene section per
   * build. Default: on when the provider has `reviewScene` (the remote provider); `false` is off.
   */
  visualReview?: boolean | undefined;
}

/** What the scene checks read from the build: a `RunAiBuildOptions` is one. */
export type SceneCheckHost = Pick<
  RunAiBuildOptions,
  | 'runId'
  | 'provider'
  | 'request'
  | 'freeCode'
  | 'sceneProbe'
  | 'visualReview'
  | 'creativeMemory'
  | 'signal'
>;

/** A review that has not answered by then found nothing (the server's own cap is 40 s). */
export const SCENE_REVIEW_BUDGET_MS = 45_000;
/** A picture with less of it drawn than this is blank: the probe's own finding covers it. */
const MIN_PICTURE_INK = 0.002;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/u;

/** Whether this build looks at its scenes at all. */
export function reviewsScenes(host: SceneCheckHost | undefined): host is SceneCheckHost {
  return (
    host?.freeCode === true &&
    host.sceneProbe !== undefined &&
    host.visualReview !== false &&
    typeof host.provider.reviewScene === 'function'
  );
}

/**
 * Claim the build's one look at a section's scene: true the FIRST time it is checked, never
 * again — so the repaired answer, whose check could no longer be repaired, is not looked at.
 */
export function claimSceneReview(host: SceneCheckHost | undefined, key: string): boolean {
  if (!reviewsScenes(host)) return false;
  const { looked } = buildMemoryOf(host);
  if (looked.has(key)) return false;
  looked.add(key);
  return true;
}

/** One pass's picture as the review takes it; none when it is missing, blank or malformed. */
function pictureOf(
  report: SceneProbeReport | null,
  name: 'desktop' | 'mobile',
): AiSceneReviewImage | undefined {
  const pass = report?.passes.find((entry) => entry.pass.name === name && entry.status === 'done');
  const thumbnail = pass?.report?.thumbnail;
  if (thumbnail === null || thumbnail === undefined || typeof thumbnail !== 'object') return;
  if (typeof thumbnail.ink !== 'number' || !(thumbnail.ink >= MIN_PICTURE_INK)) return;
  const match = typeof thumbnail.dataUrl === 'string' ? DATA_URL.exec(thumbnail.dataUrl) : null;
  if (match === null) return;
  const width = Math.round(thumbnail.width);
  const height = Math.round(thumbnail.height);
  if (!(width > 0 && height > 0)) return;
  return {
    mediaType: match[1] as AiSceneReviewMediaType,
    base64: match[2] ?? '',
    width,
    height,
  };
}

/** The palette, cast and setting the picture should show. */
function briefOf(
  host: SceneCheckHost,
  plan: PagePlan,
  contract: SectionContract,
): AiSceneReviewBrief {
  const { tokens } = plan;
  const palette = (
    [
      ['bg', tokens.bg],
      ['surface', tokens.surface],
      ['ink', tokens.ink],
      ['muted', tokens.muted],
      ['accent', tokens.accent],
      ['on-accent', tokens.onAccent],
    ] as const
  )
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
    .map(([name, value]) => `${name} ${value}`);
  let cast: readonly string[] = [];
  let setting = '';
  try {
    const memory = hostCreativeMemory(host);
    const brief = creativeBriefFor(creativeRequestOf(host, contract), host.request, {
      lang: plan.locale.lang,
      ...(memory === undefined ? {} : { memory }),
    });
    cast = brief.cast.map((character) => {
      const said = [character.role, character.color].filter(
        (part): part is string => typeof part === 'string' && part !== '',
      );
      return said.length === 0 ? character.name : `${character.name} (${said.join(', ')})`;
    });
    setting = [`${brief.kind} · ${brief.genre}`, [...brief.settings, ...brief.weather].join(', ')]
      .filter((part) => part !== '')
      .join(' · ');
  } catch {
    // The brief is a planning aid: without it the picture is judged on its contract alone.
  }
  return {
    ...(palette.length === 0 ? {} : { palette }),
    ...(cast.length === 0 ? {} : { cast }),
    ...(setting === '' ? {} : { setting }),
  };
}

/**
 * What the review is asked: the desktop picture (none ⇒ no review), the phone's when it fits
 * the size cap, the contract, the brief and the page's language.
 */
export function sceneReviewRequest(
  host: SceneCheckHost,
  plan: PagePlan,
  contract: SectionContract,
  report: SceneProbeReport | null,
): AiSceneReviewRequest | undefined {
  const image = pictureOf(report, 'desktop');
  if (image === undefined || image.base64.length > AI_SCENE_REVIEW_MAX_IMAGE_CHARS) return;
  const phone = pictureOf(report, 'mobile');
  const fits =
    phone !== undefined &&
    image.base64.length + phone.base64.length <= AI_SCENE_REVIEW_MAX_IMAGE_CHARS;
  return {
    image,
    ...(fits ? { phone } : {}),
    contract: { title: contract.title, purpose: contract.purpose, mustSay: contract.mustSay },
    brief: briefOf(host, plan, contract),
    lang: plan.locale.lang,
  };
}

function sentence(text: string): string {
  return text
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[.\s]+$/u, '');
}

/** A verdict as the repair round reads it: nothing when it is ok, else each finding as a fix. */
export function sceneReviewIssues(review: AiSceneReview): readonly SectionCheckIssue[] {
  if (review.ok) return [];
  return Object.freeze(
    review.findings.slice(0, AI_SCENE_REVIEW_MAX_FINDINGS).flatMap((finding) => {
      const problem = sentence(finding.problem);
      const fix = sentence(finding.fix);
      if (problem === '' || fix === '') return [];
      const where = finding.where === 'phone' ? ' on a 390 px phone' : '';
      return [
        Object.freeze({
          code: 'scene-visual' as const,
          message: `Seen in the rendered section${where}: ${problem} — ${fix}.`,
        }),
      ];
    }),
  );
}

/**
 * Look at a probed scene section: build the request from the probe's pictures, ask the
 * provider, word what it saw. Never rejects; anything but a verdict found nothing.
 */
export async function sceneReviewFindings(
  host: SceneCheckHost,
  plan: PagePlan,
  contract: SectionContract,
  report: SceneProbeReport | null,
): Promise<readonly SectionCheckIssue[]> {
  const review = host.provider.reviewScene?.bind(host.provider);
  if (review === undefined || host.signal?.aborted === true) return [];
  const request = sceneReviewRequest(host, plan, contract, report);
  if (request === undefined) return [];
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort(host.signal?.reason);
  };
  host.signal?.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(() => {
    controller.abort();
  }, SCENE_REVIEW_BUDGET_MS);
  try {
    const late = new Promise<null>((resolve) => {
      controller.signal.addEventListener(
        'abort',
        () => {
          resolve(null);
        },
        { once: true },
      );
    });
    const answer = await Promise.race([review(request, { signal: controller.signal }), late]);
    return answer === null ? [] : sceneReviewIssues(answer);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    host.signal?.removeEventListener('abort', stop);
  }
}

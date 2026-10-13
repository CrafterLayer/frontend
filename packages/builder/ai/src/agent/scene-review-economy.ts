import { fnv1a64, validateParamValues } from '@craftkit/builder-schema';

import { canonicalJsonStringify } from '../internal/canonical-json';
import type { AiSceneReviewRequest } from '../provider/scene-review-wire';
import { SCENE_PRESETS, type ScenePreset } from '../scene-presets/catalog';
import type { LandedSection } from './page-plan/types';

/*
  What a scene review need not pay for (2026-10-13).

  1. TESTED CODE. A scene whose code is a catalogued preset or kit byte for byte was run and
     looked at when it was catalogued (presets.test.ts, set-c/kits.test.ts, and each one in the
     sandboxed Studio preview by apps/evals, the kits also played in Chromium). Its code is its
     identity — the one the free-code door's builtin set already trusts (studio/lint.ts) — so a
     section is recognised by its `js` alone: a build's ready scene lands as the preset's code
     verbatim with no jsMeta or jsParams (the build guard keeps tree, css and js), and the edit
     lane's `scene.preset` lands the same code beside them. A `jsMeta` naming a builtin is not
     enough on its own: code edited afterwards keeps it. Params, when there are any, must sit
     inside the preset's own spec. The probe still runs the section (the deterministic checks
     cost nothing); only the model's look is skipped. Code changed by a single character, or a
     param outside the spec, is looked at as before. What the look no longer sees on such a
     section is the writer's own tree over the tested art — text over busy art, the palette —
     which the probe's layout and control checks cover only in part.

  2. THE SAME SECTION AGAIN. `sceneReviewSourceKey` names what a picture was drawn from — the
     section's tree, css, code and params, its contract and brief, the page's language, and which
     pictures at which sizes — never the picture's bytes, since a running scene is never drawn the
     same twice. The caching provider remembers a verdict by it (caching-provider.ts), so a
     regenerate, an undo and rebuild, or an identical re-run that lands the same section again
     reuses the verdict at no cost. Its scope is that provider instance: a build already looks once
     per section (`claimSceneReview`), so build scope would save nothing; a module-wide memory
     would hand one server's or one model's verdict to another; the host's provider lives for the
     person's session, and the playground makes a new one when they pick another model or effort,
     so a verdict never outlives the model that gave it.
*/

let byCode: ReadonlyMap<string, ScenePreset> | undefined;

/** The catalogued preset whose code this is, byte for byte. */
function presetWithCode(code: string): ScenePreset | undefined {
  byCode ??= new Map(SCENE_PRESETS.map((preset) => [preset.code, preset]));
  return byCode.get(code);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The catalogued preset or kit whose code a scene section runs unchanged, its params (if any)
 * inside that preset's spec; undefined for code written or edited (see 1 above).
 */
export function testedScenePreset(section: LandedSection): ScenePreset | undefined {
  if (typeof section.js !== 'string') return undefined;
  const preset = presetWithCode(section.js);
  if (preset === undefined) return undefined;
  const params = section.jsParams ?? {};
  const inSpec = isRecord(params) && validateParamValues(preset.params, params).issues.length === 0;
  return inSpec ? preset : undefined;
}

/**
 * What a review's pictures were drawn from, hashed (see 2 above): the same section on the same
 * page, shown at the same sizes, has the same key.
 */
export function sceneReviewSourceKey(
  section: LandedSection,
  request: Omit<AiSceneReviewRequest, 'sourceKey'>,
): string {
  const pictures = [
    { view: 'desktop', width: request.image.width, height: request.image.height },
    ...(request.phone === undefined
      ? []
      : [{ view: 'phone', width: request.phone.width, height: request.phone.height }]),
  ];
  const source = canonicalJsonStringify({
    section: {
      tree: section.tree,
      css: section.css ?? '',
      js: section.js ?? '',
      jsParams: section.jsParams ?? null,
    },
    contract: request.contract,
    brief: request.brief ?? null,
    lang: request.lang,
    pictures,
  });
  return `${fnv1a64(source)}:${String(source.length)}`;
}

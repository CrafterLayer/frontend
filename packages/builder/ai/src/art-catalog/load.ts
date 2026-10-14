import { setArtRuntime } from './runtime';
import type { ArtCatalog } from './types';

/**
 * The art catalog, loaded on demand (art catalog, 2026-10-14).
 *
 * Tool expansion is synchronous (tools/agent/expand.ts), so the data cannot
 * be imported the moment a tool needs it. Instead the plan's judge, which is
 * async, looks at the model's answer first: an answer that names art
 * (`'logo:…'`, `'character:…'`, `'illustration:…'`) awaits
 * `loadArtCatalog()` before its steps expand (plan/generate-plan.ts), and an
 * answer that names none imports nothing. The import installs the resolver
 * the tools call (runtime.ts); a tool reached before it refuses with a
 * sentence to send the step again, and the repaired answer, which names art
 * too, loads it.
 */

let pending: Promise<ArtCatalog> | undefined;

/** Load (once) and build the catalog, and install its resolver; a failed chunk load may be retried. */
export function loadArtCatalog(): Promise<ArtCatalog> {
  pending ??= import('./catalog').then(
    ({ buildArtCatalog, artRuntimeOf }) => {
      const catalog = buildArtCatalog();
      setArtRuntime(artRuntimeOf(catalog));
      return catalog;
    },
    (cause: unknown) => {
      pending = undefined;
      throw cause;
    },
  );
  return pending;
}

/** An art spec's prefix, anywhere in a plan's text. */
const NAMES_ART = /(?:^|[^\p{L}\p{N}_-])(?:logo|character|illustration)\s*:/iu;

/** Whether a model's answer names art, so its judge should load the catalog first. */
export function planNamesArt(plan: unknown): boolean {
  if (plan === undefined || plan === null) return false;
  let text: string;
  try {
    text = typeof plan === 'string' ? plan : JSON.stringify(plan);
  } catch {
    return false;
  }
  return NAMES_ART.test(text);
}

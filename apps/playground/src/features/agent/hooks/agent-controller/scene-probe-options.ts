/**
 * The scene probe a free-code build runs each scene section through before it lands
 * (creative-power Phase 2 E): a written scene is run in a hidden sandboxed frame, and a
 * runtime error, a blank stage or a layout that leaves its region costs one repair round.
 * With `visualReview` (2026-10-13) the probe also takes a small picture of the desktop and
 * phone passes, and a provider that can see (the remote one) is shown it once per scene
 * section: what it sees wrong joins the same repair round. The probe takes the pictures only
 * when the build asks for them (`thumbnails` on the context it passes).
 */
import { createLiveUtilities, probeScene, type RunAiBuildOptions } from '@craftkit/builder';

/** Tailwind for the scene probe, started once on first use (without it, layout verdicts are skipped). */
let compiler: Promise<((names: Iterable<string>) => Promise<string>) | undefined> | undefined;

function compileProbeClasses(names: Iterable<string>): Promise<string> {
  compiler ??= import('tailwindcss/theme.css?raw')
    .then((theme) => createLiveUtilities({ tailwindThemeCss: theme.default }))
    .then(
      (live) => (classes: Iterable<string>) => live.compileFor(classes),
      () => undefined,
    );
  return compiler.then((compile) => {
    if (compile === undefined) throw new Error('Tailwind is unavailable here.');
    return compile(names);
  });
}

/** Free-code builds run each scene section before it lands. */
export function sceneProbeOptions(
  freeCode: boolean | undefined,
): Pick<RunAiBuildOptions, 'sceneProbe' | 'visualReview'> {
  return freeCode === true
    ? {
        sceneProbe: (section, context) =>
          probeScene({ section, ...context, compileClasses: compileProbeClasses }),
        visualReview: true,
      }
    : {};
}

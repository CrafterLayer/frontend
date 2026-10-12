/**
 * The scene probe a free-code build runs each scene section through before it lands
 * (creative-power Phase 2 E): a written scene is run in a hidden sandboxed frame, and a
 * runtime error, a blank stage or a layout that leaves its region costs one repair round.
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
): Pick<RunAiBuildOptions, 'sceneProbe'> {
  return freeCode === true
    ? {
        sceneProbe: (section, context) =>
          probeScene({ section, ...context, compileClasses: compileProbeClasses }),
      }
    : {};
}

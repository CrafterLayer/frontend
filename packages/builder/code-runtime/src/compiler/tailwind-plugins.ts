import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { compile } from 'tailwindcss';

/**
 * The Tailwind plugins a code project's `page.css` is compiled with: typography (`prose`) and
 * forms (`form-*`, class strategy, so no input is restyled until it asks). They are the region
 * pages' plugins too (the renderer's plugin layer), so a class means the same on both kinds of
 * page; a code project wears Tailwind's own theme, not the site tokens, so here they keep their
 * own palettes.
 *
 * They are part of the trusted compiler, never authored: `loadModule` hands out exactly these two
 * and refuses every other id, so authored CSS still cannot name a module and have it executed.
 * tw-animate-css is not here — a code project animates with the managed `motion/react` its lock
 * allows — so the compile ships no animation layer a page did not ask for.
 */
export const TAILWIND_PLUGIN_PREAMBLE = [
  "@plugin '@tailwindcss/typography';",
  "@plugin '@tailwindcss/forms' { strategy: 'class'; }",
].join('\n');

type LoadModule = NonNullable<NonNullable<Parameters<typeof compile>[1]>['loadModule']>;
type LoadedModule = Awaited<ReturnType<LoadModule>>;

const TRUSTED: Readonly<Record<string, LoadedModule['module']>> = {
  '@tailwindcss/typography': typography,
  '@tailwindcss/forms': forms,
};

/** Tailwind's `loadModule` hook: the two trusted plugins, and the old refusal for anything else. */
export const loadTrustedPlugin: LoadModule = (id, base) => {
  const module = Object.hasOwn(TRUSTED, id) ? TRUSTED[id] : undefined;
  return module === undefined
    ? Promise.reject(
        new Error('Authored Tailwind plugins and configuration modules are not allowed.'),
      )
    : Promise.resolve({ path: id, base, module });
};

/**
 * Everything the in-page compiler may load, in one module that is only ever reached by
 * `import()` from `createLiveUtilities`: a host that never starts the compiler downloads none of
 * the plugin layer, exactly like Tailwind itself.
 *
 * Every id is closed over here. `loadStylesheet` answers the host's sheets and the plugin
 * sheets by name, and `loadModule` hands out the door's two plugins and nothing else, so a
 * stylesheet cannot name a module and have it executed in the page.
 */
import type { compile } from 'tailwindcss';

import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

import {
  TAILWIND_PLUGIN_MODULES,
  TW_ANIMATE_STYLESHEET,
  buildTailwindAnimateCss,
  buildTailwindContentCss,
  type TailwindPluginModule,
} from './plugin-bridge';
import { TW_ANIMATE_CSS } from './tw-animate-source';

type CompileOptions = NonNullable<Parameters<typeof compile>[1]>;
type LoadedModule = Awaited<ReturnType<NonNullable<CompileOptions['loadModule']>>>;

/** The id the live compiler's entry imports the plugin layers by: animate, then content. */
export const PLUGIN_LAYER_STYLESHEET = 'craftkit/plugins.css';

/* Each package's `plugin.withOptions` export, which Tailwind v4 takes as it is. */
const MODULES: Readonly<Record<TailwindPluginModule, LoadedModule['module']>> = {
  '@tailwindcss/typography': typography,
  '@tailwindcss/forms': forms,
};

function isPluginModule(id: string): id is TailwindPluginModule {
  return (TAILWIND_PLUGIN_MODULES as readonly string[]).includes(id);
}

/** Tailwind's two loader hooks over `stylesheets` (by id) plus both plugin layers. */
export function compilerLoaders(
  stylesheets: Readonly<Record<string, string>>,
): Required<Pick<CompileOptions, 'loadModule' | 'loadStylesheet'>> {
  const sources: Readonly<Record<string, string>> = {
    ...stylesheets,
    [PLUGIN_LAYER_STYLESHEET]: "@import 'craftkit/animate.css';\n@import 'craftkit/content.css';",
    'craftkit/animate.css': buildTailwindAnimateCss(),
    'craftkit/content.css': buildTailwindContentCss(),
    [TW_ANIMATE_STYLESHEET]: TW_ANIMATE_CSS,
  };
  return {
    loadStylesheet: (id, base) => {
      const content = Object.hasOwn(sources, id) ? sources[id] : undefined;
      return content === undefined
        ? Promise.reject(new Error(`Live utilities cannot load the stylesheet "${id}".`))
        : Promise.resolve({ path: id, base, content });
    },
    loadModule: (id, base) =>
      isPluginModule(id)
        ? Promise.resolve({ path: id, base, module: MODULES[id] })
        : Promise.reject(new Error(`Live utilities load only their own plugins, not "${id}".`)),
  };
}

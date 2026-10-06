import type { BuilderDocument, BuilderSite } from '@craftkit/builder';

import { liveUtilityClasses } from '../preview/live-utility-classes';

/**
 * Which compiler writes the published site's utility CSS — and the refusal
 * when none can (style-manager DESIGN.md P11, "never silently drop classes").
 *
 * Every class the RENDERED pages carry is compiled, unscoped, by the
 * compiler's one-shot `compileFor` (Tailwind's theme plus the craftkit token
 * bridge): the registered blocks' utilities (`py-section-lg`, `bg-accent`,
 * `text-4xl`), the custom-code classes, and the named-style utilities the
 * exporter expands from `ck-s-<id>` markers at render time.
 *
 * Fix pass 2026-10-06: the export used to ship only the live sheet, which
 * holds custom-code classes scoped to `[data-ck-custom-code]` — so 262 of a
 * page's 289 classes had no rule and every registered block published as
 * plain unstyled text. The canvas styles registered blocks from the app's
 * static sheet, which a published site does not carry; one coherent compile
 * of what the page renders replaces both.
 *
 * The live sheet is the fallback only when no compiler can start; registered
 * blocks then have no source of CSS, so publishing stops with
 * {@link PublishCompileError} as soon as a page renders a class the live
 * sheet does not hold, instead of shipping pages that look unstyled.
 */

/** The `compileFor` half of `LiveUtilities`, all the exporter needs. */
export interface ExportClassCompiler {
  readonly compileFor: (classNames: Iterable<string>) => Promise<string>;
}

export class PublishCompileError extends Error {
  override readonly name = 'PublishCompileError';
}

export const PUBLISH_COMPILE_FAILED =
  'Publishing stopped: the page styles could not be compiled, so the published pages would have lost their classes. Nothing was published. Reload the editor and try again.';

export interface ExportCompilerInput {
  readonly site: Readonly<BuilderSite>;
  /** The text of the live utilities sheet ('' when there is none). */
  readonly liveSheet: string;
  /** The live compiler, or a fresh one; undefined when none could start. */
  readonly compiler: ExportClassCompiler | undefined;
}

export interface ExportCompilers {
  readonly compileCss: (document: BuilderDocument) => Promise<string>;
  readonly compileClasses: ((classNames: Iterable<string>) => Promise<string>) | undefined;
}

/** Every utility a named style of the site's library carries. */
export function namedStyleClasses(site: Readonly<BuilderSite>): ReadonlySet<string> {
  const names = new Set<string>();
  for (const style of Object.values(site.library?.styles ?? {})) {
    for (const name of style.className.split(/\s+/u)) if (name !== '') names.add(name);
  }
  return names;
}

/** Classes that are hooks, not utilities: no CSS of their own to compile. */
function isHookClass(name: string): boolean {
  return name.startsWith('ck-') || name.startsWith('bldr-') || /^(?:group|peer)(?:\/[\w-]+)?$/u.test(name);
}

/** The compilers `exportStaticSite` gets, or a {@link PublishCompileError}. */
export function exportCompilers(input: ExportCompilerInput): ExportCompilers {
  const treeClasses = liveUtilityClasses(input.site);
  const liveSheet = input.liveSheet.trim();
  const compiler = input.compiler;
  if (compiler !== undefined) {
    return {
      // Everything comes from the one compile below; the scoped live sheet would only duplicate it.
      compileCss: () => Promise.resolve(''),
      compileClasses: async (rendered: Iterable<string>): Promise<string> => {
        const names = [...new Set(rendered)].filter((name) => name !== '' && !isHookClass(name));
        if (names.length === 0) return '';
        try {
          return await compiler.compileFor(names);
        } catch (cause) {
          // These classes have no other source of CSS: stop rather than ship them unstyled.
          throw new PublishCompileError(PUBLISH_COMPILE_FAILED, { cause });
        }
      },
    };
  }
  const styleClasses = namedStyleClasses(input.site);
  if (treeClasses.size + styleClasses.size > 0 && liveSheet === '') {
    throw new PublishCompileError(PUBLISH_COMPILE_FAILED);
  }
  return {
    compileCss: () => Promise.resolve(liveSheet),
    compileClasses: (rendered: Iterable<string>): Promise<string> => {
      const uncovered = [...rendered].filter(
        (name) => name !== '' && !isHookClass(name) && !treeClasses.has(name),
      );
      return uncovered.length === 0
        ? Promise.resolve('')
        : Promise.reject(new PublishCompileError(PUBLISH_COMPILE_FAILED));
    },
  };
}

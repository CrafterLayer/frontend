import type {
  CustomCodeAttribute,
  CustomCodeElement,
  CustomCodeIcon,
  CustomCodeNode,
  CustomCodeRoot,
  CustomCodeTag,
} from '../custom-code/custom-code-tree';
import type { MediaBilingual } from '../custom-code/media-vocabulary';

/**
 * Shared shapes of the media recipes (media-motion DESIGN D10, 2026-10-06).
 *
 * A recipe is a PURE function: already-resolved inputs in, one custom-code tree
 * out. No I/O, no catalog, no locale lookup beyond the two strings it is handed.
 * The agent tools (`media.add`), the shell's Insert presets and the tests all
 * call the same builders, so the manual editor and the agent cannot drift.
 */

/** The page locales a recipe writes labels and direction for. */
export type MediaLocale = 'ar' | 'en';

/** One already-resolved image: a catalog photo, an upload, or an address from the request. */
export interface MediaImage {
  readonly src: string;
  /** Alt text in the page locale; `''` marks a decorative image. */
  readonly alt: string;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly srcset?: string | undefined;
  readonly sizes?: string | undefined;
  /** A visible caption, when the recipe shows captions (falls back to `alt`). */
  readonly caption?: string | undefined;
}

/** What a builder returns: the Layers / Undo label, the tree, and its region CSS. */
export interface MediaRecipe {
  readonly label: MediaBilingual;
  /**
   * A custom-code root. A standalone recipe holds ONE outer `<section>`; an
   * element-level recipe (a player, a layer, a facade) holds that one element,
   * ready for `insertTreeNode` (`mediaRecipeNode`).
   */
  readonly tree: CustomCodeRoot;
  /** Region CSS for the recipe's own `ck-` hooks; `''` when it needs none. */
  readonly css: string;
}

/** A builder that cannot build says why, as repair text. */
export interface MediaRecipeError {
  readonly error: string;
}

export type MediaRecipeResult = MediaRecipe | MediaRecipeError;

/** Whether a builder refused. */
export function isMediaRecipeError(result: MediaRecipeResult): result is MediaRecipeError {
  return 'error' in result;
}

/** The recipe's one top-level element (the section, or the element of an element-level recipe). */
export function mediaRecipeNode(recipe: MediaRecipe): CustomCodeElement {
  const node = recipe.tree.children[0];
  /* v8 ignore next 3 -- every builder returns exactly one element child. */
  if (node?.kind !== 'element') {
    throw new Error('A media recipe holds one element.');
  }
  return node;
}

/** The text for a locale. */
export function inLocale(locale: MediaLocale, text: MediaBilingual): string {
  return locale === 'ar' ? text.ar : text.en;
}

/** `lang` and `dir` for a standalone section, so the runtime labels and mirrors from the markup. */
export function localeAttributes(locale: MediaLocale): Record<'lang' | 'dir', string> {
  return locale === 'ar' ? { lang: 'ar', dir: 'rtl' } : { lang: 'en', dir: 'ltr' };
}

type Attributes = Partial<Record<CustomCodeAttribute, string | undefined>>;

/** One element node; empty class, attributes and children are left out. */
export function el(
  tag: CustomCodeTag,
  className: string | undefined,
  attributes?: Attributes,
  children?: readonly CustomCodeNode[],
  text?: string,
): CustomCodeElement {
  const node: CustomCodeElement = { kind: 'element', tag };
  if (className !== undefined && className.trim() !== '') node.className = className;
  if (attributes !== undefined) {
    const kept = Object.fromEntries(
      Object.entries(attributes).filter(([, value]) => typeof value === 'string'),
    ) as Attributes;
    if (Object.keys(kept).length > 0) node.attributes = kept;
  }
  if (children !== undefined && children.length > 0) node.children = [...children];
  if (text !== undefined && text !== '') node.text = text;
  return node;
}

/** One Lucide icon, decorative unless labelled. */
export function icon(name: string, size: number, className?: string): CustomCodeIcon {
  const node: CustomCodeIcon = { kind: 'icon', name, size };
  if (className !== undefined) node.className = className;
  return node;
}

/** A root holding one node. */
export function root(node: CustomCodeNode): CustomCodeRoot {
  return { kind: 'root', children: [node] };
}

/** Loading hints for one image. */
export interface ImageLoading {
  /** The image paints first (above the fold): eager and high priority. */
  readonly priority?: boolean | undefined;
  /** Decorative regardless of its alt (a scene texture, a poster behind a label). */
  readonly decorative?: boolean | undefined;
}

/** An `<img>` with intrinsic size, responsive sources and loading hints. */
export function imageNode(
  image: MediaImage,
  className: string,
  loading: ImageLoading = {},
): CustomCodeElement {
  return el('img', className, {
    src: image.src,
    alt: loading.decorative === true ? '' : image.alt,
    width: wholePixels(image.width),
    height: wholePixels(image.height),
    srcset: image.srcset,
    sizes: image.srcset === undefined ? undefined : (image.sizes ?? '100vw'),
    loading: loading.priority === true ? 'eager' : 'lazy',
    decoding: 'async',
    fetchpriority: loading.priority === true ? 'high' : undefined,
  });
}

function wholePixels(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return String(Math.min(99_999, Math.round(value)));
}

/** The heading levels a standalone recipe may title itself with. */
export type MediaHeading = 'h2' | 'h3';

/** Options every standalone recipe shares. */
export interface MediaSectionOptions {
  readonly locale: MediaLocale;
  readonly title?: string | undefined;
  readonly heading?: MediaHeading | undefined;
}

/** The standard media band: locale, rhythm, the container, an optional heading, then the body. */
export function mediaSection(
  options: MediaSectionOptions,
  body: readonly CustomCodeNode[],
  width: 'max-w-3xl' | 'max-w-4xl' | 'max-w-5xl' | 'max-w-6xl' = 'max-w-6xl',
): CustomCodeElement {
  const title = options.title?.trim() ?? '';
  const heading =
    title === ''
      ? []
      : [
          el(
            options.heading ?? 'h2',
            'mb-8 text-3xl font-bold leading-tight text-balance md:text-4xl',
            undefined,
            undefined,
            title,
          ),
        ];
  return el('section', 'bg-surface py-16 text-text md:py-24', localeAttributes(options.locale), [
    el('div', `mx-auto ${width} px-4 md:px-8`, undefined, [...heading, ...body]),
  ]);
}

/** Whether a string is safe to place in an attribute the door checks as an address. */
export function isPlainAddress(value: string): boolean {
  return value.length > 0 && value.length <= 2_000 && !/[\s"'<>\\`]/u.test(value);
}

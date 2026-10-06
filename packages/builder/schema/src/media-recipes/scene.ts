import type { CustomCodeNode } from '../custom-code/custom-code-tree';
import {
  CUSTOM_CODE_SCENE_INFO,
  CUSTOM_CODE_SCENES,
  SCENE_DENSITIES,
  SCENE_PALETTES,
  type CustomCodeScene,
  type SceneDensity,
  type ScenePalette,
} from '../custom-code/media-vocabulary';
import {
  el,
  imageNode,
  localeAttributes,
  mediaRecipeNode,
  root,
  type MediaHeading,
  type MediaImage,
  type MediaLocale,
  type MediaRecipeResult,
} from './types';

/**
 * Scene recipes (media-motion DESIGN §D.1, D8).
 *
 * A scene is a decorative layer: `div[data-ck-scene]`, `aria-hidden`, behind
 * the section's real HTML content (headings and calls to action stay text —
 * Arabic shaping, accessibility, SEO). The engine draws its own canvas inside
 * the div at runtime; the vocabulary never admits a `<canvas>`. The div's
 * `img` children are BOTH the fallback (no script, reduced motion, an engine
 * that never loads) AND the scene's textures: the first covers the layer, the
 * rest are hidden until the engine uses them.
 */

/** Scenes that draw from images: they need at least one. */
export const SCENES_NEEDING_IMAGES: readonly CustomCodeScene[] = ['parallax-layers', 'mural', 'ripple'];

/** The most textures one scene takes. */
export const SCENE_MAX_IMAGES = 6;

export interface SceneLayerOptions {
  readonly scene: CustomCodeScene;
  readonly density?: SceneDensity | undefined;
  readonly palette?: ScenePalette | undefined;
  readonly images?: readonly MediaImage[] | undefined;
  /** The layer sits behind the first screen: its fallback image loads eagerly. */
  readonly aboveFold?: boolean | undefined;
}

/** What a section must carry to host a scene layer as its first child. */
export const SCENE_HOST = { className: 'relative isolate overflow-hidden' } as const;

/** The scene layer alone (element-level): put it FIRST inside a `SCENE_HOST` section. */
export function buildSceneLayer(options: SceneLayerOptions): MediaRecipeResult {
  if (!(CUSTOM_CODE_SCENES as readonly string[]).includes(options.scene)) {
    return { error: `scene is one of ${CUSTOM_CODE_SCENES.join(', ')}` };
  }
  const density = options.density ?? 'medium';
  const palette = options.palette ?? 'theme';
  if (!(SCENE_DENSITIES as readonly string[]).includes(density)) {
    return { error: `density is one of ${SCENE_DENSITIES.join(', ')}` };
  }
  if (!(SCENE_PALETTES as readonly string[]).includes(palette)) {
    return { error: `palette is one of ${SCENE_PALETTES.join(', ')}` };
  }
  const images = (options.images ?? [])
    .filter((image) => image.src.trim() !== '')
    .slice(0, SCENE_MAX_IMAGES);
  if (images.length === 0 && SCENES_NEEDING_IMAGES.includes(options.scene)) {
    return { error: `the ${options.scene} scene draws from images: give at least one` };
  }
  const children: CustomCodeNode[] = images.map((image, at) =>
    at === 0
      ? imageNode(image, 'absolute inset-0 size-full object-cover', {
          decorative: true,
          priority: options.aboveFold === true,
        })
      : imageNode(image, 'hidden', { decorative: true }),
  );
  return {
    label: CUSTOM_CODE_SCENE_INFO[options.scene].label,
    tree: root(
      el(
        'div',
        'pointer-events-none absolute inset-0 -z-10',
        {
          'data-ck-scene': options.scene,
          'data-ck-density': density,
          'data-ck-palette': palette,
          'aria-hidden': 'true',
        },
        children,
      ),
    ),
    css: '',
  };
}

export interface SceneSectionOptions extends SceneLayerOptions {
  readonly locale: MediaLocale;
  readonly title?: string | undefined;
  readonly text?: string | undefined;
  readonly heading?: MediaHeading | undefined;
}

/**
 * A standalone section over a scene: the layer first, a shade over photos so
 * the text reads, then the real content. Without photos the section keeps the
 * surface colours (a particles or gradient scene draws in the theme's own).
 */
export function buildSceneSection(options: SceneSectionOptions): MediaRecipeResult {
  const layer = buildSceneLayer({ ...options, aboveFold: options.aboveFold ?? true });
  if ('error' in layer) return layer;
  const photographic = (options.images ?? []).some((image) => image.src.trim() !== '');
  const title = options.title?.trim() ?? '';
  const text = options.text?.trim() ?? '';
  const content: CustomCodeNode[] = [];
  if (title !== '') {
    content.push(
      el(
        options.heading ?? 'h2',
        'text-4xl font-bold leading-tight text-balance md:text-6xl',
        undefined,
        undefined,
        title,
      ),
    );
  }
  if (text !== '') {
    content.push(
      el(
        'p',
        photographic ? 'mt-4 text-lg text-white/80' : 'mt-4 text-lg text-text-muted',
        undefined,
        undefined,
        text,
      ),
    );
  }
  const children: CustomCodeNode[] = [mediaRecipeNode(layer)];
  if (photographic) {
    children.push(el('div', 'absolute inset-0 -z-10 bg-black/40', { 'aria-hidden': 'true' }));
  }
  children.push(el('div', 'relative mx-auto max-w-4xl px-4 text-center md:px-8', undefined, content));
  return {
    label: layer.label,
    tree: root(
      el(
        'section',
        `${SCENE_HOST.className} py-32 md:py-48 ${photographic ? 'bg-black text-white' : 'bg-surface text-text'}`,
        localeAttributes(options.locale),
        children,
      ),
    ),
    css: '',
  };
}

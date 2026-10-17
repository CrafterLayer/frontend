import type { CustomCodeNode } from '../custom-code/custom-code-tree';
import {
  HOSTED_SCENES,
  isHostedScene,
  SCENE_DENSITIES,
  SCENE_PALETTES,
  type HostedScene,
  type SceneDensity,
  type ScenePalette,
} from '../custom-code/media-vocabulary';
import { SCENE_HOST } from './scene';
import { el, icon, inLocale, localeAttributes, root, type MediaLocale, type MediaRecipeResult } from './types';

/**
 * Motion sections (gsap-pixi, 2026-10-08): whole sections that MOVE, built from
 * the engine markers alone, for the Library presets ("Animated hero", "Scroll
 * reveal features", "Scroll reveal section") and for the agent to reuse.
 *
 * - The animated hero carries a HOSTED scene (particles, mesh-gradient) on the
 *   section itself (`data-ck-scene` on `<section>`: the engine draws its own
 *   layer behind the content at runtime, nothing to keep in the tree), or the
 *   classic `div` layer as its first child when `layer` is asked for.
 * - Every animated element names a timeline recipe (`data-ck-timeline`): the
 *   heading `split-reveal` (words, never letters — Arabic stays joined), the
 *   text and the call to action `fade-in`, a card grid `stagger-in`.
 *
 * Classes are logical and colours are theme tokens, so the sections follow the
 * site's design system and mirror in Arabic. Every output passes
 * `mediaRecipeProblems` (the builders' tests assert it).
 */

/** A call to action under a motion section's text. */
export interface MotionSectionAction {
  readonly label: string;
  readonly href?: string | undefined;
}

export interface AnimatedHeroOptions {
  readonly locale: MediaLocale;
  readonly title: string;
  readonly text?: string | undefined;
  readonly action?: MotionSectionAction | undefined;
  /** The hero's heading level: `h1` (a page's first screen) or `h2` (a later band). */
  readonly heading?: 'h1' | 'h2' | undefined;
  readonly scene?: HostedScene | undefined;
  readonly density?: SceneDensity | undefined;
  readonly palette?: ScenePalette | undefined;
  /** Put the scene on a classic `div` layer (first child) instead of the section itself. */
  readonly layer?: boolean | undefined;
}

const ACTION_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 font-semibold text-accent-text transition hover:opacity-90';

function action(value: MotionSectionAction): CustomCodeNode {
  return el('a', ACTION_CLASS, { href: value.href ?? '#' }, undefined, value.label);
}

function trimmed(value: string | undefined): string {
  return value?.trim() ?? '';
}

/**
 * A hero over a moving canvas background: the scene behind, then the heading
 * (split reveal), the line under it and the call to action (fade in).
 */
export function buildAnimatedHero(options: AnimatedHeroOptions): MediaRecipeResult {
  const scene = options.scene ?? 'particles';
  if (!isHostedScene(scene)) return { error: `scene is one of ${HOSTED_SCENES.join(', ')}` };
  const density = options.density ?? 'medium';
  const palette = options.palette ?? 'theme';
  if (!(SCENE_DENSITIES as readonly string[]).includes(density)) {
    return { error: `density is one of ${SCENE_DENSITIES.join(', ')}` };
  }
  if (!(SCENE_PALETTES as readonly string[]).includes(palette)) {
    return { error: `palette is one of ${SCENE_PALETTES.join(', ')}` };
  }
  const title = trimmed(options.title);
  if (title === '') return { error: 'an animated hero needs a title' };
  const text = trimmed(options.text);
  const sceneAttributes = { 'data-ck-scene': scene, 'data-ck-density': density, 'data-ck-palette': palette };

  const content: CustomCodeNode[] = [
    el(
      options.heading ?? 'h1',
      'text-4xl font-bold leading-tight text-balance md:text-6xl',
      { 'data-ck-timeline': 'split-reveal' },
      undefined,
      title,
    ),
  ];
  if (text !== '') {
    content.push(el('p', 'mt-4 text-lg text-text-muted', { 'data-ck-timeline': 'fade-in' }, undefined, text));
  }
  if (options.action !== undefined && trimmed(options.action.label) !== '') {
    content.push(
      el('div', 'mt-8 flex justify-center', { 'data-ck-timeline': 'fade-in' }, [
        action({ ...options.action, label: trimmed(options.action.label) }),
      ]),
    );
  }
  const body = el('div', 'relative mx-auto max-w-4xl px-4 text-center md:px-8', undefined, content);
  const children: CustomCodeNode[] =
    options.layer === true
      ? [el('div', 'pointer-events-none absolute inset-0 -z-10', { ...sceneAttributes, 'aria-hidden': 'true' }), body]
      : [body];
  return {
    label: { ar: 'هيرو متحرك', en: 'Animated hero' },
    tree: root(
      el(
        'section',
        `${SCENE_HOST.className} bg-surface py-32 text-text md:py-48`,
        options.layer === true
          ? localeAttributes(options.locale)
          : { ...localeAttributes(options.locale), ...sceneAttributes },
        children,
      ),
    ),
    css: '',
  };
}

/** One card of a scroll-reveal grid. */
export interface MotionSectionCard {
  readonly title: string;
  readonly text?: string | undefined;
  /** A Lucide icon name; the card shows none when absent. */
  readonly icon?: string | undefined;
}

export interface ScrollRevealFeaturesOptions {
  readonly locale: MediaLocale;
  readonly title: string;
  readonly text?: string | undefined;
  /** 2-6 cards; three placeholder cards in the page language when absent. */
  readonly cards?: readonly MotionSectionCard[] | undefined;
}

const MAX_CARDS = 6;
const DEFAULT_ICONS = ['sparkles', 'shield-check', 'zap'] as const;

function defaultCards(locale: MediaLocale): readonly MotionSectionCard[] {
  return [1, 2, 3].map((n, at) => ({
    title: inLocale(locale, { ar: `ميزة ${String(n)}`, en: `Feature ${String(n)}` }),
    text: inLocale(locale, { ar: 'سطران يشرحان الفكرة.', en: 'Two lines that explain the idea.' }),
    icon: DEFAULT_ICONS[at],
  }));
}

function card(value: MotionSectionCard): CustomCodeNode {
  const children: CustomCodeNode[] = [];
  if (value.icon !== undefined) children.push(icon(value.icon, 28, 'text-accent'));
  children.push(el('h3', 'text-xl font-semibold', undefined, undefined, value.title.trim()));
  const text = trimmed(value.text);
  if (text !== '') children.push(el('p', 'text-sm text-text-muted', undefined, undefined, text));
  return el('article', 'flex flex-col gap-3 rounded-2xl border border-text/15 bg-surface p-6', undefined, children);
}

/** A heading that fades in over a grid of cards that enter one after another. */
export function buildScrollRevealFeatures(options: ScrollRevealFeaturesOptions): MediaRecipeResult {
  const title = trimmed(options.title);
  if (title === '') return { error: 'a scroll reveal section needs a title' };
  const cards = (options.cards ?? defaultCards(options.locale)).filter((entry) => entry.title.trim() !== '');
  if (cards.length < 2 || cards.length > MAX_CARDS) {
    return { error: `a scroll reveal grid holds 2-${String(MAX_CARDS)} cards with a title` };
  }
  const text = trimmed(options.text);
  const head: CustomCodeNode[] = [
    el('h2', 'text-3xl font-bold leading-tight text-balance md:text-4xl', { 'data-ck-timeline': 'fade-in' }, undefined, title),
  ];
  if (text !== '') {
    head.push(el('p', 'mt-4 max-w-2xl text-lg text-text-muted', { 'data-ck-timeline': 'fade-in' }, undefined, text));
  }
  return {
    label: { ar: 'مميزات بحركة ظهور', en: 'Scroll reveal features' },
    tree: root(
      el('section', 'bg-surface py-16 text-text md:py-24', localeAttributes(options.locale), [
        el('div', 'mx-auto max-w-6xl px-4 md:px-8', undefined, [
          el('div', 'mb-10', undefined, head),
          el(
            'div',
            'grid gap-6 sm:grid-cols-2 md:grid-cols-3',
            { 'data-ck-timeline': 'stagger-in' },
            cards.map(card),
          ),
        ]),
      ]),
    ),
    css: '',
  };
}

export interface ScrollRevealSectionOptions {
  readonly locale: MediaLocale;
  readonly title: string;
  readonly text?: string | undefined;
  readonly action?: MotionSectionAction | undefined;
}

/** A plain band whose heading, text and call to action enter in sequence. */
export function buildScrollRevealSection(options: ScrollRevealSectionOptions): MediaRecipeResult {
  const title = trimmed(options.title);
  if (title === '') return { error: 'a scroll reveal section needs a title' };
  const text = trimmed(options.text);
  const content: CustomCodeNode[] = [
    el('h2', 'text-3xl font-bold leading-tight text-balance md:text-4xl', undefined, undefined, title),
  ];
  if (text !== '') content.push(el('p', 'text-lg leading-relaxed text-text-muted', undefined, undefined, text));
  if (options.action !== undefined && trimmed(options.action.label) !== '') {
    content.push(el('div', 'pt-2', undefined, [action({ ...options.action, label: trimmed(options.action.label) })]));
  }
  return {
    label: { ar: 'قسم بحركة ظهور', en: 'Scroll reveal section' },
    tree: root(
      el('section', 'bg-surface py-16 text-text md:py-24', localeAttributes(options.locale), [
        el(
          'div',
          'mx-auto flex max-w-3xl flex-col gap-4 px-4 md:px-8',
          { 'data-ck-timeline': 'stagger-in' },
          content,
        ),
      ]),
    ),
    css: '',
  };
}

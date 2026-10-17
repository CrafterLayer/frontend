/**
 * The everyday site behaviours (2026-10-13): the interactions business, landing and portfolio
 * pages ask for every day, each NAMED by a tree with `data-ck-behavior` and run by a small,
 * audited pack in the renderer (`behaviors/packs/<name>.ts`), shipped only to the pages that
 * name it. The agent writes an attribute; it never writes the script.
 *
 *   back-to-top  a or button: hidden until a screen down; smooth jump, focus to the top
 *   read-more    a text clamped to 4 lines (css --ck-lines) + a `hidden` button that opens it
 *   scroll-spy   a nav whose #links get aria-current for the section in view; anchors land
 *                below the sticky header, smoothly, and close the phone-menu popover
 *   typed-words  a span whose child words are typed in turn (the first shown, the rest hidden)
 *   filter       buttons with data-ck-filter='<group>|all' over items with data-ck-filter='<groups>'
 *   dismiss      a notice whose last (`hidden`) button closes it for good in this browser
 *
 * Everything the existing vocabulary already covered stays where it is: counters (`count-up`,
 * `ticker`, Arabic-Indic digits), `countdown`, `marquee`, `tabs`, `sticky-header`, `copy-text`,
 * a single-image `lightbox`, `carousel`, `gallery`, the scroll progress bar
 * (`data-ck-motion='reading-progress'`) and the `typewriter` / `word-rotate` text presets.
 *
 * The tree door (`custom-code-tree.ts`) admits these names, binds two of them to their tags and
 * judges the one part attribute, `data-ck-filter`; it reads the whole behaviour enum from here.
 */
import {
  CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS,
  CUSTOM_CODE_MEDIA_BEHAVIOR_TAGS,
  CUSTOM_CODE_MEDIA_BEHAVIORS,
} from './media-vocabulary';

export const CUSTOM_CODE_SITE_BEHAVIORS = [
  'back-to-top',
  'read-more',
  'scroll-spy',
  'typed-words',
  'filter',
  'dismiss',
] as const;

export type CustomCodeSiteBehavior = (typeof CUSTOM_CODE_SITE_BEHAVIORS)[number];

/** The tags a site behaviour may sit on, where it has to be one (the door names the fix). */
export const CUSTOM_CODE_SITE_BEHAVIOR_TAGS: Readonly<
  Partial<Record<CustomCodeSiteBehavior, readonly string[]>>
> = {
  'back-to-top': ['a', 'button'],
  'typed-words': ['span'],
};

/**
 * The site behaviours a tree may name with `data-ck-behavior` — a closed
 * enum. Each is a few lines of vanilla script in the renderer's
 * `mountBehaviors`, progressive enhancement over native HTML and CSS: the
 * content reads without it, and `prefers-reduced-motion` stills the motion.
 *
 * Moved here from custom-code-tree.ts (2026-10-13), which re-exports it with its params and
 * `isCustomCodeBehavior`: the core runtime's behaviours, the media ones and the everyday ones.
 */
export const CUSTOM_CODE_BEHAVIORS = [
  'reveal',
  'stagger',
  'count-up',
  'countdown',
  'marquee',
  'carousel',
  'tabs',
  'sticky-header',
  'lightbox',
  'whatsapp-form',
  'copy-text',
  // Added 2026-10-05 (style-manager DESIGN §B.1): rolling digits, FLIP layout.
  'ticker',
  'layout',
  // media-motion (2026-10-06): gallery, video, embed facade and widgets (DESIGN §A, §B, §E).
  ...CUSTOM_CODE_MEDIA_BEHAVIORS,
  // everyday site behaviours (2026-10-13): above.
  ...CUSTOM_CODE_SITE_BEHAVIORS,
] as const;

export type CustomCodeBehavior = (typeof CUSTOM_CODE_BEHAVIORS)[number];

/** The behaviour params: each means something only beside a `data-ck-behavior`. */
export const CUSTOM_CODE_BEHAVIOR_PARAMS = [
  'data-ck-to',
  'data-ck-until',
  'data-ck-speed',
  'data-ck-phone',
  'data-ck-text',
  // media-motion (2026-10-06): carousel indicator/autoplay, mailto address.
  ...CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS,
] as const;

const BEHAVIOR_SET: ReadonlySet<string> = new Set<string>(CUSTOM_CODE_BEHAVIORS);

/** Whether a value names a behaviour in the closed enum. */
export function isCustomCodeBehavior(value: string): value is CustomCodeBehavior {
  return BEHAVIOR_SET.has(value);
}

/** The `data-ck-behavior` rule: a name in the closed enum. */
export const behaviorValue = (value: string, name: string): string | undefined =>
  BEHAVIOR_SET.has(value) ? undefined : `${name} is one of ${CUSTOM_CODE_BEHAVIORS.join(', ')}`;

/** Behaviours bound to a tag: the WhatsApp form sends from a form or its button. */
export const BEHAVIOR_TAGS: Readonly<Partial<Record<CustomCodeBehavior, readonly string[]>>> = {
  'whatsapp-form': ['form', 'button'],
  // media-motion (2026-10-06): the video player, facade and mailto form are tag-bound too.
  ...CUSTOM_CODE_MEDIA_BEHAVIOR_TAGS,
  // everyday site behaviours (2026-10-13): back-to-top on a link or button, typed-words on a span.
  ...CUSTOM_CODE_SITE_BEHAVIOR_TAGS,
};

/**
 * Part markers: on DESCENDANTS of the element carrying the behaviour (a filter's buttons and
 * items). The door admits them on any html element; the runtime ignores them elsewhere.
 */
export const CUSTOM_CODE_SITE_PART_ATTRIBUTES = ['data-ck-filter'] as const;

/** One filter group: 1-32 letters, digits, `_` or `-` (any script). */
const GROUP = /^[\p{L}\p{N}_-]{1,32}$/u;

/**
 * `data-ck-filter`: on a `<button>` exactly one group (or `all`); on an item 1-6 groups
 * separated by single spaces.
 */
export function filterAttributeProblem(
  value: string,
  name: string,
  tag: string,
): string | undefined {
  if (tag === 'button') {
    return GROUP.test(value)
      ? undefined
      : `${name} on a button names one group, such as web, or all`;
  }
  const groups = value.split(' ');
  return groups.length <= 6 && groups.every((group) => GROUP.test(group))
    ? undefined
    : `${name} lists 1-6 groups of letters, digits, _ or -, separated by single spaces, such as 'web print'`;
}

function elementsOf(children: readonly unknown[]): readonly Readonly<Record<string, unknown>>[] {
  return children.filter(
    (child): child is Readonly<Record<string, unknown>> =>
      typeof child === 'object' &&
      child !== null &&
      (child as Record<string, unknown>)['kind'] === 'element',
  );
}

function isHidden(node: Readonly<Record<string, unknown>>): boolean {
  const attributes = node['attributes'];
  return (
    typeof attributes === 'object' &&
    attributes !== null &&
    typeof (attributes as Record<string, unknown>)['hidden'] === 'string'
  );
}

/**
 * What a site behaviour needs of its own element and children, or undefined when it has it: the
 * shape its pack reads, which is also the view without script and on the editing canvas. Tolerant:
 * it reads an unvalidated element (`attributes`, `children`) and names the fix.
 */
export function siteBehaviorShapeProblem(
  behavior: string,
  tag: string,
  attributes: Readonly<Record<string, unknown>>,
  children: readonly unknown[],
): string | undefined {
  const elements = elementsOf(children);
  if (behavior === 'back-to-top' && tag === 'a') {
    const href = attributes['href'];
    return typeof href === 'string' && href.startsWith('#')
      ? undefined
      : "<a> data-ck-behavior='back-to-top' points at the page's start: write href='#top'";
  }
  if (behavior === 'read-more') {
    const first = elements[0];
    const last = elements[elements.length - 1];
    return first !== undefined &&
      first !== last &&
      first['tag'] !== 'button' &&
      last?.['tag'] === 'button'
      ? undefined
      : `<${tag}> data-ck-behavior='read-more' holds the text first and its button last: div > p … + button type='button' hidden 'Read more'`;
  }
  if (behavior === 'typed-words') {
    const words = elements.every(
      (word) => typeof word['text'] === 'string' && word['text'].trim() !== '',
    );
    return elements.length >= 2 && words && elements.slice(1).every(isHidden)
      ? undefined
      : `<${tag}> data-ck-behavior='typed-words' holds two or more word spans, every one after the first hidden: span > span 'websites' + span hidden 'shops'`;
  }
  return undefined;
}

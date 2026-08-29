/**
 * The page's motion vocabulary.
 *
 * Motion is DATA, for the same reason colour and spacing are. A block that
 * stores `duration: 300` has hard-coded a literal exactly the way
 * `padding: '16px'` does, and `style-values.ts` exists to refuse that. So the
 * scales below are named steps; the extension that renders them owns what each
 * step is worth, and re-pointing one step retimes every animation on the site.
 *
 * This lives at layer 0 rather than in the motion extension because the AI
 * planner (layer 2) has to be able to EMIT motion and have it validated at the
 * door, and because a document carrying motion must round-trip whether or not
 * any animation engine is loaded. The extension is the renderer, not the owner.
 */
import { z } from 'zod';

/**
 * What a section does as it enters the viewport.
 *
 * A closed union, not a free string: the AI may only choose from effects that
 * exist, so an invented name is a validation failure rather than a section that
 * silently never animates.
 */
export const REVEAL_EFFECTS = [
  'none',
  'fade',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'zoom-in',
  'zoom-out',
  'blur-in',
] as const;
export type RevealEffect = (typeof REVEAL_EFFECTS)[number];

/**
 * What a section does as the viewport scrolls THROUGH it — the scroll-scrubbed
 * family. Distinct from reveal: a reveal fires once on entry, a scroll effect
 * is driven continuously by scroll position.
 */
export const SCROLL_EFFECTS = [
  'none',
  'parallax-slow',
  'parallax-fast',
  'scale-on-scroll',
  'fade-on-scroll',
  'blur-on-scroll',
  /** Holds the section while the page scrolls past it. */
  'pin',
  /** Wipes content in proportion to scroll progress. */
  'scrub-reveal',
] as const;
export type ScrollEffect = (typeof SCROLL_EFFECTS)[number];

/** Named steps, never milliseconds. See the note at the top of this file. */
export const MOTION_DURATIONS = ['instant', 'fast', 'normal', 'slow', 'deliberate'] as const;
export type MotionDuration = (typeof MOTION_DURATIONS)[number];

export const MOTION_DELAYS = ['none', 'short', 'medium', 'long'] as const;
export type MotionDelay = (typeof MOTION_DELAYS)[number];

export const MOTION_EASINGS = ['linear', 'ease-out', 'ease-in-out', 'spring', 'bounce'] as const;
export type MotionEasing = (typeof MOTION_EASINGS)[number];

/** How much later each child starts than the one before it. */
export const MOTION_STAGGERS = ['none', 'tight', 'normal', 'loose'] as const;
export type MotionStagger = (typeof MOTION_STAGGERS)[number];

/**
 * One node's complete motion intent.
 *
 * Every field is optional and every omission means "still". A section that says
 * nothing about motion does not animate, which is the correct default: motion
 * is something a page opts into.
 */
/*
  Each optional field is written `?: T | undefined` rather than `?: T`. The
  workspace compiles with `exactOptionalPropertyTypes`, under which `?: T`
  means "may be absent, but never the value undefined" — and zod's `.optional()`
  produces exactly `T | undefined`. Without the explicit union the schema below
  cannot be typed as producing this interface at all.
*/
export interface MotionSpec {
  reveal?: RevealEffect | undefined;
  scroll?: ScrollEffect | undefined;
  duration?: MotionDuration | undefined;
  delay?: MotionDelay | undefined;
  easing?: MotionEasing | undefined;
  /** Applies to the node's children, so a feature grid can cascade. */
  stagger?: MotionStagger | undefined;
  /**
   * Replay the reveal every time the node re-enters the viewport.
   *
   * Defaults to false. A page whose every section re-animates on the way back
   * up reads as restless rather than alive, and it is the single most common
   * way scroll animation makes a professional site feel cheap.
   */
  repeat?: boolean | undefined;
}

export const motionSpecSchema: z.ZodType<MotionSpec> = z.strictObject({
  reveal: z.enum(REVEAL_EFFECTS).optional(),
  scroll: z.enum(SCROLL_EFFECTS).optional(),
  duration: z.enum(MOTION_DURATIONS).optional(),
  delay: z.enum(MOTION_DELAYS).optional(),
  easing: z.enum(MOTION_EASINGS).optional(),
  stagger: z.enum(MOTION_STAGGERS).optional(),
  repeat: z.boolean().optional(),
});

/**
 * The prop name a block uses to carry motion.
 *
 * Named once here so the renderer, the planner, and the inspector cannot
 * disagree about where motion lives.
 */
export const MOTION_PROP = 'motion';

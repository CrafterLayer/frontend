import { useReducedMotion, useScroll, useTransform, motion as motionEngine } from 'motion/react';
import { Children, cloneElement, isValidElement, useRef, type ReactNode } from 'react';

import type { MotionSpec } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

export interface MotionStageProps {
  /** The validated motion intent. Absent or empty means the stage does nothing. */
  spec?: MotionSpec | undefined;
  children: ReactNode;
  /** Extra classes from the block. Merged after the motion class. */
  className?: string | undefined;
}

/**
 * The upgrade path for the two things CSS genuinely cannot do.
 *
 * Almost all motion in this product is plain CSS on an `animation-timeline:
 * view()` — see `@craftkit/builder-renderer/motion.css`. That baseline needs no
 * engine, which is what lets the publish path animate a page without loading
 * one. This component exists only for the remainder:
 *
 * 1. **Pinning.** Holding a section still while the page scrolls past it has no
 *    CSS expression, so `scroll: 'pin'` is deliberately absent from the
 *    stylesheet rather than present and inert.
 * 2. **Stagger indices.** A cascade needs each child to know its own position.
 *    `sibling-index()` would express it, but it is not portable yet, so the
 *    index is set here as a custom property the stylesheet's `calc()` reads.
 *
 * Everything else passes straight through to the CSS baseline. A stage asked
 * for neither pinning nor stagger renders exactly one plain element and touches
 * no engine API.
 */
export function MotionStage({ spec, children, className }: MotionStageProps) {
  const container = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  /*
    Hooks run unconditionally, before any early return — the Rules of React do
    not bend for an optional feature. `useScroll` with no target is cheap, and
    the values below are simply unused when the stage is not pinning.
  */
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end start'],
  });
  const pinnedY = useTransform(scrollYProgress, [0, 1], ['0%', '-100%']);

  const attributes = motionAttributes(spec);
  const composedClassName = [attributes['class'], className].filter(Boolean).join(' ') || undefined;
  const dataAttributes = Object.fromEntries(
    Object.entries(attributes).filter(([key]) => key !== 'class'),
  );

  const staggered =
    spec?.stagger === undefined || spec.stagger === 'none'
      ? children
      : Children.map(children, (child, index) =>
          isValidElement<{ style?: React.CSSProperties }>(child)
            ? cloneElement(child, {
                style: { ...child.props.style, ['--stagger-index' as string]: index },
              })
            : child,
        );

  /*
    A person who has asked for reduced motion gets the content, still. Pinning
    is motion — arguably the most disorienting kind — so the preference removes
    it rather than softening it.
  */
  const shouldPin = spec?.scroll === 'pin' && prefersReducedMotion !== true;

  if (!shouldPin) {
    return (
      <div ref={container} className={composedClassName} {...dataAttributes}>
        {staggered}
      </div>
    );
  }

  return (
    <div ref={container} className={composedClassName} {...dataAttributes}>
      <motionEngine.div style={{ y: pinnedY, position: 'sticky', top: 0 }}>
        {staggered}
      </motionEngine.div>
    </div>
  );
}

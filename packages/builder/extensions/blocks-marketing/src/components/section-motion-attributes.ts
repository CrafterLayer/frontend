import { motionAttributes } from '@craftkit/builder-renderer';

import type { SectionMotionProps } from './section-motion';

/**
 * The render half of section motion, kept apart from the vocabulary half.
 *
 * `section-motion.ts` is reached by every marketing SCHEMA, and a schema graph
 * that touches `@craftkit/builder-renderer` cannot be loaded by a Node service
 * — the renderer reads DOM globals. Before this split, one value import here
 * meant the entire block catalog was browser-only, so an MCP server or an eval
 * harness had to validate documents against a six-block test fixture and call
 * it the product. The vocabulary is data and belongs to everyone; turning it
 * into DOM attributes belongs to the components alone.
 *
 * `schemas.node.test.ts` walks the barrel's real import graph and fails if this
 * separation is ever undone.
 */
/**
 * The DOM attributes a section applies for its chosen motion.
 *
 * Deliberately a thin pass-through to the renderer's `motionAttributes` rather
 * than a second implementation: the mapping from spec to attributes is the same
 * one the AI-generated path uses, and a block that computed its own would be a
 * second place for the two to drift.
 *
 * Returns an empty object when nothing is chosen, so a still section carries no
 * motion class and the reduced-motion and no-timeline fallback rules have
 * nothing to match on it.
 */
export function sectionMotionAttributes(props: SectionMotionProps): Record<string, string> {
  return motionAttributes(props.motion);
}

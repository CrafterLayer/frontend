/*
  @craftkit/builder-motion — the CONTAINED animation engine (layer 4).

  Read this before importing anything here: you probably do not need it.
  Reveals and every scroll effect except pinning are plain CSS in
  `@craftkit/builder-renderer/motion.css`, driven by an `animation-timeline:
  view()`. That baseline runs on the compositor, loads no JavaScript, and is
  what lets the publish path and static output animate a page without an engine
  at all.

  `motion` may be declared ONLY in this package — `check:workspace` fails any
  other member that names it, including through an npm alias, by the same rule
  that contains the rich-text editor.

  ## Why this file imports nothing eagerly

  A static `export { MotionStage } from './MotionStage'` would put the engine in
  the module graph of every consumer of this package — and therefore of the
  preset, and therefore of every application. Containment would hold on paper
  (the manifest is legal, the import graph is clean) while every published page
  downloaded an engine it does not use. That is the failure this whole
  arrangement exists to prevent, so the only door here is a DYNAMIC one, exactly
  as the code-view panel is reached through `load: () => import(...)`.

  Need the component eagerly — in a story, a test, or an app that pins on every
  page? Import `@craftkit/builder-motion/stage` and pay for it deliberately.
*/
import type { MotionStageProps } from './MotionStage';

export type { MotionStageProps };

/**
 * Load the stage on demand.
 *
 * Call this only when a page actually asks for `scroll: 'pin'` or a stagger.
 * The returned component is suitable for `React.lazy`:
 *
 * ```tsx
 * const Stage = lazy(async () => ({ default: await loadMotionStage() }));
 * ```
 */
export async function loadMotionStage(): Promise<
  (props: MotionStageProps) => React.ReactElement | null
> {
  const module = await import('./MotionStage');
  return module.MotionStage;
}

/**
 * Whether a spec needs the engine at all.
 *
 * The honest answer is almost always no, and asking cheaply is what keeps the
 * dynamic import from firing on pages that the stylesheet already handles.
 * Pinning has no CSS expression; a stagger needs each child's index, which CSS
 * cannot portably supply. Everything else is already running.
 */
export function needsMotionEngine(
  spec: { scroll?: string; stagger?: string } | undefined,
): boolean {
  if (spec === undefined) {
    return false;
  }
  const staggers = spec.stagger !== undefined && spec.stagger !== 'none';
  return spec.scroll === 'pin' || staggers;
}

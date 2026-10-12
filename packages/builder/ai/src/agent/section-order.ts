/**
 * Which section a free writer takes next (creative-power Phase 1 B,
 * 2026-10-12): a scene before anything else, otherwise page order.
 *
 * A scene — a section whose writer writes page code — is the slowest write of
 * a build, so starting it first lets the rest of the page be written while it
 * runs instead of after it. The number of writers is unchanged; only who goes
 * first. And a scene never takes the place of a section above it that the
 * task limit would then leave unstarted: it jumps the queue only within the
 * sections the limit lets start anyway (`room` of the ones not yet counted).
 */

export interface OpenSection {
  /** Its index on the page (and in the job list). */
  readonly index: number;
  /** Counted against the task limit already (a rerun of a section that started before). */
  readonly counted: boolean;
  /** Whether its writer writes a scene. Read only when it could matter. */
  readonly scene: () => boolean;
}

/** The index to start next among `open` (page order), or `undefined` when none is open. */
export function nextSection(open: readonly OpenSection[], room: number): number | undefined {
  let left = room;
  const startable = open.filter(({ counted }) => {
    if (counted) return true;
    left -= 1;
    return left >= 0;
  });
  return (startable.find(({ scene }) => scene()) ?? open[0])?.index;
}

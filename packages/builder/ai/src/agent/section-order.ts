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
 *
 * Scenes never hold every writer (P2, 2026-11-01). A scene writes, is probed,
 * reviewed and repaired: minutes. On a games or murals page every writer could
 * be on a scene and nothing would reach the page for minutes. While a quick
 * section is waiting, scenes take at most all writers but one
 * (`sceneSlotsLeft`), so one quick section always moves. One writer keeps the
 * old order: a scene first.
 */

export interface OpenSection {
  /** Its index on the page (and in the job list). */
  readonly index: number;
  /** Counted against the task limit already (a rerun of a section that started before). */
  readonly counted: boolean;
  /** Whether its writer writes a scene. Read only when it could matter. */
  readonly scene: () => boolean;
}

/**
 * How many more scene writers may start: all writers but one, less the scenes
 * writing now. One writer has no limit (there is no other writer to keep free).
 */
export function sceneSlotsLeft(writers: number, scenesWriting: number): number {
  return writers <= 1 ? Number.POSITIVE_INFINITY : Math.max(0, writers - 1 - scenesWriting);
}

/**
 * The index to start next among `open` (page order), or `undefined` when none is open.
 * `sceneSlots` (`sceneSlotsLeft`): with none left, a quick section the limit lets start
 * goes first, and a scene takes the writer only when no such section is waiting.
 */
export function nextSection(
  open: readonly OpenSection[],
  room: number,
  sceneSlots = Number.POSITIVE_INFINITY,
): number | undefined {
  let left = room;
  const startable = open.filter(({ counted }) => {
    if (counted) return true;
    left -= 1;
    return left >= 0;
  });
  const pick =
    sceneSlots > 0
      ? startable.find(({ scene }) => scene())
      : startable.find(({ scene }) => !scene());
  return (pick ?? open[0])?.index;
}

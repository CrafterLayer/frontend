import { useCallback, useMemo, type RefObject } from 'react';

import { removeUnfilledSections, revertBuildSection } from '@craftkit/builder';

import type { AgentLocale } from '../AgentFace';
import type { BuildCardSeam } from '../BuildReportCard';
import type { BuildNotice } from './AssistantPanel.build';
import { preflightPorts, revertRefusalOf } from './AssistantPanel.runs';
import type { BuiltTurn, Turn } from './AssistantPanel.turns';
import type { AssistantMode } from './AssistantPanel.modes';
import type { BuildRecord } from './AssistantPanel.types';

const NO_NOTICES: readonly BuildNotice[] = [];

export interface BuildReportActionsInputs {
  locale: AgentLocale;
  panelMode: AssistantMode;
  turns: readonly Turn[];
  patchTurns: (change: (previous: readonly Turn[]) => readonly Turn[]) => void;
  noteFaceTurn: (outcome: 'applied' | 'discarded') => void;
  /** Every finished build this panel ran, by its report turn's id. */
  buildsRef: RefObject<Map<string, BuildRecord>>;
  /** The pending answer to a build's ONE question. */
  approvalRef: RefObject<((answer: 'build' | 'stop') => void) | null>;
}

/**
 * What a person can do to a build from its cards: answer its one question,
 * put one section back, remove the empty placeholders it left — and the seam
 * the two build cards read the panel through.
 */
export function useBuildReportActions({
  locale,
  panelMode,
  turns,
  patchTurns,
  noteFaceTurn,
  buildsRef,
  approvalRef,
}: BuildReportActionsInputs) {
  /**
   * Answer the ONE question a build asks. Idempotent: the composer's Stop and
   * the card's own buttons race by design, and whichever lands first wins.
   */
  const answerApproval = useCallback(
    (answer: 'build' | 'stop') => {
      const settle = approvalRef.current;
      approvalRef.current = null;
      if (settle !== null) {
        settle(answer);
      }
    },
    [approvalRef],
  );

  /** Change one finished build's report turn, and nothing else. */
  const patchBuilt = useCallback(
    (turnId: string, change: (turn: BuiltTurn) => BuiltTurn) => {
      patchTurns((previous) =>
        previous.map((turn) =>
          turn.id === turnId && turn.from === 'assistant' && turn.kind === 'built'
            ? change(turn)
            : turn,
        ),
      );
    },
    [patchTurns],
  );

  /**
   * Put ONE section of a finished build back, FORWARD.
   *
   * `revertBuildSection` writes the section's recorded "before" into its own
   * region as one new labelled transaction ("Assistant: revert 3/10 — Pricing")
   * and never calls `kernel.undo()`. Until 2026-09-28 this found the section's
   * transaction by LABEL and undid everything recorded after it: the person's
   * own later edits went with it, and because two builds share labels, an older
   * card unwound the newer page (agent-audit P1-9). The section is found here
   * by the card's turn and position; the engine finds its landing by id.
   *
   * A refusal writes nothing and is said on the row, in words: the person
   * changed the section since, it is gone, it never landed, or it was written
   * with the page's layout and has no earlier version (the card offers no Undo
   * for those, so that last one is the belt to its braces).
   */
  const undoTask = useCallback(
    (turnId: string, position: number) => {
      // Fails closed in Plan, like `accept`: the card hides the button there,
      // and a gate on a button is a gate somebody can forget to copy.
      if (panelMode === 'plan') return;
      const build = buildsRef.current.get(turnId);
      // One report per planned section, in page order — the order positions count in.
      const report = build?.result.tasks[position - 1];
      if (build === undefined || report === undefined) return;
      try {
        revertBuildSection(build.kernel, report, preflightPorts());
      } catch (cause: unknown) {
        /*
          A revert refusal, or the door refusing the write itself. Nothing was
          written either way, and the row says so rather than the click being
          swallowed — in words true of THIS section: the engine's 'not-landed'
          on a section that is on the page means it has no earlier version.
        */
        const code = revertRefusalOf(cause, report);
        patchBuilt(turnId, (turn) => ({
          ...turn,
          revertRefused: [
            ...(turn.revertRefused ?? []).filter((entry) => entry.position !== position),
            { position, code },
          ],
        }));
        return;
      }
      patchBuilt(turnId, (turn) => ({
        ...turn,
        reverted: [...(turn.reverted ?? []), position],
        // An earlier refusal of this section is answered now; the others still stand.
        revertRefused: (turn.revertRefused ?? []).filter((entry) => entry.position !== position),
      }));
      noteFaceTurn('discarded');
    },
    [noteFaceTurn, panelMode, patchBuilt, buildsRef],
  );

  /**
   * Remove the empty placeholders a build left — never reached, cut off by
   * Stop, or given up on — as ONE transaction ("Assistant: remove unfilled
   * sections"), so one Undo brings them all back.
   *
   * The build never does this itself: a stopped page keeps its shape until the
   * person says otherwise. A region the person has written into since, or one
   * already gone, is kept and counted.
   */
  const removeUnfilled = useCallback(
    (turnId: string) => {
      if (panelMode === 'plan') return;
      const build = buildsRef.current.get(turnId);
      if (build === undefined) return;
      let removal: ReturnType<typeof removeUnfilledSections>;
      try {
        removal = removeUnfilledSections(build.kernel, build.result, preflightPorts());
      } catch {
        /*
          The door refused the removal whole — one transaction, so nothing was
          removed. The offer stays: the page is unchanged, so pressing again is
          still an honest question. And the card SAYS so: until 2026-09-28
          this only returned, and the button did nothing anyone could see.
        */
        patchBuilt(turnId, (turn) => ({ ...turn, unfilledRemovalRefused: true }));
        return;
      }
      patchBuilt(turnId, (turn) => ({
        ...turn,
        unfilledRemoval: { removed: removal.removed.length, kept: removal.kept.length },
        unfilledRemovalRefused: false,
      }));
      if (removal.removed.length > 0) noteFaceTurn('discarded');
    },
    [noteFaceTurn, panelMode, patchBuilt, buildsRef],
  );

  /*
    What the two build cards borrow from the panel beyond the thread's props:
    the language their sentences are said in, a build's notices by turn (the
    approval card is handed the list, not the turn), and the removal.
  */
  const buildCardSeam = useMemo<BuildCardSeam>(
    () => ({
      locale,
      noticesOf: (turnId) => {
        const turn = turns.find((candidate) => candidate.id === turnId);
        return turn?.from === 'assistant' && (turn.kind === 'building' || turn.kind === 'built')
          ? (turn.notices ?? NO_NOTICES)
          : NO_NOTICES;
      },
      onRemoveUnfilled: removeUnfilled,
    }),
    [locale, removeUnfilled, turns],
  );

  return { answerApproval, undoTask, removeUnfilled, buildCardSeam };
}

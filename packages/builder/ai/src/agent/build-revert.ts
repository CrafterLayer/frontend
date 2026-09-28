import type { BuilderKernel } from '@craftkit/builder-core';
import type { BuilderDocument, JsonValue, NodeId } from '@craftkit/builder-schema';

import { canonicalJsonStringify } from '../internal/canonical-json';
import { applyAiPlan, type AppliedAiPlan } from '../plan/apply-plan';
import type { AiPlan, AiValidationPorts } from '../types';
import type {
  AiBuildRunResult,
  AiBuildSectionKey,
  AiBuildSectionValues,
  AiBuildTask,
  AiBuildTaskReport,
} from './types';

/*
  Putting a build's work back, FORWARD.

  Both functions here write through the same door every build write takes —
  `applyAiPlan`, one labelled transaction — and neither ever calls
  `kernel.undo()`. That is the whole point. Per-section Undo used to find the
  last transaction labelled "Assistant: i/N — Title" and undo until it was gone
  (agent-audit.md P1-9, 2026-09-28): it took the person's own later edits with
  it, and because two builds in one session share labels, an older card could
  unwind the newer page. A forward revert touches the one region it names and
  leaves the history a line that only grows; the global Undo still works on it
  like on anything else.
*/

/** The history label of the one transaction `removeUnfilledSections` writes. */
export const REMOVE_UNFILLED_SECTIONS_LABEL = 'Assistant: remove unfilled sections';

const ASSISTANT_PREFIX = 'Assistant: ';
const REVERT_PREFIX = 'Assistant: revert ';
/** The kernel refuses a longer grouped-dispatch label outright. */
const MAX_LABEL_LENGTH = 160;
const SECTION_KEYS: readonly AiBuildSectionKey[] = Object.freeze(['tree', 'css']);

export type AiBuildRevertErrorCode = 'not-landed' | 'region-missing' | 'changed-since';

/** Why a section could not be reverted. Nothing was written when this is thrown. */
export class AiBuildRevertError extends Error {
  readonly code: AiBuildRevertErrorCode;

  constructor(code: AiBuildRevertErrorCode, message: string) {
    super(message);
    this.name = 'AiBuildRevertError';
    this.code = code;
  }
}

/**
 * A region's writer-owned props as they stand, keyed by prop. A prop the node
 * does not carry is absent rather than `undefined`, so two snapshots compare as
 * data.
 *
 * @internal Shared with the build, which records the same shape at landing.
 */
export function readSectionValues(
  document: BuilderDocument,
  id: NodeId,
  keys: readonly AiBuildSectionKey[] = SECTION_KEYS,
): AiBuildSectionValues {
  const props = document.nodes[id]?.props;
  const values: Partial<Record<AiBuildSectionKey, JsonValue>> = {};
  if (props === undefined) return Object.freeze(values);
  for (const key of keys) {
    const value = props[key];
    if (value !== undefined) values[key] = value;
  }
  return Object.freeze(values);
}

/** Whether every prop `expected` names still holds exactly that value. */
function stillHolds(
  document: BuilderDocument,
  id: NodeId,
  expected: AiBuildSectionValues,
): boolean {
  const keys = SECTION_KEYS.filter((key) => key in expected);
  const current = readSectionValues(document, id, keys);
  return keys.every(
    (key) => canonicalJsonStringify(current[key]) === canonicalJsonStringify(expected[key]),
  );
}

/** `Assistant: 2/5 — Pricing` → `Assistant: revert 2/5 — Pricing`. */
function revertLabel(landed: string, title: string): string {
  const rest = landed.startsWith(ASSISTANT_PREFIX)
    ? landed.slice(ASSISTANT_PREFIX.length)
    : `section — ${title}`;
  return `${REVERT_PREFIX}${rest}`.slice(0, MAX_LABEL_LENGTH);
}

/**
 * Put ONE landed section back as it was before its fill, as one new labelled
 * transaction (`Assistant: revert 2/5 — Pricing`).
 *
 * It is found by what the build recorded — the region id and the landing's
 * transaction id — never by label, so an older build's card reverts the older
 * section even when a newer build wrote the same label.
 *
 * It refuses, writing nothing, when:
 * - the section never landed (`not-landed`);
 * - its region is gone (`region-missing`);
 * - the region no longer holds what the fill wrote (`changed-since`): the
 *   person edited it afterwards, and writing the placeholder back would throw
 *   their edit away — exactly the cascade this function exists to end. The
 *   global Undo is still there for someone who means it.
 */
export function revertBuildSection(
  kernel: BuilderKernel,
  report: AiBuildTaskReport,
  ports: AiValidationPorts,
): AppliedAiPlan {
  const landing = report.status === 'applied' ? report.landing : undefined;
  if (landing === undefined) {
    throw new AiBuildRevertError(
      'not-landed',
      `Section "${report.title}" never landed, so there is nothing of it to revert.`,
    );
  }
  const document = kernel.getDocument();
  if (document.nodes[report.id] === undefined) {
    throw new AiBuildRevertError(
      'region-missing',
      `Section "${report.title}" is no longer on the page, so it cannot be reverted.`,
    );
  }
  if (!stillHolds(document, report.id, landing.after)) {
    throw new AiBuildRevertError(
      'changed-since',
      `Section "${report.title}" was changed after the build wrote it; reverting it would discard that change.`,
    );
  }
  const commands: AiPlan['commands'] = SECTION_KEYS.flatMap((key) => {
    const value = landing.before[key];
    return value === undefined ? [] : [{ command: 'setProp', args: { id: report.id, key, value } }];
  });
  if (commands.length === 0) {
    throw new AiBuildRevertError(
      'not-landed',
      `Section "${report.title}" has no recorded value from before the build to put back.`,
    );
  }
  return applyAiPlan({
    kernel,
    validationPorts: ports,
    plan: {
      rationale: `Put the section "${report.title}" back as it was before the build wrote it.`,
      commands,
    },
    policy: { allowedCommands: ['setProp'], maxCommands: commands.length },
    label: revertLabel(landing.label, report.title),
  });
}

export interface AiBuildUnfilledRemoval {
  /** The one transaction, when anything was removed. */
  readonly applied?: AppliedAiPlan;
  /** The regions removed, in page order. */
  readonly removed: readonly AiBuildTask[];
  /** The regions left in place, and why. */
  readonly kept: readonly { readonly task: AiBuildTask; readonly reason: string }[];
}

/**
 * Remove the placeholder regions a build left unfilled — the empty "THE
 * SECTION TITLE" bands a stopped build leaves behind — as ONE labelled
 * transaction (`Assistant: remove unfilled sections`), so one Undo brings them
 * all back.
 *
 * Never called by the build itself: a stopped page keeps its shape until the
 * person is offered this and says yes.
 *
 * A region is removed only while it still holds the placeholder the skeleton
 * laid. One the person has since written into by hand is theirs now and is
 * kept, as is one already gone; both are listed in `kept` with the reason.
 * With nothing to remove, nothing is written.
 */
export function removeUnfilledSections(
  kernel: BuilderKernel,
  result: Pick<AiBuildRunResult, 'unfilled'>,
  ports: AiValidationPorts,
): AiBuildUnfilledRemoval {
  const document = kernel.getDocument();
  const removed: AiBuildTask[] = [];
  const kept: { readonly task: AiBuildTask; readonly reason: string }[] = [];
  for (const section of result.unfilled ?? []) {
    const task: AiBuildTask = { id: section.id, title: section.title };
    if (document.nodes[section.id] === undefined) {
      kept.push({ task, reason: 'It is no longer on the page.' });
      continue;
    }
    if (!stillHolds(document, section.id, section.placeholder)) {
      kept.push({ task, reason: 'It was written into after the build stopped.' });
      continue;
    }
    removed.push(task);
  }
  if (removed.length === 0) {
    return Object.freeze({ removed: Object.freeze(removed), kept: Object.freeze(kept) });
  }
  const applied = applyAiPlan({
    kernel,
    validationPorts: ports,
    plan: {
      rationale: 'Remove the sections the build never filled.',
      commands: removed.map(({ id }) => ({ command: 'removeNode', args: { id } })),
    },
    policy: { allowedCommands: ['removeNode'], maxCommands: removed.length },
    label: REMOVE_UNFILLED_SECTIONS_LABEL,
  });
  return Object.freeze({
    applied,
    removed: Object.freeze(removed),
    kept: Object.freeze(kept),
  });
}

import type { BuilderKernel } from '@craftkit/builder-core';

import type { AiPlanValidationIssue } from '../types';
import { parseTreeMarkup, serializeTreeMarkup } from './tree-markup';

/**
 * `editTree`: change part of a region by quoting it, instead of rewriting it.
 *
 * ## The cost this removes
 *
 * A region's tree is replaced whole by `setProp`, so a follow-up as small as
 * "make the hero darker" made the model re-emit the entire section — every
 * node, every class — to change one of them: tens of seconds of generation
 * for a one-word change, and every re-emitted node a chance to drift. The
 * pattern the fast open builders use (aider's and Dyad's search/replace) is to
 * quote the exact text to change and give its replacement.
 *
 * ## How it stays inside the door
 *
 * `editTree` is not a kernel command and never reaches the kernel. Before the
 * plan is validated, each one is expanded here into the ordinary
 * `setProp {key: 'tree'}` it stands for: the region's CURRENT tree, written as
 * the same markup the model was shown, with each `find` replaced by its
 * `replace`, read back into a tree. From there the door judges it like any
 * other setProp — same policy, same vocabulary, same dry run. A `find` that is
 * not in the region exactly once is refused with a reason that says so, which
 * is what the one repair round needs to get it right.
 */

export const EDIT_TREE_COMMAND = 'editTree';

export interface TreeEditExpansion {
  /** The plan with every `editTree` expanded to a setProp, or the same value when none. */
  readonly plan: unknown;
  readonly issues: readonly AiPlanValidationIssue[];
}

interface TreeEdit {
  readonly find: string;
  readonly replace: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The edits an editTree step names: `edits: [{find, replace}]`, or one bare `{find, replace}`. */
function editsOf(args: JsonRecord): readonly TreeEdit[] | undefined {
  const list = Array.isArray(args['edits']) ? (args['edits'] as unknown[]) : [args];
  const edits: TreeEdit[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) return undefined;
    const { find, replace } = entry;
    if (typeof find !== 'string' || find === '' || typeof replace !== 'string') return undefined;
    edits.push({ find, replace });
  }
  return edits.length === 0 ? undefined : edits;
}

function occurrences(text: string, find: string): number {
  let count = 0;
  for (let at = text.indexOf(find); at >= 0; at = text.indexOf(find, at + find.length)) {
    count += 1;
    if (count > 1) return count;
  }
  return count;
}

function issue(step: number, message: string): AiPlanValidationIssue {
  return { code: 'invalid-args', message: `Step ${String(step)} (editTree): ${message}`, step };
}

/** One editTree step as the setProp it stands for, or the reason it cannot be. */
function expandStep(
  step: JsonRecord,
  index: number,
  kernel: BuilderKernel,
): { readonly step: JsonRecord } | { readonly issue: AiPlanValidationIssue } {
  const args = isRecord(step['args']) ? step['args'] : {};
  const id = args['id'];
  if (typeof id !== 'string') return { issue: issue(index, 'needs the id of the region to edit.') };
  const edits = editsOf(args);
  if (edits === undefined) {
    return {
      issue: issue(
        index,
        'needs edits as [{"find": "<exact markup>", "replace": "<new markup>"}].',
      ),
    };
  }
  const node = kernel.getDocument().nodes[id];
  if (node === undefined) return { issue: issue(index, `no node "${id}" exists on this page.`) };
  let markup = serializeTreeMarkup(node.props['tree']);
  if (markup === undefined) {
    return {
      issue: issue(
        index,
        `node "${id}" has no tree that can be edited as markup; rewrite it whole with setProp {key: "tree"}.`,
      ),
    };
  }
  for (const [at, edit] of edits.entries()) {
    const found = occurrences(markup, edit.find);
    if (found !== 1) {
      return {
        issue: issue(
          index,
          found === 0
            ? `edit ${String(at + 1)}: "find" is not in the region's markup as it stands now. Quote it EXACTLY as the document shows it — attributes sorted, single quotes — or rewrite the region with setProp.`
            : `edit ${String(at + 1)}: "find" occurs more than once in the region; quote a longer, unique stretch around the change.`,
        ),
      };
    }
    markup = markup.replace(edit.find, () => edit.replace);
  }
  return {
    step: {
      command: 'setProp',
      args: { id, key: 'tree', value: parseTreeMarkup(markup) },
      ...(typeof step['title'] === 'string' ? { title: step['title'] } : {}),
    },
  };
}

/**
 * Expand every `editTree` step in a candidate plan against the page as it is
 * now. Steps are expanded in order against the LIVE document, so two edits to
 * one region belong in one step's `edits`, not in two steps.
 */
export function expandTreeEdits(candidate: unknown, kernel: BuilderKernel): TreeEditExpansion {
  if (!isRecord(candidate) || !Array.isArray(candidate['commands'])) {
    return { plan: candidate, issues: [] };
  }
  const commands = candidate['commands'] as unknown[];
  if (!commands.some((step) => isRecord(step) && step['command'] === EDIT_TREE_COMMAND)) {
    return { plan: candidate, issues: [] };
  }
  const issues: AiPlanValidationIssue[] = [];
  const expanded = commands.map((step, index) => {
    if (!isRecord(step) || step['command'] !== EDIT_TREE_COMMAND) return step;
    const result = expandStep(step, index, kernel);
    if ('issue' in result) {
      issues.push(result.issue);
      return step;
    }
    return result.step;
  });
  return { plan: { ...candidate, commands: expanded }, issues };
}

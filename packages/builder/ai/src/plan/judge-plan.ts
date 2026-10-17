import { resolveAiCompositionPolicy } from '../context';
import type { AiEffectiveCommandPolicy } from '../skills';
import type { AiPlan, AiPlanValidationIssue, AiPlanValidationResult } from '../types';
import { expandAgentTools } from '../tools/agent/expand';
import type { GenerateAiPlanOptions } from './generate-plan';
import { normalizeAiPlanTrees, readAiPlanTreeMarkup } from './normalize-plan';
import { salvageAiPlan } from './salvage-plan';
import { expandTreeEdits } from './tree-edits';
import { AiPlanRejectedError, validateAiPlan } from './validate-plan';

export interface AiPlanAcceptanceOptions {
  /** Optional request outcome check, after the kernel door and before repair or salvage success. */
  acceptPlan?: ((plan: AiPlan) => readonly AiPlanValidationIssue[]) | undefined;
}

/**
 * A provider's answer with what could never render removed, when the host
 * enforces the utility vocabulary — the same condition under which the door
 * would otherwise refuse the whole plan for it. See `normalizeAiPlanTrees`.
 * Trees written as markup are read either way: markup is only a spelling,
 * and the context asks for it on every run (see `readAiPlanTreeMarkup`).
 */
function normalizedCandidate(candidate: unknown, options: GenerateAiPlanOptions): unknown {
  const composition = resolveAiCompositionPolicy(options.composition);
  if (!composition.enforceUtilityVocabulary) return readAiPlanTreeMarkup(candidate);
  const blockTypes = options.kernel.context.registry.blocks().map(({ schema }) => schema.type);
  return normalizeAiPlanTrees(candidate, composition.colourPolicy, blockTypes).plan;
}

/**
 * A provider's answer made ready for the door, and the door's verdict on it:
 * `editTree` steps expanded against the live page (tree-edits.ts), the trees
 * normalized, then validated. An edit that could not be expanded is its own
 * verdict — its reason is exactly what the repair round needs.
 */
export function judgedCandidate(
  raw: unknown,
  options: GenerateAiPlanOptions,
  policy: AiEffectiveCommandPolicy,
): { readonly candidate: unknown; readonly result: AiPlanValidationResult } {
  // agent-tools additions: tool steps expand first, then editTree, so both read earlier steps.
  const tools = expandAgentTools(raw, options.kernel, {
    ...(options.sampleValues === undefined ? {} : { sampleValues: options.sampleValues }),
    ...(options.toolLanes === undefined ? {} : { lanes: options.toolLanes }),
  });
  const expanded = expandTreeEdits(tools.plan, options.kernel);
  const issues = [...tools.issues, ...expanded.issues];
  // end agent-tools additions
  const candidate = normalizedCandidate(expanded.plan, options);
  if (issues.length > 0) {
    return { candidate, result: { ok: false, issues } };
  }
  const result = validateAiPlan(
    candidate,
    options.kernel,
    options.validationPorts,
    policy,
    resolveAiCompositionPolicy(options.composition),
  );
  const refused = result.ok ? (options.acceptPlan?.(result.plan) ?? []) : [];
  return { candidate, result: refused.length > 0 ? { ok: false, issues: refused } : result };
}

/**
 * The third rung: keep whatever part of the answer the door will accept.
 *
 * Opt-in, and deliberately so. `generateAiPlan` is the primitive that promises
 * a plan or an error, and a caller that asked for a plan and silently received
 * a smaller one would have no way to know. `runAiAgent` turns it on and reports
 * what was dropped, which is where a person can actually be told.
 */
export function salvageOrReject(
  options: GenerateAiPlanOptions,
  policy: AiEffectiveCommandPolicy,
  candidates: readonly unknown[],
  issues: readonly AiPlanValidationIssue[],
): AiPlan {
  if (options.salvage !== true) throw new AiPlanRejectedError(issues);
  let acceptanceIssues: readonly AiPlanValidationIssue[] = [];
  for (const candidate of candidates) {
    if (!isPlanShaped(candidate)) continue;
    const salvaged = salvageAiPlan(
      candidate,
      options.kernel,
      options.validationPorts,
      policy,
      resolveAiCompositionPolicy(options.composition),
    );
    if (salvaged === undefined) continue;
    const refused = options.acceptPlan?.(salvaged.plan) ?? [];
    if (refused.length > 0) {
      acceptanceIssues = refused;
      continue;
    }
    options.onSalvage?.(salvaged);
    return salvaged.plan;
  }
  throw new AiPlanRejectedError([...acceptanceIssues, ...issues]);
}

export function isPlanShaped(candidate: unknown): candidate is AiPlan {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'rationale' in candidate &&
    'commands' in candidate
  );
}

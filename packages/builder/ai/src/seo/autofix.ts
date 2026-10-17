import type { BuilderKernel } from '@craftkit/builder-core';
import type { BuilderDocument, JsonValue, NodeId } from '@craftkit/builder-schema';

import type { AiEffectiveCommandPolicy } from '../skills';
import type { AiPlan, AiValidationPorts } from '../types';
import { validateAiPlan } from '../plan/validate-plan';
import type { AgentToolStep } from '../tools/agent/types';
import { collectSeo, type CheckSeoOptions } from './check-seo';
import { editsToSteps, type SeoEdit } from './fixes';

export const SEO_AUTOFIX_LABEL = 'Assistant: SEO';

export interface SeoAutofixOptions {
  /** Facts-ledger sample values; no safe fix writes them, the checks report them. */
  readonly sampleValues?: readonly string[];
  /** Ports for the dry run; a fixed clock and a counter when absent (the fixes mint no ids). */
  readonly ports?: AiValidationPorts;
  readonly policy?: AiEffectiveCommandPolicy;
  /** Site context for the site-level checks (never changes which fixes are safe). */
  readonly pages?: CheckSeoOptions['pages'];
  readonly address?: string;
  /** Region trees as a plan's earlier steps leave them, over the live page's. */
  readonly trees?: ReadonlyMap<NodeId, unknown>;
}

function defaultPorts(): AiValidationPorts {
  let next = 0;
  return {
    clock: { now: () => 0 },
    ids: {
      newId: () => {
        next += 1;
        return `seo-fix-${String(next)}`;
      },
    },
  };
}

function withTrees(document: BuilderDocument, trees: ReadonlyMap<NodeId, unknown> | undefined): BuilderDocument {
  if (trees === undefined || trees.size === 0) return document;
  const nodes = { ...document.nodes };
  for (const [id, tree] of trees) {
    const node = nodes[id];
    if (node !== undefined) nodes[id] = { ...node, props: { ...node.props, tree: tree as JsonValue } };
  }
  return { ...document, nodes };
}

/** The safe edits for a page, in the order the checks found them. */
export function seoSafeEdits(
  document: BuilderDocument,
  options: Pick<SeoAutofixOptions, 'sampleValues' | 'pages' | 'address'> = {},
): SeoEdit[] {
  return collectSeo(document, {
    ...(options.sampleValues === undefined ? {} : { sampleValues: options.sampleValues }),
    ...(options.pages === undefined ? {} : { pages: options.pages }),
    ...(options.address === undefined ? {} : { address: options.address }),
  }).flatMap((entry) => (entry.safe === true && entry.edits !== undefined ? [...entry.edits] : []));
}

/**
 * Every safe fix as steps — ONE setProp per region (its edits applied in order
 * over one copy of the tree), one per root prop. Unvalidated: the tool path
 * (`seo.fix`) hands these to the door with the rest of its plan.
 */
export function seoAutofixSteps(
  document: BuilderDocument,
  options: Pick<SeoAutofixOptions, 'sampleValues' | 'pages' | 'address' | 'trees'> = {},
): AgentToolStep[] {
  const page = withTrees(document, options.trees);
  return editsToSteps(page, seoSafeEdits(page, options));
}

function planOf(steps: readonly AgentToolStep[]): AiPlan {
  return {
    rationale: 'Apply the safe SEO fixes: alt text, image sizes and loading, one h1, labelled sections, clamped title and description, descriptive links.',
    commands: steps.map((step) => ({ command: step.command, args: step.args, ...(step.title === undefined ? {} : { title: step.title }) })),
  };
}

/**
 * The safe SEO fixes as one validated plan, or undefined when there is
 * nothing to fix (so a second run after the first lands returns undefined).
 *
 * Only a plan the door accepts is returned. When the whole is refused, the
 * fetchpriority hint is dropped first (a door without the attribute refuses
 * only that); then each step is tried alone and the ones the door accepts are
 * kept — one region with an unrelated problem never costs the page every
 * other fix. The caller applies it through `applyAiPlan` as one transaction,
 * labelled `SEO_AUTOFIX_LABEL`.
 */
export function seoAutofixPlan(kernel: BuilderKernel, options: SeoAutofixOptions = {}): AiPlan | undefined {
  const document = withTrees(kernel.getDocument(), options.trees);
  const edits = seoSafeEdits(document, options);
  if (edits.length === 0) return undefined;
  const ports = options.ports ?? defaultPorts();
  const judge = (steps: readonly AgentToolStep[]): AiPlan | undefined => {
    if (steps.length === 0) return undefined;
    const result = validateAiPlan(planOf(steps), kernel, ports, options.policy);
    return result.ok ? result.plan : undefined;
  };

  const full = editsToSteps(document, edits);
  const whole = judge(full);
  if (whole !== undefined) return whole;

  const withoutPriority = edits.filter((edit) => !(edit.kind === 'tree' && edit.fetchpriority === true));
  const lean = withoutPriority.length === edits.length ? full : editsToSteps(document, withoutPriority);
  if (lean !== full) {
    const second = judge(lean);
    if (second !== undefined) return second;
  }

  /* Step by step: each region's full fix, else the same region without the
     fetchpriority hint, else nothing for that region. */
  const keyOf = (step: AgentToolStep): string => {
    const id = step.args['id'];
    const key = step.args['key'];
    return `${typeof id === 'string' ? id : ''}\u0000${typeof key === 'string' ? key : step.command}`;
  };
  const leanByKey = new Map(lean.map((step) => [keyOf(step), step]));
  const kept: AgentToolStep[] = [];
  for (const step of full) {
    if (judge([step]) !== undefined) {
      kept.push(step);
      continue;
    }
    const fallback = leanByKey.get(keyOf(step));
    if (fallback !== undefined && fallback !== step && judge([fallback]) !== undefined) kept.push(fallback);
  }
  return judge(kept);
}

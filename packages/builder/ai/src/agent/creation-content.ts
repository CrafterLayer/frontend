import { isSiteCommandName } from '@craftkit/builder-core';

import { summarizeDocumentForIntent } from '../intent/document-summary';
import { creativeCreationRequest, routeIntent, type IntentRoute } from '../intent/route-intent';
import { createValidationKernel } from '../plan/validate-plan';
import type { AiPlan, AiPlanValidationIssue } from '../types';

import type { RunAiAgentOptions } from './types';
import { sceneProgramHasContent } from './scene-content-witness';
import { isInheritedRunDeadline, isScaffoldRun } from './run-deadline';

const MISSING_CONTENT: AiPlanValidationIssue = Object.freeze({
  code: 'invalid-plan',
  message:
    'This request creates a scene, but the plan creates no meaningful scene content. Language, direction, page CSS, labels and empty regions alone do not create the requested scene. Insert or fill a customCode region with the requested illustrated scene or complete story/game kit, including its scene code or a closed scene layer. Preserve the specific narrative and setting; do not replace a bespoke request with an unrelated generic preset.',
});

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Static scene content, including the renderer's closed scenes and drawn SVG. */
function sceneTree(tree: unknown): boolean {
  if (!record(tree)) return false;
  const attributes = tree['attributes'];
  if (
    record(attributes) &&
    typeof attributes['data-ck-scene'] === 'string' &&
    attributes['data-ck-scene'].trim() !== ''
  )
    return true;
  if (
    tree['kind'] === 'element' &&
    ['path', 'polygon', 'polyline', 'circle', 'ellipse', 'rect', 'image'].includes(
      String(tree['tag']),
    )
  )
    return true;
  return Array.isArray(tree['children']) && tree['children'].some(sceneTree);
}

function meaningful(props: unknown): boolean {
  if (!record(props)) return false;
  const tree = props['tree'];
  const host = record(tree) && Array.isArray(tree['children']) && tree['children'].length > 0;
  return (host && sceneProgramHasContent(props['js'])) || sceneTree(tree);
}

/** Scoped to explicit creation; build scaffolds and ordinary metadata edits keep their door. */
export function creationAcceptance(
  options: RunAiAgentOptions,
  reading?: IntentRoute,
): ((plan: AiPlan) => readonly AiPlanValidationIssue[]) | undefined {
  if (
    isInheritedRunDeadline(options) ||
    isScaffoldRun(options) ||
    !creativeCreationRequest(options.request)
  )
    return undefined;
  const document = options.kernel.getDocument();
  const summary = summarizeDocumentForIntent(document);
  const blank = summary.nodeCount === 0 || summary.placeholderOnly;
  const route =
    reading ??
    options.intent ??
    routeIntent({
      request: options.request,
      document: summary,
      selection: options.selection ?? [],
    });
  if (!blank && route.kind !== 'add-section') return undefined;
  return (plan) => {
    const scratch = createValidationKernel(plan, options.kernel, options.validationPorts);
    // Judge the final reachable document, including compositions, removals and tool output.
    const pageSteps = plan.commands.filter(({ command }) => !isSiteCommandName(command));
    if (pageSteps.length === 0) return [MISSING_CONTENT];
    scratch.dispatchGroup(
      pageSteps.map(({ command, args }) => ({ command, args })),
      { author: 'ai' },
    );
    const after = scratch.getDocument();
    const seen = new Set<string>([after.rootId]);
    const stack = Object.values(after.nodes[after.rootId]?.slots ?? {}).flat();
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      const node = after.nodes[id];
      if (node === undefined) continue;
      stack.push(...Object.values(node.slots ?? {}).flat());
      if (node.type !== 'customCode' || !meaningful(node.props)) continue;
      const before = document.nodes[id];
      if (
        before === undefined ||
        before.props['js'] !== node.props['js'] ||
        JSON.stringify(before.props['tree']) !== JSON.stringify(node.props['tree'])
      )
        return [];
    }
    return [MISSING_CONTENT];
  };
}

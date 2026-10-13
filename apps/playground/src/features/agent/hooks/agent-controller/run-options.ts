/**
 * The engine options every run shares (`commonRunOptions`), the fast edit model, and
 * an edit's code-mode site.
 */
import type { BuilderKernel, NodeId, RunAiAgentOptions } from '@craftkit/builder';

import { catalogPolicyFor } from '../../../preview/components/AssistantPanel/catalogPolicyFor';
import { carriedSkillIdsOf, withCarriedSkills } from '../../model/conversation-memory';
import { preflightPorts } from '../../model/runs';
import {
  selectedSkillsForRequest,
  skillRequestText,
  type PromptSkillSnapshot,
} from '../../model/prompt-skills';

import type { Flow } from './controller-state';
import type { Slot } from './run-lease';
import { sessionOf } from './turn-plumbing';
import { contextProvidersOf } from './story-bible-context';
// script-wiring additions
import { agentScriptSiteFor, scriptRunLine } from '../../model/script-site';
// end script-wiring additions

/* ── Shared run options ──────────────────────────────────────────────────────── */

export function commonRunOptions(
  flow: Flow,
  kernel: BuilderKernel,
  slot: Slot,
  request: string,
  selection: readonly NodeId[],
  history: RunAiAgentOptions['history'],
  snapshot?: PromptSkillSnapshot,
): Omit<RunAiAgentOptions, 'apply' | 'onEvent' | 'label'> {
  const env = flow.env();
  const { options } = env;
  const selectedSkillIds = selectedSkillsForRequest(options, request, snapshot, env.registry);
  const semanticRequest = skillRequestText(options, request, snapshot);
  // A deliberately deeper choice retains capacity; an explicit host ceiling always wins.
  const timeoutMs =
    options.timeoutMs ??
    (options.effort === 'high' || options.effort === 'xhigh' || options.effort === 'max'
      ? 420_000
      : undefined);
  return {
    runId: slot.runId,
    clock: flow.clock,
    kernel,
    provider: env.provider,
    request: semanticRequest,
    validationPorts: preflightPorts(),
    selection,
    ...(history === undefined ? {} : { history }),
    ...contextProvidersOf(env),
    // A creative writer's planner brief takes its cast from the bible (read per run).
    creativeMemory: () => env.storyBible.get(),
    // Skills that woke earlier in this conversation stay awake (conversation-memory.ts).
    skillRegistry: withCarriedSkills(
      env.registry,
      carriedSkillIdsOf(sessionOf(flow, slot.sessionId)?.turns ?? []),
    ),
    ...(selectedSkillIds === undefined ? {} : { selectedSkillIds }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    // The person's skills this request mentions, for a build's and a page plan's named steps.
    ...(options.hostSkillIdsFor === undefined
      ? {}
      : {
          hostSkillIds: [
            ...new Set([...(selectedSkillIds ?? []), ...options.hostSkillIdsFor(semanticRequest)]),
          ],
        }),
    ...catalogPolicyFor(options.providerKind ?? 'offline', selection, options.agentPolicy),
    // The composer's free-code switch, read per run: only `true` ever reaches the engine.
    ...(options.freeCode === true ? { freeCode: true } : {}),
    signal: slot.controller.signal,
    isCurrentRun: (candidate) => flow.runtime.lease?.runId === candidate,
  };
}

/**
 * The fast model an edit runs on (owner request: a one-word change must not wait on the
 * page-building model). The engine uses it only for an edit or a new section; a direct
 * edit it can make with no model at all never reaches it.
 */
export function editModelOptions(flow: Flow): Pick<RunAiAgentOptions, 'editModel' | 'editEffort'> {
  const { editModel, editEffort } = flow.env().options;
  return {
    ...(editModel === undefined || editModel === '' ? {} : { editModel }),
    ...(editEffort === undefined ? {} : { editEffort }),
  };
}

// script-wiring additions
/**
 * Code mode for an edit (agent-script DESIGN §A.9, §A.13): the site this page belongs to,
 * so a script may write every page in ONE transaction (one Undo), and — in dev — one
 * console line per script run. A page that is no lens of the app's site gets no site; its
 * scripts edit this page only.
 */
export function scriptRunOptions(
  kernel: BuilderKernel,
): Pick<RunAiAgentOptions, 'site' | 'onScriptRun'> {
  const site = agentScriptSiteFor(kernel);
  const onScriptRun: NonNullable<RunAiAgentOptions['onScriptRun']> = (report) => {
    console.info(scriptRunLine(report));
  };
  return {
    ...(site === undefined ? {} : { site }),
    ...(import.meta.env['DEV'] === true ? { onScriptRun } : {}),
  };
}
// end script-wiring additions

import type Anthropic from '@anthropic-ai/sdk';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { NO_CONTRACT_MESSAGE, contractSchemaOf, planParams, DEFAULT_MODEL } from './plan-params';
import { callEffort, type PlanRequestPolicy } from './plan-request';
import { PAGE_PLAN_ANSWER_SCHEMA, planShapeCheck } from './plan-shape';
import { apiParams, isApiModel, isCliModel } from './routing-client';
import { sceneReviewParams, type SceneReviewCall } from './scene-review';

/*
  One batch item, built (split from batch-routes.ts, 2026-10-13): each is the very request the
  live call for the same body sends — a plan through plan-params.ts, a scene review through
  scene-review.ts — and, for an `api:` model, as the routing client sends it (`apiParams`). The
  `custom_id` marks the item's task, so a result says how to read itself even when this server
  no longer remembers the batch: `p-` a plan, `g-` a page plan, `r-` a scene review.
*/

/** Who runs batches: the Messages API for every model (`sdk`), or for `api:` models only (`api`). */
export interface BatchBackend {
  readonly client: Anthropic;
  readonly route: 'sdk' | 'api';
}

export type Judge = (value: unknown) => boolean;

/** One item as the Batches API takes it, and the judge its answer will be read with. */
export type BuiltItem =
  | {
      readonly request: Anthropic.Messages.BatchCreateParams.Request;
      readonly judge?: Judge;
    }
  | { readonly status: 400 | 409; readonly error: string };

/** The model the Messages API is asked for, or undefined when only the CLI or OpenRouter serves it. */
function messagesModel(model: string, route: BatchBackend['route']): string | undefined {
  if (route === 'api') return isApiModel(model) ? model.slice('api:'.length) : undefined;
  return isCliModel(model) || model.includes('/') ? undefined : model;
}

function cannotBatch(model: string, backend: BatchBackend): BuiltItem {
  return {
    status: 409,
    error:
      `Model "${model}" cannot run in a batch: only the Anthropic Messages API batches` +
      `${backend.route === 'api' ? ' (an api: model)' : ''}, and the local CLI and OpenRouter cannot.`,
  };
}

/** The request as this backend sends it: an `api:` model's as the routing client sends it live. */
function sent<P extends { readonly model: string }>(
  params: P,
  apiModel: string,
  backend: BatchBackend,
): P {
  return backend.route === 'api' ? (apiParams(params, apiModel) as unknown as P) : params;
}

/** A plan item: `p-` a plan (with its shape judge), `g-` a page plan. */
export function planBatchItem(
  id: string,
  wire: AiPlanWireRequest,
  run: PlanRequestPolicy & { readonly maxTokens?: number },
  backend: BatchBackend,
): BuiltItem {
  const model = run.model ?? DEFAULT_MODEL;
  const apiModel = messagesModel(model, backend.route);
  if (apiModel === undefined) return cannotBatch(model, backend);
  // A site plan (T230) is asked live while its site is built; it has no batch reader.
  if (wire.task === 'site-plan') return { status: 400, error: 'A site plan is not batched.' };
  const pagePlan = wire.task === 'page-plan';
  const schema = pagePlan ? PAGE_PLAN_ANSWER_SCHEMA : contractSchemaOf(wire);
  // /plan answers this with an invalid-output body and no model call; a batch refuses the item.
  if (schema === undefined) return { status: 400, error: NO_CONTRACT_MESSAGE };
  const { params } = planParams(
    wire,
    { model, maxTokens: run.maxTokens, ...callEffort(wire, run) },
    schema,
  );
  return {
    request: {
      custom_id: `${pagePlan ? 'g' : 'p'}-${id}`,
      params: sent(params, apiModel, backend),
    },
    ...(pagePlan ? {} : { judge: planShapeCheck(wire) }),
  };
}

/**
 * A scene review item (`r-`, 2026-10-13): a background build's look at a scene section, at
 * half price. Read at the live endpoint's door (`readSceneReviewCall`) and on its model — the
 * fastest of the picked route — which a batch can always show a picture: it is the Messages API.
 */
export function reviewBatchItem(
  id: string,
  call: Exclude<SceneReviewCall, { readonly error: string }>,
  backend: BatchBackend,
): BuiltItem {
  const apiModel = messagesModel(call.model, backend.route);
  if (apiModel === undefined) return cannotBatch(call.model, backend);
  const params = sceneReviewParams(call.request, { model: call.model, effort: call.effort });
  return { request: { custom_id: `r-${id}`, params: sent(params, apiModel, backend) } };
}

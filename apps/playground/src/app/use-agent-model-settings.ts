import { useCallback, useMemo, useState } from 'react';

import {
  planModelsFromEnv,
  planProviderFromEnv,
} from '../features/preview/components/AssistantPanel/planProviderFromEnv';
import type { EffortLevel } from '../features/agent';
import { DEFAULT_EFFORT, effortLevel } from '../features/agent/model/effort';
import { editModelFromEnv, planModelChoice } from './agent-host';
import { useOfferedModels } from './use-offered-models';

/**
 * The models the assistant header may offer, from VITE_AI_PLAN_MODELS. The
 * provider itself is built inside `useAgentModelSettings`, per chosen model: the
 * choice travels as a request header, and a provider carries its headers from
 * construction.
 */
const envPlanModels = planModelsFromEnv(import.meta.env);
const PLAN_MODEL_KEY = 'pg-ai-model-v1';
/* How hard the model may think (the composer's effort menu); `medium` until a person says otherwise. */
const PLAN_EFFORT_KEY = 'pg-ai-effort-v1';
/* The composer's free-code switch (the agent may write JavaScript and full PixiJS scenes); off until a person turns it on. */
const FREE_CODE_KEY = 'pg-ai-free-code-v1';
function initialFreeCode(): boolean {
  try {
    return localStorage.getItem(FREE_CODE_KEY) === '1';
  } catch {
    // A private window has no memory; the switch starts off.
    return false;
  }
}
function initialPlanEffort(): EffortLevel {
  try {
    return effortLevel(localStorage.getItem(PLAN_EFFORT_KEY)) ?? DEFAULT_EFFORT;
  } catch {
    // A private window has no memory; the default applies.
    return DEFAULT_EFFORT;
  }
}

/*
  The model a page build starts on: the remembered choice while it is still on
  offer, else the FASTEST offered one (planModelChoice), never simply the first
  listed — that put every build on Sonnet while the owner ranks speed first. The
  provider names this model too, so the picker shows the model that runs.
*/
function initialPlanModel(): string | undefined {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(PLAN_MODEL_KEY);
  } catch {
    // A private window has no memory; the fastest offered model still applies.
  }
  return planModelChoice(stored, envPlanModels);
}

/**
 * The assistant's model, effort and free-code choices: each remembered per viewer,
 * plus the provider and edit model they decide.
 */
export function useAgentModelSettings() {
  const [pickedModel, setPickedModel] = useState<string | undefined>(initialPlanModel);
  const selectPlanModel = useCallback((model: string) => {
    setPickedModel(model);
    try {
      localStorage.setItem(PLAN_MODEL_KEY, model);
    } catch {
      // A private window forgets the choice; the picker still works for the session.
    }
  }, []);
  /*
    What the picker offers is what the server says it can run NOW: its own models plus every
    free OpenRouter model listed this minute (use-offered-models.ts), starting from
    VITE_AI_PLAN_MODELS. A model the person picked that is no longer offered (a free one
    OpenRouter withdrew) gives way to the fastest offered one without forgetting the pick:
    it comes back if it is listed again.
  */
  const offeredModels = useOfferedModels(import.meta.env, envPlanModels);
  const planModel = useMemo(
    () => planModelChoice(pickedModel ?? null, offeredModels),
    [pickedModel, offeredModels],
  );
  const [planEffort, setPlanEffort] = useState<EffortLevel>(initialPlanEffort);
  const selectPlanEffort = useCallback((level: EffortLevel) => {
    setPlanEffort(level);
    try {
      localStorage.setItem(PLAN_EFFORT_KEY, level);
    } catch {
      // A private window forgets the choice; the menu still works for the session.
    }
  }, []);
  const [freeCode, setFreeCode] = useState<boolean>(initialFreeCode);
  const toggleFreeCode = useCallback((enabled: boolean) => {
    setFreeCode(enabled);
    try {
      localStorage.setItem(FREE_CODE_KEY, enabled ? '1' : '0');
    } catch {
      // A private window forgets the choice; the switch still works for the session.
    }
  }, []);
  /*
    A remote assistant server when VITE_AI_PLAN_ENDPOINT is set, otherwise
    undefined and the panel keeps its built-in deterministic provider. Rebuilt
    when the model changes: the header is fixed at construction, and a fresh
    provider also starts a fresh cache, which is right — a different model is
    a different answer to the same page.
  */
  const envPlanProvider = useMemo(
    () => planProviderFromEnv(import.meta.env, planModel, planEffort),
    [planModel, planEffort],
  );
  /* The edit model follows the offered list too: a free model that left must not run edits. */
  const agentEditModel = useMemo(
    () => editModelFromEnv(import.meta.env, offeredModels),
    [offeredModels],
  );
  return {
    offeredModels,
    planModel,
    selectPlanModel,
    planEffort,
    selectPlanEffort,
    freeCode,
    toggleFreeCode,
    envPlanProvider,
    agentEditModel,
  };
}

export type AgentModelSettings = ReturnType<typeof useAgentModelSettings>;

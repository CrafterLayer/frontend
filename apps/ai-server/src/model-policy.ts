export const MODEL_POLICY_VERSION = 'craftkit-model-policy-2026-09-10.1';

export type ModelRole = 'context' | 'copy' | 'code' | 'design' | 'visual-review' | 'escalation';

export type ModelCapability =
  'structured-output' | 'tool-calling' | 'code' | 'vision' | 'reasoning';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ModelCandidate {
  readonly provider: string;
  readonly model: string;
  /** Lower values are preferred after capability checks pass. */
  readonly costRank: number;
  readonly efforts: readonly ReasoningEffort[];
  readonly declaredCapabilities: readonly ModelCapability[];
}

export interface ModelCapabilityProbe {
  readonly available: boolean;
  readonly capabilities: readonly ModelCapability[];
  readonly efforts: readonly ReasoningEffort[];
  readonly checkedAt: number;
  readonly reason?: string;
}

export interface ModelProbePort {
  probe(candidate: ModelCandidate, signal?: AbortSignal): Promise<ModelCapabilityProbe>;
}

export interface ProbedModel extends ModelCandidate {
  readonly probe: ModelCapabilityProbe;
}

export interface ModelRoute {
  readonly policyVersion: typeof MODEL_POLICY_VERSION;
  readonly role: ModelRole;
  readonly provider: string;
  readonly model: string;
  readonly effort: ReasoningEffort;
  readonly fallback: string | null;
  readonly probeCheckedAt: number;
}

export interface ModelRouter {
  readonly version: typeof MODEL_POLICY_VERSION;
  readonly models: readonly ProbedModel[];
  select(role: ModelRole): ModelRoute;
}

export interface CreateModelRouterOptions {
  readonly candidates?: readonly ModelCandidate[];
  readonly probe: ModelProbePort;
  readonly signal?: AbortSignal;
}

const ROLE_REQUIREMENTS: Readonly<
  Record<
    ModelRole,
    { readonly capabilities: readonly ModelCapability[]; readonly effort: ReasoningEffort }
  >
> = {
  context: { capabilities: ['structured-output'], effort: 'low' },
  copy: { capabilities: ['structured-output'], effort: 'low' },
  code: { capabilities: ['structured-output', 'tool-calling', 'code'], effort: 'medium' },
  design: { capabilities: ['structured-output', 'code', 'reasoning'], effort: 'medium' },
  'visual-review': {
    capabilities: ['structured-output', 'vision', 'reasoning'],
    effort: 'high',
  },
  escalation: {
    capabilities: ['structured-output', 'tool-calling', 'code', 'reasoning'],
    effort: 'high',
  },
};

/** Configurable slugs keep policy roles stable when an account exposes different model aliases. */
export function defaultModelCandidates(
  names: Partial<Record<'luna' | 'terra' | 'sol' | 'astra', string>> = {},
  provider = 'openai',
): readonly ModelCandidate[] {
  return [
    {
      provider,
      model: names.luna ?? 'gpt-5.6-luna',
      costRank: 10,
      efforts: ['low', 'medium'],
      declaredCapabilities: ['structured-output', 'tool-calling', 'code'],
    },
    {
      provider,
      model: names.terra ?? 'gpt-5.6-terra',
      costRank: 20,
      efforts: ['low', 'medium', 'high'],
      declaredCapabilities: ['structured-output', 'tool-calling', 'code', 'reasoning'],
    },
    {
      provider,
      model: names.sol ?? 'gpt-5.6-sol',
      costRank: 30,
      efforts: ['medium', 'high'],
      declaredCapabilities: ['structured-output', 'tool-calling', 'code', 'vision', 'reasoning'],
    },
    {
      provider,
      model: names.astra ?? 'gpt-6-astra',
      costRank: 40,
      efforts: ['high'],
      declaredCapabilities: ['structured-output', 'tool-calling', 'code', 'vision', 'reasoning'],
    },
  ];
}

function qualifies(model: ProbedModel, role: ModelRole): boolean {
  const requirement = ROLE_REQUIREMENTS[role];
  const capabilities = new Set(model.probe.capabilities);
  return (
    model.probe.available &&
    requirement.capabilities.every((capability) => capabilities.has(capability)) &&
    model.probe.efforts.includes(requirement.effort)
  );
}

export function selectLowestQualifiedModel(
  role: ModelRole,
  models: readonly ProbedModel[],
): ModelRoute {
  const qualified = models
    .filter((model) => qualifies(model, role))
    .sort(
      (left, right) =>
        left.costRank - right.costRank ||
        left.provider.localeCompare(right.provider) ||
        left.model.localeCompare(right.model),
    );
  const chosen = qualified[0];
  if (chosen === undefined) throw new Error(`No capability-probed model qualifies for ${role}.`);
  const fallback = qualified.find(
    (candidate) => candidate.provider !== chosen.provider || candidate.model !== chosen.model,
  );
  return {
    policyVersion: MODEL_POLICY_VERSION,
    role,
    provider: chosen.provider,
    model: chosen.model,
    effort: ROLE_REQUIREMENTS[role].effort,
    fallback: fallback?.model ?? null,
    probeCheckedAt: chosen.probe.checkedAt,
  };
}

export async function createModelRouter(options: CreateModelRouterOptions): Promise<ModelRouter> {
  const candidates = options.candidates ?? defaultModelCandidates();
  const identities = new Set<string>();
  for (const candidate of candidates) {
    if (!Number.isSafeInteger(candidate.costRank) || candidate.costRank < 0) {
      throw new Error(`Model ${candidate.model} has an invalid cost rank.`);
    }
    const identity = `${candidate.provider}/${candidate.model}`;
    if (identities.has(identity)) throw new Error(`Duplicate model candidate: ${identity}.`);
    identities.add(identity);
  }
  const models = await Promise.all(
    candidates.map(async (candidate): Promise<ProbedModel> => {
      options.signal?.throwIfAborted();
      try {
        const probe = await options.probe.probe(candidate, options.signal);
        options.signal?.throwIfAborted();
        const declared = new Set(candidate.declaredCapabilities);
        return {
          ...candidate,
          probe: {
            ...probe,
            capabilities: probe.capabilities.filter((capability) => declared.has(capability)),
            efforts: probe.efforts.filter((effort) => candidate.efforts.includes(effort)),
          },
        };
      } catch (cause) {
        options.signal?.throwIfAborted();
        return {
          ...candidate,
          probe: {
            available: false,
            capabilities: [],
            efforts: [],
            checkedAt: Date.now(),
            reason: cause instanceof Error ? cause.message : 'Capability probe failed.',
          },
        };
      }
    }),
  );
  return Object.freeze({
    version: MODEL_POLICY_VERSION,
    models,
    select: (role: ModelRole) => selectLowestQualifiedModel(role, models),
  });
}

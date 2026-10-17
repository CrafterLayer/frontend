import type {
  AgentAssignment,
  PlanRevision,
  ReviewAudit,
  ReviewRecord,
  RouteDecision,
  TaskScenario,
} from './types';

const minimumBriefLength = 12;
const modelFallbacks: Record<string, string[]> = {
  Luna: ['Terra', 'Sol'],
  Terra: ['Sol', 'Luna'],
  Sol: ['Terra', 'Luna'],
  Sonnet: ['Opus'],
  Opus: ['Sonnet'],
};

function createAssignment(
  provider: AgentAssignment['provider'],
  model: string,
  role: AgentAssignment['role'],
): AgentAssignment {
  return { provider, model, role };
}

function isHighComplexity(scenario: TaskScenario): boolean {
  return (
    scenario.risk === 'critical' ||
    scenario.workClass === 'architecture' ||
    scenario.workClass === 'security'
  );
}

function replaceUnavailableModel(
  assignment: AgentAssignment,
  unavailableModel: TaskScenario['unavailableModel'],
): { assignment: AgentAssignment; replacedModel: string | null } | null {
  if (unavailableModel === null || assignment.model !== unavailableModel) {
    return { assignment, replacedModel: null };
  }

  const replacement = modelFallbacks[assignment.model]?.find((model) => model !== unavailableModel);

  if (replacement === undefined) {
    return null;
  }

  return {
    assignment: { ...assignment, model: replacement },
    replacedModel: assignment.model,
  };
}

function applyModelAvailability(
  decision: RouteDecision,
  scenario: TaskScenario,
): RouteDecision | null {
  const writer = replaceUnavailableModel(decision.writer, scenario.unavailableModel);
  const reviewer = replaceUnavailableModel(decision.reviewer, scenario.unavailableModel);

  if (writer === null || reviewer === null) {
    return null;
  }

  const replacedModels = [writer.replacedModel, reviewer.replacedModel].filter(
    (model): model is string => model !== null,
  );

  if (replacedModels.length === 0 || scenario.unavailableModel === null) {
    return decision;
  }

  return {
    ...decision,
    writer: writer.assignment,
    reviewer: reviewer.assignment,
    signals: [
      ...decision.signals,
      `${scenario.unavailableModel} is unavailable, so the local policy selected an allowed model-tier fallback.`,
    ],
    fallback: `${[...new Set(replacedModels)].join(' and ')} is unavailable. ${decision.fallback}`,
  };
}

export function routeScenario(scenario: TaskScenario): RouteDecision | null {
  if (scenario.brief.trim().length < minimumBriefLength) {
    return null;
  }

  const { claude, codex } = scenario.availability;

  if (scenario.orchestrationMode === 'codex-native') {
    if (!codex) {
      return null;
    }

    const highComplexity = isHighComplexity(scenario);
    const lowRiskMechanical = scenario.workClass === 'mechanical' && scenario.risk === 'low';

    return applyModelAvailability(
      {
        writer: createAssignment(
          'codex',
          highComplexity ? 'Sol' : lowRiskMechanical ? 'Luna' : 'Terra',
          'writer',
        ),
        reviewer: createAssignment('codex', highComplexity ? 'Terra' : 'Sol', 'reviewer'),
        reasoningEffort: highComplexity ? 'high' : lowRiskMechanical ? 'low' : 'medium',
        safetyLane: highComplexity ? 'critical' : lowRiskMechanical ? 'standard' : 'elevated',
        signals: [
          'This task began in Codex-native mode, so Claude is never started automatically.',
          'Codex uses a fresh reviewer session with a non-overlapping reviewer role.',
        ],
        fallback:
          'Codex-native is active. Start a Claude-adaptive session explicitly for cross-provider execution.',
        reviewerIndependence: 'fresh-session',
        confidence: 'guided',
      },
      scenario,
    );
  }

  if (!claude) {
    return null;
  }

  const highComplexity = isHighComplexity(scenario);

  if (codex) {
    if (highComplexity) {
      return applyModelAvailability(
        {
          writer: createAssignment('claude', 'Opus', 'writer'),
          reviewer: createAssignment('codex', 'Sol', 'reviewer'),
          reasoningEffort: 'high',
          safetyLane: 'critical',
          signals: [
            'Architecture or security signal requires the high-assurance lane.',
            'Claude owns the single write lane; Codex provides an independent plan/code review.',
          ],
          fallback: 'No fallback is active. Both provider lanes are available.',
          reviewerIndependence: 'cross-provider',
          confidence: 'guided',
        },
        scenario,
      );
    }

    if (scenario.workClass === 'mechanical' && scenario.risk === 'low') {
      return applyModelAvailability(
        {
          writer: createAssignment('codex', 'Luna', 'writer'),
          reviewer: createAssignment('claude', 'Sonnet', 'reviewer'),
          reasoningEffort: 'low',
          safetyLane: 'standard',
          signals: [
            'Low-risk mechanical work prioritizes fast, bounded execution.',
            'A separate Claude review protects the writer/reviewer boundary.',
          ],
          fallback: 'No fallback is active. Both provider lanes are available.',
          reviewerIndependence: 'cross-provider',
          confidence: 'guided',
        },
        scenario,
      );
    }

    return applyModelAvailability(
      {
        writer: createAssignment('codex', 'Terra', 'writer'),
        reviewer: createAssignment('claude', 'Sonnet', 'reviewer'),
        reasoningEffort: 'medium',
        safetyLane: 'elevated',
        signals: [
          'Implementation work benefits from a balanced coding lane.',
          'A fresh cross-provider review is required before release approval.',
        ],
        fallback: 'No fallback is active. Both provider lanes are available.',
        reviewerIndependence: 'cross-provider',
        confidence: 'guided',
      },
      scenario,
    );
  }

  return applyModelAvailability(
    {
      writer: createAssignment('claude', highComplexity ? 'Opus' : 'Sonnet', 'writer'),
      reviewer: createAssignment('claude', highComplexity ? 'Sonnet' : 'Opus', 'reviewer'),
      reasoningEffort: highComplexity ? 'high' : 'medium',
      safetyLane: highComplexity ? 'critical' : 'elevated',
      signals: [
        'Only the Claude lane is available for this local scenario.',
        'Writer and reviewer are separated by fresh sessions and non-overlapping roles.',
      ],
      fallback: 'Codex is unavailable, so the route uses a fresh Claude reviewer session.',
      reviewerIndependence: 'fresh-session',
      confidence: 'guided',
    },
    scenario,
  );
}

export function inspectPlanReviews(plan: PlanRevision, reviews: ReviewRecord[]): ReviewAudit {
  const currentReviews = reviews.filter((review) => review.revisionId === plan.id);
  const staleReviews = reviews.filter((review) => review.revisionId !== plan.id);
  const providers = new Set(currentReviews.map((review) => review.provider));
  const hasBothProviders = providers.has('claude') && providers.has('codex');
  const hasRequestedChanges = currentReviews.some(
    (review) => review.verdict === 'changes-requested',
  );

  if (hasRequestedChanges) {
    return {
      status: 'blocked',
      currentReviews,
      staleReviews,
      nextAction: 'Resolve requested changes, freeze a revision, then obtain two fresh reviews.',
    };
  }

  if (hasBothProviders) {
    return {
      status: 'ready',
      currentReviews,
      staleReviews,
      nextAction: 'Plan is ready for its single-writer implementation lane.',
    };
  }

  if (staleReviews.length > 0) {
    return {
      status: 'stale',
      currentReviews,
      staleReviews,
      nextAction: 'Re-run Claude and Codex plan reviews against the current frozen revision.',
    };
  }

  return {
    status: 'needs-review',
    currentReviews,
    staleReviews,
    nextAction: 'Obtain one current Claude review and one current Codex review.',
  };
}

export function createMaterialRevision(plan: PlanRevision): PlanRevision {
  return {
    id: `${plan.id}-revision`,
    label: `${plan.label.replace('frozen', 'materially revised')} · reviews required`,
  };
}

import type { DemoRun, PlanRevision, ReviewRecord, TaskScenario } from './types';

export const initialScenario: TaskScenario = {
  brief: 'Add a resilient release approval gate to the workspace workflow.',
  workClass: 'implementation',
  risk: 'standard',
  orchestrationMode: 'codex-native',
  unavailableModel: null,
  availability: {
    claude: true,
    codex: true,
  },
};

export const initialPlanRevision: PlanRevision = {
  id: 'plan-r7',
  label: 'Plan R7 · frozen for dual review',
};

export const initialReviewRecords: ReviewRecord[] = [
  {
    id: 'claude-opus-plan-r7',
    provider: 'claude',
    model: 'Opus',
    revisionId: 'plan-r7',
    verdict: 'approved',
    summary: 'Clarified the degraded-provider fallback and release authority.',
    findings: [
      {
        id: 'F-CLAUDE-01',
        requirement: 'FR-008',
        severity: 'medium',
        summary: 'Fallback authority should remain visible in every degraded lane.',
        nextAction: 'Keep the provider and model fallback statement next to the route decision.',
      },
    ],
  },
  {
    id: 'codex-sol-plan-r7',
    provider: 'codex',
    model: 'Sol',
    revisionId: 'plan-r7',
    verdict: 'approved',
    summary: 'Confirmed the single-writer boundary and verification order.',
    findings: [
      {
        id: 'F-CODEX-01',
        requirement: 'FR-004',
        severity: 'high',
        summary: 'One bounded scope must retain one writer lease at a time.',
        nextAction: 'Block implementation while the plan-review gate is stale or incomplete.',
      },
      {
        id: 'F-CODEX-02',
        requirement: 'FR-007',
        severity: 'medium',
        summary: 'Release evidence needs a source and a visible outcome.',
        nextAction: 'Keep each verification record in the evidence ledger until release approval.',
      },
    ],
  },
];

export const changesRequestedReviewRecords: ReviewRecord[] = initialReviewRecords.map((review) =>
  review.provider === 'claude'
    ? {
        ...review,
        verdict: 'changes-requested',
        summary: 'A high-risk plan issue requires a change before the writer lease can begin.',
        findings: [
          {
            id: 'F-CLAUDE-BLOCK-01',
            requirement: 'FR-005',
            severity: 'high',
            summary: 'The rollback condition is missing from the frozen plan.',
            nextAction:
              'Add a rollback decision, freeze a new revision, then obtain two fresh reviews.',
          },
        ],
      }
    : review,
);

export function createReviewRecordsForScenario(scenario: TaskScenario): ReviewRecord[] {
  if (scenario.orchestrationMode === 'codex-native') {
    return scenario.availability.codex
      ? [
          {
            id: 'codex-sol-plan-r7',
            provider: 'codex',
            model: 'Sol',
            revisionId: initialPlanRevision.id,
            verdict: 'approved',
            summary:
              'Codex-native does not start Claude automatically, so the cross-provider plan gate remains incomplete.',
            findings: [
              {
                id: 'F-CODEX-NATIVE-01',
                requirement: 'FR-005',
                severity: 'medium',
                summary: 'The independent Claude plan review is unavailable in this entry mode.',
                nextAction:
                  'Start Claude-adaptive explicitly before requesting the cross-provider review.',
              },
            ],
          },
        ]
      : [];
  }

  if (scenario.availability.claude && scenario.availability.codex) {
    return initialReviewRecords;
  }

  if (scenario.availability.codex) {
    return [
      {
        id: 'codex-sol-plan-r7',
        provider: 'codex',
        model: 'Sol',
        revisionId: initialPlanRevision.id,
        verdict: 'approved',
        summary:
          'Current Codex review is present, but the independent Claude review is unavailable.',
        findings: [
          {
            id: 'F-CODEX-ONLY-01',
            requirement: 'FR-005',
            severity: 'medium',
            summary: 'The independent Claude review is unavailable.',
            nextAction: 'Restore Claude before a cross-provider plan audit can become ready.',
          },
        ],
      },
    ];
  }

  if (scenario.availability.claude) {
    return [
      {
        id: 'claude-opus-plan-r7',
        provider: 'claude',
        model: 'Opus',
        revisionId: initialPlanRevision.id,
        verdict: 'approved',
        summary:
          'Current Claude review is present, but the independent Codex review is unavailable.',
        findings: [
          {
            id: 'F-CLAUDE-ONLY-01',
            requirement: 'FR-005',
            severity: 'medium',
            summary: 'The independent Codex review is unavailable.',
            nextAction: 'Restore Codex before a cross-provider plan audit can become ready.',
          },
        ],
      },
    ];
  }

  return [];
}

export const initialDemoRun: DemoRun = {
  stages: [
    {
      label: 'Specify',
      description: 'Task outcomes and boundaries recorded.',
      status: 'complete',
    },
    {
      label: 'Plan audit',
      description: 'Two reviewers matched the frozen revision.',
      status: 'complete',
    },
    {
      label: 'Implement',
      description: 'One bounded writer lease is active.',
      status: 'active',
    },
    {
      label: 'Verify',
      description: 'Focused checks wait for the writer result.',
      status: 'gated',
    },
    {
      label: 'Release gate',
      description: 'Blocked until current verification evidence exists.',
      status: 'gated',
    },
  ],
  writerLease: {
    status: 'active',
    owner: {
      provider: 'codex',
      model: 'Terra',
      role: 'writer',
    },
    scope: 'apps/adaptive-spec-router/**',
    statement: 'One writer owns this bounded path. Parallel writers are not permitted.',
  },
  evidence: [
    {
      id: 'EV-014',
      source: 'Plan review · Claude Opus',
      result: 'passed',
      gate: 'Dual review freshness',
      detail: 'Plan R7 matches the Claude review record.',
    },
    {
      id: 'EV-015',
      source: 'Plan review · Codex Sol',
      result: 'passed',
      gate: 'Dual review freshness',
      detail: 'Plan R7 matches the Codex review record.',
    },
    {
      id: 'EV-016',
      source: 'Writer lease',
      result: 'passed',
      gate: 'Execution ownership',
      detail: 'The implementation scope is owned by one active writer.',
    },
    {
      id: 'EV-017',
      source: 'Verification suite',
      result: 'waiting',
      gate: 'Release readiness',
      detail: 'Verification starts only after the active writer returns evidence.',
    },
  ],
  releaseGate: 'waiting',
};

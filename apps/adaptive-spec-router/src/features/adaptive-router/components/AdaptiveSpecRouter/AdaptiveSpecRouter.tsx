import { useMemo, useState } from 'react';

import {
  createReviewRecordsForScenario,
  initialDemoRun,
  initialPlanRevision,
  initialScenario,
} from '../../model/demo-data';
import {
  createMaterialRevision,
  inspectPlanReviews,
  routeScenario,
} from '../../model/routing-policy';
import type {
  DemoRun,
  EvidenceRecord,
  PlanRevision,
  ReviewAudit,
  TaskScenario,
} from '../../model/types';
import { EvidenceConsole } from '../EvidenceConsole';
import { PlanReviewAudit } from '../PlanReviewAudit';
import { RouteDecisionPanel } from '../RouteDecisionPanel';
import { ScenarioComposer } from '../ScenarioComposer';

function createPlanEvidence(audit: ReviewAudit): EvidenceRecord[] {
  const reviews = audit.currentReviews.length > 0 ? audit.currentReviews : audit.staleReviews;

  return reviews.map((review, index) => ({
    id: `EV-0${String(14 + index)}`,
    source: `Plan review · ${review.provider === 'codex' ? 'Codex' : 'Claude'} ${review.model}`,
    result: audit.status === 'ready' ? 'passed' : 'blocked',
    gate: 'Plan review freshness',
    detail:
      audit.status === 'ready'
        ? `${review.revisionId} matches this independent reviewer record.`
        : audit.status === 'stale'
          ? `${review.revisionId} does not match the current frozen plan revision.`
          : audit.status === 'blocked'
            ? 'A current review requested changes before the writer lease can begin.'
            : 'This review is current, but the independent cross-provider review gate is incomplete.',
  }));
}

function createRunState(decision: ReturnType<typeof routeScenario>, audit: ReviewAudit): DemoRun {
  const planReady = audit.status === 'ready';
  const writerCanStart = decision !== null && planReady;
  const writerLease =
    decision === null
      ? {
          ...initialDemoRun.writerLease,
          status: 'none' as const,
          statement: 'No writer lease is issued until the scenario has a valid, available route.',
        }
      : {
          ...initialDemoRun.writerLease,
          status: writerCanStart ? ('active' as const) : ('reserved' as const),
          owner: decision.writer,
          statement: writerCanStart
            ? 'One writer owns this bounded path. Parallel writers are not permitted.'
            : 'A writer is selected, but its lease is reserved until the plan-review gate is ready.',
        };

  return {
    ...initialDemoRun,
    stages: initialDemoRun.stages.map((stage) => {
      if (stage.label === 'Plan audit') {
        return {
          ...stage,
          status: planReady ? 'complete' : 'blocked',
          description: planReady
            ? 'Two reviewers matched the frozen revision.'
            : 'Current plan reviews must be renewed before implementation can proceed.',
        };
      }

      if (stage.label === 'Implement' && !writerCanStart) {
        return {
          ...stage,
          status: 'gated',
          description:
            decision === null
              ? 'No writer route is available until the current scenario is valid and available.'
              : 'No writer may begin until the two plan reviews are current.',
        };
      }

      return stage;
    }),
    writerLease,
    evidence: [
      ...createPlanEvidence(audit),
      ...initialDemoRun.evidence
        .filter((record) => record.id !== 'EV-014' && record.id !== 'EV-015')
        .map((record): EvidenceRecord => {
          if (record.id === 'EV-016') {
            return {
              ...record,
              result: writerCanStart ? 'passed' : 'blocked',
              detail: writerCanStart
                ? 'The implementation scope is owned by one active writer.'
                : 'No active writer lease exists while the route or plan-review gate is incomplete.',
            };
          }

          return {
            ...record,
            result: writerCanStart ? record.result : 'blocked',
            detail: writerCanStart
              ? record.detail
              : 'Verification cannot begin before a valid route has a current dual plan review.',
          };
        }),
    ],
    releaseGate: writerCanStart ? 'waiting' : 'blocked',
  };
}

export function AdaptiveSpecRouter() {
  const [scenario, setScenario] = useState<TaskScenario>(initialScenario);
  const [plan, setPlan] = useState<PlanRevision>(initialPlanRevision);
  const [routeInvalid, setRouteInvalid] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const routedDecision = useMemo(() => routeScenario(scenario), [scenario]);
  const decision = routeInvalid ? null : routedDecision;
  const reviewRecords = useMemo(() => createReviewRecordsForScenario(scenario), [scenario]);
  const audit = useMemo(() => inspectPlanReviews(plan, reviewRecords), [plan, reviewRecords]);
  const run = useMemo(() => createRunState(decision, audit), [audit, decision]);

  function handleMaterialRevision() {
    setPlan((current) => createMaterialRevision(current));
  }

  function handleReset() {
    setScenario(initialScenario);
    setPlan(initialPlanRevision);
    setRouteInvalid(false);
    setResetVersion((current) => current + 1);
  }

  return (
    <div className="asr-shell">
      <header className="asr-topbar">
        <div className="asr-brand">
          <span className="asr-brand-mark" aria-hidden="true">
            ASR
          </span>
          <div>
            <h1>Adaptive Spec Router</h1>
            <p>Explainable multi-model delivery governance</p>
          </div>
        </div>
        <span className="asr-local-badge">Local deterministic demo · no provider connected</span>
      </header>

      <main className="asr-content">
        <section className="asr-hero" aria-labelledby="router-hero-title">
          <div>
            <p className="asr-eyebrow">Command center / policy simulation</p>
            <h2 id="router-hero-title">
              Route work by risk, preserve one writer, and make every gate explainable.
            </h2>
            <p className="asr-hero-copy">
              Try the policy before you connect any provider. This product uses illustrative local
              data only: it never reads code, sends prompts, starts agents, or changes a repository.
            </p>
          </div>
          <div className="asr-hero-metrics" aria-label="Product principles">
            <div className="asr-hero-metric">
              <strong>1 writer</strong>
              <span>per bounded scope</span>
            </div>
            <div className="asr-hero-metric">
              <strong>2 reviews</strong>
              <span>per frozen plan</span>
            </div>
            <div className="asr-hero-metric">
              <strong>0 secrets</strong>
              <span>in this demo</span>
            </div>
          </div>
        </section>

        <div className="asr-grid">
          <ScenarioComposer
            key={`${String(resetVersion)}-${JSON.stringify(scenario)}`}
            scenario={scenario}
            onApply={(nextScenario) => {
              setScenario(nextScenario);
              setRouteInvalid(false);
            }}
            onInvalid={() => {
              setRouteInvalid(true);
            }}
          />
          <RouteDecisionPanel decision={decision} scenario={scenario} />
        </div>

        <PlanReviewAudit plan={plan} audit={audit} onMaterialRevision={handleMaterialRevision} />
        <EvidenceConsole run={run} />
      </main>

      <footer className="asr-footer">
        <p>
          This prototype is intentionally a decision and evidence experience. Provider adapters,
          live execution, persistence, user accounts, and publication remain future product
          decisions.
        </p>
        <button className="asr-button asr-button-secondary" type="button" onClick={handleReset}>
          Reset demo
        </button>
      </footer>
    </div>
  );
}

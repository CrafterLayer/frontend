import type { AgentAssignment, RouteDecision, TaskScenario } from '../../model/types';

interface RouteDecisionPanelProps {
  decision: RouteDecision | null;
  scenario: TaskScenario;
}

function formatAssignment(assignment: AgentAssignment): string {
  return `${assignment.provider === 'codex' ? 'Codex' : 'Claude'} · ${assignment.model}`;
}

function formatSafetyLane(value: RouteDecision['safetyLane']): string {
  return value === 'standard'
    ? 'Standard lane'
    : `${value.slice(0, 1).toUpperCase()}${value.slice(1)} lane`;
}

export function RouteDecisionPanel({ decision, scenario }: RouteDecisionPanelProps) {
  if (decision === null) {
    return (
      <section className="asr-panel asr-route-panel" aria-labelledby="route-title">
        <header className="asr-panel-header">
          <div>
            <h2 id="route-title">Route decision</h2>
            <p>Policy decisions become visible here.</p>
          </div>
          <span className="asr-status asr-status-stale">Needs input</span>
        </header>
        <p className="asr-no-route" role="status">
          {scenario.orchestrationMode === 'codex-native' && !scenario.availability.codex
            ? 'Codex-native mode will not start Claude automatically. Restore Codex or explicitly start a Claude-adaptive session.'
            : 'Add a clearer brief and keep the selected workflow entry provider available to create a local route decision.'}
        </p>
      </section>
    );
  }

  return (
    <section className="asr-panel asr-route-panel" aria-labelledby="route-title">
      <header className="asr-panel-header">
        <div>
          <h2 id="route-title">Route decision</h2>
          <p>One writer, one independent reviewer, and an explainable safety lane.</p>
        </div>
        <span className={`asr-status asr-status-${decision.safetyLane}`}>
          {formatSafetyLane(decision.safetyLane)}
        </span>
      </header>

      <div className="asr-route-grid">
        <article className="asr-assignment" aria-label="Designated writer">
          <span className="asr-assignment-label">Designated writer</span>
          <strong>{formatAssignment(decision.writer)}</strong>
          <span>Owns the only editing lease for this bounded task.</span>
        </article>
        <article className="asr-assignment" aria-label="Independent reviewer">
          <span className="asr-assignment-label">Independent reviewer</span>
          <strong>{formatAssignment(decision.reviewer)}</strong>
          <span>
            {decision.reviewerIndependence === 'cross-provider'
              ? 'Separate provider review lane.'
              : 'Separate fresh reviewer session.'}
          </span>
        </article>
      </div>

      <div className="asr-route-detail-grid" aria-label="Route safety details">
        <div className="asr-detail">
          <span>Reasoning</span>
          <strong>{decision.reasoningEffort}</strong>
        </div>
        <div className="asr-detail">
          <span>Independence</span>
          <strong>
            {decision.reviewerIndependence === 'cross-provider'
              ? 'Cross-provider'
              : 'Fresh session'}
          </strong>
        </div>
        <div className="asr-detail">
          <span>Confidence</span>
          <strong>{decision.confidence}</strong>
        </div>
      </div>

      <ul className="asr-signal-list" aria-label="Route decision signals">
        {decision.signals.map((signal) => (
          <li key={signal}>{signal}</li>
        ))}
      </ul>

      <p className="asr-fallback" aria-label="Fallback status">
        <strong>Fallback status: </strong>
        {decision.fallback}
      </p>
    </section>
  );
}

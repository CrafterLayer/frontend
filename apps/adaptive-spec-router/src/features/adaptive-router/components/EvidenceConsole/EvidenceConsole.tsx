import type { DemoRun, EvidenceRecord, RunStageStatus } from '../../model/types';

interface EvidenceConsoleProps {
  run: DemoRun;
}

function stageLabel(status: RunStageStatus): string {
  const labels: Record<RunStageStatus, string> = {
    complete: 'Complete',
    active: 'Active',
    gated: 'Gated',
    blocked: 'Blocked',
  };

  return labels[status];
}

function gateLabel(status: DemoRun['releaseGate']): string {
  const labels: Record<DemoRun['releaseGate'], string> = {
    ready: 'Release ready',
    waiting: 'Release waiting',
    blocked: 'Release blocked',
  };

  return labels[status];
}

function leaseLabel(status: DemoRun['writerLease']['status']): string {
  const labels: Record<DemoRun['writerLease']['status'], string> = {
    active: 'Active writer lease',
    reserved: 'Reserved writer lease',
    none: 'No writer lease',
  };

  return labels[status];
}

function evidenceClassName(result: EvidenceRecord['result']): string {
  const classNames: Record<EvidenceRecord['result'], string> = {
    passed: 'asr-status-passed',
    waiting: 'asr-status-waiting',
    blocked: 'asr-status-blocked',
  };

  return classNames[result];
}

export function EvidenceConsole({ run }: EvidenceConsoleProps) {
  const owner = `${run.writerLease.owner.provider === 'codex' ? 'Codex' : 'Claude'} · ${run.writerLease.owner.model}`;

  return (
    <section className="asr-panel" aria-labelledby="evidence-console-title">
      <header className="asr-section-heading">
        <div>
          <h2 id="evidence-console-title">Execution evidence</h2>
          <p>Illustrative run state only — no agent, repository, or provider is connected.</p>
        </div>
        <span className={`asr-status asr-status-${run.releaseGate}`}>
          {gateLabel(run.releaseGate)}
        </span>
      </header>

      <div className="asr-evidence-grid">
        <div>
          <ol className="asr-timeline" aria-label="Run timeline">
            {run.stages.map((stage) => (
              <li className={`asr-status-${stage.status}`} key={stage.label}>
                <span className="asr-stage-marker" aria-hidden="true" />
                <div className="asr-stage-body">
                  <strong>
                    {stage.label}
                    <span className={`asr-status asr-status-${stage.status}`}>
                      {stageLabel(stage.status)}
                    </span>
                  </strong>
                  <p>{stage.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <aside className="asr-lease" aria-label={leaseLabel(run.writerLease.status)}>
            <div className="asr-lease-heading">
              <div>
                <span className="asr-micro-label">{leaseLabel(run.writerLease.status)}</span>
                <h3>{run.writerLease.status === 'none' ? 'No designated writer' : owner}</h3>
                <p>
                  {run.writerLease.status === 'none'
                    ? 'A valid route and a current plan-review gate are required first.'
                    : `Role: ${run.writerLease.owner.role}`}
                </p>
              </div>
              <span
                className={`asr-status asr-status-${run.writerLease.status === 'active' ? 'active' : 'gated'}`}
              >
                {run.writerLease.status === 'active' ? 'One writer' : 'Not active'}
              </span>
            </div>
            {run.writerLease.status === 'none' ? null : (
              <code className="asr-lease-scope">{run.writerLease.scope}</code>
            )}
            <p className="asr-lease-statement">{run.writerLease.statement}</p>
          </aside>
        </div>

        <div>
          <ul className="asr-evidence-list" aria-label="Evidence ledger">
            {run.evidence.map((record) => (
              <li className="asr-evidence-row" key={record.id}>
                <div>
                  <span className="asr-micro-label">{record.id}</span>
                  <h3>{record.gate}</h3>
                  <p>{record.detail}</p>
                </div>
                <div className="asr-evidence-meta">
                  <span>{record.source}</span>
                  <span className={`asr-evidence-result ${evidenceClassName(record.result)}`}>
                    {record.result}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

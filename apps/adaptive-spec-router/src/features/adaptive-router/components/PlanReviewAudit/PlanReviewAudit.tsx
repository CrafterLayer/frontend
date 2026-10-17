import type { PlanRevision, ReviewAudit, ReviewRecord } from '../../model/types';

interface PlanReviewAuditProps {
  plan: PlanRevision;
  audit: ReviewAudit;
  onMaterialRevision: () => void;
}

function statusLabel(status: ReviewAudit['status']): string {
  const labels: Record<ReviewAudit['status'], string> = {
    ready: 'Ready for implementation',
    stale: 'Reviews are stale',
    'needs-review': 'Reviews required',
    blocked: 'Changes requested',
  };

  return labels[status];
}

function renderReviewLabel(review: ReviewRecord): string {
  const provider = review.provider === 'codex' ? 'Codex' : 'Claude';
  return `${provider} · ${review.model}`;
}

export function PlanReviewAudit({ plan, audit, onMaterialRevision }: PlanReviewAuditProps) {
  const canRevise = audit.status === 'ready';

  return (
    <section className="asr-panel" aria-labelledby="plan-audit-title">
      <header className="asr-section-heading">
        <div>
          <h2 id="plan-audit-title">Dual plan audit</h2>
          <p>{plan.label}</p>
        </div>
        <span className={`asr-status asr-status-${audit.status}`}>{statusLabel(audit.status)}</span>
      </header>

      <div className="asr-plan-grid">
        <div>
          <div className="asr-plan-status" role="status">
            <div>
              <strong>{statusLabel(audit.status)}</strong>
              <p>{audit.nextAction}</p>
            </div>
            <span className="asr-chip">Revision {plan.id}</span>
          </div>

          <ul className="asr-review-list" aria-label="Current plan reviews">
            {audit.currentReviews.map((review) => (
              <li className="asr-review-row" key={review.id}>
                <div>
                  <h3>{renderReviewLabel(review)}</h3>
                  <p>{review.summary}</p>
                </div>
                <div className="asr-review-meta">
                  <span>{review.verdict === 'approved' ? 'Approved' : 'Changes requested'}</span>
                  <span>
                    {review.findings.length} finding{review.findings.length === 1 ? '' : 's'}
                  </span>
                  <span>Matches {review.revisionId}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="asr-finding-list" aria-label="Plan review findings">
            {audit.currentReviews.flatMap((review) =>
              review.findings.map((finding) => (
                <details className="asr-finding" key={finding.id}>
                  <summary>
                    <span className={`asr-status asr-status-${finding.severity}`}>
                      {finding.severity}
                    </span>
                    {review.provider === 'codex' ? 'Codex' : 'Claude'} · {finding.requirement}
                  </summary>
                  <div>
                    <p>{finding.summary}</p>
                    <p>
                      <strong>Next action: </strong>
                      {finding.nextAction}
                    </p>
                  </div>
                </details>
              )),
            )}
          </div>

          {audit.staleReviews.length === 0 ? null : (
            <ul className="asr-review-list" aria-label="Stale plan reviews">
              {audit.staleReviews.map((review) => (
                <li className="asr-review-row asr-review-stale" key={review.id}>
                  <div>
                    <h3>{renderReviewLabel(review)} · stale</h3>
                    <p>{review.summary}</p>
                  </div>
                  <div className="asr-review-meta">
                    <span>Reviewed {review.revisionId}</span>
                    <span>Does not match {plan.id}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="asr-lease" aria-label="Plan review gate">
          <div className="asr-lease-heading">
            <div>
              <span className="asr-micro-label">Freshness law</span>
              <h3>Same revision, two independent providers</h3>
              <p>Claude and Codex review the same frozen plan before one writer begins.</p>
            </div>
          </div>
          <div className="asr-button-row">
            <button
              className="asr-button asr-button-secondary"
              type="button"
              disabled={!canRevise}
              onClick={onMaterialRevision}
            >
              {canRevise ? 'Simulate material revision' : 'Reviews invalidated'}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

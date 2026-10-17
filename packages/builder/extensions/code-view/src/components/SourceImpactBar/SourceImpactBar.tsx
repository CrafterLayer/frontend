import type { SharedImpactApproval } from '@craftkit/builder-schema';

import './SourceImpactBar.css';

export type SourceImpact =
  | {
      readonly kind: 'instance';
      readonly pageId: string;
      readonly instanceId?: string | undefined;
    }
  | {
      readonly kind: 'shared';
      readonly componentName: string;
      readonly approval: SharedImpactApproval;
    };

export interface SourceImpactBarProps {
  impact: SourceImpact;
  /** Set after the source revision or affected identity set changes. */
  stale?: boolean | undefined;
  onOpenSource?: (() => void) | undefined;
  onRefresh?: (() => void) | undefined;
  onApply?: ((approval?: SharedImpactApproval) => void) | undefined;
}

function sharedSummary(impact: Extract<SourceImpact, { kind: 'shared' }>): string {
  const instances = impact.approval.instanceIds.length;
  const pages = impact.approval.pageIds.length;
  return `${impact.componentName} · ${String(instances)} ${instances === 1 ? 'instance' : 'instances'} · ${String(pages)} ${pages === 1 ? 'page' : 'pages'}`;
}

/** Makes the write scope and changed shared impact explicit before source approval. */
export function SourceImpactBar({
  impact,
  stale = false,
  onOpenSource,
  onRefresh,
  onApply,
}: SourceImpactBarProps) {
  const shared = impact.kind === 'shared';
  const title = shared ? 'Shared component' : 'Selected instance';
  const summary = shared ? sharedSummary(impact) : 'Instance only';
  const status = stale
    ? 'Impact changed. Refresh affected pages and instances before applying.'
    : shared
      ? 'This change affects every listed instance.'
      : 'This change remains on the selected instance.';

  return (
    <aside
      className="bldr-source-impact"
      data-scope={impact.kind}
      data-stale={stale ? 'true' : 'false'}
      aria-label="Source change impact"
    >
      <div className="bldr-source-impact__body">
        <strong>{title}</strong>
        <span>{summary}</span>
        <small>{status}</small>
      </div>
      <div className="bldr-source-impact__actions">
        {onOpenSource === undefined ? null : (
          <button type="button" onClick={onOpenSource}>
            Open source
          </button>
        )}
        {stale && onRefresh !== undefined ? (
          <button type="button" onClick={onRefresh}>
            Refresh impact
          </button>
        ) : null}
        {onApply === undefined ? null : (
          <button
            type="button"
            className="bldr-source-impact__apply"
            disabled={stale}
            onClick={() => {
              onApply(impact.kind === 'shared' ? impact.approval : undefined);
            }}
          >
            {shared ? 'Apply shared change' : 'Apply to instance'}
          </button>
        )}
      </div>
      <output className="bldr-source-impact__announcement" aria-live="polite" aria-atomic="true">
        {status}
      </output>
    </aside>
  );
}

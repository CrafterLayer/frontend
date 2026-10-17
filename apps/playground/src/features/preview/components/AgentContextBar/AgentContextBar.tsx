import './AgentContextBar.css';

export type AgentContextScope = 'site' | 'page' | 'instance' | 'shared' | 'stale';

export interface AgentContextBarProps {
  readonly scope: AgentContextScope;
  readonly label: string;
  readonly detail?: string | undefined;
}

const SCOPE_LABEL: Readonly<Record<AgentContextScope, string>> = {
  site: 'Site',
  page: 'Page',
  instance: 'Instance',
  shared: 'Shared component',
  stale: 'Target changed',
};

/** The captured execution scope, kept visible directly above the conversation. */
export function AgentContextBar({ scope, label, detail }: AgentContextBarProps) {
  return (
    <p
      className="pg-agent-context"
      data-scope={scope}
      {...(scope === 'stale' ? { role: 'alert', 'aria-live': 'assertive' as const } : {})}
      aria-label={`Agent context: ${SCOPE_LABEL[scope]}`}
    >
      <span className="pg-agent-context__scope">{SCOPE_LABEL[scope]}</span>
      <span className="pg-agent-context__label" dir="auto">{label}</span>
      {detail === undefined ? null : <span className="pg-agent-context__detail">{detail}</span>}
    </p>
  );
}

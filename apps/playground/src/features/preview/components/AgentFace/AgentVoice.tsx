/**
 * The character's visible voice — the panel's ONE live region. It is placed by
 * the panel under the name, outside every aria-hidden span, so what is
 * announced is exactly what people read. `dir="auto"` declares the CONTENT's
 * direction from its first strong character; the component sets no direction
 * on any layout box.
 */
import './AgentFace.css';

import { agentMoodText, type AgentLocale, type AgentMoodSnapshot } from './agent-mood';

export interface AgentVoiceProps {
  snapshot: AgentMoodSnapshot;
  /** Default `'ar'`. */
  locale?: AgentLocale | undefined;
  className?: string | undefined;
}

export function AgentVoice({ snapshot, locale = 'ar', className }: AgentVoiceProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      lang={locale}
      dir="auto"
      className={className === undefined ? 'pg-face-voice' : `pg-face-voice ${className}`}
    >
      {agentMoodText(snapshot, locale)}
    </p>
  );
}

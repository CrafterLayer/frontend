import { useCallback, type ReactNode } from 'react';

import {
  StatusBar,
  localHistoryLabel,
  type BuilderKernel,
  type StatusBarLabels,
} from '@craftkit/builder';

import type { EditorLocale } from './editor-labels';
import { useRecentChanges } from './use-recent-changes';

/** Same reason as `TransactionCount`: the provenance strip reads the transaction log through a hook. */
export function ProvenanceStatusBar({
  kernel,
  deviceLabel,
  saveState,
  agentSpeaks,
  agent,
  labels,
  phrases,
  locale,
}: {
  labels: StatusBarLabels;
  phrases: Readonly<Record<string, string>>;
  /** Recorded labels ("Edit text · Hero heading") read in this language. */
  locale: EditorLocale;
  kernel: BuilderKernel;
  deviceLabel: string;
  saveState: 'saved' | 'saving' | undefined;
  /** The v2 agent panel speaks for the assistant's changes (its thread, its pill). */
  agentSpeaks: boolean;
  agent: ReactNode;
}) {
  const localize = useCallback((label: string) => localHistoryLabel(label, locale), [locale]);
  const { changes, spokenElsewhere } = useRecentChanges(
    kernel,
    agentSpeaks ? { exclude: 'assistant', phrases, localize } : { phrases, localize },
  );
  return (
    <StatusBar
      changes={changes}
      // The assistant's changes are the panel's to list: never "No recent changes" over them.
      emptyLabel={spokenElsewhere ? null : undefined}
      deviceLabel={deviceLabel}
      saveState={saveState}
      agent={agent}
      labels={labels}
    />
  );
}

import type { DesignLibraryTransferLabels } from './DesignLibraryTransfer.labels';
import type { CollectionDiff } from './design-transfer';

export interface DesignDiffLineProps {
  readonly title: string;
  readonly diff: CollectionDiff;
  readonly labels: DesignLibraryTransferLabels;
}

/** One collection's line in the import preview: added, changed, removed, kept in use. */
export function DesignDiffLine({ title, diff, labels }: DesignDiffLineProps) {
  return (
    <li>
      <strong>{title}</strong>: {labels.counts(diff.added.length, diff.changed.length, diff.removed.length)}
      {diff.keptInUse.length > 0 ? (
        <span className="bldr-design-transfer__kept"> · {labels.keptInUse(diff.keptInUse.join(', '))}</span>
      ) : null}
    </li>
  );
}

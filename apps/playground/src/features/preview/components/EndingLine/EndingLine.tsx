import type { RunReceipt } from '../AssistantPanel/AssistantPanel.progress';

export interface EndingLineProps {
  /** How it ended, in the card's own word: "Stopped", "Failed". */
  readonly verb: string;
  /** What the run left behind. Undefined on a card revived from storage. */
  readonly receipt: RunReceipt | undefined;
}

/**
 * One quiet line for an ending: how long the run took, how far it got, and —
 * when the provider streamed any — its own last words.
 *
 * No em dash without a line to follow it, and no colour: a stop is not a
 * failure, and a failure already carries its own. The verb is the caller's,
 * because only the card knows whether this run was stopped or fell over.
 */
export function EndingLine({ verb, receipt }: EndingLineProps) {
  if (receipt === undefined) return null;
  return (
    <p className="pg-chat__receipt">
      {`${verb} after ${receipt.elapsed}`}
      {receipt.stageLabel === null ? '' : ` at ${receipt.stageLabel}`}
      {receipt.lastLine === undefined ? null : (
        <>
          {' — '}
          {/* Provider text: it declares its own direction, the chrome does not. */}
          <span dir="auto">{receipt.lastLine}</span>
        </>
      )}
    </p>
  );
}

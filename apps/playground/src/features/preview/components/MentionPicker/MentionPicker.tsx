import type { MentionCandidate } from '../AssistantPanel/AssistantPanel.mentions';

export interface MentionPickerProps {
  /** The blocks the trailing `@` currently points at. May be empty. */
  readonly candidates: readonly MentionCandidate[];
  /** Put this id into the draft, in place of the fragment being typed. */
  readonly onPick: (id: string) => void;
}

/**
 * The list under the caret while an `@` is open.
 *
 * A `listbox`, because that is what it is: a set of options, one of which will
 * be put into the field. The rows carry `aria-selected="false"` and no active
 * descendant — this picker is pointed at, not arrowed through, and claiming a
 * selection a person cannot move would be a worse lie than claiming none.
 *
 * It renders even when nothing matches, and says so. A picker that vanishes on
 * a typo is indistinguishable from a picker that never opened, and the person
 * is left wondering whether `@` works at all.
 */
export function MentionPicker({ candidates, onPick }: MentionPickerProps) {
  return (
    <div className="pg-chat__mentions" role="listbox" aria-label="Mention a block">
      {candidates.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          role="option"
          aria-selected="false"
          className="pg-chat__mention"
          onClick={() => {
            onPick(candidate.id);
          }}
        >
          <span className="pg-chat__mention-id">@{candidate.id}</span>
          <span className="pg-chat__mention-type">{candidate.type}</span>
          {candidate.excerpt === undefined ? null : (
            /* Author text: it declares its own direction, the chrome does not. */
            <span className="pg-chat__mention-excerpt" dir="auto">
              {candidate.excerpt}
            </span>
          )}
        </button>
      ))}
      {candidates.length === 0 ? (
        <p className="pg-chat__mention-empty">No matching block.</p>
      ) : null}
    </div>
  );
}

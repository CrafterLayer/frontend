import { useFieldLabels } from '../field-services-context';
import { richTextPlainText } from '../rich-text-plain-text';
import './RichTextFieldSkeleton.css';

export interface RichTextFieldSkeletonProps {
  /** The stored rich-text document — shown as its words, never as JSON. */
  readonly value: unknown;
  /** The row's control id, so the row's `<label htmlFor>` still names something. */
  readonly controlId?: string | undefined;
  readonly labelledBy?: string | undefined;
  readonly describedBy?: string | undefined;
  /**
   * `loading`: the editor module is on its way. `failed`: it did not arrive
   * or it threw — the frame then says so and offers Retry.
   */
  readonly state: 'loading' | 'failed';
  /** The sentence explaining a failure; the localized default when absent. */
  readonly error?: string | undefined;
  readonly onRetry?: (() => void) | undefined;
}

/**
 * What a rich-text row shows while its editor is not mounted: a DISABLED
 * editor frame holding the document's words.
 *
 * The rich-text editor is a lazily loaded contribution. Until it lands — and
 * whenever it fails to load or throws — the row used to fall back to a
 * read-only input holding `JSON.stringify(doc)`. That is the raw ProseMirror
 * JSON in the owner's screenshot (2026-10-06). This frame keeps the shape of
 * the editor (a toolbar strip, a text surface) so nothing jumps when the
 * editor arrives, shows the text a person wrote, and on failure explains what
 * happened and offers Retry instead of leaving a dead box.
 */
export function RichTextFieldSkeleton({
  value,
  controlId,
  labelledBy,
  describedBy,
  state,
  error,
  onRetry,
}: RichTextFieldSkeletonProps) {
  const labels = useFieldLabels();
  const text = richTextPlainText(value);
  const statusId = controlId === undefined ? undefined : `${controlId}-status`;
  const described = [describedBy, statusId].filter((id) => id !== undefined).join(' ');

  return (
    <div
      className="bldr-richtext-skeleton"
      data-state={state}
      aria-busy={state === 'loading' ? true : undefined}
    >
      <div className="bldr-richtext-skeleton__toolbar" aria-hidden="true">
        <span className="bldr-richtext-skeleton__tool" />
        <span className="bldr-richtext-skeleton__tool" />
        <span className="bldr-richtext-skeleton__tool" />
        <span className="bldr-richtext-skeleton__tool" />
      </div>
      <textarea
        id={controlId}
        className="bldr-richtext-skeleton__surface"
        dir="auto"
        readOnly
        disabled
        value={text}
        rows={Math.min(Math.max(text.split('\n').length, 2), 8)}
        aria-labelledby={labelledBy}
        aria-describedby={described === '' ? undefined : described}
      />
      <div className="bldr-richtext-skeleton__status">
        <p
          id={statusId}
          className="bldr-richtext-skeleton__message"
          role={state === 'failed' ? 'alert' : 'status'}
        >
          {state === 'failed' ? (error ?? labels.richTextFailed) : labels.richTextLoading}
        </p>
        {state === 'failed' && onRetry !== undefined ? (
          <button type="button" className="bldr-richtext-skeleton__retry" onClick={onRetry}>
            {labels.retry}
          </button>
        ) : null}
      </div>
    </div>
  );
}

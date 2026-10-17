import type { TreeTextActionLabels } from '../../../overlay/tree-text-actions';
import type { TreeTextSession } from '../../../overlay/tree-text-session';
import { TextBubble, type TextBubbleAction } from '../../TextBubble';

export interface TreeTextBubbleProps {
  /** Content direction of the canvas. */
  dir: 'ltr' | 'rtl';
  /** The formatting bubble's words (EN default; the host picks AR by locale). */
  labels: TreeTextActionLabels;
  /** The marks for the selected range (`treeTextBubbleActions`). */
  actions: TextBubbleAction[];
  /** The open in-place edit: what the link prompt formats and where focus returns. */
  session: Pick<TreeTextSession, 'format' | 'refocus' | 'suspendBlur'>;
  /** The range a link address is being asked for; null shows the actions. */
  linkRange: { readonly start: number; readonly end: number } | null;
  /** The link prompt closed (applied or cancelled). */
  onCloseLink: () => void;
  /** A refused link is said in the canvas's gesture region. */
  onAnnounce: (message: string) => void;
}

/**
 * P7: the formatting bubble over a selected range of a tree text element
 * being edited in place (style-manager DESIGN.md §E) — the marks, or the
 * link-address prompt. The session survives the prompt taking focus
 * (`suspendBlur`), and focus goes back into the text when the prompt closes.
 */
export function TreeTextBubble({
  dir,
  labels,
  actions,
  session,
  linkRange,
  onCloseLink,
  onAnnounce,
}: TreeTextBubbleProps) {
  return (
    <TextBubble
      dir={dir}
      label={labels.formatting}
      actions={actions}
      onReturnFocus={() => {
        session.refocus();
        return true;
      }}
      prompt={
        linkRange === null
          ? undefined
          : {
              label: labels.linkAddress,
              submitLabel: labels.apply,
              cancelLabel: labels.cancel,
              onSubmit: (href) => {
                const range = linkRange;
                onCloseLink();
                session.suspendBlur(false);
                const result = session.format({ mark: 'a', href, label: labels.link }, range);
                if (!result.ok) {
                  onAnnounce(result.message);
                  session.refocus();
                }
              },
              onCancel: () => {
                onCloseLink();
                session.suspendBlur(false);
                session.refocus();
              },
            }
      }
    />
  );
}

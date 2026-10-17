import type { TextBubbleAction } from '../components/TextBubble';
import type { TreeTextFormat, TreeTextSession } from './tree-text-session';

/*
  ── The bubble over a selected range of tree text (style-manager DESIGN.md §E)

  Bold, italic, underline, highlight, link, size and colour — each one
  `formatTreeText` over the selected characters, written with any pending
  typing as ONE transaction. Size and colour are runs with a class: a larger
  em-relative size (it scales with whatever size the element has) and the
  theme's accent colour, both token-safe on any page.
*/

export interface TreeTextActionLabels {
  readonly bold: string;
  readonly italic: string;
  readonly underline: string;
  readonly highlight: string;
  readonly link: string;
  readonly larger: string;
  readonly colour: string;
  readonly linkAddress: string;
  readonly apply: string;
  readonly cancel: string;
  readonly formatting: string;
}

export const TREE_TEXT_ACTION_LABELS_EN: TreeTextActionLabels = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  highlight: 'Highlight',
  link: 'Link',
  larger: 'Larger',
  colour: 'Accent colour',
  linkAddress: 'Link address',
  apply: 'Apply',
  cancel: 'Cancel',
  formatting: 'Formatting',
};

export const TREE_TEXT_ACTION_LABELS_AR: TreeTextActionLabels = {
  bold: 'عريض',
  italic: 'مائل',
  underline: 'تسطير',
  highlight: 'تمييز',
  link: 'رابط',
  larger: 'أكبر',
  colour: 'لون مميز',
  linkAddress: 'عنوان الرابط',
  apply: 'تطبيق',
  cancel: 'إلغاء',
  formatting: 'التنسيق',
};

/** The class a "Larger" run carries: relative, so it scales with the element. */
export const LARGER_RUN_CLASS = 'text-[1.25em]';
/** The class a colour run carries: the theme accent (a token utility). */
export const ACCENT_RUN_CLASS = 'text-accent';

export interface TreeTextActionCallbacks {
  /** The link action asks for an address; the range is captured before focus moves. */
  readonly onRequestLink: (range: { readonly start: number; readonly end: number }) => void;
  /** A refusal (or success) for the polite region. */
  readonly onResult: (result: { readonly ok: boolean; readonly message: string }) => void;
}

/** The bubble's actions for an open tree-text session. */
export function treeTextBubbleActions(
  session: TreeTextSession,
  labels: TreeTextActionLabels,
  callbacks: TreeTextActionCallbacks,
): TextBubbleAction[] {
  const mark = (id: string, label: string, format: TreeTextFormat): TextBubbleAction => ({
    id,
    label,
    run: () => {
      callbacks.onResult(session.format(format));
    },
  });
  return [
    mark('bold', labels.bold, { mark: 'strong', label: labels.bold }),
    mark('italic', labels.italic, { mark: 'em', label: labels.italic }),
    mark('underline', labels.underline, { mark: 'u', label: labels.underline }),
    mark('highlight', labels.highlight, { mark: 'mark', label: labels.highlight }),
    {
      id: 'link',
      label: labels.link,
      run: () => {
        const range = session.selectionRange();
        if (range === null) {
          callbacks.onResult({ ok: false, message: 'Select some text first' });
          return;
        }
        callbacks.onRequestLink(range);
      },
    },
    mark('larger', labels.larger, { mark: 'span', className: LARGER_RUN_CLASS, label: labels.larger }),
    mark('colour', labels.colour, { mark: 'span', className: ACCENT_RUN_CLASS, label: labels.colour }),
  ];
}

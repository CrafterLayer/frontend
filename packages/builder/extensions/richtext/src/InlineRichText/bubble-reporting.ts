import type { Editor, EditorEvents } from '@tiptap/core';

interface BubbleReportingOptions {
  editor: Editor;
  formattingMenuElement?: Element | null | undefined;
  report: () => void;
}

function carriesBlur(event: EditorEvents['transaction']): boolean {
  return (
    event.transaction.getMeta('blur') !== undefined ||
    event.appendedTransactions.some((transaction) => transaction.getMeta('blur') !== undefined)
  );
}

/**
 * Reports selection-dependent bubble state without tearing down the focus
 * destination during an editor → formatting-menu transfer.
 *
 * Focus moves in two synchronous steps: the editor blurs first, then the new
 * control becomes its document's `activeElement`. TipTap emits its blur
 * transaction before that second step, so reporting immediately would observe
 * neither owner and unmount the button being focused. A microtask runs after
 * the complete focus transfer, not after an arbitrary delay. Menu `focusin`
 * reports immediately and cancels that pending check; `focusout` uses the same
 * settled-state rule so leaving the chrome for unrelated content clears it.
 */
export function subscribeBubbleReports({
  editor,
  formattingMenuElement,
  report,
}: BubbleReportingOptions): () => void {
  let disposed = false;
  let reportRevision = 0;
  const hasFormattingMenu = formattingMenuElement !== undefined && formattingMenuElement !== null;

  const reportNow = () => {
    reportRevision += 1;
    if (!disposed) {
      report();
    }
  };
  const reportAfterFocusSettles = () => {
    const revision = reportRevision + 1;
    reportRevision = revision;
    queueMicrotask(() => {
      if (!disposed && reportRevision === revision) {
        report();
      }
    });
  };
  const onTransaction = (event: EditorEvents['transaction']) => {
    if (hasFormattingMenu && carriesBlur(event)) {
      reportAfterFocusSettles();
      return;
    }
    reportNow();
  };
  const onBlur = () => {
    if (hasFormattingMenu) {
      reportAfterFocusSettles();
      return;
    }
    // Hosts with no formatting chrome keep the historical immediate behavior.
    reportNow();
  };
  const onMenuFocusIn = () => {
    // `focusin` fires after the menu document has installed its activeElement.
    reportNow();
  };
  const onMenuFocusOut = () => {
    reportAfterFocusSettles();
  };

  reportNow();
  editor.on('selectionUpdate', reportNow);
  editor.on('transaction', onTransaction);
  editor.on('focus', reportNow);
  editor.on('blur', onBlur);
  formattingMenuElement?.addEventListener('focusin', onMenuFocusIn);
  formattingMenuElement?.addEventListener('focusout', onMenuFocusOut);

  return () => {
    disposed = true;
    reportRevision += 1;
    editor.off('selectionUpdate', reportNow);
    editor.off('transaction', onTransaction);
    editor.off('focus', reportNow);
    editor.off('blur', onBlur);
    formattingMenuElement?.removeEventListener('focusin', onMenuFocusIn);
    formattingMenuElement?.removeEventListener('focusout', onMenuFocusOut);
  };
}

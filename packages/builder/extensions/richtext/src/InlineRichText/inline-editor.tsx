import { useEffect, useRef, useState } from 'react';

import type { Editor } from '@tiptap/react';

import { safeHref } from '@craftkit/builder-renderer';
import type { InlineEditorProps, InlineFormatAction } from '@craftkit/builder-schema';

import { InlineRichText } from './InlineRichText';
import { subscribeBubbleReports } from './bubble-reporting';
import { shouldShowBubble } from './should-show';

/**
 * The registry adapter for the `inlineEditors` contribution point (009): the
 * shell (layer 3) never imports this extension (layer 4), so the canvas
 * resolves this component lazily and draws the bubble ITSELF from whatever
 * `onActions` reports. This file owns the SEMANTICS — which marks exist,
 * whether they are active, how to toggle them — and renders NO chrome and NO
 * geometry of its own.
 *
 * The action set is FR-006's: bold, italic, link, clear formatting — the
 * quick-format bubble, not the block toolbar (headings and lists stay
 * inspector concerns). Labels match the B3b toolbar so announcements stay
 * consistent.
 */

/** The B3b toolbar's link flow (minimal prompt; the design milestone replaces it). */
function runLink(editor: Editor): void {
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  const href = window.prompt('Link URL');
  if (href === null || href === '') {
    return;
  }
  // ONE allowlist for the whole system: a link the published page would
  // neutralize must never look live here (the B3b rule).
  if (safeHref(href) === undefined) {
    return;
  }
  editor.chain().focus().setLink({ href }).run();
}

/**
 * Actions for the CURRENT selection. Every `run` is ONE transaction (a chain
 * dispatches once) and starts with `focus()` so activating a bubble control
 * never strands the caret or drops the selection (risk 2). Empty whenever
 * `shouldShowBubble` says no bubble belongs on screen.
 */
function formatActions(
  editor: Editor,
  formattingMenuElement?: Element | null,
): InlineFormatAction[] {
  if (!shouldShowBubble(editor, formattingMenuElement)) {
    return [];
  }
  const can = editor.can();
  const linkActive = editor.isActive('link');
  return [
    {
      id: 'bold',
      label: 'Bold',
      pressed: editor.isActive('bold'),
      disabled: !can.chain().focus().toggleBold().run(),
      run: () => {
        editor.chain().focus().toggleBold().run();
      },
    },
    {
      id: 'italic',
      label: 'Italic',
      pressed: editor.isActive('italic'),
      disabled: !can.chain().focus().toggleItalic().run(),
      run: () => {
        editor.chain().focus().toggleItalic().run();
      },
    },
    {
      id: 'link',
      label: 'Link',
      pressed: linkActive,
      disabled: linkActive
        ? !can.chain().focus().unsetLink().run()
        : !can.chain().focus().setLink({ href: 'https://example.com/' }).run(),
      run: () => {
        runLink(editor);
      },
    },
    {
      // One-shot, so NO `pressed` key at all (the contract's toggles-only rule).
      id: 'clear',
      label: 'Clear formatting',
      disabled: !can.chain().focus().unsetAllMarks().clearNodes().run(),
      run: () => {
        editor.chain().focus().unsetAllMarks().clearNodes().run();
      },
    },
  ];
}

interface InlineRichTextEditorProps extends InlineEditorProps {
  /** Dev/test instrumentation — ONCE per editor (the package's existing pattern). */
  onEditorReady?: ((editor: Editor) => void) | undefined;
}

/**
 * Default export by contract: `InlineEditorDef.load` resolves this module and
 * mounts `default`. Commit, exit, and the deferred anchor source pass straight
 * through to `InlineRichText` (its report is structurally the schema's additive
 * anchor-report union); the actions channel is wired here from the same
 * `selectionUpdate`/`transaction`/`focus`/`blur` signals the source uses.
 */
export default function InlineRichTextEditor({
  value,
  label,
  onCommit,
  onExit,
  onAnchor,
  onActions,
  requestFormattingMenuFocus,
  formattingMenuElement,
  onEditorReady,
}: InlineRichTextEditorProps) {
  const [editor, setEditor] = useState<Editor | null>(null);

  const actionsRef = useRef(onActions);
  const readyRef = useRef(onEditorReady);
  useEffect(() => {
    actionsRef.current = onActions;
    readyRef.current = onEditorReady;
  });

  useEffect(() => {
    if (editor === null) {
      return;
    }
    const report = () => {
      actionsRef.current(formatActions(editor, formattingMenuElement));
    };
    const unsubscribe = subscribeBubbleReports({ editor, formattingMenuElement, report });
    return () => {
      unsubscribe();
      // Editing ended: an empty list hides the bubble — never stranded chrome.
      actionsRef.current([]);
    };
  }, [editor, formattingMenuElement]);

  return (
    <InlineRichText
      value={value}
      label={label}
      onCommit={onCommit}
      onExit={onExit}
      onSelectionChange={onAnchor}
      requestFormattingMenuFocus={requestFormattingMenuFocus}
      formattingMenuElement={formattingMenuElement}
      onEditorReady={(instance) => {
        setEditor(instance);
        readyRef.current?.(instance);
      }}
    />
  );
}

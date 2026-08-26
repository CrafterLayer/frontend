import { useEffect, useMemo, useRef, useState } from 'react';

import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { safeHref } from '@craftkit/builder-renderer';
import { emptyRichText } from '@craftkit/builder-schema';

import { canonicalJson } from './canonical-json';
import { RichTextToolbar } from './RichTextToolbar';
import { toStoredRichText } from './to-stored';
import type { RichTextFieldProps } from './RichTextField';

const asContent = (value: unknown): JSONContent =>
  typeof value === 'object' && value !== null ? value : (emptyRichText() as unknown as JSONContent);

/**
 * The editing surface (008 contract §3 e2/e3). StarterKit is configured DOWN to
 * the stored whitelist and its link allowlist is the RENDERER's, so the editor
 * can never show a link the published page would neutralize. Commits are one
 * projected dispatch per update; document truth wins on every external write —
 * including a REJECTED own commit, which reconciles back to the stored value
 * instead of stranding the editor on content the document does not hold.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
  labelledBy,
  onEditorReady,
}: RichTextFieldProps) {
  const lastEmittedRef = useRef<string | null>(null);
  /** Bumped per emission so the reconcile effect runs even when the door refused. */
  const [commitSeq, setCommitSeq] = useState(0);
  const [contentError, setContentError] = useState(false);
  const [refusedLink, setRefusedLink] = useState<string | null>(null);

  /**
   * The accessible name/description live on the CONTENTEDITABLE — EditorContent
   * spreads unknown props onto its wrapper div, which is not a labelable
   * element (§8 item 7). They are also LIVE: `describedBy` appears only once a
   * commit is refused, and editor options are frozen at creation, so the
   * attributes are re-applied whenever the ids change (§11 convergence fix).
   */
  const surfaceAttributes = useMemo(
    () => ({
      ...(controlId === undefined ? {} : { id: controlId }),
      ...(labelledBy === undefined ? {} : { 'aria-labelledby': labelledBy }),
      ...(describedBy === undefined ? {} : { 'aria-describedby': describedBy }),
      role: 'textbox',
      'aria-multiline': 'true',
      // Mixed ar/en prose: the editor follows its own content's direction.
      dir: 'auto',
      class: 'bldr-richtext-field__surface',
    }),
    [controlId, labelledBy, describedBy],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: false,
          // ONE allowlist for the whole system (§10 review fix H3).
          isAllowedUri: (uri) => typeof uri === 'string' && safeHref(uri) !== undefined,
        },
        // Everything outside the stored whitelist is OFF — the editor cannot
        // create a node the door rejects (e3).
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        trailingNode: false,
      }),
    ],
    content: asContent(value),
    editable: disabled !== true,
    // Loud, not silent (§10 review fix): a document the engine cannot load is
    // reported instead of being replaced by an empty one that the next
    // keystroke would commit over the user's real content.
    enableContentCheck: true,
    onContentError: () => {
      setContentError(true);
    },
    editorProps: { attributes: surfaceAttributes },
    onUpdate: ({ editor: live }) => {
      const projected = toStoredRichText(live.getJSON());
      lastEmittedRef.current = canonicalJson(projected);
      setRefusedLink(null);
      setCommitSeq((seq) => seq + 1);
      onChange(projected);
    },
  });

  // Document truth (e2). Runs on every incoming value AND after every emission:
  //  • accepted commit  ⇒ incoming === own emission ⇒ nothing to do
  //  • external write   ⇒ differs ⇒ re-seed (undo/redo/collab win)
  //  • REJECTED commit  ⇒ value unchanged, own emission differs ⇒ re-seed back
  useEffect(() => {
    const incoming = canonicalJson(value ?? emptyRichText());
    if (lastEmittedRef.current === null) {
      // Mount: useEditor already seeded the content — record, don't re-seed.
      lastEmittedRef.current = incoming;
      return;
    }
    if (lastEmittedRef.current === incoming) {
      return;
    }
    lastEmittedRef.current = incoming;
    // A re-seed is a READ, never a commit (v3 emits updates by default).
    editor.commands.setContent(asContent(value), { emitUpdate: false });
  }, [editor, value, commitSeq]);

  // Instrumentation fires ONCE per editor instance: a host passing an inline
  // callback must not re-invoke it on every render (§10 review fix L6). The
  // ref is written INSIDE the effect — React forbids ref writes during render.
  const readyRef = useRef<((editor: Editor) => void) | undefined>(undefined);
  const announcedRef = useRef<Editor | null>(null);
  useEffect(() => {
    readyRef.current = onEditorReady;
    if (announcedRef.current !== editor) {
      announcedRef.current = editor;
      readyRef.current?.(editor);
    }
  }, [editor, onEditorReady]);

  // Options are frozen at creation: re-apply when the a11y ids change (a
  // rejection adds `aria-describedby`, and it must reach the real surface).
  useEffect(() => {
    editor.setOptions({ editorProps: { attributes: surfaceAttributes } });
  }, [editor, surfaceAttributes]);

  useEffect(() => {
    const editable = disabled !== true;
    if (editor.isEditable !== editable) {
      // Editability is VIEW state — never an update (v3 emits one by default).
      editor.setEditable(editable, false);
    }
  }, [editor, disabled]);

  return (
    <div className="bldr-richtext-field">
      <RichTextToolbar
        editor={editor}
        disabled={disabled === true}
        onRefusedLink={setRefusedLink}
      />
      <div className="bldr-richtext-field__content">
        <EditorContent editor={editor} />
      </div>
      {contentError ? (
        <p className="bldr-richtext-field__error" role="alert">
          This content cannot be opened for editing — it was left untouched.
        </p>
      ) : null}
      {refusedLink === null ? null : (
        <p className="bldr-richtext-field__error" role="alert">
          That link was refused: only http(s), mailto, and relative links are allowed.
        </p>
      )}
    </div>
  );
}

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
  hideToolbar,
}: RichTextFieldProps) {
  /**
   * The editor's UN-ACKNOWLEDGED emissions, oldest→newest, as canonical JSON.
   * One string is not enough: in a real browser React can run the reconcile
   * effect for an EARLIER value after a newer emission exists (two commits in
   * one frame — fast typing, or a bubble action right after a keystroke). With
   * only "the last emission" recorded, that stale echo looks like an external
   * write and re-seeds the editor BACKWARDS — a caret teleport that eats the
   * newest change. The ring lets every echo, fresh or stale, be recognised as
   * our own.
   */
  const emittedRef = useRef<string[] | null>(null);
  /** Identity of the last reconciled `value` — separates echo from refusal. */
  const reconciledValueRef = useRef<unknown>(undefined);
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
      /*
        The field is ONE control — a toolbar and this surface inside a single
        border — so the focus ring belongs around the pair, and the wrapper
        draws it with :focus-within. Without this the product-wide ring landed
        here too and the field showed TWO identical rings, 1px apart.
        The stylesheet's own comment carries the rule.
      */
      'data-bldr-focus-ring': 'delegated',
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
      const ring = emittedRef.current ?? [];
      ring.push(canonicalJson(projected));
      // A bound, not a policy: echoes resolve within a render or two.
      if (ring.length > 20) {
        ring.shift();
      }
      emittedRef.current = ring;
      setRefusedLink(null);
      setCommitSeq((seq) => seq + 1);
      onChange(projected);
    },
  });

  // Document truth (e2). Runs on every incoming value AND after every emission,
  // and classifies each run by TWO signals — is the incoming value one of our
  // own emissions (the ring), and did the value's IDENTITY change since the
  // last run (an accepting host always hands back a NEW object; a refusing
  // host hands back the same one):
  //  • newest emission            ⇒ settled — nothing to do
  //  • older emission, NEW value  ⇒ a STALE echo of our own commit: skip (the
  //    fresh value is already behind it), and schedule one deferred re-run —
  //    in the rare race where this was actually an external revert (a kernel
  //    undo landing between an emission and its echo), the re-run sees the
  //    same value with its identity unchanged and re-seeds then.
  //  • older emission, SAME value ⇒ the door REFUSED the newer commit: re-seed
  //    back to document truth.
  //  • not ours at all            ⇒ external write (undo/redo/collab): re-seed.
  useEffect(() => {
    const incoming = canonicalJson(value ?? emptyRichText());
    const identityChanged = reconciledValueRef.current !== value;
    reconciledValueRef.current = value;
    if (emittedRef.current === null) {
      // Mount: useEditor already seeded the content — record, don't re-seed.
      emittedRef.current = [incoming];
      return;
    }
    const ring = emittedRef.current;
    const at = ring.indexOf(incoming);
    if (at === ring.length - 1 && at >= 0) {
      emittedRef.current = ring.slice(at); // settled — prune acknowledged history
      return;
    }
    if (at >= 0 && identityChanged) {
      emittedRef.current = ring.slice(at);
      // The deferred re-run: if a newer value is genuinely on its way, it wins
      // the race and this resolves as "settled"; if not, the same value comes
      // back with its identity UNCHANGED and takes the re-seed branch.
      const settle = setTimeout(() => {
        setCommitSeq((seq) => seq + 1);
      }, 0);
      return () => {
        clearTimeout(settle);
      };
    }
    emittedRef.current = [incoming];
    // A re-seed is a READ, never a commit (v3 emits updates by default).
    editor.commands.setContent(asContent(value), { emitUpdate: false });
    return;
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
      {hideToolbar === true ? null : (
        <RichTextToolbar
          editor={editor}
          disabled={disabled === true}
          onRefusedLink={setRefusedLink}
        />
      )}
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

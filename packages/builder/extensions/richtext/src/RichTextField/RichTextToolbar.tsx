import { type Editor, useEditorState } from '@tiptap/react';

import { safeHref } from '@craftkit/builder-renderer';

import { ToolbarButton } from './ToolbarButton';

export interface RichTextToolbarProps {
  editor: Editor;
  disabled: boolean;
  /** Surfaces a refused link URL to the host's rejection channel. */
  onRefusedLink: (href: string) => void;
}

/**
 * Formatting controls (008 contract §3 e4). Active states come through
 * `useEditorState` — a SUBSCRIBED selector, so the toolbar re-renders only when
 * one of these booleans changes, never on every caret move, and no mutable
 * engine state is read during render.
 */
export function RichTextToolbar({ editor, disabled, onRefusedLink }: RichTextToolbarProps) {
  const active = useEditorState({
    editor,
    selector: ({ editor: live }) => ({
      bold: live.isActive('bold'),
      italic: live.isActive('italic'),
      heading2: live.isActive('heading', { level: 2 }),
      heading3: live.isActive('heading', { level: 3 }),
      bulletList: live.isActive('bulletList'),
      orderedList: live.isActive('orderedList'),
      link: live.isActive('link'),
    }),
  });

  const setLink = () => {
    if (active.link) {
      editor.chain().unsetLink().run();
      return;
    }
    const href = window.prompt('Link URL');
    if (href === null || href === '') {
      return;
    }
    // The editor's allowlist IS the renderer's allowlist (§10 review fix): a
    // link the published page would neutralize must never look live here.
    if (safeHref(href) === undefined) {
      onRefusedLink(href);
      return;
    }
    editor.chain().setLink({ href }).run();
  };

  return (
    <div className="bldr-richtext-field__toolbar" role="group" aria-label="Formatting">
      <ToolbarButton
        label="Bold"
        pressed={active.bold}
        disabled={disabled}
        onActivate={() => {
          editor.chain().toggleBold().run();
        }}
      />
      <ToolbarButton
        label="Italic"
        pressed={active.italic}
        disabled={disabled}
        onActivate={() => {
          editor.chain().toggleItalic().run();
        }}
      />
      <ToolbarButton
        label="Heading 2"
        pressed={active.heading2}
        disabled={disabled}
        onActivate={() => {
          editor.chain().toggleHeading({ level: 2 }).run();
        }}
      />
      <ToolbarButton
        label="Heading 3"
        pressed={active.heading3}
        disabled={disabled}
        onActivate={() => {
          editor.chain().toggleHeading({ level: 3 }).run();
        }}
      />
      <ToolbarButton
        label="Bulleted list"
        pressed={active.bulletList}
        disabled={disabled}
        onActivate={() => {
          editor.chain().toggleBulletList().run();
        }}
      />
      <ToolbarButton
        label="Numbered list"
        pressed={active.orderedList}
        disabled={disabled}
        onActivate={() => {
          editor.chain().toggleOrderedList().run();
        }}
      />
      <ToolbarButton label="Link" pressed={active.link} disabled={disabled} onActivate={setLink} />
      <ToolbarButton
        label="Clear formatting"
        disabled={disabled}
        onActivate={() => {
          editor.chain().unsetAllMarks().clearNodes().run();
        }}
      />
    </div>
  );
}

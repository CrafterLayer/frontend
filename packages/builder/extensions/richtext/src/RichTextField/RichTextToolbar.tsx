import { useLayoutEffect, useRef, useState } from 'react';

import { type Editor, useEditorState } from '@tiptap/react';

import { safeHref } from '@craftkit/builder-renderer';

import { TOOLBAR_ICONS } from './toolbar-icons';
import { ToolbarButton } from './ToolbarButton';

export interface RichTextToolbarProps {
  editor: Editor;
  disabled: boolean;
  /** Surfaces a refused link URL to the host's rejection channel. */
  onRefusedLink: (href: string) => void;
}

interface TooltipAnchor {
  label: string;
  element: HTMLButtonElement;
}

/**
 * Formatting controls (008 contract §3 e4). Active states come through
 * `useEditorState` — a SUBSCRIBED selector, so the toolbar re-renders only when
 * one of these booleans changes, never on every caret move, and no mutable
 * engine state is read during render.
 */
export function RichTextToolbar({ editor, disabled, onRefusedLink }: RichTextToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState<TooltipAnchor | null>(null);
  const [focused, setFocused] = useState<TooltipAnchor | null>(null);
  const tooltipAnchor = hovered ?? focused;

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

  const handleHoverChange = (label: string, element: HTMLButtonElement | null) => {
    setHovered((current) => {
      if (element !== null) {
        return { label, element };
      }
      return current?.label === label ? null : current;
    });
  };

  const handleFocusChange = (label: string, element: HTMLButtonElement | null) => {
    setFocused((current) => {
      if (element !== null) {
        return { label, element };
      }
      return current?.label === label ? null : current;
    });
  };

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const tooltip = tooltipRef.current;
    const anchor = tooltipAnchor?.element;
    const view = toolbar?.ownerDocument.defaultView;
    if (
      toolbar === null ||
      tooltip === null ||
      anchor === undefined ||
      view === null ||
      view === undefined
    ) {
      return;
    }

    const placeTooltip = () => {
      const toolbarBox = toolbar.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();
      const tooltipBox = tooltip.getBoundingClientRect();
      const styles = view.getComputedStyle(toolbar);
      const tooltipStyles = view.getComputedStyle(tooltip);
      const inlineStartPadding = Number.parseFloat(styles.paddingInlineStart) || 0;
      const inlineEndPadding = Number.parseFloat(styles.paddingInlineEnd) || 0;
      const blockStartPadding = Number.parseFloat(styles.paddingBlockStart) || 0;
      const blockEndPadding = Number.parseFloat(styles.paddingBlockEnd) || 0;
      // This padding is `--bldr-space-xs` in CSS. Reading its RESOLVED value
      // keeps positioning correct if a host supplies the token in rem/calc.
      const gap = Number.parseFloat(tooltipStyles.paddingBlockStart) || 0;
      const rightToLeft = styles.direction === 'rtl';
      const leftPadding = rightToLeft ? inlineEndPadding : inlineStartPadding;
      const rightPadding = rightToLeft ? inlineStartPadding : inlineEndPadding;

      const minimumLeft = toolbarBox.left + leftPadding;
      const maximumLeft = Math.max(minimumLeft, toolbarBox.right - rightPadding - tooltipBox.width);
      const preferredLeft = anchorBox.left + (anchorBox.width - tooltipBox.width) / 2;
      const left = Math.min(Math.max(preferredLeft, minimumLeft), maximumLeft);

      const minimumTop = toolbarBox.top + blockStartPadding;
      const maximumTop = Math.max(
        minimumTop,
        toolbarBox.bottom - blockEndPadding - tooltipBox.height,
      );
      const below = anchorBox.bottom + gap;
      const above = anchorBox.top - gap - tooltipBox.height;
      const centred = anchorBox.top + (anchorBox.height - tooltipBox.height) / 2;
      const top =
        below <= maximumTop
          ? below
          : above >= minimumTop
            ? above
            : Math.min(Math.max(centred, minimumTop), maximumTop);

      const inlineStart = rightToLeft
        ? toolbarBox.right - left - tooltipBox.width
        : left - toolbarBox.left;
      tooltip.style.insetInlineStart = `${String(inlineStart)}px`;
      tooltip.style.insetBlockStart = `${String(top - toolbarBox.top)}px`;
    };

    placeTooltip();
    view.addEventListener('resize', placeTooltip);
    const ResizeObserverConstructor = Reflect.get(view, 'ResizeObserver') as
      typeof ResizeObserver | undefined;
    const observer =
      ResizeObserverConstructor === undefined ? null : new ResizeObserverConstructor(placeTooltip);
    observer?.observe(toolbar);
    return () => {
      observer?.disconnect();
      view.removeEventListener('resize', placeTooltip);
    };
  }, [tooltipAnchor]);

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
    <div
      ref={toolbarRef}
      className="bldr-richtext-field__toolbar"
      role="group"
      aria-label="Formatting"
    >
      <ToolbarButton
        label="Bold"
        icon={TOOLBAR_ICONS.bold}
        pressed={active.bold}
        disabled={disabled}
        onHoverChange={handleHoverChange}
        onFocusChange={handleFocusChange}
        onActivate={() => {
          editor.chain().toggleBold().run();
        }}
      />
      <ToolbarButton
        label="Italic"
        icon={TOOLBAR_ICONS.italic}
        pressed={active.italic}
        disabled={disabled}
        onHoverChange={handleHoverChange}
        onFocusChange={handleFocusChange}
        onActivate={() => {
          editor.chain().toggleItalic().run();
        }}
      />
      <ToolbarButton
        label="Heading 2"
        icon={TOOLBAR_ICONS.heading2}
        pressed={active.heading2}
        disabled={disabled}
        onHoverChange={handleHoverChange}
        onFocusChange={handleFocusChange}
        onActivate={() => {
          editor.chain().toggleHeading({ level: 2 }).run();
        }}
      />
      <ToolbarButton
        label="Heading 3"
        icon={TOOLBAR_ICONS.heading3}
        pressed={active.heading3}
        disabled={disabled}
        onHoverChange={handleHoverChange}
        onFocusChange={handleFocusChange}
        onActivate={() => {
          editor.chain().toggleHeading({ level: 3 }).run();
        }}
      />
      <ToolbarButton
        label="Bulleted list"
        icon={TOOLBAR_ICONS.bulletList}
        pressed={active.bulletList}
        disabled={disabled}
        onHoverChange={handleHoverChange}
        onFocusChange={handleFocusChange}
        onActivate={() => {
          editor.chain().toggleBulletList().run();
        }}
      />
      <ToolbarButton
        label="Numbered list"
        icon={TOOLBAR_ICONS.orderedList}
        pressed={active.orderedList}
        disabled={disabled}
        onHoverChange={handleHoverChange}
        onFocusChange={handleFocusChange}
        onActivate={() => {
          editor.chain().toggleOrderedList().run();
        }}
      />
      <ToolbarButton
        label="Link"
        icon={TOOLBAR_ICONS.link}
        pressed={active.link}
        disabled={disabled}
        onHoverChange={handleHoverChange}
        onFocusChange={handleFocusChange}
        onActivate={setLink}
      />
      <ToolbarButton
        label="Clear formatting"
        icon={TOOLBAR_ICONS.clearFormatting}
        disabled={disabled}
        onHoverChange={handleHoverChange}
        onFocusChange={handleFocusChange}
        onActivate={() => {
          editor.chain().unsetAllMarks().clearNodes().run();
        }}
      />
      <span
        ref={tooltipRef}
        className="bldr-richtext-field__tooltip"
        role="tooltip"
        aria-hidden="true"
        data-visible={tooltipAnchor === null ? 'false' : 'true'}
      >
        {tooltipAnchor?.label ?? ''}
      </span>
    </div>
  );
}

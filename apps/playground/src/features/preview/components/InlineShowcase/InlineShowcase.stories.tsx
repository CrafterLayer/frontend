import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { InlineShowcase } from './InlineShowcase';

const meta = {
  title: 'Playground/InlineShowcase',
  component: InlineShowcase,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof InlineShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

const frameOf = (canvasElement: HTMLElement): HTMLIFrameElement => {
  const frame = canvasElement.querySelector('iframe');
  if (frame === null) {
    throw new Error('the showcase must render its preview frame');
  }
  return frame;
};

const kernel = createPlaygroundKernel({ fixture: 'inline' });

export const Showcase: Story = {
  args: { kernel },
  play: async ({ canvasElement }) => {
    // THE HEADLINE, in a real Chromium: double-click prose on the canvas,
    // select ONE WORD, press Bold in the floating bubble, and exactly that word
    // becomes bold — never the whole paragraph — as ONE kernel transaction.
    // Written relative to the current document and unbolding on the way out, so
    // an Interactions-panel rerun starts from the same document.
    const frame = frameOf(canvasElement);
    const frameDocument = await waitFor(() => {
      const found = frame.contentDocument;
      if (found === null) {
        throw new Error('the preview frame must expose its document');
      }
      if (found.querySelector('[data-bldr-node="tale"]') === null) {
        throw new Error('the story block must render inside the frame');
      }
      return found;
    });
    const frameWindow = frame.contentWindow;
    if (frameWindow === null) {
      throw new Error('the preview frame must expose its window');
    }

    // Select the rich block; the block action bar appears against its outline —
    // the same chrome the caption invites the user to reach for.
    kernel.setSelection(['tale']);
    await waitFor(
      () => {
        const host = canvasElement.querySelector<HTMLElement>('.bldr-floating--actions');
        if (host?.style.visibility !== 'visible') {
          throw new Error('the block action bar must be placed and visible');
        }
        if (host.querySelector('[role="toolbar"]') === null) {
          throw new Error('the action bar must be a toolbar');
        }
      },
      { timeout: 5000 },
    );

    // Double-click the block's center — the user's gesture, dispatched on the
    // frame document exactly as the shell's own stories do.
    const wrapper = frameDocument.querySelector<HTMLElement>('[data-bldr-node="tale"]');
    if (wrapper === null) {
      throw new Error('the story block wrapper must exist');
    }
    const box = wrapper.getBoundingClientRect();
    frameDocument.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
      }),
    );

    // The contributed rich editor is a LAZY contribution — the canvas resolves
    // it on first need, so the surface arrives after a dynamic import.
    const surface = await waitFor(
      () => {
        const found = frameDocument.querySelector<HTMLElement>(
          '.bldr-richtext-field__surface, .ProseMirror',
        );
        if (found === null) {
          throw new Error('the rich inline surface must load in place');
        }
        return found;
      },
      { timeout: 10000 },
    );

    // ONE WORD, via the real DOM selection of the FRAME's own window. The word
    // is read from the live paragraph (second word), so the play never encodes
    // an absolute document.
    const paragraphOf = (): HTMLParagraphElement => {
      const paragraph = surface.querySelector('p');
      if (paragraph === null) {
        throw new Error('the prose paragraph must exist');
      }
      return paragraph;
    };
    const fullText = paragraphOf().textContent;
    const word = fullText.split(' ')[1];
    if (word === undefined || word.length === 0) {
      throw new Error('the paragraph must hold at least two words');
    }

    const wordTextNode = (): { node: Text; at: number } => {
      const walker = frameDocument.createTreeWalker(paragraphOf(), NodeFilter.SHOW_TEXT);
      for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
        const text = current as Text;
        const at = text.data.indexOf(word);
        if (at !== -1) {
          return { node: text, at };
        }
      }
      throw new Error(`the word "${word}" must exist in the paragraph`);
    };
    const applyWordSelection = () => {
      // The bubble only shows while the editor considers itself focused, so
      // the surface is focused before the range lands (TipTap defers its own
      // focus via rAF; a direct DOM focus is synchronous).
      surface.focus();
      const { node, at } = wordTextNode();
      const range = frameDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + word.length);
      const selection = frameWindow.getSelection();
      if (selection === null) {
        throw new Error('the frame window must expose a selection');
      }
      selection.removeAllRanges();
      selection.addRange(range);
    };
    applyWordSelection();

    // ProseMirror hears the real selectionchange and reports the anchor; the
    // canvas places the bubble in the HOST document. If focus was lost while
    // the editor booted, re-apply — never dispatch anything synthetic.
    const bubbleHost = await waitFor(
      () => {
        if (frameDocument.activeElement !== surface) {
          applyWordSelection();
        }
        const host = canvasElement.querySelector<HTMLElement>('.bldr-floating--bubble');
        if (host?.style.visibility !== 'visible') {
          throw new Error('the formatting bubble must be placed and visible');
        }
        return host;
      },
      { timeout: 10000 },
    );
    const bubble = bubbleHost.querySelector<HTMLElement>('.bldr-text-bubble');
    await expect(bubble).toHaveAccessibleName('Formatting');

    // A real user's Tab is delivered to the focused TipTap surface in the
    // FRAME document. Scope the keyboard there; host-scoped userEvent would
    // start from the iframe element and bypass the editor's native listener.
    await expect(canvasElement.ownerDocument.activeElement).toBe(frame);
    await expect(frameDocument.activeElement).toBe(surface);
    const delivery: { event: KeyboardEvent | null } = { event: null };
    const observeFrameTab = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        delivery.event = event;
      }
    };
    frameDocument.addEventListener('keydown', observeFrameTab, { capture: true, once: true });
    await userEvent.keyboard('{Tab}', { document: frameDocument });
    frameDocument.removeEventListener('keydown', observeFrameTab, true);
    await expect(delivery.event).not.toBeNull();
    await expect(delivery.event?.defaultPrevented).toBe(true);

    // Press Bold: exactly the selected word becomes bold, the paragraph's text
    // is untouched, the rest of it is NOT inside a strong, and the kernel
    // advanced by exactly ONE transaction.
    const storedContent = () =>
      JSON.stringify(kernel.getDocument().nodes['tale']?.props['content'] ?? null);
    // `surface` lives in the FRAME document, and jest-dom's toHaveFocus() type-guards
    // with an instanceof against the HOST realm's HTMLElement — which a frame element
    // fails, so the matcher rejects it before it ever checks focus. Frame-side focus is
    // therefore asserted against the frame's own activeElement: the same claim, made in
    // the realm where it is true. Host-side elements keep using toHaveFocus().
    const boldButton = () => within(bubbleHost).getByRole('button', { name: 'Bold' });
    await expect(boldButton()).toHaveFocus();
    await expect(frameWindow.getSelection()?.toString()).toBe(word);
    const beforeBold = kernel.transactions().length;
    await userEvent.keyboard('{Enter}', { document: bubbleHost.ownerDocument });

    await waitFor(async () => {
      await expect(surface.querySelector('strong')?.textContent).toBe(word);
      await expect(frameDocument.activeElement).toBe(surface);
      await expect(frameWindow.getSelection()?.toString()).toBe(word);
    });
    await expect(paragraphOf().textContent).toBe(fullText);
    await expect(surface.querySelectorAll('strong')).toHaveLength(1);
    await expect(word).not.toBe(fullText); // one strong holding ONE word ⇒ the rest is outside it
    await expect(kernel.transactions().length).toBe(beforeBold + 1);
    await expect(storedContent()).toContain('"bold"'); // kernel truth, not just DOM truth

    // Rerun-idempotent: unbold the SAME word — the strong is gone, one more
    // transaction, and the document is back where this play began.
    await userEvent.keyboard('{Tab}', { document: frameDocument });
    await expect(boldButton()).toHaveFocus();
    await expect(frameWindow.getSelection()?.toString()).toBe(word);
    const beforeUnbold = kernel.transactions().length;
    await userEvent.keyboard('{Enter}', { document: bubbleHost.ownerDocument });
    await waitFor(async () => {
      await expect(surface.querySelector('strong')).toBeNull();
      await expect(frameDocument.activeElement).toBe(surface);
      await expect(frameWindow.getSelection()?.toString()).toBe(word);
    });
    await expect(paragraphOf().textContent).toBe(fullText);
    await expect(kernel.transactions().length).toBe(beforeUnbold + 1);
    await expect(storedContent()).not.toContain('"bold"');

    // Bubble Escape returns to TipTap with its ProseMirror selection intact;
    // the next Escape, delivered to that frame editor, exits the session and
    // restores the stable canvas continuation target.
    await userEvent.keyboard('{Tab}', { document: frameDocument });
    await expect(boldButton()).toHaveFocus();
    await userEvent.keyboard('{Escape}', { document: bubbleHost.ownerDocument });
    await expect(frameDocument.activeElement).toBe(surface);
    await expect(frameWindow.getSelection()?.toString()).toBe(word);
    const continuation = canvasElement.querySelector<HTMLElement>('.bldr-canvas-host');
    if (continuation === null) {
      throw new Error('the canvas continuation region must stay mounted');
    }
    await userEvent.keyboard('{Escape}', { document: frameDocument });
    await waitFor(async () => {
      await expect(
        frameDocument.querySelector('.bldr-richtext-field__surface, .ProseMirror'),
      ).toBeNull();
      await expect(continuation).toHaveFocus();
    });
  },
};

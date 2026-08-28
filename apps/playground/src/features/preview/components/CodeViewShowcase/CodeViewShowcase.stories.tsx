import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { CodeViewShowcase } from './CodeViewShowcase';

const meta = {
  title: 'Playground/CodeViewShowcase',
  component: CodeViewShowcase,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CodeViewShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

const kernel = createPlaygroundKernel({ fixture: 'code-view' });
kernel.setSelection(['hero']);

export const Showcase: Story = {
  args: { kernel, debounceMs: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = kernel.transactions().length;

    await userEvent.click(canvas.getByRole('button', { name: 'Open code view' }));
    const textarea = await canvas.findByRole<HTMLTextAreaElement>(
      'textbox',
      { name: 'Document code' },
      { timeout: 10_000 },
    );
    // The REAL module worker answers asynchronously: the textarea exists before
    // its projection arrives, so the read must wait — jsdom's loopback hid this.
    await waitFor(
      async () => {
        await expect(textarea.value).toContain('Build pages your kernel can prove');
      },
      { timeout: 10_000 },
    );

    const edited = textarea.value
      .replace('"align": "center"', '"align": "start"')
      .replace('"label": "Get started"', '"label": "Begin now"')
      .replace('Build pages your kernel can prove', 'Edited through code view');
    if (edited === textarea.value) {
      throw new Error('the canonical hero projection must expose the editable values');
    }

    await userEvent.clear(textarea);
    await userEvent.paste(edited);
    await waitFor(
      async () => {
        await expect(kernel.getDocument().nodes['hero']?.props['heading']).toBe(
          'Edited through code view',
        );
        await expect(canvas.getByRole('status', { name: 'Transactions' })).toHaveTextContent(
          String(beforeTransactions + 1),
        );
      },
      { timeout: 10_000 },
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Undo code edit' }));
    await waitFor(async () => {
      await expect(kernel.getDocument()).toEqual(beforeDocument);
      await expect(canvas.getByRole('status', { name: 'Transactions' })).toHaveTextContent(
        String(beforeTransactions + 1),
      );
    });
  },
};

/** A second kernel so this story's edits never disturb `Showcase` above. */
const surfaceKernel = createPlaygroundKernel({ fixture: 'code-view' });

/**
 * BROWSER TRUTH (T029, spec edge case 7). jsdom cannot open the real inline
 * editing surface — it has no layout, so the block action bar never anchors —
 * and it cannot prove where a real Escape leaves focus. Both are proven here,
 * in Chromium, with EXACT destinations: an assertion that focus merely left
 * somewhere passes when it fell to `<body>`, which is the defect itself.
 */
export const OneEditingSurface: Story = {
  args: { kernel: surfaceKernel, debounceMs: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inlineSurfaces = '.bldr-inline-text, .bldr-inline-rich';
    const before = surfaceKernel.transactions().length;
    const frame = canvasElement.querySelector('iframe');
    if (frame === null) {
      throw new Error('the editable canvas must render its preview frame');
    }

    // 1. Open an inline edit the way an author does: select, then Edit text.
    //    The bar portals into the HOST document, outside the story canvas.
    surfaceKernel.setSelection(['hero']);
    const editText = await waitFor(
      () => {
        const found = [...document.querySelectorAll('button')].find(
          (button) => button.textContent === 'Edit text',
        );
        if (found === undefined) {
          throw new Error('the block action bar must offer Edit text');
        }
        return found;
      },
      { timeout: 10_000 },
    );
    await userEvent.click(editText);
    await waitFor(
      async () => {
        await expect(frame.contentDocument?.querySelector(inlineSurfaces)).not.toBe(null);
      },
      { timeout: 10_000 },
    );

    // 2. Open the code view while that edit is live.
    await userEvent.click(canvas.getByRole('button', { name: 'Open code view' }));
    const textarea = await canvas.findByRole<HTMLTextAreaElement>(
      'textbox',
      { name: 'Document code' },
      { timeout: 10_000 },
    );

    // 3. EXACTLY ONE editing surface survives, and merely switching surfaces
    //    records nothing — closing an edit is not committing one.
    await waitFor(
      async () => {
        await expect(frame.contentDocument?.querySelector(inlineSurfaces)).toBe(null);
      },
      { timeout: 10_000 },
    );
    await expect(surfaceKernel.transactions()).toHaveLength(before);

    // 4. A REAL Escape from inside the panel, with the destination named.
    const toggle = canvas.getByRole('button', { name: 'Close code view' });
    textarea.focus();
    await expect(textarea).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(
      async () => {
        await expect(canvas.queryByRole('textbox', { name: 'Document code' })).toBe(null);
      },
      { timeout: 10_000 },
    );
    await expect(toggle).toHaveFocus();
    await expect(document.activeElement).not.toBe(document.body);
    await expect(surfaceKernel.transactions()).toHaveLength(before);
  },
};

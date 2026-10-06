import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CustomCodeElement } from '@craftkit/builder-schema';

import { ElementCodeEditor } from './ElementCodeEditor';
import { ELEMENT_CODE_EDITOR_LABELS_AR } from './ElementCodeEditor.labels';

afterEach(cleanup);

const heading: CustomCodeElement = { kind: 'element', tag: 'h2', className: 'text-lg', text: 'Our story' };

describe('ElementCodeEditor', () => {
  it('shows the element as markup and applies an edit as one patch', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn(() => ({ ok: true as const }));
    render(<ElementCodeEditor element={heading} onCommit={onCommit} />);
    const editor = screen.getByRole('textbox', { name: 'Element code' });
    expect(editor).toHaveValue('<h2 class="text-lg">Our story</h2>');
    fireEvent.change(editor, { target: { value: '<h2 class="text-xl" id="story">Our story</h2>' } });
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ set: { className: 'text-xl' }, attributes: { id: 'story' } });
  });

  it('shows a parse error at the attribute and keeps the draft', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn(() => ({ ok: true as const }));
    render(<ElementCodeEditor element={heading} onCommit={onCommit} />);
    const editor = screen.getByRole('textbox', { name: 'Element code' });
    fireEvent.change(editor, { target: { value: '<h2 style="color:red">Our story</h2>' } });
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('At style:');
    expect(editor).toHaveAttribute('aria-invalid', 'true');
    expect(editor).toHaveValue('<h2 style="color:red">Our story</h2>');
  });

  it('shows a door refusal at the attribute it names', () => {
    const onCommit = vi.fn(() => ({ ok: false as const, message: 'onclick is not an attribute a tree may carry' }));
    render(<ElementCodeEditor element={heading} onCommit={onCommit} />);
    const editor = screen.getByRole('textbox', { name: 'Element code' });
    fireEvent.change(editor, { target: { value: '<h2 class="text-lg" lang="ar">Our story</h2>' } });
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('onclick is not an attribute');
  });

  it('reverts the draft and links the css fields; labels in Arabic', async () => {
    const user = userEvent.setup();
    const onOpenRegionCss = vi.fn();
    render(
      <ElementCodeEditor
        element={heading}
        onCommit={vi.fn(() => ({ ok: true as const }))}
        onOpenRegionCss={onOpenRegionCss}
        labels={ELEMENT_CODE_EDITOR_LABELS_AR}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'شيفرة العنصر' });
    fireEvent.change(editor, { target: { value: '<h2>x</h2>' } });
    await user.click(screen.getByRole('button', { name: 'تراجع' }));
    expect(editor).toHaveValue('<h2 class="text-lg">Our story</h2>');
    await user.click(screen.getByRole('button', { name: 'CSS القسم' }));
    expect(onOpenRegionCss).toHaveBeenCalledTimes(1);
  });
});

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StyleBucket, StyleState } from '@craftkit/builder-schema';

import { blockSource } from '../block-source';
import { classAt, makeStyleTestKernel } from '../test-kernel';
import { installBrowserStandIns, installClassOracle } from '../test-support';
import { treeElementSource } from '../tree-element-source';
import { StylePanel } from './StylePanel';
import { STYLE_PANEL_LABELS_AR } from './StylePanel.labels';

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = installClassOracle();
});
afterAll(() => {
  restoreOracle();
});
afterEach(cleanup);

const tokens = [
  { id: 'surface', name: 'Surface', css: '#ffffff' },
  { id: 'text', name: 'Text', css: '#111827' },
  { id: 'text-muted', name: 'Muted text', css: '#9ca3af' },
  { id: 'accent', name: 'Accent', css: '#2563eb' },
];

function renderPanel(
  kernel: ReturnType<typeof makeStyleTestKernel>,
  paths: readonly (readonly number[])[],
  at: { bucket?: StyleBucket; state?: StyleState } = {},
) {
  const announce = vi.fn();
  const source = treeElementSource(
    kernel,
    paths.map((path) => ({ kind: 'tree' as const, nodeId: 'r1', path: [...path] })),
  );
  render(
    <StylePanel
      source={source}
      bucket={at.bucket ?? 'base'}
      state={at.state ?? 'default'}
      dir="ltr"
      tokens={tokens}
      announce={announce}
    />,
  );
  return { announce, source };
}

describe('StylePanel', () => {
  it('writes the class for property × bucket × state as one labelled transaction', () => {
    const kernel = makeStyleTestKernel();
    const group = vi.spyOn(kernel, 'dispatchGroup');
    const { announce } = renderPanel(kernel, [[0, 0]], { bucket: 'mobile', state: 'hover' });
    act(() => {
      fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Size' }), { key: 'PageUp' });
    });
    expect(classAt(kernel, 0, 0)).toBe('text-lg max-md:hover:text-xl');
    expect(group).toHaveBeenCalledTimes(1);
    expect(group.mock.calls[0]?.[1]).toEqual({ author: 'user', label: 'Size · Heading “Our story”' });
    expect(group.mock.calls[0]?.[0]).toEqual([
      {
        command: 'patchTreeNode',
        args: { id: 'r1', path: [0, 0], set: { className: 'text-lg max-md:hover:text-xl' } },
      },
    ]);
    expect(announce).toHaveBeenCalledWith('Size updated');
  });

  it('shows an inherited value from a larger bucket and edits only the mobile bucket', () => {
    const kernel = makeStyleTestKernel();
    renderPanel(kernel, [[0]], { bucket: 'mobile' });
    // p-4 is set at base; the mobile ring shows it as inherited.
    expect(screen.getByRole('button', { name: 'Padding inline-start, 16px' })).toBeInTheDocument();
    const side = screen.getByRole('button', { name: 'Padding block-start, 16px' });
    fireEvent.pointerDown(side, { pointerId: 1, button: 0, clientX: 0, clientY: 100 });
    fireEvent.pointerMove(side, { pointerId: 1, clientX: 0, clientY: 84 });
    act(() => {
      fireEvent.pointerUp(side, { pointerId: 1, clientX: 0, clientY: 84 });
    });
    expect(classAt(kernel, 0)).toContain('p-4');
    expect(classAt(kernel, 0)).toMatch(/max-md:pbs-6/u);
  });

  it('Reset removes exactly one class', async () => {
    const user = userEvent.setup();
    const kernel = makeStyleTestKernel();
    renderPanel(kernel, [[0]]);
    await user.click(screen.getByRole('button', { name: 'Gap: Set here' }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(classAt(kernel, 0)).toBe('grid p-4');
  });

  it('Mixed multi-target: shows Mixed, writes every target in ONE transaction, one Undo', () => {
    const kernel = makeStyleTestKernel();
    const before = kernel.transactions().length;
    renderPanel(kernel, [
      [0, 0],
      [0, 1],
    ]);
    const size = screen.getByRole('spinbutton', { name: 'Size' });
    expect(size).toHaveAttribute('aria-valuetext', 'Mixed');
    act(() => {
      fireEvent.keyDown(size, { key: 'PageUp' });
    });
    expect(classAt(kernel, 0, 0)).toBe('text-xs');
    expect(classAt(kernel, 0, 1)).toBe('text-xs');
    expect(kernel.transactions().length).toBe(before + 1);
    act(() => {
      kernel.undo();
    });
    expect(classAt(kernel, 0, 0)).toBe('text-lg');
    expect(classAt(kernel, 0, 1)).toBe('text-sm');
  });

  it('falls back to one setProp per region when the host has no tree command', () => {
    const kernel = makeStyleTestKernel({ withCommand: false });
    const group = vi.spyOn(kernel, 'dispatchGroup');
    renderPanel(kernel, [[0, 0]]);
    act(() => {
      fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Size' }), { key: 'PageUp' });
    });
    expect(classAt(kernel, 0, 0)).toBe('text-xl');
    expect(group.mock.calls[0]?.[0]).toHaveLength(1);
    expect(group.mock.calls[0]?.[0][0]?.command).toBe('setProp');
  });

  it('tokens mode (a registered block) hides free controls and writes the block prop', async () => {
    const user = userEvent.setup();
    const kernel = makeStyleTestKernel();
    render(
      <StylePanel
        source={blockSource(kernel, 'c1', 'className')}
        bucket="base"
        state="default"
        dir="ltr"
        tokens={tokens}
        palette={[{ id: 'brand', name: 'Brand', css: '#0f766e' }]}
        announce={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText('Image URL')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Effects' }));
    expect(screen.queryByRole('group', { name: 'Effect presets' })).not.toBeInTheDocument();
    // The colour row is a field; its popover holds the theme tokens only.
    await user.click(screen.getByRole('button', { name: 'Background colour: None' }));
    expect(screen.queryByRole('radio', { name: 'Brand' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Hex colour' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radiogroup', { name: 'Background colour' }).querySelector('[aria-label="Accent"]')!);
    expect(kernel.getDocument().nodes['c1']?.props['className']).toBe('p-4 bg-accent');
  });

  it('a block keeps its shorthand token in the side fields, and typed px snap to a step', async () => {
    const user = userEvent.setup();
    const kernel = makeStyleTestKernel();
    kernel.dispatchGroup([{ command: 'setProp', args: { id: 'c1', key: 'className', value: 'py-section-lg' } }]);
    render(
      <StylePanel
        source={blockSource(kernel, 'c1', 'className')}
        bucket="base"
        state="default"
        dir="ltr"
        tokens={tokens}
        announce={vi.fn()}
      />,
    );
    const side = screen.getByRole('button', { name: 'Padding block-start, section-lg' });
    await user.click(side);
    const field = screen.getByRole('spinbutton', { name: /Padding block-start/u });
    expect(field).toHaveValue('section-lg');
    await user.clear(field);
    await user.type(field, '96{Enter}');
    const className = (kernel.getDocument().nodes['c1']?.props['className'] as string | undefined) ?? '';
    expect(className).toBe('pbs-24 pbe-section-lg');
    expect(className.split(' ').filter((utility) => utility.endsWith('-'))).toEqual([]);
  });

  it('a refused write is shown and announced, and nothing else happens', () => {
    const announce = vi.fn();
    const apply = vi.fn(() => ({ ok: false as const, message: '"text-[9zz]" is not a class the page can style.' }));
    render(
      <StylePanel
        source={{
          id: 'stub',
          label: 'Heading',
          mode: 'free',
          targetCount: 1,
          read: () => ['text-lg'],
          apply,
          subscribe: () => () => undefined,
        }}
        bucket="base"
        state="default"
        dir="ltr"
        tokens={tokens}
        announce={announce}
      />,
    );
    act(() => {
      fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Size' }), { key: 'PageUp' });
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('is not a class the page can style');
    expect(announce).toHaveBeenCalledWith(
      'Size not changed: "text-[9zz]" is not a class the page can style.',
    );
  });

  it('collapses sectors and speaks Arabic', async () => {
    const user = userEvent.setup();
    const kernel = makeStyleTestKernel({ dir: 'rtl' });
    const source = treeElementSource(kernel, [{ kind: 'tree', nodeId: 'r1', path: [0, 0] }]);
    render(
      <StylePanel
        source={source}
        bucket="base"
        state="default"
        dir="rtl"
        tokens={tokens}
        announce={vi.fn()}
        labels={STYLE_PANEL_LABELS_AR}
        onBucketChange={vi.fn()}
        onStateChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'حجم الشاشة' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'التصميم' })).toHaveAttribute('dir', 'rtl');
    const typography = screen.getByRole('button', { name: 'الطباعة' });
    expect(typography).toHaveAttribute('aria-expanded', 'true');
    await user.click(typography);
    expect(typography).toHaveAttribute('aria-expanded', 'false');
  });

  it('the filter keeps only matching properties, in either language, with their sectors open', async () => {
    const user = userEvent.setup();
    const kernel = makeStyleTestKernel();
    renderPanel(kernel, [[0]]);
    const filter = screen.getByRole('searchbox', { name: 'Filter properties' });
    await user.type(filter, 'radius');
    expect(screen.getByRole('button', { name: 'Borders' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: /Corner radius/u })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Layout' })).not.toBeInTheDocument();
    await user.clear(filter);
    await user.type(filter, 'الحشوة');
    expect(screen.getByRole('group', { name: 'Padding' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Typography' })).not.toBeInTheDocument();
    await user.clear(filter);
    await user.type(filter, 'zzz');
    expect(screen.getByRole('status')).toHaveTextContent('No property matches “zzz”');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Layout' })).toBeInTheDocument();
  });

  it('a sector counts the values set here, and segmented rows write their keyword', async () => {
    const user = userEvent.setup();
    const kernel = makeStyleTestKernel();
    renderPanel(kernel, [[0]]);
    // The fixture element is `grid gap-8 p-4`: display + gap in Layout, padding in Spacing.
    expect(screen.getByRole('button', { name: 'Layout' })).toHaveAccessibleDescription('2 values set here');
    expect(screen.getByRole('button', { name: 'Spacing' })).toHaveAccessibleDescription('1 value set here');
    expect(screen.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Flex' }));
    expect(classAt(kernel, 0)).toMatch(/\bflex\b/u);
    expect(classAt(kernel, 0)).not.toMatch(/\bgrid\b/u);
  });

  it('a number field scrub previews on the canvas and writes once on release', () => {
    const kernel = makeStyleTestKernel();
    const group = vi.spyOn(kernel, 'dispatchGroup');
    const onPreview = vi.fn();
    const source = treeElementSource(kernel, [{ kind: 'tree', nodeId: 'r1', path: [0] }]);
    render(
      <StylePanel
        source={source}
        bucket="base"
        state="default"
        dir="ltr"
        tokens={tokens}
        announce={vi.fn()}
        onPreview={onPreview}
      />,
    );
    const grip = screen.getByRole('spinbutton', { name: 'Gap' }).parentElement?.querySelector('.bldr-scale-number__scrub');
    if (!(grip instanceof HTMLElement)) throw new Error('no scrub grip');
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    // gap-8 is 32px; 16px of travel adds 8px and lands exactly on step 10 (40px).
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 16, clientY: 0 });
    expect(onPreview).toHaveBeenLastCalledWith([
      { property: 'gap', value: { kind: 'token', token: '10' }, bucket: 'base', state: 'default' },
    ]);
    expect(group).not.toHaveBeenCalled();
    act(() => {
      fireEvent.pointerUp(grip, { pointerId: 1, clientX: 16, clientY: 0 });
    });
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(group).toHaveBeenCalledTimes(1);
    expect(classAt(kernel, 0)).toBe('grid gap-10 p-4');
  });
});

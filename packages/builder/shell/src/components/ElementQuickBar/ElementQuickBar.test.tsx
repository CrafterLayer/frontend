import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { resolveElementActions } from '../../overlay/element-actions';
import { permissiveUtilityOracle, storedTree, treeKernel } from '../../overlay/tree-test-kit';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { createElementBarModel } from './element-bar-model';
import { ElementQuickBar } from './ElementQuickBar';
import { ELEMENT_QUICK_BAR_LABELS_AR } from './ElementQuickBar.labels';

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'flex gap-4',
      children: [{ kind: 'element', tag: 'h2', className: 'text-2xl', text: 'Our story' }],
    },
  ],
};

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
});

afterEach(cleanup);

const TOKENS = [{ id: 'accent', name: 'Accent', css: '#4f46e5' }];

function setup(path: number[], dir: 'ltr' | 'rtl' = 'ltr') {
  const kernel = treeKernel([TREE], dir);
  kernel.focusElement('r1', path);
  const targets = [{ kind: 'tree' as const, nodeId: 'r1', path }];
  const model = () =>
    createElementBarModel(kernel, targets, { bucket: 'base', state: 'default', pageDir: dir });
  const onAction = vi.fn();
  const onMore = vi.fn();
  const onReturnFocus = vi.fn();
  const onEditWithAi = vi.fn();
  const view = render(
    <ElementQuickBar
      model={model() ?? (undefined as never)}
      actions={resolveElementActions(kernel, targets)}
      onAction={onAction}
      onMore={onMore}
      onEditWithAi={onEditWithAi}
      onReturnFocus={onReturnFocus}
      dir={dir}
      colorTokens={TOKENS}
    />,
  );
  return { kernel, model, view, onAction, onMore, onReturnFocus, onEditWithAi };
}

describe('ElementQuickBar (DESIGN §A.6)', () => {
  it('is one toolbar with ONE tab stop, whose arrows follow an RTL editor', async () => {
    setup([0, 0], 'rtl');
    const toolbar = screen.getByRole('toolbar', { name: /Our story/u });
    const items = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('[data-bldr-quick-item]'));
    // Radix makes the toolbar itself the stop until an item has been focused.
    const stops = [toolbar, ...items].filter((item) => item.tabIndex === 0);
    expect(stops).toHaveLength(1);
    const first = items[0]!;
    act(() => {
      first.focus();
    });
    // RTL: ArrowLeft is FORWARD.
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(items[1]);
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(first);
    // Still one stop among the items: the one focused last (Radix's root only
    // forwards focus to it; Shift+Tab steps out past the root).
    expect(items.filter((item) => item.tabIndex === 0)).toEqual([first]);
  });

  it('shows the text groups of §A.6 for a heading, then More and Edit with AI', () => {
    setup([0, 0]);
    const groups = Array.from(document.querySelectorAll('[data-group]')).map((node) =>
      node.getAttribute('data-group'),
    );
    // Fix pass: text gets background, the spacing box model, radius, shadow and motion too.
    expect(groups).toEqual([
      'fontSize',
      'fontWeight',
      'textColor',
      'background',
      'padding',
      'textAlign',
      'lineHeight',
      'direction',
      'radius',
      'shadow',
      'motion',
    ]);
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit with AI' })).toBeInTheDocument();
  });

  it('shows the container groups for a section', () => {
    setup([0]);
    const groups = Array.from(document.querySelectorAll('[data-group]')).map((node) =>
      node.getAttribute('data-group'),
    );
    expect(groups).toEqual([
      'background',
      'padding',
      'gap',
      'flexDirection',
      'align',
      'radius',
      'border',
      'shadow',
      'motion',
    ]);
  });

  it('a group writes ONE labelled transaction through the engine', async () => {
    const { kernel } = setup([0, 0]);
    await userEvent.click(screen.getByRole('button', { name: 'Alignment' }));
    const before = kernel.transactions().length;
    await userEvent.click(await screen.findByRole('radio', { name: 'Centre' }));
    expect(kernel.transactions().length - before).toBe(1);
    const section = storedTree(kernel).children[0];
    const heading = section?.kind === 'element' ? section.children?.[0] : undefined;
    expect(heading?.kind === 'element' ? heading.className : '').toBe('text-2xl text-center');
  });

  it('Escape closes an open group first, then returns focus to the element', async () => {
    const { onReturnFocus } = setup([0, 0]);
    const trigger = screen.getByRole('button', { name: 'Alignment' });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(onReturnFocus).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(onReturnFocus).toHaveBeenCalledTimes(1);
  });

  it('runs element actions and the trailing buttons', async () => {
    const { onAction, onMore, onEditWithAi } = setup([0, 0]);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onAction).toHaveBeenCalledWith('delete');
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onMore).toHaveBeenCalledWith('typography');
    await userEvent.click(screen.getByRole('button', { name: 'Edit with AI' }));
    expect(onEditWithAi).toHaveBeenCalledTimes(1);
  });

  it('speaks Arabic when given the Arabic labels', () => {
    const kernel = treeKernel([TREE], 'rtl');
    const targets = [{ kind: 'tree' as const, nodeId: 'r1', path: [0, 0] }];
    const model = createElementBarModel(kernel, targets, { bucket: 'base', state: 'default', pageDir: 'rtl' });
    render(
      <ElementQuickBar
        model={model ?? (undefined as never)}
        actions={resolveElementActions(kernel, targets)}
        onAction={vi.fn()}
        onMore={vi.fn()}
        onReturnFocus={vi.fn()}
        dir="rtl"
        colorTokens={TOKENS}
        labels={ELEMENT_QUICK_BAR_LABELS_AR}
      />,
    );
    expect(screen.getByRole('button', { name: 'حذف' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'المحاذاة' })).toBeInTheDocument();
  });
});

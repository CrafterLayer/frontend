import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { setUtilityClassOracle, type CustomCodeRoot, type SiteLibrary } from '@craftkit/builder-schema';

import type { StyleSource } from '../../style-manager/style-source';
import { createDesignTestKernel, homeTree } from '../DesignSystemPanel/design-test-site';
import { ClassManager } from './ClassManager';
import { CLASS_MANAGER_LABELS_AR } from './ClassManager.labels';

beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});
afterEach(cleanup);

const card = (path: number[]) => ({ kind: 'tree' as const, nodeId: 'region', path });

function classAt(tree: CustomCodeRoot, path: readonly number[]): string | undefined {
  let nodes = tree.children;
  let found: CustomCodeRoot['children'][number] | undefined;
  for (const at of path) {
    found = nodes[at];
    nodes = found !== undefined && found.kind !== 'icon' ? (found.children ?? []) : [];
  }
  return found?.kind === 'component' ? undefined : found?.className;
}

const CARD_LIBRARY: SiteLibrary = {
  styles: { card: { id: 'card', name: 'Card', className: 'rounded-xl p-6 shadow-lg' } },
};

describe('ClassManager', () => {
  it('creates a style from an element as ONE undo, leaving the marker in place of its look', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel();
    render(<ClassManager site={kernel} target={card([0, 0])} />);

    await user.type(screen.getByLabelText('New style name'), 'Card');
    await user.click(screen.getByRole('button', { name: 'Create from element' }));

    expect(kernel.getSite().library?.styles?.['card']).toEqual({
      id: 'card',
      name: 'Card',
      className: 'rounded-lg p-4 bg-accent',
    });
    expect(classAt(homeTree(kernel), [0, 0])).toBe('group ck-s-card');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Create style · Card');
    expect(screen.getByRole('list', { name: 'Named styles' })).toHaveTextContent('1 use');

    act(() => {
      kernel.undo();
    });
    expect(kernel.getSite().library).toBeUndefined();
    expect(classAt(homeTree(kernel), [0, 0])).toBe('group rounded-lg p-4 bg-accent');
  });

  it('applies a style to every similar sibling in one transaction', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ library: CARD_LIBRARY });
    render(<ClassManager site={kernel} target={card([0, 1])} />);

    await user.click(screen.getByRole('button', { name: 'Apply to all similar (3)' }));

    for (const at of [0, 1, 2]) {
      expect(classAt(homeTree(kernel), [0, at])).toBe('group rounded-lg p-4 bg-accent ck-s-card');
    }
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('applies to every selected element (multi-select)', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ library: CARD_LIBRARY });
    render(<ClassManager site={kernel} target={card([0, 0])} targets={[card([0, 0]), card([0, 2])]} />);
    await user.click(screen.getByRole('button', { name: 'Apply to selected' }));
    expect(classAt(homeTree(kernel), [0, 0])).toContain('ck-s-card');
    expect(classAt(homeTree(kernel), [0, 1])).not.toContain('ck-s-card');
    expect(classAt(homeTree(kernel), [0, 2])).toContain('ck-s-card');
  });

  it('refuses to delete a style in use; detach inlines it and deletes in one undo', async () => {
    const user = userEvent.setup();
    const tree: CustomCodeRoot = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'ck-s-card text-start', text: 'Hi' }],
    };
    const kernel = createDesignTestKernel({ tree, library: CARD_LIBRARY });
    render(<ClassManager site={kernel} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('alertdialog');
    expect(confirm).toHaveTextContent('Used by 1 element');
    expect(kernel.transactions()).toHaveLength(0);

    await user.click(within(confirm).getByRole('button', { name: 'Detach and delete' }));
    expect(kernel.getSite().library).toBeUndefined();
    const inlined = classAt(homeTree(kernel), [0]) ?? '';
    expect(inlined.split(' ').sort()).toEqual(['p-6', 'rounded-xl', 'shadow-lg', 'text-start']);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('deletes an unused style at once, and renames in place', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({
      library: {
        styles: {
          card: { id: 'card', name: 'Card', className: 'p-6' },
          pill: { id: 'pill', name: 'Pill', className: 'rounded-full' },
        },
      },
    });
    render(<ClassManager site={kernel} />);

    const name = screen.getByLabelText('Name of Card');
    await user.clear(name);
    await user.type(name, 'Panel{Enter}');
    expect(kernel.getSite().library?.styles?.['card']?.name).toBe('Panel');

    const pill = screen.getByText('ck-s-pill').closest('li');
    if (pill === null) throw new Error('row missing');
    await user.click(within(pill).getByRole('button', { name: 'Delete' }));
    expect(kernel.getSite().library?.styles?.['pill']).toBeUndefined();
  });

  it('reorders the combo on the element (later wins)', async () => {
    const user = userEvent.setup();
    const tree: CustomCodeRoot = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'a', className: 'ck-s-card ck-s-pill underline', text: 'Go' }],
    };
    const kernel = createDesignTestKernel({
      tree,
      library: {
        styles: {
          card: { id: 'card', name: 'Card', className: 'p-6' },
          pill: { id: 'pill', name: 'Pill', className: 'rounded-full' },
        },
      },
    });
    render(<ClassManager site={kernel} target={card([0])} />);

    await user.click(screen.getByRole('button', { name: 'Move Pill earlier' }));
    expect(classAt(homeTree(kernel), [0])).toBe('ck-s-pill ck-s-card underline');

    await user.click(screen.getByRole('button', { name: 'Remove Card from the element' }));
    expect(classAt(homeTree(kernel), [0])).toBe('ck-s-pill underline');
  });

  it('opens the host StylePanel on the style, or a raw class field without one', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ library: CARD_LIBRARY });
    const renderStyleEditor = vi.fn((source: StyleSource) => <p>Editing {source.id}</p>);
    const { unmount } = render(<ClassManager site={kernel} renderStyleEditor={renderStyleEditor} />);
    await user.click(screen.getByRole('button', { name: 'Edit style' }));
    expect(screen.getByText('Editing named-style:card')).toBeVisible();
    unmount();

    render(<ClassManager site={kernel} />);
    await user.click(screen.getByRole('button', { name: 'Edit style' }));
    const field = screen.getByLabelText('Classes of Card');
    await user.clear(field);
    await user.type(field, 'rounded-xl p-8{Enter}');
    expect(kernel.getSite().library?.styles?.['card']?.className).toBe('rounded-xl p-8');
  });

  it('shows the door refusal when a class is not real', async () => {
    const user = userEvent.setup();
    setUtilityClassOracle((name) => !name.startsWith('bogus'));
    const kernel = createDesignTestKernel({ library: CARD_LIBRARY });
    render(<ClassManager site={kernel} />);
    await user.click(screen.getByRole('button', { name: 'Edit style' }));
    const field = screen.getByLabelText('Classes of Card');
    await user.clear(field);
    await user.type(field, 'bogus-thing{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Unknown utility class');
    expect(kernel.getSite().library?.styles?.['card']?.className).toBe('rounded-xl p-6 shadow-lg');
    setUtilityClassOracle(() => true);
  });

  it('explains why a registered block takes no named style', () => {
    const kernel = createDesignTestKernel();
    render(<ClassManager site={kernel} target={{ kind: 'block', nodeId: 'region' }} />);
    expect(screen.getByText(/Convert the block to editable/u)).toBeVisible();
  });

  it('speaks Arabic', () => {
    const kernel = createDesignTestKernel({ library: CARD_LIBRARY });
    render(<ClassManager site={kernel} labels={CLASS_MANAGER_LABELS_AR} dir="rtl" />);
    expect(screen.getByRole('region', { name: 'الأنماط' })).toHaveAttribute('dir', 'rtl');
  });
});

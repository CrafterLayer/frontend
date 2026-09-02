import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { Inspector } from './Inspector';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'inspector-element-focus-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region', 'card'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({
            label: z.string().max(80).default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
          }),
          propertyGroups: {
            label: { tab: 'content', section: 'Identity' },
            tree: { tab: 'content', section: 'Composition' },
          },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card',
          props: z.object({ title: z.string().default('Hi') }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'grid gap-8',
      children: [
        {
          kind: 'element',
          tag: 'img',
          className: 'rounded-full',
          attributes: { src: 'https://example.com/a.jpg', alt: 'Portrait' },
        },
        { kind: 'element', tag: 'h1', text: 'Reem Haddad' },
        { kind: 'element', tag: 'a', text: 'Email me', attributes: { href: 'mailto:r@x.io' } },
        { kind: 'icon', name: 'mail', size: 20 },
      ],
    },
  ],
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 'c1'] } },
    // A typed tree is plain JSON at runtime; the document's prop type only lacks
    // the interface's structural view of it.
    r1: { id: 'r1', type: 'region', props: { label: 'CV header', tree: TREE as never } },
    c1: { id: 'c1', type: 'card', props: { title: 'Hello' } },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('ief') },
  });

const treeOf = (kernel: BuilderKernel) =>
  kernel.getDocument().nodes['r1']?.props['tree'] as unknown as CustomCodeRoot;
const elementAt = (kernel: BuilderKernel, ...path: number[]) => {
  let node: unknown = treeOf(kernel);
  for (const index of path) node = (node as { children: unknown[] }).children[index];
  return node as Record<string, unknown>;
};

describe('Inspector — a focused element inside a composed region', () => {
  it('names the element, says which region it is in, and shows the element rows instead of the region rows', () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 0]);
    render(<Inspector kernel={kernel} />);

    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent('Image');
    expect(screen.getByText('in CV header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to region' })).toBeInTheDocument();
    // The region's own rows and tabs are not what is being edited.
    expect(screen.queryByRole('textbox', { name: 'label' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    // The image's rows, grouped.
    const image = screen.getByRole('region', { name: 'Image' });
    expect(within(image).getByRole('textbox', { name: 'src' })).toHaveValue(
      'https://example.com/a.jpg',
    );
    expect(within(image).getByRole('textbox', { name: 'alt' })).toHaveValue('Portrait');
    expect(
      within(screen.getByRole('region', { name: 'Design' })).getByRole('textbox', {
        name: 'className',
      }),
    ).toHaveValue('rounded-full');
    expect(
      within(screen.getByRole('region', { name: 'Advanced' })).getByRole('textbox', {
        name: 'title',
      }),
    ).toHaveValue('');
  });

  it('a committed edit is ONE transaction that rewrites the tree prop at the path — and only there', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 0]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    const before = treeOf(kernel);

    const alt = screen.getByRole('textbox', { name: 'alt' });
    await user.clear(alt);
    await user.type(alt, 'Reem at work');
    expect(kernel.transactions()).toHaveLength(0); // drafted, not yet committed
    await user.tab();
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('setProp');

    expect(elementAt(kernel, 0, 0)['attributes']).toEqual({
      src: 'https://example.com/a.jpg',
      alt: 'Reem at work',
    });
    // Structural sharing: the untouched sibling is the same reference as before.
    const beforeSection = before.children[0];
    expect(elementAt(kernel, 0, 1)).toBe(
      beforeSection?.kind === 'element' ? beforeSection.children?.[1] : undefined,
    );
    expect(kernel.undo()).toBe(true);
    expect(treeOf(kernel)).toEqual(TREE);
  });

  it('text, links and icons edit their own rows', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    kernel.focusElement('r1', [0, 1]);
    const view = render(<Inspector kernel={kernel} />);
    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent('Heading');
    const text = screen.getByRole('textbox', { name: 'text' });
    expect(text).toHaveValue('Reem Haddad');
    await user.clear(text);
    await user.type(text, 'Reem H.{Enter}');
    expect(elementAt(kernel, 0, 1)['text']).toBe('Reem H.');

    act(() => {
      kernel.focusElement('r1', [0, 2]);
    });
    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent('Link');
    expect(screen.getByRole('textbox', { name: 'href' })).toHaveValue('mailto:r@x.io');

    act(() => {
      kernel.focusElement('r1', [0, 3]);
    });
    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent(
      'Icon (mail)',
    );
    expect(screen.getByRole('spinbutton', { name: 'size' })).toHaveValue(20);
    view.unmount();
  });

  it('a value the tree refuses is rejected control-adjacent, with no transaction', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 3]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    const name = screen.getByRole('textbox', { name: 'name' });
    await user.clear(name);
    await user.type(name, 'Not Kebab Case');
    await user.tab();
    expect(kernel.transactions()).toHaveLength(0);
    expect(name).toHaveAttribute('aria-describedby');
    expect(name.closest('.bldr-inspector__row')?.textContent).toMatch(/invalid|regex|match/iu);
  });

  it('Back to region drops the focus, keeps the selection, and brings the region rows back', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 0]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('button', { name: 'Back to region' }));
    expect(kernel.context.store.getState().selection).toEqual(['r1']);
    expect(kernel.context.store.getState().elementFocus).toBeNull();
    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent(
      'CV header',
    );
    expect(screen.getByRole('textbox', { name: 'label' })).toHaveValue('CV header');
    expect(screen.queryByRole('button', { name: 'Back to region' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('CV header selected');
  });

  it('a focus that no longer resolves says so instead of editing a ghost; a whole-node selection ignores focus', () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 9]);
    const view = render(<Inspector kernel={kernel} />);
    expect(
      screen.getByText(
        'That element is no longer in this region. Go back to the region to continue.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to region' })).toBeInTheDocument();
    view.unmount();

    // A block with no composition tree never shows an element panel, focus or not.
    act(() => {
      kernel.setSelection(['c1']);
    });
    render(<Inspector kernel={kernel} />);
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
    expect(screen.queryByRole('button', { name: 'Back to region' })).not.toBeInTheDocument();
  });

  it('an undo that removes the focused element is reflected live (document truth, i3)', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 3]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    // Remove the icon through the door (as an AI rewrite would), then watch the panel.
    const section = TREE.children[0];
    if (section?.kind !== 'element') throw new Error('fixture: the first child is a section');
    const pruned: CustomCodeRoot = {
      kind: 'root',
      children: [{ ...section, children: section.children?.slice(0, 3) }],
    };
    act(() => {
      kernel.dispatch('setProp', { id: 'r1', key: 'tree', value: pruned as never });
    });
    expect(screen.getByText(/no longer in this region/u)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to region' }));
    expect(screen.getByRole('textbox', { name: 'label' })).toBeInTheDocument();
  });
});

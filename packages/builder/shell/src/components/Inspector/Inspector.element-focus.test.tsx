import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

import { installBrowserStandIns, installClassOracle } from '../../style-manager/test-support';
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

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = installClassOracle();
});
afterAll(() => {
  restoreOracle();
});

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('tab', { name }));
}

describe('Inspector — a focused element inside a composed region', () => {
  it('names the element, says which region it is in, and shows the element tabs instead of the region rows', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 0]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent('Image');
    expect(screen.getByText('in CV header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to region' })).toBeInTheDocument();
    // The region's own rows are not what is being edited.
    expect(screen.queryByRole('textbox', { name: 'label' })).not.toBeInTheDocument();
    // Every element is a widget: Content · Design · Interactions · Code.
    const tabs = within(screen.getByRole('tablist', { name: 'Element panel' }));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Content',
      'Design',
      'Interactions',
      'Code',
    ]);

    await openTab(user, 'Content');
    const content = screen.getByRole('region', { name: 'Content' });
    expect(within(content).getByRole('textbox', { name: 'src' })).toHaveValue('https://example.com/a.jpg');
    expect(within(content).getByRole('textbox', { name: 'alt' })).toHaveValue('Portrait');

    await openTab(user, 'Design');
    expect(screen.getByRole('group', { name: 'Design' })).toBeInTheDocument();
    const advanced = screen.getByRole('region', { name: 'Advanced' });
    expect(within(advanced).getByText('rounded-full')).toBeInTheDocument();
    expect(within(advanced).getByRole('textbox', { name: 'title' })).toHaveValue('');
  });

  it('a committed trait is ONE labelled transaction that changes the tree at the path — and only there', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 0]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await openTab(user, 'Content');
    const before = treeOf(kernel);

    const alt = screen.getByRole('textbox', { name: 'alt' });
    await user.clear(alt);
    await user.type(alt, 'Reem at work');
    expect(kernel.transactions()).toHaveLength(0); // drafted, not yet committed
    await user.tab();
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Alternative text · Image');

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

  it('text, links and icons edit their own Content rows', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    kernel.focusElement('r1', [0, 1]);
    const view = render(<Inspector kernel={kernel} />);
    await openTab(user, 'Content');
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
    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent('Icon (mail)');
    expect(screen.getByRole('spinbutton', { name: 'size' })).toHaveValue(20);
    view.unmount();
  });

  it('a value the tree refuses is rejected control-adjacent, with no transaction', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 3]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await openTab(user, 'Content');
    const name = screen.getByRole('textbox', { name: 'name' });
    await user.clear(name);
    await user.type(name, 'Not Kebab Case');
    await user.tab();
    expect(kernel.transactions()).toHaveLength(0);
    expect(name).toHaveAttribute('aria-describedby');
    expect(name.closest('.bldr-inspector__row')?.textContent).toMatch(/invalid|regex|match|name/iu);
  });

  it('an icon name its set does not have is refused with the reason; a picked icon lands once', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 3]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await openTab(user, 'Content');
    const name = screen.getByRole('textbox', { name: 'name' });
    await user.clear(name);
    await user.type(name, 'zzzz');
    await user.tab();
    expect(kernel.transactions()).toHaveLength(0);
    expect(name.closest('.bldr-inspector__row')?.textContent).toContain('There is no icon named “zzzz”');

    const icons = screen.getByRole('region', { name: 'Icons' });
    await user.type(within(icons).getByRole('searchbox'), 'heart');
    await user.click(within(icons).getByRole('button', { name: /^heart$|Icon heart|heart icon/iu }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(elementAt(kernel, 0, 3)['name']).toBe('heart');
    expect(kernel.undo()).toBe(true);
    expect(elementAt(kernel, 0, 3)['name']).toBe('mail');
  });

  it('Design: a control writes the class at the bucket as one labelled transaction', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 1]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} bucket="mobile" />);
    await openTab(user, 'Design');
    act(() => {
      fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Size' }), { key: 'PageUp' });
    });
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Size · Heading “Reem Haddad”');
    expect(elementAt(kernel, 0, 1)['className']).toBe('max-md:text-xs');
    expect(screen.getByRole('status', { name: 'Inspector messages' })).toHaveTextContent('Size updated');
  });

  it('Interactions: choosing a preset writes the motion attribute in one transaction', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 1]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await openTab(user, 'Interactions');
    await user.click(screen.getByRole('radio', { name: 'Fade up' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(elementAt(kernel, 0, 1)['attributes']).toEqual({ 'data-ck-motion': 'fade-up' });
  });

  it('Code: the element as markup; an edit is applied as one patch; a refusal shows at the attribute', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 2]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await openTab(user, 'Code');
    const editor = screen.getByRole('textbox', { name: 'Element code' });
    expect(editor).toHaveValue('<a href="mailto:r@x.io">Email me</a>');
    fireEvent.change(editor, { target: { value: '<a class="underline" href="mailto:r@x.io">Write to me</a>' } });
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(elementAt(kernel, 0, 2)).toMatchObject({ className: 'underline', text: 'Write to me' });

    fireEvent.change(editor, { target: { value: '<a href="mailto:r@x.io" onclick="x()">Write to me</a>' } });
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('At onclick:');
  });

  it('the tab is remembered across elements for the session', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 1]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await openTab(user, 'Interactions');
    act(() => {
      kernel.focusElement('r1', [0, 2]);
    });
    expect(screen.getByRole('tab', { name: 'Interactions' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Back to region drops the focus, keeps the selection, and brings the region rows back', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 0]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('button', { name: 'Back to region' }));
    expect(kernel.context.store.getState().selection).toEqual(['r1']);
    expect(kernel.context.store.getState().elementFocus).toBeNull();
    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveTextContent('CV header');
    expect(screen.getByRole('textbox', { name: 'label' })).toHaveValue('CV header');
    expect(screen.queryByRole('button', { name: 'Back to region' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('CV header selected');
  });

  it('a focus that no longer resolves says so instead of editing a ghost; a whole-node selection ignores focus', () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 9]);
    const view = render(<Inspector kernel={kernel} />);
    expect(
      screen.getByText('That element is no longer in this region. Go back to the region to continue.'),
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

  it('a host request opens Interactions (Animate) or Design at a sector (More), once (fix pass)', () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0, 1]);
    const handled: number[] = [];
    const contexts: { sector: string | null; state: string }[] = [];
    const { rerender } = render(
      <Inspector
        kernel={kernel}
        focusRequest={{ tab: 'interactions', nonce: 1 }}
        onFocusRequestHandled={(nonce) => handled.push(nonce)}
        onStyleContextChange={(context) => contexts.push(context)}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Interactions' })).toHaveAttribute('aria-selected', 'true');
    expect(handled).toEqual([1]);

    rerender(
      <Inspector
        kernel={kernel}
        focusRequest={{ tab: 'design', sector: 'effects', nonce: 2 }}
        onFocusRequestHandled={(nonce) => handled.push(nonce)}
        onStyleContextChange={(context) => contexts.push(context)}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('[data-sector="effects"]')?.hasAttribute('data-expanded')).toBe(true);
    expect(handled).toEqual([1, 2]);
    expect(contexts.at(-1)).toEqual({ sector: 'effects', state: 'default' });
  });

  it('offers no "Convert to editable" where the container refuses a region, and says why (fix pass)', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    // This page's slot holds region and card blocks only, never a customCode region.
    render(<Inspector kernel={kernel} onConvertBlock={() => 'refused'} />);
    expect(screen.getByRole('button', { name: 'Convert to editable' })).toBeDisabled();
    expect(screen.getByText(/only holds certain blocks/u)).toBeInTheDocument();
  });
});

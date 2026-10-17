import { useCallback, useState, useSyncExternalStore } from 'react';

import { z } from 'zod';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type NodeId,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { performBlockAction, resolveBlockActions } from '../../overlay/block-actions';
import { BlockActionBar } from './BlockActionBar';

const meta = {
  title: 'Builder/Shell/BlockActionBar',
  component: BlockActionBar,
} satisfies Meta<typeof BlockActionBar>;
export default meta;

type Story = StoryObj<typeof meta>;

// ── A real kernel behind the bar: the plays count REAL transactions ──────────

const NullRender: BlockRenderComponent = () => null;
const block = (type: string, slots?: Record<string, { allow: string[]; max?: number }>) => ({
  schema: defineBlockSchema({
    type,
    description: type,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const inlineTextBlock = {
  schema: defineBlockSchema({
    type: 'text',
    description: 'text',
    props: z.object({ content: z.string().default('Text') }),
    inlineEditable: 'content',
    examples: [],
  }),
  render: NullRender,
};

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'block-action-bar-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', { default: { allow: ['section'] } }),
      block('section', { default: { allow: ['text', 'section'] } }),
      inlineTextBlock,
    ],
  },
};

// root → sA(t1, t2, sInner), sB
const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['sA', 'sB'] } },
    sA: { id: 'sA', type: 'section', props: {}, slots: { default: ['t1', 't2', 'sInner'] } },
    t1: { id: 't1', type: 'text', props: { content: 'One' } },
    t2: { id: 't2', type: 'text', props: { content: 'Two' } },
    sInner: { id: 'sInner', type: 'section', props: {} },
    sB: { id: 'sB', type: 'section', props: {} },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('bar') },
  });

/**
 * The story host plays the canvas's part: it owns the selection, resolves the
 * actions from kernel truth, performs structural actions through
 * `performBlockAction`, opens text editing as view state, follows the RESULTING
 * selection, and shows the counters the plays assert against.
 * (In the product the floating host positions the bar; content is identical.)
 */
function KernelStage({
  initialSelected,
  dir,
}: {
  initialSelected: NodeId;
  dir?: 'ltr' | 'rtl' | undefined;
}) {
  const [kernel] = useState(() => {
    // The kernel's selection starts where the stage's does, so the Deselect
    // play asserts a real transition (something → none), not an empty → empty.
    const fresh = makeKernel();
    fresh.setSelection([initialSelected]);
    return fresh;
  });
  const [selected, setSelected] = useState(initialSelected);
  const [announcement, setAnnouncement] = useState('');
  const [editing, setEditing] = useState(false);
  const subscribe = useCallback(
    (listener: () => void) => kernel.context.store.subscribe(listener),
    [kernel],
  );
  const getSnapshot = useCallback(() => kernel.context.store.getState(), [kernel]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const actions = resolveBlockActions(kernel, selected);
  const children = snapshot.doc.nodes['sA']?.slots?.['default'] ?? [];
  return (
    <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem', maxInlineSize: '30rem' }}>
      <BlockActionBar
        label={`Actions for ${selected}`}
        actions={actions}
        onMovePointerDown={() => {
          setAnnouncement(`Ready to move ${selected}`);
        }}
        onAction={(id) => {
          if (id === 'editText') {
            setEditing(true);
            setAnnouncement(`Editing ${selected}`);
            return;
          }
          // Deselect returns `selection: null` — the kernel's selection is
          // empty; the stage keeps ITS `selected` so the bar stays on screen
          // for a rerun. The kernel line below is the truth the play reads.
          const result = performBlockAction(kernel, selected, id);
          if (result.selection !== null) {
            setSelected(result.selection);
          }
          setAnnouncement(result.announcement);
        }}
        dir={dir}
      />
      <p style={{ font: '12px/1.6 monospace' }}>
        transactions: <span data-testid="tx-count">{kernel.transactions().length}</span>
        <br />
        selected: <span data-testid="selected">{selected}</span>
        <br />
        kernel selection:{' '}
        <span data-testid="kernel-selection">
          {snapshot.selection.length === 0 ? 'none' : snapshot.selection.join(' ')}
        </span>
        <br />
        sA children: <span data-testid="children">{children.join(' ')}</span>
        <br />
        announced: <span data-testid="announcement">{announcement}</span>
        <br />
        inline session: <span data-testid="editing">{editing ? selected : 'closed'}</span>
      </p>
    </div>
  );
}

const BASE_ARGS = {
  label: 'Actions for t2',
  actions: [],
  onAction: () => undefined,
} satisfies Story['args'];

const readText = (element: HTMLElement): string => element.textContent;

export const Default: Story = {
  args: BASE_ARGS,
  render: () => <KernelStage initialSelected="t2" />,
  play: async ({ canvasElement }) => {
    // Idempotent by RELATIVE reads: every assertion is against the state read
    // just before the click, so a rerun from any state still holds.
    const canvas = within(canvasElement);
    const txBefore = Number(readText(canvas.getByTestId('tx-count')));
    const selectedBefore = readText(canvas.getByTestId('selected'));

    await userEvent.click(canvas.getByRole('button', { name: 'Duplicate' }));

    // ONE transaction, and the resulting selection is the DUPLICATE — seated
    // immediately after its origin.
    await expect(canvas.getByTestId('tx-count')).toHaveTextContent(String(txBefore + 1));
    const selectedAfter = readText(canvas.getByTestId('selected'));
    await expect(selectedAfter).not.toBe(selectedBefore);
    const order = readText(canvas.getByTestId('children')).split(' ');
    await expect(order.indexOf(selectedAfter)).toBe(order.indexOf(selectedBefore) + 1);
    await expect(canvas.getByTestId('announcement')).toHaveTextContent('Duplicated Text');
  },
};

export const MoveRoundTrip: Story = {
  args: BASE_ARGS,
  render: () => <KernelStage initialSelected="t2" />,
  play: async ({ canvasElement }) => {
    // Later then earlier: two transactions, selection glued to the moved node,
    // and the order ends exactly where it started — rerun-idempotent.
    const canvas = within(canvasElement);
    const txBefore = Number(readText(canvas.getByTestId('tx-count')));
    const selectedBefore = readText(canvas.getByTestId('selected'));
    const orderBefore = readText(canvas.getByTestId('children'));

    await userEvent.click(canvas.getByRole('button', { name: 'Move later' }));
    await expect(canvas.getByTestId('tx-count')).toHaveTextContent(String(txBefore + 1));
    await expect(canvas.getByTestId('selected')).toHaveTextContent(selectedBefore);
    await expect(canvas.getByTestId('announcement')).toHaveTextContent('Moved Text later');

    await userEvent.click(canvas.getByRole('button', { name: 'Move earlier' }));
    await expect(canvas.getByTestId('tx-count')).toHaveTextContent(String(txBefore + 2));
    await expect(canvas.getByTestId('selected')).toHaveTextContent(selectedBefore);
    await expect(canvas.getByTestId('children')).toHaveTextContent(orderBefore);
  },
};

export const DeleteSelectsTheSurvivor: Story = {
  args: BASE_ARGS,
  render: () => <KernelStage initialSelected="t2" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const del = canvas.getByRole('button', { name: 'Delete' });
    const txBefore = Number(readText(canvas.getByTestId('tx-count')));
    const selectedBefore = readText(canvas.getByTestId('selected'));
    const orderBefore = readText(canvas.getByTestId('children')).split(' ');
    const seat = orderBefore.indexOf(selectedBefore);
    if (del.hasAttribute('disabled') || seat === -1) {
      // Reruns without a remount eventually empty the section; the guard keeps
      // the play meaningful (and green) from any state.
      await expect(del).toBeDisabled();
      return;
    }

    await userEvent.click(del);
    // ONE transaction; the selection lands on the sibling that TAKES THE SEAT
    // (else the new last sibling, else the parent).
    await expect(canvas.getByTestId('tx-count')).toHaveTextContent(String(txBefore + 1));
    const expected = orderBefore[seat + 1] ?? orderBefore[seat - 1] ?? 'sA';
    await expect(canvas.getByTestId('selected')).toHaveTextContent(expected);
    await expect(canvas.getByTestId('announcement')).toHaveTextContent('Deleted');
  },
};

export const DisabledForTheRoot: Story = {
  args: BASE_ARGS,
  render: () => <KernelStage initialSelected="root" />,
  play: async ({ canvasElement }) => {
    // US3/AC3: on the root every structural action is DISABLED, never a door failure.
    const canvas = within(canvasElement);
    const txBefore = readText(canvas.getByTestId('tx-count'));
    for (const name of ['Duplicate', 'Delete', 'Move earlier', 'Move later']) {
      await expect(canvas.getByRole('button', { name })).toBeDisabled();
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Duplicate' }));
    await expect(canvas.getByTestId('tx-count')).toHaveTextContent(txBefore);
  },
};

export const KeyboardOperable: Story = {
  args: BASE_ARGS,
  render: () => <KernelStage initialSelected="t2" />,
  play: async ({ canvasElement }) => {
    // US3/AC5: reachable and operable without a pointer — one tab stop, roving
    // arrows, Enter dispatches exactly one transaction.
    const canvas = within(canvasElement);
    const txBefore = Number(readText(canvas.getByTestId('tx-count')));
    const selectedBefore = readText(canvas.getByTestId('selected'));

    /*
      The bar's single tab stop is its FIRST action, which is now Select parent
      — stepping out of a nested block is the commonest move once blocks nest.
      Walking from there to Duplicate is what proves the roving arrows cross the
      new button rather than starting after it.
    */
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Select parent' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Duplicate' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('button', { name: 'Duplicate' })).toHaveFocus();

    // Enter on DUPLICATE: Select parent moves the selection and dispatches
    // nothing, so pressing it here would prove the opposite of the claim.
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByTestId('tx-count')).toHaveTextContent(String(txBefore + 1));
    await expect(readText(canvas.getByTestId('selected'))).not.toBe(selectedBefore);
  },
};

export const EditTextWithoutDispatch: Story = {
  args: BASE_ARGS,
  render: () => <KernelStage initialSelected="t2" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const txBefore = readText(canvas.getByTestId('tx-count'));

    await userEvent.click(canvas.getByRole('button', { name: 'Edit text' }));

    await expect(canvas.getByTestId('tx-count')).toHaveTextContent(txBefore);
    await expect(canvas.getByTestId('editing')).toHaveTextContent('t2');
    await expect(canvas.getByTestId('announcement')).toHaveTextContent('Editing t2');
  },
};

export const DeselectClearsWithoutDispatch: Story = {
  args: BASE_ARGS,
  render: () => <KernelStage initialSelected="t2" />,
  play: async ({ canvasElement }) => {
    // The way OUT of a selection: zero transactions, the kernel's selection
    // empties, the announcement says so. Last in the bar, never disabled, and
    // the one action whose tooltip carries a shortcut — Escape does the same.
    // Rerun-safe: a second run starts from "none" and lands on "none".
    const canvas = within(canvasElement);
    const txBefore = readText(canvas.getByTestId('tx-count'));
    const deselect = canvas.getByRole('button', { name: 'Deselect' });
    await expect(deselect).toHaveAttribute('title', 'Deselect (Esc)');
    const buttons = canvas.getAllByRole('button');
    await expect(buttons.at(-1)).toBe(deselect);

    await userEvent.click(deselect);

    await expect(canvas.getByTestId('tx-count')).toHaveTextContent(txBefore);
    await expect(canvas.getByTestId('kernel-selection')).toHaveTextContent('none');
    await expect(canvas.getByTestId('announcement')).toHaveTextContent('Selection cleared');
  },
};

export const RightToLeft: Story = {
  args: BASE_ARGS,
  render: () => <KernelStage initialSelected="t2" dir="rtl" />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    // Forward is the READING direction: under RTL the arrow pair mirrors.
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Select parent' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('button', { name: 'Duplicate' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Duplicate' })).toHaveFocus();
  },
};

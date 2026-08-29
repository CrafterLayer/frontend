import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { RepeaterField } from './RepeaterField';
import type { FieldCommitResult } from '../../../fields/field-commit';
import type { RepeaterFieldProps, RepeaterRowRenderProps } from './types';

const ITEM_SCHEMA = z.array(z.object({ title: z.string().min(1), body: z.string().min(1) }));
const PRICING_SCHEMA = z.array(
  z.object({
    name: z.string().min(1),
    features: z.array(z.string().min(1)),
  }),
);

interface ReadOnlyRepeaterRowProps {
  readonly row: RepeaterRowRenderProps;
}

function ReadOnlyRepeaterRow({ row }: ReadOnlyRepeaterRowProps) {
  return (
    <input
      aria-label={row.propKey}
      value={
        typeof row.value === 'string' || typeof row.value === 'number' ? String(row.value) : ''
      }
      readOnly
    />
  );
}

const renderReadOnlyRow: RepeaterFieldProps['renderRow'] = (row) => (
  <ReadOnlyRepeaterRow key={row.key} row={row} />
);

function RecursivePricingRow({ row }: ReadOnlyRepeaterRowProps) {
  if (row.propKey !== 'features') {
    return <ReadOnlyRepeaterRow row={row} />;
  }

  return (
    <RepeaterField
      schema={row.schema}
      value={row.value}
      path={row.path}
      commit={row.commit}
      announce={() => undefined}
      renderRow={renderReadOnlyRow}
    />
  );
}

const renderRecursivePricingRow: RepeaterFieldProps['renderRow'] = (row) => (
  <RecursivePricingRow key={row.key} row={row} />
);

interface PricingPlan {
  readonly name: string;
  readonly features: readonly string[];
}

const INITIAL_PRICING_PLANS: readonly PricingPlan[] = [
  { name: 'Starter', features: ['Priority support'] },
];

interface RecursivePricingHarnessProps {
  readonly onTransaction: (next: unknown) => void;
}

function RecursivePricingHarness({ onTransaction }: RecursivePricingHarnessProps) {
  const [plans, setPlans] = useState<readonly PricingPlan[]>(INITIAL_PRICING_PLANS);

  const commit = (next: unknown): FieldCommitResult => {
    onTransaction(next);
    setPlans(next as readonly PricingPlan[]);
    return { ok: true };
  };

  return (
    <RepeaterField
      schema={PRICING_SCHEMA}
      value={plans}
      path={['props', 'plans']}
      commit={commit}
      announce={() => undefined}
      renderRow={renderRecursivePricingRow}
    />
  );
}

function createTransactionDoor(result: FieldCommitResult) {
  const transactions: unknown[] = [];
  const commit = vi.fn((next: unknown): FieldCommitResult => {
    if (result.ok) {
      transactions.push(next);
    }
    return result;
  });

  return { commit, transactions };
}

describe('RepeaterField', () => {
  it('identifies an empty list with visible empty-state text', () => {
    // Mutation: replace `<p className="bldr-repeater__empty">No items yet.</p>` with `null`.
    const door = createTransactionDoor({ ok: true });
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    expect(screen.getByText('No items yet.')).toBeVisible();
  });

  it('keeps the Add item control usable for an empty list', () => {
    // Mutation: change `disabled={disabled || addReason !== undefined}` to `disabled={disabled || addReason !== undefined || values.length === 0}`.
    const door = createTransactionDoor({ ok: true });
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add item to items' })).toBeEnabled();
  });

  it('exposes a schema-labelled collapsible card for each item', async () => {
    // Mutation: replace `aria-expanded={expanded}` with `aria-expanded={false}`.
    const door = createTransactionDoor({ ok: true });
    const user = userEvent.setup();
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[{ title: 'Fast setup', body: 'Start in minutes.' }]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    const disclosure = screen.getByRole('button', { name: '1. Fast setup' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    const fields = document.getElementById(disclosure.getAttribute('aria-controls') ?? '');
    expect(fields).not.toBeNull();
    expect(fields).toHaveAttribute('role', 'group');
    expect(fields).toHaveAccessibleName('1. Fast setup');
    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(fields).toHaveAttribute('hidden');
  });

  it('disables Move up on the first item', () => {
    // Mutation: replace `disabled={disabled || index === 0}` with `disabled={disabled}`.
    const door = createTransactionDoor({ ok: true });
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[
          { title: 'Starter', body: 'For individuals.' },
          { title: 'Growth', body: 'For teams.' },
        ]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    expect(screen.getByRole('button', { name: 'Move Starter up' })).toBeDisabled();
  });

  it('disables Move down on the last item', () => {
    // Mutation: replace `disabled={disabled || index === values.length - 1}` with `disabled={disabled}`.
    const door = createTransactionDoor({ ok: true });
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[
          { title: 'Starter', body: 'For individuals.' },
          { title: 'Growth', body: 'For teams.' },
        ]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    expect(screen.getByRole('button', { name: 'Move Growth down' })).toBeDisabled();
  });

  it('records exactly one transaction when moving an item', async () => {
    // Mutation: change `finish(commit(nextValues),` in the Move up handler to `finish((commit(nextValues), commit(nextValues)),`.
    const door = createTransactionDoor({ ok: true });
    const user = userEvent.setup();
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[
          { title: 'Starter', body: 'For individuals.' },
          { title: 'Growth', body: 'For teams.' },
        ]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Move Growth up' }));

    expect(door.commit).toHaveBeenCalledTimes(1);
    expect(door.transactions).toEqual([
      [
        { title: 'Growth', body: 'For teams.' },
        { title: 'Starter', body: 'For individuals.' },
      ],
    ]);
  });

  it('records exactly one transaction when adding an item', async () => {
    // Mutation: change `finish(commit(nextValues),` in the Add item handler to `finish((commit(nextValues), commit(nextValues)),`.
    const door = createTransactionDoor({ ok: true });
    const user = userEvent.setup();
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add item to items' }));

    expect(door.commit).toHaveBeenCalledTimes(1);
    expect(door.transactions).toEqual([[{ title: 'New title', body: 'New body' }]]);
  });

  it('records exactly one transaction when removing an item', async () => {
    // Mutation: change `finish(commit(nextValues),` in the Remove handler to `finish((commit(nextValues), commit(nextValues)),`.
    const door = createTransactionDoor({ ok: true });
    const user = userEvent.setup();
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[
          { title: 'Starter', body: 'For individuals.' },
          { title: 'Growth', body: 'For teams.' },
        ]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove Starter' }));

    expect(door.commit).toHaveBeenCalledTimes(1);
    expect(door.transactions).toEqual([[{ title: 'Growth', body: 'For teams.' }]]);
  });

  it('adds and removes Pricing plans features through the same repeater recursion', async () => {
    // Mutation: replace `commit: (next) => updateItem(index, { ...objectValue, [propKey]: next }),` with `commit: () => ({ ok: true }),`.
    const onTransaction = vi.fn();
    const user = userEvent.setup();
    render(<RecursivePricingHarness onTransaction={onTransaction} />);

    await user.click(screen.getByRole('button', { name: 'Add item to features' }));

    expect(onTransaction).toHaveBeenCalledTimes(1);
    expect(onTransaction).toHaveBeenLastCalledWith([
      { name: 'Starter', features: ['Priority support', 'New item'] },
    ]);
    expect(screen.getByDisplayValue('New item')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Priority support' }));

    expect(onTransaction).toHaveBeenCalledTimes(2);
    expect(onTransaction).toHaveBeenLastCalledWith([{ name: 'Starter', features: ['New item'] }]);
    expect(screen.queryByDisplayValue('Priority support')).not.toBeInTheDocument();
  });

  it('keeps a rejected action on the child row that caused it without recording a transaction', async () => {
    // Mutation: replace `setActionError({ ...target, message: result.message });` with `setActionError({ kind: 'add', message: result.message });`.
    const door = createTransactionDoor({
      ok: false,
      message: 'The property door rejected removal.',
    });
    const user = userEvent.setup();
    render(
      <RepeaterField
        schema={ITEM_SCHEMA}
        value={[
          { title: 'Starter', body: 'For individuals.' },
          { title: 'Growth', body: 'For teams.' },
        ]}
        path={['props', 'items']}
        commit={door.commit}
        announce={() => undefined}
        renderRow={renderReadOnlyRow}
      />,
    );

    const rejectedControl = screen.getByRole('button', { name: 'Remove Growth' });
    await user.click(rejectedControl);

    const rejection = screen.getByText('The property door rejected removal.');
    const rejectedRow = rejection.closest('[data-repeater-item]');
    if (rejectedRow === null) {
      throw new Error('Expected the rejection to remain inside its repeater item.');
    }
    expect(door.commit).toHaveBeenCalledTimes(1);
    expect(door.transactions).toHaveLength(0);
    expect(rejectedRow).toContainElement(rejectedControl);
    expect(rejectedControl).toHaveAccessibleDescription('The property door rejected removal.');
    expect(screen.getByRole('button', { name: 'Remove Starter' })).not.toHaveAccessibleDescription(
      'The property door rejected removal.',
    );
  });
});

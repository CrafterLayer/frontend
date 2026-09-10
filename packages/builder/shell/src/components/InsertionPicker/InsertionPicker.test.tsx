import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

import type { InsertionAnchor } from '@craftkit/builder-schema';

import { InsertionPicker } from './InsertionPicker';

const anchor: InsertionAnchor = {
  pageId: 'home',
  owner: 'page',
  slot: 'default',
  mode: 'before',
  beforeId: 'hero',
  afterId: 'features',
  revision: 'site-1',
};
const options = [
  { id: 'button', label: 'Button', kind: 'component' as const },
  { id: 'pricing', label: 'Pricing', kind: 'section' as const },
];

function setup(overrides: Partial<ComponentProps<typeof InsertionPicker>> = {}) {
  const onInsert = vi.fn();
  const onGenerate = vi.fn();
  const onRequestAnchor = vi.fn();
  render(
    <InsertionPicker
      anchor={anchor}
      anchorLabel="Features"
      options={options}
      onInsert={onInsert}
      onGenerate={onGenerate}
      onRequestAnchor={onRequestAnchor}
      {...overrides}
    />,
  );
  return { onInsert, onGenerate, onRequestAnchor };
}

describe('InsertionPicker', () => {
  it('keeps the visible placement in its accessible dialog description', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Add content' })).toHaveAccessibleDescription(
      'Insert before Features',
    );
    expect(screen.getByRole('tab', { name: 'Components' })).toHaveFocus();
  });

  it('inserts a catalog section with the exact captured anchor', async () => {
    const { onInsert } = setup();
    await userEvent.click(screen.getByRole('tab', { name: 'Sections' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pricing' }));
    expect(onInsert).toHaveBeenCalledWith({ kind: 'catalog', id: 'pricing' }, anchor);
  });

  it('filters the active catalog and reports an empty result', async () => {
    setup();
    await userEvent.type(screen.getByLabelText('Filter components'), 'missing');
    expect(screen.getByRole('status')).toHaveTextContent('No components match this filter.');
  });

  it('submits a trimmed generation request at the saved anchor', async () => {
    const { onGenerate } = setup({ initialMode: 'generate' });
    const submit = screen.getByRole('button', { name: 'Generate section' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Describe the section'), '  Pricing for agencies  ');
    await userEvent.click(submit);
    expect(onGenerate).toHaveBeenCalledWith('Pricing for agencies', anchor);
  });

  it('replaces every insertion path with anchor recovery when stale', async () => {
    const { onInsert, onGenerate, onRequestAnchor } = setup({ state: 'stale' });
    expect(screen.getByRole('alert')).toHaveTextContent('position changed');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose a new position' }));
    expect(onRequestAnchor).toHaveBeenCalledTimes(1);
    expect(onInsert).not.toHaveBeenCalled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('announces generation and disables choices until it finishes', () => {
    setup({ state: 'generating', initialMode: 'generate' });
    expect(screen.getByRole('status')).toHaveTextContent('saved position');
    for (const tab of screen.getAllByRole('tab')) expect(tab).toBeDisabled();
  });
});

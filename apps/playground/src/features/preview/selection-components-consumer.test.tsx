import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  InsertionPicker,
  SelectionToolbar,
  type InsertionAnchor,
  type SelectionTarget,
} from '@craftkit/builder';

const selected: SelectionTarget = {
  pageId: 'home',
  sourceOrNodeId: 'hero',
  revision: 'site-1',
  capabilities: ['inspect', 'editProps', 'move', 'delete'],
};
const anchor: InsertionAnchor = {
  pageId: 'home',
  owner: 'page',
  slot: 'default',
  mode: 'before',
  afterId: 'hero',
  revision: 'site-1',
};

describe('selection component facade', () => {
  it('mounts shell selection and insertion UI through the only app-facing package', () => {
    render(
      <>
        <SelectionToolbar targets={[selected]} onAction={vi.fn()} />
        <InsertionPicker
          anchor={anchor}
          anchorLabel="Hero"
          options={[]}
          onInsert={vi.fn()}
          onGenerate={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('toolbar', { name: 'Selection actions' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Add content' })).toBeVisible();
  });
});

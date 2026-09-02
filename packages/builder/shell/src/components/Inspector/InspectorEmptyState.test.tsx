import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InspectorEmptyState } from './InspectorEmptyState';

describe('InspectorEmptyState', () => {
  it('invites a selection with a decorative mark', () => {
    render(<InspectorEmptyState kind="invitation" />);
    const copy = screen.getByText('Select a block to edit its properties.');
    expect(copy).toHaveClass('bldr-inspector__empty');
    const invitation = copy.closest('.bldr-inspector__invitation');
    expect(invitation).not.toBeNull();
    expect(invitation?.querySelector('.bldr-inspector__invitation-icon svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('says what happened for an unknown type, in a warning tone', () => {
    render(<InspectorEmptyState kind="unknown-type" />);
    expect(
      screen.getByText('Unknown block type — no schema is registered for it.'),
    ).toHaveAttribute('data-tone', 'warning');
  });

  it('states the no-properties case plainly', () => {
    render(<InspectorEmptyState kind="no-properties" />);
    expect(screen.getByText('This block has no editable properties.')).not.toHaveAttribute(
      'data-tone',
    );
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UnknownBlock } from './UnknownBlock';

describe('UnknownBlock', () => {
  it('names the missing type inside an informational note', () => {
    render(<UnknownBlock type="widget:reviews" />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Unknown block type:');
    expect(note).toHaveTextContent('widget:reviews');
  });
});

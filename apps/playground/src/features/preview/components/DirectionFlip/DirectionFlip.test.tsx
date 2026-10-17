import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { DirectionFlip } from './DirectionFlip';

describe('DirectionFlip', () => {
  it('flips the document direction through the single door, undoably', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    render(<DirectionFlip kernel={kernel} />);

    await userEvent.setup().click(screen.getByRole('button', { name: /ltr → rtl/ }));
    expect(kernel.getDocument().dir).toBe('rtl');
    expect(screen.getByRole('button', { name: /rtl → ltr/ })).toBeInTheDocument();

    kernel.undo();
    expect(kernel.getDocument().dir).toBe('ltr');
  });
});

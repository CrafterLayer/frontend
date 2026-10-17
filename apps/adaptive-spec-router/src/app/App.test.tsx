import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('composes the local Adaptive Spec Router product root', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Adaptive Spec Router' })).toBeVisible();
    expect(screen.getByText('Local deterministic demo · no provider connected')).toBeVisible();
  });
});

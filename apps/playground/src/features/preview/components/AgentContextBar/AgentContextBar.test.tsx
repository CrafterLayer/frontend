import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentContextBar } from './AgentContextBar';

describe('AgentContextBar', () => {
  it('names the exact page target in one line', () => {
    render(<AgentContextBar scope="page" label="Pricing" detail="/pricing" />);
    expect(screen.getByLabelText('Agent context: Page')).toHaveTextContent('PagePricing/pricing');
  });

  it('makes a stale captured target an assertive state', () => {
    render(<AgentContextBar scope="stale" label="Hero heading was removed" />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('discloses shared impact without changing the scope label', () => {
    render(<AgentContextBar scope="shared" label="Navbar" detail="6 instances · 3 pages" />);
    expect(screen.getByText('Shared component')).toBeInTheDocument();
    expect(screen.getByText('6 instances · 3 pages')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PlanImpact } from '../AssistantPanel/AssistantPanel.impact';
import { PlanImpactLine } from './PlanImpactLine';

const ADDED: PlanImpact = {
  added: ['hero'],
  changed: [],
  removed: [],
  addedTypes: ['hero'],
  meta: [],
  empty: false,
};

const NOTHING: PlanImpact = {
  added: [],
  changed: [],
  removed: [],
  addedTypes: [],
  meta: [],
  empty: true,
};

describe('PlanImpactLine', () => {
  it('renders nothing when it knows neither fact', () => {
    const { container } = render(
      <PlanImpactLine impact={undefined} costTokens={undefined} locale="ar" />,
    );
    // A line that says "we could not tell" takes space to say nothing.
    expect(container).toBeEmptyDOMElement();
  });

  it('says what would change, in the panel’s language', () => {
    const { container, rerender } = render(
      <PlanImpactLine impact={ADDED} costTokens={undefined} locale="ar" />,
    );
    expect(container.textContent).toBe('إضافة 1.');

    rerender(<PlanImpactLine impact={ADDED} costTokens={undefined} locale="en" />);
    expect(container.textContent).toBe('1 block added.');
  });

  it('says a plan changes NOTHING, which the step list cannot', () => {
    const { container } = render(
      <PlanImpactLine impact={NOTHING} costTokens={undefined} locale="en" />,
    );
    expect(container.textContent).toBe('Changes nothing on the page.');
  });

  it('carries the cost as a labelled estimate, beside the impact', () => {
    const { container } = render(<PlanImpactLine impact={ADDED} costTokens={4237} locale="en" />);

    expect(container.textContent).toBe('1 block added. Estimate: ~4.2k tokens');
    expect(container.querySelector('.pg-chat__cost')?.textContent).toBe('Estimate: ~4.2k tokens');
  });

  it('shows a cost alone when the plan could not be rehearsed', () => {
    const { container } = render(
      <PlanImpactLine impact={undefined} costTokens={900} locale="en" />,
    );
    expect(container.textContent).toBe('Estimate: ~900 tokens');
  });

  it('declares its language, because the panel knows it for certain', () => {
    /*
      Panel-written text, not the model's. Leaving it to `dir="auto"` had an
      English voice reading Arabic and the wrong typeface chosen for it.
    */
    render(<PlanImpactLine impact={ADDED} costTokens={undefined} locale="ar" />);
    expect(screen.getByText('إضافة 1.')).toHaveAttribute('lang', 'ar');
  });
});

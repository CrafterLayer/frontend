import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  changesRequestedReviewRecords,
  initialPlanRevision,
  initialReviewRecords,
} from '../../model/demo-data';
import { createMaterialRevision, inspectPlanReviews } from '../../model/routing-policy';
import { PlanReviewAudit } from './PlanReviewAudit';

describe('PlanReviewAudit', () => {
  it('shows both current reviewers for a ready frozen revision', () => {
    render(
      <PlanReviewAudit
        plan={initialPlanRevision}
        audit={inspectPlanReviews(initialPlanRevision, initialReviewRecords)}
        onMaterialRevision={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Current plan reviews')).toHaveTextContent('Claude · Opus');
    expect(screen.getByLabelText('Current plan reviews')).toHaveTextContent('Codex · Sol');
    expect(screen.getByRole('status')).toHaveTextContent('Ready for implementation');
  });

  it('opens a typed finding with its requirement, severity, and next action', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <PlanReviewAudit
        plan={initialPlanRevision}
        audit={inspectPlanReviews(initialPlanRevision, initialReviewRecords)}
        onMaterialRevision={() => undefined}
      />,
    );

    await user.click(screen.getByText('Codex · FR-004'));

    expect(screen.getByLabelText('Plan review findings')).toHaveTextContent('high');
    expect(screen.getByLabelText('Plan review findings')).toHaveTextContent(
      'Block implementation while the plan-review gate is stale or incomplete.',
    );
  });

  it('surfaces a blocked review state when a reviewer requests changes', () => {
    render(
      <PlanReviewAudit
        plan={initialPlanRevision}
        audit={inspectPlanReviews(initialPlanRevision, changesRequestedReviewRecords)}
        onMaterialRevision={() => undefined}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Changes requested');
    expect(screen.getByRole('button', { name: 'Reviews invalidated' })).toBeDisabled();
  });

  it('requests a material revision only while the plan is ready', async () => {
    const onMaterialRevision = vi.fn();
    const user = userEvent.setup({ delay: null });

    render(
      <PlanReviewAudit
        plan={initialPlanRevision}
        audit={inspectPlanReviews(initialPlanRevision, initialReviewRecords)}
        onMaterialRevision={onMaterialRevision}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Simulate material revision' }));

    expect(onMaterialRevision).toHaveBeenCalledOnce();
  });

  it('marks old reviews stale after a material revision', () => {
    const revisedPlan = createMaterialRevision(initialPlanRevision);

    render(
      <PlanReviewAudit
        plan={revisedPlan}
        audit={inspectPlanReviews(revisedPlan, initialReviewRecords)}
        onMaterialRevision={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Stale plan reviews')).toHaveTextContent('Claude · Opus · stale');
    expect(screen.getByRole('button', { name: 'Reviews invalidated' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Re-run Claude and Codex plan reviews');
  });
});

import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../AdaptiveSpecRouter.css';
import {
  changesRequestedReviewRecords,
  initialPlanRevision,
  initialReviewRecords,
} from '../../model/demo-data';
import { createMaterialRevision, inspectPlanReviews } from '../../model/routing-policy';
import { PlanReviewAudit } from './PlanReviewAudit';

const readyAudit = inspectPlanReviews(initialPlanRevision, initialReviewRecords);
const revisedPlan = createMaterialRevision(initialPlanRevision);
const staleAudit = inspectPlanReviews(revisedPlan, initialReviewRecords);
const blockedAudit = inspectPlanReviews(initialPlanRevision, changesRequestedReviewRecords);

const meta = {
  title: 'Adaptive Spec Router/PlanReviewAudit',
  component: PlanReviewAudit,
  parameters: { layout: 'padded' },
  args: {
    plan: initialPlanRevision,
    audit: readyAudit,
    onMaterialRevision: () => undefined,
  },
} satisfies Meta<typeof PlanReviewAudit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const StaleAfterMaterialRevision: Story = {
  args: {
    plan: revisedPlan,
    audit: staleAudit,
  },
};

export const ChangesRequested: Story = {
  args: { audit: blockedAudit },
};

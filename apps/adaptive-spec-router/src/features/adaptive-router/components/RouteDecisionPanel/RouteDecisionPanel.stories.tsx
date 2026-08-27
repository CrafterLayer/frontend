import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../AdaptiveSpecRouter.css';
import { initialScenario } from '../../model/demo-data';
import { routeScenario } from '../../model/routing-policy';
import { RouteDecisionPanel } from './RouteDecisionPanel';

const standardDecision = routeScenario(initialScenario);
const criticalDecision = routeScenario({
  ...initialScenario,
  orchestrationMode: 'claude-adaptive',
  brief: 'Assess a critical multi-package authorization boundary and review the migration plan.',
  workClass: 'architecture',
  risk: 'critical',
});
const fallbackDecision = routeScenario({
  ...initialScenario,
  orchestrationMode: 'claude-adaptive',
  availability: { claude: true, codex: false },
});
const modelFallbackDecision = routeScenario({
  ...initialScenario,
  orchestrationMode: 'claude-adaptive',
  workClass: 'architecture',
  risk: 'critical',
  unavailableModel: 'Opus',
});

const meta = {
  title: 'Adaptive Spec Router/RouteDecisionPanel',
  component: RouteDecisionPanel,
  parameters: { layout: 'padded' },
  args: { decision: standardDecision, scenario: initialScenario },
} satisfies Meta<typeof RouteDecisionPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};
export const Critical: Story = {
  args: {
    decision: criticalDecision,
    scenario: { ...initialScenario, orchestrationMode: 'claude-adaptive' },
  },
};
export const ProviderFallback: Story = {
  args: {
    decision: fallbackDecision,
    scenario: {
      ...initialScenario,
      orchestrationMode: 'claude-adaptive',
      availability: { claude: true, codex: false },
    },
  },
};
export const ModelTierFallback: Story = {
  args: {
    decision: modelFallbackDecision,
    scenario: {
      ...initialScenario,
      orchestrationMode: 'claude-adaptive',
      workClass: 'architecture',
      risk: 'critical',
      unavailableModel: 'Opus',
    },
  },
};
export const NeedsInput: Story = { args: { decision: null, scenario: initialScenario } };

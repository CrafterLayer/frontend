import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../AdaptiveSpecRouter.css';
import { initialScenario } from '../../model/demo-data';
import { ScenarioComposer } from './ScenarioComposer';

const meta = {
  title: 'Adaptive Spec Router/ScenarioComposer',
  component: ScenarioComposer,
  parameters: { layout: 'padded' },
  args: {
    scenario: initialScenario,
    onApply: () => undefined,
    onInvalid: () => undefined,
  },
} satisfies Meta<typeof ScenarioComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CriticalArchitecture: Story = {
  args: {
    scenario: {
      ...initialScenario,
      orchestrationMode: 'claude-adaptive',
      workClass: 'architecture',
      risk: 'critical',
      brief: 'Design the high-assurance routing and release boundary for a shared monorepo.',
    },
  },
};

export const ClaudeOnly: Story = {
  args: {
    scenario: {
      ...initialScenario,
      orchestrationMode: 'claude-adaptive',
      availability: { claude: true, codex: false },
    },
  },
};

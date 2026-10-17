import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../AdaptiveSpecRouter.css';
import { initialDemoRun } from '../../model/demo-data';
import { EvidenceConsole } from './EvidenceConsole';

const meta = {
  title: 'Adaptive Spec Router/EvidenceConsole',
  component: EvidenceConsole,
  parameters: { layout: 'padded' },
  args: { run: initialDemoRun },
} satisfies Meta<typeof EvidenceConsole>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WaitingForVerification: Story = {};

export const BlockedRelease: Story = {
  args: {
    run: {
      ...initialDemoRun,
      releaseGate: 'blocked',
      evidence: initialDemoRun.evidence.map((record) =>
        record.id === 'EV-017'
          ? {
              ...record,
              result: 'blocked',
              detail: 'A required verification failed; a new focused check is required.',
            }
          : record,
      ),
    },
  },
};

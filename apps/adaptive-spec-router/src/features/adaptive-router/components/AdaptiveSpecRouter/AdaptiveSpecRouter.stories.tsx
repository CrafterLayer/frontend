import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../AdaptiveSpecRouter.css';
import { AdaptiveSpecRouter } from './AdaptiveSpecRouter';

const meta = {
  title: 'Adaptive Spec Router/AdaptiveSpecRouter',
  component: AdaptiveSpecRouter,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdaptiveSpecRouter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalEvaluation: Story = {};

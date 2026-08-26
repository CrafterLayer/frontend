import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { useBuilder } from '../../hooks/use-builder';
import { useNode } from '../../hooks/use-node';
import { BuilderProvider } from './BuilderProvider';

function KernelSummary() {
  const kernel = useBuilder();
  const root = useNode(kernel.getDocument().rootId);
  return (
    <dl>
      <dt>Surface</dt>
      <dd>{kernel.context.surface}</dd>
      <dt>Root node</dt>
      <dd>
        {root?.type} ({String(root?.slots?.['default']?.length ?? 0)} children)
      </dd>
    </dl>
  );
}

const meta = {
  title: 'Builder/React/BuilderProvider',
  component: BuilderProvider,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BuilderProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLandingFixture: Story = {
  args: {
    kernel: createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('story') },
    }),
    children: <KernelSummary />,
  },
};

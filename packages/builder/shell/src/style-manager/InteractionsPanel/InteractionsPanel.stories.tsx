import { useState } from 'react';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { InteractionsPanel, type InteractionsPanelProps } from './InteractionsPanel';
import { INTERACTIONS_PANEL_LABELS_AR } from './InteractionsPanel.labels';
import type { AttributePatch, MotionAttributes } from './motion-attributes';

function Controlled(props: InteractionsPanelProps) {
  const [attributes, setAttributes] = useState<MotionAttributes>(props.attributes);
  return (
    <InteractionsPanel
      {...props}
      attributes={attributes}
      onCommit={(patch: AttributePatch) => {
        const next: Record<string, string | undefined> = { ...attributes };
        for (const [name, value] of Object.entries(patch)) next[name] = value ?? undefined;
        setAttributes(next);
        return { ok: true };
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/InteractionsPanel',
  component: InteractionsPanel,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '22rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    attributes: { 'data-ck-motion': 'fade-up' },
    isContainer: true,
    targetIds: ['pricing'],
    onCommit: () => ({ ok: true }),
    onPreview: fn(),
  },
} satisfies Meta<typeof InteractionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Animated: Story = {};
export const Empty: Story = { args: { attributes: {} } };
export const Arabic: Story = { args: { labels: INTERACTIONS_PANEL_LABELS_AR, dir: 'rtl' } };

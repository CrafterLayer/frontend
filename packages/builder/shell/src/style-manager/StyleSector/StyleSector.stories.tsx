import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StyleSector, type StyleSectorProps } from './StyleSector';

function Controlled(props: StyleSectorProps) {
  const [expanded, setExpanded] = useState(props.expanded);
  return (
    <StyleSector
      {...props}
      expanded={expanded}
      onToggle={() => {
        setExpanded(!expanded);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/StyleSector',
  component: StyleSector,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '18rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { title: 'Spacing', expanded: true, onToggle: () => undefined, children: 'Rows go here' },
} satisfies Meta<typeof StyleSector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};
export const Collapsed: Story = { args: { expanded: false } };

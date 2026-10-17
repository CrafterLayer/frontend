import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StackLayerRow } from './StackLayerRow';

import '../StackControl/StackControl.css';

const meta = {
  title: 'Builder/Shell/StyleManager/StackLayerRow',
  component: StackLayerRow,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <DndContext>
          <SortableContext items={['a']}>
            <ul className="bldr-stack__layers">
              <Story />
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    ),
  ],
  args: {
    id: 'a',
    index: 0,
    count: 2,
    value: '0 8px 24px rgb(0 0 0 / 12%)',
    onChange: fn(),
    onMove: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof StackLayerRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

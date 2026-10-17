import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder';

import { Story } from './Story';
import { storySchema } from './schema';

const node: Node = { id: 'story-demo', type: 'story', props: {} };

const prose = storySchema.props.parse({
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Select this line and make it ' },
          { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: '.' },
        ],
      },
    ],
  },
});

const meta = {
  title: 'Playground/Story',
  component: Story,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Story>;

export default meta;
type StoryEntry = StoryObj<typeof meta>;

export const ReadPath: StoryEntry = {
  args: {
    node,
    props: prose,
    slots: {},
    data: {},
    isCanvas: false,
  },
};

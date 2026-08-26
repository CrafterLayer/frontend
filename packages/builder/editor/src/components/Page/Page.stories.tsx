import type { Meta, StoryObj } from '@storybook/react-vite';

import { landingFixture } from '@craftkit/builder-core/testing';

import { Page } from './Page';

const rootNode = landingFixture().nodes['root'];
if (rootNode === undefined) {
  throw new Error('landing fixture changed: root missing');
}

const meta = {
  title: 'Builder/Preset/Page',
  component: Page,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSections: Story = {
  args: {
    node: rootNode,
    props: { title: 'Landing' },
    slots: {
      default: (
        <>
          <section>Hero section placeholder</section>
          <section>Features section placeholder</section>
        </>
      ),
    },
    data: {},
    isCanvas: false,
  },
};

export const Empty: Story = {
  args: {
    node: { ...rootNode, slots: {} },
    props: { title: '' },
    slots: {},
    data: {},
    isCanvas: false,
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';

import { landingFixture } from '@craftkit/builder-core/testing';

import { Page } from './Page';
import { pageSchema } from './schema';

const rootNode = landingFixture().nodes['root'];
if (rootNode === undefined) {
  throw new Error('landing fixture changed: root missing');
}

const defaultPageProps = pageSchema.props.parse({});

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
    props: {
      ...defaultPageProps,
      title: 'Landing',
      description: 'A concise landing-page summary kept in page metadata.',
      slug: 'landing',
      socialTitle: 'Landing on CraftKit',
      socialDescription: 'A share-specific summary that does not enter visible page content.',
      socialImage: 'https://example.com/landing-social.png',
      contentWidth: 'wide',
      lang: 'en',
    },
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
    props: defaultPageProps,
    slots: {},
    data: {},
    isCanvas: false,
  },
};

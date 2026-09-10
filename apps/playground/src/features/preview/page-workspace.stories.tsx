import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { createSiteBuilder, defaultBlocks, emptyDocument } from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import '../../app/App.css';
import { createReferenceCodePageSite } from './code-page-fixture';
import { PageWorkspace } from './page-workspace';

function storyKernel() {
  const site = createReferenceCodePageSite();
  site.pages = [
    ...site.pages,
    {
      id: 'about',
      address: '/about',
      title: 'About',
      purpose: 'Explain the studio.',
      audience: 'Prospective clients',
      document: emptyDocument(),
      regions: [],
    },
  ];
  return createSiteBuilder({
    site,
    ports: { clock: fixedClock(), ids: seededIds('pages-story') },
    extensions: [defaultBlocks],
  });
}

const meta = {
  title: 'Playground/PageWorkspace',
  component: PageWorkspace,
  decorators: [
    (Story) => (
      <div style={{ blockSize: 700, inlineSize: 'min(760px, 100vw)', position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PageList: Story = { args: { siteKernel: storyKernel() } };

export const Sitemap: Story = {
  args: { siteKernel: storyKernel(), initialView: 'map' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Site map' })).toBeVisible();
  },
};

export const CodePageSettings: Story = {
  args: { siteKernel: storyKernel() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Northstar Studio' }));
    await userEvent.click(canvas.getByRole('menuitem', { name: 'SEO and settings' }));
    await expect(canvas.getByRole('form', { name: 'Settings for Northstar Studio' })).toBeVisible();
  },
};

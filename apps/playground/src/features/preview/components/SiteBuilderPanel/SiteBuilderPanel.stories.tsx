import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import type { SiteRunSeam } from '../AssistantPanel/use-site-run';
import { SiteBuilderPanel } from './SiteBuilderPanel';

/** A lease nobody else holds; the stories exercise the surface, not the run. */
const freeSeam: SiteRunSeam = {
  busy: false,
  claim: () => true,
  release: () => undefined,
  stop: () => undefined,
};

const busySeam: SiteRunSeam = { ...freeSeam, busy: true, claim: () => false };

const meta = {
  title: 'Playground/SiteBuilderPanel',
  component: SiteBuilderPanel,
  parameters: { layout: 'centered' },
  args: { seam: freeSeam, onStop: fn(), locale: 'en' },
  argTypes: { site: { control: false }, seam: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '24rem', background: 'var(--bldr-panel)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SiteBuilderPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * No site wired: the destination says so in words.
 *
 * A blank panel and a panel with nothing to do look identical, and only one of
 * them is a bug. This one says which it is.
 */
export const NoSite: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/nothing here to build into/u)).toBeVisible();
    await expect(canvas.queryByLabelText('Describe the site you want')).toBeNull();
  },
};

/** Another run owns the editor: the form is closed rather than hidden. */
export const AnotherRunOwnsTheEditor: Story = {
  args: { seam: busySeam },
};

/** Arabic, right to left — the product's own default. */
export const Arabic: Story = {
  args: { locale: 'ar' },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '24rem', background: 'var(--bldr-panel)' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByRole('region', { name: 'ابنِ موقعاً' })).toBeVisible();
    });
  },
};

/** The heading names the destination, so the rail and the panel agree. */
export const Named: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Build a site' })).toBeVisible();
    await userEvent.tab();
  },
};

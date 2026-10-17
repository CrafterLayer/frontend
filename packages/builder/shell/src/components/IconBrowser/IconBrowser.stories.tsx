import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconBrowser } from './IconBrowser';
import { ICON_BROWSER_LABELS_AR } from './IconBrowser.labels';

const meta = {
  title: 'Builder/Shell/DesignSystem/IconBrowser',
  component: IconBrowser,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '22rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { onPick: () => undefined, limit: 60 },
} satisfies Meta<typeof IconBrowser>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllSets: Story = {};
export const LucideOnly: Story = { args: { defaultSet: 'lucide', value: 'mail' } };
export const TablerFilled: Story = { args: { defaultSet: 'tabler-filled' } };
export const Arabic: Story = { args: { labels: ICON_BROWSER_LABELS_AR, dir: 'rtl' } };

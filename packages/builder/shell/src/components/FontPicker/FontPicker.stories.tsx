import type { Meta, StoryObj } from '@storybook/react-vite';

import { FontPicker } from './FontPicker';
import { FONT_PICKER_LABELS_AR } from './FontPicker.labels';

const meta = {
  title: 'Builder/Shell/DesignSystem/FontPicker',
  component: FontPicker,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '24rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { onPick: () => undefined, value: 'Cairo' },
} satisfies Meta<typeof FontPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const upload = (): void => undefined;

export const Default: Story = { args: { onUpload: upload } };
export const ArabicFirst: Story = { args: { arabicFirst: true, onUpload: upload } };
export const PickOnly: Story = {};
export const Arabic: Story = {
  args: { labels: FONT_PICKER_LABELS_AR, dir: 'rtl', arabicFirst: true, onUpload: upload },
};

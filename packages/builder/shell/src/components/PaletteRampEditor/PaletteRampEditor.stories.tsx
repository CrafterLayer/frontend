import type { Meta, StoryObj } from '@storybook/react-vite';

import type { SiteCommit } from '../DesignSystemPanel/site-door';
import { PaletteRampEditor } from './PaletteRampEditor';
import { PALETTE_RAMP_EDITOR_LABELS_AR } from './PaletteRampEditor.labels';

const accept: SiteCommit = () => ({ ok: true });
const full: SiteCommit = () => ({
  ok: false,
  message: 'The palette is full (120 colours); remove one first.',
});

const meta = {
  title: 'Builder/Shell/DesignSystem/PaletteRampEditor',
  component: PaletteRampEditor,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '24rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    commit: accept,
    contrastColumns: [{ name: 'Surface', css: '#f8fafc' }],
  },
} satisfies Meta<typeof PaletteRampEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Teal: Story = {};
export const Indigo: Story = { args: { defaultName: 'Indigo', defaultColor: '#4f46e5' } };
export const ReplacesExisting: Story = { args: { existingIds: ['brand-500', 'brand-600'] } };
export const Refused: Story = {
  args: {
    commit: full,
  },
};
export const Arabic: Story = {
  args: { labels: PALETTE_RAMP_EDITOR_LABELS_AR, dir: 'rtl', defaultName: 'Brand' },
};

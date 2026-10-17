import type { Meta, StoryObj } from '@storybook/react-vite';

import { OptionIcon } from './OptionIcon';
import { OPTION_GLYPHS } from './option-glyphs';

function Sheet({ dir, theme }: { readonly dir: 'ltr' | 'rtl'; readonly theme: 'light' | 'dark' }) {
  return (
    <div
      className="bldr-root"
      data-bldr-theme={theme}
      dir={dir}
      style={{
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        display: 'grid',
        gap: '8px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))',
        padding: '16px',
      }}
    >
      {Object.keys(OPTION_GLYPHS).map((key) => {
        const [property = '', value = ''] = key.split(':');
        return (
          <div key={key} style={{ alignItems: 'center', display: 'flex', gap: '8px', fontSize: '12px' }}>
            <OptionIcon property={property} value={value} />
            <code>{key}</code>
          </div>
        );
      })}
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/OptionIcon',
  component: OptionIcon,
  args: { property: 'flexDirection', value: 'row' },
} satisfies Meta<typeof OptionIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};
export const AllLight: Story = { render: () => <Sheet dir="ltr" theme="light" /> };
export const AllDarkRightToLeft: Story = { render: () => <Sheet dir="rtl" theme="dark" /> };

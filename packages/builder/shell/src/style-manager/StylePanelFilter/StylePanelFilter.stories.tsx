import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StylePanelFilter, type StylePanelFilterProps } from './StylePanelFilter';

const EN = { filter: 'Filter properties', filterPlaceholder: 'Find a property…', clearFilter: 'Clear filter' };
const AR = { filter: 'تصفية الخصائص', filterPlaceholder: 'ابحث عن خاصية…', clearFilter: 'مسح البحث' };

function Controlled(props: StylePanelFilterProps) {
  const [query, setQuery] = useState(props.query);
  return <StylePanelFilter {...props} query={query} onQueryChange={setQuery} />;
}

const meta = {
  title: 'Builder/Shell/StyleManager/StylePanelFilter',
  component: StylePanelFilter,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story, context) => (
      <div
        className="bldr-root"
        data-bldr-theme={context.name.includes('Dark') ? 'dark' : 'light'}
        dir={context.name.includes('Arabic') ? 'rtl' : 'ltr'}
        style={{ background: 'var(--bldr-panel)', maxInlineSize: '18rem', padding: '16px' }}
      >
        <Story />
      </div>
    ),
  ],
  args: { query: '', labels: EN, onQueryChange: () => undefined },
} satisfies Meta<typeof StylePanelFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { args: { query: 'radius' } };
export const ArabicLight: Story = { args: { labels: AR } };
export const ArabicDark: Story = { args: { labels: AR, query: 'الحشوة' } };

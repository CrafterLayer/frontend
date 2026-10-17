import type { Meta, StoryObj } from '@storybook/react-vite';

import type { SiteLibrary } from '@craftkit/builder-schema';

import { SiteDesignContext } from '../site-design-context';
import { SiteLibraryStyle } from './SiteLibraryStyle';

const library: SiteLibrary = {
  palette: [
    { id: 'brand-600', name: 'Brand 600', value: '#0f766e', group: 'Brand' },
    { id: 'sand', name: 'Sand', value: 'oklch(92% 0.04 85)' },
  ],
  fonts: [{ family: 'IBM Plex Sans Arabic', source: 'google', weights: [400, 700] }],
};

/*
  The swatches read the published variables, so the story shows the one thing
  the component is for: that `--ck-c-<id>` resolves on the page.
*/
function Swatches() {
  return (
    <div data-ck-page="" style={{ display: 'flex', gap: 12, fontFamily: '"IBM Plex Sans Arabic"' }}>
      <div
        style={{
          background: 'var(--ck-c-brand-600)',
          color: 'white',
          paddingBlock: 24,
          paddingInline: 32,
        }}
      >
        brand-600 · العلامة
      </div>
      <div style={{ background: 'var(--ck-c-sand)', paddingBlock: 24, paddingInline: 32 }}>
        sand · رمل
      </div>
    </div>
  );
}

const meta = {
  title: 'Builder/Renderer/SiteLibraryStyle',
  component: SiteLibraryStyle,
  render: (args) => (
    <>
      <SiteLibraryStyle {...args} />
      <Swatches />
    </>
  ),
} satisfies Meta<typeof SiteLibraryStyle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FromProp: Story = {
  args: { library },
};

export const FromContext: Story = {
  args: {},
  decorators: [
    (Story) => (
      <SiteDesignContext.Provider value={{ library }}>
        <Story />
      </SiteDesignContext.Provider>
    ),
  ],
};

export const RightToLeft: Story = {
  args: { library },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};

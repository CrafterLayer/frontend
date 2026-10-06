import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StylePropertyId } from '@craftkit/builder-schema';

import { viewStyles, type PropertyView } from '../style-view';
import { STYLE_PANEL_LABELS_EN } from '../StylePanel/StylePanel.labels';
import { StyleProperty } from './StyleProperty';

const views = viewStyles(['p-4 mbs-2 text-lg bg-accent rounded-lg'], { bucket: 'base', state: 'default' });
function viewOf(id: StylePropertyId): PropertyView {
  const view = views.get(id);
  if (view === undefined) throw new Error(`no view for ${id}`);
  return view;
}

const tokens = [
  { id: 'surface', name: 'Surface', css: '#ffffff' },
  { id: 'text', name: 'Text', css: '#111827' },
  { id: 'accent', name: 'Accent', css: '#2563eb' },
];

const meta = {
  title: 'Builder/Shell/StyleManager/StyleProperty',
  component: StyleProperty,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    view: viewOf('fontSize'),
    mode: 'free',
    dir: 'ltr',
    tokens,
    palette: [],
    onEdit: fn(),
    labels: STYLE_PANEL_LABELS_EN,
  },
} satisfies Meta<typeof StyleProperty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FontSize: Story = {};
export const BoxModel: Story = { args: { view: viewOf('padding'), companion: viewOf('margin') } };
export const Colour: Story = { args: { view: viewOf('backgroundColor') } };
export const Radius: Story = { args: { view: viewOf('borderRadius') } };

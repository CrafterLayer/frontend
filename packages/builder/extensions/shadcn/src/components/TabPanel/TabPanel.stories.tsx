import * as RadixTabs from '@radix-ui/react-tabs';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { TabPanel } from './TabPanel';
import { tabPanelSchema } from './schema';

const node: Node = { id: 'monthly', type: 'tabPanel', props: {} };

const meta = {
  title: 'Builder/Shadcn/TabPanel',
  component: TabPanel,
  /*
    Radix's Content asserts it is inside a Root — correctly, since a panel with
    no strip has nothing to be controlled by. The decorator is the real
    context, not a stand-in for one.
  */
  decorators: [
    (Story) => (
      <RadixTabs.Root defaultValue="monthly">
        <RadixTabs.List>
          <RadixTabs.Trigger value="monthly">Monthly</RadixTabs.Trigger>
        </RadixTabs.List>
        <Story />
      </RadixTabs.Root>
    ),
  ],
  args: {
    node,
    slots: { default: <p style={{ margin: 0 }}>$29 per month, cancel any time.</p> },
    data: {},
    isCanvas: false,
  },
} satisfies Meta<typeof TabPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { args: { props: tabPanelSchema.props.parse({ label: 'Monthly' }) } };

/**
 * Block parts on the canvas: every inner element carries its part address
 * (`data-ck-part` / `data-ck-bind`), which the canvas hit test, the outline,
 * the quick bar and inline editing read. A published render carries none.
 */
export const Parts: Story = {
  args: {
    node: { id: 'monthly', type: 'tabPanel', props: {} },
    props: tabPanelSchema.props.parse({ label: 'Monthly' }),
    slots: { default: <p style={{ margin: 0 }}>$29 per month, cancel any time.</p> },
    data: {},
    isCanvas: true,
  },
};

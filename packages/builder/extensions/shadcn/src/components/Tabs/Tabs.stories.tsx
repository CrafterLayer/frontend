import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { TabPanel } from '../TabPanel/TabPanel';
import { tabPanelSchema } from '../TabPanel/schema';

import { Tabs } from './Tabs';
import { tabsSchema } from './schema';

const node: Node = { id: 'tabs', type: 'tabs', props: {} };

const panel = (id: string, label: string, body: string) => (
  <TabPanel
    key={id}
    node={{ id, type: 'tabPanel', props: {} }}
    props={tabPanelSchema.props.parse({ label })}
    slots={{ default: <p style={{ margin: 0 }}>{body}</p> }}
    data={{}}
    isCanvas={false}
  />
);

const panels = [
  panel('monthly', 'Monthly', '$29 per month, cancel any time.'),
  panel('yearly', 'Yearly', '$290 per year — two months free.'),
];

const meta = {
  title: 'Builder/Shadcn/Tabs',
  component: Tabs,
  args: { node, slots: { default: panels }, data: {}, isCanvas: false },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { props: tabsSchema.props.parse({}) } };

export const Centred: Story = { args: { props: tabsSchema.props.parse({ align: 'center' }) } };

/**
 * The behaviour Radix is here for.
 *
 * A tab strip is four lines of state and forty of accessibility, and the forty
 * are the part everyone reimplements incorrectly. This asserts the ones a
 * keyboard user actually depends on.
 */
export const KeyboardContract: Story = {
  args: { props: tabsSchema.props.parse({}) },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const monthly = canvas.getByRole('tab', { name: 'Monthly' });

    await step('arrow keys move between tabs', async () => {
      monthly.focus();
      await userEvent.keyboard('{ArrowRight}');
      await expect(canvas.getByRole('tab', { name: 'Yearly' })).toHaveFocus();
    });

    await step('the selected panel is the one on screen', async () => {
      const shown = canvas.getByRole('tabpanel');
      await expect(shown).toHaveTextContent('two months free');
      /*
        A roving tabindex means exactly ONE tab is reachable by Tab. Without it
        a strip of six tabs costs six presses to step past.
      */
      await expect(canvas.getByRole('tab', { name: 'Monthly' })).toHaveAttribute('tabindex', '-1');
    });

    await step('every trigger is paired with its panel', async () => {
      const active = canvas.getByRole('tab', { selected: true });
      const shown = canvas.getByRole('tabpanel');
      await expect(active).toHaveAttribute('aria-controls', shown.id);
      await expect(shown).toHaveAttribute('aria-labelledby', active.id);
    });
  },
};

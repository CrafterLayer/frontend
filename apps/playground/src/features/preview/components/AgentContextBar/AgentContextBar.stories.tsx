import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { AgentContextBar } from './AgentContextBar';

const meta = {
  title: 'Playground/AgentContextBar',
  component: AgentContextBar,
  decorators: [(Story) => <div style={{ inlineSize: 320 }}><Story /></div>],
  args: { scope: 'page', label: 'Home', detail: '/' },
} satisfies Meta<typeof AgentContextBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};
export const Site: Story = { args: { scope: 'site', label: 'Craft coffee website', detail: '3 pages' } };
export const Instance: Story = { args: { scope: 'instance', label: 'Hero heading', detail: 'Home' } };
export const Shared: Story = { args: { scope: 'shared', label: 'Navbar', detail: '6 instances · 3 pages' } };
export const Stale: Story = { args: { scope: 'stale', label: 'Hero heading was removed', detail: 'Reselect' } };
export const Rtl: Story = { args: { label: 'عنوان القسم', detail: 'الرئيسية' }, decorators: [(Story) => <div dir="rtl"><Story /></div>] };

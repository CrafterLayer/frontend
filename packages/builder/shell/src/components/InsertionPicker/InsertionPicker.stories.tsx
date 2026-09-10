import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import type { InsertionAnchor } from '@craftkit/builder-schema';

import { InsertionPicker } from './InsertionPicker';

const anchor = (mode: InsertionAnchor['mode']): InsertionAnchor => ({
  pageId: 'home',
  owner: 'page',
  slot: 'default',
  mode,
  beforeId: 'hero',
  afterId: 'features',
  revision: 'site-3',
});
const options = [
  { id: 'button', label: 'Button', description: 'A clear call to action', kind: 'component' },
  { id: 'card', label: 'Card', description: 'Content in a bordered surface', kind: 'component' },
  { id: 'pricing', label: 'Pricing', description: 'Three plans and comparison', kind: 'section' },
  { id: 'faq', label: 'FAQ', description: 'Expandable questions', kind: 'section' },
] as const;

const meta = {
  title: 'Builder/Shell/InsertionPicker',
  component: InsertionPicker,
  args: {
    anchor: anchor('before'),
    anchorLabel: 'Features',
    options,
    onInsert: fn(),
    onGenerate: fn(),
    onRequestAnchor: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof InsertionPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Before: Story = {};
export const After: Story = { args: { anchor: anchor('after'), anchorLabel: 'Hero' } };
export const Inside: Story = {
  args: { anchor: anchor('inside'), anchorLabel: 'Hero actions', initialMode: 'components' },
};
export const Stale: Story = { args: { state: 'stale' } };
export const Generating: Story = { args: { state: 'generating', initialMode: 'generate' } };
